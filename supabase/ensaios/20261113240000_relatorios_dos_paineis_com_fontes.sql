/*
  ENSAIO de 20261113240000_relatorios_dos_paineis_com_fontes.sql

  Roda no banco ANTES de aplicar (com 20261113220000 e 20261113230000 já aplicadas) e termina em
  rollback. Troca as três funções e confere que todas chamam FC_APLICAR_FONTES_DO_PAINEL e que
  continuam recusando área inválida (22023) e quem não tem sessão (42501).
  Ok = NOTICE "Ensaio 20261113240000 ok", e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('private."FC_APLICAR_FONTES_DO_PAINEL"(text, text, jsonb)') is null then
    raise exception 'Aplique antes 20261113220000_fontes_das_colunas_dos_paineis.sql.';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_resumo_dos_editais_do_painel(text)')), chr(13), '')) is distinct from '1c552ebd66c039eb98ad9cb71d20fe41' then
    raise exception 'listar_resumo_dos_editais_do_painel: o corpo no banco não é o de 20261113210000 (md5).';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_editais_por_cargo_do_painel(text)')), chr(13), '')) is distinct from '8e460769852e9e6329f6df97cb65cb02' then
    raise exception 'listar_editais_por_cargo_do_painel: o corpo no banco não é o de 20261113210000 (md5).';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_aprovados_do_painel(text)')), chr(13), '')) is distinct from '09589a991e3e6ccf44e4c5157bafb220' then
    raise exception 'listar_aprovados_do_painel: o corpo no banco não é o de 20261113210000 (md5).';
  end if;
end;
$$;

create or replace function public.listar_resumo_dos_editais_do_painel(p_area text)
 returns json
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_editais uuid[];
  v_resultado json;
  v_aplicado jsonb;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

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
  return ((v_resultado::jsonb) || jsonb_build_object(
    'schema_version', 3,
    'linhas', v_aplicado -> 'linhas',
    'fontes', v_aplicado -> 'fontes',
    'avisos', v_aplicado -> 'avisos'))::json;
end;
$function$;

create or replace function public.listar_editais_por_cargo_do_painel(p_area text)
 returns json
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_editais uuid[];
  v_resultado json;
  v_aplicado jsonb;
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

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
  return ((v_resultado::jsonb) || jsonb_build_object(
    'schema_version', 3,
    'linhas', v_aplicado -> 'linhas',
    'fontes', v_aplicado -> 'fontes',
    'avisos', v_aplicado -> 'avisos'))::json;
end;
$function$;

create or replace function public.listar_aprovados_do_painel(p_area text)
 returns json
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_editais uuid[];
  v_resultado json;
  v_aplicado jsonb;
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

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
  return ((v_resultado::jsonb) || jsonb_build_object(
    'schema_version', 3,
    'linhas', v_aplicado -> 'linhas',
    'fontes', v_aplicado -> 'fontes',
    'avisos', v_aplicado -> 'avisos'))::json;
end;
$function$;


do $confere$
declare
  f text;
begin
  foreach f in array array['listar_resumo_dos_editais_do_painel', 'listar_editais_por_cargo_do_painel', 'listar_aprovados_do_painel'] loop
    if position('FC_APLICAR_FONTES_DO_PAINEL' in (select prosrc from pg_proc where oid = to_regprocedure('public.' || f || '(text)'))) = 0 then
      raise exception '% não passa pelas fontes.', f;
    end if;
  end loop;
  begin
    perform public.listar_editais_por_cargo_do_painel('nao-existe');
    raise exception 'Área inválida deveria ser recusada.';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.listar_aprovados_do_painel('saude-indigena');
    raise exception 'Sem sessão, a leitura deveria ser recusada.';
  exception when sqlstate '42501' then null;
  end;
end;
$confere$;

do $ok$ begin raise notice 'Ensaio 20261113240000 ok'; end; $ok$;

rollback;
