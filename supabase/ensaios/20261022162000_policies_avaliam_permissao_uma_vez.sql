/*
  ENSAIO da migration 20261022162000_policies_avaliam_permissao_uma_vez.sql
  — begin … rollback. NÃO É MIGRATION; nada fica gravado.

  Montagem (como nos outros ensaios):
    { echo begin;
      sed -n '/^-- == ANTES ==/,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261022162000_policies_avaliam_permissao_uma_vez.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261022162000_policies_avaliam_permissao_uma_vez.sql;
      sed -n '/^-- == DEPOIS ==/,$p' supabase/ensaios/20261022162000_policies_avaliam_permissao_uma_vez.sql;
    } > /tmp/ensaio.sql   (o arquivo termina em rollback)

  1. Texto: para cada policy de public que continua, tirar o embrulho
     "( SELECT private.f(...) AS f)" devolve a expressão de antes.
  2. Resultado: para um perfil ativo de cada combinação de papel e permissões
     (como role authenticated, com o sub dele), quantas linhas de uma amostra de
     até 400 linhas de cada tabela mexida o SELECT mostra (e a view do
     monitoramento inteira) — antes e depois iguais.
  3. Tempo: a soma das contagens de todos os perfis, antes e depois.
  Mostra só contagens e tempos (nenhum nome, e-mail ou id).
*/
-- == ANTES ==
create temporary table t_pol (fase text, tabela text, policy text, cmd text, usando text, checando text) on commit drop;
create temporary table t_vis (fase text, perfil int, tabela text, linhas bigint, ms numeric) on commit drop;
grant all on t_vis to authenticated;
create temporary table t_perfis (n int, claims text) on commit drop;
grant select on t_perfis to authenticated;
-- Um perfil ativo por combinação de papel, permissões antigas e recorte por coordenação
-- (antes da migration, contar tudo para todos os perfis passa do tempo-limite: é o custo
-- que a migration tira).
insert into t_perfis
select row_number() over (order by x.id), json_build_object('sub', x.user_id, 'role', 'authenticated')::text
  from (select distinct on (p.perfil, p.p_ind, p.p_cores, p.p_paineis, p.p_config, p.p_admin,
                            p."CO_COORDENACAO" is null) p.id, p.user_id
          from public."TB_PERFIL_USUARIO" p
         where p.ativo is true and p.user_id is not null
         order by p.perfil, p.p_ind, p.p_cores, p.p_paineis, p.p_config, p.p_admin,
                  p."CO_COORDENACAO" is null, p.id) x;

-- Até 400 linhas de cada tabela, escolhidas ao acaso (pela posição física: a contagem de
-- cada perfil só avalia a RLS nessas linhas; contar tudo, antes da migration, passa do
-- tempo-limite — é o custo que ela tira).
create temporary table t_amostra (tabela text primary key, tids tid[]) on commit drop;
grant select on t_amostra to authenticated;
do $$
declare
  t text;
  v tid[];
begin
  foreach t in array array['TB_ANALISE_CURRICULAR', 'TB_CANDIDATO_APROVADO', 'TB_CATEGORIA_CONVOCACAO',
    'TB_CONFIGURACAO', 'TB_CONFIG_MAPA_SAUDE_INDIG', 'TB_CONVOCACAO_EDITAL', 'TB_EDITAL_ANALISE',
    'TB_LISTA_APROVADO', 'TB_MODELO_CONVOCACAO', 'TB_MONITORAMENTO_INDIGENA', 'TB_PAINEL_EXTERNO',
    'TB_PERFIL_USUARIO', 'TB_SOLICITACAO_ACESSO', 'TB_VAGA_IMEDIATA', 'TD_UNIDADE', 'TH_CANDIDATO_APROVADO',
    'TH_MONITORAMENTO', 'TL_EVENTO_ACESSO', 'TL_SYNC_ANALISE', 'TM_ANALISE_CURRICULAR'] loop
    execute format('select array_agg(ctid) from (select ctid from public.%I order by random() limit 400) x', t) into v;
    insert into t_amostra values (t, coalesce(v, '{}'));
  end loop;
end;
$$;

create or replace function pg_temp.guardar(p_fase text) returns void
language plpgsql as $$
declare
  r record;
  a record;
  n bigint;
  t0 timestamptz;
begin
  insert into t_pol
  select p_fase, tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public';
  for r in select * from t_perfis order by n loop
    perform set_config('request.jwt.claims', r.claims, true);
    execute 'set local role authenticated';
    for a in select * from t_amostra order by tabela loop
      t0 := clock_timestamp();
      execute format('select count(*) from public.%I where ctid = any ($1)', a.tabela) into n using a.tids;
      insert into t_vis values (p_fase, r.n, a.tabela, n, extract(epoch from clock_timestamp() - t0) * 1000);
    end loop;
    -- A leitura do monitoramento (view security_invoker), inteira.
    t0 := clock_timestamp();
    select count(*) into n from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL";
    insert into t_vis values (p_fase, r.n, 'VW_MONITORAMENTO_INDIGENA_OPERACIONAL', n,
                              extract(epoch from clock_timestamp() - t0) * 1000);
    execute 'reset role';
  end loop;
end;
$$;

select pg_temp.guardar('antes');
-- == aplicar a migration aqui ==

-- == DEPOIS ==
select pg_temp.guardar('depois');

create or replace function pg_temp.sem_embrulho(p text) returns text
language sql immutable as $$
  select regexp_replace(p, '\( SELECT (private\.\w+\([^()]*\)) AS \w+\)', '\1', 'g');
$$;

do $$
declare
  v_texto int;
  v_vis int;
  v_saiu int;
begin
  select count(*) into v_texto
    from t_pol a join t_pol d using (tabela, policy)
   where a.fase = 'antes' and d.fase = 'depois'
     and (pg_temp.sem_embrulho(coalesce(a.usando, '')) <> pg_temp.sem_embrulho(coalesce(d.usando, ''))
          or pg_temp.sem_embrulho(coalesce(a.checando, '')) <> pg_temp.sem_embrulho(coalesce(d.checando, ''))
          or a.cmd <> d.cmd);
  select count(*) into v_saiu
    from t_pol a where a.fase = 'antes'
     and not exists (select 1 from t_pol d where d.fase = 'depois' and d.tabela = a.tabela and d.policy = a.policy);
  select count(*) into v_vis
    from t_vis a join t_vis d using (perfil, tabela)
   where a.fase = 'antes' and d.fase = 'depois' and a.linhas <> d.linhas;
  if v_texto > 0 or v_vis > 0 or v_saiu <> 4 then
    raise exception 'Ensaio reprovado: % policies com outro texto, % (perfil, tabela) com outra contagem, % policies saíram (esperado 4)',
      v_texto, v_vis, v_saiu;
  end if;
end;
$$;

select tabela, count(distinct perfil) as perfis,
       sum(linhas) filter (where fase = 'antes') as linhas_antes,
       sum(linhas) filter (where fase = 'depois') as linhas_depois,
       round(sum(ms) filter (where fase = 'antes'), 1) as ms_antes,
       round(sum(ms) filter (where fase = 'depois'), 1) as ms_depois
  from t_vis group by tabela order by tabela;

rollback;
