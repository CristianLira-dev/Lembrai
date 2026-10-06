const { esquemaPreferencias, validar } = require('../validadores/esquemas');

function criarControladorPreferencias({ repositorio, servicoAutenticacao }) {
  return {
    obter: async (req, res) => {
      const usuario = await repositorio.buscarUsuarioPorId(req.usuario.sub);
      return res.json({ preferencias: {
        notificacoesAtivas: usuario?.notificacoesAtivas !== false,
        horarioLembretes: usuario?.horarioLembretes || '07:27',
        horarioSilencioInicio: usuario?.horarioSilencioInicio || null,
        horarioSilencioFim: usuario?.horarioSilencioFim || null,
        frequenciaResumo: usuario?.frequenciaResumo || 'diario',
        antecedenciasLembrete: usuario?.antecedenciasLembrete || [1440],
        fusoHorario: usuario?.fusoHorario || 'America/Sao_Paulo'
      } });
    },
    atualizar: async (req, res) => {
      const dados = validar(esquemaPreferencias, req.body);
      return res.json({ preferencias: await repositorio.atualizarUsuario(req.usuario.sub, dados) });
    },
    exportar: async (req, res) => {
      res.set('Content-Disposition', 'attachment; filename="meus-dados-lembrai.json"');
      return res.json({ exportadoEm: new Date().toISOString(), dados: await repositorio.exportarDados(req.usuario.sub) });
    },
    solicitarExclusao: async (req, res) => {
      const executarEm = new Date(Date.now() + 7 * 86400000);
      await repositorio.atualizarUsuario(req.usuario.sub, { notificacoesAtivas: false, exclusaoSolicitadaEm: new Date() });
      await servicoAutenticacao.revogarSessoes?.(req.usuario.sub);
      return res.status(202).json({ mensagem: 'Solicitação registrada. A conta será excluída em até 7 dias.', executarEm });
    }
  };
}

module.exports = { criarControladorPreferencias };
