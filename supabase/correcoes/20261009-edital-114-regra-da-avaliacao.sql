/*
  CORREÇÃO DE DADOS — regra da avaliação documental do Edital 114/2026
  (Projetos, PES Rio Doce AgSUS/FUNASA, id bcecfb08-88ef-4e06-8401-bcad6bf88fd0).

  Diagnóstico de 09/10/2026: o 114/2026 tem cronograma (inscrições de 05 a
  14/10/2026), regra de CLASSIFICAÇÃO (versão 1, de
  20261002-regras-de-classificacao-todos-os-editais.sql) e o modelo
  PROJ26-RIO-DOCE já está no banco (20261006-modelo-proj26-rio-doce.sql e
  20261007-declarada-experiencia-por-nivel.sql aplicados), mas NÃO tem regra
  da avaliação documental. Sem ela, a pré-classificação só conta inscritos
  (e o cartão "Inscrições" não mostra aptos).

  Esta correção faz o que "Criar a partir do modelo" faz na aba Regra
  (copiar_modelo_regra_analise), sem sessão de usuário: cria a regra do
  edital, versão 1, cópia do modelo PROJ26-RIO-DOCE, com
    - nome da versão "Regra do edital 114/2026 (modelo PROJ26 Rio Doce)";
    - edital_rotulo "Edital 114/2026" (o rótulo do parecer);
    - situação CONFERIR: a coordenação confere na aba Regra (dupla
      conferência). Enquanto isso, o cartão "Inscrições" mostra os aptos como
      PRÉVIA (nada da classificação é gravado).

  O QUE O MODELO AINDA NÃO SABE DO 114 (conferir na aba Regra antes de marcar
  como conferida; ver docs/analises-no-monitora/regras-dos-editais-recentes.md):
    - o enunciado da pergunta de experiência do questionário do 114 (o modelo
      usa "Experiência Profissional", texto do 93/2026): só se confirma depois
      da primeira carga da Empregare (colunas "Pergunta N - …" da vaga);
    - perguntas de titulação/cursos com pontos declarados (o modelo só pontua
      a experiência na nota declarada);
    - Motorista categoria D (cargo 15): +5 da capacitação UMCQA (máx. 15 em
      cursos) não é expresso pelo formato (lançar à mão);
    - PP sem heteroidentificação (5.7.8) × foto e vídeo do Anexo V (5.7.3).

  Rode no SQL Editor (papel postgres). Idempotente: se o edital já tem regra,
  não faz nada (avisa). Para ensaiar, troque a última linha por rollback.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_modelo constant text := 'PROJ26-RIO-DOCE';
  c_nome constant text := 'Regra do edital 114/2026 (modelo PROJ26 Rio Doce)';
  v_config jsonb;
  v_regra uuid;
  -- Autor da versão (obrigatório): sem sessão no SQL Editor, o primeiro
  -- administrador global ativo, como nas correções e ensaios do banco.
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
  if exists (select 1 from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = c_edital) then
    raise notice 'O 114/2026 já tem regra da avaliação documental: nada feito.';
    return;
  end if;
  select m."DS_CONFIGURACAO" || jsonb_build_object('modelo', m."CO_MODELO", 'edital_rotulo', 'Edital 114/2026')
    into v_config
    from public."TB_REGRA_ANALISE_MODELO" m
   where m."CO_MODELO" = c_modelo and m."ST_ATIVO" = 'S';
  if v_config is null then
    raise exception 'Modelo % não encontrado ou inativo', c_modelo;
  end if;
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_config);

  insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "TP_SITUACAO", "CO_MODELO_ORIGEM",
                                        "CO_USUARIO_ATUALIZACAO")
  values (c_edital, 1, 'CONFERIR', c_modelo, v_autor)
  returning "CO_REGRA_ANALISE" into v_regra;
  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO",
                                        "NO_VERSAO", "CO_USUARIO")
  values (v_regra, 1, v_config, encode(sha256(convert_to(v_config::text, 'UTF8')), 'hex'),
          'Copiada do modelo ' || c_modelo || ' (correção 20261009-edital-114-regra-da-avaliacao.sql)', c_nome, v_autor);
end;
$$;

-- Conferência: a regra criada (situação, versão, nome, modelo, lote e nota declarada).
select m.edital, r."TP_SITUACAO", r."NU_VERSAO_VIGENTE", h."NO_VERSAO", r."CO_MODELO_ORIGEM",
       h."DS_CONFIGURACAO" ->> 'edital_rotulo' as rotulo,
       h."DS_CONFIGURACAO" #>> '{lote,base}' as lote, h."DS_CONFIGURACAO" #>> '{lote,nota_minima}' as nota_minima,
       jsonb_array_length(h."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}') as itens_declarada
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';

commit;
