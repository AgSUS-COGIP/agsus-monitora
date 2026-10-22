"""
Mede a leitura dos arquivos nos documentos SINTÉTICOS (sinteticos_leitura.py).

    python tests/python/avaliar_leitura_sintetica.py               # o código deste checkout
    python tests/python/avaliar_leitura_sintetica.py --codigo DIR  # outro checkout (o "antes"): DIR/python

Para cada caso: vínculos esperados e achados, e, dos achados que casam com o
gabarito (pela data de início), quantos têm o empregador, o fim (a data e se é
atual), o cargo e a carga semanal certos; quantos saem com "Empregador não lido" e quantos com
alerta de sobreposição falso (os sintéticos não têm duplicidade de verdade); e
o tempo. As imagens precisam do Tesseract (com o pacote "por").
"""

import argparse
import shutil
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path

AQUI = Path(__file__).resolve().parent
HOJE = date(2026, 10, 9)


def _normal(texto):
    t = unicodedata.normalize("NFD", str(texto or "")).encode("ascii", "ignore").decode().lower()
    return " ".join("".join(c if c.isalnum() else " " for c in t).split())


def _empregador_certo(lido, esperado):
    a, b = _normal(lido), _normal(esperado)
    return bool(a and b) and (a == b or a.startswith(b) or b.startswith(a))


def casos():
    import sinteticos_leitura as s

    medico, enfermeira = s.CONTRATOS_DO_MEDICO, s.CONTRATOS_DA_ENFERMEIRA
    lista = [
        ("CTPS digital · rótulos", lambda: s.ctps_digital(medico, "rotulos")),
        ("CTPS digital · tabela", lambda: s.ctps_digital(medico, "tabela")),
        ("CTPS digital · grade + férias", lambda: s.ctps_digital(medico, "grade")),
        ("CTPS digital · só CNPJ", lambda: s.ctps_digital(enfermeira, "grade", sem_razao_social=(1,))),
        ("Declarações · 6 emissores em 7 páginas", lambda: s.declaracoes_de_vinculo()),
        ("Declarações · caso do médico (OCR sujo)", lambda: s.declaracoes_de_vinculo(s.CASO_DO_MEDICO)),
    ]
    lista += [
        (f"Declaração sozinha · {d['emissor'] or 'só CNPJ'}"[:60], lambda d=d: s.declaracoes_de_vinculo([d]))
        for d in s.DECLARACOES
    ]
    if shutil.which("tesseract"):
        lista += [
            ("CTPS digital impressa como imagem", lambda: s.ctps_digital_impressa_como_imagem(medico[:2])),
            ("Foto da CTPS digital (torta, sombra)", lambda: s.foto_de_ctps_digital(medico[:2])),
            ("Foto da CTPS digital deitada (90°)", lambda: s.foto_de_ctps_digital(enfermeira, girar=90)),
            ("CTPS física fotografada", lambda: s.ctps_fisica(medico[2:])),
            ("Declarações escaneadas (ruído)", lambda: s.declaracoes_como_foto()),
        ]
    return lista


def avaliar(ler_documento):
    linhas = []
    for nome, gerar in casos():
        conteudo, gabarito = gerar()
        inicio = time.perf_counter()
        r = ler_documento(conteudo, "VINCULOS", "Maria Exemplo da Silva", hoje=HOJE)
        segundos = time.perf_counter() - inicio
        itens = [i for i in r["itens"] if i.get("tipo") == "VINCULO"]
        conta = {"empregador": 0, "fim": 0, "cargo": 0, "carga": 0, "casados": 0}
        # Itens a mais que o gabarito (vínculo duplicado entre páginas, rodapé lido como vínculo).
        for g in gabarito:
            item = next((i for i in itens if i.get("inicio") == g["inicio"]), None)
            if item is None:
                continue
            conta["casados"] += 1
            conta["empregador"] += _empregador_certo(item.get("empregador"), g["empregador"])
            # O fim certo é a data certa E a situação certa: atual, encerrado ou fim não informado.
            atual = g.get("atual", g["fim"] is None)
            conta["fim"] += item.get("fim") == g["fim"] and bool(item.get("atual")) == atual
            conta["cargo"] += _normal(item.get("cargo")) == _normal(g["cargo"])
            conta["carga"] += item.get("carga_semanal") == g["carga"]
        alertas = [a["codigo"] for i in itens for a in i.get("alertas") or []]
        linhas.append(
            {
                "caso": nome,
                "esperados": len(gabarito),
                "achados": len(itens),
                **conta,
                "sem_empregador": sum(1 for i in itens if not i.get("empregador")),
                "sobreposto_falso": alertas.count("PERIODO_SOBREPOSTO"),
                "outros_alertas": len([a for a in alertas if a != "PERIODO_SOBREPOSTO"]),
                "metodo": r.get("metodo"),
                "confianca": r.get("confianca"),
                "segundos": round(segundos, 2),
                "resumo": r.get("resumo"),
            }
        )
    return linhas


def avaliar_ocr(ocr):
    """Para cada distorção da foto: quantas das palavras esperadas (CNPJ, datas, empregador, cargo) o OCR leu,
    a confiança e o tempo."""
    import io

    import sinteticos_leitura as s
    from PIL import Image

    contratos = s.CONTRATOS_DO_MEDICO[:2]
    esperadas = s.palavras_esperadas(contratos)
    linhas = []
    for nome, distorcao in s.DISTORCOES:
        foto, _ = s.foto_de_ctps_digital(contratos, **distorcao)
        imagem = Image.open(io.BytesIO(foto)).convert("L")
        inicio = time.perf_counter()
        resultado = ocr(imagem)
        segundos = time.perf_counter() - inicio
        lido = _normal(resultado[0])
        achadas = sum(1 for p in esperadas if _normal(p) in lido)
        linhas.append((nome, achadas, len(esperadas), resultado[1], round(segundos, 2)))
    total = sum(x[1] for x in linhas)
    for nome, achadas, esperado, confianca, segundos in linhas:
        print(f"OCR {nome}: {achadas}/{esperado} palavras · confiança {confianca} · {segundos} s")
    print(f"OCR TOTAL: {total}/{sum(x[2] for x in linhas)} palavras · {round(sum(x[4] for x in linhas), 1)} s")


def imprimir(linhas):
    cabeca = "caso | esp | ach | casa | empr | fim | cargo | carga | s/empr | sobrep | conf | s"
    print(cabeca)
    print("-" * len(cabeca))
    total = {k: 0 for k in ("esperados", "achados", "casados", "empregador", "fim", "cargo", "carga")}
    total.update(sem_empregador=0, sobreposto_falso=0, segundos=0.0)
    for x in linhas:
        print(
            f"{x['caso']} | {x['esperados']} | {x['achados']} | {x['casados']} | {x['empregador']} | {x['fim']} | "
            f"{x['cargo']} | {x['carga']} | {x['sem_empregador']} | {x['sobreposto_falso']} | "
            f"{x['confianca'] if x['confianca'] is not None else '-'} | {x['segundos']}"
        )
        print(f"    {x['resumo']}")
        for k in total:
            total[k] += x[k]
    e = total["esperados"] or 1
    print(
        f"TOTAL: {total['casados']}/{e} vínculos achados; empregador {total['empregador']}/{e}, fim {total['fim']}/{e}, "
        f"cargo {total['cargo']}/{e}, carga {total['carga']}/{e}; {total['achados']} itens; "
        f"{total['sem_empregador']} sem empregador; {total['sobreposto_falso']} sobreposições falsas; "
        f"{round(total['segundos'], 1)} s"
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--codigo", help="raiz de outro checkout (usa DIR/python)")
    parser.add_argument("--ocr", action="store_true", help="mede também só o OCR nas fotos distorcidas")
    args = parser.parse_args()
    raiz = Path(args.codigo).resolve() if args.codigo else AQUI.parent.parent
    sys.path.insert(0, str(AQUI))
    sys.path.insert(0, str(raiz / "python"))
    from monitora.avaliacao_documental.leitura_de_arquivos import VERSAO_DO_EXTRATOR
    from monitora.avaliacao_documental.leitura_de_arquivos.leitura import ler_documento

    print(f"Extrator {VERSAO_DO_EXTRATOR} ({raiz})")
    imprimir(avaliar(ler_documento))
    if args.ocr and shutil.which("tesseract"):
        from monitora.avaliacao_documental.leitura_de_arquivos.extracao import _preparar_imagem, ocr_tesseract

        avaliar_ocr(lambda imagem: ocr_tesseract(_preparar_imagem(imagem)))


if __name__ == "__main__":
    main()
