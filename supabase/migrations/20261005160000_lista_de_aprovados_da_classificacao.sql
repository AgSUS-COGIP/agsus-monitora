/*
  LISTA DE APROVADOS PUBLICADA DA CLASSIFICAÇÃO (FONTE ÚNICA)

  Até aqui havia duas bases de candidatos que não conversavam:
    - a Lista de aprovados (TB_LISTA_APROVADO + TB_CANDIDATO_APROVADO), só pela
      importação de XLSX, com posição e nota digitadas; status, matrícula e sub
      judice ficam nela, e a Seleção e os KPIs de contratados a leem;
    - a Classificação (20261002150000), que calcula posição e nota pela regra
      do edital a partir das análises e entrevistas e registra a lista FINAL em
      TB_LISTA_CLASSIFICACAO — sem alimentar nada.
  Decisão (05/10/2026, com o responsável pelo sistema): a lista FINAL da
  Classificação vira a fonte da Lista de aprovados. O XLSX fica para editais
  sem análise no sistema.

  O QUE ENTRA
    TB_LISTA_APROVADO."TP_ORIGEM" ('XLSX' | 'CLASSIFICACAO') e
      "CO_LISTA_CLASSIFICACAO" (a lista FINAL publicada). As listas que já
      existem ficam 'XLSX'.
    TB_CANDIDATO_APROVADO."CO_ANALISE_CURRICULAR" (a análise do candidato),
      "TP_SITUACAO_CLASSIFICACAO" ('VAGA' dentro das vagas | 'CR' cadastro
      reserva) e "CO_CANDIDATO_ANTERIOR" (de quem, na lista anterior, vieram
      status, sub judice e anexos). As colunas legadas, em minúsculas, não mudam.
    TH_PUBLICACAO_APROVADO: cada lista que entra em vigor — publicada da
      Classificação (quem, quando, lista de classificação, versão da regra,
      hash, quantos entram/saem/mudam/preservados, os vínculos e quem ficou
      para revisão) ou importada por XLSX (com o motivo quando substitui uma
      lista da Classificação).
    publicar_lista_aprovados_da_classificacao(p_lista_classificacao,
      p_lista_vigente, p_vinculos): cria a nova lista vigente do edital a
      partir do retrato FINAL; a anterior fica inativa e no histórico (nada é
      apagado). Classificação >= editor, a área e o recorte do edital.
    obter_publicacao_lista_aprovados(p_edital, p_com_candidatos): a lista
      vigente (origem e, se pedido, os candidatos para a prévia), o último
      resultado final da Classificação e o histórico das publicações.
    importar_lista_aprovados ganha p_motivo: substituir pela planilha uma lista
      publicada da Classificação exige motivo (3 a 500 caracteres); toda
      importação vai para o histórico. Editais antigos continuam importando.
    listar_listas_aprovados devolve também a origem e a lista de classificação.

  O QUE A PUBLICAÇÃO PRESERVA
    O casamento das pessoas (quem da lista vigente é quem entra) é feito na
    tela (src/lib/publicacao-de-aprovados.js: pela análise; nas listas de
    planilha, pelo nome normalizado no edital, desempatando pela vaga; o que
    não casa vai para a revisão manual) e chega aqui em p_vinculos. O banco
    confere cada vínculo (candidato da lista vigente, análise da lista FINAL,
    um para um) e:
      - leva status, processo SEI, matrícula, sub judice e anexos de quem casou;
        quem tinha nota/modalidade alterada por decisão judicial continua com a
        nota e a modalidade da decisão — a da Classificação vira a "original"
        (desfazer volta a ela) — e é recolocado na classificação;
      - leva, como sub judice, quem foi incluído por decisão judicial e não está
        no resultado (não se perde a decisão);
      - quem não casou e tinha status, matrícula ou processo fica em
        DS_PENDENCIA da publicação, para revisão — e continua na lista anterior,
        inativa, com tudo o que tinha.
    Posição: a da lista geral; quem só aparece na lista da modalidade, a dela.
    Modalidade: a declarada na análise; sem ela, os nomes das modalidades da
    lista; senão, Ampla Concorrência.

  CPF: TB_CANDIDATO_APROVADO não guarda CPF nem código de inscrição (o XLSX não
  traz), então o casamento das listas de planilha é pelo nome.

  Rollback: supabase/rollback/20261005160000_lista_de_aprovados_da_classificacao.sql
  Ensaio:   supabase/ensaios/20261005160000_lista_de_aprovados_da_classificacao.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.obter_classificacao_do_edital(uuid)') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
  if to_regprocedure('public.alterar_candidato_sub_judice(uuid, numeric, text, text, text)') is null then
    raise exception 'Aplique antes 20261001150000_sub_judice_alteracao.sql.';
  end if;
  if to_regprocedure('private.autor_da_sessao()') is null then
    raise exception 'Aplique antes 20260928180000_autoria_e_trava_da_lista_de_aprovados.sql.';
  end if;
end;
$$;

-- 1. A origem da lista ---------------------------------------------------------------------
alter table public."TB_LISTA_APROVADO"
  add column "TP_ORIGEM" varchar(15) not null default 'XLSX',
  add column "CO_LISTA_CLASSIFICACAO" uuid,
  add constraint "CK_LISTAAPROVADO_TPORIGEM" check ("TP_ORIGEM" in ('XLSX', 'CLASSIFICACAO')),
  add constraint "CK_LISTAAPROVADO_ORIGEM" check (("TP_ORIGEM" = 'CLASSIFICACAO') = ("CO_LISTA_CLASSIFICACAO" is not null)),
  add constraint "FK_LISTACLASSIF_LISTAAPROVADO" foreign key ("CO_LISTA_CLASSIFICACAO")
    references public."TB_LISTA_CLASSIFICACAO" ("CO_LISTA_CLASSIFICACAO");
comment on column public."TB_LISTA_APROVADO"."TP_ORIGEM" is 'De onde veio a lista: XLSX (planilha importada, posição e nota digitadas) ou CLASSIFICACAO (resultado final publicado da aba Classificação).';
comment on column public."TB_LISTA_APROVADO"."CO_LISTA_CLASSIFICACAO" is 'Lista FINAL da Classificação publicada como esta lista (TB_LISTA_CLASSIFICACAO); nula nas listas de planilha.';
comment on constraint "CK_LISTAAPROVADO_TPORIGEM" on public."TB_LISTA_APROVADO" is 'Origens válidas.';
comment on constraint "CK_LISTAAPROVADO_ORIGEM" on public."TB_LISTA_APROVADO" is 'Lista da Classificação tem a lista de classificação; a de planilha, não.';
comment on constraint "FK_LISTACLASSIF_LISTAAPROVADO" on public."TB_LISTA_APROVADO" is 'Resultado final da Classificação que originou a lista.';
create index "IN_FKLISTAAPROV_LISTACLASSIF" on public."TB_LISTA_APROVADO" ("CO_LISTA_CLASSIFICACAO")
  where "CO_LISTA_CLASSIFICACAO" is not null;
comment on index public."IN_FKLISTAAPROV_LISTACLASSIF" is 'Chave estrangeira para TB_LISTA_CLASSIFICACAO.';

-- 2. O candidato: a análise, a situação e de quem veio ------------------------------------
alter table public."TB_CANDIDATO_APROVADO"
  add column "CO_ANALISE_CURRICULAR" uuid,
  add column "TP_SITUACAO_CLASSIFICACAO" varchar(4),
  add column "CO_CANDIDATO_ANTERIOR" uuid,
  add constraint "FK_ANALISECURRIC_CANDAPROVADO" foreign key ("CO_ANALISE_CURRICULAR")
    references public."TB_ANALISE_CURRICULAR" (id),
  add constraint "FK_CANDAPROVADO_CANDANTERIOR" foreign key ("CO_CANDIDATO_ANTERIOR")
    references public."TB_CANDIDATO_APROVADO" (id),
  add constraint "CK_CANDAPROVADO_TPSITUACAO" check ("TP_SITUACAO_CLASSIFICACAO" is null or "TP_SITUACAO_CLASSIFICACAO" in ('VAGA', 'CR'));
comment on column public."TB_CANDIDATO_APROVADO"."CO_ANALISE_CURRICULAR" is 'Análise curricular do candidato (TB_ANALISE_CURRICULAR.id), nas listas publicadas da Classificação; nula nas de planilha.';
comment on column public."TB_CANDIDATO_APROVADO"."TP_SITUACAO_CLASSIFICACAO" is 'No resultado final da Classificação: VAGA (dentro das vagas) ou CR (cadastro reserva); nula nas listas de planilha.';
comment on column public."TB_CANDIDATO_APROVADO"."CO_CANDIDATO_ANTERIOR" is 'O mesmo candidato na lista anterior do edital, de onde vieram status, matrícula, processo, sub judice e anexos na publicação.';
comment on constraint "FK_ANALISECURRIC_CANDAPROVADO" on public."TB_CANDIDATO_APROVADO" is 'Análise do candidato (CURRIC = CURRICULAR).';
comment on constraint "FK_CANDAPROVADO_CANDANTERIOR" on public."TB_CANDIDATO_APROVADO" is 'O candidato na lista anterior (CAND = CANDIDATO).';
comment on constraint "CK_CANDAPROVADO_TPSITUACAO" on public."TB_CANDIDATO_APROVADO" is 'Situações do resultado final.';
create index "IN_FKCANDAPROVADO_ANALISE" on public."TB_CANDIDATO_APROVADO" ("CO_ANALISE_CURRICULAR")
  where "CO_ANALISE_CURRICULAR" is not null;
comment on index public."IN_FKCANDAPROVADO_ANALISE" is 'Chave estrangeira para TB_ANALISE_CURRICULAR.';
create index "IN_FKCANDAPROVADO_CANDANTERIOR" on public."TB_CANDIDATO_APROVADO" ("CO_CANDIDATO_ANTERIOR")
  where "CO_CANDIDATO_ANTERIOR" is not null;
comment on index public."IN_FKCANDAPROVADO_CANDANTERIOR" is 'Chave estrangeira para o candidato da lista anterior.';

-- 3. Histórico das publicações ---------------------------------------------------------------
create table public."TH_PUBLICACAO_APROVADO" (
  "CO_PUBLICACAO" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_LISTA_APROVADO" uuid not null,
  "CO_LISTA_APROVADO_ANTERIOR" uuid,
  "TP_ORIGEM" varchar(15) not null,
  "CO_LISTA_CLASSIFICACAO" uuid,
  "CO_REGRA_CLASSIFICACAO" uuid,
  "NU_VERSAO_REGRA" integer,
  "DS_HASH_CLASSIFICACAO" varchar(64),
  "QT_CANDIDATO" integer not null default 0,
  "QT_ENTRA" integer not null default 0,
  "QT_SAI" integer not null default 0,
  "QT_MUDA_POSICAO" integer not null default 0,
  "QT_PRESERVADO" integer not null default 0,
  "QT_SUB_JUDICE_MANTIDO" integer not null default 0,
  "DS_VINCULO" jsonb not null default '[]'::jsonb,
  "DS_PENDENCIA" jsonb not null default '[]'::jsonb,
  "DS_MOTIVO" text,
  "CO_USUARIO" uuid not null,
  "DS_EMAIL_USUARIO" varchar(320),
  "NO_USUARIO" varchar(255),
  "DT_PUBLICACAO" timestamptz not null default now(),
  constraint "PK_TH_PUBLICACAO_APROVADO" primary key ("CO_PUBLICACAO"),
  constraint "FK_MONITORAMENTO_PUBAPROVADO" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_LISTAAPROVADO_PUBAPROVADO" foreign key ("CO_LISTA_APROVADO") references public."TB_LISTA_APROVADO" (id),
  constraint "FK_LISTAANTERIOR_PUBAPROVADO" foreign key ("CO_LISTA_APROVADO_ANTERIOR") references public."TB_LISTA_APROVADO" (id),
  constraint "FK_LISTACLASSIF_PUBAPROVADO" foreign key ("CO_LISTA_CLASSIFICACAO") references public."TB_LISTA_CLASSIFICACAO" ("CO_LISTA_CLASSIFICACAO"),
  constraint "FK_HISTREGRACLASSIF_PUBAPROV" foreign key ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA")
    references public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO"),
  constraint "CK_PUBAPROVADO_TPORIGEM" check ("TP_ORIGEM" in ('XLSX', 'CLASSIFICACAO')),
  constraint "CK_PUBAPROVADO_ORIGEM" check (
    ("TP_ORIGEM" = 'CLASSIFICACAO') = ("CO_LISTA_CLASSIFICACAO" is not null)
    and ("TP_ORIGEM" = 'XLSX' or ("CO_REGRA_CLASSIFICACAO" is not null and "NU_VERSAO_REGRA" is not null and "DS_HASH_CLASSIFICACAO" is not null))),
  constraint "CK_PUBAPROVADO_QUANTIDADES" check (
    "QT_CANDIDATO" >= 0 and "QT_ENTRA" >= 0 and "QT_SAI" >= 0 and "QT_MUDA_POSICAO" >= 0
    and "QT_PRESERVADO" >= 0 and "QT_SUB_JUDICE_MANTIDO" >= 0),
  constraint "CK_PUBAPROVADO_JSON" check (jsonb_typeof("DS_VINCULO") = 'array' and jsonb_typeof("DS_PENDENCIA") = 'array'),
  constraint "CK_PUBAPROVADO_DSMOTIVO" check ("DS_MOTIVO" is null or length("DS_MOTIVO") between 3 and 500)
);
comment on table public."TH_PUBLICACAO_APROVADO" is 'Cada lista de aprovados que entrou em vigor num edital: publicada do resultado final da Classificação ou importada por XLSX — quem, quando, de onde, o que mudou em relação à anterior e quem ficou para revisão.';
comment on column public."TH_PUBLICACAO_APROVADO"."CO_PUBLICACAO" is 'Identificador da publicação.';
comment on column public."TH_PUBLICACAO_APROVADO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TH_PUBLICACAO_APROVADO"."CO_LISTA_APROVADO" is 'Lista que entrou em vigor.';
comment on column public."TH_PUBLICACAO_APROVADO"."CO_LISTA_APROVADO_ANTERIOR" is 'Lista que estava em vigor e ficou inativa (histórico); nula na primeira lista do edital.';
comment on column public."TH_PUBLICACAO_APROVADO"."TP_ORIGEM" is 'CLASSIFICACAO (resultado final publicado) ou XLSX (planilha importada).';
comment on column public."TH_PUBLICACAO_APROVADO"."CO_LISTA_CLASSIFICACAO" is 'Lista FINAL da Classificação publicada.';
comment on column public."TH_PUBLICACAO_APROVADO"."CO_REGRA_CLASSIFICACAO" is 'Regra de classificação da lista publicada.';
comment on column public."TH_PUBLICACAO_APROVADO"."NU_VERSAO_REGRA" is 'Versão da regra usada na lista publicada.';
comment on column public."TH_PUBLICACAO_APROVADO"."DS_HASH_CLASSIFICACAO" is 'SHA-256 do retrato da lista publicada (TB_LISTA_CLASSIFICACAO.DS_HASH).';
comment on column public."TH_PUBLICACAO_APROVADO"."QT_CANDIDATO" is 'Candidatos na lista que entrou em vigor.';
comment on column public."TH_PUBLICACAO_APROVADO"."QT_ENTRA" is 'Candidatos que não estavam na lista anterior (só na publicação da Classificação).';
comment on column public."TH_PUBLICACAO_APROVADO"."QT_SAI" is 'Candidatos da lista anterior que não estão na nova (fora os sub judice mantidos).';
comment on column public."TH_PUBLICACAO_APROVADO"."QT_MUDA_POSICAO" is 'Candidatos que mudaram de posição ou de vaga.';
comment on column public."TH_PUBLICACAO_APROVADO"."QT_PRESERVADO" is 'Candidatos que levaram da lista anterior status, matrícula, processo ou sub judice.';
comment on column public."TH_PUBLICACAO_APROVADO"."QT_SUB_JUDICE_MANTIDO" is 'Incluídos por decisão judicial que não estão no resultado e foram mantidos como sub judice.';
comment on column public."TH_PUBLICACAO_APROVADO"."DS_VINCULO" is 'Vínculos aplicados: [{anterior, novo, analise_id, forma}] (forma ANALISE, NOME, NOME_VAGA ou MANUAL).';
comment on column public."TH_PUBLICACAO_APROVADO"."DS_PENDENCIA" is 'Quem saiu com status, matrícula ou processo e não casou com ninguém da lista nova: para revisão manual (continua na lista anterior).';
comment on column public."TH_PUBLICACAO_APROVADO"."DS_MOTIVO" is 'Motivo informado ao substituir pela planilha uma lista publicada da Classificação.';
comment on column public."TH_PUBLICACAO_APROVADO"."CO_USUARIO" is 'Quem publicou ou importou (auth.users.id).';
comment on column public."TH_PUBLICACAO_APROVADO"."DS_EMAIL_USUARIO" is 'E-mail de quem publicou, copiado da sessão.';
comment on column public."TH_PUBLICACAO_APROVADO"."NO_USUARIO" is 'Nome de quem publicou, copiado do perfil.';
comment on column public."TH_PUBLICACAO_APROVADO"."DT_PUBLICACAO" is 'Quando.';
comment on constraint "FK_MONITORAMENTO_PUBAPROVADO" on public."TH_PUBLICACAO_APROVADO" is 'Edital da publicação (PUBAPROVADO = PUBLICACAO_APROVADO).';
comment on constraint "FK_LISTAAPROVADO_PUBAPROVADO" on public."TH_PUBLICACAO_APROVADO" is 'Lista que entrou em vigor.';
comment on constraint "FK_LISTAANTERIOR_PUBAPROVADO" on public."TH_PUBLICACAO_APROVADO" is 'Lista que saiu de vigor.';
comment on constraint "FK_LISTACLASSIF_PUBAPROVADO" on public."TH_PUBLICACAO_APROVADO" is 'Lista FINAL da Classificação publicada.';
comment on constraint "FK_HISTREGRACLASSIF_PUBAPROV" on public."TH_PUBLICACAO_APROVADO" is 'Versão da regra da lista publicada.';
comment on constraint "CK_PUBAPROVADO_TPORIGEM" on public."TH_PUBLICACAO_APROVADO" is 'Origens válidas.';
comment on constraint "CK_PUBAPROVADO_ORIGEM" on public."TH_PUBLICACAO_APROVADO" is 'Publicação da Classificação tem lista, regra, versão e hash.';
comment on constraint "CK_PUBAPROVADO_QUANTIDADES" on public."TH_PUBLICACAO_APROVADO" is 'Quantidades não negativas.';
comment on constraint "CK_PUBAPROVADO_JSON" on public."TH_PUBLICACAO_APROVADO" is 'Vínculos e pendências são arrays json.';
comment on constraint "CK_PUBAPROVADO_DSMOTIVO" on public."TH_PUBLICACAO_APROVADO" is 'Motivo entre 3 e 500 caracteres.';
create index "IN_PUBAPROVADO_EDITAL_DATA" on public."TH_PUBLICACAO_APROVADO" ("CO_MONITORAMENTO", "DT_PUBLICACAO" desc);
comment on index public."IN_PUBAPROVADO_EDITAL_DATA" is 'Histórico do edital, do mais recente.';
create index "IN_FKPUBAPROVADO_LISTA" on public."TH_PUBLICACAO_APROVADO" ("CO_LISTA_APROVADO");
comment on index public."IN_FKPUBAPROVADO_LISTA" is 'Chave estrangeira para TB_LISTA_APROVADO.';
create index "IN_FKPUBAPROVADO_ANTERIOR" on public."TH_PUBLICACAO_APROVADO" ("CO_LISTA_APROVADO_ANTERIOR");
comment on index public."IN_FKPUBAPROVADO_ANTERIOR" is 'Chave estrangeira para a lista anterior.';
create index "IN_FKPUBAPROVADO_LISTACLASSIF" on public."TH_PUBLICACAO_APROVADO" ("CO_LISTA_CLASSIFICACAO");
comment on index public."IN_FKPUBAPROVADO_LISTACLASSIF" is 'Chave estrangeira para TB_LISTA_CLASSIFICACAO.';
create index "IN_FKPUBAPROVADO_REGRA" on public."TH_PUBLICACAO_APROVADO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA");
comment on index public."IN_FKPUBAPROVADO_REGRA" is 'Chave estrangeira para TH_REGRA_CLASSIFICACAO.';
alter table public."TH_PUBLICACAO_APROVADO" enable row level security;
revoke all on public."TH_PUBLICACAO_APROVADO" from public, anon, authenticated;

-- 4. Publicar o resultado final como lista de aprovados ------------------------------------
/*
  p_lista_vigente: a lista de aprovados que a prévia mostrou (nula se o edital
  não tinha); outra = 40001 (alguém mudou a lista no meio).
  p_vinculos: [{candidato_id, analise_id, forma}] — quem da lista vigente é
  quem entra (src/lib/publicacao-de-aprovados.js). Conferidos aqui.
*/
create function public.publicar_lista_aprovados_da_classificacao(
  p_lista_classificacao uuid,
  p_lista_vigente uuid,
  p_vinculos jsonb default '[]'::jsonb
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_l public."TB_LISTA_CLASSIFICACAO";
  v_anterior public."TB_LISTA_APROVADO";
  v_edital text;
  v_vinculos jsonb := coalesce(p_vinculos, '[]'::jsonb);
  v_uid uuid := (select auth.uid());
  v_autor record;
  v_nova uuid;
  v_publicacao uuid;
  v_qt integer;
  v_entra integer;
  v_sai integer;
  v_muda integer;
  v_preservado integer;
  v_mantido integer;
  v_pendencias jsonb;
  v_aplicados jsonb;
  v_c record;
begin
  select * into v_l from public."TB_LISTA_CLASSIFICACAO" where "CO_LISTA_CLASSIFICACAO" = p_lista_classificacao;
  if v_l."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista de classificação não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_l."CO_MONITORAMENTO", 2);
  if v_l."TP_LISTA" <> 'FINAL' then
    raise exception 'Só o resultado final vira lista de aprovados.' using errcode = '22023';
  end if;
  if v_l."QT_PENDENCIA" > 0 then
    raise exception 'A lista tem empate pendente de sorteio ou decisão; resolva e gere de novo.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public."TB_LISTA_CLASSIFICACAO" o
     where o."CO_MONITORAMENTO" = v_l."CO_MONITORAMENTO" and o."TP_LISTA" = 'FINAL'
       and o."DT_GERACAO" > v_l."DT_GERACAO"
  ) then
    raise exception 'Há um resultado final gerado depois deste; publique o mais recente.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_vinculos) is distinct from 'array' then
    raise exception 'Vínculos inválidos.' using errcode = '22023';
  end if;
  v_edital := v_l."CO_MONITORAMENTO"::text;

  select * into v_anterior from public."TB_LISTA_APROVADO"
   where edital_id = v_edital and vigente is true for update;
  if v_anterior.id is distinct from p_lista_vigente then
    raise exception 'A lista de aprovados do edital mudou desde a prévia; abra a publicação de novo.' using errcode = '40001';
  end if;
  if v_anterior."CO_LISTA_CLASSIFICACAO" = p_lista_classificacao then
    raise exception 'Este resultado final já é a lista de aprovados vigente.' using errcode = '22023';
  end if;

  -- Os candidatos do resultado final: um por análise (a posição da geral; quem
  -- só está na lista da modalidade, a dela; a primeira vaga em que aparece).
  create temporary table if not exists tmp_publicacao_novo (
    analise_id uuid, nome text, cargo text, codigo_vaga text, posicao integer,
    nota numeric, situacao text, modalidade text, vaga_ordem bigint
  ) on commit drop;
  truncate pg_temp.tmp_publicacao_novo;
  insert into pg_temp.tmp_publicacao_novo
  select distinct on (x.analise_id)
         x.analise_id, x.nome,
         coalesce(x.cargo_vaga, nullif(btrim(a.nome_vaga), ''), 'Sem cargo'),
         coalesce(x.codigo_vaga, nullif(btrim(a.codigo_vaga), ''), x.chave),
         x.posicao, x.nota, x.situacao,
         coalesce(nullif(btrim(a.modalidade_concorrencia), ''), x.modalidades, 'Ampla Concorrência'),
         x.vaga_ordem
    from (
      select (f.linha ->> 'analise_id')::uuid as analise_id,
             btrim(f.linha ->> 'nome') as nome,
             nullif(btrim(v.vaga ->> 'cargo'), '') as cargo_vaga,
             nullif(btrim(v.vaga ->> 'codigo'), '') as codigo_vaga,
             v.vaga ->> 'chave' as chave,
             case when jsonb_typeof(f.linha -> 'posicao') = 'number' then (f.linha ->> 'posicao')::numeric::integer end as posicao,
             case when jsonb_typeof(f.linha -> 'nota') = 'number' then (f.linha ->> 'nota')::numeric end as nota,
             case when f.linha ->> 'situacao' in ('VAGA', 'CR') then f.linha ->> 'situacao' end as situacao,
             (select string_agg(coalesce(md.valor ->> 'nome', c.codigo), '; ' order by c.ordem)
                from jsonb_array_elements_text(
                       case when jsonb_typeof(f.linha -> 'modalidades') = 'array' then f.linha -> 'modalidades' else '[]'::jsonb end
                     ) with ordinality c(codigo, ordem)
                left join jsonb_array_elements(coalesce(v_l."DS_RESULTADO" -> 'modalidades', '[]'::jsonb)) md(valor)
                  on md.valor ->> 'codigo' = c.codigo
               where c.codigo <> 'AC') as modalidades,
             v.ordem as vaga_ordem,
             f.fonte
        from jsonb_array_elements(v_l."DS_RESULTADO" -> 'vagas') with ordinality v(vaga, ordem)
        cross join lateral (
          select 0 as fonte, g.linha
            from jsonb_array_elements(coalesce(v.vaga -> 'geral', '[]'::jsonb)) g(linha)
          union all
          select 1, m.linha
            from jsonb_each(coalesce(v.vaga -> 'listas', '{}'::jsonb)) e(codigo, linhas)
            cross join lateral jsonb_array_elements(e.linhas) m(linha)
        ) f
       where f.linha ->> 'analise_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) x
    left join public."TB_ANALISE_CURRICULAR" a on a.id = x.analise_id
   order by x.analise_id, x.vaga_ordem, x.fonte, x.posicao nulls last;

  select count(*) into v_qt from pg_temp.tmp_publicacao_novo;
  if v_qt = 0 then
    raise exception 'O resultado final não tem candidatos para publicar.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_publicacao_novo n
              where n.posicao is null or n.posicao < 1 or n.nota is null or n.nota < 0
                 or nullif(n.nome, '') is null) then
    raise exception 'O resultado final tem candidato sem posição, nota ou nome; gere de novo.' using errcode = '22023';
  end if;

  -- Os vínculos, conferidos.
  create temporary table if not exists tmp_publicacao_vinculo (
    candidato_id uuid, analise_id uuid, forma text
  ) on commit drop;
  truncate pg_temp.tmp_publicacao_vinculo;
  insert into pg_temp.tmp_publicacao_vinculo
  select (x.valor ->> 'candidato_id')::uuid, (x.valor ->> 'analise_id')::uuid,
         upper(coalesce(nullif(btrim(x.valor ->> 'forma'), ''), 'MANUAL'))
    from jsonb_array_elements(v_vinculos) x(valor);
  if exists (select 1 from pg_temp.tmp_publicacao_vinculo k
              where k.candidato_id is null or k.analise_id is null
                 or k.forma not in ('ANALISE', 'NOME', 'NOME_VAGA', 'MANUAL')) then
    raise exception 'Vínculo inválido.' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct k.candidato_id) or count(*) <> count(distinct k.analise_id)
        from pg_temp.tmp_publicacao_vinculo k) then
    raise exception 'Cada pessoa só pode ser vinculada uma vez.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_publicacao_vinculo k
              where not exists (select 1 from public."TB_CANDIDATO_APROVADO" o
                                 where o.id = k.candidato_id and o.lista_id = v_anterior.id and o.removido_em is null)) then
    raise exception 'Vínculo com candidato que não está na lista vigente.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_publicacao_vinculo k
              where not exists (select 1 from pg_temp.tmp_publicacao_novo n where n.analise_id = k.analise_id)) then
    raise exception 'Vínculo com candidato que não está no resultado final.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_publicacao_vinculo k
               join public."TB_CANDIDATO_APROVADO" o on o.id = k.candidato_id
              where k.forma = 'ANALISE' and o."CO_ANALISE_CURRICULAR" is distinct from k.analise_id) then
    raise exception 'Vínculo pela análise com análise diferente.' using errcode = '22023';
  end if;

  -- O resumo, contra a lista vigente (a mesma conta de resumoDaPublicacao).
  select count(*) filter (where k.analise_id is null) into v_entra
    from pg_temp.tmp_publicacao_novo n
    left join pg_temp.tmp_publicacao_vinculo k on k.analise_id = n.analise_id;
  select count(*) filter (where not o.sub_judice),
         count(*) filter (where o.sub_judice),
         coalesce(jsonb_agg(jsonb_build_object(
           'candidato_id', o.id, 'nome', o.nome, 'cargo', o.cargo, 'codigo_vaga', o.codigo_vaga,
           'classificacao', o.classificacao, 'status', o.status, 'matricula', o.matricula,
           'processo_sei', o.processo_sei) order by o.cargo, o.classificacao nulls last, o.nome)
           filter (where not o.sub_judice
                     and (o.status is not null or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                          or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null)), '[]'::jsonb)
    into v_sai, v_mantido, v_pendencias
    from public."TB_CANDIDATO_APROVADO" o
   where o.lista_id = v_anterior.id and o.removido_em is null
     and not exists (select 1 from pg_temp.tmp_publicacao_vinculo k where k.candidato_id = o.id);
  select count(*) filter (where o.classificacao is distinct from n.posicao
                             or (nullif(btrim(coalesce(o.codigo_vaga, '')), '') is not null
                                 and lower(btrim(o.codigo_vaga)) <> lower(btrim(n.codigo_vaga)))),
         count(*) filter (where o.status is not null or o.sub_judice or o.alterado_judicialmente
                             or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                             or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null),
         coalesce(jsonb_agg(jsonb_build_object('anterior', o.id, 'analise_id', k.analise_id, 'forma', k.forma)
                            order by o.nome), '[]'::jsonb)
    into v_muda, v_preservado, v_aplicados
    from pg_temp.tmp_publicacao_vinculo k
    join public."TB_CANDIDATO_APROVADO" o on o.id = k.candidato_id
    join pg_temp.tmp_publicacao_novo n on n.analise_id = k.analise_id;

  -- A lista anterior sai de vigor (fica no histórico, inativa).
  select * into v_autor from private.autor_da_sessao();
  if v_anterior.id is not null then
    update public."TB_LISTA_APROVADO"
       set vigente = false, ativo = false, substituido_por = v_uid, substituido_em = now(), updated_at = now(),
           "DS_EMAIL_SUBSTITUICAO" = v_autor.email, "NO_USUARIO_SUBSTITUICAO" = v_autor.nome
     where id = v_anterior.id;
  end if;

  insert into public."TB_LISTA_APROVADO" (
    edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por,
    "DS_EMAIL_IMPORTACAO", "NO_USUARIO_IMPORTACAO", "TP_ORIGEM", "CO_LISTA_CLASSIFICACAO"
  ) values (
    v_edital, true, true, 'Classificação — resultado final (regra v' || v_l."NU_VERSAO_REGRA" || ')', '',
    v_uid, v_autor.email, v_autor.nome, 'CLASSIFICACAO', p_lista_classificacao
  ) returning id into v_nova;

  -- Quem entra, com o que é da lista de aprovados de quem casou.
  insert into public."TB_CANDIDATO_APROVADO" (
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    status, processo_sei, matricula, sub_judice, alterado_judicialmente,
    nota_original, modalidade_original, classificacao_original, sub_judice_original,
    "CO_ANALISE_CURRICULAR", "TP_SITUACAO_CLASSIFICACAO", "CO_CANDIDATO_ANTERIOR",
    created_by, updated_by
  )
  select v_nova, n.codigo_vaga, n.cargo, n.posicao,
         case when o.alterado_judicialmente then o.nota else n.nota end,
         n.nome,
         case when o.alterado_judicialmente then coalesce(o.modalidade, n.modalidade) else n.modalidade end,
         o.status, o.processo_sei, o.matricula,
         coalesce(o.sub_judice, false), coalesce(o.alterado_judicialmente, false),
         case when o.alterado_judicialmente then n.nota end,
         case when o.alterado_judicialmente then n.modalidade end,
         case when o.alterado_judicialmente then n.posicao end,
         case when o.alterado_judicialmente then false end,
         n.analise_id, n.situacao, o.id, v_uid, v_uid
    from pg_temp.tmp_publicacao_novo n
    left join pg_temp.tmp_publicacao_vinculo k on k.analise_id = n.analise_id
    left join public."TB_CANDIDATO_APROVADO" o on o.id = k.candidato_id
   order by n.vaga_ordem, n.posicao, n.nome;

  -- Incluídos por decisão judicial que não estão no resultado: continuam sub judice.
  insert into public."TB_CANDIDATO_APROVADO" (
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    status, processo_sei, matricula, sub_judice, alterado_judicialmente,
    nota_original, modalidade_original, classificacao_original, sub_judice_original,
    "CO_ANALISE_CURRICULAR", "CO_CANDIDATO_ANTERIOR", created_by, updated_by
  )
  select v_nova, o.codigo_vaga, o.cargo, null, o.nota, o.nome, o.modalidade,
         o.status, o.processo_sei, o.matricula, true, o.alterado_judicialmente,
         o.nota_original, o.modalidade_original, o.classificacao_original, o.sub_judice_original,
         o."CO_ANALISE_CURRICULAR", o.id, v_uid, v_uid
    from public."TB_CANDIDATO_APROVADO" o
   where o.lista_id = v_anterior.id and o.removido_em is null and o.sub_judice
     and not exists (select 1 from pg_temp.tmp_publicacao_vinculo k where k.candidato_id = o.id);

  -- Os anexos vão junto (cópia; os da lista anterior ficam onde estão).
  insert into public."TB_ANEXO_CANDIDATO_APROVADO" (
    "CO_CANDIDATO", "NO_ARQUIVO", "QT_TAMANHO_BYTES", "IM_ARQUIVO", "CO_USUARIO_INCLUSAO", "DT_INCLUSAO"
  )
  select c.id, x."NO_ARQUIVO", x."QT_TAMANHO_BYTES", x."IM_ARQUIVO", x."CO_USUARIO_INCLUSAO", x."DT_INCLUSAO"
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_ANEXO_CANDIDATO_APROVADO" x on x."CO_CANDIDATO" = c."CO_CANDIDATO_ANTERIOR"
   where c.lista_id = v_nova;

  -- Sub judice com nota da decisão ou incluído: recoloca pela nota, como a lista faz.
  for v_c in
    select c.id, coalesce(c.modalidade_original, c.modalidade) as modalidade_antes
      from public."TB_CANDIDATO_APROVADO" c
     where c.lista_id = v_nova
       and (c.alterado_judicialmente
            or (c."CO_CANDIDATO_ANTERIOR" is not null
                and not exists (select 1 from pg_temp.tmp_publicacao_vinculo k
                                 where k.candidato_id = c."CO_CANDIDATO_ANTERIOR")))
     order by c.nota desc, c.nome
  loop
    perform private."FC_RECOLOCAR_NA_CLASSIFICACAO"(v_c.id, v_c.modalidade_antes);
  end loop;

  select count(*) into v_qt from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_nova;

  insert into public."TH_PUBLICACAO_APROVADO" (
    "CO_MONITORAMENTO", "CO_LISTA_APROVADO", "CO_LISTA_APROVADO_ANTERIOR", "TP_ORIGEM",
    "CO_LISTA_CLASSIFICACAO", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_HASH_CLASSIFICACAO",
    "QT_CANDIDATO", "QT_ENTRA", "QT_SAI", "QT_MUDA_POSICAO", "QT_PRESERVADO", "QT_SUB_JUDICE_MANTIDO",
    "DS_VINCULO", "DS_PENDENCIA", "CO_USUARIO", "DS_EMAIL_USUARIO", "NO_USUARIO"
  ) values (
    v_l."CO_MONITORAMENTO", v_nova, v_anterior.id, 'CLASSIFICACAO',
    p_lista_classificacao, v_l."CO_REGRA_CLASSIFICACAO", v_l."NU_VERSAO_REGRA", v_l."DS_HASH",
    v_qt, v_entra, coalesce(v_sai, 0), coalesce(v_muda, 0), coalesce(v_preservado, 0), coalesce(v_mantido, 0),
    (select coalesce(jsonb_agg(a.valor || jsonb_build_object('novo', c.id)), '[]'::jsonb)
       from jsonb_array_elements(v_aplicados) a(valor)
       join public."TB_CANDIDATO_APROVADO" c
         on c.lista_id = v_nova and c."CO_CANDIDATO_ANTERIOR" = (a.valor ->> 'anterior')::uuid),
    v_pendencias, v_uid, v_autor.email, v_autor.nome
  ) returning "CO_PUBLICACAO" into v_publicacao;

  return json_build_object(
    'ok', true, 'lista_id', v_nova, 'publicacao_id', v_publicacao, 'lista_anterior', v_anterior.id,
    'candidatos', v_qt, 'entram', v_entra, 'saem', coalesce(v_sai, 0), 'mudam', coalesce(v_muda, 0),
    'preservados', coalesce(v_preservado, 0), 'sub_judice_mantidos', coalesce(v_mantido, 0),
    'pendencias', v_pendencias
  );
end;
$function$;
comment on function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb) is
  'Publica o resultado FINAL da Classificação (o mais recente, sem empate pendente) como a lista de aprovados vigente do edital: a anterior fica inativa no histórico; quem casou (p_vinculos, conferidos) leva status, matrícula, processo, sub judice e anexos; incluídos sub judice fora do resultado são mantidos; quem sai com status fica em pendência. p_lista_vigente diferente da atual = 40001. Grava TH_PUBLICACAO_APROVADO. Classificação >= editor, a área e o recorte do edital.';
revoke all on function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb) from public, anon;
grant execute on function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb) to authenticated;

-- 5. A situação do edital: lista vigente, resultado final e histórico ----------------------
create function public.obter_publicacao_lista_aprovados(p_edital uuid, p_com_candidatos boolean default false)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_m.id is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not (private.pode_recurso('classificacao', 1) or private.pode_recurso('aprovados', 1)
          or private.pode_recurso('importacao', 2)) then
    raise exception 'Sem permissão para a lista de aprovados' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(v_m."CO_AREA") then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);

  return json_build_object(
    'edital_id', v_m.id,
    'pode_publicar', private.pode_recurso('classificacao', 2),
    'tem_analises', exists (
      select 1 from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = v_m."CO_AREA" and a.ativo
         and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)),
    'resultado_final', (
      select json_build_object('id', l."CO_LISTA_CLASSIFICACAO", 'gerada_em', l."DT_GERACAO",
               'versao_regra', l."NU_VERSAO_REGRA", 'pendencias', l."QT_PENDENCIA",
               'elegiveis', l."QT_ELEGIVEL", 'publicada', l."ST_PUBLICADA" = 'S')
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" = 'FINAL'
       order by l."DT_GERACAO" desc limit 1),
    'vigente', (
      select json_build_object(
               'lista_id', l.id, 'origem', l."TP_ORIGEM", 'lista_classificacao_id', l."CO_LISTA_CLASSIFICACAO",
               'importado_em', l.importado_em, 'por', l."NO_USUARIO_IMPORTACAO", 'ativo', l.ativo,
               'arquivo_nome', l.arquivo_nome,
               'candidatos', case when p_com_candidatos then (
                 select coalesce(json_agg(json_build_object(
                          'candidato_id', c.id, 'analise_id', c."CO_ANALISE_CURRICULAR", 'nome', c.nome,
                          'cargo', c.cargo, 'codigo_vaga', c.codigo_vaga, 'classificacao', c.classificacao,
                          'nota', c.nota, 'modalidade', c.modalidade, 'status', c.status,
                          'processo_sei', c.processo_sei, 'matricula', c.matricula, 'sub_judice', c.sub_judice,
                          'alterado_judicialmente', c.alterado_judicialmente)
                        order by c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
                   from public."TB_CANDIDATO_APROVADO" c
                  where c.lista_id = l.id and c.removido_em is null) end)
        from public."TB_LISTA_APROVADO" l
       where l.edital_id = p_edital::text and l.vigente is true),
    'publicacoes', (
      select coalesce(json_agg(json_build_object(
               'id', h."CO_PUBLICACAO", 'origem', h."TP_ORIGEM", 'em', h."DT_PUBLICACAO",
               'por', coalesce(h."NO_USUARIO", h."DS_EMAIL_USUARIO"), 'lista_classificacao_id', h."CO_LISTA_CLASSIFICACAO",
               'versao_regra', h."NU_VERSAO_REGRA", 'candidatos', h."QT_CANDIDATO", 'entram', h."QT_ENTRA",
               'saem', h."QT_SAI", 'mudam', h."QT_MUDA_POSICAO", 'preservados', h."QT_PRESERVADO",
               'sub_judice_mantidos', h."QT_SUB_JUDICE_MANTIDO", 'pendencias', h."DS_PENDENCIA",
               'motivo', h."DS_MOTIVO") order by h."DT_PUBLICACAO" desc), '[]'::json)
        from (select * from public."TH_PUBLICACAO_APROVADO" x
               where x."CO_MONITORAMENTO" = p_edital
               order by x."DT_PUBLICACAO" desc limit 20) h)
  );
end;
$function$;
comment on function public.obter_publicacao_lista_aprovados(uuid, boolean) is
  'A lista de aprovados vigente do edital (origem; com p_com_candidatos, os candidatos para a prévia da publicação), o último resultado final da Classificação, se o edital tem análises no sistema e as 20 últimas publicações. Classificação >= leitor, Aprovados >= leitor ou Importação >= editor, a área e o recorte do edital.';
revoke all on function public.obter_publicacao_lista_aprovados(uuid, boolean) from public, anon;
grant execute on function public.obter_publicacao_lista_aprovados(uuid, boolean) to authenticated;

-- 6. A importação por XLSX: motivo para trocar uma lista da Classificação; histórico ---------
/*
  O corpo é o de 20260928180000, com: a origem da lista vigente; o motivo
  (3 a 500 caracteres) obrigatório quando ela veio da Classificação; e o
  registro em TH_PUBLICACAO_APROVADO. Quem pode importar e substituir
  não muda.
*/
drop function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean);
create function public.importar_lista_aprovados(
  p_edital_id text,
  p_ativo boolean,
  p_arquivo_nome text,
  p_arquivo_path text,
  p_candidatos jsonb,
  p_substituir boolean default false,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := private.papel_recurso('importacao');
  v_autor record;
  v_lista_id uuid;
  v_lista_atual uuid;
  v_origem_atual text;
  v_ja_teve_lista boolean;
  v_total integer;
  v_edital text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id);
  if not (private.pode_recurso('importacao',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para importar lista de aprovados';
  end if;
  if p_edital_id is null then raise exception 'Edital nao informado'; end if;
  if nullif(btrim(p_arquivo_nome), '') is null or nullif(btrim(p_arquivo_path), '') is null then
    raise exception 'Arquivo XLSX nao informado';
  end if;
  if jsonb_typeof(p_candidatos) <> 'array' or jsonb_array_length(p_candidatos) = 0 then
    raise exception 'A lista precisa conter pelo menos um candidato';
  end if;
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'O motivo deve ter entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  select m.edital into v_edital from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = p_edital_id;
  if not found then raise exception 'Edital nao encontrado na Equipe Nucleo'; end if;

  select exists(select 1 from public."TB_LISTA_APROVADO" where edital_id = p_edital_id)
    into v_ja_teve_lista;
  select id, "TP_ORIGEM" into v_lista_atual, v_origem_atual
  from public."TB_LISTA_APROVADO"
  where edital_id = p_edital_id and vigente is true
  for update;

  if v_ja_teve_lista and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir ou importar novamente uma lista ja cadastrada';
  end if;
  if v_lista_atual is not null and not coalesce(p_substituir, false) then
    raise exception 'Este edital ja possui lista. Use a opcao de substituicao administrativa';
  end if;
  if coalesce(p_substituir, false) and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir lista de aprovados';
  end if;
  if v_origem_atual = 'CLASSIFICACAO' and v_motivo is null then
    raise exception 'A lista vigente foi publicada da Classificação. Para trocá-la pela planilha, informe o motivo.' using errcode = '22023';
  end if;

  select * into v_autor from private.autor_da_sessao();

  if v_lista_atual is not null then
    update public."TB_LISTA_APROVADO"
    set vigente = false, ativo = false, substituido_por = (select auth.uid()),
        substituido_em = now(), updated_at = now(),
        "DS_EMAIL_SUBSTITUICAO" = v_autor.email,
        "NO_USUARIO_SUBSTITUICAO" = v_autor.nome
    where id = v_lista_atual;
  end if;

  insert into public."TB_LISTA_APROVADO"(
    edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por,
    "DS_EMAIL_IMPORTACAO", "NO_USUARIO_IMPORTACAO", "TP_ORIGEM"
  ) values (
    p_edital_id, coalesce(p_ativo, true), true, btrim(p_arquivo_nome),
    btrim(p_arquivo_path), (select auth.uid()),
    v_autor.email, v_autor.nome, 'XLSX'
  ) returning id into v_lista_id;

  insert into public."TB_CANDIDATO_APROVADO"(
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    sub_judice, created_by, updated_by
  )
  select v_lista_id,
         nullif(btrim(x.codigo_vaga), ''),
         nullif(btrim(x.cargo), ''),
         x.classificacao,
         x.nota,
         nullif(btrim(x.nome), ''),
         nullif(btrim(x.modalidade), ''),
         false,
         (select auth.uid()),
         (select auth.uid())
  from jsonb_to_recordset(p_candidatos) as x(
    codigo_vaga text,
    cargo text,
    classificacao integer,
    nota numeric,
    nome text,
    modalidade text
  );

  get diagnostics v_total = row_count;
  if v_total <> jsonb_array_length(p_candidatos) then
    raise exception 'Nem todos os candidatos puderam ser importados';
  end if;

  insert into public."TH_PUBLICACAO_APROVADO" (
    "CO_MONITORAMENTO", "CO_LISTA_APROVADO", "CO_LISTA_APROVADO_ANTERIOR", "TP_ORIGEM",
    "QT_CANDIDATO", "DS_MOTIVO", "CO_USUARIO", "DS_EMAIL_USUARIO", "NO_USUARIO"
  ) values (
    p_edital_id::uuid, v_lista_id, v_lista_atual, 'XLSX',
    v_total, v_motivo, (select auth.uid()), v_autor.email, v_autor.nome
  );

  return jsonb_build_object(
    'ok', true, 'lista_id', v_lista_id, 'edital_id', p_edital_id,
    'edital', v_edital, 'total', v_total, 'ativo', coalesce(p_ativo, true),
    'importado_por_email', v_autor.email, 'importado_por_nome', v_autor.nome
  );
end;
$function$;
comment on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text) is
  'Importa a lista de aprovados do edital por XLSX (já no Storage) como lista vigente; substituir é do admin de Importação. Se a lista vigente foi publicada da Classificação, p_motivo (3 a 500 caracteres) é obrigatório. Grava a autoria e TH_PUBLICACAO_APROVADO. Importação >= editor e a área do edital.';
revoke all on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text) from public, anon;
grant execute on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text) to authenticated;

-- 7. As listas vigentes, com a origem ---------------------------------------------------------
/*
  O corpo é o de 20260929121200 (recorte da coordenação), com a origem e a
  lista de classificação no fim. `drop`: o tipo de retorno muda.
*/
drop function public.listar_listas_aprovados();
create function public.listar_listas_aprovados()
returns table (
  lista_id uuid,
  edital_id text,
  edital text,
  unidade text,
  ativo boolean,
  arquivo_nome text,
  arquivo_path text,
  importado_em timestamptz,
  total_candidatos bigint,
  importado_por_email text,
  importado_por_nome text,
  origem text,
  lista_classificacao_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not ((private.pode_recurso('aprovados') or private.pode_recurso('importacao',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  return query
  select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
         l.arquivo_path, l.importado_em,
         count(c.id) filter (where c.removido_em is null),
         l."DS_EMAIL_IMPORTACAO"::text, l."NO_USUARIO_IMPORTACAO"::text,
         l."TP_ORIGEM"::text, l."CO_LISTA_CLASSIFICACAO"
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  group by l.id, m.edital, m.unidade
  order by m.edital, m.unidade;
end;
$function$;
comment on function public.listar_listas_aprovados() is
  'Listas de aprovados vigentes dos editais das áreas do usuário (com o recorte da coordenação): situação, arquivo, total de candidatos, quem importou, a origem (XLSX ou CLASSIFICACAO) e a lista de classificação publicada.';
revoke all on function public.listar_listas_aprovados() from public, anon;
grant execute on function public.listar_listas_aprovados() to authenticated;

commit;
