const axios = require('axios');
const ambiente = require('../../configuracao/ambiente');

class ProvedorCalendarioSimulado {
  constructor(nome) { this.nome = nome; }
  disponivel() { return true; }
  urlAutorizacao() { return null; }
  async trocarCodigo() { return { accessToken: `simulado-${this.nome}`, refreshToken: null, expiraEm: null, emailConta: `conta-${this.nome}@exemplo.local` }; }
  async criarEvento(evento) { return { externalEventId: `simulado-${Date.now()}`, calendarId: 'principal', ...evento }; }
  async atualizarEvento(id, evento) { return { externalEventId: id, ...evento }; }
  async excluirEvento() { return { removido: true }; }
  async sincronizar() { return { alterados: 0, ignorados: 0, modo: 'simulado' }; }
}

class ProvedorGoogleCalendar {
  async atualizarEvento(id, evento, tokens, calendarId = 'primary') {
    const resposta = await axios.patch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}`, { summary: evento.titulo, description: evento.descricao, start: { dateTime: evento.dataInicio, timeZone: evento.fusoHorario }, end: { dateTime: evento.dataFim, timeZone: evento.fusoHorario } }, { timeout: 10000, headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    return { externalEventId: resposta.data.id };
  }
  disponivel() { return Boolean(ambiente.google.clientId && ambiente.google.clientSecret); }
  urlAutorizacao(estado) {
    if (!this.disponivel()) return null;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: ambiente.google.clientId, redirect_uri: ambiente.google.redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'https://www.googleapis.com/auth/calendar.events', state: estado }).toString();
    return url.toString();
  }
  async trocarCodigo(codigo) {
    const resposta = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({ code: codigo, client_id: ambiente.google.clientId, client_secret: ambiente.google.clientSecret, redirect_uri: ambiente.google.redirectUri, grant_type: 'authorization_code' }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return { accessToken: resposta.data.access_token, refreshToken: resposta.data.refresh_token, expiraEm: resposta.data.expires_in ? new Date(Date.now() + resposta.data.expires_in * 1000) : null };
  }
  async criarEvento(evento, tokens) {
    const resposta = await axios.post('https://www.googleapis.com/calendar/v3/calendars/primary/events', { summary: evento.titulo, description: evento.descricao, start: { dateTime: evento.dataInicio, timeZone: evento.fusoHorario }, end: { dateTime: evento.dataFim, timeZone: evento.fusoHorario } }, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    return { externalEventId: resposta.data.id, calendarId: resposta.data.organizer?.email || 'primary' };
  }
}

class ProvedorOutlookCalendar {
  async atualizarEvento(id, evento, tokens) {
    const resposta = await axios.patch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(id)}`, { subject: evento.titulo, body: { contentType: 'Text', content: evento.descricao || '' }, start: { dateTime: evento.dataInicio, timeZone: evento.fusoHorario }, end: { dateTime: evento.dataFim, timeZone: evento.fusoHorario } }, { timeout: 10000, headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    return { externalEventId: resposta.data.id };
  }
  disponivel() { return Boolean(ambiente.outlook.clientId && ambiente.outlook.clientSecret); }
  urlAutorizacao(estado) {
    if (!this.disponivel()) return null;
    const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    url.search = new URLSearchParams({ client_id: ambiente.outlook.clientId, redirect_uri: ambiente.outlook.redirectUri, response_type: 'code', response_mode: 'query', scope: 'offline_access Calendars.ReadWrite', state: estado }).toString();
    return url.toString();
  }
  async trocarCodigo(codigo) {
    const resposta = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({ code: codigo, client_id: ambiente.outlook.clientId, client_secret: ambiente.outlook.clientSecret, redirect_uri: ambiente.outlook.redirectUri, grant_type: 'authorization_code', scope: 'offline_access Calendars.ReadWrite' }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return { accessToken: resposta.data.access_token, refreshToken: resposta.data.refresh_token, expiraEm: resposta.data.expires_in ? new Date(Date.now() + resposta.data.expires_in * 1000) : null };
  }
  async criarEvento(evento, tokens) {
    const resposta = await axios.post('https://graph.microsoft.com/v1.0/me/events', { subject: evento.titulo, body: { contentType: 'Text', content: evento.descricao || '' }, start: { dateTime: evento.dataInicio, timeZone: evento.fusoHorario }, end: { dateTime: evento.dataFim, timeZone: evento.fusoHorario } }, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    return { externalEventId: resposta.data.id, calendarId: 'outlook-default' };
  }
}

function obterProvedor(provedor) {
  if (provedor === 'google') return new ProvedorGoogleCalendar();
  if (provedor === 'outlook') return new ProvedorOutlookCalendar();
  return new ProvedorCalendarioSimulado(provedor);
}

module.exports = { obterProvedor, ProvedorCalendarioSimulado, ProvedorGoogleCalendar, ProvedorOutlookCalendar };
