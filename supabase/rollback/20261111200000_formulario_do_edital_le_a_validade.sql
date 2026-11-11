/*
  ROLLBACK de 20261111200000_formulario_do_edital_le_a_validade.sql

  Volta get_monitoramento_cronograma ao corpo de antes (md5 19cdcd4a6520bfcc7b606e2961b0fc9c, copiado do
  retrato supabase/esquema-atual.sql de 10/11/2026) e sem COMMENT, como estava: a
  resposta deixa de trazer nu_anos_validade, nu_meses_validade e st_prorrogado.

  O front continua funcionando: sem as chaves, o formulário avisa que a validade
  gravada não foi lida e só manda o campo que a pessoa preencher. Nenhum dado muda (a
  migration só troca a leitura); a validade gravada fica nas colunas.

  Guarda: não roda se a migration não foi aplicada (o corpo vigente não é o dela,
  md5 e783a1b62e4e780aef995cd4e156752c).
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_monitoramento_cronograma(uuid)'))) is distinct from 'e783a1b62e4e780aef995cd4e156752c' then
    raise exception 'O corpo vigente de get_monitoramento_cronograma não é o da migration 20261111200000: nada a desfazer.';
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
        'cronograma_ultima_errata', m.cronograma_ultima_errata
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

comment on function public.get_monitoramento_cronograma(uuid) is null;

do $confere$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_monitoramento_cronograma(uuid)'))) is distinct from '19cdcd4a6520bfcc7b606e2961b0fc9c' then
    raise exception 'Rollback: o corpo restaurado não é o de antes da migration.';
  end if;
end;
$confere$;

commit;
