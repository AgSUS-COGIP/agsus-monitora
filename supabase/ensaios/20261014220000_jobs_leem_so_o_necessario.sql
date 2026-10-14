/*
  ENSAIO da migration 20261014220000_jobs_leem_so_o_necessario.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  ensaio_arquivo <migration> "$(cat <este arquivo>)"), e desfaça.

  Confere, no 114/2026 (30 vagas, ~7.388 inscritos):
    1. pre_classificacao_ler_colunas traz os nomes, sem nenhuma coluna do cadastro;
    2. pre_classificacao_ler_candidatos com p_colunas = TODOS os nomes, remontado
       ({p_colunas[posição]: valor}), é igual ao "colunas" da leitura antiga, inscrito a
       inscrito, na maior vaga e numa média; e os outros campos são os mesmos (sem os nulos);
    3. ler_respostas_pergunta_vaga com p_compacto, remontado, é igual à antiga;
    4. pre_classificacao_ler_editais traz "sem_mudanca" (falso fora do fim do robô);
    5. anon e authenticated não executam as funções novas.
  Medido em 14/10 (ensaio): pré-classificação do 114 com as colunas da regra vigente
  (83 de 169 nomes) 38,9 MB → 4,6 MB; resumo das perguntas do 114 27,2 MB → 1,5 MB.
*/
do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_nomes text[];
  v_vaga text;
  v_antiga jsonb;
  v_nova jsonb;
  v_dif integer;
begin
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);

  -- 1. Os nomes, sem o cadastro.
  select array_agg(x) into v_nomes
    from jsonb_array_elements_text(public.pre_classificacao_ler_colunas(v_edital) -> 'colunas') x;
  if cardinality(v_nomes) < 50 then
    raise exception 'ENSAIO 1: poucos nomes de coluna: %', cardinality(v_nomes);
  end if;
  if exists (select 1 from unnest(v_nomes) n
              where lower(n) not like 'pergunta %'
                and lower(n) ~ '(nome|e-?mail|cpf|telefone|celular|whatsapp|endere|logradouro|bairro|cep|nascimento|linkedin|^rg$|documento)') then
    raise exception 'ENSAIO 1: coluna do cadastro na lista';
  end if;

  -- 2. A leitura enxuta com todos os nomes, remontada, é a leitura antiga.
  foreach v_vaga in array array['182493', '182444'] loop
    if not exists (select 1 from public."TB_EMPREGARE_VAGA" where "CO_VAGA" = v_vaga and "CO_MONITORAMENTO" = v_edital) then
      continue;
    end if;
    v_antiga := public.pre_classificacao_ler_candidatos(v_edital, v_vaga, null, null, null) -> 'candidatos';
    v_nova := public.pre_classificacao_ler_candidatos(v_edital, v_vaga, null, null, v_nomes) -> 'candidatos';
    if jsonb_array_length(v_antiga) <> jsonb_array_length(v_nova) then
      raise exception 'ENSAIO 2: vaga % com % inscritos na antiga e % na nova', v_vaga,
        jsonb_array_length(v_antiga), jsonb_array_length(v_nova);
    end if;
    select count(*) into v_dif
      from jsonb_array_elements(v_antiga) with ordinality a(c, i)
      join jsonb_array_elements(v_nova) with ordinality n(c, i) using (i)
     where a.c -> 'colunas' is distinct from coalesce((
             select jsonb_object_agg(v_nomes[(k.key)::integer + 1], k.value)
               from jsonb_each(n.c -> 'c') k), '{}'::jsonb)
        or jsonb_strip_nulls(a.c - 'colunas') is distinct from (n.c - 'c');
    if v_dif > 0 then
      raise exception 'ENSAIO 2: vaga % com % inscritos diferentes', v_vaga, v_dif;
    end if;
  end loop;

  -- 3. Respostas compactas, remontadas, são as antigas.
  v_antiga := public.ler_respostas_pergunta_vaga('182444');
  v_nova := public.ler_respostas_pergunta_vaga('182444', true);
  if (v_antiga -> 'candidatos') is distinct from (v_nova -> 'candidatos') then
    raise exception 'ENSAIO 3: contagem diferente';
  end if;
  select count(*) into v_dif
    from jsonb_array_elements(v_antiga -> 'linhas') with ordinality a(l, i)
    full join (select i, (select jsonb_object_agg(c.nome, x.valor)
                             from jsonb_array_elements(n.l) with ordinality x(valor, j)
                             join jsonb_array_elements_text(v_nova -> 'colunas') with ordinality c(nome, j) using (j)
                            where jsonb_typeof(x.valor) <> 'null') as l
                 from jsonb_array_elements(v_nova -> 'linhas') with ordinality n(l, i)) n using (i)
   where a.l is distinct from n.l;
  if v_dif > 0 then
    raise exception 'ENSAIO 3: % linhas diferentes', v_dif;
  end if;

  -- 4. "sem_mudanca" em cada edital; falso quando os editais são pedidos.
  if exists (select 1 from jsonb_array_elements(public.pre_classificacao_ler_editais(array['114/2026'], false) -> 'editais') e
              where not (e ? 'sem_mudanca') or (e ->> 'sem_mudanca')::boolean) then
    raise exception 'ENSAIO 4: sem_mudanca ausente ou verdadeiro fora do fim do robô';
  end if;

  -- 5. Só service_role.
  if has_function_privilege('authenticated', 'public.pre_classificacao_ler_colunas(uuid)', 'execute')
     or has_function_privilege('anon', 'public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer, text[])', 'execute')
     or has_function_privilege('authenticated', 'public.ler_respostas_pergunta_vaga(text, boolean)', 'execute') then
    raise exception 'ENSAIO 5: anon ou authenticated executa função do job';
  end if;
end;
$$;

select 'ENSAIO OK' as resultado,
       (select jsonb_agg(jsonb_build_object('rotulo', e ->> 'rotulo', 'sem_mudanca', e -> 'sem_mudanca'))
          from jsonb_array_elements(public.pre_classificacao_ler_editais(null, true) -> 'editais') e) as apos_robo;
