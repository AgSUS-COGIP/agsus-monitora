import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  espelhoDeExemplo,
  linhasDoTimbrado,
  paginaDoEspelho,
} from "../../lib/avaliacao-documental/espelho-de-nota.ts";
import type { ModeloDoEspelho } from "../../lib/avaliacao-documental/espelho-de-nota.ts";
import {
  CAMPOS_DO_MODELO,
  comMarcadorNoCursor,
  diferencasDoPadrao,
  MARCADOR_DO_CANDIDATO,
  TEXTOS_PADRAO_DO_ESPELHO,
  validarModeloDoEspelho,
  type CampoDoModelo,
  type ModeloDoEdital,
  type TextosDoEspelho,
} from "../../lib/avaliacao-documental/modelo-do-espelho.ts";
import { formatarDataHora } from "../../lib/cronograma-do-edital.ts";
import { Aviso, Campo, Carregando, Segmentado } from "../../ui/index.ts";
import { ModalInstitucional } from "../../ui/modal-institucional.tsx";
import { imprimirPagina } from "../classificacao/documento-no-navegador.ts";
import { marcaDaPagina } from "./ficha/espelho-de-nota.ts";
import "./espelho-editor.css";
import {
  mensagemDoErroDoModelo,
  obterModeloDoEspelho,
  salvarModeloDoEspelho,
} from "./modelo-do-espelho-no-banco.ts";

/*
  "Modelo do espelho de nota" (Avaliação documental › Fila › Ações da
  coordenação, ao lado de "Espelhos de nota em massa"; só quem coordena o
  edital vê, e o banco confere de novo): os textos da folha do edital —
  título, subtítulo, saudação com {candidato}, abertura, nomes dos quadros,
  rótulos das notas, "Não se aplica" do eliminado, "Sem observação
  registrada.", rodapé e a nota autodeclarada no modelo com pontos —, com a
  prévia ao lado (dados fictícios, com pontos ou eliminado) e "Restaurar
  padrão". Salvar vale na hora para o espelho da ficha, os em massa, a
  impressão e o PDF/ZIP; sem deploy. O conteúdo (quem aparece, notas,
  critérios) não se edita aqui.

  O cabeçalho institucional (timbrado) é o de Configurações › Marca, igual em
  todos os documentos: o editor o mostra no topo, só para leitura. O
  comunicado de eliminação antes da análise (Triagem) é outro documento e não
  usa este modelo.

  Teclado: Ctrl/⌘+S salva; "Inserir {candidato}" põe o marcador onde está o
  cursor; o resumo de erros leva ao primeiro campo inválido; a prévia tem a
  troca de modelo por setas (Segmentado) e "Imprimir exemplo".
*/

type Rpc = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;

const PREVIAS = [
  { valor: "COM_PONTOS", rotulo: "Com pontos" },
  { valor: "ELIMINADO", rotulo: "Eliminado" },
] as const;

const GRUPOS = [...new Set(CAMPOS_DO_MODELO.map((c) => c.grupo))];

/* O nome de cada grupo no editor ("Cabeçalho" é o timbrado, que vem de Configurações). */
const NOME_DO_GRUPO: Readonly<Record<CampoDoModelo["grupo"], string>> = {
  Cabeçalho: "Título e abertura",
  Quadros: "Nomes dos quadros",
  Notas: "Notas",
  "Textos fixos": "Textos fixos e rodapé",
};

/* O contador aparece nos textos longos sempre e nos curtos perto do limite. */
const PERTO_DO_LIMITE = 0.8;

const iguais = (a: TextosDoEspelho, b: TextosDoEspelho) =>
  JSON.stringify(diferencasDoPadrao(a)) ===
  JSON.stringify(diferencasDoPadrao(b));

function CampoDeTexto({
  campo,
  valor,
  erro,
  desabilitado,
  aoMudar,
}: {
  campo: CampoDoModelo;
  valor: string;
  erro?: string;
  desabilitado: boolean;
  aoMudar: (valor: string) => void;
}) {
  const idDaDica = useId();
  const controle = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const dica = campo.aceitaCandidato
    ? `${MARCADOR_DO_CANDIDATO} vira o nome do candidato.`
    : campo.podeFicarVazio
      ? "Vazio: some da folha."
      : "";
  const mostrarContador =
    campo.linhas > 1 || valor.length >= campo.maximo * PERTO_DO_LIMITE;
  const contador = mostrarContador
    ? `${valor.length.toLocaleString("pt-BR")} de ${campo.maximo.toLocaleString("pt-BR")} caracteres`
    : "";
  const temDica = Boolean(dica || contador);

  function inserirMarcador() {
    const el = controle.current;
    const novo = comMarcadorNoCursor(
      valor,
      el?.selectionStart ?? null,
      el?.selectionEnd ?? null,
    );
    if (novo.valor.length > campo.maximo) return;
    aoMudar(novo.valor);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(novo.cursor, novo.cursor);
    });
  }

  const propriedades = {
    ref: controle,
    value: valor,
    maxLength: campo.maximo,
    disabled: desabilitado,
    "data-campo": campo.chave,
    "aria-describedby": temDica ? idDaDica : undefined,
    required: !campo.podeFicarVazio,
  };
  return (
    <div className="avd-espelho-editor-campo">
      <Campo
        rotulo={campo.rotulo}
        dica={
          temDica ? (
            <span id={idDaDica} className="avd-espelho-editor-dica">
              {dica ? <span>{dica}</span> : null}
              {contador ? (
                <span className="avd-espelho-editor-contador">{contador}</span>
              ) : null}
            </span>
          ) : undefined
        }
        erro={erro}
      >
        {campo.linhas > 1 ? (
          <textarea
            {...propriedades}
            rows={campo.linhas}
            onChange={(ev) => aoMudar(ev.target.value)}
          />
        ) : (
          <input
            {...propriedades}
            type="text"
            onChange={(ev) => aoMudar(ev.target.value)}
          />
        )}
      </Campo>
      {campo.aceitaCandidato && !desabilitado ? (
        <button
          type="button"
          className="btn secondary small avd-espelho-editor-marcador"
          data-acao={`inserir-candidato-${campo.chave}`}
          aria-label={`Inserir ${MARCADOR_DO_CANDIDATO} em ${campo.rotulo}`}
          onClick={inserirMarcador}
        >
          Inserir {MARCADOR_DO_CANDIDATO}
        </button>
      ) : null}
    </div>
  );
}

export function ModeloDoEspelhoDeNota({
  editalId,
  rpc,
  aoFechar,
  marca = marcaDaPagina,
  imprimir = imprimirPagina,
}: {
  editalId: string;
  rpc: Rpc;
  aoFechar: () => void;
  marca?: () => { cabecalho?: string; logo?: string };
  imprimir?: (html: string) => void;
}) {
  const [modelo, setModelo] = useState<ModeloDoEdital | null>(null);
  const [rascunho, setRascunho] = useState<TextosDoEspelho>({
    ...TEXTOS_PADRAO_DO_ESPELHO,
  });
  const [previa, setPrevia] = useState<ModeloDoEspelho>("COM_PONTOS");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [leitura, setLeitura] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);
  const idDoTimbrado = useId();
  const idDaPrevia = useId();

  useEffect(() => {
    let vivo = true;
    setErro("");
    obterModeloDoEspelho(rpc, editalId)
      .then((m) => {
        if (!vivo) return;
        setModelo(m);
        setRascunho(m.textos);
      })
      .catch((e: unknown) => {
        if (vivo)
          setErro(
            `Não foi possível abrir o modelo: ${(e as { message?: string })?.message || String(e)}`,
          );
      });
    return () => {
      vivo = false;
    };
  }, [rpc, editalId, leitura]);

  const erros = validarModeloDoEspelho(
    rascunho as unknown as Record<string, unknown>,
  );
  const camposComErro = CAMPOS_DO_MODELO.filter((c) => erros[c.chave]);
  const temErro = Object.keys(erros).length > 0;
  const mudou = modelo ? !iguais(rascunho, modelo.textos) : false;
  const noPadrao = iguais(rascunho, TEXTOS_PADRAO_DO_ESPELHO);
  const podeEditar = Boolean(modelo?.podeEditar);
  const podeSalvar = podeEditar && mudou && !temErro && !salvando;
  const timbrado = marca();
  const linhas = linhasDoTimbrado(timbrado.cabecalho);
  const pagina = useMemo(
    () => paginaDoEspelho(espelhoDeExemplo(previa, rascunho), marca()),
    [previa, rascunho, marca],
  );

  const mudar = (chave: keyof TextosDoEspelho, valor: string | boolean) => {
    setAviso("");
    setRascunho((r) => ({ ...r, [chave]: valor }));
  };

  async function salvar() {
    if (!modelo) return;
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      const salvo = await salvarModeloDoEspelho(
        rpc,
        editalId,
        rascunho,
        modelo.versao,
      );
      setModelo(salvo);
      setRascunho(salvo.textos);
      setAviso(
        `Modelo salvo (versão ${salvo.versao}). Os próximos espelhos do edital já saem com ele.`,
      );
    } catch (e) {
      setErro(mensagemDoErroDoModelo(e));
    } finally {
      setSalvando(false);
    }
  }

  function irAoPrimeiroErro() {
    const primeiro = camposComErro[0];
    if (!primeiro) return;
    formulario.current
      ?.querySelector<HTMLElement>(`[data-campo='${primeiro.chave}']`)
      ?.focus();
  }

  function aoTeclar(ev: KeyboardEvent<HTMLDivElement>) {
    if (!(ev.ctrlKey || ev.metaKey) || ev.key.toLowerCase() !== "s") return;
    ev.preventDefault();
    if (podeSalvar) void salvar();
  }

  const situacao = !podeEditar
    ? "Somente leitura"
    : salvando
      ? "Salvando…"
      : mudou
        ? "Alterações não salvas"
        : noPadrao
          ? "Textos padrão"
          : "Sem alterações";

  return (
    <ModalInstitucional
      tituloId="avdModeloEspelhoTitulo"
      titulo="Modelo do espelho de nota"
      contexto="Avaliação documental · Documentos oficiais"
      descricao="Personalize os textos e confira a prévia antes de salvar."
      icone="fa-file-lines"
      aoFechar={aoFechar}
      fecharDesabilitado={salvando}
      amplo
      classeDoCartao="avd-modelo-espelho"
      tour="avd-modelo-espelho"
      complemento={
        modelo?.atualizadoEm ? (
          <span className="avd-modelo-espelho-salvo">
            Versão {modelo.versao} · {formatarDataHora(modelo.atualizadoEm)}
            {modelo.atualizadoPor ? ` · ${modelo.atualizadoPor}` : ""}
          </span>
        ) : null
      }
      infoRodape="As alterações afetam os próximos documentos emitidos, sem modificar avaliações."
      acoes={
        <>
          <button
            type="button"
            className="btn secondary"
            disabled={salvando}
            onClick={aoFechar}
          >
            {mudou ? "Descartar e fechar" : "Fechar"}
          </button>
          {podeEditar ? (
            <>
              <button
                type="button"
                className="btn secondary"
                data-acao="modelo-espelho-padrao"
                disabled={salvando || noPadrao}
                onClick={() => {
                  setAviso("");
                  setRascunho({ ...TEXTOS_PADRAO_DO_ESPELHO });
                }}
              >
                Restaurar padrão
              </button>
              <button
                type="button"
                className="btn primary"
                data-acao="modelo-espelho-salvar"
                disabled={!podeSalvar}
                aria-keyshortcuts="Control+S Meta+S"
                title="Salvar (Ctrl+S)"
                onClick={() => void salvar()}
              >
                <i className="fa-solid fa-floppy-disk" aria-hidden="true" />{" "}
                {salvando ? "Salvando…" : "Salvar modelo"}
              </button>
            </>
          ) : null}
        </>
      }
    >
      {!modelo && !erro ? <Carregando /> : null}
      {modelo ? (
        <div className="avd-modelo-espelho-corpo" onKeyDown={aoTeclar}>
          <form
            ref={formulario}
            className="avd-modelo-espelho-campos"
            aria-label="Textos do espelho"
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault();
              if (podeSalvar) void salvar();
            }}
          >
            <div className="avd-espelho-editor-situacao" data-situacao>
              <span
                role="status"
                className={
                  mudou
                    ? "avd-espelho-editor-selo avd-espelho-editor-selo-pendente"
                    : "avd-espelho-editor-selo"
                }
              >
                {situacao}
              </span>
              {camposComErro.length ? (
                <button
                  type="button"
                  className="btn secondary small avd-espelho-editor-erros"
                  data-acao="modelo-espelho-ir-ao-erro"
                  onClick={irAoPrimeiroErro}
                >
                  <i
                    className="fa-solid fa-circle-exclamation"
                    aria-hidden="true"
                  />{" "}
                  {camposComErro.length === 1
                    ? "1 campo com erro"
                    : `${camposComErro.length} campos com erro`}
                </button>
              ) : null}
            </div>

            <section
              className="avd-espelho-editor-timbrado"
              aria-labelledby={idDoTimbrado}
              data-secao="timbrado"
            >
              <h3 id={idDoTimbrado}>Cabeçalho institucional</h3>
              <div className="avd-espelho-editor-timbrado-folha">
                {linhas.map((linha, i) => (
                  <p key={i}>{linha}</p>
                ))}
              </div>
              <small>
                Definido em Configurações › Marca e logo, para todos os
                documentos.
              </small>
            </section>

            {GRUPOS.map((grupo) => (
              <fieldset
                key={grupo}
                className="avd-modelo-espelho-grupo"
                data-grupo={grupo}
              >
                <legend>{NOME_DO_GRUPO[grupo]}</legend>
                <div className="avd-modelo-espelho-grupo-campos">
                  {CAMPOS_DO_MODELO.filter((c) => c.grupo === grupo).map(
                    (campo) => (
                      <CampoDeTexto
                        key={campo.chave}
                        campo={campo}
                        valor={rascunho[campo.chave]}
                        erro={erros[campo.chave]}
                        desabilitado={!podeEditar || salvando}
                        aoMudar={(v) => mudar(campo.chave, v)}
                      />
                    ),
                  )}
                  {grupo === "Notas" ? (
                    <label className="avd-modelo-espelho-opcao">
                      <input
                        type="checkbox"
                        checked={rascunho.mostrar_autodeclarada}
                        disabled={!podeEditar || salvando}
                        data-campo="mostrar_autodeclarada"
                        onChange={(ev) =>
                          mudar("mostrar_autodeclarada", ev.target.checked)
                        }
                      />
                      <span>
                        Mostrar a nota autodeclarada (modelo com pontos)
                      </span>
                    </label>
                  ) : null}
                </div>
              </fieldset>
            ))}
          </form>
          <section
            className="avd-modelo-espelho-previa"
            aria-labelledby={idDaPrevia}
          >
            <div className="avd-espelho-editor-previa-topo">
              <div>
                <h3 id={idDaPrevia}>Prévia do documento</h3>
                <small>Dados fictícios</small>
              </div>
              <button
                type="button"
                className="btn secondary small"
                data-acao="modelo-espelho-imprimir"
                onClick={() => imprimir(pagina)}
              >
                <i className="fa-solid fa-print" aria-hidden="true" /> Imprimir
                exemplo
              </button>
            </div>
            <Segmentado
              rotulo="Modelo da prévia"
              opcoes={PREVIAS}
              valor={previa}
              aoMudar={(v: ModeloDoEspelho) => setPrevia(v)}
            />
            <div className="avd-modelo-espelho-moldura">
              <iframe
                className="avd-modelo-espelho-folha"
                title={`Prévia do espelho com dados fictícios (${previa === "ELIMINADO" ? "eliminado" : "com pontos"})`}
                sandbox="allow-same-origin"
                srcDoc={pagina}
              />
            </div>
          </section>
        </div>
      ) : null}
      {aviso ? (
        <Aviso tom="info" papel="status">
          {aviso}
        </Aviso>
      ) : null}
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => {
              setModelo(null);
              setLeitura((n) => n + 1);
            }}
          >
            Recarregar
          </button>
        </Aviso>
      ) : null}
    </ModalInstitucional>
  );
}
