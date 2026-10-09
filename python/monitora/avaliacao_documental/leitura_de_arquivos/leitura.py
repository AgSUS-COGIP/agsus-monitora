"""
`ler_documento`: o arquivo inteiro → o que a ficha mostra ao lado dele.

O que procurar depende do item da ficha a que a pergunta do anexo pertence
(a regra do edital liga perguntas a blocos — `bloco_do_anexo`):

    CURSOS      certificados (curso, horas, instituição, conclusão)
    TITULOS     diplomas (título, curso, instituição, data)
    VINCULOS    experiência (empregador, cargo, início, fim/atual, carga, dias)
    IDENTIDADE  o tipo do documento de identificação
    REGISTRO    o conselho, se está ativo e a validade
    GERAL       só nome e CPF (cotas, laudos…)

Saída (o que gravar_leituras_de_arquivos aceita; nada do texto do documento):
    situacao     LIDO | ILEGIVEL | ERRO | NAO_SUPORTADO
    metodo       TEXTO | OCR | None
    formato      PDF | IMAGEM | DOCX | TXT | OUTRO
    paginas      páginas do arquivo; confianca: média do OCR (0–1) ou None
    documento    o tipo achado (CTPS, DECLARACAO, RG, CERTIFICADO, DIPLOMA…)
    nome_confere / cpf_confere   True | False | None
    itens        [{tipo, …campos, pagina, nome_confere, alertas: [{codigo, texto}]}]
    alertas      [{codigo, texto}] do arquivo inteiro
    resumo       uma linha: "3 certificados · 145 h, 60 h, 40 h · nome confere"
Os textos dos alertas não levam nome, CPF nem trecho do documento.
"""

from datetime import date

from ..nota_declarada import colunas_da_pergunta, normalizar_texto
from . import certificados as _certificados
from . import diplomas as _diplomas
from . import experiencia as _experiencia
from . import identidade as _identidade
from .extracao import ler_paginas, ocr_tesseract
from .pessoas import cpf_confere, cpfs_do_texto, nome_confere
from .texto import dobrar, letras

MINIMO_DE_LETRAS = 30  # o arquivo inteiro com menos que isso: ilegível
CONFIANCA_MINIMA_DO_OCR = 0.45

ROTULO_DO_TITULO = {
    "DOUTORADO": "Doutorado",
    "MESTRADO": "Mestrado",
    "RESIDENCIA": "Residência",
    "ESPECIALIZACAO": "Especialização",
    "GRADUACAO": "Graduação",
    "TECNICO": "Técnico",
    "ENSINO_MEDIO": "Ensino médio",
}
ROTULO_DA_IDENTIDADE = {
    "RG": "RG",
    "CIN": "Identidade nacional",
    "CNH": "CNH",
    "PASSAPORTE": "Passaporte",
    "RNE": "RNE/CRNM",
    "CARTEIRA_PROFISSIONAL": "Carteira profissional",
}
NAO_ACHOU = {
    "CURSOS": "Nenhum certificado com curso ou carga horária encontrado no arquivo",
    "TITULOS": "Nenhum diploma ou certificado de titulação encontrado no arquivo",
    "VINCULOS": "Nenhum período de trabalho encontrado no arquivo",
    "IDENTIDADE": "O arquivo não parece um documento de identificação",
    "REGISTRO": "Nenhum registro em conselho encontrado no arquivo",
}


def esperado_do_bloco(bloco):
    """O que procurar nos anexos do bloco da regra."""
    if not bloco:
        return "GERAL"
    tipo = bloco.get("tipo")
    if tipo in ("CURSOS", "TITULOS", "VINCULOS"):
        return tipo
    texto = normalizar_texto(f"{bloco.get('codigo', '')} {bloco.get('titulo', '')}")
    if "identi" in texto:
        return "IDENTIDADE"
    if "conselho" in texto or "registro" in texto:
        return "REGISTRO"
    if "escolaridade" in texto or "formacao" in texto or "diploma" in texto:
        return "TITULOS"
    return "GERAL"


def bloco_do_anexo(regra, coluna=None, enunciado=None):
    """O bloco da regra cuja pergunta casa com a coluna do Excel (ou o enunciado) do anexo; None sem casamento."""
    alvos = {t: None for t in (coluna, enunciado) if t}
    if not alvos:
        return None
    for bloco in (regra or {}).get("blocos") or []:
        if colunas_da_pergunta(alvos, bloco.get("perguntas") or []):
            return bloco
    return None


def minimo_de_horas(bloco):
    """A menor carga horária que pontua no bloco de cursos (faixas da regra e de cada nível); None sem faixa."""
    if not bloco:
        return None
    faixas = list(bloco.get("faixas") or [])
    for por_nivel in (bloco.get("por_nivel") or {}).values():
        faixas.extend((por_nivel or {}).get("faixas") or [])
    minimos = [f.get("min_horas") for f in faixas if isinstance(f.get("min_horas"), int | float) and f["min_horas"] > 0]
    return min(minimos) if minimos else None


def _alerta(codigo, texto):
    return {"codigo": codigo, "texto": texto}


def _data(valor):
    try:
        return date.fromisoformat(valor) if valor else None
    except ValueError:
        return None


def _alertas_do_item(item, hoje, minimo, nome_do_arquivo_confere, sobrepostos, indice):
    alertas = []
    tipo = item["tipo"]
    if item.get("nome_confere") is False and nome_do_arquivo_confere is not False:
        alertas.append(_alerta("NOME_DIVERGENTE", "O nome do candidato não aparece neste item"))
    datas = [item.get(c) for c in ("conclusao", "data", "inicio", "fim", "validade") if item.get(c)]
    if tipo != "REGISTRO" and any((_data(d) or hoje) > hoje for d in datas):
        alertas.append(_alerta("DATA_FUTURA", "Data depois de hoje"))
    if tipo == "CURSO":
        if item.get("horas") is None:
            alertas.append(_alerta("SEM_CARGA_HORARIA", "Carga horária não encontrada"))
        elif minimo and item["horas"] < minimo:
            alertas.append(
                _alerta("HORAS_ABAIXO_MINIMO", f"{item['horas']} h, abaixo do mínimo de {minimo:g} h do edital")
            )
        if not item.get("conclusao"):
            alertas.append(_alerta("SEM_DATA", "Data de conclusão não encontrada"))
    if tipo == "VINCULO":
        if indice in sobrepostos:
            alertas.append(_alerta("PERIODO_SOBREPOSTO", "Período sobreposto a outro vínculo do arquivo"))
        if item.get("atual") and not item.get("fim"):
            alertas.append(_alerta("SEM_DATA_FIM", "Vínculo atual sem data de emissão: confira o fim"))
        if not item.get("empregador"):
            alertas.append(_alerta("SEM_EMPREGADOR", "Empregador não encontrado"))
    if tipo == "REGISTRO":
        if item.get("ativo") is False:
            alertas.append(_alerta("REGISTRO_INATIVO", "O documento diz que o registro não está ativo"))
        validade = _data(item.get("validade"))
        if validade and validade < hoje:
            alertas.append(_alerta("REGISTRO_VENCIDO", "Registro com validade vencida"))
    return alertas


def _parte_do_nome(nome, cpf):
    partes = []
    if nome is True:
        partes.append("nome confere")
    elif nome is False:
        partes.append("nome não confere")
    if cpf is True:
        partes.append("CPF confere")
    elif cpf is False:
        partes.append("CPF diverge")
    return partes


def _mil(n):
    return f"{n:,}".replace(",", ".")


def resumo(resultado):
    """Uma linha para a ficha (sem dado pessoal)."""
    situacao = resultado["situacao"]
    if situacao == "ILEGIVEL":
        return "Ilegível"
    if situacao == "NAO_SUPORTADO":
        return f"Formato não lido ({resultado.get('formato') or 'outro'})"
    if situacao == "ERRO":
        return "Não foi possível ler"
    itens = resultado["itens"]
    partes = []
    cursos = [i for i in itens if i["tipo"] == "CURSO"]
    titulos = [i for i in itens if i["tipo"] == "TITULO"]
    vinculos = [i for i in itens if i["tipo"] == "VINCULO"]
    if cursos:
        partes.append(f"{len(cursos)} certificado{'s' if len(cursos) > 1 else ''}")
        horas = [f"{c['horas']} h" for c in cursos if c.get("horas")]
        if horas:
            partes.append(", ".join(horas[:6]) + ("…" if len(horas) > 6 else ""))
    if titulos:
        partes.append(", ".join(dict.fromkeys(ROTULO_DO_TITULO.get(t["titulo"], t["titulo"]) for t in titulos)))
    if vinculos:
        dias = sum(v.get("dias") or 0 for v in vinculos)
        partes.append(f"{len(vinculos)} vínculo{'s' if len(vinculos) > 1 else ''}")
        if dias:
            partes.append(f"{_mil(dias)} dias")
    for i in itens:
        if i["tipo"] == "IDENTIDADE":
            partes.append(ROTULO_DA_IDENTIDADE.get(i["documento"], i["documento"]))
        if i["tipo"] == "REGISTRO":
            estado = {True: " ativo", False: " inativo"}.get(i.get("ativo"), "")
            partes.append(f"{i['conselho']}{estado}")
    if not itens:
        partes.append("Lido, nada encontrado" if resultado.get("esperado") != "GERAL" else "Lido")
    partes.extend(_parte_do_nome(resultado.get("nome_confere"), resultado.get("cpf_confere")))
    return " · ".join(partes)[:200]


def _documento(esperado, itens, dobrado_tipo):
    if esperado == "CURSOS" and itens:
        return "CERTIFICADO"
    if esperado == "TITULOS" and itens:
        return "DIPLOMA"
    if esperado == "VINCULOS" and itens:
        return itens[0].get("documento") or dobrado_tipo
    if esperado == "IDENTIDADE" and itens:
        return itens[0]["documento"]
    if esperado == "REGISTRO" and itens:
        return "REGISTRO_" + itens[0]["conselho"]
    return dobrado_tipo


def ler_documento(
    conteudo,
    esperado="GERAL",
    nome=None,
    sal=None,
    hash_do_cpf=None,
    minimo_horas=None,
    hoje=None,
    ocr=ocr_tesseract,
):
    """O resultado da leitura de um arquivo (bytes). `ocr=None` não faz OCR (página-imagem fica sem leitura)."""
    hoje = hoje or date.today()
    leitura = ler_paginas(conteudo, ocr=ocr)
    resultado = {
        "situacao": "LIDO",
        "metodo": leitura.metodo,
        "formato": leitura.formato,
        "paginas": leitura.total_de_paginas or None,
        "confianca": leitura.confianca,
        "documento": None,
        "esperado": esperado,
        "nome_confere": None,
        "cpf_confere": None,
        "itens": [],
        "alertas": [],
    }
    if leitura.formato == "OUTRO":
        resultado.update(situacao="NAO_SUPORTADO", metodo=None)
    elif leitura.erro:
        resultado.update(situacao="ERRO", metodo=None, erro=leitura.erro)
    else:
        texto = leitura.texto
        ilegivel = letras(texto) < MINIMO_DE_LETRAS or (
            leitura.metodo == "OCR" and (leitura.confianca or 0) < CONFIANCA_MINIMA_DO_OCR and letras(texto) < 400
        )
        if ilegivel:
            resultado["situacao"] = "ILEGIVEL"
            resultado["alertas"].append(_alerta("DOCUMENTO_ILEGIVEL", "Não deu para ler o documento"))
        else:
            _interpretar(resultado, leitura, texto, esperado, nome, sal, hash_do_cpf, minimo_horas, hoje)
    resultado["resumo"] = resumo(resultado)
    return resultado


def _interpretar(resultado, leitura, texto, esperado, nome, sal, hash_do_cpf, minimo_horas, hoje):
    paginas = [p for p in leitura.paginas if p.texto]
    resultado["nome_confere"] = nome_confere(nome, texto) if nome else None
    resultado["cpf_confere"] = cpf_confere(texto, sal, hash_do_cpf)
    if esperado == "CURSOS":
        itens = _certificados.certificados(paginas, nome)
    elif esperado == "TITULOS":
        itens = _diplomas.titulos(paginas, nome)
    elif esperado == "VINCULOS":
        itens = _experiencia.vinculos(paginas, nome, hoje)
    elif esperado == "IDENTIDADE":
        itens = _identidade.identidade(paginas)
    elif esperado == "REGISTRO":
        itens = _identidade.registro(paginas)
    else:
        itens = []
    resultado["documento"] = _documento(esperado, itens, _experiencia.tipo_do_documento(dobrar(texto)))
    sobrepostos = set(_experiencia.sobrepostos(itens))
    for i, item in enumerate(itens):
        item["alertas"] = _alertas_do_item(item, hoje, minimo_horas, resultado["nome_confere"], sobrepostos, i)
    resultado["itens"] = itens
    alertas = resultado["alertas"]
    if resultado["nome_confere"] is False:
        alertas.append(_alerta("NOME_DIVERGENTE", "O nome do candidato não aparece no documento"))
    if resultado["cpf_confere"] is False:
        varios = len(cpfs_do_texto(texto)) > 1
        alertas.append(
            _alerta(
                "CPF_DIVERGENTE",
                "Nenhum dos CPFs do documento é o do candidato"
                if varios
                else "O CPF do documento não é o do candidato",
            )
        )
    if not itens and esperado in NAO_ACHOU:
        alertas.append(_alerta("NADA_ENCONTRADO", NAO_ACHOU[esperado]))
    if leitura.paginas_sem_leitura:
        alertas.append(_alerta("PAGINAS_NAO_LIDAS", f"{leitura.paginas_sem_leitura} página(s) não lida(s)"))
    if leitura.metodo == "OCR" and (leitura.confianca or 0) < CONFIANCA_MINIMA_DO_OCR:
        alertas.append(_alerta("LEITURA_DUVIDOSA", "Imagem de baixa qualidade: confira os valores no documento"))
