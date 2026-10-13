/*
  ENSAIO da migration 20261013180000_reinicio_volta_toda_ficha_iniciada.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  sem as linhas begin/commit), e desfaça. Usa o 93/2026 e as RPCs reais
  (distribuir_fichas, reiniciar_fichas_do_edital) como o administrador global.

  Monta os dois casos que o reinício deixava iniciados:
    X: ficha distribuída e devolvida à fila (DEVOLVER_FILA), campos limpos;
    Y: ficha iniciada (responsável e rascunho) que saiu do lote (FORA_LOTE).
  Espera, depois do reinício: FC_FICHAS_INICIADAS = 0, X e Y não iniciadas,
  Y ainda FORA_LOTE e sem lançamento, refazer_permitido = true.
  Antes da migration: iniciadas 2, X e Y iniciadas, refazer_permitido false.
*/
create temp table r_ensaio (n serial, nome text, saida jsonb) on commit drop;
grant all on r_ensaio to authenticated; grant usage on sequence r_ensaio_n_seq to authenticated;
-- ficha X: PENDENTE intocada do 93 (vaga 180244); ficha Y: outra intocada, que vai sair do lote depois de iniciada
create temp table alvo on commit drop as
  select (array_agg(f."CO_FICHA_ANALISE" order by f."CO_FICHA_ANALISE"))[1] x, (array_agg(f."CO_FICHA_ANALISE" order by f."CO_FICHA_ANALISE"))[2] y,
         (array_agg(f."NU_VERSAO" order by f."CO_FICHA_ANALISE"))[1] vx
    from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded' and f."CO_VAGA" = '180244' and not private."FC_FICHA_INICIADA"(f);
grant select on alvo to authenticated;
insert into r_ensaio (nome, saida) select 'antes: iniciadas 93', to_jsonb(private."FC_FICHAS_INICIADAS"('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'));
grant usage on schema private to authenticated; grant execute on all functions in schema private to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}',true);
-- X: distribuída e devolvida à fila (DEVOLVER_FILA) pela coordenação
select public.distribuir_fichas('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded',
  jsonb_build_array(jsonb_build_object('ficha', (select x from alvo), 'versao', (select vx from alvo), 'usuario', 'a16a7899-0c62-4603-8663-77c0bd30b772')), null);
select public.distribuir_fichas('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded',
  jsonb_build_array(jsonb_build_object('ficha', (select x from alvo), 'versao', (select vx from alvo) + 1, 'usuario', null)), 'Devolvida à fila no ensaio');
reset role;
-- Y: iniciada (atribuída e com rascunho) e depois fora do lote pelo recálculo (como FC_ABRIR_FICHAS deixa)
update public."TB_FICHA_ANALISE" set "TP_SITUACAO" = 'FORA_LOTE', "DS_MOTIVO_SAIDA" = 'Cancelou a inscrição',
  "CO_USUARIO_RESPONSAVEL" = 'a16a7899-0c62-4603-8663-77c0bd30b772', "DT_ATRIBUICAO" = now(),
  "DS_LANCAMENTO" = '{"nivel":"superior"}', "CO_USUARIO_RASCUNHO" = 'a16a7899-0c62-4603-8663-77c0bd30b772', "DT_RASCUNHO" = now(),
  "NU_VERSAO" = "NU_VERSAO" + 1
 where "CO_FICHA_ANALISE" = (select y from alvo);
insert into r_ensaio (nome, saida) select 'depois do teste: iniciadas 93', to_jsonb(private."FC_FICHAS_INICIADAS"('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'));
set local role authenticated;
insert into r_ensaio (nome, saida) select 'reiniciar', public.reiniciar_fichas_do_edital('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded', 'Ensaio da auditoria: volta ao início')::jsonb;
reset role;
insert into r_ensaio (nome, saida) select 'depois do reinício: iniciadas 93', to_jsonb(private."FC_FICHAS_INICIADAS"('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'));
insert into r_ensaio (nome, saida) select 'ficha X iniciada?', to_jsonb(private."FC_FICHA_INICIADA"(f)) from public."TB_FICHA_ANALISE" f where f."CO_FICHA_ANALISE" = (select x from alvo);
insert into r_ensaio (nome, saida) select 'ficha Y iniciada?', to_jsonb(private."FC_FICHA_INICIADA"(f)) || jsonb_build_object('situacao', f."TP_SITUACAO", 'lanc', f."DS_LANCAMENTO") from public."TB_FICHA_ANALISE" f where f."CO_FICHA_ANALISE" = (select y from alvo);
insert into r_ensaio (nome, saida) select 'refazer_permitido', e -> 'refazer_permitido' from jsonb_array_elements(public.pre_classificacao_ler_editais(array['93/2026']) -> 'editais') e;
select n, nome, saida from r_ensaio order by n;
