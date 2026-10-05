-- Desfaz 20261005190000_chat_retencao_das_mensagens: tira a tarefa diária
-- agsus_chat_retencao_diaria, as RPCs obter_retencao_chat, salvar_retencao_chat e
-- zerar_mensagens_chat, as peças internas, as tabelas TB_RETENCAO_CHAT e
-- TH_LIMPEZA_CHAT e volta o comentário de TB_MENSAGEM. As mensagens voltam a
-- ficar guardadas para sempre.
-- ATENÇÃO: NÃO recupera nada do que o prazo ou o "Zerar mensagens" já apagaram
-- (a exclusão foi real; só um backup do banco anterior à limpeza traria de volta).
-- E perde o histórico das limpezas. Exporte antes, se precisar guardar:
--   select * from public."TH_LIMPEZA_CHAT";
begin;

do $$
begin
  if to_regclass('cron.job') is not null
     and exists (select 1 from cron.job where jobname = 'agsus_chat_retencao_diaria') then
    perform cron.unschedule('agsus_chat_retencao_diaria');
  end if;
end;
$$;

drop function if exists public.zerar_mensagens_chat(text, text, boolean);
drop function if exists public.salvar_retencao_chat(integer, text);
drop function if exists public.obter_retencao_chat();
drop function if exists private."FC_CHAT_RETENCAO_DIARIA"();
drop function if exists private."FC_CHAT_APAGAR_MENSAGENS"(timestamptz);
drop function if exists private."FC_CHAT_VALIDAR_MOTIVO"(text);
drop function if exists private."FC_CHAT_EMAIL"(uuid);
drop function if exists private."FC_CHAT_EXIGIR_ADMIN"();

drop table if exists public."TH_LIMPEZA_CHAT";
drop table if exists public."TB_RETENCAO_CHAT";

comment on table public."TB_MENSAGEM" is
  'Mensagens do chat. Editar guarda DT_EDICAO; apagar é lógico (ST_APAGADA = S: texto, link e menções saem, a linha fica como "mensagem apagada"). Sem DELETE físico.';

notify pgrst, 'reload schema';

commit;
