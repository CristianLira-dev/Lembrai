const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const ambiente = require('./configuracao/ambiente');
const logger = require('./configuracao/logger');
const { repositorio } = require('./repositorios/repositorio-dados');
const { filas } = require('./filas/filas');
const { ServicoWhatsapp } = require('./servicos/servico-whatsapp');
const { ServicoCalendarios } = require('./servicos/servico-calendarios');
const { ServicoTarefas } = require('./servicos/servico-tarefas');
const { ServicoLembretes } = require('./servicos/servico-lembretes');
const { ServicoAssistente } = require('./servicos/servico-assistente');
const { criarRotas } = require('./rotas/api');
const { tratarErros } = require('./intermediarios/seguranca');

function criarAplicacao(dependencias = {}) {
  const app = express();
  const servicos = {
    repositorio,
    filas,
    servicoWhatsapp: new ServicoWhatsapp(),
    ...(dependencias.servicos || {})
  };
  servicos.servicoCalendarios ||= new ServicoCalendarios(servicos.repositorio);
  servicos.servicoTarefas ||= new ServicoTarefas(servicos.repositorio, servicos.servicoCalendarios);
  servicos.servicoLembretes ||= new ServicoLembretes({ repositorio: servicos.repositorio, servicoWhatsapp: servicos.servicoWhatsapp });
  servicos.servicoAssistente ||= new ServicoAssistente({ repositorio: servicos.repositorio, servicoTarefas: servicos.servicoTarefas, servicoWhatsapp: servicos.servicoWhatsapp });

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: ambiente.corsOrigens, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));
  app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', criarRotas({ ...servicos, filaMensagens: servicos.filas.mensagens }));
  app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
  app.use(tratarErros);
  return { app, servicos };
}

const construida = criarAplicacao();
if (require.main === module) {
  construida.app.listen(ambiente.porta, async () => {
    logger.info({ porta: ambiente.porta }, 'backend iniciado');

    if (ambiente.modoWhatsapp !== 'evolution') return;

    const urlWebhook = `${ambiente.urlBackend.replace(/\/+$/, '')}/api/webhooks/evolution`;
    try {
      await construida.servicos.servicoWhatsapp.configurarWebhook(urlWebhook);
      logger.info({ urlWebhook }, 'webhook da Evolution API configurado');
    } catch (erro) {
      logger.error({ erro: erro.message, codigo: erro.code, urlWebhook }, 'não foi possível configurar o webhook da Evolution API');
    }
  });
}

module.exports = { criarAplicacao, ...construida };
