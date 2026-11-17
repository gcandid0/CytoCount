import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CelulaIndividual,
  ClasseCelula,
  ManualEdit,
  ROI,
  ResultadoProcessamento,
  salvarArquivoComDialogo,
} from "../lib/api";
import { Idioma, TEXTOS } from "../lib/i18n";
import {
  formatarDecimal,
  formatarInteiro,
  formatarPercentual,
  formatarViabilidadeIC,
} from "../lib/format";
import {
  CropIcon,
  EditIcon,
  FileCodeIcon,
  FileSpreadsheetIcon,
  MaximizeIcon,
  MousePointerIcon,
  PlusCircleIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./Icons";

type ModoAba = "processada" | "original" | "comparar" | "celulas" | "mascaras";
type ModoFerramenta = "pan" | "toggle" | "add" | "delete";
type OrdemCelulas = "id_asc" | "area_desc" | "area_asc" | "verde_desc" | "amarelo_desc" | "mean_desc";

interface SnapshotEdicao {
  tabela: CelulaIndividual[];
  edits: ManualEdit[];
}

export default function NavegadorResultados({
  resultados,
  mostrarMascaras,
  selecionadoId,
  onSelecionar,
  onAplicarROI,
  roiAtivo,
  reprocessandoROI,
  onEditarCelulas,
  onNotificar,
  idioma,
}: {
  resultados: ResultadoProcessamento[];
  mostrarMascaras: boolean;
  selecionadoId?: string;
  onSelecionar: (id: string) => void;
  onAplicarROI?: (roi: ROI | null) => void;
  roiAtivo?: ROI | null;
  reprocessandoROI?: boolean;
  onEditarCelulas?: (
    jobId: string,
    novaTabela: CelulaIndividual[],
    novosEdits: ManualEdit[]
  ) => void;
  onNotificar?: (msg: string, tipo?: "sucesso" | "erro" | "info") => void;
  idioma: Idioma;
}) {
  const t = TEXTOS[idioma];
  const validos = resultados.filter((r) => !r.erro);
  const [modo, setModo] = useState<ModoAba>("processada");
  const [ferramenta, setFerramenta] = useState<ModoFerramenta>("pan");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState(false);
  const [inicioArrasto, setInicioArrasto] = useState({ x: 0, y: 0 });
  const [filtroClasse, setFiltroClasse] = useState<string>("todas");
  const [buscaCelulaId, setBuscaCelulaId] = useState<string>("");
  const [ordemCelulas, setOrdemCelulas] = useState<OrdemCelulas>("id_asc");
  const [celulaDestacadaId, setCelulaDestacadaId] = useState<number | null>(null);
  const [splitPos, setSplitPos] = useState<number>(50);
  const [arrastandoCortina, setArrastandoCortina] = useState(false);

  const atualizarPosicaoCortina = useCallback((clientX: number) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width > 0) {
      const offsetX = clientX - rect.left;
      const pct = Math.max(
        0,
        Math.min(100, Math.round((offsetX / rect.width) * 100))
      );
      setSplitPos(pct);
    }
  }, []);

  const handleCortinaPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setArrastandoCortina(true);
    atualizarPosicaoCortina(e.clientX);
  };

  const handleCortinaPointerMove = (e: React.PointerEvent) => {
    if (!arrastandoCortina) return;
    e.stopPropagation();
    e.preventDefault();
    atualizarPosicaoCortina(e.clientX);
  };

  const handleCortinaPointerUp = (e: React.PointerEvent) => {
    if (arrastandoCortina) {
      e.stopPropagation();
      setArrastandoCortina(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Dimensões naturais da imagem atual (para overlay SVG e conversão de coordenadas)
  const [imgDim, setImgDim] = useState<{ w: number; h: number }>({ w: 1024, h: 1024 });

  // Estado de seleção de ROI
  const [modoROI, setModoROI] = useState(false);
  const [desenhandoROI, setDesenhandoROI] = useState(false);
  const [pontoInicialROI, setPontoInicialROI] = useState<{ nx: number; ny: number } | null>(null);
  const [caixaROINorm, setCaixaROINorm] = useState<{
    nx: number;
    ny: number;
    nw: number;
    nh: number;
  } | null>(null);

  // Pilhas de Undo / Redo por amostra
  const [historicoUndo, setHistoricoUndo] = useState<Record<string, SnapshotEdicao[]>>({});
  const [historicoRedo, setHistoricoRedo] = useState<Record<string, SnapshotEdicao[]>>({});

  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const sel = validos.find((r) => r.id === selecionadoId) ?? validos[0];

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const ajustarAJanela = useCallback(() => {
    setZoom(0.95);
    setPan({ x: 0, y: 0 });
  }, []);

  // Cancela ROI com Esc ou finaliza desenho de ROI mesmo se o mouse sair da área da imagem
  useEffect(() => {
    if (!modoROI && !desenhandoROI && !arrastando) return;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (modoROI || desenhandoROI)) {
        e.preventDefault();
        e.stopPropagation();
        setModoROI(false);
        setDesenhandoROI(false);
        setCaixaROINorm(null);
        setPontoInicialROI(null);
      }
    };

    const handleWindowMouseUp = () => {
      if (arrastando) {
        setArrastando(false);
      }
      if (desenhandoROI) {
        setDesenhandoROI(false);
        if (
          caixaROINorm &&
          imgRef.current &&
          onAplicarROI &&
          caixaROINorm.nw > 0.015 &&
          caixaROINorm.nh > 0.015
        ) {
          const natW = imgRef.current.naturalWidth || imgDim.w;
          const natH = imgRef.current.naturalHeight || imgDim.h;
          const x = Math.max(0, Math.round(caixaROINorm.nx * natW));
          const y = Math.max(0, Math.round(caixaROINorm.ny * natH));
          const w = Math.min(natW - x, Math.round(caixaROINorm.nw * natW));
          const h = Math.min(natH - y, Math.round(caixaROINorm.nh * natH));

          if (w >= 12 && h >= 12) {
            onAplicarROI({ x, y, w, h });
          }
        }
        setModoROI(false);
        setCaixaROINorm(null);
        setPontoInicialROI(null);
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown, true);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown, true);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [modoROI, desenhandoROI, arrastando, caixaROINorm, imgDim, onAplicarROI]);

  const handleUndo = useCallback(() => {
    if (!sel || !onEditarCelulas) return;
    const stack = historicoUndo[sel.id] ?? [];
    if (stack.length === 0) return;

    const anterior = stack[stack.length - 1];
    const atualSnap: SnapshotEdicao = {
      tabela: sel.tabela_celulas ?? [],
      edits: sel.manual_edits ?? [],
    };

    setHistoricoUndo((prev) => ({ ...prev, [sel.id]: stack.slice(0, -1) }));
    setHistoricoRedo((prev) => ({
      ...prev,
      [sel.id]: [...(prev[sel.id] ?? []), atualSnap],
    }));

    onEditarCelulas(sel.id, anterior.tabela, anterior.edits);
  }, [sel, historicoUndo, onEditarCelulas]);

  const handleRedo = useCallback(() => {
    if (!sel || !onEditarCelulas) return;
    const stack = historicoRedo[sel.id] ?? [];
    if (stack.length === 0) return;

    const proximo = stack[stack.length - 1];
    const atualSnap: SnapshotEdicao = {
      tabela: sel.tabela_celulas ?? [],
      edits: sel.manual_edits ?? [],
    };

    setHistoricoRedo((prev) => ({ ...prev, [sel.id]: stack.slice(0, -1) }));
    setHistoricoUndo((prev) => ({
      ...prev,
      [sel.id]: [...(prev[sel.id] ?? []), atualSnap],
    }));

    onEditarCelulas(sel.id, proximo.tabela, proximo.edits);
  }, [sel, historicoRedo, onEditarCelulas]);

  // Atalhos Ctrl+Z e Ctrl+Y para edição manual de células
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
      } else if (!e.ctrlKey && !e.metaKey && (e.key === "+" || e.key === "=")) {
        setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))));
      } else if (!e.ctrlKey && !e.metaKey && e.key === "-") {
        setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  if (!sel) return null;

  const celulas = sel.tabela_celulas ?? [];
  const editsAtuais = sel.manual_edits ?? [];
  const undoDisponivel = (historicoUndo[sel.id]?.length ?? 0) > 0;
  const redoDisponivel = (historicoRedo[sel.id]?.length ?? 0) > 0;

  const registrarEdicaoManual = (
    novaTabela: CelulaIndividual[],
    novoEdit: ManualEdit
  ) => {
    if (!onEditarCelulas) return;
    const snapAtual: SnapshotEdicao = {
      tabela: celulas.map((c) => ({ ...c })),
      edits: [...editsAtuais],
    };
    setHistoricoUndo((prev) => ({
      ...prev,
      [sel.id]: [...(prev[sel.id] ?? []).slice(-30), snapAtual],
    }));
    setHistoricoRedo((prev) => ({ ...prev, [sel.id]: [] }));

    const novosEdits = [...editsAtuais, novoEdit];
    onEditarCelulas(sel.id, novaTabela, novosEdits);
  };

  const obterPontoNormalizado = (e: React.MouseEvent): { nx: number; ny: number } | null => {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { nx, ny };
  };

  const handleCliqueImagemParaEdicao = (e: React.MouseEvent) => {
    if (modoROI || ferramenta === "pan" || (modo !== "processada" && modo !== "original")) {
      return;
    }
    const p = obterPontoNormalizado(e);
    if (!p || !imgRef.current) return;
    const natW = imgRef.current.naturalWidth || imgDim.w;
    const natH = imgRef.current.naturalHeight || imgDim.h;
    const clickX = Math.round(p.nx * natW);
    const clickY = Math.round(p.ny * natH);

    if (ferramenta === "add") {
      const novoId =
        celulas.reduce((max, c) => Math.max(max, c.celula_id), 0) + 1;
      const raioPadrao = 7;
      const ptsCirculo: number[][] = [];
      for (let k = 0; k < 12; k++) {
        const ang = (2 * Math.PI * k) / 12;
        ptsCirculo.push([
          Math.round(clickX + raioPadrao * Math.cos(ang)),
          Math.round(clickY + raioPadrao * Math.sin(ang)),
        ]);
      }
      const novaCelula: CelulaIndividual = {
        celula_id: novoId,
        area_px: Math.round(Math.PI * raioPadrao * raioPadrao),
        centro_x: clickX,
        centro_y: clickY,
        raio_eq: raioPadrao,
        mean_intensity: 180,
        cobertura_verde_pct: 100,
        cobertura_amarela_pct: 0,
        classificacao: "viavel",
        contorno_pts: ptsCirculo,
        manual: true,
      };
      registrarEdicaoManual([...celulas, novaCelula], {
        timestamp: new Date().toISOString(),
        tipo: "adicionar_celula",
        celula_id: novoId,
        centro_x: clickX,
        centro_y: clickY,
        classe_nova: "viavel",
      });
      return;
    }

    // Para toggle ou delete: encontra a célula mais próxima do clique (dentro de um raio de tolerância)
    let maisProxima: CelulaIndividual | null = null;
    let menorDist = Infinity;
    for (const c of celulas) {
      const dx = c.centro_x - clickX;
      const dy = c.centro_y - clickY;
      const dist = Math.hypot(dx, dy);
      const raioTol = Math.max(14, (c.raio_eq ?? 8) * 1.8);
      if (dist <= raioTol && dist < menorDist) {
        menorDist = dist;
        maisProxima = c;
      }
    }

    if (!maisProxima) return;

    if (ferramenta === "delete") {
      const novaTabela = celulas.filter((c) => c.celula_id !== maisProxima!.celula_id);
      registrarEdicaoManual(novaTabela, {
        timestamp: new Date().toISOString(),
        tipo: "excluir_celula",
        celula_id: maisProxima.celula_id,
        centro_x: maisProxima.centro_x,
        centro_y: maisProxima.centro_y,
        classe_anterior: maisProxima.classificacao,
      });
    } else if (ferramenta === "toggle") {
      const ordem: ClasseCelula[] = ["viavel", "morta", "indeterminada"];
      const idxAtual = ordem.indexOf(maisProxima.classificacao);
      const novaClasse = ordem[(idxAtual + 1) % ordem.length];
      const novaTabela = celulas.map((c) =>
        c.celula_id === maisProxima!.celula_id
          ? { ...c, classificacao: novaClasse, manual: true }
          : c
      );
      registrarEdicaoManual(novaTabela, {
        timestamp: new Date().toISOString(),
        tipo: "alterar_classe",
        celula_id: maisProxima.celula_id,
        centro_x: maisProxima.centro_x,
        centro_y: maisProxima.centro_y,
        classe_anterior: maisProxima.classificacao,
        classe_nova: novaClasse,
      });
    }
  };

  // Exportação ImageJ CSV (Results Table) com diálogo nativo "Salvar como"
  const exportarImageJCSV = async () => {
    try {
      const ehCito = sel.relatorio["Tipo de Análise"] === "citoplasma";
      const header = ehCito
        ? " ,X,Y,Nucleus_Area,Cytoplasm_Area,Total_Area,NC_Ratio,Mean_Intensity,Status\n"
        : " ,X,Y,Area,Cytoplasm_Area,Mean,Class,Green_Pct,Yellow_Pct\n";
      const rows = celulas
        .map((c, idx) => {
          const mean = c.mean_intensity ?? Number(((c.cobertura_verde_pct + c.cobertura_amarela_pct) * 1.27).toFixed(1));
          const citoArea = c.area_citoplasma_px ?? 0;
          if (ehCito) {
            const totArea = c.area_total_px ?? (c.area_px + citoArea);
            const nc = c.razao_nc ?? (citoArea > 0 ? Number((c.area_px / citoArea).toFixed(2)) : "");
            return `${idx + 1},${c.centro_x},${c.centro_y},${c.area_px},${citoArea},${totArea},${nc},${mean},${c.classificacao}`;
          }
          return `${idx + 1},${c.centro_x},${c.centro_y},${c.area_px},${citoArea},${mean},${c.classificacao},${c.cobertura_verde_pct},${c.cobertura_amarela_pct}`;
        })
        .join("\n");
      const nomeBase = sel.relatorio.Arquivo.replace(/\.[^.]+$/, "");
      const salvo = await salvarArquivoComDialogo(
        `${nomeBase}_ImageJ_Results.csv`,
        header + rows,
        false,
        "ImageJ CSV Results (*.csv)",
        "csv"
      );
      if (salvo) {
        onNotificar?.(`${t.toast_saved_at} ${salvo}`, "sucesso");
      }
    } catch (e) {
      onNotificar?.(`Erro ao exportar ImageJ CSV: ${e}`, "erro");
    }
  };

  // Exportação Macro Fiji (.ijm) com contornos poligonais reais e diálogo "Salvar como"
  const exportarMacroFiji = async () => {
    try {
      const linhas = [
        `// CytoCount v1.3.2 - Fiji / ImageJ ROI Manager Macro`,
        `// Sample: ${sel.relatorio.Arquivo} | Total Detected: ${celulas.length}`,
        `roiManager("Reset");`,
        `setBatchMode(true);`,
      ];
      celulas.forEach((c) => {
        const cor =
          c.classificacao === "viavel"
            ? "#34d399"
            : c.classificacao === "morta"
            ? "#fbbf24"
            : "#60a5fa";
        if (c.contorno_pts && c.contorno_pts.length >= 3) {
          const xs = c.contorno_pts.map((pt) => pt[0]).join(",");
          const ys = c.contorno_pts.map((pt) => pt[1]).join(",");
          linhas.push(`makePolygon(${xs},${ys});`);
        } else {
          const r = Math.max(3, Math.round(c.raio_eq ?? Math.sqrt(c.area_px / Math.PI)));
          linhas.push(`makeOval(${c.centro_x - r}, ${c.centro_y - r}, ${r * 2}, ${r * 2});`);
        }
        linhas.push(`Roi.setName("Cell_${c.celula_id}_nucleus_${c.classificacao}");`);
        linhas.push(`Roi.setStrokeColor("#60a5fa");`);
        linhas.push(`Roi.setStrokeWidth(1.2);`);
        linhas.push(`roiManager("Add");`);

        if (c.contorno_citoplasma_pts && c.contorno_citoplasma_pts.length >= 3) {
          const cxs = c.contorno_citoplasma_pts.map((pt) => pt[0]).join(",");
          const cys = c.contorno_citoplasma_pts.map((pt) => pt[1]).join(",");
          linhas.push(`makePolygon(${cxs},${cys});`);
          linhas.push(`Roi.setName("Cell_${c.celula_id}_cytoplasm_${c.classificacao}");`);
          linhas.push(`Roi.setStrokeColor("${cor}");`);
          linhas.push(`Roi.setStrokeWidth(1.6);`);
          linhas.push(`roiManager("Add");`);
        }
      });
      linhas.push(`setBatchMode(false);`);
      linhas.push(`roiManager("Show All without labels");`);

      const nomeBase = sel.relatorio.Arquivo.replace(/\.[^.]+$/, "");
      const salvo = await salvarArquivoComDialogo(
        `${nomeBase}_Fiji_ROIs.ijm`,
        linhas.join("\n"),
        false,
        "Fiji / ImageJ Macro (*.ijm)",
        "ijm"
      );
      if (salvo) {
        onNotificar?.(`${t.toast_saved_at} ${salvo}`, "sucesso");
      }
    } catch (e) {
      onNotificar?.(`Erro ao exportar Fiji Macro: ${e}`, "erro");
    }
  };

  const celulasFiltradas = useMemo(() => {
    let lista =
      filtroClasse === "todas"
        ? [...celulas]
        : celulas.filter((c) => c.classificacao === filtroClasse);

    if (buscaCelulaId.trim() !== "") {
      const q = buscaCelulaId.trim().replace(/^#/, "");
      lista = lista.filter((c) => String(c.celula_id).includes(q));
    }

    lista.sort((a, b) => {
      if (ordemCelulas === "area_desc") return b.area_px - a.area_px;
      if (ordemCelulas === "area_asc") return a.area_px - b.area_px;
      if (ordemCelulas === "verde_desc") return b.cobertura_verde_pct - a.cobertura_verde_pct;
      if (ordemCelulas === "amarelo_desc") return b.cobertura_amarela_pct - a.cobertura_amarela_pct;
      if (ordemCelulas === "mean_desc") return (b.mean_intensity ?? 0) - (a.mean_intensity ?? 0);
      return a.celula_id - b.celula_id;
    });

    return lista;
  }, [celulas, filtroClasse, buscaCelulaId, ordemCelulas]);

  const statsMorfologicas = useMemo(() => {
    if (celulasFiltradas.length === 0) {
      return { areaMedia: 0, areaDP: 0, areaCitoMedia: 0, raioMedio: 0, meanInt: 0 };
    }
    const n = celulasFiltradas.length;
    const areas = celulasFiltradas.map((c) => c.area_px).sort((a, b) => a - b);
    const somaArea = areas.reduce((s, v) => s + v, 0);
    const areaMedia = somaArea / n;
    const variancia = areas.reduce((s, v) => s + (v - areaMedia) ** 2, 0) / n;
    const areaDP = Math.sqrt(variancia);
    const areaCitoMedia =
      celulasFiltradas.reduce((s, c) => s + (c.area_citoplasma_px ?? 0), 0) / n;
    const raioMedio =
      celulasFiltradas.reduce(
        (s, c) => s + (c.raio_eq ?? Math.sqrt(c.area_px / Math.PI)),
        0
      ) / n;
    const meanInt =
      celulasFiltradas.reduce((s, c) => s + (c.mean_intensity ?? 0), 0) / n;
    return { areaMedia, areaDP, areaCitoMedia, raioMedio, meanInt };
  }, [celulasFiltradas]);

  const celulaDestacada = useMemo(
    () =>
      celulaDestacadaId !== null
        ? celulas.find((c) => c.celula_id === celulaDestacadaId) ?? null
        : null,
    [celulas, celulaDestacadaId]
  );

  const detectados = sel.relatorio.Detectados ?? sel.relatorio["Total (Azul)"] ?? 0;
  const vivas = sel.relatorio["Viáveis (Verde)"] ?? 0;
  const mortas = sel.relatorio["Mortas (Amarelo)"] ?? 0;
  const indeterminadas =
    sel.relatorio.Indeterminadas ?? Math.max(0, detectados - vivas - mortas);
  const pctVivas =
    sel.relatorio["Pct Viáveis (%)"] ??
    (detectados > 0 ? (vivas / detectados) * 100 : 0);
  const pctMortas =
    sel.relatorio["Pct Mortas (%)"] ??
    (detectados > 0 ? (mortas / detectados) * 100 : 0);
  const pctIndet =
    sel.relatorio["Pct Indeterminadas (%)"] ??
    (detectados > 0 ? (indeterminadas / detectados) * 100 : 0);
  const viab = sel.relatorio["Viabilidade (%)"] ?? 0;
  const icBaixo = sel.relatorio["IC 95% Baixo"] ?? 0;
  const icAlto = sel.relatorio["IC 95% Alto"] ?? 0;
  const viabFormatada = formatarViabilidadeIC(viab, icBaixo, icAlto, idioma);

  const cursorViewer = modoROI
    ? "crosshair"
    : ferramenta === "add"
    ? "crosshair"
    : ferramenta === "toggle"
    ? "pointer"
    : ferramenta === "delete"
    ? "not-allowed"
    : zoom > 1
    ? arrastando
      ? "grabbing"
      : "grab"
    : "default";

  return (
    <div className="viewer">
      <div className="viewer-sidebar">
        <h3 className="viewer-title">{t.title_results}</h3>
        <ul className="sample-list">
          {validos.map((r) => {
            const ehCito = r.relatorio["Tipo de Análise"] === "citoplasma";
            const vSample = ehCito
              ? r.relatorio["Pct Com Citoplasma (%)"] ?? 0
              : r.relatorio["Viabilidade (%)"] ?? 0;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`sample-item${r.id === sel.id ? " active" : ""}`}
                  onClick={() => {
                    onSelecionar(r.id);
                    resetZoom();
                  }}
                  title={r.relatorio.Arquivo}
                >
                  <span className="sample-meta">
                    <span className="sample-name">{r.relatorio.Arquivo}</span>
                    <span className="sample-via">
                      {formatarPercentual(vSample, idioma, 1)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="viewer-main">
        <div className="viewer-header">
          {sel.relatorio["Tipo de Análise"] === "citoplasma" ? (
            <div className="viewer-metrics">
              <div className="metric metric-blue">
                <span className="metric-value">
                  {formatarInteiro(detectados, idioma)}
                </span>
                <span className="metric-label">{t.card_detected}</span>
              </div>
              <div className="metric metric-green">
                <span className="metric-value">
                  {formatarInteiro(sel.relatorio["Com Citoplasma"] ?? 0, idioma)}{" "}
                  <small className="metric-pct">
                    ({formatarPercentual(sel.relatorio["Pct Com Citoplasma (%)"] ?? 0, idioma, 1)})
                  </small>
                </span>
                <span className="metric-label">{t.card_with_cytoplasm}</span>
              </div>
              <div className="metric metric-green">
                <span className="metric-value">
                  {formatarDecimal(sel.relatorio["Área Média Citoplasma (px²)"] ?? 0, idioma, 1)}{" "}
                  <small className="metric-pct">px²</small>
                </span>
                <span className="metric-label">{t.card_cyto_area}</span>
              </div>
              <div className="metric metric-blue">
                <span className="metric-value">
                  {formatarDecimal(sel.relatorio["Área Média Núcleo (px²)"] ?? 0, idioma, 1)}{" "}
                  <small className="metric-pct">px²</small>
                </span>
                <span className="metric-label">{t.card_nuc_area}</span>
              </div>
              <div className="metric metric-viab">
                <span className="metric-value metric-value-ic">
                  {formatarDecimal(sel.relatorio["Razão N:C Média"] ?? 0, idioma, 2)}
                </span>
                <span className="metric-label">{t.card_nc_ratio}</span>
              </div>
            </div>
          ) : (
            <div className="viewer-metrics">
              <div className="metric metric-blue">
                <span className="metric-value">
                  {formatarInteiro(detectados, idioma)}
                </span>
                <span className="metric-label">{t.card_detected}</span>
              </div>
              <div className="metric metric-green">
                <span className="metric-value">
                  {formatarInteiro(vivas, idioma)}{" "}
                  <small className="metric-pct">
                    ({formatarPercentual(pctVivas, idioma, 1)})
                  </small>
                </span>
                <span className="metric-label">{t.card_live}</span>
              </div>
              <div className="metric metric-yellow">
                <span className="metric-value">
                  {formatarInteiro(mortas, idioma)}{" "}
                  <small className="metric-pct">
                    ({formatarPercentual(pctMortas, idioma, 1)})
                  </small>
                </span>
                <span className="metric-label">{t.card_dead}</span>
              </div>
              <div className="metric metric-muted">
                <span className="metric-value">
                  {formatarInteiro(indeterminadas, idioma)}{" "}
                  <small className="metric-pct">
                    ({formatarPercentual(pctIndet, idioma, 1)})
                  </small>
                </span>
                <span className="metric-label">{t.card_undetermined}</span>
              </div>
              <div className="metric metric-viab">
                <span className="metric-value metric-value-ic">{viabFormatada}</span>
                <span className="metric-label">{t.card_viability}</span>
              </div>
            </div>
          )}

          <div className="view-toggle">
            <button
              type="button"
              className={modo === "processada" ? "active" : ""}
              onClick={() => setModo("processada")}
            >
              {t.tab_processed}
            </button>
            <button
              type="button"
              className={modo === "original" ? "active" : ""}
              onClick={() => setModo("original")}
            >
              {t.tab_original}
            </button>
            <button
              type="button"
              className={modo === "comparar" ? "active" : ""}
              onClick={() => {
                setModo("comparar");
                setModoROI(false);
                setFerramenta("pan");
              }}
              title="Comparar imagem Original e Processada com cortina deslizante A|B"
            >
              {idioma === "en" ? "Compare A|B" : idioma === "es" ? "Comparar A|B" : "Comparar A|B"}
            </button>
            <button
              type="button"
              className={modo === "celulas" ? "active" : ""}
              onClick={() => setModo("celulas")}
              title={t.tab_cells_tooltip}
            >
              {t.tab_cells} ({formatarInteiro(celulas.length, idioma)})
            </button>
            {mostrarMascaras && (
              <button
                type="button"
                className={modo === "mascaras" ? "active" : ""}
                onClick={() => setModo("mascaras")}
              >
                {t.tab_masks}
              </button>
            )}
          </div>
        </div>

        {(modo === "processada" || modo === "original" || modo === "comparar") && (
          <div className="viewer-toolbar">
            {/* Controle Único de Zoom */}
            <div className="zoom-segmented" role="group" aria-label="Zoom">
              <button
                type="button"
                className="zoom-seg-btn"
                title={t.zoom_out_tip}
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
              >
                <ZoomOutIcon size={14} />
              </button>
              <span className="zoom-seg-value">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="zoom-seg-btn"
                title={t.zoom_in_tip}
                onClick={() => setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))))}
              >
                <ZoomInIcon size={14} />
              </button>
              <button
                type="button"
                className="zoom-seg-btn zoom-seg-text"
                title={t.zoom_fit_tip}
                onClick={ajustarAJanela}
              >
                <MaximizeIcon size={12} />
                <span>{t.zoom_fit_label}</span>
              </button>
              <button
                type="button"
                className="zoom-seg-btn zoom-seg-text"
                title={t.zoom_100_tip}
                onClick={resetZoom}
              >
                100%
              </button>
            </div>

            {/* Botão e Indicador de ROI */}
            <div className="roi-controls-group">
              {onAplicarROI && (
                <button
                  type="button"
                  disabled={reprocessandoROI}
                  className={`btn btn-secondary btn-sm roi-btn${modoROI ? " active" : ""}`}
                  onClick={() => {
                    const proximo = !modoROI;
                    setModoROI(proximo);
                    setDesenhandoROI(false);
                    setCaixaROINorm(null);
                    setPontoInicialROI(null);
                    if (proximo) {
                      resetZoom();
                      setFerramenta("pan");
                    }
                  }}
                >
                  <CropIcon size={14} />
                  <span>
                    {reprocessandoROI
                      ? t.btn_processing
                      : modoROI
                      ? t.roi_cancel_btn
                      : t.roi_select_btn}
                  </span>
                </button>
              )}

              {roiAtivo && onAplicarROI && (
                <div className="roi-active-pill">
                  <span className="roi-active-label">
                    {t.roi_active_badge}: {roiAtivo.w}×{roiAtivo.h}px
                  </span>
                  <button
                    type="button"
                    className="roi-clear-inline"
                    onClick={() => onAplicarROI(null)}
                    title={t.roi_clear_btn}
                  >
                    <XIcon size={12} />
                    <span>{t.roi_clear_btn}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Barra de Edição Manual de Células */}
            <div className="manual-edit-toolbar">
              <span className="edit-toolbar-title">{t.edit_toolbar_label}</span>
              <button
                type="button"
                className={`edit-tool-btn${ferramenta === "pan" && !modoROI ? " active" : ""}`}
                onClick={() => {
                  setFerramenta("pan");
                  setModoROI(false);
                }}
                title={t.edit_mode_pan_tip}
              >
                <MousePointerIcon size={13} />
                <span>{t.edit_mode_pan}</span>
              </button>
              <button
                type="button"
                className={`edit-tool-btn tool-toggle${ferramenta === "toggle" ? " active" : ""}`}
                onClick={() => {
                  setFerramenta("toggle");
                  setModoROI(false);
                }}
                title={t.edit_mode_toggle_tip}
              >
                <EditIcon size={13} />
                <span>{t.edit_mode_toggle}</span>
              </button>
              <button
                type="button"
                className={`edit-tool-btn tool-add${ferramenta === "add" ? " active" : ""}`}
                onClick={() => {
                  setFerramenta("add");
                  setModoROI(false);
                }}
                title={t.edit_mode_add_tip}
              >
                <PlusCircleIcon size={13} />
                <span>{t.edit_mode_add}</span>
              </button>
              <button
                type="button"
                className={`edit-tool-btn tool-delete${ferramenta === "delete" ? " active" : ""}`}
                onClick={() => {
                  setFerramenta("delete");
                  setModoROI(false);
                }}
                title={t.edit_mode_delete_tip}
              >
                <TrashIcon size={13} />
                <span>{t.edit_mode_delete}</span>
              </button>

              <div className="edit-undo-group">
                <button
                  type="button"
                  className="edit-icon-btn"
                  disabled={!undoDisponivel}
                  onClick={handleUndo}
                  title={t.edit_undo_tip}
                >
                  <UndoIcon size={14} />
                </button>
                <button
                  type="button"
                  className="edit-icon-btn"
                  disabled={!redoDisponivel}
                  onClick={handleRedo}
                  title={t.edit_redo_tip}
                >
                  <RedoIcon size={14} />
                </button>
              </div>

              {editsAtuais.length > 0 && (
                <span className="manual-edits-badge">
                  {editsAtuais.length} {t.edit_badge_count}
                </span>
              )}
            </div>

            {/* Botões rápidos Fiji / ImageJ */}
            <div className="fiji-export-group">
              <button
                type="button"
                className="btn btn-secondary btn-sm fiji-btn"
                onClick={exportarImageJCSV}
                title="Salvar tabela de resultados compatível com ImageJ/Fiji (X, Y, Area, Mean, Class)"
              >
                <FileSpreadsheetIcon size={14} />
                <span>ImageJ CSV</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm fiji-btn"
                onClick={exportarMacroFiji}
                title="Salvar Macro .ijm que desenha todas as ROIs no Fiji/ImageJ"
              >
                <FileCodeIcon size={14} />
                <span>Fiji Macro (.ijm)</span>
              </button>
            </div>
          </div>
        )}

        {modoROI && (
          <div className="roi-instruction-bar">
            <CropIcon size={14} />
            <span>{t.roi_hint}</span>
          </div>
        )}

        {modo === "comparar" && (
          <div className="split-compare-bar">
            <span className="split-compare-label">
              <b>A · {t.tab_original}</b> ({splitPos}%)
            </span>
            <input
              type="range"
              className="range split-compare-slider"
              min={0}
              max={100}
              value={splitPos}
              onChange={(e) => setSplitPos(Number(e.target.value))}
              aria-label="Posição da cortina de comparação"
            />
            <span className="split-compare-label">
              <b>B · {t.tab_processed}</b> ({100 - splitPos}%)
            </span>
          </div>
        )}

        {celulaDestacada && (modo === "processada" || modo === "original") && (
          <div className="cell-highlight-banner">
            <span>
              Destacando célula <b>#{celulaDestacada.celula_id}</b> — X:{" "}
              {celulaDestacada.centro_x}px, Y: {celulaDestacada.centro_y}px, Área:{" "}
              {celulaDestacada.area_px}px² ({celulaDestacada.classificacao})
            </span>
            <button
              type="button"
              className="roi-clear-inline"
              onClick={() => setCelulaDestacadaId(null)}
            >
              <XIcon size={12} />
              <span>Limpar destaque</span>
            </button>
          </div>
        )}

        <div
          ref={wrapRef}
          className="viewer-image-wrap"
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            if (modoROI) {
              const p = obterPontoNormalizado(e);
              if (!p) return;
              setDesenhandoROI(true);
              setPontoInicialROI(p);
              setCaixaROINorm({ nx: p.nx, ny: p.ny, nw: 0, nh: 0 });
              return;
            }
            if (ferramenta !== "pan") {
              handleCliqueImagemParaEdicao(e);
              return;
            }
            if (zoom > 1) {
              setArrastando(true);
              setInicioArrasto({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            }
          }}
          onMouseMove={(e) => {
            if (desenhandoROI && pontoInicialROI) {
              const p = obterPontoNormalizado(e);
              if (!p) return;
              const nx = Math.min(pontoInicialROI.nx, p.nx);
              const ny = Math.min(pontoInicialROI.ny, p.ny);
              const nw = Math.abs(p.nx - pontoInicialROI.nx);
              const nh = Math.abs(p.ny - pontoInicialROI.ny);
              setCaixaROINorm({ nx, ny, nw, nh });
              return;
            }
            if (arrastando) {
              setPan({ x: e.clientX - inicioArrasto.x, y: e.clientY - inicioArrasto.y });
            }
          }}
          style={{ cursor: cursorViewer }}
        >
          {(modo === "processada" || modo === "original") && (
            <div
              className="viewer-canvas-stage"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: arrastando || desenhandoROI ? "none" : "transform 0.1s ease-out",
              }}
            >
              <img
                ref={imgRef}
                className="viewer-image"
                src={`data:image/png;base64,${
                  modo === "processada" ? sel.processada_png_b64 : sel.original_png_b64
                }`}
                alt={`${modo} - ${sel.relatorio.Arquivo}`}
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  if (el.naturalWidth && el.naturalHeight) {
                    setImgDim({ w: el.naturalWidth, h: el.naturalHeight });
                  }
                }}
              />

              {/* Camada vetorial interativa para destacar células em modo de edição manual */}
              {ferramenta !== "pan" && !modoROI && (
                <svg
                  className="viewer-cells-svg-overlay"
                  viewBox={`0 0 ${imgDim.w} ${imgDim.h}`}
                  preserveAspectRatio="none"
                >
                  {celulas.map((c) => {
                    const stroke =
                      c.classificacao === "viavel" || c.classificacao === "com_citoplasma"
                        ? "#34d399"
                        : c.classificacao === "morta"
                        ? "#fbbf24"
                        : "#60a5fa";
                    const r = Math.max(5, c.raio_eq ?? 7);
                    return (
                      <g key={c.celula_id} className="cell-interactive-marker">
                        <circle
                          cx={c.centro_x}
                          cy={c.centro_y}
                          r={r + 2}
                          fill="transparent"
                          stroke={stroke}
                          strokeWidth={c.manual ? 2.2 : 1.2}
                          strokeDasharray={c.manual ? "none" : "2,2"}
                        />
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Marcador de célula destacada a partir da aba Mapa de Células */}
              {celulaDestacada && (
                <svg
                  className="viewer-cells-svg-overlay"
                  viewBox={`0 0 ${imgDim.w} ${imgDim.h}`}
                  preserveAspectRatio="none"
                >
                  <g className="cell-target-marker">
                    <circle
                      cx={celulaDestacada.centro_x}
                      cy={celulaDestacada.centro_y}
                      r={Math.max(16, (celulaDestacada.raio_eq ?? 8) * 2.4)}
                      fill="rgba(56, 189, 248, 0.16)"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                    />
                    <circle
                      cx={celulaDestacada.centro_x}
                      cy={celulaDestacada.centro_y}
                      r={Math.max(8, (celulaDestacada.raio_eq ?? 8) * 1.2)}
                      fill="transparent"
                      stroke="#ffffff"
                      strokeWidth={1.6}
                      strokeDasharray="3,2"
                    />
                  </g>
                </svg>
              )}

              {caixaROINorm && (
                <div
                  className="roi-selection-box"
                  style={{
                    left: `${caixaROINorm.nx * 100}%`,
                    top: `${caixaROINorm.ny * 100}%`,
                    width: `${caixaROINorm.nw * 100}%`,
                    height: `${caixaROINorm.nh * 100}%`,
                  }}
                >
                  {imgRef.current && (
                    <span className="roi-dimensions-tag">
                      {Math.round(caixaROINorm.nw * imgRef.current.naturalWidth)} ×{" "}
                      {Math.round(caixaROINorm.nh * imgRef.current.naturalHeight)} px
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {modo === "comparar" && (
            <div
              className="viewer-canvas-stage viewer-split-stage"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: arrastando ? "none" : "transform 0.1s ease-out",
              }}
            >
              <img
                ref={imgRef}
                className="viewer-image"
                src={`data:image/png;base64,${sel.processada_png_b64}`}
                alt={`Processada - ${sel.relatorio.Arquivo}`}
                draggable={false}
              />
              <img
                className="viewer-image viewer-image-overlay-left"
                src={`data:image/png;base64,${sel.original_png_b64}`}
                alt={`Original - ${sel.relatorio.Arquivo}`}
                draggable={false}
                style={{
                  clipPath: `inset(0 ${100 - splitPos}% 0 0)`,
                }}
              />

              {/* Badges indicativas flutuantes dos lados A e B */}
              <div className="split-curtain-pill-left">
                A · {t.tab_original} ({splitPos}%)
              </div>
              <div className="split-curtain-pill-right">
                B · {t.tab_processed} ({100 - splitPos}%)
              </div>

              {/* Linha da cortina interativa com arrasto suave direto */}
              <div
                className={`split-curtain-line ${arrastandoCortina ? "active" : ""}`}
                style={{ left: `${splitPos}%` }}
                onPointerDown={handleCortinaPointerDown}
                onPointerMove={handleCortinaPointerMove}
                onPointerUp={handleCortinaPointerUp}
                onPointerCancel={handleCortinaPointerUp}
                onDoubleClick={() => setSplitPos(50)}
                title="Clique e arraste para comparar Original e Processada. Dê dois cliques para centralizar."
              >
                <div className="split-curtain-handle">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginLeft: -8 }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {modo === "celulas" && (
            <div className="cells-inspector">
              {/* Resumo Morfológico da População Filtrada */}
              <div className="cells-morph-summary">
                <div className="morph-stat-pill">
                  <span className="morph-stat-label">Área Média ± DP</span>
                  <span className="morph-stat-val">
                    {formatarDecimal(statsMorfologicas.areaMedia, idioma, 1)} ±{" "}
                    {formatarDecimal(statsMorfologicas.areaDP, idioma, 1)} px²
                  </span>
                </div>
                <div className="morph-stat-pill">
                  <span className="morph-stat-label">Área Citoplasma Média</span>
                  <span className="morph-stat-val">
                    {formatarDecimal(statsMorfologicas.areaCitoMedia, idioma, 1)} px²
                  </span>
                </div>
                <div className="morph-stat-pill">
                  <span className="morph-stat-label">Raio Equiv. Médio</span>
                  <span className="morph-stat-val">
                    {formatarDecimal(statsMorfologicas.raioMedio, idioma, 1)} px
                  </span>
                </div>
                <div className="morph-stat-pill">
                  <span className="morph-stat-label">Intensidade Média</span>
                  <span className="morph-stat-val">
                    {formatarDecimal(statsMorfologicas.meanInt, idioma, 1)}
                  </span>
                </div>
              </div>

              <div className="cells-inspector-bar">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span>
                    {t.tab_cells}: <b>{formatarInteiro(celulasFiltradas.length, idioma)}</b>
                  </span>
                  <input
                    type="text"
                    className="input cells-search-input"
                    placeholder="Buscar #ID..."
                    value={buscaCelulaId}
                    onChange={(e) => setBuscaCelulaId(e.target.value)}
                  />
                  <select
                    className="select cells-sort-select"
                    value={ordemCelulas}
                    onChange={(e) => setOrdemCelulas(e.target.value as OrdemCelulas)}
                  >
                    <option value="id_asc">Ordenar: #ID ↑</option>
                    <option value="area_desc">Ordenar: Maior Área ↓</option>
                    <option value="area_asc">Ordenar: Menor Área ↑</option>
                    <option value="verde_desc">Ordenar: Maior Verde (%) ↓</option>
                    <option value="amarelo_desc">Ordenar: Maior Amarelo (%) ↓</option>
                    <option value="mean_desc">Ordenar: Maior Intensidade ↓</option>
                  </select>
                </div>
                <div className="cells-filter-group">
                  {sel.relatorio["Tipo de Análise"] === "citoplasma" ? (
                    (["todas", "com_citoplasma", "sem_citoplasma"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`filter-pill ${filtroClasse === f ? "active" : ""}`}
                        onClick={() => setFiltroClasse(f)}
                      >
                        {f === "todas"
                          ? "Todas"
                          : f === "com_citoplasma"
                          ? t.card_with_cytoplasm
                          : t.card_without_cytoplasm}
                      </button>
                    ))
                  ) : (
                    (["todas", "viavel", "morta", "indeterminada"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`filter-pill ${filtroClasse === f ? "active" : ""}`}
                        onClick={() => setFiltroClasse(f)}
                      >
                        {f === "todas"
                          ? "Todas"
                          : f === "viavel"
                          ? t.card_live
                          : f === "morta"
                          ? t.card_dead
                          : t.card_undetermined}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="cells-table-scroll">
                <table className="report-table">
                  <thead>
                    {sel.relatorio["Tipo de Análise"] === "citoplasma" ? (
                      <tr>
                        <th>ID</th>
                        <th>Status</th>
                        <th className="num">X (px)</th>
                        <th className="num">Y (px)</th>
                        <th className="num">Núcleo (px²)</th>
                        <th className="num">Citoplasma (px²)</th>
                        <th className="num">Total (px²)</th>
                        <th className="num">Mean</th>
                        <th className="num">Razão N:C</th>
                      </tr>
                    ) : (
                      <tr>
                        <th>ID</th>
                        <th>Status</th>
                        <th className="num">X (px)</th>
                        <th className="num">Y (px)</th>
                        <th className="num">Núcleo (px²)</th>
                        <th className="num">Citoplasma (px²)</th>
                        <th className="num">Mean</th>
                        <th className="num">Verde (%)</th>
                        <th className="num">Amarelo (%)</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {celulasFiltradas.slice(0, 600).map((c) => (
                      <tr
                        key={c.celula_id}
                        className={celulaDestacadaId === c.celula_id ? "selected" : ""}
                        style={{ cursor: "pointer" }}
                        title="Clique para localizar e destacar esta célula na imagem"
                        onClick={() => {
                          setCelulaDestacadaId(c.celula_id);
                          setModo("processada");
                        }}
                      >
                        <td className="num">
                          #{c.celula_id} {c.manual ? "*" : ""}
                        </td>
                        <td>
                          {sel.relatorio["Tipo de Análise"] === "citoplasma" ? (
                            <span
                              className={`cell-badge ${
                                c.classificacao === "com_citoplasma"
                                  ? "badge-viavel"
                                  : "badge-indeterminada"
                              }`}
                            >
                              {c.classificacao === "com_citoplasma"
                                ? t.card_with_cytoplasm
                                : t.card_without_cytoplasm}
                            </span>
                          ) : (
                            <span className={`cell-badge badge-${c.classificacao}`}>
                              {c.classificacao === "viavel"
                                ? t.card_live
                                : c.classificacao === "morta"
                                ? t.card_dead
                                : t.card_undetermined}
                            </span>
                          )}
                        </td>
                        <td className="num">{formatarInteiro(c.centro_x, idioma)}</td>
                        <td className="num">{formatarInteiro(c.centro_y, idioma)}</td>
                        <td className="num">{formatarInteiro(c.area_px, idioma)}</td>
                        <td className="num">
                          {formatarInteiro(c.area_citoplasma_px ?? 0, idioma)}
                        </td>
                        {sel.relatorio["Tipo de Análise"] === "citoplasma" ? (
                          <>
                            <td className="num">
                              {formatarInteiro(
                                c.area_total_px ?? (c.area_px + (c.area_citoplasma_px ?? 0)),
                                idioma
                              )}
                            </td>
                            <td className="num">
                              {formatarDecimal(c.mean_intensity ?? 0, idioma, 1)}
                            </td>
                            <td className="num">
                              {c.razao_nc !== null && c.razao_nc !== undefined
                                ? formatarDecimal(c.razao_nc, idioma, 2)
                                : "—"}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="num">
                              {formatarDecimal(c.mean_intensity ?? 0, idioma, 1)}
                            </td>
                            <td className="num">
                              {formatarPercentual(c.cobertura_verde_pct, idioma, 1)}
                            </td>
                            <td className="num">
                              {formatarPercentual(c.cobertura_amarela_pct, idioma, 1)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {modo === "mascaras" && (
            <div className="viewer-masks">
              <figure>
                <img src={`data:image/png;base64,${sel.mascaras_b64.azul}`} alt="Máscara azul" />
                <figcaption>{t.card_detected} (DAPI)</figcaption>
              </figure>
              <figure>
                <img src={`data:image/png;base64,${sel.mascaras_b64.verde}`} alt="Máscara verde" />
                <figcaption>{t.card_live} (FITC)</figcaption>
              </figure>
              <figure>
                <img
                  src={`data:image/png;base64,${sel.mascaras_b64.amarelo}`}
                  alt="Máscara amarela"
                />
                <figcaption>{t.card_dead} (PI)</figcaption>
              </figure>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
