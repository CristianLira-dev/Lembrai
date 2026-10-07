const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const ambiente = require('../configuracao/ambiente');
const logger = require('../configuracao/logger');
const { esquemaCadastro, validar } = require('../validadores/esquemas');
const { removerSegredos } = require('../utilitarios/seguranca');
const { ServicoEmail } = require('./servico-email');

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DURACAO_CODIGO_MS = 10 * 60 * 1000;
const MAXIMO_TENTATIVAS = 5;
const MENSAGEM_CODIGO = 'Se houver uma conta vinculada a este e-mail, o código será enviado em alguns instantes.';

function falha(mensagem, statusCode, codigo) {
  return Object.assign(new Error(mensagem), { statusCode, ...(codigo ? { code: codigo } : {}) });
}

function criarClienteAuth() {
  if (!ambiente.supabaseUrl || !ambiente.supabaseChavePublica) {
    throw falha('Não foi possível iniciar a autenticação. Tente novamente em instantes.', 503);
  }
  return createClient(ambiente.supabaseUrl, ambiente.supabaseChavePublica, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, opcoes) => fetch(url, { ...opcoes, signal: AbortSignal.timeout(10000) }) }
  });
}

function criarClienteAuthAdmin() {
  if (!ambiente.supabaseUrl || !ambiente.supabaseChaveSecreta) {
    throw falha('Não foi possível iniciar a autenticação. Tente novamente em instantes.', 503);
  }
  return createClient(ambiente.supabaseUrl, ambiente.supabaseChaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, opcoes) => fetch(url, { ...opcoes, signal: AbortSignal.timeout(10000) }) }
  });
}

function traduzirErro(erro) {
  const mensagens = {
    invalid_credentials: 'E-mail ou senha inválidos',
    email_not_confirmed: 'Confirme seu e-mail antes de entrar. Você pode solicitar um novo código.',
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
  return falha(mensagens[erro.code] || 'Não foi possível autenticar. Verifique seus dados.', 400, erro.code);
}

function gerarCodigo() {
  return Array.from({ length: 5 }, () => ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)]).join('');
}

function normalizarCodigo(codigo) { return String(codigo || '').trim().toUpperCase(); }

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
  const [usuario, dominio] = String(email).split('@');
  const inicio = usuario.slice(0, Math.min(2, usuario.length));
  return `${inicio}${'*'.repeat(Math.max(2, usuario.length - inicio.length))}@${dominio}`;
}

function criarServicoAutenticacao(
  repositorio,
  criarCliente = criarClienteAuth,
  criarClienteAdmin = criarClienteAuthAdmin,
  servicoEmail = new ServicoEmail(),
  servicoWhatsapp = null
) {
  async function verificarToken(token) {
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
        ...perfil, id: usuarioAuth.id, senhaCriptografada: '!supabase-auth'
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

  async function criarDesafio({ email, nome, finalidade, usuarioAuthId }) {
    await repositorio.invalidarCodigosVerificacao(email, finalidade);
    const id = crypto.randomUUID();
    const codigo = gerarCodigo();
    const expiraEm = new Date(Date.now() + DURACAO_CODIGO_MS);
    await repositorio.criarCodigoVerificacao({
      id, email, finalidade, codigoHash: hashCodigo(id, codigo), tokenHash: '',
      tipoToken: 'codigo_email_personalizado', usuarioAuthId, expiraEm
    });
    try {
      await servicoEmail.enviarCodigo({ email, nome, codigo, finalidade });
    } catch (erro) {
      await repositorio.atualizarCodigoVerificacao(id, { usadoEm: new Date() });
      throw erro;
    }
    return { id, email: mascararEmail(email), finalidade, expiraEm: expiraEm.toISOString() };
  }

  function criarDesafioFalso(email, finalidade) {
    return {
      id: crypto.randomUUID(), email: mascararEmail(email), finalidade,
      expiraEm: new Date(Date.now() + DURACAO_CODIGO_MS).toISOString()
    };
  }

  function respostaCodigo(desafio) {
    return { mensagem: MENSAGEM_CODIGO, desafio };
  }

  async function buscarContaConfirmada(email) {
    const perfil = await repositorio.buscarUsuarioPorEmail(email);
    const admin = criarClienteAdmin().auth.admin;

    if (perfil?.id) {
      const { data, error } = await admin.getUserById(perfil.id);
      const usuario = data?.user;
      if (!error && usuario?.email?.toLowerCase() === email && usuario.email_confirmed_at) {
        return { usuario, nome: perfil.nome || usuario.user_metadata?.nome };
      }
      if (error && error.status >= 500) throw traduzirErro(error);
    }

    let pagina = 1;
    do {
      const { data, error } = await admin.listUsers({ page: pagina, perPage: 1000 });
      if (error) throw traduzirErro(error);
      const usuario = (data?.users || []).find((item) => item.email?.toLowerCase() === email);
      if (usuario) {
        if (!usuario.email_confirmed_at) return null;
        return { usuario, nome: perfil?.nome || usuario.user_metadata?.nome };
      }
      if (!data?.nextPage) return null;
      pagina = data.nextPage;
    } while (pagina);

    return null;
  }

  async function validarCodigo(desafioId, codigo, finalidadeEsperada) {
    const desafio = await repositorio.buscarCodigoVerificacao(desafioId);
    if (!desafio || desafio.usadoEm || desafio.finalidade !== finalidadeEsperada) {
      throw falha('Código inválido ou já utilizado.', 400);
    }
    if (new Date(desafio.expiraEm) <= new Date()) {
      await repositorio.atualizarCodigoVerificacao(desafio.id, { usadoEm: new Date() });
      throw falha('Código expirado. Solicite um novo código.', 400);
    }
    if (desafio.tentativas >= MAXIMO_TENTATIVAS) {
      await repositorio.atualizarCodigoVerificacao(desafio.id, { usadoEm: new Date() });
      throw falha('Limite de tentativas atingido. Solicite um novo código.', 429);
    }
    if (!hashesIguais(hashCodigo(desafio.id, codigo), desafio.codigoHash)) {
      const tentativas = desafio.tentativas + 1;
      await repositorio.atualizarCodigoVerificacao(desafio.id, {
        tentativas, ...(tentativas >= MAXIMO_TENTATIVAS ? { usadoEm: new Date() } : {})
      });
      throw falha(
        tentativas >= MAXIMO_TENTATIVAS
          ? 'Limite de tentativas atingido. Solicite um novo código.'
          : 'Código inválido. Confira os 5 caracteres e tente novamente.',
        tentativas >= MAXIMO_TENTATIVAS ? 429 : 400
      );
    }
    const consumido = await repositorio.consumirCodigoVerificacao(desafio.id);
    if (!consumido) throw falha('Código inválido ou já utilizado.', 400);
    return consumido;
  }

  async function criarSessao(email) {
    const { data: link, error: erroLink } = await criarClienteAdmin().auth.admin.generateLink({ type: 'magiclink', email });
    if (erroLink) throw traduzirErro(erroLink);
    if (!link.properties?.hashed_token) throw falha('Não foi possível iniciar sua sessão.', 503);
    const { data, error } = await criarCliente().auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: link.properties.verification_type || 'magiclink'
    });
    if (error) throw traduzirErro(error);
    if (!data.session || !data.user) throw falha('Não foi possível iniciar sua sessão.', 503);
    return data;
  }

  async function criarSessaoComSenha(email, senha) {
    const { data, error } = await criarCliente().auth.signInWithPassword({ email, password: senha });
    if (error) throw traduzirErro(error);
    if (!data.session || !data.user) throw falha('Não foi possível iniciar sua sessão.', 503);
    return data;
  }

  async function cadastrar(dados) {
    if (await repositorio.buscarUsuarioPorEmail(dados.email)) throw falha('E-mail já cadastrado', 409);
    if (await repositorio.buscarUsuarioPorTelefone(dados.telefone)) throw falha('WhatsApp já cadastrado', 409);
    const clienteAdmin = criarClienteAdmin();
    const anterior = await repositorio.buscarUltimoCodigoVerificacao(dados.email, 'cadastro', true);
    if (anterior?.usuarioAuthId) {
      const { data } = await clienteAdmin.auth.admin.getUserById(anterior.usuarioAuthId);
      if (data?.user?.email_confirmed_at) throw falha('E-mail já cadastrado', 409);
      await clienteAdmin.auth.admin.deleteUser(anterior.usuarioAuthId).catch(() => {});
      await repositorio.invalidarCodigosVerificacao(dados.email, 'cadastro');
    }
    const { data, error } = await clienteAdmin.auth.admin.createUser({
      email: dados.email,
      password: dados.senha,
      email_confirm: true,
      user_metadata: { nome: dados.nome, telefone: dados.telefone, fusoHorario: dados.fusoHorario }
    });
    if (error) throw traduzirErro(error);
    if (!data.user?.id) throw falha('Não foi possível criar sua conta.', 503);
    try {
      const autenticacao = await criarSessaoComSenha(dados.email, dados.senha);
      const perfil = await obterPerfil(autenticacao.user);
      if (servicoWhatsapp && perfil.telefone) {
        await servicoWhatsapp.enviarResposta(perfil.telefone, '🎉 Sua conta Lembraí está pronta!\\n\\nVocê pode começar dizendo:\\n• “Tenho prova de Banco de Dados sexta às 19h”\\n• “Quero estudar algoritmos até dia 20”\\n• “Quais são minhas pendências?”').catch(() => {});
        await repositorio.atualizarUsuario(perfil.id, { onboardingConcluidoEm: new Date(), consentimentoWhatsAppEm: new Date() });
      }
      return { sessao: autenticacao.session };
    } catch (erro) {
      await clienteAdmin.auth.admin.deleteUser(data.user.id).catch(() => {});
      throw erro;
    }
  }

  async function entrar(dados) {
    const autenticacao = await criarSessaoComSenha(dados.email, dados.senha);
    return { sessao: autenticacao.session };
  }

  async function confirmarCodigo({ desafioId, codigo }) {
    const inicial = await repositorio.buscarCodigoVerificacao(desafioId);
    const finalidade = inicial?.finalidade;
    if (!['cadastro', 'entrada'].includes(finalidade)) throw falha('Código inválido ou já utilizado.', 400);
    const desafio = await validarCodigo(desafioId, codigo, finalidade);
    if (finalidade === 'cadastro') {
      const { data, error } = await criarClienteAdmin().auth.admin.updateUserById(desafio.usuarioAuthId, { email_confirm: true });
      if (error) throw traduzirErro(error);
      if (!data.user) throw falha('Não foi possível confirmar seu e-mail.', 503);
    }
    const autenticacao = await criarSessao(desafio.email);
    if (finalidade === 'cadastro') {
      const perfil = await obterPerfil(autenticacao.user);
      if (servicoWhatsapp && perfil.telefone) {
        await servicoWhatsapp.enviarResposta(perfil.telefone, '🎉 Sua conta Lembraí está pronta!\n\nVocê pode começar dizendo:\n• “Tenho prova de Banco de Dados sexta às 19h”\n• “Quero estudar algoritmos até dia 20”\n• “Quais são minhas pendências?”').catch(() => {});
        await repositorio.atualizarUsuario(perfil.id, { onboardingConcluidoEm: new Date(), consentimentoWhatsAppEm: new Date() });
      }
    }
    return { sessao: autenticacao.session };
  }

  async function solicitarRecuperacao({ email }) {
    const conta = await buscarContaConfirmada(email);
    if (!conta) return respostaCodigo(criarDesafioFalso(email, 'recuperacao'));
    try {
      return respostaCodigo(await criarDesafio({
        email, nome: conta.nome, finalidade: 'recuperacao', usuarioAuthId: conta.usuario.id
      }));
    } catch (erro) {
      if (!/^(SMTP|EMAIL)_/.test(String(erro.code || ''))) throw erro;
      logger.error({ codigo: erro.code }, 'falha ao enviar código de recuperação');
      return respostaCodigo(criarDesafioFalso(email, 'recuperacao'));
    }
  }

  async function redefinirSenha({ desafioId, codigo, novaSenha }) {
    const desafio = await validarCodigo(desafioId, codigo, 'recuperacao');
    const { error } = await criarClienteAdmin().auth.admin.updateUserById(desafio.usuarioAuthId, { password: novaSenha });
    if (error) throw traduzirErro(error);
    return { mensagem: 'Senha alterada com sucesso. Entre usando sua nova senha.' };
  }

  async function reenviarConfirmacao({ email }) {
    if (await repositorio.buscarUsuarioPorEmail(email)) return respostaCodigo(criarDesafioFalso(email, 'cadastro'));
    const anterior = await repositorio.buscarUltimoCodigoVerificacao(email, 'cadastro', true);
    if (!anterior?.usuarioAuthId) return respostaCodigo(criarDesafioFalso(email, 'cadastro'));
    const { data, error } = await criarClienteAdmin().auth.admin.getUserById(anterior.usuarioAuthId);
    if (error || !data.user || data.user.email_confirmed_at) return respostaCodigo(criarDesafioFalso(email, 'cadastro'));
    return respostaCodigo(await criarDesafio({
      email, nome: data.user.user_metadata?.nome, finalidade: 'cadastro', usuarioAuthId: data.user.id
    }));
  }

  return {
    verificarToken, obterPerfil, cadastrar, entrar, confirmarCodigo,
    solicitarRecuperacao, redefinirSenha, reenviarConfirmacao
  };
}

module.exports = { criarServicoAutenticacao };
