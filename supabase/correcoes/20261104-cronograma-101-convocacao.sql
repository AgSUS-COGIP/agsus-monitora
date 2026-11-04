/*
  CORREÇÃO DE DADOS — convocação do edital 101/2026 (DSEI Manaus) (04/11/2026)

  Por quê: a 1ª Retificação do Cronograma (SEI 0810858, assinada em 05/10/2026)
  dá a "Convocação para a Entrevista" como "24/09 e 07/10" (duas convocações).
  O MONITORA tinha 24/09 a 27/09. Por decisão do usuário (04/11/2026), grava-se
  como intervalo de 24/09 a 07/10. As outras 11 etapas já batem com o "leia-se"
  (conferido contra o PDF em 04/11/2026).

  O que faz (uma transação): confere a conta do setor; guarda o retrato ANTES;
  muda só a convocação (casando pela atividade e pelas datas antigas — se a
  linha já mudou, falha); grava cronograma_ultima_errata e o histórico em
  TH_CRONOGRAMA_MONIT_INDIG (acao 'errata', com o diff), como a tela faz.
  Assinada pela conta do setor (a01afddb-f64b-47d9-80e8-476a1ed14e43). Rode SÓ
  COM A AUTORIZAÇÃO do usuário. Não é idempotente de propósito.
  Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261104-cronograma-101-convocacao.sql
*/
begin;

-- >>> correcao
set local lock_timeout = '3s';

select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated","email":"dados.recursoshumanos@agenciasus.org.br"}', true);

do $$
declare
  v_id constant uuid := '5351378f-7b51-43b4-a9e2-54a2a1c57773';
  v_antes jsonb;
  v_depois jsonb;
  v_alteracoes jsonb;
  v_n int;
begin
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo.';
  end if;
  if auth.uid() is distinct from 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid then
    raise exception 'auth.uid() desta transação não é a conta do setor.';
  end if;

  perform 1 from public."TB_MONITORAMENTO_INDIGENA" where id = v_id and edital = '101/2026' for update;
  if not found then raise exception 'Edital 101/2026 não encontrado.'; end if;

  v_antes := private.snapshot_monitoramento_cronograma(v_id);

  update public."TB_CRONOGRAMA_MONIT_INDIG"
     set data_fim = '2026-10-07', updated_by = auth.uid(), updated_at = now()
   where monitoramento_id = v_id
     and atividade = 'Convocação para a Entrevista'
     and data_inicio = '2026-09-24' and data_fim = '2026-09-27';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Convocação do 101 casou % linhas (esperado 1).', v_n; end if;

  update public."TB_MONITORAMENTO_INDIGENA"
     set cronograma_ultima_errata = '1ª Retificação do Cronograma', updated_by = auth.uid(), updated_at = now()
   where id = v_id;

  v_depois := private.snapshot_monitoramento_cronograma(v_id);
  v_alteracoes := private.diff_monitoramento_cronograma(v_antes, v_depois);
  if jsonb_array_length(v_alteracoes) < 1 then raise exception 'Nenhuma alteração registrada.'; end if;

  insert into public."TH_CRONOGRAMA_MONIT_INDIG"(
    monitoramento_id, acao, motivo, numero_errata, created_by, created_by_email,
    cronograma_antes, cronograma_depois, alteracoes, total_alteracoes)
  values (v_id, 'errata',
          'Correção pela 1ª Retificação do Cronograma (SEI 0810858): convocação "24/09 e 07/10" gravada como intervalo de 24/09 a 07/10.',
          '1ª Retificação do Cronograma', auth.uid(), nullif(auth.jwt() ->> 'email', ''),
          v_antes, v_depois, v_alteracoes, jsonb_array_length(v_alteracoes));
end;
$$;
-- <<< correcao

commit;
