/*
  A Visão geral de cada área, sem DOM nem rede.

  Saúde Indígena, SEDE e Projetos abrem a MESMA página (`dashboard`, React em
  src/modulos/visao-geral/): indicadores, filtros, "Unidades com mais de um processo seletivo",
  resumo, gráfico, atenção e tabela, sempre com os editais da área atual. O
  que muda é o bloco "Visão nacional":

  - Saúde Indígena: o mapa dos DSEIs e CASAIs, com as Terras Indígenas, e a
    lista "Territórios por vagas" (src/modulos/mapa-saude-indigena/);
  - Projetos: um mapa do Brasil, sem nada da Saúde Indígena, com um ponto por
    lugar das vagas de todos os projetos, na cor do projeto (RPC
    `listar_municipios_das_vagas_da_area`: os locais lidos dos PDFs dos
    editais, em TB_LOCAL_VAGA_EDITAL, e o "UBS móvel" do nome da vaga), e a
    lista "Municípios por vagas", com filtro e agrupamento por projeto;
  - SEDE: sem o bloco — a equipe fica em Brasília.

  Aqui ficam essa escolha, os textos do bloco de Projetos e a conta dos
  municípios. O desenho é de `src/modulos/mapa-de-projetos/` (React).
*/

import {
  coordenadasDaUf,
  coordenadasDoMunicipio,
} from "./coordenadas-dos-municipios.js";
import { numeroDoEdital } from "./anexos-do-edital.js";
import { raioDaBolha } from "./mapa-render.js";
import { nomeDaArea } from "./menu-lateral.js";
import { AREA_SAUDE_INDIGENA } from "./responsavel-do-edital.js";

const num = (valor) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
};
const texto = (valor) => String(valor ?? "").trim();
const fmtNumero = (valor) => num(valor).toLocaleString("pt-BR");

export const MAPA_DOS_DSEIS = "dsei";
export const MAPA_DOS_MUNICIPIOS = "municipios";

const MAPA_POR_AREA = Object.freeze({
  [AREA_SAUDE_INDIGENA]: MAPA_DOS_DSEIS,
  projetos: MAPA_DOS_MUNICIPIOS,
});

/** O mapa da Visão geral da área: `"dsei"`, `"municipios"` ou `""` (sem mapa). */
export function mapaDaVisaoGeral(area) {
  return MAPA_POR_AREA[texto(area)] ?? "";
}

/*
  Título e subtítulo do cabeçalho. A Saúde Indígena segue a configuração
  (`page_title`, `page_subtitle`: "Saúde Indígena", "Monitoramento
  DSEI/CASAI"); as outras áreas dizem o nome delas.
*/
export function cabecalhoDaVisaoGeral(
  area,
  { titulo = "", subtitulo = "" } = {},
) {
  if (texto(area) === AREA_SAUDE_INDIGENA) return { titulo, subtitulo };
  return {
    titulo: nomeDaArea(texto(area)) || titulo,
    subtitulo: "Monitoramento dos processos seletivos",
  };
}

/*
  Os textos do mapa de Projetos (src/modulos/mapa-de-projetos/): a região,
  o título do painel, o rótulo do mapa e o título da lista. A explicação de
  como usar ("clique num município…") fica com a Aya
  (docs/aya/regras-dos-mapas.md). O mapa da Saúde Indígena tem os dele.
*/
export const TEXTOS_DO_MAPA = Object.freeze({
  [MAPA_DOS_MUNICIPIOS]: Object.freeze({
    area: "Mapa dos municípios das vagas",
    titulo: "Municípios das vagas",
    mapa: "Mapa do Brasil com os municípios das vagas da área",
    lista: "Municípios por vagas",
  }),
});

export const plural = (total, um, varios) =>
  `${num(total).toLocaleString("pt-BR")} ${num(total) === 1 ? um : varios}`;

// ── Projetos ─────────────────────────────────────────────────────────────

/*
  Os projetos da área Projetos, na ordem das séries do design system
  (`--series-1` … `--series-6`, DESIGN.md seção 6). A cor segue o projeto,
  não a posição: filtrar não repinta quem fica. O projeto vem da unidade do
  edital ("Projeto Agora Tem Especialistas Caminhoneiros") e é reconhecido
  pela palavra, sem acento nem caixa. Projeto fora da lista fica com a série 0
  (neutra) e o nome como veio.
*/
export const PROJETOS_DO_MAPA = Object.freeze([
  Object.freeze({ serie: 1, nome: "Caminhoneiros", palavra: "caminhoneiro" }),
  Object.freeze({
    serie: 2,
    nome: "Saúde nas Fronteiras",
    palavra: "fronteira",
  }),
  Object.freeze({
    serie: 3,
    nome: "Escritório Distrital e Regional",
    palavra: "escritorio",
  }),
  Object.freeze({ serie: 4, nome: "Rio Doce", palavra: "rio doce" }),
  Object.freeze({ serie: 5, nome: "MFC", palavra: "mfc" }),
  Object.freeze({ serie: 6, nome: "CCE", palavra: "cce" }),
]);

const semAcento = (valor) =>
  texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** { nome, serie } do projeto (unidade do edital). */
export function projetoDoMapa(unidade) {
  const chave = semAcento(unidade);
  const conhecido = chave
    ? PROJETOS_DO_MAPA.find((projeto) =>
        new RegExp(`(^|[^a-z])${projeto.palavra}`).test(chave),
      )
    : null;
  if (conhecido) return { nome: conhecido.nome, serie: conhecido.serie };
  return { nome: texto(unidade) || "Sem projeto", serie: 0 };
}

const ordemDoProjeto = (a, b) =>
  (a.serie || 99) - (b.serie || 99) || a.nome.localeCompare(b.nome, "pt-BR");

// ── Municípios ───────────────────────────────────────────────────────────

const numeroOuNulo = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

/*
  A resposta de `listar_municipios_das_vagas_da_area`: uma linha por lugar —
  município ou, quando o edital só diz o estado, UF (`nivel: "uf"`, sem
  `municipio_uf`). Normaliza números, põe o nome curto de cada projeto e
  descarta linha sem lugar. `vagas` são as vagas nas análises; `vagasEdital`,
  as publicadas nos editais (nulo se nenhum diz).

  Coordenada: desde a migration 20261002190000 a RPC devolve `lugar` (a chave
  do lugar) e `latitude`/`longitude` do banco (public."TB_COORDENADA_LOCAL_VAGA",
  corrigida no editor de coordenadas). `coordenada` é `{ latitude, longitude,
  origem }`, `null` quando o banco ainda não tem a do lugar, ou `undefined`
  quando a resposta não traz o campo (banco antes da migration: o mapa usa a
  tabela de src/lib/coordenadas-dos-municipios.js — tirar depois de aplicada).
*/
const coordenadaDaLinha = (linha) => {
  if (!linha || !Object.hasOwn(linha, "latitude")) return undefined;
  const latitude = numeroOuNulo(linha.latitude);
  const longitude = numeroOuNulo(linha.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude, origem: texto(linha.coordenada_origem) };
};

export function municipiosDaResposta(dados) {
  return (Array.isArray(dados) ? dados : [])
    .map((linha) => {
      const uf = texto(linha?.uf).toUpperCase();
      const municipioUf = texto(linha?.municipio_uf);
      const nivel = !municipioUf && uf ? "uf" : "municipio";
      const editais = (Array.isArray(linha?.editais) ? linha.editais : [])
        .map((edital) => {
          const projeto = projetoDoMapa(edital?.projeto);
          return {
            id: texto(edital?.id),
            edital: texto(edital?.edital),
            projeto: projeto.nome,
            serie: projeto.serie,
            vagas: numeroOuNulo(edital?.vagas),
            cadastroReserva: edital?.cadastro_reserva === true,
            origens: Array.isArray(edital?.origens) ? edital.origens : [],
            lotacoes: Array.isArray(edital?.lotacoes)
              ? edital.lotacoes.map(texto).filter(Boolean)
              : [],
          };
        })
        .sort(
          (a, b) =>
            ordemDoProjeto(
              { serie: a.serie, nome: a.projeto },
              { serie: b.serie, nome: b.projeto },
            ) || a.edital.localeCompare(b.edital, "pt-BR"),
        );
      const projetos = new Map();
      for (const nome of Array.isArray(linha?.projetos) ? linha.projetos : [])
        projetos.set(projetoDoMapa(nome).nome, projetoDoMapa(nome));
      for (const edital of editais)
        projetos.set(edital.projeto, {
          nome: edital.projeto,
          serie: edital.serie,
        });
      return {
        chave: nivel === "uf" ? `uf:${uf}` : municipioUf,
        lugar: texto(linha?.lugar),
        coordenada: coordenadaDaLinha(linha),
        municipioUf,
        uf,
        nivel,
        codigoIbge: numeroOuNulo(linha?.codigo_ibge),
        vagas: num(linha?.vagas),
        vagasEdital: numeroOuNulo(linha?.vagas_edital),
        cadastroReserva: linha?.cadastro_reserva === true,
        candidatos: num(linha?.candidatos),
        aprovados: num(linha?.aprovados),
        reprovados: num(linha?.reprovados),
        projetos: [...projetos.values()].sort(ordemDoProjeto),
        editais,
      };
    })
    .filter((linha) => linha.municipioUf || linha.nivel === "uf");
}

/*
  O nome do lugar: "Seropédica/RJ", ou "Pará (estado)" quando o edital só diz
  a UF.
*/
export function rotuloDoLugar(lugar) {
  if (lugar?.nivel !== "uf") return texto(lugar?.municipioUf);
  const nome = coordenadasDaUf(lugar.uf)?.nome || lugar.uf;
  return `${nome} (estado)`;
}

/*
  As vagas publicadas, por extenso: "4 vagas + cadastro reserva",
  "Cadastro reserva" ou "" quando o edital não diz.
*/
export function textoDasVagas({ vagas = null, cadastroReserva = false } = {}) {
  const imediatas = num(vagas) > 0 ? plural(vagas, "vaga", "vagas") : "";
  if (imediatas && cadastroReserva) return `${imediatas} + cadastro reserva`;
  if (imediatas) return imediatas;
  return cadastroReserva ? "Cadastro reserva" : "";
}

/*
  Os projetos presentes, na ordem das séries, com quantos lugares cada um tem
  — a legenda do mapa e as opções do filtro.
*/
export function projetosDosMunicipios(municipios) {
  const porNome = new Map();
  for (const lugar of Array.isArray(municipios) ? municipios : []) {
    for (const projeto of lugar.projetos) {
      const atual = porNome.get(projeto.nome) ?? { ...projeto, lugares: 0 };
      atual.lugares += 1;
      porNome.set(projeto.nome, atual);
    }
  }
  return [...porNome.values()].sort(ordemDoProjeto);
}

/*
  O resultado das análises do município: a parte aprovada entre as já
  decididas (aprovados + reprovados). Sem nenhuma decidida, sem barra.
*/
export function resultadoDoMunicipio({ aprovados = 0, reprovados = 0 } = {}) {
  const decididos = num(aprovados) + num(reprovados);
  if (!decididos) return null;
  return { pct: Math.round((num(aprovados) / decididos) * 100), decididos };
}

/*
  Candidatos por lugar só existem quando o lugar casou com alguma vaga das
  análises (o nome da vaga cita o lugar: "UBS móvel <Município>/<UF>" ou o
  município de um local do mesmo edital) — aí `vagas` (as vagas nas
  análises) passa de zero. Sem isso, "0 candidatos" seria um zero falso: a
  lista e o popup não mostram a linha.
*/
export const temCandidatosPorLugar = (lugar) => num(lugar?.vagas) > 0;

/* O tamanho do lugar: as vagas publicadas ou, se forem mais, as das análises. */
const tamanhoDoLugar = (lugar) => Math.max(num(lugar.vagasEdital), lugar.vagas);

const comPadroes = (lugar) => ({
  projetos: [],
  editais: [],
  nivel: "municipio",
  vagasEdital: null,
  vagas: 0,
  ...lugar,
});

/*
  Os lugares no recorte da Visão geral (filtros, busca e atalho — os mesmos
  editais que a tabela mostra), como o mapa da Saúde Indígena: só fica o
  lugar com algum edital do recorte, e cada lugar só com esses editais (os
  projetos e as vagas publicadas recontados a partir deles). O edital do lugar
  é do recorte pelo id da linha do monitoramento (a RPC devolve o
  `CO_MONITORAMENTO`) ou pelo número ("23/2025"), porque a RPC guarda um id
  por número de edital. As contagens das análises são do lugar e ficam.
*/
export function lugaresDoRecorte(municipios, linhas) {
  const ids = new Set();
  const numeros = new Set();
  for (const linha of Array.isArray(linhas) ? linhas : []) {
    if (texto(linha?.id)) ids.add(texto(linha.id));
    const numero = numeroDoEdital(linha?.edital);
    if (numero) numeros.add(numero);
  }
  const doRecorte = (edital) =>
    (texto(edital?.id) && ids.has(texto(edital.id))) ||
    numeros.has(numeroDoEdital(edital?.edital));
  return (Array.isArray(municipios) ? municipios : [])
    .map((lugar) => {
      const completo = comPadroes(lugar);
      const editais = completo.editais.filter(doRecorte);
      if (!editais.length) return null;
      if (editais.length === completo.editais.length) return lugar;
      const projetos = new Map(
        editais.map((edital) => [
          edital.projeto,
          { nome: edital.projeto, serie: edital.serie },
        ]),
      );
      const publicadas = editais.filter((edital) => edital.vagas !== null);
      return {
        ...completo,
        editais,
        projetos: [...projetos.values()].sort(ordemDoProjeto),
        vagasEdital: publicadas.length
          ? publicadas.reduce((soma, edital) => soma + num(edital.vagas), 0)
          : null,
        cadastroReserva: editais.some((edital) => edital.cadastroReserva),
      };
    })
    .filter(Boolean);
}

/*
  Os lugares por vagas, decrescente (candidatos desempatam), cada um com a
  coordenada do banco (ou `null`, se o lugar ainda não tem), o raio do ponto, o
  rótulo e a série da cor. Com `projeto`, só os lugares dele, pintados com a
  cor dele; sem filtro, a cor é a do primeiro projeto do lugar e
  `variosProjetos` diz que há outros (o ponto ganha contorno tracejado).

  O raio é a regra da bolha do DSEI (`raioDaBolha`, src/lib/mapa-render.js:
  raiz do valor, de 5 a 15 px), medido nas vagas do lugar inteiro contra o
  maior de `todos` (os lugares antes do recorte): filtrar não muda o tamanho
  de quem fica, como filtrar não muda a bolha do DSEI (a população).
*/
export function pontosDosMunicipios(
  municipios,
  { projeto = "", todos = municipios } = {},
) {
  const filtro = texto(projeto);
  const escala = new Map(
    (Array.isArray(todos) ? todos : []).map((lugar) => [
      lugar?.chave,
      tamanhoDoLugar(comPadroes(lugar)),
    ]),
  );
  const maior = Math.max(0, ...escala.values());
  const lista = (Array.isArray(municipios) ? municipios : [])
    .map(comPadroes)
    .filter(
      (lugar) => !filtro || lugar.projetos.some((item) => item.nome === filtro),
    )
    .map((lugar) => ({
      ...lugar,
      rotulo: rotuloDoLugar(lugar),
      tamanho: tamanhoDoLugar(lugar),
    }))
    .sort(
      (a, b) =>
        b.tamanho - a.tamanho ||
        b.candidatos - a.candidatos ||
        a.rotulo.localeCompare(b.rotulo, "pt-BR"),
    );
  return lista.map((item) => {
    const lugar =
      item.coordenada !== undefined
        ? item.coordenada
        : item.nivel === "uf"
          ? coordenadasDaUf(item.uf)
          : coordenadasDoMunicipio(item.municipioUf, item.codigoIbge);
    const principal = filtro
      ? item.projetos.find((projetoDoLugar) => projetoDoLugar.nome === filtro)
      : item.projetos[0];
    return {
      ...item,
      coordenadas: lugar ? [lugar.latitude, lugar.longitude] : null,
      raio: raioDaBolha(
        Math.max(item.tamanho, escala.get(item.chave) ?? 0),
        Math.max(maior, item.tamanho),
      ),
      serie: principal?.serie ?? 0,
      variosProjetos: !filtro && item.projetos.length > 1,
    };
  });
}

/*
  A lista agrupada por projeto: um grupo por projeto, na ordem das séries,
  com os pontos dele (na ordem que vieram). Lugar de dois projetos aparece nos
  dois grupos.
*/
export function gruposPorProjeto(pontos) {
  const grupos = new Map();
  for (const ponto of Array.isArray(pontos) ? pontos : []) {
    const projetos = ponto.projetos?.length
      ? ponto.projetos
      : [{ nome: "Sem projeto", serie: 0 }];
    for (const projeto of projetos) {
      const grupo = grupos.get(projeto.nome) ?? { ...projeto, pontos: [] };
      grupo.pontos.push(ponto);
      grupos.set(projeto.nome, grupo);
    }
  }
  return [...grupos.values()].sort(ordemDoProjeto);
}

/*
  O que o popup do lugar mostra, sem DOM: título, uma linha por edital
  (projeto, edital, vagas publicadas, lotações) e as contagens das análises.
*/
export function resumoDoLugar(ponto) {
  const editais = (ponto?.editais ?? []).map((edital) => ({
    projeto: edital.projeto,
    serie: edital.serie,
    texto: [
      edital.edital ? `Edital ${edital.edital}` : "Edital sem número",
      textoDasVagas(edital),
      edital.lotacoes.join("; "),
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  const resultado = resultadoDoMunicipio(ponto);
  const comCandidatos = temCandidatosPorLugar(ponto);
  const linhas = [
    comCandidatos ? `Vagas nas análises: ${fmtNumero(ponto.vagas)}` : "",
    comCandidatos ? `Candidatos: ${fmtNumero(ponto?.candidatos)}` : "",
    comCandidatos && (ponto?.aprovados || ponto?.reprovados)
      ? `Aprovados: ${fmtNumero(ponto.aprovados)} · Reprovados: ${fmtNumero(ponto.reprovados)}`
      : "",
    resultado ? `${resultado.pct}% aprovados entre os analisados` : "",
    ponto?.nivel === "uf" ? "O edital diz só o estado" : "",
  ].filter(Boolean);
  return { titulo: rotuloDoLugar(ponto), editais, linhas };
}
