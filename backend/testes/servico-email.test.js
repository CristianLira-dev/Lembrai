const test = require('node:test');
const assert = require('node:assert/strict');
const { ServicoEmail } = require('../src/servicos/servico-email');

const smtp = {
  host: 'smtp.example.com',
  porta: 587,
  seguro: false,
  usuario: 'smtp-user',
  senha: 'smtp-password',
  remetente: 'nao-responda@example.com',
  nomeRemetente: 'Lembraí'
};

test('Nodemailer recebe configuração SMTP e envia o código em texto e HTML', async () => {
  const transportes = [];
  const mensagens = [];
  const servico = new ServicoEmail(smtp, (configuracao) => {
    transportes.push(configuracao);
    return { sendMail: async (mensagem) => { mensagens.push(mensagem); return { messageId: 'email-1' }; } };
  });
  await servico.enviarCodigo({
    email: 'aluno@example.com', nome: '<Aluno>', codigo: 'A7K2P', finalidade: 'cadastro'
  });
  assert.equal(transportes[0].host, smtp.host);
  assert.deepEqual(transportes[0].auth, { user: smtp.usuario, pass: smtp.senha });
  assert.equal(mensagens[0].to, 'aluno@example.com');
  assert.match(mensagens[0].text, /A7K2P/);
  assert.match(mensagens[0].html, /&lt;Aluno&gt;/);
  assert.doesNotMatch(mensagens[0].html, /smtp-password/);
});

test('falha com resposta segura quando SMTP não está configurado', async () => {
  const servico = new ServicoEmail({}, () => { throw new Error('não deveria criar transporte'); });
  await assert.rejects(
    () => servico.enviarCodigo({ email: 'aluno@example.com', codigo: 'A7K2P', finalidade: 'entrada' }),
    (erro) => erro.statusCode === 503 && erro.code === 'SMTP_NAO_CONFIGURADO'
  );
});

test('falha quando o servidor SMTP rejeita todos os destinatários', async () => {
  const servico = new ServicoEmail(smtp, () => ({
    sendMail: async () => ({ accepted: [], rejected: ['aluno@example.com'] })
  }));
  await assert.rejects(
    () => servico.enviarCodigo({ email: 'aluno@example.com', codigo: 'A7K2P', finalidade: 'recuperacao' }),
    (erro) => erro.statusCode === 503 && erro.code === 'SMTP_ENVIO_FALHOU'
  );
});
