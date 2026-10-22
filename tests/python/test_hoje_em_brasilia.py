"""
A data de "hoje" no fuso de Brasília (python/monitora/fuso.py). O runner do GitHub Actions roda em UTC:
depois das 21h de Brasília, date.today() já é amanhã — e os dias do vínculo atual e as conferências
de prazo saíam com um dia a mais. Nada fala com a rede.
"""

import pathlib
import re
from datetime import UTC, date, datetime, timedelta, timezone

from monitora import execucao, fuso

_RAIZ = pathlib.Path(__file__).resolve().parents[2]


def test_noite_em_brasilia_ainda_e_o_mesmo_dia():
    # 23h30 de 22/10 em Brasília = 02h30 de 23/10 em UTC.
    assert fuso.hoje_em_brasilia(datetime(2026, 10, 23, 2, 30, tzinfo=UTC)) == date(2026, 10, 22)
    assert fuso.hoje_em_brasilia(datetime(2026, 10, 23, 2, 30)) == date(2026, 10, 22)  # sem fuso: UTC
    assert fuso.hoje_em_brasilia(datetime(2026, 10, 23, 3, 0, tzinfo=UTC)) == date(2026, 10, 23)
    outro = timezone(timedelta(hours=9))
    assert fuso.hoje_em_brasilia(datetime(2026, 10, 23, 10, 0, tzinfo=outro)) == date(2026, 10, 22)


def test_sem_argumento_e_a_data_de_agora_em_brasilia():
    assert fuso.hoje_em_brasilia() == datetime.now(fuso.FUSO).date()


def test_execucao_usa_o_mesmo_fuso():
    assert execucao.FUSO is fuso.FUSO


def test_nenhum_date_today_no_python_do_monitora():
    """A data de hoje das regras sai de hoje_em_brasilia(): date.today() pega o dia do servidor (UTC)."""
    achados = []
    for pasta in ("python", "scripts"):  # api/ (Vercel) não leva a base monitora
        for arquivo in (_RAIZ / pasta).rglob("*.py"):
            for n, linha in enumerate(arquivo.read_text(encoding="utf-8").splitlines(), start=1):
                codigo = linha.split("#", 1)[0]
                if re.search(r"\bdate\.today\(\)", codigo) and "`date.today()`" not in linha:
                    achados.append(f"{arquivo.relative_to(_RAIZ)}:{n}")
    assert achados == []
