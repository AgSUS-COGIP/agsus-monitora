/*
  A VAGA DE DSEI OU CASAI SÓ SE LIGA AO EDITAL DA MESMA UNIDADE

  Pedido de 13/11/2026. Na planilha "Auditoria" (aba Resultado), 13 vagas do
  DSEI Parintins vieram com EDITAL 110/2026 (o número de Porto Velho). A
  ligação procurava o edital de mesmo número na Saúde Indígena e usava a
  unidade só para desempatar: as 13 caíram em Porto Velho 110/2026, que
  mostrou 3.434 inscritos em vez de 2.661, e Parintins 111/2026 ficou vazio.
  A planilha foi corrigida e a carga de 12/11/2026 21h10 UTC já acertou os
  números; esta migration impede que o erro volte a inflar outro edital.

  O QUE MUDA
    private."FC_LIGAR_SELECAO_AOS_EDITAIS"(): a linha de unidade DSEI ou CASAI
    só se liga a edital da Saúde Indígena de mesmo número E mesma unidade. A
    unidade é comparada sem acento, sem caixa, com espaços repetidos e hífen
    valendo um espaço ("DSEI Guama Tocantins" = "DSEI Guamá-Tocantins"; "DSEI
    Tocantins" não casa com "DSEI Guamá-Tocantins"). Sem edital da mesma
    unidade, a linha fica sem edital (CO_MONITORAMENTO nulo, conta em
    QT_SEM_EDITAL do log) e continua na Saúde Indígena.
    As outras unidades (SEDE e Projetos) seguem a regra de antes.

  EFEITO HOJE (medido no banco em 13/11/2026, só leitura)
    Nenhuma linha muda: as 2.697 vagas ativas de DSEI/CASAI já estão no
    edital da mesma unidade, e as 18 sem edital (todas de SEDE/Projetos)
    continuam sem.

  GUARDAS (a migration não aplica nada se falhar)
    md5 do corpo sem chr(13) (o banco já guardou corpos com CRLF).
    - Já aplicada: o corpo vigente é o desta migration (md5 2514ffb3b3a3d394cb5a6854a32aa9ad).
    - O corpo vigente não é o que esta migration conhece (md5 c7f7a1383861bf420e9ed7b4ed3e3083,
      conferido no banco e no retrato supabase/esquema-atual.sql em 13/11/2026):
      alguém o mudou depois; junte as mudanças antes de aplicar.

  Dependentes: public.finalizar_sync_selecao (chama a função; nada muda nela).
  Sem mudança de RPC nem de front.

  Ensaio: supabase/ensaios/20261113120000_ligar_selecao_so_ao_edital_da_mesma_unidade.sql
  Rollback: supabase/rollback/20261113120000_ligar_selecao_so_ao_edital_da_mesma_unidade.sql
  Teste: tests/selecao-liga-pela-mesma-unidade.test.ts
*/
begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_md5 text := md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_LIGAR_SELECAO_AOS_EDITAIS"()')), chr(13), ''));
begin
  if v_md5 = '2514ffb3b3a3d394cb5a6854a32aa9ad' then
    raise exception 'A migration 20261113120000 já foi aplicada (FC_LIGAR_SELECAO_AOS_EDITAIS já exige a mesma unidade).';
  end if;
  if v_md5 is distinct from 'c7f7a1383861bf420e9ed7b4ed3e3083' then
    raise exception 'FC_LIGAR_SELECAO_AOS_EDITAIS mudou depois de 13/11/2026 (md5 %): junte as mudanças antes de aplicar.', v_md5;
  end if;
end;
$guarda$;

create or replace function private."FC_LIGAR_SELECAO_AOS_EDITAIS"()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_qt integer;
begin
  with m as materialized (
    select m.id, m."CO_AREA" as area, m.ativo,
           private."FC_NUMERO_EDITAL"(m.edital) as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) as unidade,
           btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(m.unidade), '[[:space:]-]+', ' ', 'g')) as unidade_sem_hifen
      from public."TB_MONITORAMENTO_INDIGENA" m
     where private."FC_NUMERO_EDITAL"(m.edital) is not null
  ),
  u as materialized (
    select private."FC_TEXTO_BUSCA_RECURSO"(u."NO_UNIDADE") as unidade, u."CO_AREA" as area
      from public."TA_UNIDADE_AREA" u
  ),
  s as materialized (
    select s."CO_SELECAO_VAGA" as id,
           private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") as unidade,
           btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE"), '[[:space:]-]+', ' ', 'g')) as unidade_sem_hifen,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") ~ '^(dsei|casai)( |$)' as indigena
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S'
  ),
  com_tabela as (
    select s.*, (select u.area from u where u.unidade = s.unidade limit 1) as area_tabela
      from s
  ),
  alvo as (
    select c.id,
           e.id as edital_id,
           case when c.indigena then 'saude-indigena'
                else coalesce(e.area, c.area_tabela, 'sede') end as area
      from com_tabela c
      left join lateral (
        select m.id, m.area from m
         where c.numero is not null and m.numero = c.numero
           -- DSEI/CASAI: só o edital da Saúde Indígena da mesma unidade.
           and (case when c.indigena then m.area = 'saude-indigena'
                                          and m.unidade_sem_hifen = c.unidade_sem_hifen
                     else m.area <> 'saude-indigena' end)
         order by m.ativo desc,
                  (m.unidade = c.unidade) desc,
                  (m.area = c.area_tabela) desc
         limit 1
      ) e on true
  )
  update public."TB_SELECAO_VAGA" s set
    "CO_MONITORAMENTO" = alvo.edital_id,
    "CO_AREA" = alvo.area
    from alvo
   where s."CO_SELECAO_VAGA" = alvo.id
     and (s."CO_MONITORAMENTO" is distinct from alvo.edital_id
          or s."CO_AREA" is distinct from alvo.area);
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;

comment on function private."FC_LIGAR_SELECAO_AOS_EDITAIS"() is 'Liga cada vaga ativa de TB_SELECAO_VAGA ao edital cadastrado e acerta a área: DSEI/CASAI só na Saúde Indígena e só no edital de mesmo número e mesma unidade (sem acento, caixa, espaço repetido nem hífen; sem ele, a vaga fica sem edital); as outras unidades só na SEDE ou em Projetos (edital de mesmo número: o ativo primeiro, depois a mesma unidade e a área de TA_UNIDADE_AREA; sem edital, TA_UNIDADE_AREA ou sede). Devolve quantas linhas mudaram (20261113120000).';

commit;
