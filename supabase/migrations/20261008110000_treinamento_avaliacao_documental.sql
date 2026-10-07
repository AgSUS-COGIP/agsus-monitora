/*
  TREINAMENTO DA AVALIAÇÃO DOCUMENTAL COM REGRAS DE EDITAIS VERDADEIROS (08/10/2026)

  Pedido: "testar a Avaliação documental no edital de treinamento usando regras de
  editais verdadeiros, para alinhar com o que precisamos".

  O que muda
    1. Novo edital de treinamento de Projetos, "Treinamento – Projetos (992/2099)"
       (ST_TREINAMENTO = S), espelho do Edital 93/2026:
         - as 5 vagas e cargos do 93/2026 (códigos fictícios 990992001 a 990992005),
           o quadro (11 vagas) e o cronograma relativo a hoje (inscrições encerradas,
           análise curricular em andamento);
         - a REGRA da avaliação documental copiada da versão vigente e conferida do
           93/2026 (versão 7: base da nota DECLARADA, corte de 15 pontos do item 8.2.6,
           eliminação de quem cancelou e de quem não finalizou o questionário — decisão
           CORES —, pontos das perguntas por nível da vaga). Só o JSON: o rótulo do edital
           muda para "Edital 992/2099 (TREINAMENTO)" e nada liga a cópia à regra real
           (editar no treino grava versão do treino; o 93/2026 não muda). A regra da
           classificação do 93/2026 (nota mínima 15, nível pelo cargo) vem junto;
         - 40 candidatos fictícios ("Candidato Teste P01"…, CPF nulo, e-mail
           @exemplo.invalid) no formato da exportação da Empregare ("Pergunta N -
           enunciado" com os enunciados do 93/2026, valores entre aspas, multisseleção,
           "--", "NOTA - <questionário>" = "45,0/50,0", "SITUAÇÃO - <questionário>"),
           cobrindo os casos reais: finalizado acima, abaixo e com exatamente 15;
           Pendente, Em andamento e questionário nem começado; cancelado; ART alterada
           depois (declarada ≠ ART); ART ausente; resposta fora do mapa (nota pela ART);
           empates (idoso, experiência declarada, maior idade); reprovado na Empregare
           (não elimina); um "Critério CORES" (P08: questionário em andamento, nota alta),
           que fica eliminado para o usuário incluir no lote pela tela;
         - a pré-classificação já rodada: o resultado do cálculo Python
           (python/monitora/avaliacao_documental, gerado por
           scripts/pre_classificacao/gerar_treinamento.py e conferido por
           tests/python/test_treinamento_projetos.py) gravado pelas mesmas RPCs do job
           (gravar_pre_classificacao_vaga, abrir_fichas_pre_classificacao,
           finalizar_pre_classificacao); lote e fichas PENDENTE para os analistas;
         - análises fictícias "Pendente" de quem está no lote (origem 'treinamento':
           fora do painel das análises, que segue contando só as linhas da planilha).
    2. Saúde Indígena: a regra da avaliação documental do treinamento sai do modelo
       SI26-ALSE e passa à do edital SI real mais recente em andamento com regra
       própria. Nenhum edital SI tem regra conferida no MONITORA ainda (só o 93/2026
       tem regra); o mais recente com o modelo do próprio PDF é o 111/2026 (DSEI
       Parintins, SI26-PARINTINS). A regra vem com as perguntas do questionário NERSSI
       ligadas aos blocos e os 15 fictícios respondem no formato do questionário real
       (o do 101/2026, DSEI Manaus). No edital que já existe, vira a versão seguinte da
       regra (a antiga fica no histórico) e as respostas são atualizadas.
    3. private."FC_PREPARAR_EDITAL_TREINAMENTO" aceita 'saude-indigena' e 'projetos'
       (o corpo de cada área em private."FC_PREPARAR_TREINAMENTO_SI" e
       private."FC_PREPARAR_TREINAMENTO_PROJETOS") e public.reiniciar_edital_treinamento
       volta os dois ao estado inicial. As travas continuam: só ST_TREINAMENTO = S, só
       admin global, recusa se houver vaga carregada pelo robô (e agora também se o
       código de vaga fictícia já existir fora do treinamento), nunca apaga dado real
       (private."FC_APAGAR_DADOS_DO_TREINAMENTO" não muda).
    4. A execução da pré-classificação do treinamento ("treinamento-<id do edital>",
       private."FC_EXECUCAO_EH_TREINAMENTO") fica fora do painel dos robôs
       (get_painel_dos_robos) e do Status das atualizações (get_saude_das_cargas).
       O treinamento continua fora de painéis, KPIs, conferências e robôs no modo
       padrão (os predicados de 20261007230000).

  Dependentes: src/lib/edital-de-treinamento.js (sem mudança de contrato),
  docs/aya/ (verbetes do edital de treinamento), tests/fixtures/avaliacao-documental/
  treinamento-projetos.json. Nenhuma assinatura de RPC muda.

  Rollback: supabase/rollback/20261008110000_treinamento_avaliacao_documental.sql
  Ensaio:   supabase/ensaios/20261008110000_treinamento_avaliacao_documental.sql
*/
begin;

set local lock_timeout = '10s';

-- ── 1. A execução fictícia da pré-classificação fica fora dos painéis ──────
create or replace function private."FC_EXECUCAO_EH_TREINAMENTO"(p_execucao text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(p_execucao, '') like 'treinamento-%';
$$;
comment on function private."FC_EXECUCAO_EH_TREINAMENTO"(text) is
  'A execução da pré-classificação (TL_PRE_CLASSIFICACAO) é a do edital de treinamento? Só private."FC_PRE_CLASSIFICAR_TREINAMENTO" cria execução com o prefixo treinamento- (o job Python usa precl-). Fica fora do painel dos robôs e do Status das atualizações.';
revoke all on function private."FC_EXECUCAO_EH_TREINAMENTO"(text) from public, anon;
grant execute on function private."FC_EXECUCAO_EH_TREINAMENTO"(text) to authenticated, service_role;

-- ── 2. A inscrição fictícia no formato da exportação da Empregare ──────────
-- As colunas de uma vaga: o cadastro, as do questionário e "Pergunta N - <enunciado>"
-- (com "Justificativa - Pergunta N" quando o questionário as tem, como nos de Projetos).
create or replace function private."FC_TREINO_COLUNAS"(p_questionario text, p_enunciados text[], p_justificativa boolean)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array('CÓDIGO', 'NOME', 'E-MAIL', 'TELEFONE', 'CELULAR', 'GÊNERO', 'PAÍS', 'ESTADO', 'CIDADE', 'PCD',
           'DATA DE NASCIMENTO', 'ETAPA', 'SITUAÇÃO', 'MOTIVO DE CANCELAMENTO', 'JUSTIFICATIVA DE CANCELAMENTO', 'REPROVADO',
           'DATA DE CANDIDATURA', 'MATCH', 'MATCH - PORCENTAGEM', 'NÍVEL ÚLTIMA FORMAÇÃO', 'CURSO ÚLTIMA FORMAÇÃO',
           'INSTITUIÇÃO DA ÚLTIMA FORMAÇÃO', 'ÚLTIMA EXPERIÊNCIA', 'NOTA FIT COMPORTAMENTAL', 'DATA DE CONTRATADO',
           'PRETENSÃO SALARIAL', 'MARCADORES', 'SITUAÇÃO - ' || p_questionario, 'NOTA - ' || p_questionario,
           'DATA DE RESPOSTA - ' || p_questionario)
      || coalesce((
           select jsonb_agg(x.coluna order by x.ordem, x.lado)
             from unnest(p_enunciados) with ordinality e(texto, n)
            cross join lateral (
              select e.n as ordem, 1 as lado,
                     case when e.n = 1 then 'RESPOSTAS - ' || p_questionario || ' - ' else '' end
                       || 'Pergunta ' || e.n || ' - ' || e.texto as coluna
              union all
              select e.n, 2, 'Justificativa - Pergunta ' || e.n where p_justificativa
            ) x), '[]'::jsonb);
$$;
comment on function private."FC_TREINO_COLUNAS"(text, text[], boolean) is
  'Edital de treinamento: as colunas de uma vaga no formato da exportação da Empregare (cadastro, SITUAÇÃO/NOTA/DATA DE RESPOSTA do questionário e "Pergunta N - <enunciado>").';

-- A resposta fictícia de uma pergunta, pelo enunciado. p_c: os campos do candidato
-- (quest, nome, nascimento, escol, especial, registro, exp, tit, cur, modal, etnico,
-- conjuge, contrato, termo, declaro), já no formato da Empregare ('"Sim"', '--').
create or replace function private."FC_TREINO_RESPOSTA"(p_enunciado text, p_c jsonb)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  e text := coalesce(p_enunciado, '');
  v text;
  modal text := coalesce(p_c ->> 'modal', '');
  anexo boolean;
  presente boolean;
begin
  -- Questionário nem começado: tudo em branco.
  if coalesce(p_c ->> 'quest', '--') = '--' then
    return '--';
  end if;
  if e ilike 'Anexe%' or e ilike 'Candidatos%' or e ilike 'Para candidatos%' or e ilike 'Os candidatos que concorrem%' then
    anexo := case
      when e ilike '%Experiência%' then coalesce(p_c ->> 'exp', '--') <> '--'
      when e ilike '%itulação%' then coalesce(p_c ->> 'tit', p_c ->> 'especial', '--') not in ('--', '"Não possuo"', '"Não Possuo"')
      when e ilike '%Cursos%' then coalesce(p_c ->> 'cur', '--') not in ('--', '"Não possuo"')
      when e ilike '%registro profissional%' then coalesce(p_c ->> 'registro', '') like '"Sim%'
      when e ilike '%Pretos%' then modal ilike '%pret%' or modal ilike '%quilomb%'
      when e ilike '%uilombola%' then modal ilike '%quilomb%'
      when e ilike '%Pertencimento Étnico%' or e ilike '%indígena%' then modal ilike '%indígena%' or coalesce(p_c ->> 'etnico', '') ilike '%Sou indígena%'
      when e ilike '%PcD%' or e ilike '%laudo%' then modal ilike '%PCD%' or modal ilike '%deficiência%'
      when e ilike '%especializa%' or e ilike '%residência%' or e ilike '%nível médio%' then
        coalesce(p_c ->> 'especial', '--') not in ('--', '"Não"', '"Não possuo"')
      else coalesce(p_c ->> 'escol', '--') <> '--'
    end;
    return case when anexo then 'Anexo' else '--' end;
  end if;
  presente := true;
  v := case
    when e ilike 'Nome completo%' then p_c ->> 'nome'
    when e ilike '%CPF%' then '000.000.000-00'
    when e ilike '%data de nascimento%' then to_char((p_c ->> 'nascimento')::date, 'DD/MM/YYYY')
    when e ilike 'Você possui Ensino Médio completo e Curso Técnico%' or e ilike 'Você possui Graduação na área%'
      or e ilike 'Você possui nível fundamental%' or e ilike 'Você possui curso técnico%' then p_c ->> 'escol'
    when e ilike 'Você possui residência%' or e ilike 'Você possui certificado de conclusão%'
      or e ilike 'Você possui especialização técnica%' or e ilike 'Você possui ensino médio completo%'
      or e ilike 'Qual sua titulação%' then p_c ->> 'especial'
    when e ilike 'Você possui registro profissional%' then p_c ->> 'registro'
    when e ilike '%Experiência Profissional%' then p_c ->> 'exp'
    when e ilike 'Qual seu Nível de Titulação%' then p_c ->> 'tit'
    when e ilike 'Selecione a pontuação relativa%' then p_c ->> 'cur'
    when e ilike 'Indique%sistema de concorrência%' then p_c ->> 'modal'
    when e ilike 'Você é indígena e mora em aldeia%' then p_c ->> 'etnico'
    when e ilike 'Você possui cônjuge%' then p_c ->> 'conjuge'
    when e ilike 'Você está com contrato%' then p_c ->> 'contrato'
    when e ilike 'Você possui interesse em atuar%' then '"Sim"'
    when e ilike 'TERMO DE RESPONSABILIDADE%' then p_c ->> 'termo'
    when e ilike 'Declaro estar ciente%' then p_c ->> 'declaro'
    else null
  end;
  return coalesce(nullif(v, ''), '--');
end;
$$;
comment on function private."FC_TREINO_RESPOSTA"(text, jsonb) is
  'Edital de treinamento: a resposta fictícia de uma pergunta do questionário, pelo enunciado (anexos viram "Anexo" quando o candidato tem o que comprovar).';

-- A linha da inscrição (DS_COLUNA_ORIGINAL). p_c traz também codigo, email, situacao,
-- art, reprovado, marcadores, nivel_formacao, curso_formacao, candidatura (date), uf.
create or replace function private."FC_TREINO_INSCRICAO"(p_questionario text, p_enunciados text[], p_justificativa boolean, p_c jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'CÓDIGO', p_c ->> 'codigo', 'NOME', p_c ->> 'nome', 'E-MAIL', p_c ->> 'email',
           'TELEFONE', '(00) 0000-0000', 'CELULAR', '(00) 00000-0000', 'GÊNERO', 'Não informado', 'PAÍS', 'Brasil',
           'ESTADO', coalesce(p_c ->> 'uf', 'DF'), 'CIDADE', 'Cidade Fictícia',
           'PCD', case when coalesce(p_c ->> 'modal', '') ilike '%PCD%' then 'SIM' else 'NÃO' end,
           'DATA DE NASCIMENTO', to_char((p_c ->> 'nascimento')::date, 'DD/MM/YYYY'),
           'ETAPA', 'Interessados', 'SITUAÇÃO', p_c ->> 'situacao',
           'MOTIVO DE CANCELAMENTO', case when p_c ->> 'situacao' = 'CANCELADO' then 'Desistência' else '--' end,
           'JUSTIFICATIVA DE CANCELAMENTO', '--',
           'REPROVADO', coalesce(p_c ->> 'reprovado', 'NÃO'),
           'DATA DE CANDIDATURA', to_char((p_c ->> 'candidatura')::date, 'DD/MM/YYYY'),
           'MATCH', '--', 'MATCH - PORCENTAGEM', '--',
           'NÍVEL ÚLTIMA FORMAÇÃO', coalesce(p_c ->> 'nivel_formacao', '--'),
           'CURSO ÚLTIMA FORMAÇÃO', coalesce(p_c ->> 'curso_formacao', '--'),
           'INSTITUIÇÃO DA ÚLTIMA FORMAÇÃO', 'Instituição Fictícia', 'ÚLTIMA EXPERIÊNCIA', '--',
           'NOTA FIT COMPORTAMENTAL', '--', 'DATA DE CONTRATADO', '--', 'PRETENSÃO SALARIAL', '--',
           'MARCADORES', coalesce(p_c ->> 'marcadores', 'Nenhum Marcador'),
           'SITUAÇÃO - ' || p_questionario, coalesce(p_c ->> 'quest', '--'),
           'NOTA - ' || p_questionario, coalesce(p_c ->> 'art', '--'),
           'DATA DE RESPOSTA - ' || p_questionario,
             case when coalesce(p_c ->> 'quest', '--') = '--' then '--'
                  else to_char((p_c ->> 'candidatura')::date, 'DD/MM/YYYY') end)
      || coalesce((
           select jsonb_object_agg(x.coluna, x.valor)
             from unnest(p_enunciados) with ordinality e(texto, n)
            cross join lateral (
              select case when e.n = 1 then 'RESPOSTAS - ' || p_questionario || ' - ' else '' end
                       || 'Pergunta ' || e.n || ' - ' || e.texto as coluna,
                     private."FC_TREINO_RESPOSTA"(e.texto, p_c) as valor
              union all
              select 'Justificativa - Pergunta ' || e.n, '--' where p_justificativa
            ) x), '{}'::jsonb);
$$;
comment on function private."FC_TREINO_INSCRICAO"(text, text[], boolean, jsonb) is
  'Edital de treinamento: a linha fictícia da inscrição (DS_COLUNA_ORIGINAL) no formato da exportação da Empregare. Sem CPF nem dado pessoal real.';

revoke all on function private."FC_TREINO_COLUNAS"(text, text[], boolean) from public, anon, authenticated;
revoke all on function private."FC_TREINO_RESPOSTA"(text, jsonb) from public, anon, authenticated;
revoke all on function private."FC_TREINO_INSCRICAO"(text, text[], boolean, jsonb) from public, anon, authenticated;
grant execute on function private."FC_TREINO_COLUNAS"(text, text[], boolean) to service_role;
grant execute on function private."FC_TREINO_RESPOSTA"(text, jsonb) to service_role;
grant execute on function private."FC_TREINO_INSCRICAO"(text, text[], boolean, jsonb) to service_role;

-- ── 3. A regra da avaliação documental do treinamento (cópia independente) ─
-- Cria a regra (versão 1) ou, quando a vigente veio de outro modelo, grava a versão
-- seguinte. A cópia é só o JSON: nenhum vínculo com a regra do edital real de origem.
create or replace function private."FC_REGRA_DO_TREINAMENTO"(p_edital uuid, p_config jsonb, p_situacao text, p_motivo text, p_uid uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_regra public."TB_REGRA_ANALISE";
  v_vigente jsonb;
  v_versao integer;
begin
  if not private."FC_EDITAL_EH_TREINAMENTO"(p_edital) then
    raise exception 'Só o edital de treinamento recebe regra copiada por aqui' using errcode = '42501';
  end if;
  perform private."FC_VALIDAR_REGRA_ANALISE"(p_config);
  select * into v_regra from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "TP_SITUACAO", "CO_MODELO_ORIGEM",
      "CO_USUARIO_ATUALIZACAO", "CO_USUARIO_CONFERENCIA", "DT_CONFERENCIA")
    values (p_edital, 1, p_situacao, p_config ->> 'modelo', p_uid,
            case when p_situacao = 'CONFERIDA' then p_uid end, case when p_situacao = 'CONFERIDA' then now() end)
    returning * into v_regra;
    insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra."CO_REGRA_ANALISE", 1, p_config, encode(sha256(convert_to(p_config::text, 'UTF8')), 'hex'), p_motivo, p_uid);
    return 1;
  end if;
  select h."DS_CONFIGURACAO" into v_vigente
    from public."TH_REGRA_ANALISE" h
   where h."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";
  -- A vigente já é deste modelo (talvez editada no treino): fica como está.
  if v_vigente ->> 'modelo' is not distinct from p_config ->> 'modelo' then
    return v_regra."NU_VERSAO_VIGENTE";
  end if;
  select coalesce(max(h."NU_VERSAO"), 0) + 1 into v_versao
    from public."TH_REGRA_ANALISE" h where h."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";
  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra."CO_REGRA_ANALISE", v_versao, p_config, encode(sha256(convert_to(p_config::text, 'UTF8')), 'hex'), p_motivo, p_uid);
  update public."TB_REGRA_ANALISE" set
    "NU_VERSAO_VIGENTE" = v_versao, "TP_SITUACAO" = p_situacao, "CO_MODELO_ORIGEM" = p_config ->> 'modelo',
    "CO_USUARIO_ATUALIZACAO" = p_uid,
    "CO_USUARIO_CONFERENCIA" = case when p_situacao = 'CONFERIDA' then p_uid end,
    "DT_CONFERENCIA" = case when p_situacao = 'CONFERIDA' then now() end,
    "DT_ATUALIZACAO" = now()
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";
  return v_versao;
end;
$$;
comment on function private."FC_REGRA_DO_TREINAMENTO"(uuid, jsonb, text, text, uuid) is
  'Edital de treinamento: grava a regra da avaliação documental copiada (só o JSON; cópia independente do edital real de origem). Sem regra: versão 1; vigente de outro modelo: versão seguinte; do mesmo modelo: não mexe. Recusa edital real.';
revoke all on function private."FC_REGRA_DO_TREINAMENTO"(uuid, jsonb, text, text, uuid) from public, anon, authenticated;
grant execute on function private."FC_REGRA_DO_TREINAMENTO"(uuid, jsonb, text, text, uuid) to service_role;

-- ── 4. A pré-classificação do treinamento: o resultado do Python, gravado pelas RPCs ─
-- p_resultado: {"edital": {o resumo do edital, como o job manda a finalizar},
--               "vagas": {"<código>": {"resumo": {...}, "linhas": [{"codigo": ..., ...}]}}}
-- calculado por python/monitora/avaliacao_documental (pre_classificar_vaga) sobre os mesmos
-- fictícios; tests/python/test_treinamento_projetos.py confere que o Python dá o mesmo.
create or replace function private."FC_PRE_CLASSIFICAR_TREINAMENTO"(p_edital uuid, p_resultado jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_exec text := 'treinamento-' || p_edital::text;
  v_uid uuid := (select auth.uid());
  v_versao integer;
  v_vaga record;
  v_linhas jsonb;
  v_fichas jsonb;
begin
  if not private."FC_EDITAL_EH_TREINAMENTO"(p_edital) then
    raise exception 'Só o edital de treinamento recebe pré-classificação pronta' using errcode = '42501';
  end if;
  if p_resultado is null or jsonb_typeof(p_resultado -> 'vagas') is distinct from 'object' then
    return null;
  end if;
  -- Já rodada (o preparar é idempotente; o recálculo é com o job).
  if exists (select 1 from public."TB_PRE_CLASSIFICACAO" p where p."CO_MONITORAMENTO" = p_edital) then
    return null;
  end if;
  select r."NU_VERSAO_VIGENTE" into v_versao
    from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = p_edital and r."TP_SITUACAO" = 'CONFERIDA';
  if v_versao is null then
    raise exception 'A regra do edital de treinamento não está conferida' using errcode = '22023';
  end if;

  -- Uma execução por edital de treinamento (reaproveitada no reinício), fora dos painéis.
  insert into public."TL_PRE_CLASSIFICACAO" ("CO_EXECUCAO", "TP_DISPARO", "CO_USUARIO_DISPARO", "DS_PEDIDO")
  values (v_exec, case when v_uid is null then 'GITHUB' else 'MONITORA' end, v_uid,
          jsonb_build_array(private."FC_NUMERO_EDITAL"((select m.edital from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital))))
  on conflict ("CO_EXECUCAO") do update set
    "TP_SITUACAO" = 'EM_ANDAMENTO', "DT_INICIO" = now(), "DT_FIM" = null, "DS_MENSAGEM" = null,
    "TP_DISPARO" = excluded."TP_DISPARO", "CO_USUARIO_DISPARO" = excluded."CO_USUARIO_DISPARO",
    "ST_REFAZER_LOTE" = 'N', "DS_PEDIDO" = excluded."DS_PEDIDO", "DS_EDITAL" = '[]'::jsonb;

  for v_vaga in
    select k.key as vaga, k.value as dados from jsonb_each(p_resultado -> 'vagas') k order by k.key
  loop
    select coalesce(jsonb_agg((l.linha - 'codigo') || jsonb_build_object('id', c."CO_EMPREGARE_CANDIDATO") order by l.ordem), '[]'::jsonb)
      into v_linhas
      from jsonb_array_elements(v_vaga.dados -> 'linhas') with ordinality l(linha, ordem)
      join public."TB_EMPREGARE_CANDIDATO" c
        on c."CO_VAGA" = v_vaga.vaga and c."CO_CANDIDATO_EMPREGARE" = l.linha ->> 'codigo';
    if jsonb_array_length(v_linhas) <> jsonb_array_length(v_vaga.dados -> 'linhas') then
      raise exception 'Pré-classificação do treinamento: inscrito fictício sem inscrição na vaga %', v_vaga.vaga using errcode = 'P0001';
    end if;
    perform public.gravar_pre_classificacao_vaga(v_exec, p_edital, v_vaga.vaga, v_versao, v_vaga.dados -> 'resumo', v_linhas);
  end loop;

  -- As fichas do lote (PENDENTE, sem analista: a equipe distribui pela tela).
  v_fichas := public.abrir_fichas_pre_classificacao(v_exec, p_edital, '[]'::jsonb);
  perform public.finalizar_pre_classificacao(v_exec,
    jsonb_build_array((p_resultado -> 'edital') || jsonb_build_object(
      'edital', p_edital::text,
      'fichas_criadas', coalesce((v_fichas ->> 'criadas')::integer, 0),
      'fichas_atribuidas', coalesce((v_fichas ->> 'atribuidas')::integer, 0),
      'fichas_fora_do_lote', coalesce((v_fichas ->> 'fora_do_lote')::integer, 0))),
    null);
  update public."TL_PRE_CLASSIFICACAO" set
    "DS_MENSAGEM" = 'Edital de treinamento: resultado do cálculo Python gravado pelo preparar (sem valor oficial).'
   where "CO_EXECUCAO" = v_exec;
  return v_fichas;
end;
$$;
comment on function private."FC_PRE_CLASSIFICAR_TREINAMENTO"(uuid, jsonb) is
  'Edital de treinamento: grava a pré-classificação calculada pelo Python (python/monitora/avaliacao_documental) para os fictícios, pelas mesmas RPCs do job (gravar_pre_classificacao_vaga, abrir_fichas_pre_classificacao, finalizar_pre_classificacao), numa execução treinamento-<id> que fica fora dos painéis. Idempotente; recusa edital real.';
revoke all on function private."FC_PRE_CLASSIFICAR_TREINAMENTO"(uuid, jsonb) from public, anon, authenticated;
grant execute on function private."FC_PRE_CLASSIFICAR_TREINAMENTO"(uuid, jsonb) to service_role;

-- ── 5. O edital de treinamento da Saúde Indígena ──────────────────────────
create or replace function private."FC_PREPARAR_TREINAMENTO_SI"(p_grupo text, p_planilha text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  c_numero constant text := '991/2099';
  c_edital constant text := 'Treinamento – Saúde Indígena (991/2099)';
  c_unidade constant text := 'DSEI Treinamento';
  c_origem constant text := 'treinamento';
  v_area constant text := 'saude-indigena';
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_id uuid;
  v_planilha text := p_planilha;
  v_grupo text := p_grupo;
  v_enun_fund text[];
  v_enun_sup text[];
  v_enun_tec text[];
  v_perguntas jsonb;
  v_roteiro uuid;
  v_origem_roteiro uuid;
  v_regra_classif uuid;
  v_config_classif jsonb;
  v_modelo public."TB_REGRA_ANALISE_MODELO";
  v_config_analise jsonb;
  v_resultado jsonb;
begin
  -- Vagas, candidatos e notas fictícios (nada de dado pessoal real).
  create temporary table if not exists tmp_treino_vaga (
    vaga text primary key, ordem smallint, cargo text, imediatas integer, cr boolean, nivel text
  ) on commit drop;
  truncate tmp_treino_vaga;
  insert into tmp_treino_vaga values
    ('9909910001', 1, 'Enfermeiro', 2, true, 'Superior'),
    ('9909910002', 2, 'Técnico de Enfermagem', 3, true, 'Técnico'),
    ('9909910003', 3, 'Agente Indígena de Saúde (AIS)', 2, false, 'Fundamental');

  create temporary table if not exists tmp_treino_candidato (
    n integer primary key, codigo text, nome text, email text, vaga text, nota numeric,
    modalidade text, indigena boolean, nascimento date
  ) on commit drop;
  truncate tmp_treino_candidato;
  insert into tmp_treino_candidato
  select n, 'TREINO-' || lpad(n::text, 2, '0'), 'Candidato Teste ' || lpad(n::text, 2, '0'),
         'candidato.teste' || lpad(n::text, 2, '0') || '@exemplo.invalid',
         case when n <= 5 then '9909910001' when n <= 11 then '9909910002' else '9909910003' end,
         (array[82.5, 77, 71.25, 64, 58.5, 88, 79.5, 73, 69.75, 61, 55.5, 74, 68.25, 62, 51.5])[n],
         case when n in (3, 8, 12, 14) then 'Indígenas' else 'Ampla Concorrência' end,
         n in (3, 8, 12, 13, 14),
         make_date(1970 + n * 2, 1 + (n % 12), 1 + n)
    from generate_series(1, 15) n;

  -- O edital.
  select m.id into v_id
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" = v_area and m."ST_TREINAMENTO" = 'S'
   order by m.created_at, m.id
   limit 1;
  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA" (
      processo, edital, sigla_unidade, tipo_unidade, unidade, uf, ciclo, cargos, vagas_total, inscritos,
      aptos_analise, data_inicio, data_fim, status, etapa, risco, responsavel, observacoes,
      observacoes_internas, ativo, origem_carga, cronograma_origem, "CO_AREA", "ST_TREINAMENTO")
    values (
      'TREINAMENTO', c_edital, 'TREINO', 'DSEI', c_unidade, 'DF', '2099',
      'Enfermeiro; Técnico de Enfermagem; Agente Indígena de Saúde (AIS)', 7, 15, 15,
      v_hoje - 45, v_hoje + 30, 'Em andamento', 'Entrevistas', 'Baixo', 'Treinamento',
      'Edital de treinamento: dados fictícios, sem valor oficial.',
      'Criado por private."FC_PREPARAR_EDITAL_TREINAMENTO". Reinicie em Editais (admin).',
      true, 'TREINAMENTO', 'MANUAL', v_area, 'S')
    returning id into v_id;
  end if;

  -- Cronograma relativo a hoje: inscrições já passaram, avaliação documental e
  -- entrevistas em andamento (FC_JANELA_ENTREVISTA fica aberta).
  if not exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = v_id) then
    insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, tipo_atividade, data_inicio, data_fim, origem, observacao)
    select v_id, x.ordem, x.atividade, x.tipo, v_hoje + x.ini, v_hoje + x.fim, 'MANUAL', 'Treinamento'
      from (values
        (1, 'Publicação do Edital', 'PUBLICACAO', -45, -45),
        (2, 'Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos', 'INSCRICAO', -44, -30),
        (3, 'Avaliação Documental e de Títulos', 'ANALISE', -29, 10),
        (4, 'Resultado Preliminar da Avaliação Documental e de Títulos', 'RESULTADO', -12, -12),
        (5, 'Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos', 'RECURSO', -11, -9),
        (6, 'Resultado Final da Avaliação Documental e de Títulos', 'RESULTADO', -7, -7),
        (7, 'Convocação para a Entrevista', 'CONVOCACAO', -5, -5),
        (8, 'Período de Entrevistas', 'ENTREVISTA', -2, 12),
        (9, 'Resultado Preliminar das Entrevistas', 'RESULTADO', 15, 15),
        (10, 'Prazo para recursos referentes ao resultado preliminar das entrevistas', 'RECURSO', 16, 18),
        (11, 'Resultado final da Entrevista', 'RESULTADO', 21, 21),
        (12, 'Resultado final do Processo Seletivo', 'RESULTADO', 25, 25)
      ) x(ordem, atividade, tipo, ini, fim);
  end if;

  -- Quadro de vagas.
  if not exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = v_id and q."ST_REGISTRO_ATIVO" = 'S') then
    insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO",
      "DS_MODALIDADE_VAGA", "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
    select v_id, t.ordem, t.cargo, c_unidade,
           jsonb_build_object('Ampla Concorrência', t.imediatas, 'Indígenas', null),
           t.imediatas, case when t.cr then 'S' else 'N' end, 'MANUAL', 'treinamento', v_uid
      from tmp_treino_vaga t;
  end if;

  -- Análises curriculares fictícias (aprovadas): a fonte da Classificação e da convocação.
  insert into public."TB_ANALISE_CURRICULAR" (grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, cpf_hash,
    categoria, modalidade_concorrencia, status_consolidado, etapa, responsavel_analise, data_analise,
    nota_final_ajustada, pontuacao_escolaridade, pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional, pontuacao_criterio_etnico, experiencia_saude_indigena_total,
    experiencia_atencao_basica_total, analise, ativo, id_origem, data_nascimento, nota_empregare,
    pcd, origem_planilha, chave_natural, "CO_AREA", "CO_PLANILHA")
  select v_grupo, c_unidade, c_edital, c.vaga, v.cargo, c.nome, null,
         v.nivel, c.modalidade, 'Aprovado', 'Análise concluída', 'Treinamento', v_hoje - 14,
         c.nota, round(c.nota * 0.3, 2), round(c.nota * 0.1, 2), round(c.nota * 0.4, 2),
         case when c.indigena then 14 else 0 end, (c.n % 5) * 6, (c.n % 4) * 9,
         'Análise fictícia do edital de treinamento.', true, c.codigo, c.nascimento, round(c.nota * 0.9, 2),
         'Não', c_origem, c_origem || '|' || v_area || '|' || c.codigo, v_area, v_planilha
    from tmp_treino_candidato c
    join tmp_treino_vaga v on v.vaga = c.vaga
  on conflict (chave_natural) do nothing;

  -- Roteiro de exemplo, com os aspectos (id fixo por área: o reinício reaproveita). É a
  -- versão seguinte do roteiro de exemplo sem aspectos, quando ele já existe.
  v_roteiro := md5('agsus-treinamento-roteiro-aspectos-' || v_area)::uuid;
  if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    v_origem_roteiro := md5('agsus-treinamento-roteiro-' || v_area)::uuid;
    if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem_roteiro) then
      v_origem_roteiro := v_roteiro;
    end if;
    update public."TB_ROTEIRO_ENTREVISTA" set "ST_ATIVO" = 'N'
     where "CO_ROTEIRO_ORIGEM" = v_origem_roteiro and "ST_ATIVO" = 'S';
    insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
      "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
      "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE",
      "DS_CONVOCACAO_PADRAO", "DS_BANCA_PADRAO", "ST_ATIVO")
    values (v_roteiro, v_origem_roteiro,
      (select coalesce(max(r."NU_VERSAO"), 0) + 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem_roteiro),
      v_area, 'Treinamento — Entrevista individual (exemplo)',
      'Roteiro de exemplo do edital de treinamento: 4 competências; cada avaliador dá de 0 a 5 em 3 aspectos (Conceitua, Propriedade, Profundidade) e a nota dele é a média; apto com 8 pontos e 2 em cada competência (abaixo de 2 elimina).',
      'Entrevista Individual', 'NIVEIS', 1, '[]'::jsonb, 8, '[]'::jsonb, 'S',
      '["Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa)", "Maior pontuação na Avaliação Documental e de Títulos", "Maior pontuação na Entrevista"]'::jsonb,
      'S', '{"multiplo_imediatas": 3, "posicao_cadastro_reserva": 5}'::jsonb,
      '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'S');
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO")
    values (v_roteiro, 1, 'Comunicação e escuta', 'Expressa-se com clareza e escuta o outro.', 5, 1, 2),
           (v_roteiro, 2, 'Trabalho em equipe', 'Colabora e compartilha responsabilidades.', 5, 1, 2),
           (v_roteiro, 3, 'Respeito à diversidade cultural', 'Reconhece e respeita os modos de vida dos povos indígenas.', 5, 1, 2),
           (v_roteiro, 4, 'Conhecimento da função', 'Conhece as atribuições do cargo no território.', 5, 1, 2);
    insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
    values (v_roteiro, 0, 'Não demonstrou', null), (v_roteiro, 1, 'Insuficiente', null),
           (v_roteiro, 2, 'Básico', null), (v_roteiro, 3, 'Adequado', null),
           (v_roteiro, 4, 'Bom', null), (v_roteiro, 5, 'Excelente', null);
    insert into public."TB_ROTEIRO_ASPECTO" ("CO_ROTEIRO", "NU_ORDEM", "NO_ASPECTO")
    values (v_roteiro, 1, 'Conceitua'), (v_roteiro, 2, 'Propriedade'), (v_roteiro, 3, 'Profundidade');
  end if;

  -- Entrevista configurada (roteiro, banca, vagas imediatas e avaliadores fictícios).
  if not exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_CONVOCACAO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
    values (v_id, v_roteiro, '{}'::jsonb,
            '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'SECRETARIA', v_uid);
  end if;
  insert into public."TB_ENTREVISTA_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "QT_VAGA_IMEDIATA")
  select v_id, t.vaga, t.imediatas from tmp_treino_vaga t
   where not exists (select 1 from public."TB_ENTREVISTA_VAGA" x where x."CO_MONITORAMENTO" = v_id and x."CO_VAGA" = t.vaga);
  if not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA")
    values (v_id, 'Avaliador Teste 1', 'AgSUS', 1), (v_id, 'Avaliador Teste 2', 'DSEI', 1);
  end if;

  -- Regra da classificação (formato de src/lib/classificacao/regra.js) e a lista de convocação.
  select r."CO_REGRA_CLASSIFICACAO" into v_regra_classif
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v_id;
  if v_regra_classif is null then
    v_config_classif := jsonb_build_object(
      'schema', 1,
      'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
      'etapas', jsonb_build_object('documental', true, 'entrevista', true),
      'documental', jsonb_build_object('situacoes_aptas', jsonb_build_array('Aprovado'), 'nota_minima', null,
                                       'nota_minima_por_nivel', '{}'::jsonb, 'niveis_por_cargo', '[]'::jsonb,
                                       'nivel_padrao', null, 'parciais', '[]'::jsonb),
      'entrevista', jsonb_build_object('nota_minima', 8, 'nota_minima_competencia', 2, 'nota_eliminatoria_ate', 0,
                                       'competencias', '[]'::jsonb, 'exige_comparecimento', true,
                                       'inapto_elimina', true, 'so_parecer', false),
      'composicao', jsonb_build_object('componentes', jsonb_build_array(
                                         jsonb_build_object('codigo', 'DOCUMENTAL', 'peso', 1),
                                         jsonb_build_object('codigo', 'ENTREVISTA', 'peso', 1)),
                                       'casas', 2, 'arredondamento', 'MEIO_PARA_CIMA'),
      'desempate', '[]'::jsonb,
      'listas', jsonb_build_object('PRELIMINAR', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'ENTREVISTA', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'FINAL', jsonb_build_object('empate', 'CRITERIOS')),
      'empate_final', jsonb_build_object('metodo', 'MESMA_POSICAO', 'numeracao', 'DENSA'),
      'modalidades', jsonb_build_array(jsonb_build_object(
                       'codigo', 'AC', 'nome', 'Ampla concorrência', 'percentual', null,
                       'arredondamento', 'MEIO_PARA_CIMA', 'lista_propria', false, 'recomeca_posicao', true,
                       'aparece_na_geral', true, 'remanejar_para', '[]'::jsonb, 'agrupa', '[]'::jsonb)),
      'cotas', jsonb_build_object('minimo_vagas_reserva', 0, 'acumulo', 'TODAS'),
      'convocacao', jsonb_build_object('multiplo_vagas', 3, 'posicao_max_cr', 5, 'incluir_empatados', true,
                                       'excecoes', '[]'::jsonb),
      'rodape', 'TREINAMENTO — sem valor oficial.',
      'documento', jsonb_build_object('edital', 'TREINAMENTO ' || c_numero, 'unidade', c_unidade));
    perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_config_classif);
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (v_id, 1, v_uid) returning "CO_REGRA_CLASSIFICACAO" into v_regra_classif;
    insert into public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra_classif, 1, v_config_classif, 'MESMA_POSICAO', 'Edital de treinamento', v_uid);
  end if;

  if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l where l."CO_MONITORAMENTO" = v_id and l."TP_LISTA" = 'CONVOCACAO') then
    with ordenados as (
      select a.id, a.candidato, a.nota_final_ajustada as nota, a.codigo_vaga,
             rank() over (partition by a.codigo_vaga order by a.nota_final_ajustada desc) as posicao
        from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = v_area and a.ativo and private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and private."FC_NUMERO_EDITAL"(a.edital) = c_numero
    ),
    vagas as (
      select t.ordem, jsonb_build_object(
               'codigo', t.vaga, 'chave', t.vaga, 'cargo', t.cargo, 'lotacao', c_unidade,
               'cabecalho', 'Vaga ' || t.vaga || ' — ' || t.cargo || ' — ' || c_unidade,
               'total', t.imediatas, 'cadastro_reserva', t.cr, 'origem_das_vagas', 'QUADRO',
               'limite_convocacao', null,
               'geral', coalesce((select jsonb_agg(jsonb_build_object(
                          'analise_id', o.id, 'nome', o.candidato, 'posicao', o.posicao, 'nota', o.nota,
                          'modalidades', '[]'::jsonb, 'situacao', 'Classificado') order by o.posicao, o.candidato)
                          from ordenados o where o.codigo_vaga = t.vaga), '[]'::jsonb),
               'listas', '{}'::jsonb, 'eliminados', '[]'::jsonb) as vaga
        from tmp_treino_vaga t
    )
    select jsonb_build_object(
             'schema', 1, 'tipo', 'CONVOCACAO', 'casas', 2, 'avisos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
             'edital', jsonb_build_object('id', v_id, 'edital', c_edital, 'unidade', c_unidade, 'treinamento', true),
             'rodape', 'TREINAMENTO — sem valor oficial.', 'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
             'modalidades', '[]'::jsonb, 'empate_final', 'MESMA_POSICAO', 'regra_versao', 1,
             'totais', jsonb_build_object('vagas', (select sum(t.imediatas) from tmp_treino_vaga t),
                                          'avisos', 0, 'elegiveis', (select count(*) from ordenados),
                                          'candidatos', (select count(*) from ordenados), 'eliminados', 0, 'pendencias', 0),
             'vagas', (select jsonb_agg(v.vaga order by v.ordem) from vagas v))
      into v_resultado;
    insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
      "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "CO_USUARIO")
    values (v_id, 'CONVOCACAO', v_regra_classif, 1, v_resultado,
            encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'),
            (v_resultado #>> '{totais,elegiveis}')::integer, v_uid);
  end if;

  -- Avaliação documental: inscrições e questionários no formato da exportação da Empregare,
  -- com os enunciados do questionário NERSSI da Saúde Indígena (o do Edital 101/2026; nos
  -- níveis superior e técnico, as perguntas de escolaridade e formação do mesmo jeito).
  v_enun_fund := array[
       $q$Nome completo:(conforme registrado em documento, sem abreviações)$q$,
       $q$Número do CPF:(vinculado ao nome informado acima)Ex: 000.000.000-00$q$,
       $q$Data de nascimento (dd/mm/aaaa):dd/mm/aaaa = dia/mês/ano$q$,
       $q$Anexe um documento de identificação com foto ( frente e verso).Conforme orientação do item 6,4, alínea "c", do Edital.$q$,
       $q$Indique em qual sistema de concorrência deseja se inscrever:$q$,
       $q$Você é indígena e mora em aldeia?(será necessária a comprovação)Ser Indígena: 8 pontosResidir em Aldeia: 6 pontosMáximo: 14 pontos$q$,
       $q$Anexe sua identificação e/ou Declaração de Pertencimento Étnico e/ou de moradia em aldeia:(Obrigatório o envio de identificação étnica, conforme item 6.4 do edital, alínea "h")(Para resid$q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos:Anexe, neste campo, a autodeclaração conforme o modelo constante no Anexo IX.Importante: Candidatos(as) que $q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos, grave um vídeo, em fundo branco, com duração máxima de 20 segundos, apresentando o seu nome completo e a co$q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos, anexe uma foto de frente e uma foto de perfil, reunidas em um único arquivo, preferencialmente no formato $q$,
       $q$Candidatos(as) que optaram por concorrer às vagas destinadas a Quilombolas:Anexe, neste campo, a autodeclaração, conforme o modelo constante no Anexo XI e as orientações descritas no ite$q$,
       $q$Candidatos(as) que concorrem às vagas destinadas a PCD devem anexar aqui o laudo médico, devidamente assinado por médico(a) com registro ativo no CRM, conforme descrito no item 4 do Edit$q$,
       $q$Você possui nível fundamental completo ?(será necessária a comprovação)$q$,
       $q$Anexe certificado ou histórico escolar de conclusão de nível fundamental:(frente e verso de acordo com o item 8.12.2 do Edital)Se desejar unir as páginas em arquivo único, favor acessar $q$,
       $q$Você possui ensino médio completo ?(será necessária a comprovação)$q$,
       $q$Anexe o certificado de conclusão de nível médio.(frente e verso, de acordo com o item 8.12.2 do Edital)Se desejar unir as páginas em arquivo único, favor acessar o site: Unir PDF.$q$,
       $q$Selecione sua Experiência Profissional na área/vaga em que concorre:(0,2 ponto por mês)&nbsp;Pontuação máxima: 10 pontos.Conforme o item 8.15.2.1 do Edital,para candidatos indígenas, ind$q$,
       $q$Anexe o comprovante de Experiência Profissional na vaga em que concorre:Serão aceitos comprovante de acordo com o item 8.15 do edital e suas respectivas alíneas e subitens.&nbsp;Se preci$q$,
       $q$Você possui cônjuge, companheiro(a), parentes até o terceiro grau ou qualquer conhecido que integre o quadro de trabalhadores da AgSUS?$q$,
       $q$Se respondeu SIM na pergunta anterior, por gentileza informe o nome do trabalhador da AgSUS.$q$,
       $q$Você está com contrato de trabalho ativo na AgSUS ou foi desligado nos últimos 6 meses?$q$,
       $q$Você possui interesse em atuar em outros DSEI?$q$,
       $q$TERMO DE RESPONSABILIDADE PELAS INFORMAÇÕES DECLARADASDeclaro que todas as informações prestadas neste Formulário de Inscrição são verdadeiras e correspondem aos documentos comprobatório$q$,
       $q$Declaro estar ciente de que meus dados pessoais poderão ser coletados, tratados e compartilhados com órgãos competentes, exclusivamente para fins de participação em processos seletivos e$q$];
  v_enun_sup := v_enun_fund[1:12] || array[
    'Você possui graduação na área da vaga ?(será necessária a comprovação)',
    'Anexe o diploma de graduação na área da vaga:(frente e verso de acordo com o item 8.12.2 do Edital)',
    'Qual sua titulação acadêmica na área da vaga ?(será necessária a comprovação)Especialização: 1 pontoMestrado ou Residência: 2 pontosDoutorado: 3 pontos',
    'Anexe os comprovantes de titulação acadêmica.(frente e verso, de acordo com o item 8.12.2 do Edital)'] || v_enun_fund[17:];
  v_enun_tec := v_enun_fund[1:12] || array[
    'Você possui curso técnico na área da vaga ?(será necessária a comprovação)',
    'Anexe o certificado do curso técnico na área da vaga:(frente e verso de acordo com o item 8.12.2 do Edital)',
    'Você possui especialização técnica ou graduação na área da vaga ?(será necessária a comprovação)Especialização técnica: 2 pontosGraduação: 4 pontos',
    'Anexe o certificado de especialização técnica ou o diploma de graduação.(frente e verso, de acordo com o item 8.12.2 do Edital)'] || v_enun_fund[17:];

  -- Código de vaga fictícia já usado por vaga real ou carregada pelo robô: recusa sem mexer.
  if exists (select 1 from public."TB_EMPREGARE_VAGA" v join tmp_treino_vaga t on t.vaga = v."CO_VAGA"
              where v."CO_MONITORAMENTO" is distinct from v_id or v."CO_SYNC" is not null) then
    raise exception 'Vaga fictícia do treinamento já existe fora dele (ou veio do robô da Empregare): nada foi feito' using errcode = '23514';
  end if;

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "TP_SITUACAO", "DS_COLUNA", "NO_ARQUIVO",
    "QT_CANDIDATO_ATIVO", "QT_LINHA_ARQUIVO", "QT_RECEBIDA", "DS_MENSAGEM", "DT_ULTIMA_CARGA")
  select t.vaga, v_id, 'GRAVADA',
         private."FC_TREINO_COLUNAS"('NÍVEL ' || upper(t.nivel) || ' - DSEI TREINAMENTO',
           case t.nivel when 'Superior' then v_enun_sup when 'Técnico' then v_enun_tec else v_enun_fund end, false),
         'treinamento-' || t.vaga || '.xlsx',
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         'Carga fictícia do edital de treinamento.', now()
    from tmp_treino_vaga t
  on conflict ("CO_VAGA") do update set
    "DS_COLUNA" = excluded."DS_COLUNA"
   where public."TB_EMPREGARE_VAGA"."CO_MONITORAMENTO" = v_id and public."TB_EMPREGARE_VAGA"."CO_SYNC" is null;

  -- As respostas batem com as perguntas da regra (SI26-PARINTINS, abaixo); a ART
  -- ("x,x/30,0") é a soma declarada: étnico (8 + 6) + formação + 0,2 por mês de experiência.
  insert into public."TB_EMPREGARE_CANDIDATO" ("CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO", "DS_EMAIL", "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA")
  select x.vaga, 'cod:' || x.codigo, 'CODIGO', x.codigo, x.nome, x.email, null, '(00) 00000-0000', x.nascimento,
         'Inscrito', x.candidatura::timestamp at time zone 'America/Sao_Paulo', x.original,
         encode(sha256(convert_to(x.original::text, 'UTF8')), 'hex')
    from (
      select c.*, r.candidatura,
             private."FC_TREINO_INSCRICAO"('NÍVEL ' || upper(t.nivel) || ' - DSEI TREINAMENTO',
               case t.nivel when 'Superior' then v_enun_sup when 'Técnico' then v_enun_tec else v_enun_fund end, false,
               jsonb_build_object(
                 'codigo', c.codigo, 'nome', c.nome, 'email', c.email, 'nascimento', c.nascimento,
                 'candidatura', r.candidatura, 'uf', 'DF', 'situacao', 'INSCRITO',
                 'quest', r.quest,
                 'art', replace(to_char(r.etnico + r.formacao + least(10, r.meses * 0.2), 'FM990.0'), '.', ',') || '/30,0',
                 'modal', case when c.modalidade = 'Indígenas' then '"Indígenas"' else '"Ampla concorrência"' end,
                 'etnico', case when r.etnico = 14 then '"Sou indígena", "Moro em aldeia"'
                                when r.etnico = 8 then '"Sou indígena"' else '"Não se aplica"' end,
                 'escol', '"Sim"',
                 'especial', case t.nivel
                               when 'Superior' then case r.formacao when 2 then '"Mestrado ou Residência"' when 1 then '"Especialização"' else '"Não possuo"' end
                               when 'Técnico' then case r.formacao when 4 then '"Graduação na área"' when 2 then '"Especialização técnica na área"' else '"Não possuo"' end
                               else case r.formacao when 6 then '"Certificado de conclusão de nível médio porinstituição reconhecida pelo MEC"' else '"Não possuo"' end
                             end,
                 'exp', case when r.meses = 0 then '"Não possuo"'
                             when r.meses < 12 then '"' || r.meses || ' meses"'
                             when r.meses % 12 = 0 then '"' || (r.meses / 12) || case when r.meses = 12 then ' ano"' else ' anos"' end
                             else '"' || (r.meses / 12) || case when r.meses < 24 then ' ano e ' else ' anos e ' end
                                  || (r.meses % 12) || case when r.meses % 12 = 1 then ' mês"' else ' meses"' end
                        end,
                 'conjuge', '"Não"', 'contrato', '"Não"',
                 'termo', '"Declaro que li, compreendi e concordo com as condições acima.&nbsp;"', 'declaro', '"Sim"',
                 'reprovado', 'NÃO',
                 'nivel_formacao', t.nivel, 'curso_formacao', t.cargo)) as original
        from tmp_treino_candidato c
        join tmp_treino_vaga t on t.vaga = c.vaga
       cross join lateral (
         select v_hoje - 40 + (c.n % 10) as candidatura,
                -- O último ficou com o questionário em andamento (cai na eliminação automática).
                case when c.n = 15 then 'EM ANDAMENTO' else 'FINALIZADO' end as quest,
                case when c.n in (3, 12, 14) then 14 when c.n in (8, 13) then 8 else 0 end as etnico,
                case t.nivel when 'Superior' then (c.n % 3) when 'Técnico' then (array[0, 2, 4])[1 + c.n % 3]
                             else case when c.n % 2 = 0 then 6 else 0 end end as formacao,
                (array[0, 3, 6, 14, 26, 50, 9, 18, 31, 44, 4, 12, 22, 7, 60])[c.n] as meses
       ) r
    ) x
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do update set
    "DS_COLUNA_ORIGINAL" = excluded."DS_COLUNA_ORIGINAL", "DS_HASH_LINHA" = excluded."DS_HASH_LINHA"
   where public."TB_EMPREGARE_CANDIDATO"."CO_SYNC" is null
     and exists (select 1 from public."TB_EMPREGARE_VAGA" v
                  where v."CO_VAGA" = public."TB_EMPREGARE_CANDIDATO"."CO_VAGA" and v."CO_MONITORAMENTO" = v_id and v."CO_SYNC" is null)
     and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" p
                      where p."CO_EMPREGARE_CANDIDATO" = public."TB_EMPREGARE_CANDIDATO"."CO_EMPREGARE_CANDIDATO");

  -- A avaliação documental do edital é feita no MONITORA.
  insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM")
  values (v_id, 'MONITORA')
  on conflict ("CO_MONITORAMENTO") do nothing;

  -- Regra da avaliação documental: a do edital SI real mais recente em andamento com regra
  -- própria — nenhum edital SI tem regra conferida no MONITORA ainda; o mais recente com o
  -- modelo do próprio PDF é o 111/2026 (DSEI Parintins, modelo SI26-PARINTINS) —, com as
  -- perguntas do questionário NERSSI ligadas aos blocos. Situação CONFERIR: conferir faz
  -- parte do treino. A antiga (SI26-ALSE) fica no histórico.
  select * into v_modelo
    from public."TB_REGRA_ANALISE_MODELO" m
   where m."CO_MODELO" = 'SI26-PARINTINS' and m."ST_ATIVO" = 'S';
  if v_modelo."CO_MODELO" is not null then
    v_perguntas := jsonb_build_object(
      'IDENTIDADE', jsonb_build_array('Anexe um documento de identificação com foto'),
      'MODALIDADE', jsonb_build_array('Indique em qual sistema de concorrência'),
      'ESCOLARIDADE', jsonb_build_array('Você possui nível fundamental completo', 'Anexe certificado ou histórico escolar de conclusão de nível fundamental',
                                        'Você possui curso técnico na área da vaga', 'Anexe o certificado do curso técnico na área da vaga',
                                        'Você possui graduação na área da vaga', 'Anexe o diploma de graduação na área da vaga'),
      'ETNICO', jsonb_build_array('Você é indígena e mora em aldeia', 'Anexe sua identificação e/ou Declaração de Pertencimento Étnico'),
      'COTA_PP', jsonb_build_array('Candidatos(as) que optaram por concorrer às vagas destinadas a Pretos e Pardos'),
      'COTA_PI', jsonb_build_array('Anexe sua identificação e/ou Declaração de Pertencimento Étnico'),
      'COTA_PQ', jsonb_build_array('Candidatos(as) que optaram por concorrer às vagas destinadas a Quilombolas'),
      'COTA_PCD', jsonb_build_array('Candidatos(as) que concorrem às vagas destinadas a PCD'),
      'FORMACAO', jsonb_build_array('Você possui ensino médio completo', 'Anexe o certificado de conclusão de nível médio',
                                    'Você possui especialização técnica ou graduação na área da vaga', 'Anexe o certificado de especialização técnica ou o diploma de graduação',
                                    'Qual sua titulação acadêmica na área da vaga', 'Anexe os comprovantes de titulação acadêmica'),
      'EXPERIENCIA', jsonb_build_array('Selecione sua Experiência Profissional na área/vaga em que concorre', 'Anexe o comprovante de Experiência Profissional'));
    v_config_analise := jsonb_set(v_modelo."DS_CONFIGURACAO", '{blocos}', coalesce((
        select jsonb_agg(b.bloco || case when v_perguntas ? (b.bloco ->> 'codigo')
                                         then jsonb_build_object('perguntas', v_perguntas -> (b.bloco ->> 'codigo'))
                                         else '{}'::jsonb end order by b.ordem)
          from jsonb_array_elements(v_modelo."DS_CONFIGURACAO" -> 'blocos') with ordinality b(bloco, ordem)), '[]'::jsonb))
      || jsonb_build_object('modelo', v_modelo."CO_MODELO", 'edital_rotulo', 'Edital ' || c_numero || ' (TREINAMENTO)');
    perform private."FC_REGRA_DO_TREINAMENTO"(v_id, v_config_analise, 'CONFERIR',
      'Edital de treinamento: regra do Edital 111/2026 (modelo SI26-PARINTINS) com as perguntas do questionário NERSSI', v_uid);
  end if;

  return v_id;
end;
$$;
comment on function private."FC_PREPARAR_TREINAMENTO_SI"(text, text) is
  'Edital de treinamento da Saúde Indígena ("Treinamento – Saúde Indígena (991/2099)", unidade "DSEI Treinamento"): cronograma relativo a hoje (janela de entrevista aberta), quadro, 15 candidatos fictícios (análise aprovada, lista de convocação, inscrição e questionário NERSSI no formato da Empregare), roteiro de exemplo, regra da classificação e regra da avaliação documental do Edital 111/2026 (SI26-PARINTINS) com as perguntas ligadas. Chamada só por private."FC_PREPARAR_EDITAL_TREINAMENTO".';
revoke all on function private."FC_PREPARAR_TREINAMENTO_SI"(text, text) from public, anon, authenticated;
grant execute on function private."FC_PREPARAR_TREINAMENTO_SI"(text, text) to service_role;

-- ── 6. O edital de treinamento de Projetos (espelho do Edital 93/2026) ─────
create or replace function private."FC_PREPARAR_TREINAMENTO_PROJETOS"(p_grupo text, p_planilha text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  c_area constant text := 'projetos';
  c_numero constant text := '992/2099';
  c_edital constant text := 'Treinamento – Projetos (992/2099)';
  c_unidade constant text := 'Escritório Treinamento';
  c_origem constant text := 'treinamento';
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_id uuid;
  v_regra_classif uuid;
  v_config_classif jsonb;
  v_config_analise jsonb;
  -- A regra da avaliação documental: cópia (só o JSON) da versão 7, vigente e conferida,
  -- do Edital 93/2026 (TH_REGRA_ANALISE), com o rótulo do treinamento. Editar no treino
  -- grava versão nova da regra DESTE edital; o 93/2026 não muda.
  c_regra constant jsonb := $regra93${
    "lote": {
      "base": "NOTA_MINIMA",
      "fixo": null,
      "multiplo": 3,
      "inclui_cr": true,
      "linha_anda": true,
      "item_edital": "8.2.6",
      "nota_minima": 15,
      "por_modalidade": false,
      "inclui_empatados": true,
      "publica_reposicao": false
    },
    "corte": {
      "fonte": "REGRA_CLASSIFICACAO",
      "item_edital": "8.2.6"
    },
    "blocos": [
      {
        "tipo": "DOCUMENTO",
        "codigo": "IDENTIDADE",
        "titulo": "Documento de identificação oficial com foto",
        "efeitos": {
          "NAO_ENVIADO": "ELIMINA",
          "NAO_CONFORME": "ELIMINA"
        },
        "motivos": [
          {
            "texto": "Documento de identificação fora da lista do subitem 6.5 (ex.: certidão, CPF, título de eleitor, carteira de estudante).",
            "codigo": "NAO_ACEITO",
            "efeito": "ELIMINA",
            "item_edital": "6.5.1"
          },
          {
            "texto": "Documento de identificação ilegível, não identificável ou danificado.",
            "codigo": "ILEGIVEL",
            "efeito": "ELIMINA",
            "item_edital": "6.5.1"
          }
        ],
        "perguntas": [
          "Anexe o documento de identificação",
          "Anexe um documento de identificação"
        ],
        "item_edital": "6.5"
      },
      {
        "tipo": "DOCUMENTO",
        "codigo": "ESCOLARIDADE",
        "titulo": "Formação exigida pela vaga (diploma ou certificado, frente e verso)",
        "efeitos": {
          "NAO_ENVIADO": "ELIMINA",
          "NAO_CONFORME": "ELIMINA"
        },
        "motivos": [
          {
            "texto": "Não comprovou a formação acadêmica exigida para a vaga.",
            "codigo": "NAO_COMPROVADA",
            "efeito": "ELIMINA",
            "item_edital": "8.2.1"
          },
          {
            "texto": "Diploma ou certificado sem frente ou verso.",
            "codigo": "SEM_FRENTE_VERSO",
            "efeito": "ELIMINA",
            "item_edital": "6.6.1"
          },
          {
            "texto": "Curso diverso do exigido para a vaga.",
            "codigo": "CURSO_DIVERSO",
            "efeito": "ELIMINA",
            "item_edital": "8.2.1"
          }
        ],
        "perguntas": [
          "Você possui Graduação na área da vaga",
          "Você possui Ensino Médio completo e Curso Técnico",
          "Anexe a comprovação de Nível",
          "Anexe a comprovação de conclusão do Ensino Médio"
        ],
        "item_edital": "8.2.1"
      },
      {
        "tipo": "DOCUMENTO",
        "codigo": "REGISTRO_CONSELHO",
        "titulo": "Registro ativo no conselho de classe, quando exigido",
        "efeitos": {
          "NAO_ENVIADO": "ELIMINA",
          "NAO_CONFORME": "ELIMINA"
        },
        "motivos": [
          {
            "texto": "Não apresentou registro ativo no conselho de classe exigido para a vaga.",
            "codigo": "SEM_REGISTRO",
            "efeito": "ELIMINA",
            "item_edital": "6.4"
          }
        ],
        "perguntas": [
          "Você possui registro profissional ativo",
          "Anexe o comprovante do seu registro profissional"
        ],
        "item_edital": "6.4"
      },
      {
        "tipo": "COTA",
        "codigo": "COTA_PP",
        "titulo": "Pretos e pardos (autodeclaração)",
        "efeitos": {
          "CONFORME": "ENCAMINHA_HETEROIDENTIFICACAO",
          "NAO_ENVIADO": "SEGUE_AMPLA",
          "NAO_CONFORME": "SEGUE_AMPLA"
        },
        "motivos": [],
        "condicao": "MODALIDADE=PP",
        "perguntas": [
          "Candidatos às vagas destinadas a Pretos ou Pardos",
          "Candidatos concorrendo às vagas destinadas a Pretos ou Pardos"
        ],
        "item_edital": ""
      },
      {
        "tipo": "COTA",
        "codigo": "COTA_PCD",
        "titulo": "Pessoa com deficiência (laudo)",
        "efeitos": {
          "CONFORME": "ENCAMINHA_PERICIA",
          "NAO_ENVIADO": "SEGUE_AMPLA",
          "NAO_CONFORME": "SEGUE_AMPLA"
        },
        "motivos": [],
        "condicao": "MODALIDADE=PCD",
        "perguntas": [
          "Os candidatos que concorrem às vagas destinadas a PcD"
        ],
        "item_edital": ""
      },
      {
        "tipo": "COTA",
        "codigo": "COTA_PI",
        "titulo": "Indígenas (documento de pertencimento étnico, Anexo VI)",
        "efeitos": {
          "CONFORME": "SO_REGISTRO",
          "NAO_ENVIADO": "SEGUE_AMPLA",
          "NAO_CONFORME": "SEGUE_AMPLA"
        },
        "motivos": [
          {
            "texto": "Documento de pertencimento étnico sem a assinatura da liderança local (Anexo VI).",
            "codigo": "SEM_LIDERANCA",
            "efeito": "SEGUE_AMPLA",
            "item_edital": "5.7.5"
          },
          {
            "texto": "Documento de pertencimento étnico fora do modelo do Anexo VI.",
            "codigo": "FORA_DO_MODELO",
            "efeito": "SEGUE_AMPLA",
            "item_edital": "5.7.5"
          }
        ],
        "condicao": "MODALIDADE=PI",
        "perguntas": [
          "Para candidatos que se declaram indígenas"
        ],
        "item_edital": "5.7.5"
      },
      {
        "tipo": "COTA",
        "codigo": "COTA_PQ",
        "titulo": "Quilombolas (declaração de pertencimento, Anexo VII, ou certificado da FCP)",
        "efeitos": {
          "CONFORME": "SO_REGISTRO",
          "NAO_ENVIADO": "SEGUE_AMPLA",
          "NAO_CONFORME": "SEGUE_AMPLA"
        },
        "motivos": [
          {
            "texto": "Declaração de pertencimento sem a assinatura da liderança ou associação local (Anexo VII).",
            "codigo": "SEM_LIDERANCA",
            "efeito": "SEGUE_AMPLA",
            "item_edital": "5.7.6"
          },
          {
            "texto": "Declaração fora do modelo do Anexo VII e sem certificado da Fundação Cultural Palmares.",
            "codigo": "FORA_DO_MODELO",
            "efeito": "SEGUE_AMPLA",
            "item_edital": "5.7.6"
          }
        ],
        "condicao": "MODALIDADE=PQ",
        "perguntas": [
          "Para candidatos que se declaram quilombolas"
        ],
        "item_edital": "5.7.6"
      },
      {
        "teto": 10,
        "tipo": "TITULOS",
        "codigo": "FORMACAO",
        "titulo": "Titulação acadêmica (a maior)",
        "efeitos": {},
        "motivos": [
          {
            "texto": "Certificado de pós-graduação lato sensu sem a carga horária mínima de 360h não foi pontuado.",
            "codigo": "LATO_SENSU_SEM_CH",
            "item_edital": "8.2.10.4"
          }
        ],
        "parcial": "FORMACAO",
        "perguntas": [
          "Qual seu Nível de Titulação Acadêmica",
          "Anexe seu comprovante de Titulação Acadêmica"
        ],
        "cumulativa": false,
        "item_edital": "8.2.6",
        "pontos_por_nivel": {
          "superior": [
            {
              "pontos": 5,
              "titulo": "ESPECIALIZACAO"
            },
            {
              "pontos": 8,
              "titulo": "MESTRADO"
            },
            {
              "pontos": 10,
              "titulo": "DOUTORADO"
            }
          ]
        }
      },
      {
        "teto": 5,
        "tipo": "CURSOS",
        "codigo": "CURSOS",
        "faixas": [
          {
            "pontos": 1,
            "max_horas": 60,
            "min_horas": 40
          },
          {
            "pontos": 2,
            "max_horas": 119,
            "min_horas": 61
          },
          {
            "pontos": 3,
            "max_horas": null,
            "min_horas": 120
          }
        ],
        "titulo": "Cursos de aperfeiçoamento na área da vaga (mínimo 40h)",
        "efeitos": {},
        "motivos": [
          {
            "texto": "Eventos acadêmicos, palestras, workshops, simpósios, seminários, congressos e afins não são pontuados.",
            "codigo": "EVENTO",
            "item_edital": "6.4"
          }
        ],
        "parcial": "CURSOS",
        "perguntas": [
          "Selecione a pontuação relativa à carga horária de Cursos",
          "Anexe os seus Certificados de Conclusão dos Cursos"
        ],
        "por_nivel": {
          "medio": {
            "teto": 10,
            "faixas": [
              {
                "pontos": 2,
                "max_horas": 60,
                "min_horas": 40
              },
              {
                "pontos": 4,
                "max_horas": 119,
                "min_horas": 61
              },
              {
                "pontos": 6,
                "max_horas": null,
                "min_horas": 120
              }
            ]
          },
          "tecnico": {
            "teto": 10,
            "faixas": [
              {
                "pontos": 2,
                "max_horas": 60,
                "min_horas": 40
              },
              {
                "pontos": 4,
                "max_horas": 119,
                "min_horas": 61
              },
              {
                "pontos": 6,
                "max_horas": null,
                "min_horas": 120
              }
            ]
          }
        },
        "item_edital": "8.2.6"
      },
      {
        "teto": 35,
        "tipo": "VINCULOS",
        "codigo": "EXPERIENCIA",
        "titulo": "Experiência na área ou no SUS",
        "efeitos": {},
        "motivos": [
          {
            "texto": "Experiência anterior à data de diplomação não é computada.",
            "codigo": "ANTES_DO_DIPLOMA",
            "item_edital": "8.2.9"
          },
          {
            "texto": "Estágio curricular, monitoria, tutoria, docência, bolsa ou voluntariado não comprovam experiência profissional.",
            "codigo": "ESTAGIO_OU_SIMILAR",
            "item_edital": "8.2.5"
          }
        ],
        "parcial": "EXPERIENCIA",
        "perguntas": [
          "Experiência Profissional em atividades",
          "Anexe o comprovante de Experiência Profissional"
        ],
        "pontuacao": "POR_PERIODO",
        "por_nivel": {
          "medio": {
            "teto": 40,
            "pontos_por_periodo": 4
          },
          "tecnico": {
            "teto": 40,
            "pontos_por_periodo": 4
          }
        },
        "categorias": [
          {
            "codigo": "AREA_OU_SUS",
            "pontua": true,
            "rotulo": "Na área ou no SUS",
            "desempate": null
          }
        ],
        "data_limite": null,
        "item_edital": "8.2.6",
        "item_minimo": "1.1.1 c",
        "dias_por_mes": 30,
        "max_vinculos": 20,
        "minimo_meses": 6,
        "efeito_minimo": "ELIMINA",
        "periodo_meses": 6,
        "pontos_por_mes": 0,
        "desconta_minimo": true,
        "estagio_indigena": {
          "ativo": false,
          "dias_por_mes": 22,
          "horas_por_dia": 8,
          "so_sem_experiencia": true
        },
        "unir_sobreposicao": true,
        "pontos_por_periodo": 5,
        "minimo_conta_estagio": false
      }
    ],
    "modelo": "PROJ26-CURRICULAR",
    "schema": 1,
    "parecer": {
      "APTO": "{edital}\nCandidato(a) HABILITADO(A) na {titulo_etapa} com a pontuação total de {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}",
      "INAPTO_NOTA": "{edital}\nCandidato(a) NÃO HABILITADO(A) por não atingir a nota mínima de {corte} pontos (item {item_corte}). Nota obtida: {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}",
      "observacoes": "\n\nObservações da análise:\n{observacoes}",
      "INAPTO_REQUISITO": "{edital}\nCandidato(a) INABILITADO(A) na {titulo_etapa}, pelo(s) seguinte(s) motivo(s):\n\n{motivos}"
    },
    "revisao": {
      "todas": false,
      "sinais": [],
      "duplo_cego": false,
      "inaptos_nota": false,
      "entrou_pela_linha": false,
      "inaptos_requisito": true,
      "amostra_percentual": 10,
      "divergencia_pontos": null,
      "minimo_por_analista": 0
    },
    "provisoria": {
      "desempate": [
        "IDOSO",
        "EXPERIENCIA_DECLARADA",
        "MAIOR_IDADE"
      ],
      "base_da_nota": "DECLARADA",
      "nota_declarada": [
        {
          "tipo": "OPCAO",
          "pontos": {
            "Mestrado": 8,
            "Doutorado": 10,
            "Não possuo": 0,
            "Especialização": 5
          },
          "parcial": "FORMACAO",
          "pergunta": "Qual seu Nível de Titulação Acadêmica"
        },
        {
          "tipo": "OPCAO",
          "pontos": {
            "1 ponto": 1,
            "2 pontos": 2,
            "3 pontos": 3,
            "4 pontos": 4,
            "5 pontos": 5,
            "6 pontos": 6,
            "7 pontos": 7,
            "8 pontos": 8,
            "9 pontos": 9,
            "10 pontos": 10,
            "Não possuo": 0
          },
          "parcial": "CURSOS",
          "pergunta": "Selecione a pontuação relativa à carga horária de Cursos"
        },
        {
          "tipo": "OPCAO",
          "parcial": "EXPERIENCIA",
          "pergunta": "Experiência Profissional",
          "pontos_por_nivel": {
            "medio": {
              "1 ano": 4,
              "2 anos": 12,
              "3 anos": 20,
              "4 anos": 28,
              "5 anos": 36,
              "1 ano e 6 meses": 8,
              "1 anos e 6 meses": 8,
              "2 anos e 6 meses": 16,
              "3 anos e 6 meses": 24,
              "4 anos e 6 meses": 32,
              "6 meses obrigatórios": 0,
              "5 anos e 6 meses ou mais": 40
            },
            "tecnico": {
              "1 ano": 4,
              "2 anos": 12,
              "3 anos": 20,
              "4 anos": 28,
              "5 anos": 36,
              "1 ano e 6 meses": 8,
              "1 anos e 6 meses": 8,
              "2 anos e 6 meses": 16,
              "3 anos e 6 meses": 24,
              "4 anos e 6 meses": 32,
              "6 meses obrigatórios": 0,
              "5 anos e 6 meses ou mais": 40
            },
            "superior": {
              "1 ano": 5,
              "2 anos": 15,
              "3 anos": 25,
              "4 anos ou mais": 35,
              "1 ano e 6 meses": 10,
              "1 anos e 6 meses": 10,
              "2 anos e 6 meses": 20,
              "3 anos e 6 meses": 30,
              "6 meses obrigatórios": 0
            }
          }
        }
      ],
      "pergunta_experiencia": "Experiência Profissional",
      "eliminacao_automatica": [
        {
          "codigo": "CANCELADO",
          "coluna": "SITUAÇÃO",
          "motivo": "Cancelou a inscrição",
          "quando": [
            "CANCELADO"
          ]
        },
        {
          "codigo": "QUESTIONARIO",
          "exceto": [
            "FINALIZADO"
          ],
          "motivo": "Não finalizou o questionário (decisão da coordenação CORES)",
          "quando": [],
          "coluna_prefixo": "SITUAÇÃO - "
        }
      ],
      "divergencia_tolerancia": 0
    },
    "distribuicao": {
      "modo": "PEGAR_PROXIMO",
      "novos": "MENOS_PENDENTES",
      "criterio": "PARTES_IGUAIS",
      "dias_parada": 3,
      "limite_por_analista": null
    },
    "titulo_etapa": "Avaliação Documental e de Títulos",
    "casas_parecer": 1,
    "edital_rotulo": "Edital 992/2099 (TREINAMENTO)",
    "observacoes_prontas": [
      {
        "texto": "O candidato(a) não anexou o documento da alteração de nome; títulos e experiências em outro nome foram desconsiderados (subitem 8.2.10.7).",
        "codigo": "ALTERACAO_DE_NOME",
        "rotulo": "Alteração de nome sem documento",
        "item_edital": "8.2.10.7"
      },
      {
        "texto": "Nota de experiência profissional diminuída em decorrência do tempo de serviço comprovado: só contam blocos completos de 6 meses além do mínimo exigido (subitens 8.2.2 a 8.2.4).",
        "codigo": "EXPERIENCIA_DIMINUIDA",
        "rotulo": "Nota de experiência diminuída",
        "item_edital": "8.2.3"
      },
      {
        "texto": "Nota de cursos de aperfeiçoamento diminuída: certificados sem relação direta com a área da vaga, abaixo de 40h ou de eventos não foram contabilizados.",
        "codigo": "CURSOS_DIMINUIDA",
        "rotulo": "Nota de cursos diminuída",
        "item_edital": "6.4"
      }
    ]
  }$regra93$::jsonb;
  -- A regra da classificação do 93/2026 (versão 1: nota mínima 15, item 8.2.6, que é o corte
  -- da avaliação documental) com o rodapé do treinamento.
  c_classif constant jsonb := $classif93${
    "cotas": {
      "acumulo": "MAIOR_PERCENTUAL",
      "minimo_vagas_reserva": 0
    },
    "etapas": {
      "documental": true,
      "entrevista": true
    },
    "listas": {
      "FINAL": {
        "empate": "CRITERIOS"
      },
      "ENTREVISTA": {
        "empate": "MESMA_POSICAO"
      },
      "PRELIMINAR": {
        "empate": "MESMA_POSICAO"
      }
    },
    "rodape": "TREINAMENTO — sem valor oficial.",
    "schema": 1,
    "desempate": [
      {
        "direcao": "SIM_PRIMEIRO",
        "criterio": "IDOSO_60"
      },
      {
        "direcao": "MAIOR_PRIMEIRO",
        "criterio": "EXP_PROFISSIONAL_TEMPO"
      },
      {
        "direcao": "MAIOR_PRIMEIRO",
        "criterio": "MAIOR_IDADE"
      }
    ],
    "composicao": {
      "casas": 2,
      "componentes": [
        {
          "peso": 0.5,
          "codigo": "DOCUMENTAL"
        },
        {
          "peso": 0.5,
          "codigo": "ENTREVISTA"
        }
      ],
      "arredondamento": "MEIO_PARA_CIMA"
    },
    "convocacao": {
      "excecoes": [],
      "multiplo_vagas": 5,
      "posicao_max_cr": 10,
      "incluir_empatados": true
    },
    "data_corte": null,
    "documental": {
      "parciais": [
        "FORMACAO",
        "CURSOS",
        "EXPERIENCIA"
      ],
      "nota_minima": 15,
      "nivel_padrao": null,
      "situacoes_aptas": [
        "Aprovado",
        "Triado"
      ],
      "niveis_por_cargo": [],
      "nota_minima_por_nivel": {}
    },
    "entrevista": {
      "so_parecer": false,
      "nota_minima": 5,
      "competencias": [
        {
          "nome": "Habilidade técnica (Avaliação Estruturada por Competências)",
          "ordem": 1,
          "minimo": 1
        },
        {
          "nome": "Habilidade intercultural (Avaliação Estruturada por Competências)",
          "ordem": 2,
          "minimo": 1.5
        },
        {
          "nome": "Habilidade comportamental (Avaliação Estruturada por Competências)",
          "ordem": 3,
          "minimo": 1.5
        },
        {
          "nome": "Habilidade situacional (Estudo de Caso)",
          "ordem": 4,
          "minimo": 1
        }
      ],
      "inapto_elimina": true,
      "exige_comparecimento": true,
      "nota_eliminatoria_ate": null,
      "nota_minima_competencia": null
    },
    "importacao": {
      "fonte": "PDF oficial do edital (agenciasus.org.br)",
      "modelo": "PROJ26-CURRICULAR",
      "lido_em": "2026-10-02",
      "arquivos": [
        "https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf"
      ],
      "em_aberto": [
        "data_corte null: fim das inscrições está no Anexo II (não baixado) → conferir com o cronograma do MONITORA.",
        "Análise comportamental (avaliação estruturada por competências + estudo de caso, presencial em Boa Vista/RR) mapeada como ENTREVISTA.",
        "Acréscimo de 50% em 2 competências (8.3.12) não existe no sistema: as notas dessas competências devem ser lançadas JÁ com o acréscimo (máx 3,0), senão a nota máxima vira 8 e o mínimo 5 fica distorcido. Os mínimos por competência (1 / 1,5 / 1,5 / 1) supõem esse lançamento.",
        "Média aritmética simples (9.1) de notas com escalas diferentes (curricular até 50, comportamental até 10): é o que o edital diz; conferir com a área.",
        "Ordem Unificada de Convocação (11.1.4) não modelada.",
        "Empate depois de todos os critérios de desempate: o edital não define → regra usa MESMA_POSICAO/DENSA; gestor decide: sorteio registrado, ordem de inscrição, mesma posição ou decisão manual."
      ],
      "pontuacao": {
        "detalhe": "Curricular: superior igual ao 114 (titulação 5/8/10, cursos 1/2/3 máx 5, experiência na área ou SUS 5 por 6 meses adicionais máx 35); médio/técnico: cursos 2/4/6 máx 10, experiência 4 por 6 meses adicionais máx 40. Análise comportamental: 4 competências 0–2 cada (média dos examinadores), intercultural e comportamental +50% → máx 2+3+3+2 = 10; mínimo 5 e 50% do máximo em cada competência. Nota final = (curricular + comportamental)/2 → máx 30.",
        "final_max": 30,
        "por_nivel": {
          "tecnico": {
            "CURSOS": 10,
            "EXPERIENCIA": 40
          },
          "superior": {
            "CURSOS": 5,
            "FORMACAO": 10,
            "EXPERIENCIA": 35
          }
        },
        "documental_max": 50,
        "entrevista_max": 10
      }
    },
    "modalidades": [
      {
        "nome": "Ampla concorrência",
        "agrupa": [],
        "codigo": "AC",
        "percentual": null,
        "lista_propria": false,
        "arredondamento": "MEIO_PARA_CIMA",
        "remanejar_para": [],
        "aparece_na_geral": true,
        "recomeca_posicao": true
      },
      {
        "nome": "PcD",
        "agrupa": [],
        "codigo": "PCD",
        "percentual": 5,
        "lista_propria": true,
        "arredondamento": "MEIO_PARA_CIMA",
        "remanejar_para": [],
        "aparece_na_geral": true,
        "recomeca_posicao": true
      },
      {
        "nome": "Pretos e pardos",
        "agrupa": [],
        "codigo": "PP",
        "percentual": 25,
        "lista_propria": true,
        "arredondamento": "MEIO_PARA_CIMA",
        "remanejar_para": [],
        "aparece_na_geral": true,
        "recomeca_posicao": true
      },
      {
        "nome": "Indígenas",
        "agrupa": [],
        "codigo": "PI",
        "percentual": 3,
        "lista_propria": true,
        "arredondamento": "MEIO_PARA_CIMA",
        "remanejar_para": [
          "PQ",
          "PP"
        ],
        "aparece_na_geral": true,
        "recomeca_posicao": true
      },
      {
        "nome": "Quilombolas",
        "agrupa": [],
        "codigo": "PQ",
        "percentual": 2,
        "lista_propria": true,
        "arredondamento": "MEIO_PARA_CIMA",
        "remanejar_para": [
          "PI",
          "PP"
        ],
        "aparece_na_geral": true,
        "recomeca_posicao": true
      }
    ],
    "empate_final": {
      "metodo": "MESMA_POSICAO",
      "numeracao": "DENSA"
    },
    "documento": {
      "edital": "TREINAMENTO 992/2099",
      "unidade": "Escritório Distrital e Regional (Treinamento)"
    }
  }$classif93$::jsonb;
  -- O resultado da pré-classificação destes fictícios, calculado pelo Python
  -- (python/monitora/avaliacao_documental/pre_classificacao.py) com a regra acima.
  -- Gerado por scripts/pre_classificacao/gerar_treinamento.py; o pytest
  -- tests/python/test_treinamento_projetos.py confere que o Python dá o mesmo.
  -- pre-classificacao-do-treinamento:inicio
  c_pre constant jsonb := $pre${"edital":{"rotulo":"992/2099","situacao":"PROCESSADO","vagas":5,"inscritos":40,"eliminados":11,"ranqueados":29,"no_lote":21,"por_decisao":0,"divergencias":2,"pela_art":1,"congeladas":39,"avisos":["SEM_DECLARADA_COMPLETA"],"base_da_nota":"DECLARADA","congelar":true},"vagas":{"990992001":{"resumo":{"tamanho":4,"descricao":"nota ≥ 15 (item 8.2.6) = 4","por_modalidade":null,"acima_do_corte":0,"avisos":[]},"linhas":[{"codigo":"TREINO-P01","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":48,"nota":48,"origem_nota":"DECLARADA","declarada":48,"declarada_parciais":{"FORMACAO":8,"CURSOS":5,"EXPERIENCIA":35},"declarada_completa":true,"declarada_congelada":{"total":48,"parciais":{"FORMACAO":8,"CURSOS":5,"EXPERIENCIA":35},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Mestrado\"","pontos":8},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"5 pontos\"","pontos":5},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses","resposta":"\"4 anos ou mais\"","pontos":35}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":1,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 4"},{"codigo":"TREINO-P02","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":23,"nota":23,"origem_nota":"DECLARADA","declarada":23,"declarada_parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"declarada_completa":true,"declarada_congelada":{"total":23,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"3 pontos\"","pontos":3},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses","resposta":"\"2 anos\"","pontos":15}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":2,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 4"},{"codigo":"TREINO-P03","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":10,"nota":10,"origem_nota":"DECLARADA","declarada":10,"declarada_parciais":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":5},"declarada_completa":true,"declarada_congelada":{"total":10,"parciais":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":5},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"Não possuo\"","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses","resposta":"\"1 ano&nbsp;\"","pontos":5}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":5,"posicao_modalidade":5,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P04","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":30,"nota":20,"origem_nota":"DECLARADA","declarada":20,"declarada_parciais":{"FORMACAO":0,"CURSOS":5,"EXPERIENCIA":15},"declarada_completa":true,"declarada_congelada":{"total":20,"parciais":{"FORMACAO":0,"CURSOS":5,"EXPERIENCIA":15},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Não Possuo\"","pontos":0},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"5 pontos\"","pontos":5},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses","resposta":"\"2 anos\"","pontos":15}]},"sem_mapa":0,"divergente":true,"modalidade":"AC","posicao":3,"posicao_modalidade":3,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 4"},{"codigo":"TREINO-P05","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário (decisão da coordenação CORES)","art":null,"nota":0,"origem_nota":"DECLARADA","declarada":0,"declarada_parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":0,"parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"--","pontos":0},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"--","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses","resposta":"--","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P06","situacao":"ELIMINADO","motivo_codigo":"CANCELADO","motivo":"Cancelou a inscrição","art":38,"nota":38,"origem_nota":"DECLARADA","declarada":38,"declarada_parciais":{"FORMACAO":8,"CURSOS":5,"EXPERIENCIA":25},"declarada_completa":true,"declarada_congelada":{"total":38,"parciais":{"FORMACAO":8,"CURSOS":5,"EXPERIENCIA":25},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Mestrado\"","pontos":8},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"5 pontos\"","pontos":5},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses","resposta":"\"3 anos\"","pontos":25}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P07","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":15,"nota":15,"origem_nota":"DECLARADA","declarada":15,"declarada_parciais":{"FORMACAO":5,"CURSOS":5,"EXPERIENCIA":5},"declarada_completa":true,"declarada_congelada":{"total":15,"parciais":{"FORMACAO":5,"CURSOS":5,"EXPERIENCIA":5},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"5 pontos\"","pontos":5},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses","resposta":"\"1 ano&nbsp;\"","pontos":5}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":4,"posicao_modalidade":4,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 4"},{"codigo":"TREINO-P08","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário (decisão da coordenação CORES)","art":38,"nota":38,"origem_nota":"DECLARADA","declarada":38,"declarada_parciais":{"FORMACAO":8,"CURSOS":5,"EXPERIENCIA":25},"declarada_completa":true,"declarada_congelada":{"total":38,"parciais":{"FORMACAO":8,"CURSOS":5,"EXPERIENCIA":25},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Mestrado\"","pontos":8},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"5 pontos\"","pontos":5},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses","resposta":"\"3 anos\"","pontos":25}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null}]},"990992002":{"resumo":{"tamanho":4,"descricao":"nota ≥ 15 (item 8.2.6) = 4","por_modalidade":null,"acima_do_corte":0,"avisos":[]},"linhas":[{"codigo":"TREINO-P09","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":45,"nota":45,"origem_nota":"DECLARADA","declarada":45,"declarada_parciais":{"FORMACAO":5,"CURSOS":5,"EXPERIENCIA":35},"declarada_completa":true,"declarada_congelada":{"total":45,"parciais":{"FORMACAO":5,"CURSOS":5,"EXPERIENCIA":35},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"5 pontos\"","pontos":5},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"4 anos ou mais\"","pontos":35}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":1,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 4"},{"codigo":"TREINO-P10","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":29,"nota":29,"origem_nota":"DECLARADA","declarada":29,"declarada_parciais":{"FORMACAO":5,"CURSOS":4,"EXPERIENCIA":20},"declarada_completa":true,"declarada_congelada":{"total":29,"parciais":{"FORMACAO":5,"CURSOS":4,"EXPERIENCIA":20},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"4 pontos\"","pontos":4},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"2 anos e 6 meses\"","pontos":20}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":2,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 4"},{"codigo":"TREINO-P11","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":24,"nota":24,"origem_nota":"DECLARADA","declarada":24,"declarada_parciais":{"FORMACAO":8,"CURSOS":1,"EXPERIENCIA":15},"declarada_completa":true,"declarada_congelada":{"total":24,"parciais":{"FORMACAO":8,"CURSOS":1,"EXPERIENCIA":15},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Mestrado\"","pontos":8},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"1 ponto\"","pontos":1},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"2 anos\"","pontos":15}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":4,"posicao_modalidade":4,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 4"},{"codigo":"TREINO-P12","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":24,"nota":24,"origem_nota":"DECLARADA","declarada":24,"declarada_parciais":{"FORMACAO":5,"CURSOS":4,"EXPERIENCIA":15},"declarada_completa":true,"declarada_congelada":{"total":24,"parciais":{"FORMACAO":5,"CURSOS":4,"EXPERIENCIA":15},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"4 pontos\"","pontos":4},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"2 anos\"","pontos":15}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":3,"posicao_modalidade":3,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 4"},{"codigo":"TREINO-P13","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":10,"nota":10,"origem_nota":"DECLARADA","declarada":10,"declarada_parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":10},"declarada_completa":true,"declarada_congelada":{"total":10,"parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":10},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Não Possuo\"","pontos":0},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"Não possuo\"","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"1 anos e 6 meses\"","pontos":10}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":5,"posicao_modalidade":5,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P14","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":5,"nota":5,"origem_nota":"DECLARADA","declarada":5,"declarada_parciais":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":5,"parciais":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"Não possuo\"","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"6 meses obrigatórios&nbsp;\"","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":6,"posicao_modalidade":6,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P15","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário (decisão da coordenação CORES)","art":5,"nota":5,"origem_nota":"DECLARADA","declarada":5,"declarada_parciais":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":5,"parciais":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"--","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"--","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P16","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário (decisão da coordenação CORES)","art":null,"nota":0,"origem_nota":"DECLARADA","declarada":0,"declarada_parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":0,"parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"--","pontos":0},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"--","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"--","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P17","situacao":"ELIMINADO","motivo_codigo":"CANCELADO","motivo":"Cancelou a inscrição","art":null,"nota":0,"origem_nota":"DECLARADA","declarada":0,"declarada_parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":0,"parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"--","pontos":0},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"--","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"--","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null}]},"990992003":{"resumo":{"tamanho":5,"descricao":"nota ≥ 15 (item 8.2.6) = 5","por_modalidade":null,"acima_do_corte":0,"avisos":["SEM_DECLARADA_COMPLETA"]},"linhas":[{"codigo":"TREINO-P18","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":43,"nota":43,"origem_nota":"DECLARADA","declarada":43,"declarada_parciais":{"FORMACAO":8,"CURSOS":5,"EXPERIENCIA":30},"declarada_completa":true,"declarada_congelada":{"total":43,"parciais":{"FORMACAO":8,"CURSOS":5,"EXPERIENCIA":30},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Mestrado\"","pontos":8},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"5 pontos\"","pontos":5},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"3 anos e 6 meses\"","pontos":30}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":1,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"},{"codigo":"TREINO-P19","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":18,"nota":18,"origem_nota":"DECLARADA","declarada":18,"declarada_parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":10},"declarada_completa":true,"declarada_congelada":{"total":18,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":10},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"3 pontos\"","pontos":3},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"1 anos e 6 meses\"","pontos":10}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":5,"posicao_modalidade":5,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"},{"codigo":"TREINO-P20","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":15,"nota":20,"origem_nota":"DECLARADA","declarada":20,"declarada_parciais":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"declarada_completa":true,"declarada_congelada":{"total":20,"parciais":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"Não possuo\"","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"2 anos\"","pontos":15}]},"sem_mapa":0,"divergente":true,"modalidade":"AC","posicao":4,"posicao_modalidade":4,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"},{"codigo":"TREINO-P21","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":22,"nota":22,"origem_nota":"ART","declarada":7,"declarada_parciais":{"FORMACAO":5,"CURSOS":2,"EXPERIENCIA":0},"declarada_completa":false,"declarada_congelada":null,"sem_mapa":1,"divergente":false,"modalidade":"AC","posicao":3,"posicao_modalidade":3,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"},{"codigo":"TREINO-P22","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":11,"nota":11,"origem_nota":"DECLARADA","declarada":11,"declarada_parciais":{"FORMACAO":5,"CURSOS":1,"EXPERIENCIA":5},"declarada_completa":true,"declarada_congelada":{"total":11,"parciais":{"FORMACAO":5,"CURSOS":1,"EXPERIENCIA":5},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"1 ponto\"","pontos":1},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"1 ano&nbsp;\"","pontos":5}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":6,"posicao_modalidade":6,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P23","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário (decisão da coordenação CORES)","art":null,"nota":0,"origem_nota":"DECLARADA","declarada":0,"declarada_parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":0,"parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"--","pontos":0},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"--","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"--","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P24","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":null,"nota":35,"origem_nota":"DECLARADA","declarada":35,"declarada_parciais":{"FORMACAO":5,"CURSOS":5,"EXPERIENCIA":25},"declarada_completa":true,"declarada_congelada":{"total":35,"parciais":{"FORMACAO":5,"CURSOS":5,"EXPERIENCIA":25},"sem_mapa":0,"respostas":[{"parcial":"FORMACAO","coluna":"Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: ","resposta":"\"Especialização\"","pontos":5},{"parcial":"CURSOS","coluna":"Pergunta 15 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"5 pontos\"","pontos":5},{"parcial":"EXPERIENCIA","coluna":"Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses ","resposta":"\"3 anos\"","pontos":25}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":2,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"}]},"990992004":{"resumo":{"tamanho":3,"descricao":"nota ≥ 15 (item 8.2.6) = 3","por_modalidade":null,"acima_do_corte":0,"avisos":[]},"linhas":[{"codigo":"TREINO-P25","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":50,"nota":50,"origem_nota":"DECLARADA","declarada":50,"declarada_parciais":{"FORMACAO":0,"CURSOS":10,"EXPERIENCIA":40},"declarada_completa":true,"declarada_congelada":{"total":50,"parciais":{"FORMACAO":0,"CURSOS":10,"EXPERIENCIA":40},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"10 pontos\"","pontos":10},{"parcial":"EXPERIENCIA","coluna":"Pergunta 12 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"5 anos e 6 meses ou mais\"","pontos":40}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":1,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 3"},{"codigo":"TREINO-P26","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":18,"nota":18,"origem_nota":"DECLARADA","declarada":18,"declarada_parciais":{"FORMACAO":0,"CURSOS":6,"EXPERIENCIA":12},"declarada_completa":true,"declarada_congelada":{"total":18,"parciais":{"FORMACAO":0,"CURSOS":6,"EXPERIENCIA":12},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"6 pontos\"","pontos":6},{"parcial":"EXPERIENCIA","coluna":"Pergunta 12 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"2 anos\"","pontos":12}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":2,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 3"},{"codigo":"TREINO-P27","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":8,"nota":8,"origem_nota":"DECLARADA","declarada":8,"declarada_parciais":{"FORMACAO":0,"CURSOS":4,"EXPERIENCIA":4},"declarada_completa":true,"declarada_congelada":{"total":8,"parciais":{"FORMACAO":0,"CURSOS":4,"EXPERIENCIA":4},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"4 pontos\"","pontos":4},{"parcial":"EXPERIENCIA","coluna":"Pergunta 12 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"1 ano\"","pontos":4}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":5,"posicao_modalidade":5,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P28","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":10,"nota":10,"origem_nota":"DECLARADA","declarada":10,"declarada_parciais":{"FORMACAO":0,"CURSOS":2,"EXPERIENCIA":8},"declarada_completa":true,"declarada_congelada":{"total":10,"parciais":{"FORMACAO":0,"CURSOS":2,"EXPERIENCIA":8},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"2 pontos\"","pontos":2},{"parcial":"EXPERIENCIA","coluna":"Pergunta 12 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"1 ano e 6 meses\"","pontos":8}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":4,"posicao_modalidade":4,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P29","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário (decisão da coordenação CORES)","art":null,"nota":6,"origem_nota":"DECLARADA","declarada":6,"declarada_parciais":{"FORMACAO":0,"CURSOS":6,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":6,"parciais":{"FORMACAO":0,"CURSOS":6,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"6 pontos\"","pontos":6},{"parcial":"EXPERIENCIA","coluna":"Pergunta 12 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"--","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P30","situacao":"ELIMINADO","motivo_codigo":"CANCELADO","motivo":"Cancelou a inscrição","art":null,"nota":0,"origem_nota":"DECLARADA","declarada":0,"declarada_parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":0,"parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"--","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 12 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"--","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P31","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":15,"nota":15,"origem_nota":"DECLARADA","declarada":15,"declarada_parciais":{"FORMACAO":0,"CURSOS":3,"EXPERIENCIA":12},"declarada_completa":true,"declarada_congelada":{"total":15,"parciais":{"FORMACAO":0,"CURSOS":3,"EXPERIENCIA":12},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"3 pontos\"","pontos":3},{"parcial":"EXPERIENCIA","coluna":"Pergunta 12 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"2 anos\"","pontos":12}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":3,"posicao_modalidade":3,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 3"}]},"990992005":{"resumo":{"tamanho":5,"descricao":"nota ≥ 15 (item 8.2.6) = 5","por_modalidade":null,"acima_do_corte":0,"avisos":[]},"linhas":[{"codigo":"TREINO-P32","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":42,"nota":42,"origem_nota":"DECLARADA","declarada":42,"declarada_parciais":{"FORMACAO":0,"CURSOS":10,"EXPERIENCIA":32},"declarada_completa":true,"declarada_congelada":{"total":42,"parciais":{"FORMACAO":0,"CURSOS":10,"EXPERIENCIA":32},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 12 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"10 pontos\"","pontos":10},{"parcial":"EXPERIENCIA","coluna":"Pergunta 10 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"4 anos e 6 meses\"","pontos":32}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":1,"posicao_modalidade":1,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"},{"codigo":"TREINO-P33","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":24,"nota":24,"origem_nota":"DECLARADA","declarada":24,"declarada_parciais":{"FORMACAO":0,"CURSOS":8,"EXPERIENCIA":16},"declarada_completa":true,"declarada_congelada":{"total":24,"parciais":{"FORMACAO":0,"CURSOS":8,"EXPERIENCIA":16},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 12 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"8 pontos\"","pontos":8},{"parcial":"EXPERIENCIA","coluna":"Pergunta 10 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"2 anos e 6 meses\"","pontos":16}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":3,"posicao_modalidade":3,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"},{"codigo":"TREINO-P34","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":20,"nota":20,"origem_nota":"DECLARADA","declarada":20,"declarada_parciais":{"FORMACAO":0,"CURSOS":4,"EXPERIENCIA":16},"declarada_completa":true,"declarada_congelada":{"total":20,"parciais":{"FORMACAO":0,"CURSOS":4,"EXPERIENCIA":16},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 12 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"4 pontos\"","pontos":4},{"parcial":"EXPERIENCIA","coluna":"Pergunta 10 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"2 anos e 6 meses\"","pontos":16}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":4,"posicao_modalidade":4,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"},{"codigo":"TREINO-P35","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":20,"nota":20,"origem_nota":"DECLARADA","declarada":20,"declarada_parciais":{"FORMACAO":0,"CURSOS":8,"EXPERIENCIA":12},"declarada_completa":true,"declarada_congelada":{"total":20,"parciais":{"FORMACAO":0,"CURSOS":8,"EXPERIENCIA":12},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 12 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"8 pontos\"","pontos":8},{"parcial":"EXPERIENCIA","coluna":"Pergunta 10 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"2 anos\"","pontos":12}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":5,"posicao_modalidade":5,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"},{"codigo":"TREINO-P36","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":14,"nota":14,"origem_nota":"DECLARADA","declarada":14,"declarada_parciais":{"FORMACAO":0,"CURSOS":6,"EXPERIENCIA":8},"declarada_completa":true,"declarada_congelada":{"total":14,"parciais":{"FORMACAO":0,"CURSOS":6,"EXPERIENCIA":8},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 12 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"6 pontos\"","pontos":6},{"parcial":"EXPERIENCIA","coluna":"Pergunta 10 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"1 ano e 6 meses\"","pontos":8}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":6,"posicao_modalidade":6,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P37","situacao":"RANQUEADO","motivo_codigo":null,"motivo":null,"art":2,"nota":2,"origem_nota":"DECLARADA","declarada":2,"declarada_parciais":{"FORMACAO":0,"CURSOS":2,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":2,"parciais":{"FORMACAO":0,"CURSOS":2,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 12 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"2 pontos\"","pontos":2},{"parcial":"EXPERIENCIA","coluna":"Pergunta 10 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"6 meses obrigatórios\"","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":7,"posicao_modalidade":7,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P38","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário (decisão da coordenação CORES)","art":null,"nota":0,"origem_nota":"DECLARADA","declarada":0,"declarada_parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"declarada_completa":true,"declarada_congelada":{"total":0,"parciais":{"FORMACAO":0,"CURSOS":0,"EXPERIENCIA":0},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 12 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"--","pontos":0},{"parcial":"EXPERIENCIA","coluna":"Pergunta 10 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"--","pontos":0}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P39","situacao":"ELIMINADO","motivo_codigo":"QUESTIONARIO","motivo":"Não finalizou o questionário (decisão da coordenação CORES)","art":12,"nota":12,"origem_nota":"DECLARADA","declarada":12,"declarada_parciais":{"FORMACAO":0,"CURSOS":4,"EXPERIENCIA":8},"declarada_completa":true,"declarada_congelada":{"total":12,"parciais":{"FORMACAO":0,"CURSOS":4,"EXPERIENCIA":8},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 12 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"4 pontos\"","pontos":4},{"parcial":"EXPERIENCIA","coluna":"Pergunta 10 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"1 ano e 6 meses\"","pontos":8}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":null,"posicao_modalidade":null,"lote":null,"lista_lote":null,"entrada":null,"motivo_entrada":null},{"codigo":"TREINO-P40","situacao":"NO_LOTE","motivo_codigo":null,"motivo":null,"art":24,"nota":24,"origem_nota":"DECLARADA","declarada":24,"declarada_parciais":{"FORMACAO":0,"CURSOS":8,"EXPERIENCIA":16},"declarada_completa":true,"declarada_congelada":{"total":24,"parciais":{"FORMACAO":0,"CURSOS":8,"EXPERIENCIA":16},"sem_mapa":0,"respostas":[{"parcial":"CURSOS","coluna":"Pergunta 12 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa","resposta":"\"8 pontos\"","pontos":8},{"parcial":"EXPERIENCIA","coluna":"Pergunta 10 - Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni","resposta":"\"2 anos e 6 meses\"","pontos":16}]},"sem_mapa":0,"divergente":false,"modalidade":"AC","posicao":2,"posicao_modalidade":2,"lote":1,"lista_lote":"GERAL","entrada":"INICIAL","motivo_entrada":"Lote inicial: nota ≥ 15 (item 8.2.6) = 5"}]}}}$pre$::jsonb;
  -- pre-classificacao-do-treinamento:fim
begin
  -- As vagas (as cinco do 93/2026, com códigos fictícios) e os questionários.
  create temporary table if not exists tmp_treino_p_vaga (
    vaga text primary key, ordem smallint, cargo text, imediatas integer, nivel text, curso text,
    questionario text, enunciados text[]
  ) on commit drop;
  truncate tmp_treino_p_vaga;
  insert into tmp_treino_p_vaga values
    ('990992001', 1, 'ANALISTA DE GESTÃO: MÉDICO DO TRABALHO (Nível Superior)', 2, 'Superior', 'Medicina',
     'Nº 992/2099 - NÍVEL SUPERIOR MÉDICO DO TRABALHO', array[
       $q$Nome completo:(sem abreviações)$q$,
       $q$Para fins de identificação de seu cadastro, favor nos informe seu CPF:Ex: 000.000.000-00$q$,
       $q$Informe sua data de nascimento (dd/mm/aaaa):dd/mm/aaaa = dia/mês/ano$q$,
       $q$Anexe o documento de identificação com foto, frente e verso, conforme instruções contidas no subitem 6.5 do edital.$q$,
       $q$Você possui Graduação na área da vaga? (Será necessário comprovar)$q$,
       $q$Anexe a comprovação de Nível Superior:(frente e verso de acordo com o subitem 6.4 do Edital)Poderá unir os certificados em único arquivo em formato PDF..$q$,
       $q$Você possui residência médica em Medicina do Trabalho reconhecido pela Comissão Nacional de Residência Médica, ou título de especialista em Medicina do Trabalho, reconhecido pela Associaç$q$,
       $q$Anexe a comprovação de residência médica em Medicina do Trabalho, reconhecido pela Comissão Nacional de Residência Médica, ou título de especialista em Medicina do Trabalho, reconhecido p$q$,
       $q$Você possui registro profissional ativo, junto ao respectivo Conselho Regional de Classe da sua área de formação?(obrigatória comprovação na pergunta posterior)$q$,
       $q$Anexe o comprovante do seu registro profissional no Conselho de Classe, quando obrigatório, conforme previsto no Anexo I do Edital – Descrição de Requisitos e Atribuições.(preferencialme$q$,
       $q$Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses$q$,
       $q$Anexe o comprovante de Experiência Profissional em atividades compatíveis com o cargo.Comprovante de experiência profissional: Se vínculo perante empresa privada: Carteira de Trabalho e $q$,
       $q$Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: $q$,
       $q$Anexe seu comprovante de Titulação Acadêmica.$q$,
       $q$Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa$q$,
       $q$Anexe os seus Certificados de Conclusão dos Cursos de Aperfeiçoamento:$q$,
       $q$Indique qual sistema de concorrência você deseja se inscrever?$q$,
       $q$Candidatos às vagas destinadas a Pretos ou Pardos e QuilombolasAnexe, neste campo, a autodeclaração conforme o modelo constante no Anexo IV do Edital.Importante: Os candidatos que se aut$q$,
       $q$Candidatos&nbsp;concorrendo às vagas destinadas a Pretos ou Pardos, grave um vídeo, em fundo branco, com duração máxima de 20 segundos, apresentando o seu nome completo e a cor com a qua$q$,
       $q$Candidatos concorrendo às vagas destinadas a Pretos ou Pardos, anexe uma foto de frente e uma foto de perfil, reunidas em um único arquivo, preferencialmente no formato PDF.Os candidatos$q$,
       $q$Para candidatos que se declaram quilombolas, anexe sua Declaração de Pertencimento Étnico (Anexo VII do edital) ou Certificado de Reconhecimento do Território de Pertencimento emitido pe$q$,
       $q$Para candidatos que se declaram indígenas, anexe sua Declaração de Pertencimento Étnico.(obrigatório envio no modelo do Anexo VI do edital)Os candidatos que estiverem inscritos em outra $q$,
       $q$Os candidatos que concorrem às vagas destinadas a PcD devem anexar aqui o laudo médico, devidamente assinado por médico(a) com registro ativo no CRM, conforme as exigências dos subitens $q$,
       $q$Você possui cônjuge, companheiro(a), parentes até o terceiro grau ou qualquer conhecido que integre o quadro de trabalhadores da AgSUS?$q$,
       $q$Se respondeu SIM na pergunta anterior, por gentileza informe o nome completo do trabalhador da AgSUS.$q$,
       $q$Você está com contrato de trabalho ativo na AgSUS ou foi desligado nos últimos 6 meses?$q$,
       $q$Declaro estar ciente e de acordo com os termos do edital, bem como autorizo a coleta, o tratamento e o compartilhamento dos meus dados pessoais com órgãos competentes, exclusivamente par$q$]),
    ('990992002', 2, 'ANALISTA DE GESTÃO: ENFERMEIRO DO TRABALHO (Nível Superior)', 1, 'Superior', 'Enfermagem',
     'NÍVEL SUPERIOR ENFERMEIRO DO TRABALHO - Nº 992/2099', array[
       $q$Nome completo:(sem abreviações)$q$,
       $q$Para fins de identificação de seu cadastro, favor nos informe seu CPF:Ex: 000.000.000-00$q$,
       $q$Informe sua data de nascimento (dd/mm/aaaa):dd/mm/aaaa = dia/mês/ano$q$,
       $q$Anexe o documento de identificação com foto, frente e verso, conforme instruções contidas no subitem 6.5 do edital.$q$,
       $q$Você possui Graduação na área da vaga? (Será necessário comprovar)$q$,
       $q$Anexe a comprovação de Nível Superior:(frente e verso de acordo com o subitem 6.4 do Edital)Poderá unir os certificados em único arquivo em formato PDF..$q$,
       $q$Você possui certificado de conclusão de curso de especialização em&nbsp;Enfermagem do Trabalho (mínimo de 360h)?(Será necessário comprovar)$q$,
       $q$Anexe o certificado de conclusão de curso de especialização em Enfermagem do Trabalho (mínimo de 360h).$q$,
       $q$Você possui registro profissional ativo, junto ao respectivo Conselho Regional de Classe da sua área de formação?(obrigatória comprovação na pergunta posterior)$q$,
       $q$Anexe o comprovante do seu registro profissional no Conselho de Classe, quando obrigatório, conforme previsto no Anexo I do Edital – Descrição de Requisitos e Atribuições.(preferencialme$q$,
       $q$Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses $q$,
       $q$Anexe o comprovante de Experiência Profissional em atividades compatíveis com o cargo.Comprovante de experiência profissional: Se vínculo perante empresa privada: Carteira de Trabalho e $q$,
       $q$Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: $q$,
       $q$Anexe seu comprovante de Titulação Acadêmica.$q$,
       $q$Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa$q$,
       $q$Anexe os seus Certificados de Conclusão dos Cursos de Aperfeiçoamento:$q$,
       $q$Indique qual sistema de concorrência você deseja se inscrever?$q$,
       $q$Candidatos às vagas destinadas a Pretos ou Pardos e QuilombolasAnexe, neste campo, a autodeclaração conforme o modelo constante no Anexo IV do Edital.Importante: Os candidatos que se aut$q$,
       $q$Candidatos&nbsp;concorrendo às vagas destinadas a Pretos ou Pardos, grave um vídeo, em fundo branco, com duração máxima de 20 segundos, apresentando o seu nome completo e a cor com a qua$q$,
       $q$Candidatos concorrendo às vagas destinadas a Pretos ou Pardos, anexe uma foto de frente e uma foto de perfil, reunidas em um único arquivo, preferencialmente no formato PDF.Os candidatos$q$,
       $q$Para candidatos que se declaram quilombolas, anexe sua Declaração de Pertencimento Étnico (Anexo VII do edital) ou Certificado de Reconhecimento do Território de Pertencimento emitido pe$q$,
       $q$Para candidatos que se declaram indígenas, anexe sua Declaração de Pertencimento Étnico.(obrigatório envio no modelo do Anexo VI do edital)Os candidatos que estiverem inscritos em outra $q$,
       $q$Os candidatos que concorrem às vagas destinadas a PcD devem anexar aqui o laudo médico, devidamente assinado por médico(a) com registro ativo no CRM, conforme as exigências dos subitens $q$,
       $q$Você possui cônjuge, companheiro(a), parentes até o terceiro grau ou qualquer conhecido que integre o quadro de trabalhadores da AgSUS?$q$,
       $q$Se respondeu SIM na pergunta anterior, por gentileza informe o nome completo do trabalhador da AgSUS.$q$,
       $q$Você está com contrato de trabalho ativo na AgSUS ou foi desligado nos últimos 6 meses?$q$,
       $q$Declaro estar ciente e de acordo com os termos do edital, bem como autorizo a coleta, o tratamento e o compartilhamento dos meus dados pessoais com órgãos competentes, exclusivamente par$q$]),
    ('990992003', 3, 'ANALISTA DE GESTÃO: ENGENHARIA DO TRABALHO (Nível Superior)', 1, 'Superior', 'Engenharia',
     'NÍVEL SUPERIOR ENGENHARIA DO TRABALHO - Nº 992/2099', array[
       $q$Nome completo:(sem abreviações)$q$,
       $q$Para fins de identificação de seu cadastro, favor nos informe seu CPF:Ex: 000.000.000-00$q$,
       $q$Informe sua data de nascimento (dd/mm/aaaa):dd/mm/aaaa = dia/mês/ano$q$,
       $q$Anexe o documento de identificação com foto, frente e verso, conforme instruções contidas no subitem 6.5 do edital.$q$,
       $q$Você possui Graduação na área da vaga? (Será necessário comprovar)$q$,
       $q$Anexe a comprovação de Nível Superior:(frente e verso de acordo com o subitem 6.4 do Edital)Poderá unir os certificados em único arquivo em formato PDF..$q$,
       $q$Você possui certificado de conclusão de curso de especialização em Engenharia de Segurança do Trabalho (mínimo 360h)?(Será necessário comprovar)$q$,
       $q$Anexe o certificado de conclusão de curso de especialização em Engenharia de Segurança do Trabalho (mínimo 360h).$q$,
       $q$Você possui registro profissional ativo, junto ao respectivo Conselho Regional de Classe da sua área de formação?(obrigatória comprovação na pergunta posterior)$q$,
       $q$Anexe o comprovante do seu registro profissional no Conselho de Classe, quando obrigatório, conforme previsto no Anexo I do Edital – Descrição de Requisitos e Atribuições.(preferencialme$q$,
       $q$Experiência Profissional em atividades compatíveis com o cargo:(contabilizada a partir de 06 meses completos, sem sobreposição de tempo, excedente ao período mínimo obrigatório)06 meses $q$,
       $q$Anexe o comprovante de Experiência Profissional em atividades compatíveis com o cargo.Comprovante de experiência profissional: Se vínculo perante empresa privada: Carteira de Trabalho e $q$,
       $q$Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)Considera-se a maior titulação apresentada:Especialização: 05 pontosMestrado: 08 pontos Doutorado: 10 pontos Máximo: $q$,
       $q$Anexe seu comprovante de Titulação Acadêmica.$q$,
       $q$Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa$q$,
       $q$Anexe os seus Certificados de Conclusão dos Cursos de Aperfeiçoamento:$q$,
       $q$Indique qual sistema de concorrência você deseja se inscrever?$q$,
       $q$Candidatos às vagas destinadas a Pretos ou Pardos e QuilombolasAnexe, neste campo, a autodeclaração conforme o modelo constante no Anexo IV do Edital.Importante:&nbsp;Os candidatos que s$q$,
       $q$Candidatos&nbsp;concorrendo às vagas destinadas a Pretos ou Pardos, grave um vídeo, em fundo branco, com duração máxima de 20 segundos, apresentando o seu nome completo e a cor com a qua$q$,
       $q$Candidatos concorrendo às vagas destinadas a Pretos ou Pardos, anexe uma foto de frente e uma foto de perfil, reunidas em um único arquivo, preferencialmente no formato PDF.Os candidatos$q$,
       $q$Para candidatos que se declaram quilombolas, anexe sua Declaração de Pertencimento Étnico (Anexo VII do edital) ou Certificado de Reconhecimento do Território de Pertencimento emitido pe$q$,
       $q$Para candidatos que se declaram indígenas, anexe sua Declaração de Pertencimento Étnico.(obrigatório envio no modelo do Anexo VI do edital)Os candidatos que estiverem inscritos em outra $q$,
       $q$Os candidatos que concorrem às vagas destinadas a PcD devem anexar aqui o laudo médico, devidamente assinado por médico(a) com registro ativo no CRM, conforme as exigências dos subitens $q$,
       $q$Você possui cônjuge, companheiro(a), parentes até o terceiro grau ou qualquer conhecido que integre o quadro de trabalhadores da AgSUS?$q$,
       $q$Se respondeu SIM na pergunta anterior, por gentileza informe o nome completo do trabalhador da AgSUS.$q$,
       $q$Você está com contrato de trabalho ativo na AgSUS ou foi desligado nos últimos 6 meses?$q$,
       $q$Declaro estar ciente e de acordo com os termos do edital, bem como autorizo a coleta, o tratamento e o compartilhamento dos meus dados pessoais com órgãos competentes, exclusivamente par$q$]),
    ('990992004', 4, 'TÉCNICO DE ENFERMAGEM DO TRABALHO', 1, 'Técnico', 'Técnico em Enfermagem',
     'TÉCNICO DE ENFERMAGEM DO TRABALHO - N° 992/2099', array[
       $q$Nome completo:(sem abreviações)$q$,
       $q$Para fins de identificação de seu cadastro, favor nos informe seu CPF:Ex: 000.000.000-00$q$,
       $q$Informe sua data de nascimento (dd/mm/aaaa):dd/mm/aaaa = dia/mês/ano$q$,
       $q$Anexe um documento de identificação com foto, frente e verso, conforme instruções contidas no subitem 6.5 do edital.$q$,
       $q$Você possui Ensino Médio completo e Curso Técnico na área da vaga? (Será necessário comprovar)$q$,
       $q$Anexe a comprovação de conclusão do Ensino Médio.$q$,
       $q$Anexe a comprovação de Nível Técnico em Enfermagem com carga horária &gt;=1200h.(frente e verso de acordo com o Edital)$q$,
       $q$Você possui certificado de conclusão de especialização técnica em Enfermagem do Trabalho, expedido por instituição de ensino reconhecida pelo MEC?$q$,
       $q$Anexe o certificado de conclusão de especialização técnica em Enfermagem do Trabalho, expedido por instituição de ensino reconhecida pelo MEC.$q$,
       $q$Você possui registro profissional ativo, junto ao respectivo Conselho de Classe da sua área de formação, no Estado de atuação?(obrigatória comprovação na pergunta posterior)$q$,
       $q$Anexe o comprovante do seu registro profissional no Conselho de Classe, quando obrigatório, conforme previsto no Anexo I do Edital – Descrição de Requisitos e Atribuições.(preferencialme$q$,
       $q$Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni$q$,
       $q$Anexe o comprovante de Experiência Profissional em atividades compatíveis com o cargo.Comprovante de experiência profissional: Se vínculo perante empresa privada: Carteira de Trabalho e $q$,
       $q$Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa$q$,
       $q$Anexe os seus Certificados de Conclusão dos Cursos de Aperfeiçoamento:$q$,
       $q$Indique qual sistema de concorrência você deseja se inscrever?$q$,
       $q$Candidatos às vagas destinadas a Pretos ou Pardos e QuilombolasAnexe, neste campo, a autodeclaração conforme o modelo constante no Anexo IV do Edital.Importante: Os candidatos que se aut$q$,
       $q$Candidatos&nbsp;concorrendo às vagas destinadas a Pretos ou Pardos, grave um vídeo, em fundo branco, com duração máxima de 20 segundos, apresentando o seu nome completo e a cor com a qua$q$,
       $q$Candidatos concorrendo às vagas destinadas a Pretos ou Pardos, anexe uma foto de frente e uma foto de perfil, reunidas em um único arquivo, preferencialmente no formato PDF.Os candidatos$q$,
       $q$Para candidatos que se declaram quilombolas, anexe sua Declaração de Pertencimento Étnico (Anexo VII do edital) ou Certificado de Reconhecimento do Território de Pertencimento emitido pe$q$,
       $q$Para candidatos que se declaram indígenas, anexe sua Declaração de Pertencimento Étnico.(obrigatório envio no modelo do Anexo VI do edital)Os candidatos que estiverem inscritos em outra $q$,
       $q$Os candidatos que concorrem às vagas destinadas a PcD devem anexar aqui o laudo médico, devidamente assinado por médico(a) com registro ativo no CRM, conforme as exigências do edital ao $q$,
       $q$Você possui cônjuge, companheiro(a), parentes até o terceiro grau ou qualquer conhecido que integre o quadro de trabalhadores da AgSUS?$q$,
       $q$Se respondeu SIM na pergunta anterior, por gentileza informe o nome completo do trabalhador da AgSUS.$q$,
       $q$Você está com contrato de trabalho ativo na AgSUS ou foi desligado nos últimos 6 meses?$q$,
       $q$Declaro estar ciente e de acordo com os termos do edital, bem como autorizo a coleta, o tratamento e o compartilhamento dos meus dados pessoais com órgãos competentes, exclusivamente par$q$]),
    ('990992005', 5, 'TÉCNICO DE SEGURANÇA DO TRABALHO (Nível Médio)', 6, 'Médio', 'Técnico em Segurança do Trabalho',
     'EDITAL N° 992/2099 - TEC. DE SEGURANÇA DO TRABALHO', array[
       $q$Nome completo:(sem abreviações)$q$,
       $q$Para fins de identificação de seu cadastro, favor nos informe seu CPF:Ex: 000.000.000-00$q$,
       $q$Informe sua data de nascimento (dd/mm/aaaa):dd/mm/aaaa = dia/mês/ano$q$,
       $q$Anexe um documento de identificação com foto, frente e verso, conforme instruções contidas no subitem 6.5 do edital.$q$,
       $q$Você possui Ensino Médio completo e Curso Técnico na área da vaga? (Será necessário comprovar)$q$,
       $q$Anexe a comprovação de conclusão do Ensino Médio.$q$,
       $q$Anexe a comprovação de Nível Técnico com carga horária &gt;=1200h.(frente e verso de acordo com o Edital)$q$,
       $q$Você possui registro profissional ativo vinculado ao Ministério do Trabalho e Emprego (MTE)?(obrigatória comprovação na pergunta posterior)$q$,
       $q$Anexe o comprovante do seu registro profissional vinculado ao Ministério do Trabalho e Emprego (MTE), quando obrigatório, conforme previsto no Anexo I do Edital – Descrição de Requisitos $q$,
       $q$Experiência Profissional em atividades compatíveis com o cargo:Será necessário comprovar(contabilizada a partir de 6 meses completos, sem sobreposição de tempo, excedente ao período míni$q$,
       $q$Anexe o comprovante de Experiência Profissional em atividades compatíveis com o cargo.Comprovante de experiência profissional: Se vínculo perante empresa privada: Carteira de Trabalho e $q$,
       $q$Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área em que concorre, com carga horária mínima de 40h.(Não será permitido o envio de vários arquivos separa$q$,
       $q$Anexe os seus Certificados de Conclusão dos Cursos de Aperfeiçoamento:$q$,
       $q$Indique qual sistema de concorrência você deseja se inscrever?$q$,
       $q$Candidatos às vagas destinadas a Pretos ou Pardos e QuilombolasAnexe, neste campo, a autodeclaração conforme o modelo constante no Anexo IV do Edital.Importante: Os candidatos que se aut$q$,
       $q$Candidatos&nbsp;concorrendo às vagas destinadas a Pretos ou Pardos, grave um vídeo, em fundo branco, com duração máxima de 20 segundos, apresentando o seu nome completo e a cor com a qua$q$,
       $q$Candidatos concorrendo às vagas destinadas a Pretos ou Pardos, anexe uma foto de frente e uma foto de perfil, reunidas em um único arquivo, preferencialmente no formato PDF.Os candidatos$q$,
       $q$Para candidatos que se declaram quilombolas, anexe sua Declaração de Pertencimento Étnico (Anexo VII do edital) ou Certificado de Reconhecimento do Território de Pertencimento emitido pe$q$,
       $q$Para candidatos que se declaram indígenas, anexe sua Declaração de Pertencimento Étnico.(obrigatório envio no modelo do Anexo VI do edital)Os candidatos que estiverem inscritos em outra $q$,
       $q$Os candidatos que concorrem às vagas destinadas a PcD devem anexar aqui o laudo médico, devidamente assinado por médico(a) com registro ativo no CRM, conforme as exigências do edital ao $q$,
       $q$Você possui cônjuge, companheiro(a), parentes até o terceiro grau ou qualquer conhecido que integre o quadro de trabalhadores da AgSUS?$q$,
       $q$Se respondeu SIM na pergunta anterior, por gentileza informe o nome completo do trabalhador da AgSUS.$q$,
       $q$Você está com contrato de trabalho ativo na AgSUS ou foi desligado nos últimos 6 meses?$q$,
       $q$Declaro estar ciente e de acordo com os termos do edital, bem como autorizo a coleta, o tratamento e o compartilhamento dos meus dados pessoais com órgãos competentes, exclusivamente par$q$]);

  -- Os 40 candidatos fictícios: um caso real do 93/2026 cada (ver docs/aya, edital de treinamento).
  -- Respostas no formato da exportação: entre aspas, "--" sem resposta, ART "x,0/50,0".
  create temporary table if not exists tmp_treino_p_candidato (
    n integer primary key, vaga text, situacao text, quest text, art text, tit text, cur text, exp text,
    modal text, escol text, especial text, registro text, reprovado text, marcadores text,
    nascimento date, lote boolean
  ) on commit drop;
  truncate tmp_treino_p_candidato;
  insert into tmp_treino_p_candidato values
    -- Médico do Trabalho (2 vagas)
    ( 1, '990992001', 'INSCRITO',  'FINALIZADO',   '48,0/50,0', '"Mestrado"',       '"5 pontos"',   '"4 anos ou mais"',            '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1979-05-12', true),
    ( 2, '990992001', 'INSCRITO',  'FINALIZADO',   '23,0/50,0', '"Especialização"', '"3 pontos"',   '"2 anos"',                    '"Pretos ou pardos"',   '"Sim"', '"Não"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1988-11-03', true),
    ( 3, '990992001', 'INSCRITO',  'FINALIZADO',   '10,0/50,0', '"Especialização"', '"Não possuo"', '"1 ano&nbsp;"',               '"Ampla concorrência"', '"Sim"', '"Não"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1991-02-20', false),
    ( 4, '990992001', 'INSCRITO',  'FINALIZADO',   '30,0/50,0', '"Não Possuo"',     '"5 pontos"',   '"2 anos"',                    '"Ampla concorrência"', '"Sim"', '"Não"', '"Sim."', 'NÃO', 'Nota Alterada',   '1984-07-08', true),
    ( 5, '990992001', 'INSCRITO',  'PENDENTE',     '--',        '--',               '--',           '--',                          '"Ampla concorrência"', '"Sim"', '--',    '--',     'NÃO', 'Nenhum Marcador', '1990-09-15', false),
    ( 6, '990992001', 'CANCELADO', 'FINALIZADO',   '38,0/50,0', '"Mestrado"',       '"5 pontos"',   '"3 anos"',                    '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1982-04-27', false),
    ( 7, '990992001', 'INSCRITO',  'FINALIZADO',   '15,0/50,0', '"Especialização"', '"5 pontos"',   '"1 ano&nbsp;"',               '"Ampla concorrência"', '"Sim"', '"Não"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1993-12-01', true),
    ( 8, '990992001', 'INSCRITO',  'EM ANDAMENTO', '38,0/50,0', '"Mestrado"',       '"5 pontos"',   '"3 anos"',                    '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1980-06-30', false),
    -- Enfermeiro do Trabalho (1 vaga)
    ( 9, '990992002', 'INSCRITO',  'FINALIZADO',   '45,0/50,0', '"Especialização"', '"5 pontos"',   '"4 anos ou mais"',            '"Ampla concorrência", "Indígenas", "Pessoas com deficiência (PCD)"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1981-03-14', true),
    (10, '990992002', 'INSCRITO',  'FINALIZADO',   '29,0/50,0', '"Especialização"', '"4 pontos"',   '"2 anos e 6 meses"',          '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'SIM', 'Reprovado',       '1987-08-22', true),
    (11, '990992002', 'INSCRITO',  'FINALIZADO',   '24,0/50,0', '"Mestrado"',       '"1 ponto"',    '"2 anos"',                    '"Pretos ou pardos"',   '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1986-01-09', true),
    (12, '990992002', 'INSCRITO',  'FINALIZADO',   '24,0/50,0', '"Especialização"', '"4 pontos"',   '"2 anos"',                    '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1958-03-10', true),
    (13, '990992002', 'INSCRITO',  'FINALIZADO',   '10,0/50,0', '"Não Possuo"',     '"Não possuo"', '"1 anos e 6 meses"',          '"Ampla concorrência"', '"Sim"', '"Não"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1995-10-18', false),
    (14, '990992002', 'INSCRITO',  'FINALIZADO',   '5,0/50,0',  '"Especialização"', '"Não possuo"', '"6 meses obrigatórios&nbsp;"', '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1996-05-05', false),
    (15, '990992002', 'INSCRITO',  'EM ANDAMENTO', '5,0/50,0',  '"Especialização"', '--',           '--',                          '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1989-07-21', false),
    (16, '990992002', 'INSCRITO',  '--',           '--',        '--',               '--',           '--',                          '--',                   '--',    '--',    '--',     'NÃO', 'Nenhum Marcador', '1992-02-11', false),
    (17, '990992002', 'CANCELADO', 'PENDENTE',     '--',        '--',               '--',           '--',                          '"Ampla concorrência"', '"Sim"', '--',    '--',     'NÃO', 'Nenhum Marcador', '1985-12-24', false),
    -- Engenharia do Trabalho (1 vaga)
    (18, '990992003', 'INSCRITO',  'FINALIZADO',   '43,0/50,0', '"Mestrado"',       '"5 pontos"',   '"3 anos e 6 meses"',          '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1978-09-02', true),
    (19, '990992003', 'INSCRITO',  'FINALIZADO',   '18,0/50,0', '"Especialização"', '"3 pontos"',   '"1 anos e 6 meses"',          '"Pretos ou pardos"',   '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1990-04-16', true),
    (20, '990992003', 'INSCRITO',  'FINALIZADO',   '15,0/50,0', '"Especialização"', '"Não possuo"', '"2 anos"',                    '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nota Alterada',   '1983-11-27', true),
    (21, '990992003', 'INSCRITO',  'FINALIZADO',   '22,0/50,0', '"Especialização"', '"2 pontos"',   '"5 anos"',                    '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1977-06-19', true),
    (22, '990992003', 'INSCRITO',  'FINALIZADO',   '11,0/50,0', '"Especialização"', '"1 ponto"',    '"1 ano&nbsp;"',               '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1994-08-08', false),
    (23, '990992003', 'INSCRITO',  'PENDENTE',     '--',        '--',               '--',           '--',                          '--',                   '"Sim"', '--',    '--',     'NÃO', 'Nenhum Marcador', '1991-03-29', false),
    (24, '990992003', 'INSCRITO',  'FINALIZADO',   '--',        '"Especialização"', '"5 pontos"',   '"3 anos"',                    '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim."', 'NÃO', 'Nenhum Marcador', '1980-10-10', true),
    -- Técnico de Enfermagem do Trabalho (1 vaga)
    (25, '990992004', 'INSCRITO',  'FINALIZADO',   '50,0/50,0', null,               '"10 pontos"',  '"5 anos e 6 meses ou mais"',  '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim"',  'NÃO', 'Nenhum Marcador', '1976-02-02', true),
    (26, '990992004', 'INSCRITO',  'FINALIZADO',   '18,0/50,0', null,               '"6 pontos"',   '"2 anos"',                    '"Indígenas"',          '"Sim"', '"Não"', '"Sim"',  'NÃO', 'Nenhum Marcador', '1989-05-23', true),
    (27, '990992004', 'INSCRITO',  'FINALIZADO',   '8,0/50,0',  null,               '"4 pontos"',   '"1 ano"',                     '"Ampla concorrência"', '"Sim"', '"Não"', '"Sim"',  'NÃO', 'Nenhum Marcador', '1997-09-13', false),
    (28, '990992004', 'INSCRITO',  'FINALIZADO',   '10,0/50,0', null,               '"2 pontos"',   '"1 ano e 6 meses"',           '"Ampla concorrência"', '"Sim"', '"Não"', '"Sim"',  'NÃO', 'Nenhum Marcador', '1993-01-30', false),
    (29, '990992004', 'INSCRITO',  'EM ANDAMENTO', '--',        null,               '"6 pontos"',   '--',                          '"Ampla concorrência"', '"Sim"', '--',    '"Sim"',  'NÃO', 'Nenhum Marcador', '1990-12-12', false),
    (30, '990992004', 'CANCELADO', '--',           '--',        null,               '--',           '--',                          '--',                   '--',    '--',    '--',     'NÃO', 'Nenhum Marcador', '1988-06-06', false),
    (31, '990992004', 'INSCRITO',  'FINALIZADO',   '15,0/50,0', null,               '"3 pontos"',   '"2 anos"',                    '"Ampla concorrência"', '"Sim"', '"Sim"', '"Sim"',  'NÃO', 'Nenhum Marcador', '1992-07-17', true),
    -- Técnico de Segurança do Trabalho (6 vagas)
    (32, '990992005', 'INSCRITO',  'FINALIZADO',   '42,0/50,0', null,               '"10 pontos"',  '"4 anos e 6 meses"',          '"Ampla concorrência"', '"Sim"', null,    '"Sim"',  'NÃO', 'Nenhum Marcador', '1979-08-25', true),
    (33, '990992005', 'INSCRITO',  'FINALIZADO',   '24,0/50,0', null,               '"8 pontos"',   '"2 anos e 6 meses"',          '"Ampla concorrência"', '"Sim"', null,    '"Sim"',  'NÃO', 'Nenhum Marcador', '1985-03-03', true),
    (34, '990992005', 'INSCRITO',  'FINALIZADO',   '20,0/50,0', null,               '"4 pontos"',   '"2 anos e 6 meses"',          '"Pretos ou pardos"',   '"Sim"', null,    '"Sim"',  'NÃO', 'Nenhum Marcador', '1987-10-29', true),
    (35, '990992005', 'INSCRITO',  'FINALIZADO',   '20,0/50,0', null,               '"8 pontos"',   '"2 anos"',                    '"Ampla concorrência"', '"Sim"', null,    '"Sim"',  'NÃO', 'Nenhum Marcador', '1982-01-15', true),
    (36, '990992005', 'INSCRITO',  'FINALIZADO',   '14,0/50,0', null,               '"6 pontos"',   '"1 ano e 6 meses"',           '"Ampla concorrência"', '"Sim"', null,    '"Sim"',  'NÃO', 'Nenhum Marcador', '1994-04-04', false),
    (37, '990992005', 'INSCRITO',  'FINALIZADO',   '2,0/50,0',  null,               '"2 pontos"',   '"6 meses obrigatórios"',      '"Ampla concorrência"', '"Sim"', null,    '"Sim"',  'NÃO', 'Nenhum Marcador', '1998-11-11', false),
    (38, '990992005', 'INSCRITO',  'PENDENTE',     '--',        null,               '--',           '--',                          '--',                   '--',    null,    '--',     'NÃO', 'Nenhum Marcador', '1993-06-26', false),
    (39, '990992005', 'INSCRITO',  'EM ANDAMENTO', '12,0/50,0', null,               '"4 pontos"',   '"1 ano e 6 meses"',           '"Ampla concorrência"', '"Sim"', null,    '"Sim"',  'NÃO', 'Nenhum Marcador', '1986-09-09', false),
    (40, '990992005', 'INSCRITO',  'FINALIZADO',   '24,0/50,0', null,               '"8 pontos"',   '"2 anos e 6 meses"',          '"Ampla concorrência"', '"Sim"', null,    '"Sim"',  'NÃO', 'Nenhum Marcador', '1975-12-20', true);

  -- O edital.
  select m.id into v_id
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" = c_area and m."ST_TREINAMENTO" = 'S'
   order by m.created_at, m.id
   limit 1;
  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA" (
      processo, edital, sigla_unidade, tipo_unidade, unidade, uf, ciclo, cargos, vagas_total, inscritos,
      aptos_analise, data_inicio, data_fim, status, etapa, risco, responsavel, observacoes,
      observacoes_internas, ativo, origem_carga, cronograma_origem, "CO_AREA", "ST_TREINAMENTO")
    values (
      'TREINAMENTO', c_edital, 'TREINO', null, c_unidade, 'RR', '2099',
      'Médico do Trabalho; Enfermeiro do Trabalho; Engenharia do Trabalho; Técnico de Enfermagem do Trabalho; Técnico de Segurança do Trabalho',
      11, 40, 0, v_hoje - 24, v_hoje + 50, 'Em andamento', 'Período de Análise Curricular', 'Baixo', 'Treinamento',
      'Edital de treinamento: dados fictícios, sem valor oficial. Regras do Edital 93/2026.',
      'Criado por private."FC_PREPARAR_EDITAL_TREINAMENTO". Reinicie em Editais (admin).',
      true, 'TREINAMENTO', 'MANUAL', c_area, 'S')
    returning id into v_id;
  end if;

  -- Cronograma relativo a hoje, com as etapas do 93/2026: inscrições encerradas,
  -- análise curricular (avaliação documental) em andamento.
  if not exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = v_id) then
    insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, tipo_atividade, data_inicio, data_fim, origem, observacao)
    select v_id, x.ordem, x.atividade, x.tipo, v_hoje + x.ini, v_hoje + x.fim, 'MANUAL', 'Treinamento'
      from (values
        (1, 'Publicação do Edital', 'PUBLICACAO', -24, -24),
        (2, 'Impugnação do Edital', null, -23, -21),
        (3, 'Período de inscrição e envio dos documentos comprobatórios', 'INSCRICAO', -19, -11),
        (4, 'Período de Análise Curricular', 'ANALISE', -10, 10),
        (5, 'Divulgação do resultado preliminar da validação da documentação', 'RESULTADO', 13, 13),
        (6, 'Solicitação pelo candidato do espelho de nota', null, 14, 14),
        (7, 'Envio do espelho da análise de títulos e experiência profissional', null, 15, 19),
        (8, 'Submissão de recursos relativos à análise documental', 'RECURSO', 20, 21),
        (9, 'Análise e resposta aos recursos interpostos', null, 22, 29),
        (10, 'Divulgação do resultado final da validação da documentação obrigatória e da avaliação de títulos', 'RESULTADO', 30, 30),
        (11, 'Convocação para entrevista', 'CONVOCACAO', 34, 34),
        (12, 'Realização das entrevistas', 'ENTREVISTA', 40, 44),
        (13, 'Resultado das entrevistas', 'RESULTADO', 49, 49),
        (14, 'Divulgação do resultado final do processo seletivo', 'RESULTADO', 50, 50)
      ) x(ordem, atividade, tipo, ini, fim);
  end if;

  -- Quadro de vagas (o do 93/2026).
  if not exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = v_id and q."ST_REGISTRO_ATIVO" = 'S') then
    insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO",
      "DS_MODALIDADE_VAGA", "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
    select v_id, t.ordem, t.cargo, null, '{}'::jsonb, t.imediatas, 'N', 'MANUAL', 'treinamento', v_uid
      from tmp_treino_p_vaga t;
  end if;

  -- Análises fictícias "Pendente" de quem está no lote (como as linhas da planilha que
  -- aguardam a análise). Também ligam a vaga da Empregare ao quadro (cargo e nível).
  -- Fora do painel das análises: origem_planilha = 'treinamento'.
  insert into public."TB_ANALISE_CURRICULAR" (grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, cpf_hash,
    categoria, modalidade_concorrencia, status_consolidado, etapa, analise, ativo, id_origem, data_nascimento,
    nota_empregare, pcd, origem_planilha, chave_natural, "CO_AREA", "CO_PLANILHA")
  select p_grupo, c_unidade, c_edital, c.vaga, v.cargo, 'Candidato Teste P' || lpad(c.n::text, 2, '0'), null,
         v.nivel, 'Ampla Concorrência', 'Pendente', 'Avaliação documental',
         'Análise fictícia do edital de treinamento: aguarda a ficha da avaliação documental.', true,
         'TREINO-P' || lpad(c.n::text, 2, '0'), c.nascimento,
         nullif(replace(split_part(c.art, '/', 1), ',', '.'), '--')::numeric,
         case when c.modal ilike '%PCD%' then 'Sim' else 'Não' end,
         c_origem, c_origem || '|' || c_area || '|TREINO-P' || lpad(c.n::text, 2, '0'), c_area, p_planilha
    from tmp_treino_p_candidato c
    join tmp_treino_p_vaga v on v.vaga = c.vaga
   where c.lote
  on conflict (chave_natural) do nothing;

  -- Regra da classificação (a do 93/2026): o corte da avaliação documental e o nível da vaga.
  select r."CO_REGRA_CLASSIFICACAO" into v_regra_classif
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v_id;
  if v_regra_classif is null then
    v_config_classif := c_classif;
    perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_config_classif);
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (v_id, 1, v_uid) returning "CO_REGRA_CLASSIFICACAO" into v_regra_classif;
    insert into public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra_classif, 1, v_config_classif, 'MESMA_POSICAO', 'Edital de treinamento: cópia da regra do Edital 93/2026', v_uid);
  end if;

  -- Código de vaga fictícia já usado por vaga real ou carregada pelo robô: recusa sem mexer.
  if exists (select 1 from public."TB_EMPREGARE_VAGA" v join tmp_treino_p_vaga t on t.vaga = v."CO_VAGA"
              where v."CO_MONITORAMENTO" is distinct from v_id or v."CO_SYNC" is not null) then
    raise exception 'Vaga fictícia do treinamento já existe fora dele (ou veio do robô da Empregare): nada foi feito' using errcode = '23514';
  end if;

  -- Inscrições e questionários no formato da exportação da Empregare (sem CPF, e-mail fictício).
  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "TP_SITUACAO", "DS_COLUNA", "NO_ARQUIVO",
    "QT_CANDIDATO_ATIVO", "QT_LINHA_ARQUIVO", "QT_RECEBIDA", "DS_MENSAGEM", "DT_ULTIMA_CARGA")
  select t.vaga, v_id, 'GRAVADA', private."FC_TREINO_COLUNAS"(t.questionario, t.enunciados, true),
         'treinamento-' || t.vaga || '.xlsx',
         (select count(*) from tmp_treino_p_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_p_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_p_candidato c where c.vaga = t.vaga),
         'Carga fictícia do edital de treinamento.', now()
    from tmp_treino_p_vaga t
  on conflict ("CO_VAGA") do update set
    "DS_COLUNA" = excluded."DS_COLUNA", "QT_CANDIDATO_ATIVO" = excluded."QT_CANDIDATO_ATIVO",
    "QT_LINHA_ARQUIVO" = excluded."QT_LINHA_ARQUIVO", "QT_RECEBIDA" = excluded."QT_RECEBIDA"
   where public."TB_EMPREGARE_VAGA"."CO_MONITORAMENTO" = v_id and public."TB_EMPREGARE_VAGA"."CO_SYNC" is null;

  insert into public."TB_EMPREGARE_CANDIDATO" ("CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO", "DS_EMAIL", "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA")
  select x.vaga, 'cod:' || x.codigo, 'CODIGO', x.codigo, x.nome, x.email, null, '(00) 00000-0000', x.nascimento,
         x.situacao_empregare, (x.candidatura::timestamp + time '10:00') at time zone 'America/Sao_Paulo', x.original,
         encode(sha256(convert_to(x.original::text, 'UTF8')), 'hex')
    from (
      select c.vaga, k.codigo, k.nome, k.email, c.nascimento, k.candidatura,
             case when c.situacao = 'CANCELADO' then 'Cancelado' else 'Inscrito' end as situacao_empregare,
             private."FC_TREINO_INSCRICAO"(t.questionario, t.enunciados, true, jsonb_build_object(
               'codigo', k.codigo, 'nome', k.nome, 'email', k.email, 'nascimento', c.nascimento,
               'candidatura', k.candidatura, 'uf', 'RR', 'situacao', c.situacao, 'quest', c.quest, 'art', c.art,
               'tit', c.tit, 'cur', c.cur, 'exp', c.exp, 'modal', c.modal, 'escol', c.escol, 'especial', c.especial,
               'registro', c.registro, 'reprovado', c.reprovado, 'marcadores', c.marcadores,
               'conjuge', '"NÃO"', 'contrato', '"Nenhuma das alternativas"', 'declaro', 'Sim',
               'nivel_formacao', case when c.quest = '--' then '--' when t.nivel <> 'Superior' then 'Técnico'
                                      when c.tit = '"Mestrado"' then 'Mestrado'
                                      when c.tit = '"Especialização"' then 'Pós-Graduação' else 'Graduação' end,
               'curso_formacao', t.curso)) as original
        from tmp_treino_p_candidato c
        join tmp_treino_p_vaga t on t.vaga = c.vaga
       cross join lateral (select 'TREINO-P' || lpad(c.n::text, 2, '0') as codigo,
                                  'Candidato Teste P' || lpad(c.n::text, 2, '0') as nome,
                                  'candidato.teste.p' || lpad(c.n::text, 2, '0') || '@exemplo.invalid' as email,
                                  v_hoje - 19 + (c.n % 9) as candidatura) k
    ) x
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do update set
    "NO_CANDIDATO" = excluded."NO_CANDIDATO", "DS_EMAIL" = excluded."DS_EMAIL", "DT_NASCIMENTO" = excluded."DT_NASCIMENTO",
    "DS_SITUACAO_EMPREGARE" = excluded."DS_SITUACAO_EMPREGARE", "DS_COLUNA_ORIGINAL" = excluded."DS_COLUNA_ORIGINAL",
    "DS_HASH_LINHA" = excluded."DS_HASH_LINHA"
   where public."TB_EMPREGARE_CANDIDATO"."CO_SYNC" is null
     and exists (select 1 from public."TB_EMPREGARE_VAGA" v
                  where v."CO_VAGA" = public."TB_EMPREGARE_CANDIDATO"."CO_VAGA" and v."CO_MONITORAMENTO" = v_id and v."CO_SYNC" is null)
     and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" p
                      where p."CO_EMPREGARE_CANDIDATO" = public."TB_EMPREGARE_CANDIDATO"."CO_EMPREGARE_CANDIDATO");

  -- A avaliação documental do edital é feita no MONITORA.
  insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM")
  values (v_id, 'MONITORA')
  on conflict ("CO_MONITORAMENTO") do nothing;

  -- A regra da avaliação documental (cópia conferida, como a do 93/2026) e a pré-classificação.
  v_config_analise := c_regra;
  perform private."FC_REGRA_DO_TREINAMENTO"(v_id, v_config_analise, 'CONFERIDA',
    'Edital de treinamento: cópia da regra conferida do Edital 93/2026 (versão 7)', v_uid);
  perform private."FC_PRE_CLASSIFICAR_TREINAMENTO"(v_id, c_pre);

  return v_id;
end;
$$;
comment on function private."FC_PREPARAR_TREINAMENTO_PROJETOS"(text, text) is
  'Edital de treinamento de Projetos ("Treinamento – Projetos (992/2099)"), espelho do Edital 93/2026: as 5 vagas (códigos fictícios 99099200x), cronograma relativo (inscrições encerradas, análise em andamento), 40 candidatos fictícios com os casos reais, regras (avaliação documental e classificação) copiadas do 93/2026, pré-classificação gravada e fichas PENDENTE. Chamada só por private."FC_PREPARAR_EDITAL_TREINAMENTO".';
revoke all on function private."FC_PREPARAR_TREINAMENTO_PROJETOS"(text, text) from public, anon, authenticated;
grant execute on function private."FC_PREPARAR_TREINAMENTO_PROJETOS"(text, text) to service_role;

-- ── 7. Preparar: Saúde Indígena e Projetos ────────────────────────────────
create or replace function private."FC_PREPARAR_EDITAL_TREINAMENTO"(p_area text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_grupo text;
  v_planilha text;
begin
  if v_area not in ('saude-indigena', 'projetos') then
    raise exception 'Edital de treinamento disponível só para a Saúde Indígena e Projetos' using errcode = '22023';
  end if;
  select a."NO_GRUPO_PLANILHA" into v_grupo from public."TB_AREA" a where a."CO_AREA" = v_area;
  select p."CO_PLANILHA" into v_planilha from public."TB_PLANILHA_ANALISE" p where p."CO_AREA" = v_area;
  if v_grupo is null or v_planilha is null then
    raise exception 'Área sem planilha de análises cadastrada: %', v_area using errcode = '22023';
  end if;

  -- Um edital de treinamento por área; uma preparação por vez.
  perform pg_advisory_xact_lock(hashtextextended('edital_treinamento:' || v_area, 0));

  if v_area = 'projetos' then
    return private."FC_PREPARAR_TREINAMENTO_PROJETOS"(v_grupo, v_planilha);
  end if;
  return private."FC_PREPARAR_TREINAMENTO_SI"(v_grupo, v_planilha);
end;
$$;
comment on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) is
  'Cria ou completa (idempotente) o edital de treinamento da área (ST_TREINAMENTO = S): Saúde Indígena (991/2099, entrevistas e regra do 111/2026) ou Projetos (992/2099, espelho do 93/2026 com a regra conferida dele, pré-classificação e fichas). Devolve o id do edital. Só o service_role (e o reinício, como dono) chamam.';
revoke all on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) from public, anon, authenticated;
grant execute on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) to service_role;

-- ── 8. Reiniciar: os dois editais de treinamento (admin global) ────────────
create or replace function public.reiniciar_edital_treinamento(p_edital uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_apagados jsonb;
  v_id uuid;
begin
  if not private.is_master() then
    raise exception 'Só o administrador global reinicia o edital de treinamento' using errcode = '42501';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_m.id is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if v_m."ST_TREINAMENTO" is distinct from 'S' then
    raise exception 'Só o edital de treinamento pode ser reiniciado' using errcode = '42501';
  end if;
  if v_m."CO_AREA" is null or v_m."CO_AREA" not in ('saude-indigena', 'projetos') then
    raise exception 'Edital de treinamento fora da Saúde Indígena e de Projetos: nada foi apagado' using errcode = '22023';
  end if;

  v_apagados := private."FC_APAGAR_DADOS_DO_TREINAMENTO"(p_edital);

  -- O edital volta ao cadastro inicial (o id fica: links e coordenações seguem valendo).
  if v_m."CO_AREA" = 'projetos' then
    update public."TB_MONITORAMENTO_INDIGENA"
       set processo = 'TREINAMENTO', edital = 'Treinamento – Projetos (992/2099)', unidade = 'Escritório Treinamento',
           sigla_unidade = 'TREINO', tipo_unidade = null, id_unidade = null, uf = 'RR', ciclo = '2099',
           cargos = 'Médico do Trabalho; Enfermeiro do Trabalho; Engenharia do Trabalho; Técnico de Enfermagem do Trabalho; Técnico de Segurança do Trabalho',
           vagas_total = 11, inscritos = 40, aptos_analise = 0, cancelados = 0, eliminados_nota = 0, reprovados_analise = 0,
           total_eliminados = 0, aprovados_analise = 0, aprovados_prova = 0, entrevistados = 0, contratados = 0,
           data_inicio = v_hoje - 24, data_fim = v_hoje + 50, status = 'Em andamento', etapa = 'Período de Análise Curricular',
           risco = 'Baixo', responsavel = 'Treinamento', ativo = true,
           status_override = null, etapa_override = null, status_override_motivo = null,
           status_override_data = null, status_override_previsao_retomada = null,
           updated_by = (select auth.uid()), updated_at = now()
     where id = p_edital and "ST_TREINAMENTO" = 'S';
  else
    update public."TB_MONITORAMENTO_INDIGENA"
       set processo = 'TREINAMENTO', edital = 'Treinamento – Saúde Indígena (991/2099)', unidade = 'DSEI Treinamento',
           sigla_unidade = 'TREINO', tipo_unidade = 'DSEI', id_unidade = null, uf = 'DF', ciclo = '2099',
           cargos = 'Enfermeiro; Técnico de Enfermagem; Agente Indígena de Saúde (AIS)', vagas_total = 7,
           inscritos = 15, aptos_analise = 15, cancelados = 0, eliminados_nota = 0, reprovados_analise = 0,
           total_eliminados = 0, aprovados_analise = 0, aprovados_prova = 0, entrevistados = 0, contratados = 0,
           data_inicio = v_hoje - 45, data_fim = v_hoje + 30, status = 'Em andamento', etapa = 'Entrevistas',
           risco = 'Baixo', responsavel = 'Treinamento', ativo = true,
           status_override = null, etapa_override = null, status_override_motivo = null,
           status_override_data = null, status_override_previsao_retomada = null,
           updated_by = (select auth.uid()), updated_at = now()
     where id = p_edital and "ST_TREINAMENTO" = 'S';
  end if;
  -- A área fica a do edital: o gatilho da área recalcula pela unidade quando ela muda.
  update public."TB_MONITORAMENTO_INDIGENA" set "CO_AREA" = v_m."CO_AREA"
   where id = p_edital and "ST_TREINAMENTO" = 'S' and "CO_AREA" is distinct from v_m."CO_AREA";

  v_id := private."FC_PREPARAR_EDITAL_TREINAMENTO"(v_m."CO_AREA");
  if v_id is distinct from p_edital then
    raise exception 'O reinício não reencontrou o edital de treinamento' using errcode = 'P0001';
  end if;
  return json_build_object('edital', p_edital, 'apagados', v_apagados, 'reiniciado_em', now());
end;
$$;
comment on function public.reiniciar_edital_treinamento(uuid) is
  'Só admin global: volta o edital de TREINAMENTO (ST_TREINAMENTO = S) da Saúde Indígena ou de Projetos ao estado inicial — apaga fisicamente os dados dele (exceção documentada à exclusão lógica) e recria os fictícios (em Projetos, com a pré-classificação e as fichas). Edital real: 42501 e nada muda.';
revoke all on function public.reiniciar_edital_treinamento(uuid) from public, anon;
grant execute on function public.reiniciar_edital_treinamento(uuid) to authenticated, service_role;

-- ── 9. A execução do treinamento fora do Status das atualizações e do painel dos robôs ─
-- (as definições vivas, só com o filtro private."FC_EXECUCAO_EH_TREINAMENTO" na leitura de TL_PRE_CLASSIFICACAO)
CREATE OR REPLACE FUNCTION public.get_saude_das_cargas()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tarefas json;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê a saúde das cargas' using errcode = '42501';
  end if;

  -- pg_cron pode não estar acessível: a seção mostra "indisponível" nessa parte.
  begin
    select coalesce(json_agg(json_build_object(
        'nome', j.jobname,
        'agenda', j.schedule,
        'ativa', j.active,
        'execucoes', (
          select coalesce(json_agg(json_build_object(
              'inicio', d.start_time,
              'fim', d.end_time,
              'situacao', d.status,
              'mensagem', left(d.return_message, 500)
            ) order by d.start_time desc), '[]'::json)
            from (select * from cron.job_run_details r
                   where r.jobid = j.jobid
                   order by r.start_time desc limit 10) d
        )
      ) order by j.jobname), '[]'::json)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := null;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'analises', (
      select coalesce(json_agg(json_build_object(
          'origem', o."CO_ORIGEM",
          'area', p."CO_AREA",
          'planilha', p."NO_PLANILHA",
          'tipo', o."TP_CARGA",
          'execucoes', (
            select coalesce(json_agg(json_build_object(
                'inicio', x.j ->> 'started_at',
                'fim', x.j ->> 'finished_at',
                'situacao', x.j ->> 'status',
                'linhas', coalesce(x.j ->> 'total_processados', x.j ->> 'total_lidos', x.j ->> 'linhas_staging'),
                'mensagem', left(coalesce(x.j ->> 'erro', x.j ->> 'mensagem'), 500),
                -- [nao-trava] encerrada por inatividade (20261007170000)
                'encerrada_por_inatividade', coalesce((x.j -> 'resultado' ->> 'encerrada_por_inatividade')::boolean, false)
              ) order by x.inicio desc nulls last), '[]'::json)
              from (select to_jsonb(s) as j, s.started_at as inicio
                      from public."TL_SYNC_ANALISE" s
                     where s.origem = o."CO_ORIGEM"
                     order by s.started_at desc nulls last
                     limit 10) x
          )
        ) order by p."CO_AREA", o."TP_CARGA" desc), '[]'::json)
        from public."TA_ORIGEM_ANALISE" o
        join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = o."CO_PLANILHA"
    ),
    'entrevistas', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'area', e."CO_AREA"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_ENTREVISTA" t order by t."DT_INICIO" desc limit 10) e
    ),
    'selecao', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_SELECAO" t order by t."DT_INICIO" desc limit 10) e
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'disparo', e."TP_DISPARO",
          'vagas_pedidas', e."QT_VAGA_PEDIDA",
          'vagas_baixadas', e."QT_VAGA_BAIXADA",
          'vagas_falha', e."QT_VAGA_FALHA",
          'vagas_recusadas', e."QT_VAGA_RECUSADA",
          'desativadas', e."QT_DESATIVADA",
          'execucao', e."DS_URL_EXECUCAO"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 10) e
    ),
    'conferencias', (
      select coalesce(json_agg(json_build_object(
          'inicio', c."DT_INICIO",
          'fim', c."DT_FIM",
          'situacao', c."TP_SITUACAO",
          'linhas', c."QT_AVISO_ABERTO",
          'mensagem', c."DS_MENSAGEM",
          'disparo', c."TP_DISPARO",
          'novos', c."QT_AVISO_NOVO",
          'abertos', c."QT_AVISO_ABERTO",
          'resolvidos', c."QT_AVISO_RESOLVIDO",
          'falhas', c."DS_FALHA",
          'execucao', c."DS_URL_EXECUCAO"
        ) order by c."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_CONFERENCIA" t order by t."DT_INICIO" desc limit 10) c
    ),
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
          'inicio', p."DT_INICIO",
          'fim', p."DT_FIM",
          'situacao', p."TP_SITUACAO",
          'linhas', p."QT_INSCRITO",
          'mensagem', p."DS_MENSAGEM",
          'disparo', p."TP_DISPARO",
          'editais', p."QT_EDITAL",
          'vagas', p."QT_VAGA",
          'lote', p."QT_LOTE",
          'refazer', p."ST_REFAZER_LOTE" = 'S',
          'execucao', p."DS_URL_EXECUCAO"
        ) order by p."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t where not private."FC_EXECUCAO_EH_TREINAMENTO"(t."CO_EXECUCAO") order by t."DT_INICIO" desc limit 10) p
    ),
    -- [expurgo-diario] o job diário do expurgo dos anexos do chat (20261007250000)
    'expurgo_chat', (
      select coalesce(json_agg(json_build_object(
          'inicio', x."DT_INICIO",
          'fim', x."DT_FIM",
          'situacao', x."TP_SITUACAO",
          'linhas', x."QT_CONFIRMADO",
          'mensagem', x."DS_MENSAGEM",
          'disparo', x."TP_DISPARO",
          'lotes', x."QT_LOTE",
          'removidos', x."QT_REMOVIDO",
          'confirmados', x."QT_CONFIRMADO",
          'falhas', x."QT_FALHA",
          'pendentes', x."QT_PENDENTE",
          'execucao', x."DS_URL_EXECUCAO"
        ) order by x."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_EXPURGO_ANEXO_CHAT" t order by t."DT_INICIO" desc limit 10) x
    ),
    'tarefas', v_tarefas
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_painel_dos_robos()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê o painel dos robôs' using errcode = '42501';
  end if;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'areas', (
      select coalesce(json_agg(json_build_object('area', a."CO_AREA", 'nome', a."NO_AREA")
               order by a."NU_ORDEM"), '[]'::json)
        from public."TB_AREA" a
    ),
    'editais', (
      select coalesce(json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'numero', private."FC_NUMERO_EDITAL"(m.edital),
               'area', m."CO_AREA", 'unidade', m.unidade, 'ativo', m.ativo, 'status', m.status,
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"))
             order by m."CO_AREA", private."FC_NUMERO_EDITAL"(m.edital) desc nulls last), '[]'::json)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where private."FC_NUMERO_EDITAL"(m.edital) is not null
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
               'id', e."CO_SYNC",
               'inicio', e."DT_INICIO", 'fim', e."DT_FIM", 'situacao', e."TP_SITUACAO",
               'disparo', e."TP_DISPARO",
               'quem', case when e."CO_USUARIO_DISPARO" is null then null
                            else coalesce(nullif(btrim(p.nome), ''), 'Usuário do MONITORA') end,
               'filtro', e."DS_FILTRO", 'forcada', e."ST_FORCADA" = 'S',
               'vagas_pedidas', e."QT_VAGA_PEDIDA", 'vagas_baixadas', e."QT_VAGA_BAIXADA",
               'vagas_falha', e."QT_VAGA_FALHA", 'vagas_recusadas', e."QT_VAGA_RECUSADA",
               'linhas', e."QT_LINHA", 'desativadas', e."QT_DESATIVADA",
               'mensagem', e."DS_MENSAGEM", 'execucao', e."DS_URL_EXECUCAO",
               'por_vaga', (
                 select coalesce(json_agg(json_build_object(
                          'vaga', v."CO_VAGA", 'situacao', v."TP_SITUACAO",
                          'arquivo', v."QT_LINHA_ARQUIVO", 'ativos', v."QT_CANDIDATO_ATIVO",
                          'com_link', (select count(*) from public."TB_EMPREGARE_CANDIDATO" c
                                        where c."CO_VAGA" = v."CO_VAGA" and c."ST_REGISTRO_ATIVO" = 'S'
                                          and c."DS_LINK_DETALHE" is not null),
                          'mensagem', left(v."DS_MENSAGEM", 300))
                        order by v."CO_VAGA"), '[]'::json)
                   from public."TB_EMPREGARE_VAGA" v
                  where v."CO_SYNC" = e."CO_SYNC"
               )
             ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 8) e
        left join public."TB_PERFIL_USUARIO" p on p.user_id = e."CO_USUARIO_DISPARO"
    ),
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
               'id', x."CO_EXECUCAO",
               'inicio', x."DT_INICIO", 'fim', x."DT_FIM", 'situacao', x."TP_SITUACAO",
               'disparo', x."TP_DISPARO",
               'quem', case when x."CO_USUARIO_DISPARO" is null then null
                            else coalesce(nullif(btrim(p.nome), ''), 'Usuário do MONITORA') end,
               'pedido', x."DS_PEDIDO", 'refazer', x."ST_REFAZER_LOTE" = 'S',
               'editais', x."QT_EDITAL", 'vagas', x."QT_VAGA", 'inscritos', x."QT_INSCRITO",
               'lote', x."QT_LOTE", 'mensagem', x."DS_MENSAGEM", 'execucao', x."DS_URL_EXECUCAO"
             ) order by x."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t where not private."FC_EXECUCAO_EH_TREINAMENTO"(t."CO_EXECUCAO") order by t."DT_INICIO" desc limit 8) x
        left join public."TB_PERFIL_USUARIO" p on p.user_id = x."CO_USUARIO_DISPARO"
    )
  );
end;
$function$;

-- ── 10. Os dois editais de treinamento ───────────────────────────────────
select private."FC_PREPARAR_EDITAL_TREINAMENTO"('saude-indigena');
select private."FC_PREPARAR_EDITAL_TREINAMENTO"('projetos');

notify pgrst, 'reload schema';

commit;
