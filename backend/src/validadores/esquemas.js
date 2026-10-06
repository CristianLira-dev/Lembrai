const { z } = require('zod');
const { normalizarTelefone } = require('../utilitarios/telefone');

const esquemaTelefone = z
  .string()
  .trim()
  .min(8)
  .max(30)
  .transform(normalizarTelefone)
  .refine(
    (valor) => valor.length >= 8 && valor.length <= 15,
    'Informe um número de WhatsApp válido'
  );

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((valor) => valor.toLowerCase()),
  senha: z.string().min(8).max(128),
  telefone: esquemaTelefone,
  fusoHorario: z.string().trim().min(3).max(80).default('America/Sao_Paulo')
});

const esquemaEntrada = z.object({
  email: z.string().trim().email().transform((valor) => valor.toLowerCase()),
  senha: z.string().min(1).max(128)
});

const esquemaConfirmarCodigo = z.object({
  desafioId: z.string().uuid(),
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5}$/, 'Informe o código de 5 caracteres')
});

const esquemaSolicitarRecuperacao = z.object({
  email: z.string().trim().email().transform((valor) => valor.toLowerCase())
});

const esquemaRedefinirSenha = esquemaConfirmarCodigo.extend({
  novaSenha: z.string().min(8).max(128)
});

const esquemaReenviarConfirmacao = esquemaSolicitarRecuperacao;

const tiposTarefa = ['tarefa', 'prova', 'trabalho', 'aula', 'compromisso', 'estudo', 'outro'];
const prioridades = ['baixa', 'media', 'alta'];
const statusTarefa = ['pendente', 'concluida', 'cancelada'];

const camposTarefa = {
  titulo: z.string().trim().min(2).max(180),
  descricao: z.string().trim().max(1000).nullable().optional(),
  materia: z.string().trim().max(120).nullable().optional(),
  tipo: z.enum(tiposTarefa).default('tarefa'),
  dataEntrega: z.coerce.date(),
  horarioEntrega: z.string().trim().max(10).nullable().optional(),
  duracao: z.coerce.number().int().min(1).max(1440).nullable().optional(),
  prioridade: z.enum(prioridades).default('media')
};

const esquemaCriarTarefa = z.object(camposTarefa);

const esquemaAtualizarTarefa = z
  .object({
    ...camposTarefa,
    tipo: z.enum(tiposTarefa).optional(),
    prioridade: z.enum(prioridades).optional(),
    titulo: camposTarefa.titulo.optional(),
    dataEntrega: camposTarefa.dataEntrega.optional(),
    status: z.enum(statusTarefa).optional()
  })
  .partial();

const esquemaCriarLembrete = z.object({
  tarefaId: z.string().min(1),
  agendadoPara: z.coerce.date(),
  tipo: z.string().trim().min(1).max(40).default('personalizado')
});

const esquemaAtualizarLembrete = z.object({
  agendadoPara: z.coerce.date().optional(),
  tipo: z.string().trim().min(1).max(40).optional(),
  status: z.enum(['agendado', 'enviado', 'falhou', 'cancelado']).optional()
});

const esquemaPreferencias = z.object({
  notificacoesAtivas: z.boolean().optional(),
  horarioLembretes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  horarioSilencioInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  horarioSilencioFim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  frequenciaResumo: z.enum(['diario', 'dias_uteis', 'desativado']).optional(),
  antecedenciasLembrete: z.array(z.number().int().min(0).max(10080)).min(1).max(5).optional(),
  fusoHorario: z.string().trim().min(3).max(80).optional()
}).strict();

const esquemaPlanoEstudo = z.object({
  titulo: z.string().trim().min(2).max(180),
  materia: z.string().trim().max(120).nullable().optional(),
  objetivo: z.string().trim().max(1000).nullable().optional(),
  dataLimite: z.coerce.date(),
  minutosPorSessao: z.coerce.number().int().min(15).max(240).default(45),
  diasSemana: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5])
});

const esquemaAtualizarPlanoEstudo = esquemaPlanoEstudo.partial().extend({
  status: z.enum(['ativo', 'concluido', 'cancelado']).optional()
});

const esquemaSessaoEstudo = z.object({
  planoEstudoId: z.string().min(1),
  titulo: z.string().trim().min(2).max(180),
  agendadaPara: z.coerce.date(),
  duracaoMinutos: z.coerce.number().int().min(15).max(240)
});

function normalizarWebhookEvolution(valor) {
  const item = Array.isArray(valor) ? valor[0] : valor;
  if (!item || typeof item !== 'object') return valor;
  const raiz = item.body && typeof item.body === 'object' ? item.body : item;
  const dadosAninhados = raiz.data?.data && typeof raiz.data.data === 'object' ? raiz.data.data : null;
  const dados = raiz.data?.key ? raiz.data : dadosAninhados?.key ? dadosAninhados : raiz.message?.key ? raiz.message : (raiz.data || {});
  const dataHora = raiz.date_time ?? raiz.dateTime ?? raiz.timestamp ?? raiz.createdAt;
  return {
    ...raiz,
    event: raiz.event || raiz.type || raiz.eventType || raiz.data?.event,
    instance: raiz.instance || raiz.instanceName || raiz.data?.instance || 'desconhecida',
    data: dados,
    date_time: dataHora == null || dataHora === '' ? undefined : String(dataHora),
    sender: raiz.sender || dados?.sender,
    apikey: raiz.apikey || raiz.apiKey || raiz.data?.apikey
  };
}

const esquemaWebhookEvolution = z.preprocess(normalizarWebhookEvolution, z.object({
  event: z.string().min(1),
  instance: z.string().optional().default('desconhecida'),
  data: z.record(z.any()).default({}),
  date_time: z.string().optional(),
  sender: z.string().optional(),
  server_url: z.string().optional(),
  apikey: z.string().optional()
}).passthrough());

function validar(esquema, dados) {
  const resultado = esquema.safeParse(dados);

  if (!resultado.success) {
    const erro = new Error('Dados inválidos');
    erro.statusCode = 400;
    erro.detalhes = resultado.error.flatten();
    throw erro;
  }

  return resultado.data;
}

module.exports = {
  esquemaTelefone,
  esquemaCadastro,
  esquemaEntrada,
  esquemaConfirmarCodigo,
  esquemaSolicitarRecuperacao,
  esquemaRedefinirSenha,
  esquemaReenviarConfirmacao,
  esquemaCriarTarefa,
  esquemaAtualizarTarefa,
  esquemaCriarLembrete,
  esquemaAtualizarLembrete,
  esquemaPreferencias,
  esquemaPlanoEstudo,
  esquemaAtualizarPlanoEstudo,
  esquemaSessaoEstudo,
  esquemaWebhookEvolution,
  validar,
  tiposTarefa,
  normalizarWebhookEvolution,
  prioridades,
  statusTarefa
};
