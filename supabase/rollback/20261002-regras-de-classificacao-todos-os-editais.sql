/*
  Desfaz supabase/correcoes/20261002-regras-de-classificacao-todos-os-editais.sql: apaga SÓ as regras de classificação
  criadas por aquele seed (versão 1, motivo "Regra lida do edital (PDF oficial) — conferir", sem versão 2) e que
  ainda não têm lista gerada nem desempate registrado. Regra que o gestor já
  editou (versão 2+) ou já usou para gerar lista fica — o histórico não se apaga.
*/
begin;

do $$
declare
  v_n integer;
begin
  create temp table rollback_regras on commit drop as
    select r."CO_REGRA_CLASSIFICACAO" as regra, r."CO_MONITORAMENTO" as edital
      from public."TB_REGRA_CLASSIFICACAO" r
      join public."TH_REGRA_CLASSIFICACAO" h
        on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = 1
     where r."NU_VERSAO_VIGENTE" = 1
       and h."DS_MOTIVO" = 'Regra lida do edital (PDF oficial) — conferir'
       and not exists (select 1 from public."TH_REGRA_CLASSIFICACAO" h2
                        where h2."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h2."NU_VERSAO" > 1)
       and not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l
                        where l."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO")
       and not exists (select 1 from public."TB_DESEMPATE_CLASSIFICACAO" d
                        where d."CO_MONITORAMENTO" = r."CO_MONITORAMENTO");
  delete from public."RL_REGRA_CRITERIO_DESEMPATE" d using rollback_regras x where d."CO_REGRA_CLASSIFICACAO" = x.regra;
  delete from public."TH_REGRA_CLASSIFICACAO" h using rollback_regras x where h."CO_REGRA_CLASSIFICACAO" = x.regra;
  delete from public."TB_REGRA_CLASSIFICACAO" r using rollback_regras x where r."CO_REGRA_CLASSIFICACAO" = x.regra;
  get diagnostics v_n = row_count;
  raise notice 'Regras do seed apagadas: %.', v_n;
end;
$$;

commit;
