const { esquemaCadastro, esquemaEntrada, esquemaConfirmarCodigo, validar } = require('../validadores/esquemas');

function criarControladorAutenticacao(servicoAutenticacao) {
  return {
    cadastrar: async (req, res) => {
      const dados = validar(esquemaCadastro, req.body);
      return res.status(202).json(await servicoAutenticacao.cadastrar(dados));
    },
    entrar: async (req, res) => {
      const dados = validar(esquemaEntrada, req.body);
      return res.status(202).json(await servicoAutenticacao.entrar(dados));
    },
    confirmarCodigo: async (req, res) => {
      const dados = validar(esquemaConfirmarCodigo, req.body);
      return res.json(await servicoAutenticacao.confirmarCodigo(dados));
    },
    eu: async (req, res) => res.json({ usuario: req.perfil })
  };
}

module.exports = { criarControladorAutenticacao };
