const pino = require('pino');

const CAMINHOS_SENSIVEIS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.apikey',
  'req.headers["x-api-key"]',
  'req.headers["x-webhook-secret"]',
  'req.headers["x-servico-token"]',
  'req.body.apikey',
  'body.apikey',
  'headers.authorization',
  'headers.cookie',
  'headers.apikey',
  'headers["x-api-key"]',
  'headers["x-webhook-secret"]',
  'headers["x-servico-token"]',
  'config.headers.authorization',
  'config.headers.Authorization',
  'config.headers.apikey',
  'config.headers["x-api-key"]',
  'config.headers["x-webhook-secret"]',
  'config.headers["x-servico-token"]',
  'res.headers["set-cookie"]'
];

function serializarRequisicao(req = {}) {
  return {
    id: req.id,
    method: req.method,
    url: typeof req.url === 'string' ? req.url.split('?')[0] : req.url,
    params: req.params,
    remoteAddress: req.remoteAddress,
    remotePort: req.remotePort
  };
}

function criarLogger(destino) {
  return pino({
    level: process.env.NIVEL_LOG || 'info',
    base: undefined,
    redact: { paths: CAMINHOS_SENSIVEIS, censor: '[OCULTO]' },
    timestamp: pino.stdTimeFunctions.isoTime
  }, destino);
}

const logger = criarLogger();

logger.CAMINHOS_SENSIVEIS = CAMINHOS_SENSIVEIS;
logger.criarLogger = criarLogger;
logger.serializarRequisicao = serializarRequisicao;

module.exports = logger;
