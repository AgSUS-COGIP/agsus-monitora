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

De cada um: empregador, cargo (sem o código: "001-TECNICO DE ENFERMAGEM
3222-05" → "Técnico de enfermagem", o CBO à parte em `cbo`), início, fim,
atual, carga horária semanal (se o texto disser) e dias. Vínculo sem data de
saída é ATUAL e fica com fim None; os dias dele são contados até a data de
emissão do documento (`dias_ate`) ou, sem ela, até hoje (`dias_ate` None) — só
para o número exibido. Período com o fim antes do início é descartado, e
também o "vínculo" que começa na própria data de emissão sem empregador (o
rodapé "emitido em") e o repetido sem empregador com o mesmo início de outro.

Sobreposição (`sobrepostos`): só conta quando dois vínculos dividem mais de um
dia (o atual que começa no dia em que o anterior acabou não conta). Com
empregadores diferentes é PERIODO_CONCOMITANTE (aviso leve: dois empregos ao
mesmo tempo podem ser legítimos); com o mesmo empregador, ou sem saber, é
PERIODO_SOBREPOSTO.
"""

import re
from datetime import date

from .pessoas import nome_confere
from .texto import Data, datas_no_texto, dobrar, iso, numa_linha, trecho

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
    r"|fim\s+do\s+(?:contrato|vinculo)|(?:desligad|exonerad|demitid|dispensad|rescindid|encerrad)[oa]\s+em"
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
    r"|vem\s+(?:exercendo|trabalhando|desempenhando|atuando)|faz\s+parte\s+do\s+quadro|(?:e|esta)\s+lotad[oa]"
    r"|permanece|continua\s+(?:a\s+)?(?:exercer|trabalhar|atuar)"
)
_CONECTOR = re.compile(r"\s*(?:a|ate|à|-|–|—|e|ao)\s*")
_DESDE = re.compile(
    r"(?:desde|a\s+partir\s+de|(?:admitid|contratad|nomead|empossad|iniciad)[oa]\s+(?:\w+\s+){0,3}em|inicio\s+em|"
    r"ingressou\s+(?:\w+\s+){0,3}em|com\s+inicio\s+em|em\s+exercicio\s+desde|data\s+de\s+admissao\s*:?)\s*$"
)
_ATE_A_SAIDA = re.compile(
    r"(?:(?<![a-z])ate(?:\s+(?:o\s+dia|a\s+data\s+de|o\s+mes\s+de|em))?|"
    r"(?:desligad|exonerad|demitid|dispensad|rescindid|encerrad|afastad)[oa]\s+(?:\w+\s+){0,2}em|"
    r"(?:desligamento|demissao|rescisao|saida|termino|encerramento)\s+(?:em|no\s+dia)?)\s*:?\s*$"
)
# Declaração de tempo de serviço/vínculo: o candidato trabalha/trabalhou ali (não é declaração de curso).
DECLARACAO_DE_VINCULO = re.compile(
    r"(?:trabalh|exerc|admitid|contratad|prestou\s+servic|presta\s+servic|funcionari|vinculo|empregad|lotad|"
    r"tempo\s+de\s+servico|cargo\s+de|funcao\s+de|servidor)"
)
_CBO = re.compile(r"(?:cbo\s*:?\s*)?(?<!\d)(\d{4})\s?-\s?(\d)\s?(\d)(?!\d)|cbo\s*:?\s*(\d{4})(\d{2})(?!\d)")
_CODIGO_NA_FRENTE = re.compile(r"^\s*\d{1,4}\s*[-–.)]\s*")
_NAO_E_CARGO = re.compile(r"^(?:exercid[oa]|atual|anterior|cbo|codigo|n[ºo°]?)$")
_ACENTOS_DO_CARGO = {
    "tecnico": "técnico", "tecnica": "técnica", "medico": "médico", "medica": "médica", "saude": "saúde",
    "farmaceutico": "farmacêutico", "farmaceutica": "farmacêutica", "psicologo": "psicólogo",
    "psicologa": "psicóloga", "odontologo": "odontólogo", "cirurgiao": "cirurgião", "indigena": "indígena",
    "servicos": "serviços", "administracao": "administração", "gestao": "gestão", "coordenacao": "coordenação",
    "nutricao": "nutrição", "fonoaudiologo": "fonoaudiólogo", "fonoaudiologa": "fonoaudióloga",
    "analise": "análise", "biologo": "biólogo", "biologa": "bióloga", "farmacia": "farmácia",
    "clinico": "clínico", "clinica": "clínica", "laboratorio": "laboratório", "comunitario": "comunitário",
    "comunitaria": "comunitária", "veterinario": "veterinário", "veterinaria": "veterinária",
    "assistencia": "assistência", "obstetrica": "obstétrica", "familia": "família", "publica": "pública",
    "seguranca": "segurança",
}  # fmt: skip
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


def limpar_cargo(valor):
    """(cargo, cbo): sem o código na frente nem o CBO ("001-TECNICO DE ENFERMAGEM 3222-05" →
    ("Técnico de enfermagem", "3222-05")); cargo None se sobrar só rótulo ("exercido")."""
    if not valor:
        return None, None
    cbo = None
    m = _CBO.search(dobrar(valor))
    if m:
        g = m.groups()
        cbo = f"{g[0]}-{g[1]}{g[2]}" if g[0] else f"{g[3]}-{g[4]}"
        valor = valor[: m.start()] + " " + valor[m.end() :]
    valor = re.sub(r"(?i)(?<![a-zà-ÿ])cbo(?![a-zà-ÿ])\s*:?", " ", valor)
    valor = numa_linha(_CODIGO_NA_FRENTE.sub("", valor)).strip(" -–:;,.")
    palavras = valor.split()
    while palavras and _NAO_E_CARGO.match(dobrar(palavras[0]).strip(".:")):
        palavras.pop(0)
    valor = " ".join(palavras).strip(" -–:;,.")
    if not re.search(r"[A-Za-zÀ-ÿ]{3}", valor):
        return None, cbo
    if valor == valor.upper():
        valor = " ".join(_ACENTOS_DO_CARGO.get(p, p) for p in valor.lower().split())
        valor = valor[0].upper() + valor[1:]
    return valor, cbo


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


def _campo_no_trecho(padrao, original, dobrado, inicio, fim, maximo, do_fim=False, aceita=None):
    """O valor do primeiro (ou do último, `do_fim`) rótulo com valor no trecho [inicio, fim)."""
    achados = list(padrao.finditer(dobrado, inicio, fim))
    for r in reversed(achados) if do_fim else achados:
        valor = _valor_do_campo(original, dobrado, r.end(), maximo)
        if valor and (aceita is None or aceita(valor)):
            return valor
    return None


def _cargo_de_verdade(valor):
    return limpar_cargo(valor)[0] is not None


def _rotulados(original, dobrado, datas, documento, pagina_de):
    """
    Cada "Admissão" abre um vínculo. Os campos do vínculo vêm ANTES dela (desde o
    fim do vínculo anterior: Empregador, Cargo) ou DEPOIS (até a próxima admissão:
    Desligamento e, em formulário, os outros campos).
    """
    itens = []
    admissoes = list(_ADMISSAO.finditer(dobrado))
    consumido = 0
    # Layout com os rótulos ANTES da admissão (CTPS: Empregador, Cargo, Admissão): o rótulo depois da
    # admissão é do vínculo seguinte e não se procura ali (senão um sub-registro rouba o empregador).
    rotulos_antes = bool(admissoes) and bool(
        _EMPREGADOR.search(dobrado, max(0, admissoes[0].start() - 600), admissoes[0].start())
    )
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
        if not saida and _DESLIGAMENTO.search(dobrado, m.end(), entrada.inicio):
            # Rótulos no cabeçalho da tabela ("Admissão  Desligamento" e, embaixo, as duas datas).
            seguinte = next((x for x in datas if x.inicio >= entrada.fim), None)
            if seguinte and re.fullmatch(r"[\s|]{0,30}", dobrado[entrada.fim : seguinte.inicio]):
                saida = seguinte
        atual = not saida and (documento == "CTPS" or bool(_ATUAL.search(depois)))
        proximo_empregador = _EMPREGADOR.search(dobrado, entrada.fim, ate)
        ate_dos_campos = proximo_empregador.start() if rotulos_antes and proximo_empregador else ate
        empregador = _campo_no_trecho(_EMPREGADOR, original, dobrado, antes_de, m.start(), 120, True) or (
            None if rotulos_antes else _campo_no_trecho(_EMPREGADOR, original, dobrado, entrada.fim, ate, 120)
        )
        cargo = _campo_no_trecho(_CARGO, original, dobrado, antes_de, m.start(), 80, True, _cargo_de_verdade) or (
            _campo_no_trecho(_CARGO, original, dobrado, entrada.fim, ate_dos_campos, 80, aceita=_cargo_de_verdade)
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
        antes = dobrado[max(0, a.inicio - 60) : a.inicio]
        depois = dobrado[a.fim : a.fim + 60]
        if _DESDE.search(antes) or (_ATUAL.search(depois) and re.search(r"(?:de|desde)\s*$", antes)):
            usadas.add(id(a))
            # "contratada em A ... e trabalhou até B" / "admitido em A e desligado em B": B fecha o período.
            fim = next(
                (
                    b
                    for b in datas
                    if b.inicio > a.fim
                    and id(b) not in usadas
                    and b.inicio - a.fim <= 250
                    and _ATE_A_SAIDA.search(dobrado[max(a.fim, b.inicio - 40) : b.inicio])
                ),
                None,
            )
            if fim is not None and fim.ultimo_dia() >= a.primeiro_dia():
                usadas.add(id(fim))
                itens.append((a, fim, False))
            else:
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


def _sem_repetidos(itens, emissao):
    """Tira o rodapé (começa na data de emissão, sem saída nem empregador) e o vínculo sem empregador
    com o mesmo início de outro que tem (o cargo dele passa para o outro, se faltar)."""
    saida = []
    for it in itens:
        if not it["fim"] and not it["empregador"] and emissao and it["inicio"] == emissao:
            continue
        if not it["empregador"]:
            par = next((o for o in itens if o is not it and o["empregador"] and o["inicio"] == it["inicio"]), None)
            if par is not None:
                par["cargo"] = par["cargo"] or it["cargo"]
                continue
        saida.append(it)
    return saida


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
    itens = _sem_repetidos([it for it in itens if not (it["fim"] and it["fim"] < it["inicio"])], emissao)
    vistos, saida = set(), []
    for it in itens:
        chave = (it["inicio"], it["fim"])
        if chave in vistos:
            continue
        vistos.add(chave)
        if not it["empregador"]:
            it["empregador"] = cabecalho
        it["cargo"], cbo = limpar_cargo(it["cargo"])
        if cbo:
            it["cbo"] = cbo
        it["atual"] = bool(it["atual"]) and not it["fim"]
        # Atual: fim None; os dias vão até a emissão do documento (dias_ate) ou, sem ela, até hoje.
        ate = emissao if it["atual"] and emissao and emissao >= it["inicio"] else None
        it["dias"] = dias_do_vinculo(it["inicio"], it["fim"] or ate, hoje)
        if it["atual"]:
            it["dias_ate"] = iso(ate)
        it["inicio"], it["fim"] = iso(it["inicio"]), iso(it["fim"])
        if not it["carga_semanal"]:
            it["carga_semanal"] = carga_semanal(dobrado)
        it["nome_confere"] = nome_confere(nome_do_candidato, original) if nome_do_candidato else None
        saida.append(it)
    return saida[:MAXIMO_DE_VINCULOS]


def _mesmo_empregador(a, b):
    x, y = dobrar(a or "").strip(), dobrar(b or "").strip()
    return not x or not y or x == y or x.startswith(y) or y.startswith(x)


def _dia(valor):
    try:
        return date.fromisoformat(valor) if valor else None
    except ValueError:
        return None


def sobrepostos(itens, hoje=None):
    """{índice: código} dos vínculos que dividem mais de um dia com outro do arquivo:
    PERIODO_SOBREPOSTO (mesmo empregador ou sem saber) ou PERIODO_CONCOMITANTE (empregadores diferentes)."""
    hoje = hoje or date.today()
    periodos = []
    for i, it in enumerate(itens):
        inicio = _dia(it.get("inicio"))
        if it.get("tipo") != "VINCULO" or not inicio:
            continue
        fim = _dia(it.get("fim")) or ((_dia(it.get("dias_ate")) or hoje) if it.get("atual") else None)
        if fim:
            periodos.append((i, inicio, fim, it.get("empregador")))
    marcados = {}
    for x in range(len(periodos)):
        for y in range(x + 1, len(periodos)):
            i, a1, b1, e1 = periodos[x]
            j, a2, b2, e2 = periodos[y]
            if (min(b1, b2) - max(a1, a2)).days + 1 <= 1:
                continue
            codigo = "PERIODO_SOBREPOSTO" if _mesmo_empregador(e1, e2) else "PERIODO_CONCOMITANTE"
            for k in (i, j):
                if marcados.get(k) != "PERIODO_SOBREPOSTO":
                    marcados[k] = codigo
    return marcados
