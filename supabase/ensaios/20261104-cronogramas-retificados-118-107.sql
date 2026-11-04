-- Ensaio da correção supabase/correcoes/20261104-cronogramas-retificados-118-107.sql: roda tudo e termina em ROLLBACK.
/*
  CORREÇÃO DE DADOS — cronogramas retificados dos editais 118/2026 e 107/2026 (04/11/2026)

  Por quê: comparando o Cronograma do MONITORA com o calendário da Saúde
  Indígena, dois editais estavam diferentes das retificações publicadas:

  - 118/2026 — DSEI Potiguara (1ª Retificação do Cronograma, SEI 0856903,
    assinada em 22/10/2026). O cadastro manual de 23/10 gravou "Resultado
    final da Entrevista" e "Resultado final do Processo Seletivo" em 02/11
    (o "leia-se" diz 02/12) e não incluiu "Publicação da Lista Geral de
    Classificação Provisória" (22/10).
  - 107/2026 — DSEI Vale do Javari (1ª Retificação do Cronograma, SEI 0836862,
    assinada em 15/10/2026). O cronograma ficou como o original (última
    gravação em 15/09): entrevistas 26 a 30/10 em vez de 03 a 06/11, e as
    etapas seguintes também; faltava a Lista Geral de Classificação
    Provisória (01/10).

  O que faz (uma transação, por edital):
    1. confere a conta do setor (administrador global ativo, auth.uid);
    2. guarda o retrato ANTES (private.snapshot_monitoramento_cronograma);
    3. corrige as datas das etapas pelo "leia-se" (casando pela atividade e
       pela data antiga — se a linha já mudou, não casa e a correção falha);
    4. inclui a Lista Geral de Classificação Provisória, se ainda não existe,
       empurrando a ordem das etapas seguintes;
    5. grava cronograma_ultima_errata = "1ª Retificação do Cronograma" e o
       histórico em TH_CRONOGRAMA_MONIT_INDIG (acao 'errata', com o diff),
       como a tela faz ao salvar com errata;
    6. reprova (raise exception → nada fica) se o cronograma depois não for
       exatamente o do "leia-se".

  Assinada pela conta do setor Gestão da Informação de Pessoal
  (a01afddb-f64b-47d9-80e8-476a1ed14e43). Rode SÓ COM A AUTORIZAÇÃO do
  usuário. Não é idempotente de propósito: rodar de novo falha no passo 3.
  Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261104-cronogramas-retificados-118-107.sql
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

-- Aplica o "leia-se" de um edital: datas novas, etapa incluída, histórico.
create function pg_temp.retificar(
  p_id uuid,
  p_errata text,
  p_motivo text,
  p_datas jsonb,      -- [{atividade, de_inicio, inicio, fim}]
  p_lista date,       -- data da Lista Geral de Classificação Provisória
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

  if not exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG"
                  where monitoramento_id = p_id and atividade ilike 'Publicação da Lista Geral%') then
    -- Entra logo depois do período de inscrição.
    select ordem + 1 into v_ordem from public."TB_CRONOGRAMA_MONIT_INDIG"
     where monitoramento_id = p_id and atividade ilike 'Período de inscrição%';
    if v_ordem is null then raise exception 'Edital %: sem período de inscrição.', p_id; end if;
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
    values (p_id, v_ordem, 'Publicação da Lista Geral de Classificação Provisória',
            p_lista, p_lista, 'MANUAL', auth.uid(), auth.uid());
  end if;

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

-- 118/2026 — DSEI Potiguara
select pg_temp.retificar(
  '1625d2eb-f7ee-4206-bafb-61788dd7bfc3',
  '1ª Retificação do Cronograma',
  'Correção pela 1ª Retificação do Cronograma (SEI 0856903): resultado final em 02/12 e Lista Geral de Classificação Provisória em 22/10.',
  '[{"atividade":"Resultado final da Entrevista","de_inicio":"2026-11-02","inicio":"2026-12-02","fim":"2026-12-02"},
    {"atividade":"Resultado final do Processo Seletivo","de_inicio":"2026-11-02","inicio":"2026-12-02","fim":"2026-12-02"}]',
  '2026-10-22',
  '[["Publicação do Edital","2026-10-09","2026-10-09"],
    ["Impugnação do Edital","2026-10-10","2026-10-13"],
    ["Período de inscrição e envio dos documentos comprobatórios","2026-10-16","2026-10-20"],
    ["Publicação da Lista Geral de Classificação Provisória","2026-10-22","2026-10-22"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos","2026-10-30","2026-10-30"],
    ["Prazo de recurso do resultado preliminar documental","2026-10-31","2026-11-01"],
    ["Resultado Final da Avaliação Documental e de Títulos","2026-11-09","2026-11-09"],
    ["Convocação para Entrevista","2026-11-09","2026-11-09"],
    ["Período de Entrevistas","2026-11-17","2026-11-19"],
    ["Resultado Preliminar das Entrevistas","2026-11-24","2026-11-24"],
    ["Prazo para recursos das entrevistas","2026-11-25","2026-11-26"],
    ["Resultado final da Entrevista","2026-12-02","2026-12-02"],
    ["Resultado final do Processo Seletivo","2026-12-02","2026-12-02"]]');

-- 107/2026 — DSEI Vale do Javari
select pg_temp.retificar(
  '10bfbcf9-4f21-4b1e-8312-d428cd758f1f',
  '1ª Retificação do Cronograma',
  'Correção pela 1ª Retificação do Cronograma (SEI 0836862): entrevistas 03 a 06/11 e etapas seguintes; Lista Geral de Classificação Provisória em 01/10.',
  '[{"atividade":"Período de Entrevistas","de_inicio":"2026-10-26","inicio":"2026-11-03","fim":"2026-11-06"},
    {"atividade":"Resultado Preliminar das Entrevistas","de_inicio":"2026-11-04","inicio":"2026-11-10","fim":"2026-11-10"},
    {"atividade":"Prazo para recursos das entrevistas","de_inicio":"2026-11-05","inicio":"2026-11-11","fim":"2026-11-12"},
    {"atividade":"Resultado final da Entrevista","de_inicio":"2026-11-12","inicio":"2026-11-17","fim":"2026-11-17"},
    {"atividade":"Resultado final do Processo Seletivo","de_inicio":"2026-11-12","inicio":"2026-11-18","fim":"2026-11-18"}]',
  '2026-10-01',
  '[["Publicação do Edital","2026-09-14","2026-09-14"],
    ["Impugnação do Edital","2026-09-15","2026-09-17"],
    ["Período de inscrição e envio dos documentos comprobatórios","2026-09-22","2026-09-29"],
    ["Publicação da Lista Geral de Classificação Provisória","2026-10-01","2026-10-01"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos","2026-10-13","2026-10-13"],
    ["Prazo de recurso do resultado preliminar documental","2026-10-14","2026-10-15"],
    ["Resultado Final da Avaliação Documental e de Títulos","2026-10-22","2026-10-22"],
    ["Convocação para Entrevista","2026-10-22","2026-10-22"],
    ["Período de Entrevistas","2026-11-03","2026-11-06"],
    ["Resultado Preliminar das Entrevistas","2026-11-10","2026-11-10"],
    ["Prazo para recursos das entrevistas","2026-11-11","2026-11-12"],
    ["Resultado final da Entrevista","2026-11-17","2026-11-17"],
    ["Resultado final do Processo Seletivo","2026-11-18","2026-11-18"]]');
-- <<< correcao

rollback;
