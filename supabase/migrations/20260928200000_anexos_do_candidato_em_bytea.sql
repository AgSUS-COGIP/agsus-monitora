/*
  Anexos do candidato aprovado: o PDF passa a morar no banco (bytea).

  Pedido: preparar a saída do Supabase para um Postgres puro. O Storage é a
  parte que não existe fora do Supabase; com o arquivo numa coluna bytea, a
  tabela TB_ANEXO_CANDIDATO_APROVADO carrega o anexo inteiro e o dump do banco
  leva tudo junto.

  Substitui a parte de Storage de 20260928190000:
  1. TB_ANEXO_CANDIDATO_APROVADO ganha "IM_ARQUIVO" (bytea, o PDF; IM_ é o
     prefixo MAD de imagem ou binário) e perde
     "DS_CAMINHO" (o caminho no bucket). A checagem de conteúdo passa a ser do
     próprio arquivo: começa por %PDF- e tem até 2 MB. Antes o tipo vinha do
     cabeçalho que o navegador mandava.
  2. Saem as políticas e o bucket `anexos-candidatos-aprovados`. Não havia
     nenhum anexo (0 registros, 0 objetos em 28/09/2026), então não há dado a
     mover.
  3. RPCs:
     - listar_anexos_candidatos_aprovados(): só os metadados, sem o arquivo
       (a página lista os anexos de milhares de candidatos);
     - registrar_anexo_candidato_aprovado(p_candidato_id, p_arquivo_nome,
       p_arquivo_base64): recebe o PDF em base64, que é como o JSON do
       PostgREST leva binário;
     - baixar_anexo_candidato_aprovado(p_anexo_id): devolve o PDF em base64,
       um por vez, para quem pode ler a lista de aprovados na área do edital;
     - remover_anexo_candidato_aprovado(p_anexo_id): apaga a linha, e o
       arquivo vai junto.
  Escrita com as regras de antes: aprovados nível 2, perfil contratador ou
  admin, lista vigente e ativa, edital da área do usuário. A trava de status de
  20260928180000 não vale para anexos: o contratador anexa mesmo com status
  definido.

  ROLLBACK: supabase/rollback/20260928200000_anexos_do_candidato_em_bytea.sql
*/
begin;

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
alter table public."TB_ANEXO_CANDIDATO_APROVADO"
  add column "IM_ARQUIVO" bytea not null,
  drop constraint "UK_ANEXO_CANDIDATO_CAMINHO",
  drop column "DS_CAMINHO",
  add constraint "CK_ANEXO_CAND_IMARQUIVO" check (
    octet_length("IM_ARQUIVO") between 5 and 2097152
    and substring("IM_ARQUIVO" from 1 for 5) = '\x255044462d'::bytea
  );

-- Nomes no padrão MAD (seção 8): a PK tinha ficado com o nome automático.
alter table public."TB_ANEXO_CANDIDATO_APROVADO"
  rename constraint "TB_ANEXO_CANDIDATO_APROVADO_pkey" to "PK_ANEXO_CANDIDATO_APROVADO";
alter table public."TB_ANEXO_CANDIDATO_APROVADO"
  rename constraint "CK_ANEXO_CANDIDATO_NOME" to "CK_ANEXO_CAND_NOARQUIVO";
alter table public."TB_ANEXO_CANDIDATO_APROVADO"
  rename constraint "CK_ANEXO_CANDIDATO_TAMANHO" to "CK_ANEXO_CAND_QTTAMANHOBYTES";

-- O PDF já é comprimido: tentar comprimir de novo só gasta CPU.
alter table public."TB_ANEXO_CANDIDATO_APROVADO"
  alter column "IM_ARQUIVO" set storage external;

comment on table public."TB_ANEXO_CANDIDATO_APROVADO" is
  'Documentos PDF anexados a um candidato da lista de aprovados (ate 5 por candidato, 2 MB cada), com o arquivo em IM_ARQUIVO.';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."IM_ARQUIVO" is
  'Conteudo do PDF. Comeca por %PDF- e tem ate 2 MB. Nunca vai na listagem: sai um por vez por baixar_anexo_candidato_aprovado.';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."QT_TAMANHO_BYTES" is
  'Tamanho de IM_ARQUIVO em bytes, gravado junto para a listagem nao precisar ler o arquivo.';

-- ---------------------------------------------------------------------------
-- 2. Storage sai
-- ---------------------------------------------------------------------------
drop policy if exists anexos_candidatos_storage_select on storage.objects;
drop policy if exists anexos_candidatos_storage_insert on storage.objects;
drop policy if exists anexos_candidatos_storage_delete on storage.objects;

/*
  O Supabase pode barrar DELETE direto nas tabelas do Storage. Se barrar, o
  bucket (vazio e sem política, portanto inacessível) fica para ser apagado
  pelo painel, e a migration segue.
*/
do $$
begin
  delete from storage.buckets
   where id = 'anexos-candidatos-aprovados'
     and not exists (
       select 1 from storage.objects where bucket_id = 'anexos-candidatos-aprovados'
     );
exception when others then
  raise notice 'Bucket anexos-candidatos-aprovados nao foi apagado (%). Apague pelo painel do Storage.', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.listar_anexos_candidatos_aprovados();
drop function if exists public.registrar_anexo_candidato_aprovado(uuid, text, text);
drop function if exists public.remover_anexo_candidato_aprovado(uuid);

create function public.listar_anexos_candidatos_aprovados()
returns table(
  anexo_id uuid,
  candidato_id uuid,
  arquivo_nome text,
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
  select a."CO_ANEXO", a."CO_CANDIDATO", a."NO_ARQUIVO",
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
  p_arquivo_base64 text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_nome text := nullif(btrim(coalesce(p_arquivo_nome, '')), '');
  v_arquivo bytea;
  v_ativo boolean;
  v_total integer;
  v_id uuid;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('contratador', 'admin') then
    raise exception 'Perfil sem permissão para anexar documentos';
  end if;
  if v_nome is null or nullif(p_arquivo_base64, '') is null then
    raise exception 'Informe o arquivo do anexo';
  end if;

  begin
    v_arquivo := decode(p_arquivo_base64, 'base64');
  exception when others then
    raise exception 'Arquivo do anexo ilegível';
  end;
  if octet_length(v_arquivo) > 2097152 then
    raise exception 'O anexo deve ter no máximo 2 MB';
  end if;
  if octet_length(v_arquivo) < 5
     or substring(v_arquivo from 1 for 5) <> '\x255044462d'::bytea then
    raise exception 'O anexo deve ser PDF';
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

  insert into public."TB_ANEXO_CANDIDATO_APROVADO"(
    "CO_CANDIDATO", "NO_ARQUIVO", "IM_ARQUIVO", "QT_TAMANHO_BYTES", "CO_USUARIO_INCLUSAO"
  ) values (
    p_candidato_id, v_nome, v_arquivo, octet_length(v_arquivo), (select auth.uid())
  )
  returning "CO_ANEXO" into v_id;

  return jsonb_build_object('ok', true, 'anexo_id', v_id, 'total', v_total + 1);
end;
$function$;

create function public.baixar_anexo_candidato_aprovado(p_anexo_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_nome text;
  v_arquivo bytea;
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  select a."NO_ARQUIVO", a."IM_ARQUIVO" into v_nome, v_arquivo
    from public."TB_ANEXO_CANDIDATO_APROVADO" a
    join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO"
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
   where a."CO_ANEXO" = p_anexo_id
     and l.vigente is true
     and c.removido_em is null
     and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[]);
  if not found then raise exception 'Anexo não encontrado'; end if;

  -- encode quebra a linha a cada 76 caracteres; o navegador quer uma só.
  return jsonb_build_object(
    'arquivo_nome', v_nome,
    'arquivo_base64', translate(encode(v_arquivo, 'base64'), E'\n', '')
  );
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
  v_ativo boolean;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_ANEXO_CANDIDATO_APROVADO" a join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO" join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where a."CO_ANEXO" = p_anexo_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('contratador', 'admin') then
    raise exception 'Perfil sem permissão para remover anexos';
  end if;

  select l.ativo into v_ativo
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

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.listar_anexos_candidatos_aprovados() from public, anon;
revoke all on function public.registrar_anexo_candidato_aprovado(uuid, text, text) from public, anon;
revoke all on function public.baixar_anexo_candidato_aprovado(uuid) from public, anon;
revoke all on function public.remover_anexo_candidato_aprovado(uuid) from public, anon;
grant execute on function public.listar_anexos_candidatos_aprovados() to authenticated;
grant execute on function public.registrar_anexo_candidato_aprovado(uuid, text, text) to authenticated;
grant execute on function public.baixar_anexo_candidato_aprovado(uuid) to authenticated;
grant execute on function public.remover_anexo_candidato_aprovado(uuid) to authenticated;

-- Sem as políticas do Storage, ninguém mais chama; sai junto.
drop function if exists private."FC_CANDIDATO_NA_AREA"(text);

commit;
