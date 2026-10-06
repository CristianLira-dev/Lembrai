/**
 * Mantém compatibilidade com a implantação de serviço único. Quando Redis está
 * disponível a API usa BullMQ normalmente; sem ele, inicia o processo legado
 * com filas em memória e agendador local até que Redis seja configurado.
 */
if (process.env.REDIS_URL) {
  require('../src/servidor').iniciarServidor();
} else {
  require('./servidor-sem-redis');
}
