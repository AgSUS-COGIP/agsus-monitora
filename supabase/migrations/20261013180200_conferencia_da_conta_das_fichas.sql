/*
  CONFERÊNCIA DA CONTA DAS FICHAS (job Python das conferências)

  Por quê (auditoria da avaliação documental, 13/10/2026): a ficha é calculada
  na tela (pontuacao.js) e concluir_ficha grava o resultado pronto; o banco só
  valida a estrutura e os limites (cada parcial até o teto, a soma, o
  resultado contra a nota mínima e os blocos eliminatórios). Quem refaz a conta
  é python/monitora/avaliacao_documental/pontuacao.py (conferir_ficha), que o
  próprio módulo diz rodar "em lote para CONFERIR o que foi gravado" — mas
  nenhum job chamava. Uma conta errada (tela desatualizada, chamada direta da
  RPC, regra mudada no meio) ficava gravada e publicada no painel sem aviso.

  Agora o job das conferências (scripts/conferencias/, módulo Análises) lê as
  fichas concluídas por esta RPC, refaz a conta com a versão da regra com que
  cada uma foi concluída e grava o aviso ANALISE_FICHA_CONTA_DIVERGENTE
  (crítico) quando resultado, notas, parciais ou parecer não batem.

  O QUE ENTRA
    public.conferencia_ler_fichas(p_apos, p_limite)
      Uma página (até 1000, pela ordem do id da ficha, depois de p_apos) das
      fichas CONCLUIDA de editais que não são de treinamento: ficha, análise
      publicada (TB_ANALISE_CURRICULAR pela chave monitora|edital|candidato,
      nula se o edital não publica), edital, área, regra e versão, lançamento,
      resultado, parecer e a nota mínima de agora (FC_DOCUMENTAL_DO_EDITAL).
      `regras`: a configuração de cada (regra, versão) usada na página, uma
      vez só. Sem nome, CPF nem e-mail (o lançamento só tem itens e datas).
      proximo = cursor da página seguinte (nulo na última). Só service_role.

  Ensaio: supabase/ensaios/20261013180200_conferencia_da_conta_das_fichas.sql
  Rollback: supabase/rollback/20261013180200_conferencia_da_conta_das_fichas.sql
*/
begin;

create function public.conferencia_ler_fichas(p_apos uuid default null, p_limite integer default 500)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 500), 1), 1000);
  v_linhas jsonb;
  v_regras jsonb;
  v_ultimo uuid;
  v_qt integer;
begin
  with pagina as (
    select f."CO_FICHA_ANALISE" as ficha, f."CO_MONITORAMENTO" as edital, f."CO_EMPREGARE_CANDIDATO" as candidato,
           f."CO_REGRA_ANALISE" as regra, f."NU_VERSAO_REGRA" as versao,
           f."DS_LANCAMENTO" as lancamento, f."DS_RESULTADO" as resultado, f."DS_PARECER" as parecer
      from public."TB_FICHA_ANALISE" f
     where f."TP_SITUACAO" = 'CONCLUIDA'
       and (p_apos is null or f."CO_FICHA_ANALISE" > p_apos)
       and not private."FC_EDITAL_EH_TREINAMENTO"(f."CO_MONITORAMENTO")
     order by f."CO_FICHA_ANALISE"
     limit v_limite
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ficha', p.ficha,
           'analise', (select a.id from public."TB_ANALISE_CURRICULAR" a
                        where a.chave_natural = 'monitora|' || p.edital || '|' || p.candidato),
           'edital', p.edital, 'area', m."CO_AREA",
           'regra', p.regra, 'versao_regra', p.versao,
           'lancamento', p.lancamento, 'resultado', p.resultado, 'parecer', p.parecer,
           'documental', private."FC_DOCUMENTAL_DO_EDITAL"(p.edital)) order by p.ficha), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('regra', h."CO_REGRA_ANALISE", 'versao', h."NU_VERSAO",
                                                       'configuracao', h."DS_CONFIGURACAO"))
                     from public."TH_REGRA_ANALISE" h
                    where (h."CO_REGRA_ANALISE", h."NU_VERSAO") in (select distinct x.regra, x.versao from pagina x)), '[]'::jsonb),
         max(p.ficha::text)::uuid, count(*)
    into v_linhas, v_regras, v_ultimo, v_qt
    from pagina p
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = p.edital;

  return jsonb_build_object(
    'schema_version', 1,
    'linhas', v_linhas,
    'regras', v_regras,
    'proximo', case when v_qt = v_limite then v_ultimo end);
end;
$function$;
comment on function public.conferencia_ler_fichas(uuid, integer) is
  'Conferências (job Python): uma página (até 1000, pela ordem do id, depois de p_apos) das fichas CONCLUIDA da avaliação documental fora dos editais de treinamento, com a análise publicada, edital, área, regra e versão, lançamento, resultado, parecer e nota mínima de agora; em regras, a configuração de cada versão usada na página. Sem nome nem CPF. proximo = cursor da página seguinte (nulo na última). Só service_role.';
revoke all on function public.conferencia_ler_fichas(uuid, integer) from public, anon, authenticated;
grant execute on function public.conferencia_ler_fichas(uuid, integer) to service_role;

commit;
