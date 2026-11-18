import {
  LINHAS_POR_PAGINA,
  MIME_DO_RELATORIO,
  RELATORIOS_DOS_PAINEIS,
  RPC_LER_RELATORIO_DO_PAINEL,
  RPC_SINCRONIZAR_RELATORIO_DO_PAINEL,
  chaveDaPagina,
  csvDoRelatorio,
  definicaoDoRelatorio,
  lerPaginaDoRelatorio,
  nomeDoArquivoDoRelatorio,
  xlsxDoRelatorio,
} from "../../lib/paineis/relatorios-dos-paineis.ts";
import {
  RPC_LISTAR_FONTES_DO_PAINEL,
  RPC_SALVAR_FONTE_DA_COLUNA,
  lerFontesDoPainel,
  lerFontesDoRelatorio,
} from "../../lib/paineis/fontes-dos-paineis.ts";
import type {
  FonteDaColuna,
  FontesDoPainel,
} from "../../lib/paineis/fontes-dos-paineis.ts";
import type {
  FormatoDoRelatorio,
  IdDoRelatorio,
  LinhaDoRelatorio,
  PaginaLida,
  ZiparRelatorio,
} from "../../lib/paineis/relatorios-dos-paineis.ts";

/*
  O estado da tela de Painéis (sem React): o relatório escolhido e, para cada
  um, a página lida na área (`carregando`, `pronto` ou `erro`). O banco guarda
  cada relatório pronto (migration 20261116160000); a tela pede só a página
  visível e guarda as páginas já lidas em memória (nunca no disco: o relatório
  Aprovados tem dado pessoal). O cache de uma área e relatório cai quando o
  banco responde com outra data de cálculo, no Sincronizar (que recalcula o
  relatório aberto) e na troca de fonte. O download pede todas as linhas.
*/

export type SituacaoDoRelatorio = "vazio" | "carregando" | "pronto" | "erro";

export interface LeituraDoRelatorio {
  situacao: SituacaoDoRelatorio;
  area: string;
  /** As linhas da página à vista. */
  linhas: readonly LinhaDoRelatorio[];
  /** Quando o banco calculou o relatório. */
  calculadoEm: string | null;
  erro: string;
  /** A origem de cada coluna editável (a resposta do relatório). */
  fontes: Readonly<Record<string, FonteDaColuna>>;
  avisos: readonly string[];
  pagina: number;
  porPagina: number;
  /** Quantas linhas o relatório tem para quem lê. */
  total: number;
}

/** A gaveta "Fontes dos dados" do relatório aberto, na área do menu. */
export interface GavetaDeFontes {
  aberta: boolean;
  situacao: "vazio" | "carregando" | "pronto" | "erro";
  dados: FontesDoPainel | null;
  erro: string;
  /** A coluna sendo salva agora (uma por vez). */
  salvando: string | null;
  erroAoSalvar: string;
}

export interface EstadoDosPaineis {
  area: string;
  ativo: IdDoRelatorio;
  relatorios: Readonly<Record<IdDoRelatorio, LeituraDoRelatorio>>;
  baixando: FormatoDoRelatorio | null;
  erroNoDownload: string;
  gaveta: GavetaDeFontes;
  /** A largura (px) que a pessoa arrastou em cada coluna, por relatório; só em memória. */
  larguras: Readonly<Record<IdDoRelatorio, Readonly<Record<string, number>>>>;
}

type RespostaDaRpc = PromiseLike<{ data: unknown; error: unknown }>;

/** O que a tela usa do cliente do Supabase: a leitura, o Sincronizar e o editor de fontes. */
export interface ClienteDosPaineis {
  rpc(
    nome: typeof RPC_LER_RELATORIO_DO_PAINEL,
    parametros: {
      p_area: string;
      p_relatorio: IdDoRelatorio;
      p_pagina: number;
      p_por_pagina: number | null;
    },
  ): RespostaDaRpc;
  rpc(
    nome:
      | typeof RPC_SINCRONIZAR_RELATORIO_DO_PAINEL
      | typeof RPC_LISTAR_FONTES_DO_PAINEL,
    parametros: { p_area: string; p_relatorio: string },
  ): RespostaDaRpc;
  rpc(
    nome: typeof RPC_SALVAR_FONTE_DA_COLUNA,
    parametros: {
      p_area: string;
      p_relatorio: string;
      p_coluna: string;
      p_visao: string | null;
      p_coluna_visao: string | null;
      p_motivo: string;
    },
  ): RespostaDaRpc;
}

/** Uma troca de fonte pedida na gaveta (visao nula = voltar ao padrão). */
export interface TrocaPedida {
  coluna: string;
  visao: string | null;
  colunaDaVisao: string | null;
  motivo: string;
}

export interface OpcoesDoEstadoDosPaineis {
  supabase?: ClienteDosPaineis | null;
  /** Grava o arquivo no computador (o navegador, por padrão). */
  salvar?: (arquivo: Blob, nome: string) => void;
  /** O ZIP do XLSX (fflate.zipSync, baixado sob demanda, por padrão). */
  zipar?: () => Promise<ZiparRelatorio>;
  agora?: () => Date;
}

const POR_PAGINA_PADRAO = LINHAS_POR_PAGINA[0] as number;

const LEITURA_VAZIA: LeituraDoRelatorio = Object.freeze({
  situacao: "vazio",
  area: "",
  linhas: Object.freeze([]),
  calculadoEm: null,
  erro: "",
  fontes: Object.freeze({}),
  avisos: Object.freeze([]),
  pagina: 1,
  porPagina: POR_PAGINA_PADRAO,
  total: 0,
});

const GAVETA_FECHADA: GavetaDeFontes = Object.freeze({
  aberta: false,
  situacao: "vazio",
  dados: null,
  erro: "",
  salvando: null,
  erroAoSalvar: "",
});

/** A mensagem da falha ao salvar uma fonte: a do banco quando ela explica (22023). */
export function mensagemDaFalhaAoSalvar(erro: unknown): string {
  const codigo = String((erro as { code?: unknown } | null)?.code ?? "");
  const texto = String((erro as { message?: unknown } | null)?.message ?? "");
  if (codigo === "42501") return "Só o Administrador em Painéis troca a fonte.";
  if (codigo === "22023" && texto) return texto;
  return "Não foi possível salvar a fonte. Tente de novo.";
}

export const MENSAGEM_SEM_PERMISSAO =
  "Sem permissão para os Painéis desta área.";
export const MENSAGEM_SEM_PUBLICACAO =
  "Os relatórios dos Painéis ainda não foram publicados no banco.";

/** A mensagem da falha da RPC, pelo código do PostgreSQL / PostgREST. */
export function mensagemDaFalha(erro: unknown): string {
  const codigo = String((erro as { code?: unknown } | null)?.code ?? "");
  if (codigo === "PGRST202") return MENSAGEM_SEM_PUBLICACAO;
  if (codigo === "42501") return MENSAGEM_SEM_PERMISSAO;
  if (codigo === "22023") return "Área inválida para os Painéis.";
  const texto = String((erro as { message?: unknown } | null)?.message ?? "");
  return texto
    ? `Não foi possível ler o relatório: ${texto}`
    : "Não foi possível ler o relatório.";
}

function salvarNoNavegador(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ziparComFflate = () =>
  import("fflate").then((m): ZiparRelatorio => m.zipSync);

const relatoriosVazios = () =>
  Object.fromEntries(
    RELATORIOS_DOS_PAINEIS.map((r) => [r.id, LEITURA_VAZIA]),
  ) as Record<IdDoRelatorio, LeituraDoRelatorio>;

/** Uma página guardada no cache: o que o banco devolveu para ela. */
interface PaginaGuardada {
  lida: PaginaLida;
  fontes: Readonly<Record<string, FonteDaColuna>>;
  avisos: readonly string[];
}

async function chamar(
  supabase: ClienteDosPaineis | null,
  fazer: (cliente: ClienteDosPaineis) => RespostaDaRpc,
): Promise<{ data?: unknown; error?: unknown }> {
  try {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    return await fazer(supabase);
  } catch (error) {
    return { data: null, error };
  }
}

export function criarEstadoDosPaineis({
  supabase = null,
  salvar = salvarNoNavegador,
  zipar = ziparComFflate,
  agora = () => new Date(),
}: OpcoesDoEstadoDosPaineis = {}) {
  let estado: EstadoDosPaineis = {
    area: "",
    ativo: RELATORIOS_DOS_PAINEIS[0]!.id,
    relatorios: relatoriosVazios(),
    baixando: null,
    erroNoDownload: "",
    gaveta: GAVETA_FECHADA,
    larguras: Object.fromEntries(
      RELATORIOS_DOS_PAINEIS.map((r) => [r.id, Object.freeze({})]),
    ) as Record<IdDoRelatorio, Readonly<Record<string, number>>>,
  };
  const ouvintes = new Set<() => void>();
  // A leitura em curso de cada relatório: a resposta de um pedido antigo não sobrescreve a nova.
  const pedidos = new Map<IdDoRelatorio, number>();
  let numeroDoPedido = 0;
  // As páginas já lidas (só em memória) e a data do cálculo de cada área e relatório.
  const cache = new Map<string, PaginaGuardada>();
  const calculos = new Map<string, string | null>();

  function mudar(parcial: Partial<EstadoDosPaineis>) {
    estado = { ...estado, ...parcial };
    for (const ouvinte of ouvintes) ouvinte();
  }

  function mudarRelatorio(id: IdDoRelatorio, leitura: LeituraDoRelatorio) {
    mudar({ relatorios: { ...estado.relatorios, [id]: leitura } });
  }

  function limparCache(area: string, id: IdDoRelatorio) {
    const prefixo = `${area}|${id}|`;
    for (const chave of [...cache.keys()])
      if (chave.startsWith(prefixo)) cache.delete(chave);
    calculos.delete(`${area}|${id}`);
  }

  function mostrar(
    id: IdDoRelatorio,
    area: string,
    porPagina: number,
    { lida, fontes, avisos }: PaginaGuardada,
  ) {
    mudarRelatorio(id, {
      situacao: "pronto",
      area,
      linhas: Object.freeze(lida.linhas),
      calculadoEm: lida.calculadoEm,
      erro: "",
      fontes,
      avisos,
      pagina: lida.pagina,
      porPagina,
      total: lida.total,
    });
  }

  async function ler(
    id: IdDoRelatorio,
    area: string,
    pagina: number,
    porPagina: number,
    forcar = false,
  ) {
    const definicao = definicaoDoRelatorio(id);
    const pedido = ++numeroDoPedido;
    pedidos.set(id, pedido);
    const guardada = forcar
      ? undefined
      : cache.get(chaveDaPagina(area, id, pagina, porPagina));
    if (guardada) {
      mostrar(id, area, porPagina, guardada);
      return;
    }
    const anterior = estado.relatorios[id];
    mudarRelatorio(id, {
      ...(anterior.area === area ? anterior : LEITURA_VAZIA),
      situacao: "carregando",
      area,
      erro: "",
      pagina,
      porPagina,
    });
    const resposta = await chamar(supabase, (cliente) =>
      cliente.rpc(RPC_LER_RELATORIO_DO_PAINEL, {
        p_area: area,
        p_relatorio: id,
        p_pagina: pagina,
        p_por_pagina: porPagina,
      }),
    );
    if (pedidos.get(id) !== pedido) return;
    if (resposta.error) {
      mudarRelatorio(id, {
        ...LEITURA_VAZIA,
        situacao: "erro",
        area,
        erro: mensagemDaFalha(resposta.error),
        pagina,
        porPagina,
      });
      return;
    }
    const lida = lerPaginaDoRelatorio(definicao, resposta.data);
    const { fontes, avisos } = lerFontesDoRelatorio(resposta.data);
    // Outro cálculo no banco: as páginas guardadas do anterior não valem mais.
    const doCalculo = `${area}|${id}`;
    if (calculos.has(doCalculo) && calculos.get(doCalculo) !== lida.calculadoEm)
      limparCache(area, id);
    calculos.set(doCalculo, lida.calculadoEm);
    const nova: PaginaGuardada = { lida, fontes, avisos };
    cache.set(chaveDaPagina(area, id, lida.pagina, porPagina), nova);
    mostrar(id, area, porPagina, nova);
  }

  /* O relatório ativo da área, se ainda não foi lido nela (ou se `forcar`). */
  function garantir(forcar = false) {
    const { area, ativo } = estado;
    if (!area) return Promise.resolve();
    const leitura = estado.relatorios[ativo];
    const mesmaArea = leitura.area === area;
    if (!forcar && mesmaArea && leitura.situacao !== "vazio")
      return Promise.resolve();
    return ler(
      ativo,
      area,
      mesmaArea ? leitura.pagina : 1,
      leitura.porPagina,
      forcar,
    );
  }

  /** Recalcula no banco o relatório aberto e relê a página à vista. */
  async function sincronizar() {
    const { area, ativo } = estado;
    if (!area) return;
    const leitura = estado.relatorios[ativo];
    const pedido = ++numeroDoPedido;
    pedidos.set(ativo, pedido);
    mudarRelatorio(ativo, {
      ...(leitura.area === area ? leitura : LEITURA_VAZIA),
      situacao: "carregando",
      area,
      erro: "",
    });
    const resposta = await chamar(supabase, (cliente) =>
      cliente.rpc(RPC_SINCRONIZAR_RELATORIO_DO_PAINEL, {
        p_area: area,
        p_relatorio: ativo,
      }),
    );
    if (pedidos.get(ativo) !== pedido) return;
    if (resposta.error) {
      mudarRelatorio(ativo, {
        ...LEITURA_VAZIA,
        situacao: "erro",
        area,
        erro: mensagemDaFalha(resposta.error),
      });
      return;
    }
    limparCache(area, ativo);
    await ler(
      ativo,
      area,
      leitura.area === area ? leitura.pagina : 1,
      leitura.porPagina,
      true,
    );
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    /** Abre (ou troca) a área: lê o relatório escolhido, se ainda não leu nela. */
    carregar(area: string) {
      const limpa = String(area ?? "").trim();
      // Área nova: a gaveta de fontes era da outra área; fecha.
      if (limpa !== estado.area)
        mudar({ area: limpa, erroNoDownload: "", gaveta: GAVETA_FECHADA });
      return garantir();
    },
    escolher(id: IdDoRelatorio) {
      if (id === estado.ativo) return Promise.resolve();
      mudar({ ativo: definicaoDoRelatorio(id).id, erroNoDownload: "" });
      return garantir();
    },
    /** Vai para outra página do relatório aberto (do cache, se já foi lida). */
    irParaPagina(pagina: number) {
      const { area, ativo } = estado;
      if (!area) return Promise.resolve();
      return ler(ativo, area, pagina, estado.relatorios[ativo].porPagina);
    },
    /** Muda quantas linhas por página e volta à primeira. */
    mudarPorPagina(porPagina: number) {
      const { area, ativo } = estado;
      if (!area) return Promise.resolve();
      return ler(ativo, area, 1, porPagina);
    },
    sincronizar,
    /**
     * Junta larguras (px por campo) às do relatório aberto. Ficam só na
     * memória da tela: recarregar a página volta às originais.
     */
    mudarLarguras(larguras: Readonly<Record<string, number>>) {
      const { ativo } = estado;
      mudar({
        larguras: {
          ...estado.larguras,
          [ativo]: Object.freeze({ ...estado.larguras[ativo], ...larguras }),
        },
      });
    },
    /** Abre a gaveta "Fontes dos dados" do relatório aberto, na área do menu. */
    async abrirFontes() {
      const { area, ativo } = estado;
      if (!area) return;
      mudar({
        gaveta: { ...GAVETA_FECHADA, aberta: true, situacao: "carregando" },
      });
      const resposta = await chamar(supabase, (cliente) =>
        cliente.rpc(RPC_LISTAR_FONTES_DO_PAINEL, {
          p_area: area,
          p_relatorio: ativo,
        }),
      );
      const mesma =
        estado.gaveta.aberta && estado.area === area && estado.ativo === ativo;
      if (!mesma) return;
      const dados = resposta.error ? null : lerFontesDoPainel(resposta.data);
      mudar({
        gaveta: dados
          ? { ...estado.gaveta, situacao: "pronto", dados }
          : {
              ...estado.gaveta,
              situacao: "erro",
              erro: resposta.error
                ? mensagemDaFalha(resposta.error)
                : "Resposta inesperada do banco.",
            },
      });
    },
    fecharFontes() {
      mudar({ gaveta: GAVETA_FECHADA });
    },
    /**
     * Troca a fonte de uma coluna (ou volta ao padrão). O banco recalcula o
     * relatório na mesma transação: deu certo, a gaveta mostra o estado novo,
     * o cache do relatório cai e a página à vista é relida.
     */
    async salvarFonte(troca: TrocaPedida): Promise<boolean> {
      const { area, ativo } = estado;
      if (!area || estado.gaveta.salvando) return false;
      mudar({
        gaveta: { ...estado.gaveta, salvando: troca.coluna, erroAoSalvar: "" },
      });
      const resposta = await chamar(supabase, (cliente) =>
        cliente.rpc(RPC_SALVAR_FONTE_DA_COLUNA, {
          p_area: area,
          p_relatorio: ativo,
          p_coluna: troca.coluna,
          p_visao: troca.visao,
          p_coluna_visao: troca.visao ? troca.colunaDaVisao : null,
          p_motivo: troca.motivo.trim(),
        }),
      );
      const dados = resposta.error ? null : lerFontesDoPainel(resposta.data);
      if (!dados) {
        mudar({
          gaveta: {
            ...estado.gaveta,
            salvando: null,
            erroAoSalvar: mensagemDaFalhaAoSalvar(resposta.error),
          },
        });
        return false;
      }
      mudar({ gaveta: { ...estado.gaveta, salvando: null, dados } });
      limparCache(area, ativo);
      // A pessoa trocou de área ou de relatório enquanto salvava: não relê a página antiga.
      if (estado.area !== area || estado.ativo !== ativo) return true;
      const leitura = estado.relatorios[ativo];
      await ler(
        ativo,
        area,
        leitura.area === area ? leitura.pagina : 1,
        leitura.porPagina,
        true,
      );
      return true;
    },
    /** Baixa o relatório aberto inteiro (todas as linhas que a pessoa vê). */
    async baixar(formato: FormatoDoRelatorio) {
      const definicao = definicaoDoRelatorio(estado.ativo);
      const leitura = estado.relatorios[definicao.id];
      if (estado.baixando || leitura.situacao !== "pronto") return;
      mudar({ baixando: formato, erroNoDownload: "" });
      try {
        const resposta = await chamar(supabase, (cliente) =>
          cliente.rpc(RPC_LER_RELATORIO_DO_PAINEL, {
            p_area: leitura.area,
            p_relatorio: definicao.id,
            p_pagina: 1,
            p_por_pagina: null,
          }),
        );
        if (resposta.error) throw resposta.error;
        const { linhas } = lerPaginaDoRelatorio(definicao, resposta.data);
        const { fontes } = lerFontesDoRelatorio(resposta.data);
        const quando = agora();
        const nome = nomeDoArquivoDoRelatorio(
          definicao,
          leitura.area,
          formato,
          quando,
        );
        const conteudo: BlobPart =
          formato === "CSV"
            ? csvDoRelatorio(definicao, linhas)
            : (xlsxDoRelatorio(
                definicao,
                linhas,
                await zipar(),
                quando,
                Object.keys(fontes).length ? fontes : undefined,
              ) as Uint8Array<ArrayBuffer>);
        salvar(
          new Blob([conteudo], { type: MIME_DO_RELATORIO[formato] }),
          nome,
        );
        mudar({ baixando: null });
      } catch (error) {
        console.warn("Falha ao gerar o arquivo do relatório:", error);
        mudar({
          baixando: null,
          erroNoDownload: "Não foi possível gerar o arquivo. Tente de novo.",
        });
      }
    },
  };
}

export type EstadoDaTelaDePaineis = ReturnType<typeof criarEstadoDosPaineis>;
