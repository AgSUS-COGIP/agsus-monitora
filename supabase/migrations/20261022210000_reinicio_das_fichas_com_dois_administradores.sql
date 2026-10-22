/*
  REINICIAR AS FICHAS DO EDITAL SÓ COM DOIS ADMINISTRADORES

  Por quê (22/10/2026): public.reiniciar_fichas_do_edital(p_edital, p_motivo)
  pedia só um administrador global e um motivo de 10 caracteres e voltava a
  PENDENTE toda ficha iniciada do edital, inclusive as CONCLUIDA. No 114/2026
  (1.509 fichas concluídas) um clique zeraria a análise. O reinício de edital
  com trabalho feito passa a ser uma ação de dois administradores globais
  diferentes, com o número do edital digitado nos dois passos.

  O QUE ENTRA
    public."TB_PEDIDO_REINICIO_FICHA"   o pedido: quem pediu, quando, motivo, o
                        impacto no momento (fichas concluídas, em análise e
                        iniciadas), validade de 24 h e a decisão (quem aprovou,
                        recusou ou cancelou, quando e quantas fichas voltaram).
                        Um pedido PENDENTE por edital. A aprovação (EXECUTADO ou
                        RECUSADO) tem de ser de outra pessoa (check no banco).
    public."TH_PEDIDO_REINICIO_FICHA"   histórico de cada pedido: PEDIR, CANCELAR,
                        RECUSAR, APROVAR, EXECUTAR (com o resultado do reinício)
                        e VENCER. Só cresce.
    private."FC_ADMIN_GLOBAL_ATIVO"(p_usuario)       perfil ativo de administrador global.
    private."FC_IMPACTO_REINICIO_FICHAS"(p_edital)   concluídas, em análise (EM_ANALISE e
                        REVISAR), em análise com lançamento, iniciadas
                        (FC_FICHAS_INICIADAS) e se exige a aprovação (concluídas ou
                        em análise com lançamento).
    private."FC_BLOQUEIO_REINICIO_FICHAS"(p_edital)  a frase da recusa quando o edital
                        está com as inscrições congeladas (FC_INSCRICOES_CONGELADAS)
                        ou encerrado (FC_EDITAIS_ENCERRADOS); null quando pode.
    private."FC_CONFIRMACAO_DO_EDITAL"(p_edital, p_confirmacao)  o número digitado
                        confere com o do edital (FC_NUMERO_EDITAL: "114/2026" =
                        "0114 / 2026"; edital sem número: o nome exato).
    private."FC_LER_REINICIO_FICHAS"(p_edital, p_usuario)  o que a tela mostra.
    public.obter_reinicio_fichas_do_edital(p_edital)
    public.pedir_reinicio_fichas_do_edital(p_edital, p_motivo, p_confirmacao)
                        administrador A: motivo de 10 a 1.000 caracteres que pareça
                        texto (FC_MOTIVO_PARECE_TEXTO, 3 palavras) e o número do
                        edital; recusa edital congelado, encerrado, sem ficha
                        iniciada ou com pedido pendente.
    public.aprovar_reinicio_fichas_do_edital(p_pedido, p_confirmacao)
                        administrador B, diferente de A, com o número do edital:
                        só então o reinício roda (FC_REINICIAR_FICHAS_DO_EDITAL,
                        histórico REINICIAR por ficha com B como autor e o número do
                        pedido no motivo). Pedido vencido não executa.
    public.recusar_reinicio_fichas_do_edital(p_pedido, p_confirmacao, p_motivo)
                        outro administrador nega o pedido.
    public.cancelar_reinicio_fichas_do_edital(p_pedido)
                        quem pediu desiste.

  O QUE MUDA
    private."FC_REINICIAR_FICHAS_DO_EDITAL"   mesmo corpo de 20261013180000, mais a
                        trava de raiz: edital congelado ou encerrado é recusado
                        (55000) por qualquer caminho, inclusive o SQL Editor.
    public.reiniciar_fichas_do_edital   deixa de executar direto quando há ficha
                        CONCLUIDA ou EM_ANALISE/REVISAR com lançamento (55000,
                        orienta o pedido); edital sem ficha trabalhada segue como
                        antes, com um administrador.
    reiniciar_edital_treinamento não muda.

  Front velho: o botão antigo continua chamando reiniciar_fichas_do_edital e
  recebe a recusa com a orientação; nada executa sem os dois administradores.
  Aplicar antes do merge é seguro.

  Dependentes: src/lib/avaliacao-documental/reinicio-das-fichas.ts,
  src/modulos/avaliacao-documental/reinicio-das-fichas.tsx, fila.jsx,
  src/lib/rpc-contrato.js.
  Ensaio:   supabase/ensaios/20261022210000_reinicio_das_fichas_com_dois_administradores.sql
  Rollback: supabase/rollback/20261022210000_reinicio_das_fichas_com_dois_administradores.sql
*/
begin;

set local lock_timeout = '10s';

do $$
begin
  if to_regprocedure('private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid)') is null
     or to_regprocedure('private."FC_FICHAS_INICIADAS"(uuid)') is null
     or to_regprocedure('private."FC_INSCRICOES_CONGELADAS"(uuid)') is null
     or to_regprocedure('private."FC_EDITAIS_ENCERRADOS"()') is null
     or to_regprocedure('private."FC_MOTIVO_PARECE_TEXTO"(text, integer)') is null then
    raise exception 'Aplique antes 20261013180000, 20261020170000, 20261021110000 e 20261021180000.';
  end if;
end;
$$;

-- 1. O pedido e o histórico ----------------------------------------------------------------------
create table if not exists public."TB_PEDIDO_REINICIO_FICHA" (
  "CO_PEDIDO_REINICIO" bigint generated always as identity,
  "CO_MONITORAMENTO" uuid not null,
  "TP_SITUACAO" character varying(10) not null default 'PENDENTE',
  "DS_MOTIVO" character varying(1000) not null,
  "CO_USUARIO_PEDIDO" uuid not null,
  "DT_PEDIDO" timestamptz not null default now(),
  "DT_VALIDADE" timestamptz not null,
  "QT_CONCLUIDAS" integer not null,
  "QT_EM_ANALISE" integer not null,
  "QT_INICIADAS" integer not null,
  "CO_USUARIO_DECISAO" uuid,
  "DT_DECISAO" timestamptz,
  "DS_MOTIVO_DECISAO" character varying(1000),
  "QT_REINICIADAS" integer,
  constraint "PK_TB_PEDIDO_REINICIO_FICHA" primary key ("CO_PEDIDO_REINICIO"),
  constraint "FK_MONITORAMENTO_PEDREINFICHA" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_PEDREINFICHA_TPSITUACAO" check ("TP_SITUACAO" in ('PENDENTE', 'EXECUTADO', 'RECUSADO', 'CANCELADO', 'VENCIDO')),
  constraint "CK_PEDREINFICHA_DSMOTIVO" check (length(btrim("DS_MOTIVO")) between 10 and 1000),
  constraint "CK_PEDREINFICHA_DTVALIDADE" check ("DT_VALIDADE" > "DT_PEDIDO"),
  constraint "CK_PEDREINFICHA_QUANTIDADES" check (
    "QT_CONCLUIDAS" >= 0 and "QT_EM_ANALISE" >= 0 and "QT_INICIADAS" >= 0
    and coalesce("QT_REINICIADAS", 0) >= 0),
  constraint "CK_PEDREINFICHA_DECISAO" check (
    ("TP_SITUACAO" = 'PENDENTE' and "CO_USUARIO_DECISAO" is null and "DT_DECISAO" is null and "QT_REINICIADAS" is null)
    or ("TP_SITUACAO" = 'EXECUTADO' and "CO_USUARIO_DECISAO" is not null and "DT_DECISAO" is not null
        and "CO_USUARIO_DECISAO" <> "CO_USUARIO_PEDIDO" and "QT_REINICIADAS" is not null)
    or ("TP_SITUACAO" = 'RECUSADO' and "CO_USUARIO_DECISAO" is not null and "DT_DECISAO" is not null
        and "CO_USUARIO_DECISAO" <> "CO_USUARIO_PEDIDO" and "QT_REINICIADAS" is null)
    or ("TP_SITUACAO" = 'CANCELADO' and "CO_USUARIO_DECISAO" = "CO_USUARIO_PEDIDO" and "DT_DECISAO" is not null
        and "QT_REINICIADAS" is null)
    or ("TP_SITUACAO" = 'VENCIDO' and "CO_USUARIO_DECISAO" is null and "DT_DECISAO" is not null and "QT_REINICIADAS" is null)),
  constraint "CK_PEDREINFICHA_DSMOTIVODEC" check ("DS_MOTIVO_DECISAO" is null or length(btrim("DS_MOTIVO_DECISAO")) between 10 and 1000)
);
comment on table public."TB_PEDIDO_REINICIO_FICHA" is
  'Pedidos de reinício das fichas de um edital (20261022210000): um administrador global pede (motivo e o número do edital digitado), outro administrador global, diferente, aprova e só então o reinício roda (FC_REINICIAR_FICHAS_DO_EDITAL). Vale 24 h; quem pediu pode cancelar; outro pode recusar. Um PENDENTE por edital. Escrita só pelas RPCs pedir/aprovar/recusar/cancelar_reinicio_fichas_do_edital.';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."CO_PEDIDO_REINICIO" is 'Número do pedido (sequencial).';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."TP_SITUACAO" is 'PENDENTE, EXECUTADO (aprovado e reiniciado), RECUSADO, CANCELADO (por quem pediu) ou VENCIDO (passou da validade sem decisão).';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."DS_MOTIVO" is 'Motivo do pedido (10 a 1.000 caracteres, parece texto).';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."CO_USUARIO_PEDIDO" is 'Administrador global que pediu (auth.users.id).';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."DT_PEDIDO" is 'Quando pediu.';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."DT_VALIDADE" is 'Até quando a aprovação vale (24 h depois do pedido).';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."QT_CONCLUIDAS" is 'Fichas CONCLUIDA no momento do pedido.';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."QT_EM_ANALISE" is 'Fichas EM_ANALISE ou REVISAR no momento do pedido.';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."QT_INICIADAS" is 'Fichas iniciadas (FC_FICHAS_INICIADAS) no momento do pedido.';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."CO_USUARIO_DECISAO" is 'Quem aprovou ou recusou (outro administrador) ou cancelou (quem pediu); vazio no VENCIDO.';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."DT_DECISAO" is 'Quando foi decidido (ou marcado vencido).';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."DS_MOTIVO_DECISAO" is 'Motivo da recusa, quando informado.';
comment on column public."TB_PEDIDO_REINICIO_FICHA"."QT_REINICIADAS" is 'No EXECUTADO: quantas fichas voltaram ao início.';
comment on constraint "PK_TB_PEDIDO_REINICIO_FICHA" on public."TB_PEDIDO_REINICIO_FICHA" is 'Um pedido por linha.';
comment on constraint "FK_MONITORAMENTO_PEDREINFICHA" on public."TB_PEDIDO_REINICIO_FICHA" is 'Edital do pedido.';
comment on constraint "CK_PEDREINFICHA_TPSITUACAO" on public."TB_PEDIDO_REINICIO_FICHA" is 'Situações válidas.';
comment on constraint "CK_PEDREINFICHA_DSMOTIVO" on public."TB_PEDIDO_REINICIO_FICHA" is 'Motivo de 10 a 1.000 caracteres.';
comment on constraint "CK_PEDREINFICHA_DTVALIDADE" on public."TB_PEDIDO_REINICIO_FICHA" is 'A validade vem depois do pedido.';
comment on constraint "CK_PEDREINFICHA_QUANTIDADES" on public."TB_PEDIDO_REINICIO_FICHA" is 'Quantidades não negativas.';
comment on constraint "CK_PEDREINFICHA_DECISAO" on public."TB_PEDIDO_REINICIO_FICHA" is 'Campos de cada situação; aprovar e recusar só por outra pessoa; cancelar só por quem pediu.';
comment on constraint "CK_PEDREINFICHA_DSMOTIVODEC" on public."TB_PEDIDO_REINICIO_FICHA" is 'Motivo da recusa de 10 a 1.000 caracteres.';
create unique index if not exists "UK_PEDREINFICHA_PENDENTE" on public."TB_PEDIDO_REINICIO_FICHA" ("CO_MONITORAMENTO")
  where "TP_SITUACAO" = 'PENDENTE';
comment on index public."UK_PEDREINFICHA_PENDENTE" is 'Um pedido pendente por edital.';
create index if not exists "IN_PEDREINFICHA_COMONITOR_DTPEDIDO" on public."TB_PEDIDO_REINICIO_FICHA" ("CO_MONITORAMENTO", "DT_PEDIDO" desc);
comment on index public."IN_PEDREINFICHA_COMONITOR_DTPEDIDO" is 'Os pedidos de um edital, do mais novo ao mais antigo.';
alter table public."TB_PEDIDO_REINICIO_FICHA" enable row level security;
revoke all on public."TB_PEDIDO_REINICIO_FICHA" from public, anon, authenticated, service_role;

create table if not exists public."TH_PEDIDO_REINICIO_FICHA" (
  "CO_EVENTO" bigint generated always as identity,
  "CO_PEDIDO_REINICIO" bigint not null,
  "CO_MONITORAMENTO" uuid not null,
  "TP_EVENTO" character varying(10) not null,
  "CO_USUARIO" uuid,
  "DS_MOTIVO" character varying(1000),
  "DS_DETALHE" jsonb not null default '{}'::jsonb,
  "DT_EVENTO" timestamptz not null default now(),
  constraint "PK_TH_PEDIDO_REINICIO_FICHA" primary key ("CO_EVENTO"),
  constraint "FK_PEDREINFICHA_HISTPEDREINFICHA" foreign key ("CO_PEDIDO_REINICIO")
    references public."TB_PEDIDO_REINICIO_FICHA" ("CO_PEDIDO_REINICIO") on delete cascade,
  constraint "FK_MONITORAMENTO_HISTPEDREINFICHA" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_HISTPEDREINFICHA_TPEVENTO" check ("TP_EVENTO" in ('PEDIR', 'CANCELAR', 'RECUSAR', 'APROVAR', 'EXECUTAR', 'VENCER')),
  constraint "CK_HISTPEDREINFICHA_COUSUARIO" check (("TP_EVENTO" = 'VENCER') = ("CO_USUARIO" is null)),
  constraint "CK_HISTPEDREINFICHA_DSDETALHE" check (jsonb_typeof("DS_DETALHE") = 'object')
);
comment on table public."TH_PEDIDO_REINICIO_FICHA" is
  'Histórico dos pedidos de reinício das fichas (20261022210000): PEDIR (impacto no momento), CANCELAR, RECUSAR, APROVAR (impacto na aprovação), EXECUTAR (resultado de FC_REINICIAR_FICHAS_DO_EDITAL) e VENCER. Só cresce; o histórico de cada ficha continua em TH_FICHA_ANALISE (REINICIAR).';
comment on column public."TH_PEDIDO_REINICIO_FICHA"."CO_EVENTO" is 'Identificador do evento (sequencial).';
comment on column public."TH_PEDIDO_REINICIO_FICHA"."CO_PEDIDO_REINICIO" is 'Pedido (TB_PEDIDO_REINICIO_FICHA).';
comment on column public."TH_PEDIDO_REINICIO_FICHA"."CO_MONITORAMENTO" is 'Edital do pedido.';
comment on column public."TH_PEDIDO_REINICIO_FICHA"."TP_EVENTO" is 'PEDIR, CANCELAR, RECUSAR, APROVAR, EXECUTAR ou VENCER.';
comment on column public."TH_PEDIDO_REINICIO_FICHA"."CO_USUARIO" is 'Quem fez (auth.users.id); vazio no VENCER.';
comment on column public."TH_PEDIDO_REINICIO_FICHA"."DS_MOTIVO" is 'Motivo do pedido ou da recusa.';
comment on column public."TH_PEDIDO_REINICIO_FICHA"."DS_DETALHE" is 'Impacto (concluidas, em_analise, iniciadas…) ou o resultado do reinício.';
comment on column public."TH_PEDIDO_REINICIO_FICHA"."DT_EVENTO" is 'Quando aconteceu.';
comment on constraint "PK_TH_PEDIDO_REINICIO_FICHA" on public."TH_PEDIDO_REINICIO_FICHA" is 'Um evento por linha.';
comment on constraint "FK_PEDREINFICHA_HISTPEDREINFICHA" on public."TH_PEDIDO_REINICIO_FICHA" is 'Pedido do evento.';
comment on constraint "FK_MONITORAMENTO_HISTPEDREINFICHA" on public."TH_PEDIDO_REINICIO_FICHA" is 'Edital do evento.';
comment on constraint "CK_HISTPEDREINFICHA_TPEVENTO" on public."TH_PEDIDO_REINICIO_FICHA" is 'Eventos válidos.';
comment on constraint "CK_HISTPEDREINFICHA_COUSUARIO" on public."TH_PEDIDO_REINICIO_FICHA" is 'Todo evento tem autor, menos o VENCER.';
comment on constraint "CK_HISTPEDREINFICHA_DSDETALHE" on public."TH_PEDIDO_REINICIO_FICHA" is 'Detalhe é objeto JSON.';
create index if not exists "IN_HISTPEDREINFICHA_COMONITOR_DTEVENTO" on public."TH_PEDIDO_REINICIO_FICHA" ("CO_MONITORAMENTO", "DT_EVENTO" desc);
comment on index public."IN_HISTPEDREINFICHA_COMONITOR_DTEVENTO" is 'O histórico de um edital, do mais novo ao mais antigo.';
create index if not exists "IN_HISTPEDREINFICHA_COPEDIDO" on public."TH_PEDIDO_REINICIO_FICHA" ("CO_PEDIDO_REINICIO");
comment on index public."IN_HISTPEDREINFICHA_COPEDIDO" is 'Os eventos de um pedido.';
alter table public."TH_PEDIDO_REINICIO_FICHA" enable row level security;
revoke all on public."TH_PEDIDO_REINICIO_FICHA" from public, anon, authenticated, service_role;

-- 2. As perguntas ao edital ---------------------------------------------------------------------
create or replace function private."FC_ADMIN_GLOBAL_ATIVO"(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select p_usuario is not null and exists (
    select 1 from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.user_id = p_usuario and p.ativo is true and a."ST_ADMIN_GLOBAL");
$function$;
comment on function private."FC_ADMIN_GLOBAL_ATIVO"(uuid) is
  'A pessoa (auth.users.id) tem perfil ativo de administrador global? (20261022210000)';
revoke all on function private."FC_ADMIN_GLOBAL_ATIVO"(uuid) from public, anon, authenticated, service_role;

create or replace function private."FC_IMPACTO_REINICIO_FICHAS"(p_edital uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
           'concluidas', s.concluidas,
           'em_analise', s.em_analise,
           'com_lancamento', s.com_lancamento,
           'iniciadas', private."FC_FICHAS_INICIADAS"(p_edital),
           'exige_aprovacao', s.concluidas + s.com_lancamento > 0)
    from (select count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA')::integer as concluidas,
                 count(*) filter (where f."TP_SITUACAO" in ('EM_ANALISE', 'REVISAR'))::integer as em_analise,
                 count(*) filter (where f."TP_SITUACAO" in ('EM_ANALISE', 'REVISAR')
                                    and f."DS_LANCAMENTO" is not null)::integer as com_lancamento
            from public."TB_FICHA_ANALISE" f
           where f."CO_MONITORAMENTO" = p_edital) s;
$function$;
comment on function private."FC_IMPACTO_REINICIO_FICHAS"(uuid) is
  'O que o reinício das fichas do edital desfaria (20261022210000): concluidas, em_analise (EM_ANALISE e REVISAR), com_lancamento (em análise com lançamento), iniciadas (FC_FICHAS_INICIADAS) e exige_aprovacao (há concluída ou em análise com lançamento: só com dois administradores).';
revoke all on function private."FC_IMPACTO_REINICIO_FICHAS"(uuid) from public, anon, authenticated, service_role;

create or replace function private."FC_BLOQUEIO_REINICIO_FICHAS"(p_edital uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select case
           when private."FC_INSCRICOES_CONGELADAS"(p_edital)
             then 'As inscrições deste edital estão congeladas. Libere o congelamento na Pré-classificação antes de reiniciar as fichas.'
           when exists (select 1 from private."FC_EDITAIS_ENCERRADOS"() e where e."CO_MONITORAMENTO" = p_edital)
             then 'Este edital está encerrado (todas as fichas do lote concluídas). O reinício não é permitido.'
         end;
$function$;
comment on function private."FC_BLOQUEIO_REINICIO_FICHAS"(uuid) is
  'Por que o reinício das fichas do edital é recusado mesmo com dois administradores (20261022210000): inscrições congeladas (FC_INSCRICOES_CONGELADAS) ou edital encerrado (FC_EDITAIS_ENCERRADOS). Null quando pode.';
revoke all on function private."FC_BLOQUEIO_REINICIO_FICHAS"(uuid) from public, anon, authenticated, service_role;

create or replace function private."FC_CONFIRMACAO_DO_EDITAL"(p_edital uuid, p_confirmacao text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select case
             when private."FC_NUMERO_EDITAL"(m.edital) is not null
               then private."FC_NUMERO_EDITAL"(p_confirmacao) = private."FC_NUMERO_EDITAL"(m.edital)
             else lower(btrim(coalesce(p_confirmacao, ''))) = lower(btrim(m.edital))
           end
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m.id = p_edital), false);
$function$;
comment on function private."FC_CONFIRMACAO_DO_EDITAL"(uuid, text) is
  'O texto digitado confere com o número do edital (FC_NUMERO_EDITAL dos dois; edital sem número: o nome, sem diferença de maiúsculas)? (20261022210000)';
revoke all on function private."FC_CONFIRMACAO_DO_EDITAL"(uuid, text) from public, anon, authenticated, service_role;

-- 3. A trava de raiz no reinício (corpo de 20261013180000 + edital congelado ou encerrado) ------------
create or replace function private."FC_REINICIAR_FICHAS_DO_EDITAL"(p_edital uuid, p_motivo text, p_usuario uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_f public."TB_FICHA_ANALISE";
  v_para text;
  v_antes jsonb := '{}'::jsonb;
  v_reiniciadas integer := 0;
  v_no_inicio integer := 0;
  v_fora integer := 0;
  v_bloqueio text;
begin
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo para reiniciar as fichas (10 a 2.000 caracteres).' using errcode = '22023';
  end if;
  if not private."FC_ADMIN_GLOBAL_ATIVO"(p_usuario) then
    raise exception 'Só o administrador global reinicia as fichas do edital' using errcode = '42501';
  end if;
  -- Trava o edital: ninguém abre fichas novas dele enquanto o reinício corre.
  perform 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital for update;
  if not found then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  -- Edital congelado ou encerrado: por nenhum caminho (20261022210000).
  v_bloqueio := private."FC_BLOQUEIO_REINICIO_FICHAS"(p_edital);
  if v_bloqueio is not null then
    raise exception '%', v_bloqueio using errcode = '55000';
  end if;

  for v_f in
    select * from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = p_edital
     order by f."CO_FICHA_ANALISE"
       for update
  loop
    -- A mesma régua do refazer do lote: campos ou histórico depois do último REINICIAR.
    if not private."FC_FICHA_INICIADA"(v_f) then
      if v_f."TP_SITUACAO" = 'FORA_LOTE' then
        v_fora := v_fora + 1;
      else
        v_no_inicio := v_no_inicio + 1;
      end if;
      continue;
    end if;
    -- Fora do lote continua fora (com o motivo da saída); o resto volta a PENDENTE.
    v_para := case when v_f."TP_SITUACAO" = 'FORA_LOTE' then 'FORA_LOTE' else 'PENDENTE' end;

    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = v_para,
      "CO_USUARIO_RESPONSAVEL" = null, "DT_ATRIBUICAO" = null,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "DS_LANCAMENTO" = null, "DS_RESULTADO" = null, "DS_PARECER" = null, "TP_RESULTADO" = null,
      "VL_NOTA_APURADA" = null, "VL_NOTA_FINAL" = null,
      "CO_USUARIO_RASCUNHO" = null, "DT_RASCUNHO" = null,
      "CO_USUARIO_CONCLUSAO" = null, "DT_CONCLUSAO" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";

    insert into public."TH_FICHA_ANALISE"
      ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
       "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO", "TP_RESULTADO", "VL_NOTA_FINAL", "DS_ALTERACAO")
    select v_f."CO_FICHA_ANALISE", v_f."NU_VERSAO" + 1, 'REINICIAR', v_f."TP_SITUACAO", v_para,
           v_f."CO_USUARIO_RESPONSAVEL", null, v_motivo, 'TELA', p_usuario, null, null,
           coalesce(jsonb_agg(jsonb_build_object('campo', a.campo, 'de', a.de, 'para', a.para) order by a.ordem), '[]'::jsonb)
      from (values
              (1, 'situacao', to_jsonb(v_f."TP_SITUACAO"), to_jsonb(v_para)),
              (2, 'responsavel', to_jsonb(v_f."CO_USUARIO_RESPONSAVEL"), null),
              (3, 'reserva', to_jsonb(v_f."CO_USUARIO_RESERVA"), null),
              (4, 'resultado', to_jsonb(v_f."TP_RESULTADO"), null),
              (5, 'nota_apurada', to_jsonb(v_f."VL_NOTA_APURADA"), null),
              (6, 'nota_final', to_jsonb(v_f."VL_NOTA_FINAL"), null),
              (7, 'lancamento', v_f."DS_LANCAMENTO", null),
              (8, 'resultado_da_conta', v_f."DS_RESULTADO", null),
              (9, 'parecer', to_jsonb(v_f."DS_PARECER"), null),
              (10, 'rascunho', to_jsonb(v_f."DT_RASCUNHO"), null),
              (11, 'conclusao', to_jsonb(v_f."DT_CONCLUSAO"), null)
           ) as a(ordem, campo, de, para)
     where a.de is distinct from a.para;

    v_reiniciadas := v_reiniciadas + 1;
    v_antes := jsonb_set(v_antes, array[v_f."TP_SITUACAO"]::text[],
                         to_jsonb(coalesce((v_antes ->> v_f."TP_SITUACAO")::integer, 0) + 1));
  end loop;

  return json_build_object('edital', p_edital, 'reiniciadas', v_reiniciadas, 'por_situacao_anterior', v_antes,
                           'ja_no_inicio', v_no_inicio, 'fora_do_lote', v_fora, 'reiniciado_em', now());
end;
$function$;
comment on function private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid) is
  'Volta ao início toda ficha iniciada do edital (FC_FICHA_INICIADA: campos ou histórico depois do último REINICIAR): a do lote volta a PENDENTE; a FORA_LOTE continua FORA_LOTE. Sem responsável, reserva, lançamento, resultado, parecer, notas, rascunho e conclusão; versão + 1; histórico REINICIAR com o motivo (10 a 2.000), o autor (admin global ativo, 42501) e o que foi limpo. Recusa (55000) edital com inscrições congeladas ou encerrado (FC_BLOQUEIO_REINICIO_FICHAS, 20261022210000). Sem grant: chamado por reiniciar_fichas_do_edital (edital sem ficha trabalhada) e aprovar_reinicio_fichas_do_edital (dois administradores).';
revoke all on function private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid) from public, anon, authenticated, service_role;

-- 4. A leitura da tela ----------------------------------------------------------------------------
create or replace function private."FC_LER_REINICIO_FICHAS"(p_edital uuid, p_usuario uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
    'schema_version', 1,
    'edital', m.id,
    'numero', coalesce(private."FC_NUMERO_EDITAL"(m.edital), btrim(m.edital)),
    'validade_horas', 24,
    'impacto', private."FC_IMPACTO_REINICIO_FICHAS"(m.id),
    'bloqueio', private."FC_BLOQUEIO_REINICIO_FICHAS"(m.id),
    'pedido', (
      select json_build_object(
               'id', p."CO_PEDIDO_REINICIO",
               'situacao', p."TP_SITUACAO",
               'vencido', p."DT_VALIDADE" <= now(),
               'motivo', p."DS_MOTIVO",
               'por', private."FC_NOME_USUARIO"(p."CO_USUARIO_PEDIDO"),
               'meu', p."CO_USUARIO_PEDIDO" = p_usuario,
               'em', p."DT_PEDIDO",
               'validade', p."DT_VALIDADE",
               'impacto', json_build_object('concluidas', p."QT_CONCLUIDAS", 'em_analise', p."QT_EM_ANALISE",
                                            'iniciadas', p."QT_INICIADAS"))
        from public."TB_PEDIDO_REINICIO_FICHA" p
       where p."CO_MONITORAMENTO" = m.id and p."TP_SITUACAO" = 'PENDENTE'),
    'historico', coalesce((
      select json_agg(json_build_object(
               'pedido', h."CO_PEDIDO_REINICIO",
               'tipo', h."TP_EVENTO",
               'em', h."DT_EVENTO",
               'por', case when h."CO_USUARIO" is null then null else private."FC_NOME_USUARIO"(h."CO_USUARIO") end,
               'motivo', h."DS_MOTIVO",
               'reiniciadas', (h."DS_DETALHE" ->> 'reiniciadas')::integer)
             order by h."DT_EVENTO" desc, h."CO_EVENTO" desc)
        from (select * from public."TH_PEDIDO_REINICIO_FICHA" x
               where x."CO_MONITORAMENTO" = m.id
               order by x."DT_EVENTO" desc, x."CO_EVENTO" desc
               limit 20) h), '[]'::json))
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.id = p_edital;
$function$;
comment on function private."FC_LER_REINICIO_FICHAS"(uuid, uuid) is
  'O reinício das fichas do edital para a tela (20261022210000): número do edital (o que se digita), impacto atual, bloqueio (congelado/encerrado), o pedido pendente (vencido, motivo, quem pediu, se é de quem lê, validade e o impacto no pedido) e os últimos 20 eventos.';
revoke all on function private."FC_LER_REINICIO_FICHAS"(uuid, uuid) from public, anon, authenticated, service_role;

create or replace function public.obter_reinicio_fichas_do_edital(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_r json;
begin
  if not private."FC_ADMIN_GLOBAL_ATIVO"(v_usuario) then
    raise exception 'Só o administrador global vê o reinício das fichas do edital.' using errcode = '42501';
  end if;
  v_r := private."FC_LER_REINICIO_FICHAS"(p_edital, v_usuario);
  if v_r is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  return v_r;
end;
$function$;
comment on function public.obter_reinicio_fichas_do_edital(uuid) is
  'Só administrador global (42501): o reinício das fichas do edital (FC_LER_REINICIO_FICHAS) para o menu da Fila e o aviso de aprovação pendente (20261022210000).';
revoke all on function public.obter_reinicio_fichas_do_edital(uuid) from public, anon;
grant execute on function public.obter_reinicio_fichas_do_edital(uuid) to authenticated;

-- 5. Pedir, aprovar, recusar e cancelar -------------------------------------------------------------
create or replace function public.pedir_reinicio_fichas_do_edital(p_edital uuid, p_motivo text, p_confirmacao text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_motivo text := btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g'));
  v_bloqueio text;
  v_impacto jsonb;
  v_pedido bigint;
  v_vencido record;
begin
  if not private."FC_ADMIN_GLOBAL_ATIVO"(v_usuario) then
    raise exception 'Só o administrador global pede o reinício das fichas do edital.' using errcode = '42501';
  end if;
  if length(v_motivo) not between 10 and 1000 then
    raise exception 'Informe o motivo do reinício (10 a 1.000 caracteres).' using errcode = '22023';
  end if;
  if not private."FC_MOTIVO_PARECE_TEXTO"(v_motivo, 3) then
    raise exception 'Escreva o motivo do reinício com pelo menos 3 palavras.' using errcode = '22023';
  end if;
  perform 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital for update;
  if not found then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if not private."FC_CONFIRMACAO_DO_EDITAL"(p_edital, p_confirmacao) then
    raise exception 'O número digitado não confere com o do edital.' using errcode = '22023';
  end if;
  v_bloqueio := private."FC_BLOQUEIO_REINICIO_FICHAS"(p_edital);
  if v_bloqueio is not null then
    raise exception '%', v_bloqueio using errcode = '55000';
  end if;

  -- O pendente que passou da validade vira VENCIDO (abre lugar para o novo pedido).
  for v_vencido in
    update public."TB_PEDIDO_REINICIO_FICHA" p
       set "TP_SITUACAO" = 'VENCIDO', "DT_DECISAO" = now()
     where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" = 'PENDENTE' and p."DT_VALIDADE" <= now()
    returning p."CO_PEDIDO_REINICIO", p."DT_VALIDADE"
  loop
    insert into public."TH_PEDIDO_REINICIO_FICHA" ("CO_PEDIDO_REINICIO", "CO_MONITORAMENTO", "TP_EVENTO", "DS_DETALHE")
    values (v_vencido."CO_PEDIDO_REINICIO", p_edital, 'VENCER', jsonb_build_object('validade', v_vencido."DT_VALIDADE"));
  end loop;
  if exists (select 1 from public."TB_PEDIDO_REINICIO_FICHA" p
              where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" = 'PENDENTE') then
    raise exception 'Já há um pedido de reinício deste edital aguardando aprovação.' using errcode = '55000';
  end if;

  v_impacto := private."FC_IMPACTO_REINICIO_FICHAS"(p_edital);
  if (v_impacto ->> 'iniciadas')::integer = 0 then
    raise exception 'Nenhuma ficha deste edital foi iniciada: não há o que reiniciar.' using errcode = '55000';
  end if;

  insert into public."TB_PEDIDO_REINICIO_FICHA"
    ("CO_MONITORAMENTO", "DS_MOTIVO", "CO_USUARIO_PEDIDO", "DT_PEDIDO", "DT_VALIDADE",
     "QT_CONCLUIDAS", "QT_EM_ANALISE", "QT_INICIADAS")
  values (p_edital, v_motivo, v_usuario, now(), now() + interval '24 hours',
          (v_impacto ->> 'concluidas')::integer, (v_impacto ->> 'em_analise')::integer, (v_impacto ->> 'iniciadas')::integer)
  returning "CO_PEDIDO_REINICIO" into v_pedido;
  insert into public."TH_PEDIDO_REINICIO_FICHA" ("CO_PEDIDO_REINICIO", "CO_MONITORAMENTO", "TP_EVENTO", "CO_USUARIO", "DS_MOTIVO", "DS_DETALHE")
  values (v_pedido, p_edital, 'PEDIR', v_usuario, v_motivo, v_impacto);

  return private."FC_LER_REINICIO_FICHAS"(p_edital, v_usuario);
end;
$function$;
comment on function public.pedir_reinicio_fichas_do_edital(uuid, text, text) is
  'Administrador global A pede o reinício das fichas do edital (20261022210000): motivo de 10 a 1.000 que pareça texto (3 palavras) e o número do edital digitado (22023). Recusa (55000) edital congelado ou encerrado, sem ficha iniciada ou com pedido pendente. Grava o pedido (impacto no momento, validade de 24 h) e o evento PEDIR; nada muda nas fichas. Devolve a leitura (FC_LER_REINICIO_FICHAS).';
revoke all on function public.pedir_reinicio_fichas_do_edital(uuid, text, text) from public, anon;
grant execute on function public.pedir_reinicio_fichas_do_edital(uuid, text, text) to authenticated;

create or replace function public.aprovar_reinicio_fichas_do_edital(p_pedido bigint, p_confirmacao text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_edital uuid;
  v_p public."TB_PEDIDO_REINICIO_FICHA";
  v_bloqueio text;
  v_impacto jsonb;
  v_r json;
begin
  if not private."FC_ADMIN_GLOBAL_ATIVO"(v_usuario) then
    raise exception 'Só o administrador global aprova o reinício das fichas do edital.' using errcode = '42501';
  end if;
  select p."CO_MONITORAMENTO" into v_edital from public."TB_PEDIDO_REINICIO_FICHA" p where p."CO_PEDIDO_REINICIO" = p_pedido;
  if v_edital is null then
    raise exception 'Pedido de reinício não encontrado.' using errcode = '22023';
  end if;
  -- Mesma ordem de travas do pedido e do reinício: edital, pedido, fichas.
  perform 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital for update;
  select * into v_p from public."TB_PEDIDO_REINICIO_FICHA" p where p."CO_PEDIDO_REINICIO" = p_pedido for update;
  if v_p."TP_SITUACAO" <> 'PENDENTE' then
    raise exception 'Este pedido de reinício não está mais pendente (%).', lower(v_p."TP_SITUACAO") using errcode = '55000';
  end if;
  if v_p."DT_VALIDADE" <= now() then
    raise exception 'O pedido de reinício venceu (vale 24 horas). Peça de novo.' using errcode = '55000';
  end if;
  if v_p."CO_USUARIO_PEDIDO" = v_usuario then
    raise exception 'Você pediu este reinício. A aprovação precisa ser de outro administrador global.' using errcode = '42501';
  end if;
  if not private."FC_CONFIRMACAO_DO_EDITAL"(v_edital, p_confirmacao) then
    raise exception 'O número digitado não confere com o do edital.' using errcode = '22023';
  end if;
  v_bloqueio := private."FC_BLOQUEIO_REINICIO_FICHAS"(v_edital);
  if v_bloqueio is not null then
    raise exception '%', v_bloqueio using errcode = '55000';
  end if;

  perform 1 from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = v_edital for update;
  v_impacto := private."FC_IMPACTO_REINICIO_FICHAS"(v_edital);
  insert into public."TH_PEDIDO_REINICIO_FICHA" ("CO_PEDIDO_REINICIO", "CO_MONITORAMENTO", "TP_EVENTO", "CO_USUARIO", "DS_DETALHE")
  values (p_pedido, v_edital, 'APROVAR', v_usuario, v_impacto);

  v_r := private."FC_REINICIAR_FICHAS_DO_EDITAL"(
           v_edital, format('Reinício aprovado (pedido nº %s): %s', p_pedido, v_p."DS_MOTIVO"), v_usuario);

  update public."TB_PEDIDO_REINICIO_FICHA" set
    "TP_SITUACAO" = 'EXECUTADO', "CO_USUARIO_DECISAO" = v_usuario, "DT_DECISAO" = now(),
    "QT_REINICIADAS" = (v_r ->> 'reiniciadas')::integer
   where "CO_PEDIDO_REINICIO" = p_pedido;
  insert into public."TH_PEDIDO_REINICIO_FICHA" ("CO_PEDIDO_REINICIO", "CO_MONITORAMENTO", "TP_EVENTO", "CO_USUARIO", "DS_DETALHE")
  values (p_pedido, v_edital, 'EXECUTAR', v_usuario, v_r::jsonb);

  return json_build_object('resultado', v_r, 'reinicio', private."FC_LER_REINICIO_FICHAS"(v_edital, v_usuario));
end;
$function$;
comment on function public.aprovar_reinicio_fichas_do_edital(bigint, text) is
  'Administrador global B aprova o pedido de reinício (20261022210000): B diferente de quem pediu (42501), número do edital digitado (22023), pedido pendente e dentro das 24 h, edital nem congelado nem encerrado (55000). Grava APROVAR (impacto atual), roda FC_REINICIAR_FICHAS_DO_EDITAL (histórico REINICIAR por ficha, autor B, número do pedido no motivo), marca EXECUTADO e grava EXECUTAR com o resultado. Devolve { resultado, reinicio }.';
revoke all on function public.aprovar_reinicio_fichas_do_edital(bigint, text) from public, anon;
grant execute on function public.aprovar_reinicio_fichas_do_edital(bigint, text) to authenticated;

create or replace function public.recusar_reinicio_fichas_do_edital(p_pedido bigint, p_confirmacao text, p_motivo text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_p public."TB_PEDIDO_REINICIO_FICHA";
  v_motivo text := nullif(btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g')), '');
begin
  if not private."FC_ADMIN_GLOBAL_ATIVO"(v_usuario) then
    raise exception 'Só o administrador global recusa o reinício das fichas do edital.' using errcode = '42501';
  end if;
  select * into v_p from public."TB_PEDIDO_REINICIO_FICHA" p where p."CO_PEDIDO_REINICIO" = p_pedido for update;
  if not found then
    raise exception 'Pedido de reinício não encontrado.' using errcode = '22023';
  end if;
  if v_p."TP_SITUACAO" <> 'PENDENTE' then
    raise exception 'Este pedido de reinício não está mais pendente (%).', lower(v_p."TP_SITUACAO") using errcode = '55000';
  end if;
  if v_p."CO_USUARIO_PEDIDO" = v_usuario then
    raise exception 'Você pediu este reinício: use Cancelar pedido.' using errcode = '42501';
  end if;
  if not private."FC_CONFIRMACAO_DO_EDITAL"(v_p."CO_MONITORAMENTO", p_confirmacao) then
    raise exception 'O número digitado não confere com o do edital.' using errcode = '22023';
  end if;
  if v_motivo is not null and (length(v_motivo) not between 10 and 1000 or not private."FC_MOTIVO_PARECE_TEXTO"(v_motivo, 2)) then
    raise exception 'O motivo da recusa, se informado, tem de 10 a 1.000 caracteres e pelo menos 2 palavras.' using errcode = '22023';
  end if;

  update public."TB_PEDIDO_REINICIO_FICHA" set
    "TP_SITUACAO" = 'RECUSADO', "CO_USUARIO_DECISAO" = v_usuario, "DT_DECISAO" = now(), "DS_MOTIVO_DECISAO" = v_motivo
   where "CO_PEDIDO_REINICIO" = p_pedido;
  insert into public."TH_PEDIDO_REINICIO_FICHA" ("CO_PEDIDO_REINICIO", "CO_MONITORAMENTO", "TP_EVENTO", "CO_USUARIO", "DS_MOTIVO")
  values (p_pedido, v_p."CO_MONITORAMENTO", 'RECUSAR', v_usuario, v_motivo);

  return private."FC_LER_REINICIO_FICHAS"(v_p."CO_MONITORAMENTO", v_usuario);
end;
$function$;
comment on function public.recusar_reinicio_fichas_do_edital(bigint, text, text) is
  'Outro administrador global recusa o pedido de reinício (20261022210000): quem pediu cancela, não recusa (42501); número do edital digitado (22023); motivo opcional (10 a 1.000, 2 palavras). Marca RECUSADO e grava RECUSAR. Nada muda nas fichas.';
revoke all on function public.recusar_reinicio_fichas_do_edital(bigint, text, text) from public, anon;
grant execute on function public.recusar_reinicio_fichas_do_edital(bigint, text, text) to authenticated;

create or replace function public.cancelar_reinicio_fichas_do_edital(p_pedido bigint)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_p public."TB_PEDIDO_REINICIO_FICHA";
begin
  if not private."FC_ADMIN_GLOBAL_ATIVO"(v_usuario) then
    raise exception 'Só o administrador global cancela o pedido de reinício.' using errcode = '42501';
  end if;
  select * into v_p from public."TB_PEDIDO_REINICIO_FICHA" p where p."CO_PEDIDO_REINICIO" = p_pedido for update;
  if not found then
    raise exception 'Pedido de reinício não encontrado.' using errcode = '22023';
  end if;
  if v_p."CO_USUARIO_PEDIDO" <> v_usuario then
    raise exception 'Só quem pediu cancela o pedido. Para negar, use Recusar.' using errcode = '42501';
  end if;
  if v_p."TP_SITUACAO" <> 'PENDENTE' then
    raise exception 'Este pedido de reinício não está mais pendente (%).', lower(v_p."TP_SITUACAO") using errcode = '55000';
  end if;

  update public."TB_PEDIDO_REINICIO_FICHA" set
    "TP_SITUACAO" = 'CANCELADO', "CO_USUARIO_DECISAO" = v_usuario, "DT_DECISAO" = now()
   where "CO_PEDIDO_REINICIO" = p_pedido;
  insert into public."TH_PEDIDO_REINICIO_FICHA" ("CO_PEDIDO_REINICIO", "CO_MONITORAMENTO", "TP_EVENTO", "CO_USUARIO")
  values (p_pedido, v_p."CO_MONITORAMENTO", 'CANCELAR', v_usuario);

  return private."FC_LER_REINICIO_FICHAS"(v_p."CO_MONITORAMENTO", v_usuario);
end;
$function$;
comment on function public.cancelar_reinicio_fichas_do_edital(bigint) is
  'Quem pediu o reinício desiste do pedido pendente (20261022210000): outro administrador recebe 42501 (deve recusar). Marca CANCELADO e grava CANCELAR.';
revoke all on function public.cancelar_reinicio_fichas_do_edital(bigint) from public, anon;
grant execute on function public.cancelar_reinicio_fichas_do_edital(bigint) to authenticated;

-- 6. A RPC antiga só executa em edital sem ficha trabalhada ---------------------------------------------
create or replace function public.reiniciar_fichas_do_edital(p_edital uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_impacto jsonb;
begin
  if not private.is_master() then
    raise exception 'Só o administrador global reinicia as fichas do edital' using errcode = '42501';
  end if;
  -- Trava as fichas antes de contar: ninguém conclui no meio do caminho.
  perform 1 from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = p_edital for update;
  v_impacto := private."FC_IMPACTO_REINICIO_FICHAS"(p_edital);
  if (v_impacto ->> 'exige_aprovacao')::boolean then
    raise exception 'Este edital tem % ficha(s) concluída(s) e % em análise com lançamento. O reinício precisa de dois administradores: peça o reinício e outro administrador global aprova.',
      v_impacto ->> 'concluidas', v_impacto ->> 'com_lancamento'
      using errcode = '55000';
  end if;
  return private."FC_REINICIAR_FICHAS_DO_EDITAL"(p_edital, p_motivo, (select auth.uid()));
end;
$function$;
comment on function public.reiniciar_fichas_do_edital(uuid, text) is
  'Só admin global: volta ao início toda ficha iniciada do edital SEM ficha trabalhada (20261022210000): com ficha CONCLUIDA ou EM_ANALISE/REVISAR com lançamento, recusa (55000) e orienta o pedido com dois administradores (pedir/aprovar_reinicio_fichas_do_edital). Motivo de 10 a 2.000 e histórico REINICIAR por ficha; recusa edital congelado ou encerrado (FC_REINICIAR_FICHAS_DO_EDITAL).';

commit;
