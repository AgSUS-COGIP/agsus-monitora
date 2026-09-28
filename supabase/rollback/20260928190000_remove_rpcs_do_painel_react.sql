-- Recria as RPCs do painel React (cópia de 20260928160000_analises_por_area.sql, branch feat/analises-por-area).
/*
  ANÁLISES POR ÁREA — leitura do painel novo (src/componentes/analises-da-area/)

  Depende de 20260928140000_sync_de_analises_por_planilha.sql (colunas
  experiencia_profissional_* e "CO_PLANILHA") e de 20260925181000 ("CO_AREA"
  e os auxiliares de área).

  Duas RPCs de LEITURA, SECURITY DEFINER de `postgres`, search_path vazio:

  1. get_analises_da_area(p_area, p_scope)
     Todas as análises de UMA área, em formato posicional (columns[] +
     rows[][]), como get_analises_dashboard_payload_v2: o nome de cada coluna
     vai uma vez só, não uma vez por linha. Sem o texto da análise (`analise`,
     ~480 caracteres por linha na Saúde Indígena: ~3 MB a mais nas ~6,7 mil
     ativas); ele vem pela RPC 2, quando o detalhe abre.
     Município e UF saem do nome da vaga ("… UBS móvel Seropédica/RJ …"), com
     a expressão `UBS m[óo]vel ([^/]+)/([A-Z]{2})`; sem casamento, nulos.
     `editais` traz os editais da área com a janela de análise.

     Escopo (Situação no painel): 'ativo' = análise ativa E edital ativo (o
     mesmo "ativo" do painel antigo); 'inativo' = o complemento; 'todos'.
     Edital sem cadastro em TB_EDITAL_ANALISE conta como ativo, como na
     VW_ANALISES_DASHBOARD_BASE_TODOS.

  2. get_analise_detalhe_da_area(p_id)
     Uma análise, com o texto e os campos que a lista não traz.

  PERMISSÃO (as duas): recurso 'analises' (private.pode_recurso) E a área —
  master vê todas; os demais, só as de RL_PERFIL_USUARIO_AREA
  (private."FC_PODE_AREA"). Sem isso, 42501. A RLS de TB_ANALISE_CURRICULAR
  não vale aqui (definer com BYPASSRLS), por isso a checagem é explícita.

  NOME: minúsculas, como as outras RPCs chamadas pelo app
  (get_analises_dashboard_payload_v2, listar_etapas_do_cronograma). O prefixo
  MAD "FC_" em maiúsculas fica para os auxiliares internos
  (private."FC_PODE_AREA", public."FC_PLANILHA_DA_ORIGEM_ANALISE"): o contrato
  de RPC do front (src/lib/rpc-contrato.js e scripts/check-rpc-contract.mjs)
  só reconhece nomes [a-z0-9_].

  ROLLBACK: supabase/rollback/20260928160000_analises_por_area.sql
*/
begin;

create function public.get_analises_da_area(p_area text, p_scope text default 'ativo')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
set statement_timeout to '20s'
as $$
declare
  v_area text := btrim(coalesce(p_area, ''));
  v_scope text := lower(btrim(coalesce(p_scope, 'ativo')));
  v_nome_area text;
  v_grupo_norm text;
  v_rows jsonb;
  v_editais jsonb;
  v_columns constant jsonb := jsonb_build_array(
    'id', 'unidade', 'edital', 'codigo_vaga', 'nome_vaga', 'municipio', 'uf',
    'candidato', 'categoria', 'modalidade_concorrencia', 'pcd',
    'status_consolidado', 'etapa', 'responsavel_analise', 'data_analise',
    'nota_final_ajustada', 'pontuacao_escolaridade',
    'pontuacao_cursos_aperfeicoamento', 'pontuacao_experiencia_profissional',
    'pontuacao_criterio_etnico', 'experiencia_saude_indigena_total',
    'experiencia_atencao_basica_total', 'experiencia_profissional_anos',
    'experiencia_profissional_meses', 'experiencia_profissional_dias',
    'experiencia_profissional_total', 'link_pdf', 'pdf_status',
    'origem_arquivo_id', 'ativo', 'updated_at'
  );
begin
  if not private.pode_recurso('analises') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;

  select a."NO_AREA", public.analises_norm_key(a."NO_GRUPO_PLANILHA")
    into v_nome_area, v_grupo_norm
    from public."TB_AREA" a
   where a."CO_AREA" = v_area;
  if v_nome_area is null then
    raise exception 'Área desconhecida: "%".', v_area using errcode = '22023';
  end if;

  if not (private.is_master() or private."FC_PODE_AREA"(v_area)) then
    raise exception 'Sem permissão para as análises desta área' using errcode = '42501';
  end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo inválido. Use ativo, inativo ou todos.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(
    b.id, b.unidade, b.edital, b.codigo_vaga, b.nome_vaga,
    btrim(b.local[1]), b.local[2],
    b.candidato, b.categoria, b.modalidade_concorrencia, b.pcd,
    b.status_consolidado, b.etapa, b.responsavel_analise, b.data_analise,
    b.nota_final_ajustada, b.pontuacao_escolaridade,
    b.pontuacao_cursos_aperfeicoamento, b.pontuacao_experiencia_profissional,
    b.pontuacao_criterio_etnico, b.experiencia_saude_indigena_total,
    b.experiencia_atencao_basica_total, b.experiencia_profissional_anos,
    b.experiencia_profissional_meses, b.experiencia_profissional_dias,
    b.experiencia_profissional_total, b.link_pdf, b.pdf_status,
    b.origem_arquivo_id, b.situacao_ativa, b.updated_at
  ) order by b.unidade, b.edital, b.codigo_vaga, b.candidato), '[]'::jsonb)
  into v_rows
  from (
    select a.*,
           regexp_match(a.nome_vaga, 'UBS m[óo]vel ([^/]+)/([A-Z]{2})') as local,
           (coalesce(a.ativo, false) and coalesce(e.ativo, true)) as situacao_ativa
      from public."TB_ANALISE_CURRICULAR" a
      left join public."TB_EDITAL_ANALISE" e
        on e.grupo_norm = a.grupo_norm
       and e.unidade_norm = a.unidade_norm
       and e.edital_norm = a.edital_norm
     where a."CO_AREA" = v_area
  ) b
  where case v_scope
    when 'ativo' then b.situacao_ativa
    when 'inativo' then not b.situacao_ativa
    else true
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'unidade', e.unidade,
    'edital', e.edital,
    'ativo', e.ativo,
    'data_inicio_analise', e.data_inicio_analise,
    'data_fim_analise', e.data_fim_analise
  ) order by e.unidade, e.edital), '[]'::jsonb)
  into v_editais
  from public."TB_EDITAL_ANALISE" e
  where e.grupo_norm = v_grupo_norm;

  return jsonb_build_object(
    'schema_version', 1,
    'area', v_area,
    'nome_area', v_nome_area,
    'scope', v_scope,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', jsonb_array_length(v_rows),
    'generated_at', now()
  );
end;
$$;

comment on function public.get_analises_da_area(text, text) is
  'Análises de uma área (columns[] + rows[][]), com município/UF do nome da vaga e os editais da área. Exige recurso analises e a área (ou master).';

create function public.get_analise_detalhe_da_area(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_area text;
  v_resultado jsonb;
begin
  if not private.pode_recurso('analises') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;

  select a."CO_AREA" into v_area
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = p_id;
  if not found then
    return null;
  end if;

  if not (private.is_master() or (v_area is not null and private."FC_PODE_AREA"(v_area))) then
    raise exception 'Sem permissão para as análises desta área' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', a.id,
    'area', a."CO_AREA",
    'analise', a.analise,
    'erro_pdf', a.erro_pdf,
    'regime', a.regime,
    'carga_horaria', a.carga_horaria,
    'origem_planilha', a.origem_planilha,
    'linha_origem', a.linha_origem,
    'ultima_atualizacao', a.ultima_atualizacao,
    'data_inicio_analise', e.data_inicio_analise,
    'data_fim_analise', e.data_fim_analise
  )
  into v_resultado
  from public."TB_ANALISE_CURRICULAR" a
  left join public."TB_EDITAL_ANALISE" e
    on e.grupo_norm = a.grupo_norm
   and e.unidade_norm = a.unidade_norm
   and e.edital_norm = a.edital_norm
  where a.id = p_id;

  return v_resultado;
end;
$$;

comment on function public.get_analise_detalhe_da_area(uuid) is
  'Uma análise com o texto e os campos que a lista não traz. Exige recurso analises e a área da análise (ou master).';

alter function public.get_analises_da_area(text, text) owner to postgres;
alter function public.get_analise_detalhe_da_area(uuid) owner to postgres;
revoke all on function public.get_analises_da_area(text, text) from public, anon;
revoke all on function public.get_analise_detalhe_da_area(uuid) from public, anon;
grant execute on function public.get_analises_da_area(text, text) to authenticated;
grant execute on function public.get_analise_detalhe_da_area(uuid) to authenticated;

commit;
