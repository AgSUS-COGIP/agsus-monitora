"""
Testes do job da pré-classificação (scripts/pre_classificacao/): o fluxo de
uma execução com o banco falso (função `chamar` injetada) e dados fictícios —
edital sem regra conferida, prévia no modo seco, gravação por vaga, falha de
um edital, execução em andamento e nada de dado pessoal no resumo. Nada fala
com o Supabase.

    python -m pytest tests/python
"""

import io
import json
import pathlib
import sys
import unittest
from contextlib import redirect_stdout

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "scripts" / "pre_classificacao"))
sys.path.insert(0, str(_RAIZ / "python"))

import pre_classificacao as job  # noqa: E402

from monitora import supabase_rpc  # noqa: E402

E93 = "00000000-0000-4000-a000-000000000093"
EFCC = "00000000-0000-4000-a000-0000000000fc"
USUARIO = "00000000-0000-4000-a000-0000000000aa"
REGRA = {
    "schema": 1,
    "provisoria": {
        "eliminacao_automatica": [
            {"codigo": "CANCELADO", "coluna": "SITUAÇÃO", "quando": ["CANCELADO"], "motivo": "Cancelou a inscrição"}
        ],
        "nota_declarada": [],
        "divergencia_tolerancia": 0,
    },
    "lote": {"base": "MULTIPLO_VAGAS", "multiplo": 1, "inclui_cr": True, "inclui_empatados": False},
    "blocos": [],
}


def candidato(i, art, situacao="Ativo"):
    return {
        "id": f"00000000-0000-4000-a000-0000000c00{i:02d}",
        "codigo": f"70000{i:02d}",
        "ativo": True,
        "nascimento": "1990-01-01",
        "candidatura": f"2026-09-{10 + i:02d}T12:00:00+00:00",
        "colunas": {"SITUAÇÃO": situacao, "NOTA - Questionário": art},
    }


class BancoFalso:
    def __init__(self, editais, candidatos=None, falhar_vaga=None, em_andamento=False):
        self.editais = editais
        self.candidatos = candidatos or {}
        self.falhar_vaga = falhar_vaga
        self.em_andamento = em_andamento
        self.chamadas = []

    def __call__(self, _cfg, funcao, corpo):
        self.chamadas.append((funcao, json.loads(json.dumps(corpo))))
        if funcao == "pre_classificacao_ler_editais":
            return {"hoje": "2026-10-06", "nao_encontrados": ["99/2099"], "editais": self.editais}
        if funcao == "pre_classificacao_ler_candidatos":
            return {"candidatos": self.candidatos.get(corpo["p_vaga"], []), "anterior": {}}
        if funcao == "iniciar_pre_classificacao":
            if self.em_andamento:
                raise supabase_rpc.ErroDoSupabase(funcao, 400, '{"code":"55P03","message":"Já há uma em andamento"}')
            return {"execucao": corpo["p_execucao"]}
        if funcao == "gravar_pre_classificacao_vaga":
            if corpo["p_vaga"] == self.falhar_vaga:
                raise supabase_rpc.ErroDoSupabase(funcao, 400, '{"code":"22023","message":"posição inválida"}')
            return {"inscritos": len(corpo["p_linhas"]), "mudancas": 0}
        if funcao == "finalizar_pre_classificacao":
            falhou = any(e["situacao"] == "FALHOU" for e in corpo["p_editais"]) or corpo["p_erro"]
            return {"situacao": "PARCIAL" if falhou else "CONCLUIDA", "vagas": 1, "lote": 2}
        raise AssertionError(funcao)

    def de(self, funcao):
        return [c for f, c in self.chamadas if f == funcao]


def edital_93(situacao="CONFERIDA", vagas=None):
    return {
        "id": E93,
        "rotulo": "93/2026",
        "regra": {"versao": 3, "situacao": situacao, "configuracao": REGRA},
        "refazer_permitido": True,
        "vagas": vagas
        if vagas is not None
        else [
            {
                "codigo": "179698",
                "candidatos_ativos": 3,
                "ultimo_lote": 0,
                "quadro": {"vagas_imediatas": 1, "cadastro_reserva": True, "modalidades": {"Ampla Concorrência": 1}},
            }
        ],
    }


def rodar(banco, lista):
    saida = io.StringIO()
    with redirect_stdout(saida):
        codigo = job.principal(job.argumentos(lista), configuracao={"url": "https://x", "chave": "k"}, chamar_rpc=banco)
    return codigo, saida.getvalue()


CANDIDATOS = {"179698": [candidato(1, "24,0/30,0"), candidato(2, "22,0/30,0"), candidato(3, "28,0/30,0", "Cancelado")]}


class Fluxo(unittest.TestCase):
    def test_edital_sem_regra_explica_e_nao_quebra_no_modo_seco(self):
        sem_regra = {**edital_93(), "regra": None}
        banco = BancoFalso([sem_regra], CANDIDATOS)
        codigo, saida = rodar(banco, ["--seco", "--editais", "93/2026"])
        self.assertEqual(codigo, 0)
        self.assertIn("93/2026: edital sem regra conferida", saida)
        self.assertIn("3 inscritos em 1 vaga(s) aguardam", saida)
        self.assertIn("Editais não encontrados: 99/2099", saida)
        self.assertEqual(banco.de("pre_classificacao_ler_candidatos"), [])
        self.assertEqual(banco.de("iniciar_pre_classificacao"), [])

    def test_regra_nao_conferida_vira_previa_no_seco_e_nao_grava_no_normal(self):
        banco = BancoFalso([edital_93("CONFERIR")], CANDIDATOS)
        codigo, saida = rodar(banco, ["--seco"])
        self.assertEqual(codigo, 0)
        self.assertIn("prévia calculada", saida)
        self.assertIn("2 no lote", saida)
        banco = BancoFalso([edital_93("CONFERIR")], CANDIDATOS)
        codigo, saida = rodar(banco, [])
        self.assertEqual(codigo, 0)
        self.assertEqual(banco.de("gravar_pre_classificacao_vaga"), [])
        self.assertEqual(banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]["situacao"], "REGRA_NAO_CONFERIDA")
        self.assertIn("falta a coordenação marcar como conferida", saida)

    def test_grava_cada_vaga_com_a_versao_da_regra_e_fecha_a_execucao(self):
        banco = BancoFalso([edital_93()], CANDIDATOS)
        codigo, saida = rodar(banco, ["--editais", "93/2026", "--disparado-por", USUARIO])
        self.assertEqual(codigo, 0)
        inicio = banco.de("iniciar_pre_classificacao")[0]
        self.assertEqual(
            (inicio["p_disparo"], inicio["p_usuario"], inicio["p_pedido"]), ("MONITORA", USUARIO, ["93/2026"])
        )
        gravacao = banco.de("gravar_pre_classificacao_vaga")[0]
        self.assertEqual((gravacao["p_vaga"], gravacao["p_versao_regra"]), ("179698", 3))
        situacoes = {l["id"][-2:]: (l["situacao"], l["posicao"], l["lote"]) for l in gravacao["p_linhas"]}
        self.assertEqual(situacoes, {"01": ("NO_LOTE", 1, 1), "02": ("NO_LOTE", 2, 1), "03": ("ELIMINADO", None, None)})
        self.assertEqual(gravacao["p_resumo"]["tamanho"], 2)
        self.assertEqual(set(gravacao["p_linhas"][0]), set(job.CAMPOS_DA_LINHA))
        fim = banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]
        self.assertEqual((fim["situacao"], fim["inscritos"], fim["no_lote"]), ("PROCESSADO", 3, 2))
        self.assertNotIn("avisos_por_vaga", fim)
        self.assertIn("1 eliminados", saida)

    def test_edital_que_falha_nao_derruba_os_outros(self):
        fcc = {**edital_93(), "id": EFCC, "rotulo": "FCC", "vagas": [{**edital_93()["vagas"][0], "codigo": "111111"}]}
        banco = BancoFalso(
            [edital_93(), fcc], {**CANDIDATOS, "111111": [candidato(4, "10,0/30,0")]}, falhar_vaga="111111"
        )
        codigo, saida = rodar(banco, [])
        self.assertEqual(codigo, 2)
        editais = {e["rotulo"]: e for e in banco.de("finalizar_pre_classificacao")[0]["p_editais"]}
        self.assertEqual(editais["93/2026"]["situacao"], "PROCESSADO")
        self.assertEqual(editais["FCC"]["situacao"], "FALHOU")
        self.assertIn("FCC: FALHOU", saida)

    def test_execucao_em_andamento_para_com_aviso(self):
        banco = BancoFalso([edital_93()], CANDIDATOS, em_andamento=True)
        codigo, saida = rodar(banco, [])
        self.assertEqual(codigo, 1)
        self.assertIn("em andamento", saida)
        self.assertEqual(banco.de("gravar_pre_classificacao_vaga"), [])

    def test_disparo_e_modo_pelo_ambiente(self):
        self.assertEqual(job.tipo_do_disparo("robo"), ("ROBO", None))
        self.assertEqual(job.tipo_do_disparo(""), ("GITHUB", None))
        self.assertEqual(job.tipo_do_disparo(USUARIO), ("MONITORA", USUARIO))
        with self.assertRaises(SystemExit):
            job.argumentos(["--editais", "93/2026', x='1"])

    def test_refazer_recusado_quando_ja_ha_ficha(self):
        edital = {**edital_93(), "refazer_permitido": False}
        banco = BancoFalso([edital], CANDIDATOS)
        rodar(banco, ["--refazer-lote"])
        fim = banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]
        self.assertIn("REFAZER_RECUSADO", fim["avisos"])
        self.assertTrue(banco.de("iniciar_pre_classificacao")[0]["p_refazer"])

    def test_o_resumo_nao_tem_dado_pessoal(self):
        banco = BancoFalso([edital_93()], CANDIDATOS)
        _codigo, saida = rodar(banco, [])
        self.assertNotRegex(saida, r"@|\d{11}")
        self.assertNotIn("Cancelou", saida)


if __name__ == "__main__":
    unittest.main()
