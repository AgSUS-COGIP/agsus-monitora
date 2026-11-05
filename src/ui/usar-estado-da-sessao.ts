import { useCallback, useState } from "react";

/*
  O estado de uma tela que sobrevive ao F5 (os filtros de uma lista): o
  valor fica na sessão da aba do navegador (sessionStorage), pela `chave`
  (tela e edital), e volta ao abrir de novo. Só conveniência: sem
  armazenamento (janela privada, bloqueado), vale o estado da tela.

  `normalizar` confere o que veio guardado (versão antiga, campo a mais) e
  devolve o valor no formato de agora. Trocar a chave (outro edital) lê o
  guardado dela.
*/

function armazenamento(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Lê o guardado da chave (ou o inicial). */
export function lerDaSessao<T>(
  chave: string,
  inicial: T,
  normalizar: (guardado: unknown) => T,
): T {
  if (!chave) return inicial;
  try {
    const texto = armazenamento()?.getItem(chave);
    return texto ? normalizar(JSON.parse(texto)) : inicial;
  } catch {
    return inicial;
  }
}

/** Guarda o valor da chave (o inicial apaga, para não acumular). */
export function gravarNaSessao<T>(chave: string, valor: T, inicial: T) {
  if (!chave) return;
  try {
    const texto = JSON.stringify(valor);
    if (texto === JSON.stringify(inicial)) armazenamento()?.removeItem(chave);
    else armazenamento()?.setItem(chave, texto);
  } catch {
    // Sem armazenamento: fica só na tela.
  }
}

export function usarEstadoDaSessao<T>(
  chave: string,
  inicial: T,
  normalizar: (guardado: unknown) => T,
): [T, (novo: T | ((atual: T) => T)) => void] {
  const [estado, setEstado] = useState(() => ({
    chave,
    valor: lerDaSessao(chave, inicial, normalizar),
  }));
  // Chave nova (outro edital): o guardado dela, já neste desenho.
  const atual =
    estado.chave === chave
      ? estado.valor
      : lerDaSessao(chave, inicial, normalizar);
  if (estado.chave !== chave) setEstado({ chave, valor: atual });

  const mudar = useCallback(
    (novo: T | ((anterior: T) => T)) =>
      setEstado((anterior) => {
        const base =
          anterior.chave === chave
            ? anterior.valor
            : lerDaSessao(chave, inicial, normalizar);
        const valor =
          typeof novo === "function"
            ? (novo as (anterior: T) => T)(base)
            : novo;
        gravarNaSessao(chave, valor, inicial);
        return { chave, valor };
      }),
    // `inicial` e `normalizar` são da tela (constantes de módulo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chave],
  );
  return [atual, mudar];
}
