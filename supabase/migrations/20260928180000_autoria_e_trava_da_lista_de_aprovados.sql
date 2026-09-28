/*
  AUTORIA DA LISTA DE APROVADOS E TRAVA DO STATUS DO CANDIDATO

  Duas mudanças pedidas juntas, porque respondem à mesma pergunta — quem mexeu
  na lista, e quem ainda pode mexer.

  Esta migration substitui a 20260928120000_autoria_e_trava_da_lista_de_aprovados
  da branch Lista-de-Aprovados, que nunca chegou à main. Aquela recriava as RPCs
  a partir dos corpos de 20260918160000/20260923140000 e, aplicada hoje, apagaria
  a permissão por módulo (20260923181135: `pode_recurso`/`papel_recurso`) e o
  recorte por área (20260925181000 e 20260925190000: `FC_AREAS_USUARIO` e
  `FC_EXIGIR_AREA_EDITAL`). Aqui os corpos de partida são os atuais, e a
  autoria e a trava entram por cima deles.

  1. QUEM IMPORTOU

  `TB_LISTA_APROVADO.importado_por` guarda o UUID de `auth.uid()`, e nada mais.
  Para saber quem é, era preciso cruzar com `auth.users` ou com
  `TB_PERFIL_USUARIO` — e a coluna não tem chave estrangeira: apagado o usuário,
  o UUID fica órfão e a autoria perde-se. Passa a gravar também o e-mail e o
  nome, copiados no instante da ação. É um retrato, não uma referência: se a
  pessoa mudar de nome ou sair da casa, o registro continua a dizer quem foi.

  O e-mail vem do JWT da sessão e, na falta dele, de `auth.users`. O nome vem
  de `TB_PERFIL_USUARIO`, casado por `user_id` e, na falta dele, pelo e-mail.
  Nenhum dos dois vem do navegador: a função não aceita parâmetro de autoria,
  e por isso ninguém consegue importar em nome de outro.

  O mesmo vale para quem substitui ou remove a lista (`substituido_por`), que
  é o outro momento em que a lista muda de mãos.

  As listas já importadas recebem, como autor da importação, a conta da Gestão
  da Informação de Pessoal (ver seção 3). A substituição/remoção já feita é
  preenchida a partir de `auth.users` e do perfil; a de usuários que já não
  existem fica vazia, porque não há de onde tirar o dado.

  2. A TRAVA

  O pedido: quem não é admin pode importar a lista e definir o status do
  candidato UMA vez; depois disso, só o admin altera.

  A importação já era assim desde 20260915150000 (`v_ja_teve_lista`): o
  não-admin importa a primeira lista do edital e mais nenhuma; substituir e
  remover são só do admin, e o Storage não tem policy de UPDATE nem de DELETE
  para os demais, de modo que o XLSX também não pode ser trocado por fora da
  RPC. Esta migration mantém a regra intacta.

  O status é que não tinha trava: o contratador podia alterá-lo quantas vezes
  quisesse. Passa a valer: se o candidato JÁ TEM status, só o admin muda —
  inclusive o processo SEI e a matrícula, que são gravados na mesma chamada.
  "Admin" aqui é o nível admin no módulo `aprovados` (`papel_recurso`), o
  mesmo papel que a RPC já usava para decidir quem altera status.

  A trava lê o status atual, e não o histórico, de propósito: o admin
  destrava um candidato voltando-o para "Sem status", e a partir daí o
  contratador volta a poder defini-lo. Travar pelo histórico deixaria o
  candidato preso ao admin para sempre, sem nada na tela a explicar porquê.

  NOMENCLATURA

  As colunas novas seguem a MAD (`DS_EMAIL_*` para e-mail, `NO_USUARIO_*` para
  nome de exibição, como em `reference.md` da skill `mad-ddl-review`). As
  colunas legadas da tabela continuam em minúsculas: renomeá-las quebraria as
  RPCs que as leem e não é o objeto desta migration.

  DEPENDENTES
    - src/lib/lista-aprovados-rules.js   (a mesma trava, para a tela)
    - src/modules/lista-aprovados.js     (o modal mostra quem importou)
    - src/modules/lista-convocacao.js    (o cadeado na convocação)

  ROLLBACK: supabase/rollback/20260928180000_autoria_e_trava_da_lista_de_aprovados.sql
*/
begin;

-- ---------------------------------------------------------------------------
-- 1. As colunas.
-- ---------------------------------------------------------------------------
alter table public."TB_LISTA_APROVADO"
  add column if not exists "DS_EMAIL_IMPORTACAO" varchar(320),
  add column if not exists "NO_USUARIO_IMPORTACAO" varchar(255),
  add column if not exists "DS_EMAIL_SUBSTITUICAO" varchar(320),
  add column if not exists "NO_USUARIO_SUBSTITUICAO" varchar(255);

comment on column public."TB_LISTA_APROVADO"."DS_EMAIL_IMPORTACAO" is
  'E-mail de quem importou a lista, copiado da sessao no momento da importacao. Complementa importado_por (UUID), que perde o sentido se o usuario for apagado.';
comment on column public."TB_LISTA_APROVADO"."NO_USUARIO_IMPORTACAO" is
  'Nome de quem importou a lista, copiado de TB_PERFIL_USUARIO no momento da importacao.';
comment on column public."TB_LISTA_APROVADO"."DS_EMAIL_SUBSTITUICAO" is
  'E-mail de quem substituiu ou removeu a lista, copiado da sessao no momento da acao. Complementa substituido_por (UUID).';
comment on column public."TB_LISTA_APROVADO"."NO_USUARIO_SUBSTITUICAO" is
  'Nome de quem substituiu ou removeu a lista, copiado de TB_PERFIL_USUARIO no momento da acao.';

-- ---------------------------------------------------------------------------
-- 2. Quem é o autor da chamada.
-- ---------------------------------------------------------------------------
/*
  Uma função só, para que importar e remover gravem exatamente a mesma coisa.
  O perfil é casado por `user_id` e, na falta dele, pelo e-mail — há perfis
  gravados antes de o `user_id` existir. Não se usa `private.current_profile()`
  porque ela filtra `ativo` e faz `limit 1` sem ordem: aqui a ordem é
  explícita, e um perfil inativo ainda tem nome a mostrar.
  `left()` porque o perfil guarda `text` sem limite e a coluna não.

  As variáveis de trabalho são `v_*` e não os próprios parâmetros de saída:
  `email` e `nome` também são colunas de `TB_PERFIL_USUARIO`, e o PL/pgSQL
  recusa a consulta por referência ambígua.
*/
create or replace function private.autor_da_sessao(
  out email text,
  out nome text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_nome text;
begin
  v_email := nullif(btrim(coalesce((select auth.jwt() ->> 'email'), '')), '');
  if v_email is null then
    select u.email into v_email from auth.users u where u.id = (select auth.uid());
  end if;

  select nullif(btrim(p.nome), '') into v_nome
  from public."TB_PERFIL_USUARIO" p
  where p.user_id = (select auth.uid())
     or (v_email is not null and lower(p.email) = lower(v_email))
  order by case when p.user_id = (select auth.uid()) then 0 else 1 end,
           p.updated_at desc nulls last
  limit 1;

  email := left(lower(v_email), 320);
  nome := left(coalesce(v_nome, lower(v_email)), 255);
end;
$$;

revoke all on function private.autor_da_sessao() from public, anon;

-- ---------------------------------------------------------------------------
-- 3. As listas que já existem.
-- ---------------------------------------------------------------------------
/*
  A importação das listas anteriores a esta migration é atribuída à conta da
  Gestão da Informação de Pessoal, a pedido da própria área (2026-09-28): foi
  ela quem conduziu a carga inicial. Não se tenta deduzir o autor por
  `auth.users`.

  `importado_por` NÃO é tocado. O UUID gravado pela RPC continua lá, e é ele
  a prova técnica de qual sessão importou; estas colunas são o rótulo de
  exibição. Se um dia for preciso auditar, o cruzamento com `auth.users`
  continua possível.

  `is null` limita o preenchimento às listas de antes desta migration: as
  importadas depois já nascem com a autoria da sessão, e uma nova execução do
  ficheiro não as sobrescreve.
*/
update public."TB_LISTA_APROVADO"
set "DS_EMAIL_IMPORTACAO" = 'dados.recursoshumanos@agenciasus.org.br',
    "NO_USUARIO_IMPORTACAO" = 'Gestão da Informação de Pessoal'
where "DS_EMAIL_IMPORTACAO" is null;

update public."TB_LISTA_APROVADO" l
set "DS_EMAIL_SUBSTITUICAO" = left(lower(u.email), 320),
    "NO_USUARIO_SUBSTITUICAO" = left(coalesce(
      (select nullif(btrim(p.nome), '')
         from public."TB_PERFIL_USUARIO" p
        where p.user_id = u.id or lower(p.email) = lower(u.email)
        order by case when p.user_id = u.id then 0 else 1 end,
                 p.updated_at desc nulls last
        limit 1),
      lower(u.email)
    ), 255)
from auth.users u
where u.id = l.substituido_por
  and l."DS_EMAIL_SUBSTITUICAO" is null;

-- ---------------------------------------------------------------------------
-- 4. A importação grava a autoria.
-- ---------------------------------------------------------------------------
/*
  O corpo é o de 20260925190000, com a autoria acrescentada nos dois pontos em
  que a lista muda de mãos: a lista antiga que sai e a nova que entra. As
  regras de quem pode importar e substituir não mudam.
*/
create or replace function public.importar_lista_aprovados(
  p_edital_id text,
  p_ativo boolean,
  p_arquivo_nome text,
  p_arquivo_path text,
  p_candidatos jsonb,
  p_substituir boolean default false
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
  v_ja_teve_lista boolean;
  v_total integer;
  v_edital text;
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

  select m.edital into v_edital from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = p_edital_id;
  if not found then raise exception 'Edital nao encontrado na Equipe Nucleo'; end if;

  select exists(select 1 from public."TB_LISTA_APROVADO" where edital_id = p_edital_id)
    into v_ja_teve_lista;
  select id into v_lista_atual
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
    "DS_EMAIL_IMPORTACAO", "NO_USUARIO_IMPORTACAO"
  ) values (
    p_edital_id, coalesce(p_ativo, true), true, btrim(p_arquivo_nome),
    btrim(p_arquivo_path), (select auth.uid()),
    v_autor.email, v_autor.nome
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

  return jsonb_build_object(
    'ok', true, 'lista_id', v_lista_id, 'edital_id', p_edital_id,
    'edital', v_edital, 'total', v_total, 'ativo', coalesce(p_ativo, true),
    'importado_por_email', v_autor.email, 'importado_por_nome', v_autor.nome
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. A remoção também.
-- ---------------------------------------------------------------------------
/*
  O corpo é o de 20260925190000, com a autoria de quem remove.
*/
create or replace function public.remover_lista_aprovados(p_lista_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_edital_id text;
  v_autor record;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_LISTA_APROVADO" l where l.id = p_lista_id));
  if not (private.pode_recurso('importacao',3)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('importacao') <> 'admin' then raise exception 'Somente admin pode remover lista de aprovados'; end if;
  select * into v_autor from private.autor_da_sessao();
  update public."TB_LISTA_APROVADO"
  set vigente = false, ativo = false, substituido_por = (select auth.uid()),
      substituido_em = now(), updated_at = now(),
      "DS_EMAIL_SUBSTITUICAO" = v_autor.email,
      "NO_USUARIO_SUBSTITUICAO" = v_autor.nome
  where id = p_lista_id and vigente is true
  returning edital_id into v_edital_id;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  return jsonb_build_object('ok', true, 'lista_id', p_lista_id, 'edital_id', v_edital_id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. A listagem devolve a autoria, para a tela a mostrar.
-- ---------------------------------------------------------------------------
/*
  `drop` e não `create or replace`: acrescentar coluna ao `returns table` muda
  o tipo de retorno, e o PostgreSQL recusa. O grant morre com a função e é
  refeito no fim.

  O corpo é o de 20260925181000 (permissão por módulo e recorte por área). A
  segunda checagem daquele corpo repetia a mesma condição da primeira e nunca
  disparava; ficou só a primeira.
*/
drop function if exists public.listar_listas_aprovados();

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
  importado_por_nome text
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
         l."DS_EMAIL_IMPORTACAO"::text, l."NO_USUARIO_IMPORTACAO"::text
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
  group by l.id, m.edital, m.unidade
  order by m.edital, m.unidade;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. A trava do status.
-- ---------------------------------------------------------------------------
/*
  O corpo é o de 20260925190000, com a trava depois de o candidato ser lido —
  é o status dele que decide. A mensagem diz o que fazer, porque é ela que o
  contratador vê no toast.
*/
create or replace function public.alterar_status_candidato_aprovado(
  p_candidato_id uuid,
  p_status text,
  p_processo_sei text default null,
  p_matricula text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_candidato public."TB_CANDIDATO_APROVADO"%rowtype;
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('contratador', 'admin') then
    raise exception 'Perfil sem permissao para alterar status';
  end if;

  if v_status is not null and v_status not in (
    'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada', 'Fim de Fila'
  ) then
    raise exception 'Status invalido';
  end if;

  if v_status in ('Contratado', 'Migração') and v_matricula is null then
    raise exception 'Matricula obrigatoria para Contratado ou Migracao';
  end if;

  select * into v_candidato
  from public."TB_CANDIDATO_APROVADO"
  where id = p_candidato_id and removido_em is null
  for update;
  if not found then raise exception 'Candidato nao encontrado'; end if;

  if v_role <> 'admin' and v_candidato.status is not null then
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

  insert into public."TH_CANDIDATO_APROVADO"(
    candidato_id, lista_id, status_anterior, status_novo,
    processo_sei, matricula, alterado_por
  ) values (
    v_candidato.id, v_candidato.lista_id, v_candidato.status, v_status,
    nullif(btrim(coalesce(p_processo_sei, '')), ''), v_matricula,
    (select auth.uid())
  );

  update public."TB_CANDIDATO_APROVADO"
  set status = v_status,
      processo_sei = nullif(btrim(coalesce(p_processo_sei, '')), ''),
      matricula = case
        when v_status in ('Contratado', 'Migração') then v_matricula
        else null
      end,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = v_candidato.id;

  return jsonb_build_object(
    'ok', true,
    'candidato_id', v_candidato.id,
    'status', v_status,
    'matricula', v_matricula
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Permissões de execução.
-- ---------------------------------------------------------------------------
revoke all on function public.listar_listas_aprovados() from public, anon;
grant execute on function public.listar_listas_aprovados() to authenticated;

notify pgrst, 'reload schema';

commit;
