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

  async tokensValidos(conexao, adaptador) {
    const tokens = { accessToken: descriptografar(conexao.tokenAcessoCriptografado), refreshToken: descriptografar(conexao.tokenAtualizacaoCriptografado) };
    if (!conexao.expiraEm || new Date(conexao.expiraEm).getTime() > Date.now() + 60000 || !tokens.refreshToken || !adaptador.renovarToken) return tokens;
    const novos = await adaptador.renovarToken(tokens.refreshToken);
    await this.repositorio.salvarConexao({ ...conexao, tokenAcessoCriptografado: criptografar(novos.accessToken), tokenAtualizacaoCriptografado: criptografar(novos.refreshToken), expiraEm: novos.expiraEm });
    return novos;
  }

  async sincronizar(usuarioId, provedor) {
    const conexao = await this.repositorio.buscarConexao(usuarioId, provedor);
    if (!conexao) { const erro = new Error('Calendário não conectado'); erro.statusCode = 404; throw erro; }
    const adaptador = obterProvedor(provedor);
    const tokens = await this.tokensValidos(conexao, adaptador);
    const respostaExterna = await adaptador.sincronizar(tokens, conexao.ultimoSincronismoEm ? new Date(conexao.ultimoSincronismoEm) : undefined);
    const externos = Array.isArray(respostaExterna) ? respostaExterna : [];
    let alterados = 0;
    for (const externo of externos || []) {
      const mapeado = await this.repositorio.buscarEventoExterno(usuarioId, provedor, externo.id);
      if (!mapeado || externo.cancelado) continue;
      const tarefa = await this.repositorio.buscarTarefa(usuarioId, mapeado.tarefaId);
      if (!tarefa || !externo.inicio) continue;
      if (!mapeado.ultimoSincronismoEm || new Date(externo.atualizadoEm || 0) > new Date(mapeado.ultimoSincronismoEm)) {
        await this.repositorio.atualizarTarefa(usuarioId, tarefa.id, { titulo: externo.titulo || tarefa.titulo, descricao: externo.descricao, dataEntrega: new Date(externo.inicio) });
        alterados += 1;
      }
    }
    const resultado = { alterados, recebidos: externos?.length || 0 };
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
    const evento = await adaptador.criarEvento({ titulo: tarefa.titulo, descricao: tarefa.descricao, dataInicio: inicio.toISOString(), dataFim: fim.toISOString(), fusoHorario: 'America/Sao_Paulo' }, await this.tokensValidos(conexao, adaptador));
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
      }, await this.tokensValidos(conexao, obterProvedor(evento.provedor)), evento.identificadorCalendario);
      await this.repositorio.atualizarEventoCalendario(usuarioId, evento.id, { dataInicio: inicio.toISOString(), dataFim: fim.toISOString(), statusSincronizacao: 'sincronizado', ultimoSincronismoEm: new Date().toISOString() });
    }
    return { sincronizado: true };
  }

  async removerEventoParaTarefa(usuarioId, tarefaId) {
    const eventos = await this.repositorio.listarEventosTarefa(usuarioId, tarefaId);
    for (const evento of eventos) {
      const conexao = await this.repositorio.buscarConexao(usuarioId, evento.provedor);
      if (conexao) {
        const adaptador = obterProvedor(evento.provedor);
        await adaptador.excluirEvento?.(evento.identificadorEventoExterno, await this.tokensValidos(conexao, adaptador), evento.identificadorCalendario);
      }
      await this.repositorio.excluirEventoCalendario(usuarioId, evento.id);
    }
    return { removidos: eventos.length };
  }
}

module.exports = { ServicoCalendarios };
