/*
  A NOTA DA ENTREVISTA PODE ARREDONDAR A MÉDIA DOS AVALIADORES ANTES DO PESO (16/11/2026)

  POR QUE
  O 93/2026 teve as entrevistas importadas das planilhas da banca (20261117010000). A planilha
  arredonda a média dos dois avaliadores em 2 casas e depois aplica o peso, sem arredondar a nota
  da competência; o total sai em 2 casas. O sistema aplica o peso à média e arredonda cada
  competência. Em 18 das 25 entrevistas com comparecimento a nota final ficou 0,01 ou 0,02
  diferente da planilha (8,29 × 8,30), com os mesmos pareceres. Pedido: igual à banca.

  O QUE MUDA
    - TB_ENTREVISTA_EDITAL."TP_ARREDONDAMENTO": NOTA (o padrão, como sempre) ou MEDIA (a média
      dos avaliadores em 2 casas antes do peso; a nota da competência sem arredondar na soma e no
      mínimo; o total em 2 casas). Vale por edital: o roteiro do 93/2026 também é do 96/2025.
    - private."FC_CALCULAR_ENTREVISTA" segue o arredondamento do edital (a tela e o Python fazem a
      mesma conta: calcularEntrevista e monitora.entrevistas.calculo, com os casos dourados).
    - public.obter_entrevistas_do_edital devolve configuracao.arredondamento (a prévia da ficha).
    - O 93/2026 passa a MEDIA e as entrevistas dele são recalculadas.

  GUARDA: o corpo das duas funções é o de 16/11/2026 (md5 do prosrc sem \r).
  Ensaio: supabase/ensaios/20261117020000_entrevista_arredonda_a_media_como_a_banca.sql
  Rollback: supabase/rollback/20261117020000_entrevista_arredonda_a_media_como_a_banca.sql
*/

begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_CALCULAR_ENTREVISTA"(uuid)')), chr(13), ''))
       is distinct from '945851147aaffe20fb4beefdb8130c10' then
    raise exception 'FC_CALCULAR_ENTREVISTA mudou desde 16/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.obter_entrevistas_do_edital(uuid)')), chr(13), ''))
       is distinct from 'bd7b9e91267035fb11aac143653dc4b3' then
    raise exception 'obter_entrevistas_do_edital mudou desde 16/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
end
$guarda$;

alter table public."TB_ENTREVISTA_EDITAL"
  add column "TP_ARREDONDAMENTO" character varying(5) default 'NOTA' not null,
  add constraint "CK_ENTREVISTAEDITAL_TPARREDONDAMENTO" check (("TP_ARREDONDAMENTO")::text = any (array['NOTA'::text, 'MEDIA'::text]));

comment on column public."TB_ENTREVISTA_EDITAL"."TP_ARREDONDAMENTO" is
  'Como a nota da entrevista arredonda: NOTA (padrão) = cada competência (média × peso) em 2 casas e o total = soma; MEDIA = a média dos avaliadores em 2 casas antes do peso, a nota da competência sem arredondar na soma e no mínimo, o total em 2 casas (como a planilha da banca; 20261117020000).';
comment on constraint "CK_ENTREVISTAEDITAL_TPARREDONDAMENTO" on public."TB_ENTREVISTA_EDITAL" is 'Modos de arredondamento.';

CREATE OR REPLACE FUNCTION private."FC_CALCULAR_ENTREVISTA"(p_entrevista uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_e public."TB_ENTREVISTA";
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_avaliadores integer;
  v_total numeric := 0;
  v_bruto numeric := 0;
  v_soma numeric;
  v_falta boolean := false;
  v_reprova boolean := false;
  v_qt_aspectos integer;
  c record;
  v_media numeric;
  v_nota numeric;
  v_minimo numeric;
  -- MEDIA (16/11/2026): a média dos avaliadores arredondada em 2 casas antes do peso, a nota da
  -- competência sem arredondar na soma e no mínimo, o total em 2 casas (como a planilha da banca).
  v_pela_media boolean;
  v_exata numeric;
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista for update;
  if v_e."CO_ROTEIRO" is null then return; end if;
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";
  select coalesce(ee."TP_ARREDONDAMENTO", 'NOTA') = 'MEDIA' into v_pela_media
    from public."TB_ENTREVISTA_EDITAL" ee where ee."CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO";
  v_pela_media := coalesce(v_pela_media, false);
  select count(*) into v_qt_aspectos from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_r."CO_ROTEIRO";

  -- A média é de quem lançou e avalia a competência; com aspectos, de quem lançou todos os aspectos.
  for c in
    select k.*, row_number() over (order by k."NU_ORDEM") ord
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_r."CO_ROTEIRO" order by k."NU_ORDEM"
  loop
    if v_qt_aspectos > 0 then
      -- Nota do avaliador = média dos aspectos, sem arredondar; competência = média dos avaliadores.
      select avg(m.media), count(*) into v_media, v_avaliadores
        from (select avg(x."VL_NOTA") media
                from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" x
                join public."TB_ROTEIRO_ASPECTO" s on s."CO_ASPECTO" = x."CO_ASPECTO" and s."CO_ROTEIRO" = v_r."CO_ROTEIRO"
               where x."CO_ENTREVISTA" = p_entrevista and x."CO_COMPETENCIA" = c."CO_COMPETENCIA"
                 and private."FC_AVALIADOR_AVALIA"(x."CO_AVALIADOR", c."CO_COMPETENCIA")
               group by x."CO_AVALIADOR"
              having count(*) = v_qt_aspectos) m;
    else
      select avg(a."VL_NOTA"), count(*) into v_media, v_avaliadores
        from public."TB_ENTREVISTA_AVALIACAO" a
       where a."CO_ENTREVISTA" = p_entrevista and a."CO_COMPETENCIA" = c."CO_COMPETENCIA"
         and private."FC_AVALIADOR_AVALIA"(a."CO_AVALIADOR", c."CO_COMPETENCIA");
    end if;
    if v_avaliadores = 0 then
      v_falta := true;
      update public."TB_ENTREVISTA_NOTA" set "VL_NOTA" = null
       where "CO_ENTREVISTA" = p_entrevista and "NU_ORDEM" = c.ord;
      continue;
    end if;
    if v_pela_media then
      v_media := round(v_media, 2);
    end if;
    v_exata := v_media * c."VL_PESO";
    v_nota := round(v_exata, 2);
    v_total := v_total + case when v_pela_media then v_exata else v_nota end;
    v_bruto := v_bruto + v_media * c."VL_PESO";
    insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
    values (p_entrevista, c.ord, left(c."NO_COMPETENCIA", 600), v_nota)
    on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA";
    if c."VL_MINIMO" is not null then
      v_minimo := case when c."TP_MINIMO" = 'PERCENTUAL'
                       then c."VL_NOTA_MAXIMA" * c."VL_PESO" * c."VL_MINIMO" / 100.0 else c."VL_MINIMO" end;
      if (case when v_pela_media then v_exata else v_nota end) < v_minimo then v_reprova := true; end if;
    end if;
    -- Notas eliminatórias são valores exatos (ex.: 0 e 1): só sem aspectos (com aspectos vale o mínimo).
    if v_qt_aspectos = 0 and exists (select 1 from jsonb_array_elements_text(v_r."DS_NOTAS_ELIMINATORIAS") x
                where round(v_media, 2) = x::numeric) then
      v_reprova := true;
    end if;
  end loop;

  -- Sem aspectos: soma das competências (2 casas). Com aspectos: soma sem arredondar, 2 casas no fim.
  v_soma := case when v_qt_aspectos > 0 then round(v_bruto, 2) else round(v_total, 2) end;

  update public."TB_ENTREVISTA" set
    "VL_NOTA_TOTAL" = case when "ST_COMPARECEU" = 'N' then 0 when v_falta and v_soma = 0 then null else v_soma end,
    "TP_PARECER" = case
      when "ST_COMPARECEU" = 'N' and v_r."ST_AUSENCIA_ELIMINA" = 'S' then 'INAPTO'
      when "ST_COMPARECEU" is distinct from 'S' or v_falta then 'SEM_PARECER'
      when v_reprova or (v_r."VL_NOTA_MINIMA_TOTAL" is not null and v_soma < v_r."VL_NOTA_MINIMA_TOTAL") then 'INAPTO'
      else 'APTO' end,
    "DT_ATUALIZACAO" = now()
   where "CO_ENTREVISTA" = p_entrevista;
end;
$$;

CREATE OR REPLACE FUNCTION public.obter_entrevistas_do_edital(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
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
        'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO",
        'arredondamento', coalesce(v_cfg."TP_ARREDONDAMENTO", 'NOTA')) end,
    'regra_classificacao', (
      select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'convocacao', h."DS_CONFIGURACAO" -> 'convocacao',
                               'desempate', h."DS_CONFIGURACAO" -> 'desempate',
                               'empate_final', h."DS_CONFIGURACAO" -> 'empate_final')
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
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S',
               -- As competências que o membro avalia (do roteiro do edital); nulo = todas.
               'competencias', (select json_agg(l."CO_COMPETENCIA" order by k."NU_ORDEM")
                   from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
                   join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = l."CO_COMPETENCIA"
                  where l."CO_AVALIADOR" = b."CO_AVALIADOR" and k."CO_ROTEIRO" = v_cfg."CO_ROTEIRO"))
             order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'justificativa', e."DS_JUSTIFICATIVA_BANCA",
               'observacoes', coalesce((select json_agg(json_build_object('avaliador', o."CO_AVALIADOR", 'texto', o."DS_OBSERVACAO",
                      'atualizado_em', o."DT_ATUALIZACAO") order by o."DT_ATUALIZACAO")
                   from public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" o where o."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA",
                      'aspectos', coalesce((select json_agg(json_build_object('aspecto', y."CO_ASPECTO", 'nota', y."VL_NOTA"))
                          from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" y
                         where y."CO_ENTREVISTA" = x."CO_ENTREVISTA" and y."CO_COMPETENCIA" = x."CO_COMPETENCIA"
                           and y."CO_AVALIADOR" = x."CO_AVALIADOR"), '[]'::json)))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$$;

-- O 93/2026 (planilhas da banca importadas): MEDIA, e as entrevistas recalculadas.
do $edital93$
declare
  v_edital constant uuid := 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded';
  v_e uuid;
  v_n integer := 0;
begin
  update public."TB_ENTREVISTA_EDITAL" set "TP_ARREDONDAMENTO" = 'MEDIA', "DT_ATUALIZACAO" = now()
   where "CO_MONITORAMENTO" = v_edital;
  if not found then
    raise notice '93/2026 sem configuração de entrevista: nada a recalcular';
    return;
  end if;
  for v_e in select e."CO_ENTREVISTA" from public."TB_ENTREVISTA" e
              where e."CO_MONITORAMENTO" = v_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'
  loop
    perform private."FC_CALCULAR_ENTREVISTA"(v_e);
    v_n := v_n + 1;
  end loop;
  raise notice '93/2026: % entrevista(s) recalculada(s) com a média da banca', v_n;
end
$edital93$;

commit;
