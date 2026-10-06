/*
  ENSAIO de 20261006080000_robo_empregare_vagas_do_quadro.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), cria um edital sintético (9901/2099,
  Projetos) com quadro de vagas e análises nas vagas fictícias 999999101 (só
  no quadro) e 999999102 (no quadro e na Seleção), mais a 999999103 só na
  Seleção; confere como o robô (papel service_role) que a vaga do quadro
  aparece em listar_vagas_empregare, que a vaga das duas fontes não duplica e
  fica com o edital do quadro, e que a gravação liga as vagas ao edital pelo
  quadro. Termina em ROLLBACK: nada fica gravado. Nenhum dado pessoal real é
  mostrado (o edital e as análises sintéticos copiam uma linha existente só
  para preencher as colunas obrigatórias e trocam nome, códigos e chaves).

  Precisa de: 20261005170000_robo_empregare.sql aplicada e nenhuma execução
  do robô em andamento (iniciar_sync_empregare recusaria com 55P03).

  Resultado esperado: as mensagens "ok E1" … "ok E5" e a linha "ENSAIO OK" do
  SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/robo-empregare-vagas-do-quadro.test.js confere
  que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.listar_vagas_empregare(text[], text[], integer)') is null then
    raise exception 'Aplique antes 20261005170000_robo_empregare.sql.';
  end if;
  if to_regprocedure('private."FC_QUADRO_DA_VAGA"(uuid, text)') is null then
    raise exception 'Aplique antes 20260930233000_quadro_de_vagas_do_edital.sql.';
  end if;
end;
$$;

-- 1. Vagas do quadro do edital ----------------------------------------------------------
create function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga text default null)
returns table (vaga text, edital_id uuid, quadro_id uuid, cargo text)
language sql
stable
set search_path to ''
as $function$
  with analises as (
    select btrim(a.codigo_vaga) as vaga, a."CO_AREA" as area,
           private."FC_NUMERO_EDITAL"(a.edital) as numero, min(a.nome_vaga) as nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo
       and btrim(a.codigo_vaga) ~ '^[0-9]{1,20}$'
       and (p_vaga is null or btrim(a.codigo_vaga) = p_vaga)
     group by 1, 2, 3
  ),
  ligadas as (
    select n.vaga, m.id as edital_id, m.ativo, n.nome_vaga,
           private."FC_QUADRO_DA_VAGA"(m.id, n.nome_vaga) as quadro_id
      from analises n
      join public."TB_MONITORAMENTO_INDIGENA" m
        on m."CO_AREA" = n.area and private."FC_NUMERO_EDITAL"(m.edital) = n.numero
     where exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q
                    where q."CO_MONITORAMENTO" = m.id and q."ST_REGISTRO_ATIVO" = 'S')
  )
  select distinct on (l.vaga)
         l.vaga, l.edital_id, l.quadro_id,
         coalesce(nullif(concat_ws(' — ', q."NO_CARGO", q."NO_LOTACAO"), ''), l.nome_vaga) as cargo
    from ligadas l
    left join public."TB_QUADRO_VAGA_EDITAL" q on q."CO_QUADRO_VAGA" = l.quadro_id
   order by l.vaga, l.ativo desc nulls last, (l.quadro_id is null), l.edital_id;
$function$;
comment on function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text) is 'Vagas da Empregare dos editais com quadro de vagas vigente (TB_QUADRO_VAGA_EDITAL): o código vem das análises ativas do edital (mesma área e número), a linha do quadro por FC_QUADRO_DA_VAGA quando a ligação é única. Uma linha por código (prefere edital ativo e vaga ligada ao quadro). p_vaga restringe a um código. Usada pelo robô da Empregare.';
revoke all on function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text) from public, anon, authenticated;

-- 2. Ligação da vaga ao edital na gravação: quadro primeiro, depois a Seleção -----------
create or replace function private."FC_EMPREGARE_ABRIR_VAGA"(p_sync text, p_vaga text, p_total integer)
returns text
language plpgsql
set search_path to ''
as $function$
declare
  v_vaga public."TB_EMPREGARE_VAGA";
  v_forcada boolean;
  v_ativos integer;
  v_edital uuid;
begin
  select (s."ST_FORCADA" = 'S') into v_forcada from public."TL_SYNC_EMPREGARE" s where s."CO_SYNC" = p_sync;
  select q.edital_id into v_edital from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) q limit 1;
  if v_edital is null then
    select s."CO_MONITORAMENTO" into v_edital
      from public."TB_SELECAO_VAGA" s
     where s."CO_VAGA" = p_vaga and s."ST_REGISTRO_ATIVO" = 'S'
     order by (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
     limit 1;
  end if;

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO")
  values (p_vaga, v_edital)
  on conflict ("CO_VAGA") do nothing;
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga for update;

  if v_vaga."CO_SYNC" is not distinct from p_sync then
    return v_vaga."TP_SITUACAO";
  end if;

  select count(*) into v_ativos
    from public."TB_EMPREGARE_CANDIDATO" c
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S';

  if not v_forcada and v_ativos > 0 and p_total * 2 < v_ativos then
    update public."TB_EMPREGARE_VAGA" set
      "TP_SITUACAO" = 'RECUSADA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
      "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"),
      "DS_MENSAGEM" = format('Arquivo com %s candidatos e a vaga tem %s ativos: menos da metade. Nada foi gravado nem desativado.', p_total, v_ativos),
      "DT_ATUALIZACAO" = now()
     where "CO_VAGA" = p_vaga;
    update public."TL_SYNC_EMPREGARE" set "QT_VAGA_RECUSADA" = "QT_VAGA_RECUSADA" + 1 where "CO_SYNC" = p_sync;
    return 'RECUSADA';
  end if;

  update public."TB_EMPREGARE_VAGA" set
    "TP_SITUACAO" = 'EM_CARGA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
    "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"), "DS_MENSAGEM" = null, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  return 'EM_CARGA';
end;
$function$;
comment on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) is 'Abre a vaga numa execução do robô da Empregare: cria a linha, liga o edital (primeiro pelo quadro de vagas do edital, FC_EMPREGARE_VAGAS_DO_QUADRO; depois por TB_SELECAO_VAGA) e aplica a trava (arquivo com menos da metade dos ativos, sem forçar, é RECUSADA). Chamada pelas RPCs de carga.';
revoke all on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) from public, anon, authenticated;

comment on column public."TB_EMPREGARE_VAGA"."CO_VAGA" is 'Código da vaga na Empregare (ex.: 177979): do quadro do edital (pelas análises do edital) ou o CO_VAGA de TB_SELECAO_VAGA.';
comment on column public."TB_EMPREGARE_VAGA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id): pelo quadro de vagas do edital, senão pela vaga ativa de TB_SELECAO_VAGA; nulo sem ligação.';

-- 3. Lista do robô: quadro do edital + Seleção, sem duplicar ------------------------------
create or replace function public.listar_vagas_empregare(p_editais text[] default null, p_vagas text[] default null, p_limite integer default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 60), 1), 500);
  v_vagas text[] := coalesce(p_vagas, '{}');
  v_editais text[];
  v_modo text;
begin
  if exists (select 1 from unnest(v_vagas) v where v !~ '^[0-9]{1,20}$') then
    raise exception 'Código de vaga inválido: use só dígitos' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct private."FC_NUMERO_EDITAL"(e)), '{}') into v_editais
    from unnest(coalesce(p_editais, '{}')) e;
  if exists (select 1 from unnest(v_editais) e where e is null) then
    raise exception 'Edital inválido: use o número, como 80/2026' using errcode = '22023';
  end if;
  v_modo := case when cardinality(v_vagas) > 0 then 'VAGAS'
                 when cardinality(v_editais) > 0 then 'EDITAIS'
                 else 'PADRAO' end;

  return (
    with quadro as (
      select q.vaga, m.id as edital_id, m.edital, m.unidade, q.cargo, m."CO_AREA" as area,
             m.ativo as edital_ativo, 'quadro'::text as origem
        from private."FC_EMPREGARE_VAGAS_DO_QUADRO"() q
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = q.edital_id
    ),
    selecao as (
      select distinct on (s."CO_VAGA")
             s."CO_VAGA" as vaga, s."CO_MONITORAMENTO" as edital_id, s."DS_EDITAL" as edital,
             s."NO_UNIDADE" as unidade, s."NO_CARGO" as cargo, s."CO_AREA" as area,
             m.ativo as edital_ativo, 'selecao'::text as origem
        from public."TB_SELECAO_VAGA" s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
       where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_VAGA" is not null
       order by s."CO_VAGA", (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
    ),
    -- Mesmo código nas duas fontes: fica a linha do quadro.
    fontes as (
      select f.*,
             (select max(coalesce(c.data_fim, c.data_inicio)::date)
                from public."TB_CRONOGRAMA_MONIT_INDIG" c
               where c.monitoramento_id = f.edital_id) as fim_do_cronograma
        from (select * from quadro
              union all
              select s.* from selecao s where not exists (select 1 from quadro q where q.vaga = s.vaga)) f
    ),
    escolhidas as (
      select s.vaga, s.edital_id, s.edital, s.unidade, s.cargo, s.area, s.origem
        from fontes s
       where (v_modo = 'VAGAS' and s.vaga = any (v_vagas))
          or (v_modo = 'EDITAIS' and private."FC_NUMERO_EDITAL"(s.edital) = any (v_editais))
          or (v_modo = 'PADRAO' and s.edital_ativo is true
              and (s.fim_do_cronograma is null or s.fim_do_cronograma >= current_date - 30))
      union all
      -- Código pedido que não está no quadro nem na Seleção: vai mesmo assim, sem edital.
      select v, null::uuid, null, null, null, null, 'pedida'
        from unnest(v_vagas) v
       where v_modo = 'VAGAS' and not exists (select 1 from fontes s where s.vaga = v)
    ),
    ordenadas as (
      select e.*, ev."DT_ULTIMA_CARGA" as ultima_carga
        from escolhidas e
        left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = e.vaga
       order by ev."DT_ULTIMA_CARGA" nulls first, e.edital nulls last, e.vaga
       limit v_limite
    )
    select jsonb_build_object(
      'modo', v_modo,
      'limite', v_limite,
      'vagas', coalesce(jsonb_agg(jsonb_build_object(
          'vaga', o.vaga, 'edital_id', o.edital_id, 'edital', o.edital, 'unidade', o.unidade,
          'cargo', o.cargo, 'area', o.area, 'ultima_carga', o.ultima_carga, 'origem', o.origem
        ) order by o.ultima_carga nulls first, o.edital nulls last, o.vaga), '[]'::jsonb)
    )
      from ordenadas o
  );
end;
$function$;
comment on function public.listar_vagas_empregare(text[], text[], integer) is
  'Vagas que o robô da Empregare deve exportar, de duas fontes sem duplicar (mesmo código: fica o quadro): o quadro de vagas do edital (FC_EMPREGARE_VAGAS_DO_QUADRO, fonte principal) e TB_SELECAO_VAGA (editais antigos). Sem filtro, as vagas cujo edital está ativo e em curso (sem cronograma ou com etapa terminando há no máximo 30 dias); p_editais (números como 80/2026) ou p_vagas (códigos) restringem. Cada vaga diz a origem (quadro, selecao ou pedida). Nunca carregadas e mais antigas primeiro, até p_limite (1 a 500). Só service_role.';
revoke all on function public.listar_vagas_empregare(text[], text[], integer) from public, anon, authenticated;
grant execute on function public.listar_vagas_empregare(text[], text[], integer) to service_role;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Permissões: a lista continua só do service_role; a função nova é privada.
do $$
begin
  if has_function_privilege('authenticated', 'public.listar_vagas_empregare(text[], text[], integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.listar_vagas_empregare(text[], text[], integer)', 'EXECUTE') then
    raise exception 'FALHOU E1: listar_vagas_empregare executável fora do service_role';
  end if;
  if not has_function_privilege('service_role', 'public.listar_vagas_empregare(text[], text[], integer)', 'EXECUTE') then
    raise exception 'FALHOU E1: service_role sem listar_vagas_empregare';
  end if;
  if has_function_privilege('authenticated', 'private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text)', 'EXECUTE')
     or has_function_privilege('anon', 'private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text)', 'EXECUTE') then
    raise exception 'FALHOU E1: FC_EMPREGARE_VAGAS_DO_QUADRO executável por authenticated/anon';
  end if;
  raise notice 'ok E1: lista só service_role; função do quadro privada';
end;
$$;

/*
  E2. Dados sintéticos (somem no rollback), como o papel do SQL Editor:
    - edital "9901/2099" de Projetos, ativo e sem cronograma, com quadro de duas
      linhas (Técnico e Engenheiro de Segurança do Trabalho);
    - análises do edital nas vagas fictícias 999999101 (só no quadro) e
      999999102 (também na Seleção, sem edital ligado);
    - na Seleção, 999999102 e 999999103 (só na Seleção, edital "9902/2099").
  O edital e as análises copiam uma linha existente (as colunas obrigatórias
  dessas tabelas antigas ficam preenchidas) e trocam o que importa; nada
  pessoal é mostrado.
*/
do $$
declare
  c_edital constant uuid := '00000000-0000-4000-a000-0000000e0801';
  v_cols text;
begin
  create temporary table tmp_ensaio_edital on commit drop as
    select * from public."TB_MONITORAMENTO_INDIGENA" limit 1;
  if not exists (select 1 from pg_temp.tmp_ensaio_edital) then
    raise exception 'FALHOU E2: nenhum edital para servir de molde';
  end if;
  update pg_temp.tmp_ensaio_edital set
    id = c_edital, edital = 'Edital 9901/2099 - Ensaio', processo = 'ensaio-9901-2099',
    "CO_AREA" = 'projetos', ativo = true;
  select string_agg(format('%I', a.attname), ', ' order by a.attnum) into v_cols
    from pg_attribute a
   where a.attrelid = 'public."TB_MONITORAMENTO_INDIGENA"'::regclass
     and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' and a.attidentity = '';
  execute format('insert into public."TB_MONITORAMENTO_INDIGENA" (%s) select %s from pg_temp.tmp_ensaio_edital', v_cols, v_cols);

  insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO", "QT_VAGA_IMEDIATA", "TP_ORIGEM")
  values (c_edital, 1, 'Técnico de Segurança do Trabalho', 'Sede', 3, 'MANUAL'),
         (c_edital, 2, 'Engenheiro de Segurança do Trabalho', 'Sede', 2, 'MANUAL');

  create temporary table tmp_ensaio_analise on commit drop as
    select * from public."TB_ANALISE_CURRICULAR" limit 1;
  if not exists (select 1 from pg_temp.tmp_ensaio_analise) then
    raise exception 'FALHOU E2: nenhuma análise para servir de molde';
  end if;
  update pg_temp.tmp_ensaio_analise set
    grupo = 'Projetos', edital = '9901/2099', ativo = true,
    candidato = 'Pessoa Fictícia Ensaio', id_origem = null, data_nascimento = null;
  insert into pg_temp.tmp_ensaio_analise select * from pg_temp.tmp_ensaio_analise;
  insert into pg_temp.tmp_ensaio_analise select * from pg_temp.tmp_ensaio_analise limit 1;
  -- Três análises: duas na vaga 999999101 (uma linha só na lista) e uma na 999999102.
  with n as (select ctid, row_number() over () as i from pg_temp.tmp_ensaio_analise)
  update pg_temp.tmp_ensaio_analise t set
    chave_natural = 'ensaio-quadro-' || n.i,
    codigo_vaga = case when n.i < 3 then ' 999999101 ' else '999999102' end,
    nome_vaga = case when n.i < 3 then 'Técnico de Segurança do Trabalho em Excel (questionário)'
                     else 'Engenheiro de Segurança do Trabalho' end
    from n where n.ctid = t.ctid;
  select string_agg(format('%I', a.attname), ', ' order by a.attnum) into v_cols
    from pg_attribute a
   where a.attrelid = 'public."TB_ANALISE_CURRICULAR"'::regclass
     and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' and a.attidentity = ''
     and a.attname <> 'id';
  execute format('insert into public."TB_ANALISE_CURRICULAR" (%s) select %s from pg_temp.tmp_ensaio_analise', v_cols, v_cols);

  insert into public."TB_SELECAO_VAGA" ("CO_AREA", "CO_MONITORAMENTO", "DS_EDITAL", "CO_VAGA", "DS_VAGA_PLANILHA", "NO_CARGO", "DS_CHAVE_ORIGEM")
  values ('projetos', null, 'Edital 9901/2099', '999999102', 'Ensaio 999999102', 'Engenheiro (Seleção)', 'ensaio-quadro-selecao-102'),
         ('projetos', null, 'Edital 9902/2099', '999999103', 'Ensaio 999999103', 'Só na Seleção', 'ensaio-quadro-selecao-103');
  raise notice 'ok E2: edital, quadro, análises e Seleção sintéticos';
end;
$$;

-- E3. A lista e a gravação como o robô (papel service_role).
set local role service_role;
do $$
declare
  c_edital constant uuid := '00000000-0000-4000-a000-0000000e0801';
  v jsonb;
  v_vagas jsonb;
  v_linha jsonb := jsonb_build_array(jsonb_build_object(
    'chave', 'cod:Q1', 'tipo', 'CODIGO', 'codigo', 'Q1', 'colunas', '{"Nome":"Pessoa Fictícia Ensaio"}'::jsonb));
begin
  -- Por edital: as duas vagas do quadro, uma vez cada, ligadas ao edital e à área do quadro.
  v := public.listar_vagas_empregare(array['9901/2099'], null, 500);
  v_vagas := v -> 'vagas';
  if v ->> 'modo' <> 'EDITAIS' or jsonb_array_length(v_vagas) <> 2 then
    raise exception 'FALHOU E3: edital do quadro devia trazer 2 vagas %', v;
  end if;
  if (select count(*) from jsonb_array_elements(v_vagas) e
       where e ->> 'origem' = 'quadro' and (e ->> 'edital_id')::uuid = c_edital and e ->> 'area' = 'projetos') <> 2 then
    raise exception 'FALHOU E3: vagas do quadro sem origem, edital ou área do quadro %', v_vagas;
  end if;
  if (select e ->> 'cargo' from jsonb_array_elements(v_vagas) e where e ->> 'vaga' = '999999101')
     is distinct from 'Técnico de Segurança do Trabalho — Sede' then
    raise exception 'FALHOU E3: cargo da vaga ligada à linha do quadro %', v_vagas;
  end if;

  -- Por código: quadro, Seleção e pedida; a vaga das duas fontes não duplica e fica com o quadro.
  v := public.listar_vagas_empregare(null, array['999999101', '999999102', '999999103', '999999104'], 500);
  v_vagas := v -> 'vagas';
  if jsonb_array_length(v_vagas) <> 4 then
    raise exception 'FALHOU E3: vaga das duas fontes duplicou ou faltou %', v_vagas;
  end if;
  if (select string_agg((e ->> 'vaga') || ':' || (e ->> 'origem'), ',' order by e ->> 'vaga') from jsonb_array_elements(v_vagas) e)
     is distinct from '999999101:quadro,999999102:quadro,999999103:selecao,999999104:pedida' then
    raise exception 'FALHOU E3: origens %', v_vagas;
  end if;
  if (select (e ->> 'edital_id')::uuid from jsonb_array_elements(v_vagas) e where e ->> 'vaga' = '999999102') is distinct from c_edital then
    raise exception 'FALHOU E3: vaga das duas fontes não ficou com o edital do quadro %', v_vagas;
  end if;

  -- A Seleção continua como segunda fonte.
  v := public.listar_vagas_empregare(array['9902/2099'], null, 500);
  if jsonb_array_length(v -> 'vagas') <> 1 or v -> 'vagas' -> 0 ->> 'origem' <> 'selecao' then
    raise exception 'FALHOU E3: vaga só da Seleção %', v;
  end if;

  -- Sem filtro: nenhum código repetido. (As vagas reais já enchem o teto de
  -- 500 da lista padrão — conferido em 05/10/2026 —, então as sintéticas
  -- podem ficar de fora dela; quem entra é conferido pelos filtros acima.)
  v := public.listar_vagas_empregare(null, null, 500);
  if (select count(*) from jsonb_array_elements(v -> 'vagas') e)
     <> (select count(distinct e ->> 'vaga') from jsonb_array_elements(v -> 'vagas') e) then
    raise exception 'FALHOU E3: lista padrão com código de vaga repetido';
  end if;
  if (select count(*) from jsonb_array_elements(v -> 'vagas') e where e ->> 'vaga' = '999999103') <> 0 then
    raise exception 'FALHOU E3: vaga da Seleção sem edital ativo entrou na lista padrão';
  end if;

  -- Gravação de vaga que só existe no quadro e de vaga das duas fontes.
  perform public.iniciar_sync_empregare('ensaio-quadro-0001', 'GITHUB', null, '{}', 2);
  v := public.gravar_lote_empregare('ensaio-quadro-0001', '999999101', 1, v_linha);
  if v ->> 'situacao' <> 'EM_CARGA' or (v ->> 'gravadas')::int <> 1 then
    raise exception 'FALHOU E3: lote da vaga só do quadro %', v;
  end if;
  v := public.fechar_vaga_empregare('ensaio-quadro-0001', '999999101', '["Nome"]', 'ensaio.xlsx');
  if v ->> 'situacao' <> 'GRAVADA' then raise exception 'FALHOU E3: fechar a vaga só do quadro %', v; end if;
  v := public.fechar_vaga_empregare('ensaio-quadro-0001', '999999102', '["Nome"]', 'ensaio.xlsx');
  if v ->> 'situacao' <> 'GRAVADA' then raise exception 'FALHOU E3: fechar a vaga das duas fontes %', v; end if;
  v := public.finalizar_sync_empregare('ensaio-quadro-0001', 2, 0);
  if v ->> 'situacao' <> 'CONCLUIDA' then raise exception 'FALHOU E3: execução %', v; end if;
  raise notice 'ok E3: quadro + Seleção sem duplicar, origem, filtros e gravação';
end;
$$;

-- E4. A lista continua fechada para quem não é o robô.
set local role authenticated;
do $$
begin
  begin
    perform public.listar_vagas_empregare();
    raise exception 'FALHOU E4: authenticated listou as vagas do robô';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok E4: authenticated não lista';
end;
$$;

-- Volta ao papel do SQL Editor antes de ler as tabelas (RLS e sem grant).
reset role;

-- E5. O que ficou nas tabelas.
do $$
declare
  c_edital constant uuid := '00000000-0000-4000-a000-0000000e0801';
begin
  if (select count(*) from public."TB_EMPREGARE_VAGA"
       where "CO_VAGA" in ('999999101', '999999102') and "CO_MONITORAMENTO" = c_edital and "TP_SITUACAO" = 'GRAVADA') <> 2 then
    raise exception 'FALHOU E5: vagas gravadas sem o edital do quadro';
  end if;
  if (select count(*) from public."TB_EMPREGARE_CANDIDATO" where "CO_VAGA" = '999999101' and "ST_REGISTRO_ATIVO" = 'S') <> 1 then
    raise exception 'FALHOU E5: candidato da vaga só do quadro';
  end if;
  raise notice 'ok E5: vagas ligadas ao edital pelo quadro';
end;
$$;

-- Resumo (o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_EMPREGARE_VAGA" where "CO_VAGA" in ('999999101', '999999102')) as vagas_gravadas,
  (select count(*) from public."TB_EMPREGARE_CANDIDATO" where "CO_VAGA" = '999999101') as candidatos;

rollback;
