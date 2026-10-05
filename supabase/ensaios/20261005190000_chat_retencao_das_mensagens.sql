/*
  ENSAIO de 20261005190000_chat_retencao_das_mensagens.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e percorre a retenção com pessoas
  sintéticas — Ana e Bruno (grupo do ensaio só com o chat) e Diana
  (administradora global do ensaio) —: mensagens sintéticas numa conversa
  direta (algumas envelhecidas à mão), reações nelas e um grupo que todos
  deixaram. Confere: quem não é administrador recebe 42501; prazo fora da
  faixa, motivo curto e ZERAR errado são recusados (22023); o prazo apaga só
  as antigas e as reações delas; a tarefa diária aplica o prazo e registra;
  zerar apaga tudo e, com conversas, só as sem participante ativo; o
  histórico registra cada ação sem o conteúdo das mensagens; a tarefa
  agsus_chat_retencao_diaria existe (com pg_cron).
  Termina em ROLLBACK: nada fica gravado — nem as mensagens reais que o
  prazo e o zerar apagam durante o ensaio.

  Pré-requisito: 20261005100000_chat_limpar_e_reacoes.sql aplicada.

  Resultado esperado: as mensagens "ok E1" … "ok E8" e a linha "ENSAIO OK"
  do SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a
  mensagem.

  Mantenha em sincronia: tests/chat-retencao-migration.test.js confere que o
  corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

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

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Estrutura: tabelas com RLS e sem grant, linha única, sem o texto das mensagens, tarefa.
do $$
declare
  v_n integer;
begin
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public."TB_RETENCAO_CHAT"'::regclass)
     or not (select c.relrowsecurity from pg_class c where c.oid = 'public."TH_LIMPEZA_CHAT"'::regclass) then
    raise exception 'FALHOU E1: tabela nova sem RLS';
  end if;
  if has_table_privilege('authenticated', 'public."TB_RETENCAO_CHAT"', 'select')
     or has_table_privilege('authenticated', 'public."TH_LIMPEZA_CHAT"', 'select')
     or has_table_privilege('anon', 'public."TH_LIMPEZA_CHAT"', 'select') then
    raise exception 'FALHOU E1: grant direto numa tabela nova';
  end if;
  if (select count(*) from public."TB_RETENCAO_CHAT") <> 1
     or (select "QT_DIAS_RETENCAO" from public."TB_RETENCAO_CHAT") is not null then
    raise exception 'FALHOU E1: a linha única não nasceu com "guardar para sempre"';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'TH_LIMPEZA_CHAT'
       and column_name in ('DS_TEXTO', 'DS_LINK_TELA', 'CO_MENSAGEM', 'CO_CONVERSA')
  ) then
    raise exception 'FALHOU E1: TH_LIMPEZA_CHAT guarda conteúdo ou chave das mensagens';
  end if;
  if to_regclass('cron.job') is not null then
    select count(*) into v_n from cron.job
     where jobname = 'agsus_chat_retencao_diaria'
       and command = 'select private."FC_CHAT_RETENCAO_DIARIA"();'
       and active;
    if v_n <> 1 then
      raise exception 'FALHOU E1: sem a tarefa agsus_chat_retencao_diaria no pg_cron';
    end if;
    raise notice 'ok E1: tabelas com RLS e sem grant, linha única para sempre, histórico sem conteúdo, tarefa diária agendada';
  else
    raise notice 'ok E1: tabelas com RLS e sem grant, linha única para sempre, histórico sem conteúdo (pg_cron indisponível: tarefa não conferida)';
  end if;
end;
$$;

-- E2. Atores sintéticos (somem no rollback): Ana e Bruno com o chat; Diana, administradora global.
do $$
begin
  insert into public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "DS_GRUPO_ACESSO", "ST_SISTEMA", "ST_ADMIN_GLOBAL", "NU_ORDEM")
  values ('ensaio_ret_chat', 'Ensaio retenção (chat)', 'Grupo do ensaio, só com o chat.', false, false, 998),
         ('ensaio_ret_admin', 'Ensaio retenção (admin)', 'Grupo do ensaio, administrador global.', false, true, 999);
  insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
  values ('ensaio_ret_chat', 'chat', 'leitor')
  on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do update set "TP_NIVEL" = 'leitor';

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000d301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.retencao.a@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000d302', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.retencao.b@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000d303', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.retencao.d@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000d301', 'ensaio.retencao.a@ensaio.invalid', 'Ensaio Ana', 'ensaio_ret_chat', true),
    ('00000000-0000-4000-a000-00000000d302', 'ensaio.retencao.b@ensaio.invalid', 'Ensaio Bruno', 'ensaio_ret_chat', true),
    ('00000000-0000-4000-a000-00000000d303', 'ensaio.retencao.d@ensaio.invalid', 'Ensaio Diana', 'ensaio_ret_admin', true);
  raise notice 'ok E2: Ana e Bruno (chat = leitor) e Diana (administradora global)';
end;
$$;

-- E3. Mensagens sintéticas, reações e um grupo que todos deixaram; quem não é admin é barrado.
set local role authenticated;
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000d301","role":"authenticated","email":"ensaio.retencao.a@ensaio.invalid"}';
  c_b constant text := '{"sub":"00000000-0000-4000-a000-00000000d302","role":"authenticated","email":"ensaio.retencao.b@ensaio.invalid"}';
  u_b constant uuid := '00000000-0000-4000-a000-00000000d302';
  v_direta uuid;
  v_grupo uuid;
  v_m1 uuid;
  v_m2 uuid;
  v_m3 uuid;
  v_n integer := 0;
begin
  perform set_config('request.jwt.claims', c_a, true);
  v_direta := (public.abrir_conversa_direta_chat(u_b)->>'id')::uuid;
  v_m1 := (public.enviar_mensagem_chat(v_direta, 'Sintética antiga 1')->>'id')::uuid;
  v_m2 := (public.enviar_mensagem_chat(v_direta, 'Sintética antiga 2')->>'id')::uuid;
  v_m3 := (public.enviar_mensagem_chat(v_direta, 'Sintética nova')->>'id')::uuid;
  v_grupo := (public.criar_grupo_chat('Grupo do ensaio', array[u_b])->>'id')::uuid;

  perform set_config('request.jwt.claims', c_b, true);
  perform public.alternar_reacao_chat(v_m1, '👍');
  perform public.alternar_reacao_chat(v_m3, '❤️');
  perform public.sair_conversa_chat(v_grupo);
  perform set_config('request.jwt.claims', c_a, true);
  perform public.sair_conversa_chat(v_grupo);

  -- Ana não é administradora global.
  begin perform public.obter_retencao_chat(); exception when sqlstate '42501' then v_n := v_n + 1; end;
  begin perform public.salvar_retencao_chat(30, 'Motivo do ensaio'); exception when sqlstate '42501' then v_n := v_n + 1; end;
  begin perform public.zerar_mensagens_chat('ZERAR', 'Motivo do ensaio', true); exception when sqlstate '42501' then v_n := v_n + 1; end;
  if v_n <> 3 then
    raise exception 'FALHOU E3: só % de 3 recusas 42501 para quem não é administrador', v_n;
  end if;

  perform set_config('ensaio.direta', v_direta::text, true);
  perform set_config('ensaio.grupo', v_grupo::text, true);
  perform set_config('ensaio.m1', v_m1::text, true);
  perform set_config('ensaio.m2', v_m2::text, true);
  perform set_config('ensaio.m3', v_m3::text, true);
  raise notice 'ok E3: 3 mensagens sintéticas, 2 reações, grupo sem participante ativo; não-admin recebe 42501 nas três RPCs';
end;
$$;
-- Volta ao papel do SQL Editor antes de mexer nas tabelas sem a RLS.
reset role;

-- E4. Envelhece duas mensagens à mão (40 e 400 dias).
do $$
begin
  update public."TB_MENSAGEM" set "DT_CRIACAO" = now() - interval '40 days'
   where "CO_MENSAGEM"::text = current_setting('ensaio.m1');
  update public."TB_MENSAGEM" set "DT_CRIACAO" = now() - interval '400 days'
   where "CO_MENSAGEM"::text = current_setting('ensaio.m2');
  if (select count(*) from public."TB_MENSAGEM" where "CO_CONVERSA"::text = current_setting('ensaio.direta')) <> 3 then
    raise exception 'FALHOU E4: a direta do ensaio não tem as 3 mensagens';
  end if;
  raise notice 'ok E4: mensagens com 40 e 400 dias';
end;
$$;

-- E5. A administradora: leitura, recusas e o prazo de 30 dias.
set local role authenticated;
do $$
declare
  c_d constant text := '{"sub":"00000000-0000-4000-a000-00000000d303","role":"authenticated","email":"ensaio.retencao.d@ensaio.invalid"}';
  v jsonb;
  v_a30 integer;
  v_n integer := 0;
begin
  perform set_config('request.jwt.claims', c_d, true);
  v := public.obter_retencao_chat();
  if v->'dias' <> 'null'::jsonb or (v->>'mensagens')::int < 3 or (v->>'reacoes')::int < 2
     or (v->>'mais_antiga')::timestamptz > now() - interval '399 days'
     or (v->>'conversas_sem_participante')::int < 1 then
    raise exception 'FALHOU E5: leitura inicial: %', v - 'idades' - 'historico';
  end if;
  select coalesce(sum((i->>'mensagens')::int), 0) into v_a30
    from jsonb_array_elements(v->'idades') i where (i->>'dias')::int >= 30;
  if v_a30 < 2 then
    raise exception 'FALHOU E5: idades não contam as 2 mensagens antigas: %', v->'idades';
  end if;

  begin perform public.salvar_retencao_chat(6, 'Motivo do ensaio'); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.salvar_retencao_chat(3651, 'Motivo do ensaio'); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.salvar_retencao_chat(30, ' ab '); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.salvar_retencao_chat(30, null); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.zerar_mensagens_chat('zerar', 'Motivo do ensaio', false); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.zerar_mensagens_chat(' ZERAR', 'Motivo do ensaio', false); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.zerar_mensagens_chat(null, 'Motivo do ensaio', false); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.zerar_mensagens_chat('ZERAR', 'ok', false); exception when sqlstate '22023' then v_n := v_n + 1; end;
  if v_n <> 8 then
    raise exception 'FALHOU E5: só % de 8 recusas 22023 (prazo fora da faixa, motivo, ZERAR errado)', v_n;
  end if;

  v := public.salvar_retencao_chat(30, 'Ensaio: prazo de 30 dias');
  if (v->>'dias')::int <> 30
     or v->'historico'->0->>'tipo' <> 'PRAZO'
     or v->'historico'->0->>'origem' <> 'ADMIN'
     or (v->'historico'->0->>'dias')::int <> 30
     or (v->'historico'->0->>'mensagens')::int < 2
     or (v->'historico'->0->>'reacoes')::int < 1
     or v->'historico'->0->>'motivo' <> 'Ensaio: prazo de 30 dias'
     or v->'historico'->0->>'email' <> 'ensaio.retencao.d@ensaio.invalid'
     or v->'historico'->0->>'nome' <> 'Ensaio Diana'
     or v->>'atualizado_por' <> 'ensaio.retencao.d@ensaio.invalid' then
    raise exception 'FALHOU E5: salvar 30 dias: %', v - 'idades';
  end if;
  if exists (select 1 from jsonb_array_elements(v->'idades') i where (i->>'dias')::int >= 30) then
    raise exception 'FALHOU E5: ainda há mensagens com mais de 30 dias: %', v->'idades';
  end if;
  raise notice 'ok E5: leitura com contagens e idades; 8 recusas 22023; prazo de 30 dias salvo e registrado';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

-- E6. O prazo apagou só as antigas (com as reações delas); a tarefa diária aplica e registra.
do $$
declare
  v jsonb;
begin
  if exists (select 1 from public."TB_MENSAGEM" where "CO_MENSAGEM"::text in (current_setting('ensaio.m1'), current_setting('ensaio.m2'))) then
    raise exception 'FALHOU E6: o prazo não apagou as mensagens de 40 e 400 dias';
  end if;
  if not exists (select 1 from public."TB_MENSAGEM" where "CO_MENSAGEM"::text = current_setting('ensaio.m3')) then
    raise exception 'FALHOU E6: o prazo apagou a mensagem nova';
  end if;
  if exists (select 1 from public."RL_MENSAGEM_REACAO" where "CO_MENSAGEM"::text = current_setting('ensaio.m1')) then
    raise exception 'FALHOU E6: a reação da mensagem apagada ficou';
  end if;
  if not exists (select 1 from public."RL_MENSAGEM_REACAO" where "CO_MENSAGEM"::text = current_setting('ensaio.m3')) then
    raise exception 'FALHOU E6: a reação da mensagem nova sumiu';
  end if;
  if not exists (select 1 from public."TB_CONVERSA" where "CO_CONVERSA"::text = current_setting('ensaio.direta')) then
    raise exception 'FALHOU E6: o prazo apagou a conversa';
  end if;
  if (select "QT_DIAS_RETENCAO" from public."TB_RETENCAO_CHAT") <> 30
     or (select "CO_USUARIO_ATUALIZACAO" from public."TB_RETENCAO_CHAT") <> '00000000-0000-4000-a000-00000000d303' then
    raise exception 'FALHOU E6: TB_RETENCAO_CHAT sem o prazo de Diana';
  end if;

  update public."TB_MENSAGEM" set "DT_CRIACAO" = now() - interval '50 days'
   where "CO_MENSAGEM"::text = current_setting('ensaio.m3');
  v := private."FC_CHAT_RETENCAO_DIARIA"();
  if (v->>'mensagens')::int < 1 or (v->>'reacoes')::int < 1
     or exists (select 1 from public."TB_MENSAGEM" where "CO_MENSAGEM"::text = current_setting('ensaio.m3')) then
    raise exception 'FALHOU E6: a tarefa diária não aplicou o prazo: %', v;
  end if;
  if not exists (
    select 1 from public."TH_LIMPEZA_CHAT"
     where "TP_ORIGEM" = 'AGENDA' and "TP_LIMPEZA" = 'PRAZO' and "QT_DIAS_RETENCAO" = 30
       and "QT_MENSAGEM_APAGADA" >= 1 and "CO_USUARIO_RESPONSAVEL" is null and "DS_MOTIVO" is null
  ) then
    raise exception 'FALHOU E6: a tarefa diária não registrou a limpeza';
  end if;
  v := private."FC_CHAT_RETENCAO_DIARIA"();
  if (select count(*) from public."TH_LIMPEZA_CHAT" where "TP_ORIGEM" = 'AGENDA') <> 1 then
    raise exception 'FALHOU E6: a tarefa registrou sem ter apagado nada';
  end if;
  raise notice 'ok E6: o prazo apagou só as antigas e as reações delas; a tarefa diária aplica e registra só quando apaga';
end;
$$;

-- E7. Guardar para sempre e zerar (com conversas).
set local role authenticated;
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000d301","role":"authenticated","email":"ensaio.retencao.a@ensaio.invalid"}';
  c_b constant text := '{"sub":"00000000-0000-4000-a000-00000000d302","role":"authenticated","email":"ensaio.retencao.b@ensaio.invalid"}';
  c_d constant text := '{"sub":"00000000-0000-4000-a000-00000000d303","role":"authenticated","email":"ensaio.retencao.d@ensaio.invalid"}';
  v jsonb;
  v_m4 uuid;
begin
  perform set_config('request.jwt.claims', c_a, true);
  v_m4 := (public.enviar_mensagem_chat(current_setting('ensaio.direta')::uuid, 'Sintética depois')->>'id')::uuid;
  perform set_config('request.jwt.claims', c_b, true);
  perform public.alternar_reacao_chat(v_m4, '👀');

  perform set_config('request.jwt.claims', c_d, true);
  v := public.salvar_retencao_chat(null, 'Ensaio: guardar para sempre');
  if v->'dias' <> 'null'::jsonb
     or v->'historico'->0->'dias' <> 'null'::jsonb
     or v->'historico'->0->'corte' <> 'null'::jsonb
     or (v->'historico'->0->>'mensagens')::int <> 0
     or not exists (select 1 from public."TB_MENSAGEM" where "CO_MENSAGEM" = v_m4) then
    raise exception 'FALHOU E7: guardar para sempre: %', v - 'idades';
  end if;

  v := public.zerar_mensagens_chat('ZERAR', 'Ensaio: zerar tudo', true);
  if (v->>'mensagens')::int <> 0 or (v->>'reacoes')::int <> 0
     or (v->>'conversas_sem_participante')::int <> 0
     or v->'historico'->0->>'tipo' <> 'ZERAR'
     or (v->'historico'->0->>'mensagens')::int < 1
     or (v->'historico'->0->>'reacoes')::int < 1
     or (v->'historico'->0->>'conversas')::int < 1
     or v->'historico'->0->>'motivo' <> 'Ensaio: zerar tudo' then
    raise exception 'FALHOU E7: zerar: %', v - 'idades';
  end if;
  raise notice 'ok E7: guardar para sempre registrado sem apagar; zerar apagou mensagens, reações e conversas sem participante';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

-- E8. Depois do zerar: nada de mensagem; a direta (com participantes) fica; o grupo vazio sai; o histórico tem tudo.
do $$
begin
  if exists (select 1 from public."TB_MENSAGEM") or exists (select 1 from public."RL_MENSAGEM_REACAO") then
    raise exception 'FALHOU E8: sobrou mensagem ou reação depois do zerar';
  end if;
  if not exists (select 1 from public."TB_CONVERSA" where "CO_CONVERSA"::text = current_setting('ensaio.direta')) then
    raise exception 'FALHOU E8: o zerar apagou a conversa direta, que tem participantes';
  end if;
  if exists (select 1 from public."TB_CONVERSA" where "CO_CONVERSA"::text = current_setting('ensaio.grupo'))
     or exists (select 1 from public."RL_CONVERSA_PARTICIPANTE" where "CO_CONVERSA"::text = current_setting('ensaio.grupo')) then
    raise exception 'FALHOU E8: o grupo sem participante ativo ficou';
  end if;
  if (select count(*) from public."TH_LIMPEZA_CHAT" where "CO_USUARIO_RESPONSAVEL" = '00000000-0000-4000-a000-00000000d303') <> 3 then
    raise exception 'FALHOU E8: o histórico não tem as 3 ações de Diana (prazo, para sempre, zerar)';
  end if;
  raise notice 'ok E8: tudo apagado, a direta ficou, o grupo vazio saiu; histórico com as 3 ações e a da tarefa';
end;
$$;

-- Resumo (o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_MENSAGEM") as mensagens,
  (select count(*) from public."RL_MENSAGEM_REACAO") as reacoes,
  (select "QT_DIAS_RETENCAO" from public."TB_RETENCAO_CHAT") as prazo_em_dias,
  (select count(*) from public."TH_LIMPEZA_CHAT") as limpezas_registradas,
  (select string_agg("TP_LIMPEZA" || '/' || "TP_ORIGEM", ', ' order by "DT_CRIACAO") from public."TH_LIMPEZA_CHAT") as limpezas;

rollback;
