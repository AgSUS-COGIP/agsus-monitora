import type { ComemoracaoNaTela } from "../modulos/comemoracao/plano.ts";

/*
  As comemorações na tela (o aviso e o efeito de cada uma), fora do React e
  no pacote principal: quem comemora (src/app/comemoracao-sob-demanda.ts →
  `comemorar` de src/modulos/comemoracao/comemoracoes.tsx) põe aqui; a casca
  (src/app/casca/casca.tsx) desenha enquanto houver alguma — e só então
  baixa o desenho (~120 kB). Fechar (× ou o tempo do aviso) tira daqui.
*/

export type NovaComemoracao = Omit<ComemoracaoNaTela, "id">;

let fila: readonly ComemoracaoNaTela[] = Object.freeze([]);
let proximoId = 1;
const ouvintes = new Set<() => void>();

function publicar(nova: readonly ComemoracaoNaTela[]) {
  fila = Object.freeze(nova);
  ouvintes.forEach((ouvinte) => ouvinte());
}

export const filaDeComemoracoes = Object.freeze({
  obter: (): readonly ComemoracaoNaTela[] => fila,
  assinar(ouvinte: () => void): () => void {
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  },
  /** Põe a comemoração na tela; devolve o id. */
  adicionar(nova: NovaComemoracao): number {
    const id = proximoId++;
    publicar([...fila, Object.freeze({ ...nova, id })]);
    return id;
  },
  /** Tira a comemoração da tela (o aviso e o efeito); repetir não faz nada. */
  remover(id: number): void {
    if (!fila.some((c) => c.id === id)) return;
    publicar(fila.filter((c) => c.id !== id));
  },
  /** Só para os testes: esvazia a fila. */
  esvaziar(): void {
    if (fila.length) publicar([]);
  },
});
