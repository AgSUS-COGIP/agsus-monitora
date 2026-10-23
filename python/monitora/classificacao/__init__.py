"""
Classificação em Python (etapa 1: em paralelo com a tela, para conferir).

    monitora.classificacao.motor        cópia fiel de src/lib/classificacao/motor.ts
                                        (classificar, classificar_edital, classificar_com_rastro)
    monitora.classificacao.desempate    o relatório de desempate (json estável + texto)
    monitora.classificacao.comparacao   Python × motor da tela, caminho a caminho
    monitora.classificacao.regra        normalizarRegra
    monitora.classificacao.vagas        montarVagas, nivelDaVaga
    monitora.classificacao.convocacao   a configuração de convocação do edital (derivarQuadro…)
    monitora.classificacao.catalogo     critérios, motivos, modalidades
    monitora.classificacao.numeros      números pt-BR, datas, hora da certidão
    monitora.classificacao.semantica_js o que o JS faz e o Python não (Intl, localeCompare, Math.round)

Casos dourados compartilhados com o vitest: tests/fixtures/classificacao/casos-do-motor.json
(scripts/classificacao/gerar-casos-do-motor.mjs). O job: scripts/classificacao/classificacao.py.
Só biblioteca padrão.
"""
