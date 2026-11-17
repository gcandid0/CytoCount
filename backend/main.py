"""
main.py — API local do CytoCount v1.1.0.

Autor: Gabriel Candido Messias dos Santos
"""
import atexit
import base64
import io
import json
import os
import shutil
import tempfile
import uuid
import zipfile
from typing import Any, Optional

import cv2
import numpy as np
import pandas as pd
from fastapi import Body, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import core

app = FastAPI(title="CytoCount Scientific API", version=core.APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_TEMP_SESSION_DIR = tempfile.mkdtemp(prefix="cytocount_sess_")


def _cleanup_session_dir():
    try:
        shutil.rmtree(_TEMP_SESSION_DIR, ignore_errors=True)
    except Exception:
        pass


atexit.register(_cleanup_session_dir)

# Armazenamento da sessão atual: job_id -> metadados e caminhos em disco
_SESSAO: dict[str, dict[str, Any]] = {}


def _png_base64(rgb_or_gray_array: Optional[np.ndarray]) -> str:
    if rgb_or_gray_array is None or rgb_or_gray_array.size == 0:
        return ""
    img_to_encode = (
        cv2.cvtColor(rgb_or_gray_array, cv2.COLOR_RGB2BGR)
        if rgb_or_gray_array.ndim == 3
        else rgb_or_gray_array
    )
    ok, buf = cv2.imencode(".png", img_to_encode)
    if not ok:
        return ""
    return base64.b64encode(buf.tobytes()).decode("ascii")


def _salvar_artefatos_sessao(
    job_id: str,
    nome_arquivo: str,
    file_bytes: bytes,
    original_rgb: np.ndarray,
    img_bgr_salvar: np.ndarray,
    relatorio: dict[str, Any],
    mascaras: dict[str, Any],
    parametros: dict[str, Any],
    manual_edits: Optional[list[dict[str, Any]]] = None,
):
    raw_path = os.path.join(_TEMP_SESSION_DIR, f"{job_id}_raw.bin")
    orig_path = os.path.join(_TEMP_SESSION_DIR, f"{job_id}_orig.png")
    png_path = os.path.join(_TEMP_SESSION_DIR, f"{job_id}_annotated.png")

    try:
        with open(raw_path, "wb") as f:
            f.write(file_bytes)
        cv2.imwrite(orig_path, cv2.cvtColor(original_rgb, cv2.COLOR_RGB2BGR))
        cv2.imwrite(png_path, img_bgr_salvar)
    except Exception as e:
        print(f"[warning] Falha ao gravar cache em disco: {e}")

    _SESSAO[job_id] = {
        "nome_arquivo": nome_arquivo,
        "relatorio": relatorio,
        "png_path": png_path,
        "orig_path": orig_path,
        "raw_path": raw_path,
        "tabela_celulas": mascaras.get("tabela_celulas", []),
        "parametros": parametros,
        "manual_edits": manual_edits or [],
        "eh_jpeg": mascaras.get("eh_jpeg", False),
    }


@app.get("/health")
def health():
    return {"status": "ok", "version": core.APP_VERSION}


@app.post("/sample-demo")
async def carregar_amostra_demo(idioma: str = Form("pt")):
    """Carrega a imagem de fluorescência de exemplo embutida no pacote e a processa."""
    file_bytes = core.gerar_amostra_exemplo()
    nome_arquivo = "exemplo_fluorescencia.png"
    parametros = {
        "bias_azul": 0,
        "bias_verde": 0,
        "bias_amarelo": 0,
        "kernel_tophat": None,
        "aplicar_bilateral": True,
        "min_circularidade": 0.15,
        "area_maxima": None,
        "formula_viabilidade": "Padrão Biológico (Vivas / (Vivas + Mortas))",
        "roi": None,
        "idioma": idioma,
    }

    relatorio, img_rgb_tela, img_bgr_salvar, original_rgb, mascaras, erro = (
        core.processar_imagem_na_memoria(file_bytes, nome_arquivo, parametros)
    )

    if erro is not None:
        return {"erro": erro, "arquivo": nome_arquivo}

    job_id = str(uuid.uuid4())
    _salvar_artefatos_sessao(
        job_id,
        nome_arquivo,
        file_bytes,
        original_rgb,
        img_bgr_salvar,
        relatorio,
        mascaras,
        parametros,
    )

    return {
        "id": job_id,
        "relatorio": relatorio,
        "processada_png_b64": _png_base64(img_rgb_tela),
        "original_png_b64": _png_base64(original_rgb),
        "mascaras_b64": {
            "azul": _png_base64(mascaras["azul"]),
            "verde": _png_base64(mascaras["verde"]),
            "amarelo": _png_base64(mascaras["amarelo"]),
        },
        "tabela_celulas": mascaras.get("tabela_celulas", []),
        "manual_edits": [],
    }


@app.post("/process")
async def process_imagem(
    arquivo: UploadFile = File(...),
    bias_azul: int = Form(0),
    bias_verde: int = Form(0),
    bias_amarelo: int = Form(0),
    aplicar_bilateral: bool = Form(True),
    min_circularidade: float = Form(0.15),
    area_maxima: Optional[int] = Form(None),
    formula_viabilidade: str = Form("Padrão Biológico (Vivas / (Vivas + Mortas))"),
    roi_json: Optional[str] = Form(None),
    idioma: str = Form("pt"),
):
    file_bytes = await arquivo.read()

    roi = None
    if roi_json:
        try:
            roi = json.loads(roi_json)
        except Exception:
            pass

    parametros = {
        "bias_azul": bias_azul,
        "bias_verde": bias_verde,
        "bias_amarelo": bias_amarelo,
        "kernel_tophat": None,
        "aplicar_bilateral": aplicar_bilateral,
        "min_circularidade": min_circularidade,
        "area_maxima": area_maxima,
        "formula_viabilidade": formula_viabilidade,
        "roi": roi,
        "idioma": idioma,
    }

    nome_arq = arquivo.filename or "amostra.png"
    relatorio, img_rgb_tela, img_bgr_salvar, original_rgb, mascaras, erro = (
        core.processar_imagem_na_memoria(file_bytes, nome_arq, parametros)
    )

    if erro is not None:
        return {"erro": erro, "arquivo": nome_arq}

    job_id = str(uuid.uuid4())
    _salvar_artefatos_sessao(
        job_id,
        nome_arq,
        file_bytes,
        original_rgb,
        img_bgr_salvar,
        relatorio,
        mascaras,
        parametros,
    )

    return {
        "id": job_id,
        "relatorio": relatorio,
        "processada_png_b64": _png_base64(img_rgb_tela),
        "original_png_b64": _png_base64(original_rgb),
        "mascaras_b64": {
            "azul": _png_base64(mascaras["azul"]),
            "verde": _png_base64(mascaras["verde"]),
            "amarelo": _png_base64(mascaras["amarelo"]),
        },
        "tabela_celulas": mascaras.get("tabela_celulas", []),
        "manual_edits": [],
    }


@app.post("/reprocess/{job_id}")
async def reprocessar_amostra(
    job_id: str,
    bias_azul: int = Form(0),
    bias_verde: int = Form(0),
    bias_amarelo: int = Form(0),
    aplicar_bilateral: bool = Form(True),
    min_circularidade: float = Form(0.15),
    area_maxima: Optional[int] = Form(None),
    formula_viabilidade: str = Form("Padrão Biológico (Vivas / (Vivas + Mortas))"),
    roi_json: Optional[str] = Form(None),
    idioma: str = Form("pt"),
):
    if job_id not in _SESSAO:
        return {"erro": "Amostra não encontrada na sessão atual."}

    item = _SESSAO[job_id]
    raw_path = item.get("raw_path")
    if not raw_path or not os.path.exists(raw_path):
        return {"erro": "Arquivo original não disponível em cache."}

    with open(raw_path, "rb") as f:
        file_bytes = f.read()

    roi = None
    if roi_json:
        try:
            roi = json.loads(roi_json)
        except Exception:
            pass

    nome_arquivo = item["nome_arquivo"]
    parametros = {
        "bias_azul": bias_azul,
        "bias_verde": bias_verde,
        "bias_amarelo": bias_amarelo,
        "kernel_tophat": None,
        "aplicar_bilateral": aplicar_bilateral,
        "min_circularidade": min_circularidade,
        "area_maxima": area_maxima,
        "formula_viabilidade": formula_viabilidade,
        "roi": roi,
        "idioma": idioma,
    }

    relatorio, img_rgb_tela, img_bgr_salvar, original_rgb, mascaras, erro = (
        core.processar_imagem_na_memoria(file_bytes, nome_arquivo, parametros)
    )

    if erro is not None:
        return {"erro": erro, "arquivo": nome_arquivo}

    _salvar_artefatos_sessao(
        job_id,
        nome_arquivo,
        file_bytes,
        original_rgb,
        img_bgr_salvar,
        relatorio,
        mascaras,
        parametros,
        manual_edits=[],
    )

    return {
        "id": job_id,
        "relatorio": relatorio,
        "processada_png_b64": _png_base64(img_rgb_tela),
        "original_png_b64": _png_base64(original_rgb),
        "mascaras_b64": {
            "azul": _png_base64(mascaras["azul"]),
            "verde": _png_base64(mascaras["verde"]),
            "amarelo": _png_base64(mascaras["amarelo"]),
        },
        "tabela_celulas": mascaras.get("tabela_celulas", []),
        "manual_edits": [],
    }


@app.post("/update-cells/{job_id}")
async def atualizar_celulas_manual(
    job_id: str,
    payload: dict[str, Any] = Body(...),
):
    """
    Recebe a tabela de células editada manualmente e o histórico `manual_edits`,
    recalcula estatísticas e IC 95% de Wilson pela fonte única da verdade,
    redesenha os contornos e atualiza a imagem de exportação.
    """
    if job_id not in _SESSAO:
        return {"erro": "Amostra não encontrada na sessão para atualização manual."}

    item = _SESSAO[job_id]
    tabela_celulas = payload.get("tabela_celulas", [])
    manual_edits = payload.get("manual_edits", [])
    idioma = payload.get("idioma", item.get("parametros", {}).get("idioma", "pt"))
    formula = payload.get(
        "formula_viabilidade",
        item.get("parametros", {}).get("formula_viabilidade", "Padrão Biológico (Vivas / (Vivas + Mortas))"),
    )

    roi_aplicado = item.get("relatorio", {}).get("ROI Dict")
    eh_jpeg = item.get("eh_jpeg", False)
    nome_arquivo = item["nome_arquivo"]

    relatorio = core.calcular_estatisticas_unificadas(
        tabela_celulas=tabela_celulas,
        formula_viabilidade=formula,
        nome_arquivo=nome_arquivo,
        roi_aplicado=roi_aplicado,
        eh_jpeg=eh_jpeg,
        manual_edits=manual_edits,
    )

    orig_path = item.get("orig_path")
    if orig_path and os.path.exists(orig_path):
        orig_bgr = cv2.imread(orig_path)
        saida_limpa_bgr = core.desenhar_celulas_de_tabela(orig_bgr, tabela_celulas, paleta_daltonismo=False)
        saida_rgb_tela = cv2.cvtColor(saida_limpa_bgr, cv2.COLOR_BGR2RGB)
        saida_bgr_salvar = core.desenhar_legenda_exportacao_pil(
            saida_limpa_bgr,
            relatorio,
            idioma=idioma,
        )
        try:
            cv2.imwrite(item["png_path"], saida_bgr_salvar)
        except Exception:
            pass
        proc_b64 = _png_base64(saida_rgb_tela)
    else:
        proc_b64 = ""

    item["relatorio"] = relatorio
    item["tabela_celulas"] = tabela_celulas
    item["manual_edits"] = manual_edits

    return {
        "id": job_id,
        "relatorio": relatorio,
        "processada_png_b64": proc_b64,
        "tabela_celulas": tabela_celulas,
        "manual_edits": manual_edits,
    }


@app.post("/merge-channels")
async def mesclar_canais(
    arquivo_azul: Optional[UploadFile] = File(None),
    arquivo_verde: Optional[UploadFile] = File(None),
    arquivo_amarelo: Optional[UploadFile] = File(None),
    arquivo_multicanal: Optional[UploadFile] = File(None),
    apenas_preview: bool = Form(False),
    nome_amostra: str = Form("Merge_Multicanal.tif"),
    bias_azul: int = Form(0),
    bias_verde: int = Form(0),
    bias_amarelo: int = Form(0),
    aplicar_bilateral: bool = Form(True),
    min_circularidade: float = Form(0.15),
    area_maxima: Optional[int] = Form(None),
    formula_viabilidade: str = Form("Padrão Biológico (Vivas / (Vivas + Mortas))"),
    idioma: str = Form("pt"),
):
    """
    Suporte a canais separados (DAPI/Azul, FITC/Verde, PI/Vermelho-Amarelo) ou TIFF multicanal,
    com preservação de faixa dinâmica de 16 bits.
    """
    try:
        if arquivo_multicanal is not None:
            raw_bytes = await arquivo_multicanal.read()
            nome_multi = arquivo_multicanal.filename or nome_amostra
            original_rgb, (r_f, g_f, b_f) = core.ler_imagem_flexivel(raw_bytes, nome_multi)
            canais_puros = False
        else:
            canais_lidos = {}
            shape_ref = None
            for chave, up in [
                ("azul", arquivo_azul),
                ("verde", arquivo_verde),
                ("amarelo", arquivo_amarelo),
            ]:
                if up is not None:
                    b_data = await up.read()
                    if b_data:
                        mat = core.extrair_intensidade_monocromatica(b_data, up.filename or "")
                        canais_lidos[chave] = mat
                        if shape_ref is None:
                            shape_ref = mat.shape[:2]

            if not canais_lidos or shape_ref is None:
                return {"erro": "Selecione ao menos um canal (ex.: DAPI/Azul) para realizar o merge."}

            H, W = shape_ref
            for k in list(canais_lidos.keys()):
                if canais_lidos[k].shape[:2] != (H, W):
                    canais_lidos[k] = cv2.resize(canais_lidos[k], (W, H), interpolation=cv2.INTER_LINEAR)

            b_f = canais_lidos.get("azul", np.zeros((H, W), dtype=np.float32))
            g_f = canais_lidos.get("verde", np.zeros((H, W), dtype=np.float32))
            r_f = canais_lidos.get("amarelo", np.zeros((H, W), dtype=np.float32))

            b_8u = core.normalizar_robusto(b_f) if "azul" in canais_lidos else np.zeros((H, W), dtype=np.uint8)
            g_8u = core.normalizar_robusto(g_f) if "verde" in canais_lidos else np.zeros((H, W), dtype=np.uint8)
            r_8u = core.normalizar_robusto(r_f) if "amarelo" in canais_lidos else np.zeros((H, W), dtype=np.uint8)

            # Compõe RGB onde canal_amarelo (PI/Mortas) contribui para R e levemente G (visualização laranja/amarela)
            r_comp = r_8u
            g_comp = np.clip(g_8u.astype(np.int32) + (r_8u.astype(np.int32) * 2 // 3), 0, 255).astype(np.uint8)
            b_comp = b_8u
            original_rgb = np.stack([r_comp, g_comp, b_comp], axis=-1)
            canais_puros = True

        if apenas_preview:
            return {
                "preview_png_b64": _png_base64(original_rgb),
                "largura": int(original_rgb.shape[1]),
                "altura": int(original_rgb.shape[0]),
            }

        parametros = {
            "bias_azul": bias_azul,
            "bias_verde": bias_verde,
            "bias_amarelo": bias_amarelo,
            "kernel_tophat": None,
            "aplicar_bilateral": aplicar_bilateral,
            "min_circularidade": min_circularidade,
            "area_maxima": area_maxima,
            "formula_viabilidade": formula_viabilidade,
            "roi": None,
            "idioma": idioma,
            "canais_separados_puros": canais_puros,
        }

        relatorio, img_rgb_tela, img_bgr_salvar, orig_rgb_out, mascaras, erro = (
            core.processar_canais_em_memoria(original_rgb, r_f, g_f, b_f, nome_amostra, parametros)
        )
        if erro is not None:
            return {"erro": erro, "arquivo": nome_amostra}

        ok_enc, buf_merged = cv2.imencode(".png", cv2.cvtColor(orig_rgb_out, cv2.COLOR_RGB2BGR))
        merged_bytes = buf_merged.tobytes() if ok_enc else b""

        job_id = str(uuid.uuid4())
        _salvar_artefatos_sessao(
            job_id,
            nome_amostra,
            merged_bytes,
            orig_rgb_out,
            img_bgr_salvar,
            relatorio,
            mascaras,
            parametros,
        )

        return {
            "id": job_id,
            "relatorio": relatorio,
            "processada_png_b64": _png_base64(img_rgb_tela),
            "original_png_b64": _png_base64(orig_rgb_out),
            "mascaras_b64": {
                "azul": _png_base64(mascaras["azul"]),
                "verde": _png_base64(mascaras["verde"]),
                "amarelo": _png_base64(mascaras["amarelo"]),
            },
            "tabela_celulas": mascaras.get("tabela_celulas", []),
            "manual_edits": [],
        }
    except Exception as e:
        return {"erro": f"Erro ao mesclar canais: {e}"}


@app.post("/export-publication/{job_id}")
async def exportar_figura_publicacao(
    job_id: str,
    payload: dict[str, Any] = Body(...),
):
    """
    Gera figura em 300 ou 600 DPI (PNG, TIFF, PDF, SVG) com metadados de resolução embutidos,
    barra de escala (µm/pixel), legenda TrueType localizada e opções de paleta/painel.
    """
    if job_id not in _SESSAO:
        return {"erro": "Amostra não encontrada na sessão atual."}

    item = _SESSAO[job_id]
    orig_path = item.get("orig_path")
    if not orig_path or not os.path.exists(orig_path):
        return {"erro": "Imagem original não encontrada em cache."}

    orig_bgr = cv2.imread(orig_path)
    if orig_bgr is None:
        return {"erro": "Falha ao ler imagem original em cache."}
    original_rgb = cv2.cvtColor(orig_bgr, cv2.COLOR_BGR2RGB)

    formato = str(payload.get("formato", "png")).lower()
    dpi = int(payload.get("dpi", 300))
    idioma = str(payload.get("idioma", "pt"))
    mostrar_contornos = bool(payload.get("mostrar_contornos", True))
    tema_fundo = str(payload.get("tema_fundo", "escuro"))
    paleta_daltonismo = bool(payload.get("paleta_daltonismo", False))
    lado_a_lado = bool(payload.get("lado_a_lado", False))
    um_por_pixel = payload.get("um_por_pixel")
    tamanho_barra_um = payload.get("tamanho_barra_um", 50.0)

    um_val = float(um_por_pixel) if (um_por_pixel is not None and str(um_por_pixel).strip() != "") else None
    barra_val = float(tamanho_barra_um) if (tamanho_barra_um is not None and str(tamanho_barra_um).strip() != "") else 50.0

    try:
        fig_bytes, mime_type = core.gerar_figura_publicacao(
            original_rgb=original_rgb,
            tabela_celulas=item.get("tabela_celulas", []),
            relatorio=item.get("relatorio", {}),
            formato=formato,
            dpi=dpi,
            idioma=idioma,
            mostrar_contornos=mostrar_contornos,
            tema_fundo=tema_fundo,
            paleta_daltonismo=paleta_daltonismo,
            lado_a_lado=lado_a_lado,
            um_por_pixel=um_val,
            tamanho_barra_um=barra_val,
        )
    except Exception as e:
        return {"erro": f"Erro ao gerar figura para publicação: {e}"}

    nome_base = item["nome_arquivo"].rsplit(".", 1)[0]
    ext = "tiff" if formato in ("tif", "tiff") else ("pdf" if formato == "pdf" else ("svg" if formato == "svg" else "png"))
    nome_sugerido = f"{nome_base}_CytoCount_{dpi}DPI.{ext}"

    return {
        "conteudo_b64": base64.b64encode(fig_bytes).decode("ascii"),
        "nome_sugerido": nome_sugerido,
        "extensao": ext,
        "mime": mime_type,
    }


def _construir_zip_sessao(job_ids: list[str]) -> bytes:
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        relatorios = [_SESSAO[i]["relatorio"] for i in job_ids]
        zf.writestr(
            "relatorio_consolidado.csv",
            pd.DataFrame(relatorios).to_csv(index=False).encode("utf-8"),
        )

        for jid in job_ids:
            item = _SESSAO[jid]
            nome_base = item["nome_arquivo"].rsplit(".", 1)[0]
            if item["tabela_celulas"]:
                df_cel = pd.DataFrame(item["tabela_celulas"]).drop(columns=["contorno_pts"], errors="ignore")
                zf.writestr(
                    f"celulas_individuais_{nome_base}.csv",
                    df_cel.to_csv(index=False).encode("utf-8"),
                )
            png_p = item.get("png_path")
            if png_p and os.path.exists(png_p):
                zf.write(png_p, arcname=f"{nome_base}_resultado.png")

    zip_buffer.seek(0)
    return zip_buffer.getvalue()


@app.get("/export-zip")
def export_zip(ids: str):
    job_ids = [i for i in ids.split(",") if i in _SESSAO]
    if not job_ids:
        return {"erro": "Nenhum resultado válido para exportar."}
    zip_bytes = _construir_zip_sessao(job_ids)
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=CytoCount_Resultados.zip"},
    )


@app.get("/export-zip-b64")
def export_zip_b64(ids: str):
    job_ids = [i for i in ids.split(",") if i in _SESSAO]
    if not job_ids:
        return {"erro": "Nenhum resultado válido para exportar."}
    zip_bytes = _construir_zip_sessao(job_ids)
    return {
        "conteudo_b64": base64.b64encode(zip_bytes).decode("ascii"),
        "nome_sugerido": "CytoCount_Resultados.zip",
    }


@app.delete("/session")
def limpar_sessao():
    _SESSAO.clear()
    for fname in os.listdir(_TEMP_SESSION_DIR):
        try:
            os.remove(os.path.join(_TEMP_SESSION_DIR, fname))
        except Exception:
            pass
    return {"status": "limpo"}


def _start_parent_watchdog(parent_pid: int):
    import sys
    import threading

    def _watch():
        if sys.platform == "win32":
            import ctypes
            SYNCHRONIZE = 0x00100000
            INFINITE = 0xFFFFFFFF
            kernel32 = ctypes.windll.kernel32
            handle = kernel32.OpenProcess(SYNCHRONIZE, False, parent_pid)
            if not handle:
                print(f"[watchdog] Processo pai {parent_pid} já finalizado. Encerrando.")
                os._exit(0)
            kernel32.WaitForSingleObject(handle, INFINITE)
            kernel32.CloseHandle(handle)
            print("[watchdog] Processo pai fechado. Encerrando backend Python.")
            os._exit(0)
        else:
            import time
            while True:
                time.sleep(2)
                try:
                    os.kill(parent_pid, 0)
                except OSError:
                    print("[watchdog] Processo pai inacessível. Encerrando.")
                    os._exit(0)

    t = threading.Thread(target=_watch, daemon=True, name="ParentWatchdog")
    t.start()


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="CytoCount Backend API")
    parser.add_argument("--port", type=int, default=8756, help="Porta local para escuta")
    parser.add_argument("--parent-pid", type=int, default=None, help="PID do processo pai para watchdog")
    args = parser.parse_args()

    if args.parent_pid:
        _start_parent_watchdog(args.parent_pid)

    print(f"[viacell-backend] Escutando em http://127.0.0.1:{args.port} (PID: {os.getpid()})")
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
