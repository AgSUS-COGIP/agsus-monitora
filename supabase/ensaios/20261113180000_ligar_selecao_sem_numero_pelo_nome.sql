/*
  ENSAIO de 20261113180000_ligar_selecao_sem_numero_pelo_nome.sql

  Roda no banco ANTES de aplicar e termina em rollback: nada fica gravado.
  Aplica tudo e confere: FGV 2025 com 13.275 inscritos, FCC com 5.120,
  nenhuma vaga sem edital, nenhum 0 sem fonte e o padrão nulo.
  Ok = NOTICE com os números e "Ensaio 20261113180000 ok", e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_md5 text := md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_LIGAR_SELECAO_AOS_EDITAIS"()')), chr(13), ''));
begin
  if v_md5 = '87409a322611ed0de4f17fa46b1f57ff' then
    raise exception 'Já aplicada: nada a ensaiar.';
  end if;
  if v_md5 is distinct from '2514ffb3b3a3d394cb5a6854a32aa9ad' then
    raise exception 'FC_LIGAR_SELECAO_AOS_EDITAIS mudou depois de 13/11/2026 (md5 %): junte as mudanças antes de aplicar.', v_md5;
  end if;
end;
$guarda$;

create or replace function private."FC_LIGAR_SELECAO_AOS_EDITAIS"()
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
           private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) as unidade,
           btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(m.unidade), '[[:space:]-]+', ' ', 'g')) as unidade_sem_hifen,
           btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(m.edital), '[[:space:]-]+', ' ', 'g')) as nome
      from public."TB_MONITORAMENTO_INDIGENA" m
  ),
  u as materialized (
    select private."FC_TEXTO_BUSCA_RECURSO"(u."NO_UNIDADE") as unidade, u."CO_AREA" as area
      from public."TA_UNIDADE_AREA" u
  ),
  s as materialized (
    select s."CO_SELECAO_VAGA" as id,
           private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") as unidade,
           btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE"), '[[:space:]-]+', ' ', 'g')) as unidade_sem_hifen,
           btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(s."DS_EDITAL"), '[[:space:]-]+', ' ', 'g')) as nome,
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
         where ((c.numero is not null and m.numero = c.numero)
                -- Sem número dos dois lados (FGV 2025, FCC): o nome inteiro igual.
                or (c.numero is null and m.numero is null and c.nome <> '' and m.nome = c.nome))
           -- DSEI/CASAI: só o edital da Saúde Indígena da mesma unidade.
           and (case when c.indigena then m.area = 'saude-indigena'
                                          and m.unidade_sem_hifen = c.unidade_sem_hifen
                     else m.area <> 'saude-indigena' end)
         order by m.ativo desc,
                  (m.unidade = c.unidade) desc,
                  (m.area = c.area_tabela) desc
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

comment on function private."FC_LIGAR_SELECAO_AOS_EDITAIS"() is 'Liga cada vaga ativa de TB_SELECAO_VAGA ao edital cadastrado e acerta a área: DSEI/CASAI só na Saúde Indígena e só no edital de mesmo número e mesma unidade (sem acento, caixa, espaço repetido nem hífen; sem ele, a vaga fica sem edital); as outras unidades só na SEDE ou em Projetos (edital de mesmo número, ou, sem número dos dois lados, de mesmo nome: o ativo primeiro, depois a mesma unidade e a área de TA_UNIDADE_AREA; sem edital, TA_UNIDADE_AREA ou sede). Devolve quantas linhas mudaram (20261113180000).';

-- O edital da FGV passa a ter o nome que a planilha da Seleção usa (pedido de 13/11/2026).
update public."TB_MONITORAMENTO_INDIGENA" set edital = 'FGV 2025'
 where id = '65f6f52a-615d-4072-a784-fca9e0f34454' and edital = 'FGV';

-- Edital novo nasce sem número de inscritos (antes, 0: "nenhum inscrito" no lugar de "sem dado").
alter table public."TB_MONITORAMENTO_INDIGENA" alter column inscritos set default null;

-- Liga de novo as vagas e recalcula os números, como no fim de cada carga da Seleção.
select private."FC_LIGAR_SELECAO_AOS_EDITAIS"();
select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();

-- O 0 de quem nunca teve fonte do funil não é dado: vira nulo ("—").
update public."TB_MONITORAMENTO_INDIGENA" set inscritos = null
 where "TP_FONTE_FUNIL" is null and inscritos = 0;

do $confere$
declare
  v_fgv integer; v_fcc integer; v_sem_edital integer; v_zeros integer; v_padrao text;
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_LIGAR_SELECAO_AOS_EDITAIS"()')), chr(13), '')) is distinct from '87409a322611ed0de4f17fa46b1f57ff' then
    raise exception 'O corpo aplicado não tem o md5 esperado.';
  end if;
  select inscritos into v_fgv from public."TB_MONITORAMENTO_INDIGENA" where id = '65f6f52a-615d-4072-a784-fca9e0f34454';
  select inscritos into v_fcc from public."TB_MONITORAMENTO_INDIGENA" where id = '0c381c6e-32de-4b1d-9719-6b3e85843423';
  select count(*) into v_sem_edital from public."TB_SELECAO_VAGA" where "ST_REGISTRO_ATIVO" = 'S' and "CO_MONITORAMENTO" is null;
  select count(*) into v_zeros from public."TB_MONITORAMENTO_INDIGENA" where "TP_FONTE_FUNIL" is null and inscritos = 0;
  select column_default into v_padrao from information_schema.columns
   where table_schema = 'public' and table_name = 'TB_MONITORAMENTO_INDIGENA' and column_name = 'inscritos';
  raise notice 'FGV 2025: % inscritos; FCC: % inscritos; vagas sem edital: %; zeros sem fonte: %; padrão: %', v_fgv, v_fcc, v_sem_edital, v_zeros, coalesce(v_padrao, 'nulo');
  if v_fgv is distinct from 13275 then raise exception 'FGV 2025 deveria ter 13275 inscritos (tem %).', v_fgv; end if;
  if v_fcc is distinct from 5120 then raise exception 'FCC deveria ter 5120 inscritos (tem %).', v_fcc; end if;
  if v_sem_edital <> 0 then raise exception 'Ainda há % vagas sem edital.', v_sem_edital; end if;
  if v_zeros <> 0 then raise exception 'Ainda há % editais com 0 sem fonte.', v_zeros; end if;
  if v_padrao is not null and v_padrao <> 'NULL::integer' then raise exception 'O padrão de inscritos não é nulo (%).', v_padrao; end if;
end;
$confere$;

do $ok$ begin raise notice 'Ensaio 20261113180000 ok'; end; $ok$;

rollback;
