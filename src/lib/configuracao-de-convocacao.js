/*
  Configuração da lista de convocação: o que o banco guarda por edital (modelo
  de regras e vagas imediatas) e o rascunho que o formulário do edital edita.
  Sem DOM nem rede — a tela é `src/componentes/lista-aprovados/`, e o cálculo
  da ordem está em `lista-convocacao-rules.js`.

  O MODELO É PARTILHADO, E ISSO TEM DOIS LADOS

  Cinco dos oito editais da AgSUS que foram lidos têm regras idênticas. Apontar
  todos para o mesmo modelo faz uma correção valer para todos — e faz um
  descuido valer para todos também. Daí o editor mostrar, antes de salvar,
  quantos editais usam aquele modelo, e oferecer "Duplicar" como saída natural
  para quem quer mudar só o seu.

  O QUE SE GUARDA É A ENTRADA

  O edital dá percentuais, não quantidades. O formulário pede o percentual (no
  modelo) e o TOTAL de vagas imediatas (na vaga); o quadro por categoria é
  derivado na hora por `derivarQuadro`. Corrigir um percentual reordena as
  convocações de imediato, o que guardar o derivado não faria.
*/

import {
  categoriasDeReserva,
  lerTermos,
  modeloEmBranco,
  normalizarModelo,
  normalizarTexto,
} from "./modelo-de-convocacao.js";
import {
  derivarQuadro,
  normalizarQuadro,
  quadroVazio,
} from "./lista-convocacao-rules.js";

const text = (value) => String(value ?? "").trim();

// ── Leitura do banco ─────────────────────────────────────────────────────

/** `listar_modelos_convocacao` → modelo_id → modelo normalizado, com `editais`. */
export function lerModelosDoBanco(linhas) {
  return new Map(
    (Array.isArray(linhas) ? linhas : []).map((linha) => [
      String(linha.modelo_id),
      {
        ...normalizarModelo({
          id: linha.modelo_id,
          nome: linha.nome,
          distribuicao: linha.distribuicao,
          cotaMultipla: linha.cota_multipla,
          categorias: (Array.isArray(linha.categorias)
            ? linha.categorias
            : []
          ).map((categoria) => ({
            ...categoria,
            termos: lerTermos(categoria.termos),
            posicoes: lerTermos(categoria.posicoes).map(Number),
            cascata: lerTermos(categoria.cascata),
          })),
        }),
        editais: Number(linha.editais) || 0,
      },
    ]),
  );
}

/**
 * `listar_configuracao_convocacao` → edital_id →
 * `{ proporcionalidade, modeloId, padraoImediata, vagas }`, com `vagas` por código.
 */
export function lerConfiguracoesDoBanco(linhas) {
  return new Map(
    (Array.isArray(linhas) ? linhas : []).map((linha) => [
      String(linha.edital_id),
      {
        proporcionalidade: linha.proporcionalidade !== false,
        modeloId: linha.modelo_id ? String(linha.modelo_id) : "",
        padraoImediata: Number(linha.padrao_imediata) || 0,
        vagas: new Map(
          (Array.isArray(linha.vagas) ? linha.vagas : []).map((vaga) => [
            text(vaga.codigo_vaga),
            {
              cargo: text(vaga.cargo),
              imediatas: Number(vaga.imediatas) || 0,
              manual: vaga.manual === true,
              quadro:
                vaga.quadro && typeof vaga.quadro === "object"
                  ? vaga.quadro
                  : {},
            },
          ]),
        ),
      },
    ]),
  );
}

// ── Configuração que vale para cada vaga ─────────────────────────────────

export const modeloPorId = (modelos, id) =>
  modelos?.get(String(id || "")) || null;

/*
  Sem modelo escolhido vale um modelo em branco: só ampla concorrência,
  nenhuma reserva. As vagas que o gestor digitou continuam a existir e saem
  todas como ampla — dizer "cadastro de reserva" esconderia vagas que ele
  afirmou ter, e inventar categorias seria pior ainda.
*/
export function modeloDoEdital(configs, modelos, editalId) {
  const config = configs?.get(String(editalId));
  return modeloPorId(modelos, config?.modeloId) || modeloEmBranco();
}

/*
  A regra de precedência num sítio só:

    quadro manual da vaga  >  derivado do total da vaga  >  derivado do padrão
*/
export function configuracaoDaVaga(configs, modelos, editalId, codigoVaga) {
  const config = configs?.get(String(editalId));
  const modelo = modeloDoEdital(configs, modelos, editalId);
  if (!config)
    return { proporcionalidade: true, quadro: quadroVazio(modelo), modelo };
  const vaga = config.vagas.get(text(codigoVaga));
  const quadro = vaga?.manual
    ? normalizarQuadro(vaga.quadro, modelo)
    : derivarQuadro(vaga ? vaga.imediatas : config.padraoImediata, modelo);
  return { proporcionalidade: config.proporcionalidade, quadro, modelo };
}

// ── Formulário do edital ─────────────────────────────────────────────────

/*
  As vagas do formulário saem da lista importada, não de um cadastro à parte:
  o código da vaga só existe porque algum candidato o declarou. Vaga guardada
  cujo código sumiu do XLSX novo continua na lista, marcada, para que o gestor
  decida apagá-la em vez de a perder em silêncio.
*/
export function vagasDoEdital(candidatos, configs, editalId) {
  const porCodigo = new Map();
  (candidatos || [])
    .filter((linha) => String(linha.edital_id) === String(editalId))
    .forEach((linha) => {
      const codigo = text(linha.codigo_vaga);
      if (!codigo) return;
      if (!porCodigo.has(codigo))
        porCodigo.set(codigo, {
          codigo,
          cargo: text(linha.cargo),
          na_lista: true,
          total: 0,
        });
      porCodigo.get(codigo).total += 1;
    });

  configs?.get(String(editalId))?.vagas.forEach((guardada, codigo) => {
    if (porCodigo.has(codigo)) return;
    porCodigo.set(codigo, {
      codigo,
      cargo: guardada.cargo || "",
      na_lista: false,
      total: 0,
    });
  });

  return [...porCodigo.values()].sort(
    (a, b) =>
      a.cargo.localeCompare(b.cargo, "pt-BR") ||
      a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }),
  );
}

/** O rascunho que o formulário edita, a partir do que está guardado. */
export function rascunhoDoFormulario(candidatos, configs, editalId) {
  const config = configs?.get(String(editalId));
  return {
    editalId: String(editalId || ""),
    proporcionalidade: config ? config.proporcionalidade : true,
    modeloId: config?.modeloId || "",
    padraoImediata: config ? config.padraoImediata : 0,
    vagas: vagasDoEdital(candidatos, configs, editalId).map((vaga) => {
      const guardada = config?.vagas.get(vaga.codigo);
      return {
        ...vaga,
        imediatas: guardada
          ? guardada.imediatas
          : (config?.padraoImediata ?? 0),
        manual: guardada?.manual === true,
        quadro: { ...(guardada?.quadro || {}) },
      };
    }),
  };
}

/** Quadro que vale para a linha: o manual, ou o derivado do percentual. */
export function quadroDaVaga(vaga, modelo) {
  return vaga.manual
    ? normalizarQuadro(vaga.quadro, modelo)
    : derivarQuadro(vaga.imediatas, modelo);
}

/** Argumentos de `salvar_configuracao_convocacao`. */
export function argumentosDaConfiguracao(formulario) {
  return {
    p_edital_id: formulario.editalId,
    p_proporcionalidade: formulario.proporcionalidade,
    p_modelo_id: formulario.modeloId || null,
    p_padrao_imediata: formulario.padraoImediata,
    p_vagas: formulario.vagas.map((vaga) => ({
      codigo_vaga: vaga.codigo,
      cargo: vaga.cargo || null,
      imediatas: vaga.imediatas,
      manual: vaga.manual,
      quadro: vaga.quadro || {},
    })),
  };
}

// ── Textos ───────────────────────────────────────────────────────────────

/** Percentual como o edital o escreve: "25%", "2,5%" — nunca "25.00%". */
export function formatarTaxa(valor) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
    Number(valor) || 0,
  )}%`;
}

/** Resumo legível de um quadro: "AC 6 · PP 3 · PCD 1". */
export function resumirQuadro(quadro, modelo) {
  return modelo.categorias
    .filter((categoria) => (quadro[categoria.id] || 0) > 0)
    .map((categoria) => `${categoria.sigla} ${quadro[categoria.id]}`)
    .join(" · ");
}

/** "PP 25% · IND 3% · usado por 6 editais — editar muda todos" */
export function resumoDoModelo(modelo) {
  if (!modelo)
    return "Sem modelo escolhido: não há cota nenhuma, e as vagas imediatas saem todas como ampla concorrência.";
  const reservas = categoriasDeReserva(modelo)
    .map(
      (categoria) => `${categoria.sigla} ${formatarTaxa(categoria.percentual)}`,
    )
    .join(" · ");
  const usos =
    modelo.editais > 1
      ? ` · usado por ${modelo.editais} editais — editar muda todos`
      : "";
  return `${reservas || "Sem reservas"}${usos}`;
}

/* "1ª", "2ª" — feminino, porque o que se numera é a vaga. */
export const ordinalFeminino = (numero) => `${numero}ª`;

// ── Leitura dos campos ───────────────────────────────────────────────────

export function lerInteiro(valor) {
  const numero = Math.floor(Number(valor));
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

export function lerTaxa(valor) {
  const numero = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.min(numero, 100);
}

export const lerPosicoes = (valor) =>
  lerTermos(valor)
    .map(lerInteiro)
    .filter(Boolean)
    .sort((a, b) => a - b);

// ── Editor do modelo ─────────────────────────────────────────────────────

/*
  Cópia profunda: enquanto o editor está aberto, o modelo guardado continua a
  valer para a tabela de vagas ao lado.
*/
export function copiaDoModelo(modelo) {
  return normalizarModelo(JSON.parse(JSON.stringify(modelo)));
}

/** Identificador estável a partir do rótulo, para categoria nova. */
export function idPeloRotulo(rotulo) {
  return normalizarTexto(rotulo).replace(/ /g, "_") || "categoria";
}

export function acrescentarCategoria(modelo) {
  const base = "nova_reserva";
  let id = base;
  let sufixo = 2;
  while (modelo.categorias.some((categoria) => categoria.id === id)) {
    id = `${base}_${sufixo}`;
    sufixo += 1;
  }
  return {
    ...modelo,
    categorias: [
      ...modelo.categorias,
      {
        id,
        rotulo: "Nova reserva",
        sigla: "NR",
        ampla: false,
        acumulavel: false,
        percentual: 0,
        arredondamento: "meio_acima",
        teto: 0,
        minimo: 0,
        termos: [],
        posicoes: [],
        intervalo: 0,
        cascata: [],
        ordem: modelo.categorias.length,
      },
    ],
  };
}

export function removerCategoria(modelo, categoriaId) {
  return {
    ...modelo,
    categorias: modelo.categorias
      .filter((item) => item.id !== categoriaId)
      // A cascata das outras não pode apontar para o que deixou de existir.
      .map((item) => ({
        ...item,
        cascata: item.cascata.filter((id) => id !== categoriaId),
      })),
  };
}

/** `mudancas` é um objeto, ou uma função da categoria atual para o objeto. */
export function alterarCategoria(modelo, categoriaId, mudancas) {
  return {
    ...modelo,
    categorias: modelo.categorias.map((item) =>
      item.id === categoriaId
        ? {
            ...item,
            ...(typeof mudancas === "function" ? mudancas(item) : mudancas),
          }
        : item,
    ),
  };
}

/* Marcar põe o destino no fim da cascata: a ordem é a ordem em que se marca. */
export function alternarNaCascata(cascata, destino, marcar) {
  const sem = cascata.filter((id) => id !== destino);
  return marcar ? [...sem, destino] : sem;
}

/*
  As marcadas vêm primeiro, na ordem da cascata; as outras a seguir, na ordem
  do modelo. Sem isto, a lista mostrava "2º PP" antes de "1º IND" — o número
  dizia a ordem e a disposição dizia outra coisa.
*/
export function destinosDaCascata(categoria, modelo) {
  return modelo.categorias
    .filter((item) => item.id !== categoria.id && !item.ampla)
    .sort((a, b) => {
      const posA = categoria.cascata.indexOf(a.id);
      const posB = categoria.cascata.indexOf(b.id);
      if (posA >= 0 && posB >= 0) return posA - posB;
      if (posA >= 0 || posB >= 0) return posA >= 0 ? -1 : 1;
      return a.ordem - b.ordem;
    });
}

/*
  A regra de acumulação depende de haver uma categoria marcada como
  acumulável. Sem nenhuma, ela degrada em silêncio para "só a de maior
  percentual" — e o gestor ficaria a achar que configurou o 91/2026.
*/
export function faltaCategoriaAcumulavel(modelo) {
  return (
    modelo.cotaMultipla === "acumula_com_acumulavel" &&
    !modelo.categorias.some((categoria) => categoria.acumulavel)
  );
}

export function somaDasReservas(modelo) {
  return categoriasDeReserva(modelo).reduce(
    (total, categoria) => total + categoria.percentual,
    0,
  );
}

/*
  Os ids das categorias acompanham o rótulo só enquanto a categoria é nova.
  Renomear "Quilombola" depois de o modelo estar em uso não pode trocar o id:
  ele é a chave da cascata e do quadro manual já gravado.
*/
export function fixarIdsNovos(modelo) {
  return {
    ...modelo,
    categorias: modelo.categorias.map((categoria) =>
      categoria.id.startsWith("nova_reserva")
        ? { ...categoria, id: idPeloRotulo(categoria.rotulo) }
        : categoria,
    ),
  };
}

/** `p_modelo` de `salvar_modelo_convocacao`: listas viajam como texto. */
export function modeloParaSalvar(modelo) {
  return {
    id: modelo.id || null,
    nome: modelo.nome,
    distribuicao: modelo.distribuicao,
    cotaMultipla: modelo.cotaMultipla,
    categorias: modelo.categorias.map((categoria, indice) => ({
      id: categoria.id,
      rotulo: categoria.rotulo,
      sigla: categoria.sigla,
      ampla: categoria.ampla,
      acumulavel: categoria.acumulavel,
      percentual: categoria.percentual,
      arredondamento: categoria.arredondamento,
      teto: categoria.teto,
      minimo: categoria.minimo,
      termos: categoria.termos.join("; "),
      posicoes: categoria.posicoes.join("; "),
      intervalo: categoria.intervalo,
      cascata: categoria.cascata.join("; "),
      ordem: indice,
    })),
  };
}
