/*
  CORREÇÃO DE DADOS — motivos padronizados dos blocos de cota da regra da
  avaliação documental do Edital 114/2026 (Projetos, PES Rio Doce
  AgSUS/FUNASA, id bcecfb08-88ef-4e06-8401-bcad6bf88fd0).

  PRÉ-REQUISITO: a correção 20261013-edital-114-regra-v9.sql aplicada. Este
  script não depende do número: parte da versão VIGENTE no momento da
  execução.

  O QUE FAZ: cria uma NOVA versão (vigente + 1), igual à vigente, com motivos
  prontos nos blocos COTA_PP, COTA_PI, COTA_PQ e COTA_PCD, que hoje não têm
  nenhum (o avaliador só escrevia o motivo livre). Os motivos NÃO têm efeito
  próprio: vale o da situação do bloco (Não enviado/Não conforme → segue na
  ampla concorrência; PcD Conforme → encaminha à perícia). Textos e itens
  tirados do edital (item 5 e 6.6); os Anexos IV a VII são citados pelo que
  o corpo do edital (5.7.1 a 5.7.6) e as perguntas da inscrição dizem deles.

  Ajustes ao texto do edital:
    - PcD: o edital não pede a CID; o 5.1.7 pede a espécie e o grau ou nível
      da deficiência. Por isso o motivo é LAUDO_SEM_ESPECIE_E_GRAU (não
      LAUDO_SEM_CID).
    - PcD: há prazo (36 meses antes da publicação, salvo TEA e deficiência
      permanente: 5.1.9 e 5.1.12.8 b) e a declaração de capacidade laborativa
      é exigida (5.1.5 b): os dois motivos existem.
    - Indígena: a declaração é assinada por liderança local (5.7.5);
      quilombola: por liderança ou associação local, ou certificado da FCP
      (5.7.6).

  Todo o resto (por_cargo, demais blocos, perguntas, faixas, observações)
  fica igual. A situação volta para CONFERIR, como em toda versão nova.

  Rode no SQL Editor (papel postgres). Idempotente: se algum bloco de cota da
  vigente já tem motivos, não faz nada (avisa). Para ensaiar, troque o commit
  por rollback. Termina com o SELECT de conferência.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_motivo constant text := 'Motivos padronizados das cotas (item 5 e Anexos IV a VII do edital 114/2026)';
  c_nome constant text := 'Motivos das cotas';
  c_motivos constant jsonb := $mot$
{
  "COTA_PP": [
    {"codigo": "SEM_AUTODECLARACAO", "item_edital": "5.7.1 e Anexo IV",
     "texto": "Não anexou a autodeclaração de pessoa preta ou parda conforme o modelo do Anexo IV (subitem 5.7.1)."},
    {"codigo": "AUTODECLARACAO_INCOMPLETA", "item_edital": "5.7.1, 5.7.4 e Anexo IV",
     "texto": "Autodeclaração fora do modelo do Anexo IV, sem assinatura ou com preenchimento incompleto (subitens 5.7.1 e 5.7.4)."},
    {"codigo": "SEM_FOTO", "item_edital": "5.7.3 e Anexo V",
     "texto": "Não anexou a foto (de frente e de perfil) conforme as instruções do Anexo V (subitem 5.7.3)."},
    {"codigo": "FOTO_FORA_DO_PADRAO", "item_edital": "5.7.3 e Anexo V",
     "texto": "Foto ilegível ou em desacordo com as instruções do Anexo V (subitem 5.7.3)."},
    {"codigo": "SEM_VIDEO", "item_edital": "5.7.3 e Anexo V",
     "texto": "Não enviou o vídeo conforme as instruções do Anexo V (subitem 5.7.3)."},
    {"codigo": "VIDEO_FORA_DO_PADRAO", "item_edital": "5.7.3 e Anexo V",
     "texto": "Vídeo em desacordo com as instruções do Anexo V (fundo, duração ou conteúdo) (subitem 5.7.3)."},
    {"codigo": "DOCUMENTO_ILEGIVEL", "item_edital": "6.6.1",
     "texto": "Documento ilegível ou incompleto, que não permite a identificação das informações (subitem 6.6.1)."},
    {"codigo": "CAMPO_INCORRETO", "item_edital": "6.6.5",
     "texto": "Documento anexado em campo incorreto da plataforma; não foi considerado para análise (subitem 6.6.5)."}
  ],
  "COTA_PI": [
    {"codigo": "SEM_AUTODECLARACAO", "item_edital": "5.7.2 e Anexo IV",
     "texto": "Não anexou a autodeclaração conforme o modelo do Anexo IV (subitem 5.7.2)."},
    {"codigo": "SEM_DECLARACAO_PERTENCIMENTO", "item_edital": "5.7.5 e Anexo VI",
     "texto": "Não enviou a declaração de pertencimento étnico emitida pelo grupo indígena, conforme o modelo do Anexo VI (subitens 5.7.2 e 5.7.5)."},
    {"codigo": "DECLARACAO_SEM_ASSINATURA", "item_edital": "5.7.5",
     "texto": "Declaração de pertencimento étnico sem a assinatura de liderança local (subitem 5.7.5)."},
    {"codigo": "DECLARACAO_FORA_DO_MODELO", "item_edital": "5.7.5 e Anexo VI",
     "texto": "Declaração de pertencimento étnico em desacordo com o modelo do Anexo VI (subitem 5.7.5)."},
    {"codigo": "DOCUMENTO_ILEGIVEL", "item_edital": "6.6.1",
     "texto": "Documento ilegível ou incompleto, que não permite a identificação das informações (subitem 6.6.1)."},
    {"codigo": "CAMPO_INCORRETO", "item_edital": "6.6.5",
     "texto": "Documento anexado em campo incorreto da plataforma; não foi considerado para análise (subitem 6.6.5)."}
  ],
  "COTA_PQ": [
    {"codigo": "SEM_AUTODECLARACAO", "item_edital": "5.7.2 e Anexo IV",
     "texto": "Não anexou a autodeclaração conforme o modelo do Anexo IV (subitem 5.7.2)."},
    {"codigo": "SEM_PERTENCIMENTO_OU_FCP", "item_edital": "5.7.6 e Anexo VII",
     "texto": "Não enviou a declaração de pertencimento emitida e assinada por liderança ou associação local (Anexo VII) nem o certificado de reconhecimento do território emitido pela Fundação Cultural Palmares (subitem 5.7.6)."},
    {"codigo": "DECLARACAO_SEM_ASSINATURA", "item_edital": "5.7.6",
     "texto": "Declaração de pertencimento sem a assinatura de liderança ou associação local (subitem 5.7.6)."},
    {"codigo": "DECLARACAO_FORA_DO_MODELO", "item_edital": "5.7.6 e Anexo VII",
     "texto": "Declaração de pertencimento em desacordo com o modelo do Anexo VII (subitem 5.7.6)."},
    {"codigo": "DOCUMENTO_ILEGIVEL", "item_edital": "6.6.1",
     "texto": "Documento ilegível ou incompleto, que não permite a identificação das informações (subitem 6.6.1)."},
    {"codigo": "CAMPO_INCORRETO", "item_edital": "6.6.5",
     "texto": "Documento anexado em campo incorreto da plataforma; não foi considerado para análise (subitem 6.6.5)."}
  ],
  "COTA_PCD": [
    {"codigo": "SEM_LAUDO", "item_edital": "5.1.5 b; 5.1.12.8 a",
     "texto": "Não enviou o laudo médico (ou documentação caracterizadora) que ateste a condição de pessoa com deficiência (subitens 5.1.5, alínea b, e 5.1.12.8, alínea a)."},
    {"codigo": "LAUDO_SEM_ESPECIE_E_GRAU", "item_edital": "5.1.7",
     "texto": "A documentação caracterizadora não informa a espécie e o grau ou o nível da deficiência (subitem 5.1.7)."},
    {"codigo": "LAUDO_SEM_IDENTIFICACAO_MEDICA", "item_edital": "5.1.7",
     "texto": "A documentação caracterizadora não tem a identificação do(a) candidato(a), a data da emissão, a assinatura do profissional responsável (física com carimbo, ou eletrônica com mecanismo de verificação de autenticidade) ou o número de inscrição no Conselho Regional Profissional (subitem 5.1.7)."},
    {"codigo": "LAUDO_FORA_DO_PRAZO", "item_edital": "5.1.9; 5.1.12.8 b",
     "texto": "Documentação caracterizadora emitida há mais de 36 meses da data de publicação do edital, fora dos casos de Transtorno do Espectro Autista ou de deficiência permanente (subitens 5.1.9 e 5.1.12.8, alínea b)."},
    {"codigo": "SEM_DECLARACAO_CAPACIDADE", "item_edital": "5.1.5 b",
     "texto": "Não enviou a declaração expressa de capacidade laborativa para o exercício das atividades relacionadas à função pretendida (subitem 5.1.5, alínea b)."},
    {"codigo": "DEFICIENCIA_NAO_ENQUADRADA", "item_edital": "5.1.4",
     "texto": "A condição descrita não se enquadra como deficiência nos termos do subitem 5.1.4 (Lei nº 13.146/2015, Decreto nº 3.298/1999, Lei nº 12.764/2012, Lei nº 14.126/2021 e Lei nº 14.768/2023)."},
    {"codigo": "DOCUMENTO_ILEGIVEL", "item_edital": "5.1.8",
     "texto": "Imagem do documento parcial ou totalmente ilegível, sem permitir a plena identificação das informações (subitem 5.1.8)."},
    {"codigo": "CAMPO_INCORRETO", "item_edital": "6.6.5",
     "texto": "Documento anexado em campo incorreto da plataforma; não foi considerado para análise (subitem 6.6.5)."}
  ]
}
$mot$::jsonb;
  v_regra public."TB_REGRA_ANALISE";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
  v_blocos jsonb := '[]'::jsonb;
  v_b record;
  v_bloco jsonb;
  v_achados integer := 0;
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

  if exists (select 1 from jsonb_array_elements(v_atual -> 'blocos') b
              where b ->> 'codigo' in (select jsonb_object_keys(c_motivos))
                and jsonb_array_length(coalesce(b -> 'motivos', '[]'::jsonb)) > 0) then
    raise notice 'A versão vigente (%) já tem motivos nos blocos de cota: nada foi feito.', v_regra."NU_VERSAO_VIGENTE";
    return;
  end if;

  for v_b in select b.value, b.ordinality from jsonb_array_elements(v_atual -> 'blocos') with ordinality b order by b.ordinality loop
    v_bloco := v_b.value;
    if c_motivos ? (v_bloco ->> 'codigo') then
      v_bloco := v_bloco || jsonb_build_object('motivos', c_motivos -> (v_bloco ->> 'codigo'));
      v_achados := v_achados + 1;
    end if;
    v_blocos := v_blocos || jsonb_build_array(v_bloco);
  end loop;
  if v_achados <> 4 then
    raise exception 'A versão vigente (%) não tem os quatro blocos de cota (achou %): confira antes de rodar.',
      v_regra."NU_VERSAO_VIGENTE", v_achados;
  end if;

  v_nova := jsonb_set(v_atual, '{blocos}', v_blocos);
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

  raise notice 'Regra do 114/2026: versão % criada a partir da % com motivos nos 4 blocos de cota (situação CONFERIR).',
    v_versao, v_regra."NU_VERSAO_VIGENTE";
end;
$$;

commit;

-- Conferência: versão, situação, nome, motivo e os motivos de cada bloco de
-- cota (código: item do edital), com os efeitos do bloco.
select r."NU_VERSAO_VIGENTE" as versao,
       r."TP_SITUACAO" as situacao,
       h."NO_VERSAO" as nome,
       h."DS_MOTIVO" as motivo,
       b ->> 'codigo' as bloco,
       b -> 'efeitos' as efeitos_do_bloco,
       (select string_agg(m ->> 'codigo' || ' (' || (m ->> 'item_edital') || ')', ', ' order by n)
          from jsonb_array_elements(b -> 'motivos') with ordinality y(m, n)) as motivos
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h
    on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
  cross join lateral jsonb_array_elements(h."DS_CONFIGURACAO" -> 'blocos') b
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'
   and b ->> 'tipo' = 'COTA';
