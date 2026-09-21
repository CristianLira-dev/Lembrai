const axios = require('axios');
const ambiente = require('../../configuracao/ambiente');
const logger = require('../../configuracao/logger');
const { normalizarTelefone } = require('../../utilitarios/telefone');

function extrairTextoMensagem(dados = {}) {
  const mensagem = dados.message || {};
  return mensagem.conversation
    || mensagem.extendedTextMessage?.text
    || mensagem.imageMessage?.caption
    || mensagem.videoMessage?.caption
    || '';
}

class ProvedorEvolutionApi {
  constructor() {
    this.simulado = ambiente.modoWhatsapp !== 'evolution' || !ambiente.evolutionUrl || !ambiente.evolutionChave;
    this.cliente = axios.create({ baseURL: ambiente.evolutionUrl, timeout: 10000, headers: { apikey: ambiente.evolutionChave, 'Content-Type': 'application/json' } });
  }

  async enviarTexto(telefone, texto) {
    const destino = normalizarTelefone(telefone);
    if (this.simulado) {
      logger.info({ telefone: destino, texto }, 'WhatsApp simulado');
      return { simulado: true, telefone: destino, texto };
    }
    const resposta = await this.cliente.post(`/message/sendText/${ambiente.evolutionInstancia}`, { number: destino, text: texto, delay: 300 });
    return resposta.data;
  }

  async configurarWebhook(url) {
    if (this.simulado) return { simulado: true, url };
    const resposta = await this.cliente.post(`/webhook/set/${ambiente.evolutionInstancia}`, {
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: false,
        headers: { 'x-webhook-secret': ambiente.evolutionWebhookSegredo },
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
      }
    });
    return resposta.data;
  }

  async buscarMensagensRecentes(limite = 50) {
    if (this.simulado) return [];
    const resposta = await this.cliente.post(`/chat/findMessages/${ambiente.evolutionInstancia}`, {
      where: {},
      page: 1,
      offset: limite
    });
    return resposta.data?.messages?.records || [];
  }
}

module.exports = { ProvedorEvolutionApi, normalizarTelefone, extrairTextoMensagem };
