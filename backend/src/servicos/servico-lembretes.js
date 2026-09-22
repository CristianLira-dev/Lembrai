const { formatarResumoPendencias, proximoResumoBienal, proximoResumoInicial } = require('../utilitarios/resumo-pendencias');

class ServicoLembretes {
  constructor({ repositorio, servicoWhatsapp }) {
    this.repositorio = repositorio;
    this.servicoWhatsapp = servicoWhatsapp;
  }

  async listar(usuarioId) { return this.repositorio.listarLembretes(usuarioId); }
  async criar(usuarioId, dados) {
    const tarefa = await this.repositorio.buscarTarefa(usuarioId, dados.tarefaId);
    if (!tarefa) { const erro = new Error('Tarefa não encontrada'); erro.statusCode = 404; throw erro; }
    return this.repositorio.criarLembrete({ ...dados, usuarioId });
  }
  async atualizar(usuarioId, id, dados) { return this.repositorio.atualizarLembrete(usuarioId, id, dados); }
  async excluir(usuarioId, id) { return this.repositorio.excluirLembrete(usuarioId, id); }

  async agendarResumoInicial(usuario, agora = new Date()) {
    if (usuario.proximoResumoPendenciasEm) return new Date(usuario.proximoResumoPendenciasEm);
    const proximo = proximoResumoInicial(usuario, agora);
    await this.repositorio.atualizarUsuario(usuario.id, { proximoResumoPendenciasEm: proximo });
    return proximo;
  }

  async processarResumosPendentes(agora = new Date()) {
    const usuarios = await this.repositorio.listarUsuariosComTarefasPendentes();
    const resultado = { agendados: 0, enviados: 0, falhos: 0 };

    for (const usuario of usuarios) {
      const proximo = await this.agendarResumoInicial(usuario, agora);
      if (proximo > agora) {
        resultado.agendados += 1;
        continue;
      }

      try {
        const tarefas = await this.repositorio.listarTarefas(usuario.id, { status: 'pendente' });
        if (!tarefas.length) continue;
        await this.servicoWhatsapp.enviarResposta(usuario.telefone, formatarResumoPendencias(tarefas, usuario));
        await this.repositorio.atualizarUsuario(usuario.id, {
          ultimoResumoPendenciasEm: agora,
          proximoResumoPendenciasEm: proximoResumoBienal(usuario, agora)
        });
        resultado.enviados += 1;
      } catch (erro) {
        resultado.falhos += 1;
      }
    }

    return resultado;
  }

  async processar(lembreteId) {
    const lembrete = await this.repositorio.buscarLembretePorId?.(lembreteId) || null;
    if (!lembrete) return { ignorado: true, motivo: 'lembrete_nao_encontrado' };
    if (lembrete.status !== 'agendado') return { ignorado: true, motivo: 'lembrete_ja_processado' };
    if (new Date(lembrete.agendadoPara) > new Date()) return { ignorado: true, motivo: 'lembrete_reagendado' };
    const tarefa = lembrete.tarefa || await this.repositorio.buscarTarefa(lembrete.usuarioId, lembrete.tarefaId);
    if (!tarefa || tarefa.status !== 'pendente') {
      await this.repositorio.atualizarLembrete(lembrete.usuarioId, lembrete.id, { status: 'cancelado' });
      return { ignorado: true, motivo: 'tarefa_nao_pendente' };
    }
    const usuario = await this.repositorio.buscarUsuarioPorId(lembrete.usuarioId);
    try {
      const prazo = new Date(tarefa.dataEntrega).toLocaleDateString('pt-BR', { timeZone: usuario.fusoHorario || 'America/Sao_Paulo' });
      await this.servicoWhatsapp.enviarResposta(usuario.telefone, `🔔 ${tarefa.titulo} — ${tarefa.materia || 'atividade'} — entrega ${prazo}.\nQuando terminar, me avisa por aqui!`);
      await this.repositorio.atualizarLembrete(lembrete.usuarioId, lembrete.id, { status: 'enviado', tentativas: (lembrete.tentativas || 0) + 1, enviadoEm: new Date() });
      return { enviado: true };
    } catch (erro) {
      await this.repositorio.atualizarLembrete(lembrete.usuarioId, lembrete.id, { status: 'falhou', tentativas: (lembrete.tentativas || 0) + 1 });
      throw erro;
    }
  }
}

module.exports = { ServicoLembretes };
