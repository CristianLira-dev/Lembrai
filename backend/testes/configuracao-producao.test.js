const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const diretorioBackend = path.resolve(__dirname, '..');

function ambienteProducao() {
  const env = {
    ...process.env,
    AMBIENTE: 'producao',
    SUPABASE_URL: 'https://exemplo.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'chave-publica',
    SUPABASE_SECRET_KEY: 'chave-secreta',
    CODIGO_VERIFICACAO_SEGREDO: 'segredo-verificacao',
    JWT_SEGREDO: 'segredo-jwt',
    TOKEN_SERVICO_INTERNO: 'segredo-interno',
    EVOLUTION_WEBHOOK_SEGREDO: 'segredo-webhook',
    CHAVE_CRIPTOGRAFIA_TOKENS: 'a'.repeat(64),
    RESEND_API_KEY: 're_123',
    MODO_WHATSAPP: 'simulado'
  };
  delete env.REDIS_URL;
  delete env.EXIGIR_REDIS;
  return env;
}

test('API de produção aceita modo compatível quando Redis ainda não foi configurado', () => {
  const resultado = spawnSync(process.execPath, ['-e', "const a=require('./src/configuracao/ambiente'); a.validarAmbienteProducao(); if(a.redisConfigurado || a.exigirRedis) process.exit(1);"], {
    cwd: diretorioBackend,
    env: ambienteProducao(),
    encoding: 'utf8'
  });
  assert.equal(resultado.status, 0, resultado.stderr || resultado.stdout);
});

test('worker de produção continua exigindo Redis', () => {
  const resultado = spawnSync(process.execPath, ['src/worker.js'], {
    cwd: diretorioBackend,
    env: ambienteProducao(),
    encoding: 'utf8'
  });
  assert.notEqual(resultado.status, 0);
  assert.match(resultado.stderr, /REDIS_URL/);
});
