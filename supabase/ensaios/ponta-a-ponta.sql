/*
  ENSAIO DE PONTA A PONTA DO PROCESSO SELETIVO — begin … rollback.

  NÃO É MIGRATION: nada é criado nem alterado no schema. O ensaio percorre, no
  banco de produção e numa transação só, o fluxo inteiro de um edital
  sintético pelas RPCs reais, na ordem em que as telas e as cargas as chamam,
  e confere cada passo. Termina em ROLLBACK: nada fica gravado (só os números
  das sequências consumidos — ids de log/staging — não voltam; é o
  comportamento normal do Postgres).

  Dados 100% sintéticos: edital "Edital 999/2099 - Ensaio ponta a ponta"
  (área Projetos), vaga Empregare 9990900, candidatos 9990001…9990008
  ("Ensaio …"), e-mails @ensaio.invalid, atores 00000000-0000-4000-a000-00000000e5xx.

  Atores (TB_PERFIL_USUARIO.perfil = grupo de acesso; área Projetos):
    e501 gestor        edital_gestor  (Núcleo, Classificação, Recursos, Entrevistas
                                       editor; Lista de aprovados ADMIN)
    e502 coordenador   coordenador    (Entrevistas, Classificação, Aprovados editor)
    e503 jurídico      juridico       (recursos_parecer editor: decide e aprova ajuste)
    e504 contratador   contratador    (Lista de aprovados editor)
    e505 admin         admin          (o grupo admin global existente)
  Cargas (como o GitHub Actions / Apps Script): papel service_role.

  Etapas:
    E0  pré-condições (nada com o número 999/2099 nem códigos 999xxxx) e atores
    E1  edital + cronograma (salvar_monitoramento_com_cronograma_v2) e quadro
        de vagas (salvar_quadro_de_vagas): 1 cargo, 2 vagas (AC 1, PP 1)
    E2  a vaga na Seleção (sincronizar_selecao) e o robô da Empregare
        (listar_vagas/iniciar/gravar_lote/fechar_vaga/finalizar) com 8 candidatos
    E3  análises pela carga incremental da planilha Projetos (iniciar → staging
        → comparar → preparar → processar), notas variadas e 1 Reprovado
    E4  classificação: regra, obter_classificacao_do_edital, lista PRELIMINAR
        gerada, registrada e publicada
    E5  recurso: cadastro (gestor) → parecer (jurídico) → ajuste proposto,
        deferido e aprovado → a classificação muda (posição 6 → 2)
    E6  entrevistas: lista de CONVOCACAO, roteiro, configuração, convocação
        pela lista vigente, regra e agenda, notas lançadas
    E7  lista FINAL publicada como lista de aprovados; carta de convocação,
        Convocado e Contratado
    E8  o que a Seleção (get_selecao_da_area) e os KPIs do edital leem depois

  A conta da classificação é do motor em JavaScript (src/lib/classificacao/
  motor.js), feita no navegador; o banco só registra o retrato. Aqui a função
  FC_ENSAIO_P2P_RETRATO (criada e desfeita na transação) faz a mesma conta,
  simplificada, a partir do json de obter_classificacao_do_edital — o mesmo
  dado que a tela recebe.

  Passos que não têm caminho real seguro dentro de um ensaio viram
  'LACUNA: …' (raise notice) e também vão para a coluna "lacunas" do SELECT
  final (a API só devolve o último SELECT).

  Como rodar (só ensaio, sempre desfeito):
    source …/ensaio.sh && ensaio "$(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/ensaios/ponta-a-ponta.sql)"
  ou cole o arquivo inteiro no SQL Editor (papel postgres).
  Resultado esperado: a linha "ENSAIO OK" do SELECT final. Qualquer
  "FALHOU …" interrompe e desfaz tudo.

  tests/ensaio-ponta-a-ponta.test.js garante que o arquivo termina em
  rollback e não tem commit.
*/
begin;

-- Registro das lacunas e desvios (GUC da transação: qualquer papel lê e escreve).
select set_config('ensaio.lacunas', '', true);

-- ═══ E0. Pré-condições e atores ═══════════════════════════════════════════════
do $$
begin
  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where private."FC_NUMERO_EDITAL"(edital) = '999/2099')
     or exists (select 1 from public."TB_ANALISE_CURRICULAR" where private."FC_NUMERO_EDITAL"(edital) = '999/2099')
     or exists (select 1 from public."TB_SELECAO_VAGA" where private."FC_NUMERO_EDITAL"("DS_EDITAL") = '999/2099') then
    raise exception 'ENSAIO: já existe dado com o número 999/2099; escolha outro número fictício';
  end if;
  if exists (select 1 from public."TB_EMPREGARE_CANDIDATO" where "CO_CANDIDATO_EMPREGARE" ~ '^999[0-9]{4}$')
     or exists (select 1 from public."TB_EMPREGARE_VAGA" where "CO_VAGA" = '9990900')
     or exists (select 1 from public."TB_SELECAO_VAGA" where "CO_VAGA" = '9990900') then
    raise exception 'ENSAIO: já existe vaga 9990900 ou candidato 999xxxx na Empregare/Seleção';
  end if;
  if exists (select 1 from auth.users where email like '%@ensaio.invalid') then
    raise exception 'ENSAIO: há usuário @ensaio.invalid gravado de verdade';
  end if;

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000e501', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.p2p.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e502', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.p2p.coordenador@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e503', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.p2p.juridico@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e504', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.p2p.contratador@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e505', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.p2p.admin@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000e501', 'ensaio.p2p.gestor@ensaio.invalid', 'Ensaio Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-00000000e502', 'ensaio.p2p.coordenador@ensaio.invalid', 'Ensaio Coordenador', 'coordenador', true),
    ('00000000-0000-4000-a000-00000000e503', 'ensaio.p2p.juridico@ensaio.invalid', 'Ensaio Jurídico', 'juridico', true),
    ('00000000-0000-4000-a000-00000000e504', 'ensaio.p2p.contratador@ensaio.invalid', 'Ensaio Contratador', 'contratador', true),
    ('00000000-0000-4000-a000-00000000e505', 'ensaio.p2p.admin@ensaio.invalid', 'Ensaio Admin', 'admin', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, 'projetos' from public."TB_PERFIL_USUARIO" u
   where u.email like 'ensaio.p2p.%@ensaio.invalid' and u.perfil <> 'admin';
  if not exists (select 1 from public."TB_GRUPO_ACESSO" where "CO_GRUPO_ACESSO" = 'admin' and "ST_ADMIN_GLOBAL") then
    raise exception 'ENSAIO: o grupo admin global não existe';
  end if;
  raise notice 'ok E0: sem dados com 999/2099 nem códigos 999xxxx; 5 atores criados (área Projetos)';
end;
$$;

/*
  A conta do motor, simplificada, sobre o json de obter_classificacao_do_edital
  (vaga 9990900; regra do ensaio: AC + PP, 1 vaga de cada; nota mínima
  documental 20; situações aptas Aprovado/Triado; ajuste aprovado de
  DOCUMENTAL vale por cima da nota da análise; FINAL = documental + entrevista,
  só quem tem parecer APTO; CONVOCACAO = 4 primeiros da geral + 2 primeiros
  da lista PP). Some no rollback.
*/
create function public."FC_ENSAIO_P2P_RETRATO"(p_dados json, p_tipo text)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  with c as (
    select (x ->> 'analise_id')::uuid as id, x ->> 'nome' as nome, coalesce(x ->> 'modalidade', '') as modalidade,
           x ->> 'status' as status,
           coalesce(
             (select (i ->> 'novo')::numeric
                from json_array_elements(p_dados -> 'ajustes') j, json_array_elements(j -> 'itens') i
               where (j ->> 'analise_id')::uuid = (x ->> 'analise_id')::uuid and i ->> 'codigo' = 'DOCUMENTAL'
               order by j ->> 'aprovado_em' desc limit 1),
             (x ->> 'nota_documental')::numeric) as doc,
           exists (select 1 from json_array_elements(p_dados -> 'ajustes') j
                    where (j ->> 'analise_id')::uuid = (x ->> 'analise_id')::uuid) as ajustado
      from json_array_elements(p_dados -> 'candidatos') x
     where x ->> 'vaga' = '9990900'
  ),
  e as (
    select (y ->> 'analise_id')::uuid as id, (y ->> 'nota')::numeric as nota, y ->> 'parecer' as parecer
      from json_array_elements(p_dados -> 'entrevistas') y
  ),
  base as (
    select c.*, (c.modalidade ilike '%pret%' or c.modalidade ilike '%pard%') as pp,
           (case when c.status not in ('Aprovado', 'Triado') then 'SITUACAO_INAPTA'
                 when c.doc is null or c.doc < 20 then 'NOTA_MINIMA'
                 when p_tipo = 'FINAL' and e.id is null then 'SEM_ENTREVISTA'
                 when p_tipo = 'FINAL' and e.parecer is distinct from 'APTO' then 'ENTREVISTA_' || coalesce(e.parecer, 'SEM_PARECER')
            end) as motivo,
           (case when p_tipo = 'FINAL' then c.doc + coalesce(e.nota, 0) else c.doc end) as nota
      from c left join e on e.id = c.id
  ),
  ap as (select b.*, row_number() over (order by b.nota desc, b.nome) as pos from base b where b.motivo is null),
  ppl as (select a.*, row_number() over (order by a.nota desc, a.nome) as pos_pp from ap a where a.pp),
  vaga_ac as (select a.id from ap a order by a.pos limit 1),
  vaga_pp as (select p.id from ppl p where p.id not in (select id from vaga_ac) order by p.pos_pp limit 1),
  dentro as (
    select a.id from ap a where p_tipo <> 'CONVOCACAO' or a.pos <= 4
    union
    select p.id from ppl p where p_tipo <> 'CONVOCACAO' or p.pos_pp <= 2
  ),
  linha as (
    select a.id, a.pos, jsonb_build_object(
             'posicao', a.pos, 'analise_id', a.id, 'nome', a.nome, 'nota', a.nota,
             'modalidades', case when a.pp then '["AC","PP"]'::jsonb else '["AC"]'::jsonb end,
             'situacao', case when a.id in (select id from vaga_ac) or a.id in (select id from vaga_pp) then 'VAGA' else 'CR' end)
           || case when a.ajustado then '{"recursos":[1]}'::jsonb else '{}'::jsonb end as j
      from ap a
  ),
  eliminados as (
    select b.id, b.nome, b.motivo from base b where b.motivo is not null
    union all
    select a.id, a.nome, 'FORA_DA_CONVOCACAO' from ap a where a.id not in (select id from dentro)
  )
  select jsonb_build_object(
    'schema', 1, 'tipo', p_tipo,
    'edital', jsonb_build_object('id', p_dados -> 'edital' ->> 'id', 'edital', p_dados -> 'edital' ->> 'edital',
                                 'unidade', p_dados -> 'edital' ->> 'unidade'),
    'regra_versao', (p_dados -> 'regra' ->> 'versao')::integer,
    'casas', 2, 'data_corte', null, 'rodape', 'Ensaio.', 'empate_final', 'MESMA_POSICAO',
    'modalidades', '[{"codigo":"PP","nome":"Pretos e pardos"}]'::jsonb,
    'vagas', jsonb_build_array(jsonb_build_object(
      'chave', '9990900', 'codigo', '9990900', 'cargo', 'Analista de Ensaio', 'lotacao', null,
      'total', 2, 'cadastro_reserva', true, 'origem_das_vagas', 'QUADRO',
      'geral', coalesce((select jsonb_agg(l.j order by l.pos) from linha l
                          where p_tipo <> 'CONVOCACAO' or l.pos <= 4), '[]'::jsonb),
      'listas', jsonb_build_object('PP', coalesce((
          select jsonb_agg(l.j || jsonb_build_object('posicao', p.pos_pp) order by p.pos_pp)
            from ppl p join linha l on l.id = p.id
           where p_tipo <> 'CONVOCACAO' or p.pos_pp <= 2), '[]'::jsonb)),
      'eliminados', coalesce((select jsonb_agg(jsonb_build_object('analise_id', x.id, 'nome', x.nome, 'motivo', x.motivo)
                                               order by x.nome) from eliminados x), '[]'::jsonb))),
    'avisos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
    'totais', jsonb_build_object('elegiveis', (select count(*) from dentro),
                                 'eliminados', (select count(*) from eliminados), 'avisos', 0, 'pendencias', 0));
$function$;
grant execute on function public."FC_ENSAIO_P2P_RETRATO"(json, text) to authenticated;

-- Posição do candidato (pelo nome) na lista geral de um retrato.
create function public."FC_ENSAIO_P2P_POSICAO"(p_retrato jsonb, p_nome text)
returns integer
language sql
immutable
set search_path to ''
as $function$
  select (g ->> 'posicao')::integer
    from jsonb_array_elements(p_retrato -> 'vagas' -> 0 -> 'geral') g
   where g ->> 'nome' = p_nome;
$function$;
grant execute on function public."FC_ENSAIO_P2P_POSICAO"(jsonb, text) to authenticated;

-- ═══ E1. Edital, cronograma e quadro de vagas (gestor do edital) ════════════════
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  c_juridico constant text := '{"sub":"00000000-0000-4000-a000-00000000e503","role":"authenticated","email":"ensaio.p2p.juridico@ensaio.invalid"}';
  d constant date := (now() at time zone 'America/Sao_Paulo')::date;
  v jsonb;
  v_edital uuid;
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'edital', 'Edital 999/2099 - Ensaio ponta a ponta', 'processo', '00000.999999/2099-99',
    'unidade', 'Ensaio Unidade Projetos', 'uf', 'DF', 'responsavel', 'ENSAIO', 'co_area', 'projetos',
    'vagas_total', 2, 'cronograma_automatico', true, 'cronograma_origem', 'MANUAL');

  -- Jurídico não cadastra edital (Núcleo leitor).
  perform set_config('request.jwt.claims', c_juridico, true);
  begin
    perform public.salvar_monitoramento_com_cronograma_v2(v_payload, '[]'::jsonb, null, null);
    raise exception 'FALHOU E1: jurídico cadastrou edital';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.salvar_monitoramento_com_cronograma_v2(v_payload, jsonb_build_array(
      jsonb_build_object('ordem', 1, 'atividade', 'Inscrições', 'data_inicio', d - 30, 'data_fim', d - 20),
      jsonb_build_object('ordem', 2, 'atividade', 'Análise curricular', 'data_inicio', d - 19, 'data_fim', d - 10),
      jsonb_build_object('ordem', 3, 'atividade', 'Resultado preliminar', 'data_inicio', d - 9, 'data_fim', d - 9),
      jsonb_build_object('ordem', 4, 'atividade', 'Recurso', 'data_inicio', d - 8, 'data_fim', d - 6),
      jsonb_build_object('ordem', 5, 'atividade', 'Entrevista', 'data_inicio', d - 5, 'data_fim', d + 5),
      jsonb_build_object('ordem', 6, 'atividade', 'Resultado final', 'data_inicio', d + 10, 'data_fim', d + 10)),
    null, null);
  v_edital := (v #>> '{registro,id}')::uuid;
  if v_edital is null or v #>> '{registro,CO_AREA}' <> 'projetos' or (v ->> 'cronograma_total')::integer <> 6
     or v ->> 'motivo' <> 'Cadastro do edital' then
    raise exception 'FALHOU E1: edital salvo %', v;
  end if;

  perform public.salvar_quadro_de_vagas(v_edital, jsonb_build_object('origem', 'MANUAL', 'linhas', jsonb_build_array(
    jsonb_build_object('cargo', 'Analista de Ensaio', 'vagas_imediatas', 2, 'cadastro_reserva', true,
                       'modalidades', jsonb_build_object('Ampla concorrência', 1, 'Pretos e pardos', 1)))));

  perform set_config('ensaio.edital', v_edital::text, true);
  raise notice 'ok E1: edital % (Projetos), cronograma com 6 etapas, quadro 1 cargo / 2 vagas (AC 1, PP 1); jurídico barrado (42501)', v_edital;
end;
$$;
reset role;

do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
begin
  if (select count(*) from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = v_edital) <> 6
     or (select count(*) from public."TH_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = v_edital) <> 1
     or (select count(*) from public."TB_QUADRO_VAGA_EDITAL" where "CO_MONITORAMENTO" = v_edital and "ST_REGISTRO_ATIVO" = 'S'
           and "QT_VAGA_IMEDIATA" = 2 and "DS_MODALIDADE_VAGA" ? 'Pretos e pardos') <> 1
     or (select "CO_AREA" from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital) <> 'projetos'
     or (select "CO_AREA" from public."TA_UNIDADE_AREA" where "NO_UNIDADE" = 'Ensaio Unidade Projetos') <> 'projetos' then
    raise exception 'FALHOU E1: o que ficou gravado (cronograma, histórico, quadro, área ou unidade)';
  end if;
  raise notice 'ok E1.2: gravados cronograma (6), histórico "Cadastro do edital", quadro ativo e unidade na área Projetos';
end;
$$;

-- ═══ E2. A vaga na Seleção e o robô da Empregare (service_role) ════════════════
set local role service_role;
do $$
declare
  v jsonb;
  v_lote jsonb := '[]'::jsonb;
  v_nomes constant text[] := array['Ensaio Ana', 'Ensaio Bruno', 'Ensaio Carla', 'Ensaio Davi',
                                   'Ensaio Elisa', 'Ensaio Fabio', 'Ensaio Gabi', 'Ensaio Hugo'];
  i integer;
begin
  -- A vaga nasce na planilha Auditoria (aba Resultado), carregada pela Seleção.
  v := public.sincronizar_selecao('ensaio-p2p-selecao-01', jsonb_build_array(jsonb_build_object(
    'edital', 'Edital 999/2099 - Ensaio ponta a ponta', 'vaga', '9990900', 'unidade', 'Ensaio Unidade Projetos',
    'cargo', 'Analista de Ensaio', 'inscritos', '8', 'aptos', '7', 'cancelados', '0', 'reprovados_questionario', '0',
    'eliminados_nota', '0', 'reprovados_analise', '1', 'triados', '7', 'total_eliminados', '1', 'convocados', '5')));
  if (v ->> 'gravadas')::integer <> 1 then raise exception 'FALHOU E2: sincronizar_selecao %', v; end if;
end;
$$;
reset role;

-- finalizar_sync_selecao é carga TOTAL: fechar só com a linha do ensaio desativaria
-- (na transação) todas as vagas reais e recalcularia os KPIs de todos os editais,
-- segurando locks em produção. O ensaio liga a vaga ao edital pelo mesmo passo
-- interno que o fechamento chama.
do $$
begin
  perform private."FC_LIGAR_SELECAO_AOS_EDITAIS"();
  if (select "CO_MONITORAMENTO" from public."TB_SELECAO_VAGA" where "CO_VAGA" = '9990900') is distinct from current_setting('ensaio.edital')::uuid
     or (select "CO_AREA" from public."TB_SELECAO_VAGA" where "CO_VAGA" = '9990900') <> 'projetos' then
    raise exception 'FALHOU E2: a vaga da Seleção não ligou ao edital do ensaio';
  end if;
  perform set_config('ensaio.lacunas', current_setting('ensaio.lacunas') || ' | LACUNA E2: finalizar_sync_selecao não tem modo incremental (fecha a carga inteira); o ensaio chamou private.FC_LIGAR_SELECAO_AOS_EDITAIS() em vez de fechar a carga', true);
  raise notice 'LACUNA: finalizar_sync_selecao é carga total; ensaio liga a vaga por private.FC_LIGAR_SELECAO_AOS_EDITAIS()';
  raise notice 'ok E2.1: vaga 9990900 na Seleção, ligada ao edital (área Projetos)';
end;
$$;

set local role service_role;
do $$
declare
  v jsonb;
  v_lote jsonb := '[]'::jsonb;
  v_nomes constant text[] := array['Ensaio Ana', 'Ensaio Bruno', 'Ensaio Carla', 'Ensaio Davi',
                                   'Ensaio Elisa', 'Ensaio Fabio', 'Ensaio Gabi', 'Ensaio Hugo'];
begin
  -- Quais vagas o robô baixa para o edital 999/2099.
  v := public.listar_vagas_empregare(array['999/2099']);
  if not exists (select 1 from jsonb_array_elements(v -> 'vagas') x where x ->> 'vaga' = '9990900') then
    raise exception 'FALHOU E2: listar_vagas_empregare não trouxe a vaga do edital %', v;
  end if;

  perform public.iniciar_sync_empregare('ensaio-p2p-empregare-01', 'AGENDA', null, '{"editais":["999/2099"]}'::jsonb, 1);
  for i in 1..8 loop
    v_lote := v_lote || jsonb_build_array(jsonb_build_object(
      'chave', 'cod:' || (9990000 + i), 'tipo', 'CODIGO', 'codigo', (9990000 + i)::text, 'nome', v_nomes[i],
      'email', 'candidato' || i || '@ensaio.invalid', 'nascimento', (date '1980-01-01' + i * 400)::text,
      'candidatura', '2026-09-01T09:00:00',
      'colunas', jsonb_build_object('Nome', v_nomes[i], 'Código', (9990000 + i)::text, 'Possui experiência?', 'Sim')));
  end loop;
  v := public.gravar_lote_empregare('ensaio-p2p-empregare-01', '9990900', 8, v_lote);
  if v ->> 'situacao' <> 'EM_CARGA' or (v ->> 'gravadas')::integer <> 8 then
    raise exception 'FALHOU E2: gravar_lote_empregare %', v;
  end if;
  v := public.fechar_vaga_empregare('ensaio-p2p-empregare-01', '9990900', '["Nome","Código","Possui experiência?"]'::jsonb, 'ensaio.xlsx');
  if v ->> 'situacao' <> 'GRAVADA' or (v ->> 'ativos')::integer <> 8 then
    raise exception 'FALHOU E2: fechar_vaga_empregare %', v;
  end if;
  v := public.finalizar_sync_empregare('ensaio-p2p-empregare-01', 1, 0);
  if v ->> 'situacao' <> 'CONCLUIDA' then raise exception 'FALHOU E2: finalizar_sync_empregare %', v; end if;
  raise notice 'ok E2.2: robô listou a vaga do edital, gravou 8 candidatos e fechou a execução (CONCLUIDA)';
end;
$$;
reset role;

set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  c_juridico constant text := '{"sub":"00000000-0000-4000-a000-00000000e503","role":"authenticated","email":"ensaio.p2p.juridico@ensaio.invalid"}';
  c_admin constant text := '{"sub":"00000000-0000-4000-a000-00000000e505","role":"authenticated","email":"ensaio.p2p.admin@ensaio.invalid"}';
  v json;
begin
  -- Gestor (Seleção editor, área do edital) lê os candidatos da vaga; jurídico (leitor) não.
  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.obter_candidatos_empregare('9990900');
  if json_array_length(v -> 'candidatos') <> 8 or json_array_length(v -> 'colunas') <> 3 then
    raise exception 'FALHOU E2: obter_candidatos_empregare %', v;
  end if;
  perform set_config('request.jwt.claims', c_juridico, true);
  begin
    perform public.obter_candidatos_empregare('9990900');
    raise exception 'FALHOU E2: jurídico leu os candidatos da Empregare';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', c_admin, true);
  if not exists (select 1 from json_array_elements(public.get_saude_das_cargas() -> 'empregare') x
                  where (x ->> 'inicio')::timestamptz = now() and x ->> 'situacao' = 'CONCLUIDA'
                    and (x ->> 'linhas')::integer = 8) then
    raise exception 'FALHOU E2: a execução do robô não aparece no Status das atualizações';
  end if;
  raise notice 'ok E2.3: gestor lê os 8 candidatos da vaga; jurídico barrado (42501); admin vê a execução no Status das atualizações';
end;
$$;
reset role;

do $$
begin
  if (select "CO_MONITORAMENTO" from public."TB_EMPREGARE_VAGA" where "CO_VAGA" = '9990900') is distinct from current_setting('ensaio.edital')::uuid then
    raise exception 'FALHOU E2: TB_EMPREGARE_VAGA sem o edital do ensaio';
  end if;
  raise notice 'ok E2.4: a vaga da Empregare ficou ligada ao edital';
end;
$$;

-- ═══ E3. Análises pela carga incremental da planilha Projetos (service_role) ═══
set local role service_role;
do $$
declare
  c_sync constant uuid := '00000000-0000-4000-a000-0000000e5999';
  c_edital constant text := 'Edital 999/2099 - Ensaio ponta a ponta';
  c_unidade constant text := 'Ensaio Unidade Projetos';
  v_nomes constant text[] := array['Ensaio Ana', 'Ensaio Bruno', 'Ensaio Carla', 'Ensaio Davi',
                                   'Ensaio Elisa', 'Ensaio Fabio', 'Ensaio Gabi', 'Ensaio Hugo'];
  v_mod constant text[] := array['Ampla concorrência', 'Pretos e pardos', 'Ampla concorrência', 'Pretos e pardos',
                                 'Ampla concorrência', 'Ampla concorrência', 'Pretos e pardos', 'Ampla concorrência'];
  v_nota constant numeric[] := array[90, 85, 80, 75, 70, 65, 60, 40];
  v_status constant text[] := array['Aprovado', 'Aprovado', 'Aprovado', 'Aprovado', 'Aprovado', 'Aprovado', 'Aprovado', 'Reprovado'];
  v_itens jsonb := '[]'::jsonb;
  v jsonb;
  v_payload jsonb;
  i integer;
begin
  v := public.iniciar_sync_analises_incremental(c_sync, 'apps_script_analises_projetos_incremental_v1');
  if v ->> 'status' <> 'carregado' then raise exception 'FALHOU E3: iniciar %', v; end if;

  -- A dimensão de editais (o Apps Script manda antes dos fatos).
  insert into public."TM_ANALISE_CURRICULAR" (sync_id, entidade, linha_origem, payload, hash_registro)
  values (c_sync, 'DIM_EDITAIS', 1, jsonb_build_object('grupo', 'Projetos', 'unidade', c_unidade, 'edital', c_edital, 'ativo', true), 'ensaio-dim-1');

  for i in 1..8 loop
    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'linha_origem', i + 1,
      'chave_natural', public.analises_make_chave_natural('Projetos', c_unidade, c_edital, '9990900', (9990000 + i)::text, v_nomes[i]),
      'hash_registro', 'ensaio-hash-' || i));
  end loop;
  v := public.comparar_analises_incremental_v2(c_sync, v_itens, true);
  if (v ->> 'alterados')::integer <> 8 then raise exception 'FALHOU E3: comparar %', v; end if;

  for i in 1..8 loop
    v_payload := jsonb_build_object(
      'grupo', 'Projetos', 'unidade', c_unidade, 'edital', c_edital, 'codigo_vaga', '9990900',
      'nome_vaga', 'Analista de Ensaio', 'candidato', v_nomes[i], 'id', (9990000 + i)::text,
      'modalidade_concorrencia', v_mod[i], 'nota_final_ajustada', v_nota[i], 'somatorio', v_nota[i],
      'pontuacao_escolaridade', 10, 'pontuacao_experiencia_profissional', v_nota[i] - 10,
      'status_consolidado', v_status[i], 'etapa', 'Análise concluída', 'data_analise', '2026-09-20',
      'data_nascimento', (date '1980-01-01' + i * 400)::text, 'responsavel_analise', 'Ensaio Analista',
      'pcd', 'Não', 'origem_planilha', 'ensaio');
    insert into public."TM_ANALISE_CURRICULAR" (sync_id, entidade, linha_origem, payload, hash_registro)
    values (c_sync, 'FATO_ANALISES', i + 1, v_payload, 'ensaio-hash-' || i);
  end loop;

  v := public.preparar_sync_analises_incremental(c_sync, 8);
  if (v ->> 'fato_alterados')::integer <> 8 or (v ->> 'editais')::integer <> 1 or v ->> 'planilha' <> 'projetos' then
    raise exception 'FALHOU E3: preparar %', v;
  end if;
  v := public.processar_sync_analises_incremental_lote(c_sync, 250);
  if (v ->> 'lidas')::integer <> 8 or (v ->> 'alteradas')::integer <> 8 then
    raise exception 'FALHOU E3: processar lote %', v;
  end if;
  raise notice 'ok E3: carga incremental Projetos: iniciar → staging (1 edital, 8 fatos) → comparar (8 novas) → preparar → processar (8 gravadas)';
end;
$$;
reset role;

-- finalizar_sync_analises_incremental desativa os editais e as análises da planilha
-- que não vieram no envio (FC_DESATIVAR_AUSENTES_DA_PLANILHA): com só as 8 linhas do
-- ensaio, desativaria (na transação) a planilha Projetos inteira. Fica de fora.
do $$
begin
  perform set_config('ensaio.lacunas', current_setting('ensaio.lacunas') || ' | LACUNA E3: finalizar_sync_analises_incremental não roda no ensaio (desativaria as análises ausentes da planilha Projetos); as análises ficaram gravadas pelo processar_sync_analises_incremental_lote', true);
  raise notice 'LACUNA: finalizar_sync_analises_incremental não roda no ensaio (desativaria a planilha inteira)';
  if (select count(*) from public."TB_ANALISE_CURRICULAR"
       where ativo and "CO_AREA" = 'projetos' and "CO_PLANILHA" = 'projetos'
         and private."FC_NUMERO_EDITAL"(edital) = '999/2099' and codigo_vaga = '9990900') <> 8
     or (select count(*) from public."TB_ANALISE_CURRICULAR"
          where private."FC_NUMERO_EDITAL"(edital) = '999/2099' and status_consolidado = 'Reprovado') <> 1
     or (select modalidade_concorrencia from public."TB_ANALISE_CURRICULAR"
          where private."FC_NUMERO_EDITAL"(edital) = '999/2099' and id_origem = '9990002') <> 'Pretos e pardos' then
    raise exception 'FALHOU E3: análises gravadas (8 ativas na área Projetos, 1 Reprovado, modalidade normalizada)';
  end if;
  -- A Empregare e a análise não se ligam: o código do candidato é o mesmo por convenção.
  if (select count(*) from public."TB_ANALISE_CURRICULAR" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = a.codigo_vaga and c."CO_CANDIDATO_EMPREGARE" = a.id_origem
       where private."FC_NUMERO_EDITAL"(a.edital) = '999/2099') <> 8 then
    raise exception 'FALHOU E3: o código do candidato não casa entre análise e Empregare';
  end if;
  perform set_config('ensaio.lacunas', current_setting('ensaio.lacunas') || ' | LACUNA E3: não há passagem Empregare → análise curricular no banco; a análise nasce da planilha (o ensaio confere só que vaga + código do candidato casam)', true);
  raise notice 'LACUNA: não há passagem Empregare → análise curricular; a análise vem da planilha';
end;
$$;

do $$
begin
  perform set_config('ensaio.analises', (
    select string_agg(a.candidato || '=' || a.id::text, ',' order by a.id_origem)
      from public."TB_ANALISE_CURRICULAR" a
     where private."FC_NUMERO_EDITAL"(a.edital) = '999/2099' and a.ativo), true);
  raise notice 'ok E3.2: 8 análises ativas (1 Reprovado) e códigos casando com a Empregare';
end;
$$;

-- ═══ E4. Classificação: regra e lista PRELIMINAR (gestor) ═══════════════════════
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  c_contratador constant text := '{"sub":"00000000-0000-4000-a000-00000000e504","role":"authenticated","email":"ensaio.p2p.contratador@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_regra constant jsonb := '{
    "schema": 1, "data_corte": null, "rodape": "Ensaio.",
    "etapas": {"documental": true, "entrevista": true},
    "documental": {"parciais": [], "nota_minima": 20, "nivel_padrao": null, "situacoes_aptas": ["Aprovado", "Triado"],
                   "niveis_por_cargo": [], "nota_minima_por_nivel": {}},
    "entrevista": {"so_parecer": false, "nota_minima": null, "competencias": [], "inapto_elimina": true,
                   "exige_comparecimento": true, "nota_eliminatoria_ate": null, "nota_minima_competencia": null},
    "composicao": {"casas": 2, "arredondamento": "MEIO_PARA_CIMA",
                   "componentes": [{"codigo": "DOCUMENTAL", "peso": 1}, {"codigo": "ENTREVISTA", "peso": 1}]},
    "desempate": [{"criterio": "MAIOR_IDADE", "direcao": "MAIOR_PRIMEIRO"}],
    "listas": {"PRELIMINAR": {"empate": "MESMA_POSICAO"}, "ENTREVISTA": {"empate": "MESMA_POSICAO"}, "FINAL": {"empate": "CRITERIOS"}},
    "empate_final": {"metodo": "MESMA_POSICAO", "numeracao": "DENSA"},
    "modalidades": [
      {"codigo": "AC", "nome": "Ampla concorrência", "percentual": null, "lista_propria": false, "aparece_na_geral": true,
       "recomeca_posicao": true, "arredondamento": "MEIO_PARA_CIMA", "remanejar_para": [], "agrupa": []},
      {"codigo": "PP", "nome": "Pretos e pardos", "percentual": 50, "lista_propria": true, "aparece_na_geral": true,
       "recomeca_posicao": true, "arredondamento": "MEIO_PARA_CIMA", "remanejar_para": [], "agrupa": []}],
    "cotas": {"acumulo": "MAIOR_PERCENTUAL", "minimo_vagas_reserva": 0},
    "convocacao": {"multiplo_vagas": 2, "posicao_max_cr": null, "incluir_empatados": true, "excecoes": []}
  }';
  v json;
  v_dados json;
  v_retrato jsonb;
  v_lista json;
begin
  perform set_config('request.jwt.claims', c_gestor, true);
  if not exists (select 1 from json_array_elements(public.listar_editais_classificacao('projetos') -> 'editais') x
                  where (x ->> 'id')::uuid = v_edital)
     and not exists (select 1 from json_array_elements(public.listar_editais_classificacao('projetos')) x
                      where (x ->> 'id')::uuid = v_edital) then
    raise exception 'FALHOU E4: o edital não aparece em listar_editais_classificacao';
  end if;
  v_dados := public.obter_classificacao_do_edital(v_edital);
  if json_array_length(v_dados -> 'candidatos') <> 8 or json_array_length(v_dados -> 'quadro') <> 1
     or json_array_length(v_dados -> 'cronograma') <> 6 or json_typeof(v_dados -> 'regra') = 'object'
        and (v_dados -> 'regra' ->> 'versao') is not null
     or not (v_dados ->> 'pode_editar')::boolean
     or exists (select 1 from json_array_elements(v_dados -> 'candidatos') x where x ->> 'quadro' is null) then
    raise exception 'FALHOU E4: dados da classificação (8 candidatos ligados ao quadro, 6 etapas, sem regra) %',
      json_build_object('candidatos', json_array_length(v_dados -> 'candidatos'), 'quadro', v_dados -> 'quadro', 'regra', v_dados -> 'regra');
  end if;

  -- Contratador (Classificação leitor) não salva regra.
  perform set_config('request.jwt.claims', c_contratador, true);
  begin
    perform public.salvar_regra_classificacao(v_edital, v_regra, 0, null);
    raise exception 'FALHOU E4: contratador salvou a regra';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.salvar_regra_classificacao(v_edital, v_regra, 0, null);
  if (v ->> 'versao')::integer <> 1 then raise exception 'FALHOU E4: regra versão 1 %', v; end if;

  v_dados := public.obter_classificacao_do_edital(v_edital);
  v_retrato := public."FC_ENSAIO_P2P_RETRATO"(v_dados, 'PRELIMINAR');
  if jsonb_array_length(v_retrato -> 'vagas' -> 0 -> 'geral') <> 7
     or jsonb_array_length(v_retrato -> 'vagas' -> 0 -> 'eliminados') <> 1
     or public."FC_ENSAIO_P2P_POSICAO"(v_retrato, 'Ensaio Fabio') <> 6 then
    raise exception 'FALHOU E4: a conta da PRELIMINAR %', v_retrato;
  end if;
  v_lista := public.registrar_lista_classificacao(v_edital, 'PRELIMINAR', 1, v_retrato);
  v_lista := public.publicar_lista_classificacao((v_lista ->> 'id')::uuid);
  if v_lista::text not like '%PRELIMINAR%' then
    raise exception 'FALHOU E4: lista preliminar registrada/publicada %', v_lista;
  end if;
  perform set_config('ensaio.preliminar', v_lista ->> 'id', true);
  raise notice 'ok E4: regra v1 (contratador barrado 42501); PRELIMINAR com 7 classificados e 1 eliminado (Hugo, Reprovado); Fabio em 6º; registrada e publicada';
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public."TB_LISTA_CLASSIFICACAO"
       where "CO_LISTA_CLASSIFICACAO" = current_setting('ensaio.preliminar')::uuid
         and "TP_LISTA" = 'PRELIMINAR' and "ST_PUBLICADA" = 'S' and "QT_ELEGIVEL" = 7 and "QT_ELIMINADO" = 1
         and "DS_HASH" = encode(sha256(convert_to("DS_RESULTADO"::text, 'UTF8')), 'hex')) <> 1 then
    raise exception 'FALHOU E4: a lista PRELIMINAR gravada (publicada, 7 elegíveis, 1 eliminado, hash)';
  end if;
  raise notice 'ok E4.2: PRELIMINAR gravada com hash, publicada, 7 elegíveis e 1 eliminado';
end;
$$;

-- ═══ E5. Recurso: cadastro, parecer, ajuste de pontuação ═══════════════════════
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  c_juridico constant text := '{"sub":"00000000-0000-4000-a000-00000000e503","role":"authenticated","email":"ensaio.p2p.juridico@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_fabio uuid;
  v json;
  v_dados json;
  v_id uuid;
  v_rev integer;
  v_ajuste uuid;
  v_depois jsonb;
begin
  select split_part(x, '=', 2)::uuid into v_fabio
    from unnest(string_to_array(current_setting('ensaio.analises'), ',')) x where x like 'Ensaio Fabio=%';

  -- Gestor cadastra o recurso ligado à análise e envia para o parecer; não decide nem propõe.
  perform set_config('request.jwt.claims', c_gestor, true);
  if not exists (select 1 from json_array_elements(public.buscar_candidatos_recurso(v_edital, 'Fabio')) x
                  where x::text like '%' || v_fabio::text || '%') then
    raise exception 'FALHOU E5: buscar_candidatos_recurso não acha o candidato';
  end if;
  v := public.salvar_recurso_candidato(jsonb_build_object(
    'edital_id', v_edital, 'origem', 'analise-curricular', 'fora_analise', false, 'analise_id', v_fabio,
    'processo_sei', '00000.999999/2099-01', 'observacao', 'Recurso do ensaio: experiência não contada.'));
  v_id := (v ->> 'id')::uuid;
  v_rev := (v ->> 'revisao')::integer;
  v := public.transicionar_recurso_candidato(v_id, 'enviar_parecer', v_rev, null);
  v_rev := (v ->> 'revisao')::integer;
  if v ->> 'situacao' <> 'EM_ANALISE_JURIDICA' then raise exception 'FALHOU E5: enviar para o parecer %', v; end if;
  begin
    perform public.transicionar_recurso_candidato(v_id, 'deferir', v_rev, 'Gestor tentando decidir o recurso.');
    raise exception 'FALHOU E5: gestor decidiu o recurso';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.propor_ajuste_pontuacao(v_id, '{"lista":"PRELIMINAR","justificativa":"Gestor tentando ajustar a nota.","itens":[{"codigo":"DOCUMENTAL","anterior":65,"novo":88}]}'::jsonb);
    raise exception 'FALHOU E5: gestor propôs ajuste';
  exception when insufficient_privilege then null;
  end;

  -- Jurídico: propõe o ajuste (65 → 88), defere e aprova com a prévia do motor.
  perform set_config('request.jwt.claims', c_juridico, true);
  v := public.propor_ajuste_pontuacao(v_id, jsonb_build_object(
    'lista', 'PRELIMINAR', 'justificativa', 'Experiência profissional comprovada no recurso.',
    'itens', jsonb_build_array(jsonb_build_object('codigo', 'DOCUMENTAL', 'anterior', 65, 'novo', 88,
                                                  'justificativa', 'Dois anos de experiência comprovados.')),
    'previa', jsonb_build_object('mudou', true)));
  v_ajuste := (v -> 'ajustes' -> 0 ->> 'id')::uuid;
  if v -> 'ajustes' -> 0 ->> 'situacao' <> 'PROPOSTO' then raise exception 'FALHOU E5: proposta %', v; end if;
  v := public.transicionar_recurso_candidato(v_id, 'deferir', v_rev, 'Defiro: a experiência foi comprovada no recurso.');
  v_rev := (v ->> 'revisao')::integer;
  if v ->> 'situacao' <> 'DEFERIDO' then raise exception 'FALHOU E5: deferir %', v; end if;

  -- A prévia da aprovação: a conta com o ajuste (como a tela faz antes de aprovar).
  v_dados := public.obter_dados_previa_ajuste(v_id);
  v_dados := json_build_object('edital', v_dados -> 'edital', 'regra', v_dados -> 'regra', 'entrevistas', '[]'::json,
    'candidatos', v_dados -> 'candidatos',
    'ajustes', (select json_agg(x) from (
                  select x from json_array_elements(v_dados -> 'ajustes') x
                  union all
                  select json_build_object('analise_id', v_fabio, 'aprovado_em', now(),
                                           'itens', json_build_array(json_build_object('codigo', 'DOCUMENTAL', 'novo', 88)))) s));
  v_depois := public."FC_ENSAIO_P2P_RETRATO"(v_dados, 'PRELIMINAR');
  v := public.aprovar_ajuste_pontuacao(v_ajuste, jsonb_build_object('mudou', true, 'tipo', 'PRELIMINAR',
         'antes', jsonb_build_object('posicao', 6), 'depois', jsonb_build_object('posicao', public."FC_ENSAIO_P2P_POSICAO"(v_depois, 'Ensaio Fabio'))));
  if v -> 'ajustes' -> 0 ->> 'situacao' <> 'APROVADO' or not (v -> 'ajustes' -> 0 ->> 'mudou_posicao')::boolean then
    raise exception 'FALHOU E5: aprovação %', v;
  end if;

  -- A classificação muda: o gestor vê o ajuste aprovado e o Fabio sobe de 6º para 2º.
  perform set_config('request.jwt.claims', c_gestor, true);
  v_dados := public.obter_classificacao_do_edital(v_edital);
  if json_array_length(v_dados -> 'ajustes') <> 1 or v_dados ->> 'ajustes_mudaram_em' is null then
    raise exception 'FALHOU E5: ajustes na classificação %', v_dados -> 'ajustes';
  end if;
  v_depois := public."FC_ENSAIO_P2P_RETRATO"(v_dados, 'PRELIMINAR');
  if public."FC_ENSAIO_P2P_POSICAO"(v_depois, 'Ensaio Fabio') <> 2 then
    raise exception 'FALHOU E5: a classificação não mudou (Fabio em %)', public."FC_ENSAIO_P2P_POSICAO"(v_depois, 'Ensaio Fabio');
  end if;
  if not (select (r ->> 'mudou_classificacao')::boolean
            from json_array_elements(public.get_recursos_da_area('projetos') -> 'recursos') r
           where (r ->> 'id')::uuid = v_id) then
    raise exception 'FALHOU E5: o recurso não ficou com "mudou a classificação"';
  end if;
  perform set_config('ensaio.recurso', v_id::text, true);
  perform set_config('ensaio.ajuste', v_ajuste::text, true);
  raise notice 'ok E5: recurso cadastrado (gestor) → parecer → ajuste 65→88 proposto, deferido e aprovado (jurídico); gestor barrado de decidir e propor (42501); Fabio 6º → 2º; "mudou a classificação" marcado';
end;
$$;
reset role;

do $$
begin
  if (select string_agg("DS_CAMPO", ',' order by "CO_HISTORICO_RECURSO") from public."TH_RECURSO_CANDIDATO"
       where "CO_RECURSO_CANDIDATO" = current_setting('ensaio.recurso')::uuid and "TP_ACAO" = 'ajuste') is distinct from 'propor,aprovar'
     or (select "TP_SITUACAO" from public."TB_RECURSO_CANDIDATO" where "CO_RECURSO_CANDIDATO" = current_setting('ensaio.recurso')::uuid) <> 'DEFERIDO'
     or (select nota_final_ajustada from public."TB_ANALISE_CURRICULAR"
          where id = (select "CO_ANALISE_CURRICULAR" from public."TB_RECURSO_CANDIDATO"
                       where "CO_RECURSO_CANDIDATO" = current_setting('ensaio.recurso')::uuid)) <> 65 then
    raise exception 'FALHOU E5: histórico do ajuste, situação do recurso ou nota da análise tocada';
  end if;
  raise notice 'ok E5.2: histórico propor → aprovar; recurso DEFERIDO; a nota da análise continua 65 (o ajuste é tabela própria)';
end;
$$;

-- ═══ E6. Entrevistas ═══════════════════════════════════════════════════════════
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  c_coord constant text := '{"sub":"00000000-0000-4000-a000-00000000e502","role":"authenticated","email":"ensaio.p2p.coordenador@ensaio.invalid"}';
  c_contratador constant text := '{"sub":"00000000-0000-4000-a000-00000000e504","role":"authenticated","email":"ensaio.p2p.contratador@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_retrato jsonb;
  v_lista uuid;
  v_conv uuid[];
  v_roteiro uuid;
  v json;
begin
  -- Gestor gera a lista de CONVOCACAO (já com o ajuste).
  perform set_config('request.jwt.claims', c_gestor, true);
  v_retrato := public."FC_ENSAIO_P2P_RETRATO"(public.obter_classificacao_do_edital(v_edital), 'CONVOCACAO');
  v_lista := (public.registrar_lista_classificacao(v_edital, 'CONVOCACAO', 1, v_retrato) ->> 'id')::uuid;
  select array_agg(distinct (l ->> 'analise_id')::uuid) into v_conv
    from (select jsonb_array_elements(v_retrato -> 'vagas' -> 0 -> 'geral') l
          union all
          select jsonb_array_elements(v_retrato -> 'vagas' -> 0 -> 'listas' -> 'PP')) s;
  if cardinality(v_conv) <> 5 or public."FC_ENSAIO_P2P_POSICAO"(v_retrato, 'Ensaio Fabio') <> 2 then
    raise exception 'FALHOU E6: lista de convocação (5 convocados, Fabio em 2º) %', v_retrato;
  end if;

  -- Contratador (Entrevistas leitor) não configura nem convoca.
  perform set_config('request.jwt.claims', c_contratador, true);
  begin
    perform public.convocar_para_entrevista(v_edital, v_lista, v_conv);
    raise exception 'FALHOU E6: contratador convocou';
  exception when insufficient_privilege then null;
  end;

  -- Coordenador: roteiro, configuração (banca) e convocação pela lista vigente.
  perform set_config('request.jwt.claims', c_coord, true);
  v := public.salvar_roteiro_entrevista(jsonb_build_object(
    'nome', 'Roteiro do ensaio ponta a ponta', 'area', 'projetos', 'escala', 'FAIXA', 'passo', 0.5,
    'nota_minima_total', 12, 'ausencia_elimina', true,
    'competencias', jsonb_build_array(jsonb_build_object('nome', 'Comunicação', 'nota_maxima', 10),
                                      jsonb_build_object('nome', 'Conhecimento técnico', 'nota_maxima', 10))));
  v_roteiro := (v ->> 'id')::uuid;
  v := public.configurar_entrevista_edital(v_edital, jsonb_build_object(
    'roteiro', v_roteiro, 'banca', '[{"origem":"AgSUS","quantidade":1}]'::jsonb, 'lancamento', 'SECRETARIA',
    'avaliadores', '[{"nome":"Ensaio Avaliadora","origem":"AgSUS","banca":1}]'::jsonb));
  if (v -> 'configuracao' -> 'roteiro' ->> 'id')::uuid is distinct from v_roteiro or json_array_length(v -> 'avaliadores') <> 1
     or (v -> 'lista_convocacao' -> 'lista' ->> 'id')::uuid is distinct from v_lista then
    raise exception 'FALHOU E6: configuração %', v;
  end if;
  begin
    perform public.convocar_para_entrevista(v_edital, current_setting('ensaio.preliminar')::uuid, v_conv);
    raise exception 'FALHOU E6: convocou por lista que não é a de convocação vigente';
  exception when serialization_failure then null;
  end;
  v := public.convocar_para_entrevista(v_edital, v_lista, v_conv);
  if (v ->> 'convocados')::integer <> 5 or json_array_length(v -> 'dados' -> 'convocados') <> 5 then
    raise exception 'FALHOU E6: convocação %', v;
  end if;
  perform set_config('ensaio.convocacao', v_lista::text, true);
  perform set_config('ensaio.roteiro', v_roteiro::text, true);
  raise notice 'ok E6.1: CONVOCACAO com 5 (4 da geral + PP, Fabio entra pelo ajuste); contratador barrado (42501); roteiro e banca; outra lista = 40001; 5 convocados';
end;
$$;
reset role;

-- Os ids que a tela já tem (entrevista, competência, avaliador): lidos como postgres.
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
begin
  perform set_config('ensaio.entrevistas', (
    select string_agg(e."NO_CANDIDATO" || '=' || e."CO_ENTREVISTA" || '=' || e."CO_ANALISE_CURRICULAR", ',')
      from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO" = v_edital and e."ST_ATIVO" = 'S'), true);
  perform set_config('ensaio.competencias', (
    select string_agg(k."CO_COMPETENCIA"::text, ',' order by k."NU_ORDEM")
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = current_setting('ensaio.roteiro')::uuid), true);
  perform set_config('ensaio.avaliador', (
    select a."CO_AVALIADOR"::text from public."TB_ENTREVISTA_AVALIADOR" a
     where a."CO_MONITORAMENTO" = v_edital and a."ST_ATIVO" = 'S'), true);
  if current_setting('ensaio.entrevistas') is null or current_setting('ensaio.avaliador') is null then
    raise exception 'FALHOU E6: entrevistas ou avaliador não gravados';
  end if;
end;
$$;

set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  c_coord constant text := '{"sub":"00000000-0000-4000-a000-00000000e502","role":"authenticated","email":"ensaio.p2p.coordenador@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_k uuid[] := string_to_array(current_setting('ensaio.competencias'), ',')::uuid[];
  v_av uuid := current_setting('ensaio.avaliador')::uuid;
  v_ent jsonb := '{}'::jsonb;
  v_ana jsonb := '{}'::jsonb;
  x text;
  d date := (now() at time zone 'America/Sao_Paulo')::date + 1;
  v_regra jsonb;
  v_itens jsonb;
  v json;
  v_notas constant jsonb := '{"Ensaio Ana":[8,8],"Ensaio Fabio":[9,8],"Ensaio Bruno":[7,7],"Ensaio Carla":[5,5]}';
begin
  foreach x in array string_to_array(current_setting('ensaio.entrevistas'), ',') loop
    v_ent := v_ent || jsonb_build_object(split_part(x, '=', 1), split_part(x, '=', 2));
    v_ana := v_ana || jsonb_build_object(split_part(x, '=', 1), split_part(x, '=', 3));
  end loop;

  -- Gestor: regra da agenda (dia seguinte, 1 banca) e agenda gerada com os 5.
  perform set_config('request.jwt.claims', c_gestor, true);
  v_regra := jsonb_build_object('schema', 1,
    'datas', jsonb_build_object('modo', 'LISTA', 'dias', jsonb_build_array(d::text), 'so_dias_uteis', false, 'excluir', '[]'::jsonb),
    'periodos', '[{"inicio":"08:00","fim":"12:00"}]'::jsonb, 'duracao_min', 30, 'intervalo_min', 10, 'pausa', null,
    'bancas', 1, 'nomes_das_bancas', '["Sala do ensaio"]'::jsonb, 'ordem', 'CLASSIFICACAO', 'agrupar_por_cargo', true,
    'reservar_primeiro_horario', false, 'fuso', 'America/Sao_Paulo');
  v := public.salvar_regra_agenda_entrevista(v_edital, v_regra, 0, null);
  if (v ->> 'versao')::integer <> 1 then raise exception 'FALHOU E6: regra da agenda %', v; end if;
  select jsonb_agg(jsonb_build_object('analise', v_ana ->> n, 'data', d::text,
           'inicio', to_char(time '08:00' + (o - 1) * interval '40 minutes', 'HH24:MI'),
           'fim', to_char(time '08:30' + (o - 1) * interval '40 minutes', 'HH24:MI'), 'banca', 1, 'origem', 'GERADA') order by o)
    into v_itens
    from unnest(array['Ensaio Ana', 'Ensaio Fabio', 'Ensaio Bruno', 'Ensaio Carla', 'Ensaio Davi']) with ordinality t(n, o);
  v := public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'itens', v_itens, 'versao_regra', 1,
         'lista', current_setting('ensaio.convocacao')));
  if json_array_length(v -> 'itens') <> 5 or v -> 'historico' -> 0 ->> 'acao' <> 'GERAR' then
    raise exception 'FALHOU E6: agenda %', v;
  end if;
  if json_array_length(public.obter_agenda_entrevista(v_edital) -> 'itens') <> 5 then
    raise exception 'FALHOU E6: obter_agenda_entrevista sem os 5 horários';
  end if;

  -- Coordenador lança as notas (secretaria) e a ausência do Davi.
  perform set_config('request.jwt.claims', c_coord, true);
  foreach x in array array['Ensaio Ana', 'Ensaio Fabio', 'Ensaio Bruno', 'Ensaio Carla'] loop
    perform public.lancar_notas_entrevista((v_ent ->> x)::uuid, jsonb_build_object('compareceu', 'S', 'banca', 1,
      'notas', jsonb_build_array(
        jsonb_build_object('competencia', v_k[1], 'avaliador', v_av, 'nota', (v_notas -> x ->> 0)::numeric),
        jsonb_build_object('competencia', v_k[2], 'avaliador', v_av, 'nota', (v_notas -> x ->> 1)::numeric))));
  end loop;
  v := public.lancar_notas_entrevista((v_ent ->> 'Ensaio Davi')::uuid, '{"compareceu":"N","banca":1}'::jsonb);
  if (select string_agg((c ->> 'candidato') || ':' || (c ->> 'parecer') || ':' || coalesce(c ->> 'nota', '-'), ',' order by c ->> 'candidato')
        from json_array_elements(v -> 'convocados') c)
     is distinct from 'Ensaio Ana:APTO:16.00,Ensaio Bruno:APTO:14.00,Ensaio Carla:INAPTO:10.00,Ensaio Davi:INAPTO:0.00,Ensaio Fabio:APTO:17.00' then
    raise exception 'FALHOU E6: pareceres e notas %',
      (select string_agg((c ->> 'candidato') || ':' || (c ->> 'parecer') || ':' || coalesce(c ->> 'nota', '-'), ',' order by c ->> 'candidato')
         from json_array_elements(v -> 'convocados') c);
  end if;
  raise notice 'ok E6.2: regra e agenda (5 horários); notas lançadas: Ana 16, Fabio 17, Bruno 14 APTO; Carla 10 INAPTO (mínimo 12); Davi ausente INAPTO';
end;
$$;
reset role;

-- ═══ E7. Resultado final → lista de aprovados → carta, Convocado, Contratado ═══
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  c_contratador constant text := '{"sub":"00000000-0000-4000-a000-00000000e504","role":"authenticated","email":"ensaio.p2p.contratador@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_retrato jsonb;
  v_final uuid;
  v json;
begin
  perform set_config('request.jwt.claims', c_gestor, true);
  v_retrato := public."FC_ENSAIO_P2P_RETRATO"(public.obter_classificacao_do_edital(v_edital), 'FINAL');
  if (select string_agg((g ->> 'posicao') || ':' || (g ->> 'nome') || ':' || (g ->> 'situacao'), ',' order by (g ->> 'posicao')::integer)
        from jsonb_array_elements(v_retrato -> 'vagas' -> 0 -> 'geral') g)
     is distinct from '1:Ensaio Ana:VAGA,2:Ensaio Fabio:CR,3:Ensaio Bruno:VAGA' then
    raise exception 'FALHOU E7: a conta do resultado final %', v_retrato -> 'vagas' -> 0 -> 'geral';
  end if;
  v_final := (public.registrar_lista_classificacao(v_edital, 'FINAL', 1, v_retrato) ->> 'id')::uuid;
  perform public.publicar_lista_classificacao(v_final);

  -- Contratador (Classificação leitor) não publica a lista de aprovados.
  perform set_config('request.jwt.claims', c_contratador, true);
  begin
    perform public.publicar_lista_aprovados_da_classificacao(v_final, null, '[]'::jsonb);
    raise exception 'FALHOU E7: contratador publicou a lista de aprovados';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.obter_publicacao_lista_aprovados(v_edital, true);
  if (v -> 'resultado_final' ->> 'id')::uuid is distinct from v_final or not (v ->> 'pode_publicar')::boolean
     or json_typeof(v -> 'vigente') not in ('null') and (v -> 'vigente' ->> 'id') is not null then
    raise exception 'FALHOU E7: prévia da publicação %', v;
  end if;
  v := public.publicar_lista_aprovados_da_classificacao(v_final, null, '[]'::jsonb);
  if (v ->> 'candidatos')::integer <> 3 or (v ->> 'entram')::integer <> 3 then
    raise exception 'FALHOU E7: publicação %', v;
  end if;
  perform set_config('ensaio.final', v_final::text, true);
  perform set_config('ensaio.lista_aprovados', v ->> 'lista_id', true);
  raise notice 'ok E7.1: FINAL (Ana VAGA, Fabio CR, Bruno VAGA PP) registrada e publicada; contratador barrado (42501); lista de aprovados publicada com 3';
end;
$$;
reset role;

do $$
declare
  v_lista uuid := current_setting('ensaio.lista_aprovados')::uuid;
begin
  perform set_config('ensaio.aprovados', (
    select string_agg(c.nome || '=' || c.id, ',') from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista), true);
  if (select count(*) from public."TB_CANDIDATO_APROVADO" c
       where c.lista_id = v_lista and c.codigo_vaga = '9990900' and c."CO_ANALISE_CURRICULAR" is not null) <> 3
     or (select string_agg(c.nome || ':' || c."TP_SITUACAO_CLASSIFICACAO", ',' order by c.classificacao)
           from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista) is distinct from 'Ensaio Ana:VAGA,Ensaio Fabio:CR,Ensaio Bruno:VAGA'
     or not exists (select 1 from public."TB_LISTA_APROVADO" l where l.id = v_lista and l.vigente and l."TP_ORIGEM" = 'CLASSIFICACAO') then
    raise exception 'FALHOU E7: lista de aprovados gravada (3 com análise e vaga, situações, vigente da Classificação)';
  end if;
end;
$$;

set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  c_coord constant text := '{"sub":"00000000-0000-4000-a000-00000000e502","role":"authenticated","email":"ensaio.p2p.coordenador@ensaio.invalid"}';
  c_contratador constant text := '{"sub":"00000000-0000-4000-a000-00000000e504","role":"authenticated","email":"ensaio.p2p.contratador@ensaio.invalid"}';
  c_juridico constant text := '{"sub":"00000000-0000-4000-a000-00000000e503","role":"authenticated","email":"ensaio.p2p.juridico@ensaio.invalid"}';
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_c jsonb := '{}'::jsonb;
  x text;
  v_modelo uuid;
  v_carta uuid;
  v json;
  vb jsonb;
begin
  foreach x in array string_to_array(current_setting('ensaio.aprovados'), ',') loop
    v_c := v_c || jsonb_build_object(split_part(x, '=', 1), split_part(x, '=', 2));
  end loop;

  -- Jurídico (aprovados leitor) não muda status.
  perform set_config('request.jwt.claims', c_juridico, true);
  begin
    perform public.alterar_status_candidato_aprovado((v_c ->> 'Ensaio Ana')::uuid, 'Convocado', null, null, null);
    raise exception 'FALHOU E7: jurídico mudou status';
  exception when insufficient_privilege then null;
  end;

  -- Contratador: modelo da carta, carta para os 3 e marcação como Convocado.
  perform set_config('request.jwt.claims', c_contratador, true);
  v := public.salvar_modelo_carta_convocacao(null, 'projetos', current_setting('ensaio.edital')::uuid,
    '{"nome":"Carta do ensaio ponta a ponta","titulo":"CARTA DE CONVOCAÇÃO","texto":"Prezado(a) {NOME}, apresente-se até {DATA_LIMITE} em {LOCAL}.","local":"Sede do ensaio","documentos":"RG\nCPF","contato":"rh@ensaio.invalid","prazo_dias":5}'::jsonb,
    null, null);
  v_modelo := (v ->> 'modelo_id')::uuid;
  v := public.registrar_carta_convocacao(v_modelo, 1,
         array[(v_c ->> 'Ensaio Ana')::uuid, (v_c ->> 'Ensaio Bruno')::uuid, (v_c ->> 'Ensaio Fabio')::uuid], 'UNICO', 'SEI',
         jsonb_build_object('data_limite', (v_hoje + 5)::text, 'local', 'Sede do ensaio', 'documentos', E'RG\nCPF', 'contato', 'rh@ensaio.invalid'));
  v_carta := (v ->> 'carta_id')::uuid;
  if (v ->> 'candidatos')::integer <> 3 then raise exception 'FALHOU E7: carta %', v; end if;
  v := public.marcar_candidatos_convocados(
         array[(v_c ->> 'Ensaio Ana')::uuid, (v_c ->> 'Ensaio Bruno')::uuid, (v_c ->> 'Ensaio Fabio')::uuid], null, v_carta);
  if (v ->> 'marcados')::integer <> 3 then raise exception 'FALHOU E7: marcar convocados %', v; end if;

  -- Contratado: Ana (contratador) e Bruno (coordenador); Fabio fica Convocado (cadastro reserva).
  vb := public.alterar_status_candidato_aprovado((v_c ->> 'Ensaio Ana')::uuid, 'Contratado', '00000.999999/2099-10', 'ENS-001', null);
  if vb ->> 'status' is distinct from 'Contratado' or (vb ->> 'data_convocacao')::date is distinct from v_hoje then
    raise exception 'FALHOU E7: Ana contratada %', vb;
  end if;
  begin
    perform public.alterar_status_candidato_aprovado((v_c ->> 'Ensaio Ana')::uuid, null, null, null, null);
    raise exception 'FALHOU E7: contratador (editor) tirou o status de quem já tinha';
  exception when raise_exception then
    if sqlerrm not like 'O status deste candidato ja foi definido%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', c_coord, true);
  vb := public.alterar_status_candidato_aprovado((v_c ->> 'Ensaio Bruno')::uuid, 'Contratado', '00000.999999/2099-11', 'ENS-002', null);
  if vb ->> 'status' is distinct from 'Contratado' then raise exception 'FALHOU E7: Bruno contratado %', vb; end if;

  -- O gestor (ADMIN em aprovados) vê as convocações da área.
  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.listar_convocacoes_aprovados('projetos');
  if v::text not like '%' || (v_c ->> 'Ensaio Fabio') || '%' then
    raise exception 'FALHOU E7: listar_convocacoes_aprovados sem o Fabio convocado';
  end if;
  perform set_config('ensaio.carta', v_carta::text, true);
  raise notice 'ok E7.2: jurídico barrado (42501); carta para 3, 3 marcados Convocado; Ana (contratador) e Bruno (coordenador) Contratados; editor não desfaz status; Fabio segue Convocado';
end;
$$;
reset role;

do $$
declare
  v_lista uuid := current_setting('ensaio.lista_aprovados')::uuid;
begin
  if (select string_agg(c.nome || ':' || coalesce(c.status, '-'), ',' order by c.classificacao)
        from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista)
     is distinct from 'Ensaio Ana:Contratado,Ensaio Fabio:Convocado,Ensaio Bruno:Contratado'
     or (select count(*) from public."RL_CARTA_CANDIDATO" where "CO_CARTA_CONVOCACAO" = current_setting('ensaio.carta')::uuid) <> 3
     or exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista and c."DT_CONVOCACAO" is null) then
    raise exception 'FALHOU E7: status, carta ou data da convocação gravados';
  end if;
  raise notice 'ok E7.3: gravados 2 Contratados + 1 Convocado, a carta com 3 candidatos e a data da convocação';
end;
$$;

-- ═══ E8. Seleção e KPIs depois disso ═══════════════════════════════════════════
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  v json;
  v_vaga json;
begin
  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.get_selecao_da_area('projetos');
  select x into v_vaga from json_array_elements(v -> 'vagas') x where x ->> 'vaga' = '9990900';
  if v_vaga is null then raise exception 'FALHOU E8: a vaga não aparece na Seleção'; end if;
  if (v_vaga ->> 'edital_id')::uuid is distinct from current_setting('ensaio.edital')::uuid
     or (v_vaga ->> 'inscritos')::integer <> 8
     or v_vaga ->> 'origem_convocados' <> 'entrevistas' or (v_vaga ->> 'convocados')::integer <> 5
     or (v_vaga ->> 'aprovados')::integer <> 3 or (v_vaga ->> 'contratados')::integer <> 2
     or (v_vaga ->> 'nao_contratados')::integer <> 1 then
    raise exception 'FALHOU E8: a vaga na Seleção %', v_vaga;
  end if;
  perform set_config('ensaio.selecao', v_vaga::text, true);
  raise notice 'ok E8.1: Seleção da vaga 9990900: 8 inscritos, 5 convocados (entrevistas), 3 aprovados, 2 contratados, 1 não contratado';
end;
$$;
reset role;

-- Os KPIs do edital (TB_MONITORAMENTO_INDIGENA) são recalculados pelo pg_cron das 10h
-- ou no fim da carga da Seleção; o ensaio chama a mesma função que eles chamam.
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital;
  if coalesce(v_m.contratados, 0) <> 0 then
    raise exception 'FALHOU E8: contratados já preenchido antes do recálculo';
  end if;
  perform private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital;
  if v_m.contratados <> 2 or v_m.entrevistados <> 5 or v_m.aprovados_analise <> 7 or v_m.inscritos <> 8
     or v_m.aptos_analise <> 7 or v_m.reprovados_analise <> 1 then
    raise exception 'FALHOU E8: KPIs do edital (contratados %, entrevistados %, aprovados_analise %, inscritos %, aptos %, reprovados %)',
      v_m.contratados, v_m.entrevistados, v_m.aprovados_analise, v_m.inscritos, v_m.aptos_analise, v_m.reprovados_analise;
  end if;
  perform set_config('ensaio.lacunas', current_setting('ensaio.lacunas') || ' | LACUNA E8: os KPIs do edital (contratados etc.) só mudam no pg_cron das 10h ou no fim da carga da Seleção — mudar o status na Lista de aprovados não recalcula; o ensaio chamou private.FC_ATUALIZAR_KPIS_PELA_SELECAO()', true);
  raise notice 'LACUNA: KPIs do edital só recalculam no cron/carga da Seleção; ensaio chamou private.FC_ATUALIZAR_KPIS_PELA_SELECAO()';
  perform set_config('ensaio.kpis', json_build_object('inscritos', v_m.inscritos, 'aptos', v_m.aptos_analise,
    'reprovados', v_m.reprovados_analise, 'aprovados_analise', v_m.aprovados_analise, 'entrevistados', v_m.entrevistados,
    'contratados', v_m.contratados, 'vagas_total', v_m.vagas_total)::text, true);
  raise notice 'ok E8.2: KPIs do edital: 8 inscritos, 7 aptos, 1 reprovado, 7 aprovados na análise, 5 entrevistados, 2 contratados';
end;
$$;

set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e501","role":"authenticated","email":"ensaio.p2p.gestor@ensaio.invalid"}';
  v jsonb;
begin
  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.listar_acompanhamento_da_visao_geral('projetos');
  if not exists (select 1 from jsonb_array_elements(v -> 'listas') l
                  where (l ->> 'monitoramento_id')::uuid = current_setting('ensaio.edital')::uuid
                    and (l ->> 'aprovados')::integer = 3 and (l ->> 'contratados')::integer = 2) then
    raise exception 'FALHOU E8: Visão geral sem a lista do edital (3 aprovados, 2 contratados) %',
      (select jsonb_agg(l) from jsonb_array_elements(v -> 'listas') l
        where (l ->> 'monitoramento_id')::uuid = current_setting('ensaio.edital')::uuid);
  end if;
  raise notice 'ok E8.3: Visão geral (acompanhamento) do edital: 3 aprovados, 2 contratados';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

-- Resumo (o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK (tudo será desfeito)' as resultado,
  current_setting('ensaio.edital') as edital,
  current_setting('ensaio.selecao') as selecao,
  current_setting('ensaio.kpis') as kpis,
  (select count(*) from public."TB_EMPREGARE_CANDIDATO" where "CO_VAGA" = '9990900') as candidatos_empregare,
  (select count(*) from public."TB_LISTA_CLASSIFICACAO" where "CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid) as listas_classificacao,
  (select count(*) from public."TB_ENTREVISTA" where "CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid) as entrevistas,
  ltrim(current_setting('ensaio.lacunas'), ' |') as lacunas;

rollback;
