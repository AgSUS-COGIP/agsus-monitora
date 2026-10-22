/*
  CORREÇÃO DE DADOS — a avaliação documental do Edital 114/2026 (Projetos) passa a
  ser feita no MONITORA.

  Pedido do usuário (09/10/2026): o 114/2026 (5.491 inscritos em 30 vagas,
  inscrições até 14/10) será analisado dentro do MONITORA, pelas fichas da
  Avaliação documental, e não pela planilha.

  O que faz: chama private."FC_DEFINIR_ORIGEM_ANALISE" (migration
  20261009200000_fichas_no_painel_das_analises.sql, a mesma da RPC
  public.definir_origem_analise): TB_ORIGEM_ANALISE_EDITAL do 114/2026 = MONITORA,
  com o motivo abaixo e uma linha em TH_ORIGEM_ANALISE_EDITAL. A partir daí cada
  ficha do edital (aberta, atribuída, em análise, concluída, reaberta ou
  reiniciada) alimenta TB_ANALISE_CURRICULAR, e o Painel das análises e a
  Classificação passam a ler o 114/2026; a sincronização da planilha de Projetos
  ignora o edital. Hoje o 114/2026 não tem fichas nem linhas da planilha: nada é
  adotado. Nada se apaga.

  Autor: sem sessão no SQL Editor, o primeiro administrador global ativo, como
  nas correções anteriores. Para assinar com outra pessoa, ponha o id dela em
  c_autor_informado (tem de ser administrador global ativo).

  Rode no SQL Editor (papel postgres), depois da migration 20261009200000.
  Idempotente: rodar de novo não muda nada (o dono já é MONITORA).
  Para ensaiar, troque o commit final por rollback.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_motivo constant text := 'Edital 114/2026: a avaliação documental será feita no MONITORA, pelas fichas, e não pela planilha';
  c_autor_informado constant uuid := null;
  v_qtd integer;
  v_autor uuid := coalesce(c_autor_informado, (
    select p.user_id from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
     order by p.user_id limit 1));
  v_resultado json;
begin
  if to_regprocedure('private."FC_DEFINIR_ORIGEM_ANALISE"(uuid, text, text, uuid)') is null then
    raise exception 'Aplique antes a migration 20261009200000_fichas_no_painel_das_analises.sql.';
  end if;
  if v_autor is null then
    raise exception 'Nenhum administrador global ativo para assinar a troca';
  end if;
  select count(*) into v_qtd
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.id = c_edital
     and private."FC_NUMERO_EDITAL"(m.edital) = '114/2026'
     and m."CO_AREA" = 'projetos'
     and m."ST_TREINAMENTO" is distinct from 'S';
  if v_qtd <> 1 then
    raise exception 'Esperava o edital 114/2026 de Projetos (%); não achei', c_edital;
  end if;

  v_resultado := private."FC_DEFINIR_ORIGEM_ANALISE"(c_edital, 'MONITORA', c_motivo, v_autor);
  raise notice 'Avaliação do 114/2026: %', v_resultado;
end;
$$;

-- Conferência: o dono, o histórico e as linhas publicadas pelas fichas (zero até abrir o lote).
select o."TP_ORIGEM" as dono,
       (select count(*) from public."TH_ORIGEM_ANALISE_EDITAL" h where h."CO_MONITORAMENTO" = o."CO_MONITORAMENTO") as trocas,
       (select count(*) from public."TB_ANALISE_CURRICULAR" a
         where a."TP_ORIGEM_REGISTRO" = 'MONITORA' and a."CO_AREA" = 'projetos'
           and private."FC_NUMERO_EDITAL"(a.edital) = '114/2026') as linhas_monitora
  from public."TB_ORIGEM_ANALISE_EDITAL" o
 where o."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

commit;
