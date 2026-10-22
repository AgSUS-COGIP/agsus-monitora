/*
  ENSAIO — 20261001180000_locais_das_vagas_dos_projetos.sql + locais dos PDFs

  Roda tudo numa transação e desfaz no fim (rollback): nada fica no banco.
  Ordem: migration (tabela + RPC nova), SQL de dados
  (supabase/correcoes/20261001-locais-das-vagas-dos-projetos.sql), conferências,
  rollback. Cole inteiro no SQL Editor do Supabase.

  O que conferir:
  1. editais: cada edital da lista com o id achado em TB_MONITORAMENTO_INDIGENA
     (id nulo = não cadastrado com esse número/unidade em 'projetos' — os locais
     dele não entram);
  2. locais por projeto/edital: municípios, só-UF e vagas;
  3. a RPC como um usuário com a área Projetos (troque o e-mail abaixo): uma
     linha por lugar, projetos e editais de cada um, e os municípios do
     Caminhoneiros com os candidatos de antes;
  4. a forma antiga continua: municipio_uf, vagas, candidatos, aprovados,
     reprovados em toda linha de município.
*/
begin;

-- ===========================================================================
-- Migration
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table public."TB_LOCAL_VAGA_EDITAL" (
  "CO_LOCAL_VAGA" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_MUNICIPIO_IBGE" integer,
  "NO_MUNICIPIO" varchar(100),
  "SG_UF" varchar(2) not null,
  "NO_CARGO" varchar(300),
  "NO_LOTACAO" varchar(300),
  "QT_VAGA" integer,
  "ST_CADASTRO_RESERVA" varchar(1) not null default 'N',
  "TP_ORIGEM" varchar(10) not null default 'PDF',
  "DS_ARQUIVO_ORIGEM" varchar(500),
  "DS_PAGINA_ORIGEM" varchar(100),
  "DS_OBSERVACAO" varchar(300),
  "ST_REGISTRO_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_DESATIVACAO" timestamptz,
  constraint "PK_TB_LOCAL_VAGA_EDITAL" primary key ("CO_LOCAL_VAGA"),
  constraint "FK_MONITORAMENTO_LOCALVAGA" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_LOCALVAGA_MUNICIPIO" check ("CO_MUNICIPIO_IBGE" between 1100000 and 5399999),
  -- Município e nome andam juntos; os dois primeiros dígitos do código são a UF.
  constraint "CK_LOCALVAGA_NOMUNICIPIO" check (("CO_MUNICIPIO_IBGE" is null) = ("NO_MUNICIPIO" is null)),
  constraint "CK_LOCALVAGA_UF" check ("SG_UF" in (
    'RO', 'AC', 'AM', 'RR', 'PA', 'AP', 'TO', 'MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA',
    'MG', 'ES', 'RJ', 'SP', 'PR', 'SC', 'RS', 'MS', 'MT', 'GO', 'DF')),
  constraint "CK_LOCALVAGA_MUNICIPIOUF" check ("CO_MUNICIPIO_IBGE" is null or "SG_UF" = (case "CO_MUNICIPIO_IBGE" / 100000
    when 11 then 'RO' when 12 then 'AC' when 13 then 'AM' when 14 then 'RR' when 15 then 'PA' when 16 then 'AP'
    when 17 then 'TO' when 21 then 'MA' when 22 then 'PI' when 23 then 'CE' when 24 then 'RN' when 25 then 'PB'
    when 26 then 'PE' when 27 then 'AL' when 28 then 'SE' when 29 then 'BA' when 31 then 'MG' when 32 then 'ES'
    when 33 then 'RJ' when 35 then 'SP' when 41 then 'PR' when 42 then 'SC' when 43 then 'RS' when 50 then 'MS'
    when 51 then 'MT' when 52 then 'GO' when 53 then 'DF' end)),
  constraint "CK_LOCALVAGA_QT" check ("QT_VAGA" between 0 and 9999),
  constraint "CK_LOCALVAGA_STCR" check ("ST_CADASTRO_RESERVA" in ('S', 'N')),
  constraint "CK_LOCALVAGA_TPORIGEM" check ("TP_ORIGEM" in ('PDF', 'NOME_VAGA', 'MANUAL')),
  constraint "CK_LOCALVAGA_STATIVO" check ("ST_REGISTRO_ATIVO" in ('S', 'N'))
);

-- Um lugar por edital, cargo e lotação entre as linhas ativas (o SQL de dados é idempotente).
create unique index "UK_LOCALVAGA_LOCAL" on public."TB_LOCAL_VAGA_EDITAL" (
  "CO_MONITORAMENTO", "SG_UF", coalesce("CO_MUNICIPIO_IBGE", 0), coalesce("NO_CARGO", ''), coalesce("NO_LOTACAO", '')
) where "ST_REGISTRO_ATIVO" = 'S';
create index "IN_LOCALVAGA_MUNICIPIO" on public."TB_LOCAL_VAGA_EDITAL" ("CO_MUNICIPIO_IBGE")
  where "ST_REGISTRO_ATIVO" = 'S';

comment on table public."TB_LOCAL_VAGA_EDITAL" is 'Onde ficam as vagas de cada edital (município do IBGE ou só a UF), com a prova no PDF. Alimenta o mapa da Visão geral de Projetos.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."CO_LOCAL_VAGA" is 'Identificador da linha.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA); o projeto é a unidade dele.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."CO_MUNICIPIO_IBGE" is 'Código do município no IBGE (7 dígitos); nulo quando o edital só diz a UF.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."NO_MUNICIPIO" is 'Nome do município como no IBGE ("São Luís"), mesmo que o edital escreva diferente.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."SG_UF" is 'Sigla da UF.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."NO_CARGO" is 'Cargo como publicado; nulo quando a linha vale para todos os cargos do lugar.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."NO_LOTACAO" is 'Lotação como publicada ("Escritório Distrital Yanomami", "UBS móvel Irati/PR").';
comment on column public."TB_LOCAL_VAGA_EDITAL"."QT_VAGA" is 'Vagas de provimento imediato publicadas; nulo = o edital não informa ou só há cadastro reserva.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."ST_CADASTRO_RESERVA" is 'S: o edital prevê cadastro reserva (CR) para o lugar.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."TP_ORIGEM" is 'PDF (lido do edital), NOME_VAGA (lido do nome da vaga nas análises) ou MANUAL.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."DS_ARQUIVO_ORIGEM" is 'Endereço do PDF de onde a linha foi lida.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."DS_PAGINA_ORIGEM" is 'Página(s) e item do PDF que provam a linha ("4-6 (quadro do item 4.1)").';
comment on column public."TB_LOCAL_VAGA_EDITAL"."DS_OBSERVACAO" is 'Nota de leitura (ex.: "o edital só diz a UF").';
comment on column public."TB_LOCAL_VAGA_EDITAL"."ST_REGISTRO_ATIVO" is 'S: vigente. N: desativada (exclusão lógica).';
comment on column public."TB_LOCAL_VAGA_EDITAL"."DT_CRIACAO" is 'Quando a linha foi gravada.';
comment on column public."TB_LOCAL_VAGA_EDITAL"."DT_DESATIVACAO" is 'Quando a linha foi desativada.';

alter table public."TB_LOCAL_VAGA_EDITAL" enable row level security;
revoke all on public."TB_LOCAL_VAGA_EDITAL" from anon, authenticated;
grant all on public."TB_LOCAL_VAGA_EDITAL" to service_role;

-- ---------------------------------------------------------------------------
-- 2. RPC do mapa
-- ---------------------------------------------------------------------------
create or replace function public.listar_municipios_das_vagas_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
set statement_timeout to '5s'
as $function$
declare
  v_grupos_norm text[];
  v_area text := lower(btrim(coalesce(p_area, '')));
begin
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;

  -- Valida a área e confere se ela é do usuário (ou se ele é admin).
  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(p_area);

  return coalesce((
    with
    -- Os locais publicados nos editais da área.
    loc as (
      select l."CO_MONITORAMENTO" as id,
             m.edital,
             m.unidade as projeto,
             private."FC_NUMERO_EDITAL"(m.edital) as numero,
             l."CO_MUNICIPIO_IBGE" as ibge,
             l."NO_MUNICIPIO" as municipio,
             l."SG_UF" as uf,
             case when l."CO_MUNICIPIO_IBGE" is null then 'uf:' || l."SG_UF"
                  else private."FC_TEXTO_BUSCA_RECURSO"(l."NO_MUNICIPIO") || '/' || l."SG_UF" end as chave,
             l."QT_VAGA" as qt,
             l."ST_CADASTRO_RESERVA" = 'S' as cr,
             l."NO_LOTACAO" as lotacao,
             l."TP_ORIGEM" as origem
        from public."TB_LOCAL_VAGA_EDITAL" l
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = l."CO_MONITORAMENTO"
       where l."ST_REGISTRO_ATIVO" = 'S'
         and m."CO_AREA" = v_area
         and m.ativo is not false
    ),
    -- Um edital da área por número (o ativo primeiro), para dar nome às análises.
    edital_da_area as (
      select distinct on (private."FC_NUMERO_EDITAL"(m.edital))
             m.id, m.edital, m.unidade, private."FC_NUMERO_EDITAL"(m.edital) as numero
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m."CO_AREA" = v_area
         and private."FC_NUMERO_EDITAL"(m.edital) is not null
       order by private."FC_NUMERO_EDITAL"(m.edital), m.ativo desc nulls last, m.id
    ),
    -- Análises da área no recorte "ativo" do painel.
    analise as (
      select ac.id, ac.codigo_vaga, ac.nome_vaga, ac.status_consolidado, ac.unidade, ac.edital,
             private."FC_NUMERO_EDITAL"(ac.edital) as numero
        from public."TB_ANALISE_CURRICULAR" ac
        left join public."TB_EDITAL_ANALISE" e
          on e.grupo_norm = ac.grupo_norm
         and e.unidade_norm = ac.unidade_norm
         and e.edital_norm = ac.edital_norm
       where ac.grupo_norm = any (v_grupos_norm)
         and ac.ativo is true
         and coalesce(e.ativo, true) is true
    ),
    -- Cada análise no seu município: "UBS móvel <Município>/<UF>" no nome da
    -- vaga, ou o nome de um município de local do mesmo edital (palavra inteira).
    casada as (
      select a.id, a.codigo_vaga, a.status_consolidado, a.numero, a.unidade, a.edital,
             private."FC_TEXTO_BUSCA_RECURSO"(btrim(mu.partes[1])) || '/' || mu.partes[2] as chave,
             btrim(mu.partes[1]) as municipio, mu.partes[2] as uf
        from analise a
       cross join lateral regexp_match(a.nome_vaga, 'UBS m[óo]vel ([^/]+)/([A-Z]{2})') as mu(partes)
       where btrim(mu.partes[1]) <> ''
      union
      select a.id, a.codigo_vaga, a.status_consolidado, a.numero, a.unidade, a.edital,
             l.chave, l.municipio, l.uf
        from analise a
        join (select distinct numero, chave, municipio, uf from loc where ibge is not null) l
          on l.numero = a.numero
         and private."FC_TEXTO_BUSCA_RECURSO"(a.nome_vaga)
             ~ ('(^|[^a-z0-9])' || private."FC_TEXTO_BUSCA_RECURSO"(l.municipio) || '($|[^a-z0-9])')
    ),
    estatistica as (
      select chave,
             min(municipio) as municipio,
             min(uf) as uf,
             count(distinct codigo_vaga) as vagas,
             count(distinct id) as candidatos,
             count(distinct id) filter (where status_consolidado ilike 'aprovad%') as aprovados,
             count(distinct id) filter (where status_consolidado ilike 'reprovad%') as reprovados
        from casada
       group by chave
    ),
    -- Os editais de cada lugar: o que veio da tabela e o que veio das análises.
    edital_do_local as (
      select chave, numero, id, edital, projeto, qt, cr, lotacao, origem from loc
      union all
      select c.chave, c.numero, e.id, coalesce(e.edital, c.edital), coalesce(e.unidade, c.unidade),
             null::integer, false, null::varchar, 'NOME_VAGA'
        from (select chave, numero, min(unidade) as unidade, min(edital) as edital
                from casada group by chave, numero) c
        left join edital_da_area e on e.numero = c.numero
    ),
    por_edital as (
      select chave, numero,
             coalesce((array_agg(id) filter (where origem <> 'NOME_VAGA' and id is not null))[1],
                      (array_agg(id) filter (where id is not null))[1]) as id,
             coalesce(min(edital) filter (where origem <> 'NOME_VAGA'), min(edital)) as edital,
             coalesce(min(projeto) filter (where origem <> 'NOME_VAGA'), min(projeto)) as projeto,
             sum(qt) as vagas,
             coalesce(bool_or(cr), false) as cr,
             array_agg(distinct origem order by origem) as origens,
             coalesce(array_agg(distinct lotacao order by lotacao) filter (where lotacao is not null), '{}') as lotacoes
        from edital_do_local
       group by chave, numero
    ),
    lugar as (
      select chave, min(ibge) as ibge, min(municipio) as municipio, min(uf) as uf
        from loc
       group by chave
    ),
    chaves as (
      select chave from loc
      union
      select chave from casada
    ),
    linha as (
      select k.chave,
             k.chave like 'uf:%' as so_uf,
             coalesce(l.municipio, s.municipio) as municipio,
             coalesce(l.uf, s.uf) as uf,
             l.ibge,
             s.vagas, s.candidatos, s.aprovados, s.reprovados
        from chaves k
        left join lugar l on l.chave = k.chave
        left join estatistica s on s.chave = k.chave
    )
    select json_agg(json_build_object(
      'municipio_uf', case when r.so_uf then null else r.municipio || '/' || r.uf end,
      'municipio', case when r.so_uf then null else r.municipio end,
      'uf', r.uf,
      'codigo_ibge', r.ibge,
      'nivel', case when r.so_uf then 'uf' else 'municipio' end,
      'vagas', coalesce(r.vagas, 0),
      'candidatos', coalesce(r.candidatos, 0),
      'aprovados', coalesce(r.aprovados, 0),
      'reprovados', coalesce(r.reprovados, 0),
      'vagas_edital', (select sum(p.vagas) from por_edital p where p.chave = r.chave),
      'cadastro_reserva', coalesce((select bool_or(p.cr) from por_edital p where p.chave = r.chave), false),
      'projetos', coalesce((select json_agg(distinct p.projeto) from por_edital p
                             where p.chave = r.chave and p.projeto is not null), '[]'::json),
      'editais', coalesce((select json_agg(json_build_object(
                             'id', p.id,
                             'edital', p.edital,
                             'projeto', p.projeto,
                             'vagas', p.vagas,
                             'cadastro_reserva', p.cr,
                             'origens', p.origens,
                             'lotacoes', p.lotacoes) order by p.projeto, p.numero)
                             from por_edital p where p.chave = r.chave), '[]'::json)
    ) order by r.uf, r.so_uf desc, r.municipio)
    from linha r
  ), '[]'::json);
end;
$function$;

comment on function public.listar_municipios_das_vagas_da_area(text) is
  'Lugares das vagas da área (TB_LOCAL_VAGA_EDITAL + UBS móvel no nome da vaga): município ou UF, projetos e editais de cada um, vagas publicadas, vagas nas análises, candidatos, aprovados e reprovados. Mapa da Visão geral de Projetos.';

revoke all on function public.listar_municipios_das_vagas_da_area(text) from public, anon;
grant execute on function public.listar_municipios_das_vagas_da_area(text) to authenticated, service_role;


-- ===========================================================================
-- Dados (locais lidos dos PDFs)
-- ===========================================================================

with dado (numero, palavra, ibge, municipio, uf, cargo, lotacao, qt, cr, arquivo, pagina, observacao) as (values
  -- Caminhoneiros · edital 30/2026 · https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf
  -- Seropédica/RJ: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 3305554, 'Seropédica', 'RJ', null, 'UBS móvel Seropédica/RJ', null::integer, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Talismã/TO: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 1720978, 'Talismã', 'TO', null, 'UBS móvel Talismã/TO', null, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Palhoça/SC: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 4211900, 'Palhoça', 'SC', null, 'UBS móvel Palhoça/SC', null, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Irati/PR: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 4110706, 'Irati', 'PR', null, 'UBS móvel Irati/PR', null, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Cubatão/SP: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 3513504, 'Cubatão', 'SP', null, 'UBS móvel Cubatão/SP', null, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Caminhoneiros · edital 96/2025 · https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf
  -- Pindamonhangaba/SP: p. 4-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 3538006, 'Pindamonhangaba', 'SP', null, 'UBS móvel Pindamonhangaba/SP', 4, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '4-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Uruaçu/GO: p. 5-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 5221601, 'Uruaçu', 'GO', null, 'UBS móvel Uruaçu/GO', null, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '5-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Ubaporanga/MG: p. 5-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 3170057, 'Ubaporanga', 'MG', null, 'UBS móvel Ubaporanga/MG', null, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '5-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Novo Progresso/PA: p. 5-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 1505031, 'Novo Progresso', 'PA', null, 'UBS móvel Novo Progresso/PA', null, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '5-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Itatiaia/RJ: p. 5-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 3302254, 'Itatiaia', 'RJ', null, 'UBS móvel Itatiaia/RJ', null, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '5-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Saúde nas Fronteiras · edital 23/2025 · https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf
  -- Pacaraima/RR: p. 1 (Anexo 1)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Auxiliar Administrativo', 'Pacaraima/RR', 3, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '1 (Anexo 1)', null),
  -- Boa Vista/RR: p. 2 (Anexo 2)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Assistente de Gestão', 'Boa Vista/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '2 (Anexo 2)', null),
  -- Boa Vista/RR: p. 3 (Anexo 3)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Assistente Social', 'Boa Vista/RR', 4, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '3 (Anexo 3)', null),
  -- Pacaraima/RR: p. 4 (Anexo 4)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Assistente Social', 'Pacaraima/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '4 (Anexo 4)', null),
  -- Boa Vista/RR: p. 5 (Anexo 5)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Enfermeiro', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '5 (Anexo 5)', null),
  -- Pacaraima/RR: p. 6 (Anexo 6)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Enfermeiro', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '6 (Anexo 6)', null),
  -- Pacaraima/RR: p. 7 (Anexo 7)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Enfermeiro - Responsável Técnico', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '7 (Anexo 7)', null),
  -- Boa Vista/RR: p. 8 (Anexo 8)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Gerente de Saúde', 'Boa Vista/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '8 (Anexo 8)', null),
  -- Pacaraima/RR: p. 9 (Anexo 9)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Gerente de Saúde', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '9 (Anexo 9)', null),
  -- Boa Vista/RR: p. 10 (Anexo 10)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Mediador Intercultural', 'Boa Vista/RR', 6, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '10 (Anexo 10)', null),
  -- Pacaraima/RR: p. 11 (Anexo 11)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Mediador Intercultural', 'Pacaraima/RR', 5, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '11 (Anexo 11)', null),
  -- Boa Vista/RR: p. 12 (Anexo 12)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Médico', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '12 (Anexo 12)', null),
  -- Pacaraima/RR: p. 13 (Anexo 13)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Médico', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '13 (Anexo 13)', null),
  -- Boa Vista/RR: p. 14 (Anexo 14)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Nutricionista', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '14 (Anexo 14)', null),
  -- Pacaraima/RR: p. 15 (Anexo 15)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Nutricionista', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '15 (Anexo 15)', null),
  -- Boa Vista/RR: p. 16 (Anexo 16)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Psicólogo', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '16 (Anexo 16)', null),
  -- Pacaraima/RR: p. 17 (Anexo 17)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Psicólogo', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '17 (Anexo 17)', null),
  -- Boa Vista/RR: p. 18 (Anexo 18)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Técnico de enfermagem', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '18 (Anexo 18)', null),
  -- Pacaraima/RR: p. 19 (Anexo 19)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Técnico de enfermagem', 'Pacaraima/RR', 3, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '19 (Anexo 19)', null),
  -- Saúde nas Fronteiras · edital 63/2025 · https://agenciasus.org.br/shared-files/18695/?Edital-de-Processo-Seletivo-Simplificado-no-632025.pdf
  -- Boa Vista/RR: p. 1-2 (quadro do item 1.4) e 2 (item 1.5)
  ('63/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', null, 'Boa Vista/RR', 8, 'S', 'https://agenciasus.org.br/shared-files/18695/?Edital-de-Processo-Seletivo-Simplificado-no-632025.pdf', '1-2 (quadro do item 1.4) e 2 (item 1.5)', null),
  -- Pacaraima/RR: p. 2 (quadro do item 1.4 e item 1.5)
  ('63/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', null, 'Pacaraima/RR', 8, 'S', 'https://agenciasus.org.br/shared-files/18695/?Edital-de-Processo-Seletivo-Simplificado-no-632025.pdf', '2 (quadro do item 1.4 e item 1.5)', null),
  -- Saúde nas Fronteiras · edital 29/2025 · https://agenciasus.org.br/shared-files/15017/?SEI_0065374_Edital_de_Processo_Seletivo_Simplificado_29-2025.pdf
  -- Boa Vista/RR: p. 2 (quadro do item 1.4 e item 1.5)
  ('29/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', null, 'Boa Vista/RR', 4, 'N', 'https://agenciasus.org.br/shared-files/15017/?SEI_0065374_Edital_de_Processo_Seletivo_Simplificado_29-2025.pdf', '2 (quadro do item 1.4 e item 1.5)', null),
  -- Pacaraima/RR: p. 1-2 (quadro do item 1.4) e 2 (item 1.5)
  ('29/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', null, 'Pacaraima/RR', 8, 'N', 'https://agenciasus.org.br/shared-files/15017/?SEI_0065374_Edital_de_Processo_Seletivo_Simplificado_29-2025.pdf', '1-2 (quadro do item 1.4) e 2 (item 1.5)', null),
  -- Escritório Distrital e Regional · edital 62/2025 · https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf
  -- São Gabriel da Cachoeira/AM: p. 1 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1303809, 'São Gabriel da Cachoeira', 'AM', null, 'Escritório Distrital de São Gabriel da Cachoeira/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '1 (quadro do item 1.6)', null),
  -- Boa Vista/RR: p. 2 (quadro do item 1.6) · sede do DSEI Leste de Roraima (docs/sedes-dos-dsei.md)
  ('62/2025', 'escritorio', 1400100, 'Boa Vista', 'RR', null, 'Escritório Distrital Leste de Roraima/RR', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '2 (quadro do item 1.6)', 'sede do DSEI Leste de Roraima (docs/sedes-dos-dsei.md)'),
  -- Boa Vista/RR: p. 2 (quadro do item 1.6) · sede do DSEI Yanomami (docs/sedes-dos-dsei.md)
  ('62/2025', 'escritorio', 1400100, 'Boa Vista', 'RR', null, 'Escritório Distrital Yanomami', 8, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '2 (quadro do item 1.6)', 'sede do DSEI Yanomami (docs/sedes-dos-dsei.md)'),
  -- Boa Vista/RR: p. 2 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1400100, 'Boa Vista', 'RR', null, 'Escritório Regional de Boa Vista/RR', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '2 (quadro do item 1.6)', null),
  -- Barra do Garças/MT: p. 2-3 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5101803, 'Barra do Garças', 'MT', null, 'Escritório Distrital de Barra do Garças/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '2-3 (quadro do item 1.6)', null),
  -- Campo Grande/MS: p. 3 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5002704, 'Campo Grande', 'MS', null, 'Escritório Distrital de Campo Grande/MS', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '3 (quadro do item 1.6)', null),
  -- Canarana/MT: p. 3 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5102702, 'Canarana', 'MT', null, 'Escritório Distrital de Canarana/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '3 (quadro do item 1.6)', null),
  -- Colíder/MT: p. 3-4 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5103205, 'Colíder', 'MT', null, 'Escritório Distrital de Colíder/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '3-4 (quadro do item 1.6)', null),
  -- São Félix do Araguaia/MT: p. 4 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5107859, 'São Félix do Araguaia', 'MT', null, 'Escritório Distrital de São Félix do Araguaia/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '4 (quadro do item 1.6)', null),
  -- Cuiabá/MT: p. 4 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5103403, 'Cuiabá', 'MT', null, 'Escritório Distrital de Cuiabá/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '4 (quadro do item 1.6)', null),
  -- UF MT: p. 4 (quadro do item 1.6) · o edital só diz a UF
  ('62/2025', 'escritorio', null, null, 'MT', null, 'Escritório Regional do Centro-Oeste/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '4 (quadro do item 1.6)', 'o edital só diz a UF'),
  -- Florianópolis/SC: p. 5 (quadro do item 1.6)
  ('62/2025', 'escritorio', 4205407, 'Florianópolis', 'SC', null, 'Escritório Distrital de Florianópolis/SC', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '5 (quadro do item 1.6)', null),
  -- Curitiba/PR: p. 5 (quadro do item 1.6)
  ('62/2025', 'escritorio', 4106902, 'Curitiba', 'PR', null, 'Escritório Distrital de Curitiba/PR', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '5 (quadro do item 1.6)', null),
  -- Curitiba/PR: p. 5 (quadro do item 1.6)
  ('62/2025', 'escritorio', 4106902, 'Curitiba', 'PR', null, 'Escritório Regional de Curitiba/PR', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '5 (quadro do item 1.6)', null),
  -- Governador Valadares/MG: p. 5-6 (quadro do item 1.6)
  ('62/2025', 'escritorio', 3127701, 'Governador Valadares', 'MG', null, 'Escritório Distrital de Governador Valadares/MG', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '5-6 (quadro do item 1.6)', null),
  -- Atalaia do Norte/AM: p. 6 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1300201, 'Atalaia do Norte', 'AM', null, 'Escritório Distrital de Atalaia do Norte/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '6 (quadro do item 1.6)', null),
  -- Cacoal/RO: p. 6 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1100049, 'Cacoal', 'RO', null, 'Escritório Distrital de Cacoal/RO', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '6 (quadro do item 1.6)', null),
  -- Cruzeiro do Sul/AC: p. 6-7 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1200203, 'Cruzeiro do Sul', 'AC', null, 'Escritório Distrital de Cruzeiro do Sul/AC', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '6-7 (quadro do item 1.6)', null),
  -- Lábrea/AM: p. 7 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1302405, 'Lábrea', 'AM', null, 'Escritório Distrital de Lábrea/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '7 (quadro do item 1.6)', null),
  -- Parintins/AM: p. 7 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1303403, 'Parintins', 'AM', null, 'Escritório Distrital de Parintins/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '7 (quadro do item 1.6)', null),
  -- Porto Velho/RO: p. 7 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1100205, 'Porto Velho', 'RO', null, 'Escritório Distrital de Porto Velho/RO', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '7 (quadro do item 1.6)', null),
  -- Rio Branco/AC: p. 8 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1200401, 'Rio Branco', 'AC', null, 'Escritório Distrital de Rio Branco/AC', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '8 (quadro do item 1.6)', null),
  -- Tabatinga/AM: p. 8 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1304062, 'Tabatinga', 'AM', null, 'Escritório Distrital de Tabatinga/AM', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '8 (quadro do item 1.6)', null),
  -- Tefé/AM: p. 8 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1304203, 'Tefé', 'AM', null, 'Escritório Distrital de Tefé/AM', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '8 (quadro do item 1.6)', null),
  -- Manaus/AM: p. 8-9 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1302603, 'Manaus', 'AM', null, 'Escritório Distrital de Manaus/AM', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '8-9 (quadro do item 1.6)', null),
  -- Manaus/AM: p. 9 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1302603, 'Manaus', 'AM', null, 'Escritório Regional de Manaus/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '9 (quadro do item 1.6)', null),
  -- São Luís/MA: p. 9 (quadro do item 1.6) · o edital escreve "São Luiz"
  ('62/2025', 'escritorio', 2111300, 'São Luís', 'MA', null, 'Escritório Distrital de São Luiz/MA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '9 (quadro do item 1.6)', 'o edital escreve "São Luiz"'),
  -- Salvador/BA: p. 9 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2927408, 'Salvador', 'BA', null, 'Escritório Distrital de Salvador/BA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '9 (quadro do item 1.6)', null),
  -- Salvador/BA: p. 10 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2927408, 'Salvador', 'BA', null, 'Escritório Regional de Salvador/BA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '10 (quadro do item 1.6)', null),
  -- São Paulo/SP: p. 10 (quadro do item 1.6)
  ('62/2025', 'escritorio', 3550308, 'São Paulo', 'SP', null, 'Escritório Regional de São Paulo/SP', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '10 (quadro do item 1.6)', null),
  -- Altamira/PA: p. 10 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1500602, 'Altamira', 'PA', null, 'Escritório Distrital de Altamira/PA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '10 (quadro do item 1.6)', null),
  -- Macapá/AP: p. 10-11 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1600303, 'Macapá', 'AP', null, 'Escritório Distrital de Macapá/AP', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '10-11 (quadro do item 1.6)', null),
  -- Itaituba/PA: p. 11 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1503606, 'Itaituba', 'PA', null, 'Escritório Distrital de Itaituba/PA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '11 (quadro do item 1.6)', null),
  -- Palmas/TO: p. 11 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1721000, 'Palmas', 'TO', null, 'Escritório Distrital de Palmas/TO', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '11 (quadro do item 1.6)', null),
  -- Redenção/PA: p. 11-12 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1506138, 'Redenção', 'PA', null, 'Escritório Distrital de Redenção/PA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '11-12 (quadro do item 1.6)', null),
  -- Belém/PA: p. 12 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1501402, 'Belém', 'PA', null, 'Escritório Distrital de Belém/PA', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '12 (quadro do item 1.6)', null),
  -- UF PA: p. 12 (quadro do item 1.6) · o edital só diz a UF
  ('62/2025', 'escritorio', null, null, 'PA', null, 'Escritório Regional do Pará/PA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '12 (quadro do item 1.6)', 'o edital só diz a UF'),
  -- Fortaleza/CE: p. 12 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2304400, 'Fortaleza', 'CE', null, 'Escritório Distrital de Fortaleza/CE', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '12 (quadro do item 1.6)', null),
  -- João Pessoa/PB: p. 13 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2507507, 'João Pessoa', 'PB', null, 'Escritório Distrital de João Pessoa/PB', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '13 (quadro do item 1.6)', null),
  -- Maceió/AL: p. 13 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2704302, 'Maceió', 'AL', null, 'Escritório Distrital de Maceió/AL', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '13 (quadro do item 1.6)', null),
  -- Recife/PE: p. 13 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2611606, 'Recife', 'PE', null, 'Escritório Distrital de Recife/PE', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '13 (quadro do item 1.6)', null),
  -- Recife/PE: p. 13-14 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2611606, 'Recife', 'PE', null, 'Escritório Regional do Recife/PE', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '13-14 (quadro do item 1.6)', null),
  -- Escritório Distrital e Regional · edital 93/2026 · https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Analista de Gestão - Médico do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 2, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Analista de Gestão - Enfermeiro do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 1, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Analista de Gestão - Engenharia do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 1, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Técnico de Enfermagem do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 1, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Técnico de Segurança do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 6, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- MFC · edital 5/2026 · https://agenciasus.org.br/shared-files/24616/?Edital-N%C2%B0-05-2026-%E2%80%93-Vagas-para-MFC.pdf
  -- Brasília/DF: p. 1 (quadro de vagas do item 1.4) e 2 (item 1.5)
  ('5/2026', 'mfc', 5300108, 'Brasília', 'DF', 'Médico de Família e Comunidade - presencial 40h', 'Sede da AgSUS', 5, 'S', 'https://agenciasus.org.br/shared-files/24616/?Edital-N%C2%B0-05-2026-%E2%80%93-Vagas-para-MFC.pdf', '1 (quadro de vagas do item 1.4) e 2 (item 1.5)', null),
  -- Rio Doce · edital 4/2026 · https://agenciasus.org.br/shared-files/24464/?Edital-de-Processo-Seletivo-Simplificado-no-04-2026-%E2%80%93-Abertura.pdf
  -- Brasília/DF: p. 31-33 (quadro do item 4.1) e 34 (item 4.2)
  ('4/2026', 'rio doce', 5300108, 'Brasília', 'DF', 'Assistentes e Agentes de Projeto e Interfederativos', 'Sede AgSUS', null, 'S', 'https://agenciasus.org.br/shared-files/24464/?Edital-de-Processo-Seletivo-Simplificado-no-04-2026-%E2%80%93-Abertura.pdf', '31-33 (quadro do item 4.1) e 34 (item 4.2)', null),
  -- Governador Valadares/MG: p. 32-33 (quadro do item 4.1, cargos 43, 44 e 65) e 34 (item 4.2)
  ('4/2026', 'rio doce', 3127701, 'Governador Valadares', 'MG', 'Assistentes e Agentes de Território', 'NAAGE/PES-RD - Territórios', null, 'S', 'https://agenciasus.org.br/shared-files/24464/?Edital-de-Processo-Seletivo-Simplificado-no-04-2026-%E2%80%93-Abertura.pdf', '32-33 (quadro do item 4.1, cargos 43, 44 e 65) e 34 (item 4.2)', null),
  -- CCE · edital 97/2025 · https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf
  -- Brasília/DF: p. 4-5 (quadro do item 4.1) · o DF tem um só município
  ('97/2025', 'cce', 5300108, 'Brasília', 'DF', null, 'Comissão de Coordenação Distrital', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o DF tem um só município'),
  -- UF AC: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'AC', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF AL: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'AL', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF AP: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'AP', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF AM: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'AM', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF BA: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'BA', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF CE: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'CE', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF ES: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'ES', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF GO: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'GO', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF MA: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'MA', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF MT: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'MT', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF MS: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'MS', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF MG: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'MG', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PA: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PA', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PB: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PB', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PR: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PR', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PE: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PE', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PI: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PI', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RJ: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RJ', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RN: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RN', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RS: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RS', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RO: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RO', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RR: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RR', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF SC: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'SC', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF SP: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'SP', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF SE: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'SE', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF TO: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'TO', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF')
),
edital as (
  select distinct on (d.numero, d.palavra) d.numero, d.palavra, m.id
    from (select distinct numero, palavra from dado) d
    join public."TB_MONITORAMENTO_INDIGENA" m
      on private."FC_NUMERO_EDITAL"(m.edital) = d.numero
     and m."CO_AREA" = 'projetos'
     and private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) like '%' || d.palavra || '%'
   order by d.numero, d.palavra, m.ativo desc nulls last, m.id
)
insert into public."TB_LOCAL_VAGA_EDITAL" (
  "CO_MONITORAMENTO", "CO_MUNICIPIO_IBGE", "NO_MUNICIPIO", "SG_UF", "NO_CARGO", "NO_LOTACAO", "QT_VAGA",
  "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "DS_PAGINA_ORIGEM", "DS_OBSERVACAO"
)
select e.id, d.ibge, d.municipio, d.uf, d.cargo, d.lotacao, d.qt, d.cr, 'PDF', d.arquivo, d.pagina, d.observacao
  from dado d
  join edital e on e.numero = d.numero and e.palavra = d.palavra
 where not exists (
   select 1
     from public."TB_LOCAL_VAGA_EDITAL" l
    where l."CO_MONITORAMENTO" = e.id
      and l."ST_REGISTRO_ATIVO" = 'S'
      and l."SG_UF" = d.uf
      and coalesce(l."CO_MUNICIPIO_IBGE", 0) = coalesce(d.ibge, 0)
      and coalesce(l."NO_CARGO", '') = coalesce(d.cargo, '')
      and coalesce(l."NO_LOTACAO", '') = coalesce(d.lotacao, '')
 );


-- ===========================================================================
-- Conferências
-- ===========================================================================

-- 1. Editais de Projetos e quantos locais cada um recebeu.
select m.id, m.edital, m.unidade, m.ativo, count(l.*) as locais,
       count(l.*) filter (where l."CO_MUNICIPIO_IBGE" is null) as so_uf,
       sum(l."QT_VAGA") as vagas_publicadas
  from public."TB_MONITORAMENTO_INDIGENA" m
  left join public."TB_LOCAL_VAGA_EDITAL" l on l."CO_MONITORAMENTO" = m.id
 where m."CO_AREA" = 'projetos'
 group by m.id, m.edital, m.unidade, m.ativo
 order by m.unidade, m.edital;

-- 2. Lugares por projeto (municípios distintos e UFs sem município).
select m.unidade as projeto,
       count(distinct l."CO_MUNICIPIO_IBGE") as municipios,
       count(distinct l."SG_UF") filter (where l."CO_MUNICIPIO_IBGE" is null) as ufs_sem_municipio,
       sum(l."QT_VAGA") as vagas_publicadas
  from public."TB_LOCAL_VAGA_EDITAL" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = l."CO_MONITORAMENTO"
 group by m.unidade
 order by m.unidade;

-- 3. A RPC como usuário da área Projetos (troque o e-mail por um real).
select set_config('request.jwt.claims',
       json_build_object('sub', (select id from auth.users where email = 'TROQUE@agenciasus.org.br'),
                         'role', 'authenticated')::text, true);
set local role authenticated;
select r ->> 'municipio_uf' as municipio_uf, r ->> 'uf' as uf, r ->> 'nivel' as nivel,
       r ->> 'vagas' as vagas_analises, r ->> 'vagas_edital' as vagas_edital,
       r ->> 'candidatos' as candidatos, r -> 'projetos' as projetos,
       json_array_length(r -> 'editais') as editais
  from json_array_elements(public.listar_municipios_das_vagas_da_area('projetos')) r;

-- 4. Linha de município sem algum campo antigo (tem de voltar vazio).
select r
  from json_array_elements(public.listar_municipios_das_vagas_da_area('projetos')) r
 where r ->> 'nivel' = 'municipio'
   and (r ->> 'municipio_uf' is null or r ->> 'vagas' is null or r ->> 'candidatos' is null
        or r ->> 'aprovados' is null or r ->> 'reprovados' is null);

reset role;

rollback;
