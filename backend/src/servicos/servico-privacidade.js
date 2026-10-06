const { createClient } = require('@supabase/supabase-js');
const ambiente = require('../configuracao/ambiente');
const logger = require('../configuracao/logger');

async function processarExclusoes(repositorio, agora = new Date()) {
  const limite = new Date(agora.getTime() - 7 * 86400000);
  const usuarios = await repositorio.listarUsuariosExclusaoVencida(limite);
  if (!usuarios.length) return { excluidos: 0 };
  const supabase = createClient(ambiente.supabaseUrl, ambiente.supabaseChaveSecreta, { auth: { persistSession: false } });
  let excluidos = 0;
  for (const usuario of usuarios) {
    const { error } = await supabase.auth.admin.deleteUser(usuario.id);
    if (error && error.status !== 404) { logger.error({ usuarioId: usuario.id, codigo: error.code }, 'falha ao excluir identidade'); continue; }
    if (await repositorio.excluirUsuario(usuario.id)) excluidos += 1;
  }
  return { excluidos };
}

module.exports = { processarExclusoes };
