const { esquemaPlanoEstudo, esquemaAtualizarPlanoEstudo, esquemaSessaoEstudo, validar } = require('../validadores/esquemas');

function gerarSessoes(plano) {
  const inicio = new Date();
  inicio.setHours(19, 0, 0, 0);
  if (inicio <= new Date()) inicio.setDate(inicio.getDate() + 1);
  const limite = new Date(plano.dataLimite);
  const sessoes = [];
  for (let data = new Date(inicio); data <= limite && sessoes.length < 60; data.setDate(data.getDate() + 1)) {
    if (!plano.diasSemana.includes(data.getDay())) continue;
    sessoes.push({ titulo: `Estudar ${plano.titulo}`, agendadaPara: new Date(data), duracaoMinutos: plano.minutosPorSessao });
  }
  return sessoes;
}

function criarControladorEstudos({ repositorio }) {
  return {
    listar: async (req, res) => res.json({ planos: await repositorio.listarPlanosEstudo(req.usuario.sub) }),
    criar: async (req, res) => {
      const dados = validar(esquemaPlanoEstudo, req.body);
      const plano = await repositorio.criarPlanoEstudo({ ...dados, usuarioId: req.usuario.sub });
      const sessoes = [];
      for (const sessao of gerarSessoes(plano)) sessoes.push(await repositorio.criarSessaoEstudo({ ...sessao, usuarioId: req.usuario.sub, planoEstudoId: plano.id }));
      return res.status(201).json({ plano, sessoes });
    },
    atualizar: async (req, res) => {
      const dados = validar(esquemaAtualizarPlanoEstudo, req.body);
      const plano = await repositorio.atualizarPlanoEstudo(req.usuario.sub, req.params.id, dados);
      if (!plano) return res.status(404).json({ erro: 'Plano de estudo não encontrado' });
      return res.json({ plano });
    },
    criarSessao: async (req, res) => {
      const dados = validar(esquemaSessaoEstudo, req.body);
      const plano = await repositorio.buscarPlanoEstudo(req.usuario.sub, dados.planoEstudoId);
      if (!plano) return res.status(404).json({ erro: 'Plano de estudo não encontrado' });
      return res.status(201).json({ sessao: await repositorio.criarSessaoEstudo({ ...dados, usuarioId: req.usuario.sub }) });
    },
    concluirSessao: async (req, res) => {
      const sessao = await repositorio.atualizarSessaoEstudo(req.usuario.sub, req.params.id, { status: 'concluida', concluidaEm: new Date() });
      if (!sessao) return res.status(404).json({ erro: 'Sessão de estudo não encontrada' });
      return res.json({ sessao });
    }
  };
}

module.exports = { criarControladorEstudos, gerarSessoes };
