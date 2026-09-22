/*
  O QUE DE CADA VEREDITO VIAJA NO PACOTE

  Este módulo é partilhado por quem faz a auditoria — `validar-localizacoes.mjs`,
  que fala com o CNES e com o IBGE e demora — e por quem só recompila o
  ficheiro do pacote a partir do JSON já auditado, sem rede. Enquanto a forma
  estiver escrita nos dois sítios, os dois divergem.

  ANTES SÓ VIAJAVAM 94 DOS 606

  O critério era "só os vereditos que mudam alguma coisa": os `validada`, que
  trocam o rótulo e passam a mandar na coordenada, e os `erro`. Os outros 512
  ficavam de fora com o argumento de que seriam peso morto.

  Não eram. Dos 512, **119 são conflito** — as duas fontes discordam, mediana
  de 101 km, máximo de 821 —, e o mapa escrevia "Localização em validação" em
  cima de todos. Essa é a frase de quem ainda não olhou. Tinha-se olhado, e
  tinha-se encontrado exatamente aquilo que o painel existe para mostrar.

  Passa tudo. São ~90 KB antes de compressão, e valem mais do que pesam.
*/
export function vereditoParaOMapa(registro) {
  const saida = {
    dsei: registro.dsei,
    canonico: registro.canonico,
    estado: registro.estado,
    motivo: registro.motivo,
  };
  /*
    A CASAI DE ALTAMIRA E O POLO DE ALTAMIRA NÃO SÃO A MESMA COISA

    O nome canónico de "CASA DE SAUDE INDIGENA DE ALTAMIRA" reduz-se a
    ALTAMIRA, e o do polo da mesma cidade também. A chave de leitura era
    DSEI + canónico, portanto as duas colidiam — e chave repetida é ambiguidade,
    que faz o índice descartar AS DUAS. Trinta e três das 34 colisões medidas
    eram exatamente isto, e por causa delas 30 das 83 CASAIs do mapa diziam
    "Localização em validação" tendo veredito.

    Basta distinguir CASAI do resto: é a única fronteira onde o nome de cidade
    se repete entre equipamentos com endereços diferentes. Vai como marca, e não
    como o tipo inteiro, porque é só isto que a chave precisa de saber.
  */
  if (registro.tipo === "casai") saida.casai = true;

  /*
    O nome da terra, quando foi ela que confirmou. Sem ele a frase diz apenas
    "dentro de Terra Indígena" e cala justamente a informação que se apurou —
    QUAL terra. Só viaja no veredito que a usa.
  */
  if (registro.terra) saida.terra = registro.terra;
  // A distância entre fontes é o que dá tamanho ao conflito. Sem ela, "as duas
  // fontes discordam" não diz se são 5 km ou 800.
  if (Number.isFinite(Number(registro.km))) {
    saida.km = Number(Number(registro.km).toFixed(1));
  }
  /*
    A coordenada só vai nos `validada`, porque só neles o mapa a usa para
    substituir a que lá está. Levá-la nos outros seria carregar um número que
    ninguém pode usar e que alguém acabaria por usar.
  */
  if (registro.estado === "validada" && registro.lat != null) {
    saida.lat = registro.lat;
    saida.lon = registro.lon;
  }
  return saida;
}

/*
  O FICHEIRO SAI JÁ FORMATADO

  `JSON.stringify(..., null, 2)` não é o que o Prettier escreveria, e o
  verificador de formatação do CI reprova o ficheiro gerado — um trabalho de
  dados a falhar por um espaço em branco.

  Formatar aqui, com o próprio Prettier do repositório, é melhor do que pedir a
  quem correr o script que se lembre de fazê-lo a seguir: um passo que depende
  de memória é um passo que se esquece.
*/
export async function ficheiroDosVereditos(registros) {
  const paraOMapa = registros.map(vereditoParaOMapa);
  const porEstado = new Map();
  for (const r of paraOMapa)
    porEstado.set(r.estado, (porEstado.get(r.estado) || 0) + 1);
  const resumo = [...porEstado]
    .sort((a, b) => b[1] - a[1])
    .map(([estado, n]) => `  ${String(n).padStart(4)}  ${estado}`);

  const texto = [
    "/*",
    "  GERADO por scripts/validar-localizacoes.mjs. Não editar à mão.",
    "",
    `  ${paraOMapa.length} vereditos de localização:`,
    "",
    ...resumo,
    "",
    "  Viajam todos, e não só os que trocam a coordenada. Um conflito entre as",
    "  duas fontes é resultado de auditoria tanto quanto uma validação, e o mapa",
    "  não tem como o dizer se ele ficar aqui de fora.",
    "",
    "  A prova de cada veredito está em public/data/localizacoes-validadas.json.",
    "*/",
    `export const LOCALIZACOES_VALIDADAS = ${JSON.stringify(paraOMapa, null, 2)};`,
    "",
  ].join("\n");

  const { format } = await import("prettier");
  return format(texto, {
    parser: "babel",
    filepath: "localizacoes-validadas-gerado.js",
  });
}
