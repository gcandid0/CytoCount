import subprocess
import urllib.request
import json
import os
import datetime

# 1. Obter Token do Git Credential Manager
proc = subprocess.Popen(['git', 'credential-manager', 'get'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
out, _ = proc.communicate(input="protocol=https\nhost=github.com\n\n", timeout=5)
token = [line.split("=", 1)[1] for line in out.strip().splitlines() if line.startswith("password=")][0]

repo = "gcandid0/CytoCount"
version = "1.3.1"
tag_name = "1.3.1"

nsis_sig_path = rf"src-tauri\target\release\bundle\nsis\CytoCount_{version}_x64-setup.exe.sig"
msi_sig_path = rf"src-tauri\target\release\bundle\msi\CytoCount_{version}_x64_en-US.msi.sig"

with open(nsis_sig_path, "r", encoding="utf-8") as f:
    nsis_sig = f.read().strip()
with open(msi_sig_path, "r", encoding="utf-8") as f:
    msi_sig = f.read().strip()

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
with open(latest_json_path, "w", encoding="utf-8") as f:
    json.dump(latest_data, f, indent=2)

headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "CytoCount-Release"
}

# Obter release
req = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases/tags/{tag_name}", headers=headers)
with urllib.request.urlopen(req) as resp:
    rel_info = json.loads(resp.read().decode())
    release_id = rel_info["id"]

# Deletar latest.json antigo
req_assets = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases/{release_id}/assets", headers=headers)
with urllib.request.urlopen(req_assets) as resp:
    assets = {a["name"]: a["id"] for a in json.loads(resp.read().decode())}

if "latest.json" in assets:
    del_url = f"https://api.github.com/repos/{repo}/releases/assets/{assets['latest.json']}"
    del_req = urllib.request.Request(del_url, headers=headers, method="DELETE")
    with urllib.request.urlopen(del_req) as del_resp:
        print("latest.json antigo deletado do GitHub Release.")

# Upload novo latest.json
with open(latest_json_path, "rb") as f:
    content = f.read()

up_url = f"https://uploads.github.com/repos/{repo}/releases/{release_id}/assets?name=latest.json"
up_headers = {**headers, "Content-Type": "application/json"}
up_req = urllib.request.Request(up_url, data=content, headers=up_headers, method="POST")
with urllib.request.urlopen(up_req) as up_resp:
    res = json.loads(up_resp.read().decode())
    print("Novo latest.json enviado com sucesso para o GitHub Release!", res["browser_download_url"])
