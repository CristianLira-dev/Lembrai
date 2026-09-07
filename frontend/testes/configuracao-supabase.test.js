import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPABASE_CHAVE_PUBLICA_PADRAO,
  SUPABASE_URL_PADRAO,
  chavePublicaValida,
  resolverConfiguracaoSupabase
} from '../src/servicos/configuracao-supabase.js';

test('usa a configuração pública padrão quando as variáveis não existem', () => {
  assert.deepEqual(resolverConfiguracaoSupabase(), {
    url: SUPABASE_URL_PADRAO,
    chave: SUPABASE_CHAVE_PUBLICA_PADRAO
  });
});

test('rejeita uma chave mascarada e usa a chave pública padrão', () => {
  const configuracao = resolverConfiguracaoSupabase({
    VITE_SUPABASE_URL: SUPABASE_URL_PADRAO,
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publisha*****tA_NE57qrDE'
  });

  assert.equal(chavePublicaValida('sb_publisha*****tA_NE57qrDE'), false);
  assert.equal(configuracao.chave, SUPABASE_CHAVE_PUBLICA_PADRAO);
});

test('preserva chaves publicáveis e anon JWT válidas', () => {
  const publicavel = 'sb_publishable_abcdefghijklmnopqrstuvwx';
  const jwtLegado = 'cabecalho.conteudo.assinatura';

  assert.equal(chavePublicaValida(publicavel), true);
  assert.equal(chavePublicaValida(jwtLegado), true);
  assert.equal(
    resolverConfiguracaoSupabase({ VITE_SUPABASE_PUBLISHABLE_KEY: publicavel }).chave,
    publicavel
  );
});
