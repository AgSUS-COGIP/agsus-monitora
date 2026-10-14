/*
  AVALIAÇÃO DOCUMENTAL E CLASSIFICAÇÃO: LEITURA POR VERSÃO (MENOS EGRESS)

  Por quê: o plano gratuito do Supabase chegou a 85% do egress do ciclo
  (5 GB/mês) em 14/10, com ~250 MB/dia, e ~10 avaliadores começam a Avaliação
  documental do 114/2026 em 15/10. Medido em 14/10 (bytes do JSON por chamada,
  114/2026, como usuário):
    obter_pre_classificacao        4.517.844  (7.327 inscritos, 5.576 eliminados;
                                               99% é "candidatos", com ~250
                                               bytes só de nomes de chave por linha)
    obter_classificacao_do_edital    850.536
    obter_regra_analise              476.764  (372 KB são "versoes": a configuração
                                               inteira de cada versão)
  As três eram relidas inteiras a cada abertura da tela, "Atualizar" e, na
  pré-classificação, a cada 15 s enquanto o "Recalcular" rodava (4,3 MB por
  volta), sem que nada tivesse mudado.

  O QUE ENTRA (só funções novas; nenhuma função de hoje muda)
    private."FC_COLUNAS_JSON"(p_linhas, p_dicionario)
        uma lista de objetos em colunas: { colunas, dicionarios, linhas } — os
        nomes das chaves uma vez só e, nas colunas do dicionário (poucos valores
        repetidos: vaga, situação, motivo…), o índice do valor. A tela
        (src/lib/avaliacao-documental/leitura-por-versao.ts, linhasDoPacote)
        refaz os mesmos objetos, com as chaves nulas. Montada como texto json
        (o jsonb poria ", " entre os valores).
    private."FC_SE_MUDOU_EM_COLUNAS"(p_payload, p_versao, p_campo, p_dicionario)
        o FC_SE_MUDOU (mesma versão: md5 sem gerado_em) com p_campo em colunas;
        a conversão só roda quando a versão mudou.
    public.obter_pre_classificacao_se_mudou(p_edital, p_versao)
    public.obter_classificacao_do_edital_se_mudou(p_edital, p_versao)
        o payload de sempre com "candidatos" em colunas
        ("candidatos_em_colunas") e a "versao" (md5 do payload original sem
        gerado_em); com p_versao = a versão atual, só { inalterado, versao }.
    public.obter_regra_analise_se_mudou(p_edital, p_versao)
        obter_regra_analise com a versão (private."FC_SE_MUDOU", 20261013190000).
    public.obter_situacao_pre_classificacao(p_edital)
        só em_andamento e ultima_execucao (as mesmas chaves de
        obter_pre_classificacao): o acompanhamento do "Recalcular" pergunta isto
        a cada 15 s e relê o pacote grande só quando a execução termina.

  POR QUE FUNÇÕES NOVAS, E NÃO UM PARÂMETRO A MAIS NAS DE HOJE
    O mesmo de 20261013160000: as novas chamam a função de sempre (permissão,
    área, recorte e conteúdo continuam os dela), quem mexer nela não cria
    sobrecarga e a mudança chega aqui sozinha. O front de hoje continua
    chamando as antigas e funciona igual com esta migration aplicada; o front
    novo cai nas antigas enquanto ela não estiver aplicada (PGRST202).
    As de "se mudou" são SECURITY INVOKER; a de situação é DEFINER (lê
    TL_PRE_CLASSIFICACAO) e confere a permissão como obter_pre_classificacao.

  MEDIDO NO ENSAIO (114/2026, bytes do JSON; begin … rollback)
    obter_pre_classificacao          4.582.329 → 1.129.594 cheio · 66 inalterado
    obter_classificacao_do_edital      850.536 →   235.400 cheio · 66 inalterado
    obter_regra_analise                476.764 →   476.604 cheio · 66 inalterado
    acompanhamento do Recalcular     4.582.329 + 38.416 por volta → 339
  Os objetos refeitos das colunas são iguais aos de sempre, um a um (ensaio).

  CUSTO NO BANCO
    O servidor ainda monta o payload a cada chamada (CPU de antes) para tirar o
    md5 (pré-classificação: ~0,5 s inalterada; ~1,5 s com a conversão em
    colunas, que só roda quando a versão mudou).

  Ensaio: supabase/ensaios/20261014230000_avaliacao_leitura_por_versao.sql
  Rollback: supabase/rollback/20261014230000_avaliacao_leitura_por_versao.sql
*/
begin;

set local lock_timeout = '10s';

-- 1. Uma lista de objetos em colunas ----------------------------------------------------
-- Montada como texto: o jsonb escreveria ", " entre os valores de cada linha (≈13% a mais
-- nos 7.327 inscritos do 114/2026).
create or replace function private."FC_COLUNAS_JSON"(p_linhas jsonb, p_dicionario text[] default '{}'::text[])
returns json
language sql
immutable
parallel safe
set search_path to ''
as $function$
  with l as (
    select t.e, t.o
      from jsonb_array_elements(case when jsonb_typeof(p_linhas) = 'array' then p_linhas else '[]'::jsonb end)
           with ordinality t(e, o)
     where jsonb_typeof(t.e) = 'object'
  ),
  c as (
    select coalesce(array_agg(x.k order by x.k), '{}'::text[]) as colunas
      from (select distinct jsonb_object_keys(l.e) as k from l) x
  ),
  d as (
    -- Os valores distintos de cada coluna do dicionário (o nulo também é um valor).
    select x.k, array_agg(x.v order by x.v) as valores
      from (select distinct u.k, coalesce(l.e -> u.k, 'null'::jsonb) as v
              from l, c, unnest(c.colunas) u(k)
             where u.k = any (coalesce(p_dicionario, '{}'::text[]))) x
     group by x.k
  )
  select json_build_object(
           'colunas', array_to_json(c.colunas),
           'dicionarios', coalesce((select json_object_agg(d.k, array_to_json(d.valores)) from d), '{}'::json),
           'linhas', ('[' || coalesce((
             select string_agg(
                      '[' || coalesce((
                        select string_agg(
                                 case when d.k is null then coalesce(l.e -> u.k, 'null'::jsonb)::text
                                      else (array_position(d.valores, coalesce(l.e -> u.k, 'null'::jsonb)) - 1)::text
                                 end, ',' order by u.n)
                          from unnest(c.colunas) with ordinality u(k, n)
                          left join d on d.k = u.k), '') || ']',
                      ',' order by l.o)
               from l), '') || ']')::json)
    from c;
$function$;

comment on function private."FC_COLUNAS_JSON"(jsonb, text[]) is
  'Uma lista de objetos em colunas (20261014230000): { colunas: [chaves em ordem], dicionarios: { coluna: [valores distintos] }, linhas: [[valor ou índice no dicionário, na ordem das colunas]] }. A tela refaz os objetos com linhasDoPacote (src/lib/avaliacao-documental/leitura-por-versao.ts).';

revoke all on function private."FC_COLUNAS_JSON"(jsonb, text[]) from public, anon;
grant execute on function private."FC_COLUNAS_JSON"(jsonb, text[]) to authenticated, service_role;

-- 2. O payload por versão, com uma lista em colunas -------------------------------------
create or replace function private."FC_SE_MUDOU_EM_COLUNAS"(
  p_payload jsonb, p_versao text, p_campo text, p_dicionario text[])
returns json
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_versao text;
begin
  if p_payload is null then
    return null;
  end if;
  -- A versão é a do payload de sempre (a mesma conta de private."FC_SE_MUDOU"): a conversão
  -- em colunas só roda quando ela mudou.
  v_versao := md5((p_payload - array['gerado_em', 'generated_at', 'cache']::text[])::text);
  if p_versao is not null and p_versao = v_versao then
    return json_build_object('inalterado', true, 'versao', v_versao);
  end if;
  return (
    select json_object_agg(x.k, x.v)
      from (select e.key as k, e.value::json as v from jsonb_each(p_payload - p_campo) e
            union all
            select p_campo || '_em_colunas', private."FC_COLUNAS_JSON"(p_payload -> p_campo, p_dicionario)
            union all
            select 'versao', to_json(v_versao)) x);
end;
$function$;

comment on function private."FC_SE_MUDOU_EM_COLUNAS"(jsonb, text, text, text[]) is
  'O payload com versao (md5 sem gerado_em, generated_at e cache) e o campo p_campo em colunas (<campo>_em_colunas, FC_COLUNAS_JSON), ou só { inalterado, versao } quando p_versao é a atual (20261014230000).';

revoke all on function private."FC_SE_MUDOU_EM_COLUNAS"(jsonb, text, text, text[]) from public, anon;
grant execute on function private."FC_SE_MUDOU_EM_COLUNAS"(jsonb, text, text, text[]) to authenticated, service_role;

-- 3. Pré-classificação e Classificação do edital por versão, as listas em colunas ---------
create or replace function public.obter_pre_classificacao_se_mudou(p_edital uuid, p_versao text default null)
returns json
language sql
stable
security invoker
set search_path to ''
as $function$
  select private."FC_SE_MUDOU_EM_COLUNAS"(public.obter_pre_classificacao(p_edital)::jsonb, p_versao, 'candidatos', array[
    'vaga', 'situacao', 'motivo_codigo', 'motivo', 'origem_nota', 'divergente', 'modalidade',
    'declarada_completa', 'lista_lote', 'entrada', 'motivo_entrada', 'entrada_em', 'congelada_em',
    'lote', 'decisao']);
$function$;

comment on function public.obter_pre_classificacao_se_mudou(uuid, text) is
  'obter_pre_classificacao com versão (md5 sem gerado_em) e os inscritos em colunas (candidatos_em_colunas, FC_COLUNAS_JSON); com p_versao atual, só { inalterado, versao } (20261014230000). Mesma permissão.';

create or replace function public.obter_classificacao_do_edital_se_mudou(p_edital uuid, p_versao text default null)
returns json
language sql
stable
security invoker
set search_path to ''
as $function$
  select private."FC_SE_MUDOU_EM_COLUNAS"(public.obter_classificacao_do_edital(p_edital)::jsonb, p_versao, 'candidatos', array[
    'vaga', 'cargo', 'categoria', 'modalidade', 'pcd', 'status', 'etapa', 'quadro', 'hora_nascimento',
    'pontuacao_etnica']);
$function$;

comment on function public.obter_classificacao_do_edital_se_mudou(uuid, text) is
  'obter_classificacao_do_edital com versão (md5 sem gerado_em) e os candidatos em colunas (candidatos_em_colunas, FC_COLUNAS_JSON); com p_versao atual, só { inalterado, versao } (20261014230000). Mesma permissão.';

-- 4. Regra da avaliação por versão ---------------------------------------------------------
create or replace function public.obter_regra_analise_se_mudou(p_edital uuid, p_versao text default null)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $function$
  select private."FC_SE_MUDOU"(public.obter_regra_analise(p_edital)::jsonb, p_versao);
$function$;

comment on function public.obter_regra_analise_se_mudou(uuid, text) is
  'obter_regra_analise com versão (private.FC_SE_MUDOU): a tela revalida a regra guardada sem baixar as versões (≈0,5 MB) quando nada mudou (20261014230000). Mesma permissão.';

-- 5. A situação da execução da pré-classificação (o acompanhamento do Recalcular) ----------
create or replace function public.obter_situacao_pre_classificacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
begin
  -- As mesmas chaves (e o mesmo cálculo) de obter_pre_classificacao.
  return json_build_object(
    'em_andamento', exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
                             where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour'),
    'ultima_execucao', (
      select json_build_object('id', t."CO_EXECUCAO", 'inicio', t."DT_INICIO", 'fim', t."DT_FIM", 'situacao', t."TP_SITUACAO",
                               'disparo', t."TP_DISPARO", 'refazer', t."ST_REFAZER_LOTE" = 'S', 'mensagem', t."DS_MENSAGEM",
                               'execucao', t."DS_URL_EXECUCAO")
        from public."TL_PRE_CLASSIFICACAO" t
       where t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', p_edital::text))
       order by t."DT_INICIO" desc limit 1));
end;
$function$;

comment on function public.obter_situacao_pre_classificacao(uuid) is
  'Só em_andamento e ultima_execucao da pré-classificação do edital (as chaves de obter_pre_classificacao, ≈0,4 KB): o acompanhamento do Recalcular pergunta a cada 15 s e relê o pacote só no fim (20261014230000). Leitor da Avaliação documental.';

-- 6. Quem pode chamar ----------------------------------------------------------------------
revoke all on function public.obter_pre_classificacao_se_mudou(uuid, text) from public, anon;
revoke all on function public.obter_classificacao_do_edital_se_mudou(uuid, text) from public, anon;
revoke all on function public.obter_regra_analise_se_mudou(uuid, text) from public, anon;
revoke all on function public.obter_situacao_pre_classificacao(uuid) from public, anon;

grant execute on function public.obter_pre_classificacao_se_mudou(uuid, text) to authenticated;
grant execute on function public.obter_classificacao_do_edital_se_mudou(uuid, text) to authenticated, service_role;
grant execute on function public.obter_regra_analise_se_mudou(uuid, text) to authenticated, service_role;
grant execute on function public.obter_situacao_pre_classificacao(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
