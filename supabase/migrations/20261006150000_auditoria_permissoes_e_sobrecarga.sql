/*
  AUDITORIA DO BACK-END (06/10/2026): SOBRECARGA ANTIGA, BRIDGE DA AYA, PRIVILÉGIOS E search_path

  Achados no banco real (consultas em ensaio, begin … rollback):

  1. alterar_status_candidato_aprovado AMBÍGUA (grave)
     20261005180000 trocou a versão de 4 parâmetros pela de 5 (p_data_convocacao),
     mas a de 4 voltou ao banco e as duas convivem. A tela só manda
     p_data_convocacao quando há data, e sem ela o Postgres responde
     "function ... is not unique" (42725): mudar o status (Contratado, Desistente…)
     sem data de convocação falha. A de 4 ainda era executável por anon.
     Sai a de 4; a de 5 (20261006070000) fica como está.

  2. BRIDGE DA AYA SEM USO
     A IA local e o bridge foram retirados (api/CLAUDE.md, docs/aya-sem-ia-local.md),
     mas registrar_bridge_aya (executável por anon), obter_bridge_aya e
     definir_segredo_bridge_aya continuavam no banco. Saem as três funções. A
     tabela TB_BRIDGE_AYA fica (só guarda o hash do segredo); removê-la é decisão
     à parte.

  3. FUNÇÕES INTERNAS EXPOSTAS
     private.snapshot_* e private.diff_* são SECURITY DEFINER e leem configurações
     e cronogramas de qualquer área; só as RPCs SECURITY DEFINER de configurações e
     do cronograma as chamam. Perdem o EXECUTE de public/anon/authenticated.

  4. private."TA_PAINEL_ENTREVISTA" SEM RLS
     Única tabela de public/private com RLS desligada. Sem grant a ninguém além do
     dono, mas a regra do projeto é RLS ligada; quem lê é SECURITY DEFINER
     (get_entrevistas_da_area, atualizar_cache_painel_entrevistas).

  5. search_path DAS SECURITY DEFINER ANTIGAS
     25 funções antigas usam search_path = public[, private, auth] sem pg_temp.
     Sem pg_temp na lista, o Postgres procura tabelas no esquema temporário da
     sessão ANTES dos listados. Aqui pg_temp vai para o fim em 20 delas; as
     outras 5 (cronograma, avatar, configurações) são redefinidas em
     20261006150100. Reescrever estas 20 com
     search_path = '' e nomes qualificados fica para quando cada uma for tocada
     (exige qualificar cada referência).

  Assinaturas das RPCs da tela iguais (src/lib/rpc-contrato.js não muda).
*/
begin;

-- 1. Sobrecarga antiga ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.alterar_status_candidato_aprovado(uuid, text, text, text, date)') is null then
    raise exception 'Aplique antes 20261006070000_integridade_das_listas_e_kpis.sql.';
  end if;
end;
$$;

drop function if exists public.alterar_status_candidato_aprovado(uuid, text, text, text);

-- 2. Bridge da AYA -------------------------------------------------------------------------------
drop function if exists public.registrar_bridge_aya(text, text);
drop function if exists public.obter_bridge_aya();
drop function if exists public.definir_segredo_bridge_aya(text);

-- 3. Funções internas ----------------------------------------------------------------------------
revoke all on function private.snapshot_configuracoes() from public, anon, authenticated;
revoke all on function private.snapshot_paineis_externos() from public, anon, authenticated;
revoke all on function private.snapshot_monitoramento_cronograma(uuid) from public, anon, authenticated;
revoke all on function private.diff_configuracoes_e_paineis(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.diff_monitoramento_cronograma(jsonb, jsonb) from public, anon, authenticated;

-- 4. RLS -----------------------------------------------------------------------------------------
alter table private."TA_PAINEL_ENTREVISTA" enable row level security;

-- 5. pg_temp no fim do search_path ---------------------------------------------------------------
alter function public.desativar_acesso_usuario(uuid, text) set search_path = public, private, auth, pg_temp;
alter function public.diagnostico_agsus_monitora() set search_path = public, auth, pg_temp;
alter function public.finalizar_sync_analises_lotes(uuid) set search_path = public, auth, pg_temp;
alter function public.fn_registrar_historico() set search_path = public, auth, pg_temp;
alter function public.get_configuracoes_historico(integer) set search_path = public, private, auth, pg_temp;
alter function public.get_configuracoes_snapshot() set search_path = public, private, auth, pg_temp;
alter function public.get_monitoramento_cronograma_estado(uuid, date) set search_path = public, private, auth, pg_temp;
alter function public.get_monitoramento_cronograma_historico(uuid, integer) set search_path = public, private, auth, pg_temp;
alter function public.limpar_eventos_acesso_antigos(integer) set search_path = public, private, auth, pg_temp;
alter function public.limpar_eventos_acesso_retencao(integer, integer) set search_path = public, pg_temp;
alter function public.limpar_logs_operacionais(integer) set search_path = public, private, auth, pg_temp;
alter function public.limpar_staging_monitoramento_indigena(integer) set search_path = public, pg_temp;
alter function public.link_auth_user_profile() set search_path = public, auth, pg_temp;
alter function public.listar_etapas_do_cronograma() set search_path = public, private, auth, pg_temp;
alter function private.current_profile() set search_path = public, auth, pg_temp;
alter function public.processar_sync_analises_lote(uuid, integer) set search_path = public, auth, pg_temp;
alter function public.processar_sync_analises(uuid) set search_path = public, auth, pg_temp;
alter function public.registrar_presenca_monitora(text) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.salvar_configuracoes_e_paineis_v2(jsonb, jsonb, text) set search_path = public, private, auth, pg_temp;
alter function public.salvar_monitoramento_com_cronograma(jsonb, jsonb) set search_path = public, private, auth, pg_temp;

commit;
