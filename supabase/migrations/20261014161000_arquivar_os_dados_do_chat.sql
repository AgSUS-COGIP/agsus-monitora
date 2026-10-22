/*
  ARQUIVAR OS DADOS DO CHAT

  Por quê: o chat saiu do sistema (20261014160000_desligar_o_chat) e o
  usuário pediu para tirar também as mensagens, conversas e anexos. Regra do
  projeto: dado não se apaga (nunca DROP) — tabela morta vai para o schema
  "arquivo", sem acesso de anon/authenticated. As funções do chat continuam
  existindo, mas já sem permissão (revogadas na migration anterior); se alguém
  chamar, falham por não achar a tabela em public.

  Rollback: supabase/rollback/20261014161000_arquivar_os_dados_do_chat.sql
*/
begin;

create schema if not exists arquivo;
revoke all on schema arquivo from public, anon, authenticated;

alter table public."RL_CONVERSA_PARTICIPANTE" set schema arquivo;
revoke all on arquivo."RL_CONVERSA_PARTICIPANTE" from public, anon, authenticated;
alter table public."RL_MENSAGEM_REACAO" set schema arquivo;
revoke all on arquivo."RL_MENSAGEM_REACAO" from public, anon, authenticated;
alter table public."TB_ANEXO_MENSAGEM" set schema arquivo;
revoke all on arquivo."TB_ANEXO_MENSAGEM" from public, anon, authenticated;
alter table public."TB_CONVERSA" set schema arquivo;
revoke all on arquivo."TB_CONVERSA" from public, anon, authenticated;
alter table public."TB_EXPURGO_ANEXO_CHAT" set schema arquivo;
revoke all on arquivo."TB_EXPURGO_ANEXO_CHAT" from public, anon, authenticated;
alter table public."TB_MENSAGEM" set schema arquivo;
revoke all on arquivo."TB_MENSAGEM" from public, anon, authenticated;
alter table public."TB_RETENCAO_CHAT" set schema arquivo;
revoke all on arquivo."TB_RETENCAO_CHAT" from public, anon, authenticated;
alter table public."TB_STATUS_PRESENCA_CHAT" set schema arquivo;
revoke all on arquivo."TB_STATUS_PRESENCA_CHAT" from public, anon, authenticated;
alter table public."TH_LIMPEZA_CHAT" set schema arquivo;
revoke all on arquivo."TH_LIMPEZA_CHAT" from public, anon, authenticated;
alter table public."TL_EXPURGO_ANEXO_CHAT" set schema arquivo;
revoke all on arquivo."TL_EXPURGO_ANEXO_CHAT" from public, anon, authenticated;

commit;
