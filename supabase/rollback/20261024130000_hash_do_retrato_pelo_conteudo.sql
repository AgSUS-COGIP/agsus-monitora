-- ROLLBACK de supabase/migrations/20261024130000_hash_do_retrato_pelo_conteudo.sql
-- Volta ao hash da forma (sha256 de DS_RESULTADO::text): os corpos de 20261023200000
-- (FC_REGISTRAR_LISTA_CLASSIFICACAO, classificacao_gravar_calculo) e de 20261007200000
-- (registrar_lista_pre_classificacao), e apaga FC_HASH_RETRATO_CLASSIFICACAO e FC_JSONB_CANONICO.
-- Nenhum DS_HASH gravado muda (nem na ida nem na volta).
begin;

set local lock_timeout = '5s';

create or replace function private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_id uuid;
  v_totais jsonb := coalesce(p_resultado -> 'totais', '{}'::jsonb);
  v_qt integer[];
begin
  if p_tipo is null or p_tipo not in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL') then
    raise exception 'Tipo de lista inválido' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Salve a regra do edital antes de gerar a lista.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
  end if;
  if jsonb_typeof(p_resultado) is distinct from 'object' or jsonb_typeof(p_resultado -> 'vagas') is distinct from 'array'
     or p_resultado ->> 'tipo' is distinct from p_tipo then
    raise exception 'Lista inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_resultado) > 8000000 then
    raise exception 'Lista grande demais para registrar.' using errcode = '22023';
  end if;
  -- Os candidatos do retrato são análises ativas deste edital (20261006070000).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_edital, p_resultado);
  select array_agg(case when jsonb_typeof(v_totais -> k) = 'number'
                        then greatest(0, least(1000000, (v_totais ->> k)::numeric))::integer else 0 end order by o)
    into v_qt
    from unnest(array['elegiveis', 'eliminados', 'avisos', 'pendencias']) with ordinality t(k, o);

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", p_resultado,
          encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex'),
          v_qt[1], v_qt[2], v_qt[3], v_qt[4], (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  -- O relatório de desempate desta lista, pelo Python (20261023170000).
  perform private."FC_PEDIR_DESEMPATE"(v_id, (select auth.uid()));

  return v_id;
end;
$function$;
comment on function private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb) is
  'Registra uma lista gerada (20261023200000; o corpo de registrar_lista_classificacao de 20261023170000): confere o tipo, a versão vigente da regra (PT409), a forma, o tamanho e os candidatos do retrato, grava com o hash SHA-256 calculado aqui e pede o relatório de desempate (FC_PEDIR_DESEMPATE). Devolve o id da lista. Sem porteiro: só o dono (registrar_lista_classificacao e registrar_lista_calculada, que conferem a permissão).';
revoke all on function private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb) from public, anon, authenticated, service_role;

create or replace function public.classificacao_gravar_calculo(p_execucao text, p_pedido uuid, p_retrato jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_PEDIDO_CALCULO_CLASSIFICACAO";
  v_vigente integer;
  v_hash text;
begin
  if coalesce(p_execucao, '') !~ '^[A-Za-z0-9_.:-]{1,80}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  select * into v from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" p where p."CO_PEDIDO_CALCULO" = p_pedido for update;
  if v."CO_PEDIDO_CALCULO" is null then
    raise exception 'Pedido de cálculo não encontrado' using errcode = '22023';
  end if;
  if v."TP_SITUACAO" not in ('PEDIDO', 'CALCULANDO') then
    raise exception 'O pedido já saiu da fila (%)', lower(v."TP_SITUACAO") using errcode = '55000';
  end if;
  if p_retrato is null or jsonb_typeof(p_retrato) <> 'object'
     or p_retrato ->> 'tipo' is distinct from v."TP_LISTA"
     or coalesce(jsonb_typeof(p_retrato -> 'vagas'), '') <> 'array'
     or coalesce(jsonb_typeof(p_retrato -> 'totais'), '') <> 'object'
     or coalesce(jsonb_typeof(p_retrato -> 'regra_versao'), '') <> 'number'
     or (p_retrato ->> 'regra_versao')::numeric <> v."NU_VERSAO_REGRA" then
    raise exception 'Retrato inválido (tipo, vagas, totais ou versão da regra)' using errcode = '22023';
  end if;
  if pg_column_size(p_retrato) > 8000000 then
    raise exception 'Retrato grande demais.' using errcode = '22023';
  end if;
  select r."NU_VERSAO_VIGENTE" into v_vigente from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v."CO_MONITORAMENTO";
  if v_vigente is distinct from v."NU_VERSAO_REGRA" then
    raise exception 'A regra do edital mudou desde o pedido; gere de novo.' using errcode = 'PT409';
  end if;
  -- Os candidatos do retrato são análises ativas deste edital (a mesma conferência do registro).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(v."CO_MONITORAMENTO", p_retrato);

  v_hash := encode(sha256(convert_to(p_retrato::text, 'UTF8')), 'hex');
  update public."TB_PEDIDO_CALCULO_CLASSIFICACAO"
     set "TP_SITUACAO" = 'PRONTO', "DS_RETRATO" = p_retrato, "DS_HASH" = v_hash, "DS_MENSAGEM" = null,
         "CO_EXECUCAO" = p_execucao, "DT_ATUALIZACAO" = now()
   where "CO_PEDIDO_CALCULO" = p_pedido;
  return jsonb_build_object('pedido', p_pedido, 'situacao', 'PRONTO', 'hash', v_hash);
end;
$function$;
comment on function public.classificacao_gravar_calculo(text, uuid, jsonb) is
  'Job da classificação em Python (--calculo, 20261023200000): grava o retrato calculado pelo Python num pedido que espera (PEDIDO ou CALCULANDO; senão 55000), confere a forma (tipo, vagas, totais), a versão da regra do pedido e a vigente (PT409), o tamanho e os candidatos do edital (FC_EXIGIR_CANDIDATOS_DO_EDITAL), calcula o hash SHA-256 (o mesmo que a lista registrada receberá) e marca PRONTO. Só service_role.';
revoke all on function public.classificacao_gravar_calculo(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.classificacao_gravar_calculo(text, uuid, jsonb) to service_role;

create or replace function public.registrar_lista_pre_classificacao(p_edital uuid, p_tipo text, p_lote integer default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_resultado jsonb;
  v_id uuid;
  v_elegiveis integer;
  v_eliminados integer;
begin
  if private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR' then
    v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3);
  else
    v_area := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  end if;
  if p_tipo is null or p_tipo not in ('PROVISORIA', 'LOTE') then
    raise exception 'Tipo de lista inválido: PROVISORIA ou LOTE' using errcode = '22023';
  end if;
  if p_lote is not null and (p_tipo <> 'LOTE' or p_lote not between 1 and 999) then
    raise exception 'Número do lote só na lista LOTE, de 1 a 999' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Cadastre a regra de classificação do edital antes de registrar a lista.' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = p_edital) then
    raise exception 'O edital ainda não tem pré-classificação: rode o Recalcular.' using errcode = '22023';
  end if;
  if p_lote is not null and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                         where a."CO_MONITORAMENTO" = p_edital and a."NU_LOTE" = p_lote) then
    raise exception 'Não há ninguém no lote %.', p_lote using errcode = '22023';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;

  -- O retrato (formato de src/lib/classificacao/exportacao.js): só nome, posição, nota e motivo.
  select jsonb_build_object(
           'schema', 1,
           'tipo', p_tipo,
           'edital', jsonb_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade),
           'regra_versao', v_regra."NU_VERSAO_VIGENTE",
           'regra_analise_versao', (select max(a."NU_VERSAO_REGRA") from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = p_edital),
           'lote', p_lote,
           'casas', 1,
           'modalidades', '[]'::jsonb,
           'vagas', coalesce(jsonb_agg(jsonb_build_object(
             'chave', pv."CO_VAGA",
             'codigo', pv."CO_VAGA",
             'cargo', pv."NO_CARGO",
             'lotacao', pv."NO_LOTACAO",
             'cabecalho', concat_ws(' - ', 'VAGA ' || pv."CO_VAGA", pv."NO_CARGO", pv."NO_LOTACAO",
                            case when coalesce(pv."QT_VAGA_IMEDIATA", 0) = 0 and pv."ST_CADASTRO_RESERVA" = 'S' then 'Cadastro reserva'
                                 when pv."QT_VAGA_IMEDIATA" is null then null
                                 else pv."QT_VAGA_IMEDIATA" || case when pv."QT_VAGA_IMEDIATA" = 1 then ' vaga' else ' vagas' end
                                      || case when pv."ST_CADASTRO_RESERVA" = 'S' then ' + CR' else '' end end),
             'total', pv."QT_VAGA_IMEDIATA",
             'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
             'geral', coalesce((
               select jsonb_agg(jsonb_build_object('posicao', a."NU_POSICAO", 'nome', c."NO_CANDIDATO",
                                                   'nota', a."VL_NOTA_ORDEM", 'modalidades', jsonb_build_array(a."NO_MODALIDADE"),
                                                   'situacao', a."TP_SITUACAO", 'lote', a."NU_LOTE",
                                                   -- Quem entrou no lote por decisão da coordenação: o motivo (nota no documento).
                                                   'decisao', case when a."TP_ENTRADA_LOTE" = 'DECISAO' then a."DS_MOTIVO_ENTRADA" end)
                                order by a."NU_POSICAO")
                 from public."TB_PRE_CLASSIFICACAO" a
                 join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
                where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = pv."CO_VAGA"
                  and case when p_tipo = 'PROVISORIA' then a."TP_SITUACAO" <> 'ELIMINADO'
                           else a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and (p_lote is null or a."NU_LOTE" = p_lote) end), '[]'::jsonb),
             'listas', '{}'::jsonb,
             'eliminados', case when p_tipo = 'PROVISORIA' then coalesce((
               select jsonb_agg(jsonb_build_object('nome', c."NO_CANDIDATO", 'motivo', a."DS_MOTIVO_ELIMINACAO", 'detalhe', '')
                                order by c."NO_CANDIDATO")
                 from public."TB_PRE_CLASSIFICACAO" a
                 join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
                where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = pv."CO_VAGA" and a."TP_SITUACAO" = 'ELIMINADO'), '[]'::jsonb)
               else '[]'::jsonb end)
             order by pv."CO_VAGA"), '[]'::jsonb),
           'avisos', '[]'::jsonb,
           'pendencias', '[]'::jsonb)
    into v_resultado
    from public."TB_PRE_CLASSIF_VAGA" pv
   where pv."CO_MONITORAMENTO" = p_edital;

  select coalesce(sum(jsonb_array_length(v -> 'geral')), 0), coalesce(sum(jsonb_array_length(v -> 'eliminados')), 0)
    into v_elegiveis, v_eliminados
    from jsonb_array_elements(v_resultado -> 'vagas') v;
  v_resultado := v_resultado || jsonb_build_object('totais', jsonb_build_object(
    'elegiveis', v_elegiveis, 'eliminados', v_eliminados, 'avisos', 0, 'pendencias', 0));

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", v_resultado,
          encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'), v_elegiveis, v_eliminados, 0, 0, (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return json_build_object('lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_id), 'resultado', v_resultado);
end;
$function$;
comment on function public.registrar_lista_pre_classificacao(uuid, text, integer) is
  'Registra a lista PROVISORIA (por vaga: classificação, nome e nota da ART; os eliminados automáticos com o motivo) ou LOTE (os do lote; com p_lote, só aquele lote — uma reposição) em TB_LISTA_CLASSIFICACAO, montando o retrato a partir de TB_PRE_CLASSIFICACAO (sem conta: só leitura e ordem já gravadas; desde 20261007200000, quem entrou no lote por decisão da coordenação leva o motivo em "decisao", que o documento mostra em nota). Exige a coordenação da avaliação do edital ou Editor na Classificação, a regra de classificação do edital e a pré-classificação já gravada. Devolve os metadados e o retrato.';
revoke all on function public.registrar_lista_pre_classificacao(uuid, text, integer) from public, anon;
grant execute on function public.registrar_lista_pre_classificacao(uuid, text, integer) to authenticated;

comment on column public."TB_LISTA_CLASSIFICACAO"."DS_HASH" is 'SHA-256 (hex) do texto de DS_RESULTADO, calculado no banco na gravação.';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."DS_HASH" is 'SHA-256 do retrato (o mesmo que a lista registrada recebe).';

drop function if exists private."FC_HASH_RETRATO_CLASSIFICACAO"(jsonb);
drop function if exists private."FC_JSONB_CANONICO"(jsonb);

commit;
