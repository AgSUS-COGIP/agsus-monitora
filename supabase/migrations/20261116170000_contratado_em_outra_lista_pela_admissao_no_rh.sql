/*
  CONTRATADO EM OUTRA LISTA PELA ADMISSÃO NO RH (regra versão 2, 16/11/2026)

  Pedido: "tem pessoa dentro do mesmo processo seletivo contratada em listas diferentes".
  A regra (python/monitora/aprovados/contratacao.py) já decidia a linha da contratação pela
  convocação; quando a convocação não decidia, o caso ficava AMBÍGUO e contava duas vezes
  (4 pessoas: 80/2025 e 23/2025). Agora, sem decisão pela convocação, vale a única linha com a
  admissão conciliada com o RH (TB_ADMISSAO_CONCILIADA, 20261113210000), motivo ADMISSAO_NO_RH.

  O QUE MUDA
    1. TB_CONTRATACAO_APROVADO aceita o motivo ADMISSAO_NO_RH (CONTRATACAO e OUTRA_LISTA).
    2. contratacao_ler_aprovados(): cada linha Contratado leva `admitido` (tem admissão no RH).
       O formato continua schema_version 1 (o campo é novo, o resto igual).
    3. gravar_contratacao_dos_aprovados(): aceita a versão 1 ou 2 da regra.
  As decisões já gravadas (versão 1) ficam; o ambíguo é reavaliado em toda rodada do job.

  GUARDAS: md5 do corpo sem chr(13). Antes: 11b65b89f036c309f21bf41dd7ac577d (ler) e aff87527cf05786f4cd614f3065ffb90 (gravar), conferidos no banco
  em 16/11/2026. Depois: de50fc2d24a3cf9a6d919e7ef953736e e a9200f2dc75788ba1d1aff7eb2e1c1d2.

  Ensaio: supabase/ensaios/20261116170000_contratado_em_outra_lista_pela_admissao_no_rh.sql
  Rollback: supabase/rollback/20261116170000_contratado_em_outra_lista_pela_admissao_no_rh.sql (apaga do instantâneo as decisões ADMISSAO_NO_RH — o job as
  refaz como ambíguas —, volta as funções e as regras)
*/

begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_ler text := md5(replace((select prosrc from pg_proc where oid = 'public.contratacao_ler_aprovados()'::regprocedure), chr(13), ''));
  v_grv text := md5(replace((select prosrc from pg_proc where oid = 'public.gravar_contratacao_dos_aprovados(text, jsonb, uuid[])'::regprocedure), chr(13), ''));
begin
  if v_ler = 'de50fc2d24a3cf9a6d919e7ef953736e' and v_grv = 'a9200f2dc75788ba1d1aff7eb2e1c1d2' then
    raise exception 'A migration 20261116170000 já foi aplicada.';
  end if;
  if v_ler is distinct from '11b65b89f036c309f21bf41dd7ac577d' or v_grv is distinct from 'aff87527cf05786f4cd614f3065ffb90' then
    raise exception 'As funções do Contratado em outra lista mudaram depois de 16/11/2026 (md5 % / %): junte as mudanças antes.', v_ler, v_grv;
  end if;
end;
$guarda$;

-- 1. O instantâneo aceita o motivo novo.
alter table public."TB_CONTRATACAO_APROVADO" drop constraint "CK_CONTRATAPROV_TPMOTIVO";
alter table public."TB_CONTRATACAO_APROVADO" add constraint "CK_CONTRATAPROV_TPMOTIVO" check ("TP_MOTIVO" in (
  'UNICA_ALCANCADA', 'AMPLA_ALCANCADA', 'HERDADA', 'ADMISSAO_NO_RH', 'NENHUMA_ALCANCADA', 'MAIS_DE_UMA_AMPLA', 'NENHUMA_AMPLA'));
alter table public."TB_CONTRATACAO_APROVADO" drop constraint "CK_CONTRATAPROV_ESCOLHA";
alter table public."TB_CONTRATACAO_APROVADO" add constraint "CK_CONTRATAPROV_ESCOLHA" check (
  case "TP_SITUACAO"
    when 'AMBIGUO' then "CO_CANDIDATO_CONTRATACAO" is null
                    and "TP_MOTIVO" in ('NENHUMA_ALCANCADA', 'MAIS_DE_UMA_AMPLA', 'NENHUMA_AMPLA')
    when 'CONTRATACAO' then "CO_CANDIDATO_CONTRATACAO" = "CO_CANDIDATO_APROVADO"
                        and "TP_MOTIVO" in ('UNICA_ALCANCADA', 'AMPLA_ALCANCADA', 'HERDADA', 'ADMISSAO_NO_RH')
    else "CO_CANDIDATO_CONTRATACAO" is not null and "CO_CANDIDATO_CONTRATACAO" <> "CO_CANDIDATO_APROVADO"
         and "TP_MOTIVO" in ('UNICA_ALCANCADA', 'AMPLA_ALCANCADA', 'HERDADA', 'ADMISSAO_NO_RH')
  end);

-- 2. A leitura do job diz se a linha tem a admissão no RH.
CREATE OR REPLACE FUNCTION public.contratacao_ler_aprovados()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with vigentes as (
    select l.id, l.edital_id::uuid as edital, m."CO_AREA" as area
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente is true
       and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
  )
  select jsonb_build_object(
    'schema_version', 1,
    -- Toda linha com status das listas vigentes (ativas ou não: o KPI conta as duas): as Contratado
    -- com o vínculo e o candidato anterior; as outras, para o alcance da convocação de cada vaga.
    'linhas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'lista', c.lista_id, 'edital', v.edital, 'area', v.area,
          'vaga', c.codigo_vaga, 'modalidade', c.modalidade, 'classificacao', c.classificacao,
          'status', c.status,
          'vinculo', case when c.status = 'Contratado' then private."FC_VINCULO_DA_MATRICULA"(c.matricula) end,
          'anterior', case when c.status = 'Contratado' then c."CO_CANDIDATO_ANTERIOR" end,
          -- Regra v2 (20261116170000): a linha tem a admissão conciliada com o RH?
          'admitido', case when c.status = 'Contratado' then exists (
            select 1 from public."TB_ADMISSAO_CONCILIADA" a where a."CO_CANDIDATO_APROVADO" = c.id) end)
          order by c.id), '[]'::jsonb)
        from public."TB_CANDIDATO_APROVADO" c
        join vigentes v on v.id = c.lista_id
       where c.removido_em is null and c.status is not null
    ),
    'instantaneo', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'candidato', x."CO_CANDIDATO_APROVADO", 'edital', x."CO_MONITORAMENTO", 'vinculo', x."DS_VINCULO",
          'situacao', x."TP_SITUACAO", 'contratacao', x."CO_CANDIDATO_CONTRATACAO", 'motivo', x."TP_MOTIVO",
          'texto', x."DS_MOTIVO", 'base', x."DS_BASE", 'versao', x."NU_VERSAO_REGRA")
          order by x."CO_CANDIDATO_APROVADO"), '[]'::jsonb)
        from public."TB_CONTRATACAO_APROVADO" x
    )
  );
$function$;

-- 3. A gravação aceita as decisões da versão 2.
CREATE OR REPLACE FUNCTION public.gravar_contratacao_dos_aprovados(p_execucao text, p_decisoes jsonb, p_remover uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_decisoes jsonb := coalesce(p_decisoes, '[]'::jsonb);
  v_editais uuid[];
  v_gravadas integer := 0;
  v_removidas integer := 0;
  v_invalida text;
begin
  if p_execucao is null or p_execucao !~ '^contr-[0-9]{8}T[0-9]{6}-[0-9a-f]{8}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(v_decisoes) <> 'array' or jsonb_array_length(v_decisoes) > 2000
     or coalesce(array_length(p_remover, 1), 0) > 5000 then
    raise exception 'Lote inválido (até 2000 decisões e 5000 remoções)' using errcode = '22023';
  end if;

  drop table if exists t_decisao;
  create temporary table t_decisao on commit drop as
    select (d ->> 'candidato')::uuid as candidato, (d ->> 'edital')::uuid as edital, d ->> 'vinculo' as vinculo,
           d ->> 'situacao' as situacao, (d ->> 'contratacao')::uuid as contratacao, d ->> 'motivo' as motivo,
           d ->> 'texto' as texto, d ->> 'base' as base, (d ->> 'versao')::smallint as versao
      from jsonb_array_elements(v_decisoes) d;

  -- O banco só valida: cada linha é Contratado numa lista vigente do edital, com aquela
  -- matrícula, e a base é o conjunto de hoje das linhas Contratado da matrícula no edital.
  with atuais as (
    select c.id, l.edital_id::uuid as edital, private."FC_VINCULO_DA_MATRICULA"(c.matricula) as vinculo
      from public."TB_CANDIDATO_APROVADO" c
      join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
     where c.removido_em is null and c.status = 'Contratado'
       and l.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ), bases as (
    select a.edital, a.vinculo, string_agg(a.id::text, ',' order by a.id::text) as base
      from atuais a
     where (a.edital, a.vinculo) in (select edital, vinculo from t_decisao)
     group by 1, 2
  )
  select coalesce(
           (select 'duplicada' from t_decisao group by candidato having count(*) > 1 limit 1),
           (select 'campos' from t_decisao
             where candidato is null or edital is null or vinculo is null or situacao is null or motivo is null
                or texto is null or base is null or versao is null or versao not in (1, 2) limit 1),
           (select 'linha' from t_decisao d
             where not exists (select 1 from atuais a
                                where a.id = d.candidato and a.edital = d.edital and a.vinculo = d.vinculo) limit 1),
           (select 'base' from t_decisao d
             where d.base is distinct from (select b.base from bases b where b.edital = d.edital and b.vinculo = d.vinculo)
                or position(',' in d.base) = 0 limit 1),
           (select 'escolha' from t_decisao d
             where d.contratacao is not null
               and not exists (select 1 from atuais a
                                where a.id = d.contratacao and a.edital = d.edital and a.vinculo = d.vinculo) limit 1),
           (select 'grupo' from t_decisao d
             group by d.edital, d.vinculo
            having count(distinct coalesce(d.contratacao::text, '-')) > 1
                or count(distinct d.motivo) > 1
                or count(*) <> cardinality(string_to_array(min(d.base), ',')) limit 1))
    into v_invalida;
  if v_invalida is not null then
    raise exception 'Decisão recusada (%)', v_invalida using errcode = '22023';
  end if;

  select array_agg(distinct e) into v_editais from (
    select x."CO_MONITORAMENTO" as e from public."TB_CONTRATACAO_APROVADO" x
     where x."CO_CANDIDATO_APROVADO" = any (coalesce(p_remover, '{}'))
    union select edital from t_decisao) s;

  delete from public."TB_CONTRATACAO_APROVADO" x where x."CO_CANDIDATO_APROVADO" = any (coalesce(p_remover, '{}'));
  get diagnostics v_removidas = row_count;

  -- Os CHECK da tabela recusam situação, motivo e escolha que não combinam.
  insert into public."TB_CONTRATACAO_APROVADO" as x (
    "CO_CANDIDATO_APROVADO", "CO_MONITORAMENTO", "DS_VINCULO", "TP_SITUACAO", "CO_CANDIDATO_CONTRATACAO",
    "TP_MOTIVO", "DS_MOTIVO", "DS_BASE", "NU_VERSAO_REGRA", "CO_EXECUCAO", "DT_DECISAO")
  select d.candidato, d.edital, d.vinculo, d.situacao, d.contratacao, d.motivo, btrim(d.texto), d.base, d.versao,
         p_execucao, now()
    from t_decisao d
  on conflict ("CO_CANDIDATO_APROVADO") do update set
    "CO_MONITORAMENTO" = excluded."CO_MONITORAMENTO", "DS_VINCULO" = excluded."DS_VINCULO",
    "TP_SITUACAO" = excluded."TP_SITUACAO", "CO_CANDIDATO_CONTRATACAO" = excluded."CO_CANDIDATO_CONTRATACAO",
    "TP_MOTIVO" = excluded."TP_MOTIVO", "DS_MOTIVO" = excluded."DS_MOTIVO", "DS_BASE" = excluded."DS_BASE",
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA", "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    "DT_DECISAO" = excluded."DT_DECISAO";
  get diagnostics v_gravadas = row_count;

  -- Os contratados dos editais tocados e o pacote da Lista de aprovados das áreas deles.
  perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(e) from unnest(coalesce(v_editais, '{}')) e;
  perform private."FC_MARCAR_CACHE"(
    array['APROVADOS'],
    array(select distinct m."CO_AREA" from public."TB_MONITORAMENTO_INDIGENA" m where m.id = any (coalesce(v_editais, '{}'))),
    'TB_CONTRATACAO_APROVADO');

  return jsonb_build_object('ok', true, 'gravadas', v_gravadas, 'removidas', v_removidas,
                            'editais', coalesce(cardinality(v_editais), 0));
end;
$function$;

comment on function public.contratacao_ler_aprovados() is 'Job "Contratado em outra lista" (Python, só service_role): as linhas com status das listas de aprovados vigentes (id, lista, edital, área, vaga, modalidade, posição, status; nas Contratado, o hash da matrícula e o candidato anterior) e o instantâneo TB_CONTRATACAO_APROVADO. Sem nome, CPF nem matrícula. 20261024120000. Regra v2 (20261116170000): cada linha Contratado diz se tem a admissão conciliada com o RH (admitido).';

do $confere$
begin
  if md5(replace((select prosrc from pg_proc where oid = 'public.contratacao_ler_aprovados()'::regprocedure), chr(13), '')) <> 'de50fc2d24a3cf9a6d919e7ef953736e'
     or md5(replace((select prosrc from pg_proc where oid = 'public.gravar_contratacao_dos_aprovados(text, jsonb, uuid[])'::regprocedure), chr(13), '')) <> 'a9200f2dc75788ba1d1aff7eb2e1c1d2' then
    raise exception 'O corpo aplicado não tem o md5 esperado.';
  end if;
end;
$confere$;

commit;
