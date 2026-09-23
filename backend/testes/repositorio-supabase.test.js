const test = require('node:test');
const assert = require('node:assert/strict');
const { RepositorioSupabase } = require('../src/repositorios/repositorio-dados');

function clienteFake(resultado = { data: [], error: null, count: 0 }) {
  const chamadas = [];
  const consulta = {
    select(...args) { chamadas.push(['select', ...args]); return this; },
    insert(dados) { chamadas.push(['insert', dados]); return this; },
    update(dados) { chamadas.push(['update', dados]); return this; },
    delete() { chamadas.push(['delete']); return this; },
    eq(...args) { chamadas.push(['eq', ...args]); return this; },
    gte(...args) { chamadas.push(['gte', ...args]); return this; },
    lt(...args) { chamadas.push(['lt', ...args]); return this; },
    lte(...args) { chamadas.push(['lte', ...args]); return this; },
    order(...args) { chamadas.push(['order', ...args]); return this; },
    limit(...args) { chamadas.push(['limit', ...args]); return this; },
    single() { chamadas.push(['single']); return Promise.resolve(resultado); },
    maybeSingle() { chamadas.push(['maybeSingle']); return Promise.resolve(resultado); },
    then(resolve, reject) { return Promise.resolve(resultado).then(resolve, reject); }
  };
  return { chamadas, from(tabela) { chamadas.push(['from', tabela]); return consulta; } };
}

test('repositório filtra tarefas pelo proprietário autenticado', async () => {
  const cliente = clienteFake({ data: [], error: null });
  const repositorio = new RepositorioSupabase(() => cliente);

  await repositorio.listarTarefas('usuario-1', { status: 'pendente' });

  assert.ok(cliente.chamadas.some((item) => item[0] === 'from' && item[1] === 'Tarefa'));
  assert.ok(cliente.chamadas.some((item) => item[0] === 'eq' && item[1] === 'usuarioId' && item[2] === 'usuario-1'));
  assert.ok(cliente.chamadas.some((item) => item[0] === 'eq' && item[1] === 'status' && item[2] === 'pendente'));
});

test('repositório restringe conclusão e remoção ao proprietário da tarefa', async () => {
  const clienteAtualizacao = clienteFake({
    data: { id: 'tarefa-1', usuarioId: 'usuario-1', status: 'concluida', dataEntrega: '2027-10-20T22:00:00.000Z' },
    error: null
  });
  const repositorioAtualizacao = new RepositorioSupabase(() => clienteAtualizacao);
  await repositorioAtualizacao.atualizarTarefa('usuario-1', 'tarefa-1', { status: 'concluida' });

  assert.ok(clienteAtualizacao.chamadas.some((item) => item[0] === 'update' && item[1].status === 'concluida'));
  assert.ok(clienteAtualizacao.chamadas.some((item) => item[0] === 'eq' && item[1] === 'id' && item[2] === 'tarefa-1'));
  assert.ok(clienteAtualizacao.chamadas.some((item) => item[0] === 'eq' && item[1] === 'usuarioId' && item[2] === 'usuario-1'));

  const clienteRemocao = clienteFake({ data: { id: 'tarefa-1' }, error: null });
  const repositorioRemocao = new RepositorioSupabase(() => clienteRemocao);
  assert.equal(await repositorioRemocao.excluirTarefa('usuario-1', 'tarefa-1'), true);
  assert.ok(clienteRemocao.chamadas.some((item) => item[0] === 'delete'));
  assert.ok(clienteRemocao.chamadas.some((item) => item[0] === 'eq' && item[1] === 'id' && item[2] === 'tarefa-1'));
  assert.ok(clienteRemocao.chamadas.some((item) => item[0] === 'eq' && item[1] === 'usuarioId' && item[2] === 'usuario-1'));
});

test('repositório traduz falha da Data API para indisponibilidade', async () => {
  const cliente = clienteFake({ data: null, error: { code: 'PGRST000', message: 'indisponível' } });
  const repositorio = new RepositorioSupabase(() => cliente);

  await assert.rejects(() => repositorio.verificarConexao(), { code: 'SUPABASE_DATA_API', statusCode: 503 });
});
