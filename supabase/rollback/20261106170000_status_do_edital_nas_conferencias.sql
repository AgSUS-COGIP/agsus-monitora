-- Volta conferencia_ler_contexto sem o "status" de cada edital (versão de 20261005210000).
-- O robô continua funcionando: sem "status", regras.edital_conferido usa só o "ativo".
begin;

create or replace function public.conferencia_ler_contexto()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
    'editais', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', m.id, 'numero', private."FC_NUMERO_EDITAL"(m.edital), 'area', m."CO_AREA",
          'ativo', coalesce(m.ativo, false)) order by m."CO_AREA", m.edital), '[]'::jsonb)
        from public."TB_MONITORAMENTO_INDIGENA" m
    ),
    'regras', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', r."CO_MONITORAMENTO",
          'versao', r."NU_VERSAO_VIGENTE",
          'nota_minima', h."DS_CONFIGURACAO" #> '{documental,nota_minima}',
          'teto_experiencia', h."DS_CONFIGURACAO" #> '{documental,teto_experiencia}')), '[]'::jsonb)
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    )
  );
$function$;

commit;
