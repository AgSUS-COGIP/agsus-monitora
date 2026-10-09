"""
Testes do retrato das inscrições (python/monitora/avaliacao_documental/
retrato_das_inscricoes.py) e da gravação pelo job da pré-classificação
(scripts/pre_classificacao/): só contagens por vaga, durante as inscrições do
cronograma, também com a regra a conferir (prévia) e sem regra. Dados
fictícios; nada fala com o Supabase.

    python -m pytest tests/python
"""

import json
import pathlib
import sys
import unittest

_RAIZ = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_RAIZ / "tests" / "python"))
sys.path.insert(0, str(_RAIZ / "scripts" / "pre_classificacao"))
sys.path.insert(0, str(_RAIZ / "python"))

import test_pre_classificacao_job as base  # noqa: E402

from monitora.avaliacao_documental.pre_classificacao import (  # noqa: E402
    fim_das_inscricoes,
    janela_das_inscricoes,
    normalizar_regra,
    pre_classificar_vaga,
)
from monitora.avaliacao_documental.retrato_das_inscricoes import (  # noqa: E402
    aptos_pela_regra,
    finalizou_o_questionario,
    retrata_hoje,
    retrato_da_vaga,
)

# O cronograma do 114/2026 (Projetos): a "Validação das inscrições" vem depois do fim.
CRONOGRAMA_114 = [
    {"atividade": "Publicação do Edital", "inicio": "2026-09-30", "fim": "2026-09-30"},
    {"atividade": "Período de Inscrições", "inicio": "2026-10-05", "fim": "2026-10-14"},
    {
        "atividade": "Validação das inscrições, por meio da verificação da documentação obrigatória",
        "inicio": "2026-10-15",
        "fim": "2026-10-22",
    },
]
QUESTIONARIO = "SITUAÇÃO - NÍVEL SUPERIOR ANALISTA - Nº 114/2026"
REGRA_NOTA_MINIMA = {
    **base.REGRA,
    "lote": {"base": "NOTA_MINIMA", "nota_minima": 20, "inclui_cr": True, "linha_anda": False},
}


def candidato(i, art, situacao="Ativo", questionario="FINALIZADO", ativo=True):
    c = base.candidato(i, art, situacao)
    c["ativo"] = ativo
    if questionario is not None:
        c["colunas"][QUESTIONARIO] = questionario
    return c


CANDIDATOS = [
    candidato(1, "24,0/30,0"),
    candidato(2, "18,0/30,0", questionario="EM ANDAMENTO"),
    candidato(3, "28,0/30,0", "Cancelado"),
    candidato(4, "29,0/30,0", ativo=False),
]


class Janela(unittest.TestCase):
    def test_a_validacao_das_inscricoes_nao_conta_como_inscricao(self):
        self.assertEqual(janela_das_inscricoes(CRONOGRAMA_114), ("2026-10-05", "2026-10-14"))
        self.assertEqual(fim_das_inscricoes(CRONOGRAMA_114), "2026-10-14")

    def test_retrata_da_vespera_do_inicio_ate_tres_dias_depois_do_fim(self):
        self.assertFalse(retrata_hoje("2026-10-03", CRONOGRAMA_114))
        self.assertTrue(retrata_hoje("2026-10-04", CRONOGRAMA_114))
        self.assertTrue(retrata_hoje("2026-10-14", CRONOGRAMA_114))
        self.assertTrue(retrata_hoje("2026-10-17", CRONOGRAMA_114))
        self.assertFalse(retrata_hoje("2026-10-18", CRONOGRAMA_114))
        self.assertFalse(retrata_hoje("2026-10-09", []))
        self.assertFalse(retrata_hoje(None, CRONOGRAMA_114))


class Retrato(unittest.TestCase):
    def test_finalizou_o_questionario_pelas_colunas_de_situacao(self):
        self.assertTrue(finalizou_o_questionario({QUESTIONARIO: "Finalizado", "SITUAÇÃO": "Ativo"}))
        self.assertFalse(finalizou_o_questionario({QUESTIONARIO: "PENDENTE"}))
        self.assertFalse(finalizou_o_questionario({QUESTIONARIO: "FINALIZADO", "SITUAÇÃO - OUTRO": "--"}))
        self.assertIsNone(finalizou_o_questionario({"SITUAÇÃO": "Ativo"}))

    def test_sem_regra_so_inscritos_e_finalizados(self):
        r = retrato_da_vaga("181100", CANDIDATOS)
        self.assertEqual(
            r,
            {"vaga": "181100", "inscritos": 3, "finalizados": 2, "aptos": None, "eliminados": None, "previa": False},
        )
        sem_coluna = [candidato(1, "1,0/30,0", questionario=None)]
        self.assertIsNone(retrato_da_vaga("1", sem_coluna)["finalizados"])

    def test_com_a_regra_aptos_pela_nota_minima_e_eliminados_sem_quem_saiu(self):
        regra = normalizar_regra(REGRA_NOTA_MINIMA)
        vaga = {"codigo": "181100", "vagas_imediatas": 0, "cadastro_reserva": True, "modalidades": None, "nivel": None}
        r = pre_classificar_vaga(regra, vaga, CANDIDATOS, hoje="2026-10-09")
        self.assertEqual(aptos_pela_regra(regra, r), 1)
        retrato = retrato_da_vaga("181100", CANDIDATOS, regra, r, previa=True)
        self.assertEqual((retrato["aptos"], retrato["eliminados"], retrato["previa"]), (1, 1, True))

    def test_nas_outras_bases_aptos_e_o_lote_mais_os_acima_do_corte(self):
        resultado = {"resumo": {"no_lote": 4, "acima_do_corte": 2}, "linhas": []}
        self.assertEqual(aptos_pela_regra(base.REGRA, resultado), 6)


def edital_114(situacao="CONFERIR", regra=REGRA_NOTA_MINIMA):
    e = base.edital_93(situacao, vagas=[{"codigo": "181100", "candidatos_ativos": 3, "ultimo_lote": 0, "quadro": None}])
    e.update({"id": "00000000-0000-4000-a000-000000000114", "rotulo": "114/2026", "cronograma": CRONOGRAMA_114})
    e["regra"] = None if situacao is None else {"versao": 1, "situacao": situacao, "configuracao": regra}
    return e


class BancoComRetrato(base.BancoFalso):
    def __init__(self, *args, hoje="2026-10-09", recusar_retrato=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.hoje = hoje
        self.recusar_retrato = recusar_retrato

    def __call__(self, cfg, funcao, corpo):
        if funcao == "pre_classificacao_ler_editais":
            self.chamadas.append((funcao, json.loads(json.dumps(corpo))))
            return {"hoje": self.hoje, "nao_encontrados": [], "editais": self.editais}
        if funcao == "gravar_retrato_inscricoes":
            self.chamadas.append((funcao, json.loads(json.dumps(corpo))))
            if self.recusar_retrato:
                raise base.supabase_rpc.ErroDoSupabase(funcao, 404, '{"code":"PGRST202","message":"não existe"}')
            return {"vagas": len(corpo["p_vagas"])}
        return super().__call__(cfg, funcao, corpo)


class Job(unittest.TestCase):
    def test_regra_a_conferir_grava_so_o_retrato_com_os_aptos_da_previa(self):
        banco = BancoComRetrato([edital_114("CONFERIR")], {"181100": CANDIDATOS})
        codigo, saida = base.rodar(banco, [])
        self.assertEqual(codigo, 0)
        self.assertEqual(banco.de("gravar_pre_classificacao_vaga"), [])
        retrato = banco.de("gravar_retrato_inscricoes")[0]
        self.assertEqual(retrato["p_edital"], "00000000-0000-4000-a000-000000000114")
        self.assertTrue(retrato["p_execucao"].startswith("precl"))
        self.assertEqual(
            retrato["p_vagas"],
            [{"vaga": "181100", "inscritos": 3, "finalizados": 2, "aptos": 1, "eliminados": 1, "previa": True}],
        )
        fim = banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]
        self.assertEqual((fim["situacao"], fim["inscritos"], fim["retratadas"]), ("REGRA_NAO_CONFERIDA", 3, 1))
        self.assertNotIn("retrato", fim)
        self.assertIn("Retrato das inscrições: 1 vaga(s).", saida)

    def test_regra_conferida_grava_a_classificacao_e_o_retrato(self):
        banco = BancoComRetrato([edital_114("CONFERIDA")], {"181100": CANDIDATOS})
        codigo, saida = base.rodar(banco, [])
        self.assertEqual(codigo, 0)
        self.assertEqual(len(banco.de("gravar_pre_classificacao_vaga")), 1)
        vaga = banco.de("gravar_retrato_inscricoes")[0]["p_vagas"][0]
        self.assertEqual((vaga["aptos"], vaga["previa"]), (1, False))
        self.assertIn("retrato das inscrições: 1 vaga(s)", saida)

    def test_sem_regra_retrata_inscritos_e_finalizados(self):
        banco = BancoComRetrato([edital_114(None)], {"181100": CANDIDATOS})
        base.rodar(banco, [])
        vaga = banco.de("gravar_retrato_inscricoes")[0]["p_vagas"][0]
        self.assertEqual((vaga["inscritos"], vaga["finalizados"], vaga["aptos"]), (3, 2, None))

    def test_fora_das_inscricoes_e_no_modo_seco_nao_ha_retrato(self):
        banco = BancoComRetrato([edital_114("CONFERIDA")], {"181100": CANDIDATOS}, hoje="2026-10-20")
        base.rodar(banco, [])
        self.assertEqual(banco.de("gravar_retrato_inscricoes"), [])
        banco = BancoComRetrato([edital_114("CONFERIDA")], {"181100": CANDIDATOS})
        base.rodar(banco, ["--seco"])
        self.assertEqual(banco.de("gravar_retrato_inscricoes"), [])

    def test_banco_sem_a_migration_so_avisa(self):
        banco = BancoComRetrato([edital_114("CONFERIDA")], {"181100": CANDIDATOS}, recusar_retrato=True)
        codigo, _saida = base.rodar(banco, [])
        self.assertEqual(codigo, 0)
        fim = banco.de("finalizar_pre_classificacao")[0]["p_editais"][0]
        self.assertEqual((fim["situacao"], fim["retratadas"]), ("PROCESSADO", 0))

    def test_o_retrato_nao_tem_dado_pessoal(self):
        banco = BancoComRetrato([edital_114("CONFERIR")], {"181100": CANDIDATOS})
        base.rodar(banco, [])
        retrato = json.dumps(banco.de("gravar_retrato_inscricoes"))
        for c in CANDIDATOS:
            self.assertNotIn(c["id"], retrato)
            self.assertNotIn(c["codigo"], retrato)
        self.assertEqual(
            set(banco.de("gravar_retrato_inscricoes")[0]["p_vagas"][0]),
            {"vaga", "inscritos", "finalizados", "aptos", "eliminados", "previa"},
        )


if __name__ == "__main__":
    unittest.main()
