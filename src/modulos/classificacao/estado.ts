import type {
  SnapshotDaClassificacao,
  OpcoesDoEstado,
  RpcDaClassificacao,
  RegistroDaClassificacao,
  DadosDaClassificacao,
  RegraDaClassificacao,
  ListaRegistrada,
  ResultadoDaClassificacao,
  OpcoesDoDocumento,
} from "./tipos-do-estado.ts";
import type { VinculoDaPublicacao } from "../../lib/tipos-da-publicacao-de-aprovados.ts";
import { candidatosDaListaFinal } from "../../lib/publicacao-de-aprovados.ts";
import {
  situacaoDaPublicacao,
  resultadoDaPublicacao,
} from "../../lib/dados-da-publicacao-de-aprovados.ts";
import {
  objeto,
  textoDaClassificacao,
  editaisDaClassificacao,
  dadosDaClassificacao,
  regraDaClassificacao,
  listaRegistrada,
  listaComRetrato,
  retratoDaClassificacao,
  desempateRegistrado,
} from "../../lib/classificacao/dados-do-estado.ts";
/*
  Estado da tela de Classificação (`#page-classificacao`), fora do React. Os
  componentes leem com `useSyncExternalStore`. Este arquivo não importa React.

  RPCs (supabase/migrations/20261002150000_classificacao.sql; contrato em
  src/lib/rpc-contrato.js):
    listar_editais_classificacao(p_area)     os editais da área atual
    obter_classificacao_do_edital_se_mudou(p_edital, p_versao)
                                             (20261014230000) regra, quadro,
                                             análises, entrevistas, listas e
                                             desempates, por versão: candidatos
                                             em colunas e, quando nada mudou, só
                                             { inalterado } (leitura-por-versao.ts;
                                             cópia no navegador). Banco sem ela:
    obter_classificacao_do_edital(p_edital)  o mesmo, inteiro, como antes
    salvar_regra_classificacao(...)          nova versão da regra
    registrar_lista_classificacao(...)       "Gerar": retrato + hash do banco
    pedir_calculo_classificacao(...)         "Gerar" com a chave "Gerar listas pelo
                                             Python" ligada (20261023200000): pede o
                                             cálculo ao job; desligada, { ligada: false }
    obter_calculo_classificacao(...)         o pedido (e, pronto, o retrato do Python)
    registrar_lista_calculada(...)           registra o retrato do Python, igual ao da tela
    registrar_divergencia_do_calculo(...)    os caminhos das diferenças (sem valores)
    publicar_lista_classificacao(p_lista)
    obter_lista_classificacao(p_lista)       retrato de uma geração anterior
    registrar_desempate_classificacao(...)   sorteio ou decisão manual
    obter_publicacao_lista_aprovados(...)    a lista de aprovados vigente do
                                             edital e os candidatos (prévia)
    publicar_lista_aprovados_da_classificacao(...)  o resultado final vira a
                                             lista de aprovados (migration
                                             20261005160000)
    listar_configuracao_convocacao()         a configuração de convocação
    listar_modelos_convocacao()              dos editais (Lista de aprovados):
                                             as vagas por modalidade saem da
                                             mesma conta (convocacao-do-edital.ts)
    salvar_hora_nascimento_candidato(...)    a hora da certidão para o
                                             desempate por maior idade
                                             (migration 20261009130000)

  A conta é do motor puro (src/lib/classificacao/motor.ts), feita no
  componente a partir de `dados`; aqui só a carga, a gravação e a exportação.
  Com a chave "Gerar listas pelo Python" ligada, a lista registrada é a que o
  Python calculou, e só quando ela é igual à do motor.ts (gerarLista;
  src/lib/classificacao/calculo-em-python.ts).

  Sessão: o cliente Supabase único do app. Outro usuário na mesma aba: tudo
  volta ao início.

  Documento oficial (SEI): o modelo sai de src/lib/classificacao/documento-sei.ts
  com os textos do edital (regra.documento); "Copiar para o SEI" leva HTML +
  texto à área de transferência; DOCX com papel timbrado
  (documento-docx.js); PDF = impressão da página "Como fica no SEI". O
  cabeçalho da agência vem de Configurações › Marca (`documento_cabecalho`).
*/
import { MIME_DOCX } from "../../lib/documento-da-resposta.ts";
import {
  gerarXlsx,
  gerarXlsxDaLista,
  instantaneoDaLista,
  MIME_XLSX,
  nomeDoArquivo,
} from "../../lib/classificacao/exportacao.ts";
import type { DesempateDaLista } from "../../lib/classificacao/relatorio-de-desempate.ts";
import type { PedidoDeCalculo } from "../../lib/classificacao/calculo-em-python.ts";
import {
  calculoLido,
  diferencasDosRetratos,
  esperaOJob,
  INTERVALO_DO_CALCULO_MS,
  PRAZO_DO_CALCULO_MS,
  respostaDoPedido,
  textoDoPedidoParado,
} from "../../lib/classificacao/calculo-em-python.ts";
import {
  lerRespostaDoDesempate,
  paginaDoDesempate,
  planilhasDoDesempate,
} from "../../lib/classificacao/relatorio-de-desempate.ts";
import {
  CABECALHO_PADRAO,
  documentoOficial,
  htmlParaSei,
  paginaDaPrevia,
  textoParaSei,
} from "../../lib/classificacao/documento-sei.ts";
import { gerarDocxOficial } from "../../lib/classificacao/documento-docx.ts";
import { ehEditalDeTreinamento } from "../../lib/edital-de-treinamento.ts";
import { LOGO_PADRAO_DA_BARRA } from "../../lib/marca-da-barra-lateral.ts";
import {
  copiarParaAreaDeTransferencia,
  imprimirPagina,
  logoEmPng,
} from "./documento-no-navegador.ts";
import { convocacaoDoEdital } from "../../lib/classificacao/convocacao-do-edital.ts";
import { normalizarRegra } from "../../lib/classificacao/regra.ts";
import { geracaoDesatualizada } from "../../lib/classificacao/dados.ts";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import { ehConflitoDeVersao } from "../../lib/conflito-de-versao.ts";
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede";
import { criarCopiasPorVersao } from "../../app/copias-por-versao.ts";
import { criarLeituraPorVersao } from "../../lib/avaliacao-documental/leitura-por-versao.ts";

/* As RPCs (src/lib/rpc-contrato.js); chamadas por `rpc()`, com tempo limite. */
const RPC_LISTAR_EDITAIS = "listar_editais_classificacao";
const RPC_OBTER_EDITAL = "obter_classificacao_do_edital";
const RPC_OBTER_EDITAL_SE_MUDOU = "obter_classificacao_do_edital_se_mudou";
const RPC_SALVAR_REGRA = "salvar_regra_classificacao";
const RPC_RENOMEAR_VERSAO = "renomear_versao_regra_classificacao";
const RPC_REGISTRAR_LISTA = "registrar_lista_classificacao";
const RPC_PUBLICAR_LISTA = "publicar_lista_classificacao";
const RPC_OBTER_LISTA = "obter_lista_classificacao";
const RPC_REGISTRAR_DESEMPATE = "registrar_desempate_classificacao";
const RPC_OBTER_PUBLICACAO = "obter_publicacao_lista_aprovados";
const RPC_PUBLICAR_APROVADOS = "publicar_lista_aprovados_da_classificacao";
const RPC_CONFIGURACAO_CONVOCACAO = "listar_configuracao_convocacao";
const RPC_MODELOS_CONVOCACAO = "listar_modelos_convocacao";
const RPC_SALVAR_HORA = "salvar_hora_nascimento_candidato";
const RPC_OBTER_DESEMPATE = "obter_desempate_da_lista";
const RPC_PEDIR_CALCULO = "pedir_calculo_classificacao";
const RPC_OBTER_CALCULO = "obter_calculo_classificacao";
const RPC_REGISTRAR_CALCULADA = "registrar_lista_calculada";
const RPC_DIVERGENCIA_DO_CALCULO = "registrar_divergencia_do_calculo";

export const MENSAGEM_SEM_ACESSO = "Sem acesso à Classificação";
const TEMPO_LIMITE_MS = 45000;

const ESTADO_INICIAL: Readonly<SnapshotDaClassificacao> = Object.freeze({
  area: "",
  editais: [],
  podeEditar: false,
  carregado: false,
  carregandoEditais: false,
  erroAoCarregar: "",
  semAcesso: false,
  editalId: "",
  dados: null,
  carregandoEdital: false,
  erroDoEdital: "",
  salvando: false,
  gerando: false,
  erroDaConvocacao: "",
  calculo: null,
});

function mensagemDoBanco(erro: unknown) {
  const e = objeto(erro);
  if (e.code === "PGRST202")
    return "A aba Classificação ainda não foi publicada no banco.";
  if (e.code === "42501")
    return "Seu acesso não inclui a classificação desta área ou deste edital.";
  if (ehConflitoDeVersao(e))
    return (
      textoDaClassificacao(e.message) ||
      "A regra mudou desde que você abriu; recarregue."
    );
  if (ehFalhaDeConexao(erro)) return mensagemDeFalha(erro);
  return textoDaClassificacao(e.message) || mensagemDeFalha(erro);
}

export function baixarNoNavegador(bytes: BlobPart, nome: string, tipo: string) {
  const arquivo = new Blob([bytes], { type: tipo });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function criarEstadoDaClassificacao({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  baixar = baixarNoNavegador,
  imprimir = imprimirPagina,
  copiar = copiarParaAreaDeTransferencia,
  carregarLogo = logoEmPng,
  cabecalho = () => CABECALHO_PADRAO,
  enderecoDoLogo = LOGO_PADRAO_DA_BARRA,
  tempoLimiteMs = TEMPO_LIMITE_MS,
  agendaDoEdital = () => null,
  aoGravarVersao = () => {},
  copias = criarCopiasPorVersao(supabase, RPC_OBTER_EDITAL_SE_MUDOU),
  intervaloDoCalculoMs = INTERVALO_DO_CALCULO_MS,
  prazoDoCalculoMs = PRAZO_DO_CALCULO_MS,
  agora = () => Date.now(),
}: OpcoesDoEstado = {}) {
  let estado: SnapshotDaClassificacao = ESTADO_INICIAL;
  const leituraDoEdital = criarLeituraPorVersao({
    nova: RPC_OBTER_EDITAL_SE_MUDOU,
    antiga: RPC_OBTER_EDITAL,
    copias,
  });
  let pedidoDosEditais = 0;
  let geracao = 0;
  let pedidoDoEdital = 0;
  /* A configuração e os modelos de convocação: uma leitura por sessão (o "Atualizar" relê). */
  let convocacoes: Promise<[unknown, unknown]> | null = null;
  const ouvintes = new Set<() => void>();

  function publicar(mudancas: Partial<SnapshotDaClassificacao>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  function reiniciar() {
    geracao += 1;
    convocacoes = null;
    pedidoDosEditais += 1;
    pedidoDoEdital += 1;
    leituraDoEdital.esquecer();
    publicar(ESTADO_INICIAL);
  }
  let identidade: string | null | undefined;
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    if (identidade !== undefined || !atual) reiniciar();
    identidade = atual;
  });

  async function rpc(
    nome: RpcDaClassificacao,
    argumentos?: RegistroDaClassificacao,
  ) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  /*
    Os editais da área. Troca de área recomeça do zero. `releitura` (o
    "Atualizar") relê também a configuração de convocação; o edital escolhido
    é relido uma vez só, aqui.
  */
  async function carregar(
    area = estado.area,
    { releitura = false }: { releitura?: boolean } = {},
  ) {
    if (!area) return false;
    if (releitura) convocacoes = null;
    const meu = ++pedidoDosEditais;
    if (area !== estado.area) {
      geracao += 1;
      pedidoDoEdital += 1;
      publicar({ ...ESTADO_INICIAL, area, carregandoEditais: true });
    } else publicar({ carregandoEditais: true, erroAoCarregar: "" });
    try {
      const dados = editaisDaClassificacao(
        await rpc(RPC_LISTAR_EDITAIS, { p_area: area }),
      );
      if (meu !== pedidoDosEditais) return false;
      const editais = Array.isArray(dados?.editais) ? dados.editais : [];
      const escolhido = editais.some((e) => e.id === estado.editalId)
        ? estado.editalId
        : "";
      publicar({
        editais,
        podeEditar: dados.pode_editar === true,
        carregado: true,
        carregandoEditais: false,
        semAcesso: false,
        erroAoCarregar: "",
        editalId: escolhido,
      });
      if (escolhido) void escolherEdital(escolhido);
      return true;
    } catch (erro) {
      if (meu !== pedidoDosEditais) return false;
      publicar({
        carregandoEditais: false,
        carregado: estado.carregado,
        semAcesso: objeto(erro).code === "42501",
        erroAoCarregar: mensagemDoBanco(erro),
      });
      return false;
    }
  }

  /*
    A configuração de convocação do edital (Lista de aprovados), se houver.
    Sem acesso (42501) ou sem as RPCs no banco (PGRST202) → null: a
    classificação segue com a regra. Qualquer outra falha vira `erro`: o
    quadro de vagas sairia errado, então a tela avisa e o "Gerar" espera.
  */
  async function carregarConvocacao(
    id: string,
  ): Promise<{ convocacao: unknown; erro: string }> {
    if (!convocacoes) {
      const leitura = Promise.all([
        rpc(RPC_CONFIGURACAO_CONVOCACAO),
        rpc(RPC_MODELOS_CONVOCACAO),
      ]);
      convocacoes = leitura;
      // Falhou: a próxima escolha tenta de novo.
      leitura.catch(() => {
        if (convocacoes === leitura) convocacoes = null;
      });
    }
    try {
      const [configuracoes, modelos] = await convocacoes;
      return {
        convocacao: convocacaoDoEdital({ configuracoes, modelos }, id),
        erro: "",
      };
    } catch (erro) {
      const codigo = objeto(erro).code;
      if (codigo === "42501" || codigo === "PGRST202")
        return { convocacao: null, erro: "" };
      return { convocacao: null, erro: mensagemDoBanco(erro) };
    }
  }

  /* "Tentar de novo" do aviso da convocação: lê só a convocação. */
  async function recarregarConvocacao() {
    const edital = estado.editalId;
    if (!edital || !estado.dados) return false;
    const meu = pedidoDoEdital;
    const { convocacao, erro } = await carregarConvocacao(edital);
    if (meu !== pedidoDoEdital || estado.editalId !== edital) return false;
    mudarDados(edital, (d) => ({ ...d, convocacao }));
    publicar({ erroDaConvocacao: erro });
    return !erro;
  }

  /* O edital escolhido: tudo o que o motor precisa. */
  async function escolherEdital(id: string) {
    const meu = ++pedidoDoEdital;
    if (id !== estado.editalId) geracao += 1;
    if (!id) {
      publicar({
        editalId: "",
        dados: null,
        salvando: false,
        gerando: false,
        carregandoEdital: false,
        erroDoEdital: "",
        erroDaConvocacao: "",
        calculo: null,
      });
      return false;
    }
    const outro = id !== estado.editalId;
    publicar({
      editalId: id,
      carregandoEdital: true,
      erroDoEdital: "",
      ...(outro
        ? { dados: null, salvando: false, gerando: false, calculo: null }
        : {}),
    });
    try {
      const [dados, { convocacao, erro: erroDaConvocacao }] = await Promise.all(
        [
          leituraDoEdital.ler(
            (nome, argumentos) => rpc(nome as RpcDaClassificacao, argumentos),
            { p_edital: id },
            id,
          ),
          carregarConvocacao(id),
        ],
      );
      if (meu !== pedidoDoEdital) return false;
      publicar({
        dados: dados ? { ...dadosDaClassificacao(dados), convocacao } : null,
        carregandoEdital: false,
        erroDaConvocacao,
        podeEditar: objeto(dados).pode_editar === true,
      });
      return true;
    } catch (erro) {
      if (meu !== pedidoDoEdital) return false;
      publicar({
        carregandoEdital: false,
        erroDoEdital: mensagemDoBanco(erro),
      });
      return false;
    }
  }

  /*
    Aplica a resposta de uma gravação só se o edital ainda é o mesmo: trocar de
    edital enquanto a RPC corre não pode pôr a regra, a lista ou o desempate de
    um edital nos dados do outro.
  */
  const mudarDados = (
    edital: string,
    mudar: (dados: DadosDaClassificacao) => DadosDaClassificacao,
  ) => {
    if (!estado.dados || estado.editalId !== edital) return;
    publicar({ dados: mudar(estado.dados) });
  };

  /* Salva a regra (nova versão). Devolve true/false; erro vira aviso. */
  /* A regra nova (ou renomeada) volta para a tela e para o seletor de editais. */
  function receberRegra(edital: string, regra: RegraDaClassificacao | null) {
    mudarDados(edital, (d) => ({ ...d, regra }));
    if (regra)
      publicar({
        editais: estado.editais.map((ed) =>
          ed.id === edital
            ? {
                ...ed,
                versao_regra: regra.versao,
                nome_regra: regra.nome ?? null,
              }
            : ed,
        ),
      });
  }

  /*
    Salva a regra (nova versão). Devolve true/false; erro vira aviso. O nome
    da versão só vai quando preenchido (sem ele, a chamada é a de antes).
  */
  async function salvarRegra(
    configuracao: RegistroDaClassificacao,
    motivo = "",
    nome: string | null = null,
  ) {
    if (!estado.editalId || estado.salvando) return false;
    const edital = estado.editalId;
    const minhaGeracao = geracao;
    const vigente = () =>
      minhaGeracao === geracao && estado.editalId === edital;
    publicar({ salvando: true });
    try {
      const regra = regraDaClassificacao(
        await rpc(RPC_SALVAR_REGRA, {
          p_edital: edital,
          p_configuracao: normalizarRegra(configuracao),
          p_versao_atual: estado.dados?.regra?.versao ?? 0,
          p_motivo: motivo || null,
          ...(nome ? { p_nome: nome } : {}),
        }),
      );
      if (!vigente()) return false;
      if (!regra) throw new Error("A versão da regra recebida é inválida.");
      aoGravarVersao(edital);
      receberRegra(edital, regra);
      publicar({ salvando: false });
      toast(`Regra salva (${rotuloDaVersao(regra) || "—"}).`, "success");
      return true;
    } catch (erro) {
      if (!vigente()) return false;
      publicar({ salvando: false });
      toast(
        `Não foi possível salvar a regra: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return false;
    }
  }

  /* Troca só o nome de uma versão (null tira o nome). Devolve { ok, erro }. */
  async function renomearVersao(
    versao: number,
    nome: string | null,
    motivo: string,
  ) {
    if (!estado.editalId) return { ok: false, erro: "Escolha o edital." };
    const edital = estado.editalId;
    const minhaGeracao = geracao;
    const vigente = () =>
      minhaGeracao === geracao && estado.editalId === edital;
    try {
      const regra = regraDaClassificacao(
        await rpc(RPC_RENOMEAR_VERSAO, {
          p_edital: edital,
          p_versao: versao,
          p_nome: nome || null,
          p_motivo: motivo,
        }),
      );
      if (!vigente()) return { ok: false, erro: "" };
      if (!regra) throw new Error("A versão da regra recebida é inválida.");
      receberRegra(edital, regra);
      toast("Nome da versão trocado.", "success");
      return { ok: true };
    } catch (erro) {
      if (!vigente()) return { ok: false, erro: "" };
      return { ok: false, erro: mensagemDoBanco(erro) };
    }
  }

  /*
    O cálculo pelo Python (20261023200000): pede ao banco. Chave desligada
    ({ ligada: false }) ou banco sem a RPC: null, e o "Gerar" segue com o
    cálculo da tela, como antes.
  */
  async function pedirCalculo(edital: string, tipo: string, versao: number) {
    try {
      return respostaDoPedido(
        await rpc(RPC_PEDIR_CALCULO, {
          p_edital: edital,
          p_tipo: tipo,
          p_versao: versao,
        }),
      );
    } catch (erro) {
      if (objeto(erro).code === "PGRST202") return null;
      throw erro;
    }
  }

  const esperar = (ms: number) =>
    new Promise<void>((pronto) => setTimeout(pronto, ms));

  /*
    Espera o job calcular a lista, confere o retrato do Python com o da tela e
    só registra quando são iguais (o banco confere de novo). Devolve a lista
    registrada, ou null com o aviso em `calculo` (falhou, prazo, diferente).
  */
  async function registrarPeloPython(
    pedido: PedidoDeCalculo,
    tipo: string,
    retrato: RegistroDaClassificacao,
    vigente: () => boolean,
  ): Promise<ListaRegistrada | null> {
    const avisar = (
      situacao: "calculando" | "falhou" | "prazo" | "diferente",
      mensagem = "",
    ) => {
      if (vigente())
        publicar({
          calculo: { tipo, pedido: pedido.pedido, situacao, mensagem },
        });
    };
    if (!esperaOJob(pedido.situacao)) {
      avisar("falhou", textoDoPedidoParado(pedido));
      return null;
    }
    avisar("calculando");
    const inicio = agora();
    let lido = calculoLido({ ...pedido, retrato: null });
    while (esperaOJob(lido.situacao)) {
      if (agora() - inicio >= prazoDoCalculoMs) {
        avisar(
          "prazo",
          `O cálculo em Python não chegou em ${Math.round(prazoDoCalculoMs / 60000)} min.`,
        );
        return null;
      }
      await esperar(intervaloDoCalculoMs);
      if (!vigente()) return null;
      try {
        lido = calculoLido(
          await rpc(RPC_OBTER_CALCULO, { p_pedido: pedido.pedido }),
        );
      } catch (erro) {
        // A conexão caiu: tenta de novo até o prazo.
        if (!ehFalhaDeConexao(erro)) throw erro;
      }
      if (!vigente()) return null;
    }
    if (lido.situacao !== "PRONTO") {
      avisar("falhou", textoDoPedidoParado(lido));
      return null;
    }
    const comRetrato = calculoLido(
      await rpc(RPC_OBTER_CALCULO, {
        p_pedido: pedido.pedido,
        p_com_retrato: true,
      }),
    );
    if (!vigente()) return null;
    const { total, caminhos } = diferencasDosRetratos(
      retrato,
      comRetrato.retrato,
    );
    if (total || !comRetrato.retrato) {
      avisar(
        "diferente",
        `O cálculo em Python não confere com o da tela (${total || 1} diferença(s)); a lista não foi registrada.`,
      );
      try {
        await rpc(RPC_DIVERGENCIA_DO_CALCULO, {
          p_pedido: pedido.pedido,
          p_total: total || 1,
          p_caminhos: caminhos,
        });
      } catch {
        // O aviso na tela já basta; a divergência gravada é para o suporte.
      }
      return null;
    }
    const resposta = await rpc(RPC_REGISTRAR_CALCULADA, {
      p_pedido: pedido.pedido,
      p_resultado: retrato,
    });
    if (objeto(resposta).nao_confere === true) {
      avisar(
        "diferente",
        "O banco não confirmou que o cálculo em Python é igual ao da tela; a lista não foi registrada.",
      );
      return null;
    }
    const registro = listaRegistrada(resposta);
    if (!registro) throw new Error("Registro de lista inválido.");
    return registro;
  }

  /*
    "Gerar": grava o retrato da lista com a versão da regra; o banco devolve o
    hash. Com a chave "Gerar listas pelo Python" ligada, a lista vem do Python
    (registrarPeloPython) e só é registrada igual à do motor.ts.
  */
  async function gerarLista(resultado: ResultadoDaClassificacao) {
    const d = estado.dados;
    if (!d?.regra || estado.gerando) return null;
    if (estado.erroDaConvocacao) {
      toast(
        "Não foi possível ler a convocação do edital; tente de novo antes de gerar.",
        "error",
      );
      return null;
    }
    const edital = estado.editalId;
    const minhaGeracao = geracao;
    const vigente = () =>
      minhaGeracao === geracao && estado.editalId === edital;
    publicar({ gerando: true, calculo: null });
    let pedido: PedidoDeCalculo | null = null;
    try {
      const retrato = retratoDaClassificacao(
        instantaneoDaLista(resultado, {
          edital: d.edital,
          regra: d.regra.configuracao,
          versao: d.regra.versao,
        }),
      );
      if (!retrato) throw new Error("Retrato de lista inválido.");
      pedido = await pedirCalculo(edital, resultado.tipo, d.regra.versao);
      let registro: ListaRegistrada | null;
      if (pedido) {
        if (!vigente()) return null;
        registro = await registrarPeloPython(
          pedido,
          resultado.tipo,
          retrato,
          vigente,
        );
        if (!vigente()) return null;
        if (!registro) {
          publicar({ gerando: false });
          return null;
        }
      } else {
        registro = listaRegistrada(
          await rpc(RPC_REGISTRAR_LISTA, {
            p_edital: edital,
            p_tipo: resultado.tipo,
            p_versao: d.regra.versao,
            p_resultado: retrato,
          }),
        );
        if (!registro) throw new Error("Registro de lista inválido.");
      }
      if (!vigente()) return null;
      const registrado = { ...registro, retrato };
      mudarDados(edital, (atual) => ({
        ...atual,
        listas: [registro, ...(atual.listas || [])],
      }));
      publicar({ gerando: false, calculo: null });
      toast("Lista gerada e registrada.", "success");
      return registrado;
    } catch (erro) {
      if (!vigente()) return null;
      publicar({
        gerando: false,
        ...(pedido
          ? {
              calculo: {
                tipo: resultado.tipo,
                pedido: pedido.pedido,
                situacao: "falhou" as const,
                mensagem: mensagemDoBanco(erro),
              },
            }
          : {}),
      });
      toast(
        `Não foi possível gerar a lista: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return null;
    }
  }

  /*
    Antes de publicar, a geração inteira (retrato) é conferida com os dados de
    agora: regra, quantidades e o conteúdo (notas, posições). Se mudou, não
    publica: pede para gerar de novo.
  */
  async function conferirAntesDePublicar(
    registrado: ListaRegistrada,
    resultado: ResultadoDaClassificacao | null,
  ) {
    const alvo = registrado.retrato
      ? registrado
      : listaComRetrato(await rpc(RPC_OBTER_LISTA, { p_lista: registrado.id }));
    if (!alvo?.retrato) throw new Error("Lista não encontrada.");
    if (!resultado) throw new Error("A classificação ainda não foi calculada.");
    const motivo = geracaoDesatualizada(
      alvo,
      resultado,
      estado.dados?.regra?.versao ?? null,
    );
    return {
      alvo: { ...alvo, retrato: alvo.retrato },
      motivo: motivo
        ? `Esta lista não bate com os dados de agora (${motivo}). Gere de novo antes de publicar.`
        : "",
    };
  }

  async function publicarLista(
    registrado: ListaRegistrada,
    resultado: ResultadoDaClassificacao | null,
  ) {
    const edital = estado.editalId;
    const minhaGeracao = geracao;
    const vigente = () =>
      minhaGeracao === geracao && estado.editalId === edital;
    const id = registrado.id;
    try {
      const { motivo } = await conferirAntesDePublicar(registrado, resultado);
      if (!vigente()) return null;
      if (motivo) {
        toast(motivo, "error");
        return null;
      }
      const registro = listaRegistrada(
        await rpc(RPC_PUBLICAR_LISTA, {
          p_lista: id,
        }),
      );
      if (!registro) throw new Error("Registro de lista inválido.");
      if (!vigente()) return null;
      mudarDados(edital, (d) => ({
        ...d,
        listas: (d.listas || []).map((l) => (l.id === id ? registro : l)),
      }));
      toast("Lista marcada como publicada.", "success");
      return registro;
    } catch (erro) {
      if (!vigente()) return null;
      toast(`Não foi possível publicar: ${mensagemDoBanco(erro)}`, "error");
      return null;
    }
  }

  /* O retrato de uma geração (para exportar de novo). */
  async function obterLista(id: string) {
    const minhaGeracao = geracao;
    try {
      const dados = await rpc(RPC_OBTER_LISTA, { p_lista: id });
      if (minhaGeracao !== geracao) return null;
      return listaComRetrato(dados);
    } catch (erro) {
      if (minhaGeracao !== geracao) return null;
      toast(
        `Não foi possível abrir a lista: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return null;
    }
  }

  /*
    A prévia de "Publicar como lista de aprovados": o retrato da lista FINAL e
    a lista de aprovados vigente do edital, com os candidatos (o casamento das
    pessoas e o resumo são de src/lib/publicacao-de-aprovados.ts).
  */
  async function prepararPublicacaoDeAprovados(
    registrado: ListaRegistrada | null,
    resultado: ResultadoDaClassificacao | null,
  ) {
    if (!registrado?.id || !estado.editalId) return null;
    const minhaGeracao = geracao;
    try {
      const [{ alvo, motivo }, situacao] = await Promise.all([
        conferirAntesDePublicar(registrado, resultado),
        rpc(RPC_OBTER_PUBLICACAO, {
          p_edital: estado.editalId,
          p_com_candidatos: true,
        }),
      ]);
      if (minhaGeracao !== geracao) return null;
      if (motivo) return { erro: motivo };
      candidatosDaListaFinal(alvo.retrato);
      return { registrado: alvo, situacao: situacaoDaPublicacao(situacao) };
    } catch (erro) {
      if (minhaGeracao !== geracao) return null;
      return { erro: mensagemDoBanco(erro) };
    }
  }

  /* Publica o resultado final como a lista de aprovados vigente. */
  async function publicarComoListaDeAprovados({
    listaId,
    listaVigente,
    vinculos,
  }: {
    listaId: string;
    listaVigente?: string | null;
    vinculos?: VinculoDaPublicacao[];
  }) {
    const minhaGeracao = geracao;
    try {
      const resposta = await rpc(RPC_PUBLICAR_APROVADOS, {
        p_lista_classificacao: listaId,
        p_lista_vigente: listaVigente || null,
        p_vinculos: vinculos || [],
      });
      if (minhaGeracao !== geracao) return null;
      let resultado;
      try {
        resultado = resultadoDaPublicacao(resposta);
      } catch {
        toast(
          "A solicitação de publicação foi enviada, mas a confirmação do banco está incompleta. Confira a Lista de aprovados antes de tentar novamente.",
          "warning",
        );
        return null;
      }
      toast(
        `Lista de aprovados publicada: ${resultado?.candidatos ?? 0} candidato(s).`,
        "success",
      );
      return resultado;
    } catch (erro) {
      if (minhaGeracao !== geracao) return null;
      toast(
        `Não foi possível publicar a lista de aprovados: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return null;
    }
  }

  /* Sorteio (semente vazia = do servidor) ou decisão manual. */
  async function registrarDesempate(dados: RegistroDaClassificacao) {
    const edital = estado.editalId;
    const minhaGeracao = geracao;
    const vigente = () =>
      minhaGeracao === geracao && estado.editalId === edital;
    try {
      const bruto = objeto(
        await rpc(RPC_REGISTRAR_DESEMPATE, {
          p_edital: edital,
          p_dados: dados,
        }),
      );
      const registro = desempateRegistrado(bruto);
      if (!vigente()) return null;
      mudarDados(edital, (d) => ({
        ...d,
        desempates: [
          ...(d.desempates || []).filter((x) => x.chave !== registro.chave),
          registro,
        ],
      }));
      toast(
        registro.metodo === "SORTEIO"
          ? "Sorteio registrado."
          : "Decisão registrada.",
        "success",
      );
      return registro;
    } catch (erro) {
      if (!vigente()) return null;
      toast(`Não foi possível registrar: ${mensagemDoBanco(erro)}`, "error");
      return null;
    }
  }

  /*
    A hora de nascimento da certidão (desempate por maior idade no mesmo dia).
    Vazio tira (volta a valer 23:59:59). O candidato nos dados recebe a hora
    gravada e o motor recalcula a lista na tela.
  */
  async function salvarHoraDeNascimento(analiseId: string, hora: string) {
    const edital = estado.editalId;
    const minhaGeracao = geracao;
    const vigente = () =>
      minhaGeracao === geracao && estado.editalId === edital;
    if (!edital || !analiseId) return false;
    try {
      const gravado = objeto(
        await rpc(RPC_SALVAR_HORA, {
          p_edital: edital,
          p_analise: analiseId,
          p_hora: hora || "",
        }),
      );
      if (!vigente()) return false;
      const nova = textoDaClassificacao(gravado.hora_nascimento) || null;
      mudarDados(edital, (d) => ({
        ...d,
        candidatos: (d.candidatos || []).map((c) =>
          c.analise_id === analiseId ? { ...c, hora_nascimento: nova } : c,
        ),
      }));
      toast(
        nova
          ? "Hora de nascimento registrada."
          : "Hora de nascimento retirada: vale 23h59min59s.",
        "success",
      );
      return true;
    } catch (erro) {
      if (!vigente()) return false;
      toast(
        `Não foi possível salvar a hora: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return false;
    }
  }

  /* O texto do cabeçalho da agência (Configurações › Marca) e o logo. */
  function marcaDoDocumento() {
    let texto = "";
    try {
      texto = String(cabecalho() ?? "").trim();
    } catch {
      texto = "";
    }
    return { cabecalho: texto || CABECALHO_PADRAO, logo: enderecoDoLogo };
  }

  /*
    O documento oficial de uma lista registrada (documento-sei.js), com os
    textos do edital — os salvos na regra ou, se vier `documento`, o rascunho
    que o gestor está editando. Na convocação, DATA e HORA saem da agenda das
    entrevistas salva do edital (`agendaDoEdital`, estado-da-agenda.ts).
  */
  function documentoDaLista(
    registrado: ListaRegistrada | null,
    { lista = "todas", fase = null, documento = null }: OpcoesDoDocumento = {},
  ) {
    if (!registrado?.retrato) return null;
    const configuracao = estado.dados?.regra?.configuracao || {};
    let agenda = null;
    if (registrado.retrato.tipo === "CONVOCACAO") {
      try {
        agenda = agendaDoEdital(estado.editalId);
      } catch {
        agenda = null;
      }
    }
    return documentoOficial(registrado.retrato, {
      lista,
      fase,
      regra: documento ? { ...configuracao, documento } : configuracao,
      agenda,
      treinamento:
        Boolean(estado.dados?.edital?.treinamento) ||
        ehEditalDeTreinamento(registrado.retrato.edital),
    });
  }

  /*
    Exporta uma lista registrada: formato pdf | docx | xlsx; lista = todas |
    geral | código da modalidade | eliminados; fase = PRELIMINAR | FINAL (o
    título da publicação; null = o padrão da etapa); documento = rascunho dos
    textos (null = os da regra).
  */
  async function exportar(
    registrado: ListaRegistrada | null,
    formato: string,
    lista = "todas",
    fase: OpcoesDoDocumento["fase"] = null,
    documento: RegistroDaClassificacao | null = null,
  ) {
    if (!registrado?.retrato) return false;
    const minhaGeracao = geracao;
    const { retrato } = registrado;
    /*
      O XLSX é a planilha inteira do retrato (classificação e eliminados), para
      conferência: o recorte da lista vale para o documento, e o nome do
      arquivo não pode dizer um recorte que o conteúdo não tem.
    */
    if (formato === "xlsx") {
      const nome = nomeDoArquivo(retrato);
      baixar(gerarXlsxDaLista(retrato), `${nome}.xlsx`, MIME_XLSX);
      return true;
    }
    const nome = nomeDoArquivo(retrato, lista);
    const doc = documentoDaLista(registrado, { lista, fase, documento });
    if (!doc) return false;
    const marca = marcaDoDocumento();
    if (formato === "docx") {
      const logo = await Promise.resolve()
        .then(() => carregarLogo())
        .catch(() => null);
      if (minhaGeracao !== geracao) return false;
      baixar(
        gerarDocxOficial(doc, { cabecalho: marca.cabecalho, logo }),
        `${nome}.docx`,
        MIME_DOCX,
      );
    } else imprimir(paginaDaPrevia(doc, marca));
    return true;
  }

  /*
    O relatório de desempate da lista gerada (calculado pelo Python e guardado
    em TB_RELATORIO_DESEMPATE) e o preparo dele (gerar a lista pede o
    relatório ao job; migrations 20261023140000 e 20261023170000). Sem
    resposta, sem a RPC no banco ou com falha na leitura: null, e a tela não
    mostra nada do relatório — nada da lista depende dele.
  */
  async function obterDesempate(listaId: string) {
    if (!listaId) return null;
    const minhaGeracao = geracao;
    try {
      const dados = await rpc(RPC_OBTER_DESEMPATE, { p_lista: listaId });
      return minhaGeracao === geracao ? lerRespostaDoDesempate(dados) : null;
    } catch {
      return null;
    }
  }

  /* XLSX (planilhas Candidatos e Pares) ou PDF (impressão do texto). */
  function exportarDesempate(
    desempate: DesempateDaLista | null,
    registrado: ListaRegistrada | null,
    formato: string,
  ) {
    if (!desempate || !registrado?.retrato) return false;
    if (registrado.id !== desempate.listaId) return false;
    const nome = `${nomeDoArquivo(registrado.retrato)}-desempate`;
    if (formato === "xlsx")
      baixar(
        gerarXlsx(planilhasDoDesempate(desempate)),
        `${nome}.xlsx`,
        MIME_XLSX,
      );
    else imprimir(paginaDoDesempate(desempate, "Relatório de desempate"));
    return true;
  }

  /* "Copiar para o SEI": HTML (classes do SEI) + texto na área de transferência. */
  async function copiarParaSei(
    registrado: ListaRegistrada | null,
    { lista = "todas", fase = null, documento = null }: OpcoesDoDocumento = {},
  ) {
    const doc = documentoDaLista(registrado, { lista, fase, documento });
    if (!doc) return "";
    const minhaGeracao = geracao;
    const resultado = await copiar({
      html: htmlParaSei(doc),
      texto: textoParaSei(doc),
    });
    if (minhaGeracao !== geracao) return "";
    if (resultado === "html")
      toast(
        "Copiado. No SEI, cole no editor do documento (Ctrl+V).",
        "success",
      );
    else if (resultado === "texto")
      toast(
        "Copiado só como texto: o navegador não liberou o formato com tabelas. Use o DOCX.",
        "warn",
      );
    else
      toast(
        "Não foi possível copiar. Libere a área de transferência ou use o DOCX.",
        "error",
      );
    return resultado;
  }

  /* Os textos do documento ficam na regra do edital (nova versão). */
  function salvarTextosDoDocumento(documento: RegistroDaClassificacao) {
    const configuracao = estado.dados?.regra?.configuracao;
    if (!configuracao) return Promise.resolve(false);
    return salvarRegra(
      { ...configuracao, documento },
      "Textos do documento oficial (SEI)",
    );
  }

  /*
    Gancho da fase 2: ler a regra do PDF do edital (como o quadro de vagas é
    lido do PDF de anexos). Ainda não existe; a tela não mostra o botão.
  */
  async function importarRegraDoEdital() {
    return null;
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    escolherEdital,
    recarregarConvocacao,
    salvarRegra,
    renomearVersao,
    gerarLista,
    publicarLista,
    obterLista,
    registrarDesempate,
    salvarHoraDeNascimento,
    prepararPublicacaoDeAprovados,
    publicarComoListaDeAprovados,
    exportar,
    obterDesempate,
    exportarDesempate,
    documentoDaLista,
    marcaDoDocumento,
    copiarParaSei,
    salvarTextosDoDocumento,
    importarRegraDoEdital,
    reiniciar,
  };
}
