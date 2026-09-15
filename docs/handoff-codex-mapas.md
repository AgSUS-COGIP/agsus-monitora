# Passagem para o Codex — o que ficou por fazer nos mapas

Escrito em 15/09/2026, a partir de medições feitas na aplicação com sessão.
Cada item traz o número que o sustenta e o que eu não pude fazer.

---

## 1. As coordenadas do `lmap` não têm procedência — e são a única cópia

**Prioridade: alta. É a raiz de "o mapa precisa ser real".**

`LMAP` é declarado vazio e atribuído num único ponto: a leitura da tabela
`mapa_saude_indigena_config`, chave `lmap`. Não existe importador, tela de
edição, migration nem semente em lugar nenhum do repositório. É esse objeto que
carrega **a sede de cada DSEI, a população, as UFs e a lista de polos base com
as suas latitudes e longitudes**.

Duas consequências, ambas já documentadas em
[`docs/auditoria-geografica.md`](auditoria-geografica.md):

- Não é possível, a partir deste repositório, dizer de onde veio a coordenada de
  um polo, quem a pôs lá, quando, nem com que fonte.
- `saveMapaConfigToSupabase` grava de volta o `LMAP` que estiver em memória.
  Qualquer pessoa com permissão de configuração que clique em _Aplicar ao mapa_
  reescreve as duas chaves, e não há outra cópia.

**O que eu não fiz:** nada disto. Escrever no Supabase de produção está fora do
que me foi autorizado, em todas as rodadas deste trabalho.

**O que proponho:**

1. Fazer uma cópia versionada do `lmap` antes de qualquer outra coisa — hoje um
   `UPDATE` acidental pela interface é irreversível.
2. Conferir cada sede de DSEI contra o contorno em `src/lib/brasil-bounds.js`
   (`BR_OUTLINE`, 1227 vértices) com ponto-em-polígono, e listar as que caem
   fora do país ou fora das UFs declaradas em `ufs`.
3. Dar origem declarada a cada coordenada, como já existe para UBSI e CASAI
   (campo `localizacao` do CNES). O script
   [`scripts/auditar-coordenadas.mjs`](../scripts/auditar-coordenadas.mjs) já lê
   `lmap` e monta os registos, incluindo a sede — falta-lhe só o teste de
   contenção e a coluna de origem.

**Nota importante:** a "bolinha na Guiana" relatada a 15/09 **não era** um
problema de dados. Os dois DSEIs de Boa Vista estão ambos em `2.8563,-60.6527`,
dentro de Roraima; era o desenho que mentia. Já está corrigido (item 4 abaixo).
Isso não desfaz o problema de procedência — só quer dizer que ele ainda não foi
visto na tela.

---

## 2. O leque ainda afasta marcadores em pixels

`criarLeque()` usa `layerPointToLatLng(centro.add(L.point(x, y)))` para abrir os
registos que partilham coordenada. Na visão nacional o mapa tem **9.57 px por
grau**, portanto um raio de leque de 40px são mais de 4 graus — atravessa
fronteiras.

É uma exceção **declarada**: o leque desenha uma `L.polyline` da coordenada
verdadeira até cada marcador aberto, e o tooltip diz "mesma coordenada — clique
para abrir em leque". Por isso não o mexi: mudar comportamento já revisto no
PR #8 por minha conta seria pior do que deixá-lo.

**Decisão que falta:** se a régua "nenhum desenho inventa coordenada" vale sem
exceção, o leque tem de passar a desenhar-se em pixels puros (um `divIcon` com
`iconAnchor` deslocado, como o selo agora faz) em vez de criar `LatLng` novos.
`tests/enquadramento-do-mapa.test.js` já fixa que ele é a única exceção que
resta — o teste falha se aparecer outra.

---

## 3. O basemap: o OSM limita e a CARTO passou a exigir chave

Medido a 15/09/2026:

| provedor                                    | resposta sem chave                          |
| ------------------------------------------- | ------------------------------------------- |
| `tile.openstreetmap.org`                    | 200, PNG normal                             |
| `basemaps.cartocdn.com/light_all`           | **200, PNG de 10KB com "API KEY REQUIRED"** |
| `basemaps.cartocdn.com/rastertiles/voyager` | **200, idem**                               |
| `server.arcgisonline.com` (World_Imagery)   | 200, JPEG normal                            |

O problema da CARTO é que ela **não falha — mente**. Devolve 200, nenhum
`tileerror` dispara, a cadeia de recurso considera que funcionou, e o mapa fica
coberto de avisos de chave em falta até alguém recarregar. Foi o que apareceu em
produção.

**O que eu fiz:** tirei a CARTO da cadeia e pus no lugar a imagem de satélite
que a aplicação já serve na camada _Satélite_ (ArcGIS World Imagery). Nenhuma
dependência nova, e responde anónima.

**O que fica para decidir, e não é meu:**

- Se os termos do ArcGIS World Imagery permitem este uso como base. Eu não julgo
  licenciamento de terceiros.
- Se vale obter uma chave da CARTO. Envolve conta e credencial; eu não crio
  conta nem manuseio chave. Se optarem por isso, o código liga-se a uma variável
  de ambiente e eu faço essa parte.
- A política de uso do OpenStreetMap desaconselha tráfego de aplicação. Com 25
  azulejos por vista e a base instalada desta ferramenta, convém alguém decidir
  se o OSM continua a ser o primário.

---

## 4. O que já está corrigido, para não ser refeito

- **Selo da sede partilhada na Guiana.** Convertia 18px em graus — 1.88°, cerca
  de 209 km na visão nacional — e desenhava o selo dos dois DSEIs de Boa Vista
  em `4.4209,-59.0849`. Agora fica na sede, em `2.8114,-60.6445`, conferido na
  aplicação.
- **Recorte dos azulejos.** O `map-guard` limitava-os a `NAVEGACAO_BOUNDS`
  (57.5° de longitude), e um card largo precisa de muito mais: 33% da área do
  card tinha mapa, o resto era o cinzento do container. O recorte saiu;
  `noWrap: true` continua a impedir cópias laterais e o `maxBounds` continua a
  limitar a navegação.
- **Dois mapas ao mesmo tempo**, com o segundo a repetir o Brasil. Passou a um
  mapa de cada vez, pela classe `com-dsei`.
- **Altura do mapa**: `clamp(460px, 64vh, 760px)`. Em Mercator o Brasil é
  1.010:1 e o `fitBounds` é sempre limitado pela altura — é esta variável, e só
  ela, que decide o tamanho do país na tela.

---

## 5. Uma conta minha que saiu errada, para não ser repetida

Eu disse que estreitar o mapa nacional devolveria os azulejos: de 27 para 9.
**Não devolveu.** Medido depois, na aplicação: 27 antes, **25** depois.

A razão é simples e eu devia tê-la visto antes de afirmar: o número de azulejos
segue a **área em pixels** do container, não a fração dele que é Brasil.
Estreitar o mapa e aumentá-lo em altura mantém a área quase igual, e um mapa
mais alto ainda sobe o zoom, o que pede mais azulejos para o mesmo território.

O que de facto mudou foi o aproveitamento: dos azulejos pedidos, os que caem
dentro do retângulo do Brasil passaram de **9 em 27 (33%) para 15 em 25 (60%)**,
e o Brasil passou de 24% para **51% da largura do mapa**.

Fica também a dúvida que isso levanta: eu atribuí a queda para a CARTO ao
triplo de pedidos que o meu recorte removido causou. O mecanismo é plausível — a
troca dá-se após 4 erros seguidos do OSM — mas **não está provado**, e 25 ou 27
azulejos por vista não é um número anormal para um mapa web. Quem for fechar o
item 3 não deve tomar essa causa como estabelecida.

---

## 6. O cartão condicional acima do mapa

`multiUnitsCard` ("Unidades com mais de um processo seletivo") mede 69px a 1920
e **152px a 1366**, e fica entre os KPIs e o mapa. É ele que decide se o "Resumo
por etapa" cabe na dobra:

| viewport  | com o cartão | sem ele |
| --------- | ------------ | ------- |
| 1920×1000 | y=999        | y=920   |
| 1600×900  | y=950        | y=871   |
| 1366×768  | y=932        | y=853   |

Com a altura de mapa agora pedida (64vh), tudo isto desce mais — o que foi a
troca aceite, para dar ênfase ao mapa. Se em algum momento a dobra voltar a ser
requisito num notebook de 768px, o caminho é discutir **o que fica acima do
mapa**, não encolher o mapa: não há altura de mapa que resolva 302px de cromo.
