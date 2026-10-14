/*
  Ensaio de 20261014100000 (gravar_lote_empregare mais leve). Sempre termina
  em rollback. Rode com e sem a migration (cole a migration antes deste
  arquivo, no mesmo begin/rollback) para comparar os tempos.

  Simula uma vaga sintética (999999990) com 800 candidatos e questionário de
  ~3 KB: 1ª execução (tudo novo), 2ª execução (790 iguais, 10 mudaram, 10
  saíram e 10 entraram) e o fechamento. Reprova se a semântica mudar:
  contagens, ausentes desativados só no fechar, questionário novo gravado,
  datas inválidas viram nulo.
*/
begin;

insert into public."TL_SYNC_EMPREGARE" ("CO_SYNC", "TP_DISPARO") values
  ('ensaio-lote-leve-1', 'GITHUB'), ('ensaio-lote-leve-2', 'GITHUB');

create temp table t_ensaio_tempo (ordem serial, etapa text, ms numeric, resposta jsonb);

do $$
declare
  c_vaga constant text := '999999990';
  c_lote constant integer := 200;
  v_texto text := repeat('Resposta longa do questionário com justificativa. ', 60);
  t0 timestamptz;
  r jsonb;
  v_linhas jsonb;
  v_rodada integer;
  v_inicio integer;
  v_fim integer;
  v_qt integer;
begin
  for v_rodada in 1..2 loop
    -- Rodada 1: candidatos 1..800. Rodada 2: 11..810 (1..10 saíram, 801..810 entraram), 11..20 mudaram.
    v_inicio := case v_rodada when 1 then 1 else 11 end;
    v_fim := v_inicio + 799;
    for v_qt in 0..3 loop
      select jsonb_agg(jsonb_build_object(
               'chave', 'cod:ens' || g, 'tipo', 'CODIGO', 'codigo', 'ens' || g,
               'nome', 'Candidato ' || g, 'email', 'c' || g || '@ensaio.invalid',
               'cpf', null, 'telefone', '31999990000',
               'nascimento', case when g % 50 = 0 then '1990-02-31' else '1990-05-10' end,
               'situacao', 'Inscrito', 'candidatura', '2026-10-01T10:' || lpad((g % 60)::text, 2, '0'),
               'colunas', jsonb_build_object(
                 'CÓDIGO', 'ens' || g, 'NOME', 'Candidato ' || g,
                 'RESPOSTAS', v_texto || g || case when v_rodada = 2 and g between 11 and 20 then ' mudou' else '' end),
               'link', null) order by g)
        into v_linhas
        from generate_series(v_inicio + v_qt * c_lote, least(v_inicio + (v_qt + 1) * c_lote - 1, v_fim)) g;
      t0 := clock_timestamp();
      r := public.gravar_lote_empregare('ensaio-lote-leve-' || v_rodada, c_vaga, 800, v_linhas);
      insert into t_ensaio_tempo (etapa, ms, resposta) values (format('rodada %s lote %s', v_rodada, v_qt + 1),
                                         round(extract(epoch from clock_timestamp() - t0) * 1000), r);
      if (r->>'gravadas')::integer <> 200 then
        raise exception 'Rodada % lote %: esperava 200 gravadas, veio %', v_rodada, v_qt + 1, r;
      end if;
    end loop;

    -- Antes do fechar ninguém sai: 800 (rodada 1) ou 810 (rodada 2) ativos.
    select count(*) into v_qt from public."TB_EMPREGARE_CANDIDATO"
     where "CO_VAGA" = c_vaga and "ST_REGISTRO_ATIVO" = 'S';
    if v_qt <> (case v_rodada when 1 then 800 else 810 end) then
      raise exception 'Rodada %: ausentes saíram antes do fechar (% ativos)', v_rodada, v_qt;
    end if;

    t0 := clock_timestamp();
    r := public.fechar_vaga_empregare('ensaio-lote-leve-' || v_rodada, c_vaga, '["CÓDIGO","NOME","RESPOSTAS"]'::jsonb, 'ensaio.xlsx');
    insert into t_ensaio_tempo (etapa, ms, resposta) values (format('rodada %s fechar', v_rodada),
                                       round(extract(epoch from clock_timestamp() - t0) * 1000), r);
    if r->>'situacao' <> 'GRAVADA' or (r->>'ativos')::integer <> 800
       or (r->>'desativadas')::integer <> (case v_rodada when 1 then 0 else 10 end) then
      raise exception 'Rodada %: fechamento inesperado %', v_rodada, r;
    end if;
  end loop;

  if exists (select 1 from public."TB_EMPREGARE_CANDIDATO"
              where "CO_VAGA" = c_vaga and "DS_CHAVE_CANDIDATO" = 'cod:ens15'
                and "DS_COLUNA_ORIGINAL"->>'RESPOSTAS' not like '% mudou') then
    raise exception 'Questionário que mudou não foi regravado';
  end if;
  if exists (select 1 from public."TB_EMPREGARE_CANDIDATO"
              where "CO_VAGA" = c_vaga and "DS_HASH_LINHA" <> encode(sha256(convert_to("DS_COLUNA_ORIGINAL"::text, 'UTF8')), 'hex')) then
    raise exception 'Hash e questionário gravados não batem';
  end if;
  if exists (select 1 from public."TB_EMPREGARE_CANDIDATO"
              where "CO_VAGA" = c_vaga and "ST_REGISTRO_ATIVO" = 'S'
                and ("DT_NASCIMENTO" is null) <> (substr("CO_CANDIDATO_EMPREGARE", 4)::integer % 50 = 0)) then
    raise exception 'Data de nascimento inválida deveria virar nulo (e só ela)';
  end if;
  if private."FC_EMPREGARE_DATA"('2026-02-31') is not null or private."FC_EMPREGARE_DATA"('abc') is not null
     or private."FC_EMPREGARE_DATA"('1990-05-10T00:00') <> date '1990-05-10'
     or private."FC_EMPREGARE_MOMENTO"('2026-13-01') is not null
     or private."FC_EMPREGARE_MOMENTO"('2026-10-14T10:00') <> timestamptz '2026-10-14 13:00:00+00' then
    raise exception 'FC_EMPREGARE_DATA/MOMENTO mudaram de resultado';
  end if;
end;
$$;

select etapa, ms, resposta from t_ensaio_tempo order by ordem;

rollback;
