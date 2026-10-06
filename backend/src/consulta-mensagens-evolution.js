const logger = require('./configuracao/logger');
const { extrairTextoMensagem, normalizarTelefone } = require('./integracoes/evolution-api/provedor-evolution-api');

const diagnosticoConsultaEvolution = {
  ativo: false,
  ultimaConsulta: null,
  ultimaFalha: null,
  consultadas: 0,
  processadas: 0,
  codigoErro: null,
  statusHttp: null
};

function obterJidContato(mensagem = {}) {
  const chave = mensagem.key || {};
  const principal = chave.remoteJid || '';
  if (principal.endsWith('@g.us')) return '';
  if (principal.endsWith('@lid')) return chave.remoteJidAlt || '';
  return principal;
}

function timestampEmMilissegundos(valor) {
  const numero = Number(valor);
  if (valor !== '' && Number.isFinite(numero)) {
    const milissegundos = numero < 10_000_000_000 ? numero * 1000 : numero;
    if (!Number.isNaN(new Date(milissegundos).getTime())) return milissegundos;
  }
  const data = Date.parse(valor);
  return Number.isFinite(data) ? data : 0;
}

function timestampDaMensagem(mensagem = {}) {
  return timestampEmMilissegundos(mensagem.messageTimestamp || mensagem.timestamp || mensagem.createdAt || mensagem.date_time);
}

function iniciarConsultaMensagensEvolution({
  servicoWhatsapp,
  repositorio,
  servicoAssistente,
  intervaloMs = 15_000,
  // Recupera mensagens recebidas enquanto o backend esteve indisponível. O
  // repositório deduplica pelo ID externo, portanto não responde duas vezes.
  janelaInicialMs = 24 * 60 * 60_000,
  agora = () => Date.now()
}) {
  const inicioDaJanela = agora() - janelaInicialMs;
  let executando = false;
  diagnosticoConsultaEvolution.ativo = true;

  async function consultarAgora() {
    if (executando) return { ignorado: true, motivo: 'consulta_em_andamento' };
    executando = true;
    let processadas = 0;
    try {
      const mensagens = await servicoWhatsapp.buscarMensagensRecentes(50);
      const recebidas = mensagens
        .filter((mensagem) => mensagem?.key?.fromMe === false)
        .filter((mensagem) => timestampDaMensagem(mensagem) >= inicioDaJanela)
        .sort((a, b) => timestampDaMensagem(a) - timestampDaMensagem(b));

      for (const mensagem of recebidas) {
        const texto = extrairTextoMensagem(mensagem);
        const telefone = normalizarTelefone(obterJidContato(mensagem));
        const identificador = mensagem.key?.id || mensagem.id;
        if (!texto || !telefone || !identificador) continue;

        const registro = await repositorio.registrarEventoWebhook({
          provedor: 'evolution-polling',
          identificadorEventoExterno: identificador,
          tipoEvento: 'MESSAGES_UPSERT',
          dados: { origem: 'polling', instanceId: mensagem.instanceId, key: mensagem.key }
        });
        if (registro.duplicado) {
          const status = registro.evento?.statusProcessamento;
          const recebidoEm = Date.parse(registro.evento?.recebidoEm);
          const recebidoParado = status === 'recebido' && Number.isFinite(recebidoEm) && recebidoEm <= agora() - 120_000;
          if (status !== 'falhou' && !recebidoParado) continue;
        }

        try {
          const resultado = await servicoAssistente.processarEntrada({
            telefone,
            nome: mensagem.pushName || 'Estudante',
            texto,
            identificadorExterno: identificador,
            recebidoEm: timestampDaMensagem(mensagem)
              ? new Date(timestampDaMensagem(mensagem)).toISOString()
              : new Date().toISOString()
          });
          await repositorio.atualizarEventoWebhook?.(registro.evento?.id, { statusProcessamento: 'concluido' });
          if (!resultado?.duplicado || resultado?.reenviado) processadas += 1;
        } catch (erro) {
          await repositorio.atualizarEventoWebhook?.(registro.evento?.id, { statusProcessamento: 'falhou' });
          logger.error({ erro: erro.message, codigo: erro.code }, 'falha ao recuperar mensagem individual da Evolution');
        }
      }

      if (processadas) logger.info({ processadas }, 'mensagens recuperadas pelo fallback da Evolution');
      Object.assign(diagnosticoConsultaEvolution, {
        ultimaConsulta: new Date(agora()).toISOString(),
        consultadas: mensagens.length,
        processadas,
        codigoErro: null,
        statusHttp: null
      });
      return { consultadas: mensagens.length, processadas };
    } catch (erro) {
      Object.assign(diagnosticoConsultaEvolution, {
        ultimaConsulta: new Date(agora()).toISOString(),
        ultimaFalha: new Date(agora()).toISOString(),
        codigoErro: erro.code || 'ERRO_EVOLUTION',
        statusHttp: erro.response?.status || null
      });
      logger.error({ erro: erro.message, codigo: erro.code }, 'falha ao consultar mensagens na Evolution');
      return { erro };
    } finally {
      executando = false;
    }
  }

  const timer = setInterval(consultarAgora, intervaloMs);
  timer.unref?.();
  const pronto = consultarAgora();

  return {
    pronto,
    consultarAgora,
    parar() {
      clearInterval(timer);
      diagnosticoConsultaEvolution.ativo = false;
    }
  };
}

module.exports = { diagnosticoConsultaEvolution, iniciarConsultaMensagensEvolution, obterJidContato, timestampEmMilissegundos, timestampDaMensagem };
