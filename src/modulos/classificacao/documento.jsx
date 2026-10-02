import { useMemo, useState } from "react";
import {
  chaveDoModelo,
  MODELOS_PADRAO,
  numeroDoEdital,
  paginaDaPrevia,
  textosDoModelo,
  unidadeDoEdital,
} from "../../lib/classificacao/documento-sei.js";
import { normalizarRegra } from "../../lib/classificacao/regra.js";
import { Campo, Modal } from "../../ui/index.js";

/*
  "Como fica no SEI": o documento oficial da lista registrada, com a prévia
  (iframe sem script, as classes do SEI imitadas) e os textos do edital que o
  gestor ajusta antes de copiar — número do edital, processo SEI, unidade,
  autoridade do 1.1, local e data, título e disposições preliminares e
  finais do modelo desta lista. "Salvar no edital" grava os textos na regra
  (nova versão); "Copiar para o SEI" e "Baixar DOCX" usam o rascunho.
*/

const CAMPOS_DO_EDITAL = [
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

function rascunhoInicial(documento, chave) {
  return {
    ...documento,
    modelos: {
      ...documento.modelos,
      [chave]: textosDoModelo(documento, chave),
    },
  };
}

/* Só fica gravado o modelo que difere do padrão das publicações. */
export function documentoParaSalvar(rascunho) {
  const modelos = {};
  for (const [chave, textos] of Object.entries(rascunho.modelos || {})) {
    const padrao = MODELOS_PADRAO[chave];
    const proprio = Object.fromEntries(
      ["titulo", "preliminares", "finais"]
        .map((campo) => [campo, String(textos?.[campo] ?? "").trim()])
        .filter(([campo, v]) => v && v !== padrao?.[campo]),
    );
    if (Object.keys(proprio).length) modelos[chave] = proprio;
  }
  return { ...rascunho, modelos };
}

export function DocumentoDoSei({
  estado,
  podeEditar,
  registrado,
  lista,
  fase,
  aoFechar,
}) {
  const regraSalva = estado.obter().dados?.regra?.configuracao;
  const salvo = useMemo(
    () => normalizarRegra(regraSalva).documento,
    [regraSalva],
  );
  const chave = chaveDoModelo(registrado.retrato.tipo, fase, lista);
  const [rascunho, setRascunho] = useState(() => rascunhoInicial(salvo, chave));
  const [salvando, setSalvando] = useState(false);
  const exemplos = {
    edital: numeroDoEdital(registrado.retrato.edital?.edital),
    unidade: unidadeDoEdital(registrado.retrato.edital?.unidade).nome,
  };
  const textos = rascunho.modelos[chave];
  const paraUsar = documentoParaSalvar(rascunho);
  const mudou =
    JSON.stringify(paraUsar) !== JSON.stringify(documentoParaSalvar(salvo));

  const doc = estado.documentoDaLista(registrado, {
    lista,
    fase,
    documento: paraUsar,
  });
  const pagina = doc ? paginaDaPrevia(doc, estado.marcaDoDocumento()) : "";

  const mudarCampo = (campo, valor) =>
    setRascunho((r) => ({ ...r, [campo]: valor }));
  const mudarTexto = (campo, valor) =>
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
        [chave]: textosDoModelo({ modelos: {} }, chave),
      },
    }));

  async function salvar() {
    setSalvando(true);
    await estado.salvarTextosDoDocumento(paraUsar);
    setSalvando(false);
  }

  return (
    <Modal
      id="classificacaoDocumento"
      rotuloId="classificacaoDocumentoTitulo"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
      cartaoClassName="classificacao-documento"
    >
      <h2 id="classificacaoDocumentoTitulo">Como fica no SEI</h2>
      <p className="ui-texto-secundario">
        {MODELOS_PADRAO[chave]?.rotulo} · {doc?.nome}
      </p>
      <div className="classificacao-documento-corpo">
        <form
          className="classificacao-documento-textos"
          aria-label="Textos do documento"
          onSubmit={(ev) => ev.preventDefault()}
        >
          <div className="ui-grade-de-campos">
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
          <Campo rotulo="Título">
            <textarea
              data-campo-documento="titulo"
              rows={3}
              maxLength={10000}
              value={textos.titulo}
              onChange={(ev) => mudarTexto("titulo", ev.target.value)}
            />
          </Campo>
          <Campo rotulo="1. Disposições preliminares (uma linha por item; > subitem)">
            <textarea
              data-campo-documento="preliminares"
              rows={10}
              maxLength={10000}
              value={textos.preliminares}
              onChange={(ev) => mudarTexto("preliminares", ev.target.value)}
            />
          </Campo>
          <Campo rotulo="2. Disposições finais">
            <textarea
              data-campo-documento="finais"
              rows={5}
              maxLength={10000}
              value={textos.finais}
              onChange={(ev) => mudarTexto("finais", ev.target.value)}
            />
          </Campo>
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
                onClick={salvar}
              >
                Salvar no edital
              </button>
            ) : null}
          </div>
        </form>
        <iframe
          className="classificacao-documento-previa"
          title="Prévia do documento no SEI"
          sandbox=""
          srcDoc={pagina}
        />
      </div>
      <div className="ui-acoes">
        <button type="button" className="btn secondary" onClick={aoFechar}>
          Fechar
        </button>
        <button
          type="button"
          className="btn secondary"
          data-acao="baixar-docx"
          onClick={() =>
            void estado.exportar(registrado, "docx", lista, fase, paraUsar)
          }
        >
          <i className="fa-solid fa-file-word" aria-hidden="true" /> Baixar DOCX
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
    </Modal>
  );
}
