-- Desfaz 20261005120000_agenda_das_entrevistas: as funções e as tabelas da agenda.
-- ATENÇÃO: apaga as regras da agenda (e as versões), a agenda salva de cada edital
-- e o histórico das gravações. Exporte antes (XLSX da agenda) se precisar guardar.
-- O documento da convocação volta a sair com DATA e HORA em branco.
begin;

drop function if exists public.salvar_agenda_entrevista(uuid, jsonb);
drop function if exists public.salvar_regra_agenda_entrevista(uuid, jsonb, integer, text);
drop function if exists public.obter_agenda_entrevista(uuid);
drop function if exists private."FC_AGENDA_ENTREVISTA_JSON"(uuid);
drop function if exists private."FC_REGRA_AGENDA_JSON"(uuid);
drop function if exists private."FC_VALIDAR_REGRA_AGENDA"(jsonb);
drop function if exists private."FC_EXIGIR_AGENDA_ENTREVISTA"(uuid, integer);

drop table if exists public."TH_AGENDA_ENTREVISTA";
drop table if exists public."TB_AGENDA_ENTREVISTA";
drop table if exists public."TH_REGRA_AGENDA_ENTREVISTA";
drop table if exists public."TB_REGRA_AGENDA_ENTREVISTA";

commit;
