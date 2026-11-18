/*
  ENSAIO de 20261118120000_vinculo_da_vaga_com_o_quadro.sql (não grava: termina em rollback)

  Roda a migration inteira (gerado dela: o SQL entre o begin e o commit) e confere:
    1. todo vínculo automático pelo nome bate com FC_QUADRO_DA_VAGA (CONFIRMADO = a linha que a
       regra de hoje devolve; AMBIGUO/AUSENTE = a regra de hoje não acha linha);
    2. todo CONFIRMADO aponta para linha ativa do mesmo edital; todo AMBIGUO tem candidata;
    3. o tempo do primeiro preenchimento.
  E mostra o retrato por edital (confirmadas pelo nome e pelo título, ambíguas, ausentes) e o
  dos editais com quadro sem vaga com código (não se aplica, externo, pendente de integração).

  psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/ensaios/20261118120000_vinculo_da_vaga_com_o_quadro.sql
*/
begin;


set local lock_timeout = '5s';

-- 0. Guardas ---------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TA_VAGA_QUADRO_EDITAL"') is not null then
    raise exception 'A migration 20261118120000 já foi aplicada (TA_VAGA_QUADRO_EDITAL existe).';
  end if;
  if to_regclass('cron.job') is null then
    raise exception 'O pg_cron precisa estar ligado (Database → Extensions → pg_cron).';
  end if;
  if md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text)')))
       is distinct from '53dc0bee569f416b67b89682c868c9cf'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_QUADRO_DA_VAGA_EMPREGARE"(uuid, text)')))
       is distinct from '8f21188ae0da0d944ff0845b0a1a7fdb'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('public.obter_quadro_de_vagas(uuid)')))
       is distinct from '9d296690dfc09291a2b773e20febe6e0'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('public.salvar_quadro_de_vagas(uuid, jsonb)')))
       is distinct from '2e237757c4b4c684d7724c553fd7ce40'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('public.conferencia_ler_listas_e_quadros()')))
       is distinct from '7189179d116aca01264b285c9a1f17e6'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_QUADRO_DA_VAGA"(uuid, text)')))
       is distinct from '3e99e62185118b7378fde0c9ec0166ff'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_TOKENS_VAGA"(text)')))
       is distinct from 'ad1e76868509405c8baa1a50458aeb5b'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_QUADRO_PELO_TITULO_EMPREGARE"(uuid, text)')))
       is distinct from '64228e6b720a3fccb12773b1750b7600'
  then
    raise exception 'Uma das funções do quadro de vagas mudou desde 17/11/2026 (md5 do corpo): junte as mudanças antes de aplicar.';
  end if;
end
$$;

-- 1. Tabelas ---------------------------------------------------------------------------------
create table public."TA_VAGA_QUADRO_EDITAL" (
  "CO_VAGA_QUADRO_EDITAL" uuid default gen_random_uuid() not null,
  "CO_MONITORAMENTO" uuid not null,
  "CO_VAGA" varchar(20) not null,
  "NO_VAGA" varchar(400),
  "CO_QUADRO_VAGA" uuid,
  "NO_CARGO_QUADRO" varchar(300),
  "NO_LOTACAO_QUADRO" varchar(300),
  "TP_VINCULO" varchar(10) not null,
  "TP_ORIGEM" varchar(10) not null,
  "TP_REGRA" varchar(10),
  "DS_CANDIDATA" jsonb default '[]'::jsonb not null,
  "DS_PENDENCIA" varchar(300),
  "CO_USUARIO_CONFIRMACAO" uuid,
  "DT_CONFIRMACAO" timestamptz,
  "DT_CRIACAO" timestamptz default now() not null,
  "DT_ATUALIZACAO" timestamptz default now() not null,
  constraint "PK_TA_VAGA_QUADRO_EDITAL" primary key ("CO_VAGA_QUADRO_EDITAL"),
  constraint "UK_VAGAQUADRO_EDITALVAGA" unique ("CO_MONITORAMENTO", "CO_VAGA"),
  constraint "FK_MONITORAMENTO_VAGAQUADRO" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA"(id) on delete cascade,
  -- Linha apagada de fato só no apagar do treinamento (a reimportação desativa).
  constraint "FK_QUADROVAGA_VAGAQUADRO" foreign key ("CO_QUADRO_VAGA")
    references public."TB_QUADRO_VAGA_EDITAL"("CO_QUADRO_VAGA") on delete cascade,
  constraint "CK_VAGAQUADRO_COVAGA" check ("CO_VAGA" ~ '^[0-9]{1,20}$'),
  constraint "CK_VAGAQUADRO_TPVINCULO" check ("TP_VINCULO" in ('CONFIRMADO', 'AMBIGUO', 'AUSENTE')),
  constraint "CK_VAGAQUADRO_TPORIGEM" check ("TP_ORIGEM" in ('AUTOMATICO', 'MANUAL')),
  constraint "CK_VAGAQUADRO_TPREGRA" check ("TP_REGRA" is null or "TP_REGRA" in ('NOME', 'TITULO')),
  constraint "CK_VAGAQUADRO_CANDIDATA" check (jsonb_typeof("DS_CANDIDATA") = 'array'),
  constraint "CK_VAGAQUADRO_CONFIRMADO" check (("TP_VINCULO" = 'CONFIRMADO') = ("CO_QUADRO_VAGA" is not null)),
  constraint "CK_VAGAQUADRO_MANUAL" check (("TP_ORIGEM" = 'MANUAL') = ("DT_CONFIRMACAO" is not null))
);

create index "IN_FKVAGAQUADRO_QUADRO" on public."TA_VAGA_QUADRO_EDITAL" ("CO_QUADRO_VAGA");

comment on table public."TA_VAGA_QUADRO_EDITAL" is 'Vínculo de cada vaga do edital (código da Empregare ou da planilha) com a linha do quadro de vagas (TB_QUADRO_VAGA_EDITAL): CONFIRMADO, AMBIGUO (com as candidatas) ou AUSENTE; AUTOMATICO pela regra, MANUAL pela equipe. 20261118120000.';
comment on index public."IN_FKVAGAQUADRO_QUADRO" is 'Chave estrangeira para TB_QUADRO_VAGA_EDITAL.';
comment on column public."TA_VAGA_QUADRO_EDITAL"."CO_VAGA_QUADRO_EDITAL" is 'Identificador do vínculo.';
comment on column public."TA_VAGA_QUADRO_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA).';
comment on column public."TA_VAGA_QUADRO_EDITAL"."CO_VAGA" is 'Código da vaga (Empregare ou planilha), só dígitos; um por edital.';
comment on column public."TA_VAGA_QUADRO_EDITAL"."NO_VAGA" is 'Nome da vaga usado no casamento: o das análises, o título da Empregare ou o da planilha da Seleção (NO_CARGO).';
comment on column public."TA_VAGA_QUADRO_EDITAL"."CO_QUADRO_VAGA" is 'Linha do quadro ligada; preenchida só quando CONFIRMADO.';
comment on column public."TA_VAGA_QUADRO_EDITAL"."NO_CARGO_QUADRO" is 'Cargo da linha ligada, como estava (fica para mostrar a linha que saiu do quadro).';
comment on column public."TA_VAGA_QUADRO_EDITAL"."NO_LOTACAO_QUADRO" is 'Lotação da linha ligada, como estava.';
comment on column public."TA_VAGA_QUADRO_EDITAL"."TP_VINCULO" is 'CONFIRMADO (uma linha), AMBIGUO (mais de uma candidata ou lotação contraditória) ou AUSENTE (nenhuma linha).';
comment on column public."TA_VAGA_QUADRO_EDITAL"."TP_ORIGEM" is 'AUTOMATICO (FC_PREENCHER_VINCULOS_QUADRO) ou MANUAL (a equipe, por gravar_vinculo_do_quadro). MANUAL AUSENTE sem pendência = a equipe confirmou que a vaga não tem linha.';
comment on column public."TA_VAGA_QUADRO_EDITAL"."TP_REGRA" is 'Regra que achou o vínculo automático: NOME (palavras do nome) ou TITULO ("CARGO N" do título da Empregare).';
comment on column public."TA_VAGA_QUADRO_EDITAL"."DS_CANDIDATA" is 'Linhas candidatas quando AMBIGUO: [{id, cargo, lotacao}] na ordem do quadro.';
comment on column public."TA_VAGA_QUADRO_EDITAL"."DS_PENDENCIA" is 'O que a equipe precisa rever (ex.: a linha escolhida saiu do quadro na reimportação).';
comment on column public."TA_VAGA_QUADRO_EDITAL"."CO_USUARIO_CONFIRMACAO" is 'Quem decidiu o vínculo MANUAL (auth.users).';
comment on column public."TA_VAGA_QUADRO_EDITAL"."DT_CONFIRMACAO" is 'Quando o vínculo MANUAL foi decidido.';
comment on column public."TA_VAGA_QUADRO_EDITAL"."DT_CRIACAO" is 'Quando a vaga entrou no vínculo.';
comment on column public."TA_VAGA_QUADRO_EDITAL"."DT_ATUALIZACAO" is 'Última mudança do vínculo.';

create table public."TH_VAGA_QUADRO_EDITAL" (
  "SQ_HISTORICO" bigint generated always as identity,
  "CO_MONITORAMENTO" uuid not null,
  "CO_VAGA" varchar(20) not null,
  "TP_EVENTO" varchar(20) not null,
  "DS_ANTERIOR" jsonb,
  "DS_NOVO" jsonb,
  "CO_USUARIO" uuid,
  "DT_EVENTO" timestamptz default now() not null,
  constraint "PK_TH_VAGA_QUADRO_EDITAL" primary key ("SQ_HISTORICO"),
  constraint "CK_HISTVAGAQUADRO_TPEVENTO" check ("TP_EVENTO" in
    ('PREENCHIMENTO', 'CONFIRMACAO', 'REIMPORTACAO', 'RETORNO_AUTOMATICO', 'REMOCAO'))
);

create index "IN_HISTVAGAQUADRO_EDITAL" on public."TH_VAGA_QUADRO_EDITAL" ("CO_MONITORAMENTO", "CO_VAGA", "DT_EVENTO" desc);

comment on table public."TH_VAGA_QUADRO_EDITAL" is 'Histórico de TA_VAGA_QUADRO_EDITAL: cada mudança do vínculo da vaga com a linha do quadro, com antes e depois. 20261118120000.';
comment on index public."IN_HISTVAGAQUADRO_EDITAL" is 'Histórico de uma vaga do edital, do mais recente.';
comment on column public."TH_VAGA_QUADRO_EDITAL"."SQ_HISTORICO" is 'Sequencial do evento.';
comment on column public."TH_VAGA_QUADRO_EDITAL"."CO_MONITORAMENTO" is 'Edital (sem chave estrangeira: o histórico fica).';
comment on column public."TH_VAGA_QUADRO_EDITAL"."CO_VAGA" is 'Código da vaga.';
comment on column public."TH_VAGA_QUADRO_EDITAL"."TP_EVENTO" is 'PREENCHIMENTO (regra), CONFIRMACAO (equipe), REIMPORTACAO (quadro novo), RETORNO_AUTOMATICO (equipe devolveu à regra) ou REMOCAO (a vaga saiu do edital).';
comment on column public."TH_VAGA_QUADRO_EDITAL"."DS_ANTERIOR" is 'A linha de TA_VAGA_QUADRO_EDITAL antes (nulo = vaga nova).';
comment on column public."TH_VAGA_QUADRO_EDITAL"."DS_NOVO" is 'A linha depois (nulo = removida).';
comment on column public."TH_VAGA_QUADRO_EDITAL"."CO_USUARIO" is 'Quem mudou (auth.users); nulo = automático.';
comment on column public."TH_VAGA_QUADRO_EDITAL"."DT_EVENTO" is 'Quando.';

alter table public."TA_VAGA_QUADRO_EDITAL" enable row level security;
alter table public."TH_VAGA_QUADRO_EDITAL" enable row level security;
revoke all on table public."TA_VAGA_QUADRO_EDITAL" from anon, authenticated;
revoke all on table public."TH_VAGA_QUADRO_EDITAL" from anon, authenticated;
grant all on table public."TA_VAGA_QUADRO_EDITAL" to service_role;
grant all on table public."TH_VAGA_QUADRO_EDITAL" to service_role;

-- 2. A regra (sem mudar FC_QUADRO_DA_VAGA) ----------------------------------------------------
create function private."FC_CHAVE_LINHA_QUADRO"(p_cargo text, p_lotacao text) returns text
language sql immutable
set search_path to ''
as $$
  select btrim(regexp_replace(translate(lower(coalesce(p_cargo, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
                              '[^a-z0-9]+', ' ', 'g'))
         || '|' ||
         btrim(regexp_replace(translate(lower(coalesce(p_lotacao, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
                              '[^a-z0-9]+', ' ', 'g'));
$$;
comment on function private."FC_CHAVE_LINHA_QUADRO"(text, text) is 'Cargo e lotação de uma linha do quadro sem acento, caixa e pontuação: a mesma linha em outra importação do PDF tem a mesma chave. 20261118120000.';

create function private."FC_CANDIDATAS_DO_QUADRO"(p_edital uuid, p_nome_vaga text) returns jsonb
language sql stable
set search_path to ''
as $_$
  -- A decisão de FC_QUADRO_DA_VAGA, linha por linha (mesmas CTEs), mais as candidatas quando não há uma só.
  with n as (select private."FC_TOKENS_VAGA"(p_nome_vaga) t),
  q as (
    select c."CO_QUADRO_VAGA" id, c."NU_ORDEM" ordem, private."FC_TOKENS_VAGA"(c."NO_CARGO") tc, private."FC_TOKENS_VAGA"(c."NO_LOTACAO") tl
      from public."TB_QUADRO_VAGA_EDITAL" c
     where c."CO_MONITORAMENTO" = p_edital and c."ST_REGISTRO_ATIVO" = 'S'
  ),
  cargo as (
    select q.id, q.ordem, cardinality(q.tc) nc, cardinality(q.tl) nl, cardinality(q.tl) > 0 and q.tl <@ n.t lotacao,
           cardinality(q.tl) = 0 or array(
             select t from unnest(n.t) t
              where not t = any (q.tc) and t !~ '^\d+$' and t not in ('vaga', 'vagas', 'cadastro', 'reserva', 'cr')
           ) <@ q.tl compativel
      from q, n where cardinality(q.tc) > 0 and q.tc <@ n.t
  ),
  melhor as (select * from cargo where nc = (select max(nc) from cargo)),
  com_lotacao as (select * from melhor where lotacao and nl = (select max(nl) from melhor where lotacao)),
  decisao as (
    select case
             when (select count(*) from com_lotacao) = 1 then (select id from com_lotacao)
             when (select count(*) from com_lotacao) = 0 and (select count(*) from melhor) = 1
              and (select compativel from melhor) then (select id from melhor)
           end as id
  ),
  -- Empate na lotação: as empatadas. Sem lotação no nome: as do cargo mais específico que não
  -- contradizem o nome (todas, se todas contradizem).
  candidatas as (
    select c.id, c.ordem from com_lotacao c where (select count(*) from com_lotacao) > 1
    union all
    select m.id, m.ordem from melhor m
     where (select count(*) from com_lotacao) = 0
       and (m.compativel or not exists (select 1 from melhor x where x.compativel))
  )
  select case
           when d.id is not null then jsonb_build_object('situacao', 'CONFIRMADO', 'quadro', d.id, 'candidatas', '[]'::jsonb)
           when exists (select 1 from cargo) then jsonb_build_object('situacao', 'AMBIGUO', 'quadro', null,
             'candidatas', (select coalesce(jsonb_agg(c.id order by c.ordem), '[]'::jsonb) from candidatas c))
           else jsonb_build_object('situacao', 'AUSENTE', 'quadro', null, 'candidatas', '[]'::jsonb)
         end
    from decisao d;
$_$;
comment on function private."FC_CANDIDATAS_DO_QUADRO"(uuid, text) is 'A regra de FC_QUADRO_DA_VAGA com a situação: {situacao CONFIRMADO|AMBIGUO|AUSENTE, quadro, candidatas [ids na ordem do quadro]}. CONFIRMADO exatamente quando FC_QUADRO_DA_VAGA devolve a linha. 20261118120000.';

create function private."FC_VAGAS_PARA_O_QUADRO"(p_edital uuid) returns table(vaga text, nome text)
language sql stable
set search_path to ''
as $_$
  -- As vagas com código do edital: análises ativas (mesma área e número), Empregare e Seleção.
  with m as (
    select m.id, m."CO_AREA" as area, private."FC_NUMERO_EDITAL"(m.edital) as numero
      from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital
  ),
  an as (
    select btrim(a.codigo_vaga) as vaga, min(a.nome_vaga) as nome
      from public."TB_ANALISE_CURRICULAR" a, m
     where a."CO_AREA" = m.area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = m.numero
       and btrim(a.codigo_vaga) ~ '^[0-9]{1,20}$'
     group by 1
  ),
  em as (
    select v."CO_VAGA" as vaga, private."FC_TITULO_DA_VAGA_EMPREGARE"(v."NO_ARQUIVO") as nome
      from public."TB_EMPREGARE_VAGA" v where v."CO_MONITORAMENTO" = p_edital
  ),
  se as (
    -- DS_VAGA_PLANILHA é só o código; o título da vaga na planilha é NO_CARGO.
    select s."CO_VAGA" as vaga, min(s."NO_CARGO") as nome
      from public."TB_SELECAO_VAGA" s
     where s."CO_MONITORAMENTO" = p_edital and s."ST_REGISTRO_ATIVO" = 'S' and s."CO_VAGA" is not null
     group by 1
  ),
  todas as (select an.vaga from an union select em.vaga from em union select se.vaga from se)
  select t.vaga, left(coalesce(an.nome, em.nome, se.nome), 400)
    from todas t
    left join an on an.vaga = t.vaga
    left join em on em.vaga = t.vaga
    left join se on se.vaga = t.vaga;
$_$;
comment on function private."FC_VAGAS_PARA_O_QUADRO"(uuid) is 'As vagas com código do edital (análises ativas, Empregare e Seleção) e o nome para o casamento: o das análises, o título da Empregare ou o da planilha da Seleção (NO_CARGO). 20261118120000.';

create function private."FC_VINCULO_AUTOMATICO_QUADRO"(p_edital uuid, p_vaga text, p_nome_vaga text, p_titulo boolean)
returns jsonb
language plpgsql stable
set search_path to ''
as $$
declare
  v jsonb := private."FC_CANDIDATAS_DO_QUADRO"(p_edital, p_nome_vaga) || jsonb_build_object('regra', 'NOME');
  v_titulo uuid;
begin
  if v ->> 'situacao' <> 'CONFIRMADO' and p_titulo then
    -- O "CARGO N" do título da Empregare (o que a pré-classificação já usa); até ~1,8 s por vaga.
    v_titulo := private."FC_QUADRO_PELO_TITULO_EMPREGARE"(p_edital, p_vaga);
    if v_titulo is not null then
      return jsonb_build_object('situacao', 'CONFIRMADO', 'quadro', v_titulo, 'candidatas', '[]'::jsonb, 'regra', 'TITULO');
    end if;
  end if;
  return v;
end;
$$;
comment on function private."FC_VINCULO_AUTOMATICO_QUADRO"(uuid, text, text, boolean) is 'O vínculo automático de uma vaga: a regra do nome (FC_CANDIDATAS_DO_QUADRO) e, sem linha única e com p_titulo, o título "CARGO N" da Empregare (FC_QUADRO_PELO_TITULO_EMPREGARE). {situacao, quadro, candidatas, regra}. 20261118120000.';

create function private."FC_GRAVAR_VINCULO_QUADRO"(
  p_edital uuid, p_vaga text, p_nome_vaga text, p_situacao text, p_origem text, p_regra text,
  p_quadro uuid, p_candidatas uuid[], p_pendencia text, p_evento text, p_usuario uuid)
returns boolean
language plpgsql security definer
set search_path to ''
as $$
declare
  v_antes public."TA_VAGA_QUADRO_EDITAL";
  v_depois public."TA_VAGA_QUADRO_EDITAL";
  v_cargo text;
  v_lotacao text;
  v_candidatas jsonb;
  v_usuario uuid;
  v_quando timestamptz;
begin
  select * into v_antes from public."TA_VAGA_QUADRO_EDITAL" v
   where v."CO_MONITORAMENTO" = p_edital and v."CO_VAGA" = p_vaga for update;

  if p_quadro is not null then
    select q."NO_CARGO", q."NO_LOTACAO" into v_cargo, v_lotacao
      from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_QUADRO_VAGA" = p_quadro;
  elsif p_pendencia is not null then
    -- A linha que saiu do quadro continua à vista.
    v_cargo := v_antes."NO_CARGO_QUADRO";
    v_lotacao := v_antes."NO_LOTACAO_QUADRO";
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', q."CO_QUADRO_VAGA", 'cargo', q."NO_CARGO", 'lotacao', q."NO_LOTACAO")
                            order by q."NU_ORDEM", q."CO_QUADRO_VAGA"), '[]'::jsonb)
    into v_candidatas
    from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_QUADRO_VAGA" = any (coalesce(p_candidatas, '{}'));

  -- Quem decidiu: a confirmação registra; o automático limpa; os outros eventos mantêm.
  if p_origem = 'AUTOMATICO' then
    v_usuario := null; v_quando := null;
  elsif p_evento = 'CONFIRMACAO' or v_antes."DT_CONFIRMACAO" is null then
    v_usuario := p_usuario; v_quando := now();
  else
    v_usuario := v_antes."CO_USUARIO_CONFIRMACAO"; v_quando := v_antes."DT_CONFIRMACAO";
  end if;

  if v_antes."CO_VAGA" is not null
     and v_antes."NO_VAGA" is not distinct from p_nome_vaga
     and v_antes."CO_QUADRO_VAGA" is not distinct from p_quadro
     and v_antes."NO_CARGO_QUADRO" is not distinct from v_cargo
     and v_antes."NO_LOTACAO_QUADRO" is not distinct from v_lotacao
     and v_antes."TP_VINCULO" = p_situacao
     and v_antes."TP_ORIGEM" = p_origem
     and v_antes."TP_REGRA" is not distinct from p_regra
     and v_antes."DS_CANDIDATA" = v_candidatas
     and v_antes."DS_PENDENCIA" is not distinct from p_pendencia
     and p_evento <> 'CONFIRMACAO' then
    return false;
  end if;

  insert into public."TA_VAGA_QUADRO_EDITAL" as v
         ("CO_MONITORAMENTO", "CO_VAGA", "NO_VAGA", "CO_QUADRO_VAGA", "NO_CARGO_QUADRO", "NO_LOTACAO_QUADRO",
          "TP_VINCULO", "TP_ORIGEM", "TP_REGRA", "DS_CANDIDATA", "DS_PENDENCIA", "CO_USUARIO_CONFIRMACAO", "DT_CONFIRMACAO")
  values (p_edital, p_vaga, p_nome_vaga, p_quadro, v_cargo, v_lotacao,
          p_situacao, p_origem, p_regra, v_candidatas, p_pendencia, v_usuario, v_quando)
  on conflict ("CO_MONITORAMENTO", "CO_VAGA") do update set
    "NO_VAGA" = excluded."NO_VAGA", "CO_QUADRO_VAGA" = excluded."CO_QUADRO_VAGA",
    "NO_CARGO_QUADRO" = excluded."NO_CARGO_QUADRO", "NO_LOTACAO_QUADRO" = excluded."NO_LOTACAO_QUADRO",
    "TP_VINCULO" = excluded."TP_VINCULO", "TP_ORIGEM" = excluded."TP_ORIGEM", "TP_REGRA" = excluded."TP_REGRA",
    "DS_CANDIDATA" = excluded."DS_CANDIDATA", "DS_PENDENCIA" = excluded."DS_PENDENCIA",
    "CO_USUARIO_CONFIRMACAO" = excluded."CO_USUARIO_CONFIRMACAO", "DT_CONFIRMACAO" = excluded."DT_CONFIRMACAO",
    "DT_ATUALIZACAO" = now()
  returning * into v_depois;

  insert into public."TH_VAGA_QUADRO_EDITAL" ("CO_MONITORAMENTO", "CO_VAGA", "TP_EVENTO", "DS_ANTERIOR", "DS_NOVO", "CO_USUARIO")
  values (p_edital, p_vaga, p_evento,
          case when v_antes."CO_VAGA" is not null then to_jsonb(v_antes) end, to_jsonb(v_depois), p_usuario);
  return true;
end;
$$;
comment on function private."FC_GRAVAR_VINCULO_QUADRO"(uuid, text, text, text, text, text, uuid, uuid[], text, text, uuid) is 'Grava o vínculo de uma vaga (insere ou troca) e o histórico, só quando algo muda (a confirmação sempre grava). Devolve se gravou. 20261118120000.';

create function private."FC_PREENCHER_VINCULOS_QUADRO"(p_edital uuid, p_titulo boolean default false, p_usuario uuid default null)
returns jsonb
language plpgsql security definer
set search_path to ''
as $$
declare
  r record;
  v jsonb;
  v_tem_quadro boolean;
  v_n integer;
  v_nova uuid;
  v_reapontadas integer := 0;
  v_mudaram integer := 0;
  v_removidas integer := 0;
begin
  v_tem_quadro := exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q
                           where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S');

  -- 1. Vínculo numa linha que saiu (reimportação): a linha nova de mesmo cargo e lotação.
  for r in
    select v."CO_VAGA" as vaga, v."NO_VAGA" as nome, v."TP_VINCULO" as situacao, v."TP_ORIGEM" as origem,
           v."TP_REGRA" as regra, q."NO_CARGO" as cargo, q."NO_LOTACAO" as lotacao, q."DT_DESATIVACAO" as saiu
      from public."TA_VAGA_QUADRO_EDITAL" v
      join public."TB_QUADRO_VAGA_EDITAL" q on q."CO_QUADRO_VAGA" = v."CO_QUADRO_VAGA"
     where v."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'N'
     order by v."CO_VAGA"
  loop
    select count(*), (array_agg(n."CO_QUADRO_VAGA"))[1] into v_n, v_nova
      from public."TB_QUADRO_VAGA_EDITAL" n
     where n."CO_MONITORAMENTO" = p_edital and n."ST_REGISTRO_ATIVO" = 'S'
       and private."FC_CHAVE_LINHA_QUADRO"(n."NO_CARGO", n."NO_LOTACAO") = private."FC_CHAVE_LINHA_QUADRO"(r.cargo, r.lotacao);
    if v_n = 1 then
      perform private."FC_GRAVAR_VINCULO_QUADRO"(p_edital, r.vaga, r.nome, 'CONFIRMADO', r.origem, r.regra,
                                                 v_nova, '{}', null, 'REIMPORTACAO', p_usuario);
      v_reapontadas := v_reapontadas + 1;
    elsif r.origem = 'MANUAL' then
      perform private."FC_GRAVAR_VINCULO_QUADRO"(p_edital, r.vaga, r.nome, 'AUSENTE', 'MANUAL', null, null, '{}',
        left(format('A linha escolhida (%s) saiu do quadro em %s.',
                    concat_ws(' — ', r.cargo, r.lotacao),
                    to_char(coalesce(r.saiu, now()) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')), 300),
        'REIMPORTACAO', p_usuario);
    end if; -- AUTOMATICO: recalculado abaixo.
  end loop;

  -- 2. As vagas do edital pela regra; o MANUAL nunca é tocado.
  for r in
    select t.vaga, t.nome, v."TP_ORIGEM" as origem, v."TP_REGRA" as regra, v."TP_VINCULO" as situacao,
           q."ST_REGISTRO_ATIVO" as linha_ativa
      from private."FC_VAGAS_PARA_O_QUADRO"(p_edital) t
      left join public."TA_VAGA_QUADRO_EDITAL" v on v."CO_MONITORAMENTO" = p_edital and v."CO_VAGA" = t.vaga
      left join public."TB_QUADRO_VAGA_EDITAL" q on q."CO_QUADRO_VAGA" = v."CO_QUADRO_VAGA"
     where v_tem_quadro
     order by t.vaga
  loop
    continue when r.origem = 'MANUAL';
    -- Sem o título (gravação pela tela): o achado pelo título fica até a rodada diária.
    continue when not p_titulo and r.regra = 'TITULO' and r.situacao = 'CONFIRMADO' and r.linha_ativa = 'S';
    v := private."FC_VINCULO_AUTOMATICO_QUADRO"(p_edital, r.vaga, r.nome, p_titulo);
    if private."FC_GRAVAR_VINCULO_QUADRO"(
         p_edital, r.vaga, r.nome, v ->> 'situacao', 'AUTOMATICO', v ->> 'regra', (v ->> 'quadro')::uuid,
         array(select jsonb_array_elements_text(v -> 'candidatas')::uuid), null, 'PREENCHIMENTO', p_usuario) then
      v_mudaram := v_mudaram + 1;
    end if;
  end loop;

  -- 3. Automático de vaga que saiu do edital (ou de edital sem quadro): sai, com histórico.
  with fora as (
    delete from public."TA_VAGA_QUADRO_EDITAL" v
     where v."CO_MONITORAMENTO" = p_edital and v."TP_ORIGEM" = 'AUTOMATICO'
       and (not v_tem_quadro or v."CO_VAGA" not in (select t.vaga from private."FC_VAGAS_PARA_O_QUADRO"(p_edital) t))
    returning v.*
  ),
  hist as (
    insert into public."TH_VAGA_QUADRO_EDITAL" ("CO_MONITORAMENTO", "CO_VAGA", "TP_EVENTO", "DS_ANTERIOR", "DS_NOVO", "CO_USUARIO")
    select f."CO_MONITORAMENTO", f."CO_VAGA", 'REMOCAO', to_jsonb(f), null, p_usuario from fora f
    returning 1
  )
  select count(*) into v_removidas from hist;

  return (
    select jsonb_build_object(
             'confirmadas', count(*) filter (where v."TP_VINCULO" = 'CONFIRMADO'),
             'ambiguas', count(*) filter (where v."TP_VINCULO" = 'AMBIGUO'),
             'ausentes', count(*) filter (where v."TP_VINCULO" = 'AUSENTE'),
             'manuais', count(*) filter (where v."TP_ORIGEM" = 'MANUAL'),
             'mudaram', v_mudaram, 'reapontadas', v_reapontadas, 'removidas', v_removidas)
      from public."TA_VAGA_QUADRO_EDITAL" v where v."CO_MONITORAMENTO" = p_edital);
end;
$$;
comment on function private."FC_PREENCHER_VINCULOS_QUADRO"(uuid, boolean, uuid) is 'Preenche os vínculos das vagas do edital com o quadro: reaponta para a linha nova de mesmo cargo e lotação (MANUAL sem par vira AUSENTE com pendência), recalcula os AUTOMATICO (p_titulo: também pelo título da Empregare) e tira os de vaga que saiu. Nunca muda um MANUAL pela regra. Devolve as contagens. 20261118120000.';

create function private."FC_PREENCHER_TODOS_VINCULOS_QUADRO"() returns integer
language plpgsql security definer
set search_path to ''
as $$
declare
  v_edital uuid;
  v_n integer := 0;
begin
  for v_edital in
    select distinct x.edital from (
      select q."CO_MONITORAMENTO" as edital from public."TB_QUADRO_VAGA_EDITAL" q where q."ST_REGISTRO_ATIVO" = 'S'
      union
      select v."CO_MONITORAMENTO" from public."TA_VAGA_QUADRO_EDITAL" v
    ) x order by 1
  loop
    perform private."FC_PREENCHER_VINCULOS_QUADRO"(v_edital, true, null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
comment on function private."FC_PREENCHER_TODOS_VINCULOS_QUADRO"() is 'A rodada diária (agsus_vinculos_do_quadro): FC_PREENCHER_VINCULOS_QUADRO, com o título da Empregare, em cada edital com quadro ou com vínculo. Devolve quantos editais. 20261118120000.';

create function private."FC_QUADRO_DA_VAGA_VINCULADA"(p_edital uuid, p_vaga text, p_nome_vaga text) returns uuid
language sql stable
set search_path to ''
as $$
  select case
           when v."TP_VINCULO" = 'CONFIRMADO' then v."CO_QUADRO_VAGA"
           when v."TP_ORIGEM" = 'MANUAL' and v."DS_PENDENCIA" is null then null
           else private."FC_QUADRO_DA_VAGA"(p_edital, p_nome_vaga)
         end
    from (select 1) u
    left join public."TA_VAGA_QUADRO_EDITAL" v
      on v."CO_MONITORAMENTO" = p_edital and v."CO_VAGA" = btrim(p_vaga);
$$;
comment on function private."FC_QUADRO_DA_VAGA_VINCULADA"(uuid, text, text) is 'A linha do quadro de uma vaga: a do vínculo CONFIRMADO; nenhuma quando a equipe confirmou que a vaga não tem linha; senão a regra do nome (FC_QUADRO_DA_VAGA). 20261118120000.';

revoke all on function private."FC_CHAVE_LINHA_QUADRO"(text, text) from public;
revoke all on function private."FC_CANDIDATAS_DO_QUADRO"(uuid, text) from public;
revoke all on function private."FC_VAGAS_PARA_O_QUADRO"(uuid) from public;
revoke all on function private."FC_VINCULO_AUTOMATICO_QUADRO"(uuid, text, text, boolean) from public;
revoke all on function private."FC_GRAVAR_VINCULO_QUADRO"(uuid, text, text, text, text, text, uuid, uuid[], text, text, uuid) from public;
revoke all on function private."FC_PREENCHER_VINCULOS_QUADRO"(uuid, boolean, uuid) from public;
revoke all on function private."FC_PREENCHER_TODOS_VINCULOS_QUADRO"() from public;
revoke all on function private."FC_QUADRO_DA_VAGA_VINCULADA"(uuid, text, text) from public;

-- 3. Quem usa a linha da vaga passa pelo vínculo ------------------------------------------------
CREATE OR REPLACE FUNCTION private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital uuid, p_area text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text := p_area;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area, 'numero', v_numero,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('classificacao', 2),
    'regra', private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital),
    'catalogo', (
      select json_agg(json_build_object('codigo', k."CO_CRITERIO", 'nome', k."NO_CRITERIO", 'tipo', k."TP_VALOR",
               'direcao', k."TP_DIRECAO_PADRAO", 'ativo', k."ST_ATIVO" = 'S') order by k."NU_ORDEM")
        from public."TB_CRITERIO_CLASSIFICACAO" k),
    'cronograma', coalesce((
      select json_agg(json_build_object('ordem', c.ordem, 'atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
             order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    'quadro', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'candidatos', coalesce((
      with a as (
        select a.* from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
      ),
      -- A linha de cada vaga pelo vínculo (TA_VAGA_QUADRO_EDITAL) e, sem ele, pelo nome (20261118120000).
      vq as (
        select n.codigo_vaga, n.nome_vaga,
               private."FC_QUADRO_DA_VAGA_VINCULADA"(p_edital, n.codigo_vaga, n.nome_vaga) as quadro
          from (select distinct a.codigo_vaga, a.nome_vaga from a) n
      )
      select json_agg(json_build_object(
               'analise_id', a.id, 'codigo', a.id_origem, 'nome', a.candidato, 'vaga', a.codigo_vaga,
               'cargo', a.nome_vaga, 'categoria', a.categoria, 'modalidade', a.modalidade_concorrencia, 'pcd', a.pcd,
               'data_nascimento', a.data_nascimento, 'nota_documental', a.nota_final_ajustada, 'nota_art', a.nota_empregare,
               'pontuacao_formacao', a.pontuacao_escolaridade, 'pontuacao_cursos', a.pontuacao_cursos_aperfeicoamento,
               'pontuacao_experiencia', a.pontuacao_experiencia_profissional, 'pontuacao_etnica', a.pontuacao_criterio_etnico,
               'exp_saude_indigena', a.experiencia_saude_indigena_total, 'exp_atencao_basica', a.experiencia_atencao_basica_total,
               'exp_profissional', a.experiencia_profissional_total, 'status', a.status_consolidado, 'etapa', a.etapa,
               'quadro', vq.quadro, 'hora_nascimento', to_char(h."HR_NASCIMENTO", 'HH24:MI:SS'))
             order by a.codigo_vaga, a.candidato)
        from a left join vq on vq.codigo_vaga is not distinct from a.codigo_vaga and vq.nome_vaga is not distinct from a.nome_vaga
               left join public."TB_HORA_NASCIMENTO_CANDIDATO" h on h."CO_ANALISE_CURRICULAR" = a.id), '[]'::json),
    'entrevistas', coalesce((
      select json_agg(json_build_object(
               'id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR", 'nome', e."NO_CANDIDATO",
               'vaga', e."CO_VAGA", 'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'compareceu', e."ST_COMPARECEU",
               'ligacao', e."TP_LIGACAO_ANALISE", 'origem', e."TP_ORIGEM",
               'notas', coalesce((select json_agg(json_build_object('ordem', n."NU_ORDEM", 'criterio', n."DS_CRITERIO", 'nota', n."VL_NOTA")
                                         order by n."NU_ORDEM")
                                    from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
       where e."ST_ATIVO" = 'S'
         and (e."CO_MONITORAMENTO" = p_edital
              or (e."CO_MONITORAMENTO" is null and e."CO_AREA" = v_area
                  and private."FC_NUMERO_EDITAL"(e."DS_EDITAL") = v_numero))), '[]'::json),
    'listas', coalesce((
      select json_agg(private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO") order by l."DT_GERACAO" desc)
        from (select l."CO_LISTA_CLASSIFICACAO", l."DT_GERACAO"
                from public."TB_LISTA_CLASSIFICACAO" l
               where l."CO_MONITORAMENTO" = p_edital
               order by l."DT_GERACAO" desc limit 60) l), '[]'::json),
    'desempates', coalesce((
      select json_agg(private."FC_DESEMPATE_CLASSIFICACAO_JSON"(d."CO_DESEMPATE_CLASSIFICACAO") order by d."DT_REGISTRO")
        from public."TB_DESEMPATE_CLASSIFICACAO" d
       where d."CO_MONITORAMENTO" = p_edital and d."ST_ATIVO" = 'S'), '[]'::json),
    'ajustes', coalesce((
      select json_agg(private."FC_AJUSTE_PONTUACAO_JSON"(j."CO_AJUSTE_PONTUACAO") order by j."DT_APROVACAO", j."CO_AJUSTE_PONTUACAO")
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital and j."TP_SITUACAO" = 'APROVADO'), '[]'::json),
    'ajustes_mudaram_em', (
      select greatest(max(j."DT_APROVACAO"), max(j."DT_CANCELAMENTO") filter (where j."DT_APROVACAO" is not null))
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital)
  );
end;
$$;

COMMENT ON FUNCTION private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital uuid, p_area text) IS 'O que o motor de classificação precisa de um edital (json), sem conferir permissão: regra e versões, catálogo, cronograma, quadro, análises (sem CPF, com a hora de nascimento da certidão quando informada), entrevistas, listas, desempates, os ajustes da pontuação aprovados em recurso e quando eles mudaram por último. Usada por obter_classificacao_do_edital e obter_dados_previa_ajuste.';

CREATE OR REPLACE FUNCTION private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital uuid, p_vaga text) RETURNS public."TB_QUADRO_VAGA_EDITAL"
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select q.*
    from (select case
                   when v."TP_VINCULO" = 'CONFIRMADO' then v."CO_QUADRO_VAGA"
                   when v."TP_ORIGEM" = 'MANUAL' and v."DS_PENDENCIA" is null then null
                   else coalesce(
                     (select e.quadro_id
                        from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) e
                        join public."TB_QUADRO_VAGA_EDITAL" l
                          on l."CO_QUADRO_VAGA" = e.quadro_id and l."CO_MONITORAMENTO" = p_edital and l."ST_REGISTRO_ATIVO" = 'S'
                       where e.edital_id = p_edital
                       limit 1),
                     private."FC_QUADRO_PELO_TITULO_EMPREGARE"(p_edital, p_vaga))
                 end as id
            from (select 1) u
            left join public."TA_VAGA_QUADRO_EDITAL" v on v."CO_MONITORAMENTO" = p_edital and v."CO_VAGA" = p_vaga) x
    join public."TB_QUADRO_VAGA_EDITAL" q
      on q."CO_QUADRO_VAGA" = x.id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S';
$$;

COMMENT ON FUNCTION private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital uuid, p_vaga text) IS 'A linha do quadro de vagas de uma vaga da Empregare no edital: a do vínculo CONFIRMADO (TA_VAGA_QUADRO_EDITAL, 20261118120000), nenhuma se a equipe confirmou que não há linha; senão pelo nome_vaga da análise curricular (planilha, FC_EMPREGARE_VAGAS_DO_QUADRO) e, sem ele, pelo título da vaga na Empregare (FC_QUADRO_PELO_TITULO_EMPREGARE, desde 20261013140000). Usada pelo job da pré-classificação (cargo e nível) e pela gravação de cada vaga (NO_CARGO, NO_LOTACAO, quadro).';

CREATE OR REPLACE FUNCTION public.obter_quadro_de_vagas(p_edital uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if v_m.id is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not (private.pode_recurso('nucleo', 1) or private.pode_recurso('calendario', 1) or private.pode_recurso('entrevistas', 1)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  return json_build_object(
    'edital', p_edital,
    'linhas', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'origem', (select json_build_object('tipo', q."TP_ORIGEM", 'arquivo', q."DS_ARQUIVO_ORIGEM", 'gravado_em', q."DT_CRIACAO")
                 from public."TB_QUADRO_VAGA_EDITAL" q
                where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S' limit 1),
    -- O vínculo de cada vaga (TA_VAGA_QUADRO_EDITAL, 20261118120000); 'cargo' é o nome da vaga, como antes.
    'vinculos', coalesce((
      select json_agg(json_build_object('vaga', v."CO_VAGA", 'cargo', v."NO_VAGA", 'quadro', v."CO_QUADRO_VAGA",
               'situacao', v."TP_VINCULO", 'origem', v."TP_ORIGEM", 'regra', v."TP_REGRA",
               'cargo_quadro', v."NO_CARGO_QUADRO", 'lotacao_quadro', v."NO_LOTACAO_QUADRO",
               'candidatas', v."DS_CANDIDATA", 'pendencia', v."DS_PENDENCIA",
               'confirmado_em', v."DT_CONFIRMACAO",
               'confirmado_por', (select p.nome from public."TB_PERFIL_USUARIO" p
                                   where p.user_id = v."CO_USUARIO_CONFIRMACAO" limit 1))
             order by v."NO_VAGA", v."CO_VAGA")
        from public."TA_VAGA_QUADRO_EDITAL" v
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    -- Sem vaga com código não há o que ligar: o motivo, sem inventar vaga.
    'vagas_do_edital', case
      when exists (select 1 from public."TA_VAGA_QUADRO_EDITAL" v where v."CO_MONITORAMENTO" = p_edital) then 'COM_CODIGO'
      when coalesce(v_m.status, '') = 'Cancelado' then 'NAO_SE_APLICA'
      when exists (select 1 from public."TB_SELECAO_VAGA" s
                    where s."CO_MONITORAMENTO" = p_edital and s."ST_REGISTRO_ATIVO" = 'S') then 'EXTERNO'
      else 'PENDENTE_INTEGRACAO' end,
    'pode_editar', private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)
  );
end;
$$;

COMMENT ON FUNCTION public.obter_quadro_de_vagas(p_edital uuid) IS 'Quadro de vagas vigente do edital, de onde veio e o vínculo de cada vaga com a linha (TA_VAGA_QUADRO_EDITAL: situação, origem, candidatas, pendência, quem confirmou); vagas_do_edital diz por que não há vaga para ligar (NAO_SE_APLICA, EXTERNO, PENDENTE_INTEGRACAO); pode_editar = pode gravar o vínculo. Núcleo, Calendário ou Entrevistas (leitor) e o edital.';

CREATE OR REPLACE FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_linhas jsonb := coalesce(p_dados -> 'linhas', '[]'::jsonb);
  v_origem text := coalesce(nullif(upper(p_dados ->> 'origem'), ''), 'PDF');
  v_arquivo text := left(nullif(btrim(p_dados ->> 'arquivo'), ''), 300);
begin
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if not (private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  if jsonb_typeof(v_linhas) <> 'array' or jsonb_array_length(v_linhas) > 500 then
    raise exception 'Quadro de vagas inválido (até 500 linhas)' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_linhas) l
              where length(btrim(coalesce(l ->> 'cargo', ''))) not between 1 and 300
                 or coalesce(nullif(l ->> 'vagas_imediatas', '')::integer, 0) not between 0 and 9999
                 or jsonb_typeof(coalesce(l -> 'modalidades', '{}'::jsonb)) <> 'object') then
    raise exception 'Há linha do quadro sem cargo ou com quantidade inválida' using errcode = '22023';
  end if;

  update public."TB_QUADRO_VAGA_EDITAL"
     set "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now()
   where "CO_MONITORAMENTO" = p_edital and "ST_REGISTRO_ATIVO" = 'S';

  insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO", "DS_MODALIDADE_VAGA",
    "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
  select p_edital, l.ordem, btrim(l.valor ->> 'cargo'), left(nullif(btrim(l.valor ->> 'lotacao'), ''), 300),
         coalesce(l.valor -> 'modalidades', '{}'::jsonb), coalesce(nullif(l.valor ->> 'vagas_imediatas', '')::integer, 0),
         case when (l.valor ->> 'cadastro_reserva')::boolean then 'S' else 'N' end,
         v_origem, v_arquivo, (select auth.uid())
    from jsonb_array_elements(v_linhas) with ordinality l(valor, ordem);

  -- Os vínculos das vagas passam para as linhas novas (20261118120000).
  perform private."FC_PREENCHER_VINCULOS_QUADRO"(p_edital, false, (select auth.uid()));

  return public.obter_quadro_de_vagas(p_edital);
end;
$$;

COMMENT ON FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) IS 'Substitui o quadro de vagas do edital (o anterior fica desativado) e passa os vínculos das vagas para as linhas novas (FC_PREENCHER_VINCULOS_QUADRO). p_dados: {origem PDF|MANUAL, arquivo, linhas:[{cargo, lotacao, modalidades, vagas_imediatas, cadastro_reserva}]}. Núcleo ou Calendário (editor) e o edital.';

CREATE OR REPLACE FUNCTION public.conferencia_ler_listas_e_quadros() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  -- 20261103181500: a leitura da classificação das conferências sem as análises. A última
  -- atualização das análises e as vagas sem quadro saem das páginas de conferencia_ler_analises,
  -- no robô (scripts/conferencias/regras.py, python/monitora/classificacao/quadro_da_vaga.py).
  -- 20261118120000: e os vínculos das vagas com o quadro, que o robô consulta antes das palavras.
  with ultimas as (
    select distinct on (l."CO_MONITORAMENTO", l."TP_LISTA")
           l."CO_LISTA_CLASSIFICACAO", l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO",
           l."QT_PENDENCIA", l."ST_PUBLICADA", l."DS_RESULTADO", l."NU_VERSAO_REGRA"
      from public."TB_LISTA_CLASSIFICACAO" l
     where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
     order by l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO" desc, l."CO_LISTA_CLASSIFICACAO" desc
  )
  select jsonb_build_object(
    'schema_version', 1,
    'listas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', u."CO_LISTA_CLASSIFICACAO", 'edital', u."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', u."TP_LISTA", 'gerada_em', u."DT_GERACAO", 'pendencias', u."QT_PENDENCIA",
          'publicada', u."ST_PUBLICADA" = 'S',
          -- 20261117193000: a versão da regra com que a lista foi gerada (a vigente vem do contexto).
          'versao_regra', u."NU_VERSAO_REGRA",
          'vagas_pendentes', (select coalesce(jsonb_agg(distinct p ->> 'vaga'), '[]'::jsonb)
                                from jsonb_array_elements(case when jsonb_typeof(u."DS_RESULTADO" -> 'pendencias') = 'array'
                                                               then u."DS_RESULTADO" -> 'pendencias' else '[]'::jsonb end) p
                               where p ->> 'vaga' is not null))), '[]'::jsonb)
        from ultimas u
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = u."CO_MONITORAMENTO"
    ),
    'ajustes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', j."CO_AJUSTE_PONTUACAO", 'edital', j."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', j."TP_LISTA", 'aprovado_em', j."DT_APROVACAO")), '[]'::jsonb)
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = j."CO_MONITORAMENTO"
       where j."TP_SITUACAO" = 'APROVADO'
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
    ),
    'quadros', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', q."CO_QUADRO_VAGA", 'edital', q."CO_MONITORAMENTO", 'cargo', q."NO_CARGO", 'lotacao', q."NO_LOTACAO")
          order by q."CO_MONITORAMENTO", q."CO_QUADRO_VAGA"), '[]'::jsonb)
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."ST_REGISTRO_ATIVO" = 'S'
    ),
    'vinculos', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', v."CO_MONITORAMENTO", 'vaga', v."CO_VAGA", 'situacao', v."TP_VINCULO", 'origem', v."TP_ORIGEM",
          'quadro', v."CO_QUADRO_VAGA", 'pendencia', v."DS_PENDENCIA", 'candidatas', v."DS_CANDIDATA")
          order by v."CO_MONITORAMENTO", v."CO_VAGA"), '[]'::jsonb)
        from public."TA_VAGA_QUADRO_EDITAL" v
       where not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO")
    )
  );
$$;

COMMENT ON FUNCTION public.conferencia_ler_listas_e_quadros() IS 'Conferências (job Python, só service_role): a última lista de classificação de cada edital e tipo (fora do treinamento), com a versão da regra com que foi gerada (20261117193000), as vagas com empate pendente, os ajustes de recurso aprovados, as linhas ativas do quadro de vagas (id, edital, cargo, lotação), cruas, e os vínculos das vagas com o quadro (TA_VAGA_QUADRO_EDITAL, 20261118120000). A vaga sem linha no quadro e a lista final desatualizada são conferidas no robô, com as páginas de conferencia_ler_analises (20261103181500).';

-- 4. RPCs da fila -------------------------------------------------------------------------------
create function private."FC_EXIGIR_EDITAR_QUADRO"(p_edital uuid) returns void
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if not (private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
end;
$$;
comment on function private."FC_EXIGIR_EDITAR_QUADRO"(uuid) is 'Quem grava o quadro de vagas e os vínculos: Núcleo ou Calendário (editor) e o edital (a mesma guarda de salvar_quadro_de_vagas). 20261118120000.';
revoke all on function private."FC_EXIGIR_EDITAR_QUADRO"(uuid) from public;

create function public.gravar_vinculo_do_quadro(p_edital uuid, p_vaga text, p_acao text, p_quadro uuid default null)
returns json
language plpgsql security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_vinculo public."TA_VAGA_QUADRO_EDITAL";
  v jsonb;
begin
  perform private."FC_EXIGIR_EDITAR_QUADRO"(p_edital);
  select * into v_vinculo from public."TA_VAGA_QUADRO_EDITAL" x
   where x."CO_MONITORAMENTO" = p_edital and x."CO_VAGA" = btrim(coalesce(p_vaga, ''));
  if v_vinculo."CO_VAGA" is null then
    raise exception 'Vaga % não está no quadro deste edital', p_vaga using errcode = '22023';
  end if;

  if p_acao = 'CONFIRMAR' then
    if not exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q
                    where q."CO_QUADRO_VAGA" = p_quadro and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S') then
      raise exception 'A linha escolhida não é do quadro vigente deste edital' using errcode = '22023';
    end if;
    perform private."FC_GRAVAR_VINCULO_QUADRO"(p_edital, v_vinculo."CO_VAGA", v_vinculo."NO_VAGA", 'CONFIRMADO', 'MANUAL',
                                               null, p_quadro, '{}', null, 'CONFIRMACAO', v_uid);
  elsif p_acao = 'SEM_LINHA' then
    perform private."FC_GRAVAR_VINCULO_QUADRO"(p_edital, v_vinculo."CO_VAGA", v_vinculo."NO_VAGA", 'AUSENTE', 'MANUAL',
                                               null, null, '{}', null, 'CONFIRMACAO', v_uid);
  elsif p_acao = 'AUTOMATICO' then
    v := private."FC_VINCULO_AUTOMATICO_QUADRO"(p_edital, v_vinculo."CO_VAGA", v_vinculo."NO_VAGA", false);
    perform private."FC_GRAVAR_VINCULO_QUADRO"(p_edital, v_vinculo."CO_VAGA", v_vinculo."NO_VAGA", v ->> 'situacao', 'AUTOMATICO',
                                               v ->> 'regra', (v ->> 'quadro')::uuid,
                                               array(select jsonb_array_elements_text(v -> 'candidatas')::uuid),
                                               null, 'RETORNO_AUTOMATICO', v_uid);
  else
    raise exception 'Ação inválida (CONFIRMAR, SEM_LINHA ou AUTOMATICO)' using errcode = '22023';
  end if;
  return public.obter_quadro_de_vagas(p_edital);
end;
$$;
comment on function public.gravar_vinculo_do_quadro(uuid, text, text, uuid) is 'A equipe decide o vínculo de uma vaga com o quadro: CONFIRMAR (p_quadro, linha vigente do edital), SEM_LINHA (a vaga não tem linha; o aviso some) ou AUTOMATICO (devolve à regra). Vira MANUAL, com histórico. Núcleo ou Calendário (editor) e o edital. Devolve obter_quadro_de_vagas. 20261118120000.';
revoke all on function public.gravar_vinculo_do_quadro(uuid, text, text, uuid) from public, anon;
grant execute on function public.gravar_vinculo_do_quadro(uuid, text, text, uuid) to authenticated, service_role;

create function public.atualizar_vinculos_do_quadro(p_edital uuid) returns json
language plpgsql security definer
set search_path to ''
as $$
begin
  perform private."FC_EXIGIR_EDITAR_QUADRO"(p_edital);
  perform private."FC_PREENCHER_VINCULOS_QUADRO"(p_edital, false, (select auth.uid()));
  return public.obter_quadro_de_vagas(p_edital);
end;
$$;
comment on function public.atualizar_vinculos_do_quadro(uuid) is 'Refaz os vínculos automáticos das vagas do edital com o quadro (vagas novas entram; o título da Empregare fica para a rodada diária). Núcleo ou Calendário (editor) e o edital. Devolve obter_quadro_de_vagas. 20261118120000.';
revoke all on function public.atualizar_vinculos_do_quadro(uuid) from public, anon;
grant execute on function public.atualizar_vinculos_do_quadro(uuid) to authenticated, service_role;

-- 5. A rodada diária e o primeiro preenchimento -----------------------------------------------
insert into public."TB_TAREFA_AGENDADA" ("NO_TAREFA", "ST_PREFIXO", "DS_ROTULO")
values ('agsus_vinculos_do_quadro', 'N', 'Vínculos das vagas com o quadro de vagas');

select cron.schedule(
  'agsus_vinculos_do_quadro', '30 8 * * *',
  $c$select private."FC_PREENCHER_TODOS_VINCULOS_QUADRO"() where pg_try_advisory_xact_lock(hashtext('agsus_vinculos_do_quadro'));$c$);

-- O primeiro preenchimento, medido.
do $$
declare
  v_inicio timestamptz := clock_timestamp();
  v_n integer;
begin
  v_n := private."FC_PREENCHER_TODOS_VINCULOS_QUADRO"();
  raise notice 'Preenchimento: % editais em % s', v_n, round(extract(epoch from clock_timestamp() - v_inicio)::numeric, 1);
end
$$;


-- Conferências -------------------------------------------------------------------------------
do $$
declare
  v_n integer;
begin
  select count(*) into v_n
    from public."TA_VAGA_QUADRO_EDITAL" v
   where v."TP_ORIGEM" = 'AUTOMATICO' and v."TP_REGRA" = 'NOME'
     and v."CO_QUADRO_VAGA" is distinct from private."FC_QUADRO_DA_VAGA"(v."CO_MONITORAMENTO", v."NO_VAGA");
  if v_n > 0 then
    raise exception 'Reprovado: % vínculos pelo nome diferentes de FC_QUADRO_DA_VAGA', v_n;
  end if;
  select count(*) into v_n
    from public."TA_VAGA_QUADRO_EDITAL" v
    left join public."TB_QUADRO_VAGA_EDITAL" q
      on q."CO_QUADRO_VAGA" = v."CO_QUADRO_VAGA" and q."CO_MONITORAMENTO" = v."CO_MONITORAMENTO" and q."ST_REGISTRO_ATIVO" = 'S'
   where v."TP_VINCULO" = 'CONFIRMADO' and q."CO_QUADRO_VAGA" is null;
  if v_n > 0 then
    raise exception 'Reprovado: % vínculos confirmados sem linha ativa do edital', v_n;
  end if;
  select count(*) into v_n from public."TA_VAGA_QUADRO_EDITAL" v
   where v."TP_VINCULO" = 'AMBIGUO' and jsonb_array_length(v."DS_CANDIDATA") = 0;
  if v_n > 0 then
    raise exception 'Reprovado: % vínculos ambíguos sem candidata', v_n;
  end if;
  raise notice 'Conferências aprovadas.';
end
$$;

-- Retrato por edital ---------------------------------------------------------------------------
select m."CO_AREA" as area, m.edital, coalesce(m.status, '') as status,
       count(*) filter (where v."TP_VINCULO" = 'CONFIRMADO' and v."TP_REGRA" = 'NOME') as confirmadas_nome,
       count(*) filter (where v."TP_VINCULO" = 'CONFIRMADO' and v."TP_REGRA" = 'TITULO') as confirmadas_titulo,
       count(*) filter (where v."TP_VINCULO" = 'AMBIGUO') as ambiguas,
       count(*) filter (where v."TP_VINCULO" = 'AUSENTE') as ausentes,
       count(*) as vagas
  from public."TA_VAGA_QUADRO_EDITAL" v
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
 group by 1, 2, 3
having count(*) filter (where v."TP_VINCULO" <> 'CONFIRMADO') > 0
 order by 1, (count(*) filter (where v."TP_VINCULO" <> 'CONFIRMADO')) desc, 2;

select m."CO_AREA" as area,
       count(distinct v."CO_MONITORAMENTO") as editais,
       count(*) filter (where v."TP_VINCULO" = 'CONFIRMADO' and v."TP_REGRA" = 'NOME') as confirmadas_nome,
       count(*) filter (where v."TP_VINCULO" = 'CONFIRMADO' and v."TP_REGRA" = 'TITULO') as confirmadas_titulo,
       count(*) filter (where v."TP_VINCULO" = 'AMBIGUO') as ambiguas,
       count(*) filter (where v."TP_VINCULO" = 'AUSENTE') as ausentes,
       count(*) as vagas
  from public."TA_VAGA_QUADRO_EDITAL" v
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
 group by rollup (1) order by 1;

-- Editais com quadro e sem vaga com código: o que a fila mostra.
select m."CO_AREA" as area, m.edital, coalesce(m.status, '') as status,
       -- A mesma regra de obter_quadro_de_vagas (que exige sessão).
       case when coalesce(m.status, '') = 'Cancelado' then 'NAO_SE_APLICA'
            when exists (select 1 from public."TB_SELECAO_VAGA" s
                          where s."CO_MONITORAMENTO" = m.id and s."ST_REGISTRO_ATIVO" = 'S') then 'EXTERNO'
            else 'PENDENTE_INTEGRACAO' end as vagas_do_edital
  from public."TB_MONITORAMENTO_INDIGENA" m
 where exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = m.id and q."ST_REGISTRO_ATIVO" = 'S')
   and not exists (select 1 from public."TA_VAGA_QUADRO_EDITAL" v where v."CO_MONITORAMENTO" = m.id)
 order by 1, 2;

rollback;
