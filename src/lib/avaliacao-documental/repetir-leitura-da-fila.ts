/**
 * Uma única recuperação para cancelamento transitório por statement_timeout.
 * Apenas chamadas de LEITURA da fila usam este utilitário: nunca repetir
 * reserva, conclusão de ficha ou qualquer ação de escrita.
 */
export function ehTimeoutDaFila(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const e = erro as { code?: unknown; message?: unknown };
  return (
    e.code === "57014" &&
    typeof e.message === "string" &&
    /statement timeout/i.test(e.message)
  );
}

/** Uma tentativa adicional, somente para leitura, após pequeno intervalo. */
export async function lerFilaComRecuperacao<T>(
  leitura: () => Promise<T>,
  pausa: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  try {
    return await leitura();
  } catch (erro) {
    if (!ehTimeoutDaFila(erro)) throw erro;
    await pausa(1200);
    return leitura();
  }
}
