const { createClient } = require('@supabase/supabase-js');
const ambiente = require('../configuracao/ambiente');
const { esquemaCadastro, validar } = require('../validadores/esquemas');
const { removerSegredos } = require('../utilitarios/seguranca');

function falha(mensagem, statusCode) {
  return Object.assign(new Error(mensagem), { statusCode });
}

function criarClienteAuth() {
  if (!ambiente.supabaseUrl || !ambiente.supabaseChavePublica) {
    throw falha('Autenticação indisponível. Configure o Supabase no servidor.', 503);
  }
  // Um cliente por operação: nunca compartilhe sessões entre requisições.
  return createClient(ambiente.supabaseUrl, ambiente.supabaseChavePublica, {
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

function criarServicoAutenticacao(repositorio, criarCliente = criarClienteAuth) {
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
        // Campo legado obrigatório no Prisma. Não é senha nem hash utilizável.
        senhaCriptografada: '!supabase-auth'
      }));
    } catch (erro) {
      if (erro.code === 'P2002') {
        const concorrente = await repositorio.buscarUsuarioPorId(usuarioAuth.id);
        if (concorrente) return removerSegredos(concorrente);
        throw falha('E-mail ou WhatsApp já cadastrado.', 409);
      }
      throw erro;
    }
  }

  return {
    verificarToken, obterPerfil,
    async cadastrar(dados) {
      if (await repositorio.buscarUsuarioPorEmail(dados.email)) throw falha('E-mail já cadastrado', 409);
      if (await repositorio.buscarUsuarioPorTelefone(dados.telefone)) throw falha('WhatsApp já cadastrado', 409);
      const { data, error } = await criarCliente().auth.signUp({
        email: dados.email, password: dados.senha,
        options: {
          emailRedirectTo: `${ambiente.urlFrontend.replace(/\/$/, '')}/entrar`,
          data: { nome: dados.nome, telefone: dados.telefone, fusoHorario: dados.fusoHorario }
        }
      });
      if (error) throw traduzirErro(error);
      return { sessao: data.session, confirmarEmail: !data.session };
    },
    async entrar(dados) {
      const { data, error } = await criarCliente().auth.signInWithPassword({ email: dados.email, password: dados.senha });
      if (error) throw traduzirErro(error);
      return { sessao: data.session };
    },
    async confirmarEmail({ email, codigo }) {
      const { data, error } = await criarCliente().auth.verifyOtp({ email, token: codigo, type: 'email' });
      if (error) throw traduzirErro(error);
      if (!data.session) throw falha('Não foi possível iniciar sua sessão. Solicite um novo código.', 400);
      return { sessao: data.session };
    },
    async reenviarCodigo({ email }) {
      const { error } = await criarCliente().auth.resend({
        type: 'signup', email,
        options: { emailRedirectTo: `${ambiente.urlFrontend.replace(/\/$/, '')}/cadastro` }
      });
      if (error) throw traduzirErro(error);
      return { enviado: true };
    }
  };
}

module.exports = { criarServicoAutenticacao };
