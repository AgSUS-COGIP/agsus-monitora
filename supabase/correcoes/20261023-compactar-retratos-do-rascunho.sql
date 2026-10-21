/*
  CORREÇÃO DE DADOS — compacta os retratos dos rascunhos antigos do histórico
  das fichas (public."TH_FICHA_ANALISE", linhas SALVAR).

  APLICAR SÓ DEPOIS DE 22/10/2026 (fim da análise do 114/2026), SÓ COM A
  AUTORIZAÇÃO do usuário, FORA DO EXPEDIENTE (ex.: 22h de Brasília) e DEPOIS da
  migration 20261023090000_historico_do_rascunho_enxuto.sql.

  Por quê: até a migration, cada salvamento automático com alteração gravava no
  SALVAR o retrato inteiro do lançamento (DS_RETRATO). Em 21/10/2026: 10.866
  linhas SALVAR, 1.189 fichas, 15,0 MB só de retrato (pg_column_size), de uma
  tabela de 27,8 MB num banco de 303/500 MB (plano FREE). Ninguém lê esse
  retrato (ver o cabeçalho da migration).

  O que faz (nada se apaga; toda linha do histórico fica, com quem, quando, a
  versão, o resultado, a nota e o que mudou — DS_ALTERACAO, de → para):
    - DS_RETRATO = null nas linhas SALVAR com retrato, MENOS:
        a) o último SALVAR com retrato de cada ficha (o rascunho mais recente);
        b) o último SALVAR com retrato antes de cada CONCLUIR da ficha (o
           rascunho que virou a conclusão; o CONCLUIR guarda o próprio retrato).
      O REINICIAR já guarda em DS_ALTERACAO o lançamento, o resultado e o
      parecer que limpou, então nenhum conteúdo apagado da ficha depende dos
      retratos compactados.
      Medição de 21/10/2026 (ensaio): ficam 1.238 retratos (1,9 MiB); saem
      9.691 (12,4 MiB = ~13 MB). Os números crescem até a aplicação.
    - O histórico é imutável (gatilho "TG_THFICHA_IMUTAVEL",
      private."FC_TG_FICHA_IMUTAVEL"): só ESTE gatilho é desligado, DENTRO da
      transação (ALTER TABLE … DISABLE TRIGGER é transacional: se algo falhar,
      volta ligado no rollback), e religado antes do commit; a conferência
      reprova se não estiver ligado. A tabela fica travada para gravação
      durante a transação (segundos): as fichas abertas esperam o salvamento.
    - Assinada pela conta do setor Gestão da Informação de Pessoal
      (a01afddb-f64b-47d9-80e8-476a1ed14e43; tem de ser administrador global
      ativo): o registro fica no comentário da coluna DS_RETRATO (quando,
      quantas linhas, o critério, a conta e este arquivo) e no registro das
      correções (npm run db:estado -- --registrar=correcoes/20261023-compactar-retratos-do-rascunho.sql).

  Idempotente: rodar de novo não acha mais o que compactar e não mexe no
  comentário (o registro da primeira vez fica).

  DEPOIS DO COMMIT — devolver o espaço (fora do expediente):
    O UPDATE deixa as versões antigas das linhas como espaço morto: o tamanho
    do banco só cai depois de reescrever a tabela.
      1. vacuum (analyze, verbose) public."TH_FICHA_ANALISE";
         -- não trava; libera o espaço para reuso dentro da tabela (o histórico
         -- novo passa a ocupá-lo), mas quase não devolve ao disco.
      2. vacuum (full, analyze, verbose) public."TH_FICHA_ANALISE";
         -- reescreve a tabela e devolve ~12–13 MB (a tabela de ~27 MB vai a ~15 MB);
         -- ACCESS EXCLUSIVE durante a reescrita (ninguém abre nem salva ficha:
         -- a Avaliação documental fica parada). Com ~15 MB a reescrever, segundos no NANO; precisa de espaço
         -- livre igual ao da tabela nova (~15 MB). Rode fora do expediente,
         -- sozinho (não dentro de begin/commit; o SQL Editor roda direto), com
         -- set lock_timeout = '5s' antes para não enfileirar atrás de uma tela
         -- aberta (repita se der timeout).
    pg_repack (sem trava longa) não compensa: a extensão existe no Supabase,
    mas pede o cliente pg_repack na máquina e conexão direta; para 27 MB o
    VACUUM FULL de segundos fora do expediente resolve.
    Conferir antes/depois: select pg_size_pretty(pg_total_relation_size('public."TH_FICHA_ANALISE"')),
    pg_size_pretty(pg_database_size(current_database()));

  Ensaio: supabase/ensaios/20261023-compactar-retratos-do-rascunho.sql
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if exists (select 1 from pg_constraint c
              where c.conrelid = 'public."TH_FICHA_ANALISE"'::regclass and c.conname = 'CK_THFICHA_CONTEUDO'
                and pg_get_constraintdef(c.oid) like '%SALVAR%') then
    raise exception 'Aplique antes a migration 20261023090000_historico_do_rascunho_enxuto.sql (o SALVAR ainda exige retrato).';
  end if;
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo.';
  end if;
end;
$$;

-- Os retratos que ficam: o último de cada ficha e o último antes de cada CONCLUIR.
create temporary table compactar_manter on commit drop as
select x.id
  from (select h."CO_HISTORICO_FICHA" as id, h."TP_ACAO" as acao,
               lead(h."TP_ACAO") over (partition by h."CO_FICHA_ANALISE" order by h."CO_HISTORICO_FICHA") as proxima,
               row_number() over (partition by h."CO_FICHA_ANALISE", h."TP_ACAO" order by h."CO_HISTORICO_FICHA" desc) as ordem
          from public."TH_FICHA_ANALISE" h
         where (h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is not null) or h."TP_ACAO" = 'CONCLUIR') x
 where x.acao = 'SALVAR' and (x.proxima = 'CONCLUIR' or x.ordem = 1);
create unique index on compactar_manter (id);

alter table public."TH_FICHA_ANALISE" disable trigger "TG_THFICHA_IMUTAVEL";

create temporary table compactar_resultado (compactadas integer, mantidas integer) on commit drop;
with u as (
  update public."TH_FICHA_ANALISE" h
     set "DS_RETRATO" = null
   where h."TP_ACAO" = 'SALVAR'
     and h."DS_RETRATO" is not null
     and not exists (select 1 from compactar_manter m where m.id = h."CO_HISTORICO_FICHA")
  returning 1
)
insert into compactar_resultado
select count(*)::integer, (select count(*)::integer from compactar_manter) from u;

alter table public."TH_FICHA_ANALISE" enable trigger "TG_THFICHA_IMUTAVEL";

-- O registro: quando, quantas, o critério e a conta que assina.
do $$
declare
  r record;
begin
  select * into r from compactar_resultado;
  if r.compactadas = 0 then
    raise notice 'Nada a compactar (já rodou?): o comentário de DS_RETRATO fica como está.';
    return;
  end if;
  execute format('comment on column public."TH_FICHA_ANALISE"."DS_RETRATO" is %L',
    'Retrato do conteúdo depois da ação ({lancamento, resultado, parecer, versao_regra}); obrigatório no CONCLUIR. No SALVAR, só até 20261023090000 (desde então o rascunho vigente fica em TB_FICHA_ANALISE e o histórico guarda o que mudou em DS_ALTERACAO). '
    || format('Em %s, a correção supabase/correcoes/20261023-compactar-retratos-do-rascunho.sql, assinada pela conta do setor Gestão da Informação de Pessoal (a01afddb-f64b-47d9-80e8-476a1ed14e43), tirou o retrato de %s linhas SALVAR antigas e manteve %s (o último rascunho de cada ficha e o último antes de cada CONCLUIR); as linhas, quem, quando e o que mudou ficaram.',
              to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), r.compactadas, r.mantidas));
end;
$$;

-- Conferência: o gatilho está ligado de novo; quantas compactadas e mantidas;
-- nenhum CONCLUIR sem retrato; o histórico continua barrando mudança.
do $$
begin
  if (select t.tgenabled from pg_trigger t
       where t.tgrelid = 'public."TH_FICHA_ANALISE"'::regclass and t.tgname = 'TG_THFICHA_IMUTAVEL') <> 'O' then
    raise exception 'O gatilho TG_THFICHA_IMUTAVEL não voltou a ficar ligado.';
  end if;
  if exists (select 1 from public."TH_FICHA_ANALISE" h where h."TP_ACAO" = 'CONCLUIR' and h."DS_RETRATO" is null) then
    raise exception 'Há CONCLUIR sem retrato.';
  end if;
  if exists (select 1 from compactar_manter m join public."TH_FICHA_ANALISE" h on h."CO_HISTORICO_FICHA" = m.id
              where h."DS_RETRATO" is null) then
    raise exception 'Um retrato que devia ficar foi tirado.';
  end if;
end;
$$;

select r.compactadas, r.mantidas,
       (select count(*) from public."TH_FICHA_ANALISE" h where h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is not null) as salvar_com_retrato,
       (select t.tgenabled from pg_trigger t
         where t.tgrelid = 'public."TH_FICHA_ANALISE"'::regclass and t.tgname = 'TG_THFICHA_IMUTAVEL') as gatilho
  from compactar_resultado r;

commit;
