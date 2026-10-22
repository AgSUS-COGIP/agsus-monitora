-- Desfaz 20261007210000_chat_v2: tira as RPCs novas (obter_mensagem_chat,
-- encaminhar_mensagem_chat, buscar_mensagens_chat, fixar_conversa_chat,
-- marcar_nao_lida_chat, definir_status_chat, preparar_expurgo_anexos_chat e
-- confirmar_expurgo_anexos_chat), volta enviar_mensagem_chat à assinatura de 5
-- argumentos e os corpos de antes (listar_conversas_chat, marcar_conversa_lida_chat,
-- apagar_mensagem_chat, FC_CHAT_PESSOA, FC_CHAT_MENSAGEM_JSON, FC_CHAT_CONVERSA_JSON,
-- FC_CHAT_VALIDAR_LINK e a retenção), a política de leitura de
-- RL_CONVERSA_PARTICIPANTE, tira as políticas do bucket chat-anexos, as tabelas
-- TB_ANEXO_MENSAGEM, TB_EXPURGO_ANEXO_CHAT e TB_STATUS_PRESENCA_CHAT e as colunas
-- novas (citação, encaminhada, anexos, fixar, não lida, anexos apagados da auditoria).
-- ATENÇÃO:
--   - Para se houver anexo registrado ou arquivo na fila de expurgo: os arquivos
--     ficariam no Storage sem dono. Antes, zere as mensagens (ou aplique o prazo)
--     em Configurações › Mensagens (chat) e deixe a seção esvaziar a fila.
--   - Mensagem só com cartão (sem texto) ganha como texto o rótulo do cartão,
--     porque a regra antiga exige texto.
--   - Perde as citações, a marca de encaminhada, as fixações, as marcas de não
--     lida e os status escolhidos. O bucket chat-anexos fica (vazio; o Storage não
--     deixa apagar pelo SQL) e pode ser apagado pelo painel do Supabase.
begin;

do $$
begin
  if exists (select 1 from public."TB_ANEXO_MENSAGEM")
     or exists (select 1 from public."TB_EXPURGO_ANEXO_CHAT" e where e."DT_EXPURGO" is null) then
    raise exception 'Há anexos no chat ou arquivos na fila de expurgo: zere as mensagens e esvazie a fila (Configurações › Mensagens (chat)) antes de desfazer.';
  end if;
end;
$$;

-- A regra antiga exige texto: mensagem só com cartão leva o rótulo dele.
update public."TB_MENSAGEM"
   set "DS_TEXTO" = left(coalesce(nullif(btrim("DS_LINK_TELA"->>'rotulo'), ''), 'Link da tela'), 4000)
 where "ST_APAGADA" = 'N' and length(btrim("DS_TEXTO")) = 0;

drop policy if exists chat_anexos_storage_insert on storage.objects;
drop policy if exists chat_anexos_storage_select on storage.objects;
drop policy if exists chat_anexos_storage_delete on storage.objects;

drop policy "PL_CONVPARTICIP_LEITURA" on public."RL_CONVERSA_PARTICIPANTE";
create policy "PL_CONVPARTICIP_LEITURA" on public."RL_CONVERSA_PARTICIPANTE"
  for select to authenticated using (private."FC_CHAT_PODE_LER"("CO_CONVERSA"));
comment on policy "PL_CONVPARTICIP_LEITURA" on public."RL_CONVERSA_PARTICIPANTE" is 'Participantes só de conversa que a pessoa lê.';

drop function if exists public.confirmar_expurgo_anexos_chat(text[]);
drop function if exists public.preparar_expurgo_anexos_chat();
drop function if exists public.definir_status_chat(text);
drop function if exists public.fixar_conversa_chat(uuid, boolean);
drop function if exists public.marcar_nao_lida_chat(uuid);
drop function if exists public.encaminhar_mensagem_chat(uuid, uuid);
drop function if exists public.buscar_mensagens_chat(text, integer);
drop function if exists public.obter_mensagem_chat(uuid);
drop function if exists public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid, uuid, jsonb);

create function public.enviar_mensagem_chat(
  p_conversa uuid,
  p_texto text,
  p_link_tela jsonb default null,
  p_mencoes uuid[] default null,
  p_mensagem uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_conversa public."TB_CONVERSA";
  v_texto text;
  v_link jsonb;
  v_mencoes uuid[];
  v_existente public."TB_MENSAGEM";
  v_id uuid;
  v_agora timestamptz := clock_timestamp();
begin
  v_conversa := private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  v_texto := private."FC_CHAT_VALIDAR_TEXTO"(p_texto);
  v_link := private."FC_CHAT_VALIDAR_LINK"(p_link_tela);

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
    ("CO_MENSAGEM", "CO_CONVERSA", "CO_USUARIO_AUTOR", "DS_TEXTO", "DS_LINK_TELA", "CO_USUARIOS_MENCIONADOS", "DT_CRIACAO")
  values (coalesce(p_mensagem, gen_random_uuid()), p_conversa, v_uid, v_texto, v_link, v_mencoes, v_agora)
  returning "CO_MENSAGEM" into v_id;

  update public."TB_CONVERSA"
     set "DT_ULTIMA_MENSAGEM" = v_agora, "DT_ATUALIZACAO" = v_agora
   where "CO_CONVERSA" = p_conversa;
  update public."RL_CONVERSA_PARTICIPANTE"
     set "DT_ULTIMA_LEITURA" = greatest(coalesce("DT_ULTIMA_LEITURA", v_agora), v_agora)
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid;

  return private."FC_CHAT_MENSAGEM_JSON"(v_id);
end;
$function$;
comment on function public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid) is
  'Envia uma mensagem: texto de 1 a 4.000 caracteres, link interno da tela opcional (FC_CHAT_VALIDAR_LINK), menções (só participantes) e o id gerado no navegador (reenviar não duplica). Exige poder ler a conversa; na do edital, quem escreve passa a participar.';

revoke all on function public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid) from public, anon;
grant execute on function public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid) to authenticated, service_role;

-- Corpos de antes (20261002210000_chat.sql, 20261005100000_chat_limpar_e_reacoes.sql e
-- 20261005190000_chat_retencao_das_mensagens.sql).
create or replace function private."FC_CHAT_VALIDAR_LINK"(p_link jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_chave text;
  v_edital jsonb;
begin
  if p_link is null or p_link = 'null'::jsonb then return null; end if;
  if jsonb_typeof(p_link) <> 'object' then
    raise exception 'Link da tela inválido' using errcode = '22023';
  end if;
  for v_chave in select jsonb_object_keys(p_link) loop
    if v_chave not in ('view', 'area', 'secao', 'edital', 'rotulo') then
      raise exception 'Link da tela inválido: campo %', v_chave using errcode = '22023';
    end if;
  end loop;
  if coalesce(p_link->>'view', '') !~ '^[a-z][a-z_]{0,39}$' then
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
  return p_link;
end;
$function$;
comment on function private."FC_CHAT_VALIDAR_LINK"(jsonb) is
  'Link interno da tela: só {view, area?, secao?, edital?: {id, titulo?}, rotulo?}, em formato de código (nunca URL). Fora disso, 22023. Espelho de linkDaTela (src/lib/chat.js).';

create or replace function private."FC_CHAT_PESSOA"(p_usuario uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', p_usuario,
    'nome', coalesce(p.nome, 'Pessoa'),
    'avatar', p.avatar,
    'online', exists (
      select 1 from public."TB_PRESENCA_ONLINE_MONITORA" po
       where po.user_id = p_usuario
         and po.seen_at > timezone('utc', now()) - interval '2 minutes'))
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
comment on function private."FC_CHAT_PESSOA"(uuid) is
  'Nome, foto e se está online (presença dos últimos 2 minutos) de uma pessoa do chat.';

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

create or replace function public.listar_conversas_chat()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
begin
  return jsonb_build_object(
    'eu', v_uid,
    'conversas', coalesce((
      select jsonb_agg(private."FC_CHAT_CONVERSA_JSON"(c."CO_CONVERSA", v_uid)
                       order by coalesce(c."DT_ULTIMA_MENSAGEM", c."DT_CRIACAO") desc, c."CO_CONVERSA")
        from public."TB_CONVERSA" c
        join public."RL_CONVERSA_PARTICIPANTE" p
          on p."CO_CONVERSA" = c."CO_CONVERSA" and p."CO_USUARIO" = v_uid and p."DT_SAIDA" is null
       where c."ST_REGISTRO_ATIVO" = 'S'
         and private."FC_CHAT_PODE_LER"(c."CO_CONVERSA")), '[]'::jsonb));
end;
$function$;
comment on function public.listar_conversas_chat() is
  'Conversas de quem está logado (participa e pode ler), da mais recente para a mais antiga, com não lidas e a última mensagem. Exige o recurso chat.';

create or replace function public.apagar_mensagem_chat(p_mensagem uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
    update public."TB_MENSAGEM"
       set "ST_APAGADA" = 'S', "DT_APAGADA" = clock_timestamp(),
           "DS_TEXTO" = '', "DS_LINK_TELA" = null, "CO_USUARIOS_MENCIONADOS" = '{}'
     where "CO_MENSAGEM" = p_mensagem;
  end if;
  return private."FC_CHAT_MENSAGEM_JSON"(p_mensagem);
end;
$function$;
comment on function public.apagar_mensagem_chat(uuid) is
  'Apaga a própria mensagem (lógico: fica "mensagem apagada", sem texto, link e menções; a linha continua). Só o autor (42501). Apagar de novo devolve a mesma.';

create or replace function public.marcar_conversa_lida_chat(p_conversa uuid, p_ate timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
     set "DT_ULTIMA_LEITURA" = greatest(coalesce("DT_ULTIMA_LEITURA", v_ate), v_ate)
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid
  returning "DT_ULTIMA_LEITURA" into v_lida;
  return jsonb_build_object('conversa', p_conversa, 'lida_em', v_lida);
end;
$function$;
comment on function public.marcar_conversa_lida_chat(uuid, timestamptz) is
  'Marca a conversa como lida até p_ate (a última mensagem vista; padrão: agora). A leitura só avança.';

create or replace function private."FC_CHAT_APAGAR_MENSAGENS"(p_antes timestamptz)
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

create or replace function private."FC_CHAT_RETENCAO_DIARIA"()
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

create or replace function public.obter_retencao_chat()
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

create or replace function public.salvar_retencao_chat(p_dias integer, p_motivo text)
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

create or replace function public.zerar_mensagens_chat(p_confirmacao text, p_motivo text, p_incluir_conversas boolean default false)
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

drop function if exists private."FC_CHAT_ANEXOS_JSON"(uuid);
drop function if exists private."FC_CHAT_TRECHO"(text, text);
drop function if exists private."FC_CHAT_SEM_ACENTO"(text);
drop function if exists private."FC_CHAT_PODE_EXPURGAR"(text);
drop function if exists private."FC_CHAT_PODE_BAIXAR_ANEXO"(text);
drop function if exists private."FC_CHAT_ACABOU_DE_ENVIAR"(text);
drop function if exists private."FC_CHAT_PODE_ANEXAR"(text);
drop function if exists private."FC_CHAT_PARTICIPA"(uuid);

drop table if exists public."TB_STATUS_PRESENCA_CHAT";
drop table if exists public."TB_EXPURGO_ANEXO_CHAT";
drop table if exists public."TB_ANEXO_MENSAGEM";
drop function if exists private."FC_CHAT_TIPOS_ANEXO"();

alter table public."TB_MENSAGEM" drop constraint "CK_MENSAGEM_DSTEXTO";
alter table public."TB_MENSAGEM" drop constraint "CK_MENSAGEM_APAGADA";
drop index if exists public."IN_MENSAGEM_RESPOSTA";
alter table public."TB_MENSAGEM"
  drop column "CO_MENSAGEM_RESPOSTA",
  drop column "ST_ENCAMINHADA",
  drop column "QT_ANEXO";
alter table public."TB_MENSAGEM" add constraint "CK_MENSAGEM_APAGADA" check (
  ("ST_APAGADA" = 'S') = ("DT_APAGADA" is not null)
  and ("ST_APAGADA" = 'N' or ("DS_TEXTO" = '' and "DS_LINK_TELA" is null and cardinality("CO_USUARIOS_MENCIONADOS") = 0)));
alter table public."TB_MENSAGEM" add constraint "CK_MENSAGEM_DSTEXTO" check ("ST_APAGADA" = 'S' or (length(btrim("DS_TEXTO")) >= 1 and length("DS_TEXTO") <= 4000));
comment on constraint "CK_MENSAGEM_APAGADA" on public."TB_MENSAGEM" is 'Apagada tem data e fica sem texto, link e menções.';
comment on constraint "CK_MENSAGEM_DSTEXTO" on public."TB_MENSAGEM" is 'Texto com 1 a 4.000 caracteres (fora a apagada).';

alter table public."RL_CONVERSA_PARTICIPANTE"
  drop column "DT_FIXACAO",
  drop column "ST_NAO_LIDA";
alter table public."TH_LIMPEZA_CHAT" drop column "QT_ANEXO_APAGADO";

notify pgrst, 'reload schema';

commit;
