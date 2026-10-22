"""
Pergunta ao MONITORA se uma chave da automação está ligada.

Configurações › Automação (migration 20261022190000_chaves_da_automacao.sql)
liga e desliga o que roda sozinho em cada aba. A agenda dos robôs já respeita
as chaves no banco (FC_DISPARAR_ROBO); o que roda dentro de um workflow, sem
passar pelo banco — a pré-classificação chamada no fim do robô da Empregare
(pre-classificacao.yml com apos_robo) — pergunta aqui antes, pela RPC automacao_ligada (service_role).

Escreve `ligada=true` ou `ligada=false` em $GITHUB_OUTPUT (o passo seguinte
usa `steps.<id>.outputs.ligada`) e sai sempre com 0. Na dúvida (banco fora,
migration ainda não aplicada), vale "ligada", como antes das chaves, com um
aviso (::warning::) no log.

    PYTHONPATH=python python -m monitora.chave_da_automacao pre_classificacao

Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e GITHUB_OUTPUT.
"""

import os
import re
import sys

from monitora import supabase_rpc
from monitora.mascaramento import mascarar, resumo_do_erro

RPC = "automacao_ligada"
_CHAVE = re.compile(r"^[a-z_]{3,40}$")


def esta_ligada(chave, ambiente=None, chamar=None, configuracao=None, imprimir=print):
    """True quando a chave está ligada (ou na dúvida); False só quando o banco diz que está desligada."""
    a = os.environ if ambiente is None else ambiente
    if not _CHAVE.fullmatch(str(chave or "")):
        imprimir(f"::warning::Chave da automação inválida ({mascarar(str(chave))[:40]}); segue ligada.")
        return True
    try:
        config = (configuracao or supabase_rpc.configuracao)(ambiente=a)
        resposta = (chamar or supabase_rpc.chamar)(config, RPC, {"p_chave": chave})
    except Exception as erro:  # noqa: BLE001 — a pergunta nunca derruba o workflow
        status = getattr(erro, "status", None)
        motivo = (
            "o banco ainda não tem automacao_ligada (migration 20261022190000)"
            if status == 404
            else mascarar(resumo_do_erro(erro))[:200]
        )
        imprimir(f"::warning::Não deu para conferir a chave {chave} ({motivo}); segue ligada.")
        return True
    if resposta is False:
        imprimir(f"Automação {chave} desligada pelo administrador (Configurações › Automação): passo pulado.")
        return False
    return True


def main(argv=None, ambiente=None, imprimir=print):
    argv = sys.argv[1:] if argv is None else argv
    a = os.environ if ambiente is None else ambiente
    ligada = esta_ligada(argv[0] if argv else "", ambiente=a, imprimir=imprimir)
    saida = a.get("GITHUB_OUTPUT")
    if saida:
        with open(saida, "a", encoding="utf-8") as arquivo:
            arquivo.write(f"ligada={'true' if ligada else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
