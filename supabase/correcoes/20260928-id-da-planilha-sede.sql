-- Cadastra o ID da planilha da SEDE (copia da planilha de Projetos), criada em 28/09/2026.
-- Aplicado em producao em 28/09/2026.
update public."TB_PLANILHA_ANALISE"
   set "DS_PLANILHA_ID" = '1xFpp1h2vbXGTX3OUWAvkdX1Y-qwCqT_kj3cSF1S-VI4'
 where "CO_PLANILHA" = 'sede' and "DS_PLANILHA_ID" is null;
