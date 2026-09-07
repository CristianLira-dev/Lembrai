process.env.USAR_BANCO_MEMORIA = 'true';
process.env.USAR_FILAS_MEMORIA = 'true';
process.env.NIVEL_LOG = 'silent';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RepositorioMemoria } = require('../src/repositorios/repositorio-dados');
const { criarControladorAutenticacao } = require('../src/controladores/autenticacao-controlador');
const { criarServicoAutenticacao } = require('../src/servicos/servico-autenticacao');
const { criarAplicacao } = require('../src/servidor');

const dados = { nome: 'Estudante', email: 'aluno@example.com', telefone: '5511999999999', senha: 'senha-segura' };
const identidade = { id: '347c0a42-26bf-4791-a181-e1b5379e1064', email: dados.email, email_confirmed_at: '2026-09-06T00:00:00Z', user_metadata: { nome: dados.nome, telefone: dados.telefone } };
function resposta() {
  return { statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(d) { this.body = d; return this; } };
}
function cenario(auth = {}) {
  const repositorio = new RepositorioMemoria();
  const chamadas = [];
  const cliente = { auth: {
    async signUp(d) { chamadas.push(d); return { data: { user: identidade, session: null }, error: null }; },
    async signInWithPassword(d) { chamadas.push(d); return { data: { session: { access_token: 'jwt-do-supabase', refresh_token: 'refresh-do-supabase' } }, error: null }; },
    async getUser(token) {
      chamadas.push(token);
      return token === 'valido' ? { data: { user: identidade }, error: null }
        : { data: { user: null }, error: { status: 401 } };
    },
    async verifyOtp(d) { chamadas.push(d); return { data: { session: { access_token: 'jwt-otp', refresh_token: 'refresh-otp' } }, error: null }; },
    async resend(d) { chamadas.push(d); return { data: {}, error: null }; },
    ...auth
  } };
  const servico = criarServicoAutenticacao(repositorio, () => cliente);
  return { repositorio, servico, controlador: criarControladorAutenticacao(servico), chamadas };
}

test('cadastro normaliza os dados e aguarda confirmação sem criar senha local', async () => {
  const c = cenario();
  const res = resposta();
  await c.controlador.cadastrar({ body: { ...dados, email: 'ALUNO@example.com', telefone: '+55 (11) 99999-9999' } }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { sessao: null, confirmarEmail: true });
  assert.equal(c.chamadas[0].email, dados.email);
  assert.equal(c.chamadas[0].options.data.telefone, dados.telefone);
  assert.equal(c.chamadas[0].options.data.senha, undefined);
  assert.equal(c.chamadas[0].options.emailRedirectTo, 'http://localhost:5173/entrar');
  assert.equal(c.repositorio.usuarios.length, 0);
});

test('valida os campos obrigatórios de cadastro antes de chamar o Auth', async () => {
  const c = cenario();
  await assert.rejects(() => c.controlador.cadastrar({ body: { ...dados, telefone: '' } }, resposta()), { statusCode: 400 });
  await assert.rejects(() => c.controlador.cadastrar({ body: { ...dados, senha: 'curta' } }, resposta()), { statusCode: 400 });
  assert.equal(c.chamadas.length, 0);
});

test('login exige apenas e-mail e senha e devolve a sessão emitida pelo Supabase', async () => {
  const c = cenario();
  const res = resposta();
  await c.controlador.entrar({ body: { email: dados.email, senha: dados.senha } }, res);
  assert.deepEqual(c.chamadas[0], { email: dados.email, password: dados.senha });
  assert.equal(res.body.sessao.access_token, 'jwt-do-supabase');
  assert.equal(res.body.token, undefined);
});

test('cadastro pode devolver sessão imediata quando o Auth não exige confirmação', async () => {
  const sessao = { access_token: 'jwt', refresh_token: 'refresh' };
  const c = cenario({ signUp: async () => ({ data: { session: sessao }, error: null }) });
  assert.deepEqual(await c.servico.cadastrar(dados), { sessao, confirmarEmail: false });
});

test('confirma cadastro com o OTP de seis dígitos e devolve a sessão', async () => {
  const c = cenario();
  const resultado = await c.servico.confirmarEmail({ email: dados.email, codigo: '123456' });
  assert.equal(resultado.sessao.access_token, 'jwt-otp');
  assert.deepEqual(c.chamadas[0], { email: dados.email, token: '123456', type: 'email' });
});

test('reenvia o código de confirmação sem criar outra conta', async () => {
  const c = cenario();
  assert.deepEqual(await c.servico.reenviarCodigo({ email: dados.email }), { enviado: true });
  assert.deepEqual(c.chamadas[0], {
    type: 'signup', email: dados.email,
    options: { emailRedirectTo: 'http://localhost:5173/cadastro' }
  });
});

test('API rejeita código de confirmação fora do formato de seis dígitos', async () => {
  const c = cenario();
  await assert.rejects(
    () => c.controlador.confirmarEmail({ body: { email: dados.email, codigo: 'A1234' } }, resposta()),
    { statusCode: 400 }
  );
  assert.equal(c.chamadas.length, 0);
});

test('traduz credenciais inválidas, e-mail não confirmado, limite e indisponibilidade', async () => {
  for (const [status, code, esperado, mensagem] of [
    [400, 'invalid_credentials', 400, /E-mail ou senha/],
    [400, 'email_not_confirmed', 400, /Confirme/],
    [429, 'over_request_rate_limit', 429, /Muitas tentativas/],
    [503, '', 503, /conectar/]
  ]) {
    const c = cenario({ signInWithPassword: async () => ({ data: {}, error: { status, code } }) });
    await assert.rejects(() => c.servico.entrar(dados), (erro) => erro.statusCode === esperado && mensagem.test(erro.message));
  }
});

test('não vincula automaticamente uma identidade nova a um cadastro anterior', async () => {
  const c = cenario();
  await c.repositorio.criarUsuario({ ...dados, id: 'id-legado' });
  await assert.rejects(() => c.servico.obterPerfil(identidade), { statusCode: 409 });
  assert.equal(c.repositorio.usuarios.length, 1);
});

test('impede cadastro com WhatsApp já utilizado', async () => {
  const c = cenario();
  await c.repositorio.criarUsuario({ ...dados, email: 'outro@example.com' });
  await assert.rejects(() => c.servico.cadastrar(dados), { statusCode: 409 });
  assert.equal(c.chamadas.length, 0);
});

test('perfil usa exclusivamente a identidade validada e não aceita permissões de metadata', async () => {
  const c = cenario();
  const perfil = await c.servico.obterPerfil({ ...identidade, user_metadata: { ...identidade.user_metadata, id: 'vitima', role: 'admin', email: 'vitima@example.com' } });
  assert.equal(perfil.id, identidade.id);
  assert.equal(perfil.email, identidade.email);
  assert.equal(perfil.role, undefined);
  assert.equal(perfil.senhaCriptografada, undefined);
  assert.equal(c.repositorio.usuarios[0].senhaCriptografada, '!supabase-auth');
  assert.deepEqual(await c.servico.obterPerfil(identidade), perfil);
});

test('não confunde falha do provedor com JWT inválido', async () => {
  const c = cenario({ getUser: async () => ({ data: {}, error: { status: 503 } }) });
  await assert.rejects(() => c.servico.verificarToken('qualquer'), { statusCode: 503 });
  const naoConfirmado = cenario({ getUser: async () => ({ data: { user: { ...identidade, email_confirmed_at: null } }, error: null }) });
  await assert.rejects(() => naoConfirmado.servico.verificarToken('qualquer'), { statusCode: 401 });
});

test('API protege rotas, rejeita JWT local e restringe tarefas ao usuário validado', async (t) => {
  const c = cenario();
  const { app } = criarAplicacao({ servicos: { repositorio: c.repositorio, servicoAutenticacao: c.servico } });
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => servidor.once('listening', resolve));
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const base = 'http://127.0.0.1:' + servidor.address().port + '/api';
  const jwt = require('jsonwebtoken');
  const antigo = jwt.sign({ sub: identidade.id }, 'desenvolvimento-troque-este-segredo');
  for (const token of [null, 'adulterado', antigo]) {
    const res = await fetch(base + '/tarefas', { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    assert.equal(res.status, 401);
  }
  assert.equal(c.repositorio.usuarios.length, 0);
  const headers = { Authorization: 'Bearer valido' };
  const eu = await fetch(base + '/autenticacao/eu', { headers });
  assert.equal(eu.status, 200);
  assert.equal(eu.headers.get('cache-control'), 'no-store');
  assert.equal((await eu.json()).usuario.id, identidade.id);
  const propria = await c.repositorio.criarTarefa({ usuarioId: identidade.id, titulo: 'Minha tarefa', dataEntrega: '2027-01-01' });
  const outra = await c.repositorio.criarTarefa({ usuarioId: 'outra-conta', titulo: 'Privada', dataEntrega: '2027-01-01' });
  const tarefas = await fetch(base + '/tarefas', { headers });
  const corpo = await tarefas.json();
  assert.ok(JSON.stringify(corpo).includes(propria.id));
  assert.ok(!JSON.stringify(corpo).includes(outra.id));
  assert.equal((await fetch(base + '/tarefas/' + outra.id, { headers })).status, 404);
});

test('API diferencia indisponibilidade do PostgreSQL de um erro interno genérico', async (t) => {
  const c = cenario();
  c.repositorio.verificarConexao = async () => {
    throw Object.assign(new Error('connection refused'), { name: 'PrismaClientInitializationError', code: 'P1001' });
  };
  const { app } = criarAplicacao({ servicos: { repositorio: c.repositorio, servicoAutenticacao: c.servico } });
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => servidor.once('listening', resolve));
  t.after(() => new Promise((resolve) => servidor.close(resolve)));

  const res = await fetch('http://127.0.0.1:' + servidor.address().port + '/api/saude/banco');
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { erro: 'Banco de dados temporariamente indisponível' });
});
