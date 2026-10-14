/*
  CORREÇÃO DE DADOS — nota declarada da pré-classificação do Edital 114/2026
  (Projetos, PES Rio Doce AgSUS/FUNASA, id bcecfb08-88ef-4e06-8401-bcad6bf88fd0)
  pelo QUADRO COMPLETO do item 8.2.6 (titulação + cursos + experiência).

  PROBLEMA: provisoria.nota_declarada (base_da_nota DECLARADA, que corta o
  lote pela nota mínima de 10 pontos do item 8.2.6) só somava a pergunta de
  Experiência Profissional. O item 8.2.6 manda contar o quadro inteiro:
    - nível superior: Titulação (Especialização 5, Mestrado 8, Doutorado 10,
      não cumulativa) + Cursos de aperfeiçoamento (1/2/3 por curso, máx. 5)
      + Experiência (máx. 35);
    - nível médio/técnico: Cursos (2/4/6 por curso, máx. 10) + Experiência;
      cargo 15 (Motorista D): + UMCQA 5 (cursos até 15).
  Ex.: "Doutorado" e "6 meses obrigatórios" tinha ART 10 e declarada 0. Eram
  84 válidos com ART >= 10 e declarada < 10, e 1.225 divergências ART ×
  declarada no total (1.009 nos 1.722 válidos).

  O QUE FAZ: cria uma NOVA versão (vigente + 1), igual à vigente, com os itens
  abaixo ACRESCENTADOS em provisoria.nota_declarada (a Experiência fica como
  está). As opções vêm dos questionários reais do 114 (todas as vagas):
    1. FORMACAO — "Qual seu Nível de Titulação Acadêmica" (só nos
       questionários de nível superior): pontos_por_nivel superior
       Não Possuo 0 / Especialização 5 / Mestrado 8 / Doutorado 10; médio e
       técnico = 0 em todas (titulação só pontua no superior).
    2. CURSOS — "Selecione a pontuação relativa à carga horária de Cursos de
       Aperfeiçoamento": a opção já vem em pontos ("1 ponto" … "10 pontos",
       "Não possuo"); usa o valor com o teto do nível: superior até 5
       ("6/8/10 pontos" → 5), médio e técnico até 10.
    3. CURSOS — "Você possui Certificado de capacitação … Unidade Móvel de
       Controle da Qualidade da Água" (UMCQA): Sim 5 / Não 0. A pergunta só
       existe no questionário do cargo 15 (vagas 182528 e 182567), por isso
       só pontua lá (o modelo não tem pontos por cargo, só por nível).
  Conferido com o cálculo do Python (calcular_nota_declarada /
  pre_classificar_vaga) nos 1.722 válidos: a nova declarada bate com a ART
  em 1.722 de 1.722 e o lote pela nota mínima fica com 1.326.

  Assina a versão o usuário da conta do setor "Gestão da Informação de
  Pessoal" (a01afddb-f64b-47d9-80e8-476a1ed14e43), que precisa ser
  administrador global ativo (senão para com erro). Não depende do número da
  versão: parte da VIGENTE no momento da execução (era a 17). A situação
  volta para CONFERIR, como em toda versão nova: a coordenação confere antes
  do refazer do lote (o job só grava com a regra CONFERIDA). Nenhuma
  declarada do 114 está congelada hoje; se estiver na hora do refazer, a
  congelada vale como está (descongelar antes).

  Rode no SQL Editor (papel postgres). Idempotente: se a vigente já tem a
  pergunta da titulação na nota declarada, não faz nada (avisa). Para
  ensaiar, troque o commit por rollback. Termina com o SELECT de conferência.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_autor constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  c_motivo constant text := 'Nota declarada pelo quadro completo do item 8.2.6 (titulação + cursos + experiência)';
  c_nome constant text := 'Nota declarada completa';
  c_titulacao constant text := 'Qual seu Nível de Titulação Acadêmica';
  c_itens constant jsonb := $itens$
[
  {
    "parcial": "FORMACAO",
    "pergunta": "Qual seu Nível de Titulação Acadêmica",
    "tipo": "OPCAO",
    "pontos_por_nivel": {
      "superior": {"Não Possuo": 0, "Especialização": 5, "Mestrado": 8, "Doutorado": 10},
      "tecnico": {"Não Possuo": 0, "Especialização": 0, "Mestrado": 0, "Doutorado": 0},
      "medio": {"Não Possuo": 0, "Especialização": 0, "Mestrado": 0, "Doutorado": 0}
    },
    "teto": 10
  },
  {
    "parcial": "CURSOS",
    "pergunta": "Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento",
    "tipo": "OPCAO",
    "pontos_por_nivel": {
      "superior": {"Não possuo": 0, "1 ponto": 1, "2 pontos": 2, "3 pontos": 3, "4 pontos": 4, "5 pontos": 5, "6 pontos": 5, "8 pontos": 5, "10 pontos": 5},
      "tecnico": {"Não possuo": 0, "1 ponto": 1, "2 pontos": 2, "3 pontos": 3, "4 pontos": 4, "5 pontos": 5, "6 pontos": 6, "8 pontos": 8, "10 pontos": 10},
      "medio": {"Não possuo": 0, "1 ponto": 1, "2 pontos": 2, "3 pontos": 3, "4 pontos": 4, "5 pontos": 5, "6 pontos": 6, "8 pontos": 8, "10 pontos": 10}
    },
    "teto": 10
  },
  {
    "parcial": "CURSOS",
    "pergunta": "Você possui Certificado de capacitação ou treinamento específico para condução, manejo e operação de Unidade Móvel de Controle da Qualidade da Água",
    "tipo": "OPCAO",
    "pontos": {"Sim": 5, "Não": 0},
    "teto": 5
  }
]
$itens$::jsonb;
  v_regra public."TB_REGRA_ANALISE";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
begin
  if not exists (
    select 1 from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.user_id = c_autor and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'O usuário % (Gestão da Informação de Pessoal) não é administrador global ativo', c_autor;
  end if;
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA"
                  where id = c_edital and private."FC_NUMERO_EDITAL"(edital) = '114/2026') then
    raise exception 'Edital 114/2026 não encontrado pelo id';
  end if;

  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = c_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O 114/2026 ainda não tem regra da avaliação documental';
  end if;
  select h."DS_CONFIGURACAO" into v_atual
    from public."TH_REGRA_ANALISE" h
   where h."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";

  if exists (select 1 from jsonb_array_elements(coalesce(v_atual #> '{provisoria,nota_declarada}', '[]'::jsonb)) i
              where i ->> 'pergunta' = c_titulacao) then
    raise notice 'A versão vigente (%) já tem a nota declarada completa: nada foi feito.', v_regra."NU_VERSAO_VIGENTE";
    return;
  end if;
  if jsonb_typeof(v_atual -> 'provisoria') is distinct from 'object' then
    raise exception 'A vigente (%) não tem provisoria', v_regra."NU_VERSAO_VIGENTE";
  end if;

  v_nova := jsonb_set(v_atual, '{provisoria,nota_declarada}',
                      coalesce(v_atual #> '{provisoria,nota_declarada}', '[]'::jsonb) || c_itens);
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_nova);
  v_versao := v_regra."NU_VERSAO_VIGENTE" + 1;

  insert into public."TH_REGRA_ANALISE"
    ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_ANALISE", v_versao, v_nova,
          encode(sha256(convert_to(v_nova::text, 'UTF8')), 'hex'), c_motivo, c_autor,
          private."FC_NOME_DA_VERSAO"(c_nome));

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_versao, "TP_SITUACAO" = 'CONFERIR',
         "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = c_autor
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  raise notice 'Regra do 114/2026: versão % criada a partir da % com a nota declarada completa (situação CONFERIR).',
    v_versao, v_regra."NU_VERSAO_VIGENTE";
end;
$$;

commit;

-- Conferência: versão, situação, nome, motivo, autor e os itens da nota declarada.
select r."NU_VERSAO_VIGENTE" as versao,
       r."TP_SITUACAO" as situacao,
       h."NO_VERSAO" as nome,
       h."DS_MOTIVO" as motivo,
       h."CO_USUARIO" as autor,
       (select jsonb_agg(jsonb_build_object('parcial', i ->> 'parcial', 'pergunta', i ->> 'pergunta', 'teto', i -> 'teto'))
          from jsonb_array_elements(h."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}') i) as nota_declarada,
       h."DS_CONFIGURACAO" #>> '{provisoria,base_da_nota}' as base_da_nota
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h
    on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
