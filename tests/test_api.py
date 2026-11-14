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
        assert data.get("version") == "1.1.0"
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

if __name__ == "__main__":
    test_health_routes()
    test_sample_demo()
    test_process_and_reprocess_flow()
    test_wilson_ci_edge_cases()
    print("TODOS OS TESTES DE API E WILSON PASSARAM COM SUCESSO!")
