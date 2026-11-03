/*
  A MARCA DAS LEITURAS SÓ MUDA COM MUDANÇA DE VERDADE (03/11/2026)

  Auditoria só de leitura (03/11/2026) achou três desperdícios no banco:

  1. A MARCA BARATA (20261029170000) MUDAVA SEM NADA MUDAR
     O gatilho "TG_VERSAO_FONTE" era POR COMANDO e disparava mesmo quando o
     comando não mexia em linha nenhuma. public.registrar_presenca_monitora
     (batida de presença, ~90 s por pessoa) manda
       update "TB_PERFIL_USUARIO" set google_avatar_url = … where … is distinct from …
     que quase sempre toca 0 linhas — e mesmo assim somava uma versão em
     TB_PERFIL_USUARIO, fonte das 9 leituras. Resultado: qualquer pessoa online
     invalidava toda marca `*_se_mudou` de todo mundo (465 de ~1.000 marcas
     desde 29/10, com 16 mudanças reais).

     O QUE MUDA
       a) Um gatilho por evento, como os "TG_*_CACHE_INS/UPD/DEL"
          (20261007220000): "TG_VERSAO_FONTE_INS" (REFERENCING NEW TABLE),
          "TG_VERSAO_FONTE_UPD" (NEW TABLE), "TG_VERSAO_FONTE_DEL" (OLD TABLE) e
          "TG_VERSAO_FONTE_TRUNC". private."FC_TG_VERSAO_FONTE" só grava quando
          a tabela de transição tem linha; TRUNCATE conta sempre. Os quatro em
          ENABLE ALWAYS (valem com session_replication_role = replica, como
          antes). Continua uma linha por transação e tabela.
       b) Colunas que nenhuma leitura com marca usa ficam fora:
          private."TD_COLUNA_SEM_MARCA". Na tabela que tem coluna fora, o
          gatilho de UPDATE é "AFTER UPDATE OF <as outras colunas> FOR EACH
          ROW" (o Postgres não aceita tabela de transição com lista de
          colunas; por linha, comando de 0 linhas também não dispara). Hoje:
          TB_PERFIL_USUARIO sem google_avatar_url, avatar_source, avatar_url e
          avatar_config — o fecho do código das 9 leituras não cita nenhuma
          delas (conferido no banco em 03/11/2026 e a cada
          FC_ATUALIZAR_FONTES_DAS_LEITURAS, que recusa coluna fora citada no
          fecho de uma leitura da fonte).
       c) registrar_presenca_monitora só manda o UPDATE da foto quando ela
          mudou de fato.
     private."FC_ATUALIZAR_FONTES_DAS_LEITURAS" passa a pôr os quatro gatilhos
     (e a tirar o "TG_VERSAO_FONTE" antigo); a migration roda ela no fim.

  2. AS CARGAS REGRAVAVAM LINHAS IGUAIS
     sincronizar_selecao e sincronizar_entrevistas faziam upsert com update de
     TODA linha (TB_SELECAO_VAGA: 76.625 updates em 3.363 linhas;
     TB_ENTREVISTA: 92.252 em 4.616). Agora o ON CONFLICT só atualiza a linha
     cujos campos mudaram (where (…) is distinct from (excluded …)). Como a
     linha igual fica com o CO_SYNC antigo, as chaves vistas em cada carga vão
     para private."TL_CHAVE_DA_CARGA", e finalizar_sync_* desativa só quem não
     veio (CO_SYNC diferente E chave fora da carga); as chaves saem quando a
     carga fecha. TB_MONITORAMENTO_INDIGENA (3.047 updates em 154 linhas, com
     histórico a cada vez): FC_ATUALIZAR_KPIS_PELA_SELECAO gravava em
     "DT_FONTE_FUNIL" a ÚLTIMA CARGA CONCLUÍDA da Seleção, que muda a cada
     carga — e a guarda is distinct from deixava passar os ~130 editais da
     Seleção toda vez. Agora a data da fonte SELECAO é a última mudança nas
     vagas do edital (max "DT_ATUALIZACAO"), como já era nas outras fontes.
     Nenhuma carga é rodada nem religada aqui (a de entrevistas segue pausada).

  3. ORDENAÇÕES EM DISCO (work_mem de 2 MB)
     ALTER FUNCTION … SET work_mem = '16MB' em pendencias_ler_aprovados,
     obter_pre_classificacao, obter_pre_classificacao_se_mudou,
     paineis_gravar_pacote e get_analises_dashboard_payload_v2_se_mudou.
     get_analises_dashboard_payload_v2 já tem 64MB: fica (vale o maior).

  Assinaturas, retornos e permissões das RPCs iguais. Para aplicar, a
  migration confere que as funções que troca são as do banco de 03/11/2026
  (md5 do código sem \r), ou já as desta.

  Ensaio:   supabase/ensaios/20261103150000_marca_so_com_mudanca_real.sql
  Rollback: supabase/rollback/20261103150000_marca_so_com_mudanca_real.sql
  Teste:    tests/marca-so-com-mudanca-real-migration.test.js
*/
begin;

set local lock_timeout = '10s';

-- 0. As funções que esta migration troca são as que ela conhece (ou já as desta) ---------
do $guarda$
declare
  v_esperado constant jsonb := jsonb_build_object(
    'FC_TG_VERSAO_FONTE', 'c5091a900d3aee0dd1320de0f482c133',
    'FC_ATUALIZAR_FONTES_DAS_LEITURAS', '9bd23eb42a114c375bbe2c3bac759908',
    'registrar_presenca_monitora', 'e303afce3c72ea3801fb91ddb2978baa',
    'sincronizar_selecao', 'ba7b56fd25b5d0f0cb51a5a0453dea97',
    'finalizar_sync_selecao', '6374174bf0d9663b8caff1d794804bcd',
    'sincronizar_entrevistas', 'a888396151fa90f9817238ffca87d65e',
    'finalizar_sync_entrevistas', 'f54b8d450601ee12d138abbd30cb6a4f',
    'FC_ATUALIZAR_KPIS_PELA_SELECAO', 'dbe4b88989e709386a1cd86cfcfc0f74');
  v_diferentes text;
  v_faltam text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_diferentes
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname in ('public', 'private')
   where v_esperado ? p.proname
     and md5(replace(p.prosrc, E'\r', '')) <> v_esperado ->> p.proname::text
     and p.prosrc not like '%20261103150000%';
  if v_diferentes is not null then
    raise exception 'Função(ões) diferente(s) da que esta migration conhece: %. Refaça a migration sobre a versão do banco.', v_diferentes;
  end if;
  select string_agg(k, ', ' order by k) into v_faltam
    from jsonb_object_keys(v_esperado) k
   where not exists (select 1 from pg_catalog.pg_proc p
                       join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname in ('public', 'private')
                      where p.proname = k);
  if v_faltam is not null then
    raise exception 'Faltam funções: %. Aplique antes 20261029170000 e as migrations das cargas.', v_faltam;
  end if;
end;
$guarda$;

-- 1. Colunas fora da marca ---------------------------------------------------------------------
create table if not exists private."TD_COLUNA_SEM_MARCA" (
  "NO_FONTE" varchar(130) not null,
  "NO_COLUNA" varchar(63) not null,
  "DS_MOTIVO" text not null,
  constraint "PK_TD_COLUNA_SEM_MARCA" primary key ("NO_FONTE", "NO_COLUNA")
);
alter table private."TD_COLUNA_SEM_MARCA" enable row level security;
revoke all on table private."TD_COLUNA_SEM_MARCA" from public, anon, authenticated, service_role;
comment on table private."TD_COLUNA_SEM_MARCA" is
  'Colunas de uma fonte das leituras por versão que nenhuma leitura com marca usa (20261103150000): o UPDATE só delas não muda a marca (TG_VERSAO_FONTE_UPD vira UPDATE OF as outras colunas, por linha). FC_ATUALIZAR_FONTES_DAS_LEITURAS recusa coluna daqui citada no fecho do código de uma leitura da fonte.';
comment on column private."TD_COLUNA_SEM_MARCA"."NO_FONTE" is 'Tabela de origem, como esquema.TABELA (TD_FONTE_DA_LEITURA.NO_FONTE).';
comment on column private."TD_COLUNA_SEM_MARCA"."NO_COLUNA" is 'Coluna da fonte que não conta para a marca.';
comment on column private."TD_COLUNA_SEM_MARCA"."DS_MOTIVO" is 'Por que a coluna fica fora (quem grava e por que nenhuma leitura usa).';

insert into private."TD_COLUNA_SEM_MARCA" ("NO_FONTE", "NO_COLUNA", "DS_MOTIVO") values
  ('public.TB_PERFIL_USUARIO', 'google_avatar_url',
   'Foto do Google, regravada pela batida de presença (registrar_presenca_monitora); nenhuma leitura com marca usa.'),
  ('public.TB_PERFIL_USUARIO', 'avatar_source',
   'Avatar escolhido pela pessoa (Configurações); nenhuma leitura com marca usa.'),
  ('public.TB_PERFIL_USUARIO', 'avatar_url',
   'Avatar escolhido pela pessoa (Configurações); nenhuma leitura com marca usa.'),
  ('public.TB_PERFIL_USUARIO', 'avatar_config',
   'Avatar escolhido pela pessoa (Configurações); nenhuma leitura com marca usa.')
on conflict ("NO_FONTE", "NO_COLUNA") do update set "DS_MOTIVO" = excluded."DS_MOTIVO";

-- 2. O gatilho só conta quando alguma linha mudou --------------------------------------------
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
  if coalesce(pg_catalog.current_setting(v_marca, true), '') = v_transacao then
    return null;
  end if;
  -- Por comando (20261103150000): só conta se a tabela de transição tem linha — o
  -- comando de 0 linhas não muda a marca. TRUNCATE não tem tabela de transição: conta.
  -- Por linha (UPDATE OF as colunas da marca, TD_COLUNA_SEM_MARCA): já é linha mudada.
  if tg_level = 'STATEMENT' then
    if tg_op in ('INSERT', 'UPDATE') then
      if not exists (select 1 from novas) then
        return null;
      end if;
    elsif tg_op = 'DELETE' then
      if not exists (select 1 from antigas) then
        return null;
      end if;
    end if;
  end if;
  perform pg_catalog.set_config(v_marca, v_transacao, true);
  insert into private."TL_VERSAO_FONTE" ("NO_FONTE") values (v_fonte);
  if (select count(*) from private."TL_VERSAO_FONTE" v where v."NO_FONTE" = v_fonte) > 50 then
    perform private."FC_COMPACTAR_VERSAO_FONTE"(v_fonte);
  end if;
  return null;
end;
$function$;

revoke all on function private."FC_TG_VERSAO_FONTE"() from public, anon, authenticated;
comment on function private."FC_TG_VERSAO_FONTE"() is
  'Gatilhos TG_VERSAO_FONTE_INS/UPD/DEL/TRUNC (20261103150000; antes um só, 20261029170000): uma linha em TL_VERSAO_FONTE por transação que MUDOU alguma linha da tabela (tabela de transição com linha; UPDATE só de coluna de TD_COLUNA_SEM_MARCA não conta). TRUNCATE conta sempre.';

-- 3. O código lido por uma leitura (para conferir as colunas fora da marca) ------------------
create or replace function private."FC_CODIGO_DA_LEITURA"(p_funcoes text[])
returns text
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
  v_tudo text := '';
begin
  -- O mesmo fecho de private."FC_FONTES_PELO_CODIGO" (20261029170000), devolvendo o
  -- código (funções e views, sem comentários) em vez das tabelas.
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
    v_tudo := v_tudo || E'\n' || v_texto;
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
  return v_tudo;
end;
$function$;

revoke all on function private."FC_CODIGO_DA_LEITURA"(text[]) from public, anon, authenticated, service_role;
comment on function private."FC_CODIGO_DA_LEITURA"(text[]) is
  'O código (funções e views de public/private, sem comentários) do fecho de p_funcoes — o mesmo fecho de FC_FONTES_PELO_CODIGO (20261103150000). Usado para conferir que nenhuma leitura cita uma coluna de TD_COLUNA_SEM_MARCA.';

-- 4. Os quatro gatilhos em toda fonte ------------------------------------------------------------
create or replace function private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(p_gatilhos boolean default true)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_leitura record;
  v_fontes text[];
  v_tabela text;
  v_rel regclass;
  v_citadas text;
  v_atributos smallint[];
  v_colunas text;
  v_upd record;
  v_gatilho text;
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

    -- Coluna fora da marca citada no código da leitura: a marca deixaria de mudar
    -- quando ela muda. Recusa (tire a coluna de TD_COLUNA_SEM_MARCA).
    if exists (select 1 from private."TD_COLUNA_SEM_MARCA" c where c."NO_FONTE" = any (v_fontes)) then
      select string_agg(c."NO_FONTE" || '.' || c."NO_COLUNA", ', ' order by c."NO_FONTE", c."NO_COLUNA")
        into v_citadas
        from private."TD_COLUNA_SEM_MARCA" c
       cross join (select private."FC_CODIGO_DA_LEITURA"(v_leitura."DS_FUNCOES") as codigo) x
       where c."NO_FONTE" = any (v_fontes)
         and x.codigo ~ ('\m' || c."NO_COLUNA" || '\M');
      if v_citadas is not null then
        raise exception 'A leitura % cita coluna(s) fora da marca: %. Tire de private."TD_COLUNA_SEM_MARCA".',
          v_leitura."NO_LEITURA", v_citadas using errcode = '22023';
      end if;
    end if;
  end loop;

  if p_gatilhos then
    -- O gatilho antigo (um só, por comando, sem tabela de transição: contava comando de 0 linhas).
    for v_rel in select t.tgrelid::regclass from pg_catalog.pg_trigger t where t.tgname = 'TG_VERSAO_FONTE' loop
      execute format('drop trigger "TG_VERSAO_FONTE" on %s', v_rel);
    end loop;
  end if;

  for v_tabela in select distinct f."NO_FONTE" from private."TD_FONTE_DA_LEITURA" f where p_gatilhos order by 1 loop
    v_rel := to_regclass(format('%I.%I', split_part(v_tabela, '.', 1), split_part(v_tabela, '.', 2)));
    if v_rel is null then
      raise exception 'Fonte inexistente: %', v_tabela using errcode = '42P01';
    end if;

    -- Com coluna fora da marca: UPDATE OF as outras colunas, por linha. Sem: por comando.
    v_atributos := null;
    v_colunas := null;
    if exists (select 1 from private."TD_COLUNA_SEM_MARCA" c
                 join pg_catalog.pg_attribute a
                   on a.attrelid = v_rel and a.attname = c."NO_COLUNA" and a.attnum > 0 and not a.attisdropped
                where c."NO_FONTE" = v_tabela) then
      select array_agg(a.attnum order by a.attnum),
             string_agg(format('%I', a.attname), ', ' order by a.attnum)
        into v_atributos, v_colunas
        from pg_catalog.pg_attribute a
       where a.attrelid = v_rel and a.attnum > 0 and not a.attisdropped
         and not exists (select 1 from private."TD_COLUNA_SEM_MARCA" c
                          where c."NO_FONTE" = v_tabela and c."NO_COLUNA" = a.attname);
    end if;

    -- O gatilho de UPDATE que não é o que devia ser (a lista de colunas mudou) sai e volta.
    select (t.tgtype & 1) = 1 as por_linha,
           array(select x from unnest(t.tgattr::smallint[]) x order by x) as atributos
      into v_upd
      from pg_catalog.pg_trigger t
     where t.tgrelid = v_rel and t.tgname = 'TG_VERSAO_FONTE_UPD';
    if found and (case when v_atributos is null then v_upd.por_linha or cardinality(v_upd.atributos) > 0
                       else not v_upd.por_linha or v_upd.atributos is distinct from v_atributos end) then
      execute format('drop trigger "TG_VERSAO_FONTE_UPD" on %s', v_rel);
    end if;

    foreach v_gatilho in array array['TG_VERSAO_FONTE_INS', 'TG_VERSAO_FONTE_UPD', 'TG_VERSAO_FONTE_DEL', 'TG_VERSAO_FONTE_TRUNC'] loop
      if not exists (select 1 from pg_catalog.pg_trigger t where t.tgrelid = v_rel and t.tgname = v_gatilho) then
        execute format('create trigger %I after %s on %s %s execute function private."FC_TG_VERSAO_FONTE"()',
          v_gatilho,
          case v_gatilho
            when 'TG_VERSAO_FONTE_INS' then 'insert'
            when 'TG_VERSAO_FONTE_DEL' then 'delete'
            when 'TG_VERSAO_FONTE_TRUNC' then 'truncate'
            else case when v_atributos is null then 'update' else 'update of ' || v_colunas end
          end,
          v_rel,
          case v_gatilho
            when 'TG_VERSAO_FONTE_INS' then 'referencing new table as novas for each statement'
            when 'TG_VERSAO_FONTE_DEL' then 'referencing old table as antigas for each statement'
            when 'TG_VERSAO_FONTE_TRUNC' then 'for each statement'
            else case when v_atributos is null then 'referencing new table as novas for each statement'
                      else 'for each row' end
          end);
        if not (v_tabela = any (v_novos)) then
          v_novos := v_novos || v_tabela;
        end if;
      end if;
      -- Vale também com session_replication_role = replica (correções de dados).
      if exists (select 1 from pg_catalog.pg_trigger t
                  where t.tgrelid = v_rel and t.tgname = v_gatilho and t.tgenabled <> 'A') then
        execute format('alter table %s enable always trigger %I', v_rel, v_gatilho);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('leituras', v_contagem, 'gatilhos_novos', to_jsonb(v_novos));
end;
$function$;

revoke all on function private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean) from public, anon, authenticated, service_role;
comment on function private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean) is
  'Recalcula TD_FONTE_DA_LEITURA pelo código (FC_FONTES_PELO_CODIGO das funções de cada leitura, mais as extras), recusa coluna de TD_COLUNA_SEM_MARCA citada no código de uma leitura e, com p_gatilhos, põe em toda fonte os gatilhos TG_VERSAO_FONTE_INS/UPD/DEL/TRUNC (ENABLE ALWAYS; o UPD é UPDATE OF as colunas da marca, por linha, quando a fonte tem coluna fora) e tira o TG_VERSAO_FONTE antigo (20261029170000; gatilhos por evento em 20261103150000). Rodar na migration que mudar uma função do fecho de uma leitura.';

-- 5. A presença só grava a foto quando ela mudou ----------------------------------------------
create or replace function public.registrar_presenca_monitora(p_current_view text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_foto text;
begin
  if v_user_id is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and (
        p.user_id = v_user_id
        or lower(p.email) = lower(v_email)
      )
  ) then
    raise exception 'Perfil institucional nao localizado.' using errcode = 'P0002';
  end if;

  insert into public."TB_PRESENCA_ONLINE_MONITORA" (user_id, current_view, seen_at)
  values (v_user_id, left(nullif(trim(p_current_view), ''), 120), timezone('utc', now()))
  on conflict (user_id) do update
    set current_view = excluded.current_view,
        seen_at = excluded.seen_at;

  select private."FC_FOTO_DO_GOOGLE"(u.raw_user_meta_data)
    into v_foto
    from auth.users u
   where u.id = v_user_id;
  -- Só manda o UPDATE quando a foto mudou de fato (20261103150000): a batida
  -- de presença (~90 s por pessoa) não grava nada no perfil quando é a mesma.
  if v_foto is not null
     and exists (select 1 from public."TB_PERFIL_USUARIO" p
                  where p.user_id = v_user_id
                    and p.google_avatar_url is distinct from v_foto) then
    update public."TB_PERFIL_USUARIO" p
       set google_avatar_url = v_foto
     where p.user_id = v_user_id
       and p.google_avatar_url is distinct from v_foto;
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'versao_do_catalogo', private."FC_VERSAO_DO_CATALOGO_DE_ABAS"()
  );
end;
$function$;

-- 6. As chaves vistas em cada carga (a linha igual não é regravada) -----------------------------
create table if not exists private."TL_CHAVE_DA_CARGA" (
  "TP_CARGA" varchar(20) not null,
  "CO_SYNC" text not null,
  "DS_CHAVE_ORIGEM" text not null,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TL_CHAVE_DA_CARGA" primary key ("TP_CARGA", "CO_SYNC", "DS_CHAVE_ORIGEM"),
  constraint "CK_TLCHAVECARGA_TPCARGA" check ("TP_CARGA" in ('SELECAO', 'ENTREVISTA'))
);
alter table private."TL_CHAVE_DA_CARGA" enable row level security;
revoke all on table private."TL_CHAVE_DA_CARGA" from public, anon, authenticated, service_role;
comment on table private."TL_CHAVE_DA_CARGA" is
  'Chaves (DS_CHAVE_ORIGEM) que vieram em cada carga aberta da Seleção e das Entrevistas (20261103150000). sincronizar_* grava; finalizar_sync_* desativa só a linha que não veio e apaga as chaves das cargas que não estão mais EM_ANDAMENTO. Existe porque a linha que veio igual não é mais regravada (fica com o CO_SYNC antigo).';
comment on column private."TL_CHAVE_DA_CARGA"."TP_CARGA" is 'SELECAO (TL_SYNC_SELECAO / TB_SELECAO_VAGA) ou ENTREVISTA (TL_SYNC_ENTREVISTA / TB_ENTREVISTA).';
comment on column private."TL_CHAVE_DA_CARGA"."CO_SYNC" is 'A carga (CO_SYNC de TL_SYNC_SELECAO ou TL_SYNC_ENTREVISTA).';
comment on column private."TL_CHAVE_DA_CARGA"."DS_CHAVE_ORIGEM" is 'A chave da linha da planilha (DS_CHAVE_ORIGEM da tabela da carga).';
comment on column private."TL_CHAVE_DA_CARGA"."DT_REGISTRO" is 'Quando a chave foi gravada.';

-- 7. As cargas só atualizam a linha que mudou --------------------------------------------------
create or replace function public.sincronizar_selecao(p_sync text, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qt integer;
begin
  if p_sync is null or p_sync !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de carga inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  insert into public."TL_SYNC_SELECAO" ("CO_SYNC") values (p_sync) on conflict ("CO_SYNC") do nothing;
  if exists (select 1 from public."TL_SYNC_SELECAO" s
              where s."CO_SYNC" = p_sync and s."TP_SITUACAO" <> 'EM_ANDAMENTO') then
    raise exception 'Carga % já fechada', p_sync using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.tmp_selecao_lote (
    chave text, edital text, vaga text, co_vaga text, unidade text, cargo text,
    inscritos integer, aptos integer, cancelados integer, reprovados_questionario integer,
    eliminados_nota integer, reprovados_analise integer, triados integer,
    total_eliminados integer, convocados integer, observacao text
  ) on commit drop;
  truncate pg_temp.tmp_selecao_lote;

  -- Números: o script já manda inteiros; aqui só se aceita inteiro (ou nulo).
  insert into pg_temp.tmp_selecao_lote
  select distinct on (x.chave) x.*
    from (
      select
        coalesce(private."FC_NUMERO_EDITAL"(l.edital), private."FC_TEXTO_BUSCA_RECURSO"(l.edital)) || '|' ||
          case when btrim(l.vaga) ~ '^[0-9]{1,20}$' then btrim(l.vaga)
               else 'cargo:' || private."FC_TEXTO_BUSCA_RECURSO"(l.vaga) end ||
          -- Vaga de mesmo nome e números diferentes (outras bancas): 2ª, 3ª…
          case when l.repeticao ~ '^[0-9]{1,3}$' and l.repeticao::integer > 1 then '#' || l.repeticao else '' end as chave,
        btrim(l.edital) as edital,
        btrim(l.vaga) as vaga,
        case when btrim(l.vaga) ~ '^[0-9]{1,20}$' then btrim(l.vaga) end as co_vaga,
        nullif(btrim(l.unidade), '') as unidade,
        coalesce(nullif(btrim(l.cargo), ''), btrim(l.vaga)) as cargo,
        case when l.inscritos ~ '^-?[0-9]{1,9}$' then l.inscritos::integer end,
        case when l.aptos ~ '^-?[0-9]{1,9}$' then l.aptos::integer end,
        case when l.cancelados ~ '^-?[0-9]{1,9}$' then l.cancelados::integer end,
        case when l.reprovados_questionario ~ '^-?[0-9]{1,9}$' then l.reprovados_questionario::integer end,
        case when l.eliminados_nota ~ '^-?[0-9]{1,9}$' then l.eliminados_nota::integer end,
        case when l.reprovados_analise ~ '^-?[0-9]{1,9}$' then l.reprovados_analise::integer end,
        case when l.triados ~ '^-?[0-9]{1,9}$' then l.triados::integer end,
        case when l.total_eliminados ~ '^-?[0-9]{1,9}$' then l.total_eliminados::integer end,
        case when l.convocados ~ '^-?[0-9]{1,9}$' then l.convocados::integer end,
        nullif(btrim(l.observacao), '') as observacao
      from jsonb_to_recordset(p_linhas) as l(
        edital text, vaga text, unidade text, cargo text, inscritos text, aptos text,
        cancelados text, reprovados_questionario text, eliminados_nota text,
        reprovados_analise text, triados text, total_eliminados text, convocados text,
        observacao text, repeticao text)
      where btrim(coalesce(l.edital, '')) <> '' and btrim(coalesce(l.vaga, '')) <> ''
    ) x
   order by x.chave;

  insert into public."TB_SELECAO_VAGA" as s (
    "CO_AREA", "DS_EDITAL", "CO_VAGA", "DS_VAGA_PLANILHA", "NO_UNIDADE", "NO_CARGO",
    "QT_INSCRITO", "QT_APTO_ANALISE", "QT_CANCELADO", "QT_REPROVADO_QUESTIONARIO",
    "QT_ELIMINADO_NOTA", "QT_REPROVADO_ANALISE", "QT_TRIADO", "QT_TOTAL_ELIMINADO",
    "QT_CONVOCADO_PLANILHA", "DS_OBSERVACAO", "DS_CHAVE_ORIGEM", "CO_SYNC", "ST_REGISTRO_ATIVO")
  select
    -- Área provisória pela unidade; finalizar_sync_selecao acerta pelo edital.
    coalesce((select u."CO_AREA" from public."TA_UNIDADE_AREA" u
               where private."FC_TEXTO_BUSCA_RECURSO"(u."NO_UNIDADE") = private."FC_TEXTO_BUSCA_RECURSO"(t.unidade)
               limit 1), 'saude-indigena'),
    left(t.edital, 120), t.co_vaga, left(t.vaga, 400), left(t.unidade, 200), left(t.cargo, 400),
    t.inscritos, t.aptos, t.cancelados, t.reprovados_questionario, t.eliminados_nota,
    t.reprovados_analise, t.triados, t.total_eliminados, t.convocados, left(t.observacao, 1000),
    t.chave, p_sync, 'S'
    from pg_temp.tmp_selecao_lote t
  on conflict ("DS_CHAVE_ORIGEM") do update set
    "DS_EDITAL" = excluded."DS_EDITAL",
    "DS_VAGA_PLANILHA" = excluded."DS_VAGA_PLANILHA",
    "NO_UNIDADE" = excluded."NO_UNIDADE",
    "NO_CARGO" = excluded."NO_CARGO",
    "QT_INSCRITO" = excluded."QT_INSCRITO",
    "QT_APTO_ANALISE" = excluded."QT_APTO_ANALISE",
    "QT_CANCELADO" = excluded."QT_CANCELADO",
    "QT_REPROVADO_QUESTIONARIO" = excluded."QT_REPROVADO_QUESTIONARIO",
    "QT_ELIMINADO_NOTA" = excluded."QT_ELIMINADO_NOTA",
    "QT_REPROVADO_ANALISE" = excluded."QT_REPROVADO_ANALISE",
    "QT_TRIADO" = excluded."QT_TRIADO",
    "QT_TOTAL_ELIMINADO" = excluded."QT_TOTAL_ELIMINADO",
    "QT_CONVOCADO_PLANILHA" = excluded."QT_CONVOCADO_PLANILHA",
    "DS_OBSERVACAO" = excluded."DS_OBSERVACAO",
    "CO_SYNC" = excluded."CO_SYNC",
    "ST_REGISTRO_ATIVO" = 'S',
    "DT_ATUALIZACAO" = now()
  -- Só a vaga que mudou (20261103150000): a carga regravava todas a cada rodada
  -- (76 mil updates em 3,4 mil linhas). A linha igual fica com o CO_SYNC antigo;
  -- quem diz que ela veio nesta carga é private."TL_CHAVE_DA_CARGA" (abaixo).
  where (s."DS_EDITAL", s."DS_VAGA_PLANILHA", s."NO_UNIDADE", s."NO_CARGO",
         s."QT_INSCRITO", s."QT_APTO_ANALISE", s."QT_CANCELADO", s."QT_REPROVADO_QUESTIONARIO",
         s."QT_ELIMINADO_NOTA", s."QT_REPROVADO_ANALISE", s."QT_TRIADO", s."QT_TOTAL_ELIMINADO",
         s."QT_CONVOCADO_PLANILHA", s."DS_OBSERVACAO", s."ST_REGISTRO_ATIVO")
        is distinct from
        (excluded."DS_EDITAL", excluded."DS_VAGA_PLANILHA", excluded."NO_UNIDADE", excluded."NO_CARGO",
         excluded."QT_INSCRITO", excluded."QT_APTO_ANALISE", excluded."QT_CANCELADO", excluded."QT_REPROVADO_QUESTIONARIO",
         excluded."QT_ELIMINADO_NOTA", excluded."QT_REPROVADO_ANALISE", excluded."QT_TRIADO", excluded."QT_TOTAL_ELIMINADO",
         excluded."QT_CONVOCADO_PLANILHA", excluded."DS_OBSERVACAO", 'S');

  -- As chaves vistas nesta carga: finalizar_sync_selecao desativa só quem não veio.
  insert into private."TL_CHAVE_DA_CARGA" ("TP_CARGA", "CO_SYNC", "DS_CHAVE_ORIGEM")
  select 'SELECAO', p_sync, t.chave from pg_temp.tmp_selecao_lote t
  on conflict do nothing;

  select count(*) into v_qt from pg_temp.tmp_selecao_lote;
  update public."TL_SYNC_SELECAO" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt);
end;
$function$;

create or replace function public.finalizar_sync_selecao(p_sync text, p_forcar boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sync public."TL_SYNC_SELECAO";
  v_ativas integer;
  v_desativadas integer;
  v_sem_edital integer;
  v_kpis integer;
begin
  select * into v_sync from public."TL_SYNC_SELECAO" s where s."CO_SYNC" = p_sync for update;
  if v_sync."CO_SYNC" is null or v_sync."TP_SITUACAO" <> 'EM_ANDAMENTO' then
    raise exception 'Carga % não encontrada ou já fechada', p_sync using errcode = '22023';
  end if;

  select count(*) into v_ativas from public."TB_SELECAO_VAGA" s where s."ST_REGISTRO_ATIVO" = 'S';
  if not coalesce(p_forcar, false) and v_ativas > 0 and v_sync."QT_LINHA" * 2 < v_ativas then
    update public."TL_SYNC_SELECAO" set "TP_SITUACAO" = 'RECUSADA', "DT_FIM" = now(),
      "DS_MENSAGEM" = format('Carga com %s linhas e %s ativas no banco: menos da metade. Nada foi desativado; confira a planilha ou rode com forçar.', v_sync."QT_LINHA", v_ativas)
     where "CO_SYNC" = p_sync;
    delete from private."TL_CHAVE_DA_CARGA" k
     where k."TP_CARGA" = 'SELECAO'
       and not exists (select 1 from public."TL_SYNC_SELECAO" t
                        where t."CO_SYNC" = k."CO_SYNC" and t."TP_SITUACAO" = 'EM_ANDAMENTO');
    return jsonb_build_object('situacao', 'RECUSADA', 'linhas', v_sync."QT_LINHA", 'ativas', v_ativas);
  end if;

  -- Sai quem não veio nesta carga (20261103150000): a linha que veio igual não é
  -- regravada (fica com o CO_SYNC antigo); a chave dela está em TL_CHAVE_DA_CARGA.
  update public."TB_SELECAO_VAGA" s set "ST_REGISTRO_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
   where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_SYNC" is distinct from p_sync
     and not exists (select 1 from private."TL_CHAVE_DA_CARGA" k
                      where k."TP_CARGA" = 'SELECAO' and k."CO_SYNC" = p_sync
                        and k."DS_CHAVE_ORIGEM" = s."DS_CHAVE_ORIGEM");
  get diagnostics v_desativadas = row_count;

  perform private."FC_LIGAR_SELECAO_AOS_EDITAIS"();

  select count(*) filter (where s."CO_MONITORAMENTO" is null) into v_sem_edital
    from public."TB_SELECAO_VAGA" s where s."ST_REGISTRO_ATIVO" = 'S';

  -- Os KPIs da Visão geral já com a carga nova (o mesmo lock do pg_cron).
  if pg_try_advisory_xact_lock(hashtext('agsus_kpis_do_edital_pela_selecao')) then
    v_kpis := private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();
  end if;

  update public."TL_SYNC_SELECAO" set
    "TP_SITUACAO" = 'CONCLUIDA', "DT_FIM" = now(),
    "QT_SEM_EDITAL" = v_sem_edital, "QT_DESATIVADA" = v_desativadas,
    "DS_MENSAGEM" = case when coalesce(p_forcar, false) then 'Fechada com forçar.' end
   where "CO_SYNC" = p_sync;

  -- As chaves só valem enquanto a carga está aberta.
  delete from private."TL_CHAVE_DA_CARGA" k
   where k."TP_CARGA" = 'SELECAO'
     and not exists (select 1 from public."TL_SYNC_SELECAO" t
                      where t."CO_SYNC" = k."CO_SYNC" and t."TP_SITUACAO" = 'EM_ANDAMENTO');

  return jsonb_build_object('situacao', 'CONCLUIDA', 'linhas', v_sync."QT_LINHA",
    'sem_edital', v_sem_edital, 'desativadas', v_desativadas, 'kpis', v_kpis);
end;
$function$;

create or replace function public.sincronizar_entrevistas(p_sync text, p_area text, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qt integer;
begin
  if p_sync is null or p_sync !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de carga inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  insert into public."TL_SYNC_ENTREVISTA" ("CO_SYNC", "CO_AREA")
  values (p_sync, p_area)
  on conflict ("CO_SYNC") do nothing;
  if exists (select 1 from public."TL_SYNC_ENTREVISTA" s
              where s."CO_SYNC" = p_sync and (s."CO_AREA" <> p_area or s."TP_SITUACAO" <> 'EM_ANDAMENTO')) then
    raise exception 'Carga % já fechada ou de outra área', p_sync using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.tmp_entrevista_lote (
    chave text, unidade text, edital text, vaga text, candidato text, codigo text,
    modalidade text, cargo text, nota numeric, parecer text, compareceu text,
    link text, notas jsonb
  ) on commit drop;
  truncate pg_temp.tmp_entrevista_lote;

  insert into pg_temp.tmp_entrevista_lote
  select distinct on (x.chave) x.*
    from (
      select
        p_area || '|' || coalesce(private."FC_NUMERO_EDITAL"(l.edital), lower(l.edital)) || '|' || l.vaga || '|' ||
          coalesce(nullif(l.codigo, ''), 'nome:' || private."FC_TEXTO_BUSCA_RECURSO"(l.candidato)) as chave,
        l.unidade, l.edital, l.vaga, l.candidato, nullif(l.codigo, '') as codigo,
        nullif(array_to_string(array(
          select btrim(t) from unnest(string_to_array(replace(coalesce(l.modalidade, ''), '"', ''), ',')) t
           where btrim(t) <> ''), ' / '), '') as modalidade,
        nullif(l.cargo, '') as cargo,
        case when l.nota ~ '^-?\d+([.,]\d+)?$' then replace(l.nota, ',', '.')::numeric end as nota,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ '(inapto|reprovad|nao apto)' then 'INAPTO'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ 'apto' then 'APTO'
          else 'SEM_PARECER' end as parecer,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(nao|n|ausente|faltou)' then 'N'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(sim|s|compareceu|presente)' then 'S'
          end as compareceu,
        nullif(l.link, '') as link,
        coalesce(l.notas, '[]'::jsonb) as notas
      from jsonb_to_recordset(p_linhas) as l(
        unidade text, edital text, vaga text, candidato text, codigo text, modalidade text,
        cargo text, nota text, parecer text, compareceu text, link text, notas jsonb)
      where btrim(coalesce(l.candidato, '')) <> ''
        and btrim(coalesce(l.vaga, '')) <> ''
        and btrim(coalesce(l.edital, '')) <> ''
    ) x
   order by x.chave;

  insert into public."TB_ENTREVISTA" as e (
    "CO_AREA", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO",
    "DS_MODALIDADE", "NO_CARGO", "VL_NOTA_TOTAL", "TP_PARECER", "ST_COMPARECEU",
    "DS_LINK_PLANILHA", "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_SYNC", "ST_ATIVO")
  select p_area, left(coalesce(t.unidade, ''), 200), left(t.edital, 120), left(t.vaga, 60),
         left(t.candidato, 200), left(t.codigo, 60), left(t.modalidade, 300), left(t.cargo, 400),
         t.nota, t.parecer, t.compareceu, left(t.link, 500), 'planilha', t.chave, p_sync, 'S'
    from pg_temp.tmp_entrevista_lote t
  on conflict ("DS_CHAVE_ORIGEM") do update set
    "NO_UNIDADE" = excluded."NO_UNIDADE",
    "DS_EDITAL" = excluded."DS_EDITAL",
    "NO_CANDIDATO" = excluded."NO_CANDIDATO",
    "CO_CANDIDATO" = excluded."CO_CANDIDATO",
    "DS_MODALIDADE" = excluded."DS_MODALIDADE",
    "NO_CARGO" = excluded."NO_CARGO",
    "VL_NOTA_TOTAL" = excluded."VL_NOTA_TOTAL",
    "TP_PARECER" = excluded."TP_PARECER",
    "ST_COMPARECEU" = excluded."ST_COMPARECEU",
    "DS_LINK_PLANILHA" = excluded."DS_LINK_PLANILHA",
    "CO_SYNC" = excluded."CO_SYNC",
    "ST_ATIVO" = 'S',
    "DT_ATUALIZACAO" = now()
  where e."TP_ORIGEM" = 'planilha'
    -- Só a entrevista que mudou (20261103150000): a carga regravava todas a cada
    -- rodada (92 mil updates em 4,6 mil linhas). A linha igual fica com o CO_SYNC
    -- antigo; quem diz que ela veio nesta carga é private."TL_CHAVE_DA_CARGA".
    and (e."NO_UNIDADE", e."DS_EDITAL", e."NO_CANDIDATO", e."CO_CANDIDATO", e."DS_MODALIDADE",
         e."NO_CARGO", e."VL_NOTA_TOTAL", e."TP_PARECER", e."ST_COMPARECEU", e."DS_LINK_PLANILHA",
         e."ST_ATIVO")
        is distinct from
        (excluded."NO_UNIDADE", excluded."DS_EDITAL", excluded."NO_CANDIDATO", excluded."CO_CANDIDATO",
         excluded."DS_MODALIDADE", excluded."NO_CARGO", excluded."VL_NOTA_TOTAL", excluded."TP_PARECER",
         excluded."ST_COMPARECEU", excluded."DS_LINK_PLANILHA", 'S');

  -- As chaves vistas nesta carga: finalizar_sync_entrevistas desativa só quem não veio.
  insert into private."TL_CHAVE_DA_CARGA" ("TP_CARGA", "CO_SYNC", "DS_CHAVE_ORIGEM")
  select 'ENTREVISTA', p_sync, t.chave from pg_temp.tmp_entrevista_lote t
  on conflict do nothing;

  -- Notas: upsert por ordem; ordem que sumiu fica com nota nula (nada é apagado).
  with n as (
    select e."CO_ENTREVISTA", (c.ord)::smallint as ordem,
           left(private."FC_CRITERIO_ENTREVISTA"(c.item->>'criterio'), 600) as criterio,
           case when (c.item->>'nota') ~ '^-?\d+([.,]\d+)?$' then replace(c.item->>'nota', ',', '.')::numeric end as nota
      from pg_temp.tmp_entrevista_lote t
      join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
      cross join lateral jsonb_array_elements(t.notas) with ordinality c(item, ord)
     where c.ord between 1 and 20 and btrim(coalesce(c.item->>'criterio', '')) <> ''
  )
  insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
  select "CO_ENTREVISTA", ordem, criterio, nota from n
  on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set
    "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA"
  -- Só a nota que mudou (20261009110000): a carga de hora em hora regravava todas
  -- (~100 mil linhas/dia, ~45 MB/dia de WAL que o Realtime decodifica).
  where ("TB_ENTREVISTA_NOTA"."DS_CRITERIO", "TB_ENTREVISTA_NOTA"."VL_NOTA")
        is distinct from (excluded."DS_CRITERIO", excluded."VL_NOTA");

  update public."TB_ENTREVISTA_NOTA" en set "VL_NOTA" = null
    from pg_temp.tmp_entrevista_lote t
    join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
   where en."CO_ENTREVISTA" = e."CO_ENTREVISTA"
     and en."NU_ORDEM" > (select count(*) from jsonb_array_elements(t.notas) x
                           where btrim(coalesce(x->>'criterio', '')) <> '')
     and en."VL_NOTA" is not null;

  select count(*) into v_qt from pg_temp.tmp_entrevista_lote;
  update public."TL_SYNC_ENTREVISTA" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt);
end;
$function$;

create or replace function public.finalizar_sync_entrevistas(p_sync text, p_area text, p_forcar boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '30s'
AS $function$
declare
  v_sync public."TL_SYNC_ENTREVISTA";
  v_ativas integer;
  v_desativadas integer;
  v_repetidas integer;
  v_ligadas integer;
  v_sem_analise integer;
  v_sem_edital integer;
begin
  select * into v_sync from public."TL_SYNC_ENTREVISTA" s where s."CO_SYNC" = p_sync for update;
  if v_sync."CO_SYNC" is null or v_sync."CO_AREA" <> p_area or v_sync."TP_SITUACAO" <> 'EM_ANDAMENTO' then
    raise exception 'Carga % não encontrada, de outra área ou já fechada', p_sync using errcode = '22023';
  end if;

  select count(*) into v_ativas from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S';
  if not coalesce(p_forcar, false) and v_ativas > 0 and v_sync."QT_LINHA" * 2 < v_ativas then
    update public."TL_SYNC_ENTREVISTA" set "TP_SITUACAO" = 'RECUSADA', "DT_FIM" = now(),
      "DS_MENSAGEM" = format('Carga com %s linhas e %s ativas no banco: menos da metade. Nada foi desativado; confira a planilha ou rode com forçar.', v_sync."QT_LINHA", v_ativas)
     where "CO_SYNC" = p_sync;
    delete from private."TL_CHAVE_DA_CARGA" k
     where k."TP_CARGA" = 'ENTREVISTA'
       and not exists (select 1 from public."TL_SYNC_ENTREVISTA" t
                        where t."CO_SYNC" = k."CO_SYNC" and t."TP_SITUACAO" = 'EM_ANDAMENTO');
    return jsonb_build_object('situacao', 'RECUSADA', 'linhas', v_sync."QT_LINHA", 'ativas', v_ativas);
  end if;

  -- Sai quem não veio nesta carga (20261103150000): a linha que veio igual não é
  -- regravada (fica com o CO_SYNC antigo); a chave dela está em TL_CHAVE_DA_CARGA.
  update public."TB_ENTREVISTA" e set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
   where e."CO_AREA" = p_area and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S'
     and e."CO_SYNC" is distinct from p_sync
     and not exists (select 1 from private."TL_CHAVE_DA_CARGA" k
                      where k."TP_CARGA" = 'ENTREVISTA' and k."CO_SYNC" = p_sync
                        and k."DS_CHAVE_ORIGEM" = e."DS_CHAVE_ORIGEM");
  get diagnostics v_desativadas = row_count;

  -- Edital: número + área; com mais de um, o ATIVO e, entre eles, o da mesma unidade (20261022200000).
  with ent as materialized (
    select e."CO_ENTREVISTA", e."CO_MONITORAMENTO",
           private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as num,
           private."FC_TEXTO_BUSCA_RECURSO"(e."NO_UNIDADE") as uni
      from public."TB_ENTREVISTA" e
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  ), m as materialized (
    select m1.id, private."FC_NUMERO_EDITAL"(m1.edital) as num,
           private."FC_TEXTO_BUSCA_RECURSO"(m1.unidade) as uni, m1.ativo
      from public."TB_MONITORAMENTO_INDIGENA" m1
     where m1."CO_AREA" = p_area
  ), alvo as (
    select distinct on (ent."CO_ENTREVISTA") ent."CO_ENTREVISTA", ent."CO_MONITORAMENTO" as atual, m.id
      from ent
      left join m on m.num = ent.num
     order by ent."CO_ENTREVISTA", m.ativo desc nulls last, (m.uni = ent.uni) desc nulls last
  )
  update public."TB_ENTREVISTA" e set "CO_MONITORAMENTO" = alvo.id
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and alvo.atual is distinct from alvo.id;

  -- Análise: código do candidato + vaga; senão nome sem acento + vaga.
  with ent as materialized (
    select e."CO_ENTREVISTA", e."CO_ANALISE_CURRICULAR" as atual, e."TP_LIGACAO_ANALISE" as modo_atual,
           e."CO_VAGA", e."CO_CANDIDATO",
           private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as num,
           private."FC_TEXTO_BUSCA_RECURSO"(e."NO_CANDIDATO") as nome
      from public."TB_ENTREVISTA" e
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  ), an as materialized (
    select a.id, a.codigo_vaga, a.id_origem, a.ativo,
           private."FC_NUMERO_EDITAL"(a.edital) as num,
           private."FC_TEXTO_BUSCA_RECURSO"(a.candidato) as nome
      from public."TB_ANALISE_CURRICULAR" a
     where a."CO_AREA" = p_area
       and a.codigo_vaga in (select distinct ent."CO_VAGA" from ent)
  ), cand as (
    select ent."CO_ENTREVISTA", an.id,
           case when ent."CO_CANDIDATO" is not null and an.id_origem = ent."CO_CANDIDATO" then 'codigo' else 'nome' end as modo,
           an.num = ent.num as mesmo_edital, an.ativo
      from ent
      join an on an.codigo_vaga = ent."CO_VAGA"
             and ((ent."CO_CANDIDATO" is not null and an.id_origem = ent."CO_CANDIDATO") or an.nome = ent.nome)
  ), melhor as (
    select distinct on (c."CO_ENTREVISTA") c."CO_ENTREVISTA", c.id, c.modo
      from cand c
     order by c."CO_ENTREVISTA", (c.modo = 'codigo') desc, c.mesmo_edital desc nulls last, c.ativo desc
  ), alvo as (
    select ent."CO_ENTREVISTA", ent.atual, ent.modo_atual, melhor.id, melhor.modo
      from ent left join melhor on melhor."CO_ENTREVISTA" = ent."CO_ENTREVISTA"
  )
  update public."TB_ENTREVISTA" e set "CO_ANALISE_CURRICULAR" = alvo.id, "TP_LIGACAO_ANALISE" = alvo.modo
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and (alvo.atual is distinct from alvo.id or alvo.modo_atual is distinct from alvo.modo);

  -- A linha da planilha cuja análise já tem a entrevista do sistema sai (20261022200000).
  v_repetidas := private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(p_area, null, null);

  select count(*) filter (where e."CO_ANALISE_CURRICULAR" is not null),
         count(*) filter (where e."CO_ANALISE_CURRICULAR" is null),
         count(*) filter (where e."CO_MONITORAMENTO" is null)
    into v_ligadas, v_sem_analise, v_sem_edital
    from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S';

  update public."TL_SYNC_ENTREVISTA" set
    "TP_SITUACAO" = 'CONCLUIDA', "DT_FIM" = now(),
    "QT_LIGADA_ANALISE" = v_ligadas, "QT_SEM_ANALISE" = v_sem_analise,
    "QT_SEM_EDITAL" = v_sem_edital, "QT_DESATIVADA" = v_desativadas + v_repetidas,
    "DS_MENSAGEM" = case when coalesce(p_forcar, false) then 'Fechada com forçar.' end
   where "CO_SYNC" = p_sync;

  -- As chaves só valem enquanto a carga está aberta.
  delete from private."TL_CHAVE_DA_CARGA" k
   where k."TP_CARGA" = 'ENTREVISTA'
     and not exists (select 1 from public."TL_SYNC_ENTREVISTA" t
                      where t."CO_SYNC" = k."CO_SYNC" and t."TP_SITUACAO" = 'EM_ANDAMENTO');

  return jsonb_build_object('situacao', 'CONCLUIDA', 'linhas', v_sync."QT_LINHA",
    'ligadas_analise', v_ligadas, 'sem_analise', v_sem_analise,
    'sem_edital', v_sem_edital, 'desativadas', v_desativadas, 'repetidas', v_repetidas);
end;
$function$;

comment on function public.sincronizar_selecao(text, jsonb) is
  'Recebe um lote (até 1000) de linhas da aba Resultado da planilha "Auditoria" e faz upsert em TB_SELECAO_VAGA, só da vaga que mudou; as chaves do lote vão para private."TL_CHAVE_DA_CARGA" (20261103150000). Só service_role (scripts/sincronizar-selecao.mjs). Fechar com finalizar_sync_selecao.';
comment on function public.finalizar_sync_selecao(text, boolean) is
  'Fecha uma carga da aba Seleção: desativa (ST_REGISTRO_ATIVO = N) o que saiu da planilha (CO_SYNC diferente e chave fora de TL_CHAVE_DA_CARGA, 20261103150000), liga o edital e acerta a área (FC_LIGAR_SELECAO_AOS_EDITAIS: DSEI/CASAI só na Saúde Indígena), recalcula os KPIs dos editais (FC_ATUALIZAR_KPIS_PELA_SELECAO), grava os totais no log e apaga as chaves das cargas fechadas. Recusa carga com menos da metade das linhas ativas sem p_forcar. Só service_role.';
comment on function public.sincronizar_entrevistas(text, text, jsonb) is
  'Recebe um lote (até 1000) de linhas da aba Entrevistados e faz upsert em TB_ENTREVISTA/TB_ENTREVISTA_NOTA, só do que mudou; as chaves do lote vão para private."TL_CHAVE_DA_CARGA" (20261103150000). Só service_role (Apps Script). Fechar com finalizar_sync_entrevistas.';
comment on function public.finalizar_sync_entrevistas(text, text, boolean) is
  'Fecha uma carga de entrevistas: desativa (ST_ATIVO = N) o que saiu da planilha (CO_SYNC diferente e chave fora de TL_CHAVE_DA_CARGA, 20261103150000), liga edital e análise, grava os totais no log e apaga as chaves das cargas fechadas. Recusa carga com menos da metade das linhas ativas sem p_forcar. Só service_role.';

-- 8. Os KPIs: a data da Seleção é a da última mudança nas vagas do edital ----------------------
create or replace function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qt integer;
begin
  with ed as materialized (
    select m.id, m."CO_AREA",
           coalesce(private."FC_NUMERO_EDITAL"(m.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(m.edital), 'nome:')) as chave,
           exists (select 1 from public."TB_ORIGEM_ANALISE_EDITAL" o
                    where o."CO_MONITORAMENTO" = m.id and o."TP_ORIGEM" = 'MONITORA') as no_monitora
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m.ativo
  ),
  -- A chave da análise só vale quando aponta para um edital só na área.
  chave_unica as (
    select e."CO_AREA", e.chave, min(e.id::text)::uuid as id
      from ed e
     where e.chave is not null
     group by 1, 2
    having count(*) = 1
  ),
  -- Fonte 1: avaliação documental nativa (resumo da última execução de cada vaga).
  pre as (
    select pv."CO_MONITORAMENTO" id,
           sum(pv."QT_INSCRITO")::integer inscritos,
           sum(pv."QT_LOTE" + pv."QT_ACIMA_CORTE")::integer aptos,
           sum(pv."QT_ELIMINADO")::integer total_eliminados,
           max(pv."DT_ATUALIZACAO") em
      from public."TB_PRE_CLASSIF_VAGA" pv
     where pv."CO_MONITORAMENTO" in (select id from ed)
     group by 1
  ),
  pre_cancelados as (
    select p."CO_MONITORAMENTO" id, count(*)::integer qt
      from public."TB_PRE_CLASSIFICACAO" p
     where p."CO_MONITORAMENTO" in (select id from pre)
       and p."TP_SITUACAO" = 'ELIMINADO' and p."CO_MOTIVO_ELIMINACAO" = 'CANCELADO'
     group by 1
  ),
  -- Fonte 1 sem resumo: o último retrato das inscrições de cada vaga.
  retrato as (
    select r."CO_MONITORAMENTO" id,
           sum(r."QT_INSCRITO")::integer inscritos,
           case when count(*) = count(r."QT_APTO") then sum(r."QT_APTO")::integer end aptos,
           case when count(*) = count(r."QT_ELIMINADO") then sum(r."QT_ELIMINADO")::integer end total_eliminados,
           max(r."DT_ATUALIZACAO") em
      from (select distinct on (t."CO_MONITORAMENTO", t."CO_VAGA") t.*
              from public."TH_INSCRICAO_VAGA_EDITAL" t
             where t."CO_MONITORAMENTO" in (select id from ed)
               and t."CO_MONITORAMENTO" not in (select id from pre)
             order by t."CO_MONITORAMENTO", t."CO_VAGA", t."DT_RETRATO" desc) r
     group by 1
  ),
  -- Avaliação no MONITORA: o resultado das fichas, pelo id do edital.
  fichas as (
    select f."CO_MONITORAMENTO" id,
           (count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA' and f."TP_RESULTADO" = 'APTO'))::integer aprovados,
           (count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA' and f."TP_RESULTADO" is distinct from 'APTO'))::integer reprovados
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" in (select id from ed where no_monitora)
     group by 1
  ),
  -- Fonte 2: a Seleção, só quando coerente (aptos <= inscritos).
  sel as (
    select s."CO_MONITORAMENTO" id,
           sum(coalesce(s."QT_INSCRITO", 0))::integer inscritos,
           sum(coalesce(s."QT_APTO_ANALISE", 0))::integer aptos,
           sum(coalesce(s."QT_CANCELADO", 0))::integer cancelados,
           sum(coalesce(s."QT_ELIMINADO_NOTA", 0))::integer eliminados_nota,
           sum(coalesce(s."QT_REPROVADO_ANALISE", 0))::integer reprovados,
           sum(coalesce(s."QT_TOTAL_ELIMINADO", 0))::integer total_eliminados,
           -- Data dos dados (20261103150000): a última mudança nas vagas do edital, como
           -- nas outras fontes. Antes era a última carga concluída (de todas), e cada
           -- carga regravava os ~130 editais da Seleção com histórico sem mudar nada.
           max(s."DT_ATUALIZACAO") em
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_MONITORAMENTO" in (select id from ed)
     group by 1
    having sum(coalesce(s."QT_APTO_ANALISE", 0)) <= sum(coalesce(s."QT_INSCRITO", 0))
  ),
  -- Fonte 3: as análises do edital (número ou nome único na área).
  aprov as (
    select u.id,
           (count(*) filter (where a.status_consolidado = 'Aprovado'))::integer qt,
           (count(*) filter (where a.status_consolidado = 'Reprovado'))::integer reprovados,
           count(*)::integer candidatos,
           max(a.updated_at) em
      from chave_unica u
      join public."TB_ANALISE_CURRICULAR" a
        on a."CO_AREA" = u."CO_AREA" and a.ativo
       and coalesce(private."FC_NUMERO_EDITAL"(a.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(a.edital), 'nome:')) = u.chave
     group by 1
  ),
  -- Entrevistados: pessoas distintas (a entrevista vigente) que compareceram.
  entr as (
    select e."CO_MONITORAMENTO" id,
           (count(*) filter (where e."ST_COMPARECEU" = 'S'
                               or (e."ST_COMPARECEU" is null and e."TP_PARECER" in ('APTO', 'INAPTO'))))::integer qt
      from public."TB_ENTREVISTA" e
     where e."CO_ENTREVISTA" in (select v from private."FC_ENTREVISTAS_VIGENTES"(null) v)
       and e."CO_MONITORAMENTO" in (select id from ed)
     group by 1
  ),
  contr as (
    select l.edital_id::uuid id,
           (count(c.id) filter (where c.status in ('Contratado', 'Migração') and not private."FC_EM_OUTRA_LISTA"(c.id)))::integer qt
      from public."TB_LISTA_APROVADO" l
      left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
     where l.vigente is true and l.edital_id in (select id::text from ed)
     group by 1
  ),
  fonte as (
    select t.id, t.no_monitora,
           case when p.id is not null or r.id is not null then 'AVALIACAO_DOCUMENTAL'
                when s.id is not null then 'SELECAO'
                when a.id is not null then 'ANALISES' end as fonte
      from ed t
      left join pre p on p.id = t.id
      left join retrato r on r.id = t.id
      left join sel s on s.id = t.id
      left join aprov a on a.id = t.id
  ),
  novo as (
    select t.id, t.fonte,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.inscritos, r.inscritos)
                        when 'SELECAO' then s.inscritos end inscritos,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.aptos, r.aptos)
                        when 'SELECAO' then s.aptos
                        when 'ANALISES' then a.candidatos end aptos,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then case when p.id is not null then coalesce(pc.qt, 0) end
                        when 'SELECAO' then s.cancelados end cancelados,
           case t.fonte when 'SELECAO' then s.eliminados_nota end eliminados_nota,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.total_eliminados, r.total_eliminados)
                        when 'SELECAO' then s.total_eliminados end total_eliminados,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then
                          case when t.no_monitora then coalesce(f.reprovados, 0) else a.reprovados end
                        when 'SELECAO' then s.reprovados
                        when 'ANALISES' then a.reprovados end reprovados,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.em, r.em)
                        when 'SELECAO' then s.em
                        when 'ANALISES' then a.em end em,
           case when t.no_monitora then coalesce(f.aprovados, 0) else a.qt end aprovados,
           (a.id is not null or t.no_monitora) tem_aprovados,
           e.qt entrevistados, c.qt contratados
      from fonte t
      left join pre p on p.id = t.id
      left join pre_cancelados pc on pc.id = t.id
      left join retrato r on r.id = t.id
      left join fichas f on f.id = t.id
      left join sel s on s.id = t.id
      left join aprov a on a.id = t.id
      left join entr e on e.id = t.id
      left join contr c on c.id = t.id
     where t.fonte is not null or t.no_monitora or e.id is not null or c.id is not null
  ),
  -- Com fonte, todo campo do funil vem dela (ou nulo); sem fonte, o funil não muda.
  final as (
    select n.id,
           case when n.fonte is null then m.inscritos else n.inscritos end inscritos,
           case when n.fonte is null then m.aptos_analise else n.aptos end aptos_analise,
           case when n.fonte is null then m.cancelados else n.cancelados end cancelados,
           case when n.fonte is null then m.eliminados_nota else n.eliminados_nota end eliminados_nota,
           case when n.fonte is null then m.total_eliminados else n.total_eliminados end total_eliminados,
           case when n.fonte is null then m.reprovados_analise else n.reprovados end reprovados_analise,
           case when n.fonte is null then m."TP_FONTE_FUNIL" else n.fonte end fonte,
           case when n.fonte is null then m."DT_FONTE_FUNIL" else n.em end em,
           case when n.tem_aprovados then n.aprovados else m.aprovados_analise end aprovados_analise,
           coalesce(n.entrevistados, m.entrevistados) entrevistados,
           coalesce(n.contratados, m.contratados) contratados
      from novo n
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = n.id
  )
  update public."TB_MONITORAMENTO_INDIGENA" m
     set inscritos = f.inscritos,
         aptos_analise = f.aptos_analise,
         cancelados = f.cancelados,
         eliminados_nota = f.eliminados_nota,
         total_eliminados = f.total_eliminados,
         reprovados_analise = f.reprovados_analise,
         "TP_FONTE_FUNIL" = f.fonte,
         "DT_FONTE_FUNIL" = f.em,
         aprovados_analise = f.aprovados_analise,
         entrevistados = f.entrevistados,
         contratados = f.contratados,
         updated_at = now()
    from final f
   where m.id = f.id
     and (m.inscritos, m.aptos_analise, m.cancelados, m.eliminados_nota, m.total_eliminados,
          m.reprovados_analise, m."TP_FONTE_FUNIL", m."DT_FONTE_FUNIL", m.aprovados_analise,
          m.entrevistados, m.contratados)
         is distinct from
         (f.inscritos, f.aptos_analise, f.cancelados, f.eliminados_nota, f.total_eliminados,
          f.reprovados_analise, f.fonte, f.em, f.aprovados_analise, f.entrevistados, f.contratados);
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;

comment on function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() is
  'Recalcula os KPIs de todo edital ativo (TB_MONITORAMENTO_INDIGENA). O funil (inscritos, aptos, cancelados, eliminados, reprovados) vem de UMA fonte, na ordem: avaliação documental nativa (TB_PRE_CLASSIF_VAGA; sem ela, o último TH_INSCRICAO_VAGA_EDITAL), Seleção coerente (pelo id), análises (aptos = candidatos; inscritos nulo); com fonte, campo sem valor nela fica nulo; sem fonte, o funil não muda. Grava TP_FONTE_FUNIL e DT_FONTE_FUNIL (Seleção: última mudança nas vagas do edital, 20261103150000). Aprovados: fichas (avaliação no MONITORA, pelo id) ou análises; entrevistados: pessoas distintas que compareceram (FC_ENTREVISTAS_VIGENTES); contratados: lista vigente. Só grava o que mudou; devolve quantos editais mudaram (20261022200000).';

comment on column public."TB_MONITORAMENTO_INDIGENA"."DT_FONTE_FUNIL" is
  'Data dos dados da fonte do funil: última gravação da pré-classificação ou do retrato, última mudança nas vagas da Seleção do edital (max DT_ATUALIZACAO; antes de 20261103150000, a última carga concluída) ou última mudança nas análises do edital.';

-- 9. work_mem nas leituras e gravações que ordenam em disco ------------------------------------
-- get_analises_dashboard_payload_v2(text, text) já tem work_mem = 64MB (fica: vale o maior).
alter function public.get_analises_dashboard_payload_v2_se_mudou(text, text, text) set work_mem = '16MB';
alter function public.pendencias_ler_aprovados() set work_mem = '16MB';
alter function public.obter_pre_classificacao(uuid) set work_mem = '16MB';
alter function public.obter_pre_classificacao_se_mudou(uuid, text) set work_mem = '16MB';
alter function public.paineis_gravar_pacote(text, text, timestamp with time zone, bigint[], json, text) set work_mem = '16MB';

-- 10. Os gatilhos novos em toda fonte (e o antigo fora) -------------------------------------------
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

notify pgrst, 'reload schema';

commit;
