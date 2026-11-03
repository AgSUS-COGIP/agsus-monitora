/*
  Ensaio de 20261103150000 (a marca só muda com mudança de verdade; cargas sem
  regravar linha igual; work_mem). Sempre termina em rollback. Cole a
  migration no ponto marcado, SEM o begin/commit dela (o ensaio é uma
  transação só). A migration põe os gatilhos no fim (FC_ATUALIZAR_FONTES_DAS_
  LEITURAS): dali até o rollback as escritas nas fontes esperam — o ensaio é
  curto (sem as chamadas pesadas de 20261029170000).

  Fica igual e não é refeito aqui: as sete RPCs `*_se_mudou`,
  FC_MARCA_DA_LEITURA e FC_MARCA_DA_RPC (payload e permissão: E1 e E2 do
  ensaio de 20261029170000). E9 confere `inalterado` e o payload de novo em
  três delas.

  Reprova (raise) se:
    E3  uma tabela do fecho de alguma leitura ficar fora da lista; uma fonte
        ficar sem os quatro gatilhos (INS/DEL/TRUNC por comando; UPD por
        comando com tabela de transição, ou por linha com UPDATE OF quando a
        fonte tem coluna em TD_COLUNA_SEM_MARCA) em ALWAYS; sobrar o
        "TG_VERSAO_FONTE" antigo; uma coluna fora da marca ser citada no
        código de uma leitura da fonte;
    E4  uma escrita REAL (uma linha) em qualquer fonte não mudar a marca da
        leitura; um comando de 0 linhas (update/delete/insert) mudar; uma
        escrita fora das fontes mudar; a marca não mudar com a pessoa;
    E5  uma mudança real (status de um aprovado) não fizer a RPC mandar o
        payload de novo para a versão anterior;
    E6  o pacote pronto (Análises/Entrevistas) mudar sem o pacote mudar, ou
        não mudar quando o pacote muda;
    E7  duas escritas reais na mesma transação gravarem duas linhas; a
        compactação mudar a soma; a escrita real com
        session_replication_role = replica não contar (ou a de 0 linhas
        contar); TRUNCATE não contar;
    E8  a foto/avatar no perfil (só essas colunas), ou a batida de presença,
        mudar a marca de alguma das 9 leituras; a presença regravar o perfil
        com a mesma foto; uma mudança real no perfil (nome) não mudar;
    E9  a RPC não devolver `inalterado` com a versão que acabou de dar, ou
        deixar de devolver depois de foto/presença/0 linhas; ou devolver
        `inalterado` depois de uma escrita real;
    E10 a carga da Seleção regravar vaga igual, não gravar a que mudou,
        mudar a versão da fonte num lote só de linhas iguais, ou
        finalizar_sync_selecao desativar vaga que veio igual na carga (ou não
        desativar a que não veio; ou deixar chave de carga fechada);
    E11 o mesmo para as Entrevistas (sincronizar/finalizar_sync_entrevistas,
        área saude-indigena);
    E12 work_mem diferente de 16MB nas cinco funções, ou o 64MB de
        get_analises_dashboard_payload_v2 trocado.
  Nada roda carga de verdade: os lotes são linhas do próprio banco, dentro
  desta transação. FC_ATUALIZAR_KPIS_PELA_SELECAO não é chamado (recalcularia
  os KPIs de todo edital, inclusive o 114/2026): em E10 ele é trocado por um
  stub só dentro da transação.
*/
begin;

set local statement_timeout = '15s';
set local lock_timeout = '5s';

-- Quem lê: o administrador global da conta do setor.
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated","email":"dados.recursoshumanos@agenciasus.org.br"}', true);

create temp table t_resultado (n serial, etapa text, detalhe text) on commit drop;

-- >>> cole aqui supabase/migrations/20261103150000_marca_so_com_mudanca_real.sql (sem begin/commit) <<<

-- Uma escrita como numa transação nova (a marca da transação é uma configuração local).
create function pg_temp.nova_transacao(p_tabela regclass) returns void language sql as $$
  select set_config('agsus_versao_fonte.t' || p_tabela::oid::text, '', true);
$$;

-- Escrita de 0 linhas (update/delete/insert … where false).
create function pg_temp.escrever_nada(p_fonte text, p_tipo text) returns void language plpgsql as $$
declare
  v_tabela regclass := format('%I.%I', split_part(p_fonte, '.', 1), split_part(p_fonte, '.', 2))::regclass;
  v_coluna text;
begin
  perform pg_temp.nova_transacao(v_tabela);
  select a.attname into v_coluna from pg_attribute a
   where a.attrelid = v_tabela and a.attnum > 0 and not a.attisdropped
     and a.attidentity = '' and a.attgenerated = ''
   order by a.attnum limit 1;
  if p_tipo = 'update' then
    execute format('update %s set %I = %I where false', v_tabela, v_coluna, v_coluna);
  elsif p_tipo = 'delete' then
    execute format('delete from %s where false', v_tabela);
  else
    execute format('insert into %s (%I) select %I from %s where false', v_tabela, v_coluna, v_coluna, v_tabela);
  end if;
end;
$$;

-- Escrita real de UMA linha: update da primeira coluna da marca para o mesmo valor; se a
-- tabela recusa update, delete de uma linha; se recusa os dois (histórico), insert da cópia. Tabela vazia: nada.
create function pg_temp.escrever_uma(p_fonte text) returns text language plpgsql as $$
declare
  v_tabela regclass := format('%I.%I', split_part(p_fonte, '.', 1), split_part(p_fonte, '.', 2))::regclass;
  v_coluna text;
  v_n integer;
begin
  perform pg_temp.nova_transacao(v_tabela);
  select a.attname into v_coluna from pg_attribute a
   where a.attrelid = v_tabela and a.attnum > 0 and not a.attisdropped
     and a.attidentity = '' and a.attgenerated = ''
     and not exists (select 1 from private."TD_COLUNA_SEM_MARCA" c
                      where c."NO_FONTE" = p_fonte and c."NO_COLUNA" = a.attname)
   order by a.attnum limit 1;
  begin
    execute format('update %s set %I = %I where ctid = (select ctid from %s limit 1)',
                   v_tabela, v_coluna, v_coluna, v_tabela);
    get diagnostics v_n = row_count;
    return case when v_n = 1 then 'update' else 'vazia' end;
  exception when others then
    perform pg_temp.nova_transacao(v_tabela);
    begin
      execute format('delete from %s where ctid = (select ctid from %s limit 1)', v_tabela, v_tabela);
      get diagnostics v_n = row_count;
      return case when v_n = 1 then 'delete' else 'vazia' end;
    exception when others then
      -- Histórico que não aceita update nem delete: insere a cópia de uma linha (sem as
      -- colunas com default/identidade, que ganham valor novo).
      perform pg_temp.nova_transacao(v_tabela);
      begin
        select string_agg(format('%I', a.attname), ', ' order by a.attnum) into v_coluna
          from pg_attribute a
         where a.attrelid = v_tabela and a.attnum > 0 and not a.attisdropped
           and a.attidentity = '' and a.attgenerated = '' and not a.atthasdef;
        execute format('insert into %s (%s) select %s from %s limit 1', v_tabela, v_coluna, v_coluna, v_tabela);
        get diagnostics v_n = row_count;
        return case when v_n = 1 then 'insert' else 'vazia' end;
      exception when others then
        return 'recusada: ' || sqlerrm;
      end;
    end;
  end;
end;
$$;

-- E3. Cobertura: fecho na lista; os quatro gatilhos em ALWAYS; nada do antigo; colunas fora não citadas.
do $$
declare
  v_faltas text;
  v_n integer;
begin
  select string_agg(l."NO_LEITURA" || ':' || f, ', ') into v_faltas
    from private."TD_LEITURA_POR_MARCA" l
   cross join lateral private."FC_FONTES_PELO_CODIGO"(l."DS_FUNCOES") f
   where not exists (select 1 from private."TD_FONTE_DA_LEITURA" x
                      where x."NO_LEITURA" = l."NO_LEITURA" and x."NO_FONTE" = f);
  if v_faltas is not null then raise exception 'E3: fontes fora da lista: %', v_faltas; end if;

  if exists (select 1 from pg_trigger t where t.tgname = 'TG_VERSAO_FONTE') then
    raise exception 'E3: sobrou o gatilho antigo TG_VERSAO_FONTE';
  end if;

  with f as (
    select distinct x."NO_FONTE" as fonte,
           format('%I.%I', split_part(x."NO_FONTE", '.', 1), split_part(x."NO_FONTE", '.', 2))::regclass as rel,
           exists (select 1 from private."TD_COLUNA_SEM_MARCA" c where c."NO_FONTE" = x."NO_FONTE") as com_fora
      from private."TD_FONTE_DA_LEITURA" x
  ), esperado as (
    -- tgtype: 1 por linha; 4 insert, 8 delete, 16 update, 32 truncate.
    select f.fonte, f.rel, g.nome, g.tipo, g.transicao
      from f
     cross join lateral (values
       ('TG_VERSAO_FONTE_INS', 4, 'novas'),
       ('TG_VERSAO_FONTE_DEL', 8, 'antigas'),
       ('TG_VERSAO_FONTE_TRUNC', 32, null),
       ('TG_VERSAO_FONTE_UPD', case when f.com_fora then 16 | 1 else 16 end,
        case when f.com_fora then null else 'novas' end)) g(nome, tipo, transicao)
  )
  select string_agg(e.fonte || ':' || e.nome, ', ') into v_faltas
    from esperado e
   where not exists (
     select 1 from pg_trigger t
      where t.tgrelid = e.rel and t.tgname = e.nome and t.tgenabled = 'A'
        and (t.tgtype & (1 | 4 | 8 | 16 | 32)) = e.tipo
        and t.tgnewtable is not distinct from case when e.transicao = 'novas' then 'novas' end
        and t.tgoldtable is not distinct from case when e.transicao = 'antigas' then 'antigas' end);
  if v_faltas is not null then raise exception 'E3: gatilhos faltando ou diferentes: %', v_faltas; end if;

  -- O UPD do perfil: UPDATE OF todas as colunas, menos as de foto/avatar.
  select count(*) into v_n
    from pg_trigger t
    join pg_attribute a on a.attrelid = t.tgrelid and a.attnum = any (t.tgattr::smallint[])
   where t.tgrelid = 'public."TB_PERFIL_USUARIO"'::regclass and t.tgname = 'TG_VERSAO_FONTE_UPD'
     and a.attname in ('google_avatar_url', 'avatar_source', 'avatar_url', 'avatar_config');
  if v_n <> 0 then raise exception 'E3: o UPD do perfil ainda olha foto/avatar'; end if;
  select count(*) into v_n
    from pg_trigger t, pg_attribute a
   where t.tgrelid = 'public."TB_PERFIL_USUARIO"'::regclass and t.tgname = 'TG_VERSAO_FONTE_UPD'
     and a.attrelid = t.tgrelid and a.attnum > 0 and not a.attisdropped
     and a.attname not in ('google_avatar_url', 'avatar_source', 'avatar_url', 'avatar_config')
     and not (a.attnum = any (t.tgattr::smallint[]));
  if v_n <> 0 then raise exception 'E3: o UPD do perfil deixou de fora % coluna(s) da marca', v_n; end if;

  -- Coluna fora da marca citada no código de uma leitura da fonte.
  select string_agg(distinct l."NO_LEITURA" || ':' || c."NO_COLUNA", ', ') into v_faltas
    from private."TD_LEITURA_POR_MARCA" l
    join private."TD_FONTE_DA_LEITURA" f on f."NO_LEITURA" = l."NO_LEITURA"
    join private."TD_COLUNA_SEM_MARCA" c on c."NO_FONTE" = f."NO_FONTE"
   where private."FC_CODIGO_DA_LEITURA"(l."DS_FUNCOES") ~ ('\m' || c."NO_COLUNA" || '\M');
  if v_faltas is not null then raise exception 'E3: coluna fora da marca citada: %', v_faltas; end if;

  insert into t_resultado (etapa, detalhe)
  select 'E3', 'ok: ' || count(distinct f."NO_FONTE") || ' fontes de ' || count(distinct f."NO_LEITURA")
         || ' leituras com INS/UPD/DEL/TRUNC em ALWAYS; perfil com UPDATE OF ' ||
         (select count(*) from pg_trigger t, unnest(t.tgattr::smallint[]) x
           where t.tgrelid = 'public."TB_PERFIL_USUARIO"'::regclass and t.tgname = 'TG_VERSAO_FONTE_UPD')
         || ' colunas (sem foto/avatar); nenhum TG_VERSAO_FONTE antigo'
    from private."TD_FONTE_DA_LEITURA" f;
end;
$$;

-- E6. Pacote pronto: muda só quando o pacote muda (antes de E4, que suja o cache das análises).
do $$
declare
  v_a text;
  v_b text;
begin
  -- (TB_FICHA_ANALISE: fonte do painel montado na hora sem gatilho de cache; uma escrita em
  -- TB_ANALISE_CURRICULAR marca o cache como sujo e, desde 20261029192443, o pacote sujo
  -- não é servido — a marca muda de propósito.)
  if exists (select 1 from private."TA_PAINEL_ANALISE" where "CO_AREA" = 'projetos' and "TP_ESCOPO" = 'ativo'
                and "DT_GERACAO" > now() - interval '24 hours')
     and not private."FC_CACHE_DESATUALIZADO"('ANALISES', 'projetos') then
    v_a := private."FC_MARCA_DA_RPC"('get_analises_dashboard_payload_v2', p_area => 'projetos', p_escopo => 'ativo');
    perform pg_temp.escrever_uma('public.TB_FICHA_ANALISE');
    v_b := private."FC_MARCA_DA_RPC"('get_analises_dashboard_payload_v2', p_area => 'projetos', p_escopo => 'ativo');
    if v_a <> v_b then raise exception 'E6: a marca do pacote de análises mudou sem o pacote mudar'; end if;
    update private."TA_PAINEL_ANALISE" set "DT_GERACAO" = now() where "CO_AREA" = 'projetos' and "TP_ESCOPO" = 'ativo';
    v_b := private."FC_MARCA_DA_RPC"('get_analises_dashboard_payload_v2', p_area => 'projetos', p_escopo => 'ativo');
    if v_a = v_b then raise exception 'E6: o pacote de análises remontado não mudou a marca'; end if;
    insert into t_resultado (etapa, detalhe) values ('E6', 'ok: análises/projetos/ativo pela linha do pacote');
  else
    insert into t_resultado (etapa, detalhe) values ('E6', 'sem pacote limpo de análises de projetos com menos de 24 h: pulado');
  end if;
  if exists (select 1 from private."TA_PAINEL_ENTREVISTA" where "CO_AREA" = 'saude-indigena') then
    v_a := private."FC_MARCA_DA_RPC"('get_entrevistas_da_area', p_area => 'saude-indigena');
    perform pg_temp.escrever_uma('public.TB_ENTREVISTA');
    v_b := private."FC_MARCA_DA_RPC"('get_entrevistas_da_area', p_area => 'saude-indigena');
    if v_a <> v_b then raise exception 'E6: a marca do pacote de entrevistas mudou sem o pacote mudar'; end if;
    update private."TA_PAINEL_ENTREVISTA" set "DT_GERACAO" = now(), "DS_VERSAO_DADOS" = 'ensaio' where "CO_AREA" = 'saude-indigena';
    v_b := private."FC_MARCA_DA_RPC"('get_entrevistas_da_area', p_area => 'saude-indigena');
    if v_a = v_b then raise exception 'E6: o pacote de entrevistas remontado não mudou a marca'; end if;
    insert into t_resultado (etapa, detalhe) values ('E6', 'ok: entrevistas/saude-indigena pela linha do pacote');
  end if;
end;
$$;

-- E4. Escrita real de uma linha muda a marca; 0 linhas não muda; fora das fontes e outra pessoa.
do $$
declare
  f record;
  v_antes text;
  v_depois text;
  v_tipo text;
  v_escrita text;
  v_reais integer := 0;
  v_vazias text[] := '{}';
  v_recusadas text[] := '{}';
  v_nadas integer := 0;
  v_i integer := 0;
begin
  for f in select * from private."TD_FONTE_DA_LEITURA" order by 1, 2 loop
    -- 0 linhas: update, delete e insert (rodízio).
    v_tipo := (array['update', 'delete', 'insert'])[1 + v_i % 3];
    v_i := v_i + 1;
    v_antes := private."FC_MARCA_DA_LEITURA"(f."NO_LEITURA", 'x');
    perform pg_temp.escrever_nada(f."NO_FONTE", v_tipo);
    if private."FC_MARCA_DA_LEITURA"(f."NO_LEITURA", 'x') <> v_antes then
      raise exception 'E4: % (% de 0 linhas) mudou a marca de %', f."NO_FONTE", v_tipo, f."NO_LEITURA";
    end if;
    v_nadas := v_nadas + 1;
    -- Uma linha de verdade.
    v_escrita := pg_temp.escrever_uma(f."NO_FONTE");
    v_depois := private."FC_MARCA_DA_LEITURA"(f."NO_LEITURA", 'x');
    if v_escrita in ('update', 'delete', 'insert') then
      if v_antes = v_depois then
        raise exception 'E4: % (% de 1 linha) não mudou a marca de %', f."NO_FONTE", v_escrita, f."NO_LEITURA";
      end if;
      v_reais := v_reais + 1;
    elsif v_escrita = 'vazia' then
      v_vazias := v_vazias || (f."NO_FONTE");
    else
      v_recusadas := v_recusadas || (f."NO_FONTE" || ' ' || v_escrita);
    end if;
  end loop;
  if cardinality(v_recusadas) > 0 then
    raise exception 'E4: fontes sem escrita real possível: %', array_to_string(v_recusadas, '; ');
  end if;

  -- Escrita real fora das fontes: TB_PRESENCA_ONLINE_MONITORA não é fonte de nenhuma leitura.
  v_antes := private."FC_MARCA_DA_LEITURA"('regra_analise', 'x');
  perform pg_temp.nova_transacao('public."TB_PRESENCA_ONLINE_MONITORA"');
  update public."TB_PRESENCA_ONLINE_MONITORA" set seen_at = seen_at
   where ctid = (select ctid from public."TB_PRESENCA_ONLINE_MONITORA" limit 1);
  if private."FC_MARCA_DA_LEITURA"('regra_analise', 'x') <> v_antes then
    raise exception 'E4: escrita fora das fontes mudou a marca';
  end if;
  -- A marca é de quem lê.
  perform set_config('request.jwt.claims', '{"sub":"f2de59ac-1b5d-451c-898d-487a3450bd2f","role":"authenticated"}', true);
  v_depois := private."FC_MARCA_DA_LEITURA"('regra_analise', 'x');
  perform set_config('request.jwt.claims',
    '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated","email":"dados.recursoshumanos@agenciasus.org.br"}', true);
  if v_antes = v_depois then raise exception 'E4: a marca não mudou com a pessoa'; end if;

  insert into t_resultado (etapa, detalhe) values ('E4',
    'ok: ' || v_nadas || ' pares leitura × fonte não mudam com 0 linhas (update/delete/insert); '
    || v_reais || ' mudam com 1 linha real'
    || case when cardinality(v_vazias) > 0
            then '; tabela vazia (sem linha para escrever): ' || array_to_string(array(select distinct x from unnest(v_vazias) x order by 1), ', ')
            else '' end
    || '; fora das fontes e outra pessoa conferidos');
end;
$$;

-- E5. Mudança real: status de um aprovado (e mesmo valor). A Visão geral manda de novo.
do $$
declare
  v_versao text;
  v_id uuid;
  v jsonb;
begin
  set local role authenticated;
  v_versao := public.listar_acompanhamento_da_visao_geral_se_mudou('saude-indigena', null) ->> 'versao';
  reset role;
  select ca.id into v_id
    from public."TB_CANDIDATO_APROVADO" ca join public."TB_LISTA_APROVADO" l on l.id = ca.lista_id
   where l.vigente and ca.removido_em is null limit 1;
  perform pg_temp.nova_transacao('public."TB_CANDIDATO_APROVADO"');
  update public."TB_CANDIDATO_APROVADO" set status = status where id = v_id;
  set local role authenticated;
  v := public.listar_acompanhamento_da_visao_geral_se_mudou('saude-indigena', v_versao);
  reset role;
  if v ? 'inalterado' then raise exception 'E5: mudança real não mandou o payload de novo'; end if;
  insert into t_resultado (etapa, detalhe) values ('E5',
    'ok: update de 1 linha em TB_CANDIDATO_APROVADO → Visão geral manda o payload (versão ' || left(v ->> 'versao', 12) || '…)');
end;
$$;

-- E7. Uma linha por transação; compactação; réplica; truncate.
do $$
declare
  v_linhas integer;
  v_soma_antes numeric;
  v_soma_depois numeric;
begin
  perform pg_temp.nova_transacao('public."TB_AREA"');
  select count(*) into v_linhas from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_AREA';
  update public."TB_AREA" set "NO_AREA" = "NO_AREA" where "CO_AREA" = 'projetos';
  update public."TB_AREA" set "NO_AREA" = "NO_AREA" where "CO_AREA" = 'sede';
  update public."TB_AREA" set "NO_AREA" = "NO_AREA" where false;
  if (select count(*) from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_AREA') <> v_linhas + 1 then
    raise exception 'E7: dois updates reais (e um de 0 linhas) na mesma transação deveriam gravar uma linha';
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
  perform pg_temp.nova_transacao('public."TB_AREA"');
  update public."TB_AREA" set "NO_AREA" = "NO_AREA" where false;
  if (select sum("QT_ALTERACAO") from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_AREA') <> v_soma_antes then
    set local session_replication_role = origin;
    raise exception 'E7: comando de 0 linhas com session_replication_role = replica contou';
  end if;
  update public."TB_AREA" set "NO_AREA" = "NO_AREA" where "CO_AREA" = 'projetos';
  set local session_replication_role = origin;
  if (select sum("QT_ALTERACAO") from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_AREA') <> v_soma_antes + 1 then
    raise exception 'E7: escrita real com session_replication_role = replica não contou';
  end if;

  create temp table t_fonte_ensaio (x integer) on commit drop;
  create trigger "TG_VERSAO_FONTE_TRUNC" after truncate on t_fonte_ensaio
    for each statement execute function private."FC_TG_VERSAO_FONTE"();
  truncate t_fonte_ensaio;
  if not exists (select 1 from private."TL_VERSAO_FONTE" where "NO_FONTE" like 'pg_temp%.t_fonte_ensaio') then
    raise exception 'E7: truncate não contou';
  end if;
  insert into t_resultado (etapa, detalhe) values ('E7',
    'ok: uma linha por transação, compactação com a mesma soma, réplica (0 linhas não conta, 1 linha conta) e truncate conta');
end;
$$;

-- E8. Foto/avatar e a batida de presença não mudam marca nenhuma; o nome muda.
do $$
declare
  v_antes text[];
  v_depois text[];
  v_xmin xid;
  v_xmin_depois xid;
  v_foto_igual boolean;
  v_r jsonb;
begin
  select array_agg(private."FC_MARCA_DA_LEITURA"(l."NO_LEITURA", 'x') order by l."NO_LEITURA") into v_antes
    from private."TD_LEITURA_POR_MARCA" l;

  -- Só foto/avatar, numa linha de verdade.
  perform pg_temp.nova_transacao('public."TB_PERFIL_USUARIO"');
  update public."TB_PERFIL_USUARIO"
     set google_avatar_url = coalesce(google_avatar_url, '') || '#ensaio',
         avatar_url = avatar_url, avatar_source = avatar_source, avatar_config = avatar_config
   where user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  if not found then raise exception 'E8: perfil da conta do setor não encontrado'; end if;
  select array_agg(private."FC_MARCA_DA_LEITURA"(l."NO_LEITURA", 'x') order by l."NO_LEITURA") into v_depois
    from private."TD_LEITURA_POR_MARCA" l;
  if v_antes is distinct from v_depois then raise exception 'E8: foto/avatar mudou a marca'; end if;

  -- A batida de presença (a foto volta à do login, se houver; a marca não muda).
  perform pg_temp.nova_transacao('public."TB_PERFIL_USUARIO"');
  v_r := public.registrar_presenca_monitora('ensaio');
  select array_agg(private."FC_MARCA_DA_LEITURA"(l."NO_LEITURA", 'x') order by l."NO_LEITURA") into v_depois
    from private."TD_LEITURA_POR_MARCA" l;
  if v_antes is distinct from v_depois then raise exception 'E8: a presença (com foto nova) mudou a marca'; end if;

  -- Segunda batida, foto igual: nenhum UPDATE no perfil (xmin igual) e marca igual.
  select p.xmin into v_xmin from public."TB_PERFIL_USUARIO" p where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  select p.google_avatar_url is not distinct from private."FC_FOTO_DO_GOOGLE"(u.raw_user_meta_data)
         or private."FC_FOTO_DO_GOOGLE"(u.raw_user_meta_data) is null
    into v_foto_igual
    from public."TB_PERFIL_USUARIO" p join auth.users u on u.id = p.user_id
   where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  perform pg_temp.nova_transacao('public."TB_PERFIL_USUARIO"');
  v_r := public.registrar_presenca_monitora('ensaio');
  select p.xmin into v_xmin_depois from public."TB_PERFIL_USUARIO" p where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  if v_foto_igual and v_xmin is distinct from v_xmin_depois then
    raise exception 'E8: a presença com a mesma foto regravou o perfil';
  end if;
  select array_agg(private."FC_MARCA_DA_LEITURA"(l."NO_LEITURA", 'x') order by l."NO_LEITURA") into v_depois
    from private."TD_LEITURA_POR_MARCA" l;
  if v_antes is distinct from v_depois then raise exception 'E8: a segunda batida mudou a marca'; end if;

  -- Mudança real no perfil (nome, mesmo valor; linha de verdade): muda as 9.
  perform pg_temp.nova_transacao('public."TB_PERFIL_USUARIO"');
  update public."TB_PERFIL_USUARIO" set nome = nome where user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  select array_agg(private."FC_MARCA_DA_LEITURA"(l."NO_LEITURA", 'x') order by l."NO_LEITURA") into v_depois
    from private."TD_LEITURA_POR_MARCA" l;
  if exists (select 1 from unnest(v_antes, v_depois) x(a, d) where x.a = x.d) then
    raise exception 'E8: update do nome no perfil não mudou a marca de todas as leituras';
  end if;
  insert into t_resultado (etapa, detalhe) values ('E8',
    'ok: foto/avatar e 2 batidas de presença não mudam as ' || cardinality(v_antes) || ' marcas; '
    || case when v_foto_igual then 'presença com a mesma foto não regrava o perfil (xmin igual); '
            else 'foto do login diferente da gravada: a 1ª batida grava, sem mudar a marca; ' end
    || 'update do nome muda as ' || cardinality(v_antes));
end;
$$;

-- E9. inalterado: igual depois de foto, presença e 0 linhas; payload depois de escrita real.
do $$
declare
  c record;
  v jsonb;
  v_versao text;
  v_nova text;
  v_casos integer := 0;
begin
  for c in select * from (values
      ('regra', null::text, 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'::uuid, 'public.TB_REGRA_ANALISE'),
      ('selecao', 'projetos', null::uuid, 'public.TB_SELECAO_VAGA'),
      ('avisos', null::text, null::uuid, 'public.TB_AVISO_CONFERENCIA')) x(rpc, area, edital, fonte) loop
    set local role authenticated;
    v := case c.rpc
           when 'regra' then public.obter_regra_analise_se_mudou(c.edital, null)
           when 'selecao' then public.get_selecao_da_area_se_mudou(c.area, null)
           else public.listar_avisos_conferencia_se_mudou(null, null, null) end;
    v_versao := v ->> 'versao';
    v := case c.rpc
           when 'regra' then public.obter_regra_analise_se_mudou(c.edital, v_versao)
           when 'selecao' then public.get_selecao_da_area_se_mudou(c.area, v_versao)
           else public.listar_avisos_conferencia_se_mudou(null, null, v_versao) end;
    reset role;
    if v <> jsonb_build_object('inalterado', true, 'versao', v_versao) then
      raise exception 'E9 %: a versão atual deveria devolver só inalterado', c.rpc;
    end if;

    -- Foto, presença e um comando de 0 linhas na fonte: continua inalterado.
    perform pg_temp.nova_transacao('public."TB_PERFIL_USUARIO"');
    update public."TB_PERFIL_USUARIO" set google_avatar_url = coalesce(google_avatar_url, '') || '#e9'
     where user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
    perform pg_temp.nova_transacao('public."TB_PERFIL_USUARIO"');
    perform public.registrar_presenca_monitora('ensaio');
    perform pg_temp.escrever_nada(c.fonte, 'update');
    set local role authenticated;
    v := case c.rpc
           when 'regra' then public.obter_regra_analise_se_mudou(c.edital, v_versao)
           when 'selecao' then public.get_selecao_da_area_se_mudou(c.area, v_versao)
           else public.listar_avisos_conferencia_se_mudou(null, null, v_versao) end;
    reset role;
    if not (v ? 'inalterado') then
      raise exception 'E9 %: foto/presença/0 linhas fizeram a RPC mandar o payload', c.rpc;
    end if;

    -- Escrita real (1 linha) na fonte: manda o payload, com versão nova que dá inalterado.
    if pg_temp.escrever_uma(c.fonte) not in ('update', 'delete', 'insert') then
      raise exception 'E9 %: sem linha para escrever em %', c.rpc, c.fonte;
    end if;
    set local role authenticated;
    v := case c.rpc
           when 'regra' then public.obter_regra_analise_se_mudou(c.edital, v_versao)
           when 'selecao' then public.get_selecao_da_area_se_mudou(c.area, v_versao)
           else public.listar_avisos_conferencia_se_mudou(null, null, v_versao) end;
    v_nova := v ->> 'versao';
    if v ? 'inalterado' or v_nova = v_versao then
      reset role;
      raise exception 'E9 %: escrita real em % não mandou o payload', c.rpc, c.fonte;
    end if;
    v := case c.rpc
           when 'regra' then public.obter_regra_analise_se_mudou(c.edital, v_nova)
           when 'selecao' then public.get_selecao_da_area_se_mudou(c.area, v_nova)
           else public.listar_avisos_conferencia_se_mudou(null, null, v_nova) end;
    reset role;
    if not (v ? 'inalterado') then
      raise exception 'E9 %: a versão nova não deu inalterado', c.rpc;
    end if;
    v_casos := v_casos + 1;
  end loop;
  insert into t_resultado (etapa, detalhe) values ('E9',
    'ok: ' || v_casos || ' RPCs (regra, seleção, avisos): inalterado com a versão atual e depois de foto/presença/0 linhas; payload com versão nova depois de 1 linha real');
end;
$$;

-- E10. Carga da Seleção: só a vaga que mudou; finalizar não desativa a que veio igual.
create temp table t_lote_selecao on commit drop as
select s."CO_SELECAO_VAGA" as id, s.xmin::text as xmin_antes, s."CO_SYNC" as sync_antes,
       s."DS_CHAVE_ORIGEM" as chave, s."QT_INSCRITO" as inscritos_antes,
       row_number() over (order by s."DS_CHAVE_ORIGEM") as n,
       jsonb_build_object(
         'edital', s."DS_EDITAL", 'vaga', s."DS_VAGA_PLANILHA", 'unidade', s."NO_UNIDADE",
         'cargo', s."NO_CARGO", 'inscritos', s."QT_INSCRITO"::text, 'aptos', s."QT_APTO_ANALISE"::text,
         'cancelados', s."QT_CANCELADO"::text, 'reprovados_questionario', s."QT_REPROVADO_QUESTIONARIO"::text,
         'eliminados_nota', s."QT_ELIMINADO_NOTA"::text, 'reprovados_analise', s."QT_REPROVADO_ANALISE"::text,
         'triados', s."QT_TRIADO"::text, 'total_eliminados', s."QT_TOTAL_ELIMINADO"::text,
         'convocados', s."QT_CONVOCADO_PLANILHA"::text, 'observacao', s."DS_OBSERVACAO",
         'repeticao', nullif(split_part(s."DS_CHAVE_ORIGEM", '#', 2), '')) as linha
  from public."TB_SELECAO_VAGA" s
 where s."ST_REGISTRO_ATIVO" = 'S'
   and s."NO_CARGO" is not null and s."QT_INSCRITO" is not null
   -- A chave que sincronizar_selecao calcula da linha é a mesma gravada.
   and s."DS_CHAVE_ORIGEM" =
       coalesce(private."FC_NUMERO_EDITAL"(s."DS_EDITAL"), private."FC_TEXTO_BUSCA_RECURSO"(s."DS_EDITAL")) || '|' ||
       case when btrim(s."DS_VAGA_PLANILHA") ~ '^[0-9]{1,20}$' then btrim(s."DS_VAGA_PLANILHA")
            else 'cargo:' || private."FC_TEXTO_BUSCA_RECURSO"(s."DS_VAGA_PLANILHA") end ||
       case when split_part(s."DS_CHAVE_ORIGEM", '#', 2) ~ '^[0-9]{1,3}$' then '#' || split_part(s."DS_CHAVE_ORIGEM", '#', 2) else '' end
 order by s."DS_CHAVE_ORIGEM"
 limit 3;

do $$
declare
  v_ativas integer;
  v_versao numeric;
  v_r jsonb;
  v_iguais integer;
  v_mudou record;
begin
  if (select count(*) from t_lote_selecao) <> 3 then
    raise exception 'E10: não achei 3 vagas com a chave recalculável';
  end if;
  select count(*) into v_ativas from public."TB_SELECAO_VAGA" where "ST_REGISTRO_ATIVO" = 'S';

  -- Lote só de linhas iguais: nenhuma regravada, a versão da fonte não muda.
  perform pg_temp.nova_transacao('public."TB_SELECAO_VAGA"');
  select coalesce(sum("QT_ALTERACAO"), 0) into v_versao from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_SELECAO_VAGA';
  perform public.sincronizar_selecao('ensaio_marca_igual', (select jsonb_agg(linha order by n) from t_lote_selecao));
  if exists (select 1 from t_lote_selecao t join public."TB_SELECAO_VAGA" s on s."CO_SELECAO_VAGA" = t.id
              where s.xmin::text <> t.xmin_antes) then
    raise exception 'E10: lote igual regravou vaga';
  end if;
  if (select coalesce(sum("QT_ALTERACAO"), 0) from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_SELECAO_VAGA') <> v_versao then
    raise exception 'E10: lote igual mudou a versão de TB_SELECAO_VAGA';
  end if;

  -- Carga com a 2ª vaga mudada (inscritos + 1): só ela é gravada.
  perform public.sincronizar_selecao('ensaio_marca_mudou',
    (select jsonb_agg(case when n = 2 then linha || jsonb_build_object('inscritos', (inscritos_antes + 1)::text) else linha end order by n)
       from t_lote_selecao));
  select count(*) filter (where s.xmin::text = t.xmin_antes and s."CO_SYNC" is not distinct from t.sync_antes) into v_iguais
    from t_lote_selecao t join public."TB_SELECAO_VAGA" s on s."CO_SELECAO_VAGA" = t.id where t.n <> 2;
  select s."CO_SYNC", s."QT_INSCRITO", t.inscritos_antes into v_mudou
    from t_lote_selecao t join public."TB_SELECAO_VAGA" s on s."CO_SELECAO_VAGA" = t.id where t.n = 2;
  if v_iguais <> 2 then raise exception 'E10: vaga igual regravada (% de 2 intactas)', v_iguais; end if;
  if v_mudou."CO_SYNC" is distinct from 'ensaio_marca_mudou' or v_mudou."QT_INSCRITO" <> v_mudou.inscritos_antes + 1 then
    raise exception 'E10: a vaga que mudou não foi gravada';
  end if;
  if (select count(*) from private."TL_CHAVE_DA_CARGA" where "TP_CARGA" = 'SELECAO' and "CO_SYNC" = 'ensaio_marca_mudou') <> 3 then
    raise exception 'E10: as 3 chaves da carga não foram guardadas';
  end if;

  -- Fechar com forçar (só 3 linhas): sai quem não veio; as 3 que vieram (2 iguais) ficam.
  -- KPIs não são recalculados aqui (stub só nesta transação).
  create or replace function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() returns integer
    language sql set search_path to '' as 'select 0';
  v_r := public.finalizar_sync_selecao('ensaio_marca_mudou', true);
  if (v_r ->> 'desativadas')::integer <> v_ativas - 3 then
    raise exception 'E10: desativou % (esperado %)', v_r ->> 'desativadas', v_ativas - 3;
  end if;
  if exists (select 1 from t_lote_selecao t join public."TB_SELECAO_VAGA" s on s."CO_SELECAO_VAGA" = t.id
              where s."ST_REGISTRO_ATIVO" <> 'S') then
    raise exception 'E10: finalizar desativou vaga que veio na carga';
  end if;
  if exists (select 1 from private."TL_CHAVE_DA_CARGA" k where k."TP_CARGA" = 'SELECAO'
               and not exists (select 1 from public."TL_SYNC_SELECAO" s
                                where s."CO_SYNC" = k."CO_SYNC" and s."TP_SITUACAO" = 'EM_ANDAMENTO')) then
    raise exception 'E10: sobrou chave de carga fechada';
  end if;
  insert into t_resultado (etapa, detalhe) values ('E10',
    'ok: lote de 3 vagas iguais não regrava nada nem muda a versão; com 1 mudada, só ela é gravada (2 com xmin e CO_SYNC antigos); finalizar com forçar desativou '
    || (v_r ->> 'desativadas') || ' de ' || v_ativas || ' ativas e manteve as 3 que vieram; chaves apagadas');
end;
$$;

-- E11. Carga das Entrevistas (saude-indigena): o mesmo.
create temp table t_lote_entrevista on commit drop as
select e."CO_ENTREVISTA" as id, e.xmin::text as xmin_antes, e."CO_SYNC" as sync_antes,
       e."DS_CHAVE_ORIGEM" as chave, e."VL_NOTA_TOTAL" as nota_antes,
       row_number() over (order by e."DS_CHAVE_ORIGEM") as n,
       jsonb_build_object(
         'unidade', e."NO_UNIDADE", 'edital', e."DS_EDITAL", 'vaga', e."CO_VAGA",
         'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'modalidade', e."DS_MODALIDADE",
         'cargo', e."NO_CARGO", 'nota', e."VL_NOTA_TOTAL"::text,
         'parecer', case e."TP_PARECER" when 'APTO' then 'Apto' when 'INAPTO' then 'Inapto' else '' end,
         'compareceu', case e."ST_COMPARECEU" when 'S' then 'Sim' when 'N' then 'Não' else '' end,
         'link', e."DS_LINK_PLANILHA",
         'notas', coalesce((select jsonb_agg(jsonb_build_object('criterio', n."DS_CRITERIO", 'nota', n."VL_NOTA"::text) order by n."NU_ORDEM")
                              from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::jsonb)) as linha
  from public."TB_ENTREVISTA" e
 where e."CO_AREA" = 'saude-indigena' and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S'
   and e."VL_NOTA_TOTAL" is not null and e."NO_UNIDADE" <> '' and coalesce(e."DS_MODALIDADE", '') !~ ','
   and e."DS_CHAVE_ORIGEM" =
       'saude-indigena|' || coalesce(private."FC_NUMERO_EDITAL"(e."DS_EDITAL"), lower(e."DS_EDITAL")) || '|' || e."CO_VAGA" || '|' ||
       coalesce(nullif(e."CO_CANDIDATO", ''), 'nome:' || private."FC_TEXTO_BUSCA_RECURSO"(e."NO_CANDIDATO"))
 order by e."DS_CHAVE_ORIGEM"
 limit 3;

do $$
declare
  v_ativas integer;
  v_versao numeric;
  v_r jsonb;
  v_iguais integer;
  v_mudou record;
  v_repetidas integer;
begin
  if (select count(*) from t_lote_entrevista) <> 3 then
    raise exception 'E11: não achei 3 entrevistas com a chave recalculável';
  end if;
  select count(*) into v_ativas from public."TB_ENTREVISTA"
   where "CO_AREA" = 'saude-indigena' and "TP_ORIGEM" = 'planilha' and "ST_ATIVO" = 'S';

  perform pg_temp.nova_transacao('public."TB_ENTREVISTA"');
  select coalesce(sum("QT_ALTERACAO"), 0) into v_versao from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_ENTREVISTA';
  perform public.sincronizar_entrevistas('ensaio_marca_igual', 'saude-indigena',
    (select jsonb_agg(linha order by n) from t_lote_entrevista));
  if exists (select 1 from t_lote_entrevista t join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = t.id
              where e.xmin::text <> t.xmin_antes) then
    raise exception 'E11: lote igual regravou entrevista';
  end if;
  if (select coalesce(sum("QT_ALTERACAO"), 0) from private."TL_VERSAO_FONTE" where "NO_FONTE" = 'public.TB_ENTREVISTA') <> v_versao then
    raise exception 'E11: lote igual mudou a versão de TB_ENTREVISTA';
  end if;

  perform public.sincronizar_entrevistas('ensaio_marca_mudou', 'saude-indigena',
    (select jsonb_agg(case when n = 2 then linha || jsonb_build_object('nota', (nota_antes + 1)::text) else linha end order by n)
       from t_lote_entrevista));
  select count(*) filter (where e.xmin::text = t.xmin_antes and e."CO_SYNC" is not distinct from t.sync_antes) into v_iguais
    from t_lote_entrevista t join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = t.id where t.n <> 2;
  select e."CO_SYNC", e."VL_NOTA_TOTAL", t.nota_antes into v_mudou
    from t_lote_entrevista t join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = t.id where t.n = 2;
  if v_iguais <> 2 then raise exception 'E11: entrevista igual regravada (% de 2 intactas)', v_iguais; end if;
  if v_mudou."CO_SYNC" is distinct from 'ensaio_marca_mudou' or v_mudou."VL_NOTA_TOTAL" <> v_mudou.nota_antes + 1 then
    raise exception 'E11: a entrevista que mudou não foi gravada';
  end if;

  v_r := public.finalizar_sync_entrevistas('ensaio_marca_mudou', 'saude-indigena', true);
  if (v_r ->> 'desativadas')::integer <> v_ativas - 3 then
    raise exception 'E11: desativou % (esperado %)', v_r ->> 'desativadas', v_ativas - 3;
  end if;
  if exists (select 1 from t_lote_entrevista t join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = t.id
              where e."ST_ATIVO" <> 'S'
                and not exists (select 1 from public."TB_ENTREVISTA" s   -- (a repetida da do sistema sai de propósito)
                                 where s."TP_ORIGEM" = 'sistema' and s."ST_ATIVO" = 'S'
                                   and s."CO_ANALISE_CURRICULAR" = e."CO_ANALISE_CURRICULAR")) then
    raise exception 'E11: finalizar desativou entrevista que veio na carga';
  end if;
  if exists (select 1 from private."TL_CHAVE_DA_CARGA" k where k."TP_CARGA" = 'ENTREVISTA'
               and not exists (select 1 from public."TL_SYNC_ENTREVISTA" s
                                where s."CO_SYNC" = k."CO_SYNC" and s."TP_SITUACAO" = 'EM_ANDAMENTO')) then
    raise exception 'E11: sobrou chave de carga fechada';
  end if;
  insert into t_resultado (etapa, detalhe) values ('E11',
    'ok: lote de 3 entrevistas iguais não regrava nada nem muda a versão; com 1 mudada, só ela é gravada (2 com xmin e CO_SYNC antigos); finalizar com forçar desativou '
    || (v_r ->> 'desativadas') || ' de ' || v_ativas || ' ativas e manteve as que vieram; chaves apagadas');
end;
$$;

-- E12. work_mem.
do $$
declare
  v_faltas text;
begin
  select string_agg(x.f, ', ') into v_faltas
    from (values
      ('public.get_analises_dashboard_payload_v2_se_mudou(text,text,text)', 'work_mem=16MB'),
      ('public.pendencias_ler_aprovados()', 'work_mem=16MB'),
      ('public.obter_pre_classificacao(uuid)', 'work_mem=16MB'),
      ('public.obter_pre_classificacao_se_mudou(uuid,text)', 'work_mem=16MB'),
      ('public.paineis_gravar_pacote(text,text,timestamp with time zone,bigint[],json,text)', 'work_mem=16MB'),
      ('public.get_analises_dashboard_payload_v2(text,text)', 'work_mem=64MB')) x(f, cfg)
   where not (x.cfg = any (coalesce((select p.proconfig from pg_proc p where p.oid = x.f::regprocedure), '{}')));
  if v_faltas is not null then raise exception 'E12: work_mem errado em %', v_faltas; end if;
  insert into t_resultado (etapa, detalhe) values ('E12', 'ok: 16MB nas cinco funções; 64MB de get_analises_dashboard_payload_v2 mantido');
end;
$$;

select etapa, detalhe from t_resultado order by n;

rollback;
