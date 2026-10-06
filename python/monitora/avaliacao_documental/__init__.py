"""
Avaliação documental em Python (docs/analises-no-monitora/, fase F2).

    monitora.avaliacao_documental.nota_declarada     a ART lida da Empregare e a nota
                                                     declarada recalculada pela regra
    monitora.avaliacao_documental.pre_classificacao  Provisória por ART, eliminação
                                                     automática e lote de convocação
    monitora.avaliacao_documental.pontuacao          a conta da ficha (fase F4), para
                                                     conferir em lote o que a tela gravou

É a conta OFICIAL em lote (o job scripts/pre_classificacao/ grava o resultado
pronto). A mesma conta existe em src/lib/avaliacao-documental/ para a prévia da
tela; os casos dourados de tests/fixtures/avaliacao-documental/ rodam nos dois
lados (vitest e pytest). Mudou aqui, muda lá.
"""
