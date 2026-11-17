import os

repo_root = r"d:\gabriel\DocumentosSSD\CNPEM\viacell-tauri"

def replace_in_file(rel_path, old_text, new_text):
    path = os.path.join(repo_root, rel_path)
    if not os.path.exists(path):
        print(f"Nao encontrado: {rel_path}")
        return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if old_text not in content:
        print(f"Aviso: '{old_text}' nao encontrado em {rel_path}")
        return
    content = content.replace(old_text, new_text)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Atualizado: {rel_path}")

replace_in_file("package.json", '"version": "1.3.1"', '"version": "1.3.2"')
replace_in_file("package-lock.json", '"name": "cytocount",\n  "version": "1.3.1"', '"name": "cytocount",\n  "version": "1.3.2"')
replace_in_file("package-lock.json", '"packages": {\n    "": {\n      "name": "cytocount",\n      "version": "1.3.1"', '"packages": {\n    "": {\n      "name": "cytocount",\n      "version": "1.3.2"')
replace_in_file(os.path.join("src-tauri", "Cargo.toml"), 'version = "1.3.1"', 'version = "1.3.2"')
replace_in_file(os.path.join("src-tauri", "tauri.conf.json"), '"version": "1.3.1"', '"version": "1.3.2"')
replace_in_file(os.path.join("src-tauri", "src", "main.rs"), "CytoCount v1.3.1", "CytoCount v1.3.2")
replace_in_file(os.path.join("backend", "core.py"), 'APP_VERSION = "1.3.1"', 'APP_VERSION = "1.3.2"')
replace_in_file(os.path.join("backend", "core.py"), "CytoCount v1.3.1", "CytoCount v1.3.2")
replace_in_file(os.path.join("backend", "main.py"), "CytoCount v1.3.1", "CytoCount v1.3.2")
replace_in_file(os.path.join("src", "lib", "api.ts"), 'export const APP_VERSION = "1.3.1";', 'export const APP_VERSION = "1.3.2";')
replace_in_file(os.path.join("src", "lib", "i18n.ts"), "Versão 1.3.1", "Versão 1.3.2")
replace_in_file(os.path.join("src", "lib", "i18n.ts"), "version      = {1.3.1}", "version      = {1.3.2}")
replace_in_file(os.path.join("src", "components", "ModalTutorial.tsx"), "CytoCount v1.3.1", "CytoCount v1.3.2")
replace_in_file(os.path.join("src", "components", "NavegadorResultados.tsx"), "CytoCount v1.3.1", "CytoCount v1.3.2")
replace_in_file(os.path.join("tests", "test_api.py"), 'assert data.get("version") == "1.3.1"', 'assert data.get("version") == "1.3.2"')
replace_in_file("CITATION.cff", 'version: "1.3.1"', 'version: "1.3.2"')
replace_in_file("CITATION.cff", "Versão 1.3.1", "Versão 1.3.2")
replace_in_file("LICENSE", "(Versão 1.3.1)", "(Versão 1.3.2)")

for r in ["README.md", "README.en.md", "README.es.md"]:
    replace_in_file(r, "CytoCount_1.3.1_x64-setup.exe", "CytoCount_1.3.2_x64-setup.exe")
    replace_in_file(r, "CytoCount_1.3.1_x64_en-US.msi", "CytoCount_1.3.2_x64_en-US.msi")
    replace_in_file(r, "1.3.1", "1.3.2")

replace_in_file(os.path.join("docs", "index.html"), "v1.3.1", "v1.3.2")
replace_in_file(os.path.join("docs", "index.html"), "Versão 1.3.1", "Versão 1.3.2")
replace_in_file(os.path.join("docs", "index.html"), "CytoCount_1.3.1_x64-setup.exe", "CytoCount_1.3.2_x64-setup.exe")
replace_in_file(os.path.join("docs", "index.html"), "CytoCount_1.3.1_x64_en-US.msi", "CytoCount_1.3.2_x64_en-US.msi")
replace_in_file(os.path.join("docs", "index.html"), "CytoCount_1.3.1_x64_Portable.zip", "CytoCount_1.3.2_x64_Portable.zip")

print("\nTodos os arquivos foram atualizados para 1.3.2 com sucesso!")
