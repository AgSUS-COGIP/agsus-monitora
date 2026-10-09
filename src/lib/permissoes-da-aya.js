/*
  "Não aparece o botão", "por que não consigo decidir o recurso?", "quem pode
  dar acesso?": a Aya responde olhando o perfil de quem pergunta.

  Cada ação tem as palavras que a nomeiam, a tela, a regra de permissão (as
  mesmas funções de src/lib/access-roles.js que escondem o botão), quem pode
  (em texto) e onde o botão fica. Sem DOM, sem rede: o perfil vem de quem
  chama (`getMonitoraProfile` do app).
*/
import {
  canChangeCandidateStatus,
  canEditClassificacao,
  canEditRecursos,
  canImportApprovedList,
  canManageAccess,
  canManageCandidateAttachments,
  canManageEditais,
  canManageSettings,
  canManageSubJudice,
  canUnlockCandidateStatus,
  isAdminGlobal,
  podeEditarCoordenadas,
  podeUsarChat,
  podeVerPessoasOnline,
  roleLabel,
} from "./access-roles.js";
import { hasResource } from "./permissoes-recursos.js";
import { normalizar } from "./termos-da-aya.js";

const acao = (id, palavras, nome, pode, quem, onde, abrir = "") =>
  Object.freeze({ id, palavras, nome, pode, quem, onde, abrir });

export const ACOES_COM_PERMISSAO = Object.freeze([
  acao(
    "decidir-recurso",
    /\b(deferir|indeferir|decidir|decisao|devolver)\b.*\brecursos?\b|\bparecer juridico\b|\bdar (o )?parecer\b/,
    "decidir recursos (deferir, indeferir ou devolver)",
    (p) => hasResource(p, "recursos_parecer", 2),
    "a permissão Parecer jurídico (Recursos)",
    "Os botões de decisão aparecem no recurso aberto em Analisar recursos, quando ele está aguardando parecer.",
    "analisar-recursos",
  ),
  acao(
    "modelos-de-resposta",
    /\bmodelos? de resposta\b/,
    "gerenciar os modelos de resposta dos recursos",
    (p) => hasResource(p, "recursos", 3),
    "o nível Administrador em Recursos",
    "O botão Modelos de resposta fica no topo de Analisar recursos.",
    "analisar-recursos",
  ),
  acao(
    "ajuste-de-pontuacao",
    /\b(ajust\w*|corrig\w*) (a |da )?(pontuacao|nota)\b/,
    "propor ajuste de pontuação num recurso",
    canEditRecursos,
    "o nível Editor em Recursos (aprovar o ajuste é de quem tem Parecer jurídico)",
    "O ajuste fica no recurso aberto em Analisar recursos, na parte Ajuste da pontuação.",
    "analisar-recursos",
  ),
  acao(
    "novo-recurso",
    /\b(novo|registrar|cadastrar|criar|lancar|incluir) (um )?recursos?\b|\bbotao (de )?recursos?\b/,
    "registrar recursos",
    canEditRecursos,
    "o nível Editor em Recursos",
    "O botão Novo recurso fica no topo de Analisar recursos.",
    "analisar-recursos",
  ),
  acao(
    "liberar-entrevista",
    /\bliberar (o )?edital\b|\bfora da janela\b/,
    "liberar um edital fora da janela da entrevista",
    isAdminGlobal,
    "ser administrador global",
    "A liberação fica em Conduzir entrevistas, junto da escolha do edital.",
    "conduzir-entrevistas",
  ),
  acao(
    "conduzir-entrevista",
    /\b(lancar|registrar|dar|salvar) (as )?notas?\b|\bconduzir (a |as )?entrevistas?\b|\bficha de notas\b|\bconvocar para (a )?entrevista\b|\broteiros?\b/,
    "conduzir entrevistas (roteiro, convocação e notas)",
    (p) => hasResource(p, "entrevistas", 2),
    "o nível Editor em Entrevistas",
    "Fica em Conduzir entrevistas (a fila e o Preparar, com os roteiros).",
    "conduzir-entrevistas",
  ),
  acao(
    "classificacao",
    /\b(gerar|publicar|exportar) (a )?lista\b|\bsortei\w*\b|\b(salvar|mudar|editar) (a )?regra\b|\bpublicar como lista de aprovados\b/,
    "gerar e publicar listas, salvar a regra e registrar sorteio na Classificação",
    canEditClassificacao,
    "o nível Editor em Classificação",
    "Os botões ficam na Classificação, com o edital escolhido.",
    "classificacao",
  ),
  acao(
    "destravar-status",
    /\b(mudar|alterar|trocar|corrigir) (um )?status (ja )?(definido|travado)\b|\bstatus travado\b/,
    "mudar um status de candidato já definido",
    canUnlockCandidateStatus,
    "o nível Administrador em Lista de aprovados (o Convocado qualquer editor muda)",
    "O status fica na linha do candidato, na Lista de aprovados.",
    "approved",
  ),
  acao(
    "anexos-do-candidato",
    /\banex\w* (de |um )?(documento|pdf|arquivo)\b|\banexos? do candidato\b|\banexar\b/,
    "anexar ou remover documentos do candidato",
    canManageCandidateAttachments,
    "o nível Administrador em Lista de aprovados",
    "Os anexos ficam na linha do candidato, na Lista de aprovados.",
    "approved",
  ),
  acao(
    "sub-judice",
    /\bsub ?judice\b|\bdecisao judicial\b|\bliminar\b/,
    "incluir candidato sub judice",
    canManageSubJudice,
    "o nível Editor em Lista de aprovados (alterar nota ou modalidade por decisão judicial é do Administrador do módulo)",
    "Fica na Lista de aprovados, com o edital escolhido.",
    "approved",
  ),
  acao(
    "importar-lista",
    /\bimport\w* (a )?lista\b|\bsubir (a )?lista\b|\bcarregar (a )?lista\b/,
    "importar a lista de aprovados",
    canImportApprovedList,
    "o nível Editor em Importação e convocação (substituir lista é do Administrador)",
    "Fica na Lista de aprovados, aba Aprovados.",
    "approved",
  ),
  acao(
    "status-do-candidato",
    /\b(mudar|alterar|marcar|trocar|definir) (o )?status\b|\bmarcar (como )?(convocado|contratado|desistente)\b|\bcarta de convocacao\b|\bemitir (a )?carta\b/,
    "mudar o status do candidato e emitir a carta de convocação",
    canChangeCandidateStatus,
    "o nível Editor em Lista de aprovados",
    "O status e a carta ficam na linha do candidato, na Lista de aprovados.",
    "approved",
  ),
  acao(
    "mover-edital",
    /\bmover (o |um )?edital\b|\b(mudar|trocar) (o )?edital de area\b/,
    "mover edital de área",
    isAdminGlobal,
    "ser administrador global",
    "Fica no formulário do edital, em Editais.",
    "nucleo",
  ),
  acao(
    "novo-edital",
    /\b(novo|cadastrar|criar|incluir) (um )?edital\b|\beditar (o )?(edital|cronograma)\b|\bquadro de vagas\b|\banexos? do edital\b/,
    "cadastrar e editar editais (cronograma, anexos e quadro de vagas)",
    canManageEditais,
    "o nível Editor em Editais ou em Cronograma",
    "O botão Novo edital fica no topo de Editais; o lápis de cada linha abre o formulário.",
    "nucleo",
  ),
  acao(
    "grupos-e-coordenacoes",
    /\b(criar|editar|mudar) (um )?(grupo|coordenac\w*)\b|\bgrupos de permiss\w*\b|\baba (grupos|coordenacoes)\b/,
    "criar e editar grupos de permissões e coordenações",
    isAdminGlobal,
    "ser administrador global",
    "Ficam em Configurações › Acessos, nas abas Grupos e Coordenações.",
    "config:acessos",
  ),
  acao(
    "dar-acesso",
    /\b(dar|liberar|conceder|tirar|remover) (o )?acesso\b|\badicionar (uma )?pessoa\b|\bconvidar\b|\baprovar (o )?pedido\b/,
    "dar e tirar acesso de pessoas",
    canManageAccess,
    "ser administrador global ou coordenador com Gestão de acessos (só na própria coordenação)",
    "Fica em Configurações › Acessos.",
    "config:acessos",
  ),
  acao(
    "rodar-agora",
    /\brodar agora\b|\brobo da empregare\b|\bstatus das atualizacoes\b|\bforcar (a )?carga\b/,
    "ver o Status das atualizações e usar o Rodar agora",
    isAdminGlobal,
    "ser administrador global",
    "Fica em Configurações › Status das atualizações.",
    "config:cargas",
  ),
  acao(
    "modulos-e-abas",
    /\bmodulos e abas\b|\b(manutencao|desativar|ativar) (a |uma )?(aba|area|modulo)\b|\bselo beta\b/,
    "ativar, desativar ou pôr em manutenção áreas, abas e painéis",
    isAdminGlobal,
    "ser administrador global",
    "Fica em Configurações › Módulos e abas.",
    "config:modulos",
  ),
  acao(
    "retencao-do-chat",
    /\bzerar (as )?mensagens\b|\bretencao\b/,
    "mudar a retenção e zerar as mensagens do chat",
    isAdminGlobal,
    "ser administrador global",
    "Fica em Configurações › Mensagens.",
    "config:mensagens",
  ),
  acao(
    "publicar-configuracoes",
    /\bpublicar (as )?configurac\w*\b|\b(mudar|trocar) (a )?(marca|logo|cor|arte de fundo|aviso global)\b/,
    "alterar e publicar as Configurações",
    canManageSettings,
    "o nível Editor em Configurações",
    "Fica em Configurações, em cada seção.",
    "config:marca",
  ),
  acao(
    "editar-coordenadas",
    /\b(corrigir|editar|mover|ajustar) (a )?(coordenada|ponto|localizacao)\b|\bmodo de edicao\b/,
    "corrigir coordenadas nos mapas",
    podeEditarCoordenadas,
    "ser administrador global ou Gestor",
    "Fica no mapa da Visão geral, no modo de edição de coordenadas.",
    "dashboard",
  ),
  acao(
    "pessoas-online",
    /\bpessoas online\b|\bquem esta online\b/,
    "ver as Pessoas online",
    podeVerPessoasOnline,
    "ser administrador global ou Gestor",
    "Fica no cabeçalho, ao lado das Mensagens.",
  ),
  acao(
    "chat",
    /\b(chat|mensagens?|conversa)\b/,
    "usar as Mensagens (chat)",
    podeUsarChat,
    "a permissão Mensagens no seu grupo",
    "O ícone das Mensagens fica no cabeçalho.",
  ),
]);

const PERGUNTA_DE_PERMISSAO =
  /\b(botao|botoes|opcao|opcoes|icone|nao (consigo|posso|deixa|tenho (acesso|permissao))|desabilitad\w*|bloquead\w*|cinza|quem pode|posso|consigo|tenho permissao|minha permissao|meu acesso|meu perfil)\b/;

/** A ação com permissão de que a pergunta fala, ou `null`. */
export function acaoDaPergunta(pergunta) {
  const texto = normalizar(pergunta);
  if (!texto || !PERGUNTA_DE_PERMISSAO.test(texto)) return null;
  return ACOES_COM_PERMISSAO.find((a) => a.palavras.test(texto)) || null;
}

/**
 * A resposta sobre permissão para o perfil de quem pergunta, ou `null`:
 * `{ answer, acao }` (`acao`: o código de ACOES_DA_AYA para o botão "Abrir").
 */
export function explicarPermissao(pergunta, perfil) {
  const achada = acaoDaPergunta(pergunta);
  if (!achada) return null;
  const quemPode = `Para ${achada.nome} é preciso ${achada.quem}.`;
  // Sem o perfil, a base de verbetes responde "quem pode" melhor.
  if (!perfil) return null;
  const nomeDoPerfil = roleLabel(perfil);
  if (achada.pode(perfil))
    return {
      answer: `Seu perfil (${nomeDoPerfil}) pode ${achada.nome}. ${achada.onde} Se mesmo assim não aparecer, confira a área escolhida no menu e o edital selecionado; se continuar, abra um chamado.`,
      acao: achada.abrir,
    };
  return {
    answer: `O botão não aparece para você porque seu perfil (${nomeDoPerfil}) não tem permissão para ${achada.nome}. ${quemPode} Quem libera é o administrador de acessos da sua coordenação, em Configurações › Acessos.`,
    acao: "",
    oferecerChamado: false,
  };
}
