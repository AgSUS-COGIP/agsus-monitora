/*
  CONFERÊNCIAS, PENDÊNCIAS E O FIM DO SYNC DAS ANÁLISES SEM AS LEITURAS PESADAS (03/11/2026)

  pg_stat_statements (desde 14/10/2026) e medição em begin … rollback (03/11/2026):

    RPC                                     chamadas  média    máx     no ensaio (antes)
    conferencia_ler_classificacao                21   12,4 s  15,5 s  estoura 20 s com o banco ocupado
    pendencias_ler_aprovados                     65    5,2 s  28,4 s  5,6 s frio · 2,6 s quente (5,2 MB)
    finalizar_sync_analises_incremental         283    2,4 s  20,7 s  1,3–1,4 s (saude-indigena, nada mudou)
    conferencia_ler_analises (por página)        21    0,5 s   1,2 s  2,7 s frio · 0,2–0,5 s quente

  AS CAUSAS
    1. conferencia_ler_classificacao: "vagas_sem_quadro" chama private."FC_QUADRO_DA_VAGA"
       para cada vaga distinta das análises (658 hoje; ~18 ms cada, com FC_TOKENS_VAGA em toda
       linha do quadro do edital) e "analises_alteradas" relê TB_ANALISE_CURRICULAR inteira
       (5,7 mil páginas) — que o mesmo robô já lê em conferencia_ler_analises.
    2. pendencias_ler_aprovados: uma resposta só com as 32 mil linhas (5,2 MB de jsonb, dois
       sha256 por linha), e "ambiguos" relia o CTE das linhas inteiro para achar 21 linhas.
    3. finalizar_sync_analises_incremental: 1,3 s dos 1,4 s são de
       public."FC_DESATIVAR_AUSENTES_DA_PLANILHA". TM_MANIFESTO_ANALISE fica vazia entre os
       syncs, e a estatística dela diz isso: o planejador estima 1 linha do manifesto e faz o
       NOT EXISTS por nested loop com a lista materializada — 11.574 × 1.955 comparações
       (11,3 milhões) na contagem e de novo no UPDATE. Não é falta de índice
       (IN_MANIFESTOANALISE_CHAVE existe): é o plano.

  O QUE MUDA
    1. Novo public.conferencia_ler_listas_e_quadros() (só service_role): as listas e os
       ajustes como em conferencia_ler_classificacao, e as linhas ATIVAS do quadro de vagas
       (id, edital, cargo, lotação: 256 hoje), cruas. O robô das conferências
       (scripts/conferencias/) tira a última atualização das análises por edital e as vagas
       das MESMAS páginas de conferencia_ler_analises e procura a linha do quadro em Python
       (python/monitora/classificacao/quadro_da_vaga.py, cópia fiel de FC_TOKENS_VAGA e
       FC_QUADRO_DA_VAGA, que continuam no banco para a classificação).
    2. conferencia_ler_analises ganha, em cada linha, "vaga" (nullif(btrim(codigo_vaga), ''))
       e "nome_vaga" (o nome como está, só quando não é vazio). Mesmas linhas, mesmas chaves de
       antes: o robô de hoje ignora as novas.
    3. pendencias_ler_aprovados(p_apos, p_limite): sem argumentos, a MESMA resposta de antes
       (o robô de hoje continua igual); com p_limite, uma página das linhas em ordem do id
       (até 10 mil, depois de p_apos), com "proximo" quando há mais. "listas" vem em toda
       página (o robô confere que não mudou no meio); "ambiguos" e "pendencias", só na
       primeira (sem p_apos). "ambiguos" passa a ir direto às 21 linhas AMBIGUO pela chave.
    4. FC_DESATIVAR_AUSENTES_DA_PLANILHA: o NOT EXISTS no manifesto vira
       "chave_natural is null or chave_natural not in (manifesto do sync)" — subplano em hash
       (a chave do manifesto é not null; a linha sem chave continua contando como ausente, como
       no NOT EXISTS). O plano não depende mais da estatística da tabela. Mesmo resultado.

  ORDEM DE IMPLANTAÇÃO
    a) aplicar ESTA migration (tudo aditivo: o robô de hoje continua funcionando igual);
    b) mesclar a PR do robô (scripts/conferencias/, scripts/aprovados/pendencias.py);
    c) aplicar 20261103182000_sem_conferencia_ler_classificacao.sql (apaga a RPC antiga).
    O robô novo com o banco sem esta migration falharia no módulo Classificação (RPC nova
    inexistente; os avisos dele ficam como estão) e na leitura das pendências.

  Assinaturas que o Apps Script chama (finalizar_sync_analises_incremental) iguais. Nenhuma
  função do fecho das leituras com marca (20261029170000) muda: nenhuma delas cita estas.
  Para aplicar, confere que as funções trocadas são as do banco de 03/11/2026 (md5 do código
  sem \r), ou já as desta.

  Ensaio:   supabase/ensaios/20261103181500_conferencias_e_pendencias_leves.sql
  Rollback: supabase/rollback/20261103181500_conferencias_e_pendencias_leves.sql
  Teste:    tests/conferencias-e-pendencias-leves-migration.test.js,
            tests/python/test_quadro_da_vaga.py, test_conferencias.py, test_pendencias_do_edital.py
*/
begin;

set local lock_timeout = '10s';

-- 0. As funções trocadas são as que esta migration conhece (ou já as desta) ----------------
do $guarda$
declare
  v_esperado constant jsonb := jsonb_build_object(
    'conferencia_ler_analises', 'd16d447101315754da74205b9560ba1d',
    'pendencias_ler_aprovados', 'e440cb69423382e606d93dfe68001440',
    'FC_DESATIVAR_AUSENTES_DA_PLANILHA', '8dd521c17833c98899b01f3d92ef1f09');
  v_diferentes text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_diferentes
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where v_esperado ? p.proname
     and md5(replace(p.prosrc, E'\r', '')) <> v_esperado ->> p.proname::text
     and p.prosrc not like '%20261103181500%';
  if v_diferentes is not null then
    raise exception 'Função(ões) diferente(s) da que esta migration conhece: %. Refaça a migration sobre a versão do banco.', v_diferentes;
  end if;
end;
$guarda$;

-- 1. As listas, os ajustes e o quadro de vagas, crus ---------------------------------------
create or replace function public.conferencia_ler_listas_e_quadros()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
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
$function$;

revoke all on function public.conferencia_ler_listas_e_quadros() from public, anon, authenticated;
grant execute on function public.conferencia_ler_listas_e_quadros() to service_role;
comment on function public.conferencia_ler_listas_e_quadros() is
  'Conferências (job Python, só service_role): a última lista de classificação de cada edital e tipo (fora do treinamento) com as vagas com empate pendente, os ajustes de recurso aprovados e as linhas ativas do quadro de vagas (id, edital, cargo, lotação), cruas. A vaga sem linha no quadro e a lista final desatualizada são conferidas no robô, com as páginas de conferencia_ler_analises (20261103181500).';

-- 2. As análises com a vaga ------------------------------------------------------------------
create or replace function public.conferencia_ler_analises(p_apos uuid default null::uuid, p_limite integer default 5000)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
$function$;

comment on function public.conferencia_ler_analises(uuid, integer) is
  'Conferências (job Python): uma página (até 10000, pela ordem do id, depois de p_apos) das análises curriculares ativas, só com id, área, edital, código do candidato, status, notas, datas, a data da candidatura na Empregare e o código e o nome da vaga (20261103181500). Sem nome nem CPF. proximo = cursor da página seguinte (nulo na última). Só service_role.';

-- 3. As pendências em páginas ----------------------------------------------------------------
drop function if exists public.pendencias_ler_aprovados();

create or replace function public.pendencias_ler_aprovados(p_apos uuid default null, p_limite integer default null)
returns jsonb
language sql
stable
security definer
set search_path to ''
set work_mem to '16MB'
as $function$
  -- 20261103181500: sem argumentos, a resposta de sempre; com p_limite, uma página.
  with listas as materialized (
    select l.id, l.edital_id::uuid as edital, m."CO_AREA" as area, coalesce(l.ativo, false) as ativo,
           (row_number() over (order by l.id) - 1)::integer as i
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente is true
       and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
  ), pagina as materialized (
    select c.id, li.i, c.codigo_vaga, c.modalidade, c.classificacao, c.status, c."DT_CONVOCACAO",
           c.nome, c.matricula, c."CO_ANALISE_CURRICULAR"
      from listas li
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = li.id and c.removido_em is null
     where p_apos is null or c.id > p_apos
     order by c.id
     limit case when p_limite is not null then least(greatest(p_limite, 1), 10000) end
  ), linhas as (
    -- Sem nome, CPF nem matrícula: hashes curtos do nome, do código do candidato e da matrícula.
    select p.id, p.i, p.codigo_vaga, p.modalidade, p.classificacao, p.status, p."DT_CONVOCACAO",
           left(encode(sha256(convert_to('pendencia:nome:' || lower(regexp_replace(btrim(p.nome), '\s+', ' ', 'g')),
                                         'UTF8')), 'hex'), 16) as nome,
           left(encode(sha256(convert_to('pendencia:cod:' || nullif(btrim(a.id_origem), ''), 'UTF8')), 'hex'), 16) as codigo,
           case when p.status = 'Contratado' then left(private."FC_VINCULO_DA_MATRICULA"(p.matricula), 16) end as vinculo,
           case when p.status = 'Contratado' then private."FC_EM_OUTRA_LISTA"(p.id) end as outra
      from pagina p
      left join public."TB_ANALISE_CURRICULAR" a on a.id = p."CO_ANALISE_CURRICULAR"
  )
  select jsonb_build_object(
    'schema_version', 1,
    'lido_em', now(),
    'listas', (select coalesce(jsonb_agg(jsonb_build_array(li.id, li.edital, li.area, li.ativo) order by li.i), '[]'::jsonb)
                 from listas li),
    'linhas', (select coalesce(jsonb_agg(jsonb_build_array(x.id, x.i, x.codigo_vaga, x.modalidade, x.classificacao,
                                                           x.status, x."DT_CONVOCACAO", x.nome, x.codigo, x.vinculo, x.outra)
                                         order by x.id), '[]'::jsonb)
                 from linhas x))
  -- Os AMBIGUO e as pendências gravadas, só na primeira página (ou na leitura inteira).
  || case when p_apos is null then jsonb_build_object(
    'ambiguos', (select coalesce(jsonb_agg(jsonb_build_array(x."CO_CANDIDATO_APROVADO", x."CO_MONITORAMENTO",
                                                             left(x."DS_VINCULO", 16), x."TP_MOTIVO")
                                           order by x."CO_CANDIDATO_APROVADO"), '[]'::jsonb)
                   from public."TB_CONTRATACAO_APROVADO" x
                   join public."TB_CANDIDATO_APROVADO" c on c.id = x."CO_CANDIDATO_APROVADO" and c.removido_em is null
                   join listas li on li.id = c.lista_id
                  where x."TP_SITUACAO" = 'AMBIGUO'),
    'pendencias', (select coalesce(jsonb_agg(jsonb_build_array(p."TP_PENDENCIA", p."DS_CHAVE", p."TP_SITUACAO", p."TP_DECISAO")
                                             order by p."TP_PENDENCIA", p."DS_CHAVE"), '[]'::jsonb)
                     from public."TB_PENDENCIA_APROVADO" p)) else '{}'::jsonb end
  -- O cursor da página seguinte: só com p_limite e a página cheia.
  || coalesce((select jsonb_build_object('proximo', max(p.id::text)::uuid)
                 from pagina p
                where p_limite is not null
               having count(*) = least(greatest(p_limite, 1), 10000)), '{}'::jsonb);
$function$;

revoke all on function public.pendencias_ler_aprovados(uuid, integer) from public, anon, authenticated;
grant execute on function public.pendencias_ler_aprovados(uuid, integer) to service_role;
comment on function public.pendencias_ler_aprovados(uuid, integer) is
  'Job "Pendências do edital" (Python, só service_role): as listas vigentes fora do treinamento (id, edital, área, ativa), as linhas delas em formato compacto (id, lista, vaga, modalidade, posição, status, data da convocação, hashes curtos do nome, do código do candidato e da matrícula do Contratado, em outra lista), os AMBIGUO do instantâneo TB_CONTRATACAO_APROVADO e as pendências já gravadas (tipo, chave, situação, decisão). Sem nome, CPF nem matrícula. 20261026190000. Com p_limite (20261103181500): uma página das linhas em ordem do id depois de p_apos (até 10000), proximo quando há mais; ambiguos e pendencias só na primeira página.';

-- 4. Os ausentes do manifesto sem depender da estatística dele -------------------------------
create or replace function public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id uuid, p_planilha text, p_total_local integer)
returns jsonb
language plpgsql
set search_path to ''
as $function$
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

  -- 20261103181500: NOT IN (subplano em hash) em vez de NOT EXISTS. TM_MANIFESTO_ANALISE fica
  -- vazia entre os syncs e o planejador estimava 1 linha: nested loop de 11 milhões de
  -- comparações (1,3 s) aqui e no UPDATE. DS_CHAVE_NATURAL é not null; a análise sem chave
  -- continua ausente, como no NOT EXISTS.
  select count(*)::integer into v_ausentes
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
     and exists (select 1 from public."TB_EDITAL_ANALISE" e
                  where e.ativo and e."CO_PLANILHA" = p_planilha
                    and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                    and e.edital_norm = a.edital_norm)
     and (a.chave_natural is null
          or a.chave_natural not in (select m."DS_CHAVE_NATURAL" from public."TM_MANIFESTO_ANALISE" m
                                      where m."CO_SYNC" = p_sync_id));

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
     and (a.chave_natural is null
          or a.chave_natural not in (select m."DS_CHAVE_NATURAL" from public."TM_MANIFESTO_ANALISE" m
                                      where m."CO_SYNC" = p_sync_id));
  get diagnostics v_desativadas = row_count;
  return jsonb_build_object('desativadas', v_desativadas, 'ausentes', v_ausentes, 'limite', v_limite);
end;
$function$;

comment on function public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(uuid, text, integer) is
  'Fim do sync incremental: desativa análises ativas da planilha (de editais ativos) que não vieram no manifesto. Não faz nada com manifesto vazio/incompleto ou remoção acima de 2% (mín. 25). Só service_role. O manifesto é lido por NOT IN em hash, sem depender da estatística da tabela (20261103181500).';

commit;
