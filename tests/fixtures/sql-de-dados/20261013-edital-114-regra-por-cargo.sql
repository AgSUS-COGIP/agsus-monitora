/*
  CORREÇÃO DE DADOS — diferenças por cargo na regra da avaliação documental
  do Edital 114/2026 (Projetos, PES Rio Doce AgSUS/FUNASA,
  id bcecfb08-88ef-4e06-8401-bcad6bf88fd0).

  PRÉ-REQUISITO: a migration 20261013130000_regra_por_cargo.sql aplicada (a
  validação de regra.por_cargo e a regra da vaga na ficha). Sem ela, o script
  para com erro e nada muda.

  O QUE FAZ: cria uma NOVA versão da regra a partir da versão VIGENTE no
  momento da execução (não de uma versão fixa: a COREs pode ter salvo outra
  depois deste script), igual à vigente mais regra.por_cargo, com o motivo
  "Diferenças por cargo do edital 114/2026 (8.2.6 e Anexo I)". A situação
  volta para CONFERIR, como em toda versão nova (salvar_regra_analise): a
  coordenação confere na aba Regra (dupla conferência) antes de concluir
  fichas.

  AS DIFERENÇAS (8.2.6 e Anexo I; vagas da Empregare pelos arquivos da carga
  de 13/10/2026 e, como reserva, o começo do nome do cargo):
    - Cargo 15, Motorista categoria D (vagas 182528 e 182567): Cursos com as
      faixas do nível médio (40–60h → 2; 61–119h → 4; ≥120h → 6), teto 15 e
      o item extra UMCQA (+5: certificado de condução/manejo/operação de
      Unidade Móvel de Controle da Qualidade da Água ou capacitação específica
      da contratante), conferido na ficha como uma linha (Confere / Não
      confere); requisitos CNH categoria D vigente e curso de direção
      defensiva (este não pontua em Cursos: item 8.2.7).
    - Cargo 14, Motorista categoria B: CNH B vigente e direção defensiva.
    - Cargos 5 a 8, Especialista em metais pesados: especialização ou
      capacitação em Cromatografia Gasosa (não pontua em Titulação nem em
      Cursos: item 8.2.7).
    - Cargo 9, Técnico de Laboratório: diploma técnico nas áreas do Anexo I e
      registro ativo no conselho.
    - Cargo 10, Supervisor de Saúde Ambiental: registro no conselho quando
      aplicável à formação.
    - Cargos 12 e 13: conhecimento em informática (planilhas e bancos de
      dados; sistemas e plataformas web).
    - Todos os cargos: a área exigida da experiência mínima de 6 meses
      (texto do Anexo I), mostrada no item Experiência da ficha.
  Os demais de nível médio/técnico seguem com Cursos até 10 (total 45) e o
  superior com Titulação 10 + Cursos 5 + Experiência 35 (total 50): nada
  disso muda. Os motivos soltos já existentes (SEM_CNH, SEM_CURSO_EXIGIDO,
  CAPACITACAO_UMCQA...) ficam como estão.

  Rode no SQL Editor (papel postgres). Idempotente: se a regra vigente já
  tem diferenças por cargo, não faz nada (avisa). Para ensaiar, troque o
  commit por rollback. Termina com o SELECT de conferência.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_motivo constant text := 'Diferenças por cargo do edital 114/2026 (8.2.6 e Anexo I)';
  c_nome constant text := 'Diferenças por cargo (8.2.6 e Anexo I)';
  c_por_cargo constant jsonb := $por_cargo$
[
  {
    "codigo": "ANALISE_DA_AGUA",
    "rotulo": "Cargos 1 a 4 — Análise da Água",
    "vagas": ["182418", "182421", "182428", "182431", "182433", "182438", "182429", "182434"],
    "cargos": ["CARGO 1", "CARGO 2", "CARGO 3", "CARGO 4"],
    "blocos": {
      "EXPERIENCIA": { "area": "Análises de água (Anexo I: mínimo de 6 meses)." }
    }
  },
  {
    "codigo": "METAIS_PESADOS",
    "rotulo": "Cargos 5 a 8 — Especialista em metais pesados",
    "vagas": ["182442", "182446", "182450", "182452", "182427", "182432", "182439", "182441"],
    "cargos": ["CARGO 5", "CARGO 6", "CARGO 7", "CARGO 8"],
    "blocos": {
      "REQUISITO_DO_CARGO": {
        "requisitos": [
          {
            "codigo": "CROMATOGRAFIA",
            "rotulo": "Curso de especialização ou capacitação em Cromatografia Gasosa",
            "motivo": "Não apresentou o curso de especialização ou capacitação em Cromatografia Gasosa exigido para o cargo (Anexo I).",
            "item_edital": "2 e Anexo I",
            "termos": ["cromatografia"],
            "nao_pontua_em": ["FORMACAO", "CURSOS"]
          }
        ]
      },
      "EXPERIENCIA": {
        "area": "Análises de água; análises de metais pesados por Espectrofotometria de Absorção Atômica (FAAS e GFAAS); e análises de agrotóxicos por ICP-OES ou técnica equivalente (Anexo I: mínimo de 6 meses)."
      }
    }
  },
  {
    "codigo": "TECNICO_LABORATORIO",
    "rotulo": "Cargo 9 — Técnico de Laboratório",
    "vagas": ["182445", "182449"],
    "cargos": ["CARGO 9"],
    "blocos": {
      "REQUISITO_DO_CARGO": {
        "requisitos": [
          {
            "codigo": "DIPLOMA_TECNICO_AREA",
            "rotulo": "Diploma de curso técnico em Química, Saneamento, Meio Ambiente, Análises Clínicas, Biotecnologia ou em Laboratório",
            "motivo": "Não apresentou diploma de curso técnico em Química, Saneamento, Meio Ambiente, Análises Clínicas, Biotecnologia ou em Laboratório, emitido por instituição reconhecida pelo MEC (Anexo I).",
            "item_edital": "2 e Anexo I"
          },
          {
            "codigo": "REGISTRO_ATIVO",
            "rotulo": "Registro ativo no conselho profissional competente",
            "motivo": "Não apresentou registro ativo no conselho profissional competente (Anexo I).",
            "item_edital": "2 e Anexo I"
          }
        ]
      },
      "EXPERIENCIA": { "area": "Laboratório de análises de água (Anexo I: mínimo de 6 meses)." }
    }
  },
  {
    "codigo": "SUPERVISOR_SAUDE_AMBIENTAL",
    "rotulo": "Cargo 10 — Supervisor de Saúde Ambiental",
    "vagas": ["182424", "182430"],
    "cargos": ["CARGO 10"],
    "blocos": {
      "REQUISITO_DO_CARGO": {
        "requisitos": [
          {
            "codigo": "REGISTRO_QUANDO_APLICAVEL",
            "rotulo": "Registro ativo no conselho profissional competente, quando aplicável à formação",
            "motivo": "Não apresentou registro ativo no conselho profissional competente, exigido para a sua formação (Anexo I).",
            "item_edital": "2 e Anexo I"
          }
        ]
      },
      "EXPERIENCIA": {
        "area": "Coordenação de equipes, gestão de saneamento ambiental ou vigilância em saúde (Anexo I: mínimo de 6 meses)."
      }
    }
  },
  {
    "codigo": "AUXILIAR_LOGISTICA",
    "rotulo": "Cargo 11 — Auxiliar de Logística",
    "vagas": ["182444", "182496"],
    "cargos": ["CARGO 11"],
    "blocos": {
      "EXPERIENCIA": {
        "area": "Atividades operacionais de campo, manutenção, saneamento ou apoio logístico (Anexo I: mínimo de 6 meses)."
      }
    }
  },
  {
    "codigo": "COMPILACAO_DE_DADOS",
    "rotulo": "Cargo 12 — Compilação de dados",
    "vagas": ["182448", "182497"],
    "cargos": ["CARGO 12"],
    "blocos": {
      "REQUISITO_DO_CARGO": {
        "requisitos": [
          {
            "codigo": "INFORMATICA_PLANILHAS",
            "rotulo": "Conhecimento em informática, planilhas eletrônicas e operação de bancos de dados",
            "motivo": "Não comprovou conhecimento em informática, planilhas eletrônicas e operação de bancos de dados (Anexo I).",
            "item_edital": "2 e Anexo I"
          }
        ]
      },
      "EXPERIENCIA": {
        "area": "Compilação, tratamento de dados, digitação ou apoio administrativo (Anexo I: mínimo de 6 meses)."
      }
    }
  },
  {
    "codigo": "PLATAFORMA_DO_SUS",
    "rotulo": "Cargo 13 — Alimentação e controle de plataforma do SUS",
    "vagas": ["182493", "182502"],
    "cargos": ["CARGO 13"],
    "blocos": {
      "REQUISITO_DO_CARGO": {
        "requisitos": [
          {
            "codigo": "INFORMATICA_SISTEMAS",
            "rotulo": "Conhecimento em informática, operação de sistemas informatizados e plataformas web",
            "motivo": "Não comprovou conhecimento em informática, operação de sistemas informatizados e plataformas web (Anexo I).",
            "item_edital": "2 e Anexo I"
          }
        ]
      },
      "EXPERIENCIA": {
        "area": "Digitação, inserção de dados em sistemas de saúde pública ou apoio administrativo (Anexo I: mínimo de 6 meses)."
      }
    }
  },
  {
    "codigo": "MOTORISTA_B",
    "rotulo": "Cargo 14 — Motorista categoria B",
    "vagas": ["182513", "182514"],
    "cargos": ["CARGO 14"],
    "blocos": {
      "REQUISITO_DO_CARGO": {
        "requisitos": [
          {
            "codigo": "CNH_B",
            "rotulo": "CNH categoria B vigente",
            "motivo": "Não apresentou CNH categoria B vigente (Anexo I).",
            "item_edital": "2 e Anexo I"
          },
          {
            "codigo": "DIRECAO_DEFENSIVA",
            "rotulo": "Curso de direção defensiva",
            "motivo": "Não apresentou o curso de direção defensiva exigido para o cargo (Anexo I).",
            "item_edital": "2 e Anexo I",
            "termos": ["direção defensiva"],
            "nao_pontua_em": ["CURSOS"]
          }
        ]
      },
      "EXPERIENCIA": { "area": "Experiência como motorista (Anexo I: mínimo de 6 meses)." }
    }
  },
  {
    "codigo": "MOTORISTA_D",
    "rotulo": "Cargo 15 — Motorista categoria D",
    "vagas": ["182528", "182567"],
    "cargos": ["CARGO 15"],
    "blocos": {
      "CURSOS": {
        "teto": 15,
        "faixas": [
          { "min_horas": 40, "max_horas": 60, "pontos": 2 },
          { "min_horas": 61, "max_horas": 119, "pontos": 4 },
          { "min_horas": 120, "max_horas": null, "pontos": 6 }
        ],
        "extras": [
          {
            "codigo": "UMCQA",
            "rotulo": "Certificado de capacitação para condução, manejo e operação de UMCQA, ou capacitação específica fornecida pela contratante",
            "pontos": 5,
            "item_edital": "8.2.6"
          }
        ]
      },
      "REQUISITO_DO_CARGO": {
        "requisitos": [
          {
            "codigo": "CNH_D",
            "rotulo": "CNH categoria D vigente",
            "motivo": "Não apresentou CNH categoria D vigente (Anexo I).",
            "item_edital": "2 e Anexo I"
          },
          {
            "codigo": "DIRECAO_DEFENSIVA",
            "rotulo": "Curso de direção defensiva",
            "motivo": "Não apresentou o curso de direção defensiva exigido para o cargo (Anexo I).",
            "item_edital": "2 e Anexo I",
            "termos": ["direção defensiva"],
            "nao_pontua_em": ["CURSOS"]
          }
        ]
      },
      "EXPERIENCIA": {
        "area": "Condução de veículos de maior porte, furgão adaptado, unidade móvel ou veículo similar (Anexo I: mínimo de 6 meses)."
      }
    }
  }
]
$por_cargo$::jsonb;
  v_regra public."TB_REGRA_ANALISE";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
  -- Autor da versão (obrigatório): sem sessão no SQL Editor, o primeiro
  -- administrador global ativo, como nas outras correções do banco.
  v_autor uuid := (
    select p.user_id from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
     order by p.user_id limit 1);
begin
  if to_regprocedure('private."FC_REGRA_DA_VAGA"(jsonb, text, text, text)') is null then
    raise exception 'Aplique antes a migration 20261013130000_regra_por_cargo.sql (diferenças por cargo).';
  end if;
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
  if jsonb_typeof(v_atual -> 'por_cargo') = 'array' and jsonb_array_length(v_atual -> 'por_cargo') > 0 then
    raise notice 'A versão vigente (%) já tem % diferença(s) por cargo: nada foi feito.',
      v_regra."NU_VERSAO_VIGENTE", jsonb_array_length(v_atual -> 'por_cargo');
    return;
  end if;

  v_nova := v_atual || jsonb_build_object('por_cargo', c_por_cargo);
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

  raise notice 'Regra do 114/2026: versão % criada a partir da % com % diferenças por cargo (situação CONFERIR).',
    v_versao, v_regra."NU_VERSAO_VIGENTE", jsonb_array_length(c_por_cargo);
end;
$$;

commit;

-- Conferência: a versão vigente, a situação, o motivo, as diferenças e o
-- que a ficha do Motorista D (vaga 182528, nível médio) passa a usar.
select r."NU_VERSAO_VIGENTE" as versao,
       r."TP_SITUACAO" as situacao,
       h."NO_VERSAO" as nome,
       h."DS_MOTIVO" as motivo,
       jsonb_array_length(h."DS_CONFIGURACAO" -> 'por_cargo') as diferencas,
       (select string_agg(d ->> 'codigo', ', ' order by n)
          from jsonb_array_elements(h."DS_CONFIGURACAO" -> 'por_cargo') with ordinality x(d, n)) as codigos,
       (select b -> 'teto' from jsonb_array_elements(
          private."FC_REGRA_DA_VAGA"(h."DS_CONFIGURACAO", '182528', null, 'medio') -> 'blocos') b
         where b ->> 'codigo' = 'CURSOS') as teto_cursos_motorista_d,
       (select b -> 'extras' -> 0 ->> 'codigo' from jsonb_array_elements(
          private."FC_REGRA_DA_VAGA"(h."DS_CONFIGURACAO", '182528', null, 'medio') -> 'blocos') b
         where b ->> 'codigo' = 'CURSOS') as extra_motorista_d,
       (select coalesce(b #> '{por_nivel,medio,teto}', b -> 'teto') from jsonb_array_elements(
          private."FC_REGRA_DA_VAGA"(h."DS_CONFIGURACAO", '182444', null, 'medio') -> 'blocos') b
         where b ->> 'codigo' = 'CURSOS') as teto_cursos_cargo_11_no_nivel
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h
    on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
