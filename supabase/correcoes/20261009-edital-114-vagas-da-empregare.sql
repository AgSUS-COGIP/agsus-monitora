/*
  CORREÇÃO DE DADOS — liga as vagas da Empregare ao Edital 114/2026
  (Projetos, PES Rio Doce, id bcecfb08-88ef-4e06-8401-bcad6bf88fd0).

  Por que o robô acha 0 vagas do 114 (diagnóstico de 09/10/2026): o robô da
  Empregare pega as vagas de um edital de duas fontes — o QUADRO de vagas do
  edital, cujo código da Empregare vem das ANÁLISES curriculares ativas do
  edital (TB_ANALISE_CURRICULAR.codigo_vaga), e a SELEÇÃO (TB_SELECAO_VAGA, da
  planilha Auditoria). O 114 está em inscrição: não tem quadro salvo, não tem
  análise e não está na Seleção. Não há outra fonte do código: o robô não
  procura vaga pelo número do edital no título.

  Desde 20261009140000_acompanhamento_das_inscricoes.sql, listar_vagas_empregare
  tem a terceira fonte: as vagas já LIGADAS ao edital em TB_EMPREGARE_VAGA
  (origem 'ligada'). Esta correção liga os códigos uma vez; depois, a agenda
  agsus_robo_inscricoes_114_2026 (editais = 114/2026, 7h e 13h até 15/10)
  carrega as vagas e a pré-classificação grava o retrato das inscrições.

  PREENCHA c_vagas com os códigos das vagas do 114/2026 na Empregare
  (corporate.empregare.com → Vagas Anunciadas → busque "114/2026"; o código é
  o número da vaga, ex.: 181234). O arquivo recusa a lista vazia.

  Uma vaga já ligada a OUTRO edital não é mexida (avisa). Idempotente.
  Rode DEPOIS da migration 20261009140000, no SQL Editor (papel postgres).
  Para ensaiar, troque a última linha por rollback.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  -- PREENCHER: códigos da Empregare das vagas do 114/2026, só dígitos.
  c_vagas constant text[] := array[]::text[];
  v_outro text;
begin
  if cardinality(c_vagas) = 0 then
    raise exception 'Preencha c_vagas com os códigos das vagas do 114/2026 na Empregare';
  end if;
  if exists (select 1 from unnest(c_vagas) v where v !~ '^[0-9]{1,20}$') then
    raise exception 'Código de vaga inválido: use só dígitos';
  end if;
  select string_agg(v."CO_VAGA" || ' (' || m.edital || ')', ', ') into v_outro
    from public."TB_EMPREGARE_VAGA" v
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
   where v."CO_VAGA" = any (c_vagas) and v."CO_MONITORAMENTO" <> c_edital;
  if v_outro is not null then
    raise notice 'Já ligadas a outro edital (ficam como estão): %', v_outro;
  end if;

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO")
  select distinct v, c_edital from unnest(c_vagas) v
  on conflict ("CO_VAGA") do update
     set "CO_MONITORAMENTO" = excluded."CO_MONITORAMENTO", "DT_ATUALIZACAO" = now()
   where public."TB_EMPREGARE_VAGA"."CO_MONITORAMENTO" is null;
end;
$$;

-- Conferência: as vagas do 114/2026 que o robô vai carregar (origem ligada).
select e ->> 'vaga' as vaga, e ->> 'origem' as origem, e ->> 'ultima_carga' as ultima_carga
  from jsonb_array_elements(public.listar_vagas_empregare(array['114/2026'], null, 500) -> 'vagas') e
 order by 1;

commit;
