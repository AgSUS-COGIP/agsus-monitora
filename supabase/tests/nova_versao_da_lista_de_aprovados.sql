-- TESTE das RPCs da nova versão da lista de aprovados (20261026150000), em begin…rollback: não grava.
-- Roda com a migration aplicada (ou depois do corpo dela, na mesma transação). Para cada caso, um
-- "raise exception" diz o que falhou; tudo certo, o resultado é {"ok": true, ...}.
-- Casos: lista sem status (substitui sem motivo); com status casando (preserva status, matrícula,
-- DT_CONVOCACAO; contratados = 1); com status sem par (pendência; o status não vai para ninguém);
-- vínculo à mão (p_vinculos); sem motivo é recusado; remover zera os contratados.
begin;

set local agsus.segredo_disparo_robos = 'ensaio-sem-chave';

select set_config('request.jwt.claims',
  json_build_object('sub', (select p.user_id from public."TB_PERFIL_USUARIO" p
                             where p.ativo and p.perfil = 'admin' and p.user_id is not null
                             order by p.updated_at limit 1)::text,
                    'role', 'authenticated')::text, true);

create temporary table t_resultado (caso text primary key, valor jsonb) on commit drop;

do $$
declare
  v_edital text;
  v_r jsonb;
  v_lista uuid;
  v_ana uuid;
  v_bruno uuid;
  v_falhou boolean;
  -- Uma linha da planilha.
  c_linha constant text := '{"codigo_vaga": "TESTE-1", "cargo": "Enfermeiro", "modalidade": "Ampla Concorrência", "nota": 80}';
begin
  -- Um edital ativo de verdade, com lista vigente XLSX (a menor), só para ter as permissões e o KPI.
  select l.edital_id into v_edital
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id and m.ativo
   where l.vigente and l."TP_ORIGEM" = 'XLSX'
   order by (select count(*) from public."TB_CANDIDATO_APROVADO" c where c.lista_id = l.id), l.id
   limit 1;
  if v_edital is null then raise exception 'Sem edital com lista vigente para o teste.'; end if;

  -- 0. Ponto de partida: três pessoas sem status (a lista real pode ter status: com motivo).
  v_r := public.importar_lista_aprovados(v_edital, true, 't.xlsx', 'teste/t.xlsx', jsonb_build_array(
    c_linha::jsonb || '{"nome": "Ana Ribeiro", "classificacao": 1}',
    c_linha::jsonb || '{"nome": "Bruno Lima", "classificacao": 2}',
    c_linha::jsonb || '{"nome": "Carla Souza", "classificacao": 3}'), true, 'Teste das RPCs', null);

  -- 1. Lista sem status: substitui sem motivo; casa pelo nome (com e sem acento/caixa).
  v_r := public.importar_lista_aprovados(v_edital, true, 't.xlsx', 'teste/t.xlsx', jsonb_build_array(
    c_linha::jsonb || '{"nome": "ANA RIBEIRO", "classificacao": 1}',
    c_linha::jsonb || '{"nome": "Bruno  Lima", "classificacao": 2}',
    c_linha::jsonb || '{"nome": "Davi Rocha", "classificacao": 3}'), true, null, null);
  if (v_r ->> 'casados')::int <> 2 or (v_r ->> 'entram')::int <> 1 or (v_r ->> 'saem')::int <> 1
     or jsonb_array_length(v_r -> 'pendencias') <> 0 then
    raise exception 'Caso 1 (lista sem status): %', v_r;
  end if;
  insert into t_resultado values ('1_sem_status', v_r - 'lista_id' - 'publicacao_id' - 'lista_anterior'
                                                  - 'edital_id' - 'edital' - 'importado_por_email' - 'importado_por_nome');
  v_lista := (v_r ->> 'lista_id')::uuid;

  -- Estado na lista: Ana contratada, Bruno convocado.
  select id into v_ana from public."TB_CANDIDATO_APROVADO" where lista_id = v_lista and nome = 'ANA RIBEIRO';
  select id into v_bruno from public."TB_CANDIDATO_APROVADO" where lista_id = v_lista and nome = 'Bruno  Lima';
  perform public.alterar_status_candidato_aprovado(v_ana, 'Contratado', 'SEI-1', 'MAT-1', null);
  perform public.alterar_status_candidato_aprovado(v_bruno, 'Convocado', null, null, date '2026-10-01');
  if (select contratados from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital::uuid) <> 1 then
    raise exception 'Contratados depois do status: esperado 1.';
  end if;

  -- 2. Com status, sem motivo: recusado.
  begin
    perform public.importar_lista_aprovados(v_edital, true, 't.xlsx', 'teste/t.xlsx', jsonb_build_array(
      c_linha::jsonb || '{"nome": "Ana Ribeiro", "classificacao": 1}'), true, null, null);
    v_falhou := false;
  exception when others then
    v_falhou := sqlerrm like '%informe o motivo%';
  end;
  if not v_falhou then raise exception 'Caso 2: substituir lista com status sem motivo passou.'; end if;
  insert into t_resultado values ('2_sem_motivo_recusado', 'true');

  -- 3. Com status casando: a posição muda, o estado vai junto.
  v_r := public.importar_lista_aprovados(v_edital, true, 't.xlsx', 'teste/t.xlsx', jsonb_build_array(
    c_linha::jsonb || '{"nome": "Bruno Lima", "classificacao": 1}',
    c_linha::jsonb || '{"nome": "Ana Ribeiro", "classificacao": 2}',
    c_linha::jsonb || '{"nome": "Davi Rocha", "classificacao": 3}'), true, 'Nova ordem', null);
  v_lista := (v_r ->> 'lista_id')::uuid;
  if (v_r ->> 'casados')::int <> 3 or (v_r ->> 'preservados')::int <> 2 or (v_r ->> 'mudam')::int <> 2
     or not exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista and c.nome = 'Ana Ribeiro'
                     and c.status = 'Contratado' and c.matricula = 'MAT-1' and c.processo_sei = 'SEI-1'
                     and c.classificacao = 2 and c."CO_CANDIDATO_ANTERIOR" = v_ana)
     or not exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista and c.nome = 'Bruno Lima'
                     and c.status = 'Convocado' and c."DT_CONVOCACAO" = date '2026-10-01' and c."CO_CANDIDATO_ANTERIOR" = v_bruno)
     or (select contratados from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital::uuid) <> 1
     or not exists (select 1 from public."TH_PUBLICACAO_APROVADO" h where h."CO_LISTA_APROVADO" = v_lista
                     and h."TP_ORIGEM" = 'XLSX' and h."DS_MOTIVO" = 'Nova ordem' and h."QT_PRESERVADO" = 2) then
    raise exception 'Caso 3 (status casando): %', v_r;
  end if;
  insert into t_resultado values ('3_status_casando', jsonb_build_object('casados', v_r -> 'casados',
    'preservados', v_r -> 'preservados', 'mudam', v_r -> 'mudam', 'contratados', 1));
  select id into v_ana from public."TB_CANDIDATO_APROVADO" where lista_id = v_lista and nome = 'Ana Ribeiro';

  -- 4. Vínculo à mão (p_vinculos da tela): o nome mudou na planilha, a pessoa é a mesma.
  v_r := public.importar_lista_aprovados(v_edital, true, 't.xlsx', 'teste/t.xlsx', jsonb_build_array(
    c_linha::jsonb || '{"nome": "Ana R. Silva", "classificacao": 1}',
    c_linha::jsonb || '{"nome": "Davi Rocha", "classificacao": 2}'), true, 'Nome corrigido',
    jsonb_build_array(jsonb_build_object('candidato_id', v_ana, 'linha', 1, 'forma', 'MANUAL')));
  v_lista := (v_r ->> 'lista_id')::uuid;
  -- 5. Com status sem par: Bruno (Convocado) não está na planilha nem foi vinculado.
  if (v_r ->> 'casados')::int <> 1 or jsonb_array_length(v_r -> 'pendencias') <> 1
     or (v_r -> 'pendencias' -> 0 ->> 'status') <> 'Convocado'
     or not exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista and c.nome = 'Ana R. Silva'
                     and c.status = 'Contratado' and c."CO_CANDIDATO_ANTERIOR" = v_ana)
     or exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista and c.status = 'Convocado') then
    raise exception 'Casos 4 e 5 (vínculo à mão; status sem par): %', v_r;
  end if;
  insert into t_resultado values ('4_vinculo_a_mao', jsonb_build_object('casados', v_r -> 'casados'));
  insert into t_resultado values ('5_status_sem_par', jsonb_build_object('status_sem_dono', jsonb_array_length(v_r -> 'pendencias')));

  -- 6. Remover a lista vigente zera os contratados.
  perform public.remover_lista_aprovados(v_lista);
  if (select contratados from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital::uuid) <> 0 then
    raise exception 'Caso 6: remover não zerou os contratados.';
  end if;
  insert into t_resultado values ('6_remover_zera', '0');
end;
$$;

select jsonb_build_object('ok', true) || jsonb_object_agg(caso, valor) as teste from t_resultado;

rollback;
