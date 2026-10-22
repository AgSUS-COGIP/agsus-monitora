/*
  ENSAIO de 20261022151000_registro_das_migrations_so_com_o_caminho_do_disco.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Confere:
    1. com linhas ainda fora do formato (antes da correção), a regra entra
       NOT VALID e já recusa um caminho novo com "supabase/";
    2. depois da correção (supabase/correcoes/20261022-registro-das-migrations.sql),
       reaplicar a migration valida a regra;
    3. caminho no formato continua entrando; o rollback tira a regra.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 1. A migration, antes da correção.

do $$
declare
  v_fora integer;
begin
  select count(*) into v_fora
    from public.migracoes_aplicadas
   where caminho !~ '^(migrations|correcoes)/[^/]+\.sql$';

  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.migracoes_aplicadas'::regclass
                    and conname = 'ck_migracoes_aplicadas_caminho') then
    if v_fora = 0 then
      alter table public.migracoes_aplicadas
        add constraint ck_migracoes_aplicadas_caminho
        check (caminho ~ '^(migrations|correcoes)/[^/]+\.sql$');
    else
      alter table public.migracoes_aplicadas
        add constraint ck_migracoes_aplicadas_caminho
        check (caminho ~ '^(migrations|correcoes)/[^/]+\.sql$') not valid;
    end if;
  elsif v_fora = 0 then
    alter table public.migracoes_aplicadas validate constraint ck_migracoes_aplicadas_caminho;
  end if;
end;
$$;

comment on constraint ck_migracoes_aplicadas_caminho on public.migracoes_aplicadas is
  'O caminho como o disco o escreve: migrations/<arquivo>.sql ou correcoes/<arquivo>.sql (sem o prefixo supabase/). 20261022151000.';

do $ensaio$
declare
  v_fora integer;
begin
  select count(*) into v_fora from public.migracoes_aplicadas
   where caminho !~ '^(migrations|correcoes)/[^/]+\.sql$';
  assert exists (select 1 from pg_constraint
                  where conrelid = 'public.migracoes_aplicadas'::regclass
                    and conname = 'ck_migracoes_aplicadas_caminho'
                    and convalidated = (v_fora = 0)),
         'a regra não entrou (ou entrou validada com linhas fora do formato)';
  begin
    insert into public.migracoes_aplicadas (caminho, hash, origem)
    values ('supabase/migrations/99999999999999_ensaio.sql', 'x', 'arquivo');
    assert false, 'aceitou caminho com supabase/';
  exception when check_violation then
    null;
  end;
end;
$ensaio$;

-- 2. A correção (corpo de supabase/correcoes/20261022-registro-das-migrations.sql) e a migration de novo.

-- 1a. Já existe a mesma migration sem o prefixo, com o mesmo hash: sai a com prefixo.
delete from public.migracoes_aplicadas a
 using public.migracoes_aplicadas b
 where a.caminho like 'supabase/%'
   and b.caminho = substr(a.caminho, length('supabase/') + 1)
   and b.hash = a.hash;

-- 1b. As demais perdem o prefixo "supabase/".
update public.migracoes_aplicadas a
   set caminho = substr(a.caminho, length('supabase/') + 1)
 where a.caminho like 'supabase/%'
   and not exists (select 1 from public.migracoes_aplicadas b
                    where b.caminho = substr(a.caminho, length('supabase/') + 1));

-- 2. A órfã sem arquivo e sem efeito (desfeita pela 20260928190000).
delete from public.migracoes_aplicadas
 where caminho = 'migrations/20260928160000_analises_por_area.sql'
   and to_regprocedure('public.get_analises_da_area(text, text)') is null
   and to_regprocedure('public.get_analise_detalhe_da_area(uuid)') is null;

-- Conferência (esperado: 0 com prefixo, 0 fora do formato, órfã 0).
select count(*) filter (where caminho like 'supabase/%') as com_prefixo,
       count(*) filter (where caminho !~ '^(migrations|correcoes)/[^/]+\.sql$') as fora_do_formato,
       count(*) filter (where caminho = 'migrations/20260928160000_analises_por_area.sql') as orfa,
       count(*) as total
  from public.migracoes_aplicadas;


do $$
declare
  v_fora integer;
begin
  select count(*) into v_fora
    from public.migracoes_aplicadas
   where caminho !~ '^(migrations|correcoes)/[^/]+\.sql$';

  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.migracoes_aplicadas'::regclass
                    and conname = 'ck_migracoes_aplicadas_caminho') then
    if v_fora = 0 then
      alter table public.migracoes_aplicadas
        add constraint ck_migracoes_aplicadas_caminho
        check (caminho ~ '^(migrations|correcoes)/[^/]+\.sql$');
    else
      alter table public.migracoes_aplicadas
        add constraint ck_migracoes_aplicadas_caminho
        check (caminho ~ '^(migrations|correcoes)/[^/]+\.sql$') not valid;
    end if;
  elsif v_fora = 0 then
    alter table public.migracoes_aplicadas validate constraint ck_migracoes_aplicadas_caminho;
  end if;
end;
$$;

comment on constraint ck_migracoes_aplicadas_caminho on public.migracoes_aplicadas is
  'O caminho como o disco o escreve: migrations/<arquivo>.sql ou correcoes/<arquivo>.sql (sem o prefixo supabase/). 20261022151000.';

do $ensaio$
begin
  assert exists (select 1 from pg_constraint
                  where conrelid = 'public.migracoes_aplicadas'::regclass
                    and conname = 'ck_migracoes_aplicadas_caminho'
                    and convalidated),
         'a regra não foi validada depois da correção';
  insert into public.migracoes_aplicadas (caminho, hash, origem)
  values ('migrations/99999999999999_ensaio.sql', 'x', 'arquivo');
end;
$ensaio$;

-- 3. O rollback.
alter table public.migracoes_aplicadas drop constraint if exists ck_migracoes_aplicadas_caminho;

do $ensaio$
begin
  assert not exists (select 1 from pg_constraint
                      where conrelid = 'public.migracoes_aplicadas'::regclass
                        and conname = 'ck_migracoes_aplicadas_caminho'),
         'o rollback não tirou a regra';
end;
$ensaio$;

select 'ensaio ok' as resultado;

rollback;
