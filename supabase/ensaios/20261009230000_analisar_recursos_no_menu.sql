/*
  ENSAIO de 20261009230000_analisar_recursos_no_menu.sql (e da
  20261009230500_liga_aba_analisar_recursos.sql) — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica as duas (o corpo
  copiado sem mudança, sem o begin/commit) e confere (cada falha para com
  "FALHOU En"; o resultado é a última consulta):
    E1  menu: Painel de recursos (6, sem BETA), Analisar recursos (7, BETA,
        recurso recursos, view analisar-recursos, ícone gavel), Painel de
        entrevistas 8, Conduzir entrevistas 9, Classificação 10, Aprovados 11,
        Seleção 12; nenhuma ordem repetida;
    E2  Analisar recursos nas mesmas áreas do painel, com a mesma situação
        (ligada/desligada) em cada uma;
    E3  listar_abas_do_menu() traz Analisar recursos depois do painel, com o
        selo e as áreas;
    E4  o rollback (os dois arquivos, na ordem inversa) volta o catálogo ao de
        antes (rótulo, selo, ordem, nenhuma linha de analisar-recursos).
  O resultado traz também listar_abas_do_menu() depois da migration, para
  conferir com tests/fixtures/listar-abas-do-menu.json (a fixture é o seed;
  no banco real, uma aba desligada numa área em Configurações › Módulos e
  abas some dela).
  Termina em ROLLBACK: nada fica gravado.
  Mantenha em sincronia: tests/analisar-recursos-no-menu-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo.
*/
begin;

create temp table ensaio_resultado (etapa text, ok boolean, detalhe text) on commit drop;
create temp table ensaio_antes on commit drop as
  select "CO_ABA", "NO_ABA", "NU_ORDEM", "ST_BETA", "ST_ATIVO" from public."TB_ABA";

-- ===== corpo da migration (sem begin/commit) =====

set local lock_timeout = '10s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'recursos') then
    raise exception 'Catálogo de abas sem a aba recursos (20260929120000_recursos.sql).';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'conduzir-entrevistas') then
    raise exception 'Aplique antes 20261008130000_conduzir_entrevistas_no_menu.sql.';
  end if;
  if exists (select 1 from public."TB_ABA" where "CO_ABA" = 'analisar-recursos') then
    raise exception 'A aba analisar-recursos já existe: esta migration já foi aplicada.';
  end if;
end;
$$;

-- 1. Menu: o painel muda de rótulo e sai do beta; Analisar recursos entra desligada ------
update public."TB_ABA" set "NO_ABA" = 'Painel de recursos', "ST_BETA" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';

update public."TB_ABA" set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 9, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'conduzir-entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 10, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao';
update public."TB_ABA" set "NU_ORDEM" = 11, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 12, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';

insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values ('analisar-recursos', 'Analisar recursos', 'gavel', 7, 'analisar-recursos', 'recursos', 'nativa', 'N', 'S');
insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'analisar-recursos', r."CO_AREA", r."ST_ATIVO" from public."RL_ABA_AREA" r where r."CO_ABA" = 'recursos'
on conflict do nothing;

-- ===== 20261009230500_liga_aba_analisar_recursos (sem begin/commit) =====
update public."TB_ABA" set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analisar-recursos';

-- ===== conferências =====

-- E1. Rótulos, selo, ordem.
do $$
declare
  v_esperado jsonb := '{"recursos":6,"analisar-recursos":7,"entrevistas":8,"conduzir-entrevistas":9,"classificacao":10,"aprovados":11,"selecao":12}';
  v_aba text;
begin
  for v_aba in select jsonb_object_keys(v_esperado) loop
    if (select "NU_ORDEM" from public."TB_ABA" where "CO_ABA" = v_aba) is distinct from (v_esperado ->> v_aba)::int then
      raise exception 'FALHOU E1: ordem de %', v_aba;
    end if;
  end loop;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'recursos' and "NO_ABA" = 'Painel de recursos' and "ST_BETA" = 'N') then
    raise exception 'FALHOU E1: o painel não virou "Painel de recursos" sem BETA';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'analisar-recursos' and "NO_ABA" = 'Analisar recursos'
                   and "ST_BETA" = 'S' and "ST_ATIVO" = 'S' and "CO_RECURSO" = 'recursos'
                   and "CO_VIEW" = 'analisar-recursos' and "DS_ICONE" = 'gavel' and "TP_ABA" = 'nativa') then
    raise exception 'FALHOU E1: a aba Analisar recursos não está como esperado';
  end if;
  if exists (select "NU_ORDEM" from public."TB_ABA" where "ST_ATIVO" = 'S' group by "NU_ORDEM" having count(*) > 1) then
    raise exception 'FALHOU E1: ordem repetida no catálogo';
  end if;
  insert into ensaio_resultado values ('E1', true, 'Painel de recursos 6 (sem BETA), Analisar recursos 7 (BETA), as seguintes de 8 a 12');
end;
$$;

-- E2. As mesmas áreas do painel, na mesma situação.
do $$
declare
  v_diferentes int;
  v_areas int;
begin
  select count(*) into v_diferentes from (
    (select "CO_AREA", "ST_ATIVO" from public."RL_ABA_AREA" where "CO_ABA" = 'recursos'
     except select "CO_AREA", "ST_ATIVO" from public."RL_ABA_AREA" where "CO_ABA" = 'analisar-recursos')
    union all
    (select "CO_AREA", "ST_ATIVO" from public."RL_ABA_AREA" where "CO_ABA" = 'analisar-recursos'
     except select "CO_AREA", "ST_ATIVO" from public."RL_ABA_AREA" where "CO_ABA" = 'recursos')) d;
  if v_diferentes > 0 then raise exception 'FALHOU E2: áreas diferentes das do painel'; end if;
  select count(*) into v_areas from public."RL_ABA_AREA" where "CO_ABA" = 'analisar-recursos';
  if v_areas = 0 then raise exception 'FALHOU E2: nenhuma área'; end if;
  insert into ensaio_resultado values ('E2', true, format('%s área(s), iguais às do painel', v_areas));
end;
$$;

-- E3. listar_abas_do_menu: Analisar recursos logo depois do painel, com selo e áreas.
do $$
declare
  v jsonb := public.listar_abas_do_menu()::jsonb;
  v_codigos text[];
  v_aba jsonb;
begin
  select array_agg(x ->> 'co_aba' order by o) into v_codigos from jsonb_array_elements(v) with ordinality t(x, o);
  if array_position(v_codigos, 'analisar-recursos') is distinct from array_position(v_codigos, 'recursos') + 1 then
    raise exception 'FALHOU E3: Analisar recursos não vem logo depois do painel (%)', v_codigos;
  end if;
  select x into v_aba from jsonb_array_elements(v) x where x ->> 'co_aba' = 'analisar-recursos';
  if not (v_aba ->> 'st_beta')::boolean or jsonb_array_length(v_aba -> 'areas') = 0 then
    raise exception 'FALHOU E3: sem selo ou sem áreas';
  end if;
  insert into ensaio_resultado values ('E3', true, array_to_string(v_codigos, ' › '));
end;
$$;

create temp table ensaio_menu on commit drop as select public.listar_abas_do_menu() as menu;

-- E4. O rollback (os dois arquivos, na ordem inversa) volta ao de antes.
update public."TB_ABA" set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analisar-recursos';

delete from public."RL_ABA_AREA" where "CO_ABA" = 'analisar-recursos';
delete from public."TB_ABA" where "CO_ABA" = 'analisar-recursos';
update public."TB_ABA" set "NU_ORDEM" = 7, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'conduzir-entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 9, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao';
update public."TB_ABA" set "NU_ORDEM" = 10, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 11, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';
update public."TB_ABA" set "NO_ABA" = 'Recursos', "ST_BETA" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';

do $$
begin
  if exists (
    (select "CO_ABA", "NO_ABA", "NU_ORDEM", "ST_BETA", "ST_ATIVO" from public."TB_ABA"
     except select * from ensaio_antes)
    union all
    (select * from ensaio_antes
     except select "CO_ABA", "NO_ABA", "NU_ORDEM", "ST_BETA", "ST_ATIVO" from public."TB_ABA")) then
    raise exception 'FALHOU E4: o rollback não voltou o catálogo ao de antes';
  end if;
  insert into ensaio_resultado values ('E4', true, 'rollback volta rótulo, selo e ordem; sem linhas de analisar-recursos');
end;
$$;

select json_build_object(
  'etapas', (select json_agg(json_build_object('etapa', etapa, 'ok', ok, 'detalhe', detalhe) order by etapa) from ensaio_resultado),
  'listar_abas_do_menu', (select menu from ensaio_menu)
) as resultado;

rollback;
