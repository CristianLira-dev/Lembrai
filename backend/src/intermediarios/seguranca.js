const ambiente = require('../configuracao/ambiente');
const crypto = require('node:crypto');

function compararSegredos(recebido, esperado) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(String(recebido));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function criarAutenticador(servicoAutenticacao) {
  return async (req, res, proximo) => {
    const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ erro: 'Autenticação necessária' });
    try {
      const identidade = await servicoAutenticacao.verificarToken(token);
      req.perfil = await servicoAutenticacao.obterPerfil(identidade);
      req.usuario = { sub: identidade.id, email: identidade.email };
      return proximo();
    } catch (erro) {
      return proximo(erro);
    }
  };
}

function validarSegredoWebhook(req, res, proximo) {
  // A Evolution envia a apikey no corpo do evento. O painel Manager não expõe
  // um campo para cabeçalhos personalizados, então aceitamos também o segredo
  // configurado no header quando a configuração é feita pela API.
  const token = req.headers['x-webhook-secret']
    || req.headers.authorization?.replace(/^Bearer\s+/i, '')
    || req.body?.apikey;
  if (ambiente.ambiente === 'desenvolvimento' && !process.env.EVOLUTION_WEBHOOK_SEGREDO) return proximo();
  const headerValido = compararSegredos(token, ambiente.evolutionWebhookSegredo);
  const apikeyValida = compararSegredos(req.body?.apikey, ambiente.evolutionChave);
  if (!headerValido && !apikeyValida) return res.status(401).json({ erro: 'Webhook não autorizado' });
  return proximo();
}

function tratarErros(erro, req, res, proximo) {
  req.log?.error({ erro: erro.message, codigo: erro.code, nome: erro.name, pilha: erro.stack }, 'erro na API');
  const bancoIndisponivel = new Set(['SUPABASE_CONFIG', 'SUPABASE_DATA_API']).has(erro.code);
  const status = bancoIndisponivel ? 503 : (erro.statusCode || 500);
  const mensagem = bancoIndisponivel
    ? 'Banco de dados temporariamente indisponível'
    : (status >= 500 ? 'Erro interno do servidor' : erro.message);
  return res.status(status).json({ erro: mensagem, ...(erro.detalhes ? { detalhes: erro.detalhes } : {}) });
}

module.exports = { criarAutenticador, validarSegredoWebhook, tratarErros };
