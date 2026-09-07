const { PrismaClient } = require('@prisma/client');

const clientePrisma = new PrismaClient();

function criarId(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizarTarefa(tarefa) {
  if (!tarefa) return tarefa;
  return { ...tarefa, dataEntrega: new Date(tarefa.dataEntrega).toISOString() };
}

class RepositorioMemoria {
  constructor() {
    this.usuarios = [];
    this.tarefas = [];
    this.lembretes = [];
    this.conversas = [];
    this.mensagens = [];
    this.webhooks = [];
    this.conexoes = [];
    this.eventos = [];
    this.registros = [];
  }

  async verificarConexao() { return true; }

  async buscarUsuarioPorEmail(email) { return this.usuarios.find((item) => item.email === email) || null; }
  async buscarUsuarioPorId(id) { return this.usuarios.find((item) => item.id === id) || null; }
  async buscarUsuarioPorTelefone(telefone) { return this.usuarios.find((item) => item.telefone === telefone) || null; }
  async criarUsuario(dados) {
    const agora = new Date();
    const usuario = { id: criarId('usr'), criadoEm: agora, atualizadoEm: agora, fusoHorario: 'America/Sao_Paulo', ...dados };
    this.usuarios.push(usuario);
    return usuario;
  }

  async listarTarefas(usuarioId, filtros = {}) {
    let lista = this.tarefas.filter((item) => item.usuarioId === usuarioId);
    if (filtros.status) lista = lista.filter((item) => item.status === filtros.status);
    if (filtros.periodo === 'hoje') {
      const hoje = new Date();
      lista = lista.filter((item) => new Date(item.dataEntrega).toDateString() === hoje.toDateString());
    }
    return lista.sort((a, b) => new Date(a.dataEntrega) - new Date(b.dataEntrega)).map(normalizarTarefa);
  }

  async buscarTarefa(usuarioId, id) { return this.tarefas.find((item) => item.id === id && item.usuarioId === usuarioId) || null; }
  async criarTarefa(dados) {
    const agora = new Date();
    const tarefa = { id: criarId('tar'), criadoEm: agora, atualizadoEm: agora, status: 'pendente', prioridade: 'media', tipo: 'tarefa', ...dados, dataEntrega: new Date(dados.dataEntrega) };
    this.tarefas.push(tarefa);
    return normalizarTarefa(tarefa);
  }
  async atualizarTarefa(usuarioId, id, dados) {
    const tarefa = this.tarefas.find((item) => item.id === id && item.usuarioId === usuarioId);
    if (!tarefa) return null;
    Object.assign(tarefa, dados, { atualizadoEm: new Date() });
    if (dados.dataEntrega) tarefa.dataEntrega = new Date(dados.dataEntrega);
    return normalizarTarefa(tarefa);
  }
  async excluirTarefa(usuarioId, id) {
    const indice = this.tarefas.findIndex((item) => item.id === id && item.usuarioId === usuarioId);
    if (indice < 0) return false;
    this.tarefas.splice(indice, 1);
    this.lembretes = this.lembretes.filter((item) => item.tarefaId !== id);
    return true;
  }

  async listarLembretes(usuarioId) { return this.lembretes.filter((item) => item.usuarioId === usuarioId).sort((a, b) => new Date(a.agendadoPara) - new Date(b.agendadoPara)); }
  async listarLembretesPendentes(ate = new Date()) { return this.lembretes.filter((item) => item.status === 'agendado' && new Date(item.agendadoPara) <= ate).sort((a, b) => new Date(a.agendadoPara) - new Date(b.agendadoPara)); }
  async criarLembrete(dados) { const item = { id: criarId('lem'), criadoEm: new Date(), status: 'agendado', tentativas: 0, ...dados, agendadoPara: new Date(dados.agendadoPara) }; this.lembretes.push(item); return item; }
  async buscarLembrete(usuarioId, id) { return this.lembretes.find((item) => item.id === id && item.usuarioId === usuarioId) || null; }
  async buscarLembretePorId(id) { return this.lembretes.find((item) => item.id === id) || null; }
  async atualizarLembrete(usuarioId, id, dados) { const item = await this.buscarLembrete(usuarioId, id); if (!item) return null; Object.assign(item, dados); return item; }
  async excluirLembrete(usuarioId, id) { const indice = this.lembretes.findIndex((item) => item.id === id && item.usuarioId === usuarioId); if (indice < 0) return false; this.lembretes.splice(indice, 1); return true; }

  async buscarOuCriarConversa(usuarioId, telefone) {
    let conversa = this.conversas.find((item) => item.usuarioId === usuarioId && item.telefone === telefone);
    if (!conversa) { conversa = { id: criarId('conv'), usuarioId, telefone, criadoEm: new Date(), atualizadoEm: new Date(), mensagens: [] }; this.conversas.push(conversa); }
    return conversa;
  }
  async atualizarConversa(id, dados) { const conversa = this.conversas.find((item) => item.id === id); if (!conversa) return null; Object.assign(conversa, dados, { atualizadoEm: new Date() }); return conversa; }
  async salvarMensagem(dados) { const mensagem = { id: criarId('msg'), criadoEm: new Date(), atualizadoEm: new Date(), statusProcessamento: 'processado', ...dados }; this.mensagens.push(mensagem); return mensagem; }
  async listarConversas(usuarioId) { return this.conversas.filter((item) => item.usuarioId === usuarioId).map((item) => ({ ...item, mensagens: undefined })); }
  async listarMensagens(usuarioId, conversaId) { const conversa = this.conversas.find((item) => item.id === conversaId && item.usuarioId === usuarioId); return conversa ? this.mensagens.filter((item) => item.conversaId === conversaId).sort((a, b) => a.criadoEm - b.criadoEm) : null; }
  async registrarEventoWebhook(dados) { const chave = `${dados.provedor}:${dados.identificadorEventoExterno}`; if (this.webhooks.some((item) => item.chave === chave)) return { duplicado: true, evento: this.webhooks.find((item) => item.chave === chave) }; const evento = { id: criarId('whk'), chave, recebidoEm: new Date(), statusProcessamento: 'recebido', ...dados }; this.webhooks.push(evento); return { duplicado: false, evento }; }

  async listarConexoes(usuarioId) { return this.conexoes.filter((item) => item.usuarioId === usuarioId); }
  async buscarConexao(usuarioId, provedor) { return this.conexoes.find((item) => item.usuarioId === usuarioId && item.provedor === provedor) || null; }
  async salvarConexao(dados) { const atual = await this.buscarConexao(dados.usuarioId, dados.provedor); if (atual) { Object.assign(atual, dados, { atualizadoEm: new Date() }); return atual; } const item = { id: criarId('cal'), criadoEm: new Date(), atualizadoEm: new Date(), status: 'conectado', ...dados }; this.conexoes.push(item); return item; }
  async excluirConexao(usuarioId, provedor) { const indice = this.conexoes.findIndex((item) => item.usuarioId === usuarioId && item.provedor === provedor); if (indice < 0) return false; this.conexoes.splice(indice, 1); return true; }
  async criarEventoCalendario(dados) { const item = { id: criarId('evt'), criadoEm: new Date(), atualizadoEm: new Date(), ...dados }; this.eventos.push(item); return item; }
  async criarRegistroSincronizacao(dados) { const item = { id: criarId('sync'), iniciadoEm: new Date(), ...dados }; this.registros.push(item); return item; }

  async estatisticas(usuarioId) {
    const tarefas = await this.listarTarefas(usuarioId);
    const hoje = new Date();
    return {
      total: tarefas.length,
      pendentes: tarefas.filter((item) => item.status === 'pendente').length,
      concluidas: tarefas.filter((item) => item.status === 'concluida').length,
      atrasadas: tarefas.filter((item) => item.status === 'pendente' && new Date(item.dataEntrega) < hoje).length,
      provas: tarefas.filter((item) => item.tipo === 'prova' && item.status === 'pendente').slice(0, 5)
    };
  }
}

class RepositorioPrisma {
  async verificarConexao() {
    await clientePrisma.$queryRaw`SELECT 1`;
    return true;
  }

  async buscarUsuarioPorEmail(email) { return clientePrisma.usuario.findUnique({ where: { email } }); }
  async buscarUsuarioPorId(id) { return clientePrisma.usuario.findUnique({ where: { id } }); }
  async buscarUsuarioPorTelefone(telefone) { return clientePrisma.usuario.findUnique({ where: { telefone } }); }
  async criarUsuario(dados) { return clientePrisma.usuario.create({ data: dados }); }

  async listarTarefas(usuarioId, filtros = {}) {
    const where = { usuarioId };
    if (filtros.status) where.status = filtros.status;
    if (filtros.periodo === 'hoje') { const inicio = new Date(); inicio.setHours(0, 0, 0, 0); const fim = new Date(inicio); fim.setDate(fim.getDate() + 1); where.dataEntrega = { gte: inicio, lt: fim }; }
    return clientePrisma.tarefa.findMany({ where, orderBy: { dataEntrega: 'asc' } });
  }
  async buscarTarefa(usuarioId, id) { return clientePrisma.tarefa.findFirst({ where: { id, usuarioId } }); }
  async criarTarefa(dados) { return clientePrisma.tarefa.create({ data: { ...dados, dataEntrega: new Date(dados.dataEntrega) } }); }
  async atualizarTarefa(usuarioId, id, dados) { const existente = await this.buscarTarefa(usuarioId, id); if (!existente) return null; return clientePrisma.tarefa.update({ where: { id }, data: { ...dados, ...(dados.dataEntrega ? { dataEntrega: new Date(dados.dataEntrega) } : {}) } }); }
  async excluirTarefa(usuarioId, id) { const existente = await this.buscarTarefa(usuarioId, id); if (!existente) return false; await clientePrisma.tarefa.delete({ where: { id } }); return true; }

  async listarLembretes(usuarioId) { return clientePrisma.lembrete.findMany({ where: { usuarioId }, orderBy: { agendadoPara: 'asc' }, include: { tarefa: true } }); }
  async listarLembretesPendentes(ate = new Date()) { return clientePrisma.lembrete.findMany({ where: { status: 'agendado', agendadoPara: { lte: ate } }, orderBy: { agendadoPara: 'asc' }, take: 50, include: { tarefa: true } }); }
  async criarLembrete(dados) { return clientePrisma.lembrete.create({ data: { ...dados, agendadoPara: new Date(dados.agendadoPara) } }); }
  async buscarLembrete(usuarioId, id) { return clientePrisma.lembrete.findFirst({ where: { id, usuarioId }, include: { tarefa: true } }); }
  async buscarLembretePorId(id) { return clientePrisma.lembrete.findUnique({ where: { id }, include: { tarefa: true } }); }
  async atualizarLembrete(usuarioId, id, dados) { const existente = await this.buscarLembrete(usuarioId, id); if (!existente) return null; return clientePrisma.lembrete.update({ where: { id }, data: { ...dados, ...(dados.agendadoPara ? { agendadoPara: new Date(dados.agendadoPara) } : {}) } }); }
  async excluirLembrete(usuarioId, id) { const existente = await this.buscarLembrete(usuarioId, id); if (!existente) return false; await clientePrisma.lembrete.delete({ where: { id } }); return true; }

  async buscarOuCriarConversa(usuarioId, telefone) { return clientePrisma.conversa.upsert({ where: { usuarioId_telefone: { usuarioId, telefone } }, update: {}, create: { usuarioId, telefone } }); }
  async atualizarConversa(id, dados) { return clientePrisma.conversa.update({ where: { id }, data: dados }); }
  async salvarMensagem(dados) { return clientePrisma.mensagem.create({ data: dados }); }
  async listarConversas(usuarioId) { return clientePrisma.conversa.findMany({ where: { usuarioId }, orderBy: { atualizadoEm: 'desc' }, include: { mensagens: { take: 1, orderBy: { criadoEm: 'desc' } } } }); }
  async listarMensagens(usuarioId, conversaId) { const conversa = await clientePrisma.conversa.findFirst({ where: { id: conversaId, usuarioId } }); if (!conversa) return null; return clientePrisma.mensagem.findMany({ where: { conversaId }, orderBy: { criadoEm: 'asc' } }); }
  async registrarEventoWebhook(dados) {
    try {
      const evento = await clientePrisma.eventoWebhook.create({ data: dados });
      return { duplicado: false, evento };
    } catch (erro) {
      if (erro.code === 'P2002') {
        const evento = await clientePrisma.eventoWebhook.findFirst({ where: { provedor: dados.provedor, identificadorEventoExterno: dados.identificadorEventoExterno } });
        return { duplicado: true, evento };
      }
      throw erro;
    }
  }

  async listarConexoes(usuarioId) { return clientePrisma.conexaoCalendario.findMany({ where: { usuarioId }, orderBy: { provedor: 'asc' } }); }
  async buscarConexao(usuarioId, provedor) { return clientePrisma.conexaoCalendario.findUnique({ where: { usuarioId_provedor: { usuarioId, provedor } } }); }
  async salvarConexao(dados) {
    const { id, criadoEm, atualizadoEm, ...campos } = dados;
    return clientePrisma.conexaoCalendario.upsert({ where: { usuarioId_provedor: { usuarioId: campos.usuarioId, provedor: campos.provedor } }, update: campos, create: campos });
  }
  async excluirConexao(usuarioId, provedor) { const existente = await this.buscarConexao(usuarioId, provedor); if (!existente) return false; await clientePrisma.conexaoCalendario.delete({ where: { id: existente.id } }); return true; }
  async criarEventoCalendario(dados) { return clientePrisma.eventoCalendario.create({ data: { ...dados, dataInicio: new Date(dados.dataInicio), dataFim: new Date(dados.dataFim) } }); }
  async criarRegistroSincronizacao(dados) { return clientePrisma.registroSincronizacao.create({ data: dados }); }
  async estatisticas(usuarioId) { const [total, pendentes, concluidas, atrasadas, provas] = await Promise.all([clientePrisma.tarefa.count({ where: { usuarioId } }), clientePrisma.tarefa.count({ where: { usuarioId, status: 'pendente' } }), clientePrisma.tarefa.count({ where: { usuarioId, status: 'concluida' } }), clientePrisma.tarefa.count({ where: { usuarioId, status: 'pendente', dataEntrega: { lt: new Date() } } }), clientePrisma.tarefa.findMany({ where: { usuarioId, tipo: 'prova', status: 'pendente' }, orderBy: { dataEntrega: 'asc' }, take: 5 })]); return { total, pendentes, concluidas, atrasadas, provas }; }
}

const usarMemoria = process.env.USAR_BANCO_MEMORIA === 'true';
const repositorio = usarMemoria ? new RepositorioMemoria() : new RepositorioPrisma();

module.exports = { repositorio, clientePrisma, RepositorioMemoria, RepositorioPrisma };
