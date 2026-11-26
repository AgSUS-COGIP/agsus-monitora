/*
  ROLLBACK de 20261126180000_retificar_linha_do_quadro_de_vagas.sql

  Volta salvar_quadro_de_vagas e obter_quadro_de_vagas ao corpo e ao comentário de antes,
  copiados letra por letra do retrato de produção (supabase/esquema-atual.sql de 26/11/2026),
  volta a CHECK e o comentário de TH_VAGA_QUADRO_EDITAL."TP_EVENTO" e apaga
  TH_QUADRO_VAGA_EDITAL.

  O QUE FICA COMO ESTÁ: as linhas do quadro (inclusive as MANUAL no meio das do PDF, que o corpo
  antigo lê sem problema) e os vínculos levados pela retificação ou deixados "sem linha".
  O QUE SE PERDE: o histórico do quadro (motivo e errata de cada gravação, TH_QUADRO_VAGA_EDITAL),
  e o evento RETIFICACAO do histórico dos vínculos vira REIMPORTACAO (a CHECK antiga não o
  aceita). Se já houver retificação gravada, a guarda para: exporte antes
  (select * from public."TH_QUADRO_VAGA_EDITAL") e rode de novo com
  set_config('agsus.rollback_perde_retificacoes', 'sim', true) na mesma transação.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."TH_QUADRO_VAGA_EDITAL"') is null then
    raise exception 'A migration 20261126180000 não está aplicada (TH_QUADRO_VAGA_EDITAL não existe).';
  end if;
  if (exists (select 1 from public."TH_QUADRO_VAGA_EDITAL" where "TP_EVENTO" = 'RETIFICACAO')
      or exists (select 1 from public."TH_VAGA_QUADRO_EDITAL" where "TP_EVENTO" = 'RETIFICACAO'))
     and coalesce(current_setting('agsus.rollback_perde_retificacoes', true), '') <> 'sim' then
    raise exception 'Há retificações do quadro gravadas: exporte o histórico e confirme a perda (veja o cabeçalho).';
  end if;
end
$$;

-- 1. O histórico dos vínculos volta à CHECK de 20261118120000.
update public."TH_VAGA_QUADRO_EDITAL" set "TP_EVENTO" = 'REIMPORTACAO' where "TP_EVENTO" = 'RETIFICACAO';
alter table public."TH_VAGA_QUADRO_EDITAL" drop constraint "CK_HISTVAGAQUADRO_TPEVENTO";
alter table public."TH_VAGA_QUADRO_EDITAL" add constraint "CK_HISTVAGAQUADRO_TPEVENTO" check ("TP_EVENTO" in
    ('PREENCHIMENTO', 'CONFIRMACAO', 'REIMPORTACAO', 'RETORNO_AUTOMATICO', 'REMOCAO'));

-- 2. As funções, os comentários de antes.
CREATE OR REPLACE FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_linhas jsonb := coalesce(p_dados -> 'linhas', '[]'::jsonb);
  v_origem text := coalesce(nullif(upper(p_dados ->> 'origem'), ''), 'PDF');
  v_arquivo text := left(nullif(btrim(p_dados ->> 'arquivo'), ''), 300);
begin
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if not (private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  if jsonb_typeof(v_linhas) <> 'array' or jsonb_array_length(v_linhas) > 500 then
    raise exception 'Quadro de vagas inválido (até 500 linhas)' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_linhas) l
              where length(btrim(coalesce(l ->> 'cargo', ''))) not between 1 and 300
                 or coalesce(nullif(l ->> 'vagas_imediatas', '')::integer, 0) not between 0 and 9999
                 or jsonb_typeof(coalesce(l -> 'modalidades', '{}'::jsonb)) <> 'object') then
    raise exception 'Há linha do quadro sem cargo ou com quantidade inválida' using errcode = '22023';
  end if;

  update public."TB_QUADRO_VAGA_EDITAL"
     set "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now()
   where "CO_MONITORAMENTO" = p_edital and "ST_REGISTRO_ATIVO" = 'S';

  insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO", "DS_MODALIDADE_VAGA",
    "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
  select p_edital, l.ordem, btrim(l.valor ->> 'cargo'), left(nullif(btrim(l.valor ->> 'lotacao'), ''), 300),
         coalesce(l.valor -> 'modalidades', '{}'::jsonb), coalesce(nullif(l.valor ->> 'vagas_imediatas', '')::integer, 0),
         case when (l.valor ->> 'cadastro_reserva')::boolean then 'S' else 'N' end,
         v_origem, v_arquivo, (select auth.uid())
    from jsonb_array_elements(v_linhas) with ordinality l(valor, ordem);

  -- Os vínculos das vagas passam para as linhas novas (20261118120000).
  perform private."FC_PREENCHER_VINCULOS_QUADRO"(p_edital, false, (select auth.uid()));

  return public.obter_quadro_de_vagas(p_edital);
end;
$$;

COMMENT ON FUNCTION public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb) IS 'Substitui o quadro de vagas do edital (o anterior fica desativado) e passa os vínculos das vagas para as linhas novas (FC_PREENCHER_VINCULOS_QUADRO). p_dados: {origem PDF|MANUAL, arquivo, linhas:[{cargo, lotacao, modalidades, vagas_imediatas, cadastro_reserva}]}. Núcleo ou Calendário (editor) e o edital.';

CREATE OR REPLACE FUNCTION public.obter_quadro_de_vagas(p_edital uuid) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if v_m.id is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not (private.pode_recurso('nucleo', 1) or private.pode_recurso('calendario', 1) or private.pode_recurso('entrevistas', 1)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  return json_build_object(
    'edital', p_edital,
    'linhas', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'origem', (select json_build_object('tipo', q."TP_ORIGEM", 'arquivo', q."DS_ARQUIVO_ORIGEM", 'gravado_em', q."DT_CRIACAO")
                 from public."TB_QUADRO_VAGA_EDITAL" q
                where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S' limit 1),
    -- O vínculo de cada vaga (TA_VAGA_QUADRO_EDITAL, 20261118120000); 'cargo' é o nome da vaga, como antes.
    'vinculos', coalesce((
      select json_agg(json_build_object('vaga', v."CO_VAGA", 'cargo', v."NO_VAGA", 'quadro', v."CO_QUADRO_VAGA",
               'situacao', v."TP_VINCULO", 'origem', v."TP_ORIGEM", 'regra', v."TP_REGRA",
               'cargo_quadro', v."NO_CARGO_QUADRO", 'lotacao_quadro', v."NO_LOTACAO_QUADRO",
               'candidatas', v."DS_CANDIDATA", 'pendencia', v."DS_PENDENCIA",
               'confirmado_em', v."DT_CONFIRMACAO",
               'confirmado_por', (select p.nome from public."TB_PERFIL_USUARIO" p
                                   where p.user_id = v."CO_USUARIO_CONFIRMACAO" limit 1))
             order by v."NO_VAGA", v."CO_VAGA")
        from public."TA_VAGA_QUADRO_EDITAL" v
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    -- Sem vaga com código não há o que ligar: o motivo, sem inventar vaga.
    'vagas_do_edital', case
      when exists (select 1 from public."TA_VAGA_QUADRO_EDITAL" v where v."CO_MONITORAMENTO" = p_edital) then 'COM_CODIGO'
      when coalesce(v_m.status, '') = 'Cancelado' then 'NAO_SE_APLICA'
      when exists (select 1 from public."TB_SELECAO_VAGA" s
                    where s."CO_MONITORAMENTO" = p_edital and s."ST_REGISTRO_ATIVO" = 'S') then 'EXTERNO'
      else 'PENDENTE_INTEGRACAO' end,
    'pode_editar', private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)
  );
end;
$$;

COMMENT ON FUNCTION public.obter_quadro_de_vagas(p_edital uuid) IS 'Quadro de vagas vigente do edital, de onde veio e o vínculo de cada vaga com a linha (TA_VAGA_QUADRO_EDITAL: situação, origem, candidatas, pendência, quem confirmou); vagas_do_edital diz por que não há vaga para ligar (NAO_SE_APLICA, EXTERNO, PENDENTE_INTEGRACAO); pode_editar = pode gravar o vínculo. Núcleo, Calendário ou Entrevistas (leitor) e o edital.';

COMMENT ON COLUMN public."TH_VAGA_QUADRO_EDITAL"."TP_EVENTO" IS 'PREENCHIMENTO (regra), CONFIRMACAO (equipe), REIMPORTACAO (quadro novo), RETORNO_AUTOMATICO (equipe devolveu à regra) ou REMOCAO (a vaga saiu do edital).';

-- 3. O histórico do quadro sai.
drop table public."TH_QUADRO_VAGA_EDITAL";

commit;
