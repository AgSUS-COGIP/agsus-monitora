/*
  DESFAZ 20261116180000_vagas_imediatas_dos_paineis_pelo_quadro.sql: FC_LINHAS_POR_CARGO_DO_PAINEL volta ao corpo de 20261116160000 (vagas imediatas
  só do título da vaga), FC_COLUNAS_EDITAVEIS_DO_PAINEL volta ao de 20261113220000, e Editais por
  cargo é recalculado em todas as áreas.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_LINHAS_POR_CARGO_DO_PAINEL"(text)')), chr(13), '')) is distinct from '31311e61be894b561517e2f760a33a34' then
    raise exception 'FC_LINHAS_POR_CARGO_DO_PAINEL: o corpo no banco mudou depois de 20261116180000 (md5): confira antes de desfazer.';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"()')), chr(13), '')) is distinct from '5d39fbaaa1c4602ed1d6e53ece300876' then
    raise exception 'FC_COLUNAS_EDITAVEIS_DO_PAINEL: o corpo no banco mudou depois de 20261116180000 (md5): confira antes de desfazer.';
  end if;
end;
$$;

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
    (4, 'editais-por-cargo', 'VAGA', 'vagas_imediatas', 'Vagas imediatas (título da vaga)', 'inteiro',
        'Padrão: número no título da vaga'),
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

-- O recálculo de Editais por cargo em todas as áreas (o cron de hora em hora faria o mesmo).
select private."FC_CALCULAR_RELATORIO_PAINEL"(t."CO_AREA", 'editais-por-cargo', null, null)
  from public."TB_AREA" t
 order by t."CO_AREA";

commit;
