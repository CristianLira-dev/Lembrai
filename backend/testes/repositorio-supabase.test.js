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

test('repositório traduz falha da Data API para indisponibilidade', async () => {
  const cliente = clienteFake({ data: null, error: { code: 'PGRST000', message: 'indisponível' } });
  const repositorio = new RepositorioSupabase(() => cliente);

  await assert.rejects(() => repositorio.verificarConexao(), { code: 'SUPABASE_DATA_API', statusCode: 503 });
});
