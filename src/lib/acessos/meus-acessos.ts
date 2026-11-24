/*
  "Meus acessos" (menu da conta, no cabeçalho): o que a própria pessoa pode
  no Yeendé, lido do perfil que `obter_contexto_monitora` já entrega ao
  entrar (grupo, áreas, coordenação e o nível de cada módulo). Sem RPC nova e
  sem DOM: entra o perfil, sai a lista legível; o desenho é de
  src/app/casca/meus-acessos.tsx.

  O nível de cada módulo é o efetivo (o grupo com as exceções da pessoa por
  cima), como o banco calcula em `private.nivel_recurso`. Sem a matriz (o
  contexto antigo, `permissoes: {}`), os módulos não aparecem: dizer "Sem
  acesso" em tudo seria falso.
*/
import { RESOURCES, rotuloDoNivel } from "./permissoes-recursos.ts";
import { AREAS_DO_SISTEMA } from "../navegacao/menu-lateral.ts";
import type {
  ModuloDeAcesso,
  NivelDeAcesso,
  PerfilDeAcesso,
} from "./tipos-dos-acessos.ts";

const txt = (valor: unknown): string => String(valor ?? "").trim();

export type ModuloDosMeusAcessos = Readonly<{
  recurso: ModuloDeAcesso;
  rotulo: string;
  nivel: NivelDeAcesso;
  /** "Leitor", "Editor", "Administrador" ou "Sem acesso". */
  rotuloDoNivel: string;
}>;

export type MeusAcessos = Readonly<{
  /** O nome do grupo ("Usuário" quando o contexto não traz). */
  grupo: string;
  adminGlobal: boolean;
  /** Os rótulos das áreas, na ordem do sistema. */
  areas: readonly string[];
  /** "Coordenação X (Saúde Indígena)" ou "" sem coordenação. */
  coordenacao: string;
  /** Todos os módulos do catálogo, na ordem dele; [] sem a matriz. */
  modulos: readonly ModuloDosMeusAcessos[];
  /** Quantos módulos a pessoa abre (nível acima de "sem acesso"). */
  comAcesso: number;
}>;

const NIVEIS: readonly NivelDeAcesso[] = [
  "sem_acesso",
  "leitor",
  "editor",
  "admin",
];
const nivelValido = (valor: unknown): NivelDeAcesso =>
  NIVEIS.includes(valor as NivelDeAcesso)
    ? (valor as NivelDeAcesso)
    : "sem_acesso";

/** O rótulo da área pelo código de `TB_AREA` (o próprio código, se for desconhecida). */
export function rotuloDaArea(codigo: unknown): string {
  const id = txt(codigo);
  return AREAS_DO_SISTEMA.find((area) => area.id === id)?.rotulo ?? id;
}

/** As áreas do perfil, sem repetição, na ordem do sistema (desconhecidas no fim). */
function areasDoPerfil(areas: unknown): string[] {
  const codigos = Array.isArray(areas)
    ? [...new Set(areas.map(txt).filter(Boolean))]
    : [];
  const ordem = (codigo: string) => {
    const posicao = AREAS_DO_SISTEMA.findIndex((area) => area.id === codigo);
    return posicao < 0 ? AREAS_DO_SISTEMA.length : posicao;
  };
  return codigos
    .sort((a, b) => ordem(a) - ordem(b))
    .map((codigo) => rotuloDaArea(codigo));
}

/** A lista legível dos acessos da própria pessoa (null sem perfil ativo). */
export function montarMeusAcessos(
  perfil: PerfilDeAcesso | null | undefined,
): MeusAcessos | null {
  if (!perfil || perfil.ativo === false) return null;
  const permissoes = perfil.permissoes ?? {};
  const temMatriz = Object.keys(permissoes).length > 0;
  const modulos = temMatriz
    ? RESOURCES.map(([recurso, rotulo]) => {
        const nivel = nivelValido(permissoes[recurso]);
        return Object.freeze({
          recurso,
          rotulo,
          nivel,
          rotuloDoNivel: rotuloDoNivel(nivel, recurso),
        });
      })
    : [];
  const coordenacao = perfil.coordenacao;
  const nomeDaCoordenacao = txt(coordenacao?.nome);
  const areaDaCoordenacao = coordenacao?.area
    ? rotuloDaArea(coordenacao.area)
    : "";
  return Object.freeze({
    grupo: txt(perfil.grupo?.nome) || "Usuário",
    adminGlobal: perfil.admin_global === true,
    areas: Object.freeze(areasDoPerfil(perfil.areas)),
    coordenacao: nomeDaCoordenacao
      ? `${nomeDaCoordenacao}${areaDaCoordenacao ? ` (${areaDaCoordenacao})` : ""}`
      : "",
    modulos: Object.freeze(modulos),
    comAcesso: modulos.filter((m) => m.nivel !== "sem_acesso").length,
  });
}

/** O tom do selo do nível (o mesmo vocabulário do `Selo` de src/ui/). */
export function tomDoNivel(nivel: NivelDeAcesso): string {
  if (nivel === "admin" || nivel === "editor") return "aprovado";
  if (nivel === "leitor") return "revisar";
  return "neutro";
}
