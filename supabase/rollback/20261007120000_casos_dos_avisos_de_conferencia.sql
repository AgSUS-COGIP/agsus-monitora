-- ROLLBACK de supabase/migrations/20261007120000_casos_dos_avisos_de_conferencia.sql
-- Volta gravar_avisos_conferencia à versão de 20261005210000 (sem 'casos') e apaga
-- os casos dos avisos (TB_CASO_AVISO_CONFERENCIA), a leitura deles e o índice novo.
-- Os avisos ficam (com os exemplos). O job (scripts/conferencias/) segue rodando: a
-- versão antiga da gravação ignora 'casos'; a tela volta a mostrar só os exemplos.
begin;

drop function if exists public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer);
drop function if exists private."FC_TEXTO_DE_BUSCA"(text);
drop function if exists private."FC_PODE_VER_ANALISE_DO_AVISO"(text, text, text);
drop table if exists public."TB_CASO_AVISO_CONFERENCIA";
drop index if exists public."IN_ANALISECURR_IDORIGEM";

create or replace function public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_aviso jsonb;
  v_atual public."TB_AVISO_CONFERENCIA";
  v_conferencia text;
  v_escopo text;
  v_gravidade text;
  v_modulo text;
  v_area text;
  v_edital uuid;
  v_qt integer;
  v_exemplos jsonb;
  v_resumo text;
  v_novos integer := 0;
  v_reabertos integer := 0;
  v_mantidos integer := 0;
begin
  perform private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(p_execucao);
  if jsonb_typeof(p_avisos) is distinct from 'array' or jsonb_array_length(p_avisos) > 1000 then
    raise exception 'Envie até 1000 avisos por chamada, em lista' using errcode = '22023';
  end if;

  for v_aviso in select x from jsonb_array_elements(p_avisos) x loop
    v_conferencia := v_aviso ->> 'conferencia';
    v_escopo := v_aviso ->> 'escopo';
    v_gravidade := v_aviso ->> 'gravidade';
    v_modulo := v_aviso ->> 'modulo';
    v_area := nullif(v_aviso ->> 'area', '');
    v_exemplos := coalesce(v_aviso -> 'exemplos', '[]'::jsonb);
    v_resumo := btrim(coalesce(v_aviso ->> 'resumo', ''));

    if v_conferencia is null or v_conferencia !~ '^[A-Z][A-Z0-9_]{2,59}$' then
      raise exception 'Código de conferência inválido' using errcode = '22023';
    end if;
    if v_escopo is null or v_escopo !~ '^[a-z_]{2,20}:[A-Za-z0-9._:/|-]{1,170}$' then
      raise exception 'Escopo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_gravidade is null or v_gravidade not in ('CRITICA', 'ATENCAO', 'INFORMATIVO') then
      raise exception 'Gravidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if v_modulo is null or v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
      raise exception 'Módulo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida em %', v_conferencia using errcode = '22023';
    end if;
    begin
      v_edital := nullif(v_aviso ->> 'edital', '')::uuid;
      v_qt := (v_aviso ->> 'quantidade')::integer;
    exception when others then
      raise exception 'Edital ou quantidade inválidos em %', v_conferencia using errcode = '22023';
    end;
    if v_edital is not null and not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital) then
      raise exception 'Edital inexistente em %', v_conferencia using errcode = '22023';
    end if;
    if v_qt is null or v_qt < 1 then
      raise exception 'Quantidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if jsonb_typeof(v_exemplos) <> 'array' or jsonb_array_length(v_exemplos) > 20
       or exists (select 1 from jsonb_array_elements(v_exemplos) e
                   where jsonb_typeof(e) <> 'string'
                      or (e #>> '{}') !~ '^[A-Za-z0-9._:/-]{1,80}$'
                      or (e #>> '{}') ~ '[0-9]{11}') then
      raise exception 'Exemplos de % só com ids e códigos (até 20, sem espaço, sem @, sem 11 dígitos)', v_conferencia
        using errcode = '22023';
    end if;
    if length(v_resumo) not between 3 and 300 or not private."FC_TEXTO_SEGURO_DO_AVISO"(v_resumo) then
      raise exception 'Resumo de % vazio, longo ou com cara de dado pessoal', v_conferencia using errcode = '22023';
    end if;

    select * into v_atual from public."TB_AVISO_CONFERENCIA" a
     where a."CO_CONFERENCIA" = v_conferencia and a."DS_ESCOPO" = v_escopo
     for update;

    if v_atual."CO_AVISO_CONFERENCIA" is null then
      insert into public."TB_AVISO_CONFERENCIA" (
        "CO_CONFERENCIA", "DS_ESCOPO", "TP_GRAVIDADE", "CO_MODULO", "CO_AREA", "CO_MONITORAMENTO",
        "QT_OCORRENCIA", "DS_EXEMPLO", "DS_RESUMO", "CO_EXECUCAO")
      values (v_conferencia, v_escopo, v_gravidade, v_modulo, v_area, v_edital, v_qt, v_exemplos, v_resumo, p_execucao);
      v_novos := v_novos + 1;
    elsif v_atual."TP_SITUACAO" = 'RESOLVIDO'
       or (v_atual."TP_SITUACAO" = 'IGNORADO' and v_qt > v_atual."QT_OCORRENCIA_IGNORADA") then
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "TP_SITUACAO" = 'ABERTO', "DT_ULTIMA_VEZ" = now(), "DT_RESOLUCAO" = null,
        "DT_PRIMEIRA_VEZ" = case when v_atual."TP_SITUACAO" = 'RESOLVIDO' then now() else "DT_PRIMEIRA_VEZ" end,
        "CO_USUARIO_IGNORADO" = null, "DT_IGNORADO" = null, "DS_MOTIVO_IGNORADO" = null, "QT_OCORRENCIA_IGNORADA" = null
       where "CO_AVISO_CONFERENCIA" = v_atual."CO_AVISO_CONFERENCIA";
      v_reabertos := v_reabertos + 1;
    else
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "DT_ULTIMA_VEZ" = now()
       where "CO_AVISO_CONFERENCIA" = v_atual."CO_AVISO_CONFERENCIA";
      v_mantidos := v_mantidos + 1;
    end if;
  end loop;

  update public."TL_CONFERENCIA" set "QT_AVISO_NOVO" = "QT_AVISO_NOVO" + v_novos + v_reabertos
   where "CO_EXECUCAO" = p_execucao;
  return jsonb_build_object('novos', v_novos, 'reabertos', v_reabertos, 'mantidos', v_mantidos);
end;
$function$;
comment on function public.gravar_avisos_conferencia(text, jsonb) is
  'Grava até 1000 avisos de uma execução (um por conferência + escopo): novo abre; resolvido reabre; ignorado reabre só se a quantidade passou da ignorada; aberto atualiza quantidade e exemplos. Recusa (22023) exemplo que não seja id ou código (espaço, @, 11 dígitos) e resumo com cara de dado pessoal. Só service_role.';
revoke all on function public.gravar_avisos_conferencia(text, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_avisos_conferencia(text, jsonb) to service_role;

commit;
