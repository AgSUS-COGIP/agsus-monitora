/*
  OTIMIZAÇÃO DO BANCO — só o que é seguro e tem ganho medido (09/10/2026)

  Auditoria em scratchpad (relatório fora do repositório); números do
  pg_stat_statements/pg_stat_user_* com o banco no ar desde 02/10/2026 01:22
  (7,4 dias). Prova antes × depois em supabase/ensaios/ com o mesmo nome
  (EXPLAIN com buffers e WAL, termina em ROLLBACK).

  1. Doze índices repetidos ou sem leitura saem (nenhum é de constraint):
       iguais a um único/UK que fica, ou prefixo dele:
         TB_CRONOGRAMA_MONIT_INDIG  idx_monitoramento_cronograma_monitoramento = monitoramento_cronograma_ordem_unica
         TB_PERFIL_USUARIO          idx_perfis_usuarios_user_id                = perfis_usuarios_user_id_key
         TM_ANALISE_CURRICULAR      idx_analises_staging_sync_id, idx_analises_staging_sync_entidade
                                    (prefixos de uq_analises_staging_sync_entidade_linha; a tabela de
                                    passagem recebe ~5 mil inserções e exclusões por dia)
         TB_EDITAL_ANALISE          idx_analises_editais_ativo_chave (0 leituras; a UK das mesmas colunas fica)
         TB_ROTEIRO_COMPETENCIA     IN_FKROTEIROCOMPETENCIA_CO (prefixo de UK_ROTEIROCOMPETENCIA_ORDEM)
       sem leitura em tabela de 147 linhas:
         TB_MONITORAMENTO_INDIGENA  idx_monitoramento_indigena_ativo (3), _ativo_uf (0),
                                    _ativo_status (0), _status_etapa (0)
       na tabela que o sync mais escreve (14 índices → 12; 8,7 MB):
         TB_ANALISE_CURRICULAR      idx_analises_curriculares_ativo_ordem_todos (4 leituras em 7,4 dias;
                                    idx_analises_curriculares_ativo_lookup é o prefixo dele e fica),
                                    idx_analises_curriculares_ordem_todos (1 leitura)
     Ensaio: as consultas e montagens que podiam usá-los (painel de análises, pacote das
     entrevistas, VW_ANALISES_DASHBOARD_BASE_TODOS, cronograma, perfil, staging) leem o mesmo
     ou menos buffers depois; a atualização de 2.000 análises gera menos WAL.

  2. Índice que faltava: obter_ultima_conferencia('analises') lia TL_SYNC_ANALISE inteira
     (430 páginas, cresce ~200 linhas/dia) para achar o último sync processado.
     IN_SYNCANALISE_PROCESSADO (parcial, status = 'processado'): 3–5 páginas.

  3. sincronizar_entrevistas só regrava a nota que mudou. A carga de hora em hora fazia
     upsert de todas as notas (754 mil atualizações em 7,4 dias em 14,9 mil linhas,
     ~1,2 MB de WAL por chamada). Mesma assinatura, permissão e retorno; TB_ENTREVISTA
     continua regravando CO_SYNC (é por ele que finalizar_sync_entrevistas desativa quem
     saiu da planilha — fica para a fase 1 do relatório).

  4. COMMENT ON que faltava em funções FC_ e colunas de tabelas novas.

  Não muda: nenhum nome, nenhuma tabela ou dado, nenhuma agenda do pg_cron, nenhum grant.
  Dependentes: obter_ultima_conferencia (lê o índice novo), Apps Script/robô das
  entrevistas (chamam sincronizar_entrevistas, mesmo contrato).
  Rollback: supabase/rollback/20261009110000_otimizacao_do_banco.sql.
*/
begin;

-- 1. Índices repetidos ou sem leitura ----------------------------------------------------------
drop index if exists public.idx_monitoramento_cronograma_monitoramento;
drop index if exists public.idx_perfis_usuarios_user_id;
drop index if exists public.idx_analises_staging_sync_id;
drop index if exists public.idx_analises_staging_sync_entidade;
drop index if exists public.idx_analises_editais_ativo_chave;
drop index if exists public."IN_FKROTEIROCOMPETENCIA_CO";
drop index if exists public.idx_monitoramento_indigena_ativo;
drop index if exists public.idx_monitoramento_indigena_ativo_uf;
drop index if exists public.idx_monitoramento_indigena_ativo_status;
drop index if exists public.idx_monitoramento_indigena_status_etapa;
drop index if exists public.idx_analises_curriculares_ativo_ordem_todos;
drop index if exists public.idx_analises_curriculares_ordem_todos;

-- 2. Último sync processado das análises ------------------------------------------------------
create index if not exists "IN_SYNCANALISE_PROCESSADO"
  on public."TL_SYNC_ANALISE" (finished_at)
  where status = 'processado';
comment on index public."IN_SYNCANALISE_PROCESSADO" is
  'Syncs das análises já processados por hora de término: o último (obter_ultima_conferencia), de todas as planilhas ou de uma, sem ler a tabela inteira.';

-- 3. Carga das entrevistas: só a nota que mudou -----------------------------------------------
CREATE OR REPLACE FUNCTION public.sincronizar_entrevistas(p_sync text, p_area text, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qt integer;
begin
  if p_sync is null or p_sync !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de carga inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  insert into public."TL_SYNC_ENTREVISTA" ("CO_SYNC", "CO_AREA")
  values (p_sync, p_area)
  on conflict ("CO_SYNC") do nothing;
  if exists (select 1 from public."TL_SYNC_ENTREVISTA" s
              where s."CO_SYNC" = p_sync and (s."CO_AREA" <> p_area or s."TP_SITUACAO" <> 'EM_ANDAMENTO')) then
    raise exception 'Carga % já fechada ou de outra área', p_sync using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.tmp_entrevista_lote (
    chave text, unidade text, edital text, vaga text, candidato text, codigo text,
    modalidade text, cargo text, nota numeric, parecer text, compareceu text,
    link text, notas jsonb
  ) on commit drop;
  truncate pg_temp.tmp_entrevista_lote;

  insert into pg_temp.tmp_entrevista_lote
  select distinct on (x.chave) x.*
    from (
      select
        p_area || '|' || coalesce(private."FC_NUMERO_EDITAL"(l.edital), lower(l.edital)) || '|' || l.vaga || '|' ||
          coalesce(nullif(l.codigo, ''), 'nome:' || private."FC_TEXTO_BUSCA_RECURSO"(l.candidato)) as chave,
        l.unidade, l.edital, l.vaga, l.candidato, nullif(l.codigo, '') as codigo,
        nullif(array_to_string(array(
          select btrim(t) from unnest(string_to_array(replace(coalesce(l.modalidade, ''), '"', ''), ',')) t
           where btrim(t) <> ''), ' / '), '') as modalidade,
        nullif(l.cargo, '') as cargo,
        case when l.nota ~ '^-?\d+([.,]\d+)?$' then replace(l.nota, ',', '.')::numeric end as nota,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ '(inapto|reprovad|nao apto)' then 'INAPTO'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ 'apto' then 'APTO'
          else 'SEM_PARECER' end as parecer,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(nao|n|ausente|faltou)' then 'N'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(sim|s|compareceu|presente)' then 'S'
          end as compareceu,
        nullif(l.link, '') as link,
        coalesce(l.notas, '[]'::jsonb) as notas
      from jsonb_to_recordset(p_linhas) as l(
        unidade text, edital text, vaga text, candidato text, codigo text, modalidade text,
        cargo text, nota text, parecer text, compareceu text, link text, notas jsonb)
      where btrim(coalesce(l.candidato, '')) <> ''
        and btrim(coalesce(l.vaga, '')) <> ''
        and btrim(coalesce(l.edital, '')) <> ''
    ) x
   order by x.chave;

  insert into public."TB_ENTREVISTA" as e (
    "CO_AREA", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO",
    "DS_MODALIDADE", "NO_CARGO", "VL_NOTA_TOTAL", "TP_PARECER", "ST_COMPARECEU",
    "DS_LINK_PLANILHA", "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_SYNC", "ST_ATIVO")
  select p_area, left(coalesce(t.unidade, ''), 200), left(t.edital, 120), left(t.vaga, 60),
         left(t.candidato, 200), left(t.codigo, 60), left(t.modalidade, 300), left(t.cargo, 400),
         t.nota, t.parecer, t.compareceu, left(t.link, 500), 'planilha', t.chave, p_sync, 'S'
    from pg_temp.tmp_entrevista_lote t
  on conflict ("DS_CHAVE_ORIGEM") do update set
    "NO_UNIDADE" = excluded."NO_UNIDADE",
    "DS_EDITAL" = excluded."DS_EDITAL",
    "NO_CANDIDATO" = excluded."NO_CANDIDATO",
    "CO_CANDIDATO" = excluded."CO_CANDIDATO",
    "DS_MODALIDADE" = excluded."DS_MODALIDADE",
    "NO_CARGO" = excluded."NO_CARGO",
    "VL_NOTA_TOTAL" = excluded."VL_NOTA_TOTAL",
    "TP_PARECER" = excluded."TP_PARECER",
    "ST_COMPARECEU" = excluded."ST_COMPARECEU",
    "DS_LINK_PLANILHA" = excluded."DS_LINK_PLANILHA",
    "CO_SYNC" = excluded."CO_SYNC",
    "ST_ATIVO" = 'S',
    "DT_ATUALIZACAO" = now()
  where e."TP_ORIGEM" = 'planilha';

  -- Notas: upsert por ordem; ordem que sumiu fica com nota nula (nada é apagado).
  with n as (
    select e."CO_ENTREVISTA", (c.ord)::smallint as ordem,
           left(private."FC_CRITERIO_ENTREVISTA"(c.item->>'criterio'), 600) as criterio,
           case when (c.item->>'nota') ~ '^-?\d+([.,]\d+)?$' then replace(c.item->>'nota', ',', '.')::numeric end as nota
      from pg_temp.tmp_entrevista_lote t
      join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
      cross join lateral jsonb_array_elements(t.notas) with ordinality c(item, ord)
     where c.ord between 1 and 20 and btrim(coalesce(c.item->>'criterio', '')) <> ''
  )
  insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
  select "CO_ENTREVISTA", ordem, criterio, nota from n
  on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set
    "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA"
  -- Só a nota que mudou (20261009110000): a carga de hora em hora regravava todas
  -- (~100 mil linhas/dia, ~45 MB/dia de WAL que o Realtime decodifica).
  where ("TB_ENTREVISTA_NOTA"."DS_CRITERIO", "TB_ENTREVISTA_NOTA"."VL_NOTA")
        is distinct from (excluded."DS_CRITERIO", excluded."VL_NOTA");

  update public."TB_ENTREVISTA_NOTA" en set "VL_NOTA" = null
    from pg_temp.tmp_entrevista_lote t
    join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
   where en."CO_ENTREVISTA" = e."CO_ENTREVISTA"
     and en."NU_ORDEM" > (select count(*) from jsonb_array_elements(t.notas) x
                           where btrim(coalesce(x->>'criterio', '')) <> '')
     and en."VL_NOTA" is not null;

  select count(*) into v_qt from pg_temp.tmp_entrevista_lote;
  update public."TL_SYNC_ENTREVISTA" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt);
end;
$function$;

-- 3. Comentários que faltavam em objetos novos (catálogo corporativo, MAD) --------------------
comment on function private."FC_CODIGO_DE_COORDENACAO"(text) is
  'Código livre para uma coordenação nova a partir do nome: minúsculas sem acento, hífen no lugar do resto, até 60 caracteres, com sufixo numérico se já existir em TB_COORDENACAO.';
comment on function private."FC_COORDENACAO_JSON"(text) is
  'Coordenação em JSON (código, nome, área, responsável, ativo, revisão, unidades e editais), como a tela de Acessos e o histórico TH_COORDENACAO a usam.';
comment on function private."FC_DEFINIR_AREA_ANALISE"() is
  'Gatilho de TB_ANALISE_CURRICULAR: preenche CO_AREA pela área cujo NO_GRUPO_PLANILHA corresponde ao grupo da linha.';
comment on function private."FC_DEFINIR_AREA_EDITAL"() is
  'Gatilho de TB_MONITORAMENTO_INDIGENA: define CO_AREA na inclusão (por responsável e unidade) e o recalcula quando eles mudam; mudança explícita de CO_AREA é respeitada.';
comment on function private."FC_EXIGIR_GESTAO_DO_USUARIO"(public."TB_PERFIL_USUARIO") is
  'Recusa (42501) a alteração de acesso quando quem pede não pode gerir o usuário alvo: o próprio acesso, ou coordenador fora da sua coordenação.';
comment on function private."FC_EXIGIR_GESTOR_DE_ACESSOS"() is
  'Devolve o papel de gestor de acessos (admin ou coordenador) ou recusa (42501) quem não é nenhum dos dois.';
comment on function private."FC_GESTOR_DE_ACESSOS"() is
  'Papel de quem gerencia acessos: admin (administrador global), coordenador (com coordenação e acessos nível 2) ou nulo.';
comment on function private."FC_GRUPOS_ANALISES_DA_AREA"(text) is
  'Grupos da planilha de análises da área (TB_AREA.NO_GRUPO_PLANILHA), depois de conferir que a área existe e que o usuário pode vê-la.';
comment on function private."FC_GRUPO_ACESSO_JSON"(text) is
  'Grupo de acesso em JSON (código, nome, descrição, sistema, admin global, ordem, revisão, níveis por recurso e usuários), como a tela de Acessos e o histórico TH_GRUPO_ACESSO o usam.';
comment on function private."FC_GRUPO_CABE_NO_TETO"(text) is
  'Verdadeiro se quem pede pode atribuir o grupo: administrador global, ou grupo não admin cujos níveis não passam do teto do gestor (FC_TETO_DO_GESTOR).';
comment on function private."FC_RANK_NIVEL"(text) is
  'Ordem numérica do nível de acesso para comparação: admin 3, editor 2, leitor 1, outro 0.';
comment on function private."FC_TETO_DO_GESTOR"(text) is
  'Nível máximo que o gestor pode conceder no recurso: admin para o administrador global; sem_acesso em acessos e áreas; senão o próprio nível dele no recurso.';

comment on column private."TA_CANDIDATO_APROVADO_AREA"."CO_AREA" is 'Área do pacote (TB_AREA.CO_AREA).';
comment on column private."TA_PAINEL_ANALISE"."CO_AREA" is 'Área do pacote (TB_AREA.CO_AREA).';
comment on column private."TA_PAINEL_ANALISE"."TP_ESCOPO" is 'Escopo do pacote: ativo, inativo ou desativadas.';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."CO_ANEXO" is 'Identificador do anexo.';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."CO_CANDIDATO" is 'Candidato da lista de aprovados (TB_CANDIDATO_APROVADO.id).';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."CO_USUARIO_INCLUSAO" is 'Usuário (auth.uid()) que anexou.';
comment on column public."TB_ANEXO_CANDIDATO_APROVADO"."DT_INCLUSAO" is 'Quando foi anexado.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."CO_MODELO" is 'Modelo de convocação da categoria (TB_MODELO_CONVOCACAO).';
comment on column public."TB_CATEGORIA_CONVOCACAO"."NO_CATEGORIA" is 'Nome da categoria como aparece na tela e no quadro de vagas.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."SG_CATEGORIA" is 'Sigla da categoria (até 10 caracteres), usada nas colunas do quadro.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."NU_ORDEM" is 'Ordem da categoria dentro do modelo.';
comment on column public."TB_CONVOCACAO_EDITAL"."CO_MODELO" is 'Modelo de convocação usado pelo edital (TB_MODELO_CONVOCACAO).';
comment on column public."TB_CONVOCACAO_EDITAL"."CO_USUARIO_ATUALIZACAO" is 'Usuário (auth.uid()) da última alteração.';
comment on column public."TB_CONVOCACAO_EDITAL"."DT_CRIACAO" is 'Quando a ligação foi criada.';
comment on column public."TB_CONVOCACAO_EDITAL"."DT_ATUALIZACAO" is 'Quando a ligação foi alterada pela última vez.';
comment on column public."TB_MODELO_CONVOCACAO"."CO_MODELO" is 'Identificador do modelo.';
comment on column public."TB_MODELO_CONVOCACAO"."NO_MODELO" is 'Nome do modelo; identifica a regra (ex.: Lei 15.142/2025 - 25/3/2 e 5% PCD).';
comment on column public."TB_MODELO_CONVOCACAO"."CO_USUARIO_ATUALIZACAO" is 'Usuário (auth.uid()) da última alteração.';
comment on column public."TB_MODELO_CONVOCACAO"."DT_CRIACAO" is 'Quando o modelo foi criado.';
comment on column public."TB_MODELO_CONVOCACAO"."DT_ATUALIZACAO" is 'Quando o modelo foi alterado pela última vez.';
comment on column public."TB_VAGA_IMEDIATA"."CO_EDITAL" is 'Identificador do edital em TB_MONITORAMENTO_INDIGENA, como texto.';
comment on column public."TB_VAGA_IMEDIATA"."NO_CARGO" is 'Cargo da vaga, como veio na lista de aprovados.';
comment on column public."TB_VAGA_IMEDIATA"."CO_USUARIO_ATUALIZACAO" is 'Usuário (auth.uid()) da última alteração.';
comment on column public."TB_VAGA_IMEDIATA"."DT_CRIACAO" is 'Quando a linha foi criada.';
comment on column public."TB_VAGA_IMEDIATA"."DT_ATUALIZACAO" is 'Quando a linha foi alterada pela última vez.';
comment on column public."TH_COORDENACAO"."CO_HISTORICO" is 'Identificador do registro de histórico (sequencial).';
comment on column public."TH_COORDENACAO"."CO_COORDENACAO" is 'Coordenação alterada (TB_COORDENACAO).';
comment on column public."TH_COORDENACAO"."CO_ALTERADO_POR" is 'Usuário (auth.uid()) que fez a alteração.';
comment on column public."TH_COORDENACAO"."DT_ALTERACAO" is 'Quando a alteração foi feita.';
comment on column public."TH_COORDENACAO"."DS_MOTIVO" is 'Motivo informado na alteração.';
comment on column public."TH_GRUPO_ACESSO"."CO_HISTORICO" is 'Identificador do registro de histórico (sequencial).';
comment on column public."TH_GRUPO_ACESSO"."CO_GRUPO_ACESSO" is 'Grupo de acesso alterado (TB_GRUPO_ACESSO).';
comment on column public."TH_GRUPO_ACESSO"."CO_ALTERADO_POR" is 'Usuário (auth.uid()) que fez a alteração.';
comment on column public."TH_GRUPO_ACESSO"."DT_ALTERACAO" is 'Quando a alteração foi feita.';
comment on column public."TH_GRUPO_ACESSO"."DS_MOTIVO" is 'Motivo informado na alteração.';

commit;
