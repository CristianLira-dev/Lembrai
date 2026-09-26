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
const sessao = { access_token: 'jwt-do-supabase', refresh_token: 'refresh-do-supabase' };
function resposta() {
  return { statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(d) { this.body = d; return this; } };
}
function cenario(auth = {}, admin = {}) {
  const repositorio = new RepositorioMemoria();
  const chamadas = [];
  const chamadasAdmin = [];
  const emails = [];
  let usuarioAdmin = { ...identidade, email_confirmed_at: null };
  const cliente = { auth: {
    async signInWithPassword(d) { chamadas.push(d); return { data: { user: identidade, session: sessao }, error: null }; },
    async signOut() { return { error: null }; },
    async verifyOtp(d) { chamadas.push({ verificarOtp: d }); return { data: { user: identidade, session: sessao }, error: null }; },
    async getUser(token) {
      chamadas.push(token);
      return token === 'valido' ? { data: { user: identidade }, error: null }
        : { data: { user: null }, error: { status: 401 } };
    },
    ...auth
  } };
  const clienteAdmin = { auth: { admin: {
    async createUser(d) { chamadasAdmin.push({ operacao: 'criar', dados: d }); return { data: { user: usuarioAdmin }, error: null }; },
    async deleteUser(id) { chamadasAdmin.push({ operacao: 'excluir', id }); return { data: {}, error: null }; },
    async getUserById(id) { chamadasAdmin.push({ operacao: 'buscar', id }); return { data: { user: usuarioAdmin }, error: null }; },
    async updateUserById(id, d) {
      chamadasAdmin.push({ operacao: 'atualizar', id, dados: d });
      usuarioAdmin = { ...usuarioAdmin, ...(d.email_confirm ? { email_confirmed_at: new Date().toISOString() } : {}) };
      return { data: { user: usuarioAdmin }, error: null };
    },
    async generateLink(d) {
      chamadasAdmin.push({ operacao: 'gerarLink', dados: d });
      return { data: { properties: { hashed_token: 'hash-link', verification_type: 'magiclink' } }, error: null };
    },
    ...admin
  } } };
  const servicoEmail = { async enviarCodigo(d) { emails.push(d); } };
  const servico = criarServicoAutenticacao(repositorio, () => cliente, () => clienteAdmin, servicoEmail);
  return { repositorio, servico, controlador: criarControladorAutenticacao(servico), chamadas, chamadasAdmin, emails };
}

test('cadastro envia código alfanumérico e só confirma e cria perfil após validá-lo', async () => {
  const c = cenario();
  const res = resposta();
  await c.controlador.cadastrar({ body: { ...dados, email: 'ALUNO@example.com', telefone: '+55 (11) 99999-9999' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.desafio.finalidade, 'cadastro');
  assert.match(c.emails[0].codigo, /^[A-Z0-9]{5}$/);
  assert.deepEqual(c.chamadasAdmin[0], {
    operacao: 'criar',
    dados: {
      email: dados.email,
      password: dados.senha,
      email_confirm: false,
      user_metadata: { nome: dados.nome, telefone: dados.telefone, fusoHorario: 'America/Sao_Paulo' }
    }
  });
  assert.equal(c.repositorio.usuarios.length, 0);
  assert.notEqual(c.repositorio.codigosVerificacao[0].codigoHash, c.emails[0].codigo);
  const confirmado = await c.servico.confirmarCodigo({ desafioId: res.body.desafio.id, codigo: c.emails[0].codigo.toLowerCase() });
  assert.deepEqual(confirmado, { sessao });
  assert.equal(c.repositorio.usuarios[0].id, identidade.id);
  assert.ok(c.repositorio.codigosVerificacao[0].usadoEm);
  assert.ok(c.chamadasAdmin.some((item) => item.operacao === 'atualizar' && item.dados.email_confirm));
  await assert.rejects(
    () => c.servico.confirmarCodigo({ desafioId: res.body.desafio.id, codigo: c.emails[0].codigo }),
    /já utilizado/
  );
});

test('valida os campos obrigatórios de cadastro antes de chamar o Auth', async () => {
  const c = cenario();
  await assert.rejects(() => c.controlador.cadastrar({ body: { ...dados, telefone: '' } }, resposta()), { statusCode: 400 });
  await assert.rejects(() => c.controlador.cadastrar({ body: { ...dados, senha: 'curta' } }, resposta()), { statusCode: 400 });
  assert.equal(c.chamadas.length, 0);
  assert.equal(c.chamadasAdmin.length, 0);
});

test('login valida a senha e exige o segundo código antes de devolver a sessão', async () => {
  const c = cenario();
  const res = resposta();
  await c.controlador.entrar({ body: { email: dados.email, senha: dados.senha } }, res);
  assert.deepEqual(c.chamadas[0], { email: dados.email, password: dados.senha });
  assert.equal(res.body.desafio.finalidade, 'entrada');
  assert.equal(res.body.sessao, undefined);
  const confirmado = await c.servico.confirmarCodigo({ desafioId: res.body.desafio.id, codigo: c.emails[0].codigo });
  assert.equal(confirmado.sessao.access_token, 'jwt-do-supabase');
});

test('remove a conta criada se o envio do código de cadastro falhar', async () => {
  const c = cenario();
  c.servico = criarServicoAutenticacao(c.repositorio, () => ({}), () => ({ auth: { admin: {
    createUser: async () => ({ data: { user: identidade }, error: null }),
    deleteUser: async (id) => { c.chamadasAdmin.push({ operacao: 'excluir', id }); }
  } } }), { enviarCodigo: async () => { throw Object.assign(new Error('smtp'), { statusCode: 503 }); } });
  await assert.rejects(() => c.servico.cadastrar(dados), { statusCode: 503 });
  assert.ok(c.chamadasAdmin.some((item) => item.operacao === 'excluir' && item.id === identidade.id));
});

test('recuperação valida o código antes de alterar a senha', async () => {
  const c = cenario();
  await c.repositorio.criarUsuario({ ...dados, id: identidade.id });
  const { desafio } = await c.servico.solicitarRecuperacao({ email: dados.email });
  await assert.rejects(() => c.servico.redefinirSenha({ desafioId: desafio.id, codigo: 'AAAAA', novaSenha: 'senha-nova-segura' }), /Código inválido/);
  const respostaRecuperacao = await c.servico.redefinirSenha({
    desafioId: desafio.id, codigo: c.emails[0].codigo, novaSenha: 'senha-nova-segura'
  });
  assert.match(respostaRecuperacao.mensagem, /Senha alterada/);
  assert.ok(c.chamadasAdmin.some((item) => item.operacao === 'atualizar' && item.dados.password === 'senha-nova-segura'));
});

test('reenvia a confirmação somente para cadastro ainda pendente', async () => {
  const c = cenario();
  await c.servico.cadastrar(dados);
  const { desafio } = await c.servico.reenviarConfirmacao({ email: dados.email });
  assert.equal(desafio.finalidade, 'cadastro');
  assert.equal(c.emails.length, 2);
  assert.ok(c.repositorio.codigosVerificacao[0].usadoEm);
});

test('bloqueia o desafio depois de cinco códigos incorretos', async () => {
  const c = cenario();
  const { desafio } = await c.servico.entrar(dados);
  for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
    await assert.rejects(
      () => c.servico.confirmarCodigo({ desafioId: desafio.id, codigo: 'AAAAA' }),
      tentativa === 5 ? /Limite de tentativas/ : /Código inválido/
    );
  }
  assert.equal(c.repositorio.codigosVerificacao[0].tentativas, 5);
  assert.ok(c.repositorio.codigosVerificacao[0].usadoEm);
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
  assert.equal(c.chamadasAdmin.length, 0);
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

test('API diferencia indisponibilidade da Data API de um erro interno genérico', async (t) => {
  const c = cenario();
  c.repositorio.verificarConexao = async () => {
    throw Object.assign(new Error('fetch failed'), { code: 'SUPABASE_DATA_API', statusCode: 503 });
  };
  const { app } = criarAplicacao({ servicos: { repositorio: c.repositorio, servicoAutenticacao: c.servico } });
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => servidor.once('listening', resolve));
  t.after(() => new Promise((resolve) => servidor.close(resolve)));

  const res = await fetch('http://127.0.0.1:' + servidor.address().port + '/api/saude/banco');
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { erro: 'Banco de dados temporariamente indisponível' });
});
