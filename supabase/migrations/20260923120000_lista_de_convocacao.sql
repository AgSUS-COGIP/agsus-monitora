/*
  LISTA DE CONVOCAÇÃO

  A lista de aprovados diz quem passou. Esta guarda o que falta para dizer quem
  é chamado primeiro.

  AS REGRAS DO EDITAL SÃO DADO, NÃO CÓDIGO

  A primeira versão desta migration tinha as cinco categorias de reserva e os
  seus percentuais como colunas: `TX_RESERVA_PRETO_PARDO`, `TX_RESERVA_PCD` e
  companhia. A leitura de oito editais da AgSUS derrubou o desenho — quase nada
  é constante entre eles:

    - 97/2025 reserva também para candidatos TRANS, uma sexta categoria que não
      caberia sem `alter table`;
    - o edital da FCC (125) junta negros e indígenas numa cota só, a 20%, e não
      usa proporcionalidade: publica as posições literais (3ª, 8ª, 13ª… para a
      cota; 5ª, 21ª, 41ª… para PCD);
    - 91/2026 manda a vaga de PCD vazia para os INDÍGENAS, arredonda o PCD
      sempre para cima com teto de 20%, só aplica a reserva havendo duas ou mais
      vagas, e permite acumular duas reservas desde que uma seja PCD.

  Daí as duas tabelas novas. Um MODELO é um conjunto nomeado de regras —
  distribuição, cota múltipla, mínimo de vagas — e as suas CATEGORIAS trazem
  percentual, arredondamento, teto, termos de reconhecimento, posições e
  cascata. Cada edital aponta para um modelo.

  Cinco dos oito editais têm regras idênticas, e é isso que justifica o modelo
  ser partilhado em vez de copiado por edital: corrigir uma leitura errada
  corrige todos de uma vez. O reverso é o perigo, e a tela avisa quantos editais
  um modelo serve antes de deixar salvar.

  O que NÃO está aqui é o catálogo de modelos de referência. Ele vive em
  `src/lib/modelo-de-convocacao.js`, porque é a leitura de editais publicados:
  mudá-lo é afirmar que se leu o edital de outra forma, e isso merece revisão de
  código, não um campo de formulário. O gestor cria os seus modelos A PARTIR
  desse catálogo, e o que cria é linha destas tabelas.

  DERIVAR, NÃO GUARDAR

  O edital não publica "3 vagas para negros": publica 25% e a regra de
  arredondamento. Guarda-se a ENTRADA — percentual e total de vagas — e o quadro
  por categoria é derivado no navegador. Corrigir um percentual reordena as
  convocações na hora; guardar o derivado deixaria para trás vagas calculadas
  com a regra antiga, sem nada na tela a dizer isso.

  "ST_QUADRO_MANUAL" é a válvula de escape: quando o edital publica uma tabela
  de vagas que não bate com a conta, a vaga passa a mandar nos próprios números.

  A chave da configuração é o EDITAL, não a lista. Substituir o XLSX cria uma
  lista nova, e amarrar a configuração à lista faria o gestor reconfigurar tudo
  a cada substituição.

  RE-EXECUÇÃO

  O ficheiro começa por APAGAR as suas tabelas. É seguro e deliberado: nasceram
  nesta migration, nunca chegaram a produção, e o que podem conter é
  configuração digitada em teste local. Apagar e recriar mantém o ficheiro
  re-executável enquanto o desenho ainda se move.

  NOMENCLATURA

  Segue o Padrão Institucional de Nomenclatura (UTIC/AgSUS, maio/2026):
  maiúsculas entre aspas, prefixo tipológico por coluna, nomes até 30
  caracteres, flags como `ST_` com domínio S/N. As tabelas irmãs desta área
  ("TB_LISTA_APROVADO", "TB_CANDIDATO_APROVADO") têm as colunas ainda em
  snake_case porque a padronização de 2026-09-18 tratou só do item 6 (tabelas);
  a divergência é conhecida, e o caminho é o item 7 alcançá-las, não estas
  nascerem fora do padrão.

  As funções mantêm nome em snake_case com verbo, fora do padrão `FC_`: o nome
  da função É o caminho da RPC no PostgREST, está declarado em
  `src/lib/rpc-contrato.js` e verificado contra `pg_proc`. Pela mesma razão
  devolvem colunas em snake_case — é o corpo JSON que o navegador lê.

  DEPENDENTES
    - src/lib/modelo-de-convocacao.js
    - src/lib/lista-convocacao-rules.js
    - src/modules/lista-convocacao.js
    - src/lib/rpc-contrato.js

  ROLLBACK
    begin;
    drop function if exists public.salvar_configuracao_convocacao(text, boolean, uuid, integer, jsonb);
    drop function if exists public.remover_modelo_convocacao(uuid);
    drop function if exists public.salvar_modelo_convocacao(jsonb);
    drop function if exists public.listar_modelos_convocacao();
    drop function if exists public.listar_configuracao_convocacao();
    drop table if exists public."TB_VAGA_IMEDIATA";
    drop table if exists public."TB_CONVOCACAO_EDITAL";
    drop table if exists public."TB_CATEGORIA_CONVOCACAO";
    drop table if exists public."TB_MODELO_CONVOCACAO";
    commit;
    -- `listar_candidatos_aprovados` volta ao que era em
    -- 20260918160000_padronizacao_nomenclatura_tabelas.sql, sem `codigo_vaga`.
*/
begin;

-- ---------------------------------------------------------------------------
-- 0. Estado anterior desta mesma migration, para poder correr outra vez.
-- ---------------------------------------------------------------------------
drop table if exists public."TB_VAGA_IMEDIATA";
drop table if exists public."TB_CONVOCACAO_EDITAL";
drop table if exists public."TB_CATEGORIA_CONVOCACAO";
drop table if exists public."TB_MODELO_CONVOCACAO";
-- Assinaturas mudaram; sem isto as versões antigas ficariam como sobrecarga e o
-- PostgREST não saberia qual chamar.
drop function if exists public.salvar_configuracao_convocacao(text, boolean, jsonb, jsonb);
drop function if exists public.salvar_configuracao_convocacao(text, boolean, jsonb, integer, jsonb);
drop function if exists public.salvar_configuracao_convocacao(text, boolean, uuid, integer, jsonb);
drop function if exists public.listar_configuracao_convocacao();
drop function if exists public.listar_modelos_convocacao();
drop function if exists public.salvar_modelo_convocacao(jsonb);
drop function if exists public.remover_modelo_convocacao(uuid);

-- ---------------------------------------------------------------------------
-- 1. O modelo: um conjunto nomeado de regras de convocação.
-- ---------------------------------------------------------------------------
create table public."TB_MODELO_CONVOCACAO" (
  "CO_MODELO" uuid primary key default gen_random_uuid(),
  "NO_MODELO" text not null,
  "TP_DISTRIBUICAO" varchar(20) not null default 'PROPORCIONAL',
  "TP_COTA_MULTIPLA" varchar(30) not null default 'MAIOR_PERCENTUAL',
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "CK_MODELO_CONVOC_NOME"
    check (nullif(btrim("NO_MODELO"), '') is not null),
  constraint "CK_MODELO_CONVOC_DISTRIB"
    check ("TP_DISTRIBUICAO" in ('PROPORCIONAL', 'POSICAO_FIXA')),
  constraint "CK_MODELO_CONVOC_MULTIPLA"
    check ("TP_COTA_MULTIPLA" in ('MAIOR_PERCENTUAL', 'ACUMULA_COM_ACUMULAVEL', 'TODAS'))
);

comment on table public."TB_MODELO_CONVOCACAO" is
  'Conjunto nomeado de regras de convocacao de um edital, reutilizavel entre editais. O nome identifica a regra (ex.: Lei 15.142/2025 - 25/3/2 e 5% PCD); nao ha campo de descricao separado.';
comment on column public."TB_MODELO_CONVOCACAO"."TP_DISTRIBUICAO" is
  'PROPORCIONAL espalha as vagas de reserva pela sequencia; POSICAO_FIXA usa as posicoes publicadas no edital.';
comment on column public."TB_MODELO_CONVOCACAO"."TP_COTA_MULTIPLA" is
  'O que fazer com quem declara mais de uma reserva: so a de maior percentual, acumular com a categoria acumulavel, ou todas.';

-- ---------------------------------------------------------------------------
-- 2. As categorias do modelo — inclusive a ampla, que recebe o resto.
-- ---------------------------------------------------------------------------
create table public."TB_CATEGORIA_CONVOCACAO" (
  "CO_MODELO" uuid not null,
  "CO_CATEGORIA" text not null,
  "NO_CATEGORIA" text not null,
  "SG_CATEGORIA" varchar(10) not null,
  "ST_AMPLA" varchar(1) not null default 'N',
  "ST_ACUMULAVEL" varchar(1) not null default 'N',
  "TX_RESERVA" numeric(5,2) not null default 0,
  "TP_ARREDONDAMENTO" varchar(20) not null default 'MEIO_ACIMA',
  "TX_TETO" numeric(5,2) not null default 0,
  "QT_MINIMA_RESERVA" integer not null default 0,
  "DS_TERMO" text not null default '',
  "DS_POSICAO" text not null default '',
  "QT_INTERVALO" integer not null default 0,
  "DS_CASCATA" text not null default '',
  "NU_ORDEM" integer not null default 0,
  constraint "PK_CATEGORIA_CONVOCACAO" primary key ("CO_MODELO", "CO_CATEGORIA"),
  constraint "FK_MODELO_CATEGORIA_CONVOC"
    foreign key ("CO_MODELO")
    references public."TB_MODELO_CONVOCACAO"("CO_MODELO") on delete cascade,
  constraint "CK_CATEG_CONVOC_AMPLA" check ("ST_AMPLA" in ('S', 'N')),
  constraint "CK_CATEG_CONVOC_ACUMULAVEL" check ("ST_ACUMULAVEL" in ('S', 'N')),
  constraint "CK_CATEG_CONVOC_ARREDOND"
    check ("TP_ARREDONDAMENTO" in ('MEIO_ACIMA', 'SEMPRE_ACIMA')),
  constraint "CK_CATEG_CONVOC_TAXA" check (
    "TX_RESERVA" between 0 and 100 and "TX_TETO" between 0 and 100
  ),
  constraint "CK_CATEG_CONVOC_INTERVALO" check ("QT_INTERVALO" >= 0),
  constraint "CK_CATEG_CONVOC_MINIMA" check ("QT_MINIMA_RESERVA" >= 0)
);

create index "IN_CATEG_CONVOC_COMODELO"
  on public."TB_CATEGORIA_CONVOCACAO"("CO_MODELO", "NU_ORDEM");

comment on table public."TB_CATEGORIA_CONVOCACAO" is
  'Categorias de um modelo de convocacao: ampla concorrencia e cada reserva, com as suas regras proprias.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."CO_CATEGORIA" is
  'Identificador da categoria dentro do modelo, em minusculas com underscore (ex.: pretos_pardos).';
comment on column public."TB_CATEGORIA_CONVOCACAO"."ST_AMPLA" is
  'S na unica categoria que recebe o resto das vagas. Sem ela nao haveria para onde reverter reserva vazia.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."ST_ACUMULAVEL" is
  'S na categoria que pode somar-se a outra na mesma pessoa quando o modelo usa ACUMULA_COM_ACUMULAVEL. Edital 91/2026 item 5.13: e a de PCD.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."TX_RESERVA" is
  'Percentual das vagas reservado a esta categoria. Zero na ampla, que e o resto.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."TP_ARREDONDAMENTO" is
  'MEIO_ACIMA: fracao >= 0,5 sobe. SEMPRE_ACIMA: qualquer fracao sobe (edital 91/2026 para PCD).';
comment on column public."TB_CATEGORIA_CONVOCACAO"."QT_MINIMA_RESERVA" is
  'Vagas minimas na vaga para ESTA reserva se aplicar. Zero significa sempre. Edital FGV: 2 nas cotas raciais (7.1.3) e 5 no PCD (6.5) - o mesmo edital, dois minimos, e por isso o campo e da categoria e nao do modelo.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."TX_TETO" is
  'Percentual maximo que esta reserva pode ocupar depois do arredondamento. Zero significa sem teto.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."DS_TERMO" is
  'Termos que reconhecem a categoria na coluna modalidade do XLSX, separados por ponto e virgula. Termo terminado em asterisco casa com as flexoes.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."DS_POSICAO" is
  'Posicoes publicadas no edital, separadas por ponto e virgula (ex.: 3;8). So vale com TP_DISTRIBUICAO = POSICAO_FIXA.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."QT_INTERVALO" is
  'Intervalo com que a serie de posicoes continua depois da ultima publicada.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."DS_CASCATA" is
  'Categorias que recebem esta reserva quando fica sem candidato, em ordem, separadas por ponto e virgula. A ampla e sempre o destino final e nao se escreve aqui.';

-- ---------------------------------------------------------------------------
-- 3. Configuração de convocação do edital.
-- ---------------------------------------------------------------------------
create table public."TB_CONVOCACAO_EDITAL" (
  "CO_EDITAL" text not null,
  "TP_CONVOCACAO" varchar(25) not null default 'COM_PROPORCIONALIDADE',
  "CO_MODELO" uuid,
  "QT_PADRAO_IMEDIATA" integer not null default 0,
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_CONVOCACAO_EDITAL" primary key ("CO_EDITAL"),
  /*
    `on delete set null` e não `restrict`: apagar um modelo em uso não deve
    travar, mas também não pode levar a configuração do edital junto. O edital
    fica sem modelo, a aba mostra tudo como cadastro de reserva, e o gestor
    escolhe outro.
  */
  constraint "FK_MODELO_CONVOCACAO_EDITAL"
    foreign key ("CO_MODELO")
    references public."TB_MODELO_CONVOCACAO"("CO_MODELO") on delete set null,
  constraint "CK_CONV_EDITAL_TPCONVOCACAO" check (
    "TP_CONVOCACAO" in ('COM_PROPORCIONALIDADE', 'SEM_PROPORCIONALIDADE')
  ),
  constraint "CK_CONV_EDITAL_QTPADRAO" check ("QT_PADRAO_IMEDIATA" >= 0)
);

create index "IN_FKCONV_EDITAL_COMODELO"
  on public."TB_CONVOCACAO_EDITAL"("CO_MODELO");

comment on table public."TB_CONVOCACAO_EDITAL" is
  'Ligacao entre um edital e o modelo de regras de convocacao que ele usa.';
comment on column public."TB_CONVOCACAO_EDITAL"."CO_EDITAL" is
  'Identificador do edital em TB_MONITORAMENTO_INDIGENA, como texto.';
comment on column public."TB_CONVOCACAO_EDITAL"."TP_CONVOCACAO" is
  'SEM_PROPORCIONALIDADE ignora o modelo e convoca pela classificacao.';
comment on column public."TB_CONVOCACAO_EDITAL"."QT_PADRAO_IMEDIATA" is
  'Total de vagas imediatas sugerido para a vaga que ainda nao tem linha propria em TB_VAGA_IMEDIATA.';

-- ---------------------------------------------------------------------------
-- 4. Quantas vagas imediatas tem cada vaga do edital.
-- ---------------------------------------------------------------------------
create table public."TB_VAGA_IMEDIATA" (
  "CO_EDITAL" text not null,
  "CO_VAGA" text not null,
  "NO_CARGO" text,
  "QT_VAGA_IMEDIATA" integer not null default 0,
  "ST_QUADRO_MANUAL" varchar(1) not null default 'N',
  /*
    O quadro manual é uma lista por categoria, e as categorias são do modelo —
    não há coluna fixa que as represente. Guardá-lo em jsonb é o que permite ao
    modelo ganhar uma categoria nova sem `alter table` aqui.
  */
  "DS_QUADRO_MANUAL" jsonb not null default '{}'::jsonb,
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_VAGA_IMEDIATA" primary key ("CO_EDITAL", "CO_VAGA"),
  constraint "FK_CONV_EDITAL_VAGA_IMEDIATA"
    foreign key ("CO_EDITAL")
    references public."TB_CONVOCACAO_EDITAL"("CO_EDITAL") on delete cascade,
  constraint "CK_VAGA_IMEDIATA_COVAGA"
    check (nullif(btrim("CO_VAGA"), '') is not null),
  constraint "CK_VAGA_IMEDIATA_STMANUAL"
    check ("ST_QUADRO_MANUAL" in ('S', 'N')),
  constraint "CK_VAGA_IMEDIATA_QUADRO"
    check (jsonb_typeof("DS_QUADRO_MANUAL") = 'object'),
  constraint "CK_VAGA_IMEDIATA_QT" check ("QT_VAGA_IMEDIATA" >= 0)
);

comment on table public."TB_VAGA_IMEDIATA" is
  'Vagas imediatas de um codigo de vaga. Ausencia de linha significa que a vaga segue o total padrao do edital.';
comment on column public."TB_VAGA_IMEDIATA"."CO_VAGA" is
  'Codigo da vaga como veio no XLSX da lista de aprovados (coluna codigo_vaga).';
comment on column public."TB_VAGA_IMEDIATA"."QT_VAGA_IMEDIATA" is
  'Total de vagas de provimento imediato desta vaga. Zero significa somente cadastro de reserva.';
comment on column public."TB_VAGA_IMEDIATA"."ST_QUADRO_MANUAL" is
  'S: DS_QUADRO_MANUAL manda. N: o quadro e derivado do total e dos percentuais do modelo.';
comment on column public."TB_VAGA_IMEDIATA"."DS_QUADRO_MANUAL" is
  'Objeto JSON com uma chave por CO_CATEGORIA do modelo e a quantidade de vagas. So vale com ST_QUADRO_MANUAL = S.';

-- ---------------------------------------------------------------------------
-- 5. Acesso: leitura para qualquer perfil ativo, escrita só pelas RPCs.
-- ---------------------------------------------------------------------------
alter table public."TB_MODELO_CONVOCACAO" enable row level security;
alter table public."TB_CATEGORIA_CONVOCACAO" enable row level security;
alter table public."TB_CONVOCACAO_EDITAL" enable row level security;
alter table public."TB_VAGA_IMEDIATA" enable row level security;

revoke all on public."TB_MODELO_CONVOCACAO" from anon, authenticated;
revoke all on public."TB_CATEGORIA_CONVOCACAO" from anon, authenticated;
revoke all on public."TB_CONVOCACAO_EDITAL" from anon, authenticated;
revoke all on public."TB_VAGA_IMEDIATA" from anon, authenticated;
grant select on public."TB_MODELO_CONVOCACAO" to authenticated;
grant select on public."TB_CATEGORIA_CONVOCACAO" to authenticated;
grant select on public."TB_CONVOCACAO_EDITAL" to authenticated;
grant select on public."TB_VAGA_IMEDIATA" to authenticated;

drop policy if exists modelo_convocacao_select_perfil_ativo on public."TB_MODELO_CONVOCACAO";
create policy modelo_convocacao_select_perfil_ativo on public."TB_MODELO_CONVOCACAO"
for select to authenticated using (private.monitora_role() <> '');

drop policy if exists categoria_convocacao_select_perfil_ativo on public."TB_CATEGORIA_CONVOCACAO";
create policy categoria_convocacao_select_perfil_ativo on public."TB_CATEGORIA_CONVOCACAO"
for select to authenticated using (private.monitora_role() <> '');

drop policy if exists convocacao_edital_select_perfil_ativo on public."TB_CONVOCACAO_EDITAL";
create policy convocacao_edital_select_perfil_ativo on public."TB_CONVOCACAO_EDITAL"
for select to authenticated using (private.monitora_role() <> '');

drop policy if exists vaga_imediata_select_perfil_ativo on public."TB_VAGA_IMEDIATA";
create policy vaga_imediata_select_perfil_ativo on public."TB_VAGA_IMEDIATA"
for select to authenticated using (private.monitora_role() <> '');

-- ---------------------------------------------------------------------------
-- 6. Leitura dos modelos.
-- ---------------------------------------------------------------------------
/*
  Um modelo por linha, com as categorias aninhadas em jsonb e já na ordem. O
  campo `editais` conta quantos usam o modelo: é o número que a tela mostra
  antes de deixar alguém editar uma regra partilhada.
*/
create function public.listar_modelos_convocacao()
returns table (
  modelo_id uuid,
  nome text,
  distribuicao text,
  cota_multipla text,
  editais bigint,
  categorias jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.monitora_role() = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;
  return query
  select m."CO_MODELO",
         m."NO_MODELO",
         lower(m."TP_DISTRIBUICAO"),
         lower(m."TP_COTA_MULTIPLA"),
         (
           select count(*)
           from public."TB_CONVOCACAO_EDITAL" e
           where e."CO_MODELO" = m."CO_MODELO"
         ),
         coalesce(
           (
             select jsonb_agg(
               jsonb_build_object(
                 'id', c."CO_CATEGORIA",
                 'rotulo', c."NO_CATEGORIA",
                 'sigla', c."SG_CATEGORIA",
                 'ampla', c."ST_AMPLA" = 'S',
                 'acumulavel', c."ST_ACUMULAVEL" = 'S',
                 'percentual', c."TX_RESERVA",
                 'arredondamento', lower(c."TP_ARREDONDAMENTO"),
                 'teto', c."TX_TETO",
                 'minimo', c."QT_MINIMA_RESERVA",
                 'termos', c."DS_TERMO",
                 'posicoes', c."DS_POSICAO",
                 'intervalo', c."QT_INTERVALO",
                 'cascata', c."DS_CASCATA"
               )
               order by c."NU_ORDEM", c."CO_CATEGORIA"
             )
             from public."TB_CATEGORIA_CONVOCACAO" c
             where c."CO_MODELO" = m."CO_MODELO"
           ),
           '[]'::jsonb
         )
  from public."TB_MODELO_CONVOCACAO" m
  order by m."NO_MODELO";
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Gravação de um modelo.
-- ---------------------------------------------------------------------------
/*
  Modelo e categorias numa chamada só. As categorias enviadas substituem as
  guardadas: apagar uma categoria no formulário tem de apagá-la de facto, e um
  `upsert` sem a remoção deixaria a categoria antiga a mandar na ordem para
  sempre.

  Guardar um modelo sem categoria de ampla é recusado aqui, e não só na tela: é
  a ampla que recebe o resto das vagas e o destino final de toda reserva vazia.
*/
create function public.salvar_modelo_convocacao(p_modelo jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(btrim(p_modelo->>'id'), '')::uuid;
  v_nome text := btrim(coalesce(p_modelo->>'nome', ''));
  v_categorias jsonb := coalesce(p_modelo->'categorias', '[]'::jsonb);
  v_amplas integer;
  v_total integer := 0;
begin
  if not private.monitora_role_in(array['edital_gestor','contratador','admin']::text[]) then
    raise exception 'Perfil sem permissao para configurar a convocacao';
  end if;
  if nullif(v_nome, '') is null then
    raise exception 'Informe um nome para o modelo';
  end if;
  if jsonb_typeof(v_categorias) <> 'array' or jsonb_array_length(v_categorias) = 0 then
    raise exception 'O modelo precisa de pelo menos uma categoria';
  end if;

  select count(*) into v_amplas
  from jsonb_array_elements(v_categorias) as x
  where coalesce((x->>'ampla')::boolean, false);
  if v_amplas <> 1 then
    raise exception 'O modelo precisa de exatamente uma categoria de ampla concorrencia (encontradas: %)', v_amplas;
  end if;

  insert into public."TB_MODELO_CONVOCACAO"(
    "CO_MODELO", "NO_MODELO",
    "TP_DISTRIBUICAO", "TP_COTA_MULTIPLA",
    "CO_USUARIO_ATUALIZACAO"
  ) values (
    coalesce(v_id, gen_random_uuid()),
    v_nome,
    upper(coalesce(nullif(btrim(p_modelo->>'distribuicao'), ''), 'proporcional')),
    upper(coalesce(nullif(btrim(p_modelo->>'cotaMultipla'), ''), 'maior_percentual')),
    (select auth.uid())
  )
  on conflict ("CO_MODELO") do update
  set "NO_MODELO" = excluded."NO_MODELO",
      "TP_DISTRIBUICAO" = excluded."TP_DISTRIBUICAO",
      "TP_COTA_MULTIPLA" = excluded."TP_COTA_MULTIPLA",
      "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO",
      "DT_ATUALIZACAO" = now()
  returning "CO_MODELO" into v_id;

  delete from public."TB_CATEGORIA_CONVOCACAO" where "CO_MODELO" = v_id;

  insert into public."TB_CATEGORIA_CONVOCACAO"(
    "CO_MODELO", "CO_CATEGORIA", "NO_CATEGORIA", "SG_CATEGORIA",
    "ST_AMPLA", "ST_ACUMULAVEL", "TX_RESERVA", "TP_ARREDONDAMENTO", "TX_TETO",
    "QT_MINIMA_RESERVA", "DS_TERMO", "DS_POSICAO", "QT_INTERVALO", "DS_CASCATA", "NU_ORDEM"
  )
  select v_id,
         btrim(x.id),
         btrim(x.rotulo),
         left(btrim(x.sigla), 10),
         case when coalesce(x.ampla, false) then 'S' else 'N' end,
         case when coalesce(x.acumulavel, false) then 'S' else 'N' end,
         least(greatest(coalesce(x.percentual, 0), 0), 100),
         upper(coalesce(nullif(btrim(x.arredondamento), ''), 'meio_acima')),
         least(greatest(coalesce(x.teto, 0), 0), 100),
         greatest(coalesce(x.minimo, 0), 0),
         coalesce(x.termos, ''),
         coalesce(x.posicoes, ''),
         greatest(coalesce(x.intervalo, 0), 0),
         coalesce(x.cascata, ''),
         greatest(coalesce(x.ordem, 0), 0)
  from jsonb_to_recordset(v_categorias) as x(
    id text,
    rotulo text,
    sigla text,
    ampla boolean,
    acumulavel boolean,
    percentual numeric,
    arredondamento text,
    teto numeric,
    minimo integer,
    termos text,
    posicoes text,
    intervalo integer,
    cascata text,
    ordem integer
  )
  where nullif(btrim(x.id), '') is not null;

  get diagnostics v_total = row_count;
  return jsonb_build_object('ok', true, 'modelo_id', v_id, 'categorias', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Remoção de um modelo.
-- ---------------------------------------------------------------------------
/*
  Apagar um modelo em uso deixa os editais sem regra — o `on delete set null` da
  chave estrangeira trata disso —, e por isso a contagem volta na resposta: a
  tela avisa antes, e esta função confirma depois quantos ficaram a descoberto.
*/
create function public.remover_modelo_convocacao(p_modelo_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_editais integer := 0;
begin
  if not private.monitora_role_in(array['edital_gestor','contratador','admin']::text[]) then
    raise exception 'Perfil sem permissao para configurar a convocacao';
  end if;
  if p_modelo_id is null then raise exception 'Modelo nao informado'; end if;

  select count(*) into v_editais
  from public."TB_CONVOCACAO_EDITAL"
  where "CO_MODELO" = p_modelo_id;

  delete from public."TB_MODELO_CONVOCACAO" where "CO_MODELO" = p_modelo_id;
  if not found then raise exception 'Modelo nao encontrado'; end if;

  return jsonb_build_object('ok', true, 'editais_afetados', v_editais);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Leitura da configuração dos editais.
-- ---------------------------------------------------------------------------
create function public.listar_configuracao_convocacao()
returns table (
  edital_id text,
  proporcionalidade boolean,
  modelo_id uuid,
  padrao_imediata integer,
  vagas jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.monitora_role() = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;
  return query
  select c."CO_EDITAL",
         c."TP_CONVOCACAO" = 'COM_PROPORCIONALIDADE',
         c."CO_MODELO",
         c."QT_PADRAO_IMEDIATA",
         coalesce(
           (
             select jsonb_agg(
               jsonb_build_object(
                 'codigo_vaga', v."CO_VAGA",
                 'cargo', v."NO_CARGO",
                 'imediatas', v."QT_VAGA_IMEDIATA",
                 'manual', v."ST_QUADRO_MANUAL" = 'S',
                 'quadro', v."DS_QUADRO_MANUAL"
               )
               order by v."CO_VAGA"
             )
             from public."TB_VAGA_IMEDIATA" v
             where v."CO_EDITAL" = c."CO_EDITAL"
           ),
           '[]'::jsonb
         )
  from public."TB_CONVOCACAO_EDITAL" c
  order by c."CO_EDITAL";
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Gravação da configuração de um edital.
-- ---------------------------------------------------------------------------
/*
  Uma chamada grava o formulário inteiro — tipo, modelo e todas as vagas.
  Gravar vaga a vaga deixaria a configuração meio aplicada se a rede caísse no
  meio, e a ordem de convocação mudaria por causa de um quadro incompleto.
*/
create function public.salvar_configuracao_convocacao(
  p_edital_id text,
  p_proporcionalidade boolean,
  p_modelo_id uuid,
  p_padrao_imediata integer,
  p_vagas jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_edital text := btrim(p_edital_id);
  v_tipo text := case
    when coalesce(p_proporcionalidade, true) then 'COM_PROPORCIONALIDADE'
    else 'SEM_PROPORCIONALIDADE'
  end;
  v_total integer := 0;
begin
  if not private.monitora_role_in(array['edital_gestor','contratador','admin']::text[]) then
    raise exception 'Perfil sem permissao para configurar a convocacao';
  end if;
  if nullif(v_edital, '') is null then
    raise exception 'Edital nao informado';
  end if;
  if not exists (
    select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = v_edital
  ) then
    raise exception 'Edital nao encontrado na Equipe Nucleo';
  end if;
  if p_modelo_id is not null and not exists (
    select 1 from public."TB_MODELO_CONVOCACAO" where "CO_MODELO" = p_modelo_id
  ) then
    raise exception 'Modelo de convocacao nao encontrado';
  end if;
  if p_vagas is not null and jsonb_typeof(p_vagas) <> 'array' then
    raise exception 'A lista de vagas precisa ser um arranjo';
  end if;

  insert into public."TB_CONVOCACAO_EDITAL"(
    "CO_EDITAL", "TP_CONVOCACAO", "CO_MODELO",
    "QT_PADRAO_IMEDIATA", "CO_USUARIO_ATUALIZACAO"
  ) values (
    v_edital, v_tipo, p_modelo_id,
    greatest(coalesce(p_padrao_imediata, 0), 0),
    (select auth.uid())
  )
  on conflict ("CO_EDITAL") do update
  set "TP_CONVOCACAO" = excluded."TP_CONVOCACAO",
      "CO_MODELO" = excluded."CO_MODELO",
      "QT_PADRAO_IMEDIATA" = excluded."QT_PADRAO_IMEDIATA",
      "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO",
      "DT_ATUALIZACAO" = now();

  delete from public."TB_VAGA_IMEDIATA" where "CO_EDITAL" = v_edital;

  if p_vagas is not null and jsonb_array_length(p_vagas) > 0 then
    insert into public."TB_VAGA_IMEDIATA"(
      "CO_EDITAL", "CO_VAGA", "NO_CARGO",
      "QT_VAGA_IMEDIATA", "ST_QUADRO_MANUAL", "DS_QUADRO_MANUAL",
      "CO_USUARIO_ATUALIZACAO"
    )
    select v_edital,
           btrim(x.codigo_vaga),
           nullif(btrim(x.cargo), ''),
           greatest(coalesce(x.imediatas, 0), 0),
           case when coalesce(x.manual, false) then 'S' else 'N' end,
           case when jsonb_typeof(coalesce(x.quadro, '{}'::jsonb)) = 'object'
                then coalesce(x.quadro, '{}'::jsonb) else '{}'::jsonb end,
           (select auth.uid())
    from jsonb_to_recordset(p_vagas) as x(
      codigo_vaga text,
      cargo text,
      imediatas integer,
      manual boolean,
      quadro jsonb
    )
    where nullif(btrim(x.codigo_vaga), '') is not null;
    get diagnostics v_total = row_count;
  end if;

  return jsonb_build_object(
    'ok', true,
    'edital_id', v_edital,
    'modelo_id', p_modelo_id,
    'vagas', v_total
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. A lista de candidatos passa a devolver o código da vaga.
-- ---------------------------------------------------------------------------
/*
  `codigo_vaga` está na tabela desde a primeira migration e é coluna obrigatória
  do XLSX, mas `listar_candidatos_aprovados` nunca a devolveu — o frontend só
  precisava de cargo e classificação.

  A convocação precisa dela: a vaga é a unidade de cálculo, e sem o código todos
  os candidatos de um edital caem no mesmo balde. O sintoma era o formulário
  dizer "0 vagas" num edital com 405 candidatos importados.

  É `drop` e não `create or replace` porque o PostgreSQL recusa mudar o tipo de
  retorno de uma função existente, e acrescentar coluna ao `returns table` é
  mudá-lo. O `grant` a seguir tem de ser refeito: ele morre com a função.
*/
drop function if exists public.listar_candidatos_aprovados();

create function public.listar_candidatos_aprovados()
returns table (
  candidato_id uuid,
  lista_id uuid,
  edital_id text,
  edital text,
  unidade text,
  cargo text,
  classificacao integer,
  nota numeric,
  nome text,
  modalidade text,
  status text,
  processo_sei text,
  matricula text,
  sub_judice boolean,
  lista_ativa boolean,
  arquivo_nome text,
  importado_em timestamptz,
  codigo_vaga text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.monitora_role() = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;
  return query
  select c.id, l.id, l.edital_id, m.edital, m.unidade, c.cargo, c.classificacao,
         c.nota, c.nome, c.modalidade, c.status, c.processo_sei, c.matricula,
         c.sub_judice, l.ativo, l.arquivo_nome, l.importado_em, c.codigo_vaga
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and c.removido_em is null
  order by m.edital, c.cargo, c.classificacao nulls last, c.nome;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Permissões de execução.
-- ---------------------------------------------------------------------------
revoke all on function public.listar_candidatos_aprovados() from public, anon;
revoke all on function public.listar_modelos_convocacao() from public, anon;
revoke all on function public.salvar_modelo_convocacao(jsonb) from public, anon;
revoke all on function public.remover_modelo_convocacao(uuid) from public, anon;
revoke all on function public.listar_configuracao_convocacao() from public, anon;
revoke all on function public.salvar_configuracao_convocacao(text, boolean, uuid, integer, jsonb) from public, anon;

grant execute on function public.listar_candidatos_aprovados() to authenticated;
grant execute on function public.listar_modelos_convocacao() to authenticated;
grant execute on function public.salvar_modelo_convocacao(jsonb) to authenticated;
grant execute on function public.remover_modelo_convocacao(uuid) to authenticated;
grant execute on function public.listar_configuracao_convocacao() to authenticated;
grant execute on function public.salvar_configuracao_convocacao(text, boolean, uuid, integer, jsonb) to authenticated;

commit;
