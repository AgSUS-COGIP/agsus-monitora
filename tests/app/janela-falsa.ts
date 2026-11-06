/*
  A janela de mentira das telas que recebem `janela` (a moldura): os campos
  que o teste dá e, fora deles, a janela do jsdom. Quem recebe só lê os
  campos dados (matchMedia, ouvintes, print, dispatchEvent).
*/
/* A janela tem os campos do teste (pelo Proxy): o tipo passa a dizê-lo. */
function temOsCampos<E extends object>(
  janela: Window,
  campos: E,
): janela is Window & E {
  return Object.keys(campos).every((chave) => chave in janela);
}

export function janelaCom<E extends object>(campos: E): Window & E {
  // O Proxy é a janela do jsdom; os campos do teste vêm por cima.
  const janela = new Proxy(window, {
    get: (alvo, chave) =>
      chave in campos ? Reflect.get(campos, chave) : Reflect.get(alvo, chave),
    has: (alvo, chave) => chave in campos || chave in alvo,
  });
  if (!temOsCampos(janela, campos))
    throw new Error("janelaCom: a janela de mentira perdeu um campo");
  return janela;
}

/** Quem ouve um evento da janela de mentira. */
export type OuvinteDaJanela = (evento: unknown) => unknown;

/** Os ouvintes por evento, como a janela de mentira guarda. */
export type OuvintesDaJanela = Record<string, Set<OuvinteDaJanela>>;
