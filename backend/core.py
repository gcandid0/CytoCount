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


def segmentar_canal(canal_rgb_uint8, parametros, auto=True):
    corrigido = corrigir_fundo(
        canal_rgb_uint8,
        parametros.get("kernel_tophat"),
        parametros.get("aplicar_bilateral", True),
    )
    mask, limiar_usado, _ = limiar_otsu_com_ajuste(corrigido, parametros.get("bias", 0))
    n_objetos, labels, params_usados = contar_objetos(
        mask,
        auto=auto,
        area_maxima=parametros.get("area_maxima"),
        min_circularidade=parametros.get("min_circularidade", 0.0),
    )
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

def _carregar_fonte_truetype(tamanho: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidatos = [
        "segoeui.ttf",
        "arial.ttf",
        "calibri.ttf",
        "DejaVuSans.ttf",
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\consola.ttf",
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
) -> np.ndarray:
    """
    Desenha legenda discreta com fundo semitransparente e suporte completo a Unicode/acentos
    (usando PIL + TrueType) APENAS para a imagem exportada (nunca na tela interativa).
    """
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    H, W = img_rgb.shape[:2]
    pil_img = Image.fromarray(img_rgb).convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    escala_fonte = max(12, min(28, int(min(W, H) * 0.022)))
    fonte_titulo = _carregar_fonte_truetype(escala_fonte + 2)
    fonte_item = _carregar_fonte_truetype(escala_fonte)
    fonte_rodape = _carregar_fonte_truetype(max(10, escala_fonte - 3))

    detectados = int(relatorio.get("Detectados", relatorio.get("Total (Azul)", 0)))
    vivas = int(relatorio.get("Viáveis (Verde)", 0))
    mortas = int(relatorio.get("Mortas (Amarelo)", 0))
    indet = int(relatorio.get("Indeterminadas", max(0, detectados - vivas - mortas)))
    viab = float(relatorio.get("Viabilidade (%)", 0.0))
    ic_lo = float(relatorio.get("IC 95% Baixo", 0.0))
    ic_hi = float(relatorio.get("IC 95% Alto", 0.0))

    base_calc = int(relatorio.get("Base de Cálculo", vivas + mortas))
    viab_fmt = formatar_viabilidade_padrao(viab, ic_lo, ic_hi, idioma, base_calc)
    det_fmt = formatar_inteiro_locale(detectados, idioma)
    viv_fmt = formatar_inteiro_locale(vivas, idioma)
    mor_fmt = formatar_inteiro_locale(mortas, idioma)
    ind_fmt = formatar_inteiro_locale(indet, idioma)

    if idioma == "en":
        linhas = [
            (f"Detected: {det_fmt}", (96, 165, 250, 255)),
            (f"Viable: {viv_fmt}", (52, 211, 153, 255) if not paleta_daltonismo else (0, 230, 180, 255)),
            (f"Dead: {mor_fmt}", (251, 191, 36, 255) if not paleta_daltonismo else (255, 90, 140, 255)),
            (f"Undetermined: {ind_fmt}", (156, 163, 175, 255)),
            (f"Viability: {viab_fmt}", (240, 253, 244, 255)),
        ]
    elif idioma == "es":
        linhas = [
            (f"Detectados: {det_fmt}", (96, 165, 250, 255)),
            (f"Viables: {viv_fmt}", (52, 211, 153, 255) if not paleta_daltonismo else (0, 230, 180, 255)),
            (f"Muertas: {mor_fmt}", (251, 191, 36, 255) if not paleta_daltonismo else (255, 90, 140, 255)),
            (f"Indeterminadas: {ind_fmt}", (156, 163, 175, 255)),
            (f"Viabilidad: {viab_fmt}", (240, 253, 244, 255)),
        ]
    else:
        linhas = [
            (f"Detectados: {det_fmt}", (96, 165, 250, 255)),
            (f"Viáveis: {viv_fmt}", (52, 211, 153, 255) if not paleta_daltonismo else (0, 230, 180, 255)),
            (f"Mortas: {mor_fmt}", (251, 191, 36, 255) if not paleta_daltonismo else (255, 90, 140, 255)),
            (f"Indeterminadas: {ind_fmt}", (156, 163, 175, 255)),
            (f"Viabilidade: {viab_fmt}", (240, 253, 244, 255)),
        ]

    if mostrar_legenda:
        pad = max(10, int(escala_fonte * 0.65))
        espaco_linha = int(escala_fonte * 1.45)
        largura_max = 0
        rodape_txt = f"CytoCount v{APP_VERSION} · {relatorio.get('Arquivo', '')}"
        for txt, _ in linhas:
            bbox = draw.textbbox((0, 0), txt, font=fonte_item)
            largura_max = max(largura_max, bbox[2] - bbox[0])
        bbox_rod = draw.textbbox((0, 0), rodape_txt, font=fonte_rodape)
        largura_max = max(largura_max, bbox_rod[2] - bbox_rod[0])

        box_w = largura_max + pad * 2 + 16
        box_h = len(linhas) * espaco_linha + int(escala_fonte * 1.3) + pad * 2
        x0, y0 = 16, 16

        draw.rounded_rectangle(
            [x0, y0, x0 + box_w, y0 + box_h],
            radius=8,
            fill=(11, 18, 21, 205),
            outline=(52, 211, 153, 110),
            width=1,
        )

        cy = y0 + pad
        for txt, cor_rgba in linhas:
            # Pequeno marcador colorido
            r_dot = max(3, escala_fonte // 4)
            draw.ellipse(
                [x0 + pad, cy + escala_fonte // 2 - r_dot + 2, x0 + pad + r_dot * 2, cy + escala_fonte // 2 + r_dot + 2],
                fill=cor_rgba,
            )
            draw.text(
                (x0 + pad + r_dot * 2 + 8, cy),
                txt,
                font=fonte_titulo if "Viab" in txt else fonte_item,
                fill=(240, 246, 252, 255),
            )
            cy += espaco_linha

        draw.text(
            (x0 + pad, cy + 2),
            rodape_txt,
            font=fonte_rodape,
            fill=(148, 163, 184, 220),
        )

    # Barra de escala física (µm) se informada calibração
    if um_por_pixel and um_por_pixel > 0:
        alvo_um = tamanho_barra_um if (tamanho_barra_um and tamanho_barra_um > 0) else 50.0
        largura_px = int(round(alvo_um / um_por_pixel))
        # Ajusta automaticamente se a barra ficar maior que 35% da largura da imagem
        if largura_px > W * 0.35:
            alvo_um = 20.0
            largura_px = max(20, int(round(alvo_um / um_por_pixel)))
        largura_px = max(20, min(int(W * 0.45), largura_px))

        bx1 = W - 24
        bx0 = bx1 - largura_px
        by1 = H - 24
        by0 = by1 - max(5, escala_fonte // 3)

        txt_escala = f"{int(alvo_um) if alvo_um == int(alvo_um) else alvo_um} \u03bcm"
        tb = draw.textbbox((0, 0), txt_escala, font=fonte_item)
        tw = tb[2] - tb[0]
        th = tb[3] - tb[1]

        draw.rounded_rectangle(
            [bx0 - 12, by0 - th - 14, bx1 + 12, by1 + 10],
            radius=6,
            fill=(11, 18, 21, 200),
        )
        draw.rectangle([bx0, by0, bx1, by1], fill=(255, 255, 255, 255))
        draw.text(
            (bx0 + (largura_px - tw) // 2, by0 - th - 8),
            txt_escala,
            font=fonte_item,
            fill=(255, 255, 255, 255),
        )

    combinada = Image.alpha_composite(pil_img, overlay).convert("RGB")
    return cv2.cvtColor(np.array(combinada), cv2.COLOR_RGB2BGR)


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
    param_azul_especifico = {
        "kernel_tophat": kernel_tophat,
        "aplicar_bilateral": aplicar_bilateral,
        "bias": parametros.get("bias_azul", 0),
        "min_circularidade": parametros.get("min_circularidade", 0.15),
        "area_maxima": parametros.get("area_maxima"),
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
    tema_fundo: str = "escuro",
    paleta_daltonismo: bool = False,
    lado_a_lado: bool = False,
    um_por_pixel: Optional[float] = None,
    tamanho_barra_um: Optional[float] = 50.0,
) -> tuple[bytes, str]:
    """
    Gera figura científica pronta para publicação com DPI embutido (300 ou 600 DPI),
    barra de escala em micrômetros, paleta opcional para daltonismo e painel lado a lado.
    Retorna (bytes_arquivo, mime_type).
    """
    dpi_val = 600 if int(dpi) >= 600 else 300
    orig_bgr = cv2.cvtColor(original_rgb, cv2.COLOR_RGB2BGR)

    if mostrar_contornos:
        proc_bgr = desenhar_celulas_de_tabela(orig_bgr, tabela_celulas, paleta_daltonismo=paleta_daltonismo)
    else:
        proc_bgr = orig_bgr.copy()

    proc_com_legenda_bgr = desenhar_legenda_exportacao_pil(
        proc_bgr,
        relatorio,
        idioma=idioma,
        um_por_pixel=um_por_pixel,
        tamanho_barra_um=tamanho_barra_um,
        mostrar_legenda=True,
        paleta_daltonismo=paleta_daltonismo,
    )

    if lado_a_lado:
        H, W = orig_bgr.shape[:2]
        sep_w = max(8, W // 80)
        cor_fundo = (248, 250, 252) if tema_fundo == "claro" else (11, 18, 21)
        cor_texto = (15, 23, 42) if tema_fundo == "claro" else (230, 237, 243)
        topo_h = max(36, H // 18)

        painel = np.full((H + topo_h, W * 2 + sep_w, 3), cor_fundo, dtype=np.uint8)
        painel[topo_h : topo_h + H, 0:W] = orig_bgr
        painel[topo_h : topo_h + H, W + sep_w : W * 2 + sep_w] = proc_com_legenda_bgr

        pil_painel = Image.fromarray(cv2.cvtColor(painel, cv2.COLOR_BGR2RGB))
        draw = ImageDraw.Draw(pil_painel)
        fonte_lbl = _carregar_fonte_truetype(max(14, topo_h // 2))
        lbl_orig = "A · Original" if idioma != "en" else "A · Original"
        lbl_proc = (
            "B · Processed"
            if idioma == "en"
            else ("B · Procesada" if idioma == "es" else "B · Processada")
        )
        draw.text((16, (topo_h - 18) // 2), lbl_orig, font=fonte_lbl, fill=cor_texto)
        draw.text((W + sep_w + 16, (topo_h - 18) // 2), lbl_proc, font=fonte_lbl, fill=cor_texto)
        pil_final = pil_painel
    else:
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
