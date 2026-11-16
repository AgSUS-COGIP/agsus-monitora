/*
  ENSAIO de 20261116160000_relatorios_dos_paineis_prontos.sql

  Roda no banco ANTES de aplicar e termina em rollback: nada fica gravado. Aplica tudo (inclusive
  o primeiro cálculo) e confere: as tabelas sem grant para a API, um cálculo para cada área e
  relatório, o total de linhas por relatório e as RPCs com grant só para authenticated.
  Ok = NOTICE "Ensaio 20261116160000 ok", e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('private."FC_APLICAR_FONTES_DO_PAINEL"(text, text, jsonb)') is null then
    raise exception 'Aplique antes 20261113220000_fontes_das_colunas_dos_paineis.sql.';
  end if;
  if to_regclass('public."TB_LINHA_RELATORIO_PAINEL"') is not null then
    raise exception 'TB_LINHA_RELATORIO_PAINEL já existe: esta migration já foi aplicada?';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_resumo_dos_editais_do_painel(text)')), chr(13), '')) is distinct from '5f928f348d67b44a6398f39e2ca714bf' then
    raise exception 'listar_resumo_dos_editais_do_painel: o corpo no banco não é o de 20261113240000 (md5).';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_editais_por_cargo_do_painel(text)')), chr(13), '')) is distinct from '250f996c912123957c45d9872f1770c2' then
    raise exception 'listar_editais_por_cargo_do_painel: o corpo no banco não é o de 20261113240000 (md5).';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_aprovados_do_painel(text)')), chr(13), '')) is distinct from 'b663081fe5f6bb2fbaefeb4e957d12d0' then
    raise exception 'listar_aprovados_do_painel: o corpo no banco não é o de 20261113240000 (md5).';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.salvar_fonte_da_coluna(text, text, text, text, text, text)')), chr(13), '')) is distinct from '8614325e1feec5bc60db6ef9d5769f5b' then
    raise exception 'salvar_fonte_da_coluna: o corpo no banco não é o de 20261113220000 (md5).';
  end if;
end;
$$;

-- 1. O resultado pronto --------------------------------------------------------------------------
create table public."TB_CALCULO_RELATORIO_PAINEL" (
  "CO_AREA" text not null,
  "CO_RELATORIO" varchar(40) not null,
  "DT_CALCULO" timestamptz not null default now(),
  "QT_LINHA" integer not null,
  "DS_FONTES" jsonb not null default '{}'::jsonb,
  "DS_AVISOS" jsonb not null default '[]'::jsonb,
  "CO_USUARIO_CALCULO" uuid,
  constraint "PK_TB_CALCULO_RELATORIO_PAINEL" primary key ("CO_AREA", "CO_RELATORIO"),
  constraint "FK_CALCRELPAINEL_AREA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_CALCRELPAINEL_RELATORIO"
    check ("CO_RELATORIO" in ('resumo-dos-editais', 'editais-por-cargo', 'aprovados'))
);
comment on table public."TB_CALCULO_RELATORIO_PAINEL" is
  'Painéis: o último cálculo de cada relatório por área (as linhas ficam em TB_LINHA_RELATORIO_PAINEL). Recalculado de hora em hora (cron agsus_paineis_recalcular_relatorios), pelo Sincronizar (no máximo 1 vez por minuto) e na troca de fonte. 20261116160000.';
comment on column public."TB_CALCULO_RELATORIO_PAINEL"."CO_AREA" is 'Área do relatório';
comment on column public."TB_CALCULO_RELATORIO_PAINEL"."CO_RELATORIO" is 'Relatório (resumo-dos-editais, editais-por-cargo, aprovados)';
comment on column public."TB_CALCULO_RELATORIO_PAINEL"."DT_CALCULO" is 'Quando o cálculo foi feito (a data que a tela mostra)';
comment on column public."TB_CALCULO_RELATORIO_PAINEL"."QT_LINHA" is 'Quantas linhas o cálculo gerou (área inteira, sem recorte)';
comment on column public."TB_CALCULO_RELATORIO_PAINEL"."DS_FONTES" is 'A fonte de cada coluna editável no cálculo (jsonb, como FC_APLICAR_FONTES_DO_PAINEL devolve)';
comment on column public."TB_CALCULO_RELATORIO_PAINEL"."DS_AVISOS" is 'Avisos das fontes no cálculo (jsonb, lista de textos; citam só coluna e quantidades)';
comment on column public."TB_CALCULO_RELATORIO_PAINEL"."CO_USUARIO_CALCULO" is 'Quem pediu o cálculo (auth.users); nulo quando foi o cron';
alter table public."TB_CALCULO_RELATORIO_PAINEL" enable row level security;
revoke all on table public."TB_CALCULO_RELATORIO_PAINEL" from public, anon, authenticated;

create table public."TB_LINHA_RELATORIO_PAINEL" (
  "CO_AREA" text not null,
  "CO_RELATORIO" varchar(40) not null,
  "NU_POSICAO" integer not null,
  "CO_MONITORAMENTO" uuid not null,
  "DS_LINHA" jsonb not null,
  constraint "PK_TB_LINHA_RELATORIO_PAINEL" primary key ("CO_AREA", "CO_RELATORIO", "NU_POSICAO"),
  constraint "FK_LINHARELPAINEL_CALCULO" foreign key ("CO_AREA", "CO_RELATORIO")
    references public."TB_CALCULO_RELATORIO_PAINEL" ("CO_AREA", "CO_RELATORIO") on delete cascade
);
create index "IN_LINHARELPAINEL_EDITAL"
  on public."TB_LINHA_RELATORIO_PAINEL" ("CO_AREA", "CO_RELATORIO", "CO_MONITORAMENTO", "NU_POSICAO");
comment on table public."TB_LINHA_RELATORIO_PAINEL" is
  'Painéis: as linhas prontas de cada relatório por área, na ordem do relatório. Contém dado pessoal (nome e matrícula, no relatório Aprovados): só as RPCs dos Painéis leem, com o recorte de quem pede. 20261116160000.';
comment on column public."TB_LINHA_RELATORIO_PAINEL"."CO_AREA" is 'Área do relatório';
comment on column public."TB_LINHA_RELATORIO_PAINEL"."CO_RELATORIO" is 'Relatório';
comment on column public."TB_LINHA_RELATORIO_PAINEL"."NU_POSICAO" is 'Posição da linha no relatório (1, 2, …)';
comment on column public."TB_LINHA_RELATORIO_PAINEL"."CO_MONITORAMENTO" is 'Edital da linha (TB_MONITORAMENTO_INDIGENA.id), para o recorte da coordenação';
comment on column public."TB_LINHA_RELATORIO_PAINEL"."DS_LINHA" is 'A linha do relatório (jsonb), já com as fontes escolhidas';
alter table public."TB_LINHA_RELATORIO_PAINEL" enable row level security;
revoke all on table public."TB_LINHA_RELATORIO_PAINEL" from public, anon, authenticated;

-- 2. O cálculo (o SQL de 20261113240000, sem a guarda de sessão e sem o recorte) -----------------
create function private."FC_LINHAS_RESUMO_DO_PAINEL"(p_area text)
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  v_editais uuid[];
  v_resultado json;
  v_aplicado jsonb;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- Sem o recorte do usuário: o cálculo vale para a área inteira; o recorte é aplicado na leitura.
  v_editais := null;

  v_resultado := (
    with e as (
      select m.id, m.edital, m.unidade, m.vagas_total, m.data_inicio, m.data_fim,
             private."FC_ESTADO_DO_CRONOGRAMA"(m.id, v_hoje) as estado
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m."CO_AREA" = p_area and m.ativo
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
         and (v_editais is null or m.id = any (v_editais))
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'linhas', coalesce((
        select json_agg(json_build_object(
                 'edital_id', e.id,
                 'edital', e.edital,
                 'unidade', e.unidade,
                 'vagas_imediatas', e.vagas_total,
                 'data_divulgacao', coalesce((e.estado ->> 'data_inicio')::date, e.data_inicio),
                 'data_final', coalesce((e.estado ->> 'data_fim')::date, e.data_fim)
               ) order by e.unidade, e.edital)
          from e
      ), '[]'::json)
    )
  );

  -- A fonte escolhida na área para cada coluna editável (20261113220000).
  v_aplicado := private."FC_APLICAR_FONTES_DO_PAINEL"(p_area, 'resumo-dos-editais', (v_resultado::jsonb) -> 'linhas');
  return v_aplicado;
end;
$function$;
comment on function private."FC_LINHAS_RESUMO_DO_PAINEL"(text) is
  'Painéis › Resumo dos editais: as linhas da área inteira (sem o recorte do usuário), já com as fontes escolhidas — {linhas, fontes, avisos}. O mesmo SQL de public.listar_resumo_dos_editais_do_painel em 20261113240000. Chamada só por FC_LINHAS_DO_RELATORIO_PAINEL.';
revoke all on function private."FC_LINHAS_RESUMO_DO_PAINEL"(text) from public, anon, authenticated;

create function private."FC_LINHAS_POR_CARGO_DO_PAINEL"(p_area text)
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  v_editais uuid[];
  v_resultado json;
  v_aplicado jsonb;
begin
  -- Sem o recorte do usuário: o cálculo vale para a área inteira; o recorte é aplicado na leitura.
  v_editais := null;

  v_resultado := (
    with ed as (
      select m.id, m.edital, m.unidade, m.inscritos
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m."CO_AREA" = p_area and m.ativo
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
         and (v_editais is null or m.id = any (v_editais))
    ),
    -- As vagas da Seleção (aba Resultado da Auditoria).
    sel as (
      select s."CO_SELECAO_VAGA" as id, s."CO_MONITORAMENTO" as edital_id,
             s."CO_VAGA" as vaga, s."NO_CARGO" as cargo, s."NO_UNIDADE" as unidade,
             s."QT_INSCRITO" as inscritos,
             -- A 2ª vaga de mesmo código (chave com #2…) não recebe de novo os mesmos aprovados.
             s."DS_CHAVE_ORIGEM" !~ '#[0-9]+$' as recebe_aprovados,
             btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(s."DS_VAGA_PLANILHA"), '[^a-z0-9]+', ' ', 'g')) as vaga_nome
        from public."TB_SELECAO_VAGA" s
        join ed on ed.id = s."CO_MONITORAMENTO"
       where s."ST_REGISTRO_ATIVO" = 'S'
    ),
    listas as (
      select l.id, ed.id as edital_id
        from ed
        join public."TB_LISTA_APROVADO" l on l.edital_id = ed.id::text and l.vigente is true and l.ativo
    ),
    -- Os aprovados de cada vaga da lista (o "id da vaga" da planilha importada).
    ap as (
      select l.edital_id, c.codigo_vaga, min(c.cargo) as cargo, count(*)::integer as total,
             regexp_replace(coalesce(c.codigo_vaga, ''), '[^0-9]', '', 'g') as vaga_num,
             btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(c.codigo_vaga), '[^a-z0-9]+', ' ', 'g')) as vaga_nome
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by l.edital_id, c.codigo_vaga
    ),
    -- Cada vaga da lista casada com a da Seleção (as regras de get_selecao_da_area).
    par as (
      select s.id as sel_id, a.edital_id, a.codigo_vaga, a.cargo, a.total
        from sel s
        join ap a on a.edital_id = s.edital_id
       where s.recebe_aprovados
         and ((s.vaga is not null and a.vaga_num = s.vaga)
           or (s.vaga is null and a.vaga_nome <> '' and a.vaga_nome = s.vaga_nome))
    ),
    linhas as (
      select s.edital_id, ed.edital, ed.unidade as unidade_do_edital,
             coalesce(nullif(btrim(s.unidade), ''), ed.unidade) as unidade,
             s.vaga as codigo_vaga,
             case when s.cargo ~ '^[0-9]+$' then coalesce(
                    (select min(p.cargo) from par p where p.sel_id = s.id),
                    (select min(e."NO_CARGO") from public."TB_ENTREVISTA" e
                      where e."CO_AREA" = p_area and e."CO_VAGA" = s.vaga),
                    s.cargo)
                  else s.cargo end as cargo,
             s.inscritos,
             case when exists (select 1 from listas l where l.edital_id = s.edital_id)
                  then coalesce((select sum(p.total) from par p where p.sel_id = s.id), 0)::integer
             end as aprovados
        from sel s
        join ed on ed.id = s.edital_id
      union all
      -- Vaga da lista que a Seleção não tem: os aprovados não somem do relatório.
      select ed.id, ed.edital, ed.unidade, ed.unidade, a.codigo_vaga, a.cargo, null::integer, a.total
        from ap a
        join ed on ed.id = a.edital_id
       where not exists (select 1 from par p
                          where p.edital_id = a.edital_id and p.codigo_vaga is not distinct from a.codigo_vaga)
      union all
      -- Edital sem vaga na Seleção: uma linha com os inscritos do próprio edital (outra fonte do
      -- funil, como a Avaliação documental), para todo edital do Resumo aparecer aqui.
      select ed.id, ed.edital, ed.unidade, ed.unidade, null, null, ed.inscritos, null::integer
        from ed
       where not exists (select 1 from sel s where s.edital_id = ed.id)
    ),
    -- Vagas imediatas pelo título da vaga: "2 vagas (1 AC + …)" = 2; "Cadastro Reserva" = 0.
    final as (
      select l.*,
             (regexp_match(private."FC_TEXTO_BUSCA_RECURSO"(l.cargo), '\y(\d{1,4})\s*vagas?\y'))[1]::integer as vagas_no_titulo,
             private."FC_TEXTO_BUSCA_RECURSO"(l.cargo) ~ 'cadastro\s*(de\s*)?reserva' as so_cadastro_reserva
        from linhas l
    )
    select json_build_object(
      'schema_version', 2,
      'area', p_area,
      'gerado_em', now(),
      'linhas', coalesce((
        select json_agg(json_build_object(
                 'edital_id', f.edital_id,
                 'edital', f.edital,
                 'unidade', f.unidade,
                 'codigo_vaga', f.codigo_vaga,
                 'cargo', f.cargo,
                 'vagas_imediatas', coalesce(f.vagas_no_titulo, case when f.so_cadastro_reserva then 0 end),
                 'inscritos', f.inscritos,
                 'aprovados', f.aprovados
               ) order by f.unidade_do_edital, f.edital, f.unidade, f.codigo_vaga nulls last, f.cargo)
          from final f
      ), '[]'::json)
    )
  );

  -- A fonte escolhida na área para cada coluna editável (20261113220000).
  v_aplicado := private."FC_APLICAR_FONTES_DO_PAINEL"(p_area, 'editais-por-cargo', (v_resultado::jsonb) -> 'linhas');
  return v_aplicado;
end;
$function$;
comment on function private."FC_LINHAS_POR_CARGO_DO_PAINEL"(text) is
  'Painéis › Editais por cargo: as linhas da área inteira (sem o recorte do usuário), já com as fontes escolhidas — {linhas, fontes, avisos}. O mesmo SQL de public.listar_editais_por_cargo_do_painel em 20261113240000. Chamada só por FC_LINHAS_DO_RELATORIO_PAINEL.';
revoke all on function private."FC_LINHAS_POR_CARGO_DO_PAINEL"(text) from public, anon, authenticated;

create function private."FC_LINHAS_APROVADOS_DO_PAINEL"(p_area text)
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  v_editais uuid[];
  v_resultado json;
  v_aplicado jsonb;
begin
  -- Sem o recorte do usuário: o cálculo vale para a área inteira; o recorte é aplicado na leitura.
  v_editais := null;

  v_resultado := (
    with ed as (
      select m.id, m.edital, m.unidade
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m."CO_AREA" = p_area and m.ativo
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
         and (v_editais is null or m.id = any (v_editais))
    ),
    linhas as (
      select ed.id as edital_id, ed.edital, ed.unidade, c.id as candidato_id,
             c.cargo, c.codigo_vaga, c.nota, c.classificacao, c.nome, c.status, c.matricula,
             case when c.status in ('Contratado', 'Migração') then (
               select (max(h.alterado_em) at time zone 'America/Sao_Paulo')::date
                 from public."TH_CANDIDATO_APROVADO" h
                where h.candidato_id = c.id and h.status_novo = c.status
             ) end as data_contratacao
        from ed
        join public."TB_LISTA_APROVADO" l on l.edital_id = ed.id::text and l.vigente is true and l.ativo
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'linhas', coalesce((
        select json_agg(json_build_object(
                 'edital_id', l.edital_id,
                 'candidato_id', l.candidato_id,
                 'edital', l.edital,
                 'unidade', l.unidade,
                 'cargo', l.cargo,
                 'codigo_vaga', l.codigo_vaga,
                 'nota', l.nota,
                 'classificacao', l.classificacao,
                 'nome', l.nome,
                 'status', l.status,
                 'matricula', l.matricula,
                 'data_contratacao', l.data_contratacao
               ) order by l.unidade, l.edital, l.cargo, l.classificacao nulls last, l.nome)
          from linhas l
      ), '[]'::json)
    )
  );

  -- A fonte escolhida na área para cada coluna editável (20261113220000).
  v_aplicado := private."FC_APLICAR_FONTES_DO_PAINEL"(p_area, 'aprovados', (v_resultado::jsonb) -> 'linhas');
  return v_aplicado;
end;
$function$;
comment on function private."FC_LINHAS_APROVADOS_DO_PAINEL"(text) is
  'Painéis › Aprovados: as linhas da área inteira (sem o recorte do usuário), já com as fontes escolhidas — {linhas, fontes, avisos}. O mesmo SQL de public.listar_aprovados_do_painel em 20261113240000. Chamada só por FC_LINHAS_DO_RELATORIO_PAINEL.';
revoke all on function private."FC_LINHAS_APROVADOS_DO_PAINEL"(text) from public, anon, authenticated;

create function private."FC_LINHAS_DO_RELATORIO_PAINEL"(p_area text, p_relatorio text)
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
as $function$
begin
  case p_relatorio
    when 'resumo-dos-editais' then return private."FC_LINHAS_RESUMO_DO_PAINEL"(p_area);
    when 'editais-por-cargo' then return private."FC_LINHAS_POR_CARGO_DO_PAINEL"(p_area);
    when 'aprovados' then return private."FC_LINHAS_APROVADOS_DO_PAINEL"(p_area);
    else raise exception 'Relatório desconhecido' using errcode = '22023';
  end case;
end;
$function$;
comment on function private."FC_LINHAS_DO_RELATORIO_PAINEL"(text, text) is
  'Painéis: as linhas de um relatório da área inteira, com as fontes — {linhas, fontes, avisos}. Sem guarda de sessão: só FC_CALCULAR_RELATORIO_PAINEL chama.';
revoke all on function private."FC_LINHAS_DO_RELATORIO_PAINEL"(text, text) from public, anon, authenticated;

create function private."FC_CALCULAR_RELATORIO_PAINEL"(
  p_area text, p_relatorio text, p_usuario uuid, p_intervalo interval default null)
 returns boolean
 language plpgsql
 volatile
 set search_path to ''
as $function$
declare
  v jsonb;
  v_ultimo timestamptz;
begin
  -- Um cálculo por vez para a mesma área e relatório: quem chega depois espera e, com intervalo,
  -- recebe o que acabou de ser calculado.
  perform pg_advisory_xact_lock(hashtext('painel:' || p_area || ':' || p_relatorio));
  if p_intervalo is not null then
    select k."DT_CALCULO" into v_ultimo from public."TB_CALCULO_RELATORIO_PAINEL" k
     where k."CO_AREA" = p_area and k."CO_RELATORIO" = p_relatorio;
    if v_ultimo is not null and v_ultimo > now() - p_intervalo then
      return false;
    end if;
  end if;

  v := private."FC_LINHAS_DO_RELATORIO_PAINEL"(p_area, p_relatorio);
  insert into public."TB_CALCULO_RELATORIO_PAINEL"
    ("CO_AREA", "CO_RELATORIO", "DT_CALCULO", "QT_LINHA", "DS_FONTES", "DS_AVISOS", "CO_USUARIO_CALCULO")
  values (p_area, p_relatorio, now(), jsonb_array_length(coalesce(v -> 'linhas', '[]'::jsonb)),
          coalesce(v -> 'fontes', '{}'::jsonb), coalesce(v -> 'avisos', '[]'::jsonb), p_usuario)
  on conflict ("CO_AREA", "CO_RELATORIO") do update
    set "DT_CALCULO" = excluded."DT_CALCULO", "QT_LINHA" = excluded."QT_LINHA",
        "DS_FONTES" = excluded."DS_FONTES", "DS_AVISOS" = excluded."DS_AVISOS",
        "CO_USUARIO_CALCULO" = excluded."CO_USUARIO_CALCULO";
  delete from public."TB_LINHA_RELATORIO_PAINEL" l
   where l."CO_AREA" = p_area and l."CO_RELATORIO" = p_relatorio;
  insert into public."TB_LINHA_RELATORIO_PAINEL"
    ("CO_AREA", "CO_RELATORIO", "NU_POSICAO", "CO_MONITORAMENTO", "DS_LINHA")
  select p_area, p_relatorio, x.n::integer, (x.linha ->> 'edital_id')::uuid, x.linha
    from jsonb_array_elements(coalesce(v -> 'linhas', '[]'::jsonb)) with ordinality as x (linha, n);
  return true;
end;
$function$;
comment on function private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval) is
  'Painéis: recalcula um relatório da área e troca as linhas prontas, sob lock por área e relatório. Com p_intervalo, não recalcula se o último cálculo for mais recente (devolve false).';
revoke all on function private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval) from public, anon, authenticated;

create function private."FC_CALCULAR_PAINEIS"()
 returns integer
 language plpgsql
 volatile
 set search_path to ''
as $function$
declare
  a record;
  r text;
  v_feitos integer := 0;
begin
  for a in select t."CO_AREA" from public."TB_AREA" t order by t."CO_AREA" loop
    foreach r in array array['resumo-dos-editais', 'editais-por-cargo', 'aprovados'] loop
      begin
        perform private."FC_CALCULAR_RELATORIO_PAINEL"(a."CO_AREA", r, null, null);
        v_feitos := v_feitos + 1;
      exception when others then
        raise warning 'Painéis: o cálculo de % / % falhou: %', a."CO_AREA", r, sqlerrm;
      end;
    end loop;
  end loop;
  return v_feitos;
end;
$function$;
comment on function private."FC_CALCULAR_PAINEIS"() is
  'Painéis: recalcula os três relatórios de todas as áreas; um que falha não impede os outros (aviso no log). Devolve quantos calculou. Tarefa agsus_paineis_recalcular_relatorios, de hora em hora.';
revoke all on function private."FC_CALCULAR_PAINEIS"() from public, anon, authenticated;

-- 3. As RPCs -------------------------------------------------------------------------------------
create function public.ler_relatorio_do_painel(p_area text, p_relatorio text, p_pagina integer, p_por_pagina integer)
 returns json
 language plpgsql
 volatile
 security definer
 set search_path to ''
as $function$
declare
  c public."TB_CALCULO_RELATORIO_PAINEL";
  v_editais uuid[];
  v_total integer;
  v_pagina integer := 1;
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  if p_relatorio is null or p_relatorio not in ('resumo-dos-editais', 'editais-por-cargo', 'aprovados') then
    raise exception 'Relatório desconhecido' using errcode = '22023';
  end if;
  if p_por_pagina is not null and p_por_pagina not in (25, 50, 100) then
    raise exception 'Linhas por página: 25, 50 ou 100.' using errcode = '22023';
  end if;

  select * into c from public."TB_CALCULO_RELATORIO_PAINEL" k
   where k."CO_AREA" = p_area and k."CO_RELATORIO" = p_relatorio;
  if not found then
    perform private."FC_CALCULAR_RELATORIO_PAINEL"(p_area, p_relatorio, (select auth.uid()), null);
    select * into c from public."TB_CALCULO_RELATORIO_PAINEL" k
     where k."CO_AREA" = p_area and k."CO_RELATORIO" = p_relatorio;
  end if;

  -- O recorte da coordenação vale aqui: o cálculo guardado é da área inteira.
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];
  select count(*)::integer into v_total
    from public."TB_LINHA_RELATORIO_PAINEL" l
   where l."CO_AREA" = p_area and l."CO_RELATORIO" = p_relatorio
     and (v_editais is null or l."CO_MONITORAMENTO" = any (v_editais));
  if p_por_pagina is not null then
    v_pagina := least(greatest(1, ceil(v_total::numeric / p_por_pagina)::integer),
                      greatest(1, coalesce(p_pagina, 1)));
  end if;

  return json_build_object(
    'schema_version', 4,
    'area', p_area,
    'relatorio', p_relatorio,
    'calculado_em', c."DT_CALCULO",
    'total', v_total,
    'pagina', v_pagina,
    'por_pagina', p_por_pagina,
    'linhas', coalesce((
      select json_agg(x."DS_LINHA" order by x."NU_POSICAO")
        from (select l."DS_LINHA", l."NU_POSICAO"
                from public."TB_LINHA_RELATORIO_PAINEL" l
               where l."CO_AREA" = p_area and l."CO_RELATORIO" = p_relatorio
                 and (v_editais is null or l."CO_MONITORAMENTO" = any (v_editais))
               order by l."NU_POSICAO"
              offset (v_pagina - 1) * coalesce(p_por_pagina, 0)
               limit p_por_pagina) x), '[]'::json),
    'fontes', c."DS_FONTES",
    'avisos', c."DS_AVISOS");
end;
$function$;
comment on function public.ler_relatorio_do_painel(text, text, integer, integer) is
  'Painéis (json, schema 4): uma página de um relatório da área, do resultado pronto, com o recorte da coordenação — linhas, total, página, data do cálculo, fontes e avisos. p_por_pagina 25, 50 ou 100; nulo = todas as linhas (download). Sem cálculo ainda, calcula. Recurso paineis_dados ≥ Leitor e acesso à área.';
revoke all on function public.ler_relatorio_do_painel(text, text, integer, integer) from public, anon;
grant execute on function public.ler_relatorio_do_painel(text, text, integer, integer) to authenticated;

create function public.sincronizar_relatorio_do_painel(p_area text, p_relatorio text)
 returns json
 language plpgsql
 volatile
 security definer
 set search_path to ''
as $function$
declare
  v_recalculado boolean;
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  if p_relatorio is null or p_relatorio not in ('resumo-dos-editais', 'editais-por-cargo', 'aprovados') then
    raise exception 'Relatório desconhecido' using errcode = '22023';
  end if;
  v_recalculado := private."FC_CALCULAR_RELATORIO_PAINEL"(p_area, p_relatorio, (select auth.uid()), interval '1 minute');
  return json_build_object(
    'calculado_em', (select k."DT_CALCULO" from public."TB_CALCULO_RELATORIO_PAINEL" k
                      where k."CO_AREA" = p_area and k."CO_RELATORIO" = p_relatorio),
    'recalculado', v_recalculado);
end;
$function$;
comment on function public.sincronizar_relatorio_do_painel(text, text) is
  'Painéis › Sincronizar (json): recalcula o relatório da área, no máximo uma vez por minuto (dentro do minuto, devolve o que está pronto). Devolve {calculado_em, recalculado}. Recurso paineis_dados ≥ Leitor e acesso à área.';
revoke all on function public.sincronizar_relatorio_do_painel(text, text) from public, anon;
grant execute on function public.sincronizar_relatorio_do_painel(text, text) to authenticated;

create or replace function public.salvar_fonte_da_coluna(
  p_area text, p_relatorio text, p_coluna text, p_visao text, p_coluna_visao text, p_motivo text)
 returns jsonb
 language plpgsql
 volatile
 security definer
 set search_path to ''
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
  c record;
  v_visao_antes text;
  v_coluna_antes text;
  v_tinha boolean;
  v_antes text;
  v_depois text;
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  if v_usuario is null then
    raise exception 'Sessão não localizada' using errcode = '28000';
  end if;
  if not private.pode_recurso('paineis_dados', 3) then
    raise exception 'Só o Administrador em Painéis troca a fonte' using errcode = '42501';
  end if;

  select e.* into c from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() e
   where e.co_relatorio = p_relatorio and e.co_coluna = p_coluna;
  if not found then
    raise exception 'Coluna sem fonte editável' using errcode = '22023';
  end if;
  if length(v_motivo) not between 3 and 500 then
    raise exception 'Motivo: de 3 a 500 caracteres.' using errcode = '22023';
  end if;

  select f."NO_VISAO", f."NO_COLUNA_VISAO" into v_visao_antes, v_coluna_antes
    from public."TB_FONTE_COLUNA_PAINEL" f
   where f."CO_AREA" = p_area and f."CO_RELATORIO" = p_relatorio and f."CO_COLUNA" = p_coluna
     for update;
  v_tinha := found;
  v_antes := case when v_tinha
    then coalesce((select o.ds_rotulo_visao || ' › ' || o.ds_rotulo_coluna
                     from private."FC_OPCOES_DE_FONTE_DO_PAINEL"(p_relatorio, p_coluna) o
                    where o.no_visao = v_visao_antes and o.no_coluna = v_coluna_antes),
                  v_visao_antes || ' › ' || v_coluna_antes)
    else c.ds_padrao end;

  if p_visao is null then
    if not v_tinha then
      raise exception 'Nada mudou: a coluna já usa o padrão.' using errcode = '22023';
    end if;
    delete from public."TB_FONTE_COLUNA_PAINEL"
     where "CO_AREA" = p_area and "CO_RELATORIO" = p_relatorio and "CO_COLUNA" = p_coluna;
    v_depois := c.ds_padrao;
  else
    select o.ds_rotulo_visao || ' › ' || o.ds_rotulo_coluna into v_depois
      from private."FC_OPCOES_DE_FONTE_DO_PAINEL"(p_relatorio, p_coluna) o
     where o.no_visao = p_visao and o.no_coluna = p_coluna_visao;
    if not found then
      raise exception 'Fonte inválida para esta coluna' using errcode = '22023';
    end if;
    if v_tinha and v_visao_antes = p_visao and v_coluna_antes = p_coluna_visao then
      raise exception 'Nada mudou: a coluna já usa esta fonte.' using errcode = '22023';
    end if;
    insert into public."TB_FONTE_COLUNA_PAINEL"
      ("CO_AREA", "CO_RELATORIO", "CO_COLUNA", "NO_VISAO", "NO_COLUNA_VISAO", "DS_MOTIVO",
       "CO_USUARIO_ATUALIZACAO", "DT_ATUALIZACAO")
    values (p_area, p_relatorio, p_coluna, p_visao, p_coluna_visao, v_motivo, v_usuario, now())
    on conflict ("CO_AREA", "CO_RELATORIO", "CO_COLUNA") do update
       set "NO_VISAO" = excluded."NO_VISAO", "NO_COLUNA_VISAO" = excluded."NO_COLUNA_VISAO",
           "DS_MOTIVO" = excluded."DS_MOTIVO", "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO",
           "DT_ATUALIZACAO" = excluded."DT_ATUALIZACAO";
  end if;

  insert into public."TH_FONTE_COLUNA_PAINEL"
    ("CO_AREA", "CO_RELATORIO", "CO_COLUNA", "NO_VISAO_ANTES", "NO_COLUNA_VISAO_ANTES",
     "NO_VISAO_DEPOIS", "NO_COLUNA_VISAO_DEPOIS", "DS_FONTE_ANTES", "DS_FONTE_DEPOIS", "DS_MOTIVO",
     "CO_USUARIO_ALTERACAO")
  values (p_area, p_relatorio, p_coluna,
          case when v_tinha then v_visao_antes end, case when v_tinha then v_coluna_antes end,
          p_visao, case when p_visao is not null then p_coluna_visao end,
          left(v_antes, 300), left(v_depois, 300), v_motivo, v_usuario);

  perform private."FC_CALCULAR_RELATORIO_PAINEL"(p_area, p_relatorio, v_usuario, null);
  return private."FC_FONTES_DO_PAINEL_JSON"(p_area, p_relatorio);
end;
$function$;
comment on function public.salvar_fonte_da_coluna(text, text, text, text, text, text) is
  'Painéis › Fontes dos dados: troca a fonte de uma coluna editável na área (p_visao nulo = volta ao padrão), só entre as opções do catálogo, com motivo (3 a 500) e histórico, e recalcula o relatório na mesma transação (se o recálculo falhar, a troca é desfeita). Exige Administrador em paineis_dados e acesso à área. Devolve o mesmo de listar_fontes_do_painel.';

-- As leituras antigas saem: a tela e o download usam ler_relatorio_do_painel.
drop function public.listar_resumo_dos_editais_do_painel(text);
drop function public.listar_editais_por_cargo_do_painel(text);
drop function public.listar_aprovados_do_painel(text);

-- 4. De hora em hora -----------------------------------------------------------------------------
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    insert into public."TB_TAREFA_AGENDADA" ("NO_TAREFA", "ST_PREFIXO", "DS_ROTULO", "CO_CHAVE", "NO_WORKFLOW")
    values ('agsus_paineis_recalcular_relatorios', 'N', 'Recalcular os relatórios dos Painéis', null, null);
    perform cron.schedule(
      'agsus_paineis_recalcular_relatorios',
      '17 * * * *',
      $cmd$select private."FC_CALCULAR_PAINEIS"() where pg_try_advisory_xact_lock(hashtext('agsus_paineis_recalcular_relatorios'));$cmd$);
  end if;
end;
$cron$;

-- 5. O primeiro cálculo, para ninguém pegar o resultado vazio -------------------------------------
select private."FC_CALCULAR_PAINEIS"();

do $confere$
declare
  r record;
begin
  if has_table_privilege('authenticated', 'public."TB_LINHA_RELATORIO_PAINEL"', 'SELECT')
     or has_table_privilege('anon', 'public."TB_CALCULO_RELATORIO_PAINEL"', 'SELECT') then
    raise exception 'As tabelas prontas ficaram alcançáveis pela API.';
  end if;
  if (select count(*) from public."TB_CALCULO_RELATORIO_PAINEL") <> 3 * (select count(*) from public."TB_AREA") then
    raise exception 'Deveria haver um cálculo para cada área e relatório (% de %).',
      (select count(*) from public."TB_CALCULO_RELATORIO_PAINEL"), 3 * (select count(*) from public."TB_AREA");
  end if;
  for r in select k."CO_RELATORIO" as relatorio, sum(k."QT_LINHA") as linhas
             from public."TB_CALCULO_RELATORIO_PAINEL" k group by 1 order by 1 loop
    raise notice '%: % linhas', r.relatorio, r.linhas;
  end loop;
  if has_function_privilege('anon', 'public.ler_relatorio_do_painel(text, text, integer, integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.sincronizar_relatorio_do_painel(text, text)', 'EXECUTE') then
    raise exception 'Grants das RPCs novas errados.';
  end if;
  if to_regprocedure('public.listar_aprovados_do_painel(text)') is not null then
    raise exception 'As leituras antigas deveriam ter saído.';
  end if;
end;
$confere$;

do $ok$ begin raise notice 'Ensaio 20261116160000 ok'; end; $ok$;

rollback;
