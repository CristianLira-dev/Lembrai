const jwt = require('jsonwebtoken');
const ambiente = require('../configuracao/ambiente');
const { obterProvedor } = require('../integracoes/calendarios/provedores-calendario');
const { criptografar, descriptografar } = require('../utilitarios/seguranca');

class ServicoCalendarios {
  constructor(repositorio) {
    this.repositorio = repositorio;
  }

  async listarConexoes(usuarioId) {
    const conexoes = await this.repositorio.listarConexoes(usuarioId);
    const porProvedor = new Map(conexoes.map((item) => [item.provedor, item]));
    return ['google', 'outlook', 'ics'].map((provedor) => ({
      provedor,
      status: porProvedor.get(provedor)?.status || (provedor === 'ics' ? 'disponivel' : (obterProvedor(provedor).disponivel() ? 'disponivel' : 'configuracao_pendente')),
      emailConta: porProvedor.get(provedor)?.emailConta || null,
      ultimoSincronismoEm: porProvedor.get(provedor)?.ultimoSincronismoEm || null
    }));
  }

  iniciarOAuth(usuarioId, provedor) {
    const adaptador = obterProvedor(provedor);
    const estado = jwt.sign({ usuarioId, provedor }, ambiente.jwtSegredo, { expiresIn: '10m' });
    return { url: adaptador.urlAutorizacao(estado), estado, disponivel: Boolean(adaptador.urlAutorizacao(estado)) };
  }

  async concluirOAuth(codigo, estado) {
    const dados = jwt.verify(estado, ambiente.jwtSegredo);
    const adaptador = obterProvedor(dados.provedor);
    const tokens = await adaptador.trocarCodigo(codigo);
    return this.repositorio.salvarConexao({ usuarioId: dados.usuarioId, provedor: dados.provedor, emailConta: tokens.emailConta || null, tokenAcessoCriptografado: criptografar(tokens.accessToken), tokenAtualizacaoCriptografado: criptografar(tokens.refreshToken), expiraEm: tokens.expiraEm, status: 'conectado' });
  }

  async conectarSimulado(usuarioId, provedor) {
    const adaptador = obterProvedor(provedor);
    const tokens = await adaptador.trocarCodigo('simulado');
    return this.repositorio.salvarConexao({ usuarioId, provedor, emailConta: tokens.emailConta, tokenAcessoCriptografado: criptografar(tokens.accessToken), tokenAtualizacaoCriptografado: criptografar(tokens.refreshToken), status: 'conectado' });
  }

  async desconectar(usuarioId, provedor) { return this.repositorio.excluirConexao(usuarioId, provedor); }

  async sincronizar(usuarioId, provedor) {
    const conexao = await this.repositorio.buscarConexao(usuarioId, provedor);
    if (!conexao) { const erro = new Error('Calendário não conectado'); erro.statusCode = 404; throw erro; }
    const adaptador = obterProvedor(provedor);
    const resultado = await adaptador.sincronizar({ accessToken: descriptografar(conexao.tokenAcessoCriptografado) });
    await this.repositorio.criarRegistroSincronizacao({ usuarioId, provedor, operacao: 'sincronizar', status: 'concluida', mensagemErro: null, finalizadoEm: new Date() });
    await this.repositorio.salvarConexao({ ...conexao, ultimoSincronismoEm: new Date(), status: 'conectado' });
    return resultado;
  }

  async criarEventoParaTarefa(usuarioId, tarefa) {
    if ((await this.repositorio.listarEventosTarefa(usuarioId, tarefa.id)).length) return this.atualizarEventoParaTarefa(usuarioId, tarefa);
    const conexoes = await this.repositorio.listarConexoes(usuarioId);
    if (!conexoes.length) return { sincronizado: false, motivo: 'nenhum_calendario_conectado' };
    const conexao = conexoes.find((item) => item.status === 'conectado');
    if (!conexao) return { sincronizado: false, motivo: 'nenhum_calendario_ativo' };
    const inicio = new Date(tarefa.dataEntrega);
    const fim = new Date(inicio.getTime() + (tarefa.duracao || 60) * 60 * 1000);
    const adaptador = obterProvedor(conexao.provedor);
    const evento = await adaptador.criarEvento({ titulo: tarefa.titulo, descricao: tarefa.descricao, dataInicio: inicio.toISOString(), dataFim: fim.toISOString(), fusoHorario: 'America/Sao_Paulo' }, { accessToken: descriptografar(conexao.tokenAcessoCriptografado) });
    await this.repositorio.criarEventoCalendario({ usuarioId, tarefaId: tarefa.id, provedor: conexao.provedor, identificadorEventoExterno: evento.externalEventId, identificadorCalendario: evento.calendarId, dataInicio: inicio, dataFim: fim, fusoHorario: 'America/Sao_Paulo', statusSincronizacao: 'sincronizado', ultimoSincronismoEm: new Date() });
    return { sincronizado: true, provedor: conexao.provedor, evento };
  }

  async atualizarEventoParaTarefa(usuarioId, tarefa) {
    const eventos = await this.repositorio.listarEventosTarefa(usuarioId, tarefa.id);
    if (!eventos.length) return { sincronizado: false, motivo: 'nenhum_evento_externo' };
    const usuario = await this.repositorio.buscarUsuarioPorId(usuarioId);
    for (const evento of eventos) {
      const conexao = await this.repositorio.buscarConexao(usuarioId, evento.provedor);
      if (!conexao || conexao.status !== 'conectado') continue;
      const inicio = new Date(tarefa.dataEntrega);
      const fim = new Date(inicio.getTime() + (tarefa.duracao || 60) * 60000);
      await obterProvedor(evento.provedor).atualizarEvento(evento.identificadorEventoExterno, {
        titulo: (tarefa.status === 'concluida' ? '[Concluída] ' : '') + tarefa.titulo,
        descricao: tarefa.descricao || '', dataInicio: inicio.toISOString(), dataFim: fim.toISOString(),
        fusoHorario: usuario.fusoHorario || 'America/Sao_Paulo'
      }, { accessToken: descriptografar(conexao.tokenAcessoCriptografado) }, evento.identificadorCalendario);
      await this.repositorio.atualizarEventoCalendario(usuarioId, evento.id, { dataInicio: inicio.toISOString(), dataFim: fim.toISOString(), statusSincronizacao: 'sincronizado', ultimoSincronismoEm: new Date().toISOString() });
    }
    return { sincronizado: true };
  }
}

module.exports = { ServicoCalendarios };
