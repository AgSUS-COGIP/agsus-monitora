import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  chaveDoModelo,
  MODELOS_PADRAO,
  numeroDoEdital,
  paginaDaPrevia,
  textosDoModelo,
  unidadeDoEdital,
} from "../../lib/classificacao/documento-sei.js";
import {
  ALTURA_DA_PAGINA,
  escalaParaLargura,
  LARGURA_DA_FOLHA,
  limitarEscala,
  proximoZoom,
  rotuloDoZoom,
  tamanhoEscalado,
} from "../../lib/classificacao/escala-da-previa.ts";
import { documentoDaRegra } from "../../lib/classificacao/regra.js";
import { Abas, Campo, classes, Modal } from "../../ui/index.js";

/*
  "Como fica no SEI": o documento oficial da lista registrada. O modal ocupa
  quase a tela toda (ou a tela inteira, no botão de tela cheia; Esc fecha) e
  a PRÉVIA é o centro: a folha A4 inteira (iframe sem script, as classes do
  SEI imitadas), em escala que cabe na largura ("Ajustar") ou no zoom − / +.
  Os textos do edital que o gestor ajusta antes de copiar ficam num painel
  recolhível à esquerda, em duas abas: "Dados" (número do edital, processo
  SEI, unidade, autoridade do 1.1, local e data) e "Textos" (título e
  disposições preliminares e finais do modelo desta lista). No celular, uma
  coluna: o painel em cima e a prévia embaixo. Rodapé fixo: "Restaurar o
  padrão" e "Salvar no edital" (grava os textos na regra, nova versão) à
  esquerda; "Baixar DOCX" e "Copiar para o SEI" (usam o rascunho) à direita.
*/

type Textos = { titulo: string; preliminares: string; finais: string };
type Documento = {
  edital: string;
  processo: string;
  unidade: string;
  autoridade: string;
  local: string;
  data: string | null;
  modelos: Record<string, Partial<Textos>>;
};
type CampoDoEdital = "edital" | "processo" | "unidade" | "autoridade" | "local";
type Fase = "PRELIMINAR" | "FINAL" | null;
type Registrado = {
  retrato: {
    tipo: string;
    edital?: { edital?: string; unidade?: string };
  };
};
type DocumentoDaLista = { nome?: string } | null;

/* O que esta tela usa do estado da Classificação (estado.js). */
export type EstadoDoDocumento = {
  obter: () => { dados?: { regra?: { configuracao?: unknown } } | null };
  documentoDaLista: (
    registrado: Registrado,
    opcoes: { lista: string; fase: Fase; documento: Documento },
  ) => DocumentoDaLista;
  marcaDoDocumento: () => { cabecalho: string; logo: string };
  salvarTextosDoDocumento: (documento: Documento) => Promise<boolean>;
  exportar: (
    registrado: Registrado,
    formato: string,
    lista: string,
    fase: Fase,
    documento: Documento,
  ) => Promise<unknown>;
  copiarParaSei: (
    registrado: Registrado,
    opcoes: { lista: string; fase: Fase; documento: Documento },
  ) => Promise<unknown>;
};

const CAMPOS_DO_EDITAL: ReadonlyArray<[CampoDoEdital, string, string]> = [
  ["edital", "Edital nº", ""],
  ["processo", "Processo SEI", "AGSUS.000000/2026-00"],
  ["unidade", "Unidade por extenso", ""],
  [
    "autoridade",
    "Autoridade (item 1.1)",
    "por intermédio da Diretoria de Atenção Integral à Saúde, no uso das atribuições…",
  ],
  ["local", "Local", "Brasília"],
];
const CAMPOS_DO_TEXTO = ["titulo", "preliminares", "finais"] as const;

const PADROES = MODELOS_PADRAO as unknown as Record<
  string,
  (Textos & { rotulo?: string }) | undefined
>;

const ABAS = [
  { id: "dados", rotulo: "Dados", icone: "fa-id-card" },
  { id: "textos", rotulo: "Textos", icone: "fa-align-left" },
];

function rascunhoInicial(documento: Documento, chave: string): Documento {
  return {
    ...documento,
    modelos: {
      ...documento.modelos,
      [chave]: textosDoModelo(documento, chave) as Textos,
    },
  };
}

/* Só fica gravado o modelo que difere do padrão das publicações. */
export function documentoParaSalvar(rascunho: Documento): Documento {
  const modelos: Record<string, Partial<Textos>> = {};
  for (const [chave, textos] of Object.entries(rascunho.modelos || {})) {
    const padrao = PADROES[chave];
    const proprio = Object.fromEntries(
      CAMPOS_DO_TEXTO.map(
        (campo) => [campo, String(textos?.[campo] ?? "").trim()] as const,
      ).filter(([campo, v]) => v && v !== padrao?.[campo]),
    );
    if (Object.keys(proprio).length) modelos[chave] = proprio;
  }
  return { ...rascunho, modelos };
}

/* A largura da "mesa" da prévia, para o "Ajustar" (ResizeObserver). */
function usarLargura<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return undefined;
    setLargura(elemento.clientWidth);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setLargura(entrada.contentRect.width);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return [ref, largura] as const;
}

/* A folha A4 da prévia, com zoom (− / + / Ajustar) e a altura medida. */
function FolhaDaPrevia({ pagina, nome }: { pagina: string; nome: string }) {
  const [mesa, largura] = usarLargura<HTMLDivElement>();
  const [ajustar, setAjustar] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [altura, setAltura] = useState(ALTURA_DA_PAGINA);
  const quadro = useRef<HTMLIFrameElement | null>(null);
  const escala = ajustar ? escalaParaLargura(largura) : limitarEscala(zoom);
  const area = tamanhoEscalado(altura, escala);

  /* A altura do documento: o iframe não roda script; o mesmo origem deixa medir. */
  const medir = useCallback(() => {
    const h = quadro.current?.contentDocument?.documentElement?.scrollHeight;
    if (h && h > 0) setAltura(h);
  }, []);
  useEffect(() => {
    medir();
  }, [pagina, medir]);

  const mudarZoom = (sentido: 1 | -1) => {
    setZoom(proximoZoom(escala, sentido));
    setAjustar(false);
  };

  return (
    <section
      className="classificacao-documento-previa-area"
      aria-label="Prévia do documento"
    >
      <div
        className="classificacao-documento-zoom"
        role="toolbar"
        aria-label="Zoom da prévia"
      >
        <button
          type="button"
          className="btn secondary small"
          data-acao="zoom-menos"
          aria-label="Diminuir"
          onClick={() => mudarZoom(-1)}
        >
          <i className="fa-solid fa-minus" aria-hidden="true" />
        </button>
        <span className="classificacao-documento-escala" aria-live="polite">
          {rotuloDoZoom(escala)}
        </span>
        <button
          type="button"
          className="btn secondary small"
          data-acao="zoom-mais"
          aria-label="Aumentar"
          onClick={() => mudarZoom(1)}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={classes("btn secondary small", ajustar && "is-ativo")}
          data-acao="zoom-ajustar"
          aria-pressed={ajustar}
          onClick={() => setAjustar(true)}
        >
          <i className="fa-solid fa-arrows-left-right" aria-hidden="true" />{" "}
          Ajustar
        </button>
      </div>
      <div className="classificacao-documento-mesa" ref={mesa}>
        <div
          className="classificacao-documento-folha"
          style={{ width: area.largura, height: area.altura }}
        >
          <iframe
            ref={quadro}
            className="classificacao-documento-previa"
            title={`Prévia do documento no SEI${nome ? `: ${nome}` : ""}`}
            sandbox="allow-same-origin"
            srcDoc={pagina}
            onLoad={medir}
            style={{
              width: LARGURA_DA_FOLHA,
              height: Math.max(ALTURA_DA_PAGINA, altura),
              transform: `scale(${escala})`,
            }}
          />
        </div>
      </div>
    </section>
  );
}

export function DocumentoDoSei({
  estado,
  podeEditar,
  registrado,
  lista,
  fase,
  aoFechar,
}: {
  estado: EstadoDoDocumento;
  podeEditar: boolean;
  registrado: Registrado;
  lista: string;
  fase: Fase;
  aoFechar: () => void;
}) {
  const regraSalva = estado.obter().dados?.regra?.configuracao;
  const salvo = useMemo(
    () => documentoDaRegra(regraSalva) as Documento,
    [regraSalva],
  );
  const chave = chaveDoModelo(registrado.retrato.tipo, fase, lista);
  const [rascunho, setRascunho] = useState<Documento>(() =>
    rascunhoInicial(salvo, chave),
  );
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState("dados");
  const [painelAberto, setPainelAberto] = useState(true);
  const [telaCheia, setTelaCheia] = useState(false);
  const id = useId();
  const exemplos: Partial<Record<CampoDoEdital, string>> = {
    edital: numeroDoEdital(registrado.retrato.edital?.edital),
    unidade: unidadeDoEdital(registrado.retrato.edital?.unidade).nome,
  };
  const textos: Partial<Textos> = rascunho.modelos[chave] || {};
  const paraUsar = documentoParaSalvar(rascunho);
  const mudou =
    JSON.stringify(paraUsar) !== JSON.stringify(documentoParaSalvar(salvo));

  const doc = estado.documentoDaLista(registrado, {
    lista,
    fase,
    documento: paraUsar,
  });
  const pagina = doc ? paginaDaPrevia(doc, estado.marcaDoDocumento()) : "";

  const mudarCampo = (campo: CampoDoEdital | "data", valor: string | null) =>
    setRascunho((r) => ({ ...r, [campo]: valor }));
  const mudarTexto = (campo: keyof Textos, valor: string) =>
    setRascunho((r) => ({
      ...r,
      modelos: {
        ...r.modelos,
        [chave]: { ...r.modelos[chave], [campo]: valor },
      },
    }));
  const restaurar = () =>
    setRascunho((r) => ({
      ...r,
      modelos: {
        ...r.modelos,
        [chave]: textosDoModelo({ modelos: {} }, chave) as Textos,
      },
    }));

  async function salvar() {
    setSalvando(true);
    await estado.salvarTextosDoDocumento(paraUsar);
    setSalvando(false);
  }

  const painelId = `${id}-painel`;
  return (
    <Modal
      id="classificacaoDocumento"
      rotuloId="classificacaoDocumentoTitulo"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
      className="classificacao-documento-fundo"
      cartaoClassName={classes(
        "classificacao-documento",
        telaCheia && "is-tela-cheia",
      )}
    >
      <header className="classificacao-documento-topo">
        <div className="classificacao-documento-titulo">
          <h2 id="classificacaoDocumentoTitulo">Como fica no SEI</h2>
          <p className="ui-texto-secundario">
            {PADROES[chave]?.rotulo} · {doc?.nome}
          </p>
        </div>
        <div className="classificacao-documento-janela">
          <button
            type="button"
            className="btn secondary small"
            data-acao="alternar-painel"
            aria-expanded={painelAberto}
            aria-controls={painelId}
            onClick={() => setPainelAberto((v) => !v)}
          >
            <i className="fa-solid fa-table-columns" aria-hidden="true" />{" "}
            {painelAberto ? "Ocultar textos" : "Editar textos"}
          </button>
          <button
            type="button"
            className="btn secondary small"
            data-acao="tela-cheia"
            aria-pressed={telaCheia}
            aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
            title={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
            onClick={() => setTelaCheia((v) => !v)}
          >
            <i
              className={`fa-solid ${telaCheia ? "fa-compress" : "fa-expand"}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="btn secondary small"
            data-acao="fechar"
            aria-label="Fechar"
            title="Fechar (Esc)"
            onClick={aoFechar}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className={classes(
          "classificacao-documento-corpo",
          !painelAberto && "is-sem-painel",
        )}
      >
        <aside
          id={painelId}
          className="classificacao-documento-painel"
          hidden={!painelAberto}
        >
          <Abas
            rotulo="Textos do documento"
            compactas
            abas={ABAS.map((a) => ({
              ...a,
              idDaAba: `${id}-aba-${a.id}`,
              idDoPainel: `${id}-${a.id}`,
            }))}
            ativa={aba}
            aoEscolher={setAba}
          />
          <form
            className="classificacao-documento-textos"
            aria-label="Textos do documento"
            onSubmit={(ev) => ev.preventDefault()}
          >
            <div
              id={`${id}-dados`}
              role="tabpanel"
              aria-labelledby={`${id}-aba-dados`}
              className="ui-grade-de-campos"
              hidden={aba !== "dados"}
            >
              {CAMPOS_DO_EDITAL.map(([campo, rotulo, exemplo]) => (
                <Campo key={campo} rotulo={rotulo}>
                  <input
                    data-campo-documento={campo}
                    value={rascunho[campo] || ""}
                    placeholder={exemplos[campo] || exemplo}
                    maxLength={campo === "autoridade" ? 1000 : 300}
                    onChange={(ev) => mudarCampo(campo, ev.target.value)}
                  />
                </Campo>
              ))}
              <Campo rotulo="Data (vazio = na data da assinatura)">
                <input
                  type="date"
                  data-campo-documento="data"
                  value={rascunho.data || ""}
                  onChange={(ev) => mudarCampo("data", ev.target.value || null)}
                />
              </Campo>
            </div>
            <div
              id={`${id}-textos`}
              role="tabpanel"
              aria-labelledby={`${id}-aba-textos`}
              className="classificacao-documento-textos-do-modelo"
              hidden={aba !== "textos"}
            >
              <Campo rotulo="Título">
                <textarea
                  data-campo-documento="titulo"
                  rows={3}
                  maxLength={10000}
                  value={textos.titulo || ""}
                  onChange={(ev) => mudarTexto("titulo", ev.target.value)}
                />
              </Campo>
              <Campo rotulo="1. Disposições preliminares (uma linha por item; > subitem)">
                <textarea
                  data-campo-documento="preliminares"
                  rows={12}
                  maxLength={10000}
                  value={textos.preliminares || ""}
                  onChange={(ev) => mudarTexto("preliminares", ev.target.value)}
                />
              </Campo>
              <Campo rotulo="2. Disposições finais">
                <textarea
                  data-campo-documento="finais"
                  rows={6}
                  maxLength={10000}
                  value={textos.finais || ""}
                  onChange={(ev) => mudarTexto("finais", ev.target.value)}
                />
              </Campo>
            </div>
          </form>
        </aside>
        <FolhaDaPrevia pagina={pagina} nome={doc?.nome || ""} />
      </div>

      <footer className="classificacao-documento-rodape">
        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary small"
            data-acao="restaurar-textos"
            onClick={restaurar}
          >
            Restaurar o padrão
          </button>
          {podeEditar ? (
            <button
              type="button"
              className="btn secondary small"
              data-acao="salvar-textos"
              disabled={!mudou || salvando || !regraSalva}
              onClick={() => void salvar()}
            >
              Salvar no edital
            </button>
          ) : null}
        </div>
        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary"
            data-acao="baixar-docx"
            onClick={() =>
              void estado.exportar(registrado, "docx", lista, fase, paraUsar)
            }
          >
            <i className="fa-solid fa-file-word" aria-hidden="true" /> Baixar
            DOCX
          </button>
          <button
            type="button"
            className="btn"
            data-acao="copiar-sei"
            data-foco-inicial
            onClick={() =>
              void estado.copiarParaSei(registrado, {
                lista,
                fase,
                documento: paraUsar,
              })
            }
          >
            <i className="fa-solid fa-copy" aria-hidden="true" /> Copiar para o
            SEI
          </button>
        </div>
      </footer>
    </Modal>
  );
}
