"""
CLASSIFICAÇÃO EM PYTHON — A LISTA CALCULADA PELO PYTHON, O RELATÓRIO DE DESEMPATE E A CONFERÊNCIA COM A TELA

Três modos:

--calculo e --desempate (o que o workflow classificacao.yml roda)
  Toda execução esvazia as duas filas, porque o GitHub guarda uma execução só na
  fila do grupo (a mais nova substitui a que esperava): primeiro os CÁLCULOS
  pedidos pelo "Gerar" (etapa 2b, com a chave "Gerar listas pelo Python"
  ligada), que têm alguém esperando na tela, e depois os RELATÓRIOS de
  desempate; entre um relatório e outro, olha de novo a fila dos cálculos.
  --desempate aceita --lista (as listas pedidas, além das que esperam).

  Cálculo (classificacao_ler_pedidos_calculo): marca CALCULANDO, lê o edital
  (classificacao_ler_edital, com os nomes reais), confere a versão da regra do
  pedido, calcula a lista com o Python e grava o retrato que a tela registraria
  (classificacao_gravar_calculo: o banco confere a forma, a versão e os
  candidatos e marca PRONTO). A tela confere esse retrato com o motor.ts e só
  então registra a lista. Erro ou regra mudada marca FALHOU e segue.

  Relatório (etapa 2a): para cada lista gerada que espera o relatório
  (classificacao_ler_pedidos_desempate: as pendentes e as pedidas em --lista),
  marca PREPARANDO, lê a lista registrada
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
  python scripts/classificacao/classificacao.py --calculo
  python scripts/classificacao/classificacao.py --desempate [--lista <uuid>…]
  python scripts/classificacao/classificacao.py --seco --edital <uuid> [--edital <uuid>…]
      [--tipos PRELIMINAR,CONVOCACAO,ENTREVISTA,FINAL] [--saida <pasta>]
  python scripts/classificacao/classificacao.py --seco --arquivo <dados.json> [...]

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. --seco precisa do Node 24.
O log é público (repositório público): só número do edital, lista, contagens e
o caminho das diferenças — nunca nome, nota nem valor. Os nomes reais chegam
ao job (decisão de 23/10/2026: a ordem alfabética do desempate final é a do
Python) e ficam só na memória; a mensagem gravada no preparo também não os leva.

Saída: 0 tudo certo; 2 com divergência (--seco) ou cálculo/lista não conferida/falha
(--calculo, --desempate); 1 erro; 3 entrada inválida.
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
from monitora.classificacao.motor import (  # noqa: E402
    DadosInvalidos,
    classificar_com_rastro,
    classificar_edital,
    entrada_do_edital,
)
from monitora.classificacao.retrato import conferir_com_o_registrado, retrato_do_edital  # noqa: E402
from monitora.mascaramento import mascarar, resumo_do_erro  # noqa: E402

TITULO_SECO = "Classificação em Python → conferência com o motor da tela"
TITULO_DESEMPATE = "Classificação em Python → cálculo das listas pedidas e relatório de desempate das geradas"
TIPOS = ("PRELIMINAR", "CONVOCACAO", "ENTREVISTA", "FINAL")
SEM_DIVERGENCIA, COM_DIVERGENCIA, ERRO, ENTRADA_INVALIDA = 0, 2, 1, 3
MOTOR_DA_TELA = _AQUI / "classificar-como-a-tela.mjs"
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)

MENSAGEM_REGRA_MUDOU = "A regra do edital mudou desde a geração; gere a lista de novo."
MENSAGEM_REGRA_MUDOU_NO_PEDIDO = "A regra do edital mudou desde o pedido; gere a lista de novo."
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


# ── --calculo: a lista calculada pelo Python (etapa 2b) ─────────────────


class CalculoRecusado(Exception):
    """O pedido não pode ser calculado como está (a regra mudou desde o pedido)."""


def calcular_pedido(config, pedido: dict, execucao_id: str, chamar=supabase_rpc.chamar) -> dict:
    """
    Calcula uma lista pedida pelo "Gerar" e grava o retrato: {situacao, linhas}.
    PRONTO quando gravou; FALHOU (já marcado no banco) quando não. O edital é lido
    na hora, para cada pedido: a tela confere o retrato com os dados que ela tem.
    """
    pedido_id = str(pedido.get("pedido") or "")
    rotulo = f"pedido {pedido_id[:8]}"

    def marcar(situacao: str, mensagem: str | None = None):
        chamar(
            config,
            "classificacao_marcar_calculo",
            {"p_execucao": execucao_id, "p_pedido": pedido_id, "p_situacao": situacao, "p_mensagem": mensagem},
        )

    try:
        marcar("CALCULANDO")
        dados = ler_edital(config, str(pedido.get("edital") or ""), chamar=chamar)
        numero = str((dados.get("edital") or {}).get("numero") or "edital")
        tipo = str(pedido.get("tipo") or "")
        rotulo = f"{numero} · {tipo} · pedido {pedido_id[:8]}"
        if (dados.get("regra") or {}).get("versao") != pedido.get("versao_regra"):
            raise CalculoRecusado(MENSAGEM_REGRA_MUDOU_NO_PEDIDO)
        resultado = classificar_edital(dados, tipo)
        chamar(
            config,
            "classificacao_gravar_calculo",
            {"p_execucao": execucao_id, "p_pedido": pedido_id, "p_retrato": retrato_do_edital(dados, resultado)},
        )
        t = resultado["totais"]
        return {
            "situacao": "PRONTO",
            "linhas": [
                f"{rotulo}: lista calculada — {t['elegiveis']} na lista, {t['eliminados']} eliminados, "
                f"{t['aguardando']} aguardando"
            ],
        }
    except CalculoRecusado as recusa:
        _marcar_sem_derrubar(marcar, "FALHOU", str(recusa))
        return {"situacao": "FALHOU", "linhas": [f"{rotulo}: não calculado — {recusa}"]}
    except Exception as erro:  # noqa: BLE001 — um pedido com problema não segura os outros
        motivo = motivo_seguro(erro)
        _marcar_sem_derrubar(marcar, "FALHOU", f"O cálculo falhou ({motivo}).")
        return {"situacao": "FALHOU", "linhas": [f"{rotulo}: falhou — {motivo}"]}


def rodar_calculos(config, execucao_id: str, chamar) -> list[dict]:
    """Os cálculos que esperam agora, um a um. Falha ao ler a fila vira um item FALHOU (o resto segue)."""
    try:
        pedidos = chamar(config, "classificacao_ler_pedidos_calculo", {})
        if not isinstance(pedidos, list):
            raise ValueError("classificacao_ler_pedidos_calculo não devolveu uma lista.")
    except Exception as erro:  # noqa: BLE001
        return [{"situacao": "FALHOU", "linhas": [f"Falhou ao ler os pedidos de cálculo: {motivo_seguro(erro)}"]}]
    return [calcular_pedido(config, pedido, execucao_id, chamar=chamar) for pedido in pedidos]


def _contagem(feitos: list[dict]) -> str:
    situacoes: dict = {}
    for feito in feitos:
        situacoes[feito["situacao"]] = situacoes.get(feito["situacao"], 0) + 1
    return ", ".join(
        f"{quantas} {situacao.lower().replace('_', ' ')}" for situacao, quantas in sorted(situacoes.items())
    )


# ── a fila: os cálculos primeiro, depois os relatórios ──────────────────


def rodar_fila(listas, ambiente, chamar) -> int:
    """
    Uma execução do workflow: os cálculos que esperam, os relatórios (os
    pendentes e os de `listas`) e, entre um relatório e outro, os cálculos que
    chegaram enquanto isso. 0 tudo pronto; 2 com falha ou lista não conferida;
    1 sem conseguir ler os relatórios pedidos.
    """
    execucao_id = execucao.identificador(prefixo="classificacao")
    try:
        config = supabase_rpc.configuracao(ambiente=ambiente)
    except Exception as erro:  # noqa: BLE001
        execucao.resumir(TITULO_DESEMPATE, [f"Falhou ao ler os pedidos: {motivo_seguro(erro)}"], ambiente=ambiente)
        return ERRO
    calculos = rodar_calculos(config, execucao_id, chamar)
    try:
        pedidos = chamar(config, "classificacao_ler_pedidos_desempate", {"p_listas": listas or None})
        if not isinstance(pedidos, list):
            raise ValueError("classificacao_ler_pedidos_desempate não devolveu uma lista.")
    except Exception as erro:  # noqa: BLE001
        linhas = [linha for feito in calculos for linha in feito["linhas"]]
        linhas.append(f"Falhou ao ler os pedidos de relatório: {motivo_seguro(erro)}")
        execucao.resumir(TITULO_DESEMPATE, linhas, ambiente=ambiente)
        return ERRO
    editais: dict = {}
    relatorios = []
    for pedido in pedidos:
        # Quem gerou uma lista espera na tela: o cálculo passa na frente do próximo relatório.
        calculos.extend(rodar_calculos(config, execucao_id, chamar))
        relatorios.append(preparar_lista(config, pedido, execucao_id, editais, chamar=chamar))
    if pedidos:
        calculos.extend(rodar_calculos(config, execucao_id, chamar))
    linhas = [linha for feito in calculos + relatorios for linha in feito["linhas"]]
    if calculos:
        linhas.append(f"{len(calculos)} cálculo(s): {_contagem(calculos)}.")
    if relatorios:
        linhas.append(f"{len(relatorios)} lista(s): {_contagem(relatorios)}.")
    if not calculos and not relatorios:
        linhas.append("Nenhuma lista esperando o cálculo nem o relatório de desempate.")
    linhas.append(f"Execução {execucao_id}.")
    execucao.resumir(TITULO_DESEMPATE, linhas, ambiente=ambiente)
    feitos = calculos + relatorios
    return SEM_DIVERGENCIA if all(f["situacao"] == "PRONTO" for f in feitos) else COM_DIVERGENCIA


def principal(argv=None, ambiente=None, ler=ler_edital, motor=motor_da_tela, chamar=supabase_rpc.chamar) -> int:
    argumentos = execucao.Argumentos(description=__doc__.split("\n\n")[0].strip())
    modo = argumentos.add_mutually_exclusive_group(required=True)
    modo.add_argument("--calculo", action="store_true", help="calcula as listas pedidas e prepara os relatórios")
    modo.add_argument("--desempate", action="store_true", help="grava o relatório de desempate das listas geradas")
    modo.add_argument("--seco", action="store_true", help="só lê, calcula e compara com o motor da tela")
    argumentos.add_argument("--lista", action="append", default=[], help="--desempate: id da lista (pode repetir)")
    argumentos.add_argument("--edital", action="append", default=[], help="--seco: id do edital (pode repetir)")
    argumentos.add_argument("--arquivo", action="append", default=[], help="--seco: json de classificacao_ler_edital")
    argumentos.add_argument("--tipos", default=",".join(TIPOS), help="--seco: listas, separadas por vírgula")
    argumentos.add_argument("--saida", help="--seco: pasta local para os relatórios e as divergências")
    a = argumentos.parse_args(argv)
    if a.calculo or a.desempate:
        if a.edital or a.arquivo or a.saida:
            argumentos.error("--calculo e --desempate leem os pedidos; --edital, --arquivo e --saida são do --seco")
        if a.calculo and a.lista:
            argumentos.error("--lista é do --desempate")
        listas = [x.strip() for valor in a.lista for x in valor.split(",") if x.strip()]
        if any(not _UUID.match(x) for x in listas):
            argumentos.error("--lista: use ids de lista (uuid), separados por vírgula ou repetindo a opção")
        return rodar_fila(listas, ambiente, chamar)
    if a.lista:
        argumentos.error("--lista é do --desempate")
    return rodar_seco(a, argumentos, ambiente, ler, motor)


if __name__ == "__main__":
    sys.exit(principal(ambiente=os.environ))
