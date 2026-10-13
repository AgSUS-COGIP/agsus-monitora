/*
  PAYLOAD SÓ QUANDO MUDA

  Por quê: o plano gratuito do Supabase chegou a 3,74 de 5 GB de egress no
  ciclo. Medido de 02/10 a 13/10 (pg_stat_statements × tamanho da resposta):
    get_analises_dashboard_payload_v2      499 chamadas, até 4,2 MB  ~1 GB
    VW_MONITORAMENTO_INDIGENA_OPERACIONAL  939 chamadas, 408 kB      ~380 MB
    get_entrevistas_da_area                 99 chamadas, até 2,8 MB  ~280 MB
    get_selecao_da_area                    153 chamadas, até 1,6 MB  ~200 MB
    listar_acompanhamento_da_visao_geral   986 chamadas, até 170 kB  ~150 MB
  As telas já guardam uma cópia no navegador (IndexedDB), mas a revalidação
  baixava o payload inteiro para só então comparar. A lista de aprovados já
  fazia certo (listar_candidatos_aprovados_compacto com p_versao): manda a
  versão que tem e recebe { inalterado: true } quando nada mudou.

  O QUE ENTRA (o mesmo padrão nas cinco)
    get_analises_dashboard_payload_v2_se_mudou(p_scope, p_area, p_versao)
    get_entrevistas_da_area_se_mudou(p_area, p_versao)
    get_selecao_da_area_se_mudou(p_area, p_versao)
    listar_acompanhamento_da_visao_geral_se_mudou(p_area, p_versao)
    listar_monitoramento_operacional(p_versao)
  Devolvem o payload de sempre com a chave `versao` a mais, ou, quando
  p_versao é a versão atual, só { inalterado: true, versao }.

  A VERSÃO
    md5 do payload (jsonb, chaves em ordem) sem `gerado_em`, que muda a cada
    leitura. Não precisa de coluna nova nem de gatilho: mudou qualquer dado
    que a pessoa vê, muda a versão. O servidor ainda monta o payload (o custo
    de CPU é o de antes); o que deixa de trafegar é a resposta.

  POR QUE FUNÇÕES NOVAS, E NÃO UM PARÂMETRO A MAIS NAS DE HOJE
    As quatro primeiras só chamam a função de sempre, que segue com a mesma
    assinatura e o mesmo corpo: quem mexer nela (outra branch, outra
    migration) não cria sobrecarga, e a mudança chega aqui sozinha. Todas são
    SECURITY INVOKER: a permissão continua sendo a da função de dentro.

    listar_monitoramento_operacional substitui o select da view que o front
    fazia (src/app/carga.js): as mesmas 40 colunas, ativo = true, por unidade e
    edital. INVOKER de propósito: a view é security_invoker e
    TB_MONITORAMENTO_INDIGENA tem RLS; a pessoa vê exatamente o que via.
*/

begin;

-- 1. A versão e a resposta ----------------------------------------------------

create or replace function private."FC_SE_MUDOU"(p_payload jsonb, p_versao text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
           when p_payload is null then null
           when p_versao is not null and p_versao = x.versao
             then jsonb_build_object('inalterado', true, 'versao', x.versao)
           else p_payload || jsonb_build_object('versao', x.versao)
         end
    from (select md5((p_payload - 'gerado_em')::text) as versao) x;
$$;

comment on function private."FC_SE_MUDOU"(jsonb, text) is
  'O payload com a chave versao (md5 sem gerado_em), ou só { inalterado, versao } quando p_versao é a atual (20261013160000).';

revoke all on function private."FC_SE_MUDOU"(jsonb, text) from public, anon;
grant execute on function private."FC_SE_MUDOU"(jsonb, text) to authenticated, service_role;

-- 2. As quatro telas que já têm cópia no navegador ---------------------------

create or replace function public.get_analises_dashboard_payload_v2_se_mudou(
  p_scope text default 'ativo', p_area text default null, p_versao text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private."FC_SE_MUDOU"(public.get_analises_dashboard_payload_v2(p_scope, p_area)::jsonb, p_versao);
$$;

create or replace function public.get_entrevistas_da_area_se_mudou(
  p_area text, p_versao text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private."FC_SE_MUDOU"(public.get_entrevistas_da_area(p_area)::jsonb, p_versao);
$$;

create or replace function public.get_selecao_da_area_se_mudou(
  p_area text, p_versao text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private."FC_SE_MUDOU"(public.get_selecao_da_area(p_area)::jsonb, p_versao);
$$;

create or replace function public.listar_acompanhamento_da_visao_geral_se_mudou(
  p_area text, p_versao text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private."FC_SE_MUDOU"(public.listar_acompanhamento_da_visao_geral(p_area), p_versao);
$$;

-- 3. O monitoramento (antes, select direto na view) --------------------------

create or replace function public.listar_monitoramento_operacional(p_versao text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private."FC_SE_MUDOU"(jsonb_build_object('linhas', coalesce((
    select jsonb_agg(to_jsonb(l) order by l.unidade, l.edital)
      from (
        select v.aprovados_analise, v.aprovados_prova, v.aptos_analise, v.ativo,
               v.cancelados, v.cargos, v.ciclo, v.contratados,
               v.cronograma_atividade_atual, v.cronograma_automatico,
               v.cronograma_dias_para_proxima, v.cronograma_percentual,
               v.cronograma_proxima_atividade, v.cronograma_proxima_data,
               v.data_fim, v.data_inicio, v.edital, v.eliminados_nota,
               v.entrevistados, v.etapa, v.id, v.id_unidade, v.inscritos,
               v.link_edital, v.observacoes, v.observacoes_internas, v.processo,
               v.reprovados_analise, v.responsavel, v.risco, v.sigla_unidade,
               v.status, v.tipo_unidade, v.total_eliminados, v.uf, v.unidade,
               v.vagas_ociosas, v.vagas_total, v."CO_AREA", v."ST_TREINAMENTO"
          from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v
         where v.ativo is true
      ) l), '[]'::jsonb)), p_versao);
$$;

-- 4. Quem pode chamar ----------------------------------------------------------

revoke all on function public.get_analises_dashboard_payload_v2_se_mudou(text, text, text) from public, anon;
revoke all on function public.get_entrevistas_da_area_se_mudou(text, text) from public, anon;
revoke all on function public.get_selecao_da_area_se_mudou(text, text) from public, anon;
revoke all on function public.listar_acompanhamento_da_visao_geral_se_mudou(text, text) from public, anon;
revoke all on function public.listar_monitoramento_operacional(text) from public, anon;

grant execute on function public.get_analises_dashboard_payload_v2_se_mudou(text, text, text) to authenticated, service_role;
grant execute on function public.get_entrevistas_da_area_se_mudou(text, text) to authenticated, service_role;
grant execute on function public.get_selecao_da_area_se_mudou(text, text) to authenticated, service_role;
grant execute on function public.listar_acompanhamento_da_visao_geral_se_mudou(text, text) to authenticated, service_role;
grant execute on function public.listar_monitoramento_operacional(text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
