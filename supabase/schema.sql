-- Schema inicial do Lembraí para o Supabase SQL Editor.
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoTarefa" AS ENUM ('tarefa', 'prova', 'trabalho', 'aula', 'compromisso', 'outro');

-- CreateEnum
CREATE TYPE "PrioridadeTarefa" AS ENUM ('baixa', 'media', 'alta');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('pendente', 'concluida', 'cancelada');

-- CreateEnum
CREATE TYPE "StatusLembrete" AS ENUM ('agendado', 'enviado', 'falhou', 'cancelado');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('entrada', 'saida');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT NOT NULL,
    "senhaCriptografada" TEXT NOT NULL,
    "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "materia" TEXT,
    "tipo" "TipoTarefa" NOT NULL DEFAULT 'tarefa',
    "dataEntrega" TIMESTAMP(3) NOT NULL,
    "horarioEntrega" TEXT,
    "duracao" INTEGER,
    "prioridade" "PrioridadeTarefa" NOT NULL DEFAULT 'media',
    "status" "StatusTarefa" NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConexaoCalendario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "emailConta" TEXT,
    "tokenAcessoCriptografado" TEXT,
    "tokenAtualizacaoCriptografado" TEXT,
    "expiraEm" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'disponivel',
    "ultimoSincronismoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConexaoCalendario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoCalendario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "identificadorEventoExterno" TEXT,
    "identificadorCalendario" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "fusoHorario" TEXT NOT NULL,
    "statusSincronizacao" TEXT NOT NULL DEFAULT 'pendente',
    "ultimaVersaoExternaEm" TIMESTAMP(3),
    "ultimoSincronismoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoCalendario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lembrete" (
    "id" TEXT NOT NULL,
    "tarefaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "agendadoPara" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" "StatusLembrete" NOT NULL DEFAULT 'agendado',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "enviadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lembrete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "intencaoPendente" TEXT,
    "dadosPendentes" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "identificadorMensagemExterna" TEXT,
    "direcao" "DirecaoMensagem" NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipoMensagem" TEXT NOT NULL DEFAULT 'texto',
    "statusProcessamento" TEXT NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoWebhook" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "provedor" TEXT NOT NULL,
    "identificadorEventoExterno" TEXT NOT NULL,
    "tipoEvento" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "statusProcessamento" TEXT NOT NULL DEFAULT 'recebido',
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "EventoWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroSincronizacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "operacao" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mensagemErro" TEXT,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" TIMESTAMP(3),

    CONSTRAINT "RegistroSincronizacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_telefone_key" ON "Usuario"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Tarefa_usuarioId_status_idx" ON "Tarefa"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "Tarefa_usuarioId_dataEntrega_idx" ON "Tarefa"("usuarioId", "dataEntrega");

-- CreateIndex
CREATE INDEX "ConexaoCalendario_usuarioId_status_idx" ON "ConexaoCalendario"("usuarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConexaoCalendario_usuarioId_provedor_key" ON "ConexaoCalendario"("usuarioId", "provedor");

-- CreateIndex
CREATE INDEX "EventoCalendario_usuarioId_provedor_idx" ON "EventoCalendario"("usuarioId", "provedor");

-- CreateIndex
CREATE INDEX "EventoCalendario_tarefaId_idx" ON "EventoCalendario"("tarefaId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoCalendario_provedor_identificadorEventoExterno_key" ON "EventoCalendario"("provedor", "identificadorEventoExterno");

-- CreateIndex
CREATE INDEX "Lembrete_usuarioId_status_agendadoPara_idx" ON "Lembrete"("usuarioId", "status", "agendadoPara");

-- CreateIndex
CREATE INDEX "Lembrete_tarefaId_idx" ON "Lembrete"("tarefaId");

-- CreateIndex
CREATE INDEX "Conversa_telefone_idx" ON "Conversa"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "Conversa_usuarioId_telefone_key" ON "Conversa"("usuarioId", "telefone");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_criadoEm_idx" ON "Mensagem"("conversaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_conversaId_identificadorMensagemExterna_key" ON "Mensagem"("conversaId", "identificadorMensagemExterna");

-- CreateIndex
CREATE INDEX "EventoWebhook_statusProcessamento_recebidoEm_idx" ON "EventoWebhook"("statusProcessamento", "recebidoEm");

-- CreateIndex
CREATE UNIQUE INDEX "EventoWebhook_provedor_identificadorEventoExterno_key" ON "EventoWebhook"("provedor", "identificadorEventoExterno");

-- CreateIndex
CREATE INDEX "RegistroSincronizacao_usuarioId_provedor_iniciadoEm_idx" ON "RegistroSincronizacao"("usuarioId", "provedor", "iniciadoEm");

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConexaoCalendario" ADD CONSTRAINT "ConexaoCalendario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoCalendario" ADD CONSTRAINT "EventoCalendario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoCalendario" ADD CONSTRAINT "EventoCalendario_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lembrete" ADD CONSTRAINT "Lembrete_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "Tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lembrete" ADD CONSTRAINT "Lembrete_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoWebhook" ADD CONSTRAINT "EventoWebhook_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroSincronizacao" ADD CONSTRAINT "RegistroSincronizacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

