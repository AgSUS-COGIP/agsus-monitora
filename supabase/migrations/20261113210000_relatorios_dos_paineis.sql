/*
  RELATÓRIOS DOS PAINÉIS (BLOCO DADOS): TRÊS LEITURAS PARA CONFERÊNCIA (13/11/2026)

  POR QUE
  O módulo Painéis (bloco Dados do menu, migration 20261113200000) começa com três relatórios de
  conferência, em tabela, para baixar em CSV e XLSX. Cada um é uma RPC só de leitura, da área
  escolhida no menu, sob o recurso "paineis_dados".

  AS TRÊS LEITURAS (json { schema_version, area, gerado_em, linhas })
    1. listar_resumo_dos_editais_do_painel(p_area) — uma linha por edital: número, unidade (DSEI),
       vagas imediatas (TB_MONITORAMENTO_INDIGENA.vagas_total), data da divulgação (início da 1ª
       etapa do cronograma; sem cronograma, data_inicio do edital) e data final do processo
       seletivo (fim da última etapa; sem cronograma, data_fim) — as mesmas regras de
       VW_MONITORAMENTO_INDIGENA_OPERACIONAL. O ciclo fica para depois.
    2. listar_editais_por_cargo_do_painel(p_area) — uma linha por vaga de cada edital (na Saúde
       Indígena, uma vaga é um cargo num DSEI): código da vaga, cargo, vagas imediatas, inscritos
       (TB_SELECAO_VAGA.QT_INSCRITO) e aprovados da lista vigente. Seleção e lista se casam como
       no Painel da Seleção (get_selecao_da_area): pelo código numérico da vaga, ou, nas vagas de
       outras bancas (sem código), pelo nome da vaga normalizado; a 2ª vaga de mesmo código
       (chave com #2) não recebe de novo os mesmos aprovados. Aprovados de vaga que a Seleção
       não tem saem numa linha própria (inscritos nulo). Cargo: o da Seleção; quando ela só traz
       o código, o da lista ou o das entrevistas. Vagas imediatas: o número do título da vaga
       ("2 vagas (1 AC + …)"), 0 quando o título diz Cadastro Reserva, nulo quando não diz — o
       quadro de vagas do edital (TB_QUADRO_VAGA_EDITAL) não tem o código da vaga e escreve o
       cargo de outro jeito ("SANITARISTA 40H"), e o casamento pelo nome deixou mais da metade
       das linhas desencontradas na verificação de 13/11/2026. Aprovados nulo = edital sem lista.
       Edital sem vaga na Seleção sai numa linha só, com os inscritos do edital e sem cargo.
    3. listar_aprovados_do_painel(p_area) — uma linha por aprovado da lista vigente: edital,
       unidade, cargo, código da vaga, nota, classificação, nome, status, matrícula e a data em
       que o status virou Contratado ou Migração no sistema (TH_CANDIDATO_APROVADO, hora de
       Brasília). Não existe data de admissão no banco: esta é a data do registro no sistema, e
       só sai quando o status atual é Contratado ou Migração.

  RECORTE (o de sempre): área existente (22023), recurso paineis_dados ≥ Leitor e acesso à área
  (42501, FC_PODE_AREA), editais da coordenação (FC_EDITAIS_VISIVEIS), só editais ativos e fora
  de treinamento; lista de aprovados vigente e ativa.

  Dado pessoal: o relatório 3 traz nome e matrícula, como a Lista de aprovados; quem vê é quem o
  administrador global libera em Painéis na tela de Acessos.

  DEPENDE DE: 20261113200000_paineis_no_bloco_dados.sql (o recurso paineis_dados).
  DESFAZER: supabase/rollback/20261113210000_relatorios_dos_paineis.sql.
  ENSAIO:   supabase/ensaios/20261113210000_relatorios_dos_paineis.sql.
*/
begin;

do $$
begin
  if not ('paineis_dados' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'Aplique antes 20261113200000_paineis_no_bloco_dados.sql.';
  end if;
  if to_regprocedure('private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date)') is null
     or to_regprocedure('private."FC_PODE_AREA"(text)') is null
     or to_regprocedure('private."FC_EDITAIS_VISIVEIS"()') is null
     or to_regprocedure('private."FC_TEXTO_BUSCA_RECURSO"(text)') is null then
    raise exception 'Faltam funções de apoio (cronograma, área, recorte ou texto de busca).';
  end if;
end;
$$;

-- 0. A guarda comum ------------------------------------------------------------------------------
create function private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area text)
 returns void
 language plpgsql
 stable
 set search_path to ''
as $function$
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('paineis_dados', 1) then
    raise exception 'Sem permissão para Painéis' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
end;
$function$;

comment on function private."FC_EXIGIR_PAINEIS_DA_AREA"(text) is
  'Guarda dos relatórios de Painéis: área existente (22023), recurso paineis_dados ≥ leitor e acesso à área (42501).';

revoke all on function private."FC_EXIGIR_PAINEIS_DA_AREA"(text) from public, anon;
grant execute on function private."FC_EXIGIR_PAINEIS_DA_AREA"(text) to authenticated;

-- 1. Resumo dos editais --------------------------------------------------------------------------
create function public.listar_resumo_dos_editais_do_painel(p_area text)
 returns json
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_editais uuid[];
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
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
end;
$function$;

comment on function public.listar_resumo_dos_editais_do_painel(text) is
  'Painéis › Resumo dos editais (json): uma linha por edital da área — número, unidade, vagas imediatas, data da divulgação e data final do processo seletivo (cronograma; sem ele, as datas do edital). Recurso paineis_dados.';

revoke all on function public.listar_resumo_dos_editais_do_painel(text) from public, anon;
grant execute on function public.listar_resumo_dos_editais_do_painel(text) to authenticated;

-- 2. Editais por cargo ---------------------------------------------------------------------------
create function public.listar_editais_por_cargo_do_painel(p_area text)
 returns json
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
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
      select ed.edital, ed.unidade as unidade_do_edital,
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
      select ed.edital, ed.unidade, ed.unidade, a.codigo_vaga, a.cargo, null::integer, a.total
        from ap a
        join ed on ed.id = a.edital_id
       where not exists (select 1 from par p
                          where p.edital_id = a.edital_id and p.codigo_vaga is not distinct from a.codigo_vaga)
      union all
      -- Edital sem vaga na Seleção: uma linha com os inscritos do próprio edital (outra fonte do
      -- funil, como a Avaliação documental), para todo edital do Resumo aparecer aqui.
      select ed.edital, ed.unidade, ed.unidade, null, null, ed.inscritos, null::integer
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
end;
$function$;

comment on function public.listar_editais_por_cargo_do_painel(text) is
  'Painéis › Editais por cargo (json): uma linha por vaga dos editais da área — código, cargo, vagas imediatas do título da vaga (Cadastro Reserva = 0; sem número, nulo), inscritos da Seleção (TB_SELECAO_VAGA) e aprovados da lista vigente, casados pelo código da vaga como em get_selecao_da_area; vaga só da lista sai em linha própria. Recurso paineis_dados.';

revoke all on function public.listar_editais_por_cargo_do_painel(text) from public, anon;
grant execute on function public.listar_editais_por_cargo_do_painel(text) to authenticated;

-- 3. Aprovados -----------------------------------------------------------------------------------
create function public.listar_aprovados_do_painel(p_area text)
 returns json
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  perform private."FC_EXIGIR_PAINEIS_DA_AREA"(p_area);
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
    with ed as (
      select m.id, m.edital, m.unidade
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m."CO_AREA" = p_area and m.ativo
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
         and (v_editais is null or m.id = any (v_editais))
    ),
    linhas as (
      select ed.id as edital_id, ed.edital, ed.unidade,
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
end;
$function$;

comment on function public.listar_aprovados_do_painel(text) is
  'Painéis › Aprovados (json): uma linha por aprovado da lista vigente dos editais da área — edital, unidade, cargo, vaga, nota, classificação, nome, status, matrícula e a data (Brasília) em que o status atual (Contratado ou Migração) foi registrado no sistema. Recurso paineis_dados.';

revoke all on function public.listar_aprovados_do_painel(text) from public, anon;
grant execute on function public.listar_aprovados_do_painel(text) to authenticated;

commit;
