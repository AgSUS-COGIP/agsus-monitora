/*
  ROBÔ DA EMPREGARE: MODO "SÓ ANEXOS" E A RESPOSTA EDITADA DEPOIS DA CAPTURA

  Por quê: a captura dos anexos do questionário é incremental.
  listar_prioridade_anexos_empregare (20261015040000) marca como "lida" a
  resposta cujo QT_PERGUNTA cobre as colunas "Pergunta N" da exportação. Quando
  o candidato edita a MESMA resposta na Empregare (acrescenta ou troca um
  arquivo), o número da resposta não muda e o robô nunca relê. Caso: candidata
  2160872 da vaga 182514, resposta 8037239 capturada em 09/10 às 10:20, "DATA DE
  RESPOSTA" da exportação em 11/10, anexos das perguntas 16 e 18 faltando. E
  qualquer recaptura passava pela exportação (regrava situações, desativa quem
  saiu) e pela pré-classificação — com as inscrições encerradas, o lote não
  pode mudar.

  O QUE MUDA
    private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(colunas)
        a partir de quando uma captura vale para o candidato: o dia seguinte
        (00:00 de Brasília) à maior "DATA DE RESPOSTA - <questionário>" da
        exportação (TB_EMPREGARE_CANDIDATO.DS_COLUNA_ORIGINAL; ISO do Excel ou
        DD/MM/AAAA). Conta por dia, como a conferência manual: captura feita no
        dia da resposta ou antes é suspeita.
    private."FC_ARQUIVO_DO_LINK_EMPREGARE"(link)
        o parâmetro "arquivo=" do "Visualizar Arquivo" (o nome do arquivo na
        Empregare): é ele que diz se o arquivo mudou; o token do link não conta.
    listar_prioridade_anexos_empregare(p_vaga)      CORREÇÃO DE RAIZ
        só conta como lida a resposta capturada a partir do limite acima (e que
        cobre as colunas "Pergunta N", como antes). Sem "DATA DE RESPOSTA",
        como antes.
    gravar_anexos_empregare(p_sync, p_vaga, p_respostas)
        igual, mais: quando o arquivo de um anexo (mesma resposta, pergunta e
        número) muda — ou aparece um que não estava gravado —, a leitura
        automática dele (TB_LEITURA_ARQUIVO) é apagada, para o robô da leitura
        ler o arquivo novo (vira "nunca lido"); devolve "leituras_invalidadas".
    listar_anexos_empregare(p_vaga, p_codigos)      NOVA, só leitura, service_role
        o que está gravado, para o modo "anexos" comparar antes de gravar (e o
        ensaio seco): por candidato, as respostas (perguntas, captura) e os
        anexos [pergunta, número, hash do arquivo, hash do link] — sem link,
        sem nome de arquivo, sem token. Sem p_codigos, só os SUSPEITOS (captura
        antes do limite acima).
    private."FC_DISPARAR_ROBO" e disparar_robo
        o robô da Empregare aceita o modo "anexos" e as entradas "candidatos"
        (códigos da Empregare, só no modo anexos) e "seco" (só compara).

  O modo "anexos" (scripts/robo-empregare/so_anexos.py) NÃO chama exportar_vaga,
  gravar_lote_empregare nem fechar_vaga_empregare, e o workflow não
  pré-classifica depois dele: situação, lote e pré-classificação não mudam.

  Ensaio: supabase/ensaios/20261020130000_robo_modo_anexos.sql
  Rollback: supabase/rollback/20261020130000_robo_modo_anexos.sql
*/
begin;

set local lock_timeout = '10s';

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.listar_prioridade_anexos_empregare(text)') is null
     or to_regprocedure('public.gravar_anexos_empregare(text, text, jsonb)') is null
     or to_regclass('public."TB_LEITURA_ARQUIVO"') is null
     or to_regprocedure('public.disparar_robo(text, jsonb)') is null then
    raise exception 'Aplique antes 20261015040000, 20261009220000 e 20261014160000.';
  end if;
end;
$$;

-- 1. Apoio ------------------------------------------------------------------------------
create function private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(p_colunas jsonb)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_dia date;
begin
  select max(case
               when x.v ~ '^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$' then left(x.v, 10)::date
               when x.v ~ '^\d{2}/\d{2}/\d{4}( \d{2}:\d{2}(:\d{2})?)?$' then to_date(left(x.v, 10), 'DD/MM/YYYY')
             end)
    into v_dia
    from (select btrim(e.value #>> '{}') as v
            from jsonb_each(case when jsonb_typeof(p_colunas) = 'object' then p_colunas else '{}'::jsonb end) e
           where e.key ilike 'DATA DE RESPOSTA%' and jsonb_typeof(e.value) = 'string') x;
  return case when v_dia is not null then ((v_dia + 1)::timestamp at time zone 'America/Sao_Paulo') end;
exception when others then
  return null;
end;
$function$;
comment on function private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(jsonb) is
  'A partir de quando uma captura dos anexos do questionário vale para o candidato: 00:00 (Brasília) do dia seguinte à maior "DATA DE RESPOSTA - <questionário>" das colunas da exportação (DS_COLUNA_ORIGINAL; AAAA-MM-DD[THH:MI[:SS]] ou DD/MM/AAAA[ HH:MI[:SS]], a hora não conta). Nulo sem data ou com data inválida. A resposta editada na Empregare depois da captura (mesmo número) volta a ser lida.';
revoke all on function private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(jsonb) from public, anon, authenticated;

create function private."FC_ARQUIVO_DO_LINK_EMPREGARE"(p_link text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select substring(p_link from '[?&]arquivo=([^&]*)');
$function$;
comment on function private."FC_ARQUIVO_DO_LINK_EMPREGARE"(text) is
  'O parâmetro arquivo= do link Visualizar Arquivo da Empregare (o nome do arquivo guardado lá): diz se o arquivo de um anexo mudou, sem depender do token do link. Nulo se o link não tem o parâmetro.';
revoke all on function private."FC_ARQUIVO_DO_LINK_EMPREGARE"(text) from public, anon, authenticated;

-- 2. Correção de raiz: lida só a resposta capturada depois da "DATA DE RESPOSTA" ----------
create or replace function public.listar_prioridade_anexos_empregare(p_vaga text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  -- As colunas "SITUAÇÃO - <questionário>" da exportação são as mesmas em toda a vaga:
  -- lidas uma vez (jsonb_each_text em cada linha custa ~0,7 ms com ~80 colunas).
  with chaves as (
    select coalesce(array_agg(k.key), '{}'::text[]) as questionario
      from (select c."DS_COLUNA_ORIGINAL" as col
              from public."TB_EMPREGARE_CANDIDATO" c
             where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S'
             order by c."DT_ATUALIZACAO" desc
             limit 1) u,
           lateral jsonb_object_keys(coalesce(u.col, '{}'::jsonb)) k(key)
     where k.key ilike 'SITUAÇÃO - %'
  ),
  candidatos as (
    select c."CO_EMPREGARE_CANDIDATO" as id,
           btrim(c."CO_CANDIDATO_EMPREGARE") as codigo,
           (select count(*) from jsonb_object_keys(coalesce(c."DS_COLUNA_ORIGINAL", '{}'::jsonb)) pk(key)
             where pk.key ilike 'Pergunta%') as perguntas,
           private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(c."DS_COLUNA_ORIGINAL") as limite,
           upper(btrim(coalesce(c."DS_COLUNA_ORIGINAL" ->> 'SITUAÇÃO', ''))) as situacao,
           (select array_agg(upper(btrim(c."DS_COLUNA_ORIGINAL" ->> q.chave)))
              from unnest(h.questionario) q(chave)
             where c."DS_COLUNA_ORIGINAL" ? q.chave) as questionarios
      from public."TB_EMPREGARE_CANDIDATO" c
      cross join chaves h
     where p_vaga ~ '^[0-9]{1,20}$'
       and c."CO_VAGA" = p_vaga
       and c."ST_REGISTRO_ATIVO" = 'S'
       and c."CO_CANDIDATO_EMPREGARE" is not null
  ),
  pre as (
    select p."CO_EMPREGARE_CANDIDATO" as id,
           bool_or(p."TP_SITUACAO" = 'NO_LOTE') as no_lote,
           bool_or(p."TP_SITUACAO" = 'RANQUEADO') as ranqueado,
           bool_or(p."TP_SITUACAO" = 'ELIMINADO' and p."CO_MOTIVO_ELIMINACAO" in ('QUESTIONARIO', 'CANCELADO')) as sem_questionario
      from public."TB_PRE_CLASSIFICACAO" p
     where p."CO_EMPREGARE_CANDIDATO" in (select k.id from candidatos k)
     group by 1
  ),
  fichas as (
    select distinct f."CO_EMPREGARE_CANDIDATO" as id
      from public."TB_FICHA_ANALISE" f
     where f."CO_VAGA" = p_vaga and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE')
  ),
  -- Lida = capturada por inteiro (as perguntas lidas, somadas, cobrem as colunas "Pergunta N")
  -- E capturada depois da "DATA DE RESPOSTA" da exportação (a partir do dia seguinte): a
  -- resposta editada na Empregare depois da captura mantém o número e só assim é relida.
  lidas as (
    select r."CO_EMPREGARE_CANDIDATO" as id,
           jsonb_agg(r."CO_RESPOSTA_QUESTIONARIO" order by r."CO_RESPOSTA_QUESTIONARIO") as lidas
      from public."TB_EMPREGARE_RESPOSTA" r
      join candidatos k on k.id = r."CO_EMPREGARE_CANDIDATO"
     where r."QT_PERGUNTA" > 0
       and (k.limite is null or r."DT_CAPTURA" >= k.limite)
     group by r."CO_EMPREGARE_CANDIDATO", k.perguntas
    having sum(r."QT_PERGUNTA") >= k.perguntas
  ),
  classificados as (
    select k.codigo,
           case
             when coalesce(p.no_lote, false) or f.id is not null then 1
             when k.situacao = 'CANCELADO'
               or (k.questionarios is not null and not ('FINALIZADO' = any (k.questionarios)))
               or coalesce(p.sem_questionario, false)
               then 0
             when coalesce(p.ranqueado, false) then 2
             else 3
           end as prioridade,
           coalesce(l.lidas, '[]'::jsonb) as lidas
      from candidatos k
      left join pre p on p.id = k.id
      left join fichas f on f.id = k.id
      left join lidas l on l.id = k.id
  )
  select jsonb_build_object(
           'vaga', p_vaga,
           'candidatos', coalesce(jsonb_agg(jsonb_build_object('codigo', x.codigo, 'prioridade', x.prioridade,
                                                               'lidas', x.lidas)
                                            order by x.prioridade, x.codigo), '[]'::jsonb))
    from classificados x;
$function$;

comment on function public.listar_prioridade_anexos_empregare(text) is
  'Para o robô da Empregare com --anexos: os candidatos ativos da vaga com a prioridade de leitura do questionário (GetRespostaDetails) e as respostas já lidas por inteiro (QT_PERGUNTA somado >= colunas "Pergunta N" da exportação) E capturadas depois da "DATA DE RESPOSTA" da exportação (FC_LIMITE_DA_RESPOSTA_EMPREGARE: a partir do dia seguinte; a resposta editada depois da captura fica de fora e é relida). Prioridade 1: NO_LOTE na pré-classificação ou ficha PENDENTE/EM_ANALISE; 2: RANQUEADO; 3: os demais; 0: pular (questionário não finalizado na coluna "SITUAÇÃO - …", inscrição cancelada ou eliminado por QUESTIONARIO/CANCELADO). Só leitura; só service_role. {vaga, candidatos: [{codigo, prioridade, lidas: [resposta]}]}.';
revoke all on function public.listar_prioridade_anexos_empregare(text) from public, anon, authenticated;
grant execute on function public.listar_prioridade_anexos_empregare(text) to service_role;

-- 3. Gravação: arquivo trocado invalida a leitura automática dele -----------------------
create or replace function public.gravar_anexos_empregare(p_sync text, p_vaga text, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_r jsonb;
  v_cand uuid;
  v_resp uuid;
  v_impressao text;
  v_respostas integer := 0;
  v_anexos integer := 0;
  v_qt integer;
  v_sem_candidato integer := 0;
  v_antigos jsonb;
  v_apagadas integer;
  v_invalidadas integer := 0;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_respostas) is distinct from 'array' or jsonb_array_length(p_respostas) not between 1 and 500 then
    raise exception 'Envie de 1 a 500 respostas por lote' using errcode = '22023';
  end if;

  for v_r in select x from jsonb_array_elements(p_respostas) x loop
    continue when coalesce(v_r ->> 'resposta', '') !~ '^[0-9]{1,20}$';
    select c."CO_EMPREGARE_CANDIDATO" into v_cand
      from public."TB_EMPREGARE_CANDIDATO" c
     where c."CO_VAGA" = p_vaga and c."CO_CANDIDATO_EMPREGARE" = btrim(v_r ->> 'codigo');
    if v_cand is null then
      v_sem_candidato := v_sem_candidato + 1;
      continue;
    end if;
    -- Link fora do formato vira nulo (impressão) ou fica de fora (anexo).
    v_impressao := case when v_r ->> 'impressao' ~ '^https://corporate\.empregare\.com/Company/VacancyTests/PrintResult\?[A-Za-z0-9_.~=&%|+/:-]+$'
                        and length(v_r ->> 'impressao') <= 1500 then v_r ->> 'impressao' end;
    insert into public."TB_EMPREGARE_RESPOSTA" as x (
      "CO_EMPREGARE_CANDIDATO", "CO_RESPOSTA_QUESTIONARIO", "DS_LINK_IMPRESSAO", "QT_PERGUNTA", "CO_SYNC", "DT_CAPTURA")
    values (v_cand, v_r ->> 'resposta', v_impressao,
            least(greatest(coalesce((v_r ->> 'perguntas')::integer, 0), 0), 10000), p_sync, now())
    on conflict ("CO_EMPREGARE_CANDIDATO", "CO_RESPOSTA_QUESTIONARIO") do update set
      "DS_LINK_IMPRESSAO" = coalesce(excluded."DS_LINK_IMPRESSAO", x."DS_LINK_IMPRESSAO"),
      "QT_PERGUNTA" = excluded."QT_PERGUNTA",
      "CO_SYNC" = excluded."CO_SYNC",
      "DT_CAPTURA" = excluded."DT_CAPTURA"
    returning x."CO_EMPREGARE_RESPOSTA" into v_resp;
    v_respostas := v_respostas + 1;

    -- O arquivo de cada anexo antes da troca ("pergunta:número" → arquivo= do link).
    select coalesce(jsonb_object_agg(a."CO_PERGUNTA_EMPREGARE" || ':' || a."NU_ARQUIVO",
                                     coalesce(private."FC_ARQUIVO_DO_LINK_EMPREGARE"(a."DS_LINK"), a."DS_LINK")), '{}'::jsonb)
      into v_antigos
      from public."TB_EMPREGARE_ANEXO" a
     where a."CO_EMPREGARE_RESPOSTA" = v_resp;

    -- A resposta relida fica só com os anexos lidos agora.
    delete from public."TB_EMPREGARE_ANEXO" a where a."CO_EMPREGARE_RESPOSTA" = v_resp;
    insert into public."TB_EMPREGARE_ANEXO" (
      "CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO", "NU_ORDEM", "DS_ENUNCIADO", "DS_COLUNA", "DS_LINK",
      "DT_CAPTURA")
    select distinct on (an.pergunta, an.arquivo)
           v_resp, an.pergunta, an.arquivo::smallint,
           case when an.ordem between 1 and 999 then an.ordem::smallint end,
           nullif(left(btrim(regexp_replace(an.enunciado, '\s+', ' ', 'g')), 2000), ''),
           nullif(left(btrim(an.coluna), 1000), ''),
           an.link, now()
      from jsonb_to_recordset(coalesce(v_r -> 'anexos', '[]'::jsonb))
           as an(pergunta text, arquivo integer, ordem integer, enunciado text, coluna text, link text)
     where an.pergunta ~ '^[0-9]{1,20}$'
       and an.arquivo between 1 and 50
       and length(an.link) <= 1500
       and an.link ~ '^https://corporate\.empregare\.com/Company/VacancyTests/GetViewerLogArquivo\?[A-Za-z0-9_.~=&%|+/:-]+$'
     order by an.pergunta, an.arquivo;
    get diagnostics v_qt = row_count;
    update public."TB_EMPREGARE_RESPOSTA" set "QT_ANEXO" = v_qt where "CO_EMPREGARE_RESPOSTA" = v_resp;
    v_anexos := v_anexos + v_qt;

    -- Arquivo trocado (ou que não estava gravado) na mesma pergunta e número: a leitura
    -- automática era do arquivo antigo. Sai, e o robô da leitura lê o novo ("nunca lido").
    delete from public."TB_LEITURA_ARQUIVO" l
     using public."TB_EMPREGARE_ANEXO" a
     where l."CO_EMPREGARE_RESPOSTA" = v_resp
       and a."CO_EMPREGARE_RESPOSTA" = v_resp
       and a."CO_PERGUNTA_EMPREGARE" = l."CO_PERGUNTA_EMPREGARE"
       and a."NU_ARQUIVO" = l."NU_ARQUIVO"
       and (v_antigos ->> (a."CO_PERGUNTA_EMPREGARE" || ':' || a."NU_ARQUIVO"))
           is distinct from coalesce(private."FC_ARQUIVO_DO_LINK_EMPREGARE"(a."DS_LINK"), a."DS_LINK");
    get diagnostics v_apagadas = row_count;
    v_invalidadas := v_invalidadas + v_apagadas;
  end loop;

  return jsonb_build_object('recebidas', jsonb_array_length(p_respostas), 'respostas', v_respostas,
                            'anexos', v_anexos, 'sem_candidato', v_sem_candidato,
                            'leituras_invalidadas', v_invalidadas);
end;
$function$;
comment on function public.gravar_anexos_empregare(text, text, jsonb) is
  'Recebe (até 500 por lote) as respostas de questionário dos candidatos de uma vaga, lidas pelo robô da Empregare em GetRespostaDetails: [{codigo, resposta, impressao, perguntas, anexos: [{pergunta, arquivo, ordem, enunciado, coluna, link}]}]. Faz upsert em TB_EMPREGARE_RESPOSTA e troca os anexos da resposta em TB_EMPREGARE_ANEXO; quando o arquivo de um anexo (mesma resposta, pergunta e número, pelo arquivo= do link) muda ou aparece, apaga a leitura automática dele em TB_LEITURA_ARQUIVO (o robô da leitura lê o novo). Só candidatos da vaga; link fora do formato fica de fora. Só service_role, com a execução em andamento. {recebidas, respostas, anexos, sem_candidato, leituras_invalidadas}.';
revoke all on function public.gravar_anexos_empregare(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_anexos_empregare(text, text, jsonb) to service_role;

-- 4. Leitura do que está gravado (modo anexos e ensaio seco) ----------------------------
create function public.listar_anexos_empregare(p_vaga text, p_codigos text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_codigos text[] := array(select distinct btrim(x) from unnest(coalesce(p_codigos, '{}'::text[])) x where btrim(x) <> '');
begin
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if cardinality(v_codigos) > 1000 or exists (select 1 from unnest(v_codigos) x where x !~ '^[0-9]{1,20}$') then
    raise exception 'Até 1.000 códigos de candidato, só dígitos' using errcode = '22023';
  end if;

  return (
    with ativos as (
      select c."CO_EMPREGARE_CANDIDATO" as id, btrim(c."CO_CANDIDATO_EMPREGARE") as codigo,
             private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(c."DS_COLUNA_ORIGINAL") as limite,
             (select max(r."DT_CAPTURA") from public."TB_EMPREGARE_RESPOSTA" r
               where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO") as capturado_em
        from public."TB_EMPREGARE_CANDIDATO" c
       where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S' and c."CO_CANDIDATO_EMPREGARE" is not null
         and (cardinality(v_codigos) = 0 or btrim(c."CO_CANDIDATO_EMPREGARE") = any (v_codigos))
    ),
    marcados as (
      select a.*, (a.limite is not null and a.capturado_em is not null and a.capturado_em < a.limite) as suspeito
        from ativos a
    ),
    -- Com códigos, todos os pedidos; sem códigos, só os suspeitos (a lista fica pequena).
    escolhidos as (
      select m.* from marcados m where cardinality(v_codigos) > 0 or m.suspeito
    )
    select jsonb_build_object(
      'vaga', p_vaga,
      'conhecida', ev."CO_VAGA" is not null,
      'vaga_interno', ev."CO_VAGA_INTERNO",
      'colunas', coalesce(ev."DS_COLUNA", '[]'::jsonb),
      'ativos', (select count(*) from marcados),
      'suspeitos', (select count(*) from marcados where suspeito),
      'sem_captura', (select count(*) from marcados where capturado_em is null),
      'nao_encontrados', coalesce((select jsonb_agg(x order by x) from unnest(v_codigos) x
                                    where not exists (select 1 from ativos a where a.codigo = x)), '[]'::jsonb),
      'candidatos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'codigo', e.codigo,
                 'suspeito', e.suspeito,
                 'releitura_desde', e.limite,
                 'capturado_em', e.capturado_em,
                 'respostas', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'resposta', r."CO_RESPOSTA_QUESTIONARIO",
                            'perguntas', r."QT_PERGUNTA",
                            'capturado_em', r."DT_CAPTURA",
                            -- [pergunta, número, hash do arquivo=, hash do link]: nada que abra o arquivo.
                            'anexos', coalesce((
                              select jsonb_agg(jsonb_build_array(
                                       an."CO_PERGUNTA_EMPREGARE", an."NU_ARQUIVO",
                                       left(encode(sha256(convert_to(coalesce(private."FC_ARQUIVO_DO_LINK_EMPREGARE"(an."DS_LINK"), an."DS_LINK"), 'UTF8')), 'hex'), 16),
                                       left(encode(sha256(convert_to(an."DS_LINK", 'UTF8')), 'hex'), 16))
                                     order by an."CO_PERGUNTA_EMPREGARE", an."NU_ARQUIVO")
                                from public."TB_EMPREGARE_ANEXO" an
                               where an."CO_EMPREGARE_RESPOSTA" = r."CO_EMPREGARE_RESPOSTA"), '[]'::jsonb))
                          order by r."CO_RESPOSTA_QUESTIONARIO")
                     from public."TB_EMPREGARE_RESPOSTA" r
                    where r."CO_EMPREGARE_CANDIDATO" = e.id), '[]'::jsonb))
               order by e.codigo)
          from escolhidos e), '[]'::jsonb))
      from (select 1) u
      left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = p_vaga
  );
end;
$function$;
comment on function public.listar_anexos_empregare(text, text[]) is
  'Para o modo "anexos" do robô da Empregare (e o ensaio seco): o que está gravado dos anexos do questionário dos candidatos ativos da vaga — com p_codigos (até 1.000 códigos da Empregare), os pedidos; sem, só os suspeitos (captura antes de FC_LIMITE_DA_RESPOSTA_EMPREGARE: resposta editada depois da captura). Por candidato: suspeito, releitura_desde, capturado_em e as respostas [{resposta, perguntas, capturado_em, anexos: [[pergunta, número, hash16 do arquivo=, hash16 do link]]}] — sem link, nome de arquivo nem token. Mais: conhecida, vaga_interno, colunas da última exportação, ativos, suspeitos, sem_captura e nao_encontrados. Só leitura; só service_role.';
revoke all on function public.listar_anexos_empregare(text, text[]) from public, anon, authenticated;
grant execute on function public.listar_anexos_empregare(text, text[]) to service_role;

-- 5. Disparo: modo "anexos", "candidatos" e "seco" no robô da Empregare -----------------
create or replace function private."FC_DISPARAR_ROBO"(p_workflow text, p_inputs jsonb default '{}'::jsonb, p_usuario uuid default null)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por).
  c_aceitos constant jsonb := jsonb_build_object(
    'sincronizar-entrevistas.yml', jsonb_build_array('modo'),
    'sincronizar-selecao.yml', jsonb_build_array('modo'),
    'conferencias.yml', jsonb_build_array('modo'),
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco'),
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais'));
  v_inputs jsonb := coalesce(p_inputs, '{}'::jsonb);
  v_origem constant text := case when p_usuario is null then 'AGENDA' else 'MONITORA' end;
  -- disparado_por: AGENDA na agenda; o id de quem pediu no MONITORA.
  v_disparado_por constant text := coalesce(p_usuario::text, 'AGENDA');
  v_chave text;
  v_pedido bigint;
  v_disparo bigint;
begin
  if p_workflow is null or not (c_aceitos ? p_workflow) then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if jsonb_typeof(v_inputs) <> 'object'
     or exists (
       select 1 from jsonb_each(v_inputs) i
        where not ((c_aceitos -> p_workflow) ? i.key)
           or jsonb_typeof(i.value) <> 'string'
           or length(i.value #>> '{}') > 20000) then
    raise exception 'Inputs inválidos para %', p_workflow using errcode = '22023';
  end if;

  -- O nome do segredo é sempre github_disparo_robos; a configuração da sessão
  -- agsus.segredo_disparo_robos só existe para o ensaio simular a chave ausente
  -- (set local) sem tocar no Vault nem ler o valor.
  select nullif(btrim(s.decrypted_secret), '')
    into v_chave
    from vault.decrypted_secrets s
   where s.name = coalesce(nullif(current_setting('agsus.segredo_disparo_robos', true), ''), 'github_disparo_robos')
   order by s.updated_at desc nulls last
   limit 1;

  if v_chave is null then
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'SEM_TOKEN', 'Sem a chave github_disparo_robos no Vault.')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end if;

  begin
    v_pedido := net.http_post(
      url := 'https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/' || p_workflow || '/dispatches',
      body := jsonb_build_object(
        'ref', 'main',
        'inputs', v_inputs || jsonb_build_object('disparado_por', v_disparado_por)),
      headers := jsonb_build_object(
        'Accept', 'application/vnd.github+json',
        'Authorization', 'Bearer ' || v_chave,
        'X-GitHub-Api-Version', '2022-11-28',
        'User-Agent', 'agsus-monitora-agenda',
        'Content-Type', 'application/json'),
      timeout_milliseconds := 10000);
  exception when others then
    -- Só o código do erro: a mensagem poderia citar o pedido.
    v_chave := null;
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DT_RESPOSTA", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'FALHOU', now(), 'O pg_net recusou o pedido (' || sqlstate || ').')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end;
  v_chave := null;

  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values (p_workflow, v_origem, p_usuario, v_pedido, 'PEDIDO')
  returning "CO_DISPARO" into v_disparo;
  return v_disparo;
end;
$function$;
comment on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid) is
  'Único caminho até o GitHub (20261008140000): pede a execução (workflow_dispatch, ramo main) de um workflow da lista fixa, com os inputs que ele aceita (texto até 20000; o robô da Empregare aceita modo, editais, vagas, limite, anexos, candidatos e seco desde 20261020130000) e disparado_por = AGENDA (sem p_usuario, a agenda do pg_cron) ou o id de quem pediu (disparar_robo). Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora da lista ou input recusado. Só o dono (pg_cron e as RPCs SECURITY DEFINER).';
revoke all on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid) from public, anon, authenticated, service_role;

create or replace function public.disparar_robo(p_robo text, p_inputs jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  c_robos constant jsonb := jsonb_build_object(
    'empregare', jsonb_build_object('nome', 'Robô da Empregare', 'workflow', 'robo-empregare.yml',
      'modos', jsonb_build_array('normal', 'seco', 'fumaca', 'forcar', 'sondar', 'anexos'),
      'editais', 'numero', 'vagas', true, 'limite', true, 'anexos', true, 'candidatos', true, 'seco', true),
    'selecao', jsonb_build_object('nome', 'Seleção', 'workflow', 'sincronizar-selecao.yml',
      'modos', jsonb_build_array('normal')),
    'entrevistas', jsonb_build_object('nome', 'Entrevistas', 'workflow', 'sincronizar-entrevistas.yml',
      'modos', jsonb_build_array('normal')),
    'conferencias', jsonb_build_object('nome', 'Conferências de consistência', 'workflow', 'conferencias.yml',
      'modos', jsonb_build_array('normal', 'seco')),
    'pre_classificacao', jsonb_build_object('nome', 'Pré-classificação (Avaliação documental)', 'workflow', 'pre-classificacao.yml',
      'modos', jsonb_build_array('normal', 'seco', 'refazer_lote'),
      'editais', 'numero_ou_id', 'por_edital', true));
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_uid uuid := (select auth.uid());
  v_robo jsonb := c_robos -> p_robo;
  v_in jsonb := coalesce(p_inputs, '{}'::jsonb);
  v_chave text;
  v_valor jsonb;
  v_itens text[];
  v_item text;
  v_modo text;
  v_editais text[] := '{}';
  v_vagas text[] := '{}';
  v_candidatos text[] := '{}';
  v_limite integer;
  v_anexos boolean;
  v_seco boolean;
  v_saida jsonb;
begin
  if v_uid is null then
    raise exception 'Entre no MONITORA de novo para rodar a carga.' using errcode = '28000';
  end if;
  if v_robo is null then
    raise exception 'Carga desconhecida.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_in) <> 'object' then
    raise exception 'Opções inválidas.' using errcode = '22023';
  end if;

  -- Opção que o robô não aceita (vazia passa, como em validarOpcoes).
  for v_chave, v_valor in select * from jsonb_each(v_in) loop
    if v_chave not in ('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco')
       or (v_chave <> 'modo' and v_robo -> v_chave is null
           and not (jsonb_typeof(v_valor) = 'null'
                    or v_valor in ('""'::jsonb, '[]'::jsonb, 'false'::jsonb, '"false"'::jsonb))) then
      raise exception '% não aceita “%”.', v_robo ->> 'nome', left(v_chave, 30) using errcode = '22023';
    end if;
  end loop;

  -- Modo
  if jsonb_typeof(v_in -> 'modo') not in ('string', 'null') then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;
  v_modo := coalesce(nullif(btrim(v_in ->> 'modo'), ''), 'normal');
  if not ((v_robo -> 'modos') ? v_modo) then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;

  -- Editais: número (93/2026) ou, na pré-classificação, também o id.
  if v_robo ? 'editais' and coalesce(jsonb_typeof(v_in -> 'editais'), 'null') <> 'null' then
    v_valor := v_in -> 'editais';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Edital inválido.' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := string_to_array(v_valor #>> '{}', ',');
    else
      raise exception 'Edital inválido.' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if lower(v_item) ~ c_uuid and v_robo ->> 'editais' = 'numero_ou_id' then
        v_item := lower(v_item);
      elsif v_item !~ '^\d{1,4}/\d{4}$' then
        raise exception 'Edital inválido: %.', left(v_item, 40) using errcode = '22023';
      end if;
      if not v_item = any (v_editais) then
        v_editais := v_editais || v_item;
      end if;
    end loop;
    if cardinality(v_editais) > 100 then
      raise exception 'No máximo 100 editais por vez.' using errcode = '22023';
    end if;
  end if;

  -- Vagas: códigos da Empregare, só dígitos.
  if v_robo ? 'vagas' and coalesce(jsonb_typeof(v_in -> 'vagas'), 'null') <> 'null' then
    v_valor := v_in -> 'vagas';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de vaga inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_vagas) then
        v_vagas := v_vagas || v_item;
      end if;
    end loop;
    if cardinality(v_vagas) > 500 then
      raise exception 'No máximo 500 vagas por vez.' using errcode = '22023';
    end if;
  end if;

  -- Candidatos (modo anexos): códigos da Empregare, só dígitos.
  if v_robo ? 'candidatos' and coalesce(jsonb_typeof(v_in -> 'candidatos'), 'null') <> 'null' then
    v_valor := v_in -> 'candidatos';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de candidato inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_candidatos) then
        v_candidatos := v_candidatos || v_item;
      end if;
    end loop;
    if cardinality(v_candidatos) > 1000 then
      raise exception 'No máximo 1.000 candidatos por vez.' using errcode = '22023';
    end if;
  end if;

  -- Limite: 1 a 500 vagas.
  if v_robo ? 'limite' and coalesce(jsonb_typeof(v_in -> 'limite'), 'null') <> 'null'
     and btrim(v_in ->> 'limite') <> '' then
    if btrim(v_in ->> 'limite') !~ '^\d{1,3}$'
       or (btrim(v_in ->> 'limite'))::integer not between 1 and 500 then
      raise exception 'Limite de 1 a 500 vagas.' using errcode = '22023';
    end if;
    v_limite := (btrim(v_in ->> 'limite'))::integer;
  end if;

  -- Anexos (robô da Empregare): true/false ou "true"/"false"; só nos modos normal e forcar.
  if v_robo ? 'anexos' and coalesce(jsonb_typeof(v_in -> 'anexos'), 'null') <> 'null' then
    if v_in -> 'anexos' in ('true'::jsonb, '"true"'::jsonb) then
      v_anexos := true;
    elsif v_in -> 'anexos' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_anexos := false;
    else
      raise exception 'Opção “anexos” inválida (sim ou não).' using errcode = '22023';
    end if;
    if v_anexos and v_modo not in ('normal', 'forcar') then
      raise exception 'Guardar os links dos anexos só nos modos Normal e Forçar.' using errcode = '22023';
    end if;
  end if;

  -- Seco (modo anexos): true/false ou "true"/"false".
  if v_robo ? 'seco' and coalesce(jsonb_typeof(v_in -> 'seco'), 'null') <> 'null' then
    if v_in -> 'seco' in ('true'::jsonb, '"true"'::jsonb) then
      v_seco := true;
    elsif v_in -> 'seco' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_seco := false;
    else
      raise exception 'Opção “seco” inválida (sim ou não).' using errcode = '22023';
    end if;
  end if;

  -- Só anexos: relê os anexos do questionário sem exportar; pede vagas ou editais.
  if v_modo = 'anexos' then
    if cardinality(v_vagas) = 0 and cardinality(v_editais) = 0 then
      raise exception 'O modo Só anexos pede vagas ou editais.' using errcode = '22023';
    end if;
  elsif cardinality(v_candidatos) > 0 or coalesce(v_seco, false) then
    raise exception 'Candidatos e "só comparar" só no modo Só anexos.' using errcode = '22023';
  end if;

  -- Sondar (como o workflow exige): uma única vaga, sem editais, limite de 1 a 3 candidatos.
  if v_modo = 'sondar' then
    if cardinality(v_vagas) <> 1 or cardinality(v_editais) > 0 then
      raise exception 'O modo Sondar pede um único código de vaga (sem editais).' using errcode = '22023';
    end if;
    if v_limite is not null and v_limite > 3 then
      raise exception 'No modo Sondar, o limite é de 1 a 3 candidatos.' using errcode = '22023';
    end if;
  end if;

  -- Quem pode (o banco decide, como em api/rodar-carga.js).
  if not public.pode_disparar_carga() then
    if not coalesce((v_robo ->> 'por_edital')::boolean, false) then
      raise exception 'Só o administrador global roda as cargas.' using errcode = '42501';
    end if;
    if v_modo <> 'normal' or cardinality(v_vagas) > 0 or v_limite is not null
       or cardinality(v_editais) <> 1 or v_editais[1] !~ c_uuid then
      raise exception 'Só o administrador global roda as cargas com opções.' using errcode = '42501';
    end if;
    if not public.pode_recalcular_pre_classificacao(v_editais[1]::uuid) then
      raise exception 'Só a coordenação da avaliação do edital recalcula a pré-classificação.' using errcode = '42501';
    end if;
  end if;

  -- Duplo clique: o mesmo robô pedido há menos de 2 min (e ainda não recusado).
  if exists (
    select 1 from public."TL_DISPARO_ROBO" d
     where d."NO_WORKFLOW" = v_robo ->> 'workflow'
       and d."TP_SITUACAO" in ('PEDIDO', 'ACEITO')
       and d."DT_DISPARO" > now() - interval '2 minutes') then
    raise exception 'Esta carga acabou de ser pedida. Aguarde alguns minutos.' using errcode = '55006';
  end if;

  v_saida := jsonb_build_object('modo', v_modo);
  if coalesce((v_robo ->> 'por_edital')::boolean, false) or cardinality(v_editais) > 0 then
    v_saida := v_saida || jsonb_build_object('editais', array_to_string(v_editais, ','));
  end if;
  if cardinality(v_vagas) > 0 then
    v_saida := v_saida || jsonb_build_object('vagas', array_to_string(v_vagas, ','));
  end if;
  if v_limite is not null then
    v_saida := v_saida || jsonb_build_object('limite', v_limite::text);
  end if;
  if v_anexos is not null then
    v_saida := v_saida || jsonb_build_object('anexos', case when v_anexos then 'true' else 'false' end);
  end if;
  if cardinality(v_candidatos) > 0 then
    v_saida := v_saida || jsonb_build_object('candidatos', array_to_string(v_candidatos, ','));
  end if;
  if v_modo = 'anexos' then
    v_saida := v_saida || jsonb_build_object('seco', case when coalesce(v_seco, false) then 'true' else 'false' end);
  end if;

  return private."FC_DISPARAR_ROBO"(v_robo ->> 'workflow', v_saida, v_uid);
end;
$function$;
comment on function public.disparar_robo(text, jsonb) is
  'Rodar agora, Opções (Status das atualizações) e Recalcular (pré-classificação) pelo banco (20261008140000; substitui api/rodar-carga.js): confere quem pede (administrador global: qualquer robô e opções; coordenação: só a pré-classificação de um edital pelo id, modo normal), a lista branca do robô (modo, editais, vagas, limite, anexos; no robô da Empregare, desde 20261020130000, o modo "anexos" — só relê os anexos do questionário, sem exportar nem pré-classificar; pede vagas ou editais — com "candidatos" e "seco", que só valem nele) e o pedido repetido em 2 min (55006), e pede o workflow por FC_DISPARAR_ROBO com disparado_por = id de quem pediu. Devolve o CO_DISPARO de TL_DISPARO_ROBO (acompanhe por situacao_do_disparo_robo). 28000 sem sessão, 42501 sem permissão, 22023 para opção inválida.';
revoke all on function public.disparar_robo(text, jsonb) from public, anon;
grant execute on function public.disparar_robo(text, jsonb) to authenticated;

commit;
