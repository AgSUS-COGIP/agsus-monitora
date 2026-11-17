/*
  ENSAIO de supabase/migrations/20261117050000_concluir_e_reabrir_a_entrevista.sql: o mesmo corpo; as 49 do 93/2026 concluídas;
  como administrador global: o lançamento recusa a concluída, reabrir pede motivo e abre, concluir
  fecha de novo; obter_entrevistas_do_edital traz pode_reabrir e concluida_em. Rollback.
*/

begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.lancar_notas_entrevista(uuid, jsonb)')), chr(13), ''))
       is distinct from 'd795762c5b3e3d59c85e8b256e0640fd' then
    raise exception 'lancar_notas_entrevista mudou desde 17/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.obter_entrevistas_do_edital(uuid)')), chr(13), ''))
       is distinct from 'fa6fb2f7f2c28ee1bcdb91795f79e1de' then
    raise exception 'obter_entrevistas_do_edital mudou desde 17/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
end
$guarda$;

alter table public."TB_ENTREVISTA"
  add column "DT_CONCLUSAO" timestamp with time zone,
  add column "CO_USUARIO_CONCLUSAO" uuid,
  add constraint "CK_ENTREVISTA_CONCLUSAO" check ("DT_CONCLUSAO" is not null or "CO_USUARIO_CONCLUSAO" is null);

comment on column public."TB_ENTREVISTA"."DT_CONCLUSAO" is
  'Quando a entrevista foi concluída (concluir_entrevista): com data, a ficha é só leitura até a coordenação reabrir (reabrir_entrevista). Nulo = aberta (20261117050000).';
comment on column public."TB_ENTREVISTA"."CO_USUARIO_CONCLUSAO" is
  'auth.uid de quem concluiu a entrevista (nulo se aberta).';
comment on constraint "CK_ENTREVISTA_CONCLUSAO" on public."TB_ENTREVISTA" is 'Quem concluiu só com a data da conclusão.';

-- Os motivos da reabertura (código → rótulo); a mesma lista em src/lib/reabertura-da-entrevista.ts.
create function private."FC_MOTIVO_REABERTURA_ENTREVISTA"(p_motivo text) returns text
  language sql immutable
  set search_path to ''
as $$
  select case p_motivo
    when 'NOTA' then 'Correção de nota'
    when 'COMPARECIMENTO' then 'Correção do comparecimento'
    when 'BANCA' then 'Correção da banca ou dos avaliadores'
    when 'JUSTIFICATIVA' then 'Correção da justificativa da banca'
    when 'RECURSO' then 'Recurso deferido'
    when 'OUTRO' then 'Outro'
  end;
$$;
comment on function private."FC_MOTIVO_REABERTURA_ENTREVISTA"(text) is
  'Rótulo do motivo de reabertura da entrevista (lista fixa; nulo = código inválido). Mesma lista em src/lib/reabertura-da-entrevista.ts (20261117050000).';
revoke all on function private."FC_MOTIVO_REABERTURA_ENTREVISTA"(text) from public;

create function public.concluir_entrevista(p_entrevista uuid) returns json
  language plpgsql security definer
  set search_path to ''
as $$
declare
  v_e public."TB_ENTREVISTA";
begin
  select * into v_e from public."TB_ENTREVISTA"
   where "CO_ENTREVISTA" = p_entrevista and "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S'
   for update;
  if v_e."CO_ENTREVISTA" is null then raise exception 'Convocado não encontrado' using errcode = '22023'; end if;
  perform private."FC_EXIGIR_ENTREVISTAS_EDITAL"(v_e."CO_MONITORAMENTO", 2);
  if v_e."DT_CONCLUSAO" is not null then
    raise exception 'Esta entrevista já está concluída.' using errcode = '55000';
  end if;
  if v_e."ST_COMPARECEU" is null then
    raise exception 'Informe o comparecimento antes de concluir.' using errcode = '23514';
  end if;
  if v_e."ST_COMPARECEU" = 'S' and v_e."TP_PARECER" = 'SEM_PARECER' then
    raise exception 'Lance todas as notas antes de concluir.' using errcode = '23514';
  end if;
  if (v_e."TP_PARECER" = 'INAPTO' or v_e."ST_COMPARECEU" = 'N') and v_e."DS_JUSTIFICATIVA_BANCA" is null then
    raise exception 'Escreva a justificativa da banca antes de concluir.' using errcode = '23514';
  end if;
  update public."TB_ENTREVISTA"
     set "DT_CONCLUSAO" = now(), "CO_USUARIO_CONCLUSAO" = (select auth.uid()), "DT_ATUALIZACAO" = now()
   where "CO_ENTREVISTA" = p_entrevista;
  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  values (p_entrevista, 'conclusao', 'aberta', 'concluída', (select auth.uid()));
  return public.obter_entrevistas_do_edital(v_e."CO_MONITORAMENTO");
end;
$$;
comment on function public.concluir_entrevista(uuid) is
  'Conclui a entrevista (só leitura até reabrir): entrevistas >= editor; exige o comparecimento, com presença todas as notas (parecer calculado) e, em Inapto ou falta, a justificativa da banca. Devolve obter_entrevistas_do_edital (20261117050000).';
revoke all on function public.concluir_entrevista(uuid) from public;
grant all on function public.concluir_entrevista(uuid) to authenticated;
grant all on function public.concluir_entrevista(uuid) to service_role;

create function public.reabrir_entrevista(p_entrevista uuid, p_motivo text, p_complemento text default null) returns json
  language plpgsql security definer
  set search_path to ''
as $$
declare
  v_e public."TB_ENTREVISTA";
  v_rotulo text := private."FC_MOTIVO_REABERTURA_ENTREVISTA"(p_motivo);
  v_complemento text := nullif(btrim(coalesce(p_complemento, '')), '');
begin
  select * into v_e from public."TB_ENTREVISTA"
   where "CO_ENTREVISTA" = p_entrevista and "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S'
   for update;
  if v_e."CO_ENTREVISTA" is null then raise exception 'Convocado não encontrado' using errcode = '22023'; end if;
  perform private."FC_EXIGIR_ENTREVISTAS_EDITAL"(v_e."CO_MONITORAMENTO", 2);
  if private."FC_PAPEL_AVALIACAO"(v_e."CO_MONITORAMENTO") is distinct from 'COORDENADOR' then
    raise exception 'Só a coordenação do edital reabre a entrevista concluída.' using errcode = '42501';
  end if;
  if v_e."DT_CONCLUSAO" is null then
    raise exception 'Esta entrevista não está concluída.' using errcode = '55000';
  end if;
  if v_rotulo is null then
    raise exception 'Escolha o motivo da reabertura na lista. Se a lista não aparece, recarregue a página.' using errcode = '22023';
  end if;
  if length(coalesce(v_complemento, '')) > 500 then
    raise exception 'Complemento com até 500 caracteres.' using errcode = '22023';
  end if;
  if p_motivo = 'OUTRO' and (length(coalesce(v_complemento, '')) < 15
       or coalesce(array_length(regexp_split_to_array(v_complemento, '\s+'), 1), 0) < 3) then
    raise exception 'Em "Outro", descreva o motivo com pelo menos 15 caracteres e 3 palavras.' using errcode = '22023';
  end if;
  update public."TB_ENTREVISTA"
     set "DT_CONCLUSAO" = null, "CO_USUARIO_CONCLUSAO" = null, "DT_ATUALIZACAO" = now()
   where "CO_ENTREVISTA" = p_entrevista;
  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  values (p_entrevista, 'reabertura',
          'concluída em ' || to_char(v_e."DT_CONCLUSAO" at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
          left(v_rotulo || coalesce(' — ' || v_complemento, ''), 2000),
          (select auth.uid()));
  return public.obter_entrevistas_do_edital(v_e."CO_MONITORAMENTO");
end;
$$;
comment on function public.reabrir_entrevista(uuid, text, text) is
  'Reabre a entrevista concluída: só a coordenação do edital (FC_PAPEL_AVALIACAO = COORDENADOR); motivo da lista (FC_MOTIVO_REABERTURA_ENTREVISTA), complemento opcional até 500 e, em OUTRO, a descrição (15 caracteres e 3 palavras). Histórico em TH_ENTREVISTA_AVALIACAO. Devolve obter_entrevistas_do_edital (20261117050000).';
revoke all on function public.reabrir_entrevista(uuid, text, text) from public;
grant all on function public.reabrir_entrevista(uuid, text, text) to authenticated;
grant all on function public.reabrir_entrevista(uuid, text, text) to service_role;

create or replace function public.lancar_notas_entrevista(p_entrevista uuid, p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
  -- Concluída (concluir_entrevista, 17/11/2026): só leitura até a coordenação reabrir.
  if v_e."DT_CONCLUSAO" is not null then
    raise exception 'Entrevista concluída: só leitura. Para mudar, a coordenação do edital reabre a ficha.'
      using errcode = '55000';
  end if;
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
$$;

create or replace function public.obter_entrevistas_do_edital(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
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
    -- Reabrir a entrevista concluída: a coordenação do edital (como na Avaliação documental).
    'pode_reabrir', private.pode_recurso('entrevistas', 2)
                    and coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'banca', v_cfg."DS_BANCA",
        'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO",
        'arredondamento', coalesce(v_cfg."TP_ARREDONDAMENTO", 'NOTA')) end,
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
               'concluida_em', e."DT_CONCLUSAO",
               'concluida_por', (select coalesce(nullif(btrim(u.nome), ''), u.email) from public."TB_PERFIL_USUARIO" u
                                  where e."CO_USUARIO_CONCLUSAO" is not null and u.user_id = e."CO_USUARIO_CONCLUSAO" limit 1),
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
$$;

-- O 93/2026: as entrevistas importadas e conferidas com as planilhas da banca ficam concluídas,
-- em nome de quem importou (o usuário da linha "convocacao" do histórico da importação).
do $edital93$
declare
  v_n integer;
begin
  with alvo as (
    select e."CO_ENTREVISTA",
           (select h."CO_USUARIO" from public."TH_ENTREVISTA_AVALIACAO" h
             where h."CO_ENTREVISTA" = e."CO_ENTREVISTA" and h."DS_CAMPO" = 'convocacao'
             order by h."DT_ALTERACAO" limit 1) usuario
      from public."TB_ENTREVISTA" e
     where e."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded' and e."TP_ORIGEM" = 'sistema'
       and e."ST_ATIVO" = 'S' and e."DT_CONCLUSAO" is null and e."ST_COMPARECEU" is not null
       and (e."ST_COMPARECEU" = 'N' or e."TP_PARECER" <> 'SEM_PARECER')
  ), feitas as (
    update public."TB_ENTREVISTA" e set "DT_CONCLUSAO" = now(), "CO_USUARIO_CONCLUSAO" = a.usuario
      from alvo a where e."CO_ENTREVISTA" = a."CO_ENTREVISTA"
    returning e."CO_ENTREVISTA", a.usuario
  )
  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  select f."CO_ENTREVISTA", 'conclusao', 'aberta', 'concluída: importada da planilha da banca e conferida em 17/11/2026', f.usuario
    from feitas f;
  get diagnostics v_n = row_count;
  raise notice '93/2026: % entrevista(s) concluída(s)', v_n;
end
$edital93$;


-- As 49 do 93/2026 concluídas; depois, como administrador global, o ciclo numa delas.
do $ensaio$
declare
  v_edital constant uuid := 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded';
  v_admin uuid;
  v_email text;
  v_e uuid;
  v_n integer;
  v_abertas integer;
  v json;
  v_conv json;
begin
  select count(*) filter (where "DT_CONCLUSAO" is not null), count(*) filter (where "DT_CONCLUSAO" is null)
    into v_n, v_abertas
    from public."TB_ENTREVISTA"
   where "CO_MONITORAMENTO" = v_edital and "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S';
  if v_n <> 49 or v_abertas <> 0 then
    raise exception 'ENSAIO: 93/2026 com % concluída(s) e % aberta(s) (esperado 49 e 0)', v_n, v_abertas;
  end if;
  if exists (select 1 from public."TB_ENTREVISTA" where "CO_MONITORAMENTO" <> v_edital and "DT_CONCLUSAO" is not null) then
    raise exception 'ENSAIO: entrevista de outro edital ficou concluída';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA" where "CO_MONITORAMENTO" = v_edital and "DT_CONCLUSAO" is not null
                and "CO_USUARIO_CONCLUSAO" is null) then
    raise exception 'ENSAIO: conclusão do 93/2026 sem quem importou';
  end if;

  -- Como um administrador global.
  select p.user_id, lower(p.email) into v_admin, v_email
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
   order by p.updated_at desc nulls last
   limit 1;
  if v_admin is null then raise exception 'ENSAIO: sem administrador global ativo.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'email', v_email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  select "CO_ENTREVISTA" into v_e from public."TB_ENTREVISTA"
   where "CO_MONITORAMENTO" = v_edital and "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S' and "ST_COMPARECEU" = 'S'
   order by "CO_ENTREVISTA" limit 1;

  v := public.obter_entrevistas_do_edital(v_edital);
  if (v ->> 'pode_reabrir')::boolean is not true then raise exception 'ENSAIO: o administrador não pode reabrir'; end if;
  select x into v_conv from json_array_elements(v -> 'convocados') x where x ->> 'id' = v_e::text;
  if v_conv ->> 'concluida_em' is null or v_conv ->> 'concluida_por' is null then
    raise exception 'ENSAIO: o convocado não traz concluida_em/concluida_por: %', left(v_conv::text, 200);
  end if;

  -- Lançar na concluída: recusado.
  begin
    perform public.lancar_notas_entrevista(v_e, '{"banca": 1}'::jsonb);
    raise exception 'ENSAIO: o lançamento aceitou a entrevista concluída';
  exception when sqlstate '55000' then null;
  end;

  -- Reabrir sem motivo válido: recusado; "Outro" curto: recusado.
  begin
    perform public.reabrir_entrevista(v_e, 'XYZ', null);
    raise exception 'ENSAIO: reabriu com motivo inválido';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.reabrir_entrevista(v_e, 'OUTRO', 'curto');
    raise exception 'ENSAIO: reabriu com Outro curto';
  exception when sqlstate '22023' then null;
  end;

  -- Reabrir com motivo: aberta, com histórico; concluir de novo: fechada.
  perform public.reabrir_entrevista(v_e, 'NOTA', 'ensaio');
  if (select "DT_CONCLUSAO" from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = v_e) is not null then
    raise exception 'ENSAIO: não reabriu';
  end if;
  if not exists (select 1 from public."TH_ENTREVISTA_AVALIACAO" where "CO_ENTREVISTA" = v_e and "DS_CAMPO" = 'reabertura'
                    and "DS_VALOR_NOVO" = 'Correção de nota — ensaio') then
    raise exception 'ENSAIO: a reabertura não foi para o histórico';
  end if;
  begin
    perform public.reabrir_entrevista(v_e, 'NOTA', null);
    raise exception 'ENSAIO: reabriu a que já estava aberta';
  exception when sqlstate '55000' then null;
  end;
  perform public.concluir_entrevista(v_e);
  if (select "CO_USUARIO_CONCLUSAO" from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = v_e) is distinct from v_admin then
    raise exception 'ENSAIO: concluir não gravou quem concluiu';
  end if;
  begin
    perform public.concluir_entrevista(v_e);
    raise exception 'ENSAIO: concluiu duas vezes';
  exception when sqlstate '55000' then null;
  end;
  raise notice 'ENSAIO OK: 93/2026 com 49 concluídas; lançar recusa a concluída; reabrir e concluir funcionam.';
end
$ensaio$;

rollback;
