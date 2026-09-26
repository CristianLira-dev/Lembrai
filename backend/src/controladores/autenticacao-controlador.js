const {
  esquemaCadastro,
  esquemaEntrada,
  esquemaConfirmarCodigo,
  esquemaSolicitarRecuperacao,
  esquemaRedefinirSenha,
  esquemaReenviarConfirmacao,
  validar
} = require('../validadores/esquemas');

function criarControladorAutenticacao(servicoAutenticacao) {
  return {
    cadastrar: async (req, res) => {
      const dados = validar(esquemaCadastro, req.body);
      return res.status(201).json(await servicoAutenticacao.cadastrar(dados));
    },
    entrar: async (req, res) => {
      const dados = validar(esquemaEntrada, req.body);
      return res.json(await servicoAutenticacao.entrar(dados));
    },
    confirmarCodigo: async (req, res) => {
      const dados = validar(esquemaConfirmarCodigo, req.body);
      return res.json(await servicoAutenticacao.confirmarCodigo(dados));
    },
    solicitarRecuperacao: async (req, res) => {
      const dados = validar(esquemaSolicitarRecuperacao, req.body);
      return res.status(202).json(await servicoAutenticacao.solicitarRecuperacao(dados));
    },
    redefinirSenha: async (req, res) => {
      const dados = validar(esquemaRedefinirSenha, req.body);
      return res.json(await servicoAutenticacao.redefinirSenha(dados));
    },
    reenviarConfirmacao: async (req, res) => {
      const dados = validar(esquemaReenviarConfirmacao, req.body);
      return res.status(202).json(await servicoAutenticacao.reenviarConfirmacao(dados));
    },
    eu: async (req, res) => res.json({ usuario: req.perfil })
  };
}

module.exports = { criarControladorAutenticacao };
