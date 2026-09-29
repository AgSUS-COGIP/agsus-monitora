-- Volta à lista de aprovados sem área (formato 1), sem pacote pronto e sem o
-- agendamento. listar_candidatos_aprovados_compacto() volta à definição lida do
-- banco em 29/09/2026 (com o recorte por coordenação aplicado fora do repositório).
-- O front novo continua funcionando: sem p_area no banco (PGRST202), ele chama a
-- função sem argumentos.
begin;

do $$
declare
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'agsus_aprovados_cache_por_area';
  if v_id is not null then
    perform cron.unschedule(v_id);
  end if;
end;
$$;

drop function public.listar_candidatos_aprovados_compacto(text, text);
drop function public.atualizar_cache_aprovados_vencidos();
drop function public.atualizar_cache_aprovados(text);
drop function private."FC_MONTAR_APROVADOS_AREA"(text, uuid[]);
drop function private."FC_VERSAO_APROVADOS_AREA"(text);
drop table private."TA_CANDIDATO_APROVADO_AREA";

CREATE OR REPLACE FUNCTION public.listar_candidatos_aprovados_compacto()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_listas json;
  v_linhas json;
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('aprovados') = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;

  -- Dados da lista vão uma vez por lista (≈110), não repetidos em cada candidato.
  select coalesce(json_object_agg(l.id, json_build_array(
           l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em
         )), '{}'::json)
    into v_listas
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

  select coalesce(json_agg(json_build_array(
           c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
           c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
         ) order by m.edital, c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
    into v_linhas
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
    and c.removido_em is null;

  return json_build_object(
    'colunas_da_lista', json_build_array(
      'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
    ),
    'listas', v_listas,
    'colunas', json_build_array(
      'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
      'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
      'codigo_vaga'
    ),
    'linhas', v_linhas,
    'total', json_array_length(v_linhas)
  );
end;
$function$;

comment on function public.listar_candidatos_aprovados_compacto() is
  'Candidatos vigentes das listas de aprovados numa chamada só (listas uma vez + linhas posicionais). Mesma permissão e recorte por área de listar_candidatos_aprovados.';

revoke all on function public.listar_candidatos_aprovados_compacto() from public, anon;
grant execute on function public.listar_candidatos_aprovados_compacto() to authenticated, service_role;

commit;
