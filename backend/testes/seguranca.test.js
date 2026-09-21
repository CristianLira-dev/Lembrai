process.env.AMBIENTE = 'producao';
process.env.EVOLUTION_WEBHOOK_SEGREDO = 'segredo-do-webhook';
process.env.EVOLUTION_API_CHAVE = 'chave-da-evolution';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validarSegredoWebhook } = require('../src/intermediarios/seguranca');

function resposta() {
  return {
    statusCode: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(corpo) { this.corpo = corpo; return this; }
  };
}

test('aceita a apikey enviada no corpo pela Evolution', () => {
  const req = { body: { apikey: 'chave-da-evolution' }, headers: {} };
  const res = resposta();
  let passou = false;
  validarSegredoWebhook(req, res, () => { passou = true; });
  assert.equal(passou, true);
  assert.equal(res.statusCode, null);
});

test('rejeita webhook sem segredo válido', () => {
  const req = { body: { apikey: 'chave-incorreta' }, headers: {} };
  const res = resposta();
  validarSegredoWebhook(req, res, () => { throw new Error('não deveria liberar'); });
  assert.equal(res.statusCode, 401);
});

