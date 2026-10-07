/*
  AVALIAÇÃO DOCUMENTAL: INCLUSÃO NO LOTE POR DECISÃO DA COORDENAÇÃO

  Pedido do usuário (07/10/2026): no 93/2026, seis candidatos do cargo 5 (vaga
  180258) que a regra deixa fora do lote (três por questionário não finalizado,
  três abaixo de 15 pontos) devem ser analisados por decisão da coordenação,
  com a marcação "Critério CORES".

    1. TP_ENTRADA_LOTE ganha DECISAO (CK_PRECLASSIF_ENTRADA): o candidato está
       no lote por decisão da coordenação, com o motivo em DS_MOTIVO_ENTRADA;
    2. TB_DECISAO_LOTE: a decisão (motivo obrigatório, quem decidiu e quando, o
       retrato do candidato pela regra no momento da decisão) e a revogação
       (exclusão lógica, com motivo, quem e quando); TH_DECISAO_LOTE é o
       histórico imutável (INCLUIR, REVOGAR);
    3. incluir_no_lote_por_decisao(p_edital, p_codigos, p_motivo, p_vaga):
       grava a decisão e põe o candidato no lote na hora (NO_LOTE, entrada
       DECISAO, no último lote da vaga; o eliminado ganha posição depois do
       último da Provisória); a ficha abre normalmente (FC_ABRIR_FICHAS);
    4. revogar_decisao_lote(p_edital, p_codigos, p_motivo, p_vaga): desativa a
       decisão (nada se apaga) e devolve o candidato à situação da regra
       (eliminado com o motivo de antes ou ranqueado); a ficha não concluída
       fica FORA_LOTE; com ficha concluída (ou ANALISADO), recusa;
    5. o recálculo respeita as decisões: pre_classificacao_ler_candidatos
       devolve as decisões ativas da vaga; o job (python/monitora/
       avaliacao_documental/pre_classificacao.py, a mesma conta de
       src/lib/avaliacao-documental/pre-classificacao.js) mantém no lote, com a
       marca, quem a regra elimina ou deixa abaixo do corte, sem contar para o
       tamanho do lote pela regra; gravar_pre_classificacao_vaga aceita a
       entrada DECISAO, confere que cada decisão ativa foi aplicada e que só
       entra por decisão quem tem decisão ativa (com o mesmo motivo), deixa sair
       do lote quem entrou por decisão revogada e calcula a linha de corte só
       com os da regra (o resto igual a 20261007180000);
    6. FC_TG_LOTE_COM_FICHA deixa tirar do lote quem entrou por decisão
       revogada (a ficha aberta vai para FORA_LOTE); o resto igual;
    7. obter_pre_classificacao devolve a decisão de cada inscrito (motivo, quem,
       quando) e, por vaga, quantos estão no lote pela regra e por decisão;
       obter_fila_avaliacao devolve a entrada e o motivo da decisão;
    8. registrar_lista_pre_classificacao: no retrato da Lista Provisória e do
       Lote, quem entrou por decisão leva o motivo ("decisao"); o documento
       oficial (src/lib/classificacao/documento-sei.js) marca o nome e põe a
       nota "Incluído por decisão da coordenação: Critério CORES." (o resto
       igual a 20261006110000).
  Só a coordenação da avaliação do edital (gestor do edital, coordenador da
  equipe ou administrador global: FC_EXIGIR_COORD_AVALIACAO) decide ou revoga.

  PRÉ-REQUISITO: 20261007180000 aplicada.
  Ensaio: supabase/ensaios/20261007200000_inclusao_no_lote_por_decisao.sql
  Rollback: supabase/rollback/20261007200000_inclusao_no_lote_por_decisao.sql
*/
begin;

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.descongelar_declarada_pre_classificacao(uuid,text,text)') is null then
    raise exception 'Aplique 20261007180000_lote_pela_declarada.sql antes.';
  end if;
  if to_regprocedure('private."FC_ABRIR_FICHAS"(uuid,jsonb,uuid)') is null then
    raise exception 'Aplique 20261006120000_fichas_fila_e_reserva.sql antes.';
  end if;
end;
$$;

-- 1. A entrada por decisão da coordenação ------------------------------------------------
alter table public."TB_PRE_CLASSIFICACAO" drop constraint "CK_PRECLASSIF_ENTRADA";
alter table public."TB_PRE_CLASSIFICACAO"
  add constraint "CK_PRECLASSIF_ENTRADA" check ("TP_ENTRADA_LOTE" is null or "TP_ENTRADA_LOTE" in ('INICIAL', 'REPOSICAO', 'AMPLIACAO', 'DECISAO'));
comment on constraint "CK_PRECLASSIF_ENTRADA" on public."TB_PRE_CLASSIFICACAO" is 'Entradas válidas (DECISAO desde 20261007200000).';
comment on column public."TB_PRE_CLASSIFICACAO"."TP_ENTRADA_LOTE" is
  'INICIAL, REPOSICAO (no lugar de quem saiu), AMPLIACAO (o lote cresceu) ou DECISAO (por decisão da coordenação, TB_DECISAO_LOTE; não conta para o tamanho do lote pela regra).';
comment on column public."TB_PRE_CLASSIFICACAO"."DS_MOTIVO_ENTRADA" is
  'Motivo da entrada no lote (com DECISAO, o motivo da decisão da coordenação, ex.: "Critério CORES").';

-- 2. As decisões da coordenação -------------------------------------------------------------
create table public."TB_DECISAO_LOTE" (
  "CO_DECISAO_LOTE" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "CO_VAGA" varchar(20) not null,
  "DS_MOTIVO" varchar(250) not null,
  "CO_USUARIO_DECISAO" uuid not null,
  "DT_DECISAO" timestamptz not null default now(),
  "TP_SITUACAO_REGRA" varchar(12) not null,
  "CO_MOTIVO_ELIMINACAO_REGRA" varchar(30),
  "DS_MOTIVO_ELIMINACAO_REGRA" varchar(200),
  "ST_ATIVO" varchar(1) not null default 'S',
  "DS_MOTIVO_REVOGACAO" varchar(250),
  "CO_USUARIO_REVOGACAO" uuid,
  "DT_REVOGACAO" timestamptz,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_DECISAO_LOTE" primary key ("CO_DECISAO_LOTE"),
  constraint "FK_PRECLASSIF_DECISAOLOTE" foreign key ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO")
    references public."TB_PRE_CLASSIFICACAO" ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "CK_DECISAOLOTE_MOTIVO" check (length(btrim("DS_MOTIVO")) between 5 and 250),
  constraint "CK_DECISAOLOTE_SITREGRA" check (
    "TP_SITUACAO_REGRA" in ('ELIMINADO', 'RANQUEADO')
    and ("TP_SITUACAO_REGRA" = 'ELIMINADO') = ("CO_MOTIVO_ELIMINACAO_REGRA" is not null)
    and ("CO_MOTIVO_ELIMINACAO_REGRA" is null) = ("DS_MOTIVO_ELIMINACAO_REGRA" is null)),
  constraint "CK_DECISAOLOTE_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_DECISAOLOTE_REVOGACAO" check (
    case when "ST_ATIVO" = 'S'
         then "DS_MOTIVO_REVOGACAO" is null and "CO_USUARIO_REVOGACAO" is null and "DT_REVOGACAO" is null
         else length(btrim(coalesce("DS_MOTIVO_REVOGACAO", ''))) between 10 and 250
              and "CO_USUARIO_REVOGACAO" is not null and "DT_REVOGACAO" is not null end)
);
create unique index "UK_DECISAOLOTE_ATIVA" on public."TB_DECISAO_LOTE" ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO")
  where "ST_ATIVO" = 'S';
create index "IN_DECISAOLOTE_VAGA" on public."TB_DECISAO_LOTE" ("CO_MONITORAMENTO", "CO_VAGA", "ST_ATIVO");
comment on table public."TB_DECISAO_LOTE" is
  'Inclusões no lote de convocação por decisão da coordenação da avaliação documental (ex.: "Critério CORES"): o candidato fica no lote (TP_ENTRADA_LOTE DECISAO) mesmo que a regra o elimine ou o deixe abaixo do corte, em todo recálculo, até a revogação. Revogar é exclusão lógica (ST_ATIVO N, com motivo); nada se apaga. Histórico em TH_DECISAO_LOTE.';
comment on column public."TB_DECISAO_LOTE"."CO_DECISAO_LOTE" is 'Identificador da decisão.';
comment on column public."TB_DECISAO_LOTE"."CO_MONITORAMENTO" is 'Edital.';
comment on column public."TB_DECISAO_LOTE"."CO_EMPREGARE_CANDIDATO" is 'Inscrito (TB_EMPREGARE_CANDIDATO) incluído no lote.';
comment on column public."TB_DECISAO_LOTE"."CO_VAGA" is 'Vaga da Empregare do inscrito.';
comment on column public."TB_DECISAO_LOTE"."DS_MOTIVO" is 'Motivo da decisão (5 a 250 caracteres; ex.: "Critério CORES"); vai para DS_MOTIVO_ENTRADA e para os documentos oficiais.';
comment on column public."TB_DECISAO_LOTE"."CO_USUARIO_DECISAO" is 'Quem decidiu (auth.users.id).';
comment on column public."TB_DECISAO_LOTE"."DT_DECISAO" is 'Quando decidiu.';
comment on column public."TB_DECISAO_LOTE"."TP_SITUACAO_REGRA" is 'Situação do inscrito pela regra quando a decisão foi tomada (ELIMINADO ou RANQUEADO); a revogação o devolve a ela.';
comment on column public."TB_DECISAO_LOTE"."CO_MOTIVO_ELIMINACAO_REGRA" is 'Código da eliminação pela regra quando a decisão foi tomada (só ELIMINADO).';
comment on column public."TB_DECISAO_LOTE"."DS_MOTIVO_ELIMINACAO_REGRA" is 'Texto da eliminação pela regra quando a decisão foi tomada (só ELIMINADO).';
comment on column public."TB_DECISAO_LOTE"."ST_ATIVO" is 'S = decisão vigente; N = revogada (exclusão lógica).';
comment on column public."TB_DECISAO_LOTE"."DS_MOTIVO_REVOGACAO" is 'Motivo da revogação (10 a 250 caracteres).';
comment on column public."TB_DECISAO_LOTE"."CO_USUARIO_REVOGACAO" is 'Quem revogou (auth.users.id).';
comment on column public."TB_DECISAO_LOTE"."DT_REVOGACAO" is 'Quando revogou.';
comment on column public."TB_DECISAO_LOTE"."DT_CRIACAO" is 'Criação do registro.';
comment on column public."TB_DECISAO_LOTE"."DT_ATUALIZACAO" is 'Última alteração do registro.';
comment on constraint "PK_TB_DECISAO_LOTE" on public."TB_DECISAO_LOTE" is 'Identificador da decisão.';
comment on constraint "FK_PRECLASSIF_DECISAOLOTE" on public."TB_DECISAO_LOTE" is 'Inscrito da pré-classificação do edital.';
comment on constraint "CK_DECISAOLOTE_MOTIVO" on public."TB_DECISAO_LOTE" is 'Motivo obrigatório, de 5 a 250 caracteres.';
comment on constraint "CK_DECISAOLOTE_SITREGRA" on public."TB_DECISAO_LOTE" is 'Situação pela regra: ELIMINADO (com código e texto do motivo) ou RANQUEADO (sem).';
comment on constraint "CK_DECISAOLOTE_STATIVO" on public."TB_DECISAO_LOTE" is 'Flag S/N.';
comment on constraint "CK_DECISAOLOTE_REVOGACAO" on public."TB_DECISAO_LOTE" is 'Revogada tem motivo (10 a 250), quem e quando; a vigente, nada disso.';
comment on index public."UK_DECISAOLOTE_ATIVA" is 'Uma decisão vigente por inscrito do edital.';
comment on index public."IN_DECISAOLOTE_VAGA" is 'Decisões de uma vaga (leitura do job e da tela).';

create table public."TH_DECISAO_LOTE" (
  "CO_HISTORICO" uuid not null default gen_random_uuid(),
  "CO_DECISAO_LOTE" uuid not null,
  "TP_ACAO" varchar(10) not null,
  "DS_MOTIVO" varchar(250) not null,
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_DECISAO_LOTE" primary key ("CO_HISTORICO"),
  constraint "FK_DECISAOLOTE_THDECISAOLOTE" foreign key ("CO_DECISAO_LOTE") references public."TB_DECISAO_LOTE" ("CO_DECISAO_LOTE"),
  constraint "CK_THDECISAOLOTE_ACAO" check ("TP_ACAO" in ('INCLUIR', 'REVOGAR'))
);
create index "IN_FKTHDECISAOLOTE_DECISAO" on public."TH_DECISAO_LOTE" ("CO_DECISAO_LOTE", "DT_REGISTRO");
comment on table public."TH_DECISAO_LOTE" is 'Histórico imutável das decisões de lote da coordenação: cada inclusão e cada revogação, com o motivo, quem e quando.';
comment on column public."TH_DECISAO_LOTE"."CO_HISTORICO" is 'Identificador do registro.';
comment on column public."TH_DECISAO_LOTE"."CO_DECISAO_LOTE" is 'Decisão.';
comment on column public."TH_DECISAO_LOTE"."TP_ACAO" is 'INCLUIR ou REVOGAR.';
comment on column public."TH_DECISAO_LOTE"."DS_MOTIVO" is 'Motivo informado.';
comment on column public."TH_DECISAO_LOTE"."CO_USUARIO" is 'Quem (auth.users.id).';
comment on column public."TH_DECISAO_LOTE"."DT_REGISTRO" is 'Quando.';
comment on constraint "PK_TH_DECISAO_LOTE" on public."TH_DECISAO_LOTE" is 'Identificador do registro.';
comment on constraint "FK_DECISAOLOTE_THDECISAOLOTE" on public."TH_DECISAO_LOTE" is 'Decisão.';
comment on constraint "CK_THDECISAOLOTE_ACAO" on public."TH_DECISAO_LOTE" is 'Ações válidas.';
comment on index public."IN_FKTHDECISAOLOTE_DECISAO" is 'Histórico de uma decisão na ordem.';

create trigger "TG_DECISAOLOTE_SEMAPAGAR" before delete on public."TB_DECISAO_LOTE"
  for each row execute function private."FC_TG_PRE_CLASSIF_IMUTAVEL"();
create trigger "TG_THDECISAOLOTE_IMUTAVEL" before update or delete on public."TH_DECISAO_LOTE"
  for each row execute function private."FC_TG_PRE_CLASSIF_IMUTAVEL"();
comment on trigger "TG_DECISAOLOTE_SEMAPAGAR" on public."TB_DECISAO_LOTE" is 'Sem hard delete: revogar é exclusão lógica (FC_TG_PRE_CLASSIF_IMUTAVEL).';
comment on trigger "TG_THDECISAOLOTE_IMUTAVEL" on public."TH_DECISAO_LOTE" is 'Histórico imutável (FC_TG_PRE_CLASSIF_IMUTAVEL).';

alter table public."TB_DECISAO_LOTE" enable row level security;
alter table public."TH_DECISAO_LOTE" enable row level security;
revoke all on public."TB_DECISAO_LOTE", public."TH_DECISAO_LOTE" from public, anon, authenticated;

-- 3. Quem entrou por decisão revogada pode sair do lote com ficha aberta ----------------------
create or replace function private."FC_TG_LOTE_COM_FICHA"()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and new."TP_SITUACAO" = 'RANQUEADO'
     and not (old."TP_ENTRADA_LOTE" = 'DECISAO'
              and not exists (select 1 from public."TB_DECISAO_LOTE" d
                               where d."CO_MONITORAMENTO" = new."CO_MONITORAMENTO"
                                 and d."CO_EMPREGARE_CANDIDATO" = new."CO_EMPREGARE_CANDIDATO"
                                 and d."ST_ATIVO" = 'S'))
     and exists (select 1 from public."TB_FICHA_ANALISE" f
                  where f."CO_MONITORAMENTO" = new."CO_MONITORAMENTO"
                    and f."CO_EMPREGARE_CANDIDATO" = new."CO_EMPREGARE_CANDIDATO"
                    and f."TP_SITUACAO" <> 'FORA_LOTE') then
    raise exception 'Resultado da vaga % recusado: quem tem ficha aberta não sai do lote por recálculo (refazer o lote só antes das fichas)', new."CO_VAGA"
      using errcode = '22023';
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_LOTE_COM_FICHA"() is 'Gatilho de TB_PRE_CLASSIFICACAO: recusa tirar do lote (NO_LOTE → RANQUEADO, o "refazer o lote") quem já tem ficha aberta; sair eliminado continua valendo e, desde 20261007200000, quem entrou por decisão da coordenação já revogada também sai.';
revoke all on function private."FC_TG_LOTE_COM_FICHA"() from public, anon, authenticated;

-- 4. Leitura do job: as decisões ativas da vaga ---------------------------------------------
create or replace function public.pre_classificacao_ler_candidatos(p_edital uuid, p_vaga text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  return jsonb_build_object(
    'candidatos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c."CO_EMPREGARE_CANDIDATO",
               'codigo', coalesce(c."CO_CANDIDATO_EMPREGARE", left(c."DS_CHAVE_CANDIDATO", 12)),
               'ativo', c."ST_REGISTRO_ATIVO" = 'S',
               'nascimento', c."DT_NASCIMENTO",
               'candidatura', to_char(c."DT_CANDIDATURA" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"+00:00"'),
               -- As respostas do questionário e as colunas do processo, sem as do cadastro.
               'colunas', coalesce((
                 select jsonb_object_agg(k.key, k.value)
                   from jsonb_each(c."DS_COLUNA_ORIGINAL") k
                  where lower(k.key) like 'pergunta %'
                     or lower(k.key) !~ '(nome|e-?mail|cpf|telefone|celular|whatsapp|endere|logradouro|bairro|cep|nascimento|linkedin|^rg$|documento)'),
                 '{}'::jsonb))
             order by c."CO_EMPREGARE_CANDIDATO")
        from public."TB_EMPREGARE_CANDIDATO" c
       where c."CO_VAGA" = p_vaga), '[]'::jsonb),
    'anterior', coalesce((
      select jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO", jsonb_build_object(
               'situacao', a."TP_SITUACAO", 'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE",
               'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE", 'motivo_entrada', a."DS_MOTIVO_ENTRADA",
               -- A declarada congelada não se recalcula (o job usa o valor guardado).
               'declarada_congelada', case when a."VL_DECLARADA_CONGELADA" is not null
                                           then a."DS_DECLARADA_CONGELADA" || jsonb_build_object('total', a."VL_DECLARADA_CONGELADA") end))
        from public."TB_PRE_CLASSIFICACAO" a
       where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga), '{}'::jsonb),
    -- As decisões da coordenação: ficam no lote (entrada DECISAO) em todo recálculo.
    'decisoes', coalesce((
      select jsonb_object_agg(d."CO_EMPREGARE_CANDIDATO", jsonb_build_object('motivo', d."DS_MOTIVO"))
        from public."TB_DECISAO_LOTE" d
       where d."CO_MONITORAMENTO" = p_edital and d."CO_VAGA" = p_vaga and d."ST_ATIVO" = 'S'), '{}'::jsonb)
  );
end;
$function$;
comment on function public.pre_classificacao_ler_candidatos(uuid, text) is
  'Pré-classificação (job Python): os inscritos de uma vaga do edital (id, código, ativo, nascimento, data da candidatura e as colunas do questionário e do processo SEM as do cadastro — nome, e-mail, CPF, telefone, endereço), a situação anterior de cada um (situação, posição, lote, lista, entrada e a nota declarada congelada, que o job usa sem recalcular) e, desde 20261007200000, as decisões vigentes da coordenação ({id: {motivo}}: o job mantém o inscrito no lote com a entrada DECISAO). Só service_role.';

-- 5. Gravação: aplica as decisões e não as deixa de fora ------------------------------------
create or replace function public.gravar_pre_classificacao_vaga(
  p_execucao text, p_edital uuid, p_vaga text, p_versao_regra integer, p_resumo jsonb, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_exec public."TL_PRE_CLASSIFICACAO" := private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
  v_refazer boolean := v_exec."ST_REFAZER_LOTE" = 'S';
  v_quadro public."TB_QUADRO_VAGA_EDITAL";
  v_qt integer;
  v_erro text;
  v_mudancas integer;
  v_avisos jsonb := coalesce(p_resumo -> 'avisos', '[]'::jsonb);
  v_ant jsonb;
begin
  -- A regra usada é a vigente e está conferida.
  if not exists (select 1 from public."TB_REGRA_ANALISE" r
                  where r."CO_MONITORAMENTO" = p_edital and r."NU_VERSAO_VIGENTE" = p_versao_regra
                    and r."TP_SITUACAO" = 'CONFERIDA') then
    raise exception 'A regra do edital mudou ou não está conferida; rode de novo' using errcode = '40001';
  end if;
  if not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) > 20000 then
    raise exception 'Linhas inválidas (lista de até 20000)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_resumo) is distinct from 'object' or jsonb_typeof(v_avisos) <> 'array' or jsonb_array_length(v_avisos) > 50
     or exists (select 1 from jsonb_array_elements(v_avisos) a where jsonb_typeof(a) <> 'string' or a #>> '{}' !~ '^[A-Z][A-Z0-9_:]{1,59}$')
     or length(coalesce(p_resumo ->> 'descricao', '')) > 200
     or (p_resumo -> 'tamanho' is not null and jsonb_typeof(p_resumo -> 'tamanho') not in ('number', 'null'))
     or (p_resumo -> 'por_modalidade' is not null and jsonb_typeof(p_resumo -> 'por_modalidade') not in ('object', 'null')) then
    raise exception 'Resumo da vaga inválido' using errcode = '22023';
  end if;

  begin
    perform count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  exception when invalid_text_representation or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'Linha com tipo inválido (id, nota, posição ou lote)' using errcode = '22023';
  end;

  -- A forma do resultado (as mesmas regras das CK_, com mensagem clara).
  select case
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.id is null) then 'linha sem id'
    when (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas)) <> (select count(distinct t.id) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t) then 'inscrito repetido'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                                     where c."CO_EMPREGARE_CANDIDATO" = t.id and c."CO_VAGA" = p_vaga)) then 'inscrito que não é da vaga'
    when exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga
                    and not exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.id = a."CO_EMPREGARE_CANDIDATO")) then 'faltam inscritos já pré-classificados'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao is null or t.situacao not in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')) then 'situação inválida'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where (t.situacao = 'ELIMINADO') <> (t.motivo_codigo is not null)
                     or (t.motivo_codigo is not null and (t.motivo_codigo !~ '^[A-Z][A-Z0-9_]{1,29}$'
                         or coalesce(length(btrim(t.motivo)), 0) not between 1 and 200))) then 'eliminado sem motivo (ou motivo fora de eliminado)'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where (t.situacao = 'ELIMINADO' and (t.posicao is not null or t.posicao_modalidade is not null))
                     or (t.situacao <> 'ELIMINADO' and (coalesce(t.posicao, 0) < 1 or coalesce(t.posicao_modalidade, 0) < 1))) then 'posição inválida'
    when (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO')
         <> coalesce((select max(t.posicao) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO'), 0)
      or (select count(distinct t.posicao) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO')
         <> (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO') then 'posições não vão de 1 a N sem repetir'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where case when t.situacao in ('NO_LOTE', 'ANALISADO')
                             then coalesce(t.lote, 0) not between 1 and 999
                                  or coalesce(t.lista_lote, '') !~ '^(GERAL|[A-Z]{2,10})$'
                                  or coalesce(t.entrada, '') not in ('INICIAL', 'REPOSICAO', 'AMPLIACAO', 'DECISAO')
                                  or length(coalesce(t.motivo_entrada, '')) > 300
                             else t.lote is not null or t.lista_lote is not null or t.entrada is not null end) then 'lote inválido'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where coalesce(t.origem_nota, 'ART') not in ('ART', 'DECLARADA')
                     or t.modalidade !~ '^[A-Z]{2,10}$'
                     or abs(coalesce(t.art, 0)) > 1000 or abs(coalesce(t.nota, 0)) > 1000 or abs(coalesce(t.declarada, 0)) > 1000
                     or t.sem_mapa not between 0 and 100) then 'nota, origem ou modalidade inválida'
    -- A declarada congelada: completa, com o total igual à declarada da linha.
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where t.declarada_congelada is not null
                    and (jsonb_typeof(t.declarada_congelada -> 'total') is distinct from 'number'
                         or (t.declarada_congelada ->> 'total')::numeric not between 0 and 1000
                         or (t.declarada_congelada ->> 'total')::numeric is distinct from t.declarada
                         or t.declarada_completa is not true
                         or jsonb_typeof(coalesce(t.declarada_congelada -> 'respostas', '[]'::jsonb)) <> 'array'
                         or jsonb_array_length(coalesce(t.declarada_congelada -> 'respostas', '[]'::jsonb)) > 20
                         or length(t.declarada_congelada::text) > 20000)) then 'declarada congelada inválida'
    else null end
    into v_erro;
  if v_erro is not null then
    raise exception 'Resultado da vaga % recusado: %', p_vaga, v_erro using errcode = '22023';
  end if;

  -- A situação de antes de cada inscrito (para as travas e o histórico).
  select coalesce(jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO",
                                   jsonb_build_object('s', a."TP_SITUACAO", 'l', a."NU_LOTE", 'e', a."TP_ENTRADA_LOTE")), '{}'::jsonb)
    into v_ant
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga;

  -- As decisões da coordenação (TB_DECISAO_LOTE): toda decisão vigente aplicada (no lote) e só
  -- entra por decisão quem tem decisão vigente, com o mesmo motivo.
  select case
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                   join public."TB_DECISAO_LOTE" d
                     on d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'
                  where t.situacao = 'RANQUEADO'
                     or (t.situacao = 'ELIMINADO' and t.motivo_codigo is distinct from 'SAIU_DA_EMPREGARE')) then 'decisão da coordenação não aplicada'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where t.entrada = 'DECISAO'
                    and not exists (select 1 from public."TB_DECISAO_LOTE" d
                                     where d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'
                                       and btrim(d."DS_MOTIVO") = btrim(coalesce(t.motivo_entrada, '')))) then 'entrada por decisão sem decisão vigente'
    else null end
    into v_erro;
  if v_erro is not null then
    raise exception 'Resultado da vaga % recusado: %', p_vaga, v_erro using errcode = '22023';
  end if;

  -- A declarada congelada não muda: só a coordenação descongela (descongelar_declarada_pre_classificacao).
  if exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
               join public."TB_PRE_CLASSIFICACAO" a
                 on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = t.id
              where a."VL_DECLARADA_CONGELADA" is not null and t.declarada is not null
                and t.declarada is distinct from a."VL_DECLARADA_CONGELADA") then
    raise exception 'Resultado da vaga % recusado: a nota declarada congelada não muda (descongele antes)', p_vaga using errcode = '22023';
  end if;

  -- Quem tem ficha (ANALISADO) não muda; ANALISADO só vem do banco (fase F3).
  if exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
               cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
              where (h.ant_situacao is not distinct from 'ANALISADO') <> (t.situacao = 'ANALISADO')
                 or (h.ant_situacao = 'ANALISADO' and h.ant_lote is distinct from t.lote)) then
    raise exception 'Resultado da vaga % recusado: quem já tem ficha não muda', p_vaga using errcode = '22023';
  end if;
  -- Quem está no lote só sai eliminado (a não ser que a execução refaça o lote); quem entrou
  -- por decisão da coordenação já revogada sai.
  if not v_refazer and exists (
      select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
       cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote,
                                  v_ant -> t.id::text ->> 'e' as ant_entrada) h
       where h.ant_situacao = 'NO_LOTE'
         and not (t.situacao = 'ELIMINADO' or (t.situacao = 'NO_LOTE' and t.lote = h.ant_lote))
         and not (h.ant_entrada = 'DECISAO'
                  and not exists (select 1 from public."TB_DECISAO_LOTE" d
                                   where d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'))) then
    raise exception 'Resultado da vaga % recusado: quem está no lote só sai eliminado (AM-5.5)', p_vaga using errcode = '22023';
  end if;

  -- Grava o resultado (rodar de novo atualiza a mesma linha: AM-4.2).
  insert into public."TB_PRE_CLASSIFICACAO" as a
    ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "NU_VERSAO_REGRA", "TP_SITUACAO",
     "CO_MOTIVO_ELIMINACAO", "DS_MOTIVO_ELIMINACAO", "VL_ART", "VL_NOTA_ORDEM", "TP_ORIGEM_NOTA",
     "VL_NOTA_DECLARADA", "DS_NOTA_DECLARADA", "ST_DIVERGENTE", "NO_MODALIDADE", "NU_POSICAO",
     "NU_POSICAO_MODALIDADE", "NU_LOTE", "CO_LISTA_LOTE", "TP_ENTRADA_LOTE", "DS_MOTIVO_ENTRADA",
     "DT_ENTRADA_LOTE", "CO_EXECUCAO", "VL_DECLARADA_CONGELADA", "DS_DECLARADA_CONGELADA", "DT_CONGELAMENTO_DECLARADA")
  select p_edital, t.id, p_vaga, p_versao_regra, t.situacao,
         t.motivo_codigo, left(btrim(t.motivo), 200), t.art, t.nota, t.origem_nota,
         t.declarada,
         case when t.declarada is null then null
              else jsonb_build_object('parciais', coalesce(t.declarada_parciais, '{}'::jsonb), 'sem_mapa', t.sem_mapa,
                                      'completa', t.declarada_completa) end,
         case when t.divergente then 'S' else 'N' end, t.modalidade, t.posicao,
         t.posicao_modalidade, t.lote, t.lista_lote, t.entrada, nullif(left(btrim(t.motivo_entrada), 300), ''),
         case when t.lote is not null then now() end, p_execucao,
         (t.declarada_congelada ->> 'total')::numeric,
         case when t.declarada_congelada is not null
              then (t.declarada_congelada - 'total') || jsonb_build_object('versao_regra', p_versao_regra) end,
         case when t.declarada_congelada is not null then now() end
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
  on conflict ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO") do update set
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "TP_SITUACAO" = excluded."TP_SITUACAO",
    "CO_MOTIVO_ELIMINACAO" = excluded."CO_MOTIVO_ELIMINACAO",
    "DS_MOTIVO_ELIMINACAO" = excluded."DS_MOTIVO_ELIMINACAO",
    "VL_ART" = excluded."VL_ART",
    "VL_NOTA_ORDEM" = excluded."VL_NOTA_ORDEM",
    "TP_ORIGEM_NOTA" = excluded."TP_ORIGEM_NOTA",
    "VL_NOTA_DECLARADA" = excluded."VL_NOTA_DECLARADA",
    "DS_NOTA_DECLARADA" = excluded."DS_NOTA_DECLARADA",
    "ST_DIVERGENTE" = excluded."ST_DIVERGENTE",
    "NO_MODALIDADE" = excluded."NO_MODALIDADE",
    "NU_POSICAO" = excluded."NU_POSICAO",
    "NU_POSICAO_MODALIDADE" = excluded."NU_POSICAO_MODALIDADE",
    "NU_LOTE" = excluded."NU_LOTE",
    "CO_LISTA_LOTE" = excluded."CO_LISTA_LOTE",
    "TP_ENTRADA_LOTE" = excluded."TP_ENTRADA_LOTE",
    "DS_MOTIVO_ENTRADA" = excluded."DS_MOTIVO_ENTRADA",
    -- Quem continua no mesmo lote guarda a data de entrada.
    "DT_ENTRADA_LOTE" = case when excluded."NU_LOTE" is null then null
                             when a."NU_LOTE" is not distinct from excluded."NU_LOTE" then a."DT_ENTRADA_LOTE"
                             else now() end,
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    -- A congelada fica como estava; só entra quando ainda não há.
    "VL_DECLARADA_CONGELADA" = coalesce(a."VL_DECLARADA_CONGELADA", excluded."VL_DECLARADA_CONGELADA"),
    "DS_DECLARADA_CONGELADA" = case when a."VL_DECLARADA_CONGELADA" is not null then a."DS_DECLARADA_CONGELADA"
                                    else excluded."DS_DECLARADA_CONGELADA" end,
    "DT_CONGELAMENTO_DECLARADA" = case when a."VL_DECLARADA_CONGELADA" is not null then a."DT_CONGELAMENTO_DECLARADA"
                                       else excluded."DT_CONGELAMENTO_DECLARADA" end,
    "DT_ATUALIZACAO" = now();

  -- Histórico: entrada na lista, troca de situação ou de lote (com o motivo).
  insert into public."TH_PRE_CLASSIFICACAO"
    ("CO_EXECUCAO", "CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "TP_SITUACAO_ANTERIOR",
     "TP_SITUACAO", "NU_LOTE_ANTERIOR", "NU_LOTE", "NU_POSICAO", "DS_MOTIVO")
  select p_execucao, p_edital, t.id, p_vaga, h.ant_situacao, t.situacao, h.ant_lote, t.lote, t.posicao,
         left(case when t.situacao = 'ELIMINADO' then t.motivo
                   when t.entrada = 'DECISAO' and h.ant_entrada is distinct from 'DECISAO'
                     then 'Incluído no lote por decisão da coordenação: ' || t.motivo_entrada
                   when h.ant_entrada = 'DECISAO' and t.lote is null
                     then 'Saiu do lote: a decisão da coordenação foi revogada'
                   when t.lote is not null and t.lote is distinct from h.ant_lote then t.motivo_entrada
                   when h.ant_situacao = 'NO_LOTE' and t.situacao = 'RANQUEADO' then 'Saiu do lote: o recorte foi refeito'
                   when h.ant_situacao is null then 'Entrou na Provisória'
                   else null end, 300)
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
   cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote,
                              v_ant -> t.id::text ->> 'e' as ant_entrada) h
   where h.ant_situacao is null
      or h.ant_situacao is distinct from t.situacao
      or h.ant_lote is distinct from t.lote
      or h.ant_entrada is distinct from t.entrada;
  get diagnostics v_mudancas = row_count;

  -- O resumo da vaga: contagens feitas aqui; quadro lido aqui.
  v_quadro := private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga);
  select count(*) into v_qt from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  insert into public."TB_PRE_CLASSIF_VAGA" as pv
    ("CO_MONITORAMENTO", "CO_VAGA", "CO_EXECUCAO", "NU_VERSAO_REGRA", "CO_QUADRO_VAGA", "NO_CARGO", "NO_LOTACAO",
     "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "QT_INSCRITO", "QT_ELIMINADO", "QT_RANQUEADO", "QT_LOTE",
     "QT_TAMANHO_LOTE", "DS_TAMANHO_LOTE", "DS_TAMANHO_MODALIDADE", "VL_ART_CORTE", "QT_DIVERGENCIA", "QT_SEM_ART",
     "QT_ACIMA_CORTE", "NU_ULTIMO_LOTE", "DS_AVISO")
  select p_edital, p_vaga, p_execucao, p_versao_regra, v_quadro."CO_QUADRO_VAGA", v_quadro."NO_CARGO", v_quadro."NO_LOTACAO",
         v_quadro."QT_VAGA_IMEDIATA", coalesce(v_quadro."ST_CADASTRO_RESERVA", 'N'), v_qt,
         count(*) filter (where t.situacao = 'ELIMINADO'),
         count(*) filter (where t.situacao <> 'ELIMINADO'),
         count(*) filter (where t.situacao in ('NO_LOTE', 'ANALISADO')),
         case when jsonb_typeof(p_resumo -> 'tamanho') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'tamanho')::numeric))::integer end,
         nullif(left(btrim(coalesce(p_resumo ->> 'descricao', '')), 200), ''),
         case when jsonb_typeof(p_resumo -> 'por_modalidade') = 'object' then p_resumo -> 'por_modalidade' end,
         -- A linha de corte só com os da regra (quem entrou por decisão fica fora).
         min(t.nota) filter (where t.situacao in ('NO_LOTE', 'ANALISADO') and t.entrada is distinct from 'DECISAO'),
         count(*) filter (where t.divergente),
         count(*) filter (where t.situacao <> 'ELIMINADO' and t.art is null),
         case when jsonb_typeof(p_resumo -> 'acima_do_corte') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'acima_do_corte')::numeric))::integer else 0 end,
         coalesce(max(t.lote), 0),
         v_avisos
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
  on conflict ("CO_MONITORAMENTO", "CO_VAGA") do update set
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "CO_QUADRO_VAGA" = excluded."CO_QUADRO_VAGA",
    "NO_CARGO" = excluded."NO_CARGO",
    "NO_LOTACAO" = excluded."NO_LOTACAO",
    "QT_VAGA_IMEDIATA" = excluded."QT_VAGA_IMEDIATA",
    "ST_CADASTRO_RESERVA" = excluded."ST_CADASTRO_RESERVA",
    "QT_INSCRITO" = excluded."QT_INSCRITO",
    "QT_ELIMINADO" = excluded."QT_ELIMINADO",
    "QT_RANQUEADO" = excluded."QT_RANQUEADO",
    "QT_LOTE" = excluded."QT_LOTE",
    "QT_TAMANHO_LOTE" = excluded."QT_TAMANHO_LOTE",
    "DS_TAMANHO_LOTE" = excluded."DS_TAMANHO_LOTE",
    "DS_TAMANHO_MODALIDADE" = excluded."DS_TAMANHO_MODALIDADE",
    "VL_ART_CORTE" = excluded."VL_ART_CORTE",
    "QT_DIVERGENCIA" = excluded."QT_DIVERGENCIA",
    "QT_SEM_ART" = excluded."QT_SEM_ART",
    "QT_ACIMA_CORTE" = excluded."QT_ACIMA_CORTE",
    "NU_ULTIMO_LOTE" = greatest(pv."NU_ULTIMO_LOTE", excluded."NU_ULTIMO_LOTE"),
    "DS_AVISO" = excluded."DS_AVISO",
    "DT_ATUALIZACAO" = now();

  return jsonb_build_object('vaga', p_vaga, 'inscritos', v_qt, 'mudancas', v_mudancas);
end;
$function$;
comment on function public.gravar_pre_classificacao_vaga(text, uuid, text, integer, jsonb, jsonb) is
  'Grava a pré-classificação PRONTA de uma vaga (calculada pelo job Python): confere a regra vigente e conferida (40001), que os inscritos são da vaga, que nenhum já gravado falta, a forma (eliminado com motivo, posições de 1 a N, lote com número, lista e entrada), que quem tem ficha não muda, que quem está no lote só sai eliminado (salvo execução que refaz o lote ou, desde 20261007200000, quem entrou por decisão já revogada), que a nota declarada congelada não muda e, desde 20261007200000, que toda decisão vigente da coordenação (TB_DECISAO_LOTE) foi aplicada e só entra por decisão (entrada DECISAO, com o motivo da decisão) quem a tem; grava o histórico das mudanças com o motivo e o resumo da vaga (contagens feitas no banco, a linha de corte só com os da regra; quadro lido no banco). 22023 com o motivo da recusa. Só service_role.';

-- 6. Recontagem do resumo da vaga depois de uma decisão ---------------------------------------
create function private."FC_RECONTAR_PRE_CLASSIF_VAGA"(p_edital uuid, p_vaga text)
returns void
language sql
security definer
set search_path to ''
as $function$
  update public."TB_PRE_CLASSIF_VAGA" pv set
    "QT_ELIMINADO" = s.eliminados, "QT_RANQUEADO" = s.ranqueados, "QT_LOTE" = s.lote, "DT_ATUALIZACAO" = now()
    from (select count(*) filter (where a."TP_SITUACAO" = 'ELIMINADO') as eliminados,
                 count(*) filter (where a."TP_SITUACAO" <> 'ELIMINADO') as ranqueados,
                 count(*) filter (where a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')) as lote
            from public."TB_PRE_CLASSIFICACAO" a
           where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga) s
   where pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = p_vaga;
$function$;
comment on function private."FC_RECONTAR_PRE_CLASSIF_VAGA"(uuid, text) is
  'Reconta eliminados, ranqueados e lote (regra + decisão) do resumo da vaga (TB_PRE_CLASSIF_VAGA) depois de uma decisão da coordenação pela tela; o próximo recálculo grava o resumo completo.';
revoke all on function private."FC_RECONTAR_PRE_CLASSIF_VAGA"(uuid, text) from public, anon, authenticated;

-- 7. Os inscritos pedidos pela coordenação (por código, na vaga ou no edital) ------------------
create function private."FC_INSCRITOS_DA_DECISAO"(p_edital uuid, p_codigos text[], p_vaga text)
returns table (candidato uuid, codigo text, vaga text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_codigos text[] := array(select distinct btrim(x) from unnest(coalesce(p_codigos, '{}')) x where btrim(coalesce(x, '')) <> '');
  v_codigo text;
  v_qt integer;
begin
  if cardinality(v_codigos) not between 1 and 200 then
    raise exception 'Diga de 1 a 200 códigos de candidato.' using errcode = '22023';
  end if;
  if p_vaga is not null and not exists (select 1 from public."TB_EMPREGARE_VAGA" v
                                         where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  foreach v_codigo in array v_codigos loop
    select count(*) into v_qt
      from public."TB_PRE_CLASSIFICACAO" a
      join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
     where a."CO_MONITORAMENTO" = p_edital and c."CO_CANDIDATO_EMPREGARE" = v_codigo
       and (p_vaga is null or a."CO_VAGA" = p_vaga);
    if v_qt = 0 then
      raise exception 'O candidato % não está na pré-classificação do edital%.', v_codigo,
        case when p_vaga is null then '' else ' (vaga ' || p_vaga || ')' end using errcode = '22023';
    end if;
    if v_qt > 1 then
      raise exception 'O candidato % está em mais de uma vaga do edital: diga a vaga.', v_codigo using errcode = '22023';
    end if;
  end loop;
  return query
    select a."CO_EMPREGARE_CANDIDATO", c."CO_CANDIDATO_EMPREGARE"::text, a."CO_VAGA"::text
      from public."TB_PRE_CLASSIFICACAO" a
      join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
     where a."CO_MONITORAMENTO" = p_edital and c."CO_CANDIDATO_EMPREGARE" = any (v_codigos)
       and (p_vaga is null or a."CO_VAGA" = p_vaga)
     order by a."CO_VAGA", a."VL_NOTA_ORDEM" desc nulls last, c."CO_CANDIDATO_EMPREGARE";
end;
$function$;
comment on function private."FC_INSCRITOS_DA_DECISAO"(uuid, text[], text) is
  'Os inscritos da pré-classificação do edital pelos códigos da Empregare (1 a 200; opcionalmente só da vaga p_vaga), na ordem da vaga e da nota; recusa (22023) código que não está no edital ou que está em mais de uma vaga sem a vaga dita.';
revoke all on function private."FC_INSCRITOS_DA_DECISAO"(uuid, text[], text) from public, anon, authenticated;

-- 8. Incluir no lote por decisão da coordenação --------------------------------------------
create function public.incluir_no_lote_por_decisao(p_edital uuid, p_codigos text[], p_motivo text, p_vaga text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_uid uuid := (select auth.uid());
  v_item record;
  v_a public."TB_PRE_CLASSIFICACAO";
  v_decisao uuid;
  v_lote integer;
  v_lista text;
  v_posicao integer;
  v_posicao_mod integer;
  v_vagas text[] := '{}';
  v_vaga text;
  v_qt integer := 0;
  v_fichas jsonb;
begin
  perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  if length(v_motivo) not between 5 and 250 then
    raise exception 'Diga o motivo da decisão (de 5 a 250 caracteres).' using errcode = '22023';
  end if;
  if exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
              where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour') then
    raise exception 'Há uma pré-classificação rodando: inclua quando ela terminar.' using errcode = '55P03';
  end if;
  -- As mesmas travas da abertura das fichas (job e tela não se atropelam).
  perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));

  for v_item in select * from private."FC_INSCRITOS_DA_DECISAO"(p_edital, p_codigos, p_vaga) loop
    select * into v_a from public."TB_PRE_CLASSIFICACAO"
     where "CO_MONITORAMENTO" = p_edital and "CO_EMPREGARE_CANDIDATO" = v_item.candidato
     for update;
    if v_a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') then
      raise exception 'O candidato % já está no lote.', v_item.codigo using errcode = '22023';
    end if;
    if v_a."CO_MOTIVO_ELIMINACAO" = 'SAIU_DA_EMPREGARE' then
      raise exception 'O candidato % saiu do arquivo da Empregare: não entra no lote.', v_item.codigo using errcode = '22023';
    end if;
    if exists (select 1 from public."TB_DECISAO_LOTE" d
                where d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = v_item.candidato and d."ST_ATIVO" = 'S') then
      raise exception 'O candidato % já tem decisão vigente.', v_item.codigo using errcode = '22023';
    end if;

    insert into public."TB_DECISAO_LOTE"
      ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "DS_MOTIVO", "CO_USUARIO_DECISAO",
       "TP_SITUACAO_REGRA", "CO_MOTIVO_ELIMINACAO_REGRA", "DS_MOTIVO_ELIMINACAO_REGRA")
    values (p_edital, v_item.candidato, v_a."CO_VAGA", v_motivo, v_uid,
            v_a."TP_SITUACAO", v_a."CO_MOTIVO_ELIMINACAO", v_a."DS_MOTIVO_ELIMINACAO")
    returning "CO_DECISAO_LOTE" into v_decisao;
    insert into public."TH_DECISAO_LOTE" ("CO_DECISAO_LOTE", "TP_ACAO", "DS_MOTIVO", "CO_USUARIO")
    values (v_decisao, 'INCLUIR', v_motivo, v_uid);

    -- O lote da vaga (o último), a lista (a da modalidade, se a vaga tem listas por modalidade)
    -- e, para o eliminado, a posição depois do último da Provisória (o job reordena ao recalcular).
    select greatest(1, coalesce(max(a."NU_LOTE"), 0),
                    coalesce((select pv."NU_ULTIMO_LOTE" from public."TB_PRE_CLASSIF_VAGA" pv
                               where pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v_a."CO_VAGA"), 0)),
           case when bool_or(a."CO_LISTA_LOTE" is not null and a."CO_LISTA_LOTE" <> 'GERAL')
                then case when bool_or(a."CO_LISTA_LOTE" = v_a."NO_MODALIDADE") then v_a."NO_MODALIDADE" else 'AC' end
                else 'GERAL' end,
           coalesce(max(a."NU_POSICAO"), 0) + 1,
           coalesce(max(a."NU_POSICAO_MODALIDADE") filter (where a."NO_MODALIDADE" = v_a."NO_MODALIDADE"), 0) + 1
      into v_lote, v_lista, v_posicao, v_posicao_mod
      from public."TB_PRE_CLASSIFICACAO" a
     where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = v_a."CO_VAGA";

    update public."TB_PRE_CLASSIFICACAO" set
      "TP_SITUACAO" = 'NO_LOTE', "CO_MOTIVO_ELIMINACAO" = null, "DS_MOTIVO_ELIMINACAO" = null,
      "NU_POSICAO" = coalesce("NU_POSICAO", v_posicao),
      "NU_POSICAO_MODALIDADE" = coalesce("NU_POSICAO_MODALIDADE", v_posicao_mod),
      "NU_LOTE" = v_lote, "CO_LISTA_LOTE" = v_lista, "TP_ENTRADA_LOTE" = 'DECISAO',
      "DS_MOTIVO_ENTRADA" = v_motivo, "DT_ENTRADA_LOTE" = now(), "DT_ATUALIZACAO" = now()
     where "CO_MONITORAMENTO" = p_edital and "CO_EMPREGARE_CANDIDATO" = v_item.candidato
    returning * into v_a;

    insert into public."TH_PRE_CLASSIFICACAO"
      ("CO_EXECUCAO", "CO_USUARIO", "CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "TP_SITUACAO_ANTERIOR",
       "TP_SITUACAO", "NU_LOTE_ANTERIOR", "NU_LOTE", "NU_POSICAO", "DS_MOTIVO")
    select null, v_uid, p_edital, v_item.candidato, v_a."CO_VAGA", d."TP_SITUACAO_REGRA", 'NO_LOTE', null, v_a."NU_LOTE",
           v_a."NU_POSICAO", left('Incluído no lote por decisão da coordenação: ' || v_motivo, 300)
      from public."TB_DECISAO_LOTE" d where d."CO_DECISAO_LOTE" = v_decisao;

    if not (v_a."CO_VAGA" = any (v_vagas)) then
      v_vagas := v_vagas || v_a."CO_VAGA"::text;
    end if;
    v_qt := v_qt + 1;
  end loop;

  foreach v_vaga in array v_vagas loop
    perform private."FC_RECONTAR_PRE_CLASSIF_VAGA"(p_edital, v_vaga);
  end loop;
  -- A ficha abre normalmente (livre na fila).
  v_fichas := private."FC_ABRIR_FICHAS"(p_edital, '[]'::jsonb, v_uid);
  return json_build_object('incluidos', v_qt, 'fichas_criadas', coalesce((v_fichas ->> 'criadas')::integer, 0),
                           'fichas_voltaram', coalesce((v_fichas ->> 'voltaram')::integer, 0));
end;
$function$;
comment on function public.incluir_no_lote_por_decisao(uuid, text[], text, text) is
  'A coordenação da avaliação do edital inclui no lote de convocação, por decisão, candidatos que a regra deixa fora (eliminados pela regra ou abaixo do corte): grava a decisão (TB_DECISAO_LOTE, com o motivo de 5 a 250 caracteres — ex.: "Critério CORES" —, quem, quando e a situação pela regra) e o histórico, põe o inscrito no lote na hora (NO_LOTE, entrada DECISAO, no último lote da vaga; o eliminado ganha posição depois do último da Provisória) e abre a ficha (FC_ABRIR_FICHAS). Os recálculos mantêm a decisão até ela ser revogada (revogar_decisao_lote). p_codigos: códigos da Empregare (1 a 200); p_vaga opcional. Recusa (22023) quem já está no lote, saiu da Empregare ou já tem decisão; 55P03 com pré-classificação rodando. Só a coordenação (FC_EXIGIR_COORD_AVALIACAO).';
revoke all on function public.incluir_no_lote_por_decisao(uuid, text[], text, text) from public, anon;
grant execute on function public.incluir_no_lote_por_decisao(uuid, text[], text, text) to authenticated;

-- 9. Revogar a decisão ------------------------------------------------------------------------
create function public.revogar_decisao_lote(p_edital uuid, p_codigos text[], p_motivo text, p_vaga text default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_uid uuid := (select auth.uid());
  v_item record;
  v_a public."TB_PRE_CLASSIFICACAO";
  v_d public."TB_DECISAO_LOTE";
  v_vagas text[] := '{}';
  v_vaga text;
  v_qt integer := 0;
  v_fichas jsonb;
begin
  perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  if length(v_motivo) not between 10 and 250 then
    raise exception 'Diga o motivo da revogação (de 10 a 250 caracteres).' using errcode = '22023';
  end if;
  if exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
              where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour') then
    raise exception 'Há uma pré-classificação rodando: revogue quando ela terminar.' using errcode = '55P03';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));

  for v_item in select * from private."FC_INSCRITOS_DA_DECISAO"(p_edital, p_codigos, p_vaga) loop
    select * into v_d from public."TB_DECISAO_LOTE"
     where "CO_MONITORAMENTO" = p_edital and "CO_EMPREGARE_CANDIDATO" = v_item.candidato and "ST_ATIVO" = 'S'
     for update;
    if v_d."CO_DECISAO_LOTE" is null then
      raise exception 'O candidato % não tem decisão vigente.', v_item.codigo using errcode = '22023';
    end if;
    select * into v_a from public."TB_PRE_CLASSIFICACAO"
     where "CO_MONITORAMENTO" = p_edital and "CO_EMPREGARE_CANDIDATO" = v_item.candidato
     for update;
    if v_a."TP_SITUACAO" = 'ANALISADO' or exists (
         select 1 from public."TB_FICHA_ANALISE" f
          where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = v_item.candidato
            and f."TP_SITUACAO" = 'CONCLUIDA') then
      raise exception 'O candidato % já tem a ficha concluída: a decisão não se revoga.', v_item.codigo using errcode = '22023';
    end if;

    -- A decisão sai antes (o gatilho do lote confere que não há decisão vigente).
    update public."TB_DECISAO_LOTE" set
      "ST_ATIVO" = 'N', "DS_MOTIVO_REVOGACAO" = v_motivo, "CO_USUARIO_REVOGACAO" = v_uid,
      "DT_REVOGACAO" = now(), "DT_ATUALIZACAO" = now()
     where "CO_DECISAO_LOTE" = v_d."CO_DECISAO_LOTE";
    insert into public."TH_DECISAO_LOTE" ("CO_DECISAO_LOTE", "TP_ACAO", "DS_MOTIVO", "CO_USUARIO")
    values (v_d."CO_DECISAO_LOTE", 'REVOGAR', v_motivo, v_uid);

    -- Quem entrou por decisão volta à situação da regra (o próximo recálculo confere).
    if v_a."TP_SITUACAO" = 'NO_LOTE' and v_a."TP_ENTRADA_LOTE" = 'DECISAO' then
      update public."TB_PRE_CLASSIFICACAO" set
        "TP_SITUACAO" = v_d."TP_SITUACAO_REGRA",
        "CO_MOTIVO_ELIMINACAO" = v_d."CO_MOTIVO_ELIMINACAO_REGRA",
        "DS_MOTIVO_ELIMINACAO" = v_d."DS_MOTIVO_ELIMINACAO_REGRA",
        "NU_POSICAO" = case when v_d."TP_SITUACAO_REGRA" = 'ELIMINADO' then null else "NU_POSICAO" end,
        "NU_POSICAO_MODALIDADE" = case when v_d."TP_SITUACAO_REGRA" = 'ELIMINADO' then null else "NU_POSICAO_MODALIDADE" end,
        "NU_LOTE" = null, "CO_LISTA_LOTE" = null, "TP_ENTRADA_LOTE" = null, "DS_MOTIVO_ENTRADA" = null,
        "DT_ENTRADA_LOTE" = null, "DT_ATUALIZACAO" = now()
       where "CO_MONITORAMENTO" = p_edital and "CO_EMPREGARE_CANDIDATO" = v_item.candidato;
      insert into public."TH_PRE_CLASSIFICACAO"
        ("CO_EXECUCAO", "CO_USUARIO", "CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "TP_SITUACAO_ANTERIOR",
         "TP_SITUACAO", "NU_LOTE_ANTERIOR", "NU_LOTE", "NU_POSICAO", "DS_MOTIVO")
      values (null, v_uid, p_edital, v_item.candidato, v_a."CO_VAGA", 'NO_LOTE', v_d."TP_SITUACAO_REGRA", v_a."NU_LOTE", null,
              case when v_d."TP_SITUACAO_REGRA" = 'ELIMINADO' then null else v_a."NU_POSICAO" end,
              left('Decisão da coordenação revogada: ' || v_motivo, 300));
      if not (v_a."CO_VAGA" = any (v_vagas)) then
        v_vagas := v_vagas || v_a."CO_VAGA"::text;
      end if;
    end if;
    v_qt := v_qt + 1;
  end loop;

  foreach v_vaga in array v_vagas loop
    perform private."FC_RECONTAR_PRE_CLASSIF_VAGA"(p_edital, v_vaga);
  end loop;
  -- A ficha não concluída de quem saiu fica FORA_LOTE (com o motivo, sem reserva).
  v_fichas := private."FC_ABRIR_FICHAS"(p_edital, '[]'::jsonb, v_uid);
  return json_build_object('revogadas', v_qt, 'fichas_fora_do_lote', coalesce((v_fichas ->> 'fora_do_lote')::integer, 0));
end;
$function$;
comment on function public.revogar_decisao_lote(uuid, text[], text, text) is
  'A coordenação da avaliação do edital revoga decisões de lote (exclusão lógica em TB_DECISAO_LOTE, com motivo de 10 a 250 caracteres, quem e quando, e o histórico): quem entrou por decisão volta à situação da regra (eliminado com o motivo de antes, ou ranqueado) e a ficha não concluída fica FORA_LOTE (FC_ABRIR_FICHAS). Recusa (22023) sem decisão vigente ou com a ficha concluída (ou ANALISADO); 55P03 com pré-classificação rodando. Só a coordenação (FC_EXIGIR_COORD_AVALIACAO).';
revoke all on function public.revogar_decisao_lote(uuid, text[], text, text) from public, anon;
grant execute on function public.revogar_decisao_lote(uuid, text[], text, text) to authenticated;

-- 10. Tela: a decisão de cada inscrito e o lote pela regra e por decisão -----------------------
create or replace function public.obter_pre_classificacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_classif_editor boolean := private.pode_recurso('classificacao', 2);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital)),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_registrar_lista', coalesce(v_papel = 'COORDENADOR', false) or coalesce(v_classif_editor, false),
    'pode_publicar_lista', coalesce(v_classif_editor, false),
    'regra', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                       'configuracao', h."DS_CONFIGURACAO")
                from public."TB_REGRA_ANALISE" r
                join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
               where r."CO_MONITORAMENTO" = p_edital),
    'regra_classificacao', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'configuracao', h."DS_CONFIGURACAO")
                              from public."TB_REGRA_CLASSIFICACAO" r
                              join public."TH_REGRA_CLASSIFICACAO" h
                                on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                             where r."CO_MONITORAMENTO" = p_edital),
    'em_andamento', exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
                             where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour'),
    'ultima_execucao', (
      select json_build_object('id', t."CO_EXECUCAO", 'inicio', t."DT_INICIO", 'fim', t."DT_FIM", 'situacao', t."TP_SITUACAO",
                               'disparo', t."TP_DISPARO", 'refazer', t."ST_REFAZER_LOTE" = 'S', 'mensagem', t."DS_MENSAGEM",
                               'execucao', t."DS_URL_EXECUCAO",
                               'edital', (select e from jsonb_array_elements(t."DS_EDITAL") e where e ->> 'edital' = p_edital::text limit 1))
        from public."TL_PRE_CLASSIFICACAO" t
       where t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', p_edital::text))
       order by t."DT_INICIO" desc limit 1),
    'vagas', coalesce((
      select json_agg(json_build_object(
               'codigo', v."CO_VAGA",
               'candidatos_empregare', v."QT_CANDIDATO_ATIVO",
               'ultima_carga', v."DT_ULTIMA_CARGA",
               'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO",
               'vagas_imediatas', pv."QT_VAGA_IMEDIATA", 'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
               'inscritos', pv."QT_INSCRITO", 'eliminados', pv."QT_ELIMINADO", 'ranqueados', pv."QT_RANQUEADO",
               'no_lote', pv."QT_LOTE", 'tamanho', pv."QT_TAMANHO_LOTE", 'descricao', pv."DS_TAMANHO_LOTE",
               'por_modalidade', pv."DS_TAMANHO_MODALIDADE", 'art_corte', pv."VL_ART_CORTE",
               'divergencias', pv."QT_DIVERGENCIA", 'sem_art', pv."QT_SEM_ART", 'acima_do_corte', pv."QT_ACIMA_CORTE",
               'ultimo_lote', pv."NU_ULTIMO_LOTE", 'avisos', coalesce(pv."DS_AVISO", '[]'::jsonb),
               -- O lote pela regra e por decisão da coordenação, contados agora.
               'no_lote_regra', (select count(*) from public."TB_PRE_CLASSIFICACAO" a
                                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = v."CO_VAGA"
                                    and a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and a."TP_ENTRADA_LOTE" is distinct from 'DECISAO'),
               'no_lote_decisao', (select count(*) from public."TB_PRE_CLASSIFICACAO" a
                                    where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = v."CO_VAGA"
                                      and a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and a."TP_ENTRADA_LOTE" = 'DECISAO'),
               'versao_regra', pv."NU_VERSAO_REGRA", 'atualizado_em', pv."DT_ATUALIZACAO")
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
        left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA"
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'candidatos', coalesce((
      select json_agg(json_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA",
               'codigo', c."CO_CANDIDATO_EMPREGARE", 'nome', c."NO_CANDIDATO",
               'situacao', a."TP_SITUACAO", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'motivo', a."DS_MOTIVO_ELIMINACAO",
               'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM", 'origem_nota', a."TP_ORIGEM_NOTA",
               'declarada', a."VL_NOTA_DECLARADA", 'divergente', a."ST_DIVERGENTE" = 'S', 'modalidade', a."NO_MODALIDADE",
               'declarada_completa', (a."DS_NOTA_DECLARADA" ->> 'completa')::boolean,
               'declarada_congelada', a."VL_DECLARADA_CONGELADA", 'congelada_em', a."DT_CONGELAMENTO_DECLARADA",
               'posicao', a."NU_POSICAO", 'posicao_modalidade', a."NU_POSICAO_MODALIDADE",
               'lote', a."NU_LOTE", 'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE",
               'motivo_entrada', a."DS_MOTIVO_ENTRADA", 'entrada_em', a."DT_ENTRADA_LOTE",
               'decisao', case when d."CO_DECISAO_LOTE" is not null then json_build_object(
                 'motivo', d."DS_MOTIVO", 'por', coalesce(ud.nome, ud.email), 'em', d."DT_DECISAO",
                 'situacao_regra', d."TP_SITUACAO_REGRA", 'motivo_regra', d."DS_MOTIVO_ELIMINACAO_REGRA") end)
             order by a."CO_VAGA", a."TP_SITUACAO" = 'ELIMINADO', a."NU_POSICAO", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_DECISAO_LOTE" d
          on d."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and d."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO" and d."ST_ATIVO" = 'S'
        left join public."TB_PERFIL_USUARIO" ud on ud.user_id = d."CO_USUARIO_DECISAO"
       where a."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'listas', coalesce((
      select json_agg(json_build_object('meta', private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO"),
                                        'lote', l."DS_RESULTADO" -> 'lote')
             order by l."DT_GERACAO" desc)
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" in ('PROVISORIA', 'LOTE')), '[]'::json)
  );
end;
$function$;
comment on function public.obter_pre_classificacao(uuid) is
  'A pré-classificação do edital para a aba Pré-classificação (json): regra vigente, regra de classificação (textos do documento), última execução do job que tratou o edital, se há execução em andamento, cada vaga da Empregare com o resumo (quadro, tamanho do lote, linha de corte, divergências, avisos), os inscritos (código, nome, situação, motivo, ART, nota declarada — completa ou não, congelada e quando, desde 20261007170000 —, posição, lote e motivo da entrada e, desde 20261007200000, a decisão vigente da coordenação: motivo, quem, quando e a situação pela regra; sem CPF nem contato), por vaga quantos estão no lote pela regra e por decisão (desde 20261007200000) e as listas PROVISORIA e LOTE registradas. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_pre_classificacao(uuid) from public, anon;
grant execute on function public.obter_pre_classificacao(uuid) to authenticated;

-- 11. Fila: a entrada e o motivo da decisão ---------------------------------------------------
create or replace function public.obter_fila_avaliacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_uid uuid := (select auth.uid());
  v_so_minhas_vagas boolean := coalesce(v_papel, '') = 'ANALISTA';
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'area', v_area,
                                'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital)),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_pegar', private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, null),
    'eu', v_uid,
    'prazo_reserva_min', extract(epoch from private."FC_PRAZO_RESERVA_FICHA"())::integer / 60,
    'distribuicao', private."FC_DISTRIBUICAO_DO_EDITAL"(p_edital),
    'sem_ficha', (select count(*) from public."TB_PRE_CLASSIFICACAO" p
                   where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
                     and not exists (select 1 from public."TB_FICHA_ANALISE" f
                                      where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")),
    'vagas', coalesce((
      select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO")
                      order by pv."CO_VAGA")
        from public."TB_PRE_CLASSIF_VAGA" pv
       where pv."CO_MONITORAMENTO" = p_edital
         and (not v_so_minhas_vagas or private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, pv."CO_VAGA"))), '[]'::json),
    'analistas', private."FC_ANALISTAS_DO_EDITAL"(p_edital, true),
    'filtros', private."FC_FILTROS_FILA_JSON"(v_uid),
    'candidatos', coalesce((
      select json_agg(json_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA", 'codigo', c."CO_CANDIDATO_EMPREGARE",
               'nome', c."NO_CANDIDATO", 'situacao_pre', a."TP_SITUACAO", 'motivo_eliminacao', a."DS_MOTIVO_ELIMINACAO",
               'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE", 'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM",
               'modalidade', a."NO_MODALIDADE", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'entrada', a."TP_ENTRADA_LOTE",
               'decisao', case when a."TP_ENTRADA_LOTE" = 'DECISAO' then a."DS_MOTIVO_ENTRADA" end,
               'ficha', case when f."CO_FICHA_ANALISE" is null then null else json_build_object(
                 'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'situacao', f."TP_SITUACAO",
                 'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
                 'atribuida_em', f."DT_ATRIBUICAO", 'motivo_saida', f."DS_MOTIVO_SAIDA", 'lote', f."NU_LOTE",
                 'resultado', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."TP_RESULTADO" end,
                 'nota_final', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."VL_NOTA_FINAL" end,
                 'concluida_em', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."DT_CONCLUSAO" end,
                 'rascunho_em', f."DT_RASCUNHO",
                 'reserva', case when f."DT_RESERVA_EXPIRA" > now() then json_build_object(
                   'usuario', f."CO_USUARIO_RESERVA", 'nome', coalesce(uv.nome, uv.email),
                   'desde', f."DT_RESERVA", 'expira', f."DT_RESERVA_EXPIRA") end) end)
             order by a."CO_VAGA", a."TP_SITUACAO" = 'ELIMINADO', a."NU_POSICAO", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_FICHA_ANALISE" f
          on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_PERFIL_USUARIO" ur on ur.user_id = f."CO_USUARIO_RESPONSAVEL"
        left join public."TB_PERFIL_USUARIO" uv on uv.user_id = f."CO_USUARIO_RESERVA"
       where a."CO_MONITORAMENTO" = p_edital
         and (not v_so_minhas_vagas or private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, a."CO_VAGA"))), '[]'::json)
  );
end;
$function$;
comment on function public.obter_fila_avaliacao(uuid) is
  'A fila da avaliação documental do edital (json): papel de quem está logado (coordena, pode pegar), a distribuição da regra, cada inscrito da pré-classificação (com a entrada no lote e, desde 20261007200000, o motivo da decisão da coordenação quando entrou por decisão) com a ficha (situação, responsável, reserva vigente, versão, rascunho e, concluída, resultado e nota; nome do candidato, sem CPF nem contato), as vagas, os analistas com as pendentes, quantos do lote ainda estão sem ficha e os filtros salvos de quem chama. O analista vê só as vagas que analisa. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

-- 12. Documentos oficiais: o motivo de quem entrou por decisão (Lista Provisória e Lote) ------
create or replace function public.registrar_lista_pre_classificacao(p_edital uuid, p_tipo text, p_lote integer default null)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_resultado jsonb;
  v_id uuid;
  v_elegiveis integer;
  v_eliminados integer;
begin
  if private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR' then
    v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3);
  else
    v_area := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  end if;
  if p_tipo is null or p_tipo not in ('PROVISORIA', 'LOTE') then
    raise exception 'Tipo de lista inválido: PROVISORIA ou LOTE' using errcode = '22023';
  end if;
  if p_lote is not null and (p_tipo <> 'LOTE' or p_lote not between 1 and 999) then
    raise exception 'Número do lote só na lista LOTE, de 1 a 999' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Cadastre a regra de classificação do edital antes de registrar a lista.' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = p_edital) then
    raise exception 'O edital ainda não tem pré-classificação: rode o Recalcular.' using errcode = '22023';
  end if;
  if p_lote is not null and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                         where a."CO_MONITORAMENTO" = p_edital and a."NU_LOTE" = p_lote) then
    raise exception 'Não há ninguém no lote %.', p_lote using errcode = '22023';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;

  -- O retrato (formato de src/lib/classificacao/exportacao.js): só nome, posição, nota e motivo.
  select jsonb_build_object(
           'schema', 1,
           'tipo', p_tipo,
           'edital', jsonb_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade),
           'regra_versao', v_regra."NU_VERSAO_VIGENTE",
           'regra_analise_versao', (select max(a."NU_VERSAO_REGRA") from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = p_edital),
           'lote', p_lote,
           'casas', 1,
           'modalidades', '[]'::jsonb,
           'vagas', coalesce(jsonb_agg(jsonb_build_object(
             'chave', pv."CO_VAGA",
             'codigo', pv."CO_VAGA",
             'cargo', pv."NO_CARGO",
             'lotacao', pv."NO_LOTACAO",
             'cabecalho', concat_ws(' - ', 'VAGA ' || pv."CO_VAGA", pv."NO_CARGO", pv."NO_LOTACAO",
                            case when coalesce(pv."QT_VAGA_IMEDIATA", 0) = 0 and pv."ST_CADASTRO_RESERVA" = 'S' then 'Cadastro reserva'
                                 when pv."QT_VAGA_IMEDIATA" is null then null
                                 else pv."QT_VAGA_IMEDIATA" || case when pv."QT_VAGA_IMEDIATA" = 1 then ' vaga' else ' vagas' end
                                      || case when pv."ST_CADASTRO_RESERVA" = 'S' then ' + CR' else '' end end),
             'total', pv."QT_VAGA_IMEDIATA",
             'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
             'geral', coalesce((
               select jsonb_agg(jsonb_build_object('posicao', a."NU_POSICAO", 'nome', c."NO_CANDIDATO",
                                                   'nota', a."VL_NOTA_ORDEM", 'modalidades', jsonb_build_array(a."NO_MODALIDADE"),
                                                   'situacao', a."TP_SITUACAO", 'lote', a."NU_LOTE",
                                                   -- Quem entrou no lote por decisão da coordenação: o motivo (nota no documento).
                                                   'decisao', case when a."TP_ENTRADA_LOTE" = 'DECISAO' then a."DS_MOTIVO_ENTRADA" end)
                                order by a."NU_POSICAO")
                 from public."TB_PRE_CLASSIFICACAO" a
                 join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
                where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = pv."CO_VAGA"
                  and case when p_tipo = 'PROVISORIA' then a."TP_SITUACAO" <> 'ELIMINADO'
                           else a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and (p_lote is null or a."NU_LOTE" = p_lote) end), '[]'::jsonb),
             'listas', '{}'::jsonb,
             'eliminados', case when p_tipo = 'PROVISORIA' then coalesce((
               select jsonb_agg(jsonb_build_object('nome', c."NO_CANDIDATO", 'motivo', a."DS_MOTIVO_ELIMINACAO", 'detalhe', '')
                                order by c."NO_CANDIDATO")
                 from public."TB_PRE_CLASSIFICACAO" a
                 join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
                where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = pv."CO_VAGA" and a."TP_SITUACAO" = 'ELIMINADO'), '[]'::jsonb)
               else '[]'::jsonb end)
             order by pv."CO_VAGA"), '[]'::jsonb),
           'avisos', '[]'::jsonb,
           'pendencias', '[]'::jsonb)
    into v_resultado
    from public."TB_PRE_CLASSIF_VAGA" pv
   where pv."CO_MONITORAMENTO" = p_edital;

  select coalesce(sum(jsonb_array_length(v -> 'geral')), 0), coalesce(sum(jsonb_array_length(v -> 'eliminados')), 0)
    into v_elegiveis, v_eliminados
    from jsonb_array_elements(v_resultado -> 'vagas') v;
  v_resultado := v_resultado || jsonb_build_object('totais', jsonb_build_object(
    'elegiveis', v_elegiveis, 'eliminados', v_eliminados, 'avisos', 0, 'pendencias', 0));

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", v_resultado,
          encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'), v_elegiveis, v_eliminados, 0, 0, (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return json_build_object('lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_id), 'resultado', v_resultado);
end;
$function$;
comment on function public.registrar_lista_pre_classificacao(uuid, text, integer) is
  'Registra a lista PROVISORIA (por vaga: classificação, nome e nota da ART; os eliminados automáticos com o motivo) ou LOTE (os do lote; com p_lote, só aquele lote — uma reposição) em TB_LISTA_CLASSIFICACAO, montando o retrato a partir de TB_PRE_CLASSIFICACAO (sem conta: só leitura e ordem já gravadas; desde 20261007200000, quem entrou no lote por decisão da coordenação leva o motivo em "decisao", que o documento mostra em nota). Exige a coordenação da avaliação do edital ou Editor na Classificação, a regra de classificação do edital e a pré-classificação já gravada. Devolve os metadados e o retrato.';
revoke all on function public.registrar_lista_pre_classificacao(uuid, text, integer) from public, anon;
grant execute on function public.registrar_lista_pre_classificacao(uuid, text, integer) to authenticated;

commit;
