/*
  Para os testes em TypeScript: o valor que o teste sabe que existe (o item
  de uma lista, o resultado de um `find`, um campo que pode vir nulo). Se não
  existir, o teste quebra ali, como quebrava em JavaScript ao ler
  `undefined.campo`, mas dizendo o que faltou.
*/
export function definido<T>(valor: T | null | undefined, oQue = "valor"): T {
  if (valor === null || valor === undefined)
    throw new TypeError(`${oQue} não existe (${String(valor)})`);
  return valor;
}
