/*
  ENSAIO de 20261116180000_vagas_imediatas_dos_paineis_pelo_quadro.sql

  Roda no banco ANTES de aplicar e termina em rollback: nada fica gravado. Aplica tudo (inclusive
  o recálculo) e confere: as linhas de Editais por cargo não diminuem, as vazias não aumentam em
  nenhuma área, e o rótulo novo está no catálogo. Mostra as vazias antes e depois por área.
  Ok = NOTICE "Ensaio 20261116180000 ok", e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_LINHAS_POR_CARGO_DO_PAINEL"(text)')), chr(13), '')) is distinct from '38e165ab4b70d613c90ae93cf8abeabb' then
    raise exception 'FC_LINHAS_POR_CARGO_DO_PAINEL: o corpo no banco não é o de 20261116160000 (md5).';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"()')), chr(13), '')) is distinct from '7bd9516677d22de06f99aa61603b3754' then
    raise exception 'FC_COLUNAS_EDITAVEIS_DO_PAINEL: o corpo no banco não é o de 20261113220000 (md5).';
  end if;
end;
$$;

create temporary table antes_do_ensaio on commit drop as
  select l."CO_AREA" as area, count(*) as linhas,
         count(*) filter (where l."DS_LINHA" ->> 'vagas_imediatas' is null) as vazias
    from public."TB_LINHA_RELATORIO_PAINEL" l
   where l."CO_RELATORIO" = 'editais-por-cargo'
   group by l."CO_AREA";

-- 1. Editais por cargo: as vagas imediatas -------------------------------------------------------
CREATE OR REPLACE FUNCTION private."FC_LINHAS_POR_CARGO_DO_PAINEL"(p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
    /*
      Vagas imediatas, na ordem da Classificação (src/lib/classificacao/vagas.ts):
        1. a linha do quadro de vagas do edital (Anexo II) ligada pelo nome da vaga
           (FC_QUADRO_DA_VAGA, a ligação da Classificação), só nos editais que têm quadro;
        2. sem ela, a configuração da convocação: a vaga (TB_VAGA_IMEDIATA) ou o padrão do edital;
        3. sem ela, o local das vagas lido do edital (TB_LOCAL_VAGA_EDITAL), quando um só casa com o cargo;
        4. por último, o número no título da vaga: "2 vagas (1 AC + …)" = 2; "Cadastro Reserva" = 0.
      A ligação pelo código da vaga na Empregare (FC_QUADRO_DA_VAGA_EMPREGARE) fica de fora: na
      Saúde indígena custou ~10 s a mais por cálculo para 36 linhas (medido em 16/11/2026).
      "materialized": a ligação roda uma vez por linha (dentro do WHERE, rodaria por linha do quadro).
    */
    com_texto as materialized (
      select l.*,
             btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(l.cargo), '[^a-z0-9]+', ' ', 'g')) as cargo_busca,
             case when l.cargo is not null
                   and exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q
                                where q."CO_MONITORAMENTO" = l.edital_id and q."ST_REGISTRO_ATIVO" = 'S')
                  then private."FC_QUADRO_DA_VAGA"(l.edital_id, l.cargo) end as quadro_id
        from linhas l
    ),
    final as (
      select l.*,
             (select q."QT_VAGA_IMEDIATA"
                from public."TB_QUADRO_VAGA_EDITAL" q
               where q."CO_QUADRO_VAGA" = l.quadro_id and q."ST_REGISTRO_ATIVO" = 'S') as vagas_no_quadro,
             -- 10000 ou mais na convocação é "chamar todos", não vagas (o quadro vai até 9999).
             case when l.codigo_vaga is not null then coalesce(
               (select v."QT_VAGA_IMEDIATA"
                  from public."TB_VAGA_IMEDIATA" v
                 where v."CO_EDITAL" = l.edital_id::text and v."CO_VAGA" = l.codigo_vaga
                   and v."QT_VAGA_IMEDIATA" < 10000),
               (select c."QT_PADRAO_IMEDIATA"
                  from public."TB_CONVOCACAO_EDITAL" c
                 where c."CO_EDITAL" = l.edital_id::text
                   and c."QT_PADRAO_IMEDIATA" between 1 and 9999)) end as vagas_na_convocacao,
             case when l.cargo_busca <> '' then
               (select max(lv."QT_VAGA")
                  from public."TB_LOCAL_VAGA_EDITAL" lv
                 where lv."CO_MONITORAMENTO" = l.edital_id and lv."ST_REGISTRO_ATIVO" = 'S'
                   and lv."QT_VAGA" is not null
                   and btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(lv."NO_CARGO"), '[^a-z0-9]+', ' ', 'g')) <> ''
                   and position(' ' || btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(lv."NO_CARGO"), '[^a-z0-9]+', ' ', 'g')) || ' '
                                in ' ' || l.cargo_busca || ' ') > 0
                having count(*) = 1) end as vagas_no_local,
             (regexp_match(private."FC_TEXTO_BUSCA_RECURSO"(l.cargo), '\y(\d{1,4})\s*vagas?\y'))[1]::integer as vagas_no_titulo,
             private."FC_TEXTO_BUSCA_RECURSO"(l.cargo) ~ 'cadastro\s*(de\s*)?reserva' as so_cadastro_reserva
        from com_texto l
    )
    select json_build_object(
      'schema_version', 3,
      'area', p_area,
      'gerado_em', now(),
      'linhas', coalesce((
        select json_agg(json_build_object(
                 'edital_id', f.edital_id,
                 'edital', f.edital,
                 'unidade', f.unidade,
                 'codigo_vaga', f.codigo_vaga,
                 'cargo', f.cargo,
                 'vagas_imediatas', coalesce(f.vagas_no_quadro, f.vagas_na_convocacao, f.vagas_no_local,
                                           f.vagas_no_titulo, case when f.so_cadastro_reserva then 0 end),
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
  'Painéis › Editais por cargo: as linhas da área inteira (sem o recorte do usuário), já com as fontes escolhidas — {linhas, fontes, avisos}. Vagas imediatas: quadro de vagas do edital (pelo nome da vaga), convocação (vaga ou padrão, abaixo de 10000), local da vaga publicado (um só para o cargo) ou o número no título da vaga (20261116180000). Chamada só por FC_LINHAS_DO_RELATORIO_PAINEL.';
revoke all on function private."FC_LINHAS_POR_CARGO_DO_PAINEL"(text) from public, anon, authenticated;

-- 2. O rótulo da coluna e o texto do padrão ----------------------------------------------------------
create or replace function private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"()
 returns table (nu_ordem integer, co_relatorio text, tp_grao text, co_coluna text,
                no_rotulo text, tp_coluna text, ds_padrao text)
 language sql
 immutable
 set search_path to ''
as $function$
  select * from (values
    (1, 'resumo-dos-editais', 'EDITAL', 'vagas_imediatas', 'Total de vagas imediatas', 'inteiro',
        'Padrão: vagas do cadastro do edital'),
    (2, 'resumo-dos-editais', 'EDITAL', 'data_divulgacao', 'Data da divulgação do edital', 'data',
        'Padrão: início da 1ª etapa do cronograma'),
    (3, 'resumo-dos-editais', 'EDITAL', 'data_final', 'Data final do processo seletivo', 'data',
        'Padrão: fim da última etapa do cronograma'),
    (4, 'editais-por-cargo', 'VAGA', 'vagas_imediatas', 'Vagas imediatas', 'inteiro',
        'Padrão: quadro de vagas do edital, convocação, local da vaga ou número no título da vaga'),
    (5, 'editais-por-cargo', 'VAGA', 'inscritos', 'Total de inscritos', 'inteiro',
        'Padrão: inscritos da Seleção'),
    (6, 'editais-por-cargo', 'VAGA', 'aprovados', 'Total de aprovados', 'inteiro',
        'Padrão: lista de aprovados vigente'),
    (7, 'aprovados', 'APROVADO', 'nota', 'Nota', 'decimal',
        'Padrão: nota da lista de aprovados'),
    (8, 'aprovados', 'APROVADO', 'classificacao', 'Classificação', 'inteiro',
        'Padrão: classificação da lista de aprovados'),
    (9, 'aprovados', 'APROVADO', 'status', 'Status', 'texto',
        'Padrão: status da lista de aprovados'),
    (10, 'aprovados', 'APROVADO', 'matricula', 'Matrícula', 'texto',
        'Padrão: matrícula da lista de aprovados'),
    (11, 'aprovados', 'APROVADO', 'data_contratacao', 'Data de admissão (registro no sistema)', 'data',
        'Padrão: data em que o status atual foi registrado')
  ) as c (nu_ordem, co_relatorio, tp_grao, co_coluna, no_rotulo, tp_coluna, ds_padrao)
  order by c.nu_ordem
$function$;

-- 3. O recálculo de Editais por cargo em todas as áreas (o cron de hora em hora faria o mesmo).
select private."FC_CALCULAR_RELATORIO_PAINEL"(t."CO_AREA", 'editais-por-cargo', null, null)
  from public."TB_AREA" t
 order by t."CO_AREA";

do $$
declare
  r record;
begin
  for r in
    select a.area, a.linhas as linhas_antes, a.vazias as vazias_antes,
           count(l.*) as linhas_depois,
           count(l.*) filter (where l."DS_LINHA" ->> 'vagas_imediatas' is null) as vazias_depois
      from antes_do_ensaio a
      left join public."TB_LINHA_RELATORIO_PAINEL" l
        on l."CO_AREA" = a.area and l."CO_RELATORIO" = 'editais-por-cargo'
     group by a.area, a.linhas, a.vazias
     order by a.area
  loop
    raise notice '%: % linhas (antes %), vazias % (antes %)',
      r.area, r.linhas_depois, r.linhas_antes, r.vazias_depois, r.vazias_antes;
    if r.linhas_depois <> r.linhas_antes then
      raise exception 'Ensaio: % mudou o número de linhas de Editais por cargo (% → %).', r.area, r.linhas_antes, r.linhas_depois;
    end if;
    if r.vazias_depois > r.vazias_antes then
      raise exception 'Ensaio: % ficou com mais vagas imediatas vazias (% → %).', r.area, r.vazias_antes, r.vazias_depois;
    end if;
  end loop;
  if (select no_rotulo from private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() where nu_ordem = 4) <> 'Vagas imediatas' then
    raise exception 'Ensaio: o rótulo da coluna não mudou.';
  end if;
  raise notice 'Ensaio 20261116180000 ok';
end;
$$;

rollback;
