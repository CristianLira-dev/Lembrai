const { filas } = require('../filas/filas');
const { dataHorarioNoFuso } = require('../utilitarios/datas');
const { proximoResumoInicial } = require('../utilitarios/resumo-pendencias');

const mapaTipo = { exam: 'prova', assignment: 'trabalho', task: 'tarefa', class: 'aula', appointment: 'compromisso', other: 'outro', prova: 'prova', trabalho: 'trabalho', tarefa: 'tarefa' };
const mapaPrioridade = { low: 'baixa', medium: 'media', high: 'alta', baixa: 'baixa', media: 'media', alta: 'alta' };

function paraDataEntrega(tarefa) {
  if (tarefa.dueDate) return dataHorarioNoFuso(tarefa.dueDate, tarefa.dueTime || '23:59', tarefa.timezone);
  if (tarefa.dueDateTime) return new Date(tarefa.dueDateTime);
  return tarefa.dataEntrega ? new Date(tarefa.dataEntrega) : null;
}

function calcularAgendamento(dataEntrega, lembrete = { amount: 1, unit: 'day' }) {
  const quantidade = Number(lembrete.amount || lembrete.quantidade || 1);
  const unidade = lembrete.unit || lembrete.unidade || 'day';
  const unidadeMs = /^(minute|minuto)/.test(unidade) ? 60000 : /^(hour|hora)/.test(unidade) ? 3600000 : 86400000;
  return new Date(new Date(dataEntrega).getTime() - quantidade * unidadeMs);
}

class ServicoTarefas {
  constructor(repositorio, servicoCalendarios) {
    this.repositorio = repositorio;
    this.servicoCalendarios = servicoCalendarios;
  }
  async listar(usuarioId, filtros) { return this.repositorio.listarTarefas(usuarioId, filtros); }
  async obter(usuarioId, id) { const t = await this.repositorio.buscarTarefa(usuarioId, id); if (!t) { const e = new Error('Tarefa não encontrada'); e.statusCode = 404; throw e; } return t; }

  async cancelarLembretes(usuarioId, tarefaId) {
    const antigos = (await this.repositorio.listarLembretes(usuarioId)).filter((l) => l.tarefaId === tarefaId && l.status === 'agendado');
    for (const l of antigos) await this.repositorio.atualizarLembrete(usuarioId, l.id, { status: 'cancelado' });
  }

  async limparResumoSemPendencias(usuarioId) {
    const pendentes = await this.repositorio.listarTarefas(usuarioId, { status: 'pendente' });
    if (!pendentes.length) {
      await this.repositorio.atualizarUsuario(usuarioId, { proximoResumoPendenciasEm: null });
    }
  }

  async agendarPadrao(usuarioId, tarefa, usuario) {
    if (!usuario.proximoResumoPendenciasEm) {
      await this.repositorio.atualizarUsuario(usuarioId, {
        proximoResumoPendenciasEm: proximoResumoInicial(usuario)
      });
    }
    return true;
  }

  async criar(usuarioId, dados, opcoes = {}) {
    const usuario = await this.repositorio.buscarUsuarioPorId(usuarioId);
    const dataEntrega = paraDataEntrega({ ...dados, timezone: usuario.fusoHorario });
    if (!dataEntrega || Number.isNaN(dataEntrega.getTime())) throw new Error('Data inválida');
    // Id estável da ação impede duplicação se a resposta falhar depois da gravação.
    const existente = opcoes.idTarefa ? await this.repositorio.buscarTarefa(usuarioId, opcoes.idTarefa) : null;
    const tarefa = existente || await this.repositorio.criarTarefa({
      ...(opcoes.idTarefa ? { id: opcoes.idTarefa } : {}), usuarioId,
      titulo: dados.titulo || dados.title, descricao: dados.descricao || dados.notes || null,
      materia: dados.materia || dados.subject || null,
      tipo: mapaTipo[dados.tipo] || mapaTipo[dados.type] || dados.tipo || 'tarefa',
      dataEntrega, horarioEntrega: dados.dueTime || dados.horarioEntrega || null,
      duracao: dados.duracao || dados.duration || null, prioridade: mapaPrioridade[dados.prioridade || dados.priority] || 'media'
    });
    let lembreteAgendado = false;
    const avisos = [];
    try {
      if (tarefa.materia) await this.repositorio.criarMateria(usuarioId, tarefa.materia);
      await this.cancelarLembretes(usuarioId, tarefa.id);
      const lembretes = opcoes.horarioPadrao ? null : (dados.reminders || dados.lembretes);
      if (!lembretes) lembreteAgendado = await this.agendarPadrao(usuarioId, tarefa, usuario);
      else for (const lembrete of lembretes) {
        const agendadoPara = calcularAgendamento(tarefa.dataEntrega, lembrete);
        if (agendadoPara <= new Date() && !opcoes.agendarAtrasado) continue;
        const r = await this.repositorio.criarLembrete({ tarefaId: tarefa.id, usuarioId, agendadoPara, tipo: String(lembrete.amount || 1) + '_' + (lembrete.unit || 'day') });
        await filas.lembretes.add('enviar-lembrete', { lembreteId: r.id }, { delay: Math.max(0, agendadoPara - Date.now()) });
        lembreteAgendado = true;
      }
    } catch { avisos.push('Não consegui agendar os lembretes.'); }
    let calendario = { sincronizado: false, motivo: 'não solicitado' };
    if (opcoes.sincronizarCalendario !== false) {
      try { calendario = await this.servicoCalendarios.criarEventoParaTarefa(usuarioId, tarefa); }
      catch { calendario = { sincronizado: false, motivo: 'falha' }; avisos.push('O calendário externo não sincronizou.'); }
    }
    return { tarefa, calendario, lembreteAgendado, avisos };
  }

  async atualizar(usuarioId, id, dados) {
    const anterior = await this.obter(usuarioId, id);
    const tarefa = await this.repositorio.atualizarTarefa(usuarioId, id, dados);
    const avisos = [];
    try {
      if (dados.materia) await this.repositorio.criarMateria(usuarioId, dados.materia);
      if (dados.dataEntrega && new Date(dados.dataEntrega).getTime() !== new Date(anterior.dataEntrega).getTime()) {
        await this.cancelarLembretes(usuarioId, id);
        if (tarefa.status === 'pendente') await this.agendarPadrao(usuarioId, tarefa, await this.repositorio.buscarUsuarioPorId(usuarioId));
      }
    } catch { avisos.push('Não consegui atualizar os lembretes.'); }
    try { await this.servicoCalendarios.atualizarEventoParaTarefa(usuarioId, tarefa); }
    catch { avisos.push('O calendário externo não sincronizou.'); }
    return { ...tarefa, avisos };
  }

  async excluir(usuarioId, id) {
    const excluida = await this.repositorio.excluirTarefa(usuarioId, id);
    if (excluida) await this.limparResumoSemPendencias(usuarioId);
    return excluida;
  }
  async concluir(usuarioId, id) {
    await this.obter(usuarioId, id);
    const tarefa = await this.repositorio.atualizarTarefa(usuarioId, id, { status: 'concluida' });
    const avisos = [];
    try { await this.cancelarLembretes(usuarioId, id); } catch { avisos.push('Os lembretes ainda estão sendo atualizados.'); }
    await this.limparResumoSemPendencias(usuarioId);
    try { await this.servicoCalendarios.atualizarEventoParaTarefa(usuarioId, tarefa); }
    catch { avisos.push('O calendário externo não sincronizou.'); }
    return { ...tarefa, avisos };
  }

  async alterarHorario(usuarioId, horario) {
    const usuario = await this.repositorio.atualizarUsuario(usuarioId, { horarioLembretes: horario, preferenciaLembretesPerguntada: true, proximoResumoPendenciasEm: null });
    const tarefas = await this.repositorio.listarTarefas(usuarioId, { status: 'pendente' });
    for (const tarefa of tarefas) {
      const lembretes = (await this.repositorio.listarLembretes(usuarioId)).filter((l) => l.tarefaId === tarefa.id && l.tipo === 'padrao_diario' && l.status === 'agendado');
      for (const l of lembretes) await this.repositorio.atualizarLembrete(usuarioId, l.id, { status: 'cancelado' });
      await this.agendarPadrao(usuarioId, tarefa, usuario);
    }
    return usuario;
  }
  async estatisticas(usuarioId) { return this.repositorio.estatisticas(usuarioId); }
}
module.exports = { ServicoTarefas, paraDataEntrega, calcularAgendamento };
