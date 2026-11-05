/*
  CORREÇÃO DE DADOS — cronogramas: editais SI em andamento/recentes (117 e 102) (RASCUNHO de 05/11/2026 — NÃO APLICADO)

  Por quê: auditoria site × MONITORA de 05/11/2026 (planilha auditoria-site-x-monitora-2026-11-05.xlsx,
  aba Cronogramas). Para cada edital, o Cronograma do MONITORA foi comparado com o documento vigente
  publicado na página do edital em agenciasus.org.br (o "leia-se" da retificação mais recente; sem
  retificação, o Anexo I original). Só entram divergências de confiança alta: datas que mudaram e
  etapas que faltam, casadas pela atividade e pela data antiga.

  - 102/2026 — DSEI Araguaia (Anexo I – Cronograma (edital original) (SEI 0731714)): Resultado Preliminar da Avaliação Documental e de Títulos 24/09 a 25/09 → 25/09; inclui Publicação da Lista Geral de Classificação Provisória (16/09).
  - 117/2026 — DSEI Xingu (Anexo I – Cronograma (edital original) (SEI 0798006)): inclui Publicação da Lista Geral de Classificação Provisória (14/10).

  Fora desta correção (só relatadas na planilha): 114/2026 (congelado); 34/2026 (convocação
  extraordinária, tabela misturada); 103/2026 (o leia-se traz "05/ a 16/10" — erro de digitação; o
  MONITORA já está 05 a 16/10); 37/2026 (a retificação da convocação traz impugnação "18 a 20/07",
  erro de digitação do documento); editais com cronograma de só 2 etapas no MONITORA (2025 e início
  de 2026), SEDE e Projetos.

  3 linhas de cronograma mudam (2 editais): datas alteradas + etapas incluídas.

  O que faz (uma transação, por edital): confere a conta do setor (administrador global ativo,
  auth.uid); guarda o retrato ANTES (private.snapshot_monitoramento_cronograma); corrige as datas
  (casando pela atividade e pela data antiga — se a linha já mudou, falha); inclui as etapas que
  faltam logo depois da etapa indicada; grava cronograma_ultima_errata (quando há retificação) e o
  histórico em TH_CRONOGRAMA_MONIT_INDIG (acao 'errata', ou 'salvar' quando a fonte é o Anexo I
  original), com o diff; reprova (raise exception → nada fica) se o cronograma depois não for
  exatamente o do documento. Nunca toca no 114/2026.

  Assinada pela conta do setor Gestão da Informação de Pessoal (a01afddb-f64b-47d9-80e8-476a1ed14e43).
  Rode SÓ COM A AUTORIZAÇÃO do usuário, e o ensaio antes. Não é idempotente de propósito.
  Depois de aplicar, registre:
    npm run db:estado -- --registrar=correcoes/20261105-cronogramas-si-andamento.sql
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

-- Aplica o "leia-se" (ou o Anexo I original) de um edital: datas novas, etapas incluídas, histórico.
-- p_errata nulo = correção pelo Anexo I original (acao 'salvar', não mexe em cronograma_ultima_errata).
create function pg_temp.retificar(
  p_id uuid,
  p_edital text,
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
  perform 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_id and edital = p_edital and edital <> '114/2026' for update;
  if not found then raise exception 'Edital % (%) não encontrado (ou é o 114/2026, congelado).', p_edital, p_id; end if;

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
        p_edital, v_item ->> 'atividade', v_item ->> 'de_inicio', v_n;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_novas) loop
    if exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG"
                where monitoramento_id = p_id and atividade = v_item ->> 'atividade') then
      raise exception 'Edital %: a etapa "%" já existe.', p_edital, v_item ->> 'atividade';
    end if;
    select ordem + 1 into v_ordem from public."TB_CRONOGRAMA_MONIT_INDIG"
     where monitoramento_id = p_id and atividade like (v_item ->> 'apos') || '%';
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'Edital %: etapa anterior "%" casou % linhas (esperado 1).', p_edital, v_item ->> 'apos', v_n;
    end if;
    -- Em dois passos: a ordem é única por edital e o update linha a linha colidiria com a etapa seguinte.
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

  if p_errata is not null then
    update public."TB_MONITORAMENTO_INDIGENA"
       set cronograma_ultima_errata = p_errata, updated_by = auth.uid(), updated_at = now()
     where id = p_id;
  else
    update public."TB_MONITORAMENTO_INDIGENA"
       set updated_by = auth.uid(), updated_at = now()
     where id = p_id;
  end if;

  v_depois := private.snapshot_monitoramento_cronograma(p_id);
  v_alteracoes := private.diff_monitoramento_cronograma(v_antes, v_depois);

  insert into public."TH_CRONOGRAMA_MONIT_INDIG"(
    monitoramento_id, acao, motivo, numero_errata, created_by, created_by_email,
    cronograma_antes, cronograma_depois, alteracoes, total_alteracoes)
  values (p_id, case when p_errata is null then 'salvar' else 'errata' end, p_motivo, p_errata, auth.uid(),
          nullif(auth.jwt() ->> 'email', ''),
          v_antes, v_depois, v_alteracoes, jsonb_array_length(v_alteracoes));

  -- Conferência: o cronograma inteiro, na ordem, igual ao documento.
  select jsonb_agg(jsonb_build_array(atividade, data_inicio, data_fim) order by ordem)
    into v_obtido
    from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = p_id;
  if v_obtido is distinct from p_esperado then
    raise exception 'Edital %: cronograma depois difere do documento. Obtido: %', p_edital, v_obtido;
  end if;
end;
$f$;

-- 102/2026 — DSEI Araguaia
select pg_temp.retificar(
  '0079ca2a-cc62-45b2-83ec-72985958ab99',
  '102/2026',
  null,
  'Correção pelo Anexo I – Cronograma (edital original) (SEI 0731714): Resultado Preliminar da Avaliação Documental e de Títulos 24/09 a 25/09 → 25/09; inclui Publicação da Lista Geral de Classificação Provisória (16/09).',
  '[{"atividade": "Resultado Preliminar da Avaliação Documental e de Títulos", "de_inicio": "2026-09-24", "inicio": "2026-09-25", "fim": "2026-09-25"}]',
  '[{"atividade": "Publicação da Lista Geral de Classificação Provisória", "apos": "Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos", "inicio": "2026-09-16", "fim": "2026-09-16"}]',
  '[["Publicação do Edital", "2026-09-03", "2026-09-03"],
    ["Impugnação do Edital", "2026-09-04", "2026-09-06"],
    ["Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos", "2026-09-10", "2026-09-14"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-09-16", "2026-09-16"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-09-25", "2026-09-25"],
    ["Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos", "2026-09-26", "2026-09-27"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-10-01", "2026-10-01"],
    ["Convocação para a Entrevista", "2026-10-01", "2026-10-01"],
    ["Período de Entrevistas", "2026-10-05", "2026-10-09"],
    ["Resultado Preliminar das Entrevistas", "2026-10-14", "2026-10-14"],
    ["Prazo para recursos referentes ao resultado preliminar das entrevistas", "2026-10-15", "2026-10-16"],
    ["Resultado final da Entrevista", "2026-10-21", "2026-10-21"],
    ["Resultado final do Processo Seletivo", "2026-10-21", "2026-10-21"]]');

-- 117/2026 — DSEI Xingu
select pg_temp.retificar(
  '82095be3-be18-4522-b339-cecbf2063837',
  '117/2026',
  null,
  'Correção pelo Anexo I – Cronograma (edital original) (SEI 0798006): inclui Publicação da Lista Geral de Classificação Provisória (14/10).',
  '[]',
  '[{"atividade": "Publicação da Lista Geral de Classificação Provisória", "apos": "Período de inscrição e envio dos documentos comprobatórios", "inicio": "2026-10-14", "fim": "2026-10-14"}]',
  '[["Publicação do Edital", "2026-09-29", "2026-09-29"],
    ["Impugnação do Edital", "2026-09-30", "2026-10-02"],
    ["Período de inscrição e envio dos documentos comprobatórios", "2026-10-07", "2026-10-11"],
    ["Publicação da Lista Geral de Classificação Provisória", "2026-10-14", "2026-10-14"],
    ["Resultado Preliminar da Avaliação Documental e de Títulos", "2026-10-23", "2026-10-23"],
    ["Prazo de recurso do resultado preliminar documental", "2026-10-24", "2026-10-25"],
    ["Resultado Final da Avaliação Documental e de Títulos", "2026-10-30", "2026-10-30"],
    ["Convocação para Entrevista", "2026-10-30", "2026-10-30"],
    ["Período de Entrevistas", "2026-11-03", "2026-11-09"],
    ["Resultado Preliminar das Entrevistas", "2026-11-11", "2026-11-11"],
    ["Prazo para recursos das entrevistas", "2026-11-12", "2026-11-13"],
    ["Resultado final da Entrevista", "2026-11-18", "2026-11-18"],
    ["Resultado final do Processo Seletivo", "2026-11-18", "2026-11-18"]]');
-- <<< correcao

commit;
