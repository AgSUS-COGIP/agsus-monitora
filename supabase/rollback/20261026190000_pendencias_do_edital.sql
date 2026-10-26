/*
  ROLLBACK de 20261026190000_pendencias_do_edital.sql

  Tira as RPCs da tela e do job, as funções privadas, o instantâneo e o histórico das pendências e o
  recurso "aprovados_pendencias" da matriz de acessos (as linhas dos grupos e as exceções das pessoas
  saem antes de o catálogo voltar ao de 20261006090000). O que as decisões já gravaram nas linhas da
  lista (status pelo histórico do status, posição, remoção lógica) fica: é dado, não schema; o
  histórico das decisões sai com TH_PENDENCIA_APROVADO — exporte antes se precisar guardar.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.registrar_desfecho_da_pendencia(uuid, text, text, date, text);
drop function if exists public.corrigir_posicao_da_pendencia(uuid, uuid, integer, text);
drop function if exists public.confirmar_empate_da_posicao(uuid, text);
drop function if exists public.manter_linha_da_pessoa_repetida(uuid, uuid, text);
drop function if exists public.escolher_lista_da_contratacao(uuid, uuid, text);
drop function if exists public.escolher_vinculo_do_contratado(uuid, uuid, text, text);
drop function if exists public.listar_pendencias_do_edital(text, uuid);
drop function if exists private."FC_FECHAR_PENDENCIA"(uuid, text, text, jsonb, boolean);
drop function if exists private."FC_FECHAR_CASOS_DO_AVISO"(text, uuid[]);
drop function if exists private."FC_STATUS_PELA_PENDENCIA"(uuid, text, text, date);
drop function if exists private."FC_PENDENCIA_PARA_DECIDIR"(uuid, text[], text);
drop function if exists private."FC_PODE_DECIDIR_PENDENCIA"(uuid);
drop function if exists public.gravar_pendencias_do_edital(text, timestamptz, jsonb);
drop function if exists public.pendencias_ler_aprovados();

drop table if exists public."TH_PENDENCIA_APROVADO";
drop table if exists public."TB_PENDENCIA_APROVADO";

delete from public."TB_PERMISSAO_RECURSO" where recurso = 'aprovados_pendencias';
delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'aprovados_pendencias';

create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao','chat','avaliacao_documental']::text[];
$function$;

commit;
