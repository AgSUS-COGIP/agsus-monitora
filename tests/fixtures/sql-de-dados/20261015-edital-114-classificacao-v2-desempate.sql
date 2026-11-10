/*
  CORREÇÃO DE DADOS — Regra de classificação do edital 114/2026 (Projetos,
  AGSUS/FUNASA PES Rio Doce), versão nova a partir da vigente (v1, 02/10/2026).

  O que muda (o resto da regra fica igual à vigente):

  1. Lista PRELIMINAR com o desempate do edital (listas.PRELIMINAR.empate:
     MESMA_POSICAO → CRITERIOS). O edital manda listar os aprovados na análise
     curricular pela ordem de classificação (8.2.10.10), em ordem decrescente
     de pontuação (9.1), aplicando os critérios de desempate em caso de empate
     (9.2 e 10.1: a) 60 anos ou mais — art. 27, parágrafo único, do Estatuto
     da Pessoa Idosa; b) maior tempo de experiência profissional comprovado;
     c) maior idade). A v1 só desempatava na FINAL; os critérios e a ordem
     (IDOSO_60, EXP_PROFISSIONAL_TEMPO, MAIOR_IDADE) já estavam certos e não
     mudam. Mesmo ajuste do 93/2026
     (supabase/correcoes/20261009-classificacao-93-desempate-e-quadro.sql).

  2. Notas da importação (importacao.em_aberto), só texto:
     - hora de nascimento (6.11.3/6.11.4): a nota dizia que a maior idade só
       comparava dias de vida e que o mesmo dia ficava para decisão manual. Hoje
       a Classificação já desempata pela hora da certidão (informada na tela) e,
       sem certidão, considera 23h59min59s (6.11.4).
     - data de corte: continua NULA na regra (não muda), e por isso vale o fim
       das inscrições do cronograma do MONITORA ("Período de Inscrições",
       05/10 a 14/10/2026 → 14/10/2026); se as inscrições forem prorrogadas no
       cronograma, a data acompanha.

  A regra de classificação não tem situação Conferir/Conferida (isso é da regra
  da avaliação documental, TB_REGRA_ANALISE, que esta correção NÃO toca): a
  versão nova fica vigente e é conferida na tela Classificação › 114/2026 ›
  Regra (histórico de versões, com o motivo abaixo).

  Assinada pelo usuário a01afddb-f64b-47d9-80e8-476a1ed14e43 (Gestão da
  Informação de Pessoal). Rode no SQL Editor (papel postgres) DEPOIS da
  revisão. Idempotente: só cria versão se a vigente ainda tiver a preliminar
  sem critérios. Não mexe em fichas, lote, avaliação documental nem robôs.
  Depois de aplicar: Classificação › 114/2026 › Avaliação documental › Gerar.
*/
begin;

do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_usuario constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  v_patch constant jsonb := $patch${"listas": {"PRELIMINAR": {"empate": "CRITERIOS"}}}$patch$::jsonb;
  v_nota_corte constant text := $n$data_corte nula de propósito: vale o fim das inscrições do cronograma do MONITORA ("Período de Inscrições", 05/10 a 14/10/2026 → 14/10/2026); se as inscrições forem prorrogadas, a data acompanha o cronograma (IDOSO_60 e MAIOR_IDADE dependem dela).$n$;
  v_nota_hora constant text := $n$MAIOR_IDADE compara a data de nascimento e, no mesmo dia, a hora da certidão de nascimento informada na Classificação (6.11.3); sem certidão legível vale 23h59min59s (6.11.4). Empate também na hora: o edital não define (ver empate final).$n$;
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
begin
  if private."FC_NUMERO_EDITAL"((select edital from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital)) is distinct from '114/2026' then
    raise exception 'O edital % não é o 114/2026.', v_edital;
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = v_edital for update;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'O 114/2026 não tem regra de classificação.';
  end if;
  select h."DS_CONFIGURACAO" into v_atual
    from public."TH_REGRA_CLASSIFICACAO" h
   where h."CO_REGRA_CLASSIFICACAO" = v_regra."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";

  if v_atual #>> '{listas,PRELIMINAR,empate}' = 'CRITERIOS' then
    raise notice 'Regra do 114/2026 já usa os critérios na preliminar (versão %): nada a fazer.', v_regra."NU_VERSAO_VIGENTE";
    return;
  end if;
  -- Os critérios têm de ser os do 10.1, nessa ordem e direção; se alguém mudou, pare e revise.
  if (select jsonb_agg(jsonb_build_array(d ->> 'criterio', d ->> 'direcao') order by o)
        from jsonb_array_elements(v_atual -> 'desempate') with ordinality x(d, o))
     is distinct from '[["IDOSO_60", "SIM_PRIMEIRO"], ["EXP_PROFISSIONAL_TEMPO", "MAIOR_PRIMEIRO"], ["MAIOR_IDADE", "MAIOR_PRIMEIRO"]]'::jsonb then
    raise exception 'Os critérios de desempate da regra vigente do 114/2026 não são os do item 10.1 na ordem: revise antes.';
  end if;

  v_nova := jsonb_set(v_atual, '{listas,PRELIMINAR,empate}', v_patch #> '{listas,PRELIMINAR,empate}');
  -- Notas da importação: troca só as duas desatualizadas (mesma posição na lista).
  if jsonb_typeof(v_nova #> '{importacao,em_aberto}') = 'array' then
    v_nova := jsonb_set(v_nova, '{importacao,em_aberto}', (
      select coalesce(jsonb_agg(
               case
                 when e.item #>> '{}' like 'data_corte null%' then to_jsonb(v_nota_corte)
                 when e.item #>> '{}' like 'MAIOR_IDADE no catálogo compara dias de vida%' then to_jsonb(v_nota_hora)
                 else e.item
               end order by e.ordem), '[]'::jsonb)
        from jsonb_array_elements(v_nova #> '{importacao,em_aberto}') with ordinality e(item, ordem)));
  end if;
  perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_nova);
  v_versao := v_regra."NU_VERSAO_VIGENTE" + 1;

  insert into public."TH_REGRA_CLASSIFICACAO"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_CLASSIFICACAO", v_versao, v_nova, v_nova #>> '{empate_final,metodo}',
          'Desempate do item 10.1 (60+, maior experiência, maior idade) também na lista preliminar (8.2.10.10, 9.1 e 9.2), como no 93/2026; notas da importação atualizadas (hora da certidão 6.11.3/6.11.4; data de corte = fim das inscrições do cronograma, 14/10/2026). Demais itens iguais à versão anterior — conferir.',
          v_usuario, 'Desempate na preliminar');

  insert into public."RL_REGRA_CRITERIO_DESEMPATE"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "NU_ORDEM", "CO_CRITERIO", "TP_DIRECAO")
  select v_regra."CO_REGRA_CLASSIFICACAO", v_versao, d.ordem, upper(d.valor ->> 'criterio'), d.valor ->> 'direcao'
    from jsonb_array_elements(coalesce(v_nova -> 'desempate', '[]'::jsonb)) with ordinality d(valor, ordem);

  update public."TB_REGRA_CLASSIFICACAO"
     set "NU_VERSAO_VIGENTE" = v_versao, "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_usuario
   where "CO_REGRA_CLASSIFICACAO" = v_regra."CO_REGRA_CLASSIFICACAO";
end;
$$;

-- Conferência: a versão vigente, o que mudou em relação à anterior e quem assinou.
select r."NU_VERSAO_VIGENTE" as versao,
       h."NO_VERSAO" as nome,
       h."CO_USUARIO" as assinada_por,
       h."DS_CONFIGURACAO" #>> '{listas,PRELIMINAR,empate}' as empate_preliminar,
       h."DS_CONFIGURACAO" #>> '{listas,FINAL,empate}' as empate_final_lista,
       h."DS_CONFIGURACAO" ->> 'data_corte' as data_corte,
       (select jsonb_agg(d ->> 'criterio') from jsonb_array_elements(h."DS_CONFIGURACAO" -> 'desempate') d) as desempate,
       (select jsonb_agg(c."CO_CRITERIO" order by c."NU_ORDEM") from public."RL_REGRA_CRITERIO_DESEMPATE" c
         where c."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and c."NU_VERSAO" = r."NU_VERSAO_VIGENTE") as desempate_rl,
       (h."DS_CONFIGURACAO" - 'listas' - 'importacao') = (a."DS_CONFIGURACAO" - 'listas' - 'importacao') as resto_igual_a_anterior,
       (h."DS_CONFIGURACAO" #> '{listas,FINAL}') = (a."DS_CONFIGURACAO" #> '{listas,FINAL}')
         and (h."DS_CONFIGURACAO" #> '{listas,ENTREVISTA}') = (a."DS_CONFIGURACAO" #> '{listas,ENTREVISTA}') as outras_listas_iguais,
       h."DS_MOTIVO" as motivo
  from public."TB_REGRA_CLASSIFICACAO" r
  join public."TH_REGRA_CLASSIFICACAO" h
    on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
  left join public."TH_REGRA_CLASSIFICACAO" a
    on a."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and a."NU_VERSAO" = r."NU_VERSAO_VIGENTE" - 1
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

commit;
