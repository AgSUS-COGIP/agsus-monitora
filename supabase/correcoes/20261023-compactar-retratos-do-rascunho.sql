/*
  CORREÇÃO DE DADOS — compacta os retratos dos rascunhos antigos do histórico
  das fichas (public."TH_FICHA_ANALISE", linhas SALVAR).

  APLICAR SÓ DEPOIS DE 22/10/2026 (fim da análise do 114/2026), SÓ COM A
  AUTORIZAÇÃO do usuário, FORA DO EXPEDIENTE (ex.: 22h de Brasília) e DEPOIS da
  migration 20261023220000_historico_do_rascunho_enxuto.sql.

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
      9.691 (12,4 MiB = ~13 MB). Ensaio de 23/10/2026: saem 12.395 (16 MB, de
      1.523 fichas), ficam 1.610 (2,5 MB); tabela em 34 MB. Os números crescem
      até a aplicação.
    - O histórico é imutável (gatilho "TG_THFICHA_IMUTAVEL",
      private."FC_TG_FICHA_IMUTAVEL"): só ESTE gatilho é desligado, DENTRO da
      transação (ALTER TABLE … DISABLE TRIGGER é transacional: se algo falhar,
      volta ligado no rollback), e religado antes do commit; a conferência
      reprova se não estiver ligado. A tabela fica travada para gravação
      durante a transação (segundos): as fichas abertas esperam o salvamento.
    - Assinada pela conta do setor Gestão da Informação de Pessoal
      (a01afddb-f64b-47d9-80e8-476a1ed14e43; tem de ser administrador global
      ativo): o registro fica no comentário da coluna DS_RETRATO (quando,
      quantas linhas, o critério, a conta, o sha256 da exportação e este arquivo) e no registro das
      correções (npm run db:estado -- --registrar=correcoes/20261023-compactar-retratos-do-rascunho.sql).

  EXPORTAÇÃO ANTES (obrigatória; o plano FREE não tem backup): os retratos que
  saem são exportados para um arquivo fora do banco, e a correção só roda se
  a contagem exportada bater com a que vai sair:
    1. node --env-file=.env.local scripts/exportar-retratos-do-rascunho.mjs --saida=retratos-do-rascunho-AAAAMMDD.jsonl.gz
       (só SELECT, em lotes de 500 pela chave; lê ESTA lista — o trecho entre
       "-- >>> regra" e "-- <<< regra" abaixo — direto deste arquivo). Ao fim,
       imprime linhas, tamanho, sha256 e a linha "set monitora.exportacao_retratos = …".
    2. Guarde o arquivo fora do banco (pasta do setor no Drive/rede) e anote
       caminho, linhas e sha256 em docs/banco-de-dados.md §24 ("Exportação dos
       retratos"). O sha256 e a contagem também ficam no comentário de DS_RETRATO.
    3. No SQL Editor, na MESMA execução, cole como primeira linha (antes do
       begin) a linha impressa pelo script:
         set monitora.exportacao_retratos = '<linhas>:<sha256>';
       e, em seguida, este arquivo. Sem ela, ou com contagem diferente, aborta.
       Depois da migration nenhum SALVAR novo leva retrato, então a lista não
       muda entre a exportação e a correção.
  Ver uma ficha a partir do arquivo (só leitura):
    node scripts/exportar-retratos-do-rascunho.mjs --ler=<arquivo> --ficha=<uuid> [--sha256=<sha>]

  Idempotente: rodar de novo não acha mais o que compactar e não mexe no
  comentário (o registro da primeira vez fica). (Com 0 a sair, informe
  '0:<qualquer sha256>' ou rode sem a correção.)

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
    raise exception 'Aplique antes a migration 20261023220000_historico_do_rascunho_enxuto.sql (o SALVAR ainda exige retrato).';
  end if;
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo.';
  end if;
end;
$$;

-- Os retratos que SAEM: todo SALVAR com retrato, menos o último de cada ficha
-- e o último antes de cada CONCLUIR. O script de exportação lê este mesmo
-- trecho (entre os marcadores, sem ponto e vírgula) daqui.
create temporary table compactar_sai on commit drop as
-- >>> regra
select x.id
  from (select h."CO_HISTORICO_FICHA" as id, h."TP_ACAO" as acao,
               lead(h."TP_ACAO") over (partition by h."CO_FICHA_ANALISE" order by h."CO_HISTORICO_FICHA") as proxima,
               row_number() over (partition by h."CO_FICHA_ANALISE", h."TP_ACAO" order by h."CO_HISTORICO_FICHA" desc) as ordem
          from public."TH_FICHA_ANALISE" h
         where (h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is not null) or h."TP_ACAO" = 'CONCLUIR') x
 where x.acao = 'SALVAR' and x.proxima is distinct from 'CONCLUIR' and x.ordem <> 1
-- <<< regra
;
create unique index on compactar_sai (id);

-- A exportação foi feita e bate com o que vai sair.
do $$
declare
  v_exportacao text := current_setting('monitora.exportacao_retratos', true);
  v_sai integer := (select count(*) from compactar_sai);
begin
  if coalesce(v_exportacao, '') !~ '^[0-9]+:[0-9a-f]{64}$' then
    raise exception 'Exporte antes os retratos (scripts/exportar-retratos-do-rascunho.mjs) e cole, antes do begin, a linha set monitora.exportacao_retratos = ''<linhas>:<sha256>'' que o script imprimiu.';
  end if;
  if split_part(v_exportacao, ':', 1)::integer <> v_sai then
    raise exception 'A exportação tem % linhas, mas sairiam % retratos: exporte de novo antes de compactar.',
      split_part(v_exportacao, ':', 1), v_sai;
  end if;
end;
$$;

alter table public."TH_FICHA_ANALISE" disable trigger "TG_THFICHA_IMUTAVEL";

create temporary table compactar_resultado (compactadas integer, mantidas integer) on commit drop;
with u as (
  update public."TH_FICHA_ANALISE" h
     set "DS_RETRATO" = null
   where h."TP_ACAO" = 'SALVAR'
     and h."DS_RETRATO" is not null
     and exists (select 1 from compactar_sai c where c.id = h."CO_HISTORICO_FICHA")
  returning 1
)
insert into compactar_resultado
select count(*)::integer,
       (select count(*)::integer from public."TH_FICHA_ANALISE" h
         where h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is not null
           and not exists (select 1 from compactar_sai c where c.id = h."CO_HISTORICO_FICHA"))
  from u;

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
    'Retrato do conteúdo depois da ação ({lancamento, resultado, parecer, versao_regra}); obrigatório no CONCLUIR. No SALVAR, só até 20261023220000 (desde então o rascunho vigente fica em TB_FICHA_ANALISE e o histórico guarda o que mudou em DS_ALTERACAO). '
    || format('Em %s, a correção supabase/correcoes/20261023-compactar-retratos-do-rascunho.sql, assinada pela conta do setor Gestão da Informação de Pessoal (a01afddb-f64b-47d9-80e8-476a1ed14e43), tirou o retrato de %s linhas SALVAR antigas e manteve %s (o último rascunho de cada ficha e o último antes de cada CONCLUIR); as linhas, quem, quando e o que mudou ficaram. Os retratos tirados foram exportados antes (scripts/exportar-retratos-do-rascunho.mjs; sha256 %s; caminho do arquivo em docs/banco-de-dados.md §24).',
              to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), r.compactadas, r.mantidas,
              split_part(current_setting('monitora.exportacao_retratos'), ':', 2)));
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
  if (select r.compactadas from compactar_resultado r)
     <> split_part(current_setting('monitora.exportacao_retratos'), ':', 1)::integer then
    raise exception 'Saíram retratos em número diferente do exportado.';
  end if;
  -- O último SALVAR com retrato de cada ficha que tinha algum continua com retrato.
  if exists (select 1 from compactar_sai c
               join public."TH_FICHA_ANALISE" h on h."CO_HISTORICO_FICHA" = c.id
              where not exists (select 1 from public."TH_FICHA_ANALISE" k
                                 where k."CO_FICHA_ANALISE" = h."CO_FICHA_ANALISE" and k."TP_ACAO" = 'SALVAR'
                                   and k."DS_RETRATO" is not null)) then
    raise exception 'Uma ficha ficou sem o retrato do último rascunho.';
  end if;
end;
$$;

select r.compactadas, r.mantidas,
       (select count(*) from public."TH_FICHA_ANALISE" h where h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is not null) as salvar_com_retrato,
       (select t.tgenabled from pg_trigger t
         where t.tgrelid = 'public."TH_FICHA_ANALISE"'::regclass and t.tgname = 'TG_THFICHA_IMUTAVEL') as gatilho
  from compactar_resultado r;

commit;
