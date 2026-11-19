import { useId } from "react";
import { formatarNumero } from "../../lib/mapas/mapa-saude-indigena/chaves.ts";
import {
  arquivoDaTabela,
  nomeDoArquivoExportado,
} from "../../lib/base/exportacao-da-tabela.ts";
import type {
  FormatoDaExportacao,
  TabelaParaExportar,
} from "../../lib/base/exportacao-da-tabela.ts";
import {
  OPCOES_DE_FLORESTA,
  OPCOES_DE_LOCALIDADE,
  OPCOES_DE_MEIO,
  TEXTO_DA_FONTE_INDISPONIVEL,
  tabelaDasUnidades,
  tabelaDoCruzamento,
  textoDosMeios,
} from "../../lib/mapas/mapa-saude-indigena/territorio-na-tela.ts";
import type {
  FiltroDeAcesso,
  LinhaDoCruzamento,
  SituacaoDaFonte,
  UnidadeComAcesso,
} from "../../lib/mapas/mapa-saude-indigena/territorio-na-tela.ts";
import type { TerritorioDoDsei } from "../../lib/mapas/mapa-saude-indigena/territorio-do-sigepsi.ts";
import type { DseiDoMapa } from "../../lib/mapas/mapa-saude-indigena/tipos.ts";
import { CardDaLista, TabelaDaLista, baixarArquivo } from "../../ui/index.ts";

/*
  O TERRITÓRIO, O ACESSO E O CNES DO SIGEPSI NA ABA MAPA

  - `CartaoDoTerritorio`: população indígena, aldeias e terras indígenas do
    DSEI aberto (`/territorio` do SIGEPSI).
  - `FiltrosDeAcesso`: meio de acesso, área de floresta e categoria da localidade, os mesmos para o
    Brasil e para o DSEI (o estado mora em MapaSaudeIndigena).
  - `UnidadesDoDsei`: a tabela das unidades do DSEI com acesso e CNES,
    exportável (Exportar em Excel / Salvar em PDF, padrão do #904).
  - `AcessoNoBrasil`: os DSEIs com unidade no filtro, ao lado das vagas
    ociosas deles.

  Fonte negada ou fora do ar: "Dado do SIGEPSI indisponível" no lugar, nunca
  zero. A explicação dos números é da Aya (docs/aya/), não da tela.
*/

const valorOuTraco = (n: number | null) =>
  n === null ? "—" : formatarNumero(n);

function exportar(tabela: TabelaParaExportar, partes: string[]) {
  return async (formato: FormatoDaExportacao) => {
    const quando = new Date();
    const arquivo = await arquivoDaTabela(formato, tabela, quando);
    baixarArquivo(
      arquivo.bytes,
      nomeDoArquivoExportado(
        [...partes, quando.toISOString().slice(0, 10)],
        arquivo.extensao,
      ),
      arquivo.tipo,
    );
  };
}

function Indisponivel({ motivo }: { motivo: string }) {
  return (
    <p className="mapa-si-indisponivel" title={motivo}>
      {TEXTO_DA_FONTE_INDISPONIVEL}
    </p>
  );
}

export function CartaoDoTerritorio({
  situacao,
  territorio,
}: {
  situacao: SituacaoDaFonte<unknown>;
  territorio: TerritorioDoDsei | null;
}) {
  const titulo = useId();
  let corpo;
  if (situacao.tipo === "carregando")
    corpo = <p aria-busy="true">Carregando…</p>;
  else if (situacao.tipo === "indisponivel")
    corpo = <Indisponivel motivo={situacao.motivo} />;
  else if (!territorio)
    corpo = <Indisponivel motivo="o DSEI não veio no território do SIGEPSI" />;
  else
    corpo = (
      <dl className="mapa-si-resumo__indicadores mapa-si-processos__numeros">
        <div>
          <dt>População indígena</dt>
          <dd>{valorOuTraco(territorio.populacao)}</dd>
        </div>
        <div>
          <dt>Aldeias</dt>
          <dd>{valorOuTraco(territorio.aldeias)}</dd>
        </div>
        <div>
          <dt>Terras indígenas</dt>
          <dd>{valorOuTraco(territorio.terras)}</dd>
        </div>
      </dl>
    );
  return (
    <section
      className="mapa-si-resumo mapa-si-territorio-do-dsei"
      aria-labelledby={titulo}
    >
      <div className="mapa-si-resumo__introducao">
        <h2 id={titulo}>Território</h2>
      </div>
      {corpo}
    </section>
  );
}

export function FiltrosDeAcesso({
  filtro,
  aoMudar,
}: {
  filtro: FiltroDeAcesso;
  aoMudar(filtro: FiltroDeAcesso): void;
}) {
  return (
    <div
      className="mapa-si-filtros-de-acesso"
      role="group"
      aria-label="Filtrar pelo acesso"
    >
      <label className="mapa-si-resumo__seletor">
        <span>Meio de acesso</span>
        <select
          value={filtro.meio}
          onChange={(e) => aoMudar({ ...filtro, meio: e.target.value })}
        >
          <option value="">Todos</option>
          {OPCOES_DE_MEIO.map((meio) => (
            <option key={meio} value={meio}>
              {meio}
            </option>
          ))}
        </select>
      </label>
      <label className="mapa-si-resumo__seletor">
        <span>Área de floresta</span>
        <select
          value={filtro.floresta}
          onChange={(e) => aoMudar({ ...filtro, floresta: e.target.value })}
        >
          <option value="">Todas</option>
          {OPCOES_DE_FLORESTA.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      </label>
      <label className="mapa-si-resumo__seletor">
        <span>Categoria da localidade</span>
        <select
          value={filtro.localidade}
          onChange={(e) => aoMudar({ ...filtro, localidade: e.target.value })}
        >
          <option value="">Todas</option>
          {OPCOES_DE_LOCALIDADE.map((opcao) => (
            <option key={opcao} value={opcao}>
              {opcao}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

const celula = (texto: string | null) => (texto === null ? "—" : texto || "—");

export function UnidadesDoDsei({
  dsei,
  unidades,
  todas,
  acesso,
  cnes,
  filtro,
  aoMudarFiltro,
}: {
  dsei: DseiDoMapa;
  /** As do filtro. */
  unidades: readonly UnidadeComAcesso[];
  todas: number;
  acesso: SituacaoDaFonte<unknown>;
  cnes: SituacaoDaFonte<unknown>;
  filtro: FiltroDeAcesso;
  aoMudarFiltro(filtro: FiltroDeAcesso): void;
}) {
  const comAcesso = acesso.tipo === "pronta";
  const comCnes = cnes.tipo === "pronta";
  const colunas = [
    { rotulo: "Unidade" },
    { rotulo: "Tipo" },
    { rotulo: "Município" },
    ...(comAcesso
      ? [
          { rotulo: "Meio de acesso" },
          { rotulo: "Acessibilidade" },
          { rotulo: "Urbano/rural" },
          { rotulo: "Floresta" },
        ]
      : []),
    ...(comCnes ? [{ rotulo: "CNES", numero: true }] : []),
  ];
  const tabela = tabelaDasUnidades(dsei.n, unidades, filtro);
  const baixar = exportar(tabela, ["unidades", dsei.n]);
  return (
    <CardDaLista
      rotulo={`Unidades do DSEI ${dsei.n}`}
      className="mapa-si-unidades"
    >
      <div className="mapa-si-unidades__topo">
        <h2 className="ui-titulo">
          Unidades{" "}
          <span className="mapa-si-painel__contagem">
            {unidades.length === todas
              ? formatarNumero(todas)
              : `${formatarNumero(unidades.length)} de ${formatarNumero(todas)}`}
          </span>
        </h2>
        {comAcesso ? (
          <FiltrosDeAcesso filtro={filtro} aoMudar={aoMudarFiltro} />
        ) : null}
      </div>
      {acesso.tipo === "indisponivel" ? (
        <p className="mapa-si-indisponivel" title={acesso.motivo}>
          Meio de acesso e floresta: {TEXTO_DA_FONTE_INDISPONIVEL}
        </p>
      ) : null}
      {cnes.tipo === "indisponivel" ? (
        <p className="mapa-si-indisponivel" title={cnes.motivo}>
          CNES: {TEXTO_DA_FONTE_INDISPONIVEL}
        </p>
      ) : null}
      <TabelaDaLista
        rotulo={`Unidades do DSEI ${dsei.n}`}
        classeDaTabela="mapa-si-unidades__tabela"
        colunas={colunas}
        itens={unidades}
        carregado={acesso.tipo !== "carregando" && cnes.tipo !== "carregando"}
        chaveDoRecorte={`${dsei.k}|${filtro.meio}|${filtro.floresta}|${filtro.localidade}`}
        vazio={
          todas
            ? "Nenhuma unidade com esses filtros."
            : "Nenhuma unidade georreferenciada."
        }
        exportacao={{
          excel: () => baixar("excel"),
          pdf: () => baixar("pdf"),
          desativado: !unidades.length,
        }}
        linha={(u) => (
          <tr key={u.chave}>
            <td>{u.nome}</td>
            <td>{u.tipo}</td>
            <td>{celula(u.municipio)}</td>
            {comAcesso ? (
              <>
                <td>{textoDosMeios(u.meios)}</td>
                <td>{celula(u.acessibilidade)}</td>
                <td>{celula(u.localidade)}</td>
                <td>{celula(u.floresta)}</td>
              </>
            ) : null}
            {comCnes ? <td>{celula(u.cnes)}</td> : null}
          </tr>
        )}
      />
    </CardDaLista>
  );
}

export function AcessoNoBrasil({
  linhas,
  acesso,
  filtro,
  aoMudarFiltro,
  aoEscolher,
}: {
  linhas: readonly LinhaDoCruzamento[];
  acesso: SituacaoDaFonte<unknown>;
  filtro: FiltroDeAcesso;
  aoMudarFiltro(filtro: FiltroDeAcesso): void;
  aoEscolher(k: string): void;
}) {
  const unidades = linhas.reduce((t, l) => t + l.unidades, 0);
  const ociosas = linhas.reduce((t, l) => t + l.ociosas, 0);
  const tabela = tabelaDoCruzamento(linhas, filtro);
  const baixar = exportar(tabela, ["acesso-e-vagas-ociosas"]);
  return (
    <CardDaLista rotulo="Acesso e vagas ociosas" className="mapa-si-unidades">
      <div className="mapa-si-unidades__topo">
        <h2 className="ui-titulo">Acesso e vagas ociosas</h2>
        {acesso.tipo === "pronta" ? (
          <FiltrosDeAcesso filtro={filtro} aoMudar={aoMudarFiltro} />
        ) : null}
      </div>
      {acesso.tipo === "indisponivel" ? (
        <Indisponivel motivo={acesso.motivo} />
      ) : (
        <>
          <dl className="mapa-si-resumo__indicadores mapa-si-processos__numeros">
            <div>
              <dt>DSEIs</dt>
              <dd>{formatarNumero(linhas.length)}</dd>
            </div>
            <div>
              <dt>Unidades</dt>
              <dd>{formatarNumero(unidades)}</dd>
            </div>
            <div>
              <dt>Vagas ociosas</dt>
              <dd>{formatarNumero(ociosas)}</dd>
            </div>
          </dl>
          <TabelaDaLista
            rotulo="DSEIs por acesso das unidades"
            classeDaTabela="mapa-si-unidades__tabela"
            colunas={[
              { rotulo: "DSEI" },
              { rotulo: "Unidades no filtro", numero: true },
              { rotulo: "Vagas", numero: true },
              { rotulo: "Vagas ociosas", numero: true },
            ]}
            itens={linhas}
            carregado={acesso.tipo === "pronta"}
            chaveDoRecorte={`${filtro.meio}|${filtro.floresta}|${filtro.localidade}`}
            vazio="Nenhum DSEI com unidade nesses filtros."
            exportacao={{
              excel: () => baixar("excel"),
              pdf: () => baixar("pdf"),
              desativado: !linhas.length,
            }}
            linha={(l) => (
              <tr key={l.k}>
                <td>
                  <button
                    type="button"
                    className="mapa-si-link"
                    onClick={() => aoEscolher(l.k)}
                  >
                    {l.nome}
                  </button>
                </td>
                <td className="num">
                  {l.unidades === l.totalDeUnidades
                    ? formatarNumero(l.unidades)
                    : `${formatarNumero(l.unidades)} de ${formatarNumero(l.totalDeUnidades)}`}
                </td>
                <td className="num">{formatarNumero(l.vagas)}</td>
                <td className="num">{formatarNumero(l.ociosas)}</td>
              </tr>
            )}
          />
        </>
      )}
    </CardDaLista>
  );
}
