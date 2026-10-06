const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { criarAutenticador, autorizarAdministrador, validarSegredoWebhook } = require('../intermediarios/seguranca');
const { criarServicoAutenticacao } = require('../servicos/servico-autenticacao');
const { criarControladorAutenticacao } = require('../controladores/autenticacao-controlador');
const { criarControladorTarefas } = require('../controladores/tarefas-controlador');
const { criarControladorLembretes } = require('../controladores/lembretes-controlador');
const { criarControladorWebhook } = require('../controladores/webhook-controlador');
const { criarControladorPainel } = require('../controladores/painel-controlador');
const { criarControladorPreferencias } = require('../controladores/preferencias-controlador');
const { criarControladorEstudos } = require('../controladores/estudos-controlador');
const { criarControladorAdmin } = require('../controladores/admin-controlador');
const { diagnosticoConsultaEvolution } = require('../consulta-mensagens-evolution');
const { codigoSeguroErroChatbot } = require('../servicos/servico-chatbot');
const { criarStoreRedis } = require('../intermediarios/rate-limit-redis');

function criarRotas({ repositorio, servicoTarefas, servicoLembretes, servicoCalendarios, filaMensagens, filaWhatsapp, servicoAssistente, servicoWhatsapp, servicoAutenticacao = criarServicoAutenticacao(repositorio, undefined, undefined, undefined, servicoWhatsapp) }) {
  const rotas = express.Router();
  const autenticar = criarAutenticador(servicoAutenticacao);
  const autenticacao = criarControladorAutenticacao(servicoAutenticacao);
  const tarefas = criarControladorTarefas(servicoTarefas);
  const lembretes = criarControladorLembretes(servicoLembretes);
  const webhook = criarControladorWebhook({ repositorio, filaMensagens, servicoAssistente });
  const painel = criarControladorPainel({ repositorio, servicoCalendarios });
  const preferencias = criarControladorPreferencias({ repositorio, servicoAutenticacao });
  const estudos = criarControladorEstudos({ repositorio });
  const admin = criarControladorAdmin({ repositorio, filaWhatsapp });
  const limitarAutenticacao = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Aguarde um pouco e tente novamente.' },
    store: criarStoreRedis('autenticacao'),
    passOnStoreError: false
  });

  rotas.use('/autenticacao', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  rotas.post('/autenticacao/cadastro', limitarAutenticacao, autenticacao.cadastrar);
  rotas.post('/autenticacao/entrar', limitarAutenticacao, autenticacao.entrar);
  rotas.post('/autenticacao/codigo/verificar', limitarAutenticacao, autenticacao.confirmarCodigo);
  rotas.post('/autenticacao/senha/recuperar', limitarAutenticacao, autenticacao.solicitarRecuperacao);
  rotas.post('/autenticacao/senha/redefinir', limitarAutenticacao, autenticacao.redefinirSenha);
  rotas.post('/autenticacao/email/reenviar-confirmacao', limitarAutenticacao, autenticacao.reenviarConfirmacao);
  rotas.get('/autenticacao/eu', autenticar, autenticacao.eu);

  rotas.get('/tarefas', autenticar, tarefas.listar);
  rotas.post('/tarefas', autenticar, tarefas.criar);
  rotas.get('/tarefas/:id', autenticar, tarefas.obter);
  rotas.patch('/tarefas/:id', autenticar, tarefas.atualizar);
  rotas.delete('/tarefas/:id', autenticar, tarefas.excluir);
  rotas.post('/tarefas/:id/concluir', autenticar, tarefas.concluir);

  rotas.get('/lembretes', autenticar, lembretes.listar);
  rotas.post('/lembretes', autenticar, lembretes.criar);
  rotas.patch('/lembretes/:id', autenticar, lembretes.atualizar);
  rotas.delete('/lembretes/:id', autenticar, lembretes.excluir);

  rotas.get('/painel/resumo', autenticar, painel.resumo);
  rotas.get('/conversas', autenticar, painel.conversas);
  rotas.get('/conversas/:id/mensagens', autenticar, painel.mensagens);

  rotas.get('/preferencias', autenticar, preferencias.obter);
  rotas.patch('/preferencias', autenticar, preferencias.atualizar);
  rotas.get('/privacidade/exportar', autenticar, preferencias.exportar);
  rotas.post('/privacidade/excluir-conta', autenticar, preferencias.solicitarExclusao);

  rotas.get('/estudos/planos', autenticar, estudos.listar);
  rotas.post('/estudos/planos', autenticar, estudos.criar);
  rotas.patch('/estudos/planos/:id', autenticar, estudos.atualizar);
  rotas.post('/estudos/sessoes', autenticar, estudos.criarSessao);
  rotas.post('/estudos/sessoes/:id/concluir', autenticar, estudos.concluirSessao);

  rotas.get('/admin/diagnostico', autenticar, autorizarAdministrador, admin.diagnostico);
  rotas.post('/admin/webhooks/:id/reprocessar', autenticar, autorizarAdministrador, admin.reprocessar);
  rotas.post('/admin/broadcast', autenticar, autorizarAdministrador, admin.broadcast);

  rotas.get('/calendarios/conexoes', autenticar, painel.conexoesCalendario);
  rotas.get('/calendarios/:provedor/conectar', autenticar, painel.conectarCalendario);
  rotas.get('/calendarios/:provedor/retorno', painel.retornoCalendario);
  rotas.delete('/calendarios/:provedor/desconectar', autenticar, painel.desconectarCalendario);
  rotas.post('/calendarios/:provedor/sincronizar', autenticar, painel.sincronizarCalendario);

  rotas.post('/webhooks/evolution', validarSegredoWebhook, webhook.evolution);
  if (process.env.AMBIENTE !== 'producao') rotas.post('/webhooks/evolution/simular', validarSegredoWebhook, webhook.simular);
  rotas.get('/saude', (req, res) => res.json({ status: 'ok', servico: 'backend', data: new Date().toISOString() }));
  rotas.get('/saude/evolution', autenticar, autorizarAdministrador, (req, res) => res.json({
    status: diagnosticoConsultaEvolution.codigoErro ? 'degradado' : 'ok',
    servico: 'evolution-polling',
    ...diagnosticoConsultaEvolution
  }));
  rotas.get('/saude/chatbot', autenticar, autorizarAdministrador, async (req, res) => {
    try {
      const resultado = await servicoAssistente.servicoChatbot.diagnosticar();
      return res.json({ status: 'ok', servico: 'chatbot', conectado: resultado?.status === 'ok' });
    } catch (erro) {
      return res.status(503).json({
        status: 'degradado',
        servico: 'chatbot',
        conectado: false,
        codigoErro: codigoSeguroErroChatbot(erro)
      });
    }
  });
  rotas.get('/saude/banco', async (req, res, next) => {
    try {
      await repositorio.verificarConexao();
      return res.json({ status: 'ok', servico: 'postgresql', data: new Date().toISOString() });
    } catch (erro) {
      return next(erro);
    }
  });
  return rotas;
}

module.exports = { criarRotas };
