const { createClient } = require('@supabase/supabase-js');
const ambiente = require('../configuracao/ambiente');

function criarId(prefixo) {
  return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function dataIso(valor = new Date()) {
  return new Date(valor).toISOString();
}

function normalizarTarefa(tarefa) {
  if (!tarefa) return tarefa;
  return { ...tarefa, dataEntrega: dataIso(tarefa.dataEntrega) };
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
    this.materias = [];
  }

  async verificarConexao() { return true; }

  async buscarUsuarioPorEmail(email) { return this.usuarios.find((item) => item.email === email) || null; }
  async buscarUsuarioPorId(id) { return this.usuarios.find((item) => item.id === id) || null; }
  async buscarUsuarioPorTelefone(telefone) { return this.usuarios.find((item) => item.telefone === telefone) || null; }
  async listarUsuariosComTarefasPendentes() {
    return this.usuarios.filter((usuario) => this.tarefas.some((tarefa) => tarefa.usuarioId === usuario.id && tarefa.status === 'pendente'));
  }
  async atualizarUsuario(id, dados) { const usuario = await this.buscarUsuarioPorId(id); if (!usuario) return null; Object.assign(usuario, dados, { atualizadoEm: new Date() }); return usuario; }
  async listarMaterias(usuarioId) { return this.materias.filter((item) => item.usuarioId === usuarioId); }
  async criarMateria(usuarioId, nome) { const normalizado = nome.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const existente = this.materias.find((item) => item.usuarioId === usuarioId && item.normalizado === normalizado); if (existente) return existente; const materia = { id: criarId('mat'), usuarioId, nome: nome.trim(), normalizado }; this.materias.push(materia); return materia; }
  async criarUsuario(dados) {
    const agora = new Date();
    const usuario = { id: criarId('usr'), criadoEm: agora, atualizadoEm: agora, fusoHorario: 'America/Sao_Paulo', horarioLembretes: '07:27', preferenciaLembretesPerguntada: false, ...dados };
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
  async buscarMensagemExterna(conversaId, identificador) { return this.mensagens.find((m) => m.conversaId === conversaId && m.identificadorMensagemExterna === identificador) || null; }
  async atualizarMensagem(id, dados) { const mensagem = this.mensagens.find((m) => m.id === id); if (mensagem) Object.assign(mensagem, dados); return mensagem; }
  async iniciarExecucaoAcao(id, usuarioId, actionId) { const c = this.conversas.find((c) => c.id === id && c.usuarioId === usuarioId && c.dadosPendentes?.actionId === actionId && c.dadosPendentes?.stage === 'confirm'); if (!c) return null; const dados = structuredClone(c.dadosPendentes); c.dadosPendentes = { ...dados, stage: 'executing' }; return dados; }
  async listarConversas(usuarioId) { return this.conversas.filter((item) => item.usuarioId === usuarioId).map((item) => ({ ...item, mensagens: undefined })); }
  async listarMensagens(usuarioId, conversaId) { const conversa = this.conversas.find((item) => item.id === conversaId && item.usuarioId === usuarioId); return conversa ? this.mensagens.filter((item) => item.conversaId === conversaId).sort((a, b) => a.criadoEm - b.criadoEm) : null; }
  async registrarEventoWebhook(dados) { const chave = `${dados.provedor}:${dados.identificadorEventoExterno}`; if (this.webhooks.some((item) => item.chave === chave)) return { duplicado: true, evento: this.webhooks.find((item) => item.chave === chave) }; const evento = { id: criarId('whk'), chave, recebidoEm: new Date(), statusProcessamento: 'recebido', ...dados }; this.webhooks.push(evento); return { duplicado: false, evento }; }

  async listarConexoes(usuarioId) { return this.conexoes.filter((item) => item.usuarioId === usuarioId); }
  async buscarConexao(usuarioId, provedor) { return this.conexoes.find((item) => item.usuarioId === usuarioId && item.provedor === provedor) || null; }
  async salvarConexao(dados) { const atual = await this.buscarConexao(dados.usuarioId, dados.provedor); if (atual) { Object.assign(atual, dados, { atualizadoEm: new Date() }); return atual; } const item = { id: criarId('cal'), criadoEm: new Date(), atualizadoEm: new Date(), status: 'conectado', ...dados }; this.conexoes.push(item); return item; }
  async excluirConexao(usuarioId, provedor) { const indice = this.conexoes.findIndex((item) => item.usuarioId === usuarioId && item.provedor === provedor); if (indice < 0) return false; this.conexoes.splice(indice, 1); return true; }
  async criarEventoCalendario(dados) { const item = { id: criarId('evt'), criadoEm: new Date(), atualizadoEm: new Date(), ...dados }; this.eventos.push(item); return item; }
  async listarEventosTarefa(usuarioId, tarefaId) { return this.eventos.filter((e) => e.usuarioId === usuarioId && e.tarefaId === tarefaId); }
  async atualizarEventoCalendario(usuarioId, id, dados) { const e = this.eventos.find((e) => e.usuarioId === usuarioId && e.id === id); if (e) Object.assign(e, dados); return e; }
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

function falhaDados(erro) {
  if (erro?.code === '23505') return erro;
  const falha = new Error('Supabase Data API indisponível');
  falha.code = 'SUPABASE_DATA_API';
  falha.statusCode = 503;
  falha.cause = erro;
  return falha;
}

function criarClienteDados() {
  if (!ambiente.supabaseUrl || !ambiente.supabaseChaveSecreta) {
    const erro = new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY no backend');
    erro.code = 'SUPABASE_CONFIG';
    erro.statusCode = 503;
    throw erro;
  }
  return createClient(ambiente.supabaseUrl, ambiente.supabaseChaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, opcoes) => fetch(url, { ...opcoes, signal: AbortSignal.timeout(10000) }) }
  });
}

class RepositorioSupabase {
  constructor(criarCliente = criarClienteDados) {
    this.criarCliente = criarCliente;
  }

  async executar(consulta) {
    try {
      const resultado = await consulta;
      if (resultado.error) throw resultado.error;
      return resultado;
    } catch (erro) {
      throw falhaDados(erro);
    }
  }

  async verificarConexao() {
    await this.executar(this.criarCliente().from('Usuario').select('id').limit(1));
    return true;
  }

  async buscarUm(tabela, filtros) {
    let consulta = this.criarCliente().from(tabela).select('*');
    Object.entries(filtros).forEach(([campo, valor]) => { consulta = consulta.eq(campo, valor); });
    return (await this.executar(consulta.maybeSingle())).data;
  }

  async inserir(tabela, dados) {
    return (await this.executar(this.criarCliente().from(tabela).insert(dados).select().single())).data;
  }

  async buscarUsuarioPorEmail(email) { return this.buscarUm('Usuario', { email }); }
  async buscarUsuarioPorId(id) { return this.buscarUm('Usuario', { id }); }
  async buscarUsuarioPorTelefone(telefone) { return this.buscarUm('Usuario', { telefone }); }
  async listarUsuariosComTarefasPendentes() {
    const { data } = await this.executar(this.criarCliente().from('Usuario')
      .select('*, tarefas:Tarefa!inner(id)')
      .eq('tarefas.status', 'pendente'));
    return data.map(({ tarefas, ...usuario }) => usuario);
  }
  async atualizarUsuario(id, dados) { const { data } = await this.executar(this.criarCliente().from('Usuario').update({ ...dados, atualizadoEm: dataIso() }).eq('id', id).select().maybeSingle()); return data; }
  async listarMaterias(usuarioId) { const { data } = await this.executar(this.criarCliente().from('Materia').select('*').eq('usuarioId', usuarioId).order('nome')); return data; }
  async criarMateria(usuarioId, nome) {
    const normalizado = nome.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const existente = await this.buscarUm('Materia', { usuarioId, normalizado });
    if (existente) return existente;
    try { return await this.inserir('Materia', { id: criarId('mat'), usuarioId, nome: nome.trim(), normalizado }); }
    catch (erro) { if (erro.code === '23505') return this.buscarUm('Materia', { usuarioId, normalizado }); throw erro; }
  }
  async criarUsuario(dados) {
    const agora = dataIso();
    return this.inserir('Usuario', { id: criarId('usr'), fusoHorario: 'America/Sao_Paulo', criadoEm: agora, atualizadoEm: agora, ...dados });
  }

  async listarTarefas(usuarioId, filtros = {}) {
    let consulta = this.criarCliente().from('Tarefa').select('*').eq('usuarioId', usuarioId);
    if (filtros.status) consulta = consulta.eq('status', filtros.status);
    if (filtros.periodo === 'hoje') {
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 1);
      consulta = consulta.gte('dataEntrega', dataIso(inicio)).lt('dataEntrega', dataIso(fim));
    }
    const { data } = await this.executar(consulta.order('dataEntrega', { ascending: true }));
    return data.map(normalizarTarefa);
  }
  async buscarTarefa(usuarioId, id) { return this.buscarUm('Tarefa', { id, usuarioId }); }
  async criarTarefa(dados) {
    const agora = dataIso();
    const tarefa = await this.inserir('Tarefa', { id: criarId('tar'), status: 'pendente', prioridade: 'media', tipo: 'tarefa', criadoEm: agora, atualizadoEm: agora, ...dados, dataEntrega: dataIso(dados.dataEntrega) });
    return normalizarTarefa(tarefa);
  }
  async atualizarTarefa(usuarioId, id, dados) {
    const campos = { ...dados, atualizadoEm: dataIso(), ...(dados.dataEntrega ? { dataEntrega: dataIso(dados.dataEntrega) } : {}) };
    const { data } = await this.executar(this.criarCliente().from('Tarefa').update(campos).eq('id', id).eq('usuarioId', usuarioId).select().maybeSingle());
    return normalizarTarefa(data);
  }
  async excluirTarefa(usuarioId, id) {
    const { data } = await this.executar(this.criarCliente().from('Tarefa').delete().eq('id', id).eq('usuarioId', usuarioId).select('id').maybeSingle());
    return Boolean(data);
  }

  consultaLembrete() { return '*, tarefa:Tarefa(*)'; }
  async listarLembretes(usuarioId) { const { data } = await this.executar(this.criarCliente().from('Lembrete').select(this.consultaLembrete()).eq('usuarioId', usuarioId).order('agendadoPara', { ascending: true })); return data; }
  async listarLembretesPendentes(ate = new Date()) { const { data } = await this.executar(this.criarCliente().from('Lembrete').select(this.consultaLembrete()).eq('status', 'agendado').lte('agendadoPara', dataIso(ate)).order('agendadoPara', { ascending: true }).limit(50)); return data; }
  async criarLembrete(dados) { return this.inserir('Lembrete', { id: criarId('lem'), status: 'agendado', tentativas: 0, criadoEm: dataIso(), ...dados, agendadoPara: dataIso(dados.agendadoPara) }); }
  async buscarLembrete(usuarioId, id) { const { data } = await this.executar(this.criarCliente().from('Lembrete').select(this.consultaLembrete()).eq('id', id).eq('usuarioId', usuarioId).maybeSingle()); return data; }
  async buscarLembretePorId(id) { const { data } = await this.executar(this.criarCliente().from('Lembrete').select(this.consultaLembrete()).eq('id', id).maybeSingle()); return data; }
  async atualizarLembrete(usuarioId, id, dados) { const campos = { ...dados, ...(dados.agendadoPara ? { agendadoPara: dataIso(dados.agendadoPara) } : {}) }; const { data } = await this.executar(this.criarCliente().from('Lembrete').update(campos).eq('id', id).eq('usuarioId', usuarioId).select(this.consultaLembrete()).maybeSingle()); return data; }
  async excluirLembrete(usuarioId, id) { const { data } = await this.executar(this.criarCliente().from('Lembrete').delete().eq('id', id).eq('usuarioId', usuarioId).select('id').maybeSingle()); return Boolean(data); }

  async buscarOuCriarConversa(usuarioId, telefone) {
    const existente = await this.buscarUm('Conversa', { usuarioId, telefone });
    if (existente) return existente;
    const agora = dataIso();
    try {
      return await this.inserir('Conversa', { id: criarId('conv'), usuarioId, telefone, criadoEm: agora, atualizadoEm: agora });
    } catch (erro) {
      if (erro.code === '23505') return this.buscarUm('Conversa', { usuarioId, telefone });
      throw erro;
    }
  }
  async atualizarConversa(id, dados) { const { data } = await this.executar(this.criarCliente().from('Conversa').update({ ...dados, atualizadoEm: dataIso() }).eq('id', id).select().maybeSingle()); return data; }
  async salvarMensagem(dados) { const agora = dataIso(); return this.inserir('Mensagem', { id: criarId('msg'), statusProcessamento: 'processado', criadoEm: agora, atualizadoEm: agora, ...dados, ...(dados.criadoEm ? { criadoEm: dataIso(dados.criadoEm) } : {}) }); }
  async buscarMensagemExterna(conversaId, identificadorMensagemExterna) { return this.buscarUm('Mensagem', { conversaId, identificadorMensagemExterna }); }
  async atualizarMensagem(id, dados) { const { data } = await this.executar(this.criarCliente().from('Mensagem').update({ ...dados, atualizadoEm: dataIso() }).eq('id', id).select().maybeSingle()); return data; }
  async iniciarExecucaoAcao(id, usuarioId, actionId) {
    const c = await this.buscarUm('Conversa', { id, usuarioId });
    if (!c || c.dadosPendentes?.actionId !== actionId || c.dadosPendentes?.stage !== 'confirm') return null;
    const { data } = await this.executar(this.criarCliente().from('Conversa')
      .update({ dadosPendentes: { ...c.dadosPendentes, stage: 'executing' }, atualizadoEm: dataIso() })
      .eq('id', id).eq('usuarioId', usuarioId).eq('dadosPendentes->>actionId', actionId).eq('dadosPendentes->>stage', 'confirm').select().maybeSingle());
    return data ? c.dadosPendentes : null;
  }
  async listarConversas(usuarioId) {
    const { data } = await this.executar(this.criarCliente().from('Conversa').select('*, mensagens:Mensagem(*)').eq('usuarioId', usuarioId).order('atualizadoEm', { ascending: false }));
    return data.map((conversa) => ({ ...conversa, mensagens: (conversa.mensagens || []).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm)).slice(0, 1) }));
  }
  async listarMensagens(usuarioId, conversaId) { const conversa = await this.buscarUm('Conversa', { id: conversaId, usuarioId }); if (!conversa) return null; const { data } = await this.executar(this.criarCliente().from('Mensagem').select('*').eq('conversaId', conversaId).order('criadoEm', { ascending: true })); return data; }
  async registrarEventoWebhook(dados) {
    try {
      const evento = await this.inserir('EventoWebhook', { id: criarId('whk'), recebidoEm: dataIso(), statusProcessamento: 'recebido', ...dados });
      return { duplicado: false, evento };
    } catch (erro) {
      if (erro.code !== '23505') throw erro;
      const evento = await this.buscarUm('EventoWebhook', { provedor: dados.provedor, identificadorEventoExterno: dados.identificadorEventoExterno });
      return { duplicado: true, evento };
    }
  }

  async listarConexoes(usuarioId) { const { data } = await this.executar(this.criarCliente().from('ConexaoCalendario').select('*').eq('usuarioId', usuarioId).order('provedor', { ascending: true })); return data; }
  async buscarConexao(usuarioId, provedor) { return this.buscarUm('ConexaoCalendario', { usuarioId, provedor }); }
  async salvarConexao(dados) {
    const existente = await this.buscarConexao(dados.usuarioId, dados.provedor);
    const agora = dataIso();
    const { id, criadoEm, atualizadoEm, ...campos } = dados;
    if (existente) {
      const { data } = await this.executar(this.criarCliente().from('ConexaoCalendario').update({ ...campos, atualizadoEm: agora }).eq('id', existente.id).eq('usuarioId', dados.usuarioId).select().single());
      return data;
    }
    return this.inserir('ConexaoCalendario', { id: criarId('cal'), status: 'conectado', criadoEm: agora, atualizadoEm: agora, ...campos });
  }
  async excluirConexao(usuarioId, provedor) { const { data } = await this.executar(this.criarCliente().from('ConexaoCalendario').delete().eq('usuarioId', usuarioId).eq('provedor', provedor).select('id').maybeSingle()); return Boolean(data); }
  async criarEventoCalendario(dados) { const agora = dataIso(); return this.inserir('EventoCalendario', { id: criarId('evt'), criadoEm: agora, atualizadoEm: agora, ...dados, dataInicio: dataIso(dados.dataInicio), dataFim: dataIso(dados.dataFim) }); }
  async listarEventosTarefa(usuarioId, tarefaId) { const { data } = await this.executar(this.criarCliente().from('EventoCalendario').select('*').eq('usuarioId', usuarioId).eq('tarefaId', tarefaId)); return data; }
  async atualizarEventoCalendario(usuarioId, id, dados) { const { data } = await this.executar(this.criarCliente().from('EventoCalendario').update({ ...dados, atualizadoEm: dataIso() }).eq('id', id).eq('usuarioId', usuarioId).select().maybeSingle()); return data; }
  async criarRegistroSincronizacao(dados) { return this.inserir('RegistroSincronizacao', { id: criarId('sync'), iniciadoEm: dataIso(), ...dados, ...(dados.finalizadoEm ? { finalizadoEm: dataIso(dados.finalizadoEm) } : {}) }); }
  async contarTarefas(usuarioId, filtros = {}) {
    let consulta = this.criarCliente().from('Tarefa').select('*', { count: 'exact', head: true }).eq('usuarioId', usuarioId);
    Object.entries(filtros).forEach(([campo, valor]) => { consulta = campo === 'dataEntregaAntes' ? consulta.lt('dataEntrega', valor) : consulta.eq(campo, valor); });
    return (await this.executar(consulta)).count || 0;
  }
  async estatisticas(usuarioId) {
    const agora = dataIso();
    const [total, pendentes, concluidas, atrasadas, provas] = await Promise.all([
      this.contarTarefas(usuarioId),
      this.contarTarefas(usuarioId, { status: 'pendente' }),
      this.contarTarefas(usuarioId, { status: 'concluida' }),
      this.contarTarefas(usuarioId, { status: 'pendente', dataEntregaAntes: agora }),
      this.executar(this.criarCliente().from('Tarefa').select('*').eq('usuarioId', usuarioId).eq('tipo', 'prova').eq('status', 'pendente').order('dataEntrega', { ascending: true }).limit(5))
    ]);
    return { total, pendentes, concluidas, atrasadas, provas: provas.data.map(normalizarTarefa) };
  }
}

const usarMemoria = process.env.USAR_BANCO_MEMORIA === 'true';
const repositorio = usarMemoria ? new RepositorioMemoria() : new RepositorioSupabase();

module.exports = { repositorio, criarClienteDados, RepositorioMemoria, RepositorioSupabase };
