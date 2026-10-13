"""
Comprovantes de EXPERIÊNCIA: um item VINCULO por vínculo achado.

O tipo do documento (CTPS, DECLARACAO, CONTRATO, CERTIDAO, HOLERITE) sai do
texto, e a leitura vai por estes caminhos, nesta ordem:

  0. CTPS (digital ou física): pela POSIÇÃO dos campos (`ctps`), um contrato
     por bloco — empregador (razão social e CNPJ validado), admissão,
     desligamento, ocupação/CBO, jornada —, sem as datas das seções de
     alterações, férias e afastamentos;
  1. campos rotulados no texto (ficha de registro, declaração em formulário,
     CTPS que o caminho 0 não leu): cada "Admissão" abre um vínculo, com o
     "Empregador"/"Razão social", o "Cargo"/"Ocupação"/"Função", o
     "Desligamento"/"Demissão"/"Saída" (sem ele, na CTPS, o vínculo é atual);
  2. texto corrido (declaração, contrato, certidão de tempo de serviço):
     "no período de A a B", "de A até a presente data", "desde A",
     "admitido(a) em A", com o cargo ("no cargo/na função de X") e o
     empregador: QUEM DECLARA (`declaracoes`: o timbre, o "A X, inscrita no
     CNPJ…", o rodapé com razão social/CNPJ), uma declaração por seção;
  3. holerites: as competências (mês/ano) viram um vínculo do primeiro ao
     último mês.

De cada um: empregador, cnpj (só o de empresa, validado), cargo (sem código,
CBO, "de " na frente nem jornada: "de MEDICO DO TRABALHO 4 HORAS 20" →
"Médico do trabalho", carga semanal 20; o CBO à parte em `cbo`), início, fim,
atual, carga horária semanal e dias. Vínculo sem data de saída é ATUAL e fica
com fim None; os dias dele são contados até a emissão do documento ("Emitido/
Gerado em", carimbo de data e hora, assinatura digital), senão até a data do
PDF (metadados) ou a da leitura — `dias_ate` e `dias_ate_fonte`, sem alerta.
Período com o fim antes do início é descartado, e também o "vínculo" que
começa na própria data de emissão sem empregador (o rodapé "emitido em") e o
repetido sem empregador com o mesmo início de outro. Na CTPS, o mesmo
empregador com dois vínculos sobrepostos, um deles em aberto, é um contrato só
(alteração contratual), e o vínculo sem empregador vizinho de outro com o
MESMO cargo fica com o empregador dele.

Sobreposição (`sobrepostos`): só conta quando dois vínculos dividem mais de um
dia. Com o MESMO empregador (CNPJ com a mesma raiz ou razão social igual) é
PERIODO_SOBREPOSTO (provável duplicidade); com empregadores diferentes (ou um
deles não lido) é PERIODO_CONCOMITANTE, informação neutra: os dias em comum
contam uma vez só (a soma é a união dos períodos, como na pontuação).
"""

import re
from datetime import date

from . import declaracoes as _declaracoes
from .ctps import ler_contratos
from .pessoas import nome_confere
from .texto import Data, datas_no_texto, dobrar, iso, numa_linha, trecho

TIPOS = (
    # A página de contrato da CTPS física não diz "carteira": os rótulos impressos dela dizem.
    (
        "CTPS",
        r"carteira de trabalho|ctps|contratos? de trabalho .{0,40}admiss|carteira digital"
        r"|esp\.? do estabelecimento|remuneracao especificada",
    ),
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
MAXIMO_DE_VINCULOS = 20


def tipo_do_documento(dobrado):
    for codigo, padrao in TIPOS:
        if re.search(padrao, dobrado):
            return codigo
    return "OUTRO"


_JORNADA_NO_CARGO = re.compile(
    r"[\s(,;/\-–]*(?<![\d/])(\d{1,2})\s*(?:h|hs|hrs?|horas?)(?![a-z])"
    r"(?:\s*(semanais|semanal|/\s*sem(?:ana)?|por\s+semana|diarias|diaria|/\s*dia|por\s+dia|ao\s+dia))?"
    r"(?:\s*[/\-–]?\s*(\d{1,2})(?:\s*(?:h|hs|hrs?|horas?)(?![a-z]))?(?:\s*(?:semanais|semanal|/\s*sem(?:ana)?))?)?"
    r"\s*\)?\s*$"
)


def jornada_do_cargo(valor):
    """(cargo sem a jornada, carga semanal ou None): "MEDICO DO TRABALHO 4 HORAS 20" → ("MEDICO DO TRABALHO", 20);
    "MÉDICO - 10HS" → ("MÉDICO", 10); "ENFERMEIRO 6 HORAS" → ("ENFERMEIRO", 30) (até 8 h sem "semanais": por dia)."""
    m = _JORNADA_NO_CARGO.search(dobrar(valor or ""))
    if not m:
        return valor, None
    primeiro, unidade, segundo = int(m.group(1)), m.group(2) or "", m.group(3)
    if segundo and int(segundo) >= primeiro and 1 <= int(segundo) <= 60:
        carga = int(segundo)
    elif re.search(r"dia", unidade):
        carga = primeiro * 5
    elif re.search(r"sem", unidade) or primeiro >= 10:
        carga = primeiro
    elif 1 <= primeiro <= 8:
        carga = primeiro * 5  # "4 HORAS" no nome do cargo: 4 h por dia
    else:
        carga = None
    return valor[: m.start()].rstrip(" -–,;/("), (carga if carga and 1 <= carga <= 80 else None)


def _caixa_do_cargo(valor):
    """Só a primeira letra maiúscula, com os acentos de sempre ("MEDICO DO TRABALHO" → "Médico do trabalho")."""
    palavras = []
    for p in valor.lower().split():
        palavras.append(_ACENTOS_DO_CARGO.get(p, p))
    texto = " ".join(palavras)
    return texto[0].upper() + texto[1:] if texto else texto


def cargo_e_jornada(valor):
    """(cargo, cbo, carga semanal do nome do cargo): sem o código na frente, sem o CBO, sem o "de " e sem a
    jornada ("de MEDICO DO TRABALHO 4 HORAS 20" → ("Médico do trabalho", None, 20))."""
    if not valor:
        return None, None, None
    cbo = None
    m = _CBO.search(dobrar(valor))
    if m:
        g = m.groups()
        cbo = f"{g[0]}-{g[1]}{g[2]}" if g[0] else f"{g[3]}-{g[4]}"
        valor = valor[: m.start()] + " " + valor[m.end() :]
    valor = re.sub(r"(?i)(?<![a-zà-ÿ])cbo(?![a-zà-ÿ])\s*:?", " ", valor)
    valor = numa_linha(_CODIGO_NA_FRENTE.sub("", valor)).strip(" -–:;,.")
    palavras = valor.split()
    while palavras and (
        _NAO_E_CARGO.match(dobrar(palavras[0]).strip(".:")) or dobrar(palavras[0]) in ("de", "da", "do")
    ):
        palavras.pop(0)
    valor, carga = jornada_do_cargo(" ".join(palavras).strip(" -–:;,."))
    valor = valor.strip(" -–:;,.")
    if not re.search(r"[A-Za-zÀ-ÿ]{3}", valor):
        return None, cbo, carga
    if valor == valor.upper():
        valor = _caixa_do_cargo(valor)
    return valor, cbo, carga


def limpar_cargo(valor):
    """(cargo, cbo): sem o código na frente nem o CBO ("001-TECNICO DE ENFERMAGEM 3222-05" →
    ("Técnico de enfermagem", "3222-05")); cargo None se sobrar só rótulo ("exercido")."""
    cargo, cbo, _ = cargo_e_jornada(valor)
    return cargo, cbo


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


def carga_semanal(dobrado):
    m = _CARGA_SEMANAL.search(dobrado)
    if not m:
        return None
    horas = int(m.group(1) or m.group(2))
    return horas if 1 <= horas <= 80 else None


_EMISSAO = re.compile(
    r"(?:emitid[oa]|gerad[oa]|expedid[oa]|impress[oa]|extraid[oa]|consultad[oa]|assinad[oa]\s+digitalmente)\s+em"
    r"|data\s+(?:de\s+|da\s+)?(?:emissao|geracao|expedicao|impressao|consulta|assinatura)"
    r"|emissao\s*:?"
)
# Carimbo de data e hora ("10/10/2026 às 14:22", "10/10/2026 14:22:05"): a hora em que o sistema gerou o documento.
_CARIMBO = re.compile(r"^\s*(?:as|,|-)?\s*\d{1,2}\s?[:h]\s?\d{2}(?::\d{2})?")
# Assinatura digital (ICP-Brasil/gov.br): "Data: 2026.10.01 14:22:05 -03'00'" ou "2026-10-01T14:22".
_DATA_DA_ASSINATURA = re.compile(r"(?<!\d)(20\d{2})[.-](\d{2})[.-](\d{2})(?:[ t]\d{2}:\d{2})")


def data_de_emissao(dobrado, datas, ultima_como_emissao=True):
    """A data do documento: a rotulada ("Emitido em", "Gerado em", "Data de emissão"), a de um carimbo de data e
    hora, a da assinatura digital ou (se `ultima_como_emissao`) a última data completa do texto (a do local e data
    da assinatura de uma declaração). A CTPS não usa a última data: nela é a de um contrato."""
    completas = [d for d in datas if d.dia]
    for e in _EMISSAO.finditer(dobrado):
        rotulada = _data_depois(completas, e.end(), 25)
        if rotulada:
            return rotulada.primeiro_dia()
    carimbos = [d for d in completas if _CARIMBO.match(dobrado[d.fim : d.fim + 12])]
    if carimbos:
        return carimbos[-1].primeiro_dia()
    for m in _DATA_DA_ASSINATURA.finditer(dobrado):
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            continue
    if ultima_como_emissao and completas:
        return completas[-1].primeiro_dia()
    return None


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
        item = _vinculo(
            documento,
            empregador,
            cargo,
            entrada.primeiro_dia(),
            saida.ultimo_dia() if saida else None,
            atual,
            carga_semanal(dobrado[antes_de:ate]),
            pagina_de(m.start()),
        )
        item["_janela"], item["_pos"], item["_rotulado"] = (antes_de, ate), entrada.inicio, empregador is not None
        itens.append(item)
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
        item = _vinculo(
            documento,
            empregador,
            cargo,
            a.primeiro_dia(),
            b.ultimo_dia() if b else None,
            atual,
            None,
            pagina_de(a.inicio),
        )
        fim_da_janela = (b.fim if b else a.fim) + 250
        item["_janela"], item["_pos"], item["_rotulado"] = (max(0, a.inicio - 250), fim_da_janela), a.inicio, False
        saida.append(item)
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


def _empregador_do_vizinho(itens):
    """CTPS: o vínculo sem empregador logo antes/depois de outro com o mesmo cargo fica com o empregador dele."""
    for k, it in enumerate(itens):
        if it["empregador"] or not it["cargo"]:
            continue
        cargo = dobrar(limpar_cargo(it["cargo"])[0] or "")
        for vizinho in itens[max(0, k - 1) : k] + itens[k + 1 : k + 2]:
            if vizinho["empregador"] and cargo and dobrar(limpar_cargo(vizinho["cargo"])[0] or "") == cargo:
                it["empregador"] = vizinho["empregador"]
                break


def _da_ctps(paginas):
    """Os vínculos da CTPS pela posição dos campos (`ctps`) e a data de emissão que ela traz."""
    contratos, emissao = ler_contratos(paginas)
    itens = []
    for c in contratos:
        empregador = c.empregador or (f"CNPJ {c.cnpj}" if c.cnpj else None)
        fim = c.desligamento.ultimo_dia() if c.desligamento else None
        item = _vinculo(
            "CTPS",
            empregador,
            c.cargo,
            c.admissao.primeiro_dia(),
            fim,
            not fim and not c.desligado,
            carga_semanal(dobrar(c.jornada or "")) or _horas_da_jornada(c.jornada),
            c.pagina,
        )
        if c.cnpj:
            item["cnpj"] = c.cnpj
        if c.cbo:
            item["cbo"] = c.cbo
        if c.desligado and not fim:
            item["desligado_sem_data"] = True
        itens.append(item)
    return itens, emissao


def _horas_da_jornada(texto):
    m = re.search(r"(?<!\d)(\d{1,2})(?:[.,]\d+)?\s*(?:h|hs|horas?)?", dobrar(texto or ""))
    horas = int(m.group(1)) if m else None
    return horas if horas and 1 <= horas <= 80 else None


def _unir_alteracoes(itens):
    """CTPS: o mesmo empregador com dois vínculos sobrepostos em que um está em aberto é o mesmo contrato
    (uma alteração contratual lida como admissão, ou o desligamento não lido): fica um só, do primeiro dia."""
    saida = []
    for it in sorted(itens, key=lambda x: x["inicio"]):
        par = next(
            (
                o
                for o in saida
                if mesmo_empregador(o, it)
                and (o["atual"] or it["atual"])
                and (o["fim"] is None or it["inicio"] <= o["fim"])
            ),
            None,
        )
        if par is None:
            saida.append(it)
            continue
        if it["fim"] is None or (par["fim"] is not None and it["fim"] > par["fim"]):
            par["fim"] = it["fim"]
        par["atual"] = par["fim"] is None and (par["atual"] or it["atual"])
        par["cargo"] = par["cargo"] or it["cargo"]
        par["carga_semanal"] = par["carga_semanal"] or it["carga_semanal"]
        par["alteracoes"] = par.get("alteracoes", 0) + 1
    ordem = {id(it): k for k, it in enumerate(itens)}
    return sorted(saida, key=lambda x: ordem.get(id(x), 0))


DATA_APOS_EMISSAO = "Vínculo com data depois da emissão da declaração descartado (provável leitura errada): confira"


def _emissao_da_secao(dobrado, datas):
    """(data de emissão, Data do local e data ou None, confiável?): o "Cidade, 10 de outubro de 2026", a rotulada
    (emitido em, carimbo, assinatura digital) ou, sem confiança, a última data completa."""
    local = _declaracoes.local_e_data(dobrado, datas)
    if local:
        return local.primeiro_dia(), local, True
    rotulada = data_de_emissao(dobrado, datas, ultima_como_emissao=False)
    if rotulada:
        return rotulada, None, True
    return data_de_emissao(dobrado, datas), None, False


def _vinculos_da_secao(secao, documento, avisos):
    """Os vínculos de uma declaração (seção): extraídos só do texto dela, com o emissor dela como empregador
    (o rotulado "Empregador:" do formulário vale antes), o fim/atual e a carga do trecho do vínculo."""
    original, pagina_de = _paginador(secao.paginas)
    dobrado = dobrar(original)
    datas = datas_no_texto(dobrado)
    emissao, local, confiavel = _emissao_da_secao(dobrado, datas)
    candidatas = [d for d in datas if d is not local]  # o local e data não é início de vínculo
    itens = _rotulados(original, dobrado, candidatas, documento, pagina_de) or _periodos(
        original, dobrado, candidatas, documento, pagina_de
    )
    # O "rodapé" que começa na emissão só se tira com a emissão de verdade (não a última data, que pode ser o início).
    itens = _sem_repetidos(
        [it for it in itens if not (it["fim"] and it["fim"] < it["inicio"])], emissao if confiavel else None
    )
    emissor = secao.emissor
    saida = []
    for it in itens:
        if confiavel and emissao and it["inicio"] > emissao:
            avisos.append({"codigo": "DATA_APOS_EMISSAO", "texto": DATA_APOS_EMISSAO})
            continue
        comeco, fim = it["_janela"] if len(itens) > 1 else (0, len(dobrado))
        comeco, fim = max(0, comeco), min(len(dobrado), fim)
        # O "Empregador: X" do formulário vale antes do emissor, se tiver cara de nome ("nesta empresa em…" não).
        rotulado = it["_rotulado"] and _declaracoes.nome_de_instituicao(it["empregador"] or "")
        if emissor and not rotulado:
            it["empregador"] = emissor.empregador
        elif it["empregador"] and not it["empregador"].startswith("CNPJ "):
            # Sem emissor (ou rotulado): o nome limpo, e lixo de OCR vira "Empregador não lido".
            it["empregador"] = _declaracoes.nome_de_instituicao(it["empregador"]) or None
        if emissor and emissor.cnpj and not it.get("cnpj"):
            it["cnpj"] = emissor.cnpj
        if not it["fim"]:
            it["atual"] = bool(_declaracoes.ATUAL_DECLARADO.search(dobrado, comeco, fim))
        carga = _declaracoes.carga_declarada(dobrado, comeco, fim, it["_pos"])
        it["carga_semanal"] = carga.horas if carga else None
        if carga and carga.plantao:
            it["plantonista"], it["plantao_horas"] = True, carga.plantao
        it["_carga"] = (id(secao), carga.posicao) if carga and carga.horas else None
        it["_emissor"] = emissor.chave() if emissor else f"secao-{id(secao)}"
        it["_emissao"] = emissao
        saida.append(it)
    return saida


def _carga_capturada_duas_vezes(itens):
    """O mesmo número de carga (a mesma posição no texto) em vínculos de emissores diferentes é captura do mesmo
    trecho: a carga desses vínculos fica None ("carga não encontrada")."""
    por_captura = {}
    for it in itens:
        if it.get("_carga"):
            por_captura.setdefault(it["_carga"], []).append(it)
    for grupo in por_captura.values():
        if len({it["_emissor"] for it in grupo}) > 1:
            for it in grupo:
                it["carga_semanal"] = None


def _vinculos_declarados(paginas, documento, avisos):
    """Declaração, contrato, certidão, holerite: os vínculos de cada seção (uma declaração por emissor)."""
    secoes = _declaracoes.secoes(paginas)
    if documento == "HOLERITE":
        original, pagina_de = _paginador(paginas)
        dobrado = dobrar(original)
        itens = _holerites(dobrado, datas_no_texto(dobrado), documento, pagina_de)
        if itens:
            for it in itens:
                secao = next((s for s in secoes if any(p.numero == it["pagina"] for p in s.paginas)), None)
                if secao and secao.emissor:
                    it["empregador"] = secao.emissor.empregador
                    if secao.emissor.cnpj:
                        it["cnpj"] = secao.emissor.cnpj
            return itens
    itens = []
    for secao in secoes:
        itens.extend(_vinculos_da_secao(secao, documento, avisos))
    _carga_capturada_duas_vezes(itens)
    return _sem_duplicados_entre_paginas(itens)


def _cargos_compativeis(a, b):
    x = dobrar(limpar_cargo(a)[0] or "").split()
    y = dobrar(limpar_cargo(b)[0] or "").split()
    if not x or not y:
        return True
    curto, longo = sorted((x, y), key=len)
    return longo[: len(curto)] == curto


def _sem_duplicados_entre_paginas(itens):
    """O mesmo vínculo lido em duas páginas (mesmo início, cargo compatível — "Médico" e "Médico do trabalho")
    em que um não tem empregador legível: fica um só, o que tem empregador, com o fim/atual e a carga do outro
    quando faltarem."""
    saida = []
    for it in itens:
        par = next(
            (
                o
                for o in saida
                if o["inicio"] == it["inicio"]
                and (not o["empregador"]) != (not it["empregador"])
                and _cargos_compativeis(o["cargo"], it["cargo"])
            ),
            None,
        )
        if par is None:
            saida.append(it)
            continue
        fica, sai = (par, it) if par["empregador"] else (it, par)
        if not fica["fim"] and not fica["atual"] and (sai["fim"] or sai["atual"]):
            fica["fim"], fica["atual"] = sai["fim"], sai["atual"]
        fica["cargo"] = fica["cargo"] or sai["cargo"]
        if not fica["carga_semanal"] and sai.get("_emissor") == fica.get("_emissor"):
            fica["carga_semanal"] = sai["carga_semanal"]
        if fica is it:
            saida[saida.index(par)] = it
    return saida


def vinculos(paginas, nome_do_candidato=None, hoje=None, data_do_arquivo=None, avisos=None):
    """Os itens VINCULO do arquivo, na ordem do texto, sem repetição.

    CTPS: pela posição dos campos (`ctps`) ou pelos rótulos. Declaração, contrato, certidão e holerite: por seção
    (`declaracoes`: uma declaração por emissor), com o emissor como empregador, o fim/atual e a carga do trecho do
    vínculo; o vínculo sem fim e sem "até a presente data"/"atualmente"/verbo no presente fica com
    `fim_nao_informado` (dias 0), o sem carga declarada com `carga_nao_encontrada`, e o que começa depois da
    emissão da declaração é descartado (o alerta leve vai para `avisos`, se dada uma lista).

    O vínculo atual (sem fim) conta os dias até a emissão do documento (na declaração, a da própria seção); sem
    ela, até a data em que o PDF foi gerado (`data_do_arquivo`, dos metadados) ou, sem nada, até `hoje` (a data da
    leitura) — sempre com `dias_ate` (a data) e `dias_ate_fonte` (EMISSAO, ARQUIVO ou LEITURA), sem alerta."""
    hoje = hoje or date.today()
    avisos = [] if avisos is None else avisos
    original, pagina_de = _paginador(paginas)
    dobrado = dobrar(original)
    datas = datas_no_texto(dobrado)
    documento = tipo_do_documento(dobrado)
    declarado = documento != "CTPS"
    if documento == "CTPS":
        itens, emissao = _da_ctps(paginas)
        if not itens:
            itens = _rotulados(original, dobrado, datas, documento, pagina_de) or _periodos(
                original, dobrado, datas, documento, pagina_de
            )
        emissao = emissao or data_de_emissao(dobrado, datas, ultima_como_emissao=False)
        itens = _sem_repetidos([it for it in itens if not (it["fim"] and it["fim"] < it["inicio"])], emissao)
        _empregador_do_vizinho(itens)
    else:
        itens = _vinculos_declarados(paginas, documento, avisos)
        emissao = data_de_emissao(dobrado, datas)
    vistos, saida = set(), []
    for it in itens:
        chave = (it["inicio"], it["fim"], dobrar(it["empregador"] or ""))
        if chave in vistos:
            continue
        vistos.add(chave)
        it["cargo"], cbo, carga_do_cargo = cargo_e_jornada(it["cargo"])
        if cbo and not it.get("cbo"):
            it["cbo"] = cbo
        if not it["carga_semanal"] and not it.get("plantonista"):
            it["carga_semanal"] = carga_do_cargo
        it["atual"] = bool(it["atual"]) and not it["fim"]
        saida.append(it)
    if documento == "CTPS":
        saida = _unir_alteracoes(saida)
    # Data depois do dia da leitura (OCR que leu 2028 por 2026, metadado errado) não serve de limite.
    data_do_arquivo = data_do_arquivo if data_do_arquivo and data_do_arquivo <= hoje else None
    for it in saida:
        emissao_do_item = it.get("_emissao", emissao)
        emissao_do_item = emissao_do_item if emissao_do_item and emissao_do_item <= hoje else None
        # Atual: fim None; os dias vão até a emissão do documento, a data do arquivo ou a da leitura.
        if it["atual"]:
            if emissao_do_item and emissao_do_item >= it["inicio"]:
                ate, fonte = emissao_do_item, "EMISSAO"
            elif data_do_arquivo and data_do_arquivo >= it["inicio"]:
                ate, fonte = data_do_arquivo, "ARQUIVO"
            else:
                ate, fonte = hoje, "LEITURA"
            it["dias"] = dias_do_vinculo(it["inicio"], ate, hoje)
            it["dias_ate"], it["dias_ate_fonte"] = iso(ate), fonte
        elif it["fim"]:
            it["dias"] = dias_do_vinculo(it["inicio"], it["fim"], hoje)
        elif declarado and not it.get("desligado_sem_data"):
            # Sem fim e sem "até a presente data": não dá para saber até quando (a tela diz "fim não informado").
            it["dias"] = 0
            it["fim_nao_informado"] = True
        elif not it.get("desligado_sem_data"):
            it["dias"] = dias_do_vinculo(it["inicio"], it["fim"], hoje)
        else:
            it["dias"] = 0  # "Desligado" sem a data de saída: não dá para contar
        it["inicio"], it["fim"] = iso(it["inicio"]), iso(it["fim"])
        if declarado and not it["carga_semanal"] and not it.get("plantonista"):
            it["carga_nao_encontrada"] = True
        it["nome_confere"] = nome_confere(nome_do_candidato, original) if nome_do_candidato else None
        for chave in [k for k in it if k.startswith("_")]:
            del it[chave]
    return saida[:MAXIMO_DE_VINCULOS]


_SUFIXOS_DE_EMPRESA = re.compile(
    r"(?<![a-z])(?:ltda|limitada|s\s?/?\s?a|me|epp|eireli|cia|companhia|sociedade anonima|ss|"
    r"em recuperacao judicial)(?![a-z])"
)


def _nome_normalizado(nome):
    t = dobrar(nome or "")
    t = re.sub(r"cnpj\s*[\d./\-a-z]*", " ", t)
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    t = _SUFIXOS_DE_EMPRESA.sub(" ", t)
    return " ".join(t.split())


def _raiz_do_cnpj(item):
    c = re.sub(r"[^0-9A-Za-z]", "", str(item.get("cnpj") or "")).upper()
    return c[:8] if len(c) == 14 else None


def mesmo_empregador(a, b):
    """Os dois vínculos são do MESMO empregador: CNPJ com a mesma raiz (matriz e filiais) ou, sem CNPJ nos dois,
    a razão social normalizada igual (sem acento, pontuação e Ltda/S.A./ME…). Sem saber um deles, não é o mesmo."""
    ra, rb = _raiz_do_cnpj(a), _raiz_do_cnpj(b)
    if ra and rb:
        return ra == rb
    x, y = _nome_normalizado(a.get("empregador")), _nome_normalizado(b.get("empregador"))
    if not x or not y:
        return False
    if x == y:
        return True
    curto, longo = sorted((x, y), key=len)
    # "SERVICO SOCIAL DA INDUSTRIA" e "SERVICO SOCIAL DA INDUSTRIA SESI": o nome inteiro de um no começo do outro.
    return len(curto.split()) >= 3 and longo.startswith(curto + " ")


def _dia(valor):
    try:
        return date.fromisoformat(valor) if valor else None
    except ValueError:
        return None


def sobrepostos(itens, hoje=None):
    """{índice: código} dos vínculos que dividem mais de um dia com outro do arquivo: PERIODO_SOBREPOSTO (o mesmo
    empregador: provável duplicidade do mesmo vínculo) ou PERIODO_CONCOMITANTE (empregadores diferentes ou não
    lidos: legítimo; os dias em comum contam uma vez só na soma)."""
    hoje = hoje or date.today()
    periodos = []
    for i, it in enumerate(itens):
        inicio = _dia(it.get("inicio"))
        if it.get("tipo") != "VINCULO" or not inicio:
            continue
        fim = _dia(it.get("fim")) or ((_dia(it.get("dias_ate")) or hoje) if it.get("atual") else None)
        if fim:
            periodos.append((i, inicio, fim, it))
    marcados = {}
    for x in range(len(periodos)):
        for y in range(x + 1, len(periodos)):
            i, a1, b1, e1 = periodos[x]
            j, a2, b2, e2 = periodos[y]
            if (min(b1, b2) - max(a1, a2)).days + 1 <= 1:
                continue
            codigo = "PERIODO_SOBREPOSTO" if mesmo_empregador(e1, e2) else "PERIODO_CONCOMITANTE"
            for k in (i, j):
                if marcados.get(k) != "PERIODO_SOBREPOSTO":
                    marcados[k] = codigo
    return marcados


def intervalos_para_somar(itens, hoje=None):
    """[{inicio, fim}] dos vínculos (o atual até `dias_ate`), para a soma sem sobreposição da pontuação."""
    hoje = hoje or date.today()
    saida = []
    for it in itens:
        if it.get("tipo") != "VINCULO" or not it.get("inicio"):
            continue
        fim = it.get("fim") or ((it.get("dias_ate") or hoje.isoformat()) if it.get("atual") else None)
        if fim:
            saida.append({"inicio": it["inicio"], "fim": fim})
    return saida
