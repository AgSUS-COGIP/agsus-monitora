/*
  PERMISSÃO POR MÓDULO — o vocabulário, e a ponte a partir dos quatro perfis.

  Até aqui o acesso era UM perfil global por pessoa: `usuario`, `edital_gestor`,
  `contratador`, `admin` (ver `perfis-de-acesso.js`). Quem era `contratador` era
  contratador em tudo. O pedido é o modelo que o painel de RH já usa: cada
  pessoa com um nível em CADA módulo, escolhido caso a caso.

  DUAS COISAS QUE ESTA MUDANÇA TEM DE RESPEITAR

  1. O BANCO É QUEM DECIDE. Este ficheiro serve para a interface não oferecer o
     que o Postgres vai recusar — nunca para autorizar. A migration
     `20260922160000_permissoes_por_modulo.sql` aplica a mesma tabela do lado de
     lá, e é a dela que vale. Se uma das duas mudar, a outra muda junto.

  2. NO DIA DA MIGRAÇÃO, NINGUÉM GANHA NEM PERDE ACESSO. `matrizDoPerfil` é a
     tradução fiel do que os quatro perfis já concedem hoje. A migration semeia
     a tabela com exatamente esta matriz; só depois disso é que faz sentido
     editar célula a célula. Semear com qualquer outra coisa — mesmo "mais
     seguro" — tiraria acesso de quem trabalha, e semear largo daria acesso a
     quem não tinha.

  O QUE ENCONTREI AO LIGAR ISTO, E QUE MUDA O PLANO

  `perfis-de-acesso.js` diz-se "a fonte de verdade do frontend", e exporta
  `podeGerirEditais`, `podeAlterarListaAprovados` e `podeConfigurar`. Nenhuma
  das três é chamada em lado nenhum: o único ficheiro que importa esse módulo é
  `schemas.js`, para validar. Quem barra de facto são os booleanos `p_admin` e
  `p_config` lidos à mão em `legacy-app.js`, `access-dashboard.js` e
  `rpc-contrato.js`.

  Por isso a semente abaixo copia o que o BANCO concede (as colunas `p_*`), não
  o que aquelas funções prometem. As duas linhas em que elas divergem do banco
  — editais e lista de aprovados — estão marcadas, porque são exatamente as que
  precisam de confirmação antes de virarem regra.
*/

/*
  Os sete módulos. `pagina` é o id da secção no `index.html`, que continua em
  inglês por ser anterior a isto; manter os dois lado a lado evita uma camada de
  tradução que ninguém ia lembrar de atualizar.
*/
export const MODULOS = Object.freeze([
  {
    id: "dashboard",
    pagina: "page-dashboard",
    rotulo: "Visão geral",
    descricao: "Indicadores, filtros e o mapa nacional de DSEIs e CASAIs.",
  },
  {
    id: "analises",
    pagina: null,
    rotulo: "Análises",
    descricao: "Página de análises (analises.html).",
  },
  {
    id: "nucleo",
    pagina: "page-nucleo",
    rotulo: "Equipe Núcleo",
    descricao: "Quadro da equipe do núcleo.",
  },
  {
    id: "calendario",
    pagina: "page-calendario",
    rotulo: "Calendário",
    descricao: "Calendário de editais e processos seletivos.",
  },
  {
    id: "aprovados",
    pagina: "page-approved",
    rotulo: "Lista de aprovados",
    descricao: "Candidatos aprovados e o seu status de contratação.",
  },
  {
    id: "paineis",
    pagina: "page-external",
    rotulo: "Painéis externos",
    descricao: "Painéis incorporados de outras fontes.",
  },
  {
    id: "configuracoes",
    pagina: "page-config",
    rotulo: "Configurações",
    descricao: "Acessos, identidade visual, painéis e parâmetros técnicos.",
  },
]);

export const MODULOS_VALIDOS = Object.freeze(MODULOS.map((m) => m.id));

/*
  Quatro níveis, na ordem em que crescem. `sem_acesso` é o fundo e é o padrão de
  tudo o que não se conhece: um módulo novo, um valor escrito errado, uma pessoa
  sem linha na tabela. O padrão de um sistema de permissão erra para o lado de
  não deixar entrar.
*/
export const NIVEIS = Object.freeze([
  {
    valor: "sem_acesso",
    rotulo: "Sem acesso",
    descricao: "Não vê o módulo.",
  },
  {
    valor: "leitor",
    rotulo: "Leitor",
    descricao: "Vê o módulo. Não altera nada.",
  },
  {
    valor: "editor",
    rotulo: "Editor",
    descricao: "Vê e altera os dados do módulo.",
  },
  {
    valor: "admin",
    rotulo: "Administrador",
    descricao: "Altera os dados e a configuração do módulo.",
  },
]);

export const NIVEIS_VALIDOS = Object.freeze(NIVEIS.map((n) => n.valor));

export const NIVEL_PADRAO = "sem_acesso";

const FORCA = Object.freeze({
  sem_acesso: 0,
  leitor: 1,
  editor: 2,
  admin: 3,
});

export function forcaDoNivel(nivel) {
  return FORCA[normalizarNivel(nivel)];
}

/*
  Aceita o que vier e devolve sempre um dos quatro. O `trim`/`toLowerCase` é
  para o valor que chega do banco ou de um formulário; o resto cai no padrão.
*/
export function normalizarNivel(valor) {
  const bruto = String(valor ?? "")
    .trim()
    .toLowerCase();
  return NIVEIS_VALIDOS.includes(bruto) ? bruto : NIVEL_PADRAO;
}

export function rotuloDoNivel(valor) {
  const nivel = normalizarNivel(valor);
  return NIVEIS.find((n) => n.valor === nivel)?.rotulo ?? "";
}

export function moduloValido(id) {
  return MODULOS_VALIDOS.includes(String(id ?? ""));
}

export function rotuloDoModulo(id) {
  return MODULOS.find((m) => m.id === String(id ?? ""))?.rotulo ?? "";
}

/*
  A SEMENTE — o que os quatro perfis concedem hoje, escrito como matriz.

  Lido das colunas que a migration `20260915150000_lista_aprovados_e_perfis.sql`
  grava em `perfis_usuarios`:

      p_ind, p_cores, p_paineis = true  para todos os perfis
      p_config, p_admin         = true  só para admin

  Ou seja: quem tem perfil vê tudo, e só o admin entra em Configurações. É isso
  que as três primeiras colunas abaixo dizem.

  AS DUAS CÉLULAS EM QUE O CÓDIGO PROMETE MAIS DO QUE O BANCO CONCEDE

  `podeGerirEditais` (edital_gestor, contratador, admin) e
  `podeAlterarListaAprovados` (contratador, admin) descrevem escrita que o banco
  não distingue por coluna `p_*` — e que, como nenhuma das duas é chamada, hoje
  não barra nada no ecrã. Estão aqui como `editor` porque é a intenção escrita e
  revista em `perfis-de-acesso.js`, e porque um `contratador` que não consiga
  mexer na lista de aprovados fica impedido de trabalhar.

  São as duas únicas células desta tabela que não são cópia do banco. Se a
  intenção não for essa, muda-se aqui e na migration, antes de semear.
*/
const SEMENTE = Object.freeze({
  usuario: {
    dashboard: "leitor",
    analises: "leitor",
    nucleo: "leitor",
    calendario: "leitor",
    aprovados: "leitor",
    paineis: "leitor",
    configuracoes: "sem_acesso",
  },
  edital_gestor: {
    dashboard: "leitor",
    analises: "leitor",
    nucleo: "leitor",
    calendario: "editor", // cadastra edital e anexa a planilha
    aprovados: "leitor",
    paineis: "leitor",
    configuracoes: "sem_acesso",
  },
  contratador: {
    dashboard: "leitor",
    analises: "leitor",
    nucleo: "leitor",
    calendario: "editor", // tudo do gestor
    aprovados: "editor", // mais o status da lista de aprovados
    paineis: "leitor",
    configuracoes: "sem_acesso",
  },
  admin: {
    dashboard: "admin",
    analises: "admin",
    nucleo: "admin",
    calendario: "admin",
    aprovados: "admin",
    paineis: "admin",
    configuracoes: "admin",
  },
});

/*
  A matriz de um perfil. Perfil desconhecido ou vazio devolve tudo `sem_acesso`:
  sem perfil não há acesso, que é a regra que `normalizarPerfil` já estabelece
  ao distinguir "" de `usuario`.
*/
export function matrizDoPerfil(perfil) {
  const chave = String(perfil ?? "")
    .trim()
    .toLowerCase();
  const base = SEMENTE[chave];
  const saida = {};
  for (const modulo of MODULOS_VALIDOS) {
    saida[modulo] = base ? base[modulo] : NIVEL_PADRAO;
  }
  return saida;
}

/*
  O nível de uma pessoa num módulo.

  `matriz` são as linhas gravadas na tabela nova. Quando o módulo não tem linha
  — pessoa antiga, módulo recém-criado, linha apagada — cai para o que o perfil
  concederia. A alternativa seria devolver `sem_acesso`, e aí acrescentar um
  módulo ao sistema trancava toda a gente fora dele no mesmo instante.
*/
export function nivelNoModulo(matriz, modulo, perfilDeFallback = "") {
  if (!moduloValido(modulo)) return NIVEL_PADRAO;
  const gravado = matriz?.[modulo];
  if (
    gravado != null &&
    NIVEIS_VALIDOS.includes(String(gravado).toLowerCase())
  ) {
    return normalizarNivel(gravado);
  }
  return matrizDoPerfil(perfilDeFallback)[modulo];
}

export function podeLer(nivel) {
  return forcaDoNivel(nivel) >= FORCA.leitor;
}

export function podeEditar(nivel) {
  return forcaDoNivel(nivel) >= FORCA.editor;
}

export function podeAdministrar(nivel) {
  return forcaDoNivel(nivel) >= FORCA.admin;
}

/*
  O que muda entre a matriz que está no ecrã e a que foi carregada. Serve à tela
  de administração: mostrar as alterações antes de gravar, e gravar só o que
  mudou em vez de reescrever 7 linhas por pessoa a cada clique.
*/
export function diferencaDeMatrizes(antes, depois) {
  const mudancas = [];
  for (const modulo of MODULOS_VALIDOS) {
    const de = normalizarNivel(antes?.[modulo]);
    const para = normalizarNivel(depois?.[modulo]);
    if (de !== para) mudancas.push({ modulo, de, para });
  }
  return mudancas;
}
