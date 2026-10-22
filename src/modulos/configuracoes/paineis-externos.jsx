import { useSyncExternalStore } from "react";
import {
  chaveDoErroDoPainel,
  resumoDosPaineis,
  SELO_DA_SITUACAO,
  situacaoDoPainel,
} from "../../lib/paineis-externos-das-configuracoes.js";
import { EstadoVazio, Selo } from "../../ui/index.js";
import { Previa } from "./partes.jsx";

/*
  Configurações › Painéis externos: título, endereço, ativo e manutenção de
  cada painel da TB_PAINEL_EXTERNO, com o resumo ao lado. Os painéis vêm do
  estado (o legado publica em `loadPanels`) e as edições vão na publicação da
  barra fixa, em `p_paineis`.
*/

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const idDoCampo = (indice, campo) => `configPainel-${indice}-${campo}`;

function LinhaDoPainel({ estado, painel, indice }) {
  const erro = estado
    .obter()
    .errosDosCampos.get(chaveDoErroDoPainel(painel.id));
  const selo = SELO_DA_SITUACAO[situacaoDoPainel(painel)];
  const idDaUrl = idDoCampo(indice, "url");
  const mudar = (campo) => (evento) =>
    estado.mudarPainel(painel.id, campo, evento.target.value);
  const mudarSimNao = (campo) => (evento) =>
    estado.mudarPainel(painel.id, campo, evento.target.value === "true");
  return (
    <tr data-painel={painel.id}>
      <td>
        <input
          id={idDoCampo(indice, "titulo")}
          value={painel.titulo}
          aria-label={`Título do painel ${painel.nome}`}
          onChange={mudar("titulo")}
        />
        <small>Código: {painel.codigo || "—"}</small>
      </td>
      <td>
        <input
          id={idDaUrl}
          type="url"
          placeholder="https://"
          value={painel.url}
          aria-label={`Endereço do painel ${painel.nome}`}
          className={erro ? "config-field-invalid" : undefined}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${idDaUrl}-erro` : undefined}
          onChange={mudar("url")}
        />
        {erro ? (
          <small id={`${idDaUrl}-erro`} className="ui-campo-erro">
            {erro}
          </small>
        ) : null}
      </td>
      <td>
        <select
          id={idDoCampo(indice, "ativo")}
          value={String(painel.ativo)}
          aria-label={`Painel ${painel.nome} ativo`}
          onChange={mudarSimNao("ativo")}
        >
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </td>
      <td>
        <select
          id={idDoCampo(indice, "manutencao")}
          value={String(painel.em_manutencao)}
          aria-label={`Painel ${painel.nome} em manutenção`}
          onChange={mudarSimNao("em_manutencao")}
        >
          <option value="false">Não</option>
          <option value="true">Sim</option>
        </select>
      </td>
      <td>
        <Selo tom={selo.tom}>{selo.rotulo}</Selo>
      </td>
    </tr>
  );
}

const FAIXAS = Object.freeze([
  ["ativo", "Ativos", "sucesso"],
  ["manutencao", "Em manutenção", "atencao"],
  ["semUrl", "Sem endereço", "neutro"],
  ["inativo", "Inativos", "perigo"],
]);

function ResumoDosPaineis({ paineis }) {
  const resumo = resumoDosPaineis(paineis);
  return (
    <Previa rotulo="Resumo dos painéis externos">
      <div className="previa-recursos">
        <strong className="previa-recursos__titulo">
          {plural(resumo.total, "painel externo", "painéis externos")}
        </strong>
        {resumo.total ? (
          <div
            className="previa-recursos__barra"
            role="img"
            aria-label={FAIXAS.map(
              ([chave, rotulo]) => `${rotulo}: ${resumo[chave]}`,
            ).join(", ")}
          >
            {FAIXAS.filter(([chave]) => resumo[chave]).map(([chave, , tom]) => (
              <span
                key={chave}
                data-tom={tom}
                style={{ flex: String(resumo[chave]) }}
              />
            ))}
          </div>
        ) : null}
        <ul className="previa-recursos__lista">
          {FAIXAS.map(([chave, rotulo, tom]) => (
            <li key={chave} data-tom={tom}>
              <span className="previa-recursos__marca" aria-hidden="true" />
              {rotulo}
              <strong>{resumo[chave]}</strong>
            </li>
          ))}
        </ul>
      </div>
    </Previa>
  );
}

export function SecaoPaineisExternos({ estado }) {
  // Assina o estado: cada tecla redesenha a tabela e o resumo.
  useSyncExternalStore(estado.assinar, estado.obter);
  const paineis = estado.paineisAtuais();
  return (
    <div
      className="config-secao-react config-secao-react--com-previa"
      data-tour="config-recursos"
    >
      <div className="config-secao-react__campos">
        {paineis.length ? (
          <div
            className="painel-externo-tabela"
            data-tour="config-recursos-tabela"
          >
            <table data-mobile-table="scroll">
              <thead>
                <tr>
                  <th scope="col">Painel</th>
                  <th scope="col">Endereço</th>
                  <th scope="col">Ativo</th>
                  <th scope="col">Em manutenção</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {paineis.map((painel, indice) => (
                  <LinhaDoPainel
                    key={painel.id || indice}
                    estado={estado}
                    painel={painel}
                    indice={indice}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>Nenhum painel externo cadastrado.</EstadoVazio>
        )}
      </div>
      <ResumoDosPaineis paineis={paineis} />
    </div>
  );
}
