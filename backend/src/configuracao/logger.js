const pino = require('pino');

const logger = pino({
  level: process.env.NIVEL_LOG || 'info',
  base: undefined,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
  timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
