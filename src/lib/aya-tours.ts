/*
  A educação guiada da Aya, em dados, sem DOM nem estado global: os tours
  "item por item" de cada tela e aba ("Me mostra esta tela") e as trilhas
  ("Aprender"), que juntam telas em sequência. Quem desenha é
  src/modulos/aya/tour/tour.tsx; quem guarda o progresso e os convites no
  navegador, src/modulos/aya/tour/progresso.ts.

  Passo: `{ alvo, titulo, texto }`.
  - `alvo`: o elemento da vez, por atributo estável `data-tour="…"` (posto
    nos componentes só para isto; a função `t` monta o seletor) ou, onde o
    componente não tem um, outro seletor estável (id, data-*). Pode ser uma
    lista: vale o primeiro que achar um elemento visível. Sem `alvo`, o
    balão aparece no meio da tela (abertura, fechamento, explicação).
    Elemento ausente (sem permissão, tela vazia, aba fechada) pula o passo.
  - `titulo` e `texto`: curtos (título até 40 caracteres, uma ou duas
    frases), sem regra que não esteja num verbete de docs/aya/.
  - `areas` (opcional): só nessas áreas (a Visão geral muda por área).
  - `exige` (opcional): regra do perfil para o passo (o botão que só quem
    edita vê não entra no tour de quem só lê).
  - `antes` (opcional): a aba ou visão que precisa estar aberta; o tour
    clica nela se ainda não estiver marcada (só muda o que se vê).
  - Nas trilhas, `pagina`: a tela do passo (`recursos`, `config:acessos`);
    o tour navega até ela.

  Tours por aba: a chave é `view:aba` (`conduzir-entrevistas:preparar`,
  `classificacao:regra`, `approved:convocacao`); sem tour da aba, vale o da
  tela. Em Configurações, `config:<seção>`.

  O teste tests/aya-tours.test.js confere que cada `data-tour` usado aqui
  existe em algum componente.

  O código fica em src/lib/aya-tours/, um arquivo por assunto; este arquivo
  só reexporta a API pública (quem importa não precisa mudar).
*/

export type {
  RegraDoPerfil,
  AlvoDoPasso,
  ExtraDoPasso,
  PassoDoTour,
  TourDaTela,
  TourDaPagina,
  TrilhaDaAya,
  PerfilDoTour,
  ProgressoDaTrilha,
  ProgressoDasTrilhas,
  AberturaDoTour,
  RetanguloNaTela,
  TamanhoNaTela,
  LadoDoBalao,
  PosicaoDoBalao,
  FaixaDoVeu,
  GeometriaDoHolofote,
} from "./aya-tours/tipos.ts";
export { t } from "./aya-tours/pedacos.ts";
export {
  chaveDoTour,
  tourDaPagina,
  PAGINAS_COM_TOUR,
  passosDaTrilha,
  trilhasDoPerfil,
} from "./aya-tours/regras.ts";
export {
  progressoDasTrilhas,
  comPassoDaTrilha,
  comTrilhaConcluida,
  rotuloDoProgresso,
  passoParaRetomar,
  rotuloDoPasso,
  convitesFeitos,
  deveConvidar,
} from "./aya-tours/progresso.ts";
export {
  posicaoDoBalao,
  MARGEM_DO_HOLOFOTE,
  geometriaDoHolofote,
} from "./aya-tours/balao.ts";
