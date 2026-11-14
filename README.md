# CytoCount — Versão 1.1.0

Software científico desktop multiplataforma para contagem automatizada de viabilidade celular por fluorescência (DAPI / Calceína-FITC / Iodeto de Propídio) e segmentação morfológica watershed.

Combina interface escura científica em **React + TypeScript (Vite)**, camada nativa **Rust (Tauri v2)** e motor de visão computacional e bioestatística em **Python (OpenCV, SciPy, scikit-image, Pillow, tifffile, FastAPI)** empacotado como *sidecar*.

---

## Como Citar (Publicações Científicas)

> SANTOS, Gabriel Candido Messias dos. CytoCount: Automated Fluorescence Cell Viability Counter and Morphological Segmenter. Versão 1.1.0. Campinas, 2026.

```bibtex
@software{santos_cytocount_2026,
  author       = {Santos, Gabriel Candido Messias dos},
  title        = {{CytoCount: Automated Fluorescence Cell Viability Counter and Morphological Segmenter}},
  version      = {1.1.0},
  year         = {2026},
  address      = {Campinas}
}
```

---

## Principais Funcionalidades (v1.1.0)

1. **Fonte Única da Verdade & IC 95% de Wilson**:
   - Contagem estritamente consistente em todo o sistema: `Detectados = Vivas + Mortas + Indeterminadas`.
   - Viabilidade reportada com intervalo de confiança binomial de Wilson a 95%, ex.: `91,3% (IC 95%: 90,1–92,4)`.
   - Alerta automático de qualidade quando a fração de células indeterminadas excede 15%.
2. **Curadoria e Edição Manual Interativa**:
   - Alternar classe (`Viva -> Morta -> Indeterminada`), adicionar célula não detectada ou excluir falso positivo diretamente no visualizador, com recálculo ao vivo e histórico `Desfazer / Refazer` (`Ctrl+Z` / `Ctrl+Y`).
   - Registro auditável (`manual_edits`) salvo no projeto `.cytoproj` e no relatório executivo.
3. **Mesclagem de Canais Separados (Merge) & TIFF 16-bit**:
   - Suporte a canais monocromáticos separados (`_DAPI`, `_FITC`, `_PI`, `_C0/_C1/_C2`) e arquivos TIFF multicanal de 16 bits sem perda de faixa dinâmica.
4. **Exportação Científica para Publicação (300 / 600 DPI)**:
   - Exportação em PNG, TIFF, PDF e SVG com metadados físicos de DPI embutidos, barra de escala micrométrica (`µm/pixel`), legenda TrueType acentuada (PT/EN/ES), opção de paleta para daltonismo (Okabe-Ito) e painel `Original | Processada`.
5. **Compatibilidade com ImageJ / Fiji**:
   - Exportação direta de tabela `ImageJ CSV` (`X, Y, Area, Mean, Class`) e `Fiji Macro (.ijm)` com os contornos poligonais das células para o ROI Manager.

---

## Comandos de Desenvolvimento e Empacotamento

```powershell
# 1. Compilar apenas o frontend TypeScript + Vite
npm run build

# 2. Empacotar o sidecar Python via PyInstaller
npm run build:backend

# 3. Gerar o instalador completo (NSIS .exe e .msi)
npx tauri build
```
