/*
  A FILA CONFERE A MARCA ANTES DE MONTAR

  Por quê: obter_fila_avaliacao_desde (20261019150000) montava a fila parcial
  (private."FC_FILA_AVALIACAO_JSON" com os ids que mudaram) e só depois
  calculava a marca; com outra marca (pré-classificação regravada, outro
  recorte, papel ou pessoa), jogava a parcial fora e montava a inteira: duas
  montagens na mesma chamada. Medido no banco em 22/10/2026 (begin … rollback,
  conta do setor, 114/2026, 5 rodadas): parcial ~28 ms; inteira 100–350 ms
  (1,3 s a frio).

  Os 974 ms de média de pg_stat_statements (1.118 chamadas desde 14/10) são,
  em boa parte, de antes de 20261019150000 (a parcial montava a fila inteira) e
  dos dias de banco saturado; não há índice que falte: a parcial lê
  TB_FICHA_ANALISE pelo edital (~2,1 mil fichas) e TB_PRE_CLASSIFICACAO pela
  chave.

  O QUE MUDA (mesmo contrato: mesmas chaves, mesmos valores, mesma marca)
    A marca é calculada primeiro, com os mesmos ingredientes (contagem, última
    atualização e execução da pré-classificação, quem lê, papel e as vagas do
    recorte, no mesmo JSON da chave "vagas"); com outra marca, a fila inteira
    é montada uma vez só. A permissão é conferida antes de qualquer leitura
    (private."FC_EXIGIR_AVALIACAO_EDITAL", como dentro da montagem).

  Dependentes: private."FC_FILA_AVALIACAO_JSON", private."FC_PAPEL_AVALIACAO",
  private."FC_VAGAS_DO_ANALISTA", private."FC_EXIGIR_AVALIACAO_EDITAL".
  Ensaio: supabase/ensaios/20261022161000_fila_confere_a_marca_antes_de_montar.sql
  Rollback: supabase/rollback/20261022161000_fila_confere_a_marca_antes_de_montar.sql
*/
begin;

create or replace function public.obter_fila_avaliacao_desde(
  p_edital uuid, p_desde timestamptz default null, p_marca text default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parcial boolean := p_desde is not null and p_marca is not null;
  v_uid uuid := (select auth.uid());
  v_papel text;
  v_vagas text[];
  v_vagas_json json;
  v_ids uuid[];
  v json;
  v_marca text;
begin
  -- A permissão primeiro (a montagem confere de novo, lá dentro).
  perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);

  -- A marca, com o que a montagem usaria: papel, recorte de vagas do analista e as vagas
  -- no mesmo JSON da chave "vagas" (a marca não muda com esta migration).
  v_papel := private."FC_PAPEL_AVALIACAO"(p_edital);
  if coalesce(v_papel, '') = 'ANALISTA' then
    v_vagas := private."FC_VAGAS_DO_ANALISTA"(p_edital, v_uid);
  end if;
  v_vagas_json := coalesce((
    select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO")
                    order by pv."CO_VAGA")
      from public."TB_PRE_CLASSIF_VAGA" pv
     where pv."CO_MONITORAMENTO" = p_edital
       and (v_vagas is null or pv."CO_VAGA" = any (v_vagas))), '[]'::json);
  select md5(concat_ws('|', count(*), max(a."DT_ATUALIZACAO"), max(a."CO_EXECUCAO"),
                       v_uid::text, v_papel, v_vagas_json::text))
    into v_marca
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital;

  -- Outra marca (pré-classificação regravada, outro recorte, papel ou pessoa): a inteira.
  if v_parcial and p_marca <> v_marca then
    v_parcial := false;
  end if;

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

  -- Parcial: só as linhas desses inscritos e o total do núcleo; senão, a fila inteira.
  v := private."FC_FILA_AVALIACAO_JSON"(p_edital, case when v_parcial then v_ids end);
  if v is null then
    return null;
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
$$;

comment on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) is
  'obter_fila_avaliacao só com o que mudou (20261014231000; sem montar a fila inteira desde 20261019150000; marca conferida antes de montar desde 20261022161000): sem p_desde ou com outra marca, a fila inteira com marca e parcial false; com o gerado_em e a marca da leitura anterior, só as linhas do núcleo cuja ficha mudou (ou cuja reserva vence) desde p_desde − 2 min, os ids que saíram do núcleo (saiu), total_nucleo e o resto da fila sem vagas. Mesma permissão.';

revoke all on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) from public, anon;
grant execute on function public.obter_fila_avaliacao_desde(uuid, timestamptz, text) to authenticated;

commit;
