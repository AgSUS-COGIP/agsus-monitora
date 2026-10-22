/*
  INSCRIÇÕES CONGELADAS POR EDITAL E O REGISTRO DE TODOS OS DISPAROS DOS ROBÔS

  Por quê (auditoria de 20/10/2026):
    1. O robô da Empregare em modo normal/forçar sem filtro ("Rodar agora") pega
       todo edital ativo com cronograma encerrado há até 30 dias
       (listar_vagas_empregare, 20261009140000) — incluiria o 114/2026, cujas
       inscrições acabaram em 14/10 e cujo lote não pode mudar sem autorização
       explícita. A pré-classificação "após robô" já tirou do lote uma candidata
       antes. Faltava um sinal no banco que diga "este edital não muda mais".
    2. Em TL_DISPARO_ROBO, todo pedido sem usuário virava AGENDA — inclusive os
       feitos à mão pelo SQL (private."FC_DISPARAR_ROBO" chamado direto, sem
       p_usuario): em 14–15/10 há 5 pedidos do robô e 5 da pré-classificação
       "AGENDA" fora dos horários da tarefa agsus_robo_inscricoes_114_2026
       (7h e 13h). E as execuções iniciadas direto no GitHub ("Run workflow",
       gh workflow run) não apareciam ali.

  O QUE MUDA
    A. A trava (uma linha por edital, histórico de cada mudança e de cada uso):
       public."TB_CONGELAMENTO_INSCRICAO"   ST_INSCRICOES_CONGELADAS S/N, motivo,
                                             quem e quando (estado atual)
       public."TH_CONGELAMENTO_INSCRICAO"   CONGELAR, DESCONGELAR, LIBERACAO
                                             (override do administrador global,
                                             vale 12 h) e USO (a execução que usou
                                             a liberação)
       Tabela própria, e não coluna em TB_MONITORAMENTO_INDIGENA: o edital é a
       tabela larga do Núcleo (salva com controle de versão pelo formulário) e a
       trava precisa de histórico próprio, motivo e autor; uma linha por edital,
       como TB_REGRA_AGENDA_ENTREVISTA/TH_REGRA_AGENDA_ENTREVISTA.
       obter_congelamento_inscricoes(p_edital)            quem lê a avaliação do edital
       alterar_congelamento_inscricoes(p_edital, p_congelar, p_motivo)
                                   coordenação da avaliação do edital ou administrador
                                   global (pode_recalcular_pre_classificacao), com motivo
    B. O que a trava bloqueia (com o edital congelado, sem liberação válida):
       listar_vagas_empregare(..., p_finalidade, p_liberacao)   na carga ('carga'),
           as vagas do edital saem da lista e voltam em "congeladas" (pedido = o
           edital/vaga veio explícito: o robô recusa a execução inteira); no modo
           "Só anexos" ('anexos') nada sai.
       private."FC_EMPREGARE_ABRIR_VAGA"   trava de raiz: a vaga de edital congelado
           é RECUSADA ("inscrições congeladas"), nada gravado nem desativado, salvo
           se a execução registrou o uso de uma liberação do edital (vale também
           para o robô antigo, antes do merge).
       pre_classificacao_ler_editais(..., p_incluir_congelados, p_liberacao)
           o edital congelado sai da lista (após robô, normal, refazer lote) e
           volta em "congelados"; o modo seco pede p_incluir_congelados.
       disparar_robo   recusa (55000) o pedido explícito de edital/vaga congelada
           nos modos que gravam (robô: normal/forçar; pré-classificação: normal/
           refazer lote), salvo forcar_congelado = true + motivo, só do
           administrador global: grava a LIBERACAO e manda o token ao workflow.
       O modo "anexos" (só anexos), seco, fumaça e sondar continuam permitidos.
       registrar_uso_liberacao_congelamento(p_liberacao, p_execucao)   (service_role)
           o robô e a pré-classificação registram o override na execução (USO).
    C. Os disparos:
       private."FC_DISPARAR_ROBO"(…, p_origem)   AGENDA só quando vem do pg_cron
           (p_origem = 'AGENDA' nas tarefas, ou a sessão do pg_cron); MONITORA com
           o usuário (a tela: Rodar agora, Opções, Recalcular); MANUAL quando
           alguém chama a função direto pelo SQL, sem usuário (disparado_por =
           manual). As tarefas agsus_* que chamam FC_DISPARAR_ROBO passam
           p_origem => 'AGENDA'.
       TL_DISPARO_ROBO: origens MANUAL e GITHUB, situação INICIADO, NO_ATOR_GITHUB
           e DS_URL_EXECUCAO.
       registrar_disparo_externo(p_workflow, p_ator, p_url, p_resumo)   (service_role)
           o próprio workflow registra, no início, a execução iniciada direto no
           GitHub (origem GITHUB, ator = github.triggering_actor); uma linha por
           execução (a URL). Falha aqui nunca derruba o robô.
       get_saude_das_cargas: os disparos trazem o ator e o link da execução.

  Ensaio: supabase/ensaios/20261020170000_inscricoes_congeladas.sql.
  Rollback: supabase/rollback/20261020170000_inscricoes_congeladas.sql.
  Ligar a trava do 114/2026: supabase/correcoes/20261020-congelar-inscricoes-114.sql
  (separado; só com autorização).
  Dependentes: scripts/robo-empregare/robo_empregare.py e so_anexos.py,
  scripts/pre_classificacao/pre_classificacao.py, python/monitora/disparo_externo.py,
  .github/workflows (os .yml), src/modulos/avaliacao-documental/trava-das-inscricoes.tsx,
  src/lib/robos-de-carga.js, src/lib/saude-das-cargas.ts, src/lib/rpc-contrato.js.
*/
begin;

set local lock_timeout = '10s';

do $$
begin
  if to_regprocedure('public.listar_anexos_empregare(text, text[])') is null
     or to_regprocedure('private."FC_DISPARAR_ROBO"(text, jsonb, uuid)') is null
     or to_regprocedure('public.listar_vagas_empregare(text[], text[], integer)') is null
     or to_regprocedure('public.pre_classificacao_ler_editais(text[], boolean)') is null
     or to_regprocedure('private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer)') is null then
    raise exception 'Aplique antes 20261020130000_robo_modo_anexos.sql (e as anteriores do robô e da pré-classificação).';
  end if;
end;
$$;

-- 1. A trava -------------------------------------------------------------------------------------
create table public."TB_CONGELAMENTO_INSCRICAO" (
  "CO_MONITORAMENTO" uuid not null,
  "ST_INSCRICOES_CONGELADAS" character varying(1) not null default 'N',
  "DS_MOTIVO" character varying(500) not null,
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_CONGELAMENTO_INSCRICAO" primary key ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_CONGELINSCR" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_CONGELINSCR_STCONGELADAS" check ("ST_INSCRICOES_CONGELADAS" in ('S', 'N')),
  constraint "CK_CONGELINSCR_DSMOTIVO" check (length(btrim("DS_MOTIVO")) between 10 and 500)
);
comment on table public."TB_CONGELAMENTO_INSCRICAO" is
  'Trava "inscrições congeladas" de um edital (20261020170000): com S, o robô da Empregare não exporta nem grava candidatos das vagas do edital (listar_vagas_empregare e FC_EMPREGARE_ABRIR_VAGA) e a pré-classificação não recalcula nem refaz o lote (pre_classificacao_ler_editais), salvo liberação do administrador global (TH_CONGELAMENTO_INSCRICAO, LIBERACAO). O modo "só anexos" continua. Uma linha por edital; cada mudança fica no histórico. Escrita só por alterar_congelamento_inscricoes ou correção de dados assinada.';
comment on column public."TB_CONGELAMENTO_INSCRICAO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_CONGELAMENTO_INSCRICAO"."ST_INSCRICOES_CONGELADAS" is 'S = inscrições congeladas (robô e pré-classificação não mexem); N = liberadas.';
comment on column public."TB_CONGELAMENTO_INSCRICAO"."DS_MOTIVO" is 'Motivo da última mudança (10 a 500 caracteres).';
comment on column public."TB_CONGELAMENTO_INSCRICAO"."CO_USUARIO_ATUALIZACAO" is 'Quem fez a última mudança (auth.users.id; numa correção de dados, a conta do setor).';
comment on column public."TB_CONGELAMENTO_INSCRICAO"."DT_CRIACAO" is 'Primeira vez que o edital foi congelado.';
comment on column public."TB_CONGELAMENTO_INSCRICAO"."DT_ATUALIZACAO" is 'Última mudança.';
comment on constraint "PK_TB_CONGELAMENTO_INSCRICAO" on public."TB_CONGELAMENTO_INSCRICAO" is 'Uma trava por edital.';
comment on constraint "FK_MONITORAMENTO_CONGELINSCR" on public."TB_CONGELAMENTO_INSCRICAO" is 'Edital da trava.';
comment on constraint "CK_CONGELINSCR_STCONGELADAS" on public."TB_CONGELAMENTO_INSCRICAO" is 'S ou N.';
comment on constraint "CK_CONGELINSCR_DSMOTIVO" on public."TB_CONGELAMENTO_INSCRICAO" is 'Motivo de 10 a 500 caracteres.';
alter table public."TB_CONGELAMENTO_INSCRICAO" enable row level security;
revoke all on public."TB_CONGELAMENTO_INSCRICAO" from public, anon, authenticated, service_role;

create table public."TH_CONGELAMENTO_INSCRICAO" (
  "CO_EVENTO" bigint generated always as identity,
  "CO_MONITORAMENTO" uuid not null,
  "TP_EVENTO" character varying(12) not null,
  "DS_MOTIVO" character varying(500),
  "CO_USUARIO" uuid,
  "CO_LIBERACAO" uuid,
  "CO_DISPARO" bigint,
  "CO_EXECUCAO" character varying(80),
  "DT_VALIDADE" timestamptz,
  "DT_EVENTO" timestamptz not null default now(),
  constraint "PK_TH_CONGELAMENTO_INSCRICAO" primary key ("CO_EVENTO"),
  constraint "FK_MONITORAMENTO_HISTCONGELINSCR" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_HISTCONGELINSCR_TPEVENTO" check ("TP_EVENTO" in ('CONGELAR', 'DESCONGELAR', 'LIBERACAO', 'USO')),
  constraint "CK_HISTCONGELINSCR_CAMPOS" check (
    ("TP_EVENTO" in ('CONGELAR', 'DESCONGELAR') and "CO_USUARIO" is not null and "DS_MOTIVO" is not null
       and "CO_LIBERACAO" is null and "CO_EXECUCAO" is null and "DT_VALIDADE" is null)
    or ("TP_EVENTO" = 'LIBERACAO' and "CO_USUARIO" is not null and "DS_MOTIVO" is not null
       and "CO_LIBERACAO" is not null and "DT_VALIDADE" is not null and "CO_EXECUCAO" is null)
    or ("TP_EVENTO" = 'USO' and "CO_LIBERACAO" is not null and "CO_EXECUCAO" is not null)),
  constraint "CK_HISTCONGELINSCR_DSMOTIVO" check ("DS_MOTIVO" is null or length(btrim("DS_MOTIVO")) between 10 and 500),
  constraint "CK_HISTCONGELINSCR_COEXECUCAO" check ("CO_EXECUCAO" is null or "CO_EXECUCAO" ~ '^[A-Za-z0-9_-]{8,80}$')
);
comment on table public."TH_CONGELAMENTO_INSCRICAO" is
  'Histórico da trava "inscrições congeladas" (20261020170000): CONGELAR e DESCONGELAR (quem, motivo), LIBERACAO (override do administrador global por disparar_robo com forcar_congelado: token CO_LIBERACAO, validade de 12 h, o pedido CO_DISPARO) e USO (a execução do robô ou da pré-classificação que usou a liberação: registrar_uso_liberacao_congelamento). Só cresce.';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."CO_EVENTO" is 'Identificador do evento (sequencial).';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."TP_EVENTO" is 'CONGELAR, DESCONGELAR, LIBERACAO (override) ou USO (a execução que usou a liberação).';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."DS_MOTIVO" is 'Motivo (obrigatório em CONGELAR, DESCONGELAR e LIBERACAO).';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."CO_USUARIO" is 'Quem fez (auth.users.id); no USO, quem deu a liberação.';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."CO_LIBERACAO" is 'Token da liberação (vai ao workflow como forcar_congelado).';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."CO_DISPARO" is 'Pedido ao GitHub que levou a liberação (TL_DISPARO_ROBO.CO_DISPARO).';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."CO_EXECUCAO" is 'No USO: a execução (TL_SYNC_EMPREGARE.CO_SYNC ou TL_PRE_CLASSIFICACAO.CO_EXECUCAO).';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."DT_VALIDADE" is 'Na LIBERACAO: até quando o token vale.';
comment on column public."TH_CONGELAMENTO_INSCRICAO"."DT_EVENTO" is 'Quando aconteceu.';
comment on constraint "PK_TH_CONGELAMENTO_INSCRICAO" on public."TH_CONGELAMENTO_INSCRICAO" is 'Um evento por linha.';
comment on constraint "FK_MONITORAMENTO_HISTCONGELINSCR" on public."TH_CONGELAMENTO_INSCRICAO" is 'Edital do evento.';
comment on constraint "CK_HISTCONGELINSCR_TPEVENTO" on public."TH_CONGELAMENTO_INSCRICAO" is 'Eventos válidos.';
comment on constraint "CK_HISTCONGELINSCR_CAMPOS" on public."TH_CONGELAMENTO_INSCRICAO" is 'Campos obrigatórios de cada evento.';
comment on constraint "CK_HISTCONGELINSCR_DSMOTIVO" on public."TH_CONGELAMENTO_INSCRICAO" is 'Motivo de 10 a 500 caracteres.';
comment on constraint "CK_HISTCONGELINSCR_COEXECUCAO" on public."TH_CONGELAMENTO_INSCRICAO" is 'Formato do identificador da execução.';
create index "IN_HISTCONGELINSCR_COMONITOR_DTEVENTO" on public."TH_CONGELAMENTO_INSCRICAO" ("CO_MONITORAMENTO", "DT_EVENTO" desc);
comment on index public."IN_HISTCONGELINSCR_COMONITOR_DTEVENTO" is 'O histórico de um edital, do mais novo ao mais antigo.';
create index "IN_HISTCONGELINSCR_COLIBERACAO" on public."TH_CONGELAMENTO_INSCRICAO" ("CO_LIBERACAO") where "CO_LIBERACAO" is not null;
comment on index public."IN_HISTCONGELINSCR_COLIBERACAO" is 'A liberação pelo token.';
create unique index "UK_HISTCONGELINSCR_USO" on public."TH_CONGELAMENTO_INSCRICAO" ("CO_EXECUCAO", "CO_MONITORAMENTO") where "TP_EVENTO" = 'USO';
comment on index public."UK_HISTCONGELINSCR_USO" is 'Um uso por execução e edital.';
alter table public."TH_CONGELAMENTO_INSCRICAO" enable row level security;
revoke all on public."TH_CONGELAMENTO_INSCRICAO" from public, anon, authenticated, service_role;

-- 2. As perguntas à trava ----------------------------------------------------------------------
create function private."FC_INSCRICOES_CONGELADAS"(p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((select c."ST_INSCRICOES_CONGELADAS" = 'S'
                     from public."TB_CONGELAMENTO_INSCRICAO" c
                    where c."CO_MONITORAMENTO" = p_edital), false);
$function$;
comment on function private."FC_INSCRICOES_CONGELADAS"(uuid) is
  'O edital está com as inscrições congeladas (TB_CONGELAMENTO_INSCRICAO = S)? Sem linha: não (20261020170000).';
revoke all on function private."FC_INSCRICOES_CONGELADAS"(uuid) from public, anon, authenticated, service_role;

create function private."FC_LIBERACAO_CONGELAMENTO_VALIDA"(p_liberacao uuid, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select p_liberacao is not null and exists (
    select 1 from public."TH_CONGELAMENTO_INSCRICAO" h
     where h."TP_EVENTO" = 'LIBERACAO' and h."CO_LIBERACAO" = p_liberacao
       and h."CO_MONITORAMENTO" = p_edital and h."DT_VALIDADE" > now());
$function$;
comment on function private."FC_LIBERACAO_CONGELAMENTO_VALIDA"(uuid, uuid) is
  'O token (forcar_congelado do workflow) libera este edital agora? Só a LIBERACAO gravada por disparar_robo (administrador global), dentro da validade (20261020170000).';
revoke all on function private."FC_LIBERACAO_CONGELAMENTO_VALIDA"(uuid, uuid) from public, anon, authenticated, service_role;

create function private."FC_EXECUCAO_LIBERADA_NO_CONGELAMENTO"(p_execucao text, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select p_execucao is not null and exists (
    select 1 from public."TH_CONGELAMENTO_INSCRICAO" h
     where h."TP_EVENTO" = 'USO' and h."CO_EXECUCAO" = p_execucao and h."CO_MONITORAMENTO" = p_edital);
$function$;
comment on function private."FC_EXECUCAO_LIBERADA_NO_CONGELAMENTO"(text, uuid) is
  'A execução (CO_SYNC do robô) registrou o uso de uma liberação deste edital (USO)? É o que deixa FC_EMPREGARE_ABRIR_VAGA gravar a vaga de edital congelado (20261020170000).';
revoke all on function private."FC_EXECUCAO_LIBERADA_NO_CONGELAMENTO"(text, uuid) from public, anon, authenticated, service_role;

-- 3. Ler e mudar a trava (tela) ----------------------------------------------------------------
create function public.obter_congelamento_inscricoes(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
begin
  return (
    select json_build_object(
      'schema_version', 1,
      'congelado', coalesce(c."ST_INSCRICOES_CONGELADAS" = 'S', false),
      'motivo', c."DS_MOTIVO",
      'em', c."DT_ATUALIZACAO",
      'por', case when c."CO_USUARIO_ATUALIZACAO" is null then null
                  else private."FC_NOME_USUARIO"(c."CO_USUARIO_ATUALIZACAO") end,
      'pode_alterar', public.pode_recalcular_pre_classificacao(p_edital),
      'historico', coalesce((
        select json_agg(json_build_object(
                 'tipo', h."TP_EVENTO",
                 'motivo', h."DS_MOTIVO",
                 'em', h."DT_EVENTO",
                 'por', private."FC_NOME_USUARIO"(h."CO_USUARIO")) order by h."DT_EVENTO" desc, h."CO_EVENTO" desc)
          from (select * from public."TH_CONGELAMENTO_INSCRICAO" t
                 where t."CO_MONITORAMENTO" = p_edital and t."TP_EVENTO" <> 'USO'
                 order by t."DT_EVENTO" desc, t."CO_EVENTO" desc limit 10) h), '[]'::json))
      from (select 1) x
      left join public."TB_CONGELAMENTO_INSCRICAO" c on c."CO_MONITORAMENTO" = p_edital);
end;
$function$;

create function public.alterar_congelamento_inscricoes(p_edital uuid, p_congelar boolean, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_atual boolean;
begin
  if v_uid is null then
    raise exception 'Entre no MONITORA de novo.' using errcode = '28000';
  end if;
  if p_edital is null or p_congelar is null then
    raise exception 'Informe o edital e se as inscrições ficam congeladas.' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital) then
    raise exception 'Edital não encontrado.' using errcode = '22023';
  end if;
  if not public.pode_recalcular_pre_classificacao(p_edital) then
    raise exception 'Só a coordenação da avaliação do edital ou o administrador global congela ou libera as inscrições.' using errcode = '42501';
  end if;
  if length(v_motivo) not between 10 and 500 then
    raise exception 'Informe o motivo (10 a 500 caracteres).' using errcode = '22023';
  end if;

  select c."ST_INSCRICOES_CONGELADAS" = 'S' into v_atual
    from public."TB_CONGELAMENTO_INSCRICAO" c
   where c."CO_MONITORAMENTO" = p_edital
     for update;
  if coalesce(v_atual, false) = p_congelar then
    raise exception 'As inscrições deste edital já estão %.',
      case when p_congelar then 'congeladas' else 'liberadas' end using errcode = '55000';
  end if;

  insert into public."TB_CONGELAMENTO_INSCRICAO" as c
         ("CO_MONITORAMENTO", "ST_INSCRICOES_CONGELADAS", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
  values (p_edital, case when p_congelar then 'S' else 'N' end, v_motivo, v_uid)
  on conflict ("CO_MONITORAMENTO") do update set
    "ST_INSCRICOES_CONGELADAS" = excluded."ST_INSCRICOES_CONGELADAS",
    "DS_MOTIVO" = excluded."DS_MOTIVO",
    "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO",
    "DT_ATUALIZACAO" = now();
  insert into public."TH_CONGELAMENTO_INSCRICAO" ("CO_MONITORAMENTO", "TP_EVENTO", "DS_MOTIVO", "CO_USUARIO")
  values (p_edital, case when p_congelar then 'CONGELAR' else 'DESCONGELAR' end, v_motivo, v_uid);

  return public.obter_congelamento_inscricoes(p_edital);
end;
$function$;

-- 4. O override na execução (service_role) ------------------------------------------------------
create function public.registrar_uso_liberacao_congelamento(p_liberacao uuid, p_execucao text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_liberacao is null then
    raise exception 'Informe a liberação.' using errcode = '22023';
  end if;
  if p_execucao is null or p_execucao !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Execução inválida.' using errcode = '22023';
  end if;

  insert into public."TH_CONGELAMENTO_INSCRICAO"
         ("CO_MONITORAMENTO", "TP_EVENTO", "CO_USUARIO", "CO_LIBERACAO", "CO_DISPARO", "CO_EXECUCAO")
  select l."CO_MONITORAMENTO", 'USO', l."CO_USUARIO", l."CO_LIBERACAO", l."CO_DISPARO", p_execucao
    from public."TH_CONGELAMENTO_INSCRICAO" l
   where l."TP_EVENTO" = 'LIBERACAO' and l."CO_LIBERACAO" = p_liberacao and l."DT_VALIDADE" > now()
  on conflict ("CO_EXECUCAO", "CO_MONITORAMENTO") where "TP_EVENTO" = 'USO' do nothing;

  return json_build_object(
    'execucao', p_execucao,
    'editais', coalesce((
      select json_agg(coalesce(private."FC_NUMERO_EDITAL"(m.edital), m.edital) order by m.edital)
        from public."TH_CONGELAMENTO_INSCRICAO" u
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = u."CO_MONITORAMENTO"
       where u."TP_EVENTO" = 'USO' and u."CO_EXECUCAO" = p_execucao and u."CO_LIBERACAO" = p_liberacao), '[]'::json));
end;
$function$;

-- 5. TL_DISPARO_ROBO: as origens MANUAL e GITHUB --------------------------------------------------
alter table public."TL_DISPARO_ROBO"
  add column "NO_ATOR_GITHUB" character varying(100),
  add column "DS_URL_EXECUCAO" character varying(300),
  alter column "TP_ORIGEM" drop default,
  drop constraint "CK_DISPROBO_TPORIGEM",
  drop constraint "CK_DISPROBO_TPSITUACAO",
  drop constraint "CK_DISPROBO_PEDIDO",
  add constraint "CK_DISPROBO_TPORIGEM" check ("TP_ORIGEM" in ('AGENDA', 'MONITORA', 'MANUAL', 'GITHUB')),
  add constraint "CK_DISPROBO_TPSITUACAO" check ("TP_SITUACAO" in ('PEDIDO', 'ACEITO', 'FALHOU', 'SEM_TOKEN', 'INICIADO')),
  add constraint "CK_DISPROBO_PEDIDO" check (
    ("TP_SITUACAO" in ('SEM_TOKEN', 'INICIADO') and "CO_PEDIDO_HTTP" is null)
    or ("TP_SITUACAO" in ('PEDIDO', 'ACEITO') and "CO_PEDIDO_HTTP" is not null)
    or "TP_SITUACAO" = 'FALHOU'),
  add constraint "CK_DISPROBO_GITHUB" check (
    (("TP_ORIGEM" = 'GITHUB') = ("TP_SITUACAO" = 'INICIADO'))
    and (("TP_ORIGEM" = 'GITHUB') = ("DS_URL_EXECUCAO" is not null))
    and ("TP_ORIGEM" = 'GITHUB' or "NO_ATOR_GITHUB" is null)),
  add constraint "CK_DISPROBO_DSURL" check (
    "DS_URL_EXECUCAO" is null
    or "DS_URL_EXECUCAO" ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[0-9]+$');
comment on table public."TL_DISPARO_ROBO" is
  'Pedidos de execução dos robôs (workflow_dispatch do GitHub) feitos pelo banco — na hora da agenda (pg_cron, AGENDA), no Rodar agora / Opções / Recalcular do MONITORA (disparar_robo, MONITORA) e chamados direto pelo SQL sem usuário (MANUAL, 20261020170000), sempre por FC_DISPARAR_ROBO — e as execuções iniciadas direto no GitHub (GITHUB, registradas pelo próprio workflow por registrar_disparo_externo, 20261020170000). Uma linha por pedido ou execução; nunca guarda a chave. Os pedidos são fechados por FC_CONFERIR_DISPAROS_ROBO (net._http_response); linhas com mais de 30 dias saem. Leitura só por get_saude_das_cargas e situacao_do_disparo_robo.';
comment on column public."TL_DISPARO_ROBO"."TP_ORIGEM" is 'AGENDA (tarefa do pg_cron), MONITORA (Rodar agora, Opções ou Recalcular de quem está logado), MANUAL (FC_DISPARAR_ROBO chamado direto pelo SQL, sem usuário) ou GITHUB (Run workflow / gh workflow run, registrada pelo workflow).';
comment on column public."TL_DISPARO_ROBO"."CO_USUARIO" is 'Quem pediu pelo MONITORA (auth.users.id; vai ao workflow como disparado_por); nulo nas outras origens.';
comment on column public."TL_DISPARO_ROBO"."TP_SITUACAO" is 'PEDIDO (aguardando a resposta), ACEITO (o GitHub respondeu 2xx — 204), FALHOU (outro código, tempo esgotado ou sem resposta), SEM_TOKEN (sem a chave github_disparo_robos no Vault; nada foi pedido) ou INICIADO (execução iniciada direto no GitHub, origem GITHUB).';
comment on column public."TL_DISPARO_ROBO"."NO_ATOR_GITHUB" is 'Origem GITHUB: quem iniciou a execução no GitHub (github.triggering_actor).';
comment on column public."TL_DISPARO_ROBO"."DS_URL_EXECUCAO" is 'Origem GITHUB: endereço da execução no GitHub Actions (uma linha por execução).';
comment on constraint "CK_DISPROBO_TPORIGEM" on public."TL_DISPARO_ROBO" is 'Origens válidas.';
comment on constraint "CK_DISPROBO_TPSITUACAO" on public."TL_DISPARO_ROBO" is 'Situações válidas.';
comment on constraint "CK_DISPROBO_PEDIDO" on public."TL_DISPARO_ROBO" is 'SEM_TOKEN e INICIADO não têm pedido no pg_net; PEDIDO e ACEITO sempre têm.';
comment on constraint "CK_DISPROBO_GITHUB" on public."TL_DISPARO_ROBO" is 'Origem GITHUB ⇔ situação INICIADO ⇔ endereço da execução; ator só na origem GITHUB.';
comment on constraint "CK_DISPROBO_DSURL" on public."TL_DISPARO_ROBO" is 'Endereço de execução do GitHub Actions.';
create unique index "UK_DISPROBO_DSURL_GITHUB" on public."TL_DISPARO_ROBO" ("DS_URL_EXECUCAO") where "TP_ORIGEM" = 'GITHUB';
comment on index public."UK_DISPROBO_DSURL_GITHUB" is 'Uma linha por execução iniciada no GitHub (repetir o registro não duplica).';

create function public.registrar_disparo_externo(p_workflow text, p_ator text, p_url text, p_resumo text default null)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ator text := nullif(btrim(coalesce(p_ator, '')), '');
  v_resumo text := nullif(left(btrim(coalesce(p_resumo, '')), 300), '');
  v_disparo bigint;
begin
  if p_workflow is null or p_workflow not in (
       'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml',
       'expurgo-anexos-chat.yml', 'robo-empregare.yml', 'pre-classificacao.yml') then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_url is null or length(p_url) > 300
     or p_url !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[0-9]+$' then
    raise exception 'Endereço da execução inválido' using errcode = '22023';
  end if;
  -- Login do GitHub (letras, dígitos, hífen; robôs com [bot]); fora disso, sem ator.
  if v_ator is not null and v_ator !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}(\[bot\])?$' then
    v_ator := null;
  end if;

  insert into public."TL_DISPARO_ROBO"
         ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "NO_ATOR_GITHUB", "DS_URL_EXECUCAO", "DS_MENSAGEM")
  values (p_workflow, 'GITHUB', null, 'INICIADO', v_ator, p_url, v_resumo)
  on conflict ("DS_URL_EXECUCAO") where "TP_ORIGEM" = 'GITHUB' do nothing
  returning "CO_DISPARO" into v_disparo;
  if v_disparo is null then
    select d."CO_DISPARO" into v_disparo
      from public."TL_DISPARO_ROBO" d
     where d."TP_ORIGEM" = 'GITHUB' and d."DS_URL_EXECUCAO" = p_url;
  end if;
  return v_disparo;
end;
$function$;

-- 6. FC_DISPARAR_ROBO: a origem certa e o override -----------------------------------------------
drop function private."FC_DISPARAR_ROBO"(text, jsonb, uuid);
create function private."FC_DISPARAR_ROBO"(
  p_workflow text,
  p_inputs jsonb default '{}'::jsonb,
  p_usuario uuid default null,
  p_origem text default null)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por).
  c_aceitos constant jsonb := jsonb_build_object(
    'sincronizar-entrevistas.yml', jsonb_build_array('modo'),
    'sincronizar-selecao.yml', jsonb_build_array('modo'),
    'conferencias.yml', jsonb_build_array('modo'),
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado'),
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais', 'forcar_congelado'));
  v_inputs jsonb := coalesce(p_inputs, '{}'::jsonb);
  -- AGENDA só do pg_cron: as tarefas passam p_origem = 'AGENDA' (e a sessão do pg_cron
  -- se chama pg_cron); MONITORA com o usuário da tela; MANUAL = SQL direto, sem usuário.
  v_origem constant text := case
    when p_usuario is not null then 'MONITORA'
    when p_origem = 'AGENDA' or current_setting('application_name', true) = 'pg_cron' then 'AGENDA'
    else 'MANUAL' end;
  v_disparado_por constant text := case v_origem
    when 'MONITORA' then p_usuario::text
    when 'AGENDA' then 'AGENDA'
    else 'manual' end;
  v_chave text;
  v_pedido bigint;
  v_disparo bigint;
begin
  if p_workflow is null or not (c_aceitos ? p_workflow) then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_origem is not null and p_origem <> 'AGENDA' then
    raise exception 'Origem inválida (só AGENDA, nas tarefas do pg_cron)' using errcode = '22023';
  end if;
  if jsonb_typeof(v_inputs) <> 'object'
     or exists (
       select 1 from jsonb_each(v_inputs) i
        where not ((c_aceitos -> p_workflow) ? i.key)
           or jsonb_typeof(i.value) <> 'string'
           or length(i.value #>> '{}') > 20000) then
    raise exception 'Inputs inválidos para %', p_workflow using errcode = '22023';
  end if;

  -- O nome do segredo é sempre github_disparo_robos; a configuração da sessão
  -- agsus.segredo_disparo_robos só existe para o ensaio simular a chave ausente
  -- (set local) sem tocar no Vault nem ler o valor.
  select nullif(btrim(s.decrypted_secret), '')
    into v_chave
    from vault.decrypted_secrets s
   where s.name = coalesce(nullif(current_setting('agsus.segredo_disparo_robos', true), ''), 'github_disparo_robos')
   order by s.updated_at desc nulls last
   limit 1;

  if v_chave is null then
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'SEM_TOKEN', 'Sem a chave github_disparo_robos no Vault.')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end if;

  begin
    v_pedido := net.http_post(
      url := 'https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/' || p_workflow || '/dispatches',
      body := jsonb_build_object(
        'ref', 'main',
        'inputs', v_inputs || jsonb_build_object('disparado_por', v_disparado_por)),
      headers := jsonb_build_object(
        'Accept', 'application/vnd.github+json',
        'Authorization', 'Bearer ' || v_chave,
        'X-GitHub-Api-Version', '2022-11-28',
        'User-Agent', 'agsus-monitora-agenda',
        'Content-Type', 'application/json'),
      timeout_milliseconds := 10000);
  exception when others then
    -- Só o código do erro: a mensagem poderia citar o pedido.
    v_chave := null;
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DT_RESPOSTA", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'FALHOU', now(), 'O pg_net recusou o pedido (' || sqlstate || ').')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end;
  v_chave := null;

  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values (p_workflow, v_origem, p_usuario, v_pedido, 'PEDIDO')
  returning "CO_DISPARO" into v_disparo;
  return v_disparo;
end;
$function$;
comment on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text) is
  'Único caminho do banco até o GitHub (20261008140000): pede a execução (workflow_dispatch, ramo main) de um workflow da lista fixa, com os inputs que ele aceita (texto até 20000; o robô da Empregare aceita modo, editais, vagas, limite, anexos, candidatos, seco e forcar_congelado; a pré-classificação, modo, editais e forcar_congelado). Origem (20261020170000): MONITORA com p_usuario (vai como disparado_por); AGENDA só do pg_cron (p_origem = AGENDA nas tarefas ou a sessão pg_cron; disparado_por = AGENDA); MANUAL quando chamada direto pelo SQL, sem usuário (disparado_por = manual). Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora da lista, origem ou input recusado. Só o dono (pg_cron e as RPCs SECURITY DEFINER).';
revoke all on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text) from public, anon, authenticated, service_role;

create or replace function private."FC_AGENDA_DAS_INSCRICOES"(p_tarefa text, p_editais text, p_ate date)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_tarefa is null or p_tarefa !~ '^agsus_robo_inscricoes_[a-z0-9_]{1,40}$' then
    raise exception 'Tarefa da agenda das inscrições inválida' using errcode = '22023';
  end if;
  if p_ate is null or coalesce(btrim(p_editais), '') = '' then
    raise exception 'Informe os editais e a data final' using errcode = '22023';
  end if;
  -- Passou a data (Brasília): a tarefa desliga a si mesma e não pede nada.
  if (now() at time zone 'America/Sao_Paulo')::date > p_ate then
    if exists (select 1 from cron.job where jobname = p_tarefa) then
      perform cron.unschedule(p_tarefa);
    end if;
    return null;
  end if;
  -- O robô da Empregare, ao fim de uma carga normal, roda a pré-classificação dos
  -- editais carregados (robo-empregare.yml, --apos-robo), que grava o retrato.
  -- Edital com inscrições congeladas: o robô e a pré-classificação o pulam.
  return private."FC_DISPARAR_ROBO"('robo-empregare.yml',
    jsonb_build_object('modo', 'normal', 'editais', btrim(p_editais)), null, 'AGENDA');
end;
$function$;
comment on function private."FC_AGENDA_DAS_INSCRICOES"(text, text, date) is
  'Agenda das inscrições (20261009140000): chamada por uma tarefa agsus_robo_inscricoes_* do pg_cron, pede o robô da Empregare dos editais (modo normal; no fim ele roda a pré-classificação deles e o retrato das inscrições) por FC_DISPARAR_ROBO, com origem AGENDA (20261020170000), até p_ate (data de Brasília) e, no primeiro horário depois, desliga a própria tarefa (cron.unschedule) e devolve nulo. Edital com inscrições congeladas: o robô e a pré-classificação o pulam. Só o dono (pg_cron).';
revoke all on function private."FC_AGENDA_DAS_INSCRICOES"(text, text, date) from public, anon, authenticated, service_role;

-- As tarefas do pg_cron que chamam FC_DISPARAR_ROBO passam a origem explícita.
do $$
declare
  r record;
begin
  for r in
    select j.jobid, j.command from cron.job j
     where j.command like '%private."FC_DISPARAR_ROBO"(%' and j.command not like '%p_origem%'
  loop
    perform cron.alter_job(r.jobid,
      command => regexp_replace(r.command, '\)\s*;\s*$', ', p_origem => ''AGENDA'');'));
  end loop;
end;
$$;

-- 7. listar_vagas_empregare: as vagas de edital congelado saem da carga ------------------------
drop function public.listar_vagas_empregare(text[], text[], integer);
create function public.listar_vagas_empregare(
  p_editais text[] default null,
  p_vagas text[] default null,
  p_limite integer default 60,
  p_finalidade text default 'carga',
  p_liberacao uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 60), 1), 500);
  v_vagas text[] := coalesce(p_vagas, '{}');
  v_editais text[];
  v_modo text;
  v_finalidade text := coalesce(nullif(btrim(p_finalidade), ''), 'carga');
begin
  if v_finalidade not in ('carga', 'anexos') then
    raise exception 'Finalidade inválida: carga ou anexos' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_vagas) v where v !~ '^[0-9]{1,20}$') then
    raise exception 'Código de vaga inválido: use só dígitos' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct private."FC_NUMERO_EDITAL"(e)), '{}') into v_editais
    from unnest(coalesce(p_editais, '{}')) e;
  if exists (select 1 from unnest(v_editais) e where e is null) then
    raise exception 'Edital inválido: use o número, como 80/2026' using errcode = '22023';
  end if;
  v_modo := case when cardinality(v_vagas) > 0 then 'VAGAS'
                 when cardinality(v_editais) > 0 then 'EDITAIS'
                 else 'PADRAO' end;

  return (
    with quadro as (
      select q.vaga, m.id as edital_id, m.edital, m.unidade, q.cargo, m."CO_AREA" as area,
             m.ativo as edital_ativo, 'quadro'::text as origem
        from private."FC_EMPREGARE_VAGAS_DO_QUADRO"() q
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = q.edital_id
    ),
    selecao as (
      select distinct on (s."CO_VAGA")
             s."CO_VAGA" as vaga, s."CO_MONITORAMENTO" as edital_id, s."DS_EDITAL" as edital,
             s."NO_UNIDADE" as unidade, s."NO_CARGO" as cargo, s."CO_AREA" as area,
             m.ativo as edital_ativo, 'selecao'::text as origem
        from public."TB_SELECAO_VAGA" s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
       where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_VAGA" is not null
       order by s."CO_VAGA", (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
    ),
    -- Vagas já ligadas ao edital na Empregare (correção de dados ou carga anterior):
    -- o edital em inscrição ainda não tem análise (código do quadro) nem Seleção.
    ligadas as (
      select v."CO_VAGA" as vaga, m.id as edital_id, m.edital, m.unidade, null::text as cargo,
             m."CO_AREA" as area, m.ativo as edital_ativo, 'ligada'::text as origem
        from public."TB_EMPREGARE_VAGA" v
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
    ),
    -- Mesmo código em mais de uma fonte: fica a do quadro, depois a da Seleção.
    fontes as (
      select f.*,
             (select max(coalesce(c.data_fim, c.data_inicio)::date)
                from public."TB_CRONOGRAMA_MONIT_INDIG" c
               where c.monitoramento_id = f.edital_id) as fim_do_cronograma
        from (select * from quadro
              union all
              select s.* from selecao s where not exists (select 1 from quadro q where q.vaga = s.vaga)
              union all
              select l.* from ligadas l
               where not exists (select 1 from quadro q where q.vaga = l.vaga)
                 and not exists (select 1 from selecao s where s.vaga = l.vaga)) f
    ),
    escolhidas as (
      select s.vaga, s.edital_id, s.edital, s.unidade, s.cargo, s.area, s.origem
        from fontes s
       where (v_modo = 'VAGAS' and s.vaga = any (v_vagas))
          or (v_modo = 'EDITAIS' and private."FC_NUMERO_EDITAL"(s.edital) = any (v_editais))
          or (v_modo = 'PADRAO' and s.edital_ativo is true
              and not private."FC_EDITAL_EH_TREINAMENTO"(s.edital_id)
              and (s.fim_do_cronograma is null or s.fim_do_cronograma >= current_date - 30))
      union all
      -- Código pedido que não está em nenhuma fonte: vai mesmo assim, sem edital.
      select v, null::uuid, null, null, null, null, 'pedida'
        from unnest(v_vagas) v
       where v_modo = 'VAGAS' and not exists (select 1 from fontes s where s.vaga = v)
    ),
    -- [congeladas] Edital com inscrições congeladas (20261020170000): fica fora da carga,
    -- salvo liberação válida do administrador global; no modo "só anexos" nada sai.
    marcadas as (
      select e.*,
             e.edital_id is not null and private."FC_INSCRICOES_CONGELADAS"(e.edital_id) as congelada,
             e.edital_id is not null and private."FC_LIBERACAO_CONGELAMENTO_VALIDA"(p_liberacao, e.edital_id) as liberada
        from escolhidas e
    ),
    ordenadas as (
      select m.*, ev."DT_ULTIMA_CARGA" as ultima_carga
        from marcadas m
        left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = m.vaga
       where v_finalidade = 'anexos' or not m.congelada or m.liberada
       order by ev."DT_ULTIMA_CARGA" nulls first, m.edital nulls last, m.vaga
       limit v_limite
    )
    select jsonb_build_object(
      'modo', v_modo,
      'limite', v_limite,
      'finalidade', v_finalidade,
      'vagas', coalesce((
        select jsonb_agg(jsonb_build_object(
            'vaga', o.vaga, 'edital_id', o.edital_id, 'edital', o.edital, 'unidade', o.unidade,
            'cargo', o.cargo, 'area', o.area, 'ultima_carga', o.ultima_carga, 'origem', o.origem,
            'congelada', o.congelada, 'liberada', o.congelada and o.liberada
          ) order by o.ultima_carga nulls first, o.edital nulls last, o.vaga)
          from ordenadas o), '[]'::jsonb),
      -- O que ficou de fora: por edital, quantas vagas e se veio explícito no pedido.
      'congeladas', coalesce((
        select jsonb_agg(jsonb_build_object(
            'edital_id', c.edital_id, 'edital', c.edital, 'vagas', c.vagas, 'pedido', v_modo <> 'PADRAO')
          order by c.edital)
          from (select m.edital_id, min(m.edital) as edital, count(*) as vagas
                  from marcadas m
                 where v_finalidade = 'carga' and m.congelada and not m.liberada
                 group by m.edital_id) c), '[]'::jsonb)
    )
  );
end;
$function$;
comment on function public.listar_vagas_empregare(text[], text[], integer, text, uuid) is
  'Robô da Empregare (service_role): as vagas a carregar, de três fontes — o quadro de vagas do edital (código pelas análises do edital), a Seleção (TB_SELECAO_VAGA) e as vagas já ligadas ao edital em TB_EMPREGARE_VAGA (origem ligada). Sem filtro: editais ativos e em curso (fim do cronograma há até 30 dias), sem o treinamento; p_editais pelos números; p_vagas pelos códigos (fora das fontes: origem pedida, sem edital). As nunca carregadas e as mais antigas primeiro, até p_limite. Inscrições congeladas (20261020170000): com p_finalidade = carga (padrão), as vagas de edital congelado saem da lista e voltam em "congeladas" ({edital_id, edital, vagas, pedido}; pedido = veio explícito em p_editais/p_vagas, o robô recusa), salvo p_liberacao válida para o edital (override do administrador global); com p_finalidade = anexos (modo "só anexos") nada sai e cada vaga diz se está congelada.';
revoke all on function public.listar_vagas_empregare(text[], text[], integer, text, uuid) from public, anon, authenticated;
grant execute on function public.listar_vagas_empregare(text[], text[], integer, text, uuid) to service_role;

-- 8. A trava de raiz na gravação do robô ------------------------------------------------------
create or replace function private."FC_EMPREGARE_ABRIR_VAGA"(p_sync text, p_vaga text, p_total integer)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_vaga public."TB_EMPREGARE_VAGA";
  v_forcada boolean;
  v_ativos integer;
  v_edital uuid;
begin
  -- Vaga já aberta nesta execução (2º lote em diante e o fechamento): nada a procurar.
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v
   where v."CO_VAGA" = p_vaga and v."CO_SYNC" = p_sync
     for update;
  if found then
    return v_vaga."TP_SITUACAO";
  end if;

  select (s."ST_FORCADA" = 'S') into v_forcada from public."TL_SYNC_EMPREGARE" s where s."CO_SYNC" = p_sync;
  select q.edital_id into v_edital from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) q limit 1;
  if v_edital is null then
    select s."CO_MONITORAMENTO" into v_edital
      from public."TB_SELECAO_VAGA" s
     where s."CO_VAGA" = p_vaga and s."ST_REGISTRO_ATIVO" = 'S'
     order by (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
     limit 1;
  end if;

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO")
  values (p_vaga, v_edital)
  on conflict ("CO_VAGA") do nothing;
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga for update;

  if v_vaga."CO_SYNC" is not distinct from p_sync then
    return v_vaga."TP_SITUACAO";
  end if;

  -- [congeladas] Edital com inscrições congeladas (20261020170000): RECUSADA, nada gravado
  -- nem desativado, salvo se esta execução registrou o uso de uma liberação do edital
  -- (registrar_uso_liberacao_congelamento, override do administrador global).
  v_edital := coalesce(v_edital, v_vaga."CO_MONITORAMENTO");
  if v_edital is not null and private."FC_INSCRICOES_CONGELADAS"(v_edital)
     and not private."FC_EXECUCAO_LIBERADA_NO_CONGELAMENTO"(p_sync, v_edital) then
    update public."TB_EMPREGARE_VAGA" set
      "TP_SITUACAO" = 'RECUSADA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
      "CO_MONITORAMENTO" = v_edital,
      "DS_MENSAGEM" = 'Inscrições congeladas no edital: nada foi gravado nem desativado (override só pelo administrador global).',
      "DT_ATUALIZACAO" = now()
     where "CO_VAGA" = p_vaga;
    update public."TL_SYNC_EMPREGARE" set "QT_VAGA_RECUSADA" = "QT_VAGA_RECUSADA" + 1 where "CO_SYNC" = p_sync;
    return 'RECUSADA';
  end if;

  select count(*) into v_ativos
    from public."TB_EMPREGARE_CANDIDATO" c
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S';

  if not v_forcada and v_ativos > 0 and p_total * 2 < v_ativos then
    update public."TB_EMPREGARE_VAGA" set
      "TP_SITUACAO" = 'RECUSADA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
      "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"),
      "DS_MENSAGEM" = format('Arquivo com %s candidatos e a vaga tem %s ativos: menos da metade. Nada foi gravado nem desativado.', p_total, v_ativos),
      "DT_ATUALIZACAO" = now()
     where "CO_VAGA" = p_vaga;
    update public."TL_SYNC_EMPREGARE" set "QT_VAGA_RECUSADA" = "QT_VAGA_RECUSADA" + 1 where "CO_SYNC" = p_sync;
    return 'RECUSADA';
  end if;

  update public."TB_EMPREGARE_VAGA" set
    "TP_SITUACAO" = 'EM_CARGA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
    "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"), "DS_MENSAGEM" = null, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  return 'EM_CARGA';
end;
$function$;
comment on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) is
  'Abre a vaga numa execução do robô da Empregare: cria a linha, liga o edital (primeiro pelo quadro de vagas do edital, FC_EMPREGARE_VAGAS_DO_QUADRO; depois por TB_SELECAO_VAGA) e aplica as travas: edital com inscrições congeladas (20261020170000) é RECUSADA, salvo se a execução registrou o uso de uma liberação do edital; arquivo com menos da metade dos ativos, sem forçar, é RECUSADA. Vaga já aberta nesta execução devolve a situação sem procurar o edital de novo. Chamada pelas RPCs de carga.';
revoke all on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) from public, anon, authenticated;

-- 9. pre_classificacao_ler_editais: o edital congelado não é recalculado ----------------------
drop function public.pre_classificacao_ler_editais(text[], boolean);
create function public.pre_classificacao_ler_editais(
  p_editais text[] default null,
  p_apos_robo boolean default false,
  p_incluir_congelados boolean default false,
  p_liberacao uuid default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
  v_sync text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_congelados uuid[] := '{}';
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome ("FCC").
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  elsif p_apos_robo then
    -- Os editais das vagas gravadas na última execução fechada do robô.
    select s."CO_SYNC" into v_sync
      from public."TL_SYNC_EMPREGARE" s
     where s."TP_SITUACAO" in ('CONCLUIDA', 'PARCIAL')
     order by s."DT_INICIO" desc limit 1;
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_SYNC" = v_sync and v."CO_MONITORAMENTO" is not null
       and not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO");
  else
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  -- [congeladas] Edital com inscrições congeladas (20261020170000): fica fora (após robô,
  -- normal e refazer lote), salvo liberação válida; o modo seco pede p_incluir_congelados.
  if not coalesce(p_incluir_congelados, false) then
    select coalesce(array_agg(x), '{}') into v_congelados
      from unnest(v_ids) x
     where private."FC_INSCRICOES_CONGELADAS"(x)
       and not private."FC_LIBERACAO_CONGELAMENTO_VALIDA"(p_liberacao, x);
    v_ids := array(select x from unnest(v_ids) x where not x = any (v_congelados));
  end if;

  return jsonb_build_object(
    'hoje', v_hoje,
    'sync', v_sync,
    'congelados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital), 'pedido', cardinality(v_pedidos) > 0)
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m.id = any (v_congelados)), '[]'::jsonb),
    'nao_encontrados', coalesce((
      select jsonb_agg(p.texto order by p.texto)
        from unnest(v_pedidos) p(texto)
       where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                          where m.id::text = lower(p.texto)
                             or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                             or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
               'area', m."CO_AREA",
               'ativo', coalesce(m.ativo, false),
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
               'congelado', private."FC_INSCRICOES_CONGELADAS"(m.id),
               'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                                   'configuracao', h."DS_CONFIGURACAO")
                           from public."TB_REGRA_ANALISE" r
                           join public."TH_REGRA_ANALISE" h
                             on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                          where r."CO_MONITORAMENTO" = m.id),
               'documental', private."FC_DOCUMENTAL_DO_EDITAL"(m.id),
               -- O cronograma: o job congela a declarada depois do fim das inscrições.
               'cronograma', coalesce((
                 select jsonb_agg(jsonb_build_object('atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
                        order by c.ordem)
                   from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = m.id), '[]'::jsonb),
               -- Refazer o lote do zero: ninguém analisado e TODAS as fichas do edital intocadas
               -- (FC_FICHAS_INICIADAS = 0); fichas_iniciadas vai para a mensagem da recusa (20261013110000).
               'fichas_iniciadas', fi.n,
               'refazer_permitido', fi.n = 0
                                    and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                                     where a."CO_MONITORAMENTO" = m.id and a."TP_SITUACAO" = 'ANALISADO'),
               -- [sem-mudanca] Só no fim do robô: nada mudou desde a última pré-classificação
               -- CONCLUÍDA de hoje que processou o edital (o job pula o edital).
               'sem_mudanca', p_apos_robo and cardinality(v_pedidos) = 0 and exists (
                 select 1
                   from public."TL_PRE_CLASSIFICACAO" l
                  where l."TP_SITUACAO" = 'CONCLUIDA'
                    and (l."DT_INICIO" at time zone 'America/Sao_Paulo')::date = v_hoje
                    and l."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', m.id, 'situacao', 'PROCESSADO'))
                    and l."DT_INICIO" > coalesce((
                          select max(c."DT_ATUALIZACAO")
                            from public."TB_EMPREGARE_VAGA" v
                            join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = v."CO_VAGA"
                           where v."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(d."DT_CRIACAO", d."DT_ATUALIZACAO", d."DT_REVOGACAO"))
                            from public."TB_DECISAO_LOTE" d where d."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select greatest(r."DT_CRIACAO", r."DT_ATUALIZACAO", r."DT_CONFERENCIA")
                            from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(q."DT_CRIACAO", q."DT_DESATIVACAO"))
                            from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)),
               -- Só os metadados da vaga: o cargo e a linha do quadro vêm com os inscritos
               -- (pre_classificacao_ler_candidatos, uma vaga por chamada, desde 20261014110000).
               'vagas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'codigo', v."CO_VAGA",
                          'situacao_carga', v."TP_SITUACAO",
                          'candidatos_ativos', v."QT_CANDIDATO_ATIVO",
                          'ultima_carga', v."DT_ULTIMA_CARGA",
                          'ultimo_lote', coalesce(pv."NU_ULTIMO_LOTE", 0))
                        order by v."CO_VAGA")
                   from public."TB_EMPREGARE_VAGA" v
                   left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = m.id and pv."CO_VAGA" = v."CO_VAGA"
                  where v."CO_MONITORAMENTO" = m.id), '[]'::jsonb))
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       cross join lateral (select private."FC_FICHAS_INICIADAS"(m.id) as n) fi
       where m.id = any (v_ids)), '[]'::jsonb)
  );
end;
$function$;
comment on function public.pre_classificacao_ler_editais(text[], boolean, boolean, uuid) is
  'Job da pré-classificação (service_role): os editais a calcular — os pedidos (id, número ou nome), os das vagas da última carga do robô (p_apos_robo) ou os ativos com vagas da Empregare —, com a regra, o cronograma, as vagas e se o refazer é permitido. Inscrições congeladas (20261020170000): o edital congelado sai de "editais" e volta em "congelados" ({id, rotulo, pedido}; pedido = veio explícito, o job recusa), salvo p_liberacao válida (override do administrador global) ou p_incluir_congelados (modo seco, que não grava); cada edital traz "congelado".';
revoke all on function public.pre_classificacao_ler_editais(text[], boolean, boolean, uuid) from public, anon, authenticated;
grant execute on function public.pre_classificacao_ler_editais(text[], boolean, boolean, uuid) to service_role;

-- 10. disparar_robo: recusa o edital congelado e grava o override ------------------------------
create or replace function public.disparar_robo(p_robo text, p_inputs jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c_robos constant jsonb := jsonb_build_object(
    'empregare', jsonb_build_object('nome', 'Robô da Empregare', 'workflow', 'robo-empregare.yml',
      'modos', jsonb_build_array('normal', 'seco', 'fumaca', 'forcar', 'sondar', 'anexos'),
      'editais', 'numero', 'vagas', true, 'limite', true, 'anexos', true, 'candidatos', true, 'seco', true,
      'forcar_congelado', true, 'motivo', true, 'modos_que_gravam', jsonb_build_array('normal', 'forcar')),
    'selecao', jsonb_build_object('nome', 'Seleção', 'workflow', 'sincronizar-selecao.yml',
      'modos', jsonb_build_array('normal')),
    'entrevistas', jsonb_build_object('nome', 'Entrevistas', 'workflow', 'sincronizar-entrevistas.yml',
      'modos', jsonb_build_array('normal')),
    'conferencias', jsonb_build_object('nome', 'Conferências de consistência', 'workflow', 'conferencias.yml',
      'modos', jsonb_build_array('normal', 'seco')),
    'pre_classificacao', jsonb_build_object('nome', 'Pré-classificação (Avaliação documental)', 'workflow', 'pre-classificacao.yml',
      'modos', jsonb_build_array('normal', 'seco', 'refazer_lote'),
      'editais', 'numero_ou_id', 'por_edital', true,
      'forcar_congelado', true, 'motivo', true, 'modos_que_gravam', jsonb_build_array('normal', 'refazer_lote')));
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_uid uuid := (select auth.uid());
  v_robo jsonb := c_robos -> p_robo;
  v_in jsonb := coalesce(p_inputs, '{}'::jsonb);
  v_chave text;
  v_valor jsonb;
  v_itens text[];
  v_item text;
  v_modo text;
  v_editais text[] := '{}';
  v_vagas text[] := '{}';
  v_candidatos text[] := '{}';
  v_limite integer;
  v_anexos boolean;
  v_seco boolean;
  v_saida jsonb;
  v_forcar_congelado boolean := false;
  v_motivo text;
  v_congelados uuid[] := '{}';
  v_rotulos text;
  v_liberacao uuid;
  v_disparo bigint;
begin
  if v_uid is null then
    raise exception 'Entre no MONITORA de novo para rodar a carga.' using errcode = '28000';
  end if;
  if v_robo is null then
    raise exception 'Carga desconhecida.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_in) <> 'object' then
    raise exception 'Opções inválidas.' using errcode = '22023';
  end if;

  -- Opção que o robô não aceita (vazia passa, como em validarOpcoes).
  for v_chave, v_valor in select * from jsonb_each(v_in) loop
    if v_chave not in ('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado', 'motivo')
       or (v_chave <> 'modo' and v_robo -> v_chave is null
           and not (jsonb_typeof(v_valor) = 'null'
                    or v_valor in ('""'::jsonb, '[]'::jsonb, 'false'::jsonb, '"false"'::jsonb))) then
      raise exception '% não aceita “%”.', v_robo ->> 'nome', left(v_chave, 30) using errcode = '22023';
    end if;
  end loop;

  -- Modo
  if jsonb_typeof(v_in -> 'modo') not in ('string', 'null') then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;
  v_modo := coalesce(nullif(btrim(v_in ->> 'modo'), ''), 'normal');
  if not ((v_robo -> 'modos') ? v_modo) then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;

  -- Editais: número (93/2026) ou, na pré-classificação, também o id.
  if v_robo ? 'editais' and coalesce(jsonb_typeof(v_in -> 'editais'), 'null') <> 'null' then
    v_valor := v_in -> 'editais';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Edital inválido.' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := string_to_array(v_valor #>> '{}', ',');
    else
      raise exception 'Edital inválido.' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if lower(v_item) ~ c_uuid and v_robo ->> 'editais' = 'numero_ou_id' then
        v_item := lower(v_item);
      elsif v_item !~ '^\d{1,4}/\d{4}$' then
        raise exception 'Edital inválido: %.', left(v_item, 40) using errcode = '22023';
      end if;
      if not v_item = any (v_editais) then
        v_editais := v_editais || v_item;
      end if;
    end loop;
    if cardinality(v_editais) > 100 then
      raise exception 'No máximo 100 editais por vez.' using errcode = '22023';
    end if;
  end if;

  -- Vagas: códigos da Empregare, só dígitos.
  if v_robo ? 'vagas' and coalesce(jsonb_typeof(v_in -> 'vagas'), 'null') <> 'null' then
    v_valor := v_in -> 'vagas';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de vaga inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_vagas) then
        v_vagas := v_vagas || v_item;
      end if;
    end loop;
    if cardinality(v_vagas) > 500 then
      raise exception 'No máximo 500 vagas por vez.' using errcode = '22023';
    end if;
  end if;

  -- Candidatos (modo anexos): códigos da Empregare, só dígitos.
  if v_robo ? 'candidatos' and coalesce(jsonb_typeof(v_in -> 'candidatos'), 'null') <> 'null' then
    v_valor := v_in -> 'candidatos';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de candidato inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_candidatos) then
        v_candidatos := v_candidatos || v_item;
      end if;
    end loop;
    if cardinality(v_candidatos) > 1000 then
      raise exception 'No máximo 1.000 candidatos por vez.' using errcode = '22023';
    end if;
  end if;

  -- Limite: 1 a 500 vagas.
  if v_robo ? 'limite' and coalesce(jsonb_typeof(v_in -> 'limite'), 'null') <> 'null'
     and btrim(v_in ->> 'limite') <> '' then
    if btrim(v_in ->> 'limite') !~ '^\d{1,3}$'
       or (btrim(v_in ->> 'limite'))::integer not between 1 and 500 then
      raise exception 'Limite de 1 a 500 vagas.' using errcode = '22023';
    end if;
    v_limite := (btrim(v_in ->> 'limite'))::integer;
  end if;

  -- Anexos (robô da Empregare): true/false ou "true"/"false"; só nos modos normal e forcar.
  if v_robo ? 'anexos' and coalesce(jsonb_typeof(v_in -> 'anexos'), 'null') <> 'null' then
    if v_in -> 'anexos' in ('true'::jsonb, '"true"'::jsonb) then
      v_anexos := true;
    elsif v_in -> 'anexos' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_anexos := false;
    else
      raise exception 'Opção “anexos” inválida (sim ou não).' using errcode = '22023';
    end if;
    if v_anexos and v_modo not in ('normal', 'forcar') then
      raise exception 'Guardar os links dos anexos só nos modos Normal e Forçar.' using errcode = '22023';
    end if;
  end if;

  -- Seco (modo anexos): true/false ou "true"/"false".
  if v_robo ? 'seco' and coalesce(jsonb_typeof(v_in -> 'seco'), 'null') <> 'null' then
    if v_in -> 'seco' in ('true'::jsonb, '"true"'::jsonb) then
      v_seco := true;
    elsif v_in -> 'seco' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_seco := false;
    else
      raise exception 'Opção “seco” inválida (sim ou não).' using errcode = '22023';
    end if;
  end if;

  -- Forçar edital congelado (20261020170000): true/false ou "true"/"false", com motivo.
  if v_robo ? 'forcar_congelado' and coalesce(jsonb_typeof(v_in -> 'forcar_congelado'), 'null') <> 'null' then
    if v_in -> 'forcar_congelado' in ('true'::jsonb, '"true"'::jsonb) then
      v_forcar_congelado := true;
    elsif v_in -> 'forcar_congelado' not in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      raise exception 'Opção “forcar_congelado” inválida (sim ou não).' using errcode = '22023';
    end if;
  end if;
  if v_robo ? 'motivo' and coalesce(jsonb_typeof(v_in -> 'motivo'), 'null') <> 'null' then
    if jsonb_typeof(v_in -> 'motivo') <> 'string' then
      raise exception 'Motivo inválido.' using errcode = '22023';
    end if;
    v_motivo := nullif(btrim(v_in ->> 'motivo'), '');
  end if;
  if v_motivo is not null and not v_forcar_congelado then
    raise exception 'O motivo só vale com “Forçar edital com inscrições congeladas”.' using errcode = '22023';
  end if;

  -- Só anexos: relê os anexos do questionário sem exportar; pede vagas ou editais.
  if v_modo = 'anexos' then
    if cardinality(v_vagas) = 0 and cardinality(v_editais) = 0 then
      raise exception 'O modo Só anexos pede vagas ou editais.' using errcode = '22023';
    end if;
  elsif cardinality(v_candidatos) > 0 or coalesce(v_seco, false) then
    raise exception 'Candidatos e "só comparar" só no modo Só anexos.' using errcode = '22023';
  end if;

  -- Sondar (como o workflow exige): uma única vaga, sem editais, limite de 1 a 3 candidatos.
  if v_modo = 'sondar' then
    if cardinality(v_vagas) <> 1 or cardinality(v_editais) > 0 then
      raise exception 'O modo Sondar pede um único código de vaga (sem editais).' using errcode = '22023';
    end if;
    if v_limite is not null and v_limite > 3 then
      raise exception 'No modo Sondar, o limite é de 1 a 3 candidatos.' using errcode = '22023';
    end if;
  end if;

  -- Quem pode (o banco decide, como em api/rodar-carga.js).
  if not public.pode_disparar_carga() then
    if not coalesce((v_robo ->> 'por_edital')::boolean, false) then
      raise exception 'Só o administrador global roda as cargas.' using errcode = '42501';
    end if;
    if v_modo <> 'normal' or cardinality(v_vagas) > 0 or v_limite is not null or v_forcar_congelado
       or cardinality(v_editais) <> 1 or v_editais[1] !~ c_uuid then
      raise exception 'Só o administrador global roda as cargas com opções.' using errcode = '42501';
    end if;
    if not public.pode_recalcular_pre_classificacao(v_editais[1]::uuid) then
      raise exception 'Só a coordenação da avaliação do edital recalcula a pré-classificação.' using errcode = '42501';
    end if;
  end if;

  -- Duplo clique: o mesmo robô pedido há menos de 2 min (e ainda não recusado).
  if exists (
    select 1 from public."TL_DISPARO_ROBO" d
     where d."NO_WORKFLOW" = v_robo ->> 'workflow'
       and d."TP_SITUACAO" in ('PEDIDO', 'ACEITO')
       and d."DT_DISPARO" > now() - interval '2 minutes') then
    raise exception 'Esta carga acabou de ser pedida. Aguarde alguns minutos.' using errcode = '55006';
  end if;

  -- [congeladas] Inscrições congeladas (20261020170000): nos modos que gravam, o edital ou a
  -- vaga pedidos explicitamente de edital congelado são recusados; o administrador global
  -- pode forçar, com motivo (a LIBERACAO vale 12 h e vai ao workflow como forcar_congelado).
  -- Sem edital nem vaga, o robô e a pré-classificação pulam os congelados sozinhos.
  if (v_robo -> 'modos_que_gravam') ? v_modo then
    select coalesce(array_agg(distinct m.id), '{}'),
           string_agg(distinct coalesce(private."FC_NUMERO_EDITAL"(m.edital), m.edital), ', ')
      into v_congelados, v_rotulos
      from public."TB_CONGELAMENTO_INSCRICAO" c
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c."CO_MONITORAMENTO"
     where c."ST_INSCRICOES_CONGELADAS" = 'S'
       and (m.id::text = any (v_editais)
            or private."FC_NUMERO_EDITAL"(m.edital) = any (v_editais)
            or exists (select 1 from public."TB_EMPREGARE_VAGA" v
                        where v."CO_MONITORAMENTO" = m.id and v."CO_VAGA" = any (v_vagas)));
    if cardinality(v_congelados) > 0 and not v_forcar_congelado then
      raise exception 'Inscrições congeladas: %. O robô e a pré-classificação não mexem neste edital; tire-o do pedido (só o administrador global força, com motivo).', v_rotulos
        using errcode = '55000';
    end if;
    if v_forcar_congelado then
      if not public.pode_disparar_carga() then
        raise exception 'Só o administrador global força edital com inscrições congeladas.' using errcode = '42501';
      end if;
      if v_motivo is null or length(v_motivo) not between 10 and 500 then
        raise exception 'Informe o motivo para forçar (10 a 500 caracteres).' using errcode = '22023';
      end if;
      if cardinality(v_congelados) = 0 then
        raise exception 'Nenhum edital ou vaga pedida está com as inscrições congeladas.' using errcode = '22023';
      end if;
      v_liberacao := gen_random_uuid();
      insert into public."TH_CONGELAMENTO_INSCRICAO"
             ("CO_MONITORAMENTO", "TP_EVENTO", "DS_MOTIVO", "CO_USUARIO", "CO_LIBERACAO", "DT_VALIDADE")
      select x, 'LIBERACAO', v_motivo, v_uid, v_liberacao, now() + interval '12 hours'
        from unnest(v_congelados) x;
    end if;
  elsif v_forcar_congelado then
    raise exception 'Forçar edital congelado só nos modos que gravam.' using errcode = '22023';
  end if;

  v_saida := jsonb_build_object('modo', v_modo);
  if coalesce((v_robo ->> 'por_edital')::boolean, false) or cardinality(v_editais) > 0 then
    v_saida := v_saida || jsonb_build_object('editais', array_to_string(v_editais, ','));
  end if;
  if cardinality(v_vagas) > 0 then
    v_saida := v_saida || jsonb_build_object('vagas', array_to_string(v_vagas, ','));
  end if;
  if v_limite is not null then
    v_saida := v_saida || jsonb_build_object('limite', v_limite::text);
  end if;
  if v_anexos is not null then
    v_saida := v_saida || jsonb_build_object('anexos', case when v_anexos then 'true' else 'false' end);
  end if;
  if cardinality(v_candidatos) > 0 then
    v_saida := v_saida || jsonb_build_object('candidatos', array_to_string(v_candidatos, ','));
  end if;
  if v_modo = 'anexos' then
    v_saida := v_saida || jsonb_build_object('seco', case when coalesce(v_seco, false) then 'true' else 'false' end);
  end if;

  if v_liberacao is not null then
    v_saida := v_saida || jsonb_build_object('forcar_congelado', v_liberacao::text);
  end if;

  v_disparo := private."FC_DISPARAR_ROBO"(v_robo ->> 'workflow', v_saida, v_uid);
  if v_liberacao is not null then
    update public."TH_CONGELAMENTO_INSCRICAO" h set "CO_DISPARO" = v_disparo
     where h."CO_LIBERACAO" = v_liberacao and h."TP_EVENTO" = 'LIBERACAO';
  end if;
  return v_disparo;
end;
$function$;
comment on function public.disparar_robo(text, jsonb) is
  'Rodar agora, Opções (Status das atualizações) e Recalcular (pré-classificação) pelo banco (20261008140000; substitui api/rodar-carga.js): confere quem pede (administrador global: qualquer robô e opções; coordenação: só a pré-classificação de um edital pelo id, modo normal), a lista branca do robô (modo, editais, vagas, limite, anexos; no robô da Empregare o modo "anexos" — só relê os anexos do questionário, sem exportar nem pré-classificar; pede vagas ou editais — com "candidatos" e "seco", que só valem nele) e o pedido repetido em 2 min (55006). Inscrições congeladas (20261020170000): nos modos que gravam (robô: normal e forcar; pré-classificação: normal e refazer_lote), edital ou vaga pedidos de edital congelado dão 55000, salvo forcar_congelado = true com motivo (10 a 500), só do administrador global — grava a LIBERACAO em TH_CONGELAMENTO_INSCRICAO (12 h) e manda o token como forcar_congelado. Pede o workflow por FC_DISPARAR_ROBO com disparado_por = id de quem pediu e devolve o CO_DISPARO de TL_DISPARO_ROBO (acompanhe por situacao_do_disparo_robo). 28000 sem sessão, 42501 sem permissão, 22023 para opção inválida.';
revoke all on function public.disparar_robo(text, jsonb) from public, anon;
grant execute on function public.disparar_robo(text, jsonb) to authenticated;

-- 11. Status das atualizações: o ator e o link das execuções iniciadas no GitHub -------------
create or replace function public.get_saude_das_cargas()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tarefas json;
  v_chave_cadastrada boolean;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê a saúde das cargas' using errcode = '42501';
  end if;

  -- pg_cron pode não estar acessível: a seção mostra "indisponível" nessa parte.
  begin
    select coalesce(json_agg(json_build_object(
        'nome', j.jobname,
        'agenda', j.schedule,
        'ativa', j.active,
        'execucoes', (
          select coalesce(json_agg(json_build_object(
              'inicio', d.start_time,
              'fim', d.end_time,
              'situacao', d.status,
              'mensagem', left(d.return_message, 500)
            ) order by d.start_time desc), '[]'::json)
            from (select * from cron.job_run_details r
                   where r.jobid = j.jobid
                   order by r.start_time desc limit 10) d
        )
      ) order by j.jobname), '[]'::json)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := null;
  end;

  -- [agenda-dos-robos] só se a chave existe (nunca o valor); null se o Vault não deixar ver.
  begin
    select exists (select 1 from vault.secrets s where s.name = 'github_disparo_robos')
      into v_chave_cadastrada;
  exception when others then
    v_chave_cadastrada := null;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'analises', (
      select coalesce(json_agg(json_build_object(
          'origem', o."CO_ORIGEM",
          'area', p."CO_AREA",
          'planilha', p."NO_PLANILHA",
          'tipo', o."TP_CARGA",
          'execucoes', (
            select coalesce(json_agg(json_build_object(
                'inicio', x.j ->> 'started_at',
                'fim', x.j ->> 'finished_at',
                'situacao', x.j ->> 'status',
                'linhas', coalesce(x.j ->> 'total_processados', x.j ->> 'total_lidos', x.j ->> 'linhas_staging'),
                'mensagem', left(coalesce(x.j ->> 'erro', x.j ->> 'mensagem'), 500),
                -- [nao-trava] encerrada por inatividade (20261007170000)
                'encerrada_por_inatividade', coalesce((x.j -> 'resultado' ->> 'encerrada_por_inatividade')::boolean, false)
              ) order by x.inicio desc nulls last), '[]'::json)
              from (select to_jsonb(s) as j, s.started_at as inicio
                      from public."TL_SYNC_ANALISE" s
                     where s.origem = o."CO_ORIGEM"
                     order by s.started_at desc nulls last
                     limit 10) x
          )
        ) order by p."CO_AREA", o."TP_CARGA" desc), '[]'::json)
        from public."TA_ORIGEM_ANALISE" o
        join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = o."CO_PLANILHA"
    ),
    'entrevistas', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'area', e."CO_AREA"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_ENTREVISTA" t order by t."DT_INICIO" desc limit 10) e
    ),
    'selecao', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_SELECAO" t order by t."DT_INICIO" desc limit 10) e
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'disparo', e."TP_DISPARO",
          'vagas_pedidas', e."QT_VAGA_PEDIDA",
          'vagas_baixadas', e."QT_VAGA_BAIXADA",
          'vagas_falha', e."QT_VAGA_FALHA",
          'vagas_recusadas', e."QT_VAGA_RECUSADA",
          'desativadas', e."QT_DESATIVADA",
          'execucao', e."DS_URL_EXECUCAO"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 10) e
    ),
    'conferencias', (
      select coalesce(json_agg(json_build_object(
          'inicio', c."DT_INICIO",
          'fim', c."DT_FIM",
          'situacao', c."TP_SITUACAO",
          'linhas', c."QT_AVISO_ABERTO",
          'mensagem', c."DS_MENSAGEM",
          'disparo', c."TP_DISPARO",
          'novos', c."QT_AVISO_NOVO",
          'abertos', c."QT_AVISO_ABERTO",
          'resolvidos', c."QT_AVISO_RESOLVIDO",
          'falhas', c."DS_FALHA",
          'execucao', c."DS_URL_EXECUCAO"
        ) order by c."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_CONFERENCIA" t order by t."DT_INICIO" desc limit 10) c
    ),
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
          'inicio', p."DT_INICIO",
          'fim', p."DT_FIM",
          'situacao', p."TP_SITUACAO",
          'linhas', p."QT_INSCRITO",
          'mensagem', p."DS_MENSAGEM",
          'disparo', p."TP_DISPARO",
          'editais', p."QT_EDITAL",
          'vagas', p."QT_VAGA",
          'lote', p."QT_LOTE",
          'refazer', p."ST_REFAZER_LOTE" = 'S',
          'execucao', p."DS_URL_EXECUCAO"
        ) order by p."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t where not private."FC_EXECUCAO_EH_TREINAMENTO"(t."CO_EXECUCAO") order by t."DT_INICIO" desc limit 10) p
    ),
    -- [agenda-dos-robos] os pedidos do banco ao GitHub (20261008140000)
    'agenda_dos_robos', json_build_object(
      'chave_cadastrada', v_chave_cadastrada,
      'ultimo_aceito', (select max(d."DT_DISPARO") from public."TL_DISPARO_ROBO" d where d."TP_SITUACAO" = 'ACEITO'),
      'falhas_24h', (select count(*) from public."TL_DISPARO_ROBO" d
                      where d."TP_SITUACAO" = 'FALHOU' and d."DT_DISPARO" > now() - interval '24 hours'),
      'sem_chave_24h', (select count(*) from public."TL_DISPARO_ROBO" d
                         where d."TP_SITUACAO" = 'SEM_TOKEN' and d."DT_DISPARO" > now() - interval '24 hours'),
      'disparos', (
        select coalesce(json_agg(json_build_object(
            'workflow', x."NO_WORKFLOW",
            'origem', x."TP_ORIGEM",
            'inicio', x."DT_DISPARO",
            'fim', x."DT_RESPOSTA",
            'situacao', x."TP_SITUACAO",
            'http', x."NU_STATUS_HTTP",
            'mensagem', x."DS_MENSAGEM",
            -- [disparos-externos] quem iniciou no GitHub e o link da execução (20261020170000)
            'ator', x."NO_ATOR_GITHUB",
            'execucao', x."DS_URL_EXECUCAO"
          ) order by x."DT_DISPARO" desc, x."CO_DISPARO" desc), '[]'::json)
          from (select * from public."TL_DISPARO_ROBO" t
                 order by t."DT_DISPARO" desc, t."CO_DISPARO" desc limit 20) x
      )
    ),
    'tarefas', v_tarefas
  );
end;
$function$;

-- 12. Comentários e permissões das RPCs novas ------------------------------------------------
comment on function public.obter_congelamento_inscricoes(uuid) is
  'Trava "inscrições congeladas" do edital (20261020170000), para o cartão da aba Pré-classificação: congelado, motivo, em, por (nome), pode_alterar (coordenação da avaliação do edital ou administrador global) e os 10 últimos eventos (congelar, descongelar, liberação do administrador global). Quem lê a avaliação documental do edital (FC_EXIGIR_AVALIACAO_EDITAL).';
revoke all on function public.obter_congelamento_inscricoes(uuid) from public, anon;
grant execute on function public.obter_congelamento_inscricoes(uuid) to authenticated;

comment on function public.alterar_congelamento_inscricoes(uuid, boolean, text) is
  'Congela (p_congelar = true) ou libera as inscrições do edital (20261020170000), com motivo de 10 a 500 caracteres; grava o estado em TB_CONGELAMENTO_INSCRICAO e o evento em TH_CONGELAMENTO_INSCRICAO e devolve obter_congelamento_inscricoes. Só a coordenação da avaliação do edital ou o administrador global (pode_recalcular_pre_classificacao). 28000 sem sessão, 42501 sem permissão, 22023 entrada inválida, 55000 já está no estado pedido.';
revoke all on function public.alterar_congelamento_inscricoes(uuid, boolean, text) from public, anon;
grant execute on function public.alterar_congelamento_inscricoes(uuid, boolean, text) to authenticated;

comment on function public.registrar_uso_liberacao_congelamento(uuid, text) is
  'Robô da Empregare e pré-classificação (service_role, 20261020170000): registra (USO) que a execução p_execucao usa a liberação p_liberacao (forcar_congelado do workflow) — só a LIBERACAO dentro da validade; idempotente. É o que deixa FC_EMPREGARE_ABRIR_VAGA gravar a vaga do edital congelado. Devolve os editais liberados nesta execução.';
revoke all on function public.registrar_uso_liberacao_congelamento(uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_uso_liberacao_congelamento(uuid, text) to service_role;

comment on function public.registrar_disparo_externo(text, text, text, text) is
  'Workflows do GitHub Actions (service_role, 20261020170000): no início de uma execução iniciada direto no GitHub (Run workflow, gh workflow run — disparado_por vazio), registra em TL_DISPARO_ROBO a origem GITHUB, a situação INICIADO, o ator (github.triggering_actor, login válido ou nulo), o endereço da execução e um resumo curto (até 300). Uma linha por execução (repetir devolve a mesma). 22023 para workflow fora da lista ou endereço inválido. O workflow nunca falha por causa deste registro.';
revoke all on function public.registrar_disparo_externo(text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_disparo_externo(text, text, text, text) to service_role;

commit;
