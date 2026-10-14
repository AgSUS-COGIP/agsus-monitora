-- Desfaz 20261014120000: FC_EMPREGARE_ABRIR_VAGA volta a procurar o edital em toda chamada,
-- FC_EMPREGARE_VAGAS_DO_QUADRO volta ao filtro único (varre as análises) e o índice sai.
begin;
CREATE OR REPLACE FUNCTION private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga text DEFAULT NULL::text)
 RETURNS TABLE(vaga text, edital_id uuid, quadro_id uuid, cargo text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with analises as (
    select btrim(a.codigo_vaga) as vaga, a."CO_AREA" as area,
           private."FC_NUMERO_EDITAL"(a.edital) as numero, min(a.nome_vaga) as nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo
       and btrim(a.codigo_vaga) ~ '^[0-9]{1,20}$'
       and (p_vaga is null or btrim(a.codigo_vaga) = p_vaga)
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
$function$
;

CREATE OR REPLACE FUNCTION private."FC_EMPREGARE_ABRIR_VAGA"(p_sync text, p_vaga text, p_total integer)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_vaga public."TB_EMPREGARE_VAGA";
  v_forcada boolean;
  v_ativos integer;
  v_edital uuid;
begin
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
$function$
;

comment on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) is
  'Abre a vaga numa execução do robô da Empregare: cria a linha, liga o edital (primeiro pelo quadro de vagas do edital, FC_EMPREGARE_VAGAS_DO_QUADRO; depois por TB_SELECAO_VAGA) e aplica a trava (arquivo com menos da metade dos ativos, sem forçar, é RECUSADA). Chamada pelas RPCs de carga.';

drop index if exists public."IN_ANALISECURR_VAGATRIM";
commit;
