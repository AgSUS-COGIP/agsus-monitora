/*
  Robôs mais robustos (varredura de 22/10/2026).

  1. private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(workflow): o GitHub Actions guarda
     uma só execução esperando por grupo de concorrência; um pedido novo
     cancela, sem aviso, a que esperava. A função diz se já há uma execução
     esperando: há uma rodando no grupo (TL_SYNC_EMPREGARE, TL_PRE_CLASSIFICACAO,
     TL_CONFERENCIA, TL_SYNC_ENTREVISTA ou TL_SYNC_SELECAO sem fim, das últimas
     3 h) e um pedido do banco (TL_DISPARO_ROBO, PEDIDO/ACEITO) mais novo que o
     pedido que a pôs para rodar. Grupo "empregare": robo-empregare.yml e
     leitura-de-arquivos.yml (mesmo concurrency.group nos dois workflows, para
     a leitura não baixar anexo que a carga está trocando). A leitura não tem
     tabela de execução: enquanto só ela roda, o banco não vê a fila (o GitHub
     continua segurando o pedido; só o segundo pedido não é barrado).
  2. disparar_robo: recusa (55006) quando FC_EXECUCAO_PENDENTE_NO_GRUPO diz que
     já há uma execução esperando; no robô da Empregare, o modo Só anexos passa
     a contar como modo que grava (salvo "só comparar"): edital ou vaga de
     edital com inscrições congeladas dão 55000, salvo forcar_congelado com
     motivo do administrador global (a liberação vai ao workflow como antes).
  3. gravar_anexos_empregare: confere a trava das inscrições congeladas (como
     FC_EMPREGARE_ABRIR_VAGA na carga): só a execução que registrou o uso da
     liberação (registrar_uso_liberacao_congelamento) grava respostas e anexos
     de vaga de edital congelado; as demais recebem 55000.
  4. gravar_leituras_de_arquivos: a leitura pode dizer de qual arquivo é
     (hash_link_arquivo = sha256 do arquivo= do link baixado, como
     FC_ARQUIVO_DO_LINK_EMPREGARE; o nome do arquivo não viaja);
     se o anexo gravado já é outro (o robô trocou durante a leitura), a leitura
     fica de fora (conta em "fora" e no novo "trocadas"). Sem hash_link_arquivo
     (robô antigo), grava como antes.
  5. registrar_disparo_externo e CK_DISPROBO_NOWORKFLOW: entra
     leitura-de-arquivos.yml (o workflow passa a registrar a execução iniciada
     no GitHub); expurgo-anexos-chat.yml sai da lista da função (o workflow não
     existe mais) e fica na constraint só pelas linhas antigas do log.

  Python: scripts/robo-empregare/ (robo_empregare.py, so_anexos.py,
  leitura_de_arquivos.py), python/monitora/disparo_externo.py e os workflows.
  Rollback: supabase/rollback/20261022170000_robos_mais_robustos.sql.
  Ensaio: supabase/ensaios/20261022170000_robos_mais_robustos.sql.
*/
begin;

-- 1. Execução esperando no grupo de concorrência do GitHub -------------------
create or replace function private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(p_workflow text)
returns boolean
language plpgsql
stable
set search_path = ''
as $function$
declare
  -- Mesmo concurrency.group nos workflows (robo-empregare.yml e leitura-de-arquivos.yml: "empregare").
  v_grupo constant text[] := case
    when p_workflow in ('robo-empregare.yml', 'leitura-de-arquivos.yml')
      then array['robo-empregare.yml', 'leitura-de-arquivos.yml']
    else array[p_workflow] end;
  v_inicio timestamptz;
  v_tipo text;
  v_proprio timestamptz;
begin
  -- A execução que está rodando no grupo: a mais recente sem fim das últimas 3 h (o job tem até
  -- 120 min; execução mais velha sem fim morreu sem fechar).
  select x.inicio, x.tipo
    into v_inicio, v_tipo
    from (
      select s."DT_INICIO" as inicio, s."TP_DISPARO" as tipo
        from public."TL_SYNC_EMPREGARE" s
       where 'robo-empregare.yml' = any (v_grupo) and s."DT_FIM" is null
      union all
      select p."DT_INICIO", p."TP_DISPARO"::text
        from public."TL_PRE_CLASSIFICACAO" p
       where p_workflow = 'pre-classificacao.yml' and p."DT_FIM" is null
      union all
      select c."DT_INICIO", c."TP_DISPARO"
        from public."TL_CONFERENCIA" c
       where p_workflow = 'conferencias.yml' and c."DT_FIM" is null
      union all
      select e."DT_INICIO", null
        from public."TL_SYNC_ENTREVISTA" e
       where p_workflow = 'sincronizar-entrevistas.yml' and e."DT_FIM" is null
      union all
      select s."DT_INICIO", null
        from public."TL_SYNC_SELECAO" s
       where p_workflow = 'sincronizar-selecao.yml' and s."DT_FIM" is null
    ) x
   where x.inicio > now() - interval '3 hours'
   order by x.inicio desc
   limit 1;
  if v_inicio is null then
    return false;
  end if;

  -- O pedido do banco que pôs essa execução para rodar: o último antes do início (até 15 min
  -- antes, o tempo de preparar o job). Execução iniciada no GitHub ou pelo fim do robô não
  -- veio de pedido do banco.
  if coalesce(v_tipo, 'MONITORA') in ('MONITORA', 'AGENDA') then
    select max(d."DT_DISPARO")
      into v_proprio
      from public."TL_DISPARO_ROBO" d
     where d."NO_WORKFLOW" = any (v_grupo)
       and d."TP_ORIGEM" <> 'GITHUB'
       and d."TP_SITUACAO" in ('PEDIDO', 'ACEITO')
       and d."DT_DISPARO" <= v_inicio
       and d."DT_DISPARO" > v_inicio - interval '15 minutes';
  end if;

  -- Pedido mais novo que esse, ainda sem execução: é o que está esperando a vez.
  return exists (
    select 1
      from public."TL_DISPARO_ROBO" d
     where d."NO_WORKFLOW" = any (v_grupo)
       and d."TP_ORIGEM" <> 'GITHUB'
       and d."TP_SITUACAO" in ('PEDIDO', 'ACEITO')
       and d."DT_DISPARO" > coalesce(v_proprio, v_inicio));
end;
$function$;

revoke all on function private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(text) from public, anon, authenticated;
comment on function private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(text) is
  'Há execução esperando no grupo de concorrência do GitHub (uma rodando e um pedido do banco mais novo que o dela)? disparar_robo recusa o pedido novo, que cancelaria a que espera (20261022170000).';

-- 5. leitura-de-arquivos.yml no log dos disparos -----------------------------
alter table public."TL_DISPARO_ROBO" drop constraint if exists "CK_DISPROBO_NOWORKFLOW";
alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check (
  "NO_WORKFLOW" = any (array['sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml',
                             'expurgo-anexos-chat.yml', 'robo-empregare.yml', 'pre-classificacao.yml',
                             'leitura-de-arquivos.yml']));

-- 2. disparar_robo -----------------------------------------------------------
create or replace function public.disparar_robo(p_robo text, p_inputs jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c_robos constant jsonb := jsonb_build_object(
    'empregare', jsonb_build_object('nome', 'Robô da Empregare', 'workflow', 'robo-empregare.yml',
      'modos', jsonb_build_array('normal', 'seco', 'fumaca', 'forcar', 'sondar', 'anexos'),
      'editais', 'numero', 'vagas', true, 'limite', true, 'anexos', true, 'candidatos', true, 'seco', true,
      'forcar_congelado', true, 'motivo', true, 'modos_que_gravam', jsonb_build_array('normal', 'forcar'),
      'modos_que_gravam_sem_seco', jsonb_build_array('anexos')),
    'selecao', jsonb_build_object('nome', 'Seleção', 'workflow', 'sincronizar-selecao.yml',
      'modos', jsonb_build_array('normal')),
    'entrevistas', jsonb_build_object('nome', 'Entrevistas', 'workflow', 'sincronizar-entrevistas.yml',
      'modos', jsonb_build_array('normal')),
    'conferencias', jsonb_build_object('nome', 'Conferências de consistência', 'workflow', 'conferencias.yml',
      'modos', jsonb_build_array('normal', 'seco')),
    'pre_classificacao', jsonb_build_object('nome', 'Pré-classificação (Avaliação documental)', 'workflow', 'pre-classificacao.yml',
      'modos', jsonb_build_array('normal', 'seco', 'refazer_lote'),
      'editais', 'numero_ou_id', 'por_edital', true,
      'forcar_congelado', true, 'motivo', true, 'modos_que_gravam', jsonb_build_array('normal', 'refazer_lote')));
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_uid uuid := (select auth.uid());
  v_robo jsonb := c_robos -> p_robo;
  v_in jsonb := coalesce(p_inputs, '{}'::jsonb);
  v_chave text;
  v_valor jsonb;
  v_itens text[];
  v_item text;
  v_modo text;
  v_editais text[] := '{}';
  v_vagas text[] := '{}';
  v_candidatos text[] := '{}';
  v_limite integer;
  v_anexos boolean;
  v_seco boolean;
  v_saida jsonb;
  v_forcar_congelado boolean := false;
  v_motivo text;
  v_congelados uuid[] := '{}';
  v_rotulos text;
  v_liberacao uuid;
  v_disparo bigint;
  v_grava boolean;
begin
  if v_uid is null then
    raise exception 'Entre no MONITORA de novo para rodar a carga.' using errcode = '28000';
  end if;
  if v_robo is null then
    raise exception 'Carga desconhecida.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_in) <> 'object' then
    raise exception 'Opções inválidas.' using errcode = '22023';
  end if;

  -- Opção que o robô não aceita (vazia passa, como em validarOpcoes).
  for v_chave, v_valor in select * from jsonb_each(v_in) loop
    if v_chave not in ('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado', 'motivo')
       or (v_chave <> 'modo' and v_robo -> v_chave is null
           and not (jsonb_typeof(v_valor) = 'null'
                    or v_valor in ('""'::jsonb, '[]'::jsonb, 'false'::jsonb, '"false"'::jsonb))) then
      raise exception '% não aceita “%”.', v_robo ->> 'nome', left(v_chave, 30) using errcode = '22023';
    end if;
  end loop;

  -- Modo
  if jsonb_typeof(v_in -> 'modo') not in ('string', 'null') then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;
  v_modo := coalesce(nullif(btrim(v_in ->> 'modo'), ''), 'normal');
  if not ((v_robo -> 'modos') ? v_modo) then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;

  -- Editais: número (93/2026) ou, na pré-classificação, também o id.
  if v_robo ? 'editais' and coalesce(jsonb_typeof(v_in -> 'editais'), 'null') <> 'null' then
    v_valor := v_in -> 'editais';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Edital inválido.' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := string_to_array(v_valor #>> '{}', ',');
    else
      raise exception 'Edital inválido.' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if lower(v_item) ~ c_uuid and v_robo ->> 'editais' = 'numero_ou_id' then
        v_item := lower(v_item);
      elsif v_item !~ '^\d{1,4}/\d{4}$' then
        raise exception 'Edital inválido: %.', left(v_item, 40) using errcode = '22023';
      end if;
      if not v_item = any (v_editais) then
        v_editais := v_editais || v_item;
      end if;
    end loop;
    if cardinality(v_editais) > 100 then
      raise exception 'No máximo 100 editais por vez.' using errcode = '22023';
    end if;
  end if;

  -- Vagas: códigos da Empregare, só dígitos.
  if v_robo ? 'vagas' and coalesce(jsonb_typeof(v_in -> 'vagas'), 'null') <> 'null' then
    v_valor := v_in -> 'vagas';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de vaga inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_vagas) then
        v_vagas := v_vagas || v_item;
      end if;
    end loop;
    if cardinality(v_vagas) > 500 then
      raise exception 'No máximo 500 vagas por vez.' using errcode = '22023';
    end if;
  end if;

  -- Candidatos (modo anexos): códigos da Empregare, só dígitos.
  if v_robo ? 'candidatos' and coalesce(jsonb_typeof(v_in -> 'candidatos'), 'null') <> 'null' then
    v_valor := v_in -> 'candidatos';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de candidato inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_candidatos) then
        v_candidatos := v_candidatos || v_item;
      end if;
    end loop;
    if cardinality(v_candidatos) > 1000 then
      raise exception 'No máximo 1.000 candidatos por vez.' using errcode = '22023';
    end if;
  end if;

  -- Limite: 1 a 500 vagas.
  if v_robo ? 'limite' and coalesce(jsonb_typeof(v_in -> 'limite'), 'null') <> 'null'
     and btrim(v_in ->> 'limite') <> '' then
    if btrim(v_in ->> 'limite') !~ '^\d{1,3}$'
       or (btrim(v_in ->> 'limite'))::integer not between 1 and 500 then
      raise exception 'Limite de 1 a 500 vagas.' using errcode = '22023';
    end if;
    v_limite := (btrim(v_in ->> 'limite'))::integer;
  end if;

  -- Anexos (robô da Empregare): true/false ou "true"/"false"; só nos modos normal e forcar.
  if v_robo ? 'anexos' and coalesce(jsonb_typeof(v_in -> 'anexos'), 'null') <> 'null' then
    if v_in -> 'anexos' in ('true'::jsonb, '"true"'::jsonb) then
      v_anexos := true;
    elsif v_in -> 'anexos' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_anexos := false;
    else
      raise exception 'Opção “anexos” inválida (sim ou não).' using errcode = '22023';
    end if;
    if v_anexos and v_modo not in ('normal', 'forcar') then
      raise exception 'Guardar os links dos anexos só nos modos Normal e Forçar.' using errcode = '22023';
    end if;
  end if;

  -- Seco (modo anexos): true/false ou "true"/"false".
  if v_robo ? 'seco' and coalesce(jsonb_typeof(v_in -> 'seco'), 'null') <> 'null' then
    if v_in -> 'seco' in ('true'::jsonb, '"true"'::jsonb) then
      v_seco := true;
    elsif v_in -> 'seco' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_seco := false;
    else
      raise exception 'Opção “seco” inválida (sim ou não).' using errcode = '22023';
    end if;
  end if;

  -- Forçar edital congelado (20261020170000): true/false ou "true"/"false", com motivo.
  if v_robo ? 'forcar_congelado' and coalesce(jsonb_typeof(v_in -> 'forcar_congelado'), 'null') <> 'null' then
    if v_in -> 'forcar_congelado' in ('true'::jsonb, '"true"'::jsonb) then
      v_forcar_congelado := true;
    elsif v_in -> 'forcar_congelado' not in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      raise exception 'Opção “forcar_congelado” inválida (sim ou não).' using errcode = '22023';
    end if;
  end if;
  if v_robo ? 'motivo' and coalesce(jsonb_typeof(v_in -> 'motivo'), 'null') <> 'null' then
    if jsonb_typeof(v_in -> 'motivo') <> 'string' then
      raise exception 'Motivo inválido.' using errcode = '22023';
    end if;
    v_motivo := nullif(btrim(v_in ->> 'motivo'), '');
  end if;
  if v_motivo is not null and not v_forcar_congelado then
    raise exception 'O motivo só vale com “Forçar edital com inscrições congeladas”.' using errcode = '22023';
  end if;

  -- Só anexos: relê os anexos do questionário sem exportar; pede vagas ou editais.
  if v_modo = 'anexos' then
    if cardinality(v_vagas) = 0 and cardinality(v_editais) = 0 then
      raise exception 'O modo Só anexos pede vagas ou editais.' using errcode = '22023';
    end if;
  elsif cardinality(v_candidatos) > 0 or coalesce(v_seco, false) then
    raise exception 'Candidatos e "só comparar" só no modo Só anexos.' using errcode = '22023';
  end if;

  -- Sondar (como o workflow exige): uma única vaga, sem editais, limite de 1 a 3 candidatos.
  if v_modo = 'sondar' then
    if cardinality(v_vagas) <> 1 or cardinality(v_editais) > 0 then
      raise exception 'O modo Sondar pede um único código de vaga (sem editais).' using errcode = '22023';
    end if;
    if v_limite is not null and v_limite > 3 then
      raise exception 'No modo Sondar, o limite é de 1 a 3 candidatos.' using errcode = '22023';
    end if;
  end if;

  -- Quem pode (o banco decide, como em api/rodar-carga.js).
  if not public.pode_disparar_carga() then
    if not coalesce((v_robo ->> 'por_edital')::boolean, false) then
      raise exception 'Só o administrador global roda as cargas.' using errcode = '42501';
    end if;
    if v_modo <> 'normal' or cardinality(v_vagas) > 0 or v_limite is not null or v_forcar_congelado
       or cardinality(v_editais) <> 1 or v_editais[1] !~ c_uuid then
      raise exception 'Só o administrador global roda as cargas com opções.' using errcode = '42501';
    end if;
    if not public.pode_recalcular_pre_classificacao(v_editais[1]::uuid) then
      raise exception 'Só a coordenação da avaliação do edital recalcula a pré-classificação.' using errcode = '42501';
    end if;
  end if;

  -- Duplo clique: o mesmo robô pedido há menos de 2 min (e ainda não recusado).
  if exists (
    select 1 from public."TL_DISPARO_ROBO" d
     where d."NO_WORKFLOW" = v_robo ->> 'workflow'
       and d."TP_SITUACAO" in ('PEDIDO', 'ACEITO')
       and d."DT_DISPARO" > now() - interval '2 minutes') then
    raise exception 'Esta carga acabou de ser pedida. Aguarde alguns minutos.' using errcode = '55006';
  end if;

  -- [pendente-no-grupo] (20261022170000) O GitHub guarda UMA execução esperando por grupo de
  -- concorrência: um pedido novo cancela, sem aviso, o que já esperava. Com uma execução
  -- rodando e outra já pedida depois dela, recusa em vez de trocar uma pela outra.
  if private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(v_robo ->> 'workflow') then
    raise exception 'Já há uma execução desta carga esperando a que está rodando terminar; um pedido novo cancelaria aquela. Aguarde.'
      using errcode = '55006';
  end if;

  -- [congeladas] Inscrições congeladas (20261020170000): nos modos que gravam, o edital ou a
  -- vaga pedidos explicitamente de edital congelado são recusados; o administrador global
  -- pode forçar, com motivo (a LIBERACAO vale 12 h e vai ao workflow como forcar_congelado).
  -- Sem edital nem vaga, o robô e a pré-classificação pulam os congelados sozinhos.
  -- (20261022170000) O Só anexos grava também (respostas e anexos): só com a liberação, ou
  -- com "só comparar" (seco), que não grava nada.
  v_grava := (v_robo -> 'modos_que_gravam') ? v_modo
             or ((v_robo -> 'modos_que_gravam_sem_seco') ? v_modo and not coalesce(v_seco, false));
  if v_grava then
    select coalesce(array_agg(distinct m.id), '{}'),
           string_agg(distinct coalesce(private."FC_NUMERO_EDITAL"(m.edital), m.edital), ', ')
      into v_congelados, v_rotulos
      from public."TB_CONGELAMENTO_INSCRICAO" c
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c."CO_MONITORAMENTO"
     where c."ST_INSCRICOES_CONGELADAS" = 'S'
       and (m.id::text = any (v_editais)
            or private."FC_NUMERO_EDITAL"(m.edital) = any (v_editais)
            or exists (select 1 from public."TB_EMPREGARE_VAGA" v
                        where v."CO_MONITORAMENTO" = m.id and v."CO_VAGA" = any (v_vagas)));
    if cardinality(v_congelados) > 0 and not v_forcar_congelado and v_modo = 'anexos' then
      raise exception 'Inscrições congeladas: %. O Só anexos só grava neste edital com a liberação do administrador global (com motivo); para conferir sem gravar, use "só comparar".', v_rotulos
        using errcode = '55000';
    end if;
    if cardinality(v_congelados) > 0 and not v_forcar_congelado then
      raise exception 'Inscrições congeladas: %. O robô e a pré-classificação não mexem neste edital; tire-o do pedido (só o administrador global força, com motivo).', v_rotulos
        using errcode = '55000';
    end if;
    if v_forcar_congelado then
      if not public.pode_disparar_carga() then
        raise exception 'Só o administrador global força edital com inscrições congeladas.' using errcode = '42501';
      end if;
      if v_motivo is null or length(v_motivo) not between 10 and 500 then
        raise exception 'Informe o motivo para forçar (10 a 500 caracteres).' using errcode = '22023';
      end if;
      if cardinality(v_congelados) = 0 then
        raise exception 'Nenhum edital ou vaga pedida está com as inscrições congeladas.' using errcode = '22023';
      end if;
      v_liberacao := gen_random_uuid();
      insert into public."TH_CONGELAMENTO_INSCRICAO"
             ("CO_MONITORAMENTO", "TP_EVENTO", "DS_MOTIVO", "CO_USUARIO", "CO_LIBERACAO", "DT_VALIDADE")
      select x, 'LIBERACAO', v_motivo, v_uid, v_liberacao, now() + interval '12 hours'
        from unnest(v_congelados) x;
    end if;
  elsif v_forcar_congelado then
    raise exception 'Forçar edital congelado só nos modos que gravam (no Só anexos, sem "só comparar").' using errcode = '22023';
  end if;

  v_saida := jsonb_build_object('modo', v_modo);
  if coalesce((v_robo ->> 'por_edital')::boolean, false) or cardinality(v_editais) > 0 then
    v_saida := v_saida || jsonb_build_object('editais', array_to_string(v_editais, ','));
  end if;
  if cardinality(v_vagas) > 0 then
    v_saida := v_saida || jsonb_build_object('vagas', array_to_string(v_vagas, ','));
  end if;
  if v_limite is not null then
    v_saida := v_saida || jsonb_build_object('limite', v_limite::text);
  end if;
  if v_anexos is not null then
    v_saida := v_saida || jsonb_build_object('anexos', case when v_anexos then 'true' else 'false' end);
  end if;
  if cardinality(v_candidatos) > 0 then
    v_saida := v_saida || jsonb_build_object('candidatos', array_to_string(v_candidatos, ','));
  end if;
  if v_modo = 'anexos' then
    v_saida := v_saida || jsonb_build_object('seco', case when coalesce(v_seco, false) then 'true' else 'false' end);
  end if;

  if v_liberacao is not null then
    v_saida := v_saida || jsonb_build_object('forcar_congelado', v_liberacao::text);
  end if;

  v_disparo := private."FC_DISPARAR_ROBO"(v_robo ->> 'workflow', v_saida, v_uid);
  if v_liberacao is not null then
    update public."TH_CONGELAMENTO_INSCRICAO" h set "CO_DISPARO" = v_disparo
     where h."CO_LIBERACAO" = v_liberacao and h."TP_EVENTO" = 'LIBERACAO';
  end if;
  return v_disparo;
end;
$function$;

-- 3. gravar_anexos_empregare -------------------------------------------------
create or replace function public.gravar_anexos_empregare(p_sync text, p_vaga text, p_respostas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_r jsonb;
  v_cand uuid;
  v_resp uuid;
  v_impressao text;
  v_respostas integer := 0;
  v_anexos integer := 0;
  v_qt integer;
  v_sem_candidato integer := 0;
  v_antigos jsonb;
  v_apagadas integer;
  v_invalidadas integer := 0;
  v_edital uuid;
begin
  perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  -- [congeladas-anexos] (20261022170000) Edital com inscrições congeladas: só a execução que
  -- registrou o uso da liberação do administrador global grava respostas e anexos (vale para
  -- a carga e para o modo Só anexos, que antes passava).
  select v."CO_MONITORAMENTO" into v_edital from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga;
  if v_edital is null then
    select q.edital_id into v_edital from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) q limit 1;
  end if;
  if v_edital is not null and private."FC_INSCRICOES_CONGELADAS"(v_edital)
     and not private."FC_EXECUCAO_LIBERADA_NO_CONGELAMENTO"(p_sync, v_edital) then
    raise exception 'Inscrições congeladas no edital da vaga %: anexos não gravados (só com a liberação do administrador global).', p_vaga
      using errcode = '55000';
  end if;
  if jsonb_typeof(p_respostas) is distinct from 'array' or jsonb_array_length(p_respostas) not between 1 and 500 then
    raise exception 'Envie de 1 a 500 respostas por lote' using errcode = '22023';
  end if;

  for v_r in select x from jsonb_array_elements(p_respostas) x loop
    continue when coalesce(v_r ->> 'resposta', '') !~ '^[0-9]{1,20}$';
    select c."CO_EMPREGARE_CANDIDATO" into v_cand
      from public."TB_EMPREGARE_CANDIDATO" c
     where c."CO_VAGA" = p_vaga and c."CO_CANDIDATO_EMPREGARE" = btrim(v_r ->> 'codigo');
    if v_cand is null then
      v_sem_candidato := v_sem_candidato + 1;
      continue;
    end if;
    -- Link fora do formato vira nulo (impressão) ou fica de fora (anexo).
    v_impressao := case when v_r ->> 'impressao' ~ '^https://corporate\.empregare\.com/Company/VacancyTests/PrintResult\?[A-Za-z0-9_.~=&%|+/:-]+$'
                        and length(v_r ->> 'impressao') <= 1500 then v_r ->> 'impressao' end;
    insert into public."TB_EMPREGARE_RESPOSTA" as x (
      "CO_EMPREGARE_CANDIDATO", "CO_RESPOSTA_QUESTIONARIO", "DS_LINK_IMPRESSAO", "QT_PERGUNTA", "CO_SYNC", "DT_CAPTURA")
    values (v_cand, v_r ->> 'resposta', v_impressao,
            least(greatest(coalesce((v_r ->> 'perguntas')::integer, 0), 0), 10000), p_sync, now())
    on conflict ("CO_EMPREGARE_CANDIDATO", "CO_RESPOSTA_QUESTIONARIO") do update set
      "DS_LINK_IMPRESSAO" = coalesce(excluded."DS_LINK_IMPRESSAO", x."DS_LINK_IMPRESSAO"),
      "QT_PERGUNTA" = excluded."QT_PERGUNTA",
      "CO_SYNC" = excluded."CO_SYNC",
      "DT_CAPTURA" = excluded."DT_CAPTURA"
    returning x."CO_EMPREGARE_RESPOSTA" into v_resp;
    v_respostas := v_respostas + 1;

    -- O arquivo de cada anexo antes da troca ("pergunta:número" → arquivo= do link).
    select coalesce(jsonb_object_agg(a."CO_PERGUNTA_EMPREGARE" || ':' || a."NU_ARQUIVO",
                                     coalesce(private."FC_ARQUIVO_DO_LINK_EMPREGARE"(a."DS_LINK"), a."DS_LINK")), '{}'::jsonb)
      into v_antigos
      from public."TB_EMPREGARE_ANEXO" a
     where a."CO_EMPREGARE_RESPOSTA" = v_resp;

    -- A resposta relida fica só com os anexos lidos agora.
    delete from public."TB_EMPREGARE_ANEXO" a where a."CO_EMPREGARE_RESPOSTA" = v_resp;
    insert into public."TB_EMPREGARE_ANEXO" (
      "CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO", "NU_ORDEM", "DS_ENUNCIADO", "DS_COLUNA", "DS_LINK",
      "DT_CAPTURA")
    select distinct on (an.pergunta, an.arquivo)
           v_resp, an.pergunta, an.arquivo::smallint,
           case when an.ordem between 1 and 999 then an.ordem::smallint end,
           nullif(left(btrim(regexp_replace(an.enunciado, '\s+', ' ', 'g')), 2000), ''),
           nullif(left(btrim(an.coluna), 1000), ''),
           an.link, now()
      from jsonb_to_recordset(coalesce(v_r -> 'anexos', '[]'::jsonb))
           as an(pergunta text, arquivo integer, ordem integer, enunciado text, coluna text, link text)
     where an.pergunta ~ '^[0-9]{1,20}$'
       and an.arquivo between 1 and 50
       and length(an.link) <= 1500
       and an.link ~ '^https://corporate\.empregare\.com/Company/VacancyTests/GetViewerLogArquivo\?[A-Za-z0-9_.~=&%|+/:-]+$'
     order by an.pergunta, an.arquivo;
    get diagnostics v_qt = row_count;
    update public."TB_EMPREGARE_RESPOSTA" set "QT_ANEXO" = v_qt where "CO_EMPREGARE_RESPOSTA" = v_resp;
    v_anexos := v_anexos + v_qt;

    -- Arquivo trocado (ou que não estava gravado) na mesma pergunta e número: a leitura
    -- automática era do arquivo antigo. Sai, e o robô da leitura lê o novo ("nunca lido").
    delete from public."TB_LEITURA_ARQUIVO" l
     using public."TB_EMPREGARE_ANEXO" a
     where l."CO_EMPREGARE_RESPOSTA" = v_resp
       and a."CO_EMPREGARE_RESPOSTA" = v_resp
       and a."CO_PERGUNTA_EMPREGARE" = l."CO_PERGUNTA_EMPREGARE"
       and a."NU_ARQUIVO" = l."NU_ARQUIVO"
       and (v_antigos ->> (a."CO_PERGUNTA_EMPREGARE" || ':' || a."NU_ARQUIVO"))
           is distinct from coalesce(private."FC_ARQUIVO_DO_LINK_EMPREGARE"(a."DS_LINK"), a."DS_LINK");
    get diagnostics v_apagadas = row_count;
    v_invalidadas := v_invalidadas + v_apagadas;
  end loop;

  return jsonb_build_object('recebidas', jsonb_array_length(p_respostas), 'respostas', v_respostas,
                            'anexos', v_anexos, 'sem_candidato', v_sem_candidato,
                            'leituras_invalidadas', v_invalidadas);
end;
$function$;

-- 4. gravar_leituras_de_arquivos ---------------------------------------------
create or replace function public.gravar_leituras_de_arquivos(p_execucao text, p_leituras jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v jsonb;
  v_gravadas integer := 0;
  v_fora integer := 0;
  v_bool text;
  v_trocadas integer := 0;
begin
  if coalesce(p_execucao, '') !~ '^[A-Za-z0-9_.:-]{1,60}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_leituras) is distinct from 'array' or jsonb_array_length(p_leituras) > 200 then
    raise exception 'Envie até 200 leituras por vez' using errcode = '22023';
  end if;
  for v in select x from jsonb_array_elements(p_leituras) x loop
    -- Só anexo que existe (resposta, pergunta, arquivo); o resto é contado e ignorado.
    if coalesce(v ->> 'resposta', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(v ->> 'pergunta', '') !~ '^[0-9]{1,20}$' or coalesce(v ->> 'arquivo', '') !~ '^[0-9]{1,2}$'
       or not exists (select 1 from public."TB_EMPREGARE_ANEXO" a
                       where a."CO_EMPREGARE_RESPOSTA" = (v ->> 'resposta')::uuid
                         and a."CO_PERGUNTA_EMPREGARE" = v ->> 'pergunta'
                         and a."NU_ARQUIVO" = (v ->> 'arquivo')::smallint) then
      v_fora := v_fora + 1;
      continue;
    end if;
    -- [arquivo-trocado] (20261022170000) A leitura diz de qual arquivo é (hash_link_arquivo: sha256
    -- do arquivo= do link baixado). Se o robô da Empregare trocou o anexo enquanto a leitura
    -- rodava, ela é do arquivo antigo: fica de fora e o novo volta para a fila.
    if nullif(v ->> 'hash_link_arquivo', '') is not null and not exists (
         select 1 from public."TB_EMPREGARE_ANEXO" a
          where a."CO_EMPREGARE_RESPOSTA" = (v ->> 'resposta')::uuid
            and a."CO_PERGUNTA_EMPREGARE" = v ->> 'pergunta'
            and a."NU_ARQUIVO" = (v ->> 'arquivo')::smallint
            and encode(sha256(convert_to(coalesce(private."FC_ARQUIVO_DO_LINK_EMPREGARE"(a."DS_LINK"), a."DS_LINK"), 'UTF8')), 'hex')
                = v ->> 'hash_link_arquivo') then
      v_trocadas := v_trocadas + 1;
      v_fora := v_fora + 1;
      continue;
    end if;
    perform private."FC_VALIDAR_LEITURA_ARQUIVO"(v);
    insert into public."TB_LEITURA_ARQUIVO" (
      "CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO", "TP_SITUACAO", "TP_METODO", "TP_FORMATO",
      "TP_DOCUMENTO", "QT_PAGINA", "VL_CONFIANCA_OCR", "ST_NOME_CONFERE", "ST_CPF_CONFERE", "DS_ITEM", "DS_ALERTA",
      "DS_RESUMO", "CO_ERRO", "DS_HASH_ARQUIVO", "NU_VERSAO_EXTRATOR", "CO_EXECUCAO", "DT_LEITURA")
    values (
      (v ->> 'resposta')::uuid, v ->> 'pergunta', (v ->> 'arquivo')::smallint, v ->> 'situacao', v ->> 'metodo',
      v ->> 'formato', v ->> 'documento', (v ->> 'paginas')::numeric::smallint, round((v ->> 'confianca')::numeric, 3),
      case v -> 'nome_confere' when 'true'::jsonb then 'S' when 'false'::jsonb then 'N' end,
      case v -> 'cpf_confere' when 'true'::jsonb then 'S' when 'false'::jsonb then 'N' end,
      coalesce(v -> 'itens', '[]'::jsonb), coalesce(v -> 'alertas', '[]'::jsonb), nullif(v ->> 'resumo', ''),
      v ->> 'erro', v ->> 'hash', v ->> 'versao', p_execucao, now())
    on conflict ("CO_EMPREGARE_RESPOSTA", "CO_PERGUNTA_EMPREGARE", "NU_ARQUIVO") do update set
      "TP_SITUACAO" = excluded."TP_SITUACAO", "TP_METODO" = excluded."TP_METODO", "TP_FORMATO" = excluded."TP_FORMATO",
      "TP_DOCUMENTO" = excluded."TP_DOCUMENTO", "QT_PAGINA" = excluded."QT_PAGINA",
      "VL_CONFIANCA_OCR" = excluded."VL_CONFIANCA_OCR", "ST_NOME_CONFERE" = excluded."ST_NOME_CONFERE",
      "ST_CPF_CONFERE" = excluded."ST_CPF_CONFERE", "DS_ITEM" = excluded."DS_ITEM", "DS_ALERTA" = excluded."DS_ALERTA",
      "DS_RESUMO" = excluded."DS_RESUMO", "CO_ERRO" = excluded."CO_ERRO", "DS_HASH_ARQUIVO" = excluded."DS_HASH_ARQUIVO",
      "NU_VERSAO_EXTRATOR" = excluded."NU_VERSAO_EXTRATOR", "CO_EXECUCAO" = excluded."CO_EXECUCAO",
      "DT_LEITURA" = excluded."DT_LEITURA";
    v_gravadas := v_gravadas + 1;
  end loop;
  return jsonb_build_object('recebidas', jsonb_array_length(p_leituras), 'gravadas', v_gravadas, 'fora', v_fora,
                            'trocadas', v_trocadas);
end;
$function$;

-- 5. registrar_disparo_externo ----------------------------------------------
create or replace function public.registrar_disparo_externo(p_workflow text, p_ator text, p_url text, p_resumo text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ator text := nullif(btrim(coalesce(p_ator, '')), '');
  v_resumo text := nullif(left(btrim(coalesce(p_resumo, '')), 300), '');
  v_disparo bigint;
begin
  if p_workflow is null or p_workflow not in (
       'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml',
       'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml') then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_url is null or length(p_url) > 300
     or p_url !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[0-9]+$' then
    raise exception 'Endereço da execução inválido' using errcode = '22023';
  end if;
  -- Login do GitHub (letras, dígitos, hífen; robôs com [bot]); fora disso, sem ator.
  if v_ator is not null and v_ator !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}(\[bot\])?$' then
    v_ator := null;
  end if;

  insert into public."TL_DISPARO_ROBO"
         ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "NO_ATOR_GITHUB", "DS_URL_EXECUCAO", "DS_MENSAGEM")
  values (p_workflow, 'GITHUB', null, 'INICIADO', v_ator, p_url, v_resumo)
  on conflict ("DS_URL_EXECUCAO") where "TP_ORIGEM" = 'GITHUB' do nothing
  returning "CO_DISPARO" into v_disparo;
  if v_disparo is null then
    select d."CO_DISPARO" into v_disparo
      from public."TL_DISPARO_ROBO" d
     where d."TP_ORIGEM" = 'GITHUB' and d."DS_URL_EXECUCAO" = p_url;
  end if;
  return v_disparo;
end;
$function$;

comment on function public.disparar_robo(text, jsonb) is
  'Rodar agora, Opções (Status das atualizações) e Recalcular (pré-classificação) pelo banco (20261008140000; substitui api/rodar-carga.js): confere quem pede (administrador global: qualquer robô e opções; coordenação: só a pré-classificação de um edital pelo id, modo normal), a lista branca do robô (modo, editais, vagas, limite, anexos; no robô da Empregare o modo "anexos" — só relê os anexos do questionário, sem exportar nem pré-classificar; pede vagas ou editais — com "candidatos" e "seco", que só valem nele), o pedido repetido em 2 min (55006) e, desde 20261022170000, a execução que já espera a vez no grupo de concorrência do GitHub (55006: o pedido novo a cancelaria). Inscrições congeladas (20261020170000): nos modos que gravam (robô: normal, forcar e, desde 20261022170000, anexos sem "seco"; pré-classificação: normal e refazer_lote), edital ou vaga pedidos de edital congelado dão 55000, salvo forcar_congelado = true com motivo (10 a 500), só do administrador global — grava a LIBERACAO em TH_CONGELAMENTO_INSCRICAO (12 h) e manda o token como forcar_congelado. Pede o workflow por FC_DISPARAR_ROBO com disparado_por = id de quem pediu e devolve o CO_DISPARO de TL_DISPARO_ROBO (acompanhe por situacao_do_disparo_robo). 28000 sem sessão, 42501 sem permissão, 22023 para opção inválida.';

commit;
