/*
  ENSAIO de supabase/migrations/20261117040000_roteiro_do_93_aceita_nota_com_duas_casas.sql: o mesmo corpo, a escala aceitando 1,29 e
  recusando 1,295 (três casas) e 2,01 (acima do máximo), e rollback.
*/

begin;

set local lock_timeout = '5s';

set local lock_timeout = '5s';

do $passo$
declare
  v_roteiro constant uuid := 'a153cace-9188-4b54-8328-a69979f895ec';
  v_passo numeric;
begin
  select "VL_PASSO" into v_passo from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_roteiro;
  if v_passo is distinct from 0.50 then
    raise exception 'Roteiro do 93/2026 com passo % (esperado 0,50): confira antes', v_passo using errcode = '55000';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA" e
              where e."CO_ROTEIRO" = v_roteiro and e."ST_ATIVO" = 'S'
                and e."CO_MONITORAMENTO" <> 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded') then
    raise exception 'Outro edital tem entrevista lançada neste roteiro: confira antes' using errcode = '55000';
  end if;
  update public."TB_ROTEIRO_ENTREVISTA" set "VL_PASSO" = 0.01 where "CO_ROTEIRO" = v_roteiro;
end
$passo$;


do $ensaio$
begin
  perform private."FC_EXIGIR_NOTA_NA_ESCALA"('a153cace-9188-4b54-8328-a69979f895ec', k."CO_COMPETENCIA", 1.29)
    from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = 'a153cace-9188-4b54-8328-a69979f895ec' and k."NU_ORDEM" = 3;
  begin
    perform private."FC_EXIGIR_NOTA_NA_ESCALA"('a153cace-9188-4b54-8328-a69979f895ec', k."CO_COMPETENCIA", 1.295)
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = 'a153cace-9188-4b54-8328-a69979f895ec' and k."NU_ORDEM" = 3;
    raise exception 'ENSAIO: aceitou 1,295 (três casas)';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform private."FC_EXIGIR_NOTA_NA_ESCALA"('a153cace-9188-4b54-8328-a69979f895ec', k."CO_COMPETENCIA", 2.01)
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = 'a153cace-9188-4b54-8328-a69979f895ec' and k."NU_ORDEM" = 3;
    raise exception 'ENSAIO: aceitou 2,01 (acima do máximo)';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ENSAIO OK: aceita 1,29; recusa 1,295 e 2,01';
end
$ensaio$;

rollback;
