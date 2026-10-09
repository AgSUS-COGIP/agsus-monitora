/*
  CORREÇÃO DE DADOS — volta ao início as fichas da avaliação documental do
  Edital 93/2026 (Projetos, edital real).

  Pedido do usuário (09/10/2026): "Volta esse edital 93/2026 para o início,
  pois a análise documental foi feita por planilha." As fichas do 93/2026 no
  MONITORA são de testes (diagnóstico de 09/10/2026: 90 PENDENTE distribuídas,
  5 EM_ANALISE, 1 CONCLUIDA e 1 FORA_LOTE).

  O que faz: chama private."FC_REINICIAR_FICHAS_DO_EDITAL" (migration
  20261009160000_reiniciar_fichas_do_edital.sql, a mesma da RPC
  public.reiniciar_fichas_do_edital): toda ficha do lote volta a PENDENTE,
  sem responsável, reserva, lançamento, resultado, parecer, notas, rascunho e
  conclusão, com a versão + 1 e uma linha REINICIAR no histórico
  (TH_FICHA_ANALISE) com o motivo abaixo. FORA_LOTE fica como está. Não toca a
  regra, as decisões de inclusão, a pré-classificação, as listas da
  Classificação nem as análises da planilha (TB_ANALISE_CURRICULAR). Nada se
  apaga.

  Autor: sem sessão no SQL Editor, o primeiro administrador global ativo, como
  nas correções anteriores. Para assinar com outra pessoa, ponha o id dela em
  c_autor_informado (tem de ser administrador global ativo).

  Rode no SQL Editor (papel postgres), depois da migration 20261009160000.
  Idempotente: rodar de novo não muda nada (as fichas já estão no início).
  Para ensaiar, troque o commit final por rollback.
*/
begin;

do $$
declare
  c_motivo constant text := 'Reinício do edital: a análise documental do 93/2026 foi feita pela planilha';
  c_autor_informado constant uuid := null;
  v_edital uuid;
  v_qtd integer;
  v_autor uuid := coalesce(c_autor_informado, (
    select p.user_id from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
     order by p.user_id limit 1));
  v_resultado json;
begin
  if to_regprocedure('private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid)') is null then
    raise exception 'Aplique antes a migration 20261009160000_reiniciar_fichas_do_edital.sql.';
  end if;
  if v_autor is null then
    raise exception 'Nenhum administrador global ativo para assinar o reinício';
  end if;
  select count(*), min(m.id::text)::uuid into v_qtd, v_edital
    from public."TB_MONITORAMENTO_INDIGENA" m
   where private."FC_NUMERO_EDITAL"(m.edital) = '93/2026'
     and m."CO_AREA" = 'projetos'
     and m."ST_TREINAMENTO" is distinct from 'S';
  if v_qtd <> 1 then
    raise exception 'Esperava um edital 93/2026 de Projetos; achei %', v_qtd;
  end if;

  v_resultado := private."FC_REINICIAR_FICHAS_DO_EDITAL"(v_edital, c_motivo, v_autor);
  raise notice 'Reinício do 93/2026: %', v_resultado;
end;
$$;

-- Conferência: todas as fichas do lote PENDENTE e sem responsável; FORA_LOTE como estava.
select f."TP_SITUACAO" as situacao, count(*) as fichas,
       count(f."CO_USUARIO_RESPONSAVEL") as com_responsavel,
       count(f."DS_LANCAMENTO") as com_lancamento
  from public."TB_FICHA_ANALISE" f
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = f."CO_MONITORAMENTO"
 where private."FC_NUMERO_EDITAL"(m.edital) = '93/2026' and m."CO_AREA" = 'projetos'
 group by 1 order by 1;

commit;
