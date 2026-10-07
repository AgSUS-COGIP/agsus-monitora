/*
  Estado da tela de Classificação (`#page-classificacao`), fora do React. Os
  componentes leem com `useSyncExternalStore`. Este arquivo não importa React.

  RPCs (supabase/migrations/20261002150000_classificacao.sql; contrato em
  src/lib/rpc-contrato.js):
    listar_editais_classificacao(p_area)     os editais da área atual
    obter_classificacao_do_edital(p_edital)  regra, quadro, análises,
                                             entrevistas, listas e desempates
    salvar_regra_classificacao(...)          nova versão da regra
    registrar_lista_classificacao(...)       "Gerar": retrato + hash do banco
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
                                             mesma conta (convocacao-do-edital.js)

  A conta é do motor puro (src/lib/classificacao/motor.js), feita no
  componente a partir de `dados`; aqui só a carga, a gravação e a exportação.

  Sessão: o cliente Supabase único do app. Outro usuário na mesma aba: tudo
  volta ao início.

  Documento oficial (SEI): o modelo sai de src/lib/classificacao/documento-sei.js
  com os textos do edital (regra.documento); "Copiar para o SEI" leva HTML +
  texto à área de transferência; DOCX com papel timbrado
  (documento-docx.js); PDF = impressão da página "Como fica no SEI". O
  cabeçalho da agência vem de Configurações › Marca (`documento_cabecalho`).
*/
import { MIME_DOCX } from "../../lib/documento-da-resposta.js";
import {
  gerarXlsxDaLista,
  instantaneoDaLista,
  MIME_XLSX,
  nomeDoArquivo,
} from "../../lib/classificacao/exportacao.js";
import {
  CABECALHO_PADRAO,
  documentoOficial,
  htmlParaSei,
  paginaDaPrevia,
  textoParaSei,
} from "../../lib/classificacao/documento-sei.js";
import { gerarDocxOficial } from "../../lib/classificacao/documento-docx.js";
import { ehEditalDeTreinamento } from "../../lib/edital-de-treinamento.js";
import { LOGO_PADRAO_DA_BARRA } from "../../lib/marca-da-barra-lateral.js";
import {
  copiarParaAreaDeTransferencia,
  imprimirPagina,
  logoEmPng,
} from "./documento-no-navegador.js";
import { convocacaoDoEdital } from "../../lib/classificacao/convocacao-do-edital.js";
import { normalizarRegra } from "../../lib/classificacao/regra.js";
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";

/* As RPCs (src/lib/rpc-contrato.js); chamadas por `rpc()`, com tempo limite. */
const RPC_LISTAR_EDITAIS = "listar_editais_classificacao";
const RPC_OBTER_EDITAL = "obter_classificacao_do_edital";
const RPC_SALVAR_REGRA = "salvar_regra_classificacao";
const RPC_REGISTRAR_LISTA = "registrar_lista_classificacao";
const RPC_PUBLICAR_LISTA = "publicar_lista_classificacao";
const RPC_OBTER_LISTA = "obter_lista_classificacao";
const RPC_REGISTRAR_DESEMPATE = "registrar_desempate_classificacao";
const RPC_OBTER_PUBLICACAO = "obter_publicacao_lista_aprovados";
const RPC_PUBLICAR_APROVADOS = "publicar_lista_aprovados_da_classificacao";
const RPC_CONFIGURACAO_CONVOCACAO = "listar_configuracao_convocacao";
const RPC_MODELOS_CONVOCACAO = "listar_modelos_convocacao";

export const MENSAGEM_SEM_ACESSO = "Sem acesso à Classificação";
const TEMPO_LIMITE_MS = 45000;

const ESTADO_INICIAL = Object.freeze({
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
});

function mensagemDoBanco(erro) {
  if (erro?.code === "PGRST202")
    return "A aba Classificação ainda não foi publicada no banco.";
  if (erro?.code === "42501")
    return "Seu acesso não inclui a classificação desta área ou deste edital.";
  if (erro?.code === "40001")
    return erro.message || "A regra mudou desde que você abriu; recarregue.";
  if (ehFalhaDeConexao(erro)) return mensagemDeFalha(erro);
  return erro?.message || mensagemDeFalha(erro);
}

export function baixarNoNavegador(bytes, nome, tipo) {
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
} = {}) {
  let estado = ESTADO_INICIAL;
  let pedidoDosEditais = 0;
  let pedidoDoEdital = 0;
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  function reiniciar() {
    pedidoDosEditais += 1;
    pedidoDoEdital += 1;
    publicar(ESTADO_INICIAL);
  }
  let identidade;
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    if (identidade !== undefined || !atual) reiniciar();
    identidade = atual;
  });

  async function rpc(nome, argumentos) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  /* Os editais da área. Troca de área recomeça do zero. */
  async function carregar(area = estado.area) {
    if (!area) return false;
    const meu = ++pedidoDosEditais;
    if (area !== estado.area) {
      pedidoDoEdital += 1;
      publicar({ ...ESTADO_INICIAL, area, carregandoEditais: true });
    } else publicar({ carregandoEditais: true, erroAoCarregar: "" });
    try {
      const dados = await rpc(RPC_LISTAR_EDITAIS, { p_area: area });
      if (meu !== pedidoDosEditais) return false;
      const editais = Array.isArray(dados?.editais) ? dados.editais : [];
      const escolhido = editais.some((e) => e.id === estado.editalId)
        ? estado.editalId
        : "";
      publicar({
        editais,
        podeEditar: Boolean(dados?.pode_editar),
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
        semAcesso: erro?.code === "42501",
        erroAoCarregar: mensagemDoBanco(erro),
      });
      return false;
    }
  }

  /*
    A configuração de convocação do edital (Lista de aprovados), se houver.
    Sem acesso ou sem configuração → null: a classificação segue com a regra.
  */
  async function carregarConvocacao(id) {
    try {
      const [configuracoes, modelos] = await Promise.all([
        rpc(RPC_CONFIGURACAO_CONVOCACAO),
        rpc(RPC_MODELOS_CONVOCACAO),
      ]);
      return convocacaoDoEdital({ configuracoes, modelos }, id);
    } catch {
      return null;
    }
  }

  /* O edital escolhido: tudo o que o motor precisa. */
  async function escolherEdital(id) {
    const meu = ++pedidoDoEdital;
    if (!id) {
      publicar({
        editalId: "",
        dados: null,
        carregandoEdital: false,
        erroDoEdital: "",
      });
      return false;
    }
    const outro = id !== estado.editalId;
    publicar({
      editalId: id,
      carregandoEdital: true,
      erroDoEdital: "",
      ...(outro ? { dados: null } : {}),
    });
    try {
      const [dados, convocacao] = await Promise.all([
        rpc(RPC_OBTER_EDITAL, { p_edital: id }),
        carregarConvocacao(id),
      ]);
      if (meu !== pedidoDoEdital) return false;
      publicar({
        dados: dados ? { ...dados, convocacao } : null,
        carregandoEdital: false,
        podeEditar: Boolean(dados?.pode_editar),
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
  const mudarDados = (edital, mudar) => {
    if (!estado.dados || estado.editalId !== edital) return;
    publicar({ dados: mudar(estado.dados) });
  };

  /* Salva a regra (nova versão). Devolve true/false; erro vira aviso. */
  async function salvarRegra(configuracao, motivo = "") {
    if (!estado.editalId || estado.salvando) return false;
    const edital = estado.editalId;
    publicar({ salvando: true });
    try {
      const regra = await rpc(RPC_SALVAR_REGRA, {
        p_edital: edital,
        p_configuracao: normalizarRegra(configuracao),
        p_versao_atual: estado.dados?.regra?.versao ?? 0,
        p_motivo: motivo || null,
      });
      mudarDados(edital, (d) => ({ ...d, regra }));
      publicar({ salvando: false });
      toast(`Regra salva (versão ${regra?.versao ?? "—"}).`, "success");
      return true;
    } catch (erro) {
      publicar({ salvando: false });
      toast(
        `Não foi possível salvar a regra: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return false;
    }
  }

  /* "Gerar": grava o retrato da lista com a versão da regra; o banco devolve o hash. */
  async function gerarLista(resultado) {
    const d = estado.dados;
    if (!d?.regra || estado.gerando) return null;
    const edital = estado.editalId;
    publicar({ gerando: true });
    try {
      const retrato = instantaneoDaLista(resultado, {
        edital: d.edital,
        regra: d.regra.configuracao,
        versao: d.regra.versao,
      });
      const registro = await rpc(RPC_REGISTRAR_LISTA, {
        p_edital: edital,
        p_tipo: resultado.tipo,
        p_versao: d.regra.versao,
        p_resultado: retrato,
      });
      const registrado = { ...registro, retrato };
      mudarDados(edital, (atual) => ({
        ...atual,
        listas: [registro, ...(atual.listas || [])],
      }));
      publicar({ gerando: false });
      toast("Lista gerada e registrada.", "success");
      return registrado;
    } catch (erro) {
      publicar({ gerando: false });
      toast(
        `Não foi possível gerar a lista: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return null;
    }
  }

  async function publicarLista(id) {
    const edital = estado.editalId;
    try {
      const registro = await rpc(RPC_PUBLICAR_LISTA, {
        p_lista: id,
      });
      mudarDados(edital, (d) => ({
        ...d,
        listas: (d.listas || []).map((l) => (l.id === id ? registro : l)),
      }));
      toast("Lista marcada como publicada.", "success");
      return registro;
    } catch (erro) {
      toast(`Não foi possível publicar: ${mensagemDoBanco(erro)}`, "error");
      return null;
    }
  }

  /* O retrato de uma geração (para exportar de novo). */
  async function obterLista(id) {
    try {
      const dados = await rpc(RPC_OBTER_LISTA, { p_lista: id });
      return dados?.resultado
        ? { ...dados.lista, retrato: dados.resultado }
        : null;
    } catch (erro) {
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
    pessoas e o resumo são de src/lib/publicacao-de-aprovados.js).
  */
  async function prepararPublicacaoDeAprovados(registrado) {
    if (!registrado?.id || !estado.editalId) return null;
    try {
      const [alvo, situacao] = await Promise.all([
        registrado.retrato
          ? Promise.resolve(registrado)
          : rpc(RPC_OBTER_LISTA, { p_lista: registrado.id }).then((d) =>
              d?.resultado ? { ...d.lista, retrato: d.resultado } : null,
            ),
        rpc(RPC_OBTER_PUBLICACAO, {
          p_edital: estado.editalId,
          p_com_candidatos: true,
        }),
      ]);
      if (!alvo?.retrato) throw new Error("Lista não encontrada.");
      return { registrado: alvo, situacao: situacao || {} };
    } catch (erro) {
      return { erro: mensagemDoBanco(erro) };
    }
  }

  /* Publica o resultado final como a lista de aprovados vigente. */
  async function publicarComoListaDeAprovados({
    listaId,
    listaVigente,
    vinculos,
  }) {
    try {
      const resultado = await rpc(RPC_PUBLICAR_APROVADOS, {
        p_lista_classificacao: listaId,
        p_lista_vigente: listaVigente || null,
        p_vinculos: vinculos || [],
      });
      toast(
        `Lista de aprovados publicada: ${resultado?.candidatos ?? 0} candidato(s).`,
        "success",
      );
      return resultado;
    } catch (erro) {
      toast(
        `Não foi possível publicar a lista de aprovados: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return null;
    }
  }

  /* Sorteio (semente vazia = do servidor) ou decisão manual. */
  async function registrarDesempate(dados) {
    const edital = estado.editalId;
    try {
      const registro = await rpc(RPC_REGISTRAR_DESEMPATE, {
        p_edital: edital,
        p_dados: dados,
      });
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
      toast(`Não foi possível registrar: ${mensagemDoBanco(erro)}`, "error");
      return null;
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
    entrevistas salva do edital (`agendaDoEdital`, estado-da-agenda.js).
  */
  function documentoDaLista(
    registrado,
    { lista = "todas", fase = null, documento = null } = {},
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
    registrado,
    formato,
    lista = "todas",
    fase = null,
    documento = null,
  ) {
    if (!registrado?.retrato) return false;
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
    const marca = marcaDoDocumento();
    if (formato === "docx") {
      const logo = await Promise.resolve()
        .then(() => carregarLogo())
        .catch(() => null);
      baixar(
        gerarDocxOficial(doc, { cabecalho: marca.cabecalho, logo }),
        `${nome}.docx`,
        MIME_DOCX,
      );
    } else imprimir(paginaDaPrevia(doc, marca));
    return true;
  }

  /* "Copiar para o SEI": HTML (classes do SEI) + texto na área de transferência. */
  async function copiarParaSei(
    registrado,
    { lista = "todas", fase = null, documento = null } = {},
  ) {
    const doc = documentoDaLista(registrado, { lista, fase, documento });
    if (!doc) return "";
    const resultado = await copiar({
      html: htmlParaSei(doc),
      texto: textoParaSei(doc),
    });
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
  function salvarTextosDoDocumento(documento) {
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
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    escolherEdital,
    salvarRegra,
    gerarLista,
    publicarLista,
    obterLista,
    registrarDesempate,
    prepararPublicacaoDeAprovados,
    publicarComoListaDeAprovados,
    exportar,
    documentoDaLista,
    marcaDoDocumento,
    copiarParaSei,
    salvarTextosDoDocumento,
    importarRegraDoEdital,
    reiniciar,
  };
}
