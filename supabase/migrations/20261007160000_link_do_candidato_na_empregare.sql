/*
  ROBÔ DA EMPREGARE: O LINK DO CANDIDATO PARA A FICHA

  A ficha da avaliação documental abria só a lista de vagas da Empregare e
  copiava o código da vaga: o endereço com o código numérico dá "Sem
  permissão". As candidaturas da vaga abrem pelo identificador interno dela
  (/empresa/vagas/candidaturas/<id>|) e cada candidato tem o link da página de
  detalhes (/empresa/curriculo/detalhes?tokenCandidato=…&id=…&candidatura=…).
  O robô (scripts/robo-empregare/) passa a capturar os dois a cada execução
  (os tokens podem mudar) e grava aqui; desenho em
  docs/analises-no-monitora/README.md, seção 7.3 (fase F7 do plano).

  O QUE ENTRA
    TB_EMPREGARE_VAGA."CO_VAGA_INTERNO"         identificador interno da vaga
    TB_EMPREGARE_VAGA."DT_CAPTURA_LINK"         quando foi capturado
    TB_EMPREGARE_CANDIDATO."DS_LINK_DETALHE"    link da página de detalhes
    TB_EMPREGARE_CANDIDATO."DT_CAPTURA_LINK"    quando foi capturado
    gravar_lote_empregare    cada linha aceita "link" (opcional): grava o link
                             válido; sem link (ou inválido), mantém o anterior
    fechar_vaga_empregare    ganha p_vaga_interno (opcional, no fim): grava o
                             identificador válido; sem ele, mantém o anterior
    obter_ficha_analise      devolve "empregare": o link do candidato, o
                             identificador e o link das candidaturas da vaga

  CHAMADAS ANTIGAS
    O robô de antes (linhas sem "link", fechar com 4 argumentos nomeados)
    continua funcionando: nada muda nos links já gravados. A assinatura de
    fechar_vaga_empregare muda (drop + create), mas o argumento novo tem
    default e o PostgREST chama pelo nome.

  DADO RESTRITO
    Os links levam tokens da área logada da Empregare (só funcionam com login,
    mas são de acesso). As tabelas seguem com RLS e sem grant; só a RPC da
    ficha os devolve, a quem pode ver a ficha (private."FC_EXIGIR_VER_FICHA").
    Nunca em lista (fila, obter_candidatos_empregare), CSV ou log do robô.

  PRÉ-REQUISITO: 20261005170000 (robô) e 20261007130000 (conteúdo da ficha).

  Ensaio: supabase/ensaios/20261007160000_link_do_candidato_na_empregare.sql
  Rollback: supabase/rollback/20261007160000_link_do_candidato_na_empregare.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fechar_vaga_empregare(text, text, jsonb, text)') is null
     or to_regprocedure('public.gravar_lote_empregare(text, text, integer, jsonb)') is null then
    raise exception 'Aplique antes 20261005170000_robo_empregare.sql.';
  end if;
  if to_regprocedure('public.obter_ficha_analise(uuid)') is null
     or to_regprocedure('private."FC_EXIGIR_VER_FICHA"(public."TB_FICHA_ANALISE")') is null then
    raise exception 'Aplique antes 20261007130000_conteudo_da_ficha.sql.';
  end if;
end;
$$;

-- 1. Colunas ----------------------------------------------------------------------------
alter table public."TB_EMPREGARE_VAGA"
  add column "CO_VAGA_INTERNO" varchar(100),
  add column "DT_CAPTURA_LINK" timestamptz,
  add constraint "CK_EMPREGVAGA_COVAGAINTERNO" check (
    "CO_VAGA_INTERNO" is null
    or ("CO_VAGA_INTERNO" ~ '^[A-Za-z0-9_.~=-]{1,96}[|]{0,3}$' and "CO_VAGA_INTERNO" !~ '^[0-9]+[|]*$'));
comment on column public."TB_EMPREGARE_VAGA"."CO_VAGA_INTERNO" is 'Identificador interno da vaga na Empregare, capturado pelo robô (o trecho de /empresa/vagas/candidaturas/<id>|, com a barra vertical; ex.: Ab1cD2eF3g|). Abre as candidaturas da vaga; o código numérico não abre. Pode mudar: o robô sobrescreve.';
comment on column public."TB_EMPREGARE_VAGA"."DT_CAPTURA_LINK" is 'Quando o robô capturou o identificador interno da vaga pela última vez.';
comment on constraint "CK_EMPREGVAGA_COVAGAINTERNO" on public."TB_EMPREGARE_VAGA" is 'Identificador interno: letras, dígitos e _.~=- com até 3 barras verticais no fim; nunca só o código numérico.';

alter table public."TB_EMPREGARE_CANDIDATO"
  add column "DS_LINK_DETALHE" varchar(600),
  add column "DT_CAPTURA_LINK" timestamptz,
  add constraint "CK_EMPREGCAND_DSLINKDETALHE" check (
    "DS_LINK_DETALHE" is null
    or ("DS_LINK_DETALHE" ~ '^https://corporate\.empregare\.com/empresa/curriculo/detalhes\?[A-Za-z0-9_.~=&%|+/:-]+$'
        and length("DS_LINK_DETALHE") <= 600));
comment on column public."TB_EMPREGARE_CANDIDATO"."DS_LINK_DETALHE" is 'Link da página de detalhes do candidato na Empregare (currículo e questionário), capturado pelo robô na lista de candidaturas da vaga. DADO RESTRITO: leva tokens de acesso da área logada; só a RPC da ficha devolve, a quem pode ver a ficha. Nunca em lista, CSV ou log.';
comment on column public."TB_EMPREGARE_CANDIDATO"."DT_CAPTURA_LINK" is 'Quando o robô capturou o link de detalhes pela última vez.';
comment on constraint "CK_EMPREGCAND_DSLINKDETALHE" on public."TB_EMPREGARE_CANDIDATO" is 'Link só da página de detalhes do currículo na Empregare (https), sem espaço, aspas nem sinais de HTML.';

-- 2. Gravação pelo robô -----------------------------------------------------------------
create or replace function public.gravar_lote_empregare(p_sync text, p_vaga text, p_total integer, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_situacao text;
  v_qt integer;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if coalesce(p_total, -1) not between 1 and 50000 then
    raise exception 'Total de candidatos fora de 1 a 50000' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  v_situacao := private."FC_EMPREGARE_ABRIR_VAGA"(p_sync, p_vaga, p_total);
  if v_situacao <> 'EM_CARGA' then
    return jsonb_build_object('situacao', v_situacao, 'gravadas', 0);
  end if;

  create temporary table if not exists pg_temp.tmp_empregare_lote_link (
    chave text, tipo text, codigo text, nome text, email text, cpf text, telefone text,
    nascimento date, situacao text, candidatura timestamptz, colunas jsonb, hash text, link text
  ) on commit drop;
  truncate pg_temp.tmp_empregare_lote_link;

  insert into pg_temp.tmp_empregare_lote_link
  select distinct on (l.chave)
         l.chave, l.tipo,
         nullif(left(btrim(l.codigo), 60), ''),
         nullif(left(btrim(l.nome), 300), ''),
         nullif(left(lower(btrim(l.email)), 320), ''),
         case when l.cpf ~ '^[0-9]{11}$' then l.cpf end,
         nullif(left(btrim(l.telefone), 60), ''),
         private."FC_EMPREGARE_DATA"(l.nascimento),
         nullif(left(btrim(l.situacao), 200), ''),
         private."FC_EMPREGARE_MOMENTO"(l.candidatura),
         l.colunas,
         encode(sha256(convert_to(l.colunas::text, 'UTF8')), 'hex'),
         -- Link fora do formato (outro site, javascript:, aspas) vira nulo: mantém o anterior.
         case when l.link ~ '^https://corporate\.empregare\.com/empresa/curriculo/detalhes\?[A-Za-z0-9_.~=&%|+/:-]+$'
                   and length(l.link) <= 600
              then l.link end
    from jsonb_to_recordset(p_linhas) as l(
      chave text, tipo text, codigo text, nome text, email text, cpf text, telefone text,
      nascimento text, situacao text, candidatura text, colunas jsonb, link text)
   where l.chave ~ '^(cod:[A-Za-z0-9._-]{1,60}|cpf:[0-9a-f]{64}|email:[0-9a-f]{64})$'
     and l.tipo in ('CODIGO', 'CPF', 'EMAIL')
     and jsonb_typeof(l.colunas) = 'object'
   order by l.chave;

  insert into public."TB_EMPREGARE_CANDIDATO" as c (
    "CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE", "NO_CANDIDATO", "DS_EMAIL",
    "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA", "CO_SYNC", "ST_REGISTRO_ATIVO", "DS_LINK_DETALHE", "DT_CAPTURA_LINK")
  select p_vaga, t.chave, t.tipo, t.codigo, t.nome, t.email, t.cpf, t.telefone, t.nascimento,
         t.situacao, t.candidatura, t.colunas, t.hash, p_sync, 'S', t.link,
         case when t.link is not null then now() end
    from pg_temp.tmp_empregare_lote_link t
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do update set
    "TP_CHAVE" = excluded."TP_CHAVE",
    "CO_CANDIDATO_EMPREGARE" = excluded."CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO" = excluded."NO_CANDIDATO",
    "DS_EMAIL" = excluded."DS_EMAIL",
    "NU_CPF" = excluded."NU_CPF",
    "NU_TELEFONE" = excluded."NU_TELEFONE",
    "DT_NASCIMENTO" = excluded."DT_NASCIMENTO",
    "DS_SITUACAO_EMPREGARE" = excluded."DS_SITUACAO_EMPREGARE",
    "DT_CANDIDATURA" = excluded."DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL" = excluded."DS_COLUNA_ORIGINAL",
    "DS_HASH_LINHA" = excluded."DS_HASH_LINHA",
    "CO_SYNC" = excluded."CO_SYNC",
    "DT_ATUALIZACAO" = case
      when c."DS_HASH_LINHA" is distinct from excluded."DS_HASH_LINHA" or c."ST_REGISTRO_ATIVO" = 'N' then now()
      else c."DT_ATUALIZACAO" end,
    "DT_CONFERENCIA" = now(),
    "ST_REGISTRO_ATIVO" = 'S',
    "DT_DESATIVACAO" = null,
    "DS_LINK_DETALHE" = coalesce(excluded."DS_LINK_DETALHE", c."DS_LINK_DETALHE"),
    "DT_CAPTURA_LINK" = coalesce(excluded."DT_CAPTURA_LINK", c."DT_CAPTURA_LINK");

  select count(*) into v_qt from pg_temp.tmp_empregare_lote_link;
  update public."TB_EMPREGARE_VAGA" set "QT_RECEBIDA" = "QT_RECEBIDA" + v_qt, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  update public."TL_SYNC_EMPREGARE" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('situacao', 'EM_CARGA', 'recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt,
                            'com_link', (select count(*) from pg_temp.tmp_empregare_lote_link t where t.link is not null));
end;
$function$;
comment on function public.gravar_lote_empregare(text, text, integer, jsonb) is
  'Recebe um lote (até 1000) de candidatos de uma vaga e faz upsert em TB_EMPREGARE_CANDIDATO pela chave natural (o hash da linha diz se mudou). Cada linha aceita "link" (opcional): o link da página de detalhes do candidato na Empregare, gravado em DS_LINK_DETALHE quando válido; sem link, fica o anterior. p_total = candidatos do arquivo inteiro: no primeiro lote da vaga, a trava recusa (RECUSADA, nada gravado) o arquivo com menos da metade dos ativos sem forçar. Fechar com fechar_vaga_empregare. Só service_role.';

drop function public.fechar_vaga_empregare(text, text, jsonb, text);
create function public.fechar_vaga_empregare(p_sync text, p_vaga text, p_colunas jsonb, p_arquivo text default null,
                                             p_vaga_interno text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_situacao text;
  v_desativadas integer;
  v_ativos integer;
  v_recebidas integer;
  -- Identificador fora do formato (ou só o código numérico) é ignorado: fica o anterior.
  v_interno text := case
    when btrim(p_vaga_interno) ~ '^[A-Za-z0-9_.~=-]{1,96}[|]{0,3}$' and btrim(p_vaga_interno) !~ '^[0-9]+[|]*$'
    then btrim(p_vaga_interno) end;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_colunas) is distinct from 'array' or jsonb_array_length(p_colunas) > 2000 then
    raise exception 'Colunas em lista de até 2000 nomes' using errcode = '22023';
  end if;

  -- Arquivo sem nenhum candidato não passou por gravar_lote: a trava vale aqui.
  v_situacao := private."FC_EMPREGARE_ABRIR_VAGA"(p_sync, p_vaga, 0);

  -- O identificador da vaga não é dado de candidato: grava mesmo se a trava recusar o arquivo.
  if v_interno is not null then
    update public."TB_EMPREGARE_VAGA" set "CO_VAGA_INTERNO" = v_interno, "DT_CAPTURA_LINK" = now()
     where "CO_VAGA" = p_vaga;
  end if;

  if v_situacao = 'RECUSADA' then
    return jsonb_build_object('situacao', 'RECUSADA',
      'mensagem', (select v."DS_MENSAGEM" from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga));
  end if;
  if v_situacao <> 'EM_CARGA' then
    raise exception 'Vaga % já fechada nesta execução', p_vaga using errcode = '22023';
  end if;

  update public."TB_EMPREGARE_CANDIDATO" c set
    "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now(), "DT_ATUALIZACAO" = now()
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S' and c."CO_SYNC" is distinct from p_sync;
  get diagnostics v_desativadas = row_count;

  select count(*) into v_ativos
    from public."TB_EMPREGARE_CANDIDATO" c
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S';

  update public."TB_EMPREGARE_VAGA" set
    "TP_SITUACAO" = 'GRAVADA', "DS_COLUNA" = p_colunas, "NO_ARQUIVO" = left(p_arquivo, 300),
    "QT_CANDIDATO_ATIVO" = v_ativos, "DS_MENSAGEM" = null, "DT_ULTIMA_CARGA" = now(), "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga
  returning "QT_RECEBIDA" into v_recebidas;

  update public."TL_SYNC_EMPREGARE" set "QT_DESATIVADA" = "QT_DESATIVADA" + v_desativadas where "CO_SYNC" = p_sync;
  return jsonb_build_object('situacao', 'GRAVADA', 'recebidas', v_recebidas, 'ativos', v_ativos, 'desativadas', v_desativadas,
                            'vaga_interno', v_interno is not null);
end;
$function$;
comment on function public.fechar_vaga_empregare(text, text, jsonb, text, text) is
  'Fecha a vaga na execução: desativa (ST_REGISTRO_ATIVO = N) quem não veio no arquivo e grava colunas, arquivo e ativos em TB_EMPREGARE_VAGA. Vaga recusada pela trava não muda. Arquivo sem candidatos passa pela trava aqui. p_vaga_interno (opcional): o identificador interno da vaga na Empregare, gravado em CO_VAGA_INTERNO quando válido (mesmo com a trava). Só service_role.';
revoke all on function public.fechar_vaga_empregare(text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.fechar_vaga_empregare(text, text, jsonb, text, text) to service_role;

-- 3. A ficha devolve os links -------------------------------------------------------------
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
    -- Links da Empregare (dado restrito, só aqui): o do candidato e o das candidaturas da vaga.
    'empregare', (select json_build_object(
                           'link_candidato', c."DS_LINK_DETALHE",
                           'capturado_em', c."DT_CAPTURA_LINK",
                           'vaga_interno', ev."CO_VAGA_INTERNO",
                           'link_vaga', case when ev."CO_VAGA_INTERNO" is not null
                                             then 'https://corporate.empregare.com/empresa/vagas/candidaturas/' || ev."CO_VAGA_INTERNO" end)
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
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, os links da Empregare capturados pelo robô (empregare: link_candidato da página de detalhes, vaga_interno e link_vaga das candidaturas; dado restrito, só aqui), o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;

commit;
