/*
  Hora de nascimento na Classificação (desempate por "maior idade").

  O edital 93/2026 (e os que seguem o mesmo texto) desempata, por último, pela
  maior idade — e, entre quem nasceu no MESMO dia, pela hora da certidão de
  nascimento enviada na inscrição (6.11.5); sem certidão, vale 23h59min59s
  (6.11.6). Nem a planilha da análise curricular nem a Empregare trazem a
  hora: o analista a informa na Classificação, na explicação do candidato,
  só quando o empate chega à idade com a mesma data (o motor marca esses
  candidatos — horaDecide — e avisa HORA_DE_NASCIMENTO).

  1. TB_HORA_NASCIMENTO_CANDIDATO: a hora da certidão por análise curricular
     (sem linha = sem certidão = 23:59:59, regra do motor); TH_ com o
     histórico (a hora muda a ordem da lista: fica quem, quando, antes e depois).
  2. private."FC_DADOS_CLASSIFICACAO_EDITAL": cada candidato leva
     hora_nascimento ('HH24:MI:SS' ou null). O resto da função não muda.
  3. public.salvar_hora_nascimento_candidato(p_edital, p_analise, p_hora):
     grava, troca ou tira (p_hora vazio) a hora; Classificação editor, a área e
     o recorte do edital; a análise tem de ser do edital (área e número).

  Ensaio (begin … rollback) e rollback com o mesmo nome em supabase/ensaios/ e
  supabase/rollback/. Teste: tests/hora-de-nascimento-migration.test.js.
*/
begin;

-- 0. Pré-requisitos --------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text)') is null
     or to_regprocedure('private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(uuid, integer)') is null then
    raise exception 'Aplique antes 20261005130000_recurso_ajusta_pontuacao.sql.';
  end if;
  if to_regprocedure('private."FC_EH_TREINAMENTO"(text)') is null then
    raise exception 'Aplique antes 20261007230000_edital_de_treinamento.sql.';
  end if;
end;
$$;

-- 1. A hora da certidão e o histórico ----------------------------------------------------------
create table public."TB_HORA_NASCIMENTO_CANDIDATO" (
  "CO_ANALISE_CURRICULAR" uuid not null,
  "CO_MONITORAMENTO" uuid not null,
  "HR_NASCIMENTO" time(0) without time zone not null,
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_HORA_NASCIMENTO_CANDIDATO" primary key ("CO_ANALISE_CURRICULAR"),
  constraint "FK_ANALISE_HORANASCCANDIDATO" foreign key ("CO_ANALISE_CURRICULAR")
    references public."TB_ANALISE_CURRICULAR" (id) on delete cascade,
  constraint "FK_MONITORAMENTO_HORANASCCANDIDATO" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade
);
create index "IN_HORANASCCANDIDATO_MONITORAMENTO" on public."TB_HORA_NASCIMENTO_CANDIDATO" ("CO_MONITORAMENTO");
comment on table public."TB_HORA_NASCIMENTO_CANDIDATO" is
  'Hora de nascimento pela certidão (edital 93/2026, itens 6.11.5 e 6.11.6), informada na Classificação para o desempate por maior idade entre quem nasceu no mesmo dia. Sem linha = sem certidão: o motor usa 23:59:59.';
comment on column public."TB_HORA_NASCIMENTO_CANDIDATO"."CO_ANALISE_CURRICULAR" is 'Análise curricular do candidato (uma hora por análise).';
comment on column public."TB_HORA_NASCIMENTO_CANDIDATO"."CO_MONITORAMENTO" is 'Edital em que a hora foi informada.';
comment on column public."TB_HORA_NASCIMENTO_CANDIDATO"."HR_NASCIMENTO" is 'Hora de nascimento da certidão (HH:MM:SS, horário local do registro).';
comment on column public."TB_HORA_NASCIMENTO_CANDIDATO"."CO_USUARIO_ATUALIZACAO" is 'Quem informou por último (auth.users.id).';
comment on column public."TB_HORA_NASCIMENTO_CANDIDATO"."DT_ATUALIZACAO" is 'Quando foi informada por último.';
comment on constraint "FK_ANALISE_HORANASCCANDIDATO" on public."TB_HORA_NASCIMENTO_CANDIDATO" is 'Análise curricular do candidato.';
comment on constraint "FK_MONITORAMENTO_HORANASCCANDIDATO" on public."TB_HORA_NASCIMENTO_CANDIDATO" is 'Edital da classificação.';
comment on index public."IN_HORANASCCANDIDATO_MONITORAMENTO" is 'As horas de um edital (carga da Classificação).';

create table public."TH_HORA_NASCIMENTO_CANDIDATO" (
  "CO_HISTORICO_HORA_NASCIMENTO" uuid not null default gen_random_uuid(),
  "CO_ANALISE_CURRICULAR" uuid not null,
  "CO_MONITORAMENTO" uuid not null,
  "HR_ANTERIOR" time(0) without time zone,
  "HR_NOVA" time(0) without time zone,
  "CO_USUARIO" uuid,
  "DT_REGISTRO" timestamptz not null default clock_timestamp(),
  constraint "PK_TH_HORA_NASCIMENTO_CANDIDATO" primary key ("CO_HISTORICO_HORA_NASCIMENTO"),
  constraint "FK_ANALISE_HISTHORANASC" foreign key ("CO_ANALISE_CURRICULAR")
    references public."TB_ANALISE_CURRICULAR" (id) on delete cascade,
  constraint "FK_MONITORAMENTO_HISTHORANASC" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_HISTHORANASC_MUDOU" check ("HR_ANTERIOR" is distinct from "HR_NOVA")
);
create index "IN_HISTHORANASC_ANALISE" on public."TH_HORA_NASCIMENTO_CANDIDATO" ("CO_ANALISE_CURRICULAR", "DT_REGISTRO");
comment on table public."TH_HORA_NASCIMENTO_CANDIDATO" is
  'Histórico da hora de nascimento informada na Classificação: cada gravação, troca ou retirada (a hora muda a ordem do desempate).';
comment on column public."TH_HORA_NASCIMENTO_CANDIDATO"."CO_HISTORICO_HORA_NASCIMENTO" is 'Identificador do registro.';
comment on column public."TH_HORA_NASCIMENTO_CANDIDATO"."CO_ANALISE_CURRICULAR" is 'Análise curricular do candidato.';
comment on column public."TH_HORA_NASCIMENTO_CANDIDATO"."CO_MONITORAMENTO" is 'Edital.';
comment on column public."TH_HORA_NASCIMENTO_CANDIDATO"."HR_ANTERIOR" is 'Hora antes (nula: não havia).';
comment on column public."TH_HORA_NASCIMENTO_CANDIDATO"."HR_NOVA" is 'Hora depois (nula: retirada, volta a valer 23:59:59).';
comment on column public."TH_HORA_NASCIMENTO_CANDIDATO"."CO_USUARIO" is 'Quem mudou (auth.users.id).';
comment on column public."TH_HORA_NASCIMENTO_CANDIDATO"."DT_REGISTRO" is 'Quando mudou.';
comment on constraint "FK_ANALISE_HISTHORANASC" on public."TH_HORA_NASCIMENTO_CANDIDATO" is 'Análise curricular do candidato.';
comment on constraint "FK_MONITORAMENTO_HISTHORANASC" on public."TH_HORA_NASCIMENTO_CANDIDATO" is 'Edital.';
comment on constraint "CK_HISTHORANASC_MUDOU" on public."TH_HORA_NASCIMENTO_CANDIDATO" is 'Só registra mudança de verdade.';
comment on index public."IN_HISTHORANASC_ANALISE" is 'O histórico de uma análise, em ordem.';

alter table public."TB_HORA_NASCIMENTO_CANDIDATO" enable row level security;
alter table public."TH_HORA_NASCIMENTO_CANDIDATO" enable row level security;
revoke all on table public."TB_HORA_NASCIMENTO_CANDIDATO" from public, anon, authenticated;
revoke all on table public."TH_HORA_NASCIMENTO_CANDIDATO" from public, anon, authenticated;

-- 2. A carga da Classificação leva a hora (o resto da função não muda) -------------------------
create or replace function private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital uuid, p_area text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := p_area;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area, 'numero', v_numero,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('classificacao', 2),
    'regra', private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital),
    'catalogo', (
      select json_agg(json_build_object('codigo', k."CO_CRITERIO", 'nome', k."NO_CRITERIO", 'tipo', k."TP_VALOR",
               'direcao', k."TP_DIRECAO_PADRAO", 'ativo', k."ST_ATIVO" = 'S') order by k."NU_ORDEM")
        from public."TB_CRITERIO_CLASSIFICACAO" k),
    'cronograma', coalesce((
      select json_agg(json_build_object('ordem', c.ordem, 'atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
             order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    'quadro', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'candidatos', coalesce((
      with a as (
        select a.* from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
      ),
      vq as (
        select n.nome_vaga, private."FC_QUADRO_DA_VAGA"(p_edital, n.nome_vaga) as quadro
          from (select distinct a.nome_vaga from a) n
      )
      select json_agg(json_build_object(
               'analise_id', a.id, 'codigo', a.id_origem, 'nome', a.candidato, 'vaga', a.codigo_vaga,
               'cargo', a.nome_vaga, 'categoria', a.categoria, 'modalidade', a.modalidade_concorrencia, 'pcd', a.pcd,
               'data_nascimento', a.data_nascimento, 'nota_documental', a.nota_final_ajustada, 'nota_art', a.nota_empregare,
               'pontuacao_formacao', a.pontuacao_escolaridade, 'pontuacao_cursos', a.pontuacao_cursos_aperfeicoamento,
               'pontuacao_experiencia', a.pontuacao_experiencia_profissional, 'pontuacao_etnica', a.pontuacao_criterio_etnico,
               'exp_saude_indigena', a.experiencia_saude_indigena_total, 'exp_atencao_basica', a.experiencia_atencao_basica_total,
               'exp_profissional', a.experiencia_profissional_total, 'status', a.status_consolidado, 'etapa', a.etapa,
               'quadro', vq.quadro, 'hora_nascimento', to_char(h."HR_NASCIMENTO", 'HH24:MI:SS'))
             order by a.codigo_vaga, a.candidato)
        from a left join vq on vq.nome_vaga is not distinct from a.nome_vaga
               left join public."TB_HORA_NASCIMENTO_CANDIDATO" h on h."CO_ANALISE_CURRICULAR" = a.id), '[]'::json),
    'entrevistas', coalesce((
      select json_agg(json_build_object(
               'id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR", 'nome', e."NO_CANDIDATO",
               'vaga', e."CO_VAGA", 'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'compareceu', e."ST_COMPARECEU",
               'ligacao', e."TP_LIGACAO_ANALISE", 'origem', e."TP_ORIGEM",
               'notas', coalesce((select json_agg(json_build_object('ordem', n."NU_ORDEM", 'criterio', n."DS_CRITERIO", 'nota', n."VL_NOTA")
                                         order by n."NU_ORDEM")
                                    from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
       where e."ST_ATIVO" = 'S'
         and (e."CO_MONITORAMENTO" = p_edital
              or (e."CO_MONITORAMENTO" is null and e."CO_AREA" = v_area
                  and private."FC_NUMERO_EDITAL"(e."DS_EDITAL") = v_numero))), '[]'::json),
    'listas', coalesce((
      select json_agg(private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO") order by l."DT_GERACAO" desc)
        from (select l."CO_LISTA_CLASSIFICACAO", l."DT_GERACAO"
                from public."TB_LISTA_CLASSIFICACAO" l
               where l."CO_MONITORAMENTO" = p_edital
               order by l."DT_GERACAO" desc limit 60) l), '[]'::json),
    'desempates', coalesce((
      select json_agg(private."FC_DESEMPATE_CLASSIFICACAO_JSON"(d."CO_DESEMPATE_CLASSIFICACAO") order by d."DT_REGISTRO")
        from public."TB_DESEMPATE_CLASSIFICACAO" d
       where d."CO_MONITORAMENTO" = p_edital and d."ST_ATIVO" = 'S'), '[]'::json),
    'ajustes', coalesce((
      select json_agg(private."FC_AJUSTE_PONTUACAO_JSON"(j."CO_AJUSTE_PONTUACAO") order by j."DT_APROVACAO", j."CO_AJUSTE_PONTUACAO")
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital and j."TP_SITUACAO" = 'APROVADO'), '[]'::json),
    'ajustes_mudaram_em', (
      select greatest(max(j."DT_APROVACAO"), max(j."DT_CANCELAMENTO") filter (where j."DT_APROVACAO" is not null))
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital)
  );
end;
$function$;
comment on function private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text) is
  'O que o motor de classificação precisa de um edital (json), sem conferir permissão: regra e versões, catálogo, cronograma, quadro, análises (sem CPF, com a hora de nascimento da certidão quando informada), entrevistas, listas, desempates, os ajustes da pontuação aprovados em recurso e quando eles mudaram por último. Usada por obter_classificacao_do_edital e obter_dados_previa_ajuste.';
revoke all on function private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text) from public, anon, authenticated;

-- 3. Gravar, trocar ou tirar a hora -------------------------------------------------------------
create function public.salvar_hora_nascimento_candidato(p_edital uuid, p_analise uuid, p_hora text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_uid uuid := (select auth.uid());
  v_texto text := nullif(btrim(coalesce(p_hora, '')), '');
  v_hora time(0);
  v_anterior time(0);
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if not exists (
    select 1
      from public."TB_ANALISE_CURRICULAR" a
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = p_edital
     where a.id = p_analise and a.ativo and a."CO_AREA" = v_area
       and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)) then
    raise exception 'A análise não é deste edital' using errcode = '22023';
  end if;
  if v_texto is not null then
    if v_texto !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
      raise exception 'Hora inválida: use HH:MM ou HH:MM:SS (00:00 a 23:59:59)' using errcode = '22023';
    end if;
    v_hora := v_texto::time(0);
  end if;

  select h."HR_NASCIMENTO" into v_anterior
    from public."TB_HORA_NASCIMENTO_CANDIDATO" h
   where h."CO_ANALISE_CURRICULAR" = p_analise
   for update;

  if v_anterior is not distinct from v_hora then
    return json_build_object('analise_id', p_analise, 'hora_nascimento', to_char(v_hora, 'HH24:MI:SS'), 'mudou', false);
  end if;
  if v_hora is null then
    delete from public."TB_HORA_NASCIMENTO_CANDIDATO" where "CO_ANALISE_CURRICULAR" = p_analise;
  else
    insert into public."TB_HORA_NASCIMENTO_CANDIDATO"
      ("CO_ANALISE_CURRICULAR", "CO_MONITORAMENTO", "HR_NASCIMENTO", "CO_USUARIO_ATUALIZACAO", "DT_ATUALIZACAO")
    values (p_analise, p_edital, v_hora, v_uid, now())
    on conflict ("CO_ANALISE_CURRICULAR") do update
      set "CO_MONITORAMENTO" = excluded."CO_MONITORAMENTO", "HR_NASCIMENTO" = excluded."HR_NASCIMENTO",
          "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO", "DT_ATUALIZACAO" = excluded."DT_ATUALIZACAO";
  end if;
  insert into public."TH_HORA_NASCIMENTO_CANDIDATO"
    ("CO_ANALISE_CURRICULAR", "CO_MONITORAMENTO", "HR_ANTERIOR", "HR_NOVA", "CO_USUARIO")
  values (p_analise, p_edital, v_anterior, v_hora, v_uid);

  return json_build_object('analise_id', p_analise, 'hora_nascimento', to_char(v_hora, 'HH24:MI:SS'), 'mudou', true);
end;
$function$;
comment on function public.salvar_hora_nascimento_candidato(uuid, uuid, text) is
  'Grava, troca ou tira (p_hora vazio: volta a valer 23:59:59) a hora de nascimento da certidão de um candidato, para o desempate por maior idade (93/2026, 6.11.5 e 6.11.6). Classificação editor, a área e o recorte do edital (42501); a análise tem de ser do edital e a hora HH:MM[:SS] (22023). Histórico em TH_HORA_NASCIMENTO_CANDIDATO. Devolve {analise_id, hora_nascimento, mudou}.';
revoke all on function public.salvar_hora_nascimento_candidato(uuid, uuid, text) from public, anon;
grant execute on function public.salvar_hora_nascimento_candidato(uuid, uuid, text) to authenticated, service_role;

commit;
