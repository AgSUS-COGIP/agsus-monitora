/*
  CORREÇÃO DE DADOS — Classificação do edital 93/2026 (Projetos), auditada
  contra o texto do edital em 09/10/2026.

  A análise documental do 93/2026 foi feita pela PLANILHA (TB_ANALISE_CURRICULAR);
  a lista "Avaliação documental — resultado preliminar" sai do motor da
  Classificação com a regra vigente do edital. Duas coisas não batiam:

  1. REGRA (versão nova, com motivo). A lista preliminar deixava os empatados
     na mesma posição (listas.PRELIMINAR.empate = MESMA_POSICAO), mas o edital
     manda listar os aprovados na análise curricular pela ordem de
     classificação (8.2.10.10) e aplicar os critérios de desempate em caso de
     empate (9.3 e 10.1: a) 60 anos ou mais, b) maior tempo de experiência
     profissional comprovado, c) maior idade — com a hora da certidão, 6.11.5
     e 6.11.6). Na vaga 180231 eram 8 pessoas em 1º lugar com 45 pontos; a
     convocação (5 × vagas) levava as 8. Passa a CRITERIOS. Os critérios e a
     ordem deles (IDOSO_60, EXP_PROFISSIONAL_TEMPO, MAIOR_IDADE) já estavam
     certos e não mudam. A data de corte da idade fica explícita: o fim das
     inscrições (29/09/2026, cronograma do edital), em vez de nula.

  2. QUADRO DE VAGAS. O quadro lido do Anexo I veio só com o total por cargo
     (DS_MODALIDADE_VAGA vazio), e a Classificação repartia cada cargo pelos
     percentuais. Para o Técnico de Segurança do Trabalho (6 vagas) isso dava
     4 AC + 2 PP, mas o item 4.1 do edital publica 3 AC + 1 PcD + 2 PP (a vaga
     PcD é 5% do TOTAL do edital, 11 vagas, e foi posta neste cargo). Passa a
     valer a divisão publicada, cargo a cargo, e o cadastro reserva (todas as
     linhas do 4.1 têm CR).

  Rode no SQL Editor (papel postgres) DEPOIS da revisão. Idempotente: a regra
  só ganha versão se a vigente ainda tiver a preliminar sem critérios; o quadro
  só muda se ainda estiver sem a divisão. Ensaio (begin … rollback) com o
  mesmo conteúdo: supabase/ensaios/20261009-classificacao-93-desempate-e-quadro.sql.
  Depois de aplicar: Classificação › 93/2026 › Avaliação documental › Gerar.
  Testes: tests/classificacao-93-desempate.test.js (lê o $patch$ e o quadro daqui).
*/
begin;

-- 1. Regra: desempate do 10.1 também na lista preliminar --------------------------------------
do $$
declare
  v_edital constant uuid := 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded';
  v_patch constant jsonb := $patch${"data_corte": "2026-09-29", "listas": {"PRELIMINAR": {"empate": "CRITERIOS"}}}$patch$::jsonb;
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
begin
  if private."FC_NUMERO_EDITAL"((select edital from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital)) is distinct from '93/2026' then
    raise exception 'O edital % não é o 93/2026.', v_edital;
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = v_edital for update;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'O 93/2026 não tem regra de classificação.';
  end if;
  select h."DS_CONFIGURACAO" into v_atual
    from public."TH_REGRA_CLASSIFICACAO" h
   where h."CO_REGRA_CLASSIFICACAO" = v_regra."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";

  if v_atual #>> '{listas,PRELIMINAR,empate}' = 'CRITERIOS' then
    raise notice 'Regra do 93/2026 já usa os critérios na preliminar (versão %): nada a fazer.', v_regra."NU_VERSAO_VIGENTE";
    return;
  end if;
  -- Os critérios têm de ser os do 10.1, nessa ordem; se alguém mudou, pare e revise.
  if (select jsonb_agg(d ->> 'criterio' order by o) from jsonb_array_elements(v_atual -> 'desempate') with ordinality x(d, o))
     is distinct from '["IDOSO_60", "EXP_PROFISSIONAL_TEMPO", "MAIOR_IDADE"]'::jsonb then
    raise exception 'Os critérios de desempate da regra vigente do 93/2026 não são os do item 10.1 na ordem: revise antes.';
  end if;

  v_nova := jsonb_set(
              jsonb_set(v_atual, '{listas,PRELIMINAR,empate}', v_patch #> '{listas,PRELIMINAR,empate}'),
              '{data_corte}', v_patch -> 'data_corte');
  perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_nova);
  v_versao := v_regra."NU_VERSAO_VIGENTE" + 1;

  insert into public."TH_REGRA_CLASSIFICACAO"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_CLASSIFICACAO", v_versao, v_nova, v_nova #>> '{empate_final,metodo}',
          'Auditoria do 93/2026: desempate do item 10.1 também na lista preliminar (8.2.10.10 e 9.3); data de corte = fim das inscrições (29/09/2026).',
          null, 'Desempate na preliminar');

  insert into public."RL_REGRA_CRITERIO_DESEMPATE"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "NU_ORDEM", "CO_CRITERIO", "TP_DIRECAO")
  select v_regra."CO_REGRA_CLASSIFICACAO", v_versao, d.ordem, upper(d.valor ->> 'criterio'), d.valor ->> 'direcao'
    from jsonb_array_elements(coalesce(v_nova -> 'desempate', '[]'::jsonb)) with ordinality d(valor, ordem);

  update public."TB_REGRA_CLASSIFICACAO"
     set "NU_VERSAO_VIGENTE" = v_versao, "DT_ATUALIZACAO" = now()
   where "CO_REGRA_CLASSIFICACAO" = v_regra."CO_REGRA_CLASSIFICACAO";
end;
$$;

-- 2. Quadro de vagas: a divisão por modalidade do item 4.1 ------------------------------------
with quadro(ordem, termo, modalidades) as (
  values
    (1, 'MÉDICO DO TRABALHO',       $q${"Ampla Concorrência": 1, "PcD": null, "Pretos e Pardos": 1, "Indígenas": null, "Quilombolas": null}$q$::jsonb),
    (2, 'ENFERMEIRO DO TRABALHO',   $q${"Ampla Concorrência": 1, "PcD": null, "Pretos e Pardos": null, "Indígenas": null, "Quilombolas": null}$q$::jsonb),
    (3, 'ENGENHARIA DO TRABALHO',   $q${"Ampla Concorrência": 1, "PcD": null, "Pretos e Pardos": null, "Indígenas": null, "Quilombolas": null}$q$::jsonb),
    (4, 'ENFERMAGEM DO TRABALHO',   $q${"Ampla Concorrência": 1, "PcD": null, "Pretos e Pardos": null, "Indígenas": null, "Quilombolas": null}$q$::jsonb),
    (5, 'SEGURANÇA DO TRABALHO',    $q${"Ampla Concorrência": 3, "PcD": 1, "Pretos e Pardos": 2, "Indígenas": null, "Quilombolas": null}$q$::jsonb)
)
update public."TB_QUADRO_VAGA_EDITAL" v
   set "DS_MODALIDADE_VAGA" = q.modalidades,
       "ST_CADASTRO_RESERVA" = 'S'
  from quadro q
 where v."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'
   and v."ST_REGISTRO_ATIVO" = 'S'
   and v."NU_ORDEM" = q.ordem
   and upper(v."NO_CARGO") like '%' || q.termo || '%'
   -- só o total: a soma da divisão tem de bater com as vagas imediatas da linha
   and v."QT_VAGA_IMEDIATA" = (select sum(coalesce(nullif(x.valor, 'null')::integer, 0)) from jsonb_each_text(q.modalidades) x(chave, valor))
   and (v."DS_MODALIDADE_VAGA" = '{}'::jsonb or v."ST_CADASTRO_RESERVA" = 'N');

-- Conferência: a versão vigente e o quadro.
select r."NU_VERSAO_VIGENTE" as versao,
       h."DS_CONFIGURACAO" #>> '{listas,PRELIMINAR,empate}' as empate_preliminar,
       h."DS_CONFIGURACAO" ->> 'data_corte' as data_corte,
       (select jsonb_agg(d ->> 'criterio') from jsonb_array_elements(h."DS_CONFIGURACAO" -> 'desempate') d) as desempate,
       (select jsonb_agg(jsonb_build_array(q."NU_ORDEM", q."QT_VAGA_IMEDIATA", q."DS_MODALIDADE_VAGA", q."ST_CADASTRO_RESERVA") order by q."NU_ORDEM")
          from public."TB_QUADRO_VAGA_EDITAL" q
         where q."CO_MONITORAMENTO" = r."CO_MONITORAMENTO" and q."ST_REGISTRO_ATIVO" = 'S') as quadro
  from public."TB_REGRA_CLASSIFICACAO" r
  join public."TH_REGRA_CLASSIFICACAO" h
    on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded';

commit;
