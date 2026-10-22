-- Desfaz 20260930235000: volta listar_editais_entrevista(p_area) com todos os editais ativos (versão de 20260930230000).
begin;
drop function if exists public.listar_editais_entrevista(text, boolean);
drop function if exists public.liberar_entrevista_edital(uuid, date, text);
drop function if exists private."FC_JANELA_ENTREVISTA"(uuid);
drop table if exists public."TB_ENTREVISTA_LIBERACAO";
create function public.listar_editais_entrevista(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('entrevistas', 1) then
    raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];
  return coalesce((
    select json_agg(json_build_object(
        'id', m.id, 'edital', m.edital, 'unidade', m.unidade,
        'configurado', exists (select 1 from public."TB_ENTREVISTA_EDITAL" c where c."CO_MONITORAMENTO" = m.id),
        'convocados', (select count(*) from public."TB_ENTREVISTA" e
                         where e."CO_MONITORAMENTO" = m.id and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'))
        order by m.edital)
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m."CO_AREA" = p_area and m.ativo
       and (v_editais is null or m.id = any (v_editais))), '[]'::json);
end;
$function$;
comment on function public.listar_editais_entrevista(text) is 'Editais ativos da área (recorte da coordenação) para conduzir entrevistas, com configurado e convocados. entrevistas >= leitor.';
revoke all on function public.listar_editais_entrevista(text) from public, anon;
grant execute on function public.listar_editais_entrevista(text) to authenticated, service_role;
commit;
