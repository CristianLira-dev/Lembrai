from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
import re

DIAS = {
    "segunda": 0,
    "terca": 1,
    "terça": 1,
    "quarta": 2,
    "quinta": 3,
    "sexta": 4,
    "sabado": 5,
    "sábado": 5,
    "domingo": 6,
}


def agora_no_fuso(fuso: str) -> datetime:
    try:
        return datetime.now(ZoneInfo(fuso))
    except Exception:
        return datetime.now(ZoneInfo("America/Sao_Paulo"))


def extrair_horario(texto: str) -> tuple[str | None, str | None]:
    padroes = [
        r"(?:às|as|a)\s*(\d{1,2})(?:h|:)(\d{2})?",
        r"\b(\d{1,2}):(\d{2})\b",
        r"\b(\d{1,2})h(\d{2})?\b",
    ]
    for padrao in padroes:
        encontrado = re.search(padrao, texto.lower())
        if encontrado:
            hora = int(encontrado.group(1))
            minuto = int(encontrado.group(2) or 0)
            if hora > 23 or minuto > 59:
                return None, encontrado.group(0)
            return f"{hora:02d}:{minuto:02d}", encontrado.group(0)
    return None, None


def extrair_data(texto: str, fuso: str, referencia: datetime | None = None) -> tuple[date | None, str | None]:
    agora = (referencia.replace(tzinfo=ZoneInfo(fuso)) if referencia and referencia.tzinfo is None else referencia.astimezone(ZoneInfo(fuso))) if referencia else agora_no_fuso(fuso)
    baixo = texto.lower()
    if "hoje" in baixo:
        return agora.date(), "hoje"
    if "depois de amanhã" in baixo or "depois de amanha" in baixo:
        return agora.date() + timedelta(days=2), "depois de amanhã"
    if "amanhã" in baixo or "amanha" in baixo:
        return agora.date() + timedelta(days=1), "amanhã"

    correspondencia = re.search(r"\b(?:dia\s*)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b", baixo)
    if correspondencia:
        dia, mes = int(correspondencia.group(1)), int(correspondencia.group(2))
        ano = int(correspondencia.group(3) or agora.year)
        if ano < 100: ano += 2000
        try:
            data = date(ano, mes, dia)
            if not correspondencia.group(3) and data < agora.date(): data = date(ano + 1, mes, dia)
            return data, correspondencia.group(0)
        except ValueError:
            return None, correspondencia.group(0)

    correspondencia = re.search(r"\bdia\s+(\d{1,2})\b", baixo)
    if correspondencia:
        dia = int(correspondencia.group(1))
        try:
            data = date(agora.year, agora.month, dia)
            if data < agora.date():
                proximo_mes = (data.replace(day=28) + timedelta(days=4)).replace(day=1)
                data = date(proximo_mes.year, proximo_mes.month, dia)
            return data, correspondencia.group(0)
        except ValueError:
            return None, correspondencia.group(0)

    for nome, indice in DIAS.items():
        if re.search(rf"\b{re.escape(nome)}(?:-feira)?\b", baixo):
            delta = (indice - agora.weekday()) % 7
            if "semana que vem" in baixo:
                delta = 7 - agora.weekday() + indice
            if delta == 0 and ("próxima" in baixo or "proxima" in baixo): delta = 7
            return agora.date() + timedelta(days=delta), nome

    if "semana que vem" in baixo or "proxima semana" in baixo or "próxima semana" in baixo:
        inicio = agora.date() - timedelta(days=agora.weekday()) + timedelta(days=7)
        return inicio, "semana que vem"
    return None, None


def combinar_data_horario(data: date | None, horario: str | None, fuso: str) -> str | None:
    if not data: return None
    hora = time.fromisoformat(horario or "23:59")
    return datetime.combine(data, hora, tzinfo=ZoneInfo(fuso)).isoformat()
