export const SUPABASE_URL_PADRAO = 'https://wbmmuttuyxhzdthunobb.supabase.co';
export const SUPABASE_CHAVE_PUBLICA_PADRAO = 'sb_publishable_kgXnIob5m8hQjtMf4t1jtA_NE57qrDE';

export function chavePublicaValida(valor) {
  if (typeof valor !== 'string') return false;
  const chave = valor.trim();
  const publicavel = /^sb_publishable_[A-Za-z0-9_-]{20,}$/;
  const jwtLegado = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  return publicavel.test(chave) || jwtLegado.test(chave);
}

export function resolverConfiguracaoSupabase(ambiente = {}) {
  const url = ambiente.VITE_SUPABASE_URL?.trim() || SUPABASE_URL_PADRAO;
  const chaveConfigurada = ambiente.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const chave = chavePublicaValida(chaveConfigurada)
    ? chaveConfigurada
    : SUPABASE_CHAVE_PUBLICA_PADRAO;

  return { url, chave };
}
