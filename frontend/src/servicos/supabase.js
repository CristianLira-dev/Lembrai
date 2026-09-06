import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Somente a chave publicável pode chegar ao navegador.
export const supabase = url && chave ? createClient(url, chave, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

export function exigirSupabase() {
  if (!supabase) throw new Error('Autenticação indisponível. Configure a conexão com o Supabase.');
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
