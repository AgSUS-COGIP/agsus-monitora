"""
PRÉ-CLASSIFICAÇÃO DOS EDITAIS DE TREINAMENTO (992/2099 PROJETOS E 991/2099 SAÚDE INDÍGENA)

Os editais de treinamento já nascem com a pré-classificação rodada. Quem calcula
é o MESMO código do job (scripts/pre_classificacao/pre_classificacao.py →
processar_edital, com python/monitora/avaliacao_documental/): este script roda
o cálculo sobre os candidatos fictícios da área e grava o resultado pronto no
bloco marcado da migration; o preparar do banco o grava pelas mesmas RPCs do
job. Os testes tests/python/test_treinamento_projetos.py e
tests/python/test_treinamento_saude_indigena.py conferem que o Python continua
dando o mesmo.

  projetos        40 fictícios, regra do 93/2026 (migration 20261008110000,
                  bloco pre-classificacao-do-treinamento:inicio/fim)
  saude-indigena  30 fictícios, regra do 111/2026 (migration 20261009120000,
                  bloco pre-classificacao-do-treinamento-si:inicio/fim)

A entrada (tests/fixtures/avaliacao-documental/treinamento-<área>.json) é o que
o job leria do banco para o edital — pre_classificacao_ler_editais e
pre_classificacao_ler_candidatos —, capturada num ensaio (begin … rollback) com
a migration aplicada (o bloco ainda sem resultado), com o id de cada inscrito
trocado pelo código fictício. Só dados fictícios ("Candidato Teste …"); nada
de dado pessoal.

Uso
  python scripts/pre_classificacao/gerar_treinamento.py [--area projetos|saude-indigena]
      recalcula a partir da entrada guardada e atualiza o resultado (fixture e migration)
  python scripts/pre_classificacao/gerar_treinamento.py --area saude-indigena --leitura <arquivo.json>
      troca a entrada pela leitura de um ensaio ({"editais": …, "candidatos": {vaga: …}})
Depois, npx prettier --write tests/fixtures/avaliacao-documental/treinamento-<área>.json.
Mudou a regra, os fictícios ou o cálculo? Rode de novo e reaplique a função numa migration nova.
"""

import argparse
import json
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "python"))
sys.path.insert(0, str(RAIZ / "scripts" / "pre_classificacao"))

import pre_classificacao as job  # noqa: E402

FIXTURES = RAIZ / "tests" / "fixtures" / "avaliacao-documental"
MIGRATIONS = RAIZ / "supabase" / "migrations"
ID_DO_EDITAL = "edital-de-treinamento"

AREAS = {
    "projetos": {
        "edital": "992/2099",
        "fixture": FIXTURES / "treinamento-projetos.json",
        "migration": MIGRATIONS / "20261008110000_treinamento_avaliacao_documental.sql",
        "marcador": "pre-classificacao-do-treinamento",
        "sobre": (
            "Edital de treinamento de Projetos (992/2099): a entrada é o que o job da pré-classificação lê do banco "
            "(pre_classificacao_ler_editais e pre_classificacao_ler_candidatos, só fictícios, com o código no lugar do id) "
            "e o resultado é o que o Python calcula e a migration 20261008110000 grava. Gerado por "
            "scripts/pre_classificacao/gerar_treinamento.py (depois: npx prettier --write neste arquivo); "
            "conferido por tests/python/test_treinamento_projetos.py."
        ),
    },
    "saude-indigena": {
        "edital": "991/2099",
        "fixture": FIXTURES / "treinamento-saude-indigena.json",
        "migration": MIGRATIONS / "20261009120000_treinamentos_completos.sql",
        "marcador": "pre-classificacao-do-treinamento-si",
        "sobre": (
            "Edital de treinamento da Saúde Indígena (991/2099): a entrada é o que o job da pré-classificação lê do "
            "banco (pre_classificacao_ler_editais e pre_classificacao_ler_candidatos, só fictícios, com o código no "
            "lugar do id) e o resultado é o que o Python calcula e a migration 20261009120000 grava. Gerado por "
            "scripts/pre_classificacao/gerar_treinamento.py --area saude-indigena (depois: npx prettier --write neste "
            "arquivo); conferido por tests/python/test_treinamento_saude_indigena.py."
        ),
    },
}

# O de Projetos (o primeiro) continua nos nomes de antes.
FIXTURE = AREAS["projetos"]["fixture"]
MIGRATION = AREAS["projetos"]["migration"]
INICIO = f"-- {AREAS['projetos']['marcador']}:inicio"
FIM = f"-- {AREAS['projetos']['marcador']}:fim"


def marcadores(area="projetos"):
    m = AREAS[area]["marcador"]
    return f"-- {m}:inicio", f"-- {m}:fim"


def entrada_da_leitura(leitura):
    """A entrada guardada: o edital de treinamento e os inscritos por vaga, com o código no lugar do id."""
    editais = (leitura.get("editais") or {}).get("editais") or []
    if len(editais) != 1:
        raise ValueError("a leitura deve ter um só edital (o de treinamento da área)")
    edital = {**editais[0], "id": ID_DO_EDITAL}
    candidatos = {}
    for vaga, lidos in sorted((leitura.get("candidatos") or {}).items()):
        candidatos[vaga] = {
            "candidatos": sorted(
                ({**c, "id": c["codigo"]} for c in lidos.get("candidatos") or []), key=lambda c: c["codigo"]
            ),
            "anterior": {},
            "decisoes": {},
        }
    return {"hoje": (leitura.get("editais") or {}).get("hoje"), "edital": edital, "candidatos": candidatos}


def calcular(entrada):
    """
    O resultado do job para a entrada: {"edital": resumo do edital (o que vai a
    finalizar_pre_classificacao), "vagas": {código: {"resumo", "linhas"}}}; cada
    linha leva o código do inscrito (o banco troca pelo id), na ordem do código
    (a ordem de leitura segue o id, que muda a cada criação; o resultado não).
    """
    vagas = {}

    def chamar(funcao, corpo):
        if funcao != "pre_classificacao_ler_candidatos":
            raise ValueError(f"RPC inesperada: {funcao}")
        return entrada["candidatos"][corpo["p_vaga"]]

    def gravar(codigo, r):
        resumo, linhas = job.payload_da_vaga(r)
        linhas = sorted(({"codigo": linha.pop("id"), **linha} for linha in linhas), key=lambda linha: linha["codigo"])
        vagas[codigo] = {"resumo": resumo, "linhas": linhas}

    resumo = job.processar_edital(chamar, entrada["edital"], entrada["hoje"], False, gravar)
    if resumo["situacao"] != "PROCESSADO":
        raise ValueError(f"o edital de treinamento não foi processado: {resumo['situacao']}")
    edital = {k: v for k, v in job.para_o_banco(resumo).items() if k != "edital"}
    return {"edital": edital, "vagas": dict(sorted(vagas.items()))}


def bloco_da_migration(texto, area="projetos"):
    """O JSON do resultado gravado na migration (entre os marcadores da área)."""
    abre_marca, fecha_marca = marcadores(area)
    inicio = texto.index(abre_marca)
    fim = texto.index(fecha_marca, inicio)
    trecho = texto[inicio:fim]
    abre = trecho.index("$pre$") + len("$pre$")
    fecha = trecho.index("$pre$", abre)
    return json.loads(trecho[abre:fecha])


def com_bloco(texto, resultado, area="projetos"):
    abre_marca, fecha_marca = marcadores(area)
    inicio = texto.index(abre_marca)
    fim = texto.index(fecha_marca, inicio)
    novo = (
        f"{abre_marca}\n  c_pre constant jsonb := $pre$"
        + json.dumps(resultado, ensure_ascii=False, separators=(",", ":"))
        + "$pre$::jsonb;\n  "
    )
    return texto[:inicio] + novo + texto[fim:]


def principal(lista=None):
    p = argparse.ArgumentParser(description="Pré-classificação dos editais de treinamento")
    p.add_argument("--area", choices=sorted(AREAS), default="projetos", help="edital de treinamento da área")
    p.add_argument("--leitura", help="JSON lido do banco num ensaio (editais e candidatos)")
    args = p.parse_args(lista)
    cfg = AREAS[args.area]
    if args.leitura:
        entrada = entrada_da_leitura(json.loads(pathlib.Path(args.leitura).read_text(encoding="utf-8")))
    else:
        entrada = json.loads(cfg["fixture"].read_text(encoding="utf-8"))["entrada"]
    resultado = calcular(entrada)
    cfg["fixture"].write_text(
        json.dumps({"sobre": cfg["sobre"], "entrada": entrada, "resultado": resultado}, ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
        newline="\n",
    )
    migration = cfg["migration"]
    # Mantém o fim de linha do arquivo (o checkout no Windows pode estar em CRLF).
    fim_de_linha = "\r\n" if b"\r\n" in migration.read_bytes() else "\n"
    migration.write_text(
        com_bloco(migration.read_text(encoding="utf-8"), resultado, args.area), encoding="utf-8", newline=fim_de_linha
    )
    r = resultado["edital"]
    print(
        f"{cfg['edital']}: {r['vagas']} vagas · {r['inscritos']} inscritos · {r['eliminados']} eliminados · "
        f"{r['ranqueados']} na Provisória · {r['no_lote']} no lote · {r['divergencias']} divergência(s)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(principal())
