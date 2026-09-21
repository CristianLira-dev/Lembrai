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
  if (!Number.isFinite(numero)) return 0;
  return numero < 10_000_000_000 ? numero * 1000 : numero;
}

function iniciarConsultaMensagensEvolution({
  servicoWhatsapp,
  repositorio,
  servicoAssistente,
  intervaloMs = 15_000,
  janelaInicialMs = 5 * 60_000,
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
        .filter((mensagem) => timestampEmMilissegundos(mensagem.messageTimestamp) >= inicioDaJanela)
        .sort((a, b) => timestampEmMilissegundos(a.messageTimestamp) - timestampEmMilissegundos(b.messageTimestamp));

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
        if (registro.duplicado) continue;

        await servicoAssistente.processarEntrada({
          telefone,
          nome: mensagem.pushName || 'Estudante',
          texto,
          identificadorExterno: identificador,
          recebidoEm: timestampEmMilissegundos(mensagem.messageTimestamp)
            ? new Date(timestampEmMilissegundos(mensagem.messageTimestamp)).toISOString()
            : new Date().toISOString(),
          evento: mensagem
        });
        processadas += 1;
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

module.exports = { diagnosticoConsultaEvolution, iniciarConsultaMensagensEvolution, obterJidContato, timestampEmMilissegundos };
