-- ENSAIO de supabase/migrations/20261026190000_pendencias_do_edital.sql: roda o corpo e desfaz (rollback).
-- Com os dados reais: a leitura do job (tempo, tamanho, sem nome), a gravação do instantâneo com os dois
-- tipos que se tiram direto do banco (os AMBIGUO do "Contratado em outra lista" e os Convocado há mais de 15
-- dias; os outros três são do Python, no modo seco), a segunda rodada (tudo mantido), uma decisão de verdade
-- como administrador global (os contratados do edital e os casos do aviso, antes e depois) e a leitura da
-- tela. Nada sai do banco: o pedido do job fica sem chave (agsus.segredo_disparo_robos). O resultado (json)
-- traz só números e verdadeiro/falso. As RPCs com dados fictícios: supabase/tests/pendencias_do_edital.sql.
begin;

set local agsus.segredo_disparo_robos = 'ensaio-sem-chave';

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."TB_CONTRATACAO_APROVADO"') is null
     or to_regprocedure('private."FC_VINCULO_DA_MATRICULA"(text)') is null
     or to_regprocedure('private."FC_EM_OUTRA_LISTA"(uuid)') is null
     or to_regprocedure('private."FC_PEDIR_CONTRATACAO_DOS_APROVADOS"()') is null then
    raise exception 'Aplique antes 20261024120000_contratado_em_outra_lista.sql.';
  end if;
  if to_regclass('public."TB_CASO_AVISO_CONFERENCIA"') is null
     or to_regprocedure('private."FC_PODE_VER_EDITAL"(uuid)') is null
     or to_regprocedure('private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(uuid)') is null
     or to_regprocedure('private."FC_MARCAR_CACHE"(text[], text[], text)') is null then
    raise exception 'Aplique antes 20261007240000, 20261006070000 e a migration do recorte por edital.';
  end if;
  -- A lista de recursos que esta migration estende é a de 20261006090000 (avaliacao_documental).
  if not ('avaliacao_documental' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'Aplique antes 20261006090000_avaliacao_documental_permissao_e_menu.sql.';
  end if;
end;
$$;

-- 0. A permissão: o recurso "aprovados_pendencias" na matriz de acessos ----------------------------
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao','chat','avaliacao_documental','aprovados_pendencias']::text[];
$function$;

-- O valor inicial de cada grupo; o administrador global muda na tela de Acessos.
insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g."CO_GRUPO_ACESSO", 'aprovados_pendencias',
       case
         when g."ST_ADMIN_GLOBAL" then 'admin'
         when g."CO_GRUPO_ACESSO" = 'edital_gestor' then 'editor'
         else 'sem_acesso'
       end
  from public."TB_GRUPO_ACESSO" g
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

-- 1. O instantâneo e o histórico ------------------------------------------------------------------
create table public."TB_PENDENCIA_APROVADO" (
  "CO_PENDENCIA_APROVADO" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_AREA" text not null,
  "TP_PENDENCIA" varchar(30) not null,
  "DS_CHAVE" varchar(40) not null,
  "CO_CANDIDATO_APROVADO" uuid[] not null,
  "DS_DETALHE" jsonb not null default '{}'::jsonb,
  "TP_SITUACAO" varchar(10) not null default 'ABERTA',
  "DT_DETECCAO" timestamptz not null default now(),
  "DT_ULTIMA_DETECCAO" timestamptz not null default now(),
  "CO_EXECUCAO" text not null,
  "TP_DECISAO" varchar(30),
  "DS_MOTIVO_DECISAO" varchar(500),
  "CO_USUARIO_DECISAO" uuid,
  "DT_RESOLUCAO" timestamptz,
  constraint "PK_PENDENCIA_APROVADO" primary key ("CO_PENDENCIA_APROVADO"),
  constraint "UK_PENDAPROV_TIPO_CHAVE" unique ("TP_PENDENCIA", "DS_CHAVE"),
  constraint "FK_MONITORAMENTO_PENDAPROV" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "FK_AREA_PENDAPROV" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_PENDAPROV_TPPENDENCIA" check ("TP_PENDENCIA" in (
    'CONTRATADO_DUAS_MATRICULAS', 'CONTRATADO_EM_DUAS_LISTAS', 'PESSOA_REPETIDA', 'POSICAO_REPETIDA',
    'CONVOCADO_SEM_DESFECHO')),
  constraint "CK_PENDAPROV_DSCHAVE" check ("DS_CHAVE" ~ '^[0-9a-f]{40}$'),
  constraint "CK_PENDAPROV_CANDIDATOS" check (cardinality("CO_CANDIDATO_APROVADO") between 1 and 50),
  constraint "CK_PENDAPROV_DSDETALHE" check (
    jsonb_typeof("DS_DETALHE") = 'object'
    and length("DS_DETALHE"::text) <= 1000
    and "DS_DETALHE"::text !~ '@'
    and "DS_DETALHE"::text !~ '[0-9]{11}'),
  constraint "CK_PENDAPROV_TPSITUACAO" check ("TP_SITUACAO" in ('ABERTA', 'RESOLVIDA')),
  constraint "CK_PENDAPROV_COEXECUCAO" check ("CO_EXECUCAO" ~ '^pend-[0-9]{8}T[0-9]{6}-[0-9a-f]{8}$'),
  constraint "CK_PENDAPROV_TPDECISAO" check ("TP_DECISAO" is null or "TP_DECISAO" in (
    'VINCULO_ESCOLHIDO', 'LISTA_ESCOLHIDA', 'LINHA_MANTIDA', 'PESSOAS_DIFERENTES', 'EMPATE_PREVISTO',
    'POSICAO_CORRIGIDA', 'DESFECHO_REGISTRADO', 'NOVA_DATA', 'SANEADA')),
  constraint "CK_PENDAPROV_DECISAO" check (case "TP_SITUACAO"
    when 'ABERTA' then "TP_DECISAO" is null and "DS_MOTIVO_DECISAO" is null and "CO_USUARIO_DECISAO" is null
                       and "DT_RESOLUCAO" is null
    else "TP_DECISAO" is not null and "DT_RESOLUCAO" is not null
         and (("TP_DECISAO" = 'SANEADA') = ("CO_USUARIO_DECISAO" is null))
         and ("TP_DECISAO" = 'SANEADA' or length(btrim("DS_MOTIVO_DECISAO")) between 3 and 500) end)
);
comment on table public."TB_PENDENCIA_APROVADO" is
  'Pendências da lista de aprovados que o gestor do edital decide na tela (Lista de aprovados › Pendências): o instantâneo do job Python scripts/aprovados/pendencias.py, uma linha por tipo e chave, aberta ou resolvida (pela decisão, com motivo e autor, ou SANEADA quando sumiu da lista). Só pelas RPCs. 20261026190000.';
comment on column public."TB_PENDENCIA_APROVADO"."CO_PENDENCIA_APROVADO" is 'Identificador da pendência.';
comment on column public."TB_PENDENCIA_APROVADO"."CO_MONITORAMENTO" is 'O edital (TB_MONITORAMENTO_INDIGENA) da lista vigente das linhas.';
comment on column public."TB_PENDENCIA_APROVADO"."CO_AREA" is 'A área do edital (o recorte da tela).';
comment on column public."TB_PENDENCIA_APROVADO"."TP_PENDENCIA" is 'CONTRATADO_DUAS_MATRICULAS, CONTRATADO_EM_DUAS_LISTAS, PESSOA_REPETIDA, POSICAO_REPETIDA ou CONVOCADO_SEM_DESFECHO.';
comment on column public."TB_PENDENCIA_APROVADO"."DS_CHAVE" is 'sha256 (40 hex) do que identifica a pendência (python/monitora/aprovados/pendencias.py, chave): a mesma pendência em rodadas seguidas.';
comment on column public."TB_PENDENCIA_APROVADO"."CO_CANDIDATO_APROVADO" is 'As linhas da lista de aprovados (TB_CANDIDATO_APROVADO.id) da pendência, em ordem.';
comment on column public."TB_PENDENCIA_APROVADO"."DS_DETALHE" is 'O que motivou (linhas, vinculos, motivo da regra, posicao, convocado_em, dias, prazo). Sem nome, CPF, matrícula ou e-mail.';
comment on column public."TB_PENDENCIA_APROVADO"."TP_SITUACAO" is 'ABERTA ou RESOLVIDA.';
comment on column public."TB_PENDENCIA_APROVADO"."DT_DETECCAO" is 'Quando o job achou a pendência pela primeira vez (ou a reabriu).';
comment on column public."TB_PENDENCIA_APROVADO"."DT_ULTIMA_DETECCAO" is 'Última rodada do job que a achou.';
comment on column public."TB_PENDENCIA_APROVADO"."CO_EXECUCAO" is 'Última execução do job que a achou (pend-AAAAMMDDTHHMMSS-xxxxxxxx).';
comment on column public."TB_PENDENCIA_APROVADO"."TP_DECISAO" is 'Como foi resolvida: VINCULO_ESCOLHIDO, LISTA_ESCOLHIDA, LINHA_MANTIDA, PESSOAS_DIFERENTES, EMPATE_PREVISTO, POSICAO_CORRIGIDA, DESFECHO_REGISTRADO, NOVA_DATA ou SANEADA (sumiu da lista, sem decisão aqui).';
comment on column public."TB_PENDENCIA_APROVADO"."DS_MOTIVO_DECISAO" is 'O motivo de quem decidiu (3 a 500 caracteres).';
comment on column public."TB_PENDENCIA_APROVADO"."CO_USUARIO_DECISAO" is 'Quem decidiu (auth.users.id); nulo na SANEADA.';
comment on column public."TB_PENDENCIA_APROVADO"."DT_RESOLUCAO" is 'Quando foi resolvida.';
comment on constraint "PK_PENDENCIA_APROVADO" on public."TB_PENDENCIA_APROVADO" is 'Uma linha por pendência.';
comment on constraint "UK_PENDAPROV_TIPO_CHAVE" on public."TB_PENDENCIA_APROVADO" is 'Uma pendência por tipo e chave.';
comment on constraint "FK_MONITORAMENTO_PENDAPROV" on public."TB_PENDENCIA_APROVADO" is 'O edital; a pendência sai com ele.';
comment on constraint "FK_AREA_PENDAPROV" on public."TB_PENDENCIA_APROVADO" is 'A área do edital.';
comment on constraint "CK_PENDAPROV_TPPENDENCIA" on public."TB_PENDENCIA_APROVADO" is 'Tipos válidos.';
comment on constraint "CK_PENDAPROV_DSCHAVE" on public."TB_PENDENCIA_APROVADO" is 'Chave em 40 hex.';
comment on constraint "CK_PENDAPROV_CANDIDATOS" on public."TB_PENDENCIA_APROVADO" is 'De 1 a 50 linhas.';
comment on constraint "CK_PENDAPROV_DSDETALHE" on public."TB_PENDENCIA_APROVADO" is 'Objeto json curto, sem e-mail nem 11 dígitos seguidos.';
comment on constraint "CK_PENDAPROV_TPSITUACAO" on public."TB_PENDENCIA_APROVADO" is 'Situações válidas.';
comment on constraint "CK_PENDAPROV_COEXECUCAO" on public."TB_PENDENCIA_APROVADO" is 'Identificador da execução do job.';
comment on constraint "CK_PENDAPROV_TPDECISAO" on public."TB_PENDENCIA_APROVADO" is 'Decisões válidas.';
comment on constraint "CK_PENDAPROV_DECISAO" on public."TB_PENDENCIA_APROVADO" is 'Aberta sem decisão; resolvida com decisão e data; quem e o motivo em toda decisão que não é a SANEADA.';
create index "IN_PENDAPROV_AREA_SITUACAO" on public."TB_PENDENCIA_APROVADO" ("CO_AREA", "TP_SITUACAO");
comment on index public."IN_PENDAPROV_AREA_SITUACAO" is 'A tela lê as pendências da área (abertas e as resolvidas recentes).';
create index "IN_FKPENDAPROV_COMONITOR" on public."TB_PENDENCIA_APROVADO" ("CO_MONITORAMENTO");
comment on index public."IN_FKPENDAPROV_COMONITOR" is 'A chave estrangeira do edital.';
alter table public."TB_PENDENCIA_APROVADO" enable row level security;
revoke all on public."TB_PENDENCIA_APROVADO" from public, anon, authenticated, service_role;

create table public."TH_PENDENCIA_APROVADO" (
  "CO_EVENTO_PENDENCIA" uuid not null default gen_random_uuid(),
  "CO_PENDENCIA_APROVADO" uuid not null,
  "TP_EVENTO" varchar(10) not null,
  "TP_DECISAO" varchar(30),
  "DS_MOTIVO" varchar(500),
  "DS_ALTERACAO" jsonb not null default '[]'::jsonb,
  "CO_USUARIO" uuid,
  "DS_EMAIL_USUARIO" varchar(320),
  "NO_USUARIO" varchar(200),
  "CO_EXECUCAO" text,
  "DT_EVENTO" timestamptz not null default now(),
  constraint "PK_TH_PENDENCIA_APROVADO" primary key ("CO_EVENTO_PENDENCIA"),
  constraint "FK_PENDAPROV_HISTPENDAPROV" foreign key ("CO_PENDENCIA_APROVADO")
    references public."TB_PENDENCIA_APROVADO" ("CO_PENDENCIA_APROVADO") on delete cascade,
  constraint "CK_HISTPENDAPROV_TPEVENTO" check ("TP_EVENTO" in ('ABERTA', 'REABERTA', 'DECISAO', 'CORRECAO', 'SANEADA')),
  constraint "CK_HISTPENDAPROV_AUTOR" check (case
    when "TP_EVENTO" in ('DECISAO', 'CORRECAO') then "CO_USUARIO" is not null and "TP_DECISAO" is not null
                                                  and length(btrim("DS_MOTIVO")) between 3 and 500
    else "CO_USUARIO" is null and "CO_EXECUCAO" is not null end),
  constraint "CK_HISTPENDAPROV_ALTERACAO" check (
    jsonb_typeof("DS_ALTERACAO") = 'array' and jsonb_array_length("DS_ALTERACAO") <= 50)
);
comment on table public."TH_PENDENCIA_APROVADO" is
  'Histórico das pendências da lista de aprovados: aberta, reaberta e saneada pelo job; decisão e correção pelo gestor, com motivo, autor e o antes/depois de cada linha (status, posição, remoção). Só pelas RPCs. 20261026190000.';
comment on column public."TH_PENDENCIA_APROVADO"."CO_EVENTO_PENDENCIA" is 'Identificador do evento.';
comment on column public."TH_PENDENCIA_APROVADO"."CO_PENDENCIA_APROVADO" is 'A pendência (TB_PENDENCIA_APROVADO).';
comment on column public."TH_PENDENCIA_APROVADO"."TP_EVENTO" is 'ABERTA, REABERTA ou SANEADA (o job); DECISAO (resolveu) ou CORRECAO (posição corrigida sem resolver), pelo gestor.';
comment on column public."TH_PENDENCIA_APROVADO"."TP_DECISAO" is 'A decisão (os valores de TB_PENDENCIA_APROVADO.TP_DECISAO).';
comment on column public."TH_PENDENCIA_APROVADO"."DS_MOTIVO" is 'O motivo de quem decidiu.';
comment on column public."TH_PENDENCIA_APROVADO"."DS_ALTERACAO" is 'Lista de {candidato, campo (status, posicao, removido), antes, depois}: o que a decisão mudou em cada linha.';
comment on column public."TH_PENDENCIA_APROVADO"."CO_USUARIO" is 'Quem decidiu (auth.users.id); nulo nos eventos do job.';
comment on column public."TH_PENDENCIA_APROVADO"."DS_EMAIL_USUARIO" is 'E-mail de quem decidiu, na hora (o perfil pode mudar depois).';
comment on column public."TH_PENDENCIA_APROVADO"."NO_USUARIO" is 'Nome de quem decidiu, na hora.';
comment on column public."TH_PENDENCIA_APROVADO"."CO_EXECUCAO" is 'Execução do job (eventos do job).';
comment on column public."TH_PENDENCIA_APROVADO"."DT_EVENTO" is 'Quando.';
comment on constraint "PK_TH_PENDENCIA_APROVADO" on public."TH_PENDENCIA_APROVADO" is 'Um evento por linha.';
comment on constraint "FK_PENDAPROV_HISTPENDAPROV" on public."TH_PENDENCIA_APROVADO" is 'A pendência do evento.';
comment on constraint "CK_HISTPENDAPROV_TPEVENTO" on public."TH_PENDENCIA_APROVADO" is 'Eventos válidos.';
comment on constraint "CK_HISTPENDAPROV_AUTOR" on public."TH_PENDENCIA_APROVADO" is 'Decisão e correção com autor, decisão e motivo; eventos do job com a execução e sem autor.';
comment on constraint "CK_HISTPENDAPROV_ALTERACAO" on public."TH_PENDENCIA_APROVADO" is 'Lista json de até 50 alterações.';
create index "IN_FKHISTPENDAPROV_COPENDENCIA" on public."TH_PENDENCIA_APROVADO" ("CO_PENDENCIA_APROVADO", "DT_EVENTO");
comment on index public."IN_FKHISTPENDAPROV_COPENDENCIA" is 'O histórico de uma pendência, em ordem.';
alter table public."TH_PENDENCIA_APROVADO" enable row level security;
revoke all on public."TH_PENDENCIA_APROVADO" from public, anon, authenticated, service_role;

-- 2. A leitura e a gravação do job ---------------------------------------------------------------
create function public.pendencias_ler_aprovados()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with listas as materialized (
    select l.id, l.edital_id::uuid as edital, m."CO_AREA" as area, coalesce(l.ativo, false) as ativo,
           (row_number() over (order by l.id) - 1)::integer as i
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente is true
       and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
  ), linhas as (
    -- Sem nome, CPF nem matrícula: hashes curtos do nome, do código do candidato e da matrícula.
    select c.id, li.i, c.codigo_vaga, c.modalidade, c.classificacao, c.status, c."DT_CONVOCACAO",
           left(encode(sha256(convert_to('pendencia:nome:' || lower(regexp_replace(btrim(c.nome), '\s+', ' ', 'g')),
                                         'UTF8')), 'hex'), 16) as nome,
           left(encode(sha256(convert_to('pendencia:cod:' || nullif(btrim(a.id_origem), ''), 'UTF8')), 'hex'), 16) as codigo,
           case when c.status = 'Contratado' then left(private."FC_VINCULO_DA_MATRICULA"(c.matricula), 16) end as vinculo,
           case when c.status = 'Contratado' then private."FC_EM_OUTRA_LISTA"(c.id) end as outra
      from listas li
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = li.id and c.removido_em is null
      left join public."TB_ANALISE_CURRICULAR" a on a.id = c."CO_ANALISE_CURRICULAR"
  )
  select jsonb_build_object(
    'schema_version', 1,
    'lido_em', now(),
    'listas', (select coalesce(jsonb_agg(jsonb_build_array(li.id, li.edital, li.area, li.ativo) order by li.i), '[]'::jsonb)
                 from listas li),
    'linhas', (select coalesce(jsonb_agg(jsonb_build_array(x.id, x.i, x.codigo_vaga, x.modalidade, x.classificacao,
                                                           x.status, x."DT_CONVOCACAO", x.nome, x.codigo, x.vinculo, x.outra)
                                         order by x.id), '[]'::jsonb)
                 from linhas x),
    'ambiguos', (select coalesce(jsonb_agg(jsonb_build_array(x."CO_CANDIDATO_APROVADO", x."CO_MONITORAMENTO",
                                                             left(x."DS_VINCULO", 16), x."TP_MOTIVO")
                                           order by x."CO_CANDIDATO_APROVADO"), '[]'::jsonb)
                   from public."TB_CONTRATACAO_APROVADO" x
                   join linhas l on l.id = x."CO_CANDIDATO_APROVADO"
                  where x."TP_SITUACAO" = 'AMBIGUO'),
    'pendencias', (select coalesce(jsonb_agg(jsonb_build_array(p."TP_PENDENCIA", p."DS_CHAVE", p."TP_SITUACAO", p."TP_DECISAO")
                                             order by p."TP_PENDENCIA", p."DS_CHAVE"), '[]'::jsonb)
                     from public."TB_PENDENCIA_APROVADO" p)
  );
$function$;
comment on function public.pendencias_ler_aprovados() is
  'Job "Pendências do edital" (Python, só service_role): as listas vigentes fora do treinamento (id, edital, área, ativa), as linhas delas em formato compacto (id, lista, vaga, modalidade, posição, status, data da convocação, hashes curtos do nome, do código do candidato e da matrícula do Contratado, em outra lista), os AMBIGUO do instantâneo TB_CONTRATACAO_APROVADO e as pendências já gravadas (tipo, chave, situação, decisão). Sem nome, CPF nem matrícula. 20261026190000.';
revoke all on function public.pendencias_ler_aprovados() from public, anon, authenticated;
grant execute on function public.pendencias_ler_aprovados() to service_role;

create function public.gravar_pendencias_do_edital(
  p_execucao text,
  p_lido_em timestamptz,
  p_pendencias jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pendencias jsonb := coalesce(p_pendencias, '[]'::jsonb);
  v_invalida text;
  v_novas integer := 0;
  v_mantidas integer := 0;
  v_reabertas integer := 0;
  v_permanentes integer := 0;
  v_saneadas integer := 0;
begin
  if p_execucao is null or p_execucao !~ '^pend-[0-9]{8}T[0-9]{6}-[0-9a-f]{8}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  if p_lido_em is null or p_lido_em > now() or p_lido_em < now() - interval '1 day' then
    raise exception 'Leitura inválida (de quando o job leu as listas, no último dia)' using errcode = '22023';
  end if;
  if jsonb_typeof(v_pendencias) <> 'array' or jsonb_array_length(v_pendencias) > 5000 then
    raise exception 'Lote inválido (até 5000 pendências)' using errcode = '22023';
  end if;

  drop table if exists t_pendencia;
  create temporary table t_pendencia on commit drop as
    select p ->> 'tipo' as tipo, (p ->> 'edital')::uuid as edital, p ->> 'chave' as chave,
           array(select (c #>> '{}')::uuid from jsonb_array_elements(coalesce(p -> 'candidatos', '[]'::jsonb)) c
                  order by 1) as candidatos,
           coalesce(p -> 'detalhe', '{}'::jsonb) as detalhe
      from jsonb_array_elements(v_pendencias) p;

  -- O banco só valida: tipo, chave e detalhe no formato; cada linha numa lista vigente do edital.
  select coalesce(
           (select 'duplicada' from t_pendencia group by tipo, chave having count(*) > 1 limit 1),
           (select 'campos' from t_pendencia
             where tipo is null or edital is null or chave is null
                or tipo not in ('CONTRATADO_DUAS_MATRICULAS', 'CONTRATADO_EM_DUAS_LISTAS', 'PESSOA_REPETIDA',
                                'POSICAO_REPETIDA', 'CONVOCADO_SEM_DESFECHO')
                or chave !~ '^[0-9a-f]{40}$'
                or cardinality(candidatos) not between 1 and 50
                or jsonb_typeof(detalhe) <> 'object' or length(detalhe::text) > 1000
                or detalhe::text ~ '@' or detalhe::text ~ '[0-9]{11}' limit 1),
           (select 'edital' from t_pendencia t
             where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = t.edital) limit 1),
           (select 'linha' from t_pendencia t cross join unnest(t.candidatos) c(id)
             where not exists (select 1 from public."TB_CANDIDATO_APROVADO" a
                                 join public."TB_LISTA_APROVADO" l on l.id = a.lista_id and l.vigente is true
                                where a.id = c.id and a.removido_em is null and l.edital_id = t.edital::text) limit 1))
    into v_invalida;
  if v_invalida is not null then
    raise exception 'Pendências recusadas (%)', v_invalida using errcode = '22023';
  end if;

  -- A aberta que sumiu da lista: resolvida fora daqui (SANEADA).
  with saneadas as (
    update public."TB_PENDENCIA_APROVADO" p
       set "TP_SITUACAO" = 'RESOLVIDA', "TP_DECISAO" = 'SANEADA', "DT_RESOLUCAO" = now()
     where p."TP_SITUACAO" = 'ABERTA'
       and not exists (select 1 from t_pendencia t where t.tipo = p."TP_PENDENCIA" and t.chave = p."DS_CHAVE")
    returning p."CO_PENDENCIA_APROVADO"
  )
  insert into public."TH_PENDENCIA_APROVADO" ("CO_PENDENCIA_APROVADO", "TP_EVENTO", "TP_DECISAO", "CO_EXECUCAO")
  select s."CO_PENDENCIA_APROVADO", 'SANEADA', 'SANEADA', p_execucao from saneadas s;
  get diagnostics v_saneadas = row_count;

  -- A aberta que continua: o detalhe e as linhas de hoje.
  update public."TB_PENDENCIA_APROVADO" p
     set "CO_CANDIDATO_APROVADO" = t.candidatos, "DS_DETALHE" = t.detalhe, "DT_ULTIMA_DETECCAO" = now(),
         "CO_EXECUCAO" = p_execucao
    from t_pendencia t
   where t.tipo = p."TP_PENDENCIA" and t.chave = p."DS_CHAVE" and p."TP_SITUACAO" = 'ABERTA';
  get diagnostics v_mantidas = row_count;

  -- O empate confirmado e as pessoas diferentes não voltam; a resolvida depois da leitura do job também não.
  update public."TB_PENDENCIA_APROVADO" p
     set "DT_ULTIMA_DETECCAO" = now(), "CO_EXECUCAO" = p_execucao
    from t_pendencia t
   where t.tipo = p."TP_PENDENCIA" and t.chave = p."DS_CHAVE" and p."TP_SITUACAO" = 'RESOLVIDA'
     and (p."TP_DECISAO" in ('EMPATE_PREVISTO', 'PESSOAS_DIFERENTES') or p."DT_RESOLUCAO" >= p_lido_em);
  get diagnostics v_permanentes = row_count;

  -- A resolvida que voltou: reabre.
  with reabertas as (
    update public."TB_PENDENCIA_APROVADO" p
       set "TP_SITUACAO" = 'ABERTA', "TP_DECISAO" = null, "DS_MOTIVO_DECISAO" = null, "CO_USUARIO_DECISAO" = null,
           "DT_RESOLUCAO" = null, "CO_CANDIDATO_APROVADO" = t.candidatos, "DS_DETALHE" = t.detalhe,
           "DT_DETECCAO" = now(), "DT_ULTIMA_DETECCAO" = now(), "CO_EXECUCAO" = p_execucao
      from t_pendencia t
     where t.tipo = p."TP_PENDENCIA" and t.chave = p."DS_CHAVE" and p."TP_SITUACAO" = 'RESOLVIDA'
       and p."TP_DECISAO" not in ('EMPATE_PREVISTO', 'PESSOAS_DIFERENTES') and p."DT_RESOLUCAO" < p_lido_em
    returning p."CO_PENDENCIA_APROVADO"
  )
  insert into public."TH_PENDENCIA_APROVADO" ("CO_PENDENCIA_APROVADO", "TP_EVENTO", "CO_EXECUCAO")
  select r."CO_PENDENCIA_APROVADO", 'REABERTA', p_execucao from reabertas r;
  get diagnostics v_reabertas = row_count;

  -- As novas.
  with novas as (
    insert into public."TB_PENDENCIA_APROVADO" (
      "CO_MONITORAMENTO", "CO_AREA", "TP_PENDENCIA", "DS_CHAVE", "CO_CANDIDATO_APROVADO", "DS_DETALHE", "CO_EXECUCAO")
    select t.edital, m."CO_AREA", t.tipo, t.chave, t.candidatos, t.detalhe, p_execucao
      from t_pendencia t
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = t.edital
     where not exists (select 1 from public."TB_PENDENCIA_APROVADO" p
                        where p."TP_PENDENCIA" = t.tipo and p."DS_CHAVE" = t.chave)
    returning "CO_PENDENCIA_APROVADO"
  )
  insert into public."TH_PENDENCIA_APROVADO" ("CO_PENDENCIA_APROVADO", "TP_EVENTO", "CO_EXECUCAO")
  select n."CO_PENDENCIA_APROVADO", 'ABERTA', p_execucao from novas n;
  get diagnostics v_novas = row_count;

  return jsonb_build_object('ok', true, 'novas', v_novas, 'mantidas', v_mantidas, 'reabertas', v_reabertas,
                            'permanentes', v_permanentes, 'saneadas', v_saneadas);
end;
$function$;
comment on function public.gravar_pendencias_do_edital(text, timestamptz, jsonb) is
  'Job "Pendências do edital" (Python, só service_role): grava o instantâneo de hoje (todas as pendências detectadas). Só valida — tipo, chave, detalhe e cada linha numa lista vigente do edital — e guarda: abre as novas, mantém as abertas, reabre a resolvida que voltou (não o empate confirmado, as pessoas diferentes nem a resolvida depois de p_lido_em) e dá como SANEADA a aberta que sumiu. Histórico em TH_PENDENCIA_APROVADO. 20261026190000.';
revoke all on function public.gravar_pendencias_do_edital(text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_pendencias_do_edital(text, timestamptz, jsonb) to service_role;

-- 3. O que as decisões dividem -------------------------------------------------------------------
create function private."FC_PODE_DECIDIR_PENDENCIA"(p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  -- O administrador global faz tudo, em qualquer área e edital (private.is_master). Fora ele, quem
  -- tem Editor ou acima no recurso "aprovados_pendencias" (grupo ou exceção da pessoa, na matriz de
  -- Acessos), com o edital no recorte (área e coordenação: FC_PODE_VER_EDITAL).
  select private.is_master()
      or (private.pode_recurso('aprovados_pendencias', 2)
          and coalesce(private."FC_PODE_VER_EDITAL"(p_edital), false));
$function$;
comment on function private."FC_PODE_DECIDIR_PENDENCIA"(uuid) is
  'Quem decide as pendências do edital: o administrador global (sempre, em qualquer área e edital); fora ele, quem tem Editor ou acima no recurso aprovados_pendencias (matriz de Acessos), com o edital na área e no recorte dele. 20261026190000.';
revoke all on function private."FC_PODE_DECIDIR_PENDENCIA"(uuid) from public, anon, authenticated;

create function private."FC_PENDENCIA_PARA_DECIDIR"(p_pendencia uuid, p_tipos text[], p_motivo text)
returns public."TB_PENDENCIA_APROVADO"
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PENDENCIA_APROVADO"%rowtype;
begin
  select * into v from public."TB_PENDENCIA_APROVADO" p where p."CO_PENDENCIA_APROVADO" = p_pendencia for update;
  if not found then
    raise exception 'Pendência não encontrada' using errcode = 'P0002';
  end if;
  if not private."FC_PODE_DECIDIR_PENDENCIA"(v."CO_MONITORAMENTO") then
    raise exception 'Sem permissão para decidir as pendências deste edital' using errcode = '42501';
  end if;
  if not (v."TP_PENDENCIA" = any (p_tipos)) then
    raise exception 'Esta decisão não serve para esta pendência' using errcode = '22023';
  end if;
  if v."TP_SITUACAO" <> 'ABERTA' then
    raise exception 'Esta pendência já foi resolvida: atualize a tela' using errcode = '55000';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe o motivo (3 a 500 caracteres)' using errcode = '22023';
  end if;
  -- As linhas continuam na lista vigente do edital (sem remoção): senão a pendência mudou.
  if exists (select 1 from unnest(v."CO_CANDIDATO_APROVADO") c(id)
              where not exists (select 1 from public."TB_CANDIDATO_APROVADO" a
                                  join public."TB_LISTA_APROVADO" l on l.id = a.lista_id and l.vigente is true
                                 where a.id = c.id and a.removido_em is null
                                   and l.edital_id = v."CO_MONITORAMENTO"::text)) then
    raise exception 'As linhas desta pendência mudaram: atualize a tela' using errcode = '55000';
  end if;
  return v;
end;
$function$;
comment on function private."FC_PENDENCIA_PARA_DECIDIR"(uuid, text[], text) is
  'Abre a pendência para a decisão (trava a linha): existe, a pessoa decide neste edital (FC_PODE_DECIDIR_PENDENCIA), o tipo serve, está aberta, o motivo tem 3 a 500 caracteres e as linhas continuam na lista vigente. 20261026190000.';
revoke all on function private."FC_PENDENCIA_PARA_DECIDIR"(uuid, text[], text) from public, anon, authenticated;

create function private."FC_STATUS_PELA_PENDENCIA"(p_candidato uuid, p_status text, p_matricula text, p_data date)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_CANDIDATO_APROVADO"%rowtype;
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
  v_data date;
begin
  select * into v from public."TB_CANDIDATO_APROVADO" c where c.id = p_candidato and c.removido_em is null for update;
  if not found then
    raise exception 'As linhas desta pendência mudaram: atualize a tela' using errcode = '55000';
  end if;
  v_matricula := case when p_status in ('Contratado', 'Migração', 'Contratado em outra lista') then v_matricula end;
  v_data := case when p_status = 'Convocado' then p_data
                 when p_status is null then null
                 else v."DT_CONVOCACAO" end;
  -- O mesmo histórico do status da tela (o gatilho do "Contratado em outra lista" refaz a decisão do job).
  insert into public."TH_CANDIDATO_APROVADO" (
    candidato_id, lista_id, status_anterior, status_novo, processo_sei, matricula, alterado_por, "DT_CONVOCACAO")
  values (v.id, v.lista_id, v.status, p_status, v.processo_sei, v_matricula, (select auth.uid()), v_data);
  update public."TB_CANDIDATO_APROVADO"
     set status = p_status, matricula = v_matricula, "DT_CONVOCACAO" = v_data,
         updated_by = (select auth.uid()), updated_at = now()
   where id = v.id;
  return jsonb_build_object('candidato', v.id, 'campo', 'status', 'antes', v.status, 'depois', p_status);
end;
$function$;
comment on function private."FC_STATUS_PELA_PENDENCIA"(uuid, text, text, date) is
  'Muda o status de uma linha pela decisão da pendência, com o histórico do status (TH_CANDIDATO_APROVADO): matrícula só em Contratado, Migração e Contratado em outra lista; a data só no Convocado. Devolve a alteração para o histórico da pendência. 20261026190000.';
revoke all on function private."FC_STATUS_PELA_PENDENCIA"(uuid, text, text, date) from public, anon, authenticated;

create function private."FC_FECHAR_CASOS_DO_AVISO"(p_conferencia text, p_candidatos uuid[])
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_avisos uuid[];
begin
  -- O caso sai do aviso; o aviso sem caso fica resolvido (a conferência confirma na rodada seguinte).
  with apagados as (
    delete from public."TB_CASO_AVISO_CONFERENCIA" k
     using public."TB_AVISO_CONFERENCIA" a
     where a."CO_AVISO_CONFERENCIA" = k."CO_AVISO_CONFERENCIA"
       and a."CO_CONFERENCIA" = p_conferencia
       and a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
       and k."DS_REFERENCIA" = any (select c::text from unnest(p_candidatos) c)
    returning k."CO_AVISO_CONFERENCIA"
  )
  select array_agg(distinct x."CO_AVISO_CONFERENCIA") into v_avisos from apagados x;
  if v_avisos is null then
    return 0;
  end if;
  update public."TB_AVISO_CONFERENCIA" a
     set "DS_EXEMPLO" = (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(a."DS_EXEMPLO") e
                          where not ((e #>> '{}') = any (select c::text from unnest(p_candidatos) c))),
         "QT_OCORRENCIA" = greatest(1, (select count(*) from public."TB_CASO_AVISO_CONFERENCIA" k
                                         where k."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA")::integer)
   where a."CO_AVISO_CONFERENCIA" = any (v_avisos)
     and exists (select 1 from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA");
  update public."TB_AVISO_CONFERENCIA" a
     set "TP_SITUACAO" = 'RESOLVIDO', "DT_RESOLUCAO" = now(),
         "CO_USUARIO_IGNORADO" = null, "DT_IGNORADO" = null, "DS_MOTIVO_IGNORADO" = null, "QT_OCORRENCIA_IGNORADA" = null
   where a."CO_AVISO_CONFERENCIA" = any (v_avisos)
     and not exists (select 1 from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = a."CO_AVISO_CONFERENCIA");
  return cardinality(v_avisos);
end;
$function$;
comment on function private."FC_FECHAR_CASOS_DO_AVISO"(text, uuid[]) is
  'Tira dos avisos abertos (ou ignorados) da conferência os casos das linhas decididas na pendência e resolve o aviso que fica sem caso. 20261026190000.';
revoke all on function private."FC_FECHAR_CASOS_DO_AVISO"(text, uuid[]) from public, anon, authenticated;

create function private."FC_FECHAR_PENDENCIA"(
  p_pendencia uuid,
  p_decisao text,
  p_motivo text,
  p_alteracoes jsonb,
  p_resolve boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PENDENCIA_APROVADO"%rowtype;
  v_perfil record;
  v_conferencia text;
begin
  select * into v from public."TB_PENDENCIA_APROVADO" p where p."CO_PENDENCIA_APROVADO" = p_pendencia;
  select u.email, u.nome into v_perfil
    from public."TB_PERFIL_USUARIO" u
   where u.user_id = (select auth.uid()) and u.ativo is true
   order by u.updated_at desc nulls last limit 1;

  if p_resolve then
    update public."TB_PENDENCIA_APROVADO"
       set "TP_SITUACAO" = 'RESOLVIDA', "TP_DECISAO" = p_decisao, "DS_MOTIVO_DECISAO" = btrim(p_motivo),
           "CO_USUARIO_DECISAO" = (select auth.uid()), "DT_RESOLUCAO" = now()
     where "CO_PENDENCIA_APROVADO" = p_pendencia;
  end if;
  insert into public."TH_PENDENCIA_APROVADO" (
    "CO_PENDENCIA_APROVADO", "TP_EVENTO", "TP_DECISAO", "DS_MOTIVO", "DS_ALTERACAO", "CO_USUARIO",
    "DS_EMAIL_USUARIO", "NO_USUARIO")
  values (p_pendencia, case when p_resolve then 'DECISAO' else 'CORRECAO' end, p_decisao, btrim(p_motivo),
          coalesce(p_alteracoes, '[]'::jsonb), (select auth.uid()), left(v_perfil.email, 320), left(v_perfil.nome, 200));

  -- Os contratados do edital e o pacote da Lista de aprovados da área.
  perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(v."CO_MONITORAMENTO");
  perform private."FC_MARCAR_CACHE"(array['APROVADOS'], array[v."CO_AREA"], 'TB_PENDENCIA_APROVADO');

  v_conferencia := case v."TP_PENDENCIA"
    when 'CONTRATADO_DUAS_MATRICULAS' then 'APROVADOS_CONTRATADO_DUPLICADO'
    when 'CONTRATADO_EM_DUAS_LISTAS' then 'APROVADOS_MESMA_MATRICULA_EM_DUAS_LINHAS'
    when 'CONVOCADO_SEM_DESFECHO' then 'APROVADOS_CONVOCADO_SEM_DESFECHO' end;
  if p_resolve and v_conferencia is not null then
    perform private."FC_FECHAR_CASOS_DO_AVISO"(v_conferencia, v."CO_CANDIDATO_APROVADO");
  end if;

  return jsonb_build_object(
    'ok', true, 'pendencia', p_pendencia, 'situacao', case when p_resolve then 'RESOLVIDA' else 'ABERTA' end,
    'decisao', p_decisao,
    'contratados', (select m.contratados from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v."CO_MONITORAMENTO"));
end;
$function$;
comment on function private."FC_FECHAR_PENDENCIA"(uuid, text, text, jsonb, boolean) is
  'Fecha a decisão da pendência: resolve (ou só registra a correção), grava o histórico com motivo, autor e alterações, recalcula os contratados do edital, marca o pacote da área e tira o caso dos avisos da conferência correspondente. 20261026190000.';
revoke all on function private."FC_FECHAR_PENDENCIA"(uuid, text, text, jsonb, boolean) from public, anon, authenticated;

-- 4. A tela --------------------------------------------------------------------------------------
create function public.listar_pendencias_do_edital(p_area text, p_edital uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  -- O administrador global lê qualquer área; os outros, com Aprovados e a área.
  if not private.is_master() and not private.pode_recurso('aprovados', 1) then
    raise exception 'Sem permissão para a Lista de aprovados' using errcode = '42501';
  end if;
  if p_area is null or not (private.is_master() or private."FC_PODE_AREA"(p_area)) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;

  return (
    with pend as (
      select p.*, m.edital as numero, m.unidade,
             private."FC_PODE_DECIDIR_PENDENCIA"(p."CO_MONITORAMENTO") as pode_decidir
        from public."TB_PENDENCIA_APROVADO" p
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = p."CO_MONITORAMENTO"
       where p."CO_AREA" = p_area
         and (p_edital is null or p."CO_MONITORAMENTO" = p_edital)
         and (p."TP_SITUACAO" = 'ABERTA' or p."DT_RESOLUCAO" > now() - interval '30 days')
         and (private.is_master() or private."FC_PODE_VER_EDITAL"(p."CO_MONITORAMENTO"))
    )
    select jsonb_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'pendencias', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', p."CO_PENDENCIA_APROVADO",
                 'tipo', p."TP_PENDENCIA",
                 'situacao', p."TP_SITUACAO",
                 'edital_id', p."CO_MONITORAMENTO",
                 'edital', p.numero,
                 'unidade', p.unidade,
                 'detalhe', p."DS_DETALHE",
                 'detectada_em', p."DT_DETECCAO",
                 'decisao', p."TP_DECISAO",
                 'motivo', p."DS_MOTIVO_DECISAO",
                 'decidida_em', p."DT_RESOLUCAO",
                 'decidida_por', (select coalesce(nullif(btrim(u.nome), ''), u.email)
                                    from public."TB_PERFIL_USUARIO" u
                                   where u.user_id = p."CO_USUARIO_DECISAO"
                                   order by u.updated_at desc nulls last limit 1),
                 'pode_decidir', p.pode_decidir,
                 'linhas', (
                   select coalesce(jsonb_agg(jsonb_build_object(
                            'id', c.id, 'nome', c.nome, 'cargo', c.cargo, 'vaga', c.codigo_vaga,
                            'modalidade', c.modalidade, 'posicao', c.classificacao, 'nota', c.nota,
                            'status', c.status, 'matricula', c.matricula, 'convocado_em', c."DT_CONVOCACAO",
                            'lista_ativa', coalesce(l.ativo, false), 'removida', c.removido_em is not null)
                          order by c.classificacao nulls last, c.nome, c.id), '[]'::jsonb)
                     from public."TB_CANDIDATO_APROVADO" c
                     join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
                    where c.id = any (p."CO_CANDIDATO_APROVADO")),
                 'historico', (
                   select coalesce(jsonb_agg(jsonb_build_object(
                            'evento', h."TP_EVENTO", 'decisao', h."TP_DECISAO", 'motivo', h."DS_MOTIVO",
                            'alteracoes', h."DS_ALTERACAO", 'por', coalesce(nullif(btrim(h."NO_USUARIO"), ''), h."DS_EMAIL_USUARIO"),
                            'em', h."DT_EVENTO") order by h."DT_EVENTO" desc), '[]'::jsonb)
                     from (select * from public."TH_PENDENCIA_APROVADO" h
                            where h."CO_PENDENCIA_APROVADO" = p."CO_PENDENCIA_APROVADO"
                            order by h."DT_EVENTO" desc limit 20) h))
               order by case p."TP_SITUACAO" when 'ABERTA' then 0 else 1 end, p.numero, p."TP_PENDENCIA",
                        p."DT_DETECCAO", p."CO_PENDENCIA_APROVADO")
          from (select * from pend order by case "TP_SITUACAO" when 'ABERTA' then 0 else 1 end, "DT_DETECCAO"
                 limit 2000) p), '[]'::jsonb)
    )
  );
end;
$function$;
comment on function public.listar_pendencias_do_edital(text, uuid) is
  'Tela Lista de aprovados › Pendências: as pendências da área (e do edital, se pedido) no recorte de quem lê — abertas e as resolvidas nos últimos 30 dias — com as linhas (nome, vaga, modalidade, posição, nota, status, matrícula, data da convocação), quem pode decidir e o histórico. Aprovados >= leitor. 20261026190000.';
revoke all on function public.listar_pendencias_do_edital(text, uuid) from public, anon;
grant execute on function public.listar_pendencias_do_edital(text, uuid) to authenticated;

-- 5. As decisões ---------------------------------------------------------------------------------
create function public.escolher_vinculo_do_contratado(
  p_pendencia uuid,
  p_candidato uuid,
  p_status_das_outras text,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PENDENCIA_APROVADO"%rowtype;
  v_vinculo text;
  v_outras text := btrim(coalesce(p_status_das_outras, ''));
  v_alteracoes jsonb := '[]'::jsonb;
  r record;
begin
  v := private."FC_PENDENCIA_PARA_DECIDIR"(p_pendencia, array['CONTRATADO_DUAS_MATRICULAS'], p_motivo);
  if v_outras not in ('Contratado em outra lista', 'Desistente', 'Sem status') then
    raise exception 'Escolha o desfecho das outras linhas: Contratado em outra lista, Desistente ou Sem status'
      using errcode = '22023';
  end if;
  select private."FC_VINCULO_DA_MATRICULA"(c.matricula) into v_vinculo
    from public."TB_CANDIDATO_APROVADO" c
   where c.id = p_candidato and c.id = any (v."CO_CANDIDATO_APROVADO") and c.status = 'Contratado';
  if v_vinculo is null then
    raise exception 'Escolha uma das linhas Contratado da pendência' using errcode = '22023';
  end if;
  -- As outras linhas Contratado: a mesma matrícula é a mesma contratação (em outra lista); a outra
  -- matrícula recebe o desfecho escolhido.
  for r in select c.id, private."FC_VINCULO_DA_MATRICULA"(c.matricula) as vinculo, c.matricula
             from public."TB_CANDIDATO_APROVADO" c
            where c.id = any (v."CO_CANDIDATO_APROVADO") and c.id <> p_candidato and c.status = 'Contratado'
            order by c.id loop
    v_alteracoes := v_alteracoes || private."FC_STATUS_PELA_PENDENCIA"(
      r.id,
      case when r.vinculo = v_vinculo then 'Contratado em outra lista'
           when v_outras = 'Sem status' then null else v_outras end,
      r.matricula, null);
  end loop;
  return private."FC_FECHAR_PENDENCIA"(p_pendencia, 'VINCULO_ESCOLHIDO', p_motivo, v_alteracoes);
end;
$function$;
comment on function public.escolher_vinculo_do_contratado(uuid, uuid, text, text) is
  'Pendência "Contratado com duas matrículas": a linha escolhida fica Contratado; as outras linhas Contratado da pessoa no edital ficam "Contratado em outra lista" (mesma matrícula) ou com o desfecho escolhido (Contratado em outra lista, Desistente ou Sem status). Quem decide (FC_PODE_DECIDIR_PENDENCIA), com motivo; histórico, contratados e avisos. 20261026190000.';
revoke all on function public.escolher_vinculo_do_contratado(uuid, uuid, text, text) from public, anon;
grant execute on function public.escolher_vinculo_do_contratado(uuid, uuid, text, text) to authenticated;

create function public.escolher_lista_da_contratacao(p_pendencia uuid, p_candidato uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PENDENCIA_APROVADO"%rowtype;
  v_alteracoes jsonb := '[]'::jsonb;
  r record;
begin
  v := private."FC_PENDENCIA_PARA_DECIDIR"(p_pendencia, array['CONTRATADO_EM_DUAS_LISTAS'], p_motivo);
  if not exists (select 1 from public."TB_CANDIDATO_APROVADO" c
                  where c.id = p_candidato and c.id = any (v."CO_CANDIDATO_APROVADO") and c.status = 'Contratado') then
    raise exception 'Escolha uma das linhas Contratado da pendência' using errcode = '22023';
  end if;
  -- As outras ficam "Contratado em outra lista" explícito (o status, com a matrícula): sobrepõe a regra.
  for r in select c.id, c.matricula from public."TB_CANDIDATO_APROVADO" c
            where c.id = any (v."CO_CANDIDATO_APROVADO") and c.id <> p_candidato and c.status = 'Contratado'
            order by c.id loop
    v_alteracoes := v_alteracoes || private."FC_STATUS_PELA_PENDENCIA"(r.id, 'Contratado em outra lista', r.matricula, null);
  end loop;
  return private."FC_FECHAR_PENDENCIA"(p_pendencia, 'LISTA_ESCOLHIDA', p_motivo, v_alteracoes);
end;
$function$;
comment on function public.escolher_lista_da_contratacao(uuid, uuid, text) is
  'Pendência "Contratado em duas listas" (o AMBIGUO do job): a linha escolhida é a contratação; as outras linhas Contratado ficam "Contratado em outra lista" explícito. Quem decide (FC_PODE_DECIDIR_PENDENCIA), com motivo; histórico, contratados e avisos. 20261026190000.';
revoke all on function public.escolher_lista_da_contratacao(uuid, uuid, text) from public, anon;
grant execute on function public.escolher_lista_da_contratacao(uuid, uuid, text) to authenticated;

create function public.manter_linha_da_pessoa_repetida(p_pendencia uuid, p_candidato uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PENDENCIA_APROVADO"%rowtype;
  v_fica public."TB_CANDIDATO_APROVADO"%rowtype;
  v_alteracoes jsonb;
  v_contratado boolean;
begin
  v := private."FC_PENDENCIA_PARA_DECIDIR"(p_pendencia, array['PESSOA_REPETIDA'], p_motivo);
  -- Sem linha escolhida: são pessoas diferentes, todas ficam (a pendência não volta).
  if p_candidato is null then
    return private."FC_FECHAR_PENDENCIA"(p_pendencia, 'PESSOAS_DIFERENTES', p_motivo, '[]'::jsonb);
  end if;
  select * into v_fica from public."TB_CANDIDATO_APROVADO" c
   where c.id = p_candidato and c.id = any (v."CO_CANDIDATO_APROVADO");
  if not found then
    raise exception 'Escolha uma das linhas da pendência' using errcode = '22023';
  end if;
  if v_fica.status is null and exists (
       select 1 from public."TB_CANDIDATO_APROVADO" c
        where c.id = any (v."CO_CANDIDATO_APROVADO") and c.id <> p_candidato and c.status is not null) then
    raise exception 'A linha que sai tem status: mantenha a linha com status' using errcode = '22023';
  end if;

  select exists (select 1 from public."TB_CANDIDATO_APROVADO" c
                  where c.id = any (v."CO_CANDIDATO_APROVADO") and c.id <> p_candidato and c.status = 'Contratado')
    into v_contratado;
  -- A remoção lógica que a lista já tem: nada se apaga.
  with removidas as (
    update public."TB_CANDIDATO_APROVADO" c
       set removido_em = now(), removido_por = (select auth.uid()), updated_by = (select auth.uid()), updated_at = now()
     where c.id = any (v."CO_CANDIDATO_APROVADO") and c.id <> p_candidato and c.removido_em is null
    returning c.id
  )
  select coalesce(jsonb_agg(jsonb_build_object('candidato', r.id, 'campo', 'removido', 'antes', false, 'depois', true)
                            order by r.id), '[]'::jsonb)
    into v_alteracoes from removidas r;
  -- Saiu uma linha Contratado: a decisão do "Contratado em outra lista" do edital é refeita.
  if v_contratado then
    delete from public."TB_CONTRATACAO_APROVADO" x where x."CO_MONITORAMENTO" = v."CO_MONITORAMENTO"
       and x."DS_VINCULO" in (select private."FC_VINCULO_DA_MATRICULA"(c.matricula) from public."TB_CANDIDATO_APROVADO" c
                               where c.id = any (v."CO_CANDIDATO_APROVADO") and c.status = 'Contratado');
    perform private."FC_PEDIR_CONTRATACAO_DOS_APROVADOS"();
  end if;
  return private."FC_FECHAR_PENDENCIA"(p_pendencia, 'LINHA_MANTIDA', p_motivo, v_alteracoes);
end;
$function$;
comment on function public.manter_linha_da_pessoa_repetida(uuid, uuid, text) is
  'Pendência "Pessoa repetida": a linha escolhida fica e as outras saem pela remoção lógica (removido_em/removido_por); sem linha escolhida, são pessoas diferentes e todas ficam (não volta). Não deixa sair a linha com status para ficar a sem status. Quem decide (FC_PODE_DECIDIR_PENDENCIA), com motivo; histórico e contratados. 20261026190000.';
revoke all on function public.manter_linha_da_pessoa_repetida(uuid, uuid, text) from public, anon;
grant execute on function public.manter_linha_da_pessoa_repetida(uuid, uuid, text) to authenticated;

create function public.confirmar_empate_da_posicao(p_pendencia uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private."FC_PENDENCIA_PARA_DECIDIR"(p_pendencia, array['POSICAO_REPETIDA'], p_motivo);
  return private."FC_FECHAR_PENDENCIA"(p_pendencia, 'EMPATE_PREVISTO', p_motivo, '[]'::jsonb);
end;
$function$;
comment on function public.confirmar_empate_da_posicao(uuid, text) is
  'Pendência "Posição repetida": o gestor confirma o empate previsto no edital; a mesma pendência (as mesmas linhas na mesma posição) não volta. Quem decide (FC_PODE_DECIDIR_PENDENCIA), com motivo e histórico. 20261026190000.';
revoke all on function public.confirmar_empate_da_posicao(uuid, text) from public, anon;
grant execute on function public.confirmar_empate_da_posicao(uuid, text) to authenticated;

create function public.corrigir_posicao_da_pendencia(
  p_pendencia uuid,
  p_candidato uuid,
  p_posicao integer,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PENDENCIA_APROVADO"%rowtype;
  v_antes integer;
  v_resolve boolean;
begin
  v := private."FC_PENDENCIA_PARA_DECIDIR"(p_pendencia, array['POSICAO_REPETIDA'], p_motivo);
  if p_posicao is null or p_posicao not between 1 and 100000 then
    raise exception 'Posição inválida (1 a 100000)' using errcode = '22023';
  end if;
  select c.classificacao into v_antes from public."TB_CANDIDATO_APROVADO" c
   where c.id = p_candidato and c.id = any (v."CO_CANDIDATO_APROVADO") for update;
  if not found then
    raise exception 'Escolha uma das linhas da pendência' using errcode = '22023';
  end if;
  if v_antes is not distinct from p_posicao then
    raise exception 'A posição nova é igual à atual' using errcode = '22023';
  end if;
  update public."TB_CANDIDATO_APROVADO"
     set classificacao = p_posicao, updated_by = (select auth.uid()), updated_at = now()
   where id = p_candidato;
  -- Resolve quando as linhas da pendência deixam de dividir a posição; senão fica a correção registrada.
  select count(distinct c.classificacao) = count(*) into v_resolve
    from public."TB_CANDIDATO_APROVADO" c
   where c.id = any (v."CO_CANDIDATO_APROVADO") and c.removido_em is null;
  return private."FC_FECHAR_PENDENCIA"(
    p_pendencia, 'POSICAO_CORRIGIDA', p_motivo,
    jsonb_build_array(jsonb_build_object('candidato', p_candidato, 'campo', 'posicao', 'antes', v_antes, 'depois', p_posicao)),
    v_resolve);
end;
$function$;
comment on function public.corrigir_posicao_da_pendencia(uuid, uuid, integer, text) is
  'Pendência "Posição repetida": corrige a posição (classificação) de uma das linhas, com o antes e o depois no histórico; resolve quando as linhas deixam de dividir a posição. Quem decide (FC_PODE_DECIDIR_PENDENCIA), com motivo. 20261026190000.';
revoke all on function public.corrigir_posicao_da_pendencia(uuid, uuid, integer, text) from public, anon;
grant execute on function public.corrigir_posicao_da_pendencia(uuid, uuid, integer, text) to authenticated;

create function public.registrar_desfecho_da_pendencia(
  p_pendencia uuid,
  p_status text,
  p_matricula text,
  p_data_convocacao date,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PENDENCIA_APROVADO"%rowtype;
  v_atual public."TB_CANDIDATO_APROVADO"%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  v := private."FC_PENDENCIA_PARA_DECIDIR"(p_pendencia, array['CONVOCADO_SEM_DESFECHO'], p_motivo);
  select * into v_atual from public."TB_CANDIDATO_APROVADO" c where c.id = v."CO_CANDIDATO_APROVADO"[1];
  if v_atual.status is distinct from 'Convocado' then
    raise exception 'As linhas desta pendência mudaram: atualize a tela' using errcode = '55000';
  end if;
  if v_status is null or v_status not in ('Contratado', 'Migração', 'Desistente', 'Documentação Rejeitada', 'Convocado') then
    raise exception 'Desfecho inválido' using errcode = '22023';
  end if;
  if v_status in ('Contratado', 'Migração') and nullif(btrim(coalesce(p_matricula, '')), '') is null then
    raise exception 'Matrícula obrigatória para Contratado ou Migração' using errcode = '22023';
  end if;
  if v_status = 'Convocado' and (p_data_convocacao is null or p_data_convocacao > v_hoje
                                  or p_data_convocacao = v_atual."DT_CONVOCACAO") then
    raise exception 'Informe a nova data da convocação (diferente da atual e não futura)' using errcode = '22023';
  end if;
  if v_status <> 'Convocado' and p_data_convocacao is not null then
    raise exception 'A data da convocação só vale para a nova convocação' using errcode = '22023';
  end if;
  return private."FC_FECHAR_PENDENCIA"(
    p_pendencia, case when v_status = 'Convocado' then 'NOVA_DATA' else 'DESFECHO_REGISTRADO' end, p_motivo,
    jsonb_build_array(private."FC_STATUS_PELA_PENDENCIA"(v_atual.id, v_status, p_matricula, p_data_convocacao)));
end;
$function$;
comment on function public.registrar_desfecho_da_pendencia(uuid, text, text, date, text) is
  'Pendência "Convocado sem desfecho": registra o desfecho (Contratado ou Migração com matrícula, Desistente, Documentação Rejeitada) ou a nova data da convocação (não futura). Quem decide (FC_PODE_DECIDIR_PENDENCIA), com motivo; histórico do status e da pendência, contratados e avisos. 20261026190000.';
revoke all on function public.registrar_desfecho_da_pendencia(uuid, text, text, date, text) from public, anon;
grant execute on function public.registrar_desfecho_da_pendencia(uuid, text, text, date, text) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

create temporary table t_ensaio (chave text primary key, valor jsonb) on commit drop;

do $$
declare
  v_admin record;
  v_leitura jsonb;
  v_inicio timestamptz := clock_timestamp();
  v_r jsonb;
  v_pend record;
  v_antes integer;
  v_casos_antes integer;
begin
  -- 1. A leitura do job (só números saem do ensaio).
  v_leitura := public.pendencias_ler_aprovados();
  insert into t_ensaio values ('leitura', jsonb_build_object(
    'ms', round(extract(epoch from clock_timestamp() - v_inicio) * 1000),
    'listas', jsonb_array_length(v_leitura -> 'listas'),
    'linhas', jsonb_array_length(v_leitura -> 'linhas'),
    'ambiguos', jsonb_array_length(v_leitura -> 'ambiguos'),
    'kb', length(v_leitura::text) / 1024,
    'sem_email', v_leitura::text !~ '@'));

  -- 2. O job grava: aqui, os dois tipos que se tiram direto do banco, com a chave do Python
  --    (sha256 de "TIPO|edital|vínculo" e "TIPO|linha|data"); os outros três são do Python (modo seco).
  v_r := public.gravar_pendencias_do_edital('pend-20261026T000000-00000e5a', now(), (
    with amb as (
      select x."CO_MONITORAMENTO" as edital, left(x."DS_VINCULO", 16) as vinculo, min(x."TP_MOTIVO") as motivo,
             jsonb_agg(x."CO_CANDIDATO_APROVADO"::text order by x."CO_CANDIDATO_APROVADO"::text) as ids
        from public."TB_CONTRATACAO_APROVADO" x
        join public."TB_CANDIDATO_APROVADO" c on c.id = x."CO_CANDIDATO_APROVADO" and c.removido_em is null
                                              and c.status = 'Contratado'
        join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = x."CO_MONITORAMENTO"
                                                  and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
       where x."TP_SITUACAO" = 'AMBIGUO'
       group by 1, 2 having count(*) > 1
    ), conv as (
      select l.edital_id::uuid as edital, c.id, c."DT_CONVOCACAO" as em
        from public."TB_CANDIDATO_APROVADO" c
        join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente and l.ativo
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
                                                  and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
       where c.removido_em is null and c.status = 'Convocado'
         and c."DT_CONVOCACAO" < (now() at time zone 'America/Sao_Paulo')::date - 15
    )
    select jsonb_agg(s.p) from (
      select jsonb_build_object('tipo', 'CONTRATADO_EM_DUAS_LISTAS', 'edital', a.edital,
               'chave', left(encode(sha256(convert_to('CONTRATADO_EM_DUAS_LISTAS|' || a.edital || '|' || a.vinculo, 'UTF8')), 'hex'), 40),
               'candidatos', a.ids, 'detalhe', jsonb_build_object('linhas', jsonb_array_length(a.ids), 'motivo', a.motivo)) as p
        from amb a
      union all
      select jsonb_build_object('tipo', 'CONVOCADO_SEM_DESFECHO', 'edital', v.edital,
               'chave', left(encode(sha256(convert_to('CONVOCADO_SEM_DESFECHO|' || v.id || '|' || v.em, 'UTF8')), 'hex'), 40),
               'candidatos', jsonb_build_array(v.id),
               'detalhe', jsonb_build_object('linhas', 1, 'convocado_em', v.em,
                                             'dias', (now() at time zone 'America/Sao_Paulo')::date - v.em, 'prazo', 15))
        from conv v) s));
  insert into t_ensaio values ('gravacao', v_r);
  insert into t_ensaio values ('por_area', (
    select jsonb_object_agg(x.area, x.tipos) from (
      select p."CO_AREA" as area, jsonb_object_agg(p."TP_PENDENCIA", p.n) as tipos
        from (select "CO_AREA", "TP_PENDENCIA", count(*) as n from public."TB_PENDENCIA_APROVADO" group by 1, 2) p
       group by 1) x));
  -- A mesma rodada de novo: nada novo, todas mantidas.
  v_r := public.gravar_pendencias_do_edital('pend-20261026T000001-00000e5a', now(), (
    select jsonb_agg(jsonb_build_object('tipo', p."TP_PENDENCIA", 'edital', p."CO_MONITORAMENTO", 'chave', p."DS_CHAVE",
                                        'candidatos', to_jsonb(p."CO_CANDIDATO_APROVADO"), 'detalhe', p."DS_DETALHE"))
      from public."TB_PENDENCIA_APROVADO" p));
  insert into t_ensaio values ('segunda_rodada', v_r);

  -- 3. Uma decisão de verdade (desfeita no rollback), como administrador global: a primeira pendência
  --    "Contratado em duas listas"; os contratados do edital e o aviso da conferência, antes e depois.
  select p.user_id, p.email into v_admin
    from public."TB_PERFIL_USUARIO" p join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo and p.user_id is not null and g."ST_ADMIN_GLOBAL" order by p.created_at limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin.user_id, 'email', v_admin.email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin.user_id::text, true);

  select p.* into v_pend from public."TB_PENDENCIA_APROVADO" p
   where p."TP_PENDENCIA" = 'CONTRATADO_EM_DUAS_LISTAS' order by p."CO_AREA", p."DS_CHAVE" limit 1;
  select m.contratados into v_antes from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_pend."CO_MONITORAMENTO";
  select count(*) into v_casos_antes from public."TB_CASO_AVISO_CONFERENCIA" k
    join public."TB_AVISO_CONFERENCIA" a using ("CO_AVISO_CONFERENCIA")
   where a."CO_CONFERENCIA" = 'APROVADOS_MESMA_MATRICULA_EM_DUAS_LINHAS' and a."TP_SITUACAO" in ('ABERTO', 'IGNORADO');
  v_r := public.escolher_lista_da_contratacao(v_pend."CO_PENDENCIA_APROVADO", v_pend."CO_CANDIDATO_APROVADO"[1],
                                              'Ensaio: a pessoa foi contratada por esta lista');
  insert into t_ensaio values ('decisao_real', jsonb_build_object(
    'area', v_pend."CO_AREA",
    'linhas', cardinality(v_pend."CO_CANDIDATO_APROVADO"),
    'em_outra_lista', (select count(*) from public."TB_CANDIDATO_APROVADO" c
                        where c.id = any (v_pend."CO_CANDIDATO_APROVADO") and c.status = 'Contratado em outra lista'),
    'contratados_antes', v_antes,
    'contratados_depois', (v_r ->> 'contratados')::integer,
    'pendencia_resolvida', (select p."TP_SITUACAO" = 'RESOLVIDA' from public."TB_PENDENCIA_APROVADO" p
                             where p."CO_PENDENCIA_APROVADO" = v_pend."CO_PENDENCIA_APROVADO"),
    'historico', (select count(*) from public."TH_PENDENCIA_APROVADO" h
                   where h."CO_PENDENCIA_APROVADO" = v_pend."CO_PENDENCIA_APROVADO" and h."TP_EVENTO" = 'DECISAO'),
    'casos_do_aviso_antes', v_casos_antes,
    'casos_do_aviso_depois', (select count(*) from public."TB_CASO_AVISO_CONFERENCIA" k
                                join public."TB_AVISO_CONFERENCIA" a using ("CO_AVISO_CONFERENCIA")
                               where a."CO_CONFERENCIA" = 'APROVADOS_MESMA_MATRICULA_EM_DUAS_LINHAS'
                                 and a."TP_SITUACAO" in ('ABERTO', 'IGNORADO'))));

  -- 4. A tela lê a área da decisão.
  v_inicio := clock_timestamp();
  v_r := public.listar_pendencias_do_edital(v_pend."CO_AREA");
  insert into t_ensaio values ('tela', jsonb_build_object(
    'ms', round(extract(epoch from clock_timestamp() - v_inicio) * 1000),
    'pendencias', jsonb_array_length(v_r -> 'pendencias'),
    'abertas', (select count(*) from jsonb_array_elements(v_r -> 'pendencias') p where p ->> 'situacao' = 'ABERTA'),
    'admin_global_decide_todas', (select bool_and((p ->> 'pode_decidir')::boolean)
                                    from jsonb_array_elements(v_r -> 'pendencias') p)));
end;
$$;

-- O que muda só no ensaio: o resultado. Tudo acima é desfeito pelo rollback.
select jsonb_object_agg(chave, valor order by chave) as ensaio from t_ensaio;

rollback;
