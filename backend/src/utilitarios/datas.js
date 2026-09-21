function partesNoFuso(valor, fuso = 'America/Sao_Paulo') {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(valor)).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
}
function dataNoFuso(valor, fuso) { const p = partesNoFuso(valor, fuso); return p.year + '-' + p.month + '-' + p.day; }
function dataValida(data) {
  return typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)
    && Number(data.slice(0, 4)) >= 2000 && Number(data.slice(0, 4)) <= 2100
    && !Number.isNaN(Date.parse(data)) && new Date(data + 'T12:00:00Z').toISOString().slice(0, 10) === data;
}
function horarioValido(hora) { return typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora); }
function dataHorarioNoFuso(data, horario = '23:59', fuso = 'America/Sao_Paulo') {
  if (!dataValida(data) || !horarioValido(horario)) throw new Error('Data ou horário inválido');
  const alvo = Date.parse(data + 'T' + horario + ':00Z');
  let instante = alvo;
  for (let i = 0; i < 3; i += 1) {
    const p = partesNoFuso(instante, fuso);
    const parede = Date.parse(p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':00Z');
    instante += alvo - parede;
  }
  const p = partesNoFuso(instante, fuso);
  if (dataNoFuso(instante, fuso) !== data || p.hour + ':' + p.minute !== horario) throw new Error('Horário inexistente no fuso');
  return new Date(instante);
}
function somarDias(data, dias) { const d = new Date(data + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); }
function formatarData(data) { return data.split('-').reverse().join('/'); }
module.exports = { partesNoFuso, dataNoFuso, dataValida, horarioValido, dataHorarioNoFuso, somarDias, formatarData };
