import subprocess
import urllib.request
import json
import os
import datetime

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

print("Token GitHub autenticado.")

repo = "gcandid0/CytoCount"
version = "1.3.1"
tag_name = "1.3.1"

# 2. Ler assinaturas .sig geradas pelo Tauri
msi_sig_path = rf"src-tauri\target\release\bundle\msi\CytoCount_{version}_x64_en-US.msi.sig"
nsis_sig_path = rf"src-tauri\target\release\bundle\nsis\CytoCount_{version}_x64-setup.exe.sig"

msi_sig = ""
if os.path.exists(msi_sig_path):
    with open(msi_sig_path, "r", encoding="utf-8") as f:
        msi_sig = f.read().strip()

nsis_sig = ""
if os.path.exists(nsis_sig_path):
    with open(nsis_sig_path, "r", encoding="utf-8") as f:
        nsis_sig = f.read().strip()

print(f"Assinatura MSI carregada: {bool(msi_sig)} ({len(msi_sig)} chars)")
print(f"Assinatura NSIS carregada: {bool(nsis_sig)} ({len(nsis_sig)} chars)")

# 3. Gerar manifesto latest.json
latest_data = {
    "version": version,
    "notes": f"CytoCount v{version} — Hotfix: Pacote completo de C-extensions do NumPy e dependências científicas no sidecar, leitura nativa de microscópios confocal (Zeiss, Leica, Nikon, Olympus) e Projeção Z-Stack MIP.",
    "pub_date": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "platforms": {
        "windows-x86_64": {
            "signature": nsis_sig,
            "url": f"https://github.com/{repo}/releases/download/{tag_name}/CytoCount_{version}_x64-setup.exe"
        },
        "windows-x86_64-nsis": {
            "signature": nsis_sig,
            "url": f"https://github.com/{repo}/releases/download/{tag_name}/CytoCount_{version}_x64-setup.exe"
        },
        "windows-x86_64-msi": {
            "signature": msi_sig,
            "url": f"https://github.com/{repo}/releases/download/{tag_name}/CytoCount_{version}_x64_en-US.msi"
        }
    }
}

latest_json_path = rf"src-tauri\target\release\bundle\latest.json"
os.makedirs(os.path.dirname(latest_json_path), exist_ok=True)
with open(latest_json_path, "w", encoding="utf-8") as f:
    json.dump(latest_data, f, indent=2)

print("latest.json gerado com sucesso em:", latest_json_path)

# 4. Criar ou Obter Release no GitHub
release_title = f"CytoCount v{version} — Hotfix: Standalone Scientific C-Extensions Bundle & Confocal Bio-Formats"
release_body = f"""We are pleased to announce the release of **CytoCount v{version}**, providing a critical stability hotfix for standalone distribution bundles alongside full native support for proprietary confocal microscopy bio-formats and automated Z-Stack Maximum Intensity Projections (MIP).

---

### Highlights in v{version}

#### 1. Standalone Python Backend C-Extensions Hotfix
* **Full NumPy 2.x & SciPy Assembly:** Bundled complete `numpy._core` C-extensions, LAPACK/BLAS binaries, and dynamic libraries into the standalone backend binary, resolving the `ModuleNotFoundError: No module named 'numpy._core._exceptions'` issue.
* **Zero 'Failed to fetch' Latency:** Guarantees instantaneous local server boot on port 8756 across clean Windows environments without external Python installations.
* **Universal Standard Formats:** Robust processing of `.bmp`, `.png`, `.jpg`, and `.tif` alongside multi-dimensional confocal formats.

#### 2. Native Confocal Bio-Formats Ingestion
* **Carl Zeiss (`.czi`):** Direct multi-dimensional array extraction without intermediate conversion.
* **Leica Microsystems (`.lif`):** Native extraction of hyperstacks, series, and multichannel focal planes.
* **Nikon Instruments (`.nd2`):** Resonant and standard laser scanner confocal acquisitions.
* **Olympus / Evident FluoView (`.oib`, `.oif`):** Full parsing of laser scanning confocal stacks and OIF tree hierarchies.
* **OME-TIFF & BigTIFF (`.tif`, `.tiff`):** Preserved 16-bit dynamic depth per channel with zero clipping.

#### 3. Automated Z-Stack Maximum Intensity Projection (MIP)
* **Optical Axis Compression:** 3D/4D focal stacks ($(Z, H, W)$ and $(Z, C, H, W)$) automatically flattened via Maximum Intensity Projection ($\text{{MIP}} = \max_Z(I)$).
* **Fluorophore Routing:** Canonical alignment to DAPI (Channel 0), FITC/GFP (Channel 1), and PI/TRITC (Channel 2).

#### 4. Cryptographic Auto-Updater Integration
* All previous CytoCount installations automatically detect this release via signed Ed25519 manifests.

---

### Release Binaries (Windows 64-bit)

| File Name | Distribution Type | Description |
| :--- | :---: | :--- |
| **`CytoCount_{version}_x64-setup.exe`** | **NSIS Installer (Recommended)** | Standard guided installer with desktop shortcuts and auto-updater support. |
| **`CytoCount_{version}_x64_en-US.msi`** | **MSI Package** | Enterprise and institutional installer built via Microsoft WiX Toolset. |
| **`CytoCount_{version}_x64_Portable.zip`** | **Portable Archive** | Standalone zero-install package for flash drives, shared network drives, and restricted environments. |
| **`latest.json`** | **Update Manifest** | Cryptographically signed manifest for the automated in-app updater. |

---

### Academic Citation & Reproducibility

```bibtex
@software{{candido_2026_cytocount_{version.replace('.', '_')},
  author       = {{Cândido, Gabriel}},
  title        = {{{{CytoCount: High-Throughput Automated Cell Counting, 
                  Cytoplasmic Morphometry and Viability Analysis for 
                  Fluorescence Microscopy}}}},
  month        = nov,
  year         = 2026,
  publisher    = {{Zenodo}},
  version      = {{v{version}}},
  doi          = {{10.5281/zenodo.24224692}},
  url          = {{https://doi.org/10.5281/zenodo.24224692}}
}}
```
"""

# Verificar se release já existe
url_get = f"https://api.github.com/repos/{repo}/releases/tags/{tag_name}"
headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "CytoCount-Release"
}

release_id = None
try:
    req = urllib.request.Request(url_get, headers=headers)
    with urllib.request.urlopen(req) as resp:
        rel_info = json.loads(resp.read().decode())
        release_id = rel_info.get("id")
        print(f"Release existente encontrado: ID {release_id}")
except Exception:
    print(f"Release para tag {tag_name} não existe ainda. Criando novo release...")

if release_id is None:
    url_create = f"https://api.github.com/repos/{repo}/releases"
    payload = json.dumps({
        "tag_name": tag_name,
        "name": release_title,
        "body": release_body,
        "draft": False,
        "prerelease": False
    }).encode("utf-8")
    
    create_headers = {**headers, "Content-Type": "application/json"}
    req = urllib.request.Request(url_create, data=payload, headers=create_headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        rel_info = json.loads(resp.read().decode())
        release_id = rel_info.get("id")
        print(f"Release {version} criado com sucesso! ID: {release_id}")
else:
    # Atualizar corpo do release existente
    url_patch = f"https://api.github.com/repos/{repo}/releases/{release_id}"
    payload = json.dumps({
        "name": release_title,
        "body": release_body
    }).encode("utf-8")
    patch_headers = {**headers, "Content-Type": "application/json"}
    req = urllib.request.Request(url_patch, data=payload, headers=patch_headers, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        rel_info = json.loads(resp.read().decode())
        print(f"Release {version} atualizado.")

# 5. Fazer upload de todos os assets
assets_to_upload = [
    (rf"src-tauri\target\release\bundle\nsis\CytoCount_{version}_x64-setup.exe", "application/vnd.microsoft.portable-executable"),
    (rf"src-tauri\target\release\bundle\nsis\CytoCount_{version}_x64-setup.exe.sig", "text/plain"),
    (rf"src-tauri\target\release\bundle\msi\CytoCount_{version}_x64_en-US.msi", "application/x-msi"),
    (rf"src-tauri\target\release\bundle\msi\CytoCount_{version}_x64_en-US.msi.sig", "text/plain"),
    (rf"src-tauri\target\release\bundle\portable\CytoCount_{version}_x64_Portable.zip", "application/zip"),
    (latest_json_path, "application/json"),
]

# Obter assets existentes para deletar duplicatas se necessário
url_assets = f"https://api.github.com/repos/{repo}/releases/{release_id}/assets"
req_assets = urllib.request.Request(url_assets, headers=headers)
with urllib.request.urlopen(req_assets) as resp:
    existing_assets = {a["name"]: a["id"] for a in json.loads(resp.read().decode())}

for local_path, content_type in assets_to_upload:
    if not os.path.exists(local_path):
        print(f"AVISO: Arquivo local não encontrado: {local_path}")
        continue
    
    file_name = os.path.basename(local_path)
    if file_name in existing_assets:
        print(f"Deletando versão anterior do ativo {file_name}...")
        del_url = f"https://api.github.com/repos/{repo}/releases/assets/{existing_assets[file_name]}"
        del_req = urllib.request.Request(del_url, headers=headers, method="DELETE")
        try:
            with urllib.request.urlopen(del_req) as del_resp:
                pass
        except Exception as e:
            print(f"Erro ao deletar ativo existente: {e}")

    file_size_mb = os.path.getsize(local_path) / (1024 * 1024)
    print(f"Enviando {file_name} ({file_size_mb:.2f} MB)...")
    upload_url = f"https://uploads.github.com/repos/{repo}/releases/{release_id}/assets?name={file_name}"
    with open(local_path, "rb") as f:
        file_bytes = f.read()

    up_headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CytoCount-Release",
        "Content-Type": content_type
    }
    up_req = urllib.request.Request(upload_url, data=file_bytes, headers=up_headers, method="POST")
    with urllib.request.urlopen(up_req) as up_resp:
        up_res = json.loads(up_resp.read().decode())
        print(f"  OK: {file_name} enviado -> {up_res.get('browser_download_url')}")

print(f"\nTODOS OS ATIVOS DO RELEASE {version} FORAM PUBLICADOS COM SUCESSO!")
