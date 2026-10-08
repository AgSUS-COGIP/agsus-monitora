/*
  ENSAIO de 20261008160000_respostas_do_questionario_na_empregare.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere:
    E1  colunas novas, tabela sem acesso direto, RPC do robô só para o
        service_role; só a gravação e a ficha leem CO_RESPOSTA_QUESTIONARIO;
    E2  como o robô (service_role), na vaga fictícia 99999502: identificador
        válido gravado, inválido e candidato de fora recusados, execução
        fechada recusa;
    E3  como pessoas (authenticated): o analista da vaga recebe o link das
        respostas na ficha; quem não vê a ficha é barrado (42501); a fila não
        traz o identificador;
    E4  depois de "reset role": o que ficou gravado e a CK.
  Termina em ROLLBACK: nada fica gravado. Identificadores são fictícios; a
  ficha usada é uma existente, com o candidato dela recebendo um identificador
  fictício só dentro da transação; nada pessoal é mostrado.

  Precisa de: 20261007160000 aplicada, ao menos uma ficha da avaliação
  documental e nenhuma execução do robô em andamento.

  Resultado esperado: as mensagens "ok E1" … "ok E4" e a linha "ENSAIO OK" do
  SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/respostas-do-questionario-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

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

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Colunas, sem acesso direto, permissões; o identificador só em duas funções.
do $$
declare
  v_outras text;
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'TB_EMPREGARE_CANDIDATO'
         and column_name in ('CO_RESPOSTA_QUESTIONARIO', 'DT_CAPTURA_RESPOSTA')) <> 2 then
    raise exception 'FALHOU E1: colunas novas';
  end if;
  if has_table_privilege('authenticated', 'public."TB_EMPREGARE_CANDIDATO"', 'select')
     or has_column_privilege('authenticated', 'public."TB_EMPREGARE_CANDIDATO"', 'CO_RESPOSTA_QUESTIONARIO', 'select')
     or has_table_privilege('anon', 'public."TB_EMPREGARE_CANDIDATO"', 'select') then
    raise exception 'FALHOU E1: tabela com acesso direto';
  end if;
  if not has_function_privilege('service_role', 'public.gravar_respostas_empregare(text, text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.gravar_respostas_empregare(text, text, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.gravar_respostas_empregare(text, text, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.obter_ficha_analise(uuid)', 'execute')
     or has_function_privilege('anon', 'public.obter_ficha_analise(uuid)', 'execute') then
    raise exception 'FALHOU E1: permissões das funções';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_outras
    from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and p.prosrc ~ 'CO_RESPOSTA_QUESTIONARIO'
     and p.proname not in ('gravar_respostas_empregare', 'obter_ficha_analise');
  if v_outras is not null then
    raise exception 'FALHOU E1: outras funções leem o identificador: %', v_outras;
  end if;
  raise notice 'ok E1: colunas, sem grant, RPC do robô só service_role, identificador só na gravação e na ficha';
end;
$$;

-- E2. A gravação como o robô (papel service_role), na vaga fictícia 99999502.
set local role service_role;
do $$
declare
  v jsonb;
begin
  perform public.iniciar_sync_empregare('gh-ensaio-resp-0001', 'GITHUB', null, '{}'::jsonb, 1, null, false);
  v := public.gravar_lote_empregare('gh-ensaio-resp-0001', '99999502', 2, jsonb_build_array(
    jsonb_build_object('chave', 'cod:ENSAIOR1', 'tipo', 'CODIGO', 'codigo', 'ENSAIOR1', 'colunas', '{"Nome":"Ensaio R1"}'::jsonb),
    jsonb_build_object('chave', 'cod:ENSAIOR2', 'tipo', 'CODIGO', 'codigo', 'ENSAIOR2', 'colunas', '{"Nome":"Ensaio R2"}'::jsonb)));
  perform public.fechar_vaga_empregare('gh-ensaio-resp-0001', '99999502', '["Nome"]'::jsonb, 'ensaio.xlsx');

  v := public.gravar_respostas_empregare('gh-ensaio-resp-0001', '99999502', jsonb_build_array(
    jsonb_build_object('codigo', 'ENSAIOR1', 'resposta', '9900001'),
    jsonb_build_object('codigo', 'ENSAIOR2', 'resposta', '99|<script>'),
    jsonb_build_object('codigo', 'ENSAIOZZ', 'resposta', '9900003')));
  if (v ->> 'gravadas')::int <> 1 or (v ->> 'sem_candidato')::int <> 1 then
    raise exception 'FALHOU E2: gravação (%)', v;
  end if;
  perform public.finalizar_sync_empregare('gh-ensaio-resp-0001', 1, 0, null);
  begin
    perform public.gravar_respostas_empregare('gh-ensaio-resp-0001', '99999502', '[{"codigo":"ENSAIOR2","resposta":"1"}]'::jsonb);
    raise exception 'FALHOU E2: gravou com a execução fechada';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E2: identificador válido gravado, inválido e candidato de fora recusados, execução fechada recusa';
end;
$$;
reset role;

/* Para a ficha: uma ficha existente, um identificador fictício no candidato dela e pessoas sintéticas. */
do $$
declare
  v_ficha uuid;
  v_edital uuid;
  v_area text;
  v_cand uuid;
begin
  select f."CO_FICHA_ANALISE", f."CO_MONITORAMENTO", m."CO_AREA", f."CO_EMPREGARE_CANDIDATO"
    into v_ficha, v_edital, v_area, v_cand
    from public."TB_FICHA_ANALISE" f
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = f."CO_MONITORAMENTO"
    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
   order by f."DT_CRIACAO"
   limit 1;
  if v_ficha is null then raise exception 'ENSAIO: nenhuma ficha da avaliação documental para conferir'; end if;
  perform set_config('ensaio.ficha', v_ficha::text, true);
  perform set_config('ensaio.edital', v_edital::text, true);

  update public."TB_EMPREGARE_CANDIDATO" set "CO_RESPOSTA_QUESTIONARIO" = '9988776', "DT_CAPTURA_RESPOSTA" = now()
   where "CO_EMPREGARE_CANDIDATO" = v_cand;

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-0000000f8a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f8.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f8a02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f8.ana@ensaio.invalid'),
    ('00000000-0000-4000-a000-0000000f8a03', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f8.sem@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-0000000f8a01', 'ensaio.f8.gestor@ensaio.invalid', 'Ensaio F8 Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-0000000f8a02', 'ensaio.f8.ana@ensaio.invalid', 'Ensaio F8 Ana', 'usuario', true),
    ('00000000-0000-4000-a000-0000000f8a03', 'ensaio.f8.sem@ensaio.invalid', 'Ensaio F8 Sem Acesso', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u where u.email like 'ensaio.f8.%@ensaio.invalid';
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select u.id, 'avaliacao_documental', 'editor', '00000000-0000-4000-a000-0000000f8a01'
    from public."TB_PERFIL_USUARIO" u where u.email = 'ensaio.f8.ana@ensaio.invalid';
  insert into public."RL_ANALISTA_EDITAL" ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", "CO_VAGA", "CO_USUARIO_ATUALIZACAO") values
    (v_edital, '00000000-0000-4000-a000-0000000f8a02', 'ANALISTA', null, '00000000-0000-4000-a000-0000000f8a01');
end;
$$;

-- E3. A ficha, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_ana constant text := '{"sub":"00000000-0000-4000-a000-0000000f8a02","role":"authenticated","email":"ensaio.f8.ana@ensaio.invalid"}';
  c_sem constant text := '{"sub":"00000000-0000-4000-a000-0000000f8a03","role":"authenticated","email":"ensaio.f8.sem@ensaio.invalid"}';
  v_ficha uuid := current_setting('ensaio.ficha')::uuid;
  v json;
begin
  perform set_config('request.jwt.claims', c_sem, true);
  begin
    perform public.obter_ficha_analise(v_ficha);
    raise exception 'FALHOU E3: quem não vê a ficha recebeu o link das respostas';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claims', c_ana, true);
  v := public.obter_ficha_analise(v_ficha);
  if v -> 'empregare' ->> 'link_respostas' is distinct from 'https://corporate.empregare.com/empresa/questionarios/imprimir/9988776|'
     or v -> 'empregare' ->> 'resposta_questionario' is distinct from '9988776'
     or v -> 'empregare' ->> 'resposta_capturada_em' is null then
    raise exception 'FALHOU E3: link das respostas na ficha';
  end if;
  if v -> 'ficha' is null or v -> 'regra' is null or v -> 'historico' is null
     or not ((v -> 'empregare')::jsonb ? 'link_candidato') then
    raise exception 'FALHOU E3: a ficha perdeu chaves de antes';
  end if;
  v := public.obter_fila_avaliacao(current_setting('ensaio.edital')::uuid);
  if v::text ~ '9988776' or v::text ~ 'questionarios/imprimir' then
    raise exception 'FALHOU E3: a fila traz o identificador da resposta';
  end if;
  raise notice 'ok E3: analista da vaga recebe o link das respostas; sem acesso, 42501; a fila não traz o identificador';
end;
$$;
reset role;

-- E4. O que ficou gravado e a CK.
do $$
begin
  if (select max(c."CO_RESPOSTA_QUESTIONARIO") filter (where c."CO_CANDIDATO_EMPREGARE" = 'ENSAIOR1')
        from public."TB_EMPREGARE_CANDIDATO" c where c."CO_VAGA" = '99999502') is distinct from '9900001'
     or (select max(c."CO_RESPOSTA_QUESTIONARIO") filter (where c."CO_CANDIDATO_EMPREGARE" = 'ENSAIOR2')
        from public."TB_EMPREGARE_CANDIDATO" c where c."CO_VAGA" = '99999502') is not null then
    raise exception 'FALHOU E4: identificadores gravados';
  end if;
  begin
    update public."TB_EMPREGARE_CANDIDATO" set "CO_RESPOSTA_QUESTIONARIO" = '12a'
     where "CO_VAGA" = '99999502' and "CO_CANDIDATO_EMPREGARE" = 'ENSAIOR2';
    raise exception 'FALHOU E4: a CK aceitou identificador com letra';
  exception when check_violation then null;
  end;
  raise notice 'ok E4: identificador válido gravado, inválido fora; CK barra letra';
end;
$$;

select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_EMPREGARE_CANDIDATO" c
    where c."CO_VAGA" = '99999502' and c."CO_RESPOSTA_QUESTIONARIO" is not null) as candidatos_com_resposta;

rollback;
