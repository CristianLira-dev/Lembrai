const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const ambiente = require('../configuracao/ambiente');
const { esquemaCadastro, validar } = require('../validadores/esquemas');
const { removerSegredos } = require('../utilitarios/seguranca');
const { ServicoEmail } = require('./servico-email');

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DURACAO_CODIGO_MS = 10 * 60 * 1000;
const MAXIMO_TENTATIVAS = 5;

function falha(mensagem, statusCode, codigo) {
  return Object.assign(new Error(mensagem), { statusCode, ...(codigo ? { code: codigo } : {}) });
}

function criarClienteAuth() {
  if (!ambiente.supabaseUrl || !ambiente.supabaseChavePublica) {
    throw falha('Não foi possível iniciar a autenticação. Tente novamente em instantes.', 503);
  }
  // Um cliente por operação: nunca compartilhe sessões entre requisições.
  return createClient(ambiente.supabaseUrl, ambiente.supabaseChavePublica, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, opcoes) => fetch(url, { ...opcoes, signal: AbortSignal.timeout(10000) }) }
  });
}

function criarClienteAuthAdmin() {
  if (!ambiente.supabaseUrl || !ambiente.supabaseChaveSecreta) {
    throw falha('Não foi possível iniciar a autenticação. Tente novamente em instantes.', 503);
  }
  // Cliente administrativo exclusivo do backend. A chave secreta nunca vai para o navegador.
  return createClient(ambiente.supabaseUrl, ambiente.supabaseChaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, opcoes) => fetch(url, { ...opcoes, signal: AbortSignal.timeout(10000) }) }
  });
}

function traduzirErro(erro) {
  const mensagens = {
    invalid_credentials: 'E-mail ou senha inválidos',
    email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
    user_already_exists: 'Não foi possível cadastrar esta conta. Tente entrar.',
    email_exists: 'Não foi possível cadastrar esta conta. Tente entrar.',
    weak_password: 'Escolha uma senha mais forte, com pelo menos 8 caracteres.',
    signup_disabled: 'O cadastro está temporariamente indisponível.',
    otp_expired: 'Código inválido ou expirado. Solicite um novo código.',
    otp_disabled: 'A confirmação por código está temporariamente indisponível.',
    over_email_send_rate_limit: 'Aguarde um pouco antes de solicitar outro código.'
  };
  if (erro.status === 429) return falha('Muitas tentativas. Aguarde um pouco e tente novamente.', 429);
  if (!erro.status || erro.status >= 500) return falha('Não foi possível conectar à autenticação. Tente novamente.', 503);
  return falha(mensagens[erro.code] || 'Não foi possível autenticar. Verifique seus dados.', 400);
}

function gerarCodigo() {
  return Array.from({ length: 5 }, () => ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)]).join('');
}

function normalizarCodigo(codigo) {
  return String(codigo || '').trim().toUpperCase();
}

function hashCodigo(desafioId, codigo) {
  const segredo = ambiente.codigoVerificacaoSegredo || ambiente.jwtSegredo;
  return crypto.createHmac('sha256', segredo).update(`${desafioId}:${normalizarCodigo(codigo)}`).digest('hex');
}

function hashesIguais(recebido, esperado) {
  const a = Buffer.from(recebido || '', 'hex');
  const b = Buffer.from(esperado || '', 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function mascararEmail(email) {
  const [usuario, dominio] = email.split('@');
  const inicio = usuario.slice(0, Math.min(2, usuario.length));
  return `${inicio}${'*'.repeat(Math.max(2, usuario.length - inicio.length))}@${dominio}`;
}

function criarServicoAutenticacao(
  repositorio,
  criarCliente = criarClienteAuth,
  criarClienteAdmin = criarClienteAuthAdmin,
  servicoEmail = new ServicoEmail()
) {
  async function verificarToken(token) {
    // getUser consulta o Auth deste projeto e valida o JWT e sua expiração.
    const { data, error } = await criarCliente().auth.getUser(token);
    if (error) {
      if (!error.status || error.status >= 500 || error.status === 429) throw traduzirErro(error);
      throw falha('Token inválido ou expirado', 401);
    }
    if (!data.user?.id || !data.user.email || !data.user.email_confirmed_at) {
      throw falha('Confirme seu e-mail antes de entrar.', 401);
    }
    return data.user;
  }

  async function obterPerfil(usuarioAuth) {
    const existente = await repositorio.buscarUsuarioPorId(usuarioAuth.id);
    if (existente) return removerSegredos(existente);
    // Metadata contém somente perfil, nunca identidade ou permissões.
    const perfil = validar(esquemaCadastro.omit({ senha: true }), {
      nome: usuarioAuth.user_metadata?.nome,
      telefone: usuarioAuth.user_metadata?.telefone,
      fusoHorario: usuarioAuth.user_metadata?.fusoHorario,
      email: usuarioAuth.email
    });
    if (await repositorio.buscarUsuarioPorEmail(perfil.email)) {
      throw falha('Este e-mail possui um cadastro anterior. Solicite a migração da conta.', 409);
    }
    if (await repositorio.buscarUsuarioPorTelefone(perfil.telefone)) {
      throw falha('WhatsApp já cadastrado. Entre em contato para revisar seu cadastro.', 409);
    }
    try {
      return removerSegredos(await repositorio.criarUsuario({
        ...perfil, id: usuarioAuth.id,
        // Campo legado obrigatório no schema. Não é senha nem hash utilizável.
        senhaCriptografada: '!supabase-auth'
      }));
    } catch (erro) {
      if (erro.code === '23505') {
        const concorrente = await repositorio.buscarUsuarioPorId(usuarioAuth.id);
        if (concorrente) return removerSegredos(concorrente);
        throw falha('E-mail ou WhatsApp já cadastrado.', 409);
      }
      throw erro;
    }
  }

  async function criarDesafio({ email, nome, finalidade, tokenHash, tipoToken, usuarioAuthId }) {
    await repositorio.invalidarCodigosVerificacao(email, finalidade);
    const id = crypto.randomUUID();
    const codigo = gerarCodigo();
    const expiraEm = new Date(Date.now() + DURACAO_CODIGO_MS);
    await repositorio.criarCodigoVerificacao({
      id, email, finalidade, codigoHash: hashCodigo(id, codigo), tokenHash,
      tipoToken, usuarioAuthId, expiraEm
    });
    try {
      await servicoEmail.enviarCodigo({ email, nome, codigo, finalidade });
    } catch (erro) {
      await repositorio.atualizarCodigoVerificacao(id, { usadoEm: new Date() });
      throw erro;
    }
    return { id, email: mascararEmail(email), finalidade, expiraEm: expiraEm.toISOString() };
  }

  async function encerrarDesafio(desafio) {
    await repositorio.atualizarCodigoVerificacao(desafio.id, { usadoEm: new Date() });
    if (desafio.finalidade === 'cadastro' && desafio.usuarioAuthId) {
      const perfil = await repositorio.buscarUsuarioPorId(desafio.usuarioAuthId);
      if (!perfil) await criarClienteAdmin().auth.admin.deleteUser(desafio.usuarioAuthId).catch(() => {});
    }
  }

  async function cadastrar(dados) {
    if (await repositorio.buscarUsuarioPorEmail(dados.email)) throw falha('E-mail já cadastrado', 409);
    if (await repositorio.buscarUsuarioPorTelefone(dados.telefone)) throw falha('WhatsApp já cadastrado', 409);
    const clienteAdmin = criarClienteAdmin();
    const anterior = await repositorio.buscarUltimoCodigoVerificacao(dados.email, 'cadastro');
    if (anterior) {
      await clienteAdmin.auth.admin.deleteUser(anterior.usuarioAuthId).catch(() => {});
      await repositorio.invalidarCodigosVerificacao(dados.email, 'cadastro');
    }

    const { data, error } = await clienteAdmin.auth.admin.generateLink({
      type: 'signup',
      email: dados.email,
      password: dados.senha,
      options: { data: { nome: dados.nome, telefone: dados.telefone, fusoHorario: dados.fusoHorario } }
    });
    if (error) throw traduzirErro(error);
    if (!data.user?.id || !data.properties?.hashed_token) {
      throw falha('Não foi possível preparar a confirmação do cadastro.', 503);
    }

    try {
      const desafio = await criarDesafio({
        email: dados.email, nome: dados.nome, finalidade: 'cadastro',
        tokenHash: data.properties.hashed_token,
        tipoToken: data.properties.verification_type,
        usuarioAuthId: data.user.id
      });
      return { desafio };
    } catch (erro) {
      await clienteAdmin.auth.admin.deleteUser(data.user.id).catch(() => {});
      throw erro;
    }
  }

  async function entrar(dados) {
    const cliente = criarCliente();
    const { data: entrada, error: erroEntrada } = await cliente.auth.signInWithPassword({
      email: dados.email, password: dados.senha
    });
    if (erroEntrada) throw traduzirErro(erroEntrada);
    if (!entrada.user?.id || !entrada.session) throw falha('Não foi possível validar sua conta.', 503);
    await cliente.auth.signOut({ scope: 'local' }).catch(() => {});

    const perfil = await repositorio.buscarUsuarioPorId(entrada.user.id);
    const { data, error } = await criarClienteAdmin().auth.admin.generateLink({
      type: 'magiclink', email: dados.email
    });
    if (error) throw traduzirErro(error);
    if (!data.properties?.hashed_token) throw falha('Não foi possível preparar a confirmação da entrada.', 503);

    return { desafio: await criarDesafio({
      email: dados.email,
      nome: perfil?.nome || entrada.user.user_metadata?.nome,
      finalidade: 'entrada',
      tokenHash: data.properties.hashed_token,
      tipoToken: data.properties.verification_type,
      usuarioAuthId: entrada.user.id
    }) };
  }

  async function confirmarCodigo({ desafioId, codigo }) {
    const desafio = await repositorio.buscarCodigoVerificacao(desafioId);
    if (!desafio || desafio.usadoEm) throw falha('Código inválido ou já utilizado.', 400);
    if (new Date(desafio.expiraEm) <= new Date()) {
      await encerrarDesafio(desafio);
      throw falha('Código expirado. Volte e solicite um novo código.', 400);
    }
    if (desafio.tentativas >= MAXIMO_TENTATIVAS) {
      await encerrarDesafio(desafio);
      throw falha('Limite de tentativas atingido. Solicite um novo código.', 429);
    }

    const valido = hashesIguais(hashCodigo(desafio.id, codigo), desafio.codigoHash);
    if (!valido) {
      const tentativas = desafio.tentativas + 1;
      await repositorio.atualizarCodigoVerificacao(desafio.id, {
        tentativas,
        ...(tentativas >= MAXIMO_TENTATIVAS ? { usadoEm: new Date() } : {})
      });
      if (tentativas >= MAXIMO_TENTATIVAS && desafio.finalidade === 'cadastro') {
        await criarClienteAdmin().auth.admin.deleteUser(desafio.usuarioAuthId).catch(() => {});
      }
      throw falha(tentativas >= MAXIMO_TENTATIVAS
        ? 'Limite de tentativas atingido. Solicite um novo código.'
        : 'Código inválido. Confira os 5 caracteres e tente novamente.', tentativas >= MAXIMO_TENTATIVAS ? 429 : 400);
    }

    const { data, error } = await criarCliente().auth.verifyOtp({
      token_hash: desafio.tokenHash,
      type: desafio.tipoToken
    });
    if (error) {
      await encerrarDesafio(desafio);
      throw traduzirErro(error);
    }
    if (!data.session || !data.user) throw falha('Não foi possível iniciar sua sessão.', 503);
    if (desafio.finalidade === 'cadastro') await obterPerfil(data.user);
    await repositorio.atualizarCodigoVerificacao(desafio.id, { usadoEm: new Date() });
    return { sessao: data.session };
  }

  return { verificarToken, obterPerfil, cadastrar, entrar, confirmarCodigo };
}

module.exports = { criarServicoAutenticacao };
