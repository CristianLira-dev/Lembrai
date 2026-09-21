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

  async diagnosticar() {
    const resposta = await this.cliente.get('/api/v1/assistente/saude-interna', { timeout: 15000 });
    return resposta.data;
  }
}

function codigoSeguroErroChatbot(erro) {
  const status = erro?.response?.status;
  if (status === 401) return 'token_incompativel';
  if (status === 503) return 'token_nao_configurado';
  if (status === 404) return 'chatbot_desatualizado';
  if (status) return `http_${status}`;
  if (erro?.code === 'ECONNABORTED') return 'tempo_esgotado';
  if (erro?.code && /^[A-Z0-9_]+$/.test(erro.code)) return erro.code.toLowerCase();
  return 'conexao_falhou';
}

module.exports = { ServicoChatbot, codigoSeguroErroChatbot };
