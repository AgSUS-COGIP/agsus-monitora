/*
  Rollback de 20261022181000_fila_confere_a_marca_antes_de_montar.sql:
  obter_fila_avaliacao_desde volta à definição de 20261019150000 (a marca
  depois da parcial). Mesma assinatura, mesmos grants.
*/
begin;

CREATE OR REPLACE FUNCTION public.obter_fila_avaliacao_desde(p_edital uuid, p_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, p_marca text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

commit;
