/*
  CHAT DO MONITORA: RETENÇÃO DAS MENSAGENS E "ZERAR MENSAGENS"

  Pedido do usuário: "Colocar em Configuração para o Administrador definir
  [o prazo de retenção] ou zerar as mensagens". Até aqui as mensagens do chat
  (TB_MENSAGEM, RL_MENSAGEM_REACAO) ficavam guardadas para sempre. A seção
  Configurações › Mensagens (chat) (src/modulos/configuracoes/, só o
  administrador global) usa as RPCs abaixo.

  O QUE ENTRA
    public."TB_RETENCAO_CHAT"   linha única: o prazo de retenção em dias (nulo =
                                guardar para sempre, o padrão, como era), quem
                                mudou e quando
    public."TH_LIMPEZA_CHAT"    auditoria de cada limpeza: tipo (PRAZO ou
                                ZERAR), origem (ADMIN ou AGENDA), prazo, corte,
                                quantas mensagens, reações e conversas saíram,
                                motivo e quem pediu. NUNCA guarda o conteúdo
                                das mensagens.

  EXCLUSÃO REAL (LGPD: o dado que passou do prazo deixa de existir)
    Prazo de N dias: apaga de fato as mensagens com DT_CRIACAO anterior a
    now() - N dias e as reações delas. As conversas ficam (sem essas
    mensagens). Ao salvar o prazo, a limpeza roda na hora; depois, todo dia,
    pela tarefa agsus_chat_retencao_diaria (pg_cron, 06:15 UTC = 03:15 em
    Brasília), que registra em TH_LIMPEZA_CHAT só quando apagou algo.
    Zerar: apaga TODAS as mensagens e reações; com p_incluir_conversas,
    também as conversas que ficaram sem mensagem e sem participante ativo
    (grupos e conversas de edital que todos deixaram). Não há como desfazer.
    Apagar a própria mensagem pelo painel continua lógico ("mensagem apagada").

  QUEM: só as RPCs (SECURITY DEFINER, search_path vazio). As três exigem
  sessão (28000) e administrador global (private.is_master(); 42501). As
  tabelas novas têm RLS ligada e nenhum grant para anon/authenticated.
    obter_retencao_chat()                      prazo, contagens (mensagens,
                                               reações, conversas, conversas
                                               sem participante), mais antiga,
                                               idades (mensagens por dia de
                                               idade, a partir de 7) e as
                                               últimas 50 limpezas
    salvar_retencao_chat(p_dias, p_motivo)     prazo (nulo ou 7 a 3.650 dias)
                                               e motivo (3 a 500 caracteres);
                                               fora disso, 22023; aplica o
                                               prazo na hora e registra
    zerar_mensagens_chat(p_confirmacao,        p_confirmacao precisa ser
      p_motivo, p_incluir_conversas)           exatamente 'ZERAR' (22023)

  REALTIME: o DELETE de TB_MENSAGEM e de RL_MENSAGEM_REACAO chega aos
  assinantes só com a chave (o Realtime não aplica a RLS a DELETE e, com RLS,
  só manda a chave primária): nenhum texto sai. O painel tira a mensagem pelo
  id (src/modulos/chat/estado.js) e, na releitura, confere a página.

  PRÉ-REQUISITO: 20261005100000_chat_limpar_e_reacoes.sql aplicada (a
  migration para se não estiver).

  Ensaio: supabase/ensaios/20261005190000_chat_retencao_das_mensagens.sql
  Rollback: supabase/rollback/20261005190000_chat_retencao_das_mensagens.sql
*/
begin;

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regclass('public."RL_MENSAGEM_REACAO"') is null
     or to_regprocedure('private.is_master()') is null then
    raise exception 'Aplique antes 20261005100000_chat_limpar_e_reacoes.sql (sem as reações do chat).';
  end if;
end;
$$;

-- 1. O prazo (linha única) ----------------------------------------------------------------
create table public."TB_RETENCAO_CHAT" (
  "CO_RETENCAO_CHAT" smallint not null default 1,
  "QT_DIAS_RETENCAO" integer,
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DS_EMAIL_ATUALIZACAO" varchar(320),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_RETENCAO_CHAT" primary key ("CO_RETENCAO_CHAT"),
  constraint "CK_RETENCAOCHAT_LINHAUNICA" check ("CO_RETENCAO_CHAT" = 1),
  constraint "CK_RETENCAOCHAT_QTDIASRETENCAO" check ("QT_DIAS_RETENCAO" is null or "QT_DIAS_RETENCAO" between 7 and 3650)
);
comment on table public."TB_RETENCAO_CHAT" is
  'Prazo de retenção das mensagens do chat (linha única). Nulo: guardar para sempre. Escrita só por salvar_retencao_chat; lida por obter_retencao_chat e pela tarefa agsus_chat_retencao_diaria.';
comment on column public."TB_RETENCAO_CHAT"."CO_RETENCAO_CHAT" is 'Sempre 1: a tabela tem uma linha só.';
comment on column public."TB_RETENCAO_CHAT"."QT_DIAS_RETENCAO" is 'Prazo em dias (7 a 3.650): mensagens mais antigas que isso são apagadas de fato. Nulo: guardar para sempre.';
comment on column public."TB_RETENCAO_CHAT"."CO_USUARIO_ATUALIZACAO" is 'Quem definiu o prazo (auth.users.id); nulo enquanto ninguém mudou.';
comment on column public."TB_RETENCAO_CHAT"."DS_EMAIL_ATUALIZACAO" is 'E-mail de quem definiu o prazo, no momento da mudança.';
comment on column public."TB_RETENCAO_CHAT"."DT_ATUALIZACAO" is 'Quando o prazo foi definido.';
comment on constraint "PK_TB_RETENCAO_CHAT" on public."TB_RETENCAO_CHAT" is 'Identificador da linha única.';
comment on constraint "CK_RETENCAOCHAT_LINHAUNICA" on public."TB_RETENCAO_CHAT" is 'Só a linha 1.';
comment on constraint "CK_RETENCAOCHAT_QTDIASRETENCAO" on public."TB_RETENCAO_CHAT" is 'Prazo nulo (para sempre) ou de 7 a 3.650 dias.';

insert into public."TB_RETENCAO_CHAT" ("CO_RETENCAO_CHAT", "QT_DIAS_RETENCAO") values (1, null);

alter table public."TB_RETENCAO_CHAT" enable row level security;
revoke all on public."TB_RETENCAO_CHAT" from public, anon, authenticated;

-- 2. Auditoria das limpezas ---------------------------------------------------------------
create table public."TH_LIMPEZA_CHAT" (
  "CO_LIMPEZA_CHAT" uuid not null default gen_random_uuid(),
  "TP_LIMPEZA" varchar(5) not null,
  "TP_ORIGEM" varchar(6) not null,
  "QT_DIAS_RETENCAO" integer,
  "DT_CORTE" timestamptz,
  "QT_MENSAGEM_APAGADA" integer not null default 0,
  "QT_REACAO_APAGADA" integer not null default 0,
  "QT_CONVERSA_APAGADA" integer not null default 0,
  "DS_MOTIVO" varchar(500),
  "CO_USUARIO_RESPONSAVEL" uuid,
  "DS_EMAIL_RESPONSAVEL" varchar(320),
  "DT_CRIACAO" timestamptz not null default clock_timestamp(),
  constraint "PK_TH_LIMPEZA_CHAT" primary key ("CO_LIMPEZA_CHAT"),
  constraint "CK_LIMPEZACHAT_TPLIMPEZA" check ("TP_LIMPEZA" in ('PRAZO', 'ZERAR')),
  constraint "CK_LIMPEZACHAT_TPORIGEM" check ("TP_ORIGEM" in ('ADMIN', 'AGENDA')),
  constraint "CK_LIMPEZACHAT_QTDIASRETENCAO" check ("QT_DIAS_RETENCAO" is null or "QT_DIAS_RETENCAO" between 7 and 3650),
  constraint "CK_LIMPEZACHAT_CORTE" check (
    ("TP_LIMPEZA" = 'ZERAR' and "DT_CORTE" is null)
    or ("TP_LIMPEZA" = 'PRAZO' and ("QT_DIAS_RETENCAO" is null) = ("DT_CORTE" is null))),
  constraint "CK_LIMPEZACHAT_QUANTIDADES" check ("QT_MENSAGEM_APAGADA" >= 0 and "QT_REACAO_APAGADA" >= 0 and "QT_CONVERSA_APAGADA" >= 0),
  constraint "CK_LIMPEZACHAT_DSMOTIVO" check ("DS_MOTIVO" is null or length(btrim("DS_MOTIVO")) between 3 and 500),
  constraint "CK_LIMPEZACHAT_ORIGEM" check (
    ("TP_ORIGEM" = 'ADMIN' and "CO_USUARIO_RESPONSAVEL" is not null and "DS_MOTIVO" is not null)
    or ("TP_ORIGEM" = 'AGENDA' and "TP_LIMPEZA" = 'PRAZO' and "CO_USUARIO_RESPONSAVEL" is null))
);
create index "IN_LIMPEZACHAT_DTCRIACAO" on public."TH_LIMPEZA_CHAT" ("DT_CRIACAO" desc);
comment on table public."TH_LIMPEZA_CHAT" is
  'Histórico das limpezas das mensagens do chat: prazo de retenção (salvo pelo administrador ou aplicado pela tarefa diária) e "Zerar mensagens". Só contagens, corte, motivo e responsável — nunca o conteúdo das mensagens. Escrita só pelas RPCs e pela tarefa.';
comment on column public."TH_LIMPEZA_CHAT"."CO_LIMPEZA_CHAT" is 'Identificador da limpeza.';
comment on column public."TH_LIMPEZA_CHAT"."TP_LIMPEZA" is 'PRAZO (retenção: salvar o prazo ou a tarefa diária) ou ZERAR (todas as mensagens).';
comment on column public."TH_LIMPEZA_CHAT"."TP_ORIGEM" is 'ADMIN (o administrador global, com motivo) ou AGENDA (tarefa agsus_chat_retencao_diaria).';
comment on column public."TH_LIMPEZA_CHAT"."QT_DIAS_RETENCAO" is 'Prazo em vigor depois desta ação (nulo: guardar para sempre).';
comment on column public."TH_LIMPEZA_CHAT"."DT_CORTE" is 'Mensagens enviadas antes deste instante foram apagadas (PRAZO com dias). Nulo no ZERAR e no "guardar para sempre".';
comment on column public."TH_LIMPEZA_CHAT"."QT_MENSAGEM_APAGADA" is 'Quantas mensagens foram apagadas.';
comment on column public."TH_LIMPEZA_CHAT"."QT_REACAO_APAGADA" is 'Quantas linhas de reação foram apagadas (as das mensagens apagadas).';
comment on column public."TH_LIMPEZA_CHAT"."QT_CONVERSA_APAGADA" is 'Quantas conversas sem mensagem e sem participante ativo foram apagadas (só no ZERAR com conversas).';
comment on column public."TH_LIMPEZA_CHAT"."DS_MOTIVO" is 'Motivo informado pelo administrador (3 a 500 caracteres); nulo na tarefa diária.';
comment on column public."TH_LIMPEZA_CHAT"."CO_USUARIO_RESPONSAVEL" is 'Quem pediu (auth.users.id); nulo na tarefa diária.';
comment on column public."TH_LIMPEZA_CHAT"."DS_EMAIL_RESPONSAVEL" is 'E-mail de quem pediu, no momento da ação.';
comment on column public."TH_LIMPEZA_CHAT"."DT_CRIACAO" is 'Quando a limpeza rodou (hora real, clock_timestamp: duas ações na mesma transação ficam em ordem).';
comment on constraint "PK_TH_LIMPEZA_CHAT" on public."TH_LIMPEZA_CHAT" is 'Identificador da limpeza.';
comment on constraint "CK_LIMPEZACHAT_TPLIMPEZA" on public."TH_LIMPEZA_CHAT" is 'Tipos de limpeza válidos.';
comment on constraint "CK_LIMPEZACHAT_TPORIGEM" on public."TH_LIMPEZA_CHAT" is 'Origens válidas.';
comment on constraint "CK_LIMPEZACHAT_QTDIASRETENCAO" on public."TH_LIMPEZA_CHAT" is 'Prazo nulo ou de 7 a 3.650 dias (o mesmo de TB_RETENCAO_CHAT).';
comment on constraint "CK_LIMPEZACHAT_CORTE" on public."TH_LIMPEZA_CHAT" is 'ZERAR não tem corte; PRAZO tem corte se e só se tem dias.';
comment on constraint "CK_LIMPEZACHAT_QUANTIDADES" on public."TH_LIMPEZA_CHAT" is 'Contagens não negativas.';
comment on constraint "CK_LIMPEZACHAT_DSMOTIVO" on public."TH_LIMPEZA_CHAT" is 'Motivo com 3 a 500 caracteres.';
comment on constraint "CK_LIMPEZACHAT_ORIGEM" on public."TH_LIMPEZA_CHAT" is 'ADMIN tem responsável e motivo; AGENDA só aplica o prazo e não tem responsável.';
comment on index public."IN_LIMPEZACHAT_DTCRIACAO" is 'Últimas limpezas primeiro (histórico da seção).';

alter table public."TH_LIMPEZA_CHAT" enable row level security;
revoke all on public."TH_LIMPEZA_CHAT" from public, anon, authenticated;

comment on table public."TB_MENSAGEM" is
  'Mensagens do chat. Editar guarda DT_EDICAO; apagar pelo autor é lógico (ST_APAGADA = S: texto, link e menções saem, a linha fica como "mensagem apagada"). A retenção (TB_RETENCAO_CHAT) e o "Zerar mensagens" das Configurações apagam de fato, com auditoria em TH_LIMPEZA_CHAT.';

-- 3. Peças internas -----------------------------------------------------------------------
create function private."FC_CHAT_EXIGIR_ADMIN"()
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
comment on function private."FC_CHAT_EXIGIR_ADMIN"() is
  'Barra quem não está logado (28000) ou não é administrador global (private.is_master(); 42501); devolve auth.uid().';

create function private."FC_CHAT_EMAIL"(p_usuario uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (select u.email from public."TB_PERFIL_USUARIO" u
      where u.user_id = p_usuario
      order by u.ativo desc nulls last
      limit 1),
    (select auth.jwt()) ->> 'email');
$function$;
comment on function private."FC_CHAT_EMAIL"(uuid) is
  'E-mail da pessoa (perfil ativo primeiro; senão, o do token) para a auditoria das limpezas.';

create function private."FC_CHAT_VALIDAR_MOTIVO"(p_motivo text)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if length(v_motivo) not between 3 and 500 then
    raise exception 'Informe o motivo (3 a 500 caracteres)' using errcode = '22023';
  end if;
  return v_motivo;
end;
$function$;
comment on function private."FC_CHAT_VALIDAR_MOTIVO"(text) is
  'Motivo da limpeza: 3 a 500 caracteres, sem os espaços das pontas (22023). Espelho de validarMotivo (src/lib/retencao-do-chat.js).';

create function private."FC_CHAT_APAGAR_MENSAGENS"(p_antes timestamptz)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_corte timestamptz := coalesce(p_antes, 'infinity'::timestamptz);
  v_reacoes integer;
  v_mensagens integer;
begin
  -- Uma limpeza por vez (a tarefa diária e o administrador).
  perform pg_advisory_xact_lock(hashtext('agsus_chat_limpeza'));
  -- Trava as mensagens antes: reação nova numa delas espera e falha depois.
  perform 1 from public."TB_MENSAGEM" m where m."DT_CRIACAO" < v_corte for update;
  delete from public."RL_MENSAGEM_REACAO" r
   using public."TB_MENSAGEM" m
   where m."CO_MENSAGEM" = r."CO_MENSAGEM" and m."DT_CRIACAO" < v_corte;
  get diagnostics v_reacoes = row_count;
  delete from public."TB_MENSAGEM" m where m."DT_CRIACAO" < v_corte;
  get diagnostics v_mensagens = row_count;
  return jsonb_build_object('mensagens', v_mensagens, 'reacoes', v_reacoes);
end;
$function$;
comment on function private."FC_CHAT_APAGAR_MENSAGENS"(timestamptz) is
  'Exclusão real das mensagens enviadas antes de p_antes (nulo: todas) e das reações delas. Devolve {mensagens, reacoes}. Sem checagem de quem pede: só as RPCs de retenção e a tarefa diária chamam.';

create function private."FC_CHAT_RETENCAO_DIARIA"()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
  if (v_apagou->>'mensagens')::int > 0 or (v_apagou->>'reacoes')::int > 0 then
    insert into public."TH_LIMPEZA_CHAT"
      ("TP_LIMPEZA", "TP_ORIGEM", "QT_DIAS_RETENCAO", "DT_CORTE", "QT_MENSAGEM_APAGADA", "QT_REACAO_APAGADA")
    values ('PRAZO', 'AGENDA', v_dias, v_corte, (v_apagou->>'mensagens')::int, (v_apagou->>'reacoes')::int);
  end if;
  return v_apagou;
end;
$function$;
comment on function private."FC_CHAT_RETENCAO_DIARIA"() is
  'Tarefa diária (agsus_chat_retencao_diaria): aplica o prazo de TB_RETENCAO_CHAT e registra em TH_LIMPEZA_CHAT quando apagou algo. Prazo nulo: não faz nada.';

revoke all on function private."FC_CHAT_EXIGIR_ADMIN"(), private."FC_CHAT_EMAIL"(uuid),
  private."FC_CHAT_VALIDAR_MOTIVO"(text), private."FC_CHAT_APAGAR_MENSAGENS"(timestamptz),
  private."FC_CHAT_RETENCAO_DIARIA"()
  from public, anon, authenticated;

-- 4. RPCs ---------------------------------------------------------------------------------
create function public.obter_retencao_chat()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
comment on function public.obter_retencao_chat() is
  'Configurações › Mensagens (chat), só administrador global (42501): prazo de retenção (nulo = para sempre), quem mudou, contagens (mensagens, reações, conversas, conversas sem participante ativo), a mensagem mais antiga, idades [{dias, mensagens}] das que têm mais de 7 dias (a tela calcula quantas um prazo apagaria) e as últimas 50 limpezas.';
revoke all on function public.obter_retencao_chat() from public, anon;
grant execute on function public.obter_retencao_chat() to authenticated, service_role;

create function public.salvar_retencao_chat(p_dias integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN"();
  v_motivo text;
  v_email text;
  v_corte timestamptz;
  v_apagou jsonb := jsonb_build_object('mensagens', 0, 'reacoes', 0);
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
     "DS_MOTIVO", "CO_USUARIO_RESPONSAVEL", "DS_EMAIL_RESPONSAVEL")
  values ('PRAZO', 'ADMIN', p_dias, v_corte, (v_apagou->>'mensagens')::int, (v_apagou->>'reacoes')::int,
          v_motivo, v_uid, v_email);

  return public.obter_retencao_chat();
end;
$function$;
comment on function public.salvar_retencao_chat(integer, text) is
  'Define o prazo de retenção das mensagens do chat (nulo = guardar para sempre; senão 7 a 3.650 dias) com motivo (3 a 500). Com prazo, apaga de fato na hora as mensagens mais antigas e as reações delas. Registra em TH_LIMPEZA_CHAT. Só administrador global (42501); fora das faixas, 22023. Devolve obter_retencao_chat().';
revoke all on function public.salvar_retencao_chat(integer, text) from public, anon;
grant execute on function public.salvar_retencao_chat(integer, text) to authenticated, service_role;

create function public.zerar_mensagens_chat(p_confirmacao text, p_motivo text, p_incluir_conversas boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
    ("TP_LIMPEZA", "TP_ORIGEM", "QT_DIAS_RETENCAO", "QT_MENSAGEM_APAGADA", "QT_REACAO_APAGADA", "QT_CONVERSA_APAGADA",
     "DS_MOTIVO", "CO_USUARIO_RESPONSAVEL", "DS_EMAIL_RESPONSAVEL")
  values ('ZERAR', 'ADMIN', v_dias, (v_apagou->>'mensagens')::int, (v_apagou->>'reacoes')::int, cardinality(v_conversas),
          v_motivo, v_uid, v_email);

  return public.obter_retencao_chat();
end;
$function$;
comment on function public.zerar_mensagens_chat(text, text, boolean) is
  'Apaga de fato TODAS as mensagens e reações do chat; com p_incluir_conversas, também as conversas sem mensagem e sem participante ativo. p_confirmacao precisa ser exatamente ZERAR e o motivo ter 3 a 500 caracteres (22023). Registra em TH_LIMPEZA_CHAT. Só administrador global (42501). Não há como desfazer. Devolve obter_retencao_chat().';
revoke all on function public.zerar_mensagens_chat(text, text, boolean) from public, anon;
grant execute on function public.zerar_mensagens_chat(text, text, boolean) to authenticated, service_role;

-- 5. Tarefa diária (pg_cron) --------------------------------------------------------------
do $$
declare
  v_comando constant text := 'select private."FC_CHAT_RETENCAO_DIARIA"();';
  v_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível: o prazo vale ao salvar, mas sem a limpeza diária.';
    return;
  end if;
  select jobid into v_id from cron.job where jobname = 'agsus_chat_retencao_diaria';
  if v_id is null then
    perform cron.schedule('agsus_chat_retencao_diaria', '15 6 * * *', v_comando);
  else
    perform cron.alter_job(v_id, schedule => '15 6 * * *', command => v_comando);
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
