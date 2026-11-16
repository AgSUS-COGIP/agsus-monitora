import {
  MIME_DO_RELATORIO,
  RELATORIOS_DOS_PAINEIS,
  csvDoRelatorio,
  definicaoDoRelatorio,
  geradoEmDoRelatorio,
  linhasDoRelatorio,
  nomeDoArquivoDoRelatorio,
  xlsxDoRelatorio,
} from "../../lib/relatorios-dos-paineis.ts";
import {
  RPC_LISTAR_FONTES_DO_PAINEL,
  RPC_SALVAR_FONTE_DA_COLUNA,
  lerFontesDoPainel,
  lerFontesDoRelatorio,
} from "../../lib/fontes-dos-paineis.ts";
import type {
  FonteDaColuna,
  FontesDoPainel,
} from "../../lib/fontes-dos-paineis.ts";
import type {
  DefinicaoDoRelatorio,
  FormatoDoRelatorio,
  IdDoRelatorio,
  LinhaDoRelatorio,
  ZiparRelatorio,
} from "../../lib/relatorios-dos-paineis.ts";

/*
  O estado da tela de Painéis (sem React): o relatório escolhido e, para cada
  um, a leitura da área (`carregando`, `pronto` ou `erro`). Cada relatório é
  lido na primeira vez que aparece na área. "Sincronizar" (no topo da página)
  relê o aberto e marca os outros para relerem quando aparecerem. O download
  sai do que está na tela (as mesmas linhas), em CSV ou XLSX.
*/

export type SituacaoDoRelatorio = "vazio" | "carregando" | "pronto" | "erro";

export interface LeituraDoRelatorio {
  situacao: SituacaoDoRelatorio;
  area: string;
  linhas: readonly LinhaDoRelatorio[];
  geradoEm: string | null;
  erro: string;
  /** A origem de cada coluna editável (a resposta do relatório). */
  fontes: Readonly<Record<string, FonteDaColuna>>;
  avisos: readonly string[];
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
}

type RespostaDaRpc = PromiseLike<{ data: unknown; error: unknown }>;

/** O que a tela usa do cliente do Supabase: as três leituras e o editor de fontes. */
export interface ClienteDosPaineis {
  rpc(
    nome: DefinicaoDoRelatorio["rpc"],
    parametros: { p_area: string },
  ): RespostaDaRpc;
  rpc(
    nome: typeof RPC_LISTAR_FONTES_DO_PAINEL,
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

const LEITURA_VAZIA: LeituraDoRelatorio = Object.freeze({
  situacao: "vazio",
  area: "",
  linhas: Object.freeze([]),
  geradoEm: null,
  erro: "",
  fontes: Object.freeze({}),
  avisos: Object.freeze([]),
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
  };
  const ouvintes = new Set<() => void>();
  // A leitura em curso de cada relatório: a resposta de uma área antiga não sobrescreve a nova.
  const pedidos = new Map<IdDoRelatorio, number>();
  let numeroDoPedido = 0;

  function mudar(parcial: Partial<EstadoDosPaineis>) {
    estado = { ...estado, ...parcial };
    for (const ouvinte of ouvintes) ouvinte();
  }

  function mudarRelatorio(id: IdDoRelatorio, leitura: LeituraDoRelatorio) {
    mudar({ relatorios: { ...estado.relatorios, [id]: leitura } });
  }

  async function ler(id: IdDoRelatorio, area: string) {
    const definicao = definicaoDoRelatorio(id);
    const pedido = ++numeroDoPedido;
    pedidos.set(id, pedido);
    mudarRelatorio(id, {
      ...estado.relatorios[id],
      situacao: "carregando",
      area,
      erro: "",
    });
    let resposta: { data?: unknown; error?: unknown };
    try {
      if (!supabase) throw new Error("Sem conexão com o banco.");
      resposta = await supabase.rpc(definicao.rpc, { p_area: area });
    } catch (error) {
      resposta = { data: null, error };
    }
    if (pedidos.get(id) !== pedido) return;
    if (resposta.error) {
      mudarRelatorio(id, {
        situacao: "erro",
        area,
        linhas: Object.freeze([]),
        geradoEm: null,
        erro: mensagemDaFalha(resposta.error),
        fontes: Object.freeze({}),
        avisos: Object.freeze([]),
      });
      return;
    }
    const { fontes, avisos } = lerFontesDoRelatorio(resposta.data);
    mudarRelatorio(id, {
      situacao: "pronto",
      area,
      linhas: Object.freeze(linhasDoRelatorio(definicao, resposta.data)),
      geradoEm: geradoEmDoRelatorio(resposta.data),
      erro: "",
      fontes,
      avisos,
    });
  }

  /* O relatório ativo da área, se ainda não foi lido nela (ou se `forcar`). */
  function garantir(forcar = false) {
    const { area, ativo } = estado;
    if (!area) return Promise.resolve();
    const leitura = estado.relatorios[ativo];
    if (!forcar && leitura.area === area && leitura.situacao !== "vazio")
      return Promise.resolve();
    return ler(ativo, area);
  }

  /** Relê o relatório aberto; os outros releem quando forem abertos. */
  function sincronizar() {
    mudar({
      relatorios: Object.fromEntries(
        RELATORIOS_DOS_PAINEIS.map((r) => [
          r.id,
          r.id === estado.ativo ? estado.relatorios[r.id] : LEITURA_VAZIA,
        ]),
      ) as Record<IdDoRelatorio, LeituraDoRelatorio>,
    });
    return garantir(true);
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
    sincronizar,
    /** Abre a gaveta "Fontes dos dados" do relatório aberto, na área do menu. */
    async abrirFontes() {
      const { area, ativo } = estado;
      if (!area) return;
      mudar({
        gaveta: { ...GAVETA_FECHADA, aberta: true, situacao: "carregando" },
      });
      let resposta: { data?: unknown; error?: unknown };
      try {
        if (!supabase) throw new Error("Sem conexão com o banco.");
        resposta = await supabase.rpc(RPC_LISTAR_FONTES_DO_PAINEL, {
          p_area: area,
          p_relatorio: ativo,
        });
      } catch (error) {
        resposta = { data: null, error };
      }
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
     * Troca a fonte de uma coluna (ou volta ao padrão). Deu certo: a gaveta
     * mostra o estado novo e o relatório aberto é relido.
     */
    async salvarFonte(troca: TrocaPedida): Promise<boolean> {
      const { area, ativo } = estado;
      if (!area || estado.gaveta.salvando) return false;
      mudar({
        gaveta: { ...estado.gaveta, salvando: troca.coluna, erroAoSalvar: "" },
      });
      let resposta: { data?: unknown; error?: unknown };
      try {
        if (!supabase) throw new Error("Sem conexão com o banco.");
        resposta = await supabase.rpc(RPC_SALVAR_FONTE_DA_COLUNA, {
          p_area: area,
          p_relatorio: ativo,
          p_coluna: troca.coluna,
          p_visao: troca.visao,
          p_coluna_visao: troca.visao ? troca.colunaDaVisao : null,
          p_motivo: troca.motivo.trim(),
        });
      } catch (error) {
        resposta = { data: null, error };
      }
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
      await sincronizar();
      return true;
    },
    async baixar(formato: FormatoDoRelatorio) {
      const definicao = definicaoDoRelatorio(estado.ativo);
      const leitura = estado.relatorios[definicao.id];
      if (estado.baixando || leitura.situacao !== "pronto") return;
      mudar({ baixando: formato, erroNoDownload: "" });
      try {
        const quando = agora();
        const nome = nomeDoArquivoDoRelatorio(
          definicao,
          leitura.area,
          formato,
          quando,
        );
        const conteudo: BlobPart =
          formato === "CSV"
            ? csvDoRelatorio(definicao, leitura.linhas)
            : (xlsxDoRelatorio(
                definicao,
                leitura.linhas,
                await zipar(),
                quando,
                Object.keys(leitura.fontes).length ? leitura.fontes : undefined,
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
