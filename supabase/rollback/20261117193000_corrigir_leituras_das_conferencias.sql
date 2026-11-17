/*
  ROLLBACK de 20261117193000_corrigir_leituras_das_conferencias: as três leituras das conferências voltam ao corpo e ao comentário de antes,
  copiados do retrato supabase/esquema-atual.sql de 17/11/2026 (letra por letra). Não há dado a
  desfazer (só leitura). Guarda: só roda se as três estiverem com o corpo desta migration (md5).
  Depois: delete from public.migracoes_aplicadas where caminho = 'migrations/20261117193000_corrigir_leituras_das_conferencias.sql';
  O job volta a não ler "admitido" nem "versao_regra" (as regras novas ficam sem efeito).
*/

begin;

do $$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.conferencia_ler_analises(uuid, integer)')))
       is distinct from 'b424ae886263712063654d76056a3d45'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('public.conferencia_ler_aprovados()')))
       is distinct from '10beb76a25ffebea24aee09a4d7c71d2'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('public.conferencia_ler_listas_e_quadros()')))
       is distinct from '7189179d116aca01264b285c9a1f17e6' then
    raise exception 'As leituras das conferências não estão com o corpo de 20261117193000_corrigir_leituras_das_conferencias: nada a desfazer, ou mudaram depois.';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.conferencia_ler_analises(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 5000) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 5000), 1), 10000);
  v_linhas jsonb;
  v_ultimo uuid;
  v_qt integer;
begin
  -- 20261103181500: "vaga" e "nome_vaga" para o robô conferir a vaga sem quadro aqui.
  with pagina as (
    select a.id, a."CO_AREA" as area, private."FC_NUMERO_EDITAL"(a.edital) as numero, a.id_origem,
           a.status_consolidado, a.nota_final_ajustada, a.pontuacao_escolaridade,
           a.pontuacao_cursos_aperfeicoamento, a.pontuacao_experiencia_profissional,
           a.pontuacao_criterio_etnico, a.data_analise, a.updated_at, a.codigo_vaga, a.nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
       and (p_apos is null or a.id > p_apos)
     order by a.id
     limit v_limite
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'area', p.area, 'edital', e.edital_id, 'numero', p.numero,
           'codigo', nullif(btrim(p.id_origem), ''), 'status', p.status_consolidado,
           'nota', p.nota_final_ajustada, 'formacao', p.pontuacao_escolaridade,
           'cursos', p.pontuacao_cursos_aperfeicoamento, 'experiencia', p.pontuacao_experiencia_profissional,
           'etnico', p.pontuacao_criterio_etnico, 'data_analise', p.data_analise,
           'inscricao', (select (min(c."DT_CANDIDATURA") at time zone 'America/Sao_Paulo')::date
                           from public."TB_EMPREGARE_CANDIDATO" c
                          where c."CO_CANDIDATO_EMPREGARE" = nullif(btrim(p.id_origem), '')),
           'atualizado', p.updated_at,
           'vaga', nullif(btrim(p.codigo_vaga), ''),
           'nome_vaga', case when nullif(btrim(p.nome_vaga), '') is not null then p.nome_vaga end) order by p.id), '[]'::jsonb),
         max(p.id::text)::uuid, count(*)
    into v_linhas, v_ultimo, v_qt
    from pagina p
    left join private."FC_EDITAIS_POR_NUMERO"() e on e.area = p.area and e.numero = p.numero;

  return jsonb_build_object(
    'schema_version', 1,
    'linhas', v_linhas,
    'proximo', case when v_qt = v_limite then v_ultimo end);
end;
$$;

COMMENT ON FUNCTION public.conferencia_ler_analises(p_apos uuid, p_limite integer) IS 'Conferências (job Python): uma página (até 10000, pela ordem do id, depois de p_apos) das análises curriculares ativas, só com id, área, edital, código do candidato, status, notas, datas, a data da candidatura na Empregare e o código e o nome da vaga (20261103181500). Sem nome nem CPF. proximo = cursor da página seguinte (nulo na última). Só service_role.';

CREATE OR REPLACE FUNCTION public.conferencia_ler_aprovados() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  with vigentes as (
    select l.id, l.edital_id, l."TP_ORIGEM",
           case when l.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then l.edital_id::uuid end as edital
      from public."TB_LISTA_APROVADO" l
     where l.vigente is true and coalesce(l.ativo, true)
       and not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" t
                        where t.id::text = l.edital_id and private."FC_EH_TREINAMENTO"(t."ST_TREINAMENTO"))
  ),
  candidatos as (
    select c.id, c.lista_id, v.edital, m."CO_AREA" as area, c.status, c."DT_CONVOCACAO",
           encode(sha256(convert_to('conferencia:' || coalesce(
             'cod:' || nullif(btrim(a.id_origem), ''),
             'nome:' || lower(regexp_replace(btrim(c.nome), '\s+', ' ', 'g'))), 'UTF8')), 'hex') as pessoa,
           -- O vínculo é a matrícula (uma por contratação), em hash: a matrícula não sai do banco.
           encode(sha256(convert_to('vinculo:' || nullif(ltrim(upper(
             regexp_replace(coalesce(c.matricula, ''), '[^0-9A-Za-z]', '', 'g')), '0'), ''), 'UTF8')), 'hex') as vinculo
      from public."TB_CANDIDATO_APROVADO" c
      join vigentes v on v.id = c.lista_id
      left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v.edital
      left join public."TB_ANALISE_CURRICULAR" a on a.id = c."CO_ANALISE_CURRICULAR"
     where c.removido_em is null and c.status in ('Convocado', 'Contratado')
       -- A linha que o job dá como "em outra lista" (20261024120000) não é mais contratação.
       and not private."FC_EM_OUTRA_LISTA"(c.id)
  ),
  publicacoes as (
    select distinct on (h."CO_LISTA_APROVADO") h."CO_LISTA_APROVADO", h."DS_PENDENCIA"
      from public."TH_PUBLICACAO_APROVADO" h
      join vigentes v on v.id = h."CO_LISTA_APROVADO"
     where v."TP_ORIGEM" = 'CLASSIFICACAO'
     order by h."CO_LISTA_APROVADO", h."DT_PUBLICACAO" desc
  )
  select jsonb_build_object(
    'schema_version', 1,
    'candidatos', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'lista', c.lista_id, 'edital', c.edital, 'area', c.area, 'status', c.status,
          'convocado_em', c."DT_CONVOCACAO", 'pessoa', c.pessoa, 'vinculo', c.vinculo)), '[]'::jsonb)
        from candidatos c
    ),
    'pendencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'lista', p."CO_LISTA_APROVADO", 'edital', v.edital, 'area', m."CO_AREA",
          'candidatos', (
            select coalesce(jsonb_agg(o.id order by o.id), '[]'::jsonb)
              from jsonb_array_elements(p."DS_PENDENCIA") x
              join public."TB_CANDIDATO_APROVADO" o
                on o.id::text = x ->> 'candidato_id'
             where o.removido_em is null
               and (o.status is not null or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                    or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null)
               and not exists (select 1 from public."TB_CANDIDATO_APROVADO" n
                                where n.lista_id = p."CO_LISTA_APROVADO" and n.removido_em is null
                                  and n."CO_CANDIDATO_ANTERIOR" = o.id)))), '[]'::jsonb)
        from publicacoes p
        join vigentes v on v.id = p."CO_LISTA_APROVADO"
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v.edital
    )
  );
$_$;

COMMENT ON FUNCTION public.conferencia_ler_aprovados() IS 'Conferências (job Python): convocados e contratados das listas de aprovados vigentes (id, lista, edital, status, data da convocação, um hash da pessoa — código do candidato ou nome normalizado — e um hash do vínculo — a matrícula normalizada —, para achar a mesma pessoa com duas matrículas no mesmo edital e a mesma matrícula em duas linhas) e, das listas publicadas pela Classificação, as pendências da publicação ainda sem desfecho (ids). Sem nome, CPF nem matrícula. Só service_role.';

CREATE OR REPLACE FUNCTION public.conferencia_ler_listas_e_quadros() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  -- 20261103181500: a leitura da classificação das conferências sem as análises. A última
  -- atualização das análises e as vagas sem quadro saem das páginas de conferencia_ler_analises,
  -- no robô (scripts/conferencias/regras.py, python/monitora/classificacao/quadro_da_vaga.py).
  with ultimas as (
    select distinct on (l."CO_MONITORAMENTO", l."TP_LISTA")
           l."CO_LISTA_CLASSIFICACAO", l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO",
           l."QT_PENDENCIA", l."ST_PUBLICADA", l."DS_RESULTADO"
      from public."TB_LISTA_CLASSIFICACAO" l
     where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
     order by l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO" desc, l."CO_LISTA_CLASSIFICACAO" desc
  )
  select jsonb_build_object(
    'schema_version', 1,
    'listas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', u."CO_LISTA_CLASSIFICACAO", 'edital', u."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', u."TP_LISTA", 'gerada_em', u."DT_GERACAO", 'pendencias', u."QT_PENDENCIA",
          'publicada', u."ST_PUBLICADA" = 'S',
          'vagas_pendentes', (select coalesce(jsonb_agg(distinct p ->> 'vaga'), '[]'::jsonb)
                                from jsonb_array_elements(case when jsonb_typeof(u."DS_RESULTADO" -> 'pendencias') = 'array'
                                                               then u."DS_RESULTADO" -> 'pendencias' else '[]'::jsonb end) p
                               where p ->> 'vaga' is not null))), '[]'::jsonb)
        from ultimas u
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = u."CO_MONITORAMENTO"
    ),
    'ajustes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', j."CO_AJUSTE_PONTUACAO", 'edital', j."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', j."TP_LISTA", 'aprovado_em', j."DT_APROVACAO")), '[]'::jsonb)
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = j."CO_MONITORAMENTO"
       where j."TP_SITUACAO" = 'APROVADO'
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
    ),
    'quadros', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', q."CO_QUADRO_VAGA", 'edital', q."CO_MONITORAMENTO", 'cargo', q."NO_CARGO", 'lotacao', q."NO_LOTACAO")
          order by q."CO_MONITORAMENTO", q."CO_QUADRO_VAGA"), '[]'::jsonb)
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."ST_REGISTRO_ATIVO" = 'S'
    )
  );
$$;

COMMENT ON FUNCTION public.conferencia_ler_listas_e_quadros() IS 'Conferências (job Python, só service_role): a última lista de classificação de cada edital e tipo (fora do treinamento) com as vagas com empate pendente, os ajustes de recurso aprovados e as linhas ativas do quadro de vagas (id, edital, cargo, lotação), cruas. A vaga sem linha no quadro e a lista final desatualizada são conferidas no robô, com as páginas de conferencia_ler_analises (20261103181500).';

commit;
