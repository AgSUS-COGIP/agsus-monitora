/*
  ROLLBACK de migrations/20260928235000_anexos_so_admin.sql
  Devolve as duas RPCs aos corpos de 20260928200000: contratador e admin anexam
  e removem.
*/
begin;

create or replace function public.registrar_anexo_candidato_aprovado(
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

create or replace function public.remover_anexo_candidato_aprovado(p_anexo_id uuid)
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

commit;
