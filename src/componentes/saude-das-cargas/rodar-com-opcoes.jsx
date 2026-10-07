import { useEffect, useId, useMemo, useState } from "react";
import {
  editaisDoPedido,
  opcoesDosEditais,
  previaDoDisparo,
} from "../../lib/painel-dos-robos.js";
import {
  estadoDoBotao,
  OPCOES_DOS_ROBOS,
  separarCodigos,
  validarOpcoes,
} from "../../lib/robos-de-carga.js";
import { Aviso, Campo, Gaveta, Segmentado } from "../../ui/index.js";
import { Icone } from "../icone.jsx";
import { MultiSelectBusca } from "../multi-select-busca.jsx";

/*
  "Rodar com opções" de um robô (Configurações › Status das atualizações, só
  administrador global): gaveta com editais (por área, só os vigentes salvo
  "mostrar todos"), códigos de vaga da Empregare (lista colada; sugestões das
  vagas conhecidas do edital, com o cargo), modo e limite, e a prévia do que
  vai rodar antes de confirmar. Só os campos que o robô aceita
  (OPCOES_DOS_ROBOS); a mesma validação da função (validarOpcoes) e as
  regras da prévia em src/lib/painel-dos-robos.js. A explicação é da Aya
  (verbete "Rodar um robô com opções").
*/

const ESPERA_DA_BUSCA_MS = 350;
const SUGESTOES_VISIVEIS = 40;

function useVagasConhecidas(estado, ids, codigos) {
  const chave = `${ids.join(",")}|${codigos.join(",")}`;
  const [resultado, setResultado] = useState({
    chave: "",
    vagas: [],
    erro: "",
  });
  useEffect(() => {
    if (!ids.length && !codigos.length) return undefined;
    let vivo = true;
    const espera = setTimeout(async () => {
      const { vagas, erro } = await estado.buscarVagas({
        editais: ids,
        vagas: codigos,
      });
      if (vivo) setResultado({ chave, vagas, erro });
    }, ESPERA_DA_BUSCA_MS);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
    // A chave resume ids e códigos.
  }, [chave, estado]);
  if (!ids.length && !codigos.length)
    return { vagas: [], erro: "", buscando: false };
  return {
    vagas: resultado.vagas,
    erro: resultado.erro,
    buscando: resultado.chave !== chave,
  };
}

function CampoDosEditais({
  painel,
  area,
  setArea,
  todos,
  setTodos,
  ids,
  setIds,
}) {
  const idDoCampo = useId();
  const { opcoes, ocultos } = opcoesDosEditais(painel.editais, painel.areas, {
    area,
    todos,
    escolhidos: ids,
  });
  return (
    <div className="robos-opcoes__editais" data-tour="robos-opcoes-editais">
      <Campo rotulo="Área">
        <select value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Todas</option>
          {painel.areas.map((a) => (
            <option key={a.area} value={a.area}>
              {a.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Editais" idDoControle={idDoCampo}>
        <MultiSelectBusca
          id={idDoCampo}
          opcoes={opcoes}
          selecionados={ids}
          placeholder="Nenhum (padrão do robô)"
          aoMudar={setIds}
        />
      </Campo>
      <label className="robos-opcoes__todos">
        <input
          type="checkbox"
          checked={todos}
          onChange={(e) => setTodos(e.target.checked)}
        />
        Mostrar todos{!todos && ocultos ? ` (${ocultos} não vigentes)` : ""}
      </label>
    </div>
  );
}

function Sugestoes({ vagas, ids, codigos, aoAdicionar, buscando, erro }) {
  const escolhidos = new Set(ids);
  const jaTem = new Set(codigos);
  const doEdital = vagas.filter(
    (v) => escolhidos.has(v.editalId) && !jaTem.has(v.vaga),
  );
  if (erro)
    return (
      <small className="ui-campo-erro" role="alert">
        {erro}
      </small>
    );
  if (!ids.length) return null;
  if (buscando)
    return <small className="robos-opcoes__nota">Buscando as vagas…</small>;
  if (!doEdital.length)
    return (
      <small className="robos-opcoes__nota">
        {codigos.length
          ? "Todas as vagas conhecidas do edital já estão na lista."
          : "Nenhuma vaga da Empregare conhecida neste edital."}
      </small>
    );
  return (
    <div className="robos-opcoes__sugestoes" data-tour="robos-opcoes-sugestoes">
      <div className="robos-opcoes__sugestoes-topo">
        <small>Vagas conhecidas do edital</small>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => aoAdicionar(doEdital.map((v) => v.vaga))}
        >
          Adicionar todas ({doEdital.length})
        </button>
      </div>
      <ul>
        {doEdital.slice(0, SUGESTOES_VISIVEIS).map((v) => (
          <li key={v.vaga}>
            <button
              type="button"
              className="robos-opcoes__sugestao"
              title={v.cargo || undefined}
              onClick={() => aoAdicionar([v.vaga])}
            >
              <strong>{v.vaga}</strong>
              {v.cargo ? <span>{v.cargo}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Os códigos colados, com o cargo de cada um (ou "não conhecida"). */
function CodigosEscolhidos({ codigos, vagas, aoTirar }) {
  if (!codigos.length) return null;
  return (
    <ul className="robos-opcoes__codigos" aria-label="Vagas escolhidas">
      {codigos.map((codigo) => {
        const vaga = vagas.find((v) => v.vaga === codigo);
        return (
          <li key={codigo} data-vaga={codigo}>
            <strong>{codigo}</strong>
            <span>{vaga ? vaga.cargo || "sem cargo" : "não conhecida"}</span>
            <button
              type="button"
              className="robos-opcoes__tirar"
              aria-label={`Tirar a vaga ${codigo}`}
              title="Tirar"
              onClick={() => aoTirar(codigo)}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function RodarComOpcoes({ robo, linha, atual, estado, aoFechar }) {
  const aceitas = OPCOES_DOS_ROBOS[robo.id];
  const tituloId = useId();
  const painel = atual.painel?.dados || { editais: [], areas: [] };
  const semPainel = atual.painel?.status === "sem_funcao";
  const [area, setArea] = useState("");
  const [todos, setTodos] = useState(false);
  const [ids, setIds] = useState([]);
  const [textoDasVagas, setTextoDasVagas] = useState("");
  const [modo, setModo] = useState("normal");
  const [limite, setLimite] = useState("");
  const [enviando, setEnviando] = useState(false);

  const { codigos, invalidos } = useMemo(
    () => separarCodigos(textoDasVagas),
    [textoDasVagas],
  );
  const conhecidas = useVagasConhecidas(
    estado,
    aceitas.vagas ? ids : [],
    aceitas.vagas ? codigos : [],
  );
  const pedidoBruto = {
    modo,
    ...(aceitas.editais
      ? { editais: editaisDoPedido(robo.id, ids, painel.editais) }
      : {}),
    ...(aceitas.vagas ? { vagas: codigos } : {}),
    ...(aceitas.limite ? { limite } : {}),
  };
  const conferido = validarOpcoes(robo, pedidoBruto);
  const erroDasVagas = invalidos.length
    ? `Código inválido: ${invalidos.slice(0, 3).join(", ")} (só dígitos).`
    : "";
  const erroDoLimite =
    conferido.erro === "limite_invalido" ? conferido.texto : "";
  const previa = previaDoDisparo({
    robo: robo.id,
    modo,
    editaisIds: ids,
    editais: painel.editais,
    codigos,
    limite: conferido.opcoes?.limite || null,
    vagas: conhecidas.vagas,
  });
  const botao = estadoDoBotao({
    robo,
    disponibilidade: atual.disparo,
    linha,
    pedidoEm: atual.pedidos[robo.id] || null,
    agora: estado.agora(),
  });
  const aviso = atual.avisos[robo.id];
  const modoEscolhido = aceitas.modos.find((m) => m.valor === modo);
  const bloqueado =
    Boolean(conferido.erro) ||
    invalidos.length > 0 ||
    botao.desabilitado ||
    enviando;

  const adicionar = (novos) =>
    setTextoDasVagas((texto) =>
      [...separarCodigos(texto).codigos, ...novos]
        .filter((c, i, todos) => todos.indexOf(c) === i)
        .join(", "),
    );
  const tirar = (codigo) =>
    setTextoDasVagas((texto) =>
      separarCodigos(texto)
        .codigos.filter((c) => c !== codigo)
        .join(", "),
    );

  async function rodar(evento) {
    evento.preventDefault();
    if (bloqueado) return;
    setEnviando(true);
    const ok = await estado.rodarComOpcoes(
      robo.id,
      conferido.opcoes,
      previa.frase,
    );
    setEnviando(false);
    if (ok) aoFechar();
  }

  return (
    <Gaveta
      id={`robos-opcoes-${robo.id}`}
      tituloId={tituloId}
      aoFechar={aoFechar}
      sobretitulo="Rodar com opções"
      titulo={robo.nome}
      rotuloDoFechar="Fechar as opções"
      tour="robos-opcoes"
      cartaoClassName="robos-opcoes"
    >
      <form className="robos-opcoes__form" onSubmit={rodar} noValidate>
        <div className="ui-gaveta-corpo">
          {aceitas.editais ? (
            semPainel ? (
              <Aviso tom="warning">
                Sem a lista de editais: falta aplicar a migration
                20261007190000_painel_dos_robos.sql.
              </Aviso>
            ) : (
              <CampoDosEditais
                painel={painel}
                area={area}
                setArea={setArea}
                todos={todos}
                setTodos={setTodos}
                ids={ids}
                setIds={setIds}
              />
            )
          ) : null}

          {aceitas.vagas ? (
            <div className="robos-opcoes__vagas" data-tour="robos-opcoes-vagas">
              <Campo rotulo="Códigos de vaga" erro={erroDasVagas}>
                <textarea
                  rows={3}
                  value={textoDasVagas}
                  placeholder="179698, 180231"
                  spellCheck={false}
                  onChange={(e) => setTextoDasVagas(e.target.value)}
                />
              </Campo>
              <CodigosEscolhidos
                codigos={codigos}
                vagas={conhecidas.vagas}
                aoTirar={tirar}
              />
              <Sugestoes
                vagas={conhecidas.vagas}
                ids={ids}
                codigos={codigos}
                aoAdicionar={adicionar}
                buscando={conhecidas.buscando}
                erro={conhecidas.erro}
              />
            </div>
          ) : null}

          <div className="robos-opcoes__modo" data-tour="robos-opcoes-modo">
            <span className="robos-opcoes__rotulo" id={`${tituloId}-modo`}>
              Modo
            </span>
            <Segmentado
              rotulo="Modo"
              opcoes={aceitas.modos.map((m) => ({
                valor: m.valor,
                rotulo: m.rotulo,
              }))}
              valor={modo}
              aoMudar={setModo}
            />
            {modoEscolhido ? (
              <small className="robos-opcoes__nota">
                {modoEscolhido.explicacao}
              </small>
            ) : null}
          </div>

          {aceitas.limite ? (
            <div data-tour="robos-opcoes-limite">
              <Campo rotulo="Limite de vagas" erro={erroDoLimite}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={aceitas.limite.min}
                  max={aceitas.limite.max}
                  step={1}
                  value={limite}
                  placeholder={String(aceitas.limite.padrao)}
                  onChange={(e) => setLimite(e.target.value)}
                />
              </Campo>
            </div>
          ) : null}

          <section
            className="robos-opcoes__previa"
            aria-live="polite"
            data-tour="robos-opcoes-previa"
          >
            <span className="robos-opcoes__rotulo">Vai rodar</span>
            <p className="robos-opcoes__frase">
              {conferido.erro && conferido.erro !== "limite_invalido"
                ? conferido.texto
                : previa.frase}
            </p>
            {previa.avisos.map((a) => (
              <small key={a} className="robos-opcoes__aviso">
                <Icone nome="triangle-alert" tamanho={12} /> {a}
              </small>
            ))}
          </section>

          {aviso?.tom === "erro" ? (
            <Aviso tom="danger" papel="alert">
              {aviso.texto}
            </Aviso>
          ) : botao.aviso ? (
            <Aviso tom="warning">{botao.aviso}</Aviso>
          ) : null}
        </div>
        <div className="ui-gaveta-rodape">
          <button type="button" className="btn secondary" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={bloqueado}
            data-tour="robos-opcoes-rodar"
          >
            <Icone nome="refresh-cw" tamanho={14} />
            {enviando
              ? "Pedindo…"
              : botao.desabilitado && botao.rotulo !== "Rodar agora"
                ? botao.rotulo
                : "Rodar"}
          </button>
        </div>
      </form>
    </Gaveta>
  );
}
