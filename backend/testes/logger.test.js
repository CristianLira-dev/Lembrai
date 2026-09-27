const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const logger = require('../src/configuracao/logger');

function capturarLinha() {
  let conteudo = '';
  return {
    destino: new Writable({
      write(parte, codificacao, callback) {
        conteudo += parte.toString();
        callback();
      }
    }),
    obter: () => conteudo
  };
}

test('logger oculta segredos mesmo quando um objeto HTTP completo é registrado', () => {
  const captura = capturarLinha();
  const instancia = logger.criarLogger(captura.destino);

  instancia.info({
    req: {
      headers: {
        authorization: 'Bearer token-super-secreto',
        cookie: 'sessao=segredo-cookie',
        apikey: 'chave-evolution',
        'x-api-key': 'chave-api',
        'x-webhook-secret': 'segredo-webhook',
        'x-servico-token': 'segredo-interno'
      },
      body: { apikey: 'chave-no-corpo' }
    },
    config: {
      headers: {
        Authorization: 'Bearer token-axios',
        apikey: 'chave-axios',
        'x-webhook-secret': 'segredo-webhook-axios'
      }
    }
  }, 'teste de segurança');

  const linha = captura.obter();
  for (const segredo of [
    'token-super-secreto', 'segredo-cookie', 'chave-evolution', 'chave-api',
    'segredo-webhook', 'segredo-interno', 'chave-no-corpo', 'token-axios',
    'chave-axios', 'segredo-webhook-axios'
  ]) {
    assert.doesNotMatch(linha, new RegExp(segredo));
  }
  assert.match(linha, /\[OCULTO\]/);
});

test('serializador HTTP não inclui cabeçalhos nem corpo da requisição', () => {
  const serializada = logger.serializarRequisicao({
    id: 7,
    method: 'POST',
    url: '/api/webhooks/evolution?code=codigo-oauth-secreto',
    query: { code: 'codigo-oauth-secreto' },
    params: {},
    remoteAddress: '127.0.0.1',
    remotePort: 12345,
    headers: { 'x-webhook-secret': 'segredo-webhook' },
    body: { apikey: 'chave-evolution' }
  });

  assert.deepEqual(serializada, {
    id: 7,
    method: 'POST',
    url: '/api/webhooks/evolution',
    params: {},
    remoteAddress: '127.0.0.1',
    remotePort: 12345
  });
  assert.equal('headers' in serializada, false);
  assert.equal('body' in serializada, false);
  assert.equal('query' in serializada, false);
  assert.doesNotMatch(JSON.stringify(serializada), /codigo-oauth-secreto/);
});
