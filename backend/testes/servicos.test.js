process.env.USAR_BANCO_MEMORIA = 'true';
process.env.USAR_FILAS_MEMORIA = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RepositorioMemoria } = require('../src/repositorios/repositorio-dados');
const { ServicoCalendarios } = require('../src/servicos/servico-calendarios');
const { ServicoTarefas, calcularAgendamento } = require('../src/servicos/servico-tarefas');
const { ServicoAssistente, SEM_CONTA, FORA_ESCOPO } = require('../src/servicos/servico-assistente');
const { normalizarTelefone } = require('../src/utilitarios/telefone');

function criarCenario(respostas = []) {
  const repositorio = new RepositorioMemoria();
  const calendarios = new ServicoCalendarios(repositorio);
  const tarefas = new ServicoTarefas(repositorio, calendarios);
  const mensagens = [];
  const whatsapp = { async enviarResposta(telefone, texto) { mensagens.push({ telefone, texto }); } };
  let indice = 0;
  const chatbot = { chamadas: 0, async processar() { this.chamadas += 1; return respostas[Math.min(indice++, respostas.length - 1)]; } };
  const assistente = new ServicoAssistente({ repositorio, servicoTarefas: tarefas, servicoWhatsapp: whatsapp, servicoChatbot: chatbot });
  return { repositorio, calendarios, tarefas, assistente, mensagens, chatbot };
}

async function criarUsuario(cenario, telefone = '5511999999999') {
  return cenario.repositorio.criarUsuario({ id: 'auth-user-1', nome: 'Cristian', email: 'cristian@example.com', senhaCriptografada: 'supabase-auth', telefone });
}

const atividade = {
  intent: 'create_task', confidence: 0.96, task: {
    title: 'Trabalho de Redes', subject: 'Sistemas Operacionais', type: 'assignment',
    dueDate: '2027-10-20', dueTime: '19:00'
  }
};

test('calcula lembrete um dia antes', () => {
  const agendamento = calcularAgendamento('2027-08-28T22:00:00.000Z', { amount: 1, unit: 'day' });
  assert.equal(agendamento.toISOString(), '2027-08-27T22:00:00.000Z');
});

test('normaliza cadastro brasileiro para o formato entregue pela Evolution', () => {
  assert.equal(normalizarTelefone('(11) 99999-9999'), '5511999999999');
  assert.equal(normalizarTelefone('5511999999999@s.whatsapp.net'), '5511999999999');
});

test('número sem conta recebe cadastro e não cria perfil provisório', async () => {
  const cenario = criarCenario([atividade]);
  const resultado = await cenario.assistente.processarEntrada({ telefone: '5511888888888', texto: 'trabalho de redes dia 20/10' });
  assert.equal(resultado.resposta, SEM_CONTA);
  assert.equal(await cenario.repositorio.buscarUsuarioPorTelefone('5511888888888'), null);
  assert.equal(cenario.chatbot.chamadas, 0);
});

test('criação exige confirmação, agenda lembrete e pergunta o horário uma vez', async () => {
  const cenario = criarCenario([atividade]);
  const usuario = await criarUsuario(cenario);

  const proposta = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'trabalho de redes dia 20/10', identificadorExterno: 'm-1' });
  assert.match(proposta.resposta, /Vou registrar:.*Confirma/);
  assert.equal((await cenario.tarefas.listar(usuario.id)).length, 0);

  const confirmacao = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'sim', identificadorExterno: 'm-2' });
  const criadas = await cenario.tarefas.listar(usuario.id);
  assert.equal(criadas.length, 1);
  assert.equal(criadas[0].materia, 'Sistemas Operacionais');
  assert.match(confirmacao.resposta, /Os lembretes chegam às 07:27/);
  assert.equal((await cenario.repositorio.listarLembretes(usuario.id)).length, 1);

  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'não', identificadorExterno: 'm-3' });
  assert.match(cenario.mensagens.at(-1).texto, /mantive o horário/);
});

test('conclusão só é executada depois de confirmação explícita', async () => {
  const respostaConclusao = { intent: 'complete_task', confidence: 0.96, reference: 'Trabalho de Redes' };
  const cenario = criarCenario([respostaConclusao]);
  const usuario = await criarUsuario(cenario);
  const criada = await cenario.tarefas.criar(usuario.id, atividade.task, { sincronizarCalendario: false });

  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'terminei o trabalho de redes', identificadorExterno: 'c-1' });
  assert.equal((await cenario.tarefas.obter(usuario.id, criada.tarefa.id)).status, 'pendente');
  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'confirmo', identificadorExterno: 'c-2' });
  assert.equal((await cenario.tarefas.obter(usuario.id, criada.tarefa.id)).status, 'concluida');
});

test('edição altera a atividade somente depois da confirmação', async () => {
  const propostaEdicao = { intent: 'edit_task', confidence: 0.97, reference: 'Trabalho de Redes', task: { dueDate: '2027-10-22' } };
  const cenario = criarCenario([propostaEdicao]);
  const usuario = await criarUsuario(cenario);
  const criada = await cenario.tarefas.criar(usuario.id, atividade.task, { sincronizarCalendario: false });

  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'muda o trabalho de redes para 22/10', identificadorExterno: 'e-1' });
  assert.equal(new Date((await cenario.tarefas.obter(usuario.id, criada.tarefa.id)).dataEntrega).toISOString().slice(0, 10), '2027-10-20');
  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'pode alterar', identificadorExterno: 'e-2' });
  assert.equal(new Date((await cenario.tarefas.obter(usuario.id, criada.tarefa.id)).dataEntrega).toISOString().slice(0, 10), '2027-10-22');
});

test('alteração do horário padrão exige confirmação', async () => {
  const cenario = criarCenario([{ intent: 'set_reminder_time', confidence: 0.99, reminderTime: '08:30' }]);
  const usuario = await criarUsuario(cenario);
  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'muda meus lembretes para 8:30', identificadorExterno: 'h-1' });
  assert.equal((await cenario.repositorio.buscarUsuarioPorId(usuario.id)).horarioLembretes, '07:27');
  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'sim', identificadorExterno: 'h-2' });
  assert.equal((await cenario.repositorio.buscarUsuarioPorId(usuario.id)).horarioLembretes, '08:30');
});

test('assunto fora do escopo recebe apenas a resposta definida', async () => {
  const cenario = criarCenario([{ intent: 'unknown', confidence: 0.99 }]);
  const usuario = await criarUsuario(cenario);
  const resultado = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'me explica normalização', identificadorExterno: 'x-1' });
  assert.equal(resultado.resposta, FORA_ESCOPO);
});

test('mesma mensagem externa não é processada duas vezes', async () => {
  const cenario = criarCenario([atividade]);
  const usuario = await criarUsuario(cenario);
  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'trabalho', identificadorExterno: 'duplicada' });
  const segundo = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'trabalho', identificadorExterno: 'duplicada' });
  assert.equal(segundo.duplicado, true);
  assert.equal(cenario.chatbot.chamadas, 1);
});
