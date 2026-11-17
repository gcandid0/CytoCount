import io
import os
import sys
import numpy as np
import cv2
from fastapi.testclient import TestClient

# Adiciona o diretório backend ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from main import app
import core

client = TestClient(app)

def test_health_routes():
    # Testa rota padrão e rota com prefixo /api
    for path in ["/health", "/api/health"]:
        r = client.get(path)
        assert r.status_code == 200, f"Falha em {path}: status {r.status_code}"
        data = r.json()
        assert data.get("status") == "ok"
        assert data.get("version") == "1.3.0"
        assert isinstance(data.get("pid"), int)

def test_sample_demo():
    # Testa rota padrão e rota com /api
    for path in ["/sample-demo", "/api/sample-demo"]:
        r = client.post(path, data={"idioma": "pt"})
        assert r.status_code == 200, f"Falha em {path}: {r.text}"
        data = r.json()
        assert "id" in data
        assert "relatorio" in data
        assert "processada_png_b64" in data
        rel = data["relatorio"]
        assert "Viabilidade (%)" in rel
        assert "Viabilidade Formatada PT" in rel
        assert "IC 95%" in rel["Viabilidade Formatada PT"] or "95%" in rel["Viabilidade Formatada PT"]

def test_process_and_reprocess_flow():
    # 1. Cria imagem sintética simples (3 canais, 512x512)
    img = np.zeros((512, 512, 3), dtype=np.uint8)
    cv2.circle(img, (200, 200), 20, (255, 20, 10), -1)  # Azul
    cv2.circle(img, (200, 200), 25, (20, 230, 20), -1)  # Verde (viva)
    cv2.circle(img, (350, 350), 20, (255, 10, 20), -1)  # Azul
    cv2.circle(img, (350, 350), 25, (10, 220, 240), -1) # Amarelo (morta)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    file_bytes = buf.tobytes()

    # 2. Chama POST /api/process
    files = {"arquivo": ("teste_amostra.png", io.BytesIO(file_bytes), "image/png")}
    data = {
        "bias_azul": "0",
        "bias_verde": "0",
        "bias_amarelo": "0",
        "aplicar_bilateral": "true",
        "min_circularidade": "0.15",
        "formula_viabilidade": "Padrão Biológico (Vivas / (Vivas + Mortas))",
        "idioma": "pt",
    }
    r = client.post("/api/process", files=files, data=data)
    assert r.status_code == 200, f"Erro no process: {r.text}"
    res = r.json()
    job_id = res["id"]
    assert job_id
    assert res["relatorio"]["Detectados"] >= 2

    # 3. Chama POST /api/reprocess/{job_id} com ROI
    roi_json = '{"x": 100, "y": 100, "w": 250, "h": 250}'
    data_roi = {
        "bias_azul": "0",
        "bias_verde": "0",
        "bias_amarelo": "0",
        "aplicar_bilateral": "true",
        "min_circularidade": "0.15",
        "formula_viabilidade": "Padrão Biológico (Vivas / (Vivas + Mortas))",
        "roi_json": roi_json,
        "idioma": "pt",
    }
    r_reproc = client.post(f"/api/reprocess/{job_id}", data=data_roi)
    assert r_reproc.status_code == 200, f"Erro no reprocess: {r_reproc.text}"
    res_reproc = r_reproc.json()
    assert res_reproc["relatorio"]["ROI Dict"]["w"] == 250

    # 3.1 Testa reprocessamento com motor StarDist 2D e Cellpose 2D
    for motor, nome_esperado in [("stardist", "StarDist 2D"), ("cellpose", "Cellpose 2D"), ("watershed", "Watershed Clássico")]:
        data_motor = {
            **data_roi,
            "motor_segmentacao": motor,
        }
        r_m = client.post(f"/api/reprocess/{job_id}", data=data_motor)
        assert r_m.status_code == 200, f"Erro no motor {motor}: {r_m.text}"
        res_m = r_m.json()
        rel_m = res_m["relatorio"]
        assert rel_m["Motor de Segmentação"] == nome_esperado
        assert rel_m["Detectados"] == rel_m["Viáveis (Verde)"] + rel_m["Mortas (Amarelo)"] + rel_m["Indeterminadas"]
        if res_m.get("tabela_celulas"):
            cel0 = res_m["tabela_celulas"][0]
            assert "area_citoplasma_px" in cel0
            assert "contorno_citoplasma_pts" in cel0

    # 4. Testa 404 em job_id inexistente
    r_404 = client.post("/api/reprocess/id-ficticio-inexistente", data=data_roi)
    assert r_404.status_code == 404
    assert "Amostra não encontrada" in r_404.json().get("erro", "")

    # 5. Testa exportação para publicação
    r_pub = client.post(f"/api/export-publication/{job_id}", json={
        "formato": "png",
        "dpi": 300,
        "idioma": "pt",
        "mostrar_contornos": True,
        "tema_fundo": "escuro",
        "paleta_daltonismo": False,
        "lado_a_lado": False,
        "um_por_pixel": 0.5,
        "tamanho_barra_um": 50,
    })
    assert r_pub.status_code == 200
    assert "conteudo_b64" in r_pub.json()

    # 6. Testa exportação de ZIP base64
    r_zip = client.get(f"/api/export-zip-b64?ids={job_id}")
    assert r_zip.status_code == 200
    assert "conteudo_b64" in r_zip.json()

def test_wilson_ci_edge_cases():
    # n = 0 retorna '—'
    fmt_zero = core.formatar_viabilidade_padrao(0.0, 0.0, 0.0, "pt", base_calculo=0)
    assert fmt_zero == "—"

    # vivas=2415, mortas=229 (total 2644)
    lo, hi = core.wilson(2415, 2644)
    assert lo == 90.2
    assert hi == 92.4
    fmt = core.formatar_viabilidade_padrao(91.3, lo, hi, "pt", base_calculo=2644)
    assert "91,3%" in fmt
    assert "90,2–92,4" in fmt

def test_cytoplasm_segmentation_flow():
    # Cria imagem sintética com núcleo (azul) envolto por citoplasma (verde)
    img = np.zeros((256, 256, 3), dtype=np.uint8)
    # Célula 1: Núcleo no centro (azul) + halo verde amplo (citoplasma)
    cv2.circle(img, (128, 128), 35, (0, 180, 0), -1)   # Verde BGR = (0, 180, 0)
    cv2.circle(img, (128, 128), 15, (220, 0, 0), -1)   # Azul BGR = (220, 0, 0)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    file_bytes = buf.tobytes()

    files = {"arquivo": ("teste_citoplasma.png", io.BytesIO(file_bytes), "image/png")}
    data = {
        "tipo_analise": "citoplasma",
        "raio_citoplasma": "30",
        "bias_azul": "0",
        "bias_verde": "0",
        "aplicar_bilateral": "true",
        "min_circularidade": "0.1",
        "idioma": "pt",
    }
    r = client.post("/api/process", files=files, data=data)
    assert r.status_code == 200, f"Falha no processamento de citoplasma: {r.text}"
    res = r.json()
    rel = res["relatorio"]
    assert rel["Tipo de Análise"] == "citoplasma"
    assert rel["Detectados"] >= 1
    assert rel["Com Citoplasma"] >= 1
    assert "Área Média Citoplasma (px²)" in rel
    assert "Razão N:C Média" in rel
    assert "Alerta Indeterminadas" not in rel or rel["Alerta Indeterminadas"] is False

    # Reprocessamento em modo citoplasma
    job_id = res["id"]
    r_rep = client.post(f"/api/reprocess/{job_id}", data={
        "tipo_analise": "citoplasma",
        "raio_citoplasma": "40",
        "bias_verde": "10",
        "idioma": "pt",
    })
    assert r_rep.status_code == 200
    res_rep = r_rep.json()
    assert res_rep["relatorio"]["Tipo de Análise"] == "citoplasma"
    assert res_rep["relatorio"]["Com Citoplasma"] >= 1

def test_bioformats_and_zstack_mip():
    import numpy as np
    import tifffile
    from core import resolver_dimensoes_microscopia, ler_imagem_flexivel

    # 1. Teste 2D monocromático (H, W)
    arr_2d = np.full((128, 128), 100, dtype=np.uint8)
    rgb, (r, g, b) = resolver_dimensoes_microscopia(arr_2d)
    assert rgb.shape == (128, 128, 3)
    assert r.shape == (128, 128)

    # 2. Teste 3D Planar (3, H, W)
    arr_planar = np.zeros((3, 64, 64), dtype=np.uint16)
    arr_planar[0, :, :] = 500  # DAPI (Azul)
    arr_planar[1, :, :] = 800  # FITC (Verde)
    arr_planar[2, :, :] = 200  # PI (Vermelho)
    rgb, (r, g, b) = resolver_dimensoes_microscopia(arr_planar)
    assert rgb.shape == (64, 64, 3)
    assert np.allclose(b, 500)
    assert np.allclose(g, 800)
    assert np.allclose(r, 200)

    # 3. Teste 4D Z-Stack (Z=5, C=3, H, W) com Projeção de Intensidade Máxima (MIP)
    arr_zstack = np.zeros((5, 3, 32, 32), dtype=np.uint16)
    arr_zstack[2, 0, :, :] = 1200 # pico de foco no plano z=2 (canal 0 = azul)
    arr_zstack[3, 1, :, :] = 1800 # pico de foco no plano z=3 (canal 1 = verde)
    rgb, (r, g, b) = resolver_dimensoes_microscopia(arr_zstack)
    assert rgb.shape == (32, 32, 3)
    assert b.max() == 1200 # MIP recuperou pico em z=2
    assert g.max() == 1800 # MIP recuperou pico em z=3

    # 4. Teste TIFF em memória via tifffile
    buf = io.BytesIO()
    tifffile.imwrite(buf, arr_planar)
    rgb_tif, (r_tif, g_tif, b_tif) = ler_imagem_flexivel(buf.getvalue(), "amostra_confocal.tif")
    assert rgb_tif.shape == (64, 64, 3)
    assert r_tif.shape == (64, 64)

    # 5. Teste endpoint /api/process com TIFF confocal sintetizado
    bio_buf = io.BytesIO()
    synth_confocal = np.zeros((4, 3, 64, 64), dtype=np.uint16)
    synth_confocal[:, 0, 25:35, 25:35] = 10000
    tifffile.imwrite(bio_buf, synth_confocal)
    r_proc = client.post("/api/process", files={"arquivo": ("zstack.tif", bio_buf.getvalue(), "image/tiff")}, data={"idioma": "pt"})
    assert r_proc.status_code == 200
    assert r_proc.json()["relatorio"]["Detectados"] >= 1


if __name__ == "__main__":
    test_health_routes()
    test_sample_demo()
    test_process_and_reprocess_flow()
    test_cytoplasm_segmentation_flow()
    test_wilson_ci_edge_cases()
    test_bioformats_and_zstack_mip()
    print("TODOS OS TESTES DE API E WILSON PASSARAM COM SUCESSO!")
