const dotenv = require('dotenv');

dotenv.config({ path: process.env.ARQUIVO_ENV || '../.env' });

dotenv.config();

function lista(valor, padrao) {
  return (valor || padrao)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const ambiente = {
  ambiente: process.env.AMBIENTE || 'desenvolvimento',
  porta: Number(process.env.PORT || process.env.PORTA_BACKEND || 3000),
  urlFrontend: process.env.URL_FRONTEND || 'http://localhost:5173',
  urlBackend: process.env.URL_BACKEND || 'http://localhost:3000',
  corsOrigens: lista(process.env.CORS_ORIGENS, 'http://localhost:5173'),
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  redisConfigurado: Boolean(process.env.REDIS_URL),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseChavePublica: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  supabaseChaveSecreta: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  codigoVerificacaoSegredo: process.env.CODIGO_VERIFICACAO_SEGREDO || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    porta: Number(process.env.SMTP_PORT || 587),
    seguro: process.env.SMTP_SEGURO === 'true' || process.env.SMTP_PORT === '465',
    usuario: process.env.SMTP_USUARIO || '',
    senha: process.env.SMTP_SENHA || '',
    remetente: process.env.EMAIL_REMETENTE || process.env.SMTP_USUARIO || '',
    nomeRemetente: process.env.EMAIL_NOME_REMETENTE || 'Lembraí'
  },
  jwtSegredo: process.env.JWT_SEGREDO || 'desenvolvimento-troque-este-segredo',
  jwtExpiracao: process.env.JWT_EXPIRACAO || '7d',
  urlChatbot: process.env.URL_CHATBOT || 'http://localhost:8000',
  tokenServicoInterno: process.env.TOKEN_SERVICO_INTERNO || 'desenvolvimento-token-interno',
  evolutionUrl: process.env.EVOLUTION_API_URL || '',
  evolutionChave: process.env.EVOLUTION_API_CHAVE || '',
  evolutionInstancia: process.env.EVOLUTION_API_INSTANCIA || 'assistente-academico',
  evolutionWebhookSegredo: process.env.EVOLUTION_WEBHOOK_SEGREDO || 'desenvolvimento-webhook',
  modoWhatsapp: process.env.MODO_WHATSAPP || 'simulado',
  // A API continua operando em modo compatível (filas e agendador locais) quando
  // o serviço ainda não recebeu Redis. Os processos distribuídos devem definir
  // EXIGIR_REDIS=true e falham cedo se a infraestrutura estiver incompleta.
  exigirRedis: process.env.EXIGIR_REDIS === 'true',
  adminToken: process.env.ADMIN_TOKEN || '',
  retencaoMensagensDias: Number(process.env.RETENCAO_MENSAGENS_DIAS || 90),
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    remetente: process.env.EMAIL_REMETENTE || '',
    nomeRemetente: process.env.EMAIL_NOME_REMETENTE || 'Lembraí'
  },
  chaveCriptografiaTokens: process.env.CHAVE_CRIPTOGRAFIA_TOKENS || '',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendarios/google/retorno'
  },
  outlook: {
    clientId: process.env.OUTLOOK_CLIENT_ID || '',
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || '',
    redirectUri: process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3000/api/calendarios/outlook/retorno'
  }
};

function validarAmbienteProducao() {
  if (ambiente.ambiente !== 'producao') return ambiente;
  const obrigatorias = [
    'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY',
    'CODIGO_VERIFICACAO_SEGREDO', 'JWT_SEGREDO', 'TOKEN_SERVICO_INTERNO',
    'EVOLUTION_WEBHOOK_SEGREDO', 'CHAVE_CRIPTOGRAFIA_TOKENS'
  ];
  if (ambiente.modoWhatsapp === 'evolution') obrigatorias.push('EVOLUTION_API_URL', 'EVOLUTION_API_CHAVE', 'EVOLUTION_API_INSTANCIA');
  if (ambiente.exigirRedis) obrigatorias.push('REDIS_URL');
  const ausentes = obrigatorias.filter((nome) => nome === 'SUPABASE_SECRET_KEY'
    ? !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
    : !process.env[nome]);
  if (ausentes.length) {
    const erro = new Error(`Configuração de produção incompleta: ${ausentes.join(', ')}`);
    erro.code = 'CONFIGURACAO_PRODUCAO_INVALIDA';
    throw erro;
  }
  if (!/^[a-f0-9]{64}$/i.test(ambiente.chaveCriptografiaTokens)) {
    throw Object.assign(new Error('CHAVE_CRIPTOGRAFIA_TOKENS deve conter 64 caracteres hexadecimais'), { code: 'CONFIGURACAO_PRODUCAO_INVALIDA' });
  }
  if (!ambiente.resend.apiKey && !(ambiente.smtp.host && ambiente.smtp.usuario && ambiente.smtp.senha)) {
    throw Object.assign(new Error('Configure RESEND_API_KEY ou SMTP para envio de e-mail'), { code: 'CONFIGURACAO_PRODUCAO_INVALIDA' });
  }
  return ambiente;
}

ambiente.validarAmbienteProducao = validarAmbienteProducao;
module.exports = ambiente;
