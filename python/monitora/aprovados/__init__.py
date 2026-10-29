"""
Lista de aprovados em Python.

    monitora.aprovados.contratacao   qual linha é a contratação quando a mesma matrícula está
                                     Contratado em duas ou mais linhas do mesmo edital
                                     ("Contratado em outra lista", regra versão 1)
    monitora.aprovados.pendencias    as pendências do edital que o gestor decide na tela
                                     (duas matrículas, duas listas, pessoa e posição repetidas,
                                     Convocado sem desfecho)
    monitora.aprovados.casamento     quem da lista vigente é a mesma pessoa de quem entra numa nova
                                     versão da lista (XLSX ou Classificação), regra versão 1

Os jobs: scripts/aprovados/contratacao.py, scripts/aprovados/pendencias.py e
scripts/aprovados/casamento_da_lista.py. Só biblioteca padrão.
"""
