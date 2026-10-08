/*
  ROBÔ DA EMPREGARE: AS RESPOSTAS DO QUESTIONÁRIO (E OS ANEXOS) NA FICHA

  Na ficha da avaliação documental, o botão de cada anexo abria o currículo do
  candidato (DS_LINK_DETALHE, migration 20261007160000), não o documento. A
  exportação não traz o link dos anexos, e o arquivo fica num storage com
  assinatura que EXPIRA (sondagem de 08/10/2026): o link do arquivo não pode
  ser guardado. O que é estável é o identificador da RESPOSTA do questionário
  do candidato na vaga (data-resposta do item na lista de candidaturas), que
  abre a visão de respostas com os anexos:
  /empresa/questionarios/imprimir/<id>| (exige o login da Empregare, que os
  analistas têm). O robô (scripts/robo-empregare/, com --anexos) guarda esse
  identificador.

  O QUE ENTRA
    TB_EMPREGARE_CANDIDATO."CO_RESPOSTA_QUESTIONARIO"   identificador da resposta
    TB_EMPREGARE_CANDIDATO."DT_CAPTURA_RESPOSTA"        quando foi capturado
    gravar_respostas_empregare   o robô grava os identificadores de uma vaga (só service_role)
    obter_ficha_analise          "empregare" ganha resposta_questionario, resposta_capturada_em
                                 e link_respostas

  DADO RESTRITO
    O identificador só abre com login, mas é de um candidato: a tabela segue
    com RLS e sem grant e só a RPC da ficha o devolve, a quem pode ver a ficha.
    Nunca em lista, CSV ou log do robô.

  PRÉ-REQUISITO: 20261007160000_link_do_candidato_na_empregare.sql.

  Ensaio: supabase/ensaios/20261008160000_respostas_do_questionario_na_empregare.sql
  Rollback: supabase/rollback/20261008160000_respostas_do_questionario_na_empregare.sql
*/
begin;

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fechar_vaga_empregare(text, text, jsonb, text, text)') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'TB_EMPREGARE_CANDIDATO'
                       and column_name = 'DS_LINK_DETALHE') then
    raise exception 'Aplique antes 20261007160000_link_do_candidato_na_empregare.sql.';
  end if;
end;
$$;

-- 1. Colunas ----------------------------------------------------------------------------
alter table public."TB_EMPREGARE_CANDIDATO"
  add column "CO_RESPOSTA_QUESTIONARIO" varchar(20),
  add column "DT_CAPTURA_RESPOSTA" timestamptz,
  add constraint "CK_EMPREGCAND_CORESPOSTAQUEST" check (
    "CO_RESPOSTA_QUESTIONARIO" is null or "CO_RESPOSTA_QUESTIONARIO" ~ '^[0-9]{1,20}$');
comment on column public."TB_EMPREGARE_CANDIDATO"."CO_RESPOSTA_QUESTIONARIO" is 'Identificador da resposta do candidato ao questionário da vaga na Empregare (data-resposta do item na lista de candidaturas), capturado pelo robô. Abre a visão de respostas com os anexos (/empresa/questionarios/imprimir/<id>|; exige login). DADO RESTRITO: só a RPC da ficha devolve.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DT_CAPTURA_RESPOSTA" is 'Quando o robô capturou o identificador da resposta pela última vez.';
comment on constraint "CK_EMPREGCAND_CORESPOSTAQUEST" on public."TB_EMPREGARE_CANDIDATO" is 'Identificador da resposta: só dígitos (1 a 20).';

-- 2. Gravação pelo robô -----------------------------------------------------------------
create function public.gravar_respostas_empregare(p_sync text, p_vaga text, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_gravadas integer;
  v_sem_candidato integer;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_respostas) is distinct from 'array' or jsonb_array_length(p_respostas) not between 1 and 5000 then
    raise exception 'Envie de 1 a 5000 respostas por lote' using errcode = '22023';
  end if;

  -- Só candidatos desta vaga e identificador só de dígitos; o resto fica de fora (mantém o anterior).
  with r as (
    select distinct on (btrim(x.codigo)) btrim(x.codigo) as codigo, btrim(x.resposta) as resposta
      from jsonb_to_recordset(p_respostas) as x(codigo text, resposta text)
     where btrim(x.resposta) ~ '^[0-9]{1,20}$' and btrim(x.codigo) <> ''
     order by btrim(x.codigo)
  )
  update public."TB_EMPREGARE_CANDIDATO" c set
    "CO_RESPOSTA_QUESTIONARIO" = r.resposta,
    "DT_CAPTURA_RESPOSTA" = now()
    from r
   where c."CO_VAGA" = p_vaga and c."CO_CANDIDATO_EMPREGARE" = r.codigo;
  get diagnostics v_gravadas = row_count;

  select count(*) into v_sem_candidato
    from jsonb_to_recordset(p_respostas) as x(codigo text)
   where not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                      where c."CO_VAGA" = p_vaga and c."CO_CANDIDATO_EMPREGARE" = btrim(x.codigo));

  return jsonb_build_object('recebidas', jsonb_array_length(p_respostas), 'gravadas', v_gravadas,
                            'sem_candidato', v_sem_candidato);
end;
$function$;
comment on function public.gravar_respostas_empregare(text, text, jsonb) is
  'Recebe (até 5000) os identificadores das respostas ao questionário dos candidatos de uma vaga, capturados pelo robô da Empregare: [{codigo, resposta}], e grava em TB_EMPREGARE_CANDIDATO.CO_RESPOSTA_QUESTIONARIO. Só candidatos da vaga; identificador fora do formato fica de fora (mantém o anterior). Só service_role, com a execução em andamento.';
revoke all on function public.gravar_respostas_empregare(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_respostas_empregare(text, text, jsonb) to service_role;

-- 3. A ficha devolve o link das respostas -------------------------------------------------
create or replace function public.obter_ficha_analise(p_ficha uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_papel text;
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_vigente integer;
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  select r."NU_VERSAO_VIGENTE" into v_vigente from public."TB_REGRA_ANALISE" r where r."CO_REGRA_ANALISE" = v_f."CO_REGRA_ANALISE";
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_f."CO_MONITORAMENTO";
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital), 'area', v_m."CO_AREA"),
    'papel', v_papel,
    'eu', v_uid,
    'pode_editar', v_f."TP_SITUACAO" = 'EM_ANALISE' and v_f."CO_USUARIO_RESERVA" = v_uid and v_f."DT_RESERVA_EXPIRA" > now(),
    'pode_reabrir', v_f."TP_SITUACAO" = 'CONCLUIDA' and coalesce(v_papel, '') = 'COORDENADOR',
    'ficha', (private."FC_FICHA_ANALISE_JSON"(p_ficha)::jsonb || jsonb_build_object(
               'lancamento', v_f."DS_LANCAMENTO", 'resultado', v_f."DS_RESULTADO", 'parecer', v_f."DS_PARECER",
               'tp_resultado', v_f."TP_RESULTADO", 'nota_final', v_f."VL_NOTA_FINAL", 'nota_apurada', v_f."VL_NOTA_APURADA",
               'rascunho_em', v_f."DT_RASCUNHO", 'concluida_em', v_f."DT_CONCLUSAO",
               'concluida_por', (select coalesce(u.nome, u.email) from public."TB_PERFIL_USUARIO" u where u.user_id = v_f."CO_USUARIO_CONCLUSAO"))),
    'regra', json_build_object('versao', v_regra.p_versao, 'vigente', v_vigente, 'situacao', v_regra.p_situacao,
                               'configuracao', v_regra.p_configuracao),
    'documental', private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"),
    'declarada_gravada', (select json_build_object('total', p."VL_NOTA_DECLARADA", 'parciais', p."DS_NOTA_DECLARADA" -> 'parciais',
                                                   'art', p."VL_ART", 'divergente', p."ST_DIVERGENTE" = 'S')
                            from public."TB_PRE_CLASSIFICACAO" p
                           where p."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"),
    'respostas', private."FC_RESPOSTAS_DA_FICHA"(v_f."CO_EMPREGARE_CANDIDATO", v_regra.p_configuracao),
    -- Links da Empregare (dado restrito, só aqui): o do candidato, o das candidaturas da vaga e o das respostas do questionário.
    'empregare', (select json_build_object(
                           'link_candidato', c."DS_LINK_DETALHE",
                           'capturado_em', c."DT_CAPTURA_LINK",
                           'vaga_interno', ev."CO_VAGA_INTERNO",
                           'link_vaga', case when ev."CO_VAGA_INTERNO" is not null
                                             then 'https://corporate.empregare.com/empresa/vagas/candidaturas/' || ev."CO_VAGA_INTERNO" end,
                           'resposta_questionario', c."CO_RESPOSTA_QUESTIONARIO",
                           'resposta_capturada_em', c."DT_CAPTURA_RESPOSTA",
                           'link_respostas', case when c."CO_RESPOSTA_QUESTIONARIO" is not null
                                                  then 'https://corporate.empregare.com/empresa/questionarios/imprimir/'
                                                       || c."CO_RESPOSTA_QUESTIONARIO" || '|' end)
                    from public."TB_EMPREGARE_CANDIDATO" c
                    left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = c."CO_VAGA"
                   where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"),
    'historico', coalesce((
      select json_agg(json_build_object('versao', h."NU_VERSAO", 'acao', h."TP_ACAO", 'situacao', h."TP_SITUACAO",
                                        'quando', h."DT_REGISTRO", 'por', coalesce(u.nome, u.email), 'motivo', h."DS_MOTIVO",
                                        'resultado', h."TP_RESULTADO", 'nota_final', h."VL_NOTA_FINAL",
                                        'alteracao', h."DS_ALTERACAO")
                      order by h."CO_HISTORICO_FICHA" desc)
        from (select * from public."TH_FICHA_ANALISE" x where x."CO_FICHA_ANALISE" = p_ficha
               order by x."CO_HISTORICO_FICHA" desc limit 200) h
        left join public."TB_PERFIL_USUARIO" u on u.user_id = h."CO_USUARIO"), '[]'::json)
  );
end;
$function$;
comment on function public.obter_ficha_analise(uuid) is
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, os links da Empregare capturados pelo robô (empregare: link_candidato da página de detalhes, vaga_interno e link_vaga das candidaturas, resposta_questionario e link_respostas da visão de respostas do questionário com os anexos; dado restrito, só aqui), o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;

commit;
