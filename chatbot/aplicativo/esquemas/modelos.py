from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field


class UsuarioEntrada(BaseModel):
    id: str
    name: str = "Estudante"
    timezone: str = "America/Sao_Paulo"


class ConversaEntrada(BaseModel):
    id: str


class MensagemEntrada(BaseModel):
    id: str
    content: str = Field(min_length=1, max_length=4000)
    receivedAt: datetime


class ContextoEntrada(BaseModel):
    pendingAction: dict[str, Any] | None = None
    recentTasks: list[dict[str, Any]] = Field(default_factory=list)
    subjects: list[str] = Field(default_factory=list)
    reminderTime: str = "07:27"


class RequisicaoProcessamento(BaseModel):
    user: UsuarioEntrada
    conversation: ConversaEntrada
    message: MensagemEntrada
    context: ContextoEntrada = Field(default_factory=ContextoEntrada)


class Lembrete(BaseModel):
    amount: int = Field(default=1, ge=1, le=365)
    unit: Literal["minute", "hour", "day"] = "day"


class TarefaInterpretada(BaseModel):
    title: str | None = None
    subject: str | None = None
    type: Literal["exam", "assignment", "task", "class", "appointment", "other"] = "task"
    dueDate: str | None = None
    dueTime: str | None = None
    dueDateTime: str | None = None
    timezone: str = "America/Sao_Paulo"
    duration: int | None = None
    priority: Literal["low", "medium", "high"] = "medium"
    notes: str | None = None
    reminders: list[Lembrete] = Field(default_factory=lambda: [Lembrete()])


class RespostaProcessamento(BaseModel):
    intent: Literal["create_task", "create_subject", "edit_task", "delete_task", "list_pending", "list_today", "list_week", "next_exam", "list_overdue", "list_subjects", "get_reminder_time", "set_reminder_time", "complete_task", "confirm", "cancel", "unknown"]
    confidence: float = Field(ge=0, le=1)
    requiresConfirmation: bool = False
    missingFields: list[str] = Field(default_factory=list)
    task: TarefaInterpretada | None = None
    reference: str | None = None
    subject: str | None = None
    reminderTime: str | None = None
    generation: dict[str, Any] | None = None
    response: str
