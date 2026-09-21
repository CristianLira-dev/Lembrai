process.env.USAR_BANCO_MEMORIA = process.env.USAR_BANCO_MEMORIA || 'false';
process.env.USAR_FILAS_MEMORIA = 'true';

const ambiente = require('../src/configuracao/ambiente');
const logger = require('../src/configuracao/logger');
const { app, servicos } = require('../src/servidor');
const { iniciarAgendadorLocal } = require('../src/agendador-local');
const { iniciarConsultaMensagensEvolution } = require('../src/consulta-mensagens-evolution');

const servidor = app.listen(ambiente.porta, async () => {
  logger.info({ porta: ambiente.porta, banco: 'postgresql', filas: 'local', whatsapp: ambiente.modoWhatsapp }, 'backend iniciado sem Redis');

  if (ambiente.modoWhatsapp !== 'evolution') return;

  const urlWebhook = `${ambiente.urlBackend.replace(/\/+$/, '')}/api/webhooks/evolution`;
  try {
    await servicos.servicoWhatsapp.configurarWebhook(urlWebhook);
    logger.info({ urlWebhook }, 'webhook da Evolution API configurado');
  } catch (erro) {
    logger.error({ erro: erro.message, codigo: erro.code, urlWebhook }, 'não foi possível configurar o webhook da Evolution API');
  }
});

const agendador = iniciarAgendadorLocal({ servicoLembretes: servicos.servicoLembretes });
const consultaEvolution = ambiente.modoWhatsapp === 'evolution'
  ? iniciarConsultaMensagensEvolution({
    servicoWhatsapp: servicos.servicoWhatsapp,
    repositorio: servicos.repositorio,
    servicoAssistente: servicos.servicoAssistente
  })
  : null;

function encerrar() {
  agendador.parar();
  consultaEvolution?.parar();
  servidor.close(async () => {
    await servicos.repositorio?.desconectar?.();
    process.exit(0);
  });
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
