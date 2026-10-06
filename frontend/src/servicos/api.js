import { criarClienteApi } from './cliente-api';
import { obterToken, renovarToken, invalidarSessao } from './supabase';

const requisitar = criarClienteApi({
  urlBase: import.meta.env.VITE_URL_API || 'http://localhost:3000/api',
  obterToken, renovarToken, invalidarSessao
});

export const api = {
  entrar: (dados) => requisitar('/autenticacao/entrar', { metodo: 'POST', dados, publico: true }),
  cadastrar: (dados) => requisitar('/autenticacao/cadastro', { metodo: 'POST', dados, publico: true }),
  confirmarCodigo: (dados) => requisitar('/autenticacao/codigo/verificar', { metodo: 'POST', dados, publico: true }),
  solicitarRecuperacao: (dados) => requisitar('/autenticacao/senha/recuperar', { metodo: 'POST', dados, publico: true }),
  redefinirSenha: (dados) => requisitar('/autenticacao/senha/redefinir', { metodo: 'POST', dados, publico: true }),
  reenviarConfirmacao: (dados) => requisitar('/autenticacao/email/reenviar-confirmacao', { metodo: 'POST', dados, publico: true }),
  eu: (token) => requisitar('/autenticacao/eu', { token }),
  resumo: () => requisitar('/painel/resumo'),
  tarefas: (params) => requisitar('/tarefas', { params }),
  tarefa: (id) => requisitar(`/tarefas/${id}`),
  criarTarefa: (dados) => requisitar('/tarefas', { metodo: 'POST', dados }),
  atualizarTarefa: (id, dados) => requisitar(`/tarefas/${id}`, { metodo: 'PATCH', dados }),
  excluirTarefa: (id) => requisitar(`/tarefas/${id}`, { metodo: 'DELETE' }),
  concluirTarefa: (id) => requisitar(`/tarefas/${id}/concluir`, { metodo: 'POST' }),
  lembretes: () => requisitar('/lembretes'),
  criarLembrete: (dados) => requisitar('/lembretes', { metodo: 'POST', dados }),
  atualizarLembrete: (id, dados) => requisitar(`/lembretes/${id}`, { metodo: 'PATCH', dados }),
  excluirLembrete: (id) => requisitar(`/lembretes/${id}`, { metodo: 'DELETE' }),
  conversas: () => requisitar('/conversas'),
  mensagens: (id) => requisitar(`/conversas/${id}/mensagens`),
  conexoesCalendario: () => requisitar('/calendarios/conexoes'),
  conectarCalendario: (provedor) => requisitar(`/calendarios/${provedor}/conectar`),
  desconectarCalendario: (provedor) => requisitar(`/calendarios/${provedor}/desconectar`, { metodo: 'DELETE' }),
  sincronizarCalendario: (provedor) => requisitar(`/calendarios/${provedor}/sincronizar`, { metodo: 'POST' }),
  preferencias: () => requisitar('/preferencias'),
  salvarPreferencias: (dados) => requisitar('/preferencias', { metodo: 'PATCH', dados }),
  exportarDados: () => requisitar('/privacidade/exportar'),
  solicitarExclusao: () => requisitar('/privacidade/excluir-conta', { metodo: 'POST' }),
  planosEstudo: () => requisitar('/estudos/planos'),
  criarPlanoEstudo: (dados) => requisitar('/estudos/planos', { metodo: 'POST', dados }),
  atualizarPlanoEstudo: (id, dados) => requisitar(`/estudos/planos/${id}`, { metodo: 'PATCH', dados }),
  concluirSessaoEstudo: (id) => requisitar(`/estudos/sessoes/${id}/concluir`, { metodo: 'POST' }),
  diagnosticoAdmin: () => requisitar('/admin/diagnostico'),
  reprocessarWebhook: (id) => requisitar(`/admin/webhooks/${id}/reprocessar`, { metodo: 'POST' }),
  broadcastAdmin: (mensagem) => requisitar('/admin/broadcast', { metodo: 'POST', dados: { mensagem } })
};

export default api;
