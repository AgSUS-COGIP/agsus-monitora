import { comecarCargaDeTela } from "../lib/carga-de-telas";
import { importarComRecarga } from "../lib/importar-com-recarga";

/*
  Tela carregada sob demanda: o código de uma tela (Avaliação documental,
  Classificação, Entrevistas…) sai do pacote principal e só baixa quando a
  tela abre (ou quando o mouse passa no item do menu: `carregar()`).

  Devolve, já na abertura do app, um controlador com o mesmo contrato do
  de verdade (`window.recursosController`…), para o legado e a navegação não
  mudarem:
  - os `metodos` (render, abrirVisao…) chamados antes da carga baixam a tela,
    montam e então chamam o método de verdade (devolvem a promessa);
  - `padroes` responde, antes da carga, o que precisa ser síncrono
    (`confirmarSaida: () => true`: nada aberto, nada a perder);
  - qualquer outra propriedade (`estado`, `raiz`…) é a do controlador de
    verdade depois da carga, e `undefined` antes (quem lê usa `?.`);
  - `carregar()` baixa e monta; `carregado` diz se já montou.

  Enquanto baixa, a seção da tela mostra o estado de carregamento padrão
  (`.ui-vazio`, "Carregando…"); o React troca pelo módulo ao montar. Versão
  nova publicada com a página aberta: recarrega uma vez em vez de quebrar
  (importarComRecarga). Outra falha (rede caída, recarga recente que falhou de
  novo): o "Carregando…" vira o erro com "Tentar de novo", que chama o mesmo
  método outra vez — antes, ficava "Carregando…" para sempre e a rejeição
  escapava solta. O método chamado antes da carga, então, nunca rejeita:
  resolve `undefined` com o erro na tela (o `carregar()` direto, da pré-carga
  do menu, continua rejeitando para quem chamou).
*/

export interface OpcoesDaTelaSobDemanda<C extends object> {
  /** Importa o módulo e devolve o controlador montado. */
  carregar: () => Promise<C>;
  /** Id da `<section>` da tela (para o "Carregando…"). */
  secao?: string;
  /** Métodos que, antes da carga, baixam e chamam. */
  metodos?: readonly string[];
  /** Respostas antes da carga. */
  padroes?: Readonly<Record<string, unknown>>;
  documento?: Document;
}

/** O que o controlador sob demanda tem desde a abertura do app. */
export interface ControleDaCarga<C> {
  carregar: () => Promise<C>;
  readonly carregado: boolean;
}

/**
 * O controlador sob demanda: as propriedades do de verdade chegam depois da
 * carga (antes, só os `metodos` e os `padroes`; quem lê usa `?.`).
 */
export type TelaSobDemanda<C extends object> = Partial<C> & ControleDaCarga<C>;

type MetodosDoControlador = Record<
  string,
  ((...argumentos: unknown[]) => unknown) | undefined
>;

export function telaSobDemanda<C extends object>({
  carregar,
  secao,
  metodos = ["render"],
  padroes = {},
  documento = globalThis.document,
}: OpcoesDaTelaSobDemanda<C>): TelaSobDemanda<C> {
  let real: C | null = null;
  let pedido: Promise<C> | null = null;
  const baixar = importarComRecarga(carregar);

  const elementoDaSecao = () =>
    secao ? (documento?.getElementById(secao) ?? null) : null;

  /* Os avisos desta carga na seção ("Carregando…" e o erro): só estes são trocados. */
  const avisosDaCarga = (elemento: HTMLElement) =>
    elemento.querySelectorAll(":scope > [data-tela-sob-demanda]");

  function mostrarCarregando() {
    const elemento = elementoDaSecao();
    if (!elemento) return;
    avisosDaCarga(elemento).forEach((aviso) => aviso.remove());
    if (elemento.childElementCount) return;
    const aviso = documento.createElement("div");
    aviso.className = "ui-vazio";
    aviso.dataset.telaSobDemanda = "carregando";
    aviso.setAttribute("role", "status");
    aviso.textContent = "Carregando…";
    elemento.append(aviso);
  }

  /* A carga falhou: o "Carregando…" vira o erro, com "Tentar de novo". */
  function mostrarErro(tentarDeNovo: () => void) {
    const elemento = elementoDaSecao();
    if (!elemento) return;
    avisosDaCarga(elemento).forEach((aviso) => aviso.remove());
    const aviso = documento.createElement("div");
    aviso.className = "ui-vazio";
    aviso.dataset.telaSobDemanda = "erro";
    aviso.setAttribute("role", "alert");
    const texto = documento.createElement("p");
    texto.textContent =
      "Não foi possível carregar esta tela. Confira a conexão e tente de novo.";
    const botao = documento.createElement("button");
    botao.type = "button";
    botao.className = "btn secondary";
    botao.dataset.acao = "tentar-carregar-tela";
    botao.textContent = "Tentar de novo";
    botao.addEventListener("click", tentarDeNovo, { once: true });
    aviso.append(texto, botao);
    elemento.append(aviso);
  }

  function garantir(): Promise<C> {
    if (real) return Promise.resolve(real);
    if (!pedido) {
      const terminar = comecarCargaDeTela();
      pedido = baixar()
        .then((controlador) => {
          real = controlador;
          return real;
        })
        .catch((erro) => {
          // Falhou (rede): a próxima abertura tenta de novo.
          pedido = null;
          throw erro;
        })
        .finally(terminar);
    }
    return pedido;
  }

  const proprio: ControleDaCarga<C> = {
    carregar: () => garantir(),
    get carregado() {
      return Boolean(real);
    },
  };

  return new Proxy(proprio, {
    get(alvo, chave) {
      if (Object.hasOwn(alvo, chave)) return alvo[chave as keyof typeof alvo];
      if (real) {
        const valor = (real as Record<PropertyKey, unknown>)[chave];
        return typeof valor === "function" ? valor.bind(real) : valor;
      }
      if (typeof chave === "string" && Object.hasOwn(padroes, chave))
        return padroes[chave];
      if (typeof chave === "string" && metodos.includes(chave)) {
        const chamar = (...argumentos: unknown[]): Promise<unknown> => {
          mostrarCarregando();
          return garantir().then(
            (controlador) =>
              (controlador as MetodosDoControlador)[chave]?.(...argumentos),
            (erro: unknown) => {
              console.warn("Não foi possível carregar a tela:", erro);
              mostrarErro(() => void chamar(...argumentos));
              return undefined;
            },
          );
        };
        return chamar;
      }
      return undefined;
    },
  }) as TelaSobDemanda<C>;
}
