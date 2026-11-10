-- Ensaio transacional: nenhuma alteracao persiste e nenhum arquivo e baixado.
-- Requer operador do banco e perfis existentes; nao cria usuarios.
-- Mostra o estado do bucket (publico? quantos arquivos?) e reprova se algum
-- perfil ativo que nao e administrador global ainda enxergar arquivo dele, ou
-- se a politica mudar o que se ve nos outros buckets.
begin;
set local statement_timeout = '25s';
set local lock_timeout = '3s';

do $estado$
declare
  publico boolean;
  arquivos integer;
begin
  select b.public into publico from storage.buckets b where b.id = 'cronogramas-editais';
  select count(*) into arquivos from storage.objects where bucket_id = 'cronogramas-editais';
  raise notice 'Bucket cronogramas-editais: existe=%, publico=%, arquivos=%', publico is not null, publico, arquivos;
  if publico then
    raise warning 'Bucket publico: a URL publica nao passa pela RLS. Avaliar tornar privado em mudanca separada.';
  end if;
end $estado$;

create temporary table ensaio_outros_buckets on commit drop as
select null::uuid as user_id, 0 as vistos limit 0;

-- Antes: quanto cada perfil ve fora do bucket.
do $antes$
declare
  p record;
  vistos integer;
begin
  for p in select u.user_id from public."TB_PERFIL_USUARIO" u where u.ativo and u.user_id is not null loop
    perform set_config('request.jwt.claim.sub', p.user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', p.user_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into vistos from storage.objects where bucket_id <> 'cronogramas-editais';
    execute 'reset role';
    insert into ensaio_outros_buckets values (p.user_id, vistos);
  end loop;
end $antes$;

drop policy if exists "PL_STORAGE_CRONOGRAMAS_SO_ADMIN" on storage.objects;
create policy "PL_STORAGE_CRONOGRAMAS_SO_ADMIN"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id <> 'cronogramas-editais'
  or (select private.is_master())
)
with check (
  bucket_id <> 'cronogramas-editais'
  or (select private.is_master())
);

do $depois$
declare
  p record;
  mestre boolean;
  no_bucket integer;
  fora integer;
  total integer;
  n integer := 0;
begin
  select count(*) into total from storage.objects where bucket_id = 'cronogramas-editais';
  for p in select e.user_id, e.vistos from ensaio_outros_buckets e loop
    perform set_config('request.jwt.claim.sub', p.user_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', p.user_id, 'role', 'authenticated')::text, true);
    mestre := private.is_master();
    execute 'set local role authenticated';
    select count(*) into no_bucket from storage.objects where bucket_id = 'cronogramas-editais';
    select count(*) into fora from storage.objects where bucket_id <> 'cronogramas-editais';
    execute 'reset role';
    if not mestre and no_bucket <> 0 then
      raise exception 'Perfil sem administracao global ainda ve % arquivo(s) do bucket', no_bucket;
    end if;
    if fora <> p.vistos then
      raise exception 'A politica mudou outros buckets: antes %, depois %', p.vistos, fora;
    end if;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'Ensaio inconclusivo: nenhum perfil disponivel'; end if;
  raise notice 'Ensaio ok: % perfil(is) conferido(s), % arquivo(s) no bucket', n, total;
end $depois$;

rollback;
