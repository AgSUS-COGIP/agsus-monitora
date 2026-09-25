/*
  REMOVE OBJETOS MORTOS (etapa 1 de docs/arquitetura.md)

  Tudo aqui foi conferido em produção em 25/09/2026: nenhuma função, view,
  policy ou job do pg_cron cita estes objetos, e nenhum arquivo do front os usa.

  Painel Análises v1 (substituído por get_analises_dashboard_payload_v2):
    - public.get_analises_dashboard_payload()        ninguém pode executar (nem service_role)
    - public.get_analises_dashboard_contadores()     idem
    - public.get_analises_dashboard_recorte(...)     idem
    - 4 views que só a v1 lia: VW_ANALISES_DASHBOARD_POR_EDITAL, VW_ANALISES_KPIS,
      VW_ANALISES_POR_RESPONSAVEL, VW_ANALISES_TENDENCIA_DIARIA
    - private."TA_DASHBOARD_ANALISE" (cache da v1, 0 linhas)
    - private.invalidate_analises_dashboard_cache() e os 3 gatilhos que, a cada
      escrita em TB_ANALISE_CURRICULAR, TB_EDITAL_ANALISE e TB_CONFIGURACAO,
      só apagavam esse cache — inclusive durante a sincronização do Apps Script.

  Sem uso:
    - public."VW_AUDITORIA_ACESSOS_DIARIA"
    - public."TL_NOTIFICACAO" (0 linhas)
    - public.salvar_monitoramento_indigena(jsonb) (v1; o front usa
      salvar_monitoramento_com_cronograma_v2. A "referência" que aparece nas
      funções de salvar é só o texto da mensagem de erro.)
    - private.monitora_role_in(text[])

  Sem CASCADE, de propósito: se algo novo passar a depender de um destes
  objetos, o DROP falha e a transação inteira volta.

  ROLLBACK: supabase/rollback/20260925150000_remove_objetos_mortos.sql recria
  tudo com as definições lidas do banco antes da remoção.
*/
begin;

drop trigger trg_invalidate_analises_dashboard_cache_curriculares on public."TB_ANALISE_CURRICULAR";
drop trigger trg_invalidate_analises_dashboard_cache_editais on public."TB_EDITAL_ANALISE";
drop trigger trg_invalidate_analises_dashboard_cache_configuracoes on public."TB_CONFIGURACAO";
drop function private.invalidate_analises_dashboard_cache();

drop function public.get_analises_dashboard_payload();
drop function public.get_analises_dashboard_contadores();
drop function public.get_analises_dashboard_recorte(text, integer, integer);

drop view public."VW_ANALISES_DASHBOARD_POR_EDITAL";
drop view public."VW_ANALISES_KPIS";
drop view public."VW_ANALISES_POR_RESPONSAVEL";
drop view public."VW_ANALISES_TENDENCIA_DIARIA";
drop table private."TA_DASHBOARD_ANALISE";

drop view public."VW_AUDITORIA_ACESSOS_DIARIA";
drop table public."TL_NOTIFICACAO";
drop function public.salvar_monitoramento_indigena(jsonb);
drop function private.monitora_role_in(text[]);

commit;
