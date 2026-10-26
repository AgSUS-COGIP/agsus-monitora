-- TESTE das RPCs da nova versão da lista de aprovados (20261026150000), em begin…rollback: não grava.
-- Roda com a migration aplicada (ou depois do corpo dela, na mesma transação). Cada falha é um
-- "raise exception" dizendo o caso; tudo certo, o resultado é {"ok": true, ...}.
--
-- O plano do casamento é do job Python (tests/python/test_casamento_da_lista.py testa a regra);
-- aqui ele é escrito à mão, como o job o grava (gravar_casamento_da_lista), para testar o que é
-- do banco: validar, aplicar, preservar o estado e recalcular os contratados.
-- Casos: lista sem status (substitui sem motivo); com status casando (preserva status, matrícula,
-- processo, DT_CONVOCACAO; contratados = 1); com status sem par (pendência); revisão à mão
-- respeitada; plano inválido recusado; lista que mudou depois da prévia (ERRO no job, PT409 ao
-- aplicar); sem motivo recusado; administrador global passa em tudo mesmo com a permissão
-- individual rebaixada; quem não é administrador global, pelo nível de Importação da matriz de
-- Acessos (2 não substitui, 3 substitui); remover zera os contratados; primeira lista sem job; o
-- mesmo fluxo pela Classificação (PT409 com a lista vigente errada).
begin;

set local agsus.segredo_disparo_robos = 'ensaio-sem-chave';

select set_config('request.jwt.claims',
  json_build_object('sub', (select p.user_id from public."TB_PERFIL_USUARIO" p
                             join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
                             where p.ativo and g."ST_ADMIN_GLOBAL" and p.user_id is not null
                             order by p.updated_at limit 1)::text,
                    'role', 'authenticated')::text, true);

create temporary table t_resultado (caso text primary key, valor jsonb) on commit drop;

-- O plano como o job o grava: os vínculos dados, o resto vazio.
create function pg_temp.plano(p_vinculos jsonb)
returns jsonb
language sql
as $f$
  select jsonb_build_object(
    'versao', 1, 'vinculos', p_vinculos, 'pendencias', '[]'::jsonb, 'mudam', '[]'::jsonb, 'revisar', '[]'::jsonb,
    'resumo', jsonb_build_object('casados', jsonb_array_length(p_vinculos), 'entram', 0, 'sem_par', 0, 'sem_dono', 0,
                                 'preservados', 0, 'mudam', 0, 'sub_judice_mantidos', 0, 'ambiguos', 0));
$f$;

-- Pede a prévia da planilha ([[nome, posição], ...]) e devolve o pedido.
create function pg_temp.pedir(p_edital uuid, p_linhas jsonb, p_manuais jsonb default '{}'::jsonb)
returns uuid
language sql
as $f$
  select (public.pedir_casamento_da_lista(
            p_edital, 'XLSX',
            (select jsonb_agg(jsonb_build_object('codigo_vaga', 'TESTE-1', 'cargo', 'Enfermeiro',
                                                 'modalidade', 'Ampla Concorrência', 'nota', 80,
                                                 'nome', l.v ->> 0, 'classificacao', (l.v ->> 1)::integer)
                              order by l.i)
               from jsonb_array_elements(p_linhas) with ordinality l(v, i)),
            null, null, 't.xlsx', p_manuais) ->> 'pedido_id')::uuid;
$f$;

create function pg_temp.casar(p_pedido uuid, p_vinculos jsonb)
returns jsonb
language sql
as $f$
  select public.gravar_casamento_da_lista('casam-20261026T120000-0000abcd', p_pedido, pg_temp.plano(p_vinculos), null)::jsonb;
$f$;

create function pg_temp.vinc(p_candidato uuid, p_linha integer, p_forma text default 'NOME')
returns jsonb
language sql
as $f$
  select jsonb_build_object('candidato_id', p_candidato, 'chave', p_linha::text, 'forma', p_forma);
$f$;

do $$
declare
  v_edital uuid;
  v_pedido uuid;
  v_r jsonb;
  v_lista uuid;
  v_ana uuid;
  v_bruno uuid;
  v_falhou boolean;
  v_global uuid := (select auth.uid());
  v_perfil_global uuid;
  v_outro record;
begin
  -- Um edital ativo de verdade, com lista vigente XLSX (a menor), só para ter as permissões e o KPI.
  select l.edital_id::uuid into v_edital
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id and m.ativo
   where l.vigente and l."TP_ORIGEM" = 'XLSX'
   order by (select count(*) from public."TB_CANDIDATO_APROVADO" c where c.lista_id = l.id), l.id
   limit 1;
  if v_edital is null then raise exception 'Sem edital com lista vigente para o teste.'; end if;

  -- 0. Ponto de partida: três pessoas sem status (a lista real pode ter status: com motivo).
  v_pedido := pg_temp.pedir(v_edital, '[["Ana Ribeiro", 1], ["Bruno Lima", 2], ["Carla Souza", 3]]');
  if (public.obter_casamento_da_lista(v_pedido) ->> 'situacao') <> 'PENDENTE' then
    raise exception 'Caso 0: com lista vigente, o pedido espera o job.';
  end if;
  perform pg_temp.casar(v_pedido, '[]');
  perform public.aplicar_casamento_da_lista(v_pedido, 'Teste das RPCs', true, 'teste/t.xlsx');

  -- 1. Lista sem status: substitui sem motivo.
  select c.id into v_ana from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente and l.edital_id = v_edital::text
   where c.nome = 'Ana Ribeiro';
  select c.id into v_bruno from public."TB_CANDIDATO_APROVADO" c
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente and l.edital_id = v_edital::text
   where c.nome = 'Bruno Lima';
  v_pedido := pg_temp.pedir(v_edital, '[["ANA RIBEIRO", 1], ["Bruno  Lima", 2], ["Davi Rocha", 3]]');
  if (public.obter_casamento_da_lista(v_pedido) ->> 'exige_motivo')::boolean then
    raise exception 'Caso 1: lista sem status pediu motivo.';
  end if;
  perform pg_temp.casar(v_pedido, jsonb_build_array(pg_temp.vinc(v_ana, 1), pg_temp.vinc(v_bruno, 2)));
  v_r := public.aplicar_casamento_da_lista(v_pedido, null, true, 'teste/t.xlsx');
  if (v_r ->> 'entram')::int <> 1 or (v_r ->> 'saem')::int <> 1 or jsonb_array_length(v_r -> 'pendencias') <> 0 then
    raise exception 'Caso 1 (lista sem status): %', v_r;
  end if;
  insert into t_resultado values ('1_sem_status', jsonb_build_object('casados', v_r -> 'casados', 'entram', v_r -> 'entram', 'saem', v_r -> 'saem'));
  v_lista := (v_r ->> 'lista_id')::uuid;

  -- Estado na lista: Ana contratada, Bruno convocado.
  select id into v_ana from public."TB_CANDIDATO_APROVADO" where lista_id = v_lista and nome = 'ANA RIBEIRO';
  select id into v_bruno from public."TB_CANDIDATO_APROVADO" where lista_id = v_lista and nome = 'Bruno  Lima';
  perform public.alterar_status_candidato_aprovado(v_ana, 'Contratado', 'SEI-1', 'MAT-1', null);
  perform public.alterar_status_candidato_aprovado(v_bruno, 'Convocado', null, null, date '2026-10-01');
  if (select contratados from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital) <> 1 then
    raise exception 'Contratados depois do status: esperado 1.';
  end if;

  -- 2. A lista mudou depois da prévia: o job recebe ERRO; aplicar um plano velho dá PT409.
  v_pedido := pg_temp.pedir(v_edital, '[["Ana Ribeiro", 1]]');
  perform public.alterar_status_candidato_aprovado(v_bruno, 'Desistente', null, null, null);
  v_r := pg_temp.casar(v_pedido, jsonb_build_array(pg_temp.vinc(v_ana, 1)));
  if (v_r ->> 'situacao') <> 'ERRO' then raise exception 'Caso 2: plano de lista que mudou foi aceito: %', v_r; end if;
  v_pedido := pg_temp.pedir(v_edital, '[["Ana Ribeiro", 1]]');
  perform pg_temp.casar(v_pedido, jsonb_build_array(pg_temp.vinc(v_ana, 1)));
  perform public.alterar_status_candidato_aprovado(v_bruno, 'Convocado', null, null, date '2026-10-01');
  begin
    perform public.aplicar_casamento_da_lista(v_pedido, 'Motivo', true, 'teste/t.xlsx');
    v_falhou := false;
  exception when others then
    v_falhou := sqlstate = 'PT409';
  end;
  if not v_falhou then raise exception 'Caso 2: aplicou o plano de uma lista que mudou.'; end if;
  insert into t_resultado values ('2_lista_mudou', '"ERRO no job, PT409 ao aplicar"');

  -- 3. Com status, sem motivo: recusado. Com motivo, a posição muda e o estado vai junto.
  v_pedido := pg_temp.pedir(v_edital, '[["Bruno Lima", 1], ["Ana Ribeiro", 2], ["Davi Rocha", 3]]');
  if not (public.obter_casamento_da_lista(v_pedido) ->> 'exige_motivo')::boolean then
    raise exception 'Caso 3: lista com status não pediu motivo.';
  end if;
  perform pg_temp.casar(v_pedido, jsonb_build_array(pg_temp.vinc(v_bruno, 1), pg_temp.vinc(v_ana, 2),
    pg_temp.vinc((select id from public."TB_CANDIDATO_APROVADO" where lista_id = v_lista and nome = 'Davi Rocha'), 3)));
  begin
    perform public.aplicar_casamento_da_lista(v_pedido, null, true, 'teste/t.xlsx');
    v_falhou := false;
  exception when others then
    v_falhou := sqlerrm like '%informe o motivo%';
  end;
  if not v_falhou then raise exception 'Caso 3: substituir lista com status sem motivo passou.'; end if;
  insert into t_resultado values ('3_sem_motivo_recusado', 'true');
  v_r := public.aplicar_casamento_da_lista(v_pedido, 'Nova ordem', true, 'teste/t.xlsx');
  v_lista := (v_r ->> 'lista_id')::uuid;
  if (v_r ->> 'casados')::int <> 3 or (v_r ->> 'preservados')::int <> 2 or (v_r ->> 'mudam')::int <> 2
     or not exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista and c.nome = 'Ana Ribeiro'
                     and c.status = 'Contratado' and c.matricula = 'MAT-1' and c.processo_sei = 'SEI-1'
                     and c.classificacao = 2 and c."CO_CANDIDATO_ANTERIOR" = v_ana)
     or not exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista and c.nome = 'Bruno Lima'
                     and c.status = 'Convocado' and c."DT_CONVOCACAO" = date '2026-10-01' and c."CO_CANDIDATO_ANTERIOR" = v_bruno)
     or (select contratados from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital) <> 1
     or not exists (select 1 from public."TH_PUBLICACAO_APROVADO" h where h."CO_LISTA_APROVADO" = v_lista
                     and h."TP_ORIGEM" = 'XLSX' and h."DS_MOTIVO" = 'Nova ordem' and h."QT_PRESERVADO" = 2)
     or (select "TP_SITUACAO" from public."TB_PEDIDO_CASAMENTO_LISTA" where "CO_PEDIDO" = v_pedido) <> 'APLICADO' then
    raise exception 'Caso 3 (status casando): %', v_r;
  end if;
  insert into t_resultado values ('3_status_casando', jsonb_build_object('casados', v_r -> 'casados',
    'preservados', v_r -> 'preservados', 'mudam', v_r -> 'mudam', 'contratados', 1));
  select id into v_ana from public."TB_CANDIDATO_APROVADO" where lista_id = v_lista and nome = 'Ana Ribeiro';

  -- 4. Revisão à mão: o plano tem de respeitá-la; um vínculo fora da lista é recusado.
  v_pedido := pg_temp.pedir(v_edital, '[["Ana R. Silva", 1], ["Davi Rocha", 2]]',
                            jsonb_build_object(v_ana::text, '1'));
  begin
    perform pg_temp.casar(v_pedido, '[]');
    v_falhou := false;
  exception when others then
    v_falhou := sqlerrm like '%revisão à mão%';
  end;
  if not v_falhou then raise exception 'Caso 4: plano sem a revisão à mão foi aceito.'; end if;
  begin
    perform pg_temp.casar(v_pedido, jsonb_build_array(pg_temp.vinc(v_ana, 1, 'MANUAL'), pg_temp.vinc(gen_random_uuid(), 2)));
    v_falhou := false;
  exception when others then
    v_falhou := sqlerrm like '%não está na lista vigente%';
  end;
  if not v_falhou then raise exception 'Caso 4: vínculo com quem não está na lista foi aceito.'; end if;
  perform pg_temp.casar(v_pedido, jsonb_build_array(pg_temp.vinc(v_ana, 1, 'MANUAL')));
  insert into t_resultado values ('4_revisao_a_mao_e_plano_invalido', 'true');

  -- 5. Com status sem par: Bruno (Convocado) não casou; vira pendência e o status não vai a ninguém.
  v_r := public.aplicar_casamento_da_lista(v_pedido, 'Nome corrigido', true, 'teste/t.xlsx');
  v_lista := (v_r ->> 'lista_id')::uuid;
  if jsonb_array_length(v_r -> 'pendencias') <> 1 or (v_r -> 'pendencias' -> 0 ->> 'status') <> 'Convocado'
     or not exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista and c.nome = 'Ana R. Silva'
                     and c.status = 'Contratado' and c."CO_CANDIDATO_ANTERIOR" = v_ana)
     or exists (select 1 from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_lista and c.status = 'Convocado') then
    raise exception 'Caso 5 (status sem par): %', v_r;
  end if;
  insert into t_resultado values ('5_status_sem_par', jsonb_build_object('status_sem_dono', jsonb_array_length(v_r -> 'pendencias')));

  -- 6. Admin global passa em tudo, mesmo com a permissão individual rebaixada na matriz.
  select p.id into v_perfil_global from public."TB_PERFIL_USUARIO" p where p.user_id = v_global and p.ativo limit 1;
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, revisao, updated_at, updated_by)
  select v_perfil_global, r.recurso, r.nivel, 1, now(), v_global
    from (values ('importacao', 'leitor'), ('classificacao', 'sem_acesso'), ('aprovados', 'leitor')) r(recurso, nivel)
  on conflict (perfil_usuario_id, recurso) do update set nivel = excluded.nivel;
  if private.pode_recurso('importacao', 2) then raise exception 'Caso 6: o rebaixamento não valeu.'; end if;
  v_pedido := pg_temp.pedir(v_edital, '[["Ana R. Silva", 1]]');
  perform pg_temp.casar(v_pedido, jsonb_build_array(pg_temp.vinc(
    (select id from public."TB_CANDIDATO_APROVADO" where lista_id = v_lista and nome = 'Ana R. Silva'), 1)));
  v_r := public.aplicar_casamento_da_lista(v_pedido, 'Admin global', true, 'teste/t.xlsx');
  v_lista := (v_r ->> 'lista_id')::uuid;
  perform public.definir_lista_aprovados_ativa(v_lista, false);
  perform public.definir_lista_aprovados_ativa(v_lista, true);
  if not (public.obter_publicacao_lista_aprovados(v_edital) ->> 'pode_substituir')::boolean then
    raise exception 'Caso 6: a prévia não deixa o admin global substituir.';
  end if;
  insert into t_resultado values ('6_admin_global_passa', 'true');

  -- 7. Quem não é admin global: vale o nível de Importação da matriz, sem perfil fixo.
  select p.id, p.user_id into v_outro
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo and p.user_id is not null and not g."ST_ADMIN_GLOBAL"
   order by p.updated_at limit 1;
  if v_outro.id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_outro.user_id::text, 'role', 'authenticated')::text, true);
    insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, revisao, updated_at, updated_by)
    values (v_outro.id, 'importacao', 'editor', 1, now(), v_global)
    on conflict (perfil_usuario_id, recurso) do update set nivel = excluded.nivel;
    begin
      perform private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(v_edital::text, v_lista, 'XLSX', 'Motivo do teste', true);
      v_falhou := false;
    exception when others then
      v_falhou := sqlstate = '42501';
    end;
    if not v_falhou then raise exception 'Caso 7: Importação nível 2 substituiu a lista.'; end if;
    begin
      perform public.remover_lista_aprovados(v_lista);
      v_falhou := false;
    exception when others then
      v_falhou := sqlstate = '42501';
    end;
    if not v_falhou then raise exception 'Caso 7: Importação nível 2 removeu a lista.'; end if;
    update public."TB_PERMISSAO_RECURSO" set nivel = 'admin'
     where perfil_usuario_id = v_outro.id and recurso = 'importacao';
    perform private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(v_edital::text, v_lista, 'XLSX', 'Motivo do teste', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_global::text, 'role', 'authenticated')::text, true);
    insert into t_resultado values ('7_pela_matriz_de_acessos', '{"nivel_2": "recusado", "nivel_3": "passa"}');
  end if;

  -- 8. Remover a lista vigente zera os contratados (o admin global, com Importação rebaixada).
  perform public.remover_lista_aprovados(v_lista);
  if (select contratados from public."TB_MONITORAMENTO_INDIGENA" where id = v_edital) <> 0 then
    raise exception 'Caso 8: remover não zerou os contratados.';
  end if;
  insert into t_resultado values ('8_remover_zera', '0');

  -- 9. Sem lista vigente, o plano sai na hora (sem job) e aplica direto.
  v_pedido := pg_temp.pedir(v_edital, '[["Primeira Lista", 1]]');
  if (public.obter_casamento_da_lista(v_pedido) ->> 'situacao') <> 'CALCULADO' then
    raise exception 'Caso 9: sem lista vigente, o plano não saiu na hora.';
  end if;
  v_r := public.aplicar_casamento_da_lista(v_pedido, null, true, 'teste/t.xlsx');
  insert into t_resultado values ('9_primeira_lista', jsonb_build_object('entram', v_r -> 'entram'));

  -- 10. Pela Classificação: o mesmo fluxo (resultado final mais recente de algum edital, se houver).
  select l."CO_MONITORAMENTO", l."CO_LISTA_CLASSIFICACAO" as lista into v_outro
    from public."TB_LISTA_CLASSIFICACAO" l
   where l."TP_LISTA" = 'FINAL' and l."QT_PENDENCIA" = 0
     and not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" o
                      where o."CO_MONITORAMENTO" = l."CO_MONITORAMENTO" and o."TP_LISTA" = 'FINAL'
                        and o."DT_GERACAO" > l."DT_GERACAO")
   order by l."DT_GERACAO" desc limit 1;
  if v_outro is not null then
    v_lista := (select id from public."TB_LISTA_APROVADO" where edital_id = v_outro."CO_MONITORAMENTO"::text and vigente);
    begin
      perform public.pedir_casamento_da_lista(v_outro."CO_MONITORAMENTO", 'CLASSIFICACAO', null, v_outro.lista, gen_random_uuid());
      v_falhou := false;
    exception when others then
      v_falhou := sqlstate = 'PT409';
    end;
    if not v_falhou then raise exception 'Caso 10: pediu com a lista vigente errada.'; end if;
    begin
      v_r := public.pedir_casamento_da_lista(v_outro."CO_MONITORAMENTO", 'CLASSIFICACAO', null, v_outro.lista, v_lista)::jsonb;
    exception when others then
      -- Resultado final sem candidatos (há um assim no banco): recusado, como antes.
      if sqlerrm not like '%não tem candidatos%' then raise; end if;
      v_r := null;
    end;
  end if;
  if v_outro is not null and v_r is null then
    insert into t_resultado values ('10_pela_classificacao', '"resultado final sem candidatos: recusado"');
  elsif v_outro is not null then
    v_pedido := (v_r ->> 'pedido_id')::uuid;
    if v_lista is not null then
      perform public.gravar_casamento_da_lista('casam-20261026T120000-0000abcd', v_pedido, pg_temp.plano('[]'), null);
    end if;
    if jsonb_array_length((public.obter_casamento_da_lista(v_pedido)::jsonb) -> 'novos') <> (v_r ->> 'candidatos')::int then
      raise exception 'Caso 10: a prévia da Classificação não traz quem entra.';
    end if;
    v_r := public.aplicar_casamento_da_lista(v_pedido, 'Teste pela Classificação');
    if not exists (select 1 from public."TB_LISTA_APROVADO" l where l.id = (v_r ->> 'lista_id')::uuid
                    and l."TP_ORIGEM" = 'CLASSIFICACAO' and l."CO_LISTA_CLASSIFICACAO" = v_outro.lista)
       or not exists (select 1 from public."TH_PUBLICACAO_APROVADO" h where h."CO_LISTA_APROVADO" = (v_r ->> 'lista_id')::uuid
                       and h."TP_ORIGEM" = 'CLASSIFICACAO' and h."NU_VERSAO_REGRA" is not null) then
      raise exception 'Caso 10 (Classificação): %', v_r;
    end if;
    insert into t_resultado values ('10_pela_classificacao', jsonb_build_object('candidatos', v_r -> 'candidatos'));
  end if;
end;
$$;

select jsonb_build_object('ok', true) || jsonb_object_agg(caso, valor) as teste from t_resultado;

rollback;
