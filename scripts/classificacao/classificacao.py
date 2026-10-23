"""
CLASSIFICAÇÃO EM PYTHON — RELATÓRIO DE DESEMPATE DE CADA LISTA GERADA E CONFERÊNCIA COM A TELA

Dois modos:

--desempate (etapa 2a: o que o workflow classificacao.yml roda)
  Para cada lista gerada que espera o relatório (classificacao_ler_pedidos_desempate:
  as pendentes e as pedidas em --lista), marca PREPARANDO, lê a lista registrada
  (classificacao_ler_lista: retrato, hash, tipo, versão da regra) e o edital
  (classificacao_ler_edital, com os nomes reais), calcula a lista com o Python
  e monta o retrato que a tela grava. Só se o retrato calculado for IGUAL ao
  registrado (e a versão da regra a mesma), grava o relatório de desempate
  (classificacao_gravar_desempate, que confere o hash de novo e marca PRONTO);
  senão marca NAO_CONFERE (os dados mudaram desde a geração, ou o Python e o
  motor da tela divergem). Erro numa lista marca FALHOU e segue para a próxima.

--seco (etapa 1: conferência)
  Lê um edital (--edital) ou o json salvo (--arquivo), classifica com o Python
  e com o motor da tela (src/lib/classificacao/motor.ts, pelo Node:
  scripts/classificacao/classificar-como-a-tela.mjs) nas listas pedidas e
  compara os dois, caminho a caminho. Não grava nada; --saida guarda, por
  edital e lista, o relatório (.json e .txt) e as divergências com os dois
  valores (divergencias-*.json) só na máquina de quem roda.

Uso
  python scripts/classificacao/classificacao.py --desempate [--lista <uuid>…]
  python scripts/classificacao/classificacao.py --seco --edital <uuid> [--edital <uuid>…]
      [--tipos PRELIMINAR,CONVOCACAO,ENTREVISTA,FINAL] [--saida <pasta>]
  python scripts/classificacao/classificacao.py --seco --arquivo <dados.json> [...]

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. --seco precisa do Node 24.
O log é público (repositório público): só número do edital, lista, contagens e
o caminho das diferenças — nunca nome, nota nem valor. Os nomes reais chegam
ao job (decisão de 23/10/2026: a ordem alfabética do desempate final é a do
Python) e ficam só na memória; a mensagem gravada no preparo também não os leva.

Saída: 0 tudo certo; 2 com divergência (--seco) ou lista não conferida/falha
(--desempate); 1 erro; 3 entrada inválida.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

_AQUI = pathlib.Path(__file__).resolve().parent
_RAIZ = _AQUI.parents[1]
sys.path.insert(0, str(_RAIZ / "python"))

from monitora import execucao, supabase_rpc  # noqa: E402
from monitora.classificacao.comparacao import comparar  # noqa: E402
from monitora.classificacao.desempate import relatorio_do_rastro, texto_do_relatorio  # noqa: E402
from monitora.classificacao.motor import DadosInvalidos, classificar_com_rastro, entrada_do_edital  # noqa: E402
from monitora.classificacao.retrato import conferir_com_o_registrado, retrato_do_edital  # noqa: E402
from monitora.mascaramento import mascarar, resumo_do_erro  # noqa: E402

TITULO_SECO = "Classificação em Python → conferência com o motor da tela"
TITULO_DESEMPATE = "Classificação em Python → relatório de desempate das listas geradas"
TIPOS = ("PRELIMINAR", "CONVOCACAO", "ENTREVISTA", "FINAL")
SEM_DIVERGENCIA, COM_DIVERGENCIA, ERRO, ENTRADA_INVALIDA = 0, 2, 1, 3
MOTOR_DA_TELA = _AQUI / "classificar-como-a-tela.mjs"
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)

MENSAGEM_REGRA_MUDOU = "A regra do edital mudou desde a geração; gere a lista de novo."
MENSAGEM_NAO_CONFERE = (
    "O cálculo em Python não confere com esta lista ({n} diferença(s)): os dados mudaram desde a "
    "geração ou o cálculo diverge do da tela."
)


def ler_edital(config, edital_id, chamar=supabase_rpc.chamar):
    dados = chamar(config, "classificacao_ler_edital", {"p_edital": edital_id})
    if not isinstance(dados, dict):
        raise ValueError("classificacao_ler_edital não devolveu um objeto.")
    return dados


# ── --seco: Python × motor da tela ──────────────────────────────────────


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


def rodar_seco(a, argumentos, ambiente, ler, motor) -> int:
    tipos = [t.strip().upper() for t in a.tipos.split(",") if t.strip()]
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
    except Exception as erro:  # noqa: BLE001 — o resumo diz o que falhou, sem valores
        linhas.append(f"Falhou: {motivo_seguro(erro)}")
        execucao.resumir(TITULO_SECO, linhas, ambiente=ambiente)
        return ERRO
    linhas.append(
        "Sem divergência: o Python dá a mesma saída do motor da tela."
        if not divergentes
        else f"{divergentes} divergência(s)."
    )
    execucao.resumir(TITULO_SECO, linhas, ambiente=ambiente)
    return COM_DIVERGENCIA if divergentes else SEM_DIVERGENCIA


# ── --desempate: o relatório de cada lista gerada ───────────────────────


def motivo_seguro(erro) -> str:
    """
    O motivo de uma falha sem dado do edital: das RPCs, a mensagem do banco
    (textos fixos das funções, mascarados); dos dados malformados e do motor da
    tela, a mensagem fixa; de qualquer outra exceção, só o tipo — a mensagem
    poderia citar um valor (um nome, uma nota).
    """
    if isinstance(erro, supabase_rpc.ErroDoSupabase | DadosInvalidos | RuntimeError):
        return resumo_do_erro(erro)
    return type(erro).__name__


class ListaNaoConfere(Exception):
    """O retrato calculado pelo Python não é o da lista registrada (ou a regra mudou)."""

    def __init__(self, mensagem: str, caminhos: list[str]):
        super().__init__(mensagem)
        self.caminhos = caminhos


def _marcar_sem_derrubar(marcar, situacao: str, mensagem: str) -> None:
    try:
        marcar(situacao, mascarar(mensagem)[:300])
    except Exception:  # noqa: BLE001, S110 — a marcação é aviso; a lista segue sem relatório
        pass


def preparar_lista(config, pedido: dict, execucao_id: str, editais: dict, chamar=supabase_rpc.chamar) -> dict:
    """
    Prepara o relatório de uma lista: {situacao, linhas}. PRONTO quando gravou;
    NAO_CONFERE ou FALHOU (já marcados no banco) quando não.
    """
    lista_id = str(pedido.get("lista") or "")
    rotulo = f"lista {lista_id[:8]}"

    def marcar(situacao: str, mensagem: str | None = None):
        chamar(
            config,
            "classificacao_marcar_preparo",
            {"p_execucao": execucao_id, "p_lista": lista_id, "p_situacao": situacao, "p_mensagem": mensagem},
        )

    try:
        marcar("PREPARANDO")
        lista = chamar(config, "classificacao_ler_lista", {"p_lista": lista_id})
        if not isinstance(lista, dict) or not isinstance(lista.get("resultado"), dict):
            raise ValueError("classificacao_ler_lista não devolveu a lista.")
        edital_id = str(lista.get("edital") or "")
        if edital_id not in editais:
            editais[edital_id] = ler_edital(config, edital_id, chamar=chamar)
        dados = editais[edital_id]
        numero = str((dados.get("edital") or {}).get("numero") or "edital")
        tipo = str(lista.get("tipo") or "")
        rotulo = f"{numero} · {tipo} · lista {lista_id[:8]}"
        versao = (dados.get("regra") or {}).get("versao")
        if versao != lista.get("versao_regra"):
            raise ListaNaoConfere(MENSAGEM_REGRA_MUDOU, ["regra_versao"])
        resultado, rastro = classificar_com_rastro(entrada_do_edital(dados, tipo))
        diferencas = conferir_com_o_registrado(retrato_do_edital(dados, resultado), lista["resultado"])
        if diferencas:
            raise ListaNaoConfere(
                MENSAGEM_NAO_CONFERE.format(n=len(diferencas)), [d["caminho"] for d in diferencas[:5]]
            )
        relatorio = relatorio_do_rastro(resultado, rastro)
        chamar(
            config,
            "classificacao_gravar_desempate",
            {
                "p_execucao": execucao_id,
                "p_lista": lista_id,
                "p_hash": lista.get("hash"),
                "p_relatorio": relatorio,
                "p_texto": texto_do_relatorio(relatorio),
            },
        )
        t = relatorio["totais"]
        return {
            "situacao": "PRONTO",
            "linhas": [
                f"{rotulo}: relatório gravado — {t['grupos']} grupo(s) de empate, {t['decididosPorCriterio']} pelos "
                f"critérios, {t['empatadosAteOFim']} até o fim ({t['pendentes']} pendente(s))"
            ],
        }
    except ListaNaoConfere as nao:
        _marcar_sem_derrubar(marcar, "NAO_CONFERE", str(nao))
        return {
            "situacao": "NAO_CONFERE",
            "linhas": [f"{rotulo}: não confere com a lista registrada — {nao}"]
            + [f"{rotulo}: difere em {c}" for c in nao.caminhos],
        }
    except Exception as erro:  # noqa: BLE001 — uma lista com problema não segura as outras
        motivo = motivo_seguro(erro)
        _marcar_sem_derrubar(marcar, "FALHOU", f"O preparo falhou ({motivo}).")
        return {"situacao": "FALHOU", "linhas": [f"{rotulo}: falhou — {motivo}"]}


def rodar_desempate(a, argumentos, ambiente, chamar) -> int:
    listas = [x.strip() for valor in a.lista for x in valor.split(",") if x.strip()]
    if any(not _UUID.match(x) for x in listas):
        argumentos.error("--lista: use ids de lista (uuid), separados por vírgula ou repetindo a opção")
    execucao_id = execucao.identificador(prefixo="classificacao")
    try:
        config = supabase_rpc.configuracao(ambiente=ambiente)
        pedidos = chamar(config, "classificacao_ler_pedidos_desempate", {"p_listas": listas or None})
        if not isinstance(pedidos, list):
            raise ValueError("classificacao_ler_pedidos_desempate não devolveu uma lista.")
    except Exception as erro:  # noqa: BLE001
        execucao.resumir(TITULO_DESEMPATE, [f"Falhou ao ler os pedidos: {motivo_seguro(erro)}"], ambiente=ambiente)
        return ERRO
    if not pedidos:
        execucao.resumir(TITULO_DESEMPATE, ["Nenhuma lista esperando o relatório de desempate."], ambiente=ambiente)
        return SEM_DIVERGENCIA
    editais: dict = {}
    situacoes: dict = {}
    linhas = []
    for pedido in pedidos:
        feito = preparar_lista(config, pedido, execucao_id, editais, chamar=chamar)
        situacoes[feito["situacao"]] = situacoes.get(feito["situacao"], 0) + 1
        linhas.extend(feito["linhas"])
    linhas.append(
        f"{len(pedidos)} lista(s): "
        + ", ".join(
            f"{quantas} {situacao.lower().replace('_', ' ')}" for situacao, quantas in sorted(situacoes.items())
        )
        + f". Execução {execucao_id}."
    )
    execucao.resumir(TITULO_DESEMPATE, linhas, ambiente=ambiente)
    return SEM_DIVERGENCIA if set(situacoes) == {"PRONTO"} else COM_DIVERGENCIA


def principal(argv=None, ambiente=None, ler=ler_edital, motor=motor_da_tela, chamar=supabase_rpc.chamar) -> int:
    argumentos = execucao.Argumentos(description=__doc__.split("\n\n")[0].strip())
    modo = argumentos.add_mutually_exclusive_group(required=True)
    modo.add_argument("--desempate", action="store_true", help="grava o relatório de desempate das listas geradas")
    modo.add_argument("--seco", action="store_true", help="só lê, calcula e compara com o motor da tela")
    argumentos.add_argument("--lista", action="append", default=[], help="--desempate: id da lista (pode repetir)")
    argumentos.add_argument("--edital", action="append", default=[], help="--seco: id do edital (pode repetir)")
    argumentos.add_argument("--arquivo", action="append", default=[], help="--seco: json de classificacao_ler_edital")
    argumentos.add_argument("--tipos", default=",".join(TIPOS), help="--seco: listas, separadas por vírgula")
    argumentos.add_argument("--saida", help="--seco: pasta local para os relatórios e as divergências")
    a = argumentos.parse_args(argv)
    if a.desempate:
        if a.edital or a.arquivo or a.saida:
            argumentos.error("--desempate lê as listas pedidas; --edital, --arquivo e --saida são do --seco")
        return rodar_desempate(a, argumentos, ambiente, chamar)
    if a.lista:
        argumentos.error("--lista é do --desempate")
    return rodar_seco(a, argumentos, ambiente, ler, motor)


if __name__ == "__main__":
    sys.exit(principal(ambiente=os.environ))
