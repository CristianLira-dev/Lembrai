const { ProvedorEvolutionApi } = require('../integracoes/evolution-api/provedor-evolution-api');

class ServicoWhatsapp {
  constructor(provedor = new ProvedorEvolutionApi()) {
    this.provedor = provedor;
  }

  async enviarResposta(telefone, texto) {
    return this.provedor.enviarTexto(telefone, texto);
  }

  async configurarWebhook(url) {
    return this.provedor.configurarWebhook(url);
  }

  async buscarMensagensRecentes(limite) {
    return this.provedor.buscarMensagensRecentes(limite);
  }
}

module.exports = { ServicoWhatsapp };
