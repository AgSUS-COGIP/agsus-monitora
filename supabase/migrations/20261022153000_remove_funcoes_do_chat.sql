/*
  REMOVE AS FUNÇÕES DO CHAT

  Por quê: o chat saiu do MONITORA em 14/10/2026
  (20261014160000_desligar_o_chat: front, agenda e permissões) e as tabelas
  dele foram para o schema "arquivo" (20261014161000_arquivar_os_dados_do_chat).
  As 54 funções ficaram (0 RPCs em public, já sem EXECUTE de
  authenticated, e 54 auxiliares em private), todas apontando
  para public."TB_CONVERSA", "TB_MENSAGEM"… que não existem mais: quem as
  chamar recebe 42P01. 7 ainda eram executáveis por authenticated
  porque as usavam políticas de RLS:
    private."FC_CHAT_ACABOU_DE_ENVIAR", private."FC_CHAT_PARTICIPA", private."FC_CHAT_PODE_ANEXAR", private."FC_CHAT_PODE_BAIXAR_ANEXO", private."FC_CHAT_PODE_EXPURGAR", private."FC_CHAT_PODE_LER", private."FC_CHAT_PODE_TOPICO".

  Prova de que ninguém chama (22/10/2026): grep em src/, api/, server/,
  python/, scripts/, apps-script/, .github/ e src/lib/rpc-contrato.js sem
  nenhuma das RPCs *_chat nem FC_CHAT_* (só os testes das migrations antigas
  citam os nomes); no banco, nenhuma função fora destas cita FC_CHAT_, as
  RPCs *_chat nem TB_CONVERSA/TB_MENSAGEM (FC_APAGAR_DADOS_DO_TREINAMENTO
  citava: 20261022152000 a corrige antes desta); pg_depend só liga estas
  funções às 5 políticas abaixo.

  O que faz: tira as políticas que usam as funções — a de leitura do bucket
  chat-anexos em storage.objects (as de INSERT e DELETE já tinham saído em
  20261014160000; sem ela só a service_role lê o bucket, que tem 1 arquivo)
  e as 4 de leitura das tabelas arquivadas (o schema "arquivo" não tem grant
  para authenticated: não davam acesso a nada) — e depois as funções, sem
  CASCADE (se surgir dependência nova, a migration para em vez de levar
  algo junto). Dados arquivados e o bucket ficam como estão.

  Idempotente (if exists). Depende de 20261022152000.
  Ensaio: supabase/ensaios/20261022153000_remove_funcoes_do_chat.sql
  Rollback: supabase/rollback/20261022153000_remove_funcoes_do_chat.sql (recria as funções, os comentários, os
  privilégios e as políticas a partir do catálogo de 22/10/2026)
*/
begin;

-- Políticas que usam as funções.
drop policy if exists "chat_anexos_storage_select" on storage.objects;
drop policy if exists "PL_CONVERSA_LEITURA" on arquivo."TB_CONVERSA";
drop policy if exists "PL_CONVPARTICIP_LEITURA" on arquivo."RL_CONVERSA_PARTICIPANTE";
drop policy if exists "PL_MENSREACAO_LEITURA" on arquivo."RL_MENSAGEM_REACAO";
drop policy if exists "PL_MENSAGEM_LEITURA" on arquivo."TB_MENSAGEM";

-- As funções (54).
drop function if exists private."FC_CHAT_ACABOU_DE_ENVIAR"(text);
drop function if exists private."FC_CHAT_ANEXOS_JSON"(uuid);
drop function if exists private."FC_CHAT_APAGAR_MENSAGENS"(timestamp with time zone);
drop function if exists private."FC_CHAT_CONVERSA_JSON"(uuid,uuid);
drop function if exists private."FC_CHAT_EMAIL"(uuid);
drop function if exists private."FC_CHAT_EXIGIR"();
drop function if exists private."FC_CHAT_EXIGIR_ADMIN"();
drop function if exists private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"();
drop function if exists private."FC_CHAT_EXIGIR_CONVERSA"(uuid);
drop function if exists private."FC_CHAT_MENSAGEM_JSON"(uuid);
drop function if exists private."FC_CHAT_PARTICIPA"(uuid);
drop function if exists private."FC_CHAT_PARTICIPANTES_VALIDOS"(uuid[],uuid);
drop function if exists private."FC_CHAT_PESSOA"(uuid);
drop function if exists private."FC_CHAT_PODE_ANEXAR"(text);
drop function if exists private."FC_CHAT_PODE_BAIXAR_ANEXO"(text);
drop function if exists private."FC_CHAT_PODE_EXPURGAR"(text);
drop function if exists private."FC_CHAT_PODE_LER"(uuid);
drop function if exists private."FC_CHAT_PODE_TOPICO"(text);
drop function if exists private."FC_CHAT_REACOES"();
drop function if exists private."FC_CHAT_RETENCAO_DIARIA"();
drop function if exists private."FC_CHAT_SEM_ACENTO"(text);
drop function if exists private."FC_CHAT_TIPOS_ANEXO"();
drop function if exists private."FC_CHAT_TRECHO"(text,text);
drop function if exists private."FC_CHAT_USUARIO_LIBERADO"(uuid);
drop function if exists private."FC_CHAT_VALIDAR_LINK"(jsonb);
drop function if exists private."FC_CHAT_VALIDAR_MOTIVO"(text);
drop function if exists private."FC_CHAT_VALIDAR_TEXTO"(text);
drop function if exists abrir_conversa_direta_chat(uuid);
drop function if exists abrir_conversa_edital_chat(uuid);
drop function if exists adicionar_participantes_chat(uuid,uuid[]);
drop function if exists alternar_reacao_chat(uuid,text);
drop function if exists apagar_mensagem_chat(uuid);
drop function if exists buscar_mensagens_chat(text,integer);
drop function if exists confirmar_expurgo_anexos_chat(text[]);
drop function if exists criar_grupo_chat(text,uuid[]);
drop function if exists definir_status_chat(text);
drop function if exists editar_mensagem_chat(uuid,text);
drop function if exists encaminhar_mensagem_chat(uuid,uuid);
drop function if exists enviar_mensagem_chat(uuid,text,jsonb,uuid[],uuid,uuid,jsonb);
drop function if exists fixar_conversa_chat(uuid,boolean);
drop function if exists limpar_conversa_chat(uuid);
drop function if exists listar_conversas_chat();
drop function if exists listar_mensagens_chat(uuid,timestamp with time zone,integer);
drop function if exists listar_pessoas_chat(text);
drop function if exists marcar_conversa_lida_chat(uuid,timestamp with time zone);
drop function if exists marcar_nao_lida_chat(uuid);
drop function if exists obter_mensagem_chat(uuid);
drop function if exists obter_retencao_chat();
drop function if exists preparar_expurgo_anexos_chat();
drop function if exists registrar_expurgo_anexos_chat(text,text,uuid,text,timestamp with time zone,jsonb,text);
drop function if exists sair_conversa_chat(uuid);
drop function if exists salvar_retencao_chat(integer,text);
drop function if exists silenciar_conversa_chat(uuid,boolean);
drop function if exists zerar_mensagens_chat(text,text,boolean);

commit;
