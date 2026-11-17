import os
import re

docs_dir = r"d:\gabriel\DocumentosSSD\CNPEM\viacell-tauri\docs"
html_path = os.path.join(docs_dir, "index.html")

with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

matches = re.findall(r'(?:src|href)="([^":]+?)"', html)
missing = []
for m in matches:
    if m.startswith("#") or m.startswith("mailto:") or m.startswith("http"):
        continue
    full = os.path.join(docs_dir, m.replace("/", os.sep))
    if not os.path.exists(full):
        missing.append((m, full))

print(f"Total referências locais testadas: {len(matches)}")
if missing:
    print(f"Arquivos ausentes: {missing}")
else:
    print("Sucesso: Todas as imagens, scripts e folhas de estilo locais existem!")
