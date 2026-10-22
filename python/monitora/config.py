"""
Leitura de configuração (variáveis de ambiente) com erro claro.

Nenhum segredo fica no código: o GitHub Actions passa os secrets do repositório
como variáveis de ambiente e a Vercel, as variáveis do projeto. Faltou ou veio
num formato errado → `ErroDeConfiguracao` (um SystemExit: o job para com a
mensagem, sem stacktrace) dizendo QUAL variável e onde configurar — nunca o
valor dela.
"""

import os


class ErroDeConfiguracao(SystemExit):
    """Variável ausente ou inválida. A mensagem cita o nome, nunca o valor."""


def ler(nome, *, obrigatoria=True, padrao=None, aceitar=None, dica="", ambiente=None):
    """
    Valor da variável `nome`, sem espaços nas pontas.
      obrigatoria  sem valor → ErroDeConfiguracao (senão devolve `padrao`)
      aceitar      função valor → bool; False → ErroDeConfiguracao
      dica         onde configurar (vai na mensagem de erro)
    """
    a = os.environ if ambiente is None else ambiente
    valor = str(a.get(nome) or "").strip()
    sufixo = f" {dica}" if dica else ""
    if not valor:
        if obrigatoria:
            raise ErroDeConfiguracao(f"Falta a variável {nome}.{sufixo}")
        return padrao
    if aceitar is not None and not aceitar(valor):
        raise ErroDeConfiguracao(f"A variável {nome} está num formato inválido.{sufixo}")
    return valor


def inteiro(nome, *, padrao, minimo=None, maximo=None, ambiente=None):
    """Número inteiro opcional, dentro de [minimo, maximo]."""
    texto = ler(nome, obrigatoria=False, ambiente=ambiente)
    if texto is None:
        return padrao
    try:
        numero = int(texto)
    except ValueError:
        raise ErroDeConfiguracao(f"A variável {nome} deve ser um número inteiro.") from None
    if (minimo is not None and numero < minimo) or (maximo is not None and numero > maximo):
        raise ErroDeConfiguracao(f"A variável {nome} deve ficar entre {minimo} e {maximo}.")
    return numero
