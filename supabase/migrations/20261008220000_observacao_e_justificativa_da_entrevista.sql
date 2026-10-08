/*
  OBSERVAÇÃO DO AVALIADOR E JUSTIFICATIVA DA BANCA (08/10/2026)

  Pedido (aprovado pelo usuário): na ficha de notas, uma "Observação do
  avaliador" (opcional, por avaliador e por entrevista; nada por competência)
  e a "Justificativa da banca" (por entrevista; opcional para APTO e
  obrigatória para INAPTO e para Faltou), que entra no parecer pronto.

  O que muda
    1. TB_ENTREVISTA_OBSERVACAO_AVALIADOR: uma observação por avaliador na
       entrevista (até 1.000 caracteres; sem texto, a linha sai).
    2. TB_ENTREVISTA."DS_JUSTIFICATIVA_BANCA" (até 4.000 caracteres; nula nas
       entrevistas de hoje e nas da planilha).
    3. lancar_notas_entrevista(p_entrevista, p_dados): a MESMA assinatura; o
       p_dados aceita, opcionais, `observacoes: [{avaliador, texto|null}]` e
       `justificativa` (texto ou nulo; sem a chave, fica como está). As
       chamadas de hoje (só notas, comparecimento e banca) seguem iguais.
       Cada mudança vai para TH_ENTREVISTA_AVALIACAO (DS_CAMPO observacao, com
       o avaliador, ou justificativa), com quem e quando. No modo AVALIADOR,
       cada avaliador escreve só a própria observação.
    4. A justificativa é OBRIGATÓRIA (23514) quando a gravação termina com
       parecer INAPTO ou com Faltou: validada no lançamento, depois do
       recálculo (é ali que o parecer é gravado — private."FC_CALCULAR_ENTREVISTA").
       Só vale para gravações novas: nenhuma restrição na tabela, as
       entrevistas já gravadas não mudam e a carga da planilha
       (sincronizar_entrevistas, TP_ORIGEM planilha) não passa por aqui.
    5. obter_entrevistas_do_edital: convocados[].justificativa e
       convocados[].observacoes ([{avaliador, texto, atualizado_em}]).

  Rollback: supabase/rollback/20261008220000_observacao_e_justificativa_da_entrevista.sql
  Ensaio:   supabase/ensaios/20261008220000_observacao_e_justificativa_da_entrevista.sql
*/
begin;

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

commit;
