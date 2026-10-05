-- Desfaz 20261002210000_chat: tira as RPCs, as funções, as policies do Realtime,
-- as tabelas (saem da publicação supabase_realtime junto) e o recurso de
-- permissão 'chat'.
-- ATENÇÃO: apaga todas as conversas e mensagens. Exporte antes, se precisar guardar:
--   select * from public."TB_MENSAGEM";
begin;

drop function if exists public.abrir_conversa_edital_chat(uuid);
drop function if exists public.silenciar_conversa_chat(uuid, boolean);
drop function if exists public.sair_conversa_chat(uuid);
drop function if exists public.adicionar_participantes_chat(uuid, uuid[]);
drop function if exists public.criar_grupo_chat(text, uuid[]);
drop function if exists public.abrir_conversa_direta_chat(uuid);
drop function if exists public.marcar_conversa_lida_chat(uuid, timestamptz);
drop function if exists public.apagar_mensagem_chat(uuid);
drop function if exists public.editar_mensagem_chat(uuid, text);
drop function if exists public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid);
drop function if exists public.listar_pessoas_chat(text);
drop function if exists public.listar_mensagens_chat(uuid, timestamptz, integer);
drop function if exists public.listar_conversas_chat();
drop function if exists private."FC_CHAT_PARTICIPANTES_VALIDOS"(uuid[], uuid);
drop function if exists private."FC_CHAT_CONVERSA_JSON"(uuid, uuid);
drop function if exists private."FC_CHAT_MENSAGEM_JSON"(uuid);
drop function if exists private."FC_CHAT_PESSOA"(uuid);

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "PL_CHAT_REALTIME_LEITURA" on realtime.messages';
    execute 'drop policy if exists "PL_CHAT_REALTIME_ENVIO" on realtime.messages';
  end if;
end;
$$;

-- drop table tira a tabela da publicação supabase_realtime.
drop table if exists public."TB_MENSAGEM";
drop table if exists public."RL_CONVERSA_PARTICIPANTE";
drop table if exists public."TB_CONVERSA";

drop function if exists private."FC_CHAT_VALIDAR_LINK"(jsonb);
drop function if exists private."FC_CHAT_VALIDAR_TEXTO"(text);
drop function if exists private."FC_CHAT_EXIGIR_CONVERSA"(uuid);
drop function if exists private."FC_CHAT_USUARIO_LIBERADO"(uuid);
drop function if exists private."FC_CHAT_PODE_TOPICO"(text);
drop function if exists private."FC_CHAT_PODE_LER"(uuid);
drop function if exists private."FC_CHAT_EXIGIR"();

delete from public."TB_PERMISSAO_RECURSO" where recurso = 'chat';
delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'chat';
alter table public."TB_PERMISSAO_RECURSO" drop constraint if exists "CK_PERMISSAORECURSO_CHAT";
alter table public."TA_GRUPO_ACESSO_RECURSO" drop constraint if exists "CK_GRUPACESSOREC_CHAT";
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao']::text[];
$function$;

notify pgrst, 'reload schema';

commit;
