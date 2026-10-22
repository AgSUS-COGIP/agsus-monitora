/*
  ESPELHOS DE NOTA EM MASSA

  Por quê: a coordenação precisa imprimir o espelho de nota (PR #467/#471) de
  muitos candidatos de uma vez (Avaliação documental › Ações da coordenação ›
  "Espelhos de nota em massa"). Abrir a ficha de cada um (obter_ficha_analise:
  respostas, leituras, anexos, histórico) seria dezenas de KB por candidato.

  O QUE MUDA
    1. private."FC_LANCAMENTO_DO_ESPELHO"(lançamento): o lançamento gravado sem o
       que o espelho não usa (o empregador de cada vínculo e o nome de cada curso;
       a conta não lê nenhum dos dois).
    2. public.obter_espelhos_de_nota(...): só o necessário para a MESMA montagem
       do espelho individual (src/lib/avaliacao-documental/espelho-de-nota.ts)
       das fichas CONCLUÍDAS do edital: nome, código, vaga e cargo, modalidade da
       pré-classificação, ART, resultado e nota final gravados, a declarada por
       critério gravada na conclusão (DS_RESULTADO.declarada), o lançamento enxuto
       (~0,9 KB) e a chave da regra; a regra (DS_CONFIGURACAO da versão usada na
       conclusão) vem uma vez por chave (p_regras = as que a tela já tem). Em
       páginas pela chave da ficha (p_apos = o "proximo" da anterior; até 200),
       para caber no statement_timeout de authenticated (8 s). Filtros: vagas
       (nulo = todas), APTOS / INAPTOS / TODOS, ou a lista de códigos do
       candidato na Empregare (ignora vagas e filtro; na primeira página, os
       códigos com ficha ainda não concluída vêm em "nao_concluidos").
       Só o administrador e a coordenação do edital (FC_PAPEL_AVALIACAO =
       COORDENADOR, a mesma checagem das ações da coordenação). Nada é gravado.

  Ensaio: supabase/ensaios/20261015180000_espelhos_de_nota_em_massa.sql
  Rollback: supabase/rollback/20261015180000_espelhos_de_nota_em_massa.sql
*/

begin;

set local lock_timeout = '5s';

create or replace function private."FC_LANCAMENTO_DO_ESPELHO"(p_lancamento jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select case
           when jsonb_typeof(p_lancamento) is distinct from 'object' then '{}'::jsonb
           else p_lancamento
                || case when jsonb_typeof(p_lancamento -> 'vinculos') = 'array'
                        then jsonb_build_object('vinculos', coalesce((
                               select jsonb_agg(case when jsonb_typeof(v) = 'object' then v - 'empregador' else v end
                                                order by o)
                                 from jsonb_array_elements(p_lancamento -> 'vinculos') with ordinality x(v, o)), '[]'::jsonb))
                        else '{}'::jsonb end
                || case when jsonb_typeof(p_lancamento -> 'cursos') = 'array'
                        then jsonb_build_object('cursos', coalesce((
                               select jsonb_agg(case when jsonb_typeof(c) = 'object' then c - 'nome' else c end
                                                order by o)
                                 from jsonb_array_elements(p_lancamento -> 'cursos') with ordinality x(c, o)), '[]'::jsonb))
                        else '{}'::jsonb end
         end;
$function$;
comment on function private."FC_LANCAMENTO_DO_ESPELHO"(jsonb) is
  'O lançamento da ficha (DS_LANCAMENTO) para o espelho de nota em massa: sem o empregador de cada vínculo nem o nome de cada curso (a conta da ficha não os lê; o espelho não os mostra). Desde 20261015180000.';
revoke all on function private."FC_LANCAMENTO_DO_ESPELHO"(jsonb) from public, anon, authenticated;

create or replace function public.obter_espelhos_de_nota(
  p_edital uuid,
  p_vagas text[] default null,
  p_filtro text default 'TODOS',
  p_codigos text[] default null,
  p_apos text default null,
  p_limite integer default 200,
  p_regras text[] default null
)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3);
  v_limite integer := least(greatest(coalesce(p_limite, 200), 1), 200);
  v_filtro text := upper(coalesce(nullif(btrim(p_filtro), ''), 'TODOS'));
  v_codigos text[];
  v_apos uuid;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_fichas json;
  v_regras json;
  v_ultimo uuid;
  v_n integer;
  v_nao_concluidos json;
begin
  if private."FC_PAPEL_AVALIACAO"(p_edital) is distinct from 'COORDENADOR' then
    raise exception 'Só o administrador e a coordenação do edital geram os espelhos de nota em massa'
      using errcode = '42501';
  end if;
  if v_filtro not in ('TODOS', 'APTOS', 'INAPTOS') then
    raise exception 'Filtro inválido: use TODOS, APTOS ou INAPTOS' using errcode = '22023';
  end if;
  if p_codigos is not null then
    select coalesce(array_agg(distinct btrim(c)), '{}') into v_codigos
      from unnest(p_codigos) c where nullif(btrim(c), '') is not null;
    if cardinality(v_codigos) > 5000 then
      raise exception 'No máximo 5.000 códigos por vez' using errcode = '22023';
    end if;
  end if;
  if nullif(btrim(p_apos), '') is not null then
    begin
      v_apos := btrim(p_apos)::uuid;
    exception when invalid_text_representation then
      raise exception 'p_apos inválido' using errcode = '22023';
    end;
  end if;

  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;

  with pagina as (
    select f."CO_FICHA_ANALISE" as id, f."CO_VAGA", f."CO_REGRA_ANALISE", f."NU_VERSAO_REGRA",
           f."TP_RESULTADO", f."VL_NOTA_FINAL", f."DS_LANCAMENTO", f."DS_RESULTADO",
           c."CO_CANDIDATO_EMPREGARE", c."NO_CANDIDATO", f."CO_EMPREGARE_CANDIDATO"
      from public."TB_FICHA_ANALISE" f
      join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_MONITORAMENTO" = p_edital
       and f."TP_SITUACAO" = 'CONCLUIDA'
       and (v_apos is null or f."CO_FICHA_ANALISE" > v_apos)
       and (case
              when v_codigos is not null then c."CO_CANDIDATO_EMPREGARE"::text = any (v_codigos)
              else (p_vagas is null or f."CO_VAGA" = any (p_vagas))
                   and (v_filtro = 'TODOS'
                        or (v_filtro = 'APTOS' and f."TP_RESULTADO" = 'APTO')
                        or (v_filtro = 'INAPTOS' and f."TP_RESULTADO" is distinct from 'APTO'))
            end)
     order by f."CO_FICHA_ANALISE"
     limit v_limite
  )
  select coalesce(json_agg(json_build_object(
           'id', p.id,
           'codigo', p."CO_CANDIDATO_EMPREGARE",
           'nome', p."NO_CANDIDATO",
           'vaga', p."CO_VAGA",
           'cargo', pv."NO_CARGO",
           'modalidade', pc."NO_MODALIDADE",
           'posicao', pc."NU_POSICAO",
           'art', pc."VL_ART",
           'resultado', p."TP_RESULTADO",
           'nota_final', p."VL_NOTA_FINAL",
           'regra', p."CO_REGRA_ANALISE" || ':' || p."NU_VERSAO_REGRA",
           'declarada', case when jsonb_typeof(p."DS_RESULTADO" -> 'declarada') = 'object'
                             then p."DS_RESULTADO" -> 'declarada' else '{}'::jsonb end,
           'lancamento', private."FC_LANCAMENTO_DO_ESPELHO"(p."DS_LANCAMENTO"))
           order by p.id), '[]'::json),
         max(p.id::text)::uuid,
         count(*),
         (select json_object_agg(r.chave, h."DS_CONFIGURACAO")
            from (select distinct p2."CO_REGRA_ANALISE", p2."NU_VERSAO_REGRA",
                         p2."CO_REGRA_ANALISE" || ':' || p2."NU_VERSAO_REGRA" as chave
                    from pagina p2) r
            join public."TH_REGRA_ANALISE" h
              on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_REGRA"
           where p_regras is null or not (r.chave = any (p_regras)))
    into v_fichas, v_ultimo, v_n, v_regras
    from pagina p
    left join public."TB_PRE_CLASSIFICACAO" pc
      on pc."CO_MONITORAMENTO" = p_edital and pc."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO"
    left join public."TB_PRE_CLASSIF_VAGA" pv
      on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = p."CO_VAGA";

  -- Os códigos colados com ficha no edital que ainda não está concluída (só na primeira página).
  if v_codigos is not null and v_apos is null then
    select coalesce(json_agg(json_build_object('codigo', c."CO_CANDIDATO_EMPREGARE", 'situacao', f."TP_SITUACAO")
                             order by c."CO_CANDIDATO_EMPREGARE"), '[]'::json)
      into v_nao_concluidos
      from public."TB_FICHA_ANALISE" f
      join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_MONITORAMENTO" = p_edital
       and f."TP_SITUACAO" is distinct from 'CONCLUIDA'
       and c."CO_CANDIDATO_EMPREGARE"::text = any (v_codigos);
  end if;

  return json_build_object(
    'schema_version', 1,
    'edital', json_build_object('id', p_edital, 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital),
                                'area', coalesce(v_m."CO_AREA", v_area)),
    'documental', private."FC_DOCUMENTAL_DO_EDITAL"(p_edital),
    'regras', coalesce(v_regras, '{}'::json),
    'fichas', v_fichas,
    'nao_concluidos', v_nao_concluidos,
    -- Página cheia: pode haver mais (a próxima chamada passa p_apos = proximo).
    'proximo', case when v_n = v_limite then v_ultimo end
  );
end;
$function$;

comment on function public.obter_espelhos_de_nota(uuid, text[], text, text[], text, integer, text[]) is
  'Espelhos de nota em massa (20261015180000): das fichas CONCLUÍDAS do edital, só o que a montagem do espelho individual usa (nome, código, vaga, cargo, modalidade e ART da pré-classificação, resultado e nota final gravados, a declarada por critério de DS_RESULTADO, o lançamento sem empregador nem nome de curso: FC_LANCAMENTO_DO_ESPELHO, e a chave regra:versão) e a configuração de cada regra usada que não está em p_regras. Páginas de até 200 pela chave da ficha (p_apos = "proximo" da anterior; nulo = acabou). Filtros: p_vagas (nulo = todas) e p_filtro TODOS/APTOS/INAPTOS, ou p_codigos (códigos do candidato na Empregare, até 5.000; ignora vagas e filtro; na primeira página, nao_concluidos = os códigos com ficha não concluída). Só administrador e coordenação do edital (FC_PAPEL_AVALIACAO = COORDENADOR; 42501). Não grava nada.';

revoke all on function public.obter_espelhos_de_nota(uuid, text[], text, text[], text, integer, text[]) from public, anon;
grant execute on function public.obter_espelhos_de_nota(uuid, text[], text, text[], text, integer, text[]) to authenticated;

commit;
