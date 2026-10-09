"""
O documento é do candidato? Duas perguntas, cada uma com resposta True,
False ou None (não deu para saber):

  nome_confere   o nome do candidato aparece no texto: o primeiro e o último
                 nome inteiros e os do meio inteiros ou abreviados ("Ulisses F.
                 Barbosa", "ULISSES FERREIRA BARBOSA"), sem acento nem caixa,
                 com tolerância de uma ou duas letras em nome longo (OCR);
                 "de/da/do/dos/das/e" não contam.
  cpf_confere    algum CPF válido do documento é o do candidato. O CPF do
                 candidato NUNCA chega aqui: o banco devolve só o sha256 de
                 sal + 11 dígitos (o sal é sorteado a cada execução do robô),
                 e o resultado guardado é só o booleano.
"""

import hashlib
import re

from .texto import dobrar

PARTICULAS = frozenset({"de", "da", "do", "dos", "das", "e", "d"})
_PALAVRA = re.compile(r"[a-z]+")
_CPF = re.compile(r"(?<![\d.])(\d{3})\s?\.?\s?(\d{3})\s?\.?\s?(\d{3})\s?[-.–]?\s?(\d{2})(?![\d])")


def partes_do_nome(nome):
    return [p for p in _PALAVRA.findall(dobrar(nome)) if p not in PARTICULAS]


def _distancia(a, b, teto):
    """Levenshtein com teto (para cedo quando passa)."""
    anterior = list(range(len(b) + 1))
    for i, x in enumerate(a, start=1):
        atual = [i]
        for j, y in enumerate(b, start=1):
            atual.append(min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (x != y)))
        if min(atual) > teto:
            return teto + 1
        anterior = atual
    return anterior[-1]


def _parecidas(a, b):
    """Iguais ou quase (erro de OCR): até 1 letra de diferença em nome de 5 a 7 letras, até 2 em nome maior.
    Nome com menos de 5 letras só igual."""
    if a == b:
        return True
    maior = max(len(a), len(b))
    teto = 0 if maior < 5 else (1 if maior < 8 else 2)
    return teto > 0 and abs(len(a) - len(b)) <= teto and _distancia(a, b, teto) <= teto


def nome_confere(nome_do_candidato, texto):
    """True se o nome aparece no texto; False se não aparece; None sem nome ou sem texto."""
    partes = partes_do_nome(nome_do_candidato)
    palavras = _PALAVRA.findall(dobrar(texto))
    if len(partes) < 2 or len(palavras) < 3:
        return None
    primeiro, ultimo, meio = partes[0], partes[-1], partes[1:-1]
    for i, palavra in enumerate(palavras):
        if not _parecidas(palavra, primeiro):
            continue
        bruta = palavras[i + 1 : i + 1 + 2 * (len(meio) + 2)]
        # O nome é contínuo: o último vem logo depois dos do meio (um nome a mais é tolerado).
        janela = [p for p in bruta if p not in PARTICULAS][: len(meio) + 2]
        if not any(_parecidas(p, ultimo) for p in janela):
            continue
        # As iniciais ("E." de Exemplo) olham a janela inteira: "e" também é partícula.
        achados = sum(1 for m in meio if any(_parecidas(p, m) for p in janela) or m[0] in bruta)
        if not meio or achados * 2 >= len(meio):
            return True
    return False


def digitos_do_cpf_validos(digitos):
    if len(digitos) != 11 or digitos == digitos[0] * 11:
        return False
    numeros = [int(c) for c in digitos]
    for posicao in (9, 10):
        soma = sum(numeros[i] * (posicao + 1 - i) for i in range(posicao))
        resto = (soma * 10) % 11 % 10
        if resto != numeros[posicao]:
            return False
    return True


def cpfs_do_texto(texto):
    """Os CPFs válidos (11 dígitos) do texto. Ficam só na memória: nunca no log nem no banco."""
    achados = []
    for m in _CPF.finditer(str(texto or "")):
        digitos = "".join(m.groups())
        if digitos_do_cpf_validos(digitos) and digitos not in achados:
            achados.append(digitos)
    return achados


def hash_do_cpf(sal, digitos):
    """sha256(sal + 11 dígitos), igual ao que o banco devolve (listar_anexos_para_leitura)."""
    return hashlib.sha256(f"{sal}{str(digitos).zfill(11)}".encode()).hexdigest()


def cpf_confere(texto, sal, hash_do_candidato):
    """True se algum CPF do texto é o do candidato; False se há CPF e nenhum é; None sem CPF no texto."""
    if not sal or not hash_do_candidato:
        return None
    cpfs = cpfs_do_texto(texto)
    if not cpfs:
        return None
    return any(hash_do_cpf(sal, c) == hash_do_candidato for c in cpfs)
