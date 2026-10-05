/*
  ENSAIO de 20261005100000_chat_limpar_e_reacoes.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e percorre as reações e o "Limpar conversa"
  com três pessoas sintéticas de um grupo de acesso do ensaio com o recurso
  chat — A e B numa conversa direta, C de fora —: reação põe e tira, emoji
  fora da lista e mensagem apagada recusados, quem está fora não reage nem vê
  as reações, escrita direta barrada; limpar esconde o histórico só para quem
  limpou (mensagens, não lidas, prévia) e o que chega depois aparece.
  Termina em ROLLBACK: nada fica gravado.

  Pré-requisito: 20261002210000_chat.sql aplicada.

  Resultado esperado: as mensagens "ok E1" … "ok E5" e a linha "ENSAIO OK"
  do SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a
  mensagem.

  Mantenha em sincronia: tests/chat-limpar-e-reacoes-migration.test.js confere
  que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_MENSAGEM"') is null
     or to_regprocedure('private."FC_CHAT_PODE_LER"(uuid)') is null then
    raise exception 'Aplique antes 20261002210000_chat.sql (sem as tabelas do chat).';
  end if;
end;
$$;

-- 1. Limpar conversa (para mim) -----------------------------------------------------------
alter table public."RL_CONVERSA_PARTICIPANTE" add column "DT_LIMPEZA" timestamptz;
comment on column public."RL_CONVERSA_PARTICIPANTE"."DT_LIMPEZA" is
  'Até quando a pessoa limpou a conversa (Limpar conversa): mensagens enviadas até aqui não aparecem para ela nem contam como não lidas. Nula: nunca limpou. Não apaga nada para as outras pessoas.';

-- 2. Reações ------------------------------------------------------------------------------
create function private."FC_CHAT_REACOES"()
returns text[]
language sql
immutable
set search_path to ''
as $function$
  select array['👍', '✅', '❤️', '😂', '👀', '🙏']::text[];
$function$;
comment on function private."FC_CHAT_REACOES"() is
  'As reações rápidas aceitas, na ordem da tela. Espelho de REACOES_RAPIDAS (src/lib/chat.js) e do CHECK CK_MENSREACAO_DSEMOJI.';
revoke all on function private."FC_CHAT_REACOES"() from public, anon, authenticated;

create table public."RL_MENSAGEM_REACAO" (
  "CO_MENSAGEM" uuid not null,
  "CO_USUARIO" uuid not null,
  "DS_EMOJI" varchar(16) not null,
  "CO_CONVERSA" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "ST_REGISTRO_ATIVO" varchar(1) not null default 'S',
  constraint "PK_RL_MENSAGEM_REACAO" primary key ("CO_MENSAGEM", "CO_USUARIO", "DS_EMOJI"),
  constraint "FK_MENSAGEM_MENSREACAO" foreign key ("CO_MENSAGEM") references public."TB_MENSAGEM" ("CO_MENSAGEM"),
  constraint "FK_CONVERSA_MENSREACAO" foreign key ("CO_CONVERSA") references public."TB_CONVERSA" ("CO_CONVERSA"),
  constraint "CK_MENSREACAO_DSEMOJI" check ("DS_EMOJI" in ('👍', '✅', '❤️', '😂', '👀', '🙏')),
  constraint "CK_MENSREACAO_STREGISTROATIVO" check ("ST_REGISTRO_ATIVO" in ('S', 'N'))
);
create index "IN_MENSREACAO_CONVERSA" on public."RL_MENSAGEM_REACAO" ("CO_CONVERSA", "CO_MENSAGEM");
comment on table public."RL_MENSAGEM_REACAO" is
  'Reações rápidas às mensagens do chat: uma linha por mensagem, pessoa e emoji. Tirar a reação desliga a linha (ST_REGISTRO_ATIVO = N), para o Realtime entregar UPDATE com a RLS. Escrita só por alternar_reacao_chat.';
comment on column public."RL_MENSAGEM_REACAO"."CO_MENSAGEM" is 'Mensagem (TB_MENSAGEM).';
comment on column public."RL_MENSAGEM_REACAO"."CO_USUARIO" is 'Quem reagiu (auth.users.id).';
comment on column public."RL_MENSAGEM_REACAO"."DS_EMOJI" is 'A reação: um dos emojis de FC_CHAT_REACOES.';
comment on column public."RL_MENSAGEM_REACAO"."CO_CONVERSA" is 'Conversa da mensagem (cópia de TB_MENSAGEM.CO_CONVERSA), para a RLS e o Realtime.';
comment on column public."RL_MENSAGEM_REACAO"."DT_CRIACAO" is 'Primeira vez que a pessoa usou esta reação na mensagem.';
comment on column public."RL_MENSAGEM_REACAO"."DT_ATUALIZACAO" is 'Última vez que pôs ou tirou a reação.';
comment on column public."RL_MENSAGEM_REACAO"."ST_REGISTRO_ATIVO" is 'S: a reação está posta. N: foi tirada.';
comment on constraint "PK_RL_MENSAGEM_REACAO" on public."RL_MENSAGEM_REACAO" is 'Uma linha por mensagem, pessoa e emoji.';
comment on constraint "FK_MENSAGEM_MENSREACAO" on public."RL_MENSAGEM_REACAO" is 'Mensagem da reação.';
comment on constraint "FK_CONVERSA_MENSREACAO" on public."RL_MENSAGEM_REACAO" is 'Conversa da reação (a mesma da mensagem).';
comment on constraint "CK_MENSREACAO_DSEMOJI" on public."RL_MENSAGEM_REACAO" is 'Só as reações rápidas (FC_CHAT_REACOES).';
comment on constraint "CK_MENSREACAO_STREGISTROATIVO" on public."RL_MENSAGEM_REACAO" is 'Flag S/N.';
comment on index public."IN_MENSREACAO_CONVERSA" is 'Reações de uma conversa, por mensagem.';

alter table public."RL_MENSAGEM_REACAO" enable row level security;
revoke all on public."RL_MENSAGEM_REACAO" from public, anon, authenticated;
grant select on public."RL_MENSAGEM_REACAO" to authenticated;
create policy "PL_MENSREACAO_LEITURA" on public."RL_MENSAGEM_REACAO"
  for select to authenticated using (private."FC_CHAT_PODE_LER"("CO_CONVERSA"));
comment on policy "PL_MENSREACAO_LEITURA" on public."RL_MENSAGEM_REACAO" is 'Reações só de conversa que a pessoa lê (a mesma regra da mensagem).';

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'RL_MENSAGEM_REACAO'
    ) then
      alter publication supabase_realtime add table public."RL_MENSAGEM_REACAO";
    end if;
  else
    raise notice 'Publicação supabase_realtime não existe: as reações funcionam, mas sem tempo real.';
  end if;
end;
$$;

-- 3. Leitura em JSON (mesma assinatura) ------------------------------------------------------
create or replace function private."FC_CHAT_MENSAGEM_JSON"(p_mensagem uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
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
comment on function private."FC_CHAT_MENSAGEM_JSON"(uuid) is
  'Uma mensagem no formato da tela (o mesmo que o Realtime entrega, com nomes de campo da tela), com as reações postas: [{emoji, usuarios}] na ordem de FC_CHAT_REACOES (vazia na mensagem apagada).';

create or replace function private."FC_CHAT_CONVERSA_JSON"(p_conversa uuid, p_usuario uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
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
      select jsonb_agg(private."FC_CHAT_PESSOA"(p."CO_USUARIO") || jsonb_build_object('papel', p."TP_PAPEL")
                       order by p."DT_ENTRADA", p."CO_USUARIO")
        from public."RL_CONVERSA_PARTICIPANTE" p
       where p."CO_CONVERSA" = c."CO_CONVERSA" and p."DT_SAIDA" is null), '[]'::jsonb),
    'participa', eu."CO_USUARIO" is not null and eu."DT_SAIDA" is null,
    'lida_em', eu."DT_ULTIMA_LEITURA",
    'limpa_em', eu."DT_LIMPEZA",
    'silenciada', coalesce(eu."ST_SILENCIADA" = 'S', false),
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
comment on function private."FC_CHAT_CONVERSA_JSON"(uuid, uuid) is
  'Uma conversa como a pessoa a vê: tipo, nome, edital, participantes (com online), não lidas, menções não lidas, silenciada, limpa_em e a última mensagem — contando só o que veio depois da limpeza dela.';

-- 4. Listar mensagens sem o que a pessoa limpou (mesma assinatura) ---------------------------
create or replace function public.listar_mensagens_chat(p_conversa uuid, p_antes timestamptz default null, p_limite integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
comment on function public.listar_mensagens_chat(uuid, timestamptz, integer) is
  'Uma página de mensagens da conversa (as mais novas antes de p_antes, até p_limite, no máximo 100), em ordem de envio, com a conversa, as reações e tem_mais. Não traz o que a pessoa limpou (DT_LIMPEZA). Exige poder ler a conversa.';

-- 5. RPCs novas ------------------------------------------------------------------------------
create function public.limpar_conversa_chat(p_conversa uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.limpar_conversa_chat(uuid) is
  'Limpa a conversa só para quem está logado: as mensagens enviadas até agora deixam de aparecer para ela (e de contar como não lidas). Nada é apagado; as outras pessoas continuam vendo. Exige poder ler a conversa.';
revoke all on function public.limpar_conversa_chat(uuid) from public, anon;
grant execute on function public.limpar_conversa_chat(uuid) to authenticated, service_role;

create function public.alternar_reacao_chat(p_mensagem uuid, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.alternar_reacao_chat(uuid, text) is
  'Põe ou tira a reação (um dos emojis de FC_CHAT_REACOES; fora disso, 22023) de quem está logado numa mensagem. Só quem lê a conversa (42501); mensagem apagada não recebe reação (22023). Devolve a mensagem com as reações.';
revoke all on function public.alternar_reacao_chat(uuid, text) from public, anon;
grant execute on function public.alternar_reacao_chat(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Estrutura: coluna, tabela com RLS, policy e Realtime.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'RL_CONVERSA_PARTICIPANTE' and column_name = 'DT_LIMPEZA'
  ) then
    raise exception 'FALHOU E1: sem a coluna DT_LIMPEZA';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public."RL_MENSAGEM_REACAO"'::regclass) then
    raise exception 'FALHOU E1: RL_MENSAGEM_REACAO sem RLS';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'RL_MENSAGEM_REACAO' and policyname = 'PL_MENSREACAO_LEITURA') then
    raise exception 'FALHOU E1: sem a policy de leitura das reações';
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'RL_MENSAGEM_REACAO') then
    raise exception 'FALHOU E1: reações fora do Realtime';
  end if;
  raise notice 'ok E1: DT_LIMPEZA, RL_MENSAGEM_REACAO com RLS, policy e Realtime';
end;
$$;

-- E2. Atores sintéticos (somem no rollback): A, B e C num grupo do ensaio com o
-- recurso chat (não depende de qual grupo real está com Usar).
do $$
begin
  insert into public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "DS_GRUPO_ACESSO", "ST_SISTEMA", "ST_ADMIN_GLOBAL", "NU_ORDEM")
  values ('ensaio_com_chat', 'Ensaio com chat', 'Grupo do ensaio, só com o chat.', false, false, 999);
  insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
  values ('ensaio_com_chat', 'chat', 'leitor')
  on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do update set "TP_NIVEL" = 'leitor';

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000d201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.chat11.a@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000d202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.chat11.b@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000d203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.chat11.c@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000d201', 'ensaio.chat11.a@ensaio.invalid', 'Ensaio Ana', 'ensaio_com_chat', true),
    ('00000000-0000-4000-a000-00000000d202', 'ensaio.chat11.b@ensaio.invalid', 'Ensaio Bruno', 'ensaio_com_chat', true),
    ('00000000-0000-4000-a000-00000000d203', 'ensaio.chat11.c@ensaio.invalid', 'Ensaio Carla', 'ensaio_com_chat', true);
  raise notice 'ok E2: atores A, B e C (grupo ensaio_com_chat, chat = leitor)';
end;
$$;

-- E3 a E5. O fluxo pelas RPCs, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000d201","role":"authenticated","email":"ensaio.chat11.a@ensaio.invalid"}';
  c_b constant text := '{"sub":"00000000-0000-4000-a000-00000000d202","role":"authenticated","email":"ensaio.chat11.b@ensaio.invalid"}';
  c_c constant text := '{"sub":"00000000-0000-4000-a000-00000000d203","role":"authenticated","email":"ensaio.chat11.c@ensaio.invalid"}';
  u_a constant uuid := '00000000-0000-4000-a000-00000000d201';
  u_b constant uuid := '00000000-0000-4000-a000-00000000d202';
  v jsonb;
  v_conv jsonb;
  v_direta uuid;
  v_m1 uuid;
  v_m2 uuid;
  v_m3 uuid;
  v_n integer;
begin
  -- E3. Reações: põe, junta, tira; recusas.
  perform set_config('request.jwt.claims', c_a, true);
  v_direta := (public.abrir_conversa_direta_chat(u_b)->>'id')::uuid;
  v_m1 := (public.enviar_mensagem_chat(v_direta, 'Bom dia')->>'id')::uuid;
  perform set_config('request.jwt.claims', c_b, true);
  v_m2 := (public.enviar_mensagem_chat(v_direta, 'Bom dia, Ana')->>'id')::uuid;

  v := public.alternar_reacao_chat(v_m1, '👍');
  if v->'reacoes' <> jsonb_build_array(jsonb_build_object('emoji', '👍', 'usuarios', jsonb_build_array(u_b))) then
    raise exception 'FALHOU E3: reação de B não ficou: %', v->'reacoes';
  end if;
  perform set_config('request.jwt.claims', c_a, true);
  perform public.alternar_reacao_chat(v_m1, '❤️');
  v := public.alternar_reacao_chat(v_m1, '👍');
  if jsonb_array_length(v->'reacoes') <> 2
     or v->'reacoes'->0->>'emoji' <> '👍'
     or jsonb_array_length(v->'reacoes'->0->'usuarios') <> 2
     or v->'reacoes'->1->>'emoji' <> '❤️' then
    raise exception 'FALHOU E3: reações juntas fora da ordem ou da contagem: %', v->'reacoes';
  end if;
  perform set_config('request.jwt.claims', c_b, true);
  v := public.alternar_reacao_chat(v_m1, '👍');
  if v->'reacoes'->0->'usuarios' <> jsonb_build_array(u_a) then
    raise exception 'FALHOU E3: alternar não tirou a reação de B: %', v->'reacoes';
  end if;
  v := (public.listar_mensagens_chat(v_direta)->'mensagens')->0;
  if (v->>'id')::uuid <> v_m1 or jsonb_array_length(v->'reacoes') <> 2 then
    raise exception 'FALHOU E3: listar_mensagens_chat sem as reações: %', v;
  end if;

  v_n := 0;
  begin perform public.alternar_reacao_chat(v_m1, '🍕'); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.alternar_reacao_chat(v_m1, ''); exception when sqlstate '22023' then v_n := v_n + 1; end;
  perform public.apagar_mensagem_chat(v_m2);
  begin perform public.alternar_reacao_chat(v_m2, '👍'); exception when sqlstate '22023' then v_n := v_n + 1; end;
  if v_n <> 3 then raise exception 'FALHOU E3: só % de 3 recusas (emoji fora da lista, vazio, mensagem apagada)', v_n; end if;
  raise notice 'ok E3: reação põe, junta (na ordem da lista) e tira; listar traz as reações; emoji fora da lista e mensagem apagada recusados (22023)';

  -- E4. Só participante reage e vê as reações; nada de escrita direta.
  perform set_config('request.jwt.claims', c_c, true);
  begin
    perform public.alternar_reacao_chat(v_m1, '👍');
    raise exception 'FALHOU E4: C reagiu na direta de A e B';
  exception when sqlstate '42501' then null;
  end;
  if (select count(*) from public."RL_MENSAGEM_REACAO" where "CO_CONVERSA" = v_direta) <> 0 then
    raise exception 'FALHOU E4: C vê as reações da direta pela RLS';
  end if;
  begin
    perform public.limpar_conversa_chat(v_direta);
    raise exception 'FALHOU E4: C limpou a direta de A e B';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claims', c_a, true);
  if (select count(*) from public."RL_MENSAGEM_REACAO" where "CO_CONVERSA" = v_direta and "ST_REGISTRO_ATIVO" = 'S') <> 2 then
    raise exception 'FALHOU E4: A não vê as reações da própria conversa';
  end if;
  v_n := 0;
  begin
    insert into public."RL_MENSAGEM_REACAO" ("CO_MENSAGEM", "CO_USUARIO", "DS_EMOJI", "CO_CONVERSA") values (v_m1, u_a, '🙏', v_direta);
  exception when insufficient_privilege then v_n := v_n + 1;
  end;
  begin
    update public."RL_MENSAGEM_REACAO" set "ST_REGISTRO_ATIVO" = 'S' where "CO_CONVERSA" = v_direta;
  exception when insufficient_privilege then v_n := v_n + 1;
  end;
  begin
    update public."RL_CONVERSA_PARTICIPANTE" set "DT_LIMPEZA" = null where "CO_CONVERSA" = v_direta;
  exception when insufficient_privilege then v_n := v_n + 1;
  end;
  if v_n <> 3 then raise exception 'FALHOU E4: só % de 3 escritas diretas barradas', v_n; end if;
  raise notice 'ok E4: C (fora) não reage, não limpa (42501) e não vê as reações; escrita direta barrada';

  -- E5. Limpar esconde só para quem limpou; o que chega depois aparece.
  perform set_config('request.jwt.claims', c_b, true);
  v_conv := public.limpar_conversa_chat(v_direta);
  if v_conv->>'limpa_em' is null or (v_conv->>'nao_lidas')::int <> 0 or v_conv->'ultima' <> 'null'::jsonb then
    raise exception 'FALHOU E5: conversa de B depois de limpar: %', v_conv;
  end if;
  if jsonb_array_length(public.listar_mensagens_chat(v_direta)->'mensagens') <> 0 then
    raise exception 'FALHOU E5: B ainda vê mensagens depois de limpar';
  end if;
  perform set_config('request.jwt.claims', c_a, true);
  if jsonb_array_length(public.listar_mensagens_chat(v_direta)->'mensagens') <> 2 then
    raise exception 'FALHOU E5: limpar de B escondeu mensagens de A';
  end if;
  if (select count(*) from public."TB_MENSAGEM" where "CO_CONVERSA" = v_direta) <> 2 then
    raise exception 'FALHOU E5: limpar apagou mensagens';
  end if;
  perform pg_sleep(0.01);
  v_m3 := (public.enviar_mensagem_chat(v_direta, 'Depois da limpeza')->>'id')::uuid;
  perform set_config('request.jwt.claims', c_b, true);
  v := public.listar_mensagens_chat(v_direta);
  if jsonb_array_length(v->'mensagens') <> 1 or (v->'mensagens'->0->>'id')::uuid <> v_m3 then
    raise exception 'FALHOU E5: B não vê só a mensagem nova: %', v->'mensagens';
  end if;
  select x into v_conv from jsonb_array_elements(public.listar_conversas_chat()->'conversas') x where (x->>'id')::uuid = v_direta;
  if (v_conv->>'nao_lidas')::int <> 1 or (v_conv->'ultima'->>'id')::uuid <> v_m3 then
    raise exception 'FALHOU E5: lista de B depois da mensagem nova: %', v_conv;
  end if;
  raise notice 'ok E5: limpar esconde o histórico só para B (A vê tudo, nada apagado); a mensagem nova aparece e conta como não lida';

  perform set_config('ensaio.direta', v_direta::text, true);
end;
$$;
-- Volta ao papel do SQL Editor antes de ler as tabelas sem filtro da RLS.
reset role;
select set_config('request.jwt.claims', '', true);

-- Resumo (o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_MENSAGEM" where "CO_CONVERSA"::text = current_setting('ensaio.direta')) as mensagens,
  (select count(*) from public."RL_MENSAGEM_REACAO" where "CO_CONVERSA"::text = current_setting('ensaio.direta')) as linhas_de_reacao,
  (select count(*) from public."RL_MENSAGEM_REACAO" where "CO_CONVERSA"::text = current_setting('ensaio.direta') and "ST_REGISTRO_ATIVO" = 'S') as reacoes_postas,
  (select count(*) from public."RL_CONVERSA_PARTICIPANTE" where "CO_CONVERSA"::text = current_setting('ensaio.direta') and "DT_LIMPEZA" is not null) as quem_limpou,
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'RL_MENSAGEM_REACAO') as reacoes_no_realtime;

rollback;
