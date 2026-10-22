-- Desfaz a carga supabase/correcoes/20261002-pendencias-das-coordenadas-dos-projetos.sql.
-- Tira as pendências ainda não conferidas (as conferidas ficam: são o registro do que foi
-- validado, ligado ao histórico) e as coordenadas que a carga criou e ninguém mudou no editor
-- (TP_ORIGEM SEDE_IBGE ou CENTRO_UF). Sem coordenada no banco, o lugar aparece no mapa de
-- Projetos como "sem coordenada" até rodar a carga de novo ou gravar pelo editor.
begin;
delete from private."TB_PENDENCIA_COORDENADA_LOCAL" where "ST_CONFERIDO" = 'N';
delete from public."TB_COORDENADA_LOCAL_VAGA" where "TP_ORIGEM" in ('SEDE_IBGE', 'CENTRO_UF');
commit;
