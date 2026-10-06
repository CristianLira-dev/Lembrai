process.env.USAR_BANCO_MEMORIA = 'true';
process.env.USAR_FILAS_MEMORIA = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const { processarMensagemEnfileirada } = require('../src/worker');

test('worker conclui o evento somente depois de processar a mensagem', async () => {
  const atualizacoes = [];
  const entrada = { telefone: '5511999999999', texto: 'quero estudar algoritmos', eventoWebhookId: 'evento-1' };
  const resultado = await processarMensagemEnfileirada({ data: entrada }, {
    repositorio: { async atualizarEventoWebhook(id, dados) { atualizacoes.push({ id, ...dados }); } },
    servicoAssistente: { async processarEntrada(dados) { assert.equal(dados.eventoWebhookId, undefined); return { resposta: 'ok' }; } }
  });

  assert.deepEqual(resultado, { resposta: 'ok' });
  assert.equal(atualizacoes[0].statusProcessamento, 'processando');
  assert.equal(atualizacoes[1].statusProcessamento, 'concluido');
  assert.ok(atualizacoes[1].processadoEm);
});

test('worker marca o evento como falho e preserva o erro para retry', async () => {
  const atualizacoes = [];
  const falha = new Error('indisponível');
  await assert.rejects(() => processarMensagemEnfileirada({ data: { eventoWebhookId: 'evento-2' } }, {
    repositorio: { async atualizarEventoWebhook(id, dados) { atualizacoes.push({ id, ...dados }); } },
    servicoAssistente: { async processarEntrada() { throw falha; } }
  }), falha);
  assert.equal(atualizacoes.at(-1).statusProcessamento, 'falhou');
});
