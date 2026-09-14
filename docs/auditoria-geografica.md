# Auditoria geográfica — origem das coordenadas do mapa

Auditoria da procedência das coordenadas de Polo Base, CASAI, UBSI e demais
unidades no mapa do AgSUS Monitora.

**Nada foi alterado.** Nenhuma escrita no banco, no payload ou no comportamento
da aplicação. O que este trabalho entrega é diagnóstico, instrumento de medição
e proposta.

## 1. Situação das cinco tarefas

| Tarefa                             | Situação                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| 1 — auditar a fonte                | **Concluída.** Toda a cadeia está no código e foi lida.                           |
| 2 — auditar as coordenadas         | **Medida em agregado** (§2); falta a corrida do auditor sobre o payload completo. |
| 3 — comparar com fonte oficial     | **Pendente.** Depende de definir a fonte de referência — ver §8.                  |
| 4 — não deslocar a coordenada real | **Concluída**, com uma correção à premissa.                                       |
| 5 — score de confiança             | **Concluída** — modelo definido e implementado no auditor.                        |

## 2. O que os dados reais mostram

Os números desta seção foram medidos em **14/09/2026**, em consulta somente
leitura ao projeto `agsusmonitora-dais`, e vieram da equipa — **não** de uma
corrida do auditor nesta máquina. Ficam aqui como agregados verificáveis, e a
distinção importa: a contagem por nível de confiança exige correr
`scripts/auditar-coordenadas.mjs` sobre o payload, e não é reproduzida aqui de
memória.

### Volumetria

| Conjunto                              | Quantidade |
| ------------------------------------- | ---------- |
| `rede_cnes` — registos CNES distintos | **1.081**  |
| dos quais Polo Base                   | 310        |
| dos quais UBSI                        | 120        |
| dos quais CASAI                       | 47         |
| `lmap` — polos base                   | **381**    |

Duas leituras saltam destes números.

**Faltam 604 registos à conta.** 310 + 120 + 47 dá 477, de 1.081. Os outros
**604 — 56% da rede — são de tipos que ninguém enumerou** nesta medição: postos,
unidades de apoio, o que mais o CNES traga. Enquanto não forem discriminados,
mais de metade dos pontos do mapa não tem sequer o tipo conhecido.

**Há 381 polos no `lmap` e 310 no CNES.** No melhor dos casos, **71 polos não
têm como casar** com um registo de polo — e recaem, por construção, na segunda
passagem do casamento, que aceita qualquer unidade cujo nome se pareça.

### Coordenadas repetidas

| Onde        | Coordenadas repetidas | Registos envolvidos |
| ----------- | --------------------- | ------------------- |
| `rede_cnes` | 36                    | **171**             |
| `lmap`      | 8                     | **40**              |

Dois pontos concentram o grosso:

| Coordenada       | Estabelecimentos distintos | Observação                   |
| ---------------- | -------------------------- | ---------------------------- |
| `4.596, -60.168` | **57**                     | A maior concentração da base |
| `2.98, -61.292`  | **15**                     | Inclui vários Polos Base     |

**Este é o achado central da segunda rodada.** Nenhuma destas coordenadas é
inválida: estão dentro do Brasil, com sinal certo e sem nada de estranho no
número. E mesmo assim não localizam ninguém — 57 estabelecimentos diferentes no
mesmo ponto é um depósito, não um endereço. Note-se ainda que `2.98, -61.292`
tem duas casas decimais, precisão de cerca de 1 km, o que reforça a hipótese de
centróide.

### O `lmap` e o CNES não se tocam

**Nenhum dos 381 polos do `lmap` tem coordenada exatamente igual a um registo
do CNES bruto.** É a confirmação empírica do que §3 deduziu do código: as duas
fontes são independentes e nunca foram conciliadas.

A consequência prática é que o mapa mistura duas procedências na mesma camada,
sem as distinguir:

- o polo que **casa** com o CNES é desenhado na coordenada do CNES — ou seja,
  **não** na que o `lmap` guarda;
- o polo que **não casa** é desenhado na coordenada do `lmap`.

Quem olha o mapa vê pontos idênticos com origens diferentes, e o sistema afirma
`coord_oficial: true` para o primeiro grupo.

Daí o auditor passar a medir, para cada polo casado, **quantos quilómetros o
casamento o moveu** em relação ao que o `lmap` guardava. Um casamento que
relocaliza um polo dezenas de quilómetros não confirma nada: apenas mostra que
as duas fontes discordam, sem dizer qual está certa.

### Quadro-resumo

Duas colunas de propósito: o que já está medido e o que sai da corrida do
auditor sobre o payload completo. Preencher a segunda coluna de cabeça seria
inventar a auditoria em vez de a fazer.

| Indicador                              | Medido em 14/09/2026           | Produzido por `auditar-coordenadas.mjs` |
| -------------------------------------- | ------------------------------ | --------------------------------------- |
| Registos CNES distintos                | 1.081                          | total auditado, por tipo                |
| Polos no `lmap`                        | 381                            | idem, com origem por polo               |
| **Total por nível de confiança**       | —                              | seção `NÍVEL DE CONFIANÇA`              |
| **Coordenadas repetidas**              | 36 no `rede_cnes`, 8 no `lmap` | seção `COORDENADAS PARTILHADAS`         |
| **Registos afetados por repetição**    | 171 e 40                       | idem, campo `registro(s) afetado(s)`    |
| **Pontos com vários estabelecimentos** | 57 e 15 nos dois maiores       | lista ordenada, com tipos e município   |
| **Polos suspeitos**                    | —                              | seção `POLOS`, com motivo               |
| **Município como substituto**          | —                              | seção `MUNICÍPIO COMO SUBSTITUTO`       |
| Deslocamento do casamento, em km       | —                              | coluna `deslocamento_km` do CSV         |

A corrida produz ainda o CSV completo, com uma linha por ponto e as colunas de
rastreabilidade: `lat_lmap`, `lon_lmap`, `deslocamento_km`, `lugares_no_ponto`,
`ponto_coletor`, `possivel_sede_municipal`, `score_casamento` e `nome_casado`.

## 3. Como a fonte é produzida

O mapa lê duas linhas da tabela `mapa_saude_indigena_config`, pelas chaves
`lmap` e `rede_cnes` ([`legacy-app.js:2164`](../src/modules/legacy-app.js#L2164)).
São payloads JSON, não tabelas relacionais: não há coluna, tipo, restrição nem
chave estrangeira sobre nada disto.

### `rede_cnes` — tem origem rastreável

Produzido por importação manual: alguém cola o conteúdo de um ficheiro chamado
"JSON v4" numa caixa de texto da tela de Configurações (`cfgCnesJson`) e clica
em _Aplicar ao mapa_
([`aplicarCnesCoords`, linha 10187](../src/modules/legacy-app.js#L10187)).

A transformação está em
[`_redeFromV4`, linha 10083](../src/modules/legacy-app.js#L10083):

- lê três coleções do ficheiro: `ubsis_amostra_por_dsei`,
  `casais_dsei_ou_local_por_dsei` e `casais_nacionais`;
- **descarta em silêncio** todo estabelecimento sem `localizacao.latitude` e
  `localizacao.longitude` numéricas;
- guarda cada um como uma tupla posicional
  `[nome, cnes, lat, lon, município, uf]`, com as coordenadas arredondadas a
  6 casas decimais;
- associa cada estabelecimento a um DSEI **pelo nome normalizado**
  ([`_dseiKeyNorm`, linha 10067](../src/modules/legacy-app.js#L10067)), e
  **descarta em silêncio** quem não casar com nenhum DSEI do `lmap`.

O nome da coleção principal merece atenção: `ubsis_amostra_por_dsei`. Se for
mesmo uma amostra, a rede desenhada no mapa nunca foi a rede completa.

### `lmap` — não tem origem rastreável

`LMAP` é declarado vazio ([linha 3184](../src/modules/legacy-app.js#L3184)) e
atribuído **num único ponto**: a leitura do Supabase
([linha 2183](../src/modules/legacy-app.js#L2183)). Não existe importador, tela
de edição, migration ou semente em nenhum lugar do repositório.

É o `lmap` que carrega a lista de DSEIs, a sede de cada um, a população, as UFs
de abrangência e **a lista de polos base com as suas latitudes e longitudes**.

Ou seja: **as coordenadas dos polos base entraram no sistema por fora da
aplicação e a sua procedência não está registada em lugar nenhum.** Não é
possível, a partir deste repositório, dizer de onde veio a coordenada de um
polo, quem a pôs lá, quando, nem com que fonte.

Pior: `saveMapaConfigToSupabase`
([linha 2133](../src/modules/legacy-app.js#L2133)) grava de volta o `LMAP` que
estiver em memória. Qualquer pessoa com permissão de configuração que clique em
_Aplicar ao mapa_ reescreve as duas chaves — e a única cópia do `lmap` é a que
está no banco.

### De onde vem cada latitude/longitude, em resumo

| Camada                            | Origem da coordenada                    | Rastreável?                 |
| --------------------------------- | --------------------------------------- | --------------------------- |
| UBSI, CASAI local, CASAI nacional | Campo `localizacao` do JSON v4 (CNES)   | Sim, até o ficheiro colado  |
| Sede do DSEI                      | `lmap`, escrito fora da aplicação       | **Não**                     |
| Polo base, quando casa com o CNES | Coordenada de **outro** estabelecimento | Sim, mas é de outro registo |
| Polo base, quando não casa        | `lmap`, escrito fora da aplicação       | **Não**                     |

## 4. Como o Polo Base é casado com o CNES

Este é o ponto mais delicado da auditoria, e está em
[`findOfficialPoloCoord`, linha 9095](../src/modules/legacy-app.js#L9095).

O comentário do próprio código diz o essencial: _"As coordenadas oficiais do
CNES no JSON v4 estão nos estabelecimentos (UBSI/CASAI), **não nos polos base
(que vêm com latitude/longitude nulas)**"_.

Então o polo nunca tem coordenada própria do CNES. O que a aplicação faz é
procurar, entre as UBSIs daquele DSEI, um registo que pareça corresponder ao
polo, e **adotar a coordenada desse outro estabelecimento**.

A busca tem duas passagens:

**Primeira** — só registos cujo nome contenha "POLO". Pontua:

| Critério                                                     | Pontos |
| ------------------------------------------------------------ | ------ |
| Nome do registo e nome do polo contêm-se mutuamente          | 100    |
| **Município** do registo e nome do polo contêm-se mutuamente | 60     |
| Mesma UF                                                     | 10     |

Aceita a partir de **70**.

**Aqui está o defeito grave.** 60 + 10 = 70. Um polo pode ser casado a um
estabelecimento **sem que os nomes tenham nada a ver**, bastando que o nome do
polo se pareça com o _município_ do estabelecimento e a UF coincida.

Exemplo real da forma do problema: um polo chamado "Feijó" no Acre e um
"POLO BASE ENVIRA" situado no município de Feijó, AC. Não são o mesmo lugar. O
polo Feijó passa a ser desenhado sobre o Polo Base Envira, e o resultado é
marcado como coordenada oficial.

Note-se ainda que a comparação de nomes é por **substring** (`includes`), não
por palavra inteira — "ANTA" casa dentro de "CANTAGALO". A segunda passagem usa
palavra inteira (`_strongNameMatch`), mas a primeira, que é a que decide na
maioria dos casos, não.

**Segunda** — se nada casou, aceita _qualquer_ unidade, mesmo sem "POLO" no
nome, cujo nome case como palavra inteira. É uma UBSI qualquer emprestando a
sua coordenada ao polo.

### O rótulo que engana

[`polosCorrigidosPorCnes`, linha 9142](../src/modules/legacy-app.js#L9142) pega
no resultado e escreve:

```js
lat: oficial[2],
lon: oficial[3],
coord_oficial: true,
coord_fonte: "CNES",
```

Um polo que recebeu a coordenada de um estabelecimento diferente, por um
casamento difuso que pode ter passado só pelo município, fica gravado como
`coord_oficial: true` e `coord_fonte: "CNES"`. **A afirmação mais forte do
sistema é feita justamente no caso menos confiável.**

## 5. O deslocamento para desempilhar — a premissa estava quase certa

A missão diz que "o código atual possui lógica que altera latitude/longitude
para desempilhar pontos iguais" e pede que isso deixe de alterar a localização.

Conferido nos três pontos onde isso acontece, a alteração **já é apenas de
desenho**:

| Local                                                                    | O que faz                                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| [9694](../src/modules/legacy-app.js#L9694) — bolhas de DSEI              | Usa variáveis locais `lat`/`lon` só para o marcador; não escreve em `d` |
| [9870](../src/modules/legacy-app.js#L9870) — `_spread`, estabelecimentos | Devolve cópia com `_lat`/`_lon`; preserva `lat`/`lon`                   |
| [9941](../src/modules/legacy-app.js#L9941) — polos                       | Devolve cópia com `_lat`/`_lon`; preserva `lat`/`lon`                   |

Nenhum deles persiste nada, e nada muta o `LMAP` — verificado: não há uma única
atribuição a `.lat` ou `.lon` em todo o `legacy-app.js`.

Portanto **o deslocamento de render não é o problema que a missão supunha.** A
convenção `_lat`/`_lon` já existe e está correta; falta apenas aplicá-la também
ao caso das bolhas de DSEI, por clareza, e documentá-la.

O que **de facto** altera a localização é outra coisa, descrita em §3: a
substituição da coordenada do polo pela de outro estabelecimento. Essa não é
visual — é semântica, e é a que precisa de ser separada.

### Magnitude do deslocamento visual

Vale conhecer, porque é grande:

| Local            | Raio aplicado          | Distância aproximada |
| ---------------- | ---------------------- | -------------------- |
| Bolhas de DSEI   | 0,55°                  | **~61 km**           |
| Estabelecimentos | 0,05° + 0,02° a cada 8 | ~5,5 km              |
| Polos            | 0,06° + 0,02° a cada 8 | ~6,7 km              |

Um polo empilhado com outros aparece a quase 7 km do sítio; uma bolha de DSEI
pode aparecer a 61 km. Como não há nada na interface a dizer que aquele ponto
foi afastado de propósito, quem lê o mapa toma a posição desenhada por posição
real.

## 6. Modelo de confiança proposto

Cinco níveis, ordenados, mais sinalizadores independentes.

| Nível                     | Significado                                                    |
| ------------------------- | -------------------------------------------------------------- |
| `oficial_estabelecimento` | Coordenada do registo CNES **deste** estabelecimento.          |
| `oficial_cnes`            | Veio do CNES, mas de outro registo, ligado por nome forte.     |
| `aproximada_municipio`    | É a sede do município, não o estabelecimento.                  |
| `inferida`                | Deduzida por semelhança — inclui o casamento só por município. |
| `pendente_validacao`      | Origem desconhecida, conflituosa ou quebrada.                  |

Hoje, tudo o que vem do `lmap` cai em `pendente_validacao` por construção: não
há como afirmar mais do que isso sobre uma coordenada sem procedência.

Os sinalizadores são separados do nível porque podem ocorrer em qualquer um:

- `duplicada_com` — mesma coordenada de outro estabelecimento distinto;
- `incompativel_uf` — UF do CNES fora da abrangência declarada do DSEI;
- `coordenada_quebrada` — invertida, fora do país, longitude positiva, zero;
- `precisao_baixa` — poucas casas decimais, indício de arredondamento;
- `ponto_coletor` — o ponto reúne 10 ou mais estabelecimentos distintos;
- `possivel_sede_municipal` — o ponto reúne 3 ou mais e todos declaram o mesmo
  município;
- `deslocamento_km` — quanto o casamento moveu o polo face ao `lmap`.

**`deslocada_para_visualizacao` não é um nível e não deve ser armazenado.** É
estado de render, e o seu lugar é `_lat`/`_lon`, nunca o dado.

### 6.1 Os dois rebaixamentos

O nível declarado pela origem não é a última palavra. Duas situações o vencem,
e ambas nascem dos dados reais medidos em §2.

**Ponto coletor — rebaixa para `pendente_validacao`.** A partir de dez
estabelecimentos distintos no mesmo ponto, a coordenada demonstravelmente não
os distingue entre si. Chamar-lhe `oficial_estabelecimento` porque veio do CNES
seria repetir exatamente o erro que esta auditoria veio expor: afirmar
precisão onde só há procedência. Com 57 num único ponto, o rebaixamento não é
conservadorismo — é a leitura correta do dado.

O limiar de dez é uma escolha, não uma verdade. Abaixo dele, o auditor assinala
`agrupamento` sem rebaixar, porque três unidades no mesmo endereço são
plausíveis: um campus, um mesmo prédio.

**Deslocamento grande — rebaixa `oficial_cnes` para `inferida`.** Quando o
casamento move o polo 50 km ou mais do que o `lmap` guardava, as duas fontes
discordam de forma irreconciliável. Não se sabe qual está errada — o `lmap` não
tem procedência e o casamento é por semelhança de nome — e é precisamente por
não se saber que nenhuma das duas pode ser chamada de oficial.

Ambos os rebaixamentos estão cobertos por teste, com um caso real reproduzido:
um polo que o casamento por nome move 453 km deixa de ser `oficial_cnes`.

## 7. Proposta de correção

### 7.1 Separar coordenada de procedência

Sair do payload JSON e passar a uma tabela com coluna por campo, onde cada
ponto declara de onde veio. O esquema proposto está em
[`docs/propostas/20260914120000_confianca_de_coordenada.sql`](propostas/20260914120000_confianca_de_coordenada.sql)
— **não executado, e deliberadamente fora de `supabase/migrations/`**: um ficheiro
naquela pasta é aplicado por qualquer `db push`, e uma proposta por discutir não
pode correr por acidente. Move-se para lá quando for aprovada.

Pontos centrais: `lat`/`lon` são a coordenada real e não se alteram para
desenho; `confianca` é obrigatória; `fonte` e `fonte_data` registam a
procedência de cada correção.

### 7.2 Endurecer o casamento do polo

Duas mudanças mínimas, ambas em `findOfficialPoloCoord`:

1. **Município sozinho não pode casar.** Exigir pontuação de nome maior que
   zero, ou subir o limiar acima de 70. Município deve desempatar, não decidir.
2. **Comparar por palavra inteira** também na primeira passagem, como a segunda
   já faz.

E, independentemente disso, parar de escrever `coord_oficial: true` num polo que
recebeu coordenada emprestada. O campo deve dizer a verdade: `confianca` e o
CNES do registo de onde a coordenada veio.

### 7.3 Mostrar a confiança na interface

O popup deve dizer quando a localização é aproximada ou inferida, e qual o
estabelecimento de referência quando a coordenada é emprestada. Hoje o mapa
afirma a mesma certeza para todos os pontos.

Sobreposição continua a ser resolvida no render — e aí vale considerar cluster
ou _spiderfy_ do Leaflet em vez do afastamento fixo, que hoje chega a 61 km sem
avisar ninguém.

## 8. Como fechar as Tarefas 2 e 3

O auditor está pronto e testado:
[`scripts/auditar-coordenadas.mjs`](../scripts/auditar-coordenadas.mjs).

```bash
node scripts/auditar-coordenadas.mjs --arquivo export.json --csv relatorio.csv
```

Ele não escreve nada, e aceita duas entradas: a variável `SUPABASE_DB_URL` (em
sessão somente-leitura) ou um ficheiro JSON exportado do painel do Supabase no
formato `{ "lmap": {...}, "rede_cnes": {...} }`.

Produz a contagem por nível de confiança, a contagem por tipo de unidade, as
coordenadas partilhadas ordenadas por concentração, os polos suspeitos com o
motivo, o indício de município substituto, o agregado de problemas, a lista dos
graves e a tabela completa em CSV.

**Para fechar a Tarefa 2 falta uma coisa só:** correr o comando acima sobre o
payload completo e colar a saída nesta seção. Os agregados de §2 já confirmam o
diagnóstico, mas a contagem por nível de confiança e a lista nominal de polos
suspeitos saem da corrida — e não devem ser estimadas.

Uma nota sobre o que a corrida vai mostrar: com 171 registos envolvidos em
coordenadas repetidas no `rede_cnes` e um ponto a reunir 57 estabelecimentos, o
rebaixamento por ponto coletor descrito em §6.1 vai mover uma fatia
considerável da base para `pendente_validacao`. Isso é o resultado esperado, não
um defeito do classificador: são coordenadas que nunca identificaram o
estabelecimento a que estavam presas.

Para a Tarefa 3, além dos dados, é preciso decidir a fonte de referência. A
recomendação é o **CNES/DATASUS** pelo código CNES de cada estabelecimento, que
é a chave que o próprio sistema já guarda. Comparação por nome com bases da
SESAI deve ser tratada como indício, não como verdade — é o mesmo tipo de
casamento difuso que originou o problema.

Duas cautelas registadas para quem continuar:

- **Não usar geometria para decidir UF.** Já medido neste projeto em
  09/09/2026: o ray casting no `UF_GEO` diverge do CNES em 20 unidades e aponta
  12 como fora do DSEI, das quais 9 são falso positivo perto de fronteira. Quem
  decide UF administrativa é o CNES — ver [`src/lib/uf-ibge.js`](../src/lib/uf-ibge.js).
- **Coordenada igual à sede do município continua a não ser afirmável sem a
  base de sedes do IBGE.** O auditor passou a ter um indício bem mais forte do
  que as casas decimais — várias unidades no mesmo ponto, todas do mesmo
  município, que é o padrão que uma sede teria — mas indício não é prova.
  Carregar a base de sedes transforma `possivel_sede_municipal` em
  `aproximada_municipio` com fonte declarada, e é o passo que falta para a
  Tarefa 3 fechar por completo.

## 9. Reconciliação — a mesma estrutura nas duas fontes

O que as seções anteriores descreveram como "duas fontes que nunca se tocam"
tem uma consequência que só aparece no mapa: **a mesma estrutura desenhada duas
vezes**. `XITEI` vem do `lmap`, `POLO BASE XITEI` vem do `rede_cnes`, e são o
mesmo polo.

Medido em 14/09/2026: **166 pares** com o mesmo nome canónico dentro do mesmo
DSEI, dos quais **163 são polo contra polo**. A distância entre as duas fontes,
nesses pares:

| Faixa         | Pares  |
| ------------- | ------ |
| menos de 5 km | 20     |
| 5 a 50 km     | 57     |
| mais de 50 km | **89** |

A deduplicação que existia em `detailRecordsForDsei` era por `nome|lat|lon`, e
**nenhuma das duas partes dessa chave casava**: os nomes diferem por construção,
e nenhum polo do `lmap` tem coordenada igual à do CNES. Por isso nunca eliminou
nada.

### O que a reconciliação junta, e o que recusa

O módulo é [`src/lib/reconciliacao-unidades.js`](../src/lib/reconciliacao-unidades.js).
Junta quando há, ao mesmo tempo: **mesmo DSEI**, **nome canónico igual por
inteiro** e **tipo compatível**. Recusa-se a:

- cruzar DSEIs — `SANTA MARIA`, `SÃO FRANCISCO` e `TUCUMÃ` existem em vários
  distritos, e casar por nome globalmente juntaria lugares a milhares de
  quilómetros. A função recebe um DSEI de cada vez e não tem como ver outro;
- fundir polo base com UBSI ou posto, mesmo com nome idêntico — foi assim que a
  lógica antiga colou um polo sobre uma unidade que apenas o atende;
- casar por substring — `ANTA` está dentro de `CANTAGALO`;
- adivinhar entre candidatos empatados. Dois `POLO BASE SANTA MARIA` no mesmo
  DSEI vão para a lista de **ambíguos**, e continuam a ser desenhados como dois
  registos até alguém decidir.

### O que fica preservado

Nada se perde na junção: o CNES, o `cod` do `lmap`, o nome original de cada
fonte, **as duas coordenadas** e a distância entre elas. O registo unificado
declara `origens: ["lmap", "rede_cnes"]`.

### A coordenada exibida, e por que essa

Vence sempre a do `rede_cnes` — não por ser mais exata, que ninguém verificou,
mas por ser **a única das duas com procedência declarada**. A do `lmap` entrou
no sistema por fora da aplicação (§3) e não há registo de quem a pôs lá. Entre
uma coordenada rastreável e uma anónima, exibir a rastreável é a escolha
defensável; a outra fica guardada no próprio registo, para auditoria.

### Os limiares, e o que eles não são

**5 km tem justificação.** Uma coordenada com duas casas decimais carrega erro
de arredondamento até cerca de 1,57 km na diagonal. Cinco quilómetros são mais
de três vezes isso, e ainda absorvem a diferença habitual entre a aldeia e a
sede do município que a atende. Abaixo disso, a divergência não distingue duas
localizações — distingue duas maneiras de arredondar a mesma.

**50 km não tem justificação física, e seria desonesto fingir que tem.** A
distribuição real é praticamente plana (20/57/89) e não oferece corte natural.
É um limiar de **priorização**: acima dele, a hipótese de as duas fontes
descreverem o mesmo sítio deixa de ser sustentável sem alguém olhar. Os 89 pares
nessa faixa são fila de trabalho, não veredito — e no mapa aparecem como
**localização pendente de validação**.

Os dois valores são constantes exportadas. Quem quiser outro corte muda ali, e
o relatório recalcula.

### O caso que NÃO se funde

Estabelecimentos genuinamente diferentes na mesma coordenada — os 57 num só
ponto, de §2 — **não são duplicação de entidade**. Fundi-los apagaria unidades
de saúde do mapa. Isso resolve-se no desenho, com agrupamento, e a função
`agruparPorPontoDeRender` devolve os pontos e quem está em cada um sem tocar em
coordenada nenhuma.

Distinguir os dois casos é o ponto inteiro deste módulo.

### Relatório dos pares

```bash
node scripts/relatorio-reconciliacao.mjs --arquivo export.json --csv pares.csv
```

Corre a mesma função que o mapa usa e devolve quatro listas: reconciliados
automaticamente (com a faixa de divergência), ambíguos, rejeitados por tipo
incompatível e polos sem par no DSEI. Não escreve nada.
