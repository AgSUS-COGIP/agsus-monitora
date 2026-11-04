/*
  RESUMO DO DIA DO RESPONSÁVEL (popup ao entrar e sininho no topo)

  Pedido de 04/11/2026, no lugar do e-mail: no primeiro acesso do dia, quem é
  responsável por algum edital (RL_RESPONSAVEL_EDITAL) ou demanda interna
  (RL_DEMANDA_INTERNA_RESPONSAVEL) vê um resumo curto — Hoje, Próximos 7 dias
  e Atrasadas — e o sininho do topo reabre quando quiser. Depende de
  20261104120000_cronograma_demandas_internas.sql.

  O QUE MUDA
    1. public."TB_PREFERENCIA_USUARIO": preferências pessoais, uma linha por
       perfil. Primeira: ST_MOSTRAR_RESUMO_DIA (S/N; sem linha = S). Não havia
       tabela de preferências por pessoa.
    2. public.obter_meu_resumo_do_dia(data): uma chamada, só leitura, para a
       pessoa logada:
         hoje       — etapas (não concluídas) e demandas (em aberto) que começam
                      ou terminam no dia;
         proximos   — o mesmo nos 7 dias seguintes;
         atrasadas  — demandas em aberto com o último dia antes do dia.
       Só editais ativos que a pessoa ainda vê (FC_PODE_VER_EDITAL) e demandas
       que ainda vê (FC_PODE_VER_DEMANDA); `pode_concluir` por demanda.
       Também: os editais e as demandas de que ela é responsável (para o
       Cronograma filtrar "os meus") e a preferência.
    3. public.salvar_minha_preferencia_do_resumo(boolean).

  "Visto hoje" fica no navegador (localStorage), não no banco.

  Ensaio: supabase/ensaios/20261104130000_resumo_do_dia_do_responsavel.sql
  Rollback: supabase/rollback/20261104130000_resumo_do_dia_do_responsavel.sql
*/
begin;

set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."RL_RESPONSAVEL_EDITAL"') is null
     or to_regclass('public."RL_DEMANDA_INTERNA_RESPONSAVEL"') is null
     or to_regprocedure('private."FC_PODE_VER_DEMANDA"(text, uuid)') is null
     or to_regprocedure('private."FC_PODE_EDITAR_DEMANDA"(text, uuid)') is null then
    raise exception 'Aplique antes 20261104120000_cronograma_demandas_internas.sql.';
  end if;
  if to_regprocedure('private.current_profile()') is null
     or to_regprocedure('private."FC_PODE_VER_EDITAL"(uuid)') is null
     or to_regprocedure('private.is_master()') is null then
    raise exception 'Faltam private.current_profile, FC_PODE_VER_EDITAL ou is_master.';
  end if;
end;
$$;

-- 1. Preferências pessoais ----------------------------------------------------------------------
create table public."TB_PREFERENCIA_USUARIO" (
  "CO_PERFIL_USUARIO" uuid not null,
  "ST_MOSTRAR_RESUMO_DIA" character varying(1) not null default 'S',
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_PREFERENCIA_USUARIO" primary key ("CO_PERFIL_USUARIO"),
  constraint "FK_PERFILUSUARIO_PREFUSUARIO" foreign key ("CO_PERFIL_USUARIO")
    references public."TB_PERFIL_USUARIO" (id) on delete cascade,
  constraint "CK_PREFUSUARIO_STMOSTRARRESUMO" check ("ST_MOSTRAR_RESUMO_DIA" in ('S', 'N'))
);
comment on table public."TB_PREFERENCIA_USUARIO" is
  'Preferências pessoais de cada pessoa (20261104130000), uma linha por perfil; sem linha = os padrões. Escrita só pelas RPCs da própria pessoa.';
comment on column public."TB_PREFERENCIA_USUARIO"."CO_PERFIL_USUARIO" is 'Pessoa (TB_PERFIL_USUARIO.id).';
comment on column public."TB_PREFERENCIA_USUARIO"."ST_MOSTRAR_RESUMO_DIA" is 'S = abre o resumo do dia ao entrar; N = só o sininho.';
comment on column public."TB_PREFERENCIA_USUARIO"."DT_ATUALIZACAO" is 'Última mudança.';
comment on constraint "PK_TB_PREFERENCIA_USUARIO" on public."TB_PREFERENCIA_USUARIO" is 'Uma linha por pessoa.';
comment on constraint "FK_PERFILUSUARIO_PREFUSUARIO" on public."TB_PREFERENCIA_USUARIO" is 'Perfil da pessoa; sai junto se o perfil for apagado.';
comment on constraint "CK_PREFUSUARIO_STMOSTRARRESUMO" on public."TB_PREFERENCIA_USUARIO" is 'S ou N.';
alter table public."TB_PREFERENCIA_USUARIO" enable row level security;
revoke all on public."TB_PREFERENCIA_USUARIO" from public, anon, authenticated, service_role;

-- 2. O resumo do dia da pessoa logada ----------------------------------------------------------
create function public.obter_meu_resumo_do_dia(p_data date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_data date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_perfil public."TB_PERFIL_USUARIO";
  v_editais uuid[];
  v_demandas uuid[];
  v_itens jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  v_perfil := private.current_profile();
  if v_perfil.id is null then
    raise exception 'Perfil não encontrado.' using errcode = '42501';
  end if;

  -- Do que a pessoa é responsável e ainda vê.
  select coalesce(array_agg(m.id), '{}') into v_editais
    from public."RL_RESPONSAVEL_EDITAL" r
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
   where r."CO_PERFIL_USUARIO" = v_perfil.id and m.ativo
     and (private.is_master() or private."FC_PODE_VER_EDITAL"(m.id));
  select coalesce(array_agg(d."CO_DEMANDA_INTERNA"), '{}') into v_demandas
    from public."RL_DEMANDA_INTERNA_RESPONSAVEL" r
    join public."TB_DEMANDA_INTERNA" d on d."CO_DEMANDA_INTERNA" = r."CO_DEMANDA_INTERNA"
   where r."CO_PERFIL_USUARIO" = v_perfil.id and d."ST_ATIVO" = 'S'
     and private."FC_PODE_VER_DEMANDA"(d."CO_AREA", d."CO_MONITORAMENTO");

  with itens as (
    select 'etapa'::text as tipo, c.id::text as id, c.atividade as titulo,
           m.id as edital_id, m.edital, m.unidade, m."CO_AREA" as area,
           c.data_inicio as inicio, c.data_fim as fim, false as pode_concluir
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c.monitoramento_id
     where c.monitoramento_id = any (v_editais)
       and c.concluida is not true
       and (c.data_inicio between v_data and v_data + 7 or c.data_fim between v_data and v_data + 7)
    union all
    select 'demanda', d."CO_DEMANDA_INTERNA"::text, d."NO_DEMANDA"::text,
           d."CO_MONITORAMENTO", m.edital, m.unidade, d."CO_AREA",
           d."DT_INICIO", d."DT_FIM",
           private."FC_PODE_EDITAR_DEMANDA"(d."CO_AREA", d."CO_MONITORAMENTO")
      from public."TB_DEMANDA_INTERNA" d
      left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = d."CO_MONITORAMENTO"
     where d."CO_DEMANDA_INTERNA" = any (v_demandas)
       and d."ST_CONCLUIDA" = 'N'
       and d."DT_INICIO" <= v_data + 7
  ),
  marcos as (
    select i.*, x.marco, x.dia
      from itens i
      cross join lateral (values
        (case when i.inicio = i.fim then 'dia_unico' else 'inicio' end, i.inicio),
        ('fim', i.fim)) x(marco, dia)
     where (x.marco <> 'fim' or i.fim <> i.inicio)
       and x.dia between v_data and v_data + 7
  ),
  linhas as (
    select case when m.dia = v_data then 'hoje' else 'proximos' end as grupo,
           m.dia as ordem, m.titulo,
           jsonb_build_object(
             'tipo', m.tipo, 'id', m.id, 'titulo', m.titulo,
             'edital_id', m.edital_id, 'edital', m.edital, 'unidade', m.unidade, 'area', m.area,
             'data_inicio', m.inicio, 'data_fim', m.fim,
             'marco', m.marco, 'data', m.dia, 'pode_concluir', m.pode_concluir) as item
      from marcos m
    union all
    select 'atrasadas', i.fim, i.titulo,
           jsonb_build_object(
             'tipo', i.tipo, 'id', i.id, 'titulo', i.titulo,
             'edital_id', i.edital_id, 'edital', i.edital, 'unidade', i.unidade, 'area', i.area,
             'data_inicio', i.inicio, 'data_fim', i.fim,
             'marco', 'fim', 'data', i.fim, 'pode_concluir', i.pode_concluir)
      from itens i
     where i.tipo = 'demanda' and i.fim < v_data
  )
  select jsonb_build_object(
           'hoje', coalesce(jsonb_agg(l.item order by l.ordem, l.titulo) filter (where l.grupo = 'hoje'), '[]'::jsonb),
           'proximos', coalesce(jsonb_agg(l.item order by l.ordem, l.titulo) filter (where l.grupo = 'proximos'), '[]'::jsonb),
           'atrasadas', coalesce(jsonb_agg(l.item order by l.ordem, l.titulo) filter (where l.grupo = 'atrasadas'), '[]'::jsonb))
    into v_itens
    from linhas l;

  return v_itens || jsonb_build_object(
    'data', v_data,
    'perfil', v_perfil.id,
    'nome', coalesce(nullif(btrim(v_perfil.nome), ''), split_part(coalesce(v_perfil.email, ''), '@', 1)),
    'responsavel', cardinality(v_editais) > 0 or cardinality(v_demandas) > 0,
    'editais', to_jsonb(v_editais),
    'demandas', to_jsonb(v_demandas),
    'mostrar_ao_entrar', coalesce((
      select p."ST_MOSTRAR_RESUMO_DIA" = 'S' from public."TB_PREFERENCIA_USUARIO" p
       where p."CO_PERFIL_USUARIO" = v_perfil.id), true));
end;
$function$;
comment on function public.obter_meu_resumo_do_dia(date) is
  'Resumo do dia de quem chama (padrão: hoje em Brasília), só leitura: hoje, proximos (7 dias) e atrasadas (demandas), dos editais e demandas de que é responsável e ainda vê; editais/demandas dela, responsavel e mostrar_ao_entrar. 20261104130000.';
revoke all on function public.obter_meu_resumo_do_dia(date) from public, anon;
grant execute on function public.obter_meu_resumo_do_dia(date) to authenticated;

-- 3. A preferência ----------------------------------------------------------------------------
create function public.salvar_minha_preferencia_do_resumo(p_mostrar boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_perfil uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if p_mostrar is null then
    raise exception 'Informe se o resumo abre ao entrar.' using errcode = '22023';
  end if;
  select p.id into v_perfil from private.current_profile() p;
  if v_perfil is null then
    raise exception 'Perfil não encontrado.' using errcode = '42501';
  end if;
  insert into public."TB_PREFERENCIA_USUARIO" ("CO_PERFIL_USUARIO", "ST_MOSTRAR_RESUMO_DIA")
  values (v_perfil, case when p_mostrar then 'S' else 'N' end)
  on conflict ("CO_PERFIL_USUARIO") do update
    set "ST_MOSTRAR_RESUMO_DIA" = excluded."ST_MOSTRAR_RESUMO_DIA", "DT_ATUALIZACAO" = now();
  return jsonb_build_object('mostrar_ao_entrar', p_mostrar);
end;
$function$;
comment on function public.salvar_minha_preferencia_do_resumo(boolean) is
  'Liga (true) ou desliga (false) o resumo do dia ao entrar, para quem chama (o sininho continua). 20261104130000.';
revoke all on function public.salvar_minha_preferencia_do_resumo(boolean) from public, anon;
grant execute on function public.salvar_minha_preferencia_do_resumo(boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
