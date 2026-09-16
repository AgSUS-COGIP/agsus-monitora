/*
  Perfis de acesso do Monitora — a fonte de verdade do frontend.

  Antes existiam dois vocabulários a competir. O banco guardava `master`,
  `editor` e `leitor`; a interface de Configurações > Acesso oferecia `leitor`,
  `editor` e `admin` — e `master`, o perfil que de facto mandava, nem aparecia
  na lista, só era filtrado para fora dela. Quem abria a aba via três opções que
  não eram as três do banco, e cinco caixas de permissão (`p_ind`, `p_cores`,
  `p_paineis`, `p_config`, `p_admin`) que podiam contradizer o perfil escolhido
  ao lado.

  Agora há quatro perfis e o perfil é a única coisa que se escolhe. As
  permissões deixam de ser marcadas à mão: derivam do perfil, aqui e no banco,
  pela mesma tabela (ver `permissoesDoPerfil`). A migration
  `20260915150000_lista_aprovados_e_perfis.sql` aplica exatamente estas regras
  do lado do PostgreSQL, que é quem realmente decide — o que está neste ficheiro
  serve para a interface não oferecer o que o banco vai recusar.

  As quatro regras, como foram pedidas:

  - usuario        vê tudo, não altera nada.
  - edital_gestor  vê tudo, cadastra editais e anexa a planilha.
  - contratador    tudo do gestor, mais mudar o status da lista de aprovados.
  - admin          tudo, e é o único que vê a aba de Configurações.
*/

export const PERFIL_PADRAO = "usuario";

/** @typedef {"usuario"|"edital_gestor"|"contratador"|"admin"} PerfilDeAcesso */

export const PERFIS_DE_ACESSO = [
  {
    valor: "usuario",
    rotulo: "Usuário",
    descricao: "Vê todos os módulos e painéis. Não altera nada.",
  },
  {
    valor: "edital_gestor",
    rotulo: "Gestor de edital",
    descricao: "Vê tudo, cadastra editais e anexa a planilha (XLSX).",
  },
  {
    valor: "contratador",
    rotulo: "Contratador",
    descricao:
      "Cadastra editais, anexa a planilha e altera o status da lista de aprovados.",
  },
  {
    valor: "admin",
    rotulo: "Admin",
    descricao: "Faz tudo e é o único perfil que acessa as Configurações.",
  },
];

export const PERFIS_VALIDOS = PERFIS_DE_ACESSO.map((perfil) => perfil.valor);

/*
  Perfis antigos ainda chegam: de linhas gravadas antes da migration, de uma
  sessão que ficou aberta, do caminho de compatibilidade `meu_usuario`. Traduzir
  em vez de rejeitar evita que um `master` legítimo caia para `usuario` e perca
  o acesso às Configurações no meio de uma sessão.
*/
const PERFIS_LEGADOS = {
  master: "admin",
  administrador: "admin",
  editor: "edital_gestor",
  gestor: "edital_gestor",
  leitor: "usuario",
  visualizador: "usuario",
};

/**
 * Converte qualquer valor de perfil no vocabulário atual.
 * Devolve "" quando não há perfil — que não é o mesmo que ser `usuario`:
 * sem perfil não há acesso nenhum.
 * @returns {PerfilDeAcesso|""}
 */
export function normalizarPerfil(valor) {
  const bruto = String(valor ?? "")
    .trim()
    .toLowerCase();
  if (!bruto) return "";
  if (PERFIS_VALIDOS.includes(bruto))
    return /** @type {PerfilDeAcesso} */ (bruto);
  return PERFIS_LEGADOS[bruto] || PERFIL_PADRAO;
}

/** Perfil pronto para gravar: nunca vazio. */
export function perfilParaGravar(valor) {
  return normalizarPerfil(valor) || PERFIL_PADRAO;
}

export function rotuloDoPerfil(valor) {
  const perfil = normalizarPerfil(valor);
  return PERFIS_DE_ACESSO.find((item) => item.valor === perfil)?.rotulo || "";
}

export function descricaoDoPerfil(valor) {
  const perfil = normalizarPerfil(valor);
  return (
    PERFIS_DE_ACESSO.find((item) => item.valor === perfil)?.descricao || ""
  );
}

export function ehAdmin(valor) {
  return normalizarPerfil(valor) === "admin";
}

/** Cadastrar editais e anexar a planilha. */
export function podeGerirEditais(valor) {
  return ["edital_gestor", "contratador", "admin"].includes(
    normalizarPerfil(valor),
  );
}

/** Mesma fronteira de `podeGerirEditais`, nomeada pelo que a pessoa faz. */
export function podeAnexarPlanilha(valor) {
  return podeGerirEditais(valor);
}

/** Alterar o status de um candidato na lista de aprovados. */
export function podeAlterarListaAprovados(valor) {
  return ["contratador", "admin"].includes(normalizarPerfil(valor));
}

/** Abrir a aba de Configurações. */
export function podeConfigurar(valor) {
  return ehAdmin(valor);
}

/** Qualquer escrita. `usuario` é o único perfil sem nenhuma. */
export function podeAlterarAlgumaCoisa(valor) {
  const perfil = normalizarPerfil(valor);
  return perfil !== "" && perfil !== "usuario";
}

/*
  As colunas `p_*` de `perfis_usuarios` continuam a existir e continuam a ser
  lidas — por telas antigas, pelo caminho de compatibilidade e pelo RLS. Deixam
  apenas de ser editáveis: passam a ser um reflexo do perfil. Esta função é a
  cópia fiel do `case` que a migration aplica no banco; se uma das duas mudar,
  a outra tem de mudar junto.
*/
export function permissoesDoPerfil(valor) {
  const admin = ehAdmin(valor);
  return {
    p_ind: true,
    p_cores: true,
    p_paineis: true,
    p_config: admin,
    p_admin: admin,
  };
}
