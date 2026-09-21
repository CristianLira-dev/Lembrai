const { esquemaWebhookEvolution, validar } = require('../validadores/esquemas');
const { extrairTextoMensagem, normalizarTelefone } = require('../integracoes/evolution-api/provedor-evolution-api');

function criarControladorWebhook({ repositorio, filaMensagens, servicoAssistente }) {
  function jidContato(dados, evento) {
    const principal = evento.key?.remoteJid || '';
    if (principal.endsWith('@g.us')) return '';
    if (principal.endsWith('@lid')) return evento.key?.remoteJidAlt || dados.sender || '';
    return principal || dados.sender || '';
  }
  return {
    evolution: async (req, res) => {
      const dados = validar(esquemaWebhookEvolution, req.body);
      const evento = dados.data || {};
      const identificador = evento.key?.id || `${dados.instance}:${dados.event}:${dados.date_time || Date.now()}:${dados.sender || ''}`;
      const registro = await repositorio.registrarEventoWebhook({ provedor: 'evolution', identificadorEventoExterno: identificador, tipoEvento: dados.event, dados });
      if (registro.duplicado) return res.status(200).json({ recebido: true, duplicado: true });
      res.status(202).json({ recebido: true, id: registro.evento.id });
      if (dados.event.toUpperCase().replace('.', '_') === 'MESSAGES_UPSERT' || dados.event.toLowerCase() === 'messages.upsert') {
        const texto = extrairTextoMensagem(evento);
        const telefone = normalizarTelefone(jidContato(dados, evento));
        if (!texto || !telefone || evento.key?.fromMe) return;
        const entrada = { telefone, nome: evento.pushName || 'Estudante', texto, identificadorExterno: identificador, recebidoEm: dados.date_time || new Date().toISOString(), evento };
        if (process.env.USAR_FILAS_MEMORIA === 'true') {
          try {
            await servicoAssistente.processarEntrada(entrada);
          } catch (erro) {
            console.error('[Webhook] Falha ao processar mensagem sem Redis:', erro.message);
          }
          return;
        }
        await filaMensagens.add('processar-mensagem', entrada);
      }
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
