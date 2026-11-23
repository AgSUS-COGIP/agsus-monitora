/*
  ENSAIO de 20261123180000_aba_paineis_vira_relatorios: roda a migration inteira dentro de uma transação, confere o resultado
  e desfaz (rollback). Não grava nada. Rode no SQL Editor antes de aplicar; qualquer
  conferência que falhe aborta com a mensagem do que deu errado.

  O trecho entre "MIGRATION" e "CONFERÊNCIAS" é o corpo da migration, sem mudança
  (tests/repositorio-e-banco.test.ts, bloco `aba-relatorios-no-banco`, confere).
*/
begin;

create temp table antes_do_ensaio on commit drop as
select "CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA"
  from public."TB_ABA";

-- MIGRATION ------------------------------------------------------------------------------------

set local lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'paineis-de-dados') then
    raise exception 'A aba paineis-de-dados não existe; confira o banco antes de aplicar.';
  end if;
end;
$$;

-- O nome no menu. Código, view, recurso, ícone e ordem não mudam.
update public."TB_ABA"
   set "NO_ABA" = 'Relatórios',
       "DT_ATUALIZACAO" = now()
 where "CO_ABA" = 'paineis-de-dados'
   and "NO_ABA" is distinct from 'Relatórios';

-- CONFERÊNCIAS ---------------------------------------------------------------------------------

do $$
declare
  v_menu json := public.listar_abas_do_menu();
begin
  if (select "NO_ABA" from public."TB_ABA" where "CO_ABA" = 'paineis-de-dados') <> 'Relatórios' then
    raise exception 'A aba paineis-de-dados não ficou com o nome Relatórios.';
  end if;
  -- Só o nome dessa aba mudou.
  if exists (
    select 1
      from public."TB_ABA" b
      join antes_do_ensaio a using ("CO_ABA")
     where (b."CO_ABA" <> 'paineis-de-dados' and b."NO_ABA" is distinct from a."NO_ABA")
        or (b."DS_ICONE", b."NU_ORDEM", b."CO_VIEW", b."CO_RECURSO", b."TP_ABA", b."ST_ATIVO", b."ST_BETA")
           is distinct from (a."DS_ICONE", a."NU_ORDEM", a."CO_VIEW", a."CO_RECURSO", a."TP_ABA", a."ST_ATIVO", a."ST_BETA")
  ) or (select count(*) from public."TB_ABA") <> (select count(*) from antes_do_ensaio) then
    raise exception 'A migration mudou mais do que o nome da aba.';
  end if;
  -- O menu entrega o nome novo, com a mesma view e o mesmo recurso.
  if not exists (
    select 1 from json_array_elements(v_menu) e
     where e->>'co_aba' = 'paineis-de-dados'
       and e->>'no_aba' = 'Relatórios'
       and e->>'co_view' = 'paineis-de-dados'
       and e->>'co_recurso' = 'paineis_dados'
  ) then
    raise exception 'listar_abas_do_menu não devolve a aba Relatórios como esperado.';
  end if;
  raise notice 'Ensaio de 20261123180000_aba_paineis_vira_relatorios: tudo conferido.';
end;
$$;

rollback;
