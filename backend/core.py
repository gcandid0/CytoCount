"""
core.py — Motor científico de visão computacional e bioestatística do CytoCount v1.1.0.

Autor: Gabriel Candido Messias dos Santos
"""
import base64
import io
import math
import os
import sys
from typing import Any, Optional

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
from skimage.segmentation import watershed

try:
    import tifffile
except ImportError:
    tifffile = None

APP_VERSION = "1.1.0"

# =========================================================================
# CONFIGURAÇÃO / CALIBRAÇÃO
# =========================================================================
AREA_MINIMA_CELULA = 15
AREA_MINIMA_MORTA = 4
MIN_DISTANCE_CELULA = 7
MIN_DISTANCE_MORTA = 3
RUIDO_AREA_MINIMA_PX = 6
FRACAO_MINIMA_AMARELA = 0.15
FRACAO_MINIMA_VERDE = 0.15


# =========================================================================
# ESTATÍSTICA CIENTÍFICA & FORMATAÇÃO POR IDIOMA (FONTE ÚNICA DA VERDADE)
# =========================================================================

def wilson(vivas: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Intervalo de confiança binomial de Wilson 95% (em porcentagem 0-100)."""
    v = int(round(vivas))
    total = int(round(n))
    if total <= 0:
        return (0.0, 0.0)
    p = v / total
    d = 1.0 + z * z / total
    c = p + z * z / (2.0 * total)
    termo = p * (1.0 - p) / total + z * z / (4.0 * total * total)
    m = z * math.sqrt(max(0.0, termo))
    low = max(0.0, (c - m) / d * 100.0)
    high = min(100.0, (c + m) / d * 100.0)
    return (round(low, 1), round(high, 1))


def formatar_inteiro_locale(valor: int, idioma: str = "pt") -> str:
    s = f"{int(valor):,}"
    if idioma in ("pt", "es"):
        return s.replace(",", ".")
    return s


def formatar_decimal_locale(valor: float, idioma: str = "pt", casas: int = 1) -> str:
    s = f"{float(valor):.{casas}f}"
    if idioma in ("pt", "es"):
        return s.replace(".", ",")
    return s


def formatar_viabilidade_padrao(
    viabilidade: float,
    ic_baixo: float,
    ic_alto: float,
    idioma: str = "pt",
    base_calculo: int = 1,
) -> str:
    """Retorna string padronizada: '91,3% (IC 95%: 90,1–92,4)' conforme idioma ou '—' se base_calculo <= 0."""
    if base_calculo <= 0:
        return "—"
    v_str = formatar_decimal_locale(viabilidade, idioma, 1)
    lo_str = formatar_decimal_locale(ic_baixo, idioma, 1)
    hi_str = formatar_decimal_locale(ic_alto, idioma, 1)
    rotulo_ic = "95% CI" if idioma == "en" else "IC 95%"
    return f"{v_str}% ({rotulo_ic}: {lo_str}\u2013{hi_str})"


def calcular_estatisticas_unificadas(
    tabela_celulas: list[dict[str, Any]],
    formula_viabilidade: str,
    nome_arquivo: str = "",
    roi_aplicado: Optional[dict[str, int]] = None,
    eh_jpeg: bool = False,
    manual_edits: Optional[list[dict[str, Any]]] = None,
    motor_segmentacao: str = "watershed",
) -> dict[str, Any]:
    """
    FONTE ÚNICA DA VERDADE para todas as contagens e porcentagens no CytoCount:
      - detectados = todos os núcleos segmentados (len(tabela_celulas))
      - vivas, mortas = classificadas
      - indeterminadas = detectados - vivas - mortas
      - viabilidade = vivas / (vivas + mortas) [ou vivas / detectados no modo Rigoroso]
    """
    detectados = len(tabela_celulas)
    vivas = sum(1 for c in tabela_celulas if c.get("classificacao") == "viavel")
    mortas = sum(1 for c in tabela_celulas if c.get("classificacao") == "morta")
    indeterminadas = max(0, detectados - vivas - mortas)

    pct_vivas = round((vivas / detectados) * 100.0, 1) if detectados > 0 else 0.0
    pct_mortas = round((mortas / detectados) * 100.0, 1) if detectados > 0 else 0.0
    pct_indet = round((indeterminadas / detectados) * 100.0, 1) if detectados > 0 else 0.0

    eh_rigoroso = "Rigoroso" in (formula_viabilidade or "")
    base_calculo = detectados if eh_rigoroso else (vivas + mortas)

    viabilidade = round(min((vivas / base_calculo) * 100.0, 100.0), 1) if base_calculo > 0 else 0.0
    ic_baixo, ic_alto = wilson(vivas, base_calculo)
    alerta_indeterminadas = pct_indet > 15.0

    roi_str = (
        f"{roi_aplicado['w']}x{roi_aplicado['h']} ({roi_aplicado['x']},{roi_aplicado['y']})"
        if roi_aplicado
        else "Imagem Completa"
    )

    n_edicoes = len(manual_edits) if manual_edits else 0
    mapa_motores = {
        "watershed": "Watershed Clássico",
        "stardist": "StarDist 2D",
        "cellpose": "Cellpose 2D",
    }
    nome_motor = mapa_motores.get((motor_segmentacao or "watershed").lower(), "Watershed Clássico")

    return {
        "Arquivo": nome_arquivo,
        "Total (Azul)": detectados,
        "Detectados": detectados,
        "Viáveis (Verde)": vivas,
        "Mortas (Amarelo)": mortas,
        "Indeterminadas": indeterminadas,
        "Pct Viáveis (%)": pct_vivas,
        "Pct Mortas (%)": pct_mortas,
        "Pct Indeterminadas (%)": pct_indet,
        "Base de Cálculo": base_calculo,
        "Viabilidade (%)": viabilidade,
        "IC 95% Baixo": ic_baixo,
        "IC 95% Alto": ic_alto,
        "Viabilidade Formatada PT": formatar_viabilidade_padrao(viabilidade, ic_baixo, ic_alto, "pt", base_calculo),
        "Viabilidade Formatada EN": formatar_viabilidade_padrao(viabilidade, ic_baixo, ic_alto, "en", base_calculo),
        "Viabilidade Formatada ES": formatar_viabilidade_padrao(viabilidade, ic_baixo, ic_alto, "es", base_calculo),
        "Alerta Indeterminadas": alerta_indeterminadas,
        "ROI": roi_str,
        "ROI Dict": roi_aplicado,
        "Edições Manuais": n_edicoes,
        "Motor de Segmentação": nome_motor,
        "Formato com perda (JPEG)": "Sim" if eh_jpeg else "Não",
    }


# =========================================================================
# LEITURA DE IMAGENS (INCLUINDO TIFF 16-BIT E MULTICANAL)
# =========================================================================

def normalizar_robusto(canal_float: np.ndarray, p_baixo: float = 0.5, p_alto: float = 99.5) -> np.ndarray:
    """Normaliza imagem de 8, 12 ou 16 bits para uint8 preservando a faixa dinâmica real via percentis."""
    arr = canal_float.astype(np.float32)
    lo, hi = np.percentile(arr, [p_baixo, p_alto])
    if hi <= lo:
        lo, hi = float(arr.min()), float(arr.max())
        if hi <= lo:
            return np.zeros(arr.shape, dtype=np.uint8)
    canal_clip = np.clip(arr, lo, hi)
    canal_norm = (canal_clip - lo) / (hi - lo) * 255.0
    return canal_norm.astype(np.uint8)


def ler_imagem_flexivel(file_bytes: bytes, nome_arquivo: str = "") -> tuple[np.ndarray, tuple[np.ndarray, np.ndarray, np.ndarray]]:
    """
    Lê imagens 8-bit, 16-bit ou TIFF multicanal sem perda de faixa dinâmica.
    Retorna:
      - original_rgb_8u: imagem RGB uint8 para exibição em tela
      - (r_float, g_float, b_float): canais em float32 preservando profundidade de 16 bits quando disponível
    """
    nome_lower = (nome_arquivo or "").lower()
    eh_tiff = nome_lower.endswith((".tif", ".tiff"))

    if eh_tiff and tifffile is not None:
        try:
            arr = tifffile.imread(io.BytesIO(file_bytes))
            if arr is not None and arr.ndim >= 2:
                # Trata dimensões (C, H, W) vs (H, W, C) vs (H, W)
                if arr.ndim == 2:
                    c_float = arr.astype(np.float32)
                    c_8u = normalizar_robusto(c_float)
                    rgb_8u = np.stack([c_8u, c_8u, c_8u], axis=-1)
                    return rgb_8u, (c_float, c_float, c_float)
                elif arr.ndim == 3:
                    # Se a primeira dimensão for pequena (2, 3 ou 4 canais) e H, W maiores: formato planar (C, H, W)
                    if arr.shape[0] in (2, 3, 4) and arr.shape[1] > 8 and arr.shape[2] > 8:
                        arr = np.transpose(arr, (1, 2, 0))
                    ch = arr.shape[2]
                    if ch == 1:
                        c_float = arr[..., 0].astype(np.float32)
                        c_8u = normalizar_robusto(c_float)
                        rgb_8u = np.stack([c_8u, c_8u, c_8u], axis=-1)
                        return rgb_8u, (c_float, c_float, c_float)
                    elif ch == 2:
                        # 2 canais: assume canal 0 = DAPI/Azul ou Verde, canal 1 = Verde/Vermelho
                        c0 = arr[..., 0].astype(np.float32)
                        c1 = arr[..., 1].astype(np.float32)
                        z = np.zeros_like(c0)
                        rgb_8u = np.stack([normalizar_robusto(z), normalizar_robusto(c1), normalizar_robusto(c0)], axis=-1)
                        return rgb_8u, (z, c1, c0)
                    else:
                        r_f = arr[..., 0].astype(np.float32)
                        g_f = arr[..., 1].astype(np.float32)
                        b_f = arr[..., 2].astype(np.float32)
                        if arr.dtype == np.uint8:
                            rgb_8u = arr[..., :3].copy()
                        else:
                            rgb_8u = np.stack([
                                normalizar_robusto(r_f),
                                normalizar_robusto(g_f),
                                normalizar_robusto(b_f),
                            ], axis=-1)
                        return rgb_8u, (r_f, g_f, b_f)
        except Exception:
            pass

    # Tentativa via OpenCV IMREAD_UNCHANGED para preservar 16-bit PNG/TIFF
    buf_np = np.frombuffer(file_bytes, dtype=np.uint8)
    decoded = cv2.imdecode(buf_np, cv2.IMREAD_UNCHANGED)
    if decoded is not None:
        if decoded.ndim == 2:
            c_f = decoded.astype(np.float32)
            c_8u = normalizar_robusto(c_f) if decoded.dtype != np.uint8 else decoded
            rgb_8u = np.stack([c_8u, c_8u, c_8u], axis=-1)
            return rgb_8u, (c_f, c_f, c_f)
        elif decoded.ndim == 3 and decoded.shape[2] >= 3:
            # OpenCV lê em BGR(A)
            b_f = decoded[..., 0].astype(np.float32)
            g_f = decoded[..., 1].astype(np.float32)
            r_f = decoded[..., 2].astype(np.float32)
            if decoded.dtype == np.uint8:
                rgb_8u = cv2.cvtColor(decoded[..., :3], cv2.COLOR_BGR2RGB)
            else:
                rgb_8u = np.stack([
                    normalizar_robusto(r_f),
                    normalizar_robusto(g_f),
                    normalizar_robusto(b_f),
                ], axis=-1)
            return rgb_8u, (r_f, g_f, b_f)

    # Fallback PIL
    pil_img = Image.open(io.BytesIO(file_bytes))
    pil_img.verify()
    pil_img = Image.open(io.BytesIO(file_bytes))
    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")
    rgb_8u = np.array(pil_img)
    return rgb_8u, (
        rgb_8u[..., 0].astype(np.float32),
        rgb_8u[..., 1].astype(np.float32),
        rgb_8u[..., 2].astype(np.float32),
    )


def extrair_intensidade_monocromatica(file_bytes: bytes, nome_arquivo: str = "") -> np.ndarray:
    """Extrai matriz 2D float32 de um arquivo de canal individual (16-bit ou 8-bit)."""
    rgb_8u, (r_f, g_f, b_f) = ler_imagem_flexivel(file_bytes, nome_arquivo)
    # Usa o valor máximo entre os canais (caso a imagem do canal já esteja colorizada em azul/verde/vermelho)
    return np.maximum(np.maximum(r_f, g_f), b_f)


# =========================================================================
# FUNÇÕES DE SEGMENTAÇÃO E MORFOLOGIA
# =========================================================================

def estimar_kernel_tophat(shape):
    menor_lado = min(shape[:2])
    kernel = int(menor_lado * 0.035)
    kernel = kernel + 1 if kernel % 2 == 0 else kernel
    return int(np.clip(kernel, 35, 65))


def corrigir_fundo(canal, kernel_size=None, aplicar_bilateral=True):
    canal = cv2.medianBlur(canal, 3)
    if aplicar_bilateral:
        canal = cv2.bilateralFilter(canal, d=5, sigmaColor=50, sigmaSpace=50)
    if kernel_size is None:
        kernel_size = estimar_kernel_tophat(canal.shape)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    tophat = cv2.morphologyEx(canal, cv2.MORPH_TOPHAT, kernel)
    return tophat


def limiar_otsu_com_ajuste(canal, bias=0):
    canal_8u = cv2.normalize(canal, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    canal_suave = cv2.GaussianBlur(canal_8u, (5, 5), 0)
    valor_otsu, _ = cv2.threshold(canal_suave, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    valor_final = float(np.clip(valor_otsu - bias, 1, 254))
    _, mask = cv2.threshold(canal_suave, valor_final, 255, cv2.THRESH_BINARY)
    return mask.astype(np.uint8), valor_final, canal_suave


def remover_ruido_pontual(mask, area_minima_px=RUIDO_AREA_MINIMA_PX):
    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n_labels <= 1:
        return mask
    valid_labels = np.where(stats[1:, cv2.CC_STAT_AREA] >= area_minima_px)[0] + 1
    lut = np.zeros(n_labels, dtype=np.uint8)
    lut[valid_labels] = 255
    return lut[labels]


def limpar_mascara(mask):
    mask = remover_ruido_pontual(mask)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = ndi.binary_fill_holes(mask > 0).astype(np.uint8) * 255
    mask = remover_ruido_pontual(mask)
    return mask


def estimar_escala_objeto(mask):
    n_labels, labels = cv2.connectedComponents(mask)
    if n_labels <= 1:
        return None
    areas = ndi.sum(np.ones_like(labels), labels, index=range(1, n_labels))
    areas = np.asarray(areas)
    areas = areas[areas > 0]
    if areas.size == 0:
        return None
    return float(np.median(areas))


def contar_objetos(
    mask,
    area_minima=None,
    area_maxima=None,
    min_circularidade=0.0,
    min_distance=None,
    auto=True,
    fator_area_min=0.12,
    fator_distancia=0.6,
    area_minima_piso=RUIDO_AREA_MINIMA_PX,
    distancia_piso=2,
    distancia_teto=25,
):
    mask = limpar_mascara(mask)

    if auto:
        escala = estimar_escala_objeto(mask)
        if escala is not None and escala > 0:
            raio_equivalente = np.sqrt(escala / np.pi)
            min_distance = int(np.clip(raio_equivalente * fator_distancia, distancia_piso, distancia_teto))
            area_minima = max(area_minima_piso, escala * fator_area_min)
        else:
            min_distance = min_distance or distancia_piso
            area_minima = area_minima or area_minima_piso

    dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)

    if dist.max() == 0:
        return 0, np.zeros_like(mask, dtype=np.int32), {"area_minima": area_minima, "min_distance": min_distance}

    dist_suave = cv2.GaussianBlur(dist, (5, 5), 1.0)

    k_size = max(3, int(min_distance) * 2 + 1)
    kernel_peak = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
    dilated = cv2.dilate(dist_suave, kernel_peak)
    peaks_mask = (dist_suave == dilated) & (dist_suave > 0.5) & (mask > 0)

    _, markers = cv2.connectedComponents(peaks_mask.astype(np.uint8))
    if markers.max() == 0:
        markers, _ = ndi.label(peaks_mask)

    labels = watershed(-dist, markers, mask=mask)

    max_lbl = labels.max()
    if max_lbl == 0:
        return 0, np.zeros_like(labels), {"area_minima": round(float(area_minima or 0), 1), "min_distance": min_distance}

    areas = np.bincount(labels.ravel())
    slices = ndi.find_objects(labels)

    numero_celulas = 0
    valid_labels = []

    for label_id in range(1, len(areas)):
        area_pixel = areas[label_id]
        if area_pixel < area_minima:
            continue
        if area_maxima is not None and area_pixel > area_maxima:
            continue

        if min_circularidade > 0.0:
            sl = slices[label_id - 1] if (label_id - 1 < len(slices)) else None
            if sl is None:
                continue
            sub_labels = labels[sl]
            mask_obj = np.uint8(sub_labels == label_id) * 255
            contornos, _ = cv2.findContours(mask_obj, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contornos:
                continue
            c = contornos[0]
            area_contour = cv2.contourArea(c)
            perimetro = cv2.arcLength(c, True)
            if perimetro == 0:
                continue
            circularidade = (4 * np.pi * area_contour) / (perimetro * perimetro)
            if circularidade < min_circularidade:
                continue

        numero_celulas += 1
        valid_labels.append(label_id)

    lut = np.zeros(max_lbl + 1, dtype=labels.dtype)
    if valid_labels:
        lut[valid_labels] = valid_labels
    labels_filtrados = lut[labels]

    return numero_celulas, labels_filtrados, {"area_minima": round(float(area_minima or 0), 1), "min_distance": min_distance}


def desenhar_contornos(img, labels, cor, espessura=1):
    saida = img.copy()
    max_lbl = labels.max()
    if max_lbl == 0:
        return saida
    slices = ndi.find_objects(labels)
    for idx, sl in enumerate(slices):
        if sl is None:
            continue
        label_id = idx + 1
        sub_labels = labels[sl]
        mask_obj = np.uint8(sub_labels == label_id) * 255
        contornos, _ = cv2.findContours(mask_obj, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        y0, x0 = sl[0].start, sl[1].start
        for c in contornos:
            c[:, 0, 0] += x0
            c[:, 0, 1] += y0
            cv2.drawContours(saida, [c], -1, cor, espessura)
    return saida


def desenhar_celulas_de_tabela(
    img_bgr: np.ndarray,
    tabela_celulas: list[dict[str, Any]],
    paleta_daltonismo: bool = False,
) -> np.ndarray:
    """
    Desenha contornos a partir da lista de células (suportando contornos poligonais originais
    e células adicionadas/editadas manualmente pelo usuário).
    Cores BGR:
      - Padrão: viavel = Verde (0, 255, 0), morta = Amarelo (0, 255, 255), indeterminada = Azul (255, 110, 40)
      - Daltonismo (Okabe-Ito): viavel = Ciano-Verde (180, 220, 0), morta = Magenta/Vermelho (120, 60, 255), indet = Azul claro (255, 190, 80)
    """
    saida = img_bgr.copy()
    if paleta_daltonismo:
        cores = {
            "viavel": (180, 230, 0),
            "morta": (130, 50, 255),
            "indeterminada": (255, 180, 60),
        }
        cor_nucleo_base = (255, 170, 50)
    else:
        cores = {
            "viavel": (0, 255, 0),
            "morta": (0, 255, 255),
            "indeterminada": (255, 100, 30),
        }
        cor_nucleo_base = (255, 0, 0)

    for cel in tabela_celulas:
        classe = cel.get("classificacao", "indeterminada")
        cor = cores.get(classe, cores["indeterminada"])
        pts = cel.get("contorno_pts")
        if pts and isinstance(pts, list) and len(pts) >= 3:
            arr_pts = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
            cv2.drawContours(saida, [arr_pts], -1, cor_nucleo_base, 1)
            cv2.drawContours(saida, [arr_pts], -1, cor, 1)
        else:
            cx = int(cel.get("centro_x", 0))
            cy = int(cel.get("centro_y", 0))
            raio = max(3, int(round(float(cel.get("raio_eq", 7.0)))))
            cv2.circle(saida, (cx, cy), raio, cor, 1, cv2.LINE_AA)

    return saida


def _filtrar_labels_morfologia(
    labels: np.ndarray,
    area_minima: float,
    area_maxima: Optional[float],
    min_circularidade: float,
) -> tuple[int, np.ndarray]:
    """Filtra matriz de labels por área mínima, área máxima e circularidade mínima."""
    max_lbl = int(labels.max())
    if max_lbl == 0:
        return 0, np.zeros_like(labels, dtype=np.int32)

    areas = np.bincount(labels.ravel())
    slices = ndi.find_objects(labels)

    numero_celulas = 0
    valid_labels = []

    for label_id in range(1, len(areas)):
        area_pixel = areas[label_id]
        if area_pixel < area_minima:
            continue
        if area_maxima is not None and area_pixel > area_maxima:
            continue

        if min_circularidade > 0.0:
            sl = slices[label_id - 1] if (label_id - 1 < len(slices)) else None
            if sl is None:
                continue
            sub_labels = labels[sl]
            mask_obj = np.uint8(sub_labels == label_id) * 255
            contornos, _ = cv2.findContours(mask_obj, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contornos:
                continue
            c = max(contornos, key=cv2.contourArea)
            area_contour = cv2.contourArea(c)
            perimetro = cv2.arcLength(c, True)
            if perimetro == 0:
                continue
            circularidade = (4 * np.pi * area_contour) / (perimetro * perimetro)
            if circularidade < min_circularidade:
                continue

        numero_celulas += 1
        valid_labels.append(label_id)

    lut = np.zeros(max_lbl + 1, dtype=np.int32)
    if valid_labels:
        lut[valid_labels] = np.arange(1, len(valid_labels) + 1, dtype=np.int32)
    return numero_celulas, lut[labels]


def segmentar_nucleos_stardist(
    canal_8u: np.ndarray,
    corrigido: np.ndarray,
    mask_base: np.ndarray,
    bias: int = 0,
    area_maxima: Optional[float] = None,
    min_circularidade: float = 0.0,
) -> tuple[int, np.ndarray, dict[str, Any]]:
    """
    Motor StarDist 2D (Schmidt et al., MICCAI 2018):
    1. Se o pacote `stardist` estiver instalado no ambiente Python com pesos '2D_versatile_fluo',
       executa a inferência neural direta.
    2. Caso contrário (ou no executável autônomo sem TensorFlow), executa a formulação matemática
       do StarDist 2D: Mapa de probabilidade centro-radial + projeção de polígonos estrelados
       convexos de 32 raios (Star-Convex Polygons) + Non-Maximum Suppression (NMS) poligonal.
    """
    escala = estimar_escala_objeto(mask_base)
    raio_est = float(np.sqrt(escala / np.pi)) if (escala and escala > 0) else 7.5
    area_minima = max(float(RUIDO_AREA_MINIMA_PX), (escala or 40.0) * 0.14)
    min_dist = int(np.clip(raio_est * 0.55, 3, 22))

    # Tentativa 1: Pacote oficial StarDist2D se instalado no Python do sistema
    try:
        from stardist.models import StarDist2D  # type: ignore
        from csbdeep.utils import normalize as csb_norm  # type: ignore

        model = StarDist2D.from_pretrained("2D_versatile_fluo")
        prob_thr = float(np.clip(0.48 - bias * 0.008, 0.15, 0.85))
        img_norm = csb_norm(canal_8u.astype(np.float32), 1.0, 99.8)
        labels_sd, _ = model.predict_instances(img_norm, prob_thresh=prob_thr, nms_thresh=0.35)
        n_cel, labels_filt = _filtrar_labels_morfologia(
            labels_sd.astype(np.int32), area_minima, area_maxima, min_circularidade
        )
        return n_cel, labels_filt, {
            "area_minima": round(area_minima, 1),
            "min_distance": min_dist,
            "motor": "stardist_pretrained",
        }
    except Exception:
        pass

    # Formulação Matemática StarDist 2D (Polígonos Estrelados de 32 Raios + Supressão Não-Máxima NMS)
    H, W = canal_8u.shape[:2]
    mask_limpa = limpar_mascara(mask_base)
    dist = cv2.distanceTransform(mask_limpa, cv2.DIST_L2, 5)
    if dist.max() <= 0:
        return 0, np.zeros((H, W), dtype=np.int32), {"area_minima": round(area_minima, 1), "min_distance": min_dist}

    # Mapa de Probabilidade Central P(y, x) combinando intensidade normalizada + distância radial + filtro LoG
    norm_int = normalizar_robusto(corrigido.astype(np.float32), 1.0, 99.8).astype(np.float32) / 255.0
    dist_norm = dist / (dist.max() + 1e-6)
    g1 = cv2.GaussianBlur(norm_int, (0, 0), max(1.2, raio_est * 0.35))
    g2 = cv2.GaussianBlur(norm_int, (0, 0), max(2.4, raio_est * 0.85))
    dog = np.clip(g1 - 0.65 * g2, 0.0, 1.0)
    prob_map = (0.45 * dist_norm + 0.35 * norm_int + 0.20 * dog) * (mask_limpa > 0)

    prob_thresh = float(np.clip(0.22 - bias * 0.005, 0.08, 0.65))
    k_peak = max(3, int(min_dist) * 2 + 1)
    kernel_p = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_peak, k_peak))
    dilated_p = cv2.dilate(prob_map, kernel_p)
    peaks = (prob_map >= dilated_p - 1e-6) & (prob_map >= prob_thresh) & (dist >= 1.5)

    ys, xs = np.where(peaks)
    if len(ys) == 0:
        return 0, np.zeros((H, W), dtype=np.int32), {"area_minima": round(area_minima, 1), "min_distance": min_dist}

    scores = prob_map[ys, xs]
    ordem = np.argsort(-scores)
    ys = ys[ordem]
    xs = xs[ordem]
    scores = scores[ordem]

    # 32 raios equiangulares (Star-Convex 32 rays)
    n_rays = 32
    angulos = np.linspace(0, 2.0 * np.pi, n_rays, endpoint=False)
    cos_a = np.cos(angulos)
    sin_a = np.sin(angulos)
    max_raio_busca = int(np.clip(raio_est * 2.8, 10, 48))

    # NMS (Non-Maximum Suppression) baseado em sobreposição de círculos/polígonos estrelados
    aceitos_xyr: list[tuple[int, int, np.ndarray, float]] = []
    nms_thresh = 0.35

    for idx in range(len(ys)):
        cy, cx = int(ys[idx]), int(xs[idx])
        r0 = float(dist[cy, cx])

        # Verifica colisão NMS com candidatos de maior probabilidade já aceitos
        suprimido = False
        for ac_x, ac_y, ac_raios, ac_rmean in aceitos_xyr:
            d_centros = math.hypot(cx - ac_x, cy - ac_y)
            if d_centros < (r0 + ac_rmean) * (1.0 - nms_thresh):
                suprimido = True
                break
        if suprimido:
            continue

        # Marcha radial nos 32 raios para encontrar a borda estrelada do núcleo
        raios_k = np.zeros(n_rays, dtype=np.float32)
        int_centro = max(0.15, float(norm_int[cy, cx]))
        limiar_borda = int_centro * 0.42

        for k in range(n_rays):
            ca, sa = cos_a[k], sin_a[k]
            r_final = max(2.0, r0)
            for step in range(2, max_raio_busca + 1):
                ny = int(round(cy + sa * step))
                nx = int(round(cx + ca * step))
                if ny < 0 or ny >= H or nx < 0 or nx >= W:
                    r_final = float(step - 1)
                    break
                if mask_limpa[ny, nx] == 0 or norm_int[ny, nx] < limiar_borda:
                    r_final = float(step - 0.5)
                    break
                # Se a distância ao fundo começar a subir novamente (entrando em outro núcleo vizinho), para na sela!
                if step > r0 + 1.5 and dist[ny, nx] > dist[int(round(cy + sa * (step - 1))), int(round(cx + ca * (step - 1)))] + 0.4:
                    r_final = float(step - 1)
                    break
                r_final = float(step)
            raios_k[k] = r_final

        # Suavização circular dos 32 raios (garante regularidade convexa estrelada)
        raios_suaves = (
            0.22 * np.roll(raios_k, -1)
            + 0.56 * raios_k
            + 0.22 * np.roll(raios_k, 1)
        )
        aceitos_xyr.append((cx, cy, raios_suaves, float(raios_suaves.mean())))

    # Rasteriza os polígonos estrelados de 32 vértices em ordem reversa de score (maior score prevalece nas bordas)
    labels_star = np.zeros((H, W), dtype=np.int32)
    for idx_poly in range(len(aceitos_xyr) - 1, -1, -1):
        cx, cy, raios_s, _ = aceitos_xyr[idx_poly]
        pts_x = np.clip(np.round(cx + cos_a * raios_s), 0, W - 1).astype(np.int32)
        pts_y = np.clip(np.round(cy + sin_a * raios_s), 0, H - 1).astype(np.int32)
        pts = np.stack([pts_x, pts_y], axis=1).reshape((-1, 1, 2))
        cv2.fillPoly(labels_star, [pts], int(idx_poly + 1))

    # Restringe ao foreground real para não extravasar fundo escuro
    labels_star = labels_star * (mask_limpa > 0)
    n_cel, labels_filt = _filtrar_labels_morfologia(
        labels_star, area_minima, area_maxima, min_circularidade
    )
    return n_cel, labels_filt, {
        "area_minima": round(area_minima, 1),
        "min_distance": min_dist,
        "motor": "stardist_2d",
    }


def segmentar_nucleos_cellpose(
    canal_8u: np.ndarray,
    corrigido: np.ndarray,
    mask_base: np.ndarray,
    bias: int = 0,
    area_maxima: Optional[float] = None,
    min_circularidade: float = 0.0,
) -> tuple[int, np.ndarray, dict[str, Any]]:
    """
    Motor Cellpose 2D (Stringer et al., Nature Methods 2021):
    1. Se o pacote `cellpose` estiver instalado no Python, executa o modelo 'nuclei'.
    2. Caso contrário (ou no executável autônomo), executa o pipeline de Fluxo Vetorial de Gradiente
       do Cellpose: Equalização adaptativa CLAHE + Campo de Probabilidade Celular Local + Simulação
       de Difusão Térmica e Rastreamento de Atratrizes por Integração de Euler (Gradient Flow Tracking).
    """
    escala = estimar_escala_objeto(mask_base)
    raio_est = float(np.sqrt(escala / np.pi)) if (escala and escala > 0) else 7.5
    area_minima = max(float(RUIDO_AREA_MINIMA_PX), (escala or 40.0) * 0.12)
    min_dist = int(np.clip(raio_est * 0.55, 3, 22))

    # Tentativa 1: Pacote oficial Cellpose se instalado no Python do sistema
    try:
        from cellpose import models as cp_models  # type: ignore

        model = cp_models.CellposeModel(gpu=False, model_type="nuclei")
        cellprob_thr = float(np.clip(-bias * 0.12, -4.0, 4.0))
        masks_cp, _, _ = model.eval(
            canal_8u,
            diameter=max(8.0, raio_est * 2.0),
            channels=[0, 0],
            cellprob_threshold=cellprob_thr,
        )
        n_cel, labels_filt = _filtrar_labels_morfologia(
            masks_cp.astype(np.int32), area_minima, area_maxima, min_circularidade
        )
        return n_cel, labels_filt, {
            "area_minima": round(area_minima, 1),
            "min_distance": min_dist,
            "motor": "cellpose_pretrained",
        }
    except Exception:
        pass

    # Formulação Matemática Cellpose 2D (CLAHE + Campo Vetorial de Fluxo Espacial + Integração de Euler)
    H, W = canal_8u.shape[:2]
    clahe = cv2.createCLAHE(clipLimit=2.6, tileGridSize=(8, 8))
    realcado = clahe.apply(corrigido)

    # Combina limiar de Otsu global com limiar adaptativo local (sensível a células fracas em confluência)
    mask_otsu, limiar_otsu, _ = limiar_otsu_com_ajuste(realcado, bias=bias)
    bloco_adapt = max(15, int(round(raio_est * 4.0)) | 1)
    c_adapt = float(np.clip(-4.0 - bias * 0.25, -18.0, 8.0))
    mask_adapt = cv2.adaptiveThreshold(
        cv2.GaussianBlur(realcado, (5, 5), 0),
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        bloco_adapt,
        c_adapt,
    )
    mask_cp = cv2.bitwise_and(mask_adapt, cv2.dilate(mask_otsu, np.ones((5, 5), np.uint8)))
    mask_cp = limpar_mascara(mask_cp)

    dist = cv2.distanceTransform(mask_cp, cv2.DIST_L2, 5)
    if dist.max() <= 0:
        return 0, np.zeros((H, W), dtype=np.int32), {"area_minima": round(area_minima, 1), "min_distance": min_dist}

    # Potencial de difusão suave U(y, x) dentro da máscara celular (simula a difusão térmica do Cellpose)
    sigma_flow = max(1.2, min(4.5, raio_est * 0.42))
    potencial = cv2.GaussianBlur(dist * (0.6 + 0.4 * (realcado.astype(np.float32) / 255.0)), (0, 0), sigma_flow)

    # Campo Vetorial de Gradiente Espacial (mu_y, mu_x) apontando para os atratores (centros celulares)
    grad_y = cv2.Sobel(potencial, cv2.CV_32F, 0, 1, ksize=3)
    grad_x = cv2.Sobel(potencial, cv2.CV_32F, 1, 0, ksize=3)
    norma = np.sqrt(grad_y * grad_y + grad_x * grad_x) + 1e-5
    mu_y = grad_y / norma
    mu_x = grad_x / norma

    # Identifica os atratores (sinks) para onde os fluxos convergem
    k_sink = max(3, int(min_dist) * 2 + 1)
    kernel_s = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_sink, k_sink))
    dilated_u = cv2.dilate(potencial, kernel_s)
    sinks_mask = (potencial >= dilated_u - 1e-5) & (mask_cp > 0) & (dist >= 1.2)
    _, sink_markers = cv2.connectedComponents(sinks_mask.astype(np.uint8))
    if sink_markers.max() == 0:
        sink_markers, _ = ndi.label(sinks_mask)

    # Dilata ligeiramente as bacias de atração para captura rápida na integração de Euler
    sink_bacias = cv2.dilate(
        sink_markers.astype(np.uint16),
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
    ).astype(np.int32)

    # Integração de Euler vetorizada: cada pixel da máscara segue o fluxo (mu_y, mu_x) por N passos
    fg_y, fg_x = np.where(mask_cp > 0)
    py = fg_y.astype(np.float32)
    px = fg_x.astype(np.float32)
    passo = 1.15
    n_passos = max(12, min(28, int(raio_est * 2.2)))

    for _ in range(n_passos):
        iy = np.clip(np.round(py).astype(np.int32), 0, H - 1)
        ix = np.clip(np.round(px).astype(np.int32), 0, W - 1)
        py = np.clip(py + passo * mu_y[iy, ix], 0, H - 1)
        px = np.clip(px + passo * mu_x[iy, ix], 0, W - 1)

    final_y = np.clip(np.round(py).astype(np.int32), 0, H - 1)
    final_x = np.clip(np.round(px).astype(np.int32), 0, W - 1)
    atribuicoes = sink_bacias[final_y, final_x]

    labels_cp = np.zeros((H, W), dtype=np.int32)
    labels_cp[fg_y, fg_x] = atribuicoes

    # Pixels da borda que não alcançaram o sink no número de passos recebem propagação watershed residual
    faltantes = (mask_cp > 0) & (labels_cp == 0)
    if np.any(faltantes) and sink_markers.max() > 0:
        labels_ws = watershed(-potencial, sink_markers, mask=mask_cp)
        labels_cp[faltantes] = labels_ws[faltantes]

    n_cel, labels_filt = _filtrar_labels_morfologia(
        labels_cp, area_minima, area_maxima, min_circularidade
    )
    return n_cel, labels_filt, {
        "area_minima": round(area_minima, 1),
        "min_distance": min_dist,
        "motor": "cellpose_2d",
    }


def segmentar_canal(canal_rgb_uint8, parametros, auto=True):
    corrigido = corrigir_fundo(
        canal_rgb_uint8,
        parametros.get("kernel_tophat"),
        parametros.get("aplicar_bilateral", True),
    )
    bias = parametros.get("bias", 0)
    mask, limiar_usado, _ = limiar_otsu_com_ajuste(corrigido, bias)
    motor = (parametros.get("motor_segmentacao") or "watershed").lower().strip()

    if motor == "stardist":
        n_objetos, labels, params_usados = segmentar_nucleos_stardist(
            canal_rgb_uint8,
            corrigido,
            mask,
            bias=bias,
            area_maxima=parametros.get("area_maxima"),
            min_circularidade=parametros.get("min_circularidade", 0.0),
        )
        mask_final = ((labels > 0).astype(np.uint8)) * 255
        return n_objetos, labels, mask_final, limiar_usado, params_usados
    elif motor == "cellpose":
        n_objetos, labels, params_usados = segmentar_nucleos_cellpose(
            canal_rgb_uint8,
            corrigido,
            mask,
            bias=bias,
            area_maxima=parametros.get("area_maxima"),
            min_circularidade=parametros.get("min_circularidade", 0.0),
        )
        mask_final = ((labels > 0).astype(np.uint8)) * 255
        return n_objetos, labels, mask_final, limiar_usado, params_usados

    n_objetos, labels, params_usados = contar_objetos(
        mask,
        auto=auto,
        area_maxima=parametros.get("area_maxima"),
        min_circularidade=parametros.get("min_circularidade", 0.0),
    )
    params_usados["motor"] = "watershed"
    return n_objetos, labels, mask, limiar_usado, params_usados


def classificar_nucleos(
    labels_azul: np.ndarray,
    mask_verde: np.ndarray,
    mask_amarelo: np.ndarray,
    img_intensidade: Optional[np.ndarray] = None,
    raio_dilatacao: int = 4,
    min_pixels_regiao: int = 6,
) -> dict[str, Any]:
    """
    Classifica CADA núcleo segmentado em `labels_azul` sem descartar nenhum ID,
    garantindo que detectados == vivas + mortas + indeterminadas.
    """
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (raio_dilatacao * 2 + 1,) * 2)

    ids = [int(l) for l in np.unique(labels_azul) if l != 0]
    if not ids:
        vazio = np.zeros_like(labels_azul)
        return {
            "n_viaveis": 0,
            "n_mortas": 0,
            "n_indeterminadas": 0,
            "labels_viaveis": vazio,
            "labels_mortas": vazio,
            "labels_indeterminadas": vazio,
            "tabela_celulas": [],
        }

    n_viaveis = n_mortas = n_indeterminadas = 0
    labels_viaveis = np.zeros_like(labels_azul)
    labels_mortas = np.zeros_like(labels_azul)
    labels_indeterminadas = np.zeros_like(labels_azul)
    tabela_celulas = []

    slices = ndi.find_objects(labels_azul)
    H, W = labels_azul.shape
    pad = raio_dilatacao + 2

    mask_verde_bin = mask_verde > 127
    mask_amarela_bin = mask_amarelo > 127

    for label_id in ids:
        sl = slices[label_id - 1] if (label_id - 1 < len(slices)) else None
        if sl is None:
            continue

        ymin, ymax = sl[0].start, sl[0].stop
        xmin, xmax = sl[1].start, sl[1].stop

        y0 = max(0, ymin - pad)
        y1 = min(H, ymax + pad)
        x0 = max(0, xmin - pad)
        x1 = min(W, xmax + pad)

        sub_labels = labels_azul[y0:y1, x0:x1]
        mask_nucleo = sub_labels == label_id
        sub_obj = np.uint8(mask_nucleo) * 255
        area_nucleo = int(mask_nucleo.sum())
        sub_regiao = cv2.dilate(sub_obj, kernel) > 0
        area_regiao = int(sub_regiao.sum())

        if area_regiao < min_pixels_regiao or area_regiao == 0:
            # Nunca descarta núcleo: classifica como indeterminada para manter consistência exata
            classe = "indeterminada"
            n_indeterminadas += 1
            labels_indeterminadas[y0:y1, x0:x1][mask_nucleo] = label_id
            frac_verde = 0.0
            frac_amarela = 0.0
        else:
            sub_verde = mask_verde_bin[y0:y1, x0:x1]
            sub_amarelo = mask_amarela_bin[y0:y1, x0:x1]

            frac_verde = float(sub_verde[sub_regiao].mean())
            frac_amarela = float(sub_amarelo[sub_regiao].mean())
            pos_verde = frac_verde >= FRACAO_MINIMA_VERDE
            pos_amarelo = frac_amarela >= FRACAO_MINIMA_AMARELA

            if pos_amarelo:
                classe = "morta"
                n_mortas += 1
                labels_mortas[y0:y1, x0:x1][mask_nucleo] = label_id
            elif pos_verde:
                classe = "viavel"
                n_viaveis += 1
                labels_viaveis[y0:y1, x0:x1][mask_nucleo] = label_id
            else:
                classe = "indeterminada"
                n_indeterminadas += 1
                labels_indeterminadas[y0:y1, x0:x1][mask_nucleo] = label_id

        M = cv2.moments(sub_obj)
        if M["m00"] > 0:
            cx = int(round(x0 + M["m10"] / M["m00"]))
            cy = int(round(y0 + M["m01"] / M["m00"]))
        else:
            cx = (x0 + x1) // 2
            cy = (y0 + y1) // 2

        # Intensidade média para compatibilidade com ImageJ Results Table (Mean)
        if img_intensidade is not None:
            sub_int = img_intensidade[y0:y1, x0:x1]
            mean_val = round(float(sub_int[mask_nucleo].mean()), 2) if area_nucleo > 0 else 0.0
        else:
            mean_val = round(float((frac_verde + frac_amarela) * 127.5), 2)

        # Contorno simplificado para macro do Fiji (.ijm) e redesenho rápido após edição manual
        contornos, _ = cv2.findContours(sub_obj, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contorno_pts = []
        if contornos:
            c_maior = max(contornos, key=cv2.contourArea)
            eps = max(0.8, 0.02 * cv2.arcLength(c_maior, True))
            approx = cv2.approxPolyDP(c_maior, eps, True)
            contorno_pts = [[int(pt[0][0] + x0), int(pt[0][1] + y0)] for pt in approx[:20]]

        raio_eq = round(float(np.sqrt(max(1, area_nucleo) / np.pi)), 1)

        tabela_celulas.append({
            "celula_id": int(label_id),
            "area_px": area_nucleo if area_nucleo > 0 else area_regiao,
            "area_regiao_px": area_regiao,
            "centro_x": cx,
            "centro_y": cy,
            "raio_eq": raio_eq,
            "mean_intensity": mean_val,
            "cobertura_verde_pct": round(frac_verde * 100, 1),
            "cobertura_amarela_pct": round(frac_amarela * 100, 1),
            "classificacao": classe,
            "contorno_pts": contorno_pts,
        })

    return {
        "n_viaveis": n_viaveis,
        "n_mortas": n_mortas,
        "n_indeterminadas": n_indeterminadas,
        "labels_viaveis": labels_viaveis,
        "labels_mortas": labels_mortas,
        "labels_indeterminadas": labels_indeterminadas,
        "tabela_celulas": tabela_celulas,
    }


# =========================================================================
# LEGENDA EM IMAGEM EXPORTADA COM PIL/TRUETYPE (ACENTOS E IDIOMAS PT/EN/ES)
# =========================================================================

def _carregar_fonte_truetype(tamanho: int, negrito: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if mono:
        candidatos = [
            "consolab.ttf" if negrito else "consola.ttf",
            "C:\\Windows\\Fonts\\consolab.ttf" if negrito else "C:\\Windows\\Fonts\\consola.ttf",
            "DejaVuSansMono-Bold.ttf" if negrito else "DejaVuSansMono.ttf",
        ]
    elif negrito:
        candidatos = [
            "segoeuib.ttf",
            "arialbd.ttf",
            "calibrib.ttf",
            "C:\\Windows\\Fonts\\segoeuib.ttf",
            "C:\\Windows\\Fonts\\arialbd.ttf",
            "C:\\Windows\\Fonts\\calibrib.ttf",
            "DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
    else:
        candidatos = [
            "segoeui.ttf",
            "arial.ttf",
            "calibri.ttf",
            "C:\\Windows\\Fonts\\segoeui.ttf",
            "C:\\Windows\\Fonts\\arial.ttf",
            "C:\\Windows\\Fonts\\calibri.ttf",
            "DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]
    for c in candidatos:
        try:
            return ImageFont.truetype(c, tamanho)
        except Exception:
            continue
    return ImageFont.load_default()


def desenhar_legenda_exportacao_pil(
    img_bgr: np.ndarray,
    relatorio: dict[str, Any],
    idioma: str = "pt",
    um_por_pixel: Optional[float] = None,
    tamanho_barra_um: Optional[float] = None,
    mostrar_legenda: bool = True,
    paleta_daltonismo: bool = False,
    tema_fundo: str = "escuro",
) -> np.ndarray:
    """
    Renderiza barra de escala científica estilo Zeiss/ImageJ no canto inferior direito
    e, quando `mostrar_legenda=True`, adiciona uma barra de rodapé científica externa
    abaixo da imagem (nunca cobrindo as células nem cortando texto).
    """
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    H, W = img_rgb.shape[:2]
    pil_img = Image.fromarray(img_rgb).convert("RGBA")

    # 1. Barra de escala física (µm) refinada no canto inferior direito
    if um_por_pixel and um_por_pixel > 0:
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw_ov = ImageDraw.Draw(overlay)

        alvo_um = tamanho_barra_um if (tamanho_barra_um and tamanho_barra_um > 0) else 50.0
        largura_px = int(round(alvo_um / um_por_pixel))
        if largura_px > W * 0.32:
            alvo_um = 20.0
            largura_px = max(24, int(round(alvo_um / um_por_pixel)))
        largura_px = max(24, min(int(W * 0.38), largura_px))

        tam_fonte_escala = max(11, min(22, int(min(W, H) * 0.022)))
        fonte_escala = _carregar_fonte_truetype(tam_fonte_escala, negrito=True)

        txt_escala = f"{int(alvo_um) if alvo_um == int(alvo_um) else alvo_um} \u03bcm"
        tb = draw_ov.textbbox((0, 0), txt_escala, font=fonte_escala)
        tw = tb[2] - tb[0]
        th = tb[3] - tb[1]

        margem = max(14, int(min(W, H) * 0.025))
        espessura_barra = max(3, min(6, int(min(W, H) * 0.006)))
        tick_h = espessura_barra + 4

        bx1 = W - margem
        bx0 = bx1 - largura_px
        by1 = H - margem
        by0 = by1 - espessura_barra

        pad_x = 10
        pad_y = 7
        caixa_x0 = min(bx0, bx0 + (largura_px - tw) // 2) - pad_x
        caixa_x1 = max(bx1, bx0 + (largura_px + tw) // 2) + pad_x
        caixa_y0 = by0 - th - pad_y * 2
        caixa_y1 = by1 + pad_y

        draw_ov.rounded_rectangle(
            [caixa_x0, caixa_y0, caixa_x1, caixa_y1],
            radius=6,
            fill=(8, 13, 16, 175),
            outline=(255, 255, 255, 45),
            width=1,
        )
        # Barra horizontal com terminadores verticais sutis (estilo retículo micrométrico)
        draw_ov.rectangle([bx0, by0, bx1, by1], fill=(255, 255, 255, 245))
        draw_ov.rectangle([bx0, by0 - 2, bx0 + 2, by1 + 2], fill=(255, 255, 255, 245))
        draw_ov.rectangle([bx1 - 2, by0 - 2, bx1, by1 + 2], fill=(255, 255, 255, 245))

        draw_ov.text(
            (bx0 + (largura_px - tw) // 2, by0 - th - pad_y - 1),
            txt_escala,
            font=fonte_escala,
            fill=(248, 250, 252, 255),
        )
        pil_img = Image.alpha_composite(pil_img, overlay)

    img_base_rgb = pil_img.convert("RGB")
    if not mostrar_legenda:
        return cv2.cvtColor(np.array(img_base_rgb), cv2.COLOR_RGB2BGR)

    # 2. Barra de Rodapé Científica Externa (zero oclusão de células, tipografia limpa e sem cortes)
    detectados = int(relatorio.get("Detectados", relatorio.get("Total (Azul)", 0)))
    vivas = int(relatorio.get("Viáveis (Verde)", 0))
    mortas = int(relatorio.get("Mortas (Amarelo)", 0))
    indet = int(relatorio.get("Indeterminadas", max(0, detectados - vivas - mortas)))
    pct_viv = float(relatorio.get("Pct Viáveis (%)", (vivas / detectados * 100.0) if detectados > 0 else 0.0))
    pct_mor = float(relatorio.get("Pct Mortas (%)", (mortas / detectados * 100.0) if detectados > 0 else 0.0))
    pct_ind = float(relatorio.get("Pct Indeterminadas (%)", (indet / detectados * 100.0) if detectados > 0 else 0.0))
    viab = float(relatorio.get("Viabilidade (%)", 0.0))
    ic_lo = float(relatorio.get("IC 95% Baixo", 0.0))
    ic_hi = float(relatorio.get("IC 95% Alto", 0.0))
    base_calc = int(relatorio.get("Base de Cálculo", vivas + mortas))

    viab_fmt = formatar_viabilidade_padrao(viab, ic_lo, ic_hi, idioma, base_calc)
    det_fmt = formatar_inteiro_locale(detectados, idioma)
    viv_fmt = f"{formatar_inteiro_locale(vivas, idioma)} ({formatar_decimal_locale(pct_viv, idioma, 1)}%)"
    mor_fmt = f"{formatar_inteiro_locale(mortas, idioma)} ({formatar_decimal_locale(pct_mor, idioma, 1)}%)"
    ind_fmt = f"{formatar_inteiro_locale(indet, idioma)} ({formatar_decimal_locale(pct_ind, idioma, 1)}%)"

    eh_claro = tema_fundo == "claro"
    bg_footer = (248, 250, 252) if eh_claro else (11, 18, 21)
    borda_topo = (203, 213, 225) if eh_claro else (30, 45, 52)
    txt_primario = (15, 23, 42) if eh_claro else (238, 244, 248)
    txt_secundario = (100, 116, 139) if eh_claro else (142, 163, 176)

    cor_azul = (37, 99, 235) if eh_claro else (96, 165, 250)
    cor_verde = ((0, 150, 130) if eh_claro else (0, 230, 180)) if paleta_daltonismo else ((22, 163, 74) if eh_claro else (52, 211, 153))
    cor_amarela = ((210, 50, 100) if eh_claro else (255, 90, 140)) if paleta_daltonismo else ((217, 119, 6) if eh_claro else (251, 191, 36))
    cor_indet = (100, 116, 139) if eh_claro else (148, 163, 184)

    if idioma == "en":
        metricas = [
            ("Detected:", det_fmt, cor_azul),
            ("Live:", viv_fmt, cor_verde),
            ("Dead:", mor_fmt, cor_amarela),
            ("Undet.:", ind_fmt, cor_indet),
        ]
        lbl_viab = f"Viability: {viab_fmt}"
    elif idioma == "es":
        metricas = [
            ("Detectados:", det_fmt, cor_azul),
            ("Vivas:", viv_fmt, cor_verde),
            ("Muertas:", mor_fmt, cor_amarela),
            ("Indet.:", ind_fmt, cor_indet),
        ]
        lbl_viab = f"Viabilidad: {viab_fmt}"
    else:
        metricas = [
            ("Detectados:", det_fmt, cor_azul),
            ("Vivas:", viv_fmt, cor_verde),
            ("Mortas:", mor_fmt, cor_amarela),
            ("Indet.:", ind_fmt, cor_indet),
        ]
        lbl_viab = f"Viabilidade: {viab_fmt}"

    # Escala tipográfica adaptativa à largura da imagem (garante zero corte em qualquer resolução)
    tam_base = max(11, min(20, int(W * 0.016)))
    f_regular = _carregar_fonte_truetype(tam_base, negrito=False)
    f_bold = _carregar_fonte_truetype(tam_base, negrito=True)
    f_meta = _carregar_fonte_truetype(max(10, tam_base - 2), negrito=False, mono=True)

    pad_x = max(14, int(W * 0.02))
    pad_y = max(10, int(tam_base * 0.75))
    gap_linhas = max(6, int(tam_base * 0.45))

    # Calcula altura do rodapé (2 linhas organizadas: Linha 1 = Métricas + Viabilidade; Linha 2 = Arquivo + Versão)
    # Se a imagem for estreita (< 620px), divide métricas e viabilidade em linhas separadas para nunca cortar
    empilhar_viab = W < 680
    n_linhas_rodape = 3 if empilhar_viab else 2
    altura_linha = int(tam_base * 1.45)
    footer_h = pad_y * 2 + n_linhas_rodape * altura_linha + (n_linhas_rodape - 1) * gap_linhas

    canvas = Image.new("RGB", (W, H + footer_h), bg_footer)
    canvas.paste(img_base_rgb, (0, 0))
    draw = ImageDraw.Draw(canvas)

    # Linha divisória sutil entre a imagem de microscopia e o rodapé científico
    draw.line([(0, H), (W, H)], fill=borda_topo, width=2)

    y_cursor = H + pad_y
    x_cursor = pad_x
    r_dot = max(3, tam_base // 4)

    # Desenha os itens de contagem com ponto colorido alinhado ao centro vertical da linha
    for rotulo, valor, cor_item in metricas:
        cy_dot = y_cursor + altura_linha // 2
        draw.ellipse(
            [x_cursor, cy_dot - r_dot, x_cursor + r_dot * 2, cy_dot + r_dot],
            fill=cor_item,
        )
        x_cursor += r_dot * 2 + 6

        draw.text((x_cursor, y_cursor), rotulo, font=f_regular, fill=txt_secundario)
        bb_rot = draw.textbbox((0, 0), rotulo, font=f_regular)
        x_cursor += (bb_rot[2] - bb_rot[0]) + 4

        draw.text((x_cursor, y_cursor), valor, font=f_bold, fill=txt_primario)
        bb_val = draw.textbbox((0, 0), valor, font=f_bold)
        x_cursor += (bb_val[2] - bb_val[0]) + max(14, int(W * 0.022))

    # Pill destacado de Viabilidade (IC 95% de Wilson)
    bb_viab = draw.textbbox((0, 0), lbl_viab, font=f_bold)
    vw = bb_viab[2] - bb_viab[0]
    vh = bb_viab[3] - bb_viab[1]
    pill_pad_x = 10
    pill_pad_y = 4

    if empilhar_viab:
        y_cursor += altura_linha + gap_linhas
        vx0 = pad_x
    else:
        vx0 = max(x_cursor, W - pad_x - vw - pill_pad_x * 2)

    vy0 = y_cursor - 1
    vx1 = min(W - pad_x, vx0 + vw + pill_pad_x * 2)
    vy1 = vy0 + altura_linha + 2

    cor_pill_bg = (220, 252, 231) if eh_claro else (14, 38, 31)
    cor_pill_borda = (22, 163, 74) if eh_claro else (45, 160, 115)
    cor_pill_txt = (21, 128, 61) if eh_claro else (75, 240, 160)

    draw.rounded_rectangle(
        [vx0, vy0, vx1, vy1],
        radius=6,
        fill=cor_pill_bg,
        outline=cor_pill_borda,
        width=1,
    )
    draw.text(
        (vx0 + pill_pad_x, y_cursor),
        lbl_viab,
        font=f_bold,
        fill=cor_pill_txt,
    )

    # Linha final de metadados (Nome da Amostra à esquerda, CytoCount versão + Motor à direita)
    y_meta = y_cursor + altura_linha + gap_linhas
    nome_arq = str(relatorio.get("Arquivo", "Amostra"))
    roi_info = relatorio.get("ROI", "Imagem Completa")
    motor_info = relatorio.get("Motor de Segmentação", "Watershed Clássico")
    txt_esq = f"{nome_arq}" + (f"  [ROI: {roi_info}]" if roi_info and roi_info != "Imagem Completa" else "")
    txt_dir = f"CytoCount v{APP_VERSION} · {motor_info}"

    draw.text((pad_x, y_meta), txt_esq, font=f_meta, fill=txt_secundario)
    bb_dir = draw.textbbox((0, 0), txt_dir, font=f_meta)
    w_dir = bb_dir[2] - bb_dir[0]
    if W - pad_x - w_dir > pad_x + 180:
        draw.text((W - pad_x - w_dir, y_meta), txt_dir, font=f_meta, fill=txt_secundario)

    return cv2.cvtColor(np.array(canvas), cv2.COLOR_RGB2BGR)


# =========================================================================
# PIPELINE PRINCIPAL DE PROCESSAMENTO
# =========================================================================

def processar_canais_em_memoria(
    original_rgb: np.ndarray,
    r_float: np.ndarray,
    g_float: np.ndarray,
    b_float: np.ndarray,
    nome_arquivo: str,
    parametros: dict[str, Any],
) -> tuple[Optional[dict], Optional[np.ndarray], Optional[np.ndarray], Optional[np.ndarray], Optional[dict], Optional[str]]:
    """
    Executa a segmentação e classificação a partir dos canais (8-bit ou 16-bit),
    retornando:
      - relatorio (fonte única da verdade com IC 95% de Wilson)
      - saida_rgb_tela (SEM texto sobreposto, apenas contornos limpos)
      - saida_bgr_salvar (COM legenda discreta renderizada via PIL TrueType)
      - original_rgb (recortada na ROI quando ativa)
      - mascaras (incluindo tabela_celulas detalhada)
      - erro
    """
    roi = parametros.get("roi")
    roi_aplicado = None
    if roi and isinstance(roi, dict):
        try:
            rx = int(round(float(roi.get("x", 0))))
            ry = int(round(float(roi.get("y", 0))))
            rw = int(round(float(roi.get("w", 0))))
            rh = int(round(float(roi.get("h", 0))))
            H, W = original_rgb.shape[:2]
            rx = max(0, min(W - 2, rx))
            ry = max(0, min(H - 2, ry))
            rw = max(10, min(W - rx, rw))
            rh = max(10, min(H - ry, rh))
            if rw >= 10 and rh >= 10:
                original_rgb = original_rgb[ry : ry + rh, rx : rx + rw]
                r_float = r_float[ry : ry + rh, rx : rx + rw]
                g_float = g_float[ry : ry + rh, rx : rx + rw]
                b_float = b_float[ry : ry + rh, rx : rx + rw]
                roi_aplicado = {"x": rx, "y": ry, "w": rw, "h": rh}
        except Exception as e:
            print(f"[warning] Falha ao recortar ROI: {e}")

    img_bgr = cv2.cvtColor(original_rgb, cv2.COLOR_RGB2BGR)

    kernel_tophat = parametros.get("kernel_tophat")
    aplicar_bilateral = parametros.get("aplicar_bilateral", True)

    canal_azul = normalizar_robusto(b_float)
    motor_seg = parametros.get("motor_segmentacao", "watershed")
    param_azul_especifico = {
        "kernel_tophat": kernel_tophat,
        "aplicar_bilateral": aplicar_bilateral,
        "bias": parametros.get("bias_azul", 0),
        "min_circularidade": parametros.get("min_circularidade", 0.15),
        "area_maxima": parametros.get("area_maxima"),
        "motor_segmentacao": motor_seg,
    }
    n_azul, lab_azul, mask_azul, thr_azul, p_azul = segmentar_canal(canal_azul, param_azul_especifico)

    canal_verde = normalizar_robusto(g_float)
    corrigido_verde = corrigir_fundo(canal_verde, kernel_tophat, aplicar_bilateral)
    mask_verde, thr_verde, _ = limiar_otsu_com_ajuste(corrigido_verde, parametros.get("bias_verde", 0))
    mask_verde = limpar_mascara(mask_verde)

    # Se r_float já foi fornecido como canal separado de PI/Mortas (modo merge), usa diretamente;
    # caso contrário, calcula amarelicidade clássica de imagens RGB
    if parametros.get("canais_separados_puros"):
        canal_amarelo = normalizar_robusto(r_float)
    else:
        r_8 = normalizar_robusto(r_float).astype(np.float32)
        g_8 = canal_verde.astype(np.float32)
        b_8 = canal_azul.astype(np.float32)
        excesso_verde = np.clip(g_8 - r_8, 0, 255)
        amarelicidade = np.clip(((r_8 + g_8) / 2.0) - b_8 - excesso_verde * 0.5, 0, 255)
        canal_amarelo = normalizar_robusto(amarelicidade)

    corrigido_amarelo = corrigir_fundo(canal_amarelo, kernel_tophat, aplicar_bilateral)
    mask_amarelo, thr_amarelo, _ = limiar_otsu_com_ajuste(corrigido_amarelo, parametros.get("bias_amarelo", 0))
    mask_amarelo = limpar_mascara(mask_amarelo)

    raio_dilatacao = max(2, int(round(np.sqrt(p_azul.get("area_minima", 15) / np.pi) * 0.8)))
    img_gray = cv2.cvtColor(original_rgb, cv2.COLOR_RGB2GRAY)
    classificacao = classificar_nucleos(
        lab_azul,
        mask_verde.astype(np.float32),
        mask_amarelo.astype(np.float32),
        img_intensidade=img_gray,
        raio_dilatacao=raio_dilatacao,
    )

    tabela_celulas = classificacao["tabela_celulas"]
    eh_jpeg = (nome_arquivo or "").lower().endswith((".jpg", ".jpeg"))
    formula = parametros.get("formula_viabilidade", "Padrão Biológico (Vivas / (Vivas + Mortas))")
    idioma = parametros.get("idioma", "pt")

    relatorio = calcular_estatisticas_unificadas(
        tabela_celulas=tabela_celulas,
        formula_viabilidade=formula,
        nome_arquivo=nome_arquivo,
        roi_aplicado=roi_aplicado,
        eh_jpeg=eh_jpeg,
        manual_edits=[],
        motor_segmentacao=motor_seg,
    )

    # Imagem para visualização em tela: APENAS contornos limpos (sem cv2.putText sobreposto!)
    saida_limpa_bgr = img_bgr.copy()
    saida_limpa_bgr = desenhar_contornos(saida_limpa_bgr, lab_azul, (255, 0, 0))
    saida_limpa_bgr = desenhar_contornos(saida_limpa_bgr, classificacao["labels_viaveis"], (0, 255, 0))
    saida_limpa_bgr = desenhar_contornos(saida_limpa_bgr, classificacao["labels_mortas"], (0, 255, 255))
    saida_rgb_tela = cv2.cvtColor(saida_limpa_bgr, cv2.COLOR_BGR2RGB)

    # Imagem para exportação/salvamento: inclui legenda discreta com PIL TrueType no idioma selecionado
    saida_bgr_salvar = desenhar_legenda_exportacao_pil(
        saida_limpa_bgr,
        relatorio,
        idioma=idioma,
        um_por_pixel=parametros.get("um_por_pixel"),
    )

    mascaras = {
        "azul": mask_azul,
        "verde": mask_verde,
        "amarelo": mask_amarelo,
        "limiares": {"azul": thr_azul, "verde": thr_verde, "amarelo": thr_amarelo},
        "params_auto": {"azul": p_azul, "raio_dilatacao_classificacao": raio_dilatacao},
        "tabela_celulas": tabela_celulas,
        "eh_jpeg": eh_jpeg,
    }

    return relatorio, saida_rgb_tela, saida_bgr_salvar, original_rgb, mascaras, None


def processar_imagem_na_memoria(file_bytes: bytes, nome_arquivo: str, parametros: dict[str, Any]):
    TAMANHO_MINIMO_BYTES = 100
    if not file_bytes or len(file_bytes) < TAMANHO_MINIMO_BYTES:
        return None, None, None, None, None, "Arquivo vazio ou corrompido."

    try:
        original_rgb, (r_f, g_f, b_f) = ler_imagem_flexivel(file_bytes, nome_arquivo)
    except Exception as e:
        return None, None, None, None, None, f"Não foi possível ler a imagem ({e})."

    return processar_canais_em_memoria(original_rgb, r_f, g_f, b_f, nome_arquivo, parametros)


# =========================================================================
# EXPORTAÇÃO DE FIGURA PARA PUBLICAÇÃO (300 / 600 DPI, PNG, TIFF, PDF, SVG)
# =========================================================================

def gerar_figura_publicacao(
    original_rgb: np.ndarray,
    tabela_celulas: list[dict[str, Any]],
    relatorio: dict[str, Any],
    formato: str = "png",
    dpi: int = 300,
    idioma: str = "pt",
    mostrar_contornos: bool = True,
    mostrar_legenda: bool = True,
    tema_fundo: str = "escuro",
    paleta_daltonismo: bool = False,
    lado_a_lado: bool = False,
    um_por_pixel: Optional[float] = None,
    tamanho_barra_um: Optional[float] = 50.0,
) -> tuple[bytes, str]:
    """
    Gera figura científica pronta para publicação com DPI embutido (300 ou 600 DPI),
    barra de escala em micrômetros, paleta opcional para daltonismo, rodapé científico
    externo (sem cobrir células) e opção de painel lado a lado.
    Retorna (bytes_arquivo, mime_type).
    """
    dpi_val = 600 if int(dpi) >= 600 else 300
    orig_bgr = cv2.cvtColor(original_rgb, cv2.COLOR_RGB2BGR)

    if mostrar_contornos:
        proc_bgr = desenhar_celulas_de_tabela(orig_bgr, tabela_celulas, paleta_daltonismo=paleta_daltonismo)
    else:
        proc_bgr = orig_bgr.copy()

    if lado_a_lado:
        # Primeiro aplica apenas a barra de escala na imagem processada
        proc_escala_bgr = desenhar_legenda_exportacao_pil(
            proc_bgr,
            relatorio,
            idioma=idioma,
            um_por_pixel=um_por_pixel,
            tamanho_barra_um=tamanho_barra_um,
            mostrar_legenda=False,
            paleta_daltonismo=paleta_daltonismo,
            tema_fundo=tema_fundo,
        )
        H, W = orig_bgr.shape[:2]
        sep_w = max(8, W // 80)
        cor_fundo = (248, 250, 252) if tema_fundo == "claro" else (11, 18, 21)
        cor_texto = (15, 23, 42) if tema_fundo == "claro" else (230, 237, 243)
        topo_h = max(36, H // 18)

        painel = np.full((H + topo_h, W * 2 + sep_w, 3), cor_fundo, dtype=np.uint8)
        painel[topo_h : topo_h + H, 0:W] = orig_bgr
        painel[topo_h : topo_h + H, W + sep_w : W * 2 + sep_w] = proc_escala_bgr

        pil_painel = Image.fromarray(cv2.cvtColor(painel, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_painel)
        fonte_lbl = _carregar_fonte_truetype(max(14, topo_h // 2), negrito=True)
        lbl_orig = "A · Original"
        lbl_proc = (
            "B · Processed"
            if idioma == "en"
            else ("B · Procesada" if idioma == "es" else "B · Processada")
        )
        draw.text((16, (topo_h - 18) // 2), lbl_orig, font=fonte_lbl, fill=cor_texto)
        draw.text((W + sep_w + 16, (topo_h - 18) // 2), lbl_proc, font=fonte_lbl, fill=cor_texto)

        painel_bgr = cv2.cvtColor(np.array(pil_painel), cv2.COLOR_RGB2BGR)
        if mostrar_legenda:
            painel_bgr = desenhar_legenda_exportacao_pil(
                painel_bgr,
                relatorio,
                idioma=idioma,
                um_por_pixel=None,
                mostrar_legenda=True,
                paleta_daltonismo=paleta_daltonismo,
                tema_fundo=tema_fundo,
            )
        pil_final = Image.fromarray(cv2.cvtColor(painel_bgr, cv2.COLOR_BGR2RGB))
    else:
        proc_com_legenda_bgr = desenhar_legenda_exportacao_pil(
            proc_bgr,
            relatorio,
            idioma=idioma,
            um_por_pixel=um_por_pixel,
            tamanho_barra_um=tamanho_barra_um,
            mostrar_legenda=mostrar_legenda,
            paleta_daltonismo=paleta_daltonismo,
            tema_fundo=tema_fundo,
        )
        pil_final = Image.fromarray(cv2.cvtColor(proc_com_legenda_bgr, cv2.COLOR_BGR2RGB))

    fmt = formato.lower().strip(".")
    out_buf = io.BytesIO()

    if fmt in ("tif", "tiff"):
        pil_final.save(out_buf, format="TIFF", dpi=(dpi_val, dpi_val), compression="tiff_deflate")
        return out_buf.getvalue(), "image/tiff"
    elif fmt == "pdf":
        pil_final.save(out_buf, format="PDF", resolution=float(dpi_val))
        return out_buf.getvalue(), "application/pdf"
    elif fmt == "svg":
        # Embute imagem base64 + contornos vetoriais escaláveis em SVG
        png_buf = io.BytesIO()
        pil_final.save(png_buf, format="PNG", dpi=(dpi_val, dpi_val))
        b64_img = base64.b64encode(png_buf.getvalue()).decode("ascii")
        fw, fh = pil_final.size
        svg_str = (
            f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fw} {fh}" width="{fw}" height="{fh}">\n'
            f'  <metadata>CytoCount v{APP_VERSION} - {dpi_val} DPI</metadata>\n'
            f'  <image href="data:image/png;base64,{b64_img}" width="{fw}" height="{fh}" />\n'
            f'</svg>\n'
        )
        return svg_str.encode("utf-8"), "image/svg+xml"
    else:
        pil_final.save(out_buf, format="PNG", dpi=(dpi_val, dpi_val))
        return out_buf.getvalue(), "image/png"


# =========================================================================
# AMOSTRA DE EXEMPLO (EMBUTIDA NO PACOTE COM FALLBACK DETERMINÍSTICO)
# =========================================================================

def resolver_caminho_recurso(rel_path: str) -> str:
    """Resolve caminho de recurso tanto em modo dev quanto no executável PyInstaller (_MEIPASS)."""
    base_dir = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, rel_path)


def gerar_amostra_exemplo() -> bytes:
    """
    Carrega a imagem de exemplo embutida em `assets/exemplo_fluorescencia.png`.
    Se não existir no disco ainda, gera e salva para uso imediato.
    """
    caminho_asset = resolver_caminho_recurso(os.path.join("assets", "exemplo_fluorescencia.png"))
    if os.path.exists(caminho_asset):
        try:
            with open(caminho_asset, "rb") as f:
                dados = f.read()
            if len(dados) > 500:
                return dados
        except Exception:
            pass

    H, W = 1024, 1024
    img = np.zeros((H, W, 3), dtype=np.uint8)

    rng = np.random.RandomState(42)
    n_celulas = 85
    centros_x = rng.randint(60, W - 60, size=n_celulas)
    centros_y = rng.randint(60, H - 60, size=n_celulas)

    ruido_fundo = rng.normal(12, 4, (H, W, 3)).clip(0, 30).astype(np.uint8)
    img = cv2.add(img, ruido_fundo)

    for i in range(n_celulas):
        cx, cy = int(centros_x[i]), int(centros_y[i])
        raio = int(rng.randint(9, 17))

        cv2.circle(img, (cx, cy), raio, (int(rng.randint(200, 255)), 15, 10), -1)
        cv2.circle(img, (cx, cy), raio + 3, (80, 10, 5), 2)

        sorteio = rng.rand()
        if sorteio < 0.73:
            cv2.circle(img, (cx, cy), raio + int(rng.randint(4, 9)), (20, int(rng.randint(180, 240)), 15), -1)
            cv2.circle(img, (cx, cy), raio - 2, (220, 30, 20), -1)
        elif sorteio < 0.93:
            cor_morta = (10, int(rng.randint(200, 235)), int(rng.randint(230, 255)))
            cv2.circle(img, (cx, cy), raio + int(rng.randint(4, 8)), cor_morta, -1)
            cv2.circle(img, (cx, cy), max(4, raio - 3), (225, 35, 35), -1)

    img = cv2.GaussianBlur(img, (5, 5), 1.2)
    ok, buf = cv2.imencode(".png", img)
    png_bytes = buf.tobytes() if ok else b""

    try:
        os.makedirs(os.path.dirname(caminho_asset), exist_ok=True)
        with open(caminho_asset, "wb") as f:
            f.write(png_bytes)
    except Exception:
        pass

    return png_bytes
