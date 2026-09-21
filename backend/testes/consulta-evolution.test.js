process.env.USAR_BANCO_MEMORIA = 'true';
process.env.USAR_FILAS_MEMORIA = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const { diagnosticoConsultaEvolution, iniciarConsultaMensagensEvolution } = require('../src/consulta-mensagens-evolution');

test('recupera mensagem recebida e ignora mensagens enviadas pelo próprio bot', async () => {
  const eventos = new Set();
  const entradas = [];
  const agora = Date.now();
  const mensagens = [
    {
      id: 'registro-1',
      key: { id: 'entrada-1', remoteJid: '5513996873783@s.whatsapp.net', fromMe: false },
      pushName: 'Cristian',
      message: { conversation: 'olá' },
      messageTimestamp: Math.floor(agora / 1000)
    },
    {
      id: 'registro-2',
      key: { id: 'saida-1', remoteJid: '5513996873783@s.whatsapp.net', fromMe: true },
      message: { conversation: 'resposta' },
      messageTimestamp: Math.floor(agora / 1000)
    }
  ];
  const repositorio = {
    async registrarEventoWebhook(dados) {
      if (eventos.has(dados.identificadorEventoExterno)) return { duplicado: true };
      eventos.add(dados.identificadorEventoExterno);
      return { duplicado: false, evento: { id: dados.identificadorEventoExterno } };
    }
  };
  const consulta = iniciarConsultaMensagensEvolution({
    servicoWhatsapp: { async buscarMensagensRecentes() { return mensagens; } },
    repositorio,
    servicoAssistente: { async processarEntrada(entrada) { entradas.push(entrada); } },
    intervaloMs: 60_000,
    agora: () => agora
  });

  await consulta.pronto;
  await consulta.consultarAgora();
  consulta.parar();

  assert.equal(entradas.length, 1);
  assert.equal(entradas[0].telefone, '5513996873783');
  assert.equal(entradas[0].texto, 'olá');
  assert.equal(diagnosticoConsultaEvolution.consultadas, 2);
  assert.equal(diagnosticoConsultaEvolution.codigoErro, null);
});

test('ignora histórico anterior à janela inicial e mensagens de grupos', async () => {
  const agora = Date.now();
  const entradas = [];
  const consulta = iniciarConsultaMensagensEvolution({
    servicoWhatsapp: {
      async buscarMensagensRecentes() {
        return [
          { key: { id: 'antiga', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false }, message: { conversation: 'antiga' }, messageTimestamp: Math.floor((agora - 10 * 60_000) / 1000) },
          { key: { id: 'grupo', remoteJid: '120363000000000@g.us', fromMe: false }, message: { conversation: 'grupo' }, messageTimestamp: Math.floor(agora / 1000) }
        ];
      }
    },
    repositorio: { async registrarEventoWebhook() { throw new Error('não deveria registrar'); } },
    servicoAssistente: { async processarEntrada(entrada) { entradas.push(entrada); } },
    intervaloMs: 60_000,
    agora: () => agora
  });

  await consulta.pronto;
  consulta.parar();
  assert.equal(entradas.length, 0);
});
