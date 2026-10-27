/*
  Tipos de Configurações › Acessos e das regras de permissão (perfil, grupo,
  coordenação, matriz, teto, contas desativadas). Só tipos: as regras ficam em
  access-roles.ts, permissoes-recursos.ts, matriz-de-acessos.ts,
  teto-de-acessos.ts, grupos-e-coordenacoes.ts, ver-como.ts,
  contas-desativadas.ts, convite-de-acesso.ts e acesso-liberado.ts.

  As formas das linhas são as das RPCs (obter_contexto_monitora,
  obter_matriz_acessos, listar_contas_desativadas); o banco manda mais campos,
  aqui estão os que o front lê.
*/

// ── Níveis, papéis e recursos ────────────────────────────────────────────────

/** Nível de acesso numa célula da matriz (o mesmo do banco). */
export type NivelDeAcesso = "sem_acesso" | "leitor" | "editor" | "admin";

/** Papel (perfil antigo, antes da matriz). "leitor", "editor" e "master" são apelidos. */
export type PapelDeAcesso =
  "usuario" | "edital_gestor" | "contratador" | "admin";

/** Opção de papel para seleção: { value, label }. */
export type OpcaoDePapel = Readonly<{ value: PapelDeAcesso; label: string }>;

/** Módulos da matriz (as colunas de módulo). */
export type ModuloDeAcesso =
  | "dashboard"
  | "analises"
  | "avaliacao_documental"
  | "nucleo"
  | "calendario"
  | "aprovados"
  | "aprovados_pendencias"
  | "entrevistas"
  | "classificacao"
  | "recursos"
  | "recursos_parecer"
  | "selecao"
  | "importacao"
  | "paineis"
  | "configuracoes"
  | "acessos";

/** "area" (area:<código>), "painel" (painel:<id>) ou "modulo". */
export type TipoDeRecurso = "modulo" | "area" | "painel";

/** [nível, rótulo], como em LEVELS e NIVEIS_DE_AREA. */
export type OpcaoDeNivel = readonly [NivelDeAcesso, string];

/** [módulo, rótulo], como em RESOURCES. */
export type RecursoDoCatalogo = readonly [ModuloDeAcesso, string];

/** Nível por recurso (módulo, area:<id> ou painel:<id>). */
export type NiveisPorRecurso = Readonly<Partial<Record<string, NivelDeAcesso>>>;

/** Revisão (trava otimista) que o banco devolve e confere no salvar. */
export type RevisaoDoBanco = number | string | null;

// ── Perfil de quem está logado (obter_contexto_monitora) ──────────────────────

export type GrupoDoPerfil = Readonly<{
  codigo?: string | null;
  nome?: string | null;
}>;

export type CoordenacaoDoPerfil = Readonly<{
  codigo: string;
  nome: string;
  area: string | null;
}>;

/**
 * O `profile` do contexto. Sem `permissoes` (contexto antigo), valem o papel
 * (`perfil`/`role`) e as flags `p_*`.
 */
export type PerfilDeAcesso = {
  id?: string | null;
  user_id?: string | null;
  userId?: string | null;
  email?: string | null;
  nome?: string | null;
  ativo?: boolean;
  perfil?: string | null;
  role?: string | null;
  grupo?: GrupoDoPerfil | null;
  admin_global?: boolean;
  permissoes?: NiveisPorRecurso | null;
  coordenacao?: CoordenacaoDoPerfil | null;
  areas?: readonly string[] | null;
};

/** Quem comparar em isOwnAccessProfile: usuário do auth ou linha de perfil. */
export type ContaParaComparar = {
  id?: string | null;
  user_id?: string | null;
  userId?: string | null;
  email?: string | null;
};

/** Páginas que o perfil abre (paginasPermitidas). */
export type PaginasPermitidas = {
  dashboard: boolean;
  nucleo: boolean;
  calendario: boolean;
  approved: boolean;
  analises: boolean;
  "avaliacao-documental": boolean;
  entrevistas: boolean;
  "conduzir-entrevistas": boolean;
  classificacao: boolean;
  recursos: boolean;
  "analisar-recursos": boolean;
  selecao: boolean;
  config: boolean;
};

/** Chaves antigas do legado (permissaoLegada). */
export type PermissaoLegada =
  "ind" | "analises" | "cores" | "calendario" | "paineis" | "config" | "admin";

/** Painel externo cadastrado (Configurações › Painéis externos). */
export type PainelExterno = {
  id: string | number;
  ativo?: boolean;
  ordem?: number | string | null;
  codigo?: string | null;
  titulo?: string | null;
};

/** Seção de Configurações que entra no menu. */
export type SecaoDeConfiguracaoDoMenu = {
  id: string;
  rotulo: string;
  iconeDoMenu?: string;
};

// ── Matriz de acessos (obter_matriz_acessos) ─────────────────────────────────

export type OrigemDaCelula = "grupo" | "excecao";

/** Uma célula da matriz como o banco manda. */
export type CelulaDaMatriz = {
  nivel: NivelDeAcesso;
  origem: OrigemDaCelula;
  nivel_grupo: NivelDeAcesso;
  revisao?: RevisaoDoBanco;
};

/** Uma pessoa na matriz. */
export type UsuarioDaMatriz = {
  id: string;
  nome?: string | null;
  email?: string | null;
  grupo?: string | null;
  coordenacao?: string | null;
  revisao_conta?: RevisaoDoBanco;
  permissoes?: Readonly<Partial<Record<string, CelulaDaMatriz>>> | null;
  admin_global?: boolean;
  ativo?: boolean;
  areas_efetivas?: string[] | null;
  convite_pendente?: boolean | null;
  ultimo_acesso?: string | null;
};

/** Grupo de acesso (níveis por módulo). */
export type GrupoDeAcesso = {
  codigo: string;
  nome: string;
  descricao?: string | null;
  revisao?: RevisaoDoBanco;
  sistema?: boolean;
  admin_global?: boolean;
  niveis?: NiveisPorRecurso | null;
};

/** Área do sistema (saude-indigena, sede, projetos). */
export type AreaDeAcesso = { id: string; titulo?: string };

/** Coordenação: recorte de uma área (responsável, unidades, editais). */
export type CoordenacaoDeAcesso = {
  codigo: string;
  nome: string;
  area: string;
  responsavel?: string | null;
  unidades?: string[] | null;
  editais?: (string | number)[] | null;
  ativo?: boolean;
  revisao?: RevisaoDoBanco;
};

/**
 * O teto de quem está logado. Admin global: sem teto. Coordenador: a própria
 * coordenação, os próprios níveis e os painéis que vê.
 */
export type TetoDeAcessos = {
  admin_global?: boolean;
  usuario_id?: string | null;
  coordenacao?: string | null;
  niveis?: NiveisPorRecurso | null;
  paineis?: readonly string[] | null;
};

/** O retorno de obter_matriz_acessos (os campos que as regras leem). */
export type MatrizDeAcessos = {
  usuarios?: UsuarioDaMatriz[];
  grupos?: GrupoDeAcesso[];
  areas?: AreaDeAcesso[];
  coordenacoes?: CoordenacaoDeAcesso[];
  paineis?: PainelExterno[];
  teto?: TetoDeAcessos;
  total?: number;
};

/** Coluna da tabela de usuários (módulo, área ou painel). */
export type ColunaDaMatriz = Readonly<{
  id: string;
  rotulo: string;
  tipo: TipoDeRecurso;
}>;

/** Por código do grupo. */
export type GruposPorCodigo = Readonly<Partial<Record<string, GrupoDeAcesso>>>;

// ── Rascunho da matriz ───────────────────────────────────────────────────────

/** Quem é a pessoa da alteração (guardado com ela). */
export type PessoaDoRascunho = Readonly<{
  id: string;
  nome: string;
  email: string;
}>;

/** Base lida de uma mudança de conta (grupo ou coordenação). */
export type BaseDaConta = { valor: string | null; revisao?: RevisaoDoBanco };

/** O que estava salvo quando a alteração foi feita. */
export type BaseDoAlvo =
  | (BaseDaConta & {
      nivel?: undefined;
      origem?: undefined;
      nivel_grupo?: undefined;
    })
  | (CelulaDaMatriz & { valor?: undefined });

/** `valor`: nível, `null` ("do grupo"), código do grupo ou da coordenação. */
export type EntradaDoRascunho = Readonly<{
  valor: string | null;
  base: BaseDoAlvo;
  usuario: PessoaDoRascunho;
}>;

/** chave "<usuario>/<alvo>" → alteração. */
export type RascunhoDeAcessos = Map<string, EntradaDoRascunho>;

/** O que a célula mostra (celulaExibida). */
export type CelulaExibida = {
  nivel: NivelDeAcesso;
  individual: boolean;
  nivelGrupo: NivelDeAcesso;
  pendente: boolean;
};

/** Um item de `p_alteracoes` de salvar_matriz_acessos. */
export type AlteracaoDeAcesso =
  | {
      tipo: "grupo";
      usuario_id: string;
      grupo: string | null;
      revisao: RevisaoDoBanco | undefined;
    }
  | {
      tipo: "coordenacao";
      usuario_id: string;
      coordenacao: string | null;
      revisao: RevisaoDoBanco | undefined;
    }
  | {
      tipo: "nivel";
      usuario_id: string;
      recurso: string;
      nivel: string | null;
      revisao: RevisaoDoBanco;
    };

export type ItemDoResumo = { rotulo: string; de: string; para: string | null };

export type ResumoDaPessoa = {
  usuario: PessoaDoRascunho;
  itens: ItemDoResumo[];
};

/** Alteração que saiu ao rebasear (conflito ou fora da página). */
export type AlteracaoDescartada = { usuario: PessoaDoRascunho; alvo: string };

export type RascunhoRebaseado = {
  rascunho: RascunhoDeAcessos;
  conflitos: AlteracaoDescartada[];
  foraDaLista: AlteracaoDescartada[];
};

/** Áreas na coluna "Áreas": todas (admin global) ou os ids. */
export type AreasDaLinha = { todas: boolean; ids: string[] };

// ── Teto: abas, edição e opções ──────────────────────────────────────────────

export type AbaDeAcessos = Readonly<{
  id: "usuarios" | "grupos" | "coordenacoes";
  rotulo: string;
}>;

export type PodeEditar = { pode: boolean; motivo: string };

/** Opção do select de um módulo ("" = segue o grupo). */
export type OpcaoDoModulo = {
  valor: NivelDeAcesso | "";
  rotulo: string;
  desabilitada: boolean;
};

// ── Formulários de grupo e coordenação ───────────────────────────────────────

export type RascunhoDoGrupo = {
  codigo: string;
  nome: string;
  descricao: string;
  revisao: RevisaoDoBanco;
  sistema?: boolean;
  adminGlobal?: boolean;
  niveis: Partial<Record<string, NivelDeAcesso>>;
};

export type GrupoParaSalvar = {
  codigo: string;
  nome: string;
  descricao: string;
  revisao: RevisaoDoBanco;
  niveis: Partial<Record<string, NivelDeAcesso>>;
};

export type RascunhoDaCoordenacao = {
  codigo: string;
  nome: string;
  area: string;
  responsavel: string;
  unidades: string[];
  editais: string[];
  ativo: boolean;
  revisao: RevisaoDoBanco;
};

export type CoordenacaoParaSalvar = {
  codigo: string;
  nome: string;
  area: string;
  responsavel: string | null;
  unidades: string[];
  editais: string[];
  ativo: boolean;
  revisao: RevisaoDoBanco;
};

/** Erros por campo ({} = válido). */
export type ErrosDoFormulario = Record<string, string>;

/** { value, label } dos selects. */
export type OpcaoDeSelecao = { value: string; label: string };

// ── "Ver como" (obter_contexto_de_usuario) ───────────────────────────────────

export type EscopoDoContexto = {
  rascunho?: boolean;
  recortado?: boolean;
  editais_da_area?: number | null;
  editais_visiveis?: number | null;
};

/** O contexto como o banco manda (às vezes numa lista de uma linha). */
export type ContextoDoUsuario = {
  profile?: PerfilDeAcesso | null;
  perfil?: PerfilDeAcesso | null;
  panel_ids?: string[];
  paineis?: string[];
  escopo?: EscopoDoContexto;
  modules?: Record<string, unknown>;
};

export type ContextoRecebido =
  ContextoDoUsuario | readonly ContextoDoUsuario[] | null | undefined;

// ── Contas desativadas e reativação ──────────────────────────────────────────

/** Linha de listar_contas_desativadas. */
export type ContaDesativada = {
  id: string;
  nome?: string | null;
  email?: string | null;
  desativada_em?: string | null;
  desativada_por?: string | null;
  motivo?: string | null;
  grupo?: string | null;
  coordenacao?: string | null;
  areas?: string[] | null;
};

/** O que o pedido de reativação traz em "Pendentes". */
export type PedidoDeReativacao = {
  reativacao?: boolean;
  grupo_anterior?: string | null;
  desativada_em?: string | null;
  desativada_por?: string | null;
  motivo_desativacao?: string | null;
};

export type ValoresDaReativacao = {
  grupo: string;
  coordenacao: string;
  areas: string[];
  motivo: string;
};

export type ErrosDaReativacao = {
  grupo?: string;
  semArea?: true;
  semCoordenacao?: true;
  motivo?: string;
};

/** Argumentos de reativar_acesso_usuario. */
export type ArgumentosDaReativacao = {
  p_perfil_usuario_id: string;
  p_grupo: string;
  p_coordenacao: string | null;
  p_areas: string[];
  p_motivo: string;
};

// ── Convite e situação ───────────────────────────────────────────────────────

export type SituacaoDoAcesso = {
  tipo: "convite" | "acesso" | "nunca";
  rotulo: string;
};

export type DadosDoConvite = {
  nome?: string | null;
  email?: string | null;
  origem?: string | null;
};

// ── Acesso liberado (comemoração) ────────────────────────────────────────────

export type TipoDeComemoracao = "reativado" | "liberado";

/** Data ou instante: Date, ISO, milissegundos; vazio = desconhecido. */
export type InstanteRecebido = Date | string | number | null | undefined;
