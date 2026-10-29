/* Evita dados antigos no Painel das Análises.
   Quando a sincronização marcar o cache como alterado, o leitor remonta o escopo
   e a RPC _se_mudou não pode responder 'inalterado' usando a versão anterior.
   Mantém permissões, escopos, cache válido e demais contratos. */
begin;
set local lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload_v2(p_scope text DEFAULT 'ativo'::text, p_area text DEFAULT 'saude-indigena'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '15s'
 SET lock_timeout TO '3s'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'ativo')));
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_area_nome text;
  v_grupo text;
  v_columns json := json_build_array(
    'id', 'unidade', 'edital', 'codigo_vaga', 'nome_vaga', 'candidato',
    'categoria', 'modalidade_concorrencia', 'status_consolidado', 'etapa',
    'responsavel_analise', 'data_analise', 'nota_final_ajustada',
    'pdf_status', 'tem_pdf'
  );
  v_cache private."TA_PAINEL_ANALISE";
  v_tem_cache boolean := false;
  v_hit boolean := false;
  v_rows json;
  v_editais json;
  v_total integer;
  v_atualizado_em timestamptz;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  -- "Todos" é montado no navegador com os três escopos.
  if v_scope not in ('ativo', 'inativo', 'desativadas') then
    raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
  end if;

  -- Área válida e do usuário (ou admin): 22023/42501 antes de qualquer leitura.
  perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA", a."NO_GRUPO_PLANILHA" into v_area_nome, v_grupo
    from public."TB_AREA" a where a."CO_AREA" = v_area;

  -- Quem tem recorte por coordenação não usa o pronto (que é da área inteira).
  if private."FC_EDITAIS_VISIVEIS"() is null then
    select * into v_cache
      from private."TA_PAINEL_ANALISE" c
     where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
    v_tem_cache := found;

    if v_tem_cache and v_cache."DT_GERACAO" > now() - interval '24 hours'
       and not private."FC_CACHE_DESATUALIZADO"('ANALISES', v_area) then
      -- Sempre entrega o guardado, mesmo de antes da última mudança: quem remonta
      -- é o agendamento (a cada 2 min, só a área com marca em TL_ALTERACAO_CACHE).
      v_hit := not private."FC_CACHE_DESATUALIZADO"('ANALISES', v_area);
    elsif pg_try_advisory_xact_lock(hashtext('painel_analise:' || v_area || ':' || v_scope)::bigint) then
      -- Sem guardado (ou agendamento parado há um dia): remonta só este
      -- escopo e grava. Se a gravação falhar, monta na hora, abaixo.
      perform public.atualizar_cache_painel_analises(v_area, array[v_scope]);
      select * into v_cache
        from private."TA_PAINEL_ANALISE" c
       where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
      v_tem_cache := found and v_cache."DT_GERACAO" > now() - interval '1 hour';
      v_hit := v_tem_cache;
    else
      -- Outra abertura já está remontando: o guardado anterior serve por ora.
      v_hit := false;
    end if;
  end if;

  -- Não servir pacote marcado como sujo, inclusive se a remontagem falhar
  -- ou houver concorrência. Nessa situação, consulta os dados atuais.
  if v_tem_cache and private."FC_CACHE_DESATUALIZADO"('ANALISES', v_area) then
    v_tem_cache := false;
    v_hit := false;
  end if;

  if v_tem_cache then
    v_rows := v_cache."DS_LINHAS";
    v_editais := v_cache."DS_EDITAIS";
    v_total := v_cache."QT_LINHAS";
    v_atualizado_em := v_cache."DT_ULTIMA_ATUALIZACAO";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    select m."DS_LINHAS", m."DS_EDITAIS", m."QT_LINHAS", m."DT_ULTIMA_ATUALIZACAO"
      into v_rows, v_editais, v_total, v_atualizado_em
      from private."FC_MONTAR_PAINEL_ANALISE"(v_area, array[v_scope], true) m;
  end if;

  return json_build_object(
    'schema_version', 4,
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'grupo', v_grupo,
    'edital_status', case when v_scope = 'inativo' then 'Inativo' else 'Ativo' end,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', v_total,
    'textos_sob_demanda', true,
    'detalhe_sob_demanda', true,
    'versao_dados', case when v_tem_cache then v_cache."DS_VERSAO_DADOS" end,
    'atualizado_em', v_atualizado_em,
    'generated_at', v_gerado_em,
    'cache', json_build_object('hit', v_hit, 'refreshed_at', v_gerado_em)
  );
end;
$function$

CREATE OR REPLACE FUNCTION private."FC_MARCA_DA_RPC"(p_rpc text, p_area text DEFAULT NULL::text, p_edital uuid DEFAULT NULL::uuid, p_escopo text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text;
  v_escopo text;
  v_modulo text;
  v_pacote text;
begin
  -- A permissão de cada RPC é conferida aqui com os mesmos erros da função de sempre:
  -- a resposta `inalterado` não monta nada, mas também não sai para quem não pode ler.
  case p_rpc
  when 'get_analises_dashboard_payload_v2' then
    v_escopo := lower(btrim(coalesce(p_escopo, 'ativo')));
    v_area := lower(btrim(coalesce(p_area, 'saude-indigena')));
    if not private.pode_recurso('analises') then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    if v_escopo not in ('ativo', 'inativo', 'desativadas') then
      raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
    end if;
    perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
    -- Sem recorte e com pacote de menos de 24 h, a função entrega o pacote e a área.
    if private."FC_EDITAIS_VISIVEIS"() is null then
      select concat_ws('|', (extract(epoch from c."DT_GERACAO") * 1000000)::bigint, c."DS_VERSAO_DADOS")
        into v_pacote
        from private."TA_PAINEL_ANALISE" c
       where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_escopo
         and c."DT_GERACAO" > now() - interval '24 hours';
      if v_pacote is not null
         and not private."FC_CACHE_DESATUALIZADO"('ANALISES', v_area) then
        return private."FC_MARCA_DA_LEITURA"('analises_pacote', concat_ws('|', v_area, v_escopo, v_pacote));
      end if;
    end if;
    return private."FC_MARCA_DA_LEITURA"('analises_painel', concat_ws('|', v_area, v_escopo));

  when 'get_entrevistas_da_area' then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private.pode_recurso('entrevistas', 1) then
      raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
    end if;
    if not private."FC_PODE_AREA"(p_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    -- Sem recorte e com pacote, a função entrega o pacote como está (DS_PAYLOAD é not null).
    if private."FC_EDITAIS_VISIVEIS"() is null then
      select concat_ws('|', (extract(epoch from c."DT_GERACAO") * 1000000)::bigint, c."DS_VERSAO_DADOS")
        into v_pacote
        from private."TA_PAINEL_ENTREVISTA" c
       where c."CO_AREA" = p_area;
      if v_pacote is not null then
        return private."FC_MARCA_DA_LEITURA"('entrevistas_pacote', concat_ws('|', p_area, v_pacote));
      end if;
    end if;
    return private."FC_MARCA_DA_LEITURA"('entrevistas_area', p_area);

  when 'get_selecao_da_area' then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private.pode_recurso('selecao', 1) then
      raise exception 'Sem permissão para Seleção' using errcode = '42501';
    end if;
    if not private."FC_PODE_AREA"(p_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    return private."FC_MARCA_DA_LEITURA"('selecao_area', p_area);

  when 'listar_acompanhamento_da_visao_geral' then
    v_area := lower(btrim(coalesce(p_area, '')));
    if not private.pode_recurso('dashboard') then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
      raise exception 'Sem permissão para esta área' using errcode = '42501';
    end if;
    return private."FC_MARCA_DA_LEITURA"('acompanhamento_visao_geral', v_area);

  when 'obter_regra_analise' then
    perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
    return private."FC_MARCA_DA_LEITURA"('regra_analise', p_edital::text);

  when 'obter_classificacao_do_edital' then
    perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 1);
    return private."FC_MARCA_DA_LEITURA"('classificacao_edital', p_edital::text);

  when 'listar_avisos_conferencia' then
    v_area := nullif(lower(btrim(coalesce(p_area, ''))), '');
    v_modulo := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
    if auth.uid() is null then
      raise exception 'Sessão necessária' using errcode = '42501';
    end if;
    if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
      raise exception 'Módulo inválido' using errcode = '22023';
    end if;
    return private."FC_MARCA_DA_LEITURA"('avisos_conferencia', concat_ws('|', coalesce(v_area, ''), coalesce(v_modulo, '')));

  else
    raise exception 'RPC sem marca: %', p_rpc using errcode = '22023';
  end case;
end;
$function$

commit;