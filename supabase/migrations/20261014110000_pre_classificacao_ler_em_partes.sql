/*
  PRÉ-CLASSIFICAÇÃO: O JOB LÊ EM PARTES

  Por quê: em 14/10 o job da pré-classificação (editais=114/2026,
  modo=refazer_lote) falhou na primeira leitura: "pre_classificacao_ler_editais
  respondeu 500: 57014: canceling statement due to statement timeout" (8 s do
  service_role). O 114 tem 7.160 inscritos ativos em 30 vagas. Medido em
  ensaio (EXPLAIN ANALYZE):
    - pre_classificacao_ler_editais levava 6,2 s, quase tudo na linha do
      quadro de cada vaga (private."FC_QUADRO_DA_VAGA_EMPREGARE": o caminho da
      planilha e, desde 20261013140000, o título da Empregare com a UF dos
      inscritos das vagas irmãs, que lê o DS_COLUNA_ORIGINAL de todos eles),
      de 150 a 250 ms por vaga, as 30 numa chamada só;
    - pre_classificacao_ler_candidatos levava 2,2 s na vaga 182493 (1.521
      inscritos, ~5 KB de DS_COLUNA_ORIGINAL cada), perto do limite.
  Num edital 3× maior, as duas estourariam.

  O QUE MUDA (o resultado do cálculo é o mesmo)
    pre_classificacao_ler_editais   leve: só os metadados do edital e das
                                    vagas (carga, inscritos, último lote);
                                    sai o cargo e a linha do quadro das vagas.
    pre_classificacao_ler_candidatos(p_edital, p_vaga, p_apos, p_limite)
                                    lê a vaga em partes, na ordem do id do
                                    inscrito (p_apos = o último id da parte
                                    anterior; p_limite = até 5.000 por parte;
                                    sem p_limite, todos, como antes) e diz se
                                    há mais ("mais"). Na primeira parte (sem
                                    p_apos) vêm também a vaga ({cargo, quadro},
                                    a mesma linha do quadro de antes, agora uma
                                    vaga por chamada), a situação anterior e as
                                    decisões, como antes.
  O job (scripts/pre_classificacao/pre_classificacao.py) lê cada vaga em
  partes de 500 e junta a vaga lida (cargo e quadro) à da lista do edital.
  Nada é gravado aqui; as gravações não mudam.

  Ensaio: supabase/ensaios/20261014110000_pre_classificacao_ler_em_partes.sql
  Rollback: supabase/rollback/20261014110000_pre_classificacao_ler_em_partes.sql
*/
begin;

set local lock_timeout = '10s';

-- 1. Os editais: só metadados (o quadro de cada vaga sai daqui) ---------------------------
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
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
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
  'Pré-classificação (job Python): os editais a processar — os pedidos (id, número ou nome), os da última carga fechada do robô (p_apos_robo) ou, sem filtro, os ativos com vagas da Empregare — com a regra vigente (versão, situação e configuração), o que a regra de classificação diz do nível da vaga e da nota mínima (FC_DOCUMENTAL_DO_EDITAL, desde 20261007140000), o cronograma (atividade, início e fim de cada etapa, para o job achar o fim das inscrições e congelar a nota declarada, desde 20261007170000), se o lote ainda pode ser refeito (ninguém analisado e, desde 20261013110000, todas as fichas intocadas; fichas_iniciadas = quantas não estão) e as vagas (só metadados: carga, inscritos ativos, último lote; o cargo e a linha do quadro vêm de pre_classificacao_ler_candidatos desde 20261014110000). Sem dado pessoal. Só service_role.';

-- 2. Os inscritos de uma vaga, em partes, com a vaga (cargo e quadro) na primeira ---------
drop function if exists public.pre_classificacao_ler_candidatos(uuid, text);

create function public.pre_classificacao_ler_candidatos(
  p_edital uuid, p_vaga text, p_apos uuid default null, p_limite integer default null)
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

  -- Uma parte na ordem do id (o mesmo order by de antes), com um a mais para saber se há outra.
  select coalesce(jsonb_agg(jsonb_build_object(
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
comment on function public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer) is
  'Pré-classificação (job Python): os inscritos de uma vaga do edital em partes, na ordem do id (p_apos = último id da parte anterior; p_limite de 1 a 5.000, nulo = todos; "mais" = há outra parte) — id, código, ativo, nascimento, data da candidatura e as colunas do questionário e do processo SEM as do cadastro (nome, e-mail, CPF, telefone, endereço). Na primeira parte (sem p_apos) vêm também a vaga ({cargo, quadro}: a linha do quadro de FC_QUADRO_DA_VAGA_EMPREGARE com vagas imediatas, cadastro reserva e modalidades), a situação anterior de cada inscrito (situação, posição, lote, lista, entrada e a nota declarada congelada, que o job usa sem recalcular) e as decisões vigentes da coordenação ({id: {motivo}}). Em partes desde 20261014110000. Só service_role.';
revoke all on function public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer) to service_role;

commit;
