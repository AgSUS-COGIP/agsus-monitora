"""
Sugestões da ficha (python/monitora/avaliacao_documental/sugestoes_da_ficha.py):
as linhas de curso, vínculo e título que as respostas do candidato já dão,
para a ficha vir pronta para conferir. Opção de pontuação e "Anexo" não
viram linha. Nada fala com o Supabase.
"""

import unittest

from monitora.avaliacao_documental import sugestoes_da_ficha as s


class Cursos(unittest.TestCase):
    def test_varios_cursos_com_horas_na_mesma_resposta(self):
        self.assertEqual(
            s.cursos_das_respostas(['"NR-10 Segurança em eletricidade - 120h; NR-35 Trabalho em altura 40 horas"']),
            [
                {"nome": "NR-10 Segurança em eletricidade", "horas": 120, "aceito": True, "da_resposta": True},
                {"nome": "NR-35 Trabalho em altura", "horas": 40, "aceito": True, "da_resposta": True},
            ],
        )

    def test_nome_com_acento_no_fim_nao_e_cortado(self):
        self.assertEqual(s.cursos_das_respostas(["Gestão em saúde 60h"])[0]["nome"], "Gestão em saúde")

    def test_opcao_de_pontuacao_faixa_e_anexo_nao_viram_curso(self):
        self.assertEqual(
            s.cursos_das_respostas(['"5 pontos"', "Anexo", '"De 40 a 79 horas"', '"Mais de 120h"', "--", "Sim"]),
            [],
        )

    def test_horas_fora_do_limite_ficam_de_fora(self):
        self.assertEqual(s.cursos_das_respostas(["Curso 0h", "Curso 99999 horas"]), [])


class Vinculos(unittest.TestCase):
    def test_datas_completas_e_mes_ano(self):
        self.assertEqual(
            s.vinculos_das_respostas(
                ["Hospital Fictício, de 01/02/2020 a 31/01/2022", "UBS Exemplo 03/2018 a 12/2019", '"2 anos"'],
                "AREA_OU_SUS",
            ),
            [
                {
                    "empregador": "Hospital Fictício",
                    "inicio": "2020-02-01",
                    "fim": "2022-01-31",
                    "aceito": True,
                    "categoria": "AREA_OU_SUS",
                    "da_resposta": True,
                },
                {
                    "empregador": "UBS Exemplo",
                    "inicio": "2018-03-01",
                    "fim": "2019-12-31",
                    "aceito": True,
                    "categoria": "AREA_OU_SUS",
                    "da_resposta": True,
                },
            ],
        )

    def test_fim_antes_do_inicio_ou_data_impossivel(self):
        self.assertEqual(s.vinculos_das_respostas(["01/02/2022 a 01/01/2020", "31/02/2020 a 01/03/2020"]), [])

    def test_uma_data_so_nao_e_periodo(self):
        self.assertEqual(s.vinculos_das_respostas(["Desde 01/02/2020 até hoje"]), [])


class Titulos(unittest.TestCase):
    def test_o_titulo_mais_alto_que_aparece(self):
        self.assertEqual(s.titulo_das_respostas(['"Mestrado"']), "MESTRADO")
        self.assertEqual(s.titulo_das_respostas(['"Especialização"']), "ESPECIALIZACAO")
        self.assertIsNone(s.titulo_das_respostas(['"5 pontos"']))

    def test_so_os_titulos_do_nivel(self):
        self.assertIsNone(s.titulo_das_respostas(['"Mestrado"'], {"ESPECIALIZACAO"}))


REGRA = {
    "blocos": [
        {"codigo": "IDENTIDADE", "tipo": "DOCUMENTO", "perguntas": ["Anexe o documento"]},
        {"codigo": "FORMACAO", "tipo": "TITULOS", "perguntas": ["Qual seu Nível de Titulação"]},
        {"codigo": "CURSOS", "tipo": "CURSOS", "perguntas": ["Selecione a pontuação", "Informe os cursos"]},
        {
            "codigo": "EXPERIENCIA",
            "tipo": "VINCULOS",
            "perguntas": ["Informe os vínculos"],
            "categorias": [{"codigo": "AREA_OU_SUS"}],
        },
    ]
}
COLUNAS = {
    "Pergunta 4 - Anexe o documento de identificação": "Anexo",
    "Pergunta 13 - Qual seu Nível de Titulação Acadêmica?": '"Mestrado"',
    "Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos": '"5 pontos"',
    "Pergunta 15 - Informe os cursos (nome e carga horária)": '"NR-10 120h"',
    "Pergunta 17 - Informe os vínculos (empregador e período)": '"Hospital Fictício 01/2020 a 12/2021"',
}


class DoCandidatoEDaVaga(unittest.TestCase):
    def test_um_candidato_por_bloco(self):
        self.assertEqual(
            s.sugestoes_do_candidato(REGRA, COLUNAS),
            {
                "FORMACAO": [{"titulo": "MESTRADO", "nome": "", "aceito": True, "da_resposta": True}],
                "CURSOS": [{"nome": "NR-10", "horas": 120, "aceito": True, "da_resposta": True}],
                "EXPERIENCIA": [
                    {
                        "empregador": "Hospital Fictício",
                        "inicio": "2020-01-01",
                        "fim": "2021-12-31",
                        "aceito": True,
                        "categoria": "AREA_OU_SUS",
                        "da_resposta": True,
                    }
                ],
            },
        )

    def test_a_vaga_so_com_quem_tem_algo_e_esta_ativo(self):
        candidatos = [
            {"id": "a", "ativo": True, "colunas": COLUNAS},
            {"id": "b", "ativo": True, "colunas": {"Pergunta 14 - Selecione a pontuação": '"5 pontos"'}},
            {"id": "c", "ativo": False, "colunas": COLUNAS},
        ]
        vaga = s.sugestoes_da_vaga(REGRA, candidatos)
        self.assertEqual([c["id"] for c in vaga], ["a"])
        self.assertEqual(sorted(vaga[0]["blocos"]), ["CURSOS", "EXPERIENCIA", "FORMACAO"])


if __name__ == "__main__":
    unittest.main()
