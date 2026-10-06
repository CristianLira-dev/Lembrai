const { z } = require('zod');
const { validar } = require('../validadores/esquemas');

const esquemaBroadcast = z.object({ mensagem: z.string().trim().min(4).max(1000) });

function criarControladorAdmin({ repositorio, filaWhatsapp }) {
  return {
    diagnostico: async (req, res) => {
      const [falhas, metricas] = await Promise.all([repositorio.listarFalhasOperacionais(), repositorio.metricasOperacionais()]);
      return res.json({ falhas, metricas, geradoEm: new Date().toISOString() });
    },
    reprocessar: async (req, res) => {
      const evento = await repositorio.buscarEventoWebhook(req.params.id);
      if (!evento) return res.status(404).json({ erro: 'Evento não encontrado' });
      await repositorio.atualizarEventoWebhook(evento.id, { statusProcessamento: 'falhou' });
      return res.status(202).json({ mensagem: 'Evento liberado para recuperação segura pelo reconciliador.' });
    },
    broadcast: async (req, res) => {
      const { mensagem } = validar(esquemaBroadcast, req.body);
      const usuarios = await repositorio.listarUsuariosAtivosComTelefone();
      for (const usuario of usuarios) await filaWhatsapp.add('broadcast', { telefone: usuario.telefone, texto: mensagem }, { jobId: `broadcast-${Date.now()}-${usuario.id}` });
      return res.status(202).json({ destinatarios: usuarios.length });
    }
  };
}

module.exports = { criarControladorAdmin };
