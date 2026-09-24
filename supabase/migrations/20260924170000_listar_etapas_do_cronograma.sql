begin;

-- Todas as etapas de cronograma num pedido só, para a tela Cronograma.
--
-- A tela chamava `get_monitoramento_cronograma` uma vez por edital: 118
-- chamadas de ~300 ms, seis por vez — seis a sete segundos com a tela
-- bloqueada. Cada chamada ainda montava o estado calculado e os 20 últimos
-- registros de histórico do edital, que o calendário não usa.
--
-- Esta função devolve só o que o calendário desenha: edital, ordem, atividade
-- e datas. Mesma permissão da função por edital (`cores`, que cobre os
-- módulos Editais e Cronograma — ver private.has_perm).
--
-- O frontend (`src/modules/calendario-editais.js`) tolera o banco sem esta
-- função: recebe PGRST202 e volta às chamadas por edital.
--
-- Rollback: `drop function public.listar_etapas_do_cronograma();`

create or replace function public.listar_etapas_do_cronograma()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'private', 'auth'
as $function$
begin
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para consultar cronograma';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'monitoramento_id', c.monitoramento_id,
      'ordem', c.ordem,
      'atividade', c.atividade,
      'data_inicio', c.data_inicio,
      'data_fim', c.data_fim
    ) order by c.monitoramento_id, c.ordem)
    from public."TB_CRONOGRAMA_MONIT_INDIG" c
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c.monitoramento_id
    where m.ativo
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.listar_etapas_do_cronograma() from public, anon;
grant execute on function public.listar_etapas_do_cronograma() to authenticated;

commit;
