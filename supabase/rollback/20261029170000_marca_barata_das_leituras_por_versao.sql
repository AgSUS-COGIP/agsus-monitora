-- Desfaz 20261029170000: as sete RPCs por versão voltam a montar o payload e tirar o md5
-- (as definições de 20261013160000, 20261014230000 e 20261015000000, iguais às do banco
-- em 29/10/2026); saem os gatilhos TG_VERSAO_FONTE, as tabelas de versão e as funções da
-- marca. A tela não muda: a versão é opaca e a primeira chamada depois manda o payload.
begin;

set local lock_timeout = '10s';

create or replace function public.get_analises_dashboard_payload_v2_se_mudou(
  p_scope text default 'ativo'::text, p_area text default null::text, p_versao text default null::text)
returns jsonb
language sql
set search_path to ''
as $function$
  select private."FC_SE_MUDOU"(public.get_analises_dashboard_payload_v2(p_scope, p_area)::jsonb, p_versao);
$function$;

create or replace function public.get_entrevistas_da_area_se_mudou(p_area text, p_versao text default null::text)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private."FC_SE_MUDOU"(public.get_entrevistas_da_area(p_area)::jsonb, p_versao);
$function$;

create or replace function public.get_selecao_da_area_se_mudou(p_area text, p_versao text default null::text)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private."FC_SE_MUDOU"(public.get_selecao_da_area(p_area)::jsonb, p_versao);
$function$;

create or replace function public.listar_acompanhamento_da_visao_geral_se_mudou(p_area text, p_versao text default null::text)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private."FC_SE_MUDOU"(public.listar_acompanhamento_da_visao_geral(p_area), p_versao);
$function$;

create or replace function public.obter_regra_analise_se_mudou(p_edital uuid, p_versao text default null::text)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private."FC_SE_MUDOU"(public.obter_regra_analise(p_edital)::jsonb, p_versao);
$function$;

create or replace function public.obter_classificacao_do_edital_se_mudou(p_edital uuid, p_versao text default null::text)
returns json
language sql
stable
set search_path to ''
as $function$
  select private."FC_SE_MUDOU_EM_COLUNAS"(public.obter_classificacao_do_edital(p_edital)::jsonb, p_versao, 'candidatos', array[
    'vaga', 'cargo', 'categoria', 'modalidade', 'pcd', 'status', 'etapa', 'quadro', 'hora_nascimento',
    'pontuacao_etnica']);
$function$;

create or replace function public.listar_avisos_conferencia_se_mudou(
  p_area text default null::text, p_modulo text default null::text, p_versao text default null::text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with bruto as (
    select public.listar_avisos_conferencia(p_area, p_modulo)::jsonb as j
  )
  select private."FC_SE_MUDOU"(
           b.j || jsonb_build_object('avisos', coalesce((
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
               from jsonb_array_elements(b.j -> 'avisos') with ordinality a(aviso, ordem)
           ), '[]'::jsonb)),
           p_versao)
    from bruto b;
$function$;

-- Os comentários de antes (as quatro de 20261013160000 não tinham).
comment on function public.get_analises_dashboard_payload_v2_se_mudou(text, text, text) is null;
comment on function public.get_entrevistas_da_area_se_mudou(text, text) is null;
comment on function public.get_selecao_da_area_se_mudou(text, text) is null;
comment on function public.listar_acompanhamento_da_visao_geral_se_mudou(text, text) is null;
comment on function public.obter_regra_analise_se_mudou(uuid, text) is
  'obter_regra_analise com versão (private.FC_SE_MUDOU): a tela revalida a regra guardada sem baixar as versões (≈0,5 MB) quando nada mudou (20261014230000). Mesma permissão.';
comment on function public.obter_classificacao_do_edital_se_mudou(uuid, text) is
  'obter_classificacao_do_edital com versão (md5 sem gerado_em) e os candidatos em colunas (candidatos_em_colunas, FC_COLUNAS_JSON); com p_versao atual, só { inalterado, versao } (20261014230000). Mesma permissão.';
comment on function public.listar_avisos_conferencia_se_mudou(text, text, text) is
  'listar_avisos_conferencia com versão (FC_SE_MUDOU): o payload com a chave versao, cada aviso sem chaves nulas e sem exemplos quando tem casos (TB_CASO_AVISO_CONFERENCIA); p_versao igual à atual devolve só { inalterado, versao } (20261015000000). A permissão é a da função de dentro.';

-- Os gatilhos de versão, onde estiverem.
do $$
declare
  v_tabela regclass;
begin
  for v_tabela in select t.tgrelid::regclass from pg_catalog.pg_trigger t where t.tgname = 'TG_VERSAO_FONTE' loop
    execute format('drop trigger if exists "TG_VERSAO_FONTE" on %s', v_tabela);
  end loop;
end;
$$;

drop function if exists private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean);
drop function if exists private."FC_FONTES_PELO_CODIGO"(text[]);
drop function if exists private."FC_MARCA_DA_RPC"(text, text, uuid, text, text);
drop function if exists private."FC_MARCA_DA_LEITURA"(text, text);
drop function if exists private."FC_PAYLOAD_EM_COLUNAS"(jsonb, text, text[], text);
drop function if exists private."FC_AVISOS_PARA_A_TELA"(jsonb);
drop function if exists private."FC_TG_VERSAO_FONTE"();
drop function if exists private."FC_COMPACTAR_VERSAO_FONTE"(text);
drop table if exists private."TD_FONTE_DA_LEITURA";
drop table if exists private."TD_LEITURA_POR_MARCA";
drop table if exists private."TL_VERSAO_FONTE";

notify pgrst, 'reload schema';

commit;
