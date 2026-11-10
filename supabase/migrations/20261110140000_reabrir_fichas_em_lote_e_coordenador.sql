-- Reabrir fichas em lote pela Fila e o perfil Coordenador coordenando como o Gestor.
--
-- Motivo (10/11/2026, prioridade): na Fila, ficha concluída não aceita
-- "Atribuir a…" nem "Mandar para revisão" (AM-6.3); o único caminho era abrir
-- cada ficha e reabrir pelo rodapé. Com o edital 100% concluído (114/2026, 1.512
-- fichas), quem coordena não conseguia trocar responsável nenhum. E o perfil
-- Coordenador nunca virava coordenação do edital sozinho: FC_GESTOR_DO_EDITAL
-- só aceitava o grupo edital_gestor.
--
-- Efeito:
-- 1. FC_GESTOR_DO_EDITAL aceita os grupos edital_gestor e coordenador (sempre
--    com Administrador em avaliacao_documental e vendo o edital por área e
--    coordenação). FC_PAPEL_AVALIACAO, que usa esta função, passa a dar
--    COORDENADOR ao Coordenador nos editais que ele vê; a lista "gestores" da
--    Equipe (obter_equipe_do_edital) passa a mostrá-lo.
-- 2. public.reabrir_fichas: a mesma reabertura de reabrir_ficha (20261022160000),
--    para várias fichas do edital de uma vez, numa transação só (uma que falhe
--    desfaz todas). Cada ficha ganha o próprio histórico REABRIR. A AM-6.3 não
--    muda: depois de reaberta (Em análise), a ficha pode ser atribuída.
--
-- Dependentes: src/modulos/avaliacao-documental/ (Fila: "Reabrir" na seleção
-- e no "⋯" da linha), src/lib/rpc-contrato.ts. Aplicar ANTES do merge: sem a
-- função, o botão novo responde "função não encontrada".
-- Rollback: supabase/rollback/20261110140000_reabrir_fichas_em_lote_e_coordenador.sql.
-- Ensaio: supabase/ensaios/20261110140000_reabrir_fichas_em_lote_e_coordenador.sql.

begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';

-- 1. Coordenador como Gestor ------------------------------------------------------------
create or replace function private."FC_GESTOR_DO_EDITAL"(p_perfil_usuario uuid, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where u.id = p_perfil_usuario and u.ativo and u.perfil in ('edital_gestor', 'coordenador')
       and private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 3
       and private."FC_PERFIL_VE_EDITAL"(u.id, p_edital));
$function$;
comment on function private."FC_GESTOR_DO_EDITAL"(uuid, uuid) is
  'O usuário coordena o edital na avaliação documental sem linha em RL_ANALISTA_EDITAL: grupo edital_gestor ou coordenador, Administrador em avaliacao_documental e vê o edital (área e coordenação). Coordenador desde 20261110140000.';
revoke all on function private."FC_GESTOR_DO_EDITAL"(uuid, uuid) from public, anon, authenticated;

-- 2. Reabrir em lote --------------------------------------------------------------------
create or replace function public.reabrir_fichas(
  p_edital uuid,
  p_fichas jsonb,
  p_motivo text,
  p_complemento text default null
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_item record;
  v_qt integer;
begin
  perform private."FC_EXIGIR_COORD_FICHAS"(p_edital);
  if jsonb_typeof(p_fichas) is distinct from 'array' or jsonb_array_length(p_fichas) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  begin
    select count(*) into v_qt
      from jsonb_to_recordset(p_fichas) x(ficha uuid, versao integer)
      left join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = x.ficha and f."CO_MONITORAMENTO" = p_edital
     where f."CO_FICHA_ANALISE" is null or f."NU_VERSAO" is distinct from x.versao;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Ficha com id ou versão inválida' using errcode = '22023';
  end;
  if v_qt > 0 then
    raise exception '% ficha(s) mudaram desde que você abriu a fila; atualize e confira.', v_qt using errcode = 'PT409';
  end if;
  -- A regra de cada ficha (situação, motivo da lista, complemento, histórico) é a de reabrir_ficha.
  for v_item in select x.ficha, x.versao from jsonb_to_recordset(p_fichas) x(ficha uuid, versao integer) order by x.ficha loop
    perform public.reabrir_ficha(v_item.ficha, v_item.versao, p_motivo, p_complemento);
  end loop;
  return json_build_object('reabertas', jsonb_array_length(p_fichas));
end;
$function$;
comment on function public.reabrir_fichas(uuid, jsonb, text, text) is
  'A coordenação do edital reabre várias fichas concluídas ou em revisão de uma vez ([{ficha, versao}], 1 a 5.000, do mesmo edital, com controle otimista PT409). Cada uma passa por reabrir_ficha (motivo da lista, complemento, histórico REABRIR); uma que falhe desfaz o lote. 20261110140000.';
revoke all on function public.reabrir_fichas(uuid, jsonb, text, text) from public, anon;
grant execute on function public.reabrir_fichas(uuid, jsonb, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
