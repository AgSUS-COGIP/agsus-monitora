/*
  ENSAIO de 20261006070000_integridade_das_listas_e_kpis.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e percorre:
    E1  estrutura: definer + search_path vazio, privadas sem execute para
        authenticated, o critério do edital (número; sem número, o texto);
    E2  atores sintéticos (gestor = edital_gestor, contratador), análises
        sintéticas de Projetos (uma com outro texto e o mesmo número, uma
        inativa, uma de outro número) e uma real da Saúde Indígena;
    E3  pelas RPCs: o edital pelo Núcleo; a sonda do ensaio de ponta a ponta
        (lista FINAL com análise de outra área e nota 999) e outras listas
        inválidas recusadas (22023); o caminho normal registra e publica; o
        recurso acha a análise pelo número do edital;
    E4  (depois do reset role) contratados do edital veio da publicação;
    E5  convocar e contratar atualizam contratados na hora (sem pg_cron);
    E6  lista FINAL gravada antes (direto na tabela) com análise de outra área:
        publicar recusa.
  Termina em ROLLBACK: nada fica gravado.

  Resultado esperado: "ok E1" … "ok E6" e a linha "ENSAIO OK" do SELECT final.
  Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/integridade-das-listas-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
-- 0. Pré-requisitos -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.marcar_candidatos_convocados(uuid[], date, uuid)') is null then
    raise exception 'Aplique antes 20261005180000_convocado_e_carta_de_convocacao.sql.';
  end if;
  if to_regprocedure('public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb)') is null then
    raise exception 'Aplique antes 20261005160000_lista_de_aprovados_da_classificacao.sql.';
  end if;
end;
$$;

-- 1. A análise é deste edital? -------------------------------------------------------------------
/*
  O mesmo critério da Classificação, das Entrevistas e dos KPIs: o número do
  edital (FC_NUMERO_EDITAL: "Edital nº 06/2026" = "6/2026"). Edital sem número
  ("FGV", "FCC"): o texto, sem espaços nas pontas.
*/
create function private."FC_ANALISE_DO_EDITAL"(p_edital_analise text, p_edital text)
returns boolean
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select case
           when private."FC_NUMERO_EDITAL"(p_edital) is not null
             then coalesce(private."FC_NUMERO_EDITAL"(p_edital_analise) = private."FC_NUMERO_EDITAL"(p_edital), false)
           else nullif(btrim(coalesce(p_edital, '')), '') is not null
                and btrim(coalesce(p_edital_analise, '')) = btrim(p_edital)
         end;
$function$;
comment on function private."FC_ANALISE_DO_EDITAL"(text, text) is
  'Se a análise (TB_ANALISE_CURRICULAR.edital) é do edital (TB_MONITORAMENTO_INDIGENA.edital): pelo número do edital (FC_NUMERO_EDITAL), como Classificação, Entrevistas e KPIs; edital sem número, pelo texto. A área se confere à parte.';
revoke all on function private."FC_ANALISE_DO_EDITAL"(text, text) from public, anon, authenticated;

-- 2. Os candidatos de uma lista da Classificação são do edital? -------------------------------------
/*
  A conta da lista é do motor no navegador; o banco recebe o retrato pronto.
  Antes de registrar (registrar_lista_classificacao) e de publicar como lista
  de aprovados (publicar_lista_aprovados_da_classificacao), confere:
    - cada linha da geral e das listas por modalidade tem analise_id (uuid),
      posição inteira >= 1 e nota nula ou entre 0 e 1000; os eliminados, se
      trazem analise_id/nota, também válidos;
    - a mesma análise não aparece duas vezes na mesma lista de uma vaga
      (posições repetidas continuam valendo: é o empate);
    - toda análise citada é ATIVA, da área do edital e do mesmo número de
      edital (FC_ANALISE_DO_EDITAL) — a mesma conferência de
      convocar_para_entrevista.
  Qualquer falha: 22023 ("gere de novo").
*/
create function private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_edital uuid, p_resultado jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_qt integer;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if v_m.id is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;

  create temporary table if not exists tmp_candidatos_da_lista (
    vaga bigint, lista text, linha jsonb
  ) on commit drop;
  truncate pg_temp.tmp_candidatos_da_lista;
  insert into pg_temp.tmp_candidatos_da_lista
  select v.ordem, l.lista, l.linha
    from jsonb_array_elements(
           case when jsonb_typeof(p_resultado -> 'vagas') = 'array' then p_resultado -> 'vagas' else '[]'::jsonb end
         ) with ordinality v(vaga, ordem)
   cross join lateral (
     select 'geral' as lista, g.linha
       from jsonb_array_elements(
              case when jsonb_typeof(v.vaga -> 'geral') = 'array' then v.vaga -> 'geral' else '[]'::jsonb end) g(linha)
     union all
     select 'modalidade:' || e.codigo, m.linha
       from jsonb_each(
              case when jsonb_typeof(v.vaga -> 'listas') = 'object' then v.vaga -> 'listas' else '{}'::jsonb end) e(codigo, linhas)
      cross join lateral jsonb_array_elements(
              case when jsonb_typeof(e.linhas) = 'array' then e.linhas else '[]'::jsonb end) m(linha)
     union all
     select 'eliminados', x.linha
       from jsonb_array_elements(
              case when jsonb_typeof(v.vaga -> 'eliminados') = 'array' then v.vaga -> 'eliminados' else '[]'::jsonb end) x(linha)
   ) l;

  -- Forma de cada linha (o case evita converter texto que não é número).
  select count(*) into v_qt
    from pg_temp.tmp_candidatos_da_lista t
   where (case
            when jsonb_typeof(t.linha) is distinct from 'object' then true
            when t.lista <> 'eliminados'
                 and coalesce(t.linha ->> 'analise_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then true
            when t.lista = 'eliminados' and jsonb_typeof(t.linha -> 'analise_id') = 'string'
                 and (t.linha ->> 'analise_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then true
            when t.lista = 'eliminados' and coalesce(jsonb_typeof(t.linha -> 'analise_id'), 'null') not in ('string', 'null') then true
            when t.lista <> 'eliminados' and jsonb_typeof(t.linha -> 'posicao') is distinct from 'number' then true
            when t.lista <> 'eliminados'
                 and ((t.linha ->> 'posicao')::numeric < 1 or (t.linha ->> 'posicao')::numeric <> trunc((t.linha ->> 'posicao')::numeric)) then true
            when coalesce(jsonb_typeof(t.linha -> 'nota'), 'null') not in ('number', 'null') then true
            when jsonb_typeof(t.linha -> 'nota') = 'number' and (t.linha ->> 'nota')::numeric not between 0 and 1000 then true
            else false
          end);
  if v_qt > 0 then
    raise exception 'Lista inválida: % linha(s) sem análise, com posição que não é inteiro positivo ou nota fora de 0 a 1000; gere de novo.', v_qt
      using errcode = '22023';
  end if;

  -- A mesma análise duas vezes na mesma lista da mesma vaga.
  select count(*) into v_qt
    from (select 1 from pg_temp.tmp_candidatos_da_lista t
           where t.lista <> 'eliminados'
           group by t.vaga, t.lista, lower(t.linha ->> 'analise_id')
          having count(*) > 1) d;
  if v_qt > 0 then
    raise exception 'Lista inválida: a mesma análise aparece duas vezes na mesma lista (% caso(s)); gere de novo.', v_qt
      using errcode = '22023';
  end if;

  -- Toda análise citada: ativa, da área e do número do edital.
  select count(*) into v_qt
    from (select distinct (t.linha ->> 'analise_id')::uuid as analise
            from pg_temp.tmp_candidatos_da_lista t
           where jsonb_typeof(t.linha -> 'analise_id') = 'string') s
   where not exists (
     select 1 from public."TB_ANALISE_CURRICULAR" a
      where a.id = s.analise and a.ativo and a."CO_AREA" = v_m."CO_AREA"
        and private."FC_ANALISE_DO_EDITAL"(a.edital, v_m.edital));
  if v_qt > 0 then
    raise exception '% candidato(s) da lista não são análises ativas deste edital (área e número do edital); gere de novo.', v_qt
      using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(uuid, jsonb) is
  'Confere o retrato de uma lista da Classificação antes de registrar ou publicar: linhas com analise_id, posição inteira >= 1 e nota de 0 a 1000; a mesma análise uma vez por lista; toda análise ativa, da área e do número do edital. Falha = 22023.';
revoke all on function private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(uuid, jsonb) from public, anon, authenticated;

-- 3. Contratados do edital na hora (leve) ----------------------------------------------------------
/*
  O KPI que a Lista de aprovados muda é contratados (Contratado ou Migração na
  lista vigente — a mesma conta de FC_ATUALIZAR_KPIS_PELA_SELECAO). Só o
  edital afetado, por contagem direta da lista vigente dele: sem varrer a área,
  sem advisory lock, grava no máximo uma linha e só se mudou. Os demais KPIs
  (inscritos, aptos, aprovados na análise, entrevistados) continuam no
  recálculo em lote (pg_cron das 10h e fim da carga da Seleção).
*/
create function private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(p_edital uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  if p_edital is null
     or not exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital::text and l.vigente is true) then
    return 0;
  end if;
  update public."TB_MONITORAMENTO_INDIGENA" m
     set contratados = n.qt, updated_at = now()
    from (select (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer qt
            from public."TB_LISTA_APROVADO" l
            left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.edital_id = p_edital::text and l.vigente is true) n
   where m.id = p_edital and m.ativo and m.contratados is distinct from n.qt;
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(uuid) is
  'Atualiza TB_MONITORAMENTO_INDIGENA.contratados de um edital ativo pela lista de aprovados vigente (Contratado ou Migração), por contagem direta; só grava se mudou. Chamada no fim das gravações da Lista de aprovados; os outros KPIs seguem no recálculo em lote.';
revoke all on function private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(uuid) from public, anon, authenticated;

-- 4. Registrar e publicar listas conferem os candidatos -------------------------------------------

create or replace function public.registrar_lista_classificacao(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_id uuid;
  v_totais jsonb := coalesce(p_resultado -> 'totais', '{}'::jsonb);
  v_qt integer[];
begin
  if p_tipo is null or p_tipo not in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL') then
    raise exception 'Tipo de lista inválido' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Salve a regra do edital antes de gerar a lista.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
  end if;
  if jsonb_typeof(p_resultado) is distinct from 'object' or jsonb_typeof(p_resultado -> 'vagas') is distinct from 'array'
     or p_resultado ->> 'tipo' is distinct from p_tipo then
    raise exception 'Lista inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_resultado) > 8000000 then
    raise exception 'Lista grande demais para registrar.' using errcode = '22023';
  end if;
  -- Os candidatos do retrato são análises ativas deste edital (20261006070000).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_edital, p_resultado);
  select array_agg(case when jsonb_typeof(v_totais -> k) = 'number'
                        then greatest(0, least(1000000, (v_totais ->> k)::numeric))::integer else 0 end order by o)
    into v_qt
    from unnest(array['elegiveis', 'eliminados', 'avisos', 'pendencias']) with ordinality t(k, o);

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", p_resultado,
          encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex'),
          v_qt[1], v_qt[2], v_qt[3], v_qt[4], (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return private."FC_LISTA_CLASSIFICACAO_JSON"(v_id);
end;
$function$;


create or replace function public.publicar_lista_aprovados_da_classificacao(
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
  -- Os candidatos do resultado final são análises ativas deste edital (20261006070000).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(v_l."CO_MONITORAMENTO", v_l."DS_RESULTADO");
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

  -- O KPI de contratados do edital já com a lista nova (20261006070000).
  perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(v_l."CO_MONITORAMENTO");

  return json_build_object(
    'ok', true, 'lista_id', v_nova, 'publicacao_id', v_publicacao, 'lista_anterior', v_anterior.id,
    'candidatos', v_qt, 'entram', v_entra, 'saem', coalesce(v_sai, 0), 'mudam', coalesce(v_muda, 0),
    'preservados', coalesce(v_preservado, 0), 'sub_judice_mantidos', coalesce(v_mantido, 0),
    'pendencias', v_pendencias
  );
end;
$function$;


-- 5. Status e convocação recalculam os KPIs do edital ---------------------------------------------

create or replace function public.alterar_status_candidato_aprovado(
  p_candidato_id uuid,
  p_status text,
  p_processo_sei text default null,
  p_matricula text default null,
  p_data_convocacao date default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_candidato public."TB_CANDIDATO_APROVADO"%rowtype;
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date;
begin
  -- Quem edita a Lista de aprovados (grupo ou exceção) e tem a área/edital.
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c
                                             join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
                                            where c.id = p_candidato_id));
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Perfil sem permissao para alterar status' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in (
    'Convocado', 'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada'
  ) then
    raise exception 'Status invalido' using errcode = '22023';
  end if;

  if v_status in ('Contratado', 'Migração') and v_matricula is null then
    raise exception 'Matricula obrigatoria para Contratado ou Migracao';
  end if;

  if p_data_convocacao is not null and v_status is distinct from 'Convocado' then
    raise exception 'A data da convocação só vale para o status Convocado' using errcode = '22023';
  end if;
  if p_data_convocacao > v_hoje then
    raise exception 'A data da convocação não pode ser futura' using errcode = '22023';
  end if;

  select * into v_candidato
  from public."TB_CANDIDATO_APROVADO"
  where id = p_candidato_id and removido_em is null
  for update;
  if not found then raise exception 'Candidato nao encontrado'; end if;

  -- Status já definido só o admin muda; do Convocado, quem edita segue o fluxo
  -- (ou corrige a data), mas voltar a "sem status" continua sendo do admin.
  if not private.pode_recurso('aprovados', 3) and v_candidato.status is not null
     and not (v_candidato.status = 'Convocado' and v_status is not null) then
    raise exception 'O status deste candidato ja foi definido. Somente admin pode altera-lo';
  end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where id = v_candidato.lista_id and vigente is true
  for update;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  if not v_lista.ativo then
    raise exception 'A lista esta inativa e nao permite alterar candidatos';
  end if;

  if v_status = 'Convocado' then
    v_data := coalesce(p_data_convocacao,
                       (case when v_candidato.status = 'Convocado' then v_candidato."DT_CONVOCACAO" end),
                       v_hoje);
  elsif v_status is null then
    v_data := null;
  else
    v_data := v_candidato."DT_CONVOCACAO";
  end if;

  insert into public."TH_CANDIDATO_APROVADO"(
    candidato_id, lista_id, status_anterior, status_novo,
    processo_sei, matricula, alterado_por, "DT_CONVOCACAO"
  ) values (
    v_candidato.id, v_candidato.lista_id, v_candidato.status, v_status,
    nullif(btrim(coalesce(p_processo_sei, '')), ''), v_matricula,
    (select auth.uid()), v_data
  );

  update public."TB_CANDIDATO_APROVADO"
  set status = v_status,
      processo_sei = nullif(btrim(coalesce(p_processo_sei, '')), ''),
      matricula = case
        when v_status in ('Contratado', 'Migração') then v_matricula
        else null
      end,
      "DT_CONVOCACAO" = v_data,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = v_candidato.id;

  -- O KPI de contratados do edital já com o status novo (20261006070000).
  if v_lista.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(v_lista.edital_id::uuid);
  end if;

  return jsonb_build_object(
    'ok', true,
    'candidato_id', v_candidato.id,
    'status', v_status,
    'matricula', v_matricula,
    'data_convocacao', v_data
  );
end;
$function$;


create or replace function public.marcar_candidatos_convocados(
  p_candidatos uuid[],
  p_data_convocacao date default null,
  p_carta uuid default null
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date := coalesce(p_data_convocacao, (now() at time zone 'America/Sao_Paulo')::date);
  v_ids uuid[];
  v_c record;
  v_marcados integer := 0;
  v_ignorados jsonb := '[]'::jsonb;
begin
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Perfil sem permissao para alterar status' using errcode = '42501';
  end if;
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_candidatos, '{}'::uuid[])) x where x is not null;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Escolha ao menos um candidato.' using errcode = '22023';
  end if;
  if array_length(v_ids, 1) > 500 then
    raise exception 'No máximo 500 candidatos por vez.' using errcode = '22023';
  end if;
  if v_data > v_hoje then
    raise exception 'A data da convocação não pode ser futura' using errcode = '22023';
  end if;
  if p_carta is not null and not exists (
    select 1 from public."TH_CARTA_CONVOCACAO" where "CO_CARTA_CONVOCACAO" = p_carta
  ) then
    raise exception 'Carta de convocação não encontrada' using errcode = '22023';
  end if;

  -- Área e recorte de cada edital antes de mudar qualquer um (tudo ou nada).
  perform private."FC_EXIGIR_AREA_EDITAL"(l.edital_id)
     from public."TB_CANDIDATO_APROVADO" c
     join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    where c.id = any (v_ids);

  for v_c in
    select c.id, c.nome, c.status, c.lista_id, c."DT_CONVOCACAO", l.vigente, l.ativo
      from public."TB_CANDIDATO_APROVADO" c
      join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
     where c.id = any (v_ids) and c.removido_em is null
     order by c.id
       for update of c
  loop
    if not v_c.vigente or not v_c.ativo then
      v_ignorados := v_ignorados || jsonb_build_object('candidato_id', v_c.id, 'nome', v_c.nome, 'motivo', 'Lista inativa ou substituída');
    elsif v_c.status is not null and v_c.status <> 'Convocado' then
      v_ignorados := v_ignorados || jsonb_build_object('candidato_id', v_c.id, 'nome', v_c.nome, 'motivo', 'Já está como ' || v_c.status);
    else
      insert into public."TH_CANDIDATO_APROVADO"(
        candidato_id, lista_id, status_anterior, status_novo, alterado_por, "DT_CONVOCACAO", "CO_CARTA_CONVOCACAO"
      ) values (
        v_c.id, v_c.lista_id, v_c.status, 'Convocado', (select auth.uid()), v_data, p_carta
      );
      update public."TB_CANDIDATO_APROVADO"
         set status = 'Convocado', matricula = null, "DT_CONVOCACAO" = v_data,
             updated_by = (select auth.uid()), updated_at = now()
       where id = v_c.id;
      if p_carta is not null then
        update public."RL_CARTA_CANDIDATO"
           set "DT_CONVOCACAO_MARCADA" = v_data
         where "CO_CARTA_CONVOCACAO" = p_carta and "CO_CANDIDATO_APROVADO" = v_c.id;
      end if;
      v_marcados := v_marcados + 1;
    end if;
  end loop;

  -- O KPI de contratados de cada edital tocado (20261006070000).
  perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(e.edital_id::uuid)
     from (select distinct l.edital_id
             from public."TB_CANDIDATO_APROVADO" c
             join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
            where c.id = any (v_ids) and l.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') e;

  -- Quem não existe (ou foi removido) também volta, para a tela dizer.
  v_ignorados := v_ignorados || coalesce((
    select jsonb_agg(jsonb_build_object('candidato_id', x, 'nome', null, 'motivo', 'Candidato não encontrado'))
      from unnest(v_ids) x
     where not exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.id = x and c.removido_em is null)
  ), '[]'::jsonb);

  return json_build_object('marcados', v_marcados, 'ignorados', v_ignorados, 'data_convocacao', v_data);
end;
$function$;


-- 6. Recurso acha a análise pelo número do edital -------------------------------------------------

create or replace function public.salvar_recurso_candidato(p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_edital_id uuid;
  v_edital text;
  v_area text;
  v_origem text;
  v_fora boolean;
  v_analise_id uuid;
  v_nota numeric;
  v_resultado text;
  v_responsavel text;
  v_duplicado bigint;
  v_atual public."TB_RECURSO_CANDIDATO";
  v_novo public."TB_RECURSO_CANDIDATO";
  v_texto text;
begin
  if jsonb_typeof(p_dados) is distinct from 'object' then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  v_id := nullif(p_dados->>'id', '')::uuid;

  if v_id is null then
    -- Cadastro: nasce REGISTRADO; a situação muda só pelo fluxo do parecer.
    v_edital_id := nullif(p_dados->>'edital_id', '')::uuid;
    select m.edital, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id = v_edital_id;
    if v_area is null then
      raise exception 'Edital não encontrado' using errcode = '22023';
    end if;
    perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
    perform private."FC_EXIGIR_AREA_EDITAL"(v_edital_id::text);

    if coalesce(nullif(p_dados->>'situacao', ''), 'REGISTRADO') <> 'REGISTRADO' then
      raise exception 'O recurso nasce registrado; a decisão é do parecer jurídico' using errcode = '22023';
    end if;
    v_origem := nullif(p_dados->>'origem', '');
    if not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_origem and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
    v_fora := coalesce((p_dados->>'fora_analise')::boolean, false);

    if not v_fora then
      select a.id, a.nota_final_ajustada, a.status_consolidado, a.responsavel_analise
        into v_analise_id, v_nota, v_resultado, v_responsavel
      from public."TB_ANALISE_CURRICULAR" a
      where a.id = nullif(p_dados->>'analise_id', '')::uuid
        and private."FC_ANALISE_DO_EDITAL"(a.edital, v_edital)
        and a."CO_AREA" = v_area;
      if v_analise_id is null then
        raise exception 'Candidato não encontrado nas análises deste edital' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."CO_ANALISE_CURRICULAR" = v_analise_id
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" in ('REGISTRADO', 'EM_ANALISE_JURIDICA')
      order by r."NU_RECURSO"
      limit 1;
    else
      v_texto := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_texto) not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."ST_FORA_ANALISE" = 'S'
        and private."FC_TEXTO_BUSCA_RECURSO"(r."NO_CANDIDATO_INFORMADO") = private."FC_TEXTO_BUSCA_RECURSO"(v_texto)
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" in ('REGISTRADO', 'EM_ANALISE_JURIDICA')
      order by r."NU_RECURSO"
      limit 1;
    end if;

    if v_duplicado is not null and not coalesce((p_dados->>'permitir_duplicado')::boolean, false) then
      raise exception 'Já existe o recurso nº % sem decisão para este candidato, edital e origem', v_duplicado
        using errcode = '23505', hint = 'duplicado:' || v_duplicado;
    end if;

    insert into public."TB_RECURSO_CANDIDATO" (
      "CO_MONITORAMENTO", "CO_ORIGEM_RECURSO", "CO_ANALISE_CURRICULAR", "ST_FORA_ANALISE",
      "NO_CANDIDATO_INFORMADO", "CO_CANDIDATO_INFORMADO", "NO_CARGO_INFORMADO", "CO_VAGA_INFORMADA",
      "VL_NOTA_ANTERIOR", "DS_RESULTADO_ANTERIOR", "NO_ANALISTA", "TP_SITUACAO",
      "NU_PROCESSO_SEI", "ST_MUDOU_CLASSIFICACAO", "DS_OBSERVACAO",
      "DT_PROCESSO_SEI", "CO_USUARIO_PROCESSO_SEI",
      "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO"
    ) values (
      v_edital_id, v_origem,
      v_analise_id,
      case when v_fora then 'S' else 'N' end,
      case when v_fora then v_texto end,
      case when v_fora then nullif(btrim(p_dados->>'codigo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'cargo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'vaga_informada'), '') end,
      v_nota,
      v_resultado,
      coalesce(nullif(btrim(p_dados->>'analista'), ''), nullif(btrim(v_responsavel), '')),
      'REGISTRADO',
      nullif(btrim(p_dados->>'processo_sei'), ''),
      case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end,
      nullif(btrim(p_dados->>'observacao'), ''),
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then now() end,
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then v_uid end,
      v_uid, v_uid
    )
    returning * into v_novo;

    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_novo."CO_RECURSO_CANDIDATO", 'criacao', v_novo."TP_SITUACAO", v_uid);

    return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
  end if;

  -- Edição -------------------------------------------------------------------
  select r.* into v_atual
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_atual."CO_MONITORAMENTO";
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_atual."CO_MONITORAMENTO"::text);
  if (p_dados->>'revisao') is null or (p_dados->>'revisao')::integer <> v_atual."NU_REVISAO" then
    raise exception 'O recurso foi alterado por outra pessoa. Recarregue e tente de novo.' using errcode = '40001';
  end if;
  if p_dados ? 'situacao' and coalesce(nullif(p_dados->>'situacao', ''), v_atual."TP_SITUACAO") <> v_atual."TP_SITUACAO" then
    raise exception 'A situação do recurso muda só pelo fluxo do parecer jurídico' using errcode = '22023';
  end if;

  v_novo := v_atual;
  if p_dados ? 'origem' then
    v_novo."CO_ORIGEM_RECURSO" := nullif(p_dados->>'origem', '');
    if v_novo."CO_ORIGEM_RECURSO" is distinct from v_atual."CO_ORIGEM_RECURSO"
       and not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO" and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
  end if;
  if p_dados ? 'analista' then v_novo."NO_ANALISTA" := nullif(btrim(p_dados->>'analista'), ''); end if;
  if p_dados ? 'processo_sei' then v_novo."NU_PROCESSO_SEI" := nullif(btrim(p_dados->>'processo_sei'), ''); end if;
  if p_dados ? 'mudou_classificacao' then
    v_novo."ST_MUDOU_CLASSIFICACAO" := case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end;
  end if;
  if p_dados ? 'observacao' then v_novo."DS_OBSERVACAO" := nullif(btrim(p_dados->>'observacao'), ''); end if;
  if v_atual."ST_FORA_ANALISE" = 'S' then
    if p_dados ? 'nome_informado' then
      v_novo."NO_CANDIDATO_INFORMADO" := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_novo."NO_CANDIDATO_INFORMADO") not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
    end if;
    if p_dados ? 'codigo_informado' then v_novo."CO_CANDIDATO_INFORMADO" := nullif(btrim(p_dados->>'codigo_informado'), ''); end if;
    if p_dados ? 'cargo_informado' then v_novo."NO_CARGO_INFORMADO" := nullif(btrim(p_dados->>'cargo_informado'), ''); end if;
    if p_dados ? 'vaga_informada' then v_novo."CO_VAGA_INFORMADA" := nullif(btrim(p_dados->>'vaga_informada'), ''); end if;
  end if;

  -- Informar o número do processo SEI marca a etapa "processo SEI criado".
  if v_novo."NU_PROCESSO_SEI" is not null and v_novo."DT_PROCESSO_SEI" is null then
    v_novo."DT_PROCESSO_SEI" := now();
    v_novo."CO_USUARIO_PROCESSO_SEI" := v_uid;
  end if;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  select v_id, c.acao, c.campo, c.antes, c.depois, v_uid
  from (values
    ('edicao', 'origem', v_atual."CO_ORIGEM_RECURSO", v_novo."CO_ORIGEM_RECURSO"),
    ('edicao', 'analista', v_atual."NO_ANALISTA", v_novo."NO_ANALISTA"),
    ('edicao', 'processo_sei', v_atual."NU_PROCESSO_SEI", v_novo."NU_PROCESSO_SEI"),
    ('edicao', 'mudou_classificacao', v_atual."ST_MUDOU_CLASSIFICACAO", v_novo."ST_MUDOU_CLASSIFICACAO"),
    ('edicao', 'observacao', v_atual."DS_OBSERVACAO", v_novo."DS_OBSERVACAO"),
    ('edicao', 'nome_informado', v_atual."NO_CANDIDATO_INFORMADO", v_novo."NO_CANDIDATO_INFORMADO"),
    ('edicao', 'codigo_informado', v_atual."CO_CANDIDATO_INFORMADO", v_novo."CO_CANDIDATO_INFORMADO"),
    ('edicao', 'cargo_informado', v_atual."NO_CARGO_INFORMADO", v_novo."NO_CARGO_INFORMADO"),
    ('edicao', 'vaga_informada', v_atual."CO_VAGA_INFORMADA", v_novo."CO_VAGA_INFORMADA"),
    ('etapa', 'processo_sei', case when v_atual."DT_PROCESSO_SEI" is null then 'N' else 'S' end, case when v_novo."DT_PROCESSO_SEI" is null then 'N' else 'S' end)
  ) as c(acao, campo, antes, depois)
  where c.antes is distinct from c.depois;
  if not found then
    return json_build_object('id', v_atual."CO_RECURSO_CANDIDATO", 'nu', v_atual."NU_RECURSO", 'revisao', v_atual."NU_REVISAO");
  end if;

  update public."TB_RECURSO_CANDIDATO" set
    "CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO",
    "NO_ANALISTA" = v_novo."NO_ANALISTA",
    "NU_PROCESSO_SEI" = v_novo."NU_PROCESSO_SEI",
    "ST_MUDOU_CLASSIFICACAO" = v_novo."ST_MUDOU_CLASSIFICACAO",
    "DS_OBSERVACAO" = v_novo."DS_OBSERVACAO",
    "NO_CANDIDATO_INFORMADO" = v_novo."NO_CANDIDATO_INFORMADO",
    "CO_CANDIDATO_INFORMADO" = v_novo."CO_CANDIDATO_INFORMADO",
    "NO_CARGO_INFORMADO" = v_novo."NO_CARGO_INFORMADO",
    "CO_VAGA_INFORMADA" = v_novo."CO_VAGA_INFORMADA",
    "DT_PROCESSO_SEI" = v_novo."DT_PROCESSO_SEI",
    "CO_USUARIO_PROCESSO_SEI" = v_novo."CO_USUARIO_PROCESSO_SEI",
    "NU_REVISAO" = v_atual."NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = v_id
  returning * into v_novo;

  return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
end;
$function$;


create or replace function public.buscar_candidatos_recurso(p_edital_id uuid, p_busca text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_edital text;
  v_area text;
  v_busca text := btrim(coalesce(p_busca, ''));
  v_texto text;
begin
  select m.edital, m."CO_AREA" into v_edital, v_area
  from public."TB_MONITORAMENTO_INDIGENA" m
  where m.id = p_edital_id;
  if v_area is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id::text);
  if length(v_busca) < 2 then
    return '[]'::json;
  end if;
  v_texto := private."FC_TEXTO_BUSCA_RECURSO"(left(v_busca, 100));
  return (
    select coalesce(json_agg(json_build_object(
        'id', x.id,
        'candidato', x.candidato,
        'codigo', x.id_origem,
        'vaga', x.codigo_vaga,
        'cargo', x.nome_vaga,
        'nota', x.nota_final_ajustada,
        'resultado', x.status_consolidado,
        'responsavel', x.responsavel_analise,
        'modalidade', x.modalidade_concorrencia,
        'ativo', x.ativo
      ) order by x.ativo desc, x.candidato, x.codigo_vaga), '[]'::json)
    from (
      select a.id, a.candidato, a.id_origem, a.codigo_vaga, a.nome_vaga,
             a.nota_final_ajustada, a.status_consolidado, a.responsavel_analise,
             a.modalidade_concorrencia, a.ativo
      from public."TB_ANALISE_CURRICULAR" a
      where private."FC_ANALISE_DO_EDITAL"(a.edital, v_edital)
        and a."CO_AREA" = v_area
        and (strpos(private."FC_TEXTO_BUSCA_RECURSO"(a.candidato), v_texto) > 0
             or a.id_origem = v_busca)
      order by a.ativo desc, a.candidato, a.codigo_vaga
      limit 20
    ) x
  );
end;
$function$;
-- ═══ CORPO DA MIGRATION (fim) ═══

-- ═══════════════════════════════════════════════════════════════════════════
-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)
-- ═══════════════════════════════════════════════════════════════════════════

-- E1. Estrutura: as funções novas são SECURITY DEFINER com search_path vazio e
--     authenticated não executa as privadas.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where (n.nspname, p.proname) in (('private', 'FC_EXIGIR_CANDIDATOS_DO_EDITAL'), ('private', 'FC_ATUALIZAR_CONTRATADOS_DO_EDITAL'),
                                               ('public', 'registrar_lista_classificacao'), ('public', 'publicar_lista_aprovados_da_classificacao'),
                                               ('public', 'alterar_status_candidato_aprovado'), ('public', 'marcar_candidatos_convocados'),
                                               ('public', 'salvar_recurso_candidato'), ('public', 'buscar_candidatos_recurso'))
                and (not p.prosecdef or not ('search_path=""' = any (coalesce(p.proconfig, '{}'))))) then
    raise exception 'FALHOU E1: função sem security definer ou sem search_path vazio';
  end if;
  if has_function_privilege('authenticated', 'private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(uuid, jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private."FC_ANALISE_DO_EDITAL"(text, text)', 'EXECUTE') then
    raise exception 'FALHOU E1: authenticated executa função privada nova';
  end if;
  if not private."FC_ANALISE_DO_EDITAL"('Edital nº 0999/2099 (Projetos)', 'Edital 999/2099 - Ensaio')
     or private."FC_ANALISE_DO_EDITAL"('Edital 998/2099', 'Edital 999/2099 - Ensaio')
     or not private."FC_ANALISE_DO_EDITAL"(' FGV ', 'FGV')
     or private."FC_ANALISE_DO_EDITAL"('FCC', 'FGV')
     or private."FC_ANALISE_DO_EDITAL"(null, 'Edital 999/2099') then
    raise exception 'FALHOU E1: FC_ANALISE_DO_EDITAL (número, texto sem número, nulo)';
  end if;
  raise notice 'ok E1: definer + search_path vazio, privadas sem execute para authenticated, critério do edital';
end;
$$;

-- E2. Atores sintéticos, um edital sintético de Projetos (pela RPC do Núcleo) e as
--     análises: três do edital (uma com o texto do edital diferente, mesmo número),
--     uma inativa, uma de outro número na mesma área e uma real de outra área.
do $$
declare
  v_fora uuid;
begin
  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where private."FC_NUMERO_EDITAL"(edital) in ('999/2099', '998/2099'))
     or exists (select 1 from public."TB_ANALISE_CURRICULAR" where private."FC_NUMERO_EDITAL"(edital) in ('999/2099', '998/2099')) then
    raise exception 'ENSAIO: já existe dado com 999/2099 ou 998/2099';
  end if;
  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000e601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.int.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e602', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.int.contratador@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000e601', 'ensaio.int.gestor@ensaio.invalid', 'Ensaio Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-00000000e602', 'ensaio.int.contratador@ensaio.invalid', 'Ensaio Contratador', 'contratador', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, 'projetos' from public."TB_PERFIL_USUARIO" u where u.email like 'ensaio.int.%@ensaio.invalid';

  insert into public."TB_ANALISE_CURRICULAR" (chave_natural, grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, id_origem,
    modalidade_concorrencia, nota_final_ajustada, status_consolidado, ativo, "CO_PLANILHA")
  values
    ('ensaio-int|1', 'Projetos', 'Ensaio Unidade', 'Edital 999/2099 - Ensaio', '9990900', 'Analista de Ensaio', 'Ensaio Ana', '9990001', 'Ampla concorrência', 90, 'Aprovado', true, 'projetos'),
    ('ensaio-int|2', 'Projetos', 'Ensaio Unidade', 'Edital 999/2099 - Ensaio', '9990900', 'Analista de Ensaio', 'Ensaio Bruno', '9990002', 'Pretos e pardos', 80, 'Aprovado', true, 'projetos'),
    ('ensaio-int|3', 'Projetos', 'Ensaio Unidade', 'Edital nº 0999/2099 (Projetos)', '9990900', 'Analista de Ensaio', 'Ensaio Carla', '9990003', 'Ampla concorrência', 70, 'Aprovado', true, 'projetos'),
    ('ensaio-int|4', 'Projetos', 'Ensaio Unidade', 'Edital 999/2099 - Ensaio', '9990900', 'Analista de Ensaio', 'Ensaio Davi Inativo', '9990004', 'Ampla concorrência', 60, 'Aprovado', false, 'projetos'),
    ('ensaio-int|5', 'Projetos', 'Ensaio Unidade', 'Edital 998/2099 - Outro', '9990901', 'Analista de Ensaio', 'Ensaio Elisa Outro Edital', '9990005', 'Ampla concorrência', 95, 'Aprovado', true, 'projetos');
  if (select count(*) from public."TB_ANALISE_CURRICULAR" where chave_natural like 'ensaio-int|%' and "CO_AREA" = 'projetos') <> 5 then
    raise exception 'ENSAIO: as análises sintéticas não ficaram na área Projetos';
  end if;
  select a.id into v_fora from public."TB_ANALISE_CURRICULAR" a
   where a.ativo and a."CO_AREA" = 'saude-indigena' order by a.id limit 1;
  if v_fora is null then raise exception 'ENSAIO: nenhuma análise ativa da Saúde Indígena'; end if;
  perform set_config('ensaio.fora', v_fora::text, true);
  perform set_config('ensaio.analises', (
    select string_agg(a.id_origem || '=' || a.id, ',') from public."TB_ANALISE_CURRICULAR" a where a.chave_natural like 'ensaio-int|%'), true);
  raise notice 'ok E2: atores, 5 análises sintéticas (Projetos) e uma real da Saúde Indígena (%)', v_fora;
end;
$$;

-- Retrato FINAL de uma vaga com as linhas dadas (só do ensaio; some no rollback).
create function public."FC_ENSAIO_INT_RETRATO"(p_linhas jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $function$
  select jsonb_build_object('schema', 1, 'tipo', 'FINAL', 'modalidades', '[{"codigo":"PP","nome":"Pretos e pardos"}]'::jsonb,
    'vagas', jsonb_build_array(jsonb_build_object('chave', '9990900', 'codigo', '9990900', 'cargo', 'Analista de Ensaio',
      'geral', p_linhas, 'listas', '{}'::jsonb, 'eliminados', '[]'::jsonb)),
    'avisos', '[]'::jsonb, 'pendencias', '[]'::jsonb, 'totais', jsonb_build_object('elegiveis', jsonb_array_length(p_linhas)));
$function$;
grant execute on function public."FC_ENSAIO_INT_RETRATO"(jsonb) to authenticated;

-- E3. Como cada pessoa, pelas RPCs (papel authenticated).
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e601","role":"authenticated","email":"ensaio.int.gestor@ensaio.invalid"}';
  c_contratador constant text := '{"sub":"00000000-0000-4000-a000-00000000e602","role":"authenticated","email":"ensaio.int.contratador@ensaio.invalid"}';
  d constant date := (now() at time zone 'America/Sao_Paulo')::date;
  a jsonb := '{}'::jsonb;
  x text;
  v jsonb;
  vj json;
  v_edital uuid;
  v_final uuid;
  v_ok jsonb;
  v_ruins jsonb[];
  v_ruim jsonb;
  v_msg text;
begin
  foreach x in array string_to_array(current_setting('ensaio.analises'), ',') loop
    a := a || jsonb_build_object(split_part(x, '=', 1), split_part(x, '=', 2));
  end loop;

  -- O edital, pela RPC do Núcleo.
  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.salvar_monitoramento_com_cronograma_v2(jsonb_build_object(
      'edital', 'Edital 999/2099 - Ensaio', 'unidade', 'Ensaio Unidade', 'uf', 'DF', 'responsavel', 'ENSAIO',
      'co_area', 'projetos', 'vagas_total', 2, 'cronograma_automatico', true),
    jsonb_build_array(jsonb_build_object('ordem', 1, 'atividade', 'Resultado final', 'data_inicio', d, 'data_fim', d + 10)),
    null, null);
  v_edital := (v #>> '{registro,id}')::uuid;
  perform set_config('ensaio.edital', v_edital::text, true);
  perform public.salvar_regra_classificacao(v_edital, '{
    "schema": 1, "data_corte": null, "etapas": {"documental": true, "entrevista": false},
    "documental": {"nota_minima": 20, "situacoes_aptas": ["Aprovado"], "nota_minima_por_nivel": {}},
    "entrevista": {"nota_minima": null, "competencias": [], "nota_minima_competencia": null, "nota_eliminatoria_ate": null},
    "composicao": {"casas": 2, "arredondamento": "MEIO_PARA_CIMA", "componentes": [{"codigo": "DOCUMENTAL", "peso": 1}]},
    "desempate": [], "listas": {"PRELIMINAR": {"empate": "MESMA_POSICAO"}, "FINAL": {"empate": "CRITERIOS"}},
    "empate_final": {"metodo": "MESMA_POSICAO", "numeracao": "DENSA"},
    "modalidades": [{"codigo": "AC", "nome": "Ampla concorrência", "percentual": null, "remanejar_para": []},
                    {"codigo": "PP", "nome": "Pretos e pardos", "percentual": 50, "lista_propria": true, "remanejar_para": []}],
    "cotas": {"acumulo": "MAIOR_PERCENTUAL", "minimo_vagas_reserva": 0},
    "convocacao": {"multiplo_vagas": null, "posicao_max_cr": null, "excecoes": []}}'::jsonb, 0, null);

  -- A sonda do ensaio de ponta a ponta e as outras listas inválidas: 22023.
  v_ruins := array[
    jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', current_setting('ensaio.fora'), 'nome', 'Pessoa de outra área', 'nota', 999, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', a ->> '9990005', 'nome', 'Ensaio Elisa Outro Edital', 'nota', 95, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', a ->> '9990004', 'nome', 'Ensaio Davi Inativo', 'nota', 60, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', gen_random_uuid(), 'nome', 'Ninguém', 'nota', 50, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', 1001, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', -1, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', '90', 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 0, 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', 90, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1.5, 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', 90, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 'primeiro', 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', 90, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', 'não é uuid', 'nome', 'Ensaio Ana', 'nota', 90, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1, 'nome', 'Sem análise', 'nota', 90, 'situacao', 'VAGA')),
    jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', 90, 'situacao', 'VAGA'),
                      jsonb_build_object('posicao', 2, 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', 90, 'situacao', 'CR'))];
  foreach v_ruim in array v_ruins loop
    begin
      perform public.registrar_lista_classificacao(v_edital, 'FINAL', 1, public."FC_ENSAIO_INT_RETRATO"(v_ruim));
      raise exception 'FALHOU E3: lista inválida registrada: %', v_ruim;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  -- Eliminado de outra área também é recusado.
  begin
    perform public.registrar_lista_classificacao(v_edital, 'FINAL', 1,
      public."FC_ENSAIO_INT_RETRATO"(jsonb_build_array(jsonb_build_object('posicao', 1, 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', 90, 'situacao', 'VAGA')))
      || jsonb_build_object('vagas', jsonb_build_array(jsonb_build_object('codigo', '9990900', 'geral', '[]'::jsonb, 'listas', '{}'::jsonb,
           'eliminados', jsonb_build_array(jsonb_build_object('analise_id', current_setting('ensaio.fora'), 'nome', 'Outra área', 'motivo', 'NOTA_MINIMA'))))));
    raise exception 'FALHOU E3: eliminado de outra área registrado';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok E3.1: % listas inválidas recusadas (22023), entre elas a sonda (análise da Saúde Indígena, nota 999)', cardinality(v_ruins) + 1;

  -- O caminho normal: empate (mesma posição) vale; a análise com o texto do edital diferente, mesmo número, entra.
  v_ok := public."FC_ENSAIO_INT_RETRATO"(jsonb_build_array(
    jsonb_build_object('posicao', 1, 'analise_id', a ->> '9990001', 'nome', 'Ensaio Ana', 'nota', 90, 'situacao', 'VAGA', 'modalidades', '["AC"]'::jsonb),
    jsonb_build_object('posicao', 2, 'analise_id', a ->> '9990002', 'nome', 'Ensaio Bruno', 'nota', 80, 'situacao', 'VAGA', 'modalidades', '["AC","PP"]'::jsonb),
    jsonb_build_object('posicao', 2, 'analise_id', a ->> '9990003', 'nome', 'Ensaio Carla', 'nota', 80, 'situacao', 'CR', 'modalidades', '["AC"]'::jsonb)))
    || '{}'::jsonb;
  v_ok := jsonb_set(v_ok, '{vagas,0,listas}', jsonb_build_object('PP', jsonb_build_array(
    jsonb_build_object('posicao', 1, 'analise_id', a ->> '9990002', 'nome', 'Ensaio Bruno', 'nota', 80, 'situacao', 'VAGA', 'modalidades', '["AC","PP"]'::jsonb))));
  v_ok := jsonb_set(v_ok, '{vagas,0,eliminados}', jsonb_build_array(
    jsonb_build_object('analise_id', null, 'nome', 'Linha sem análise', 'motivo', 'SEM_ANALISE')));
  vj := public.registrar_lista_classificacao(v_edital, 'FINAL', 1, v_ok);
  v_final := (vj ->> 'id')::uuid;
  perform public.publicar_lista_classificacao(v_final);
  vj := public.publicar_lista_aprovados_da_classificacao(v_final, null, '[]'::jsonb);
  if (vj ->> 'candidatos')::integer <> 3 then raise exception 'FALHOU E3: publicação normal %', vj; end if;
  perform set_config('ensaio.final', v_final::text, true);
  perform set_config('ensaio.lista', vj ->> 'lista_id', true);
  raise notice 'ok E3.2: o caminho normal passa (empate, texto do edital diferente com o mesmo número, eliminado sem análise): 3 publicados';

  -- Recurso pela análise cujo texto do edital é outro (mesmo número): antes, "Candidato não encontrado".
  if not exists (select 1 from json_array_elements(public.buscar_candidatos_recurso(v_edital, 'Carla')) r
                  where (r ->> 'id')::uuid = (a ->> '9990003')::uuid) then
    raise exception 'FALHOU E3: buscar_candidatos_recurso não achou a análise pelo número do edital';
  end if;
  vj := public.salvar_recurso_candidato(jsonb_build_object('edital_id', v_edital, 'origem', 'analise-curricular',
          'fora_analise', false, 'analise_id', a ->> '9990003'));
  if vj ->> 'id' is null then raise exception 'FALHOU E3: recurso pela análise do mesmo número %', vj; end if;
  begin
    perform public.salvar_recurso_candidato(jsonb_build_object('edital_id', v_edital, 'origem', 'analise-curricular',
      'fora_analise', false, 'analise_id', a ->> '9990005'));
    raise exception 'FALHOU E3: recurso aceitou análise de outro número de edital';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok E3.3: recurso acha a análise pelo número do edital (texto diferente) e recusa outro número (22023)';
end;
$$;
reset role;

-- E4. contratados do edital já veio da lista publicada (estava nulo), sem o pg_cron.
do $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = current_setting('ensaio.edital')::uuid;
  if v_m.contratados is distinct from 0 then
    raise exception 'FALHOU E4: contratados depois de publicar (%)', v_m.contratados;
  end if;
  perform set_config('ensaio.candidatos', (
    select string_agg(c.nome || '=' || c.id, ',') from public."TB_CANDIDATO_APROVADO" c
     where c.lista_id = current_setting('ensaio.lista')::uuid), true);
  raise notice 'ok E4: publicar atualizou contratados do edital (0, a lista nova sem status)';
end;
$$;

-- E5. Convocar e contratar atualizam contratados na hora.
set local role authenticated;
do $$
declare
  c_contratador constant text := '{"sub":"00000000-0000-4000-a000-00000000e602","role":"authenticated","email":"ensaio.int.contratador@ensaio.invalid"}';
  c jsonb := '{}'::jsonb;
  x text;
  v json;
begin
  foreach x in array string_to_array(current_setting('ensaio.candidatos'), ',') loop
    c := c || jsonb_build_object(split_part(x, '=', 1), split_part(x, '=', 2));
  end loop;
  perform set_config('request.jwt.claims', c_contratador, true);
  v := public.marcar_candidatos_convocados(array[(c ->> 'Ensaio Ana')::uuid, (c ->> 'Ensaio Bruno')::uuid], null, null);
  if (v ->> 'marcados')::integer <> 2 then raise exception 'FALHOU E5: marcar convocados %', v; end if;
  perform public.alterar_status_candidato_aprovado((c ->> 'Ensaio Ana')::uuid, 'Contratado', '00000.999999/2099-01', 'ENS-1', null);
  perform public.alterar_status_candidato_aprovado((c ->> 'Ensaio Bruno')::uuid, 'Contratado', '00000.999999/2099-02', 'ENS-2', null);
  if (select (l ->> 'contratados')::integer from jsonb_array_elements(public.listar_acompanhamento_da_visao_geral('projetos') -> 'listas') l
       where (l ->> 'monitoramento_id')::uuid = current_setting('ensaio.edital')::uuid) is distinct from 2 then
    raise exception 'FALHOU E5: Visão geral sem os 2 contratados';
  end if;
  raise notice 'ok E5: 2 convocados e 2 contratados pelo contratador';
end;
$$;
reset role;

do $$
begin
  if (select contratados from public."TB_MONITORAMENTO_INDIGENA" where id = current_setting('ensaio.edital')::uuid) is distinct from 2 then
    raise exception 'FALHOU E5: o KPI de contratados do edital não acompanhou o status (sem pg_cron)';
  end if;
  raise notice 'ok E5.2: TB_MONITORAMENTO_INDIGENA.contratados = 2 logo depois do status';
end;
$$;

-- E6. Uma lista FINAL gravada antes da migration (direto na tabela) com análise de outra
--     área: publicar confere o retrato gravado e recusa.
do $$
declare
  v_r jsonb;
  v_id uuid;
begin
  v_r := public."FC_ENSAIO_INT_RETRATO"(jsonb_build_array(jsonb_build_object(
    'posicao', 1, 'analise_id', current_setting('ensaio.fora'), 'nome', 'Pessoa de outra área', 'nota', 999, 'situacao', 'VAGA')));
  insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
    "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "CO_USUARIO", "DT_GERACAO")
  select current_setting('ensaio.edital')::uuid, 'FINAL', r."CO_REGRA_CLASSIFICACAO", r."NU_VERSAO_VIGENTE", v_r,
         encode(sha256(convert_to(v_r::text, 'UTF8')), 'hex'), 1, '00000000-0000-4000-a000-00000000e601', now() + interval '1 minute'
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid
  returning "CO_LISTA_CLASSIFICACAO" into v_id;
  perform set_config('ensaio.antiga', v_id::text, true);
end;
$$;
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000e601","role":"authenticated","email":"ensaio.int.gestor@ensaio.invalid"}', true);
  begin
    perform public.publicar_lista_aprovados_da_classificacao(current_setting('ensaio.antiga')::uuid, current_setting('ensaio.lista')::uuid, '[]'::jsonb);
    raise exception 'FALHOU E6: publicou lista gravada com análise de outra área';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok E6: publicar recusa (22023) a lista FINAL gravada antes com análise de outra área';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

-- Resumo (o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    where l.vigente and l.edital_id = current_setting('ensaio.edital')) as aprovados_vigentes,
  (select contratados from public."TB_MONITORAMENTO_INDIGENA" where id = current_setting('ensaio.edital')::uuid) as kpi_contratados,
  (select count(*) from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    where l.vigente and l.edital_id = current_setting('ensaio.edital')
      and c."CO_ANALISE_CURRICULAR" = current_setting('ensaio.fora')::uuid) as de_outra_area_na_lista;

rollback;
