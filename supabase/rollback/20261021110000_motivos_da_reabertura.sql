/*
  Rollback de 20261021110000: reabrir_ficha volta ao motivo livre (10 a 2.000,
  sem complemento) e os motivos da fila voltam a exigir só 10 caracteres. O
  histórico já gravado fica como está.
*/
begin;
drop function if exists public.reabrir_ficha(uuid, integer, text, text);

CREATE OR REPLACE FUNCTION public.reabrir_ficha(p_ficha uuid, p_versao integer, p_motivo text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
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
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo para reabrir (10 a 2.000 caracteres).' using errcode = '22023';
  end if;
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = 'EM_ANALISE',
    "CO_USUARIO_RESPONSAVEL" = coalesce("CO_USUARIO_RESPONSAVEL", "CO_USUARIO_CONCLUSAO"),
    "DT_ATRIBUICAO" = coalesce("DT_ATRIBUICAO", now()),
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'REABRIR', 'CONCLUIDA', v_motivo, v_uid, null, null);
  return json_build_object('versao', v_f."NU_VERSAO" + 1);
end;
$function$;
comment on function public.reabrir_ficha(uuid, integer, text) is
  'A coordenação do edital reabre uma ficha concluída (volta a Em análise com o mesmo responsável, que a abre e conclui de novo pela regra vigente), com motivo de 10 a 2.000 e a versão que a tela abriu (PT409). Histórico REABRIR.';
revoke all on function public.reabrir_ficha(uuid, integer, text) from public, anon;
grant execute on function public.reabrir_ficha(uuid, integer, text) to authenticated;

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
    if v_acao <> 'DISTRIBUIR' and (v_motivo is null or length(v_motivo) < 10) then
      raise exception 'Informe o motivo para redistribuir ou devolver à fila (10 a 2.000 caracteres).' using errcode = '22023';
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
      if v_motivo is null or length(v_motivo) < 10 then
        raise exception 'Informe o motivo para liberar a reserva de outra pessoa (10 a 2.000 caracteres).' using errcode = '22023';
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
  if v_motivo is null or length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo para mandar para revisão (10 a 2.000 caracteres).' using errcode = '22023';
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

drop function if exists private."FC_MOTIVO_REABERTURA"(text);
drop function if exists private."FC_MOTIVO_PARECE_TEXTO"(text, integer);
commit;
