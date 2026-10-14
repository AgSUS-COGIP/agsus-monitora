/*
  ENSAIO da migration 20261013180200_conferencia_da_conta_das_fichas.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  sem as linhas begin/commit), e desfaça.

  Simula uma conta errada gravada (como chegaria por chamada direta da RPC ou
  tela desatualizada): na 1ª ficha concluída do 114/2026, a nota final e a
  parcial de experiência sobem 10 pontos. Devolve a página da RPC para o job:
  a ficha alterada deve dar ANALISE_FICHA_CONTA_DIVERGENTE e as outras não
  (rode scripts/conferencias com a saída, ou regras.conferir_fichas).
  Confere também que só service_role executa e que treinamento fica fora.
*/
update public."TB_FICHA_ANALISE" f
   set "DS_RESULTADO" = jsonb_set(jsonb_set(f."DS_RESULTADO", '{nota_final}', to_jsonb((f."DS_RESULTADO" ->> 'nota_final')::numeric + 10)),
                                  '{parciais,EXPERIENCIA}', to_jsonb((f."DS_RESULTADO" #>> '{parciais,EXPERIENCIA}')::numeric + 10))
 where f."CO_FICHA_ANALISE" = (select min(x."CO_FICHA_ANALISE"::text)::uuid from public."TB_FICHA_ANALISE" x
                                where x."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and x."TP_SITUACAO" = 'CONCLUIDA');
select jsonb_build_object(
  'pagina', public.conferencia_ler_fichas(null, 500),
  'alterada', (select min(x."CO_FICHA_ANALISE"::text) from public."TB_FICHA_ANALISE" x
                where x."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and x."TP_SITUACAO" = 'CONCLUIDA'),
  'treinamento_fora', not exists (
     select 1 from jsonb_array_elements(public.conferencia_ler_fichas(null, 1000) -> 'linhas') l
      where private."FC_EDITAL_EH_TREINAMENTO"((l ->> 'edital')::uuid)),
  'quem_executa', (select array_agg(grantee::text order by grantee) from information_schema.routine_privileges
                    where routine_schema = 'public' and routine_name = 'conferencia_ler_fichas')) as saida;
