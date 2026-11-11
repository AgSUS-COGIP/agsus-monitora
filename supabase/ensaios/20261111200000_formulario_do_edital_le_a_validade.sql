/*
  ENSAIO de 20261111200000_formulario_do_edital_le_a_validade.sql

  Roda no SQL Editor (papel postgres) ANTES de aplicar. Termina em rollback: nada
  fica no banco. Só conta; não mostra dado de pessoa.

  O que confere:
    A. O corpo vigente é o que a migration conhece (md5 de antes) e as três colunas
       existem, com a CHECK de 0 a 10 anos e 0 a 11 meses.
    B. Aplica o corpo da migration (igual ao arquivo; o teste confere).
    C. O corpo aplicado tem o md5 esperado e o COMMENT novo, e as três colunas saem
       como número e booleano no jsonb (a RPC exige sessão, que o SQL Editor não tem:
       o ensaio monta as mesmas chaves direto na tabela).
  Ok = termina com NOTICE "Ensaio 20261111200000 ok" e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_monitoramento_cronograma(uuid)'))) is distinct from '19cdcd4a6520bfcc7b606e2961b0fc9c' then
    raise exception 'get_monitoramento_cronograma não está no corpo que a migration conhece: confira antes de aplicar.';
  end if;
  if (select count(*) from pg_attribute
       where attrelid = 'public."TB_MONITORAMENTO_INDIGENA"'::regclass and not attisdropped
         and attname in ('NU_ANOS_VALIDADE', 'NU_MESES_VALIDADE', 'ST_PRORROGADO')) <> 3 then
    raise exception 'Faltam colunas de validade em TB_MONITORAMENTO_INDIGENA.';
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public."TB_MONITORAMENTO_INDIGENA"'::regclass
                    and conname = 'CK_MONITORAMENTO_INDIGENA_VALIDADE') then
    raise exception 'Falta a CHECK CK_MONITORAMENTO_INDIGENA_VALIDADE.';
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

do $confere$
declare
  v_obj jsonb;
  v_editais integer;
  v_com_prazo integer;
  v_prorrogados integer;
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_monitoramento_cronograma(uuid)'))) is distinct from 'e783a1b62e4e780aef995cd4e156752c' then
    raise exception 'Ensaio: o corpo aplicado não é o da migration.';
  end if;
  if obj_description('public.get_monitoramento_cronograma(uuid)'::regprocedure, 'pg_proc') is null then
    raise exception 'Ensaio: a função ficou sem COMMENT.';
  end if;
  select jsonb_build_object(
           'nu_anos_validade', m."NU_ANOS_VALIDADE",
           'nu_meses_validade', m."NU_MESES_VALIDADE",
           'st_prorrogado', m."ST_PRORROGADO")
    into v_obj
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo
   order by m.updated_at desc
   limit 1;
  if v_obj is not null and (
       jsonb_typeof(v_obj -> 'nu_anos_validade') is distinct from 'number'
       or jsonb_typeof(v_obj -> 'nu_meses_validade') is distinct from 'number'
       or jsonb_typeof(v_obj -> 'st_prorrogado') is distinct from 'boolean') then
    raise exception 'Ensaio: a validade não sai como número e booleano: %', v_obj;
  end if;
  select count(*),
         count(*) filter (where m."NU_ANOS_VALIDADE" * 12 + m."NU_MESES_VALIDADE" > 0),
         count(*) filter (where m."ST_PRORROGADO")
    into v_editais, v_com_prazo, v_prorrogados
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo;
  raise notice 'Editais ativos: %; com prazo de validade: %; prorrogados: %.', v_editais, v_com_prazo, v_prorrogados;
  raise notice 'Ensaio 20261111200000 ok.';
end;
$confere$;

rollback;
