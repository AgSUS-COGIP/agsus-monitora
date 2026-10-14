/*
  AVALIAÇÃO DOCUMENTAL: A FILA E A FICHA SÓ COM O QUE MUDOU (MENOS EGRESS)

  Por quê: com a fila leve (20261014180000), obter_fila_avaliacao ainda manda
  o núcleo inteiro (114/2026: 1.342 linhas, 441.924 bytes) a cada releitura, e
  a tela relia a fila duas vezes por ficha concluída ("Concluir e próxima":
  liberar + pegar). Com ~10 avaliadores e ~400 fichas por dia, só isso daria
  ~350 MB/dia de egress, num plano de 5 GB/mês. E obter_ficha_analise
  (≈41 KB) manda em toda ficha a configuração da regra (≈29 KB), igual em
  todas as fichas da mesma versão.

  O QUE ENTRA (só funções novas; nenhuma função de hoje muda)
    public.obter_fila_avaliacao_desde(p_edital, p_desde, p_marca)
        sem p_desde (ou com outra marca): obter_fila_avaliacao inteira, com
        "marca" e "parcial": false. Com o gerado_em da leitura anterior em
        p_desde e a marca dela: só as linhas do núcleo cuja ficha mudou desde
        p_desde − 2 min (DT_ATUALIZACAO, que toda RPC que grava a ficha
        atualiza) ou cuja reserva vence depois disso (renovar_reserva só
        estica DT_RESERVA_EXPIRA; reserva vencida desde então sai da linha), os
        ids que mudaram e saíram do núcleo ("saiu") e quantas linhas o núcleo
        tem ("total_nucleo"); sem "vagas" (estão na marca). A tela junta
        (src/lib/avaliacao-documental/fila-por-mudancas.ts) e, se algo não
        bater (linha nova, total diferente), lê inteira.
        A marca muda quando a pré-classificação do edital é regravada (job,
        decisão da coordenação, descongelar), quando muda o recorte de vagas de
        quem lê, o papel ou a pessoa: aí volta a fila inteira.
        A margem de 2 min cobre as transações que gravaram com now() anterior à
        leitura e terminaram depois dela (o authenticated tem statement_timeout
        de 8 s); as linhas repetidas não fazem mal.
    public.obter_ficha_analise_leve(p_ficha, p_regra_chave)
        obter_ficha_analise com regra.chave (md5 da configuração); quando
        p_regra_chave é essa chave, regra.configuracao vem null e
        regra_omitida: true (a tela usa a configuração que guardou com a
        chave). O resto vem como json, na ordem de sempre.

  MEDIDO NO ENSAIO (114/2026, bytes do JSON; begin … rollback)
    fila inteira (primeira leitura)     441.924 → 442.002 (json, sem espaços a mais)
    fila parcial, nada mudou                    →   1.430
    fila parcial, 3 fichas mudaram              →   2.756 (a junção = a fila inteira)
    obter_ficha_analise                  40.310 →  11.078 com a chave da regra

  Permissão: a das funções de sempre (as novas chamam obter_fila_avaliacao e
  obter_ficha_analise primeiro). obter_fila_avaliacao_desde é DEFINER para ler
  TB_PRE_CLASSIFICACAO e TB_FICHA_ANALISE (a marca e as fichas que mudaram).
  O front de hoje não chama nenhuma das duas e segue igual com a migration
  aplicada; o front novo cai nas de sempre enquanto ela não estiver (PGRST202).

  Ensaio: supabase/ensaios/20261014231000_fila_e_ficha_so_o_que_mudou.sql
  Rollback: supabase/rollback/20261014231000_fila_e_ficha_so_o_que_mudou.sql
*/
begin;

set local lock_timeout = '10s';

-- 1. A fila só com o que mudou ----------------------------------------------------------
-- json (não jsonb): as linhas seguem no texto compacto de FC_LINHAS_DA_FILA (o jsonb
-- escreveria espaços: +9% na fila inteira).
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
  -- Primeiro a fila de sempre: a permissão, a área e o recorte do analista são os dela.
  v json := public.obter_fila_avaliacao(p_edital);
  v_marca text;
  v_ids uuid[];
begin
  if v is null then
    return null;
  end if;
  select md5(concat_ws('|', count(*), max(a."DT_ATUALIZACAO"), max(a."CO_EXECUCAO"),
                       v ->> 'eu', v ->> 'papel', (v -> 'vagas')::text))
    into v_marca
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital;

  if p_desde is null or p_marca is null or p_marca <> v_marca then
    return (
      select json_object_agg(x.k, x.v order by x.o)
        from (select t.k, t.v, t.o from json_each(v) with ordinality t(k, v, o)
              union all select 'marca', to_json(v_marca), 100000
              union all select 'parcial', to_json(false), 100001) x);
  end if;

  select coalesce(array_agg(f."CO_EMPREGARE_CANDIDATO"), '{}'::uuid[])
    into v_ids
    from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = p_edital
     and (f."DT_ATUALIZACAO" >= p_desde - interval '2 minutes'
          or f."DT_RESERVA_EXPIRA" >= p_desde - interval '2 minutes');

  return (
    select json_object_agg(x.k, x.v order by x.o)
      from (select t.k, t.v, t.o
              from json_each(v) with ordinality t(k, v, o)
             where t.k not in ('candidatos', 'vagas')
            union all select 'marca', to_json(v_marca), 100000
            union all select 'parcial', to_json(true), 100001
            union all select 'total_nucleo', to_json(coalesce(json_array_length(v -> 'candidatos'), 0)), 100002
            union all
            select 'candidatos', coalesce((
                     select json_agg(e.linha order by e.o)
                       from json_array_elements(coalesce(v -> 'candidatos', '[]'::json)) with ordinality e(linha, o)
                      where (e.linha ->> 'id')::uuid = any (v_ids)), '[]'::json), 100003
            union all
            select 'saiu', coalesce((
                     select json_agg(i)
                       from unnest(v_ids) i
                      where not exists (select 1 from json_array_elements(coalesce(v -> 'candidatos', '[]'::json)) e
                                         where (e ->> 'id')::uuid = i)), '[]'::json), 100004) x);
end;
$function$;

comment on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) is
  'obter_fila_avaliacao só com o que mudou (20261014231000): sem p_desde ou com outra marca, a fila inteira com marca e parcial false; com o gerado_em e a marca da leitura anterior, só as linhas do núcleo cuja ficha mudou (ou cuja reserva vence) desde p_desde − 2 min, os ids que saíram do núcleo (saiu), total_nucleo e o resto da fila sem vagas. Mesma permissão.';

-- 2. A ficha sem a configuração da regra que a tela já tem ------------------------------
create or replace function public.obter_ficha_analise_leve(p_ficha uuid, p_regra_chave text default null)
returns json
language plpgsql
stable
security invoker
set search_path to ''
as $function$
declare
  v json := public.obter_ficha_analise(p_ficha);
  v_chave text;
  v_omitir boolean;
begin
  if v is null or json_typeof(v -> 'regra') is distinct from 'object' then
    return v;
  end if;
  v_chave := md5(coalesce((v -> 'regra' -> 'configuracao')::text, 'null'));
  v_omitir := p_regra_chave is not null and p_regra_chave = v_chave;
  -- json (não jsonb): as chaves seguem na ordem de sempre.
  return (
    select json_object_agg(x.k, x.v order by x.o)
      from (
        select t.k,
               case when t.k <> 'regra' then t.v
                    else (select json_object_agg(r.k, r.v order by r.o)
                            from (select rr.k, case when rr.k = 'configuracao' and v_omitir then null::json else rr.v end as v, rr.o
                                    from json_each(t.v) with ordinality rr(k, v, o)
                                  union all
                                  select 'chave', to_json(v_chave), 100000) r)
               end as v,
               t.o
          from json_each(v) with ordinality t(k, v, o)
        union all
        select 'regra_omitida', to_json(v_omitir), 100000
      ) x);
end;
$function$;

comment on function public.obter_ficha_analise_leve(uuid, text) is
  'obter_ficha_analise com regra.chave (md5 da configuração); com p_regra_chave igual, regra.configuracao vem null e regra_omitida true: a tela usa a que já guardou (≈29 KB a menos por ficha; 20261014231000). Mesma permissão.';

-- 3. Quem pode chamar ------------------------------------------------------------------------
revoke all on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) from public, anon;
revoke all on function public.obter_ficha_analise_leve(uuid, text) from public, anon;
grant execute on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) to authenticated;
grant execute on function public.obter_ficha_analise_leve(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
