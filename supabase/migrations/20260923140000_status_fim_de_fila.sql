/*
  STATUS "FIM DE FILA" NA LISTA DE APROVADOS

  Falta um estado ao candidato: o de quem, convocado, pede para ir para o fim da
  lista em vez de desistir. Guarda o direito, perde a posição.

  O instituto está no edital da FCC (125), item 13.7: "O candidato poderá,
  dentro do prazo de 03 (três) dias corridos, apresentar requerimento, por
  escrito, solicitando posicionamento no final da lista dos classificados, uma
  única vez." Dos dezasseis editais da AgSUS lidos até aqui, é o único que o
  escreve — mas a prática existe em todos, e sem este status a equipa só tinha
  "Desistente", que diz outra coisa: quem foi para o fim da fila continua na
  lista e pode ser chamado.

  O "uma única vez" do edital não é regra de banco: é limite de processo, e
  quem o controla é quem defere o requerimento. O sistema regista o estado.

  O QUE ELE FAZ NA CONVOCAÇÃO

  Nada aqui — o efeito é calculado no navegador, por
  `ordenarPorClassificacao`: o candidato continua na fila, e todas as filas em
  que ele está, mas ordenado depois de todos os outros. É o que "fim da lista"
  quer dizer, e cai numa comparação só porque as filas de cota são recortes da
  mesma ordem geral.

  Não é campo do modelo de convocação. Ao contrário de percentual, cascata ou
  arredondamento, este efeito não varia entre os editais lidos: "final da lista"
  significa a mesma coisa em todos. Se algum dia um edital disser outra coisa —
  fim da fila só da própria cota, por exemplo —, aí passa a ser configuração.

  A MATRÍCULA

  Continua exigida só em Contratado e Migração. Quem vai para o fim da fila não
  foi contratado, e a função apaga a matrícula como já fazia para Desistente.

  NOMENCLATURA

  A constraint é recriada com o nome do padrão MAD (`CK_[TABELA]_[COLUNA]`), que
  a antiga não seguia — nasceu antes da padronização de 2026-09-18, e o RENAME
  da tabela levou o nome velho consigo. Recriar é a oportunidade de a corrigir
  sem custo.

  DEPENDENTES
    - src/lib/lista-convocacao-rules.js  (a ordenação)
    - src/lib/lista-aprovados-rules.js   (o resumo)
    - index.html                         (os três seletores de status)

  ROLLBACK
    begin;
    -- Antes, apagar ou trocar o status de quem estiver em "Fim de Fila":
    -- a constraint antiga recusa o valor e o ALTER falha.
    update public."TB_CANDIDATO_APROVADO" set status = null
     where status = 'Fim de Fila';
    alter table public."TB_CANDIDATO_APROVADO"
      drop constraint if exists "CK_CANDIDATO_APROVADO_STATUS";
    alter table public."TB_CANDIDATO_APROVADO"
      add constraint lista_aprovados_status_check
      check (status is null or status in ('Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada'));
    commit;
    -- E recriar `alterar_status_candidato_aprovado` sem 'Fim de Fila', como em
    -- 20260921120000_corrige_acentos_do_status_do_candidato.sql.
*/
begin;

-- ---------------------------------------------------------------------------
-- 1. O domínio do status aceita o estado novo.
-- ---------------------------------------------------------------------------
alter table public."TB_CANDIDATO_APROVADO"
  drop constraint if exists lista_aprovados_status_check;
alter table public."TB_CANDIDATO_APROVADO"
  drop constraint if exists "CK_CANDIDATO_APROVADO_STATUS";
alter table public."TB_CANDIDATO_APROVADO"
  add constraint "CK_CANDIDATO_APROVADO_STATUS" check (
    status is null
    or status in (
      'Contratado',
      'Desistente',
      'Migração',
      'Documentação Rejeitada',
      'Fim de Fila'
    )
  );

comment on column public."TB_CANDIDATO_APROVADO".status is
  'Situacao do candidato. Fim de Fila: pediu posicionamento no final da lista (edital FCC 125, item 13.7) - continua convocavel, mas depois de todos os outros.';

-- ---------------------------------------------------------------------------
-- 2. A função de alteração passa a aceitá-lo.
-- ---------------------------------------------------------------------------
/*
  A lista de status válidos está em dois sítios — a constraint e esta função —
  e tem de andar junta. A função vem primeiro na ordem de quem escreve: é ela
  que devolve "Status invalido" com mensagem legível, enquanto a constraint é a
  última linha de defesa para quem chegue por outro caminho.

  O corpo é o de 20260921120000, com o status novo acrescentado. Reproduzi-lo
  inteiro é o preço de `create or replace` não saber aplicar remendos.
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
  v_role text := private.monitora_role();
  v_candidato public."TB_CANDIDATO_APROVADO"%rowtype;
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
begin
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

commit;
