import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RESPONSAVEIS_DE_EDITAL } from "../../lib/responsavel-do-edital.js";
import {
  coordenacaoParaSalvar,
  coordenacaoVazia,
  lerCoordenacao,
  opcoesDeEditaisDaCoordenacao,
  opcoesDeUnidadesDaCoordenacao,
  resumoDaCoordenacao,
  validarCoordenacao,
} from "../../lib/grupos-e-coordenacoes.js";
import {
  assinarDadosDoMonitoramento,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.ts";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.jsx";
import { BlocosEsqueleto, BotaoDeAcao, Campo } from "../../ui/index.js";
import { CampoMotivo, ListaMestre, motivoValido } from "./partes.jsx";

/*
  Coordenações (só admin global), no padrão lista + detalhe. Cada uma
  subdivide uma área. O que ela vê: sem responsável, unidades nem editais → a
  área inteira; só editais → só esses; com responsável e/ou unidades → os
  editais que casam a regra, mais os atribuídos. O banco calcula
  (FC_EDITAIS_DA_COORDENACAO).
*/

const NOVA = "__nova__";
const mesmo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function Editor({
  estado,
  coordenacao,
  existentes,
  areas,
  aoSalvar,
  aoAlterar,
}) {
  const dados = useSyncExternalStore(
    assinarDadosDoMonitoramento,
    obterDadosDoMonitoramento,
  );
  const inicial = coordenacao
    ? lerCoordenacao(coordenacao)
    : coordenacaoVazia(areas[0]?.id || "");
  const [rascunho, setRascunho] = useState(inicial);
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const [unidadesPorArea, setUnidadesPorArea] = useState([]);
  useEffect(() => {
    let vivo = true;
    void estado
      .lerUnidadesPorArea()
      .then((lista) => vivo && setUnidadesPorArea(lista));
    return () => {
      vivo = false;
    };
  }, [estado]);

  const unidadesDe = (area, responsavel) =>
    opcoesDeUnidadesDaCoordenacao({
      area,
      responsavel,
      catalogo: dados.unidades,
      linhas: dados.linhas,
      unidadesPorArea,
    });
  const editaisDe = (area) =>
    opcoesDeEditaisDaCoordenacao(linhasDaArea(dados.linhas, area));
  const opcoesDeUnidades = unidadesDe(rascunho.area, rascunho.responsavel);
  const opcoesDeEditais = editaisDe(rascunho.area);

  const erros = validarCoordenacao(rascunho, { existentes });
  const nova = rascunho.revisao === null;
  const alterado = !mesmo(rascunho, inicial);
  useEffect(() => {
    aoAlterar(alterado);
  }, [alterado, aoAlterar]);

  // Trocar área ou responsável poda o que deixou de valer.
  function mudar(campo, valor) {
    const proximo = { ...rascunho, [campo]: valor };
    if (campo === "area" || campo === "responsavel") {
      const unidades = new Set(
        unidadesDe(proximo.area, proximo.responsavel).map((o) => o.value),
      );
      proximo.unidades = proximo.unidades.filter((u) => unidades.has(u));
    }
    if (campo === "area") {
      const editais = new Set(editaisDe(proximo.area).map((o) => o.value));
      proximo.editais = proximo.editais.filter((e) => editais.has(e));
    }
    setRascunho(proximo);
  }

  async function salvar(evento) {
    evento.preventDefault();
    setTentou(true);
    if (Object.keys(erros).length || !motivoValido(motivo)) return;
    const resposta = await estado.salvarCoordenacao(
      coordenacaoParaSalvar(rascunho),
      motivo.trim(),
    );
    if (resposta)
      aoSalvar(resposta.codigo || coordenacaoParaSalvar(rascunho).codigo);
  }

  function desativar() {
    const motivoDaDesativacao = window.prompt(
      `Desativar a coordenação "${coordenacao.nome}"? Informe o motivo:`,
    );
    if (motivoValido(motivoDaDesativacao))
      void estado.desativarCoordenacao(coordenacao, motivoDaDesativacao.trim());
  }

  const erro = (campo) => (tentou && erros[campo]) || undefined;

  return (
    <form
      className="acessos-detalhe"
      data-tour="acessos-coordenacao-editor"
      onSubmit={salvar}
      noValidate
      aria-label={nova ? "Nova coordenação" : `Coordenação ${coordenacao.nome}`}
    >
      <header className="acessos-detalhe-cabecalho">
        <Campo rotulo="Nome da coordenação" erro={erro("nome")}>
          <input
            id="acessosCoordNome"
            value={rascunho.nome}
            maxLength={120}
            onChange={(e) => mudar("nome", e.target.value)}
          />
        </Campo>
        {!nova ? (
          <p className="acessos-secundario">
            {coordenacao.usuarios || 0}{" "}
            {coordenacao.usuarios === 1 ? "pessoa" : "pessoas"} ·{" "}
            {coordenacao.ativo ? "Ativa" : "Desativada"}
          </p>
        ) : null}
      </header>

      <h4>Recorte</h4>
      <p className="acessos-secundario">
        Vê: <strong>{resumoDaCoordenacao(rascunho)}</strong>.
      </p>
      <div
        className="acessos-grade-campos"
        data-tour="acessos-coordenacao-area"
      >
        <Campo rotulo="Área" erro={erro("area")}>
          <select
            id="acessosCoordArea"
            value={rascunho.area}
            onChange={(e) => mudar("area", e.target.value)}
          >
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.titulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Responsável do edital">
          <select
            id="acessosCoordResponsavel"
            value={rascunho.responsavel}
            onChange={(e) => mudar("responsavel", e.target.value)}
          >
            <option value="">Qualquer um</option>
            {RESPONSAVEIS_DE_EDITAL.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Unidades" idDoControle="acessosCoordUnidades">
        <MultiSelectBusca
          id="acessosCoordUnidades"
          opcoes={opcoesDeUnidades}
          selecionados={rascunho.unidades}
          placeholder="Todas as unidades da área"
          aoMudar={(unidades) => mudar("unidades", unidades)}
        />
      </Campo>
      <Campo
        rotulo={
          <>
            Editais atribuídos{" "}
            <span className="acessos-secundario">(além da regra)</span>
          </>
        }
        idDoControle="acessosCoordEditais"
      >
        <MultiSelectBusca
          id="acessosCoordEditais"
          opcoes={opcoesDeEditais}
          selecionados={rascunho.editais}
          placeholder="Nenhum"
          aoMudar={(editais) => mudar("editais", editais)}
        />
      </Campo>

      <footer className="acessos-detalhe-rodape">
        {alterado || nova ? (
          <CampoMotivo
            id="acessosCoordMotivo"
            valor={motivo}
            aoMudar={setMotivo}
            erro={tentou && !motivoValido(motivo)}
          />
        ) : null}
        <div className="ui-acoes">
          {!nova && coordenacao.ativo ? (
            <BotaoDeAcao
              estado={estado}
              acao="desativar-coordenacao"
              className="btn ghost perigo"
              disabled={Boolean(coordenacao.usuarios)}
              title={
                coordenacao.usuarios
                  ? "Há pessoas nesta coordenação: mude-as de coordenação antes."
                  : undefined
              }
              onClick={desativar}
            >
              Desativar coordenação
            </BotaoDeAcao>
          ) : null}
          <span className="acessos-espaco" />
          {alterado ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => (setRascunho(inicial), setTentou(false))}
            >
              Descartar
            </button>
          ) : null}
          <BotaoDeAcao
            estado={estado}
            acao="coordenacao"
            type="submit"
            data-tour="acessos-coordenacao-salvar"
            className="btn primary"
            disabled={!alterado && !nova}
          >
            {nova ? "Criar coordenação" : "Salvar coordenação"}
          </BotaoDeAcao>
        </div>
      </footer>
    </form>
  );
}

export function AbaCoordenacoes({ estado }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  const coordenacoes = atual.matriz?.coordenacoes || [];
  const areas = atual.matriz?.areas || [];
  const nomeDaArea = new Map(areas.map((a) => [a.id, a.titulo]));
  const [selecionada, setSelecionada] = useState(null);
  const alterado = useRef(false);
  const aoAlterar = useRef((valor) => (alterado.current = valor)).current;
  const escolher = (codigo) => {
    if (
      alterado.current &&
      !estado.confirmar("Descartar as alterações desta coordenação?")
    )
      return;
    alterado.current = false;
    setSelecionada(codigo);
  };
  const escolhida = selecionada ?? coordenacoes[0]?.codigo ?? NOVA;
  const coordenacao = coordenacoes.find((c) => c.codigo === escolhida) || null;

  if (!atual.matriz)
    return (
      <div className="acessos-carregando" aria-busy="true">
        <BlocosEsqueleto quantos={3} className="acessos-esqueleto" />
      </div>
    );

  return (
    <section
      className="acessos-mestre-detalhe"
      aria-label="Coordenações"
      data-tour="acessos-coordenacoes"
    >
      <ListaMestre
        rotulo="Coordenações"
        rotuloCriar="Nova coordenação"
        aoCriar={() => escolher(NOVA)}
        selecionado={escolhida}
        aoEscolher={escolher}
        itens={coordenacoes.map((c) => ({
          id: c.codigo,
          titulo: c.nome,
          detalhe: `${nomeDaArea.get(c.area) || c.area}${c.ativo ? "" : " · Desativada"}`,
        }))}
      />
      <Editor
        key={`${escolhida}-${coordenacao?.revisao ?? "nova"}`}
        estado={estado}
        coordenacao={escolhida === NOVA ? null : coordenacao}
        existentes={coordenacoes}
        areas={areas}
        aoSalvar={(codigo) => (
          (alterado.current = false),
          setSelecionada(codigo)
        )}
        aoAlterar={aoAlterar}
      />
    </section>
  );
}
