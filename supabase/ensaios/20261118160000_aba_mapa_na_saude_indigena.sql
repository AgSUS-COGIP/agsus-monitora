/*
  ENSAIO de 20261118160000_aba_mapa_na_saude_indigena.sql

  Roda no banco ANTES de aplicar e termina em rollback: nada fica gravado.
  Confere: a aba no catálogo, só na Saúde Indígena, logo depois da Visão geral; as outras abas
  uma posição abaixo; e o menu (`listar_abas_do_menu`) com o Mapa na Saúde Indígena e sem ele
  na SEDE e em Projetos.
  Ok = NOTICE com os números e "Ensaio 20261118160000 ok", e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

create temporary table ensaio_ordem_antes on commit drop as
select "CO_ABA", "NU_ORDEM" from public."TB_ABA";

do $$
begin
  if exists (select 1 from public."TB_ABA" where "CO_ABA" = 'mapa') then
    raise exception 'A aba mapa já existe.';
  end if;
  if not exists (select 1 from public."TB_AREA" where "CO_AREA" = 'saude-indigena') then
    raise exception 'A área saude-indigena não existe.';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'visao-geral' and "NU_ORDEM" = 1) then
    raise exception 'A Visão geral não está na ordem 1.';
  end if;
end;
$$;

-- 1. As abas depois da Visão geral descem uma posição --------------------------------------------
update public."TB_ABA"
   set "NU_ORDEM" = "NU_ORDEM" + 1,
       "DT_ATUALIZACAO" = now()
 where "NU_ORDEM" >= 2;

update public."RL_ABA_AREA"
   set "NU_ORDEM" = "NU_ORDEM" + 1,
       "DT_ATUALIZACAO" = now()
 where "NU_ORDEM" >= 2;

-- 2. A aba "Mapa", só na Saúde Indígena ----------------------------------------------------------
insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values ('mapa', 'Mapa', 'globe', 2, 'mapa', 'dashboard', 'nativa', 'S', 'N');

insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
values ('mapa', 'saude-indigena', 'S');


do $confere$
declare
  v_areas text;
  v_mudaram int;
  v_erradas int;
  v_menu json;
  v_no_menu int;
begin
  select string_agg("CO_AREA", ',' order by "CO_AREA") into v_areas
    from public."RL_ABA_AREA" where "CO_ABA" = 'mapa' and "ST_ATIVO" = 'S';
  if v_areas is distinct from 'saude-indigena' then
    raise exception 'O Mapa deveria estar só na Saúde Indígena (está em %).', v_areas;
  end if;

  select count(*) filter (where a."NU_ORDEM" <> e."NU_ORDEM"),
         count(*) filter (where a."NU_ORDEM" <> e."NU_ORDEM" + case when e."NU_ORDEM" >= 2 then 1 else 0 end)
    into v_mudaram, v_erradas
    from public."TB_ABA" a
    join ensaio_ordem_antes e using ("CO_ABA");
  if v_erradas <> 0 then
    raise exception 'Abas com a ordem errada depois da mudança: %.', v_erradas;
  end if;

  -- O menu: o Mapa aparece uma vez, na ordem 2, com a Saúde Indígena como única área.
  v_menu := public.listar_abas_do_menu();
  select count(*) into v_no_menu
    from json_array_elements(v_menu) aba
   where aba ->> 'co_aba' = 'mapa'
     and (aba ->> 'nu_ordem')::int = 2
     and json_array_length(aba -> 'areas') = 1
     and aba -> 'areas' -> 0 ->> 'co_area' = 'saude-indigena';
  if v_no_menu <> 1 then
    raise exception 'O Mapa deveria aparecer uma vez no menu, na ordem 2, só na Saúde Indígena (aparece %).', v_no_menu;
  end if;

  raise notice 'Ok: % abas desceram uma posição; Mapa em %; menu com o Mapa.', v_mudaram, v_areas;
end;
$confere$;

do $ok$ begin raise notice 'Ensaio 20261118160000 ok'; end; $ok$;

rollback;
