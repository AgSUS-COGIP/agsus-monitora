/*
  LEITURAS POR VERSÃO: A MARCA SAI ANTES DE MONTAR O PAYLOAD (29/10/2026)

  Por quê: as RPCs "*_se_mudou" (20261013160000, 20261014230000, 20261015000000)
  montavam o payload INTEIRO e só depois tiravam o md5 para comparar com a
  versão que a tela mandou. Responder `inalterado` custava o mesmo que mandar
  tudo. pg_stat_statements (authenticated, 14/10 a 29/10/2026):

    RPC                                            chamadas  média     máx     total
    listar_acompanhamento_da_visao_geral_se_mudou       490    932 ms  7,4 s    457 s
    obter_regra_analise_se_mudou                        992    336 ms  7,8 s    333 s
    listar_avisos_conferencia_se_mudou                1.952    153 ms  5,0 s    298 s
    get_analises_dashboard_payload_v2_se_mudou          903    246 ms  7,8 s    222 s
    get_selecao_da_area_se_mudou                         97  1.808 ms  5,9 s    175 s
    get_entrevistas_da_area_se_mudou                     65    649 ms  7,7 s     42 s
    obter_classificacao_do_edital_se_mudou               60    620 ms  3,5 s     37 s

  O QUE MUDA
    1. private."TL_VERSAO_FONTE": uma linha por TRANSAÇÃO que escreveu numa
       tabela de origem (gatilho POR COMANDO "TG_VERSAO_FONTE", ENABLE ALWAYS:
       vale também com session_replication_role = replica, como nas correções).
       Só insere: o gatilho não disputa linha com ninguém (nada de contador que
       trava quem escreve até o commit). A versão de uma fonte é a SOMA de
       QT_ALTERACAO das linhas dela: cresce a cada transação confirmada, e
       aparece para quem lê exatamente quando os dados aparecem (mesma
       transação). private."FC_COMPACTAR_VERSAO_FONTE" junta as linhas da fonte
       numa só, com a mesma soma (o gatilho chama quando passa de 50 linhas).
    2. private."TD_LEITURA_POR_MARCA" (uma linha por leitura: as funções raiz)
       e private."TD_FONTE_DA_LEITURA" (as tabelas que cada leitura lê),
       calculadas do CÓDIGO por private."FC_FONTES_PELO_CODIGO": o fecho das
       funções e views que a raiz chama, até as tabelas (inclusive as de
       permissão e recorte: perfil, grupo, área, coordenação, analista do
       edital). private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"() recalcula a lista
       e põe o gatilho em toda fonte nova. QUEM MUDAR uma função desse fecho
       (tests/marca-barata-das-leituras-migration.test.js tem a lista) roda
       FC_ATUALIZAR_FONTES_DAS_LEITURAS() na mesma migration.
    3. private."FC_MARCA_DA_LEITURA"(leitura, chave): 'm1:' || md5 da leitura,
       dos parâmetros, de QUEM lê (auth.uid, e-mail do JWT, papel) e da versão
       de cada fonte. Muda quando qualquer fonte muda (dado, permissão ou
       recorte) ou quando muda a pessoa; ~1 ms. Sem fontes registradas: nulo, e
       a RPC volta ao md5 do payload (o comportamento de antes).
    4. private."FC_MARCA_DA_RPC"(rpc, …): confere a permissão da RPC (mesmos
       erros da função de sempre) e devolve a marca. Painéis com pacote pronto
       (Análises sem recorte, pacote de menos de 24 h; Entrevistas sem recorte):
       a marca é a da LINHA do pacote (DT_GERACAO, DS_VERSAO_DADOS) mais as
       permissões e TB_AREA — o payload delas é só o pacote e a área.
    5. As sete RPCs "*_se_mudou" abaixo tiram a marca ANTES; com p_versao igual,
       devolvem só { inalterado, versao } sem montar nada; senão montam pela
       função de sempre e anexam a marca como `versao`. A marca é tirada antes
       da montagem: uma mudança no meio deixa a marca velha com o payload novo,
       e a próxima chamada manda de novo (nunca o contrário).
       Fora daqui: obter_pre_classificacao_se_mudou (outra frente) e
       FC_SE_MUDOU/FC_SE_MUDOU_EM_COLUNAS (continuam iguais, usadas por ela e
       pela volta ao md5).

  Assinaturas, tipos de retorno e permissões das RPCs iguais; a `versao` é
  opaca para a tela (src/lib/cache-de-payload.ts, leitura-por-versao.ts): a
  primeira chamada depois de aplicar manda o payload uma vez (versão nova).
  Para aplicar, a migration confere que as sete RPCs são as de 20261013160000,
  20261014230000 e 20261015000000 (para se outra PR tiver mexido nelas).

  Ensaio: supabase/ensaios/20261029150000_marca_barata_das_leituras_por_versao.sql
  Rollback: supabase/rollback/20261029150000_marca_barata_das_leituras_por_versao.sql
*/
begin;

set local lock_timeout = '10s';

-- 0. As sete RPCs são as que esta migration conhece (ou já as desta) --------------------
do $guarda$
declare
  v_esperado constant jsonb := jsonb_build_object(
    'get_analises_dashboard_payload_v2_se_mudou', '6bff1f3b92a65d0a8b0dee77025d0b69',
    'get_entrevistas_da_area_se_mudou', 'fbc4d002d14e02a448ae97691011cff7',
    'get_selecao_da_area_se_mudou', 'ef7d958eab10a113384337efe18d52df',
    'listar_acompanhamento_da_visao_geral_se_mudou', '0b672405bbe80a484886e75f113daa05',
    'listar_avisos_conferencia_se_mudou', '3335e4d4b5527b4becf950e9cf244bc9',
    'obter_classificacao_do_edital_se_mudou', '5f68331ac1d1f5582bb6b09abdbdc304',
    'obter_regra_analise_se_mudou', '6a3b83a397cb6285b9313bfdf4891c3e');
  v_diferentes text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_diferentes
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where v_esperado ? p.proname
     and md5(p.prosrc) <> v_esperado ->> p.proname::text
     and p.prosrc not like '%FC_MARCA_DA_RPC%';
  if v_diferentes is not null then
    raise exception 'RPC(s) diferente(s) da que esta migration conhece: %. Refaça a migration sobre a versão do banco.', v_diferentes;
  end if;
end;
$guarda$;

-- 1. Versão das fontes --------------------------------------------------------------------
create table if not exists private."TL_VERSAO_FONTE" (
  "CO_VERSAO_FONTE" bigint generated always as identity,
  "NO_FONTE" varchar(130) not null,
  "QT_ALTERACAO" bigint not null default 1,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TL_VERSAO_FONTE" primary key ("CO_VERSAO_FONTE"),
  constraint "CK_TLVERSAOFONTE_QTALTERACAO" check ("QT_ALTERACAO" > 0)
);
create index if not exists "IN_TLVERSAOFONTE_NOFONTE" on private."TL_VERSAO_FONTE" ("NO_FONTE") include ("QT_ALTERACAO");
alter table private."TL_VERSAO_FONTE" enable row level security;
revoke all on table private."TL_VERSAO_FONTE" from public, anon, authenticated, service_role;

comment on table private."TL_VERSAO_FONTE" is
  'Versão de cada tabela de origem das leituras por versão (20261029150000): uma linha por transação que escreveu na tabela (gatilho TG_VERSAO_FONTE), ou uma linha compactada com a soma. A versão da fonte é sum(QT_ALTERACAO): só cresce. Nunca apagar linhas fora de FC_COMPACTAR_VERSAO_FONTE (a soma voltaria a um valor já usado).';
comment on column private."TL_VERSAO_FONTE"."CO_VERSAO_FONTE" is 'Identificador da linha (sequencial).';
comment on column private."TL_VERSAO_FONTE"."NO_FONTE" is 'Tabela de origem, como esquema.TABELA (TD_FONTE_DA_LEITURA.NO_FONTE).';
comment on column private."TL_VERSAO_FONTE"."QT_ALTERACAO" is 'Transações confirmadas que esta linha representa: 1, ou a soma das linhas juntadas pela compactação.';
comment on column private."TL_VERSAO_FONTE"."DT_REGISTRO" is 'Quando a linha foi gravada.';

-- 2. Leituras e as fontes de cada uma ------------------------------------------------------
create table if not exists private."TD_LEITURA_POR_MARCA" (
  "NO_LEITURA" varchar(60) not null,
  "DS_FUNCOES" text[] not null,
  "DS_FONTES_EXTRAS" text[] not null default '{}',
  "DS_LEITURA" text not null,
  constraint "PK_TD_LEITURA_POR_MARCA" primary key ("NO_LEITURA")
);
alter table private."TD_LEITURA_POR_MARCA" enable row level security;
revoke all on table private."TD_LEITURA_POR_MARCA" from public, anon, authenticated, service_role;
comment on table private."TD_LEITURA_POR_MARCA" is
  'Leituras com marca barata (20261029150000): as funções raiz de cada uma (o fecho delas dá as fontes) e fontes extras que o fecho não alcança.';
comment on column private."TD_LEITURA_POR_MARCA"."NO_LEITURA" is 'Nome da leitura (FC_MARCA_DA_LEITURA).';
comment on column private."TD_LEITURA_POR_MARCA"."DS_FUNCOES" is 'Funções (public/private) cujo fecho de chamadas e views dá as tabelas de origem.';
comment on column private."TD_LEITURA_POR_MARCA"."DS_FONTES_EXTRAS" is 'Tabelas (esquema.TABELA) lidas fora das funções raiz (ex.: pela própria RPC por versão).';
comment on column private."TD_LEITURA_POR_MARCA"."DS_LEITURA" is 'O que a leitura entrega (para quem mantém).';

create table if not exists private."TD_FONTE_DA_LEITURA" (
  "NO_LEITURA" varchar(60) not null,
  "NO_FONTE" varchar(130) not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TD_FONTE_DA_LEITURA" primary key ("NO_LEITURA", "NO_FONTE"),
  constraint "FK_TDFONTELEIT_TDLEITMARCA" foreign key ("NO_LEITURA")
    references private."TD_LEITURA_POR_MARCA" ("NO_LEITURA") on delete cascade
);
alter table private."TD_FONTE_DA_LEITURA" enable row level security;
revoke all on table private."TD_FONTE_DA_LEITURA" from public, anon, authenticated, service_role;
comment on table private."TD_FONTE_DA_LEITURA" is
  'Tabelas de origem de cada leitura com marca (20261029150000), calculadas por FC_ATUALIZAR_FONTES_DAS_LEITURAS. Toda fonte tem o gatilho TG_VERSAO_FONTE.';
comment on column private."TD_FONTE_DA_LEITURA"."NO_LEITURA" is 'Leitura (TD_LEITURA_POR_MARCA).';
comment on column private."TD_FONTE_DA_LEITURA"."NO_FONTE" is 'Tabela de origem, como esquema.TABELA.';
comment on column private."TD_FONTE_DA_LEITURA"."DT_ATUALIZACAO" is 'Quando a fonte entrou na lista.';

-- 3. Compactação e gatilho -----------------------------------------------------------------
create or replace function private."FC_COMPACTAR_VERSAO_FONTE"(p_fonte text default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_fonte text;
  v_juntadas integer;
  v_total integer := 0;
begin
  for v_fonte in
    select distinct v."NO_FONTE" from private."TL_VERSAO_FONTE" v
     where p_fonte is null or v."NO_FONTE" = p_fonte
     order by 1
  loop
    -- Uma compactação por fonte de cada vez (até o fim da transação): as linhas apagadas
    -- e a linha com a soma aparecem juntas, e a soma não muda. Linha de transação ainda
    -- aberta não é vista pelo delete e fica para a próxima.
    continue when not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('agsus_versao_fonte:' || v_fonte));
    continue when (select count(*) from private."TL_VERSAO_FONTE" v where v."NO_FONTE" = v_fonte) < 2;
    with apagadas as (
      delete from private."TL_VERSAO_FONTE" v where v."NO_FONTE" = v_fonte returning v."QT_ALTERACAO"
    )
    insert into private."TL_VERSAO_FONTE" ("NO_FONTE", "QT_ALTERACAO")
    select v_fonte, sum(a."QT_ALTERACAO") from apagadas a having count(*) > 0;
    get diagnostics v_juntadas = row_count;
    v_total := v_total + v_juntadas;
  end loop;
  return v_total;
end;
$function$;

revoke all on function private."FC_COMPACTAR_VERSAO_FONTE"(text) from public, anon, authenticated;
comment on function private."FC_COMPACTAR_VERSAO_FONTE"(text) is
  'Junta as linhas de TL_VERSAO_FONTE de cada fonte (ou só de p_fonte) numa linha com a mesma soma (20261029150000). Devolve quantas fontes juntou.';

create or replace function private."FC_TG_VERSAO_FONTE"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  -- Uma linha por transação e tabela: a marca da transação fica numa configuração local.
  v_marca constant text := 'agsus_versao_fonte.t' || tg_relid::text;
  v_transacao constant text := pg_catalog.txid_current()::text;
  v_fonte constant text := tg_table_schema || '.' || tg_table_name;
begin
  if coalesce(pg_catalog.current_setting(v_marca, true), '') <> v_transacao then
    perform pg_catalog.set_config(v_marca, v_transacao, true);
    insert into private."TL_VERSAO_FONTE" ("NO_FONTE") values (v_fonte);
    if (select count(*) from private."TL_VERSAO_FONTE" v where v."NO_FONTE" = v_fonte) > 50 then
      perform private."FC_COMPACTAR_VERSAO_FONTE"(v_fonte);
    end if;
  end if;
  return null;
end;
$function$;

revoke all on function private."FC_TG_VERSAO_FONTE"() from public, anon, authenticated;
comment on function private."FC_TG_VERSAO_FONTE"() is
  'Gatilho por comando TG_VERSAO_FONTE (20261029150000): uma linha em TL_VERSAO_FONTE por transação que escreveu na tabela.';

-- 4. As fontes pelo código ------------------------------------------------------------------
create or replace function private."FC_FONTES_PELO_CODIGO"(p_funcoes text[])
returns setof text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_vistas_f text[] := '{}';
  v_vistas_r oid[] := '{}';
  v_fila_f text[] := coalesce(p_funcoes, '{}');
  v_fila_r oid[] := '{}';
  v_texto text;
begin
  -- Fecho por nome: toda função (de qualquer assinatura) e view de public/private citada
  -- no código, sem comentários, até as tabelas. Sobra tabela (citada num texto): só faz a
  -- marca mudar a mais; não falta nenhuma que o código leia por nome (não há SQL dinâmico
  -- nas leituras de hoje; conferido no ensaio).
  while cardinality(v_fila_f) > 0 or cardinality(v_fila_r) > 0 loop
    v_vistas_f := v_vistas_f || v_fila_f;
    v_vistas_r := v_vistas_r || v_fila_r;
    select coalesce(string_agg(p.prosrc, E'\n'), '') into v_texto
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.proname = any (v_fila_f);
    v_texto := v_texto || E'\n' || coalesce((
      select string_agg(pg_catalog.pg_get_viewdef(c.oid), E'\n')
        from pg_catalog.pg_class c
       where c.oid = any (v_fila_r) and c.relkind in ('v', 'm')), '');
    v_texto := regexp_replace(regexp_replace(v_texto, '/\*.*?\*/', ' ', 'g'), '--[^\n]*', ' ', 'g');
    select coalesce(array_agg(distinct p.proname::text), '{}') into v_fila_f
      from (select (regexp_matches(v_texto, '([A-Za-z_][A-Za-z0-9_]*)"?\s*\(', 'g'))[1] as t) x
      join pg_catalog.pg_proc p on p.proname = x.t
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname in ('public', 'private')
     where not (p.proname::text = any (v_vistas_f));
    select coalesce(array_agg(distinct c.oid), '{}') into v_fila_r
      from (select distinct (regexp_matches(v_texto, '[A-Za-z_][A-Za-z0-9_]*', 'g'))[1] as t) x
      join pg_catalog.pg_class c on c.relname = x.t and c.relkind in ('r', 'p', 'v', 'm')
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace and n.nspname in ('public', 'private')
     where not (c.oid = any (v_vistas_r));
  end loop;
  return query
    select n.nspname || '.' || c.relname
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where c.oid = any (v_vistas_r)
       and c.relkind in ('r', 'p')
       and c.relname not in ('TL_VERSAO_FONTE', 'TD_LEITURA_POR_MARCA', 'TD_FONTE_DA_LEITURA')
     order by 1;
end;
$function$;

revoke all on function private."FC_FONTES_PELO_CODIGO"(text[]) from public, anon, authenticated;
comment on function private."FC_FONTES_PELO_CODIGO"(text[]) is
  'As tabelas (esquema.TABELA) que as funções p_funcoes leem, pelo fecho do código das funções e views de public/private (20261029150000).';

create or replace function private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(p_gatilhos boolean default true)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_leitura record;
  v_fontes text[];
  v_tabela text;
  v_novos text[] := '{}';
  v_contagem jsonb := '{}';
begin
  for v_leitura in select * from private."TD_LEITURA_POR_MARCA" l order by l."NO_LEITURA" loop
    select coalesce(array_agg(distinct x.f order by x.f), '{}') into v_fontes
      from (select f from private."FC_FONTES_PELO_CODIGO"(v_leitura."DS_FUNCOES") f
            union
            select unnest(v_leitura."DS_FONTES_EXTRAS")) x(f);
    delete from private."TD_FONTE_DA_LEITURA" f
     where f."NO_LEITURA" = v_leitura."NO_LEITURA" and f."NO_FONTE" <> all (v_fontes);
    insert into private."TD_FONTE_DA_LEITURA" ("NO_LEITURA", "NO_FONTE")
    select v_leitura."NO_LEITURA", u.f from unnest(v_fontes) u(f)
    on conflict do nothing;
    v_contagem := v_contagem || jsonb_build_object(v_leitura."NO_LEITURA", cardinality(v_fontes));
  end loop;

  for v_tabela in select distinct f."NO_FONTE" from private."TD_FONTE_DA_LEITURA" f where p_gatilhos order by 1 loop
    if to_regclass(format('%I.%I', split_part(v_tabela, '.', 1), split_part(v_tabela, '.', 2))) is null then
      raise exception 'Fonte inexistente: %', v_tabela using errcode = '42P01';
    end if;
    if not exists (
      select 1 from pg_catalog.pg_trigger t
       where t.tgrelid = format('%I.%I', split_part(v_tabela, '.', 1), split_part(v_tabela, '.', 2))::regclass
         and t.tgname = 'TG_VERSAO_FONTE') then
      execute format(
        'create trigger "TG_VERSAO_FONTE" after insert or update or delete or truncate on %I.%I '
        'for each statement execute function private."FC_TG_VERSAO_FONTE"()',
        split_part(v_tabela, '.', 1), split_part(v_tabela, '.', 2));
      v_novos := v_novos || v_tabela;
    end if;
    -- Vale também com session_replication_role = replica (correções de dados).
    execute format('alter table %I.%I enable always trigger "TG_VERSAO_FONTE"',
                   split_part(v_tabela, '.', 1), split_part(v_tabela, '.', 2));
  end loop;

  return jsonb_build_object('leituras', v_contagem, 'gatilhos_novos', to_jsonb(v_novos));
end;
$function$;

revoke all on function private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean) from public, anon, authenticated, service_role;
comment on function private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean) is
  'Recalcula TD_FONTE_DA_LEITURA pelo código (FC_FONTES_PELO_CODIGO das funções de cada leitura, mais as extras) e, com p_gatilhos, põe o gatilho TG_VERSAO_FONTE (ENABLE ALWAYS) em toda fonte (20261029150000; o ensaio usa p_gatilhos = false para não travar as escritas nas chamadas pesadas). Rodar na migration que mudar uma função do fecho de uma leitura.';

-- 5. As marcas -------------------------------------------------------------------------------
create or replace function private."FC_MARCA_DA_LEITURA"(p_leitura text, p_chave text)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select 'm1:' || md5(concat_ws('|',
           p_leitura,
           coalesce(p_chave, ''),
           coalesce((select auth.uid())::text, ''),
           lower(coalesce((select auth.jwt()) ->> 'email', '')),
           coalesce((select auth.role()), ''),
           -- TRUNCATE ou tabela recriada: as somas recomeçam, a marca não repete.
           pg_catalog.pg_relation_filenode('private."TL_VERSAO_FONTE"'::regclass)::text,
           string_agg(f."NO_FONTE" || '=' || coalesce(v.qt, 0)::text, ',' order by f."NO_FONTE")))
    from private."TD_FONTE_DA_LEITURA" f
    left join lateral (
      select sum(x."QT_ALTERACAO") as qt
        from private."TL_VERSAO_FONTE" x
       where x."NO_FONTE" = f."NO_FONTE") v on true
   where f."NO_LEITURA" = p_leitura
  having count(*) > 0;
$function$;

revoke all on function private."FC_MARCA_DA_LEITURA"(text, text) from public, anon, authenticated;
comment on function private."FC_MARCA_DA_LEITURA"(text, text) is
  'Marca barata de uma leitura (20261029150000): md5 da leitura, da chave (parâmetros), de quem lê (auth.uid, e-mail, papel) e da versão de cada fonte (TL_VERSAO_FONTE). Nula se a leitura não tem fontes.';

create or replace function private."FC_MARCA_DA_RPC"(
  p_rpc text, p_area text default null, p_edital uuid default null,
  p_escopo text default null, p_modulo text default null)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
  v_escopo text;
  v_modulo text;
  v_pacote text;
begin
  -- A permissão de cada RPC é conferida aqui com os mesmos erros da função de sempre:
  -- a resposta `inalterado` não monta nada, mas também não sai para quem não pode ler.
  case p_rpc
  when 'get_analises_dashboard_payload_v2' then
    v_escopo := lower(btrim(coalesce(p_escopo, 'ativo')));
    v_area := lower(btrim(coalesce(p_area, 'saude-indigena')));
    if not private.pode_recurso('analises') then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    if v_escopo not in ('ativo', 'inativo', 'desativadas') then
      raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
    end if;
    perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
    -- Sem recorte e com pacote de menos de 24 h, a função entrega o pacote e a área.
    if private."FC_EDITAIS_VISIVEIS"() is null then
      select concat_ws('|', (extract(epoch from c."DT_GERACAO") * 1000000)::bigint, c."DS_VERSAO_DADOS")
        into v_pacote
        from private."TA_PAINEL_ANALISE" c
       where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_escopo
         and c."DT_GERACAO" > now() - interval '24 hours';
      if v_pacote is not null then
        return private."FC_MARCA_DA_LEITURA"('analises_pacote', concat_ws('|', v_area, v_escopo, v_pacote));
      end if;
    end if;
    return private."FC_MARCA_DA_LEITURA"('analises_painel', concat_ws('|', v_area, v_escopo));

  when 'get_entrevistas_da_area' then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private.pode_recurso('entrevistas', 1) then
      raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
    end if;
    if not private."FC_PODE_AREA"(p_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    -- Sem recorte e com pacote, a função entrega o pacote como está (DS_PAYLOAD é not null).
    if private."FC_EDITAIS_VISIVEIS"() is null then
      select concat_ws('|', (extract(epoch from c."DT_GERACAO") * 1000000)::bigint, c."DS_VERSAO_DADOS")
        into v_pacote
        from private."TA_PAINEL_ENTREVISTA" c
       where c."CO_AREA" = p_area;
      if v_pacote is not null then
        return private."FC_MARCA_DA_LEITURA"('entrevistas_pacote', concat_ws('|', p_area, v_pacote));
      end if;
    end if;
    return private."FC_MARCA_DA_LEITURA"('entrevistas_area', p_area);

  when 'get_selecao_da_area' then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private.pode_recurso('selecao', 1) then
      raise exception 'Sem permissão para Seleção' using errcode = '42501';
    end if;
    if not private."FC_PODE_AREA"(p_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    return private."FC_MARCA_DA_LEITURA"('selecao_area', p_area);

  when 'listar_acompanhamento_da_visao_geral' then
    v_area := lower(btrim(coalesce(p_area, '')));
    if not private.pode_recurso('dashboard') then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
      raise exception 'Sem permissão para esta área' using errcode = '42501';
    end if;
    return private."FC_MARCA_DA_LEITURA"('acompanhamento_visao_geral', v_area);

  when 'obter_regra_analise' then
    perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
    return private."FC_MARCA_DA_LEITURA"('regra_analise', p_edital::text);

  when 'obter_classificacao_do_edital' then
    perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 1);
    return private."FC_MARCA_DA_LEITURA"('classificacao_edital', p_edital::text);

  when 'listar_avisos_conferencia' then
    v_area := nullif(lower(btrim(coalesce(p_area, ''))), '');
    v_modulo := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
    if auth.uid() is null then
      raise exception 'Sessão necessária' using errcode = '42501';
    end if;
    if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
      raise exception 'Módulo inválido' using errcode = '22023';
    end if;
    return private."FC_MARCA_DA_LEITURA"('avisos_conferencia', concat_ws('|', coalesce(v_area, ''), coalesce(v_modulo, '')));

  else
    raise exception 'RPC sem marca: %', p_rpc using errcode = '22023';
  end case;
end;
$function$;

revoke all on function private."FC_MARCA_DA_RPC"(text, text, uuid, text, text) from public, anon;
grant execute on function private."FC_MARCA_DA_RPC"(text, text, uuid, text, text) to authenticated, service_role;
comment on function private."FC_MARCA_DA_RPC"(text, text, uuid, text, text) is
  'A marca da leitura de uma RPC por versão, depois de conferir a permissão dela com os mesmos erros (20261029150000). Análises e Entrevistas sem recorte com pacote pronto: marca da linha do pacote (DT_GERACAO, DS_VERSAO_DADOS) e das permissões.';

-- 6. Payload em colunas com a versão dada --------------------------------------------------
create or replace function private."FC_PAYLOAD_EM_COLUNAS"(
  p_payload jsonb, p_campo text, p_dicionario text[], p_versao text)
returns json
language sql
immutable
set search_path to ''
as $function$
  select json_object_agg(x.k, x.v)
    from (select e.key as k, e.value::json as v from jsonb_each(p_payload - p_campo) e
          union all
          select p_campo || '_em_colunas', private."FC_COLUNAS_JSON"(p_payload -> p_campo, p_dicionario)
          union all
          select 'versao', to_json(p_versao)) x
   where p_payload is not null;
$function$;

revoke all on function private."FC_PAYLOAD_EM_COLUNAS"(jsonb, text, text[], text) from public, anon;
grant execute on function private."FC_PAYLOAD_EM_COLUNAS"(jsonb, text, text[], text) to authenticated, service_role;
comment on function private."FC_PAYLOAD_EM_COLUNAS"(jsonb, text, text[], text) is
  'O payload com p_campo em colunas (<campo>_em_colunas, FC_COLUNAS_JSON) e versao = p_versao (20261029150000; o formato de FC_SE_MUDOU_EM_COLUNAS com a versão vinda da marca).';

-- Os avisos como a tela recebe: sem nulos e sem `exemplos` em aviso com casos (20261015000000).
create or replace function private."FC_AVISOS_PARA_A_TELA"(p_avisos jsonb)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select p_avisos || jsonb_build_object('avisos', coalesce((
           select jsonb_agg(
                    jsonb_strip_nulls(
                      case
                        when exists (
                          select 1
                            from public."TB_CASO_AVISO_CONFERENCIA" c
                           where c."CO_AVISO_CONFERENCIA" = (a.aviso ->> 'id')::uuid)
                          then a.aviso - 'exemplos'
                        else a.aviso
                      end)
                    order by a.ordem)
             from jsonb_array_elements(p_avisos -> 'avisos') with ordinality a(aviso, ordem)
         ), '[]'::jsonb));
$function$;

revoke all on function private."FC_AVISOS_PARA_A_TELA"(jsonb) from public, anon, authenticated;
comment on function private."FC_AVISOS_PARA_A_TELA"(jsonb) is
  'listar_avisos_conferencia como a tela recebe: sem chaves nulas e sem exemplos em aviso com casos (20261015000000; separada em 20261029150000).';

-- 7. As sete RPCs por versão -------------------------------------------------------------------
create or replace function public.get_analises_dashboard_payload_v2_se_mudou(
  p_scope text default 'ativo'::text, p_area text default null::text, p_versao text default null::text)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_marca constant text := private."FC_MARCA_DA_RPC"('get_analises_dashboard_payload_v2', p_area => p_area, p_escopo => p_scope);
begin
  if v_marca is null then
    return private."FC_SE_MUDOU"(public.get_analises_dashboard_payload_v2(p_scope, p_area)::jsonb, p_versao);
  end if;
  if p_versao = v_marca then
    return jsonb_build_object('inalterado', true, 'versao', v_marca);
  end if;
  return public.get_analises_dashboard_payload_v2(p_scope, p_area)::jsonb || jsonb_build_object('versao', v_marca);
end;
$function$;

create or replace function public.get_entrevistas_da_area_se_mudou(p_area text, p_versao text default null::text)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_marca constant text := private."FC_MARCA_DA_RPC"('get_entrevistas_da_area', p_area => p_area);
begin
  if v_marca is null then
    return private."FC_SE_MUDOU"(public.get_entrevistas_da_area(p_area)::jsonb, p_versao);
  end if;
  if p_versao = v_marca then
    return jsonb_build_object('inalterado', true, 'versao', v_marca);
  end if;
  return public.get_entrevistas_da_area(p_area)::jsonb || jsonb_build_object('versao', v_marca);
end;
$function$;

create or replace function public.get_selecao_da_area_se_mudou(p_area text, p_versao text default null::text)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_marca constant text := private."FC_MARCA_DA_RPC"('get_selecao_da_area', p_area => p_area);
begin
  if v_marca is null then
    return private."FC_SE_MUDOU"(public.get_selecao_da_area(p_area)::jsonb, p_versao);
  end if;
  if p_versao = v_marca then
    return jsonb_build_object('inalterado', true, 'versao', v_marca);
  end if;
  return public.get_selecao_da_area(p_area)::jsonb || jsonb_build_object('versao', v_marca);
end;
$function$;

create or replace function public.listar_acompanhamento_da_visao_geral_se_mudou(p_area text, p_versao text default null::text)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_marca constant text := private."FC_MARCA_DA_RPC"('listar_acompanhamento_da_visao_geral', p_area => p_area);
begin
  if v_marca is null then
    return private."FC_SE_MUDOU"(public.listar_acompanhamento_da_visao_geral(p_area), p_versao);
  end if;
  if p_versao = v_marca then
    return jsonb_build_object('inalterado', true, 'versao', v_marca);
  end if;
  return public.listar_acompanhamento_da_visao_geral(p_area) || jsonb_build_object('versao', v_marca);
end;
$function$;

create or replace function public.obter_regra_analise_se_mudou(p_edital uuid, p_versao text default null::text)
returns jsonb
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_marca constant text := private."FC_MARCA_DA_RPC"('obter_regra_analise', p_edital => p_edital);
begin
  if v_marca is null then
    return private."FC_SE_MUDOU"(public.obter_regra_analise(p_edital)::jsonb, p_versao);
  end if;
  if p_versao = v_marca then
    return jsonb_build_object('inalterado', true, 'versao', v_marca);
  end if;
  return public.obter_regra_analise(p_edital)::jsonb || jsonb_build_object('versao', v_marca);
end;
$function$;

create or replace function public.obter_classificacao_do_edital_se_mudou(p_edital uuid, p_versao text default null::text)
returns json
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_marca constant text := private."FC_MARCA_DA_RPC"('obter_classificacao_do_edital', p_edital => p_edital);
  v_dicionario constant text[] := array[
    'vaga', 'cargo', 'categoria', 'modalidade', 'pcd', 'status', 'etapa', 'quadro', 'hora_nascimento',
    'pontuacao_etnica'];
begin
  if v_marca is null then
    return private."FC_SE_MUDOU_EM_COLUNAS"(public.obter_classificacao_do_edital(p_edital)::jsonb, p_versao, 'candidatos', v_dicionario);
  end if;
  if p_versao = v_marca then
    return json_build_object('inalterado', true, 'versao', v_marca);
  end if;
  return private."FC_PAYLOAD_EM_COLUNAS"(public.obter_classificacao_do_edital(p_edital)::jsonb, 'candidatos', v_dicionario, v_marca);
end;
$function$;

create or replace function public.listar_avisos_conferencia_se_mudou(
  p_area text default null::text, p_modulo text default null::text, p_versao text default null::text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_marca constant text := private."FC_MARCA_DA_RPC"('listar_avisos_conferencia', p_area => p_area, p_modulo => p_modulo);
begin
  if v_marca is null then
    return private."FC_SE_MUDOU"(private."FC_AVISOS_PARA_A_TELA"(public.listar_avisos_conferencia(p_area, p_modulo)::jsonb), p_versao);
  end if;
  if p_versao = v_marca then
    return jsonb_build_object('inalterado', true, 'versao', v_marca);
  end if;
  return private."FC_AVISOS_PARA_A_TELA"(public.listar_avisos_conferencia(p_area, p_modulo)::jsonb)
         || jsonb_build_object('versao', v_marca);
end;
$function$;

comment on function public.get_analises_dashboard_payload_v2_se_mudou(text, text, text) is
  'get_analises_dashboard_payload_v2 com versão: a marca (FC_MARCA_DA_RPC; sem recorte, a do pacote pronto) sai antes de montar; p_versao igual devolve só { inalterado, versao } (20261029150000). Mesma permissão.';
comment on function public.get_entrevistas_da_area_se_mudou(text, text) is
  'get_entrevistas_da_area com versão: a marca (FC_MARCA_DA_RPC; sem recorte, a do pacote pronto) sai antes de montar; p_versao igual devolve só { inalterado, versao } (20261029150000). Mesma permissão.';
comment on function public.get_selecao_da_area_se_mudou(text, text) is
  'get_selecao_da_area com versão: a marca das fontes (FC_MARCA_DA_RPC) sai antes de montar; p_versao igual devolve só { inalterado, versao } (20261029150000). Mesma permissão.';
comment on function public.listar_acompanhamento_da_visao_geral_se_mudou(text, text) is
  'listar_acompanhamento_da_visao_geral com versão: a marca das fontes (FC_MARCA_DA_RPC) sai antes de montar; p_versao igual devolve só { inalterado, versao } (20261029150000). Mesma permissão.';
comment on function public.obter_regra_analise_se_mudou(uuid, text) is
  'obter_regra_analise com versão: a marca das fontes (FC_MARCA_DA_RPC) sai antes de montar; p_versao igual devolve só { inalterado, versao } (20261029150000). Mesma permissão.';
comment on function public.obter_classificacao_do_edital_se_mudou(uuid, text) is
  'obter_classificacao_do_edital com versão e os candidatos em colunas (candidatos_em_colunas): a marca das fontes (FC_MARCA_DA_RPC) sai antes de montar; p_versao igual devolve só { inalterado, versao } (20261029150000). Mesma permissão.';
comment on function public.listar_avisos_conferencia_se_mudou(text, text, text) is
  'listar_avisos_conferencia com versão, sem nulos e sem exemplos em aviso com casos (FC_AVISOS_PARA_A_TELA): a marca das fontes (FC_MARCA_DA_RPC) sai antes de montar; p_versao igual devolve só { inalterado, versao } (20261029150000).';

-- As permissões de sempre (create or replace mantém; repetidas para a migration valer sozinha).
revoke all on function public.get_analises_dashboard_payload_v2_se_mudou(text, text, text) from public, anon;
revoke all on function public.get_entrevistas_da_area_se_mudou(text, text) from public, anon;
revoke all on function public.get_selecao_da_area_se_mudou(text, text) from public, anon;
revoke all on function public.listar_acompanhamento_da_visao_geral_se_mudou(text, text) from public, anon;
revoke all on function public.obter_regra_analise_se_mudou(uuid, text) from public, anon;
revoke all on function public.obter_classificacao_do_edital_se_mudou(uuid, text) from public, anon;
revoke all on function public.listar_avisos_conferencia_se_mudou(text, text, text) from public, anon;
grant execute on function public.get_analises_dashboard_payload_v2_se_mudou(text, text, text) to authenticated, service_role;
grant execute on function public.get_entrevistas_da_area_se_mudou(text, text) to authenticated, service_role;
grant execute on function public.get_selecao_da_area_se_mudou(text, text) to authenticated, service_role;
grant execute on function public.listar_acompanhamento_da_visao_geral_se_mudou(text, text) to authenticated, service_role;
grant execute on function public.obter_regra_analise_se_mudou(uuid, text) to authenticated, service_role;
grant execute on function public.obter_classificacao_do_edital_se_mudou(uuid, text) to authenticated, service_role;
grant execute on function public.listar_avisos_conferencia_se_mudou(text, text, text) to authenticated;

-- 8. As leituras e as fontes --------------------------------------------------------------------
insert into private."TD_LEITURA_POR_MARCA" ("NO_LEITURA", "DS_FUNCOES", "DS_FONTES_EXTRAS", "DS_LEITURA") values
  ('analises_painel', array['get_analises_dashboard_payload_v2'], '{}',
   'Painel de análises montado na hora (recorte por coordenação, ou sem pacote de menos de 24 h).'),
  ('analises_pacote', array['pode_recurso', 'FC_GRUPOS_ANALISES_DA_AREA', 'FC_EDITAIS_VISIVEIS'], array['public.TB_AREA'],
   'Painel de análises pelo pacote pronto (TA_PAINEL_ANALISE): a chave leva a linha do pacote; as fontes são permissão e área.'),
  ('entrevistas_area', array['get_entrevistas_da_area'], '{}',
   'Entrevistas da área montadas na hora (recorte por coordenação, ou sem pacote).'),
  ('entrevistas_pacote', array['pode_recurso', 'FC_PODE_AREA', 'FC_EDITAIS_VISIVEIS'], array['public.TB_AREA'],
   'Entrevistas da área pelo pacote pronto (TA_PAINEL_ENTREVISTA): a chave leva a linha do pacote; as fontes são permissão e área.'),
  ('selecao_area', array['get_selecao_da_area'], '{}', 'Funil da Seleção por vaga da área.'),
  ('acompanhamento_visao_geral', array['listar_acompanhamento_da_visao_geral'], '{}',
   'Etapas e listas de aprovados dos editais da área (Visão geral).'),
  ('regra_analise', array['obter_regra_analise'], '{}', 'Regra da avaliação documental do edital.'),
  ('classificacao_edital', array['obter_classificacao_do_edital'], '{}', 'Classificação do edital.'),
  ('avisos_conferencia', array['listar_avisos_conferencia'], array['public.TB_CASO_AVISO_CONFERENCIA'],
   'Avisos das conferências (os casos decidem se o aviso leva exemplos).')
on conflict ("NO_LEITURA") do update set
  "DS_FUNCOES" = excluded."DS_FUNCOES",
  "DS_FONTES_EXTRAS" = excluded."DS_FONTES_EXTRAS",
  "DS_LEITURA" = excluded."DS_LEITURA";

select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

notify pgrst, 'reload schema';

commit;
