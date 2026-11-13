/*
  ENSAIO de 20261113120000_ligar_selecao_so_ao_edital_da_mesma_unidade.sql

  Roda no SQL Editor (papel postgres) ANTES de aplicar. Termina em rollback: nada
  fica no banco. Mostra só contagens, sem dado de pessoa.

  O que confere:
    A. O corpo vigente é o que a migration conhece (md5 de antes, sem chr(13)).
    B. Aplica o corpo da migration (igual ao arquivo; o teste confere) e confere
       o md5 do corpo aplicado.
    C. Com os dados de hoje, a função não muda nenhuma linha, as linhas sem
       edital continuam as mesmas e, recalculados os indicadores, os inscritos de
       Porto Velho 110/2026, Parintins 111/2026 e Guamá-Tocantins 49/2026 não
       mudam.
    D. Repete os erros da planilha dentro do ensaio: uma vaga de Parintins com
       EDITAL 110/2026 e a vaga 167021 com unidade "DSEI  Tocantins" ficam SEM
       edital (antes iam para Porto Velho e Guamá-Tocantins); a 167021 escrita
       "DSEI Guama Tocantins" (sem acento nem hífen) continua no 49/2026.
  Ok = termina com NOTICE "Ensaio 20261113120000 ok" e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_LIGAR_SELECAO_AOS_EDITAIS"()')), chr(13), '')) is distinct from 'c7f7a1383861bf420e9ed7b4ed3e3083' then
    raise exception 'FC_LIGAR_SELECAO_AOS_EDITAIS não está no corpo que a migration conhece: confira antes de aplicar.';
  end if;
end;
$guarda$;

create temporary table ensaio_antes on commit drop as
  select m.id, m.edital, m.unidade, m.inscritos
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.id in ('64811db4-bf03-4092-bb70-13b347906d46',  -- Porto Velho 110/2026
                  'be4de98f-ba77-45f7-9a0e-103e5ed16156',  -- Parintins 111/2026
                  '98704c80-7f1e-4830-9d8c-4ce14f07c029'); -- Guamá-Tocantins 49/2026

create temporary table ensaio_sem_edital on commit drop as
  select s."CO_SELECAO_VAGA" as id
    from public."TB_SELECAO_VAGA" s
   where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_MONITORAMENTO" is null;

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

do $confere$
declare
  v_qt integer;
  v_dif integer;
  v_edital uuid;
  v_vaga_parintins uuid;
begin
  -- B. O corpo aplicado é o da migration.
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_LIGAR_SELECAO_AOS_EDITAIS"()')), chr(13), '')) is distinct from '2514ffb3b3a3d394cb5a6854a32aa9ad' then
    raise exception 'O corpo aplicado não tem o md5 esperado (2514ffb3b3a3d394cb5a6854a32aa9ad).';
  end if;

  if (select count(*) from ensaio_antes) <> 3 then
    raise exception 'Os três editais de referência não estão no banco.';
  end if;

  -- C. Com os dados de hoje, nada muda.
  v_qt := private."FC_LIGAR_SELECAO_AOS_EDITAIS"();
  if v_qt <> 0 then
    raise exception 'A regra nova mudaria % linha(s) com os dados de hoje: confira antes de aplicar.', v_qt;
  end if;

  select count(*) into v_dif from (
    (select s."CO_SELECAO_VAGA" from public."TB_SELECAO_VAGA" s
      where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_MONITORAMENTO" is null
     except select id from ensaio_sem_edital)
    union all
    (select id from ensaio_sem_edital
     except select s."CO_SELECAO_VAGA" from public."TB_SELECAO_VAGA" s
      where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_MONITORAMENTO" is null)
  ) d;
  if v_dif <> 0 then
    raise exception 'As linhas sem edital mudaram (% diferença(s)).', v_dif;
  end if;

  perform private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();
  select count(*) into v_dif
    from ensaio_antes a
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = a.id
   where m.inscritos is distinct from a.inscritos;
  if v_dif <> 0 then
    raise exception 'Os inscritos de % edital(is) de referência mudaram.', v_dif;
  end if;

  -- D. Os erros da planilha não ligam mais a vaga ao edital de outra unidade.
  select s."CO_SELECAO_VAGA" into v_vaga_parintins
    from public."TB_SELECAO_VAGA" s
   where s."ST_REGISTRO_ATIVO" = 'S'
     and s."CO_MONITORAMENTO" = 'be4de98f-ba77-45f7-9a0e-103e5ed16156'
   limit 1;
  if v_vaga_parintins is null then
    raise exception 'Nenhuma vaga ativa ligada a Parintins 111/2026 para o teste.';
  end if;
  update public."TB_SELECAO_VAGA" set "DS_EDITAL" = '110/2026'
   where "CO_SELECAO_VAGA" = v_vaga_parintins;

  update public."TB_SELECAO_VAGA" set "NO_UNIDADE" = 'DSEI  Tocantins'
   where "CO_VAGA" = '167021' and "ST_REGISTRO_ATIVO" = 'S';

  perform private."FC_LIGAR_SELECAO_AOS_EDITAIS"();

  select "CO_MONITORAMENTO" into v_edital from public."TB_SELECAO_VAGA"
   where "CO_SELECAO_VAGA" = v_vaga_parintins;
  if v_edital is not null then
    raise exception 'A vaga de Parintins com EDITAL 110/2026 ainda se liga a um edital (%).', v_edital;
  end if;

  select "CO_MONITORAMENTO" into v_edital from public."TB_SELECAO_VAGA"
   where "CO_VAGA" = '167021' and "ST_REGISTRO_ATIVO" = 'S';
  if v_edital is not null then
    raise exception 'A vaga 167021 com unidade "DSEI  Tocantins" ainda se liga a um edital (%).', v_edital;
  end if;

  update public."TB_SELECAO_VAGA" set "NO_UNIDADE" = 'DSEI Guama Tocantins'
   where "CO_VAGA" = '167021' and "ST_REGISTRO_ATIVO" = 'S';
  perform private."FC_LIGAR_SELECAO_AOS_EDITAIS"();
  select "CO_MONITORAMENTO" into v_edital from public."TB_SELECAO_VAGA"
   where "CO_VAGA" = '167021' and "ST_REGISTRO_ATIVO" = 'S';
  if v_edital is distinct from '98704c80-7f1e-4830-9d8c-4ce14f07c029' then
    raise exception 'A vaga 167021 escrita "DSEI Guama Tocantins" deveria ficar no 49/2026 (ficou em %).', v_edital;
  end if;

  raise notice 'Ensaio 20261113120000 ok';
end;
$confere$;

rollback;
