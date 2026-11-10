-- Ensaio transacional: nenhuma alteracao persiste.
-- Requer operador do banco e perfis existentes; nao cria usuarios.
-- Reprova se a resposta da funcao divergir da regra de quem grava o
-- resultado, se algum perfil inativo puder importar ou se anon puder chamar.
begin;
set local statement_timeout = '25s';
set local lock_timeout = '3s';

create or replace function public.pode_importar_anexos_do_edital()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2);
$$;
revoke all on function public.pode_importar_anexos_do_edital() from public, anon;
grant execute on function public.pode_importar_anexos_do_edital() to authenticated;

do $ensaio$
declare
  p record;
  esperado boolean;
  visto boolean;
  sim integer := 0;
  n integer := 0;
begin
  if has_function_privilege('anon', 'public.pode_importar_anexos_do_edital()', 'execute') then
    raise exception 'anon pode chamar a funcao';
  end if;
  for p in select u.user_id, u.ativo from public."TB_PERFIL_USUARIO" u where u.user_id is not null loop
    perform set_config('request.jwt.claim.sub', p.user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', p.user_id, 'role', 'authenticated')::text, true);
    esperado := private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2);
    execute 'set local role authenticated';
    visto := public.pode_importar_anexos_do_edital();
    execute 'reset role';
    if visto is distinct from esperado then
      raise exception 'Resposta divergente da regra: esperado %, observado %', esperado, visto;
    end if;
    if visto and p.ativo is not true then
      raise exception 'Perfil inativo poderia importar';
    end if;
    if visto then sim := sim + 1; end if;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Ensaio inconclusivo: nenhum perfil disponivel'; end if;
  raise notice 'Ensaio ok: % perfil(is) conferido(s), % pode(m) importar', n, sim;
end $ensaio$;

rollback;
