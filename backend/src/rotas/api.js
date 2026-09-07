const express = require('express');
const { criarAutenticador, validarSegredoWebhook } = require('../intermediarios/seguranca');
const { criarServicoAutenticacao } = require('../servicos/servico-autenticacao');
const { criarControladorAutenticacao } = require('../controladores/autenticacao-controlador');
const { criarControladorTarefas } = require('../controladores/tarefas-controlador');
const { criarControladorLembretes } = require('../controladores/lembretes-controlador');
const { criarControladorWebhook } = require('../controladores/webhook-controlador');
const { criarControladorPainel } = require('../controladores/painel-controlador');

function criarRotas({ repositorio, servicoTarefas, servicoLembretes, servicoCalendarios, filaMensagens, servicoAssistente, servicoAutenticacao = criarServicoAutenticacao(repositorio) }) {
  const rotas = express.Router();
  const autenticar = criarAutenticador(servicoAutenticacao);
  const autenticacao = criarControladorAutenticacao(servicoAutenticacao);
  const tarefas = criarControladorTarefas(servicoTarefas);
  const lembretes = criarControladorLembretes(servicoLembretes);
  const webhook = criarControladorWebhook({ repositorio, filaMensagens, servicoAssistente });
  const painel = criarControladorPainel({ repositorio, servicoCalendarios });

  rotas.use('/autenticacao', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  rotas.post('/autenticacao/cadastro', autenticacao.cadastrar);
  rotas.post('/autenticacao/entrar', autenticacao.entrar);
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

  rotas.get('/calendarios/conexoes', autenticar, painel.conexoesCalendario);
  rotas.get('/calendarios/:provedor/conectar', autenticar, painel.conectarCalendario);
  rotas.get('/calendarios/:provedor/retorno', painel.retornoCalendario);
  rotas.delete('/calendarios/:provedor/desconectar', autenticar, painel.desconectarCalendario);
  rotas.post('/calendarios/:provedor/sincronizar', autenticar, painel.sincronizarCalendario);

  rotas.post('/webhooks/evolution', validarSegredoWebhook, webhook.evolution);
  rotas.post('/webhooks/evolution/simular', webhook.simular);
  rotas.get('/saude', (req, res) => res.json({ status: 'ok', servico: 'backend', data: new Date().toISOString() }));
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
