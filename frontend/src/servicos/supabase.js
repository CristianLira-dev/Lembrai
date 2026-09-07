import { createClient } from '@supabase/supabase-js';
import { resolverConfiguracaoSupabase } from './configuracao-supabase';

const { url, chave } = resolverConfiguracaoSupabase(import.meta.env);

// Somente a chave publicável pode chegar ao navegador.
export const supabase = createClient(url, chave, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export function exigirSupabase() {
  return supabase;
}

export async function obterToken() {
  const { data, error } = await exigirSupabase().auth.getSession();
  if (error) throw error;
  return data.session?.access_token || null;
}

let renovacao;
export async function renovarToken(tokenAnterior) {
  const atual = await obterToken();
  if (!atual) return null;
  if (atual !== tokenAnterior) return atual;
  // Requisições simultâneas compartilham a mesma rotação de refresh token.
  renovacao ||= exigirSupabase().auth.refreshSession().then(({ data, error }) => {
    if (error) throw error;
    return data.session?.access_token || null;
  }).finally(() => { renovacao = null; });
  return renovacao;
}

export async function invalidarSessao(tokenRejeitado) {
  if (await obterToken() !== tokenRejeitado) return;
  window.dispatchEvent(new Event('sessao-expirada'));
  await exigirSupabase().auth.signOut({ scope: 'local' });
}
