/*
  ENSAIO de 20261112180000_vidro_no_painel_de_acesso.sql

  Roda no SQL Editor (papel postgres) ANTES de aplicar. Termina em rollback: nada
  fica no banco. Não mostra dado de pessoa (a função só lê a identidade da tela).

  O que confere:
    A. O corpo vigente é o que a migration conhece (md5 de antes).
    B. Aplica o corpo da migration (igual ao arquivo; o teste confere).
    C. O corpo aplicado tem o md5 esperado; o anon continua podendo chamar a
       função; com o estilo gravado, a resposta traz a chave, e nenhuma chave
       fora da lista aparece.
  Ok = termina com NOTICE "Ensaio 20261112180000 ok" e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.obter_branding_acesso_publico()'))) is distinct from 'aa86cbdf60488563a3c93d6cad3d9a23' then
    raise exception 'obter_branding_acesso_publico não está no corpo que a migration conhece: confira antes de aplicar.';
  end if;
end;
$guarda$;

create or replace function public.obter_branding_acesso_publico()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
 set statement_timeout to '3s'
as $$
  select coalesce(
    jsonb_object_agg(c.chave, c.valor)
      filter (where c.valor is not null and btrim(c.valor) <> ''),
    '{}'::jsonb
  )
  from public."TB_CONFIGURACAO" as c
  where c.chave in (
    'auth_access_background_url',
    'auth_access_logo_url',
    'auth_access_panel_color',
    'auth_access_greeting',
    'auth_access_instruction',
    'auth_google_button_text',
    'auth_access_texto_modo',
    'auth_access_painel_estilo'
  );
$$;

comment on function public.obter_branding_acesso_publico() is 'Identidade da tela de acesso para visitantes não autenticados. Lista de chaves fixa, sem dado de pessoa ou sessão (desde 20261112180000, também o estilo do painel: sólido ou vidro).';

-- Só dentro do ensaio: um estilo gravado para a resposta trazer a chave.
insert into public."TB_CONFIGURACAO"(chave, valor, descricao)
values ('auth_access_painel_estilo', 'vidro', 'Ensaio 20261112180000')
on conflict (chave) do update set valor = excluded.valor;

do $confere$
declare
  v_resposta jsonb := public.obter_branding_acesso_publico();
  v_chave text;
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.obter_branding_acesso_publico()'))) is distinct from '09273be0dc2f3b56b7c7426264afb48c' then
    raise exception 'O corpo aplicado não tem o md5 esperado.';
  end if;
  if not has_function_privilege('anon', 'public.obter_branding_acesso_publico()', 'execute') then
    raise exception 'O anon perdeu o acesso à função.';
  end if;
  if v_resposta ->> 'auth_access_painel_estilo' is distinct from 'vidro' then
    raise exception 'A resposta não trouxe auth_access_painel_estilo.';
  end if;
  for v_chave in select jsonb_object_keys(v_resposta) loop
    if v_chave not in (
      'auth_access_background_url', 'auth_access_logo_url', 'auth_access_panel_color',
      'auth_access_greeting', 'auth_access_instruction', 'auth_google_button_text',
      'auth_access_texto_modo', 'auth_access_painel_estilo'
    ) then
      raise exception 'Chave fora da lista na resposta: %', v_chave;
    end if;
  end loop;
  raise notice 'Ensaio 20261112180000 ok';
end;
$confere$;

rollback;
