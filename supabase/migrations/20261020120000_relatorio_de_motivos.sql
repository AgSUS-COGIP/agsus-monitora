/*
  RELATÓRIO DE MOTIVOS

  Por quê: a coordenação da Avaliação documental pedia à TI relatórios como
  "candidatos reprovados no critério da identidade em que usamos 'Outro
  motivo'" (37 fichas do 114/2026, montadas à mão em 20/10/2026). Agora ela
  tira sozinha: Avaliação documental › Fila › Ações da coordenação ›
  "Relatório de motivos" (filtros, tabela, agrupamento do "Outro motivo" e
  CSV/XLSX montados no navegador; nada gravado, nem banco nem Storage).

  O QUE MUDA
    public.listar_relatorio_de_motivos(p_edital, p_filtros): as fichas do
    edital que casam com os filtros, com SÓ as colunas do relatório: código e
    nome do candidato (sem CPF, e-mail ou telefone), vaga, cargo e lotação,
    situação e resultado da ficha, nota final, quem concluiu (nome do
    cadastro) e quando, e os blocos do lançamento que interessam, reduzidos a
    { situacao, motivos[], motivo_livre, justificativas[], nota_ajustada }
    (os textos dos códigos vêm da regra vigente, que a tela já tem).

    p_filtros (todos opcionais):
      blocos          text[]  códigos do bloco da regra (IDENTIDADE, CURSOS…)
      situacoes       text[]  situação do bloco: CONFORME, NAO_CONFORME,
                              NAO_ENVIADO, NAO_SE_APLICA (na ficha concluída,
                              o bloco escolhido que não está no lançamento
                              conta como NAO_SE_APLICA: cota fora da modalidade)
      motivo          text    código do motivo no bloco (OUTRO = "Outro motivo")
      ajustada        boolean só blocos com justificativa de nota (pontuação
                              diferente da declarada)
      resultados      text[]  APTO, INAPTO_REQUISITO, INAPTO_NOTA
      situacoes_ficha text[]  PENDENTE, EM_ANALISE, REVISAR, CONCLUIDA
                              (nulo = todas menos FORA_LOTE)
      vagas           text[]  códigos da vaga
      avaliador       uuid    quem concluiu (ou o responsável, se não concluída)
      de, ate         date    período de conclusão (dia em America/Sao_Paulo)
      apos            uuid    paginação: o "proximo" da página anterior
      limite          integer até 500 por página (padrão 500)
    Sem filtro de bloco, a linha leva só os blocos com motivo, texto livre ou
    justificativa; com filtro, os blocos que casam com ele.

    Na primeira página (apos nulo): "total" (quantas fichas casam) e
    "avaliadores" (quem concluiu ou responde por ficha do edital, para o
    filtro). Páginas pela chave da ficha; "proximo" nulo = acabou.

    Só o administrador e a coordenação do edital (FC_PAPEL_AVALIACAO =
    COORDENADOR, a mesma checagem das ações da coordenação; 42501). Não grava
    nada. Sem índice novo: IN_FICHAANALISE_FILA (edital, situação, vaga) já
    recorta o edital; o 114/2026 inteiro são ~2.000 fichas.

  Ensaio: supabase/ensaios/20261020120000_relatorio_de_motivos.sql
  Rollback: supabase/rollback/20261020120000_relatorio_de_motivos.sql
*/

begin;

set local lock_timeout = '5s';

create or replace function public.listar_relatorio_de_motivos(
  p_edital uuid,
  p_filtros jsonb default '{}'::jsonb
)
returns json
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $function$
declare
  v_f jsonb := case when jsonb_typeof(p_filtros) = 'object' then p_filtros else '{}'::jsonb end;
  v_blocos text[];
  v_situacoes text[];
  v_motivo text := nullif(btrim(v_f ->> 'motivo'), '');
  v_ajustada boolean := coalesce((v_f ->> 'ajustada')::boolean, false);
  v_resultados text[];
  v_situacoes_ficha text[];
  v_vagas text[];
  v_avaliador uuid;
  v_de date;
  v_ate date;
  v_apos uuid;
  v_limite integer;
  v_com_bloco boolean;
  v_fichas json;
  v_ultimo uuid;
  v_n integer;
  v_total integer;
  v_avaliadores json;
begin
  perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3);
  if private."FC_PAPEL_AVALIACAO"(p_edital) is distinct from 'COORDENADOR' then
    raise exception 'Só o administrador e a coordenação do edital tiram o relatório de motivos'
      using errcode = '42501';
  end if;

  begin
    select array_agg(x) filter (where nullif(btrim(x), '') is not null) into v_blocos
      from jsonb_array_elements_text(coalesce(v_f -> 'blocos', '[]')) x;
    select array_agg(upper(x)) into v_situacoes from jsonb_array_elements_text(coalesce(v_f -> 'situacoes', '[]')) x;
    select array_agg(upper(x)) into v_resultados from jsonb_array_elements_text(coalesce(v_f -> 'resultados', '[]')) x;
    select array_agg(upper(x)) into v_situacoes_ficha from jsonb_array_elements_text(coalesce(v_f -> 'situacoes_ficha', '[]')) x;
    select array_agg(x) into v_vagas from jsonb_array_elements_text(coalesce(v_f -> 'vagas', '[]')) x;
    v_avaliador := nullif(btrim(v_f ->> 'avaliador'), '')::uuid;
    v_de := nullif(btrim(v_f ->> 'de'), '')::date;
    v_ate := nullif(btrim(v_f ->> 'ate'), '')::date;
    v_apos := nullif(btrim(v_f ->> 'apos'), '')::uuid;
    v_limite := least(greatest(coalesce((v_f ->> 'limite')::integer, 500), 1), 500);
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
                 or invalid_parameter_value or numeric_value_out_of_range then
    raise exception 'Filtros inválidos: %', sqlerrm using errcode = '22023';
  end;

  if v_situacoes is not null and not v_situacoes <@ array['CONFORME', 'NAO_CONFORME', 'NAO_ENVIADO', 'NAO_SE_APLICA'] then
    raise exception 'Situação do bloco inválida: use CONFORME, NAO_CONFORME, NAO_ENVIADO ou NAO_SE_APLICA'
      using errcode = '22023';
  end if;
  if v_resultados is not null and not v_resultados <@ array['APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA'] then
    raise exception 'Resultado inválido: use APTO, INAPTO_REQUISITO ou INAPTO_NOTA' using errcode = '22023';
  end if;
  if v_situacoes_ficha is not null
     and not v_situacoes_ficha <@ array['PENDENTE', 'EM_ANALISE', 'REVISAR', 'CONCLUIDA', 'FORA_LOTE'] then
    raise exception 'Situação da ficha inválida' using errcode = '22023';
  end if;
  if cardinality(v_blocos) > 50 or cardinality(v_vagas) > 500 then
    raise exception 'Filtros grandes demais (até 50 blocos e 500 vagas)' using errcode = '22023';
  end if;

  v_com_bloco := v_blocos is not null or v_situacoes is not null or v_motivo is not null or v_ajustada;

  with fichas as (
    select f."CO_FICHA_ANALISE" as id, f."CO_EMPREGARE_CANDIDATO", f."CO_VAGA", f."TP_SITUACAO",
           f."TP_RESULTADO", f."VL_NOTA_FINAL", f."DT_CONCLUSAO",
           coalesce(f."CO_USUARIO_CONCLUSAO", f."CO_USUARIO_RESPONSAVEL") as avaliador,
           case when jsonb_typeof(f."DS_LANCAMENTO" -> 'blocos') = 'object'
                then f."DS_LANCAMENTO" -> 'blocos' else '{}'::jsonb end as lancados
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = p_edital
       and (case when v_situacoes_ficha is null then f."TP_SITUACAO" <> 'FORA_LOTE'
                 else f."TP_SITUACAO" = any (v_situacoes_ficha) end)
       and (v_resultados is null or f."TP_RESULTADO" = any (v_resultados))
       and (v_vagas is null or f."CO_VAGA" = any (v_vagas))
       and (v_avaliador is null or coalesce(f."CO_USUARIO_CONCLUSAO", f."CO_USUARIO_RESPONSAVEL") = v_avaliador)
       and (v_de is null or (f."DT_CONCLUSAO" at time zone 'America/Sao_Paulo')::date >= v_de)
       and (v_ate is null or (f."DT_CONCLUSAO" at time zone 'America/Sao_Paulo')::date <= v_ate)
  ),
  -- Os blocos de cada ficha (com o bloco escolhido que falta na concluída como NAO_SE_APLICA).
  blocos as (
    select x.id, x.codigo, x.b,
           coalesce(nullif(x.b ->> 'situacao', ''), 'NAO_SE_APLICA') as situacao
      from (select fi.id, e.key as codigo, e.value as b
              from fichas fi, jsonb_each(fi.lancados) e
             where jsonb_typeof(e.value) = 'object'
               and (v_blocos is null or e.key = any (v_blocos))
            union all
            select fi.id, k, '{}'::jsonb
              from fichas fi, unnest(v_blocos) k
             where fi."TP_SITUACAO" = 'CONCLUIDA' and not (fi.lancados ? k)) x
  ),
  casados as (
    select bl.id, bl.codigo,
           jsonb_strip_nulls(jsonb_build_object(
             'situacao', bl.situacao,
             'motivos', case when jsonb_typeof(bl.b -> 'motivos') = 'array' and bl.b -> 'motivos' <> '[]'
                             then bl.b -> 'motivos' end,
             'motivo_livre', nullif(btrim(bl.b ->> 'motivo_livre'), ''),
             'justificativas', case when jsonb_typeof(bl.b -> 'justificativas') = 'array' and bl.b -> 'justificativas' <> '[]'
                                    then bl.b -> 'justificativas' end,
             'nota_ajustada', bl.b -> 'nota_ajustada')) as resumo
      from blocos bl
     where (v_situacoes is null or bl.situacao = any (v_situacoes))
       and (v_motivo is null
            or (jsonb_typeof(bl.b -> 'motivos') = 'array' and bl.b -> 'motivos' ? v_motivo)
            or (jsonb_typeof(bl.b -> 'justificativas') = 'array' and bl.b -> 'justificativas' ? v_motivo))
       and (not v_ajustada
            or (jsonb_typeof(bl.b -> 'justificativas') = 'array' and bl.b -> 'justificativas' <> '[]'))
       and (v_com_bloco
            or (jsonb_typeof(bl.b -> 'motivos') = 'array' and bl.b -> 'motivos' <> '[]')
            or (jsonb_typeof(bl.b -> 'justificativas') = 'array' and bl.b -> 'justificativas' <> '[]')
            or nullif(btrim(bl.b ->> 'motivo_livre'), '') is not null)
  ),
  por_ficha as (
    select c.id, jsonb_object_agg(c.codigo, c.resumo) as blocos
      from casados c
     group by c.id
  ),
  filtradas as (
    select fi.*, coalesce(pf.blocos, '{}'::jsonb) as blocos
      from fichas fi
      left join por_ficha pf on pf.id = fi.id
     where not v_com_bloco or pf.id is not null
  ),
  pagina as (
    select fl.* from filtradas fl
     where v_apos is null or fl.id > v_apos
     order by fl.id
     limit v_limite
  )
  select (select json_agg(json_build_object(
            'id', p.id,
            'codigo', c."CO_CANDIDATO_EMPREGARE",
            'nome', c."NO_CANDIDATO",
            'vaga', p."CO_VAGA",
            'cargo', pv."NO_CARGO",
            'lotacao', pv."NO_LOTACAO",
            'situacao', p."TP_SITUACAO",
            'resultado', p."TP_RESULTADO",
            'nota_final', p."VL_NOTA_FINAL",
            'avaliador', pu.nome,
            'concluida_em', p."DT_CONCLUSAO",
            'blocos', p.blocos)
            order by p.id)
            from pagina p
            join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO"
            left join public."TB_PRE_CLASSIF_VAGA" pv
              on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = p."CO_VAGA"
            left join public."TB_PERFIL_USUARIO" pu on pu.user_id = p.avaliador),
         (select max(p.id::text)::uuid from pagina p),
         (select count(*) from pagina),
         case when v_apos is null then (select count(*) from filtradas) end
    into v_fichas, v_ultimo, v_n, v_total;

  if v_apos is null then
    select coalesce(json_agg(json_build_object('usuario', a.avaliador, 'nome', coalesce(pu.nome, 'Sem cadastro'))
                             order by coalesce(pu.nome, 'Sem cadastro')), '[]'::json)
      into v_avaliadores
      from (select distinct coalesce(f."CO_USUARIO_CONCLUSAO", f."CO_USUARIO_RESPONSAVEL") as avaliador
              from public."TB_FICHA_ANALISE" f
             where f."CO_MONITORAMENTO" = p_edital
               and coalesce(f."CO_USUARIO_CONCLUSAO", f."CO_USUARIO_RESPONSAVEL") is not null) a
      left join public."TB_PERFIL_USUARIO" pu on pu.user_id = a.avaliador;
  end if;

  return json_build_object(
    'schema_version', 1,
    'fichas', coalesce(v_fichas, '[]'::json),
    'total', v_total,
    'avaliadores', v_avaliadores,
    -- Página cheia: pode haver mais (a próxima chamada passa apos = proximo).
    'proximo', case when v_n = v_limite then v_ultimo end
  );
end;
$function$;

comment on function public.listar_relatorio_de_motivos(uuid, jsonb) is
  'Relatório de motivos da avaliação documental (20261020120000): fichas do edital filtradas por bloco da regra, situação do bloco, motivo (OUTRO = Outro motivo), justificativa de nota, resultado, situação da ficha, vaga, avaliador e período de conclusão (p_filtros jsonb). Só as colunas do relatório: código e nome do candidato (sem CPF, e-mail ou telefone), vaga, cargo, lotação, situação, resultado, nota final, quem concluiu e quando, e os blocos reduzidos a situação, motivos, motivo_livre, justificativas e nota_ajustada. Páginas de até 500 pela chave da ficha (apos = proximo da anterior); total e avaliadores na primeira página. Só administrador e coordenação do edital (FC_PAPEL_AVALIACAO = COORDENADOR; 42501). Não grava nada.';

revoke all on function public.listar_relatorio_de_motivos(uuid, jsonb) from public, anon;
grant execute on function public.listar_relatorio_de_motivos(uuid, jsonb) to authenticated;

commit;
