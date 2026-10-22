/*
  CORREÇÃO DE DADOS — o registro das migrations (public.migracoes_aplicadas)
  volta a ter um caminho só por arquivo.

  POR QUÊ (leitura de 22/10/2026, só SELECT):
    1. 47 linhas com o caminho "supabase/migrations/…" (de
       20261013180000_reinicio_volta_toda_ficha_iniciada a
       20261020150000_detalhe_do_painel_com_espelho, origem 'arquivo',
       registradas à mão de 13 a 20/10). As outras 191 estão como
       "migrations/…" e as 7 correções como "correcoes/…", que é o que
       scripts/estado-das-migrations.mjs escreve (caminhoRegistado). Nenhuma das
       47 tem a mesma migration também registrada sem o prefixo: o update tira
       o prefixo de todas. Se, quando isto rodar, já houver a linha sem
       prefixo (alguém registrou de novo pelo script), fica a sem prefixo — a
       data de aplicação dela é a do script, mas o hash é o mesmo arquivo — e
       a com prefixo sai; com hash diferente, as duas ficam e a conferência no
       fim mostra quantas (resolver à mão com npm run db:estado).
    2. A órfã migrations/20260928160000_analises_por_area.sql (aplicada em
       28/09/2026, origem 'arquivo'): o arquivo NUNCA entrou na main — só
       existe no commit b3d73c0d da branch feat/analises-por-area (PR #134,
       fechada sem merge), nem em supabase/migrations-historicas/. Ela criava
       public.get_analises_da_area(text, text) e
       public.get_analise_detalhe_da_area(uuid), que NÃO existem no banco: a
       20260928190000_remove_rpcs_do_painel_react.sql (aplicada e registrada
       no mesmo dia) as removeu, e o rollback dela guarda a cópia das duas
       funções. Efeito líquido nulo e sem arquivo para conferir hash: a linha
       só fazia o estado mostrar uma órfã para sempre. Sai do registro (o
       histórico fica no git e no cabeçalho da 20260928190000). Trazer o
       arquivo para migrations-historicas/ faria o registro dizer que objetos
       inexistentes estão aplicados.

  Depois desta correção a regra ck_migracoes_aplicadas_caminho
  (20261022151000) pode ser validada: reaplique aquela migration (ela roda o
  VALIDATE quando não há linha fora do formato).

  Idempotente: rodar de novo não muda nada. Nada no schema muda.
  Ensaio: supabase/ensaios/20261022-registro-das-migrations.sql
*/
begin;

-- 1a. Já existe a mesma migration sem o prefixo, com o mesmo hash: sai a com prefixo.
delete from public.migracoes_aplicadas a
 using public.migracoes_aplicadas b
 where a.caminho like 'supabase/%'
   and b.caminho = substr(a.caminho, length('supabase/') + 1)
   and b.hash = a.hash;

-- 1b. As demais perdem o prefixo "supabase/".
update public.migracoes_aplicadas a
   set caminho = substr(a.caminho, length('supabase/') + 1)
 where a.caminho like 'supabase/%'
   and not exists (select 1 from public.migracoes_aplicadas b
                    where b.caminho = substr(a.caminho, length('supabase/') + 1));

-- 2. A órfã sem arquivo e sem efeito (desfeita pela 20260928190000).
delete from public.migracoes_aplicadas
 where caminho = 'migrations/20260928160000_analises_por_area.sql'
   and to_regprocedure('public.get_analises_da_area(text, text)') is null
   and to_regprocedure('public.get_analise_detalhe_da_area(uuid)') is null;

-- Conferência (esperado: 0 com prefixo, 0 fora do formato, órfã 0).
select count(*) filter (where caminho like 'supabase/%') as com_prefixo,
       count(*) filter (where caminho !~ '^(migrations|correcoes)/[^/]+\.sql$') as fora_do_formato,
       count(*) filter (where caminho = 'migrations/20260928160000_analises_por_area.sql') as orfa,
       count(*) as total
  from public.migracoes_aplicadas;

commit;
