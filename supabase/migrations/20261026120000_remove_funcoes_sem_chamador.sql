/*
  REMOVE FUNÇÕES SEM CHAMADOR E TIRA EXECUTE DE ANON

  Por quê: funções que ninguém chama — nem o front, nem os robôs, nem as
  planilhas, nem outra função, gatilho, política, view ou tarefa do banco —,
  algumas ainda executáveis por authenticated (superfície de ataque sem uso):
    public.diagnostico_agsus_monitora()                 só postgres
    public.limpar_eventos_acesso_antigos(integer)       só postgres (o pg_cron
        agsus_eventos_acesso_limpeza_mensal faz o delete direto)
    public.limpar_logs_operacionais(integer)            authenticated, service_role
    public.limpar_staging_monitoramento_indigena(integer)  service_role
    public.obter_candidatos_empregare(text)             authenticated, service_role
    private."FC_LOTE_REFEITO_EM"(text)                  só postgres
    private."FC_PCD_PUBLICADA"(text)                    só postgres
    private.nivel_padrao_recurso(text,text)             só postgres

  E public.analises_norm_key(text) e public.analises_make_chave_natural(...)
  estavam com o privilégio padrão (proacl nulo = EXECUTE para PUBLIC, logo
  para anon). Passam a authenticated e service_role:
    - analises_norm_key está nas colunas geradas grupo_norm/unidade_norm/
      edital_norm de TB_ANALISE_CURRICULAR e TB_EDITAL_ANALISE (quem grava,
      service_role, precisa do EXECUTE) e na política PL_EDITAL_ANALISE_AREA
      (para authenticated); as demais chamadas vêm de funções do postgres;
    - analises_make_chave_natural só é chamada por processar_sync_analises_lote
      e finalizar_sync_analises_lotes (SECURITY DEFINER do postgres).
  anon não tem política nem privilégio nessas tabelas.

  Prova (26/10/2026): git grep -w de cada nome no repositório inteiro (src/,
  api/, server/, python/, scripts/, apps-script/, .github/, public/, *.html):
  só migrations, ensaios e rollbacks antigos, testes estáticos dessas
  migrations, docs/robo-empregare.md (atualizado) e dois roteiros SQL de teste
  (supabase/ensaios/ponta-a-ponta.sql e tests/sql/grupos-e-coordenacoes.sql,
  ajustados). No banco: pg_depend não liga nada às oito; nenhuma função,
  view, política, default, CHECK, índice ou gatilho cita os nomes; nenhuma
  tarefa do pg_cron os chama.

  Não mexe em FC_HOOK_ANTES_CRIAR_USUARIO, private."FC_AGENDA_DAS_INSCRICOES"
  nem rls_auto_enable.

  Sem CASCADE: se aparecer dependência nova, a migration para.
  Idempotente. Ensaio: supabase/ensaios/20261026120000_remove_funcoes_sem_chamador.sql
  Rollback: supabase/rollback/20261026120000_remove_funcoes_sem_chamador.sql (recria a partir de pg_get_functiondef
  e dos privilégios de 26/10/2026)
*/
begin;

drop function if exists public.diagnostico_agsus_monitora();
drop function if exists public.limpar_eventos_acesso_antigos(integer);
drop function if exists public.limpar_logs_operacionais(integer);
drop function if exists public.limpar_staging_monitoramento_indigena(integer);
drop function if exists public.obter_candidatos_empregare(text);
drop function if exists private."FC_LOTE_REFEITO_EM"(text);
drop function if exists private."FC_PCD_PUBLICADA"(text);
drop function if exists private.nivel_padrao_recurso(text,text);

revoke execute on function public.analises_norm_key(text) from public, anon;
grant execute on function public.analises_norm_key(text) to authenticated, service_role;
revoke execute on function public.analises_make_chave_natural(text,text,text,text,text,text) from public, anon;
grant execute on function public.analises_make_chave_natural(text,text,text,text,text,text) to authenticated, service_role;

commit;
