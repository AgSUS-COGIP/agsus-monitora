/*
  ELIMINADOS DA TRIAGEM FILTRÁVEIS POR MOTIVO (aba Eliminados da Triagem).

  listar_pre_classificacao ganha p_motivo (o código do motivo de eliminação,
  com padrão nulo: quem chama pelo nome continua igual) e, nos eliminados,
  devolve por_motivo — quantos eliminados por motivo no recorte (vaga e
  busca), sem o filtro de motivo, para a tela montar as opções. Só leitura:
  nada é gravado, nenhum cálculo muda.

  Depende de 20261029120000_triagem_e_eliminados_em_paginas.sql.
  Ensaio: supabase/ensaios/20261029210000_eliminados_da_triagem_por_motivo.sql
  Rollback: supabase/rollback/20261029210000_eliminados_da_triagem_por_motivo.sql
*/
begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer)') is null then
    raise exception 'listar_pre_classificacao (20261029120000) ausente: aplicar antes.';
  end if;
end;
$$;

-- A assinatura ganha p_motivo (com padrão): quem chama pelo nome continua igual.
drop function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer);

create or replace function public.listar_pre_classificacao(
  p_edital uuid,
  p_vaga text default null,
  p_grupo text default 'CLASSIFICADOS',
  p_busca text default null,
  p_apos jsonb default null,
  p_limite integer default 50,
  p_motivo text default null
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
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_por_motivo jsonb;
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
           coalesce(c."CO_CANDIDATO_EMPREGARE"::text, '') collate "C" as codigo,
           a."CO_MOTIVO_ELIMINACAO" as motivo_codigo, a."DS_MOTIVO_ELIMINACAO" as motivo
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
  -- O motivo (só nos eliminados) recorta a lista; as opções do filtro contam sem ele.
  filtrado as materialized (
    select r.* from recorte r
     where v_motivo is null or r.motivo_codigo = v_motivo
  ),
  pagina as (
    select r.*
      from filtrado r
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
  select (select count(*) from filtrado),
         case when p_vaga is null then
           (select coalesce(jsonb_object_agg(x.vaga, x.n), '{}'::jsonb)
              from (select r.vaga, count(*) as n from filtrado r group by r.vaga) x) end,
         case when v_grupo = 'ELIMINADOS' then
           (select coalesce(jsonb_agg(jsonb_build_object('codigo', x.motivo_codigo, 'motivo', x.motivo, 'total', x.n)
                                      order by x.n desc, x.motivo_codigo), '[]'::jsonb)
              from (select r.motivo_codigo, min(r.motivo) as motivo, count(*) as n
                      from recorte r where r.motivo_codigo is not null group by r.motivo_codigo) x) end,
         (select coalesce(jsonb_agg(l.linha order by l.vaga collate "C", l.grupo, l.posicao, l.codigo), '[]'::jsonb) from linhas l),
         (select jsonb_build_object('vaga', l.vaga, 'grupo', l.grupo, 'posicao', l.posicao, 'codigo', l.codigo)
            from linhas l order by l.vaga collate "C" desc, l.grupo desc, l.posicao desc, l.codigo desc limit 1),
         (select count(*) from linhas)
    into v_total, v_por_vaga, v_por_motivo, v_linhas, v_ultimo, v_n;

  return json_build_object(
    'schema_version', 1,
    'edital', p_edital,
    'vaga', p_vaga,
    'grupo', v_grupo,
    'candidatos', v_linhas,
    'total', v_total,
    'por_vaga', v_por_vaga,
    -- Só nos eliminados: quantos por motivo no recorte (vaga e busca), sem o filtro de motivo.
    'por_motivo', v_por_motivo,
    'motivo', v_motivo,
    -- Página cheia: pode haver mais (a próxima chamada passa p_apos = proximo).
    'proximo', case when v_n = v_limite then v_ultimo end
  );
end;
$$;
revoke all on function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer, text) from public, anon;
grant execute on function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer, text) to authenticated;
comment on function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer, text) is
  'Inscritos da pré-classificação em páginas (até 500; a tela pede 50) por cursor estável: CLASSIFICADOS, ELIMINADOS ou PODE_INCLUIR, de uma vaga ou do edital, com busca e total; nos eliminados, p_motivo (código do motivo) recorta e por_motivo conta as opções (20261029210000). Coordenação do edital.';

commit;
