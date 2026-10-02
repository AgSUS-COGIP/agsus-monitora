import { distanciaKm } from "./reconciliacao-unidades.js";

/*
  O EDITOR DE COORDENADAS DOS MAPAS — regras comuns, sem DOM

  Serve aos dois mapas com editor (só administrador global):
  - Saúde Indígena: sedes, polos, UBSI e CASAIs (`coordenadas-do-mapa.js`,
    RPCs `*_coordenada_mapa_saude_indigena`);
  - Projetos: os lugares das vagas (`coordenadas-dos-projetos.js`, RPCs
    `*_coordenada_mapa_projetos`).

  Aqui ficam a leitura e a validação da coordenada, a fila (busca, "Só
  pendentes", gravidade com contagem), a lista de sugestões (repetidas fora,
  distância até a posição atual), a régua de gravidade e o histórico com o
  "Desfazer". O que muda de um mapa para o outro — de onde vêm os pontos, como
  a pendência se liga ao ponto, as fontes das sugestões e os motivos — vem
  nas `regras` de cada mapa.
*/

export function lerCoordenada(valor) {
  const texto = String(valor ?? "")
    .trim()
    .replace(",", ".");
  return /^[-+]?\d+(?:\.\d+)?$/.test(texto) ? Number(texto) : NaN;
}

/** Limites do Brasil aceitos pelo editor (os mesmos das RPCs). */
export const LIMITES_DO_BRASIL = Object.freeze({
  latitudeMinima: -34.9,
  latitudeMaxima: 6.4,
  longitudeMinima: -74.2,
  longitudeMaxima: -32,
});

export const dentroDoBrasil = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= LIMITES_DO_BRASIL.latitudeMinima &&
  latitude <= LIMITES_DO_BRASIL.latitudeMaxima &&
  longitude >= LIMITES_DO_BRASIL.longitudeMinima &&
  longitude <= LIMITES_DO_BRASIL.longitudeMaxima;

export function validarCorrecaoDoMapa(latitude, longitude, motivo) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
    return "Informe latitude e longitude válidas.";
  if (!dentroDoBrasil(latitude, longitude))
    return "A coordenada deve ficar nos limites do Brasil.";
  if (String(motivo ?? "").trim().length < 10)
    return "Descreva o motivo da correção (mínimo de 10 caracteres).";
  return "";
}

export const formatarCoordenada = (valor) =>
  Number.isFinite(valor) ? valor.toFixed(6) : "Sem coordenada";

/** "350 m", "4,2 km", "73 km" ou "—" sem posição atual. */
export function formatarDistancia(km) {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km`;
}

/** Sem acento, sem caixa e sem espaço nas pontas (busca e comparação de nomes). */
export const textoComparavel = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Uma pendência por linha da contagem: "1 pendente", "N pendentes". */
export const textoDePendentes = (n) =>
  `${n} ${n === 1 ? "pendente" : "pendentes"}`;

/*
  Régua da gravidade (pedido de 02/10), a mesma nos dois mapas: a distância
  entre a posição atual e a sugestão que serve de régua (aldeia/lugar na
  Saúde Indígena, sede do município ou centro da UF em Projetos):
  - "erro": o motivo da pendência já é um erro, ou a régua está a mais de 10 km;
  - "revisar": a régua está entre 2 e 10 km, ou nenhuma sugestão serve de régua;
  - "confirmar": a régua está a até 2 km — a posição bate, falta o "Conferido";
  - "sem": nenhuma posição candidata (buscar à mão).
*/
export const LIMITES_DA_GRAVIDADE = Object.freeze({ certoKm: 2, erroKm: 10 });

export const GRAVIDADES = Object.freeze({
  erro: { ordem: 0, rotulo: "Provável erro", tom: "reprovado" },
  revisar: { ordem: 1, rotulo: "Revisar", tom: "pendente" },
  sem: { ordem: 2, rotulo: "Sem sugestão", tom: "neutro" },
  confirmar: { ordem: 3, rotulo: "Só confirmar", tom: "revisar" },
});

/**
 * O nível da régua: "erro", "confirmar", "revisar" ou "sem" (sem sugestão).
 * `revisar` (motivo que pede revisão mesmo com a régua perto) nunca deixa
 * chegar a "confirmar".
 */
export function nivelDaGravidade({
  temSugestao,
  motivoDeErro,
  km,
  revisar = false,
}) {
  if (!temSugestao) return "sem";
  if (motivoDeErro || km > LIMITES_DA_GRAVIDADE.erroKm) return "erro";
  if (!revisar && Number.isFinite(km) && km <= LIMITES_DA_GRAVIDADE.certoKm)
    return "confirmar";
  return "revisar";
}

const ordemDaGravidade = (item) =>
  item.gravidade ? GRAVIDADES[item.gravidade.nivel].ordem : 9;

/**
 * A fila do editor: os pontos com a pendência ligada (`regras.chaveDoPonto`
 * × `regras.chaveDaPendencia`) e, nos pendentes, a gravidade
 * (`regras.gravidade`). Filtra pela busca (`regras.textoDeBusca`, sem acento
 * nem caixa), com `soPendentes` só os ainda não conferidos e com `gravidade`
 * (chave de GRAVIDADES) só aquele nível. Ordem: em Só pendentes, o provável
 * erro primeiro; depois `regras.comparar`. `pendentes` conta os não
 * conferidos de todos os pontos e `porGravidade` quantos há em cada nível
 * (os dois ignoram a busca e o filtro de nível).
 *
 * Um ponto sem pendência pode ser pendente mesmo assim, quando
 * `regras.pendenteSemPendencia(ponto)` diz (Projetos: lugar sem coordenada).
 */
export function filaDoEditor(
  pontos,
  pendencias,
  { busca = "", soPendentes = true, gravidade = "" } = {},
  regras,
) {
  const porChave = new Map(
    (pendencias || []).map((p) => [regras.chaveDaPendencia(p), p]),
  );
  const termos = textoComparavel(busca).split(/\s+/).filter(Boolean);
  const todos = (pontos || []).map((ponto) => {
    const pendencia = porChave.get(regras.chaveDoPonto(ponto)) || null;
    const pendente = pendencia
      ? !pendencia.conferido
      : Boolean(regras.pendenteSemPendencia?.(ponto));
    return {
      ...ponto,
      pendencia,
      pendente,
      gravidade: pendente ? regras.gravidade(pendencia, ponto) : null,
    };
  });
  const porGravidade = Object.fromEntries(
    Object.keys(GRAVIDADES).map((nivel) => [
      nivel,
      todos.filter((i) => i.gravidade?.nivel === nivel).length,
    ]),
  );
  const itens = todos
    .filter((item) => {
      if (soPendentes && !item.pendente) return false;
      if (gravidade && item.gravidade?.nivel !== gravidade) return false;
      const texto = textoComparavel(regras.textoDeBusca(item));
      return termos.every((termo) => texto.includes(termo));
    })
    .sort(
      (a, b) =>
        (soPendentes ? ordemDaGravidade(a) - ordemDaGravidade(b) : 0) ||
        regras.comparar(a, b),
    );
  return {
    itens,
    pendentes: todos.filter((i) => i.pendente).length,
    porGravidade,
  };
}

/**
 * As sugestões prontas para a tela: `candidatos` são
 * `{ fonte, nome, terra?, latitude, longitude }`; `grupos` diz a ordem e o
 * rótulo de cada fonte (`{ FONTE: { ordem, rotulo } }`). Cada sugestão ganha
 * `id`, `rotulo` e a distância (km) até a posição atual do ponto. Ordem: a
 * do grupo e, dentro dele, da mais perto para a mais longe. Repetida —
 * mesma fonte na mesma posição (até 50 m) ou com o mesmo nome a menos de
 * 1 km — sai (fica a primeira); posição inválida também.
 */
export function listaDeSugestoes(candidatos, ponto, grupos) {
  const aceitas = [];
  return (candidatos || [])
    .map((c) => ({
      fonte: grupos[c.fonte] ? c.fonte : "OUTRA",
      nome: c.nome || "",
      terra: c.terra || "",
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
    }))
    .filter((c) => {
      if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude))
        return false;
      const repetida = aceitas.some((a) => {
        if (a.fonte !== c.fonte) return false;
        const km = distanciaKm(
          a.latitude,
          a.longitude,
          c.latitude,
          c.longitude,
        );
        return (
          km < 0.05 ||
          (textoComparavel(a.nome) === textoComparavel(c.nome) && km < 1)
        );
      });
      if (repetida) return false;
      aceitas.push(c);
      return true;
    })
    .map((c) => ({
      ...c,
      id: `${c.fonte}|${c.latitude.toFixed(5)}|${c.longitude.toFixed(5)}`,
      rotulo: grupos[c.fonte]?.rotulo || "Outra fonte",
      distanciaKm: distanciaKm(
        ponto?.latitude,
        ponto?.longitude,
        c.latitude,
        c.longitude,
      ),
    }))
    .sort(
      (a, b) =>
        (grupos[a.fonte]?.ordem ?? 9) - (grupos[b.fonte]?.ordem ?? 9) ||
        (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity),
    );
}

const ACOES = Object.freeze({
  CORRECAO: "Correção",
  CONFERENCIA: "Conferido",
  DESFAZER: "Desfeito",
});
export const rotuloDaAcao = (acao) => ACOES[acao] || "Alteração";

/**
 * A alteração que o "Desfazer" volta: a mais recente do ponto, se não for um
 * desfazer, ainda não tiver sido desfeita e o ponto tinha posição antes.
 * O banco confere de novo (só a última, uma vez só).
 */
export function correcaoDesfazivel(historico) {
  const ultima = historico?.[0];
  if (
    !ultima ||
    ultima.acao === "DESFAZER" ||
    ultima.desfeito ||
    ultima.latitude_anterior == null ||
    ultima.longitude_anterior == null
  )
    return null;
  return ultima;
}
