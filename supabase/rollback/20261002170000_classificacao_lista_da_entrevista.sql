/*
  Desfaz 20261002170000_classificacao_lista_da_entrevista.sql: volta o CHECK e
  o RPC a PRELIMINAR, CONVOCACAO e FINAL e tira do catálogo os quatro critérios
  acrescentados. Recusa se já houver lista ENTREVISTA registrada ou regra que
  use um dos critérios novos (o histórico não é apagado).
*/
begin;

do $$
begin
  if exists (select 1 from public."TB_LISTA_CLASSIFICACAO" where "TP_LISTA" = 'ENTREVISTA') then
    raise exception 'Há lista ENTREVISTA registrada; o rollback não apaga histórico.';
  end if;
  if exists (select 1 from public."RL_REGRA_CRITERIO_DESEMPATE"
              where "CO_CRITERIO" in ('EXP_ALTA_COMPLEXIDADE', 'EXP_SAUDE_DIGITAL', 'MAIOR_ESCOLARIDADE', 'NOTA_CONHECIMENTOS_ESPECIFICOS')) then
    raise exception 'Há regra usando os critérios novos; desfaça antes o seed das regras (supabase/rollback/20261002-regras-de-classificacao-todos-os-editais.sql).';
  end if;
end;
$$;

alter table public."TB_LISTA_CLASSIFICACAO" drop constraint "CK_LISTACLASSIF_TPLISTA";
alter table public."TB_LISTA_CLASSIFICACAO"
  add constraint "CK_LISTACLASSIF_TPLISTA" check ("TP_LISTA" in ('PRELIMINAR', 'CONVOCACAO', 'FINAL'));
comment on constraint "CK_LISTACLASSIF_TPLISTA" on public."TB_LISTA_CLASSIFICACAO" is 'Tipos de lista válidos.';
comment on column public."TB_LISTA_CLASSIFICACAO"."TP_LISTA" is 'PRELIMINAR (avaliação documental), CONVOCACAO (para entrevista) ou FINAL (resultado final).';

delete from public."TB_CRITERIO_CLASSIFICACAO"
 where "CO_CRITERIO" in ('EXP_ALTA_COMPLEXIDADE', 'EXP_SAUDE_DIGITAL', 'MAIOR_ESCOLARIDADE', 'NOTA_CONHECIMENTOS_ESPECIFICOS');

create or replace function public.registrar_lista_classificacao(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_id uuid;
  v_totais jsonb := coalesce(p_resultado -> 'totais', '{}'::jsonb);
  v_qt integer[];
begin
  if p_tipo is null or p_tipo not in ('PRELIMINAR', 'CONVOCACAO', 'FINAL') then
    raise exception 'Tipo de lista inválido' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Salve a regra do edital antes de gerar a lista.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
  end if;
  if jsonb_typeof(p_resultado) is distinct from 'object' or jsonb_typeof(p_resultado -> 'vagas') is distinct from 'array'
     or p_resultado ->> 'tipo' is distinct from p_tipo then
    raise exception 'Lista inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_resultado) > 8000000 then
    raise exception 'Lista grande demais para registrar.' using errcode = '22023';
  end if;
  select array_agg(case when jsonb_typeof(v_totais -> k) = 'number'
                        then greatest(0, least(1000000, (v_totais ->> k)::numeric))::integer else 0 end order by o)
    into v_qt
    from unnest(array['elegiveis', 'eliminados', 'avisos', 'pendencias']) with ordinality t(k, o);

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", p_resultado,
          encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex'),
          v_qt[1], v_qt[2], v_qt[3], v_qt[4], (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return private."FC_LISTA_CLASSIFICACAO_JSON"(v_id);
end;
$function$;
comment on function public.registrar_lista_classificacao(uuid, text, integer, jsonb) is
  'Registra uma lista gerada (PRELIMINAR, CONVOCACAO ou FINAL): retrato, versão da regra (tem de ser a vigente, senão 40001), quem, quando e o hash SHA-256 calculado aqui. Exige classificacao >= editor, a área e o recorte da coordenação.';
revoke all on function public.registrar_lista_classificacao(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.registrar_lista_classificacao(uuid, text, integer, jsonb) to authenticated, service_role;

commit;
