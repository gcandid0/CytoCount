import subprocess
import urllib.request
import json
import os

# 1. Obter Token do Git Credential Manager
proc = subprocess.Popen(
    ['git', 'credential-manager', 'get'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)
out, _ = proc.communicate(input="protocol=https\nhost=github.com\n\n", timeout=5)
token = None
for line in out.strip().splitlines():
    if line.startswith("password="):
        token = line.split("=", 1)[1]
        break

if not token:
    raise RuntimeError("Token não encontrado no Git Credential Manager.")

print("Token obtido com sucesso.")

release_id = 447650602
repo = "gcandid0/CytoCount"

# 2. Texto do Release em Inglês
release_title = "CytoCount v1.2.0 — Independent Cytoplasm Segmentation & A/B Curtain Slider"
release_body = """We are pleased to announce the official release of **CytoCount v1.2.0**, a major update introducing independent cytoplasmic morphometry, interactive before/after visual inspection, publication-ready presentation export, and a native cryptographic auto-update system.

---

### What's New in v1.2.0

#### 1. Independent Cytoplasm Segmentation (Green / FITC)
* **Separated Analytical Modes:** Cytoplasm segmentation is now a standalone operational mode in the interface, completely decoupled from the nuclear viability pipeline.
* **Geodesic Voronoi Partitioning:** Uses primary nuclear seeds (DAPI) and expands cell boundaries up to the limit of green cytoplasmic fluorescence (FITC/GFP), guaranteeing that adjacent cells never overlap.
* **Comprehensive Cellular Morphometry:** Automated measurement of mean nuclear area (px² and µm²), mean cytoplasmic area, total cell area, and Nuclear-to-Cytoplasmic (N:C) ratio, exported to tidy CSV tables compatible with R and GraphPad Prism.

#### 2. Interactive "Before / After" A|B Curtain Slider
* **Real-Time Subpixel Inspection:** A dynamic vertical dividing bar draggable with mouse or touch across the microscopy canvas, allowing fluid transitions between raw fluorescence channels and segmented cell boundaries.
* **Floating Context Pills:** Clear indicators for input fluorescence (*Channel A · Raw Image*) and morphological detection (*Channel B · Voronoi Segmentation*).

#### 3. Presentation Mode (Pure White `#ffffff` Background) for Slides & Publications
* **Zero Gray Border Artifacts:** One-click export with a pure white background (`#ffffff`), enabling seamless and transparent insertion into PowerPoint slides, conference posters, Word manuscripts, and LaTeX documents.
* **Versatile Theme Presets:** Instant switching between Pure White (Presentations), Dark Mode (`#070a0e`), and Inverted High-Contrast (Monochrome / Ink-Saver).
* **Calibrated Micrometric Scale Bar:** Automatic physical scale bar rendered according to microscope calibration and magnification factor (µm/pixel), fully compliant with *Nature*, *Elsevier*, and *Cell* submission guidelines.

#### 4. Native Cryptographic Auto-Updater
* **Ed25519 Signature Verification:** The desktop application automatically checks and downloads verified updates directly from GitHub with end-to-end cryptographic integrity.
* **Integrated Modal:** Real-time download progress bar with a seamless one-click restart (`relaunch`) mechanism.

#### 5. Online Documentation & Interactive Showcase
* Publicly accessible at: **[https://gcandid0.github.io/CytoCount/](https://gcandid0.github.io/CytoCount/)**
* Features an in-browser interactive curtain slider, comparative morphometry matrices, and comprehensive technical documentation.

---

### Release Binaries (Windows 64-bit)

| File Name | Distribution Type | Description |
| :--- | :---: | :--- |
| **`CytoCount_1.2.0_x64-setup.exe`** | **NSIS Installer (Recommended)** | Standard guided installer with desktop shortcuts and auto-updater support. |
| **`CytoCount_1.2.0_x64_en-US.msi`** | **MSI Package** | Enterprise and institutional installer built via Microsoft WiX Toolset. |
| **`CytoCount_1.2.0_x64_Portable.zip`** | **Portable Archive** | Standalone zero-install package for flash drives, shared network drives, and restricted environments. |
| **`viacell.exe`** | **Direct Binary** | Native Rust/Tauri release executable. |

---

### System Requirements

* **Operating System:** Microsoft Windows 10 (1903+) or Windows 11 (64-bit).
* **Processor:** 64-bit Intel / AMD x86_64 CPU.
* **Memory (RAM):** 4 GB minimum (8 GB recommended for large multichannel image batches).
* **Storage:** ~350 MB available disk space.
* **Supported Formats:** TIFF, OME-TIFF (16-bit and 8-bit), PNG, JPEG, BMP.
* **Privacy & Network:** 100% offline execution. No imaging data is ever transmitted to cloud servers.

---

### Citation & Academic Reproducibility

If you use CytoCount in your research, thesis, or peer-reviewed publication, please cite it using the persistent Zenodo digital object identifier (DOI):

```bibtex
@software{candido_2026_cytocount,
  author       = {Cândido, Gabriel},
  title        = {{CytoCount: High-Throughput Automated Cell Counting, 
                  Cytoplasmic Morphometry and Viability Analysis for 
                  Fluorescence Microscopy}},
  month        = nov,
  year         = 2026,
  publisher    = {Zenodo},
  version      = {v1.2.0},
  doi          = {10.5281/zenodo.24224693},
  url          = {https://doi.org/10.5281/zenodo.24224693}
}
```

**APA 7th Edition:**
> Cândido, G. (2026). *CytoCount: High-throughput automated cell counting, cytoplasmic morphometry and viability analysis for fluorescence microscopy* (Version 1.2.0) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.24224693
"""

# 3. PATCH Release Body
url_patch = f"https://api.github.com/repos/{repo}/releases/{release_id}"
headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "CytoCount-ReleaseUpdater",
    "Content-Type": "application/json"
}

payload = json.dumps({
    "name": release_title,
    "body": release_body
}).encode("utf-8")

req = urllib.request.Request(url_patch, data=payload, headers=headers, method="PATCH")
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode())
    print(f"Sucesso! Release '{res.get('name')}' atualizado com o texto em inglês.")
    print("URL do Release:", res.get("html_url"))

# 4. Upload do Pacote Portátil .zip se ainda não existir
zip_path = r"d:\gabriel\DocumentosSSD\CNPEM\viacell-tauri\src-tauri\target\release\bundle\portable\CytoCount_1.2.0_x64_Portable.zip"
if os.path.exists(zip_path):
    existing_assets = [a["name"] for a in res.get("assets", [])]
    zip_name = os.path.basename(zip_path)
    if zip_name in existing_assets:
        print(f"O ativo {zip_name} já existe no release.")
    else:
        print(f"Fazendo upload de {zip_name} ({os.path.getsize(zip_path) // (1024 * 1024)} MB)...")
        upload_url = f"https://uploads.github.com/repos/{repo}/releases/{release_id}/assets?name={zip_name}"
        with open(zip_path, "rb") as f:
            zip_bytes = f.read()
        
        up_headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "CytoCount-ReleaseUpdater",
            "Content-Type": "application/zip"
        }
        up_req = urllib.request.Request(upload_url, data=zip_bytes, headers=up_headers, method="POST")
        with urllib.request.urlopen(up_req) as up_resp:
            up_res = json.loads(up_resp.read().decode())
            print(f"Ativo {zip_name} enviado com sucesso! Download URL: {up_res.get('browser_download_url')}")
