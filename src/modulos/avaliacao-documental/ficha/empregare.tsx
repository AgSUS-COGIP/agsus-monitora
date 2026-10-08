import {
  apresentacaoDoAnexo,
  enderecoDoAnexo,
} from "../../../lib/avaliacao-documental/anexo-na-empregare.ts";
import type { ContextoDaEmpregare } from "./tipos.ts";

/*
  Os links da ficha para a Empregare. Todo clique registra o acesso
  (registrar_acesso_ficha). Com o link do candidato capturado pelo robô, abre o
  candidato; sem ele, a vaga (copiando o código do candidato para a busca das
  candidaturas) ou a lista de vagas (copiando o código da vaga).
*/

export async function copiar(texto: string): Promise<boolean> {
  try {
    await globalThis.navigator?.clipboard?.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

const Icone = () => (
  <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
);

type PropriedadesDoLink = {
  empregare: ContextoDaEmpregare;
  rotulo?: string;
  className?: string;
  role?: string;
  aoAbrir?: () => void;
};

/* Ao abrir a vaga (sem o link do candidato), copia o código certo e avisa. */
async function copiarParaABusca(empregare: ContextoDaEmpregare) {
  const { enderecos, codigoDoCandidato, codigoDaVaga, aoAvisar } = empregare;
  const texto = enderecos.vagaDireta ? codigoDoCandidato : codigoDaVaga;
  const ok = await copiar(texto);
  aoAvisar(
    !ok
      ? "Não foi possível copiar"
      : enderecos.vagaDireta
        ? `Código ${texto} copiado: cole na busca das candidaturas`
        : `Código da vaga ${texto} copiado: cole na busca de Vagas Anunciadas`,
  );
}

/** "Abrir candidato na Empregare" (ou a vaga / a lista de vagas, sem o link). */
export function LinkDaEmpregare({
  empregare,
  rotulo,
  className = "btn secondary",
  role,
  aoAbrir,
}: PropriedadesDoLink) {
  const { candidato, vaga, vagaDireta } = empregare.enderecos;
  const href = candidato || vaga;
  if (!href) return null;
  const padrao = candidato
    ? "Abrir candidato na Empregare"
    : vagaDireta
      ? "Abrir vaga na Empregare"
      : "Abrir vagas na Empregare";
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      role={role}
      onClick={() => {
        if (!candidato) void copiarParaABusca(empregare);
        void empregare.loja.registrarAcesso("ABRIR_EMPREGARE");
        aoAbrir?.();
      }}
    >
      <Icone /> {rotulo || padrao}
    </a>
  );
}

/**
 * O anexo declarado: "Ver documento" com o link Visualizar Arquivo da pergunta;
 * senão "Ver respostas na Empregare" ou "Abrir na Empregare" e a dica de onde achar o arquivo
 * (anexo-na-empregare.ts monta o endereço, o rótulo e a dica).
 */
export function LinkDoAnexo({
  empregare,
  coluna,
}: {
  empregare: ContextoDaEmpregare;
  coluna: string;
}) {
  const endereco = enderecoDoAnexo(empregare.enderecos, coluna);
  if (!endereco) return null;
  const { rotulo, dica } = apresentacaoDoAnexo(coluna, endereco);
  return (
    <span className="avd-ficha-anexo">
      <a
        className="btn secondary small avd-ficha-ver-anexo"
        href={endereco.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (endereco.destino === "vaga" || endereco.destino === "vagas")
            void copiarParaABusca(empregare);
          void empregare.loja.registrarAcesso("ABRIR_EMPREGARE");
        }}
      >
        <Icone /> {rotulo}
      </a>
      {dica ? <small className="avd-ficha-dica-anexo">{dica}</small> : null}
    </span>
  );
}
