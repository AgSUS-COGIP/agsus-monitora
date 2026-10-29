/*
  Ensaio de 20261029170000 (leituras por versão: a marca sai antes de montar).
  Sempre termina em rollback. Cole a migration no ponto marcado, SEM o
  begin/commit dela (o ensaio é uma transação só) e com a última chamada como
  FC_ATUALIZAR_FONTES_DAS_LEITURAS(p_gatilhos => false): as chamadas pesadas
  (E1, E2) rodam antes dos gatilhos, que entram logo antes de E3 — criar
  gatilho segura as escritas na tabela até o rollback, e assim seguram só por
  alguns segundos.

  Reprova (raise) se:
    E1  uma das sete RPCs, para o administrador global, devolver outro payload
        que a de antes (sem versao, gerado_em, generated_at e cache), ou não
        devolver `inalterado` com a versão que acabou de dar, ou devolver
        `inalterado` com uma versão velha;
    E2  quem não pode ler (outra área, sem sessão) passar pela marca: o erro
        tem de ser o mesmo da função de sempre, até com a versão do
        administrador na mão;
    E3  uma tabela do fecho do código de alguma leitura ficar fora da lista
        ou sem o gatilho TG_VERSAO_FONTE habilitado em ALWAYS;
    E4  uma escrita em QUALQUER fonte de uma leitura (insert/update/delete,
        mesmo de zero linhas) não mudar a marca dela; ou uma escrita numa
        tabela que não é fonte mudar;
    E5  uma mudança real (status de um aprovado) não fizer a RPC mandar o
        payload de novo para a versão anterior;
    E6  o pacote pronto (Análises/Entrevistas) mudar sem a marca mudar, ou a
        marca do pacote mudar por escrita nas tabelas de origem (o pacote só
        muda quando é remontado);
    E7  duas escritas na mesma transação gravarem duas linhas; a compactação
        mudar a soma; a escrita com session_replication_role = replica não
        contar; TRUNCATE não contar.
  No fim, mostra o tempo de cada RPC antes e depois (cheio e inalterado) e o
  tamanho do JSON.
*/
begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

-- Quem lê: o administrador global da conta do setor.
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated","email":"dados.recursoshumanos@agenciasus.org.br"}', true);

create temp table t_caso (
  n serial, rpc text, area text, escopo text, edital uuid, modulo text) on commit drop;
insert into t_caso (rpc, area, escopo, edital, modulo) values
  ('analises', 'saude-indigena', 'ativo', null, null),
  ('analises', 'projetos', 'ativo', null, null),
  ('analises', 'sede', 'inativo', null, null),
  ('entrevistas', 'saude-indigena', null, null, null),
  ('entrevistas', 'projetos', null, null, null),
  ('selecao', 'saude-indigena', null, null, null),
  ('selecao', 'projetos', null, null, null),
  ('acompanhamento', 'saude-indigena', null, null, null),
  ('acompanhamento', 'projetos', null, null, null),
  ('acompanhamento', 'sede', null, null, null),
  ('regra', null, null, 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0', null),
  ('regra', null, null, 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded', null),
  ('classificacao', null, null, 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0', null),
  ('avisos', null, null, null, null),
  ('avisos', 'projetos', null, null, 'analises');

create temp table t_medida (
  n integer, fase text, ms_cheio numeric, ms_inalterado numeric, bytes integer, payload jsonb, versao text) on commit drop;
create temp table t_resultado (etapa text, detalhe text) on commit drop;
grant all on t_caso, t_medida, t_resultado to authenticated;

create function pg_temp.chamar(c t_caso, p_versao text) returns jsonb language plpgsql as $$
begin
  return case c.rpc
    when 'analises' then public.get_analises_dashboard_payload_v2_se_mudou(c.escopo, c.area, p_versao)
    when 'entrevistas' then public.get_entrevistas_da_area_se_mudou(c.area, p_versao)
    when 'selecao' then public.get_selecao_da_area_se_mudou(c.area, p_versao)
    when 'acompanhamento' then public.listar_acompanhamento_da_visao_geral_se_mudou(c.area, p_versao)
    when 'regra' then public.obter_regra_analise_se_mudou(c.edital, p_versao)
    when 'classificacao' then public.obter_classificacao_do_edital_se_mudou(c.edital, p_versao)::jsonb
    when 'avisos' then public.listar_avisos_conferencia_se_mudou(c.area, c.modulo, p_versao)
  end;
end;
$$;

-- A função de sempre (sem versão), para conferir os erros de permissão.
create function pg_temp.chamar_base(c t_caso) returns jsonb language plpgsql as $$
begin
  return case c.rpc
    when 'analises' then public.get_analises_dashboard_payload_v2(c.escopo, c.area)::jsonb
    when 'entrevistas' then public.get_entrevistas_da_area(c.area)::jsonb
    when 'selecao' then public.get_selecao_da_area(c.area)::jsonb
    when 'acompanhamento' then public.listar_acompanhamento_da_visao_geral(c.area)
    when 'regra' then public.obter_regra_analise(c.edital)::jsonb
    when 'classificacao' then public.obter_classificacao_do_edital(c.edital)::jsonb
    when 'avisos' then public.listar_avisos_conferencia(c.area, c.modulo)::jsonb
  end;
end;
$$;

create function pg_temp.normal(p jsonb) returns jsonb language sql immutable as $$
  select p - array['versao', 'gerado_em', 'generated_at', 'cache']::text[];
$$;

create function pg_temp.medir(p_fase text) returns void language plpgsql as $$
declare
  c t_caso;
  t0 timestamptz;
  v jsonb;
  ms_cheio numeric;
  ms_inalt numeric;
  i integer;
begin
  for c in select * from t_caso order by n loop
    t0 := clock_timestamp();
    v := pg_temp.chamar(c, null);
    ms_cheio := extract(epoch from clock_timestamp() - t0) * 1000;
    t0 := clock_timestamp();
    for i in 1..3 loop
      perform pg_temp.chamar(c, v ->> 'versao');
    end loop;
    ms_inalt := extract(epoch from clock_timestamp() - t0) * 1000 / 3;
    insert into t_medida values (c.n, p_fase, round(ms_cheio, 1), round(ms_inalt, 1),
                                 octet_length(v::text), pg_temp.normal(v), v ->> 'versao');
  end loop;
end;
$$;

-- ANTES: as RPCs de hoje.
set local role authenticated;
select pg_temp.medir('antes');
reset role;

-- >>> cole aqui supabase/migrations/20261029170000_marca_barata_das_leituras_por_versao.sql
--     (sem begin/commit; a última chamada como FC_ATUALIZAR_FONTES_DAS_LEITURAS(p_gatilhos => false)) <<<

-- DEPOIS.
set local role authenticated;
select pg_temp.medir('depois');

-- E1. Mesmo payload; inalterado com a versão atual; cheio com a velha.
do $$
declare
  c t_caso;
  a t_medida;
  d t_medida;
  v jsonb;
begin
  for c in select * from t_caso order by n loop
    select * into a from t_medida m where m.n = c.n and m.fase = 'antes';
    select * into d from t_medida m where m.n = c.n and m.fase = 'depois';
    if a.payload is distinct from d.payload then
      raise exception 'E1 %: payload diferente do de antes', row_to_json(c);
    end if;
    if d.versao not like 'm1:%' then
      raise exception 'E1 %: versão sem marca: %', row_to_json(c), d.versao;
    end if;
    v := pg_temp.chamar(c, d.versao);
    if v <> jsonb_build_object('inalterado', true, 'versao', d.versao) then
      raise exception 'E1 %: a versão atual deveria devolver só inalterado: %', row_to_json(c), left(v::text, 200);
    end if;
    v := pg_temp.chamar(c, a.versao);
    if v ? 'inalterado' or pg_temp.normal(v) is distinct from d.payload then
      raise exception 'E1 %: a versão velha (md5) deveria devolver o payload', row_to_json(c);
    end if;
  end loop;
  insert into t_resultado values ('E1', 'ok: ' || (select count(*) from t_caso) || ' casos com o mesmo payload, inalterado e versão velha');
end;
$$;
reset role;

-- E2. Permissão: o mesmo erro da função de sempre, até com a versão do administrador.
create function pg_temp.desfecho(c t_caso, p_versao text, p_base boolean) returns text language plpgsql as $$
declare
  v jsonb;
begin
  if p_base then v := pg_temp.chamar_base(c); else v := pg_temp.chamar(c, p_versao); end if;
  return case when v ? 'inalterado' then 'inalterado' else 'payload' end;
exception when others then
  return 'erro ' || sqlstate || ' ' || sqlerrm;
end;
$$;

do $$
declare
  c t_caso;
  v_quem text;
  v_versao text;
  v_base text;
  v_nova text;
  v_com_versao text;
  v_casos integer := 0;
begin
  foreach v_quem in array array['f2de59ac-1b5d-451c-898d-487a3450bd2f', 'bffdcd6d-da96-4363-bb92-bb5d4914772c', ''] loop
    perform set_config('request.jwt.claims',
      case when v_quem = '' then '{"role":"anon"}'
           else json_build_object('sub', v_quem, 'role', 'authenticated')::text end, true);
    for c in select * from t_caso order by n loop
      select m.versao into v_versao from t_medida m where m.n = c.n and m.fase = 'depois';
      execute 'set local role ' || case when v_quem = '' then 'anon' else 'authenticated' end;
      v_base := pg_temp.desfecho(c, null, true);
      v_nova := pg_temp.desfecho(c, null, false);
      -- Com a versão do administrador (quem não pode ler não pode ganhar `inalterado`).
      -- Quem pode ler recebe o payload: a marca leva quem lê (E4); não repete a montagem aqui.
      v_com_versao := case when v_base like 'erro%' then pg_temp.desfecho(c, v_versao, false) end;
      reset role;
      -- anon não executa a RPC (sem grant): erro de permissão nas duas.
      if split_part(v_base, ' ', 2) is distinct from split_part(v_nova, ' ', 2)
         or (v_base like 'erro%') <> (v_nova like 'erro%') then
        raise exception 'E2 % %: função de sempre "%" × por versão "%"', v_quem, row_to_json(c), v_base, v_nova;
      end if;
      if v_com_versao = 'inalterado' then
        raise exception 'E2 % %: a versão do administrador deu inalterado', v_quem, row_to_json(c);
      end if;
      if (v_base like 'erro%') and split_part(v_com_versao, ' ', 2) is distinct from split_part(v_base, ' ', 2) then
        raise exception 'E2 % %: com versão "%" × função de sempre "%"', v_quem, row_to_json(c), v_com_versao, v_base;
      end if;
      v_casos := v_casos + 1;
    end loop;
  end loop;
  perform set_config('request.jwt.claims',
    '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated","email":"dados.recursoshumanos@agenciasus.org.br"}', true);
  insert into t_resultado values ('E2', 'ok: ' || v_casos || ' casos (2 usuários sem administrador e sem sessão) com o mesmo desfecho da função de sempre');
end;
$$;

-- Os gatilhos (o que a migration faz no fim).
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

-- E3. Cobertura: o fecho do código de cada leitura está na lista, e toda fonte tem o gatilho em ALWAYS.
do $$
declare
  v_faltas text;
begin
  select string_agg(l."NO_LEITURA" || ':' || f, ', ') into v_faltas
    from private."TD_LEITURA_POR_MARCA" l
   cross join lateral private."FC_FONTES_PELO_CODIGO"(l."DS_FUNCOES") f
   where not exists (select 1 from private."TD_FONTE_DA_LEITURA" x
                      where x."NO_LEITURA" = l."NO_LEITURA" and x."NO_FONTE" = f);
  if v_faltas is not null then raise exception 'E3: fontes fora da lista: %', v_faltas; end if;
  select string_agg(distinct f."NO_FONTE", ', ') into v_faltas
    from private."TD_FONTE_DA_LEITURA" f
   where not exists (
     select 1 from pg_trigger t
      where t.tgrelid = format('%I.%I', split_part(f."NO_FONTE", '.', 1), split_part(f."NO_FONTE", '.', 2))::regclass
        and t.tgname = 'TG_VERSAO_FONTE' and t.tgenabled = 'A'
        and (t.tgtype & 1) = 0                      -- por comando
        and (t.tgtype & (4 | 8 | 16 | 32)) = 60);   -- insert, delete, update e truncate
  if v_faltas is not null then raise exception 'E3: fontes sem o gatilho por comando em ALWAYS: %', v_faltas; end if;
  -- As sete RPCs por versão chamam a marca.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
       where p.proname like '%\_se\_mudou' and p.prosrc like '%FC_MARCA_DA_RPC%') <> 7 then
    raise exception 'E3: esperava 7 RPCs com FC_MARCA_DA_RPC';
  end if;
  if (select prosrc from pg_proc where proname = 'obter_pre_classificacao_se_mudou') like '%FC_MARCA_DA_RPC%' then
    raise exception 'E3: a pré-classificação não é desta migration';
  end if;
  insert into t_resultado
  select 'E3', 'ok: ' || l."NO_LEITURA" || ' ← ' || string_agg(f."NO_FONTE", ', ' order by f."NO_FONTE")
    from private."TD_LEITURA_POR_MARCA" l join private."TD_FONTE_DA_LEITURA" f using ("NO_LEITURA")
   group by l."NO_LEITURA";
end;
$$;

-- Uma escrita de zero linhas (o gatilho por comando dispara mesmo assim), como numa transação nova.
create function pg_temp.escrever(p_fonte text, p_tipo text) returns text language plpgsql as $$
declare
  v_tabela regclass := format('%I.%I', split_part(p_fonte, '.', 1), split_part(p_fonte, '.', 2))::regclass;
  v_coluna text;
begin
  perform set_config('agsus_versao_fonte.t' || v_tabela::oid::text, '', true);
  select a.attname into v_coluna from pg_attribute a
   where a.attrelid = v_tabela and a.attnum > 0 and not a.attisdropped
     and a.attidentity = '' and a.attgenerated = ''
   order by a.attnum limit 1;
  begin
    if p_tipo = 'update' then
      execute format('update %s set %I = %I where false', v_tabela, v_coluna, v_coluna);
    elsif p_tipo = 'delete' then
      execute format('delete from %s where false', v_tabela);
    else
      execute format('insert into %s (%I) select %I from %s where false', v_tabela, v_coluna, v_coluna, v_tabela);
    end if;
    return p_tipo;
  exception when others then
    -- Tabela que recusa o comando por gatilho (histórico imutável): o insert vazio.
    perform set_config('agsus_versao_fonte.t' || v_tabela::oid::text, '', true);
    execute format('insert into %s (%I) select %I from %s where false', v_tabela, v_coluna, v_coluna, v_tabela);
    return 'insert (' || p_tipo || ' recusado: ' || sqlerrm || ')';
  end;
end;
$$;

-- E4. Toda fonte muda a marca da leitura; uma tabela fora não muda.
do $$
declare
  f record;
  v_antes text;
  v_depois text;
  v_tipo text;
  v_n integer := 0;
begin
  for f in select * from private."TD_FONTE_DA_LEITURA" order by 1, 2 loop
    v_tipo := (array['update', 'delete', 'insert'])[1 + v_n % 3];
    v_antes := private."FC_MARCA_DA_LEITURA"(f."NO_LEITURA", 'x');
    perform pg_temp.escrever(f."NO_FONTE", v_tipo);
    v_depois := private."FC_MARCA_DA_LEITURA"(f."NO_LEITURA", 'x');
    if v_antes = v_depois then
      raise exception 'E4: % (%) não mudou a marca de %', f."NO_FONTE", v_tipo, f."NO_LEITURA";
    end if;
    v_n := v_n + 1;
  end loop;
  -- TB_CASO_AVISO_CONFERENCIA não é fonte da regra da análise.
  v_antes := private."FC_MARCA_DA_LEITURA"('regra_analise', 'x');
  perform pg_temp.escrever('public.TB_CASO_AVISO_CONFERENCIA', 'update');
  if private."FC_MARCA_DA_LEITURA"('regra_analise', 'x') <> v_antes then
    raise exception 'E4: escrita fora das fontes mudou a marca';
  end if;
  -- A marca é de quem lê.
  v_antes := private."FC_MARCA_DA_LEITURA"('regra_analise', 'x');
  perform set_config('request.jwt.claims', '{"sub":"f2de59ac-1b5d-451c-898d-487a3450bd2f","role":"authenticated"}', true);
  v_depois := private."FC_MARCA_DA_LEITURA"('regra_analise', 'x');
  perform set_config('request.jwt.claims',
    '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated","email":"dados.recursoshumanos@agenciasus.org.br"}', true);
  if v_antes = v_depois then raise exception 'E4: a marca não mudou com a pessoa'; end if;
  insert into t_resultado values ('E4', 'ok: ' || v_n || ' pares leitura × fonte mudam a marca (update/delete/insert de zero linhas); fora das fontes e outra pessoa conferidos');
end;
$$;

-- E5. Mudança real: status de um aprovado da área (e volta). A Visão geral manda de novo.
do $$
declare
  c t_caso;
  v_versao text;
  v_id uuid;
  v jsonb;
begin
  select * into c from t_caso where rpc = 'acompanhamento' and area = 'saude-indigena';
  select m.versao into v_versao from t_medida m where m.n = c.n and m.fase = 'depois';
  select ca.id into v_id
    from public."TB_CANDIDATO_APROVADO" ca join public."TB_LISTA_APROVADO" l on l.id = ca.lista_id
   where l.vigente and ca.removido_em is null limit 1;
  perform set_config('agsus_versao_fonte.t' || 'public."TB_CANDIDATO_APROVADO"'::regclass::oid::text, '', true);
  update public."TB_CANDIDATO_APROVADO" set status = status where id = v_id;
  set local role authenticated;
  v := pg_temp.chamar(c, v_versao);
  reset role;
  if v ? 'inalterado' then raise exception 'E5: mudança real não mandou o payload de novo'; end if;
  insert into t_resultado values ('E5', 'ok: update em TB_CANDIDATO_APROVADO → Visão geral manda o payload (versão ' || left(v ->> 'versao', 12) || '…)');
end;
$$;

-- E6. Pacote pronto: muda só quando o pacote muda.
do $$
declare
  v_a text;
  v_b text;
begin
  if exists (select 1 from private."TA_PAINEL_ANALISE" where "CO_AREA" = 'projetos' and "TP_ESCOPO" = 'ativo'
                and "DT_GERACAO" > now() - interval '24 hours') then
    v_a := private."FC_MARCA_DA_RPC"('get_analises_dashboard_payload_v2', p_area => 'projetos', p_escopo => 'ativo');
    perform pg_temp.escrever('public.TB_ANALISE_CURRICULAR', 'update');
    v_b := private."FC_MARCA_DA_RPC"('get_analises_dashboard_payload_v2', p_area => 'projetos', p_escopo => 'ativo');
    if v_a <> v_b then raise exception 'E6: a marca do pacote de análises mudou sem o pacote mudar'; end if;
    update private."TA_PAINEL_ANALISE" set "DT_GERACAO" = now() where "CO_AREA" = 'projetos' and "TP_ESCOPO" = 'ativo';
    v_b := private."FC_MARCA_DA_RPC"('get_analises_dashboard_payload_v2', p_area => 'projetos', p_escopo => 'ativo');
    if v_a = v_b then raise exception 'E6: o pacote de análises remontado não mudou a marca'; end if;
    insert into t_resultado values ('E6', 'ok: análises/projetos/ativo pela linha do pacote');
  else
    insert into t_resultado values ('E6', 'sem pacote de análises de projetos com menos de 24 h: pulado');
  end if;
  if exists (select 1 from private."TA_PAINEL_ENTREVISTA" where "CO_AREA" = 'saude-indigena') then
    v_a := private."FC_MARCA_DA_RPC"('get_entrevistas_da_area', p_area => 'saude-indigena');
    perform pg_temp.escrever('public.TB_ENTREVISTA', 'update');
    v_b := private."FC_MARCA_DA_RPC"('get_entrevistas_da_area', p_area => 'saude-indigena');
    if v_a <> v_b then raise exception 'E6: a marca do pacote de entrevistas mudou sem o pacote mudar'; end if;
    update private."TA_PAINEL_ENTREVISTA" set "DT_GERACAO" = now(), "DS_VERSAO_DADOS" = 'ensaio' where "CO_AREA" = 'saude-indigena';
    v_b := private."FC_MARCA_DA_RPC"('get_entrevistas_da_area', p_area => 'saude-indigena');
    if v_a = v_b then raise exception 'E6: o pacote de entrevistas remontado não mudou a marca'; end if;
    insert into t_resultado values ('E6', 'ok: entrevistas/saude-indigena pela linha do pacote');
  end if;
end;
$$;

-- E7. Uma linha por transação; compactação; réplica; truncate.
do $$
declare
  v_linhas integer;
  v_soma_antes numeric;
  v_soma_depois numeric;
begin
  perform set_config('agsus_versao_fonte.t' || 'public."TB_AREA"'::regclass::oid::text, '', true);
  select count(*) into v_linhas from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_AREA';
  update public."TB_AREA" set "NO_AREA" = "NO_AREA" where false;
  update public."TB_AREA" set "NO_AREA" = "NO_AREA" where false;
  delete from public."TB_AREA" where false;
  if (select count(*) from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_AREA') <> v_linhas + 1 then
    raise exception 'E7: três comandos na mesma transação deveriam gravar uma linha';
  end if;

  select sum("QT_ALTERACAO") into v_soma_antes from private."TL_VERSAO_FONTE";
  perform private."FC_COMPACTAR_VERSAO_FONTE"();
  select sum("QT_ALTERACAO") into v_soma_depois from private."TL_VERSAO_FONTE";
  if v_soma_antes <> v_soma_depois
     or exists (select 1 from private."TL_VERSAO_FONTE" group by "NO_FONTE" having count(*) > 1) then
    raise exception 'E7: compactação mudou a soma (% → %) ou deixou mais de uma linha', v_soma_antes, v_soma_depois;
  end if;

  set local session_replication_role = replica;
  v_soma_antes := (select sum("QT_ALTERACAO") from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_AREA');
  perform set_config('agsus_versao_fonte.t' || 'public."TB_AREA"'::regclass::oid::text, '', true);
  update public."TB_AREA" set "NO_AREA" = "NO_AREA" where false;
  set local session_replication_role = origin;
  if (select sum("QT_ALTERACAO") from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_AREA') <> v_soma_antes + 1 then
    raise exception 'E7: escrita com session_replication_role = replica não contou';
  end if;

  create temp table t_fonte_ensaio (x integer) on commit drop;
  create trigger "TG_VERSAO_FONTE" after insert or update or delete or truncate on t_fonte_ensaio
    for each statement execute function private."FC_TG_VERSAO_FONTE"();
  truncate t_fonte_ensaio;
  if not exists (select 1 from private."TL_VERSAO_FONTE" where "NO_FONTE" like 'pg_temp%.t_fonte_ensaio') then
    raise exception 'E7: truncate não contou';
  end if;
  insert into t_resultado values ('E7', 'ok: uma linha por transação, compactação com a mesma soma, réplica e truncate contam');
end;
$$;

-- Resultado: as conferências e o tempo de cada RPC (ms) antes → depois.
select r.etapa, r.detalhe, null::text as rpc, null::numeric as antes_cheio, null::numeric as antes_inalterado,
       null::numeric as depois_cheio, null::numeric as depois_inalterado, null::integer as bytes_cheio
  from t_resultado r
union all
select 'tempo', concat_ws(' ', c.area, c.escopo, c.edital, c.modulo), c.rpc,
       a.ms_cheio, a.ms_inalterado, d.ms_cheio, d.ms_inalterado, d.bytes
  from t_caso c
  join t_medida a on a.n = c.n and a.fase = 'antes'
  join t_medida d on d.n = c.n and d.fase = 'depois';

rollback;
