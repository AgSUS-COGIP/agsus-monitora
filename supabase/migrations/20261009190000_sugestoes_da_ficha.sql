/*
  SUGESTÕES DA FICHA: AS LINHAS QUE AS RESPOSTAS DO CANDIDATO JÁ DÃO (09/10/2026)

  Na ficha da avaliação documental, o avaliador registra os títulos, cursos e
  vínculos que o documento comprova. Para a ficha vir pronta para conferir,
  o job da pré-classificação (Python, scripts/pre_classificacao/ com
  python/monitora/avaliacao_documental/sugestoes_da_ficha.py) lê as respostas
  do questionário das perguntas que a regra liga a cada bloco e tira delas o
  que dá para interpretar (curso com carga horária, vínculo com início e fim,
  título acadêmico). Grava aqui por candidato; a ficha devolve e a tela só
  exibe, com a linha marcada "da resposta do candidato". A nota continua a do
  banco (FC_PENDENCIAS_FICHA / concluir_ficha); nada aqui pontua.

  O QUE ENTRA
    TB_SUGESTAO_FICHA            uma linha por edital × candidato: {"<BLOCO>": [itens]}
    gravar_sugestoes_da_ficha    o job grava as sugestões de uma vaga (só service_role,
                                 com a execução da pré-classificação em andamento);
                                 troca as da vaga inteira e limpa cada item
    obter_ficha_analise          ganha "sugestoes" (o resto igual a 20261008160000)

  DADO
    Derivado das respostas do questionário que a ficha já mostra (só as
    perguntas que a regra liga). RLS sem grant; só a RPC da ficha devolve, a
    quem pode ver a ficha.

  PRÉ-REQUISITO: 20261008160000_anexos_do_questionario_na_empregare.sql.

  Ensaio: supabase/ensaios/20261009190000_sugestoes_da_ficha.sql
  Rollback: supabase/rollback/20261009190000_sugestoes_da_ficha.sql
*/
begin;

set local lock_timeout = '10s';

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_EMPREGARE_ANEXO"') is null
     or to_regprocedure('private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(text)') is null then
    raise exception 'Aplique antes 20261008160000_anexos_do_questionario_na_empregare.sql.';
  end if;
end;
$$;

-- 1. Tabela -----------------------------------------------------------------------------
create table public."TB_SUGESTAO_FICHA" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "DS_SUGESTAO" jsonb not null,
  "CO_EXECUCAO" text,
  "DT_CALCULO" timestamptz not null default now(),
  constraint "PK_TB_SUGESTAO_FICHA" primary key ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "FK_MONITORAMENTO_SUGFICHA" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "FK_EMPREGARECAND_SUGFICHA" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO") on delete cascade,
  constraint "FK_TLPRECLASSIF_SUGFICHA" foreign key ("CO_EXECUCAO")
    references public."TL_PRE_CLASSIFICACAO" ("CO_EXECUCAO") on delete set null,
  constraint "CK_SUGFICHA_DSSUGESTAO" check (jsonb_typeof("DS_SUGESTAO") = 'object')
);
comment on table public."TB_SUGESTAO_FICHA" is 'Sugestões da ficha da avaliação documental: as linhas de título, curso e vínculo que as respostas do questionário de um inscrito já dão, calculadas pelo job Python da pré-classificação (sugestoes_da_ficha.py). A tela só exibe; nada aqui pontua. Só a RPC da ficha devolve.';
comment on column public."TB_SUGESTAO_FICHA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA).';
comment on column public."TB_SUGESTAO_FICHA"."CO_EMPREGARE_CANDIDATO" is 'Inscrito da vaga (TB_EMPREGARE_CANDIDATO).';
comment on column public."TB_SUGESTAO_FICHA"."DS_SUGESTAO" is 'Objeto {"<CODIGO_DO_BLOCO>": [itens]} no formato do lançamento da ficha (titulos: titulo; cursos: nome, horas; vinculos: empregador, categoria, inicio, fim), cada item com aceito e da_resposta = true.';
comment on column public."TB_SUGESTAO_FICHA"."CO_EXECUCAO" is 'Execução da pré-classificação que calculou (TL_PRE_CLASSIFICACAO).';
comment on column public."TB_SUGESTAO_FICHA"."DT_CALCULO" is 'Quando o job calculou.';
comment on constraint "CK_SUGFICHA_DSSUGESTAO" on public."TB_SUGESTAO_FICHA" is 'Sugestões num objeto json por bloco.';
create index "IN_FKSUGFICHA_COEMPREGARECAND" on public."TB_SUGESTAO_FICHA" ("CO_EMPREGARE_CANDIDATO");
create index "IN_FKSUGFICHA_COEXECUCAO" on public."TB_SUGESTAO_FICHA" ("CO_EXECUCAO");

alter table public."TB_SUGESTAO_FICHA" enable row level security;
revoke all on public."TB_SUGESTAO_FICHA" from public, anon, authenticated;

-- 2. Limpeza de um item sugerido --------------------------------------------------------
create function private."FC_ITEM_SUGERIDO"(p_chave text, p_item jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $function$
  -- Só os campos do lançamento, nos formatos que FC_VALIDAR_LANCAMENTO_FICHA aceita;
  -- item sem o que conta (título, horas ou início e fim) fica de fora (null).
  select case
    when jsonb_typeof(p_item) <> 'object' then null
    when p_chave = 'titulos' and p_item ->> 'titulo' in
         ('ENSINO_MEDIO', 'TECNICO', 'GRADUACAO', 'ESPECIALIZACAO', 'RESIDENCIA', 'MESTRADO', 'DOUTORADO') then
      jsonb_build_object('titulo', p_item ->> 'titulo', 'nome', left(coalesce(p_item ->> 'nome', ''), 200),
                         'aceito', true, 'da_resposta', true)
    when p_chave = 'cursos' and jsonb_typeof(p_item -> 'horas') = 'number'
         and (p_item ->> 'horas')::numeric > 0 and (p_item ->> 'horas')::numeric <= 20000 then
      jsonb_build_object('nome', left(coalesce(p_item ->> 'nome', ''), 200),
                         'horas', round((p_item ->> 'horas')::numeric), 'aceito', true, 'da_resposta', true)
    when p_chave = 'vinculos' and coalesce(p_item ->> 'inicio', '') ~ '^\d{4}-\d{2}-\d{2}$'
         and coalesce(p_item ->> 'fim', '') ~ '^\d{4}-\d{2}-\d{2}$'
         and p_item ->> 'fim' >= p_item ->> 'inicio' then
      jsonb_strip_nulls(jsonb_build_object(
        'empregador', left(coalesce(p_item ->> 'empregador', ''), 200),
        'categoria', case when p_item ->> 'categoria' ~ '^[A-Z][A-Z0-9_]{1,29}$' then p_item ->> 'categoria' end,
        'inicio', p_item ->> 'inicio', 'fim', p_item ->> 'fim', 'aceito', true, 'da_resposta', true))
  end;
$function$;
comment on function private."FC_ITEM_SUGERIDO"(text, jsonb) is
  'Um item sugerido para a ficha, limpo: só os campos do lançamento (titulos: titulo, nome; cursos: nome, horas de 1 a 20.000; vinculos: empregador, categoria, início e fim em aaaa-mm-dd com fim >= início), com aceito e da_resposta = true; sem o que conta, null.';
revoke all on function private."FC_ITEM_SUGERIDO"(text, jsonb) from public, anon, authenticated;

-- 3. Gravação pelo job ------------------------------------------------------------------
create function public.gravar_sugestoes_da_ficha(p_execucao text, p_edital uuid, p_vaga text, p_sugestoes jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_regra jsonb;
  v_s jsonb;
  v_blocos jsonb;
  v_candidatos integer := 0;
  v_fora integer := 0;
begin
  perform private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$'
     or not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  if jsonb_typeof(p_sugestoes) is distinct from 'array' or jsonb_array_length(p_sugestoes) > 5000 then
    raise exception 'Envie até 5.000 sugestões por vaga' using errcode = '22023';
  end if;
  select h."DS_CONFIGURACAO" into v_regra
    from public."TB_REGRA_ANALISE" r
    join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
   where r."CO_MONITORAMENTO" = p_edital;

  -- A vaga recalculada fica só com as sugestões de agora.
  delete from public."TB_SUGESTAO_FICHA" s
   using public."TB_EMPREGARE_CANDIDATO" c
   where s."CO_MONITORAMENTO" = p_edital and c."CO_EMPREGARE_CANDIDATO" = s."CO_EMPREGARE_CANDIDATO"
     and c."CO_VAGA" = p_vaga;

  for v_s in select x from jsonb_array_elements(p_sugestoes) x loop
    if coalesce(v_s ->> 'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                       where c."CO_EMPREGARE_CANDIDATO" = (v_s ->> 'id')::uuid and c."CO_VAGA" = p_vaga) then
      v_fora := v_fora + 1;
      continue;
    end if;
    -- Só os blocos de títulos, cursos e vínculos da regra; até 20 itens limpos por bloco.
    select coalesce(jsonb_object_agg(b.codigo, b.itens), '{}'::jsonb) into v_blocos
      from (
        select e.key as codigo,
               (select jsonb_agg(i.limpo order by i.n)
                  from (select private."FC_ITEM_SUGERIDO"(
                                 case rb ->> 'tipo' when 'TITULOS' then 'titulos' when 'CURSOS' then 'cursos'
                                                    when 'VINCULOS' then 'vinculos' end, it.valor) as limpo, it.n
                          from jsonb_array_elements(e.value) with ordinality as it(valor, n)
                         where it.n <= 20) i
                 where i.limpo is not null) as itens
          from jsonb_each(case when jsonb_typeof(v_s -> 'blocos') = 'object' then v_s -> 'blocos' else '{}'::jsonb end) e
          join lateral (select x as rb from jsonb_array_elements(coalesce(v_regra -> 'blocos', '[]'::jsonb)) x
                         where x ->> 'codigo' = e.key and x ->> 'tipo' in ('TITULOS', 'CURSOS', 'VINCULOS')
                         limit 1) r on true
         where jsonb_typeof(e.value) = 'array'
      ) b
     where b.itens is not null;
    continue when v_blocos = '{}'::jsonb;
    insert into public."TB_SUGESTAO_FICHA" ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "DS_SUGESTAO", "CO_EXECUCAO", "DT_CALCULO")
    values (p_edital, (v_s ->> 'id')::uuid, v_blocos, p_execucao, now())
    on conflict ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO") do update set
      "DS_SUGESTAO" = excluded."DS_SUGESTAO", "CO_EXECUCAO" = excluded."CO_EXECUCAO", "DT_CALCULO" = excluded."DT_CALCULO";
    v_candidatos := v_candidatos + 1;
  end loop;

  return jsonb_build_object('recebidas', jsonb_array_length(p_sugestoes), 'candidatos', v_candidatos, 'fora_da_vaga', v_fora);
end;
$function$;
comment on function public.gravar_sugestoes_da_ficha(text, uuid, text, jsonb) is
  'Recebe do job da pré-classificação (Python) as sugestões da ficha de uma vaga: [{id, blocos: {"<BLOCO>": [itens]}}]. Troca as da vaga inteira em TB_SUGESTAO_FICHA; só inscritos da vaga, só blocos de títulos, cursos e vínculos da regra do edital, até 20 itens limpos por bloco (FC_ITEM_SUGERIDO). Só service_role, com a execução da pré-classificação em andamento.';
revoke all on function public.gravar_sugestoes_da_ficha(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_sugestoes_da_ficha(text, uuid, text, jsonb) to service_role;

-- 4. A ficha devolve as sugestões -------------------------------------------------------
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
    -- As linhas que as respostas do candidato já dão (job Python, 20261009190000): a tela só exibe.
    'sugestoes', coalesce((select s."DS_SUGESTAO" from public."TB_SUGESTAO_FICHA" s
                            where s."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO"
                              and s."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO"), '{}'::jsonb),
    -- Links da Empregare (dado restrito, só aqui): o do candidato, o das candidaturas, os das respostas e dos anexos.
    'empregare', (select json_build_object(
                           'link_candidato', c."DS_LINK_DETALHE",
                           'capturado_em', c."DT_CAPTURA_LINK",
                           'vaga_interno', ev."CO_VAGA_INTERNO",
                           'link_vaga', case when ev."CO_VAGA_INTERNO" is not null
                                             then 'https://corporate.empregare.com/empresa/vagas/candidaturas/' || ev."CO_VAGA_INTERNO" end,
                           'respostas', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'link_impressao', r."DS_LINK_IMPRESSAO",
                                                               'perguntas', r."QT_PERGUNTA", 'anexos', r."QT_ANEXO",
                                                               'capturado_em', r."DT_CAPTURA")
                                             order by r."CO_RESPOSTA_QUESTIONARIO")
                               from public."TB_EMPREGARE_RESPOSTA" r
                              where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"), '[]'::json),
                           'anexos', coalesce((
                             select json_agg(json_build_object('resposta', r."CO_RESPOSTA_QUESTIONARIO",
                                                               'pergunta', a."CO_PERGUNTA_EMPREGARE",
                                                               'arquivo', a."NU_ARQUIVO", 'ordem', a."NU_ORDEM",
                                                               'enunciado', a."DS_ENUNCIADO",
                                                               'coluna', a."DS_COLUNA", 'tipo', a."TP_LINK",
                                                               'link', a."DS_LINK")
                                             order by r."CO_RESPOSTA_QUESTIONARIO", a."CO_PERGUNTA_EMPREGARE", a."NU_ARQUIVO")
                               from public."TB_EMPREGARE_ANEXO" a
                               join public."TB_EMPREGARE_RESPOSTA" r on r."CO_EMPREGARE_RESPOSTA" = a."CO_EMPREGARE_RESPOSTA"
                              where r."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"), '[]'::json))
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
  'A ficha para analisar (json): o cabeçalho (sem CPF nem contato), o lançamento e o resultado gravados, a regra com que é analisada (a vigente; a da conclusão, se concluída — AM-2.3), a nota mínima e os níveis da regra de classificação, a nota declarada e a ART da pré-classificação, as respostas da Empregare SÓ das perguntas que a regra liga, os links da Empregare capturados pelo robô (empregare: link_candidato da página de detalhes, vaga_interno e link_vaga das candidaturas, respostas [{resposta, link_impressao, perguntas, anexos, capturado_em}] e anexos [{resposta, pergunta, arquivo, ordem, enunciado, coluna, tipo, link}] do questionário; dado restrito, só aqui), as sugestões de títulos, cursos e vínculos tiradas das respostas pelo job Python (20261009190000), o histórico (até 200, com as alterações) e se quem chama pode editar (reserva vigente, em análise) ou reabrir (coordenação, concluída). Vê: coordenação e revisão; o analista, só nas vagas dele; o leitor, só concluída.';
revoke all on function public.obter_ficha_analise(uuid) from public, anon;
grant execute on function public.obter_ficha_analise(uuid) to authenticated;

commit;
