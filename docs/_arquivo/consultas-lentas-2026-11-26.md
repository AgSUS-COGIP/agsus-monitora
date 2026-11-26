---
tipo: referencia
area: banco
atualizado: 2026-11-26
---

# Consultas lentas no banco: causas e proposta — 26/11/2026

Lote 2 da auditoria de 26/11/2026 ([auditoria das telas](auditoria-telas-2026-11-26.md)): as seis
RPCs mais lentas do `pg_stat_statements` desde 16/11. **Nada foi aplicado nem rodado no banco.**

**Estado:** diagnóstico **estático**, pela leitura do corpo de cada função e das que ela chama em
`supabase/esquema-atual.sql` (as linhas citadas são desse arquivo). O `EXPLAIN (ANALYZE, BUFFERS)`
contra o banco ainda não rodou: o acesso de leitura a produção não foi liberado nesta sessão. Por
isso o "ganho esperado" abaixo é estimativa; a seção [Para medir](#para-medir) traz as consultas que
confirmam cada causa e medem o ganho, todas em `begin read only; … rollback;`.

| RPC | Média | Pior | Causa principal (certeza no código) |
| --- | --- | --- | --- |
| `listar_vagas_por_cargo_da_visao_geral` | 2,8 s | 9,8 s | `FC_CARGO_DA_GRAFIA` por linha de vaga e de quadro, e ela sem usar índice |
| `get_selecao_da_area_se_mudou` | 2,7 s | 7,7 s | `FC_EM_OUTRA_LISTA` ~2× por candidato, em duas varreduras iguais dos candidatos |
| `listar_acompanhamento_da_visao_geral_se_mudou` | 1,3 s | 7,9 s | a marca muda muito (pacote remontado) + `FC_EM_OUTRA_LISTA` por contratado |
| `listar_editais_classificacao` | 1,3 s | 8 s | `FC_NUMERO_EDITAL` (regex) por análise ativa da área, com leitura no heap |
| `abrir_lista_aprovados` | 0,9 s | 10,4 s | remonta o pacote da área **antes** de comparar a versão |
| `alterar_status_candidato_aprovado` | 0,5 s | 6,4 s | gatilhos e recálculos em cascata; pior caso: provável espera por trava |

## O que vale para todas

- **Função auxiliar por linha não é "inlined".** Quase todas as `private."FC_…"` têm
  `SET search_path TO ''` (e algumas `SECURITY DEFINER`). O PostgreSQL nunca expande dentro da
  consulta uma função SQL com cláusula `SET`: cada linha paga uma chamada completa (troca de GUC,
  executor próprio, subconsultas próprias). É regra do PostgreSQL, não hipótese. As correções abaixo
  tiram essas chamadas do laço (junção ou cálculo uma vez), sem mudar a regra.
- **Índice não falta** nos filtros por edital, lista ou área: os que importam existem. O custo está
  no trabalho por linha.
- **Os piores casos ficam colados em 8 s**, o `statement_timeout` padrão do papel `authenticated`
  na Supabase (conferir o valor atual). O `pg_stat_statements` só conta o que terminou: pode haver
  chamadas canceladas por tempo que nem aparecem. Conferir nos logs: `canceling statement due to
  statement timeout`.
- **Nenhuma correção muda assinatura de RPC pública** (o `src/lib/rpc-contrato.ts` não muda), salvo
  as opções B e C de `abrir_lista_aprovados`, marcadas.

## 1. `listar_vagas_por_cargo_da_visao_geral(p_area, p_editais)` — 2,8 s / 9,8 s

A tela inicial (Visão geral) chama com os ids de todos os editais da área (~220).

- **Causa 1 (certeza):** `private."FC_CARGO_DA_GRAFIA"(NO_CARGO, v_area)` em cada linha de
  `TB_SELECAO_VAGA` (33719) e de `TB_QUADRO_VAGA_EDITAL` (33731). O mesmo nome de cargo se repete
  muito e a função recalcula tudo a cada linha; é `SECURITY DEFINER` com `SET` (2850), não expande.
- **Causa 2 (hipótese forte, PG ≤ 17):** dentro de `FC_CARGO_DA_GRAFIA`, o filtro
  `(p_area is null or c."CO_AREA" = p_area)` (2859, 2867) com plano genérico impede usar `CO_AREA`
  como chave dos índices que existem (`IN_TDCARGO_AREA_NOME` (CO_AREA, FC_NORMALIZAR_GRAFIA_CARGO
  (NO_CARGO)), 67839; `UK_TDCARGOAPELIDO_AREA_GRAFIA`, 65553). Resultado provável: varredura de
  `TD_CARGO` com `FC_NORMALIZAR_GRAFIA_CARGO` (translate + 2 regex, também com `SET`) **por cargo
  da tabela, por linha de vaga**.
- **Correção (sem índice novo, mesma saída):**
  - (a) na RPC, resolver o cargo **uma vez por grafia distinta**: um `jsonb_object_agg(nome,
    FC_CARGO_DA_GRAFIA(nome, v_area))` sobre a `union` dos `NO_CARGO` não nulos das vagas e do
    quadro, e `(v_cargos ->> s."NO_CARGO")::integer` nas linhas 33719 e 33731;
  - (b) em `FC_CARGO_DA_GRAFIA`, separar os ramos `p_area is not null` / `p_area is null` (union de
    quatro ramos), para `CO_AREA = p_area` e a grafia normalizada do parâmetro casarem com os dois
    índices. Mesma assinatura e regra; os outros chamadores ganham junto.
- **Ganho esperado:** de "linhas × cargos × normalização" para "grafias distintas × 2 buscas no
  índice". Estimativa: de segundos para 100–300 ms, o resto sendo o `jsonb_agg`.

## 2. `get_selecao_da_area_se_mudou(p_area, p_versao)` — 2,7 s / 7,7 s

- O "se mudou" está bem feito: a marca (`FC_MARCA_DA_RPC` → `FC_MARCA_DA_LEITURA`, 9201–9340) é
  barata e vem antes de montar. O custo é das chamadas em que a marca não bate e
  `get_selecao_da_area` (27397–27529) monta tudo.
- **Causa 1 (certeza):** `FC_EM_OUTRA_LISTA(c.id)` (4672, `SET`, até 3 buscas por chave) aparece
  nas **duas** contagens de `aprovados` (27445–27446) e de novo nas duas de `aprovados_por_cargo`
  (27459–27460): ~2 chamadas por candidato vivo das listas vigentes da área, mais 2 por contratado,
  e **a varredura dos candidatos é feita duas vezes**.
- **Causa 2 (certeza):** `FC_TEXTO_BUSCA_RECURSO` + `regexp_replace` em todo candidato
  (`aprovados_por_cargo`, 27455), embora só sirva a vagas sem `CO_VAGA`.
- **Causa 3 (certeza; peso pequeno):** `exists (select … from listas …)` correlacionado sobre o CTE
  (27470); `FC_ENTREVISTAS_VIGENTES` (4696) ordena todas as entrevistas ativas da área.
- **Causa 4 (certeza, front):** a Aya chama sem `p_versao` (`src/modulos/aya/fontes.ts:166-168`):
  toda chamada dela monta o pacote inteiro.
- **Correção (mesma saída):** um CTE `cand as materialized` com **uma** passada pelos candidatos e
  dois `left join` em `TB_CONTRATACAO_APROVADO` (pela PK: a linha e o `CO_CANDIDATO_ANTERIOR`) que
  dão `em_outra_lista` com a mesma regra de `FC_EM_OUTRA_LISTA`; `aprovados` e `aprovados_por_cargo`
  agrupam esse CTE. `tem_lista` como `IN (select edital_id from listas)` (subplano com hash). Do
  lado do front, a Aya mandar a versão guardada.
- **Ganho esperado:** zero chamadas de função por candidato (eram ~2N) e uma varredura em vez de
  duas. É o maior ganho das seis. Teste de equivalência obrigatório: `FC_EM_OUTRA_LISTA(c.id)` ×
  expressão nova em todas as linhas (PGlite e `EXCEPT` nos dois sentidos no ensaio).

## 3. `listar_acompanhamento_da_visao_geral_se_mudou(p_area, p_versao)` — 1,3 s / 7,9 s

- **Causa 1 (hipótese, depende de dados):** a marca é por pessoa (inclui `auth.uid()`, e-mail e
  papel, 9208–9210) e muda com **qualquer** escrita em qualquer fonte da leitura (gatilho
  `FC_TG_VERSAO_FONTE`, 16862). As fontes saem do código por casamento de nomes e incluem
  `TB_MONITORAMENTO_INDIGENA`, `TB_CANDIDATO_APROVADO` e `TB_CONTRATACAO_APROVADO`, que robôs e a
  tela de aprovados escrevem o tempo todo, e as tabelas de permissão. Então a montagem completa deve
  ser frequente.
- **Causa 2 (certeza):** `FC_EM_OUTRA_LISTA(c.id)` por candidato Contratado/Migração na contagem de
  listas (30194).
- **Causa 3 (hipótese):** `raw_json` de `TB_MONITORAMENTO_INDIGENA` lido até 4 vezes por edital
  (30206–30211); pesa se for grande (TOAST).
- **Correção:**
  - (a) a mesma junção de `TB_CONTRATACAO_APROVADO` no lugar de `FC_EM_OUTRA_LISTA` (mesma saída);
  - (b) se a causa 3 se confirmar, ler `raw_json -> 'resultado_final_conferido'` uma vez por edital
    (CTE materializado);
  - (c) medir quais fontes giram (consulta abaixo); coluna atualizada que a leitura não usa vai para
    `private."TD_COLUNA_SEM_MARCA"` (dado, não DDL). Se a fonte que gira for de permissão, avaliar
    tirá-la da marca: a permissão já é conferida a cada chamada em `FC_MARCA_DA_RPC`.
- **Ganho esperado:** (a) moderado; o ganho grande vem de (c), aumentando a taxa de `inalterado`.

## 4. `listar_editais_classificacao(p_area)` — 1,3 s / 8 s

- **Causa 1 (certeza):** o CTE `an` (31483–31488) agrega **todas** as análises ativas da área
  (`TB_ANALISE_CURRICULAR`, tabela larga) calculando `FC_NUMERO_EDITAL(a.edital)` (regex, `SET`) por
  linha. O índice de expressão `IN_ANALISECURR_AREANUMEDITAL` (CO_AREA, FC_NUMERO_EDITAL(edital))
  WHERE ativo (65997) não evita o cálculo nem a ida ao heap: sem a coluna `edital` no índice, não há
  index-only scan.
- **Causa 2 (certeza):** conta a área inteira, inclusive editais que não estão em `m`.
- **Causa 3 (hipótese):** plano genérico do plpgsql com áreas de tamanhos muito diferentes.
- **Correção:**
  - índice com `INCLUDE (edital)`, criado com `CONCURRENTLY` (fora de transação) e, conferido o
    plano, sai o antigo:
    `CREATE INDEX CONCURRENTLY "IN_ANALISECURR_AREANUMEDITAL_INCL" ON public."TB_ANALISE_CURRICULAR"
    USING btree ("CO_AREA", private."FC_NUMERO_EDITAL"(edital)) INCLUDE (edital) WHERE ativo;`
  - `an` passa a contar só os números de edital distintos de `m` (subconsulta por número, mesma
    junção `an.numero = m.numero`, mesma saída).
- **Ganho esperado:** de uma chamada + leitura no heap por análise ativa para uma busca index-only
  por número de edital (dezenas a centenas). Ressalva: depende do *visibility map* de uma tabela
  muito atualizada pelo sync (olhar `Heap Fetches`). Plano B: contagem `(CO_AREA, NU_EDITAL,
  QT_ATIVA)` mantida pelo robô das análises.

## 5. `abrir_lista_aprovados(p_area, p_versao, p_com_candidatos)` — 0,9 s / 10,4 s

- **Causa 1 (certeza; explica o pior caso):** em `listar_candidatos_aprovados_compacto`
  (30684–30832), com o pacote marcado como desatualizado, quem vê a área inteira **remonta e grava**
  o pacote (`atualizar_cache_aprovados` → `FC_MONTAR_APROVADOS_AREA`, 30774–30780) **antes** de
  calcular a versão e compará-la com `p_versao` (30784–30795). Toda escrita em
  `TB_CANDIDATO_APROVADO` marca o pacote (gatilho `TG_CANDAPROV_CACHE_UPD`), inclusive a RPC 6, e o
  cron que remonta roda a cada 2 min: quem abre a lista nesse intervalo paga a montagem completa.
- **Causa 2 (certeza):** a versão só vale para o pacote; listas, configuração, anexos, convocações e
  pendências (20180–20261) são montados e enviados em toda chamada.
- **Causa 3 (certeza):** em `listar_pendencias_do_edital` (32688), `FC_PODE_DECIDIR_PENDENCIA`,
  `is_master()` e `FC_PODE_VER_EDITAL` **por pendência** (32704, 32710); para quem tem coordenação,
  isso normaliza a unidade de cada edital da área 2–3 vezes por pendência.
- **Causa 4 (certeza):** `listar_convocacoes_aprovados` parte de **todas** as linhas de
  `RL_CARTA_CANDIDATO`, de todas as áreas (31275), na recursão dos herdeiros, e só filtra no fim.
- **Correção (sem mudar assinatura):**
  - A: comparar a versão (pacote + marcas) com `p_versao` **antes** de remontar;
  - D: permissões de pendência calculadas uma vez (`v_master`, `v_decide`, `v_areas`, `v_vis` em
    variáveis), equivalente a `FC_PODE_VER_EDITAL` porque a linha já é a do edital;
  - E: recortar a área no início da recursão das convocações (confirmar antes que o herdeiro fica
    no mesmo edital).
  - **Mudam a resposta (contrato e front):** C — marca do conjunto inteiro (`FC_MARCA_DA_RPC` com
    caso `abrir_lista_aprovados`, devolvendo `inalterado` sem montar parte alguma); B — pacote +
    linhas alteradas desde a geração.
- **Ganho esperado:** A tira a montagem do caminho de quem já tem a versão; D e E cortam o custo
  fixo de toda abertura. O tamanho real sai de `TA_CANDIDATO_APROVADO_AREA."NU_DURACAO_MS"`.

## 6. `alterar_status_candidato_aprovado(…)` — 0,5 s / 6,4 s

Escrita de uma linha, mas com cascata (certeza no código):

- `FC_EXIGIR_AREA_EDITAL` filtra `m.id::text = p_edital_id` (5165): o cast na coluna impede a PK
  (varredura de `TB_MONITORAMENTO_INDIGENA`); o mesmo `m.id::text = l.edital_id` está no gatilho de
  cache (16112).
- O histórico (`TH_CANDIDATO_APROVADO`) dispara `FC_TG_CONTRATACAO_BASE_MUDOU` (16341): `DELETE …
  WHERE CO_CANDIDATO_APROVADO IN (…) OR (CO_MONITORAMENTO::text, DS_VINCULO) IN (…)` — o `OR` com
  cast impede os índices — e, envolvendo Contratado, dispara o robô de contratação (pg_net).
- `FC_ATUALIZAR_CONTRATADOS_DO_EDITAL` (1575) chama `FC_EM_OUTRA_LISTA` por contratado e faz
  `UPDATE` na linha do edital em `TB_MONITORAMENTO_INDIGENA`, que **trava a linha até o commit** e
  dispara o histórico com `to_jsonb` da linha inteira (com `raw_json`) e a versão das fontes, o que
  invalida o "se mudou" da Visão geral e da Seleção (RPCs 2 e 3).
- `SELECT … FOR UPDATE` no candidato e na lista (20635, 20648).
- **Hipótese principal do pior caso: espera por trava** da linha do edital (as cargas que atualizam
  `TB_MONITORAMENTO_INDIGENA` em lote, como `FC_ATUALIZAR_KPIS_PELA_SELECAO`, 1913–1933) ou da
  lista (o laço de "marcar em outra lista" no front faz uma RPC por linha).
- **Correção:**
  - `for no key update` no lugar de `for update` (continua serializando quem muda a mesma lista;
    deixa de bloquear as checagens de FK de outras sessões). Não usar `FOR SHARE`;
  - tirar o cast: `m.id = p_edital_id::uuid` (guardado por regex de uuid);
  - dividir o `DELETE` do gatilho em dois, um por índice;
  - a junção de `TB_CONTRATACAO_APROVADO` no lugar de `FC_EM_OUTRA_LISTA` no recálculo;
  - **decisão do usuário:** tirar o recálculo de contratados da transação da tela (marca + cron,
    como o pacote dos aprovados) e não gravar foto em `TH_MONITORAMENTO` quando só `contratados` e
    `vagas_ociosas` mudam.
- **Ganho esperado:** os casts e o `DELETE` dividido tiram varreduras de toda chamada; o pior caso
  só cai se a espera por trava se confirmar e o recálculo sair da transação.

## Ordem sugerida

1. **`get_selecao_da_area`** (uma passada, sem função por candidato) e
   **`listar_vagas_por_cargo_da_visao_geral`** (cargo por grafia distinta + `FC_CARGO_DA_GRAFIA`
   com índice): maiores médias, causa certa, saída idêntica.
2. **`abrir_lista_aprovados`**: A, D e E (sem mudar contrato).
3. **`listar_editais_classificacao`**: índice `INCLUDE` + `an` recortado.
4. **`listar_acompanhamento_da_visao_geral`**: junção no lugar de `FC_EM_OUTRA_LISTA` e medir as
   fontes que giram a marca.
5. **`alterar_status_candidato_aprovado`**: medir a espera por trava antes de mexer.

Cada troca de função vira migration nova, pelo md5 do `prosrc` vigente (copiado com
`pg_get_functiondef`), com rollback letra por letra, ensaio em `supabase/ensaios/` e teste em PGlite
de equivalência (antes × depois com as mesmas respostas) — [banco e migrations](../biblioteca/banco-e-migrations.md).
As migrations só serão escritas depois do EXPLAIN, que confirma a causa e dá o ganho medido.

## Para medir

Tudo como `postgres`, dentro de `begin read only; … rollback;`, nunca escrita. Valores de exemplo:
`'saude-indigena'` e `'sede'`.

```sql
select version();
show statement_timeout;  -- e o do papel: select rolconfig from pg_roles where rolname = 'authenticated';

-- 1. vagas por cargo: volume e custo da função por linha
select count(*), count(distinct "NO_CARGO") from public."TB_SELECAO_VAGA"
 where "ST_REGISTRO_ATIVO" = 'S' and "CO_AREA" = 'saude-indigena';
explain (analyze, buffers, verbose)
select private."FC_CARGO_DA_GRAFIA"(s."NO_CARGO", 'saude-indigena')
  from public."TB_SELECAO_VAGA" s
 where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_AREA" = 'saude-indigena';
-- plano genérico do corpo atual (esperado: Seq Scan em TD_CARGO)
prepare cargo_atual(text, text) as
  with g as (select private."FC_NORMALIZAR_GRAFIA_CARGO"($1) as grafia)
  select c."CO_CARGO" from public."TD_CARGO" c, g
   where c."ST_REGISTRO_ATIVO" = 'S' and ($2 is null or c."CO_AREA" = $2)
     and private."FC_NORMALIZAR_GRAFIA_CARGO"(c."NO_CARGO") = g.grafia;
set local plan_cache_mode = force_generic_plan;
explain (analyze, buffers) execute cargo_atual('AGENTE INDIGENA DE SAUDE', 'saude-indigena');

-- 2 e 3. candidatos por área e custo de FC_EM_OUTRA_LISTA por linha
select count(*) from public."TB_CANDIDATO_APROVADO" c
  join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
 where l.vigente and c.removido_em is null
   and l.edital_id in (select id::text from public."TB_MONITORAMENTO_INDIGENA" where "CO_AREA" = 'saude-indigena');
explain (analyze, buffers, verbose)
select l.edital_id,
       count(*) filter (where c.status is distinct from 'Contratado em outra lista'
                          and not private."FC_EM_OUTRA_LISTA"(c.id))
  from public."TB_LISTA_APROVADO" l
  join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
 where l.vigente
   and l.edital_id in (select "CO_MONITORAMENTO"::text from public."TB_SELECAO_VAGA"
                        where "CO_AREA" = 'saude-indigena' and "ST_REGISTRO_ATIVO" = 'S')
 group by 1;
-- quais fontes giram a marca das leituras com versão
select f."NO_LEITURA", f."NO_FONTE", sum(v."QT_ALTERACAO") as versao, max(v."DT_REGISTRO") as ultima
  from private."TD_FONTE_DA_LEITURA" f
  left join private."TL_VERSAO_FONTE" v on v."NO_FONTE" = f."NO_FONTE"
 where f."NO_LEITURA" in ('acompanhamento_visao_geral', 'selecao_area')
 group by 1, 2 order by ultima desc nulls last;
select avg(pg_column_size(raw_json)), max(pg_column_size(raw_json))
  from public."TB_MONITORAMENTO_INDIGENA" where "CO_AREA" = 'saude-indigena';

-- 4. classificação: custo da função por análise (comparar com o count sem ela)
explain (analyze, buffers, verbose)
select private."FC_NUMERO_EDITAL"(a.edital), count(*) from public."TB_ANALISE_CURRICULAR" a
 where a."CO_AREA" = 'saude-indigena' and a.ativo group by 1;
explain (analyze, buffers)
select count(*) from public."TB_ANALISE_CURRICULAR" a where a."CO_AREA" = 'saude-indigena' and a.ativo;

-- 5. aprovados: quanto custa a remontagem (gravado pela própria função) e o tamanho das partes
select "CO_AREA", "NU_DURACAO_MS", "QT_CANDIDATOS", pg_column_size("DS_LINHAS"), "DT_GERACAO"
  from private."TA_CANDIDATO_APROVADO_AREA";
select count(*) from public."RL_CARTA_CANDIDATO";
explain (analyze, buffers) select * from private."FC_MONTAR_APROVADOS_AREA"('saude-indigena', null);

-- 6. status do candidato: os casts (esperado Seq Scan × Index Scan)
explain (analyze, buffers) select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = '<edital>';
explain (analyze, buffers) select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = '<edital>'::uuid;
```

Para ver por dentro das funções plpgsql como uma pessoa da tela (se a Supabase permitir
`auto_explain`): `load 'auto_explain'; set local auto_explain.log_min_duration = 0; set local
auto_explain.log_analyze = on; set local auto_explain.log_nested_statements = on;`, com
`select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true); set local
role authenticated;` antes da chamada. A espera por trava da RPC 6 se vê nos logs (`still waiting
for … lock`) ou em `pg_locks` × `pg_stat_activity` na hora em que acontece.
