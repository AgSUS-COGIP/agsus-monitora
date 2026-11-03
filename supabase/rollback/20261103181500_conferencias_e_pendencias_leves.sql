/*
  Rollback de 20261103181500_conferencias_e_pendencias_leves.

  Volta conferencia_ler_analises (sem "vaga" e "nome_vaga"), pendencias_ler_aprovados() sem
  argumentos e FC_DESATIVAR_AUSENTES_DA_PLANILHA (com o NOT EXISTS) como estavam no banco em
  03/11/2026, e apaga conferencia_ler_listas_e_quadros. Antes, volte o robô das conferências e o
  das pendências para a versão anterior (ele chama a RPC nova e pendencias_ler_aprovados com
  p_limite) e, se 20261103182000 foi aplicada, rode o rollback dela primeiro.
*/
begin;

set local lock_timeout = '10s';

drop function if exists public.conferencia_ler_listas_e_quadros();

CREATE OR REPLACE FUNCTION public.conferencia_ler_analises(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 5000)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 5000), 1), 10000);
  v_linhas jsonb;
  v_ultimo uuid;
  v_qt integer;
begin
  with pagina as (
    select a.id, a."CO_AREA" as area, private."FC_NUMERO_EDITAL"(a.edital) as numero, a.id_origem,
           a.status_consolidado, a.nota_final_ajustada, a.pontuacao_escolaridade,
           a.pontuacao_cursos_aperfeicoamento, a.pontuacao_experiencia_profissional,
           a.pontuacao_criterio_etnico, a.data_analise, a.updated_at
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
           'atualizado', p.updated_at) order by p.id), '[]'::jsonb),
         max(p.id::text)::uuid, count(*)
    into v_linhas, v_ultimo, v_qt
    from pagina p
    left join private."FC_EDITAIS_POR_NUMERO"() e on e.area = p.area and e.numero = p.numero;

  return jsonb_build_object(
    'schema_version', 1,
    'linhas', v_linhas,
    'proximo', case when v_qt = v_limite then v_ultimo end);
end;
$function$;

comment on function public.conferencia_ler_analises(uuid, integer) is
  'Conferências (job Python): uma página (até 10000, pela ordem do id, depois de p_apos) das análises curriculares ativas, só com id, área, edital, código do candidato, status, notas, datas e a data da candidatura na Empregare. Sem nome nem CPF. proximo = cursor da página seguinte (nulo na última). Só service_role.';

drop function if exists public.pendencias_ler_aprovados(uuid, integer);

CREATE OR REPLACE FUNCTION public.pendencias_ler_aprovados()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET work_mem TO '16MB'
AS $function$
  with listas as materialized (
    select l.id, l.edital_id::uuid as edital, m."CO_AREA" as area, coalesce(l.ativo, false) as ativo,
           (row_number() over (order by l.id) - 1)::integer as i
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente is true
       and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
  ), linhas as (
    -- Sem nome, CPF nem matrícula: hashes curtos do nome, do código do candidato e da matrícula.
    select c.id, li.i, c.codigo_vaga, c.modalidade, c.classificacao, c.status, c."DT_CONVOCACAO",
           left(encode(sha256(convert_to('pendencia:nome:' || lower(regexp_replace(btrim(c.nome), '\s+', ' ', 'g')),
                                         'UTF8')), 'hex'), 16) as nome,
           left(encode(sha256(convert_to('pendencia:cod:' || nullif(btrim(a.id_origem), ''), 'UTF8')), 'hex'), 16) as codigo,
           case when c.status = 'Contratado' then left(private."FC_VINCULO_DA_MATRICULA"(c.matricula), 16) end as vinculo,
           case when c.status = 'Contratado' then private."FC_EM_OUTRA_LISTA"(c.id) end as outra
      from listas li
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = li.id and c.removido_em is null
      left join public."TB_ANALISE_CURRICULAR" a on a.id = c."CO_ANALISE_CURRICULAR"
  )
  select jsonb_build_object(
    'schema_version', 1,
    'lido_em', now(),
    'listas', (select coalesce(jsonb_agg(jsonb_build_array(li.id, li.edital, li.area, li.ativo) order by li.i), '[]'::jsonb)
                 from listas li),
    'linhas', (select coalesce(jsonb_agg(jsonb_build_array(x.id, x.i, x.codigo_vaga, x.modalidade, x.classificacao,
                                                           x.status, x."DT_CONVOCACAO", x.nome, x.codigo, x.vinculo, x.outra)
                                         order by x.id), '[]'::jsonb)
                 from linhas x),
    'ambiguos', (select coalesce(jsonb_agg(jsonb_build_array(x."CO_CANDIDATO_APROVADO", x."CO_MONITORAMENTO",
                                                             left(x."DS_VINCULO", 16), x."TP_MOTIVO")
                                           order by x."CO_CANDIDATO_APROVADO"), '[]'::jsonb)
                   from public."TB_CONTRATACAO_APROVADO" x
                   join linhas l on l.id = x."CO_CANDIDATO_APROVADO"
                  where x."TP_SITUACAO" = 'AMBIGUO'),
    'pendencias', (select coalesce(jsonb_agg(jsonb_build_array(p."TP_PENDENCIA", p."DS_CHAVE", p."TP_SITUACAO", p."TP_DECISAO")
                                             order by p."TP_PENDENCIA", p."DS_CHAVE"), '[]'::jsonb)
                     from public."TB_PENDENCIA_APROVADO" p)
  );
$function$;

revoke all on function public.pendencias_ler_aprovados() from public, anon, authenticated;
grant execute on function public.pendencias_ler_aprovados() to service_role;
comment on function public.pendencias_ler_aprovados() is
  'Job "Pendências do edital" (Python, só service_role): as listas vigentes fora do treinamento (id, edital, área, ativa), as linhas delas em formato compacto (id, lista, vaga, modalidade, posição, status, data da convocação, hashes curtos do nome, do código do candidato e da matrícula do Contratado, em outra lista), os AMBIGUO do instantâneo TB_CONTRATACAO_APROVADO e as pendências já gravadas (tipo, chave, situação, decisão). Sem nome, CPF nem matrícula. 20261026190000.';

CREATE OR REPLACE FUNCTION public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id uuid, p_planilha text, p_total_local integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_manifesto integer;
  v_ativas integer;
  v_limite integer;
  v_ausentes integer;
  v_desativadas integer := 0;
begin
  select count(*)::integer into v_manifesto from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id;
  if v_manifesto = 0 then
    return jsonb_build_object('desativadas', 0, 'motivo', 'sem manifesto (script incremental antigo)');
  end if;
  if v_manifesto <> coalesce(p_total_local, -1) then
    return jsonb_build_object('desativadas', 0,
      'motivo', format('manifesto incompleto: %s de %s linhas', v_manifesto, p_total_local));
  end if;

  -- [monitora] linha publicada pela ficha (TP_ORIGEM_REGISTRO MONITORA) não é da planilha.
  select count(*)::integer into v_ativas
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo and a."CO_PLANILHA" = p_planilha and a."TP_ORIGEM_REGISTRO" = 'PLANILHA';
  v_limite := greatest(25, ceil(v_ativas * 0.02)::integer);

  select count(*)::integer into v_ausentes
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
     and exists (select 1 from public."TB_EDITAL_ANALISE" e
                  where e.ativo and e."CO_PLANILHA" = p_planilha
                    and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                    and e.edital_norm = a.edital_norm)
     and not exists (select 1 from public."TM_MANIFESTO_ANALISE" m
                      where m."CO_SYNC" = p_sync_id and m."DS_CHAVE_NATURAL" = a.chave_natural);

  if v_ausentes > v_limite then
    return jsonb_build_object('desativadas', 0, 'ausentes', v_ausentes,
      'motivo', format('remoção bloqueada: %s ausentes passa do limite de %s', v_ausentes, v_limite));
  end if;

  update public."TB_ANALISE_CURRICULAR" a
     set ativo = false, updated_at = now()
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
     and exists (select 1 from public."TB_EDITAL_ANALISE" e
                  where e.ativo and e."CO_PLANILHA" = p_planilha
                    and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                    and e.edital_norm = a.edital_norm)
     and not exists (select 1 from public."TM_MANIFESTO_ANALISE" m
                      where m."CO_SYNC" = p_sync_id and m."DS_CHAVE_NATURAL" = a.chave_natural);
  get diagnostics v_desativadas = row_count;
  return jsonb_build_object('desativadas', v_desativadas, 'ausentes', v_ausentes, 'limite', v_limite);
end;
$function$;

comment on function public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(uuid, text, integer) is
  'Fim do sync incremental: desativa análises ativas da planilha (de editais ativos) que não vieram no manifesto. Não faz nada com manifesto vazio/incompleto ou remoção acima de 2% (mín. 25). Só service_role.';

commit;
