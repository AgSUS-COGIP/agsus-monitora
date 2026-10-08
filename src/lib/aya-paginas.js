/*
  O que a Aya diz em cada página, sem DOM nem rede.

  A interface do MONITORA não tem texto explicativo: quem explica é a Aya. Por
  isso cada página do menu (e cada seção de Configurações) tem aqui:

  - `nome`: como a Aya chama a página;
  - `intro`: a primeira mensagem do painel, do que ela pode explicar ali — muda
    com a área atual (a Visão geral de Projetos fala do mapa dos projetos; a da
    SEDE não tem mapa);
  - `sugestoes`: 3 a 5 perguntas típicas da página (o painel não mostra mais
    os botões, pedido de 02/10; ficam como garantia de cobertura da base). O
    `rotulo` é o texto curto; a `pergunta` é o que vai para a Aya. Toda pergunta daqui tem resposta
    direta num verbete de `docs/aya/` (teste em tests/aya-paginas.test.js), para
    a sugestão nunca cair no "não sei".

  As views são as do legado (`currentView`: `dashboard`, `nucleo`…), na ordem
  do menu (`ABAS_DO_MENU` em menu-lateral.js); as seções, as de
  `src/modulos/configuracoes/secoes.js`.

  `ACOES_DA_AYA` são os botões que uma resposta pode trazer ("Abrir Recursos",
  "Ir para Configurações › Acessos"). Só navegam dentro do app — nunca abrem
  endereço externo. O código vem do campo `abrir` do verbete.
*/

const AREA_SAUDE_INDIGENA = "saude-indigena";

const sug = (rotulo, pergunta) => Object.freeze({ rotulo, pergunta });

const SEGUNDA_MENSAGEM = "Para começar, digite sua pergunta.";

export { SEGUNDA_MENSAGEM };

function sugestoesDaVisaoGeral(area) {
  const base = [
    sug("Indicadores", "De onde vêm os KPIs da Visão geral?"),
    sug("Filtros", "Como funcionam os filtros da Visão geral?"),
    sug("Tabela de processos", "Como leio a tabela de processos?"),
  ];
  if (area === AREA_SAUDE_INDIGENA) {
    base.push(
      sug("Coordenadas do mapa", "De onde vêm as coordenadas do mapa?"),
    );
  } else if (area === "projetos") {
    base.push(
      sug("Mapa dos projetos", "De onde vêm os pontos do mapa de Projetos?"),
    );
  }
  base.push(sug("Áreas", "O que muda entre as áreas do sistema?"));
  return base;
}

function introDaVisaoGeral(area, nomeDaArea) {
  if (area === AREA_SAUDE_INDIGENA)
    return "Posso explicar os indicadores, os filtros, o mapa dos DSEIs e CASAIs e de onde vêm os números da Visão geral da Saúde Indígena.";
  if (area === "projetos")
    return "Posso explicar os indicadores, os filtros e o mapa com os locais das vagas de todos os projetos, tirados dos PDFs dos editais.";
  if (area === "sede")
    return "Posso explicar os indicadores, os filtros e a tabela de processos da Visão geral da SEDE.";
  return `Posso explicar os indicadores, os filtros e a tabela de processos da Visão geral${nomeDaArea ? ` de ${nomeDaArea}` : ""}.`;
}

const PAGINAS = Object.freeze({
  dashboard: {
    nome: "Visão geral",
    intro: introDaVisaoGeral,
    sugestoes: sugestoesDaVisaoGeral,
  },
  nucleo: {
    nome: "Editais",
    intro: () =>
      "Posso explicar como o status do edital é calculado, o cronograma, os anexos em PDF e o quadro de vagas.",
    sugestoes: () => [
      sug("Status do edital", "Como o status do edital é calculado?"),
      sug(
        "Anexos do PDF",
        "Como importar o cronograma e o quadro de vagas do PDF?",
      ),
      sug("Vagas imediatas", "De onde vêm as vagas imediatas?"),
      sug("Mudar de área", "Como mover um edital de área?"),
    ],
  },
  calendario: {
    nome: "Cronograma",
    intro: () =>
      "Posso explicar o que o Cronograma mostra e de onde vêm as datas das etapas.",
    sugestoes: () => [
      sug("O que aparece", "O que o Cronograma mostra?"),
      sug("Quem altera", "Quem pode alterar as etapas do cronograma?"),
      sug("Status do edital", "Como o status do edital é calculado?"),
    ],
  },
  analises: {
    nome: "Painel das análises",
    intro: () =>
      "Posso explicar o escopo, as pendências e como as análises chegam das planilhas.",
    sugestoes: () => [
      sug("Escopo", "O que é o escopo Ativo, Inativo e Todos?"),
      sug("Pendências", "Quais são as pendências das análises curriculares?"),
      sug("Atualização", "Como as análises curriculares são atualizadas?"),
      sug(
        "Painel × Avaliação",
        "Qual a diferença entre o Painel das análises e a Avaliação documental?",
      ),
    ],
  },
  "avaliacao-documental": {
    nome: "Avaliação documental",
    intro: () =>
      "Posso explicar a regra da avaliação do edital, as versões, os modelos, a prévia e a equipe.",
    sugestoes: () => [
      sug("Regra", "Como funciona a regra da avaliação documental?"),
      sug("Modelos", "Quais são os modelos da regra da avaliação?"),
      sug("Equipe", "Quem pode entrar na equipe da avaliação documental?"),
      sug("Prévia", "Como testar a regra com um candidato fictício?"),
      sug(
        "Painel × Avaliação",
        "Qual a diferença entre o Painel das análises e a Avaliação documental?",
      ),
    ],
  },
  recursos: {
    nome: "Recursos",
    intro: () =>
      "Posso explicar o fluxo do parecer jurídico, os prazos e os indicadores desta tela.",
    sugestoes: () => [
      sug("Quem decide", "Quem pode decidir um recurso?"),
      sug("Fluxo do parecer", "Como funciona o fluxo do parecer jurídico?"),
      sug("Prazo", "De onde vem o prazo do recurso?"),
      sug("Indicadores", "Quais são os indicadores dos recursos?"),
      sug("Resposta enviada", "Quem marca a resposta como enviada?"),
    ],
  },
  entrevistas: {
    nome: "Painel de entrevistas",
    intro: () =>
      "Posso explicar o andamento por vaga, as pendências, os empates e de onde vêm os números.",
    sugestoes: () => [
      sug("Painel", "Para que serve o Painel de entrevistas?"),
      sug("Andamento", "Como é contado o andamento por vaga?"),
      sug("Empate", "Quem desempata a nota da entrevista?"),
      sug("Pendências", "Quais são as pendências das entrevistas?"),
      sug("Carga", "Quando as entrevistas são atualizadas?"),
    ],
  },
  "conduzir-entrevistas": {
    nome: "Conduzir entrevistas",
    intro: () =>
      "Posso explicar a fila do dia, a ficha de notas, o Preparar (configuração e convocação) e os roteiros.",
    sugestoes: () => [
      sug("Fila do dia", "Como funciona a fila de Conduzir entrevistas?"),
      sug(
        "Edital não aparece",
        "Por que um edital não aparece em Conduzir entrevistas?",
      ),
      sug("Ficha de notas", "Como lançar notas da entrevista?"),
      sug("Convocação", "Como funciona a regra de convocação da entrevista?"),
      sug("Roteiros", "Onde ficam os roteiros de entrevista?"),
    ],
  },
  classificacao: {
    nome: "Classificação",
    intro: () =>
      "Posso explicar a regra de classificação do edital, os critérios de desempate, o empate final, as listas e a exportação.",
    sugestoes: () => [
      sug(
        "Regra do edital",
        "Como funciona a regra de classificação do edital?",
      ),
      sug("Desempate", "Como funcionam os critérios de desempate?"),
      sug("Empate final", "Como funciona o empate final e o sorteio?"),
      sug("60 anos", "Como é calculado o critério de 60 anos ou mais?"),
      sug("Exportar", "Como exportar a lista de classificação?"),
    ],
  },
  approved: {
    nome: "Lista de aprovados",
    intro: () =>
      "Posso explicar os status dos candidatos, a convocação, as listas inativas e os anexos.",
    sugestoes: () => [
      sug("Lista inativa", "O que acontece com uma lista inativa?"),
      sug("Modelo de convocação", "Como funciona o modelo de convocação?"),
      sug("Anexos", "Quem pode anexar documentos ao candidato?"),
      sug("Sub judice", "Como funciona o candidato sub judice?"),
    ],
  },
  selecao: {
    nome: "Seleção",
    intro: () =>
      "Posso explicar o funil por vaga, a taxa de contratação e quando os dados são atualizados.",
    sugestoes: () => [
      sug("Funil", "Como funciona a tela de Seleção?"),
      sug("Taxa", "Como é calculada a taxa de contratação?"),
      sug("Atualização", "Quando a Seleção é atualizada?"),
      sug("Convocados", "De onde vêm os convocados para entrevista?"),
    ],
  },
});

/* As seções de Configurações (ids de modulos/configuracoes/secoes.js), na ordem do menu. */
export const SECOES_DA_AYA = Object.freeze({
  marca: Object.freeze({
    nome: "Marca",
    intro:
      "Posso explicar os nomes e a identidade que aparecem em todo o sistema e como publicar uma mudança.",
    sugestoes: [
      sug("O que define", "O que a seção Marca define?"),
      sug("Publicar", "Como publicar uma alteração nas Configurações?"),
    ],
  }),
  inicio: Object.freeze({
    nome: "Página inicial",
    intro:
      "Posso explicar o título da página inicial, o aviso global e os rótulos dos indicadores.",
    sugestoes: [
      sug("O que define", "O que a seção Página inicial define?"),
      sug("Aviso global", "Como funciona o aviso global?"),
      sug("Publicar", "Como publicar uma alteração nas Configurações?"),
    ],
  }),
  acesso: Object.freeze({
    nome: "Tela de acesso",
    intro:
      "Posso explicar a saudação, o login com Google e os domínios que podem entrar.",
    sugestoes: [
      sug("O que define", "O que a seção Tela de acesso define?"),
      sug("Domínios", "Quais domínios podem entrar?"),
      sug("Login Google", "O que acontece se desligar o login Google?"),
    ],
  }),
  aparencia: Object.freeze({
    nome: "Aparência",
    intro:
      "Posso explicar a arte de fundo, o logo e as cores, com o contraste de cada uma.",
    sugestoes: [
      sug("Arte de fundo", "Como trocar a arte de fundo da tela de acesso?"),
      sug("Logo da barra", "Como trocar a logo da barra lateral?"),
      sug("Contraste", "O que significa o contraste da cor do painel?"),
    ],
  }),
  recursos: Object.freeze({
    nome: "Painéis externos",
    intro:
      "Posso explicar os painéis externos do menu: título, endereço e situação.",
    sugestoes: [
      sug("O que são", "O que são os painéis externos?"),
      sug("Manutenção", "Como pôr um painel em manutenção?"),
    ],
  }),
  operacao: Object.freeze({
    nome: "Operação",
    intro:
      "Posso explicar a versão, a atualização em tempo real e o histórico de publicações.",
    sugestoes: [
      sug("Restaurar", "Como restaurar uma versão publicada?"),
      sug("Atualização do sistema", "Como funciona a atualização do sistema?"),
      sug("Pessoas online", "O que mostra Pessoas online?"),
    ],
  }),
  comemoracoes: Object.freeze({
    nome: "Comemorações",
    intro:
      "Posso explicar os marcos comemorados, os efeitos, como testar uma comemoração e os marcos personalizados.",
    sugestoes: [
      sug("O que são", "O que são as comemorações?"),
      sug("Testar", "Como testar uma comemoração?"),
      sug("Personalizado", "Como criar um marco personalizado?"),
    ],
  }),
  acessos: Object.freeze({
    nome: "Acessos",
    intro:
      "Posso explicar como dar acesso a alguém, os grupos de permissões, as coordenações, os pedidos e as contas desativadas.",
    sugestoes: [
      sug("Dar acesso", "Como dar acesso a alguém?"),
      sug("Grupos", "O que são os grupos de permissões?"),
      sug("Coordenações", "O que é uma coordenação nos acessos?"),
      sug("Pedidos", "Como funcionam os pedidos de acesso?"),
      sug("Conta desativada", "Como reativar uma conta desativada?"),
    ],
  }),
  modulos: Object.freeze({
    nome: "Módulos e abas",
    intro:
      "Posso explicar como ativar, desativar ou pôr em manutenção o sistema, as áreas, as abas e os painéis, e o selo BETA.",
    sugestoes: [
      sug("Manutenção", "O que acontece quando uma aba fica em manutenção?"),
      sug("Selo BETA", "O que é o selo BETA?"),
      sug("Área desativada", "O que acontece quando uma área é desativada?"),
    ],
  }),
  cargas: Object.freeze({
    nome: "Status das atualizações",
    intro:
      "Posso explicar quando roda cada atualização de dados e o que conta como atraso ou falha.",
    sugestoes: [
      sug("O que é", "O que é o Status das atualizações?"),
      sug("Horários", "Quando cada atualização de dados roda?"),
    ],
  }),
  mensagens: Object.freeze({
    nome: "Mensagens (chat)",
    intro:
      "Posso explicar o prazo de retenção das mensagens do chat, o Zerar mensagens e o histórico das limpezas.",
    sugestoes: [
      sug("Prazo", "Como funciona o prazo de retenção das mensagens?"),
      sug("Zerar", "O que o Zerar mensagens apaga?"),
    ],
  }),
});

const GENERICA = Object.freeze({
  nome: "MONITORA",
  intro:
    "Posso explicar as telas do MONITORA, as regras de cada etapa do processo seletivo e o que estiver carregado aqui.",
  sugestoes: [
    sug("O que a Aya faz", "O que você consegue fazer?"),
    sug("Áreas", "O que muda entre as áreas do sistema?"),
    sug("Menu", "Qual é a ordem do menu?"),
  ],
});

/* Os botões de navegação que um verbete pode oferecer (campo `abrir`). */
export const ACOES_DA_AYA = Object.freeze({
  dashboard: Object.freeze({ rotulo: "Abrir Visão geral", view: "dashboard" }),
  nucleo: Object.freeze({ rotulo: "Abrir Editais", view: "nucleo" }),
  calendario: Object.freeze({ rotulo: "Abrir Cronograma", view: "calendario" }),
  analises: Object.freeze({
    rotulo: "Abrir Painel das análises",
    view: "analises",
  }),
  "avaliacao-documental": Object.freeze({
    rotulo: "Abrir Avaliação documental",
    view: "avaliacao-documental",
  }),
  recursos: Object.freeze({ rotulo: "Abrir Recursos", view: "recursos" }),
  entrevistas: Object.freeze({
    rotulo: "Abrir Painel de entrevistas",
    view: "entrevistas",
  }),
  "conduzir-entrevistas": Object.freeze({
    rotulo: "Abrir Conduzir entrevistas",
    view: "conduzir-entrevistas",
  }),
  classificacao: Object.freeze({
    rotulo: "Abrir Classificação",
    view: "classificacao",
  }),
  approved: Object.freeze({
    rotulo: "Abrir Lista de aprovados",
    view: "approved",
  }),
  selecao: Object.freeze({ rotulo: "Abrir Seleção", view: "selecao" }),
  ...Object.fromEntries(
    Object.entries(SECOES_DA_AYA).map(([id, secao]) => [
      `config:${id}`,
      Object.freeze({
        rotulo: `Ir para Configurações › ${secao.nome}`,
        view: "config",
        secao: id,
      }),
    ]),
  ),
});

/** A ação de navegação de um código (`recursos`, `config:acessos`) ou `null`. */
export function acaoDaAya(codigo) {
  const chave = String(codigo || "").trim();
  return Object.hasOwn(ACOES_DA_AYA, chave) ? ACOES_DA_AYA[chave] : null;
}

/** As views que têm página própria na Aya (as do menu), na ordem do menu. */
export const VIEWS_DA_AYA = Object.freeze(Object.keys(PAGINAS));

/*
  A página da Aya para o que está aberto: a view do legado, o título do
  cabeçalho, a área atual e, em Configurações, a seção aberta. Devolve o nome
  (com a área, quando a página é recortada por ela), a primeira mensagem e as
  sugestões. View sem página própria (painel externo, "sem acesso") recebe a
  genérica, com o título do cabeçalho no nome.
*/
export function paginaDaAya({
  view = "",
  titulo = "",
  area = "",
  nomeDaArea = "",
  secao = "",
} = {}) {
  const chave = String(view || "").trim();
  if (chave === "config") {
    const s = SECOES_DA_AYA[String(secao || "").trim()];
    if (s)
      return {
        chave: `config:${secao}`,
        nome: `Configurações › ${s.nome}`,
        intro: s.intro,
        sugestoes: s.sugestoes,
      };
    return {
      chave: "config",
      nome: "Configurações",
      intro:
        "Posso explicar cada seção de Configurações e o que o seu perfil pode alterar.",
      sugestoes: [
        sug("Publicar", "Como publicar uma alteração nas Configurações?"),
        sug("Dar acesso", "Como dar acesso a alguém?"),
      ],
    };
  }
  const pagina = PAGINAS[chave];
  if (!pagina) {
    const nome = String(titulo || "").trim() || GENERICA.nome;
    return {
      chave: "generica",
      nome,
      intro: GENERICA.intro,
      sugestoes: GENERICA.sugestoes,
    };
  }
  return {
    chave,
    nome: nomeDaArea ? `${pagina.nome} · ${nomeDaArea}` : pagina.nome,
    intro: pagina.intro(area, nomeDaArea),
    sugestoes: pagina.sugestoes(area),
  };
}

/*
  A resposta em blocos seguros para desenhar (parágrafos e listas), sem HTML:
  linhas "- x" ou "• x" viram lista; "1. x", lista numerada; linha em branco
  separa parágrafos. O componente desenha cada bloco como elementos com texto.
*/
export function blocosDoTexto(texto) {
  const blocos = [];
  let atual = null;
  const fechar = () => {
    if (atual) blocos.push(atual);
    atual = null;
  };
  for (const linhaBruta of String(texto || "").split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha) {
      fechar();
      continue;
    }
    const item = linha.match(/^[-•*]\s+(.+)$/);
    const numerado = linha.match(/^\d+[.)]\s+(.+)$/);
    const tipo = item ? "lista" : numerado ? "numerada" : "paragrafo";
    const conteudo = item?.[1] ?? numerado?.[1] ?? linha;
    if (atual && atual.tipo === tipo && tipo !== "paragrafo") {
      atual.itens.push(conteudo);
      continue;
    }
    if (atual && atual.tipo === "paragrafo" && tipo === "paragrafo") {
      atual.itens.push(conteudo);
      continue;
    }
    fechar();
    atual = { tipo, itens: [conteudo] };
  }
  fechar();
  return blocos.map((bloco) =>
    bloco.tipo === "paragrafo"
      ? { tipo: "paragrafo", itens: [bloco.itens.join(" ")] }
      : bloco,
  );
}

/*
  A revelação aos poucos ("digitando") da resposta já recebida: a IA da Aya
  não manda o texto em partes, então o painel mostra o texto inteiro em
  passos. Devolve quantos caracteres mostrar no instante `decorrido` (ms),
  com a mesma duração de antes (18 ms por caractere, de 650 ms a 3,4 s).
*/
export function duracaoDaRevelacao(texto) {
  const tamanho = String(texto || "").trim().length;
  if (!tamanho) return 0;
  return Math.min(3400, Math.max(650, tamanho * 18));
}

export function caracteresRevelados(texto, decorrido) {
  const total = String(texto || "").length;
  const duracao = duracaoDaRevelacao(texto);
  if (!duracao || decorrido >= duracao) return total;
  return Math.max(1, Math.ceil(total * (Math.max(0, decorrido) / duracao)));
}
