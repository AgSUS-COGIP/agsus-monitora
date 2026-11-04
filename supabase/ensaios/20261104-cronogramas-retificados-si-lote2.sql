-- Ensaio da correção supabase/correcoes/20261104-cronogramas-retificados-si-lote2.sql: roda tudo e termina em ROLLBACK.
/*
  CORREÇÃO DE DADOS — cronogramas retificados da Saúde Indígena, lote 2 (04/11/2026)

  Por quê: continuação de 20261104-cronogramas-retificados-118-107.sql. Para
  cada edital SI em andamento com etapa a partir de 01/10/2026, o Cronograma
  do MONITORA foi comparado com o "leia-se" da retificação mais recente
  publicada na página do edital (agenciasus.org.br). Onze editais estavam
  diferentes:

  - 91/2026 — DSEI Alagoas e Sergipe (2ª Retificação do Cronograma, SEI
    0863042, assinada em 27/10/2026, candidatura sub judice). Convocação para
    a Entrevista ficou 10 a 13/09; o leia-se diz 10/09 a 20/10.
  - 92/2026 — DSEI Rio Tapajós (1ª Retificação do Anexo I, SEI 0752303,
    assinada em 11/09/2026). Inscrição gravada 20 a 27/08; o edital e o
    leia-se dizem 20 a 24/08.
  - 94/2026 — DSEI Vilhena (Comunicado Externo — 1ª Retificação do Anexo I,
    SEI 0753171, assinado em 11/09/2026). Faltava a etapa nova "Definição de
    Modalidade de Entrevista" (11 a 13/09); entrevistas, resultado
    preliminar e recursos estavam com o mês errado (16 a 25/08, 01/09,
    02 e 03/09 em vez de 16 a 25/09, 01/10, 02 e 03/10).
  - 103/2026 — DSEI Mato Grosso do Sul (2ª Retificação do Cronograma, SEI
    0861704, assinada em 26/10/2026, depois da suspensão de 21/10).
    Resultado preliminar documental gravado 24 a 25/09 (leia-se: 25/09) e
    faltava a Lista Geral de Classificação Provisória (16/09).
  - 105/2026 — DSEI Litoral Sul (2ª Retificação do Cronograma, SEI 0868574,
    assinada em 28/10/2026). Recurso documental gravado 01 e 02/09 (leia-se:
    01 e 02/10), resultado final documental 08 a 09/10 (leia-se: 08/10) e
    faltava a Lista Geral (22/09).
  - 108/2026 — DSEI Alto Rio Negro (1ª Retificação do Cronograma, SEI
    0837801, assinada em 15/10/2026). Resultado preliminar documental 08 a
    09/10 (leia-se: 08/10) e faltava a Lista Geral (29/09).
  - 109/2026 — DSEI Médio Rio Solimões e Afluentes (1ª Retificação do
    Cronograma, SEI 0837970, assinada em 15/10/2026). Convocação para
    Entrevista em 19/10 (leia-se: 20/10) e faltava a Lista Geral (30/09).
  - 110/2026 — DSEI Porto Velho (1ª Retificação do Cronograma, SEI 0842398,
    assinada em 16/10/2026). Resultado preliminar documental 08 a 09/10
    (leia-se: 08/10); resultado preliminar das entrevistas 18/10 e recursos
    19 e 20/10 (leia-se: 18/11, 19 e 20/11); faltava a Lista Geral (29/09).
  - 111/2026 — DSEI Parintins (1ª Retificação do Cronograma, SEI 0839464,
    assinada em 16/10/2026). Datas certas; faltava a Lista Geral (30/09).
  - 112/2026 — DSEI Alto Rio Purus (2ª Retificação do Cronograma, SEI
    0896008, assinada em 03/11/2026). Publicação 23 a 24/09 (leia-se: 23/09),
    impugnação só 24/09 (leia-se: 24 a 26/09), resultado final documental e
    convocação 30/10 (leia-se: 29/10), entrevistas 03 a 09/11 (leia-se: 03 a
    11/11), resultado preliminar 11/11 (leia-se: 13/11), recursos 12 e 13/11
    (leia-se: 14 e 15/11); faltava a Lista Geral (09/10).
  - 115/2026 — DSEI Cuiabá (2ª Retificação do Cronograma, SEI 0896006,
    assinada em 03/11/2026). Ficou como a 1ª: entrevistas 09 a 13/11,
    resultado preliminar 17/11, recursos 18 e 19/11 e resultados finais
    25/11; o leia-se diz 10/11, 12/11, 13 e 14/11 e 19/11.

  Conferidos e já iguais ao leia-se (nada a fazer): 79/2026 (2ª Ret.),
  95/2026 (1ª Ret.; cronograma suspenso desde 20/10), 97/2026 (1ª Ret.).
  Fora desta correção: 101/2026 (a Convocação para a Entrevista do leia-se é
  "24/09 e 07/10", duas datas, que não cabem num intervalo sem interpretar);
  114/2026 (congelado); 107/2026 e 118/2026 (correção anterior).

  O que faz (uma transação, por edital):
    1. confere a conta do setor (administrador global ativo, auth.uid);
    2. guarda o retrato ANTES (private.snapshot_monitoramento_cronograma);
    3. corrige as datas das etapas pelo "leia-se" (casando pela atividade e
       pela data antiga — se a linha já mudou, não casa e a correção falha);
    4. inclui as etapas que faltam (Lista Geral de Classificação Provisória;
       no 94, Definição de Modalidade de Entrevista) logo depois da etapa
       indicada, empurrando a ordem das seguintes;
    5. grava cronograma_ultima_errata com o nome da retificação e o
       histórico em TH_CRONOGRAMA_MONIT_INDIG (acao 'errata', com o diff),
       como a tela faz ao salvar com errata;
    6. reprova (raise exception → nada fica) se o cronograma depois não for
       exatamente o do "leia-se".

  Assinada pela conta do setor Gestão da Informação de Pessoal
  (a01afddb-f64b-47d9-80e8-476a1ed14e43). Rode SÓ COM A AUTORIZAÇÃO do
  usuário. Não é idempotente de propósito: rodar de novo falha no passo 3.
  Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261104-cronogramas-retificados-si-lote2.sql
  Para desfazer: o histórico guarda o cronograma_antes de cada edital.
*/
begin;

-- >>> correcao
set local lock_timeout = '3s';

-- A autoria desta transação: auth.uid() = conta do setor.
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated","email":"dados.recursoshumanos@agenciasus.org.br"}', true);

do $$
begin
  if not exists (select 1 from public."TB_PERFIL_USUARIO" p
                   join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                  where p.user_id = 'a01afddb-f64b-47d9-80e8-476a1ed14e43' and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'A conta do setor (a01afddb-…) não é administrador global ativo.';
  end if;
  if auth.uid() is distinct from 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid then
    raise exception 'auth.uid() desta transação não é a conta do setor.';
  end if;
end;
$$;

-- Aplica o "leia-se" de um edital: datas novas, etapas incluídas, histórico.
create function pg_temp.retificar(
  p_id uuid,
  p_errata text,
  p_motivo text,
  p_datas jsonb,      -- [{atividade, de_inicio, inicio, fim}]
  p_novas jsonb,      -- [{atividade, apos (início do nome da etapa anterior), inicio, fim}]
  p_esperado jsonb    -- [[atividade, inicio, fim], …] na ordem final
) returns void language plpgsql as $f$
declare
  v_antes jsonb;
  v_depois jsonb;
  v_alteracoes jsonb;
  v_item jsonb;
  v_n int;
  v_ordem int;
  v_obtido jsonb;
begin
  perform 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_id for update;
  if not found then raise exception 'Edital % não encontrado.', p_id; end if;

  v_antes := private.snapshot_monitoramento_cronograma(p_id);

  for v_item in select * from jsonb_array_elements(p_datas) loop
    update public."TB_CRONOGRAMA_MONIT_INDIG"
       set data_inicio = (v_item ->> 'inicio')::date,
           data_fim = (v_item ->> 'fim')::date,
           updated_by = auth.uid(),
           updated_at = now()
     where monitoramento_id = p_id
       and atividade = v_item ->> 'atividade'
       and data_inicio = (v_item ->> 'de_inicio')::date;
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'Edital %: "%" em % casou % linhas (esperado 1).',
        p_id, v_item ->> 'atividade', v_item ->> 'de_inicio', v_n;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_novas) loop
    if exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG"
                where monitoramento_id = p_id and atividade = v_item ->> 'atividade') then
      raise exception 'Edital %: a etapa "%" já existe.', p_id, v_item ->> 'atividade';
    end if;
    select ordem + 1 into v_ordem from public."TB_CRONOGRAMA_MONIT_INDIG"
     where monitoramento_id = p_id and atividade like (v_item ->> 'apos') || '%';
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'Edital %: etapa anterior "%" casou % linhas (esperado 1).', p_id, v_item ->> 'apos', v_n;
    end if;
    -- Em dois passos: a ordem é única por edital e o update linha a linha
    -- colidiria com a etapa seguinte.
    update public."TB_CRONOGRAMA_MONIT_INDIG"
       set ordem = -(ordem + 1)
     where monitoramento_id = p_id and ordem >= v_ordem;
    update public."TB_CRONOGRAMA_MONIT_INDIG"
       set ordem = -ordem, updated_by = auth.uid(), updated_at = now()
     where monitoramento_id = p_id and ordem < 0;
    insert into public."TB_CRONOGRAMA_MONIT_INDIG"
      (monitoramento_id, ordem, atividade, data_inicio, data_fim, origem, created_by, updated_by)
    values (p_id, v_ordem, v_item ->> 'atividade',
            (v_item ->> 'inicio')::date, (v_item ->> 'fim')::date, 'MANUAL', auth.uid(), auth.uid());
  end loop;

  update public."TB_MONITORAMENTO_INDIGENA"
     set cronograma_ultima_errata = p_errata,
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_id;

  v_depois := private.snapshot_monitoramento_cronograma(p_id);
  v_alteracoes := private.diff_monitoramento_cronograma(v_antes, v_depois);

  insert into public."TH_CRONOGRAMA_MONIT_INDIG"(
    monitoramento_id, acao, motivo, numero_errata, created_by, created_by_email,
    cronograma_antes, cronograma_depois, alteracoes, total_alteracoes)
  values (p_id, 'errata', p_motivo, p_errata, auth.uid(),
          nullif(auth.jwt() ->> 'email', ''),
          v_antes, v_depois, v_alteracoes, jsonb_array_length(v_alteracoes));

  -- Conferência: o cronograma inteiro, na ordem, igual ao "leia-se".
  select jsonb_agg(jsonb_build_array(atividade, data_inicio, data_fim) order by ordem)
    into v_obtido
    from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = p_id;
  if v_obtido is distinct from p_esperado then
    raise exception 'Edital %: cronograma depois difere do leia-se. Obtido: %', p_id, v_obtido;
  end if;
end;
$f$;

-- 91/2026 — DSEI Alagoas e Sergipe
select pg_temp.retificar(
  '33c0aa5e-98ee-4997-b8fc-1fecb3e64504',
  '2ª Retificação do Cronograma',
  'Correção pela 2ª Retificação do Cronograma (SEI 0863042): Convocação para a Entrevista de 10/09 a 20/10.',
  '[{"atividade": "Convocação para a Entrevista", "de_inicio": "2026-09-10", "inicio": "2026-09-10", "fim": "2026-10-20"}]',
  '[]',
  '[["Publicação do Edital", "2026-08-07", "2026-08-07"],
    ["Impugnação do Edital", "2026-08-08", "2026-08-10"],
    ["Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos", "2026-08-13", "2026-08-17"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-08-31", "2026-08-31"],
    ["Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos", "2026-09-01", "2026-09-02"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-09-10", "2026-09-10"],
    ["Convocação para a Entrevista", "2026-09-10", "2026-10-20"],
    ["Período de Entrevistas", "2026-09-14", "2026-10-22"],
    ["Resultado Preliminar das Entrevistas", "2026-10-27", "2026-10-27"],
    ["Prazo para recursos referentes ao resultado preliminar das entrevistas", "2026-10-28", "2026-10-29"],
    ["Resultado final da Entrevista", "2026-11-05", "2026-11-05"],
    ["Resultado final do Processo Seletivo", "2026-11-05", "2026-11-05"]]');

-- 92/2026 — DSEI Rio Tapajós
select pg_temp.retificar(
  '62782387-8d05-4296-b043-dfddae5df381',
  '1ª Retificação do Anexo I',
  'Correção pela 1ª Retificação do Anexo I (SEI 0752303): inscrição de 20 a 24/08, como no edital e no leia-se.',
  '[{"atividade": "Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos", "de_inicio": "2026-08-20", "inicio": "2026-08-20", "fim": "2026-08-24"}]',
  '[]',
  '[["Publicação do Edital", "2026-08-14", "2026-08-14"],
    ["Impugnação do Edital", "2026-08-15", "2026-08-17"],
    ["Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos", "2026-08-20", "2026-08-24"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-09-04", "2026-09-04"],
    ["Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos", "2026-09-05", "2026-09-06"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-09-11", "2026-09-11"],
    ["Convocação para a Entrevista", "2026-09-11", "2026-09-11"],
    ["Período de Entrevistas", "2026-09-14", "2026-09-24"],
    ["Resultado Preliminar das Entrevistas", "2026-09-28", "2026-09-28"],
    ["Prazo para recursos referentes ao resultado preliminar das entrevistas", "2026-09-29", "2026-09-30"],
    ["Resultado final da Entrevista", "2026-10-05", "2026-10-05"],
    ["Resultado final do Processo Seletivo", "2026-10-06", "2026-10-06"]]');

-- 94/2026 — DSEI Vilhena
select pg_temp.retificar(
  'ff0f2346-0b58-4a6a-815b-2713533773b8',
  '1ª Retificação do Anexo I',
  'Correção pela 1ª Retificação do Anexo I (SEI 0753171): Definição de Modalidade de Entrevista (11 a 13/09), entrevistas 16 a 25/09, resultado preliminar 01/10 e recursos 02 e 03/10.',
  '[{"atividade": "Período de Entrevistas", "de_inicio": "2026-08-16", "inicio": "2026-09-16", "fim": "2026-09-25"},
    {"atividade": "Resultado Preliminar das Entrevistas", "de_inicio": "2026-09-01", "inicio": "2026-10-01", "fim": "2026-10-01"},
    {"atividade": "Prazo para recursos referentes ao resultado preliminar das entrevistas", "de_inicio": "2026-09-02", "inicio": "2026-10-02", "fim": "2026-10-03"}]',
  '[{"atividade": "Definição de Modalidade de Entrevista", "apos": "Resultado Final da Avaliação Documental", "inicio": "2026-09-11", "fim": "2026-09-13"}]',
  '[["Publicação do Edital", "2026-08-14", "2026-08-14"],
    ["Impugnação do Edital", "2026-08-15", "2026-08-17"],
    ["Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos", "2026-08-20", "2026-08-27"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-09-04", "2026-09-04"],
    ["Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos", "2026-09-05", "2026-09-06"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-09-11", "2026-09-11"],
    ["Definição de Modalidade de Entrevista", "2026-09-11", "2026-09-13"],
    ["Convocação para a Entrevista", "2026-09-15", "2026-09-15"],
    ["Período de Entrevistas", "2026-09-16", "2026-09-25"],
    ["Resultado Preliminar das Entrevistas", "2026-10-01", "2026-10-01"],
    ["Prazo para recursos referentes ao resultado preliminar das entrevistas", "2026-10-02", "2026-10-03"],
    ["Resultado final da Entrevista", "2026-10-13", "2026-10-13"],
    ["Resultado final do Processo Seletivo", "2026-10-14", "2026-10-14"]]');

-- 103/2026 — DSEI Mato Grosso do Sul
select pg_temp.retificar(
  '6a5386fe-9fc2-40a3-acab-e8205097bdc0',
  '2ª Retificação do Cronograma',
  'Correção pela 2ª Retificação do Cronograma (SEI 0861704): resultado preliminar documental em 25/09 e Lista Geral de Classificação Provisória em 16/09.',
  '[{"atividade": "Resultado Preliminar da Avaliação Documental e de Títulos", "de_inicio": "2026-09-24", "inicio": "2026-09-25", "fim": "2026-09-25"}]',
  '[{"atividade": "Publicação da Lista Geral de Classificação Provisória", "apos": "Período de inscrição", "inicio": "2026-09-16", "fim": "2026-09-16"}]',
  '[["Publicação do Edital", "2026-09-03", "2026-09-03"],
    ["Impugnação do Edital", "2026-09-04", "2026-09-06"],
    ["Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos", "2026-09-10", "2026-09-14"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-09-16", "2026-09-16"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-09-25", "2026-09-25"],
    ["Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos", "2026-09-26", "2026-09-27"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-10-01", "2026-10-01"],
    ["Convocação para a Entrevista", "2026-10-01", "2026-10-01"],
    ["Período de Entrevistas", "2026-10-05", "2026-10-16"],
    ["Resultado Preliminar das Entrevistas", "2026-10-26", "2026-10-26"],
    ["Prazo para recursos referentes ao resultado preliminar das entrevistas", "2026-10-28", "2026-10-29"],
    ["Resultado final da Entrevista", "2026-11-05", "2026-11-05"],
    ["Resultado final do Processo Seletivo", "2026-11-05", "2026-11-05"]]');

-- 105/2026 — DSEI Litoral Sul
select pg_temp.retificar(
  '0f8b8641-3a54-47dc-8e04-a3b72268d99c',
  '2ª Retificação do Cronograma',
  'Correção pela 2ª Retificação do Cronograma (SEI 0868574): recurso documental 01 e 02/10, resultado final documental 08/10 e Lista Geral de Classificação Provisória em 22/09.',
  '[{"atividade": "Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos", "de_inicio": "2026-09-01", "inicio": "2026-10-01", "fim": "2026-10-02"},
    {"atividade": "Resultado Final da Avaliação Documental e de Títulos", "de_inicio": "2026-10-08", "inicio": "2026-10-08", "fim": "2026-10-08"}]',
  '[{"atividade": "Publicação da Lista Geral de Classificação Provisória", "apos": "Período de inscrição", "inicio": "2026-09-22", "fim": "2026-09-22"}]',
  '[["Publicação do Edital", "2026-09-08", "2026-09-08"],
    ["Impugnação do Edital", "2026-09-09", "2026-09-11"],
    ["Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos", "2026-09-16", "2026-09-20"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-09-22", "2026-09-22"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-09-30", "2026-09-30"],
    ["Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos", "2026-10-01", "2026-10-02"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-10-08", "2026-10-08"],
    ["Convocação para a Entrevista", "2026-10-09", "2026-10-09"],
    ["Período de Entrevistas", "2026-10-13", "2026-11-18"],
    ["Resultado Preliminar das Entrevistas", "2026-11-24", "2026-11-24"],
    ["Prazo para recursos referentes ao resultado preliminar das entrevistas", "2026-11-25", "2026-11-26"],
    ["Resultado final da Entrevista", "2026-12-03", "2026-12-03"],
    ["Resultado final do Processo Seletivo", "2026-12-03", "2026-12-03"]]');

-- 108/2026 — DSEI Alto Rio Negro
select pg_temp.retificar(
  '5fb89464-e47f-4960-9a42-f329468c45de',
  '1ª Retificação do Cronograma',
  'Correção pela 1ª Retificação do Cronograma (SEI 0837801): resultado preliminar documental só em 08/10 e Lista Geral de Classificação Provisória em 29/09.',
  '[{"atividade": "Resultado Preliminar da Avaliação Documental e de Títulos", "de_inicio": "2026-10-08", "inicio": "2026-10-08", "fim": "2026-10-08"}]',
  '[{"atividade": "Publicação da Lista Geral de Classificação Provisória", "apos": "Período de inscrição", "inicio": "2026-09-29", "fim": "2026-09-29"}]',
  '[["Publicação do Edital", "2026-09-16", "2026-09-16"],
    ["Impugnação do Edital", "2026-09-17", "2026-09-19"],
    ["Período de inscrição e envio dos documentos comprobatórios", "2026-09-23", "2026-09-27"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-09-29", "2026-09-29"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-10-08", "2026-10-08"],
    ["Prazo de recurso do resultado preliminar documental", "2026-10-09", "2026-10-10"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-10-16", "2026-10-16"],
    ["Convocação para Entrevista", "2026-10-16", "2026-10-16"],
    ["Período de Entrevistas", "2026-10-19", "2026-10-27"],
    ["Resultado Preliminar das Entrevistas", "2026-10-30", "2026-10-30"],
    ["Prazo para recursos das entrevistas", "2026-10-31", "2026-11-01"],
    ["Resultado final da Entrevista", "2026-11-06", "2026-11-06"],
    ["Resultado final do Processo Seletivo", "2026-11-06", "2026-11-06"]]');

-- 109/2026 — DSEI Médio Rio Solimões e Afluentes
select pg_temp.retificar(
  '467e1c32-d166-48b6-a8e2-d06238c10cab',
  '1ª Retificação do Cronograma',
  'Correção pela 1ª Retificação do Cronograma (SEI 0837970): Convocação para Entrevista em 20/10 e Lista Geral de Classificação Provisória em 30/09.',
  '[{"atividade": "Convocação para Entrevista", "de_inicio": "2026-10-19", "inicio": "2026-10-20", "fim": "2026-10-20"}]',
  '[{"atividade": "Publicação da Lista Geral de Classificação Provisória", "apos": "Período de inscrição", "inicio": "2026-09-30", "fim": "2026-09-30"}]',
  '[["Publicação do Edital", "2026-09-18", "2026-09-18"],
    ["Impugnação do Edital", "2026-09-19", "2026-09-21"],
    ["Período de inscrição e envio dos documentos comprobatórios", "2026-09-24", "2026-09-28"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-09-30", "2026-09-30"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-10-09", "2026-10-09"],
    ["Prazo de recurso do resultado preliminar documental", "2026-10-10", "2026-10-11"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-10-19", "2026-10-19"],
    ["Convocação para Entrevista", "2026-10-20", "2026-10-20"],
    ["Período de Entrevistas", "2026-11-09", "2026-11-13"],
    ["Resultado Preliminar das Entrevistas", "2026-11-17", "2026-11-17"],
    ["Prazo para recursos das entrevistas", "2026-11-18", "2026-11-19"],
    ["Resultado final da Entrevista", "2026-11-25", "2026-11-25"],
    ["Resultado final do Processo Seletivo", "2026-11-25", "2026-11-25"]]');

-- 110/2026 — DSEI Porto Velho
select pg_temp.retificar(
  '64811db4-bf03-4092-bb70-13b347906d46',
  '1ª Retificação do Cronograma',
  'Correção pela 1ª Retificação do Cronograma (SEI 0842398): resultado preliminar documental só em 08/10, resultado preliminar das entrevistas 18/11, recursos 19 e 20/11 e Lista Geral de Classificação Provisória em 29/09.',
  '[{"atividade": "Resultado Preliminar da Avaliação Documental e de Títulos", "de_inicio": "2026-10-08", "inicio": "2026-10-08", "fim": "2026-10-08"},
    {"atividade": "Resultado Preliminar das Entrevistas", "de_inicio": "2026-10-18", "inicio": "2026-11-18", "fim": "2026-11-18"},
    {"atividade": "Prazo para recursos das entrevistas", "de_inicio": "2026-10-19", "inicio": "2026-11-19", "fim": "2026-11-20"}]',
  '[{"atividade": "Publicação da Lista Geral de Classificação Provisória", "apos": "Período de inscrição", "inicio": "2026-09-29", "fim": "2026-09-29"}]',
  '[["Publicação do Edital", "2026-09-16", "2026-09-16"],
    ["Impugnação do Edital", "2026-09-17", "2026-09-19"],
    ["Período de inscrição e envio dos documentos comprobatórios", "2026-09-23", "2026-09-27"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-09-29", "2026-09-29"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-10-08", "2026-10-08"],
    ["Prazo de recurso do resultado preliminar documental", "2026-10-09", "2026-10-10"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-10-16", "2026-10-16"],
    ["Convocação para Entrevista", "2026-10-16", "2026-10-16"],
    ["Período de Entrevistas", "2026-10-19", "2026-11-13"],
    ["Resultado Preliminar das Entrevistas", "2026-11-18", "2026-11-18"],
    ["Prazo para recursos das entrevistas", "2026-11-19", "2026-11-20"],
    ["Resultado final da Entrevista", "2026-11-25", "2026-11-25"],
    ["Resultado final do Processo Seletivo", "2026-11-25", "2026-11-25"]]');

-- 111/2026 — DSEI Parintins
select pg_temp.retificar(
  'be4de98f-ba77-45f7-9a0e-103e5ed16156',
  '1ª Retificação do Cronograma',
  'Correção pela 1ª Retificação do Cronograma (SEI 0839464): Lista Geral de Classificação Provisória em 30/09.',
  '[]',
  '[{"atividade": "Publicação da Lista Geral de Classificação Provisória", "apos": "Período de inscrição", "inicio": "2026-09-30", "fim": "2026-09-30"}]',
  '[["Publicação do Edital", "2026-09-18", "2026-09-18"],
    ["Impugnação do Edital", "2026-09-19", "2026-09-21"],
    ["Período de inscrição e envio dos documentos comprobatórios", "2026-09-24", "2026-09-28"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-09-30", "2026-09-30"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-10-09", "2026-10-09"],
    ["Prazo de recurso do resultado preliminar documental", "2026-10-10", "2026-10-11"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-10-19", "2026-10-19"],
    ["Convocação para Entrevista", "2026-10-19", "2026-10-19"],
    ["Período de Entrevistas", "2026-11-03", "2026-11-06"],
    ["Resultado Preliminar das Entrevistas", "2026-11-10", "2026-11-10"],
    ["Prazo para recursos das entrevistas", "2026-11-11", "2026-11-12"],
    ["Resultado final da Entrevista", "2026-11-17", "2026-11-17"],
    ["Resultado final do Processo Seletivo", "2026-11-18", "2026-11-18"]]');

-- 112/2026 — DSEI Alto Rio Purus
select pg_temp.retificar(
  'a22901ed-c247-4a4b-aa9c-c75824e2bdfb',
  '2ª Retificação do Cronograma',
  'Correção pela 2ª Retificação do Cronograma (SEI 0896008): publicação 23/09, impugnação 24 a 26/09, resultado final documental e convocação 29/10, entrevistas 03 a 11/11, resultado preliminar 13/11, recursos 14 e 15/11 e Lista Geral de Classificação Provisória em 09/10.',
  '[{"atividade": "Publicação do Edital", "de_inicio": "2026-09-23", "inicio": "2026-09-23", "fim": "2026-09-23"},
    {"atividade": "Impugnação do Edital", "de_inicio": "2026-09-24", "inicio": "2026-09-24", "fim": "2026-09-26"},
    {"atividade": "Resultado Final da Avaliação Documental e de Títulos", "de_inicio": "2026-10-30", "inicio": "2026-10-29", "fim": "2026-10-29"},
    {"atividade": "Convocação para Entrevista", "de_inicio": "2026-10-30", "inicio": "2026-10-29", "fim": "2026-10-29"},
    {"atividade": "Período de Entrevistas", "de_inicio": "2026-11-03", "inicio": "2026-11-03", "fim": "2026-11-11"},
    {"atividade": "Resultado Preliminar das Entrevistas", "de_inicio": "2026-11-11", "inicio": "2026-11-13", "fim": "2026-11-13"},
    {"atividade": "Prazo para recursos das entrevistas", "de_inicio": "2026-11-12", "inicio": "2026-11-14", "fim": "2026-11-15"}]',
  '[{"atividade": "Publicação da Lista Geral de Classificação Provisória", "apos": "Período de inscrição", "inicio": "2026-10-09", "fim": "2026-10-09"}]',
  '[["Publicação do Edital", "2026-09-23", "2026-09-23"],
    ["Impugnação do Edital", "2026-09-24", "2026-09-26"],
    ["Período de inscrição e envio dos documentos comprobatórios", "2026-09-30", "2026-10-07"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-10-09", "2026-10-09"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-10-22", "2026-10-22"],
    ["Prazo de recurso do resultado preliminar documental", "2026-10-23", "2026-10-24"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-10-29", "2026-10-29"],
    ["Convocação para Entrevista", "2026-10-29", "2026-10-29"],
    ["Período de Entrevistas", "2026-11-03", "2026-11-11"],
    ["Resultado Preliminar das Entrevistas", "2026-11-13", "2026-11-13"],
    ["Prazo para recursos das entrevistas", "2026-11-14", "2026-11-15"],
    ["Resultado final da Entrevista", "2026-11-19", "2026-11-19"],
    ["Resultado final do Processo Seletivo", "2026-11-19", "2026-11-19"]]');

-- 115 — DSEI Cuiabá
select pg_temp.retificar(
  '63d95670-e7db-448a-9e73-58968f1a4327',
  '2ª Retificação do Cronograma',
  'Correção pela 2ª Retificação do Cronograma (SEI 0896006): entrevistas em 10/11, resultado preliminar 12/11, recursos 13 e 14/11 e resultados finais em 19/11.',
  '[{"atividade": "Período de Entrevistas", "de_inicio": "2026-11-09", "inicio": "2026-11-10", "fim": "2026-11-10"},
    {"atividade": "Resultado Preliminar das Entrevistas", "de_inicio": "2026-11-17", "inicio": "2026-11-12", "fim": "2026-11-12"},
    {"atividade": "Prazo para recursos referentes ao resultado preliminar das entrevistas", "de_inicio": "2026-11-18", "inicio": "2026-11-13", "fim": "2026-11-14"},
    {"atividade": "Resultado final da Entrevista", "de_inicio": "2026-11-25", "inicio": "2026-11-19", "fim": "2026-11-19"},
    {"atividade": "Resultado final do Processo Seletivo", "de_inicio": "2026-11-25", "inicio": "2026-11-19", "fim": "2026-11-19"}]',
  '[]',
  '[["Publicação do Edital", "2026-10-02", "2026-10-02"],
    ["Impugnação do Edital", "2026-10-03", "2026-10-05"],
    ["Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos", "2026-10-08", "2026-10-13"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-10-15", "2026-10-15"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-10-26", "2026-10-26"],
    ["Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos", "2026-10-27", "2026-10-28"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-11-05", "2026-11-05"],
    ["Convocação para a Entrevista", "2026-11-05", "2026-11-05"],
    ["Período de Entrevistas", "2026-11-10", "2026-11-10"],
    ["Resultado Preliminar das Entrevistas", "2026-11-12", "2026-11-12"],
    ["Prazo para recursos referentes ao resultado preliminar das entrevistas", "2026-11-13", "2026-11-14"],
    ["Resultado final da Entrevista", "2026-11-19", "2026-11-19"],
    ["Resultado final do Processo Seletivo", "2026-11-19", "2026-11-19"]]');
-- <<< correcao

rollback;
