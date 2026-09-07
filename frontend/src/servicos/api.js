import { criarClienteApi } from './cliente-api';
import { obterToken, renovarToken, invalidarSessao } from './supabase';

const requisitar = criarClienteApi({
  urlBase: import.meta.env.VITE_URL_API || 'http://localhost:3000/api',
  obterToken, renovarToken, invalidarSessao
});

export const api = {
  entrar: (dados) => requisitar('/autenticacao/entrar', { metodo: 'POST', dados, publico: true }),
  cadastrar: (dados) => requisitar('/autenticacao/cadastro', { metodo: 'POST', dados, publico: true }),
  confirmarEmail: (dados) => requisitar('/autenticacao/confirmar-email', { metodo: 'POST', dados, publico: true }),
  reenviarCodigo: (dados) => requisitar('/autenticacao/reenviar-codigo', { metodo: 'POST', dados, publico: true }),
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
  sincronizarCalendario: (provedor) => requisitar(`/calendarios/${provedor}/sincronizar`, { metodo: 'POST' })
};

export default api;
