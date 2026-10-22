/*
  ENSAIO de 20261008170000_avaliador_por_competencia.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Antes da migration, guarda
  o resultado de todas as entrevistas (as do sistema recalculadas com o
  cálculo de antes); aplica a migration e confere (cada falha para com
  "FALHOU En"; o resultado é a última consulta):
    E1  tabela vazia nos editais reais (só o exemplo do treinamento, se
        couber); sem vínculo, todo membro avalia todas;
    E2  editais sem vínculo continuam iguais: as entrevistas do sistema,
        recalculadas, dão a mesma nota, as mesmas notas por competência e o
        mesmo parecer; as da planilha não mudam;
    E3  como admin sintético: configurar recusa tirar competência de quem já
        deu nota; o reinício do treinamento traz o Avaliador Teste 2 só em
        "Trabalho em equipe"; o payload traz as competências; o lançamento
        recusa a nota fora da competência do avaliador e o cálculo usa só
        quem avalia; configurar recusa lista vazia, competência de fora e
        banca sem avaliador, grava "todas" sem vínculo e, sem a chave, deixa
        como estava; apagar continua livre;
    E4  os casos dourados com atribuições de
        tests/fixtures/entrevistas/casos-de-calculo.json (o mesmo json abaixo,
        conferido pelo vitest) no FC_CALCULAR_ENTREVISTA.
  Termina em ROLLBACK. Dados fictícios.
*/
begin;

set local lock_timeout = '10s';

-- ═══ Antes da migration: o resultado de hoje ════════════════════════════════
do $$
declare
  v uuid;
begin
  for v in select e."CO_ENTREVISTA" from public."TB_ENTREVISTA" e where e."TP_ORIGEM" = 'sistema' and e."CO_ROTEIRO" is not null loop
    perform private."FC_CALCULAR_ENTREVISTA"(v);
  end loop;
end;
$$;
create temp table ensaio_antes on commit drop as
select e."CO_ENTREVISTA" as id, e."TP_ORIGEM" as origem, e."VL_NOTA_TOTAL" as total, e."TP_PARECER" as parecer,
       (select jsonb_agg(jsonb_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
          from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA") as notas
  from public."TB_ENTREVISTA" e;

-- ═══ A migration ════════════════════════════════════════════════════════════
set local lock_timeout = '10s';

-- ── 1. Tabela ──────────────────────────────────────────────────────────────
create table public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" (
  "CO_AVALIADOR" uuid not null,
  "CO_COMPETENCIA" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "CO_USUARIO_CRIACAO" uuid,
  constraint "PK_TB_ENTREVISTA_AVALIADOR_COMPETENCIA" primary key ("CO_AVALIADOR", "CO_COMPETENCIA"),
  constraint "FK_ENTREVISTAAVALIADOR_AVALIADORCOMPETENCIA" foreign key ("CO_AVALIADOR")
    references public."TB_ENTREVISTA_AVALIADOR" ("CO_AVALIADOR") on delete cascade,
  constraint "FK_ROTEIROCOMPETENCIA_AVALIADORCOMPETENCIA" foreign key ("CO_COMPETENCIA")
    references public."TB_ROTEIRO_COMPETENCIA" ("CO_COMPETENCIA")
);
comment on table public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" is 'Competências que um membro da banca avalia (avaliador por competência). Sem linha, o membro avalia todas as competências do roteiro do edital.';
comment on column public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA"."CO_AVALIADOR" is 'Membro da banca (TB_ENTREVISTA_AVALIADOR).';
comment on column public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA"."CO_COMPETENCIA" is 'Competência do roteiro (TB_ROTEIRO_COMPETENCIA) que ele avalia.';
comment on column public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA"."DT_CRIACAO" is 'Quando o vínculo foi gravado.';
comment on column public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA"."CO_USUARIO_CRIACAO" is 'Quem gravou (auth.users.id).';
comment on constraint "PK_TB_ENTREVISTA_AVALIADOR_COMPETENCIA" on public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" is 'Um vínculo por membro e competência.';
comment on constraint "FK_ENTREVISTAAVALIADOR_AVALIADORCOMPETENCIA" on public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" is 'Membro da banca (apagar o membro apaga o vínculo).';
comment on constraint "FK_ROTEIROCOMPETENCIA_AVALIADORCOMPETENCIA" on public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" is 'Competência avaliada.';

create index "IN_FKAVALIADORCOMPETENCIA_CO" on public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" ("CO_COMPETENCIA");
comment on index public."IN_FKAVALIADORCOMPETENCIA_CO" is 'Vínculos por competência (chave estrangeira).';

alter table public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" enable row level security;
revoke all on public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" from public, anon, authenticated;

-- ── 2. O membro avalia a competência? ──────────────────────────────────────
create function private."FC_AVALIADOR_AVALIA"(p_avaliador uuid, p_competencia uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  -- Sem vínculo com competência do mesmo roteiro = avalia todas; com vínculo, só as vinculadas.
  select not exists (
           select 1
             from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
             join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = l."CO_COMPETENCIA"
             join public."TB_ROTEIRO_COMPETENCIA" alvo on alvo."CO_COMPETENCIA" = p_competencia
            where l."CO_AVALIADOR" = p_avaliador and k."CO_ROTEIRO" = alvo."CO_ROTEIRO")
      or exists (
           select 1 from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
            where l."CO_AVALIADOR" = p_avaliador and l."CO_COMPETENCIA" = p_competencia);
$function$;
comment on function private."FC_AVALIADOR_AVALIA"(uuid, uuid) is 'O membro da banca avalia a competência? Sem vínculo (TB_ENTREVISTA_AVALIADOR_COMPETENCIA) com competência do mesmo roteiro, avalia todas.';
revoke all on function private."FC_AVALIADOR_AVALIA"(uuid, uuid) from public, anon, authenticated;

-- ── 3. Cálculo: a média é de quem avalia a competência ─────────────────────

CREATE OR REPLACE FUNCTION private."FC_CALCULAR_ENTREVISTA"(p_entrevista uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_e public."TB_ENTREVISTA";
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_avaliadores integer;
  v_total numeric := 0;
  v_bruto numeric := 0;
  v_soma numeric;
  v_falta boolean := false;
  v_reprova boolean := false;
  v_qt_aspectos integer;
  c record;
  v_media numeric;
  v_nota numeric;
  v_minimo numeric;
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista for update;
  if v_e."CO_ROTEIRO" is null then return; end if;
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";
  select count(*) into v_qt_aspectos from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_r."CO_ROTEIRO";

  -- A média é de quem lançou e avalia a competência; com aspectos, de quem lançou todos os aspectos.
  for c in
    select k.*, row_number() over (order by k."NU_ORDEM") ord
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_r."CO_ROTEIRO" order by k."NU_ORDEM"
  loop
    if v_qt_aspectos > 0 then
      -- Nota do avaliador = média dos aspectos, sem arredondar; competência = média dos avaliadores.
      select avg(m.media), count(*) into v_media, v_avaliadores
        from (select avg(x."VL_NOTA") media
                from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" x
                join public."TB_ROTEIRO_ASPECTO" s on s."CO_ASPECTO" = x."CO_ASPECTO" and s."CO_ROTEIRO" = v_r."CO_ROTEIRO"
               where x."CO_ENTREVISTA" = p_entrevista and x."CO_COMPETENCIA" = c."CO_COMPETENCIA"
                 and private."FC_AVALIADOR_AVALIA"(x."CO_AVALIADOR", c."CO_COMPETENCIA")
               group by x."CO_AVALIADOR"
              having count(*) = v_qt_aspectos) m;
    else
      select avg(a."VL_NOTA"), count(*) into v_media, v_avaliadores
        from public."TB_ENTREVISTA_AVALIACAO" a
       where a."CO_ENTREVISTA" = p_entrevista and a."CO_COMPETENCIA" = c."CO_COMPETENCIA"
         and private."FC_AVALIADOR_AVALIA"(a."CO_AVALIADOR", c."CO_COMPETENCIA");
    end if;
    if v_avaliadores = 0 then
      v_falta := true;
      update public."TB_ENTREVISTA_NOTA" set "VL_NOTA" = null
       where "CO_ENTREVISTA" = p_entrevista and "NU_ORDEM" = c.ord;
      continue;
    end if;
    v_nota := round(v_media * c."VL_PESO", 2);
    v_total := v_total + v_nota;
    v_bruto := v_bruto + v_media * c."VL_PESO";
    insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
    values (p_entrevista, c.ord, left(c."NO_COMPETENCIA", 600), v_nota)
    on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA";
    if c."VL_MINIMO" is not null then
      v_minimo := case when c."TP_MINIMO" = 'PERCENTUAL'
                       then c."VL_NOTA_MAXIMA" * c."VL_PESO" * c."VL_MINIMO" / 100.0 else c."VL_MINIMO" end;
      if v_nota < v_minimo then v_reprova := true; end if;
    end if;
    -- Notas eliminatórias são valores exatos (ex.: 0 e 1): só sem aspectos (com aspectos vale o mínimo).
    if v_qt_aspectos = 0 and exists (select 1 from jsonb_array_elements_text(v_r."DS_NOTAS_ELIMINATORIAS") x
                where round(v_media, 2) = x::numeric) then
      v_reprova := true;
    end if;
  end loop;

  -- Sem aspectos: soma das competências (2 casas). Com aspectos: soma sem arredondar, 2 casas no fim.
  v_soma := case when v_qt_aspectos > 0 then round(v_bruto, 2) else round(v_total, 2) end;

  update public."TB_ENTREVISTA" set
    "VL_NOTA_TOTAL" = case when "ST_COMPARECEU" = 'N' then 0 when v_falta and v_soma = 0 then null else v_soma end,
    "TP_PARECER" = case
      when "ST_COMPARECEU" = 'N' and v_r."ST_AUSENCIA_ELIMINA" = 'S' then 'INAPTO'
      when "ST_COMPARECEU" is distinct from 'S' or v_falta then 'SEM_PARECER'
      when v_reprova or (v_r."VL_NOTA_MINIMA_TOTAL" is not null and v_soma < v_r."VL_NOTA_MINIMA_TOTAL") then 'INAPTO'
      else 'APTO' end,
    "DT_ATUALIZACAO" = now()
   where "CO_ENTREVISTA" = p_entrevista;
end;
$function$;

comment on function private."FC_CALCULAR_ENTREVISTA"(uuid) is 'Recalcula uma entrevista feita no sistema: média × peso por competência (TB_ENTREVISTA_NOTA), total e parecer pelas regras do roteiro. A média é a dos avaliadores que avaliam a competência (private."FC_AVALIADOR_AVALIA"). Com aspectos: nota do avaliador = média dos aspectos (só com todos lançados), total = soma sem arredondar (2 casas no fim) e eliminação só pelo mínimo da competência.';

-- ── 4. Lançar: recusa a nota em competência que não é do avaliador ─────────

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

  perform private."FC_CALCULAR_ENTREVISTA"(p_entrevista);
  return public.obter_entrevistas_do_edital(v_e."CO_MONITORAMENTO");
end;
$function$;

comment on function public.lancar_notas_entrevista(uuid, jsonb) is 'Lança/corrige notas ({notas:[{competencia, avaliador, nota|null}]}; roteiro com aspectos: {competencia, avaliador, aspectos:[{aspecto, nota}]|null}, todos os aspectos) e o comparecimento ({compareceu:S|N, banca}) de um convocado, valida a escala do roteiro, recusa (23514) a nota de avaliador em competência que não é dele, grava o histórico e recalcula o resultado. entrevistas >= editor; no modo AVALIADOR, só a própria nota.';

-- ── 5. Configurar: as competências de cada membro ──────────────────────────

CREATE OR REPLACE FUNCTION public.configurar_entrevista_edital(p_edital uuid, p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_roteiro uuid := nullif(p_dados ->> 'roteiro', '')::uuid;
  b jsonb;
  v_av uuid;
  v_nome text;
  v_comps uuid[];
  v_qt_roteiro integer;
  v_banca smallint;
  v_competencia text;
begin
  if v_roteiro is null or not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    raise exception 'Escolha um roteiro' using errcode = '22023';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA" e join public."TB_ENTREVISTA_AVALIACAO" x on x."CO_ENTREVISTA" = e."CO_ENTREVISTA"
              where e."CO_MONITORAMENTO" = p_edital and e."CO_ROTEIRO" is distinct from v_roteiro) then
    raise exception 'Já há notas lançadas com outro roteiro neste edital; o roteiro não pode mais ser trocado' using errcode = '23514';
  end if;
  select count(*) into v_qt_roteiro from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_roteiro;

  -- A convocação é a lista da Classificação: DS_CONVOCACAO não é mais gravada (fica o que havia).
  insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
  values (p_edital, v_roteiro, coalesce(p_dados -> 'banca', '[]'),
          coalesce(nullif(p_dados ->> 'lancamento', ''), 'SECRETARIA'), (select auth.uid()))
  on conflict ("CO_MONITORAMENTO") do update set
    "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DS_BANCA" = excluded."DS_BANCA",
    "TP_LANCAMENTO" = excluded."TP_LANCAMENTO", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";

  update public."TB_ENTREVISTA" set "CO_ROTEIRO" = v_roteiro
   where "CO_MONITORAMENTO" = p_edital and "TP_ORIGEM" = 'sistema' and "CO_ROTEIRO" is distinct from v_roteiro;

  -- Outro roteiro, outras competências: os vínculos com as do roteiro anterior saem (o membro volta a avaliar todas).
  delete from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
   using public."TB_ENTREVISTA_AVALIADOR" a, public."TB_ROTEIRO_COMPETENCIA" k
   where l."CO_AVALIADOR" = a."CO_AVALIADOR" and a."CO_MONITORAMENTO" = p_edital
     and k."CO_COMPETENCIA" = l."CO_COMPETENCIA" and k."CO_ROTEIRO" <> v_roteiro;

  -- Banca: membros enviados (com id = atualiza; sem id = novo); os que não vieram saem (ST_ATIVO N).
  if jsonb_typeof(p_dados -> 'avaliadores') = 'array' then
    update public."TB_ENTREVISTA_AVALIADOR" a set "ST_ATIVO" = 'N'
     where a."CO_MONITORAMENTO" = p_edital and a."ST_ATIVO" = 'S'
       and not exists (select 1 from jsonb_array_elements(p_dados -> 'avaliadores') x where nullif(x ->> 'id', '')::uuid = a."CO_AVALIADOR");
    for b in select value from jsonb_array_elements(p_dados -> 'avaliadores') loop
      v_av := null;
      if nullif(b ->> 'id', '') is not null then
        update public."TB_ENTREVISTA_AVALIADOR" set "NO_AVALIADOR" = btrim(b ->> 'nome'), "NO_ORIGEM" = btrim(b ->> 'origem'),
               "NU_BANCA" = coalesce(nullif(b ->> 'banca', '')::smallint, 1), "CO_PERFIL_USUARIO" = nullif(b ->> 'perfil', '')::uuid, "ST_ATIVO" = 'S'
         where "CO_AVALIADOR" = (b ->> 'id')::uuid and "CO_MONITORAMENTO" = p_edital
        returning "CO_AVALIADOR" into v_av;
      else
        insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA", "CO_PERFIL_USUARIO")
        values (p_edital, btrim(b ->> 'nome'), btrim(b ->> 'origem'), coalesce(nullif(b ->> 'banca', '')::smallint, 1), nullif(b ->> 'perfil', '')::uuid)
        returning "CO_AVALIADOR" into v_av;
      end if;

      -- Competências do membro (avaliador por competência): nulo = todas; lista = só estas. Sem a chave, fica como estava.
      if v_av is null or not (b ? 'competencias') then continue; end if;
      if jsonb_typeof(b -> 'competencias') = 'array' then
        begin
          select coalesce(array_agg(distinct x::uuid), '{}') into v_comps from jsonb_array_elements_text(b -> 'competencias') x;
        exception when invalid_text_representation then
          raise exception 'Competência inválida para %', btrim(b ->> 'nome') using errcode = '22023';
        end;
        if cardinality(v_comps) = 0 then
          raise exception 'Marque ao menos uma competência para %', btrim(b ->> 'nome') using errcode = '22023';
        end if;
        if exists (select 1 from unnest(v_comps) c
                    where not exists (select 1 from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_COMPETENCIA" = c and k."CO_ROTEIRO" = v_roteiro)) then
          raise exception 'Competência não é do roteiro deste edital' using errcode = '22023';
        end if;
        if cardinality(v_comps) = v_qt_roteiro then v_comps := '{}'; end if; -- todas = sem vínculo
      elsif jsonb_typeof(b -> 'competencias') = 'null' then
        v_comps := '{}';
      else
        raise exception 'Competências do membro: informe uma lista ou nulo' using errcode = '22023';
      end if;
      -- Não tira de alguém a competência em que ele já deu nota.
      v_nome := null;
      select k."NO_COMPETENCIA" into v_nome
        from public."TB_ENTREVISTA_AVALIACAO" x
        join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = x."CO_COMPETENCIA"
       where x."CO_AVALIADOR" = v_av and cardinality(v_comps) > 0 and not (x."CO_COMPETENCIA" = any (v_comps))
       order by k."NU_ORDEM" limit 1;
      if v_nome is not null then
        raise exception '% já tem nota em "%": apague essas notas antes de tirar a competência dele', btrim(b ->> 'nome'), v_nome using errcode = '23514';
      end if;
      delete from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
       where l."CO_AVALIADOR" = v_av and not (l."CO_COMPETENCIA" = any (v_comps));
      insert into public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" ("CO_AVALIADOR", "CO_COMPETENCIA", "CO_USUARIO_CRIACAO")
      select v_av, c, (select auth.uid()) from unnest(v_comps) c
      on conflict ("CO_AVALIADOR", "CO_COMPETENCIA") do nothing;
    end loop;

    -- Em cada banca com membros, toda competência do roteiro precisa de ao menos um avaliador.
    select bb."NU_BANCA", k."NO_COMPETENCIA" into v_banca, v_competencia
      from (select distinct a."NU_BANCA" from public."TB_ENTREVISTA_AVALIADOR" a
             where a."CO_MONITORAMENTO" = p_edital and a."ST_ATIVO" = 'S') bb
      join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_ROTEIRO" = v_roteiro
     where not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR" a
                        where a."CO_MONITORAMENTO" = p_edital and a."ST_ATIVO" = 'S' and a."NU_BANCA" = bb."NU_BANCA"
                          and private."FC_AVALIADOR_AVALIA"(a."CO_AVALIADOR", k."CO_COMPETENCIA"))
     order by bb."NU_BANCA", k."NU_ORDEM" limit 1;
    if v_competencia is not null then
      raise exception 'Na banca %, ninguém avalia "%": marque essa competência para ao menos um membro', v_banca, v_competencia using errcode = '22023';
    end if;
  end if;

  return public.obter_entrevistas_do_edital(p_edital);
end;
$function$;

comment on function public.configurar_entrevista_edital(uuid, jsonb) is
  'Grava a configuração da entrevista do edital: roteiro, composição da banca, modo de lançamento e membros da banca, com as competências de cada um (avaliadores[].competencias: nulo = todas; lista = só estas; sem a chave, fica como estava). Recusa competência de fora do roteiro, lista vazia e banca com competência sem avaliador (22023), tirar competência de quem já deu nota nela e trocar o roteiro com notas (23514). A convocação e as vagas são as da Classificação. entrevistas >= editor e o edital.';

-- ── 6. Payload: as competências de cada membro ─────────────────────────────

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
  'Condução da entrevista de um edital: configuração (roteiro, banca, lançamento), a lista de convocação vigente da Classificação com o retrato (lista_convocacao), a regra vigente da Classificação (convocação, desempate e empate final), banca (com as competências de cada membro; nulo = todas) e convocados com as notas; pode_editar, pode_gerar_lista, admin_global e meu_perfil.';

-- ── 7. Edital de treinamento: Avaliador Teste 2 (DSEI) só em "Trabalho em equipe" ─

CREATE OR REPLACE FUNCTION private."FC_PREPARAR_TREINAMENTO_SI"(p_grupo text, p_planilha text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  c_numero constant text := '991/2099';
  c_edital constant text := 'Treinamento – Saúde Indígena (991/2099)';
  c_unidade constant text := 'DSEI Treinamento';
  c_origem constant text := 'treinamento';
  v_area constant text := 'saude-indigena';
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_id uuid;
  v_planilha text := p_planilha;
  v_grupo text := p_grupo;
  v_enun_fund text[];
  v_enun_sup text[];
  v_enun_tec text[];
  v_perguntas jsonb;
  v_roteiro uuid;
  v_origem_roteiro uuid;
  v_regra_classif uuid;
  v_config_classif jsonb;
  v_modelo public."TB_REGRA_ANALISE_MODELO";
  v_config_analise jsonb;
  v_resultado jsonb;
begin
  -- Vagas, candidatos e notas fictícios (nada de dado pessoal real).
  create temporary table if not exists tmp_treino_vaga (
    vaga text primary key, ordem smallint, cargo text, imediatas integer, cr boolean, nivel text
  ) on commit drop;
  truncate tmp_treino_vaga;
  insert into tmp_treino_vaga values
    ('9909910001', 1, 'Enfermeiro', 2, true, 'Superior'),
    ('9909910002', 2, 'Técnico de Enfermagem', 3, true, 'Técnico'),
    ('9909910003', 3, 'Agente Indígena de Saúde (AIS)', 2, false, 'Fundamental');

  create temporary table if not exists tmp_treino_candidato (
    n integer primary key, codigo text, nome text, email text, vaga text, nota numeric,
    modalidade text, indigena boolean, nascimento date
  ) on commit drop;
  truncate tmp_treino_candidato;
  insert into tmp_treino_candidato
  select n, 'TREINO-' || lpad(n::text, 2, '0'), 'Candidato Teste ' || lpad(n::text, 2, '0'),
         'candidato.teste' || lpad(n::text, 2, '0') || '@exemplo.invalid',
         case when n <= 5 then '9909910001' when n <= 11 then '9909910002' else '9909910003' end,
         (array[82.5, 77, 71.25, 64, 58.5, 88, 79.5, 73, 69.75, 61, 55.5, 74, 68.25, 62, 51.5])[n],
         case when n in (3, 8, 12, 14) then 'Indígenas' else 'Ampla Concorrência' end,
         n in (3, 8, 12, 13, 14),
         make_date(1970 + n * 2, 1 + (n % 12), 1 + n)
    from generate_series(1, 15) n;

  -- O edital.
  select m.id into v_id
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" = v_area and m."ST_TREINAMENTO" = 'S'
   order by m.created_at, m.id
   limit 1;
  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA" (
      processo, edital, sigla_unidade, tipo_unidade, unidade, uf, ciclo, cargos, vagas_total, inscritos,
      aptos_analise, data_inicio, data_fim, status, etapa, risco, responsavel, observacoes,
      observacoes_internas, ativo, origem_carga, cronograma_origem, "CO_AREA", "ST_TREINAMENTO")
    values (
      'TREINAMENTO', c_edital, 'TREINO', 'DSEI', c_unidade, 'DF', '2099',
      'Enfermeiro; Técnico de Enfermagem; Agente Indígena de Saúde (AIS)', 7, 15, 15,
      v_hoje - 45, v_hoje + 30, 'Em andamento', 'Entrevistas', 'Baixo', 'Treinamento',
      'Edital de treinamento: dados fictícios, sem valor oficial.',
      'Criado por private."FC_PREPARAR_EDITAL_TREINAMENTO". Reinicie em Editais (admin).',
      true, 'TREINAMENTO', 'MANUAL', v_area, 'S')
    returning id into v_id;
  end if;

  -- Cronograma relativo a hoje: inscrições já passaram, avaliação documental e
  -- entrevistas em andamento (FC_JANELA_ENTREVISTA fica aberta).
  if not exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = v_id) then
    insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, tipo_atividade, data_inicio, data_fim, origem, observacao)
    select v_id, x.ordem, x.atividade, x.tipo, v_hoje + x.ini, v_hoje + x.fim, 'MANUAL', 'Treinamento'
      from (values
        (1, 'Publicação do Edital', 'PUBLICACAO', -45, -45),
        (2, 'Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos', 'INSCRICAO', -44, -30),
        (3, 'Avaliação Documental e de Títulos', 'ANALISE', -29, 10),
        (4, 'Resultado Preliminar da Avaliação Documental e de Títulos', 'RESULTADO', -12, -12),
        (5, 'Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos', 'RECURSO', -11, -9),
        (6, 'Resultado Final da Avaliação Documental e de Títulos', 'RESULTADO', -7, -7),
        (7, 'Convocação para a Entrevista', 'CONVOCACAO', -5, -5),
        (8, 'Período de Entrevistas', 'ENTREVISTA', -2, 12),
        (9, 'Resultado Preliminar das Entrevistas', 'RESULTADO', 15, 15),
        (10, 'Prazo para recursos referentes ao resultado preliminar das entrevistas', 'RECURSO', 16, 18),
        (11, 'Resultado final da Entrevista', 'RESULTADO', 21, 21),
        (12, 'Resultado final do Processo Seletivo', 'RESULTADO', 25, 25)
      ) x(ordem, atividade, tipo, ini, fim);
  end if;

  -- Quadro de vagas.
  if not exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = v_id and q."ST_REGISTRO_ATIVO" = 'S') then
    insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO",
      "DS_MODALIDADE_VAGA", "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
    select v_id, t.ordem, t.cargo, c_unidade,
           jsonb_build_object('Ampla Concorrência', t.imediatas, 'Indígenas', null),
           t.imediatas, case when t.cr then 'S' else 'N' end, 'MANUAL', 'treinamento', v_uid
      from tmp_treino_vaga t;
  end if;

  -- Análises curriculares fictícias (aprovadas): a fonte da Classificação e da convocação.
  insert into public."TB_ANALISE_CURRICULAR" (grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, cpf_hash,
    categoria, modalidade_concorrencia, status_consolidado, etapa, responsavel_analise, data_analise,
    nota_final_ajustada, pontuacao_escolaridade, pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional, pontuacao_criterio_etnico, experiencia_saude_indigena_total,
    experiencia_atencao_basica_total, analise, ativo, id_origem, data_nascimento, nota_empregare,
    pcd, origem_planilha, chave_natural, "CO_AREA", "CO_PLANILHA")
  select v_grupo, c_unidade, c_edital, c.vaga, v.cargo, c.nome, null,
         v.nivel, c.modalidade, 'Aprovado', 'Análise concluída', 'Treinamento', v_hoje - 14,
         c.nota, round(c.nota * 0.3, 2), round(c.nota * 0.1, 2), round(c.nota * 0.4, 2),
         case when c.indigena then 14 else 0 end, (c.n % 5) * 6, (c.n % 4) * 9,
         'Análise fictícia do edital de treinamento.', true, c.codigo, c.nascimento, round(c.nota * 0.9, 2),
         'Não', c_origem, c_origem || '|' || v_area || '|' || c.codigo, v_area, v_planilha
    from tmp_treino_candidato c
    join tmp_treino_vaga v on v.vaga = c.vaga
  on conflict (chave_natural) do nothing;

  -- Roteiro de exemplo, com os aspectos (id fixo por área: o reinício reaproveita). É a
  -- versão seguinte do roteiro de exemplo sem aspectos, quando ele já existe.
  v_roteiro := md5('agsus-treinamento-roteiro-aspectos-' || v_area)::uuid;
  if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    v_origem_roteiro := md5('agsus-treinamento-roteiro-' || v_area)::uuid;
    if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem_roteiro) then
      v_origem_roteiro := v_roteiro;
    end if;
    update public."TB_ROTEIRO_ENTREVISTA" set "ST_ATIVO" = 'N'
     where "CO_ROTEIRO_ORIGEM" = v_origem_roteiro and "ST_ATIVO" = 'S';
    insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
      "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
      "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE",
      "DS_CONVOCACAO_PADRAO", "DS_BANCA_PADRAO", "ST_ATIVO")
    values (v_roteiro, v_origem_roteiro,
      (select coalesce(max(r."NU_VERSAO"), 0) + 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem_roteiro),
      v_area, 'Treinamento — Entrevista individual (exemplo)',
      'Roteiro de exemplo do edital de treinamento: 4 competências; cada avaliador dá de 0 a 5 em 3 aspectos (Conceitua, Propriedade, Profundidade) e a nota dele é a média; apto com 8 pontos e 2 em cada competência (abaixo de 2 elimina).',
      'Entrevista Individual', 'NIVEIS', 1, '[]'::jsonb, 8, '[]'::jsonb, 'S',
      '["Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa)", "Maior pontuação na Avaliação Documental e de Títulos", "Maior pontuação na Entrevista"]'::jsonb,
      'S', '{"multiplo_imediatas": 3, "posicao_cadastro_reserva": 5}'::jsonb,
      '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'S');
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO")
    values (v_roteiro, 1, 'Comunicação e escuta', 'Expressa-se com clareza e escuta o outro.', 5, 1, 2),
           (v_roteiro, 2, 'Trabalho em equipe', 'Colabora e compartilha responsabilidades.', 5, 1, 2),
           (v_roteiro, 3, 'Respeito à diversidade cultural', 'Reconhece e respeita os modos de vida dos povos indígenas.', 5, 1, 2),
           (v_roteiro, 4, 'Conhecimento da função', 'Conhece as atribuições do cargo no território.', 5, 1, 2);
    insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
    values (v_roteiro, 0, 'Não demonstrou', null), (v_roteiro, 1, 'Insuficiente', null),
           (v_roteiro, 2, 'Básico', null), (v_roteiro, 3, 'Adequado', null),
           (v_roteiro, 4, 'Bom', null), (v_roteiro, 5, 'Excelente', null);
    insert into public."TB_ROTEIRO_ASPECTO" ("CO_ROTEIRO", "NU_ORDEM", "NO_ASPECTO")
    values (v_roteiro, 1, 'Conceitua'), (v_roteiro, 2, 'Propriedade'), (v_roteiro, 3, 'Profundidade');
  end if;

  -- Entrevista configurada (roteiro, banca, vagas imediatas e avaliadores fictícios).
  if not exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_CONVOCACAO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
    values (v_id, v_roteiro, '{}'::jsonb,
            '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'SECRETARIA', v_uid);
  end if;
  insert into public."TB_ENTREVISTA_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "QT_VAGA_IMEDIATA")
  select v_id, t.vaga, t.imediatas from tmp_treino_vaga t
   where not exists (select 1 from public."TB_ENTREVISTA_VAGA" x where x."CO_MONITORAMENTO" = v_id and x."CO_VAGA" = t.vaga);
  if not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA")
    values (v_id, 'Avaliador Teste 1', 'AgSUS', 1), (v_id, 'Avaliador Teste 2', 'DSEI', 1);
    -- Exemplo de avaliador por competência: o Avaliador Teste 2 (DSEI) avalia só "Trabalho em equipe".
    insert into public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" ("CO_AVALIADOR", "CO_COMPETENCIA", "CO_USUARIO_CRIACAO")
    select b."CO_AVALIADOR", k."CO_COMPETENCIA", v_uid
      from public."TB_ENTREVISTA_AVALIADOR" b
      join public."TB_ENTREVISTA_EDITAL" e on e."CO_MONITORAMENTO" = b."CO_MONITORAMENTO"
      join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_ROTEIRO" = e."CO_ROTEIRO" and k."NO_COMPETENCIA" = 'Trabalho em equipe'
     where b."CO_MONITORAMENTO" = v_id and b."NO_AVALIADOR" = 'Avaliador Teste 2';
  end if;

  -- Regra da classificação (formato de src/lib/classificacao/regra.js) e a lista de convocação.
  select r."CO_REGRA_CLASSIFICACAO" into v_regra_classif
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v_id;
  if v_regra_classif is null then
    v_config_classif := jsonb_build_object(
      'schema', 1,
      'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
      'etapas', jsonb_build_object('documental', true, 'entrevista', true),
      'documental', jsonb_build_object('situacoes_aptas', jsonb_build_array('Aprovado'), 'nota_minima', null,
                                       'nota_minima_por_nivel', '{}'::jsonb, 'niveis_por_cargo', '[]'::jsonb,
                                       'nivel_padrao', null, 'parciais', '[]'::jsonb),
      'entrevista', jsonb_build_object('nota_minima', 8, 'nota_minima_competencia', 2, 'nota_eliminatoria_ate', 0,
                                       'competencias', '[]'::jsonb, 'exige_comparecimento', true,
                                       'inapto_elimina', true, 'so_parecer', false),
      'composicao', jsonb_build_object('componentes', jsonb_build_array(
                                         jsonb_build_object('codigo', 'DOCUMENTAL', 'peso', 1),
                                         jsonb_build_object('codigo', 'ENTREVISTA', 'peso', 1)),
                                       'casas', 2, 'arredondamento', 'MEIO_PARA_CIMA'),
      'desempate', '[]'::jsonb,
      'listas', jsonb_build_object('PRELIMINAR', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'ENTREVISTA', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'FINAL', jsonb_build_object('empate', 'CRITERIOS')),
      'empate_final', jsonb_build_object('metodo', 'MESMA_POSICAO', 'numeracao', 'DENSA'),
      'modalidades', jsonb_build_array(jsonb_build_object(
                       'codigo', 'AC', 'nome', 'Ampla concorrência', 'percentual', null,
                       'arredondamento', 'MEIO_PARA_CIMA', 'lista_propria', false, 'recomeca_posicao', true,
                       'aparece_na_geral', true, 'remanejar_para', '[]'::jsonb, 'agrupa', '[]'::jsonb)),
      'cotas', jsonb_build_object('minimo_vagas_reserva', 0, 'acumulo', 'TODAS'),
      'convocacao', jsonb_build_object('multiplo_vagas', 3, 'posicao_max_cr', 5, 'incluir_empatados', true,
                                       'excecoes', '[]'::jsonb),
      'rodape', 'TREINAMENTO — sem valor oficial.',
      'documento', jsonb_build_object('edital', 'TREINAMENTO ' || c_numero, 'unidade', c_unidade));
    perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_config_classif);
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (v_id, 1, v_uid) returning "CO_REGRA_CLASSIFICACAO" into v_regra_classif;
    insert into public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra_classif, 1, v_config_classif, 'MESMA_POSICAO', 'Edital de treinamento', v_uid);
  end if;

  if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l where l."CO_MONITORAMENTO" = v_id and l."TP_LISTA" = 'CONVOCACAO') then
    with ordenados as (
      select a.id, a.candidato, a.nota_final_ajustada as nota, a.codigo_vaga,
             rank() over (partition by a.codigo_vaga order by a.nota_final_ajustada desc) as posicao
        from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = v_area and a.ativo and private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and private."FC_NUMERO_EDITAL"(a.edital) = c_numero
    ),
    vagas as (
      select t.ordem, jsonb_build_object(
               'codigo', t.vaga, 'chave', t.vaga, 'cargo', t.cargo, 'lotacao', c_unidade,
               'cabecalho', 'Vaga ' || t.vaga || ' — ' || t.cargo || ' — ' || c_unidade,
               'total', t.imediatas, 'cadastro_reserva', t.cr, 'origem_das_vagas', 'QUADRO',
               'limite_convocacao', null,
               'geral', coalesce((select jsonb_agg(jsonb_build_object(
                          'analise_id', o.id, 'nome', o.candidato, 'posicao', o.posicao, 'nota', o.nota,
                          'modalidades', '[]'::jsonb, 'situacao', 'Classificado') order by o.posicao, o.candidato)
                          from ordenados o where o.codigo_vaga = t.vaga), '[]'::jsonb),
               'listas', '{}'::jsonb, 'eliminados', '[]'::jsonb) as vaga
        from tmp_treino_vaga t
    )
    select jsonb_build_object(
             'schema', 1, 'tipo', 'CONVOCACAO', 'casas', 2, 'avisos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
             'edital', jsonb_build_object('id', v_id, 'edital', c_edital, 'unidade', c_unidade, 'treinamento', true),
             'rodape', 'TREINAMENTO — sem valor oficial.', 'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
             'modalidades', '[]'::jsonb, 'empate_final', 'MESMA_POSICAO', 'regra_versao', 1,
             'totais', jsonb_build_object('vagas', (select sum(t.imediatas) from tmp_treino_vaga t),
                                          'avisos', 0, 'elegiveis', (select count(*) from ordenados),
                                          'candidatos', (select count(*) from ordenados), 'eliminados', 0, 'pendencias', 0),
             'vagas', (select jsonb_agg(v.vaga order by v.ordem) from vagas v))
      into v_resultado;
    insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
      "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "CO_USUARIO")
    values (v_id, 'CONVOCACAO', v_regra_classif, 1, v_resultado,
            encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'),
            (v_resultado #>> '{totais,elegiveis}')::integer, v_uid);
  end if;

  -- Avaliação documental: inscrições e questionários no formato da exportação da Empregare,
  -- com os enunciados do questionário NERSSI da Saúde Indígena (o do Edital 101/2026; nos
  -- níveis superior e técnico, as perguntas de escolaridade e formação do mesmo jeito).
  v_enun_fund := array[
       $q$Nome completo:(conforme registrado em documento, sem abreviações)$q$,
       $q$Número do CPF:(vinculado ao nome informado acima)Ex: 000.000.000-00$q$,
       $q$Data de nascimento (dd/mm/aaaa):dd/mm/aaaa = dia/mês/ano$q$,
       $q$Anexe um documento de identificação com foto ( frente e verso).Conforme orientação do item 6,4, alínea "c", do Edital.$q$,
       $q$Indique em qual sistema de concorrência deseja se inscrever:$q$,
       $q$Você é indígena e mora em aldeia?(será necessária a comprovação)Ser Indígena: 8 pontosResidir em Aldeia: 6 pontosMáximo: 14 pontos$q$,
       $q$Anexe sua identificação e/ou Declaração de Pertencimento Étnico e/ou de moradia em aldeia:(Obrigatório o envio de identificação étnica, conforme item 6.4 do edital, alínea "h")(Para resid$q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos:Anexe, neste campo, a autodeclaração conforme o modelo constante no Anexo IX.Importante: Candidatos(as) que $q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos, grave um vídeo, em fundo branco, com duração máxima de 20 segundos, apresentando o seu nome completo e a co$q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos, anexe uma foto de frente e uma foto de perfil, reunidas em um único arquivo, preferencialmente no formato $q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Quilombolas:Anexe, neste campo, a autodeclaração, conforme o modelo constante no Anexo XI e as orientações descritas no ite$q$,
       $q$Candidatos(as) que concorrem às vagas destinadas a PCD devem anexar aqui o laudo médico, devidamente assinado por médico(a) com registro ativo no CRM, conforme descrito no item 4 do Edit$q$,
       $q$Você possui nível fundamental completo ?(será necessária a comprovação)$q$,
       $q$Anexe certificado ou histórico escolar de conclusão de nível fundamental:(frente e verso de acordo com o item 8.12.2 do Edital)Se desejar unir as páginas em arquivo único, favor acessar $q$,
       $q$Você possui ensino médio completo ?(será necessária a comprovação)$q$,
       $q$Anexe o certificado de conclusão de nível médio.(frente e verso, de acordo com o item 8.12.2 do Edital)Se desejar unir as páginas em arquivo único, favor acessar o site: Unir PDF.$q$,
       $q$Selecione sua Experiência Profissional na área/vaga em que concorre:(0,2 ponto por mês)&nbsp;Pontuação máxima: 10 pontos.Conforme o item 8.15.2.1 do Edital,para candidatos indígenas, ind$q$,
       $q$Anexe o comprovante de Experiência Profissional na vaga em que concorre:Serão aceitos comprovante de acordo com o item 8.15 do edital e suas respectivas alíneas e subitens.&nbsp;Se preci$q$,
       $q$Você possui cônjuge, companheiro(a), parentes até o terceiro grau ou qualquer conhecido que integre o quadro de trabalhadores da AgSUS?$q$,
       $q$Se respondeu SIM na pergunta anterior, por gentileza informe o nome do trabalhador da AgSUS.$q$,
       $q$Você está com contrato de trabalho ativo na AgSUS ou foi desligado nos últimos 6 meses?$q$,
       $q$Você possui interesse em atuar em outros DSEI?$q$,
       $q$TERMO DE RESPONSABILIDADE PELAS INFORMAÇÕES DECLARADASDeclaro que todas as informações prestadas neste Formulário de Inscrição são verdadeiras e correspondem aos documentos comprobatório$q$,
       $q$Declaro estar ciente de que meus dados pessoais poderão ser coletados, tratados e compartilhados com órgãos competentes, exclusivamente para fins de participação em processos seletivos e$q$];
  v_enun_sup := v_enun_fund[1:12] || array[
    'Você possui graduação na área da vaga ?(será necessária a comprovação)',
    'Anexe o diploma de graduação na área da vaga:(frente e verso de acordo com o item 8.12.2 do Edital)',
    'Qual sua titulação acadêmica na área da vaga ?(será necessária a comprovação)Especialização: 1 pontoMestrado ou Residência: 2 pontosDoutorado: 3 pontos',
    'Anexe os comprovantes de titulação acadêmica.(frente e verso, de acordo com o item 8.12.2 do Edital)'] || v_enun_fund[17:];
  v_enun_tec := v_enun_fund[1:12] || array[
    'Você possui curso técnico na área da vaga ?(será necessária a comprovação)',
    'Anexe o certificado do curso técnico na área da vaga:(frente e verso de acordo com o item 8.12.2 do Edital)',
    'Você possui especialização técnica ou graduação na área da vaga ?(será necessária a comprovação)Especialização técnica: 2 pontosGraduação: 4 pontos',
    'Anexe o certificado de especialização técnica ou o diploma de graduação.(frente e verso, de acordo com o item 8.12.2 do Edital)'] || v_enun_fund[17:];

  -- Código de vaga fictícia já usado por vaga real ou carregada pelo robô: recusa sem mexer.
  if exists (select 1 from public."TB_EMPREGARE_VAGA" v join tmp_treino_vaga t on t.vaga = v."CO_VAGA"
              where v."CO_MONITORAMENTO" is distinct from v_id or v."CO_SYNC" is not null) then
    raise exception 'Vaga fictícia do treinamento já existe fora dele (ou veio do robô da Empregare): nada foi feito' using errcode = '23514';
  end if;

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "TP_SITUACAO", "DS_COLUNA", "NO_ARQUIVO",
    "QT_CANDIDATO_ATIVO", "QT_LINHA_ARQUIVO", "QT_RECEBIDA", "DS_MENSAGEM", "DT_ULTIMA_CARGA")
  select t.vaga, v_id, 'GRAVADA',
         private."FC_TREINO_COLUNAS"('NÍVEL ' || upper(t.nivel) || ' - DSEI TREINAMENTO',
           case t.nivel when 'Superior' then v_enun_sup when 'Técnico' then v_enun_tec else v_enun_fund end, false),
         'treinamento-' || t.vaga || '.xlsx',
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         'Carga fictícia do edital de treinamento.', now()
    from tmp_treino_vaga t
  on conflict ("CO_VAGA") do update set
    "DS_COLUNA" = excluded."DS_COLUNA"
   where public."TB_EMPREGARE_VAGA"."CO_MONITORAMENTO" = v_id and public."TB_EMPREGARE_VAGA"."CO_SYNC" is null;

  -- As respostas batem com as perguntas da regra (SI26-PARINTINS, abaixo); a ART
  -- ("x,x/30,0") é a soma declarada: étnico (8 + 6) + formação + 0,2 por mês de experiência.
  insert into public."TB_EMPREGARE_CANDIDATO" ("CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO", "DS_EMAIL", "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA")
  select x.vaga, 'cod:' || x.codigo, 'CODIGO', x.codigo, x.nome, x.email, null, '(00) 00000-0000', x.nascimento,
         'Inscrito', x.candidatura::timestamp at time zone 'America/Sao_Paulo', x.original,
         encode(sha256(convert_to(x.original::text, 'UTF8')), 'hex')
    from (
      select c.*, r.candidatura,
             private."FC_TREINO_INSCRICAO"('NÍVEL ' || upper(t.nivel) || ' - DSEI TREINAMENTO',
               case t.nivel when 'Superior' then v_enun_sup when 'Técnico' then v_enun_tec else v_enun_fund end, false,
               jsonb_build_object(
                 'codigo', c.codigo, 'nome', c.nome, 'email', c.email, 'nascimento', c.nascimento,
                 'candidatura', r.candidatura, 'uf', 'DF', 'situacao', 'INSCRITO',
                 'quest', r.quest,
                 'art', replace(to_char(r.etnico + r.formacao + least(10, r.meses * 0.2), 'FM990.0'), '.', ',') || '/30,0',
                 'modal', case when c.modalidade = 'Indígenas' then '"Indígenas"' else '"Ampla concorrência"' end,
                 'etnico', case when r.etnico = 14 then '"Sou indígena", "Moro em aldeia"'
                                when r.etnico = 8 then '"Sou indígena"' else '"Não se aplica"' end,
                 'escol', '"Sim"',
                 'especial', case t.nivel
                               when 'Superior' then case r.formacao when 2 then '"Mestrado ou Residência"' when 1 then '"Especialização"' else '"Não possuo"' end
                               when 'Técnico' then case r.formacao when 4 then '"Graduação na área"' when 2 then '"Especialização técnica na área"' else '"Não possuo"' end
                               else case r.formacao when 6 then '"Certificado de conclusão de nível médio porinstituição reconhecida pelo MEC"' else '"Não possuo"' end
                             end,
                 'exp', case when r.meses = 0 then '"Não possuo"'
                             when r.meses < 12 then '"' || r.meses || ' meses"'
                             when r.meses % 12 = 0 then '"' || (r.meses / 12) || case when r.meses = 12 then ' ano"' else ' anos"' end
                             else '"' || (r.meses / 12) || case when r.meses < 24 then ' ano e ' else ' anos e ' end
                                  || (r.meses % 12) || case when r.meses % 12 = 1 then ' mês"' else ' meses"' end
                        end,
                 'conjuge', '"Não"', 'contrato', '"Não"',
                 'termo', '"Declaro que li, compreendi e concordo com as condições acima.&nbsp;"', 'declaro', '"Sim"',
                 'reprovado', 'NÃO',
                 'nivel_formacao', t.nivel, 'curso_formacao', t.cargo)) as original
        from tmp_treino_candidato c
        join tmp_treino_vaga t on t.vaga = c.vaga
       cross join lateral (
         select v_hoje - 40 + (c.n % 10) as candidatura,
                -- O último ficou com o questionário em andamento (cai na eliminação automática).
                case when c.n = 15 then 'EM ANDAMENTO' else 'FINALIZADO' end as quest,
                case when c.n in (3, 12, 14) then 14 when c.n in (8, 13) then 8 else 0 end as etnico,
                case t.nivel when 'Superior' then (c.n % 3) when 'Técnico' then (array[0, 2, 4])[1 + c.n % 3]
                             else case when c.n % 2 = 0 then 6 else 0 end end as formacao,
                (array[0, 3, 6, 14, 26, 50, 9, 18, 31, 44, 4, 12, 22, 7, 60])[c.n] as meses
       ) r
    ) x
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do update set
    "DS_COLUNA_ORIGINAL" = excluded."DS_COLUNA_ORIGINAL", "DS_HASH_LINHA" = excluded."DS_HASH_LINHA"
   where public."TB_EMPREGARE_CANDIDATO"."CO_SYNC" is null
     and exists (select 1 from public."TB_EMPREGARE_VAGA" v
                  where v."CO_VAGA" = public."TB_EMPREGARE_CANDIDATO"."CO_VAGA" and v."CO_MONITORAMENTO" = v_id and v."CO_SYNC" is null)
     and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" p
                      where p."CO_EMPREGARE_CANDIDATO" = public."TB_EMPREGARE_CANDIDATO"."CO_EMPREGARE_CANDIDATO");

  -- A avaliação documental do edital é feita no MONITORA.
  insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM")
  values (v_id, 'MONITORA')
  on conflict ("CO_MONITORAMENTO") do nothing;

  -- Regra da avaliação documental: a do edital SI real mais recente em andamento com regra
  -- própria — nenhum edital SI tem regra conferida no MONITORA ainda; o mais recente com o
  -- modelo do próprio PDF é o 111/2026 (DSEI Parintins, modelo SI26-PARINTINS) —, com as
  -- perguntas do questionário NERSSI ligadas aos blocos. Situação CONFERIR: conferir faz
  -- parte do treino. A antiga (SI26-ALSE) fica no histórico.
  select * into v_modelo
    from public."TB_REGRA_ANALISE_MODELO" m
   where m."CO_MODELO" = 'SI26-PARINTINS' and m."ST_ATIVO" = 'S';
  if v_modelo."CO_MODELO" is not null then
    v_perguntas := jsonb_build_object(
      'IDENTIDADE', jsonb_build_array('Anexe um documento de identificação com foto'),
      'MODALIDADE', jsonb_build_array('Indique em qual sistema de concorrência'),
      'ESCOLARIDADE', jsonb_build_array('Você possui nível fundamental completo', 'Anexe certificado ou histórico escolar de conclusão de nível fundamental',
                                        'Você possui curso técnico na área da vaga', 'Anexe o certificado do curso técnico na área da vaga',
                                        'Você possui graduação na área da vaga', 'Anexe o diploma de graduação na área da vaga'),
      'ETNICO', jsonb_build_array('Você é indígena e mora em aldeia', 'Anexe sua identificação e/ou Declaração de Pertencimento Étnico'),
      'COTA_PP', jsonb_build_array('Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos'),
      'COTA_PI', jsonb_build_array('Anexe sua identificação e/ou Declaração de Pertencimento Étnico'),
      'COTA_PQ', jsonb_build_array('Candidatos(as) que optaram por concorrer às vagas destinadas a Quilombolas'),
      'COTA_PCD', jsonb_build_array('Candidatos(as) que concorrem às vagas destinadas a PCD'),
      'FORMACAO', jsonb_build_array('Você possui ensino médio completo', 'Anexe o certificado de conclusão de nível médio',
                                    'Você possui especialização técnica ou graduação na área da vaga', 'Anexe o certificado de especialização técnica ou o diploma de graduação',
                                    'Qual sua titulação acadêmica na área da vaga', 'Anexe os comprovantes de titulação acadêmica'),
      'EXPERIENCIA', jsonb_build_array('Selecione sua Experiência Profissional na área/vaga em que concorre', 'Anexe o comprovante de Experiência Profissional'));
    v_config_analise := jsonb_set(v_modelo."DS_CONFIGURACAO", '{blocos}', coalesce((
        select jsonb_agg(b.bloco || case when v_perguntas ? (b.bloco ->> 'codigo')
                                         then jsonb_build_object('perguntas', v_perguntas -> (b.bloco ->> 'codigo'))
                                         else '{}'::jsonb end order by b.ordem)
          from jsonb_array_elements(v_modelo."DS_CONFIGURACAO" -> 'blocos') with ordinality b(bloco, ordem)), '[]'::jsonb))
      || jsonb_build_object('modelo', v_modelo."CO_MODELO", 'edital_rotulo', 'Edital ' || c_numero || ' (TREINAMENTO)');
    perform private."FC_REGRA_DO_TREINAMENTO"(v_id, v_config_analise, 'CONFERIR',
      'Edital de treinamento: regra do Edital 111/2026 (modelo SI26-PARINTINS) com as perguntas do questionário NERSSI', v_uid);
  end if;

  return v_id;
end;
$function$;

comment on function private."FC_PREPARAR_TREINAMENTO_SI"(text, text) is
  'Edital de treinamento da Saúde Indígena ("Treinamento – Saúde Indígena (991/2099)", unidade "DSEI Treinamento"): cronograma relativo a hoje (janela de entrevista aberta), quadro, 15 candidatos fictícios (análise aprovada, lista de convocação, inscrição e questionário NERSSI no formato da Empregare), roteiro de exemplo, banca com o Avaliador Teste 2 (DSEI) avaliando só "Trabalho em equipe", regra da classificação e regra da avaliação documental do Edital 111/2026 (SI26-PARINTINS) com as perguntas ligadas. Chamada só por private."FC_PREPARAR_EDITAL_TREINAMENTO".';

-- O edital de treinamento de hoje: o exemplo entra agora se o Avaliador Teste 2 ainda não deu nota fora de "Trabalho em equipe".
insert into public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" ("CO_AVALIADOR", "CO_COMPETENCIA")
select b."CO_AVALIADOR", k."CO_COMPETENCIA"
  from public."TB_MONITORAMENTO_INDIGENA" m
  join public."TB_ENTREVISTA_EDITAL" e on e."CO_MONITORAMENTO" = m.id
  join public."TB_ENTREVISTA_AVALIADOR" b on b."CO_MONITORAMENTO" = m.id and b."NO_AVALIADOR" = 'Avaliador Teste 2' and b."ST_ATIVO" = 'S'
  join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_ROTEIRO" = e."CO_ROTEIRO" and k."NO_COMPETENCIA" = 'Trabalho em equipe'
 where private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") and m."CO_AREA" = 'saude-indigena'
   and not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l where l."CO_AVALIADOR" = b."CO_AVALIADOR")
   and not exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" x
                    where x."CO_AVALIADOR" = b."CO_AVALIADOR" and x."CO_COMPETENCIA" <> k."CO_COMPETENCIA");

notify pgrst, 'reload schema';

-- ═══ Conferências do ensaio ════════════════════════════════════════════════
create temp table ensaio_resultado (passo text primary key, ok boolean, detalhe text) on commit drop;

-- E1. Esquema: sem vínculo nos editais reais; sem vínculo, todos avaliam todas.
do $$
declare
  v_treino uuid;
  v_exemplo text;
begin
  if to_regclass('public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA"') is null then raise exception 'FALHOU E1: tabela não criada'; end if;
  select m.id into v_treino from public."TB_MONITORAMENTO_INDIGENA" m
   where private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") and m."CO_AREA" = 'saude-indigena' limit 1;
  if exists (select 1 from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
               join public."TB_ENTREVISTA_AVALIADOR" b on b."CO_AVALIADOR" = l."CO_AVALIADOR"
              where b."CO_MONITORAMENTO" is distinct from v_treino) then
    raise exception 'FALHOU E1: vínculo fora do edital de treinamento';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA_AVALIADOR" b
               join public."TB_ENTREVISTA_EDITAL" e on e."CO_MONITORAMENTO" = b."CO_MONITORAMENTO"
               join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_ROTEIRO" = e."CO_ROTEIRO"
              where b."CO_MONITORAMENTO" is distinct from v_treino
                and not private."FC_AVALIADOR_AVALIA"(b."CO_AVALIADOR", k."CO_COMPETENCIA")) then
    raise exception 'FALHOU E1: membro de edital real deixou de avaliar alguma competência';
  end if;
  -- O exemplo do treinamento: entra agora se o Avaliador Teste 2 ainda não deu nota fora de "Trabalho em equipe".
  select case
           when exists (select 1 from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
                          join public."TB_ENTREVISTA_AVALIADOR" b on b."CO_AVALIADOR" = l."CO_AVALIADOR"
                          join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = l."CO_COMPETENCIA"
                         where b."CO_MONITORAMENTO" = v_treino and b."NO_AVALIADOR" = 'Avaliador Teste 2'
                           and k."NO_COMPETENCIA" = 'Trabalho em equipe') then 'exemplo gravado agora'
           when exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" x
                          join public."TB_ENTREVISTA_AVALIADOR" b on b."CO_AVALIADOR" = x."CO_AVALIADOR"
                          join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = x."CO_COMPETENCIA"
                         where b."CO_MONITORAMENTO" = v_treino and b."NO_AVALIADOR" = 'Avaliador Teste 2'
                           and k."NO_COMPETENCIA" <> 'Trabalho em equipe') then 'exemplo fica para o reinício (Avaliador Teste 2 já tem nota em outra competência)'
           else null end into v_exemplo;
  if v_exemplo is null then raise exception 'FALHOU E1: treinamento sem o exemplo e sem motivo'; end if;
  perform set_config('ensaio.treino', v_treino::text, true);
  insert into ensaio_resultado values ('E1', true, 'tabela criada; editais reais sem vínculo (todos avaliam todas); treinamento: ' || v_exemplo);
end;
$$;

-- E2. Sem vínculo, nada muda: as entrevistas do sistema recalculadas e as da planilha.
do $$
declare
  v uuid;
  v_sistema integer := 0;
  v_diferentes integer;
begin
  for v in select a.id from ensaio_antes a where a.origem = 'sistema'
             and exists (select 1 from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = a.id and e."CO_ROTEIRO" is not null) loop
    perform private."FC_CALCULAR_ENTREVISTA"(v);
    v_sistema := v_sistema + 1;
  end loop;
  select count(*) into v_diferentes
    from ensaio_antes a
    join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = a.id
   where e."VL_NOTA_TOTAL" is distinct from a.total or e."TP_PARECER" is distinct from a.parecer
      or (select jsonb_agg(jsonb_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
            from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = a.id) is distinct from a.notas;
  if v_diferentes > 0 then raise exception 'FALHOU E2: % entrevistas mudaram de nota ou parecer', v_diferentes; end if;
  insert into ensaio_resultado values ('E2', true, v_sistema || ' entrevistas do sistema recalculadas iguais; '
    || (select count(*) from ensaio_antes where origem is distinct from 'sistema') || ' da planilha intactas');
end;
$$;

-- E3. RPCs como administrador sintético (claims do JWT).
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-a000-0000000a5e02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.banca.admin@ensaio.invalid');
insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo)
select '00000000-0000-4000-a000-0000000a5e02', 'ensaio.banca.admin@ensaio.invalid', 'Ensaio Admin',
       (select g."CO_GRUPO_ACESSO" from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL" order by 1 limit 1), true;

do $$
declare
  v_treino uuid := current_setting('ensaio.treino')::uuid;
  v_roteiro uuid;
  v_c uuid[];
  v_asp uuid[];
  v_a1 uuid;
  v_a2 uuid;
  v_e uuid;
  v json;
  v_falhou boolean;
  v_msg text;
  v_item jsonb;

begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000a5e02","role":"authenticated","email":"ensaio.banca.admin@ensaio.invalid"}', true);
  if not private.is_master() then raise exception 'ENSAIO: o admin sintético não é admin global'; end if;

  -- a) Quem já deu nota numa competência não pode perdê-la.
  select b."CO_AVALIADOR" into v_a2 from public."TB_ENTREVISTA_AVALIADOR" b
   where b."CO_MONITORAMENTO" = v_treino and b."NO_AVALIADOR" = 'Avaliador Teste 2' and b."ST_ATIVO" = 'S';
  select e."CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_treino;
  if exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" x join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = x."CO_COMPETENCIA"
              where x."CO_AVALIADOR" = v_a2 and k."NO_COMPETENCIA" <> 'Trabalho em equipe') then
    v_falhou := false;
    begin
      perform public.configurar_entrevista_edital(v_treino, jsonb_build_object('roteiro', v_roteiro, 'lancamento', 'SECRETARIA',
        'avaliadores', (select jsonb_agg(jsonb_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM", 'banca', b."NU_BANCA",
            'competencias', case when b."CO_AVALIADOR" = v_a2
              then (select jsonb_agg(k."CO_COMPETENCIA") from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_roteiro and k."NO_COMPETENCIA" = 'Trabalho em equipe')
              else 'null'::jsonb end))
          from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = v_treino and b."ST_ATIVO" = 'S')));
    exception when sqlstate '23514' then v_falhou := true; get stacked diagnostics v_msg = message_text;
    end;
    if not v_falhou or v_msg not like '%já tem nota em%' then raise exception 'FALHOU E3: tirou competência de quem já tem nota (%)', v_msg; end if;
  end if;

  -- b) O reinício do treinamento traz o exemplo: Avaliador Teste 2 só em "Trabalho em equipe".
  perform public.reiniciar_edital_treinamento(v_treino);
  select e."CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_treino;
  select array_agg(k."CO_COMPETENCIA" order by k."NU_ORDEM") into v_c from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_roteiro;
  select array_agg(s."CO_ASPECTO" order by s."NU_ORDEM") into v_asp from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_roteiro;
  select b."CO_AVALIADOR" into v_a1 from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = v_treino and b."NO_AVALIADOR" = 'Avaliador Teste 1';
  select b."CO_AVALIADOR" into v_a2 from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = v_treino and b."NO_AVALIADOR" = 'Avaliador Teste 2';
  if (select array_agg(l."CO_COMPETENCIA") from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l where l."CO_AVALIADOR" = v_a2) is distinct from array[v_c[2]]
     or exists (select 1 from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l where l."CO_AVALIADOR" = v_a1)
     or (select k."NO_COMPETENCIA" from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_COMPETENCIA" = v_c[2]) <> 'Trabalho em equipe' then
    raise exception 'FALHOU E3: reinício sem o exemplo do Avaliador Teste 2';
  end if;
  if private."FC_AVALIADOR_AVALIA"(v_a2, v_c[1]) or not private."FC_AVALIADOR_AVALIA"(v_a2, v_c[2]) or not private."FC_AVALIADOR_AVALIA"(v_a1, v_c[1]) then
    raise exception 'FALHOU E3: FC_AVALIADOR_AVALIA';
  end if;

  -- c) O payload traz as competências de cada membro (nulo = todas).
  v := public.obter_entrevistas_do_edital(v_treino);
  if (select a -> 'competencias' from json_array_elements(v -> 'avaliadores') a where a ->> 'id' = v_a2::text)::jsonb is distinct from jsonb_build_array(v_c[2])
     or (select json_typeof(a -> 'competencias') from json_array_elements(v -> 'avaliadores') a where a ->> 'id' = v_a1::text) <> 'null' then
    raise exception 'FALHOU E3: payload sem as competências dos membros: %', v -> 'avaliadores';
  end if;

  -- d) Lançar: a nota do Avaliador Teste 2 fora de "Trabalho em equipe" é recusada; o cálculo usa quem avalia.
  insert into public."TB_ENTREVISTA" ("CO_AREA", "CO_MONITORAMENTO", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO",
    "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO")
  values ('saude-indigena', v_treino, 'DSEI Treinamento', 'Treinamento', '9909910001', 'Candidato Ensaio Banca',
    'sistema', 'ensaio-por-competencia|rpc', v_roteiro, 'S')
  returning "CO_ENTREVISTA" into v_e;
  v_falhou := false;
  begin
    perform public.lancar_notas_entrevista(v_e, jsonb_build_object('notas', jsonb_build_array(jsonb_build_object(
      'competencia', v_c[1], 'avaliador', v_a2, 'aspectos', jsonb_build_array(
        jsonb_build_object('aspecto', v_asp[1], 'nota', 3), jsonb_build_object('aspecto', v_asp[2], 'nota', 3),
        jsonb_build_object('aspecto', v_asp[3], 'nota', 3))))));
  exception when sqlstate '23514' then v_falhou := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_falhou or v_msg not like 'Avaliador Teste 2 não avalia%' then raise exception 'FALHOU E3: lançou nota fora da competência (%)', v_msg; end if;
  select jsonb_agg(jsonb_build_object('competencia', c, 'avaliador', v_a1, 'aspectos', jsonb_build_array(
           jsonb_build_object('aspecto', v_asp[1], 'nota', 3), jsonb_build_object('aspecto', v_asp[2], 'nota', 3),
           jsonb_build_object('aspecto', v_asp[3], 'nota', 3))))
    into v_item from unnest(v_c) c;
  v_item := v_item || jsonb_build_array(jsonb_build_object('competencia', v_c[2], 'avaliador', v_a2, 'aspectos', jsonb_build_array(
           jsonb_build_object('aspecto', v_asp[1], 'nota', 4), jsonb_build_object('aspecto', v_asp[2], 'nota', 4),
           jsonb_build_object('aspecto', v_asp[3], 'nota', 5))));
  perform public.lancar_notas_entrevista(v_e, jsonb_build_object('compareceu', 'S', 'notas', v_item));
  -- Trabalho em equipe = média de 3 e 4,33 = 3,67; total 3 + 3,67 + 3 + 3 = 12,67; APTO (completa só com o atribuído).
  if (select n."VL_NOTA" from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = v_e and n."NU_ORDEM" = 2) <> 3.67
     or (select e."VL_NOTA_TOTAL" from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e) <> 12.67
     or (select e."TP_PARECER" from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e) <> 'APTO' then
    raise exception 'FALHOU E3: cálculo com avaliador por competência (%)',
      (select row_to_json(e) from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e);
  end if;

  -- e) Configurar: recusas e gravação.
  for v_item in select value from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('a1', 'null'::jsonb, 'a2', jsonb_build_array(v_c[2]),               -- banca 2 só com C1
                         'extra', jsonb_build_array(jsonb_build_object('nome', 'Avaliador Ensaio 3', 'origem', 'CONDISI', 'banca', 2,
                                                                       'competencias', jsonb_build_array(v_c[1])))),
      jsonb_build_object('a1', 'null'::jsonb, 'a2', '[]'::jsonb),                           -- lista vazia
      jsonb_build_object('a1', 'null'::jsonb, 'a2', jsonb_build_array(gen_random_uuid()))))  -- competência de fora
  loop
    v_falhou := false;
    begin
      perform public.configurar_entrevista_edital(v_treino, jsonb_build_object('roteiro', v_roteiro, 'lancamento', 'SECRETARIA',
        'avaliadores', jsonb_build_array(
          jsonb_build_object('id', v_a1, 'nome', 'Avaliador Teste 1', 'origem', 'AgSUS', 'banca', 1, 'competencias', v_item -> 'a1'),
          jsonb_build_object('id', v_a2, 'nome', 'Avaliador Teste 2', 'origem', 'DSEI', 'banca', 1, 'competencias', v_item -> 'a2'))
          || coalesce(v_item -> 'extra', '[]'::jsonb)));
    exception when sqlstate '22023' then v_falhou := true;
    end;
    if not v_falhou then raise exception 'FALHOU E3: configurar aceitou %', v_item; end if;
  end loop;
  v_falhou := false;
  begin
    perform public.configurar_entrevista_edital(v_treino, jsonb_build_object('roteiro', v_roteiro, 'lancamento', 'SECRETARIA',
      'avaliadores', jsonb_build_array(
        jsonb_build_object('id', v_a1, 'nome', 'Avaliador Teste 1', 'origem', 'AgSUS', 'banca', 1, 'competencias', null),
        jsonb_build_object('id', v_a2, 'nome', 'Avaliador Teste 2', 'origem', 'DSEI', 'banca', 1, 'competencias', jsonb_build_array(v_c[3])))));
  exception when sqlstate '23514' then v_falhou := true;
  end;
  if not v_falhou then raise exception 'FALHOU E3: tirou "Trabalho em equipe" de quem já deu nota nela'; end if;
  -- Todas marcadas = sem vínculo; sem a chave = fica como estava; de novo só "Trabalho em equipe".
  perform public.configurar_entrevista_edital(v_treino, jsonb_build_object('roteiro', v_roteiro, 'lancamento', 'SECRETARIA',
    'avaliadores', jsonb_build_array(
      jsonb_build_object('id', v_a1, 'nome', 'Avaliador Teste 1', 'origem', 'AgSUS', 'banca', 1, 'competencias', null),
      jsonb_build_object('id', v_a2, 'nome', 'Avaliador Teste 2', 'origem', 'DSEI', 'banca', 1, 'competencias', to_jsonb(v_c)))));
  if exists (select 1 from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l where l."CO_AVALIADOR" in (v_a1, v_a2)) then
    raise exception 'FALHOU E3: todas marcadas gravou vínculo';
  end if;
  perform public.configurar_entrevista_edital(v_treino, jsonb_build_object('roteiro', v_roteiro, 'lancamento', 'SECRETARIA',
    'avaliadores', jsonb_build_array(
      jsonb_build_object('id', v_a1, 'nome', 'Avaliador Teste 1', 'origem', 'AgSUS', 'banca', 1, 'competencias', null),
      jsonb_build_object('id', v_a2, 'nome', 'Avaliador Teste 2', 'origem', 'DSEI', 'banca', 1, 'competencias', jsonb_build_array(v_c[2])))));
  perform public.configurar_entrevista_edital(v_treino, jsonb_build_object('roteiro', v_roteiro, 'lancamento', 'SECRETARIA',
    'avaliadores', jsonb_build_array(
      jsonb_build_object('id', v_a1, 'nome', 'Avaliador Teste 1', 'origem', 'AgSUS', 'banca', 1),
      jsonb_build_object('id', v_a2, 'nome', 'Avaliador Teste 2', 'origem', 'DSEI', 'banca', 1))));
  if (select array_agg(l."CO_COMPETENCIA") from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l where l."CO_AVALIADOR" = v_a2) is distinct from array[v_c[2]] then
    raise exception 'FALHOU E3: sem a chave, o vínculo mudou';
  end if;

  -- f) Apagar continua livre (inclusive a nota de quem avalia).
  perform public.lancar_notas_entrevista(v_e, jsonb_build_object('notas', jsonb_build_array(jsonb_build_object(
    'competencia', v_c[2], 'avaliador', v_a2, 'aspectos', null))));
  if exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = v_e and x."CO_AVALIADOR" = v_a2) then
    raise exception 'FALHOU E3: apagar a nota do Avaliador Teste 2';
  end if;
  if (select n."VL_NOTA" from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = v_e and n."NU_ORDEM" = 2) <> 3 then
    raise exception 'FALHOU E3: recálculo depois de apagar';
  end if;
  insert into ensaio_resultado values ('E3', true, 'configurar recusa e grava; reinício traz o exemplo; payload; lançar recusa fora da competência; 3,67 / 12,67 APTO; apagar livre');
end;
$$;

-- E4. Casos dourados com atribuições (tests/fixtures/entrevistas/casos-de-calculo.json) no FC_CALCULAR_ENTREVISTA.
do $$
declare
  v_treino uuid := current_setting('ensaio.treino')::uuid;
  v_niveis uuid := gen_random_uuid();
  v_aspectos uuid := gen_random_uuid();
  v_casos jsonb := $casos$[{"nome":"avaliador com 1 competência: a2 só avalia c2; as outras ficam com a nota de a1","roteiro":"niveis","compareceu":"S","atribuicoes":{"a2":["c2"]},"notas":{"c1":[4],"c2":[3,5],"c3":[3],"c4":[2]},"esperado":{"notas":[4,4,3,2],"total":13,"parecer":"APTO"}},{"nome":"a nota de quem não avalia a competência não conta (sem a restrição, 0 e 1 eliminariam)","roteiro":"niveis","compareceu":"S","atribuicoes":{"a2":["c2"]},"notas":{"c1":[4,1],"c2":[3,5],"c3":[3,0],"c4":[2,0]},"esperado":{"notas":[4,4,3,2],"total":13,"parecer":"APTO"}},{"nome":"competências com 2 avaliadores (c2 com 1): média só de quem avalia; c4 1,5 abaixo do mínimo","roteiro":"niveis","compareceu":"S","atribuicoes":{"a1":["c1","c2","c3"],"a2":["c3","c4"],"a3":["c1","c4"]},"notas":{"c1":[2,null,4],"c2":[5],"c3":[3,4],"c4":[null,1,2]},"esperado":{"notas":[3,5,3.5,1.5],"total":13,"parecer":"INAPTO"}},{"nome":"aspectos: a2 só avalia c2 — c2 = média de 2 e 4,33 = 3,17; final 12,17","roteiro":"aspectos_si","compareceu":"S","atribuicoes":{"a2":["c2"]},"aspectos":{"c1":[[3,3,3]],"c2":[[2,2,2],[4,4,5]],"c3":[[3,3,3]],"c4":[[3,3,3]]},"esperado":{"notas":[3,3.17,3,3],"total":12.17,"parecer":"APTO"}}]$casos$::jsonb;
  v_caso jsonb;
  v_roteiro uuid;
  v_e uuid;
  v_av uuid[];
  v_notas jsonb;
  v_total numeric;
  v_parecer text;
  v_i integer := 0;
  c record;
  a record;
  k integer;
begin
  insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "CO_AREA", "NO_ROTEIRO", "TP_ESCALA", "VL_PASSO",
    "VL_NOTA_MINIMA_TOTAL", "DS_NOTAS_ELIMINATORIAS", "ST_ATIVO")
  values (v_niveis, v_niveis, 'saude-indigena', 'Ensaio — por competência', 'NIVEIS', 1, 8, '[0, 1]', 'N'),
         (v_aspectos, v_aspectos, 'saude-indigena', 'Ensaio — por competência, aspectos', 'NIVEIS', 1, 8, '[]', 'N');
  insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO")
  select r, g, 'C' || g, 5, 1, 2 from unnest(array[v_niveis, v_aspectos]) r, generate_series(1, 4) g;
  insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL")
  select r, g, 'Nível ' || g from unnest(array[v_niveis, v_aspectos]) r, generate_series(0, 5) g;
  insert into public."TB_ROTEIRO_ASPECTO" ("CO_ROTEIRO", "NU_ORDEM", "NO_ASPECTO")
  values (v_aspectos, 1, 'Conceitua'), (v_aspectos, 2, 'Propriedade'), (v_aspectos, 3, 'Profundidade');
  with novos as (
    insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA", "ST_ATIVO")
    select v_treino, 'Avaliador Ensaio ' || g, 'Ensaio', 9, 'N' from generate_series(1, 3) g
    returning "CO_AVALIADOR", "NO_AVALIADOR")
  select array_agg("CO_AVALIADOR" order by "NO_AVALIADOR") into v_av from novos;

  for v_caso in select value from jsonb_array_elements(v_casos) loop
    v_i := v_i + 1;
    v_roteiro := case when v_caso ? 'aspectos' then v_aspectos else v_niveis end;
    -- As atribuições do caso: a1, a2, a3 → os avaliadores do ensaio; cN → a competência de ordem N.
    delete from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" where "CO_AVALIADOR" = any (v_av);
    insert into public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" ("CO_AVALIADOR", "CO_COMPETENCIA")
    select v_av[substr(t.avaliador, 2)::integer], k2."CO_COMPETENCIA"
      from jsonb_each(v_caso -> 'atribuicoes') t(avaliador, lista)
      cross join jsonb_array_elements_text(t.lista) comp
      join public."TB_ROTEIRO_COMPETENCIA" k2 on k2."CO_ROTEIRO" = v_roteiro and 'c' || k2."NU_ORDEM" = comp;
    insert into public."TB_ENTREVISTA" ("CO_AREA", "CO_MONITORAMENTO", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO",
      "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_COMPARECEU", "ST_ATIVO")
    values ('saude-indigena', v_treino, 'Ensaio', 'Ensaio', '0', 'Candidato Ensaio ' || v_i,
      'sistema', 'ensaio-por-competencia|' || v_i, v_roteiro, v_caso ->> 'compareceu', 'N')
    returning "CO_ENTREVISTA" into v_e;
    for c in select k2."CO_COMPETENCIA", 'c' || k2."NU_ORDEM" chave from public."TB_ROTEIRO_COMPETENCIA" k2 where k2."CO_ROTEIRO" = v_roteiro loop
      k := 0;
      for a in select value from jsonb_array_elements(coalesce(v_caso #> array[case when v_caso ? 'aspectos' then 'aspectos' else 'notas' end, c.chave], '[]')) loop
        k := k + 1;
        continue when jsonb_typeof(a.value) = 'null'; -- sem nota deste avaliador
        if jsonb_typeof(a.value) = 'array' then
          insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA")
          select v_e, c."CO_COMPETENCIA", v_av[k], round(avg(n::numeric), 2) from jsonb_array_elements_text(a.value) n;
          insert into public."TB_ENTREVISTA_AVALIACAO_ASPECTO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "CO_ASPECTO", "VL_NOTA")
          select v_e, c."CO_COMPETENCIA", v_av[k], s."CO_ASPECTO", (a.value ->> (s."NU_ORDEM" - 1))::numeric
            from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_roteiro;
        else
          insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA")
          values (v_e, c."CO_COMPETENCIA", v_av[k], (a.value #>> '{}')::numeric);
        end if;
      end loop;
    end loop;
    perform private."FC_CALCULAR_ENTREVISTA"(v_e);
    select e."VL_NOTA_TOTAL", e."TP_PARECER" into v_total, v_parecer from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e;
    select jsonb_agg(to_jsonb(n."VL_NOTA") order by k3."NU_ORDEM") into v_notas
      from public."TB_ROTEIRO_COMPETENCIA" k3
      left join public."TB_ENTREVISTA_NOTA" n on n."CO_ENTREVISTA" = v_e and n."NU_ORDEM" = k3."NU_ORDEM"
     where k3."CO_ROTEIRO" = v_roteiro;
    if v_total is distinct from (v_caso #>> '{esperado,total}')::numeric
       or v_parecer is distinct from v_caso #>> '{esperado,parecer}'
       or (select array_agg(x::numeric order by o) from jsonb_array_elements_text(v_notas) with ordinality t(x, o))
          is distinct from (select array_agg(x::numeric order by o) from jsonb_array_elements_text(v_caso #> '{esperado,notas}') with ordinality t(x, o)) then
      raise exception 'FALHOU E4 (%): total %, parecer %, notas % — esperado %', v_caso ->> 'nome', v_total, v_parecer, v_notas, v_caso -> 'esperado';
    end if;
  end loop;
  insert into ensaio_resultado values ('E4', true, v_i || ' casos dourados com atribuições iguais ao JS e ao Python');
end;
$$;

select json_agg(json_build_object('passo', passo, 'ok', ok, 'detalhe', detalhe) order by passo) as ensaio from ensaio_resultado;

rollback;
