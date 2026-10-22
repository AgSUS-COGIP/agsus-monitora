/*
  ENSAIO de 20261005150000_convocacao_unica_da_entrevista.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), confere as funções e percorre o fluxo com
  três pessoas sintéticas — gestor (edital_gestor, com a área), leitor (usuario,
  com a área) e outro (usuario, sem área) — num edital real ainda sem
  configuração de entrevista e com três análises ativas: uma lista de
  convocação sintética (dois na lista, um eliminado), configuração sem regra de
  convocação nem vagas, convocação só de quem está na lista, lista trocada —
  e termina em ROLLBACK: nada fica gravado.

  Resultado esperado: as mensagens "ok E1" … "ok E5" e a linha "ENSAIO OK" do
  SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/convocacao-unica-da-entrevista-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_LISTA_CLASSIFICACAO"') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
  if to_regclass('public."TB_ENTREVISTA_EDITAL"') is null then
    raise exception 'Aplique antes 20260930220000_entrevistas_roteiros_e_notas.sql.';
  end if;
  if to_regclass('public."TB_QUADRO_VAGA_EDITAL"') is null then
    raise exception 'Aplique antes 20260930233000_quadro_de_vagas_do_edital.sql.';
  end if;
end;
$$;

-- 1. A lista vigente e quem está nela ---------------------------------------------------
create function private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital uuid)
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select l."CO_LISTA_CLASSIFICACAO"
    from public."TB_LISTA_CLASSIFICACAO" l
   where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" = 'CONVOCACAO'
   order by l."DT_GERACAO" desc, l."CO_LISTA_CLASSIFICACAO" desc
   limit 1;
$function$;
comment on function private."FC_LISTA_CONVOCACAO_VIGENTE"(uuid) is
  'A lista de convocação para entrevista vigente do edital: a última CONVOCACAO gerada na Classificação (TB_LISTA_CLASSIFICACAO); null sem lista. Sem checagem de permissão: só as RPCs chamam.';
revoke all on function private."FC_LISTA_CONVOCACAO_VIGENTE"(uuid) from public, anon, authenticated;

create function private."FC_CONVOCADOS_DA_LISTA"(p_lista uuid)
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select distinct (x.linha ->> 'analise_id')::uuid
    from public."TB_LISTA_CLASSIFICACAO" l
   cross join lateral jsonb_array_elements(
           case when jsonb_typeof(l."DS_RESULTADO" -> 'vagas') = 'array' then l."DS_RESULTADO" -> 'vagas' else '[]'::jsonb end) v(vaga)
   cross join lateral (
           select g.linha
             from jsonb_array_elements(
                    case when jsonb_typeof(v.vaga -> 'geral') = 'array' then v.vaga -> 'geral' else '[]'::jsonb end) g(linha)
           union all
           select m.linha
             from jsonb_each(
                    case when jsonb_typeof(v.vaga -> 'listas') = 'object' then v.vaga -> 'listas' else '{}'::jsonb end) e(codigo, linhas)
            cross join lateral jsonb_array_elements(
                    case when jsonb_typeof(e.linhas) = 'array' then e.linhas else '[]'::jsonb end) m(linha)) x
   where l."CO_LISTA_CLASSIFICACAO" = p_lista
     and coalesce(x.linha ->> 'analise_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$function$;
comment on function private."FC_CONVOCADOS_DA_LISTA"(uuid) is
  'As análises (TB_ANALISE_CURRICULAR.id) de uma lista gerada: a classificação geral e as listas por modalidade de cada vaga do retrato (DS_RESULTADO); os eliminados não entram. Sem checagem de permissão: só as RPCs chamam.';
revoke all on function private."FC_CONVOCADOS_DA_LISTA"(uuid) from public, anon, authenticated;

-- 2. O edital para conduzir: a lista da Classificação no lugar do ranking próprio -----------
create or replace function public.obter_entrevistas_do_edital(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
  v_lista uuid := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'pode_gerar_lista', private.pode_recurso('classificacao', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'banca', v_cfg."DS_BANCA",
        'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'regra_classificacao', (
      select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'convocacao', h."DS_CONFIGURACAO" -> 'convocacao')
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'lista_convocacao', case when v_lista is null then null else json_build_object(
        'lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_lista),
        'retrato', (select l."DS_RESULTADO" from public."TB_LISTA_CLASSIFICACAO" l
                     where l."CO_LISTA_CLASSIFICACAO" = v_lista)) end,
    'avaliadores', coalesce((
      select json_agg(json_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM",
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S') order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA"))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;
comment on function public.obter_entrevistas_do_edital(uuid) is
  'Tudo para conduzir a entrevista de um edital: configuração (roteiro, banca, lançamento), a lista de convocação vigente da Classificação com o retrato (a única convocação), a regra de convocação vigente da Classificação, a banca e os convocados com as notas; pode_editar, pode_gerar_lista, admin_global e meu_perfil. entrevistas >= leitor, a área e o recorte do edital.';

-- 3. Configuração: sem regra de convocação e sem vagas digitadas ------------------------------
create or replace function public.configurar_entrevista_edital(p_edital uuid, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_roteiro uuid := nullif(p_dados ->> 'roteiro', '')::uuid;
  b jsonb;
begin
  if v_roteiro is null or not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    raise exception 'Escolha um roteiro' using errcode = '22023';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA" e join public."TB_ENTREVISTA_AVALIACAO" x on x."CO_ENTREVISTA" = e."CO_ENTREVISTA"
              where e."CO_MONITORAMENTO" = p_edital and e."CO_ROTEIRO" is distinct from v_roteiro) then
    raise exception 'Já há notas lançadas com outro roteiro neste edital; o roteiro não pode mais ser trocado' using errcode = '23514';
  end if;
  -- A convocação é a lista da Classificação: DS_CONVOCACAO não é mais gravada (fica o que havia).
  insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
  values (p_edital, v_roteiro, coalesce(p_dados -> 'banca', '[]'),
          coalesce(nullif(p_dados ->> 'lancamento', ''), 'SECRETARIA'), (select auth.uid()))
  on conflict ("CO_MONITORAMENTO") do update set
    "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DS_BANCA" = excluded."DS_BANCA",
    "TP_LANCAMENTO" = excluded."TP_LANCAMENTO", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";

  update public."TB_ENTREVISTA" set "CO_ROTEIRO" = v_roteiro
   where "CO_MONITORAMENTO" = p_edital and "TP_ORIGEM" = 'sistema' and "CO_ROTEIRO" is distinct from v_roteiro;

  -- Banca: membros enviados (com id = atualiza; sem id = novo); os que não vieram saem (ST_ATIVO N).
  if jsonb_typeof(p_dados -> 'avaliadores') = 'array' then
    update public."TB_ENTREVISTA_AVALIADOR" a set "ST_ATIVO" = 'N'
     where a."CO_MONITORAMENTO" = p_edital and a."ST_ATIVO" = 'S'
       and not exists (select 1 from jsonb_array_elements(p_dados -> 'avaliadores') x where nullif(x ->> 'id', '')::uuid = a."CO_AVALIADOR");
    for b in select value from jsonb_array_elements(p_dados -> 'avaliadores') loop
      if nullif(b ->> 'id', '') is not null then
        update public."TB_ENTREVISTA_AVALIADOR" set "NO_AVALIADOR" = btrim(b ->> 'nome'), "NO_ORIGEM" = btrim(b ->> 'origem'),
               "NU_BANCA" = coalesce(nullif(b ->> 'banca', '')::smallint, 1), "CO_PERFIL_USUARIO" = nullif(b ->> 'perfil', '')::uuid, "ST_ATIVO" = 'S'
         where "CO_AVALIADOR" = (b ->> 'id')::uuid and "CO_MONITORAMENTO" = p_edital;
      else
        insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA", "CO_PERFIL_USUARIO")
        values (p_edital, btrim(b ->> 'nome'), btrim(b ->> 'origem'), coalesce(nullif(b ->> 'banca', '')::smallint, 1), nullif(b ->> 'perfil', '')::uuid);
      end if;
    end loop;
  end if;

  return public.obter_entrevistas_do_edital(p_edital);
end;
$function$;
comment on function public.configurar_entrevista_edital(uuid, jsonb) is
  'Grava a configuração da entrevista do edital: roteiro, composição da banca, modo de lançamento e membros da banca (23514 se trocar o roteiro com notas). A convocação e as vagas são as da Classificação: convocacao e vagas em p_dados são ignoradas. entrevistas >= editor e o edital.';

-- 4. Convocar: só quem está na lista de convocação vigente ---------------------------------------
drop function public.convocar_para_entrevista(uuid, uuid[]);

create function public.convocar_para_entrevista(p_edital uuid, p_lista uuid, p_analises uuid[])
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_roteiro uuid;
  v_vigente uuid;
  v_fora integer;
  v_qt integer;
begin
  select "CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  if v_roteiro is null then raise exception 'Configure a entrevista do edital antes de convocar' using errcode = '23514'; end if;
  if coalesce(cardinality(p_analises), 0) not between 1 and 2000 then raise exception 'Escolha de 1 a 2000 candidatos' using errcode = '22023'; end if;

  -- Uma convocação por vez no edital; a tela tem de estar na lista vigente.
  perform pg_advisory_xact_lock(hashtextextended('convocacao_entrevista:' || p_edital::text, 0));
  v_vigente := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
  if v_vigente is null then
    raise exception 'Gere a lista de convocação na Classificação antes de convocar' using errcode = '23514';
  end if;
  if p_lista is distinct from v_vigente then
    raise exception 'A lista de convocação mudou na Classificação; recarregue' using errcode = '40001';
  end if;
  select count(*) into v_fora
    from (select distinct x.analise from unnest(p_analises) x(analise)) s
   where s.analise is null
      or not exists (select 1 from private."FC_CONVOCADOS_DA_LISTA"(v_vigente) c(analise) where c.analise = s.analise);
  if v_fora > 0 then
    raise exception '% candidato(s) fora da lista de convocação vigente da Classificação', v_fora using errcode = '23514';
  end if;

  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  insert into public."TB_ENTREVISTA" as e ("CO_AREA", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "TP_LIGACAO_ANALISE",
    "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO", "DS_MODALIDADE", "NO_CARGO", "TP_PARECER",
    "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO")
  select v_area, p_edital, a.id, 'codigo', left(coalesce(v_m.unidade, ''), 200), left(v_m.edital, 120), left(a.codigo_vaga, 60),
         left(a.candidato, 200), left(a.id_origem, 60), left(a.modalidade_concorrencia, 300), left(a.nome_vaga, 400), 'SEM_PARECER',
         'sistema', 'sistema|' || p_edital || '|' || a.id, v_roteiro, 'S'
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = any (p_analises) and a."CO_AREA" = v_area
     and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
  on conflict ("DS_CHAVE_ORIGEM") do update set "ST_ATIVO" = 'S', "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DT_ATUALIZACAO" = now();
  get diagnostics v_qt = row_count;

  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
  select e."CO_ENTREVISTA", 'convocacao', 'convocado pela lista ' || v_vigente, (select auth.uid())
    from public."TB_ENTREVISTA" e where e."DS_CHAVE_ORIGEM" = any (select 'sistema|' || p_edital || '|' || x from unnest(p_analises) x);

  return json_build_object('convocados', v_qt, 'lista', v_vigente, 'dados', public.obter_entrevistas_do_edital(p_edital));
end;
$function$;
comment on function public.convocar_para_entrevista(uuid, uuid, uuid[]) is
  'Registra para a ficha de notas (TB_ENTREVISTA, TP_ORIGEM sistema) convocados da lista de convocação vigente da Classificação (p_lista = a última CONVOCACAO gerada, senão 40001); candidato fora da lista ou sem lista gerada = 23514; sem configuração = 23514. Idempotente; nada é apagado. entrevistas >= editor e o edital.';
revoke all on function public.convocar_para_entrevista(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.convocar_para_entrevista(uuid, uuid, uuid[]) to authenticated, service_role;

-- 5. O que ficou sem uso (sem apagar) ----------------------------------------------------------
comment on table public."TB_ENTREVISTA_VAGA" is
  'Vagas imediatas digitadas na entrevista até 20261005150000. Sem uso: as vagas vêm do quadro do edital e da configuração da convocação, as mesmas da Classificação. Fica para o histórico.';
comment on table public."TB_ENTREVISTA_EDITAL" is
  'Configuração da entrevista de um edital: roteiro (versão exata), banca e quem lança as notas. A convocação é a lista CONVOCACAO da Classificação.';
comment on column public."TB_ENTREVISTA_EDITAL"."DS_CONVOCACAO" is
  'Regra de convocação própria da entrevista até 20261005150000. Sem uso: vale a regra da Classificação (TB_REGRA_CLASSIFICACAO). Fica para o histórico.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_CONVOCACAO_PADRAO" is
  'Regra de convocação sugerida ao edital até 20261005150000. Sem uso: vale a regra da Classificação do edital. Fica para o histórico.';

-- ═══ CORPO DA MIGRATION (fim) ═══

-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)

-- E1. Funções: a convocação antiga saiu; as novas são SECURITY DEFINER com search_path vazio.
do $$
declare
  v_funcao text;
begin
  if to_regprocedure('public.convocar_para_entrevista(uuid, uuid[])') is not null then
    raise exception 'FALHOU E1: a convocar_para_entrevista de dois argumentos continua';
  end if;
  foreach v_funcao in array array[
    'public.convocar_para_entrevista(uuid, uuid, uuid[])',
    'public.obter_entrevistas_do_edital(uuid)',
    'public.configurar_entrevista_edital(uuid, jsonb)',
    'private."FC_LISTA_CONVOCACAO_VIGENTE"(uuid)',
    'private."FC_CONVOCADOS_DA_LISTA"(uuid)'] loop
    if not exists (select 1 from pg_proc p
                    where p.oid = to_regprocedure(v_funcao) and p.prosecdef
                      and p.proconfig @> array['search_path=""']) then
      raise exception 'FALHOU E1: % sem SECURITY DEFINER ou search_path vazio', v_funcao;
    end if;
  end loop;
  if not has_function_privilege('authenticated', 'public.convocar_para_entrevista(uuid, uuid, uuid[])', 'EXECUTE')
     or has_function_privilege('anon', 'public.convocar_para_entrevista(uuid, uuid, uuid[])', 'EXECUTE') then
    raise exception 'FALHOU E1: execute da convocar_para_entrevista (só authenticated)';
  end if;
  if has_function_privilege('authenticated', 'private."FC_CONVOCADOS_DA_LISTA"(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private."FC_LISTA_CONVOCACAO_VIGENTE"(uuid)', 'EXECUTE') then
    raise exception 'FALHOU E1: authenticated executa as funções internas';
  end if;
  raise notice 'ok E1: convocação de dois argumentos fora; funções SECURITY DEFINER, search_path vazio e grants certos';
end;
$$;

-- E2. Edital real sem configuração de entrevista, três análises, uma lista de convocação sintética e os atores.
do $$
declare
  v_edital uuid;
  v_area text;
  v_ids text[];
  v_regra uuid;
  v_versao integer;
  v_lista uuid;
  v_retrato jsonb;
begin
  select m.id, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" is not null
     and not exists (select 1 from public."TB_ENTREVISTA_EDITAL" c where c."CO_MONITORAMENTO" = m.id)
     and (select count(*) from public."TB_ANALISE_CURRICULAR" a
           where a."CO_AREA" = m."CO_AREA" and a.ativo
             and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)) >= 3
   order by exists (select 1 from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = m.id) desc,
            m.ativo desc, m.edital
   limit 1;
  if v_edital is null then raise exception 'ENSAIO: nenhum edital sem configuração de entrevista e com três análises ativas'; end if;
  select array_agg(s.id::text order by s.id::text collate "C") into v_ids
    from (select a.id from public."TB_ANALISE_CURRICULAR" a, public."TB_MONITORAMENTO_INDIGENA" m
           where m.id = v_edital and a."CO_AREA" = v_area and a.ativo
             and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)
           order by a.id limit 3) s;

  select r."CO_REGRA_CLASSIFICACAO", r."NU_VERSAO_VIGENTE" into v_regra, v_versao
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v_edital;
  if v_regra is null then
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE")
    values (v_edital, 1) returning "CO_REGRA_CLASSIFICACAO" into v_regra;
    insert into public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL")
    values (v_regra, 1, '{"convocacao":{"multiplo_vagas":5,"posicao_max_cr":10,"incluir_empatados":true,"excecoes":[]}}', 'MESMA_POSICAO');
    v_versao := 1;
  end if;

  -- Na lista: o 1º (geral) e o 2º (só na lista da modalidade); o 3º está entre os eliminados.
  v_retrato := jsonb_build_object('schema', 1, 'tipo', 'CONVOCACAO', 'vagas', jsonb_build_array(jsonb_build_object(
      'codigo', 'ENSAIO', 'cargo', 'Cargo do ensaio',
      'geral', jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', v_ids[1], 'nome', 'Primeiro')),
      'listas', jsonb_build_object('PPIQ', jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', v_ids[2], 'nome', 'Segundo'))),
      'eliminados', jsonb_build_array(jsonb_build_object('analise_id', v_ids[3], 'nome', 'Terceiro', 'motivo', 'FORA_DA_CONVOCACAO')))),
    'totais', jsonb_build_object('elegiveis', 2, 'eliminados', 1, 'avisos', 0, 'pendencias', 0));
  insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
    "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "QT_ELIMINADO", "CO_USUARIO", "DT_GERACAO")
  values (v_edital, 'CONVOCACAO', v_regra, v_versao, v_retrato, encode(sha256(convert_to(v_retrato::text, 'UTF8')), 'hex'),
          2, 1, '00000000-0000-4000-a000-00000000e201', now() + interval '1 minute')
  returning "CO_LISTA_CLASSIFICACAO" into v_lista;

  if private."FC_LISTA_CONVOCACAO_VIGENTE"(v_edital) is distinct from v_lista then
    raise exception 'FALHOU E2: a lista sintética não é a vigente';
  end if;
  if (select array_agg(c order by c) from private."FC_CONVOCADOS_DA_LISTA"(v_lista) c)
     is distinct from (select array_agg(i::uuid order by i::uuid) from unnest(v_ids[1:2]) i) then
    raise exception 'FALHOU E2: convocados da lista (geral + modalidade, sem eliminados)';
  end if;

  perform set_config('ensaio.edital', v_edital::text, true);
  perform set_config('ensaio.ids', array_to_string(v_ids, ','), true);
  perform set_config('ensaio.lista', v_lista::text, true);
  perform set_config('ensaio.regra', v_regra::text, true);
  perform set_config('ensaio.versao', v_versao::text, true);

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000e201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.leitor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.outro@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000e201', 'ensaio.gestor@ensaio.invalid', 'Ensaio Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-00000000e202', 'ensaio.leitor@ensaio.invalid', 'Ensaio Leitor', 'usuario', true),
    ('00000000-0000-4000-a000-00000000e203', 'ensaio.outro@ensaio.invalid', 'Ensaio Outro', 'usuario', true);
  -- Gestor e leitor com a área do edital; o "outro" sem área nenhuma.
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u
   where u.email in ('ensaio.gestor@ensaio.invalid', 'ensaio.leitor@ensaio.invalid');
  raise notice 'ok E2: edital % (área %), lista % com 2 convocados e 1 eliminado; atores criados', v_edital, v_area, v_lista;
end;
$$;

-- E3. O fluxo pelas RPCs, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.gestor@ensaio.invalid"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000e202","role":"authenticated","email":"ensaio.leitor@ensaio.invalid"}';
  c_outro constant text := '{"sub":"00000000-0000-4000-a000-00000000e203","role":"authenticated","email":"ensaio.outro@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_ids text[] := string_to_array(current_setting('ensaio.ids'), ',');
  v_lista uuid := current_setting('ensaio.lista')::uuid;
  v json;
  v_roteiro uuid;
begin
  -- Leitor: lê a lista da Classificação no lugar do ranking próprio; não convoca.
  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.obter_entrevistas_do_edital(v_edital);
  if (v -> 'lista_convocacao' -> 'lista' ->> 'id')::uuid is distinct from v_lista
     or json_array_length(v -> 'lista_convocacao' -> 'retrato' -> 'vagas') <> 1
     or json_typeof(v -> 'regra_classificacao') is distinct from 'object'
     or (v ->> 'pode_editar')::boolean or (v ->> 'pode_gerar_lista')::boolean
     or v -> 'candidatos' is not null or v -> 'vagas' is not null then
    raise exception 'FALHOU E3: leitura do leitor %', v;
  end if;
  begin
    perform public.convocar_para_entrevista(v_edital, v_lista, array[v_ids[1]::uuid]);
    raise exception 'FALHOU E3: leitor convocou';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E3.1: leitor lê a lista vigente (sem candidatos nem vagas próprios) e não convoca (42501)';

  -- Outro (sem a área): nem lê.
  perform set_config('request.jwt.claims', c_outro, true);
  begin
    perform public.obter_entrevistas_do_edital(v_edital);
    raise exception 'FALHOU E3: sem a área leu o edital';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E3.2: sem a área do edital não lê (42501)';

  -- Gestor: sem configuração não convoca; configura (convocacao e vagas são ignoradas).
  perform set_config('request.jwt.claims', c_gestor, true);
  begin
    perform public.convocar_para_entrevista(v_edital, v_lista, array[v_ids[1]::uuid]);
    raise exception 'FALHOU E3: convocou sem configuração';
  exception when sqlstate '23514' then null;
  end;
  v := public.salvar_roteiro_entrevista('{"nome":"Roteiro do ensaio","escala":"FAIXA","competencias":[{"nome":"Competência do ensaio","nota_maxima":5}]}'::jsonb);
  v_roteiro := (v ->> 'id')::uuid;
  v := public.configurar_entrevista_edital(v_edital, jsonb_build_object(
    'roteiro', v_roteiro, 'banca', '[{"origem":"AgSUS","quantidade":1}]'::jsonb, 'lancamento', 'SECRETARIA',
    'convocacao', '{"multiplo_imediatas":1,"posicao_cadastro_reserva":1,"excecoes":[]}'::jsonb,
    'vagas', '[{"vaga":"ENSAIO","vagas_imediatas":3}]'::jsonb,
    'avaliadores', '[{"nome":"Avaliador do ensaio","origem":"AgSUS","banca":1}]'::jsonb));
  if (v -> 'configuracao' -> 'roteiro' ->> 'id') is distinct from v_roteiro::text
     or v -> 'configuracao' -> 'convocacao' is not null
     or json_array_length(v -> 'avaliadores') < 1 then
    raise exception 'FALHOU E3: configuração %', v -> 'configuracao';
  end if;
  raise notice 'ok E3.3: sem configuração não convoca (23514); a configuração grava roteiro e banca, sem regra de convocação';

  -- Lista que não é a vigente: 40001. Fora da lista (o eliminado): 23514. Vazio: 22023.
  begin
    perform public.convocar_para_entrevista(v_edital, gen_random_uuid(), array[v_ids[1]::uuid]);
    raise exception 'FALHOU E3: convocou com outra lista';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.convocar_para_entrevista(v_edital, v_lista, array[v_ids[1]::uuid, v_ids[3]::uuid]);
    raise exception 'FALHOU E3: convocou quem está fora da lista';
  exception when sqlstate '23514' then null;
  end;
  begin
    perform public.convocar_para_entrevista(v_edital, v_lista, array[]::uuid[]);
    raise exception 'FALHOU E3: convocou ninguém';
  exception when sqlstate '22023' then null;
  end;

  -- Os dois da lista (o da geral e o da modalidade); de novo, sem repetir.
  v := public.convocar_para_entrevista(v_edital, v_lista, array[v_ids[1]::uuid, v_ids[2]::uuid]);
  if (v ->> 'convocados')::integer <> 2 or (v ->> 'lista')::uuid is distinct from v_lista
     or (select count(*) from json_array_elements(v -> 'dados' -> 'convocados') c where c ->> 'analise_id' = any (v_ids[1:2])) <> 2 then
    raise exception 'FALHOU E3: convocar os dois da lista %', v;
  end if;
  v := public.convocar_para_entrevista(v_edital, v_lista, array[v_ids[1]::uuid]);
  if (select count(*) from json_array_elements(v -> 'dados' -> 'convocados') c where c ->> 'analise_id' = v_ids[1]) <> 1 then
    raise exception 'FALHOU E3: convocar de novo repetiu o candidato';
  end if;
  raise notice 'ok E3.4: outra lista = 40001, fora da lista = 23514, vazio = 22023; os da lista convocados, sem repetir';
end;
$$;

-- Volta ao papel do SQL Editor antes de ler as tabelas sem grant.
reset role;
select set_config('request.jwt.claims', '', true);

-- E4. O que ficou no banco; a Classificação gera uma lista nova (só o 1º).
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_ids text[] := string_to_array(current_setting('ensaio.ids'), ',');
  v_retrato jsonb;
  v_nova uuid;
begin
  if exists (select 1 from public."TB_ENTREVISTA_VAGA" where "CO_MONITORAMENTO" = v_edital) then
    raise exception 'FALHOU E4: gravou vagas imediatas digitadas';
  end if;
  if (select "DS_CONVOCACAO" from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = v_edital) <> '{}'::jsonb then
    raise exception 'FALHOU E4: gravou regra de convocação própria';
  end if;
  if (select count(*) from public."TH_ENTREVISTA_AVALIACAO" h join public."TB_ENTREVISTA" e using ("CO_ENTREVISTA")
       where e."CO_MONITORAMENTO" = v_edital and h."DS_CAMPO" = 'convocacao'
         and h."DS_VALOR_NOVO" = 'convocado pela lista ' || current_setting('ensaio.lista')) <> 3 then
    raise exception 'FALHOU E4: histórico da convocação com a lista';
  end if;

  v_retrato := jsonb_build_object('schema', 1, 'tipo', 'CONVOCACAO', 'vagas', jsonb_build_array(jsonb_build_object(
      'codigo', 'ENSAIO', 'cargo', 'Cargo do ensaio',
      'geral', jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', v_ids[1], 'nome', 'Primeiro')),
      'listas', '{}'::jsonb, 'eliminados', '[]'::jsonb)),
    'totais', jsonb_build_object('elegiveis', 1, 'eliminados', 0, 'avisos', 0, 'pendencias', 0));
  insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
    "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "QT_ELIMINADO", "CO_USUARIO", "DT_GERACAO")
  values (v_edital, 'CONVOCACAO', current_setting('ensaio.regra')::uuid, current_setting('ensaio.versao')::integer, v_retrato,
          encode(sha256(convert_to(v_retrato::text, 'UTF8')), 'hex'), 1, 0, '00000000-0000-4000-a000-00000000e201',
          now() + interval '2 minutes')
  returning "CO_LISTA_CLASSIFICACAO" into v_nova;
  perform set_config('ensaio.lista_nova', v_nova::text, true);
  raise notice 'ok E4: sem vagas digitadas nem regra própria; histórico com a lista; lista nova % registrada', v_nova;
end;
$$;

-- E5. Lista nova: a antiga é recusada, quem saiu dela não é convocado, e nada some.
set local role authenticated;
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_ids text[] := string_to_array(current_setting('ensaio.ids'), ',');
  v_antiga uuid := current_setting('ensaio.lista')::uuid;
  v_nova uuid := current_setting('ensaio.lista_nova')::uuid;
  v json;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-00000000e201","role":"authenticated","email":"ensaio.gestor@ensaio.invalid"}', true);
  begin
    perform public.convocar_para_entrevista(v_edital, v_antiga, array[v_ids[1]::uuid]);
    raise exception 'FALHOU E5: convocou pela lista antiga';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.convocar_para_entrevista(v_edital, v_nova, array[v_ids[2]::uuid]);
    raise exception 'FALHOU E5: convocou quem saiu da lista nova';
  exception when sqlstate '23514' then null;
  end;
  v := public.obter_entrevistas_do_edital(v_edital);
  if (v -> 'lista_convocacao' -> 'lista' ->> 'id')::uuid is distinct from v_nova
     or (select count(*) from json_array_elements(v -> 'convocados') c where c ->> 'analise_id' = any (v_ids[1:2])) <> 2 then
    raise exception 'FALHOU E5: lista vigente ou convocados depois da lista nova %', v;
  end if;
  raise notice 'ok E5: lista antiga = 40001; fora da nova = 23514; os dois convocados continuam na ficha';
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);

-- Resumo (o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_ENTREVISTA" e
    where e."CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S') as convocados,
  (select count(*) from public."TB_LISTA_CLASSIFICACAO" l
    where l."CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid and l."TP_LISTA" = 'CONVOCACAO') as listas_de_convocacao,
  (select count(*) from public."TB_ENTREVISTA_VAGA" v where v."CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid) as vagas_digitadas;

rollback;
