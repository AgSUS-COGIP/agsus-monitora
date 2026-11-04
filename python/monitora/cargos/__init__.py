"""
Tabela oficial de cargos (migration 20261104150000_tabela_de_cargos.sql).

    monitora.cargos.normalizacao   a grafia normalizada (cópia fiel de private."FC_NORMALIZAR_GRAFIA_CARGO")
    monitora.cargos.casamento      grafia → cargo oficial, com regra e confiança (alta, sugestão, sem)
    monitora.cargos.previa         agrupar, resumir, CSV da prévia e o SQL da correção dos apelidos
    monitora.cargos.sql            literais SQL sem caractere invisível
    cargos_si_sip.csv              a planilha "CARGOS SI - SIP" (91 cargos), a mesma da carga da migration

O script: scripts/cargos/previa_do_casamento.py. Casos compartilhados com o banco:
tests/fixtures/cargos/normalizacao.json. Só biblioteca padrão.
"""
