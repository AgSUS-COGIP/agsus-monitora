/*
  ENSAIO da migration 20261014191000_item_recusado_e_bloco_que_nao_se_aplica.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  sem as linhas begin/commit), e desfaça.

  Espera (depois da migration; antes dela, 1 = sim, 2 = aceita, 3 = aceita):
    1. pendências do 114/2026 (vaga 182528) com um vínculo RECUSADO sem fim:
       sem "vínculo com data inválida" → 'nao';
    1b. o mesmo vínculo ACEITO sem fim continua pedindo a data → 'sim';
    2. étnico de quem não é indígena com a parcial 7 (o ajuste que ficou) → recusa;
    3. o mesmo com a parcial 0 → aceita.
*/
create temporary table t_saida (n text, saida text) on commit drop;
create temporary table t_regra on commit drop as
select private."FC_REGRA_DA_VAGA"(h."DS_CONFIGURACAO", '182528', 'CARGO 15: MOTORISTA - Categoria D (Nível Médio)', 'medio') as c
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

insert into t_saida
select '1', case when exists (select 1 from unnest(private."FC_PENDENCIAS_FICHA"((select c from t_regra),
         '{"nivel":"medio","blocos":{"EXPERIENCIA":{"situacao":"CONFORME"}},"vinculos":[{"categoria":"AREA","inicio":"2020-01-01","fim":"","aceito":false,"motivo":"DATAS_ILEGIVEIS"}]}'::jsonb,
         '{}'::jsonb)) p where p like '%data inválida%') then 'sim' else 'nao' end;
insert into t_saida
select '1b', case when exists (select 1 from unnest(private."FC_PENDENCIAS_FICHA"((select c from t_regra),
         '{"nivel":"medio","blocos":{"EXPERIENCIA":{"situacao":"CONFORME"}},"vinculos":[{"categoria":"AREA","inicio":"2020-01-01","fim":"","aceito":true}]}'::jsonb,
         '{}'::jsonb)) p where p like '%data inválida%') then 'sim' else 'nao' end;

do $$
declare
  v_regra jsonb := '{"blocos":[{"codigo":"ETNICO","tipo":"PONTUACAO","titulo":"Critério étnico","teto":12,"indigena":10,"aldeia":2}]}';
  v_lanc jsonb := '{"nivel":"superior","indigena":false,"blocos":{"ETNICO":{"situacao":"CONFORME","nota_ajustada":7}}}';
begin
  begin
    perform private."FC_VALIDAR_RESULTADO_FICHA"(v_regra, v_lanc,
      '{"resultado":"APTO","nota_apurada":7,"nota_final":7,"parciais":{"ETNICO":7},"eliminatorios":[]}', '{}');
    insert into t_saida values ('2', 'aceita');
  exception when others then insert into t_saida values ('2', 'recusa: ' || sqlerrm);
  end;
  begin
    perform private."FC_VALIDAR_RESULTADO_FICHA"(v_regra, v_lanc,
      '{"resultado":"APTO","nota_apurada":0,"nota_final":0,"parciais":{"ETNICO":0},"eliminatorios":[]}', '{}');
    insert into t_saida values ('3', 'aceita');
  exception when others then insert into t_saida values ('3', 'recusa: ' || sqlerrm);
  end;
end $$;

select * from t_saida order by n;
