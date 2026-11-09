-- Ensaio transacional: nenhuma alteracao persiste e nenhum arquivo e baixado.
-- Requer operador do banco e perfis existentes; nao cria usuarios de producao.
begin;
set local statement_timeout = '25s';
set local lock_timeout = '3s';

drop policy if exists "PL_STORAGE_LISTAS_ESCOPO_EDITAL" on storage.objects;
create policy "PL_STORAGE_LISTAS_ESCOPO_EDITAL"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id <> 'listas-aprovados'
  or (select private.is_master())
  or exists (
    select 1 from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id::text = pg_catalog.split_part(storage.objects.name, '/', 1)
  )
)
with check (
  bucket_id <> 'listas-aprovados'
  or (select private.is_master())
  or exists (
    select 1 from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id::text = pg_catalog.split_part(storage.objects.name, '/', 1)
  )
);

do $ensaio$
declare
  p record;
  esperado integer;
  visto integer;
  total integer;
  n integer := 0;
begin
  select count(*) into total from storage.objects where bucket_id = 'listas-aprovados';
  for p in select u.user_id from public."TB_PERFIL_USUARIO" u where u.ativo and u.user_id is not null loop
    perform set_config('request.jwt.claim.sub', p.user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', p.user_id, 'role', 'authenticated')::text, true);
    if not (private.pode_recurso('aprovados') or private.pode_recurso('importacao', 2)) then
      esperado := 0;
    elsif private.is_master() then
      esperado := total;
    else
      select count(*) into esperado
      from storage.objects o
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = split_part(o.name, '/', 1)
      where o.bucket_id = 'listas-aprovados'
        and m."CO_AREA" = any(private."FC_AREAS_USUARIO"())
        and (private."FC_EDITAIS_VISIVEIS"() is null or m.id = any(private."FC_EDITAIS_VISIVEIS"()));
    end if;
    execute 'set local role authenticated';
    select count(*) into visto from storage.objects where bucket_id = 'listas-aprovados';
    execute 'reset role';
    if esperado <> visto then
      raise exception 'Escopo divergente no perfil testado: esperado %, observado %', esperado, visto;
    end if;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Ensaio inconclusivo: nenhum perfil disponivel'; end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
  execute 'set local role authenticated';
  if exists(select 1 from storage.objects where bucket_id = 'listas-aprovados') then
    raise exception 'Sessao sem perfil conseguiu ler listas';
  end if;
  execute 'reset role';
  if (select count(*) from storage.objects where bucket_id = 'listas-aprovados') <> total then
    raise exception 'Quantidade de documentos alterada';
  end if;
  raise notice 'Ensaio aprovado: % perfis; documentos preservados: %', n, total;
end $ensaio$;
rollback;
