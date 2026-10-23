"""
CLASSIFICAÇÃO EM PYTHON — ETAPA 1: CÁLCULO EM PARALELO E RELATÓRIO DE DESEMPATE

Lê um edital pela RPC classificacao_ler_edital (só service_role: o json de
obter_classificacao_do_edital SEM nomes — cada nome vira um apelido de 6 dígitos
na ordem alfabética do motor —, com a configuração de convocação), classifica
com o Python (python/monitora/classificacao/) e com o motor da tela
(src/lib/classificacao/motor.ts, pelo Node: scripts/classificacao/classificar-como-a-tela.mjs)
nas listas pedidas e compara os dois, caminho a caminho. Gera também o
relatório de desempate de cada lista (json estável + texto).

Nesta etapa a tela continua com o motor.ts e o job só roda --seco: não grava
nada (a RPC classificacao_gravar_desempate existe, mas fica para a etapa 2).

Uso
  python scripts/classificacao/classificacao.py --seco --edital <uuid> [--edital <uuid>…]
      [--tipos PRELIMINAR,CONVOCACAO,ENTREVISTA,FINAL] [--saida <pasta>]
  python scripts/classificacao/classificacao.py --seco --arquivo <dados.json> [...]
      o json de classificacao_ler_edital salvo num arquivo (sem banco)

--saida grava, por edital e lista, o relatório de desempate (.json e .txt) e as
divergências com os dois valores (divergencias-*.json). Fica só na máquina de
quem roda: o log não leva nada disso.

Variáveis (com --edital): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Precisa do
Node 24 (o motor da tela é TypeScript, rodado direto pelo Node).
O log é público (repositório público): só número do edital, lista, contagens e
o caminho da divergência (sem valores).

Saída: 0 sem divergência; 2 com divergência; 1 erro; 3 entrada inválida.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import tempfile

_AQUI = pathlib.Path(__file__).resolve().parent
_RAIZ = _AQUI.parents[1]
sys.path.insert(0, str(_RAIZ / "python"))

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.classificacao.comparacao import comparar  # noqa: E402
from monitora.classificacao.desempate import relatorio_do_rastro, texto_do_relatorio  # noqa: E402
from monitora.classificacao.motor import classificar_com_rastro, entrada_do_edital  # noqa: E402
from monitora.mascaramento import resumo_do_erro  # noqa: E402

TITULO = "Classificação em Python (etapa 1) → conferência com o motor da tela"
TIPOS = ("PRELIMINAR", "CONVOCACAO", "ENTREVISTA", "FINAL")
SEM_DIVERGENCIA, COM_DIVERGENCIA, ERRO, ENTRADA_INVALIDA = 0, 2, 1, 3
MOTOR_DA_TELA = _AQUI / "classificar-como-a-tela.mjs"


def ler_edital(config, edital_id, chamar=supabase_rpc.chamar):
    dados = chamar(config, "classificacao_ler_edital", {"p_edital": edital_id})
    if not isinstance(dados, dict):
        raise ValueError("classificacao_ler_edital não devolveu um objeto.")
    return dados


def motor_da_tela(dados: dict, tipos, node="node", rodar=subprocess.run) -> dict:
    """{tipo: resultado} do motor.ts, pelo Node (scripts/classificacao/classificar-como-a-tela.mjs)."""
    with tempfile.TemporaryDirectory() as pasta:
        arquivo = pathlib.Path(pasta) / "dados.json"
        arquivo.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
        feito = rodar(
            [node, str(MOTOR_DA_TELA), str(arquivo), ",".join(tipos)],
            cwd=str(_RAIZ),
            capture_output=True,
            check=False,
        )
    if feito.returncode != 0:
        raise RuntimeError(f"O motor da tela (Node) falhou com o código {feito.returncode}.")
    return json.loads(feito.stdout.decode("utf-8"))


def conferir_edital(dados: dict, tipos, motor=motor_da_tela) -> dict:
    """Por lista: o resultado do Python, o relatório de desempate e a comparação com o motor da tela."""
    da_tela = motor(dados, tipos)
    saida = {}
    for tipo in tipos:
        resultado, rastro = classificar_com_rastro(entrada_do_edital(dados, tipo))
        relatorio = relatorio_do_rastro(resultado, rastro)
        saida[tipo] = {
            "resultado": resultado,
            "relatorio": relatorio,
            "comparacao": comparar(da_tela[tipo], resultado),
        }
    return saida


def linhas_do_resumo(numero: str, conferido: dict) -> list[str]:
    """O que vai para o log público: lista, contagens e os caminhos divergentes (sem valores)."""
    linhas = []
    for tipo, item in conferido.items():
        r, c, t = item["resultado"]["totais"], item["comparacao"], item["relatorio"]["totais"]
        linhas.append(
            f"{numero} · {tipo}: {r['candidatos']} candidatos, {r['elegiveis']} na lista, {r['eliminados']} eliminados, "
            f"{r['aguardando']} aguardando; {t['grupos']} grupos de empate ({t['empatadosAteOFim']} até o fim, "
            f"{t['pendentes']} pendentes); divergências com o motor da tela: {c['total']}"
        )
        for d in c["exemplos"][:5]:
            linhas.append(f"{numero} · {tipo}: diverge em {d['caminho']}")
    return linhas


def gravar_arquivos(pasta: pathlib.Path, numero: str, conferido: dict) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    nome = numero.replace("/", "-") or "edital"
    for tipo, item in conferido.items():
        base = pasta / f"{nome}-{tipo.lower()}"
        base.with_suffix(".desempate.json").write_text(
            json.dumps(item["relatorio"], ensure_ascii=False, indent=1), encoding="utf-8"
        )
        base.with_suffix(".desempate.txt").write_text(texto_do_relatorio(item["relatorio"]), encoding="utf-8")
        (pasta / f"divergencias-{nome}-{tipo.lower()}.json").write_text(
            json.dumps(item["comparacao"], ensure_ascii=False, indent=1), encoding="utf-8"
        )


def principal(argv=None, ambiente=None, ler=ler_edital, motor=motor_da_tela) -> int:
    argumentos = execucao.Argumentos(description=__doc__.split("\n\n")[0].strip())
    argumentos.add_argument("--seco", action="store_true", help="só lê, calcula e compara (obrigatório nesta etapa)")
    argumentos.add_argument("--edital", action="append", default=[], help="id do edital (pode repetir)")
    argumentos.add_argument("--arquivo", action="append", default=[], help="json de classificacao_ler_edital salvo")
    argumentos.add_argument("--tipos", default=",".join(TIPOS), help="listas, separadas por vírgula")
    argumentos.add_argument("--saida", help="pasta local para os relatórios e as divergências")
    a = argumentos.parse_args(argv)
    tipos = [t.strip().upper() for t in a.tipos.split(",") if t.strip()]
    if not a.seco:
        argumentos.error("nesta etapa o job só roda --seco (a gravação do relatório fica para a etapa 2)")
    if not a.edital and not a.arquivo:
        argumentos.error("informe --edital ou --arquivo")
    if any(t not in TIPOS for t in tipos) or not tipos:
        argumentos.error(f"--tipos: use {', '.join(TIPOS)}")

    linhas = []
    divergentes = 0
    try:
        fontes = [("arquivo", caminho) for caminho in a.arquivo] + [("edital", e) for e in a.edital]
        config = supabase_rpc.configuracao(ambiente=ambiente) if a.edital else None
        for tipo_da_fonte, fonte in fontes:
            if tipo_da_fonte == "arquivo":
                dados = json.loads(pathlib.Path(fonte).read_text(encoding="utf-8"))
            else:
                dados = ler(config, fonte)
            numero = str((dados.get("edital") or {}).get("numero") or "edital")
            conferido = conferir_edital(dados, tipos, motor=motor)
            divergentes += sum(item["comparacao"]["total"] for item in conferido.values())
            linhas.extend(linhas_do_resumo(numero, conferido))
            if a.saida:
                gravar_arquivos(pathlib.Path(a.saida), numero, conferido)
    except Exception as erro:  # noqa: BLE001 — o resumo diz o que falhou, mascarado
        linhas.append(f"Falhou: {resumo_do_erro(erro)}")
        execucao.resumir(TITULO, linhas, ambiente=ambiente)
        return ERRO
    linhas.append(
        "Sem divergência: o Python dá a mesma saída do motor da tela."
        if not divergentes
        else f"{divergentes} divergência(s)."
    )
    execucao.resumir(TITULO, linhas, ambiente=ambiente)
    return COM_DIVERGENCIA if divergentes else SEM_DIVERGENCIA


if __name__ == "__main__":
    sys.exit(principal(ambiente=os.environ))
