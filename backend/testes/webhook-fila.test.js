process.env.USAR_FILAS_MEMORIA = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const { criarControladorWebhook } = require('../src/controladores/webhook-controlador');

function resposta() {
  return { status(codigo) { this.statusCode = codigo; return this; }, json(corpo) { this.corpo = corpo; return this; } };
}

test('webhook registra evento enfileirado e passa seu id ao worker', async () => {
  const estados = [];
  let job;
  const controlador = criarControladorWebhook({
    repositorio: {
      async registrarEventoWebhook() { return { duplicado: false, evento: { id: 'evento-fila', statusProcessamento: 'recebido' } }; },
      async atualizarEventoWebhook(id, dados) { estados.push({ id, ...dados }); }
    },
    filaMensagens: { async add(nome, dados) { job = { nome, dados }; } },
    servicoAssistente: { async processarEntrada() { throw new Error('não deve processar direto'); } }
  });

  const res = resposta();
  await controlador.evolution({ body: {
    event: 'messages.upsert',
    data: { key: { id: 'mensagem-fila', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false }, message: { conversation: 'olá' } }
  } }, res);

  assert.equal(res.statusCode, 202);
  assert.equal(job.nome, 'processar-mensagem');
  assert.equal(job.dados.eventoWebhookId, 'evento-fila');
  assert.equal(estados.at(-1).statusProcessamento, 'enfileirado');
});

test('webhook de atualização marca mensagem como entregue sem persistir conteúdo', async () => {
  const atualizacoes = [];
  const controlador = criarControladorWebhook({
    repositorio: {
      async registrarEventoWebhook(dados) {
        assert.equal(dados.dados.data.key.id, 'saida-1');
        assert.equal(JSON.stringify(dados.dados).includes('segredo'), false);
        return { duplicado: false, evento: { id: 'evento-status' } };
      },
      async buscarMensagemPorIdentificadorExterno(id) { return id === 'saida-1' ? { id: 'mensagem-local' } : null; },
      async atualizarMensagem(id, dados) { atualizacoes.push({ id, ...dados }); },
      async atualizarEventoWebhook() {}
    },
    filaMensagens: { async add() {} },
    servicoAssistente: {}
  });
  const res = resposta();
  await controlador.evolution({ body: { event: 'messages.update', apikey: 'segredo', data: { key: { id: 'saida-1', fromMe: true }, status: 'delivered' } } }, res);
  assert.equal(atualizacoes[0].statusProcessamento, 'entregue');
  assert.ok(atualizacoes[0].entregueEm);
});
