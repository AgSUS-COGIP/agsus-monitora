-- Desfaz 20261014161000: devolve as tabelas do chat ao schema public.
begin;
alter table arquivo."RL_CONVERSA_PARTICIPANTE" set schema public;
alter table arquivo."RL_MENSAGEM_REACAO" set schema public;
alter table arquivo."TB_ANEXO_MENSAGEM" set schema public;
alter table arquivo."TB_CONVERSA" set schema public;
alter table arquivo."TB_EXPURGO_ANEXO_CHAT" set schema public;
alter table arquivo."TB_MENSAGEM" set schema public;
alter table arquivo."TB_RETENCAO_CHAT" set schema public;
alter table arquivo."TB_STATUS_PRESENCA_CHAT" set schema public;
alter table arquivo."TH_LIMPEZA_CHAT" set schema public;
alter table arquivo."TL_EXPURGO_ANEXO_CHAT" set schema public;
commit;
