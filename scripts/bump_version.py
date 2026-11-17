import os
import re

repo_root = r"d:\gabriel\DocumentosSSD\CNPEM\viacell-tauri"

def replace_in_file(rel_path, old_pattern, new_text):
    path = os.path.join(repo_root, rel_path)
    if not os.path.exists(path):
        print(f"Arquivo não encontrado: {path}")
        return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    if isinstance(old_pattern, str):
        if old_pattern not in content:
            print(f"Aviso: '{old_pattern}' não encontrado em {rel_path}")
            return
        new_content = content.replace(old_pattern, new_text)
    else:
        new_content, count = old_pattern.subn(new_text, content)
        if count == 0:
            print(f"Aviso: padrão regex não encontrado em {rel_path}")
            return

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Atualizado {rel_path}")

# 1. package.json
replace_in_file("package.json", '"version": "1.1.0"', '"version": "1.2.0"')

# 2. package-lock.json
replace_in_file("package-lock.json", '"name": "cytocount",\n  "version": "1.1.0"', '"name": "cytocount",\n  "version": "1.2.0"')
replace_in_file("package-lock.json", '"packages": {\n    "": {\n      "name": "cytocount",\n      "version": "1.1.0"', '"packages": {\n    "": {\n      "name": "cytocount",\n      "version": "1.2.0"')

# 3. src-tauri/Cargo.toml
replace_in_file(os.path.join("src-tauri", "Cargo.toml"), 'version = "1.1.0"', 'version = "1.2.0"')

# 4. src-tauri/tauri.conf.json
replace_in_file(os.path.join("src-tauri", "tauri.conf.json"), '"version": "1.1.0"', '"version": "1.2.0"')

# 5. src-tauri/src/main.rs
replace_in_file(os.path.join("src-tauri", "src", "main.rs"), "CytoCount v1.1.0", "CytoCount v1.2.0")

# 6. backend/core.py
replace_in_file(os.path.join("backend", "core.py"), 'APP_VERSION = "1.1.0"', 'APP_VERSION = "1.2.0"')
replace_in_file(os.path.join("backend", "core.py"), "CytoCount v1.1.0", "CytoCount v1.2.0")

# 7. backend/main.py
replace_in_file(os.path.join("backend", "main.py"), "CytoCount v1.1.0", "CytoCount v1.2.0")

# 8. src/lib/api.ts
replace_in_file(os.path.join("src", "lib", "api.ts"), 'export const APP_VERSION = "1.1.0";', 'export const APP_VERSION = "1.2.0";')

# 9. src/lib/i18n.ts
replace_in_file(os.path.join("src", "lib", "i18n.ts"), "Versão 1.1.0", "Versão 1.2.0")
replace_in_file(os.path.join("src", "lib", "i18n.ts"), "version      = {1.1.0}", "version      = {1.2.0}")

# 10. src/components/ModalTutorial.tsx
replace_in_file(os.path.join("src", "components", "ModalTutorial.tsx"), "CytoCount v1.1.0", "CytoCount v1.2.0")

# 11. src/components/NavegadorResultados.tsx
replace_in_file(os.path.join("src", "components", "NavegadorResultados.tsx"), "CytoCount v1.1.0", "CytoCount v1.2.0")

# 12. tests/test_api.py
replace_in_file(os.path.join("tests", "test_api.py"), 'assert data.get("version") == "1.1.0"', 'assert data.get("version") == "1.2.0"')

# 13. CITATION.cff
replace_in_file("CITATION.cff", 'version: "1.1.0"', 'version: "1.2.0"')
replace_in_file("CITATION.cff", "Versão 1.1.0", "Versão 1.2.0")

# 14. LICENSE
replace_in_file("LICENSE", "(Versão 1.1.0)", "(Versão 1.2.0)")

# 15. READMEs
for r in ["README.md", "README.en.md", "README.es.md"]:
    replace_in_file(r, "CytoCount_1.1.0_x64-setup.exe", "CytoCount_1.2.0_x64-setup.exe")
    replace_in_file(r, "CytoCount_1.1.0_x64_en-US.msi", "CytoCount_1.2.0_x64_en-US.msi")
    replace_in_file(r, "1.1.0", "1.2.0")

# 16. docs/index.html
replace_in_file(os.path.join("docs", "index.html"), "v1.1.0", "v1.2.0")
replace_in_file(os.path.join("docs", "index.html"), "Versão 1.1.0", "Versão 1.2.0")
replace_in_file(os.path.join("docs", "index.html"), "CytoCount_1.1.0_x64-setup.exe", "CytoCount_1.2.0_x64-setup.exe")
replace_in_file(os.path.join("docs", "index.html"), "CytoCount_1.1.0_x64_en-US.msi", "CytoCount_1.2.0_x64_en-US.msi")
replace_in_file(os.path.join("docs", "index.html"), "CytoCount_1.1.0_x64_Portable.zip", "CytoCount_1.2.0_x64_Portable.zip")

# 17. scripts/list_binaries.ps1 & scripts/package_portable.ps1
replace_in_file(os.path.join("scripts", "list_binaries.ps1"), "1.1.0", "1.2.0")
replace_in_file(os.path.join("scripts", "package_portable.ps1"), "1.1.0", "1.2.0")

print("\nTodos os arquivos foram atualizados para a versão 1.2.0!")
