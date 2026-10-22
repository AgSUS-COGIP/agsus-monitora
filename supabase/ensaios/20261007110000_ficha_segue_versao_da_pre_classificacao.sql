/*
  ENSAIO de 20261007110000_ficha_segue_versao_da_pre_classificacao.sql — begin … rollback.

  PRÉ-REQUISITO: as migrations até 20261007100000 aplicadas.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, mostra as fichas por versão (ficha ×
  pré-classificação), aplica o corpo da migration (\i não existe no SQL Editor:
  cole o corpo dela, sem o begin/commit, no lugar indicado) e:
    E1  nenhuma ficha não concluída fica com versão diferente da
        pré-classificação; as concluídas não mudam;
    E2  FC_ABRIR_FICHAS de novo, em cada edital com fichas, não muda mais
        versão nenhuma (regra_atualizada = 0).
  No fim, rollback: nada fica gravado.
*/
begin;

-- Antes: fichas por edital, situação e versão.
select m.edital, f."TP_SITUACAO", f."NU_VERSAO_REGRA" as versao_da_ficha, p."NU_VERSAO_REGRA" as versao_da_pre,
       count(*) as fichas
  from public."TB_FICHA_ANALISE" f
  join public."TB_PRE_CLASSIFICACAO" p
    on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = f."CO_MONITORAMENTO"
 group by 1, 2, 3, 4
 order by 1, 2, 3, 4;

create temp table ensaio_concluidas on commit drop as
  select "CO_FICHA_ANALISE", "NU_VERSAO_REGRA", "NU_VERSAO"
    from public."TB_FICHA_ANALISE" where "TP_SITUACAO" = 'CONCLUIDA';

-- >>> cole aqui o corpo de supabase/migrations/20261007110000_ficha_segue_versao_da_pre_classificacao.sql

-- E1
do $$
declare
  v_fora integer;
  v_mudou integer;
begin
  select count(*) into v_fora
    from public."TB_FICHA_ANALISE" f
    join public."TB_PRE_CLASSIFICACAO" p
      on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
   where f."TP_SITUACAO" <> 'CONCLUIDA' and f."NU_VERSAO_REGRA" is distinct from p."NU_VERSAO_REGRA";
  if v_fora > 0 then
    raise exception 'E1: % ficha(s) não concluída(s) fora da versão da pré-classificação', v_fora;
  end if;
  select count(*) into v_mudou
    from ensaio_concluidas c
    join public."TB_FICHA_ANALISE" f using ("CO_FICHA_ANALISE")
   where f."NU_VERSAO_REGRA" <> c."NU_VERSAO_REGRA" or f."NU_VERSAO" <> c."NU_VERSAO";
  if v_mudou > 0 then raise exception 'E1: % ficha(s) concluída(s) mudaram', v_mudou; end if;
  raise notice 'E1 ok';
end;
$$;

-- E2
do $$
declare
  v_edital uuid;
  v_r jsonb;
begin
  for v_edital in select distinct "CO_MONITORAMENTO" from public."TB_FICHA_ANALISE" loop
    v_r := private."FC_ABRIR_FICHAS"(v_edital, '[]'::jsonb, null);
    raise notice 'E2 %: %', v_edital, v_r;
    if (v_r ->> 'regra_atualizada')::integer <> 0 then
      raise exception 'E2: a segunda passada ainda mudou a versão (%)', v_r;
    end if;
  end loop;
  raise notice 'E2 ok';
end;
$$;

-- Depois: as mesmas contagens.
select m.edital, f."TP_SITUACAO", f."NU_VERSAO_REGRA" as versao_da_ficha, p."NU_VERSAO_REGRA" as versao_da_pre,
       count(*) as fichas
  from public."TB_FICHA_ANALISE" f
  join public."TB_PRE_CLASSIFICACAO" p
    on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = f."CO_MONITORAMENTO"
 group by 1, 2, 3, 4
 order by 1, 2, 3, 4;

rollback;
