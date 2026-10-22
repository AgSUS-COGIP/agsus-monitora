"""
monitora.chave_da_automacao: a pré-classificação chamada no fim do robô da
Empregare pergunta ao banco se a chave "Pré-classificação automática" está
ligada (migration 20261022190000) antes de rodar. Desligada só quando o banco diz false; na dúvida,
ligada, com aviso.
"""

import pathlib
import tempfile
import unittest

from monitora import chave_da_automacao as chave
from monitora.supabase_rpc import ErroDoSupabase

CONFIG = {"url": "https://exemplo.supabase.co", "chave": "x"}


def configuracao(ambiente=None):
    return CONFIG


class EstaLigadaTeste(unittest.TestCase):
    def setUp(self):
        self.linhas = []

    def perguntar(self, resposta=None, erro=None, nome="pre_classificacao"):
        chamadas = []

        def chamar(config, funcao, corpo):
            chamadas.append((funcao, corpo))
            if erro:
                raise erro
            return resposta

        ligada = chave.esta_ligada(
            nome, ambiente={}, chamar=chamar, configuracao=configuracao, imprimir=self.linhas.append
        )
        return ligada, chamadas

    def test_desligada_so_quando_o_banco_diz_false(self):
        ligada, chamadas = self.perguntar(resposta=False)
        self.assertFalse(ligada)
        self.assertEqual(chamadas, [("automacao_ligada", {"p_chave": "pre_classificacao"})])
        self.assertIn("desligada pelo administrador", self.linhas[-1])

    def test_ligada(self):
        self.assertTrue(self.perguntar(resposta=True)[0])

    def test_na_duvida_segue_ligada_com_aviso(self):
        ligada, _ = self.perguntar(erro=ErroDoSupabase("automacao_ligada", 404, "nao existe"))
        self.assertTrue(ligada)
        self.assertIn("20261022190000", self.linhas[-1])
        self.assertTrue(self.linhas[-1].startswith("::warning::"))
        ligada, _ = self.perguntar(erro=ErroDoSupabase("automacao_ligada", "sem resposta", "rede"))
        self.assertTrue(ligada)

    def test_chave_invalida_nem_pergunta(self):
        ligada, chamadas = self.perguntar(resposta=False, nome="x; drop")
        self.assertTrue(ligada)
        self.assertEqual(chamadas, [])


class SaidaDoPassoTeste(unittest.TestCase):
    def test_escreve_ligada_no_github_output(self):
        with tempfile.TemporaryDirectory() as pasta:
            saida = pathlib.Path(pasta) / "saida"
            original = chave.esta_ligada
            chave.esta_ligada = lambda nome, ambiente=None, imprimir=print: False
            try:
                codigo = chave.main(["pre_classificacao"], ambiente={"GITHUB_OUTPUT": str(saida)})
            finally:
                chave.esta_ligada = original
            self.assertEqual(codigo, 0)
            self.assertEqual(saida.read_text(encoding="utf-8"), "ligada=false\n")


if __name__ == "__main__":
    unittest.main()
