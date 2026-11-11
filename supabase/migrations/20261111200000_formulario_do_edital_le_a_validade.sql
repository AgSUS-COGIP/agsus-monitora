/*
  EDITAIS: O FORMULÁRIO DO EDITAL LÊ A VALIDADE DO PROCESSO SELETIVO

  Cartão #57 (11/11/2026). O banco já tem a validade do processo seletivo:
  "NU_ANOS_VALIDADE" (0 a 10), "NU_MESES_VALIDADE" (0 a 11) e "ST_PRORROGADO" em
  TB_MONITORAMENTO_INDIGENA, private."FC_VENCIMENTO_DO_EDITAL",
  private."FC_INATIVAR_LISTAS_VENCIDAS" e a tarefa agsus_inativar_listas_vencidas.
  salvar_monitoramento_com_cronograma_v2 já grava as três colunas quando as chaves
  nu_anos_validade, nu_meses_validade e st_prorrogado vêm no p_payload (e inativa na
  hora a lista vencida). Faltava a volta: nenhuma RPC que a tela chama devolvia os três.

  O QUE MUDA
    get_monitoramento_cronograma(uuid), a leitura do formulário do edital, passa a
    devolver em 'monitoramento' as chaves nu_anos_validade, nu_meses_validade e
    st_prorrogado. O resto do corpo é o de antes, letra por letra: mesma assinatura (o
    contrato src/lib/rpc-contrato.ts só muda o resumo), permissões e grants; a resposta
    só ganha chaves. A função não tinha COMMENT; ganha um (MAD).

  DEPENDÊNCIA COM O FRONT
    O front do cartão #57 funciona antes e depois desta migration. Antes: as três chaves
    não vêm, o formulário avisa que a validade gravada não foi lida, abre os campos
    vazios e só manda no p_payload o campo que a pessoa preencher (nada gravado é
    sobrescrito). Depois: os campos abrem com o valor gravado e o prazo calculado. Pode
    ser aplicada antes ou depois do merge; antes deixa o formulário completo desde a
    publicação.

  GUARDAS (a migration não aplica nada se falhar)
    - Já aplicada: o corpo vigente é o desta migration (md5 e783a1b62e4e780aef995cd4e156752c).
    - O corpo vigente não é o que esta migration conhece (md5 19cdcd4a6520bfcc7b606e2961b0fc9c,
      lido do retrato supabase/esquema-atual.sql de 10/11/2026): alguém o mudou depois;
      junte as mudanças antes de aplicar.

  Aplicada à mão e registrada em public.migracoes_aplicadas (nunca supabase db push).

  Ensaio: supabase/ensaios/20261111200000_formulario_do_edital_le_a_validade.sql
  Rollback: supabase/rollback/20261111200000_formulario_do_edital_le_a_validade.sql
  Teste: tests/formulario-do-edital-le-a-validade-no-banco.test.ts
*/
begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_md5 text := md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_monitoramento_cronograma(uuid)')));
begin
  if v_md5 = 'e783a1b62e4e780aef995cd4e156752c' then
    raise exception 'A migration 20261111200000 já foi aplicada (get_monitoramento_cronograma já devolve a validade).';
  end if;
  if v_md5 is distinct from '19cdcd4a6520bfcc7b606e2961b0fc9c' then
    raise exception 'get_monitoramento_cronograma mudou depois de 10/11/2026 (md5 %): junte as mudanças antes de aplicar.', v_md5;
  end if;
end;
$guarda$;

create or replace function public.get_monitoramento_cronograma(p_monitoramento_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $$
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then
    raise exception 'Sem permissao para consultar cronograma';
  end if;

  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_monitoramento_id and not private."FC_PODE_VER_EDITAL"(m.id)) then
    raise exception 'Sem permissão para editais desta área' using errcode='42501';
  end if;

  return jsonb_build_object(
    'monitoramento', (
      select jsonb_build_object(
        'id', m.id,
        'edital', m.edital,
        'unidade', m.unidade,
        'cronograma_automatico', m.cronograma_automatico,
        'cronograma_origem', m.cronograma_origem,
        'cronograma_revisado_at', m.cronograma_revisado_at,
        'status_override', m.status_override,
        'etapa_override', m.etapa_override,
        'status_override_motivo', m.status_override_motivo,
        'status_override_data', m.status_override_data,
        'status_override_previsao_retomada', m.status_override_previsao_retomada,
        'cronograma_ultima_errata', m.cronograma_ultima_errata,
        -- Validade do processo seletivo (20261111200000): o formulário do edital lê e devolve.
        'nu_anos_validade', m."NU_ANOS_VALIDADE",
        'nu_meses_validade', m."NU_MESES_VALIDADE",
        'st_prorrogado', m."ST_PRORROGADO"
      )
      from public."TB_MONITORAMENTO_INDIGENA" m
      where m.id = p_monitoramento_id
    ),
    'estado', public.get_monitoramento_cronograma_estado(p_monitoramento_id, (now() at time zone 'America/Sao_Paulo')::date),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'ordem', c.ordem,
        'atividade', c.atividade,
        'tipo_atividade', c.tipo_atividade,
        'data_inicio', c.data_inicio,
        'data_fim', c.data_fim,
        'concluida', c.concluida,
        'observacao', c.observacao,
        'origem', c.origem,
        'confianca_extracao', c.confianca_extracao
      ) order by c.ordem)
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      where c.monitoramento_id = p_monitoramento_id
    ), '[]'::jsonb),
    'historico', public.get_monitoramento_cronograma_historico(p_monitoramento_id, 20)
  );
end;
$$;

comment on function public.get_monitoramento_cronograma(uuid) is 'Leitura do formulário do edital (Editais): dados do monitoramento (cronograma automático, status excepcional, última errata e a validade do processo seletivo: nu_anos_validade, nu_meses_validade e st_prorrogado, 20261111200000), estado do cronograma, etapas e histórico. Exige dashboard, nucleo, calendario, aprovados ou importacao e acesso ao edital.';

commit;
