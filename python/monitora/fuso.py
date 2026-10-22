"""
O fuso de Brasília (America/Sao_Paulo) e a data de hoje nele.

Os jobs rodam no GitHub Actions, cujo relógio é UTC: depois das 21h de
Brasília, `date.today()` já é o dia seguinte. Toda data "de hoje" que vira
regra (dias de vínculo, prazos das conferências) sai de `hoje_em_brasilia()`.
"""

from datetime import UTC, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

try:
    FUSO = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:  # Windows sem o pacote tzdata: o Brasil não tem horário de verão.
    FUSO = timezone(timedelta(hours=-3), "America/Sao_Paulo")


def hoje_em_brasilia(agora=None):
    """A data de hoje em Brasília. `agora`: datetime com fuso (o de teste); sem fuso, é tomado como UTC."""
    if agora is None:
        return datetime.now(FUSO).date()
    if agora.tzinfo is None:
        agora = agora.replace(tzinfo=UTC)
    return agora.astimezone(FUSO).date()
