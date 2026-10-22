/*
  ENSAIO da migration 20261013130000_regra_por_cargo.sql e da correção
  supabase/correcoes/20261013-edital-114-regra-por-cargo.sql — begin … rollback.

  NÃO É MIGRATION. Rode DEPOIS das duas, na MESMA transação, e desfaça
  (Git Bash, com o ensaio.sh que embrulha tudo em begin … rollback): a
  migration e a correção sem as linhas begin/commit, e este arquivo no fim.

  Uma ficha SIMULADA do Motorista D (vaga 182528, nível médio): CNH D e
  direção defensiva conferidas, cursos de 120h, 130h e 200h (6 + 6 + 6) e o
  certificado UMCQA (+5) — 23 pelas faixas e o extra, 15 no teto do cargo — e
  30 meses de experiência (24 além do mínimo de 6: 4 períodos × 5 = 20).
  O lançamento e o resultado abaixo são os que a tela grava
  (calcularFicha + resumoParaGravar de src/lib/avaliacao-documental/ficha.js,
  com a regra vigente do 114 + as diferenças por cargo): nota 35, APTO.

  Confere, no banco:
    1. a regra da vaga (FC_REGRA_DA_VAGA) dá ao Motorista D Cursos teto 15, as
       faixas do nível médio, o extra UMCQA e os requisitos CNH_D e
       DIRECAO_DEFENSIVA; ao cargo 11 (vaga 182444), Cursos no nível (teto 10);
    2. o lançamento e o resultado passam em FC_VALIDAR_LANCAMENTO_FICHA,
       FC_VALIDAR_RESULTADO_FICHA e FC_PENDENCIAS_FICHA (nada falta);
    3. sem a diferença do cargo (a regra crua), Cursos 15 passa do teto e o
       banco recusa (como recusaria antes desta migration);
    4. sem marcar o UMCQA, falta "confira …"; com a CNH D Não confere, o
       resultado APTO é recusado (há bloco eliminatório);
    5. a validação recusa a mesma vaga em duas diferenças.
*/
do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_regra jsonb;
  v_conf jsonb;
  v_bloco jsonb;
  v_doc jsonb := private."FC_DOCUMENTAL_DO_EDITAL"(c_edital);
  v_pend text[];
  v_erro text;
  c_lanc constant jsonb := $lanc$
{
  "nivel": "medio",
  "modalidade": "AC",
  "vaga": "182528",
  "cargo": null,
  "indigena": false,
  "mora_aldeia": false,
  "aldeia_na_lista": false,
  "blocos": {
    "IDENTIDADE": {
      "situacao": "CONFORME"
    },
    "ESCOLARIDADE": {
      "situacao": "CONFORME"
    },
    "REQUISITO_DO_CARGO": {
      "situacao": "CONFORME",
      "requisitos": {
        "CNH_D": true,
        "DIRECAO_DEFENSIVA": true
      }
    },
    "REGISTRO_CONSELHO": {
      "situacao": "CONFORME"
    },
    "FORMACAO": {
      "situacao": "CONFORME",
      "edita_nota": true
    },
    "CURSOS": {
      "situacao": "CONFORME",
      "edita_nota": true,
      "extras": {
        "UMCQA": true
      }
    },
    "EXPERIENCIA": {
      "situacao": "CONFORME",
      "edita_nota": true
    }
  },
  "titulos": [],
  "cursos": [
    {
      "nome": "Primeiros socorros",
      "horas": 120,
      "aceito": true
    },
    {
      "nome": "Transporte de cargas",
      "horas": 130,
      "aceito": true
    },
    {
      "nome": "Mecânica básica",
      "horas": 200,
      "aceito": true
    }
  ],
  "vinculos": [
    {
      "empregador": "Transportadora X",
      "categoria": "AREA",
      "inicio": "2022-01-01",
      "fim": "2024-06-30",
      "aceito": true
    }
  ],
  "estagio_horas": 0,
  "observacoes": "",
  "observacoes_prontas": []
}
$lanc$::jsonb;
  c_res constant jsonb := $res$
{
  "resultado": "APTO",
  "nota_apurada": 35,
  "nota_final": 35,
  "nota_minima": 10,
  "parciais": {
    "FORMACAO": 0,
    "CURSOS": 15,
    "EXPERIENCIA": 20
  },
  "calculados": {
    "FORMACAO": 0,
    "CURSOS": 15,
    "EXPERIENCIA": 20
  },
  "ajustes": {},
  "declarada": {},
  "eliminatorios": [],
  "encaminhamentos": [],
  "observacoes": [],
  "experiencia": {
    "dias_total": 912,
    "meses": 30,
    "meses_considerados": 30,
    "por_categoria": {
      "AREA": {
        "dias_total": 912,
        "anos": 2,
        "meses": 6,
        "dias": 2,
        "desempate": null
      }
    }
  }
}
$res$::jsonb;
  v_lanc jsonb;
begin
  select h."DS_CONFIGURACAO" into v_regra
    from public."TB_REGRA_ANALISE" r
    join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
   where r."CO_MONITORAMENTO" = c_edital;
  if jsonb_typeof(v_regra -> 'por_cargo') is distinct from 'array' then
    raise exception 'ENSAIO: a correção não foi aplicada (a regra vigente não tem por_cargo).';
  end if;

  -- 1. A regra da vaga.
  v_conf := private."FC_REGRA_DA_VAGA"(v_regra, '182528', null, 'medio');
  select b into v_bloco from jsonb_array_elements(v_conf -> 'blocos') b where b ->> 'codigo' = 'CURSOS';
  if (v_bloco -> 'teto') is distinct from '15'::jsonb or v_bloco #>> '{extras,0,codigo}' is distinct from 'UMCQA'
     or v_bloco #>> '{faixas,2,pontos}' is distinct from '6' or v_bloco ? 'por_nivel' then
    raise exception 'ENSAIO 1: Cursos do Motorista D errado: %', v_bloco;
  end if;
  select b into v_bloco from jsonb_array_elements(v_conf -> 'blocos') b where b ->> 'codigo' = 'REQUISITO_DO_CARGO';
  if (select string_agg(q ->> 'codigo', ',') from jsonb_array_elements(v_bloco -> 'requisitos') q) is distinct from 'CNH_D,DIRECAO_DEFENSIVA'
     or not exists (select 1 from jsonb_array_elements(v_bloco -> 'motivos') m where m ->> 'codigo' = 'CNH_D' and m ->> 'efeito' = 'ELIMINA') then
    raise exception 'ENSAIO 1: requisitos do Motorista D errados: %', v_bloco;
  end if;
  if v_conf #>> '{cargo,codigo}' is distinct from 'MOTORISTA_D' then
    raise exception 'ENSAIO 1: diferença escolhida errada: %', v_conf -> 'cargo';
  end if;
  select coalesce(b #> '{por_nivel,medio,teto}', b -> 'teto') into v_bloco
    from jsonb_array_elements(private."FC_REGRA_DA_VAGA"(v_regra, '182444', null, 'medio') -> 'blocos') b
   where b ->> 'codigo' = 'CURSOS';
  if v_bloco is distinct from '10'::jsonb then
    raise exception 'ENSAIO 1: o cargo 11 deveria seguir o nível médio (teto 10): %', v_bloco;
  end if;

  -- 2. A ficha simulada passa nas três conferências do banco.
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_conf, c_lanc);
  perform private."FC_VALIDAR_RESULTADO_FICHA"(v_conf, c_lanc, c_res, v_doc);
  v_pend := private."FC_PENDENCIAS_FICHA"(v_conf, c_lanc, c_res);
  if cardinality(v_pend) > 0 then
    raise exception 'ENSAIO 2: pendências inesperadas: %', v_pend;
  end if;

  -- 3. Sem a diferença do cargo, Cursos 15 passa do teto do nível.
  begin
    perform private."FC_VALIDAR_RESULTADO_FICHA"(v_regra - 'por_cargo', c_lanc, c_res, v_doc);
    raise exception 'ENSAIO 3: a regra sem diferença deveria recusar Cursos 15';
  exception when sqlstate '22023' then
    get stacked diagnostics v_erro = message_text;
    raise notice 'ENSAIO 3 (esperado): %', v_erro;
  end;

  -- 4. O extra sem marcar falta; a CNH D Não confere elimina.
  v_lanc := c_lanc #- '{blocos,CURSOS,extras}';
  v_pend := private."FC_PENDENCIAS_FICHA"(v_conf, v_lanc, c_res);
  if cardinality(v_pend) <> 1 or v_pend[1] not like 'Cursos%: confira Certificado%' then
    raise exception 'ENSAIO 4: esperava a falta do UMCQA: %', v_pend;
  end if;
  v_lanc := jsonb_set(c_lanc, '{blocos,REQUISITO_DO_CARGO}',
                      '{"situacao": "NAO_CONFORME", "motivos": ["CNH_D"], "requisitos": {"CNH_D": false, "DIRECAO_DEFENSIVA": true}}');
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_conf, v_lanc);
  begin
    perform private."FC_VALIDAR_RESULTADO_FICHA"(v_conf, v_lanc, c_res, v_doc);
    raise exception 'ENSAIO 4: CNH D Não confere deveria exigir Inapto por requisito';
  exception when sqlstate '22023' then
    get stacked diagnostics v_erro = message_text;
    raise notice 'ENSAIO 4 (esperado): %', v_erro;
  end;
  begin
    perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra - 'por_cargo', v_lanc);
    raise exception 'ENSAIO 4: o motivo CNH_D só existe na regra da vaga';
  exception when sqlstate '22023' then null;
  end;

  -- 5. A mesma vaga em duas diferenças.
  begin
    perform private."FC_VALIDAR_REGRA_ANALISE"(jsonb_set(v_regra, '{por_cargo,0,vagas}', '["182528"]'));
    raise exception 'ENSAIO 5: a vaga repetida deveria ser recusada';
  exception when sqlstate '22023' then
    get stacked diagnostics v_erro = message_text;
    raise notice 'ENSAIO 5 (esperado): %', v_erro;
  end;
end;
$$;

select 'ENSAIO OK' as ensaio,
       r."NU_VERSAO_VIGENTE" as versao_nova,
       r."TP_SITUACAO" as situacao,
       h."DS_MOTIVO" as motivo,
       jsonb_array_length(h."DS_CONFIGURACAO" -> 'por_cargo') as diferencas,
       35 as nota_motorista_d_simulada,
       '{"FORMACAO": 0, "CURSOS": 15, "EXPERIENCIA": 20}'::jsonb as parciais_motorista_d
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
