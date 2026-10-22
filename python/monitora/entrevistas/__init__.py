"""
Entrevistas em Python.

    monitora.entrevistas.calculo  nota por competência, total e parecer da entrevista
                                  (a regra de private."FC_CALCULAR_ENTREVISTA")

É a conta para o recálculo e a conferência EM LOTE (job). A tela tem a prévia em
JavaScript (calcularEntrevista, src/lib/conducao-de-entrevista.js) e o banco grava
o resultado oficial ao lançar as notas. Os casos dourados de
tests/fixtures/entrevistas/casos-de-calculo.json rodam nos dois lados (vitest e
pytest). Mudou aqui, muda lá.
"""
