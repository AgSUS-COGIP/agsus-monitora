import { useEffect, useRef, useState } from "react";
import {
  editalDiferente,
  etapasDoAnexo,
  juntarAnexos,
  problemaDoArquivo,
  quadroParaSalvar,
  resumoDoQuadro,
  textoDaModalidade,
} from "../../lib/anexos-do-edital.js";

/*
  "Anexos do edital (PDF)" no formulário do edital. A pessoa escolhe o PDF de
  anexos (ou mais de um: Projetos publica cada anexo num arquivo), a função
  Python lê o cronograma e o quadro de vagas, e aqui se confere o que veio:

  - "Usar no cronograma" troca as etapas do editor pelas do Anexo I (com
    confirmação quando já há etapas);
  - o quadro de vagas: em edital já cadastrado, "Salvar quadro de vagas"
    grava na hora (`estado.salvarQuadroDeVagas`), sem depender do Salvar do
    formulário; em edital novo (ainda sem id), fica pendente e vai junto com o
    edital (`estado.salvarEdital({ quadro })`).

  Para edital existente mostra também o quadro já salvo. Regras puras em
  `src/lib/anexos-do-edital.js`.
*/

const plural = (total, um, varios) => `${total} ${total === 1 ? um : varios}`;

function frase(resumo) {
  const partes = [
    plural(resumo.linhas, "linha", "linhas"),
    plural(resumo.imediatas, "vaga imediata", "vagas imediatas"),
  ];
  if (resumo.soCadastroReserva)
    partes.push(`${resumo.soCadastroReserva} só com cadastro reserva`);
  return partes.join(" · ");
}

export function TabelaDoQuadro({ linhas, modalidades }) {
  const nomes = modalidades?.length
    ? modalidades
    : [
        ...new Set(
          (linhas || []).flatMap((v) => Object.keys(v.modalidades || {})),
        ),
      ];
  const temLotacao = (linhas || []).some((v) => v.lotacao);
  return (
    <div className="anexos-quadro">
      <table className="anexos-tabela">
        <thead>
          <tr>
            <th>Cargo</th>
            {temLotacao && <th>Lotação</th>}
            {nomes.map((m) => (
              <th key={m} className="anexos-num">
                {m}
              </th>
            ))}
            <th className="anexos-num">Imediatas</th>
            <th className="anexos-num">CR</th>
          </tr>
        </thead>
        <tbody>
          {(linhas || []).map((v, i) => (
            <tr key={`${v.cargo}|${v.lotacao}|${i}`}>
              <td>{v.cargo}</td>
              {temLotacao && <td>{v.lotacao || "—"}</td>}
              {nomes.map((m) => (
                <td key={m} className="anexos-num">
                  {textoDaModalidade(v.modalidades?.[m], v.cadastro_reserva)}
                </td>
              ))}
              <td className="anexos-num">
                <b>{Number(v.vagas_imediatas) || 0}</b>
              </td>
              <td className="anexos-num">{v.cadastro_reserva ? "Sim" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ImportarAnexos({
  estado,
  idAtual,
  numeroDoFormulario,
  temEtapas,
  quadroPendente,
  aoUsarCronograma,
  aoMudarQuadro,
  aoPreencherEdital,
}) {
  const entrada = useRef(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [lido, setLido] = useState(null);
  const [cronogramaUsado, setCronogramaUsado] = useState(false);
  const [verQuadro, setVerQuadro] = useState(false);
  const [salvo, setSalvo] = useState(null);
  const [gravandoQuadro, setGravandoQuadro] = useState(false);
  /* Resultado da gravação na hora: { tom: "success" | "error", texto }. */
  const [gravacao, setGravacao] = useState(null);

  useEffect(() => {
    if (!idAtual || !estado.lerQuadroDeVagas) return undefined;
    let vivo = true;
    estado
      .lerQuadroDeVagas(idAtual)
      .then((dados) => vivo && setSalvo(dados))
      .catch(() => vivo && setSalvo(null));
    return () => {
      vivo = false;
    };
  }, [estado, idAtual]);

  async function ler(evento) {
    const arquivos = [...(evento.target.files || [])];
    evento.target.value = "";
    if (!arquivos.length) return;
    const problema = arquivos.map(problemaDoArquivo).find(Boolean);
    if (problema) {
      setErro(problema);
      return;
    }
    setLendo(true);
    setErro("");
    setLido(null);
    setCronogramaUsado(false);
    setGravacao(null);
    try {
      const juntado = juntarAnexos(await estado.lerAnexos(arquivos));
      setLido(juntado);
      // Edital cadastrado grava pelo botão; só o edital novo leva o quadro no Salvar.
      aoMudarQuadro(
        !idAtual && juntado.vagas.length ? quadroParaSalvar(juntado) : null,
      );
      if (juntado.edital) aoPreencherEdital(juntado.edital);
    } catch (e) {
      setErro(e?.message || String(e));
      aoMudarQuadro(null);
    } finally {
      setLendo(false);
    }
  }

  async function gravarQuadro() {
    if (!idAtual || !lido?.vagas?.length || gravandoQuadro) return;
    const atuais = salvo?.linhas?.length || 0;
    if (
      atuais &&
      !estado.confirmar(
        `Substituir o quadro de vagas salvo (${plural(atuais, "linha", "linhas")}) pelo do PDF?`,
      )
    )
      return;
    setGravandoQuadro(true);
    setGravacao(null);
    try {
      const dados = await estado.salvarQuadroDeVagas(
        idAtual,
        quadroParaSalvar(lido),
      );
      setSalvo(dados);
      setGravacao({
        tom: "success",
        texto: `Quadro de vagas salvo: ${plural(dados?.linhas?.length ?? lido.vagas.length, "linha", "linhas")}.`,
      });
    } catch (e) {
      setGravacao({
        tom: "error",
        texto: `O quadro de vagas não foi salvo: ${e?.message || e}`,
      });
    } finally {
      setGravandoQuadro(false);
    }
  }

  function usarCronograma() {
    if (!lido?.cronograma?.length) return;
    if (
      temEtapas &&
      !estado.confirmar(
        `Substituir o cronograma atual pelas ${lido.cronograma.length} etapas do PDF?`,
      )
    )
      return;
    aoUsarCronograma(etapasDoAnexo(lido.cronograma));
    setCronogramaUsado(true);
  }

  const outroEdital = lido && editalDiferente(numeroDoFormulario, lido.edital);
  const linhasSalvas = salvo?.linhas || [];

  return (
    <section
      id="anexosDoEdital"
      data-tour="editais-anexos"
      className="cronograma-copy-box anexos-box ui-campo-largo"
    >
      <strong className="cronograma-copy-heading">Anexos do edital</strong>
      <div className="cronograma-copy-controls">
        <input
          ref={entrada}
          id="anexosArquivo"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => void ler(e)}
        />
        <button
          id="anexosEscolher"
          data-tour="editais-anexos-escolher"
          className="btn secondary"
          type="button"
          disabled={lendo}
          onClick={() => entrada.current?.click()}
        >
          {lendo ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />{" "}
              Lendo o PDF...
            </>
          ) : (
            <>
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Escolher
              PDF de anexos
            </>
          )}
        </button>
      </div>

      {erro && (
        <p className="cronograma-copy-feedback is-error" role="alert">
          {erro}
        </p>
      )}

      {lido && (
        <div className="anexos-resultado" role="status">
          {outroEdital && (
            <p className="cronograma-copy-feedback is-warning">
              O PDF é do edital {lido.edital}, e este formulário é do{" "}
              {numeroDoFormulario}. Confira o arquivo.
            </p>
          )}
          <div className="anexos-linha">
            <div>
              <strong>Cronograma</strong>{" "}
              {lido.cronograma.length
                ? `${plural(lido.cronograma.length, "etapa", "etapas")} (${lido.arquivoDoCronograma})`
                : "não encontrado"}
            </div>
            {lido.cronograma.length > 0 && (
              <button
                id="anexosUsarCronograma"
                className="btn secondary"
                type="button"
                disabled={cronogramaUsado}
                onClick={usarCronograma}
              >
                {cronogramaUsado ? "Cronograma aplicado" : "Usar no cronograma"}
              </button>
            )}
          </div>
          <div className="anexos-linha" data-tour="editais-quadro-de-vagas">
            <div>
              <strong>Quadro de vagas</strong>{" "}
              {lido.vagas.length
                ? `${frase(resumoDoQuadro(lido.vagas))}${idAtual ? "" : quadroPendente ? " — será salvo com o edital" : ""}`
                : "não encontrado"}
            </div>
            {idAtual && lido.vagas.length > 0 && (
              <button
                id="anexosSalvarQuadro"
                className="btn green"
                type="button"
                disabled={gravandoQuadro || gravacao?.tom === "success"}
                onClick={() => void gravarQuadro()}
              >
                {gravandoQuadro
                  ? "Salvando..."
                  : gravacao?.tom === "success"
                    ? "Quadro salvo"
                    : "Salvar quadro de vagas"}
              </button>
            )}
            {lido.vagas.length > 0 && (
              <button
                id="anexosVerQuadro"
                className="btn secondary"
                type="button"
                onClick={() => setVerQuadro((v) => !v)}
              >
                {verQuadro ? "Esconder" : "Ver quadro"}
              </button>
            )}
          </div>
          {gravacao && (
            <p
              className={`cronograma-copy-feedback is-${gravacao.tom}`}
              role={gravacao.tom === "error" ? "alert" : "status"}
            >
              {gravacao.texto}
            </p>
          )}
          {verQuadro && lido.vagas.length > 0 && (
            <TabelaDoQuadro
              linhas={lido.vagas}
              modalidades={lido.modalidades}
            />
          )}
          {lido.avisos.map((aviso) => (
            <p key={aviso} className="cronograma-copy-feedback is-warning">
              {aviso}
            </p>
          ))}
        </div>
      )}

      {!lido && linhasSalvas.length > 0 && (
        <div className="anexos-resultado">
          <div className="anexos-linha" data-tour="editais-quadro-de-vagas">
            <div>
              <strong>Quadro de vagas salvo</strong>{" "}
              {frase(resumoDoQuadro(linhasSalvas))}
              {salvo?.origem?.arquivo ? ` (${salvo.origem.arquivo})` : ""}
            </div>
            <button
              id="anexosVerQuadroSalvo"
              className="btn secondary"
              type="button"
              onClick={() => setVerQuadro((v) => !v)}
            >
              {verQuadro ? "Esconder" : "Ver quadro"}
            </button>
          </div>
          {verQuadro && <TabelaDoQuadro linhas={linhasSalvas} />}
        </div>
      )}
    </section>
  );
}
