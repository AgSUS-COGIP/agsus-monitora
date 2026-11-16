/*
  DESFAZ 20261116160000_relatorios_dos_paineis_prontos.sql: as três leituras antigas voltam (corpo de 20261113240000, comentário e grants de
  20261113210000), salvar_fonte_da_coluna volta ao corpo de 20261113220000, a tarefa de hora em
  hora sai, e saem as funções e as tabelas do resultado pronto (as linhas calculadas não fazem
  falta: são recalculáveis). O histórico das fontes fica como está.
*/
begin;

do $$
begin
  if to_regclass('public."TB_LINHA_RELATORIO_PAINEL"') is null then
    raise exception 'A 20261116160000_relatorios_dos_paineis_prontos.sql não está aplicada (TB_LINHA_RELATORIO_PAINEL não existe).';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.salvar_fonte_da_coluna(text, text, text, text, text, text)')), chr(13), '')) is distinct from '38bcb3558da70e248c4d8288db891c62' then
    raise exception 'salvar_fonte_da_coluna mudou depois de 20261116160000 (md5): confira antes de desfazer.';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.ler_relatorio_do_painel(text, text, integer, integer)')), chr(13), '')) is distinct from 'f3ce0dbd00785a4d5fbd49f6429eb7bd' then
    raise exception 'ler_relatorio_do_painel mudou depois de 20261116160000 (md5): confira antes de desfazer.';
  end if;
end;
$$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'agsus_paineis_recalcular_relatorios';
    delete from public."TB_TAREFA_AGENDADA" where "NO_TAREFA" = 'agsus_paineis_recalcular_relatorios';
  end if;
end;
$cron$;

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
comment on function public.listar_resumo_dos_editais_do_painel(text) is
  'Painéis › Resumo dos editais (json): uma linha por edital da área — número, unidade, vagas imediatas, data da divulgação e data final do processo seletivo (cronograma; sem ele, as datas do edital). Recurso paineis_dados.';
revoke all on function public.listar_resumo_dos_editais_do_painel(text) from public, anon;
grant execute on function public.listar_resumo_dos_editais_do_painel(text) to authenticated;

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
comment on function public.listar_editais_por_cargo_do_painel(text) is
  'Painéis › Editais por cargo (json): uma linha por vaga dos editais da área — código, cargo, vagas imediatas do título da vaga (Cadastro Reserva = 0; sem número, nulo), inscritos da Seleção (TB_SELECAO_VAGA) e aprovados da lista vigente, casados pelo código da vaga como em get_selecao_da_area; vaga só da lista sai em linha própria. Recurso paineis_dados.';
revoke all on function public.listar_editais_por_cargo_do_painel(text) from public, anon;
grant execute on function public.listar_editais_por_cargo_do_painel(text) to authenticated;

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
comment on function public.listar_aprovados_do_painel(text) is
  'Painéis › Aprovados (json): uma linha por aprovado da lista vigente dos editais da área — edital, unidade, cargo, vaga, nota, classificação, nome, status, matrícula e a data (Brasília) em que o status atual (Contratado ou Migração) foi registrado no sistema. Recurso paineis_dados.';
revoke all on function public.listar_aprovados_do_painel(text) from public, anon;
grant execute on function public.listar_aprovados_do_painel(text) to authenticated;

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

  return private."FC_FONTES_DO_PAINEL_JSON"(p_area, p_relatorio);
end;
$function$;
comment on function public.salvar_fonte_da_coluna(text, text, text, text, text, text) is
  'Painéis › Fontes dos dados: troca a fonte de uma coluna editável na área (p_visao nulo = volta ao padrão), só entre as opções do catálogo, com motivo (3 a 500) e histórico. Exige Administrador em paineis_dados e acesso à área. Devolve o mesmo de listar_fontes_do_painel.';

drop function public.sincronizar_relatorio_do_painel(text, text);
drop function public.ler_relatorio_do_painel(text, text, integer, integer);
drop function private."FC_CALCULAR_PAINEIS"();
drop function private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval);
drop function private."FC_LINHAS_DO_RELATORIO_PAINEL"(text, text);
drop function private."FC_LINHAS_RESUMO_DO_PAINEL"(text);
drop function private."FC_LINHAS_POR_CARGO_DO_PAINEL"(text);
drop function private."FC_LINHAS_APROVADOS_DO_PAINEL"(text);
drop table public."TB_LINHA_RELATORIO_PAINEL";
drop table public."TB_CALCULO_RELATORIO_PAINEL";

commit;
