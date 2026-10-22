-- Desfaz a carga supabase/correcoes/20261002-pendencias-das-coordenadas-do-mapa.sql.
-- Tira só as pendências ainda não conferidas; as conferidas ficam (são o registro do que foi
-- validado, ligado ao histórico). Coordenadas e histórico não mudam.
begin;
delete from private."TB_PENDENCIA_COORDENADA_MAPA" where "ST_CONFERIDO" = 'N';
commit;
