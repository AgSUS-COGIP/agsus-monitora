"""
PROVA: A REGRA PRÓPRIA DA TRIAGEM DÁ O MESMO RESULTADO QUE A REGRA ANTIGA

Para cada edital, calcula a Triagem (pre_classificar_vaga, o mesmo cálculo do
job) duas vezes com os mesmos inscritos:
  - com a regra ANTIGA: a regra da análise (provisoria, lote, blocos) e o
    `documental` da regra da Classificação, como o job lia até 20261029160000;
  - com a regra NOVA: a seção da Triagem (TB_REGRA_TRIAGEM), pelo caminho do job
    (entradas_do_calculo).
e compara TUDO o que o cálculo devolve, vaga a vaga: cada linha (situação,
motivo, nota, modalidade, posição, lote, entrada…), o resumo (tamanho do lote,
corte, avisos) e o retrato das inscrições; também as colunas que cada regra
manda ler. Não grava nada: só lê (pre_classificacao_ler_colunas e
pre_classificacao_ler_candidatos) e calcula em memória — serve também para o
114/2026, que está congelado.

Saída: só contagens e um hash de cada resultado por edital (nada de dado
pessoal). Código de saída 0 = idêntico em todos; 1 = alguma diferença.

Uso (com a migration aplicada, pelo service_role):
  python scripts/pre_classificacao/comparar_regra_da_triagem.py [--editais 93/2026,114/2026]
Antes de aplicar, a mesma conta roda com as regras do ensaio da migration
(`comparar(chamar, editais, hoje)`, editais com 'regra', 'documental' e 'triagem').
"""

import hashlib
import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "python"))

from pre_classificacao import (  # noqa: E402
    dados_da_vaga,
    entradas_do_calculo,
    ler_candidatos,
)

from monitora.avaliacao_documental.colunas_da_leitura import colunas_necessarias  # noqa: E402
from monitora.avaliacao_documental.pre_classificacao import (  # noqa: E402
    congela_a_declarada,
    fim_das_inscricoes,
    normalizar_regra,
    pre_classificar_vaga,
)
from monitora.avaliacao_documental.retrato_das_inscricoes import retrato_da_vaga  # noqa: E402


def _hash(valor):
    texto = json.dumps(valor, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:16]


def _sem_privados(resultado):
    """As linhas sem os campos internos (_nascimento, _candidatura, _anterior)."""
    return {
        "resumo": resultado["resumo"],
        "linhas": [{k: v for k, v in linha.items() if not k.startswith("_")} for linha in resultado["linhas"]],
    }


def entradas_antigas(edital):
    """(regra, documental) como o job lia antes da regra própria da Triagem."""
    return normalizar_regra((edital.get("regra") or {}).get("configuracao")), edital.get("documental") or {}


def calcular(chamar, edital, vaga, lidos, regra, documental, hoje):
    vaga = {**vaga, **(lidos.get("vaga") or {})}
    congelar = congela_a_declarada(hoje, fim_das_inscricoes(edital.get("cronograma")))
    r = pre_classificar_vaga(
        regra,
        dados_da_vaga(vaga, documental),
        lidos.get("candidatos") or [],
        anterior=lidos.get("anterior") or {},
        ultimo_lote=vaga.get("ultimo_lote") or 0,
        refazer=False,
        hoje=hoje,
        congelar=congelar,
        decisoes=lidos.get("decisoes") or {},
        cronograma=edital.get("cronograma"),
    )
    retrato = retrato_da_vaga(vaga["codigo"], lidos.get("candidatos") or [], regra, r, previa=False)
    return {**_sem_privados(r), "retrato": retrato}


def comparar_edital(chamar, edital, hoje):
    rotulo = edital.get("rotulo") or edital.get("id")
    if not edital.get("regra") and not edital.get("triagem"):
        return {"edital": rotulo, "situacao": "SEM_REGRA", "identico": True, "vagas": 0}
    if bool(edital.get("regra")) != bool(edital.get("triagem")):
        return {"edital": rotulo, "situacao": "SO_UMA_REGRA", "identico": False, "vagas": 0}
    antiga, doc_antigo = entradas_antigas(edital)
    nova, doc_novo = entradas_do_calculo(edital)
    nomes = (chamar("pre_classificacao_ler_colunas", {"p_edital": edital["id"]}) or {}).get("colunas") or []
    col_antigas = colunas_necessarias(antiga, nomes)
    col_novas = colunas_necessarias(nova, nomes)
    saida = {
        "edital": rotulo,
        "situacao": "COMPARADO",
        "colunas_iguais": col_antigas == col_novas,
        "situacao_igual": (edital["regra"] or {}).get("situacao") == (edital["triagem"] or {}).get("situacao"),
        "vagas": 0,
        "inscritos": 0,
        "eliminados": 0,
        "no_lote": 0,
        "vagas_diferentes": [],
    }
    hashes = []
    for vaga in edital.get("vagas") or []:
        lidos = ler_candidatos(chamar, edital, vaga, colunas=sorted(set(col_antigas) | set(col_novas)))
        a = calcular(chamar, edital, vaga, lidos, antiga, doc_antigo, hoje)
        b = calcular(chamar, edital, vaga, lidos, nova, doc_novo, hoje)
        saida["vagas"] += 1
        saida["inscritos"] += int(a["resumo"]["inscritos"] or 0)
        saida["eliminados"] += int(a["resumo"]["eliminados"] or 0)
        saida["no_lote"] += int(a["resumo"]["no_lote"] or 0)
        hashes.append((_hash(a), _hash(b)))
        if a != b:
            saida["vagas_diferentes"].append(vaga["codigo"])
    saida["hash_antigo"] = _hash([h[0] for h in hashes])
    saida["hash_novo"] = _hash([h[1] for h in hashes])
    saida["identico"] = saida["colunas_iguais"] and saida["situacao_igual"] and not saida["vagas_diferentes"]
    return saida


def comparar(chamar, editais, hoje):
    return [comparar_edital(chamar, e, hoje) for e in editais]


def main():
    from pre_classificacao import separar

    from monitora import supabase_rpc

    pedidos = separar(os.environ.get("EDITAIS", "") or (sys.argv[2] if len(sys.argv) > 2 else ""))
    cfg = supabase_rpc.configuracao()

    def chamar(funcao, corpo):
        return supabase_rpc.chamar(cfg, funcao, corpo)

    lidos = (
        chamar(
            "pre_classificacao_ler_editais",
            {"p_editais": pedidos or None, "p_apos_robo": False, "p_incluir_congelados": True, "p_liberacao": None},
        )
        or {}
    )
    resultado = comparar(chamar, lidos.get("editais") or [], lidos.get("hoje"))
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    return 0 if all(r["identico"] for r in resultado) else 1


if __name__ == "__main__":
    sys.exit(main())
