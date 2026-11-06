/*
  ENSAIO da migration 20261106170100_tokens_da_vaga_com_uf_colada.sql — begin … rollback.
  NÃO É MIGRATION; nada fica gravado (só tabelas temporárias, on commit drop).

  Montagem (como nos outros ensaios):
    { sed -n '1,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261106170100_tokens_da_vaga_com_uf_colada.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261106170100_tokens_da_vaga_com_uf_colada.sql;
      sed -n '/^-- == DEPOIS ==/,/^rollback;$/p' supabase/ensaios/20261106170100_tokens_da_vaga_com_uf_colada.sql;
    } > /tmp/ensaio.sql

  Antes e depois da troca de FC_TOKENS_VAGA, na mesma transação, só leitura:
    1. TODAS as vagas distintas (edital, código, nome) das análises ativas (fora as do treinamento),
       de todos os editais, com private."FC_QUADRO_DA_VAGA": quantas passam de null para uma
       linha, quantas mudam de linha (tem de ser 0) e quantas perdem a linha (tem de ser 0);
    2. as vagas da Empregare (TB_EMPREGARE_VAGA) com private."FC_QUADRO_PELO_TITULO_EMPREGARE":
       nenhuma muda nem perde a linha;
    3. as linhas ativas do quadro: quantos cargos/lotações mudam de palavras (só informativo).
  Termina com o resultado por edital (antes sem linha, depois sem linha, passaram a casar,
  mudaram, perderam). Sem dado de pessoa: só edital, contagens e códigos de vaga.
*/
begin;
set local statement_timeout = '120s';

create temporary table t_vagas on commit drop as
select e.edital_id as edital, p.numero, nullif(btrim(a.codigo_vaga), '') as vaga, a.nome_vaga as nome,
       count(*) as analises
  from public."TB_ANALISE_CURRICULAR" a
  cross join lateral (select private."FC_NUMERO_EDITAL"(a.edital) as numero) p
  join private."FC_EDITAIS_POR_NUMERO"() e on e.area = a."CO_AREA" and e.numero = p.numero
 where a.ativo and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
   and nullif(btrim(a.nome_vaga), '') is not null
 group by 1, 2, 3, 4;
alter table t_vagas add column antes uuid, add column depois uuid;
update t_vagas set antes = private."FC_QUADRO_DA_VAGA"(edital, nome);

create temporary table t_titulos on commit drop as
select v."CO_MONITORAMENTO" as edital, v."CO_VAGA" as vaga,
       private."FC_QUADRO_PELO_TITULO_EMPREGARE"(v."CO_MONITORAMENTO", v."CO_VAGA") as antes, null::uuid as depois
  from public."TB_EMPREGARE_VAGA" v;

create temporary table t_quadro on commit drop as
select q."CO_QUADRO_VAGA" as id, private."FC_TOKENS_VAGA"(q."NO_CARGO") as cargo_antes,
       private."FC_TOKENS_VAGA"(q."NO_LOTACAO") as lotacao_antes
  from public."TB_QUADRO_VAGA_EDITAL" q
 where q."ST_REGISTRO_ATIVO" = 'S';

-- == aplicar a migration aqui ==

-- == DEPOIS ==
update t_vagas set depois = private."FC_QUADRO_DA_VAGA"(edital, nome);
update t_titulos set depois = private."FC_QUADRO_PELO_TITULO_EMPREGARE"(edital, vaga);

do $$
declare
  v_mudou integer := (select count(*) from t_vagas where antes is not null and depois is distinct from antes);
  v_titulos integer := (select count(*) from t_titulos where antes is not null and depois is distinct from antes);
begin
  -- 1. Nenhuma vaga das análises troca de linha nem perde a que tinha.
  if v_mudou > 0 then
    raise exception 'ENSAIO 1: % vaga(s) das análises mudaram ou perderam a linha do quadro: %', v_mudou,
      (select array_agg(numero || ' ' || coalesce(vaga, 'sem-codigo')) from t_vagas
        where antes is not null and depois is distinct from antes);
  end if;
  -- 2. Nem as vagas da Empregare pelo título.
  if v_titulos > 0 then
    raise exception 'ENSAIO 2: % vaga(s) da Empregare mudaram ou perderam a linha do quadro', v_titulos;
  end if;
  raise notice 'ENSAIO ok: vagas das análises % (passaram a casar %); vagas da Empregare % sem mudança; linhas do quadro com palavras novas %.',
    (select count(*) from t_vagas),
    (select count(*) from t_vagas where antes is null and depois is not null),
    (select count(*) from t_titulos),
    (select count(*) from t_quadro q join public."TB_QUADRO_VAGA_EDITAL" c on c."CO_QUADRO_VAGA" = q.id
      where q.cargo_antes is distinct from private."FC_TOKENS_VAGA"(c."NO_CARGO")
         or q.lotacao_antes is distinct from private."FC_TOKENS_VAGA"(c."NO_LOTACAO"));
end $$;

-- 3. Por edital (só os que têm vaga sem linha antes ou depois).
select numero as edital,
       count(*) as vagas,
       count(*) filter (where antes is null) as sem_linha_antes,
       count(*) filter (where depois is null) as sem_linha_depois,
       count(*) filter (where antes is null and depois is not null) as passaram_a_casar,
       count(*) filter (where antes is not null and depois is not null and depois <> antes) as mudaram_de_linha,
       count(*) filter (where antes is not null and depois is null) as perderam_a_linha
  from t_vagas
 group by numero
having count(*) filter (where antes is null or depois is null) > 0
 order by numero;

rollback;
