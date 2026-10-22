/*
  Ensaio de 20261020130000 (modo "só anexos" do robô da Empregare e a resposta
  editada depois da captura). Sempre termina em rollback; só lê (não chama
  gravar_anexos_empregare nem disparar_robo). Cole a migration no ponto marcado.

  Reprova se:
    - a candidata 2160872 (vaga 182514, resposta 8037239, capturada em 09/10 e
      com "DATA DE RESPOSTA" em 11/10) não sair como suspeita em
      listar_anexos_empregare ou continuar com 8037239 em "lidas";
    - alguma resposta "lida" do 114/2026 tiver sido capturada antes do limite
      (FC_LIMITE_DA_RESPOSTA_EMPREGARE);
    - a vaga inválida não der 22023, ou mais de 1.000 códigos passarem;
    - a maior vaga do 114/2026 levar mais de 2 s em qualquer das duas RPCs.
  Mostra quantos suspeitos o 114/2026 tem (captura no dia da DATA DE RESPOSTA
  ou antes) e quantos deles estão no lote.
*/
begin;

-- >>> cole aqui supabase/migrations/20261020130000_robo_modo_anexos.sql (sem o begin/commit) <<<

create temp table t_vagas as
select distinct p."CO_VAGA" as vaga
  from public."TB_PRE_CLASSIFICACAO" p
 where p."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

create temp table t_suspeitos as
select v.vaga, x ->> 'codigo' as codigo
  from t_vagas v,
       lateral jsonb_array_elements(public.listar_anexos_empregare(v.vaga) -> 'candidatos') x;

do $$
declare
  v_lista jsonb;
  v_ruins integer;
  v_erro text;
  t0 timestamptz;
  v_ms numeric;
  v_maior text;
begin
  -- O caso que motivou: a resposta editada depois da captura.
  v_lista := public.listar_anexos_empregare('182514', array['2160872']);
  if not coalesce((v_lista #> '{candidatos,0,suspeito}')::boolean, false) then
    raise exception 'a candidata 2160872 (vaga 182514) deveria ser suspeita: %', (v_lista #> '{candidatos,0}') - 'respostas';
  end if;
  if exists (select 1 from jsonb_array_elements(public.listar_prioridade_anexos_empregare('182514') -> 'candidatos') x
              where x ->> 'codigo' = '2160872' and x -> 'lidas' ? '8037239') then
    raise exception 'a resposta 8037239 (2160872) não pode contar como lida';
  end if;
  if not exists (select 1 from t_suspeitos where vaga = '182514' and codigo = '2160872') then
    raise exception 'sem códigos, a 2160872 deveria vir entre os suspeitos da vaga 182514';
  end if;

  -- Nenhuma resposta "lida" capturada antes do limite.
  select count(*) into v_ruins
    from t_vagas v
    cross join lateral jsonb_array_elements(public.listar_prioridade_anexos_empregare(v.vaga) -> 'candidatos') x
    cross join lateral jsonb_array_elements_text(x -> 'lidas') l(resposta)
    join public."TB_EMPREGARE_CANDIDATO" c
      on c."CO_VAGA" = v.vaga and btrim(c."CO_CANDIDATO_EMPREGARE") = x ->> 'codigo' and c."ST_REGISTRO_ATIVO" = 'S'
    join public."TB_EMPREGARE_RESPOSTA" r
      on r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO" and r."CO_RESPOSTA_QUESTIONARIO" = l.resposta
   where r."DT_CAPTURA" < private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(c."DS_COLUNA_ORIGINAL");
  if v_ruins > 0 then
    raise exception '% resposta(s) lida(s) capturada(s) antes da DATA DE RESPOSTA', v_ruins;
  end if;

  -- Entradas inválidas.
  begin
    perform public.listar_anexos_empregare('x; drop', null);
    v_erro := 'passou';
  exception when sqlstate '22023' then
    v_erro := null;
  end;
  if v_erro is not null then
    raise exception 'vaga inválida deveria dar 22023';
  end if;
  begin
    perform public.listar_anexos_empregare('182514', array(select g::text from generate_series(1, 1001) g));
    v_erro := 'passou';
  exception when sqlstate '22023' then
    v_erro := null;
  end;
  if v_erro is not null then
    raise exception 'mais de 1.000 códigos deveria dar 22023';
  end if;

  -- Tempo na maior vaga.
  select c."CO_VAGA" into v_maior
    from public."TB_EMPREGARE_CANDIDATO" c join t_vagas v on v.vaga = c."CO_VAGA"
   where c."ST_REGISTRO_ATIVO" = 'S'
   group by 1 order by count(*) desc limit 1;
  t0 := clock_timestamp();
  perform public.listar_anexos_empregare(v_maior);
  perform public.listar_prioridade_anexos_empregare(v_maior);
  v_ms := round(extract(epoch from clock_timestamp() - t0) * 1000);
  if v_ms > 2000 then
    raise exception 'a maior vaga (%) levou % ms', v_maior, v_ms;
  end if;
  raise notice 'maior vaga %: % ms nas duas RPCs', v_maior, v_ms;
end;
$$;

select count(*) as suspeitos_114,
       count(distinct s.vaga) as vagas,
       count(*) filter (where exists (
         select 1 from public."TB_PRE_CLASSIFICACAO" p
          join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO"
         where p."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and p."TP_SITUACAO" = 'NO_LOTE'
           and c."CO_VAGA" = s.vaga and btrim(c."CO_CANDIDATO_EMPREGARE") = s.codigo)) as no_lote
  from t_suspeitos s;

rollback;
