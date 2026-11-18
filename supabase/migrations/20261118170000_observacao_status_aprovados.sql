-- Observação interna ao alterar status de candidatos aprovados.
-- As RPCs existentes continuam funcionando para versões anteriores do front.
alter table public."TB_CANDIDATO_APROVADO"
  add column if not exists observacao_status text;

create or replace function public.ler_observacao_status_aprovado(
  p_candidato_id uuid
) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_observacao text;
begin
  if (select auth.uid()) is null or not private.pode_recurso('aprovados', 1) then
    raise exception 'Sem permissão para consultar observação' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(
    (select l.edital_id from public."TB_CANDIDATO_APROVADO" c
     join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
     where c.id = p_candidato_id and c.removido_em is null and l.vigente is true)
  );
  select c.observacao_status into v_observacao
  from public."TB_CANDIDATO_APROVADO" c
  join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
  where c.id = p_candidato_id and c.removido_em is null and l.vigente is true;
  if not found then raise exception 'Candidato não encontrado' using errcode = '22023'; end if;
  return v_observacao;
end;
$$;

create or replace function public.alterar_status_aprovado_com_observacao(
  p_candidato_id uuid,
  p_status text,
  p_processo_sei text default null,
  p_matricula text default null,
  p_data_convocacao date default null,
  p_observacao text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_resultado jsonb;
  v_observacao text := nullif(btrim(coalesce(p_observacao, '')), '');
begin
  if length(coalesce(v_observacao, '')) > 2000 then
    raise exception 'A observação deve ter no máximo 2000 caracteres' using errcode = '22023';
  end if;
  -- A RPC anterior faz todas as verificações de perfil, área, edital e status.
  -- Ambas as alterações são atômicas na mesma transação.
  v_resultado := public.alterar_status_candidato_aprovado(
    p_candidato_id, p_status, p_processo_sei, p_matricula, p_data_convocacao
  );
  update public."TB_CANDIDATO_APROVADO"
     set observacao_status = v_observacao
   where id = p_candidato_id and removido_em is null;
  return v_resultado;
end;
$$;

revoke all on function public.ler_observacao_status_aprovado(uuid) from public, anon;
revoke all on function public.alterar_status_aprovado_com_observacao(uuid,text,text,text,date,text) from public, anon;
grant execute on function public.ler_observacao_status_aprovado(uuid) to authenticated;
grant execute on function public.alterar_status_aprovado_com_observacao(uuid,text,text,text,date,text) to authenticated;
