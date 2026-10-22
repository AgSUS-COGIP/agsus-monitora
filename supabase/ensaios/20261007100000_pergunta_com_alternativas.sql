/*
  ENSAIO de 20261007100000_pergunta_com_alternativas.sql — begin … rollback.

  PRÉ-REQUISITO: as migrations até 20261006120500 aplicadas.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (\i não existe
  no SQL Editor: cole o corpo dela, sem o begin/commit, no lugar indicado) e:
    E1  confere FC_JSON_PERGUNTA_OK (texto, lista, lista vazia, texto vazio na
        lista, número, mais de 10 alternativas, texto longo);
    E2  confere a validação da regra com a pergunta da nota declarada em lista
        (aceita) e em lista vazia (recusa);
    E3  aplica supabase/correcoes/20261007-perguntas-pelo-texto.sql (cole o
        corpo, sem o begin/commit) e mostra os três modelos.
  No fim, rollback: nada fica gravado.
*/
begin;

-- >>> cole aqui o corpo de supabase/migrations/20261007100000_pergunta_com_alternativas.sql

-- E1
do $$
begin
  if not private."FC_JSON_PERGUNTA_OK"('"Experiência Profissional"', true) then raise exception 'E1: texto recusado'; end if;
  if not private."FC_JSON_PERGUNTA_OK"('["Selecione sua Experiência", "Marque a pontuação"]', true) then raise exception 'E1: lista recusada'; end if;
  if not private."FC_JSON_PERGUNTA_OK"(null, false) then raise exception 'E1: vazio opcional recusado'; end if;
  if private."FC_JSON_PERGUNTA_OK"(null, true) then raise exception 'E1: vazio obrigatório aceito'; end if;
  if private."FC_JSON_PERGUNTA_OK"('[]', false) then raise exception 'E1: lista vazia aceita'; end if;
  if private."FC_JSON_PERGUNTA_OK"('["a", " "]', true) then raise exception 'E1: texto vazio na lista aceito'; end if;
  if private."FC_JSON_PERGUNTA_OK"('["a", 1]', true) then raise exception 'E1: número na lista aceito'; end if;
  if private."FC_JSON_PERGUNTA_OK"('17', true) then raise exception 'E1: número aceito'; end if;
  if private."FC_JSON_PERGUNTA_OK"('["1","2","3","4","5","6","7","8","9","10","11"]', true) then raise exception 'E1: 11 alternativas aceitas'; end if;
  if private."FC_JSON_PERGUNTA_OK"(to_jsonb(repeat('x', 201)), true) then raise exception 'E1: texto longo aceito'; end if;
  raise notice 'E1 ok';
end;
$$;

-- E2
do $$
declare
  v_regra jsonb := (select "DS_CONFIGURACAO" from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'SI26-100');
begin
  perform private."FC_VALIDAR_REGRA_ANALISE"(jsonb_set(v_regra, '{provisoria,nota_declarada,1,pergunta}',
    '["Você é indígena e mora em aldeia", "Você é indígena"]'));
  begin
    perform private."FC_VALIDAR_REGRA_ANALISE"(jsonb_set(v_regra, '{provisoria,nota_declarada,1,pergunta}', '[]'));
    raise exception 'E2: lista vazia aceita';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'E2 ok';
end;
$$;

-- E3: >>> cole aqui o corpo de supabase/correcoes/20261007-perguntas-pelo-texto.sql

rollback;
