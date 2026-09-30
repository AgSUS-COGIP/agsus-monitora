/*
  SELEÇÃO: ÁREA DE CADA VAGA PELOS EDITAIS CADASTRADOS (CORRIGE 20261001090000)

  Na primeira carga, unidades da SEDE e de Projetos (UAE, UGP, UTIC, FGV…)
  apareceram na aba Seleção da Saúde Indígena. Duas causas:
    - unidade fora de TA_UNIDADE_AREA caía em 'saude-indigena' por padrão;
    - o número do edital se repete entre áreas, e a busca do edital preferia o
      da área provisória (Saúde Indígena).

  REGRA NOVA (decisão de 30/09/2026: "na Saúde Indígena só entram DSEI e CASAI")
    Unidade DSEI ou CASAI: área saude-indigena; o edital é o cadastrado da
      Saúde Indígena de mesmo número (FC_NUMERO_EDITAL), de preferência da
      mesma unidade.
    Qualquer outra unidade: nunca saude-indigena. O edital é o cadastrado de
      mesmo número na SEDE ou em Projetos, de preferência da mesma unidade e da
      área que TA_UNIDADE_AREA dá à unidade; a área é a do edital achado.
      Sem edital: a área de TA_UNIDADE_AREA; fora dela, 'sede'.

  O QUE MUDA
    private."FC_LIGAR_SELECAO_AOS_EDITAIS"()   a regra, num lugar só
    public.finalizar_sync_selecao              passa a usá-la
    As vagas já carregadas são religadas agora, no fim desta migration.

  Rollback: supabase/rollback/20261001100000_selecao_area_pelos_editais.sql
*/
begin;

create function private."FC_LIGAR_SELECAO_AOS_EDITAIS"()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  with m as materialized (
    select m.id, m."CO_AREA" as area, m.ativo,
           private."FC_NUMERO_EDITAL"(m.edital) as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) as unidade
      from public."TB_MONITORAMENTO_INDIGENA" m
     where private."FC_NUMERO_EDITAL"(m.edital) is not null
  ),
  u as materialized (
    select private."FC_TEXTO_BUSCA_RECURSO"(u."NO_UNIDADE") as unidade, u."CO_AREA" as area
      from public."TA_UNIDADE_AREA" u
  ),
  s as materialized (
    select s."CO_SELECAO_VAGA" as id,
           private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") as unidade,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") ~ '^(dsei|casai)( |$)' as indigena
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S'
  ),
  com_tabela as (
    select s.*, (select u.area from u where u.unidade = s.unidade limit 1) as area_tabela
      from s
  ),
  alvo as (
    select c.id,
           e.id as edital_id,
           case when c.indigena then 'saude-indigena'
                else coalesce(e.area, c.area_tabela, 'sede') end as area
      from com_tabela c
      left join lateral (
        select m.id, m.area from m
         where c.numero is not null and m.numero = c.numero
           and (case when c.indigena then m.area = 'saude-indigena'
                     else m.area <> 'saude-indigena' end)
         order by (m.unidade = c.unidade) desc,
                  (m.area = c.area_tabela) desc,
                  m.ativo desc
         limit 1
      ) e on true
  )
  update public."TB_SELECAO_VAGA" s set
    "CO_MONITORAMENTO" = alvo.edital_id,
    "CO_AREA" = alvo.area
    from alvo
   where s."CO_SELECAO_VAGA" = alvo.id
     and (s."CO_MONITORAMENTO" is distinct from alvo.edital_id
          or s."CO_AREA" is distinct from alvo.area);
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_LIGAR_SELECAO_AOS_EDITAIS"() is
  'Liga cada vaga ativa de TB_SELECAO_VAGA ao edital cadastrado e acerta a área: DSEI/CASAI só na Saúde Indígena; as outras unidades só na SEDE ou em Projetos (edital de mesmo número; sem edital, TA_UNIDADE_AREA ou sede). Devolve quantas linhas mudaram.';
revoke all on function private."FC_LIGAR_SELECAO_AOS_EDITAIS"() from public, anon, authenticated;

create or replace function public.finalizar_sync_selecao(p_sync text, p_forcar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sync public."TL_SYNC_SELECAO";
  v_ativas integer;
  v_desativadas integer;
  v_sem_edital integer;
begin
  select * into v_sync from public."TL_SYNC_SELECAO" s where s."CO_SYNC" = p_sync for update;
  if v_sync."CO_SYNC" is null or v_sync."TP_SITUACAO" <> 'EM_ANDAMENTO' then
    raise exception 'Carga % não encontrada ou já fechada', p_sync using errcode = '22023';
  end if;

  select count(*) into v_ativas from public."TB_SELECAO_VAGA" s where s."ST_REGISTRO_ATIVO" = 'S';
  if not coalesce(p_forcar, false) and v_ativas > 0 and v_sync."QT_LINHA" * 2 < v_ativas then
    update public."TL_SYNC_SELECAO" set "TP_SITUACAO" = 'RECUSADA', "DT_FIM" = now(),
      "DS_MENSAGEM" = format('Carga com %s linhas e %s ativas no banco: menos da metade. Nada foi desativado; confira a planilha ou rode com forçar.', v_sync."QT_LINHA", v_ativas)
     where "CO_SYNC" = p_sync;
    return jsonb_build_object('situacao', 'RECUSADA', 'linhas', v_sync."QT_LINHA", 'ativas', v_ativas);
  end if;

  update public."TB_SELECAO_VAGA" s set "ST_REGISTRO_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
   where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_SYNC" is distinct from p_sync;
  get diagnostics v_desativadas = row_count;

  perform private."FC_LIGAR_SELECAO_AOS_EDITAIS"();

  select count(*) filter (where s."CO_MONITORAMENTO" is null) into v_sem_edital
    from public."TB_SELECAO_VAGA" s where s."ST_REGISTRO_ATIVO" = 'S';

  update public."TL_SYNC_SELECAO" set
    "TP_SITUACAO" = 'CONCLUIDA', "DT_FIM" = now(),
    "QT_SEM_EDITAL" = v_sem_edital, "QT_DESATIVADA" = v_desativadas,
    "DS_MENSAGEM" = case when coalesce(p_forcar, false) then 'Fechada com forçar.' end
   where "CO_SYNC" = p_sync;

  return jsonb_build_object('situacao', 'CONCLUIDA', 'linhas', v_sync."QT_LINHA",
    'sem_edital', v_sem_edital, 'desativadas', v_desativadas);
end;
$function$;
comment on function public.finalizar_sync_selecao(text, boolean) is
  'Fecha uma carga da aba Seleção: desativa (ST_REGISTRO_ATIVO = N) o que saiu da planilha, liga o edital e acerta a área (FC_LIGAR_SELECAO_AOS_EDITAIS: DSEI/CASAI só na Saúde Indígena) e grava os totais no log. Recusa carga com menos da metade das linhas ativas sem p_forcar. Só service_role.';

-- As vagas já carregadas, com a regra nova.
select private."FC_LIGAR_SELECAO_AOS_EDITAIS"();

commit;
