const ambiente = require('../configuracao/ambiente');

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
  const token = req.headers['x-webhook-secret'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (ambiente.ambiente === 'desenvolvimento' && !process.env.EVOLUTION_WEBHOOK_SEGREDO) return proximo();
  if (!token || token !== ambiente.evolutionWebhookSegredo) return res.status(401).json({ erro: 'Webhook não autorizado' });
  return proximo();
}

function tratarErros(erro, req, res, proximo) {
  req.log?.error({ erro: erro.message, pilha: erro.stack }, 'erro na API');
  const status = erro.statusCode || 500;
  return res.status(status).json({ erro: status >= 500 ? 'Erro interno do servidor' : erro.message, ...(erro.detalhes ? { detalhes: erro.detalhes } : {}) });
}

module.exports = { criarAutenticador, validarSegredoWebhook, tratarErros };
