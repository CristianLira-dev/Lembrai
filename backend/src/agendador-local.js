function iniciarAgendadorLocal({ servicoLembretes, intervaloMs = 30_000 }) {
  let executando = false;

  async function processarPendentes() {
    if (executando) return;
    executando = true;
    try {
      const lembretes = await servicoLembretes.repositorio.listarLembretesPendentes(new Date());
      for (const lembrete of lembretes) {
        try {
          await servicoLembretes.processar(lembrete.id);
        } catch (erro) {
          console.error(`[Agendador] Falha ao processar lembrete ${lembrete.id}:`, erro.message);
        }
      }
      await servicoLembretes.processarResumosPendentes(new Date());
    } catch (erro) {
      console.error('[Agendador] Falha ao consultar lembretes:', erro.message);
    } finally {
      executando = false;
    }
  }

  const timer = setInterval(processarPendentes, intervaloMs);
  timer.unref?.();
  processarPendentes();

  return {
    parar() {
      clearInterval(timer);
    }
  };
}

module.exports = { iniciarAgendadorLocal };
