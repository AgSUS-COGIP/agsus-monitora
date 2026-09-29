/*
  Painel de análises sem espera depois de cada sync.

  O pacote pronto (20260928240000) vencia a cada sync da planilha (15–30 min na
  Saúde Indígena) e a primeira abertura depois dele esperava a remontagem — 5,2 s
  medidos em 29/09. Agora:
  - o painel sempre entrega o guardado (até 3 h), mesmo de antes do último sync;
  - o pg_cron roda a cada 2 min e remonta só a área cuja versão mudou.
  Os dados chegam no painel até ~2 min depois do sync; ninguém espera montagem.
*/
begin;

create or replace function public.atualizar_cache_painel_analises_vencidos()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_area text;
  v_cache record;
  v_resultado jsonb := '[]'::jsonb;
begin
  for v_area in select a."CO_AREA" from public."TB_AREA" a order by a."CO_AREA" loop
    select c."DS_VERSAO_DADOS", c."DT_GERACAO" into v_cache
      from private."TA_PAINEL_ANALISE" c
     where c."CO_AREA" = v_area and c."TP_ESCOPO" = 'ativo';
    if not found
       or v_cache."DS_VERSAO_DADOS" is distinct from private."FC_VERSAO_DADOS_ANALISE"(v_area)
       or v_cache."DT_GERACAO" < now() - interval '30 minutes' then
      v_resultado := v_resultado || public.atualizar_cache_painel_analises(v_area);
    end if;
  end loop;
  return v_resultado;
end;
$function$;

comment on function public.atualizar_cache_painel_analises_vencidos() is
  'Remonta só as áreas cujo pacote do painel de análises venceu (sync novo ou mais de 30 min). Chamada pelo pg_cron a cada 2 min; barata quando nada mudou.';

revoke all on function public.atualizar_cache_painel_analises_vencidos() from public, anon, authenticated;
grant execute on function public.atualizar_cache_painel_analises_vencidos() to service_role;

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
  v_columns json := json_build_array(
    'id', 'grupo', 'unidade', 'edital', 'codigo_vaga',
    'nome_vaga', 'candidato', 'categoria', 'modalidade_concorrencia',
    'status_consolidado', 'etapa', 'responsavel_analise', 'data_analise',
    'nota_final_ajustada', 'pontuacao_escolaridade',
    'pontuacao_cursos_aperfeicoamento', 'pontuacao_experiencia_profissional',
    'pontuacao_criterio_etnico', 'experiencia_saude_indigena_total',
    'experiencia_atencao_basica_total', 'link_pdf', 'pdf_status',
    'erro_pdf', 'origem_arquivo_id', 'data_inicio_analise', 'data_fim_analise',
    'data_validacao_status', 'updated_at', 'ultima_atualizacao', 'edital_status',
    'experiencia_profissional_anos', 'experiencia_profissional_meses',
    'experiencia_profissional_dias', 'experiencia_profissional_total',
    'municipio_uf'
  );
  v_cache private."TA_PAINEL_ANALISE";
  v_versao text;
  v_tem_cache boolean := false;
  v_hit boolean := false;
  v_rows json;
  v_editais json;
  v_total integer;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  -- Área válida e do usuário (ou admin): 22023/42501 antes de qualquer leitura.
  perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA" into v_area_nome from public."TB_AREA" a where a."CO_AREA" = v_area;

  -- Só o 'ativo' é guardado; 'inativo' e 'todos' seguem montados na hora.
  if v_scope = 'ativo' then
    v_versao := private."FC_VERSAO_DADOS_ANALISE"(v_area);
    select * into v_cache
      from private."TA_PAINEL_ANALISE" c
     where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
    v_tem_cache := found;

    if v_tem_cache and v_cache."DT_GERACAO" > now() - interval '3 hours' then
      -- Sempre entrega o guardado, mesmo de antes do último sync: quem remonta é
      -- o agendamento (a cada 2 min, só a área que mudou). Assim ninguém espera
      -- a montagem, que no servidor atual chega a 5 s na Saúde Indígena.
      v_hit := v_cache."DS_VERSAO_DADOS" = v_versao;
    elsif pg_try_advisory_xact_lock(hashtext('painel_analise:' || v_area || ':' || v_scope)::bigint) then
      -- Vencido: remonta e grava. Se a gravação falhar (trava, transação só de
      -- leitura...), atualizar_cache_painel_analises só avisa e o painel é
      -- montado na hora, abaixo.
      perform public.atualizar_cache_painel_analises(v_area);
      select * into v_cache
        from private."TA_PAINEL_ANALISE" c
       where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
      v_tem_cache := found
        and v_cache."DS_VERSAO_DADOS" = v_versao
        and v_cache."DT_GERACAO" > now() - interval '40 minutes';
    else
      -- Outra abertura já está remontando: o guardado anterior serve por ora.
      v_hit := v_tem_cache;
    end if;
  end if;

  if v_tem_cache then
    v_rows := v_cache."DS_LINHAS";
    v_editais := v_cache."DS_EDITAIS";
    v_total := v_cache."QT_LINHAS";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    select m.p_linhas, m.p_editais, m.p_total
      into v_rows, v_editais, v_total
      from private."FC_MONTAR_PAINEL_ANALISE"(v_area, v_scope) m;
  end if;

  return json_build_object(
    'schema_version', 3,
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', v_total,
    'textos_sob_demanda', true,
    'generated_at', v_gerado_em,
    'cache', json_build_object('hit', v_hit, 'refreshed_at', v_gerado_em)
  );
end;
$function$;

do $$
declare
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'agsus_analises_cache_do_painel';
  if v_id is null then
    perform cron.schedule('agsus_analises_cache_do_painel', '*/2 * * * *',
      'select public.atualizar_cache_painel_analises_vencidos();');
  else
    perform cron.alter_job(v_id, schedule => '*/2 * * * *',
      command => 'select public.atualizar_cache_painel_analises_vencidos();');
  end if;
end;
$$;

commit;
