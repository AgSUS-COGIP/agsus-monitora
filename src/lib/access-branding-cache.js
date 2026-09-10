/*
  Marca da tela de acesso guardada localmente, para a primeira pintura já sair certa.

  ## O problema

  Esta é uma aplicação de página única servida estaticamente: o HTML sai da CDN
  igual para todo mundo, e a configuração da marca só chega depois, numa consulta
  ao Supabase. Entre a primeira pintura e a resposta, a tela precisava mostrar
  alguma coisa — e mostrava o padrão embutido: um fundo próprio e o painel lilás
  de `DEFAULT_ACCESS_BRANDING`.

  O resultado eram três aparências para a mesma tela, dependendo do instante em
  que se olhava: o roxo do `background-color`, depois a arte padrão com painel
  lilás, e só então a arte configurada. E, quando a consulta falhava — um 401
  bastava —, a tela **ficava** na arte padrão, exibindo como institucional uma
  identidade que ninguém escolheu.

  ## Por que não é o mesmo que o SIGAV faz

  No SIGAV a tela de acesso é renderizada no servidor: o HTML chega com a marca
  já aplicada e não existe intervalo. Aqui não há etapa de servidor onde fazer
  isso — reproduzir aquele desenho exigiria transformar um site estático em um
  que consulta banco a cada visita, trocando um problema visual por uma
  dependência nova no caminho crítico do login.

  ## O que este módulo faz

  Guarda a última marca conhecida e a devolve cedo, antes de qualquer requisição.
  Quem já acessou vê a arte correta desde o primeiro quadro. Quem nunca acessou
  vê fundo neutro — nunca a arte de outra configuração.

  A troca é deliberada: prefere-se meio segundo sóbrio a meio segundo mentindo
  sobre a identidade da instituição.
*/

const CHAVE = "agsus_monitora_access_branding_v1";

/** Só o que a tela de acesso pinta. Nada de identificador de pessoa ou sessão. */
const CAMPOS = [
  "backgroundUrl",
  "panelColor",
  "logoUrl",
  "greeting",
  "instruction",
  // Texto do botão do Google: evita que o rótulo padrão pisque antes da RPC.
  "buttonText",
  // Modo do texto sobre o painel: auto, claro ou escuro.
  "textoModo",
];

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Lê a marca guardada da visita anterior.
 *
 * Devolve `null` quando não há nada guardado, quando o conteúdo não é o objeto
 * esperado, ou quando o armazenamento é inacessível — janela anônima e políticas
 * de privacidade derrubam `localStorage` sem aviso. Em todos esses casos quem
 * chama cai no fundo neutro, que é o estado seguro.
 */
export function lerMarcaGuardada() {
  try {
    const bruto = globalThis.localStorage?.getItem(CHAVE);
    if (!bruto) return null;

    const dados = JSON.parse(bruto);
    if (!dados || typeof dados !== "object") return null;

    const marca = {};
    for (const campo of CAMPOS) {
      const valor = texto(dados[campo]);
      if (valor) marca[campo] = valor;
    }
    return Object.keys(marca).length ? marca : null;
  } catch (erro) {
    return null;
  }
}

/**
 * Guarda a marca que acabou de chegar do Supabase.
 *
 * Falhar aqui não pode interromper nada: o armazenamento pode estar cheio ou
 * bloqueado, e isso é irrelevante para quem está tentando entrar. A próxima
 * visita apenas volta a começar pelo fundo neutro.
 */
export function guardarMarca(marca) {
  if (!marca || typeof marca !== "object") return;

  try {
    const guardar = {};
    for (const campo of CAMPOS) {
      const valor = texto(marca[campo]);
      if (valor) guardar[campo] = valor;
    }
    if (!Object.keys(guardar).length) return;

    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(guardar));
  } catch (erro) {
    // Silêncio proposital: ver o comentário acima.
  }
}

/** Usado pelos testes e pela saída da sessão, quando a marca deve ser reavaliada. */
export function limparMarcaGuardada() {
  try {
    globalThis.localStorage?.removeItem(CHAVE);
  } catch (erro) {
    // idem
  }
}
