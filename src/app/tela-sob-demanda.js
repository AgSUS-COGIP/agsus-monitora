import { comecarCargaDeTela } from "../lib/carga-de-telas.js";
import { importarComRecarga } from "../lib/importar-com-recarga.js";

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
  (importarComRecarga).
*/

/**
 * @param {object} p
 * @param {() => Promise<object>} p.carregar importa o módulo e devolve o controlador montado
 * @param {string} [p.secao] id da `<section>` da tela (para o "Carregando…")
 * @param {string[]} [p.metodos] métodos que, antes da carga, baixam e chamam
 * @param {Record<string, unknown>} [p.padroes] respostas antes da carga
 * @param {Document} [p.documento]
 */
export function telaSobDemanda({
  carregar,
  secao,
  metodos = ["render"],
  padroes = {},
  documento = globalThis.document,
}) {
  let real = null;
  let pedido = null;
  const baixar = importarComRecarga(carregar);

  function mostrarCarregando() {
    const elemento = secao ? documento?.getElementById(secao) : null;
    if (!elemento || elemento.childElementCount) return;
    const aviso = documento.createElement("div");
    aviso.className = "ui-vazio";
    aviso.setAttribute("role", "status");
    aviso.textContent = "Carregando…";
    elemento.append(aviso);
  }

  function garantir() {
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

  const proprio = {
    carregar: () => garantir(),
    get carregado() {
      return Boolean(real);
    },
  };

  return new Proxy(proprio, {
    get(alvo, chave) {
      if (Object.hasOwn(alvo, chave)) return alvo[chave];
      if (real) {
        const valor = real[chave];
        return typeof valor === "function" ? valor.bind(real) : valor;
      }
      if (typeof chave === "string" && Object.hasOwn(padroes, chave))
        return padroes[chave];
      if (typeof chave === "string" && metodos.includes(chave))
        return (...argumentos) => {
          mostrarCarregando();
          return garantir().then((controlador) =>
            controlador[chave]?.(...argumentos),
          );
        };
      return undefined;
    },
  });
}
