/*
  RECORTE POR COORDENAÇÃO NA ABA RECURSOS (permissões, parte 7)

  A aba Recursos (20260929120000_recursos.sql) chegou junto do modelo de coordenações
  (20260929121100_coordenacoes.sql) e só confere a área do edital
  (FC_EXIGIR_RECURSOS_NA_AREA → FC_PODE_AREA). Quem está numa coordenação com
  recorte via e gravava recursos de editais da área inteira.

  Os corpos abaixo são os de 20260929120000_recursos.sql, com uma única troca, gerada por
  script e revisada:
    * get_recursos_da_area: a lista de recursos e a de editais do formulário
      ganham `(FC_EDITAIS_VISIVEIS() is null or m.id = any (FC_EDITAIS_VISIVEIS()))`,
      dentro de `(select …)` (InitPlan). Os cronogramas saem dos recursos já
      recortados.
    * detalhe, busca de candidatos, salvar (cadastro e edição), marcar etapa e
      excluir: depois de FC_EXIGIR_RECURSOS_NA_AREA, o mesmo porteiro das
      demais gravações, FC_EXIGIR_AREA_EDITAL (edital visível pela área e pela
      coordenação; 42501).

  Quem não está em coordenação (ou está numa sem regra e sem editais) recebe
  FC_EDITAIS_VISIVEIS() = null: nada muda. Comentários e grants das funções
  ficam os de 20260929120000_recursos.sql (create or replace os preserva).

  As análises não precisam de nada: 20260929150000_analises_lista_enxuta.sql
  já monta a lista, o detalhe e o texto com o recorte da coordenação.

  ROLLBACK: supabase/rollback/20260929190200_recorte_por_coordenacao_nos_recursos.sql
*/
begin;

-- public.get_recursos_da_area: corpo de 20260929120000_recursos.sql, com o recorte da coordenação.
create or replace function public.get_recursos_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_pode_editar boolean;
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(p_area, 1);
  v_pode_editar := private.pode_recurso('recursos', 2);
  return (
    with recursos as (
      select r.*, m.edital, m.unidade,
             a.candidato, a.id_origem, a.nome_vaga, a.codigo_vaga,
             a.nota_final_ajustada, a.status_consolidado
      from public."TB_RECURSO_CANDIDATO" r
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
      left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
      where m."CO_AREA" = p_area
        and r."ST_ATIVO" = 'S'
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'pode_editar', v_pode_editar,
      'gerado_em', now(),
      'origens', (
        select coalesce(json_agg(json_build_object(
            'id', o."CO_ORIGEM_RECURSO",
            'rotulo', o."NO_ORIGEM_RECURSO",
            'ativo', o."ST_ATIVO" = 'S'
          ) order by o."NU_ORDEM"), '[]'::json)
        from public."TB_ORIGEM_RECURSO" o
      ),
      'editais', case when v_pode_editar then (
        select coalesce(json_agg(json_build_object(
            'id', m.id,
            'edital', m.edital,
            'unidade', m.unidade,
            'status', m.status,
            'tem_analises', exists (
              select 1 from public."TB_ANALISE_CURRICULAR" a
              where a.edital = m.edital and a."CO_AREA" = m."CO_AREA"
            )
          ) order by m.edital), '[]'::json)
        from public."TB_MONITORAMENTO_INDIGENA" m
        where m."CO_AREA" = p_area
          and m.ativo
          and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      ) else '[]'::json end,
      'recursos', (
        select coalesce(json_agg(json_build_object(
            'id', r."CO_RECURSO_CANDIDATO",
            'nu', r."NU_RECURSO",
            'edital_id', r."CO_MONITORAMENTO",
            'edital', r.edital,
            'unidade', r.unidade,
            'origem', r."CO_ORIGEM_RECURSO",
            'analise_id', r."CO_ANALISE_CURRICULAR",
            'fora_analise', r."ST_FORA_ANALISE" = 'S',
            'candidato', coalesce(r.candidato, r."NO_CANDIDATO_INFORMADO"),
            'codigo', coalesce(r.id_origem, r."CO_CANDIDATO_INFORMADO"),
            'cargo', coalesce(r.nome_vaga, r."NO_CARGO_INFORMADO"),
            'vaga', coalesce(r.codigo_vaga, r."CO_VAGA_INFORMADA"),
            'nota_anterior', r."VL_NOTA_ANTERIOR",
            'nota_atual', r.nota_final_ajustada,
            'resultado_anterior', r."DS_RESULTADO_ANTERIOR",
            'resultado_atual', r.status_consolidado,
            'analista', r."NO_ANALISTA",
            'situacao', r."TP_SITUACAO",
            'processo_sei', r."NU_PROCESSO_SEI",
            'mudou_classificacao', r."ST_MUDOU_CLASSIFICACAO" = 'S',
            'download_empregare_em', r."DT_DOWNLOAD_EMPREGARE",
            'processo_sei_em', r."DT_PROCESSO_SEI",
            'upload_sei_em', r."DT_UPLOAD_SEI",
            'resposta_candidato_em', r."DT_RESPOSTA_CANDIDATO",
            'decisao_em', r."DT_DECISAO",
            'criado_em', r."DT_CRIACAO",
            'atualizado_em', r."DT_ATUALIZACAO",
            'revisao', r."NU_REVISAO"
          ) order by r."NU_RECURSO" desc), '[]'::json)
        from recursos r
      ),
      'cronogramas', (
        select coalesce(json_agg(json_build_object(
            'edital_id', c.monitoramento_id,
            'ordem', c.ordem,
            'atividade', c.atividade,
            'inicio', c.data_inicio,
            'fim', c.data_fim
          ) order by c.monitoramento_id, c.ordem), '[]'::json)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c
        where c.monitoramento_id in (select r."CO_MONITORAMENTO" from recursos r)
      )
    )
  );
end;
$function$;

-- public.get_recurso_candidato_detalhe: corpo de 20260929120000_recursos.sql, com o recorte da coordenação.
create or replace function public.get_recurso_candidato_detalhe(p_id uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
begin
  select m."CO_AREA" into v_area
  from public."TB_RECURSO_CANDIDATO" r
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S';
  if v_area is null then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 1);
  perform private."FC_EXIGIR_AREA_EDITAL"((select r."CO_MONITORAMENTO"::text from public."TB_RECURSO_CANDIDATO" r where r."CO_RECURSO_CANDIDATO" = p_id));
  return (
    select json_build_object(
      'id', r."CO_RECURSO_CANDIDATO",
      'observacao', r."DS_OBSERVACAO",
      'modalidade', a.modalidade_concorrencia,
      'responsavel_analise', a.responsavel_analise,
      'analise_ativa', a.ativo,
      'nome_informado', r."NO_CANDIDATO_INFORMADO",
      'codigo_informado', r."CO_CANDIDATO_INFORMADO",
      'cargo_informado', r."NO_CARGO_INFORMADO",
      'vaga_informada', r."CO_VAGA_INFORMADA",
      'criado_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_CRIACAO"),
      'decisao_por', private."FC_NOME_USUARIO"(r."CO_USUARIO_DECISAO"),
      'etapas', json_build_object(
        'download_empregare', private."FC_NOME_USUARIO"(r."CO_USUARIO_DOWNLOAD_EMPREGARE"),
        'processo_sei', private."FC_NOME_USUARIO"(r."CO_USUARIO_PROCESSO_SEI"),
        'upload_sei', private."FC_NOME_USUARIO"(r."CO_USUARIO_UPLOAD_SEI"),
        'resposta_candidato', private."FC_NOME_USUARIO"(r."CO_USUARIO_RESPOSTA_CANDIDATO")
      ),
      'historico', (
        select coalesce(json_agg(json_build_object(
            'em', h."DT_ALTERACAO",
            'acao', h."TP_ACAO",
            'campo', h."DS_CAMPO",
            'anterior', h."DS_VALOR_ANTERIOR",
            'novo', h."DS_VALOR_NOVO",
            'motivo', h."DS_MOTIVO",
            'autor', private."FC_NOME_USUARIO"(h."CO_USUARIO")
          ) order by h."DT_ALTERACAO" desc, h."CO_HISTORICO_RECURSO" desc), '[]'::json)
        from public."TH_RECURSO_CANDIDATO" h
        where h."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
      )
    )
    from public."TB_RECURSO_CANDIDATO" r
    left join public."TB_ANALISE_CURRICULAR" a on a.id = r."CO_ANALISE_CURRICULAR"
    where r."CO_RECURSO_CANDIDATO" = p_id
  );
end;
$function$;

-- public.buscar_candidatos_recurso: corpo de 20260929120000_recursos.sql, com o recorte da coordenação.
create or replace function public.buscar_candidatos_recurso(p_edital_id uuid, p_busca text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_edital text;
  v_area text;
  v_busca text := btrim(coalesce(p_busca, ''));
  v_texto text;
begin
  select m.edital, m."CO_AREA" into v_edital, v_area
  from public."TB_MONITORAMENTO_INDIGENA" m
  where m.id = p_edital_id;
  if v_area is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id::text);
  if length(v_busca) < 2 then
    return '[]'::json;
  end if;
  v_texto := private."FC_TEXTO_BUSCA_RECURSO"(left(v_busca, 100));
  return (
    select coalesce(json_agg(json_build_object(
        'id', x.id,
        'candidato', x.candidato,
        'codigo', x.id_origem,
        'vaga', x.codigo_vaga,
        'cargo', x.nome_vaga,
        'nota', x.nota_final_ajustada,
        'resultado', x.status_consolidado,
        'responsavel', x.responsavel_analise,
        'modalidade', x.modalidade_concorrencia,
        'ativo', x.ativo
      ) order by x.ativo desc, x.candidato, x.codigo_vaga), '[]'::json)
    from (
      select a.id, a.candidato, a.id_origem, a.codigo_vaga, a.nome_vaga,
             a.nota_final_ajustada, a.status_consolidado, a.responsavel_analise,
             a.modalidade_concorrencia, a.ativo
      from public."TB_ANALISE_CURRICULAR" a
      where a.edital = v_edital
        and a."CO_AREA" = v_area
        and (strpos(private."FC_TEXTO_BUSCA_RECURSO"(a.candidato), v_texto) > 0
             or a.id_origem = v_busca)
      order by a.ativo desc, a.candidato, a.codigo_vaga
      limit 20
    ) x
  );
end;
$function$;

-- public.salvar_recurso_candidato: corpo de 20260929120000_recursos.sql, com o recorte da coordenação.
create or replace function public.salvar_recurso_candidato(p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_edital_id uuid;
  v_edital text;
  v_area text;
  v_origem text;
  v_situacao text;
  v_fora boolean;
  v_analise_id uuid;
  v_nota numeric;
  v_resultado text;
  v_responsavel text;
  v_duplicado bigint;
  v_atual public."TB_RECURSO_CANDIDATO";
  v_novo public."TB_RECURSO_CANDIDATO";
  v_texto text;
begin
  if jsonb_typeof(p_dados) is distinct from 'object' then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  v_id := nullif(p_dados->>'id', '')::uuid;

  if v_id is null then
    -- Cadastro ---------------------------------------------------------------
    v_edital_id := nullif(p_dados->>'edital_id', '')::uuid;
    select m.edital, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id = v_edital_id;
    if v_area is null then
      raise exception 'Edital não encontrado' using errcode = '22023';
    end if;
    perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
    perform private."FC_EXIGIR_AREA_EDITAL"(v_edital_id::text);

    v_origem := nullif(p_dados->>'origem', '');
    if not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_origem and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
    v_situacao := coalesce(nullif(p_dados->>'situacao', ''), 'EM_ANALISE');
    if v_situacao not in ('EM_ANALISE', 'DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Situação inválida' using errcode = '22023';
    end if;
    v_fora := coalesce((p_dados->>'fora_analise')::boolean, false);

    if not v_fora then
      select a.id, a.nota_final_ajustada, a.status_consolidado, a.responsavel_analise
        into v_analise_id, v_nota, v_resultado, v_responsavel
      from public."TB_ANALISE_CURRICULAR" a
      where a.id = nullif(p_dados->>'analise_id', '')::uuid
        and a.edital = v_edital
        and a."CO_AREA" = v_area;
      if v_analise_id is null then
        raise exception 'Candidato não encontrado nas análises deste edital' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."CO_ANALISE_CURRICULAR" = v_analise_id
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" = 'EM_ANALISE'
      order by r."NU_RECURSO"
      limit 1;
    else
      v_texto := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_texto) not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."ST_FORA_ANALISE" = 'S'
        and private."FC_TEXTO_BUSCA_RECURSO"(r."NO_CANDIDATO_INFORMADO") = private."FC_TEXTO_BUSCA_RECURSO"(v_texto)
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" = 'EM_ANALISE'
      order by r."NU_RECURSO"
      limit 1;
    end if;

    if v_duplicado is not null and not coalesce((p_dados->>'permitir_duplicado')::boolean, false) then
      raise exception 'Já existe o recurso nº % em análise para este candidato, edital e origem', v_duplicado
        using errcode = '23505', hint = 'duplicado:' || v_duplicado;
    end if;

    insert into public."TB_RECURSO_CANDIDATO" (
      "CO_MONITORAMENTO", "CO_ORIGEM_RECURSO", "CO_ANALISE_CURRICULAR", "ST_FORA_ANALISE",
      "NO_CANDIDATO_INFORMADO", "CO_CANDIDATO_INFORMADO", "NO_CARGO_INFORMADO", "CO_VAGA_INFORMADA",
      "VL_NOTA_ANTERIOR", "DS_RESULTADO_ANTERIOR", "NO_ANALISTA", "TP_SITUACAO",
      "NU_PROCESSO_SEI", "ST_MUDOU_CLASSIFICACAO", "DS_OBSERVACAO",
      "DT_PROCESSO_SEI", "CO_USUARIO_PROCESSO_SEI", "DT_DECISAO", "CO_USUARIO_DECISAO",
      "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO"
    ) values (
      v_edital_id, v_origem,
      v_analise_id,
      case when v_fora then 'S' else 'N' end,
      case when v_fora then v_texto end,
      case when v_fora then nullif(btrim(p_dados->>'codigo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'cargo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'vaga_informada'), '') end,
      v_nota,
      v_resultado,
      coalesce(nullif(btrim(p_dados->>'analista'), ''), nullif(btrim(v_responsavel), '')),
      v_situacao,
      nullif(btrim(p_dados->>'processo_sei'), ''),
      case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end,
      nullif(btrim(p_dados->>'observacao'), ''),
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then now() end,
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then v_uid end,
      case when v_situacao <> 'EM_ANALISE' then now() end,
      case when v_situacao <> 'EM_ANALISE' then v_uid end,
      v_uid, v_uid
    )
    returning * into v_novo;

    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_novo."CO_RECURSO_CANDIDATO", 'criacao', v_novo."TP_SITUACAO", v_uid);

    return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
  end if;

  -- Edição -------------------------------------------------------------------
  select r.* into v_atual
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_atual."CO_MONITORAMENTO";
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_atual."CO_MONITORAMENTO"::text);
  if (p_dados->>'revisao') is null or (p_dados->>'revisao')::integer <> v_atual."NU_REVISAO" then
    raise exception 'O recurso foi alterado por outra pessoa. Recarregue e tente de novo.' using errcode = '40001';
  end if;

  v_novo := v_atual;
  if p_dados ? 'origem' then
    v_novo."CO_ORIGEM_RECURSO" := nullif(p_dados->>'origem', '');
    if v_novo."CO_ORIGEM_RECURSO" is distinct from v_atual."CO_ORIGEM_RECURSO"
       and not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO" and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
  end if;
  if p_dados ? 'situacao' then
    v_novo."TP_SITUACAO" := coalesce(nullif(p_dados->>'situacao', ''), 'EM_ANALISE');
    if v_novo."TP_SITUACAO" not in ('EM_ANALISE', 'DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Situação inválida' using errcode = '22023';
    end if;
  end if;
  if p_dados ? 'analista' then v_novo."NO_ANALISTA" := nullif(btrim(p_dados->>'analista'), ''); end if;
  if p_dados ? 'processo_sei' then v_novo."NU_PROCESSO_SEI" := nullif(btrim(p_dados->>'processo_sei'), ''); end if;
  if p_dados ? 'mudou_classificacao' then
    v_novo."ST_MUDOU_CLASSIFICACAO" := case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end;
  end if;
  if p_dados ? 'observacao' then v_novo."DS_OBSERVACAO" := nullif(btrim(p_dados->>'observacao'), ''); end if;
  if v_atual."ST_FORA_ANALISE" = 'S' then
    if p_dados ? 'nome_informado' then
      v_novo."NO_CANDIDATO_INFORMADO" := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_novo."NO_CANDIDATO_INFORMADO") not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
    end if;
    if p_dados ? 'codigo_informado' then v_novo."CO_CANDIDATO_INFORMADO" := nullif(btrim(p_dados->>'codigo_informado'), ''); end if;
    if p_dados ? 'cargo_informado' then v_novo."NO_CARGO_INFORMADO" := nullif(btrim(p_dados->>'cargo_informado'), ''); end if;
    if p_dados ? 'vaga_informada' then v_novo."CO_VAGA_INFORMADA" := nullif(btrim(p_dados->>'vaga_informada'), ''); end if;
  end if;

  -- Decisão: sair de "em análise" fecha os dias em aberto; voltar reabre.
  if v_novo."TP_SITUACAO" <> 'EM_ANALISE' and v_atual."TP_SITUACAO" = 'EM_ANALISE' then
    v_novo."DT_DECISAO" := now();
    v_novo."CO_USUARIO_DECISAO" := v_uid;
  elsif v_novo."TP_SITUACAO" = 'EM_ANALISE' then
    v_novo."DT_DECISAO" := null;
    v_novo."CO_USUARIO_DECISAO" := null;
  end if;
  -- Informar o número do processo SEI marca a etapa "processo SEI criado".
  if v_novo."NU_PROCESSO_SEI" is not null and v_novo."DT_PROCESSO_SEI" is null then
    v_novo."DT_PROCESSO_SEI" := now();
    v_novo."CO_USUARIO_PROCESSO_SEI" := v_uid;
  end if;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  select v_id, c.acao, c.campo, c.antes, c.depois, v_uid
  from (values
    ('edicao', 'origem', v_atual."CO_ORIGEM_RECURSO", v_novo."CO_ORIGEM_RECURSO"),
    ('edicao', 'situacao', v_atual."TP_SITUACAO", v_novo."TP_SITUACAO"),
    ('edicao', 'analista', v_atual."NO_ANALISTA", v_novo."NO_ANALISTA"),
    ('edicao', 'processo_sei', v_atual."NU_PROCESSO_SEI", v_novo."NU_PROCESSO_SEI"),
    ('edicao', 'mudou_classificacao', v_atual."ST_MUDOU_CLASSIFICACAO", v_novo."ST_MUDOU_CLASSIFICACAO"),
    ('edicao', 'observacao', v_atual."DS_OBSERVACAO", v_novo."DS_OBSERVACAO"),
    ('edicao', 'nome_informado', v_atual."NO_CANDIDATO_INFORMADO", v_novo."NO_CANDIDATO_INFORMADO"),
    ('edicao', 'codigo_informado', v_atual."CO_CANDIDATO_INFORMADO", v_novo."CO_CANDIDATO_INFORMADO"),
    ('edicao', 'cargo_informado', v_atual."NO_CARGO_INFORMADO", v_novo."NO_CARGO_INFORMADO"),
    ('edicao', 'vaga_informada', v_atual."CO_VAGA_INFORMADA", v_novo."CO_VAGA_INFORMADA"),
    ('etapa', 'processo_sei', case when v_atual."DT_PROCESSO_SEI" is null then 'N' else 'S' end, case when v_novo."DT_PROCESSO_SEI" is null then 'N' else 'S' end)
  ) as c(acao, campo, antes, depois)
  where c.antes is distinct from c.depois;
  if not found then
    return json_build_object('id', v_atual."CO_RECURSO_CANDIDATO", 'nu', v_atual."NU_RECURSO", 'revisao', v_atual."NU_REVISAO");
  end if;

  update public."TB_RECURSO_CANDIDATO" set
    "CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO",
    "TP_SITUACAO" = v_novo."TP_SITUACAO",
    "NO_ANALISTA" = v_novo."NO_ANALISTA",
    "NU_PROCESSO_SEI" = v_novo."NU_PROCESSO_SEI",
    "ST_MUDOU_CLASSIFICACAO" = v_novo."ST_MUDOU_CLASSIFICACAO",
    "DS_OBSERVACAO" = v_novo."DS_OBSERVACAO",
    "NO_CANDIDATO_INFORMADO" = v_novo."NO_CANDIDATO_INFORMADO",
    "CO_CANDIDATO_INFORMADO" = v_novo."CO_CANDIDATO_INFORMADO",
    "NO_CARGO_INFORMADO" = v_novo."NO_CARGO_INFORMADO",
    "CO_VAGA_INFORMADA" = v_novo."CO_VAGA_INFORMADA",
    "DT_PROCESSO_SEI" = v_novo."DT_PROCESSO_SEI",
    "CO_USUARIO_PROCESSO_SEI" = v_novo."CO_USUARIO_PROCESSO_SEI",
    "DT_DECISAO" = v_novo."DT_DECISAO",
    "CO_USUARIO_DECISAO" = v_novo."CO_USUARIO_DECISAO",
    "NU_REVISAO" = v_atual."NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = v_id
  returning * into v_novo;

  return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
end;
$function$;

-- public.marcar_etapa_recurso: corpo de 20260929120000_recursos.sql, com o recorte da coordenação.
create or replace function public.marcar_etapa_recurso(p_id uuid, p_etapa text, p_feita boolean)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_RECURSO_CANDIDATO";
  v_area text;
  v_antes timestamptz;
  v_em timestamptz;
  v_revisao integer;
begin
  if p_etapa is null or p_etapa not in ('download_empregare', 'processo_sei', 'upload_sei', 'resposta_candidato') then
    raise exception 'Etapa inválida' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select r.* into v_atual
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_atual."CO_MONITORAMENTO";
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_atual."CO_MONITORAMENTO"::text);

  v_antes := case p_etapa
    when 'download_empregare' then v_atual."DT_DOWNLOAD_EMPREGARE"
    when 'processo_sei' then v_atual."DT_PROCESSO_SEI"
    when 'upload_sei' then v_atual."DT_UPLOAD_SEI"
    else v_atual."DT_RESPOSTA_CANDIDATO" end;
  if (v_antes is not null) = coalesce(p_feita, false) then
    return json_build_object('revisao', v_atual."NU_REVISAO", 'alterou', false, 'em', v_antes);
  end if;
  v_em := case when p_feita then now() end;

  update public."TB_RECURSO_CANDIDATO" set
    "DT_DOWNLOAD_EMPREGARE" = case when p_etapa = 'download_empregare' then v_em else "DT_DOWNLOAD_EMPREGARE" end,
    "CO_USUARIO_DOWNLOAD_EMPREGARE" = case when p_etapa = 'download_empregare' then case when p_feita then v_uid end else "CO_USUARIO_DOWNLOAD_EMPREGARE" end,
    "DT_PROCESSO_SEI" = case when p_etapa = 'processo_sei' then v_em else "DT_PROCESSO_SEI" end,
    "CO_USUARIO_PROCESSO_SEI" = case when p_etapa = 'processo_sei' then case when p_feita then v_uid end else "CO_USUARIO_PROCESSO_SEI" end,
    "DT_UPLOAD_SEI" = case when p_etapa = 'upload_sei' then v_em else "DT_UPLOAD_SEI" end,
    "CO_USUARIO_UPLOAD_SEI" = case when p_etapa = 'upload_sei' then case when p_feita then v_uid end else "CO_USUARIO_UPLOAD_SEI" end,
    "DT_RESPOSTA_CANDIDATO" = case when p_etapa = 'resposta_candidato' then v_em else "DT_RESPOSTA_CANDIDATO" end,
    "CO_USUARIO_RESPOSTA_CANDIDATO" = case when p_etapa = 'resposta_candidato' then case when p_feita then v_uid end else "CO_USUARIO_RESPOSTA_CANDIDATO" end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = p_id
  returning "NU_REVISAO" into v_revisao;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  values (p_id, 'etapa', p_etapa, case when v_antes is null then 'N' else 'S' end, case when p_feita then 'S' else 'N' end, v_uid);

  return json_build_object('revisao', v_revisao, 'alterou', true, 'em', v_em);
end;
$function$;

-- public.excluir_recurso_candidato: corpo de 20260929120000_recursos.sql, com o recorte da coordenação.
create or replace function public.excluir_recurso_candidato(p_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_edital uuid;
  v_area text;
begin
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo entre 3 e 500 caracteres' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  select r."CO_MONITORAMENTO" into v_edital
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S'
  for update;
  if v_edital is null then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_edital::text);
  update public."TB_RECURSO_CANDIDATO" set
    "ST_ATIVO" = 'N',
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = p_id;
  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (p_id, 'exclusao', 'S', 'N', btrim(p_motivo), v_uid);
  return json_build_object('id', p_id, 'excluido', true);
end;
$function$;

commit;
