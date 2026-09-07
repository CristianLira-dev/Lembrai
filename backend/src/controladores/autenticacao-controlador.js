const { esquemaCadastro, esquemaEntrada, esquemaConfirmarEmail, esquemaReenviarCodigo, validar } = require('../validadores/esquemas');

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
    confirmarEmail: async (req, res) => {
      const dados = validar(esquemaConfirmarEmail, req.body);
      return res.json(await servicoAutenticacao.confirmarEmail(dados));
    },
    reenviarCodigo: async (req, res) => {
      const dados = validar(esquemaReenviarCodigo, req.body);
      return res.json(await servicoAutenticacao.reenviarCodigo(dados));
    },
    eu: async (req, res) => res.json({ usuario: req.perfil })
  };
}

module.exports = { criarControladorAutenticacao };
