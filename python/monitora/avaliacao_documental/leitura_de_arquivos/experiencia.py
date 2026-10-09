"""
Comprovantes de EXPERIÊNCIA: um item VINCULO por vínculo achado.

O tipo do documento (CTPS, DECLARACAO, CONTRATO, CERTIDAO, HOLERITE) sai do
texto, e a leitura vai por três caminhos, nesta ordem:

  1. campos rotulados (CTPS digital ou física, ficha de registro, declaração
     em formulário): cada "Admissão" abre um vínculo, com o "Empregador"/
     "Razão social", o "Cargo"/"Ocupação"/"Função", o "Desligamento"/
     "Demissão"/"Saída" (sem ele, na CTPS, o vínculo está em aberto: atual);
  2. texto corrido (declaração, contrato, certidão de tempo de serviço):
     "no período de A a B", "de A até a presente data", "desde A",
     "admitido(a) em A", com o cargo ("no cargo/na função de X") e o
     empregador (o cabeçalho com Prefeitura, Secretaria, Hospital, Ltda…);
  3. holerites: as competências (mês/ano) viram um vínculo do primeiro ao
     último mês.

De cada um: empregador, cargo, início, fim (ou atual: fim = a data de emissão
do documento, se houver), carga horária semanal (se o texto disser) e dias
(fim − início + 1; atual sem emissão conta até hoje). Período com o fim antes
do início é descartado.
"""

import re
from datetime import date

from .pessoas import nome_confere
from .texto import Data, datas_no_texto, dobrar, iso, trecho

TIPOS = (
    ("CTPS", r"carteira de trabalho|ctps|contratos? de trabalho .{0,40}admiss|carteira digital"),
    (
        "HOLERITE",
        r"contracheque|contra-cheque|holerite|demonstrativo de pagamento|recibo de pagamento|folha de pagamento",
    ),
    ("CERTIDAO", r"certidao de tempo|tempo de servico|tempo de contribuicao|averbacao"),
    (
        "CONTRATO",
        r"contrato (?:individual |por prazo determinado |temporario )?de (?:trabalho|prestacao)|termo de contrato|clausula",
    ),
    ("DECLARACAO", r"declar|atest"),
)
_ADMISSAO = re.compile(
    r"(?:data\s+(?:de\s+)?)?admiss(?:ao|ão)|admitid[oa]\s+em|data\s+de\s+entrada|inicio\s+do\s+(?:contrato|vinculo)"
)
_DESLIGAMENTO = re.compile(
    r"(?:data\s+(?:de\s+|da\s+)?)?(?:desligamento|demissao|rescisao|saida|termino|encerramento|afastamento definitivo)"
    r"|fim\s+do\s+(?:contrato|vinculo)|desligad[oa]\s+em|exonerad[oa]\s+em"
)
_EMPREGADOR = re.compile(
    r"(?<![a-z])(?:empregador|razao social|nome empresarial|empresa|contratante|orgao|instituicao)\s*:?\s*"
)
_CARGO = re.compile(r"(?<![a-z])(?:cargo|ocupacao|funcao|emprego)\s*(?::|de\s|\s)\s*")
_CARGO_NARRADO = re.compile(
    r"(?:no|o|ao|do)\s+cargo\s+de\s+|(?:na|a|da)\s+funcao\s+de\s+|como\s+|exercendo\s+(?:o|a)\s+(?:cargo|funcao)\s+de\s+"
)
_FIM_DO_CAMPO = re.compile(
    r"\n|\s(?:cnpj|cpf|cbo|admiss|data|salario|remuneracao|matricula|codigo|no periodo|desde|de\s+\d|a partir)|[,;(]"
)
_ATUAL = re.compile(
    r"ate\s+(?:a\s+presente\s+data|o\s+presente\s+momento|o\s+momento|os\s+dias\s+atuais|hoje|a\s+data\s+atual|o\s+presente)"
    r"|atualmente|em\s+exercicio|em\s+aberto|vinculo\s+ativo|ate\s+a\s+presente|sem\s+data\s+de\s+(?:saida|desligamento)"
)
_CONECTOR = re.compile(r"\s*(?:a|ate|à|-|–|—|e|ao)\s*")
_DESDE = re.compile(
    r"(?:desde|a\s+partir\s+de|admitid[oa]\s+em|iniciad[oa]\s+em|inicio\s+em|ingressou\s+em|com\s+inicio\s+em)\s*$"
)
_COMPETENCIA = re.compile(r"(?:competencia|referencia|mes/ano|periodo de referencia|mes de referencia)\s*:?\s*$")
_CARGA_SEMANAL = re.compile(
    r"(\d{1,2})\s*(?:h|horas?)\s*(?:semanais|semanal|por\s+semana|/\s*semana|/\s*sem)"
    r"|carga\s+horaria\s+(?:semanal\s+)?de\s+(\d{1,2})\s*(?:h|horas?)\s*(?:semanais|semanal|por\s+semana)"
)
_EMPRESA_NO_CABECALHO = re.compile(
    r"(?<![a-z])(prefeitura|secretaria|hospital|fundacao|instituto|ltda|s/a|s\.a\.|eireli|associacao|clinica|"
    r"cooperativa|consorcio|governo|ministerio|universidade|empresa|servicos|saude|distrito sanitario|dsei|"
    r"unidade|centro|laboratorio|farmacia|escola|camara|municipio|estado de|organizacao|agencia|banco)(?![a-z])"
)
_NAO_E_EMPREGADOR = re.compile(r"^(?:declara|certific|atest|a quem|para os devidos|ilmo|prezad|ref|assunto)")

MAXIMO_DE_VINCULOS = 20


def tipo_do_documento(dobrado):
    for codigo, padrao in TIPOS:
        if re.search(padrao, dobrado):
            return codigo
    return "OUTRO"


def _valor_do_campo(original, dobrado, posicao, maximo=120):
    """O valor depois do rótulo: na mesma linha ou, se ela acabou, na linha seguinte."""
    fim_da_linha = dobrado.find("\n", posicao)
    fim_da_linha = len(dobrado) if fim_da_linha < 0 else fim_da_linha
    if not dobrado[posicao:fim_da_linha].strip(" :-"):
        posicao = fim_da_linha + 1
    resto = dobrado[posicao : posicao + 300]
    corte = _FIM_DO_CAMPO.search(resto)
    valor = trecho(original, posicao, posicao + (corte.start() if corte else len(resto)), maximo)
    return valor if re.search(r"[A-Za-zÀ-ÿ]{2}", valor or "") else None


def _data_depois(datas, posicao, alcance=60):
    for d in datas:
        if 0 <= d.inicio - posicao <= alcance:
            return d
    return None


def empregador_do_cabecalho(original, dobrado):
    """A primeira das 12 primeiras linhas com cara de instituição (Prefeitura, Hospital, Ltda…)."""
    inicio = 0
    for _ in range(12):
        fim = dobrado.find("\n", inicio)
        fim = len(dobrado) if fim < 0 else fim
        linha = dobrado[inicio:fim].strip()
        if linha and not _NAO_E_EMPREGADOR.match(linha) and _EMPRESA_NO_CABECALHO.search(linha) and len(linha) <= 160:
            return trecho(original, inicio, fim, 120)
        if fim >= len(dobrado):
            break
        inicio = fim + 1
    return None


def carga_semanal(dobrado):
    m = _CARGA_SEMANAL.search(dobrado)
    if not m:
        return None
    horas = int(m.group(1) or m.group(2))
    return horas if 1 <= horas <= 80 else None


def data_de_emissao(dobrado, datas):
    """A data do documento: a última data completa do texto (a do local e data da assinatura)."""
    completas = [d for d in datas if d.dia]
    return completas[-1].primeiro_dia() if completas else None


def _vinculo(documento, empregador, cargo, inicio, fim, atual, carga, pagina):
    return {
        "tipo": "VINCULO",
        "documento": documento,
        "empregador": empregador,
        "cargo": cargo,
        "inicio": inicio,
        "fim": fim,
        "atual": bool(atual),
        "carga_semanal": carga,
        "pagina": pagina,
    }


def _campo_no_trecho(padrao, original, dobrado, inicio, fim, maximo, do_fim=False):
    """O valor do primeiro (ou do último, `do_fim`) rótulo com valor no trecho [inicio, fim)."""
    achados = list(padrao.finditer(dobrado, inicio, fim))
    for r in reversed(achados) if do_fim else achados:
        valor = _valor_do_campo(original, dobrado, r.end(), maximo)
        if valor:
            return valor
    return None


def _rotulados(original, dobrado, datas, documento, pagina_de):
    """
    Cada "Admissão" abre um vínculo. Os campos do vínculo vêm ANTES dela (desde o
    fim do vínculo anterior: Empregador, Cargo) ou DEPOIS (até a próxima admissão:
    Desligamento e, em formulário, os outros campos).
    """
    itens = []
    admissoes = list(_ADMISSAO.finditer(dobrado))
    consumido = 0
    for i, m in enumerate(admissoes):
        entrada = _data_depois(datas, m.end())
        if not entrada:
            continue
        antes_de = max(consumido, m.start() - 600)
        ate = admissoes[i + 1].start() if i + 1 < len(admissoes) else min(len(dobrado), m.end() + 600)
        depois = dobrado[entrada.fim : ate]
        saida = None
        d = _DESLIGAMENTO.search(depois)
        if d:
            saida = _data_depois(datas, entrada.fim + d.end())
        atual = not saida and (documento == "CTPS" or bool(_ATUAL.search(depois)))
        empregador = _campo_no_trecho(_EMPREGADOR, original, dobrado, antes_de, m.start(), 120, True) or (
            _campo_no_trecho(_EMPREGADOR, original, dobrado, entrada.fim, ate, 120)
        )
        cargo = _campo_no_trecho(_CARGO, original, dobrado, antes_de, m.start(), 80, True) or (
            _campo_no_trecho(_CARGO, original, dobrado, entrada.fim, ate, 80)
        )
        consumido = saida.fim if saida else entrada.fim
        itens.append(
            _vinculo(
                documento,
                empregador,
                cargo,
                entrada.primeiro_dia(),
                saida.ultimo_dia() if saida else None,
                atual,
                carga_semanal(dobrado[antes_de:ate]),
                pagina_de(m.start()),
            )
        )
    return itens


def _periodos(original, dobrado, datas, documento, pagina_de):
    itens = []
    usadas = set()
    for a, b in zip(datas, datas[1:], strict=False):
        meio = dobrado[a.fim : b.inicio]
        if len(meio) > 6 or not _CONECTOR.fullmatch(meio):
            continue
        if id(a) in usadas:
            continue
        usadas.update({id(a), id(b)})
        itens.append((a, b, False))
    for a in datas:
        if id(a) in usadas:
            continue
        antes = dobrado[max(0, a.inicio - 40) : a.inicio]
        depois = dobrado[a.fim : a.fim + 60]
        if _DESDE.search(antes) or (_ATUAL.search(depois) and re.search(r"(?:de|desde)\s*$", antes)):
            usadas.add(id(a))
            itens.append((a, None, True))
    saida = []
    for a, b, atual in itens:
        contexto = dobrado[max(0, a.inicio - 400) : a.inicio]
        cargo = None
        for c in _CARGO_NARRADO.finditer(dobrado[max(0, a.inicio - 400) : a.fim + 200]):
            base = max(0, a.inicio - 400) + c.end()
            cargo = _valor_do_campo(original, dobrado, base, 80)
            if cargo:
                break
        empregador = None
        for e in _EMPREGADOR.finditer(contexto):
            empregador = _valor_do_campo(original, dobrado, max(0, a.inicio - 400) + e.end())
            if empregador:
                break
        saida.append(
            _vinculo(
                documento,
                empregador,
                cargo,
                a.primeiro_dia(),
                b.ultimo_dia() if b else None,
                atual,
                None,
                pagina_de(a.inicio),
            )
        )
    return saida


def _holerites(dobrado, datas, documento, pagina_de):
    meses = sorted(
        {
            (d.ano, d.mes)
            for d in datas
            if _COMPETENCIA.search(dobrado[max(0, d.inicio - 40) : d.inicio])
            or (d.precisao == "mes" and documento == "HOLERITE")
        }
    )
    if not meses:
        return []
    primeiro = Data(0, 0, meses[0][0], meses[0][1], None)
    ultimo = Data(0, 0, meses[-1][0], meses[-1][1], None)
    posicao = next((d.inicio for d in datas if (d.ano, d.mes) == meses[0]), 0)
    return [
        _vinculo(documento, None, None, primeiro.primeiro_dia(), ultimo.ultimo_dia(), False, None, pagina_de(posicao))
    ]


def _paginador(paginas):
    """O texto inteiro e a função posição → número da página."""
    partes, limites, posicao = [], [], 0
    for p in paginas:
        partes.append(p.texto)
        limites.append((posicao, p.numero))
        posicao += len(p.texto) + 1
    texto = "\n".join(partes)

    def pagina_de(i):
        numero = limites[0][1] if limites else 1
        for comeco, n in limites:
            if comeco <= i:
                numero = n
        return numero

    return texto, pagina_de


def dias_do_vinculo(inicio, fim, hoje):
    final = fim or hoje
    return max(0, (final - inicio).days + 1) if inicio and final and final >= inicio else 0


def vinculos(paginas, nome_do_candidato=None, hoje=None):
    """Os itens VINCULO do arquivo, na ordem do texto, sem repetição."""
    hoje = hoje or date.today()
    original, pagina_de = _paginador(paginas)
    dobrado = dobrar(original)
    datas = datas_no_texto(dobrado)
    documento = tipo_do_documento(dobrado)
    itens = []
    if documento == "HOLERITE":
        itens = _holerites(dobrado, datas, documento, pagina_de)
    if not itens:
        itens = _rotulados(original, dobrado, datas, documento, pagina_de)
    if not itens:
        itens = _periodos(original, dobrado, datas, documento, pagina_de)
    cabecalho = empregador_do_cabecalho(original, dobrado)
    emissao = data_de_emissao(dobrado, datas)
    vistos, saida = set(), []
    for it in itens:
        if it["fim"] and it["fim"] < it["inicio"]:
            continue
        chave = (it["inicio"], it["fim"])
        if chave in vistos:
            continue
        vistos.add(chave)
        if not it["empregador"]:
            it["empregador"] = cabecalho
        fim = it["fim"] or (emissao if it["atual"] and emissao and emissao >= it["inicio"] else None)
        it["dias"] = dias_do_vinculo(it["inicio"], fim, hoje)
        it["fim"] = fim
        it["inicio"], it["fim"] = iso(it["inicio"]), iso(it["fim"])
        if not it["carga_semanal"]:
            it["carga_semanal"] = carga_semanal(dobrado)
        it["nome_confere"] = nome_confere(nome_do_candidato, original) if nome_do_candidato else None
        saida.append(it)
    return saida[:MAXIMO_DE_VINCULOS]


def sobrepostos(itens):
    """Os índices dos vínculos que se sobrepõem a outro do mesmo arquivo."""
    marcados = set()
    datas = [
        (i, it.get("inicio"), it.get("fim") or "9999-12-31")
        for i, it in enumerate(itens)
        if it.get("tipo") == "VINCULO"
    ]
    for x in range(len(datas)):
        for y in range(x + 1, len(datas)):
            i, a1, b1 = datas[x]
            j, a2, b2 = datas[y]
            if a1 and a2 and a1 <= b2 and a2 <= b1:
                marcados.update({i, j})
    return sorted(marcados)
