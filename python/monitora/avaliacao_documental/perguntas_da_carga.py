"""
Resumo das perguntas da carga da Empregare por edital (o que a coordenação
liga aos blocos da regra da avaliação documental).

Conta só em Python: o robô da Empregare (scripts/robo-empregare/,
resumo_das_perguntas.py) lê as respostas cruas de cada vaga pela RPC
ler_respostas_pergunta_vaga, resume aqui e grava pronto por
gravar_resumo_pergunta_edital (migration 20261009180000). A tela só lê
(obter_perguntas_carga_analise); nenhuma conta no banco nem no navegador.
As respostas são as da exportação (DS_COLUNA_ORIGINAL, uma linha por
candidato), que já é a resposta vigente do questionário — a mais recente,
a mesma que a ficha mostra (20261009210000) — mesmo de quem respondeu mais
de uma vez.

Regra de privacidade (a mesma de antes, quando o banco contava na hora):
  - só as colunas "Pergunta N ..." (começo sem diferença de caixa);
  - resposta vazia (só espaços) não conta; a resposta é cortada em 200
    caracteres depois de tirar os espaços das pontas;
  - resposta que aparece UMA vez só não sai (pode ser texto livre com dado
    pessoal): entra só na contagem "outras";
  - até 30 respostas por pergunta (as mais frequentes);
  - "distintas": quantas respostas diferentes a pergunta teve.
Dado pessoal fica fora do resumo:
  - pergunta cujo enunciado pede dado pessoal (CPF, RG, e-mail, telefone ou
    celular, endereço, CEP, data de nascimento, nome da mãe, PIS/NIS/PASEP,
    matrícula) entra com respostas [] e "dado_pessoal": true — todas as
    respostas contam só em "outras";
  - em qualquer pergunta, resposta com cara de CPF (11 dígitos, com ou sem
    máscara), e-mail, telefone ou CEP vira "outras", mesmo repetida.
Ordem: perguntas pelo número (sem número, no fim) e depois pelo nome;
respostas da mais frequente para a menos e, no empate, pelo texto.
"""

import re
import unicodedata
from collections import Counter

MINIMO_DE_REPETICOES = 2
RESPOSTAS_POR_PERGUNTA = 30
TAMANHO_DA_RESPOSTA = 200
_NUMERO = re.compile(r"^Pergunta\s+(\d+)")

# O que o enunciado pede (sem acento, minúsculo; "Pergunta N -" fora).
_PEDE_DADO_PESSOAL = re.compile(
    r"\b("
    r"cpf|rg|registro geral|carteira de identidade|documento de identidade"
    r"|e-?mail|correio eletronico"
    r"|telefone|celular|whats\s?app|contato telefonico"
    r"|endereco|logradouro|cep"
    r"|data de nascimento|nascimento"
    r"|nome da mae|nome de sua mae|nome da sua mae"
    r"|pis|nis|pasep|nit"
    r"|matricula"
    r")\b"
)
_CPF = re.compile(r"^\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_CEP = re.compile(r"^(\d{5}|\d{2}\.\d{3})-?\d{3}$")
_SO_TELEFONE = re.compile(r"^\+?[\d\s().-]+$")
_TELEFONE_CURTO = re.compile(r"^\d{4,5}-?\d{4}$")


def eh_coluna_de_pergunta(coluna):
    """Coluna 'Pergunta N - ...' (o ilike 'Pergunta %' de antes: sem caixa, com o espaço)."""
    return isinstance(coluna, str) and coluna.lower().startswith("pergunta ")


def ordem_da_coluna(coluna):
    """Pelo número da pergunta (sem número vai para o fim) e, no empate, pelo nome."""
    m = _NUMERO.match(coluna)
    return (m is None, int(m.group(1)) if m else 0, coluna.casefold(), coluna)


def _sem_acento(texto):
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn").lower()


def pede_dado_pessoal(coluna):
    """O enunciado da pergunta pede um dado pessoal (CPF, RG, e-mail, telefone, endereço...)?"""
    enunciado = re.sub(r"^\s*pergunta\s*\d*\s*[-–:.]?\s*", "", _sem_acento(coluna or ""))
    return bool(_PEDE_DADO_PESSOAL.search(enunciado))


def parece_dado_pessoal(valor):
    """A resposta tem cara de CPF, e-mail, telefone ou CEP?"""
    texto = (valor or "").strip()
    if _CPF.match(texto) or _EMAIL.match(texto) or _CEP.match(texto):
        return True
    if _SO_TELEFONE.match(texto):
        digitos = sum(c.isdigit() for c in texto)
        return 10 <= digitos <= 13 or bool(_TELEFONE_CURTO.match(texto))
    return False


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
    Devolve [{coluna, respostas: [{valor, quantidade}], outras, distintas}]; a
    pergunta que pede dado pessoal leva também "dado_pessoal": true (e respostas []).
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
        if pede_dado_pessoal(coluna):
            resumo.append(
                {
                    "coluna": coluna,
                    "respostas": [],
                    "outras": len(contagem),
                    "distintas": len(contagem),
                    "dado_pessoal": True,
                }
            )
            continue
        # Resposta única ou com cara de dado pessoal não sai: só conta em "outras".
        escondidas = {v for v, qt in contagem.items() if qt < MINIMO_DE_REPETICOES or parece_dado_pessoal(v)}
        repetidas = sorted(
            ((valor, qt) for valor, qt in contagem.items() if valor not in escondidas),
            key=lambda par: (-par[1], par[0].casefold(), par[0]),
        )[:RESPOSTAS_POR_PERGUNTA]
        resumo.append(
            {
                "coluna": coluna,
                "respostas": [{"valor": valor, "quantidade": qt} for valor, qt in repetidas],
                "outras": len(escondidas),
                "distintas": len(contagem),
            }
        )
    return resumo
