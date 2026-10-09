"""
Resumo das perguntas da carga da Empregare por edital (o que a coordenação
liga aos blocos da regra da avaliação documental).

Conta só em Python: o robô da Empregare (scripts/robo-empregare/,
resumo_das_perguntas.py) lê as respostas cruas de cada vaga pela RPC
ler_respostas_pergunta_vaga, resume aqui e grava pronto por
gravar_resumo_pergunta_edital (migration 20261009180000). A tela só lê
(obter_perguntas_carga_analise); nenhuma conta no banco nem no navegador.

Regra de privacidade (a mesma de antes, quando o banco contava na hora):
  - só as colunas "Pergunta N ..." (começo sem diferença de caixa);
  - resposta vazia (só espaços) não conta; a resposta é cortada em 200
    caracteres depois de tirar os espaços das pontas;
  - resposta que aparece UMA vez só não sai (pode ser texto livre com dado
    pessoal): entra só na contagem "outras";
  - até 30 respostas por pergunta (as mais frequentes);
  - "distintas": quantas respostas diferentes a pergunta teve.
Ordem: perguntas pelo número (sem número, no fim) e depois pelo nome;
respostas da mais frequente para a menos e, no empate, pelo texto.
"""

import re
from collections import Counter

MINIMO_DE_REPETICOES = 2
RESPOSTAS_POR_PERGUNTA = 30
TAMANHO_DA_RESPOSTA = 200
_NUMERO = re.compile(r"^Pergunta\s+(\d+)")


def eh_coluna_de_pergunta(coluna):
    """Coluna 'Pergunta N - ...' (o ilike 'Pergunta %' de antes: sem caixa, com o espaço)."""
    return isinstance(coluna, str) and coluna.lower().startswith("pergunta ")


def ordem_da_coluna(coluna):
    """Pelo número da pergunta (sem número vai para o fim) e, no empate, pelo nome."""
    m = _NUMERO.match(coluna)
    return (m is None, int(m.group(1)) if m else 0, coluna.casefold(), coluna)


def texto_da_resposta(valor):
    """A resposta como conta: sem os espaços das pontas, até 200 caracteres; vazia = ''."""
    if valor is None:
        return ""
    texto = valor if isinstance(valor, str) else str(valor)
    return texto.strip(" ")[:TAMANHO_DA_RESPOSTA]


def resumir_perguntas(colunas, linhas):
    """
    colunas: nomes das colunas das vagas do edital (as que não são pergunta saem);
    linhas: um dicionário {coluna: resposta} por candidato ativo, de todas as vagas.
    Devolve [{coluna, respostas: [{valor, quantidade}], outras, distintas}].
    """
    perguntas = sorted({c for c in colunas or [] if eh_coluna_de_pergunta(c)}, key=ordem_da_coluna)
    contagens = {c: Counter() for c in perguntas}
    for linha in linhas or []:
        if not isinstance(linha, dict):
            continue
        for coluna in perguntas:
            texto = texto_da_resposta(linha.get(coluna))
            if texto:
                contagens[coluna][texto] += 1
    resumo = []
    for coluna in perguntas:
        contagem = contagens[coluna]
        repetidas = sorted(
            ((valor, qt) for valor, qt in contagem.items() if qt >= MINIMO_DE_REPETICOES),
            key=lambda par: (-par[1], par[0].casefold(), par[0]),
        )[:RESPOSTAS_POR_PERGUNTA]
        resumo.append(
            {
                "coluna": coluna,
                "respostas": [{"valor": valor, "quantidade": qt} for valor, qt in repetidas],
                "outras": sum(1 for qt in contagem.values() if qt < MINIMO_DE_REPETICOES),
                "distintas": len(contagem),
            }
        )
    return resumo
