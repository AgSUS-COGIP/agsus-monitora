/*
  CORREÇÃO DE DADOS — a modalidade do Edital 114/2026 (Projetos, PES Rio Doce
  AgSUS/FUNASA, id bcecfb08-88ef-4e06-8401-bcad6bf88fd0) pela pergunta do
  sistema de concorrência.

  PRÉ-REQUISITO: a migration 20261015020000_modalidade_pela_pergunta.sql
  aplicada (cotas da regra de classificação para o job, fichas e linhas
  publicadas seguindo a modalidade). Este script não depende do número da
  versão: parte da VIGENTE no momento da execução.

  O PROBLEMA: a regra da avaliação do 114 não tem o bloco MODALIDADE, de onde
  a pré-classificação lê a modalidade (pre_classificacao.py,
  modalidade_do_candidato). Sem ele, os 1.342 inscritos do lote ficaram AC,
  as linhas publicadas ficaram "Ampla concorrência" e os blocos de cota
  (condição MODALIDADE=PP/PI/PQ/PCD) não valem para ninguém. Em 14/10, no
  lote: "Ampla concorrência" 1052, "Pretos ou pardos" 183, "Ampla
  concorrência", "Pretos ou pardos" 47, "Pessoas com deficiência (PCD)" 42,
  e mais 18 com outras combinações (Indígenas, Quilombolas, PcD com ampla,
  mais de uma cota); PCD = SIM 40.

  O QUE FAZ: cria uma NOVA versão (vigente + 1), igual à vigente, com o bloco
  MODALIDADE (tipo REGISTRO: só mostra a resposta na ficha, não pede
  situação) antes dos blocos de cota, com duas perguntas:
    - "Indique em qual sistema de concorrência" — a resposta, inclusive a
      múltipla, dá a modalidade (a cota marcada prevalece sobre a ampla; com
      mais de uma cota, o acúmulo da regra de classificação, hoje
      MAIOR_PERCENTUAL → a de maior percentual, PP 25%);
    - "PCD" — a coluna da Empregare: SIM conta como PcD.
  Todo o resto (por_cargo, demais blocos, perguntas, faixas, observações)
  fica igual. A situação volta para CONFERIR, como em toda versão nova: o job
  só pré-classifica o edital com a regra CONFERIDA (confira antes do refazer).

  Depois de conferida, a próxima pré-classificação grava a modalidade de cada
  inscrito; no fim dela, FC_ABRIR_FICHAS leva a modalidade às fichas não
  concluídas com lançamento gravado (histórico MODALIDADE) e publica de novo
  as linhas com modalidade ou PcD diferente.

  Assinada pelo usuário a01afddb-f64b-47d9-80e8-476a1ed14e43.

  Rode no SQL Editor (papel postgres). Idempotente: se a vigente já tem o
  bloco MODALIDADE, não faz nada (avisa). Para ensaiar, troque o commit por
  rollback. Termina com o SELECT de conferência.
*/
begin;

do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_autor constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  c_motivo constant text := 'Modalidade pela pergunta do sistema de concorrência e pela coluna PCD (o lote estava todo em AC)';
  c_nome constant text := 'Modalidade pela pergunta';
  c_bloco constant jsonb := $bloco$
{
  "codigo": "MODALIDADE",
  "titulo": "Sistema de concorrência",
  "tipo": "REGISTRO",
  "item_edital": "5",
  "perguntas": ["Indique em qual sistema de concorrência", "PCD"],
  "efeitos": {},
  "motivos": []
}
$bloco$::jsonb;
  v_regra public."TB_REGRA_ANALISE";
  v_atual jsonb;
  v_nova jsonb;
  v_versao integer;
  v_blocos jsonb := '[]'::jsonb;
  v_b record;
  v_inserido boolean := false;
begin
  if not exists (select 1 from auth.users where id = c_autor) then
    raise exception 'Usuário % não encontrado para assinar a versão', c_autor;
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

  if exists (select 1 from jsonb_array_elements(v_atual -> 'blocos') b where b ->> 'codigo' = 'MODALIDADE') then
    raise notice 'A versão vigente (%) já tem o bloco MODALIDADE: nada foi feito.', v_regra."NU_VERSAO_VIGENTE";
    return;
  end if;

  -- O bloco MODALIDADE entra antes do primeiro bloco de cota (ou no fim, se não houver).
  for v_b in select b.value from jsonb_array_elements(v_atual -> 'blocos') with ordinality b order by b.ordinality loop
    if not v_inserido and v_b.value ->> 'tipo' = 'COTA' then
      v_blocos := v_blocos || jsonb_build_array(c_bloco);
      v_inserido := true;
    end if;
    v_blocos := v_blocos || jsonb_build_array(v_b.value);
  end loop;
  if not v_inserido then
    v_blocos := v_blocos || jsonb_build_array(c_bloco);
  end if;

  v_nova := jsonb_set(v_atual, '{blocos}', v_blocos);
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_nova);
  v_versao := v_regra."NU_VERSAO_VIGENTE" + 1;

  insert into public."TH_REGRA_ANALISE"
    ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_ANALISE", v_versao, v_nova,
          encode(sha256(convert_to(v_nova::text, 'UTF8')), 'hex'), c_motivo, c_autor,
          private."FC_NOME_DA_VERSAO"(c_nome));

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_versao, "TP_SITUACAO" = 'CONFERIR',
         "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = c_autor
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  raise notice 'Regra do 114/2026: versão % criada a partir da % com o bloco MODALIDADE (situação CONFERIR).',
    v_versao, v_regra."NU_VERSAO_VIGENTE";
end;
$$;

commit;

-- Conferência: versão, situação, nome, motivo e o bloco MODALIDADE com o bloco seguinte.
select r."NU_VERSAO_VIGENTE" as versao,
       r."TP_SITUACAO" as situacao,
       h."NO_VERSAO" as nome,
       h."DS_MOTIVO" as motivo,
       b.n as posicao,
       b.x ->> 'codigo' as bloco,
       b.x ->> 'tipo' as tipo,
       b.x -> 'perguntas' as perguntas
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h
    on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
  cross join lateral jsonb_array_elements(h."DS_CONFIGURACAO" -> 'blocos') with ordinality b(x, n)
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'
   and (b.x ->> 'codigo' = 'MODALIDADE' or b.x ->> 'tipo' = 'COTA')
 order by b.n;
