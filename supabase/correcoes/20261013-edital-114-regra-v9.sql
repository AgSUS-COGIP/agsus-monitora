/*
  CORREÇÃO DE DADOS — ajustes da revisão da regra da avaliação documental do
  Edital 114/2026 (Projetos, PES Rio Doce AgSUS/FUNASA,
  id bcecfb08-88ef-4e06-8401-bcad6bf88fd0).

  PRÉ-REQUISITO: a correção 20261013-edital-114-regra-por-cargo.sql aplicada
  (versão 8, com as diferenças por cargo). Este script não depende do número:
  parte da versão VIGENTE no momento da execução.

  O QUE FAZ: cria uma NOVA versão (vigente + 1), igual à vigente com:
    1. Bloco REQUISITO_DO_CARGO: saem dos motivos de eliminação os textos que
       são orientação e não eliminam:
         - "Cada título será considerado uma única vez..." (8.2.7) e
           "Documentos exigidos como requisito obrigatório não serão
           pontuados..." (8.2.10.5) viram observações prontas da regra
           (TITULO_UMA_VEZ e REQUISITO_SEM_PONTUACAO), com o item do edital;
         - "Pontuação não atribuída devido à ausência do documento
           comprobatório (...alteração de nome...)" (8.2.10.7) vira motivo
           NOME_ALTERADO_SEM_DOCUMENTO (sem efeito de eliminação: justifica a
           pontuação não atribuída) nos blocos FORMACAO, CURSOS e EXPERIENCIA.
    2. Sai do REQUISITO_DO_CARGO o motivo "Não possui experiência mínima de 06
       (seis) meses na área da vaga": a experiência mínima já é conferida
       pelo bloco EXPERIENCIA (minimo_meses / FC_PENDENCIAS_FICHA).
    3. Códigos legíveis no lugar dos genéricos (MOTIVO, MOTIVO_2...), sem
       mudar textos nem itens do edital:
         IDENTIDADE          MOTIVO   -> SEM_IDENTIDADE_6_5
         ESCOLARIDADE        MOTIVO   -> DIPLOMA_ILEGIVEL
                             MOTIVO_2 -> CAMPO_INCORRETO
                             MOTIVO_3 -> FORA_DO_FORMATO
                             MOTIVO_4 -> NOME_ALTERADO_SEM_DOCUMENTO
         REQUISITO_DO_CARGO  MOTIVO_2 -> SEM_DIRECAO_DEFENSIVA (efeito
                             ELIMINA, como SEM_CNH)
       Um código já usado no lançamento de alguma ficha do 114 não é
       renomeado (avisa); um motivo a retirar que já esteja em uso faz o
       script parar sem mudar nada.
  Não recria o bloco da certidão de nascimento (decisão da coordenação).
  Todo o resto (por_cargo, blocos, perguntas, faixas, parecer...) fica igual.
  A situação volta para CONFERIR, como em toda versão nova: a coordenação
  confere na aba Regra (dupla conferência) antes de concluir fichas.

  Rode no SQL Editor (papel postgres). Idempotente: se a regra vigente já tem
  a observação TITULO_UMA_VEZ, não faz nada (avisa). Para ensaiar, troque o
  commit por rollback. Termina com o SELECT de conferência.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_motivo constant text := 'Ajustes da revisão da regra do 114/2026 (motivos que não eliminam, experiência mínima repetida, nomes dos motivos)';
  c_nome constant text := 'Revisão dos motivos';
  -- Renomeações: bloco, código antigo, código novo, começo do texto esperado
  -- (confere que é o mesmo motivo) e efeito novo (null = mantém o que tem).
  c_renomear constant jsonb := $ren$
[
  {"bloco": "IDENTIDADE", "de": "MOTIVO", "para": "SEM_IDENTIDADE_6_5", "texto": "O candidato não apresentou documento de identificação"},
  {"bloco": "ESCOLARIDADE", "de": "MOTIVO", "para": "DIPLOMA_ILEGIVEL", "texto": "Diploma ou certificado ilegível"},
  {"bloco": "ESCOLARIDADE", "de": "MOTIVO_2", "para": "CAMPO_INCORRETO", "texto": "Documentos anexados em campos incorretos"},
  {"bloco": "ESCOLARIDADE", "de": "MOTIVO_3", "para": "FORA_DO_FORMATO", "texto": "Documento em desacordo com formato PDF"},
  {"bloco": "ESCOLARIDADE", "de": "MOTIVO_4", "para": "NOME_ALTERADO_SEM_DOCUMENTO", "texto": "Documentação recusada devido à ausência do documento comprobatório"},
  {"bloco": "REQUISITO_DO_CARGO", "de": "MOTIVO_2", "para": "SEM_DIRECAO_DEFENSIVA", "texto": "Não apresentou o curso de direção defensiva", "efeito": "ELIMINA"}
]
$ren$::jsonb;
  -- Começos dos textos que saem do REQUISITO_DO_CARGO.
  c_txt_experiencia constant text := 'Não possui experiência mínima de 06 (seis) meses';
  c_txt_titulo constant text := 'Cada título será considerado uma única vez';
  c_txt_requisito constant text := 'Documentos exigidos como requisito obrigatório não serão pontuados';
  c_txt_nome constant text := 'Pontuação não atribuída devido à ausência do documento comprobatório';
  v_regra public."TB_REGRA_ANALISE";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
  v_req jsonb;
  m_experiencia jsonb;
  m_titulo jsonb;
  m_requisito jsonb;
  m_nome jsonb;
  v_blocos jsonb := '[]'::jsonb;
  v_b record;
  v_bloco jsonb;
  v_motivos jsonb;
  v_m record;
  v_mot jsonb;
  v_r jsonb;
  v_renomeados integer := 0;
  v_autor uuid := (
    select p.user_id from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
     order by p.user_id limit 1);
begin
  if v_autor is null then
    raise exception 'Nenhum administrador global ativo para assinar a versão';
  end if;
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA"
                  where id = c_edital and private."FC_NUMERO_EDITAL"(edital) = '114/2026') then
    raise exception 'Edital 114/2026 não encontrado pelo id';
  end if;

  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = c_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O 114/2026 ainda não tem regra da avaliação documental';
  end if;
  select h."DS_CONFIGURACAO" into v_atual
    from public."TH_REGRA_ANALISE" h
   where h."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";

  if exists (select 1 from jsonb_array_elements(coalesce(v_atual -> 'observacoes_prontas', '[]'::jsonb)) o
              where o ->> 'codigo' = 'TITULO_UMA_VEZ') then
    raise notice 'A versão vigente (%) já tem os ajustes da revisão: nada foi feito.', v_regra."NU_VERSAO_VIGENTE";
    return;
  end if;

  -- Os motivos que saem do REQUISITO_DO_CARGO (achados pelo texto).
  select b into v_req from jsonb_array_elements(v_atual -> 'blocos') b where b ->> 'codigo' = 'REQUISITO_DO_CARGO';
  if v_req is null then
    raise exception 'A regra vigente não tem o bloco REQUISITO_DO_CARGO';
  end if;
  select m into m_experiencia from jsonb_array_elements(v_req -> 'motivos') m where btrim(m ->> 'texto') like c_txt_experiencia || '%';
  select m into m_titulo from jsonb_array_elements(v_req -> 'motivos') m where btrim(m ->> 'texto') like c_txt_titulo || '%';
  select m into m_requisito from jsonb_array_elements(v_req -> 'motivos') m where btrim(m ->> 'texto') like c_txt_requisito || '%';
  select m into m_nome from jsonb_array_elements(v_req -> 'motivos') m where btrim(m ->> 'texto') like c_txt_nome || '%';
  if m_experiencia is null or m_titulo is null or m_requisito is null or m_nome is null then
    raise exception 'O REQUISITO_DO_CARGO da versão vigente (%) não tem os quatro motivos esperados: confira antes de rodar.',
      v_regra."NU_VERSAO_VIGENTE";
  end if;
  -- Um motivo retirado que já esteja em algum lançamento: para tudo.
  if exists (select 1 from public."TB_FICHA_ANALISE" f
              cross join (values (m_experiencia ->> 'codigo'), (m_titulo ->> 'codigo'),
                                 (m_requisito ->> 'codigo'), (m_nome ->> 'codigo')) c(codigo)
              where f."CO_MONITORAMENTO" = c_edital
                and (f."DS_LANCAMENTO" #> '{blocos,REQUISITO_DO_CARGO}')::text like '%"' || c.codigo || '"%') then
    raise exception 'Há ficha do 114 com motivo do REQUISITO_DO_CARGO que seria retirado: nada foi feito.';
  end if;

  -- Monta os blocos, na mesma ordem.
  for v_b in select b.value, b.ordinality from jsonb_array_elements(v_atual -> 'blocos') with ordinality b order by b.ordinality loop
    v_bloco := v_b.value;
    v_motivos := '[]'::jsonb;
    for v_m in select m.value from jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) with ordinality m order by m.ordinality loop
      v_mot := v_m.value;
      -- Retirados do REQUISITO_DO_CARGO.
      if v_bloco ->> 'codigo' = 'REQUISITO_DO_CARGO'
         and v_mot ->> 'codigo' in (m_experiencia ->> 'codigo', m_titulo ->> 'codigo',
                                    m_requisito ->> 'codigo', m_nome ->> 'codigo') then
        continue;
      end if;
      -- Renomeações (só se o texto confere e o código antigo não está em uso).
      select r into v_r from jsonb_array_elements(c_renomear) r
       where r ->> 'bloco' = v_bloco ->> 'codigo' and r ->> 'de' = v_mot ->> 'codigo';
      if v_r is not null then
        if btrim(v_mot ->> 'texto') not like (v_r ->> 'texto') || '%' then
          raise notice 'Bloco %, motivo %: texto diferente do esperado, código mantido.', v_bloco ->> 'codigo', v_mot ->> 'codigo';
        elsif exists (select 1 from public."TB_FICHA_ANALISE" f
                       where f."CO_MONITORAMENTO" = c_edital
                         and (f."DS_LANCAMENTO" -> 'blocos' -> (v_bloco ->> 'codigo'))::text like '%"' || (v_mot ->> 'codigo') || '"%') then
          raise notice 'Bloco %, motivo %: já usado em ficha, código mantido.', v_bloco ->> 'codigo', v_mot ->> 'codigo';
        else
          v_mot := jsonb_set(v_mot, '{codigo}', v_r -> 'para');
          if v_r ? 'efeito' then
            v_mot := v_mot || jsonb_build_object('efeito', v_r -> 'efeito');
          end if;
          v_renomeados := v_renomeados + 1;
        end if;
      end if;
      v_motivos := v_motivos || jsonb_build_array(v_mot);
    end loop;
    -- O motivo da alteração de nome vai para os blocos que pontuam.
    if v_bloco ->> 'codigo' in ('FORMACAO', 'CURSOS', 'EXPERIENCIA')
       and not exists (select 1 from jsonb_array_elements(v_motivos) x where x ->> 'codigo' = 'NOME_ALTERADO_SEM_DOCUMENTO') then
      v_motivos := v_motivos || jsonb_build_array(jsonb_build_object(
        'texto', m_nome -> 'texto', 'codigo', 'NOME_ALTERADO_SEM_DOCUMENTO', 'item_edital', m_nome -> 'item_edital'));
    end if;
    if v_bloco ? 'motivos' then
      v_bloco := jsonb_set(v_bloco, '{motivos}', v_motivos);
    end if;
    v_blocos := v_blocos || jsonb_build_array(v_bloco);
  end loop;

  v_nova := jsonb_set(v_atual, '{blocos}', v_blocos);
  v_nova := jsonb_set(v_nova, '{observacoes_prontas}',
    coalesce(v_atual -> 'observacoes_prontas', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('texto', btrim(m_titulo ->> 'texto'), 'codigo', 'TITULO_UMA_VEZ',
                         'rotulo', 'Cada título conta uma única vez', 'item_edital', m_titulo -> 'item_edital'),
      jsonb_build_object('texto', btrim(m_requisito ->> 'texto'), 'codigo', 'REQUISITO_SEM_PONTUACAO',
                         'rotulo', 'Requisito obrigatório não pontua', 'item_edital', m_requisito -> 'item_edital')));
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_nova);
  v_versao := v_regra."NU_VERSAO_VIGENTE" + 1;

  insert into public."TH_REGRA_ANALISE"
    ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_ANALISE", v_versao, v_nova,
          encode(sha256(convert_to(v_nova::text, 'UTF8')), 'hex'), c_motivo, v_autor,
          private."FC_NOME_DA_VERSAO"(c_nome));

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_versao, "TP_SITUACAO" = 'CONFERIR',
         "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_autor
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  raise notice 'Regra do 114/2026: versão % criada a partir da % (% motivo(s) renomeado(s); situação CONFERIR).',
    v_versao, v_regra."NU_VERSAO_VIGENTE", v_renomeados;
end;
$$;

commit;

-- Conferência: versão, situação, nome, motivo, códigos dos motivos por bloco
-- e as observações prontas da versão vigente.
select r."NU_VERSAO_VIGENTE" as versao,
       r."TP_SITUACAO" as situacao,
       h."NO_VERSAO" as nome,
       h."DS_MOTIVO" as motivo,
       (select string_agg(b ->> 'codigo' || ': ' || coalesce(
                 (select string_agg(m ->> 'codigo' || coalesce('(' || (m ->> 'efeito') || ')', ''), ', ' order by n)
                    from jsonb_array_elements(b -> 'motivos') with ordinality y(m, n)), '-'), ' | ' order by k)
          from jsonb_array_elements(h."DS_CONFIGURACAO" -> 'blocos') with ordinality x(b, k)) as motivos_por_bloco,
       (select string_agg(o ->> 'codigo', ', ' order by n)
          from jsonb_array_elements(h."DS_CONFIGURACAO" -> 'observacoes_prontas') with ordinality z(o, n)) as observacoes_prontas,
       jsonb_array_length(h."DS_CONFIGURACAO" -> 'por_cargo') as diferencas_por_cargo
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h
    on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
