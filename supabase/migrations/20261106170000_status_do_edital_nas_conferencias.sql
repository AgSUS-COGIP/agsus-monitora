/*
  Conferências: o status do edital no contexto do robô.

  Motivo: o robô das conferências (scripts/conferencias/) passa a deixar de
  fora, na vaga sem linha no quadro (CLASSIFICACAO_VAGA_SEM_QUADRO) e no
  candidato em dois editais (ANALISE_EM_DOIS_EDITAIS), o edital Concluído,
  Cancelado ou Encerrado (regras.edital_conferido; Suspenso continua). O
  filtro fica no Python; o que falta é o dado: public.conferencia_ler_contexto
  entregava só id, número, área e ativo. Ex.: o 30/2026 (projetos, Concluído,
  sem quadro) era acusado com 24 vagas.

  O que muda: cada edital de "editais" ganha "status"
  (TB_MONITORAMENTO_INDIGENA.status, que já traz a situação manual aplicada:
  hoje Em andamento, Concluído, Cancelado, Suspenso). O resto do JSON é igual
  ao de 20261005210000 (schema_version 1: chave nova, quem não a lê ignora).
  Grants não mudam (create or replace: só service_role).

  Dependentes: scripts/conferencias/conferencias.py e regras.py (PR das
  conferências sem editais concluídos). Sem o "status", o robô usa só o
  "ativo", como antes: a ordem de aplicação não importa.
  O aviso que existia some sozinho: finalizar_conferencia resolve todo aviso
  aberto de conferência que rodou inteira e não foi gravado de novo.

  Ensaio: supabase/ensaios/20261106170000_status_do_edital_nas_conferencias.sql
  Rollback: supabase/rollback/20261106170000_status_do_edital_nas_conferencias.sql
*/
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
          'ativo', coalesce(m.ativo, false), 'status', m.status) order by m."CO_AREA", m.edital), '[]'::jsonb)
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
