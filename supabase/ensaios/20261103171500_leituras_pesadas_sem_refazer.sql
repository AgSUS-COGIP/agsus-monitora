/*
  ENSAIO da migration 20261103171500_leituras_pesadas_sem_refazer.sql
  — begin … rollback. NÃO É MIGRATION; nada fica gravado.

  Montagem (como nos outros ensaios; os gatilhos de versão NÃO são postos, para
  não segurar as escritas nas fontes até o rollback — como no ensaio de
  20261029170000):
    { sed -n '/^-- == ANTES ==/,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261103171500_leituras_pesadas_sem_refazer.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' -e '/^notify pgrst/d' \
          -e 's/^select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();$/select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(p_gatilhos => false);/' \
          supabase/migrations/20261103171500_leituras_pesadas_sem_refazer.sql;
      sed -n '/^-- == DEPOIS ==/,$p' supabase/ensaios/20261103171500_leituras_pesadas_sem_refazer.sql;
    } > /tmp/ensaio.sql   (começa em begin e termina em rollback)

  Quem lê: a conta do setor (administrador global) e um analista do 114/2026,
  como role authenticated. O 114/2026 só é LIDO; as escritas do ensaio (E3 e
  E7) são num edital de treinamento e numa lista da Saúde Indígena, e somem no
  rollback.

  Reprova (raise) se:
    E1 fila (cada edital com pré-classificação × quem lê): a inteira mudar
       (jsonb sem gerado_em e sem marca), a 1ª parte da marca nova não for a
       marca de antes; a parcial com a marca de antes mudar; a parcial com a
       marca nova não vier vazia (marca, parcial, total_nucleo, candidatos e
       saiu vazios) — e a parcial de antes, no mesmo instante, trouxer algo
       que a junção da tela não daria igual (linha diferente da inteira, saiu
       não vazio, outro total, ou outro valor no resto da fila);
    E2 depois de uma escrita registrada numa fonte da fila, a parcial com a
       marca nova não for a parcial de sempre (igual à de antes);
    E3 com uma reserva vencida desde p_desde (edital de treinamento), a
       parcial vier vazia;
    E4 monitoramento operacional: as linhas mudarem; a versão nova não der
       inalterado; a versão de antes der inalterado;
    E5 listar_listas_aprovados mudar (md5);
    E6 listar_municipios_das_vagas_da_area mudar em alguma área (md5);
    E7 o gatilho novo marcar o pacote dos aprovados com update só da data da
       convocação ou sem mudança, ou deixar de marcar com mudança do processo SEI
       ou com a lista desativada; abrir_lista_aprovados mudar o pacote (sem
       versao e cache) depois de um update só da data da convocação.
  Mostra só tempos, tamanhos e se bateu (nenhum dado de pessoa).
*/
-- == ANTES ==
begin;
set local statement_timeout = '20s';
set local lock_timeout = '5s';

create temporary table t_quem (quem text primary key, claims text) on commit drop;
insert into t_quem values
  ('coordenacao', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated","email":"dados.recursoshumanos@agenciasus.org.br"}'),
  ('analista', '{"sub":"0fe8b974-bd07-4b78-9827-0c38cf37f748","role":"authenticated"}');
create temporary table t_r (fase text, rpc text, quem text, arg text, j jsonb, ms numeric, bytes bigint) on commit drop;
create temporary table t_ok (n serial, etapa text, detalhe text) on commit drop;
grant all on t_quem, t_r, t_ok to authenticated;
grant usage on sequence t_ok_n_seq to authenticated;

-- Uma chamada (sql devolve json/jsonb ou texto), como role authenticated de quem lê.
create or replace function pg_temp.chamar(p_fase text, p_rpc text, p_quem text, p_arg text, p_sql text)
returns jsonb language plpgsql as $$
declare
  t0 timestamptz;
  v text;
  j jsonb;
begin
  perform set_config('request.jwt.claims', (select q.claims from t_quem q where q.quem = p_quem), true);
  execute 'set local role authenticated';
  begin
    t0 := clock_timestamp();
    execute p_sql into v;
    j := v::jsonb;
  exception when others then
    j := jsonb_build_object('erro', sqlstate);
  end;
  insert into t_r values (p_fase, p_rpc, p_quem, p_arg, j,
    round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 1), octet_length(v));
  execute 'reset role';
  return j;
end;
$$;

-- As leituras de cada fase (a fila fica para a fase DEPOIS, que precisa das marcas).
create or replace function pg_temp.medir_leituras(p_fase text) returns void language plpgsql as $$
declare
  a text;
  i int;
begin
  for i in 1..2 loop
    perform pg_temp.chamar(p_fase, 'listas#' || i, 'coordenacao', '',
      'select coalesce(json_agg(x), ''[]'')::text from public.listar_listas_aprovados() x');
    perform pg_temp.chamar(p_fase, 'monitoramento#' || i, 'coordenacao', '',
      'select public.listar_monitoramento_operacional(null)::text');
    foreach a in array array['projetos', 'saude-indigena', 'sede'] loop
      perform pg_temp.chamar(p_fase, 'municipios#' || i, 'coordenacao', a,
        format('select public.listar_municipios_das_vagas_da_area(%L)::text', a));
    end loop;
  end loop;
end;
$$;

-- A fila de cada edital com pré-classificação, para cada pessoa: inteira e parcial.
create or replace function pg_temp.medir_fila(p_fase text, p_rotulo text default '') returns void language plpgsql as $$
declare
  e record;
  q record;
  f jsonb;
  m text;
begin
  for e in select distinct p."CO_MONITORAMENTO" as id from public."TB_PRE_CLASSIFICACAO" p order by 1 loop
    for q in select * from t_quem order by quem loop
      f := pg_temp.chamar(p_fase, 'fila_inteira' || p_rotulo, q.quem, e.id::text,
             format('select public.obter_fila_avaliacao_desde(%L, null, null)::text', e.id));
      continue when f ? 'erro';
      -- A parcial com a marca que esta fase deu (antes: a de sempre; depois: a nova).
      perform pg_temp.chamar(p_fase, 'fila_parcial' || p_rotulo, q.quem, e.id::text,
        format('select public.obter_fila_avaliacao_desde(%L, %L, %L)::text', e.id, f ->> 'gerado_em', f ->> 'marca'));
      -- Depois: a parcial com a marca de antes (a tela com a marca guardada antes de aplicar).
      if p_fase = 'depois' then
        select r.j ->> 'marca' into m from t_r r
         where r.fase = 'antes' and r.rpc = 'fila_inteira' and r.quem = q.quem and r.arg = e.id::text;
        perform pg_temp.chamar(p_fase, 'fila_parcial_marca_antiga' || p_rotulo, q.quem, e.id::text,
          format('select public.obter_fila_avaliacao_desde(%L, %L, %L)::text', e.id, f ->> 'gerado_em', m));
      end if;
    end loop;
  end loop;
end;
$$;

select pg_temp.medir_leituras('antes');
select pg_temp.medir_fila('antes');

-- E7 (antes): o gatilho de antes marca o pacote com update só da data da convocação.
create temporary table t_cand on commit drop as
select c.id, c.lista_id
  from public."TB_CANDIDATO_APROVADO" c
  join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
 where m."CO_AREA" = 'saude-indigena' and m.edital not like '114/2026%' and c.removido_em is null
   and c.status is not null and c.status <> 'Convocado'
 order by c.id limit 1;
do $$
begin
  if exists (select 1 from private."TL_ALTERACAO_CACHE" t where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = 'saude-indigena') then
    perform public.atualizar_cache_aprovados('saude-indigena');
  end if;
  update public."TB_CANDIDATO_APROVADO" c set "DT_CONVOCACAO" = coalesce(c."DT_CONVOCACAO", current_date) + 1
   where c.id = (select id from t_cand);
  insert into t_ok (etapa, detalhe) values ('E7 antes: data da convocação marcou o pacote',
    exists (select 1 from private."TL_ALTERACAO_CACHE" t where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = 'saude-indigena')::text);
end;
$$;
-- Abrir com o pacote vencido (a remontagem na leitura, como hoje) e de novo, já remontado.
select pg_temp.chamar('antes', 'abrir_vencido', 'coordenacao', 'saude-indigena',
  'select public.abrir_lista_aprovados(''saude-indigena'')::text');
select pg_temp.chamar('antes', 'abrir', 'coordenacao', 'saude-indigena',
  'select public.abrir_lista_aprovados(''saude-indigena'')::text');

-- == aplicar a migration aqui ==

-- == DEPOIS ==
select pg_temp.medir_leituras('depois');
select pg_temp.medir_fila('depois');
-- Abrir com o mesmo pacote de antes (nada mudou desde a remontagem).
select pg_temp.chamar('depois', 'abrir', 'coordenacao', 'saude-indigena',
  'select public.abrir_lista_aprovados(''saude-indigena'')::text');

do $$
declare
  r record;
  v_dif text;
begin
  -- E1. Fila.
  select string_agg(distinct a.quem || '/' || a.arg, ', ') into v_dif
    from t_r a join t_r d using (rpc, quem, arg)
   where a.fase = 'antes' and d.fase = 'depois' and a.rpc = 'fila_inteira'
     and ((a.j - 'gerado_em' - 'marca') is distinct from (d.j - 'gerado_em' - 'marca')
          or (a.j ? 'erro') is distinct from (d.j ? 'erro')
          or (not a.j ? 'erro' and split_part(d.j ->> 'marca', '.', 1) <> a.j ->> 'marca'));
  if v_dif is not null then raise exception 'E1 reprovado: a fila inteira mudou (%)', v_dif; end if;

  select string_agg(distinct a.quem || '/' || a.arg, ', ') into v_dif
    from t_r a join t_r d on d.quem = a.quem and d.arg = a.arg
   where a.fase = 'antes' and a.rpc = 'fila_parcial'
     and d.fase = 'depois' and d.rpc = 'fila_parcial_marca_antiga'
     and (a.j - 'gerado_em' - 'marca') is distinct from (d.j - 'gerado_em' - 'marca');
  if v_dif is not null then raise exception 'E1 reprovado: a parcial com a marca de antes mudou (%)', v_dif; end if;

  for r in
    select i.quem, i.arg, i.j as inteira, p.j as parcial, v.j as vazia
      from t_r i
      join t_r p on p.fase = 'depois' and p.rpc = 'fila_parcial_marca_antiga' and p.quem = i.quem and p.arg = i.arg
      join t_r v on v.fase = 'depois' and v.rpc = 'fila_parcial' and v.quem = i.quem and v.arg = i.arg
     where i.fase = 'depois' and i.rpc = 'fila_inteira' and not i.j ? 'erro'
  loop
    -- A vazia: só marca, parcial, total_nucleo, candidatos e saiu vazios.
    if r.vazia is distinct from jsonb_build_object(
         'marca', r.inteira ->> 'marca', 'parcial', true,
         'total_nucleo', jsonb_array_length(r.inteira -> 'candidatos'),
         'candidatos', '[]'::jsonb, 'saiu', '[]'::jsonb) then
      raise exception 'E1 reprovado: a parcial sem mudança não veio vazia em %/% (chaves: %)',
        r.quem, r.arg, (select array_agg(k) from jsonb_object_keys(r.vazia) k);
    end if;
    -- A parcial de sempre, no mesmo instante, não traz nada que a junção da tela mudaria.
    if (r.parcial -> 'saiu') <> '[]'::jsonb
       or (r.parcial ->> 'total_nucleo')::int <> jsonb_array_length(r.inteira -> 'candidatos')
       or exists (select 1 from jsonb_array_elements(r.parcial -> 'candidatos') c
                   where not exists (select 1 from jsonb_array_elements(r.inteira -> 'candidatos') x where x = c))
       or (r.parcial - array['gerado_em', 'marca', 'parcial', 'total_nucleo', 'candidatos', 'saiu'])
          is distinct from (r.inteira - array['gerado_em', 'marca', 'parcial', 'candidatos', 'vagas']) then
      raise exception 'E1 reprovado: a parcial de sempre traria mudança em %/% sem fonte mudada', r.quem, r.arg;
    end if;
    insert into t_ok (etapa, detalhe) values ('E1 ok', r.quem || ' / ' || r.arg || ' / ' ||
      jsonb_array_length(r.parcial -> 'candidatos') || ' linhas na parcial de sempre');
  end loop;

  -- E4. Monitoramento operacional.
  if exists (select 1 from t_r a join t_r d using (rpc, quem, arg)
              where a.fase = 'antes' and d.fase = 'depois' and a.rpc like 'monitoramento#%'
                and ((a.j - 'versao') is distinct from (d.j - 'versao') or d.j ? 'erro' or not d.j ? 'linhas')) then
    raise exception 'E4 reprovado: as linhas do monitoramento operacional mudaram';
  end if;

  -- E5 e E6.
  if exists (select 1 from t_r a join t_r d using (rpc, quem, arg)
              where a.fase = 'antes' and d.fase = 'depois' and a.rpc like 'listas#%'
                and md5(a.j::text) <> md5(d.j::text)) then
    raise exception 'E5 reprovado: listar_listas_aprovados mudou';
  end if;
  select string_agg(distinct a.arg, ', ') into v_dif
    from t_r a join t_r d using (rpc, quem, arg)
   where a.fase = 'antes' and d.fase = 'depois' and a.rpc like 'municipios#%'
     and md5(a.j::text) <> md5(d.j::text);
  if v_dif is not null then raise exception 'E6 reprovado: municípios mudaram em %', v_dif; end if;
  insert into t_ok (etapa, detalhe)
  select 'E5/E6 ok', a.rpc || ' ' || a.arg || ' md5 ' || md5(a.j::text)
    from t_r a where a.fase = 'antes' and (a.rpc = 'listas#1' or a.rpc = 'municipios#1');
end;
$$;

-- E4: a versão nova dá inalterado; a de antes, não.
do $$
declare
  v_nova text := (select r.j ->> 'versao' from t_r r where r.fase = 'depois' and r.rpc = 'monitoramento#1');
  v_antiga text := (select r.j ->> 'versao' from t_r r where r.fase = 'antes' and r.rpc = 'monitoramento#1');
  j jsonb;
begin
  j := pg_temp.chamar('depois', 'monitoramento_inalterado', 'coordenacao', '',
         format('select public.listar_monitoramento_operacional(%L)::text', v_nova));
  if j is distinct from jsonb_build_object('inalterado', true, 'versao', v_nova) then
    raise exception 'E4 reprovado: a versão nova não deu inalterado';
  end if;
  j := pg_temp.chamar('depois', 'monitoramento_versao_antiga', 'coordenacao', '',
         format('select public.listar_monitoramento_operacional(%L)::text', v_antiga));
  if j ? 'inalterado' then
    raise exception 'E4 reprovado: a versão de antes deu inalterado';
  end if;
  insert into t_ok (etapa, detalhe) values ('E4 ok', 'inalterado com a versão nova; payload com a de antes');
end;
$$;

-- E2: uma escrita registrada numa fonte da fila: a parcial volta a ser a de sempre.
insert into private."TL_VERSAO_FONTE" ("NO_FONTE") values ('public.TB_FICHA_ANALISE');
do $$
declare
  r record;
  p jsonb;
begin
  for r in select i.quem, i.arg, i.j, a.j as sempre
             from t_r i
             join t_r a on a.fase = 'depois' and a.rpc = 'fila_parcial_marca_antiga' and a.quem = i.quem and a.arg = i.arg
            where i.fase = 'depois' and i.rpc = 'fila_inteira' and not i.j ? 'erro' loop
    -- A marca nova de antes da escrita: a barata mudou, então a parcial de sempre.
    p := pg_temp.chamar('depois', 'fila_parcial_fonte_mudou', r.quem, r.arg,
           format('select public.obter_fila_avaliacao_desde(%L, %L, %L)::text', r.arg, r.j ->> 'gerado_em', r.j ->> 'marca'));
    if not p ? 'gerado_em' or (p - 'gerado_em' - 'marca') is distinct from (r.sempre - 'gerado_em' - 'marca') then
      raise exception 'E2 reprovado: com a fonte mudada, a parcial não foi a de sempre (%/%)', r.quem, r.arg;
    end if;
  end loop;
  insert into t_ok (etapa, detalhe) values ('E2 ok', 'fonte mudada: parcial de sempre');
end;
$$;

-- E3: uma reserva vencida desde p_desde (edital de treinamento): a parcial não vem vazia.
do $$
declare
  v_ficha uuid;
  e uuid;
  f jsonb;
  p jsonb;
begin
  select y."CO_FICHA_ANALISE", y."CO_MONITORAMENTO" into v_ficha, e
    from public."TB_FICHA_ANALISE" y
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = y."CO_MONITORAMENTO"
   where m.edital like 'Treinamento%' and y."TP_SITUACAO" in ('EM_ANALISE', 'REVISAR')
   order by 1 limit 1;
  if v_ficha is null then
    raise exception 'E3: nenhuma ficha em análise nos editais de treinamento';
  end if;
  f := pg_temp.chamar('depois', 'e3_inteira', 'coordenacao', e::text,
         format('select public.obter_fila_avaliacao_desde(%L, null, null)::text', e));
  p := pg_temp.chamar('depois', 'e3_vazia', 'coordenacao', e::text,
         format('select public.obter_fila_avaliacao_desde(%L, %L, %L)::text', e, f ->> 'gerado_em', f ->> 'marca'));
  if p ? 'gerado_em' then
    raise exception 'E3 reprovado: sem mudança, a parcial do treinamento não veio vazia';
  end if;
  -- Uma reserva que venceu há 1 s (sem gatilho de versão no ensaio: só a conferência das
  -- reservas vencidas pode mandar a parcial de sempre).
  update public."TB_FICHA_ANALISE" x
     set "CO_USUARIO_RESERVA" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43',
         "DT_RESERVA" = now() - interval '16 minutes',
         "DT_RESERVA_EXPIRA" = now() - interval '1 second'
   where x."CO_FICHA_ANALISE" = v_ficha;
  p := pg_temp.chamar('depois', 'e3_reserva_vencida', 'coordenacao', e::text,
         format('select public.obter_fila_avaliacao_desde(%L, %L, %L)::text', e, f ->> 'gerado_em', f ->> 'marca'));
  if not p ? 'gerado_em' or (p ->> 'parcial')::boolean is not true then
    raise exception 'E3 reprovado: com reserva vencida, a parcial veio vazia (ou inteira)';
  end if;
  insert into t_ok (etapa, detalhe) values ('E3 ok', 'reserva vencida: parcial de sempre');
end;
$$;

-- E7: o pacote dos aprovados só vence com mudança no que ele mostra.
do $$
declare
  c uuid := (select id from t_cand);
  v_antes jsonb;
  v_depois jsonb;
begin
  perform public.atualizar_cache_aprovados('saude-indigena');
  v_antes := (public.abrir_lista_aprovados('saude-indigena')::jsonb -> 'pacote') - 'versao' - 'cache';
  update public."TB_CANDIDATO_APROVADO" x set "DT_CONVOCACAO" = coalesce(x."DT_CONVOCACAO", current_date) + 1 where x.id = c;
  update public."TB_CANDIDATO_APROVADO" x set status = x.status, nome = x.nome where x.id = c;
  if exists (select 1 from private."TL_ALTERACAO_CACHE" t where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = 'saude-indigena') then
    raise exception 'E7 reprovado: data da convocação ou update sem mudança marcou o pacote';
  end if;
  -- Abrir depois do update só da data da convocação (antes desta migration: pacote vencido).
  v_depois := (pg_temp.chamar('depois', 'abrir_vencido', 'coordenacao', 'saude-indigena',
    'select public.abrir_lista_aprovados(''saude-indigena'')::text') -> 'pacote') - 'versao' - 'cache';
  if v_antes is distinct from v_depois then
    raise exception 'E7 reprovado: o pacote mudou com update só da data da convocação';
  end if;
  update public."TB_CANDIDATO_APROVADO" x set processo_sei = coalesce(x.processo_sei, '') || '-ensaio' where x.id = c;
  if not exists (select 1 from private."TL_ALTERACAO_CACHE" t where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = 'saude-indigena') then
    raise exception 'E7 reprovado: mudança do processo SEI não marcou o pacote';
  end if;
  perform public.atualizar_cache_aprovados('saude-indigena');
  update public."TB_LISTA_APROVADO" l set arquivo_nome = l.arquivo_nome where l.id = (select lista_id from t_cand);
  if exists (select 1 from private."TL_ALTERACAO_CACHE" t where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = 'saude-indigena') then
    raise exception 'E7 reprovado: update sem mudança na lista marcou o pacote';
  end if;
  update public."TB_LISTA_APROVADO" l set ativo = not coalesce(l.ativo, false) where l.id = (select lista_id from t_cand);
  if not exists (select 1 from private."TL_ALTERACAO_CACHE" t where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = 'saude-indigena') then
    raise exception 'E7 reprovado: lista desativada não marcou o pacote';
  end if;
  insert into t_ok (etapa, detalhe) values ('E7 ok', 'pacote só vence com mudança do que mostra; payload igual');
end;
$$;
do $$
begin
  if exists (select 1 from t_r a join t_r d using (rpc, quem, arg)
              where a.fase = 'antes' and d.fase = 'depois' and a.rpc = 'abrir'
                and ((a.j - 'pacote') is distinct from (d.j - 'pacote')
                     or ((a.j -> 'pacote') - 'versao' - 'cache') is distinct from ((d.j -> 'pacote') - 'versao' - 'cache'))) then
    raise exception 'E7 reprovado: abrir_lista_aprovados mudou';
  end if;
end;
$$;

-- As fontes das leituras novas (calculadas pelo código).
insert into t_ok (etapa, detalhe)
select 'fontes', f."NO_LEITURA" || ': ' || count(*) || ' tabelas'
  from private."TD_FONTE_DA_LEITURA" f
 where f."NO_LEITURA" in ('fila_avaliacao', 'monitoramento_operacional')
 group by f."NO_LEITURA";

select json_build_object(
  'resultado', (select json_agg(o.etapa || ': ' || o.detalhe order by o.n) from t_ok o),
  'tempos', (select json_agg(x order by x.rpc, x.arg, x.quem, x.fase) from (
     select fase, regexp_replace(rpc, '#[0-9]+$', '') as rpc, quem, left(arg, 8) as arg,
            array_agg(ms order by rpc) as ms, max(bytes) as bytes
       from t_r
      group by fase, regexp_replace(rpc, '#[0-9]+$', ''), quem, left(arg, 8)) x)) as ensaio;

rollback;
