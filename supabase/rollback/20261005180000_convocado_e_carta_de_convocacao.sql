-- Desfaz 20261005180000_convocado_e_carta_de_convocacao: o status Convocado (com a data) e a
-- carta de convocação (modelos, versões, emissões).
-- ATENÇÃO: apaga os modelos da carta, as versões e o registro das cartas emitidas, e a data da
-- convocação dos candidatos. Quem estiver como Convocado volta a SEM STATUS (o histórico
-- TH_CANDIDATO_APROVADO guarda a passagem, sem a data). "Fim de Fila" volta a ser aceito e
-- alterar_status_candidato_aprovado volta ao corpo de 20260930200000 (4 argumentos).
begin;

drop function if exists public.listar_convocacoes_aprovados(text);
drop function if exists public.listar_cartas_do_candidato(uuid);
drop function if exists public.registrar_carta_convocacao(uuid, integer, uuid[], text, text, jsonb);
drop function if exists public.definir_modelo_carta_ativo(uuid, boolean, text);
drop function if exists public.salvar_modelo_carta_convocacao(uuid, text, uuid, jsonb, integer, text);
drop function if exists public.listar_modelos_carta_convocacao(text);
drop function if exists public.marcar_candidatos_convocados(uuid[], date, uuid);
drop function if exists public.alterar_status_candidato_aprovado(uuid, text, text, text, date);

-- Convocado não existe antes desta migration.
update public."TB_CANDIDATO_APROVADO"
   set status = null, "DT_CONVOCACAO" = null, updated_at = now()
 where status = 'Convocado';

alter table public."TH_CANDIDATO_APROVADO" drop constraint if exists "FK_CARTACONVOC_HISTCANDAPROV";
drop index if exists public."IN_FKHISTCANDAPROV_CARTA";
alter table public."TH_CANDIDATO_APROVADO"
  drop column if exists "CO_CARTA_CONVOCACAO",
  drop column if exists "DT_CONVOCACAO";

drop table if exists public."RL_CARTA_CANDIDATO";
drop table if exists public."TH_CARTA_CONVOCACAO";
drop table if exists public."TH_MODELO_CARTA_CONVOCACAO";
drop table if exists public."TB_MODELO_CARTA_CONVOCACAO";

drop trigger if exists "TG_CANDAPROVADO_CONVOCACAO" on public."TB_CANDIDATO_APROVADO";
drop function if exists private."FC_TG_HERDAR_CONVOCACAO"();

alter table public."TB_CANDIDATO_APROVADO" drop constraint if exists "CK_CANDAPROVADO_DTCONVOCACAO";
drop index if exists public."IN_CANDAPROVADO_DTCONVOCACAO";
alter table public."TB_CANDIDATO_APROVADO" drop column if exists "DT_CONVOCACAO";
alter table public."TB_CANDIDATO_APROVADO" drop constraint if exists "CK_CANDIDATO_APROVADO_STATUS";
alter table public."TB_CANDIDATO_APROVADO"
  add constraint "CK_CANDIDATO_APROVADO_STATUS" check (
    status is null
    or status in ('Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada', 'Fim de Fila')
  );
comment on column public."TB_CANDIDATO_APROVADO".status is
  'Situacao do candidato. Fim de Fila: pediu posicionamento no final da lista (edital FCC 125, item 13.7) - continua convocavel, mas depois de todos os outros.';

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
revoke all on function public.alterar_status_candidato_aprovado(uuid, text, text, text) from public, anon;
grant execute on function public.alterar_status_candidato_aprovado(uuid, text, text, text) to authenticated;

commit;
