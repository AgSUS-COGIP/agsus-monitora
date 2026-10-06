"""
Logging dos jobs que nunca imprime dado pessoal.

    from monitora.registro import registro
    log = registro("conferencias")
    log.info("%s avisos em %s editais", 12, 3)

Todo registro passa por `monitora.mascaramento.mascarar` (mensagem já com os
argumentos aplicados, e também o texto de exceção) antes de ir para a saída.
Ainda assim, a regra é não montar mensagem com nome, CPF ou e-mail: log
público leva contagens, códigos e números de edital.
"""

import logging
import sys

from monitora.mascaramento import mascarar

_FORMATO = "%(levelname)s %(name)s: %(message)s"


class FiltroDeMascaramento(logging.Filter):
    """Aplica `mascarar` na mensagem final (e na exceção) de cada registro."""

    def filter(self, record):
        record.msg = mascarar(record.getMessage())
        record.args = None
        if record.exc_info:
            erro = record.exc_info[1]
            record.msg = f"{record.msg} ({mascarar(f'{type(erro).__name__}: {erro}')})"
            record.exc_info = None
            record.exc_text = None
        return True


def registro(nome, nivel=logging.INFO, saida=None):
    """Logger `monitora.<nome>` com o filtro de mascaramento (idempotente)."""
    logger = logging.getLogger(f"monitora.{nome}")
    logger.setLevel(nivel)
    logger.propagate = False
    if not any(isinstance(f, FiltroDeMascaramento) for f in logger.filters):
        logger.addFilter(FiltroDeMascaramento())
    if not logger.handlers:
        manipulador = logging.StreamHandler(saida or sys.stdout)
        manipulador.setFormatter(logging.Formatter(_FORMATO))
        logger.addHandler(manipulador)
    return logger
