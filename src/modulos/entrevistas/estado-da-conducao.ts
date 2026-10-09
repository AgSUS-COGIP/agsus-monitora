import type {
  DadosDaConfiguracaoDaEntrevista,
  DadosDoEdital,
  EstadoDaConducao,
  EstadoDaConducaoComAcoes,
  Resultado,
  TipoDaAcaoDaConducao,
} from "./tipos.ts";
import type { PayloadDasNotas } from "./tipos-da-ficha.ts";
import type { DadosDoRoteiroParaSalvar } from "../../lib/tipos-do-roteiro-de-entrevista.ts";
import type {
  OpcoesDoEstadoDaConducao,
  RpcDaConducao,
} from "./tipos-do-estado-da-conducao.ts";
import {
  objetoDaConducao,
  registrosDaConducao,
  roteirosDaConducao,
  ehRoteiroDaConducao,
  dadosDoEditalDaConducao,
  agendaDaConducao,
  codigoDaFalhaDaConducao,
} from "../../lib/dados-da-conducao.ts";
class RespostaObsoletaDaConducao extends Error {}
/*
  Estado das visões "Conduzir entrevistas" e "Roteiros" da tela de
  Entrevistas, fora do React (como estado.js, o da visão "Resultados"): os
  roteiros da área atual do app, os editais, o edital aberto (o payload de
  `obter_entrevistas_do_edital`) e as ações que escrevem no banco, uma por
  vez (`acao`). Os componentes leem com `useSyncExternalStore`. Este arquivo
  não importa React.

  As RPCs são as da migration 20260930220000_entrevistas_roteiros_e_notas.sql.
  Todas as de escrita do edital devolvem o payload atualizado, que substitui o
  da tela. Notas, convocação e desconvocação mudam o que a visão "Resultados"
  mostra (a mesma TB_ENTREVISTA): `aoMudarResultados` pede a releitura dela.

  A lista de editais vem de `listar_editais_entrevista` (migration
  20260930235000): só os editais na janela da entrevista pelo cronograma, os
  liberados pelo administrador global e os com convocado sem parecer. O
  administrador global pode pedir todos (`todos`) e liberar um edital fora
  da janela até uma data (`liberarEdital`).

  A agenda das entrevistas do edital (montada na Classificação › Agenda) vem
  junto ao abrir o edital, por `obter_agenda_entrevista` (migration
  20261005120000): só leitura aqui, para quem conduz ver a agenda do dia.
  Sem a migration ou sem acesso, `agenda` fica nula e a condução segue igual.

  A convocação é a lista CONVOCACAO da Classificação (migration
  20261005150000): `obter_entrevistas_do_edital` traz a lista vigente e
  `convocar` manda o id dela (`p_lista`). Sem lista gerada, `calculo` guarda o
  cálculo atual do motor (os mesmos dados da tela de Classificação), só para
  ver; sem acesso à Classificação, o erro.

  A área é a do app: `trocarArea` (chamado pelo controlador e na troca de
  área com a tela aberta) descarta o que era da outra. Outro usuário na mesma
  aba também zera tudo.
*/
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";
import {
  editaisParaConduzir,
  mensagemDoErroDaEntrevista,
} from "../../lib/conducao-de-entrevista.js";
import { classificarEdital } from "../../lib/classificacao/ajustes.js";
import { convocacaoDoEdital } from "../../lib/classificacao/convocacao-do-edital.js";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";

const TEMPO_LIMITE_MS = 30000;

/* As RPCs (src/lib/rpc-contrato.js); chamadas por `rpc()`, com tempo limite. */
const RPC_LISTAR_ROTEIROS = "listar_roteiros_entrevista";
const RPC_SALVAR_ROTEIRO = "salvar_roteiro_entrevista";
const RPC_RENOMEAR_ROTEIRO = "renomear_versao_roteiro_entrevista";
const RPC_OBTER_EDITAL = "obter_entrevistas_do_edital";
const RPC_CONFIGURAR = "configurar_entrevista_edital";
const RPC_CONVOCAR = "convocar_para_entrevista";
const RPC_DESCONVOCAR = "desconvocar_da_entrevista";
const RPC_LANCAR_NOTAS = "lancar_notas_entrevista";
const RPC_LISTAR_EDITAIS = "listar_editais_entrevista";
const RPC_LIBERAR_EDITAL = "liberar_entrevista_edital";
const RPC_OBTER_AGENDA = "obter_agenda_entrevista";
/* O cálculo atual da convocação, quando a Classificação ainda não gerou a lista. */
const RPC_OBTER_CLASSIFICACAO = "obter_classificacao_do_edital";
const RPC_CONFIGURACAO_CONVOCACAO = "listar_configuracao_convocacao";
const RPC_MODELOS_CONVOCACAO = "listar_modelos_convocacao";

const LISTA_VAZIA = Object.freeze({
  lista: [],
  carregando: false,
  carregado: false,
  erro: "",
});

const EDITAIS_VAZIOS = Object.freeze({
  ...LISTA_VAZIA,
  /** O administrador global vê o filtro "todos" e libera editais. */
  admin: false,
  todos: false,
});

const ESTADO_INICIAL: EstadoDaConducao = Object.freeze({
  area: "",
  roteiros: LISTA_VAZIA,
  editais: EDITAIS_VAZIOS,
  editalId: "",
  /** Payload de `obter_entrevistas_do_edital` do edital aberto. */
  edital: null,
  /** Payload de `obter_agenda_entrevista` do edital aberto (ou null). */
  agenda: null,
  /**
   * Sem lista de convocação gerada: `{ resultado }` (o motor, CONVOCACAO) ou
   * `{ erro }`; com lista, null.
   */
  calculo: null,
  carregandoEdital: false,
  erroDoEdital: "",
  /** `pode_editar` do último edital aberto (os roteiros não o devolvem). */
  podeEditar: null,
  /** `{ tipo, rotulo }` da gravação em curso, ou `null`. */
  acao: null,
  /** Convocado com a ficha de notas aberta (modo de análise, tela inteira). */
  fichaAberta: null,
});

export function mensagemDe(erro: unknown) {
  return ehFalhaDeConexao(erro)
    ? mensagemDeFalha(erro)
    : mensagemDoErroDaEntrevista(erro);
}

export function criarEstadoDaConducao({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  aoMudarResultados = () => {},
  tempoLimiteMs = TEMPO_LIMITE_MS,
}: OpcoesDoEstadoDaConducao = {}): EstadoDaConducaoComAcoes {
  let estado = ESTADO_INICIAL;
  let pedidoDoEdital = 0;
  /* Cada carga de lista leva um número; a troca de área ou de usuário também
     avança, para a resposta de uma carga antiga não cair sobre a tela nova. */
  let pedidoDosRoteiros = 0;
  let pedidoDosEditais = 0;
  let geracaoDaConducao = 0;
  const ouvintes = new Set<() => void>();

  function publicar(mudancas: Partial<EstadoDaConducao>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function rpc(
    nome: RpcDaConducao,
    argumentos?: Record<string, unknown>,
  ): Promise<unknown> {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const geracao = geracaoDaConducao;
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (geracao !== geracaoDaConducao)
      throw new RespostaObsoletaDaConducao(
        "A área ou sessão mudou. Repita a ação na tela atual.",
      );
    if (error) throw error;
    return data;
  }

  async function executar(
    tipo: TipoDaAcaoDaConducao,
    rotulo: string,
    fazer: () => Promise<Resultado>,
  ): Promise<Resultado> {
    if (estado.acao) return { erro: "Aguarde a gravação em curso." };
    const geracao = geracaoDaConducao;
    publicar({ acao: { tipo, rotulo } });
    try {
      const resultado = await fazer();
      return geracao === geracaoDaConducao
        ? resultado
        : { erro: "A área ou sessão mudou. Repita a ação na tela atual." };
    } catch (erro) {
      if (
        geracao !== geracaoDaConducao ||
        erro instanceof RespostaObsoletaDaConducao
      )
        return { erro: "A área ou sessão mudou. Repita a ação na tela atual." };
      const mensagem = mensagemDe(erro);
      if (codigoDaFalhaDaConducao(erro) === "42501" && tipo === "roteiro")
        publicar({ podeEditar: false });
      toast(mensagem, "error");
      return { erro: mensagem, codigo: codigoDaFalhaDaConducao(erro) || "" };
    } finally {
      if (geracao === geracaoDaConducao) publicar({ acao: null });
    }
  }

  function trocarArea(area: string) {
    if (area && area !== estado.area) {
      geracaoDaConducao += 1;
      pedidoDoEdital += 1;
      pedidoDosRoteiros += 1;
      pedidoDosEditais += 1;
      publicar({ ...ESTADO_INICIAL, area });
    }
  }

  let identidade: string | null | undefined;
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    // O primeiro aviso da página só registra quem é; não há o que limpar.
    if (identidade !== undefined || !atual) {
      geracaoDaConducao += 1;
      pedidoDoEdital += 1;
      pedidoDosRoteiros += 1;
      pedidoDosEditais += 1;
      publicar(ESTADO_INICIAL);
    }
    identidade = atual;
  });

  // ── Roteiros ────────────────────────────────────────────────────────

  async function carregarRoteiros(area = estado.area) {
    trocarArea(area);
    const meu = ++pedidoDosRoteiros;
    publicar({ roteiros: { ...estado.roteiros, carregando: true, erro: "" } });
    try {
      const lista = await rpc(RPC_LISTAR_ROTEIROS, { p_area: area });
      if (meu !== pedidoDosRoteiros) return false;
      publicar({
        roteiros: {
          lista: roteirosDaConducao(lista),
          carregando: false,
          carregado: true,
          erro: "",
        },
      });
      return true;
    } catch (erro) {
      if (meu !== pedidoDosRoteiros) return false;
      /* Carregado com o erro (como os editais): a tela mostra o aviso e não
         relê sozinha a cada desenho; Recarregar e Atualizar tentam de novo. */
      publicar({
        roteiros: {
          ...estado.roteiros,
          carregando: false,
          carregado: true,
          erro: mensagemDe(erro),
        },
      });
      return false;
    }
  }

  /** `{ ok, roteiro }` ou `{ erro }`. */
  function salvarRoteiro(dados: DadosDoRoteiroParaSalvar) {
    return executar("roteiro", "Salvando o roteiro…", async () => {
      const resposta = await rpc(RPC_SALVAR_ROTEIRO, {
        p_dados: dados,
      });
      const roteiro = ehRoteiroDaConducao(resposta) ? resposta : null;
      toast(
        dados.origem
          ? `Roteiro salvo: ${rotuloDaVersao({ versao: roteiro?.versao, nome: roteiro?.nome_versao })}.`
          : "Roteiro criado.",
        "ok",
      );
      publicar({ podeEditar: true });
      await carregarRoteiros();
      return { ok: true, roteiro };
    });
  }

  /** Troca só o nome de uma versão do roteiro (null tira o nome): `{ ok }` ou `{ erro }`. */
  function renomearRoteiro(
    roteiroId: string,
    nome: string | null,
    motivo: string,
  ) {
    return executar("roteiro", "Trocando o nome…", async () => {
      const resposta = await rpc(RPC_RENOMEAR_ROTEIRO, {
        p_roteiro: roteiroId,
        p_nome: nome || null,
        p_motivo: motivo,
      });
      const roteiro = ehRoteiroDaConducao(resposta) ? resposta : null;
      toast("Nome da versão trocado.", "ok");
      await carregarRoteiros();
      return { ok: true, roteiro };
    });
  }

  // ── Editais ─────────────────────────────────────────────────────────

  /** `doPainel`: as entrevistas da visão "Resultados" (com `edital_id`). */
  async function carregarEditais(
    area = estado.area,
    doPainel: unknown[] = [],
    { todos = estado.editais.todos } = {},
  ) {
    trocarArea(area);
    const meu = ++pedidoDosEditais;
    publicar({ editais: { ...estado.editais, carregando: true, erro: "" } });
    try {
      const dados = objetoDaConducao(
        await rpc(RPC_LISTAR_EDITAIS, {
          p_area: area,
          p_todos: Boolean(todos),
        }),
      );
      if (meu !== pedidoDosEditais) return [];
      const admin = dados?.admin_global === true;
      const lista = editaisParaConduzir(
        registrosDaConducao(dados?.editais).filter(
          (e) => typeof e.id === "string" && e.id.trim(),
        ),
        doPainel,
      );
      publicar({
        editais: {
          lista,
          carregando: false,
          carregado: true,
          admin,
          todos: admin && Boolean(todos),
          erro: lista.length ? "" : "Nenhum edital na janela da entrevista.",
        },
      });
      return lista;
    } catch (erro) {
      if (meu !== pedidoDosEditais) return [];
      publicar({
        editais: {
          ...EDITAIS_VAZIOS,
          carregado: true,
          erro: `Não foi possível carregar os editais: ${mensagemDe(erro)}`,
        },
      });
      return [];
    }
  }

  /** Administrador global: libera o edital até `ate` (ou encerra, com `ate` vazio). */
  function liberarEdital(
    id: string,
    ate: string | null,
    motivo: string,
    doPainel: unknown[] = [],
  ) {
    return executar("liberar", ate ? "Liberando…" : "Encerrando…", async () => {
      await rpc(RPC_LIBERAR_EDITAL, {
        p_edital: id,
        p_ate: ate || null,
        p_motivo: motivo,
      });
      toast(
        ate ? "Edital liberado para a equipe." : "Liberação encerrada.",
        "ok",
      );
      await carregarEditais(estado.area, doPainel);
      return { ok: true };
    });
  }

  function mostrarEdital(dados: DadosDoEdital | null) {
    publicar({
      edital: dados || null,
      carregandoEdital: false,
      erroDoEdital: "",
      podeEditar: Boolean(dados?.pode_editar),
    });
  }

  async function abrirEdital(id: string) {
    const meu = ++pedidoDoEdital;
    const mesmo = id && estado.edital?.edital?.id === id;
    publicar({
      editalId: id || "",
      edital: mesmo ? estado.edital : null,
      agenda: mesmo ? estado.agenda : null,
      calculo: mesmo ? estado.calculo : null,
      fichaAberta: mesmo ? estado.fichaAberta : null,
      carregandoEdital: Boolean(id),
      erroDoEdital: "",
    });
    if (!id) return false;
    try {
      const [resposta, agenda] = await Promise.all([
        rpc(RPC_OBTER_EDITAL, { p_edital: id }),
        rpc(RPC_OBTER_AGENDA, { p_edital: id }).catch(() => null),
      ]);
      if (meu !== pedidoDoEdital) return false;
      const dados = dadosDoEditalDaConducao(resposta);
      if (!dados)
        throw new Error("A resposta do edital de entrevistas é inválida.");
      const calculo = dados?.lista_convocacao
        ? null
        : await calcularConvocacao(id);
      if (meu !== pedidoDoEdital) return false;
      publicar({ agenda: agendaDaConducao(agenda), calculo });
      mostrarEdital(dados);
      return true;
    } catch (erro) {
      if (meu !== pedidoDoEdital) return false;
      publicar({ carregandoEdital: false, erroDoEdital: mensagemDe(erro) });
      return false;
    }
  }

  const recarregarEdital = () => abrirEdital(estado.editalId);

  /*
    Sem lista gerada: a convocação como a Classificação a calcula agora (mesmo
    motor, mesma regra, mesmas vagas). Sem a configuração da convocação do
    edital, segue com a regra, como na Classificação.
  */
  async function calcularConvocacao(
    id: string,
  ): Promise<NonNullable<EstadoDaConducao["calculo"]>> {
    try {
      const [resposta, configuracoes, modelos] = await Promise.all([
        rpc(RPC_OBTER_CLASSIFICACAO, { p_edital: id }),
        rpc(RPC_CONFIGURACAO_CONVOCACAO).catch(() => null),
        rpc(RPC_MODELOS_CONVOCACAO).catch(() => null),
      ]);
      const dados = objetoDaConducao(resposta);
      if (!dados?.regra)
        return { erro: "O edital ainda não tem regra de classificação." };
      const convocacao =
        configuracoes && modelos
          ? convocacaoDoEdital({ configuracoes, modelos }, id)
          : null;
      return {
        resultado: classificarEdital({ ...dados, convocacao }, "CONVOCACAO"),
      };
    } catch (erro) {
      return {
        erro:
          codigoDaFalhaDaConducao(erro) === "42501"
            ? "Seu acesso não inclui a Classificação deste edital."
            : mensagemDe(erro),
      };
    }
  }

  /*
    Resposta de escrita: o payload novo entra na tela (se o edital é o mesmo)
    e vence a leitura que ainda estiver em curso, feita antes da gravação.
  */
  function aplicar(dados: unknown, editalId: string) {
    if (editalId !== estado.editalId) return;
    pedidoDoEdital += 1;
    mostrarEdital(dadosDoEditalDaConducao(dados));
  }

  function configurar(dados: DadosDaConfiguracaoDaEntrevista) {
    const editalId = estado.editalId;
    return executar("configurar", "Salvando a configuração…", async () => {
      const novo = await rpc(RPC_CONFIGURAR, {
        p_edital: editalId,
        p_dados: dados,
      });
      aplicar(novo, editalId);
      toast("Configuração da entrevista salva.", "ok");
      return { ok: true };
    });
  }

  /* Os da lista vigente da Classificação (o banco recusa quem está fora dela). */
  function convocar(analises: string[]) {
    const editalId = estado.editalId;
    const lista = estado.edital?.lista_convocacao?.lista?.id || null;
    return executar("convocar", "Convocando…", async () => {
      if (!lista)
        throw new Error(
          "Gere a lista de convocação na Classificação antes de convocar",
        );
      const resposta = objetoDaConducao(
        await rpc(RPC_CONVOCAR, {
          p_edital: editalId,
          p_lista: lista,
          p_analises: analises,
        }).catch((erro) => {
          // A Classificação gerou outra lista: a tela relê a vigente.
          if (codigoDaFalhaDaConducao(erro) === "40001")
            void abrirEdital(editalId);
          throw erro;
        }),
      );
      aplicar(resposta?.dados, editalId);
      const quantos = Number(resposta?.convocados) || 0;
      toast(
        `${quantos} ${quantos === 1 ? "candidato convocado" : "candidatos convocados"}.`,
        "ok",
      );
      aoMudarResultados();
      return { ok: true, convocados: quantos };
    });
  }

  function desconvocar(entrevista: string, motivo: string) {
    const editalId = estado.editalId;
    return executar("desconvocar", "Desconvocando…", async () => {
      const novo = await rpc(RPC_DESCONVOCAR, {
        p_entrevista: entrevista,
        p_motivo: motivo,
      });
      aplicar(novo, editalId);
      toast("Convocação retirada.", "ok");
      aoMudarResultados();
      return { ok: true };
    });
  }

  function lancarNotas(entrevista: string, dados: PayloadDasNotas) {
    const editalId = estado.editalId;
    return executar("notas", "Salvando as notas…", async () => {
      const novo = await rpc(RPC_LANCAR_NOTAS, {
        p_entrevista: entrevista,
        p_dados: dados,
      });
      aplicar(novo, editalId);
      toast("Notas salvas; o resultado foi recalculado.", "ok");
      aoMudarResultados();
      return { ok: true, dados: dadosDoEditalDaConducao(novo) };
    });
  }

  /** Abre (id do convocado) ou fecha (null) a ficha de notas. */
  function abrirFicha(id: string | null) {
    publicar({ fichaAberta: id || null });
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => void ouvintes.delete(ouvinte);
    },
    trocarArea,
    carregarRoteiros,
    salvarRoteiro,
    renomearRoteiro,
    carregarEditais,
    liberarEdital,
    abrirEdital,
    recarregarEdital,
    configurar,
    convocar,
    desconvocar,
    lancarNotas,
    abrirFicha,
  };
}
