const emailjs = require('@emailjs/nodejs');
const ambiente = require('../configuracao/ambiente');

function falhaEmail(mensagem, codigo) {
  return Object.assign(new Error(mensagem), { statusCode: 503, code: codigo, exporMensagem: true });
}

class ServicoEmail {
  constructor(cliente = emailjs) {
    this.cliente = cliente;
  }

  configurado() {
    const { serviceId, templateId, publicKey, privateKey } = ambiente.emailjs;
    return Boolean(serviceId && templateId && publicKey && privateKey);
  }

  async enviarCodigo({ email, nome, codigo, finalidade }) {
    if (!this.configurado()) {
      throw falhaEmail('O envio do código por e-mail ainda não está configurado.', 'EMAILJS_CONFIG');
    }

    const { serviceId, templateId, publicKey, privateKey } = ambiente.emailjs;
    try {
      await this.cliente.send(serviceId, templateId, {
        to_email: email,
        to_name: nome || 'Estudante',
        auth_code: codigo,
        expires_minutes: '10',
        purpose_label: finalidade === 'cadastro' ? 'confirmar seu cadastro' : 'confirmar sua entrada'
      }, { publicKey, privateKey });
    } catch (erro) {
      throw falhaEmail('Não foi possível enviar o código de verificação. Tente novamente.', 'EMAILJS_ENVIO');
    }
  }
}

module.exports = { ServicoEmail };
