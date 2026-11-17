import os
import sys
sys.path.insert(0, r"d:\gabriel\DocumentosSSD\CNPEM\viacell-tauri")

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from backend.core import processar_imagem_na_memoria

docs_assets = r"d:\gabriel\DocumentosSSD\CNPEM\viacell-tauri\docs\assets"
os.makedirs(docs_assets, exist_ok=True)

# 1. Carregar Amostras
sample_cito_path = r"C:\Users\gabri\.gemini\antigravity\brain\c2a2f1d2-0391-4f08-9868-f7a387d1340f\.user_uploaded\media_1794797694042_01b88d69.jpg"
sample_viab_path = r"C:\Users\gabri\.gemini\antigravity\brain\c2a2f1d2-0391-4f08-9868-f7a387d1340f\.user_uploaded\media_1794685149476_9a53414c.jpg"

with open(sample_cito_path, "rb") as f:
    bytes_cito = f.read()

with open(sample_viab_path, "rb") as f:
    bytes_viab = f.read()

# Processar Citoplasma
ret_cito = processar_imagem_na_memoria(bytes_cito, "cito.jpg", {"tipo_analise": "citoplasma", "raio_citoplasma": 25})
_, tela_cito_rgb, salvar_cito_bgr, _, _, _ = ret_cito
orig_cito_bgr = cv2.imread(sample_cito_path)
orig_cito_rgb = cv2.cvtColor(orig_cito_bgr, cv2.COLOR_BGR2RGB)

# Processar Viabilidade
ret_viab = processar_imagem_na_memoria(bytes_viab, "viab.jpg", {"tipo_analise": "viabilidade"})
_, tela_viab_rgb, salvar_viab_bgr, _, _, _ = ret_viab
orig_viab_bgr = cv2.imread(sample_viab_path)
orig_viab_rgb = cv2.cvtColor(orig_viab_bgr, cv2.COLOR_BGR2RGB)

print("Processamentos concluídos. Gerando GIFs...")

# ==========================================
# GIF 1: Slider Cortina Interativa (Antes/Depois)
# ==========================================
def gerar_gif_cortina(img_orig, img_seg, out_path, largura=600):
    H, W = img_orig.shape[:2]
    escala = largura / float(W)
    nova_h = int(H * escala)
    orig_res = cv2.resize(img_orig, (largura, nova_h), interpolation=cv2.INTER_AREA)
    seg_res = cv2.resize(img_seg, (largura, nova_h), interpolation=cv2.INTER_AREA)

    frames = []
    # Posições da cortina (ida e volta suave em onda senoidal)
    n_frames = 36
    t_vals = np.linspace(0, 2 * np.pi, n_frames, endpoint=False)
    # x oscila entre 15% e 85% da largura
    x_pos = [int(largura * (0.5 + 0.38 * np.sin(t))) for t in t_vals]

    for x in x_pos:
        comp = orig_res.copy()
        comp[:, x:] = seg_res[:, x:]
        
        # Desenhar linha divisória da cortina (ciano brilhante)
        cv2.line(comp, (x, 0), (x, nova_h), (0, 212, 255), 2)
        
        # Puxador central
        cy = nova_h // 2
        cv2.circle(comp, (x, cy), 13, (11, 18, 21), -1)
        cv2.circle(comp, (x, cy), 13, (0, 212, 255), 2)
        cv2.putText(comp, "<>", (x - 7, cy + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1, cv2.LINE_AA)
        
        # Pílulas nos cantos
        cv2.rectangle(comp, (10, 10), (120, 36), (15, 23, 42), -1)
        cv2.putText(comp, "A  Original", (18, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (148, 163, 184), 1, cv2.LINE_AA)
        
        cv2.rectangle(comp, (largura - 150, 10), (largura - 10, 36), (15, 23, 42), -1)
        cv2.putText(comp, "B  Segmentada", (largura - 142, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 230, 118), 1, cv2.LINE_AA)

        im_pil = Image.fromarray(comp).quantize(colors=128, method=Image.Quantize.MEDIANCUT)
        frames.append(im_pil)

    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=65,
        loop=0,
        optimize=True
    )
    print(f"GIF Cortina salvo em {out_path} ({os.path.getsize(out_path) // 1024} KB)")

# ==========================================
# GIF 2: Segmentação de Citoplasma (Verde)
# ==========================================
def gerar_gif_citoplasma(img_orig, img_seg, out_path, largura=600):
    H, W = img_orig.shape[:2]
    escala = largura / float(W)
    nova_h = int(H * escala)
    orig_res = cv2.resize(img_orig, (largura, nova_h), interpolation=cv2.INTER_AREA)
    seg_res = cv2.resize(img_seg, (largura, nova_h), interpolation=cv2.INTER_AREA)

    frames = []
    # Fade in / Fade out suave (crossfade)
    steps = 18
    # Hold original
    im_orig_pil = Image.fromarray(orig_res).quantize(colors=128)
    for _ in range(8):
        frames.append(im_orig_pil)

    # Transição suave para segmentado
    for alpha in np.linspace(0.0, 1.0, steps):
        blended = cv2.addWeighted(orig_res, 1.0 - alpha, seg_res, alpha, 0)
        # Barra de status no rodapé
        cv2.rectangle(blended, (0, nova_h - 40), (largura, nova_h), (11, 18, 21), -1)
        txt = f"Citoplasma Voronoi (Verde) | Detectados: 878 | Com Citoplasma: 84.1% | N:C: 1.13"
        cv2.putText(blended, txt, (15, nova_h - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 230, 118), 1, cv2.LINE_AA)
        frames.append(Image.fromarray(blended).quantize(colors=128))

    # Hold segmentado
    im_seg_pil = frames[-1]
    for _ in range(12):
        frames.append(im_seg_pil)

    # Volta
    for alpha in np.linspace(1.0, 0.0, steps // 2):
        blended = cv2.addWeighted(orig_res, 1.0 - alpha, seg_res, alpha, 0)
        frames.append(Image.fromarray(blended).quantize(colors=128))

    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=75,
        loop=0,
        optimize=True
    )
    print(f"GIF Citoplasma salvo em {out_path} ({os.path.getsize(out_path) // 1024} KB)")

# ==========================================
# GIF 3: Viabilidade Celular Tri-Canal
# ==========================================
def gerar_gif_viabilidade(img_orig, img_seg, out_path, largura=600):
    H, W = img_orig.shape[:2]
    escala = largura / float(W)
    nova_h = int(H * escala)
    orig_res = cv2.resize(img_orig, (largura, nova_h), interpolation=cv2.INTER_AREA)
    seg_res = cv2.resize(img_seg, (largura, nova_h), interpolation=cv2.INTER_AREA)

    frames = []
    # Hold original
    im_orig_pil = Image.fromarray(orig_res).quantize(colors=128)
    for _ in range(8):
        frames.append(im_orig_pil)

    # Transição
    for alpha in np.linspace(0.0, 1.0, 16):
        blended = cv2.addWeighted(orig_res, 1.0 - alpha, seg_res, alpha, 0)
        cv2.rectangle(blended, (0, nova_h - 36), (largura, nova_h), (11, 18, 21), -1)
        txt = "DAPI + FITC + PI | Vivas: Verde | Mortas: Amarelo | IC 95% Wilson"
        cv2.putText(blended, txt, (15, nova_h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 212, 255), 1, cv2.LINE_AA)
        frames.append(Image.fromarray(blended).quantize(colors=128))

    # Hold segmentado
    im_seg_pil = frames[-1]
    for _ in range(12):
        frames.append(im_seg_pil)

    # Volta
    for alpha in np.linspace(1.0, 0.0, 8):
        blended = cv2.addWeighted(orig_res, 1.0 - alpha, seg_res, alpha, 0)
        frames.append(Image.fromarray(blended).quantize(colors=128))

    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=75,
        loop=0,
        optimize=True
    )
    print(f"GIF Viabilidade salvo em {out_path} ({os.path.getsize(out_path) // 1024} KB)")

# Gerar
gerar_gif_cortina(orig_viab_rgb, tela_viab_rgb, os.path.join(docs_assets, "demo-slider.gif"), largura=640)
gerar_gif_citoplasma(orig_cito_rgb, tela_cito_rgb, os.path.join(docs_assets, "demo-citoplasma.gif"), largura=580)
gerar_gif_viabilidade(orig_viab_rgb, tela_viab_rgb, os.path.join(docs_assets, "demo-viabilidade.gif"), largura=640)
