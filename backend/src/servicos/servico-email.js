const nodemailer = require('nodemailer');
const ambiente = require('../configuracao/ambiente');

function falhaEmail(mensagem, codigo) {
  return Object.assign(new Error(mensagem), { statusCode: 503, code: codigo });
}

function escaparHtml(valor) {
  return String(valor || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const conteudos = {
  cadastro: {
    assunto: 'Confirme seu cadastro na Lembraí',
    titulo: 'Confirme seu e-mail',
    texto: 'Use este código para confirmar seu cadastro.'
  },
  entrada: {
    assunto: 'Código para entrar na Lembraí',
    titulo: 'Seu código de acesso',
    texto: 'Use este código para concluir seu login.'
  },
  recuperacao: {
    assunto: 'Redefinição de senha da Lembraí',
    titulo: 'Redefina sua senha',
    texto: 'Use este código para criar uma nova senha.'
  }
};

class ServicoEmail {
  constructor(configuracao = ambiente.smtp, criarTransporte = nodemailer.createTransport) {
    this.configuracao = configuracao;
    this.criarTransporte = criarTransporte;
    this.transporte = null;
  }

  configurado() {
    const smtp = this.configuracao || {};
    return Boolean(smtp.host && smtp.porta && smtp.usuario && smtp.senha && smtp.remetente);
  }

  obterTransporte() {
    if (!this.configurado()) {
      throw falhaEmail('O envio de e-mail está temporariamente indisponível.', 'SMTP_NAO_CONFIGURADO');
    }
    if (!this.transporte) {
      const smtp = this.configuracao;
      this.transporte = this.criarTransporte({
        host: smtp.host,
        port: smtp.porta,
        secure: smtp.seguro,
        auth: { user: smtp.usuario, pass: smtp.senha },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });
    }
    return this.transporte;
  }

  async enviarCodigo({ email, nome, codigo, finalidade }) {
    const conteudo = conteudos[finalidade];
    if (!conteudo) throw falhaEmail('Não foi possível preparar o e-mail de verificação.', 'EMAIL_FINALIDADE_INVALIDA');
    const nomeSeguro = escaparHtml(nome || 'estudante');
    const codigoSeguro = escaparHtml(codigo);
    const remetente = this.configuracao;
    try {
      const resultado = await this.obterTransporte().sendMail({
        from: { name: remetente.nomeRemetente || 'Lembraí', address: remetente.remetente },
        to: email,
        subject: conteudo.assunto,
        text: `Olá, ${nome || 'estudante'}! ${conteudo.texto} Código: ${codigo}. Ele expira em 10 minutos.`,
        html: `<!doctype html>
          <html lang="pt-BR"><body style="margin:0;background:#f5f7f5;font-family:Arial,sans-serif;color:#17201b">
            <div style="max-width:520px;margin:32px auto;background:#fff;border:1px solid #dce5df;border-radius:16px;padding:32px">
              <div style="font-size:22px;font-weight:700;color:#169b62">Lembraí</div>
              <h1 style="font-size:24px;margin:28px 0 12px">${conteudo.titulo}</h1>
              <p>Olá, ${nomeSeguro}! ${conteudo.texto}</p>
              <div style="margin:28px 0;padding:18px;text-align:center;border-radius:12px;background:#eef9f3;font-size:32px;font-weight:700;letter-spacing:8px">${codigoSeguro}</div>
              <p style="color:#5b6961">O código expira em 10 minutos e pode ser usado uma única vez. Se você não solicitou esta ação, ignore este e-mail.</p>
            </div>
          </body></html>`
      });
      if (Array.isArray(resultado?.rejected) && resultado.rejected.length > 0
        && (!Array.isArray(resultado.accepted) || resultado.accepted.length === 0)) {
        throw falhaEmail('Não foi possível enviar o código por e-mail. Tente novamente em instantes.', 'SMTP_DESTINATARIO_REJEITADO');
      }
      return { messageId: resultado?.messageId || null };
    } catch (erro) {
      if (erro?.code === 'SMTP_NAO_CONFIGURADO') throw erro;
      throw falhaEmail('Não foi possível enviar o código por e-mail. Tente novamente em instantes.', 'SMTP_ENVIO_FALHOU');
    }
  }
}

module.exports = { ServicoEmail };
