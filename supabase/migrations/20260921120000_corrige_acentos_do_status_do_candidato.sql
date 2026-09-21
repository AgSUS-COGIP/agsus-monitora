/*
  Corrige a acentuação dos status em `alterar_status_candidato_aprovado`.

  A função foi recriada à mão durante a padronização de nomenclatura MAD, para
  passar a apontar para `TB_CANDIDATO_APROVADO` e `TB_LISTA_APROVADO`. Nessa
  recriação o SQL passou por uma ferramenta que leu os bytes UTF-8 como Latin-1 e
  os gravou de novo como UTF-8 — o chamado mojibake. Os literais ficaram assim:

      'Migração'               virou  'MigraÃ§Ã£o'
      'Documentação Rejeitada' virou  'DocumentaÃ§Ã£o Rejeitada'

  Duas consequências, ambas em produção:

  1. Salvar um candidato como "Migração" ou "Documentação Rejeitada" falhava com
     "Status invalido", porque a comparação nunca casava. Só "Contratado" e
     "Desistente", que não têm acento, continuaram a funcionar.

  2. Mesmo que a primeira passasse, o `case` que decide guardar a matrícula
     também comparava contra o literal estragado — e apagaria a matrícula de
     quem ficasse em Migração.

  A constraint CHECK de `TB_CANDIDATO_APROVADO.status` está correta e sempre
  esteve; o problema era só a função. Nenhum dado precisou de ser corrigido: a
  própria função impedia que um valor estragado fosse gravado.

  Ao aplicar, confirme que o ficheiro chega ao Postgres em UTF-8. Foi essa etapa
  que falhou da primeira vez.
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
    'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada'
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
