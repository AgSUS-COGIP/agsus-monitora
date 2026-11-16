/*
  ENSAIO de 20261113200000_paineis_no_bloco_dados.sql

  Roda no banco ANTES de aplicar e termina em rollback: nada fica gravado.
  Confere: o recurso na matriz, um nível por grupo, a aba no catálogo e nas três áreas.
  Ok = NOTICE com os números e "Ensaio 20261113200000 ok", e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  -- A lista que esta migration estende é a de 20261026190000 (aprovados_pendencias).
  if not ('aprovados_pendencias' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'FC_RECURSOS_MODULO não é a esperada (falta aprovados_pendencias).';
  end if;
  if 'paineis_dados' = any (private."FC_RECURSOS_MODULO"()) then
    raise exception 'O recurso paineis_dados já existe.';
  end if;
  if exists (select 1 from public."TB_ABA" where "CO_ABA" = 'paineis-de-dados') then
    raise exception 'A aba paineis-de-dados já existe.';
  end if;
end;
$$;

-- 1. O recurso "paineis_dados" na matriz de acessos ----------------------------------------------
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao','chat','avaliacao_documental','aprovados_pendencias','paineis_dados']::text[];
$function$;

-- Todo módulo tem nível em todo grupo; o administrador global muda na tela de Acessos.
insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g."CO_GRUPO_ACESSO", 'paineis_dados',
       case when g."ST_ADMIN_GLOBAL" then 'admin' else 'sem_acesso' end
  from public."TB_GRUPO_ACESSO" g
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

-- 2. A aba "Painéis" nas três áreas --------------------------------------------------------------
insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values ('paineis-de-dados', 'Painéis', 'layout-dashboard', 14, 'paineis-de-dados', 'paineis_dados', 'nativa', 'S', 'S');

insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'paineis-de-dados', a.codigo, 'S'
  from (values ('saude-indigena'), ('sede'), ('projetos')) as a (codigo)
on conflict do nothing;


do $confere$
declare
  v_grupos int;
  v_niveis int;
  v_areas int;
begin
  if not ('paineis_dados' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'paineis_dados não entrou em FC_RECURSOS_MODULO.';
  end if;
  select count(*) into v_grupos from public."TB_GRUPO_ACESSO";
  select count(*) into v_niveis from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'paineis_dados';
  if v_niveis <> v_grupos then
    raise exception 'Grupos sem nível em paineis_dados: % de %.', v_grupos - v_niveis, v_grupos;
  end if;
  select count(*) into v_areas from public."RL_ABA_AREA" where "CO_ABA" = 'paineis-de-dados' and "ST_ATIVO" = 'S';
  if v_areas <> 3 then
    raise exception 'A aba deveria estar nas 3 áreas (está em %).', v_areas;
  end if;
  raise notice 'Ok: % grupos com nível; aba em % áreas.', v_niveis, v_areas;
end;
$confere$;

do $ok$ begin raise notice 'Ensaio 20261113200000 ok'; end; $ok$;

rollback;
