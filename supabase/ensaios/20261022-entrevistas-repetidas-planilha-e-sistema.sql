-- ENSAIO de supabase/correcoes/20261022-entrevistas-repetidas-planilha-e-sistema.sql: roda e desfaz (rollback).
-- Situação: A RODAR (depende da migration 20261022200000 aplicada; token da Management API inválido em 22/10/2026).
-- Esperado: por área, quantos pares planilha + sistema havia, quantas linhas da planilha saem e
-- quantos pares ficam (só os em que a planilha é a vigente: tem parecer ou nota e o sistema não); nenhuma
-- linha do sistema desativada; o histórico "repetida" assinado pela conta do setor.
begin;

create temp table t_pares on commit drop as
select e."CO_AREA" as area, e."CO_ENTREVISTA" as planilha, s."CO_ENTREVISTA" as sistema,
       e."TP_PARECER" as parecer_planilha, s."TP_PARECER" as parecer_sistema
  from public."TB_ENTREVISTA" e
  join public."TB_ENTREVISTA" s
    on s."CO_ANALISE_CURRICULAR" = e."CO_ANALISE_CURRICULAR"
   and s."TP_ORIGEM" = 'sistema' and s."ST_ATIVO" = 'S'
 where e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S';

create temp table t_sistema_antes on commit drop as
select count(*) as qt from public."TB_ENTREVISTA" where "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S';

do $correcao$
declare
  c_autor constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  v_area text;
begin
  if not exists (select 1 from public."TB_PERFIL_USUARIO" u where u.user_id = c_autor and u.ativo) then
    raise exception 'A conta do setor (%) não está ativa.', c_autor;
  end if;
  for v_area in select a."CO_AREA" from public."TB_AREA" a order by 1 loop
    perform private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(v_area, null, c_autor);
  end loop;
end;
$correcao$;

do $ensaio$
declare
  v_qt integer;
begin
  select count(*) into v_qt from public."TB_ENTREVISTA" where "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S';
  assert v_qt = (select qt from t_sistema_antes), 'alguma entrevista do sistema foi desativada';
  -- Par que ficou: só com a planilha vigente (ela tem o parecer ou a nota, e o sistema ainda não).
  select count(*) into v_qt
    from t_pares p
    join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = p.planilha
   where e."ST_ATIVO" = 'S'
     and p.planilha not in (select v from private."FC_ENTREVISTAS_VIGENTES"(null) v);
  assert v_qt = 0, format('%s pares ficaram com a planilha fora da vigente', v_qt);
  select count(*) into v_qt
    from t_pares p
    join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = p.planilha
   where e."ST_ATIVO" = 'N'
     and not exists (select 1 from public."TH_ENTREVISTA_AVALIACAO" h
                      where h."CO_ENTREVISTA" = p.planilha and h."DS_CAMPO" = 'repetida'
                        and h."CO_USUARIO" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43');
  assert v_qt = 0, format('%s linhas desativadas sem o histórico assinado', v_qt);
end;
$ensaio$;

select coalesce(json_agg(json_build_object(
         'area', x.area, 'pares', x.pares, 'desativadas', x.desativadas, 'ficam', x.pares - x.desativadas)
         order by x.area), '[]'::json) as resultado
  from (select p.area, count(*) as pares,
               count(*) filter (where e."ST_ATIVO" = 'N') as desativadas
          from t_pares p
          join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = p.planilha
         group by p.area) x;

rollback;
