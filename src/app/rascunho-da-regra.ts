/*
  O rascunho de uma regra guardado a cada mudança (por edital e por pessoa),
  fora do React: a tela lê com useSyncExternalStore (usar-rascunho-da-regra.ts).
  Um estado por tela: ANALISE na Avaliação documental (assistente e modo
  avançado), CLASSIFICACAO no editor da regra de classificação.

  RPCs (supabase/migrations/20261013120000_rascunho_das_regras.sql; contrato em
  src/lib/rpc-contrato.js):
    obter_rascunho_regra(p_tipo, p_edital)
    salvar_rascunho_regra(p_tipo, p_edital, p_conteudo, p_versao_base)
    descartar_rascunho_regra(p_tipo, p_edital)

  Ciclo:
    abrir      lê o rascunho do banco e a cópia deste computador; havendo um,
               a tela pergunta "Continuar de onde parei" ou "Descartar" (o da
               própria sessão, na mesma versão, volta sem perguntar: trocar de
               aba não pergunta nada);
    mudar      cada mudança agenda a gravação (ATRASO_MS); sem alteração em
               relação à vigente, agenda apagar o que estiver guardado;
    banco fora gravação falha → cópia neste computador (localStorage), e o
               banco recebe quando a conexão volta ou na próxima mudança;
    esquecer   versão nova salva: apaga já (antes de a tela remontar);
    fechar     a tela saiu: grava já o que estava agendado.
  A guarda do app (guarda-de-alteracoes.ts) pede confirmação no F5 com
  alteração e segura a versão nova do sistema enquanto houver gravação por
  fazer.
*/
import { comTempoLimite, ehFalhaDeConexao } from "../lib/falha-de-rede.js";
import {
  chaveDoRascunhoLocal,
  escolherRascunho,
  rascunhoDoBanco,
  rascunhoDoLocal,
  rascunhoParaLocal,
  type GravacaoDoRascunho,
  type RascunhoGuardado,
  type TipoDeRegra,
} from "../lib/rascunho-da-regra.ts";
import {
  guardaDeAlteracoes,
  type GuardaDeAlteracoes,
} from "./guarda-de-alteracoes.ts";

export const ATRASO_MS = 1000;
const TEMPO_LIMITE_MS = 15000;

const RPC_OBTER = "obter_rascunho_regra";
const RPC_SALVAR = "salvar_rascunho_regra";
const RPC_DESCARTAR = "descartar_rascunho_regra";

export type Conteudo = Record<string, unknown>;

export type EstadoDoRascunho = {
  editalId: string;
  /**
   * fechado: nenhuma regra aberta; carregando: lendo o guardado; decidir: há
   * rascunho guardado e a tela pergunta; editando: as mudanças vão sendo guardadas.
   */
  fase: "fechado" | "carregando" | "decidir" | "editando";
  /** O rascunho guardado, enquanto a tela pergunta (fase "decidir"). */
  guardado: RascunhoGuardado | null;
  /** O guardado é desta sessão, na mesma versão: a tela retoma sem perguntar. */
  retomarSemPerguntar: boolean;
  gravacao: GravacaoDoRascunho;
  guardadoEm: string | null;
};

type Rpc = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;
type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Janela = Pick<Window, "addEventListener">;

type Pendente =
  | {
      tipo: "salvar";
      editalId: string;
      conteudo: Conteudo;
      versaoBase: number;
    }
  | { tipo: "apagar"; editalId: string };

const INICIAL: EstadoDoRascunho = Object.freeze({
  editalId: "",
  fase: "fechado",
  guardado: null,
  retomarSemPerguntar: false,
  gravacao: "ocioso",
  guardadoEm: null,
}) as EstadoDoRascunho;

type Supabase = {
  // Método (não propriedade): aceita o cliente tipado das telas, de RPCs nomeadas.
  rpc(
    nome: string,
    argumentos: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
  /** Lido só pelo getSession (quem é a pessoa, para a cópia local). */
  auth?: object;
};

type ComSessao = {
  getSession: () => Promise<{
    data?: { session?: { user?: { id?: string } | null } | null };
  }>;
};
const temSessao = (auth: unknown): auth is ComSessao =>
  typeof (auth as Partial<ComSessao> | undefined)?.getSession === "function";

export type OpcoesDoRascunho = {
  tipo: TipoDeRegra;
  supabase?: Supabase | null;
  rpc?: Rpc;
  usuario?: () => Promise<string | null>;
  armazenamento?: () => Armazenamento | null | undefined;
  agendar?: (fn: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
  atrasoMs?: number;
  agora?: () => Date;
  guarda?: GuardaDeAlteracoes;
  janela?: Janela | null;
};

export function criarRascunhoDaRegra({
  tipo,
  supabase = null,
  rpc: rpcInjetada,
  usuario: usuarioInjetado,
  armazenamento = () => globalThis.localStorage,
  agendar = (fn, ms) => setTimeout(fn, ms),
  cancelar = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  atrasoMs = ATRASO_MS,
  agora = () => new Date(),
  guarda = guardaDeAlteracoes,
  janela = (globalThis.window as Janela | undefined) ?? null,
}: OpcoesDoRascunho) {
  let estado: EstadoDoRascunho = INICIAL;
  const ouvintes = new Set<() => void>();
  let pedido = 0;
  let usuarioAtual: string | null = null;
  let versaoBase = 0;
  let temAlteracoes = false;
  /* Há algo guardado (banco ou cópia local) para este edital. */
  let armazenado = false;
  let pendente: Pendente | null = null;
  let temporizador: unknown = null;
  let envio: Promise<void> | null = null;
  /* Gravação que falhou e espera a conexão (já está na cópia local). */
  let reenviar: Pendente | null = null;
  /* Apagamentos em curso, por edital: abrir espera (a leitura não traz o apagado). */
  const apagando = new Map<string, Promise<void>>();
  /* O último rascunho desta sessão por edital: trocar de aba volta sem perguntar. */
  const daSessao = new Map<
    string,
    { conteudo: Conteudo; versaoBase: number }
  >();

  const rpc: Rpc =
    rpcInjetada ??
    (async (nome, argumentos) => {
      if (!supabase) throw new Error("Sem conexão com o banco.");
      const { data, error } = (await comTempoLimite(
        supabase.rpc(nome, argumentos),
        TEMPO_LIMITE_MS,
      )) as { data: unknown; error: unknown };
      if (error) throw error;
      return data;
    });

  const usuario =
    usuarioInjetado ??
    (async () => {
      const auth = supabase?.auth;
      if (!temSessao(auth)) return null;
      const r = await auth.getSession();
      return r?.data?.session?.user?.id ?? null;
    });

  function publicar(mudancas: Partial<EstadoDoRascunho>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  // ── Cópia neste computador ─────────────────────────────────────────────

  function chave(editalId: string) {
    return usuarioAtual
      ? chaveDoRascunhoLocal(tipo, editalId, usuarioAtual)
      : null;
  }
  function lerLocal(editalId: string): RascunhoGuardado | null {
    const k = chave(editalId);
    if (!k) return null;
    try {
      return rascunhoDoLocal(armazenamento()?.getItem(k) ?? null);
    } catch {
      return null;
    }
  }
  function gravarLocal(editalId: string, conteudo: Conteudo, base: number) {
    const k = chave(editalId);
    if (!k) return false;
    try {
      armazenamento()?.setItem(
        k,
        rascunhoParaLocal({
          conteudo,
          versaoBase: base,
          atualizadoEm: agora().toISOString(),
          local: true,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
  function apagarLocal(editalId: string) {
    const k = chave(editalId);
    if (!k) return;
    try {
      armazenamento()?.removeItem(k);
    } catch {
      // Sem armazenamento (modo privado): nada a apagar.
    }
  }

  // ── Gravação ───────────────────────────────────────────────────────────

  function pararTemporizador() {
    if (temporizador !== null) cancelar(temporizador);
    temporizador = null;
  }

  function agendarEnvio() {
    pararTemporizador();
    temporizador = agendar(() => {
      temporizador = null;
      void enviar();
    }, atrasoMs);
  }

  async function enviarUm(p: Pendente) {
    const { editalId } = p;
    const aberto = () => estado.editalId === editalId;
    if (p.tipo === "salvar") {
      publicar({ gravacao: "guardando" });
      try {
        const r = (await rpc(RPC_SALVAR, {
          p_tipo: tipo,
          p_edital: editalId,
          p_conteudo: p.conteudo,
          p_versao_base: p.versaoBase,
        })) as { atualizado_em?: string } | null;
        if (aberto()) armazenado = true;
        apagarLocal(editalId);
        if (aberto())
          publicar({
            gravacao: "guardado",
            guardadoEm: r?.atualizado_em ?? agora().toISOString(),
          });
      } catch (erro) {
        const guardou = gravarLocal(editalId, p.conteudo, p.versaoBase);
        if (aberto()) armazenado = armazenado || guardou;
        if (!pendente && aberto()) reenviar = p;
        if (aberto())
          publicar({
            gravacao: guardou
              ? ehFalhaDeConexao(erro)
                ? "local"
                : "neste-computador"
              : "falhou",
            guardadoEm: guardou ? agora().toISOString() : estado.guardadoEm,
          });
      }
      return;
    }
    apagarLocal(editalId);
    try {
      await rpc(RPC_DESCARTAR, { p_tipo: tipo, p_edital: editalId });
      if (aberto()) armazenado = false;
    } catch {
      if (!pendente && aberto()) reenviar = p;
    }
    if (aberto()) publicar({ gravacao: "ocioso", guardadoEm: null });
  }

  /*
    Envia já o que estiver pendente. Os envios vão em fila (um por vez, na
    ordem): o pendente sai da espera na hora, então abrir outro edital no meio
    não o perde nem o manda para o edital errado.
  */
  function enviar(): Promise<void> {
    pararTemporizador();
    const p = pendente;
    pendente = null;
    if (!p) return envio ?? Promise.resolve();
    reenviar = null;
    const anterior = envio;
    const atual: Promise<void> = (async () => {
      if (anterior) await anterior.catch(() => {});
      await enviarUm(p);
    })();
    envio = atual;
    void atual.finally(() => {
      if (envio === atual) envio = null;
    });
    return atual;
  }

  janela?.addEventListener("online", () => {
    if (!reenviar || pendente || temporizador !== null) return;
    pendente = reenviar;
    reenviar = null;
    void enviar();
  });

  /* Apaga já o guardado do edital (banco e cópia local); abrir espera. */
  function apagarGuardado(editalId: string) {
    daSessao.delete(editalId);
    apagarLocal(editalId);
    const emCurso = envio;
    const promessa = (async () => {
      if (emCurso) await emCurso.catch(() => {});
      try {
        await rpc(RPC_DESCARTAR, { p_tipo: tipo, p_edital: editalId });
      } catch {
        // Sem conexão: o do banco fica; ao abrir de novo, a tela pergunta.
      }
    })();
    const fim = promessa.finally(() => {
      if (apagando.get(editalId) === fim) apagando.delete(editalId);
    });
    apagando.set(editalId, fim);
    return fim;
  }

  function limparEdicao() {
    pararTemporizador();
    pendente = null;
    reenviar = null;
    temAlteracoes = false;
    armazenado = false;
  }

  guarda.registrar({
    comAlteracoes: () => estado.fase === "editando" && temAlteracoes,
    naoGuardado: () => temporizador !== null || envio !== null,
    guardarAgora() {
      // F5 ou fechar com gravação por fazer: a cópia local agora, sem rede.
      const editalId = estado.editalId;
      if (!editalId || !temAlteracoes) return;
      const ultimo = daSessao.get(editalId);
      if (ultimo && (temporizador !== null || envio !== null))
        gravarLocal(editalId, ultimo.conteudo, ultimo.versaoBase);
    },
  });

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },

    /** Abre a regra do edital (versão vigente; 0 = sem regra). */
    async abrir(editalId: string, versaoVigente: number) {
      const meu = ++pedido;
      limparEdicao();
      versaoBase = versaoVigente;
      publicar({
        ...INICIAL,
        editalId,
        fase: "carregando",
      });
      await apagando.get(editalId);
      while (envio) await envio.catch(() => {});
      try {
        usuarioAtual = (await usuario()) ?? usuarioAtual;
      } catch {
        // Sem sessão legível: segue sem a cópia local.
      }
      let doBanco: RascunhoGuardado | null = null;
      try {
        doBanco = rascunhoDoBanco(
          await rpc(RPC_OBTER, { p_tipo: tipo, p_edital: editalId }),
        );
      } catch {
        // Banco fora (ou RPC ainda não publicada): vale a cópia local.
      }
      if (meu !== pedido) return;
      const sessao = daSessao.get(editalId);
      // Sem banco e sem cópia local, o desta sessão ainda está na memória.
      const guardado =
        escolherRascunho(doBanco, lerLocal(editalId)) ??
        (sessao
          ? {
              conteudo: sessao.conteudo,
              versaoBase: sessao.versaoBase,
              atualizadoEm: agora().toISOString(),
              local: true,
            }
          : null);
      armazenado = Boolean(guardado || doBanco);
      if (!guardado) {
        publicar({ fase: "editando" });
        return;
      }
      publicar({
        fase: "decidir",
        guardado,
        retomarSemPerguntar: Boolean(
          sessao &&
          sessao.versaoBase === versaoVigente &&
          guardado.versaoBase === versaoVigente,
        ),
      });
    },

    /**
     * "Continuar de onde parei": devolve o conteúdo para a tela aplicar. O
     * rascunho passa a valer sobre a versão vigente (a pessoa viu o aviso).
     */
    continuar(): Conteudo | null {
      const { guardado, editalId } = estado;
      if (estado.fase !== "decidir" || !guardado) return null;
      temAlteracoes = true;
      daSessao.set(editalId, {
        conteudo: guardado.conteudo,
        versaoBase,
      });
      // Regrava já com a versão vigente como base (e sobe a cópia local, se era só daqui).
      pendente = {
        tipo: "salvar",
        editalId,
        conteudo: guardado.conteudo,
        versaoBase,
      };
      agendarEnvio();
      publicar({
        fase: "editando",
        guardado: null,
        retomarSemPerguntar: false,
        gravacao: guardado.local ? "local" : "guardado",
        guardadoEm: guardado.atualizadoEm,
      });
      return guardado.conteudo;
    },

    /** "Descartar": apaga o guardado e segue na versão vigente. */
    descartar() {
      const { editalId } = estado;
      if (!editalId) return Promise.resolve();
      limparEdicao();
      publicar({
        fase: "editando",
        guardado: null,
        retomarSemPerguntar: false,
        gravacao: "ocioso",
        guardadoEm: null,
      });
      return apagarGuardado(editalId);
    },

    /**
     * A tela mudou o rascunho. `comAlteracoes` = difere da versão vigente;
     * sem alteração, o guardado (se houver) é apagado.
     */
    mudar(conteudo: Conteudo, comAlteracoes: boolean) {
      if (estado.fase !== "editando") return;
      const { editalId } = estado;
      temAlteracoes = comAlteracoes;
      if (comAlteracoes) {
        daSessao.set(editalId, { conteudo, versaoBase });
        pendente = { tipo: "salvar", editalId, conteudo, versaoBase };
      } else {
        daSessao.delete(editalId);
        if (!armazenado && !reenviar && !envio) {
          pararTemporizador();
          pendente = null;
          return;
        }
        pendente = { tipo: "apagar", editalId };
      }
      agendarEnvio();
    },

    /** Versão nova salva: o rascunho deste edital acabou (antes de a tela remontar). */
    esquecer(editalId: string) {
      if (estado.editalId === editalId) {
        limparEdicao();
        publicar({ gravacao: "ocioso", guardadoEm: null });
      }
      return apagarGuardado(editalId);
    },

    /** A tela saiu (troca de aba, de edital ou remontagem): grava já o agendado. */
    fechar(editalId: string) {
      if (estado.editalId !== editalId) return;
      if (temporizador !== null) void enviar();
      pedido += 1;
      pararTemporizador();
      publicar({ fase: "fechado", guardado: null, retomarSemPerguntar: false });
    },

    /** Há gravação agendada ou em curso (recarregar agora perderia a última mudança). */
    naoGuardado: () => temporizador !== null || envio !== null,
    /** A regra aberta tem alterações ainda não salvas como versão. */
    comAlteracoes: () => estado.fase === "editando" && temAlteracoes,
  };
}

export type RascunhoDaRegra = ReturnType<typeof criarRascunhoDaRegra>;
