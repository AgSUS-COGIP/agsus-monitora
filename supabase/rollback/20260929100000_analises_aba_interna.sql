-- Desfaz 20260929100000_analises_aba_interna.sql.
--
-- 1. Permissões: para cada perfil que a migration alterou (registro em
--    "TH_PERMISSAO_RECURSO" com o motivo dela), a linha `analises` volta ao que
--    era — se ninguém a mudou depois (nível e updated_at ainda os da migration;
--    senão fica, com aviso). Linha que a migration criou (revisao = 1) sai: sem
--    ela, vale o padrão do papel, como antes. Linha que já existia volta ao nível
--    e à revisão anteriores (updated_at/updated_by ficam os do rollback: o
--    histórico não guarda os antigos). O rollback também registra em
--    "TH_PERMISSAO_RECURSO"; os registros da migration ficam.
-- 2. Painel: ativo e tipo_abertura voltam aos da foto `paineis_antes` que a
--    migration gravou em "TH_CONFIGURACAO", com novo registro de histórico.
--
-- Front: o front novo funciona com o banco antes ou depois (a view `analises`
-- não depende do painel). O front antigo volta a mostrar o painel.
begin;

do $rollback$
declare
  c_motivo constant text := 'Análises curriculares viram aba interna';
  c_motivo_rollback constant text := 'Desfaz: Análises curriculares viram aba interna';
  v_autor uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_painel public."TB_PAINEL_EXTERNO";
  v_antes jsonb;
  v_paineis_antes jsonb;
  r record;
  v_desfeitas integer := 0;
  v_mantidas integer := 0;
begin
  select * into v_painel from public."TB_PAINEL_EXTERNO" where codigo = 'analises' for update;
  if v_painel.id is null or v_painel.tipo_abertura is distinct from 'aba_interna' then
    raise notice 'Painel analises não está arquivado como aba interna: nada a desfazer.';
    return;
  end if;

  perform pg_advisory_xact_lock(73923124153);

  for r in
    select distinct on (h.perfil_usuario_id)
      h.perfil_usuario_id, h.nivel_anterior, h.nivel_novo, h.alterado_em,
      g.nivel atual, g.revisao, g.updated_at
    from public."TH_PERMISSAO_RECURSO" h
    left join public."TB_PERMISSAO_RECURSO" g
      on g.perfil_usuario_id = h.perfil_usuario_id and g.recurso = 'analises'
    where h.recurso = 'analises' and h.motivo = c_motivo
    order by h.perfil_usuario_id, h.alterado_em desc, h.id desc
  loop
    if r.atual is distinct from r.nivel_novo or r.updated_at is distinct from r.alterado_em then
      v_mantidas := v_mantidas + 1;
      raise notice 'Perfil %: permissão de análises mudou depois da migration; mantida.', r.perfil_usuario_id;
      continue;
    end if;
    if r.revisao = 1 then
      -- A linha nasceu na migration: sai, e volta a valer o padrão do papel.
      delete from public."TB_PERMISSAO_RECURSO"
       where perfil_usuario_id = r.perfil_usuario_id and recurso = 'analises';
    else
      update public."TB_PERMISSAO_RECURSO"
         set nivel = r.nivel_anterior, revisao = revisao - 1,
             updated_at = now(), updated_by = v_autor
       where perfil_usuario_id = r.perfil_usuario_id and recurso = 'analises';
    end if;
    insert into public."TH_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
    values (r.perfil_usuario_id, 'analises', r.nivel_novo, r.nivel_anterior, v_autor, c_motivo_rollback);
    v_desfeitas := v_desfeitas + 1;
  end loop;

  select p into v_antes
    from public."TH_CONFIGURACAO" c,
         jsonb_array_elements(c.paineis_antes) p
   where c.motivo = c_motivo and p ->> 'codigo' = 'analises'
   order by c.created_at desc
   limit 1;

  v_paineis_antes := private.snapshot_paineis_externos();
  update public."TB_PAINEL_EXTERNO"
     set ativo = coalesce((v_antes ->> 'ativo')::boolean, true),
         tipo_abertura = coalesce(v_antes ->> 'tipo_abertura', 'iframe')
   where id = v_painel.id;

  insert into public."TH_CONFIGURACAO" (acao, motivo, config_antes, config_depois, paineis_antes, paineis_depois, alteracoes, total_alteracoes)
  select 'salvar', c_motivo_rollback, cfg, cfg, v_paineis_antes, private.snapshot_paineis_externos(),
    jsonb_build_array(
      jsonb_build_object('entidade', 'painel', 'chave', v_painel.id, 'codigo', v_painel.codigo,
        'rotulo', coalesce(nullif(v_painel.titulo, ''), v_painel.codigo), 'campo', 'ativo',
        'antes', to_jsonb(v_painel.ativo), 'depois', to_jsonb(coalesce((v_antes ->> 'ativo')::boolean, true))),
      jsonb_build_object('entidade', 'painel', 'chave', v_painel.id, 'codigo', v_painel.codigo,
        'rotulo', coalesce(nullif(v_painel.titulo, ''), v_painel.codigo), 'campo', 'tipo_abertura',
        'antes', to_jsonb(v_painel.tipo_abertura), 'depois', to_jsonb(coalesce(v_antes ->> 'tipo_abertura', 'iframe')))),
    2
  from private.snapshot_configuracoes() cfg;

  raise notice 'Rollback análises aba interna: % permissões desfeitas, % mantidas.', v_desfeitas, v_mantidas;
end;
$rollback$;

commit;
