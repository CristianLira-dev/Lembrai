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
  return hojeNoHorario > agora
    ? hojeNoHorario
    : dataHorarioNoFuso(somarDias(hoje, 1), horario, fuso);
}

function proximoResumoBienal(usuario, agora = new Date()) {
  const fuso = fusoDoUsuario(usuario);
  return dataHorarioNoFuso(somarDias(dataNoFuso(agora, fuso), 2), horarioDoUsuario(usuario), fuso);
}

function formatarPrazo(dataEntrega, horarioEntrega, fuso) {
  const partes = partesNoFuso(dataEntrega, fuso);
  const data = partes.day + '/' + partes.month + '/' + partes.year;
  const horario = horarioEntrega || partes.hour + ':' + partes.minute;
  return data + ' às ' + horario;
}

function formatarResumoPendencias(tarefas, usuario) {
  const fuso = fusoDoUsuario(usuario);
  const itens = tarefas.map((tarefa, indice) => {
    const materia = tarefa.materia ? '\n   Matéria: ' + tarefa.materia : '';
    return (indice + 1) + '. *' + tarefa.titulo + '*' + materia + '\n   Entrega: ' + formatarPrazo(tarefa.dataEntrega, tarefa.horarioEntrega, fuso);
  });
  return '📚 Suas atividades pendentes:\n\n' + itens.join('\n\n') + '\n\nQuando concluir alguma, me avisa por aqui!';
}

module.exports = { proximoResumoInicial, proximoResumoBienal, formatarResumoPendencias };
