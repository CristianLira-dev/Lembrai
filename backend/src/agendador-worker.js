const crypto = require('node:crypto');
const ambiente = require('./configuracao/ambiente');
const logger = require('./configuracao/logger');
const { criarConexao } = require('./filas/filas');
const { servicos } = require('./servidor');
const { processarExclusoes } = require('./servicos/servico-privacidade');

ambiente.validarAmbienteProducao();

const redis = criarConexao();
const dono = crypto.randomUUID();
const chave = 'lembrai:agendador:lock';
let executando = false;

async function ciclo() {
  if (executando) return;
  executando = true;
  try {
    const bloqueou = await redis.set(chave, dono, 'PX', 55_000, 'NX');
    if (!bloqueou) return;
    const agora = new Date();
    const lembretes = await servicos.repositorio.listarLembretesPendentes(agora);
    for (const lembrete of lembretes) {
      await servicos.filas.lembretes.add('enviar-lembrete', { lembreteId: lembrete.id }, { jobId: `lembrete-${lembrete.id}` });
    }
    await servicos.servicoLembretes.processarResumosPendentes(agora);
    await servicos.servicoLembretes.processarUsuariosInativos(agora);
    const sessoes = await servicos.repositorio.listarSessoesEstudoPendentes?.(agora) || [];
    for (const sessao of sessoes) {
      const usuario = await servicos.repositorio.buscarUsuarioPorId(sessao.usuarioId);
      if (!usuario?.telefone || usuario.notificacoesAtivas === false) continue;
      await servicos.servicoWhatsapp.enviarResposta(usuario.telefone, `📖 Hora de estudar: *${sessao.titulo}*\nSeparei ${sessao.duracaoMinutos} minutos para esta sessão. Quando terminar, me avise!`);
      await servicos.repositorio.atualizarSessaoEstudo(sessao.usuarioId, sessao.id, { status: 'notificada', notificadaEm: agora });
    }
    await servicos.repositorio.excluirMensagensAntigas?.(ambiente.retencaoMensagensDias, agora);
    await processarExclusoes(servicos.repositorio, agora);
  } catch (erro) {
    logger.error({ erro: erro.message, codigo: erro.code }, 'falha no ciclo do agendador');
  } finally {
    if ((await redis.get(chave).catch(() => null)) === dono) await redis.del(chave).catch(() => {});
    executando = false;
  }
}

const timer = setInterval(ciclo, 30_000);
ciclo();
logger.info('agendador durável iniciado');

async function encerrar() {
  clearInterval(timer);
  await redis.quit().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

module.exports = { ciclo };
