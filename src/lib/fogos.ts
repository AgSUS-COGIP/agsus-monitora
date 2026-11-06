/*
  Fogos de artifício das comemorações, sem DOM: o roteiro do show, a física
  das faíscas e a paleta. O desenho no <canvas> é de src/modulos/comemoracao/,
  que só chama `criarShow`, `avancarShow` e as funções de brilho e cor daqui.
  A Aya, o véu e o som são de src/lib/fogos-cena.ts; o marco desenhado no
  céu (pontos da forma ou do número), de src/lib/fogos-formas.ts.

  O show (5–6 s):
    1. a Aya atravessa a tela voando e solta o primeiro foguete;
    2. foguetes sobem de pontos diferentes da base, desaceleram pela
       gravidade e estouram no ápice, escalonados, em salvas — peônia,
       crisântemo, anel, salgueiro, estalinho, kamuro (chuva dourada lenta),
       glitter (faíscas que piscam), palmeira (braços grossos com rastro) e
       bomba dupla (estoura em dois tempos);
    3. o estouro do marco: as faíscas convergem para a forma (coração,
       estrela, visto ou o número) e brilham ali; sem forma, um crisântemo
       grande no centro;
    4. o grande final: nos últimos ~1,5 s, uma salva de 6–8 estouros quase
       juntos dos lados do marco.
  Cada estouro deixa um pouco de fumaça que sobe e se dissipa.

  Unidades: tempo em segundos, posição em px CSS, velocidade em px/s. O
  sorteio vem de `aleatorio` (padrão Math.random) para os testes fixarem a
  semente com `criarAleatorio`.

  O código fica em src/lib/fogos-*.ts, um arquivo por assunto (tipos,
  parâmetros, paleta, roteiro, física e show); este arquivo só reexporta a
  API pública (quem importa não precisa mudar).
*/

export type {
  Aleatorio,
  PontoXY,
  IntensidadeDoShow,
  NomeDoFormato,
  FormatoDosFogos,
  PaletaDosFogos,
  PapelDoEstouro,
  PlanoDoFoguete,
  FogueteNoAr,
  ParticulaComum,
  ParticulaDoAlvo,
  SementeDosFogos,
  ParticulaDosFogos,
  EventoDoEstouro,
  ShowDeFogos,
} from "./fogos-tipos.ts";
export {
  GRAVIDADE,
  GRAVIDADE_DO_FOGUETE,
  LIMITE_DE_PARTICULAS,
  PASSO_MAXIMO_S,
  INTENSIDADES,
  intensidadeDoShow,
  DURACAO_MINIMA_DOS_FOGOS_S,
  DURACAO_MAXIMA_DOS_FOGOS_S,
  duracaoDoShow,
  FORMATOS,
  NOMES_DOS_FORMATOS,
  FORMATOS_DA_RAJADA,
  FORMATOS_DA_APOTEOSE,
  FORMATOS_DO_FINAL,
  duracaoDoFormato,
  MARCO,
  LETREIRO,
  RAJADA,
  APOTEOSE,
  criarAleatorio,
  escalaDaTela,
  fatorDeFaiscas,
} from "./fogos-parametros.ts";
export {
  TOKENS_DA_PALETA,
  TOKENS_DAS_AREAS,
  paletaDosFogos,
} from "./fogos-paleta.ts";
export {
  tempoDeSubida,
  SUBIDA_DA_AYA,
  planejarShow,
  lancarFoguete,
  moverFoguete,
} from "./fogos-roteiro.ts";
export {
  estourar,
  fumacaDoEstouro,
  moverParticula,
  centelhas,
  brasa,
  brilhoDaParticula,
  corDaParticula,
  alfaDoRastro,
  fatorDeSaida,
} from "./fogos-fisica.ts";
export type { OpcoesDoEstouro, OpcoesDaFumaca } from "./fogos-fisica.ts";
export { criarShow, avancarShow, showAcabou } from "./fogos-show.ts";
