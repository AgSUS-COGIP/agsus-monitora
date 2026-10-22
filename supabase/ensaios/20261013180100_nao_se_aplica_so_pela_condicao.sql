/*
  ENSAIO da migration 20261013180100_nao_se_aplica_so_pela_condicao.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  sem as linhas begin/commit), e desfaça. Usa a regra vigente do 114/2026 na
  vaga 182567 (Motorista D) e chama a validação do lançamento direto.

  Espera:
    1. IDENTIDADE "Não se aplica" → recusa (o bloco vale para todos);
    2. REQUISITO_DO_CARGO "Não se aplica" → recusa;
    3. COTA_PP "Não se aplica" com modalidade AC → aceito (a condição não vale);
    4. COTA_PP "Não se aplica" com modalidade PP → recusa;
    5. o lançamento normal (Conforme em tudo) → aceito.
  Antes da migration, os cinco são aceitos.
*/
create temporary table t_regra on commit drop as
select private."FC_REGRA_DA_VAGA"(h."DS_CONFIGURACAO", '182567', 'CARGO 15: MOTORISTA - Categoria D (Nível Médio)', 'medio') as c
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
create temporary table t_caso (n int, caso text, lanc jsonb) on commit drop;
insert into t_caso values
  (1, 'IDENTIDADE não se aplica', '{"nivel":"medio","modalidade":"AC","blocos":{"IDENTIDADE":{"situacao":"NAO_SE_APLICA"}}}'),
  (2, 'REQUISITO_DO_CARGO não se aplica', '{"nivel":"medio","modalidade":"AC","blocos":{"REQUISITO_DO_CARGO":{"situacao":"NAO_SE_APLICA"}}}'),
  (3, 'COTA_PP não se aplica (AC)', '{"nivel":"medio","modalidade":"AC","blocos":{"COTA_PP":{"situacao":"NAO_SE_APLICA"}}}'),
  (4, 'COTA_PP não se aplica (PP)', '{"nivel":"medio","modalidade":"PP","blocos":{"COTA_PP":{"situacao":"NAO_SE_APLICA"}}}'),
  (5, 'tudo Conforme', '{"nivel":"medio","modalidade":"AC","blocos":{"IDENTIDADE":{"situacao":"CONFORME"},"REQUISITO_DO_CARGO":{"situacao":"CONFORME","requisitos":{"CNH_D":true,"DIRECAO_DEFENSIVA":true}}}}');
create temporary table t_saida (n int, caso text, saida text) on commit drop;
do $$
declare v record;
begin
  for v in select * from t_caso order by n loop
    begin
      perform private."FC_VALIDAR_LANCAMENTO_FICHA"((select c from t_regra), v.lanc);
      insert into t_saida values (v.n, v.caso, 'aceito');
    exception when sqlstate '22023' then
      insert into t_saida values (v.n, v.caso, 'recusado: ' || sqlerrm);
    end;
  end loop;
end $$;
select n, caso, saida from t_saida order by n;
