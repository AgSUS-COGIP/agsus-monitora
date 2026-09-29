/*
  Estado do painel de entrevistas (`entrevistas.html`), fora do React: o que o
  banco devolve para a área do painel (`?area=`), a entrevista aberta na
  gaveta e a lista dos aprovados sem entrevista aberta. Os componentes leem com
  `useSyncExternalStore`. Este arquivo não importa React.

  Nesta fase o painel só lê: uma RPC, `get_entrevistas_da_area` (json), que
  confere permissão (recurso `entrevistas` >= leitor), área e o recorte da
  coordenação (supabase/migrations/20260929235000_entrevistas.sql).

  Cópia guardada ("stale-while-revalidate", src/lib/cache-de-payload.js, a
  mesma do painel de análises e da lista de aprovados): na primeira carga da
  área, a cópia do navegador (do mesmo usuário e da mesma publicação) aparece
  na hora e a versão nova é pedida por trás; a tela só redesenha se ela mudou.
  Acesso revogado (42501) ou área inválida apagam as cópias.

  Sem cópia, antes da primeira carga o painel é o skeleton (`carregado`
  falso); uma falha nela vira `erroAoCarregar`, com "Tentar novamente". Sem
  permissão (42501), `semAcesso`: a tela diz "Sem acesso às Entrevistas". Falha
  de rede usa a mensagem de src/lib/falha-de-rede.js.
*/
import {
  criarCacheDePayload,
  ehErroDeAcesso,
  revalidarPayload,
} from "../../lib/cache-de-payload.js";
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";
import {
  csvDasEntrevistas,
  normalizarPayload,
  PAINEL_DE_ENTREVISTAS,
  payloadMudou,
} from "../../lib/entrevistas-do-painel.js";
import { armazenamentoDePayload } from "../../modules/cache-de-payload-indexeddb.js";

export const MENSAGEM_SEM_SESSAO =
  "Sessão não localizada. Abra este painel pelo menu do MONITORA para compartilhar a sessão do Supabase Auth.";
export const MENSAGEM_SEM_ACESSO = "Sem acesso às Entrevistas";

/* A cópia vale só para a mesma publicação do front (o endereço do módulo muda a cada build). */
const VERSAO_DA_COPIA = `1:${import.meta.url}`;
const TEMPO_LIMITE_MS = 30000;

const ESTADO_INICIAL = Object.freeze({
  area: "",
  dados: null,
  carregado: false,
  erroAoCarregar: "",
  semSessao: false,
  semAcesso: false,
  atualizando: false,
  /** Os dados na tela vieram da cópia do navegador (ainda revalidando). */
  daCopia: false,
  carregadoEm: 0,
  /** id da entrevista aberta na gaveta, ou `null`. */
  gaveta: null,
  /** Gaveta dos aprovados na análise sem entrevista aberta. */
  semEntrevistaAberta: false,
});

function mensagemDaCarga(erro) {
  if (erro?.code === "PGRST202")
    return "A aba Entrevistas ainda não foi publicada no banco.";
  if (erro?.code === "42501")
    return "Seu acesso não inclui as entrevistas desta área.";
  return mensagemDeFalha(erro);
}

function baixarNoNavegador(conteudo, nome) {
  const arquivo = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function criarEstadoDasEntrevistas({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  baixar = baixarNoNavegador,
  armazenamento = armazenamentoDePayload,
  agora = () => Date.now(),
  tempoLimiteMs = TEMPO_LIMITE_MS,
} = {}) {
  let estado = ESTADO_INICIAL;
  let pedido = 0;
  const ouvintes = new Set();
  const copias = criarCacheDePayload({
    armazenamento,
    versao: VERSAO_DA_COPIA,
    tipo: PAINEL_DE_ENTREVISTAS,
  });

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  const mostrar = (payload, extra = {}) =>
    publicar({
      dados: normalizarPayload(payload || {}),
      carregado: true,
      semAcesso: false,
      erroAoCarregar: "",
      atualizando: false,
      daCopia: false,
      carregadoEm: agora(),
      ...extra,
    });

  const perderAcesso = (erro) =>
    publicar({
      ...ESTADO_INICIAL,
      area: estado.area,
      semAcesso: erro?.code === "42501",
      erroAoCarregar: mensagemDaCarga(erro),
    });

  /* O payload da área; lança o erro do banco (ou o de rede/tempo). */
  async function buscar(area) {
    const { data, error } = await comTempoLimite(
      supabase.rpc("get_entrevistas_da_area", { p_area: area }),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data || {};
  }

  /* O id do usuário da sessão; `null` sem sessão. Lança em falha de rede. */
  async function usuarioDaSessao() {
    if (!supabase.auth?.getSession) return "";
    const { data: sessao } = await comTempoLimite(
      supabase.auth.getSession(),
      tempoLimiteMs,
    );
    if (!sessao?.session) return null;
    return String(sessao.session.user?.id ?? "");
  }

  /*
    Troca de área descarta o que era da outra (skeleton de novo, ou a cópia);
    na mesma área, a tela fica e a releitura corre por trás. Resposta de um
    pedido antigo é ignorada.
  */
  async function carregar(area = estado.area) {
    if (!area) return false;
    const meu = ++pedido;
    const primeira = area !== estado.area || !estado.carregado;
    if (area !== estado.area) publicar({ ...ESTADO_INICIAL, area });
    else publicar({ atualizando: true, erroAoCarregar: "" });
    if (!supabase) {
      publicar({
        erroAoCarregar: "Sem conexão com o banco.",
        atualizando: false,
      });
      return false;
    }
    try {
      const usuarioId = await usuarioDaSessao();
      if (meu !== pedido) return false;
      if (usuarioId === null) {
        publicar({
          erroAoCarregar: MENSAGEM_SEM_SESSAO,
          semSessao: true,
          atualizando: false,
        });
        return false;
      }
      const contexto = { usuarioId, area };

      const guardado = primeira ? await copias.ler(contexto) : null;
      if (meu !== pedido) return false;
      if (guardado) {
        mostrar(guardado, { atualizando: true, daCopia: true });
        const novo = await revalidarPayload({
          guardado,
          buscar: () => buscar(area),
          guardar: (payload) => copias.guardar(contexto, payload),
          mudou: payloadMudou,
          aoMudar: (payload) => {
            if (meu === pedido) mostrar(payload);
          },
          aoPerderAcesso: (erro) => {
            if (meu === pedido) perderAcesso(erro);
          },
          apagarTudo: () => copias.apagarTudo(),
        });
        if (meu === pedido && estado.carregado)
          publicar({ atualizando: false, daCopia: false });
        if (!novo && meu === pedido && estado.carregado)
          toast(
            "Mostrando a cópia guardada: não foi possível buscar as entrevistas mais recentes.",
            "warn",
          );
        return Boolean(novo);
      }

      const payload = await buscar(area);
      if (meu !== pedido) return false;
      mostrar(payload);
      void copias.guardar(contexto, payload);
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      if (ehErroDeAcesso(erro)) {
        await copias.apagarTudo();
        perderAcesso(erro);
        return false;
      }
      const mensagem = ehFalhaDeConexao(erro)
        ? mensagemDeFalha(erro)
        : mensagemDaCarga(erro);
      if (estado.carregado) {
        publicar({ atualizando: false });
        toast(
          `Não foi possível atualizar as entrevistas: ${mensagem}`,
          "error",
        );
      } else publicar({ erroAoCarregar: mensagem, atualizando: false });
      return false;
    }
  }

  const abrirGaveta = (id) =>
    publicar({ gaveta: id, semEntrevistaAberta: false });
  const fecharGaveta = () => publicar({ gaveta: null });
  const abrirSemEntrevista = () =>
    publicar({ semEntrevistaAberta: true, gaveta: null });
  const fecharSemEntrevista = () => publicar({ semEntrevistaAberta: false });

  function exportarCsv(entrevistas) {
    const dia = new Date(agora()).toISOString().slice(0, 10);
    baixar(
      csvDasEntrevistas(entrevistas),
      `entrevistas-${estado.area}-${dia}.csv`,
    );
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    abrirGaveta,
    fecharGaveta,
    abrirSemEntrevista,
    fecharSemEntrevista,
    exportarCsv,
  };
}
