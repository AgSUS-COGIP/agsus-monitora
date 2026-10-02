/*
  CHAT DO MONITORA (VERSÃO 1): CONVERSAS DIRETAS, EM GRUPO E DO EDITAL

  Pedido do RH: "colocar o chat dentro do sistema, pois melhora a comunicação".
  O painel "Mensagens" fica no cabeçalho (src/modulos/chat/); aqui, o banco.

  O QUE ENTRA
    public."TB_CONVERSA"               a conversa: DIRETA (uma por par de pessoas),
                                       GRUPO (nome e participantes escolhidos por
                                       quem cria) ou EDITAL (uma por edital, aberta
                                       a quem vê o edital)
    public."RL_CONVERSA_PARTICIPANTE"  quem participa: papel, última leitura,
                                       silenciada, saída (sair não apaga nada)
    public."TB_MENSAGEM"               cada mensagem: texto (até 4.000), link
                                       interno da tela (jsonb, só view/área/seção/
                                       edital — nunca URL), menções, edição e
                                       apagar lógico ("mensagem apagada")

  QUEM LÊ (RLS ligada; SELECT para authenticated só com policy)
    private."FC_CHAT_PODE_LER"(conversa): tem o recurso 'chat' e
      - DIRETA/GRUPO: participa (sem saída);
      - EDITAL: vê o edital pela área e pelo recorte da coordenação
        (private."FC_PODE_VER_EDITAL", a mesma regra das telas de editais). Perder
        o acesso ao edital tira a leitura da conversa, mesmo de quem participava.
    As três tabelas entram na publicação supabase_realtime (postgres_changes
    respeita a RLS: cada pessoa só recebe o que pode ler). O "digitando…" usa
    broadcast em canal privado "chat:<conversa>"; as policies em
    realtime.messages usam a mesma regra (FC_CHAT_PODE_TOPICO).

  QUEM ESCREVE: só as RPCs (SECURITY DEFINER, search_path vazio). Nenhum grant de
  INSERT/UPDATE/DELETE; não há DELETE físico.
    listar_conversas_chat()                                 conversas da pessoa
    listar_mensagens_chat(conversa, antes, limite)          página de mensagens
    listar_pessoas_chat(busca)                              para "Nova conversa"
    enviar_mensagem_chat(conversa, texto, link, menções, id) id do cliente: reenviar
                                                            não duplica
    editar_mensagem_chat(mensagem, texto)                   só o autor
    apagar_mensagem_chat(mensagem)                          só o autor; lógico
    marcar_conversa_lida_chat(conversa, até)                última leitura
    abrir_conversa_direta_chat(usuário)                     idempotente (par)
    criar_grupo_chat(nome, participantes)
    adicionar_participantes_chat(conversa, participantes)   quem participa do grupo
    sair_conversa_chat(conversa)                            grupo ou edital
    silenciar_conversa_chat(conversa, silenciada)
    abrir_conversa_edital_chat(edital)                      cria na primeira vez
  Todas exigem o recurso 'chat' (42501), conversa ativa e acesso à conversa;
  texto vazio ou acima de 4.000 caracteres, link fora do formato e participante
  sem o recurso 'chat' são recusados (22023).

  PERMISSÃO
    Recurso novo 'chat' em FC_RECURSOS_MODULO, com dois níveis: sem_acesso |
    leitor (na tela de Acessos: "Sem acesso" | "Usar"). CHECK em
    TA_GRUPO_ACESSO_RECURSO e TB_PERMISSAO_RECURSO. Semente: todos os grupos
    com leitor (o admin desliga por grupo ou por pessoa).

  PRÉ-REQUISITO: 20261002150000_classificacao.sql aplicada (a migration para se
  não estiver).

  Ensaio: supabase/ensaios/20261002210000_chat.sql
  Rollback: supabase/rollback/20261002210000_chat.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if not ('classificacao' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'Aplique antes 20261002150000_classificacao.sql (lista de módulos sem classificacao).';
  end if;
  if to_regprocedure('private."FC_PODE_VER_EDITAL"(uuid)') is null then
    raise exception 'Aplique antes 20260929121100_coordenacoes.sql (sem FC_PODE_VER_EDITAL).';
  end if;
end;
$$;

-- 1. Permissão: recurso 'chat' -----------------------------------------------------------
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao','chat']::text[];
$function$;

alter table public."TA_GRUPO_ACESSO_RECURSO"
  add constraint "CK_GRUPACESSOREC_CHAT"
  check ("NO_RECURSO" <> 'chat' or "TP_NIVEL" in ('sem_acesso', 'leitor'));
comment on constraint "CK_GRUPACESSOREC_CHAT" on public."TA_GRUPO_ACESSO_RECURSO" is
  'Mensagens (chat) aceita só Sem acesso ou Leitor (na tela: Usar).';

alter table public."TB_PERMISSAO_RECURSO"
  add constraint "CK_PERMISSAORECURSO_CHAT"
  check (recurso <> 'chat' or nivel in ('sem_acesso', 'leitor'));
comment on constraint "CK_PERMISSAORECURSO_CHAT" on public."TB_PERMISSAO_RECURSO" is
  'Permissão individual de mensagens (chat): só Sem acesso ou Leitor (Usar).';

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g."CO_GRUPO_ACESSO", 'chat', 'leitor'
  from public."TB_GRUPO_ACESSO" g
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

-- 2. Tabelas ------------------------------------------------------------------------------
create table public."TB_CONVERSA" (
  "CO_CONVERSA" uuid not null default gen_random_uuid(),
  "TP_CONVERSA" varchar(10) not null,
  "NO_CONVERSA" varchar(120),
  "CO_MONITORAMENTO" uuid,
  "DS_CHAVE_DIRETA" varchar(73),
  "CO_USUARIO_CRIADOR" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "DT_ULTIMA_MENSAGEM" timestamptz,
  "ST_REGISTRO_ATIVO" varchar(1) not null default 'S',
  constraint "PK_TB_CONVERSA" primary key ("CO_CONVERSA"),
  constraint "UK_CONVERSA_CHAVEDIRETA" unique ("DS_CHAVE_DIRETA"),
  constraint "UK_CONVERSA_COMONITORAMENTO" unique ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_CONVERSA" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_CONVERSA_TPCONVERSA" check ("TP_CONVERSA" in ('DIRETA', 'GRUPO', 'EDITAL')),
  constraint "CK_CONVERSA_FORMATO" check (
    ("TP_CONVERSA" = 'GRUPO') = ("NO_CONVERSA" is not null)
    and ("TP_CONVERSA" = 'EDITAL') = ("CO_MONITORAMENTO" is not null)
    and ("TP_CONVERSA" = 'DIRETA') = ("DS_CHAVE_DIRETA" is not null)),
  constraint "CK_CONVERSA_NOCONVERSA" check ("NO_CONVERSA" is null or length(btrim("NO_CONVERSA")) between 1 and 120),
  constraint "CK_CONVERSA_CHAVEDIRETA" check ("DS_CHAVE_DIRETA" is null or "DS_CHAVE_DIRETA" ~ '^[0-9a-f-]{36}:[0-9a-f-]{36}$'),
  constraint "CK_CONVERSA_STREGISTROATIVO" check ("ST_REGISTRO_ATIVO" in ('S', 'N'))
);
comment on table public."TB_CONVERSA" is
  'Conversas do chat do MONITORA: DIRETA (uma por par), GRUPO (nome e participantes de quem cria) ou EDITAL (uma por edital, aberta a quem vê o edital). Escrita só pelas RPCs *_chat.';
comment on column public."TB_CONVERSA"."CO_CONVERSA" is 'Identificador da conversa.';
comment on column public."TB_CONVERSA"."TP_CONVERSA" is 'DIRETA, GRUPO ou EDITAL.';
comment on column public."TB_CONVERSA"."NO_CONVERSA" is 'Nome do grupo (só GRUPO; 1 a 120 caracteres). DIRETA e EDITAL tiram o nome da pessoa e do edital.';
comment on column public."TB_CONVERSA"."CO_MONITORAMENTO" is 'Edital da conversa (TB_MONITORAMENTO_INDIGENA.id; só EDITAL).';
comment on column public."TB_CONVERSA"."DS_CHAVE_DIRETA" is 'Par da conversa direta: menor uuid, dois-pontos, maior uuid (auth.users.id). Garante uma conversa por par.';
comment on column public."TB_CONVERSA"."CO_USUARIO_CRIADOR" is 'Quem criou (auth.users.id).';
comment on column public."TB_CONVERSA"."DT_CRIACAO" is 'Quando foi criada.';
comment on column public."TB_CONVERSA"."DT_ATUALIZACAO" is 'Última alteração (mensagem nova, participante).';
comment on column public."TB_CONVERSA"."DT_ULTIMA_MENSAGEM" is 'Quando chegou a última mensagem (ordem da lista de conversas).';
comment on column public."TB_CONVERSA"."ST_REGISTRO_ATIVO" is 'S: ativa. N: desativada (some da lista e não aceita mensagem).';
comment on constraint "PK_TB_CONVERSA" on public."TB_CONVERSA" is 'Identificador da conversa.';
comment on constraint "UK_CONVERSA_CHAVEDIRETA" on public."TB_CONVERSA" is 'Uma conversa direta por par de pessoas.';
comment on constraint "UK_CONVERSA_COMONITORAMENTO" on public."TB_CONVERSA" is 'Uma conversa por edital.';
comment on constraint "FK_MONITORAMENTO_CONVERSA" on public."TB_CONVERSA" is 'Edital da conversa. Sem cascata: as mensagens são registro.';
comment on constraint "CK_CONVERSA_TPCONVERSA" on public."TB_CONVERSA" is 'Tipos de conversa válidos.';
comment on constraint "CK_CONVERSA_FORMATO" on public."TB_CONVERSA" is 'GRUPO tem nome; EDITAL tem edital; DIRETA tem a chave do par — e só eles.';
comment on constraint "CK_CONVERSA_NOCONVERSA" on public."TB_CONVERSA" is 'Nome do grupo com 1 a 120 caracteres.';
comment on constraint "CK_CONVERSA_CHAVEDIRETA" on public."TB_CONVERSA" is 'Chave do par no formato uuid:uuid.';
comment on constraint "CK_CONVERSA_STREGISTROATIVO" on public."TB_CONVERSA" is 'Flag S/N.';

create table public."RL_CONVERSA_PARTICIPANTE" (
  "CO_CONVERSA" uuid not null,
  "CO_USUARIO" uuid not null,
  "TP_PAPEL" varchar(10) not null default 'MEMBRO',
  "CO_USUARIO_INCLUSAO" uuid,
  "DT_ENTRADA" timestamptz not null default now(),
  "DT_ULTIMA_LEITURA" timestamptz,
  "ST_SILENCIADA" varchar(1) not null default 'N',
  "DT_SAIDA" timestamptz,
  constraint "PK_RL_CONVERSA_PARTICIPANTE" primary key ("CO_CONVERSA", "CO_USUARIO"),
  constraint "FK_CONVERSA_CONVPARTICIP" foreign key ("CO_CONVERSA") references public."TB_CONVERSA" ("CO_CONVERSA"),
  constraint "CK_CONVPARTICIP_TPPAPEL" check ("TP_PAPEL" in ('CRIADOR', 'MEMBRO')),
  constraint "CK_CONVPARTICIP_STSILENCIADA" check ("ST_SILENCIADA" in ('S', 'N'))
);
create index "IN_CONVPARTICIP_USUARIO" on public."RL_CONVERSA_PARTICIPANTE" ("CO_USUARIO", "CO_CONVERSA");
comment on table public."RL_CONVERSA_PARTICIPANTE" is
  'Participantes de cada conversa do chat: papel, última leitura (não lidas), silenciada e saída. Sair não apaga a linha. Na conversa do edital, a linha nasce quando a pessoa a abre.';
comment on column public."RL_CONVERSA_PARTICIPANTE"."CO_CONVERSA" is 'Conversa (TB_CONVERSA).';
comment on column public."RL_CONVERSA_PARTICIPANTE"."CO_USUARIO" is 'Participante (auth.users.id).';
comment on column public."RL_CONVERSA_PARTICIPANTE"."TP_PAPEL" is 'CRIADOR (quem criou) ou MEMBRO.';
comment on column public."RL_CONVERSA_PARTICIPANTE"."CO_USUARIO_INCLUSAO" is 'Quem incluiu a pessoa no grupo (auth.users.id); nulo para quem entrou sozinho.';
comment on column public."RL_CONVERSA_PARTICIPANTE"."DT_ENTRADA" is 'Quando entrou (ou voltou) na conversa.';
comment on column public."RL_CONVERSA_PARTICIPANTE"."DT_ULTIMA_LEITURA" is 'Até quando leu: mensagens de outras pessoas depois disso são não lidas.';
comment on column public."RL_CONVERSA_PARTICIPANTE"."ST_SILENCIADA" is 'S: a conversa não conta no contador nem avisa.';
comment on column public."RL_CONVERSA_PARTICIPANTE"."DT_SAIDA" is 'Quando saiu (grupo ou edital). Nula: participa.';
comment on constraint "PK_RL_CONVERSA_PARTICIPANTE" on public."RL_CONVERSA_PARTICIPANTE" is 'Uma linha por pessoa em cada conversa.';
comment on constraint "FK_CONVERSA_CONVPARTICIP" on public."RL_CONVERSA_PARTICIPANTE" is 'Conversa do participante.';
comment on constraint "CK_CONVPARTICIP_TPPAPEL" on public."RL_CONVERSA_PARTICIPANTE" is 'Papéis válidos.';
comment on constraint "CK_CONVPARTICIP_STSILENCIADA" on public."RL_CONVERSA_PARTICIPANTE" is 'Flag S/N.';
comment on index public."IN_CONVPARTICIP_USUARIO" is 'Conversas de uma pessoa.';

create table public."TB_MENSAGEM" (
  "CO_MENSAGEM" uuid not null default gen_random_uuid(),
  "CO_CONVERSA" uuid not null,
  "CO_USUARIO_AUTOR" uuid not null,
  "DS_TEXTO" text not null,
  "DS_LINK_TELA" jsonb,
  "CO_USUARIOS_MENCIONADOS" uuid[] not null default '{}',
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_EDICAO" timestamptz,
  "ST_APAGADA" varchar(1) not null default 'N',
  "DT_APAGADA" timestamptz,
  constraint "PK_TB_MENSAGEM" primary key ("CO_MENSAGEM"),
  constraint "FK_CONVERSA_MENSAGEM" foreign key ("CO_CONVERSA") references public."TB_CONVERSA" ("CO_CONVERSA"),
  constraint "CK_MENSAGEM_STAPAGADA" check ("ST_APAGADA" in ('S', 'N')),
  constraint "CK_MENSAGEM_APAGADA" check (
    ("ST_APAGADA" = 'S') = ("DT_APAGADA" is not null)
    and ("ST_APAGADA" = 'N' or ("DS_TEXTO" = '' and "DS_LINK_TELA" is null and cardinality("CO_USUARIOS_MENCIONADOS") = 0))),
  constraint "CK_MENSAGEM_DSTEXTO" check ("ST_APAGADA" = 'S' or (length(btrim("DS_TEXTO")) >= 1 and length("DS_TEXTO") <= 4000)),
  constraint "CK_MENSAGEM_LINKTELA" check ("DS_LINK_TELA" is null or (jsonb_typeof("DS_LINK_TELA") = 'object' and length("DS_LINK_TELA"::text) <= 1000)),
  constraint "CK_MENSAGEM_MENCIONADOS" check (cardinality("CO_USUARIOS_MENCIONADOS") <= 50)
);
create index "IN_MENSAGEM_CONVERSA_DATA" on public."TB_MENSAGEM" ("CO_CONVERSA", "DT_CRIACAO" desc, "CO_MENSAGEM" desc);
comment on table public."TB_MENSAGEM" is
  'Mensagens do chat. Editar guarda DT_EDICAO; apagar é lógico (ST_APAGADA = S: texto, link e menções saem, a linha fica como "mensagem apagada"). Sem DELETE físico.';
comment on column public."TB_MENSAGEM"."CO_MENSAGEM" is 'Identificador da mensagem. Pode vir do navegador (uuid): reenviar o mesmo id não duplica.';
comment on column public."TB_MENSAGEM"."CO_CONVERSA" is 'Conversa (TB_CONVERSA).';
comment on column public."TB_MENSAGEM"."CO_USUARIO_AUTOR" is 'Autor (auth.users.id). Só ele edita e apaga.';
comment on column public."TB_MENSAGEM"."DS_TEXTO" is 'Texto (1 a 4.000 caracteres); vazio só na mensagem apagada.';
comment on column public."TB_MENSAGEM"."DS_LINK_TELA" is 'Link interno da tela compartilhada: {view, area?, secao?, edital?: {id, titulo}, rotulo?}. Nunca URL; a navegação é dentro do app.';
comment on column public."TB_MENSAGEM"."CO_USUARIOS_MENCIONADOS" is 'Pessoas mencionadas com @ (auth.users.id; participantes da conversa; até 50).';
comment on column public."TB_MENSAGEM"."DT_CRIACAO" is 'Quando foi enviada.';
comment on column public."TB_MENSAGEM"."DT_EDICAO" is 'Última edição pelo autor; nula se nunca editada.';
comment on column public."TB_MENSAGEM"."ST_APAGADA" is 'S: apagada pelo autor (apagar lógico).';
comment on column public."TB_MENSAGEM"."DT_APAGADA" is 'Quando foi apagada.';
comment on constraint "PK_TB_MENSAGEM" on public."TB_MENSAGEM" is 'Identificador da mensagem.';
comment on constraint "FK_CONVERSA_MENSAGEM" on public."TB_MENSAGEM" is 'Conversa da mensagem.';
comment on constraint "CK_MENSAGEM_STAPAGADA" on public."TB_MENSAGEM" is 'Flag S/N.';
comment on constraint "CK_MENSAGEM_APAGADA" on public."TB_MENSAGEM" is 'Apagada tem data e fica sem texto, link e menções.';
comment on constraint "CK_MENSAGEM_DSTEXTO" on public."TB_MENSAGEM" is 'Texto com 1 a 4.000 caracteres (fora a apagada).';
comment on constraint "CK_MENSAGEM_LINKTELA" on public."TB_MENSAGEM" is 'Link da tela é um objeto pequeno (até 1.000 caracteres).';
comment on constraint "CK_MENSAGEM_MENCIONADOS" on public."TB_MENSAGEM" is 'Até 50 menções.';
comment on index public."IN_MENSAGEM_CONVERSA_DATA" is 'Mensagens de uma conversa, das mais novas para as mais antigas.';

-- 3. Quem pode ----------------------------------------------------------------------------
create function private."FC_CHAT_EXIGIR"()
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
  if not private.pode_recurso('chat', 1) then
    raise exception 'Sem acesso às mensagens' using errcode = '42501';
  end if;
  return v_uid;
end;
$function$;
comment on function private."FC_CHAT_EXIGIR"() is
  'Barra quem não está logado (28000) ou não tem o recurso chat (42501); devolve auth.uid().';

create function private."FC_CHAT_PODE_LER"(p_conversa uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
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
comment on function private."FC_CHAT_PODE_LER"(uuid) is
  'Quem está logado lê a conversa? Recurso chat e: participante sem saída (DIRETA/GRUPO) ou acesso ao edital (EDITAL, FC_PODE_VER_EDITAL). Usada nas policies e nas RPCs.';

create function private."FC_CHAT_PODE_TOPICO"(p_topico text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_topico is null
     or p_topico !~ '^chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private."FC_CHAT_PODE_LER"(substr(p_topico, 6)::uuid);
end;
$function$;
comment on function private."FC_CHAT_PODE_TOPICO"(text) is
  'Canal privado do Realtime "chat:<conversa>" (digitando…): só quem lê a conversa entra.';

create function private."FC_CHAT_USUARIO_LIBERADO"(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where u.user_id = p_usuario
       and u.ativo is true
       and private."FC_NIVEL_EFETIVO"(u.id, u.perfil, 'chat') <> 'sem_acesso');
$function$;
comment on function private."FC_CHAT_USUARIO_LIBERADO"(uuid) is
  'A pessoa (auth.users.id) tem perfil ativo e o recurso chat? Para incluir em conversa.';

create function private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa uuid)
returns public."TB_CONVERSA"
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
comment on function private."FC_CHAT_EXIGIR_CONVERSA"(uuid) is
  'Barra conversa inexistente ou desativada (P0002) e quem não pode lê-la (42501); devolve a conversa.';

create function private."FC_CHAT_VALIDAR_TEXTO"(p_texto text)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
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
comment on function private."FC_CHAT_VALIDAR_TEXTO"(text) is
  'Texto da mensagem: 1 a 4.000 caracteres, não só espaços (22023).';

create function private."FC_CHAT_VALIDAR_LINK"(p_link jsonb)
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

revoke all on function private."FC_CHAT_EXIGIR"(), private."FC_CHAT_PODE_LER"(uuid), private."FC_CHAT_PODE_TOPICO"(text),
  private."FC_CHAT_USUARIO_LIBERADO"(uuid), private."FC_CHAT_EXIGIR_CONVERSA"(uuid),
  private."FC_CHAT_VALIDAR_TEXTO"(text), private."FC_CHAT_VALIDAR_LINK"(jsonb)
  from public, anon, authenticated;
-- As policies rodam como a pessoa: precisam de execute.
grant execute on function private."FC_CHAT_PODE_LER"(uuid), private."FC_CHAT_PODE_TOPICO"(text) to authenticated;

-- 4. Leitura direta (Realtime) só pela RLS --------------------------------------------------
alter table public."TB_CONVERSA" enable row level security;
alter table public."RL_CONVERSA_PARTICIPANTE" enable row level security;
alter table public."TB_MENSAGEM" enable row level security;
revoke all on public."TB_CONVERSA", public."RL_CONVERSA_PARTICIPANTE", public."TB_MENSAGEM" from public, anon, authenticated;
grant select on public."TB_CONVERSA", public."RL_CONVERSA_PARTICIPANTE", public."TB_MENSAGEM" to authenticated;

create policy "PL_CONVERSA_LEITURA" on public."TB_CONVERSA"
  for select to authenticated using (private."FC_CHAT_PODE_LER"("CO_CONVERSA"));
create policy "PL_CONVPARTICIP_LEITURA" on public."RL_CONVERSA_PARTICIPANTE"
  for select to authenticated using (private."FC_CHAT_PODE_LER"("CO_CONVERSA"));
create policy "PL_MENSAGEM_LEITURA" on public."TB_MENSAGEM"
  for select to authenticated using (private."FC_CHAT_PODE_LER"("CO_CONVERSA"));
comment on policy "PL_CONVERSA_LEITURA" on public."TB_CONVERSA" is 'Só quem pode ler a conversa (FC_CHAT_PODE_LER).';
comment on policy "PL_CONVPARTICIP_LEITURA" on public."RL_CONVERSA_PARTICIPANTE" is 'Participantes só de conversa que a pessoa lê.';
comment on policy "PL_MENSAGEM_LEITURA" on public."TB_MENSAGEM" is 'Mensagens só de conversa que a pessoa lê.';

-- Realtime: postgres_changes das três tabelas (com a RLS acima).
do $$
declare
  v_tabela text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_tabela in array array['TB_CONVERSA', 'RL_CONVERSA_PARTICIPANTE', 'TB_MENSAGEM'] loop
      if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_tabela
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_tabela);
      end if;
    end loop;
  else
    raise notice 'Publicação supabase_realtime não existe: o chat funciona, mas sem tempo real.';
  end if;
end;
$$;

-- Realtime: canal privado "chat:<conversa>" do digitando… (broadcast/presence).
do $$
begin
  if to_regclass('realtime.messages') is not null and to_regprocedure('realtime.topic()') is not null then
    execute $p$create policy "PL_CHAT_REALTIME_LEITURA" on realtime.messages
      for select to authenticated
      using (realtime.messages.extension in ('broadcast', 'presence') and private."FC_CHAT_PODE_TOPICO"(realtime.topic()))$p$;
    execute $p$create policy "PL_CHAT_REALTIME_ENVIO" on realtime.messages
      for insert to authenticated
      with check (realtime.messages.extension in ('broadcast', 'presence') and private."FC_CHAT_PODE_TOPICO"(realtime.topic()))$p$;
  else
    raise notice 'realtime.messages não existe: sem o aviso de digitando.';
  end if;
end;
$$;

-- 5. Leitura em JSON ---------------------------------------------------------------------------
create function private."FC_CHAT_PESSOA"(p_usuario uuid)
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

create function private."FC_CHAT_MENSAGEM_JSON"(p_mensagem uuid)
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
    'apagada', m."ST_APAGADA" = 'S')
  from public."TB_MENSAGEM" m
  where m."CO_MENSAGEM" = p_mensagem;
$function$;
comment on function private."FC_CHAT_MENSAGEM_JSON"(uuid) is
  'Uma mensagem no formato da tela (o mesmo que o Realtime entrega, com nomes de campo da tela).';

create function private."FC_CHAT_CONVERSA_JSON"(p_conversa uuid, p_usuario uuid)
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
    'silenciada', coalesce(eu."ST_SILENCIADA" = 'S', false),
    'nao_lidas', (
      select count(*) from public."TB_MENSAGEM" x
       where x."CO_CONVERSA" = c."CO_CONVERSA" and x."CO_USUARIO_AUTOR" <> p_usuario and x."ST_APAGADA" = 'N'
         and (eu."DT_ULTIMA_LEITURA" is null or x."DT_CRIACAO" > eu."DT_ULTIMA_LEITURA")),
    'mencoes', (
      select count(*) from public."TB_MENSAGEM" x
       where x."CO_CONVERSA" = c."CO_CONVERSA" and x."CO_USUARIO_AUTOR" <> p_usuario and x."ST_APAGADA" = 'N'
         and p_usuario = any (x."CO_USUARIOS_MENCIONADOS")
         and (eu."DT_ULTIMA_LEITURA" is null or x."DT_CRIACAO" > eu."DT_ULTIMA_LEITURA")),
    'ultima', (
      select jsonb_build_object(
               'id', x."CO_MENSAGEM",
               'autor', x."CO_USUARIO_AUTOR",
               'texto', left(x."DS_TEXTO", 160),
               'apagada', x."ST_APAGADA" = 'S',
               'criada_em', x."DT_CRIACAO")
        from public."TB_MENSAGEM" x
       where x."CO_CONVERSA" = c."CO_CONVERSA"
       order by x."DT_CRIACAO" desc, x."CO_MENSAGEM" desc
       limit 1))
  from public."TB_CONVERSA" c
  left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c."CO_MONITORAMENTO"
  left join public."RL_CONVERSA_PARTICIPANTE" eu on eu."CO_CONVERSA" = c."CO_CONVERSA" and eu."CO_USUARIO" = p_usuario
  where c."CO_CONVERSA" = p_conversa;
$function$;
comment on function private."FC_CHAT_CONVERSA_JSON"(uuid, uuid) is
  'Uma conversa como a pessoa a vê: tipo, nome, edital, participantes (com online), não lidas, menções não lidas, silenciada e a última mensagem.';

revoke all on function private."FC_CHAT_PESSOA"(uuid), private."FC_CHAT_MENSAGEM_JSON"(uuid),
  private."FC_CHAT_CONVERSA_JSON"(uuid, uuid)
  from public, anon, authenticated;

-- 6. RPCs de leitura -----------------------------------------------------------------------------
create function public.listar_conversas_chat()
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
revoke all on function public.listar_conversas_chat() from public, anon;
grant execute on function public.listar_conversas_chat() to authenticated, service_role;

create function public.listar_mensagens_chat(p_conversa uuid, p_antes timestamptz default null, p_limite integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR"();
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_ids uuid[];
begin
  perform private."FC_CHAT_EXIGIR_CONVERSA"(p_conversa);
  select coalesce(array_agg(s.id order by s.criada_em desc, s.id desc), '{}') into v_ids
    from (
      select m."CO_MENSAGEM" as id, m."DT_CRIACAO" as criada_em
        from public."TB_MENSAGEM" m
       where m."CO_CONVERSA" = p_conversa
         and (p_antes is null or m."DT_CRIACAO" < p_antes)
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
  'Uma página de mensagens da conversa (as mais novas antes de p_antes, até p_limite, no máximo 100), em ordem de envio, com a conversa e tem_mais. Exige poder ler a conversa.';
revoke all on function public.listar_mensagens_chat(uuid, timestamptz, integer) from public, anon;
grant execute on function public.listar_mensagens_chat(uuid, timestamptz, integer) to authenticated, service_role;

create function public.listar_pessoas_chat(p_busca text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
comment on function public.listar_pessoas_chat(text) is
  'Pessoas com perfil ativo e o recurso chat (fora quem pergunta), por nome ou e-mail, até 30, com online. Para "Nova conversa" e menções.';
revoke all on function public.listar_pessoas_chat(text) from public, anon;
grant execute on function public.listar_pessoas_chat(text) to authenticated, service_role;

-- 7. RPCs de escrita --------------------------------------------------------------------------------
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

create function public.editar_mensagem_chat(p_mensagem uuid, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.editar_mensagem_chat(uuid, text) is
  'Edita o texto da própria mensagem (1 a 4.000 caracteres) e marca DT_EDICAO. Só o autor (42501), não apagada (22023), com acesso à conversa.';
revoke all on function public.editar_mensagem_chat(uuid, text) from public, anon;
grant execute on function public.editar_mensagem_chat(uuid, text) to authenticated, service_role;

create function public.apagar_mensagem_chat(p_mensagem uuid)
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
revoke all on function public.apagar_mensagem_chat(uuid) from public, anon;
grant execute on function public.apagar_mensagem_chat(uuid) to authenticated, service_role;

create function public.marcar_conversa_lida_chat(p_conversa uuid, p_ate timestamptz default null)
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
revoke all on function public.marcar_conversa_lida_chat(uuid, timestamptz) from public, anon;
grant execute on function public.marcar_conversa_lida_chat(uuid, timestamptz) to authenticated, service_role;

create function public.abrir_conversa_direta_chat(p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.abrir_conversa_direta_chat(uuid) is
  'Abre (ou cria, na primeira vez) a conversa direta com a pessoa: uma por par, quem quer que abra primeiro. A pessoa precisa ter o recurso chat (22023).';
revoke all on function public.abrir_conversa_direta_chat(uuid) from public, anon;
grant execute on function public.abrir_conversa_direta_chat(uuid) to authenticated, service_role;

create function private."FC_CHAT_PARTICIPANTES_VALIDOS"(p_participantes uuid[], p_uid uuid)
returns uuid[]
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
comment on function private."FC_CHAT_PARTICIPANTES_VALIDOS"(uuid[], uuid) is
  'Participantes para incluir: sem repetição, sem quem inclui, até 100, todos com o recurso chat (22023).';
revoke all on function private."FC_CHAT_PARTICIPANTES_VALIDOS"(uuid[], uuid) from public, anon, authenticated;

create function public.criar_grupo_chat(p_nome text, p_participantes uuid[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.criar_grupo_chat(text, uuid[]) is
  'Cria um grupo com nome (1 a 120) e participantes (ao menos um, até 100, todos com o recurso chat). Quem cria entra como CRIADOR.';
revoke all on function public.criar_grupo_chat(text, uuid[]) from public, anon;
grant execute on function public.criar_grupo_chat(text, uuid[]) to authenticated, service_role;

create function public.adicionar_participantes_chat(p_conversa uuid, p_participantes uuid[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.adicionar_participantes_chat(uuid, uuid[]) is
  'Inclui pessoas num grupo (quem participa inclui; quem saiu volta). Todas com o recurso chat (22023).';
revoke all on function public.adicionar_participantes_chat(uuid, uuid[]) from public, anon;
grant execute on function public.adicionar_participantes_chat(uuid, uuid[]) to authenticated, service_role;

create function public.sair_conversa_chat(p_conversa uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.sair_conversa_chat(uuid) is
  'Sai do grupo (deixa de ler e de receber) ou deixa de acompanhar a conversa do edital (continua podendo abrir). Direta não tem saída (22023).';
revoke all on function public.sair_conversa_chat(uuid) from public, anon;
grant execute on function public.sair_conversa_chat(uuid) to authenticated, service_role;

create function public.silenciar_conversa_chat(p_conversa uuid, p_silenciada boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.silenciar_conversa_chat(uuid, boolean) is
  'Silencia (ou não) a conversa para quem está logado: silenciada não conta no contador nem avisa.';
revoke all on function public.silenciar_conversa_chat(uuid, boolean) from public, anon;
grant execute on function public.silenciar_conversa_chat(uuid, boolean) to authenticated, service_role;

create function public.abrir_conversa_edital_chat(p_edital uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.abrir_conversa_edital_chat(uuid) is
  'Abre a conversa do edital (cria na primeira vez; uma por edital) e passa a acompanhá-la. Exige o recurso chat e ver o edital pela área e pela coordenação (FC_PODE_VER_EDITAL; 42501).';
revoke all on function public.abrir_conversa_edital_chat(uuid) from public, anon;
grant execute on function public.abrir_conversa_edital_chat(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
