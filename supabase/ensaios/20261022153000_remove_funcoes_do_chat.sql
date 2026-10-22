/*
  ENSAIO de 20261022153000_remove_funcoes_do_chat.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Confere:
    1. a migration tira as 54 funções do chat (public e private) e as 5
       políticas que as usavam, sem levar mais nada (contagem de funções e de
       políticas fora do chat igual);
    2. o rollback devolve as 54 com os mesmos privilégios (proacl) e corpo
       (prosrc), e as 5 políticas com a mesma expressão.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table ensaio_funcoes on commit drop as
  select p.oid::regprocedure::text as sig, p.proacl::text as acl, md5(p.prosrc) as corpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.proname ilike '%chat%';
create temporary table ensaio_politicas on commit drop as
  select schemaname, tablename, policyname, qual from pg_policies
   where policyname in ('chat_anexos_storage_select', 'PL_CONVPARTICIP_LEITURA', 'PL_CONVERSA_LEITURA',
                        'PL_MENSAGEM_LEITURA', 'PL_MENSREACAO_LEITURA');
create temporary table ensaio_contagem on commit drop as
  select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'private') and p.proname not ilike '%chat%') as funcoes,
         (select count(*) from pg_policies) - (select count(*) from ensaio_politicas) as politicas;

do $ensaio$
begin
  assert (select count(*) from ensaio_funcoes) = 54, 'esperava 54 funções do chat antes';
  assert (select count(*) from ensaio_politicas) = 5, 'esperava 5 políticas antes';
end;
$ensaio$;

-- 1. A migration (corpo de supabase/migrations/20261022153000_…).

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

do $ensaio$
begin
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname in ('public', 'private') and p.proname ilike '%chat%'),
         'sobrou função do chat';
  assert not exists (select 1 from pg_policies p join ensaio_politicas e using (schemaname, tablename, policyname)),
         'sobrou política do chat';
  assert (select funcoes from ensaio_contagem)
         = (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname in ('public', 'private')),
         'outra função saiu junto';
  assert (select politicas from ensaio_contagem) = (select count(*) from pg_policies),
         'outra política saiu junto';
end;
$ensaio$;

-- 2. O rollback (corpo de supabase/rollback/20261022153000_…).

set local check_function_bodies = off;
-- private."FC_CHAT_ACABOU_DE_ENVIAR"(text)
CREATE OR REPLACE FUNCTION private."FC_CHAT_ACABOU_DE_ENVIAR"(p_caminho text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private."FC_CHAT_PODE_ANEXAR"(p_caminho)
     and not exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = p_caminho)
     and not exists (select 1 from public."TB_EXPURGO_ANEXO_CHAT" e where e."DS_CAMINHO" = p_caminho);
$function$;
comment on function private."FC_CHAT_ACABOU_DE_ENVIAR"(text) is $comentario$Política de leitura do bucket chat-anexos, a porta de quem acabou de enviar (o upload devolve a linha): o arquivo ainda não foi anexado a nenhuma mensagem nem está na fila de expurgo, e quem pede ainda lê a conversa. O dono e os 10 minutos ficam na política.$comentario$;
revoke all on function private."FC_CHAT_ACABOU_DE_ENVIAR"(text) from public;
grant execute on function private."FC_CHAT_ACABOU_DE_ENVIAR"(text) to authenticated;

-- private."FC_CHAT_ANEXOS_JSON"(uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_ANEXOS_JSON"(p_mensagem uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a."CO_ANEXO_MENSAGEM",
           'nome', a."NO_ARQUIVO",
           'mime', a."DS_MIME",
           'bytes', a."QT_BYTES",
           'caminho', a."DS_CAMINHO") order by a."DT_CRIACAO", a."CO_ANEXO_MENSAGEM"), '[]'::jsonb)
    from public."TB_ANEXO_MENSAGEM" a
   where a."CO_MENSAGEM" = p_mensagem and a."ST_REGISTRO_ATIVO" = 'S';
$function$;
comment on function private."FC_CHAT_ANEXOS_JSON"(uuid) is $comentario$Anexos ativos de uma mensagem: [{id, nome, mime, bytes, caminho}] (o caminho só abre pela política do bucket).$comentario$;
revoke all on function private."FC_CHAT_ANEXOS_JSON"(uuid) from public;

-- private."FC_CHAT_APAGAR_MENSAGENS"(timestamp with time zone)
CREATE OR REPLACE FUNCTION private."FC_CHAT_APAGAR_MENSAGENS"(p_antes timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_corte timestamptz := coalesce(p_antes, 'infinity'::timestamptz);
  v_reacoes integer;
  v_mensagens integer;
  v_anexos integer;
  v_caminhos text[];
begin
  -- Uma limpeza por vez (a tarefa diária e o administrador).
  perform pg_advisory_xact_lock(hashtext('agsus_chat_limpeza'));
  -- Trava as mensagens antes: reação nova numa delas espera e falha depois.
  perform 1 from public."TB_MENSAGEM" m where m."DT_CRIACAO" < v_corte for update;
  with saem as (
    delete from public."TB_ANEXO_MENSAGEM" a
     using public."TB_MENSAGEM" m
     where m."CO_MENSAGEM" = a."CO_MENSAGEM" and m."DT_CRIACAO" < v_corte
    returning a."DS_CAMINHO"
  )
  select count(*), coalesce(array_agg(distinct saem."DS_CAMINHO"), '{}') into v_anexos, v_caminhos from saem;
  -- O objeto vai para a fila só quando nenhuma linha (encaminhada) aponta mais para ele.
  insert into public."TB_EXPURGO_ANEXO_CHAT" ("DS_CAMINHO", "TP_ORIGEM")
  select c, 'RETENCAO' from unnest(v_caminhos) c
   where not exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = c)
  on conflict on constraint "PK_TB_EXPURGO_ANEXO_CHAT" do nothing;
  delete from public."RL_MENSAGEM_REACAO" r
   using public."TB_MENSAGEM" m
   where m."CO_MENSAGEM" = r."CO_MENSAGEM" and m."DT_CRIACAO" < v_corte;
  get diagnostics v_reacoes = row_count;
  delete from public."TB_MENSAGEM" m where m."DT_CRIACAO" < v_corte;
  get diagnostics v_mensagens = row_count;
  return jsonb_build_object('mensagens', v_mensagens, 'reacoes', v_reacoes, 'anexos', v_anexos);
end;
$function$;
comment on function private."FC_CHAT_APAGAR_MENSAGENS"(timestamp with time zone) is $comentario$Exclusão real das mensagens enviadas antes de p_antes (nulo: todas), das reações e dos anexos delas; o objeto do Storage sem nenhuma linha restante entra em TB_EXPURGO_ANEXO_CHAT. Devolve {mensagens, reacoes, anexos}. Sem checagem de quem pede: só as RPCs de retenção e a tarefa diária chamam.$comentario$;
revoke all on function private."FC_CHAT_APAGAR_MENSAGENS"(timestamp with time zone) from public;

-- private."FC_CHAT_CONVERSA_JSON"(uuid,uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_CONVERSA_JSON"(p_conversa uuid, p_usuario uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', c."CO_CONVERSA",
    'tipo', c."TP_CONVERSA",
    'nome', c."NO_CONVERSA",
    'edital', case when c."TP_CONVERSA" = 'EDITAL' then jsonb_build_object(
      'id', m.id,
      'titulo', coalesce(nullif(btrim(m.edital), ''), m.unidade, 'Edital'),
      'unidade', m.unidade,
      'area', m."CO_AREA") end,
    'criador', c."CO_USUARIO_CRIADOR",
    'criada_em', c."DT_CRIACAO",
    'atualizada_em', coalesce(c."DT_ULTIMA_MENSAGEM", c."DT_CRIACAO"),
    'participantes', coalesce((
      select jsonb_agg(private."FC_CHAT_PESSOA"(p."CO_USUARIO")
                       || jsonb_build_object('papel', p."TP_PAPEL")
                       -- Visto: a leitura dos outros só para quem participa.
                       || case when eu."CO_USUARIO" is not null and eu."DT_SAIDA" is null
                               then jsonb_build_object('lida_em', p."DT_ULTIMA_LEITURA")
                               else '{}'::jsonb end
                       order by p."DT_ENTRADA", p."CO_USUARIO")
        from public."RL_CONVERSA_PARTICIPANTE" p
       where p."CO_CONVERSA" = c."CO_CONVERSA" and p."DT_SAIDA" is null), '[]'::jsonb),
    'participa', eu."CO_USUARIO" is not null and eu."DT_SAIDA" is null,
    'lida_em', eu."DT_ULTIMA_LEITURA",
    'limpa_em', eu."DT_LIMPEZA",
    'silenciada', coalesce(eu."ST_SILENCIADA" = 'S', false),
    'fixada_em', eu."DT_FIXACAO",
    'marcada_nao_lida', coalesce(eu."ST_NAO_LIDA" = 'S', false),
    'nao_lidas', (
      select count(*) from public."TB_MENSAGEM" x
       where x."CO_CONVERSA" = c."CO_CONVERSA" and x."CO_USUARIO_AUTOR" <> p_usuario and x."ST_APAGADA" = 'N'
         and (eu."DT_ULTIMA_LEITURA" is null or x."DT_CRIACAO" > eu."DT_ULTIMA_LEITURA")
         and (eu."DT_LIMPEZA" is null or x."DT_CRIACAO" > eu."DT_LIMPEZA")),
    'mencoes', (
      select count(*) from public."TB_MENSAGEM" x
       where x."CO_CONVERSA" = c."CO_CONVERSA" and x."CO_USUARIO_AUTOR" <> p_usuario and x."ST_APAGADA" = 'N'
         and p_usuario = any (x."CO_USUARIOS_MENCIONADOS")
         and (eu."DT_ULTIMA_LEITURA" is null or x."DT_CRIACAO" > eu."DT_ULTIMA_LEITURA")
         and (eu."DT_LIMPEZA" is null or x."DT_CRIACAO" > eu."DT_LIMPEZA")),
    'ultima', (
      select jsonb_build_object(
               'id', x."CO_MENSAGEM",
               'autor', x."CO_USUARIO_AUTOR",
               'texto', left(x."DS_TEXTO", 160),
               'apagada', x."ST_APAGADA" = 'S',
               'anexos', x."QT_ANEXO",
               'link', x."DS_LINK_TELA" is not null,
               'criada_em', x."DT_CRIACAO")
        from public."TB_MENSAGEM" x
       where x."CO_CONVERSA" = c."CO_CONVERSA"
         and (eu."DT_LIMPEZA" is null or x."DT_CRIACAO" > eu."DT_LIMPEZA")
       order by x."DT_CRIACAO" desc, x."CO_MENSAGEM" desc
       limit 1))
  from public."TB_CONVERSA" c
  left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c."CO_MONITORAMENTO"
  left join public."RL_CONVERSA_PARTICIPANTE" eu on eu."CO_CONVERSA" = c."CO_CONVERSA" and eu."CO_USUARIO" = p_usuario
  where c."CO_CONVERSA" = p_conversa;
$function$;
comment on function private."FC_CHAT_CONVERSA_JSON"(uuid,uuid) is $comentario$Uma conversa como a pessoa a vê: tipo, nome, edital, participantes (online, status e — só para quem participa — a última leitura de cada um), não lidas, menções, silenciada, fixada, marcada como não lida, limpa_em e a última mensagem (com a contagem de anexos), tudo depois da limpeza dela.$comentario$;
revoke all on function private."FC_CHAT_CONVERSA_JSON"(uuid,uuid) from public;

-- private."FC_CHAT_EMAIL"(uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_EMAIL"(p_usuario uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (select u.email from public."TB_PERFIL_USUARIO" u
      where u.user_id = p_usuario
      order by u.ativo desc nulls last
      limit 1),
    (select auth.jwt()) ->> 'email');
$function$;
comment on function private."FC_CHAT_EMAIL"(uuid) is $comentario$E-mail da pessoa (perfil ativo primeiro; senão, o do token) para a auditoria das limpezas.$comentario$;
revoke all on function private."FC_CHAT_EMAIL"(uuid) from public;

-- private."FC_CHAT_EXIGIR"()
CREATE OR REPLACE FUNCTION private."FC_CHAT_EXIGIR"()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sessão não localizada' using errcode = '28000';
  end if;
  if not private.pode_recurso('chat', 1) then
    raise exception 'Sem acesso às mensagens' using errcode = '42501';
  end if;
  return v_uid;
end;
$function$;
comment on function private."FC_CHAT_EXIGIR"() is $comentario$Barra quem não está logado (28000) ou não tem o recurso chat (42501); devolve auth.uid().$comentario$;
revoke all on function private."FC_CHAT_EXIGIR"() from public;

-- private."FC_CHAT_EXIGIR_ADMIN"()
CREATE OR REPLACE FUNCTION private."FC_CHAT_EXIGIR_ADMIN"()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sessão não localizada' using errcode = '28000';
  end if;
  if not private.is_master() then
    raise exception 'Só o administrador global cuida da retenção das mensagens' using errcode = '42501';
  end if;
  return v_uid;
end;
$function$;
comment on function private."FC_CHAT_EXIGIR_ADMIN"() is $comentario$Barra quem não está logado (28000) ou não é administrador global (private.is_master(); 42501); devolve auth.uid().$comentario$;
revoke all on function private."FC_CHAT_EXIGIR_ADMIN"() from public;

-- private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"()
CREATE OR REPLACE FUNCTION private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if coalesce((select auth.role()) = 'service_role', false) then
    return null;
  end if;
  return private."FC_CHAT_EXIGIR_ADMIN"();
end;
$function$;
comment on function private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"() is $comentario$Expurgo dos anexos do chat: deixa passar a service_role (job diário scripts/expurgo_anexos_chat/; devolve nulo) e, para os demais, é FC_CHAT_EXIGIR_ADMIN (28000 sem sessão, 42501 se não for administrador global; devolve auth.uid()).$comentario$;
revoke all on function private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"() from public;

-- private."FC_CHAT_EXIGIR_CONVERSA"(uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa uuid)
 RETURNS arquivo."TB_CONVERSA"
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public."TB_CONVERSA";
begin
  perform private."FC_CHAT_EXIGIR"();
  select * into v from public."TB_CONVERSA" c where c."CO_CONVERSA" = p_conversa;
  if v."CO_CONVERSA" is null or v."ST_REGISTRO_ATIVO" <> 'S' then
    raise exception 'Conversa não encontrada' using errcode = 'P0002';
  end if;
  if not private."FC_CHAT_PODE_LER"(p_conversa) then
    raise exception 'Sem acesso a esta conversa' using errcode = '42501';
  end if;
  return v;
end;
$function$;
comment on function private."FC_CHAT_EXIGIR_CONVERSA"(uuid) is $comentario$Barra conversa inexistente ou desativada (P0002) e quem não pode lê-la (42501); devolve a conversa.$comentario$;
revoke all on function private."FC_CHAT_EXIGIR_CONVERSA"(uuid) from public;

-- private."FC_CHAT_MENSAGEM_JSON"(uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_MENSAGEM_JSON"(p_mensagem uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', m."CO_MENSAGEM",
    'conversa', m."CO_CONVERSA",
    'autor', m."CO_USUARIO_AUTOR",
    'texto', m."DS_TEXTO",
    'link', m."DS_LINK_TELA",
    'mencoes', to_jsonb(m."CO_USUARIOS_MENCIONADOS"),
    'criada_em', m."DT_CRIACAO",
    'editada_em', m."DT_EDICAO",
    'apagada', m."ST_APAGADA" = 'S',
    'encaminhada', m."ST_ENCAMINHADA" = 'S',
    'anexos', case when m."ST_APAGADA" = 'S' or m."QT_ANEXO" = 0 then '[]'::jsonb
                   else private."FC_CHAT_ANEXOS_JSON"(m."CO_MENSAGEM") end,
    'resposta', (
      select jsonb_build_object(
               'id', r."CO_MENSAGEM",
               'autor', r."CO_USUARIO_AUTOR",
               'texto', left(r."DS_TEXTO", 160),
               'apagada', r."ST_APAGADA" = 'S',
               'anexos', r."QT_ANEXO",
               'link', r."DS_LINK_TELA" is not null)
        from public."TB_MENSAGEM" r
       where r."CO_MENSAGEM" = m."CO_MENSAGEM_RESPOSTA"),
    'reacoes', case when m."ST_APAGADA" = 'S' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('emoji', r.emoji, 'usuarios', r.usuarios) order by r.ordem)
        from (
          select x."DS_EMOJI" as emoji,
                 jsonb_agg(x."CO_USUARIO" order by x."DT_ATUALIZACAO", x."CO_USUARIO") as usuarios,
                 array_position(private."FC_CHAT_REACOES"(), x."DS_EMOJI"::text) as ordem
            from public."RL_MENSAGEM_REACAO" x
           where x."CO_MENSAGEM" = m."CO_MENSAGEM" and x."ST_REGISTRO_ATIVO" = 'S'
           group by x."DS_EMOJI"
        ) r), '[]'::jsonb) end)
  from public."TB_MENSAGEM" m
  where m."CO_MENSAGEM" = p_mensagem;
$function$;
comment on function private."FC_CHAT_MENSAGEM_JSON"(uuid) is $comentario$Uma mensagem no formato da tela: texto, cartão (link), menções, reações, anexos ativos, se é encaminhada e a citação (resposta: id, autor, começo do texto). Apagada: sem anexos e sem reações.$comentario$;
revoke all on function private."FC_CHAT_MENSAGEM_JSON"(uuid) from public;

-- private."FC_CHAT_PARTICIPA"(uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_PARTICIPA"(p_conversa uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public."RL_CONVERSA_PARTICIPANTE" p
     where p."CO_CONVERSA" = p_conversa
       and p."CO_USUARIO" = (select auth.uid())
       and p."DT_SAIDA" is null);
$function$;
comment on function private."FC_CHAT_PARTICIPA"(uuid) is $comentario$Quem está logado participa (sem saída) da conversa? Para o Visto: só participante vê a leitura dos outros.$comentario$;
revoke all on function private."FC_CHAT_PARTICIPA"(uuid) from public;
grant execute on function private."FC_CHAT_PARTICIPA"(uuid) to authenticated;

-- private."FC_CHAT_PARTICIPANTES_VALIDOS"(uuid[],uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_PARTICIPANTES_VALIDOS"(p_participantes uuid[], p_uid uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lista uuid[];
  v_sem integer;
begin
  select coalesce(array_agg(distinct x), '{}') into v_lista
    from unnest(coalesce(p_participantes, '{}'::uuid[])) x
   where x is not null and x <> p_uid;
  if cardinality(v_lista) > 100 then
    raise exception 'No máximo 100 pessoas por vez' using errcode = '22023';
  end if;
  select count(*) into v_sem from unnest(v_lista) x where not private."FC_CHAT_USUARIO_LIBERADO"(x);
  if v_sem > 0 then
    raise exception '% pessoa(s) sem acesso às mensagens', v_sem using errcode = '22023';
  end if;
  return v_lista;
end;
$function$;
comment on function private."FC_CHAT_PARTICIPANTES_VALIDOS"(uuid[],uuid) is $comentario$Participantes para incluir: sem repetição, sem quem inclui, até 100, todos com o recurso chat (22023).$comentario$;
revoke all on function private."FC_CHAT_PARTICIPANTES_VALIDOS"(uuid[],uuid) from public;

-- private."FC_CHAT_PESSOA"(uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_PESSOA"(p_usuario uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', p_usuario,
    'nome', coalesce(p.nome, 'Pessoa'),
    'avatar', p.avatar,
    'online', exists (
      select 1 from public."TB_PRESENCA_ONLINE_MONITORA" po
       where po.user_id = p_usuario
         and po.seen_at > timezone('utc', now()) - interval '4 minutes'),
    'status', coalesce((
      select s."TP_STATUS" from public."TB_STATUS_PRESENCA_CHAT" s
       where s."CO_USUARIO" = p_usuario), 'DISPONIVEL'))
  from (select 1) um
  left join lateral (
    select coalesce(nullif(btrim(u.nome), ''), split_part(coalesce(u.email, ''), '@', 1)) as nome,
           coalesce(case when u.avatar_source in ('GOOGLE', 'UPLOADED') then u.avatar_url end, u.google_avatar_url) as avatar
      from public."TB_PERFIL_USUARIO" u
     where u.user_id = p_usuario
     order by u.ativo desc, u.updated_at desc nulls last
     limit 1
  ) p on true;
$function$;
comment on function private."FC_CHAT_PESSOA"(uuid) is $comentario$Nome, foto, se está online (presença dos últimos 2 minutos) e o status escolhido (DISPONIVEL, OCUPADO ou AUSENTE; sem escolha, DISPONIVEL) de uma pessoa do chat.$comentario$;
revoke all on function private."FC_CHAT_PESSOA"(uuid) from public;

-- private."FC_CHAT_PODE_ANEXAR"(text)
CREATE OR REPLACE FUNCTION private."FC_CHAT_PODE_ANEXAR"(p_caminho text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- CASE: o uuid só é lido depois de o formato conferir.
  select case
           when coalesce(p_caminho, '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|jpeg|webp|gif|csv|xlsx|xls|ods)$'
             then private."FC_CHAT_PODE_LER"(split_part(p_caminho, '/', 1)::uuid)
           else false
         end;
$function$;
comment on function private."FC_CHAT_PODE_ANEXAR"(text) is $comentario$Política de envio do bucket chat-anexos: o caminho é <conversa>/<uuid>.<extensão aceita> e quem envia lê a conversa (FC_CHAT_PODE_LER).$comentario$;
revoke all on function private."FC_CHAT_PODE_ANEXAR"(text) from public;
grant execute on function private."FC_CHAT_PODE_ANEXAR"(text) to authenticated;

-- private."FC_CHAT_PODE_BAIXAR_ANEXO"(text)
CREATE OR REPLACE FUNCTION private."FC_CHAT_PODE_BAIXAR_ANEXO"(p_caminho text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public."TB_ANEXO_MENSAGEM" a
     where a."DS_CAMINHO" = p_caminho
       and a."ST_REGISTRO_ATIVO" = 'S'
       and private."FC_CHAT_PODE_LER"(a."CO_CONVERSA"));
$function$;
comment on function private."FC_CHAT_PODE_BAIXAR_ANEXO"(text) is $comentario$Política de leitura do bucket chat-anexos (é ela que libera a URL assinada): o objeto é anexo ativo de uma conversa que quem pede lê.$comentario$;
revoke all on function private."FC_CHAT_PODE_BAIXAR_ANEXO"(text) from public;
grant execute on function private."FC_CHAT_PODE_BAIXAR_ANEXO"(text) to authenticated;

-- private."FC_CHAT_PODE_EXPURGAR"(text)
CREATE OR REPLACE FUNCTION private."FC_CHAT_PODE_EXPURGAR"(p_caminho text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.is_master()
     and exists (select 1 from public."TB_EXPURGO_ANEXO_CHAT" e
                  where e."DS_CAMINHO" = p_caminho and e."DT_EXPURGO" is null)
     and not exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = p_caminho);
$function$;
comment on function private."FC_CHAT_PODE_EXPURGAR"(text) is $comentario$Política de exclusão do bucket chat-anexos: só o administrador global, só objeto na fila de expurgo e sem nenhuma linha de anexo.$comentario$;
revoke all on function private."FC_CHAT_PODE_EXPURGAR"(text) from public;
grant execute on function private."FC_CHAT_PODE_EXPURGAR"(text) to authenticated;

-- private."FC_CHAT_PODE_LER"(uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_PODE_LER"(p_conversa uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
     and private.pode_recurso('chat', 1)
     and exists (
       select 1
         from public."TB_CONVERSA" c
        where c."CO_CONVERSA" = p_conversa
          and c."ST_REGISTRO_ATIVO" = 'S'
          and case
                when c."TP_CONVERSA" = 'EDITAL' then private."FC_PODE_VER_EDITAL"(c."CO_MONITORAMENTO")
                else exists (
                  select 1 from public."RL_CONVERSA_PARTICIPANTE" p
                   where p."CO_CONVERSA" = c."CO_CONVERSA"
                     and p."CO_USUARIO" = (select auth.uid())
                     and p."DT_SAIDA" is null)
              end);
$function$;
comment on function private."FC_CHAT_PODE_LER"(uuid) is $comentario$Quem está logado lê a conversa? Recurso chat e: participante sem saída (DIRETA/GRUPO) ou acesso ao edital (EDITAL, FC_PODE_VER_EDITAL). Usada nas policies e nas RPCs.$comentario$;
revoke all on function private."FC_CHAT_PODE_LER"(uuid) from public;
grant execute on function private."FC_CHAT_PODE_LER"(uuid) to authenticated;

-- private."FC_CHAT_PODE_TOPICO"(text)
CREATE OR REPLACE FUNCTION private."FC_CHAT_PODE_TOPICO"(p_topico text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_topico is null
     or p_topico !~ '^chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private."FC_CHAT_PODE_LER"(substr(p_topico, 6)::uuid);
end;
$function$;
comment on function private."FC_CHAT_PODE_TOPICO"(text) is $comentario$Canal privado do Realtime "chat:<conversa>" (digitando…): só quem lê a conversa entra.$comentario$;
revoke all on function private."FC_CHAT_PODE_TOPICO"(text) from public;
grant execute on function private."FC_CHAT_PODE_TOPICO"(text) to authenticated;

-- private."FC_CHAT_REACOES"()
CREATE OR REPLACE FUNCTION private."FC_CHAT_REACOES"()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select array['👍', '✅', '❤️', '😂', '👀', '🙏']::text[];
$function$;
comment on function private."FC_CHAT_REACOES"() is $comentario$As reações rápidas aceitas, na ordem da tela. Espelho de REACOES_RAPIDAS (src/lib/chat.js) e do CHECK CK_MENSREACAO_DSEMOJI.$comentario$;
revoke all on function private."FC_CHAT_REACOES"() from public;

-- private."FC_CHAT_RETENCAO_DIARIA"()
CREATE OR REPLACE FUNCTION private."FC_CHAT_RETENCAO_DIARIA"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_dias integer;
  v_corte timestamptz;
  v_apagou jsonb;
begin
  select r."QT_DIAS_RETENCAO" into v_dias from public."TB_RETENCAO_CHAT" r where r."CO_RETENCAO_CHAT" = 1;
  if v_dias is null then
    return null;
  end if;
  v_corte := now() - make_interval(days => v_dias);
  v_apagou := private."FC_CHAT_APAGAR_MENSAGENS"(v_corte);
  if (v_apagou->>'mensagens')::int > 0 or (v_apagou->>'reacoes')::int > 0 or (v_apagou->>'anexos')::int > 0 then
    insert into public."TH_LIMPEZA_CHAT"
      ("TP_LIMPEZA", "TP_ORIGEM", "QT_DIAS_RETENCAO", "DT_CORTE", "QT_MENSAGEM_APAGADA", "QT_REACAO_APAGADA", "QT_ANEXO_APAGADO")
    values ('PRAZO', 'AGENDA', v_dias, v_corte, (v_apagou->>'mensagens')::int, (v_apagou->>'reacoes')::int,
            (v_apagou->>'anexos')::int);
  end if;
  return v_apagou;
end;
$function$;
comment on function private."FC_CHAT_RETENCAO_DIARIA"() is $comentario$Tarefa diária (agsus_chat_retencao_diaria): aplica o prazo de TB_RETENCAO_CHAT (mensagens, reações e anexos) e registra em TH_LIMPEZA_CHAT quando apagou algo. Prazo nulo: não faz nada.$comentario$;
revoke all on function private."FC_CHAT_RETENCAO_DIARIA"() from public;

-- private."FC_CHAT_SEM_ACENTO"(text)
CREATE OR REPLACE FUNCTION private."FC_CHAT_SEM_ACENTO"(p_texto text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select translate(lower(coalesce(p_texto, '')),
                   'áàâãäéèêëíìîïóòôõöúùûüçñ',
                   'aaaaaeeeeiiiiooooouuuucn');
$function$;
comment on function private."FC_CHAT_SEM_ACENTO"(text) is $comentario$Texto em minúsculas e sem acento (troca letra por letra: o tamanho não muda), para a busca das mensagens.$comentario$;
revoke all on function private."FC_CHAT_SEM_ACENTO"(text) from public;

-- private."FC_CHAT_TIPOS_ANEXO"()
CREATE OR REPLACE FUNCTION private."FC_CHAT_TIPOS_ANEXO"()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.oasis.opendocument.spreadsheet'
  ]::text[];
$function$;
comment on function private."FC_CHAT_TIPOS_ANEXO"() is $comentario$Tipos de arquivo aceitos nos anexos do chat (PDF, imagem e planilha). Espelho de TIPOS_DE_ANEXO (src/lib/anexos-do-chat.js), do bucket chat-anexos e do CHECK CK_ANEXOMENSAGEM_DSMIME.$comentario$;
revoke all on function private."FC_CHAT_TIPOS_ANEXO"() from public;

-- private."FC_CHAT_TRECHO"(text,text)
CREATE OR REPLACE FUNCTION private."FC_CHAT_TRECHO"(p_texto text, p_termo text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_texto text := regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g');
  v_pos integer := position(private."FC_CHAT_SEM_ACENTO"(p_termo) in private."FC_CHAT_SEM_ACENTO"(v_texto));
  v_inicio integer;
begin
  if v_pos = 0 then
    return left(v_texto, 140) || case when length(v_texto) > 140 then '…' else '' end;
  end if;
  v_inicio := greatest(1, v_pos - 50);
  return case when v_inicio > 1 then '…' else '' end
      || substr(v_texto, v_inicio, 140)
      || case when v_inicio + 140 <= length(v_texto) then '…' else '' end;
end;
$function$;
comment on function private."FC_CHAT_TRECHO"(text,text) is $comentario$Trecho de até 140 caracteres em volta da primeira ocorrência do termo (sem acento), com reticências: o contexto do resultado da busca.$comentario$;
revoke all on function private."FC_CHAT_TRECHO"(text,text) from public;

-- private."FC_CHAT_USUARIO_LIBERADO"(uuid)
CREATE OR REPLACE FUNCTION private."FC_CHAT_USUARIO_LIBERADO"(p_usuario uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where u.user_id = p_usuario
       and u.ativo is true
       and private."FC_NIVEL_EFETIVO"(u.id, u.perfil, 'chat') <> 'sem_acesso');
$function$;
comment on function private."FC_CHAT_USUARIO_LIBERADO"(uuid) is $comentario$A pessoa (auth.users.id) tem perfil ativo e o recurso chat? Para incluir em conversa.$comentario$;
revoke all on function private."FC_CHAT_USUARIO_LIBERADO"(uuid) from public;

-- private."FC_CHAT_VALIDAR_LINK"(jsonb)
CREATE OR REPLACE FUNCTION private."FC_CHAT_VALIDAR_LINK"(p_link jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_chave text;
  v_edital jsonb;
  v_ficha jsonb;
begin
  if p_link is null or p_link = 'null'::jsonb then return null; end if;
  if jsonb_typeof(p_link) <> 'object' then
    raise exception 'Link da tela inválido' using errcode = '22023';
  end if;
  for v_chave in select jsonb_object_keys(p_link) loop
    if v_chave not in ('view', 'area', 'secao', 'edital', 'ficha', 'rotulo') then
      raise exception 'Link da tela inválido: campo %', v_chave using errcode = '22023';
    end if;
  end loop;
  if coalesce(p_link->>'view', '') !~ '^[a-z][a-z_-]{0,39}$' then
    raise exception 'Link da tela inválido: página' using errcode = '22023';
  end if;
  if p_link ? 'area' and coalesce(p_link->>'area', '') !~ '^[a-z0-9][a-z0-9-]{0,39}$' then
    raise exception 'Link da tela inválido: área' using errcode = '22023';
  end if;
  if p_link ? 'secao' and coalesce(p_link->>'secao', '') !~ '^[a-z0-9][a-z0-9_-]{0,39}$' then
    raise exception 'Link da tela inválido: seção' using errcode = '22023';
  end if;
  if p_link ? 'rotulo' and (jsonb_typeof(p_link->'rotulo') <> 'string' or length(p_link->>'rotulo') > 200) then
    raise exception 'Link da tela inválido: rótulo' using errcode = '22023';
  end if;
  if p_link ? 'edital' then
    v_edital := p_link->'edital';
    if jsonb_typeof(v_edital) <> 'object'
       or coalesce(v_edital->>'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or exists (select 1 from jsonb_object_keys(v_edital) k where k not in ('id', 'titulo'))
       or (v_edital ? 'titulo' and (jsonb_typeof(v_edital->'titulo') <> 'string' or length(v_edital->>'titulo') > 120)) then
      raise exception 'Link da tela inválido: edital' using errcode = '22023';
    end if;
  end if;
  if p_link ? 'ficha' then
    v_ficha := p_link->'ficha';
    if not (p_link ? 'edital')
       or jsonb_typeof(v_ficha) <> 'object'
       or exists (select 1 from jsonb_object_keys(v_ficha) k where k not in ('id', 'codigo'))
       or jsonb_typeof(v_ficha->'codigo') is distinct from 'string'
       or coalesce(v_ficha->>'codigo', '') !~ '^[0-9A-Za-z._-]{1,30}$'
       or (v_ficha ? 'id' and coalesce(v_ficha->>'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      raise exception 'Link da tela inválido: ficha' using errcode = '22023';
    end if;
  end if;
  return p_link;
end;
$function$;
comment on function private."FC_CHAT_VALIDAR_LINK"(jsonb) is $comentario$Link interno da tela (cartão): só {view, area?, secao?, edital?: {id, titulo?}, ficha?: {id?, codigo}, rotulo?}, em formato de código (nunca URL); view com letras, _ e -; ficha só com edital. Fora disso, 22023. Espelho de linkDaTela (src/lib/chat.js).$comentario$;
revoke all on function private."FC_CHAT_VALIDAR_LINK"(jsonb) from public;

-- private."FC_CHAT_VALIDAR_MOTIVO"(text)
CREATE OR REPLACE FUNCTION private."FC_CHAT_VALIDAR_MOTIVO"(p_motivo text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if length(v_motivo) not between 3 and 500 then
    raise exception 'Informe o motivo (3 a 500 caracteres)' using errcode = '22023';
  end if;
  return v_motivo;
end;
$function$;
comment on function private."FC_CHAT_VALIDAR_MOTIVO"(text) is $comentario$Motivo da limpeza: 3 a 500 caracteres, sem os espaços das pontas (22023). Espelho de validarMotivo (src/lib/retencao-do-chat.js).$comentario$;
revoke all on function private."FC_CHAT_VALIDAR_MOTIVO"(text) from public;

-- private."FC_CHAT_VALIDAR_TEXTO"(text)
CREATE OR REPLACE FUNCTION private."FC_CHAT_VALIDAR_TEXTO"(p_texto text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
begin
  if p_texto is null or length(btrim(p_texto)) = 0 then
    raise exception 'Escreva a mensagem' using errcode = '22023';
  end if;
  if length(p_texto) > 4000 then
    raise exception 'A mensagem passa de 4.000 caracteres' using errcode = '22023';
  end if;
  return p_texto;
end;
$function$;
comment on function private."FC_CHAT_VALIDAR_TEXTO"(text) is $comentario$Texto da mensagem: 1 a 4.000 caracteres, não só espaços (22023).$comentario$;
revoke all on function private."FC_CHAT_VALIDAR_TEXTO"(text) from public;

-- abrir_conversa_direta_chat(uuid)
CREATE OR REPLACE FUNCTION public.abrir_conversa_direta_chat(p_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_chave text;
  v_id uuid;
begin
  if p_usuario is null or p_usuario = v_uid then
    raise exception 'Escolha outra pessoa' using errcode = '22023';
  end if;
  if not private."FC_CHAT_USUARIO_LIBERADO"(p_usuario) then
    raise exception 'Esta pessoa não tem acesso às mensagens' using errcode = '22023';
  end if;
  v_chave := least(v_uid, p_usuario)::text || ':' || greatest(v_uid, p_usuario)::text;

  insert into public."TB_CONVERSA" ("TP_CONVERSA", "DS_CHAVE_DIRETA", "CO_USUARIO_CRIADOR")
  values ('DIRETA', v_chave, v_uid)
  on conflict on constraint "UK_CONVERSA_CHAVEDIRETA" do nothing
  returning "CO_CONVERSA" into v_id;
  if v_id is null then
    select c."CO_CONVERSA" into v_id from public."TB_CONVERSA" c where c."DS_CHAVE_DIRETA" = v_chave;
    if (select c."ST_REGISTRO_ATIVO" from public."TB_CONVERSA" c where c."CO_CONVERSA" = v_id) <> 'S' then
      raise exception 'Conversa desativada' using errcode = '22023';
    end if;
  end if;

  insert into public."RL_CONVERSA_PARTICIPANTE" as p ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL")
  values (v_id, v_uid, 'MEMBRO'), (v_id, p_usuario, 'MEMBRO')
  on conflict ("CO_CONVERSA", "CO_USUARIO") do update set "DT_SAIDA" = null;

  return private."FC_CHAT_CONVERSA_JSON"(v_id, v_uid);
end;
$function$;
comment on function abrir_conversa_direta_chat(uuid) is $comentario$Abre (ou cria, na primeira vez) a conversa direta com a pessoa: uma por par, quem quer que abra primeiro. A pessoa precisa ter o recurso chat (22023).$comentario$;
revoke all on function abrir_conversa_direta_chat(uuid) from public;
grant execute on function abrir_conversa_direta_chat(uuid) to service_role;

-- abrir_conversa_edital_chat(uuid)
CREATE OR REPLACE FUNCTION public.abrir_conversa_edital_chat(p_edital uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_id uuid;
begin
  if p_edital is null or not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if not private."FC_PODE_VER_EDITAL"(p_edital) then
    raise exception 'Sem acesso a este edital' using errcode = '42501';
  end if;

  insert into public."TB_CONVERSA" ("TP_CONVERSA", "CO_MONITORAMENTO", "CO_USUARIO_CRIADOR")
  values ('EDITAL', p_edital, v_uid)
  on conflict on constraint "UK_CONVERSA_COMONITORAMENTO" do nothing
  returning "CO_CONVERSA" into v_id;
  if v_id is null then
    select c."CO_CONVERSA" into v_id from public."TB_CONVERSA" c where c."CO_MONITORAMENTO" = p_edital;
    if (select c."ST_REGISTRO_ATIVO" from public."TB_CONVERSA" c where c."CO_CONVERSA" = v_id) <> 'S' then
      raise exception 'Conversa do edital desativada' using errcode = '22023';
    end if;
  end if;

  insert into public."RL_CONVERSA_PARTICIPANTE" as p ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL")
  values (v_id, v_uid, 'MEMBRO')
  on conflict ("CO_CONVERSA", "CO_USUARIO") do update
    set "DT_SAIDA" = null,
        "DT_ENTRADA" = case when p."DT_SAIDA" is null
                            then p."DT_ENTRADA" else now() end;

  return private."FC_CHAT_CONVERSA_JSON"(v_id, v_uid);
end;
$function$;
comment on function abrir_conversa_edital_chat(uuid) is $comentario$Abre a conversa do edital (cria na primeira vez; uma por edital) e passa a acompanhá-la. Exige o recurso chat e ver o edital pela área e pela coordenação (FC_PODE_VER_EDITAL; 42501).$comentario$;
revoke all on function abrir_conversa_edital_chat(uuid) from public;
grant execute on function abrir_conversa_edital_chat(uuid) to service_role;

-- adicionar_participantes_chat(uuid,uuid[])
CREATE OR REPLACE FUNCTION public.adicionar_participantes_chat(p_conversa uuid, p_participantes uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_conversa public."TB_CONVERSA";
  v_lista uuid[];
begin
  v_conversa := private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  if v_conversa."TP_CONVERSA" <> 'GRUPO' then
    raise exception 'Só grupo recebe participantes' using errcode = '22023';
  end if;
  v_lista := private."FC_CHAT_PARTICIPANTES_VALIDOS"(p_participantes, v_uid);
  if cardinality(v_lista) = 0 then
    raise exception 'Escolha ao menos uma pessoa' using errcode = '22023';
  end if;
  insert into public."RL_CONVERSA_PARTICIPANTE" as p ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL", "CO_USUARIO_INCLUSAO")
  select p_conversa, x, 'MEMBRO', v_uid from unnest(v_lista) x
  on conflict ("CO_CONVERSA", "CO_USUARIO") do update
    set "DT_SAIDA" = null,
        "DT_ENTRADA" = case when p."DT_SAIDA" is null
                            then p."DT_ENTRADA" else now() end,
        "CO_USUARIO_INCLUSAO" = case when p."DT_SAIDA" is null
                                     then p."CO_USUARIO_INCLUSAO" else excluded."CO_USUARIO_INCLUSAO" end;
  update public."TB_CONVERSA" set "DT_ATUALIZACAO" = now() where "CO_CONVERSA" = p_conversa;
  return private."FC_CHAT_CONVERSA_JSON"(p_conversa, v_uid);
end;
$function$;
comment on function adicionar_participantes_chat(uuid,uuid[]) is $comentario$Inclui pessoas num grupo (quem participa inclui; quem saiu volta). Todas com o recurso chat (22023).$comentario$;
revoke all on function adicionar_participantes_chat(uuid,uuid[]) from public;
grant execute on function adicionar_participantes_chat(uuid,uuid[]) to service_role;

-- alternar_reacao_chat(uuid,text)
CREATE OR REPLACE FUNCTION public.alternar_reacao_chat(p_mensagem uuid, p_emoji text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v public."TB_MENSAGEM";
  v_conversa public."TB_CONVERSA";
  v_emoji text := btrim(coalesce(p_emoji, ''));
begin
  if not (v_emoji = any (private."FC_CHAT_REACOES"())) then
    raise exception 'Reação fora da lista' using errcode = '22023';
  end if;
  select * into v from public."TB_MENSAGEM" m where m."CO_MENSAGEM" = p_mensagem;
  if v."CO_MENSAGEM" is null then
    raise exception 'Mensagem não encontrada' using errcode = 'P0002';
  end if;
  v_conversa := private."FC_CHAT_EXIGIR_CONVERSA"(v."CO_CONVERSA");
  if v."ST_APAGADA" = 'S' then
    raise exception 'Mensagem apagada não recebe reação' using errcode = '22023';
  end if;

  -- Na conversa do edital, quem reage passa a acompanhar (como quem escreve).
  if v_conversa."TP_CONVERSA" = 'EDITAL' then
    insert into public."RL_CONVERSA_PARTICIPANTE" as p ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL")
    values (v."CO_CONVERSA", v_uid, 'MEMBRO')
    on conflict ("CO_CONVERSA", "CO_USUARIO") do update
      set "DT_SAIDA" = null,
          "DT_ENTRADA" = case when p."DT_SAIDA" is null
                              then p."DT_ENTRADA" else now() end;
  end if;

  insert into public."RL_MENSAGEM_REACAO" as r ("CO_MENSAGEM", "CO_USUARIO", "DS_EMOJI", "CO_CONVERSA")
  values (p_mensagem, v_uid, v_emoji, v."CO_CONVERSA")
  on conflict on constraint "PK_RL_MENSAGEM_REACAO" do update
    set "ST_REGISTRO_ATIVO" = case when r."ST_REGISTRO_ATIVO" = 'S' then 'N' else 'S' end,
        "DT_ATUALIZACAO" = clock_timestamp();

  return private."FC_CHAT_MENSAGEM_JSON"(p_mensagem);
end;
$function$;
comment on function alternar_reacao_chat(uuid,text) is $comentario$Põe ou tira a reação (um dos emojis de FC_CHAT_REACOES; fora disso, 22023) de quem está logado numa mensagem. Só quem lê a conversa (42501); mensagem apagada não recebe reação (22023). Devolve a mensagem com as reações.$comentario$;
revoke all on function alternar_reacao_chat(uuid,text) from public;
grant execute on function alternar_reacao_chat(uuid,text) to service_role;

-- apagar_mensagem_chat(uuid)
CREATE OR REPLACE FUNCTION public.apagar_mensagem_chat(p_mensagem uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v public."TB_MENSAGEM";
begin
  select * into v from public."TB_MENSAGEM" m where m."CO_MENSAGEM" = p_mensagem for update;
  if v."CO_MENSAGEM" is null then
    raise exception 'Mensagem não encontrada' using errcode = 'P0002';
  end if;
  perform private."FC_CHAT_EXIGIR_CONVERSA"(v."CO_CONVERSA");
  if v."CO_USUARIO_AUTOR" <> v_uid then
    raise exception 'Só quem escreveu apaga a mensagem' using errcode = '42501';
  end if;
  if v."ST_APAGADA" = 'N' then
    update public."TB_ANEXO_MENSAGEM"
       set "ST_REGISTRO_ATIVO" = 'N'
     where "CO_MENSAGEM" = p_mensagem;
    update public."TB_MENSAGEM"
       set "ST_APAGADA" = 'S', "DT_APAGADA" = clock_timestamp(),
           "DS_TEXTO" = '', "DS_LINK_TELA" = null, "CO_USUARIOS_MENCIONADOS" = '{}', "QT_ANEXO" = 0
     where "CO_MENSAGEM" = p_mensagem;
  end if;
  return private."FC_CHAT_MENSAGEM_JSON"(p_mensagem);
end;
$function$;
comment on function apagar_mensagem_chat(uuid) is $comentario$Apaga a própria mensagem (lógico: fica "mensagem apagada", sem texto, link, menções e anexos — os anexos ficam desligados e ninguém mais baixa; o arquivo sai com a retenção). Só o autor (42501). Apagar de novo devolve a mesma.$comentario$;
revoke all on function apagar_mensagem_chat(uuid) from public;
grant execute on function apagar_mensagem_chat(uuid) to service_role;

-- buscar_mensagens_chat(text,integer)
CREATE OR REPLACE FUNCTION public.buscar_mensagens_chat(p_termo text, p_limite integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_termo text := btrim(left(coalesce(p_termo, ''), 100));
  v_limite integer := least(greatest(coalesce(p_limite, 30), 1), 50);
  v_padrao text;
begin
  if length(v_termo) < 2 then
    raise exception 'Digite ao menos 2 letras' using errcode = '22023';
  end if;
  v_padrao := '%' || replace(replace(replace(private."FC_CHAT_SEM_ACENTO"(v_termo), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return jsonb_build_object('termo', v_termo, 'resultados', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id,
             'conversa', s.conversa,
             'autor', s.autor,
             'criada_em', s.criada_em,
             'trecho', s.trecho,
             'anexo', s.anexo) order by s.criada_em desc, s.id desc)
      from (
        with minhas as materialized (
          select p."CO_CONVERSA", p."DT_LIMPEZA"
            from public."RL_CONVERSA_PARTICIPANTE" p
            join public."TB_CONVERSA" c on c."CO_CONVERSA" = p."CO_CONVERSA" and c."ST_REGISTRO_ATIVO" = 'S'
           where p."CO_USUARIO" = v_uid and p."DT_SAIDA" is null
             and private."FC_CHAT_PODE_LER"(p."CO_CONVERSA"))
        select m."CO_MENSAGEM" as id, m."CO_CONVERSA" as conversa, m."CO_USUARIO_AUTOR" as autor,
               m."DT_CRIACAO" as criada_em,
               private."FC_CHAT_TRECHO"(m."DS_TEXTO", v_termo) as trecho,
               (select a."NO_ARQUIVO" from public."TB_ANEXO_MENSAGEM" a
                 where a."CO_MENSAGEM" = m."CO_MENSAGEM" and a."ST_REGISTRO_ATIVO" = 'S'
                   and private."FC_CHAT_SEM_ACENTO"(a."NO_ARQUIVO") like v_padrao escape '\'
                 order by a."DT_CRIACAO" limit 1) as anexo
          from minhas
          join public."TB_MENSAGEM" m on m."CO_CONVERSA" = minhas."CO_CONVERSA"
         where m."ST_APAGADA" = 'N'
           and (minhas."DT_LIMPEZA" is null or m."DT_CRIACAO" > minhas."DT_LIMPEZA")
           and (private."FC_CHAT_SEM_ACENTO"(m."DS_TEXTO") like v_padrao escape '\'
                or exists (select 1 from public."TB_ANEXO_MENSAGEM" a
                            where a."CO_MENSAGEM" = m."CO_MENSAGEM" and a."ST_REGISTRO_ATIVO" = 'S'
                              and private."FC_CHAT_SEM_ACENTO"(a."NO_ARQUIVO") like v_padrao escape '\'))
         order by m."DT_CRIACAO" desc, m."CO_MENSAGEM" desc
         limit v_limite
      ) s), '[]'::jsonb));
end;
$function$;
comment on function buscar_mensagens_chat(text,integer) is $comentario$Procura o termo (2 a 100 caracteres, sem diferenciar maiúsculas e acentos) no texto e no nome dos anexos das conversas de quem pergunta (participa, pode ler — FC_CHAT_PODE_LER — e depois da limpeza dela), fora as apagadas; até p_limite (no máximo 50), das mais novas, com o trecho em volta. Termo curto: 22023.$comentario$;
revoke all on function buscar_mensagens_chat(text,integer) from public;
grant execute on function buscar_mensagens_chat(text,integer) to service_role;

-- confirmar_expurgo_anexos_chat(text[])
CREATE OR REPLACE FUNCTION public.confirmar_expurgo_anexos_chat(p_caminhos text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"();
  v_confirmados integer;
begin
  update public."TB_EXPURGO_ANEXO_CHAT" e
     set "DT_EXPURGO" = now()
   where e."DS_CAMINHO" = any (coalesce(p_caminhos, '{}'::text[]))
     and e."DT_EXPURGO" is null
     and not exists (select 1 from storage.objects o
                      where o.bucket_id = 'chat-anexos' and o.name = e."DS_CAMINHO");
  get diagnostics v_confirmados = row_count;
  return jsonb_build_object(
    'confirmados', v_confirmados,
    'pendentes', (select count(*) from public."TB_EXPURGO_ANEXO_CHAT" e where e."DT_EXPURGO" is null));
end;
$function$;
comment on function confirmar_expurgo_anexos_chat(text[]) is $comentario$Administrador global (42501) ou service_role (job diário, desde 20261007250000): marca como expurgados os caminhos da fila que já não existem no Storage (o que ainda existe continua na fila). Devolve {confirmados, pendentes}.$comentario$;
revoke all on function confirmar_expurgo_anexos_chat(text[]) from public;
grant execute on function confirmar_expurgo_anexos_chat(text[]) to service_role;

-- criar_grupo_chat(text,uuid[])
CREATE OR REPLACE FUNCTION public.criar_grupo_chat(p_nome text, p_participantes uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_nome text := btrim(coalesce(p_nome, ''));
  v_lista uuid[];
  v_id uuid;
begin
  if length(v_nome) not between 1 and 120 then
    raise exception 'Dê um nome ao grupo (até 120 caracteres)' using errcode = '22023';
  end if;
  v_lista := private."FC_CHAT_PARTICIPANTES_VALIDOS"(p_participantes, v_uid);
  if cardinality(v_lista) = 0 then
    raise exception 'Escolha ao menos uma pessoa' using errcode = '22023';
  end if;

  insert into public."TB_CONVERSA" ("TP_CONVERSA", "NO_CONVERSA", "CO_USUARIO_CRIADOR")
  values ('GRUPO', v_nome, v_uid)
  returning "CO_CONVERSA" into v_id;
  insert into public."RL_CONVERSA_PARTICIPANTE" as p ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL")
  values (v_id, v_uid, 'CRIADOR');
  insert into public."RL_CONVERSA_PARTICIPANTE" as p ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL", "CO_USUARIO_INCLUSAO")
  select v_id, x, 'MEMBRO', v_uid from unnest(v_lista) x;

  return private."FC_CHAT_CONVERSA_JSON"(v_id, v_uid);
end;
$function$;
comment on function criar_grupo_chat(text,uuid[]) is $comentario$Cria um grupo com nome (1 a 120) e participantes (ao menos um, até 100, todos com o recurso chat). Quem cria entra como CRIADOR.$comentario$;
revoke all on function criar_grupo_chat(text,uuid[]) from public;
grant execute on function criar_grupo_chat(text,uuid[]) to service_role;

-- definir_status_chat(text)
CREATE OR REPLACE FUNCTION public.definir_status_chat(p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_status text := upper(btrim(coalesce(p_status, '')));
begin
  if v_status not in ('DISPONIVEL', 'OCUPADO', 'AUSENTE') then
    raise exception 'Status inválido (Disponível, Ocupado ou Ausente)' using errcode = '22023';
  end if;
  insert into public."TB_STATUS_PRESENCA_CHAT" as s ("CO_USUARIO", "TP_STATUS")
  values (v_uid, v_status)
  on conflict on constraint "PK_TB_STATUS_PRESENCA_CHAT" do update
    set "TP_STATUS" = excluded."TP_STATUS", "DT_ATUALIZACAO" = now();
  return jsonb_build_object('status', v_status);
end;
$function$;
comment on function definir_status_chat(text) is $comentario$Define o status de quem está logado no chat: DISPONIVEL, OCUPADO ou AUSENTE (fora disso, 22023). Os outros veem ao lado do online automático.$comentario$;
revoke all on function definir_status_chat(text) from public;
grant execute on function definir_status_chat(text) to service_role;

-- editar_mensagem_chat(uuid,text)
CREATE OR REPLACE FUNCTION public.editar_mensagem_chat(p_mensagem uuid, p_texto text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v public."TB_MENSAGEM";
  v_texto text;
begin
  select * into v from public."TB_MENSAGEM" m where m."CO_MENSAGEM" = p_mensagem for update;
  if v."CO_MENSAGEM" is null then
    raise exception 'Mensagem não encontrada' using errcode = 'P0002';
  end if;
  perform private."FC_CHAT_EXIGIR_CONVERSA"(v."CO_CONVERSA");
  if v."CO_USUARIO_AUTOR" <> v_uid then
    raise exception 'Só quem escreveu edita a mensagem' using errcode = '42501';
  end if;
  if v."ST_APAGADA" = 'S' then
    raise exception 'Mensagem apagada não se edita' using errcode = '22023';
  end if;
  v_texto := private."FC_CHAT_VALIDAR_TEXTO"(p_texto);
  if v_texto is distinct from v."DS_TEXTO" then
    update public."TB_MENSAGEM"
       set "DS_TEXTO" = v_texto, "DT_EDICAO" = clock_timestamp()
     where "CO_MENSAGEM" = p_mensagem;
  end if;
  return private."FC_CHAT_MENSAGEM_JSON"(p_mensagem);
end;
$function$;
comment on function editar_mensagem_chat(uuid,text) is $comentario$Edita o texto da própria mensagem (1 a 4.000 caracteres) e marca DT_EDICAO. Só o autor (42501), não apagada (22023), com acesso à conversa.$comentario$;
revoke all on function editar_mensagem_chat(uuid,text) from public;
grant execute on function editar_mensagem_chat(uuid,text) to service_role;

-- encaminhar_mensagem_chat(uuid,uuid)
CREATE OR REPLACE FUNCTION public.encaminhar_mensagem_chat(p_mensagem uuid, p_conversa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v public."TB_MENSAGEM";
  v_destino public."TB_CONVERSA";
  v_id uuid := gen_random_uuid();
  v_agora timestamptz := clock_timestamp();
begin
  select * into v from public."TB_MENSAGEM" m where m."CO_MENSAGEM" = p_mensagem;
  if v."CO_MENSAGEM" is null then
    raise exception 'Mensagem não encontrada' using errcode = 'P0002';
  end if;
  perform private."FC_CHAT_EXIGIR_CONVERSA"(v."CO_CONVERSA");
  if v."ST_APAGADA" = 'S' then
    raise exception 'Mensagem apagada não se encaminha' using errcode = '22023';
  end if;
  v_destino := private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);

  if v_destino."TP_CONVERSA" = 'EDITAL' then
    insert into public."RL_CONVERSA_PARTICIPANTE" as p ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL")
    values (p_conversa, v_uid, 'MEMBRO')
    on conflict ("CO_CONVERSA", "CO_USUARIO") do update
      set "DT_SAIDA" = null,
          "DT_ENTRADA" = case when p."DT_SAIDA" is null
                              then p."DT_ENTRADA" else now() end;
  end if;

  insert into public."TB_MENSAGEM"
    ("CO_MENSAGEM", "CO_CONVERSA", "CO_USUARIO_AUTOR", "DS_TEXTO", "DS_LINK_TELA", "DT_CRIACAO", "ST_ENCAMINHADA", "QT_ANEXO")
  values (v_id, p_conversa, v_uid, v."DS_TEXTO", v."DS_LINK_TELA", v_agora, 'S',
          (select count(*) from public."TB_ANEXO_MENSAGEM" a
            where a."CO_MENSAGEM" = p_mensagem and a."ST_REGISTRO_ATIVO" = 'S'));
  insert into public."TB_ANEXO_MENSAGEM"
    ("CO_ANEXO_MENSAGEM", "CO_MENSAGEM", "CO_CONVERSA", "CO_USUARIO_INCLUSAO", "NO_ARQUIVO", "DS_CAMINHO", "DS_MIME", "QT_BYTES")
  select gen_random_uuid(), v_id, p_conversa, v_uid, a."NO_ARQUIVO", a."DS_CAMINHO", a."DS_MIME", a."QT_BYTES"
    from public."TB_ANEXO_MENSAGEM" a
   where a."CO_MENSAGEM" = p_mensagem and a."ST_REGISTRO_ATIVO" = 'S';

  update public."TB_CONVERSA"
     set "DT_ULTIMA_MENSAGEM" = v_agora, "DT_ATUALIZACAO" = v_agora
   where "CO_CONVERSA" = p_conversa;
  update public."RL_CONVERSA_PARTICIPANTE"
     set "DT_ULTIMA_LEITURA" = greatest(coalesce("DT_ULTIMA_LEITURA", v_agora), v_agora),
         "ST_NAO_LIDA" = 'N'
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid;

  return private."FC_CHAT_MENSAGEM_JSON"(v_id);
end;
$function$;
comment on function encaminhar_mensagem_chat(uuid,uuid) is $comentario$Encaminha uma mensagem para outra conversa: copia texto, cartão e anexos ativos (mesmo objeto do Storage), sem menções e sem dizer de onde veio (ST_ENCAMINHADA = S). Exige ler as duas conversas (42501); apagada não se encaminha (22023).$comentario$;
revoke all on function encaminhar_mensagem_chat(uuid,uuid) from public;
grant execute on function encaminhar_mensagem_chat(uuid,uuid) to service_role;

-- enviar_mensagem_chat(uuid,text,jsonb,uuid[],uuid,uuid,jsonb)
CREATE OR REPLACE FUNCTION public.enviar_mensagem_chat(p_conversa uuid, p_texto text, p_link_tela jsonb DEFAULT NULL::jsonb, p_mencoes uuid[] DEFAULT NULL::uuid[], p_mensagem uuid DEFAULT NULL::uuid, p_resposta uuid DEFAULT NULL::uuid, p_anexos jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_conversa public."TB_CONVERSA";
  v_texto text := coalesce(p_texto, '');
  v_link jsonb;
  v_mencoes uuid[];
  v_existente public."TB_MENSAGEM";
  v_id uuid;
  v_agora timestamptz := clock_timestamp();
  v_anexos jsonb := coalesce(p_anexos, '[]'::jsonb);
  v_anexo jsonb;
  v_caminho text;
  v_nome text;
  v_objeto record;
begin
  v_conversa := private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  v_link := private."FC_CHAT_VALIDAR_LINK"(p_link_tela);
  if jsonb_typeof(v_anexos) <> 'array' or jsonb_array_length(v_anexos) > 5 then
    raise exception 'No máximo 5 anexos por mensagem' using errcode = '22023';
  end if;
  if length(v_texto) > 4000 then
    raise exception 'A mensagem passa de 4.000 caracteres' using errcode = '22023';
  end if;
  if length(btrim(v_texto)) = 0 and jsonb_array_length(v_anexos) = 0 and v_link is null then
    raise exception 'Escreva a mensagem' using errcode = '22023';
  end if;

  -- Reenvio do mesmo id (rede caiu na resposta): devolve a que já está gravada.
  if p_mensagem is not null then
    select * into v_existente from public."TB_MENSAGEM" m where m."CO_MENSAGEM" = p_mensagem;
    if v_existente."CO_MENSAGEM" is not null then
      if v_existente."CO_USUARIO_AUTOR" <> v_uid or v_existente."CO_CONVERSA" <> p_conversa then
        raise exception 'Identificador de mensagem já usado' using errcode = '22023';
      end if;
      return private."FC_CHAT_MENSAGEM_JSON"(p_mensagem);
    end if;
  end if;

  -- A citada é desta conversa.
  if p_resposta is not null and not exists (
    select 1 from public."TB_MENSAGEM" r
     where r."CO_MENSAGEM" = p_resposta and r."CO_CONVERSA" = p_conversa) then
    raise exception 'A mensagem citada não é desta conversa' using errcode = '22023';
  end if;

  -- Na conversa do edital, quem escreve passa a acompanhar.
  if v_conversa."TP_CONVERSA" = 'EDITAL' then
    insert into public."RL_CONVERSA_PARTICIPANTE" as p ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL")
    values (p_conversa, v_uid, 'MEMBRO')
    on conflict ("CO_CONVERSA", "CO_USUARIO") do update
      set "DT_SAIDA" = null,
          "DT_ENTRADA" = case when p."DT_SAIDA" is null
                              then p."DT_ENTRADA" else now() end;
  end if;

  -- Menção só de participante (sem saída), nunca de si mesmo.
  select coalesce(array_agg(distinct x), '{}') into v_mencoes
    from unnest(coalesce(p_mencoes, '{}'::uuid[])) x
   where x <> v_uid
     and exists (select 1 from public."RL_CONVERSA_PARTICIPANTE" p
                  where p."CO_CONVERSA" = p_conversa and p."CO_USUARIO" = x and p."DT_SAIDA" is null);
  if cardinality(v_mencoes) > 50 then v_mencoes := v_mencoes[1:50]; end if;

  insert into public."TB_MENSAGEM"
    ("CO_MENSAGEM", "CO_CONVERSA", "CO_USUARIO_AUTOR", "DS_TEXTO", "DS_LINK_TELA", "CO_USUARIOS_MENCIONADOS",
     "DT_CRIACAO", "CO_MENSAGEM_RESPOSTA", "QT_ANEXO")
  values (coalesce(p_mensagem, gen_random_uuid()), p_conversa, v_uid, v_texto, v_link, v_mencoes,
          v_agora, p_resposta, jsonb_array_length(v_anexos))
  returning "CO_MENSAGEM" into v_id;

  -- Anexos: o objeto já está no Storage, é de quem envia e o tipo e o tamanho vêm de lá.
  for v_anexo in select x from jsonb_array_elements(v_anexos) x loop
    v_caminho := coalesce(v_anexo->>'caminho', '');
    v_nome := btrim(coalesce(v_anexo->>'nome', ''));
    if v_caminho !~ ('^' || p_conversa::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$') then
      raise exception 'Anexo fora desta conversa' using errcode = '22023';
    end if;
    if length(v_nome) not between 1 and 200 then
      raise exception 'O nome do arquivo deve ter de 1 a 200 caracteres' using errcode = '22023';
    end if;
    if exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = v_caminho)
       or exists (select 1 from public."TB_EXPURGO_ANEXO_CHAT" e where e."DS_CAMINHO" = v_caminho) then
      raise exception 'Este arquivo já foi usado' using errcode = '22023';
    end if;
    select (o.metadata->>'size')::bigint as bytes, o.metadata->>'mimetype' as mime, o.owner_id as dono
      into v_objeto
      from storage.objects o
     where o.bucket_id = 'chat-anexos' and o.name = v_caminho;
    if not found then
      raise exception 'Arquivo não encontrado no Storage' using errcode = 'P0002';
    end if;
    if v_objeto.dono is distinct from v_uid::text then
      raise exception 'O arquivo foi enviado por outra pessoa' using errcode = '42501';
    end if;
    if coalesce(v_objeto.bytes, 0) not between 1 and 10485760 then
      raise exception 'O anexo deve ter até 10 MB' using errcode = '22023';
    end if;
    if v_objeto.mime is null or not (v_objeto.mime = any (private."FC_CHAT_TIPOS_ANEXO"())) then
      raise exception 'Tipo de arquivo não aceito (PDF, imagem ou planilha)' using errcode = '22023';
    end if;
    insert into public."TB_ANEXO_MENSAGEM"
      ("CO_ANEXO_MENSAGEM", "CO_MENSAGEM", "CO_CONVERSA", "CO_USUARIO_INCLUSAO", "NO_ARQUIVO", "DS_CAMINHO", "DS_MIME", "QT_BYTES")
    values (split_part(split_part(v_caminho, '/', 2), '.', 1)::uuid, v_id, p_conversa, v_uid,
            v_nome, v_caminho, v_objeto.mime, v_objeto.bytes);
  end loop;

  update public."TB_CONVERSA"
     set "DT_ULTIMA_MENSAGEM" = v_agora, "DT_ATUALIZACAO" = v_agora
   where "CO_CONVERSA" = p_conversa;
  update public."RL_CONVERSA_PARTICIPANTE"
     set "DT_ULTIMA_LEITURA" = greatest(coalesce("DT_ULTIMA_LEITURA", v_agora), v_agora),
         "ST_NAO_LIDA" = 'N'
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid;

  return private."FC_CHAT_MENSAGEM_JSON"(v_id);
end;
$function$;
comment on function enviar_mensagem_chat(uuid,text,jsonb,uuid[],uuid,uuid,jsonb) is $comentario$Envia uma mensagem: texto até 4.000 caracteres (vazio só com anexo ou cartão), link interno da tela opcional (FC_CHAT_VALIDAR_LINK), menções (só participantes), id gerado no navegador (reenviar não duplica), a mensagem citada (p_resposta, da mesma conversa) e até 5 anexos (p_anexos: [{caminho, nome}] já enviados ao bucket chat-anexos por quem envia; tipo e tamanho lidos do Storage). Exige poder ler a conversa; na do edital, quem escreve passa a participar.$comentario$;
revoke all on function enviar_mensagem_chat(uuid,text,jsonb,uuid[],uuid,uuid,jsonb) from public;
grant execute on function enviar_mensagem_chat(uuid,text,jsonb,uuid[],uuid,uuid,jsonb) to service_role;

-- fixar_conversa_chat(uuid,boolean)
CREATE OR REPLACE FUNCTION public.fixar_conversa_chat(p_conversa uuid, p_fixada boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
begin
  perform private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  update public."RL_CONVERSA_PARTICIPANTE"
     set "DT_FIXACAO" = case when coalesce(p_fixada, false) then clock_timestamp() end
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid and "DT_SAIDA" is null;
  if not found then
    raise exception 'Você não acompanha esta conversa' using errcode = '22023';
  end if;
  return private."FC_CHAT_CONVERSA_JSON"(p_conversa, v_uid);
end;
$function$;
comment on function fixar_conversa_chat(uuid,boolean) is $comentario$Fixa (ou solta) a conversa no topo da lista de quem está logado (DT_FIXACAO). Só quem acompanha a conversa (22023).$comentario$;
revoke all on function fixar_conversa_chat(uuid,boolean) from public;
grant execute on function fixar_conversa_chat(uuid,boolean) to service_role;

-- limpar_conversa_chat(uuid)
CREATE OR REPLACE FUNCTION public.limpar_conversa_chat(p_conversa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_agora timestamptz := clock_timestamp();
begin
  perform private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  -- Direta e grupo: a pessoa já participa (FC_CHAT_EXIGIR_CONVERSA). Edital: a
  -- linha nasce aqui, como ao abrir a conversa.
  insert into public."RL_CONVERSA_PARTICIPANTE" as p
    ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL", "DT_ULTIMA_LEITURA", "DT_LIMPEZA")
  values (p_conversa, v_uid, 'MEMBRO', v_agora, v_agora)
  on conflict ("CO_CONVERSA", "CO_USUARIO") do update
    set "DT_LIMPEZA" = v_agora,
        "DT_ULTIMA_LEITURA" = greatest(coalesce(p."DT_ULTIMA_LEITURA", v_agora), v_agora);
  return private."FC_CHAT_CONVERSA_JSON"(p_conversa, v_uid);
end;
$function$;
comment on function limpar_conversa_chat(uuid) is $comentario$Limpa a conversa só para quem está logado: as mensagens enviadas até agora deixam de aparecer para ela (e de contar como não lidas). Nada é apagado; as outras pessoas continuam vendo. Exige poder ler a conversa.$comentario$;
revoke all on function limpar_conversa_chat(uuid) from public;
grant execute on function limpar_conversa_chat(uuid) to service_role;

-- listar_conversas_chat()
CREATE OR REPLACE FUNCTION public.listar_conversas_chat()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
begin
  return jsonb_build_object(
    'eu', v_uid,
    'meu_status', coalesce((select s."TP_STATUS" from public."TB_STATUS_PRESENCA_CHAT" s
                             where s."CO_USUARIO" = v_uid), 'DISPONIVEL'),
    'conversas', coalesce((
      select jsonb_agg(private."FC_CHAT_CONVERSA_JSON"(c."CO_CONVERSA", v_uid)
                       order by p."DT_FIXACAO" desc nulls last,
                                coalesce(c."DT_ULTIMA_MENSAGEM", c."DT_CRIACAO") desc, c."CO_CONVERSA")
        from public."TB_CONVERSA" c
        join public."RL_CONVERSA_PARTICIPANTE" p
          on p."CO_CONVERSA" = c."CO_CONVERSA" and p."CO_USUARIO" = v_uid and p."DT_SAIDA" is null
       where c."ST_REGISTRO_ATIVO" = 'S'
         and private."FC_CHAT_PODE_LER"(c."CO_CONVERSA")), '[]'::jsonb));
end;
$function$;
comment on function listar_conversas_chat() is $comentario$Conversas de quem está logado (participa e pode ler): as fixadas primeiro, depois da mais recente para a mais antiga, com não lidas, a última mensagem e o status escolhido pela pessoa (meu_status). Exige o recurso chat.$comentario$;
revoke all on function listar_conversas_chat() from public;
grant execute on function listar_conversas_chat() to service_role;

-- listar_mensagens_chat(uuid,timestamp with time zone,integer)
CREATE OR REPLACE FUNCTION public.listar_mensagens_chat(p_conversa uuid, p_antes timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limite integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_limpeza timestamptz;
  v_ids uuid[];
begin
  perform private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  select p."DT_LIMPEZA" into v_limpeza
    from public."RL_CONVERSA_PARTICIPANTE" p
   where p."CO_CONVERSA" = p_conversa and p."CO_USUARIO" = v_uid;
  select coalesce(array_agg(s.id order by s.criada_em desc, s.id desc), '{}') into v_ids
    from (
      select m."CO_MENSAGEM" as id, m."DT_CRIACAO" as criada_em
        from public."TB_MENSAGEM" m
       where m."CO_CONVERSA" = p_conversa
         and (p_antes is null or m."DT_CRIACAO" < p_antes)
         and (v_limpeza is null or m."DT_CRIACAO" > v_limpeza)
       order by m."DT_CRIACAO" desc, m."CO_MENSAGEM" desc
       limit v_limite + 1
    ) s;
  return jsonb_build_object(
    'conversa', private."FC_CHAT_CONVERSA_JSON"(p_conversa, v_uid),
    'tem_mais', cardinality(v_ids) > v_limite,
    'mensagens', coalesce((
      select jsonb_agg(private."FC_CHAT_MENSAGEM_JSON"(m."CO_MENSAGEM") order by m."DT_CRIACAO", m."CO_MENSAGEM")
        from public."TB_MENSAGEM" m
       where m."CO_MENSAGEM" = any (v_ids[1:v_limite])), '[]'::jsonb));
end;
$function$;
comment on function listar_mensagens_chat(uuid,timestamp with time zone,integer) is $comentario$Uma página de mensagens da conversa (as mais novas antes de p_antes, até p_limite, no máximo 100), em ordem de envio, com a conversa, as reações e tem_mais. Não traz o que a pessoa limpou (DT_LIMPEZA). Exige poder ler a conversa.$comentario$;
revoke all on function listar_mensagens_chat(uuid,timestamp with time zone,integer) from public;
grant execute on function listar_mensagens_chat(uuid,timestamp with time zone,integer) to service_role;

-- listar_pessoas_chat(text)
CREATE OR REPLACE FUNCTION public.listar_pessoas_chat(p_busca text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_busca text := lower(btrim(left(coalesce(p_busca, ''), 100)));
begin
  return jsonb_build_object('pessoas', coalesce((
    select jsonb_agg(private."FC_CHAT_PESSOA"(s.user_id) || jsonb_build_object('email', s.email) order by s.nome, s.user_id)
      from (
        select d.*
          from (
            select distinct on (u.user_id) u.user_id, u.email,
                   coalesce(nullif(btrim(u.nome), ''), split_part(coalesce(u.email, ''), '@', 1)) as nome
              from public."TB_PERFIL_USUARIO" u
             where u.ativo is true
               and u.user_id is not null
               and u.user_id <> v_uid
               and private."FC_NIVEL_EFETIVO"(u.id, u.perfil, 'chat') <> 'sem_acesso'
               and (v_busca = ''
                    or position(v_busca in lower(coalesce(u.nome, ''))) > 0
                    or position(v_busca in lower(coalesce(u.email, ''))) > 0)
             order by u.user_id, u.updated_at desc nulls last
          ) d
         order by d.nome, d.user_id
         limit 30
      ) s), '[]'::jsonb));
end;
$function$;
comment on function listar_pessoas_chat(text) is $comentario$Pessoas com perfil ativo e o recurso chat (fora quem pergunta), por nome ou e-mail, até 30, com online. Para "Nova conversa" e menções.$comentario$;
revoke all on function listar_pessoas_chat(text) from public;
grant execute on function listar_pessoas_chat(text) to service_role;

-- marcar_conversa_lida_chat(uuid,timestamp with time zone)
CREATE OR REPLACE FUNCTION public.marcar_conversa_lida_chat(p_conversa uuid, p_ate timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_conversa public."TB_CONVERSA";
  v_ate timestamptz := least(coalesce(p_ate, clock_timestamp()), clock_timestamp());
  v_lida timestamptz;
begin
  v_conversa := private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  if v_conversa."TP_CONVERSA" = 'EDITAL' then
    insert into public."RL_CONVERSA_PARTICIPANTE" as p ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL", "DT_ULTIMA_LEITURA")
    values (p_conversa, v_uid, 'MEMBRO', v_ate)
    on conflict ("CO_CONVERSA", "CO_USUARIO") do nothing;
  end if;
  update public."RL_CONVERSA_PARTICIPANTE"
     set "DT_ULTIMA_LEITURA" = greatest(coalesce("DT_ULTIMA_LEITURA", v_ate), v_ate),
         "ST_NAO_LIDA" = 'N'
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid
  returning "DT_ULTIMA_LEITURA" into v_lida;
  return jsonb_build_object('conversa', p_conversa, 'lida_em', v_lida);
end;
$function$;
comment on function marcar_conversa_lida_chat(uuid,timestamp with time zone) is $comentario$Marca a conversa como lida até p_ate (a última mensagem vista; padrão: agora) e tira a marca de não lida. A leitura só avança.$comentario$;
revoke all on function marcar_conversa_lida_chat(uuid,timestamp with time zone) from public;
grant execute on function marcar_conversa_lida_chat(uuid,timestamp with time zone) to service_role;

-- marcar_nao_lida_chat(uuid)
CREATE OR REPLACE FUNCTION public.marcar_nao_lida_chat(p_conversa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
begin
  perform private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  update public."RL_CONVERSA_PARTICIPANTE"
     set "ST_NAO_LIDA" = 'S'
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid and "DT_SAIDA" is null;
  if not found then
    raise exception 'Você não acompanha esta conversa' using errcode = '22023';
  end if;
  return private."FC_CHAT_CONVERSA_JSON"(p_conversa, v_uid);
end;
$function$;
comment on function marcar_nao_lida_chat(uuid) is $comentario$Marca a conversa como não lida para quem está logado (ST_NAO_LIDA = S; ler a conversa desmarca). Só quem acompanha a conversa (22023).$comentario$;
revoke all on function marcar_nao_lida_chat(uuid) from public;
grant execute on function marcar_nao_lida_chat(uuid) to service_role;

-- obter_mensagem_chat(uuid)
CREATE OR REPLACE FUNCTION public.obter_mensagem_chat(p_mensagem uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v public."TB_MENSAGEM";
  v_limpeza timestamptz;
begin
  select * into v from public."TB_MENSAGEM" m where m."CO_MENSAGEM" = p_mensagem;
  if v."CO_MENSAGEM" is null then
    raise exception 'Mensagem não encontrada' using errcode = 'P0002';
  end if;
  perform private."FC_CHAT_EXIGIR_CONVERSA"(v."CO_CONVERSA");
  select p."DT_LIMPEZA" into v_limpeza
    from public."RL_CONVERSA_PARTICIPANTE" p
   where p."CO_CONVERSA" = v."CO_CONVERSA" and p."CO_USUARIO" = v_uid;
  if v_limpeza is not null and v."DT_CRIACAO" <= v_limpeza then
    return null;
  end if;
  return private."FC_CHAT_MENSAGEM_JSON"(p_mensagem);
end;
$function$;
comment on function obter_mensagem_chat(uuid) is $comentario$Uma mensagem no formato da tela (com anexos e citação), para completar o que o Realtime entrega só como linha. Exige poder ler a conversa; o que a pessoa limpou volta nulo.$comentario$;
revoke all on function obter_mensagem_chat(uuid) from public;
grant execute on function obter_mensagem_chat(uuid) to service_role;

-- obter_retencao_chat()
CREATE OR REPLACE FUNCTION public.obter_retencao_chat()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN"();
  v public."TB_RETENCAO_CHAT";
begin
  select * into v from public."TB_RETENCAO_CHAT" r where r."CO_RETENCAO_CHAT" = 1;
  return jsonb_build_object(
    'dias', v."QT_DIAS_RETENCAO",
    'atualizado_em', case when v."CO_USUARIO_ATUALIZACAO" is null then null else v."DT_ATUALIZACAO" end,
    'atualizado_por', v."DS_EMAIL_ATUALIZACAO",
    'gerado_em', now(),
    'mensagens', (select count(*) from public."TB_MENSAGEM"),
    'reacoes', (select count(*) from public."RL_MENSAGEM_REACAO"),
    'anexos', (select count(*) from public."TB_ANEXO_MENSAGEM"),
    'expurgo_pendente', (select count(*) from public."TB_EXPURGO_ANEXO_CHAT" e where e."DT_EXPURGO" is null),
    'conversas', (select count(*) from public."TB_CONVERSA"),
    'conversas_sem_participante', (
      select count(*) from public."TB_CONVERSA" c
       where not exists (
         select 1 from public."RL_CONVERSA_PARTICIPANTE" p
          where p."CO_CONVERSA" = c."CO_CONVERSA" and p."DT_SAIDA" is null)),
    'mais_antiga', (select min(m."DT_CRIACAO") from public."TB_MENSAGEM" m),
    'idades', coalesce((
      select jsonb_agg(jsonb_build_object('dias', i.dias, 'mensagens', i.mensagens) order by i.dias)
        from (
          select floor(extract(epoch from (now() - m."DT_CRIACAO")) / 86400)::integer as dias,
                 count(*) as mensagens
            from public."TB_MENSAGEM" m
           where m."DT_CRIACAO" < now() - interval '7 days'
           group by 1
        ) i), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', h."CO_LIMPEZA_CHAT",
               'tipo', h."TP_LIMPEZA",
               'origem', h."TP_ORIGEM",
               'dias', h."QT_DIAS_RETENCAO",
               'corte', h."DT_CORTE",
               'mensagens', h."QT_MENSAGEM_APAGADA",
               'reacoes', h."QT_REACAO_APAGADA",
               'anexos', h."QT_ANEXO_APAGADO",
               'conversas', h."QT_CONVERSA_APAGADA",
               'motivo', h."DS_MOTIVO",
               'email', h."DS_EMAIL_RESPONSAVEL",
               'nome', (select u.nome from public."TB_PERFIL_USUARIO" u
                         where u.user_id = h."CO_USUARIO_RESPONSAVEL"
                         order by u.ativo desc nulls last limit 1),
               'em', h."DT_CRIACAO") order by h."DT_CRIACAO" desc)
        from (
          select * from public."TH_LIMPEZA_CHAT" x
           order by x."DT_CRIACAO" desc
           limit 50
        ) h), '[]'::jsonb));
end;
$function$;
comment on function obter_retencao_chat() is $comentario$Configurações › Mensagens (chat), só administrador global (42501): prazo de retenção (nulo = para sempre), quem mudou, contagens (mensagens, reações, anexos, arquivos na fila de expurgo, conversas, conversas sem participante ativo), a mensagem mais antiga, idades [{dias, mensagens}] das que têm mais de 7 dias e as últimas 50 limpezas (com os anexos apagados).$comentario$;
revoke all on function obter_retencao_chat() from public;
grant execute on function obter_retencao_chat() to service_role;

-- preparar_expurgo_anexos_chat()
CREATE OR REPLACE FUNCTION public.preparar_expurgo_anexos_chat()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"();
begin
  -- Enviado e nunca anexado (mais de 1 dia): também sai.
  insert into public."TB_EXPURGO_ANEXO_CHAT" ("DS_CAMINHO", "TP_ORIGEM")
  select o.name, 'ORFAO'
    from storage.objects o
   where o.bucket_id = 'chat-anexos'
     and o.created_at < now() - interval '1 day'
     and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'
     and not exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = o.name)
  on conflict on constraint "PK_TB_EXPURGO_ANEXO_CHAT" do nothing;
  return jsonb_build_object(
    'bucket', 'chat-anexos',
    'pendentes', (select count(*) from public."TB_EXPURGO_ANEXO_CHAT" e where e."DT_EXPURGO" is null),
    'caminhos', coalesce((
      select jsonb_agg(x."DS_CAMINHO" order by x."DT_CRIACAO", x."DS_CAMINHO")
        from (
          select e."DS_CAMINHO", e."DT_CRIACAO"
            from public."TB_EXPURGO_ANEXO_CHAT" e
           where e."DT_EXPURGO" is null
             and not exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = e."DS_CAMINHO")
           order by e."DT_CRIACAO", e."DS_CAMINHO"
           limit 100
        ) x), '[]'::jsonb));
end;
$function$;
comment on function preparar_expurgo_anexos_chat() is $comentario$Administrador global (42501) ou service_role (job diário, desde 20261007250000): põe na fila os arquivos enviados e nunca anexados (mais de 1 dia) e devolve até 100 caminhos da fila para remover pela API do Storage (a política de exclusão só aceita o que está na fila; a service_role remove só o que esta função devolveu).$comentario$;
revoke all on function preparar_expurgo_anexos_chat() from public;
grant execute on function preparar_expurgo_anexos_chat() to service_role;

-- registrar_expurgo_anexos_chat(text,text,uuid,text,timestamp with time zone,jsonb,text)
CREATE OR REPLACE FUNCTION public.registrar_expurgo_anexos_chat(p_execucao text, p_disparo text, p_usuario uuid, p_url text, p_inicio timestamp with time zone, p_contagens jsonb, p_erro text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_mensagem text := nullif(left(btrim(coalesce(p_erro, '')), 500), '');
  v_contagens jsonb := coalesce(p_contagens, '{}'::jsonb);
  v_falhas integer;
  v_situacao text;
begin
  if p_execucao is null or p_execucao !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de execução inválido' using errcode = '22023';
  end if;
  if p_disparo is null or p_disparo not in ('AGENDA', 'MONITORA', 'GITHUB') then
    raise exception 'Disparo inválido: AGENDA, MONITORA ou GITHUB' using errcode = '22023';
  end if;
  if (p_disparo = 'MONITORA') <> (p_usuario is not null) then
    raise exception 'Usuário só (e sempre) no disparo pelo MONITORA' using errcode = '22023';
  end if;
  if p_inicio is null or p_inicio > now() + interval '5 minutes' or p_inicio < now() - interval '1 day' then
    raise exception 'Início da execução inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(v_contagens) <> 'object'
     or exists (
       select 1 from jsonb_each(v_contagens) c
        where c.key not in ('lotes', 'removidos', 'confirmados', 'falhas', 'pendentes')
           or not (
                (jsonb_typeof(c.value) = 'number'
                 and (c.value #>> '{}')::numeric between 0 and 2147483647
                 and (c.value #>> '{}')::numeric = trunc((c.value #>> '{}')::numeric))
             or (c.key = 'pendentes' and jsonb_typeof(c.value) = 'null'))) then
    raise exception 'Contagens inválidas: lotes, removidos, confirmados, falhas e pendentes (inteiros >= 0)'
      using errcode = '22023';
  end if;
  v_falhas := coalesce((v_contagens ->> 'falhas')::integer, 0);
  -- Mensagem com cara de caminho do bucket (uuid) ou de dado pessoal não entra no log.
  if v_mensagem is not null
     and (v_mensagem ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
          or v_mensagem ~ '@' or v_mensagem ~ '[0-9]{11}') then
    v_mensagem := 'Erro geral (a mensagem foi omitida por trazer caminho ou dado pessoal).';
  end if;
  v_situacao := case
    when v_mensagem is not null then 'FALHOU'
    when v_falhas > 0 then 'PARCIAL'
    else 'CONCLUIDA' end;

  insert into public."TL_EXPURGO_ANEXO_CHAT" (
    "CO_EXECUCAO", "DT_INICIO", "TP_SITUACAO", "TP_DISPARO", "CO_USUARIO_DISPARO",
    "QT_LOTE", "QT_REMOVIDO", "QT_CONFIRMADO", "QT_FALHA", "QT_PENDENTE", "DS_MENSAGEM", "DS_URL_EXECUCAO")
  values (
    p_execucao, least(p_inicio, now()), v_situacao, p_disparo, p_usuario,
    coalesce((v_contagens ->> 'lotes')::integer, 0),
    coalesce((v_contagens ->> 'removidos')::integer, 0),
    coalesce((v_contagens ->> 'confirmados')::integer, 0),
    v_falhas,
    (v_contagens ->> 'pendentes')::integer,
    v_mensagem,
    p_url)
  on conflict on constraint "PK_TL_EXPURGO_ANEXO_CHAT" do nothing;
  if not found then
    raise exception 'Execução % já registrada', p_execucao using errcode = '23505';
  end if;

  return jsonb_build_object('execucao', p_execucao, 'situacao', v_situacao);
end;
$function$;
comment on function registrar_expurgo_anexos_chat(text,text,uuid,text,timestamp with time zone,jsonb,text) is $comentario$Registra em TL_EXPURGO_ANEXO_CHAT uma execução do job diário do expurgo dos anexos do chat: quem disparou (AGENDA, MONITORA com o usuário, GITHUB), o endereço no GitHub, o início e as contagens {lotes, removidos, confirmados, falhas, pendentes}. Com p_erro, FALHOU; com falhas, PARCIAL; senão, CONCLUIDA. Mensagem com caminho (uuid) ou dado pessoal é omitida. 22023 para entrada inválida; 23505 se a execução já foi registrada. Só service_role.$comentario$;
revoke all on function registrar_expurgo_anexos_chat(text,text,uuid,text,timestamp with time zone,jsonb,text) from public;
grant execute on function registrar_expurgo_anexos_chat(text,text,uuid,text,timestamp with time zone,jsonb,text) to service_role;

-- sair_conversa_chat(uuid)
CREATE OR REPLACE FUNCTION public.sair_conversa_chat(p_conversa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_conversa public."TB_CONVERSA";
begin
  v_conversa := private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  if v_conversa."TP_CONVERSA" = 'DIRETA' then
    raise exception 'Conversa direta não tem saída; silencie' using errcode = '22023';
  end if;
  update public."RL_CONVERSA_PARTICIPANTE"
     set "DT_SAIDA" = now()
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid and "DT_SAIDA" is null;
  return jsonb_build_object('conversa', p_conversa, 'saiu', true);
end;
$function$;
comment on function sair_conversa_chat(uuid) is $comentario$Sai do grupo (deixa de ler e de receber) ou deixa de acompanhar a conversa do edital (continua podendo abrir). Direta não tem saída (22023).$comentario$;
revoke all on function sair_conversa_chat(uuid) from public;
grant execute on function sair_conversa_chat(uuid) to service_role;

-- salvar_retencao_chat(integer,text)
CREATE OR REPLACE FUNCTION public.salvar_retencao_chat(p_dias integer, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN"();
  v_motivo text;
  v_email text;
  v_corte timestamptz;
  v_apagou jsonb := jsonb_build_object('mensagens', 0, 'reacoes', 0, 'anexos', 0);
begin
  if p_dias is not null and (p_dias < 7 or p_dias > 3650) then
    raise exception 'O prazo vai de 7 a 3.650 dias' using errcode = '22023';
  end if;
  v_motivo := private."FC_CHAT_VALIDAR_MOTIVO"(p_motivo);
  v_email := private."FC_CHAT_EMAIL"(v_uid);

  update public."TB_RETENCAO_CHAT"
     set "QT_DIAS_RETENCAO" = p_dias,
         "CO_USUARIO_ATUALIZACAO" = v_uid,
         "DS_EMAIL_ATUALIZACAO" = v_email,
         "DT_ATUALIZACAO" = now()
   where "CO_RETENCAO_CHAT" = 1;

  if p_dias is not null then
    v_corte := now() - make_interval(days => p_dias);
    v_apagou := private."FC_CHAT_APAGAR_MENSAGENS"(v_corte);
  end if;

  insert into public."TH_LIMPEZA_CHAT"
    ("TP_LIMPEZA", "TP_ORIGEM", "QT_DIAS_RETENCAO", "DT_CORTE", "QT_MENSAGEM_APAGADA", "QT_REACAO_APAGADA",
     "QT_ANEXO_APAGADO", "DS_MOTIVO", "CO_USUARIO_RESPONSAVEL", "DS_EMAIL_RESPONSAVEL")
  values ('PRAZO', 'ADMIN', p_dias, v_corte, (v_apagou->>'mensagens')::int, (v_apagou->>'reacoes')::int,
          (v_apagou->>'anexos')::int, v_motivo, v_uid, v_email);

  return public.obter_retencao_chat();
end;
$function$;
comment on function salvar_retencao_chat(integer,text) is $comentario$Define o prazo de retenção das mensagens do chat (nulo = guardar para sempre; senão 7 a 3.650 dias) com motivo (3 a 500). Com prazo, apaga de fato na hora as mensagens mais antigas, as reações e os anexos delas (os arquivos vão para a fila de expurgo). Registra em TH_LIMPEZA_CHAT. Só administrador global (42501); fora das faixas, 22023. Devolve obter_retencao_chat().$comentario$;
revoke all on function salvar_retencao_chat(integer,text) from public;
grant execute on function salvar_retencao_chat(integer,text) to service_role;

-- silenciar_conversa_chat(uuid,boolean)
CREATE OR REPLACE FUNCTION public.silenciar_conversa_chat(p_conversa uuid, p_silenciada boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
begin
  perform private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  update public."RL_CONVERSA_PARTICIPANTE"
     set "ST_SILENCIADA" = case when coalesce(p_silenciada, false) then 'S' else 'N' end
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid;
  return private."FC_CHAT_CONVERSA_JSON"(p_conversa, v_uid);
end;
$function$;
comment on function silenciar_conversa_chat(uuid,boolean) is $comentario$Silencia (ou não) a conversa para quem está logado: silenciada não conta no contador nem avisa.$comentario$;
revoke all on function silenciar_conversa_chat(uuid,boolean) from public;
grant execute on function silenciar_conversa_chat(uuid,boolean) to service_role;

-- zerar_mensagens_chat(text,text,boolean)
CREATE OR REPLACE FUNCTION public.zerar_mensagens_chat(p_confirmacao text, p_motivo text, p_incluir_conversas boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN"();
  v_motivo text;
  v_email text;
  v_dias integer;
  v_apagou jsonb;
  v_conversas uuid[] := '{}';
begin
  if p_confirmacao is distinct from 'ZERAR' then
    raise exception 'Digite ZERAR para confirmar' using errcode = '22023';
  end if;
  v_motivo := private."FC_CHAT_VALIDAR_MOTIVO"(p_motivo);
  v_email := private."FC_CHAT_EMAIL"(v_uid);
  select r."QT_DIAS_RETENCAO" into v_dias from public."TB_RETENCAO_CHAT" r where r."CO_RETENCAO_CHAT" = 1;

  v_apagou := private."FC_CHAT_APAGAR_MENSAGENS"(null);

  if coalesce(p_incluir_conversas, false) then
    select coalesce(array_agg(c."CO_CONVERSA"), '{}') into v_conversas
      from public."TB_CONVERSA" c
     where not exists (select 1 from public."TB_MENSAGEM" m where m."CO_CONVERSA" = c."CO_CONVERSA")
       and not exists (
         select 1 from public."RL_CONVERSA_PARTICIPANTE" p
          where p."CO_CONVERSA" = c."CO_CONVERSA" and p."DT_SAIDA" is null);
    delete from public."RL_CONVERSA_PARTICIPANTE" p where p."CO_CONVERSA" = any (v_conversas);
    delete from public."TB_CONVERSA" c where c."CO_CONVERSA" = any (v_conversas);
  end if;

  insert into public."TH_LIMPEZA_CHAT"
    ("TP_LIMPEZA", "TP_ORIGEM", "QT_DIAS_RETENCAO", "QT_MENSAGEM_APAGADA", "QT_REACAO_APAGADA", "QT_ANEXO_APAGADO",
     "QT_CONVERSA_APAGADA", "DS_MOTIVO", "CO_USUARIO_RESPONSAVEL", "DS_EMAIL_RESPONSAVEL")
  values ('ZERAR', 'ADMIN', v_dias, (v_apagou->>'mensagens')::int, (v_apagou->>'reacoes')::int,
          (v_apagou->>'anexos')::int, cardinality(v_conversas), v_motivo, v_uid, v_email);

  return public.obter_retencao_chat();
end;
$function$;
comment on function zerar_mensagens_chat(text,text,boolean) is $comentario$Apaga de fato TODAS as mensagens, reações e anexos do chat (os arquivos vão para a fila de expurgo); com p_incluir_conversas, também as conversas sem mensagem e sem participante ativo. p_confirmacao precisa ser exatamente ZERAR e o motivo ter 3 a 500 caracteres (22023). Registra em TH_LIMPEZA_CHAT. Só administrador global (42501). Não há como desfazer. Devolve obter_retencao_chat().$comentario$;
revoke all on function zerar_mensagens_chat(text,text,boolean) from public;
grant execute on function zerar_mensagens_chat(text,text,boolean) to service_role;

-- Políticas.
drop policy if exists "chat_anexos_storage_select" on storage.objects;
create policy "chat_anexos_storage_select" on storage.objects
  as permissive for select to authenticated
  using (((bucket_id = 'chat-anexos'::text) AND (private."FC_CHAT_PODE_BAIXAR_ANEXO"(name) OR ((owner_id = (( SELECT auth.uid() AS uid))::text) AND (created_at > (now() - '00:10:00'::interval)) AND private."FC_CHAT_ACABOU_DE_ENVIAR"(name)) OR private."FC_CHAT_PODE_EXPURGAR"(name))));
drop policy if exists "PL_CONVERSA_LEITURA" on arquivo."TB_CONVERSA";
create policy "PL_CONVERSA_LEITURA" on arquivo."TB_CONVERSA"
  as permissive for select to authenticated
  using (private."FC_CHAT_PODE_LER"("CO_CONVERSA"));
drop policy if exists "PL_CONVPARTICIP_LEITURA" on arquivo."RL_CONVERSA_PARTICIPANTE";
create policy "PL_CONVPARTICIP_LEITURA" on arquivo."RL_CONVERSA_PARTICIPANTE"
  as permissive for select to authenticated
  using ((private."FC_CHAT_PODE_LER"("CO_CONVERSA") AND (("CO_USUARIO" = ( SELECT auth.uid() AS uid)) OR private."FC_CHAT_PARTICIPA"("CO_CONVERSA"))));
drop policy if exists "PL_MENSREACAO_LEITURA" on arquivo."RL_MENSAGEM_REACAO";
create policy "PL_MENSREACAO_LEITURA" on arquivo."RL_MENSAGEM_REACAO"
  as permissive for select to authenticated
  using (private."FC_CHAT_PODE_LER"("CO_CONVERSA"));
drop policy if exists "PL_MENSAGEM_LEITURA" on arquivo."TB_MENSAGEM";
create policy "PL_MENSAGEM_LEITURA" on arquivo."TB_MENSAGEM"
  as permissive for select to authenticated
  using (private."FC_CHAT_PODE_LER"("CO_CONVERSA"));

do $ensaio$
begin
  assert not exists (
    select 1 from ensaio_funcoes e
     where not exists (
       select 1 from pg_proc p
        where p.oid::regprocedure::text = e.sig
          and p.proacl::text is not distinct from e.acl
          and md5(p.prosrc) = e.corpo)),
    'o rollback não devolveu alguma função igual (assinatura, privilégios ou corpo)';
  assert not exists (
    select 1 from ensaio_politicas e
     where not exists (select 1 from pg_policies p
                        where (p.schemaname, p.tablename, p.policyname) = (e.schemaname, e.tablename, e.policyname)
                          and p.qual = e.qual)),
    'o rollback não devolveu alguma política igual';
end;
$ensaio$;

select 'ensaio ok' as resultado;

rollback;
