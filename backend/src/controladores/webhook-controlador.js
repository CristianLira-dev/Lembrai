const { esquemaWebhookEvolution, validar } = require('../validadores/esquemas');
const { extrairTextoMensagem, normalizarTelefone } = require('../integracoes/evolution-api/provedor-evolution-api');

function criarControladorWebhook({ repositorio, filaMensagens, servicoAssistente }) {
  function statusEntrega(valor) {
    const normalizado = String(valor ?? '').toLowerCase();
    if (['4', 'read', 'played'].includes(normalizado)) return { statusProcessamento: 'lida', lidoEm: new Date() };
    if (['3', 'delivery_ack', 'delivered'].includes(normalizado)) return { statusProcessamento: 'entregue', entregueEm: new Date() };
    if (['2', 'server_ack', 'sent'].includes(normalizado)) return { statusProcessamento: 'enviada', enviadoEm: new Date() };
    if (['error', 'failed', '-1'].includes(normalizado)) return { statusProcessamento: 'nao_entregue', falhouEm: new Date() };
    return null;
  }
  function jidContato(dados, evento) {
    const principal = evento.key?.remoteJid || '';
    if (principal.endsWith('@g.us')) return '';
    if (principal.endsWith('@lid')) return evento.key?.remoteJidAlt || dados.sender || '';
    return principal || dados.sender || '';
  }
  function dataRecebimento(valor) {
    const numero = Number(valor);
    if (valor !== '' && Number.isFinite(numero)) {
      const data = new Date(numero < 10_000_000_000 ? numero * 1000 : numero);
      if (!Number.isNaN(data.getTime())) return data.toISOString();
    }
    const analisada = Date.parse(valor);
    return Number.isFinite(analisada) ? new Date(analisada).toISOString() : new Date().toISOString();
  }
  function metadadosPersistiveis(dados, evento) {
    return {
      event: dados.event,
      instance: dados.instance,
      date_time: dados.date_time || null,
      sender: dados.sender || null,
      data: {
        key: {
          id: evento.key?.id || null,
          remoteJid: evento.key?.remoteJid || null,
          remoteJidAlt: evento.key?.remoteJidAlt || null,
          fromMe: Boolean(evento.key?.fromMe)
        }
      }
    };
  }
  return {
    evolution: async (req, res) => {
      const dados = validar(esquemaWebhookEvolution, req.body);
      const evento = dados.data || {};
      const identificador = evento.key?.id || `${dados.instance}:${dados.event}:${dados.date_time || Date.now()}:${dados.sender || ''}`;
      const registro = await repositorio.registrarEventoWebhook({
        provedor: 'evolution', identificadorEventoExterno: identificador,
        tipoEvento: dados.event, dados: metadadosPersistiveis(dados, evento)
      });
      if (registro.duplicado && registro.evento?.statusProcessamento !== 'falhou') return res.status(200).json({ recebido: true, duplicado: true });
      res.status(registro.duplicado ? 200 : 202).json({ recebido: true, id: registro.evento.id, ...(registro.duplicado ? { reprocessado: true } : {}) });
      const eventoMensagem = dados.event.toUpperCase().replace('.', '_') === 'MESSAGES_UPSERT' || dados.event.toLowerCase() === 'messages.upsert';
      const eventoStatus = dados.event.toUpperCase().replace('.', '_') === 'MESSAGES_UPDATE' || dados.event.toLowerCase() === 'messages.update';
      if (eventoStatus) {
        const idMensagem = evento.key?.id || evento.id;
        const mudanca = statusEntrega(evento.status || evento.update?.status);
        if (idMensagem && mudanca) {
          const mensagem = await repositorio.buscarMensagemPorIdentificadorExterno?.(idMensagem);
          if (mensagem) await repositorio.atualizarMensagem(mensagem.id, mudanca);
        }
        await repositorio.atualizarEventoWebhook?.(registro.evento.id, { statusProcessamento: 'concluido', processadoEm: new Date() });
        return;
      }
      if (eventoMensagem) {
        const texto = extrairTextoMensagem(evento);
        const telefone = normalizarTelefone(jidContato(dados, evento));
        if (!texto || !telefone || evento.key?.fromMe) {
          await repositorio.atualizarEventoWebhook?.(registro.evento.id, { statusProcessamento: 'concluido' });
          return;
        }
        const entrada = { telefone, nome: evento.pushName || 'Estudante', texto, identificadorExterno: identificador, recebidoEm: dataRecebimento(dados.date_time) };
        if (process.env.USAR_FILAS_MEMORIA === 'true') {
          try {
            await servicoAssistente.processarEntrada(entrada);
            await repositorio.atualizarEventoWebhook?.(registro.evento.id, { statusProcessamento: 'concluido' });
          } catch (erro) {
            await repositorio.atualizarEventoWebhook?.(registro.evento.id, { statusProcessamento: 'falhou' });
            console.error('[Webhook] Falha ao processar mensagem sem Redis:', erro.message);
          }
          return;
        }
        try {
          await filaMensagens.add('processar-mensagem', { ...entrada, eventoWebhookId: registro.evento.id });
          await repositorio.atualizarEventoWebhook?.(registro.evento.id, { statusProcessamento: 'enfileirado' });
        } catch (erro) {
          await repositorio.atualizarEventoWebhook?.(registro.evento.id, { statusProcessamento: 'falhou' });
          console.error('[Webhook] Falha ao enfileirar mensagem:', erro.message);
        }
        return;
      }
      await repositorio.atualizarEventoWebhook?.(registro.evento.id, { statusProcessamento: 'concluido' });
    },
    simular: async (req, res) => {
      const dados = validar(esquemaWebhookEvolution, req.body);
      const texto = extrairTextoMensagem(dados.data);
      const telefone = normalizarTelefone(jidContato(dados, dados.data) || '5511999999999');
      const resultado = await servicoAssistente.processarEntrada({ telefone, nome: dados.data?.pushName || 'Estudante', texto, identificadorExterno: dados.data?.key?.id || `simulado-${Date.now()}` });
      return res.json({ ok: true, resposta: resultado.resposta, interpretacao: resultado.interpretacao });
    }
  };
}

module.exports = { criarControladorWebhook };
