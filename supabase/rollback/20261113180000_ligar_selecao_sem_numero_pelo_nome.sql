/*
  ROLLBACK de 20261113180000_ligar_selecao_sem_numero_pelo_nome.sql

  Volta a função de ligação, o nome do edital da FGV e o padrão 0 de inscritos.
  Os números dos editais voltam na próxima carga da Seleção.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_LIGAR_SELECAO_AOS_EDITAIS"()')), chr(13), '')) is distinct from '87409a322611ed0de4f17fa46b1f57ff' then
    raise exception 'FC_LIGAR_SELECAO_AOS_EDITAIS não está no corpo da migration 20261113180000.';
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
           btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(m.unidade), '[[:space:]-]+', ' ', 'g')) as unidade_sem_hifen
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
           btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE"), '[[:space:]-]+', ' ', 'g')) as unidade_sem_hifen,
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

comment on function private."FC_LIGAR_SELECAO_AOS_EDITAIS"() is 'Liga cada vaga ativa de TB_SELECAO_VAGA ao edital cadastrado e acerta a área: DSEI/CASAI só na Saúde Indígena e só no edital de mesmo número e mesma unidade (sem acento, caixa, espaço repetido nem hífen; sem ele, a vaga fica sem edital); as outras unidades só na SEDE ou em Projetos (edital de mesmo número: o ativo primeiro, depois a mesma unidade e a área de TA_UNIDADE_AREA; sem edital, TA_UNIDADE_AREA ou sede). Devolve quantas linhas mudaram (20261113120000).';

update public."TB_MONITORAMENTO_INDIGENA" set edital = 'FGV' where id = '65f6f52a-615d-4072-a784-fca9e0f34454' and edital = 'FGV 2025';
alter table public."TB_MONITORAMENTO_INDIGENA" alter column inscritos set default 0;

commit;
