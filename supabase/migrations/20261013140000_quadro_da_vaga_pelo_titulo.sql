/*
  PRÉ-CLASSIFICAÇÃO: A LINHA DO QUADRO DE CADA VAGA PELO TÍTULO DA EMPREGARE

  Por quê: no 114/2026 as 30 vagas da pré-classificação (TB_PRE_CLASSIF_VAGA)
  estão sem cargo e sem lotação, e por isso a ficha abriria toda no nível
  superior (o nível sai do "(Nível …)" do cargo do quadro; a regra de
  classificação do 114 não tem niveis_por_cargo). No 93/2026 vêm preenchidos.
  A causa: FC_QUADRO_DA_VAGA_EMPREGARE só achava a linha do quadro pelo
  nome_vaga da análise curricular (TB_ANALISE_CURRICULAR, que vem da
  planilha). No 114 a análise é do MONITORA e o nome_vaga é nulo, então
  nenhuma vaga casava. O job (pre_classificacao_ler_editais: cargo → nível
  da nota declarada) e a gravação (gravar_pre_classificacao_vaga: NO_CARGO,
  NO_LOTACAO, quadro) usam a mesma função.

  O QUE MUDA: sem o caminho antigo, FC_QUADRO_DA_VAGA_EMPREGARE usa o título
  da vaga na Empregare. O título sai do nome do arquivo da carga
  (TB_EMPREGARE_VAGA."NO_ARQUIVO": "Candidatos da vaga N - <título> em
  Excel…") sem "[Vaga]", "- Empregare ATS", "…" e "(Nível …)":
    1. com "CARGO N" no título, valem as linhas do quadro com o mesmo número;
       sem número, o casamento por palavras de FC_QUADRO_DA_VAGA;
    2. uma linha só: é ela;
    3. o mesmo cargo em mais de uma lotação (BH e Vitória no 114): primeiro a
       lotação escrita no título; sem ela, a UF da lotação ("Belo Horizonte -
       MG") pela UF dos inscritos de cada vaga irmã (as vagas do edital com o
       mesmo número de cargo). Cada vaga fica com a lotação de onde vem a maior
       parte dos inscritos daquela UF ((inscritos da vaga na UF + 1) ÷
       (inscritos de todas as irmãs na UF + 2)). Só vale se as irmãs e as
       linhas forem em mesmo número, com UFs distintas, e a escolha for uma
       para cada; senão fica sem linha, como antes.
  O caminho antigo (planilha) continua primeiro: 93/2026 e Saúde Indígena não
  mudam. Nada é gravado aqui: as vagas ganham cargo, lotação e nível na
  próxima execução do job (o refazer do lote regrava as vagas). Rollback em
  supabase/rollback/20261013140000_quadro_da_vaga_pelo_titulo.sql; ensaio em
  supabase/ensaios/20261013140000_quadro_da_vaga_pelo_titulo.sql.
  Repete private."FC_TEXTO_DO_CARGO" (o mesmo de 20261013130000), para poder
  ser aplicada antes daquela, se o refazer do lote vier primeiro.
*/
begin;

set local lock_timeout = '10s';

create or replace function private."FC_TEXTO_DO_CARGO"(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
           translate(lower(coalesce(p_texto, '')),
                     'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
                     'aaaaaaeeeeiiiiooooouuuucnyy'),
           '[^a-z0-9]+', ' ', 'g'));
$$;
comment on function private."FC_TEXTO_DO_CARGO"(text) is
  'O texto do cargo para comparar (textoDoCargo de regra-por-cargo.ts): sem acento, minúsculo, só letras e dígitos separados por um espaço.';
revoke all on function private."FC_TEXTO_DO_CARGO"(text) from public, anon, authenticated, service_role;

create or replace function private."FC_TITULO_DA_VAGA_EMPREGARE"(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 regexp_replace(
                   coalesce(substring(coalesce(p_texto, '') from '^Candidatos da vaga [0-9]+ - (.+?) em Excel'), p_texto, ''),
                   '^\s*\[vaga\]\s*', '', 'i'),
                 '\s*-\s*empregare(\s+ats)?\s*$', '', 'i'),
               '\s*(\.\.\.|…)\s*$', ''),
             '\s*\(n[íi]vel [^)]*\)\s*$', '', 'i')), '');
$$;
comment on function private."FC_TITULO_DA_VAGA_EMPREGARE"(text) is
  'O título da vaga da Empregare a partir do nome do arquivo da carga ("Candidatos da vaga N - <título> em Excel…") ou do título da página ("[Vaga] <título> - Empregare ATS"): sem esses enfeites, sem "…" no fim e sem o "(Nível …)" (20261013140000).';
revoke all on function private."FC_TITULO_DA_VAGA_EMPREGARE"(text) from public, anon, authenticated, service_role;

create or replace function private."FC_NUMERO_DO_CARGO"(p_texto text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (substring(private."FC_TEXTO_DO_CARGO"(p_texto) from '^cargo (?:n |no )?([0-9]{1,3})(?: |$)'))::integer;
$$;
comment on function private."FC_NUMERO_DO_CARGO"(text) is
  'O número do cargo no começo do texto ("CARGO 15: MOTORISTA…", "Cargo nº 3 - …" → 15, 3); null sem número (20261013140000).';
revoke all on function private."FC_NUMERO_DO_CARGO"(text) from public, anon, authenticated, service_role;

create or replace function private."FC_UF_DA_LOTACAO"(p_lotacao text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(substring(btrim(coalesce(p_lotacao, '')) from '[-/(]\s*([A-Za-z]{2})\)?$'));
$$;
comment on function private."FC_UF_DA_LOTACAO"(text) is
  'A UF no fim da lotação do quadro ("Belo Horizonte - MG", "Vitória/ES", "Bauru (SP)" → MG, ES, SP); null sem UF (20261013140000).';
revoke all on function private."FC_UF_DA_LOTACAO"(text) from public, anon, authenticated, service_role;

create or replace function private."FC_QUADRO_PELO_TITULO_EMPREGARE"(p_edital uuid, p_vaga text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_titulo text;
  v_numero integer;
  v_linhas uuid[];
  v_pelo_nome uuid;
  v_escolha jsonb;
begin
  select private."FC_TITULO_DA_VAGA_EMPREGARE"(v."NO_ARQUIVO") into v_titulo
    from public."TB_EMPREGARE_VAGA" v
   where v."CO_MONITORAMENTO" = p_edital and v."CO_VAGA" = p_vaga;
  if v_titulo is null then
    return null;
  end if;
  v_numero := private."FC_NUMERO_DO_CARGO"(v_titulo);
  v_pelo_nome := private."FC_QUADRO_DA_VAGA"(p_edital, v_titulo);
  if v_numero is null then
    return v_pelo_nome; -- sem "CARGO N": o casamento por palavras de sempre
  end if;

  select coalesce(array_agg(q."CO_QUADRO_VAGA" order by q."NU_ORDEM"), '{}') into v_linhas
    from public."TB_QUADRO_VAGA_EDITAL" q
   where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'
     and private."FC_NUMERO_DO_CARGO"(q."NO_CARGO") = v_numero;
  if cardinality(v_linhas) = 0 then
    return null;
  end if;
  if cardinality(v_linhas) = 1 then
    return v_linhas[1];
  end if;
  -- O mesmo cargo em mais de uma lotação: a lotação escrita no título decide.
  if v_pelo_nome = any (v_linhas) then
    return v_pelo_nome;
  end if;

  -- Sem a lotação no título: a UF dos inscritos de cada vaga irmã.
  with linhas as (
    select q."CO_QUADRO_VAGA" as id, private."FC_UF_DA_LOTACAO"(q."NO_LOTACAO") as uf
      from public."TB_QUADRO_VAGA_EDITAL" q
     where q."CO_QUADRO_VAGA" = any (v_linhas)
  ),
  irmas as (
    select v."CO_VAGA" as vaga
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_MONITORAMENTO" = p_edital
       and private."FC_NUMERO_DO_CARGO"(private."FC_TITULO_DA_VAGA_EMPREGARE"(v."NO_ARQUIVO")) = v_numero
  ),
  contagem as (
    select i.vaga, l.id, l.uf,
           (select count(*) from public."TB_EMPREGARE_CANDIDATO" c
             where c."CO_VAGA" = i.vaga and c."ST_REGISTRO_ATIVO" = 'S'
               and upper(btrim(coalesce(c."DS_COLUNA_ORIGINAL" ->> 'ESTADO', ''))) = l.uf) as n
      from irmas i cross join linhas l
  ),
  nota as (
    select c.vaga, c.id, (c.n + 1)::numeric / (sum(c.n) over (partition by c.id) + 2) as s
      from contagem c
  ),
  melhor as (
    select n.vaga, n.id,
           n.s = max(n.s) over (partition by n.vaga) as topo,
           count(*) filter (where true) over (partition by n.vaga, n.s) as empates
      from nota n
  ),
  escolha as (
    select m.vaga, m.id from melhor m where m.topo and m.empates = 1
  )
  select jsonb_build_object(
           'ok', (select count(*) from linhas) = (select count(*) from irmas)
                 and (select count(distinct uf) from linhas where uf is not null) = (select count(*) from linhas)
                 and (select count(*) from escolha) = (select count(*) from irmas)
                 and (select count(distinct id) from escolha) = (select count(*) from linhas),
           'id', (select e.id from escolha e where e.vaga = p_vaga))
    into v_escolha;
  return case when (v_escolha ->> 'ok')::boolean then (v_escolha ->> 'id')::uuid end;
end;
$$;
comment on function private."FC_QUADRO_PELO_TITULO_EMPREGARE"(uuid, text) is
  'A linha do quadro de uma vaga da Empregare pelo título da vaga (nome do arquivo da carga): o número do CARGO; com o mesmo cargo em mais de uma lotação, a lotação do título ou, sem ela, a UF da lotação pela UF dos inscritos das vagas irmãs (uma lotação para cada vaga, senão null). Para os editais cuja análise não vem da planilha (nome_vaga nulo), desde 20261013140000.';
revoke all on function private."FC_QUADRO_PELO_TITULO_EMPREGARE"(uuid, text) from public, anon, authenticated, service_role;

create or replace function private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital uuid, p_vaga text)
returns public."TB_QUADRO_VAGA_EDITAL"
language sql
stable
set search_path = ''
as $$
  select q.*
    from (select coalesce(
                   (select v.quadro_id
                      from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) v
                      join public."TB_QUADRO_VAGA_EDITAL" l
                        on l."CO_QUADRO_VAGA" = v.quadro_id and l."CO_MONITORAMENTO" = p_edital and l."ST_REGISTRO_ATIVO" = 'S'
                     where v.edital_id = p_edital
                     limit 1),
                   private."FC_QUADRO_PELO_TITULO_EMPREGARE"(p_edital, p_vaga)) as id) x
    join public."TB_QUADRO_VAGA_EDITAL" q
      on q."CO_QUADRO_VAGA" = x.id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S';
$$;
comment on function private."FC_QUADRO_DA_VAGA_EMPREGARE"(uuid, text) is
  'A linha do quadro de vagas de uma vaga da Empregare no edital: pelo nome_vaga da análise curricular (planilha, FC_EMPREGARE_VAGAS_DO_QUADRO) e, sem ele, pelo título da vaga na Empregare (FC_QUADRO_PELO_TITULO_EMPREGARE, desde 20261013140000). Usada pelo job da pré-classificação (cargo e nível) e pela gravação de cada vaga (NO_CARGO, NO_LOTACAO, quadro).';

commit;
