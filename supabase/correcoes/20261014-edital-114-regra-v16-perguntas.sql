/*
  CORREÇÃO DE DADOS — perguntas do questionário ligadas a cada item da regra
  da avaliação documental do Edital 114/2026 (Projetos, PES Rio Doce
  AgSUS/FUNASA, id bcecfb08-88ef-4e06-8401-bcad6bf88fd0) e texto do motivo
  MOTIVO_4 da titulação (pedido da COREs).

  PROBLEMA: a ficha só mostra as respostas e os anexos da Empregare das
  perguntas que a regra liga ao bloco (`perguntas`). O banco
  (private."FC_RESPOSTAS_DA_FICHA", na obter_ficha_analise) só devolve as
  colunas dessas perguntas, e a tela (respostasDoBloco → colunasDaPergunta,
  arquivosDaPergunta) só procura o anexo delas. O casamento é por PREFIXO do
  enunciado normalizado (sem "Pergunta N - ", &nbsp; vira espaço, sem acento,
  sem caixa, espaços juntados; a pontuação conta). Na v15 faltavam, entre
  outras: "Anexe a comprovação de conclusão de/do Nível Médio" e "Você possui
  Curso Técnico" (ESCOLARIDADE), "Anexe seu comprovante de Titulação"
  (FORMACAO), todo o REQUISITO_DO_CARGO (vazio), as perguntas da UMCQA
  (CURSOS) e "Anexe o comprovante de Experiência Profissional na área em que
  concorre" (EXPERIENCIA). Por isso o link do anexo não aparecia.

  PRÉ-REQUISITO: nenhum número de versão: parte da VIGENTE no momento da
  execução (era a 15).

  O QUE FAZ: cria uma NOVA versão (vigente + 1), igual à vigente, com:
    1. em cada bloco abaixo, `perguntas` = a lista completa daquele item (na
       ordem: a pergunta "Você possui…" e logo o "Anexe…"), seguida das que a
       vigente já tinha e a lista não cobre (só sai o texto longo que um
       prefixo curto da lista já cobre: casa as mesmas colunas);
    2. no bloco FORMACAO, o texto do motivo MOTIVO_4 (o único motivo mexido):
       "Não apresentou certificados de cursos de aperfeiçoamento…" →
       "Não apresentou diploma ou certificado da titulação acadêmica
       (especialização, mestrado ou doutorado) conforme o subitem 8.2.10.1".
  Os textos são o começo curto e estável do enunciado (sem "Pergunta N - ",
  antes do primeiro "?", ":" ou "(" quando o resto varia entre vagas).
  Todo o resto (por_cargo, motivos, efeitos, faixas, observações) fica igual.
  A situação volta para CONFERIR, como em toda versão nova.

  Rode no SQL Editor (papel postgres). Idempotente: se a vigente já tem tudo
  isso, não faz nada (avisa). Para ensaiar, troque o commit por rollback.
  Termina com o SELECT de conferência.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_motivo constant text := 'Perguntas dos anexos ligadas a cada item e texto do motivo da titulação (pedido da COREs)';
  c_nome constant text := 'Perguntas dos anexos';
  c_texto_motivo_4 constant text :=
    'Não apresentou diploma ou certificado da titulação acadêmica (especialização, mestrado ou doutorado) conforme o subitem 8.2.10.1';
  c_perguntas constant jsonb := $per$
{
  "IDENTIDADE": [
    "Anexe o documento de identificação com foto",
    "Anexe um documento de identificação com foto"
  ],
  "ESCOLARIDADE": [
    "Você possui Ensino Médio completo",
    "Anexe a comprovação de conclusão de Nível Médio",
    "Anexe a comprovação de conclusão do Nível Médio",
    "Você possui Curso Técnico na área da vaga",
    "Anexe a comprovação de Nível Técnico",
    "Você possui Graduação na área da vaga",
    "Anexe a comprovação de Nível Superior"
  ],
  "REGISTRO_CONSELHO": [
    "Você possui registro profissional ativo",
    "Anexe o comprovante do seu registro profissional"
  ],
  "REQUISITO_DO_CARGO": [
    "Você possui CNH Categoria B",
    "Anexe aqui sua CNH Categoria B",
    "Você possui CNH Categoria D",
    "Anexe aqui sua CNH Categoria D",
    "Você possui curso de direção defensiva",
    "Anexe o comprovante de conclusão do curso de direção defensiva",
    "Você possui curso de especialização ou capacitação em Cromatografia Gasosa",
    "Anexe o comprovante de conclusão de especialização ou capacitação em Cromatografia Gasosa"
  ],
  "FORMACAO": [
    "Qual seu Nível de Titulação Acadêmica",
    "Anexe seu comprovante de Titulação"
  ],
  "CURSOS": [
    "Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento",
    "Anexe os seus Certificados de Conclusão dos Cursos de Aperfeiçoamento",
    "Você possui Certificado de capacitação ou treinamento específico para condução, manejo e operação de Unidade Móvel de Controle da Qualidade da Água",
    "Anexe o certificado de capacitação ou treinamento específico para condução, manejo e operação de Unidade Móvel de Controle da Qualidade da Água"
  ],
  "EXPERIENCIA": [
    "Experiência Profissional na área em que concorre",
    "Anexe o comprovante de Experiência Profissional de acordo com os requisitos do Edital",
    "Anexe o comprovante de Experiência Profissional conforme requisitos do Edital",
    "Anexe o comprovante de Experiência Profissional na área em que concorre"
  ],
  "COTA_PP": [
    "Candidatos às vagas destinadas a Pretos ou Pardos e Quilombolas",
    "Candidatos concorrendo às vagas destinadas a Pretos ou Pardos, grave um vídeo",
    "Candidatos concorrendo às vagas destinadas a Pretos ou Pardos, anexe uma foto"
  ],
  "COTA_PI": [
    "Para candidatos que se declaram indígenas, anexe sua Declaração de Pertencimento Étnico"
  ],
  "COTA_PQ": [
    "Candidatos às vagas destinadas a Pretos ou Pardos e Quilombolas",
    "Para candidatos que se declaram quilombolas, anexe sua Declaração de Pertencimento Étnico"
  ],
  "COTA_PCD": [
    "Os candidatos que concorrem às vagas destinadas a PcD devem anexar aqui o laudo médico"
  ]
}
$per$::jsonb;
  v_regra public."TB_REGRA_ANALISE";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
  v_blocos jsonb := '[]'::jsonb;
  v_b record;
  v_bloco jsonb;
  v_lista jsonb;
  v_achados integer := 0;
  v_motivo_4 integer := 0;
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

  for v_b in select b.value, b.ordinality from jsonb_array_elements(v_atual -> 'blocos') with ordinality b order by b.ordinality loop
    v_bloco := v_b.value;
    if c_perguntas ? (v_bloco ->> 'codigo') then
      -- A lista do item e, depois, as que a vigente já tinha e não estão nela.
      select coalesce(jsonb_agg(t order by o), '[]'::jsonb) into v_lista
        from (select p.t, p.o
                from jsonb_array_elements_text(c_perguntas -> (v_bloco ->> 'codigo')) with ordinality p(t, o)
              union all
              select e.t, 1000 + e.o
                from jsonb_array_elements_text(coalesce(v_bloco -> 'perguntas', '[]'::jsonb)) with ordinality e(t, o)
               where not exists (
                       select 1 from jsonb_array_elements_text(c_perguntas -> (v_bloco ->> 'codigo')) x
                        where left(private."FC_TEXTO_COMPARAVEL"(e.t), length(private."FC_TEXTO_COMPARAVEL"(x)))
                              = private."FC_TEXTO_COMPARAVEL"(x))) s;
      v_bloco := v_bloco || jsonb_build_object('perguntas', v_lista);
      v_achados := v_achados + 1;
    end if;
    if v_bloco ->> 'codigo' = 'FORMACAO' then
      select count(*) into v_motivo_4
        from jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) m
       where m ->> 'codigo' = 'MOTIVO_4';
      select jsonb_agg(case when m ->> 'codigo' = 'MOTIVO_4'
                            then m || jsonb_build_object('texto', c_texto_motivo_4) else m end order by n)
        into v_lista
        from jsonb_array_elements(v_bloco -> 'motivos') with ordinality y(m, n);
      v_bloco := v_bloco || jsonb_build_object('motivos', v_lista);
    end if;
    v_blocos := v_blocos || jsonb_build_array(v_bloco);
  end loop;
  if v_achados <> (select count(*) from jsonb_object_keys(c_perguntas)) then
    raise exception 'A versão vigente (%) não tem todos os blocos esperados (achou % de %): confira antes de rodar.',
      v_regra."NU_VERSAO_VIGENTE", v_achados, (select count(*) from jsonb_object_keys(c_perguntas));
  end if;
  if v_motivo_4 <> 1 then
    raise exception 'A versão vigente (%) não tem um (e só um) MOTIVO_4 no bloco FORMACAO (achou %): confira antes de rodar.',
      v_regra."NU_VERSAO_VIGENTE", v_motivo_4;
  end if;

  v_nova := jsonb_set(v_atual, '{blocos}', v_blocos);
  if v_nova = v_atual then
    raise notice 'A versão vigente (%) já tem as perguntas e o texto do MOTIVO_4: nada foi feito.', v_regra."NU_VERSAO_VIGENTE";
    return;
  end if;

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

  raise notice 'Regra do 114/2026: versão % criada a partir da % com as perguntas de cada item e o texto do MOTIVO_4 (situação CONFERIR).',
    v_versao, v_regra."NU_VERSAO_VIGENTE";
end;
$$;

commit;

-- Conferência: versão, situação, nome, motivo e, por bloco, as perguntas
-- ligadas, quantas colunas do questionário do 114 cada uma casa (0 = texto
-- que não acha pergunta) e o texto do MOTIVO_4 da FORMACAO.
select r."NU_VERSAO_VIGENTE" as versao,
       r."TP_SITUACAO" as situacao,
       h."NO_VERSAO" as nome,
       h."DS_MOTIVO" as motivo,
       b ->> 'codigo' as bloco,
       (select string_agg(p || ' [' || (
                 select count(*) from public."TB_RESUMO_PERGUNTA_EDITAL" s,
                        jsonb_array_elements(s."DS_PERGUNTA") x
                  where s."CO_MONITORAMENTO" = r."CO_MONITORAMENTO"
                    and left(regexp_replace(private."FC_TEXTO_COMPARAVEL"(x ->> 'coluna'), '^pergunta ?[0-9]+ ?[-–—] ?', ''),
                             length(private."FC_TEXTO_COMPARAVEL"(p))) = private."FC_TEXTO_COMPARAVEL"(p)) || ']',
                 ' | ' order by n)
          from jsonb_array_elements_text(b -> 'perguntas') with ordinality y(p, n)) as perguntas,
       (select m ->> 'texto' from jsonb_array_elements(b -> 'motivos') m where m ->> 'codigo' = 'MOTIVO_4'
          and b ->> 'codigo' = 'FORMACAO') as motivo_4
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h
    on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
  cross join lateral jsonb_array_elements(h."DS_CONFIGURACAO" -> 'blocos') with ordinality bb(b, o)
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'
 order by bb.o;
