const { z } = require('zod');

const esquemaTelefone = z
  .string()
  .trim()
  .min(8)
  .max(30)
  .transform((valor) => valor.replace(/\D/g, ''))
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

const tiposTarefa = ['tarefa', 'prova', 'trabalho', 'aula', 'compromisso', 'outro'];
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

const esquemaWebhookEvolution = z.object({
  event: z.string().min(1),
  instance: z.string().optional().default('desconhecida'),
  data: z.record(z.any()).default({}),
  date_time: z.string().optional(),
  sender: z.string().optional(),
  server_url: z.string().optional(),
  apikey: z.string().optional()
});

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
  esquemaCriarTarefa,
  esquemaAtualizarTarefa,
  esquemaCriarLembrete,
  esquemaAtualizarLembrete,
  esquemaWebhookEvolution,
  validar,
  tiposTarefa,
  prioridades,
  statusTarefa
};
