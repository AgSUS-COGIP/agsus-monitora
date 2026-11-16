/*
  FONTES DAS COLUNAS DOS PAINÉIS: O NÚCLEO (13/11/2026)

  POR QUE
  Cada coluna dos três relatórios dos Painéis tem hoje uma origem fixa no SQL (migration
  20261113210000). A verificação de 13/11/2026 mostrou que a melhor origem de uma mesma coluna
  muda de área para área. Decisão (desenho docs/superpowers/specs/
  2026-11-13-fontes-das-colunas-dos-paineis-design.md): a origem de cada coluna editável passa a
  ser escolhida pela tela, por área, entre fontes conferidas — visões do schema próprio `painel`,
  criadas só por migration. Nada de SQL digitado: os nomes de visão e de coluna só entram no SQL
  depois de achados no catálogo do PostgreSQL.

  O QUE CRIA
    - schema `painel`, sem grant para public/anon/authenticated (só as RPCs SECURITY DEFINER o
      leem). Cada visão `painel."VW_<GRAO>_<NOME>"` (GRAO = EDITAL, VAGA ou APROVADO) traz a chave
      do grão ("CO_MONITORAMENTO"; "CO_MONITORAMENTO" + "CO_VAGA"; "CO_CANDIDATO_APROVADO") e só
      aparece no seletor com COMMENT na visão e na coluna;
    - TB_FONTE_COLUNA_PAINEL (a escolha de cada área; sem linha = padrão) e
      TH_FONTE_COLUNA_PAINEL (cada troca: antes, depois, motivo, quem, quando);
    - FC_COLUNAS_EDITAVEIS_DO_PAINEL (as 11 colunas editáveis, espelho de
      src/lib/relatorios-dos-paineis.ts), FC_OPCOES_DE_FONTE_DO_PAINEL (as fontes compatíveis,
      lidas do catálogo), FC_APLICAR_FONTES_DO_PAINEL (troca os valores das linhas de um
      relatório pela fonte escolhida na área) e FC_FONTES_DO_PAINEL_JSON;
    - RPCs listar_fontes_do_painel (paineis_dados ≥ Leitor e a área) e salvar_fonte_da_coluna
      (Administrador em paineis_dados e a área).

  REGRAS DA TROCA (FC_APLICAR_FONTES_DO_PAINEL)
    - a escolha só vale se (visão, coluna) estiver entre as opções do catálogo na hora da
      leitura; senão a coluna fica vazia e a resposta avisa;
    - a fonte entra agrupada pela chave: o número de linhas do relatório nunca muda; chave
      repetida na fonte deixa a célula vazia e avisa; linha sem chave fica vazia;
    - data sai AAAA-MM-DD (timestamptz na hora de Brasília).

  DEPENDE DE: 20261113200000 (recurso paineis_dados) e 20261113210000 (FC_EXIGIR_PAINEIS_DA_AREA).
  DESFAZER: supabase/rollback/20261113220000_fontes_das_colunas_dos_paineis.sql (antes, desfaça
  20261113240000 e 20261113230000).
  ENSAIO:   supabase/ensaios/20261113220000_fontes_das_colunas_dos_paineis.sql.
*/
begin;

do $$
begin
  if not ('paineis_dados' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'Aplique antes 20261113200000_paineis_no_bloco_dados.sql.';
  end if;
  if to_regprocedure('private."FC_EXIGIR_PAINEIS_DA_AREA"(text)') is null then
    raise exception 'Aplique antes 20261113210000_relatorios_dos_paineis.sql.';
  end if;
  if to_regnamespace('painel') is not null then
    raise exception 'O schema painel já existe: esta migration já foi aplicada?';
  end if;
end;
$$;

-- 1. O schema das fontes --------------------------------------------------------------------------
create schema painel;
comment on schema painel is
  'Fontes conferidas das colunas dos Painéis: visões VW_<EDITAL|VAGA|APROVADO>_<NOME>, criadas só por migration, lidas só pelas RPCs dos Painéis (sem grant para a API).';
revoke all on schema painel from public, anon, authenticated;

-- 2. A escolha de cada área e o histórico ---------------------------------------------------------
create table public."TB_FONTE_COLUNA_PAINEL" (
  "CO_AREA" text not null,
  "CO_RELATORIO" varchar(40) not null,
  "CO_COLUNA" varchar(40) not null,
  "NO_VISAO" varchar(63) not null,
  "NO_COLUNA_VISAO" varchar(63) not null,
  "DS_MOTIVO" varchar(500) not null,
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_FONTE_COLUNA_PAINEL" primary key ("CO_AREA", "CO_RELATORIO", "CO_COLUNA"),
  constraint "FK_FONTECOLUNAPAINEL_AREA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_FONTECOLUNAPAINEL_MOTIVO" check (length(btrim("DS_MOTIVO")) between 3 and 500)
);
comment on table public."TB_FONTE_COLUNA_PAINEL" is
  'A fonte escolhida, por área, de cada coluna editável dos relatórios dos Painéis. Sem linha, a coluna usa o padrão (o SQL da RPC do relatório).';
comment on column public."TB_FONTE_COLUNA_PAINEL"."CO_AREA" is 'Área (TB_AREA) a que a escolha vale.';
comment on column public."TB_FONTE_COLUNA_PAINEL"."CO_RELATORIO" is 'Relatório (resumo-dos-editais, editais-por-cargo, aprovados).';
comment on column public."TB_FONTE_COLUNA_PAINEL"."CO_COLUNA" is 'Coluna editável do relatório (FC_COLUNAS_EDITAVEIS_DO_PAINEL).';
comment on column public."TB_FONTE_COLUNA_PAINEL"."NO_VISAO" is 'Visão do schema painel escolhida como fonte (revalidada no catálogo a cada leitura).';
comment on column public."TB_FONTE_COLUNA_PAINEL"."NO_COLUNA_VISAO" is 'Coluna da visão que dá o valor.';
comment on column public."TB_FONTE_COLUNA_PAINEL"."DS_MOTIVO" is 'Motivo da última troca (3 a 500 caracteres).';
comment on column public."TB_FONTE_COLUNA_PAINEL"."CO_USUARIO_ATUALIZACAO" is 'auth.uid() de quem fez a última troca.';
comment on column public."TB_FONTE_COLUNA_PAINEL"."DT_ATUALIZACAO" is 'Quando foi a última troca.';
alter table public."TB_FONTE_COLUNA_PAINEL" enable row level security;
revoke all on table public."TB_FONTE_COLUNA_PAINEL" from public, anon, authenticated;

create table public."TH_FONTE_COLUNA_PAINEL" (
  "SQ_HISTORICO" bigint generated always as identity,
  "CO_AREA" text not null,
  "CO_RELATORIO" varchar(40) not null,
  "CO_COLUNA" varchar(40) not null,
  "NO_VISAO_ANTES" varchar(63),
  "NO_COLUNA_VISAO_ANTES" varchar(63),
  "NO_VISAO_DEPOIS" varchar(63),
  "NO_COLUNA_VISAO_DEPOIS" varchar(63),
  "DS_FONTE_ANTES" varchar(300) not null,
  "DS_FONTE_DEPOIS" varchar(300) not null,
  "DS_MOTIVO" varchar(500) not null,
  "CO_USUARIO_ALTERACAO" uuid not null,
  "DT_ALTERACAO" timestamptz not null default now(),
  constraint "PK_TH_FONTE_COLUNA_PAINEL" primary key ("SQ_HISTORICO")
);
comment on table public."TH_FONTE_COLUNA_PAINEL" is
  'Histórico das trocas de fonte das colunas dos Painéis: de qual fonte para qual, o motivo, quem e quando.';
comment on column public."TH_FONTE_COLUNA_PAINEL"."SQ_HISTORICO" is 'Identificador da troca.';
comment on column public."TH_FONTE_COLUNA_PAINEL"."CO_AREA" is 'Área da troca.';
comment on column public."TH_FONTE_COLUNA_PAINEL"."CO_RELATORIO" is 'Relatório da troca.';
comment on column public."TH_FONTE_COLUNA_PAINEL"."CO_COLUNA" is 'Coluna da troca.';
comment on column public."TH_FONTE_COLUNA_PAINEL"."NO_VISAO_ANTES" is 'Visão de antes (nulo = padrão).';
comment on column public."TH_FONTE_COLUNA_PAINEL"."NO_COLUNA_VISAO_ANTES" is 'Coluna da visão de antes (nulo = padrão).';
comment on column public."TH_FONTE_COLUNA_PAINEL"."NO_VISAO_DEPOIS" is 'Visão de depois (nulo = padrão).';
comment on column public."TH_FONTE_COLUNA_PAINEL"."NO_COLUNA_VISAO_DEPOIS" is 'Coluna da visão de depois (nulo = padrão).';
comment on column public."TH_FONTE_COLUNA_PAINEL"."DS_FONTE_ANTES" is 'A fonte de antes, como aparecia na tela.';
comment on column public."TH_FONTE_COLUNA_PAINEL"."DS_FONTE_DEPOIS" is 'A fonte de depois, como aparece na tela.';
comment on column public."TH_FONTE_COLUNA_PAINEL"."DS_MOTIVO" is 'Motivo informado na troca.';
comment on column public."TH_FONTE_COLUNA_PAINEL"."CO_USUARIO_ALTERACAO" is 'auth.uid() de quem trocou.';
comment on column public."TH_FONTE_COLUNA_PAINEL"."DT_ALTERACAO" is 'Quando trocou.';
create index "IN_HISTFONTECOL_AREA_DATA"
  on public."TH_FONTE_COLUNA_PAINEL" ("CO_AREA", "CO_RELATORIO", "DT_ALTERACAO" desc);
alter table public."TH_FONTE_COLUNA_PAINEL" enable row level security;
revoke all on table public."TH_FONTE_COLUNA_PAINEL" from public, anon, authenticated;

-- 3. As colunas editáveis -------------------------------------------------------------------------
create function private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"()
 returns table (nu_ordem integer, co_relatorio text, tp_grao text, co_coluna text,
                no_rotulo text, tp_coluna text, ds_padrao text)
 language sql
 immutable
 set search_path to ''
as $function$
  select * from (values
    (1, 'resumo-dos-editais', 'EDITAL', 'vagas_imediatas', 'Total de vagas imediatas', 'inteiro',
        'Padrão: vagas do cadastro do edital'),
    (2, 'resumo-dos-editais', 'EDITAL', 'data_divulgacao', 'Data da divulgação do edital', 'data',
        'Padrão: início da 1ª etapa do cronograma'),
    (3, 'resumo-dos-editais', 'EDITAL', 'data_final', 'Data final do processo seletivo', 'data',
        'Padrão: fim da última etapa do cronograma'),
    (4, 'editais-por-cargo', 'VAGA', 'vagas_imediatas', 'Vagas imediatas (título da vaga)', 'inteiro',
        'Padrão: número no título da vaga'),
    (5, 'editais-por-cargo', 'VAGA', 'inscritos', 'Total de inscritos', 'inteiro',
        'Padrão: inscritos da Seleção'),
    (6, 'editais-por-cargo', 'VAGA', 'aprovados', 'Total de aprovados', 'inteiro',
        'Padrão: lista de aprovados vigente'),
    (7, 'aprovados', 'APROVADO', 'nota', 'Nota', 'decimal',
        'Padrão: nota da lista de aprovados'),
    (8, 'aprovados', 'APROVADO', 'classificacao', 'Classificação', 'inteiro',
        'Padrão: classificação da lista de aprovados'),
    (9, 'aprovados', 'APROVADO', 'status', 'Status', 'texto',
        'Padrão: status da lista de aprovados'),
    (10, 'aprovados', 'APROVADO', 'matricula', 'Matrícula', 'texto',
        'Padrão: matrícula da lista de aprovados'),
    (11, 'aprovados', 'APROVADO', 'data_contratacao', 'Data de admissão (registro no sistema)', 'data',
        'Padrão: data em que o status atual foi registrado')
  ) as c (nu_ordem, co_relatorio, tp_grao, co_coluna, no_rotulo, tp_coluna, ds_padrao)
  order by c.nu_ordem
$function$;
comment on function private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() is
  'As colunas dos relatórios dos Painéis cuja fonte se escolhe por área: relatório, grão (EDITAL, VAGA, APROVADO), coluna, rótulo, tipo (inteiro, decimal, data, texto) e o texto do padrão. Espelho de src/lib/relatorios-dos-paineis.ts.';
revoke all on function private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() from public, anon, authenticated;

-- 4. As fontes compatíveis, lidas do catálogo -----------------------------------------------------
create function private."FC_OPCOES_DE_FONTE_DO_PAINEL"(p_relatorio text, p_coluna text)
 returns table (no_visao text, ds_rotulo_visao text, no_coluna text, ds_rotulo_coluna text)
 language sql
 stable
 set search_path to ''
as $function$
  with alvo as (
    select c.tp_grao, c.tp_coluna,
           'VW_' || c.tp_grao || '_' as prefixo,
           case c.tp_grao
             when 'EDITAL' then array['CO_MONITORAMENTO']
             when 'VAGA' then array['CO_MONITORAMENTO', 'CO_VAGA']
             else array['CO_CANDIDATO_APROVADO']
           end as chaves,
           case c.tp_coluna
             when 'inteiro' then array['int2', 'int4', 'int8']
             when 'decimal' then array['int2', 'int4', 'int8', 'numeric', 'float4', 'float8']
             when 'data' then array['date', 'timestamp', 'timestamptz']
             else array['text', 'varchar', 'bpchar']
           end as tipos
      from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() c
     where c.co_relatorio = p_relatorio and c.co_coluna = p_coluna
  ),
  visoes as (
    select r.oid, r.relname::text as nome, btrim(pg_catalog.obj_description(r.oid, 'pg_class')) as rotulo
      from pg_catalog.pg_class r
      join pg_catalog.pg_namespace n on n.oid = r.relnamespace
      cross join alvo a
     where n.nspname = 'painel'
       and r.relkind in ('v', 'm')
       and left(r.relname::text, length(a.prefixo)) = a.prefixo
       and length(r.relname::text) > length(a.prefixo)
       and coalesce(btrim(pg_catalog.obj_description(r.oid, 'pg_class')), '') <> ''
       and (select count(*) from pg_catalog.pg_attribute k
             where k.attrelid = r.oid and k.attnum > 0 and not k.attisdropped
               and k.attname::text = any (a.chaves)) = cardinality(a.chaves)
  )
  select v.nome, v.rotulo, c.attname::text, btrim(pg_catalog.col_description(v.oid, c.attnum))
    from visoes v
    join pg_catalog.pg_attribute c on c.attrelid = v.oid and c.attnum > 0 and not c.attisdropped
    join pg_catalog.pg_type t on t.oid = c.atttypid
    cross join alvo a
   where c.attname::text <> all (a.chaves)
     and t.typname::text = any (a.tipos)
     and coalesce(btrim(pg_catalog.col_description(v.oid, c.attnum)), '') <> ''
   order by v.nome, c.attnum
$function$;
comment on function private."FC_OPCOES_DE_FONTE_DO_PAINEL"(text, text) is
  'As fontes que uma coluna dos Painéis aceita: visões do schema painel do grão do relatório (VW_<GRAO>_…), com a chave do grão, COMMENT na visão e na coluna e coluna de tipo compatível. Lidas do catálogo do PostgreSQL: é a única lista de onde um nome entra no SQL.';
revoke all on function private."FC_OPCOES_DE_FONTE_DO_PAINEL"(text, text) from public, anon, authenticated;

-- 5. A troca dos valores --------------------------------------------------------------------------
create function private."FC_APLICAR_FONTES_DO_PAINEL"(p_area text, p_relatorio text, p_linhas jsonb)
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  v_linhas jsonb := coalesce(p_linhas, '[]'::jsonb);
  v_fontes jsonb := '{}'::jsonb;
  v_avisos jsonb := '[]'::jsonb;
  c record;
  v_visao text;
  v_coluna text;
  v_rotulo text;
  v_tipo text;
  v_chave_fonte text;
  v_chave_linha text;
  v_valor text;
  v_novas jsonb;
  v_repetidas integer;
begin
  for c in
    select e.* from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() e
     where e.co_relatorio = p_relatorio order by e.nu_ordem
  loop
    select f."NO_VISAO", f."NO_COLUNA_VISAO" into v_visao, v_coluna
      from public."TB_FONTE_COLUNA_PAINEL" f
     where f."CO_AREA" = p_area and f."CO_RELATORIO" = p_relatorio and f."CO_COLUNA" = c.co_coluna;

    if not found then
      v_fontes := v_fontes || jsonb_build_object(c.co_coluna, jsonb_build_object(
        'padrao', true, 'visao', null, 'coluna', null, 'rotulo', c.ds_padrao));
      continue;
    end if;

    -- A escolha só vale se ainda estiver entre as opções do catálogo.
    select o.ds_rotulo_visao || ' › ' || o.ds_rotulo_coluna into v_rotulo
      from private."FC_OPCOES_DE_FONTE_DO_PAINEL"(p_relatorio, c.co_coluna) o
     where o.no_visao = v_visao and o.no_coluna = v_coluna;

    if not found then
      select coalesce(jsonb_agg(l.v || jsonb_build_object(c.co_coluna, null) order by l.n), '[]'::jsonb)
        into v_linhas
        from jsonb_array_elements(v_linhas) with ordinality as l (v, n);
      v_fontes := v_fontes || jsonb_build_object(c.co_coluna, jsonb_build_object(
        'padrao', false, 'visao', v_visao, 'coluna', v_coluna, 'rotulo', 'Fonte indisponível'));
      v_avisos := v_avisos || to_jsonb(format(
        'A fonte escolhida para "%s" não está disponível: a coluna ficou vazia.', c.no_rotulo));
      continue;
    end if;

    select t.typname::text into v_tipo
      from pg_catalog.pg_attribute a
      join pg_catalog.pg_class r on r.oid = a.attrelid
      join pg_catalog.pg_namespace n on n.oid = r.relnamespace
      join pg_catalog.pg_type t on t.oid = a.atttypid
     where n.nspname = 'painel' and r.relname::text = v_visao and a.attname::text = v_coluna
       and a.attnum > 0 and not a.attisdropped;

    v_valor := case
      when v_tipo = 'timestamptz' then format('to_char((f.%I at time zone ''America/Sao_Paulo'')::date, ''YYYY-MM-DD'')', v_coluna)
      when v_tipo in ('timestamp', 'date') then format('to_char(f.%I::date, ''YYYY-MM-DD'')', v_coluna)
      when c.tp_coluna = 'texto' then format('f.%I::text', v_coluna)
      else format('f.%I', v_coluna)
    end;
    v_chave_fonte := case c.tp_grao
      when 'EDITAL' then 'f."CO_MONITORAMENTO"::text'
      when 'VAGA' then 'f."CO_MONITORAMENTO"::text || ''|'' || f."CO_VAGA"::text'
      else 'f."CO_CANDIDATO_APROVADO"::text'
    end;
    v_chave_linha := case c.tp_grao
      when 'EDITAL' then $k$(l.v ->> 'edital_id')$k$
      when 'VAGA' then $k$((l.v ->> 'edital_id') || '|' || (l.v ->> 'codigo_vaga'))$k$
      else $k$(l.v ->> 'candidato_id')$k$
    end;

    execute format($q$
      with fonte as (
        select %1$s as chave, count(*) as qtd, (array_agg(to_jsonb(%2$s)))[1] as valor
          from painel.%3$I f
         group by 1
      ),
      linhas as (
        select l.v, l.n, %4$s as chave
          from jsonb_array_elements($1) with ordinality as l (v, n)
      )
      select coalesce(jsonb_agg(linhas.v || jsonb_build_object($2,
               case when fonte.qtd = 1 then fonte.valor else 'null'::jsonb end) order by linhas.n), '[]'::jsonb),
             (count(distinct linhas.chave) filter (where fonte.qtd > 1))::integer
        from linhas
        left join fonte on fonte.chave = linhas.chave
    $q$, v_chave_fonte, v_valor, v_visao, v_chave_linha)
    into v_novas, v_repetidas
    using v_linhas, c.co_coluna;

    v_linhas := v_novas;
    v_fontes := v_fontes || jsonb_build_object(c.co_coluna, jsonb_build_object(
      'padrao', false, 'visao', v_visao, 'coluna', v_coluna, 'rotulo', v_rotulo));
    if v_repetidas > 0 then
      v_avisos := v_avisos || to_jsonb(format(
        '%s chave%s repetida%s na fonte de "%s": essas células ficaram vazias.',
        v_repetidas, case when v_repetidas > 1 then 's' else '' end,
        case when v_repetidas > 1 then 's' else '' end, c.no_rotulo));
    end if;
  end loop;

  return jsonb_build_object('linhas', v_linhas, 'fontes', v_fontes, 'avisos', v_avisos);
end;
$function$;
comment on function private."FC_APLICAR_FONTES_DO_PAINEL"(text, text, jsonb) is
  'Troca, nas linhas de um relatório dos Painéis, o valor de cada coluna com fonte escolhida na área (TB_FONTE_COLUNA_PAINEL) pelo da visão do schema painel, juntada pela chave do grão. Só usa nomes achados no catálogo (FC_OPCOES_DE_FONTE_DO_PAINEL); fonte indisponível ou chave repetida esvaziam as células e avisam. Devolve { linhas, fontes, avisos }.';
revoke all on function private."FC_APLICAR_FONTES_DO_PAINEL"(text, text, jsonb) from public, anon, authenticated;

-- 6. O que a tela mostra no editor ----------------------------------------------------------------
create function private."FC_FONTES_DO_PAINEL_JSON"(p_area text, p_relatorio text)
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  select jsonb_build_object(
    'pode_editar', private.pode_recurso('paineis_dados', 3) and private."FC_PODE_AREA"(p_area),
    'colunas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'coluna', c.co_coluna,
               'rotulo', c.no_rotulo,
               'tipo', c.tp_coluna,
               'padrao', c.ds_padrao,
               'escolha', (
                 select jsonb_build_object('visao', f."NO_VISAO", 'coluna', f."NO_COLUNA_VISAO")
                   from public."TB_FONTE_COLUNA_PAINEL" f
                  where f."CO_AREA" = p_area and f."CO_RELATORIO" = p_relatorio
                    and f."CO_COLUNA" = c.co_coluna),
               'opcoes', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'visao', o.no_visao, 'rotulo', o.ds_rotulo_visao, 'colunas', o.colunas)
                          order by o.ds_rotulo_visao, o.no_visao), '[]'::jsonb)
                   from (select x.no_visao, x.ds_rotulo_visao,
                                jsonb_agg(jsonb_build_object('coluna', x.no_coluna, 'rotulo', x.ds_rotulo_coluna)
                                          order by x.ds_rotulo_coluna) as colunas
                           from private."FC_OPCOES_DE_FONTE_DO_PAINEL"(p_relatorio, c.co_coluna) x
                          group by x.no_visao, x.ds_rotulo_visao) o)
             ) order by c.nu_ordem), '[]'::jsonb)
        from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() c
       where c.co_relatorio = p_relatorio),
    'historico', (
      select coalesce(jsonb_agg(h.item order by h.dt desc, h.id desc), '[]'::jsonb)
        from (select t."DT_ALTERACAO" as dt, t."SQ_HISTORICO" as id,
                     jsonb_build_object(
                       'em', t."DT_ALTERACAO",
                       'nome', coalesce(u.nome, 'Usuário sem perfil'),
                       'coluna', coalesce(c.no_rotulo, t."CO_COLUNA"),
                       'antes', t."DS_FONTE_ANTES",
                       'depois', t."DS_FONTE_DEPOIS",
                       'motivo', t."DS_MOTIVO") as item
                from public."TH_FONTE_COLUNA_PAINEL" t
                left join private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() c
                  on c.co_relatorio = t."CO_RELATORIO" and c.co_coluna = t."CO_COLUNA"
                left join lateral (select p.nome from public."TB_PERFIL_USUARIO" p
                                    where p.user_id = t."CO_USUARIO_ALTERACAO" limit 1) u on true
               where t."CO_AREA" = p_area and t."CO_RELATORIO" = p_relatorio
               order by t."DT_ALTERACAO" desc, t."SQ_HISTORICO" desc
               limit 20) h)
  )
$function$;
comment on function private."FC_FONTES_DO_PAINEL_JSON"(text, text) is
  'O editor de fontes de um relatório dos Painéis numa área: se quem pede pode editar, cada coluna editável (padrão, escolha, opções do catálogo) e as 20 trocas mais recentes.';
revoke all on function private."FC_FONTES_DO_PAINEL_JSON"(text, text) from public, anon, authenticated;

-- 7. As RPCs --------------------------------------------------------------------------------------
create function public.listar_fontes_do_painel(p_area text, p_relatorio text)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  if not exists (select 1 from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() c where c.co_relatorio = p_relatorio) then
    raise exception 'Relatório desconhecido' using errcode = '22023';
  end if;
  return private."FC_FONTES_DO_PAINEL_JSON"(p_area, p_relatorio);
end;
$function$;
comment on function public.listar_fontes_do_painel(text, text) is
  'Painéis › Fontes dos dados (jsonb): para a área e o relatório, cada coluna editável com o padrão, a fonte escolhida e as opções do schema painel, o histórico recente e se quem pede pode editar. Recurso paineis_dados ≥ Leitor e acesso à área.';
revoke all on function public.listar_fontes_do_painel(text, text) from public, anon;
grant execute on function public.listar_fontes_do_painel(text, text) to authenticated;

create function public.salvar_fonte_da_coluna(
  p_area text, p_relatorio text, p_coluna text, p_visao text, p_coluna_visao text, p_motivo text)
 returns jsonb
 language plpgsql
 volatile
 security definer
 set search_path to ''
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
  c record;
  v_visao_antes text;
  v_coluna_antes text;
  v_tinha boolean;
  v_antes text;
  v_depois text;
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  if v_usuario is null then
    raise exception 'Sessão não localizada' using errcode = '28000';
  end if;
  if not private.pode_recurso('paineis_dados', 3) then
    raise exception 'Só o Administrador em Painéis troca a fonte' using errcode = '42501';
  end if;

  select e.* into c from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() e
   where e.co_relatorio = p_relatorio and e.co_coluna = p_coluna;
  if not found then
    raise exception 'Coluna sem fonte editável' using errcode = '22023';
  end if;
  if length(v_motivo) not between 3 and 500 then
    raise exception 'Motivo: de 3 a 500 caracteres.' using errcode = '22023';
  end if;

  select f."NO_VISAO", f."NO_COLUNA_VISAO" into v_visao_antes, v_coluna_antes
    from public."TB_FONTE_COLUNA_PAINEL" f
   where f."CO_AREA" = p_area and f."CO_RELATORIO" = p_relatorio and f."CO_COLUNA" = p_coluna
     for update;
  v_tinha := found;
  v_antes := case when v_tinha
    then coalesce((select o.ds_rotulo_visao || ' › ' || o.ds_rotulo_coluna
                     from private."FC_OPCOES_DE_FONTE_DO_PAINEL"(p_relatorio, p_coluna) o
                    where o.no_visao = v_visao_antes and o.no_coluna = v_coluna_antes),
                  v_visao_antes || ' › ' || v_coluna_antes)
    else c.ds_padrao end;

  if p_visao is null then
    if not v_tinha then
      raise exception 'Nada mudou: a coluna já usa o padrão.' using errcode = '22023';
    end if;
    delete from public."TB_FONTE_COLUNA_PAINEL"
     where "CO_AREA" = p_area and "CO_RELATORIO" = p_relatorio and "CO_COLUNA" = p_coluna;
    v_depois := c.ds_padrao;
  else
    select o.ds_rotulo_visao || ' › ' || o.ds_rotulo_coluna into v_depois
      from private."FC_OPCOES_DE_FONTE_DO_PAINEL"(p_relatorio, p_coluna) o
     where o.no_visao = p_visao and o.no_coluna = p_coluna_visao;
    if not found then
      raise exception 'Fonte inválida para esta coluna' using errcode = '22023';
    end if;
    if v_tinha and v_visao_antes = p_visao and v_coluna_antes = p_coluna_visao then
      raise exception 'Nada mudou: a coluna já usa esta fonte.' using errcode = '22023';
    end if;
    insert into public."TB_FONTE_COLUNA_PAINEL"
      ("CO_AREA", "CO_RELATORIO", "CO_COLUNA", "NO_VISAO", "NO_COLUNA_VISAO", "DS_MOTIVO",
       "CO_USUARIO_ATUALIZACAO", "DT_ATUALIZACAO")
    values (p_area, p_relatorio, p_coluna, p_visao, p_coluna_visao, v_motivo, v_usuario, now())
    on conflict ("CO_AREA", "CO_RELATORIO", "CO_COLUNA") do update
       set "NO_VISAO" = excluded."NO_VISAO", "NO_COLUNA_VISAO" = excluded."NO_COLUNA_VISAO",
           "DS_MOTIVO" = excluded."DS_MOTIVO", "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO",
           "DT_ATUALIZACAO" = excluded."DT_ATUALIZACAO";
  end if;

  insert into public."TH_FONTE_COLUNA_PAINEL"
    ("CO_AREA", "CO_RELATORIO", "CO_COLUNA", "NO_VISAO_ANTES", "NO_COLUNA_VISAO_ANTES",
     "NO_VISAO_DEPOIS", "NO_COLUNA_VISAO_DEPOIS", "DS_FONTE_ANTES", "DS_FONTE_DEPOIS", "DS_MOTIVO",
     "CO_USUARIO_ALTERACAO")
  values (p_area, p_relatorio, p_coluna,
          case when v_tinha then v_visao_antes end, case when v_tinha then v_coluna_antes end,
          p_visao, case when p_visao is not null then p_coluna_visao end,
          left(v_antes, 300), left(v_depois, 300), v_motivo, v_usuario);

  return private."FC_FONTES_DO_PAINEL_JSON"(p_area, p_relatorio);
end;
$function$;
comment on function public.salvar_fonte_da_coluna(text, text, text, text, text, text) is
  'Painéis › Fontes dos dados: troca a fonte de uma coluna editável na área (p_visao nulo = volta ao padrão), só entre as opções do catálogo, com motivo (3 a 500) e histórico. Exige Administrador em paineis_dados e acesso à área. Devolve o mesmo de listar_fontes_do_painel.';
revoke all on function public.salvar_fonte_da_coluna(text, text, text, text, text, text) from public, anon;
grant execute on function public.salvar_fonte_da_coluna(text, text, text, text, text, text) to authenticated;

commit;
