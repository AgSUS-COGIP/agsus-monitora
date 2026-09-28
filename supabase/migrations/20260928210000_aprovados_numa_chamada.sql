/*
  Lista de aprovados numa chamada só.

  A tela pedia `listar_candidatos_aprovados` em páginas de 1.000 (≈16 pedidos,
  6 de cada vez). O PostgREST aplica o recorte da página DEPOIS da função, então
  cada página refazia a consulta inteira (≈20 mil candidatos, junção e ordenação):
  a função virou a que mais consome o banco (16 mil chamadas, 55 min acumulados)
  e, com vários acessos juntos, deixava o banco todo lento.

  `listar_candidatos_aprovados_compacto()` monta a lista UMA vez e devolve
  colunas + linhas posicionais, com os dados de cada lista uma vez só. Mesma permissão e
  mesmo recorte por área da função antiga, que continua existindo para o front
  publicado até o deploy.
*/
begin;

create function public.listar_candidatos_aprovados_compacto()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[]);

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
