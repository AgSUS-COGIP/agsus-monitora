/*
  HASH DO RETRATO PELO CONTEÚDO, IGUAL NOS DOIS MOTORES DA CLASSIFICAÇÃO (24/10/2026)

  O PROBLEMA (visto no banco, 23/10/2026): a lista PRELIMINAR do 114/2026 gerada
  pelo Python (TB_LISTA_CLASSIFICACAO 4844f3d4…, 23/10 17:15) tem o DS_RESULTADO
  igual, jsonb a jsonb, ao da lista gerada pela tela (36aa47b6…), mas o DS_HASH
  é outro: o hash era sha256(DS_RESULTADO::text), e o jsonb guarda a forma do
  número — o Python manda a nota inteira como 35.0, a tela como 35.

  O QUE MUDA: o hash passa a depender só do CONTEÚDO. private."FC_HASH_RETRATO_CLASSIFICACAO"
  calcula o sha256 do texto do jsonb com cada número sem zeros à direita
  (private."FC_JSONB_CANONICO", trim_scale: 35.0 → 35, 7.50 → 7.5). O retrato
  gravado NÃO muda (o do Python continua com 35.0, a forma que o usuário prefere);
  só a conta do hash. A tela nunca manda zero à direita, então o retrato da tela
  dá exatamente o hash de antes; o do Python passa a dar o mesmo da tela.
  Usam a função (só a linha do hash muda; o resto do corpo é o vigente):
    - private."FC_REGISTRAR_LISTA_CLASSIFICACAO" (20261023200000): o "Gerar" da
      tela (registrar_lista_classificacao) e o do Python (registrar_lista_calculada);
    - public.classificacao_gravar_calculo (20261023200000): o hash do pedido de
      cálculo (TB_PEDIDO_CALCULO_CLASSIFICACAO."DS_HASH");
    - public.registrar_lista_pre_classificacao (20261007200000): Lista Provisória e lote.
  A mesma conta na tela (src/lib/classificacao/hash-do-retrato.ts) e no Python
  (python/monitora/classificacao/hash_do_retrato.py), com o teste cruzado dos
  casos dourados (tests/fixtures/classificacao/hash-dos-retratos.json).

  O QUE NÃO MUDA: nenhum DS_HASH já gravado (listas, pedidos, relatórios de
  desempate — DS_HASH_LISTA — e publicações — DS_HASH_CLASSIFICACAO); nenhuma
  assinatura, segurança ou privilégio de RPC. Quem compara hash compara o
  gravado com o gravado (classificacao_gravar_desempate: p_hash × DS_HASH da
  lista; obter_desempate_da_lista: DS_HASH_LISTA × DS_HASH), e o hash de cada
  lista já registrada continua o mesmo. Só a lista do Python já gravada (4844f3d4…)
  fica com o hash antigo (o da forma 35.0); a próxima gerada pelo Python terá o da tela.

  PRÉ-REQUISITO: 20261023200000 (etapa 2b).
  Ensaio: supabase/ensaios/20261024130000_hash_do_retrato_pelo_conteudo.sql
  Rollback: supabase/rollback/20261024130000_hash_do_retrato_pelo_conteudo.sql
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb)') is null
     or to_regprocedure('public.classificacao_gravar_calculo(text, uuid, jsonb)') is null
     or to_regprocedure('public.registrar_lista_pre_classificacao(uuid, text, integer)') is null then
    raise exception 'Aplique antes 20261023200000_classificacao_em_python_etapa_2b.sql.';
  end if;
end;
$$;

-- 1. O hash do conteúdo -----------------------------------------------------------------------
-- O jsonb com cada número sem os zeros à direita (trim_scale): 35.0 → 35, 7.50 → 7.5. Textos,
-- chaves, listas, true/false/null ficam como estão.
create or replace function private."FC_JSONB_CANONICO"(p_valor jsonb)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path to ''
as $function$
begin
  case jsonb_typeof(p_valor)
    when 'number' then
      return to_jsonb(trim_scale(p_valor::numeric));
    when 'array' then
      return coalesce((select jsonb_agg(case jsonb_typeof(e.valor)
                                          when 'number' then to_jsonb(trim_scale(e.valor::numeric))
                                          when 'array' then private."FC_JSONB_CANONICO"(e.valor)
                                          when 'object' then private."FC_JSONB_CANONICO"(e.valor)
                                          else e.valor end
                                        order by e.ordem)
                         from jsonb_array_elements(p_valor) with ordinality e(valor, ordem)), '[]'::jsonb);
    when 'object' then
      return coalesce((select jsonb_object_agg(o.chave, case jsonb_typeof(o.valor)
                                                          when 'number' then to_jsonb(trim_scale(o.valor::numeric))
                                                          when 'array' then private."FC_JSONB_CANONICO"(o.valor)
                                                          when 'object' then private."FC_JSONB_CANONICO"(o.valor)
                                                          else o.valor end)
                         from jsonb_each(p_valor) o(chave, valor)), '{}'::jsonb);
    else
      return p_valor;
  end case;
end;
$function$;
comment on function private."FC_JSONB_CANONICO"(jsonb) is
  'O jsonb com cada número na forma canônica, sem zeros à direita (trim_scale: 35.0 → 35, 7.50 → 7.5); o resto como está (20261024130000). Base do hash do retrato da Classificação (FC_HASH_RETRATO_CLASSIFICACAO). Só o dono.';
revoke all on function private."FC_JSONB_CANONICO"(jsonb) from public, anon, authenticated, service_role;

create or replace function private."FC_HASH_RETRATO_CLASSIFICACAO"(p_retrato jsonb)
returns text
language plpgsql
immutable
parallel safe
set search_path to ''
as $function$
declare
  v_texto text := p_retrato::text;
begin
  if p_retrato is null then
    return null;
  end if;
  -- Atalho: sem número com zero à direita da vírgula (o retrato da tela), o texto já é o canônico.
  -- Texto que só parece número ("nota 35.0") cai aqui também e só custa a conta inteira.
  if v_texto ~ '\.[0-9]*0([],}]|$)' then
    v_texto := private."FC_JSONB_CANONICO"(p_retrato)::text;
  end if;
  return encode(sha256(convert_to(v_texto, 'UTF8')), 'hex');
end;
$function$;
comment on function private."FC_HASH_RETRATO_CLASSIFICACAO"(jsonb) is
  'SHA-256 (hex) do CONTEÚDO do retrato de uma lista da Classificação (20261024130000): o texto do jsonb com os números sem zeros à direita (FC_JSONB_CANONICO). O retrato do Python (nota 35.0) e o da tela (35) dão o mesmo hash; o retrato da tela dá o mesmo hash de antes (sha256 do jsonb::text). A mesma conta na tela (src/lib/classificacao/hash-do-retrato.ts) e no Python (monitora/classificacao/hash_do_retrato.py). Só o dono.';
revoke all on function private."FC_HASH_RETRATO_CLASSIFICACAO"(jsonb) from public, anon, authenticated, service_role;

-- 2. Quem grava o hash passa a usar a função (o resto do corpo é o vigente) --------------------
-- private."FC_REGISTRAR_LISTA_CLASSIFICACAO": corpo de 20261023200000 com o hash do conteúdo.
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
          private."FC_HASH_RETRATO_CLASSIFICACAO"(p_resultado),
          v_qt[1], v_qt[2], v_qt[3], v_qt[4], (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  -- O relatório de desempate desta lista, pelo Python (20261023170000).
  perform private."FC_PEDIR_DESEMPATE"(v_id, (select auth.uid()));

  return v_id;
end;
$function$;
comment on function private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb) is
  'Registra uma lista gerada (20261023200000; o corpo de registrar_lista_classificacao de 20261023170000): confere o tipo, a versão vigente da regra (PT409), a forma, o tamanho e os candidatos do retrato, grava com o hash SHA-256 do conteúdo calculado aqui (FC_HASH_RETRATO_CLASSIFICACAO, 20261024130000) e pede o relatório de desempate (FC_PEDIR_DESEMPATE). Devolve o id da lista. Sem porteiro: só o dono (registrar_lista_classificacao e registrar_lista_calculada, que conferem a permissão).';
revoke all on function private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb) from public, anon, authenticated, service_role;

-- public.classificacao_gravar_calculo: corpo de 20261023200000 com o hash do conteúdo.
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

  v_hash := private."FC_HASH_RETRATO_CLASSIFICACAO"(p_retrato);
  update public."TB_PEDIDO_CALCULO_CLASSIFICACAO"
     set "TP_SITUACAO" = 'PRONTO', "DS_RETRATO" = p_retrato, "DS_HASH" = v_hash, "DS_MENSAGEM" = null,
         "CO_EXECUCAO" = p_execucao, "DT_ATUALIZACAO" = now()
   where "CO_PEDIDO_CALCULO" = p_pedido;
  return jsonb_build_object('pedido', p_pedido, 'situacao', 'PRONTO', 'hash', v_hash);
end;
$function$;
comment on function public.classificacao_gravar_calculo(text, uuid, jsonb) is
  'Job da classificação em Python (--calculo, 20261023200000): grava o retrato calculado pelo Python num pedido que espera (PEDIDO ou CALCULANDO; senão 55000), confere a forma (tipo, vagas, totais), a versão da regra do pedido e a vigente (PT409), o tamanho e os candidatos do edital (FC_EXIGIR_CANDIDATOS_DO_EDITAL), calcula o hash SHA-256 do conteúdo (FC_HASH_RETRATO_CLASSIFICACAO, 20261024130000: o mesmo que a lista registrada receberá) e marca PRONTO. Só service_role.';
revoke all on function public.classificacao_gravar_calculo(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.classificacao_gravar_calculo(text, uuid, jsonb) to service_role;

-- public.registrar_lista_pre_classificacao: corpo de 20261007200000 com o hash do conteúdo.
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
          private."FC_HASH_RETRATO_CLASSIFICACAO"(v_resultado), v_elegiveis, v_eliminados, 0, 0, (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return json_build_object('lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_id), 'resultado', v_resultado);
end;
$function$;
comment on function public.registrar_lista_pre_classificacao(uuid, text, integer) is
  'Registra a lista PROVISORIA (por vaga: classificação, nome e nota da ART; os eliminados automáticos com o motivo) ou LOTE (os do lote; com p_lote, só aquele lote — uma reposição) em TB_LISTA_CLASSIFICACAO, montando o retrato a partir de TB_PRE_CLASSIFICACAO (sem conta: só leitura e ordem já gravadas; desde 20261007200000, quem entrou no lote por decisão da coordenação leva o motivo em "decisao", que o documento mostra em nota). Exige a coordenação da avaliação do edital ou Editor na Classificação, a regra de classificação do edital e a pré-classificação já gravada. Devolve os metadados e o retrato. Hash do conteúdo: FC_HASH_RETRATO_CLASSIFICACAO (20261024130000).';
revoke all on function public.registrar_lista_pre_classificacao(uuid, text, integer) from public, anon;
grant execute on function public.registrar_lista_pre_classificacao(uuid, text, integer) to authenticated;

-- 3. As colunas dizem a conta nova ---------------------------------------------------------------
comment on column public."TB_LISTA_CLASSIFICACAO"."DS_HASH" is 'SHA-256 (hex) do CONTEÚDO de DS_RESULTADO, calculado no banco na gravação (FC_HASH_RETRATO_CLASSIFICACAO: números sem zeros à direita, 20261024130000; antes, sha256 de DS_RESULTADO::text).';
comment on column public."TB_PEDIDO_CALCULO_CLASSIFICACAO"."DS_HASH" is 'SHA-256 do conteúdo do retrato (FC_HASH_RETRATO_CLASSIFICACAO, 20261024130000; o mesmo que a lista registrada recebe).';

commit;
