/*
  Ensaio de 20261019120000_modelo_do_espelho_de_nota.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash), no banco novo:
    source qn.sh
    qn "begin;
    $(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/migrations/20261019120000_modelo_do_espelho_de_nota.sql)
    $(cat supabase/ensaios/20261019120000_modelo_do_espelho_de_nota.sql)
    rollback;"

  No 114/2026 (bcecfb08-…), como a conta do setor (a01afddb-…, coordena) e como
  uma analista da equipe (523fa56e-…, papel ANALISTA): ler sem modelo (versão 0),
  salvar a primeira versão, recusar a versão velha (PT409), recusar textos
  inválidos (22023), "Restaurar padrão" (RESTAURAR, {}), a analista lê
  (pode_editar falso) e não salva (42501). Tudo é desfeito no rollback.

  Espera-se: todas as linhas de ensaio_resultado com ok = true.
*/
create temporary table ensaio_resultado (passo text, ok boolean, detalhe text) on commit drop;
grant insert, select on ensaio_resultado to authenticated;

-- Como a conta do setor (coordena o 114).
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

do $ensaio$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_r json;
  v_estado text;
  v_msg text;
begin
  v_r := public.obter_modelo_espelho_nota(v_edital);
  insert into ensaio_resultado values ('ler sem modelo: versão 0, textos {}, pode editar',
    (v_r ->> 'versao')::int = 0 and (v_r -> 'textos')::jsonb = '{}'::jsonb and (v_r ->> 'pode_editar')::boolean,
    v_r::text);

  v_r := public.salvar_modelo_espelho_nota(v_edital,
    '{"titulo": "Espelho da Análise Curricular", "saudacao": "Olá, {candidato}.", "mostrar_autodeclarada": false}', 0);
  insert into ensaio_resultado values ('salvar a primeira versão',
    (v_r ->> 'versao')::int = 1 and (v_r -> 'textos' ->> 'titulo') = 'Espelho da Análise Curricular'
      and (v_r -> 'textos' ->> 'mostrar_autodeclarada') = 'false' and v_r ->> 'atualizado_por' is not null,
    v_r::text);

  begin
    perform public.salvar_modelo_espelho_nota(v_edital, '{"titulo": "Outro"}', 0);
    insert into ensaio_resultado values ('versão velha: PT409', false, 'não recusou');
  exception when others then
    get stacked diagnostics v_estado = returned_sqlstate, v_msg = message_text;
    insert into ensaio_resultado values ('versão velha: PT409', v_estado = 'PT409', v_estado || ' ' || v_msg);
  end;

  -- Textos inválidos: cada um recusado com 22023.
  for v_msg in select unnest(array[
    '{"campo_novo": "x"}', '{"titulo": ""}', '{"titulo": 3}', '{"saudacao": "Prezado(a),"}',
    '{"rodape": "Até {data}"}', '{"titulo": "Espelho de {candidato}"}', '{"mostrar_autodeclarada": "sim"}',
    '[]', '{"secao_notas": "' || repeat('x', 121) || '"}'])
  loop
    begin
      perform public.salvar_modelo_espelho_nota(v_edital, v_msg::jsonb, 1);
      insert into ensaio_resultado values ('inválido: ' || left(v_msg, 40), false, 'não recusou');
    exception when others then
      get stacked diagnostics v_estado = returned_sqlstate;
      insert into ensaio_resultado values ('inválido: ' || left(v_msg, 40), v_estado = '22023', v_estado || ' ' || sqlerrm);
    end;
  end loop;

  -- Vazio só onde pode: subtítulo, abertura e rodapé.
  v_r := public.salvar_modelo_espelho_nota(v_edital,
    '{"subtitulo": "", "abertura": "", "rodape": "", "saudacao": "Prezado(a) {candidato},"}', 1);
  insert into ensaio_resultado values ('vazio em subtítulo, abertura e rodapé', (v_r ->> 'versao')::int = 2, v_r::text);

  begin
    perform public.salvar_modelo_espelho_nota(v_edital,
      '{"subtitulo": "", "abertura": "", "rodape": "", "saudacao": "Prezado(a) {candidato},"}', 2);
    insert into ensaio_resultado values ('sem mudança: 22023', false, 'não recusou');
  exception when others then
    get stacked diagnostics v_estado = returned_sqlstate;
    insert into ensaio_resultado values ('sem mudança: 22023', v_estado = '22023', v_estado || ' ' || sqlerrm);
  end;

  v_r := public.salvar_modelo_espelho_nota(v_edital, '{}', 2);
  insert into ensaio_resultado values ('restaurar padrão: versão 3, {}',
    (v_r ->> 'versao')::int = 3 and (v_r -> 'textos')::jsonb = '{}'::jsonb, v_r::text);
end;
$ensaio$;

-- Como uma analista da equipe do 114 (não coordena).
select set_config('request.jwt.claims',
  '{"sub":"523fa56e-f38e-4c08-9a89-849ddc955650","role":"authenticated"}', true);

do $ensaio$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_r json;
  v_estado text;
begin
  v_r := public.obter_modelo_espelho_nota(v_edital);
  insert into ensaio_resultado values ('analista lê: versão 3, não edita',
    (v_r ->> 'versao')::int = 3 and not (v_r ->> 'pode_editar')::boolean, v_r::text);
  begin
    perform public.salvar_modelo_espelho_nota(v_edital, '{"titulo": "Da analista"}', 3);
    insert into ensaio_resultado values ('analista não salva: 42501', false, 'não recusou');
  exception when others then
    get stacked diagnostics v_estado = returned_sqlstate;
    insert into ensaio_resultado values ('analista não salva: 42501', v_estado = '42501', v_estado || ' ' || sqlerrm);
  end;
end;
$ensaio$;

reset role;

insert into ensaio_resultado
select 'histórico: 3 versões (SALVAR, SALVAR, RESTAURAR)',
       array_agg(h."TP_ACAO" order by h."NU_VERSAO") = array['SALVAR', 'SALVAR', 'RESTAURAR']::varchar[],
       string_agg(h."NU_VERSAO" || ':' || h."TP_ACAO" || ':' || h."DS_TEXTOS"::text, ' | ' order by h."NU_VERSAO")
  from public."TH_MODELO_ESPELHO_NOTA" h
  join public."TB_MODELO_ESPELHO_NOTA" m on m."CO_MODELO_ESPELHO_NOTA" = h."CO_MODELO_ESPELHO_NOTA"
 where m."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

insert into ensaio_resultado
select 'anon e authenticated não leem as tabelas',
       not has_table_privilege('authenticated', 'public."TB_MODELO_ESPELHO_NOTA"', 'select')
         and not has_table_privilege('anon', 'public."TH_MODELO_ESPELHO_NOTA"', 'select')
         and not has_function_privilege('anon', 'public.salvar_modelo_espelho_nota(uuid, jsonb, integer)', 'execute')
         and has_function_privilege('authenticated', 'public.obter_modelo_espelho_nota(uuid)', 'execute'),
       '';

select passo, ok, left(detalhe, 220) as detalhe from ensaio_resultado;
