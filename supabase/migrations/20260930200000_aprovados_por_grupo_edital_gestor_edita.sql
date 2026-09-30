/*
  Lista de aprovados pelas permissões de grupo; Edital gestor edita.

  Pedido de 30/09: o Edital gestor precisa editar a Lista de aprovados, desde
  que tenha acesso (área / edital). A tela já seguia o grupo
  (canChangeCandidateStatus = aprovados >= editor), mas o banco barrava por
  papel fixo ("contratador" ou "admin") — barrava até o Coordenador, que já é
  editor — e alterar_status_candidato_aprovado nem conferia a área.

  - TA_GRUPO_ACESSO_RECURSO: edital_gestor em 'aprovados' passa a editor.
  - alterar_status_candidato_aprovado: área/edital (FC_EXIGIR_AREA_EDITAL) +
    aprovados >= editor; mudar status já definido: aprovados = admin.
  - incluir/remover_sub_judice: sem o papel fixo (já exigiam editor e área).
  - registrar/remover_anexo_candidato_aprovado: aprovados = admin (a regra da
    tela, canManageCandidateAttachments), no lugar do papel fixo.
  Corpos: definições vivas + estas trocas.

  Rollback: supabase/rollback/20260930200000_aprovados_por_grupo_edital_gestor_edita.sql
*/
begin;

update public."TA_GRUPO_ACESSO_RECURSO" set "TP_NIVEL" = 'editor'
 where "CO_GRUPO_ACESSO" = 'edital_gestor' and "NO_RECURSO" = 'aprovados';

CREATE OR REPLACE FUNCTION public.alterar_status_candidato_aprovado(p_candidato_id uuid, p_status text, p_processo_sei text DEFAULT NULL::text, p_matricula text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.monitora_role();
  v_candidato public."TB_CANDIDATO_APROVADO"%rowtype;
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
begin
  -- Quem edita a Lista de aprovados (grupo ou exceção) e tem a área/edital.
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c
                                             join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
                                            where c.id = p_candidato_id));
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Perfil sem permissao para alterar status' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in (
    'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada', 'Fim de Fila'
  ) then
    raise exception 'Status invalido';
  end if;

  if v_status in ('Contratado', 'Migração') and v_matricula is null then
    raise exception 'Matricula obrigatoria para Contratado ou Migracao';
  end if;

  select * into v_candidato
  from public."TB_CANDIDATO_APROVADO"
  where id = p_candidato_id and removido_em is null
  for update;
  if not found then raise exception 'Candidato nao encontrado'; end if;

  if not private.pode_recurso('aprovados', 3) and v_candidato.status is not null then
    raise exception 'O status deste candidato ja foi definido. Somente admin pode altera-lo';
  end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where id = v_candidato.lista_id and vigente is true
  for update;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  if not v_lista.ativo then
    raise exception 'A lista esta inativa e nao permite alterar candidatos';
  end if;

  insert into public."TH_CANDIDATO_APROVADO"(
    candidato_id, lista_id, status_anterior, status_novo,
    processo_sei, matricula, alterado_por
  ) values (
    v_candidato.id, v_candidato.lista_id, v_candidato.status, v_status,
    nullif(btrim(coalesce(p_processo_sei, '')), ''), v_matricula,
    (select auth.uid())
  );

  update public."TB_CANDIDATO_APROVADO"
  set status = v_status,
      processo_sei = nullif(btrim(coalesce(p_processo_sei, '')), ''),
      matricula = case
        when v_status in ('Contratado', 'Migração') then v_matricula
        else null
      end,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = v_candidato.id;

  return jsonb_build_object(
    'ok', true,
    'candidato_id', v_candidato.id,
    'status', v_status,
    'matricula', v_matricula
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.incluir_sub_judice(p_edital_id text, p_cargo text, p_nome text, p_nota numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_candidato_id uuid;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id);
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_cargo, '')), '') is null then raise exception 'Cargo obrigatorio'; end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null then raise exception 'Nome obrigatorio'; end if;
  if p_nota is null or p_nota < 0 then raise exception 'Nota invalida'; end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where edital_id = p_edital_id and vigente is true
  for update;
  if not found then raise exception 'O edital ainda nao possui lista vigente'; end if;
  if not v_lista.ativo then raise exception 'A lista esta inativa e nao permite incluir sub judice'; end if;

  if not exists (
    select 1 from public."TB_CANDIDATO_APROVADO"
    where lista_id = v_lista.id and removido_em is null and cargo = btrim(p_cargo)
  ) then
    raise exception 'Cargo nao pertence a lista vigente deste edital';
  end if;

  insert into public."TB_CANDIDATO_APROVADO"(
    lista_id, cargo, nota, nome, sub_judice, created_by, updated_by
  ) values (
    v_lista.id, btrim(p_cargo), p_nota, btrim(p_nome), true,
    (select auth.uid()), (select auth.uid())
  ) returning id into v_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', v_candidato_id, 'lista_id', v_lista.id, 'sub_judice', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.remover_sub_judice(p_candidato_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_lista_id uuid;
  v_ativo boolean;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  select c.lista_id, l.ativo into v_lista_id, v_ativo
  from public."TB_CANDIDATO_APROVADO" c
  join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
  where c.id = p_candidato_id and c.sub_judice is true and c.removido_em is null
  for update of c, l;
  if not found then raise exception 'Candidato sub judice vigente nao encontrado'; end if;
  if not v_ativo then raise exception 'A lista esta inativa e nao permite remover sub judice'; end if;

  update public."TB_CANDIDATO_APROVADO"
  set removido_em = now(), removido_por = (select auth.uid()),
      updated_by = (select auth.uid()), updated_at = now()
  where id = p_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', p_candidato_id, 'lista_id', v_lista_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_anexo_candidato_aprovado(p_candidato_id uuid, p_arquivo_nome text, p_arquivo_base64 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Anexos: só o admin do módulo (mesma regra da tela, canManageCandidateAttachments).
  if not private.pode_recurso('aprovados', 3) then
    raise exception 'Perfil sem permissão para anexar documentos' using errcode = '42501';
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

CREATE OR REPLACE FUNCTION public.remover_anexo_candidato_aprovado(p_anexo_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_ativo boolean;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_ANEXO_CANDIDATO_APROVADO" a join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO" join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where a."CO_ANEXO" = p_anexo_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  -- Anexos: só o admin do módulo (mesma regra da tela, canManageCandidateAttachments).
  if not private.pode_recurso('aprovados', 3) then
    raise exception 'Perfil sem permissão para remover anexos' using errcode = '42501';
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
