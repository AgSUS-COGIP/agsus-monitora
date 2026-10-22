-- Desfaz 20261019150000_fila_parcial_sem_montar_tudo.sql: volta as definições vigentes em
-- 19/10/2026 (tiradas do banco com pg_get_functiondef) de obter_fila_avaliacao,
-- obter_fila_avaliacao_desde e private."FC_LINHAS_DA_FILA" (cinco argumentos), apaga
-- private."FC_FILA_AVALIACAO_JSON", a versão de seis argumentos de FC_LINHAS_DA_FILA e o
-- índice IN_PRECLASSIF_FILA. O contrato das RPCs é o mesmo nos dois lados: o front não muda;
-- a fila parcial volta a montar a fila inteira por dentro.
begin;

set local lock_timeout = '10s';

-- 1. As RPCs de antes (a de antes de obter_fila_avaliacao não chama FC_FILA_AVALIACAO_JSON).
CREATE OR REPLACE FUNCTION public.obter_fila_avaliacao(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_so_minhas_vagas boolean := coalesce(v_papel, '') = 'ANALISTA';
  v_vagas text[];
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  -- O analista vê só as vagas que analisa: a permissão é avaliada uma vez por vaga (não por inscrito).
  if v_so_minhas_vagas then
    v_vagas := private."FC_VAGAS_DO_ANALISTA"(p_edital, v_uid);
  end if;
  return json_build_object(
    'schema_version', 2,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'area', v_area,
                                'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital)),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_pegar', private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, null),
    'eu', v_uid,
    'prazo_reserva_min', extract(epoch from private."FC_PRAZO_RESERVA_FICHA"())::integer / 60,
    'distribuicao', private."FC_DISTRIBUICAO_DO_EDITAL"(p_edital),
    'sem_ficha', (select count(*) from public."TB_PRE_CLASSIFICACAO" p
                   where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
                     and not exists (select 1 from public."TB_FICHA_ANALISE" f
                                      where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")),
    'vagas', coalesce((
      select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO")
                      order by pv."CO_VAGA")
        from public."TB_PRE_CLASSIF_VAGA" pv
       where pv."CO_MONITORAMENTO" = p_edital
         and (v_vagas is null or pv."CO_VAGA" = any (v_vagas))), '[]'::json),
    'analistas', private."FC_ANALISTAS_DO_EDITAL"(p_edital, true),
    'filtros', private."FC_FILTROS_FILA_JSON"(v_uid),
    'fora_do_lote', (
      select json_build_object(
               'total', count(*),
               'eliminados', count(*) filter (where a."TP_SITUACAO" = 'ELIMINADO'),
               'ranqueados', count(*) filter (where a."TP_SITUACAO" = 'RANQUEADO'),
               'modalidades', coalesce(json_agg(distinct a."NO_MODALIDADE") filter (where a."NO_MODALIDADE" is not null), '[]'::json),
               -- Muda quando a pré-classificação ou uma ficha de fora do lote muda: a tela relê a lista de fora.
               'versao', md5(concat_ws('|', count(*), max(a."DT_ATUALIZACAO"), max(f."NU_VERSAO"), sum(f."NU_VERSAO"),
                                       count(f."CO_FICHA_ANALISE"), max(f."DT_RESERVA_EXPIRA"))))
        from public."TB_PRE_CLASSIFICACAO" a
        left join public."TB_FICHA_ANALISE" f
          on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
       where a."CO_MONITORAMENTO" = p_edital
         and (v_vagas is null or a."CO_VAGA" = any (v_vagas))
         and not private."FC_NO_NUCLEO_DA_FILA"(a."TP_SITUACAO", f."TP_SITUACAO")),
    'candidatos', coalesce((
      select json_agg(l.linha order by l.vaga, l.eliminado, l.posicao, l.codigo)
        from private."FC_LINHAS_DA_FILA"(p_edital, v_vagas, true, null, null) l), '[]'::json)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.obter_fila_avaliacao_desde(p_edital uuid, p_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, p_marca text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- Primeiro a fila de sempre: a permissão, a área e o recorte do analista são os dela.
  v json := public.obter_fila_avaliacao(p_edital);
  v_marca text;
  v_ids uuid[];
begin
  if v is null then
    return null;
  end if;
  select md5(concat_ws('|', count(*), max(a."DT_ATUALIZACAO"), max(a."CO_EXECUCAO"),
                       v ->> 'eu', v ->> 'papel', (v -> 'vagas')::text))
    into v_marca
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital;

  if p_desde is null or p_marca is null or p_marca <> v_marca then
    return (
      select json_object_agg(x.k, x.v order by x.o)
        from (select t.k, t.v, t.o from json_each(v) with ordinality t(k, v, o)
              union all select 'marca', to_json(v_marca), 100000
              union all select 'parcial', to_json(false), 100001) x);
  end if;

  select coalesce(array_agg(f."CO_EMPREGARE_CANDIDATO"), '{}'::uuid[])
    into v_ids
    from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = p_edital
     and (f."DT_ATUALIZACAO" >= p_desde - interval '2 minutes'
          or f."DT_RESERVA_EXPIRA" >= p_desde - interval '2 minutes');

  return (
    select json_object_agg(x.k, x.v order by x.o)
      from (select t.k, t.v, t.o
              from json_each(v) with ordinality t(k, v, o)
             where t.k not in ('candidatos', 'vagas')
            union all select 'marca', to_json(v_marca), 100000
            union all select 'parcial', to_json(true), 100001
            union all select 'total_nucleo', to_json(coalesce(json_array_length(v -> 'candidatos'), 0)), 100002
            union all
            select 'candidatos', coalesce((
                     select json_agg(e.linha order by e.o)
                       from json_array_elements(coalesce(v -> 'candidatos', '[]'::json)) with ordinality e(linha, o)
                      where (e.linha ->> 'id')::uuid = any (v_ids)), '[]'::json), 100003
            union all
            select 'saiu', coalesce((
                     select json_agg(i)
                       from unnest(v_ids) i
                      where not exists (select 1 from json_array_elements(coalesce(v -> 'candidatos', '[]'::json)) e
                                         where (e ->> 'id')::uuid = i)), '[]'::json), 100004) x);
end;
$function$;

-- 2. As linhas da fila com cinco argumentos.
drop function if exists private."FC_FILA_AVALIACAO_JSON"(uuid, uuid[]);
drop function if exists private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer, uuid[]);

CREATE OR REPLACE FUNCTION private."FC_LINHAS_DA_FILA"(p_edital uuid, p_vagas text[], p_nucleo boolean, p_apos uuid, p_limite integer)
 RETURNS TABLE(id uuid, vaga text, eliminado boolean, posicao integer, codigo text, linha json)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- p_vagas nulo = todas as vagas; p_limite nulo = sem limite (o núcleo vem inteiro).
  select a."CO_EMPREGARE_CANDIDATO",
         a."CO_VAGA"::text,
         a."TP_SITUACAO" = 'ELIMINADO',
         a."NU_POSICAO",
         c."CO_CANDIDATO_EMPREGARE"::text,
         -- Sem as chaves nulas (a tela trata ausente como nulo): o JSON do lote cai pela metade.
         json_strip_nulls(json_build_object(
           'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA", 'codigo', c."CO_CANDIDATO_EMPREGARE",
           'nome', c."NO_CANDIDATO", 'situacao_pre', a."TP_SITUACAO", 'motivo_eliminacao', a."DS_MOTIVO_ELIMINACAO",
           'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE", 'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM",
           'modalidade', a."NO_MODALIDADE", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'entrada', a."TP_ENTRADA_LOTE",
           'decisao', case when a."TP_ENTRADA_LOTE" = 'DECISAO' then a."DS_MOTIVO_ENTRADA" end,
           'ficha', case when f."CO_FICHA_ANALISE" is null then null else json_build_object(
             'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'situacao', f."TP_SITUACAO",
             'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
             'atribuida_em', f."DT_ATRIBUICAO", 'motivo_saida', f."DS_MOTIVO_SAIDA", 'lote', f."NU_LOTE",
             'resultado', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."TP_RESULTADO" end,
             'nota_final', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."VL_NOTA_FINAL" end,
             'concluida_em', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."DT_CONCLUSAO" end,
             'rascunho_em', f."DT_RASCUNHO",
             'reserva', case when f."DT_RESERVA_EXPIRA" > now() then json_build_object(
               'usuario', f."CO_USUARIO_RESERVA", 'nome', coalesce(uv.nome, uv.email),
               'desde', f."DT_RESERVA", 'expira', f."DT_RESERVA_EXPIRA") end) end))
    from public."TB_PRE_CLASSIFICACAO" a
    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
    left join public."TB_FICHA_ANALISE" f
      on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
    left join public."TB_PERFIL_USUARIO" ur on ur.user_id = f."CO_USUARIO_RESPONSAVEL"
    left join public."TB_PERFIL_USUARIO" uv on uv.user_id = f."CO_USUARIO_RESERVA"
   where a."CO_MONITORAMENTO" = p_edital
     and (p_vagas is null or a."CO_VAGA" = any (p_vagas))
     and private."FC_NO_NUCLEO_DA_FILA"(a."TP_SITUACAO", f."TP_SITUACAO") = p_nucleo
     and (p_apos is null or a."CO_EMPREGARE_CANDIDATO" > p_apos)
   order by a."CO_EMPREGARE_CANDIDATO"
   limit p_limite;
$function$;

revoke all on function private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer) from public, anon, authenticated;

comment on function private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer) is
  'Linhas da fila da avaliação documental (o JSON de cada inscrito, sem as chaves nulas, com a ficha, a reserva vigente e a decisão da coordenação), de uma partição (p_nucleo: FC_NO_NUCLEO_DA_FILA), das vagas p_vagas (nulo = todas), em ordem do id do inscrito, depois de p_apos e até p_limite (nulo = sem limite). Sem conferência de permissão: quem chama confere.';

comment on function public.obter_fila_avaliacao(uuid) is
  'A fila da avaliação documental do edital (json, schema_version 2): papel de quem está logado (coordena, pode pegar), a distribuição da regra, os inscritos do núcleo (no lote ou com ficha viva: FC_NO_NUCLEO_DA_FILA) com a entrada no lote, o motivo da decisão da coordenação e a ficha (situação, responsável, reserva vigente, versão, rascunho e, concluída, resultado e nota; nome do candidato, sem CPF nem contato), as contagens e a versão dos de fora do lote (fora_do_lote; as linhas vêm de obter_fila_fora_do_lote), as vagas, os analistas com as pendentes, quantos do lote ainda estão sem ficha e os filtros salvos de quem chama. O analista vê só as vagas que analisa (permissão avaliada por vaga). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

comment on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) is
  'obter_fila_avaliacao só com o que mudou (20261014231000): sem p_desde ou com outra marca, a fila inteira com marca e parcial false; com o gerado_em e a marca da leitura anterior, só as linhas do núcleo cuja ficha mudou (ou cuja reserva vence) desde p_desde − 2 min, os ids que saíram do núcleo (saiu), total_nucleo e o resto da fila sem vagas. Mesma permissão.';

-- 3. O índice da fila.
drop index if exists public."IN_PRECLASSIF_FILA";

notify pgrst, 'reload schema';

commit;
