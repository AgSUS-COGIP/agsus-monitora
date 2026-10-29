import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/*
  A lista que vem do banco em páginas (50 por vez): a primeira página quando a
  lista fica ativa (ou a chave muda: filtro, busca, ordem, versão dos dados) e a
  seguinte quando a tabela pede mais (TabelaInfinita com `servidor`). O banco
  manda o total do recorte e o cursor da próxima página (null = acabou).
  Resposta de uma chave antiga (filtro trocado no meio) é descartada.
*/

export const LINHAS_POR_PAGINA = 50;

/** Uma página como a tela a recebe do banco (ou da leitura de reserva). */
export interface PaginaDoServidor<T> {
  linhas: readonly T[];
  /** O cursor da próxima página; null quando acabou. */
  proximo: unknown;
  /** Quantos há no recorte inteiro (não só nesta página). */
  total: number;
}

/** Busca a página depois de `apos` (null = a primeira). */
export type BuscarPagina<T> = (
  apos: unknown,
  limite: number,
) => Promise<PaginaDoServidor<T>>;

export interface ListaNoServidor<T> {
  itens: readonly T[];
  total: number;
  /** A primeira página já chegou (ou falhou). */
  carregado: boolean;
  carregando: boolean;
  /** Há mais páginas no banco. */
  temMais: boolean;
  erro: string;
  carregarMais: () => void;
  recarregar: () => void;
}

interface EstadoDaLista<T> {
  chave: string;
  itens: readonly T[];
  total: number;
  proximo: unknown;
  carregado: boolean;
  carregando: boolean;
  erro: string;
}

const vazia = <T>(chave: string): EstadoDaLista<T> => ({
  chave,
  itens: [],
  total: 0,
  proximo: null,
  carregado: false,
  carregando: false,
  erro: "",
});

const mensagem = (erro: unknown) =>
  erro instanceof Error
    ? erro.message
    : String(
        (erro as { message?: unknown } | null)?.message ??
          "Não foi possível carregar.",
      );

/**
 * `buscar` pode mudar a cada desenho: vale a da chave atual. `ativo` false
 * (ex.: cartão ainda fora da tela) segura a primeira página.
 */
export function usarListaNoServidor<T>(
  buscar: BuscarPagina<T> | null,
  chave: string,
  { ativo = true, porVez = LINHAS_POR_PAGINA } = {},
): ListaNoServidor<T> {
  const [estado, setEstado] = useState<EstadoDaLista<T>>(() => vazia(chave));
  const buscarAtual = useRef(buscar);
  buscarAtual.current = buscar;
  const chaveAtual = useRef(chave);
  chaveAtual.current = chave;
  const pedido = useRef(0);
  // O estado desta chave (chave nova começa vazia já neste desenho).
  const vaziaDaChave = useMemo(() => vazia<T>(chave), [chave]);
  const atual = estado.chave === chave ? estado : vaziaDaChave;

  const pedir = useCallback(
    (apos: unknown, base: EstadoDaLista<T>) => {
      const fn = buscarAtual.current;
      if (!fn) return;
      const meu = ++pedido.current;
      const daChave = base.chave;
      setEstado({ ...base, carregando: true, erro: "" });
      fn(apos, porVez).then(
        (pagina) => {
          if (meu !== pedido.current || chaveAtual.current !== daChave) return;
          setEstado((anterior) => {
            const itens =
              apos === null || apos === undefined
                ? pagina.linhas
                : [
                    ...(anterior.chave === daChave ? anterior.itens : []),
                    ...pagina.linhas,
                  ];
            return {
              chave: daChave,
              itens,
              total: Number.isFinite(pagina.total)
                ? pagina.total
                : itens.length,
              proximo: pagina.proximo ?? null,
              carregado: true,
              carregando: false,
              erro: "",
            };
          });
        },
        (erro: unknown) => {
          if (meu !== pedido.current || chaveAtual.current !== daChave) return;
          setEstado((anterior) => ({
            ...(anterior.chave === daChave ? anterior : vazia<T>(daChave)),
            carregado: true,
            carregando: false,
            erro: mensagem(erro),
          }));
        },
      );
    },
    [porVez],
  );

  const pronto = Boolean(buscar);
  // A chave cuja primeira página já foi pedida (o efeito pode rodar duas vezes).
  const pedida = useRef("");
  useEffect(() => {
    if (!ativo || !pronto || pedida.current === chave) return;
    pedida.current = chave;
    pedir(null, vazia<T>(chave));
    // A primeira página só depende da chave e de a lista estar ativa.
  }, [chave, ativo, pronto]);

  const carregarMais = useCallback(() => {
    if (atual.carregando || atual.proximo === null || atual.erro) return;
    pedir(atual.proximo, atual);
  }, [atual, pedir]);
  const recarregar = useCallback(
    () => pedir(null, vazia<T>(chave)),
    [chave, pedir],
  );

  // O mesmo objeto enquanto nada muda (a tabela memorizada não redesenha).
  return useMemo(
    () => ({
      itens: atual.itens,
      total: atual.total,
      carregado: atual.carregado,
      carregando: atual.carregando,
      temMais: atual.proximo !== null,
      erro: atual.erro,
      carregarMais,
      recarregar,
    }),
    [atual, carregarMais, recarregar],
  );
}
