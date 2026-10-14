/*
  ABRIR A VAGA DA EMPREGARE SEM VARRER AS ANÁLISES

  Por quê: medindo a falha da vaga 182528 (57014 em gravar_lote_empregare,
  14/10), o outro custo variável estava em FC_EMPREGARE_ABRIR_VAGA, chamada
  por TODO lote e pelo fechamento: antes de ver se a vaga já está aberta
  nesta execução, ela procura o edital em FC_EMPREGARE_VAGAS_DO_QUADRO, que
  varre TB_ANALISE_CURRICULAR inteira (~4,5 mil páginas, 35 MB) porque
  "(p_vaga is null or btrim(codigo_vaga) = p_vaga)" não usa índice. Com o
  cache quente leva ~50 ms; frio, no ensaio, levou 1,8 s numa chamada só.

  Agora:
  - FC_EMPREGARE_ABRIR_VAGA: se a vaga já está aberta nesta execução (mesmo
    CO_SYNC), devolve a situação na hora, com o mesmo "for update" — a busca
    do edital fica só para a primeira chamada da vaga. Mesma semântica;
  - IN_ANALISECURR_VAGATRIM: índice em btrim(codigo_vaga) das análises ativas;
  - FC_EMPREGARE_VAGAS_DO_QUADRO: o filtro por código vira dois ramos (lista
    inteira quando p_vaga é nulo; um código pelo índice quando não é). Mesmo
    resultado, mesma assinatura.

  Rollback: supabase/rollback/20261014120000_abrir_vaga_empregare_sem_varredura.sql
*/
begin;

create index if not exists "IN_ANALISECURR_VAGATRIM"
  on public."TB_ANALISE_CURRICULAR" (btrim(codigo_vaga))
  where ativo;

comment on index public."IN_ANALISECURR_VAGATRIM" is
  'Análises ativas pelo código da vaga sem espaços (FC_EMPREGARE_VAGAS_DO_QUADRO com p_vaga).';

create or replace function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga text default null)
returns table(vaga text, edital_id uuid, quadro_id uuid, cargo text)
language sql
stable
set search_path = ''
as $$
  with analises as (
    select btrim(a.codigo_vaga) as vaga, a."CO_AREA" as area,
           private."FC_NUMERO_EDITAL"(a.edital) as numero, min(a.nome_vaga) as nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
     where p_vaga is null
       and a.ativo
       and btrim(a.codigo_vaga) ~ '^[0-9]{1,20}$'
     group by 1, 2, 3
    union all
    -- Um código: IN_ANALISECURR_VAGATRIM em vez de varrer a tabela.
    select btrim(a.codigo_vaga) as vaga, a."CO_AREA" as area,
           private."FC_NUMERO_EDITAL"(a.edital) as numero, min(a.nome_vaga) as nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
     where p_vaga is not null
       and a.ativo
       and btrim(a.codigo_vaga) = p_vaga
       and btrim(a.codigo_vaga) ~ '^[0-9]{1,20}$'
     group by 1, 2, 3
  ),
  ligadas as (
    select n.vaga, m.id as edital_id, m.ativo, n.nome_vaga,
           private."FC_QUADRO_DA_VAGA"(m.id, n.nome_vaga) as quadro_id
      from analises n
      join public."TB_MONITORAMENTO_INDIGENA" m
        on m."CO_AREA" = n.area and private."FC_NUMERO_EDITAL"(m.edital) = n.numero
     where exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q
                    where q."CO_MONITORAMENTO" = m.id and q."ST_REGISTRO_ATIVO" = 'S')
  )
  select distinct on (l.vaga)
         l.vaga, l.edital_id, l.quadro_id,
         coalesce(nullif(concat_ws(' — ', q."NO_CARGO", q."NO_LOTACAO"), ''), l.nome_vaga) as cargo
    from ligadas l
    left join public."TB_QUADRO_VAGA_EDITAL" q on q."CO_QUADRO_VAGA" = l.quadro_id
   order by l.vaga, l.ativo desc nulls last, (l.quadro_id is null), l.edital_id;
$$;

create or replace function private."FC_EMPREGARE_ABRIR_VAGA"(p_sync text, p_vaga text, p_total integer)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_vaga public."TB_EMPREGARE_VAGA";
  v_forcada boolean;
  v_ativos integer;
  v_edital uuid;
begin
  -- Vaga já aberta nesta execução (2º lote em diante e o fechamento): nada a procurar.
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v
   where v."CO_VAGA" = p_vaga and v."CO_SYNC" = p_sync
     for update;
  if found then
    return v_vaga."TP_SITUACAO";
  end if;

  select (s."ST_FORCADA" = 'S') into v_forcada from public."TL_SYNC_EMPREGARE" s where s."CO_SYNC" = p_sync;
  select q.edital_id into v_edital from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) q limit 1;
  if v_edital is null then
    select s."CO_MONITORAMENTO" into v_edital
      from public."TB_SELECAO_VAGA" s
     where s."CO_VAGA" = p_vaga and s."ST_REGISTRO_ATIVO" = 'S'
     order by (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
     limit 1;
  end if;

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO")
  values (p_vaga, v_edital)
  on conflict ("CO_VAGA") do nothing;
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga for update;

  if v_vaga."CO_SYNC" is not distinct from p_sync then
    return v_vaga."TP_SITUACAO";
  end if;

  select count(*) into v_ativos
    from public."TB_EMPREGARE_CANDIDATO" c
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S';

  if not v_forcada and v_ativos > 0 and p_total * 2 < v_ativos then
    update public."TB_EMPREGARE_VAGA" set
      "TP_SITUACAO" = 'RECUSADA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
      "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"),
      "DS_MENSAGEM" = format('Arquivo com %s candidatos e a vaga tem %s ativos: menos da metade. Nada foi gravado nem desativado.', p_total, v_ativos),
      "DT_ATUALIZACAO" = now()
     where "CO_VAGA" = p_vaga;
    update public."TL_SYNC_EMPREGARE" set "QT_VAGA_RECUSADA" = "QT_VAGA_RECUSADA" + 1 where "CO_SYNC" = p_sync;
    return 'RECUSADA';
  end if;

  update public."TB_EMPREGARE_VAGA" set
    "TP_SITUACAO" = 'EM_CARGA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
    "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"), "DS_MENSAGEM" = null, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  return 'EM_CARGA';
end;
$$;

comment on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) is
  'Abre a vaga numa execução do robô da Empregare: cria a linha, liga o edital (primeiro pelo quadro de vagas do edital, FC_EMPREGARE_VAGAS_DO_QUADRO; depois por TB_SELECAO_VAGA) e aplica a trava (arquivo com menos da metade dos ativos, sem forçar, é RECUSADA). Vaga já aberta nesta execução devolve a situação sem procurar o edital de novo. Chamada pelas RPCs de carga.';

revoke all on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) from public, anon, authenticated;
revoke all on function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text) from public, anon, authenticated;

commit;
