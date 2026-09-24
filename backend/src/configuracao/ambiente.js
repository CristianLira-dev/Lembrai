const dotenv = require('dotenv');

dotenv.config({ path: process.env.ARQUIVO_ENV || '../.env' });

dotenv.config();

function lista(valor, padrao) {
  return (valor || padrao)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  ambiente: process.env.AMBIENTE || 'desenvolvimento',
  porta: Number(process.env.PORT || process.env.PORTA_BACKEND || 3000),
  urlFrontend: process.env.URL_FRONTEND || 'http://localhost:5173',
  urlBackend: process.env.URL_BACKEND || 'http://localhost:3000',
  corsOrigens: lista(process.env.CORS_ORIGENS, 'http://localhost:5173'),
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseChavePublica: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  supabaseChaveSecreta: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  codigoVerificacaoSegredo: process.env.CODIGO_VERIFICACAO_SEGREDO || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  emailjs: {
    serviceId: process.env.EMAILJS_SERVICE_ID || '',
    templateId: process.env.EMAILJS_TEMPLATE_ID || '',
    publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
    privateKey: process.env.EMAILJS_PRIVATE_KEY || ''
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
