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


# ── nome de pessoa nos campos livres ─────────────────────────────────────────
# Nenhum campo livre gravado (curso, cargo, instituição, empregador) pode levar
# nome de pessoa. `sem_nome_de_pessoa` corta o valor antes do nome do candidato,
# de marcas de qualificação ("brasileiro", "natural de", "portador do RG") e, nos
# campos estritos (curso, cargo), de um prenome comum seguido de outro nome ou de
# dois sobrenomes comuns seguidos. Na dúvida, o campo fica vazio (None).

PRENOMES_COMUNS = frozenset(
    """
    maria jose joao ana antonio francisco carlos paulo pedro lucas luiz luis marcos gabriel rafael daniel
    marcelo bruno eduardo felipe raimundo rodrigo manoel manuel mateus matheus andre fernando fabio leonardo
    gustavo guilherme leandro tiago thiago anderson ricardo jorge alexandre roberto sergio vitor victor diego
    juliana adriana marcia fernanda patricia aline sandra camila amanda bruna jessica leticia julia luciana
    vanessa mariana gabriela vitoria larissa claudia beatriz luana sonia renata eliane josefa simone natalia
    cristiane carla debora rosangela jaqueline daniela aparecida marlene terezinha raimunda andreia fabiana
    lucia raquel angela rafaela joana luzia elaine priscila tatiana monica francisca antonia edna regina
    helena isabel silvia kelly karina katia cleide denise edson elias emerson fabricio flavio geraldo gilberto
    henrique hugo igor ivan jair joaquim jonas julio kleber leonardo marcio mauricio miguel milton murilo
    nelson osvaldo otavio renato reinaldo rogerio ronaldo samuel sebastiao severino valdir vinicius wagner
    wellington wesley william washington yuri thais tais vera rita rosa sueli suely valeria viviane yasmin
    """.split()
)
SOBRENOMES_COMUNS = frozenset(
    """
    silva santos oliveira souza sousa pereira costa rodrigues almeida nascimento lima araujo fernandes
    carvalho gomes martins rocha ribeiro alves monteiro mendes barros freitas barbosa pinto moura cavalcanti
    cavalcante dias castro campos cardoso teixeira ferreira correia correa nunes vieira moreira batista
    machado lopes soares melo mello reis andrade goncalves marques azevedo bezerra brito farias medeiros
    sales cunha aguiar leite matos mattos fonseca ramos miranda santana xavier queiroz siqueira sampaio
    """.split()
)
_QUALIFICACAO = re.compile(
    r"(?<![a-z])(?:brasileir[oa]s?|nacionalidade|natural\s+d[eoa]|nascid[oa]|portador[a]?\s|filh[oa]\s+d[eoa]|"
    r"estado\s+civil|solteir[oa]|casad[oa]|divorciad[oa]|inscrit[oa]\s+no\s+cpf|rg\s*(?:n|:|\d))"
)
_PONTAS = re.compile(r"^[\s,;:.\-–—/|()\"“”'’«»=]+|[\s,;:\-–—/|(\"“”'’«»=]+$")
_CONECTOR_NO_FIM = re.compile(r"(?:\s+(?:a|ao|aos|as|o|e|de|da|do|das|dos|em|para|por|ate))+$", re.I)


def _palavras_com_posicao(dobrado):
    return [(m.start(), m.group()) for m in _PALAVRA.finditer(dobrado)]


def _arrumar_pontas(valor):
    anterior = None
    while anterior != valor:
        anterior = valor
        valor = _PONTAS.sub("", valor)
        valor = _CONECTOR_NO_FIM.sub("", valor).strip()
    return valor


def sem_nome_de_pessoa(valor, nome_do_candidato=None, estrito=True):
    """O valor cortado antes de qualquer nome de pessoa; None se não sobrar texto (3 letras seguidas)."""
    if not isinstance(valor, str) or not valor.strip():
        return valor if valor is None else None
    dobrado = dobrar(valor)
    cortes = [len(valor)]
    q = _QUALIFICACAO.search(dobrado)
    if q:
        cortes.append(q.start())
    palavras = [(i, p) for i, p in _palavras_com_posicao(dobrado) if p not in PARTICULAS]
    partes = [p for p in partes_do_nome(nome_do_candidato) if len(p) >= 3] if nome_do_candidato else []

    def do_candidato(p):
        return len(p) >= 3 and any(_parecidas(p, x) for x in partes)

    for k, (posicao, palavra) in enumerate(palavras):
        seguinte = palavras[k + 1][1] if k + 1 < len(palavras) else ""
        if (
            partes
            and do_candidato(palavra)
            and (do_candidato(seguinte) or (estrito and _parecidas(palavra, partes[0])))
        ):
            cortes.append(posicao)
            break
        if estrito and (
            (palavra in PRENOMES_COMUNS and seguinte and (seguinte in SOBRENOMES_COMUNS or seguinte in PRENOMES_COMUNS))
            or (palavra in SOBRENOMES_COMUNS and seguinte in SOBRENOMES_COMUNS)
            or (palavra in PRENOMES_COMUNS and k == len(palavras) - 1 and k > 0)
        ):
            cortes.append(posicao)
            break
    limpo = _arrumar_pontas(valor[: min(cortes)])
    return limpo if re.search(r"[A-Za-zÀ-ÿ]{3}", limpo) else None
