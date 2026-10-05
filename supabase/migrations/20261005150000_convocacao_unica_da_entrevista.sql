/*
  CONVOCAÇÃO ÚNICA PARA A ENTREVISTA: A LISTA CONVOCACAO DA CLASSIFICAÇÃO

  Havia três "convocações": a lista CONVOCACAO da Classificação (motor
  src/lib/classificacao/motor.js, regra TB_REGRA_CLASSIFICACAO, vagas do quadro
  do edital e da configuração da convocação), o ranking próprio de Entrevistas ›
  Conduzir (nota da análise, regra DS_CONVOCACAO do edital e vagas imediatas
  digitadas em TB_ENTREVISTA_VAGA) e a convocação padrão do roteiro, que
  preenchia a do edital. No edital 101/2026 (DSEI Manaus) as vagas da entrevista
  estavam vazias, todos ficaram "Além da regra" e ninguém foi convocado.

  Fica uma só: a última lista CONVOCACAO gerada na Classificação
  (TB_LISTA_CLASSIFICACAO) — mesma ordem, mesmos critérios, mesmo limite da
  regra, mesmas vagas. Entrevistas só registra quem dela vai para a ficha de
  notas.

  O QUE MUDA
    private."FC_LISTA_CONVOCACAO_VIGENTE"  a última lista CONVOCACAO do edital
    private."FC_CONVOCADOS_DA_LISTA"       as análises de uma lista: a geral e as
                                           listas por modalidade de cada vaga (os
                                           eliminados não entram)
    obter_entrevistas_do_edital            saem o ranking próprio (candidatos) e
                                           as vagas digitadas (vagas); entram a
                                           lista vigente com o retrato
                                           (lista_convocacao), a regra de
                                           convocação vigente da Classificação
                                           (regra_classificacao) e se a pessoa
                                           pode gerar a lista (pode_gerar_lista)
    configurar_entrevista_edital           só roteiro, composição da banca, modo
                                           de lançamento e membros; não grava mais
                                           DS_CONVOCACAO nem TB_ENTREVISTA_VAGA
    convocar_para_entrevista(p_edital, p_lista, p_analises)
                                           registra os convocados da lista vigente
                                           para a ficha: lista que não é a vigente
                                           = 40001; candidato fora dela = 23514;
                                           sem lista gerada = 23514. A versão de
                                           dois argumentos sai.

  NADA É APAGADO: convocados e notas ficam; quem foi convocado e não está na
  lista vigente continua na ficha (a tela marca e deixa desconvocar quem não
  tem nota, com motivo). TB_ENTREVISTA_VAGA, TB_ENTREVISTA_EDITAL."DS_CONVOCACAO"
  e TB_ROTEIRO_ENTREVISTA."DS_CONVOCACAO_PADRAO" ficam, sem leitura nem
  gravação (os comentários dizem isso).

  PERMISSÃO: a de sempre (FC_EXIGIR_ENTREVISTAS_EDITAL: entrevistas >= leitor
  para ler e >= editor para gravar, a área e o recorte do edital).

  PRÉ-REQUISITO: 20261002150000_classificacao.sql, 20260930220000 e
  20260930233000 (entrevistas e quadro de vagas) aplicadas.

  Ensaio: supabase/ensaios/20261005150000_convocacao_unica_da_entrevista.sql
  Rollback: supabase/rollback/20261005150000_convocacao_unica_da_entrevista.sql
*/
begin;

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_LISTA_CLASSIFICACAO"') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
  if to_regclass('public."TB_ENTREVISTA_EDITAL"') is null then
    raise exception 'Aplique antes 20260930220000_entrevistas_roteiros_e_notas.sql.';
  end if;
  if to_regclass('public."TB_QUADRO_VAGA_EDITAL"') is null then
    raise exception 'Aplique antes 20260930233000_quadro_de_vagas_do_edital.sql.';
  end if;
end;
$$;

-- 1. A lista vigente e quem está nela ---------------------------------------------------
create function private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital uuid)
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select l."CO_LISTA_CLASSIFICACAO"
    from public."TB_LISTA_CLASSIFICACAO" l
   where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" = 'CONVOCACAO'
   order by l."DT_GERACAO" desc, l."CO_LISTA_CLASSIFICACAO" desc
   limit 1;
$function$;
comment on function private."FC_LISTA_CONVOCACAO_VIGENTE"(uuid) is
  'A lista de convocação para entrevista vigente do edital: a última CONVOCACAO gerada na Classificação (TB_LISTA_CLASSIFICACAO); null sem lista. Sem checagem de permissão: só as RPCs chamam.';
revoke all on function private."FC_LISTA_CONVOCACAO_VIGENTE"(uuid) from public, anon, authenticated;

create function private."FC_CONVOCADOS_DA_LISTA"(p_lista uuid)
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select distinct (x.linha ->> 'analise_id')::uuid
    from public."TB_LISTA_CLASSIFICACAO" l
   cross join lateral jsonb_array_elements(
           case when jsonb_typeof(l."DS_RESULTADO" -> 'vagas') = 'array' then l."DS_RESULTADO" -> 'vagas' else '[]'::jsonb end) v(vaga)
   cross join lateral (
           select g.linha
             from jsonb_array_elements(
                    case when jsonb_typeof(v.vaga -> 'geral') = 'array' then v.vaga -> 'geral' else '[]'::jsonb end) g(linha)
           union all
           select m.linha
             from jsonb_each(
                    case when jsonb_typeof(v.vaga -> 'listas') = 'object' then v.vaga -> 'listas' else '{}'::jsonb end) e(codigo, linhas)
            cross join lateral jsonb_array_elements(
                    case when jsonb_typeof(e.linhas) = 'array' then e.linhas else '[]'::jsonb end) m(linha)) x
   where l."CO_LISTA_CLASSIFICACAO" = p_lista
     and coalesce(x.linha ->> 'analise_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$function$;
comment on function private."FC_CONVOCADOS_DA_LISTA"(uuid) is
  'As análises (TB_ANALISE_CURRICULAR.id) de uma lista gerada: a classificação geral e as listas por modalidade de cada vaga do retrato (DS_RESULTADO); os eliminados não entram. Sem checagem de permissão: só as RPCs chamam.';
revoke all on function private."FC_CONVOCADOS_DA_LISTA"(uuid) from public, anon, authenticated;

-- 2. O edital para conduzir: a lista da Classificação no lugar do ranking próprio -----------
create or replace function public.obter_entrevistas_do_edital(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
  v_lista uuid := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'pode_gerar_lista', private.pode_recurso('classificacao', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'banca', v_cfg."DS_BANCA",
        'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'regra_classificacao', (
      select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'convocacao', h."DS_CONFIGURACAO" -> 'convocacao')
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'lista_convocacao', case when v_lista is null then null else json_build_object(
        'lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_lista),
        'retrato', (select l."DS_RESULTADO" from public."TB_LISTA_CLASSIFICACAO" l
                     where l."CO_LISTA_CLASSIFICACAO" = v_lista)) end,
    'avaliadores', coalesce((
      select json_agg(json_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM",
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S') order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA"))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;
comment on function public.obter_entrevistas_do_edital(uuid) is
  'Tudo para conduzir a entrevista de um edital: configuração (roteiro, banca, lançamento), a lista de convocação vigente da Classificação com o retrato (a única convocação), a regra de convocação vigente da Classificação, a banca e os convocados com as notas; pode_editar, pode_gerar_lista, admin_global e meu_perfil. entrevistas >= leitor, a área e o recorte do edital.';

-- 3. Configuração: sem regra de convocação e sem vagas digitadas ------------------------------
create or replace function public.configurar_entrevista_edital(p_edital uuid, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_roteiro uuid := nullif(p_dados ->> 'roteiro', '')::uuid;
  b jsonb;
begin
  if v_roteiro is null or not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    raise exception 'Escolha um roteiro' using errcode = '22023';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA" e join public."TB_ENTREVISTA_AVALIACAO" x on x."CO_ENTREVISTA" = e."CO_ENTREVISTA"
              where e."CO_MONITORAMENTO" = p_edital and e."CO_ROTEIRO" is distinct from v_roteiro) then
    raise exception 'Já há notas lançadas com outro roteiro neste edital; o roteiro não pode mais ser trocado' using errcode = '23514';
  end if;
  -- A convocação é a lista da Classificação: DS_CONVOCACAO não é mais gravada (fica o que havia).
  insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
  values (p_edital, v_roteiro, coalesce(p_dados -> 'banca', '[]'),
          coalesce(nullif(p_dados ->> 'lancamento', ''), 'SECRETARIA'), (select auth.uid()))
  on conflict ("CO_MONITORAMENTO") do update set
    "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DS_BANCA" = excluded."DS_BANCA",
    "TP_LANCAMENTO" = excluded."TP_LANCAMENTO", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";

  update public."TB_ENTREVISTA" set "CO_ROTEIRO" = v_roteiro
   where "CO_MONITORAMENTO" = p_edital and "TP_ORIGEM" = 'sistema' and "CO_ROTEIRO" is distinct from v_roteiro;

  -- Banca: membros enviados (com id = atualiza; sem id = novo); os que não vieram saem (ST_ATIVO N).
  if jsonb_typeof(p_dados -> 'avaliadores') = 'array' then
    update public."TB_ENTREVISTA_AVALIADOR" a set "ST_ATIVO" = 'N'
     where a."CO_MONITORAMENTO" = p_edital and a."ST_ATIVO" = 'S'
       and not exists (select 1 from jsonb_array_elements(p_dados -> 'avaliadores') x where nullif(x ->> 'id', '')::uuid = a."CO_AVALIADOR");
    for b in select value from jsonb_array_elements(p_dados -> 'avaliadores') loop
      if nullif(b ->> 'id', '') is not null then
        update public."TB_ENTREVISTA_AVALIADOR" set "NO_AVALIADOR" = btrim(b ->> 'nome'), "NO_ORIGEM" = btrim(b ->> 'origem'),
               "NU_BANCA" = coalesce(nullif(b ->> 'banca', '')::smallint, 1), "CO_PERFIL_USUARIO" = nullif(b ->> 'perfil', '')::uuid, "ST_ATIVO" = 'S'
         where "CO_AVALIADOR" = (b ->> 'id')::uuid and "CO_MONITORAMENTO" = p_edital;
      else
        insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA", "CO_PERFIL_USUARIO")
        values (p_edital, btrim(b ->> 'nome'), btrim(b ->> 'origem'), coalesce(nullif(b ->> 'banca', '')::smallint, 1), nullif(b ->> 'perfil', '')::uuid);
      end if;
    end loop;
  end if;

  return public.obter_entrevistas_do_edital(p_edital);
end;
$function$;
comment on function public.configurar_entrevista_edital(uuid, jsonb) is
  'Grava a configuração da entrevista do edital: roteiro, composição da banca, modo de lançamento e membros da banca (23514 se trocar o roteiro com notas). A convocação e as vagas são as da Classificação: convocacao e vagas em p_dados são ignoradas. entrevistas >= editor e o edital.';

-- 4. Convocar: só quem está na lista de convocação vigente ---------------------------------------
drop function public.convocar_para_entrevista(uuid, uuid[]);

create function public.convocar_para_entrevista(p_edital uuid, p_lista uuid, p_analises uuid[])
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_roteiro uuid;
  v_vigente uuid;
  v_fora integer;
  v_qt integer;
begin
  select "CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  if v_roteiro is null then raise exception 'Configure a entrevista do edital antes de convocar' using errcode = '23514'; end if;
  if coalesce(cardinality(p_analises), 0) not between 1 and 2000 then raise exception 'Escolha de 1 a 2000 candidatos' using errcode = '22023'; end if;

  -- Uma convocação por vez no edital; a tela tem de estar na lista vigente.
  perform pg_advisory_xact_lock(hashtextextended('convocacao_entrevista:' || p_edital::text, 0));
  v_vigente := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
  if v_vigente is null then
    raise exception 'Gere a lista de convocação na Classificação antes de convocar' using errcode = '23514';
  end if;
  if p_lista is distinct from v_vigente then
    raise exception 'A lista de convocação mudou na Classificação; recarregue' using errcode = '40001';
  end if;
  select count(*) into v_fora
    from (select distinct x.analise from unnest(p_analises) x(analise)) s
   where s.analise is null
      or not exists (select 1 from private."FC_CONVOCADOS_DA_LISTA"(v_vigente) c(analise) where c.analise = s.analise);
  if v_fora > 0 then
    raise exception '% candidato(s) fora da lista de convocação vigente da Classificação', v_fora using errcode = '23514';
  end if;

  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  insert into public."TB_ENTREVISTA" as e ("CO_AREA", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "TP_LIGACAO_ANALISE",
    "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO", "DS_MODALIDADE", "NO_CARGO", "TP_PARECER",
    "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO")
  select v_area, p_edital, a.id, 'codigo', left(coalesce(v_m.unidade, ''), 200), left(v_m.edital, 120), left(a.codigo_vaga, 60),
         left(a.candidato, 200), left(a.id_origem, 60), left(a.modalidade_concorrencia, 300), left(a.nome_vaga, 400), 'SEM_PARECER',
         'sistema', 'sistema|' || p_edital || '|' || a.id, v_roteiro, 'S'
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = any (p_analises) and a."CO_AREA" = v_area
     and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
  on conflict ("DS_CHAVE_ORIGEM") do update set "ST_ATIVO" = 'S', "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DT_ATUALIZACAO" = now();
  get diagnostics v_qt = row_count;

  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
  select e."CO_ENTREVISTA", 'convocacao', 'convocado pela lista ' || v_vigente, (select auth.uid())
    from public."TB_ENTREVISTA" e where e."DS_CHAVE_ORIGEM" = any (select 'sistema|' || p_edital || '|' || x from unnest(p_analises) x);

  return json_build_object('convocados', v_qt, 'lista', v_vigente, 'dados', public.obter_entrevistas_do_edital(p_edital));
end;
$function$;
comment on function public.convocar_para_entrevista(uuid, uuid, uuid[]) is
  'Registra para a ficha de notas (TB_ENTREVISTA, TP_ORIGEM sistema) convocados da lista de convocação vigente da Classificação (p_lista = a última CONVOCACAO gerada, senão 40001); candidato fora da lista ou sem lista gerada = 23514; sem configuração = 23514. Idempotente; nada é apagado. entrevistas >= editor e o edital.';
revoke all on function public.convocar_para_entrevista(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.convocar_para_entrevista(uuid, uuid, uuid[]) to authenticated, service_role;

-- 5. O que ficou sem uso (sem apagar) ----------------------------------------------------------
comment on table public."TB_ENTREVISTA_VAGA" is
  'Vagas imediatas digitadas na entrevista até 20261005150000. Sem uso: as vagas vêm do quadro do edital e da configuração da convocação, as mesmas da Classificação. Fica para o histórico.';
comment on table public."TB_ENTREVISTA_EDITAL" is
  'Configuração da entrevista de um edital: roteiro (versão exata), banca e quem lança as notas. A convocação é a lista CONVOCACAO da Classificação.';
comment on column public."TB_ENTREVISTA_EDITAL"."DS_CONVOCACAO" is
  'Regra de convocação própria da entrevista até 20261005150000. Sem uso: vale a regra da Classificação (TB_REGRA_CLASSIFICACAO). Fica para o histórico.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_CONVOCACAO_PADRAO" is
  'Regra de convocação sugerida ao edital até 20261005150000. Sem uso: vale a regra da Classificação do edital. Fica para o histórico.';

commit;
