process.env.USAR_BANCO_MEMORIA = 'true';
process.env.USAR_FILAS_MEMORIA = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RepositorioMemoria } = require('../src/repositorios/repositorio-dados');
const { ServicoCalendarios } = require('../src/servicos/servico-calendarios');
const { ServicoTarefas, calcularAgendamento } = require('../src/servicos/servico-tarefas');
const { ServicoLembretes } = require('../src/servicos/servico-lembretes');
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
  return { repositorio, calendarios, tarefas, assistente, mensagens, whatsapp, chatbot };
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

test('envia um resumo detalhado a cada dois dias para cada usuário com pendências', async () => {
  const cenario = criarCenario();
  const usuario = await criarUsuario(cenario);
  await cenario.repositorio.criarTarefa({
    usuarioId: usuario.id, titulo: 'Trabalho de Redes', materia: 'Sistemas Operacionais',
    dataEntrega: new Date('2027-10-20T22:00:00.000Z')
  });
  await cenario.repositorio.criarTarefa({
    usuarioId: usuario.id, titulo: 'Prova de Banco de Dados', materia: 'Banco de Dados',
    dataEntrega: new Date('2027-10-22T17:00:00.000Z')
  });
  const lembretes = new ServicoLembretes({ repositorio: cenario.repositorio, servicoWhatsapp: cenario.whatsapp });
  const agora = new Date('2027-10-18T13:00:00.000Z');
  await cenario.repositorio.atualizarUsuario(usuario.id, { proximoResumoPendenciasEm: new Date('2027-10-18T12:59:00.000Z') });

  const primeiro = await lembretes.processarResumosPendentes(agora);
  assert.deepEqual(primeiro, { agendados: 0, enviados: 1, falhos: 0 });
  assert.match(cenario.mensagens[0].texto, /Trabalho de Redes/);
  assert.match(cenario.mensagens[0].texto, /Prova de Banco de Dados/);
  assert.match(cenario.mensagens[0].texto, /20\/10\/2027/);
  assert.match(cenario.mensagens[0].texto, /22\/10\/2027/);

  const antesDeDoisDias = await lembretes.processarResumosPendentes(new Date('2027-10-20T10:26:00.000Z'));
  assert.equal(antesDeDoisDias.enviados, 0);
  const segundo = await lembretes.processarResumosPendentes(new Date('2027-10-20T10:27:00.000Z'));
  assert.equal(segundo.enviados, 1);
  assert.equal(cenario.mensagens.length, 2);
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
  assert.equal((await cenario.repositorio.listarLembretes(usuario.id)).length, 0);
  assert.ok((await cenario.repositorio.buscarUsuarioPorId(usuario.id)).proximoResumoPendenciasEm);

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
  assert.equal((await cenario.repositorio.buscarUsuarioPorId(usuario.id)).proximoResumoPendenciasEm, null);
});

test('fallback local reconhece pedido para marcar atividade como concluída', async () => {
  const cenario = criarCenario();
  cenario.chatbot.processar = async () => { throw new Error('chatbot indisponível'); };
  const usuario = await criarUsuario(cenario);
  const criada = await cenario.tarefas.criar(usuario.id, atividade.task, { sincronizarCalendario: false });

  const proposta = await cenario.assistente.processarEntrada({
    telefone: usuario.telefone, texto: 'marque o trabalho de redes como concluído', identificadorExterno: 'fc-1'
  });
  assert.match(proposta.resposta, /Vou concluir:.*Trabalho de Redes.*Confirma/);
  assert.equal((await cenario.tarefas.obter(usuario.id, criada.tarefa.id)).status, 'pendente');

  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'pode concluir', identificadorExterno: 'fc-2' });
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

test('fallback local reconhece edição de data', async () => {
  const cenario = criarCenario();
  cenario.chatbot.processar = async () => { throw new Error('chatbot indisponível'); };
  const usuario = await criarUsuario(cenario);
  const criada = await cenario.tarefas.criar(usuario.id, atividade.task, { sincronizarCalendario: false });

  const proposta = await cenario.assistente.processarEntrada({
    telefone: usuario.telefone, texto: 'mude o trabalho de redes para 22/10/2027', identificadorExterno: 'fe-1'
  });
  assert.match(proposta.resposta, /Vou alterar.*Trabalho de Redes.*22\/10\/2027.*Confirma/);
  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'pode alterar', identificadorExterno: 'fe-2' });
  assert.equal(new Date((await cenario.tarefas.obter(usuario.id, criada.tarefa.id)).dataEntrega).toISOString().slice(0, 10), '2027-10-22');
});

test('fallback local coleta o campo que será editado em duas mensagens', async () => {
  const cenario = criarCenario();
  cenario.chatbot.processar = async () => { throw new Error('chatbot indisponível'); };
  const usuario = await criarUsuario(cenario);
  const criada = await cenario.tarefas.criar(usuario.id, atividade.task, { sincronizarCalendario: false });

  const escolha = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'editar trabalho de redes', identificadorExterno: 'fec-1' });
  assert.match(escolha.resposta, /O que você quer mudar/);
  const mudanca = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'matéria para Banco de Dados', identificadorExterno: 'fec-2' });
  assert.match(mudanca.resposta, /Vou alterar.*Banco De Dados.*Confirma/);
  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'sim', identificadorExterno: 'fec-3' });
  assert.equal((await cenario.tarefas.obter(usuario.id, criada.tarefa.id)).materia, 'Banco De Dados');
});

test('remoção exige confirmação e exclui somente a atividade escolhida', async () => {
  const cenario = criarCenario();
  cenario.chatbot.processar = async () => { throw new Error('chatbot indisponível'); };
  const usuario = await criarUsuario(cenario);
  const criada = await cenario.tarefas.criar(usuario.id, atividade.task, { sincronizarCalendario: false });

  const proposta = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'remova o trabalho de redes', identificadorExterno: 'd-1' });
  assert.match(proposta.resposta, /Vou remover:.*Trabalho de Redes.*exclui.*Confirma/);
  assert.ok(await cenario.repositorio.buscarTarefa(usuario.id, criada.tarefa.id));

  const confirmacao = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'pode remover', identificadorExterno: 'd-2' });
  assert.match(confirmacao.resposta, /atividade removida/);
  assert.equal(await cenario.repositorio.buscarTarefa(usuario.id, criada.tarefa.id), null);
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

test('saudações recebem apresentação sem consultar o classificador', async () => {
  const cenario = criarCenario([{ intent: 'unknown', confidence: 0.99 }]);
  const usuario = await criarUsuario(cenario);
  for (const [indice, texto] of ['ola', 'Olá!', 'oi, tudo bem?', 'bom dia', 'Boa noite, Lembraí', 'e aí?'].entries()) {
    const resultado = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto, identificadorExterno: `saudacao-${indice}` });
    assert.match(resultado.resposta, /Sou a Lembraí.*atividades e prazos/);
    assert.match(resultado.resposta, /cadastrar.*editar.*concluir.*remover atividades.*mostrar pendências.*ajustar lembretes/);
  }
  assert.equal(cenario.chatbot.chamadas, 0);
});

test('saudação não apaga ação pendente e pedido com saudação continua sendo interpretado', async () => {
  const cenario = criarCenario([atividade]);
  const usuario = await criarUsuario(cenario);
  const pedido = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'Olá, registrar trabalho de Redes', identificadorExterno: 'pedido-com-ola' });
  assert.match(pedido.resposta, /Vou registrar:.*Confirma/);
  const saudacao = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'oi', identificadorExterno: 'oi-pendente' });
  assert.match(saudacao.resposta, /Sou a Lembraí/);
  assert.equal(cenario.chatbot.chamadas, 1);
  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'sim', identificadorExterno: 'confirma-depois-oi' });
  assert.equal((await cenario.tarefas.listar(usuario.id)).length, 1);
});

test('mesma mensagem externa não é processada duas vezes', async () => {
  const cenario = criarCenario([atividade]);
  const usuario = await criarUsuario(cenario);
  await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'trabalho', identificadorExterno: 'duplicada' });
  const segundo = await cenario.assistente.processarEntrada({ telefone: usuario.telefone, texto: 'trabalho', identificadorExterno: 'duplicada' });
  assert.equal(segundo.duplicado, true);
  assert.equal(cenario.chatbot.chamadas, 1);
});

test('fallback local registra atividade no usuário identificado pelo telefone', async () => {
  const cenario = criarCenario([]);
  cenario.chatbot.processar = async () => { throw new Error('chatbot indisponível'); };
  const usuarioCorreto = await criarUsuario(cenario, '5511999999999');
  const outroUsuario = await cenario.repositorio.criarUsuario({
    id: 'auth-user-2', nome: 'Outro', email: 'outro@example.com',
    senhaCriptografada: 'supabase-auth', telefone: '5511888888888'
  });

  const proposta = await cenario.assistente.processarEntrada({
    telefone: usuarioCorreto.telefone,
    texto: 'trabalho de Banco de Dados dia 25/09/2027 às 19h',
    identificadorExterno: 'fallback-1',
    recebidoEm: new Date('2026-09-21T15:00:00Z')
  });
  assert.match(proposta.resposta, /Vou registrar:.*Banco De Dados.*25\/09\/2027.*19:00.*Confirma/);
  assert.equal((await cenario.tarefas.listar(usuarioCorreto.id)).length, 0);

  await cenario.assistente.processarEntrada({
    telefone: usuarioCorreto.telefone,
    texto: 'sim',
    identificadorExterno: 'fallback-2',
    recebidoEm: new Date('2026-09-21T15:01:00Z')
  });

  const tarefasCorretas = await cenario.tarefas.listar(usuarioCorreto.id);
  assert.equal(tarefasCorretas.length, 1);
  assert.equal(tarefasCorretas[0].usuarioId, usuarioCorreto.id);
  assert.equal(tarefasCorretas[0].materia, 'Banco De Dados');
  assert.equal((await cenario.tarefas.listar(outroUsuario.id)).length, 0);
});

test('fallback local coleta apenas o dado ausente antes de confirmar', async () => {
  const cenario = criarCenario([]);
  cenario.chatbot.processar = async () => { throw new Error('chatbot indisponível'); };
  const usuario = await criarUsuario(cenario);

  const primeira = await cenario.assistente.processarEntrada({
    telefone: usuario.telefone, texto: 'atividade dia 28/09/2027', identificadorExterno: 'coleta-1'
  });
  assert.equal(primeira.resposta, 'Qual é a matéria?');

  const segunda = await cenario.assistente.processarEntrada({
    telefone: usuario.telefone, texto: 'Engenharia de Software', identificadorExterno: 'coleta-2'
  });
  assert.match(segunda.resposta, /Vou registrar:.*Engenharia De Software.*Confirma/);
});
