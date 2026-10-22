/*
  JOBS LEEM SÓ O NECESSÁRIO (menos egress do Supabase)

  Por quê: o projeto está no plano gratuito (5 GB de egress por ciclo) e em
  14/10 já tinha usado 4,24 GB em 17 dias (~250 MB/dia). Medido no 114/2026
  (7.388 inscritos, 30 vagas):
    - a pré-classificação (pre_classificacao_ler_candidatos) levava em cada
      execução as colunas inteiras de cada inscrito (o DS_COLUNA_ORIGINAL sem
      o cadastro): 38,9 MB, quase tudo o NOME das colunas ("Pergunta 13 -
      Candidatos&nbsp;concorrendo às vagas…", ~200 caracteres) repetido em
      cada inscrito. Roda ~5 vezes por dia (fim de cada robô, Recalcular,
      refazer): ~195 MB/dia;
    - o resumo das perguntas da carga (ler_respostas_pergunta_vaga) levava
      27,1 MB por edital recalculado, também com o nome das colunas repetido
      em cada linha.
  O cálculo precisa de poucas colunas (as perguntas que a regra usa, a ART e
  a situação do questionário) e o nome de cada coluna basta uma vez.

  O QUE MUDA (o resultado do cálculo é o mesmo)
    pre_classificacao_ler_colunas(p_edital)            NOVA. Os nomes das
        colunas dos inscritos do edital (sem as do cadastro), uma vez. O job
        escolhe, com as mesmas funções de casar pergunta do cálculo, as que a
        regra usa (python/monitora/avaliacao_documental/colunas_da_leitura.py).
    pre_classificacao_ler_candidatos(..., p_colunas)   com p_colunas, cada
        inscrito traz só essas colunas, como {"<posição em p_colunas>": valor}
        (a chave é a posição, não o nome), e sem os campos nulos; sem
        p_colunas, exatamente como antes (o job antigo continua funcionando).
        A regra do cadastro (sem nome, e-mail, CPF, telefone, endereço) vale
        também para os nomes pedidos.
    pre_classificacao_ler_editais                      com p_apos_robo, cada
        edital diz se nada mudou ("sem_mudanca") desde a última
        pré-classificação CONCLUÍDA de HOJE que o processou: nenhum inscrito
        novo, alterado, reativado ou desativado (DT_ATUALIZACAO, que a carga
        só muda quando o hash da linha muda), nenhuma decisão, regra ou linha
        do quadro nova. O job pula esses editais no fim do robô; o Recalcular,
        o refazer e o "Rodar agora" (sem p_apos_robo) sempre calculam.
    ler_respostas_pergunta_vaga(p_vaga, p_compacto)    com p_compacto, os
        nomes das colunas vêm uma vez ("colunas") e cada linha é a lista dos
        valores na mesma ordem (null = sem resposta); sem p_compacto, como
        antes.
  Gravações não mudam. Tudo continua só para o service_role.

  Medido (ensaio): ver supabase/ensaios/20261014220000_jobs_leem_so_o_necessario.sql
  Rollback: supabase/rollback/20261014220000_jobs_leem_so_o_necessario.sql
*/
begin;

set local lock_timeout = '10s';

-- 1. Os nomes das colunas dos inscritos do edital (sem as do cadastro) ----------------------
create or replace function public.pre_classificacao_ler_colunas(p_edital uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('colunas', coalesce(jsonb_agg(n.nome order by n.nome), '[]'::jsonb))
    from (select distinct k.nome
            from public."TB_EMPREGARE_VAGA" v
            join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = v."CO_VAGA"
           cross join lateral jsonb_object_keys(c."DS_COLUNA_ORIGINAL") k(nome)
           where v."CO_MONITORAMENTO" = p_edital
             and (lower(k.nome) like 'pergunta %'
                  or lower(k.nome) !~ '(nome|e-?mail|cpf|telefone|celular|whatsapp|endere|logradouro|bairro|cep|nascimento|linkedin|^rg$|documento)')) n;
$$;
comment on function public.pre_classificacao_ler_colunas(uuid) is
  'Pré-classificação (job Python): os nomes das colunas dos inscritos das vagas do edital, sem as do cadastro (nome, e-mail, CPF, telefone, endereço), uma vez. O job escolhe as que a regra usa e pede só elas em pre_classificacao_ler_candidatos(p_colunas). Desde 20261014220000. Só service_role.';
revoke all on function public.pre_classificacao_ler_colunas(uuid) from public, anon, authenticated;
grant execute on function public.pre_classificacao_ler_colunas(uuid) to service_role;

-- 2. Os inscritos de uma vaga: com p_colunas, só essas colunas, pela posição -----------------
drop function if exists public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer);

create function public.pre_classificacao_ler_candidatos(
  p_edital uuid, p_vaga text, p_apos uuid default null, p_limite integer default null, p_colunas text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_candidatos jsonb;
  v_mais boolean;
  v_lido jsonb;
begin
  if not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  if p_limite is not null and (p_limite < 1 or p_limite > 5000) then
    raise exception 'p_limite vai de 1 a 5000' using errcode = '22023';
  end if;
  if cardinality(p_colunas) > 500 then
    raise exception 'Até 500 colunas' using errcode = '22023';
  end if;

  -- Uma parte na ordem do id (o mesmo order by de antes), com um a mais para saber se há outra.
  select coalesce(jsonb_agg(
           case when p_colunas is null then
             jsonb_build_object(
               'id', p."CO_EMPREGARE_CANDIDATO",
               'codigo', coalesce(p."CO_CANDIDATO_EMPREGARE", left(p."DS_CHAVE_CANDIDATO", 12)),
               'ativo', p."ST_REGISTRO_ATIVO" = 'S',
               'nascimento', p."DT_NASCIMENTO",
               'candidatura', to_char(p."DT_CANDIDATURA" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"+00:00"'),
               -- As respostas do questionário e as colunas do processo, sem as do cadastro.
               'colunas', coalesce((
                 select jsonb_object_agg(k.key, k.value)
                   from jsonb_each(p."DS_COLUNA_ORIGINAL") k
                  where lower(k.key) like 'pergunta %'
                     or lower(k.key) !~ '(nome|e-?mail|cpf|telefone|celular|whatsapp|endere|logradouro|bairro|cep|nascimento|linkedin|^rg$|documento)'),
                 '{}'::jsonb))
           else
             -- [enxuto] Só as colunas pedidas que o inscrito tem, pela posição em p_colunas
             -- (a mesma regra do cadastro), e sem os campos nulos.
             jsonb_strip_nulls(jsonb_build_object(
               'id', p."CO_EMPREGARE_CANDIDATO",
               'codigo', coalesce(p."CO_CANDIDATO_EMPREGARE", left(p."DS_CHAVE_CANDIDATO", 12)),
               'ativo', p."ST_REGISTRO_ATIVO" = 'S',
               'nascimento', p."DT_NASCIMENTO",
               'candidatura', to_char(p."DT_CANDIDATURA" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"+00:00"')))
             || jsonb_build_object('c', coalesce((
                  select jsonb_object_agg((u.i - 1)::text, p."DS_COLUNA_ORIGINAL" -> u.nome)
                    from unnest(p_colunas) with ordinality u(nome, i)
                   where p."DS_COLUNA_ORIGINAL" ? u.nome
                     and (lower(u.nome) like 'pergunta %'
                          or lower(u.nome) !~ '(nome|e-?mail|cpf|telefone|celular|whatsapp|endere|logradouro|bairro|cep|nascimento|linkedin|^rg$|documento)')),
                  '{}'::jsonb))
           end
         order by p."CO_EMPREGARE_CANDIDATO")
         filter (where p_limite is null or p.nu_ordem <= p_limite), '[]'::jsonb),
         p_limite is not null and count(*) > p_limite
    into v_candidatos, v_mais
    from (select c."CO_EMPREGARE_CANDIDATO", c."CO_CANDIDATO_EMPREGARE", c."DS_CHAVE_CANDIDATO", c."ST_REGISTRO_ATIVO",
                 c."DT_NASCIMENTO", c."DT_CANDIDATURA", c."DS_COLUNA_ORIGINAL",
                 row_number() over (order by c."CO_EMPREGARE_CANDIDATO") as nu_ordem
            from public."TB_EMPREGARE_CANDIDATO" c
           where c."CO_VAGA" = p_vaga
             and (p_apos is null or c."CO_EMPREGARE_CANDIDATO" > p_apos)
           order by c."CO_EMPREGARE_CANDIDATO"
           limit p_limite + 1) p;

  v_lido := jsonb_build_object('candidatos', v_candidatos, 'mais', v_mais);
  if p_apos is not null then
    return v_lido;
  end if;

  return v_lido || jsonb_build_object(
    -- A vaga: o cargo e a linha do quadro (a mesma de antes em pre_classificacao_ler_editais).
    'vaga', (select jsonb_build_object(
                      'cargo', q."NO_CARGO",
                      'quadro', case when q."CO_QUADRO_VAGA" is null then null else jsonb_build_object(
                        'id', q."CO_QUADRO_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
                        'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S', 'modalidades', q."DS_MODALIDADE_VAGA") end)
               from (select 1) x
               left join lateral (select * from private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga)) q on true),
    'anterior', coalesce((
      select jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO", jsonb_build_object(
               'situacao', a."TP_SITUACAO", 'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE",
               'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE", 'motivo_entrada', a."DS_MOTIVO_ENTRADA",
               -- A declarada congelada não se recalcula (o job usa o valor guardado).
               'declarada_congelada', case when a."VL_DECLARADA_CONGELADA" is not null
                                           then a."DS_DECLARADA_CONGELADA" || jsonb_build_object('total', a."VL_DECLARADA_CONGELADA") end))
        from public."TB_PRE_CLASSIFICACAO" a
       where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga), '{}'::jsonb),
    -- As decisões da coordenação: ficam no lote (entrada DECISAO) em todo recálculo.
    'decisoes', coalesce((
      select jsonb_object_agg(d."CO_EMPREGARE_CANDIDATO", jsonb_build_object('motivo', d."DS_MOTIVO"))
        from public."TB_DECISAO_LOTE" d
       where d."CO_MONITORAMENTO" = p_edital and d."CO_VAGA" = p_vaga and d."ST_ATIVO" = 'S'), '{}'::jsonb)
  );
end;
$$;
comment on function public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer, text[]) is
  'Pré-classificação (job Python): os inscritos de uma vaga do edital em partes, na ordem do id (p_apos = último id da parte anterior; p_limite de 1 a 5.000, nulo = todos; "mais" = há outra parte) — id, código, ativo, nascimento, data da candidatura e as colunas do questionário e do processo SEM as do cadastro (nome, e-mail, CPF, telefone, endereço). Com p_colunas (desde 20261014220000), só essas colunas, em "c" = {"<posição em p_colunas, a partir de 0>": valor}, e sem os campos nulos; sem p_colunas, todas em "colunas" = {nome: valor}, como antes. Na primeira parte (sem p_apos) vêm também a vaga ({cargo, quadro}), a situação anterior de cada inscrito e as decisões vigentes da coordenação. Só service_role.';
revoke all on function public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer, text[]) from public, anon, authenticated;
grant execute on function public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer, text[]) to service_role;

-- 3. Os editais: no fim do robô, diz quem não mudou desde a última pré-classificação de hoje --
create or replace function public.pre_classificacao_ler_editais(p_editais text[] default null, p_apos_robo boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
  v_sync text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome ("FCC").
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  elsif p_apos_robo then
    -- Os editais das vagas gravadas na última execução fechada do robô.
    select s."CO_SYNC" into v_sync
      from public."TL_SYNC_EMPREGARE" s
     where s."TP_SITUACAO" in ('CONCLUIDA', 'PARCIAL')
     order by s."DT_INICIO" desc limit 1;
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_SYNC" = v_sync and v."CO_MONITORAMENTO" is not null
       and not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO");
  else
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  return jsonb_build_object(
    'hoje', v_hoje,
    'sync', v_sync,
    'nao_encontrados', coalesce((
      select jsonb_agg(p.texto order by p.texto)
        from unnest(v_pedidos) p(texto)
       where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                          where m.id::text = lower(p.texto)
                             or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                             or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
               'area', m."CO_AREA",
               'ativo', coalesce(m.ativo, false),
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
               'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                                   'configuracao', h."DS_CONFIGURACAO")
                           from public."TB_REGRA_ANALISE" r
                           join public."TH_REGRA_ANALISE" h
                             on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                          where r."CO_MONITORAMENTO" = m.id),
               'documental', private."FC_DOCUMENTAL_DO_EDITAL"(m.id),
               -- O cronograma: o job congela a declarada depois do fim das inscrições.
               'cronograma', coalesce((
                 select jsonb_agg(jsonb_build_object('atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
                        order by c.ordem)
                   from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = m.id), '[]'::jsonb),
               -- Refazer o lote do zero: ninguém analisado e TODAS as fichas do edital intocadas
               -- (FC_FICHAS_INICIADAS = 0); fichas_iniciadas vai para a mensagem da recusa (20261013110000).
               'fichas_iniciadas', fi.n,
               'refazer_permitido', fi.n = 0
                                    and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                                     where a."CO_MONITORAMENTO" = m.id and a."TP_SITUACAO" = 'ANALISADO'),
               -- [sem-mudanca] Só no fim do robô: nada mudou desde a última pré-classificação
               -- CONCLUÍDA de hoje que processou o edital (o job pula o edital).
               'sem_mudanca', p_apos_robo and cardinality(v_pedidos) = 0 and exists (
                 select 1
                   from public."TL_PRE_CLASSIFICACAO" l
                  where l."TP_SITUACAO" = 'CONCLUIDA'
                    and (l."DT_INICIO" at time zone 'America/Sao_Paulo')::date = v_hoje
                    and l."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', m.id, 'situacao', 'PROCESSADO'))
                    and l."DT_INICIO" > coalesce((
                          select max(c."DT_ATUALIZACAO")
                            from public."TB_EMPREGARE_VAGA" v
                            join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = v."CO_VAGA"
                           where v."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(d."DT_CRIACAO", d."DT_ATUALIZACAO", d."DT_REVOGACAO"))
                            from public."TB_DECISAO_LOTE" d where d."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select greatest(r."DT_CRIACAO", r."DT_ATUALIZACAO", r."DT_CONFERENCIA")
                            from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(q."DT_CRIACAO", q."DT_DESATIVACAO"))
                            from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)),
               -- Só os metadados da vaga: o cargo e a linha do quadro vêm com os inscritos
               -- (pre_classificacao_ler_candidatos, uma vaga por chamada, desde 20261014110000).
               'vagas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'codigo', v."CO_VAGA",
                          'situacao_carga', v."TP_SITUACAO",
                          'candidatos_ativos', v."QT_CANDIDATO_ATIVO",
                          'ultima_carga', v."DT_ULTIMA_CARGA",
                          'ultimo_lote', coalesce(pv."NU_ULTIMO_LOTE", 0))
                        order by v."CO_VAGA")
                   from public."TB_EMPREGARE_VAGA" v
                   left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = m.id and pv."CO_VAGA" = v."CO_VAGA"
                  where v."CO_MONITORAMENTO" = m.id), '[]'::jsonb))
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       cross join lateral (select private."FC_FICHAS_INICIADAS"(m.id) as n) fi
       where m.id = any (v_ids)), '[]'::jsonb)
  );
end;
$$;
comment on function public.pre_classificacao_ler_editais(text[], boolean) is
  'Pré-classificação (job Python): os editais a processar — os pedidos (id, número ou nome), os da última carga fechada do robô (p_apos_robo) ou, sem filtro, os ativos com vagas da Empregare — com a regra vigente (versão, situação e configuração), o que a regra de classificação diz do nível da vaga e da nota mínima (FC_DOCUMENTAL_DO_EDITAL), o cronograma, se o lote ainda pode ser refeito (fichas_iniciadas, refazer_permitido) e as vagas (só metadados). Com p_apos_robo (desde 20261014220000), "sem_mudanca" = nada mudou (inscritos, decisões, regra, quadro) desde a última pré-classificação CONCLUÍDA de hoje que processou o edital: o job pula o edital. Sem dado pessoal. Só service_role.';

-- 4. Respostas das perguntas da vaga: com p_compacto, os nomes das colunas uma vez ----------
drop function if exists public.ler_respostas_pergunta_vaga(text);

create function public.ler_respostas_pergunta_vaga(p_vaga text, p_compacto boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with linhas as (
    select (select jsonb_object_agg(e.key, left(btrim(e.value), 200))
              from jsonb_each_text(c."DS_COLUNA_ORIGINAL") e
             where e.key ilike 'Pergunta %' and coalesce(btrim(e.value), '') <> '') as linha
      from public."TB_EMPREGARE_CANDIDATO" c
     where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S'
  ), nomes as (
    select coalesce(array_agg(distinct k.nome order by k.nome), '{}') as lista
      from linhas x cross join lateral jsonb_object_keys(x.linha) k(nome)
     where coalesce(p_compacto, false)
  )
  select case when coalesce(p_compacto, false) then
           jsonb_build_object(
             'vaga', p_vaga,
             'candidatos', (select count(*) from linhas),
             'colunas', to_jsonb(n.lista),
             -- [enxuto] Cada linha: os valores na ordem de "colunas" (null = sem resposta).
             'linhas', coalesce((
               select jsonb_agg((select jsonb_agg(x.linha -> u.nome order by u.i)
                                   from unnest(n.lista) with ordinality u(nome, i)))
                 from linhas x where x.linha is not null), '[]'::jsonb))
         else
           jsonb_build_object(
             'vaga', p_vaga,
             'candidatos', (select count(*) from linhas),
             'linhas', coalesce((select jsonb_agg(x.linha) from linhas x where x.linha is not null), '[]'::jsonb))
         end
    from nomes n;
$$;
comment on function public.ler_respostas_pergunta_vaga(text, boolean) is
  'Resumo das perguntas da carga (robô da Empregare): as respostas dos candidatos ativos da vaga, só as colunas "Pergunta …", sem espaços nas pontas e até 200 caracteres. Sem p_compacto: "linhas" = [{coluna: resposta}]. Com p_compacto (desde 20261014220000): "colunas" = os nomes uma vez e "linhas" = [[valor na ordem de colunas, null = sem resposta]]. Só service_role.';
revoke all on function public.ler_respostas_pergunta_vaga(text, boolean) from public, anon, authenticated;
grant execute on function public.ler_respostas_pergunta_vaga(text, boolean) to service_role;

commit;
