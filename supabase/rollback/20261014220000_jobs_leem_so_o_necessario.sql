-- ROLLBACK de supabase/migrations/20261014220000_jobs_leem_so_o_necessario.sql
-- Volta as leituras dos jobs ao formato de antes (corpos de 20261014110000 e
-- 20261009180000, copiados do banco em 14/10): pre_classificacao_ler_candidatos sem
-- p_colunas, pre_classificacao_ler_editais sem "sem_mudanca", ler_respostas_pergunta_vaga
-- sem p_compacto; tira pre_classificacao_ler_colunas. O job novo continua funcionando
-- (sem pre_classificacao_ler_colunas ele lê tudo; sem p_compacto, lê como antes), mas
-- volta o egress de antes. Nada de dado é tocado.
begin;

set local lock_timeout = '10s';

drop function if exists public.pre_classificacao_ler_colunas(uuid);
drop function if exists public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer, text[]);
drop function if exists public.ler_respostas_pergunta_vaga(text, boolean);

CREATE OR REPLACE FUNCTION public.ler_respostas_pergunta_vaga(p_vaga text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
           'vaga', p_vaga,
           'candidatos', count(*),
           'linhas', coalesce(jsonb_agg(x.linha) filter (where x.linha is not null), '[]'::jsonb))
    from (select (select jsonb_object_agg(e.key, left(btrim(e.value), 200))
                    from jsonb_each_text(c."DS_COLUNA_ORIGINAL") e
                   where e.key ilike 'Pergunta %' and coalesce(btrim(e.value), '') <> '') as linha
            from public."TB_EMPREGARE_CANDIDATO" c
           where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S') x;
$function$
;

CREATE OR REPLACE FUNCTION public.pre_classificacao_ler_candidatos(p_edital uuid, p_vaga text, p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.pre_classificacao_ler_editais(p_editais text[] DEFAULT NULL::text[], p_apos_robo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

comment on function public.ler_respostas_pergunta_vaga(text) is
  'Robô da Empregare (resumo_das_perguntas.py): as respostas cruas das colunas de pergunta dos candidatos ativos da vaga (sem espaços nas pontas, até 200 caracteres; vazias fora), uma linha por candidato com resposta, e quantos candidatos ativos. Nenhuma conta: o resumo é feito em Python. Só service_role.';
revoke all on function public.ler_respostas_pergunta_vaga(text) from public, anon, authenticated;
grant execute on function public.ler_respostas_pergunta_vaga(text) to service_role;
revoke all on function public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer) to service_role;
comment on function public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer) is
  'Pré-classificação (job Python): os inscritos de uma vaga do edital em partes, na ordem do id (p_apos = último id da parte anterior; p_limite de 1 a 5.000, nulo = todos; "mais" = há outra parte), sem as colunas do cadastro. Na primeira parte vêm também a vaga, a situação anterior e as decisões. Só service_role.';

commit;
