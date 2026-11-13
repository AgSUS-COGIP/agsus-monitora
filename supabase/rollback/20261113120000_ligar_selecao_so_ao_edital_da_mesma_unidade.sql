/*
  ROLLBACK de 20261113120000_ligar_selecao_so_ao_edital_da_mesma_unidade.sql

  Volta private."FC_LIGAR_SELECAO_AOS_EDITAIS"() ao corpo de antes (md5 c7f7a1383861bf420e9ed7b4ed3e3083,
  copiado com pg_get_functiondef do banco em 13/11/2026) e ao COMMENT de antes: a
  vaga de DSEI/CASAI volta a se ligar ao edital de mesmo número da Saúde
  Indígena, com a unidade só desempatando.

  A ligação das vagas não muda na hora: muda na próxima carga da Seleção
  (finalizar_sync_selecao chama a função).

  Guarda: não roda se a migration não foi aplicada (o corpo vigente não é o dela,
  md5 2514ffb3b3a3d394cb5a6854a32aa9ad).
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_LIGAR_SELECAO_AOS_EDITAIS"()')), chr(13), '')) is distinct from '2514ffb3b3a3d394cb5a6854a32aa9ad' then
    raise exception 'O corpo vigente de FC_LIGAR_SELECAO_AOS_EDITAIS não é o da migration 20261113120000: nada a desfazer.';
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

comment on function private."FC_LIGAR_SELECAO_AOS_EDITAIS"() is 'Liga cada vaga ativa de TB_SELECAO_VAGA ao edital cadastrado e acerta a área: DSEI/CASAI só na Saúde Indígena; as outras unidades só na SEDE ou em Projetos (edital de mesmo número: o ativo primeiro, depois a mesma unidade e a área de TA_UNIDADE_AREA; sem edital, TA_UNIDADE_AREA ou sede). Devolve quantas linhas mudaram.';

commit;
