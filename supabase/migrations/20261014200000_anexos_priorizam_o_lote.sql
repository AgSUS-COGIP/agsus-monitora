/*
  ROBÔ DA EMPREGARE: OS ANEXOS DO QUESTIONÁRIO PRIORIZAM O LOTE

  Por quê: no 114/2026, dos 1.242 candidatos NO_LOTE só 852 tinham a resposta
  do questionário lida (TB_EMPREGARE_RESPOSTA com QT_PERGUNTA > 0). Com
  --anexos, o robô lia GetRespostaDetails de TODOS os inscritos de cada vaga
  (7.196, ~5.400 eliminados por não finalizarem o questionário), na ordem da
  lista, e o orçamento acabava antes de chegar ao lote.

  Agora o robô (scripts/robo-empregare/anexos_empregare.py) pergunta antes, por
  vaga, quem vale a pena ler e em que ordem:
    prioridade 1  NO_LOTE na pré-classificação ou com ficha PENDENTE/EM_ANALISE
    prioridade 2  RANQUEADO (finalizou o questionário, fora do lote)
    prioridade 3  os demais ativos (edital sem pré-classificação, por exemplo)
    prioridade 0  pular: não finalizou o questionário (coluna "SITUAÇÃO - …"
                  da exportação diferente de FINALIZADO), cancelou (coluna
                  "SITUAÇÃO" = CANCELADO) ou foi eliminado na pré-classificação
                  por QUESTIONARIO/CANCELADO: não há o que ler
  e as respostas já lidas (QT_PERGUNTA > 0) de cada candidato: o robô não relê
  a mesma resposta (a resposta nova, de outro número, é lida).

  O QUE ENTRA
    listar_prioridade_anexos_empregare(p_vaga)   só service_role; só leitura

  Ensaio: supabase/ensaios/20261014200000_anexos_priorizam_o_lote.sql
  Rollback: supabase/rollback/20261014200000_anexos_priorizam_o_lote.sql
*/
begin;

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
  lidas as (
    select r."CO_EMPREGARE_CANDIDATO" as id,
           jsonb_agg(r."CO_RESPOSTA_QUESTIONARIO" order by r."CO_RESPOSTA_QUESTIONARIO") as lidas
      from public."TB_EMPREGARE_RESPOSTA" r
     where r."CO_EMPREGARE_CANDIDATO" in (select k.id from candidatos k) and r."QT_PERGUNTA" > 0
     group by 1
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
  'Para o robô da Empregare com --anexos: os candidatos ativos da vaga com a prioridade de leitura do questionário (GetRespostaDetails) e as respostas já lidas (QT_PERGUNTA > 0). Prioridade 1: NO_LOTE na pré-classificação ou ficha PENDENTE/EM_ANALISE; 2: RANQUEADO; 3: os demais; 0: pular (questionário não finalizado na coluna "SITUAÇÃO - …", inscrição cancelada ou eliminado por QUESTIONARIO/CANCELADO). Só leitura; só service_role. {vaga, candidatos: [{codigo, prioridade, lidas: [resposta]}]}.';
revoke all on function public.listar_prioridade_anexos_empregare(text) from public, anon, authenticated;
grant execute on function public.listar_prioridade_anexos_empregare(text) to service_role;

commit;
