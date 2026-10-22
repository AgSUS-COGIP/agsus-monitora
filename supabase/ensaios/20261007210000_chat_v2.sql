/*
  ENSAIO de 20261007210000_chat_v2.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e percorre a v2 do chat com pessoas
  sintéticas — Ana, Bruno e Carla (grupo do ensaio só com o chat) e Diana
  (administradora global, grupo admin) — e objetos sintéticos no bucket
  chat-anexos (linhas em storage.objects, como o upload deixaria). Confere:
  estrutura (RLS sem grant, bucket privado de 10 MB, políticas, assinatura nova
  do envio); resposta com citação; anexos com tipo e tamanho lidos do Storage
  e as recusas (dono, tamanho, tipo, reuso, outra conversa, inexistente);
  quem lê e quem envia pelo caminho; encaminhar; Visto só para participante
  (inclusive quem só vê o edital); fixar, não lida e status; busca sem acento
  no texto e no nome do anexo; cartão da ficha; apagar desliga o anexo; a
  retenção apaga os anexos, anula a citação e põe o objeto na fila de expurgo,
  que só o administrador global esvazia; o "Zerar" conta os anexos.
  Termina em ROLLBACK: nada fica gravado — nem as mensagens reais que a
  retenção e o zerar apagam durante o ensaio.

  Pré-requisito: 20261005190000_chat_retencao_das_mensagens.sql aplicada.

  Resultado esperado: as mensagens "ok E1" … "ok E13" e a linha "ENSAIO OK"
  do SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a
  mensagem.

  Mantenha em sincronia: tests/chat-v2-migration.test.js confere que o corpo da
  migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TH_LIMPEZA_CHAT"') is null
     or to_regprocedure('private."FC_CHAT_APAGAR_MENSAGENS"(timestamptz)') is null then
    raise exception 'Aplique antes 20261005190000_chat_retencao_das_mensagens.sql (sem a retenção do chat).';
  end if;
end;
$$;

-- 1. Colunas novas nas tabelas do chat ---------------------------------------------------
alter table public."TB_MENSAGEM"
  add column "CO_MENSAGEM_RESPOSTA" uuid,
  add column "ST_ENCAMINHADA" varchar(1) not null default 'N',
  add column "QT_ANEXO" smallint not null default 0,
  add constraint "FK_MENSAGEM_MENSAGEMRESPOSTA" foreign key ("CO_MENSAGEM_RESPOSTA")
    references public."TB_MENSAGEM" ("CO_MENSAGEM") on delete set null,
  add constraint "CK_MENSAGEM_STENCAMINHADA" check ("ST_ENCAMINHADA" in ('S', 'N')),
  add constraint "CK_MENSAGEM_QTANEXO" check ("QT_ANEXO" between 0 and 5),
  add constraint "CK_MENSAGEM_RESPOSTA" check ("CO_MENSAGEM_RESPOSTA" is null or "CO_MENSAGEM_RESPOSTA" <> "CO_MENSAGEM");
alter table public."TB_MENSAGEM" drop constraint "CK_MENSAGEM_DSTEXTO";
alter table public."TB_MENSAGEM" add constraint "CK_MENSAGEM_DSTEXTO" check (
  "ST_APAGADA" = 'S'
  or (length("DS_TEXTO") <= 4000
      and (length(btrim("DS_TEXTO")) >= 1 or "QT_ANEXO" > 0 or "DS_LINK_TELA" is not null)));
alter table public."TB_MENSAGEM" drop constraint "CK_MENSAGEM_APAGADA";
alter table public."TB_MENSAGEM" add constraint "CK_MENSAGEM_APAGADA" check (
  ("ST_APAGADA" = 'S') = ("DT_APAGADA" is not null)
  and ("ST_APAGADA" = 'N'
       or ("DS_TEXTO" = '' and "DS_LINK_TELA" is null and cardinality("CO_USUARIOS_MENCIONADOS") = 0 and "QT_ANEXO" = 0)));
create index "IN_MENSAGEM_RESPOSTA" on public."TB_MENSAGEM" ("CO_MENSAGEM_RESPOSTA") where "CO_MENSAGEM_RESPOSTA" is not null;
comment on column public."TB_MENSAGEM"."CO_MENSAGEM_RESPOSTA" is 'Mensagem citada (Responder), da mesma conversa. Fica nula se a retenção apagar a original.';
comment on column public."TB_MENSAGEM"."ST_ENCAMINHADA" is 'S: cópia encaminhada de outra conversa (texto, cartão e anexos; sem menções e sem a origem).';
comment on column public."TB_MENSAGEM"."QT_ANEXO" is 'Quantos anexos a mensagem tem (0 a 5; TB_ANEXO_MENSAGEM). Com anexo ou cartão, o texto pode ficar vazio.';
comment on constraint "FK_MENSAGEM_MENSAGEMRESPOSTA" on public."TB_MENSAGEM" is 'Mensagem citada; a retenção apaga a original e a citação some (SET NULL).';
comment on constraint "CK_MENSAGEM_STENCAMINHADA" on public."TB_MENSAGEM" is 'Flag S/N.';
comment on constraint "CK_MENSAGEM_QTANEXO" on public."TB_MENSAGEM" is 'De 0 a 5 anexos por mensagem.';
comment on constraint "CK_MENSAGEM_RESPOSTA" on public."TB_MENSAGEM" is 'A mensagem não cita a si mesma.';
comment on constraint "CK_MENSAGEM_DSTEXTO" on public."TB_MENSAGEM" is 'Até 4.000 caracteres; vazio só com anexo ou cartão (fora a apagada).';
comment on constraint "CK_MENSAGEM_APAGADA" on public."TB_MENSAGEM" is 'Apagada tem data e fica sem texto, link, menções e anexos.';
comment on index public."IN_MENSAGEM_RESPOSTA" is 'Respostas a uma mensagem (citações).';

alter table public."RL_CONVERSA_PARTICIPANTE"
  add column "DT_FIXACAO" timestamptz,
  add column "ST_NAO_LIDA" varchar(1) not null default 'N',
  add constraint "CK_CONVPARTICIP_STNAOLIDA" check ("ST_NAO_LIDA" in ('S', 'N'));
comment on column public."RL_CONVERSA_PARTICIPANTE"."DT_FIXACAO" is 'Quando a pessoa fixou a conversa no topo da lista. Nula: não fixada.';
comment on column public."RL_CONVERSA_PARTICIPANTE"."ST_NAO_LIDA" is 'S: a pessoa marcou a conversa como não lida; ler a conversa desmarca.';
comment on constraint "CK_CONVPARTICIP_STNAOLIDA" on public."RL_CONVERSA_PARTICIPANTE" is 'Flag S/N.';

alter table public."TH_LIMPEZA_CHAT"
  add column "QT_ANEXO_APAGADO" integer not null default 0,
  add constraint "CK_LIMPEZACHAT_QTANEXOAPAGADO" check ("QT_ANEXO_APAGADO" >= 0);
comment on column public."TH_LIMPEZA_CHAT"."QT_ANEXO_APAGADO" is 'Quantos anexos (linhas de TB_ANEXO_MENSAGEM) saíram com as mensagens. Só a contagem: nem nome nem caminho.';
comment on constraint "CK_LIMPEZACHAT_QTANEXOAPAGADO" on public."TH_LIMPEZA_CHAT" is 'Contagem não negativa.';

-- 2. Tabelas novas ----------------------------------------------------------------------
create function private."FC_CHAT_TIPOS_ANEXO"()
returns text[]
language sql
immutable
set search_path to ''
as $function$
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
comment on function private."FC_CHAT_TIPOS_ANEXO"() is
  'Tipos de arquivo aceitos nos anexos do chat (PDF, imagem e planilha). Espelho de TIPOS_DE_ANEXO (src/lib/anexos-do-chat.js), do bucket chat-anexos e do CHECK CK_ANEXOMENSAGEM_DSMIME.';
revoke all on function private."FC_CHAT_TIPOS_ANEXO"() from public, anon, authenticated;

create table public."TB_ANEXO_MENSAGEM" (
  "CO_ANEXO_MENSAGEM" uuid not null,
  "CO_MENSAGEM" uuid not null,
  "CO_CONVERSA" uuid not null,
  "CO_USUARIO_INCLUSAO" uuid not null,
  "NO_ARQUIVO" varchar(200) not null,
  "DS_CAMINHO" varchar(200) not null,
  "DS_MIME" varchar(100) not null,
  "QT_BYTES" integer not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "ST_REGISTRO_ATIVO" varchar(1) not null default 'S',
  constraint "PK_TB_ANEXO_MENSAGEM" primary key ("CO_ANEXO_MENSAGEM"),
  constraint "FK_MENSAGEM_ANEXOMENSAGEM" foreign key ("CO_MENSAGEM") references public."TB_MENSAGEM" ("CO_MENSAGEM"),
  constraint "FK_CONVERSA_ANEXOMENSAGEM" foreign key ("CO_CONVERSA") references public."TB_CONVERSA" ("CO_CONVERSA"),
  constraint "CK_ANEXOMENSAGEM_NOARQUIVO" check (length(btrim("NO_ARQUIVO")) between 1 and 200),
  constraint "CK_ANEXOMENSAGEM_DSCAMINHO" check ("DS_CAMINHO" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$'),
  constraint "CK_ANEXOMENSAGEM_DSMIME" check ("DS_MIME" in (
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.spreadsheet')),
  constraint "CK_ANEXOMENSAGEM_QTBYTES" check ("QT_BYTES" between 1 and 10485760),
  constraint "CK_ANEXOMENSAGEM_STREGATIVO" check ("ST_REGISTRO_ATIVO" in ('S', 'N'))
);
create index "IN_ANEXOMENSAGEM_MENSAGEM" on public."TB_ANEXO_MENSAGEM" ("CO_MENSAGEM");
create index "IN_ANEXOMENSAGEM_DSCAMINHO" on public."TB_ANEXO_MENSAGEM" ("DS_CAMINHO");
create index "IN_ANEXOMENSAGEM_CONVERSA" on public."TB_ANEXO_MENSAGEM" ("CO_CONVERSA");
comment on table public."TB_ANEXO_MENSAGEM" is
  'Anexos das mensagens do chat: o arquivo fica no bucket privado chat-anexos; aqui, o nome original, o tipo e o tamanho lidos do Storage. Encaminhar copia a linha para o mesmo objeto. Apagar a mensagem desliga a linha; a retenção e o "Zerar" apagam de fato (o objeto vai para TB_EXPURGO_ANEXO_CHAT). Escrita só pelas RPCs *_chat.';
comment on column public."TB_ANEXO_MENSAGEM"."CO_ANEXO_MENSAGEM" is 'Identificador do anexo (no envio, o uuid do nome do objeto no Storage).';
comment on column public."TB_ANEXO_MENSAGEM"."CO_MENSAGEM" is 'Mensagem do anexo (TB_MENSAGEM).';
comment on column public."TB_ANEXO_MENSAGEM"."CO_CONVERSA" is 'Conversa da mensagem (cópia de TB_MENSAGEM.CO_CONVERSA), para a política do Storage.';
comment on column public."TB_ANEXO_MENSAGEM"."CO_USUARIO_INCLUSAO" is 'Quem anexou ou encaminhou (auth.users.id).';
comment on column public."TB_ANEXO_MENSAGEM"."NO_ARQUIVO" is 'Nome original do arquivo, para mostrar e baixar (1 a 200 caracteres). Não vai para o caminho.';
comment on column public."TB_ANEXO_MENSAGEM"."DS_CAMINHO" is 'Objeto no bucket chat-anexos: <conversa de origem>/<uuid>.<extensão>. Mais de uma linha aponta para o mesmo objeto quando a mensagem foi encaminhada.';
comment on column public."TB_ANEXO_MENSAGEM"."DS_MIME" is 'Tipo do arquivo, lido do Storage (FC_CHAT_TIPOS_ANEXO).';
comment on column public."TB_ANEXO_MENSAGEM"."QT_BYTES" is 'Tamanho em bytes, lido do Storage (até 10 MB).';
comment on column public."TB_ANEXO_MENSAGEM"."DT_CRIACAO" is 'Quando o anexo foi registrado.';
comment on column public."TB_ANEXO_MENSAGEM"."ST_REGISTRO_ATIVO" is 'S: abre para quem lê a conversa. N: a mensagem foi apagada (ninguém baixa).';
comment on constraint "PK_TB_ANEXO_MENSAGEM" on public."TB_ANEXO_MENSAGEM" is 'Identificador do anexo.';
comment on constraint "FK_MENSAGEM_ANEXOMENSAGEM" on public."TB_ANEXO_MENSAGEM" is 'Mensagem do anexo. Sem cascata: a retenção apaga o anexo antes da mensagem.';
comment on constraint "FK_CONVERSA_ANEXOMENSAGEM" on public."TB_ANEXO_MENSAGEM" is 'Conversa do anexo (a mesma da mensagem).';
comment on constraint "CK_ANEXOMENSAGEM_NOARQUIVO" on public."TB_ANEXO_MENSAGEM" is 'Nome com 1 a 200 caracteres.';
comment on constraint "CK_ANEXOMENSAGEM_DSCAMINHO" on public."TB_ANEXO_MENSAGEM" is 'Caminho <uuid da conversa>/<uuid>.<extensão>, sem o nome original.';
comment on constraint "CK_ANEXOMENSAGEM_DSMIME" on public."TB_ANEXO_MENSAGEM" is 'PDF, imagem ou planilha (FC_CHAT_TIPOS_ANEXO).';
comment on constraint "CK_ANEXOMENSAGEM_QTBYTES" on public."TB_ANEXO_MENSAGEM" is 'De 1 byte a 10 MB (o limite do bucket).';
comment on constraint "CK_ANEXOMENSAGEM_STREGATIVO" on public."TB_ANEXO_MENSAGEM" is 'Flag S/N.';
comment on index public."IN_ANEXOMENSAGEM_MENSAGEM" is 'Anexos de uma mensagem.';
comment on index public."IN_ANEXOMENSAGEM_DSCAMINHO" is 'Linhas que apontam para um objeto (política do Storage e contagem de referências).';
comment on index public."IN_ANEXOMENSAGEM_CONVERSA" is 'Anexos de uma conversa.';
alter table public."TB_ANEXO_MENSAGEM" enable row level security;
revoke all on public."TB_ANEXO_MENSAGEM" from public, anon, authenticated;

create table public."TB_EXPURGO_ANEXO_CHAT" (
  "DS_CAMINHO" varchar(200) not null,
  "TP_ORIGEM" varchar(8) not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_EXPURGO" timestamptz,
  constraint "PK_TB_EXPURGO_ANEXO_CHAT" primary key ("DS_CAMINHO"),
  constraint "CK_EXPURGOANEXO_TPORIGEM" check ("TP_ORIGEM" in ('RETENCAO', 'ORFAO')),
  constraint "CK_EXPURGOANEXO_DSCAMINHO" check ("DS_CAMINHO" ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$')
);
comment on table public."TB_EXPURGO_ANEXO_CHAT" is
  'Fila de objetos do bucket chat-anexos a tirar do Storage: os da retenção e do "Zerar" (sem nenhuma linha em TB_ANEXO_MENSAGEM) e os enviados e nunca anexados. Só o caminho (uuid), nunca nome ou conteúdo. O Storage não aceita DELETE pelo SQL: a seção Configurações › Mensagens (chat) do administrador global remove pela API e confirma.';
comment on column public."TB_EXPURGO_ANEXO_CHAT"."DS_CAMINHO" is 'Objeto no bucket chat-anexos (<conversa>/<uuid>.<extensão>).';
comment on column public."TB_EXPURGO_ANEXO_CHAT"."TP_ORIGEM" is 'RETENCAO (a retenção ou o "Zerar" apagaram as mensagens) ou ORFAO (enviado e nunca anexado, mais de 1 dia).';
comment on column public."TB_EXPURGO_ANEXO_CHAT"."DT_CRIACAO" is 'Quando o objeto entrou na fila.';
comment on column public."TB_EXPURGO_ANEXO_CHAT"."DT_EXPURGO" is 'Quando o objeto saiu do Storage (confirmado). Nula: ainda na fila.';
comment on constraint "PK_TB_EXPURGO_ANEXO_CHAT" on public."TB_EXPURGO_ANEXO_CHAT" is 'Um registro por objeto.';
comment on constraint "CK_EXPURGOANEXO_TPORIGEM" on public."TB_EXPURGO_ANEXO_CHAT" is 'Origens válidas.';
comment on constraint "CK_EXPURGOANEXO_DSCAMINHO" on public."TB_EXPURGO_ANEXO_CHAT" is 'Caminho no formato do bucket (só uuids).';
alter table public."TB_EXPURGO_ANEXO_CHAT" enable row level security;
revoke all on public."TB_EXPURGO_ANEXO_CHAT" from public, anon, authenticated;

create table public."TB_STATUS_PRESENCA_CHAT" (
  "CO_USUARIO" uuid not null,
  "TP_STATUS" varchar(10) not null default 'DISPONIVEL',
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_STATUS_PRESENCA_CHAT" primary key ("CO_USUARIO"),
  constraint "CK_STATUSPRESENCA_TPSTATUS" check ("TP_STATUS" in ('DISPONIVEL', 'OCUPADO', 'AUSENTE'))
);
comment on table public."TB_STATUS_PRESENCA_CHAT" is
  'Status escolhido pela pessoa no chat (Disponível, Ocupado ou Ausente), além do online automático (TB_PRESENCA_ONLINE_MONITORA). Sem linha: Disponível. Escrita só por definir_status_chat.';
comment on column public."TB_STATUS_PRESENCA_CHAT"."CO_USUARIO" is 'A pessoa (auth.users.id).';
comment on column public."TB_STATUS_PRESENCA_CHAT"."TP_STATUS" is 'DISPONIVEL, OCUPADO ou AUSENTE.';
comment on column public."TB_STATUS_PRESENCA_CHAT"."DT_ATUALIZACAO" is 'Quando a pessoa mudou o status.';
comment on constraint "PK_TB_STATUS_PRESENCA_CHAT" on public."TB_STATUS_PRESENCA_CHAT" is 'Um status por pessoa.';
comment on constraint "CK_STATUSPRESENCA_TPSTATUS" on public."TB_STATUS_PRESENCA_CHAT" is 'Status válidos.';
alter table public."TB_STATUS_PRESENCA_CHAT" enable row level security;
revoke all on public."TB_STATUS_PRESENCA_CHAT" from public, anon, authenticated;

-- 3. Quem pode (peças internas) ---------------------------------------------------------
create function private."FC_CHAT_PARTICIPA"(p_conversa uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public."RL_CONVERSA_PARTICIPANTE" p
     where p."CO_CONVERSA" = p_conversa
       and p."CO_USUARIO" = (select auth.uid())
       and p."DT_SAIDA" is null);
$function$;
comment on function private."FC_CHAT_PARTICIPA"(uuid) is
  'Quem está logado participa (sem saída) da conversa? Para o Visto: só participante vê a leitura dos outros.';

create function private."FC_CHAT_PODE_ANEXAR"(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  -- CASE: o uuid só é lido depois de o formato conferir.
  select case
           when coalesce(p_caminho, '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|jpeg|webp|gif|csv|xlsx|xls|ods)$'
             then private."FC_CHAT_PODE_LER"(split_part(p_caminho, '/', 1)::uuid)
           else false
         end;
$function$;
comment on function private."FC_CHAT_PODE_ANEXAR"(text) is
  'Política de envio do bucket chat-anexos: o caminho é <conversa>/<uuid>.<extensão aceita> e quem envia lê a conversa (FC_CHAT_PODE_LER).';

create function private."FC_CHAT_PODE_BAIXAR_ANEXO"(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public."TB_ANEXO_MENSAGEM" a
     where a."DS_CAMINHO" = p_caminho
       and a."ST_REGISTRO_ATIVO" = 'S'
       and private."FC_CHAT_PODE_LER"(a."CO_CONVERSA"));
$function$;
comment on function private."FC_CHAT_PODE_BAIXAR_ANEXO"(text) is
  'Política de leitura do bucket chat-anexos (é ela que libera a URL assinada): o objeto é anexo ativo de uma conversa que quem pede lê.';

create function private."FC_CHAT_PODE_EXPURGAR"(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_master()
     and exists (select 1 from public."TB_EXPURGO_ANEXO_CHAT" e
                  where e."DS_CAMINHO" = p_caminho and e."DT_EXPURGO" is null)
     and not exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = p_caminho);
$function$;
comment on function private."FC_CHAT_PODE_EXPURGAR"(text) is
  'Política de exclusão do bucket chat-anexos: só o administrador global, só objeto na fila de expurgo e sem nenhuma linha de anexo.';

create function private."FC_CHAT_ACABOU_DE_ENVIAR"(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private."FC_CHAT_PODE_ANEXAR"(p_caminho)
     and not exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = p_caminho)
     and not exists (select 1 from public."TB_EXPURGO_ANEXO_CHAT" e where e."DS_CAMINHO" = p_caminho);
$function$;
comment on function private."FC_CHAT_ACABOU_DE_ENVIAR"(text) is
  'Política de leitura do bucket chat-anexos, a porta de quem acabou de enviar (o upload devolve a linha): o arquivo ainda não foi anexado a nenhuma mensagem nem está na fila de expurgo, e quem pede ainda lê a conversa. O dono e os 10 minutos ficam na política.';

revoke all on function private."FC_CHAT_PARTICIPA"(uuid), private."FC_CHAT_PODE_ANEXAR"(text),
  private."FC_CHAT_ACABOU_DE_ENVIAR"(text), private."FC_CHAT_PODE_BAIXAR_ANEXO"(text), private."FC_CHAT_PODE_EXPURGAR"(text)
  from public, anon;
-- As políticas (da tabela e do Storage) rodam como authenticated: precisam executar.
grant execute on function private."FC_CHAT_PARTICIPA"(uuid), private."FC_CHAT_PODE_ANEXAR"(text),
  private."FC_CHAT_ACABOU_DE_ENVIAR"(text), private."FC_CHAT_PODE_BAIXAR_ANEXO"(text), private."FC_CHAT_PODE_EXPURGAR"(text)
  to authenticated;

-- Visto: a leitura dos outros só para quem participa.
drop policy "PL_CONVPARTICIP_LEITURA" on public."RL_CONVERSA_PARTICIPANTE";
create policy "PL_CONVPARTICIP_LEITURA" on public."RL_CONVERSA_PARTICIPANTE"
  for select to authenticated
  using (private."FC_CHAT_PODE_LER"("CO_CONVERSA")
         and ("CO_USUARIO" = (select auth.uid()) or private."FC_CHAT_PARTICIPA"("CO_CONVERSA")));
comment on policy "PL_CONVPARTICIP_LEITURA" on public."RL_CONVERSA_PARTICIPANTE" is
  'A própria linha (de conversa que a pessoa lê) e as linhas das conversas em que ela participa (Visto). Quem só vê o edital não vê a leitura dos outros.';

-- 4. Storage: bucket privado e políticas -------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-anexos', 'chat-anexos', false, 10485760, private."FC_CHAT_TIPOS_ANEXO"())
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_anexos_storage_insert on storage.objects;
create policy chat_anexos_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'chat-anexos' and private."FC_CHAT_PODE_ANEXAR"(name));
comment on policy chat_anexos_storage_insert on storage.objects is
  'Anexos do chat: envia quem lê a conversa do caminho <conversa>/<uuid>.<extensão>. Sem update: nada se sobrescreve.';

drop policy if exists chat_anexos_storage_select on storage.objects;
create policy chat_anexos_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-anexos'
  and (
    private."FC_CHAT_PODE_BAIXAR_ANEXO"(name)
    or (owner_id = (select auth.uid())::text
        and created_at > now() - interval '10 minutes'
        and private."FC_CHAT_ACABOU_DE_ENVIAR"(name))
    or private."FC_CHAT_PODE_EXPURGAR"(name)
  )
);
comment on policy chat_anexos_storage_select on storage.objects is
  'Anexos do chat: lê (e gera URL assinada) quem lê uma conversa com o anexo ativo; quem acabou de enviar o próprio arquivo e ainda não o anexou (10 minutos); e o administrador global, para expurgar o que está na fila.';

drop policy if exists chat_anexos_storage_delete on storage.objects;
create policy chat_anexos_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'chat-anexos' and private."FC_CHAT_PODE_EXPURGAR"(name));
comment on policy chat_anexos_storage_delete on storage.objects is
  'Anexos do chat: só o administrador global apaga, e só objeto na fila de expurgo (TB_EXPURGO_ANEXO_CHAT) sem linha de anexo.';

-- 5. Validações e leitura em JSON ----------------------------------------------------------
create or replace function private."FC_CHAT_VALIDAR_LINK"(p_link jsonb)
returns jsonb
language plpgsql
immutable
set search_path to ''
as $function$
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
comment on function private."FC_CHAT_VALIDAR_LINK"(jsonb) is
  'Link interno da tela (cartão): só {view, area?, secao?, edital?: {id, titulo?}, ficha?: {id?, codigo}, rotulo?}, em formato de código (nunca URL); view com letras, _ e -; ficha só com edital. Fora disso, 22023. Espelho de linkDaTela (src/lib/chat.js).';

create function private."FC_CHAT_SEM_ACENTO"(p_texto text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select translate(lower(coalesce(p_texto, '')),
                   'áàâãäéèêëíìîïóòôõöúùûüçñ',
                   'aaaaaeeeeiiiiooooouuuucn');
$function$;
comment on function private."FC_CHAT_SEM_ACENTO"(text) is
  'Texto em minúsculas e sem acento (troca letra por letra: o tamanho não muda), para a busca das mensagens.';

create function private."FC_CHAT_TRECHO"(p_texto text, p_termo text)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
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
comment on function private."FC_CHAT_TRECHO"(text, text) is
  'Trecho de até 140 caracteres em volta da primeira ocorrência do termo (sem acento), com reticências: o contexto do resultado da busca.';

revoke all on function private."FC_CHAT_SEM_ACENTO"(text), private."FC_CHAT_TRECHO"(text, text)
  from public, anon, authenticated;

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
         and po.seen_at > timezone('utc', now()) - interval '2 minutes'),
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
comment on function private."FC_CHAT_PESSOA"(uuid) is
  'Nome, foto, se está online (presença dos últimos 2 minutos) e o status escolhido (DISPONIVEL, OCUPADO ou AUSENTE; sem escolha, DISPONIVEL) de uma pessoa do chat.';

create function private."FC_CHAT_ANEXOS_JSON"(p_mensagem uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a."CO_ANEXO_MENSAGEM",
           'nome', a."NO_ARQUIVO",
           'mime', a."DS_MIME",
           'bytes', a."QT_BYTES",
           'caminho', a."DS_CAMINHO") order by a."DT_CRIACAO", a."CO_ANEXO_MENSAGEM"), '[]'::jsonb)
    from public."TB_ANEXO_MENSAGEM" a
   where a."CO_MENSAGEM" = p_mensagem and a."ST_REGISTRO_ATIVO" = 'S';
$function$;
comment on function private."FC_CHAT_ANEXOS_JSON"(uuid) is
  'Anexos ativos de uma mensagem: [{id, nome, mime, bytes, caminho}] (o caminho só abre pela política do bucket).';
revoke all on function private."FC_CHAT_ANEXOS_JSON"(uuid) from public, anon, authenticated;

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
comment on function private."FC_CHAT_MENSAGEM_JSON"(uuid) is
  'Uma mensagem no formato da tela: texto, cartão (link), menções, reações, anexos ativos, se é encaminhada e a citação (resposta: id, autor, começo do texto). Apagada: sem anexos e sem reações.';

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
comment on function private."FC_CHAT_CONVERSA_JSON"(uuid, uuid) is
  'Uma conversa como a pessoa a vê: tipo, nome, edital, participantes (online, status e — só para quem participa — a última leitura de cada um), não lidas, menções, silenciada, fixada, marcada como não lida, limpa_em e a última mensagem (com a contagem de anexos), tudo depois da limpeza dela.';

-- 6. RPCs de leitura (corpo novo ou nova) ----------------------------------------------------
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
comment on function public.listar_conversas_chat() is
  'Conversas de quem está logado (participa e pode ler): as fixadas primeiro, depois da mais recente para a mais antiga, com não lidas, a última mensagem e o status escolhido pela pessoa (meu_status). Exige o recurso chat.';

create function public.obter_mensagem_chat(p_mensagem uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
comment on function public.obter_mensagem_chat(uuid) is
  'Uma mensagem no formato da tela (com anexos e citação), para completar o que o Realtime entrega só como linha. Exige poder ler a conversa; o que a pessoa limpou volta nulo.';
revoke all on function public.obter_mensagem_chat(uuid) from public, anon;
grant execute on function public.obter_mensagem_chat(uuid) to authenticated, service_role;

create function public.buscar_mensagens_chat(p_termo text, p_limite integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
comment on function public.buscar_mensagens_chat(text, integer) is
  'Procura o termo (2 a 100 caracteres, sem diferenciar maiúsculas e acentos) no texto e no nome dos anexos das conversas de quem pergunta (participa, pode ler — FC_CHAT_PODE_LER — e depois da limpeza dela), fora as apagadas; até p_limite (no máximo 50), das mais novas, com o trecho em volta. Termo curto: 22023.';
revoke all on function public.buscar_mensagens_chat(text, integer) from public, anon;
grant execute on function public.buscar_mensagens_chat(text, integer) to authenticated, service_role;

-- 7. RPCs de escrita -------------------------------------------------------------------------
drop function public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid);

create function public.enviar_mensagem_chat(
  p_conversa uuid,
  p_texto text,
  p_link_tela jsonb default null,
  p_mencoes uuid[] default null,
  p_mensagem uuid default null,
  p_resposta uuid default null,
  p_anexos jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid, uuid, jsonb) is
  'Envia uma mensagem: texto até 4.000 caracteres (vazio só com anexo ou cartão), link interno da tela opcional (FC_CHAT_VALIDAR_LINK), menções (só participantes), id gerado no navegador (reenviar não duplica), a mensagem citada (p_resposta, da mesma conversa) e até 5 anexos (p_anexos: [{caminho, nome}] já enviados ao bucket chat-anexos por quem envia; tipo e tamanho lidos do Storage). Exige poder ler a conversa; na do edital, quem escreve passa a participar.';
revoke all on function public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid, uuid, jsonb) from public, anon;
grant execute on function public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid, uuid, jsonb) to authenticated, service_role;

create function public.encaminhar_mensagem_chat(p_mensagem uuid, p_conversa uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.encaminhar_mensagem_chat(uuid, uuid) is
  'Encaminha uma mensagem para outra conversa: copia texto, cartão e anexos ativos (mesmo objeto do Storage), sem menções e sem dizer de onde veio (ST_ENCAMINHADA = S). Exige ler as duas conversas (42501); apagada não se encaminha (22023).';
revoke all on function public.encaminhar_mensagem_chat(uuid, uuid) from public, anon;
grant execute on function public.encaminhar_mensagem_chat(uuid, uuid) to authenticated, service_role;

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
comment on function public.apagar_mensagem_chat(uuid) is
  'Apaga a própria mensagem (lógico: fica "mensagem apagada", sem texto, link, menções e anexos — os anexos ficam desligados e ninguém mais baixa; o arquivo sai com a retenção). Só o autor (42501). Apagar de novo devolve a mesma.';

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
     set "DT_ULTIMA_LEITURA" = greatest(coalesce("DT_ULTIMA_LEITURA", v_ate), v_ate),
         "ST_NAO_LIDA" = 'N'
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid
  returning "DT_ULTIMA_LEITURA" into v_lida;
  return jsonb_build_object('conversa', p_conversa, 'lida_em', v_lida);
end;
$function$;
comment on function public.marcar_conversa_lida_chat(uuid, timestamptz) is
  'Marca a conversa como lida até p_ate (a última mensagem vista; padrão: agora) e tira a marca de não lida. A leitura só avança.';

create function public.marcar_nao_lida_chat(p_conversa uuid)
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
     set "ST_NAO_LIDA" = 'S'
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid and "DT_SAIDA" is null;
  if not found then
    raise exception 'Você não acompanha esta conversa' using errcode = '22023';
  end if;
  return private."FC_CHAT_CONVERSA_JSON"(p_conversa, v_uid);
end;
$function$;
comment on function public.marcar_nao_lida_chat(uuid) is
  'Marca a conversa como não lida para quem está logado (ST_NAO_LIDA = S; ler a conversa desmarca). Só quem acompanha a conversa (22023).';
revoke all on function public.marcar_nao_lida_chat(uuid) from public, anon;
grant execute on function public.marcar_nao_lida_chat(uuid) to authenticated, service_role;

create function public.fixar_conversa_chat(p_conversa uuid, p_fixada boolean)
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
     set "DT_FIXACAO" = case when coalesce(p_fixada, false) then clock_timestamp() end
   where "CO_CONVERSA" = p_conversa and "CO_USUARIO" = v_uid and "DT_SAIDA" is null;
  if not found then
    raise exception 'Você não acompanha esta conversa' using errcode = '22023';
  end if;
  return private."FC_CHAT_CONVERSA_JSON"(p_conversa, v_uid);
end;
$function$;
comment on function public.fixar_conversa_chat(uuid, boolean) is
  'Fixa (ou solta) a conversa no topo da lista de quem está logado (DT_FIXACAO). Só quem acompanha a conversa (22023).';
revoke all on function public.fixar_conversa_chat(uuid, boolean) from public, anon;
grant execute on function public.fixar_conversa_chat(uuid, boolean) to authenticated, service_role;

create function public.definir_status_chat(p_status text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
comment on function public.definir_status_chat(text) is
  'Define o status de quem está logado no chat: DISPONIVEL, OCUPADO ou AUSENTE (fora disso, 22023). Os outros veem ao lado do online automático.';
revoke all on function public.definir_status_chat(text) from public, anon;
grant execute on function public.definir_status_chat(text) to authenticated, service_role;

-- 8. Retenção: anexos saem com as mensagens (mesmas assinaturas) --------------------------------
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
comment on function private."FC_CHAT_APAGAR_MENSAGENS"(timestamptz) is
  'Exclusão real das mensagens enviadas antes de p_antes (nulo: todas), das reações e dos anexos delas; o objeto do Storage sem nenhuma linha restante entra em TB_EXPURGO_ANEXO_CHAT. Devolve {mensagens, reacoes, anexos}. Sem checagem de quem pede: só as RPCs de retenção e a tarefa diária chamam.';

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
  if (v_apagou->>'mensagens')::int > 0 or (v_apagou->>'reacoes')::int > 0 or (v_apagou->>'anexos')::int > 0 then
    insert into public."TH_LIMPEZA_CHAT"
      ("TP_LIMPEZA", "TP_ORIGEM", "QT_DIAS_RETENCAO", "DT_CORTE", "QT_MENSAGEM_APAGADA", "QT_REACAO_APAGADA", "QT_ANEXO_APAGADO")
    values ('PRAZO', 'AGENDA', v_dias, v_corte, (v_apagou->>'mensagens')::int, (v_apagou->>'reacoes')::int,
            (v_apagou->>'anexos')::int);
  end if;
  return v_apagou;
end;
$function$;
comment on function private."FC_CHAT_RETENCAO_DIARIA"() is
  'Tarefa diária (agsus_chat_retencao_diaria): aplica o prazo de TB_RETENCAO_CHAT (mensagens, reações e anexos) e registra em TH_LIMPEZA_CHAT quando apagou algo. Prazo nulo: não faz nada.';

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
comment on function public.obter_retencao_chat() is
  'Configurações › Mensagens (chat), só administrador global (42501): prazo de retenção (nulo = para sempre), quem mudou, contagens (mensagens, reações, anexos, arquivos na fila de expurgo, conversas, conversas sem participante ativo), a mensagem mais antiga, idades [{dias, mensagens}] das que têm mais de 7 dias e as últimas 50 limpezas (com os anexos apagados).';

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
comment on function public.salvar_retencao_chat(integer, text) is
  'Define o prazo de retenção das mensagens do chat (nulo = guardar para sempre; senão 7 a 3.650 dias) com motivo (3 a 500). Com prazo, apaga de fato na hora as mensagens mais antigas, as reações e os anexos delas (os arquivos vão para a fila de expurgo). Registra em TH_LIMPEZA_CHAT. Só administrador global (42501); fora das faixas, 22023. Devolve obter_retencao_chat().';

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
    ("TP_LIMPEZA", "TP_ORIGEM", "QT_DIAS_RETENCAO", "QT_MENSAGEM_APAGADA", "QT_REACAO_APAGADA", "QT_ANEXO_APAGADO",
     "QT_CONVERSA_APAGADA", "DS_MOTIVO", "CO_USUARIO_RESPONSAVEL", "DS_EMAIL_RESPONSAVEL")
  values ('ZERAR', 'ADMIN', v_dias, (v_apagou->>'mensagens')::int, (v_apagou->>'reacoes')::int,
          (v_apagou->>'anexos')::int, cardinality(v_conversas), v_motivo, v_uid, v_email);

  return public.obter_retencao_chat();
end;
$function$;
comment on function public.zerar_mensagens_chat(text, text, boolean) is
  'Apaga de fato TODAS as mensagens, reações e anexos do chat (os arquivos vão para a fila de expurgo); com p_incluir_conversas, também as conversas sem mensagem e sem participante ativo. p_confirmacao precisa ser exatamente ZERAR e o motivo ter 3 a 500 caracteres (22023). Registra em TH_LIMPEZA_CHAT. Só administrador global (42501). Não há como desfazer. Devolve obter_retencao_chat().';

-- 9. Expurgo dos arquivos (o Storage só apaga pela API) -----------------------------------------
create function public.preparar_expurgo_anexos_chat()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN"();
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
comment on function public.preparar_expurgo_anexos_chat() is
  'Só administrador global (42501): põe na fila os arquivos enviados e nunca anexados (mais de 1 dia) e devolve até 100 caminhos da fila para a tela remover pela API do Storage (a política de exclusão só aceita o que está na fila).';
revoke all on function public.preparar_expurgo_anexos_chat() from public, anon;
grant execute on function public.preparar_expurgo_anexos_chat() to authenticated, service_role;

create function public.confirmar_expurgo_anexos_chat(p_caminhos text[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN"();
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
comment on function public.confirmar_expurgo_anexos_chat(text[]) is
  'Só administrador global (42501): marca como expurgados os caminhos da fila que já não existem no Storage (o que ainda existe continua na fila). Devolve {confirmados, pendentes}.';
revoke all on function public.confirmar_expurgo_anexos_chat(text[]) from public, anon;
grant execute on function public.confirmar_expurgo_anexos_chat(text[]) to authenticated, service_role;

notify pgrst, 'reload schema';

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Estrutura: tabelas novas com RLS e sem grant, bucket privado, políticas e assinaturas.
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['TB_ANEXO_MENSAGEM', 'TB_EXPURGO_ANEXO_CHAT', 'TB_STATUS_PRESENCA_CHAT'] loop
    if not (select c.relrowsecurity from pg_class c where c.oid = format('public.%I', v_tabela)::regclass) then
      raise exception 'FALHOU E1: % sem RLS', v_tabela;
    end if;
    if has_table_privilege('authenticated', format('public.%I', v_tabela), 'select')
       or has_table_privilege('anon', format('public.%I', v_tabela), 'select') then
      raise exception 'FALHOU E1: grant direto em %', v_tabela;
    end if;
  end loop;
  if not exists (select 1 from storage.buckets b where b.id = 'chat-anexos' and b.public = false and b.file_size_limit = 10485760) then
    raise exception 'FALHOU E1: bucket chat-anexos não é privado de 10 MB';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
        and policyname in ('chat_anexos_storage_insert', 'chat_anexos_storage_select', 'chat_anexos_storage_delete')) <> 3
     or exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                  and policyname like 'chat_anexos%' and cmd = 'UPDATE') then
    raise exception 'FALHOU E1: políticas do bucket (insert, select, delete; sem update)';
  end if;
  if to_regprocedure('public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid)') is not null
     or to_regprocedure('public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid, uuid, jsonb)') is null then
    raise exception 'FALHOU E1: enviar_mensagem_chat com a assinatura errada';
  end if;
  if has_function_privilege('anon', 'public.buscar_mensagens_chat(text, integer)', 'execute')
     or has_function_privilege('anon', 'public.preparar_expurgo_anexos_chat()', 'execute') then
    raise exception 'FALHOU E1: anon executa RPC nova';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'TH_LIMPEZA_CHAT'
                and column_name in ('DS_CAMINHO', 'NO_ARQUIVO', 'DS_TEXTO')) then
    raise exception 'FALHOU E1: a auditoria guarda nome ou caminho de anexo';
  end if;
  raise notice 'ok E1: tabelas com RLS e sem grant, bucket privado de 10 MB, 3 políticas, assinatura nova, auditoria sem conteúdo';
end;
$$;

-- E2. Atores sintéticos (somem no rollback): Ana, Bruno e Carla com o chat; Diana, administradora global.
do $$
begin
  insert into public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "DS_GRUPO_ACESSO", "ST_SISTEMA", "ST_ADMIN_GLOBAL", "NU_ORDEM")
  values ('ensaio_chat_dois', 'Ensaio chat v2', 'Grupo do ensaio, só com o chat.', false, false, 997);
  insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
  values ('ensaio_chat_dois', 'chat', 'leitor')
  on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do update set "TP_NIVEL" = 'leitor';
  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000e201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.chatv2.a@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.chatv2.b@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.chatv2.c@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e204', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.chatv2.d@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000e201', 'ensaio.chatv2.a@ensaio.invalid', 'Ensaio Ana', 'ensaio_chat_dois', true),
    ('00000000-0000-4000-a000-00000000e202', 'ensaio.chatv2.b@ensaio.invalid', 'Ensaio Bruno', 'ensaio_chat_dois', true),
    ('00000000-0000-4000-a000-00000000e203', 'ensaio.chatv2.c@ensaio.invalid', 'Ensaio Carla', 'ensaio_chat_dois', true),
    ('00000000-0000-4000-a000-00000000e204', 'ensaio.chatv2.d@ensaio.invalid', 'Ensaio Diana', 'admin', true);
  raise notice 'ok E2: Ana, Bruno e Carla (chat = leitor) e Diana (administradora global)';
end;
$$;

-- E3. Conversas, resposta e recusas do envio.
set local role authenticated;
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  u_b constant uuid := '00000000-0000-4000-a000-00000000e202';
  v_direta uuid;
  v_grupo uuid;
  v_m1 uuid;
  v jsonb;
  v_n integer := 0;
begin
  perform set_config('request.jwt.claims', c_a, true);
  v_direta := (public.abrir_conversa_direta_chat(u_b)->>'id')::uuid;
  v_grupo := (public.criar_grupo_chat('Grupo do ensaio v2', array[u_b])->>'id')::uuid;
  v_m1 := (public.enviar_mensagem_chat(v_direta, 'Relatório final do ensaio')->>'id')::uuid;
  v := public.enviar_mensagem_chat(v_direta, 'Respondendo', p_resposta => v_m1);
  if (v->'resposta'->>'id')::uuid is distinct from v_m1 or v->'resposta'->>'texto' <> 'Relatório final do ensaio' then
    raise exception 'FALHOU E3: a resposta não traz a citação: %', v->'resposta';
  end if;
  begin perform public.enviar_mensagem_chat(v_grupo, 'Cita de outra conversa', p_resposta => v_m1); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(v_direta, '   '); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(v_direta, repeat('x', 4001)); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(v_direta, 'seis', p_anexos => '[{},{},{},{},{},{}]'::jsonb); exception when sqlstate '22023' then v_n := v_n + 1; end;
  if v_n <> 4 then
    raise exception 'FALHOU E3: só % de 4 recusas 22023 (citação de fora, vazio, longo, anexos demais)', v_n;
  end if;
  perform set_config('ensaio.direta', v_direta::text, true);
  perform set_config('ensaio.grupo', v_grupo::text, true);
  perform set_config('ensaio.m1', v_m1::text, true);
  perform set_config('ensaio.m2', v->>'id', true);
  raise notice 'ok E3: direta e grupo; resposta com a citação; 4 recusas 22023';
end;
$$;
reset role;

-- E4. Objetos sintéticos no bucket (como o upload deixaria): de Ana, de Bruno, grande demais e de tipo errado.
do $$
declare
  v_direta text := current_setting('ensaio.direta');
  v_grupo text := current_setting('ensaio.grupo');
begin
  insert into storage.objects (bucket_id, name, owner_id, metadata) values
    ('chat-anexos', v_direta || '/00000000-0000-4000-a000-0000000a0001.pdf', '00000000-0000-4000-a000-00000000e201', '{"size": 2048, "mimetype": "application/pdf"}'),
    ('chat-anexos', v_direta || '/00000000-0000-4000-a000-0000000a0002.png', '00000000-0000-4000-a000-00000000e202', '{"size": 2048, "mimetype": "image/png"}'),
    ('chat-anexos', v_direta || '/00000000-0000-4000-a000-0000000a0003.pdf', '00000000-0000-4000-a000-00000000e201', '{"size": 10485761, "mimetype": "application/pdf"}'),
    ('chat-anexos', v_direta || '/00000000-0000-4000-a000-0000000a0004.pdf', '00000000-0000-4000-a000-00000000e201', '{"size": 2048, "mimetype": "application/zip"}'),
    ('chat-anexos', v_grupo || '/00000000-0000-4000-a000-0000000a0005.png', '00000000-0000-4000-a000-00000000e201', '{"size": 4096, "mimetype": "image/png"}');
  raise notice 'ok E4: 5 objetos sintéticos no bucket';
end;
$$;

-- E5. Anexos: o envio confere dono, tamanho, tipo, conversa e reuso; as políticas leem o caminho.
set local role authenticated;
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  c_b constant text := '{"sub":"00000000-0000-4000-a000-00000000e202","role":"authenticated","email":"ensaio.chatv2.b@ensaio.invalid"}';
  c_c constant text := '{"sub":"00000000-0000-4000-a000-00000000e203","role":"authenticated","email":"ensaio.chatv2.c@ensaio.invalid"}';
  v_direta text := current_setting('ensaio.direta');
  v_grupo text := current_setting('ensaio.grupo');
  v_ok text := v_direta || '/00000000-0000-4000-a000-0000000a0001.pdf';
  v jsonb;
  v_n integer := 0;
begin
  perform set_config('request.jwt.claims', c_a, true);
  if not private."FC_CHAT_PODE_ANEXAR"(v_direta || '/00000000-0000-4000-a000-0000000a0009.xlsx')
     or private."FC_CHAT_PODE_ANEXAR"(v_direta || '/00000000-0000-4000-a000-0000000a0009.exe')
     or private."FC_CHAT_PODE_ANEXAR"('nao-e-uuid/arquivo.pdf')
     or private."FC_CHAT_PODE_ANEXAR"(v_direta || '/sub/00000000-0000-4000-a000-0000000a0009.pdf') then
    raise exception 'FALHOU E5: a política de envio não lê o caminho';
  end if;
  v := public.enviar_mensagem_chat(v_direta::uuid, '',
         p_anexos => jsonb_build_array(jsonb_build_object('caminho', v_ok, 'nome', 'Relatório de campo.pdf')));
  if jsonb_array_length(v->'anexos') <> 1 or (v->'anexos'->0->>'bytes')::int <> 2048
     or v->'anexos'->0->>'mime' <> 'application/pdf' or v->'anexos'->0->>'nome' <> 'Relatório de campo.pdf' then
    raise exception 'FALHOU E5: anexo sem os dados do Storage: %', v->'anexos';
  end if;
  perform set_config('ensaio.m3', v->>'id', true);
  begin perform public.enviar_mensagem_chat(v_direta::uuid, 'a', p_anexos => jsonb_build_array(jsonb_build_object('caminho', v_direta || '/00000000-0000-4000-a000-0000000a0002.png', 'nome', 'b.png'))); exception when sqlstate '42501' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(v_direta::uuid, 'a', p_anexos => jsonb_build_array(jsonb_build_object('caminho', v_direta || '/00000000-0000-4000-a000-0000000a0003.pdf', 'nome', 'g.pdf'))); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(v_direta::uuid, 'a', p_anexos => jsonb_build_array(jsonb_build_object('caminho', v_direta || '/00000000-0000-4000-a000-0000000a0004.pdf', 'nome', 'z.pdf'))); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(v_direta::uuid, 'a', p_anexos => jsonb_build_array(jsonb_build_object('caminho', v_ok, 'nome', 'de novo.pdf'))); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(v_direta::uuid, 'a', p_anexos => jsonb_build_array(jsonb_build_object('caminho', v_grupo || '/00000000-0000-4000-a000-0000000a0005.png', 'nome', 'outra.png'))); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(v_direta::uuid, 'a', p_anexos => jsonb_build_array(jsonb_build_object('caminho', v_direta || '/00000000-0000-4000-a000-0000000a0099.pdf', 'nome', 'sumiu.pdf'))); exception when sqlstate 'P0002' then v_n := v_n + 1; end;
  if v_n <> 6 then
    raise exception 'FALHOU E5: só % de 6 recusas (dono, tamanho, tipo, reuso, outra conversa, inexistente)', v_n;
  end if;
  if not private."FC_CHAT_PODE_BAIXAR_ANEXO"(v_ok)
     or (select count(*) from storage.objects o where o.bucket_id = 'chat-anexos' and o.name = v_ok) <> 1 then
    raise exception 'FALHOU E5: Ana não lê o próprio anexo';
  end if;
  perform set_config('request.jwt.claims', c_b, true);
  if (select count(*) from storage.objects o where o.bucket_id = 'chat-anexos' and o.name = v_ok) <> 1 then
    raise exception 'FALHOU E5: Bruno (participante) não lê o anexo';
  end if;
  perform set_config('request.jwt.claims', c_c, true);
  if private."FC_CHAT_PODE_BAIXAR_ANEXO"(v_ok)
     or private."FC_CHAT_PODE_ANEXAR"(v_direta || '/00000000-0000-4000-a000-0000000a0009.pdf')
     or (select count(*) from storage.objects o where o.bucket_id = 'chat-anexos') <> 0 then
    raise exception 'FALHOU E5: Carla (fora da conversa) lê ou envia anexo';
  end if;
  raise notice 'ok E5: anexo com tipo e tamanho do Storage; 6 recusas; participantes leem, quem está fora não lê nem envia';
end;
$$;

-- E6. Encaminhar: cópia na outra conversa com o mesmo objeto; quem não lê a origem não encaminha.
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  c_c constant text := '{"sub":"00000000-0000-4000-a000-00000000e203","role":"authenticated","email":"ensaio.chatv2.c@ensaio.invalid"}';
  v jsonb;
  v_n integer := 0;
begin
  perform set_config('request.jwt.claims', c_a, true);
  v := public.encaminhar_mensagem_chat(current_setting('ensaio.m3')::uuid, current_setting('ensaio.grupo')::uuid);
  if not (v->>'encaminhada')::boolean or jsonb_array_length(v->'anexos') <> 1
     or v->'anexos'->0->>'caminho' not like current_setting('ensaio.direta') || '/%'
     or v->>'conversa' <> current_setting('ensaio.grupo') then
    raise exception 'FALHOU E6: encaminhada sem o anexo: %', v;
  end if;
  perform set_config('ensaio.m4', v->>'id', true);
  perform set_config('request.jwt.claims', c_c, true);
  begin perform public.encaminhar_mensagem_chat(current_setting('ensaio.m3')::uuid, current_setting('ensaio.grupo')::uuid); exception when sqlstate '42501' then v_n := v_n + 1; end;
  if v_n <> 1 then
    raise exception 'FALHOU E6: Carla encaminhou de conversa que não lê';
  end if;
  raise notice 'ok E6: encaminhada com o mesmo objeto; Carla recebe 42501';
end;
$$;

-- E7. Visto: participante vê a leitura dos outros; quem só vê o edital, não.
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  c_b constant text := '{"sub":"00000000-0000-4000-a000-00000000e202","role":"authenticated","email":"ensaio.chatv2.b@ensaio.invalid"}';
  c_d constant text := '{"sub":"00000000-0000-4000-a000-00000000e204","role":"authenticated","email":"ensaio.chatv2.d@ensaio.invalid"}';
  v jsonb;
  v_edital uuid;
  v_conversa uuid;
begin
  perform set_config('request.jwt.claims', c_b, true);
  perform public.marcar_conversa_lida_chat(current_setting('ensaio.direta')::uuid, null);
  perform set_config('request.jwt.claims', c_a, true);
  v := public.listar_mensagens_chat(current_setting('ensaio.direta')::uuid, null, 50);
  if not exists (
    select 1 from jsonb_array_elements(v->'conversa'->'participantes') p
     where p->>'id' = '00000000-0000-4000-a000-00000000e202' and p->>'lida_em' is not null) then
    raise exception 'FALHOU E7: Ana não vê a leitura de Bruno';
  end if;
  if (select count(*) from public."RL_CONVERSA_PARTICIPANTE" where "CO_CONVERSA"::text = current_setting('ensaio.direta')) <> 2 then
    raise exception 'FALHOU E7: Ana não lê as linhas da conversa em que participa';
  end if;

  -- Diana vê editais: abre a conversa de um edital sem conversa, sai e continua lendo sem participar.
  perform set_config('request.jwt.claims', c_d, true);
  select m.id into v_edital
    from public."TB_MONITORAMENTO_INDIGENA" m
   where not exists (select 1 from public."TB_CONVERSA" c where c."CO_MONITORAMENTO" = m.id)
     and private."FC_PODE_VER_EDITAL"(m.id)
   limit 1;
  perform set_config('ensaio.edital_conversa', '', true);
  if v_edital is null then
    raise notice 'ok E7: participante vê a leitura (sem edital livre para conferir quem não participa)';
    return;
  end if;
  v_conversa := (public.abrir_conversa_edital_chat(v_edital)->>'id')::uuid;
  perform public.sair_conversa_chat(v_conversa);
  perform set_config('ensaio.edital_conversa', v_conversa::text, true);
  raise notice 'ok E7a: participante vê a leitura; Diana abriu e deixou a conversa de um edital';
end;
$$;
reset role;
do $$
begin
  if current_setting('ensaio.edital_conversa', true) <> '' then
    insert into public."RL_CONVERSA_PARTICIPANTE" ("CO_CONVERSA", "CO_USUARIO", "TP_PAPEL", "DT_ULTIMA_LEITURA")
    values (current_setting('ensaio.edital_conversa')::uuid, '00000000-0000-4000-a000-00000000e202', 'MEMBRO', now());
  end if;
end;
$$;
set local role authenticated;
do $$
declare
  c_d constant text := '{"sub":"00000000-0000-4000-a000-00000000e204","role":"authenticated","email":"ensaio.chatv2.d@ensaio.invalid"}';
  v jsonb;
begin
  if coalesce(current_setting('ensaio.edital_conversa', true), '') = '' then return; end if;
  perform set_config('request.jwt.claims', c_d, true);
  if (select count(*) from public."RL_CONVERSA_PARTICIPANTE"
       where "CO_CONVERSA"::text = current_setting('ensaio.edital_conversa')
         and "CO_USUARIO" <> '00000000-0000-4000-a000-00000000e204') <> 0 then
    raise exception 'FALHOU E7: quem só vê o edital lê as linhas dos participantes';
  end if;
  v := public.listar_mensagens_chat(current_setting('ensaio.edital_conversa')::uuid, null, 50);
  if not exists (select 1 from jsonb_array_elements(v->'conversa'->'participantes') p
                  where p->>'id' = '00000000-0000-4000-a000-00000000e202')
     or exists (select 1 from jsonb_array_elements(v->'conversa'->'participantes') p where p ? 'lida_em') then
    raise exception 'FALHOU E7: quem não participa recebe a leitura dos outros: %', v->'conversa'->'participantes';
  end if;
  raise notice 'ok E7b: quem só vê o edital não vê a leitura dos participantes (nem pela RLS nem pelo JSON)';
end;
$$;

-- E8. Fixar, marcar como não lida e status.
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  c_b constant text := '{"sub":"00000000-0000-4000-a000-00000000e202","role":"authenticated","email":"ensaio.chatv2.b@ensaio.invalid"}';
  c_c constant text := '{"sub":"00000000-0000-4000-a000-00000000e203","role":"authenticated","email":"ensaio.chatv2.c@ensaio.invalid"}';
  v jsonb;
  v_n integer := 0;
begin
  perform set_config('request.jwt.claims', c_a, true);
  v := public.fixar_conversa_chat(current_setting('ensaio.grupo')::uuid, true);
  if v->>'fixada_em' is null then raise exception 'FALHOU E8: não fixou'; end if;
  v := public.listar_conversas_chat();
  if v->'conversas'->0->>'id' <> current_setting('ensaio.grupo') then
    raise exception 'FALHOU E8: a fixada não vem primeiro';
  end if;
  v := public.marcar_nao_lida_chat(current_setting('ensaio.direta')::uuid);
  if not (v->>'marcada_nao_lida')::boolean then raise exception 'FALHOU E8: não marcou como não lida'; end if;
  perform public.marcar_conversa_lida_chat(current_setting('ensaio.direta')::uuid, null);
  if (select (c->>'marcada_nao_lida')::boolean from jsonb_array_elements(public.listar_conversas_chat()->'conversas') c
       where c->>'id' = current_setting('ensaio.direta')) then
    raise exception 'FALHOU E8: ler não desmarcou';
  end if;
  v := public.definir_status_chat('ocupado');
  if v->>'status' <> 'OCUPADO' or public.listar_conversas_chat()->>'meu_status' <> 'OCUPADO' then
    raise exception 'FALHOU E8: status não gravou';
  end if;
  begin perform public.definir_status_chat('invisivel'); exception when sqlstate '22023' then v_n := v_n + 1; end;
  perform set_config('request.jwt.claims', c_c, true);
  begin perform public.fixar_conversa_chat(current_setting('ensaio.grupo')::uuid, true); exception when sqlstate '42501' then v_n := v_n + 1; end;
  begin perform public.marcar_nao_lida_chat(current_setting('ensaio.grupo')::uuid); exception when sqlstate '42501' then v_n := v_n + 1; end;
  if v_n <> 3 then raise exception 'FALHOU E8: só % de 3 recusas', v_n; end if;
  perform set_config('request.jwt.claims', c_b, true);
  if not exists (select 1 from jsonb_array_elements(public.listar_mensagens_chat(current_setting('ensaio.direta')::uuid, null, 1)->'conversa'->'participantes') p
                  where p->>'id' = '00000000-0000-4000-a000-00000000e201' and p->>'status' = 'OCUPADO') then
    raise exception 'FALHOU E8: Bruno não vê o status de Ana';
  end if;
  raise notice 'ok E8: fixada primeiro; não lida e ler desmarca; status OCUPADO visto por Bruno; 3 recusas';
end;
$$;

-- E9. Busca: no texto e no nome do anexo, sem acento, com trecho; só nas conversas de quem busca.
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  c_c constant text := '{"sub":"00000000-0000-4000-a000-00000000e203","role":"authenticated","email":"ensaio.chatv2.c@ensaio.invalid"}';
  v jsonb;
  v_n integer := 0;
begin
  perform set_config('request.jwt.claims', c_a, true);
  v := public.buscar_mensagens_chat('RELATORIO final', 30);
  if not exists (select 1 from jsonb_array_elements(v->'resultados') r
                  where r->>'id' = current_setting('ensaio.m1') and r->>'trecho' like '%Relatório final%') then
    raise exception 'FALHOU E9: a busca sem acento não achou a mensagem: %', v;
  end if;
  v := public.buscar_mensagens_chat('de campo', 30);
  if not exists (select 1 from jsonb_array_elements(v->'resultados') r
                  where r->>'id' = current_setting('ensaio.m3') and r->>'anexo' = 'Relatório de campo.pdf') then
    raise exception 'FALHOU E9: a busca não achou pelo nome do anexo';
  end if;
  if jsonb_array_length(public.buscar_mensagens_chat('%_', 30)->'resultados') <> 0 then
    raise exception 'FALHOU E9: %% e _ não são literais';
  end if;
  begin perform public.buscar_mensagens_chat('a', 30); exception when sqlstate '22023' then v_n := v_n + 1; end;
  if v_n <> 1 then raise exception 'FALHOU E9: termo curto aceito'; end if;
  perform set_config('request.jwt.claims', c_c, true);
  if exists (select 1 from jsonb_array_elements(public.buscar_mensagens_chat('Relatório', 30)->'resultados') r
              where r->>'conversa' in (current_setting('ensaio.direta'), current_setting('ensaio.grupo'))) then
    raise exception 'FALHOU E9: Carla achou mensagem de conversa que não lê';
  end if;
  raise notice 'ok E9: busca sem acento no texto e no anexo, com trecho; curinga literal; Carla não acha';
end;
$$;

-- E10. Cartões: view com hífen e ficha pelo código (só com edital).
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  v jsonb;
  v_n integer := 0;
begin
  perform set_config('request.jwt.claims', c_a, true);
  v := public.enviar_mensagem_chat(current_setting('ensaio.grupo')::uuid, '',
         '{"view": "avaliacao-documental", "area": "saude-indigena", "edital": {"id": "00000000-0000-4000-a000-0000000ed001", "titulo": "93/2026"}, "ficha": {"id": "00000000-0000-4000-a000-0000000f1001", "codigo": "123456"}, "rotulo": "Candidato 123456"}'::jsonb);
  if v->'link'->'ficha'->>'codigo' <> '123456' or v->>'texto' <> '' then
    raise exception 'FALHOU E10: cartão da ficha não gravou: %', v;
  end if;
  begin perform public.enviar_mensagem_chat(current_setting('ensaio.grupo')::uuid, 'x', '{"view": "avaliacao-documental", "ficha": {"codigo": "1"}}'::jsonb); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(current_setting('ensaio.grupo')::uuid, 'x', '{"view": "avaliacao-documental", "edital": {"id": "00000000-0000-4000-a000-0000000ed001"}, "ficha": {"codigo": "1 2"}}'::jsonb); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(current_setting('ensaio.grupo')::uuid, 'x', '{"view": "https://exemplo.invalid"}'::jsonb); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.enviar_mensagem_chat(current_setting('ensaio.grupo')::uuid, 'x', '{"view": "nucleo", "url": "https://exemplo.invalid"}'::jsonb); exception when sqlstate '22023' then v_n := v_n + 1; end;
  if v_n <> 4 then raise exception 'FALHOU E10: só % de 4 recusas de link', v_n; end if;
  raise notice 'ok E10: cartão da ficha (view com hífen) sem texto; 4 links recusados';
end;
$$;

-- E11. Apagar a mensagem desliga o anexo; a cópia encaminhada continua abrindo.
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  c_b constant text := '{"sub":"00000000-0000-4000-a000-00000000e202","role":"authenticated","email":"ensaio.chatv2.b@ensaio.invalid"}';
  v_ok text := current_setting('ensaio.direta') || '/00000000-0000-4000-a000-0000000a0001.pdf';
  v jsonb;
begin
  perform set_config('request.jwt.claims', c_a, true);
  v := public.apagar_mensagem_chat(current_setting('ensaio.m3')::uuid);
  if not (v->>'apagada')::boolean or jsonb_array_length(v->'anexos') <> 0 then
    raise exception 'FALHOU E11: apagada ainda com anexo';
  end if;
  perform set_config('request.jwt.claims', c_b, true);
  if not private."FC_CHAT_PODE_BAIXAR_ANEXO"(v_ok) then
    raise exception 'FALHOU E11: a cópia encaminhada deixou de abrir';
  end if;
  raise notice 'ok E11: apagar desliga o anexo da mensagem; a cópia encaminhada ainda abre';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

-- E12. Retenção: anexos saem com as mensagens, a citação some, o objeto vai para a fila; o expurgo só pelo admin.
do $$
begin
  update public."TB_MENSAGEM" set "DT_CRIACAO" = now() - interval '40 days'
   where "CO_MENSAGEM"::text in (current_setting('ensaio.m1'), current_setting('ensaio.m3'), current_setting('ensaio.m4'));
  raise notice 'ok E12a: a mensagem citada, a do anexo e a encaminhada com 40 dias';
end;
$$;
set local role authenticated;
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  c_d constant text := '{"sub":"00000000-0000-4000-a000-00000000e204","role":"authenticated","email":"ensaio.chatv2.d@ensaio.invalid"}';
  v_ok text := current_setting('ensaio.direta') || '/00000000-0000-4000-a000-0000000a0001.pdf';
  v jsonb;
  v_n integer := 0;
begin
  perform set_config('request.jwt.claims', c_a, true);
  begin perform public.preparar_expurgo_anexos_chat(); exception when sqlstate '42501' then v_n := v_n + 1; end;
  begin perform public.confirmar_expurgo_anexos_chat(array[v_ok]); exception when sqlstate '42501' then v_n := v_n + 1; end;
  if v_n <> 2 then raise exception 'FALHOU E12: não-admin mexeu no expurgo'; end if;

  perform set_config('request.jwt.claims', c_d, true);
  v := public.salvar_retencao_chat(30, 'Ensaio v2: prazo de 30 dias');
  if (v->'historico'->0->>'anexos')::int < 2 or (v->>'expurgo_pendente')::int < 1 then
    raise exception 'FALHOU E12: a retenção não contou os anexos: %', v - 'idades';
  end if;
  if not private."FC_CHAT_PODE_EXPURGAR"(v_ok)
     or (select count(*) from storage.objects o where o.bucket_id = 'chat-anexos' and o.name = v_ok) <> 1 then
    raise exception 'FALHOU E12: Diana não pode expurgar o objeto da fila';
  end if;
  v := public.preparar_expurgo_anexos_chat();
  if not (v->'caminhos' ? v_ok) then raise exception 'FALHOU E12: o caminho não veio para o expurgo'; end if;
  if (public.confirmar_expurgo_anexos_chat(array[v_ok])->>'confirmados')::int <> 0 then
    raise exception 'FALHOU E12: confirmou expurgo de objeto que ainda existe';
  end if;
  perform set_config('request.jwt.claims', c_a, true);
  if private."FC_CHAT_PODE_EXPURGAR"(v_ok) or private."FC_CHAT_PODE_BAIXAR_ANEXO"(v_ok)
     or (select count(*) from storage.objects o where o.bucket_id = 'chat-anexos' and o.name = v_ok) <> 0 then
    raise exception 'FALHOU E12: o objeto da fila ainda abre para Ana';
  end if;
  raise notice 'ok E12b: retenção apagou os anexos e pôs o objeto na fila; só Diana expurga; ninguém mais baixa';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare
  v_ok text := current_setting('ensaio.direta') || '/00000000-0000-4000-a000-0000000a0001.pdf';
begin
  if exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = v_ok) then
    raise exception 'FALHOU E12: sobrou linha de anexo do objeto';
  end if;
  if (select "CO_MENSAGEM_RESPOSTA" from public."TB_MENSAGEM" where "CO_MENSAGEM"::text = current_setting('ensaio.m2')) is not null then
    raise exception 'FALHOU E12: a citação da mensagem apagada não sumiu';
  end if;
  -- Simula a API do Storage (no ensaio, só aqui o gatilho deixa) e confirma.
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects o where o.bucket_id = 'chat-anexos' and o.name = v_ok;
  perform set_config('storage.allow_delete_query', 'false', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000e204","role":"authenticated","email":"ensaio.chatv2.d@ensaio.invalid"}', true);
  if (public.confirmar_expurgo_anexos_chat(array[v_ok])->>'confirmados')::int <> 1 then
    raise exception 'FALHOU E12: não confirmou o expurgo do objeto removido';
  end if;
  perform set_config('request.jwt.claims', '', true);
  raise notice 'ok E12c: sem linha de anexo, citação nula; removido pela API, o expurgo confirma';
end;
$$;

-- E13. Zerar conta os anexos que restavam.
set local role authenticated;
do $$
declare
  c_a constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.chatv2.a@ensaio.invalid"}';
  c_d constant text := '{"sub":"00000000-0000-4000-a000-00000000e204","role":"authenticated","email":"ensaio.chatv2.d@ensaio.invalid"}';
  v jsonb;
begin
  perform set_config('request.jwt.claims', c_a, true);
  perform public.enviar_mensagem_chat(current_setting('ensaio.grupo')::uuid, 'print',
    p_anexos => jsonb_build_array(jsonb_build_object('caminho', current_setting('ensaio.grupo') || '/00000000-0000-4000-a000-0000000a0005.png', 'nome', 'print.png')));
  perform set_config('request.jwt.claims', c_d, true);
  v := public.zerar_mensagens_chat('ZERAR', 'Ensaio v2: zerar', true);
  if (v->'historico'->0->>'anexos')::int < 1 or (v->>'anexos')::int <> 0 or (v->>'mensagens')::int <> 0 then
    raise exception 'FALHOU E13: zerar não contou os anexos: %', v - 'idades' - 'historico';
  end if;
  raise notice 'ok E13: zerar apagou e contou os anexos';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

select 'ENSAIO OK' as resultado,
       (select count(*) from public."TB_EXPURGO_ANEXO_CHAT") as fila_de_expurgo;

rollback;
