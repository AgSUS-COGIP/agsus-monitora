/*
  ENSAIO da migration 20261015010000_outro_motivo_e_observacao_do_item.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  sem as linhas begin/commit), e desfaça. Leve: só funções, sem tocar tabela.

  Regra: a vigente do 114/2026 na vaga 182513 (Motorista B).
  Espera (depois da migration):
    1. Requisito Não confere só com OUTRO descrito → sem falta de motivo ('nenhuma');
    2. OUTRO com texto curto → 'descreva o outro motivo (10 caracteres ou mais)';
    3. Não confere sem motivo → 'escolha o motivo';
    4. Cursos Conforme com nota diferente, justificativas [OUTRO] descrito → sem
       'sem justificativa' ('nenhuma');
    4b. o mesmo com o OUTRO sem texto → só 'descreva o outro motivo' (uma falta);
    5. lançamento com OUTRO em motivos e justificativas e observacao → aceita;
    6. observacao de 2.001 caracteres → recusa;
    7. motivo que não está na regra (nem OUTRO) → recusa.
*/
create temporary table t_saida (n text, saida text) on commit drop;
create temporary table t_regra on commit drop as
select private."FC_REGRA_DA_VAGA"(h."DS_CONFIGURACAO", '182513', 'CARGO 14: MOTORISTA - Categoria B (Nível Médio)', 'medio') as c
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

insert into t_saida
select '1', coalesce(string_agg(p, ' | ') filter (where p like 'Requisito%motivo%'), 'nenhuma')
  from unnest(private."FC_PENDENCIAS_FICHA"((select c from t_regra),
       '{"nivel":"medio","blocos":{"REQUISITO_DO_CARGO":{"situacao":"NAO_CONFORME","motivos":["OUTRO"],"motivo_livre":"CNH enviada cortada, sem a validade."}}}'::jsonb,
       '{}'::jsonb)) p;
insert into t_saida
select '2', coalesce(string_agg(p, ' | ') filter (where p like 'Requisito%motivo%'), 'nenhuma')
  from unnest(private."FC_PENDENCIAS_FICHA"((select c from t_regra),
       '{"nivel":"medio","blocos":{"REQUISITO_DO_CARGO":{"situacao":"NAO_CONFORME","motivos":["OUTRO"],"motivo_livre":"curto"}}}'::jsonb,
       '{}'::jsonb)) p;
insert into t_saida
select '3', coalesce(string_agg(p, ' | ') filter (where p like 'Requisito%motivo%'), 'nenhuma')
  from unnest(private."FC_PENDENCIAS_FICHA"((select c from t_regra),
       '{"nivel":"medio","blocos":{"REQUISITO_DO_CARGO":{"situacao":"NAO_CONFORME","motivos":[]}}}'::jsonb,
       '{}'::jsonb)) p;
insert into t_saida
select '4', coalesce(string_agg(p, ' | ') filter (where p like '%justificativa%' or p like '%outro motivo%'), 'nenhuma')
  from unnest(private."FC_PENDENCIAS_FICHA"((select c from t_regra),
       '{"nivel":"medio","blocos":{"CURSOS":{"situacao":"CONFORME","edita_nota":true,"justificativas":["OUTRO"],"motivo_livre":"Certificado sem assinatura; aceito pela declaração."}}}'::jsonb,
       '{"resultado":"APTO","declarada":{"CURSOS":2},"parciais":{"CURSOS":6}}'::jsonb)) p;
insert into t_saida
select '4b', coalesce(string_agg(p, ' | ') filter (where p like '%justificativa%' or p like '%outro motivo%'), 'nenhuma')
  from unnest(private."FC_PENDENCIAS_FICHA"((select c from t_regra),
       '{"nivel":"medio","blocos":{"CURSOS":{"situacao":"CONFORME","edita_nota":true,"justificativas":["OUTRO"],"motivo_livre":""}}}'::jsonb,
       '{"resultado":"APTO","declarada":{"CURSOS":2},"parciais":{"CURSOS":6}}'::jsonb)) p;

do $$
declare
  v_regra jsonb := (select c from t_regra);
begin
  begin
    perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra,
      '{"nivel":"medio","blocos":{"REQUISITO_DO_CARGO":{"situacao":"NAO_CONFORME","motivos":["OUTRO"],"motivo_livre":"CNH cortada.","observacao":"Conferido na Empregare."},"CURSOS":{"situacao":"CONFORME","justificativas":["OUTRO"],"motivo_livre":"Sem assinatura."},"FORMACAO":{"observacao":"Diploma não pontua no médio."}}}');
    insert into t_saida values ('5', 'aceita');
  exception when others then insert into t_saida values ('5', 'recusa: ' || sqlerrm);
  end;
  begin
    perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra,
      jsonb_build_object('nivel', 'medio', 'blocos', jsonb_build_object('CURSOS', jsonb_build_object('observacao', repeat('a', 2001)))));
    insert into t_saida values ('6', 'aceita');
  exception when others then insert into t_saida values ('6', 'recusa: ' || sqlerrm);
  end;
  begin
    perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra,
      '{"nivel":"medio","blocos":{"REQUISITO_DO_CARGO":{"situacao":"NAO_CONFORME","motivos":["INVENTADO"]}}}');
    insert into t_saida values ('7', 'aceita');
  exception when others then insert into t_saida values ('7', 'recusa: ' || sqlerrm);
  end;
end $$;

select * from t_saida order by n;
