/*
  SUB JUDICE: ALTERAR NOTA E/OU MODALIDADE DE CANDIDATO JÁ APROVADO

  Até aqui sub judice era só a inclusão de um candidato novo na lista vigente
  (incluir_sub_judice), sem modalidade e sem classificação. Decisão judicial
  também muda a nota (ex.: 33 → 40) ou a modalidade de quem já está na lista.
  Decisões de 01/10/2026 (responsável pelo sistema):
    - a classificação é refeita a cada mudança;
    - o número do processo judicial é opcional;
    - alterar nota/modalidade de quem já está na lista: só administrador do
      módulo (aprovados nível 3); incluir continua com editor (nível 2);
    - desfazer a alteração (a decisão caiu): só administrador.

  O QUE ENTRA
    TB_CANDIDATO_APROVADO ganha alterado_judicialmente e os valores do
      resultado publicado (nota_original, modalidade_original,
      classificacao_original, sub_judice_original), gravados na primeira
      alteração, para mostrar "33 → 40" e para desfazer. (Colunas em minúsculas,
      como as da tabela, anterior ao padrão MAD.)
    TH_CANDIDATO_SUB_JUDICE: cada inclusão, alteração, desfazer e remoção, com o
      antes e o depois, o processo, a observação, quem e quando.
    FC_RECOLOCAR_NA_CLASSIFICACAO: o candidato sai da posição dele e entra na
      da nota nova; a escala dele é renumerada (1, 2, 3…) e os demais mantêm a
      ordem que tinham entre si. Empate de nota: fica depois de quem tinha
      classificação original melhor; inclusão nova vai depois dos empatados.
    incluir_sub_judice ganha modalidade, processo e observação (opcionais),
      histórico e classificação.
    remover_sub_judice recusa candidato alterado (desfaz-se a alteração) e
      fecha o buraco na classificação.
    alterar_candidato_sub_judice e desfazer_alteracao_sub_judice (novas).
    A lista que a tela lê (pacote por área) leva os campos da alteração só nas
      linhas alteradas (as outras continuam com 12 posições).

  A ESCALA DA CLASSIFICAÇÃO
    É a da convocação (src/lib/lista-convocacao-rules.js): o cargo da lista,
    separado por código da vaga quando o cargo tem mais de uma (sem código, o
    candidato vai com a vaga única do cargo, ou fica com os outros sem código).
    Em muitos editais a planilha classifica POR modalidade (o 1º da ampla e o
    1º da cota chegam ambos como 1): quando a escala tem a mesma classificação
    em modalidades diferentes, cada modalidade é renumerada à parte, e quem
    troca de modalidade sai de uma e entra na outra. Renumerar tudo de 1 a N
    nesses editais apagaria a classificação por modalidade que a planilha trouxe.

  A convocação já ordena pela nota e lê a cota pela modalidade: nada muda nela.

  Rollback: supabase/rollback/20261001150000_sub_judice_alteracao.sql
*/
begin;

-- 1. Candidato: a alteração e os valores do resultado publicado --------------------
alter table public."TB_CANDIDATO_APROVADO"
  add column alterado_judicialmente boolean not null default false,
  add column nota_original numeric,
  add column modalidade_original text,
  add column classificacao_original integer,
  add column sub_judice_original boolean;
comment on column public."TB_CANDIDATO_APROVADO".alterado_judicialmente is 'Nota e/ou modalidade alteradas por decisão judicial (alterar_candidato_sub_judice).';
comment on column public."TB_CANDIDATO_APROVADO".nota_original is 'Nota do resultado publicado, gravada na primeira alteração judicial.';
comment on column public."TB_CANDIDATO_APROVADO".modalidade_original is 'Modalidade do resultado publicado, gravada na primeira alteração judicial.';
comment on column public."TB_CANDIDATO_APROVADO".classificacao_original is 'Classificação do resultado publicado, gravada na primeira alteração judicial (desempate e desfazer).';
comment on column public."TB_CANDIDATO_APROVADO".sub_judice_original is 'Se já era sub judice (inclusão) antes da primeira alteração; volta no desfazer.';

-- 2. Histórico ------------------------------------------------------------------------
create table public."TH_CANDIDATO_SUB_JUDICE" (
  "CO_HISTORICO" uuid not null default gen_random_uuid(),
  "CO_CANDIDATO" uuid not null,
  "CO_LISTA" uuid not null,
  "TP_EVENTO" text not null,
  "VL_NOTA_ANTERIOR" numeric,
  "VL_NOTA_NOVA" numeric,
  "DS_MODALIDADE_ANTERIOR" text,
  "DS_MODALIDADE_NOVA" text,
  "NU_CLASSIFICACAO_ANTERIOR" integer,
  "NU_CLASSIFICACAO_NOVA" integer,
  "NU_PROCESSO_JUDICIAL" text,
  "DS_OBSERVACAO" text,
  "CO_USUARIO" uuid,
  "DT_EVENTO" timestamptz not null default now(),
  constraint "PK_TH_CANDIDATO_SUB_JUDICE" primary key ("CO_HISTORICO"),
  constraint "FK_CANDAPROVADO_HISTSUBJUDICE" foreign key ("CO_CANDIDATO") references public."TB_CANDIDATO_APROVADO" (id),
  constraint "FK_LISTAAPROVADO_HISTSUBJUDICE" foreign key ("CO_LISTA") references public."TB_LISTA_APROVADO" (id),
  constraint "CK_HISTSUBJUDICE_TPEVENTO" check ("TP_EVENTO" in ('INCLUSAO', 'ALTERACAO', 'DESFAZER', 'REMOCAO')),
  constraint "CK_HISTSUBJUDICE_TAMANHOS" check (
    coalesce(length("NU_PROCESSO_JUDICIAL"), 0) <= 100 and coalesce(length("DS_OBSERVACAO"), 0) <= 1000
  )
);
comment on table public."TH_CANDIDATO_SUB_JUDICE" is 'Histórico do sub judice na lista de aprovados: inclusão, alteração de nota/modalidade por decisão judicial, desfazer e remoção.';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."CO_HISTORICO" is 'Identificador do evento.';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."CO_CANDIDATO" is 'Candidato (TB_CANDIDATO_APROVADO.id).';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."CO_LISTA" is 'Lista do candidato (TB_LISTA_APROVADO.id).';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."TP_EVENTO" is 'INCLUSAO, ALTERACAO, DESFAZER ou REMOCAO.';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."VL_NOTA_ANTERIOR" is 'Nota antes do evento.';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."VL_NOTA_NOVA" is 'Nota depois do evento.';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."DS_MODALIDADE_ANTERIOR" is 'Modalidade antes do evento.';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."DS_MODALIDADE_NOVA" is 'Modalidade depois do evento.';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."NU_CLASSIFICACAO_ANTERIOR" is 'Classificação antes do evento.';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."NU_CLASSIFICACAO_NOVA" is 'Classificação depois do evento (já renumerada).';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."NU_PROCESSO_JUDICIAL" is 'Número do processo judicial (opcional).';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."DS_OBSERVACAO" is 'Observação de quem registrou (opcional).';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."CO_USUARIO" is 'Quem registrou (auth.users.id).';
comment on column public."TH_CANDIDATO_SUB_JUDICE"."DT_EVENTO" is 'Quando.';
comment on constraint "FK_CANDAPROVADO_HISTSUBJUDICE" on public."TH_CANDIDATO_SUB_JUDICE" is 'Candidato do evento (CAND = CANDIDATO).';
comment on constraint "FK_LISTAAPROVADO_HISTSUBJUDICE" on public."TH_CANDIDATO_SUB_JUDICE" is 'Lista do candidato.';
comment on constraint "CK_HISTSUBJUDICE_TPEVENTO" on public."TH_CANDIDATO_SUB_JUDICE" is 'Eventos válidos.';
comment on constraint "CK_HISTSUBJUDICE_TAMANHOS" on public."TH_CANDIDATO_SUB_JUDICE" is 'Limites de tamanho dos textos.';
create index "IN_FKHISTSUBJUDICE_COCANDIDATO" on public."TH_CANDIDATO_SUB_JUDICE" ("CO_CANDIDATO");
comment on index public."IN_FKHISTSUBJUDICE_COCANDIDATO" is 'Chave estrangeira para TB_CANDIDATO_APROVADO.';
create index "IN_FKHISTSUBJUDICE_COLISTA" on public."TH_CANDIDATO_SUB_JUDICE" ("CO_LISTA");
comment on index public."IN_FKHISTSUBJUDICE_COLISTA" is 'Chave estrangeira para TB_LISTA_APROVADO.';
alter table public."TH_CANDIDATO_SUB_JUDICE" enable row level security;
revoke all on public."TH_CANDIDATO_SUB_JUDICE" from public, anon, authenticated;

-- 3. Recolocar na classificação ----------------------------------------------------
/*
  p_modalidade_anterior: a modalidade de antes da mudança (a atual, quando não
  mudou). Sem checagem de permissão: quem chama já checou e travou a lista.
  Devolve a posição nova (nulo se o candidato foi removido).
*/
create function private."FC_RECOLOCAR_NA_CLASSIFICACAO"(p_candidato uuid, p_modalidade_anterior text)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_CANDIDATO_APROVADO"%rowtype;
  v_vaga_unica text;
  v_vaga text;
  v_por_modalidade boolean;
  v_ref integer;
  v_posicao integer;
begin
  select * into v from public."TB_CANDIDATO_APROVADO" c where c.id = p_candidato;
  if v.id is null then return null; end if;
  v_ref := coalesce(v.classificacao_original, v.classificacao, 2147483647);

  -- A vaga, como a convocação resolve: o código, ou o único código do cargo.
  select min(btrim(c.codigo_vaga)) into v_vaga_unica
    from public."TB_CANDIDATO_APROVADO" c
   where c.lista_id = v.lista_id and c.cargo = v.cargo and c.removido_em is null
     and nullif(btrim(c.codigo_vaga), '') is not null
  having count(distinct btrim(c.codigo_vaga)) = 1;
  v_vaga := coalesce(nullif(btrim(v.codigo_vaga), ''), v_vaga_unica, '');

  -- Os outros da mesma vaga, na ordem de agora.
  create temporary table if not exists tmp_escala_da_classificacao (
    id uuid, modalidade text, classificacao integer, nota numeric, ref integer, nome text
  ) on commit drop;
  truncate pg_temp.tmp_escala_da_classificacao;
  insert into pg_temp.tmp_escala_da_classificacao
  select c.id, c.modalidade, c.classificacao, c.nota,
         coalesce(c.classificacao_original, c.classificacao, 2147483647), c.nome
    from public."TB_CANDIDATO_APROVADO" c
   where c.lista_id = v.lista_id and c.cargo = v.cargo and c.removido_em is null
     and c.id <> v.id
     and coalesce(nullif(btrim(c.codigo_vaga), ''), v_vaga_unica, '') = v_vaga;

  -- A planilha classificou por modalidade (mesmo número em modalidades diferentes)?
  select exists (
    select 1
      from pg_temp.tmp_escala_da_classificacao a
      join pg_temp.tmp_escala_da_classificacao b
        on a.classificacao = b.classificacao and a.id < b.id
       and a.modalidade is distinct from b.modalidade
  ) into v_por_modalidade;

  -- A escala do candidato: renumera e abre a posição da nota dele.
  with escala as (
    select e.id, e.nota, e.ref,
           (row_number() over (order by e.classificacao nulls last, e.nome, e.id))::integer as posicao
      from pg_temp.tmp_escala_da_classificacao e
     where not v_por_modalidade or e.modalidade is not distinct from v.modalidade
  )
  select case when v.removido_em is not null then null
              else coalesce(min(x.posicao) filter (where x.nota < v.nota or (x.nota = v.nota and x.ref > v_ref)),
                            count(*) + 1)::integer end
    into v_posicao
    from escala x;

  with escala as (
    select e.id,
           (row_number() over (order by e.classificacao nulls last, e.nome, e.id))::integer as posicao
      from pg_temp.tmp_escala_da_classificacao e
     where not v_por_modalidade or e.modalidade is not distinct from v.modalidade
  ), nova as (
    select x.id, case when v_posicao is not null and x.posicao >= v_posicao then x.posicao + 1 else x.posicao end as posicao
      from escala x
  )
  update public."TB_CANDIDATO_APROVADO" c set classificacao = n.posicao
    from nova n
   where c.id = n.id and c.classificacao is distinct from n.posicao;

  if v_posicao is not null then
    update public."TB_CANDIDATO_APROVADO" c set classificacao = v_posicao
     where c.id = v.id and c.classificacao is distinct from v_posicao;
  end if;

  -- Trocou de modalidade numa escala por modalidade: fecha o buraco na de antes.
  if v_por_modalidade and p_modalidade_anterior is distinct from v.modalidade then
    with escala as (
      select e.id,
             (row_number() over (order by e.classificacao nulls last, e.nome, e.id))::integer as posicao
        from pg_temp.tmp_escala_da_classificacao e
       where e.modalidade is not distinct from p_modalidade_anterior
    )
    update public."TB_CANDIDATO_APROVADO" c set classificacao = x.posicao
      from escala x
     where c.id = x.id and c.classificacao is distinct from x.posicao;
  end if;

  return v_posicao;
end;
$function$;
comment on function private."FC_RECOLOCAR_NA_CLASSIFICACAO"(uuid, text) is
  'Põe o candidato na posição da nota atual dentro da escala dele (cargo e vaga da lista; por modalidade quando a planilha classificou assim) e renumera a escala, mantendo a ordem dos outros; removido só fecha o buraco. Sem checagem: quem chama checa.';
revoke all on function private."FC_RECOLOCAR_NA_CLASSIFICACAO"(uuid, text) from public, anon, authenticated;

-- 4. Incluir sub judice (com modalidade, processo e observação) ---------------------
drop function public.incluir_sub_judice(text, text, text, numeric);
create function public.incluir_sub_judice(
  p_edital_id text, p_cargo text, p_nome text, p_nota numeric,
  p_modalidade text default null, p_processo text default null, p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_candidato_id uuid;
  v_modalidade text := nullif(btrim(coalesce(p_modalidade, '')), '');
  v_posicao integer;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id);
  if not (private.pode_recurso('aprovados', 2)) then raise exception 'Sem permissão para este recurso' using errcode = '42501'; end if;
  if nullif(btrim(coalesce(p_cargo, '')), '') is null then raise exception 'Cargo obrigatorio'; end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null then raise exception 'Nome obrigatorio'; end if;
  if p_nota is null or p_nota < 0 then raise exception 'Nota invalida'; end if;
  if length(coalesce(p_processo, '')) > 100 or length(coalesce(p_observacao, '')) > 1000 then
    raise exception 'Processo (até 100) ou observação (até 1000 caracteres) longos demais' using errcode = '22023';
  end if;

  select * into v_lista from public."TB_LISTA_APROVADO"
   where edital_id = p_edital_id and vigente is true for update;
  if not found then raise exception 'O edital ainda nao possui lista vigente'; end if;
  if not v_lista.ativo then raise exception 'A lista esta inativa e nao permite incluir sub judice'; end if;

  if not exists (
    select 1 from public."TB_CANDIDATO_APROVADO"
     where lista_id = v_lista.id and removido_em is null and cargo = btrim(p_cargo)
  ) then
    raise exception 'Cargo nao pertence a lista vigente deste edital';
  end if;

  insert into public."TB_CANDIDATO_APROVADO" (
    lista_id, cargo, nota, nome, modalidade, sub_judice, created_by, updated_by
  ) values (
    v_lista.id, btrim(p_cargo), p_nota, btrim(p_nome), v_modalidade, true,
    (select auth.uid()), (select auth.uid())
  ) returning id into v_candidato_id;

  v_posicao := private."FC_RECOLOCAR_NA_CLASSIFICACAO"(v_candidato_id, v_modalidade);

  insert into public."TH_CANDIDATO_SUB_JUDICE" (
    "CO_CANDIDATO", "CO_LISTA", "TP_EVENTO", "VL_NOTA_NOVA", "DS_MODALIDADE_NOVA",
    "NU_CLASSIFICACAO_NOVA", "NU_PROCESSO_JUDICIAL", "DS_OBSERVACAO", "CO_USUARIO"
  ) values (
    v_candidato_id, v_lista.id, 'INCLUSAO', p_nota, v_modalidade, v_posicao,
    nullif(btrim(coalesce(p_processo, '')), ''), nullif(btrim(coalesce(p_observacao, '')), ''),
    (select auth.uid())
  );

  return jsonb_build_object('ok', true, 'candidato_id', v_candidato_id, 'lista_id', v_lista.id,
                            'sub_judice', true, 'classificacao', v_posicao);
end;
$function$;
comment on function public.incluir_sub_judice(text, text, text, numeric, text, text, text) is
  'Inclui candidato sub judice na lista vigente e ativa do edital (cargo já existente), com modalidade, processo e observação opcionais; entra na classificação pela nota e fica no histórico. aprovados >= editor e a área do edital.';
revoke all on function public.incluir_sub_judice(text, text, text, numeric, text, text, text) from public, anon;
grant execute on function public.incluir_sub_judice(text, text, text, numeric, text, text, text) to authenticated;

-- 5. Remover sub judice (só inclusão; alteração se desfaz) --------------------------
create or replace function public.remover_sub_judice(p_candidato_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_CANDIDATO_APROVADO"%rowtype;
  v_ativo boolean;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados', 2)) then raise exception 'Sem permissão para este recurso' using errcode = '42501'; end if;

  select c.* into v
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
   where c.id = p_candidato_id and c.sub_judice is true and c.removido_em is null
     for update of c, l;
  if not found then raise exception 'Candidato sub judice vigente nao encontrado'; end if;
  select l.ativo into v_ativo from public."TB_LISTA_APROVADO" l where l.id = v.lista_id;
  if not v_ativo then raise exception 'A lista esta inativa e nao permite remover sub judice'; end if;
  if v.alterado_judicialmente then
    raise exception 'Candidato com nota ou modalidade alterada por decisao judicial: use Desfazer alteracao' using errcode = '22023';
  end if;

  update public."TB_CANDIDATO_APROVADO"
     set removido_em = now(), removido_por = (select auth.uid()),
         updated_by = (select auth.uid()), updated_at = now()
   where id = p_candidato_id;
  perform private."FC_RECOLOCAR_NA_CLASSIFICACAO"(p_candidato_id, v.modalidade);

  insert into public."TH_CANDIDATO_SUB_JUDICE" (
    "CO_CANDIDATO", "CO_LISTA", "TP_EVENTO", "VL_NOTA_ANTERIOR", "DS_MODALIDADE_ANTERIOR",
    "NU_CLASSIFICACAO_ANTERIOR", "CO_USUARIO"
  ) values (
    p_candidato_id, v.lista_id, 'REMOCAO', v.nota, v.modalidade, v.classificacao, (select auth.uid())
  );

  return jsonb_build_object('ok', true, 'candidato_id', p_candidato_id, 'lista_id', v.lista_id);
end;
$function$;

-- 6. Alterar nota e/ou modalidade por decisão judicial (só administrador) -----------
create function public.alterar_candidato_sub_judice(
  p_candidato_id uuid,
  p_nota numeric default null,
  p_modalidade text default null,
  p_processo text default null,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_CANDIDATO_APROVADO"%rowtype;
  v_ativo boolean;
  v_nota numeric;
  v_modalidade text;
  v_posicao integer;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados', 3)) then
    raise exception 'Só o administrador da lista de aprovados altera nota ou modalidade por decisão judicial' using errcode = '42501';
  end if;
  if p_nota is not null and p_nota < 0 then raise exception 'Nota invalida' using errcode = '22023'; end if;
  if length(coalesce(p_processo, '')) > 100 or length(coalesce(p_observacao, '')) > 1000 then
    raise exception 'Processo (até 100) ou observação (até 1000 caracteres) longos demais' using errcode = '22023';
  end if;

  select c.* into v
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
   where c.id = p_candidato_id and c.removido_em is null
     for update of c, l;
  if not found then raise exception 'Candidato da lista vigente nao encontrado'; end if;
  select l.ativo into v_ativo from public."TB_LISTA_APROVADO" l where l.id = v.lista_id;
  if not v_ativo then raise exception 'A lista esta inativa e nao permite alterar candidato'; end if;

  v_nota := coalesce(p_nota, v.nota);
  v_modalidade := coalesce(nullif(btrim(coalesce(p_modalidade, '')), ''), v.modalidade);
  if v_nota = v.nota and v_modalidade is not distinct from v.modalidade then
    raise exception 'Nada mudou: informe uma nota ou modalidade diferente da atual' using errcode = '22023';
  end if;

  update public."TB_CANDIDATO_APROVADO" c set
    nota_original = case when c.alterado_judicialmente then c.nota_original else c.nota end,
    modalidade_original = case when c.alterado_judicialmente then c.modalidade_original else c.modalidade end,
    classificacao_original = case when c.alterado_judicialmente then c.classificacao_original else c.classificacao end,
    sub_judice_original = case when c.alterado_judicialmente then c.sub_judice_original else c.sub_judice end,
    nota = v_nota,
    modalidade = v_modalidade,
    sub_judice = true,
    alterado_judicialmente = true,
    updated_by = (select auth.uid()),
    updated_at = now()
   where c.id = p_candidato_id;

  v_posicao := private."FC_RECOLOCAR_NA_CLASSIFICACAO"(p_candidato_id, v.modalidade);

  insert into public."TH_CANDIDATO_SUB_JUDICE" (
    "CO_CANDIDATO", "CO_LISTA", "TP_EVENTO", "VL_NOTA_ANTERIOR", "VL_NOTA_NOVA",
    "DS_MODALIDADE_ANTERIOR", "DS_MODALIDADE_NOVA", "NU_CLASSIFICACAO_ANTERIOR", "NU_CLASSIFICACAO_NOVA",
    "NU_PROCESSO_JUDICIAL", "DS_OBSERVACAO", "CO_USUARIO"
  ) values (
    p_candidato_id, v.lista_id, 'ALTERACAO', v.nota, v_nota, v.modalidade, v_modalidade,
    v.classificacao, v_posicao,
    nullif(btrim(coalesce(p_processo, '')), ''), nullif(btrim(coalesce(p_observacao, '')), ''),
    (select auth.uid())
  );

  return jsonb_build_object('ok', true, 'candidato_id', p_candidato_id, 'lista_id', v.lista_id,
                            'nota', v_nota, 'modalidade', v_modalidade, 'classificacao', v_posicao);
end;
$function$;
comment on function public.alterar_candidato_sub_judice(uuid, numeric, text, text, text) is
  'Altera nota e/ou modalidade de candidato da lista vigente e ativa por decisão judicial: guarda os valores do resultado publicado na primeira vez, marca sub judice, recoloca na classificação e grava o histórico. Só aprovados = administrador e a área do edital.';
revoke all on function public.alterar_candidato_sub_judice(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.alterar_candidato_sub_judice(uuid, numeric, text, text, text) to authenticated;

-- 7. Desfazer a alteração (a decisão caiu; só administrador) ------------------------
create function public.desfazer_alteracao_sub_judice(p_candidato_id uuid, p_observacao text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v public."TB_CANDIDATO_APROVADO"%rowtype;
  v_ativo boolean;
  v_posicao integer;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados', 3)) then
    raise exception 'Só o administrador da lista de aprovados desfaz a alteração judicial' using errcode = '42501';
  end if;
  if length(coalesce(p_observacao, '')) > 1000 then
    raise exception 'Observação com mais de 1000 caracteres' using errcode = '22023';
  end if;

  select c.* into v
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
   where c.id = p_candidato_id and c.removido_em is null and c.alterado_judicialmente is true
     for update of c, l;
  if not found then raise exception 'Candidato com alteração judicial nao encontrado'; end if;
  select l.ativo into v_ativo from public."TB_LISTA_APROVADO" l where l.id = v.lista_id;
  if not v_ativo then raise exception 'A lista esta inativa e nao permite alterar candidato'; end if;

  -- Volta à nota, modalidade e posição do resultado publicado; depois recoloca.
  update public."TB_CANDIDATO_APROVADO" c set
    nota = c.nota_original,
    modalidade = c.modalidade_original,
    classificacao = coalesce(c.classificacao_original, c.classificacao),
    sub_judice = coalesce(c.sub_judice_original, false),
    alterado_judicialmente = false,
    updated_by = (select auth.uid()),
    updated_at = now()
   where c.id = p_candidato_id;

  v_posicao := private."FC_RECOLOCAR_NA_CLASSIFICACAO"(p_candidato_id, v.modalidade);

  update public."TB_CANDIDATO_APROVADO" c set
    nota_original = null, modalidade_original = null,
    classificacao_original = null, sub_judice_original = null
   where c.id = p_candidato_id;

  insert into public."TH_CANDIDATO_SUB_JUDICE" (
    "CO_CANDIDATO", "CO_LISTA", "TP_EVENTO", "VL_NOTA_ANTERIOR", "VL_NOTA_NOVA",
    "DS_MODALIDADE_ANTERIOR", "DS_MODALIDADE_NOVA", "NU_CLASSIFICACAO_ANTERIOR", "NU_CLASSIFICACAO_NOVA",
    "DS_OBSERVACAO", "CO_USUARIO"
  ) values (
    p_candidato_id, v.lista_id, 'DESFAZER', v.nota, v.nota_original, v.modalidade, v.modalidade_original,
    v.classificacao, v_posicao, nullif(btrim(coalesce(p_observacao, '')), ''), (select auth.uid())
  );

  return jsonb_build_object('ok', true, 'candidato_id', p_candidato_id, 'lista_id', v.lista_id,
                            'nota', v.nota_original, 'modalidade', v.modalidade_original, 'classificacao', v_posicao);
end;
$function$;
comment on function public.desfazer_alteracao_sub_judice(uuid, text) is
  'Desfaz a alteração judicial: volta à nota, modalidade e classificação do resultado publicado, recoloca na classificação e grava o histórico. Só aprovados = administrador e a área do edital.';
revoke all on function public.desfazer_alteracao_sub_judice(uuid, text) from public, anon;
grant execute on function public.desfazer_alteracao_sub_judice(uuid, text) to authenticated;

-- 8. O pacote da área leva a alteração (só nas linhas alteradas) --------------------
/*
  A linha alterada ganha 4 posições no fim: alterado_judicialmente,
  nota_original, modalidade_original (texto; são poucas) e
  classificacao_original. As outras seguem com 12 posições, e o expansor do
  front (src/lib/candidatos-aprovados-compactos.js) lê a posição que falta como
  nulo: nada a mais nos ~36 mil candidatos que não foram alterados.
*/
create or replace function private."FC_MONTAR_APROVADOS_AREA"(
  p_area text,
  p_editais uuid[],
  out p_listas json,
  out p_dicionarios json,
  out p_linhas json,
  out p_total integer
)
 language plpgsql
 stable
 set search_path to ''
 set work_mem to '64MB'
 set jit to 'off'
as $function$
begin
  with listas as (
    select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em,
           (row_number() over (order by m.edital, l.id) - 1)::integer as i
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente is true
       and m."CO_AREA" = p_area
       and (p_editais is null or m.id = any (p_editais))
  ), cand as materialized (
    select c.id, li.i as lista, li.edital, c.cargo, c.classificacao, c.nota, c.nome,
           c.modalidade, c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga,
           c.alterado_judicialmente, c.nota_original, c.modalidade_original, c.classificacao_original
      from listas li
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = li.id
     where c.removido_em is null
  ), d_cargo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct cargo as v from cand where cargo is not null) x
  ), d_modalidade as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct modalidade as v from cand where modalidade is not null) x
  ), d_status as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct status as v from cand where status is not null) x
  ), d_codigo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct codigo_vaga as v from cand where codigo_vaga is not null) x
  )
  select
    (select coalesce(json_agg(json_build_array(
              li.id, li.edital_id, li.edital, li.unidade, li.ativo, li.arquivo_nome, li.importado_em
            ) order by li.i), '[]'::json)
       from listas li),
    json_build_object(
      'cargo', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_cargo d),
      'modalidade', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_modalidade d),
      'status', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_status d),
      'codigo_vaga', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_codigo d)
    ),
    -- A ordem da função antiga; o id só desempata (antes o empate saía em qualquer ordem).
    (select coalesce(json_agg(
              case when c.alterado_judicialmente then json_build_array(
                c.id, c.lista, dc.i, c.classificacao, c.nota, c.nome, dm.i,
                ds.i, c.processo_sei, c.matricula, c.sub_judice, dv.i,
                true, c.nota_original, c.modalidade_original, c.classificacao_original
              ) else json_build_array(
                c.id, c.lista, dc.i, c.classificacao, c.nota, c.nome, dm.i,
                ds.i, c.processo_sei, c.matricula, c.sub_judice, dv.i
              ) end
            order by c.edital, c.cargo, c.classificacao nulls last, c.nome, c.id), '[]'::json)
       from cand c
       left join d_cargo dc on dc.v = c.cargo
       left join d_modalidade dm on dm.v = c.modalidade
       left join d_status ds on ds.v = c.status
       left join d_codigo dv on dv.v = c.codigo_vaga)
  into p_listas, p_dicionarios, p_linhas;

  p_total := json_array_length(p_linhas);
end;
$function$;

create or replace function public.listar_candidatos_aprovados_compacto(
  p_area text default null,
  p_versao text default null
)
returns json
language plpgsql
security definer
set search_path to ''
set work_mem to '64MB'
set jit to 'off'
as $function$
declare
  v_listas json;
  v_linhas json;
  v_area text;
  v_visiveis uuid[];
  v_versao text;
  v_cache private."TA_CANDIDATO_APROVADO_AREA";
  v_tem_cache boolean := false;
  v_dicionarios json;
  v_total integer;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('aprovados') = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;

  -- Sem área: a resposta de antes (formato 1), para o front publicado até o deploy.
  if p_area is null then
    -- Dados da lista vão uma vez por lista (≈110), não repetidos em cada candidato.
    select coalesce(json_object_agg(l.id, json_build_array(
             l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em
           )), '{}'::json)
      into v_listas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

    select coalesce(json_agg(
             case when c.alterado_judicialmente then json_build_array(
               c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
               c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga,
               true, c.nota_original, c.modalidade_original, c.classificacao_original
             ) else json_build_array(
               c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
               c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
             ) end
           order by m.edital, c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
      into v_linhas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      and c.removido_em is null;

    return json_build_object(
      'colunas_da_lista', json_build_array(
        'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
      ),
      'listas', v_listas,
      'colunas', json_build_array(
        'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
        'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
        'codigo_vaga', 'alterado_judicialmente', 'nota_original',
        'modalidade_original', 'classificacao_original'
      ),
      'linhas', v_linhas,
      'total', json_array_length(v_linhas)
    );
  end if;

  -- Área válida e do usuário: 22023/42501 antes de qualquer leitura.
  v_area := lower(btrim(p_area));
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para a lista de aprovados desta área' using errcode = '42501';
  end if;

  -- Recorte por coordenação: entra na versão (mudou o recorte, a cópia não vale).
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  v_versao := private."FC_VERSAO_APROVADOS_AREA"(v_area)
    || case when v_visiveis is null then ''
            else ':' || md5(array(select x from unnest(v_visiveis) x order by x)::text) end;

  if p_versao is not null and p_versao = v_versao then
    return json_build_object('formato', 2, 'area', v_area, 'versao', v_versao, 'inalterado', true);
  end if;

  if v_visiveis is null then
    select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
    v_tem_cache := found and v_cache."DS_VERSAO_DADOS" = v_versao;
    if not v_tem_cache
       and pg_try_advisory_xact_lock(hashtext('aprovados_area:' || v_area)::bigint) then
      -- Venceu: remonta e grava. Falhou a gravação (transação só de leitura,
      -- trava), monta na hora abaixo.
      perform public.atualizar_cache_aprovados(v_area);
      select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
      v_tem_cache := found and v_cache."DS_VERSAO_DADOS" = v_versao;
    end if;
  end if;

  if v_tem_cache then
    v_listas := v_cache."DS_LISTAS";
    v_dicionarios := v_cache."DS_DICIONARIOS";
    v_linhas := v_cache."DS_LINHAS";
    v_total := v_cache."QT_CANDIDATOS";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    -- Com recorte, ou pronto ainda sem a versão de agora: montada na hora.
    select m.p_listas, m.p_dicionarios, m.p_linhas, m.p_total
      into v_listas, v_dicionarios, v_linhas, v_total
      from private."FC_MONTAR_APROVADOS_AREA"(v_area, v_visiveis) m;
  end if;

  return json_build_object(
    'formato', 2,
    'area', v_area,
    'versao', v_versao,
    'inalterado', false,
    'cache', json_build_object('hit', v_tem_cache, 'gerado_em', v_gerado_em),
    'colunas_da_lista', json_build_array(
      'lista_id', 'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
    ),
    'listas', v_listas,
    'colunas', json_build_array(
      'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
      'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
      'codigo_vaga', 'alterado_judicialmente', 'nota_original',
      'modalidade_original', 'classificacao_original'
    ),
    'dicionarios', v_dicionarios,
    'linhas', v_linhas,
    'total', v_total
  );
end;
$function$;

commit;

-- O pacote pronto de cada área é remontado (fora da transação: erro numa área vira aviso).
select public.atualizar_cache_aprovados();
