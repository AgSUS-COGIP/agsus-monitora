/*
  ENSAIO de 20261008220000_observacao_e_justificativa_da_entrevista.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Guarda as entrevistas e o
  histórico de hoje, aplica a migration e confere (cada falha para com
  "FALHOU En"; o resultado é a última consulta):
    E1  coluna nula em todas as entrevistas, tabela vazia, nada recalculado;
        a obrigatoriedade não é restrição da tabela (as INAPTO/Faltou já
        gravadas e a carga da planilha seguem valendo);
    E2  como admin sintético, no edital de treinamento (candidatos fictícios):
        a chamada de hoje (só notas e comparecimento) grava APTO sem
        justificativa; o payload traz justificativa e observacoes;
    E3  INAPTO sem justificativa (ou em branco, ou apagando) é recusado
        (23514) sem deixar nada; com justificativa grava e vai ao histórico
        (quem e quando);
    E4  Faltou sem justificativa recusa; com, grava;
    E5  observação do avaliador: grava, vem no payload, vai ao histórico,
        vazia apaga, mais de 1.000 caracteres recusa;
    E6  entrevistas e histórico dos editais reais iguais aos de antes.
  Termina em ROLLBACK. Dados fictícios.
*/
begin;

set local lock_timeout = '10s';

-- ═══ Antes da migration ═════════════════════════════════════════════════════
create temp table ensaio_antes on commit drop as
select e."CO_ENTREVISTA" as id, e."TP_ORIGEM" as origem, e."TP_PARECER" as parecer, e."VL_NOTA_TOTAL" as total,
       e."ST_COMPARECEU" as compareceu, e."DT_ATUALIZACAO" as atualizado
  from public."TB_ENTREVISTA" e;
create temp table ensaio_hist on commit drop as
select count(*) as historico from public."TH_ENTREVISTA_AVALIACAO";

-- ═══ A migration ════════════════════════════════════════════════════════════
set local lock_timeout = '10s';

-- ── 1. Observação do avaliador ─────────────────────────────────────────────
create table public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" (
  "CO_ENTREVISTA" uuid not null,
  "CO_AVALIADOR" uuid not null,
  "DS_OBSERVACAO" text not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  constraint "PK_TB_ENTREVISTA_OBSERVACAO_AVALIADOR" primary key ("CO_ENTREVISTA", "CO_AVALIADOR"),
  constraint "FK_ENTREVISTA_OBSERVACAOAVALIADOR" foreign key ("CO_ENTREVISTA")
    references public."TB_ENTREVISTA" ("CO_ENTREVISTA") on delete cascade,
  constraint "FK_ENTREVISTAAVALIADOR_OBSERVACAOAVALIADOR" foreign key ("CO_AVALIADOR")
    references public."TB_ENTREVISTA_AVALIADOR" ("CO_AVALIADOR") on delete cascade,
  constraint "CK_OBSERVACAOAVALIADOR_DSOBSERVACAO" check (btrim("DS_OBSERVACAO") <> '' and length("DS_OBSERVACAO") <= 1000)
);
comment on table public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" is 'Observação de um membro da banca sobre a entrevista de um candidato (opcional; uma por avaliador e entrevista, nunca por competência). Lançada pela ficha de notas (lancar_notas_entrevista).';
comment on column public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR"."CO_ENTREVISTA" is 'Entrevista (TB_ENTREVISTA).';
comment on column public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR"."CO_AVALIADOR" is 'Membro da banca (TB_ENTREVISTA_AVALIADOR) que escreveu.';
comment on column public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR"."DS_OBSERVACAO" is 'Texto da observação (até 1.000 caracteres).';
comment on column public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR"."DT_ATUALIZACAO" is 'Quando foi escrita ou corrigida.';
comment on column public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR"."CO_USUARIO_ATUALIZACAO" is 'Quem gravou (auth.users.id).';
comment on constraint "PK_TB_ENTREVISTA_OBSERVACAO_AVALIADOR" on public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" is 'Uma observação por avaliador na entrevista.';
comment on constraint "FK_ENTREVISTA_OBSERVACAOAVALIADOR" on public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" is 'Entrevista da observação (apagar a entrevista, como no reinício do treinamento, apaga a observação).';
comment on constraint "FK_ENTREVISTAAVALIADOR_OBSERVACAOAVALIADOR" on public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" is 'Avaliador da observação (apagar o membro apaga a observação).';
comment on constraint "CK_OBSERVACAOAVALIADOR_DSOBSERVACAO" on public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" is 'Texto não vazio, até 1.000 caracteres (sem texto, a linha sai).';

create index "IN_FKOBSERVACAOAVALIADOR_AV" on public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" ("CO_AVALIADOR");
comment on index public."IN_FKOBSERVACAOAVALIADOR_AV" is 'Observações por avaliador (chave estrangeira).';

alter table public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" enable row level security;
revoke all on public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" from public, anon, authenticated;

-- ── 2. Justificativa da banca ──────────────────────────────────────────────
alter table public."TB_ENTREVISTA" add column "DS_JUSTIFICATIVA_BANCA" text;
alter table public."TB_ENTREVISTA" add constraint "CK_ENTREVISTA_DSJUSTIFICATIVABANCA"
  check (coalesce(length("DS_JUSTIFICATIVA_BANCA"), 0) <= 4000);
comment on column public."TB_ENTREVISTA"."DS_JUSTIFICATIVA_BANCA" is 'Justificativa da banca para o parecer (entrevista feita no sistema). Opcional para APTO; obrigatória, em gravação nova pela ficha de notas, quando o parecer é INAPTO ou o candidato faltou (lancar_notas_entrevista). Nula nas entrevistas gravadas antes e nas da planilha.';
comment on constraint "CK_ENTREVISTA_DSJUSTIFICATIVABANCA" on public."TB_ENTREVISTA" is 'Justificativa da banca com até 4.000 caracteres (a obrigatoriedade é do lançamento, não da tabela).';

comment on column public."TH_ENTREVISTA_AVALIACAO"."DS_CAMPO" is 'nota, aspectos, compareceu, observacao (com o avaliador), justificativa, convocacao ou desconvocacao.';

-- ── 3. Lançar: observações, justificativa e a obrigatoriedade ──────────────

CREATE OR REPLACE FUNCTION public.lancar_notas_entrevista(p_entrevista uuid, p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_e public."TB_ENTREVISTA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_eu uuid;
  v_admin boolean := private.is_master();
  x jsonb;
  y jsonb;
  v_comp public."TB_ROTEIRO_COMPETENCIA";
  v_av public."TB_ENTREVISTA_AVALIADOR";
  v_nota numeric;
  v_ant numeric;
  v_comp_novo text := nullif(p_dados ->> 'compareceu', '');
  v_qt_aspectos integer;
  v_aspectos jsonb;
  v_aspecto uuid;
  v_ant_txt text;
  v_novo_txt text;
  v_obs_ant text;
  v_obs_nova text;
  v_just_nova text;
  v_final public."TB_ENTREVISTA";
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista and "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S';
  if v_e."CO_ENTREVISTA" is null then raise exception 'Convocado não encontrado' using errcode = '22023'; end if;
  perform private."FC_EXIGIR_ENTREVISTAS_EDITAL"(v_e."CO_MONITORAMENTO", 2);
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO";
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";
  select p.id into v_eu from private.current_profile() p;
  select count(*) into v_qt_aspectos from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_e."CO_ROTEIRO";

  -- Banca da entrevista: grava mesmo sem mudar o comparecimento.
  if nullif(p_dados ->> 'banca', '') is not null
     and (p_dados ->> 'banca')::smallint is distinct from v_e."NU_BANCA" then
    update public."TB_ENTREVISTA" set "NU_BANCA" = (p_dados ->> 'banca')::smallint where "CO_ENTREVISTA" = p_entrevista;
  end if;

  if v_comp_novo is not null then
    if v_comp_novo not in ('S', 'N') then raise exception 'Comparecimento inválido' using errcode = '22023'; end if;
    if v_comp_novo is distinct from v_e."ST_COMPARECEU" then
      update public."TB_ENTREVISTA" set "ST_COMPARECEU" = v_comp_novo, "NU_BANCA" = coalesce(nullif(p_dados ->> 'banca', '')::smallint, "NU_BANCA")
       where "CO_ENTREVISTA" = p_entrevista;
      insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
      values (p_entrevista, 'compareceu', v_e."ST_COMPARECEU", v_comp_novo, (select auth.uid()));
    end if;
  end if;

  for x in select value from jsonb_array_elements(coalesce(p_dados -> 'notas', '[]')) loop
    select * into v_comp from public."TB_ROTEIRO_COMPETENCIA" where "CO_COMPETENCIA" = (x ->> 'competencia')::uuid and "CO_ROTEIRO" = v_e."CO_ROTEIRO";
    if v_comp."CO_COMPETENCIA" is null then raise exception 'Competência não é do roteiro deste edital' using errcode = '22023'; end if;
    select * into v_av from public."TB_ENTREVISTA_AVALIADOR" where "CO_AVALIADOR" = (x ->> 'avaliador')::uuid and "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO" and "ST_ATIVO" = 'S';
    if v_av."CO_AVALIADOR" is null then raise exception 'Avaliador não é da banca deste edital' using errcode = '22023'; end if;
    if v_cfg."TP_LANCAMENTO" = 'AVALIADOR' and not v_admin and v_av."CO_PERFIL_USUARIO" is distinct from v_eu then
      raise exception 'Neste edital cada avaliador lança a própria nota' using errcode = '42501';
    end if;

    if v_qt_aspectos > 0 then
      -- Roteiro com aspectos: {aspectos: [{aspecto, nota}]} com todos os aspectos, ou nulo para apagar.
      if nullif(x ->> 'nota', '') is not null and not (x ? 'aspectos') then
        raise exception 'Este roteiro avalia por aspectos: informe a nota de cada aspecto' using errcode = '22023';
      end if;
      if x ? 'aspectos' and jsonb_typeof(x -> 'aspectos') not in ('array', 'null') then
        raise exception 'Aspectos: informe uma lista' using errcode = '22023';
      end if;
      v_aspectos := case when jsonb_typeof(x -> 'aspectos') = 'array' then x -> 'aspectos' end;
      select string_agg(trim_scale(a."VL_NOTA")::text, '; ' order by s."NU_ORDEM") into v_ant_txt
        from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" a
        join public."TB_ROTEIRO_ASPECTO" s on s."CO_ASPECTO" = a."CO_ASPECTO"
       where a."CO_ENTREVISTA" = p_entrevista and a."CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and a."CO_AVALIADOR" = v_av."CO_AVALIADOR";
      if v_aspectos is null or not exists (select 1 from jsonb_array_elements(v_aspectos) z where nullif(z ->> 'nota', '') is not null) then
        -- Apagar: a nota do avaliador sai e leva as dos aspectos (on delete cascade).
        delete from public."TB_ENTREVISTA_AVALIACAO"
         where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
        if found then
          insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
          values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'aspectos', v_ant_txt, null, (select auth.uid()));
        end if;
        continue;
      end if;
      if not private."FC_AVALIADOR_AVALIA"(v_av."CO_AVALIADOR", v_comp."CO_COMPETENCIA") then
        raise exception '% não avalia "%" neste edital (a configuração da banca define as competências de cada avaliador)',
          v_av."NO_AVALIADOR", v_comp."NO_COMPETENCIA" using errcode = '23514';
      end if;
      for y in select value from jsonb_array_elements(v_aspectos) loop
        v_aspecto := nullif(y ->> 'aspecto', '')::uuid;
        if v_aspecto is null or not exists (select 1 from public."TB_ROTEIRO_ASPECTO" s
                                             where s."CO_ASPECTO" = v_aspecto and s."CO_ROTEIRO" = v_e."CO_ROTEIRO") then
          raise exception 'Aspecto não é do roteiro deste edital' using errcode = '22023';
        end if;
        v_nota := nullif(y ->> 'nota', '')::numeric;
        if v_nota is null then
          raise exception 'Informe a nota de todos os aspectos de % (ou apague todas)', v_comp."NO_COMPETENCIA" using errcode = '22023';
        end if;
        perform private."FC_EXIGIR_NOTA_NA_ESCALA"(v_e."CO_ROTEIRO", v_comp."CO_COMPETENCIA", v_nota);
      end loop;
      if jsonb_array_length(v_aspectos) <> v_qt_aspectos
         or (select count(distinct z ->> 'aspecto') from jsonb_array_elements(v_aspectos) z) <> v_qt_aspectos then
        raise exception 'Informe a nota de cada um dos % aspectos de %', v_qt_aspectos, v_comp."NO_COMPETENCIA" using errcode = '22023';
      end if;
      select string_agg(trim_scale((z ->> 'nota')::numeric)::text, '; ' order by s."NU_ORDEM"), round(avg((z ->> 'nota')::numeric), 2)
        into v_novo_txt, v_nota
        from jsonb_array_elements(v_aspectos) z
        join public."TB_ROTEIRO_ASPECTO" s on s."CO_ASPECTO" = (z ->> 'aspecto')::uuid;
      if v_ant_txt is not distinct from v_novo_txt then continue; end if;
      insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
      values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", v_nota, (select auth.uid()))
      on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR") do update set
        "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
      insert into public."TB_ENTREVISTA_AVALIACAO_ASPECTO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "CO_ASPECTO", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
      select p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", (z ->> 'aspecto')::uuid, (z ->> 'nota')::numeric, (select auth.uid())
        from jsonb_array_elements(v_aspectos) z
      on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "CO_ASPECTO") do update set
        "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
      insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
      values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'aspectos', v_ant_txt, v_novo_txt, (select auth.uid()));
      continue;
    end if;

    -- Roteiro sem aspectos: uma nota por avaliador (como antes).
    if jsonb_typeof(x -> 'aspectos') = 'array' and jsonb_array_length(x -> 'aspectos') > 0 then
      raise exception 'Este roteiro não avalia por aspectos' using errcode = '22023';
    end if;
    v_nota := nullif(x ->> 'nota', '')::numeric;
    if v_nota is null then
      select "VL_NOTA" into v_ant from public."TB_ENTREVISTA_AVALIACAO"
       where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
      if found then
        delete from public."TB_ENTREVISTA_AVALIACAO"
         where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
        insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
        values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'nota', v_ant::text, null, (select auth.uid()));
      end if;
      continue;
    end if;
    if not private."FC_AVALIADOR_AVALIA"(v_av."CO_AVALIADOR", v_comp."CO_COMPETENCIA") then
      raise exception '% não avalia "%" neste edital (a configuração da banca define as competências de cada avaliador)',
        v_av."NO_AVALIADOR", v_comp."NO_COMPETENCIA" using errcode = '23514';
    end if;
    perform private."FC_EXIGIR_NOTA_NA_ESCALA"(v_e."CO_ROTEIRO", v_comp."CO_COMPETENCIA", v_nota);
    select "VL_NOTA" into v_ant from public."TB_ENTREVISTA_AVALIACAO"
     where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
    if v_ant is not distinct from v_nota then continue; end if;
    insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
    values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", v_nota, (select auth.uid()))
    on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR") do update set
      "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
    insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
    values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'nota', v_ant::text, v_nota::text, (select auth.uid()));
  end loop;

  -- Observação do avaliador (opcional; uma por avaliador na entrevista): {observacoes: [{avaliador, texto|null}]}.
  for x in select value from jsonb_array_elements(coalesce(p_dados -> 'observacoes', '[]')) loop
    select * into v_av from public."TB_ENTREVISTA_AVALIADOR"
     where "CO_AVALIADOR" = nullif(x ->> 'avaliador', '')::uuid and "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO";
    if v_av."CO_AVALIADOR" is null then raise exception 'Avaliador não é da banca deste edital' using errcode = '22023'; end if;
    v_obs_nova := nullif(btrim(x ->> 'texto'), '');
    if length(v_obs_nova) > 1000 then
      raise exception 'Observação de %: até 1.000 caracteres', v_av."NO_AVALIADOR" using errcode = '22023';
    end if;
    v_obs_ant := null;
    select o."DS_OBSERVACAO" into v_obs_ant from public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" o
     where o."CO_ENTREVISTA" = p_entrevista and o."CO_AVALIADOR" = v_av."CO_AVALIADOR";
    if v_obs_ant is not distinct from v_obs_nova then continue; end if;
    if v_cfg."TP_LANCAMENTO" = 'AVALIADOR' and not v_admin and v_av."CO_PERFIL_USUARIO" is distinct from v_eu then
      raise exception 'Neste edital cada avaliador escreve a própria observação' using errcode = '42501';
    end if;
    if v_obs_nova is null then
      delete from public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR"
       where "CO_ENTREVISTA" = p_entrevista and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
    else
      insert into public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" ("CO_ENTREVISTA", "CO_AVALIADOR", "DS_OBSERVACAO", "CO_USUARIO_ATUALIZACAO")
      values (p_entrevista, v_av."CO_AVALIADOR", v_obs_nova, (select auth.uid()))
      on conflict ("CO_ENTREVISTA", "CO_AVALIADOR") do update set
        "DS_OBSERVACAO" = excluded."DS_OBSERVACAO", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
    end if;
    insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
    values (p_entrevista, v_av."CO_AVALIADOR", 'observacao', v_obs_ant, v_obs_nova, (select auth.uid()));
  end loop;

  -- Justificativa da banca (opcional na chamada; sem a chave, fica como está).
  if p_dados ? 'justificativa' then
    v_just_nova := nullif(btrim(p_dados ->> 'justificativa'), '');
    if length(v_just_nova) > 4000 then
      raise exception 'Justificativa da banca: até 4.000 caracteres' using errcode = '22023';
    end if;
    if v_just_nova is distinct from (select e."DS_JUSTIFICATIVA_BANCA" from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = p_entrevista) then
      insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
      select p_entrevista, 'justificativa', e."DS_JUSTIFICATIVA_BANCA", v_just_nova, (select auth.uid())
        from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = p_entrevista;
      update public."TB_ENTREVISTA" set "DS_JUSTIFICATIVA_BANCA" = v_just_nova where "CO_ENTREVISTA" = p_entrevista;
    end if;
  end if;

  perform private."FC_CALCULAR_ENTREVISTA"(p_entrevista);

  -- Inapto ou Faltou pede a justificativa da banca. Vale para cada gravação nova (a regra está aqui,
  -- no lançamento): as entrevistas já gravadas não mudam e a carga da planilha não passa por aqui.
  select * into v_final from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista;
  if (v_final."TP_PARECER" = 'INAPTO' or v_final."ST_COMPARECEU" = 'N') and v_final."DS_JUSTIFICATIVA_BANCA" is null then
    raise exception '%', case when v_final."ST_COMPARECEU" = 'N'
        then 'Escreva a justificativa da banca: ela é obrigatória quando o candidato falta'
        else 'Escreva a justificativa da banca: ela é obrigatória quando o parecer é Inapto' end
      using errcode = '23514', hint = 'Preencha "Justificativa da banca" na ficha de notas e salve de novo.';
  end if;
  return public.obter_entrevistas_do_edital(v_e."CO_MONITORAMENTO");
end;
$function$;

comment on function public.lancar_notas_entrevista(uuid, jsonb) is 'Lança/corrige notas ({notas:[{competencia, avaliador, nota|null}]}; roteiro com aspectos: {competencia, avaliador, aspectos:[{aspecto, nota}]|null}, todos os aspectos), o comparecimento ({compareceu:S|N, banca}), as observações dos avaliadores ({observacoes:[{avaliador, texto|null}]}, até 1.000 caracteres) e a justificativa da banca ({justificativa}, até 4.000) de um convocado, valida a escala do roteiro, recusa (23514) a nota de avaliador em competência que não é dele e a gravação que termina INAPTO ou com Faltou sem justificativa, grava o histórico e recalcula o resultado. entrevistas >= editor; no modo AVALIADOR, só a própria nota e a própria observação.';

-- ── 4. Payload: justificativa e observações ───────────────────────────────

CREATE OR REPLACE FUNCTION public.obter_entrevistas_do_edital(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
  v_lista uuid := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'pode_gerar_lista', private.pode_recurso('classificacao', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'banca', v_cfg."DS_BANCA",
        'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'regra_classificacao', (
      select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'convocacao', h."DS_CONFIGURACAO" -> 'convocacao',
                               'desempate', h."DS_CONFIGURACAO" -> 'desempate',
                               'empate_final', h."DS_CONFIGURACAO" -> 'empate_final')
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'lista_convocacao', case when v_lista is null then null else json_build_object(
        'lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_lista),
        'retrato', (select l."DS_RESULTADO" from public."TB_LISTA_CLASSIFICACAO" l
                     where l."CO_LISTA_CLASSIFICACAO" = v_lista)) end,
    'avaliadores', coalesce((
      select json_agg(json_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM",
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S',
               -- As competências que o membro avalia (do roteiro do edital); nulo = todas.
               'competencias', (select json_agg(l."CO_COMPETENCIA" order by k."NU_ORDEM")
                   from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
                   join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = l."CO_COMPETENCIA"
                  where l."CO_AVALIADOR" = b."CO_AVALIADOR" and k."CO_ROTEIRO" = v_cfg."CO_ROTEIRO"))
             order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'justificativa', e."DS_JUSTIFICATIVA_BANCA",
               'observacoes', coalesce((select json_agg(json_build_object('avaliador', o."CO_AVALIADOR", 'texto', o."DS_OBSERVACAO",
                      'atualizado_em', o."DT_ATUALIZACAO") order by o."DT_ATUALIZACAO")
                   from public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" o where o."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA",
                      'aspectos', coalesce((select json_agg(json_build_object('aspecto', y."CO_ASPECTO", 'nota', y."VL_NOTA"))
                          from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" y
                         where y."CO_ENTREVISTA" = x."CO_ENTREVISTA" and y."CO_COMPETENCIA" = x."CO_COMPETENCIA"
                           and y."CO_AVALIADOR" = x."CO_AVALIADOR"), '[]'::json)))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;

comment on function public.obter_entrevistas_do_edital(uuid) is
  'Condução da entrevista de um edital: configuração (roteiro, banca, lançamento), a lista de convocação vigente da Classificação com o retrato (lista_convocacao), a regra vigente da Classificação (convocação, desempate e empate final), banca (com as competências de cada membro; nulo = todas) e convocados com as notas, a justificativa da banca e as observações dos avaliadores; pode_editar, pode_gerar_lista, admin_global e meu_perfil.';

notify pgrst, 'reload schema';

-- ═══ Conferências do ensaio ════════════════════════════════════════════════
create temp table ensaio_resultado (passo text primary key, ok boolean, detalhe text) on commit drop;

-- E1. Esquema e editais reais: a coluna nula em todas, a tabela vazia, nada recalculado.
do $$
begin
  if to_regclass('public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR"') is null then raise exception 'FALHOU E1: tabela não criada'; end if;
  if exists (select 1 from public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR") then raise exception 'FALHOU E1: tabela com linhas'; end if;
  if exists (select 1 from public."TB_ENTREVISTA" e where e."DS_JUSTIFICATIVA_BANCA" is not null) then
    raise exception 'FALHOU E1: justificativa preenchida em entrevista existente';
  end if;
  if exists (select 1 from ensaio_antes a join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = a.id
              where (e."TP_PARECER", e."VL_NOTA_TOTAL", e."ST_COMPARECEU", e."DT_ATUALIZACAO")
                    is distinct from (a.parecer, a.total, a.compareceu, a.atualizado)) then
    raise exception 'FALHOU E1: entrevista existente mudou com a migration';
  end if;
  -- A obrigatoriedade não é restrição da tabela (as já gravadas e a carga da planilha seguem valendo).
  if exists (select 1 from pg_constraint c where c.conrelid = 'public."TB_ENTREVISTA"'::regclass
              and pg_get_constraintdef(c.oid) ilike '%JUSTIFICATIVA%' and c.conname <> 'CK_ENTREVISTA_DSJUSTIFICATIVABANCA') then
    raise exception 'FALHOU E1: restrição de obrigatoriedade na tabela';
  end if;
  insert into ensaio_resultado values ('E1', true,
    (select count(*) from ensaio_antes) || ' entrevistas intactas ('
    || (select count(*) from ensaio_antes where (parecer = 'INAPTO' or compareceu = 'N') and origem = 'sistema')
    || ' do sistema já INAPTO/Faltou, sem justificativa, continuam válidas; '
    || (select count(*) from ensaio_antes where origem = 'planilha') || ' da planilha); tabela vazia');
end;
$$;

-- E2–E5. Como administrador sintético, no edital de treinamento, com candidatos fictícios.
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-a000-0000000a5e03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.obs.admin@ensaio.invalid');
insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo)
select '00000000-0000-4000-a000-0000000a5e03', 'ensaio.obs.admin@ensaio.invalid', 'Ensaio Admin Obs',
       (select g."CO_GRUPO_ACESSO" from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL" order by 1 limit 1), true;

do $$
declare
  v_treino uuid;
  v_roteiro uuid;
  v_asp uuid[];
  v_a1 uuid;
  v_e uuid;
  v_f uuid;
  v json;
  v_falhou boolean;
  v_msg text;
  v_cod text;
  v_apto jsonb;
  v_inapto jsonb;
  v_hist integer;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000a5e03","role":"authenticated","email":"ensaio.obs.admin@ensaio.invalid"}', true);
  if not private.is_master() then raise exception 'ENSAIO: o admin sintético não é admin global'; end if;
  select m.id into v_treino from public."TB_MONITORAMENTO_INDIGENA" m
    join public."TB_ENTREVISTA_EDITAL" c on c."CO_MONITORAMENTO" = m.id
   where private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") and m."CO_AREA" = 'saude-indigena' limit 1;
  if v_treino is null then raise exception 'ENSAIO: sem edital de treinamento configurado'; end if;
  select c."CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" c where c."CO_MONITORAMENTO" = v_treino;
  select array_agg(s."CO_ASPECTO" order by s."NU_ORDEM") into v_asp from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_roteiro;
  select b."CO_AVALIADOR" into v_a1 from public."TB_ENTREVISTA_AVALIADOR" b
   where b."CO_MONITORAMENTO" = v_treino and b."ST_ATIVO" = 'S' order by b."NU_BANCA", b."NO_AVALIADOR" limit 1;

  -- As notas de toda a banca, nas competências de cada um: 3 (APTO) ou 0 (INAPTO).
  select jsonb_agg(jsonb_build_object('competencia', k."CO_COMPETENCIA", 'avaliador', b."CO_AVALIADOR",
           'aspectos', (select jsonb_agg(jsonb_build_object('aspecto', a, 'nota', 3)) from unnest(v_asp) a),
           'nota', case when v_asp is null then 3 end))
    into v_apto
    from public."TB_ROTEIRO_COMPETENCIA" k
    join public."TB_ENTREVISTA_AVALIADOR" b on b."CO_MONITORAMENTO" = v_treino and b."ST_ATIVO" = 'S'
   where k."CO_ROTEIRO" = v_roteiro and private."FC_AVALIADOR_AVALIA"(b."CO_AVALIADOR", k."CO_COMPETENCIA");
  select jsonb_agg(case when v_asp is null then i || '{"nota": 0}'::jsonb
                        else i || jsonb_build_object('aspectos', (select jsonb_agg(jsonb_build_object('aspecto', a, 'nota', 0)) from unnest(v_asp) a)) end)
    into v_inapto from jsonb_array_elements(v_apto) i;
  if v_asp is null then
    v_apto := (select jsonb_agg(i - 'aspectos') from jsonb_array_elements(v_apto) i);
    v_inapto := (select jsonb_agg(i - 'aspectos') from jsonb_array_elements(v_inapto) i);
  end if;

  insert into public."TB_ENTREVISTA" ("CO_AREA", "CO_MONITORAMENTO", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO",
    "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO")
  values ('saude-indigena', v_treino, 'DSEI Treinamento', 'Treinamento', '9909910001', 'Candidato Ensaio Justificativa',
    'sistema', 'ensaio-justificativa|apto', v_roteiro, 'S'),
         ('saude-indigena', v_treino, 'DSEI Treinamento', 'Treinamento', '9909910001', 'Candidato Ensaio Faltou',
    'sistema', 'ensaio-justificativa|faltou', v_roteiro, 'S');
  select e."CO_ENTREVISTA" into v_e from public."TB_ENTREVISTA" e where e."DS_CHAVE_ORIGEM" = 'ensaio-justificativa|apto';
  select e."CO_ENTREVISTA" into v_f from public."TB_ENTREVISTA" e where e."DS_CHAVE_ORIGEM" = 'ensaio-justificativa|faltou';

  -- E2. A chamada de hoje (sem as chaves novas) funciona: APTO sem justificativa.
  v := public.lancar_notas_entrevista(v_e, jsonb_build_object('compareceu', 'S', 'notas', v_apto));
  if (select e."TP_PARECER" from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e) <> 'APTO' then
    raise exception 'FALHOU E2: chamada antiga não deu APTO (%)', (select e."TP_PARECER" from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e);
  end if;
  if (select c -> 'justificativa' from json_array_elements(v -> 'convocados') c where c ->> 'id' = v_e::text)::jsonb <> 'null'::jsonb
     or (select json_typeof(c -> 'observacoes') from json_array_elements(v -> 'convocados') c where c ->> 'id' = v_e::text) <> 'array' then
    raise exception 'FALHOU E2: payload sem justificativa/observacoes';
  end if;
  insert into ensaio_resultado values ('E2', true, 'chamada antiga (só notas e comparecimento) grava APTO sem justificativa; payload traz justificativa nula e observacoes []');

  -- E3. INAPTO sem justificativa é recusado (e nada da gravação fica); com justificativa, grava e vai ao histórico.
  v_falhou := false;
  begin
    perform public.lancar_notas_entrevista(v_e, jsonb_build_object('notas', v_inapto));
  exception when sqlstate '23514' then v_falhou := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_falhou or v_msg not like '%obrigatória quando o parecer é Inapto%' then raise exception 'FALHOU E3: INAPTO sem justificativa passou (%)', v_msg; end if;
  if (select e."TP_PARECER" from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e) <> 'APTO' then
    raise exception 'FALHOU E3: a gravação recusada deixou as notas';
  end if;
  v_falhou := false;
  begin
    perform public.lancar_notas_entrevista(v_e, jsonb_build_object('notas', v_inapto, 'justificativa', '   '));
  exception when sqlstate '23514' then v_falhou := true;
  end;
  if not v_falhou then raise exception 'FALHOU E3: justificativa em branco passou'; end if;
  perform public.lancar_notas_entrevista(v_e, jsonb_build_object('notas', v_inapto,
    'justificativa', 'Não demonstrou o mínimo em nenhuma competência.'));
  if (select (e."TP_PARECER", e."DS_JUSTIFICATIVA_BANCA") from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e)
     is distinct from ('INAPTO'::text, 'Não demonstrou o mínimo em nenhuma competência.'::text) then
    raise exception 'FALHOU E3: INAPTO com justificativa não gravou';
  end if;
  if not exists (select 1 from public."TH_ENTREVISTA_AVALIACAO" h where h."CO_ENTREVISTA" = v_e and h."DS_CAMPO" = 'justificativa'
                  and h."DS_VALOR_ANTERIOR" is null and h."DS_VALOR_NOVO" like 'Não demonstrou%'
                  and h."CO_USUARIO" = '00000000-0000-4000-a000-0000000a5e03' and h."DT_ALTERACAO" is not null) then
    raise exception 'FALHOU E3: histórico da justificativa';
  end if;
  -- Apagar a justificativa de um INAPTO também é recusado.
  v_falhou := false;
  begin
    perform public.lancar_notas_entrevista(v_e, jsonb_build_object('justificativa', null));
  exception when sqlstate '23514' then v_falhou := true;
  end;
  if not v_falhou then raise exception 'FALHOU E3: apagou a justificativa de um INAPTO'; end if;
  insert into ensaio_resultado values ('E3', true, 'INAPTO sem justificativa (ou em branco, ou apagando) recusado 23514 sem deixar nada; com justificativa grava, histórico com quem e quando');

  -- E4. Faltou: sem justificativa recusa; com, grava.
  v_falhou := false;
  begin
    perform public.lancar_notas_entrevista(v_f, jsonb_build_object('compareceu', 'N'));
  exception when sqlstate '23514' then v_falhou := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_falhou or v_msg not like '%obrigatória quando o candidato falta%' then raise exception 'FALHOU E4: Faltou sem justificativa passou (%)', v_msg; end if;
  perform public.lancar_notas_entrevista(v_f, jsonb_build_object('compareceu', 'N', 'justificativa', 'Não compareceu no horário marcado.'));
  if (select e."ST_COMPARECEU" from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_f) <> 'N' then
    raise exception 'FALHOU E4: Faltou com justificativa não gravou';
  end if;
  insert into ensaio_resultado values ('E4', true, 'Faltou sem justificativa recusado; com justificativa grava');

  -- E5. Observação do avaliador: grava, aparece no payload, vai ao histórico; vazia apaga; > 1.000 recusa.
  v := public.lancar_notas_entrevista(v_e, jsonb_build_object('observacoes', jsonb_build_array(
         jsonb_build_object('avaliador', v_a1, 'texto', '  Boa escuta, pouca experiência em campo.  '))));
  if (select o."DS_OBSERVACAO" from public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" o where o."CO_ENTREVISTA" = v_e and o."CO_AVALIADOR" = v_a1)
     is distinct from 'Boa escuta, pouca experiência em campo.' then
    raise exception 'FALHOU E5: observação não gravou';
  end if;
  if (select c -> 'observacoes' -> 0 ->> 'texto' from json_array_elements(v -> 'convocados') c where c ->> 'id' = v_e::text)
     is distinct from 'Boa escuta, pouca experiência em campo.'
     or (select c ->> 'justificativa' from json_array_elements(v -> 'convocados') c where c ->> 'id' = v_e::text) not like 'Não demonstrou%' then
    raise exception 'FALHOU E5: payload sem a observação ou a justificativa';
  end if;
  perform public.lancar_notas_entrevista(v_e, jsonb_build_object('observacoes', jsonb_build_array(
         jsonb_build_object('avaliador', v_a1, 'texto', 'Boa escuta, pouca experiência em campo.'))));
  perform public.lancar_notas_entrevista(v_e, jsonb_build_object('observacoes', jsonb_build_array(
         jsonb_build_object('avaliador', v_a1, 'texto', null))));
  if exists (select 1 from public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR" o where o."CO_ENTREVISTA" = v_e) then
    raise exception 'FALHOU E5: observação vazia não apagou';
  end if;
  select count(*) into v_hist from public."TH_ENTREVISTA_AVALIACAO" h
   where h."CO_ENTREVISTA" = v_e and h."DS_CAMPO" = 'observacao' and h."CO_AVALIADOR" = v_a1
     and h."CO_USUARIO" = '00000000-0000-4000-a000-0000000a5e03';
  if v_hist <> 2 then raise exception 'FALHOU E5: histórico da observação com % linhas (esperado 2: gravou e apagou; repetir não conta)', v_hist; end if;
  v_falhou := false;
  begin
    perform public.lancar_notas_entrevista(v_e, jsonb_build_object('observacoes', jsonb_build_array(
         jsonb_build_object('avaliador', v_a1, 'texto', repeat('x', 1001)))));
  exception when sqlstate '22023' then v_falhou := true;
  end;
  if not v_falhou then raise exception 'FALHOU E5: observação com mais de 1.000 caracteres passou'; end if;
  insert into ensaio_resultado values ('E5', true, 'observação grava (sem espaços nas pontas), vem no payload, repetir não duplica o histórico, vazia apaga, > 1.000 recusa');
end;
$$;

-- E6. Editais reais sem mudança: só os candidatos fictícios mudaram.
do $$
declare
  v_mudou integer;
begin
  select count(*) into v_mudou from ensaio_antes a join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = a.id
   where (e."TP_PARECER", e."VL_NOTA_TOTAL", e."ST_COMPARECEU", e."DT_ATUALIZACAO", e."DS_JUSTIFICATIVA_BANCA")
         is distinct from (a.parecer, a.total, a.compareceu, a.atualizado, null);
  if v_mudou > 0 then raise exception 'FALHOU E6: % entrevistas existentes mudaram', v_mudou; end if;
  if (select count(*) from public."TH_ENTREVISTA_AVALIACAO" h where h."CO_ENTREVISTA" in (select id from ensaio_antes)) <> (select historico from ensaio_hist) then
    raise exception 'FALHOU E6: histórico das entrevistas existentes mudou';
  end if;
  insert into ensaio_resultado values ('E6', true, 'entrevistas e histórico dos editais reais iguais aos de antes');
end;
$$;

select json_agg(json_build_object('passo', passo, 'ok', ok, 'detalhe', detalhe) order by passo) as ensaio from ensaio_resultado;

rollback;
