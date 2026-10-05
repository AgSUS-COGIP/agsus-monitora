import { useRef, useState } from "react";
import {
  canAlterarPorDecisaoJudicial,
  canManageSubJudice,
} from "../../lib/access-roles.js";
import {
  MAXIMO_DE_ANEXOS,
  formatarTamanho,
  problemaDosAnexos,
} from "../../lib/anexos-do-candidato.js";
import {
  STATUS_DO_CANDIDATO,
  alteracaoJudicial,
  canDesfazerAlteracaoSubJudice,
  candidateModalidadesForEdital,
  canEditCandidateAttachments,
  podeTirarOStatus,
  statusEhConvocado,
  formatarNota,
  modalidadeSemAspas,
  statusNeedsMatricula,
  uniqueCandidateCargos,
} from "../../lib/lista-aprovados-rules.js";
import { Abas, BotaoDeAcao, classes, Modal } from "../../ui/index.js";
import { IconeDePdf } from "./partes.jsx";

/*
  Os modais de status do candidato (com os anexos novos), dos anexos do
  candidato e de sub judice (abas: novo candidato e candidato já aprovado,
  cuja nota e/ou modalidade mudou por decisão judicial). Cada abertura é
  uma montagem nova (`key` = abertura), então o rascunho começa sempre do que
  está no banco. Salvar é do estado (`estado.js`), que fecha o modal quando
  dá certo e deixa os dados digitados na tela quando dá erro.
*/

function Cabecalho({ tituloId, titulo, subtitulo, subtituloId, aoFechar }) {
  return (
    <div className="modal-head">
      <div>
        <h3 id={tituloId}>{titulo}</h3>
        {subtitulo ? (
          <p id={subtituloId} className="approved-modal-subtitle">
            {subtitulo}
          </p>
        ) : null}
      </div>
      <button className="btn secondary" type="button" onClick={aoFechar}>
        Fechar
      </button>
    </div>
  );
}

const DICA_DOS_ANEXOS = "PDF, até 2 MB";

/*
  Os PDFs escolhidos ficam no rascunho do modal e só sobem ao salvar o status.
  Escolher de novo soma aos já escolhidos; o `input` é esvaziado a cada escolha
  para que o mesmo arquivo possa voltar depois de tirado da lista.

  O botão é o do app para arquivo (como "Escolher imagem" em Configurações):
  um `<label class="btn secondary">` com o `input` nativo escondido dentro. O
  `input` continua focável, e o foco dele aparece no botão.
*/
function CampoDeAnexos({ jaAnexados, arquivos, aoMudar }) {
  const entrada = useRef(null);
  const problema = problemaDosAnexos(arquivos, jaAnexados);
  const restam = Math.max(MAXIMO_DE_ANEXOS - jaAnexados - arquivos.length, 0);
  return (
    <div className="form-row full">
      <label htmlFor="approvedStatusAnexos">
        Anexar documentos{" "}
        <span
          className="approved-dica com-dica"
          data-dica={DICA_DOS_ANEXOS}
          aria-hidden="true"
        >
          <i className="fa-solid fa-circle-info" />
        </span>
      </label>
      <div className="approved-anexar-linha">
        <label
          className="btn secondary approved-anexar"
          aria-disabled={restam === 0 ? true : undefined}
        >
          <i className="fa-solid fa-file-arrow-up" aria-hidden="true" />
          <span>Fazer upload</span>
          <input
            ref={entrada}
            id="approvedStatusAnexos"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={restam === 0}
            aria-describedby="approvedAnexosDica approvedAnexosHint"
            aria-invalid={problema ? true : undefined}
            onChange={(evento) => {
              const novos = Array.from(evento.target.files ?? []);
              if (entrada.current) entrada.current.value = "";
              if (novos.length) aoMudar([...arquivos, ...novos]);
            }}
          />
        </label>
        <small id="approvedAnexosHint" className="approved-field-hint">
          {jaAnexados + arquivos.length} de {MAXIMO_DE_ANEXOS} anexos
        </small>
      </div>
      <span id="approvedAnexosDica" className="sr-only">
        {DICA_DOS_ANEXOS}
      </span>
      {problema ? (
        <small className="approved-field-erro" role="alert">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{" "}
          {problema}
        </small>
      ) : null}
      {arquivos.length ? (
        <ul className="approved-anexos-escolhidos">
          {arquivos.map((arquivo, indice) => (
            <li key={`${arquivo.name}-${indice}`}>
              <span className="approved-anexo-icone">
                <IconeDePdf />
              </span>
              <span className="approved-anexo-nome">{arquivo.name}</span>
              <small>{formatarTamanho(arquivo.size)}</small>
              <button
                type="button"
                className="approved-icone-acao"
                title="Tirar da lista"
                aria-label={`Tirar ${arquivo.name} da lista`}
                onClick={() =>
                  aoMudar(arquivos.filter((_, outro) => outro !== indice))
                }
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ModalDeStatus({
  estado,
  perfil,
  candidato,
  jaAnexados = 0,
  dataConvocacao = "",
}) {
  // Anexar é só do admin do módulo; para os demais, o campo não aparece.
  const podeAnexar = canEditCandidateAttachments(perfil, candidato);
  const hoje = estado.carta.hoje();
  const [status, setStatus] = useState(candidato.status || "");
  const [processo, setProcesso] = useState(candidato.processo_sei || "");
  const [matricula, setMatricula] = useState(candidato.matricula || "");
  const [data, setData] = useState(dataConvocacao || hoje);
  const [anexos, setAnexos] = useState([]);
  const exigeMatricula = statusNeedsMatricula(status);
  // Do Convocado, quem edita segue o fluxo; deixar sem status é do admin.
  const semStatusBarrado = !podeTirarOStatus(perfil, candidato);
  const anexosInvalidos = Boolean(problemaDosAnexos(anexos, jaAnexados));
  const fechar = estado.fecharModal;

  return (
    <Modal
      id="approvedStatusModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card"
      rotuloId="approvedStatusTitle"
      aoFechar={fechar}
    >
      <Cabecalho
        tituloId="approvedStatusTitle"
        titulo="Alterar status do candidato"
        subtituloId="approvedStatusCandidate"
        subtitulo={`${candidato.nome} · ${candidato.cargo}`}
        aoFechar={fechar}
      />
      <div className="modal-body">
        <div className="form-grid">
          <div className="form-row full">
            <label htmlFor="approvedStatusSelect">Status</label>
            <select
              id="approvedStatusSelect"
              data-tour="aprovados-status-escolha"
              data-foco-inicial
              value={status}
              onChange={(evento) => setStatus(evento.target.value)}
            >
              <option value="" disabled={semStatusBarrado}>
                Sem status
              </option>
              {STATUS_DO_CANDIDATO.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </div>
          {statusEhConvocado(status) ? (
            <div className="form-row full">
              <label htmlFor="approvedStatusDataConvocacao">
                Data da convocação
              </label>
              <input
                id="approvedStatusDataConvocacao"
                data-tour="aprovados-status-data-convocacao"
                type="date"
                max={hoje}
                required
                value={data}
                onChange={(evento) => setData(evento.target.value)}
              />
            </div>
          ) : null}
          <div className="form-row full">
            <label htmlFor="approvedStatusSei">
              Processo SEI <small>(opcional)</small>
            </label>
            <input
              id="approvedStatusSei"
              placeholder="Ex.: 00700.000000/2026-00"
              value={processo}
              onChange={(evento) => setProcesso(evento.target.value)}
            />
          </div>
          <div className="form-row full">
            <label htmlFor="approvedStatusMatricula">Matrícula</label>
            <input
              id="approvedStatusMatricula"
              placeholder="Informe quando o status exigir"
              required={exigeMatricula}
              aria-describedby={
                exigeMatricula ? "approvedMatriculaHint" : undefined
              }
              value={matricula}
              onChange={(evento) => setMatricula(evento.target.value)}
            />
            {exigeMatricula ? (
              <small id="approvedMatriculaHint" className="approved-field-hint">
                Obrigatória para este status.
              </small>
            ) : null}
          </div>
          {podeAnexar ? (
            <CampoDeAnexos
              jaAnexados={jaAnexados}
              arquivos={anexos}
              aoMudar={setAnexos}
            />
          ) : null}
        </div>
        <div className="approved-modal-actions">
          <button className="btn secondary" type="button" onClick={fechar}>
            Cancelar
          </button>
          <BotaoDeAcao
            estado={estado}
            acao="status"
            id="approvedStatusSave"
            data-tour="aprovados-status-salvar"
            className="btn green"
            disabled={anexosInvalidos}
            onClick={() =>
              void estado.salvarStatus(candidato.candidato_id, {
                status,
                processo,
                matricula,
                anexos,
                dataConvocacao: data,
              })
            }
          >
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Salvar
            status
          </BotaoDeAcao>
        </div>
      </div>
    </Modal>
  );
}

const dataCurta = (valor) => {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleDateString("pt-BR");
};

/* Os anexos de um candidato: abrir cada PDF e, para quem altera o status, remover. */
export function ModalDeAnexos({ estado, perfil, candidato, anexos }) {
  const fechar = estado.fecharModal;
  const podeRemover = canEditCandidateAttachments(perfil, candidato);
  return (
    <Modal
      id="approvedAnexosModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card"
      rotuloId="approvedAnexosTitle"
      aoFechar={fechar}
    >
      <Cabecalho
        tituloId="approvedAnexosTitle"
        titulo="Anexos do candidato"
        subtitulo={`${candidato.nome} · ${candidato.cargo}`}
        aoFechar={fechar}
      />
      <div className="modal-body">
        {anexos.length ? (
          <ul id="approvedAnexosLista" className="approved-anexos-lista">
            {anexos.map((anexo) => (
              <li key={anexo.anexo_id}>
                <span className="approved-anexo-icone">
                  <IconeDePdf />
                </span>
                <div>
                  <strong>{anexo.arquivo_nome}</strong>
                  <small>
                    {formatarTamanho(anexo.tamanho)}
                    {anexo.incluido_em
                      ? ` · ${dataCurta(anexo.incluido_em)}`
                      : ""}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  data-approved-action="abrir-anexo"
                  aria-label={`Abrir ${anexo.arquivo_nome}`}
                  onClick={() => void estado.abrirAnexo(anexo)}
                >
                  <i
                    className="fa-solid fa-arrow-up-right-from-square"
                    aria-hidden="true"
                  />{" "}
                  Abrir
                </button>
                {podeRemover ? (
                  <BotaoDeAcao
                    estado={estado}
                    acao={`remover-anexo:${anexo.anexo_id}`}
                    soIcone
                    className="approved-icone-acao perigo"
                    data-approved-action="remover-anexo"
                    title="Remover anexo"
                    aria-label={`Remover ${anexo.arquivo_nome}`}
                    onClick={() => void estado.removerAnexo(anexo)}
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </BotaoDeAcao>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="approved-empty">Nenhum anexo para este candidato.</p>
        )}
        <div className="approved-modal-actions">
          <button className="btn secondary" type="button" onClick={fechar}>
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}

const cargosDoEdital = (candidatos, editalId) =>
  uniqueCandidateCargos(
    candidatos.filter((row) => String(row.edital_id) === String(editalId)),
  );

/* O edital e o cargo escolhidos; o cargo que não existe no edital cai no primeiro. */
function useEditalECargo(ativas, candidatos, inicial) {
  const [editalId, setEditalId] = useState(() =>
    String(inicial?.edital_id ?? ativas[0]?.edital_id ?? ""),
  );
  const cargos = cargosDoEdital(candidatos, editalId);
  const [cargoEscolhido, setCargo] = useState(
    () => inicial?.cargo ?? cargos[0] ?? "",
  );
  const cargo = cargos.includes(cargoEscolhido)
    ? cargoEscolhido
    : (cargos[0] ?? "");
  return { editalId, setEditalId, cargos, cargo, setCargo };
}

function SelecaoDeEditalECargo({ prefixo, ativas, escolha }) {
  return (
    <>
      <div className="form-row">
        <label htmlFor={`${prefixo}Edital`}>Edital</label>
        <select
          id={`${prefixo}Edital`}
          value={escolha.editalId}
          onChange={(evento) => escolha.setEditalId(evento.target.value)}
        >
          {ativas.map((item) => (
            <option key={item.edital_id} value={String(item.edital_id)}>
              {`${item.edital || "Edital"} · ${item.unidade || ""}`}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor={`${prefixo}Cargo`}>Cargo</label>
        <select
          id={`${prefixo}Cargo`}
          value={escolha.cargo}
          onChange={(evento) => escolha.setCargo(evento.target.value)}
        >
          {escolha.cargos.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

/* Processo judicial e observação: opcionais, nas duas abas. */
function CamposDaDecisao({
  prefixo,
  processo,
  observacao,
  aoMudarProcesso,
  aoMudarObservacao,
}) {
  return (
    <>
      <div className="form-row full">
        <label htmlFor={`${prefixo}Processo`}>
          Processo judicial <small>(opcional)</small>
        </label>
        <input
          id={`${prefixo}Processo`}
          maxLength={100}
          placeholder="Ex.: 1000000-00.2026.4.01.3400"
          value={processo}
          onChange={(evento) => aoMudarProcesso(evento.target.value)}
        />
      </div>
      <div className="form-row full">
        <label htmlFor={`${prefixo}Observacao`}>
          Observação <small>(opcional)</small>
        </label>
        <textarea
          id={`${prefixo}Observacao`}
          rows={2}
          maxLength={1000}
          value={observacao}
          onChange={(evento) => aoMudarObservacao(evento.target.value)}
        />
      </div>
    </>
  );
}

const ABAS_DO_SUB_JUDICE = [
  {
    nome: "novo",
    id: "subJudiceTabNovo",
    painel: "subJudicePainelNovo",
    icone: "fa-user-plus",
    rotulo: "Novo candidato",
  },
  {
    nome: "aprovado",
    id: "subJudiceTabAprovado",
    painel: "subJudicePainelAprovado",
    icone: "fa-gavel",
    rotulo: "Candidato já aprovado",
  },
];

/*
  Sub judice, num formulário com duas abas:
  - Novo candidato: entra na lista vigente pela nota (editor do módulo).
  - Candidato já aprovado: a decisão muda a nota e/ou a modalidade de quem já
    está na lista; o banco guarda o resultado publicado e refaz a
    classificação. Só o admin do módulo vê esta aba; o martelo da linha da
    tabela abre direto nela, com o candidato escolhido.
  As duas abas ficam montadas: trocar de aba não perde o que foi digitado.
*/
export function ModalSubJudice({
  estado,
  perfil,
  listas,
  candidatos,
  aba: abaInicial = "novo",
  candidatoId = "",
}) {
  const ativas = listas.filter((item) => item.ativo);
  const abas = ABAS_DO_SUB_JUDICE.filter((item) =>
    item.nome === "novo"
      ? canManageSubJudice(perfil)
      : canAlterarPorDecisaoJudicial(perfil),
  );
  const tem = (nome) => abas.some((item) => item.nome === nome);
  const [aba, setAba] = useState(() =>
    tem(abaInicial) ? abaInicial : abas[0]?.nome,
  );
  const fechar = estado.fecharModal;

  return (
    <Modal
      id="subJudiceModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card"
      rotuloId="subJudiceTitle"
      aoFechar={fechar}
    >
      <Cabecalho
        tituloId="subJudiceTitle"
        titulo="Sub judice"
        aoFechar={fechar}
      />
      <div className="modal-body">
        {abas.length > 1 ? (
          <Abas
            rotulo="Tipo de sub judice"
            compactas
            ativa={aba}
            aoEscolher={setAba}
            abas={abas.map((item) => ({
              id: item.nome,
              rotulo: item.rotulo,
              icone: item.icone,
              idDaAba: item.id,
              idDoPainel: item.painel,
            }))}
          />
        ) : null}
        {tem("novo") ? (
          <PainelDoNovoCandidato
            ativa={aba === "novo"}
            estado={estado}
            ativas={ativas}
            candidatos={candidatos}
          />
        ) : null}
        {tem("aprovado") ? (
          <PainelDoCandidatoAprovado
            ativa={aba === "aprovado"}
            estado={estado}
            perfil={perfil}
            ativas={ativas}
            candidatos={candidatos}
            candidatoInicial={candidatos.find(
              (row) => String(row.candidato_id) === String(candidatoId),
            )}
          />
        ) : null}
      </div>
    </Modal>
  );
}

function PainelDoNovoCandidato({ ativa, estado, ativas, candidatos }) {
  const [nome, setNome] = useState("");
  const [nota, setNota] = useState("");
  const escolha = useEditalECargo(ativas, candidatos);
  // As do edital inteiro: a decisão pode pôr na cota alguém de um cargo que não tinha cotista.
  const modalidades = candidateModalidadesForEdital(
    candidatos,
    escolha.editalId,
  );
  const [modalidadeEscolhida, setModalidade] = useState("");
  const modalidade = modalidades.includes(modalidadeEscolhida)
    ? modalidadeEscolhida
    : "";
  const [processo, setProcesso] = useState("");
  const [observacao, setObservacao] = useState("");

  return (
    <div
      id="subJudicePainelNovo"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="subJudiceTabNovo"
    >
      <div className="form-grid">
        <div className="form-row full">
          <label htmlFor="subJudiceNome">Nome do candidato</label>
          <input
            id="subJudiceNome"
            data-foco-inicial={ativa || undefined}
            placeholder="Nome completo"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
          />
        </div>
        <SelecaoDeEditalECargo
          prefixo="subJudice"
          ativas={ativas}
          escolha={escolha}
        />
        <div className="form-row">
          <label htmlFor="subJudiceNota">Nota</label>
          <input
            id="subJudiceNota"
            inputMode="decimal"
            placeholder="Ex.: 87,50"
            value={nota}
            onChange={(evento) => setNota(evento.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="subJudiceModalidade">
            Modalidade <small>(opcional)</small>
          </label>
          <select
            id="subJudiceModalidade"
            value={modalidade}
            onChange={(evento) => setModalidade(evento.target.value)}
          >
            <option value="">Sem modalidade</option>
            {modalidades.map((opcao) => (
              <option key={opcao} value={opcao}>
                {modalidadeSemAspas(opcao)}
              </option>
            ))}
          </select>
        </div>
        <CamposDaDecisao
          prefixo="subJudice"
          processo={processo}
          observacao={observacao}
          aoMudarProcesso={setProcesso}
          aoMudarObservacao={setObservacao}
        />
      </div>
      <div className="approved-modal-actions">
        <button
          className="btn secondary"
          type="button"
          onClick={estado.fecharModal}
        >
          Cancelar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao="sub-judice"
          id="subJudiceSave"
          className="btn green"
          onClick={() =>
            void estado.incluirSubJudice({
              editalId: escolha.editalId,
              cargo: escolha.cargo,
              nome,
              nota,
              modalidade,
              processo,
              observacao,
            })
          }
        >
          <i className="fa-solid fa-user-plus" aria-hidden="true" /> Incluir sub
          judice
        </BotaoDeAcao>
      </div>
    </div>
  );
}

const porClassificacao = (a, b) =>
  (a.classificacao ?? Infinity) - (b.classificacao ?? Infinity) ||
  String(a.nome).localeCompare(String(b.nome), "pt-BR");

/* "Nome · 3º · nota 33 · Ampla concorrência": o nome primeiro, para digitar no select. */
const rotuloDoCandidato = (row) =>
  [
    row.nome,
    row.classificacao != null ? `${row.classificacao}º` : "",
    `nota ${formatarNota(row.nota)}`,
    modalidadeSemAspas(row.modalidade),
  ]
    .filter(Boolean)
    .join(" · ");

function PainelDoCandidatoAprovado({
  ativa,
  estado,
  perfil,
  ativas,
  candidatos,
  candidatoInicial,
}) {
  const escolha = useEditalECargo(ativas, candidatos, candidatoInicial);
  const doCargo = candidatos
    .filter(
      (row) =>
        String(row.edital_id) === String(escolha.editalId) &&
        row.cargo === escolha.cargo,
    )
    .sort(porClassificacao);
  const [escolhidoId, setEscolhido] = useState(() =>
    String(candidatoInicial?.candidato_id ?? ""),
  );
  const candidato = doCargo.find(
    (row) => String(row.candidato_id) === escolhidoId,
  );

  return (
    <div
      id="subJudicePainelAprovado"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="subJudiceTabAprovado"
    >
      <div className="form-grid">
        <SelecaoDeEditalECargo
          prefixo="subJudiceAprovado"
          ativas={ativas}
          escolha={escolha}
        />
        <div className="form-row full">
          <label htmlFor="subJudiceAprovadoCandidato">Candidato</label>
          <select
            id="subJudiceAprovadoCandidato"
            data-foco-inicial={ativa || undefined}
            value={candidato ? escolhidoId : ""}
            onChange={(evento) => setEscolhido(evento.target.value)}
          >
            <option value="">Escolha o candidato</option>
            {doCargo.map((row) => (
              <option key={row.candidato_id} value={String(row.candidato_id)}>
                {rotuloDoCandidato(row)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {candidato ? (
        <FormularioDaDecisao
          key={candidato.candidato_id}
          estado={estado}
          perfil={perfil}
          candidato={candidato}
          candidatos={candidatos}
        />
      ) : (
        <div className="approved-modal-actions">
          <button
            className="btn secondary"
            type="button"
            onClick={estado.fecharModal}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

/*
  A decisão sobre o candidato escolhido: os campos começam com a nota e a
  modalidade atuais. Quem já foi alterado mostra o resultado publicado e o
  botão de desfazer (a decisão caiu). `key` = candidato: trocar de candidato
  começa de um rascunho limpo.
*/
function FormularioDaDecisao({ estado, perfil, candidato, candidatos }) {
  const [nota, setNota] = useState(() =>
    candidato.nota == null ? "" : String(candidato.nota).replace(".", ","),
  );
  const modalidades = candidateModalidadesForEdital(
    candidatos,
    candidato.edital_id,
  );
  const [modalidade, setModalidade] = useState(() =>
    String(candidato.modalidade ?? "").trim(),
  );
  const [processo, setProcesso] = useState("");
  const [observacao, setObservacao] = useState("");
  const alteracao = alteracaoJudicial(candidato);

  return (
    <>
      {alteracao ? (
        <p className="approved-decisao-original">
          Já alterado por decisão judicial. Resultado publicado: nota{" "}
          {formatarNota(alteracao.nota?.de ?? candidato.nota)}
          {" · "}
          {modalidadeSemAspas(
            alteracao.modalidade?.de ?? candidato.modalidade,
          ) || "sem modalidade"}
          {alteracao.classificacaoOriginal != null
            ? ` · ${alteracao.classificacaoOriginal}º`
            : ""}
        </p>
      ) : null}
      <div className="form-grid">
        <div className="form-row">
          <label htmlFor="alteracaoJudicialNota">Nota nova</label>
          <input
            id="alteracaoJudicialNota"
            inputMode="decimal"
            value={nota}
            onChange={(evento) => setNota(evento.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="alteracaoJudicialModalidade">Modalidade</label>
          <select
            id="alteracaoJudicialModalidade"
            value={modalidade}
            onChange={(evento) => setModalidade(evento.target.value)}
          >
            {modalidade && !modalidades.includes(modalidade) ? (
              <option value={modalidade}>
                {modalidadeSemAspas(modalidade)}
              </option>
            ) : null}
            {!modalidade ? <option value="">Sem modalidade</option> : null}
            {modalidades.map((opcao) => (
              <option key={opcao} value={opcao}>
                {modalidadeSemAspas(opcao)}
              </option>
            ))}
          </select>
        </div>
        <CamposDaDecisao
          prefixo="alteracaoJudicial"
          processo={processo}
          observacao={observacao}
          aoMudarProcesso={setProcesso}
          aoMudarObservacao={setObservacao}
        />
      </div>
      <p className="approved-field-hint">
        A classificação da vaga é refeita pela nota nova, e o candidato passa a
        aparecer como sub judice.
      </p>
      <div className="approved-modal-actions">
        {canDesfazerAlteracaoSubJudice(perfil, candidato) ? (
          <BotaoDeAcao
            estado={estado}
            acao="desfazer-alteracao-judicial"
            id="alteracaoJudicialDesfazer"
            className="btn secondary"
            onClick={() =>
              void estado.desfazerAlteracaoSubJudice(
                candidato.candidato_id,
                observacao,
              )
            }
          >
            <i className="fa-solid fa-rotate-left" aria-hidden="true" />{" "}
            Desfazer alteração
          </BotaoDeAcao>
        ) : null}
        <button
          className="btn secondary"
          type="button"
          onClick={estado.fecharModal}
        >
          Cancelar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao="alteracao-judicial"
          id="alteracaoJudicialSalvar"
          className="btn green"
          onClick={() =>
            void estado.alterarSubJudice(candidato.candidato_id, {
              nota,
              modalidade,
              processo,
              observacao,
            })
          }
        >
          <i className="fa-solid fa-gavel" aria-hidden="true" /> Salvar decisão
        </BotaoDeAcao>
      </div>
    </>
  );
}
