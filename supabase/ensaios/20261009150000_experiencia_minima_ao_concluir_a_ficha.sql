/*
  ENSAIO de 20261009150000_experiencia_minima_ao_concluir_a_ficha.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Autossuficiente: não
  depende de ids fixos. Dentro da transação, aplica a migration, pega uma
  ficha PENDENTE do treinamento de Projetos (992/2099, ST_TREINAMENTO = 'S'),
  cria uma analista sintética (só nesta transação), distribui a ficha para
  ela e a reserva pela tela (reservar_ficha). Depois conclui
  (concluir_ficha) com o conteúdo montado da regra vigente do edital (cada
  falha para com "FALHOU En"; o resultado é a última consulta):
    E1  Experiência Conforme sem vínculo (0 meses < mínimo): concluir_ficha
        recusa (22023) com "experiência mínima … não comprovada";
    E2  com um vínculo aceito de 32 meses: conclui (desfeito em seguida);
    E3  Experiência Não conforme com motivo, sem vínculo: conclui Inapto por
        requisito (desfeito em seguida);
    E4  a ficha segue em análise (nada ficou concluído).
*/
begin;

set local lock_timeout = '10s';

CREATE OR REPLACE FUNCTION private."FC_PENDENCIAS_FICHA"(p_regra jsonb, p_lanc jsonb, p_res jsonb)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_bloco jsonb;
  v_l jsonb;
  v_parcial text;
  v_decl jsonb;
  v_apur jsonb;
  v_tem_opcoes boolean;
  v_itens text;
  v_pend text[] := '{}';
  v_titulo text;
begin
  for v_bloco in select b from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b loop
    continue when v_bloco ->> 'tipo' = 'REGISTRO' or not private."FC_BLOCO_SE_APLICA"(v_bloco, p_lanc);
    v_l := coalesce(p_lanc #> array['blocos', v_bloco ->> 'codigo'], '{}'::jsonb);
    v_titulo := coalesce(v_bloco ->> 'titulo', v_bloco ->> 'codigo');
    if coalesce(v_l ->> 'situacao', '') = '' then
      v_pend := v_pend || (v_titulo || ': marque a situação');
    end if;
    if v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO')
       and jsonb_array_length(coalesce(v_l -> 'motivos', '[]'::jsonb)) = 0
       and not (jsonb_array_length(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) = 0 and length(btrim(coalesce(v_l ->> 'motivo_livre', ''))) >= 10) then
      v_pend := v_pend || (v_titulo || ': escolha o motivo');
    end if;
    v_itens := case v_bloco ->> 'tipo' when 'TITULOS' then 'titulos' when 'CURSOS' then 'cursos' when 'VINCULOS' then 'vinculos' end;
    if v_itens is not null and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> v_itens, '[]'::jsonb)) i
          where i -> 'aceito' = 'false'::jsonb and coalesce(i ->> 'motivo', '') = '') then
      v_pend := v_pend || (v_titulo || ': item recusado sem motivo');
    end if;
    if v_itens = 'vinculos' and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> 'vinculos', '[]'::jsonb)) i
          where coalesce(i ->> 'inicio', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(i ->> 'fim', '') !~ '^\d{4}-\d{2}-\d{2}$'
             or i ->> 'fim' < i ->> 'inicio') then
      v_pend := v_pend || (v_titulo || ': vínculo com data inválida');
    end if;
    -- Experiência Conforme abaixo do mínimo pelos vínculos aceitos (a conta
    -- que a tela grava em DS_RESULTADO.experiencia) eliminaria em silêncio:
    -- lance os vínculos ou marque Não conforme (pendenciasDaFicha, tipo minimo).
    if v_bloco ->> 'tipo' = 'VINCULOS' and v_l ->> 'situacao' = 'CONFORME'
       and jsonb_typeof(v_bloco -> 'minimo_meses') = 'number' and (v_bloco ->> 'minimo_meses')::numeric > 0
       and coalesce(v_bloco ->> 'efeito_minimo', 'ELIMINA') = 'ELIMINA'
       and coalesce((p_res #>> array['experiencia',
             case when v_bloco -> 'minimo_conta_estagio' = 'true'::jsonb then 'meses_considerados' else 'meses' end])::numeric, 0)
           < (v_bloco ->> 'minimo_meses')::numeric then
      v_pend := v_pend || (v_titulo || ': experiência mínima de ' || (v_bloco ->> 'minimo_meses')
                           || ' meses não comprovada pelos vínculos aceitos');
    end if;
    -- Nota diferente da declarada exige justificativa (fora do inapto por requisito).
    v_parcial := private."FC_PARCIAL_DO_TIPO"(v_bloco ->> 'tipo');
    v_decl := p_res #> array['declarada', coalesce(v_parcial, '')];
    v_apur := p_res #> array['parciais', coalesce(v_parcial, '')];
    if v_parcial is not null and p_res ->> 'resultado' <> 'INAPTO_REQUISITO'
       and jsonb_typeof(v_decl) = 'number' and jsonb_typeof(v_apur) = 'number'
       and abs((v_decl #>> '{}')::numeric - (v_apur #>> '{}')::numeric) > 0.0001 then
      v_tem_opcoes := jsonb_array_length(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) > 0
                      or jsonb_array_length(coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb)) > 0;
      if jsonb_array_length(coalesce(v_l -> 'justificativas', '[]'::jsonb)) = 0
         and not (v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO')
                  and (jsonb_array_length(coalesce(v_l -> 'motivos', '[]'::jsonb)) > 0 or length(btrim(coalesce(v_l ->> 'motivo_livre', ''))) >= 10))
         and not (not v_tem_opcoes and length(btrim(coalesce(v_l ->> 'justificativa_livre', ''))) >= 10) then
        v_pend := v_pend || (v_titulo || ': nota diferente da declarada sem justificativa');
      end if;
    end if;
  end loop;
  return v_pend;
end;
$function$
;

comment on function private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb) is
  'O que falta para concluir (pendenciasDaFicha de ficha.js): situação de cada bloco que se aplica, motivo do Não conforme/Não enviado, motivo do item recusado, datas dos vínculos, experiência Conforme abaixo do mínimo da regra pelos vínculos aceitos e justificativa de toda nota diferente da declarada (fora do inapto por requisito). Vazio = pode concluir.';

-- E0. O treinamento de Projetos, a regra vigente, uma ficha pendente e a analista sintética.
do $$
declare
  c_uid constant uuid := '00000000-0000-4000-a000-0000000e1501';
  v_edital uuid;
  v_ficha uuid;
  v_regra jsonb;
  v_versao_regra integer;
  v_exp jsonb;
begin
  select m.id into v_edital from public."TB_MONITORAMENTO_INDIGENA" m
   where m."ST_TREINAMENTO" = 'S' and m."CO_AREA" = 'projetos'
     and private."FC_NUMERO_EDITAL"(m.edital) = '992/2099'
   limit 1;
  if v_edital is null then raise exception 'FALHOU E0: treinamento 992/2099 (Projetos) não encontrado'; end if;
  select r."NU_VERSAO_VIGENTE", h."DS_CONFIGURACAO" into v_versao_regra, v_regra
    from public."TB_REGRA_ANALISE" r
    join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
   where r."CO_MONITORAMENTO" = v_edital;
  if v_regra is null then raise exception 'FALHOU E0: o treinamento não tem regra'; end if;
  select b into v_exp from jsonb_array_elements(v_regra -> 'blocos') b where b ->> 'tipo' = 'VINCULOS' limit 1;
  if v_exp is null or coalesce((v_exp ->> 'minimo_meses')::numeric, 0) <= 0
     or coalesce(v_exp ->> 'efeito_minimo', 'ELIMINA') <> 'ELIMINA' then
    raise exception 'FALHOU E0: a regra do treinamento não tem experiência mínima eliminatória';
  end if;
  -- Concluir exige a regra conferida (só nesta transação).
  update public."TB_REGRA_ANALISE" set "TP_SITUACAO" = 'CONFERIDA'
   where "CO_MONITORAMENTO" = v_edital and "TP_SITUACAO" <> 'CONFERIDA';

  select f."CO_FICHA_ANALISE" into v_ficha from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = v_edital and f."TP_SITUACAO" = 'PENDENTE'
   order by f."CO_FICHA_ANALISE" limit 1;
  if v_ficha is null then raise exception 'FALHOU E0: nenhuma ficha pendente no treinamento'; end if;

  insert into auth.users (id, instance_id, aud, role, email)
  values (c_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.e1501@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo)
  values (c_uid, 'ensaio.e1501@ensaio.invalid', 'Ensaio Experiência Mínima', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, 'projetos' from public."TB_PERFIL_USUARIO" u where u.user_id = c_uid;
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select u.id, 'avaliacao_documental', 'editor', c_uid from public."TB_PERFIL_USUARIO" u where u.user_id = c_uid;
  insert into public."RL_ANALISTA_EDITAL" ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_VAGA", "CO_USUARIO_ATUALIZACAO")
  values (v_edital, c_uid, 'ANALISTA', null, c_uid);
  -- A coordenação distribui a ficha para a analista (a tela então reserva).
  update public."TB_FICHA_ANALISE" set "CO_USUARIO_RESPONSAVEL" = c_uid, "DT_ATRIBUICAO" = now(),
         "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null
   where "CO_FICHA_ANALISE" = v_ficha;

  perform set_config('ensaio.ficha', v_ficha::text, true);
  perform set_config('ensaio.regra', v_regra::text, true);
  perform set_config('ensaio.versao_regra', v_versao_regra::text, true);
  perform set_config('ensaio.documental', private."FC_DOCUMENTAL_DO_EDITAL"(v_edital)::text, true);
  raise notice 'ok E0: treinamento 992/2099, ficha %, regra v%', v_ficha, v_versao_regra;
end;
$$;

-- E1 a E3, como a analista (papel authenticated).
set local role authenticated;
do $$
declare
  c_claims constant text := '{"sub":"00000000-0000-4000-a000-0000000e1501","role":"authenticated","email":"ensaio.e1501@ensaio.invalid"}';
  c_elimina constant jsonb := '["Item do edital: não comprovou a experiência profissional mínima."]';
  c_zero constant jsonb := '{"dias_total":0,"meses":0,"meses_considerados":0}';
  v_ficha uuid := current_setting('ensaio.ficha')::uuid;
  v_regra jsonb := current_setting('ensaio.regra')::jsonb;
  v_versao_regra integer := current_setting('ensaio.versao_regra')::integer;
  v_doc jsonb := current_setting('ensaio.documental')::jsonb;
  v json;
  v_versao integer;
  v_exp jsonb;
  v_base jsonb;
  v_blocos jsonb := '{}';
  v_parciais jsonb := '{}';
  v_b jsonb;
  v_parcial text;
  v_minima numeric;
  v_nota numeric;
  v_lanc jsonb;
  v_res jsonb;
  v_motivo text;
  v_msg text;
begin
  perform set_config('request.jwt.claims', c_claims, true);
  v := public.reservar_ficha(v_ficha);
  if not coalesce((v ->> 'reservada')::boolean, false) then
    raise exception 'FALHOU E0: a analista não reservou: %', v ->> 'motivo';
  end if;
  v_versao := (v -> 'ficha' ->> 'versao')::int;

  -- O conteúdo: todo bloco que se aplica Conforme; os que pontuam com 0, menos a experiência.
  v_base := '{"nivel":"superior","modalidade":"AC","indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,
              "estagio_horas":0,"titulos":[],"cursos":[],"vinculos":[],"observacoes":"","observacoes_prontas":[]}';
  for v_b in select b from jsonb_array_elements(v_regra -> 'blocos') b loop
    continue when v_b ->> 'tipo' = 'REGISTRO' or not private."FC_BLOCO_SE_APLICA"(v_b, v_base);
    v_parcial := private."FC_PARCIAL_DO_TIPO"(v_b ->> 'tipo');
    if v_b ->> 'tipo' = 'VINCULOS' then
      v_exp := v_b;
    elsif v_parcial is not null then
      v_blocos := v_blocos || jsonb_build_object(v_b ->> 'codigo', '{"situacao":"CONFORME","motivos":[],"nota_ajustada":0}'::jsonb);
      v_parciais := v_parciais || jsonb_build_object(v_parcial, 0);
    else
      v_blocos := v_blocos || jsonb_build_object(v_b ->> 'codigo', '{"situacao":"CONFORME","motivos":[]}'::jsonb);
    end if;
  end loop;
  if v_exp is null then raise exception 'FALHOU E0: o bloco de vínculos não se aplica'; end if;
  v_parcial := private."FC_PARCIAL_DO_TIPO"('VINCULOS');
  v_minima := case when jsonb_typeof(v_doc #> '{nota_minima_por_nivel,superior}') = 'number'
                   then (v_doc #>> '{nota_minima_por_nivel,superior}')::numeric
                   when jsonb_typeof(v_doc -> 'nota_minima') = 'number' then (v_doc ->> 'nota_minima')::numeric end;
  v_nota := least(20, coalesce(private."FC_TETO_DO_BLOCO"(v_exp, 'superior'), 20));

  -- E1. Conforme, sem vínculo: 0 meses.
  v_lanc := v_base || jsonb_build_object('blocos', v_blocos || jsonb_build_object(v_exp ->> 'codigo',
              '{"situacao":"CONFORME","motivos":[],"nota_ajustada":0}'::jsonb));
  v_res := jsonb_build_object('resultado', 'INAPTO_REQUISITO', 'nota_apurada', 0, 'nota_final', 0,
             'parciais', v_parciais || jsonb_build_object(v_parcial, 0), 'eliminatorios', c_elimina, 'experiencia', c_zero);
  begin
    perform public.concluir_ficha(v_ficha, v_versao, v_versao_regra, v_lanc, v_res, 'Parecer do ensaio');
    raise exception 'FALHOU E1: concluiu a Experiência Conforme sem vínculo';
  exception when sqlstate '22023' then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%experiência mínima%não comprovada%' then
      raise exception 'FALHOU E1: recusou por outro motivo: %', v_msg;
    end if;
  end;
  raise notice 'ok E1: %', v_msg;

  -- E2. Com um vínculo aceito de 32 meses: conclui (e desfaz).
  v_lanc := v_base || jsonb_build_object(
    'blocos', v_blocos || jsonb_build_object(v_exp ->> 'codigo', '{"situacao":"CONFORME","motivos":[]}'::jsonb),
    'vinculos', jsonb_build_array(jsonb_build_object('empregador', 'Empresa do ensaio',
                  'categoria', v_exp #>> '{categorias,0,codigo}', 'inicio', '2024-02-08', 'fim', '2026-10-01', 'aceito', true)));
  v_res := jsonb_build_object(
    'resultado', case when v_minima is not null and v_nota < v_minima then 'INAPTO_NOTA' else 'APTO' end,
    'nota_apurada', v_nota, 'nota_final', v_nota,
    'parciais', v_parciais || jsonb_build_object(v_parcial, v_nota), 'eliminatorios', '[]'::jsonb,
    'experiencia', '{"dias_total":967,"meses":32,"meses_considerados":32}'::jsonb);
  begin
    perform public.concluir_ficha(v_ficha, v_versao, v_versao_regra, v_lanc, v_res, 'Parecer do ensaio');
    raise exception 'ENSAIO_DESFAZ';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'ENSAIO_DESFAZ' then raise exception 'FALHOU E2: não concluiu com o vínculo: %', v_msg; end if;
  end;
  raise notice 'ok E2: com o vínculo de 32 meses conclui';

  -- E3. Não conforme com motivo, sem vínculo: conclui Inapto por requisito (e desfaz).
  v_motivo := v_exp #>> '{motivos,0,codigo}';
  v_lanc := v_base || jsonb_build_object('blocos', v_blocos || jsonb_build_object(v_exp ->> 'codigo',
              case when v_motivo is null
                   then '{"situacao":"NAO_CONFORME","motivos":[],"motivo_livre":"Sem comprovante de experiência no ensaio.","nota_ajustada":0}'::jsonb
                   else jsonb_build_object('situacao', 'NAO_CONFORME', 'motivos', jsonb_build_array(v_motivo), 'nota_ajustada', 0) end));
  v_res := jsonb_build_object('resultado', 'INAPTO_REQUISITO', 'nota_apurada', 0, 'nota_final', 0,
             'parciais', v_parciais || jsonb_build_object(v_parcial, 0), 'eliminatorios', c_elimina, 'experiencia', c_zero);
  begin
    v := public.concluir_ficha(v_ficha, v_versao, v_versao_regra, v_lanc, v_res, 'Parecer do ensaio');
    if v ->> 'resultado' <> 'INAPTO_REQUISITO' then raise exception 'FALHOU E3: resultado %', v ->> 'resultado'; end if;
    raise exception 'ENSAIO_DESFAZ';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg <> 'ENSAIO_DESFAZ' then raise exception 'FALHOU E3: não concluiu Inapto: %', v_msg; end if;
  end;
  raise notice 'ok E3: Não conforme com motivo conclui Inapto por requisito';
  perform set_config('request.jwt.claims', '', true);
end;
$$;
reset role;

-- E4. Nada ficou concluído: a ficha segue em análise.
do $$
begin
  if (select f."TP_SITUACAO" from public."TB_FICHA_ANALISE" f
       where f."CO_FICHA_ANALISE" = current_setting('ensaio.ficha')::uuid) <> 'EM_ANALISE' then
    raise exception 'FALHOU E4: a ficha do ensaio mudou de situação';
  end if;
end;
$$;

select 'ENSAIO OK' as resultado, current_setting('ensaio.ficha') as ficha_do_ensaio;

rollback;
