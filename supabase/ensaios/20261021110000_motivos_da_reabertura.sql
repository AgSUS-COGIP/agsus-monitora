/*
  ENSAIO de 20261021110000_motivos_da_reabertura.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica as funções novas
  dentro da transação e confere:
    1. FC_MOTIVO_PARECE_TEXTO com os motivos reais do histórico (os
       aleatórios reprovam; os bons passam);
    2. reabrir_ficha numa ficha concluída, como a última pessoa que reabriu
       uma ficha (coordenação do edital): a chamada antiga (texto livre)
       recusada com 22023; "Outro" curto ou aleatório recusado; complemento
       aleatório recusado; motivo da lista com complemento grava o rótulo no
       DS_MOTIVO e o código no DS_ALTERACAO;
    3. a lista dos motivos já gravados na fila e na reabertura com o que a
       regra nova diria (só leitura).
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';


create or replace function private."FC_MOTIVO_PARECE_TEXTO"(p_texto text, p_minimo_palavras integer)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select lower(coalesce(p_texto, '')) !~ '([[:alpha:]])\1{3,}'
     and (select count(distinct w)
            from regexp_split_to_table(lower(coalesce(p_texto, '')), '[^[:alpha:]]+') w
           where length(w) >= 2
             and (length(w) <= 3
                  or length(regexp_replace(w, '[^aeiouáàâãéêíóôõúü]', '', 'g')) * 5 >= length(w))
         ) >= coalesce(p_minimo_palavras, 1);
$function$;
comment on function private."FC_MOTIVO_PARECE_TEXTO"(text, integer) is
  'Motivo que parece texto (20261021110000): sem letra repetida 4 vezes seguidas e com pelo menos N palavras diferentes (2+ letras; até 3 letras ou vogais em 1 de cada 5). O mesmo que motivoPareceTexto (src/lib/avaliacao-documental/qualidade-do-motivo.ts).';
revoke all on function private."FC_MOTIVO_PARECE_TEXTO"(text, integer) from public, anon, authenticated;

create or replace function private."FC_MOTIVO_REABERTURA"(p_codigo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_codigo
    when 'EXPERIENCIA' then 'Correção de experiência'
    when 'CURSOS' then 'Correção de cursos'
    when 'FORMACAO' then 'Correção de formação/titulação'
    when 'REQUISITO' then 'Correção de escolaridade ou requisito do cargo'
    when 'IDENTIDADE' then 'Correção de documento de identificação'
    when 'COTA' then 'Correção de cota (PP/PI/PQ/PcD)'
    when 'ETNICO' then 'Correção do critério étnico'
    when 'DOCUMENTO_NOVO' then 'Documento novo da Empregare'
    when 'RECURSO' then 'Decisão de recurso'
    when 'COORDENACAO' then 'Pedido da coordenação ou revisão'
    when 'DIGITACAO' then 'Erro de digitação ou lançamento'
    when 'OUTRO' then 'Outro'
  end;
$function$;
comment on function private."FC_MOTIVO_REABERTURA"(text) is
  'Rótulo do motivo de reabertura da ficha pelo código (lista fixa, 20261021110000), ou null fora da lista. Os mesmos de MOTIVOS_DA_REABERTURA (src/lib/avaliacao-documental/motivos-da-reabertura.ts).';
revoke all on function private."FC_MOTIVO_REABERTURA"(text) from public, anon, authenticated;

drop function if exists public.reabrir_ficha(uuid, integer, text);

CREATE OR REPLACE FUNCTION public.reabrir_ficha(p_ficha uuid, p_versao integer, p_motivo text, p_complemento text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_codigo text := upper(btrim(coalesce(p_motivo, '')));
  v_rotulo text := private."FC_MOTIVO_REABERTURA"(upper(btrim(coalesce(p_motivo, ''))));
  v_complemento text := nullif(regexp_replace(btrim(coalesce(p_complemento, '')), '\s+', ' ', 'g'), '');
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_COORD_FICHAS"(v_f."CO_MONITORAMENTO");
  if v_f."TP_SITUACAO" <> 'CONCLUIDA' then
    raise exception 'Só a ficha concluída se reabre.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_f."NU_VERSAO" then
    raise exception 'Esta ficha mudou desde que você abriu; recarregue.' using errcode = 'PT409';
  end if;
  -- Motivo da lista (20261021110000). Texto livre aqui é a tela antiga: recarregar mostra a lista.
  if v_rotulo is null then
    raise exception 'Escolha o motivo da reabertura na lista. Se a lista não aparece, recarregue a página.' using errcode = '22023';
  end if;
  if length(coalesce(v_complemento, '')) > 500 then
    raise exception 'Complemento com até 500 caracteres.' using errcode = '22023';
  end if;
  if v_codigo = 'OUTRO' then
    if length(coalesce(v_complemento, '')) < 15 or not private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 3) then
      raise exception 'Em "Outro", descreva o motivo com pelo menos 15 caracteres e 3 palavras.' using errcode = '22023';
    end if;
  elsif v_complemento is not null and not private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 1) then
    raise exception 'O complemento precisa ser escrito com palavras (ou fique em branco).' using errcode = '22023';
  end if;
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = 'EM_ANALISE',
    "CO_USUARIO_RESPONSAVEL" = coalesce("CO_USUARIO_RESPONSAVEL", "CO_USUARIO_CONCLUSAO"),
    "DT_ATRIBUICAO" = coalesce("DT_ATRIBUICAO", now()),
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'REABRIR', 'CONCLUIDA',
    v_rotulo || coalesce(' — ' || v_complemento, ''), v_uid,
    jsonb_build_array(jsonb_build_object('campo', 'motivo_reabertura', 'rotulo', 'Motivo da reabertura',
      'de', null, 'para', v_codigo, 'complemento', v_complemento)), null);
  return json_build_object('versao', v_f."NU_VERSAO" + 1);
end;
$function$;
comment on function public.reabrir_ficha(uuid, integer, text, text) is
  'A coordenação do edital reabre uma ficha concluída (volta a Em análise com o mesmo responsável), com a versão que a tela abriu (PT409). p_motivo: código da lista (FC_MOTIVO_REABERTURA; texto livre da tela antiga é recusado com 22023 pedindo recarregar); p_complemento: opcional, até 500, obrigatório em OUTRO (15+ caracteres, 3 palavras). Histórico REABRIR com o rótulo no DS_MOTIVO e o código no DS_ALTERACAO (20261021110000).';
revoke all on function public.reabrir_ficha(uuid, integer, text, text) from public, anon;
grant execute on function public.reabrir_ficha(uuid, integer, text, text) to authenticated;

CREATE OR REPLACE FUNCTION public.distribuir_fichas(p_edital uuid, p_atribuicoes jsonb, p_motivo text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_COORD_FICHAS"(p_edital);
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_item record;
  v_f public."TB_FICHA_ANALISE";
  v_acao text;
  v_qt integer;
  v_alteradas integer := 0;
  v_codigo text;
begin
  if jsonb_typeof(p_atribuicoes) is distinct from 'array' or jsonb_array_length(p_atribuicoes) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 2000 then
    raise exception 'Motivo com até 2.000 caracteres.' using errcode = '22023';
  end if;
  begin
    -- Controle otimista: alguma ficha mudou desde que a tela leu? Nada é gravado.
    select count(*) into v_qt
      from jsonb_to_recordset(p_atribuicoes) x(ficha uuid, versao integer, usuario uuid)
      left join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = x.ficha and f."CO_MONITORAMENTO" = p_edital
     where f."CO_FICHA_ANALISE" is null or f."NU_VERSAO" is distinct from x.versao;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Atribuição com id ou versão inválida' using errcode = '22023';
  end;
  if v_qt > 0 then
    raise exception '% ficha(s) mudaram desde que você abriu a fila; atualize e confira.', v_qt using errcode = 'PT409';
  end if;

  for v_item in
    select x.ficha, x.usuario from jsonb_to_recordset(p_atribuicoes) x(ficha uuid, versao integer, usuario uuid) order by x.ficha
  loop
    select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_item.ficha for update;
    select c."CO_CANDIDATO_EMPREGARE" into v_codigo from public."TB_EMPREGARE_CANDIDATO" c
     where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
    if v_f."TP_SITUACAO" in ('CONCLUIDA', 'FORA_LOTE') then
      raise exception 'A ficha % está %: não é redistribuída (AM-6.3).', v_codigo,
        case v_f."TP_SITUACAO" when 'CONCLUIDA' then 'concluída' else 'fora do lote' end using errcode = '22023';
    end if;
    continue when v_item.usuario is not distinct from v_f."CO_USUARIO_RESPONSAVEL"
                  and not (v_item.usuario is null and v_f."TP_SITUACAO" = 'REVISAR');
    if v_item.usuario is not null and not private."FC_PODE_ANALISAR_VAGA"(p_edital, v_item.usuario, v_f."CO_VAGA") then
      raise exception 'A pessoa escolhida para a ficha % não analisa a vaga % (equipe do edital, papel Analista, Editor).', v_codigo, v_f."CO_VAGA"
        using errcode = '22023';
    end if;
    v_acao := case when v_item.usuario is null then 'DEVOLVER_FILA'
                   when v_f."CO_USUARIO_RESPONSAVEL" is null then 'DISTRIBUIR' else 'REDISTRIBUIR' end;
    if v_acao <> 'DISTRIBUIR' and (v_motivo is null or length(v_motivo) < 10 or not private."FC_MOTIVO_PARECE_TEXTO"(v_motivo, 2)) then
      raise exception 'Informe o motivo para redistribuir ou devolver à fila (10 a 2.000 caracteres, com pelo menos 2 palavras).' using errcode = '22023';
    end if;
    update public."TB_FICHA_ANALISE" set
      "CO_USUARIO_RESPONSAVEL" = v_item.usuario,
      "DT_ATRIBUICAO" = case when v_item.usuario is null then null else now() end,
      "TP_SITUACAO" = case when v_item.usuario is null then 'PENDENTE' else "TP_SITUACAO" end,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, v_acao, v_f."TP_SITUACAO", v_f."CO_USUARIO_RESPONSAVEL", v_motivo, v_uid);
    v_alteradas := v_alteradas + 1;
  end loop;
  return json_build_object('alteradas', v_alteradas);
end;
$function$;

CREATE OR REPLACE FUNCTION public.liberar_reserva(p_edital uuid, p_fichas uuid[], p_motivo text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 2);
  v_uid uuid := (select auth.uid());
  v_coord boolean := coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false);
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_item record;
  v_liberadas integer := 0;
begin
  if p_fichas is null or cardinality(p_fichas) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 2000 then
    raise exception 'Motivo com até 2.000 caracteres.' using errcode = '22023';
  end if;
  for v_item in
    select f."CO_FICHA_ANALISE" as ficha, f."CO_USUARIO_RESERVA" as reserva, f."TP_SITUACAO" as situacao,
           f."CO_USUARIO_RESPONSAVEL" as responsavel
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = p_edital and f."CO_FICHA_ANALISE" = any (p_fichas)
       and f."DT_RESERVA_EXPIRA" > now()
     order by f."CO_FICHA_ANALISE"
     for update
  loop
    if v_item.reserva <> v_uid then
      if not v_coord then
        raise exception 'Só a coordenação libera a reserva de outra pessoa' using errcode = '42501';
      end if;
      if v_motivo is null or length(v_motivo) < 10 or not private."FC_MOTIVO_PARECE_TEXTO"(v_motivo, 2) then
        raise exception 'Informe o motivo para liberar a reserva de outra pessoa (10 a 2.000 caracteres, com pelo menos 2 palavras).' using errcode = '22023';
      end if;
    end if;
    update public."TB_FICHA_ANALISE" set
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, case when v_item.reserva = v_uid then 'LIBERAR' else 'LIBERAR_RESERVA' end,
                                         v_item.situacao, v_item.responsavel,
                                         case when v_item.reserva = v_uid then null else v_motivo end, v_uid);
    v_liberadas := v_liberadas + 1;
  end loop;
  return json_build_object('liberadas', v_liberadas);
end;
$function$;

CREATE OR REPLACE FUNCTION public.mandar_fichas_revisao(p_edital uuid, p_fichas jsonb, p_motivo text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_COORD_FICHAS"(p_edital);
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_item record;
  v_f public."TB_FICHA_ANALISE";
  v_qt integer;
  v_codigo text;
begin
  if jsonb_typeof(p_fichas) is distinct from 'array' or jsonb_array_length(p_fichas) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  if v_motivo is null or length(v_motivo) not between 10 and 2000 or not private."FC_MOTIVO_PARECE_TEXTO"(v_motivo, 2) then
    raise exception 'Informe o motivo para mandar para revisão (10 a 2.000 caracteres, com pelo menos 2 palavras).' using errcode = '22023';
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
  for v_item in select x.ficha from jsonb_to_recordset(p_fichas) x(ficha uuid, versao integer) order by x.ficha loop
    select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_item.ficha for update;
    if v_f."TP_SITUACAO" not in ('PENDENTE', 'EM_ANALISE') then
      select c."CO_CANDIDATO_EMPREGARE" into v_codigo from public."TB_EMPREGARE_CANDIDATO" c
       where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
      raise exception 'A ficha % não está pendente nem em análise.', v_codigo using errcode = '22023';
    end if;
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'REVISAR', "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, 'REVISAR', v_f."TP_SITUACAO", v_f."CO_USUARIO_RESPONSAVEL", v_motivo, v_uid);
  end loop;
  return json_build_object('alteradas', jsonb_array_length(p_fichas));
end;
$function$;


create temp table "ENSAIO_MOTIVOS" (passo integer, resultado text) on commit drop;

do $ensaio$
declare
  v_u uuid;
  v_f public."TB_FICHA_ANALISE";
  v_h public."TH_FICHA_ANALISE";
  v_err text;
  v_tentativa record;
begin
  -- 1. O texto mínimo.
  assert not private."FC_MOTIVO_PARECE_TEXTO"('dsdfsdfsfsa', 1), 'dsdfsdfsfsa passou';
  assert not private."FC_MOTIVO_PARECE_TEXTO"('fhyxjyfhujyu', 1), 'fhyxjyfhujyu passou';
  assert not private."FC_MOTIVO_PARECE_TEXTO"('6.6.1trtrhytr', 1), '6.6.1trtrhytr passou';
  assert not private."FC_MOTIVO_PARECE_TEXTO"('dvdddddddddddddd', 1), 'dvddd passou';
  assert not private."FC_MOTIVO_PARECE_TEXTO"('TESTE FDFDF', 2), 'TESTE FDFDF passou';
  assert not private."FC_MOTIVO_PARECE_TEXTO"('teste teste teste', 2), 'teste repetido passou';
  assert private."FC_MOTIVO_PARECE_TEXTO"('Nova distribuição.', 2), 'Nova distribuição reprovou';
  assert private."FC_MOTIVO_PARECE_TEXTO"('Erro na CTPS do candidato', 3), 'CTPS reprovou';
  assert private."FC_MOTIVO_PARECE_TEXTO"('Laudo de PcD sem CID', 3), 'PcD reprovou';
  insert into "ENSAIO_MOTIVOS" values (1, 'texto mínimo: ok');

  -- 2. reabrir_ficha.
  select h."CO_USUARIO" into v_u from public."TH_FICHA_ANALISE" h
   where h."TP_ACAO" = 'REABRIR' and h."CO_USUARIO" is not null order by h."DT_REGISTRO" desc limit 1;
  select f.* into v_f from public."TB_FICHA_ANALISE" f
   where f."TP_SITUACAO" = 'CONCLUIDA'
     and f."CO_MONITORAMENTO" = (select g."CO_MONITORAMENTO" from public."TH_FICHA_ANALISE" h
                                   join public."TB_FICHA_ANALISE" g using ("CO_FICHA_ANALISE")
                                  where h."TP_ACAO" = 'REABRIR' and h."CO_USUARIO" = v_u
                                  order by h."DT_REGISTRO" desc limit 1)
   order by f."DT_ATUALIZACAO" desc limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated')::text, true);

  for v_tentativa in
    select * from (values
      ('chamada antiga', 'Correção da experiência', null::text),
      ('código fora da lista', 'NAO_EXISTE', null),
      ('Outro curto', 'OUTRO', 'erro na nota'),
      ('Outro aleatório', 'OUTRO', 'dsdfsdfsfsa TERERTERTE fhyxjyfhujyu'),
      ('Outro com 2 palavras', 'OUTRO', 'reabertura solicitada'),
      ('complemento aleatório', 'EXPERIENCIA', 'dsdfsdfsfsa')
    ) t(nome, motivo, complemento)
  loop
    begin
      perform public.reabrir_ficha(v_f."CO_FICHA_ANALISE", v_f."NU_VERSAO", v_tentativa.motivo, v_tentativa.complemento);
      raise exception 'ENSAIO: % passou', v_tentativa.nome;
    exception when sqlstate '22023' then
      get stacked diagnostics v_err = message_text;
      insert into "ENSAIO_MOTIVOS" values (2, v_tentativa.nome || ' recusado: ' || v_err);
    end;
  end loop;

  perform public.reabrir_ficha(v_f."CO_FICHA_ANALISE", v_f."NU_VERSAO", 'EXPERIENCIA', '  vínculo do   SUS sem data ');
  select h.* into v_h from public."TH_FICHA_ANALISE" h
   where h."CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE" order by h."CO_HISTORICO_FICHA" desc limit 1;
  assert v_h."TP_ACAO" = 'REABRIR', 'sem histórico REABRIR';
  assert v_h."DS_MOTIVO" = 'Correção de experiência — vínculo do SUS sem data', 'DS_MOTIVO: ' || v_h."DS_MOTIVO";
  assert v_h."DS_ALTERACAO" = '[{"campo": "motivo_reabertura", "rotulo": "Motivo da reabertura", "de": null, "para": "EXPERIENCIA", "complemento": "vínculo do SUS sem data"}]'::jsonb,
    'DS_ALTERACAO: ' || v_h."DS_ALTERACAO"::text;
  insert into "ENSAIO_MOTIVOS" values (2, 'reaberta: ' || v_h."DS_MOTIVO" || ' ' || v_h."DS_ALTERACAO"::text);
end;
$ensaio$;

select * from "ENSAIO_MOTIVOS" order by passo;

-- 3. Os motivos já gravados e o que a regra nova diria.
select h."TP_ACAO", h."DS_MOTIVO", count(*) as qt,
       private."FC_MOTIVO_PARECE_TEXTO"(h."DS_MOTIVO", case h."TP_ACAO" when 'REABRIR' then 3 else 2 end) as passaria
  from public."TH_FICHA_ANALISE" h
 where h."TP_ACAO" in ('REABRIR', 'REDISTRIBUIR', 'DEVOLVER_FILA', 'REVISAR', 'LIBERAR_RESERVA')
   and h."DS_MOTIVO" is not null
 group by 1, 2 order by 1, 3 desc;

rollback;
