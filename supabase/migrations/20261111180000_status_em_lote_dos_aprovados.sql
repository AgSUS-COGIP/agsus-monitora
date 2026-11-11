/*
  LISTA DE APROVADOS: STATUS EM LOTE

  Pedido de 11/11/2026: escolher várias pessoas (ou todas as filtradas) na aba
  Aprovados e mudar o status de uma vez. Hoje o status muda um candidato por vez
  (alterar_status_candidato_aprovado); em lote só existia marcar Convocado depois da
  carta (marcar_candidatos_convocados).

  public.alterar_status_candidatos_aprovados(candidatos, status, data_convocacao):
    - status: Convocado (com a data; sem data, hoje), Desistente, Documentação
      Rejeitada ou sem status (só o admin de Aprovados). Contratado e Migração ficam
      de fora: pedem a matrícula de cada um.
    - até 500 candidatos; área e recorte de todos os editais conferidos antes de mudar
      qualquer um (tudo ou nada);
    - candidato a candidato, as regras da função de um só: lista vigente e ativa;
      status já definido só o admin muda, fora do Convocado; quem não passa (ou já
      está no status) volta em "ignorados", com o motivo, e os demais mudam;
    - histórico em TH_CANDIDATO_APROVADO, matrícula limpa (nenhum status do lote a
      guarda), processo SEI como estava, KPI de contratados de cada edital tocado;
    - resposta no formato de marcar_candidatos_convocados (marcados, ignorados).

  GUARDAS: já aplicada, ou as funções de status de um candidato ausentes: recusa.

  Ensaio: supabase/ensaios/20261111180000_status_em_lote_dos_aprovados.sql   Rollback: supabase/rollback/20261111180000_status_em_lote_dos_aprovados.sql
  Teste: tests/status-em-lote-dos-aprovados-migration.test.ts
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if to_regprocedure('public.alterar_status_candidatos_aprovados(uuid[], text, date)') is not null then
    raise exception 'A migration 20261111180000 já foi aplicada (alterar_status_candidatos_aprovados existe).';
  end if;
  if to_regprocedure('public.alterar_status_candidato_aprovado(uuid, text, text, text, date)') is null
     or to_regprocedure('public.marcar_candidatos_convocados(uuid[], date, uuid)') is null then
    raise exception 'As funções de status de um candidato não existem: o banco não é o esperado.';
  end if;
end;
$guarda$;

-- [funcao] (o ensaio repete este bloco letra por letra; o teste confere)
create function public.alterar_status_candidatos_aprovados(
  p_candidatos uuid[],
  p_status text,
  p_data_convocacao date default null
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_admin boolean;
  v_ids uuid[];
  v_c record;
  v_data date;
  v_alterados integer := 0;
  v_ignorados jsonb := '[]'::jsonb;
begin
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Perfil sem permissao para alterar status' using errcode = '42501';
  end if;
  v_admin := private.pode_recurso('aprovados', 3);
  -- Contratado e Migração pedem a matrícula de cada um: só um por vez
  -- (alterar_status_candidato_aprovado). Contratado em outra lista também.
  if v_status is not null and v_status not in ('Convocado', 'Desistente', 'Documentação Rejeitada') then
    raise exception 'Em lote, só Convocado, Desistente, Documentação Rejeitada ou sem status.' using errcode = '22023';
  end if;
  if v_status is null and not v_admin then
    raise exception 'Só o admin de Aprovados deixa candidatos sem status.' using errcode = '42501';
  end if;
  if p_data_convocacao is not null and v_status is distinct from 'Convocado' then
    raise exception 'A data da convocação só vale para o status Convocado' using errcode = '22023';
  end if;
  if p_data_convocacao > v_hoje then
    raise exception 'A data da convocação não pode ser futura' using errcode = '22023';
  end if;
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_candidatos, '{}'::uuid[])) x where x is not null;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Escolha ao menos um candidato.' using errcode = '22023';
  end if;
  if array_length(v_ids, 1) > 500 then
    raise exception 'No máximo 500 candidatos por vez.' using errcode = '22023';
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
    -- As regras de alterar_status_candidato_aprovado, candidato a candidato; quem
    -- não passa volta em "ignorados", com o motivo, e os demais mudam.
    if not v_c.vigente or not v_c.ativo then
      v_ignorados := v_ignorados || jsonb_build_object('candidato_id', v_c.id, 'nome', v_c.nome, 'motivo', 'Lista inativa ou substituída');
    elsif v_c.status is not distinct from v_status then
      v_ignorados := v_ignorados || jsonb_build_object('candidato_id', v_c.id, 'nome', v_c.nome,
        'motivo', coalesce('Já está como ' || v_c.status, 'Já está sem status'));
    elsif not v_admin and v_c.status is not null and v_c.status <> 'Convocado' then
      v_ignorados := v_ignorados || jsonb_build_object('candidato_id', v_c.id, 'nome', v_c.nome,
        'motivo', 'Status já definido (' || v_c.status || '): só o admin muda');
    else
      v_data := case
        when v_status = 'Convocado' then coalesce(p_data_convocacao, v_hoje)
        when v_status is null then null
        else v_c."DT_CONVOCACAO"
      end;
      insert into public."TH_CANDIDATO_APROVADO"(
        candidato_id, lista_id, status_anterior, status_novo, alterado_por, "DT_CONVOCACAO"
      ) values (
        v_c.id, v_c.lista_id, v_c.status, v_status, (select auth.uid()), v_data
      );
      -- Matrícula só fica em Contratado, Migração e Contratado em outra lista:
      -- nenhum dos status do lote. O processo SEI fica como estava.
      update public."TB_CANDIDATO_APROVADO"
         set status = v_status, matricula = null, "DT_CONVOCACAO" = v_data,
             updated_by = (select auth.uid()), updated_at = now()
       where id = v_c.id;
      v_alterados := v_alterados + 1;
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

  -- "marcados" como em marcar_candidatos_convocados: a tela lê as duas respostas igual.
  return json_build_object('marcados', v_alterados, 'ignorados', v_ignorados,
                           'status', v_status, 'data_convocacao',
                           case when v_status = 'Convocado' then coalesce(p_data_convocacao, v_hoje) end);
end;
$function$;

comment on function public.alterar_status_candidatos_aprovados(uuid[], text, date) is
  'Status em lote na Lista de aprovados (20261111180000): Convocado (com a data), Desistente, Documentação Rejeitada ou sem status (só admin), até 500 candidatos. As regras de alterar_status_candidato_aprovado candidato a candidato: lista vigente e ativa; status já definido só o admin muda, fora do Convocado; quem não passa volta em ignorados com o motivo. Contratado e Migração ficam de fora (matrícula de cada um). Histórico em TH_CANDIDATO_APROVADO; o processo SEI fica. Aprovados editor.';

revoke all on function public.alterar_status_candidatos_aprovados(uuid[], text, date) from public, anon;
grant execute on function public.alterar_status_candidatos_aprovados(uuid[], text, date) to authenticated;
-- [/funcao]

commit;
