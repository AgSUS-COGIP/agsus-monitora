/*
  ROBÔ DA EMPREGARE: A RESPOSTA CAPTURADA PELA METADE VOLTA A SER PENDENTE

  Por quê: no 114/2026, 81 dos 1.342 candidatos NO_LOTE (20 vagas) tinham a
  resposta do questionário capturada pela metade (QT_PERGUNTA menor que o
  número de colunas "Pergunta N" da exportação; ex.: 17 de 25, faltando 4
  anexos). Todas de 09/10, e em todas a "DATA DE RESPOSTA" é do próprio dia da
  captura ou posterior: o candidato ainda respondia o questionário quando o robô
  leu GetRespostaDetails, que só traz o que já foi respondido. As capturas
  posteriores vêm completas. Como listar_prioridade_anexos_empregare marcava
  como "lida" qualquer resposta com QT_PERGUNTA > 0, o robô nunca relia.

  Agora uma resposta só conta como lida quando as perguntas lidas do candidato
  (somadas, se houver mais de uma resposta) cobrem as colunas "Pergunta N" da
  exportação. A incompleta sai de "lidas" e é relida, na ordem de prioridade de
  sempre (o lote primeiro). A recaptura já substitui os anexos da resposta:
  gravar_anexos_empregare faz upsert da resposta e apaga e regrava os anexos
  dela (sem duplicar). A ficha lê TB_EMPREGARE_ANEXO na hora.

  O QUE MUDA
    listar_prioridade_anexos_empregare(p_vaga)   só service_role; só leitura

  Ensaio: supabase/ensaios/20261015040000_anexos_recapturam_resposta_incompleta.sql
  Rollback: supabase/rollback/20261015040000_anexos_recapturam_resposta_incompleta.sql
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
           (select count(*) from jsonb_object_keys(coalesce(c."DS_COLUNA_ORIGINAL", '{}'::jsonb)) pk(key)
             where pk.key ilike 'Pergunta%') as perguntas,
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
  -- Lida = capturada por inteiro: as perguntas lidas (somadas, se o candidato tem mais de
  -- uma resposta) cobrem as colunas "Pergunta N" da exportação. A captura feita enquanto o
  -- candidato ainda respondia (GetRespostaDetails só traz o que já foi respondido) fica
  -- pendente e é relida; gravar_anexos_empregare troca os anexos da resposta relida.
  lidas as (
    select r."CO_EMPREGARE_CANDIDATO" as id,
           jsonb_agg(r."CO_RESPOSTA_QUESTIONARIO" order by r."CO_RESPOSTA_QUESTIONARIO") as lidas
      from public."TB_EMPREGARE_RESPOSTA" r
      join candidatos k on k.id = r."CO_EMPREGARE_CANDIDATO"
     where r."QT_PERGUNTA" > 0
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
  'Para o robô da Empregare com --anexos: os candidatos ativos da vaga com a prioridade de leitura do questionário (GetRespostaDetails) e as respostas já lidas por inteiro (QT_PERGUNTA somado >= colunas "Pergunta N" da exportação; a captura incompleta fica de fora e é relida). Prioridade 1: NO_LOTE na pré-classificação ou ficha PENDENTE/EM_ANALISE; 2: RANQUEADO; 3: os demais; 0: pular (questionário não finalizado na coluna "SITUAÇÃO - …", inscrição cancelada ou eliminado por QUESTIONARIO/CANCELADO). Só leitura; só service_role. {vaga, candidatos: [{codigo, prioridade, lidas: [resposta]}]}.';
revoke all on function public.listar_prioridade_anexos_empregare(text) from public, anon, authenticated;
grant execute on function public.listar_prioridade_anexos_empregare(text) to service_role;

commit;
