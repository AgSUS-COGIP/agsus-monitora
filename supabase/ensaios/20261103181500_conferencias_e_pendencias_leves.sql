/*
  ENSAIO da migration 20261103181500_conferencias_e_pendencias_leves.sql
  — begin … rollback. NÃO É MIGRATION; nada fica gravado.

  Montagem (como nos outros ensaios):
    { sed -n '1,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261103181500_conferencias_e_pendencias_leves.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261103181500_conferencias_e_pendencias_leves.sql;
      sed -n '/^-- == DEPOIS ==/,/^rollback;$/p' supabase/ensaios/20261103181500_conferencias_e_pendencias_leves.sql;
    } > /tmp/ensaio.sql   (começa em begin e termina no primeiro rollback; a PARIDADE, no fim, é outro)

  Antes e depois da migration, na mesma transação (statement_timeout de 20 s por comando):
    - pendencias_ler_aprovados() sem argumentos: md5 da resposta sem lido_em igual; depois, a
      leitura em páginas de 5.000 (como o robô) junta exatamente as mesmas linhas, listas,
      ambiguos e pendências;
    - conferencia_ler_analises, todas as páginas: as linhas iguais às de antes sem "vaga" e
      "nome_vaga" (md5), e as duas chaves novas iguais a nullif(btrim(codigo_vaga), '') e ao nome;
    - finalizar_sync_analises_incremental num sync montado aqui (manifesto e DIM_EDITAIS tirados
      do banco), cada caso numa subtransação desfeita: nada mudou (saude-indigena e projetos),
      5 e 3 ausentes (desativa), 300 ausentes (bloqueado pelo limite de 2%) e manifesto incompleto.
      Resposta (sem sync_id) e md5 dos ids desativados iguais; e o tempo. As chaves que faltam
      nunca são de análise do 114/2026 (congelado), nem dentro do rollback.
  A paridade da vaga sem quadro (Python × FC_QUADRO_DA_VAGA, vaga a vaga) é conferida por
  scripts/conferencias/paridade_do_quadro.py com a leitura deste banco (ver o docstring).
  Mostra só tempos, contagens e se bateu (nenhum dado de pessoa).
*/
begin;
set local statement_timeout = '20s';

create temporary table t_ensaio (fase text, caso text, ms numeric, h text, n bigint) on commit drop;
create temporary table t_paginas (fase text, linha jsonb) on commit drop;

-- Um sync incremental pronto para finalizar, como o Apps Script deixa: manifesto das análises
-- ativas da planilha (sem as p_faltam primeiras, fora do 114/2026) e as DIM_EDITAIS ativas.
create function pg_temp.preparar_sync(p_planilha text, p_faltam integer, p_incompleto boolean) returns uuid
language plpgsql as $$
declare
  v_sync uuid := gen_random_uuid();
  v_origem text;
  v_n integer;
  v_e integer;
begin
  select l.origem into v_origem from public."TL_SYNC_ANALISE" l
   where l."CO_PLANILHA" = p_planilha and l.modo = 'INCREMENTAL_ACTIVE' order by l.id desc limit 1;
  insert into public."TM_MANIFESTO_ANALISE" ("CO_SYNC", "NU_LINHA_ORIGEM", "DS_CHAVE_NATURAL")
  select v_sync, row_number() over (order by x.id), x.chave_natural
    from (select a.id, a.chave_natural,
                 -- As que faltam: primeiro as de edital ativo da planilha (contam como ausentes), nunca do 114/2026.
                 row_number() over (order by (private."FC_NUMERO_EDITAL"(a.edital) = '114/2026') nulls first,
                                             not exists (select 1 from public."TB_EDITAL_ANALISE" e
                                                          where e.ativo and e."CO_PLANILHA" = p_planilha
                                                            and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                                                            and e.edital_norm = a.edital_norm),
                                             a.id) as ordem
            from public."TB_ANALISE_CURRICULAR" a
           where a.ativo and a."CO_PLANILHA" = p_planilha and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
             and a.chave_natural is not null) x
   where x.ordem > p_faltam;
  get diagnostics v_n = row_count;
  insert into public."TM_ANALISE_CURRICULAR" (sync_id, entidade, linha_origem, payload)
  select v_sync, 'DIM_EDITAIS', row_number() over (order by e.id),
         jsonb_build_object('grupo', e.grupo, 'unidade', e.unidade, 'edital', e.edital, 'ativo', e.ativo,
                            'data_inicio_analise', e.data_inicio_analise, 'data_fim_analise', e.data_fim_analise)
    from public."TB_EDITAL_ANALISE" e where e."CO_PLANILHA" = p_planilha and e.ativo;
  get diagnostics v_e = row_count;
  insert into public."TL_SYNC_ANALISE" (sync_id, origem, status, modo, linhas_staging, resultado)
  values (v_sync, v_origem, 'carregado', 'INCREMENTAL_ACTIVE', v_e,
          jsonb_build_object('lote_cursor', 0, 'incremental_preparado', true,
                             'incremental_total_ativos_local', v_n + case when p_incompleto then 1 else 0 end));
  return v_sync;
end;
$$;

-- Um caso do fim do sync, desfeito no fim (subtransação): a resposta e os ids desativados.
create function pg_temp.caso_sync(p_fase text, p_planilha text, p_faltam integer, p_incompleto boolean) returns void
language plpgsql as $$
declare
  v_sync uuid;
  v_r jsonb;
  v_ids text;
  v_qt bigint;
  v_ms numeric;
  t0 timestamptz;
begin
  begin
    drop table if exists tmp_editais_incremental;
    v_sync := pg_temp.preparar_sync(p_planilha, p_faltam, p_incompleto);
    t0 := clock_timestamp();
    v_r := public.finalizar_sync_analises_incremental(v_sync);
    v_ms := round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric);
    select md5(coalesce(string_agg(a.id::text, ',' order by a.id), '')), count(*) into v_ids, v_qt
      from public."TB_ANALISE_CURRICULAR" a
     where a."CO_PLANILHA" = p_planilha and not a.ativo and a.updated_at = now();
    raise exception using errcode = 'EN001', message = 'desfazer';
  exception when sqlstate 'EN001' then
    null;
  end;
  insert into t_ensaio values (p_fase, format('sync %s faltam %s%s', p_planilha, p_faltam,
                                              case when p_incompleto then ' incompleto' else '' end),
                               v_ms, md5((v_r - 'sync_id')::text) || '/' || v_ids, v_qt);
end;
$$;

create function pg_temp.medir_pendencias(p_fase text) returns void
language plpgsql as $$
declare t0 timestamptz; j jsonb;
begin
  t0 := clock_timestamp();
  j := public.pendencias_ler_aprovados();
  insert into t_ensaio values (p_fase, 'pendencias inteira', round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric),
                               md5((j - 'lido_em')::text), jsonb_array_length(j -> 'linhas'));
end;
$$;

create function pg_temp.medir_analises(p_fase text) returns void
language plpgsql as $$
declare t0 timestamptz; j jsonb; v_apos uuid; v_ms numeric := 0;
begin
  loop
    t0 := clock_timestamp();
    j := public.conferencia_ler_analises(v_apos, 5000);
    v_ms := v_ms + extract(epoch from clock_timestamp() - t0) * 1000;
    insert into t_paginas select p_fase, l from jsonb_array_elements(j -> 'linhas') l;
    v_apos := (j ->> 'proximo')::uuid;
    exit when v_apos is null;
  end loop;
  insert into t_ensaio
  select p_fase, 'analises (páginas de 5000)', round(v_ms),
         md5(string_agg((p.linha - 'vaga' - 'nome_vaga')::text, ',' order by p.linha ->> 'id')), count(*)
    from t_paginas p where p.fase = p_fase;
end;
$$;

-- == ANTES ==
select pg_temp.medir_pendencias('antes');
select pg_temp.medir_analises('antes');
select pg_temp.caso_sync('antes', 'saude-indigena', 0, false);
select pg_temp.caso_sync('antes', 'saude-indigena', 5, false);
select pg_temp.caso_sync('antes', 'saude-indigena', 300, false);
select pg_temp.caso_sync('antes', 'saude-indigena', 0, true);
select pg_temp.caso_sync('antes', 'projetos', 0, false);
select pg_temp.caso_sync('antes', 'projetos', 3, false);
-- == aplicar a migration aqui ==

-- == DEPOIS ==
select pg_temp.medir_pendencias('depois');

-- Em páginas, como o robô: as mesmas linhas, listas iguais em toda página, ambiguos e pendências.
do $$
declare
  t0 timestamptz;
  v_ms numeric := 0;
  v_pagina jsonb;
  v_primeira jsonb;
  v_linhas jsonb := '[]'::jsonb;
  v_apos uuid;
  v_paginas integer := 0;
  v_inteira jsonb := public.pendencias_ler_aprovados();
begin
  loop
    t0 := clock_timestamp();
    v_pagina := public.pendencias_ler_aprovados(v_apos, 5000);
    v_ms := v_ms + extract(epoch from clock_timestamp() - t0) * 1000;
    v_paginas := v_paginas + 1;
    if v_primeira is null then
      v_primeira := v_pagina;
    elsif v_pagina -> 'listas' is distinct from v_primeira -> 'listas'
          or v_pagina ? 'ambiguos' or v_pagina ? 'pendencias' then
      raise exception 'Ensaio reprovado: página % com listas diferentes ou com ambiguos/pendências.', v_paginas;
    end if;
    v_linhas := v_linhas || (v_pagina -> 'linhas');
    v_apos := (v_pagina ->> 'proximo')::uuid;
    exit when v_apos is null;
  end loop;
  if v_linhas is distinct from v_inteira -> 'linhas'
     or (v_primeira - 'linhas' - 'lido_em' - 'proximo') is distinct from (v_inteira - 'linhas' - 'lido_em')
     or v_inteira ? 'proximo' then
    raise exception 'Ensaio reprovado: a leitura em páginas não junta a leitura inteira.';
  end if;
  insert into t_ensaio values ('depois', format('pendencias em %s páginas', v_paginas), round(v_ms),
                               md5((v_inteira - 'lido_em')::text), jsonb_array_length(v_linhas));
end;
$$;

select pg_temp.medir_analises('depois');

-- As chaves novas das análises: o código da vaga aparado e o nome não vazio.
do $$
begin
  if exists (
    select 1 from t_paginas p
      join public."TB_ANALISE_CURRICULAR" a on a.id = (p.linha ->> 'id')::uuid
     where p.fase = 'depois'
       and ((p.linha ->> 'vaga') is distinct from nullif(btrim(a.codigo_vaga), '')
            or (p.linha ->> 'nome_vaga') is distinct from case when nullif(btrim(a.nome_vaga), '') is not null then a.nome_vaga end)) then
    raise exception 'Ensaio reprovado: vaga/nome_vaga diferentes da análise.';
  end if;
end;
$$;

select pg_temp.caso_sync('depois', 'saude-indigena', 0, false);
select pg_temp.caso_sync('depois', 'saude-indigena', 5, false);
select pg_temp.caso_sync('depois', 'saude-indigena', 300, false);
select pg_temp.caso_sync('depois', 'saude-indigena', 0, true);
select pg_temp.caso_sync('depois', 'projetos', 0, false);
select pg_temp.caso_sync('depois', 'projetos', 3, false);

-- A leitura nova das listas e dos quadros responde (o resto da classificação sai do robô).
insert into t_ensaio
select 'depois', 'listas e quadros', null, md5(j::text), jsonb_array_length(j -> 'quadros')
  from (select public.conferencia_ler_listas_e_quadros() j) x;

do $$
begin
  if exists (
    select 1 from t_ensaio a
     where a.fase = 'antes'
       and not exists (select 1 from t_ensaio d where d.fase = 'depois' and d.caso = a.caso and d.h = a.h)) then
    raise exception 'Ensaio reprovado: %',
      (select json_agg(a.caso) from t_ensaio a
        where a.fase = 'antes'
          and not exists (select 1 from t_ensaio d where d.fase = 'depois' and d.caso = a.caso and d.h = a.h));
  end if;
end;
$$;

select coalesce(a.caso, d.caso) as caso, a.ms as ms_antes, d.ms as ms_depois, a.n as qt_antes, d.n as qt_depois,
       a.h = d.h as igual
  from (select * from t_ensaio where fase = 'antes') a
  full join (select * from t_ensaio where fase = 'depois') d on d.caso = a.caso
 order by 1;

rollback;

/*
  == PARIDADE da classificação (outro begin … rollback) ==
  O que conferencia_ler_classificacao entregava (vagas_sem_quadro, analises_alteradas, pelo banco)
  ao lado do que o robô novo usa (as páginas de conferencia_ler_analises com vaga e nome_vaga,
  conferencia_ler_listas_e_quadros e o contexto), na MESMA transação. A saída (um JSON) vai para
    python -I scripts/conferencias/paridade_do_quadro.py < saida.json
  que refaz em Python (regras.AnalisesDaClassificacao, regras.vagas_sem_quadro) e compara item a
  item, além de cada vaga distinta com private."FC_QUADRO_DA_VAGA". Montagem:
    { sed -n '/^-- == PARIDADE: antes ==/,/^-- == PARIDADE: aplicar a migration aqui ==/p' supabase/ensaios/20261103181500_conferencias_e_pendencias_leves.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261103181500_conferencias_e_pendencias_leves.sql;
      sed -n '/^-- == PARIDADE: depois ==/,$p' supabase/ensaios/20261103181500_conferencias_e_pendencias_leves.sql;
    } > /tmp/paridade.sql
*/
-- == PARIDADE: antes ==
begin;
set local statement_timeout = '20s';
create temporary table t_antiga on commit drop as select public.conferencia_ler_classificacao() as j;
create temporary table t_quadro_sql on commit drop as
select v.edital_id, v.nome_vaga, private."FC_QUADRO_DA_VAGA"(v.edital_id, v.nome_vaga) as quadro
  from (select distinct e.edital_id, a.nome_vaga
          from public."TB_ANALISE_CURRICULAR" a
          join private."FC_EDITAIS_POR_NUMERO"() e
            on e.area = a."CO_AREA" and e.numero = private."FC_NUMERO_EDITAL"(a.edital)
         where a.ativo and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
           and nullif(btrim(a.nome_vaga), '') is not null) v;
-- == PARIDADE: aplicar a migration aqui ==

-- == PARIDADE: depois ==
create temporary table t_linhas (l jsonb) on commit drop;
do $$
declare j jsonb; v_apos uuid;
begin
  loop
    j := public.conferencia_ler_analises(v_apos, 5000);
    insert into t_linhas
    select jsonb_build_object('edital', l -> 'edital', 'area', l -> 'area', 'vaga', l -> 'vaga',
                              'nome_vaga', l -> 'nome_vaga', 'atualizado', l -> 'atualizado')
      from jsonb_array_elements(j -> 'linhas') l;
    v_apos := (j ->> 'proximo')::uuid;
    exit when v_apos is null;
  end loop;
end;
$$;
select jsonb_build_object(
  'antiga', (select j - 'listas' - 'ajustes' from t_antiga),
  'nova', public.conferencia_ler_listas_e_quadros(),
  'contexto', public.conferencia_ler_contexto() -> 'editais',
  'linhas', (select jsonb_agg(l) from t_linhas),
  'quadro_sql', (select jsonb_agg(jsonb_build_array(q.edital_id, q.nome_vaga, q.quadro)) from t_quadro_sql q),
  'listas_iguais', (select (j -> 'listas') = (public.conferencia_ler_listas_e_quadros() -> 'listas')
                           and (j -> 'ajustes') = (public.conferencia_ler_listas_e_quadros() -> 'ajustes') from t_antiga)
) as paridade;
rollback;
