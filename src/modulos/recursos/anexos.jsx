import { useRef, useState } from "react";
import {
  ACEITA_NO_SELETOR,
  rotuloDoTipoDeAnexo,
  tamanhoLegivel,
  TIPOS_DE_ANEXO,
  validarArquivoDoAnexo,
} from "../../lib/anexos-do-recurso.js";
import { Secao } from "../../ui/index.js";
import { dataHora } from "./partes.ts";

/*
  "Anexos", na gaveta do recurso: os arquivos do recurso (o recurso do
  candidato, documentos, o documento da resposta), com quem anexou e quando.
  Baixar registra o download no banco e abre a URL assinada (60 s) numa aba
  nova. Quem edita anexa (PDF, DOCX, DOC, JPG, PNG ou ODT, até 20 MB) e
  arquiva com motivo — o arquivo continua guardado; os arquivados ficam
  recolhidos, e só quem edita os baixa.
*/

function LinhaDoAnexo({ estado, recursoId, anexo, podeEditar, acao }) {
  const [arquivando, setArquivando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const baixando = acao?.tipo === `anexo:baixar:${anexo.id}`;
  const podeBaixar = anexo.ativo || podeEditar;
  return (
    <li className="recursos-anexo" data-ativo={anexo.ativo || undefined}>
      <div className="recursos-anexo-linha">
        <i
          className={`fa-solid ${anexo.mime?.startsWith("image/") ? "fa-file-image" : "fa-file-lines"}`}
          aria-hidden="true"
        />
        <span className="recursos-anexo-nome">
          <b>{anexo.nome}</b>
          <small>
            {[
              rotuloDoTipoDeAnexo(anexo.tipo),
              tamanhoLegivel(anexo.bytes),
              dataHora(anexo.incluido_em),
              anexo.incluido_por,
            ]
              .filter(Boolean)
              .join(" · ")}
          </small>
          {!anexo.ativo ? (
            <small>
              Arquivado{" "}
              {[dataHora(anexo.arquivado_em), anexo.arquivado_por]
                .filter(Boolean)
                .join(" · ")}
              {anexo.motivo_arquivamento
                ? `: ${anexo.motivo_arquivamento}`
                : ""}
            </small>
          ) : null}
        </span>
        <span className="ui-acoes">
          {podeBaixar ? (
            <button
              type="button"
              className="btn secondary small"
              disabled={Boolean(acao)}
              aria-label={`Baixar ${anexo.nome}`}
              onClick={() => void estado.baixarAnexo(anexo)}
            >
              <i className="fa-solid fa-download" aria-hidden="true" />{" "}
              {baixando ? acao.rotulo : "Baixar"}
            </button>
          ) : null}
          {podeEditar && anexo.ativo && !arquivando ? (
            <button
              type="button"
              className="btn secondary small"
              disabled={Boolean(acao)}
              aria-label={`Arquivar ${anexo.nome}`}
              onClick={() => setArquivando(true)}
            >
              <i className="fa-solid fa-box-archive" aria-hidden="true" />{" "}
              Arquivar
            </button>
          ) : null}
        </span>
      </div>
      {arquivando ? (
        <form
          className="recursos-anexo-arquivar"
          onSubmit={async (evento) => {
            evento.preventDefault();
            const ok = await estado.arquivarAnexo(
              recursoId,
              anexo.id,
              motivo.trim(),
            );
            if (ok) setArquivando(false);
          }}
        >
          <div className="ui-campo">
            <label htmlFor={`recursosMotivoAnexo-${anexo.id}`}>
              Motivo do arquivamento
            </label>
            <input
              id={`recursosMotivoAnexo-${anexo.id}`}
              name="motivo"
              value={motivo}
              minLength={3}
              maxLength={500}
              required
              data-foco-inicial
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          </div>
          <div className="ui-acoes">
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setArquivando(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn danger small"
              disabled={motivo.trim().length < 3 || Boolean(acao)}
            >
              Arquivar anexo
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function EnviarAnexo({ estado, recursoId, acao }) {
  const [tipo, setTipo] = useState("recurso_candidato");
  const [arquivo, setArquivo] = useState(null);
  const campo = useRef(null);
  const erro = arquivo ? validarArquivoDoAnexo(arquivo).erro : "";
  const enviando = acao?.tipo === "anexo:enviar";
  return (
    <form
      className="recursos-anexo-envio"
      onSubmit={async (evento) => {
        evento.preventDefault();
        if (!arquivo || erro) return;
        const ok = await estado.enviarAnexo(recursoId, arquivo, tipo);
        if (ok) {
          setArquivo(null);
          if (campo.current) campo.current.value = "";
        }
      }}
    >
      <div className="ui-campo">
        <label htmlFor="recursosTipoDoAnexo">Tipo</label>
        <select
          id="recursosTipoDoAnexo"
          name="tipo"
          value={tipo}
          onChange={(evento) => setTipo(evento.target.value)}
        >
          {TIPOS_DE_ANEXO.map((t) => (
            <option key={t.id} value={t.id}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </div>
      <div className="ui-campo">
        <label htmlFor="recursosArquivoDoAnexo">Arquivo</label>
        <input
          id="recursosArquivoDoAnexo"
          ref={campo}
          type="file"
          name="arquivo"
          accept={ACEITA_NO_SELETOR}
          onChange={(evento) => setArquivo(evento.target.files?.[0] || null)}
        />
        <small className={erro ? "recursos-erro-campo" : "recursos-motivo"}>
          {erro || "PDF, DOCX, DOC, JPG, PNG ou ODT, até 20 MB."}
        </small>
      </div>
      <div className="ui-acoes">
        <button
          type="submit"
          className="btn small"
          disabled={!arquivo || Boolean(erro) || Boolean(acao)}
        >
          <i className="fa-solid fa-paperclip" aria-hidden="true" />{" "}
          {enviando ? acao.rotulo : "Anexar"}
        </button>
      </div>
    </form>
  );
}

export function SecaoDeAnexos({ estado, recurso, detalhe, podeEditar, acao }) {
  if (!detalhe || detalhe.erro) return null;
  const anexos = Array.isArray(detalhe.anexos) ? detalhe.anexos : [];
  const ativos = anexos.filter((a) => a.ativo);
  const arquivados = anexos.filter((a) => !a.ativo);
  const linha = (anexo) => (
    <LinhaDoAnexo
      key={anexo.id}
      estado={estado}
      recursoId={recurso.id}
      anexo={anexo}
      podeEditar={podeEditar}
      acao={acao}
    />
  );
  return (
    <Secao icone="fa-paperclip" titulo="Anexos" secao="anexos">
      <div className="recursos-anexos">
        {ativos.length ? (
          <ul className="recursos-lista-de-anexos">{ativos.map(linha)}</ul>
        ) : (
          <div className="ui-secao-texto">
            <span className="ui-secao-vazio">Nenhum anexo.</span>
          </div>
        )}
        {arquivados.length ? (
          <details className="recursos-anexos-arquivados">
            <summary>
              {arquivados.length} arquivado
              {arquivados.length === 1 ? "" : "s"}
            </summary>
            <ul className="recursos-lista-de-anexos">
              {arquivados.map(linha)}
            </ul>
          </details>
        ) : null}
        {podeEditar ? (
          <EnviarAnexo estado={estado} recursoId={recurso.id} acao={acao} />
        ) : null}
      </div>
    </Secao>
  );
}
