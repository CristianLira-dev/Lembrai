const { dataNoFuso, dataValida, somarDias } = require('../utilitarios/datas');

const TIPOS = [
  ['prova', 'exam', 'Prova'],
  ['trabalho', 'assignment', 'Trabalho'],
  ['tarefa', 'task', 'Tarefa'],
  ['atividade', 'task', 'Atividade'],
  ['seminario', 'other', 'Seminário'],
  ['aula', 'class', 'Aula']
];
const DIAS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

function normalizado(valor = '') {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function titulo(valor) {
  return String(valor).trim().split(/\s+/).map((palavra) =>
    palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1).toLocaleLowerCase('pt-BR')
  ).join(' ');
}

function extrairHorario(texto) {
  const achado = String(texto).match(/(?:\b(?:as|a)\s*)?(\d{1,2})(?:h|:)(\d{2})?\b/i);
  if (!achado) return null;
  const hora = Number(achado[1]);
  const minuto = Number(achado[2] || 0);
  return hora <= 23 && minuto <= 59 ? `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}` : null;
}

function extrairData(texto, recebidoEm, fuso) {
  const baixo = normalizado(texto);
  const hoje = dataNoFuso(recebidoEm, fuso);
  if (/\bdepois de amanha\b/.test(baixo)) return somarDias(hoje, 2);
  if (/\bamanha\b/.test(baixo)) return somarDias(hoje, 1);
  if (/\bhoje\b/.test(baixo)) return hoje;

  const completa = baixo.match(/\b(?:dia\s*)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (completa) {
    let ano = completa[3] ? Number(completa[3]) : Number(hoje.slice(0, 4));
    if (ano < 100) ano += 2000;
    let data = `${ano}-${String(Number(completa[2])).padStart(2, '0')}-${String(Number(completa[1])).padStart(2, '0')}`;
    if (!completa[3] && dataValida(data) && data < hoje) data = `${ano + 1}${data.slice(4)}`;
    return dataValida(data) ? data : null;
  }

  const somenteDia = baixo.match(/\bdia\s+(\d{1,2})\b/);
  if (somenteDia) {
    const base = new Date(`${hoje}T12:00:00Z`);
    let ano = base.getUTCFullYear();
    let mes = base.getUTCMonth() + 1;
    let data = `${ano}-${String(mes).padStart(2, '0')}-${String(Number(somenteDia[1])).padStart(2, '0')}`;
    if (dataValida(data) && data < hoje) {
      mes += 1;
      if (mes === 13) { mes = 1; ano += 1; }
      data = `${ano}-${String(mes).padStart(2, '0')}-${String(Number(somenteDia[1])).padStart(2, '0')}`;
    }
    return dataValida(data) ? data : null;
  }

  for (const [nome, indice] of Object.entries(DIAS)) {
    if (!new RegExp(`\\b${nome}(?:-feira)?\\b`).test(baixo)) continue;
    const atual = new Date(`${hoje}T12:00:00Z`).getUTCDay();
    let dias = (indice - atual + 7) % 7;
    if (/semana que vem|proxim[ao]/.test(baixo) && dias === 0) dias = 7;
    return somarDias(hoje, dias);
  }
  return null;
}

function extrairMateria(texto) {
  const achado = String(texto).match(/\b(?:de|da|do)\s+(.+?)(?=\s+(?:para|no dia|dia\s+\d|amanh[ãa]|hoje|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|às|as\s+\d|\d{1,2}[/:])|$)/i);
  if (!achado) return null;
  return titulo(achado[1].trim().replace(/[.,!?;]+$/g, ''));
}

function interpretarLocal({ texto, recebidoEm = new Date(), fuso = 'America/Sao_Paulo', pendente = null }) {
  const baixo = normalizado(texto);
  if (/\b(pendencias|pendentes)\b/.test(baixo) || baixo === 'minha agenda' || baixo === 'minhas tarefas') return { intent: 'list_pending' };
  if (/^(?:o que tenho|tarefas|agenda|atividades|pendencias).*hoje/.test(baixo)) return { intent: 'list_today' };
  if (/^(?:o que tenho|tarefas|agenda|atividades|pendencias).*semana/.test(baixo)) return { intent: 'list_week' };
  if (/\batrasad[ao]s?\b/.test(baixo)) return { intent: 'list_overdue' };

  const tipoEncontrado = TIPOS.find(([palavra]) => new RegExp(`\\b${palavra}\\b`).test(baixo));
  if (!tipoEncontrado && pendente?.intent !== 'create_task') return { intent: 'unknown' };

  const existente = pendente?.task || {};
  const task = {};
  const data = extrairData(texto, recebidoEm, fuso);
  const horario = extrairHorario(texto);
  if (data) task.dueDate = data;
  if (horario) task.dueTime = horario;

  if (tipoEncontrado) {
    task.type = tipoEncontrado[1];
    task.title = tipoEncontrado[2];
    const materia = extrairMateria(texto);
    if (materia) task.subject = materia;
  } else if (!existente.title) task.title = String(texto).trim();
  else if (!existente.subject && !data) task.subject = titulo(texto);

  return { intent: 'create_task', task, requiresConfirmation: true };
}

module.exports = { interpretarLocal, extrairData, extrairHorario, extrairMateria };
