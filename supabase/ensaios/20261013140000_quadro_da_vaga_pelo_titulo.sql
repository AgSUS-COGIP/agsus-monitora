/*
  ENSAIO da migration 20261013140000_quadro_da_vaga_pelo_titulo.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois das migrations 20261013130000 e 20261013140000,
  na mesma transação (ensaio.sh: sem as linhas begin/commit), e desfaça.

  Confere:
    1. as 30 vagas do 114/2026 ganham a linha do quadro: cargo pelo número,
       lotação BH/Vitória pela UF dos inscritos, uma vaga por linha;
    2. o nível pelo "(Nível …)" do cargo: Auxiliares 11–13 e Motoristas 14–15
       médio, Técnico de Laboratório 9 técnico, os demais superior;
    3. o que o job lê (pre_classificacao_ler_editais) traz o cargo de cada
       vaga do 114 (o refazer do lote de 14/10 e 15/10 grava daí);
    4. os outros editais com quadro não mudam (o caminho da planilha vem antes).
*/
create temporary table t_vagas_114 on commit drop as
select v."CO_VAGA" as vaga, q."CO_QUADRO_VAGA" as quadro, q."NO_CARGO" as cargo, q."NO_LOTACAO" as lotacao,
       coalesce(substring(lower(translate(q."NO_CARGO", 'ÍíÉéÁá', 'iieeaa')) from 'nivel (superior|tecnico|medio|fundamental)'), '?') as nivel,
       private."FC_NUMERO_DO_CARGO"(q."NO_CARGO") as numero
  from public."TB_EMPREGARE_VAGA" v
  left join lateral (select * from private."FC_QUADRO_DA_VAGA_EMPREGARE"(v."CO_MONITORAMENTO", v."CO_VAGA")) q on true
 where v."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

do $$
declare
  v_job jsonb;
begin
  -- 1. Todas as 30 com linha, uma vaga por linha, 15 em BH e 15 em Vitória.
  if (select count(*) from t_vagas_114) <> 30 or exists (select 1 from t_vagas_114 where quadro is null) then
    raise exception 'ENSAIO 1: vaga sem linha do quadro: %', (select array_agg(vaga) from t_vagas_114 where quadro is null);
  end if;
  if (select count(distinct quadro) from t_vagas_114) <> 30
     or (select count(*) from t_vagas_114 where lotacao = 'Belo Horizonte - MG') <> 15 then
    raise exception 'ENSAIO 1: linhas repetidas ou lotações erradas';
  end if;
  if exists (select 1 from (values ('182528', 15, 'Belo Horizonte - MG'), ('182567', 15, 'Vitória - ES'),
                                   ('182418', 1, 'Belo Horizonte - MG'), ('182421', 1, 'Vitória - ES'),
                                   ('182427', 7, 'Belo Horizonte - MG'), ('182432', 7, 'Vitória - ES'),
                                   ('182446', 5, 'Vitória - ES'), ('182449', 9, 'Vitória - ES')) e(vaga, numero, lotacao)
              where not exists (select 1 from t_vagas_114 t where t.vaga = e.vaga and t.numero = e.numero and t.lotacao = e.lotacao)) then
    raise exception 'ENSAIO 1: vaga conhecida na linha errada';
  end if;
  -- 2. O nível.
  if exists (select 1 from t_vagas_114
              where nivel <> case when numero between 11 and 15 then 'medio' when numero = 9 then 'tecnico' else 'superior' end) then
    raise exception 'ENSAIO 2: nível errado: %', (select jsonb_agg(t) from t_vagas_114 t
      where nivel <> case when numero between 11 and 15 then 'medio' when numero = 9 then 'tecnico' else 'superior' end);
  end if;
  -- 3. O que o job lê.
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
  v_job := public.pre_classificacao_ler_editais(array['bcecfb08-88ef-4e06-8401-bcad6bf88fd0'], false)::jsonb;
  if (select count(*) from jsonb_array_elements(v_job #> '{editais,0,vagas}') x where x ->> 'cargo' is not null) <> 30 then
    raise exception 'ENSAIO 3: o job não lê o cargo das 30 vagas: %', left((v_job #> '{editais,0,vagas}')::text, 500);
  end if;
  -- 4. Os editais com o caminho da planilha continuam iguais.
  if exists (select 1 from public."TB_PRE_CLASSIF_VAGA" pv
              where pv."CO_QUADRO_VAGA" is not null
                and (select q."CO_QUADRO_VAGA" from private."FC_QUADRO_DA_VAGA_EMPREGARE"(pv."CO_MONITORAMENTO", pv."CO_VAGA") q)
                    is distinct from pv."CO_QUADRO_VAGA") then
    raise exception 'ENSAIO 4: vaga já ligada mudou de linha';
  end if;
end;
$$;

select vaga, cargo, lotacao, nivel from t_vagas_114 order by numero, lotacao;
