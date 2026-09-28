/*
  ROLLBACK de migrations/20260928200000_anexos_do_candidato_em_bytea.sql

  Volta os anexos ao desenho de 20260928190000: arquivo no Storage e caminho
  em "DS_CAMINHO". O conteúdo em bytea não tem para onde ir por SQL (o Storage
  só aceita arquivo pela API), então os anexos gravados são APAGADOS. Exporte
  antes o que precisar (baixar_anexo_candidato_aprovado).

  As seções 2 a 4 abaixo são cópia das de 20260928190000.
*/
begin;

drop function if exists public.baixar_anexo_candidato_aprovado(uuid);
drop function if exists public.listar_anexos_candidatos_aprovados();
drop function if exists public.registrar_anexo_candidato_aprovado(uuid, text, text);
drop function if exists public.remover_anexo_candidato_aprovado(uuid);

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
delete from public."TB_ANEXO_CANDIDATO_APROVADO";
alter table public."TB_ANEXO_CANDIDATO_APROVADO"
  rename constraint "PK_ANEXO_CANDIDATO_APROVADO" to "TB_ANEXO_CANDIDATO_APROVADO_pkey";
alter table public."TB_ANEXO_CANDIDATO_APROVADO"
  rename constraint "CK_ANEXO_CAND_NOARQUIVO" to "CK_ANEXO_CANDIDATO_NOME";
alter table public."TB_ANEXO_CANDIDATO_APROVADO"
  rename constraint "CK_ANEXO_CAND_QTTAMANHOBYTES" to "CK_ANEXO_CANDIDATO_TAMANHO";
alter table public."TB_ANEXO_CANDIDATO_APROVADO"
  drop constraint "CK_ANEXO_CAND_IMARQUIVO",
  drop column "IM_ARQUIVO",
  add column "DS_CAMINHO" text not null,
  add constraint "UK_ANEXO_CANDIDATO_CAMINHO" unique ("DS_CAMINHO");
comment on table public."TB_ANEXO_CANDIDATO_APROVADO" is
  'Documentos PDF anexados a um candidato da lista de aprovados (ate 5 por candidato, 2 MB cada). O arquivo fica no bucket anexos-candidatos-aprovados.';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."DS_CAMINHO" is
  'Caminho do objeto no bucket anexos-candidatos-aprovados; comeca pelo id do candidato.';

-- ---------------------------------------------------------------------------
-- 2. Área do candidato (usada pelas RPCs e pelas políticas do Storage)
-- ---------------------------------------------------------------------------
create function private."FC_CANDIDATO_NA_AREA"(p_candidato text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public."TB_CANDIDATO_APROVADO" c
      join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where c.id::text = p_candidato
       and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
  );
$$;
comment on function private."FC_CANDIDATO_NA_AREA"(text) is
  'Verdadeiro quando o candidato (id como texto) e de edital de area que o usuario logado ve.';
revoke all on function private."FC_CANDIDATO_NA_AREA"(text) from public, anon;
grant execute on function private."FC_CANDIDATO_NA_AREA"(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anexos-candidatos-aprovados', 'anexos-candidatos-aprovados', false, 2097152,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists anexos_candidatos_storage_select on storage.objects;
create policy anexos_candidatos_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'anexos-candidatos-aprovados'
  and private.pode_recurso('aprovados')
  and private."FC_CANDIDATO_NA_AREA"((storage.foldername(name))[1])
);

drop policy if exists anexos_candidatos_storage_insert on storage.objects;
create policy anexos_candidatos_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'anexos-candidatos-aprovados'
  and private.pode_recurso('aprovados', 2)
  and private.papel_recurso('aprovados') in ('contratador', 'admin')
  and private."FC_CANDIDATO_NA_AREA"((storage.foldername(name))[1])
);

drop policy if exists anexos_candidatos_storage_delete on storage.objects;
create policy anexos_candidatos_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'anexos-candidatos-aprovados'
  and private.pode_recurso('aprovados', 2)
  and private.papel_recurso('aprovados') in ('contratador', 'admin')
  and private."FC_CANDIDATO_NA_AREA"((storage.foldername(name))[1])
);

-- ---------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------
create function public.listar_anexos_candidatos_aprovados()
returns table(
  anexo_id uuid,
  candidato_id uuid,
  arquivo_nome text,
  arquivo_path text,
  tamanho integer,
  incluido_em timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  return query
  select a."CO_ANEXO", a."CO_CANDIDATO", a."NO_ARQUIVO", a."DS_CAMINHO",
         a."QT_TAMANHO_BYTES", a."DT_INCLUSAO"
    from public."TB_ANEXO_CANDIDATO_APROVADO" a
    join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO"
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
   where l.vigente is true
     and c.removido_em is null
     and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
   order by a."CO_CANDIDATO", a."DT_INCLUSAO";
end;
$function$;

create function public.registrar_anexo_candidato_aprovado(
  p_candidato_id uuid,
  p_arquivo_nome text,
  p_arquivo_path text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_nome text := nullif(btrim(coalesce(p_arquivo_nome, '')), '');
  v_caminho text := nullif(btrim(coalesce(p_arquivo_path, '')), '');
  v_ativo boolean;
  v_tamanho bigint;
  v_tipo text;
  v_total integer;
  v_id uuid;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('contratador', 'admin') then
    raise exception 'Perfil sem permissão para anexar documentos';
  end if;
  if v_nome is null or v_caminho is null then
    raise exception 'Informe o arquivo do anexo';
  end if;
  if v_caminho not like p_candidato_id::text || '/%' then
    raise exception 'Caminho do anexo não pertence ao candidato';
  end if;

  -- Trava o candidato: dois envios ao mesmo tempo não passam juntos do limite.
  select l.ativo into v_ativo
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
   where c.id = p_candidato_id and c.removido_em is null
   for update of c;
  if not found then raise exception 'Candidato não encontrado'; end if;
  if not v_ativo then
    raise exception 'A lista está inativa e não permite alterar candidatos';
  end if;

  select count(*) into v_total
    from public."TB_ANEXO_CANDIDATO_APROVADO"
   where "CO_CANDIDATO" = p_candidato_id;
  if v_total >= 5 then
    raise exception 'O candidato já tem 5 anexos, o limite';
  end if;

  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype'
    into v_tamanho, v_tipo
    from storage.objects o
   where o.bucket_id = 'anexos-candidatos-aprovados' and o.name = v_caminho;
  if not found then raise exception 'Arquivo do anexo não encontrado no Storage'; end if;
  if coalesce(v_tipo, '') <> 'application/pdf' then
    raise exception 'O anexo deve ser PDF';
  end if;
  if coalesce(v_tamanho, 0) < 1 or v_tamanho > 2097152 then
    raise exception 'O anexo deve ter no máximo 2 MB';
  end if;

  insert into public."TB_ANEXO_CANDIDATO_APROVADO"(
    "CO_CANDIDATO", "NO_ARQUIVO", "DS_CAMINHO", "QT_TAMANHO_BYTES", "CO_USUARIO_INCLUSAO"
  ) values (
    p_candidato_id, v_nome, v_caminho, v_tamanho::integer, (select auth.uid())
  )
  returning "CO_ANEXO" into v_id;

  return jsonb_build_object('ok', true, 'anexo_id', v_id, 'total', v_total + 1);
end;
$function$;

create function public.remover_anexo_candidato_aprovado(p_anexo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_caminho text;
  v_ativo boolean;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_ANEXO_CANDIDATO_APROVADO" a join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO" join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where a."CO_ANEXO" = p_anexo_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('contratador', 'admin') then
    raise exception 'Perfil sem permissão para remover anexos';
  end if;

  select a."DS_CAMINHO", l.ativo into v_caminho, v_ativo
    from public."TB_ANEXO_CANDIDATO_APROVADO" a
    join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO"
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
   where a."CO_ANEXO" = p_anexo_id
   for update of a;
  if not found then raise exception 'Anexo não encontrado'; end if;
  if not v_ativo then
    raise exception 'A lista está inativa e não permite alterar candidatos';
  end if;

  delete from public."TB_ANEXO_CANDIDATO_APROVADO" where "CO_ANEXO" = p_anexo_id;

  return jsonb_build_object('ok', true, 'arquivo_path', v_caminho);
end;
$function$;

revoke all on function public.listar_anexos_candidatos_aprovados() from public, anon;
revoke all on function public.registrar_anexo_candidato_aprovado(uuid, text, text) from public, anon;
revoke all on function public.remover_anexo_candidato_aprovado(uuid) from public, anon;
grant execute on function public.listar_anexos_candidatos_aprovados() to authenticated;
grant execute on function public.registrar_anexo_candidato_aprovado(uuid, text, text) to authenticated;
grant execute on function public.remover_anexo_candidato_aprovado(uuid) to authenticated;

commit;
