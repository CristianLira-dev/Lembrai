const IORedis = require('ioredis');
const ambiente = require('../configuracao/ambiente');

class RateLimitRedisStore {
  constructor(prefixo) {
    this.prefix = `lembrai:rate:${prefixo}:`;
    this.cliente = new IORedis(ambiente.redis, { maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true });
    this.windowMs = 60000;
  }
  init(opcoes) { this.windowMs = opcoes.windowMs; }
  async increment(chave) {
    if (this.cliente.status === 'wait') await this.cliente.connect();
    const redisChave = this.prefix + chave;
    const totalHits = await this.cliente.incr(redisChave);
    if (totalHits === 1) await this.cliente.pexpire(redisChave, this.windowMs);
    let restante = await this.cliente.pttl(redisChave);
    if (restante < 0) { restante = this.windowMs; await this.cliente.pexpire(redisChave, restante); }
    return { totalHits, resetTime: new Date(Date.now() + restante) };
  }
  async decrement(chave) { await this.cliente.decr(this.prefix + chave); }
  async resetKey(chave) { await this.cliente.del(this.prefix + chave); }
  async shutdown() { await this.cliente.quit(); }
}

function criarStoreRedis(prefixo) {
  return ambiente.ambiente === 'producao' ? new RateLimitRedisStore(prefixo) : undefined;
}

module.exports = { RateLimitRedisStore, criarStoreRedis };
