const { dataNoFuso, dataHorarioNoFuso, partesNoFuso, somarDias } = require('./datas');

function horarioDoUsuario(usuario) {
  return usuario.horarioLembretes || '07:27';
}

function fusoDoUsuario(usuario) {
  return usuario.fusoHorario || 'America/Sao_Paulo';
}

function proximoResumoInicial(usuario, agora = new Date()) {
  const fuso = fusoDoUsuario(usuario);
  const horario = horarioDoUsuario(usuario);
  const hoje = dataNoFuso(agora, fuso);
  const hojeNoHorario = dataHorarioNoFuso(hoje, horario, fuso);
  return hojeNoHorario > agora ? hojeNoHorario : dataHorarioNoFuso(somarDias(hoje, 1), horario, fuso);
}

function proximoResumoDiario(usuario, agora = new Date()) {
  const fuso = fusoDoUsuario(usuario);
  let data = somarDias(dataNoFuso(agora, fuso), 1);
  if (usuario.frequenciaResumo === 'dias_uteis') {
    while ([0, 6].includes(new Date(`${data}T12:00:00Z`).getUTCDay())) data = somarDias(data, 1);
  }
  return dataHorarioNoFuso(data, horarioDoUsuario(usuario), fuso);
}

function formatarPrazo(dataEntrega, horarioEntrega, fuso) {
  const partes = partesNoFuso(dataEntrega, fuso);
  const data = partes.day + '/' + partes.month + '/' + partes.year;
  const horario = horarioEntrega || partes.hour + ':' + partes.minute;
  return data + ' às ' + horario;
}

function formatarResumoPendencias(tarefas, usuario) {
  const fuso = fusoDoUsuario(usuario);
  const quebra = String.fromCharCode(10);
  const separador = quebra + quebra;
  const itens = tarefas.map((tarefa, indice) => {
    const materia = tarefa.materia ? quebra + '   Matéria: ' + tarefa.materia : '';
    return (indice + 1) + '. *' + tarefa.titulo + '*' + materia + quebra + '   Entrega: ' + formatarPrazo(tarefa.dataEntrega, tarefa.horarioEntrega, fuso);
  });
  return '📚 Suas atividades pendentes:' + separador + itens.join(separador) + separador + 'Quando concluir alguma, me avisa por aqui!';
}

function formatarAvisoTarefasAtrasadas(tarefas, usuario, agora = new Date()) {
  const fuso = fusoDoUsuario(usuario);
  const hoje = dataNoFuso(agora, fuso);
  const atrasadas = tarefas.filter((tarefa) => dataNoFuso(tarefa.dataEntrega, fuso) < hoje);
  if (!atrasadas.length) return null;

  const quebra = String.fromCharCode(10);
  const separador = quebra + quebra;
  const itens = atrasadas.map((tarefa, indice) => {
    const materia = tarefa.materia ? quebra + '   Matéria: ' + tarefa.materia : '';
    return (indice + 1) + '. *' + tarefa.titulo + '*' + materia + quebra + '   Prazo: ' + formatarPrazo(tarefa.dataEntrega, tarefa.horarioEntrega, fuso);
  });

  return '⚠️ Estas atividades ainda aparecem como pendentes, mas o prazo já passou:' + separador + itens.join(separador) + separador + 'Você conseguiu concluir alguma delas? Se sim, me avisa por aqui!';
}

module.exports = {
  proximoResumoInicial,
  proximoResumoDiario,
  formatarResumoPendencias,
  formatarAvisoTarefasAtrasadas
};
