/*
  Onde ficam as vagas de cada edital — o mapa da Visão geral de Projetos com
  todos os projetos, não só o Caminhoneiros.

  A versão de 20260929090000 só lia o município de "UBS móvel <Município>/<UF>"
  no nome da vaga das análises curriculares: valia para o Caminhoneiros e
  deixava de fora Saúde nas Fronteiras, Escritório Distrital e Regional, Rio
  Doce, MFC e CCE, cujas vagas não dizem o lugar no nome. Quem diz é o PDF do
  edital (quadro de vagas, anexos, item de local de atuação).

  1. TB_LOCAL_VAGA_EDITAL: uma linha por edital × lugar (× cargo/lotação, quando
     o edital separa), com o município do IBGE — ou só a UF, quando o edital só
     diz a UF (CCE: uma vaga por estado) —, as vagas imediatas publicadas (nulo
     = não informado), se há cadastro reserva e de onde veio (TP_ORIGEM: PDF,
     NOME_VAGA ou MANUAL; DS_ARQUIVO_ORIGEM e DS_PAGINA_ORIGEM guardam o PDF e a
     página que provam a linha). Exclusão lógica por ST_REGISTRO_ATIVO. Sem
     acesso direto: RLS ligada, sem policy, só service_role.
     Os locais levantados dos PDFs estão em
     supabase/correcoes/20261001-locais-das-vagas-dos-projetos.sql.
  2. listar_municipios_das_vagas_da_area(p_area), nova versão. Une:
     a) os locais da tabela, dos editais da área;
     b) o "UBS móvel <Município>/<UF>" do nome da vaga (como antes).
     Os candidatos de um lugar são as análises com "UBS móvel" daquele lugar
     ou cujo nome da vaga cita o município de um local do mesmo edital (pelo
     número do edital: private.FC_NUMERO_EDITAL). Lugar só com UF não tem
     candidatos: a vaga não diz o estado.
     Formato: os campos de antes continuam (municipio_uf, municipio, uf, vagas,
     candidatos, aprovados, reprovados — vagas = vagas distintas nas análises)
     e entram codigo_ibge, nivel ('municipio' | 'uf'), vagas_edital (soma das
     vagas imediatas publicadas; nulo se nenhum edital informa),
     cadastro_reserva, projetos (unidades dos editais) e editais
     ([{id, edital, projeto, vagas, cadastro_reserva, origens, lotacoes}]).
     Linha de UF vem com municipio_uf nulo — o front publicado antes desta
     versão descarta linha sem municipio_uf, então ela não o quebra.

  Só leitura; mesma permissão de antes (recurso `dashboard` + área do usuário
  por FC_GRUPOS_ANALISES_DA_AREA) e mesmo recorte das análises (ativa, edital
  de análise ativo ou sem cadastro).

  Ensaio: supabase/ensaios/20261001180000_locais_das_vagas_dos_projetos.sql
  Rollback: supabase/rollback/20261001180000_locais_das_vagas_dos_projetos.sql
*/
begin;

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

commit;
