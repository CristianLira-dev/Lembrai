const logger = require('./configuracao/logger');
const ambiente = require('./configuracao/ambiente');
ambiente.validarAmbienteProducao();
const { criarWorker, nomesFilas } = require('./filas/filas');
const { servicos } = require('./servidor');

async function processarMensagemEnfileirada(job, dependencias = servicos) {
  const { eventoWebhookId, ...entrada } = job.data;
  if (eventoWebhookId) await dependencias.repositorio.atualizarEventoWebhook?.(eventoWebhookId, { statusProcessamento: 'processando' });
  try {
    const resultado = await dependencias.servicoAssistente.processarEntrada(entrada);
    if (eventoWebhookId) await dependencias.repositorio.atualizarEventoWebhook?.(eventoWebhookId, {
      statusProcessamento: 'concluido', processadoEm: new Date().toISOString()
    });
    return resultado;
  } catch (erro) {
    if (eventoWebhookId) await dependencias.repositorio.atualizarEventoWebhook?.(eventoWebhookId, { statusProcessamento: 'falhou' });
    throw erro;
  }
}

function iniciarWorkers() {
  const workers = [
    criarWorker(nomesFilas.mensagens, processarMensagemEnfileirada),
    criarWorker(nomesFilas.lembretes, async (job) => servicos.servicoLembretes.processar(job.data.lembreteId)),
    criarWorker(nomesFilas.calendarios, async (job) => servicos.servicoCalendarios.sincronizar(job.data.usuarioId, job.data.provedor)),
    criarWorker(nomesFilas.whatsapp, async (job) => servicos.servicoWhatsapp.enviarResposta(job.data.telefone, job.data.texto)),
    criarWorker(nomesFilas.resumos, async (job) => ({ gerado: true, usuarioId: job.data.usuarioId }))
  ];
  logger.info({ quantidade: workers.length }, 'workers iniciados');
  return workers;
}

if (require.main === module) iniciarWorkers();

module.exports = { iniciarWorkers, processarMensagemEnfileirada };
