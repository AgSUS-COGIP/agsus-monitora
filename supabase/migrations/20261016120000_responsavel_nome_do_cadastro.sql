/*
  RESPONSÁVEL PELA ANÁLISE: NOME E SOBRENOME DO CADASTRO

  Por quê: no Painel das análises o "Responsável pela análise" vinha de duas
  fontes que não conversam. A linha da planilha trazia o que a pessoa digitou na
  coluna ("Pietra", "Emanuel", "Natália", "Ana Cirino", "DENIS AUGUSTO"…); a linha
  publicada pela ficha do MONITORA trazia o nome completo do cadastro
  ("Pietra Mello Pires"). A mesma pessoa aparecia com dois nomes, e "Análises por
  responsável" a contava duas vezes.

  Regra: nome e sobrenome do cadastro (TB_PERFIL_USUARIO.nome) — o primeiro nome e
  o último sobrenome, sem partículas (de, da, do, dos, das, e).
    "Pietra Mello Pires" → "Pietra Pires"; "Ana Lilian de Matos Pereira" → "Ana Pereira".
  Quem não tem cadastro fica como está (nunca se apaga o que veio).

  O QUE MUDA
    1. private."FC_NOME_NORMALIZADO"(texto): minúsculas, sem acento e sem espaços
       sobrando — a chave de comparação de nomes (IMMUTABLE).
    2. private."FC_NOME_E_SOBRENOME"(nome): a regra acima (IMMUTABLE).
    3. public."TB_APELIDO_RESPONSAVEL": equivalência "como a planilha escreve" →
       perfil do cadastro, opcionalmente só numa área. Carga inicial com os casos
       reais (pares sem ambiguidade; ver o comentário da carga).
    4. private."FC_NOME_DO_RESPONSAVEL"(texto, grupo): apelido ativo → nome e
       sobrenome do perfil; senão nome completo idêntico (normalizado) ao de UM
       perfil ativo → nome e sobrenome; senão o texto original.
    5. public.processar_sync_analises_lote: grava responsavel_analise pela função.
       Só a gravação muda: hash_registro continua o do payload original (Apps
       Script), e a comparação incremental (comparar_analises_incremental*) compara
       só o hash — o próximo sincronismo não acha que tudo mudou nem volta o nome curto.
    6. private."FC_PUBLICAR_FICHA_ANALISE": grava o nome e sobrenome do perfil de
       quem concluiu/responde pela ficha (antes, o nome completo). Resto igual.

  As linhas que já existem são recompostas pela correção de dados
  supabase/correcoes/20261016-responsavel-nome-do-cadastro.sql.

  Ensaio: supabase/ensaios/20261016120000_responsavel_nome_do_cadastro.sql
  Rollback: supabase/rollback/20261016120000_responsavel_nome_do_cadastro.sql
*/

begin;
set local lock_timeout = '3s';

create or replace function private."FC_NOME_NORMALIZADO"(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $function$
  select nullif(btrim(regexp_replace(
           translate(lower(p_texto),
                     'áàâãäéèêëíìîïóòôõöúùûüçñ',
                     'aaaaaeeeeiiiiooooouuuucn'),
           '\s+', ' ', 'g')), '');
$function$;
comment on function private."FC_NOME_NORMALIZADO"(text) is
  'Chave de comparação de nomes de pessoa: minúsculas, sem acento, espaços colapsados; nulo se vazio. Desde 20261016120000.';
revoke all on function private."FC_NOME_NORMALIZADO"(text) from public, anon, authenticated, service_role;

create or replace function private."FC_NOME_E_SOBRENOME"(p_nome text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $function$
  with t as (
    select regexp_split_to_array(btrim(regexp_replace(p_nome, '\s+', ' ', 'g')), ' ') as a
  )
  select case
           when nullif(btrim(p_nome), '') is null then null
           else t.a[1] || coalesce(' ' || (
             select u.x
               from unnest(t.a) with ordinality as u(x, i)
              where u.i > 1 and lower(u.x) not in ('de', 'da', 'do', 'dos', 'das', 'e')
              order by u.i desc
              limit 1), '')
         end
    from t;
$function$;
comment on function private."FC_NOME_E_SOBRENOME"(text) is
  'Nome e sobrenome de um nome completo: o primeiro nome e o último sobrenome, sem partículas (de, da, do, dos, das, e). "Ana Lilian de Matos Pereira" → "Ana Pereira". Nulo se vazio. Desde 20261016120000.';
revoke all on function private."FC_NOME_E_SOBRENOME"(text) from public, anon, authenticated, service_role;

create table public."TB_APELIDO_RESPONSAVEL" (
  "CO_APELIDO_RESPONSAVEL" bigint generated always as identity,
  "DS_APELIDO" varchar(120) not null,
  "DS_APELIDO_NORMALIZADO" varchar(120) generated always as (private."FC_NOME_NORMALIZADO"("DS_APELIDO")) stored,
  "CO_PERFIL_USUARIO" uuid not null,
  "CO_AREA" text,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  "CO_USUARIO_CRIACAO" uuid,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  constraint "PK_TB_APELIDO_RESPONSAVEL" primary key ("CO_APELIDO_RESPONSAVEL"),
  constraint "FK_PERFILUSUARIO_APELIDORESPONSAVEL" foreign key ("CO_PERFIL_USUARIO")
    references public."TB_PERFIL_USUARIO" (id) on delete cascade,
  constraint "FK_AREA_APELIDORESPONSAVEL" foreign key ("CO_AREA")
    references public."TB_AREA" ("CO_AREA") on update cascade,
  constraint "CK_APELIDORESPONSAVEL_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_APELIDORESPONSAVEL_DSAPELIDO" check (private."FC_NOME_NORMALIZADO"("DS_APELIDO") is not null)
);
create unique index "UK_APELIDORESPONSAVEL_APELIDOAREA"
  on public."TB_APELIDO_RESPONSAVEL" ("DS_APELIDO_NORMALIZADO", coalesce("CO_AREA", ''));
create index "IN_FKAPELIDORESPONSAVEL_PERFIL" on public."TB_APELIDO_RESPONSAVEL" ("CO_PERFIL_USUARIO");
create index "IN_FKAPELIDORESPONSAVEL_AREA" on public."TB_APELIDO_RESPONSAVEL" ("CO_AREA");
alter table public."TB_APELIDO_RESPONSAVEL" enable row level security;
revoke all on table public."TB_APELIDO_RESPONSAVEL" from public, anon, authenticated;
comment on table public."TB_APELIDO_RESPONSAVEL" is
  'Equivalência entre o nome que a planilha de análises escreve na coluna do responsável ("Pietra", "Ana Cirino") e o perfil do cadastro. Lida por private."FC_NOME_DO_RESPONSAVEL" ao gravar TB_ANALISE_CURRICULAR.responsavel_analise. Sem política: só funções SECURITY DEFINER leem.';
comment on column public."TB_APELIDO_RESPONSAVEL"."CO_APELIDO_RESPONSAVEL" is 'Identificador do apelido.';
comment on column public."TB_APELIDO_RESPONSAVEL"."DS_APELIDO" is 'Como a planilha escreve (ex.: "Natália").';
comment on column public."TB_APELIDO_RESPONSAVEL"."DS_APELIDO_NORMALIZADO" is 'DS_APELIDO por FC_NOME_NORMALIZADO (sem acento, caixa e espaços extras); é por ela que se compara.';
comment on column public."TB_APELIDO_RESPONSAVEL"."CO_PERFIL_USUARIO" is 'Perfil do cadastro (TB_PERFIL_USUARIO.id) cujo nome e sobrenome substitui o apelido.';
comment on column public."TB_APELIDO_RESPONSAVEL"."CO_AREA" is 'Área (TB_AREA) em que o apelido vale; nulo: todas. O da área vence o geral.';
comment on column public."TB_APELIDO_RESPONSAVEL"."ST_ATIVO" is 'S: vale; N: ignorado.';
comment on column public."TB_APELIDO_RESPONSAVEL"."DT_CRIACAO" is 'Criação do registro.';
comment on column public."TB_APELIDO_RESPONSAVEL"."CO_USUARIO_CRIACAO" is 'Quem criou (auth.users.id); nulo na carga por migration.';
comment on column public."TB_APELIDO_RESPONSAVEL"."DT_ATUALIZACAO" is 'Última alteração.';
comment on column public."TB_APELIDO_RESPONSAVEL"."CO_USUARIO_ATUALIZACAO" is 'Quem alterou por último (auth.users.id).';
comment on constraint "FK_PERFILUSUARIO_APELIDORESPONSAVEL" on public."TB_APELIDO_RESPONSAVEL" is 'Perfil do apelido; apagar o perfil apaga o apelido.';
comment on constraint "FK_AREA_APELIDORESPONSAVEL" on public."TB_APELIDO_RESPONSAVEL" is 'Área em que o apelido vale.';
comment on index public."UK_APELIDORESPONSAVEL_APELIDOAREA" is 'Um apelido por área (e um geral).';

create or replace function private."FC_NOME_DO_RESPONSAVEL"(p_texto text, p_grupo text default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_norm text := private."FC_NOME_NORMALIZADO"(p_texto);
  v_area text;
  v_nome text;
begin
  if v_norm is null then
    return p_texto;
  end if;
  select a."CO_AREA" into v_area
    from public."TB_AREA" a
   where private."FC_NOME_NORMALIZADO"(a."NO_GRUPO_PLANILHA") = private."FC_NOME_NORMALIZADO"(p_grupo)
   limit 1;
  -- 1. apelido ativo (o da área vence o geral).
  select p.nome into v_nome
    from public."TB_APELIDO_RESPONSAVEL" ap
    join public."TB_PERFIL_USUARIO" p on p.id = ap."CO_PERFIL_USUARIO"
   where ap."DS_APELIDO_NORMALIZADO" = v_norm
     and ap."ST_ATIVO" = 'S'
     and (ap."CO_AREA" is null or ap."CO_AREA" = v_area)
   order by ap."CO_AREA" is null
   limit 1;
  -- 2. nome completo idêntico ao de um (e só um) perfil ativo.
  if v_nome is null then
    select case when count(*) = 1 then min(p.nome) end into v_nome
      from public."TB_PERFIL_USUARIO" p
     where p.ativo and private."FC_NOME_NORMALIZADO"(p.nome) = v_norm;
  end if;
  -- 3. sem cadastro: o texto original.
  return coalesce(private."FC_NOME_E_SOBRENOME"(v_nome), p_texto);
end;
$function$;
comment on function private."FC_NOME_DO_RESPONSAVEL"(text, text) is
  'Responsável pela análise como o painel mostra: apelido de TB_APELIDO_RESPONSAVEL (da área do grupo ou geral) → nome e sobrenome do perfil; senão nome completo de um perfil ativo → nome e sobrenome; senão o texto original (nunca apaga). Desde 20261016120000.';
revoke all on function private."FC_NOME_DO_RESPONSAVEL"(text, text) from public, anon, authenticated, service_role;

/*
  Carga inicial: nomes distintos de TB_ANALISE_CURRICULAR.responsavel_analise
  (16/10/2026) cujo texto casa com UM perfil ativo — o primeiro nome igual e as
  demais palavras dentro do nome do cadastro. Sem cadastro (ficam como estão):
  Projetos — Suzana Carvalho, Suzana Ximenes, Marcia Silva, João Victor de Jesus;
  Saúde Indígena — Ana Gabrielly, Daniele Oliveira, Hélia Cassemiro, José Henrique
  S S F, Joyce Lemos, Jucimeire Pankararu, Larissa Prado (o cadastro é Larissa
  Silva), Lucas F./Lucas Fernandes, Manuella Xukuru, Mateus Neves, Paloma Pires,
  Paloma Ramos, Raianea Garcia, Tairine Melo, Victoria Azevedo, Vitor Ribeiro Costa,
  Yasmin/Yasmin Saldanha; e os rótulos CCOPS - RECURSO, RECURSO CCOPS, Treinamento.
  "Vanessa dos Santos Silva" e "Fabiana de Almeida Santos" já são o nome completo
  do cadastro (a regra 2 resolve; Fabiana entra também como apelido, por pedido).
*/
insert into public."TB_APELIDO_RESPONSAVEL" ("DS_APELIDO", "CO_PERFIL_USUARIO", "CO_AREA")
select v.apelido, p.id, v.area
  from (values
    ('Pietra', 'Pietra Mello Pires', 'projetos'),
    ('Emanuel', 'Emanuel Serrano', 'projetos'),
    ('Natália', 'Natalia Santos', 'projetos'),
    ('Ana Cirino', 'Ana Beatriz Jales Cirino', 'projetos'),
    ('Ana Lilian', 'Ana Lilian de Matos Pereira', 'projetos'),
    ('Valdeir', 'Valdeir Neves', 'projetos'),
    ('Fabiana de Almeida Santos', 'Fabiana de Almeida Santos', 'projetos'),
    ('Denis Augusto', 'Denis Augusto da Silva Pontifice de Oliveira', 'saude-indigena'),
    ('Ester Castro', 'Ester Castro De Lima', 'saude-indigena'),
    ('Expedito Arcanjo', 'Expedito Arcanjo de Sousa Junior', 'saude-indigena'),
    ('Fernanda Cassiano', 'Fernanda Cassiano De Lima', 'saude-indigena'),
    ('Lucas Machado', 'Lucas Leal Machado', 'saude-indigena'),
    ('Thais Jansen', 'Thaís Jansen Oliveira', 'saude-indigena')
  ) as v(apelido, nome_cadastro, area)
  join public."TB_PERFIL_USUARIO" p
    on private."FC_NOME_NORMALIZADO"(p.nome) = private."FC_NOME_NORMALIZADO"(v.nome_cadastro)
   and p.ativo
  join public."TB_AREA" a on a."CO_AREA" = v.area
on conflict do nothing;

-- 5. Sincronismo das planilhas: o mesmo corpo de antes, com responsavel_analise pela função.
CREATE OR REPLACE FUNCTION public.processar_sync_analises_lote(p_sync_id uuid, p_limite integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
 SET statement_timeout TO '20s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_limite integer := greatest(1, least(coalesce(p_limite,250),500));
  v_cursor integer := 0;
  v_novo_cursor integer := 0;
  v_lidas integer := 0;
  v_alteradas integer := 0;
  v_lidas_total integer := 0;
  v_alteradas_total integer := 0;
  v_planilha text;
  v_grupo_norm text;
  v_validada boolean := false;
  v_fora integer := 0;
  v_conflitos integer := 0;
  v_monitora integer := 0;
  v_monitora_total integer := 0;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha] planilha pela origem do sync; lock e checagens por planilha.
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync % indisponivel para processamento em lotes.', p_sync_id; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises ja esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce((resultado->>'planilha_validada')::boolean,false)
    into v_cursor,v_validada
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and status in ('carregado','processando')
  order by id desc limit 1;
  if not found then raise exception 'Sync % indisponivel para processamento em lotes.', p_sync_id; end if;

  -- [por-planilha] porteiro: o staging inteiro, uma vez por sync.
  if not v_validada then
    perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);
  end if;

  select public.analises_norm_key(a."NO_GRUPO_PLANILHA") into v_grupo_norm
  from public."TB_PLANILHA_ANALISE" p join public."TB_AREA" a on a."CO_AREA"=p."CO_AREA"
  where p."CO_PLANILHA"=v_planilha;

  create temporary table tmp_lote on commit drop as
  select s.*
  from public."TM_ANALISE_CURRICULAR" s
  where s.sync_id=p_sync_id
    and s.entidade='FATO_ANALISES'
    and coalesce(s.linha_origem,0)>v_cursor
  order by s.linha_origem,s.id
  limit v_limite;

  select count(*)::integer, coalesce(max(linha_origem),v_cursor)::integer
    into v_lidas,v_novo_cursor
  from tmp_lote;

  if v_lidas=0 then
    return jsonb_build_object('ok',true,'sync_id',p_sync_id,'lidas',0,'alteradas',0,'cursor',v_cursor,'concluido_fato',true);
  end if;

  -- [por-planilha] o que este lote grava é do grupo da planilha e não é de outra planilha.
  select count(*)::integer into v_fora
  from tmp_lote s
  where coalesce(public.analises_norm_key(public.jsonb_text_or_null(s.payload,'grupo')),'') <> v_grupo_norm;
  if v_fora > 0 then
    raise exception 'Sync % recusado pelo porteiro: % linha(s) do lote com grupo diferente do grupo da planilha %. Nada foi gravado.', p_sync_id, v_fora, v_planilha
      using errcode = '22023';
  end if;

  -- [monitora] edital com a avaliação no MONITORA e linha publicada pela ficha: a planilha
  -- não grava nem muda (20261009200000). O cursor anda mesmo assim.
  delete from tmp_lote s
   where public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, public.jsonb_text_or_null(s.payload,'edital'))
      or exists (select 1 from public."TB_ANALISE_CURRICULAR" a
                  where a."TP_ORIGEM_REGISTRO" = 'MONITORA'
                    and a.chave_natural=public.analises_make_chave_natural(
                      public.jsonb_text_or_null(s.payload,'grupo'),
                      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
                      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
                      public.jsonb_text_or_null(s.payload,'codigo_vaga'),
                      public.jsonb_text_or_null(s.payload,'id'),
                      public.jsonb_text_or_null(s.payload,'candidato')));
  get diagnostics v_monitora=row_count;

  select count(*)::integer into v_conflitos
  from tmp_lote s
  join public."TB_ANALISE_CURRICULAR" a
    on a.chave_natural=public.analises_make_chave_natural(
        public.jsonb_text_or_null(s.payload,'grupo'),
        coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
        coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
        public.jsonb_text_or_null(s.payload,'codigo_vaga'),
        public.jsonb_text_or_null(s.payload,'id'),
        public.jsonb_text_or_null(s.payload,'candidato'))
  where a."CO_PLANILHA" <> v_planilha;
  if v_conflitos > 0 then
    raise exception 'Sync % recusado: % analise(s) do lote ja pertencem a outra planilha (mesma chave_natural). Nada foi gravado.', p_sync_id, v_conflitos
      using errcode = '22023';
  end if;

  with dados as (
    select
      public.analises_make_chave_natural(
        public.jsonb_text_or_null(s.payload,'grupo'),
        coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
        coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
        public.jsonb_text_or_null(s.payload,'codigo_vaga'),
        public.jsonb_text_or_null(s.payload,'id'),
        public.jsonb_text_or_null(s.payload,'candidato')) as chave_natural,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      public.jsonb_text_or_null(s.payload,'codigo_vaga') as codigo_vaga,
      public.jsonb_text_or_null(s.payload,'nome_vaga') as nome_vaga,
      public.jsonb_text_or_null(s.payload,'regime') as regime,
      public.jsonb_text_or_null(s.payload,'carga_horaria') as carga_horaria,
      public.jsonb_text_or_null(s.payload,'categoria') as categoria,
      public.jsonb_text_or_null(s.payload,'candidato') as candidato,
      public.jsonb_text_or_null(s.payload,'id') as id_origem,
      public.jsonb_date_or_null(s.payload,'data_nascimento') as data_nascimento,
      public.jsonb_int_or_null(s.payload,'idade') as idade,
      public.jsonb_num_or_null(s.payload,'nota_empregare') as nota_empregare,
      public.jsonb_text_or_null(s.payload,'modalidade_concorrencia') as modalidade_concorrencia,
      public.jsonb_num_or_null(s.payload,'nota_final_ajustada') as nota_final_ajustada,
      public.jsonb_num_or_null(s.payload,'somatorio') as somatorio,
      public.jsonb_num_or_null(s.payload,'pontuacao_escolaridade') as pontuacao_escolaridade,
      public.jsonb_num_or_null(s.payload,'pontuacao_cursos_aperfeicoamento') as pontuacao_cursos_aperfeicoamento,
      public.jsonb_num_or_null(s.payload,'pontuacao_experiencia_profissional') as pontuacao_experiencia_profissional,
      public.jsonb_num_or_null(s.payload,'pontuacao_criterio_etnico') as pontuacao_criterio_etnico,
      public.jsonb_num_or_null(s.payload,'experiencia_saude_indigena_total') as experiencia_saude_indigena_total,
      public.jsonb_num_or_null(s.payload,'experiencia_atencao_basica_total') as experiencia_atencao_basica_total,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_anos') as experiencia_profissional_anos,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_meses') as experiencia_profissional_meses,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_dias') as experiencia_profissional_dias,
      public.jsonb_num_or_null(s.payload,'experiencia_profissional_total') as experiencia_profissional_total,
      public.jsonb_text_or_null(s.payload,'etapa') as etapa,
      public.jsonb_date_or_null(s.payload,'data_analise') as data_analise,
      public.jsonb_text_or_null(s.payload,'analise') as analise,
      public.jsonb_text_or_null(s.payload,'pcd') as pcd,
      -- [responsavel] nome e sobrenome do cadastro (FC_NOME_DO_RESPONSAVEL, 20261016120000). Só na gravação:
      -- hash_registro segue o do payload original (a comparação incremental não muda).
      private."FC_NOME_DO_RESPONSAVEL"(public.jsonb_text_or_null(s.payload,'responsavel_analise'),
                                       public.jsonb_text_or_null(s.payload,'grupo')) as responsavel_analise,
      public.jsonb_text_or_null(s.payload,'coord_demandante') as coord_demandante,
      public.jsonb_text_or_null(s.payload,'email_demandante') as email_demandante,
      coalesce(public.jsonb_text_or_null(s.payload,'status_consolidado'),'Pendente') as status_consolidado,
      public.jsonb_text_or_null(s.payload,'origem_planilha') as origem_planilha,
      public.jsonb_text_or_null(s.payload,'origem_arquivo_id') as origem_arquivo_id,
      coalesce(public.jsonb_timestamptz_or_null(s.payload,'ultima_atualizacao'),now()) as ultima_atualizacao,
      public.jsonb_text_or_null(s.payload,'pdf_gerado') as pdf_gerado,
      public.jsonb_text_or_null(s.payload,'link_pdf') as link_pdf,
      public.jsonb_timestamptz_or_null(s.payload,'data_geracao_pdf') as data_geracao_pdf,
      public.jsonb_text_or_null(s.payload,'erro_pdf') as erro_pdf,
      public.jsonb_text_or_null(s.payload,'pdf_status') as pdf_status,
      public.jsonb_text_or_null(s.payload,'pdf_file_id') as pdf_file_id,
      public.jsonb_timestamptz_or_null(s.payload,'pdf_ultima_tentativa') as pdf_ultima_tentativa,
      public.jsonb_text_or_null(s.payload,'pdf_hash_origem') as pdf_hash_origem,
      s.linha_origem,
      s.hash_registro
    from tmp_lote s
  )
  insert into public."TB_ANALISE_CURRICULAR"(
    chave_natural,grupo,unidade,edital,codigo_vaga,nome_vaga,regime,carga_horaria,categoria,candidato,
    id_origem,data_nascimento,idade,nota_empregare,modalidade_concorrencia,nota_final_ajustada,somatorio,
    pontuacao_escolaridade,pontuacao_cursos_aperfeicoamento,pontuacao_experiencia_profissional,
    pontuacao_criterio_etnico,experiencia_saude_indigena_total,experiencia_atencao_basica_total,
    experiencia_profissional_anos,experiencia_profissional_meses,experiencia_profissional_dias,experiencia_profissional_total,
    etapa,data_analise,analise,pcd,responsavel_analise,coord_demandante,email_demandante,status_consolidado,
    origem_planilha,origem_arquivo_id,ultima_atualizacao,pdf_gerado,link_pdf,data_geracao_pdf,erro_pdf,pdf_status,
    pdf_file_id,pdf_ultima_tentativa,pdf_hash_origem,linha_origem,hash_registro,ativo,updated_at,"CO_PLANILHA")
  select
    d.chave_natural,d.grupo,d.unidade,d.edital,d.codigo_vaga,d.nome_vaga,d.regime,d.carga_horaria,d.categoria,d.candidato,
    d.id_origem,d.data_nascimento,d.idade,d.nota_empregare,d.modalidade_concorrencia,d.nota_final_ajustada,d.somatorio,
    d.pontuacao_escolaridade,d.pontuacao_cursos_aperfeicoamento,d.pontuacao_experiencia_profissional,
    d.pontuacao_criterio_etnico,d.experiencia_saude_indigena_total,d.experiencia_atencao_basica_total,
    d.experiencia_profissional_anos,d.experiencia_profissional_meses,d.experiencia_profissional_dias,d.experiencia_profissional_total,
    d.etapa,d.data_analise,d.analise,d.pcd,d.responsavel_analise,d.coord_demandante,d.email_demandante,d.status_consolidado,
    d.origem_planilha,d.origem_arquivo_id,d.ultima_atualizacao,
    coalesce(d.pdf_gerado,a.pdf_gerado),coalesce(d.link_pdf,a.link_pdf),coalesce(d.data_geracao_pdf,a.data_geracao_pdf),
    coalesce(d.erro_pdf,a.erro_pdf),coalesce(d.pdf_status,a.pdf_status),coalesce(d.pdf_file_id,a.pdf_file_id),
    coalesce(d.pdf_ultima_tentativa,a.pdf_ultima_tentativa),coalesce(d.pdf_hash_origem,a.pdf_hash_origem),
    d.linha_origem,d.hash_registro,true,now(),v_planilha
  from dados d
  left join public."TB_ANALISE_CURRICULAR" a on a.chave_natural=d.chave_natural
  on conflict (chave_natural) do update set
    grupo=excluded.grupo,unidade=excluded.unidade,edital=excluded.edital,codigo_vaga=excluded.codigo_vaga,
    nome_vaga=excluded.nome_vaga,regime=excluded.regime,carga_horaria=excluded.carga_horaria,categoria=excluded.categoria,
    candidato=excluded.candidato,id_origem=excluded.id_origem,data_nascimento=excluded.data_nascimento,idade=excluded.idade,
    nota_empregare=excluded.nota_empregare,modalidade_concorrencia=excluded.modalidade_concorrencia,
    nota_final_ajustada=excluded.nota_final_ajustada,somatorio=excluded.somatorio,pontuacao_escolaridade=excluded.pontuacao_escolaridade,
    pontuacao_cursos_aperfeicoamento=excluded.pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional=excluded.pontuacao_experiencia_profissional,
    pontuacao_criterio_etnico=excluded.pontuacao_criterio_etnico,experiencia_saude_indigena_total=excluded.experiencia_saude_indigena_total,
    experiencia_atencao_basica_total=excluded.experiencia_atencao_basica_total,
    experiencia_profissional_anos=excluded.experiencia_profissional_anos,experiencia_profissional_meses=excluded.experiencia_profissional_meses,
    experiencia_profissional_dias=excluded.experiencia_profissional_dias,experiencia_profissional_total=excluded.experiencia_profissional_total,
    etapa=excluded.etapa,data_analise=excluded.data_analise,
    analise=excluded.analise,pcd=excluded.pcd,responsavel_analise=excluded.responsavel_analise,
    coord_demandante=excluded.coord_demandante,email_demandante=excluded.email_demandante,status_consolidado=excluded.status_consolidado,
    origem_planilha=excluded.origem_planilha,origem_arquivo_id=excluded.origem_arquivo_id,ultima_atualizacao=excluded.ultima_atualizacao,
    pdf_gerado=excluded.pdf_gerado,link_pdf=excluded.link_pdf,data_geracao_pdf=excluded.data_geracao_pdf,erro_pdf=excluded.erro_pdf,
    pdf_status=excluded.pdf_status,pdf_file_id=excluded.pdf_file_id,pdf_ultima_tentativa=excluded.pdf_ultima_tentativa,
    pdf_hash_origem=excluded.pdf_hash_origem,linha_origem=excluded.linha_origem,hash_registro=excluded.hash_registro,ativo=true,updated_at=now()
  where "TB_ANALISE_CURRICULAR"."CO_PLANILHA"=excluded."CO_PLANILHA"
    -- [monitora] linha publicada pela ficha nunca é sobrescrita pela planilha.
    and "TB_ANALISE_CURRICULAR"."TP_ORIGEM_REGISTRO"='PLANILHA';

  get diagnostics v_alteradas=row_count;

  select coalesce(nullif(resultado->>'lote_lidas','')::integer,0)+v_lidas,
         coalesce(nullif(resultado->>'lote_alteradas','')::integer,0)+v_alteradas,
         coalesce(nullif(resultado->>'lote_ignoradas_monitora','')::integer,0)+v_monitora
    into v_lidas_total,v_alteradas_total,v_monitora_total
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id
  order by id desc limit 1;

  update public."TL_SYNC_ANALISE"
  set status='processando',
      resultado=coalesce(resultado,'{}'::jsonb)||jsonb_build_object(
        'modo_processamento','lotes','lote_cursor',v_novo_cursor,'lote_lidas',v_lidas_total,
        'lote_alteradas',v_alteradas_total,'ultimo_lote_lidas',v_lidas,'ultimo_lote_alteradas',v_alteradas,
        'lote_ignoradas_monitora',v_monitora_total,
        'ultimo_lote_em',now(),'planilha',v_planilha,'planilha_validada',true),
      updated_at=now()
  where sync_id=p_sync_id;

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'lidas',v_lidas,'alteradas',v_alteradas,
    'ignoradas_monitora',v_monitora,
    'lidas_total',v_lidas_total,'alteradas_total',v_alteradas_total,'cursor',v_novo_cursor,'concluido_fato',v_lidas<v_limite);
end;
$function$;
revoke all on function public.processar_sync_analises_lote(uuid, integer) from public, anon, authenticated;
grant execute on function public.processar_sync_analises_lote(uuid, integer) to service_role;

-- 6. Publicação da ficha: o mesmo corpo de antes, com o nome e sobrenome do cadastro.
CREATE OR REPLACE FUNCTION private."FC_PUBLICAR_FICHA_ANALISE"(p_ficha uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_c public."TB_EMPREGARE_CANDIDATO";
  v_p public."TB_PRE_CLASSIFICACAO";
  v_pv public."TB_PRE_CLASSIF_VAGA";
  v_grupo text;
  v_planilha text;
  v_numero text;
  v_codigo text;
  v_chave text;
  v_id uuid;
  v_com_nota boolean;
  v_inapto_requisito boolean;
  v_status text;
  v_etapa text;
  v_responsavel text;
  v_data date;
  v_nome_vaga text;
  v_modalidade text;
  v_pcd text;
  v_cotas text[];
  v_parciais jsonb;
  v_exp jsonb;
  v_dias integer;
  v_exp_si numeric;
  v_exp_ab numeric;
  v_formacao numeric;
  v_cursos numeric;
  v_experiencia numeric;
  v_etnico numeric;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if not found then
    return null;
  end if;
  -- Só o edital com a avaliação no MONITORA publica (PLANILHA e COMPARACAO não).
  if not exists (select 1 from public."TB_ORIGEM_ANALISE_EDITAL" o
                  where o."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and o."TP_ORIGEM" = 'MONITORA') then
    return null;
  end if;

  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_f."CO_MONITORAMENTO";
  select a."NO_GRUPO_PLANILHA" into v_grupo from public."TB_AREA" a where a."CO_AREA" = v_m."CO_AREA";
  select p."CO_PLANILHA" into v_planilha
    from public."TB_PLANILHA_ANALISE" p
   where p."CO_AREA" = v_m."CO_AREA"
   order by p."CO_PLANILHA" = v_m."CO_AREA" desc, p."CO_PLANILHA"
   limit 1;
  if v_grupo is null or v_planilha is null then
    raise exception 'Área % sem grupo ou planilha de análises: a ficha não tem onde publicar', v_m."CO_AREA"
      using errcode = '23514';
  end if;

  select * into v_c from public."TB_EMPREGARE_CANDIDATO" where "CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
  select * into v_p from public."TB_PRE_CLASSIFICACAO"
   where "CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and "CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
  select * into v_pv from public."TB_PRE_CLASSIF_VAGA"
   where "CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and "CO_VAGA" = v_f."CO_VAGA";

  -- Situação e etapa no vocabulário da planilha (o que o painel e a Classificação leem).
  v_com_nota := v_f."TP_RESULTADO" is not null and v_f."TP_SITUACAO" in ('CONCLUIDA', 'REVISAR');
  v_inapto_requisito := v_f."TP_RESULTADO" = 'INAPTO_REQUISITO';
  v_status := case
    when v_f."TP_SITUACAO" = 'CONCLUIDA' and v_f."TP_RESULTADO" = 'APTO' then 'Aprovado'
    when v_f."TP_SITUACAO" = 'CONCLUIDA' then 'Reprovado'
    when v_f."TP_SITUACAO" = 'REVISAR' then 'Revisar'
    when v_f."TP_SITUACAO" = 'EM_ANALISE' then 'Em análise'
    else 'Pendente'
  end;
  -- Etapa só com decisão, como na planilha (sem decisão, nem etapa nem data).
  v_etapa := case
    when v_status = 'Aprovado' then 'Triados'
    when v_status = 'Reprovado' then 'Reprovado'
    when v_status = 'Revisar' then 'Avaliação documental'
  end;
  -- Nome e sobrenome do cadastro (FC_NOME_E_SOBRENOME, 20261016120000), como no Painel das análises.
  select coalesce(private."FC_NOME_E_SOBRENOME"(u.nome), u.email) into v_responsavel
    from public."TB_PERFIL_USUARIO" u
   where u.user_id = coalesce(case when v_com_nota then v_f."CO_USUARIO_CONCLUSAO" end, v_f."CO_USUARIO_RESPONSAVEL")
   order by u.ativo desc nulls last
   limit 1;
  v_data := case when v_com_nota
                 then (coalesce(v_f."DT_CONCLUSAO", v_f."DT_ATUALIZACAO") at time zone 'America/Sao_Paulo')::date end;

  -- O nome da vaga pelo cargo e lotação da pré-classificação (FC_NOME_VAGA_PUBLICADA, 20261015151000).
  v_nome_vaga := private."FC_NOME_VAGA_PUBLICADA"(v_f."CO_MONITORAMENTO", v_f."CO_VAGA");
  -- A modalidade e a PcD pelas cotas da ficha (20261015150000): antes da análise, as optadas;
  -- analisada, as confirmadas (sem as de bloco Não conforme/Não enviado). Todas vão para a
  -- linha ("Pretos e pardos | Pessoas com deficiência (PCD)"): a Classificação põe o candidato
  -- nas listas de todas na preliminar (5.8.7) e, na final, só na de maior percentual (5.8.5 e
  -- 5.8.6, cotas.acumulo da regra de classificação). Nenhuma: "Ampla concorrência".
  v_cotas := private."FC_MODALIDADES_DA_FICHA"(p_ficha);
  v_modalidade := private."FC_MODALIDADES_PUBLICADAS"(v_cotas);
  v_pcd := private."FC_PCD_DAS_MODALIDADES"(v_cotas);

  -- Parciais e experiência só da ficha concluída (ou em revisão); inapto por requisito vale 0.
  if v_com_nota then
    v_parciais := v_f."DS_RESULTADO" -> 'parciais';
    v_exp := v_f."DS_RESULTADO" -> 'experiencia';
    v_formacao := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'FORMACAO'), 0) end;
    v_cursos := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'CURSOS'), 0) end;
    v_experiencia := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'EXPERIENCIA'), 0) end;
    v_etnico := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'ETNICO'), 0) end;
    v_dias := public.jsonb_int_or_null(v_exp, 'dias_total');
    if jsonb_typeof(v_exp -> 'por_categoria') = 'object' then
      select sum(public.jsonb_num_or_null(c.value, 'dias_total')) filter (where c.key ilike '%indigen%'),
             sum(public.jsonb_num_or_null(c.value, 'dias_total')) filter (where c.key ilike '%atenc%basic%' or c.key ilike '%aps%')
        into v_exp_si, v_exp_ab
        from jsonb_each(v_exp -> 'por_categoria') c
       where jsonb_typeof(c.value) = 'object';
    end if;
  end if;

  -- A linha: a da ficha, ou a da planilha (mesmo edital, vaga e código), adotada; MONITORA primeiro.
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  v_codigo := nullif(btrim(v_c."CO_CANDIDATO_EMPREGARE"), '');
  v_chave := 'monitora|' || v_f."CO_MONITORAMENTO" || '|' || v_f."CO_EMPREGARE_CANDIDATO";
  select a.id into v_id from public."TB_ANALISE_CURRICULAR" a where a.chave_natural = v_chave;
  if v_id is null and v_codigo is not null and v_numero is not null then
    select a.id into v_id
      from public."TB_ANALISE_CURRICULAR" a
     where btrim(a.id_origem) = v_codigo
       and a.codigo_vaga = v_f."CO_VAGA"
       and a."CO_AREA" = v_m."CO_AREA"
       and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
     order by a."TP_ORIGEM_REGISTRO" = 'MONITORA' desc, a.ativo desc, a.updated_at desc, a.id
     limit 1;
  end if;

  if v_id is null then
    insert into public."TB_ANALISE_CURRICULAR" (
      chave_natural, grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, id_origem, data_nascimento,
      modalidade_concorrencia, pcd, nota_empregare, status_consolidado, etapa, responsavel_analise, data_analise,
      nota_final_ajustada, somatorio, pontuacao_escolaridade, pontuacao_cursos_aperfeicoamento,
      pontuacao_experiencia_profissional, pontuacao_criterio_etnico, experiencia_saude_indigena_total,
      experiencia_atencao_basica_total, experiencia_profissional_anos, experiencia_profissional_meses,
      experiencia_profissional_dias, experiencia_profissional_total, analise, origem_planilha, ativo,
      ultima_atualizacao, "CO_PLANILHA", "TP_ORIGEM_REGISTRO")
    values (
      v_chave, v_grupo, coalesce(nullif(btrim(v_m.unidade), ''), 'Não informada'), coalesce(nullif(btrim(v_m.edital), ''), 'Sem edital'),
      v_f."CO_VAGA", v_nome_vaga, v_c."NO_CANDIDATO", v_codigo, v_c."DT_NASCIMENTO",
      v_modalidade, v_pcd, v_p."VL_ART", v_status, v_etapa, v_responsavel, v_data,
      case when v_com_nota then v_f."VL_NOTA_FINAL" end, case when v_com_nota then v_f."VL_NOTA_APURADA" end,
      v_formacao, v_cursos, v_experiencia, v_etnico, v_exp_si, v_exp_ab,
      v_dias / 365, (v_dias % 365) / 30, (v_dias % 365) % 30, v_dias,
      case when v_com_nota then v_f."DS_PARECER" end,
      case when private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO") then 'treinamento' end,
      v_f."TP_SITUACAO" <> 'FORA_LOTE', now(), v_planilha, 'MONITORA')
    returning id into v_id;
    return v_id;
  end if;

  -- Linha existente: edital, unidade e grupo ficam (a linha adotada mantém a identidade da planilha).
  update public."TB_ANALISE_CURRICULAR" a set
    codigo_vaga = v_f."CO_VAGA",
    nome_vaga = coalesce(v_nome_vaga, a.nome_vaga),
    candidato = coalesce(v_c."NO_CANDIDATO", a.candidato),
    id_origem = coalesce(v_codigo, a.id_origem),
    data_nascimento = coalesce(v_c."DT_NASCIMENTO", a.data_nascimento),
    modalidade_concorrencia = coalesce(v_modalidade, a.modalidade_concorrencia),
    pcd = v_pcd,
    nota_empregare = coalesce(v_p."VL_ART", a.nota_empregare),
    status_consolidado = v_status,
    etapa = v_etapa,
    responsavel_analise = v_responsavel,
    data_analise = v_data,
    nota_final_ajustada = case when v_com_nota then v_f."VL_NOTA_FINAL" end,
    somatorio = case when v_com_nota then v_f."VL_NOTA_APURADA" end,
    pontuacao_escolaridade = v_formacao,
    pontuacao_cursos_aperfeicoamento = v_cursos,
    pontuacao_experiencia_profissional = v_experiencia,
    pontuacao_criterio_etnico = v_etnico,
    experiencia_saude_indigena_total = v_exp_si,
    experiencia_atencao_basica_total = v_exp_ab,
    experiencia_profissional_anos = v_dias / 365,
    experiencia_profissional_meses = (v_dias % 365) / 30,
    experiencia_profissional_dias = (v_dias % 365) % 30,
    experiencia_profissional_total = v_dias,
    analise = case when v_com_nota then v_f."DS_PARECER" end,
    ativo = v_f."TP_SITUACAO" <> 'FORA_LOTE',
    "TP_ORIGEM_REGISTRO" = 'MONITORA',
    ultima_atualizacao = now()
   where a.id = v_id
     and (a.codigo_vaga, a.nome_vaga, a.candidato, a.id_origem, a.data_nascimento, a.modalidade_concorrencia, a.pcd,
          a.nota_empregare, a.status_consolidado, a.etapa, a.responsavel_analise, a.data_analise, a.nota_final_ajustada,
          a.somatorio, a.pontuacao_escolaridade, a.pontuacao_cursos_aperfeicoamento, a.pontuacao_experiencia_profissional,
          a.pontuacao_criterio_etnico, a.experiencia_saude_indigena_total, a.experiencia_atencao_basica_total,
          a.experiencia_profissional_total, a.analise, a.ativo, a."TP_ORIGEM_REGISTRO")
         is distinct from
         (v_f."CO_VAGA"::text, coalesce(v_nome_vaga, a.nome_vaga), coalesce(v_c."NO_CANDIDATO"::text, a.candidato),
          coalesce(v_codigo, a.id_origem), coalesce(v_c."DT_NASCIMENTO", a.data_nascimento),
          private.normalizar_modalidade_concorrencia(coalesce(v_modalidade, a.modalidade_concorrencia)), v_pcd,
          coalesce(v_p."VL_ART", a.nota_empregare), v_status, v_etapa, v_responsavel, v_data,
          case when v_com_nota then v_f."VL_NOTA_FINAL" end, case when v_com_nota then v_f."VL_NOTA_APURADA" end,
          v_formacao, v_cursos, v_experiencia, v_etnico, v_exp_si, v_exp_ab, v_dias::numeric,
          case when v_com_nota then v_f."DS_PARECER" end, v_f."TP_SITUACAO" <> 'FORA_LOTE', 'MONITORA'::varchar);
  return v_id;
end;
$function$;
revoke all on function private."FC_PUBLICAR_FICHA_ANALISE"(uuid) from public, anon, authenticated, service_role;

commit;
