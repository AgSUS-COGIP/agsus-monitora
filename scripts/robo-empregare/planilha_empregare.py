"""
Leitura do Excel "Candidatos da vaga" exportado pela Empregare.

Sem rede e sem Selenium: arquivo → linhas prontas para `gravar_lote_empregare`
(supabase/migrations/20261005170000_robo_empregare.sql).

O desenho do Excel não é documentado pela Empregare e muda com o questionário
de cada vaga, então a leitura é genérica:
  - o cabeçalho é a primeira linha (entre as 15 primeiras) que tem pelo menos
    duas colunas conhecidas (nome, e-mail, CPF…); sem isso, a primeira linha;
  - a aba principal é a que tem esse cabeçalho; as outras abas que tenham a
    mesma chave (código, CPF ou e-mail) entram em cada candidato como
    "<aba> › <coluna>" (várias linhas do mesmo candidato viram lista);
  - colunas conhecidas são reconhecidas pelo nome, sem acento e sem caixa
    (COLUNAS_CONHECIDAS); todas as colunas, conhecidas ou não, vão inteiras
    em `colunas` (DS_COLUNA_ORIGINAL), com nomes repetidos numerados;
  - chave natural do candidato: código do candidato/candidatura da Empregare
    (cod:…); sem ele, SHA-256 do CPF (cpf:…) ou do e-mail (email:…). O CPF
    nunca vai em claro na chave. Linha sem nenhum dos três fica de fora e é
    contada.

Testes: tests/python/test_robo_empregare.py (planilha falsa, dados fictícios).
"""

import hashlib
import math
import re
import unicodedata
from datetime import date, datetime, time

LINHAS_PROCURADAS_NO_CABECALHO = 15
LIMITE_DO_VALOR = 10000

# Nome normalizado da coluna → campo conhecido. A ordem dentro de cada campo é a preferência.
COLUNAS_CONHECIDAS = {
    "codigo": [
        "codigo do candidato",
        "codigo candidato",
        "id do candidato",
        "id candidato",
        "candidato id",
        "codigo da candidatura",
        "codigo candidatura",
        "id da candidatura",
        "id candidatura",
        "candidatura id",
        "numero da inscricao",
        "numero de inscricao",
        "inscricao",
        "codigo",
        "id",
    ],
    "nome": ["nome completo", "nome do candidato", "nome", "candidato"],
    "email": ["e mail", "email", "e mail do candidato", "email do candidato", "e mail pessoal"],
    "cpf": ["cpf", "cpf do candidato", "numero do cpf", "documento cpf"],
    "telefone": ["celular", "telefone celular", "telefone", "whatsapp", "telefone 1", "fone"],
    "nascimento": ["data de nascimento", "data nascimento", "nascimento", "dt nascimento"],
    "situacao": ["etapa atual", "etapa", "status", "situacao", "fase", "status da candidatura"],
    "candidatura": [
        "data da candidatura",
        "data de candidatura",
        "data candidatura",
        "data de inscricao",
        "data da inscricao",
        "data inscricao",
        "candidatou se em",
    ],
}

_PARA_CAMPO = {nome: campo for campo, nomes in COLUNAS_CONHECIDAS.items() for nome in nomes}


# ── Texto ────────────────────────────────────────────────────────────────────


def normalizar_nome(valor):
    """'E-mail do Candidato' → 'e mail do candidato' (sem acento, minúsculas, só letras e dígitos)."""
    texto = unicodedata.normalize("NFD", str(valor if valor is not None else ""))
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", " ", texto).strip()


def vazio(valor):
    if valor is None:
        return True
    if isinstance(valor, float) and math.isnan(valor):
        return True
    try:
        import pandas as pd

        if valor is pd.NaT:
            return True
    except ImportError:  # pragma: no cover - pandas é dependência do robô
        pass
    return isinstance(valor, str) and not valor.strip()


def texto_da_celula(valor):
    """Valor da célula como texto estável para o jsonb: datas em ISO, inteiros sem '.0'."""
    if vazio(valor):
        return None
    if isinstance(valor, datetime):
        if valor.time() == time(0, 0):
            return valor.date().isoformat()
        return valor.replace(microsecond=0, tzinfo=None).isoformat()
    if isinstance(valor, date):
        return valor.isoformat()
    if isinstance(valor, bool):
        return "Sim" if valor else "Não"
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    texto = str(valor).strip()
    if len(texto) > LIMITE_DO_VALOR:
        texto = texto[:LIMITE_DO_VALOR] + "…"
    return texto


def nomes_unicos(cabecalho):
    """Nomes das colunas sem repetição: 'Pergunta', 'Pergunta (2)'; sem nome → 'Coluna N'."""
    usados = set()
    saida = []
    for i, bruto in enumerate(cabecalho, start=1):
        base = re.sub(r"\s+", " ", texto_da_celula(bruto) or f"Coluna {i}")[:200]
        nome, n = base, 1
        while nome.lower() in usados:
            n += 1
            nome = f"{base} ({n})"
        usados.add(nome.lower())
        saida.append(nome)
    return saida


# ── Campos conhecidos ───────────────────────────────────────────────────────


def apenas_digitos(valor):
    return re.sub(r"\D", "", str(valor or ""))


def normalizar_cpf(valor):
    """
    CPF com 11 dígitos; senão None. Célula numérica perde os zeros à esquerda
    no Excel e é completada; texto precisa trazer os 11.
    """
    digitos = apenas_digitos(texto_da_celula(valor))
    numerica = isinstance(valor, (int, float)) and not isinstance(valor, bool)
    if not digitos or len(digitos) > 11 or (len(digitos) < 11 and not numerica):
        return None
    digitos = digitos.zfill(11)
    if len(set(digitos)) == 1 and digitos[0] == "0":
        return None
    return digitos


def normalizar_email(valor):
    texto = (texto_da_celula(valor) or "").strip().lower()
    return texto if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", texto) else None


def normalizar_codigo(valor):
    texto = re.sub(r"\s+", "", texto_da_celula(valor) or "")
    return texto[:60] if re.fullmatch(r"[A-Za-z0-9._-]{1,60}", texto) else None


def _hash(prefixo, valor):
    return hashlib.sha256(f"empregare:{prefixo}:{valor}".encode()).hexdigest()


def chave_natural(codigo=None, cpf=None, email=None):
    """
    (chave, tipo) do candidato na vaga: cod:<código>, cpf:<sha256> ou
    email:<sha256>; (None, None) sem nenhum dos três.
    """
    codigo = normalizar_codigo(codigo)
    if codigo:
        return f"cod:{codigo}", "CODIGO"
    cpf = normalizar_cpf(cpf)
    if cpf:
        return f"cpf:{_hash('cpf', cpf)}", "CPF"
    email = normalizar_email(email)
    if email:
        return f"email:{_hash('email', email)}", "EMAIL"
    return None, None


def mapear_colunas(nomes, valores_por_coluna=None, codigo_da_vaga=None):
    """
    Campo conhecido → índice da coluna. Uma coluna "Código"/"ID" que só traz o
    código da vaga não é o código do candidato.
    """
    achados = {}
    normalizados = [normalizar_nome(n) for n in nomes]
    for campo, preferidos in COLUNAS_CONHECIDAS.items():
        for preferido in preferidos:
            if preferido not in normalizados:
                continue
            indice = normalizados.index(preferido)
            if campo == "codigo" and valores_por_coluna is not None:
                valores = {texto_da_celula(v) for v in valores_por_coluna[indice]} - {None}
                if not valores or valores == {str(codigo_da_vaga)}:
                    continue
            achados[campo] = indice
            break
    # Coluna curta com "cpf" ou "e-mail" no nome (ex.: "CPF (somente números)").
    for campo, palavra in (("cpf", "cpf"), ("email", "e mail")):
        if campo in achados:
            continue
        for indice, nome in enumerate(normalizados):
            if len(nome) <= 30 and (palavra in nome or (campo == "email" and "email" in nome)):
                achados[campo] = indice
                break
    return achados


def eh_cabecalho(linha):
    campos = {_PARA_CAMPO.get(normalizar_nome(c)) for c in linha if not vazio(c)}
    campos.discard(None)
    return len(campos) >= 2


# ── Arquivo ─────────────────────────────────────────────────────────────────


def _ler_abas(caminho):
    """{aba: lista de linhas (listas de células)} do Excel ou CSV, sem cabeçalho."""
    import pandas as pd

    nome = str(caminho).lower()
    if nome.endswith(".csv"):
        quadro = pd.read_csv(caminho, header=None, dtype=object, sep=None, engine="python", encoding="utf-8-sig")
        return {"Planilha": quadro.values.tolist()}
    abas = pd.read_excel(caminho, sheet_name=None, header=None, dtype=object)
    return {str(aba): quadro.values.tolist() for aba, quadro in abas.items()}


def _tabela(linhas):
    """(nomes das colunas, linhas de dados) a partir do cabeçalho detectado."""
    inicio = 0
    for i, linha in enumerate(linhas[:LINHAS_PROCURADAS_NO_CABECALHO]):
        if eh_cabecalho(linha):
            inicio = i
            break
    if not linhas:
        return [], []
    nomes = nomes_unicos(linhas[inicio])
    dados = [l for l in linhas[inicio + 1 :] if any(not vazio(c) for c in l)]
    return nomes, dados


def ler_planilha(caminho, codigo_da_vaga=None):
    """
    Lê o Excel da Empregare e devolve:
      {"colunas": [nomes na ordem], "linhas": [linha para gravar_lote_empregare],
       "sem_chave": n, "repetidas": n, "abas": n}
    Cada linha: chave, tipo, codigo, nome, email, cpf, telefone, nascimento,
    situacao, candidatura e colunas (todas, {"nome": "valor"}).
    """
    abas = _ler_abas(caminho)
    tabelas = {aba: _tabela(linhas) for aba, linhas in abas.items()}
    principal = next((a for a, (nomes, _) in tabelas.items() if eh_cabecalho(nomes)), None)
    if principal is None:
        principal = max(tabelas, key=lambda a: len(tabelas[a][1])) if tabelas else None
    if principal is None:
        return {"colunas": [], "linhas": [], "sem_chave": 0, "repetidas": 0, "abas": 0}

    nomes, dados = tabelas[principal]
    colunas_de_valores = [[l[i] if i < len(l) else None for l in dados] for i in range(len(nomes))]
    mapa = mapear_colunas(nomes, colunas_de_valores, codigo_da_vaga)

    def campo(linha, nome):
        i = mapa.get(nome)
        return linha[i] if i is not None and i < len(linha) else None

    extras = _abas_extras(tabelas, principal, codigo_da_vaga)
    colunas = list(nomes)
    for aba, _, _ in extras:
        colunas.append(f"{aba} ›")

    por_chave = {}
    sem_chave = 0
    repetidas = 0
    for linha in dados:
        chave, tipo = chave_natural(campo(linha, "codigo"), campo(linha, "cpf"), campo(linha, "email"))
        if not chave:
            sem_chave += 1
            continue
        originais = {}
        for i, nome in enumerate(nomes):
            valor = texto_da_celula(linha[i]) if i < len(linha) else None
            if valor is not None:
                originais[nome] = valor
        for aba, chave_extra, grupos in extras:
            achadas = grupos.get(_chave_de_juncao(chave_extra, linha, mapa))
            if achadas:
                originais[f"{aba} ›"] = achadas
        if chave in por_chave:
            repetidas += 1
        por_chave[chave] = {
            "chave": chave,
            "tipo": tipo,
            "codigo": normalizar_codigo(campo(linha, "codigo")),
            "nome": texto_da_celula(campo(linha, "nome")),
            "email": normalizar_email(campo(linha, "email")),
            "cpf": normalizar_cpf(campo(linha, "cpf")),
            "telefone": texto_da_celula(campo(linha, "telefone")),
            "nascimento": _data_iso(campo(linha, "nascimento")),
            "situacao": texto_da_celula(campo(linha, "situacao")),
            "candidatura": _momento_iso(campo(linha, "candidatura")),
            "colunas": originais,
        }
    return {
        "colunas": colunas,
        "linhas": list(por_chave.values()),
        "sem_chave": sem_chave,
        "repetidas": repetidas,
        "abas": len(tabelas),
    }


def _chave_de_juncao(campo, linha, mapa):
    i = mapa.get(campo)
    valor = linha[i] if i is not None and i < len(linha) else None
    return {"codigo": normalizar_codigo, "cpf": normalizar_cpf, "email": normalizar_email}[campo](valor)


def _abas_extras(tabelas, principal, codigo_da_vaga):
    """[(aba, campo da junção, {valor da chave: [linhas como dict]})] das outras abas."""
    extras = []
    for aba, (nomes, dados) in tabelas.items():
        if aba == principal or not dados:
            continue
        colunas_de_valores = [[l[i] if i < len(l) else None for l in dados] for i in range(len(nomes))]
        mapa = mapear_colunas(nomes, colunas_de_valores, codigo_da_vaga)
        campo = next((c for c in ("codigo", "cpf", "email") if c in mapa), None)
        if not campo:
            continue
        grupos = {}
        for linha in dados:
            valor = _chave_de_juncao(campo, linha, mapa)
            if not valor:
                continue
            item = {
                nome: texto_da_celula(linha[i])
                for i, nome in enumerate(nomes)
                if i < len(linha) and texto_da_celula(linha[i]) is not None
            }
            grupos.setdefault(valor, []).append(item)
        extras.append((aba[:60], campo, grupos))
    return extras


def _data_iso(valor):
    if vazio(valor):
        return None
    if isinstance(valor, (datetime, date)):
        return (valor.date() if isinstance(valor, datetime) else valor).isoformat()
    texto = str(valor).strip()
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\s.*)?", texto)
    if m:
        d, mes, a = (int(x) for x in m.groups())
        try:
            return date(a, mes, d).isoformat()
        except ValueError:
            return None
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2}).*", texto)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def _momento_iso(valor):
    """Data e hora em ISO sem fuso (o banco lê na hora de Brasília)."""
    if vazio(valor):
        return None
    if isinstance(valor, datetime):
        return valor.replace(microsecond=0, tzinfo=None).isoformat()
    if isinstance(valor, date):
        return valor.isoformat()
    texto = str(valor).strip()
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?", texto)
    if m:
        d, mes, a, h, mi, s = m.groups()
        try:
            return datetime(int(a), int(mes), int(d), int(h or 0), int(mi or 0), int(s or 0)).isoformat()
        except ValueError:
            return None
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?.*", texto)
    if m:
        return m.group(1) + (f"T{m.group(2)}" if m.group(2) else "")
    return None


def em_lotes(linhas, tamanho=500):
    return [linhas[i : i + tamanho] for i in range(0, len(linhas), tamanho)]
