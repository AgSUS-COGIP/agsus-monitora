/*
  ROBÔ DA EMPREGARE: VAGAS TAMBÉM DO QUADRO DE VAGAS DO EDITAL

  Até aqui o robô escolhia as vagas só pela Seleção (TB_SELECAO_VAGA, que vem
  da planilha Auditoria). Edital que não está na Auditoria — o 93/2026
  (SESMT, Projetos, piloto da Avaliação documental) tem as 5 vagas no quadro
  do edital e 0 na Seleção — ficava sem candidatos.

  DE ONDE VÊM AS VAGAS AGORA (listar_vagas_empregare)
    1. Quadro do edital (fonte principal): edital com quadro de vagas vigente
       (TB_QUADRO_VAGA_EDITAL ativo). O quadro não guarda o código da vaga da
       Empregare; o código vem do vínculo que o MONITORA já faz na tela do
       quadro e na Classificação: as análises ativas do edital
       (TB_ANALISE_CURRICULAR.codigo_vaga, mesma área e mesmo número de
       edital), cada vaga ligada à linha do quadro por
       private."FC_QUADRO_DA_VAGA" quando a ligação é única. Edital e área são
       os do edital do quadro.
    2. Seleção (segunda fonte, editais antigos): como antes.
    Mesmo código nas duas fontes = uma linha só, com o vínculo do quadro.
    Cada vaga devolvida ganha 'origem': 'quadro', 'selecao' ou 'pedida'
    (código pedido em p_vagas que não está em nenhuma das duas). O resto do
    contrato não muda: filtros p_editais/p_vagas/p_limite, critério "edital
    ativo e em curso" (sem cronograma, ou etapa terminando há no máximo 30
    dias) e a ordem (nunca carregadas e mais antigas primeiro).

  GRAVAÇÃO
    gravar_lote_empregare e fechar_vaga_empregare já aceitavam qualquer código
    (a vaga nasce em TB_EMPREGARE_VAGA no primeiro lote). Muda só a ligação ao
    edital em private."FC_EMPREGARE_ABRIR_VAGA": primeiro pelo quadro, depois
    pela Seleção.

  Ensaio: supabase/ensaios/20261006080000_robo_empregare_vagas_do_quadro.sql
  Rollback: supabase/rollback/20261006080000_robo_empregare_vagas_do_quadro.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.listar_vagas_empregare(text[], text[], integer)') is null then
    raise exception 'Aplique antes 20261005170000_robo_empregare.sql.';
  end if;
  if to_regprocedure('private."FC_QUADRO_DA_VAGA"(uuid, text)') is null then
    raise exception 'Aplique antes 20260930233000_quadro_de_vagas_do_edital.sql.';
  end if;
end;
$$;

-- 1. Vagas do quadro do edital ----------------------------------------------------------
create function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga text default null)
returns table (vaga text, edital_id uuid, quadro_id uuid, cargo text)
language sql
stable
set search_path to ''
as $function$
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
$function$;
comment on function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text) is 'Vagas da Empregare dos editais com quadro de vagas vigente (TB_QUADRO_VAGA_EDITAL): o código vem das análises ativas do edital (mesma área e número), a linha do quadro por FC_QUADRO_DA_VAGA quando a ligação é única. Uma linha por código (prefere edital ativo e vaga ligada ao quadro). p_vaga restringe a um código. Usada pelo robô da Empregare.';
revoke all on function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text) from public, anon, authenticated;

-- 2. Ligação da vaga ao edital na gravação: quadro primeiro, depois a Seleção -----------
create or replace function private."FC_EMPREGARE_ABRIR_VAGA"(p_sync text, p_vaga text, p_total integer)
returns text
language plpgsql
set search_path to ''
as $function$
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
$function$;
comment on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) is 'Abre a vaga numa execução do robô da Empregare: cria a linha, liga o edital (primeiro pelo quadro de vagas do edital, FC_EMPREGARE_VAGAS_DO_QUADRO; depois por TB_SELECAO_VAGA) e aplica a trava (arquivo com menos da metade dos ativos, sem forçar, é RECUSADA). Chamada pelas RPCs de carga.';
revoke all on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) from public, anon, authenticated;

comment on column public."TB_EMPREGARE_VAGA"."CO_VAGA" is 'Código da vaga na Empregare (ex.: 177979): do quadro do edital (pelas análises do edital) ou o CO_VAGA de TB_SELECAO_VAGA.';
comment on column public."TB_EMPREGARE_VAGA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id): pelo quadro de vagas do edital, senão pela vaga ativa de TB_SELECAO_VAGA; nulo sem ligação.';

-- 3. Lista do robô: quadro do edital + Seleção, sem duplicar ------------------------------
create or replace function public.listar_vagas_empregare(p_editais text[] default null, p_vagas text[] default null, p_limite integer default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 60), 1), 500);
  v_vagas text[] := coalesce(p_vagas, '{}');
  v_editais text[];
  v_modo text;
begin
  if exists (select 1 from unnest(v_vagas) v where v !~ '^[0-9]{1,20}$') then
    raise exception 'Código de vaga inválido: use só dígitos' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct private."FC_NUMERO_EDITAL"(e)), '{}') into v_editais
    from unnest(coalesce(p_editais, '{}')) e;
  if exists (select 1 from unnest(v_editais) e where e is null) then
    raise exception 'Edital inválido: use o número, como 80/2026' using errcode = '22023';
  end if;
  v_modo := case when cardinality(v_vagas) > 0 then 'VAGAS'
                 when cardinality(v_editais) > 0 then 'EDITAIS'
                 else 'PADRAO' end;

  return (
    with quadro as (
      select q.vaga, m.id as edital_id, m.edital, m.unidade, q.cargo, m."CO_AREA" as area,
             m.ativo as edital_ativo, 'quadro'::text as origem
        from private."FC_EMPREGARE_VAGAS_DO_QUADRO"() q
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = q.edital_id
    ),
    selecao as (
      select distinct on (s."CO_VAGA")
             s."CO_VAGA" as vaga, s."CO_MONITORAMENTO" as edital_id, s."DS_EDITAL" as edital,
             s."NO_UNIDADE" as unidade, s."NO_CARGO" as cargo, s."CO_AREA" as area,
             m.ativo as edital_ativo, 'selecao'::text as origem
        from public."TB_SELECAO_VAGA" s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
       where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_VAGA" is not null
       order by s."CO_VAGA", (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
    ),
    -- Mesmo código nas duas fontes: fica a linha do quadro.
    fontes as (
      select f.*,
             (select max(coalesce(c.data_fim, c.data_inicio)::date)
                from public."TB_CRONOGRAMA_MONIT_INDIG" c
               where c.monitoramento_id = f.edital_id) as fim_do_cronograma
        from (select * from quadro
              union all
              select s.* from selecao s where not exists (select 1 from quadro q where q.vaga = s.vaga)) f
    ),
    escolhidas as (
      select s.vaga, s.edital_id, s.edital, s.unidade, s.cargo, s.area, s.origem
        from fontes s
       where (v_modo = 'VAGAS' and s.vaga = any (v_vagas))
          or (v_modo = 'EDITAIS' and private."FC_NUMERO_EDITAL"(s.edital) = any (v_editais))
          or (v_modo = 'PADRAO' and s.edital_ativo is true
              and (s.fim_do_cronograma is null or s.fim_do_cronograma >= current_date - 30))
      union all
      -- Código pedido que não está no quadro nem na Seleção: vai mesmo assim, sem edital.
      select v, null::uuid, null, null, null, null, 'pedida'
        from unnest(v_vagas) v
       where v_modo = 'VAGAS' and not exists (select 1 from fontes s where s.vaga = v)
    ),
    ordenadas as (
      select e.*, ev."DT_ULTIMA_CARGA" as ultima_carga
        from escolhidas e
        left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = e.vaga
       order by ev."DT_ULTIMA_CARGA" nulls first, e.edital nulls last, e.vaga
       limit v_limite
    )
    select jsonb_build_object(
      'modo', v_modo,
      'limite', v_limite,
      'vagas', coalesce(jsonb_agg(jsonb_build_object(
          'vaga', o.vaga, 'edital_id', o.edital_id, 'edital', o.edital, 'unidade', o.unidade,
          'cargo', o.cargo, 'area', o.area, 'ultima_carga', o.ultima_carga, 'origem', o.origem
        ) order by o.ultima_carga nulls first, o.edital nulls last, o.vaga), '[]'::jsonb)
    )
      from ordenadas o
  );
end;
$function$;
comment on function public.listar_vagas_empregare(text[], text[], integer) is
  'Vagas que o robô da Empregare deve exportar, de duas fontes sem duplicar (mesmo código: fica o quadro): o quadro de vagas do edital (FC_EMPREGARE_VAGAS_DO_QUADRO, fonte principal) e TB_SELECAO_VAGA (editais antigos). Sem filtro, as vagas cujo edital está ativo e em curso (sem cronograma ou com etapa terminando há no máximo 30 dias); p_editais (números como 80/2026) ou p_vagas (códigos) restringem. Cada vaga diz a origem (quadro, selecao ou pedida). Nunca carregadas e mais antigas primeiro, até p_limite (1 a 500). Só service_role.';
revoke all on function public.listar_vagas_empregare(text[], text[], integer) from public, anon, authenticated;
grant execute on function public.listar_vagas_empregare(text[], text[], integer) to service_role;

commit;
