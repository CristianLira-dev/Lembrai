import test from 'node:test';
import assert from 'node:assert/strict';
import { criarClienteApi } from '../src/servicos/cliente-api.js';

function cenario(status, extras = {}) {
  const chamadas = [];
  let renovacoes = 0;
  let invalidacoes = 0;
  const requisitar = criarClienteApi({
    urlBase: 'https://api.example.com/api',
    obterToken: async () => 'antigo',
    renovarToken: async () => { renovacoes++; return 'novo'; },
    invalidarSessao: async () => { invalidacoes++; },
    executarFetch: async (url, opcoes) => {
      chamadas.push({ url, ...opcoes });
      return new Response(JSON.stringify({ erro: 'Falha da API' }), { status: status.shift(), headers: { 'Content-Type': 'application/json' } });
    },
    ...extras
  });
  return { requisitar, chamadas, renovacoes: () => renovacoes, invalidacoes: () => invalidacoes };
}

test('envia Bearer e renova uma vez ao receber 401', async () => {
  const c = cenario([401, 200]);
  await c.requisitar('/tarefas', { params: { status: 'pendente', vazio: '' } });
  assert.equal(c.chamadas[0].headers.Authorization, 'Bearer antigo');
  assert.equal(c.chamadas[1].headers.Authorization, 'Bearer novo');
  assert.equal(c.renovacoes(), 1);
  assert.equal(c.invalidacoes(), 0);
  assert.equal(c.chamadas[0].url, 'https://api.example.com/api/tarefas?status=pendente');
});

test('encerra a sessão quando o token renovado também é rejeitado', async () => {
  const c = cenario([401, 401]);
  await assert.rejects(() => c.requisitar('/tarefas'), { status: 401 });
  assert.equal(c.chamadas.length, 2);
  assert.equal(c.invalidacoes(), 1);
});

test('login inválido não envia token de outra conta nem encerra sua sessão', async () => {
  const c = cenario([401]);
  await assert.rejects(() => c.requisitar('/autenticacao/entrar', { metodo: 'POST', dados: { email: 'teste@example.com' }, publico: true }), { status: 401 });
  assert.equal(c.chamadas[0].headers.Authorization, undefined);
  assert.equal(c.renovacoes(), 0);
  assert.equal(c.invalidacoes(), 0);
});

test('falha de rede ou indisponibilidade da API preserva a sessão', async () => {
  const c = cenario([503]);
  await assert.rejects(() => c.requisitar('/tarefas'), { status: 503 });
  assert.equal(c.invalidacoes(), 0);
  const rede = cenario([], { executarFetch: async () => { throw new TypeError('network'); } });
  await assert.rejects(() => rede.requisitar('/tarefas'), /conectar ao servidor/);
  assert.equal(rede.invalidacoes(), 0);
});

test('carregamento do perfil usa token explícito sem chamar o SDK no evento de Auth', async () => {
  const c = cenario([200], { obterToken: async () => { throw new Error('Não chamar getSession dentro do evento'); } });
  await c.requisitar('/autenticacao/eu', { token: 'explicito' });
  assert.equal(c.chamadas[0].headers.Authorization, 'Bearer explicito');
  assert.equal(c.renovacoes(), 0);
});
