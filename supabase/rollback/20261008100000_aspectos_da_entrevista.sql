-- ROLLBACK de supabase/migrations/20261008100000_aspectos_da_entrevista.sql
-- Tira os aspectos: as notas dos aspectos saem (a nota do avaliador, a média
-- com 2 casas, fica em TB_ENTREVISTA_AVALIACAO), o edital de treinamento volta
-- ao roteiro de exemplo sem aspectos, a versão com aspectos do roteiro da Saúde
-- Indígena sai se nenhum edital a usa (a anterior volta a ser a ativa) e as
-- funções voltam como estavam no banco em 07/10/2026 (conferidas por
-- pg_get_functiondef antes da migration).
begin;

-- 1. Dados.
do $$
declare
  v_v1 uuid := md5('agsus-treinamento-roteiro-saude-indigena')::uuid;
  v_v2 uuid := md5('agsus-treinamento-roteiro-aspectos-saude-indigena')::uuid;
  v_si uuid;
begin
  delete from public."TB_ENTREVISTA_AVALIACAO_ASPECTO";

  -- Treinamento: volta ao roteiro sem aspectos (se ele existe) e a versão com aspectos sai.
  if exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_v1) then
    update public."TB_ENTREVISTA_EDITAL" set "CO_ROTEIRO" = v_v1 where "CO_ROTEIRO" = v_v2;
    update public."TB_ENTREVISTA" set "CO_ROTEIRO" = v_v1 where "CO_ROTEIRO" = v_v2;
    update public."TB_ROTEIRO_ENTREVISTA" set "ST_ATIVO" = 'S' where "CO_ROTEIRO" = v_v1;
  end if;
  if not exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_ROTEIRO" = v_v2)
     and not exists (select 1 from public."TB_ENTREVISTA" e where e."CO_ROTEIRO" = v_v2) then
    delete from public."TB_ROTEIRO_ASPECTO" where "CO_ROTEIRO" = v_v2;
    delete from public."TB_ROTEIRO_NIVEL" where "CO_ROTEIRO" = v_v2;
    delete from public."TB_ROTEIRO_COMPETENCIA" where "CO_ROTEIRO" = v_v2;
    delete from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_v2;
  end if;

  -- Saúde Indígena: a versão com aspectos sai se nenhum edital a usa.
  for v_si in
    select r."CO_ROTEIRO" from public."TB_ROTEIRO_ENTREVISTA" r
     where r."CO_AREA" = 'saude-indigena' and r."NO_ROTEIRO" = 'Saúde Indígena 2026 — Entrevista individual'
       and exists (select 1 from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = r."CO_ROTEIRO")
       and not exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_ROTEIRO" = r."CO_ROTEIRO")
       and not exists (select 1 from public."TB_ENTREVISTA" e where e."CO_ROTEIRO" = r."CO_ROTEIRO")
  loop
    update public."TB_ROTEIRO_ENTREVISTA" a set "ST_ATIVO" = 'S'
      from public."TB_ROTEIRO_ENTREVISTA" b
     where b."CO_ROTEIRO" = v_si and a."CO_ROTEIRO_ORIGEM" = b."CO_ROTEIRO_ORIGEM" and a."NU_VERSAO" = b."NU_VERSAO" - 1;
    delete from public."TB_ROTEIRO_ASPECTO" where "CO_ROTEIRO" = v_si;
    delete from public."TB_ROTEIRO_NIVEL" where "CO_ROTEIRO" = v_si;
    delete from public."TB_ROTEIRO_COMPETENCIA" where "CO_ROTEIRO" = v_si;
    delete from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_si;
  end loop;
end;
$$;

-- 2. Funções como estavam.
create or replace function private."FC_CALCULAR_ENTREVISTA"(p_entrevista uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_e public."TB_ENTREVISTA";
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_avaliadores integer;
  v_total numeric := 0;
  v_falta boolean := false;
  v_reprova boolean := false;
  c record;
  v_media numeric;
  v_nota numeric;
  v_minimo numeric;
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista for update;
  if v_e."CO_ROTEIRO" is null then return; end if;
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";

  -- Avaliadores da banca da entrevista (ativos) — a média é de quem lançou.
  for c in
    select k.*, row_number() over (order by k."NU_ORDEM") ord
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_r."CO_ROTEIRO" order by k."NU_ORDEM"
  loop
    select avg(a."VL_NOTA"), count(*) into v_media, v_avaliadores
      from public."TB_ENTREVISTA_AVALIACAO" a
     where a."CO_ENTREVISTA" = p_entrevista and a."CO_COMPETENCIA" = c."CO_COMPETENCIA";
    if v_avaliadores = 0 then
      v_falta := true;
      update public."TB_ENTREVISTA_NOTA" set "VL_NOTA" = null
       where "CO_ENTREVISTA" = p_entrevista and "NU_ORDEM" = c.ord;
      continue;
    end if;
    v_nota := round(v_media * c."VL_PESO", 2);
    v_total := v_total + v_nota;
    insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
    values (p_entrevista, c.ord, left(c."NO_COMPETENCIA", 600), v_nota)
    on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA";
    if c."VL_MINIMO" is not null then
      v_minimo := case when c."TP_MINIMO" = 'PERCENTUAL'
                       then c."VL_NOTA_MAXIMA" * c."VL_PESO" * c."VL_MINIMO" / 100.0 else c."VL_MINIMO" end;
      if v_nota < v_minimo then v_reprova := true; end if;
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_r."DS_NOTAS_ELIMINATORIAS") x
                where round(v_media, 2) = x::numeric) then
      v_reprova := true;
    end if;
  end loop;

  update public."TB_ENTREVISTA" set
    "VL_NOTA_TOTAL" = case when "ST_COMPARECEU" = 'N' then 0 when v_falta and v_total = 0 then null else round(v_total, 2) end,
    "TP_PARECER" = case
      when "ST_COMPARECEU" = 'N' and v_r."ST_AUSENCIA_ELIMINA" = 'S' then 'INAPTO'
      when "ST_COMPARECEU" is distinct from 'S' or v_falta then 'SEM_PARECER'
      when v_reprova or (v_r."VL_NOTA_MINIMA_TOTAL" is not null and v_total < v_r."VL_NOTA_MINIMA_TOTAL") then 'INAPTO'
      else 'APTO' end,
    "DT_ATUALIZACAO" = now()
   where "CO_ENTREVISTA" = p_entrevista;
end;
$function$;
comment on function private."FC_CALCULAR_ENTREVISTA"(uuid) is 'Recalcula uma entrevista feita no sistema: média × peso por competência (TB_ENTREVISTA_NOTA), total e parecer pelas regras do roteiro.';
revoke all on function private."FC_CALCULAR_ENTREVISTA"(uuid) from public, anon, authenticated;

create or replace function private."FC_ROTEIRO_JSON"(p_roteiro uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
    'id', r."CO_ROTEIRO", 'origem', r."CO_ROTEIRO_ORIGEM", 'versao', r."NU_VERSAO", 'area', r."CO_AREA",
    'nome', r."NO_ROTEIRO", 'descricao', r."DS_DESCRICAO", 'etapa', r."NO_ETAPA",
    'escala', r."TP_ESCALA", 'passo', r."VL_PASSO", 'notas_permitidas', r."DS_NOTAS_PERMITIDAS",
    'nota_minima_total', r."VL_NOTA_MINIMA_TOTAL", 'notas_eliminatorias', r."DS_NOTAS_ELIMINATORIAS",
    'ausencia_elimina', r."ST_AUSENCIA_ELIMINA" = 'S', 'desempate', r."DS_DESEMPATE",
    'soma_analise', r."ST_SOMA_ANALISE" = 'S', 'convocacao_padrao', r."DS_CONVOCACAO_PADRAO",
    'banca_padrao', r."DS_BANCA_PADRAO", 'ativo', r."ST_ATIVO" = 'S', 'criado_em', r."DT_CRIACAO",
    'competencias', coalesce((select json_agg(json_build_object(
        'id', k."CO_COMPETENCIA", 'ordem', k."NU_ORDEM", 'nome', k."NO_COMPETENCIA", 'descricao', k."DS_DESCRICAO",
        'nota_maxima', k."VL_NOTA_MAXIMA", 'peso', k."VL_PESO", 'minimo', k."VL_MINIMO",
        'tipo_minimo', k."TP_MINIMO", 'avaliacao', k."TP_AVALIACAO") order by k."NU_ORDEM")
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = r."CO_ROTEIRO"), '[]'::json),
    'niveis', coalesce((select json_agg(json_build_object('nota', n."VL_NOTA", 'nome', n."NO_NIVEL", 'descricao', n."DS_DESCRICAO") order by n."VL_NOTA")
      from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = r."CO_ROTEIRO"), '[]'::json),
    'editais_em_uso', (select count(*) from public."TB_ENTREVISTA_EDITAL" e where e."CO_ROTEIRO" = r."CO_ROTEIRO"))
  from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = p_roteiro;
$function$;
comment on function private."FC_ROTEIRO_JSON"(uuid) is 'Um roteiro (versão) em json, com competências e níveis.';
revoke all on function private."FC_ROTEIRO_JSON"(uuid) from public, anon, authenticated;

create or replace function public.salvar_roteiro_entrevista(p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_origem uuid := nullif(p_dados ->> 'origem', '')::uuid;
  v_versao integer := 1;
  v_id uuid := gen_random_uuid();
  v_area text := nullif(p_dados ->> 'area', '');
  v_escala text := coalesce(nullif(p_dados ->> 'escala', ''), 'FAIXA');
  k jsonb;
  v_ordem integer := 0;
begin
  if not private.pode_recurso('entrevistas', 2) then
    raise exception 'Sem permissão para editar roteiros de entrevista' using errcode = '42501';
  end if;
  if v_area is not null and not private."FC_PODE_AREA"(v_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  if jsonb_typeof(p_dados -> 'competencias') is distinct from 'array'
     or jsonb_array_length(p_dados -> 'competencias') not between 1 and 20 then
    raise exception 'Informe de 1 a 20 competências' using errcode = '22023';
  end if;
  if v_escala = 'LISTA' and jsonb_array_length(coalesce(p_dados -> 'notas_permitidas', '[]')) = 0 then
    raise exception 'Escala em lista precisa das notas permitidas' using errcode = '22023';
  end if;
  if v_escala = 'NIVEIS' and jsonb_array_length(coalesce(p_dados -> 'niveis', '[]')) = 0 then
    raise exception 'Escala por níveis precisa dos níveis' using errcode = '22023';
  end if;

  if v_origem is not null then
    select coalesce(max(r."NU_VERSAO"), 0) + 1 into v_versao from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem;
    if v_versao = 1 then raise exception 'Roteiro de origem não encontrado' using errcode = '22023'; end if;
    update public."TB_ROTEIRO_ENTREVISTA" set "ST_ATIVO" = 'N' where "CO_ROTEIRO_ORIGEM" = v_origem and "ST_ATIVO" = 'S';
  else
    v_origem := v_id;
  end if;

  insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
    "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
    "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE", "DS_CONVOCACAO_PADRAO",
    "DS_BANCA_PADRAO", "CO_USUARIO_CRIACAO")
  values (v_id, v_origem, v_versao, v_area, btrim(p_dados ->> 'nome'), nullif(btrim(coalesce(p_dados ->> 'descricao', '')), ''),
    coalesce(nullif(btrim(coalesce(p_dados ->> 'etapa', '')), ''), 'Entrevista'), v_escala,
    coalesce(nullif(p_dados ->> 'passo', '')::numeric, 0.5), coalesce(p_dados -> 'notas_permitidas', '[]'),
    nullif(p_dados ->> 'nota_minima_total', '')::numeric, coalesce(p_dados -> 'notas_eliminatorias', '[]'),
    case when coalesce((p_dados ->> 'ausencia_elimina')::boolean, true) then 'S' else 'N' end,
    coalesce(p_dados -> 'desempate', '[]'),
    case when coalesce((p_dados ->> 'soma_analise')::boolean, true) then 'S' else 'N' end,
    coalesce(p_dados -> 'convocacao_padrao', '{}'), coalesce(p_dados -> 'banca_padrao', '[]'), (select auth.uid()));

  for k in select value from jsonb_array_elements(p_dados -> 'competencias') loop
    v_ordem := v_ordem + 1;
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO",
      "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO", "TP_MINIMO", "TP_AVALIACAO")
    values (v_id, v_ordem, btrim(k ->> 'nome'), nullif(btrim(coalesce(k ->> 'descricao', '')), ''),
      (k ->> 'nota_maxima')::numeric, coalesce(nullif(k ->> 'peso', '')::numeric, 1), nullif(k ->> 'minimo', '')::numeric,
      coalesce(nullif(k ->> 'tipo_minimo', ''), 'VALOR'), coalesce(nullif(k ->> 'avaliacao', ''), 'INDIVIDUAL'));
  end loop;

  insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
  select v_id, (n ->> 'nota')::numeric, btrim(n ->> 'nome'), nullif(btrim(coalesce(n ->> 'descricao', '')), '')
    from jsonb_array_elements(coalesce(p_dados -> 'niveis', '[]')) n;

  return private."FC_ROTEIRO_JSON"(v_id);
end;
$function$;
comment on function public.salvar_roteiro_entrevista(jsonb) is 'Cria um roteiro ou uma versão nova de um roteiro (p_dados.origem); a versão anterior deixa de ser oferecida, mas os editais que a usam continuam nela. entrevistas >= editor.';

CREATE OR REPLACE FUNCTION public.lancar_notas_entrevista(p_entrevista uuid, p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_e public."TB_ENTREVISTA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_eu uuid;
  v_admin boolean := private.is_master();
  x jsonb;
  v_comp public."TB_ROTEIRO_COMPETENCIA";
  v_av public."TB_ENTREVISTA_AVALIADOR";
  v_nota numeric;
  v_ant numeric;
  v_comp_novo text := nullif(p_dados ->> 'compareceu', '');
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista and "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S';
  if v_e."CO_ENTREVISTA" is null then raise exception 'Convocado não encontrado' using errcode = '22023'; end if;
  perform private."FC_EXIGIR_ENTREVISTAS_EDITAL"(v_e."CO_MONITORAMENTO", 2);
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO";
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";
  select p.id into v_eu from private.current_profile() p;

  -- Banca da entrevista: grava mesmo sem mudar o comparecimento.
  if nullif(p_dados ->> 'banca', '') is not null
     and (p_dados ->> 'banca')::smallint is distinct from v_e."NU_BANCA" then
    update public."TB_ENTREVISTA" set "NU_BANCA" = (p_dados ->> 'banca')::smallint where "CO_ENTREVISTA" = p_entrevista;
  end if;

  if v_comp_novo is not null then
    if v_comp_novo not in ('S', 'N') then raise exception 'Comparecimento inválido' using errcode = '22023'; end if;
    if v_comp_novo is distinct from v_e."ST_COMPARECEU" then
      update public."TB_ENTREVISTA" set "ST_COMPARECEU" = v_comp_novo, "NU_BANCA" = coalesce(nullif(p_dados ->> 'banca', '')::smallint, "NU_BANCA")
       where "CO_ENTREVISTA" = p_entrevista;
      insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
      values (p_entrevista, 'compareceu', v_e."ST_COMPARECEU", v_comp_novo, (select auth.uid()));
    end if;
  end if;

  for x in select value from jsonb_array_elements(coalesce(p_dados -> 'notas', '[]')) loop
    select * into v_comp from public."TB_ROTEIRO_COMPETENCIA" where "CO_COMPETENCIA" = (x ->> 'competencia')::uuid and "CO_ROTEIRO" = v_e."CO_ROTEIRO";
    if v_comp."CO_COMPETENCIA" is null then raise exception 'Competência não é do roteiro deste edital' using errcode = '22023'; end if;
    select * into v_av from public."TB_ENTREVISTA_AVALIADOR" where "CO_AVALIADOR" = (x ->> 'avaliador')::uuid and "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO" and "ST_ATIVO" = 'S';
    if v_av."CO_AVALIADOR" is null then raise exception 'Avaliador não é da banca deste edital' using errcode = '22023'; end if;
    if v_cfg."TP_LANCAMENTO" = 'AVALIADOR' and not v_admin and v_av."CO_PERFIL_USUARIO" is distinct from v_eu then
      raise exception 'Neste edital cada avaliador lança a própria nota' using errcode = '42501';
    end if;
    v_nota := nullif(x ->> 'nota', '')::numeric;
    if v_nota is null then
      select "VL_NOTA" into v_ant from public."TB_ENTREVISTA_AVALIACAO"
       where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
      if found then
        delete from public."TB_ENTREVISTA_AVALIACAO"
         where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
        insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
        values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'nota', v_ant::text, null, (select auth.uid()));
      end if;
      continue;
    end if;
    if v_nota < 0 or v_nota > v_comp."VL_NOTA_MAXIMA" then
      raise exception 'Nota % fora da faixa de % (0 a %)', v_nota, v_comp."NO_COMPETENCIA", v_comp."VL_NOTA_MAXIMA" using errcode = '22023';
    end if;
    if v_r."TP_ESCALA" = 'FAIXA' and mod(v_nota, v_r."VL_PASSO") <> 0 then
      raise exception 'Nota % não está na escala (de % em %)', v_nota, v_r."VL_PASSO", v_r."VL_PASSO" using errcode = '22023';
    elsif v_r."TP_ESCALA" = 'LISTA' and not exists (select 1 from jsonb_array_elements_text(v_r."DS_NOTAS_PERMITIDAS") n where n::numeric = v_nota) then
      raise exception 'Nota % não está entre as permitidas', v_nota using errcode = '22023';
    elsif v_r."TP_ESCALA" = 'NIVEIS' and not exists (select 1 from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = v_r."CO_ROTEIRO" and n."VL_NOTA" = v_nota) then
      raise exception 'Nota % não é um dos níveis da escala', v_nota using errcode = '22023';
    end if;
    select "VL_NOTA" into v_ant from public."TB_ENTREVISTA_AVALIACAO"
     where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
    if v_ant is not distinct from v_nota then continue; end if;
    insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
    values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", v_nota, (select auth.uid()))
    on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR") do update set
      "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
    insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
    values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'nota', v_ant::text, v_nota::text, (select auth.uid()));
  end loop;

  perform private."FC_CALCULAR_ENTREVISTA"(p_entrevista);
  return public.obter_entrevistas_do_edital(v_e."CO_MONITORAMENTO");
end;
$function$;
comment on function public.lancar_notas_entrevista(uuid, jsonb) is 'Lança/corrige notas ({notas:[{competencia, avaliador, nota|null}]}) e o comparecimento ({compareceu:S|N, banca}) de um convocado, valida a escala do roteiro, grava o histórico e recalcula o resultado. entrevistas >= editor; no modo AVALIADOR, só a própria nota.';

CREATE OR REPLACE FUNCTION public.obter_entrevistas_do_edital(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
  v_lista uuid := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'pode_gerar_lista', private.pode_recurso('classificacao', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'banca', v_cfg."DS_BANCA",
        'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'regra_classificacao', (
      select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'convocacao', h."DS_CONFIGURACAO" -> 'convocacao')
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'lista_convocacao', case when v_lista is null then null else json_build_object(
        'lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_lista),
        'retrato', (select l."DS_RESULTADO" from public."TB_LISTA_CLASSIFICACAO" l
                     where l."CO_LISTA_CLASSIFICACAO" = v_lista)) end,
    'avaliadores', coalesce((
      select json_agg(json_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM",
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S') order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA"))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.conferencia_ler_entrevistas()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with entrevistas as (
    select e."CO_ENTREVISTA", e."CO_MONITORAMENTO", e."CO_AREA", e."CO_ANALISE_CURRICULAR",
           e."TP_ORIGEM", e."VL_NOTA_TOTAL", e."ST_COMPARECEU", e."TP_PARECER", e."DT_ATUALIZACAO"
      from public."TB_ENTREVISTA" e
     where coalesce(e."ST_ATIVO", 'S') = 'S'
       and not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
  ),
  editais_do_sistema as (
    select distinct e."CO_MONITORAMENTO" as edital
      from entrevistas e
     where e."TP_ORIGEM" = 'sistema' and e."CO_MONITORAMENTO" is not null
  )
  select jsonb_build_object(
    'schema_version', 1,
    'entrevistas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', e."CO_ENTREVISTA", 'edital', e."CO_MONITORAMENTO", 'area', e."CO_AREA",
          'analise', e."CO_ANALISE_CURRICULAR", 'origem', e."TP_ORIGEM", 'nota', e."VL_NOTA_TOTAL",
          'compareceu', e."ST_COMPARECEU", 'parecer', e."TP_PARECER")), '[]'::jsonb)
        from entrevistas e
    ),
    'agenda', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', g."CO_AGENDA_ENTREVISTA", 'edital', g."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'analise', g."CO_ANALISE_CURRICULAR", 'codigo', nullif(btrim(a.id_origem), ''),
          'data', g."DT_ENTREVISTA", 'inicio', g."HR_INICIO", 'fim', g."HR_FIM")), '[]'::jsonb)
        from public."TB_AGENDA_ENTREVISTA" g
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = g."CO_MONITORAMENTO"
        left join public."TB_ANALISE_CURRICULAR" a on a.id = g."CO_ANALISE_CURRICULAR"
       where not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
    ),
    'avaliacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'entrevista', v."CO_ENTREVISTA", 'competencia', v."CO_COMPETENCIA", 'nota', v."VL_NOTA")), '[]'::jsonb)
        from public."TB_ENTREVISTA_AVALIACAO" v
        join entrevistas e on e."CO_ENTREVISTA" = v."CO_ENTREVISTA"
    ),
    'competencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', c."CO_COMPETENCIA", 'roteiro', c."CO_ROTEIRO", 'maxima', c."VL_NOTA_MAXIMA")), '[]'::jsonb)
        from public."TB_ROTEIRO_COMPETENCIA" c
    ),
    'roteiros', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', r."CO_ROTEIRO", 'escala', r."TP_ESCALA", 'passo', r."VL_PASSO",
          'permitidas', r."DS_NOTAS_PERMITIDAS",
          'niveis', (select coalesce(jsonb_agg(n."VL_NOTA" order by n."VL_NOTA"), '[]'::jsonb)
                       from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = r."CO_ROTEIRO"))), '[]'::jsonb)
        from public."TB_ROTEIRO_ENTREVISTA" r
    ),
    'convocacao', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', x.edital, 'lista', x.lista,
          'analises', (select coalesce(jsonb_agg(c), '[]'::jsonb)
                         from private."FC_CONVOCADOS_DA_LISTA"(x.lista) c))), '[]'::jsonb)
        from (select s.edital, private."FC_LISTA_CONVOCACAO_VIGENTE"(s.edital) as lista
                from editais_do_sistema s) x
    )
  );
$function$;
comment on function public.conferencia_ler_entrevistas() is
  'Conferências (job Python): entrevistas ativas (id, edital, análise, origem, nota, comparecimento), a agenda (data e horário por análise, com o código do candidato), as notas de cada avaliador, a escala de cada roteiro e a lista de convocação vigente (análises) dos editais com convocados pelo sistema. Sem nome nem CPF. Só service_role.';

create or replace function private."FC_PREPARAR_EDITAL_TREINAMENTO"(p_area text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_numero constant text := '991/2099';
  c_edital constant text := 'Treinamento – Saúde Indígena (991/2099)';
  c_unidade constant text := 'DSEI Treinamento';
  c_origem constant text := 'treinamento';
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_id uuid;
  v_planilha text;
  v_grupo text;
  v_roteiro uuid;
  v_regra_classif uuid;
  v_config_classif jsonb;
  v_modelo public."TB_REGRA_ANALISE_MODELO";
  v_config_analise jsonb;
  v_regra_analise uuid;
  v_resultado jsonb;
begin
  if v_area <> 'saude-indigena' then
    raise exception 'Edital de treinamento disponível só para a Saúde Indígena (por enquanto)' using errcode = '22023';
  end if;
  select a."NO_GRUPO_PLANILHA" into v_grupo from public."TB_AREA" a where a."CO_AREA" = v_area;
  select p."CO_PLANILHA" into v_planilha from public."TB_PLANILHA_ANALISE" p where p."CO_AREA" = v_area;
  if v_grupo is null or v_planilha is null then
    raise exception 'Área sem planilha de análises cadastrada: %', v_area using errcode = '22023';
  end if;

  -- Um edital de treinamento por área; uma preparação por vez.
  perform pg_advisory_xact_lock(hashtextextended('edital_treinamento:' || v_area, 0));

  -- Vagas, candidatos e notas fictícios (nada de dado pessoal real).
  create temporary table if not exists tmp_treino_vaga (
    vaga text primary key, ordem smallint, cargo text, imediatas integer, cr boolean, nivel text
  ) on commit drop;
  truncate tmp_treino_vaga;
  insert into tmp_treino_vaga values
    ('9909910001', 1, 'Enfermeiro', 2, true, 'Superior'),
    ('9909910002', 2, 'Técnico de Enfermagem', 3, true, 'Técnico'),
    ('9909910003', 3, 'Agente Indígena de Saúde (AIS)', 2, false, 'Fundamental');

  create temporary table if not exists tmp_treino_candidato (
    n integer primary key, codigo text, nome text, email text, vaga text, nota numeric,
    modalidade text, indigena boolean, nascimento date
  ) on commit drop;
  truncate tmp_treino_candidato;
  insert into tmp_treino_candidato
  select n, 'TREINO-' || lpad(n::text, 2, '0'), 'Candidato Teste ' || lpad(n::text, 2, '0'),
         'candidato.teste' || lpad(n::text, 2, '0') || '@exemplo.invalid',
         case when n <= 5 then '9909910001' when n <= 11 then '9909910002' else '9909910003' end,
         (array[82.5, 77, 71.25, 64, 58.5, 88, 79.5, 73, 69.75, 61, 55.5, 74, 68.25, 62, 51.5])[n],
         case when n in (3, 8, 12, 14) then 'Indígenas' else 'Ampla Concorrência' end,
         n in (3, 8, 12, 13, 14),
         make_date(1970 + n * 2, 1 + (n % 12), 1 + n)
    from generate_series(1, 15) n;

  -- O edital.
  select m.id into v_id
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" = v_area and m."ST_TREINAMENTO" = 'S'
   order by m.created_at, m.id
   limit 1;
  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA" (
      processo, edital, sigla_unidade, tipo_unidade, unidade, uf, ciclo, cargos, vagas_total, inscritos,
      aptos_analise, data_inicio, data_fim, status, etapa, risco, responsavel, observacoes,
      observacoes_internas, ativo, origem_carga, cronograma_origem, "CO_AREA", "ST_TREINAMENTO")
    values (
      'TREINAMENTO', c_edital, 'TREINO', 'DSEI', c_unidade, 'DF', '2099',
      'Enfermeiro; Técnico de Enfermagem; Agente Indígena de Saúde (AIS)', 7, 15, 15,
      v_hoje - 45, v_hoje + 30, 'Em andamento', 'Entrevistas', 'Baixo', 'Treinamento',
      'Edital de treinamento: dados fictícios, sem valor oficial.',
      'Criado por private."FC_PREPARAR_EDITAL_TREINAMENTO". Reinicie em Editais (admin).',
      true, 'TREINAMENTO', 'MANUAL', v_area, 'S')
    returning id into v_id;
  end if;

  -- Cronograma relativo a hoje: inscrições já passaram, avaliação documental e
  -- entrevistas em andamento (FC_JANELA_ENTREVISTA fica aberta).
  if not exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = v_id) then
    insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, tipo_atividade, data_inicio, data_fim, origem, observacao)
    select v_id, x.ordem, x.atividade, x.tipo, v_hoje + x.ini, v_hoje + x.fim, 'MANUAL', 'Treinamento'
      from (values
        (1, 'Publicação do Edital', 'PUBLICACAO', -45, -45),
        (2, 'Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos', 'INSCRICAO', -44, -30),
        (3, 'Avaliação Documental e de Títulos', 'ANALISE', -29, 10),
        (4, 'Resultado Preliminar da Avaliação Documental e de Títulos', 'RESULTADO', -12, -12),
        (5, 'Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos', 'RECURSO', -11, -9),
        (6, 'Resultado Final da Avaliação Documental e de Títulos', 'RESULTADO', -7, -7),
        (7, 'Convocação para a Entrevista', 'CONVOCACAO', -5, -5),
        (8, 'Período de Entrevistas', 'ENTREVISTA', -2, 12),
        (9, 'Resultado Preliminar das Entrevistas', 'RESULTADO', 15, 15),
        (10, 'Prazo para recursos referentes ao resultado preliminar das entrevistas', 'RECURSO', 16, 18),
        (11, 'Resultado final da Entrevista', 'RESULTADO', 21, 21),
        (12, 'Resultado final do Processo Seletivo', 'RESULTADO', 25, 25)
      ) x(ordem, atividade, tipo, ini, fim);
  end if;

  -- Quadro de vagas.
  if not exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = v_id and q."ST_REGISTRO_ATIVO" = 'S') then
    insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO",
      "DS_MODALIDADE_VAGA", "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
    select v_id, t.ordem, t.cargo, c_unidade,
           jsonb_build_object('Ampla Concorrência', t.imediatas, 'Indígenas', null),
           t.imediatas, case when t.cr then 'S' else 'N' end, 'MANUAL', 'treinamento', v_uid
      from tmp_treino_vaga t;
  end if;

  -- Análises curriculares fictícias (aprovadas): a fonte da Classificação e da convocação.
  insert into public."TB_ANALISE_CURRICULAR" (grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, cpf_hash,
    categoria, modalidade_concorrencia, status_consolidado, etapa, responsavel_analise, data_analise,
    nota_final_ajustada, pontuacao_escolaridade, pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional, pontuacao_criterio_etnico, experiencia_saude_indigena_total,
    experiencia_atencao_basica_total, analise, ativo, id_origem, data_nascimento, nota_empregare,
    pcd, origem_planilha, chave_natural, "CO_AREA", "CO_PLANILHA")
  select v_grupo, c_unidade, c_edital, c.vaga, v.cargo, c.nome, null,
         v.nivel, c.modalidade, 'Aprovado', 'Análise concluída', 'Treinamento', v_hoje - 14,
         c.nota, round(c.nota * 0.3, 2), round(c.nota * 0.1, 2), round(c.nota * 0.4, 2),
         case when c.indigena then 14 else 0 end, (c.n % 5) * 6, (c.n % 4) * 9,
         'Análise fictícia do edital de treinamento.', true, c.codigo, c.nascimento, round(c.nota * 0.9, 2),
         'Não', c_origem, c_origem || '|' || v_area || '|' || c.codigo, v_area, v_planilha
    from tmp_treino_candidato c
    join tmp_treino_vaga v on v.vaga = c.vaga
  on conflict (chave_natural) do nothing;

  -- Roteiro de exemplo (id fixo por área: o reinício reaproveita).
  v_roteiro := md5('agsus-treinamento-roteiro-' || v_area)::uuid;
  if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
      "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
      "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE",
      "DS_CONVOCACAO_PADRAO", "DS_BANCA_PADRAO", "ST_ATIVO")
    values (v_roteiro, v_roteiro, 1, v_area, 'Treinamento — Entrevista individual (exemplo)',
      'Roteiro de exemplo do edital de treinamento: 4 competências de 0 a 5, apto com 8 pontos e 2 em cada competência; nota 0 elimina.',
      'Entrevista Individual', 'NIVEIS', 1, '[]'::jsonb, 8, '[0]'::jsonb, 'S',
      '["Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa)", "Maior pontuação na Avaliação Documental e de Títulos", "Maior pontuação na Entrevista"]'::jsonb,
      'S', '{"multiplo_imediatas": 3, "posicao_cadastro_reserva": 5}'::jsonb,
      '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'S');
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO")
    values (v_roteiro, 1, 'Comunicação e escuta', 'Expressa-se com clareza e escuta o outro.', 5, 1, 2),
           (v_roteiro, 2, 'Trabalho em equipe', 'Colabora e compartilha responsabilidades.', 5, 1, 2),
           (v_roteiro, 3, 'Respeito à diversidade cultural', 'Reconhece e respeita os modos de vida dos povos indígenas.', 5, 1, 2),
           (v_roteiro, 4, 'Conhecimento da função', 'Conhece as atribuições do cargo no território.', 5, 1, 2);
    insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
    values (v_roteiro, 0, 'Não demonstrou', null), (v_roteiro, 1, 'Insuficiente', null),
           (v_roteiro, 2, 'Básico', null), (v_roteiro, 3, 'Adequado', null),
           (v_roteiro, 4, 'Bom', null), (v_roteiro, 5, 'Excelente', null);
  end if;

  -- Entrevista configurada (roteiro, banca, vagas imediatas e avaliadores fictícios).
  if not exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_CONVOCACAO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
    values (v_id, v_roteiro, '{}'::jsonb,
            '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'SECRETARIA', v_uid);
  end if;
  insert into public."TB_ENTREVISTA_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "QT_VAGA_IMEDIATA")
  select v_id, t.vaga, t.imediatas from tmp_treino_vaga t
   where not exists (select 1 from public."TB_ENTREVISTA_VAGA" x where x."CO_MONITORAMENTO" = v_id and x."CO_VAGA" = t.vaga);
  if not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA")
    values (v_id, 'Avaliador Teste 1', 'AgSUS', 1), (v_id, 'Avaliador Teste 2', 'DSEI', 1);
  end if;

  -- Regra da classificação (formato de src/lib/classificacao/regra.js) e a lista de convocação.
  select r."CO_REGRA_CLASSIFICACAO" into v_regra_classif
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v_id;
  if v_regra_classif is null then
    v_config_classif := jsonb_build_object(
      'schema', 1,
      'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
      'etapas', jsonb_build_object('documental', true, 'entrevista', true),
      'documental', jsonb_build_object('situacoes_aptas', jsonb_build_array('Aprovado'), 'nota_minima', null,
                                       'nota_minima_por_nivel', '{}'::jsonb, 'niveis_por_cargo', '[]'::jsonb,
                                       'nivel_padrao', null, 'parciais', '[]'::jsonb),
      'entrevista', jsonb_build_object('nota_minima', 8, 'nota_minima_competencia', 2, 'nota_eliminatoria_ate', 0,
                                       'competencias', '[]'::jsonb, 'exige_comparecimento', true,
                                       'inapto_elimina', true, 'so_parecer', false),
      'composicao', jsonb_build_object('componentes', jsonb_build_array(
                                         jsonb_build_object('codigo', 'DOCUMENTAL', 'peso', 1),
                                         jsonb_build_object('codigo', 'ENTREVISTA', 'peso', 1)),
                                       'casas', 2, 'arredondamento', 'MEIO_PARA_CIMA'),
      'desempate', '[]'::jsonb,
      'listas', jsonb_build_object('PRELIMINAR', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'ENTREVISTA', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'FINAL', jsonb_build_object('empate', 'CRITERIOS')),
      'empate_final', jsonb_build_object('metodo', 'MESMA_POSICAO', 'numeracao', 'DENSA'),
      'modalidades', jsonb_build_array(jsonb_build_object(
                       'codigo', 'AC', 'nome', 'Ampla concorrência', 'percentual', null,
                       'arredondamento', 'MEIO_PARA_CIMA', 'lista_propria', false, 'recomeca_posicao', true,
                       'aparece_na_geral', true, 'remanejar_para', '[]'::jsonb, 'agrupa', '[]'::jsonb)),
      'cotas', jsonb_build_object('minimo_vagas_reserva', 0, 'acumulo', 'TODAS'),
      'convocacao', jsonb_build_object('multiplo_vagas', 3, 'posicao_max_cr', 5, 'incluir_empatados', true,
                                       'excecoes', '[]'::jsonb),
      'rodape', 'TREINAMENTO — sem valor oficial.',
      'documento', jsonb_build_object('edital', 'TREINAMENTO ' || c_numero, 'unidade', c_unidade));
    perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_config_classif);
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (v_id, 1, v_uid) returning "CO_REGRA_CLASSIFICACAO" into v_regra_classif;
    insert into public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra_classif, 1, v_config_classif, 'MESMA_POSICAO', 'Edital de treinamento', v_uid);
  end if;

  if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l where l."CO_MONITORAMENTO" = v_id and l."TP_LISTA" = 'CONVOCACAO') then
    with ordenados as (
      select a.id, a.candidato, a.nota_final_ajustada as nota, a.codigo_vaga,
             rank() over (partition by a.codigo_vaga order by a.nota_final_ajustada desc) as posicao
        from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = v_area and a.ativo and private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and private."FC_NUMERO_EDITAL"(a.edital) = c_numero
    ),
    vagas as (
      select t.ordem, jsonb_build_object(
               'codigo', t.vaga, 'chave', t.vaga, 'cargo', t.cargo, 'lotacao', c_unidade,
               'cabecalho', 'Vaga ' || t.vaga || ' — ' || t.cargo || ' — ' || c_unidade,
               'total', t.imediatas, 'cadastro_reserva', t.cr, 'origem_das_vagas', 'QUADRO',
               'limite_convocacao', null,
               'geral', coalesce((select jsonb_agg(jsonb_build_object(
                          'analise_id', o.id, 'nome', o.candidato, 'posicao', o.posicao, 'nota', o.nota,
                          'modalidades', '[]'::jsonb, 'situacao', 'Classificado') order by o.posicao, o.candidato)
                          from ordenados o where o.codigo_vaga = t.vaga), '[]'::jsonb),
               'listas', '{}'::jsonb, 'eliminados', '[]'::jsonb) as vaga
        from tmp_treino_vaga t
    )
    select jsonb_build_object(
             'schema', 1, 'tipo', 'CONVOCACAO', 'casas', 2, 'avisos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
             'edital', jsonb_build_object('id', v_id, 'edital', c_edital, 'unidade', c_unidade, 'treinamento', true),
             'rodape', 'TREINAMENTO — sem valor oficial.', 'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
             'modalidades', '[]'::jsonb, 'empate_final', 'MESMA_POSICAO', 'regra_versao', 1,
             'totais', jsonb_build_object('vagas', (select sum(t.imediatas) from tmp_treino_vaga t),
                                          'avisos', 0, 'elegiveis', (select count(*) from ordenados),
                                          'candidatos', (select count(*) from ordenados), 'eliminados', 0, 'pendencias', 0),
             'vagas', (select jsonb_agg(v.vaga order by v.ordem) from vagas v))
      into v_resultado;
    insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
      "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "CO_USUARIO")
    values (v_id, 'CONVOCACAO', v_regra_classif, 1, v_resultado,
            encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'),
            (v_resultado #>> '{totais,elegiveis}')::integer, v_uid);
  end if;

  -- Avaliação documental: inscrições e questionários no formato da Empregare.
  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "TP_SITUACAO", "DS_COLUNA", "NO_ARQUIVO",
    "QT_CANDIDATO_ATIVO", "QT_LINHA_ARQUIVO", "QT_RECEBIDA", "DS_MENSAGEM", "DT_ULTIMA_CARGA")
  select t.vaga, v_id, 'GRAVADA',
         jsonb_build_array('CÓDIGO', 'NOME', 'E-MAIL', 'TELEFONE', 'CELULAR', 'GÊNERO', 'PAÍS', 'ESTADO', 'CIDADE', 'PCD',
           'DATA DE NASCIMENTO', 'ETAPA', 'SITUAÇÃO', 'DATA DE CANDIDATURA', 'NÍVEL ÚLTIMA FORMAÇÃO', 'CURSO ÚLTIMA FORMAÇÃO',
           'SITUAÇÃO - ' || upper(t.cargo) || ' - DSEI TREINAMENTO',
           'NOTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO',
           'DATA DE RESPOSTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO',
           'RESPOSTAS - ' || upper(t.cargo) || ' - DSEI TREINAMENTO - Pergunta 1 - Nome completo:',
           'Pergunta 2 - Número do CPF:',
           'Pergunta 3 - Indique em qual sistema de concorrência deseja se inscrever:',
           'Pergunta 4 - Você é indígena e mora em aldeia?',
           'Pergunta 5 - Você possui a escolaridade exigida para a vaga?',
           'Pergunta 6 - Selecione sua Experiência Profissional na área/vaga em que concorre:'),
         'treinamento-' || t.vaga || '.xlsx',
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         'Carga fictícia do edital de treinamento.', now()
    from tmp_treino_vaga t
  on conflict ("CO_VAGA") do nothing;

  insert into public."TB_EMPREGARE_CANDIDATO" ("CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO", "DS_EMAIL", "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA")
  select x.vaga, 'cod:' || x.codigo, 'CODIGO', x.codigo, x.nome, x.email, null, '(00) 00000-0000', x.nascimento,
         'Inscrito', x.candidatura, x.original, encode(sha256(convert_to(x.original::text, 'UTF8')), 'hex')
    from (
      select c.*, (v_hoje - 40 + (c.n % 10))::timestamp at time zone 'America/Sao_Paulo' as candidatura,
             jsonb_build_object(
               'CÓDIGO', c.codigo, 'NOME', c.nome, 'E-MAIL', c.email, 'TELEFONE', '(00) 0000-0000',
               'CELULAR', '(00) 00000-0000', 'GÊNERO', 'Não informado', 'PAÍS', 'Brasil', 'ESTADO', 'DF',
               'CIDADE', 'Cidade Fictícia', 'PCD', 'Não', 'DATA DE NASCIMENTO', to_char(c.nascimento, 'DD/MM/YYYY'),
               'ETAPA', 'Inscritos', 'SITUAÇÃO', 'Ativo', 'DATA DE CANDIDATURA', to_char(v_hoje - 40 + (c.n % 10), 'DD/MM/YYYY'),
               'NÍVEL ÚLTIMA FORMAÇÃO', t.nivel, 'CURSO ÚLTIMA FORMAÇÃO', t.cargo,
               'SITUAÇÃO - ' || upper(t.cargo) || ' - DSEI TREINAMENTO', 'Respondido',
               'NOTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO', replace(to_char(round(c.nota * 0.9, 2), 'FM990.00'), '.', ','),
               'DATA DE RESPOSTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO', to_char(v_hoje - 40 + (c.n % 10), 'DD/MM/YYYY'),
               'RESPOSTAS - ' || upper(t.cargo) || ' - DSEI TREINAMENTO - Pergunta 1 - Nome completo:', c.nome,
               'Pergunta 2 - Número do CPF:', '000.000.000-00',
               'Pergunta 3 - Indique em qual sistema de concorrência deseja se inscrever:', c.modalidade,
               'Pergunta 4 - Você é indígena e mora em aldeia?', case when c.indigena then 'Sou indígena e moro em aldeia' else 'Não' end,
               'Pergunta 5 - Você possui a escolaridade exigida para a vaga?', 'Sim',
               'Pergunta 6 - Selecione sua Experiência Profissional na área/vaga em que concorre:', ((c.n % 5) * 6)::text || ' meses'
             ) as original
        from tmp_treino_candidato c
        join tmp_treino_vaga t on t.vaga = c.vaga
    ) x
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do nothing;

  -- A avaliação documental do edital é feita no MONITORA.
  insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM")
  values (v_id, 'MONITORA')
  on conflict ("CO_MONITORAMENTO") do nothing;

  -- Regra da avaliação documental copiada de um modelo SI (situação CONFERIR: conferir faz parte do treino).
  if not exists (select 1 from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = v_id) then
    select * into v_modelo
      from public."TB_REGRA_ANALISE_MODELO" m
     where m."ST_ATIVO" = 'S' and m."CO_MODELO" like 'SI%'
     order by (m."CO_MODELO" = 'SI26-ALSE') desc, m."CO_MODELO"
     limit 1;
    if v_modelo."CO_MODELO" is not null then
      v_config_analise := v_modelo."DS_CONFIGURACAO"
        || jsonb_build_object('modelo', v_modelo."CO_MODELO", 'edital_rotulo', 'Edital ' || c_numero || ' (TREINAMENTO)');
      perform private."FC_VALIDAR_REGRA_ANALISE"(v_config_analise);
      insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_MODELO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
      values (v_id, 1, v_modelo."CO_MODELO", v_uid)
      returning "CO_REGRA_ANALISE" into v_regra_analise;
      insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
      values (v_regra_analise, 1, v_config_analise, encode(sha256(convert_to(v_config_analise::text, 'UTF8')), 'hex'),
              'Edital de treinamento: copiada do modelo ' || v_modelo."CO_MODELO", v_uid);
    end if;
  end if;

  return v_id;
end;
$$;
comment on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) is
  'Cria ou completa (idempotente) o edital de treinamento da área: edital com ST_TREINAMENTO = S, cronograma relativo a hoje, quadro de vagas, 15 candidatos fictícios (análise, lista de convocação, inscrição Empregare), roteiro de exemplo, regras da classificação e da avaliação documental. Só a Saúde Indígena por enquanto. Devolve o id do edital.';
revoke all on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) from public, anon, authenticated;
grant execute on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) to service_role;

drop function if exists private."FC_EXIGIR_NOTA_NA_ESCALA"(uuid, uuid, numeric);

-- 3. Tabelas.
drop table if exists public."TB_ENTREVISTA_AVALIACAO_ASPECTO";
drop table if exists public."TB_ROTEIRO_ASPECTO";
comment on column public."TH_ENTREVISTA_AVALIACAO"."DS_CAMPO" is 'nota, compareceu, convocacao ou desconvocacao.';

notify pgrst, 'reload schema';

commit;
