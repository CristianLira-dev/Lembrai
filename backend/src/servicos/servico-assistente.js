const crypto = require('node:crypto');
const { z } = require('zod');
const { ServicoChatbot, codigoSeguroErroChatbot } = require('./servico-chatbot');
const { dataNoFuso, dataValida, horarioValido, dataHorarioNoFuso, somarDias, formatarData } = require('../utilitarios/datas');
const { normalizarTelefone } = require('../utilitarios/telefone');

const SEM_CONTA = 'Ainda não achei uma conta ligada a esse número. Cria a sua por aqui e depois me chama de novo: https://lembrai-chat.vercel.app/cadastro';
const FORA_ESCOPO = 'Esse assunto eu não consigo ajudar por aqui. Mas se quiser registrar uma atividade, concluir alguma ou ver suas pendências, é comigo!';
const FALHA = 'Não consegui fazer isso agora. Tenta de novo em instantes?';
const MUTACOES = ['create_task', 'create_subject', 'complete_task', 'edit_task', 'set_reminder_time'];
const CONSULTAS = ['list_pending', 'list_today', 'list_week', 'next_exam', 'list_overdue', 'list_subjects', 'get_reminder_time'];
const opcional = (max) => z.string().trim().max(max).nullable().optional();
const propostaSchema = z.object({
  intent: z.enum([...MUTACOES, ...CONSULTAS, 'unknown']),
  task: z.object({ title: opcional(180), subject: opcional(120), dueDate: opcional(10), dueTime: opcional(5), type: z.enum(['exam', 'assignment', 'task', 'class', 'appointment', 'other']).optional() }).nullable().optional(),
  reference: opcional(300), subject: opcional(120), reminderTime: opcional(5)
});

function normalizado(s = '') { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function telefoneLimpo(s = '') { return normalizarTelefone(s); }
function limpo(s) { return typeof s === 'string' ? s.replace(/[*_~\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim() : null; }
function comandoExplicito(texto) {
  const t = normalizado(texto).replace(/[.!?]+$/g, '').trim();
  if (/^(sim|s|confirmo|pode|pode sim|pode registrar|pode salvar|pode concluir|pode alterar|ok|confirmado|fechado)$/.test(t)) return 'confirm';
  if (/^(nao|n|cancelar|cancela|deixa pra la|nao quero)$/.test(t)) return 'cancel';
  return null;
}
function textoFallback(texto) { return { intent: comandoExplicito(texto) || 'unavailable', response: FALHA }; }
function dadosTarefa(t) {
  return Object.fromEntries(Object.entries(t || {}).filter(([k, v]) => ['title', 'subject', 'dueDate', 'dueTime', 'type'].includes(k) && v != null && v !== '').map(([k, v]) => [k, limpo(v)]));
}
function resumo(t) {
  return '*' + limpo(t.title) + '* — ' + limpo(t.subject) + ' — entrega ' + formatarData(t.dueDate) + (t.dueTime ? ' às ' + t.dueTime : '');
}
function tarefaDoBanco(t, fuso) { return { title: t.titulo, subject: t.materia, dueDate: dataNoFuso(t.dataEntrega, fuso), dueTime: t.horarioEntrega || null }; }
function perguntaFaltante(acao) {
  if (acao.intent === 'create_subject') return 'Qual é o nome da matéria?';
  if (acao.intent === 'set_reminder_time') return 'Qual horário você prefere para os lembretes? Use, por exemplo, 08:30.';
  if (acao.stage === 'select') return 'Qual das opções você quer? Envie o número.';
  if (acao.intent === 'complete_task' || (acao.intent === 'edit_task' && !acao.targetId)) return 'Qual atividade você quer alterar? Envie o nome e a matéria.';
  const t = acao.task || {};
  if (!t.title) return 'Qual é o nome da atividade?';
  if (!t.subject) return 'Qual é a matéria?';
  if (!dataValida(t.dueDate)) return 'Qual é a data de entrega? Use dia/mês/ano.';
  return 'O que você quer mudar: nome, data ou matéria?';
}

class ServicoAssistente {
  constructor({ repositorio, servicoTarefas, servicoWhatsapp, servicoChatbot = new ServicoChatbot() }) {
    Object.assign(this, { repositorio, servicoTarefas, servicoWhatsapp, servicoChatbot });
    this.emCurso = new Map();
  }

  async obterUsuarioPorTelefone(telefone) {
    const usuario = await this.repositorio.buscarUsuarioPorTelefone(telefoneLimpo(telefone));
    // Perfis provisórios criados por versões antigas não são contas cadastradas.
    return usuario && !usuario.email?.endsWith('@whatsapp.local') ? usuario : null;
  }

  async processarEntrada(entrada) {
    const chave = telefoneLimpo(entrada.telefone);
    const anterior = this.emCurso.get(chave) || Promise.resolve();
    const atual = anterior.catch(() => {}).then(() => this.processarSerial(entrada));
    this.emCurso.set(chave, atual);
    try { return await atual; } finally { if (this.emCurso.get(chave) === atual) this.emCurso.delete(chave); }
  }

  async guardar(conversa, acao) {
    await this.repositorio.atualizarConversa(conversa.id, { intencaoPendente: acao?.intent || null, dadosPendentes: acao || null });
  }

  async preparar(usuario, conversa, proposta, anterior = null) {
    const mesma = anterior?.intent === proposta.intent;
    const acao = {
      actionId: crypto.randomUUID(), createdAt: new Date().toISOString(),
      intent: proposta.intent, stage: 'collect',
      task: { ...(mesma ? anterior.task : {}), ...dadosTarefa(proposta.task) },
      subject: limpo(proposta.subject) || (mesma ? anterior.subject : null),
      reminderTime: proposta.reminderTime || (mesma ? anterior.reminderTime : null),
      reference: limpo(proposta.reference) || (mesma ? anterior.reference : null),
      targetId: mesma ? anterior.targetId : null
    };
    let resposta;
    if (acao.intent === 'create_task') {
      if (acao.task.title && acao.task.subject && dataValida(acao.task.dueDate)) {
        if (acao.task.dueTime && !horarioValido(acao.task.dueTime)) acao.task.dueTime = null;
        acao.stage = 'confirm';
        resposta = 'Vou registrar: ' + resumo(acao.task) + '. Confirma?';
      }
    } else if (acao.intent === 'create_subject' && acao.subject) {
      acao.stage = 'confirm';
      resposta = 'Vou registrar a matéria *' + acao.subject + '*. Confirma?';
    } else if (acao.intent === 'set_reminder_time' && horarioValido(acao.reminderTime)) {
      acao.stage = 'confirm';
      resposta = 'Vou mudar os lembretes para ' + acao.reminderTime + ', no seu fuso horário. Confirma?';
    } else if (['complete_task', 'edit_task'].includes(acao.intent)) {
      const tarefas = await this.servicoTarefas.listar(usuario.id, { status: 'pendente' });
      if (proposta.reference && anterior?.reference && normalizado(proposta.reference) !== normalizado(anterior.reference)) acao.targetId = null;
      let alvo = acao.targetId ? tarefas.find((t) => t.id === acao.targetId) : null;
      if (!alvo && acao.reference) {
        const palavras = normalizado(acao.reference).split(/\W+/).filter((p) => p && !['o', 'a', 'os', 'as', 'de', 'da', 'do', 'em', 'atividade'].includes(p));
        const candidatos = palavras.length ? tarefas.filter((t) => palavras.every((p) => normalizado(t.titulo + ' ' + (t.materia || '')).includes(p))) : [];
        if (candidatos.length === 1) alvo = candidatos[0];
        else if (candidatos.length > 1) {
          acao.stage = 'select';
          acao.options = candidatos.slice(0, 8).map((t) => t.id);
          resposta = 'Qual delas?\n' + candidatos.slice(0, 8).map((t, i) => (i + 1) + '. ' + resumo(tarefaDoBanco(t, usuario.fusoHorario))).join('\n');
          if (candidatos.length > 8) resposta += '\nHá mais opções; informe a matéria para filtrar.';
        } else resposta = 'Não encontrei essa atividade nas suas pendências. Qual é o nome e a matéria?';
      }
      if (alvo) {
        acao.targetId = alvo.id;
        acao.baseVersion = new Date(alvo.atualizadoEm).toISOString();
        const atual = tarefaDoBanco(alvo, usuario.fusoHorario);
        if (acao.intent === 'complete_task') {
          acao.task = atual;
          acao.stage = 'confirm';
          resposta = 'Vou concluir: ' + resumo(atual) + '. Confirma?';
        } else {
          // Somente campos presentes na proposta podem modificar a atividade.
          const mudancas = Object.fromEntries(Object.entries(acao.task).filter(([k]) => ['title', 'subject', 'dueDate', 'dueTime'].includes(k)));
          acao.task = mudancas;
          const nova = { ...atual, ...mudancas };
          if (Object.keys(mudancas).length && nova.title && nova.subject && dataValida(nova.dueDate) && (!nova.dueTime || horarioValido(nova.dueTime))) {
            acao.stage = 'confirm';
            resposta = 'Vou alterar ' + '*' + limpo(atual.title) + '*' + ' para: ' + resumo(nova) + '. Confirma?';
          }
        }
      }
    }
    await this.guardar(conversa, acao);
    return resposta || perguntaFaltante(acao);
  }

  async executar(usuario, conversa, acao) {
    if (Date.now() - Date.parse(acao.createdAt) > 30 * 60000) {
      await this.guardar(conversa, null);
      return 'Essa confirmação expirou. Me envie a atividade de novo para conferir os dados.';
    }
    if (acao.targetId) {
      const alvo = await this.repositorio.buscarTarefa(usuario.id, acao.targetId);
      if (!alvo || alvo.status !== 'pendente') { await this.guardar(conversa, null); return 'Essa atividade não está mais pendente.'; }
      if (new Date(alvo.atualizadoEm).toISOString() !== acao.baseVersion) {
        return this.preparar(usuario, conversa, { intent: acao.intent, task: acao.intent === 'edit_task' ? acao.task : null }, acao);
      }
    }
    const reservada = await this.repositorio.iniciarExecucaoAcao(conversa.id, usuario.id, acao.actionId);
    if (!reservada) return 'Essa confirmação já foi recebida.';
    let resposta;
    let proxima = null;
    try {
      if (acao.intent === 'create_task') {
        const resultado = await this.servicoTarefas.criar(usuario.id, { ...acao.task, timezone: usuario.fusoHorario }, { idTarefa: acao.actionId, horarioPadrao: true, sincronizarCalendario: true });
        resposta = 'Fechou, registrado!';
        if (resultado.avisos.length) resposta += ' ' + resultado.avisos.join(' ') + ' Tenta ajustar de novo em instantes.';
        else if (!resultado.lembreteAgendado) resposta += ' O prazo está próximo ou passou; não há um horário de lembrete futuro antes da entrega.';
        if (!usuario.preferenciaLembretesPerguntada) {
          await this.repositorio.atualizarUsuario(usuario.id, { preferenciaLembretesPerguntada: true });
          resposta += '\nOs lembretes chegam às ' + (usuario.horarioLembretes || '07:27') + '. Quer mudar esse horário?';
          proxima = { intent: 'set_reminder_time', stage: 'ask_time', actionId: crypto.randomUUID(), createdAt: new Date().toISOString() };
        }
      } else if (acao.intent === 'create_subject') {
        await this.repositorio.criarMateria(usuario.id, acao.subject);
        resposta = 'Fechou, matéria registrada!';
      } else if (acao.intent === 'complete_task') {
        const r = await this.servicoTarefas.concluir(usuario.id, acao.targetId);
        resposta = 'Fechou, atividade concluída!' + (r.avisos?.length ? ' ' + r.avisos.join(' ') : '');
      } else if (acao.intent === 'edit_task') {
        const dados = {};
        if (acao.task.title) dados.titulo = acao.task.title;
        if (acao.task.subject) dados.materia = acao.task.subject;
        if (acao.task.dueDate || acao.task.dueTime) {
          const atual = await this.repositorio.buscarTarefa(usuario.id, acao.targetId);
          dados.dataEntrega = dataHorarioNoFuso(acao.task.dueDate || dataNoFuso(atual.dataEntrega, usuario.fusoHorario), acao.task.dueTime || atual.horarioEntrega || '23:59', usuario.fusoHorario);
          if (acao.task.dueTime) dados.horarioEntrega = acao.task.dueTime;
        }
        const r = await this.servicoTarefas.atualizar(usuario.id, acao.targetId, dados);
        resposta = 'Fechou, atividade atualizada!' + (r.avisos?.length ? ' ' + r.avisos.join(' ') : '');
      } else if (acao.intent === 'set_reminder_time') {
        await this.servicoTarefas.alterarHorario(usuario.id, acao.reminderTime);
        resposta = 'Fechou, os lembretes agora chegam às ' + acao.reminderTime + '!';
      }
      await this.guardar(conversa, proxima);
      return resposta;
    } catch {
      // Mesma actionId na repetição: criações são idempotentes.
      await this.guardar(conversa, { ...acao, stage: 'confirm' });
      return 'Não consegui finalizar tudo agora. Confirma de novo para eu tentar concluir?';
    }
  }

  async consultar(usuario, conversa, intent, agora) {
    if (intent === 'get_reminder_time') {
      await this.guardar(conversa, { intent: 'set_reminder_time', stage: 'ask_time', actionId: crypto.randomUUID(), createdAt: new Date().toISOString() });
      return 'Os lembretes chegam às ' + (usuario.horarioLembretes || '07:27') + '. Quer mudar esse horário?';
    }
    if (intent === 'list_subjects') {
      const lista = await this.repositorio.listarMaterias(usuario.id);
      return lista.length ? lista.map((m) => '• ' + limpo(m.nome)).join('\n') : 'Você ainda não tem matérias registradas.';
    }
    let lista = await this.servicoTarefas.listar(usuario.id, { status: 'pendente' });
    const hoje = dataNoFuso(agora, usuario.fusoHorario);
    if (intent === 'list_today') lista = lista.filter((t) => dataNoFuso(t.dataEntrega, usuario.fusoHorario) === hoje);
    if (intent === 'list_week') {
      const diaSemana = new Date(hoje + 'T12:00:00Z').getUTCDay();
      const inicio = somarDias(hoje, -((diaSemana + 6) % 7));
      const fim = somarDias(inicio, 7);
      lista = lista.filter((t) => { const d = dataNoFuso(t.dataEntrega, usuario.fusoHorario); return d >= inicio && d < fim; });
    }
    if (intent === 'list_overdue') lista = lista.filter((t) => new Date(t.dataEntrega) < agora);
    if (intent === 'next_exam') lista = lista.filter((t) => t.tipo === 'prova' && new Date(t.dataEntrega) >= agora).slice(0, 1);
    if (!lista.length) return 'Não encontrei pendências para esse período.';
    return lista.slice(0, 12).map((t) => '• ' + resumo(tarefaDoBanco(t, usuario.fusoHorario))).join('\n')
      + (lista.length > 12 ? '\nHá mais pendências; consulte por período ou veja todas no site.' : '');
  }

  async processarSerial({ telefone, texto, identificadorExterno, recebidoEm = new Date() }) {
    // Identidade só vem do telefone verificado no webhook, nunca do conteúdo/LLM.
    const usuario = await this.obterUsuarioPorTelefone(telefone);
    if (!usuario) { await this.servicoWhatsapp.enviarResposta(telefone, SEM_CONTA); return { resposta: SEM_CONTA }; }
    const conversa = await this.repositorio.buscarOuCriarConversa(usuario.id, telefoneLimpo(telefone));
    if (identificadorExterno) {
      const existente = await this.repositorio.buscarMensagemExterna(conversa.id, identificadorExterno);
      if (existente) {
        if (existente.statusProcessamento !== 'respondido' && existente.metadados?.response) {
          await this.servicoWhatsapp.enviarResposta(telefone, existente.metadados.response);
          await this.repositorio.atualizarMensagem(existente.id, { statusProcessamento: 'respondido' });
          return { duplicado: true, reenviado: true, resposta: existente.metadados.response };
        }
        return { duplicado: true };
      }
    }
    const mensagem = await this.repositorio.salvarMensagem({ conversaId: conversa.id, identificadorMensagemExterna: identificadorExterno || null, direcao: 'entrada', conteudo: texto, tipoMensagem: 'texto', statusProcessamento: 'processando' });
    const pendente = conversa.dadosPendentes?.stage ? structuredClone(conversa.dadosPendentes) : null;
    const comando = comandoExplicito(texto);
    let resposta;
    let interpretacao;
    try {
      if (comando === 'cancel') {
        await this.guardar(conversa, null);
        resposta = pendente?.intent === 'set_reminder_time' ? 'Tranquilo, mantive o horário dos lembretes.' : 'Tranquilo, não fiz nenhuma alteração.';
      } else if (comando === 'confirm') {
        if (pendente?.stage === 'ask_time') {
          await this.guardar(conversa, { ...pendente, stage: 'collect' });
          resposta = perguntaFaltante(pendente);
        } else if (pendente?.stage === 'confirm') resposta = await this.executar(usuario, conversa, pendente);
        else resposta = pendente ? perguntaFaltante(pendente) : 'Não há nada aguardando confirmação. O que você quer registrar ou consultar?';
      } else if (pendente?.stage === 'select' && /^\d+$/.test(texto.trim())) {
        const id = pendente.options[Number(texto.trim()) - 1];
        resposta = id ? await this.preparar(usuario, conversa, { intent: pendente.intent, task: pendente.task }, { ...pendente, targetId: id }) : 'Escolha um dos números da lista.';
      } else {
        const [tarefas, materias] = await Promise.all([this.repositorio.listarTarefas(usuario.id, { status: 'pendente' }), this.repositorio.listarMaterias(usuario.id)]);
        try {
          interpretacao = await this.servicoChatbot.processar({
            user: { id: usuario.id, name: 'Estudante', timezone: usuario.fusoHorario },
            conversation: { id: conversa.id },
            message: { id: mensagem.id, content: texto, receivedAt: new Date(recebidoEm).toISOString() },
            context: { pendingAction: pendente, recentTasks: tarefas.slice(0, 50).map((t) => ({ titulo: t.titulo, materia: t.materia, dataEntrega: t.dataEntrega, horarioEntrega: t.horarioEntrega, status: t.status })), subjects: materias.map((m) => m.nome), reminderTime: usuario.horarioLembretes || '07:27' }
          });
        } catch (erro) {
          interpretacao = textoFallback(texto);
          interpretacao.generation = {
            provider: 'chatbot',
            status: 'fallback',
            errorCode: codigoSeguroErroChatbot(erro)
          };
        }
        const proposta = propostaSchema.safeParse(interpretacao);
        if (interpretacao.intent === 'unavailable') resposta = FALHA;
        else if (!proposta.success || proposta.data.intent === 'unknown') resposta = FORA_ESCOPO;
        else if (CONSULTAS.includes(proposta.data.intent)) resposta = await this.consultar(usuario, conversa, proposta.data.intent, new Date(recebidoEm));
        else resposta = await this.preparar(usuario, conversa, proposta.data, pendente);
      }
    } catch { resposta = FALHA; }
    await this.repositorio.atualizarMensagem(mensagem.id, { statusProcessamento: 'processado', metadados: { generation: interpretacao?.generation || null, response: resposta } });
    await this.repositorio.salvarMensagem({ conversaId: conversa.id, direcao: 'saida', conteudo: resposta, statusProcessamento: 'processado' });
    try {
      await this.servicoWhatsapp.enviarResposta(telefone, resposta);
      await this.repositorio.atualizarMensagem(mensagem.id, { statusProcessamento: 'respondido' });
    } catch (erro) {
      await this.repositorio.atualizarMensagem(mensagem.id, { statusProcessamento: 'falhou' });
      throw erro;
    }
    return { resposta, interpretacao };
  }
}
module.exports = { ServicoAssistente, telefoneLimpo, textoFallback, comandoExplicito, FORA_ESCOPO, SEM_CONTA };
