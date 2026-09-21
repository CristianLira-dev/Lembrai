const test = require('node:test');
const assert = require('node:assert/strict');
const { codigoSeguroErroChatbot } = require('../src/servicos/servico-chatbot');

test('classifica falhas do chatbot sem expor detalhes sensíveis', () => {
  assert.equal(codigoSeguroErroChatbot({ response: { status: 401 } }), 'token_incompativel');
  assert.equal(codigoSeguroErroChatbot({ response: { status: 503 } }), 'token_nao_configurado');
  assert.equal(codigoSeguroErroChatbot({ response: { status: 404 } }), 'chatbot_desatualizado');
  assert.equal(codigoSeguroErroChatbot({ code: 'ECONNABORTED' }), 'tempo_esgotado');
  assert.equal(codigoSeguroErroChatbot({ code: 'ENOTFOUND' }), 'enotfound');
});
