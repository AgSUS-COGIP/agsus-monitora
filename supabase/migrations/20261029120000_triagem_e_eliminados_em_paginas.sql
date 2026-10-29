/*
  PRÉ-CLASSIFICAÇÃO E ELIMINADOS ABREM RÁPIDO: RESUMO PRONTO E PÁGINAS DE 50.

  Medido em produção (29/10/2026, 114/2026: 7.726 inscritos, 5.753 eliminados, 29 vagas):
  - obter_pre_classificacao_se_mudou montava os ~5 MB de JSON de todos os inscritos a cada
    abertura (1,35 s no banco, ~3 s com a rede) só para a tela desenhar 50 por vaga;
  - obter_acompanhamento_inscricoes achava a linha do quadro de cada vaga na hora
    (FC_QUADRO_DA_VAGA_EMPREGARE, ~0,65 s), embora o job da pré-classificação já a grave em
    TB_PRE_CLASSIF_VAGA;
  - a aba Eliminados da Avaliação documental lia os 5.753 em páginas de 2.000 (~550 KB cada),
    uma depois da outra;
  - obter_equipe_edital filtrava TB_ANALISE_CURRICULAR por FC_NUMERO_EDITAL(edital) linha a
    linha (sem índice).

  O que muda (nada é recalculado; só leitura do que o job Python já gravou):
  1. A Pré-classificação em partes, cada aba lê a sua (todas do instantâneo):
     - obter_resumo_pre_classificacao (abertura): edital, papel, regra vigente, execução, totais
       do edital (somas de TB_PRE_CLASSIF_VAGA), congeladas e a trava das inscrições;
     - obter_vagas_pre_classificacao: o resumo por vaga (contagens, lote, corte, avisos);
     - obter_listas_pre_classificacao: regra de classificação, listas registradas, lotes;
     - conferir_eliminados_pre_classificacao: a situação de agora só dos comunicados marcados
       (vaga|código), em vez de reler a pré-classificação inteira antes de emitir.
     Partes privadas (FC_PRE_CABECALHO, FC_PRE_VAGAS, FC_PRE_LISTAS) que obter_pre_classificacao
     também usa (uma fonte só); ela continua devolvendo os inscritos para telas antigas em cache.
  2. public.listar_pre_classificacao: os inscritos de uma vaga (ou do edital, na busca), 50 por
     página, por cursor estável (vaga, grupo, posição, código), com o total do recorte e, sem
     vaga, quantos por vaga. Grupos: CLASSIFICADOS (no lote e fora do lote), ELIMINADOS e
     PODE_INCLUIR (quem a coordenação pode incluir por decisão). Busca por código ou nome no
     banco, sem acento.
  3. public.listar_eliminados_fila: a aba Eliminados da fila em páginas de 50, com vaga,
     modalidade, busca e ordem por coluna no banco; as linhas no formato da fila
     (private."FC_LINHAS_DA_FILA" com p_candidatos), o total do recorte e o cursor.
  4. obter_acompanhamento_inscricoes: o cargo da vaga vem de TB_PRE_CLASSIF_VAGA (gravado pelo
     job); só a vaga ainda sem pré-classificação procura a linha do quadro.
  5. Índice "IN_ANALISECURR_AREANUMEDITAL" (CO_AREA, FC_NUMERO_EDITAL(edital)) WHERE ativo: a
     lista de vagas de obter_equipe_edital (e de quem casa a análise com o edital) para de varrer
     a tabela.

  Permissões: as de sempre (FC_EXIGIR_COORD_AVALIACAO na pré-classificação; Leitor da Avaliação
  documental na fila, com o analista só nas vagas dele); o administrador global passa por elas.
  Não grava nada, não muda TB_PRE_CLASSIFICACAO, lotes, notas nem a trava das inscrições do
  114/2026; não pede o job.

  Ensaio: supabase/ensaios/20261029120000_triagem_e_eliminados_em_paginas.sql
  Rollback: supabase/rollback/20261029120000_triagem_e_eliminados_em_paginas.sql
*/
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer, uuid[])') is null
     or to_regprocedure('private."FC_EXIGIR_COORD_AVALIACAO"(uuid)') is null
     or to_regprocedure('private."FC_VAGAS_DO_ANALISTA"(uuid, uuid)') is null
     or to_regclass('public."TB_PRE_CLASSIF_VAGA"') is null then
    raise exception 'Aplique antes a pré-classificação e a fila leve (20261014180000, 20261019150000).';
  end if;
end;
$$;

-- ─── Texto de busca: minúsculas e sem acento (o mesmo que semAcento da tela) ───────────────
create or replace function private."FC_TEXTO_DE_BUSCA"(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(coalesce(p_texto, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'));
$$;
revoke all on function private."FC_TEXTO_DE_BUSCA"(text) from public;

-- ─── 1. A pré-classificação em partes (cada aba lê a sua) ──────────────────────────────────
-- O cabeçalho: edital, papel, permissões, regra vigente e a execução. Confere a permissão.
create or replace function private."FC_PRE_CABECALHO"(p_edital uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_classif_editor boolean := private.pode_recurso('classificacao', 2);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  return jsonb_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', jsonb_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                 'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital),
                                 'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_registrar_lista', coalesce(v_papel = 'COORDENADOR', false) or coalesce(v_classif_editor, false),
    'pode_publicar_lista', coalesce(v_classif_editor, false),
    'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                        'configuracao', h."DS_CONFIGURACAO")
                from public."TB_REGRA_ANALISE" r
                join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
               where r."CO_MONITORAMENTO" = p_edital),
    'em_andamento', exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
                             where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour'),
    'ultima_execucao', (
      select jsonb_build_object('id', t."CO_EXECUCAO", 'inicio', t."DT_INICIO", 'fim', t."DT_FIM", 'situacao', t."TP_SITUACAO",
                                'disparo', t."TP_DISPARO", 'refazer', t."ST_REFAZER_LOTE" = 'S', 'mensagem', t."DS_MENSAGEM",
                                'execucao', t."DS_URL_EXECUCAO",
                                'edital', (select e from jsonb_array_elements(t."DS_EDITAL") e where e ->> 'edital' = p_edital::text limit 1))
        from public."TL_PRE_CLASSIFICACAO" t
       where t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', p_edital::text))
       order by t."DT_INICIO" desc limit 1)
  );
end;
$$;
revoke all on function private."FC_PRE_CABECALHO"(uuid) from public;

-- As vagas com as contagens do instantâneo (TB_PRE_CLASSIF_VAGA) e o lote pela regra e por decisão.
create or replace function private."FC_PRE_VAGAS"(p_edital uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', v."CO_VAGA",
           'candidatos_empregare', v."QT_CANDIDATO_ATIVO",
           'ultima_carga', v."DT_ULTIMA_CARGA",
           'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO",
           'vagas_imediatas', pv."QT_VAGA_IMEDIATA", 'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
           'inscritos', pv."QT_INSCRITO", 'eliminados', pv."QT_ELIMINADO", 'ranqueados', pv."QT_RANQUEADO",
           'no_lote', pv."QT_LOTE", 'tamanho', pv."QT_TAMANHO_LOTE", 'descricao', pv."DS_TAMANHO_LOTE",
           'por_modalidade', pv."DS_TAMANHO_MODALIDADE", 'art_corte', pv."VL_ART_CORTE",
           'divergencias', pv."QT_DIVERGENCIA", 'sem_art', pv."QT_SEM_ART", 'acima_do_corte', pv."QT_ACIMA_CORTE",
           'ultimo_lote', pv."NU_ULTIMO_LOTE", 'avisos', coalesce(pv."DS_AVISO", '[]'::jsonb),
           -- O lote pela regra e por decisão da coordenação (contagem pelo índice da vaga).
           'no_lote_regra', l.regra, 'no_lote_decisao', l.decisao,
           -- Quantos estão fora do lote (ranqueados): o "N de M" da lista sem ler os inscritos.
           'fora_do_lote', l.fora,
           'versao_regra', pv."NU_VERSAO_REGRA", 'atualizado_em', pv."DT_ATUALIZACAO")
         order by v."CO_VAGA"), '[]'::jsonb)
    from public."TB_EMPREGARE_VAGA" v
    left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA"
    left join lateral (
      select count(*) filter (where a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and a."TP_ENTRADA_LOTE" is distinct from 'DECISAO') as regra,
             count(*) filter (where a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and a."TP_ENTRADA_LOTE" = 'DECISAO') as decisao,
             count(*) filter (where a."TP_SITUACAO" = 'RANQUEADO') as fora
        from public."TB_PRE_CLASSIFICACAO" a
       where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = v."CO_VAGA") l on true
   where v."CO_MONITORAMENTO" = p_edital;
$$;
revoke all on function private."FC_PRE_VAGAS"(uuid) from public;

-- A regra de classificação, as listas registradas e quantos há em cada lote (a aba Listas oficiais).
create or replace function private."FC_PRE_LISTAS"(p_edital uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'regra_classificacao', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'configuracao', h."DS_CONFIGURACAO")
                              from public."TB_REGRA_CLASSIFICACAO" r
                              join public."TH_REGRA_CLASSIFICACAO" h
                                on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                             where r."CO_MONITORAMENTO" = p_edital),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object('meta', private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO"),
                                          'lote', l."DS_RESULTADO" -> 'lote')
             order by l."DT_GERACAO" desc)
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" in ('PROVISORIA', 'LOTE')), '[]'::jsonb),
    -- Os lotes com gente (a tela oferece registrar cada um): [{ lote, quantidade }].
    'lotes', coalesce((
      select jsonb_agg(jsonb_build_object('lote', x.lote, 'quantidade', x.n) order by x.lote)
        from (select a."NU_LOTE" as lote, count(*) as n
                from public."TB_PRE_CLASSIFICACAO" a
               where a."CO_MONITORAMENTO" = p_edital and a."NU_LOTE" is not null
               group by a."NU_LOTE") x), '[]'::jsonb));
$$;
revoke all on function private."FC_PRE_LISTAS"(uuid) from public;

-- A abertura da aba: o cabeçalho, os totais do edital, as congeladas e a trava das inscrições.
create or replace function public.obter_resumo_pre_classificacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cabecalho jsonb := private."FC_PRE_CABECALHO"(p_edital);
begin
  return (v_cabecalho || jsonb_build_object(
    'totais', (
      select jsonb_build_object(
               'vagas', count(*),
               'vagas_sem_pre', count(*) filter (where pv."CO_VAGA" is null),
               'inscritos', coalesce(sum(pv."QT_INSCRITO"), 0),
               'eliminados', coalesce(sum(pv."QT_ELIMINADO"), 0),
               'ranqueados', coalesce(sum(pv."QT_RANQUEADO"), 0),
               'no_lote', coalesce(sum(pv."QT_LOTE"), 0),
               'divergencias', coalesce(sum(pv."QT_DIVERGENCIA"), 0),
               -- "N de M": a soma dos tamanhos das vagas pré-classificadas; vaga sem tamanho
               -- (sem quadro) deixa o total em aberto.
               'tamanho', case when count(pv."CO_VAGA") > 0
                                and count(pv."CO_VAGA") = count(pv."QT_TAMANHO_LOTE")
                               then sum(pv."QT_TAMANHO_LOTE") end,
               'no_lote_regra', (select count(*) from public."TB_PRE_CLASSIFICACAO" a
                                  where a."CO_MONITORAMENTO" = p_edital and a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
                                    and a."TP_ENTRADA_LOTE" is distinct from 'DECISAO'),
               'no_lote_decisao', (select count(*) from public."TB_PRE_CLASSIFICACAO" a
                                    where a."CO_MONITORAMENTO" = p_edital and a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
                                      and a."TP_ENTRADA_LOTE" = 'DECISAO'))
        from public."TB_EMPREGARE_VAGA" v
        left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA"
       where v."CO_MONITORAMENTO" = p_edital),
    -- As notas declaradas congeladas do edital: quantas e a primeira data.
    'congeladas', (
      select jsonb_build_object('quantidade', count(*), 'em', min(a."DT_CONGELAMENTO_DECLARADA"))
        from public."TB_PRE_CLASSIFICACAO" a
       where a."CO_MONITORAMENTO" = p_edital and a."VL_DECLARADA_CONGELADA" is not null),
    -- A trava das inscrições (o mesmo de obter_congelamento_inscricoes; banco sem ela: nulo).
    'congelamento', case when to_regprocedure('public.obter_congelamento_inscricoes(uuid)') is not null
                         then public.obter_congelamento_inscricoes(p_edital)::jsonb end))::json;
end;
$$;
revoke all on function public.obter_resumo_pre_classificacao(uuid) from public, anon;
grant execute on function public.obter_resumo_pre_classificacao(uuid) to authenticated;
comment on function public.obter_resumo_pre_classificacao(uuid) is
  'Abertura da Pré-classificação, só o resumo do instantâneo: edital, papel, regra vigente, execução, totais, congeladas e a trava das inscrições. Vagas, listas e inscritos vêm cada um quando a aba abre. Coordenação do edital.';

create or replace function public.obter_vagas_pre_classificacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
begin
  return json_build_object('schema_version', 1, 'edital', p_edital, 'vagas', private."FC_PRE_VAGAS"(p_edital));
end;
$$;
revoke all on function public.obter_vagas_pre_classificacao(uuid) from public, anon;
grant execute on function public.obter_vagas_pre_classificacao(uuid) to authenticated;
comment on function public.obter_vagas_pre_classificacao(uuid) is
  'O resumo por vaga da Pré-classificação (contagens do instantâneo, tamanho e corte do lote, avisos, lote pela regra e por decisão, fora do lote). Coordenação do edital.';

create or replace function public.obter_listas_pre_classificacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
begin
  return (jsonb_build_object('schema_version', 1, 'edital', p_edital) || private."FC_PRE_LISTAS"(p_edital))::json;
end;
$$;
revoke all on function public.obter_listas_pre_classificacao(uuid) from public, anon;
grant execute on function public.obter_listas_pre_classificacao(uuid) to authenticated;
comment on function public.obter_listas_pre_classificacao(uuid) is
  'A aba Listas oficiais da Pré-classificação: regra de classificação, listas PROVISORIA/LOTE registradas e quantos há em cada lote. Coordenação do edital.';

/*
  A conferência dos comunicados de eliminação (um ou em lote): só os marcados,
  pela chave "vaga|código", como estão agora no instantâneo, mais o cargo das
  vagas deles. Quem deixou de estar eliminado volta com a situação de agora.
*/
create or replace function public.conferir_eliminados_pre_classificacao(p_edital uuid, p_chaves text[])
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
begin
  if cardinality(p_chaves) > 10000 then
    raise exception 'No máximo 10.000 por vez.' using errcode = '22023';
  end if;
  return (
    with pedidas as (
      select split_part(k, '|', 1) as vaga, split_part(k, '|', 2) as codigo
        from unnest(coalesce(p_chaves, '{}')) k
    ),
    linhas as (
      select a."CO_VAGA"::text as vaga, c."CO_CANDIDATO_EMPREGARE"::text as codigo, c."NO_CANDIDATO" as nome,
             a."TP_SITUACAO" as situacao, a."DS_MOTIVO_ELIMINACAO" as motivo, a."CO_MOTIVO_ELIMINACAO" as motivo_codigo,
             a."NO_MODALIDADE" as modalidade, a."VL_ART" as art, a."VL_NOTA_DECLARADA" as declarada,
             a."VL_NOTA_ORDEM" as nota, a."TP_ORIGEM_NOTA" as origem_nota
        from pedidas p
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = p.vaga and c."CO_CANDIDATO_EMPREGARE"::text = p.codigo
        join public."TB_PRE_CLASSIFICACAO" a
          on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"
    )
    select json_build_object(
      'schema_version', 1,
      'edital', p_edital,
      'candidatos', coalesce((select json_agg(row_to_json(l)) from linhas l), '[]'::json),
      'vagas', coalesce((
        select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO"))
          from public."TB_PRE_CLASSIF_VAGA" pv
         where pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" in (select distinct l.vaga from linhas l)), '[]'::json)));
end;
$$;
revoke all on function public.conferir_eliminados_pre_classificacao(uuid, text[]) from public, anon;
grant execute on function public.conferir_eliminados_pre_classificacao(uuid, text[]) to authenticated;
comment on function public.conferir_eliminados_pre_classificacao(uuid, text[]) is
  'Comunicados de eliminação: a situação de agora só dos marcados (chaves vaga|código) e o cargo das vagas deles, em vez de reler a pré-classificação inteira. Coordenação do edital.';

-- obter_pre_classificacao: as mesmas partes e os inscritos (para quem ainda lê tudo).
create or replace function public.obter_pre_classificacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (private."FC_PRE_CABECALHO"(p_edital)
          || (private."FC_PRE_LISTAS"(p_edital) - 'lotes')
          || jsonb_build_object('vagas', private."FC_PRE_VAGAS"(p_edital) , 'candidatos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA",
               'codigo', c."CO_CANDIDATO_EMPREGARE", 'nome', c."NO_CANDIDATO",
               'situacao', a."TP_SITUACAO", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'motivo', a."DS_MOTIVO_ELIMINACAO",
               'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM", 'origem_nota', a."TP_ORIGEM_NOTA",
               'declarada', a."VL_NOTA_DECLARADA", 'divergente', a."ST_DIVERGENTE" = 'S', 'modalidade', a."NO_MODALIDADE",
               'declarada_completa', (a."DS_NOTA_DECLARADA" ->> 'completa')::boolean,
               'declarada_congelada', a."VL_DECLARADA_CONGELADA", 'congelada_em', a."DT_CONGELAMENTO_DECLARADA",
               'posicao', a."NU_POSICAO", 'posicao_modalidade', a."NU_POSICAO_MODALIDADE",
               'lote', a."NU_LOTE", 'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE",
               'motivo_entrada', a."DS_MOTIVO_ENTRADA", 'entrada_em', a."DT_ENTRADA_LOTE",
               'decisao', case when d."CO_DECISAO_LOTE" is not null then jsonb_build_object(
                 'motivo', d."DS_MOTIVO", 'por', coalesce(ud.nome, ud.email), 'em', d."DT_DECISAO",
                 'situacao_regra', d."TP_SITUACAO_REGRA", 'motivo_regra', d."DS_MOTIVO_ELIMINACAO_REGRA") end)
             order by a."CO_VAGA", a."TP_SITUACAO" = 'ELIMINADO', a."NU_POSICAO", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_DECISAO_LOTE" d
          on d."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and d."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO" and d."ST_ATIVO" = 'S'
        left join public."TB_PERFIL_USUARIO" ud on ud.user_id = d."CO_USUARIO_DECISAO"
       where a."CO_MONITORAMENTO" = p_edital), '[]'::jsonb)))::json;
end;
$$;

-- ─── 2. Os inscritos da pré-classificação em páginas ───────────────────────────────────────
/*
  p_grupo: CLASSIFICADOS (no lote primeiro, depois fora do lote, cada um pela posição),
  ELIMINADOS (pelo código) ou PODE_INCLUIR (fora do lote e eliminados que a coordenação pode
  incluir por decisão: não os que saíram da Empregare). p_vaga nulo = o edital todo (busca).
  p_apos = o "proximo" da página anterior ({ vaga, grupo, posicao, codigo }).
  Devolve { candidatos, proximo, total, por_vaga } (por_vaga só sem p_vaga).
*/
create or replace function public.listar_pre_classificacao(
  p_edital uuid,
  p_vaga text default null,
  p_grupo text default 'CLASSIFICADOS',
  p_busca text default null,
  p_apos jsonb default null,
  p_limite integer default 50
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_grupo text := upper(coalesce(p_grupo, 'CLASSIFICADOS'));
  v_busca text := nullif(btrim(private."FC_TEXTO_DE_BUSCA"(p_busca)), '');
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 500);
  v_apos_vaga text := p_apos ->> 'vaga';
  v_apos_grupo integer := (p_apos ->> 'grupo')::integer;
  v_apos_posicao integer := (p_apos ->> 'posicao')::integer;
  v_apos_codigo text := p_apos ->> 'codigo';
  v_linhas jsonb;
  v_ultimo jsonb;
  v_n integer;
  v_total integer;
  v_por_vaga jsonb;
begin
  if v_grupo not in ('CLASSIFICADOS', 'ELIMINADOS', 'PODE_INCLUIR') then
    raise exception 'Grupo inválido: %', p_grupo using errcode = '22023';
  end if;

  -- Uma consulta só (função STABLE, sem tabela temporária): o recorte é lido uma vez e dele
  -- saem o total, quantos por vaga e a página.
  with recorte as materialized (
    select a."CO_EMPREGARE_CANDIDATO" as id, a."CO_VAGA"::text as vaga,
           -- No lote antes de fora do lote; eliminados num grupo só.
           case when a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') then 0
                when a."TP_SITUACAO" = 'RANQUEADO' then 1 else 2 end as grupo,
           case when v_grupo = 'ELIMINADOS' then 0 else coalesce(a."NU_POSICAO", 2147483647) end as posicao,
           coalesce(c."CO_CANDIDATO_EMPREGARE"::text, '') collate "C" as codigo
      from public."TB_PRE_CLASSIFICACAO" a
      join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
     where a."CO_MONITORAMENTO" = p_edital
       and (p_vaga is null or a."CO_VAGA" = p_vaga)
       and case v_grupo
             when 'CLASSIFICADOS' then a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO', 'RANQUEADO')
             when 'ELIMINADOS' then a."TP_SITUACAO" = 'ELIMINADO'
             else a."TP_SITUACAO" = 'RANQUEADO'
                  or (a."TP_SITUACAO" = 'ELIMINADO' and a."CO_MOTIVO_ELIMINACAO" is distinct from 'SAIU_DA_EMPREGARE')
           end
       and (v_busca is null
            or private."FC_TEXTO_DE_BUSCA"(concat_ws(' ', c."CO_CANDIDATO_EMPREGARE", c."NO_CANDIDATO")) like '%' || v_busca || '%')
  ),
  pagina as (
    select r.*
      from recorte r
     where p_apos is null
        or (r.vaga collate "C", r.grupo, r.posicao, r.codigo)
           > (v_apos_vaga collate "C", v_apos_grupo, v_apos_posicao, v_apos_codigo collate "C")
     order by r.vaga collate "C", r.grupo, r.posicao, r.codigo
     limit v_limite
  ),
  linhas as (
    select p.vaga, p.grupo, p.posicao, p.codigo,
           jsonb_strip_nulls(jsonb_build_object(
             'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA",
             'codigo', c."CO_CANDIDATO_EMPREGARE", 'nome', c."NO_CANDIDATO",
             'situacao', a."TP_SITUACAO", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'motivo', a."DS_MOTIVO_ELIMINACAO",
             'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM", 'origem_nota', a."TP_ORIGEM_NOTA",
             'declarada', a."VL_NOTA_DECLARADA", 'divergente', a."ST_DIVERGENTE" = 'S', 'modalidade', a."NO_MODALIDADE",
             'declarada_congelada', a."VL_DECLARADA_CONGELADA", 'congelada_em', a."DT_CONGELAMENTO_DECLARADA",
             'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE", 'entrada', a."TP_ENTRADA_LOTE",
             'motivo_entrada', a."DS_MOTIVO_ENTRADA",
             'decisao', case when d."CO_DECISAO_LOTE" is not null then jsonb_build_object(
               'motivo', d."DS_MOTIVO", 'por', coalesce(ud.nome, ud.email), 'em', d."DT_DECISAO",
               'situacao_regra', d."TP_SITUACAO_REGRA", 'motivo_regra', d."DS_MOTIVO_ELIMINACAO_REGRA") end)) as linha
      from pagina p
      join public."TB_PRE_CLASSIFICACAO" a on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = p.id
      join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
      left join public."TB_DECISAO_LOTE" d
        on d."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and d."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO" and d."ST_ATIVO" = 'S'
      left join public."TB_PERFIL_USUARIO" ud on ud.user_id = d."CO_USUARIO_DECISAO"
  )
  select (select count(*) from recorte),
         case when p_vaga is null then
           (select coalesce(jsonb_object_agg(x.vaga, x.n), '{}'::jsonb)
              from (select r.vaga, count(*) as n from recorte r group by r.vaga) x) end,
         (select coalesce(jsonb_agg(l.linha order by l.vaga collate "C", l.grupo, l.posicao, l.codigo), '[]'::jsonb) from linhas l),
         (select jsonb_build_object('vaga', l.vaga, 'grupo', l.grupo, 'posicao', l.posicao, 'codigo', l.codigo)
            from linhas l order by l.vaga collate "C" desc, l.grupo desc, l.posicao desc, l.codigo desc limit 1),
         (select count(*) from linhas)
    into v_total, v_por_vaga, v_linhas, v_ultimo, v_n;

  return json_build_object(
    'schema_version', 1,
    'edital', p_edital,
    'vaga', p_vaga,
    'grupo', v_grupo,
    'candidatos', v_linhas,
    'total', v_total,
    'por_vaga', v_por_vaga,
    -- Página cheia: pode haver mais (a próxima chamada passa p_apos = proximo).
    'proximo', case when v_n = v_limite then v_ultimo end
  );
end;
$$;
revoke all on function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer) from public, anon;
grant execute on function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer) to authenticated;
comment on function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer) is
  'Inscritos da pré-classificação em páginas (até 500; a tela pede 50) por cursor estável: CLASSIFICADOS, ELIMINADOS ou PODE_INCLUIR, de uma vaga ou do edital, com busca e total. Coordenação do edital.';

-- ─── 3. A aba Eliminados da fila em páginas ────────────────────────────────────────────────
/*
  p_ordem: '' (vaga e código), codigo, nome, vaga, motivo ou art; p_sentido: asc ou desc.
  p_apos = o "proximo" da página anterior ({ chave, codigo, id }).
  Devolve { candidatos (formato da fila), proximo, total }.
*/
create or replace function public.listar_eliminados_fila(
  p_edital uuid,
  p_vaga text default null,
  p_modalidade text default null,
  p_busca text default null,
  p_ordem text default null,
  p_sentido text default 'asc',
  p_apos jsonb default null,
  p_limite integer default 50
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_ordem text := lower(coalesce(p_ordem, ''));
  v_desc boolean := lower(coalesce(p_sentido, 'asc')) = 'desc';
  v_busca text := nullif(btrim(private."FC_TEXTO_DE_BUSCA"(p_busca)), '');
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 2000);
  v_vagas text[];
  v_ids uuid[];
  v_linhas json;
  v_ultimo jsonb;
  v_n integer;
  v_total integer;
begin
  if v_ordem not in ('', 'codigo', 'nome', 'vaga', 'motivo', 'art') then
    raise exception 'Ordem inválida: %', p_ordem using errcode = '22023';
  end if;
  if coalesce(v_papel, '') = 'ANALISTA' then
    v_vagas := private."FC_VAGAS_DO_ANALISTA"(p_edital, v_uid);
  end if;

  -- Uma consulta só (função STABLE, sem tabela temporária), montada com o sentido da ordem:
  -- o recorte é lido uma vez e dele saem o total e a página (cursor: chave, código, id).
  execute format($sql$
    with recorte as materialized (
      select a."CO_EMPREGARE_CANDIDATO" as id,
             -- A chave da ordem, em texto comparável (números com zeros à esquerda).
             (case $1
                when 'codigo' then ''
                when 'nome' then private."FC_TEXTO_DE_BUSCA"(c."NO_CANDIDATO")
                when 'motivo' then private."FC_TEXTO_DE_BUSCA"(a."DS_MOTIVO_ELIMINACAO")
                when 'art' then case when a."VL_ART" is null then '' else to_char(a."VL_ART" + 100000, 'FM000000000.0000') end
                else lpad(a."CO_VAGA"::text, 20, '0')
              end) collate "C" as chave,
             lpad(coalesce(c."CO_CANDIDATO_EMPREGARE"::text, ''), 20, '0') collate "C" as codigo
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
       where a."CO_MONITORAMENTO" = $2
         and a."TP_SITUACAO" = 'ELIMINADO'
         and ($3 is null or a."CO_VAGA" = any ($3))
         and ($4 is null or a."CO_VAGA" = $4)
         and ($5 is null or a."NO_MODALIDADE" = $5)
         and ($6 is null
              or private."FC_TEXTO_DE_BUSCA"(concat_ws(' ', c."CO_CANDIDATO_EMPREGARE", c."NO_CANDIDATO")) like '%%' || $6 || '%%')
    ),
    pagina as (
      select r.*, row_number() over (order by r.chave %1$s, r.codigo %1$s, r.id %1$s) as n
        from recorte r
       where $7 is null
          or (r.chave, r.codigo, r.id) %2$s (($7 ->> 'chave') collate "C", ($7 ->> 'codigo') collate "C", ($7 ->> 'id')::uuid)
       order by r.chave %1$s, r.codigo %1$s, r.id %1$s
       limit $8
    )
    select (select count(*) from recorte),
           (select array_agg(p.id order by p.n) from pagina p),
           (select jsonb_build_object('chave', p.chave, 'codigo', p.codigo, 'id', p.id) from pagina p order by p.n desc limit 1),
           (select count(*) from pagina)
  $sql$, case when v_desc then 'desc' else 'asc' end, case when v_desc then '<' else '>' end)
  into v_total, v_ids, v_ultimo, v_n
  using v_ordem, p_edital, v_vagas, p_vaga, p_modalidade, v_busca, p_apos, v_limite;

  -- As linhas no formato da fila (com a ficha, quando houver), na ordem da página.
  select coalesce(json_agg(l.linha order by array_position(v_ids, l.id)), '[]'::json)
    into v_linhas
    from (select * from private."FC_LINHAS_DA_FILA"(p_edital, v_vagas, false, null, null, coalesce(v_ids, '{}'))
          union all
          select * from private."FC_LINHAS_DA_FILA"(p_edital, v_vagas, true, null, null, coalesce(v_ids, '{}'))) l;

  return json_build_object(
    'schema_version', 1,
    'edital', p_edital,
    'area', v_area,
    'candidatos', v_linhas,
    'total', v_total,
    'proximo', case when v_n = v_limite then v_ultimo end
  );
end;
$$;
revoke all on function public.listar_eliminados_fila(uuid, text, text, text, text, text, jsonb, integer) from public, anon;
grant execute on function public.listar_eliminados_fila(uuid, text, text, text, text, text, jsonb, integer) to authenticated;
comment on function public.listar_eliminados_fila(uuid, text, text, text, text, text, jsonb, integer) is
  'Aba Eliminados da fila em páginas (a tela pede 50): vaga, modalidade, busca e ordem no banco, cursor estável, total do recorte; linhas no formato da fila. Leitor da Avaliação documental (analista: só as vagas dele).';

-- ─── 4. Acompanhamento das inscrições: o cargo gravado pelo job ────────────────────────────
create or replace function public.obter_acompanhamento_inscricoes(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_hoje constant date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  return json_build_object(
    'schema_version', 1,
    'hoje', v_hoje,
    'cronograma', coalesce((
      select json_agg(json_build_object('atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim) order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    -- O cargo: o que o job da pré-classificação gravou com a vaga (TB_PRE_CLASSIF_VAGA); vaga
    -- ainda sem pré-classificação, o do quadro do edital; sem ele, o nome do questionário da
    -- Empregare (coluna "SITUAÇÃO - <questionário>" do arquivo).
    'vagas', coalesce((
      select json_agg(json_build_object(
               'codigo', v."CO_VAGA",
               'cargo', coalesce(
                          case when pv."CO_VAGA" is not null
                               then nullif(concat_ws(' — ', pv."NO_CARGO", pv."NO_LOTACAO"), '')
                               else (select nullif(concat_ws(' — ', q."NO_CARGO", q."NO_LOTACAO"), '')
                                       from private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, v."CO_VAGA") q)
                          end,
                          (select btrim(substr(x, length('SITUAÇÃO - ') + 1))
                             from jsonb_array_elements_text(v."DS_COLUNA") x
                            where upper(x) like 'SITUAÇÃO - %' limit 1)),
               'ultima_carga', v."DT_ULTIMA_CARGA")
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
        left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA"
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'retratos', coalesce((
      select json_agg(json_build_object(
               'vaga', r."CO_VAGA", 'data', r."DT_RETRATO", 'inscritos', r."QT_INSCRITO",
               'finalizados', r."QT_FINALIZADO", 'aptos', r."QT_APTO", 'eliminados', r."QT_ELIMINADO",
               'previa', r."ST_PREVIA" = 'S', 'em', r."DT_ATUALIZACAO")
             order by r."DT_RETRATO", r."CO_VAGA")
        from public."TH_INSCRICAO_VAGA_EDITAL" r
       where r."CO_MONITORAMENTO" = p_edital and r."DT_RETRATO" >= v_hoje - 60), '[]'::json)
  );
end;
$$;

-- ─── 5. Índice da análise curricular pelo número do edital ─────────────────────────────────
create index if not exists "IN_ANALISECURR_AREANUMEDITAL"
  on public."TB_ANALISE_CURRICULAR" ("CO_AREA", private."FC_NUMERO_EDITAL"(edital))
  where ativo;
-- As estatísticas da expressão nova (sem elas o planejador não confia no índice).
analyze public."TB_ANALISE_CURRICULAR";

commit;
