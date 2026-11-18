/*
  As raízes do React que os testes abriram e ainda não desmontaram. Quem desenha
  (tests/montar-tela.ts) registra; o `bloco` (tests/apoio/bloco.ts) desmonta as
  que sobraram ao fim, para a tela de um bloco não continuar ouvindo os eventos
  e os estados do bloco seguinte.
*/
const abertas = new Set<() => void>();

export function registrarRaiz(desmontar: () => void): () => void {
  const fechar = () => {
    if (!abertas.delete(fechar)) return;
    desmontar();
  };
  abertas.add(fechar);
  return fechar;
}

export function desmontarRaizesAbertas(): void {
  for (const fechar of [...abertas]) {
    try {
      fechar();
    } catch {
      // Raiz que já caiu com o teste: nada a desmontar.
    }
  }
  abertas.clear();
}
