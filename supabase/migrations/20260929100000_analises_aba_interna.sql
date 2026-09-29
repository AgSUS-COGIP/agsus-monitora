-- Análises curriculares viram aba interna.
--
-- Motivo: o painel `analises` de "TB_PAINEL_EXTERNO" virou a página `analises`
-- do MONITORA (src/modules/pagina-de-analises.js). Para vê-lo, bastava o recurso
-- `analises` mais o recurso `paineis` mais o `painel:<id do analises>`; agora a
-- página pede só o recurso `analises` (>= leitor).
--
-- O que faz:
--   1. Preserva exatamente quem via: quem tinha `analises` mas NÃO via o painel
--      (sem `paineis` ou sem `painel:<id>`) passaria a ver a aba. Com
--      `c_manter_quem_nao_via = true` (padrão), essas pessoas recebem linha
--      explícita `analises` = 'sem_acesso'. Para deixá-las ver a aba, troque
--      para false antes de aplicar (nenhuma linha é criada).
--      Quem via o painel já tem `analises` >= leitor por definição; nada muda
--      para essas pessoas, e o fim da migration confere que ninguém perdeu.
--   2. Arquiva a linha do painel: ativo = false e tipo_abertura = 'aba_interna'
--      (a marca; em_manutencao não muda). As linhas `painel:<id>` de
--      "TB_PERMISSAO_RECURSO" ficam como histórico. Com ativo = false, o painel
--      some de `obter_contexto_monitora` (panel_ids) e da matriz de acessos
--      (`obter_matriz_acessos` só lista painel ativo).
--   3. Auditoria: cada permissão alterada vai para "TH_PERMISSAO_RECURSO" (motivo
--      'Análises curriculares viram aba interna'); o arquivamento do painel, para
--      "TH_CONFIGURACAO" (histórico de configurações, com a foto dos painéis
--      antes e depois).
--
-- Dependentes: front com a view `analises` (o front antigo mostra Análises só
-- pelo painel: com ele arquivado, a aba some do front antigo).
-- Rollback: supabase/rollback/20260929100000_analises_aba_interna.sql.
-- Idempotente: se o painel já tem a marca, não faz nada.
begin;

do $migration$
declare
  -- true: quem tinha `analises` e não via o painel continua sem ver (padrão).
  -- false: essas pessoas passam a ver a aba Análises curriculares.
  c_manter_quem_nao_via constant boolean := true;
  c_motivo constant text := 'Análises curriculares viram aba interna';
  v_autor uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_painel public."TB_PAINEL_EXTERNO";
  v_paineis_antes jsonb;
  v_viam integer;
  v_perderam integer;
  v_bloqueados integer := 0;
begin
  select * into v_painel from public."TB_PAINEL_EXTERNO" where codigo = 'analises' for update;
  if v_painel.id is null then
    raise notice 'Painel analises não existe: nada a fazer.';
    return;
  end if;
  if v_painel.tipo_abertura = 'aba_interna' then
    raise notice 'Painel analises já arquivado como aba interna: nada a fazer.';
    return;
  end if;

  -- Serializa com salvar_matriz_acessos (mesmo lock consultivo).
  perform pg_advisory_xact_lock(73923124153);

  -- O nível efetivo de cada perfil ativo, como private.nivel_recurso calcula
  -- para o próprio usuário: linha explícita; senão, painel = sem_acesso; senão,
  -- o padrão do papel (private.monitora_role, pelo "perfil" da linha).
  create temp table tmp_analises_aba_interna on commit drop as
  with u as (
    select p.id, p.perfil,
      case lower(coalesce(p.perfil, ''))
        when 'master' then 'admin' when 'admin' then 'admin'
        when 'editor' then 'edital_gestor' when 'edital_gestor' then 'edital_gestor'
        when 'contratador' then 'contratador'
        when 'leitor' then 'usuario' when 'usuario' then 'usuario'
        else '' end papel
    from public."TB_PERFIL_USUARIO" p
    where p.ativo
  )
  select u.id, u.perfil,
    ga.nivel analises_explicito,
    coalesce(ga.nivel, private.nivel_padrao_recurso(u.papel, 'analises')) analises,
    coalesce(gp.nivel, private.nivel_padrao_recurso(u.papel, 'paineis')) paineis,
    coalesce(gi.nivel, 'sem_acesso') painel
  from u
  left join public."TB_PERMISSAO_RECURSO" ga on ga.perfil_usuario_id = u.id and ga.recurso = 'analises'
  left join public."TB_PERMISSAO_RECURSO" gp on gp.perfil_usuario_id = u.id and gp.recurso = 'paineis'
  left join public."TB_PERMISSAO_RECURSO" gi on gi.perfil_usuario_id = u.id and gi.recurso = 'painel:' || v_painel.id;

  alter table tmp_analises_aba_interna add column via boolean;
  update tmp_analises_aba_interna
     set via = v_painel.ativo and analises <> 'sem_acesso' and paineis <> 'sem_acesso' and painel <> 'sem_acesso';
  select count(*) into v_viam from tmp_analises_aba_interna where via;

  if c_manter_quem_nao_via then
    insert into public."TH_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
    select id, 'analises', analises, 'sem_acesso', v_autor, c_motivo
      from tmp_analises_aba_interna
     where not via and analises <> 'sem_acesso';
    get diagnostics v_bloqueados = row_count;

    insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
    select id, 'analises', 'sem_acesso', v_autor
      from tmp_analises_aba_interna
     where not via and analises <> 'sem_acesso'
    on conflict (perfil_usuario_id, recurso) do update
      set nivel = excluded.nivel,
          revisao = "TB_PERMISSAO_RECURSO".revisao + 1,
          updated_at = now(),
          updated_by = excluded.updated_by;
  end if;

  v_paineis_antes := private.snapshot_paineis_externos();
  update public."TB_PAINEL_EXTERNO"
     set ativo = false, tipo_abertura = 'aba_interna'
   where id = v_painel.id;

  insert into public."TH_CONFIGURACAO" (acao, motivo, config_antes, config_depois, paineis_antes, paineis_depois, alteracoes, total_alteracoes)
  select 'salvar', c_motivo, cfg, cfg, v_paineis_antes, private.snapshot_paineis_externos(),
    jsonb_build_array(
      jsonb_build_object('entidade', 'painel', 'chave', v_painel.id, 'codigo', v_painel.codigo,
        'rotulo', coalesce(nullif(v_painel.titulo, ''), v_painel.codigo), 'campo', 'ativo',
        'antes', to_jsonb(v_painel.ativo), 'depois', to_jsonb(false)),
      jsonb_build_object('entidade', 'painel', 'chave', v_painel.id, 'codigo', v_painel.codigo,
        'rotulo', coalesce(nullif(v_painel.titulo, ''), v_painel.codigo), 'campo', 'tipo_abertura',
        'antes', to_jsonb(v_painel.tipo_abertura), 'depois', to_jsonb('aba_interna'::text))),
    2
  from private.snapshot_configuracoes() cfg;

  -- Ninguém que via o painel perde: continua com `analises` >= leitor.
  select count(*) into v_perderam
    from tmp_analises_aba_interna t
    left join public."TB_PERMISSAO_RECURSO" g on g.perfil_usuario_id = t.id and g.recurso = 'analises'
   where t.via and coalesce(g.nivel, t.analises) = 'sem_acesso';
  if v_perderam > 0 then
    raise exception 'Análises: % perfis perderiam o acesso', v_perderam;
  end if;

  raise notice 'Análises aba interna: % perfis viam o painel e continuam; % bloqueados com sem_acesso explícito.', v_viam, v_bloqueados;
end;
$migration$;

commit;
