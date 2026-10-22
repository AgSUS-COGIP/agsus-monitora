/*
  AVALIAÇÃO DOCUMENTAL: A FILA PARCIAL SEM MONTAR A FILA INTEIRA

  Por quê: obter_fila_avaliacao_desde (20261014231000) devolve só as linhas que
  mudaram, mas a primeira linha dela era `v json := obter_fila_avaliacao(...)`:
  montava a fila inteira (114/2026: 1.512 linhas do núcleo, ≈630 KB de JSON) e só
  depois filtrava pelos ids que mudaram. Toda volta à lista de cada avaliador
  pagava a fila inteira — 1,6 s com o banco folgado, 4 a 10 s com ele cheio —, e
  isso ajudou nos "canceling statement due to statement timeout" de 19/10/2026
  (o authenticated tem statement_timeout de 8 s, no servidor NANO de 0,5 GB).
  Além disso, a marca, quantos estão sem ficha, as contagens de fora do lote e o
  total do núcleo liam TB_PRE_CLASSIFICACAO pela tabela (2.194 páginas: cada
  linha leva as notas declaradas congeladas, ≈1 KB), que no NANO sai do cache.

  O QUE MUDA (o contrato das duas RPCs é o mesmo: mesmas chaves, mesmos valores)
    private."FC_LINHAS_DA_FILA" ganha p_candidatos uuid[] (nulo = todos, como
        antes): a regra da linha continua numa fonte só. Com ids, a leitura vai
        pela chave (PK) em vez de varrer o edital.
    private."FC_FILA_AVALIACAO_JSON"(p_edital, p_candidatos) é o corpo de sempre
        de obter_fila_avaliacao (permissão, área, papel, recorte de vagas do
        analista, distribuição, sem_ficha, vagas, analistas, filtros,
        fora_do_lote com a versão). Com p_candidatos, "candidatos" traz só esses
        inscritos (se estiverem no núcleo de quem lê) e vem "total_nucleo", uma
        contagem (sem montar linha nenhuma).
    public.obter_fila_avaliacao(p_edital) = FC_FILA_AVALIACAO_JSON(p_edital, null),
        igual byte a byte à de antes (menos gerado_em).
    public.obter_fila_avaliacao_desde: com p_desde e p_marca, primeiro os ids
        das fichas mudadas (o mesmo critério: DT_ATUALIZACAO ou DT_RESERVA_EXPIRA
        >= p_desde − 2 min) e a fila só com eles; a marca (a mesma regra) é
        conferida nessa resposta e, se for outra, aí sim a fila inteira. Sem
        p_desde, a inteira de uma vez, como antes.
    IN_PRECLASSIF_FILA: índice coberto de TB_PRE_CLASSIFICACAO por edital, com
        as colunas que a marca, sem_ficha, fora_do_lote e total_nucleo leem:
        essas contagens passam a ler o índice (index-only scan, ≈100 páginas)
        em vez da tabela. Escrita: as atualizações dessa tabela já não são HOT
        (outros índices cobrem TP_SITUACAO), então o custo extra é só a entrada
        do índice; ela só é regravada pelo job da pré-classificação e pelas
        decisões da coordenação.

  MEDIDO NO ENSAIO (114/2026, banco de produção em begin … rollback, 19/10/2026)
    Banco folgado, cache quente, uma chamada de cada (role authenticated):
                                          antes            depois
      parcial 10 min, coordenação         169 ms           27 ms   (28 linhas, 18 KB)
      parcial 10 min, analista            188 ms           33 ms
      parcial 1 dia, coordenação          173 ms           42 ms   (248 linhas, 140 KB)
      inteira (sem p_desde), coordenação  152 ms          103 ms   (1.512 linhas, 634 KB)
      inteira, analista                   167 ms          152 ms
      blocos lidos, parcial 10 min      22.676          2.663    (EXPLAIN BUFFERS)
      blocos lidos, inteira             22.478          5.276
    Sem o índice, a parcial ficava em 58 ms (coordenação) e 72 ms (analista).
    Com o banco cheio (19/10, 11h) a fila inteira levou de 4 a 10 s; o que pesa
    ali é ler blocos fora do cache, e a parcial passa a ler ~1/8 deles.
    Comparação no mesmo begin … rollback (jsonb, sem gerado_em, e a ordem das
    chaves): obter_fila_avaliacao, a desde inteira, a parcial (10 min e 1 dia)
    e a de outra marca saem idênticas às de antes, para a coordenação e para um
    analista; obter_fila_fora_do_lote (duas páginas) também; sem permissão, o
    mesmo 42501.

  Permissão: a de sempre (FC_EXIGIR_AVALIACAO_EDITAL e FC_PAPEL_AVALIACAO,
  chamadas antes de qualquer leitura de linha). As funções private.* seguem só
  do dono (postgres); as públicas seguem para authenticated.
  O front não muda.

  Ensaio: supabase/ensaios/20261019150000_fila_parcial_sem_montar_tudo.sql
  Rollback: supabase/rollback/20261019150000_fila_parcial_sem_montar_tudo.sql
*/
begin;

set local lock_timeout = '10s';

-- 1. As linhas da fila, de todos ou só de alguns inscritos -----------------------------------
-- Troca de assinatura (um parâmetro a mais, com default): as chamadas de hoje, com cinco
-- argumentos, seguem valendo. Nenhuma função depende dela no catálogo (plpgsql resolve na hora).
drop function private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer);

create function private."FC_LINHAS_DA_FILA"(
  p_edital uuid,
  p_vagas text[],
  p_nucleo boolean,
  p_apos uuid,
  p_limite integer,
  p_candidatos uuid[] default null
)
returns table(id uuid, vaga text, eliminado boolean, posicao integer, codigo text, linha json)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  -- Consulta dinâmica (EXECUTE … USING): planejada a cada chamada com os valores, e não num
  -- plano genérico. Com p_candidatos, o filtro vira condição da chave (PK) e a leitura vai só
  -- nesses inscritos; sem ele, o "p_candidatos is null or …" some e o plano é o do edital todo.
  -- (Num plano genérico, o OR obrigava a varrer o edital; um UNION ALL levou a fila inteira de
  -- 0,15 s a 0,7 s no ensaio.)
  return query execute $sql$
  -- $2 (p_vagas) nulo = todas as vagas; $5 (p_limite) nulo = sem limite (o núcleo vem
  -- inteiro); $6 (p_candidatos) nulo = todos os inscritos do edital.
  select a."CO_EMPREGARE_CANDIDATO",
         a."CO_VAGA"::text,
         a."TP_SITUACAO" = 'ELIMINADO',
         a."NU_POSICAO",
         c."CO_CANDIDATO_EMPREGARE"::text,
         -- Sem as chaves nulas (a tela trata ausente como nulo): o JSON do lote cai pela metade.
         json_strip_nulls(json_build_object(
           'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA", 'codigo', c."CO_CANDIDATO_EMPREGARE",
           'nome', c."NO_CANDIDATO", 'situacao_pre', a."TP_SITUACAO", 'motivo_eliminacao', a."DS_MOTIVO_ELIMINACAO",
           'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE", 'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM",
           'modalidade', a."NO_MODALIDADE", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'entrada', a."TP_ENTRADA_LOTE",
           'decisao', case when a."TP_ENTRADA_LOTE" = 'DECISAO' then a."DS_MOTIVO_ENTRADA" end,
           'ficha', case when f."CO_FICHA_ANALISE" is null then null else json_build_object(
             'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'situacao', f."TP_SITUACAO",
             'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
             'atribuida_em', f."DT_ATRIBUICAO", 'motivo_saida', f."DS_MOTIVO_SAIDA", 'lote', f."NU_LOTE",
             'resultado', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."TP_RESULTADO" end,
             'nota_final', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."VL_NOTA_FINAL" end,
             'concluida_em', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."DT_CONCLUSAO" end,
             'rascunho_em', f."DT_RASCUNHO",
             'reserva', case when f."DT_RESERVA_EXPIRA" > now() then json_build_object(
               'usuario', f."CO_USUARIO_RESERVA", 'nome', coalesce(uv.nome, uv.email),
               'desde', f."DT_RESERVA", 'expira', f."DT_RESERVA_EXPIRA") end) end))
    from public."TB_PRE_CLASSIFICACAO" a
    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
    left join public."TB_FICHA_ANALISE" f
      on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
    left join public."TB_PERFIL_USUARIO" ur on ur.user_id = f."CO_USUARIO_RESPONSAVEL"
    left join public."TB_PERFIL_USUARIO" uv on uv.user_id = f."CO_USUARIO_RESERVA"
   where a."CO_MONITORAMENTO" = $1
     and ($2 is null or a."CO_VAGA" = any ($2))
     and private."FC_NO_NUCLEO_DA_FILA"(a."TP_SITUACAO", f."TP_SITUACAO") = $3
     and ($4 is null or a."CO_EMPREGARE_CANDIDATO" > $4)
     and ($6 is null or a."CO_EMPREGARE_CANDIDATO" = any ($6))
   order by a."CO_EMPREGARE_CANDIDATO"
   limit $5
  $sql$ using p_edital, p_vagas, p_nucleo, p_apos, p_limite, p_candidatos;
end;
$function$;

revoke all on function private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer, uuid[]) from public, anon, authenticated;

comment on function private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer, uuid[]) is
  'Linhas da fila da avaliação documental (o JSON de cada inscrito, sem as chaves nulas, com a ficha, a reserva vigente e a decisão da coordenação), de uma partição (p_nucleo: FC_NO_NUCLEO_DA_FILA), das vagas p_vagas (nulo = todas), em ordem do id do inscrito, depois de p_apos e até p_limite (nulo = sem limite); p_candidatos (nulo = todos) restringe a esses inscritos, pela chave (20261019150000). Sem conferência de permissão: quem chama confere.';

-- 2. A fila (o corpo de sempre de obter_fila_avaliacao), inteira ou só de alguns inscritos ----
create or replace function private."FC_FILA_AVALIACAO_JSON"(p_edital uuid, p_candidatos uuid[])
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_so_minhas_vagas boolean := coalesce(v_papel, '') = 'ANALISTA';
  v_vagas text[];
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v json;
  v_fora json;
  v_total_nucleo bigint;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  -- O analista vê só as vagas que analisa: a permissão é avaliada uma vez por vaga (não por inscrito).
  if v_so_minhas_vagas then
    v_vagas := private."FC_VAGAS_DO_ANALISTA"(p_edital, v_uid);
  end if;
  -- Os de fora do lote (contagens e versão) e o tamanho do núcleo numa leitura só, pelo índice
  -- IN_PRECLASSIF_FILA. Agrupado antes (MATERIALIZED) por situação da pré, da ficha e
  -- modalidade: FC_NO_NUCLEO_DA_FILA (que não é embutida, por causa do search_path) roda uma
  -- vez por grupo (~20), e não por inscrito (7.726 no 114/2026, ~30 ms cada partição).
  -- Mesmos valores de antes: soma das contagens = contagem; máximo dos máximos = máximo. O
  -- núcleo sem a junção com TB_EMPREGARE_CANDIDATO de FC_LINHAS_DA_FILA: a FK
  -- FK_EMPREGARECAND_PRECLASSIF garante o par.
  with g as materialized (
    select a."TP_SITUACAO" as s, f."TP_SITUACAO" as sf, a."NO_MODALIDADE" as m,
           count(*) as n, max(a."DT_ATUALIZACAO") as dt, max(f."NU_VERSAO") as versao_max,
           sum(f."NU_VERSAO") as versao_soma, count(f."CO_FICHA_ANALISE") as fichas,
           max(f."DT_RESERVA_EXPIRA") as reserva
      from public."TB_PRE_CLASSIFICACAO" a
      left join public."TB_FICHA_ANALISE" f
        on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
     where a."CO_MONITORAMENTO" = p_edital
       and (v_vagas is null or a."CO_VAGA" = any (v_vagas))
     group by 1, 2, 3
  ), p as (
    select g.*, private."FC_NO_NUCLEO_DA_FILA"(g.s, g.sf) as nucleo from g
  )
  select json_build_object(
           'total', coalesce(sum(p.n) filter (where not p.nucleo), 0),
           'eliminados', coalesce(sum(p.n) filter (where not p.nucleo and p.s = 'ELIMINADO'), 0),
           'ranqueados', coalesce(sum(p.n) filter (where not p.nucleo and p.s = 'RANQUEADO'), 0),
           'modalidades', coalesce(json_agg(distinct p.m) filter (where not p.nucleo and p.m is not null), '[]'::json),
           -- Muda quando a pré-classificação ou uma ficha de fora do lote muda: a tela relê a lista de fora.
           'versao', md5(concat_ws('|', coalesce(sum(p.n) filter (where not p.nucleo), 0),
                                   max(p.dt) filter (where not p.nucleo),
                                   max(p.versao_max) filter (where not p.nucleo),
                                   sum(p.versao_soma) filter (where not p.nucleo),
                                   coalesce(sum(p.fichas) filter (where not p.nucleo), 0),
                                   max(p.reserva) filter (where not p.nucleo)))),
         coalesce(sum(p.n) filter (where p.nucleo), 0)
    into v_fora, v_total_nucleo
    from p;
  v := json_build_object(
    'schema_version', 2,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'area', v_area,
                                'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital)),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_pegar', private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, null),
    'eu', v_uid,
    'prazo_reserva_min', extract(epoch from private."FC_PRAZO_RESERVA_FICHA"())::integer / 60,
    'distribuicao', private."FC_DISTRIBUICAO_DO_EDITAL"(p_edital),
    'sem_ficha', (select count(*) from public."TB_PRE_CLASSIFICACAO" p
                   where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
                     and not exists (select 1 from public."TB_FICHA_ANALISE" f
                                      where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")),
    'vagas', coalesce((
      select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO")
                      order by pv."CO_VAGA")
        from public."TB_PRE_CLASSIF_VAGA" pv
       where pv."CO_MONITORAMENTO" = p_edital
         and (v_vagas is null or pv."CO_VAGA" = any (v_vagas))), '[]'::json),
    'analistas', private."FC_ANALISTAS_DO_EDITAL"(p_edital, true),
    'filtros', private."FC_FILTROS_FILA_JSON"(v_uid),
    'fora_do_lote', v_fora,
    'candidatos', coalesce((
      select json_agg(l.linha order by l.vaga, l.eliminado, l.posicao, l.codigo)
        from private."FC_LINHAS_DA_FILA"(p_edital, v_vagas, true, null, null, p_candidatos) l), '[]'::json)
  );
  if p_candidatos is null then
    return v;
  end if;
  -- Só alguns inscritos: e quantas linhas o núcleo de quem lê tem (contado acima, sem montá-las).
  return (
    select json_object_agg(x.k, x.v order by x.o)
      from (select t.k, t.v, t.o from json_each(v) with ordinality t(k, v, o)
            union all
            select 'total_nucleo', to_json(v_total_nucleo), 100000) x);
end;
$function$;

revoke all on function private."FC_FILA_AVALIACAO_JSON"(uuid, uuid[]) from public, anon, authenticated;

comment on function private."FC_FILA_AVALIACAO_JSON"(uuid, uuid[]) is
  'O corpo de obter_fila_avaliacao (20261019150000): com p_candidatos nulo, a fila inteira; com ids, "candidatos" só com os desses inscritos que estão no núcleo de quem lê e "total_nucleo" (contagem, sem montar linhas), para obter_fila_avaliacao_desde. Confere a permissão (FC_EXIGIR_AVALIACAO_EDITAL) antes de ler.';

-- 3. As duas RPCs -----------------------------------------------------------------------------
create or replace function public.obter_fila_avaliacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  return private."FC_FILA_AVALIACAO_JSON"(p_edital, null);
end;
$function$;

-- json (não jsonb): as linhas seguem no texto compacto de FC_LINHAS_DA_FILA.
create or replace function public.obter_fila_avaliacao_desde(
  p_edital uuid,
  p_desde timestamptz default null,
  p_marca text default null
)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_parcial boolean := p_desde is not null and p_marca is not null;
  v_ids uuid[];
  v json;
  v_marca text;
begin
  if v_parcial then
    -- As fichas que mudaram desde a leitura anterior (a margem de 2 min cobre as transações
    -- que gravaram com now() anterior à leitura e terminaram depois dela).
    select coalesce(array_agg(f."CO_EMPREGARE_CANDIDATO"), '{}'::uuid[])
      into v_ids
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = p_edital
       and (f."DT_ATUALIZACAO" >= p_desde - interval '2 minutes'
            or f."DT_RESERVA_EXPIRA" >= p_desde - interval '2 minutes');
  end if;

  -- A permissão, a área e o recorte do analista são os da fila de sempre (conferidos lá dentro,
  -- antes de qualquer linha). Parcial: só as linhas desses inscritos e o total do núcleo.
  v := private."FC_FILA_AVALIACAO_JSON"(p_edital, v_ids);
  if v is null then
    return null;
  end if;

  select md5(concat_ws('|', count(*), max(a."DT_ATUALIZACAO"), max(a."CO_EXECUCAO"),
                       v ->> 'eu', v ->> 'papel', (v -> 'vagas')::text))
    into v_marca
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital;

  if v_parcial and p_marca <> v_marca then
    -- Outra marca (pré-classificação regravada, outro recorte, papel ou pessoa): a inteira.
    -- Mesmo instantâneo (função stable), então a marca não muda.
    v := private."FC_FILA_AVALIACAO_JSON"(p_edital, null);
    v_parcial := false;
  end if;

  if not v_parcial then
    return (
      select json_object_agg(x.k, x.v order by x.o)
        from (select t.k, t.v, t.o from json_each(v) with ordinality t(k, v, o)
              union all select 'marca', to_json(v_marca), 100000
              union all select 'parcial', to_json(false), 100001) x);
  end if;

  return (
    select json_object_agg(x.k, x.v order by x.o)
      from (select t.k, t.v, t.o
              from json_each(v) with ordinality t(k, v, o)
             where t.k not in ('candidatos', 'vagas', 'total_nucleo')
            union all select 'marca', to_json(v_marca), 100000
            union all select 'parcial', to_json(true), 100001
            union all select 'total_nucleo', v -> 'total_nucleo', 100002
            union all select 'candidatos', v -> 'candidatos', 100003
            union all
            select 'saiu', coalesce((
                     select json_agg(i)
                       from unnest(v_ids) i
                      where not exists (select 1 from json_array_elements(v -> 'candidatos') e
                                         where (e ->> 'id')::uuid = i)), '[]'::json), 100004) x);
end;
$function$;

comment on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) is
  'obter_fila_avaliacao só com o que mudou (20261014231000; sem montar a fila inteira desde 20261019150000): sem p_desde ou com outra marca, a fila inteira com marca e parcial false; com o gerado_em e a marca da leitura anterior, só as linhas do núcleo cuja ficha mudou (ou cuja reserva vence) desde p_desde − 2 min, os ids que saíram do núcleo (saiu), total_nucleo e o resto da fila sem vagas. Mesma permissão.';

-- 4. As contagens da fila pelo índice, sem ler as linhas largas da pré-classificação ---------
create index if not exists "IN_PRECLASSIF_FILA"
  on public."TB_PRE_CLASSIFICACAO" ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO")
  include ("CO_VAGA", "TP_SITUACAO", "NO_MODALIDADE", "DT_ATUALIZACAO", "CO_EXECUCAO");

comment on index public."IN_PRECLASSIF_FILA" is
  'Fila da avaliação documental (20261019150000): a marca, sem_ficha, fora_do_lote e total_nucleo leem só o índice (index-only scan) em vez das linhas largas da pré-classificação.';

notify pgrst, 'reload schema';

commit;
