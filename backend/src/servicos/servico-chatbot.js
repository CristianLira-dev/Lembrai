const axios = require('axios');
const ambiente = require('../configuracao/ambiente');

class ServicoChatbot {
  constructor() {
    this.cliente = axios.create({ baseURL: ambiente.urlChatbot, timeout: 90000, headers: { 'x-servico-token': ambiente.tokenServicoInterno, 'Content-Type': 'application/json' } });
  }

  async processar(payload) {
    const resposta = await this.cliente.post('/api/v1/assistente/processar', payload);
    return resposta.data;
  }
}

module.exports = { ServicoChatbot };
