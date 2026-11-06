import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { gravarNaSessao, lerDaSessao } from "../ui/usar-estado-da-sessao.ts";
import { criarEndereco } from "./endereco.ts";
import {
  buscaComFiltros,
  enderecoDaTela,
  filtrosDaBusca,
  filtrosGuardadosDaTela,
  guardarFiltrosDaTela,
  mesmosFiltros,
  mudouOQueEmpilha,
  normalizarFiltros,
  padroesDosFiltros,
} from "./filtros-no-endereco.ts";
import type { Endereco } from "./endereco.ts";
import type {
  EsquemaDosFiltros,
  ValoresDosFiltros,
} from "./filtros-no-endereco.ts";

/*
  Os filtros de uma tela na URL (regras em src/app/filtros-no-endereco.ts):
  o link copiado abre a tela já filtrada, e o Voltar/Avançar do navegador
  volta aos filtros de antes.

  - A tela diz quem ela é com <TelaNaUrl value="pre-classificacao"> (a `view`
    da rota); fora dele (ou com ""), os filtros ficam só na tela e na sessão.
  - Mudar um campo que `empilha` (edital, aba) é uma entrada nova no
    histórico, e os filtros da URL que não estão em `manter` saem (os da aba
    anterior). Os demais trocam a entrada atual (replaceState): mexer num
    filtro não enche o histórico. A busca por nome ou CPF não vai à URL
    (`naUrl: false`).
  - A tela fica montada quando se vai a outra: com a URL de outra tela, só se
    guarda (a navegação devolve ao voltar), e o voltar do navegador de lá não
    mexe aqui.

  Dois jeitos:
  - `usarFiltrosNaUrl`: o estado é do hook (filtros de uma lista). Sem nenhum
    filtro dele na URL, vale o guardado na sessão da aba (`sessao`, por
    edital); trocar a `sessao` (outro edital) lê o guardado dela.
  - `usarLojaNaUrl`: o estado é de uma loja da tela (o edital escolhido, o
    filtro da Fila). A URL entra na loja quando ela está `pronta`; a loja
    mudar escreve a URL. `usarEditalNaUrl` é o do edital.
*/

/** A `view` da tela cujos filtros vão para a URL ("" = nenhuma). */
export const TelaNaUrl = createContext("");

type Mudanca<C extends string> =
  | Partial<ValoresDosFiltros<C>>
  | ((atual: ValoresDosFiltros<C>) => Partial<ValoresDosFiltros<C>>);

export interface OpcoesDaEscrita {
  /** Troca a entrada atual mesmo mudando o que empilha. */
  substituir?: boolean;
}

export type MudarFiltros<C extends string> = (
  mudanca: Mudanca<C>,
  opcoes?: OpcoesDaEscrita,
) => void;

interface OpcoesComuns {
  /** Os parâmetros de fora que ficam quando o que empilha muda. */
  manter?: readonly string[];
  /** A tela (no lugar da de <TelaNaUrl>). */
  tela?: string;
  /** O endereço (nos testes, um com janela falsa). */
  endereco?: Endereco;
}

let enderecoDoApp: Endereco | null = null;
const enderecoPadrao = () => (enderecoDoApp ??= criarEndereco());

function usarTela(opcoes: OpcoesComuns) {
  const daArvore = useContext(TelaNaUrl);
  return {
    tela: opcoes.tela ?? daArvore,
    endereco: opcoes.endereco ?? enderecoPadrao(),
  };
}

/** Escreve os valores na URL (se ela é da tela) e guarda o que ficou. */
function escrever<C extends string>(
  endereco: Endereco,
  tela: string,
  esquema: EsquemaDosFiltros<C>,
  valores: Partial<ValoresDosFiltros<C>>,
  {
    empilhar = false,
    manter,
  }: { empilhar?: boolean; manter?: readonly string[] | undefined },
) {
  if (!tela) return;
  const local = endereco.obter();
  const aVista = enderecoDaTela(local, tela);
  const base = aVista ? local.busca : filtrosGuardadosDaTela(tela);
  const busca = buscaComFiltros(
    base,
    esquema,
    valores,
    empilhar ? (manter ?? []) : null,
  );
  guardarFiltrosDaTela(tela, busca);
  if (aVista && busca !== local.busca)
    endereco.ir(local.caminho + busca, { substituir: !empilhar });
}

/*
  Os filtros da URL ao montar, se ela é da tela, ou `null`. A tela monta
  quando é aberta, já com o endereço dela (a navegação o escreve antes).
*/
function lerAgora<C extends string>(
  endereco: Endereco,
  tela: string,
  esquema: EsquemaDosFiltros<C>,
) {
  if (!tela) return null;
  const local = endereco.obter();
  return enderecoDaTela(local, tela)
    ? filtrosDaBusca(esquema, local.busca)
    : null;
}

/** Os da URL do voltar/avançar (os ausentes no padrão), ou `null` se é de outra tela. */
function daUrlDoVoltar<C extends string>(
  tela: string,
  esquema: EsquemaDosFiltros<C>,
  local: { caminho: string; busca: string },
): ValoresDosFiltros<C> | null {
  if (!tela || !enderecoDaTela(local, tela)) return null;
  guardarFiltrosDaTela(tela, local.busca);
  return {
    ...padroesDosFiltros(esquema),
    ...(filtrosDaBusca(esquema, local.busca) ?? {}),
  };
}

/** Só os campos do esquema, como texto. */
function soDoEsquema<C extends string>(
  esquema: EsquemaDosFiltros<C>,
  parte: Partial<ValoresDosFiltros<C>>,
): Partial<ValoresDosFiltros<C>> {
  const limpa: Partial<ValoresDosFiltros<C>> = {};
  for (const c of Object.keys(esquema) as C[])
    if (c in parte) limpa[c] = String(parte[c] ?? "");
  return limpa;
}

const lerGuardados = <C extends string>(
  esquema: EsquemaDosFiltros<C>,
  sessao: string,
) =>
  lerDaSessao(sessao, padroesDosFiltros(esquema), (v) =>
    normalizarFiltros(esquema, v),
  );

/** Os filtros de uma lista, com o estado no hook. */
export function usarFiltrosNaUrl<C extends string>(
  esquema: EsquemaDosFiltros<C>,
  opcoes: OpcoesComuns & { sessao?: string } = {},
): [ValoresDosFiltros<C>, MudarFiltros<C>] {
  const { sessao = "", manter } = opcoes;
  const { tela, endereco } = usarTela(opcoes);
  const [estado, setEstado] = useState(() => {
    const guardados = lerGuardados(esquema, sessao);
    const daUrl = lerAgora(endereco, tela, esquema);
    return {
      sessao,
      valores: daUrl ? { ...guardados, ...daUrl } : guardados,
    };
  });
  // Outra sessão (outro edital) sem remontar: o guardado dela, já neste desenho.
  const valores =
    estado.sessao === sessao ? estado.valores : lerGuardados(esquema, sessao);
  if (estado.sessao !== sessao) setEstado({ sessao, valores });
  const atual = useRef(valores);
  atual.current = valores;

  // A URL acompanha o estado (ao montar, depois de outra sessão).
  useEffect(() => {
    escrever(endereco, tela, esquema, atual.current, { manter });
    // `esquema` e `manter` são da tela (constantes de módulo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endereco, tela, sessao]);

  // Voltar/avançar do navegador com a URL desta tela.
  useEffect(
    () =>
      endereco.assinar((local) => {
        const daUrl = daUrlDoVoltar(tela, esquema, local);
        if (!daUrl) return;
        setEstado((anterior) => {
          // O que não vai à URL (a busca) fica como está.
          const novos = { ...anterior.valores };
          for (const c of Object.keys(esquema) as C[])
            if (esquema[c].naUrl !== false) novos[c] = daUrl[c];
          if (mesmosFiltros(esquema, novos, anterior.valores)) return anterior;
          return { ...anterior, valores: novos };
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endereco, tela],
  );
  // O que veio do voltar também fica na sessão.
  useEffect(() => {
    gravarNaSessao(sessao, valores, padroesDosFiltros(esquema));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao, valores]);

  const mudar = useCallback<MudarFiltros<C>>(
    (mudanca, { substituir = false } = {}) => {
      const antes = atual.current;
      const parte = typeof mudanca === "function" ? mudanca(antes) : mudanca;
      const novos = { ...antes, ...soDoEsquema(esquema, parte) };
      if (mesmosFiltros(esquema, novos, antes)) return;
      // A URL antes do desenho: a aba nova já monta com a URL dela.
      escrever(endereco, tela, esquema, novos, {
        empilhar: !substituir && mudouOQueEmpilha(esquema, antes, novos),
        manter,
      });
      atual.current = novos;
      setEstado({ sessao, valores: novos });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endereco, tela, sessao],
  );

  return [valores, mudar];
}

/**
 * Os filtros que moram numa loja da tela. `valores` é o que a loja tem
 * agora; `aplicar` leva à loja o que veio da URL (link aberto, voltar do
 * navegador), só depois de `pronta` (os editais carregados). Devolve a
 * mudança feita pela pessoa: escreve a URL (empilhando, se for o caso) e
 * aplica.
 */
export function usarLojaNaUrl<C extends string>(
  esquema: EsquemaDosFiltros<C>,
  valores: ValoresDosFiltros<C>,
  aplicar: (valores: Partial<ValoresDosFiltros<C>>) => void,
  opcoes: OpcoesComuns & { pronta?: boolean } = {},
): MudarFiltros<C> {
  const { pronta = true, manter } = opcoes;
  const { tela, endereco } = usarTela(opcoes);
  const atual = useRef(valores);
  atual.current = valores;
  const aplicarAgora = useRef(aplicar);
  aplicarAgora.current = aplicar;
  // O que a URL tinha ao montar: vale uma vez, depois de pronta.
  const [pedido] = useState(() => lerAgora(endereco, tela, esquema));
  const [iniciada, setIniciada] = useState(false);

  useEffect(() => {
    if (!pronta || iniciada) return;
    if (pedido && !mesmosFiltros(esquema, pedido, atual.current))
      aplicarAgora.current(pedido);
    setIniciada(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronta, iniciada]);

  // A loja mudou (escolha automática, releitura): a URL acompanha.
  const chave = JSON.stringify(valores);
  useEffect(() => {
    if (iniciada) escrever(endereco, tela, esquema, atual.current, { manter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iniciada, chave, endereco, tela]);

  useEffect(
    () =>
      endereco.assinar((local) => {
        const daUrl = daUrlDoVoltar(tela, esquema, local);
        if (daUrl && !mesmosFiltros(esquema, daUrl, atual.current))
          aplicarAgora.current(daUrl);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endereco, tela],
  );

  return useCallback<MudarFiltros<C>>(
    (mudanca, { substituir = false } = {}) => {
      const antes = atual.current;
      const parte = soDoEsquema(
        esquema,
        typeof mudanca === "function" ? mudanca(antes) : mudanca,
      );
      const novos = { ...antes, ...parte };
      escrever(endereco, tela, esquema, novos, {
        empilhar: !substituir && mudouOQueEmpilha(esquema, antes, novos),
        manter,
      });
      aplicarAgora.current(parte);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endereco, tela],
  );
}

const ESQUEMA_DO_EDITAL: EsquemaDosFiltros<"edital"> = Object.freeze({
  edital: { padrao: "", empilha: true },
});

/* Na troca de edital, a aba da tela fica; os filtros do edital anterior saem. */
const FICA_NA_TROCA_DE_EDITAL = Object.freeze(["aba"]);

/**
 * O edital escolhido na URL (`?edital=<id>`). Devolve a escolha da pessoa
 * (para o seletor): outro edital é entrada nova no histórico e leva embora
 * os filtros do anterior. Edital da URL que não está na lista não abre.
 */
export function usarEditalNaUrl(
  {
    editalId,
    editais,
    carregado,
    escolher,
  }: {
    editalId: string;
    editais: ReadonlyArray<{ id: string }> | null | undefined;
    carregado: boolean;
    escolher: (id: string) => unknown;
  },
  opcoes: Omit<OpcoesComuns, "manter"> = {},
): (id: string) => void {
  const mudar = usarLojaNaUrl(
    ESQUEMA_DO_EDITAL,
    { edital: editalId },
    ({ edital = "" }) => {
      if (edital === editalId) return;
      if (edital && !(editais || []).some((ed) => ed.id === edital)) return;
      escolher(edital);
    },
    { ...opcoes, pronta: carregado, manter: FICA_NA_TROCA_DE_EDITAL },
  );
  return useCallback((id: string) => mudar({ edital: id }), [mudar]);
}
