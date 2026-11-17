import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APP_VERSION,
  CelulaIndividual,
  DiagnosticoBackend,
  ManualEdit,
  Parametros,
  ROI,
  ResultadoProcessamento,
  aguardarBackend,
  atualizarCelulasManual,
  carregarAmostraDemo,
  exportarZipBase64,
  lerConfigUsuario,
  abrirPastaLogs,
  limparSessaoBackend,
  obterDiagnosticoBackend,
  processarImagem,
  registrarLogApp,
  reiniciarBackendMotor,
  reprocessarAmostra,
  salvarArquivoComDialogo,
  salvarConfigUsuario,
} from "./lib/api";
import { CITACAO_OFICIAL, Idioma, TEXTOS } from "./lib/i18n";
import {
  formatarInteiro,
  formatarPercentual,
  formatarViabilidadeDeContagem,
  obterLocale,
} from "./lib/format";
import DropdownIdioma from "./components/DropdownIdioma";
import Uploader from "./components/Uploader";
import PainelCalibracao from "./components/PainelCalibracao";
import NavegadorResultados from "./components/NavegadorResultados";
import TabelaRelatorio from "./components/TabelaRelatorio";
import BarraProgresso from "./components/BarraProgresso";
import RelatorioImpressao from "./components/RelatorioImpressao";
import ModalAtalhos from "./components/ModalAtalhos";
import ModalTutorial from "./components/ModalTutorial";
import ModalSobre from "./components/ModalSobre";
import ModalFeedback from "./components/ModalFeedback";
import ModalBoasVindas from "./components/ModalBoasVindas";
import ModalMesclarCanais from "./components/ModalMesclarCanais";
import ModalExportarPublicacao from "./components/ModalExportarPublicacao";
import SplashScreen from "./components/SplashScreen";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  FileCodeIcon,
  FileSpreadsheetIcon,
  FolderOpenIcon,
  ImageIcon,
  InfoIcon,
  KeyboardIcon,
  LayersIcon,
  MessageSquareIcon,
  MicroscopeIcon,
  PrinterIcon,
  SaveIcon,
  XIcon,
} from "./components/Icons";

const PARAMS_INICIAIS: Parametros = {
  bias_azul: 0,
  bias_verde: 0,
  bias_amarelo: 0,
  aplicar_bilateral: true,
  min_circularidade: 0.15,
  area_maxima: null,
  formula_viabilidade: "Padrão Biológico (Vivas / (Vivas + Mortas))",
  motor_segmentacao: "watershed",
  segmentar_citoplasma: true,
  raio_citoplasma: 8,
  roi: null,
};

interface ToastMsg {
  id: number;
  texto: string;
  tipo: "sucesso" | "erro" | "info";
}

export default function App() {
  const [idioma, setIdioma] = useState<Idioma>("pt");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [parametros, setParametros] = useState<Parametros>(PARAMS_INICIAIS);
  const [ajusteFino, setAjusteFino] = useState(false);
  const [mostrarMascaras, setMostrarMascaras] = useState(false);

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [sidecarMortoInfo, setSidecarMortoInfo] = useState<{
    codigo?: number | null;
    mensagem?: string;
  } | null>(null);
  const [reiniciandoMotor, setReiniciandoMotor] = useState(false);
  const [detalhesErroCopiado, setDetalhesErroCopiado] = useState(false);
  const [segundosEspera, setSegundosEspera] = useState(0);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoBackend>({
    logs: [],
    logPath: "",
  });
  const [copiadoLog, setCopiadoLog] = useState(false);

  const [processando, setProcessando] = useState(false);
  const abortProcessamentoRef = useRef<AbortController | null>(null);
  const [reprocessandoPreview, setReprocessandoPreview] = useState(false);
  const [resultados, setResultados] = useState<ResultadoProcessamento[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>(
    undefined
  );

  // Menus superiores ("arquivo" | "ajuda" | null)
  const [menuAberto, setMenuAberto] = useState<"arquivo" | "ajuda" | null>(
    null
  );

  // Modais
  const [modoRelatorio, setModoRelatorio] = useState(false);
  const [mostrarAtalhos, setMostrarAtalhos] = useState(false);
  const [mostrarTutorial, setMostrarTutorial] = useState(false);
  const [mostrarSobre, setMostrarSobre] = useState(false);
  const [mostrarFeedback, setMostrarFeedback] = useState(false);
  const [mostrarBoasVindas, setMostrarBoasVindas] = useState(false);
  const [naoMostrarBoasVindasCfg, setNaoMostrarBoasVindasCfg] = useState(false);
  const [mostrarMergeCanais, setMostrarMergeCanais] = useState(false);
  const [mostrarExportarPub, setMostrarExportarPub] = useState(false);

  // Notificações visíveis (Toasts)
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const projetoInputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const t = TEXTOS[idioma];

  const notificar = useCallback(
    (texto: string, tipo: "sucesso" | "erro" | "info" = "info") => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev.slice(-3), { id, texto, tipo }]);
      registrarLogApp(
        tipo === "erro" ? "error" : tipo === "sucesso" ? "info" : "info",
        texto
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 5000);
    },
    []
  );

  // Carrega preferências salvas em config.json / localStorage
  useEffect(() => {
    lerConfigUsuario().then((cfg) => {
      if (cfg.idioma && ["pt", "en", "es"].includes(cfg.idioma)) {
        setIdioma(cfg.idioma);
      }
      const ocultar = Boolean(cfg.hideWelcomeModal);
      setNaoMostrarBoasVindasCfg(ocultar);
      if (!ocultar) {
        setMostrarBoasVindas(true);
      }
    });
  }, []);

  // Fecha menu dropdown ao clicar fora
  useEffect(() => {
    if (!menuAberto) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setMenuAberto(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [menuAberto]);

  const iniciarConexaoBackend = useCallback(() => {
    setBackendOnline(null);
    setSegundosEspera(0);
    aguardarBackend(120, 500, (tentativa) => {
      setSegundosEspera(Math.floor(tentativa / 2));
    }).then(async (ok) => {
      setBackendOnline(ok);
      if (!ok) {
        const diag = await obterDiagnosticoBackend();
        setDiagnostico(diag);
      }
    });
  }, []);

  useEffect(() => {
    iniciarConexaoBackend();
  }, [iniciarConexaoBackend]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen<{ online: boolean; code?: number | null; msg?: string }>(
          "backend-status",
          (event) => {
            if (!event.payload.online) {
              setBackendOnline(false);
              setSidecarMortoInfo({
                codigo: event.payload.code ?? null,
                mensagem:
                  event.payload.msg ||
                  "O motor de análise parou inesperadamente.",
              });
              notificar(
                `O motor de análise parou (código ${event.payload.code ?? "desconhecido"})`,
                "erro"
              );
            } else {
              setBackendOnline(true);
              setSidecarMortoInfo(null);
              notificar("Motor de análise online e pronto.", "sucesso");
            }
          }
        ).then((fn) => {
          unlisten = fn;
        });
      })
      .catch(() => {});

    const handleGlobalError = (e: Event) => {
      const ce = e as CustomEvent<{
        tipo: string;
        mensagem: string;
        detalhes: string;
      }>;
      if (ce.detail) {
        notificar(`Erro na interface: ${ce.detail.mensagem}`, "erro");
      }
    };
    window.addEventListener("cytocount-global-error", handleGlobalError);

    return () => {
      if (unlisten) unlisten();
      window.removeEventListener("cytocount-global-error", handleGlobalError);
    };
  }, [notificar]);

  const handleReiniciarMotor = useCallback(async () => {
    setReiniciandoMotor(true);
    try {
      await reiniciarBackendMotor();
      iniciarConexaoBackend();
      notificar("Comando de reinício enviado ao motor.", "info");
    } catch (err) {
      notificar(`Falha ao reiniciar motor: ${err}`, "erro");
    } finally {
      setReiniciandoMotor(false);
    }
  }, [iniciarConexaoBackend, notificar]);

  const resultadosValidos = useMemo(
    () => resultados.filter((r) => !r.erro),
    [resultados]
  );
  const erros = useMemo(() => resultados.filter((r) => r.erro), [resultados]);

  const amostraSelecionada = useMemo(
    () =>
      resultadosValidos.find((r) => r.id === selecionadoId) ??
      resultadosValidos[0],
    [resultadosValidos, selecionadoId]
  );

  const nomesProcessados = useMemo(
    () => new Set(resultadosValidos.map((r) => r.relatorio.Arquivo)),
    [resultadosValidos]
  );

  // Calibração em tempo real (debounce de 350ms) na amostra selecionada
  const primeiroRenderPreview = useRef(true);
  useEffect(() => {
    if (primeiroRenderPreview.current) {
      primeiroRenderPreview.current = false;
      return;
    }
    if (!selecionadoId || processando || resultadosValidos.length === 0) return;

    const timer = setTimeout(async () => {
      setReprocessandoPreview(true);
      try {
        const atualizado = await reprocessarAmostra(
          selecionadoId,
          parametros,
          idioma
        );
        if (!atualizado.erro) {
          setResultados((prev) =>
            prev.map((item) => (item.id === selecionadoId ? atualizado : item))
          );
        }
      } catch (e) {
        notificar(`Aviso ao atualizar preview: ${e}`, "erro");
      } finally {
        setReprocessandoPreview(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [
    parametros.bias_azul,
    parametros.bias_verde,
    parametros.bias_amarelo,
    parametros.aplicar_bilateral,
    parametros.min_circularidade,
    parametros.area_maxima,
    parametros.formula_viabilidade,
    parametros.motor_segmentacao,
    parametros.segmentar_citoplasma,
    parametros.raio_citoplasma,
  ]);

  const handleAplicarROI = useCallback(
    async (novoRoi: ROI | null) => {
      const novosParams = { ...parametros, roi: novoRoi };
      setParametros(novosParams);
      if (!selecionadoId) return;
      setReprocessandoPreview(true);
      try {
        const atualizado = await reprocessarAmostra(
          selecionadoId,
          novosParams,
          idioma
        );
        if (atualizado.erro) {
          notificar(atualizado.erro, "erro");
        } else {
          setResultados((prev) =>
            prev.map((item) => (item.id === selecionadoId ? atualizado : item))
          );
          notificar(
            novoRoi ? t.toast_roi_applied : t.toast_roi_cleared,
            "sucesso"
          );
        }
      } catch (e) {
        notificar(`Erro ao aplicar ROI: ${e}`, "erro");
      } finally {
        setReprocessandoPreview(false);
      }
    },
    [parametros, selecionadoId, idioma, notificar, t]
  );

  // Atualização em tempo real de edições manuais (Alternar classe, Adicionar, Excluir, Undo/Redo)
  const handleEditarCelulas = useCallback(
    async (
      jobId: string,
      novaTabela: CelulaIndividual[],
      novosEdits: ManualEdit[]
    ) => {
      // Atualização otimista instantânea usando a mesma Fonte Única da Verdade
      const det = novaTabela.length;
      const viv = novaTabela.filter((c) => c.classificacao === "viavel").length;
      const mor = novaTabela.filter((c) => c.classificacao === "morta").length;
      const ind = Math.max(0, det - viv - mor);
      const pctViv = det > 0 ? Number(((viv / det) * 100).toFixed(1)) : 0;
      const pctMor = det > 0 ? Number(((mor / det) * 100).toFixed(1)) : 0;
      const pctInd = det > 0 ? Number(((ind / det) * 100).toFixed(1)) : 0;
      const ehRigoroso = parametros.formula_viabilidade.includes("Rigoroso");
      const base = ehRigoroso ? det : viv + mor;
      const { viabilidade, icBaixo, icAlto } = formatarViabilidadeDeContagem(
        viv,
        base,
        idioma
      );

      setResultados((prev) =>
        prev.map((r) => {
          if (r.id !== jobId) return r;
          return {
            ...r,
            tabela_celulas: novaTabela,
            manual_edits: novosEdits,
            relatorio: {
              ...r.relatorio,
              "Total (Azul)": det,
              Detectados: det,
              "Viáveis (Verde)": viv,
              "Mortas (Amarelo)": mor,
              Indeterminadas: ind,
              "Pct Viáveis (%)": pctViv,
              "Pct Mortas (%)": pctMor,
              "Pct Indeterminadas (%)": pctInd,
              "Base de Cálculo": base,
              "Viabilidade (%)": viabilidade,
              "IC 95% Baixo": icBaixo,
              "IC 95% Alto": icAlto,
              "Alerta Indeterminadas": pctInd > 15,
              "Edições Manuais": novosEdits.length,
            },
          };
        })
      );

      // Sincroniza contornos e imagem de exportação no backend Python
      try {
        const resp = await atualizarCelulasManual(
          jobId,
          novaTabela,
          novosEdits,
          parametros.formula_viabilidade,
          idioma
        );
        if (resp && !resp.erro && resp.processada_png_b64) {
          setResultados((prev) =>
            prev.map((r) =>
              r.id === jobId
                ? {
                    ...r,
                    processada_png_b64: resp.processada_png_b64!,
                    relatorio: resp.relatorio ?? r.relatorio,
                  }
                : r
            )
          );
        }
      } catch (e) {
        notificar(`Aviso ao sincronizar edição manual: ${e}`, "erro");
      }
    },
    [parametros.formula_viabilidade, idioma, notificar]
  );

  const handleCarregarAmostraDemo = async () => {
    if (processando || !backendOnline) return;
    setProcessando(true);
    try {
      await limparSessaoBackend();
      const demo = await carregarAmostraDemo(
        idioma,
        parametros.motor_segmentacao ?? "watershed"
      );
      if (demo.erro) {
        notificar(demo.erro, "erro");
      } else {
        setResultados([demo]);
        setSelecionadoId(demo.id);
        notificar(t.toast_sample_loaded, "sucesso");
      }
    } catch (e) {
      notificar(`Erro ao carregar imagem de exemplo: ${e}`, "erro");
    } finally {
      setProcessando(false);
    }
  };

  // Salvar Projeto (.cytoproj) com manual_edits e diálogo nativo "Salvar como"
  const salvarProjeto = useCallback(async () => {
    if (resultadosValidos.length === 0) return;
    try {
      const payload = {
        versao: APP_VERSION,
        citacao: CITACAO_OFICIAL,
        data: new Date().toISOString(),
        idioma,
        parametros,
        manual_edits_total: resultadosValidos.reduce(
          (acc, r) => acc + (r.manual_edits?.length ?? 0),
          0
        ),
        resultados: resultadosValidos,
      };
      const conteudo = JSON.stringify(payload, null, 2);
      const dataStr = new Date().toISOString().slice(0, 10);
      const salvo = await salvarArquivoComDialogo(
        `CytoCount_Sessao_${dataStr}.cytoproj`,
        conteudo,
        false,
        "Projeto CytoCount (*.cytoproj)",
        "cytoproj"
      );
      if (salvo) {
        notificar(`${t.toast_saved_at} ${salvo}`, "sucesso");
      }
    } catch (e) {
      notificar(`Erro ao salvar projeto: ${e}`, "erro");
    }
  }, [resultadosValidos, idioma, parametros, notificar, t]);

  const abrirProjeto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        if (Array.isArray(json.resultados) && json.resultados.length > 0) {
          if (json.parametros) setParametros(json.parametros);
          setResultados(json.resultados);
          setSelecionadoId(json.resultados[0].id);
          notificar(t.toast_project_loaded, "sucesso");
        } else {
          notificar("O arquivo .cytoproj não contém amostras válidas.", "erro");
        }
      } catch (e) {
        notificar(`Arquivo de projeto inválido: ${e}`, "erro");
      }
    };
    reader.readAsText(file);
  };

  // Exportações pelo Menu Arquivo > Exportar
  const handleExportarCSVConsolidado = async () => {
    if (resultadosValidos.length === 0) return;
    try {
      const headers = [
        "Arquivo",
        "Detectados",
        "Vivas",
        "Pct_Vivas",
        "Mortas",
        "Pct_Mortas",
        "Indeterminadas",
        "Pct_Indeterminadas",
        "Viabilidade_Pct",
        "IC95_Wilson_Baixo",
        "IC95_Wilson_Alto",
        "ROI",
        "Edicoes_Manuais",
      ];
      const linhas = resultadosValidos.map((r) => {
        const rel = r.relatorio;
        const det = rel.Detectados ?? rel["Total (Azul)"] ?? 0;
        const viv = rel["Viáveis (Verde)"] ?? 0;
        const mor = rel["Mortas (Amarelo)"] ?? 0;
        const ind = rel.Indeterminadas ?? Math.max(0, det - viv - mor);
        return [
          `"${rel.Arquivo.replace(/"/g, '""')}"`,
          det,
          viv,
          rel["Pct Viáveis (%)"] ?? 0,
          mor,
          rel["Pct Mortas (%)"] ?? 0,
          ind,
          rel["Pct Indeterminadas (%)"] ?? 0,
          rel["Viabilidade (%)"] ?? 0,
          rel["IC 95% Baixo"] ?? 0,
          rel["IC 95% Alto"] ?? 0,
          `"${rel.ROI ?? "Imagem Completa"}"`,
          r.manual_edits?.length ?? 0,
        ].join(",");
      });
      const csv = [headers.join(","), ...linhas].join("\n");
      const salvo = await salvarArquivoComDialogo(
        "CytoCount_Relatorio_Consolidado.csv",
        csv,
        false,
        "Planilha CSV (*.csv)",
        "csv"
      );
      if (salvo) notificar(`${t.toast_saved_at} ${salvo}`, "sucesso");
    } catch (e) {
      notificar(`Erro ao exportar CSV: ${e}`, "erro");
    }
  };

  const handleCopiarTabelaConsolidada = async () => {
    if (resultadosValidos.length === 0) return;
    try {
      const headers = [
        "Arquivo",
        "Detectados",
        "Vivas",
        "Pct_Vivas(%)",
        "Mortas",
        "Pct_Mortas(%)",
        "Indeterminadas",
        "Pct_Indet(%)",
        "Viabilidade(%)",
        "IC95_Wilson_Baixo",
        "IC95_Wilson_Alto",
        "ROI",
      ];
      const linhas = resultadosValidos.map((r) => {
        const rel = r.relatorio;
        const det = rel.Detectados ?? rel["Total (Azul)"] ?? 0;
        const viv = rel["Viáveis (Verde)"] ?? 0;
        const mor = rel["Mortas (Amarelo)"] ?? 0;
        const ind = rel.Indeterminadas ?? Math.max(0, det - viv - mor);
        return [
          rel.Arquivo,
          det,
          viv,
          rel["Pct Viáveis (%)"] ?? 0,
          mor,
          rel["Pct Mortas (%)"] ?? 0,
          ind,
          rel["Pct Indeterminadas (%)"] ?? 0,
          rel["Viabilidade (%)"] ?? 0,
          rel["IC 95% Baixo"] ?? 0,
          rel["IC 95% Alto"] ?? 0,
          rel.ROI ?? "Completa",
        ].join("\t");
      });
      const tsv = [headers.join("\t"), ...linhas].join("\n");
      await navigator.clipboard.writeText(tsv);
      notificar(
        idioma === "en"
          ? "Table copied to clipboard (ready for Excel / Prism)!"
          : idioma === "es"
          ? "¡Tabla copiada al portapapeles (lista para Excel / Prism)!"
          : "Tabela copiada para a área de transferência (pronta para colar no Excel / Prism)!",
        "sucesso"
      );
    } catch (e) {
      notificar(`Erro ao copiar tabela: ${e}`, "erro");
    }
  };

  const handleExportarImageJCSVAmostra = async () => {
    if (!amostraSelecionada) return;
    const celulas = amostraSelecionada.tabela_celulas ?? [];
    const header = " ,X,Y,Area,Mean,Class,Green_Pct,Yellow_Pct\n";
    const rows = celulas
      .map((c, idx) => {
        const mean =
          c.mean_intensity ??
          Number(
            ((c.cobertura_verde_pct + c.cobertura_amarela_pct) * 1.27).toFixed(
              1
            )
          );
        return `${idx + 1},${c.centro_x},${c.centro_y},${c.area_px},${mean},${
          c.classificacao
        },${c.cobertura_verde_pct},${c.cobertura_amarela_pct}`;
      })
      .join("\n");
    const nomeBase = amostraSelecionada.relatorio.Arquivo.replace(
      /\.[^.]+$/,
      ""
    );
    const salvo = await salvarArquivoComDialogo(
      `${nomeBase}_ImageJ_Results.csv`,
      header + rows,
      false,
      "ImageJ CSV Results (*.csv)",
      "csv"
    );
    if (salvo) notificar(`${t.toast_saved_at} ${salvo}`, "sucesso");
  };

  const handleExportarFijiMacroAmostra = async () => {
    if (!amostraSelecionada) return;
    const celulas = amostraSelecionada.tabela_celulas ?? [];
    const linhas = [
      `// CytoCount v${APP_VERSION} - Fiji / ImageJ ROI Manager Macro`,
      `// Sample: ${amostraSelecionada.relatorio.Arquivo}`,
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
        const r = Math.max(
          3,
          Math.round(c.raio_eq ?? Math.sqrt(c.area_px / Math.PI))
        );
        linhas.push(
          `makeOval(${c.centro_x - r}, ${c.centro_y - r}, ${r * 2}, ${r * 2});`
        );
      }
      linhas.push(`Roi.setName("Cell_${c.celula_id}_${c.classificacao}");`);
      linhas.push(`Roi.setStrokeColor("${cor}");`);
      linhas.push(`Roi.setStrokeWidth(1.5);`);
      linhas.push(`roiManager("Add");`);
    });
    linhas.push(`setBatchMode(false);`);
    linhas.push(`roiManager("Show All without labels");`);
    const nomeBase = amostraSelecionada.relatorio.Arquivo.replace(
      /\.[^.]+$/,
      ""
    );
    const salvo = await salvarArquivoComDialogo(
      `${nomeBase}_Fiji_ROIs.ijm`,
      linhas.join("\n"),
      false,
      "Fiji / ImageJ Macro (*.ijm)",
      "ijm"
    );
    if (salvo) notificar(`${t.toast_saved_at} ${salvo}`, "sucesso");
  };

  const handleExportarZipDialogo = async () => {
    if (resultadosValidos.length === 0) return;
    try {
      const ids = resultadosValidos.map((r) => r.id);
      const res = await exportarZipBase64(ids);
      if (res.erro || !res.conteudo_b64) {
        notificar(res.erro ?? "Falha ao gerar pacote ZIP.", "erro");
        return;
      }
      const salvo = await salvarArquivoComDialogo(
        res.nome_sugerido ?? "CytoCount_Resultados.zip",
        res.conteudo_b64,
        true,
        "Arquivo ZIP (*.zip)",
        "zip"
      );
      if (salvo) notificar(`${t.toast_saved_at} ${salvo}`, "sucesso");
    } catch (e) {
      notificar(`Erro ao salvar ZIP: ${e}`, "erro");
    }
  };

  const handleCancelarProcessamento = useCallback(() => {
    if (abortProcessamentoRef.current) {
      abortProcessamentoRef.current.abort();
      abortProcessamentoRef.current = null;
    }
    setProcessando(false);
    notificar(t.toast_proc_canceled, "info");
  }, [t.toast_proc_canceled, notificar]);

  const processarLote = async () => {
    if (arquivos.length === 0 || processando || !backendOnline) return;
    const ctrl = new AbortController();
    abortProcessamentoRef.current = ctrl;
    setProcessando(true);
    setResultados([]);
    setSelecionadoId(undefined);

    try {
      await limparSessaoBackend();

      const novos: ResultadoProcessamento[] = [];
      for (const arq of arquivos) {
        if (ctrl.signal.aborted) break;
        try {
          const res = await processarImagem(arq, parametros, idioma, ctrl.signal);
          if (ctrl.signal.aborted) break;
          novos.push(res);
          setResultados([...novos]);
          if (res.erro) {
            notificar(`Erro em ${arq.name}: ${res.erro}`, "erro");
          }
        } catch (e: any) {
          if (e?.name === "AbortError" || ctrl.signal.aborted) {
            break;
          }
          const msg = e instanceof Error ? e.message : String(e);
          novos.push({
            id: `${arq.name}-${Date.now()}`,
            erro: msg,
            arquivo: arq.name,
            relatorio: {} as any,
            processada_png_b64: "",
            original_png_b64: "",
            mascaras_b64: { azul: "", verde: "", amarelo: "" },
          });
          setResultados([...novos]);
          notificar(`Erro ao processar ${arq.name}: ${msg}`, "erro");
        }
      }

      const primeiroValido = novos.find((r) => !r.erro);
      if (primeiroValido) setSelecionadoId(primeiroValido.id);
    } finally {
      setProcessando(false);
      abortProcessamentoRef.current = null;
    }
  };

  // Atalhos globais de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "F1") {
        e.preventDefault();
        setMostrarTutorial((v) => !v);
      } else if (
        e.key === "Enter" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !mostrarBoasVindas &&
        !mostrarTutorial &&
        !mostrarSobre &&
        !mostrarAtalhos &&
        !mostrarFeedback &&
        !mostrarMergeCanais &&
        !mostrarExportarPub &&
        arquivos.length > 0 &&
        !processando &&
        backendOnline === true
      ) {
        e.preventDefault();
        processarLote();
      } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setMostrarAtalhos((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        salvarProjeto();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        projetoInputRef.current?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setMostrarMergeCanais(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        if (resultadosValidos.length > 0) {
          e.preventDefault();
          setModoRelatorio(true);
        }
      } else if (e.key === "ArrowRight" && resultadosValidos.length > 1) {
        const idx = resultadosValidos.findIndex((r) => r.id === selecionadoId);
        const next = resultadosValidos[(idx + 1) % resultadosValidos.length];
        if (next) setSelecionadoId(next.id);
      } else if (e.key === "ArrowLeft" && resultadosValidos.length > 1) {
        const idx = resultadosValidos.findIndex((r) => r.id === selecionadoId);
        const prev =
          resultadosValidos[
            (idx - 1 + resultadosValidos.length) % resultadosValidos.length
          ];
        if (prev) setSelecionadoId(prev.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [resultadosValidos, selecionadoId, salvarProjeto]);

  // Totais consolidados (FONTE ÚNICA DA VERDADE: Detectados = Vivas + Mortas + Indeterminadas)
  const totais = useMemo(() => {
    if (resultadosValidos.length === 0) return null;
    const detectados = resultadosValidos.reduce(
      (s, r) => s + (r.relatorio.Detectados ?? r.relatorio["Total (Azul)"] ?? 0),
      0
    );
    const vivas = resultadosValidos.reduce(
      (s, r) => s + (r.relatorio["Viáveis (Verde)"] ?? 0),
      0
    );
    const mortas = resultadosValidos.reduce(
      (s, r) => s + (r.relatorio["Mortas (Amarelo)"] ?? 0),
      0
    );
    const indeterminadas = Math.max(0, detectados - vivas - mortas);

    const pctVivas = detectados > 0 ? (vivas / detectados) * 100 : 0;
    const pctMortas = detectados > 0 ? (mortas / detectados) * 100 : 0;
    const pctIndet = detectados > 0 ? (indeterminadas / detectados) * 100 : 0;

    const ehRigoroso = parametros.formula_viabilidade.includes("Rigoroso");
    const baseCalculo = ehRigoroso ? detectados : vivas + mortas;
    const viabStats = formatarViabilidadeDeContagem(
      vivas,
      baseCalculo,
      idioma
    );

    const alertaQualidade =
      pctIndet > 15 ||
      Boolean(amostraSelecionada?.relatorio["Alerta Indeterminadas"]);

    return {
      amostras: resultadosValidos.length,
      detectados,
      vivas,
      mortas,
      indeterminadas,
      pctVivas,
      pctMortas,
      pctIndet,
      viabFormatada: viabStats.formatado,
      alertaQualidade,
    };
  }, [resultadosValidos, parametros.formula_viabilidade, idioma, amostraSelecionada]);

  const podeProcessar =
    arquivos.length > 0 && !processando && backendOnline === true;

  const handleTrocarIdioma = (novoIdioma: Idioma) => {
    setIdioma(novoIdioma);
    salvarConfigUsuario({ idioma: novoIdioma });
  };

  if (modoRelatorio) {
    return (
      <RelatorioImpressao
        resultados={resultadosValidos}
        parametros={parametros}
        idioma={idioma}
        onFechar={() => setModoRelatorio(false)}
        onNotificar={notificar}
      />
    );
  }

  return (
    <div className="app-shell">
      <SplashScreen
        ativo={backendOnline === null}
        segundosDecorridos={segundosEspera}
      />

      {/* Input oculto para abrir projeto (.cytoproj) */}
      <input
        ref={projetoInputRef}
        type="file"
        accept=".cytoproj,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) abrirProjeto(f);
          e.target.value = "";
        }}
      />

      <header className="topbar">
        <div className="topbar-left" ref={menuContainerRef}>
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <span className="dot dot-blue"></span>
              <span className="dot dot-green"></span>
              <span className="dot dot-yellow"></span>
            </div>
            <div className="brand-title">CytoCount</div>
          </div>

          {/* Barra de Menus Superior: Arquivo & Ajuda */}
          <nav className="menubar" aria-label="Menu Principal">
            <div className="menu-dropdown-wrap">
              <button
                type="button"
                className={`menubar-trigger ${
                  menuAberto === "arquivo" ? "active" : ""
                }`}
                onClick={() =>
                  setMenuAberto(menuAberto === "arquivo" ? null : "arquivo")
                }
              >
                <span>{t.menu_file}</span>
                <ChevronDownIcon size={13} />
              </button>

              {menuAberto === "arquivo" && (
                <div className="menu-dropdown-panel">
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenuAberto(null);
                      projetoInputRef.current?.click();
                    }}
                  >
                    <FolderOpenIcon size={14} />
                    <span>{t.menu_open_project}</span>
                    <kbd>Ctrl+O</kbd>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    disabled={resultadosValidos.length === 0}
                    onClick={() => {
                      setMenuAberto(null);
                      salvarProjeto();
                    }}
                  >
                    <SaveIcon size={14} />
                    <span>{t.menu_save_project}</span>
                    <kbd>Ctrl+S</kbd>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenuAberto(null);
                      setMostrarMergeCanais(true);
                    }}
                  >
                    <LayersIcon size={14} />
                    <span>{t.menu_merge_channels}</span>
                    <kbd>Ctrl+M</kbd>
                  </button>

                  <div className="menu-divider" />
                  <div className="menu-section-label">
                    <span>{t.menu_export}</span>
                    <ChevronRightIcon size={12} />
                  </div>

                  <button
                    type="button"
                    className="menu-item"
                    disabled={resultadosValidos.length === 0}
                    onClick={() => {
                      setMenuAberto(null);
                      handleExportarCSVConsolidado();
                    }}
                  >
                    <FileSpreadsheetIcon size={14} />
                    <span>{t.menu_export_csv}</span>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    disabled={!amostraSelecionada}
                    onClick={() => {
                      setMenuAberto(null);
                      handleExportarImageJCSVAmostra();
                    }}
                  >
                    <FileSpreadsheetIcon size={14} />
                    <span>{t.menu_export_imagej_csv}</span>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    disabled={!amostraSelecionada}
                    onClick={() => {
                      setMenuAberto(null);
                      handleExportarFijiMacroAmostra();
                    }}
                  >
                    <FileCodeIcon size={14} />
                    <span>{t.menu_export_fiji_macro}</span>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    disabled={!amostraSelecionada}
                    onClick={() => {
                      setMenuAberto(null);
                      setMostrarExportarPub(true);
                    }}
                  >
                    <ImageIcon size={14} />
                    <span>{t.menu_export_pub_fig}</span>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    disabled={resultadosValidos.length === 0}
                    onClick={() => {
                      setMenuAberto(null);
                      setModoRelatorio(true);
                    }}
                  >
                    <PrinterIcon size={14} />
                    <span>{t.menu_export_report}</span>
                    <kbd>Ctrl+P</kbd>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    disabled={resultadosValidos.length === 0}
                    onClick={() => {
                      setMenuAberto(null);
                      handleExportarZipDialogo();
                    }}
                  >
                    <DownloadIcon size={14} />
                    <span>{t.menu_export_zip}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="menu-dropdown-wrap">
              <button
                type="button"
                className={`menubar-trigger ${
                  menuAberto === "ajuda" ? "active" : ""
                }`}
                onClick={() =>
                  setMenuAberto(menuAberto === "ajuda" ? null : "ajuda")
                }
              >
                <span>{t.menu_help}</span>
                <ChevronDownIcon size={13} />
              </button>

              {menuAberto === "ajuda" && (
                <div className="menu-dropdown-panel">
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenuAberto(null);
                      setMostrarTutorial(true);
                    }}
                  >
                    <BookOpenIcon size={14} />
                    <span>{t.menu_guide}</span>
                    <kbd>F1</kbd>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenuAberto(null);
                      setMostrarAtalhos(true);
                    }}
                  >
                    <KeyboardIcon size={14} />
                    <span>{t.menu_shortcuts}</span>
                    <kbd>?</kbd>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenuAberto(null);
                      setMostrarBoasVindas(true);
                    }}
                  >
                    <MicroscopeIcon size={14} />
                    <span>{t.menu_welcome}</span>
                  </button>

                  <div className="menu-divider" />

                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenuAberto(null);
                      setMostrarSobre(true);
                    }}
                  >
                    <InfoIcon size={14} />
                    <span>{t.menu_about}</span>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenuAberto(null);
                      abrirPastaLogs();
                    }}
                  >
                    <FolderOpenIcon size={14} />
                    <span>{t.menu_open_logs}</span>
                  </button>

                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setMenuAberto(null);
                      obterDiagnosticoBackend().then(setDiagnostico);
                      setMostrarFeedback(true);
                    }}
                  >
                    <MessageSquareIcon size={14} />
                    <span>{t.menu_feedback}</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Canto Direito: Dropdown Customizado de Idioma (PT / EN / ES) */}
        <div className="topbar-right">
          <DropdownIdioma idiomaAtual={idioma} onMudarIdioma={handleTrocarIdioma} />
        </div>
      </header>

      {/* Alerta de Motor Parado com Ação de Reinício Imediato */}
      {backendOnline === false && (
        <div className="engine-stopped-banner" role="alert">
          <div className="engine-stopped-content">
            <AlertTriangleIcon size={16} />
            <div className="engine-stopped-text">
              <strong>{t.engine_stopped}</strong>
              {sidecarMortoInfo?.codigo !== undefined &&
                sidecarMortoInfo.codigo !== null && (
                  <span className="engine-stopped-sub">
                    {" "}(Código: {sidecarMortoInfo.codigo})
                  </span>
                )}
            </div>
          </div>
          <div className="engine-stopped-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={reiniciandoMotor}
              onClick={handleReiniciarMotor}
            >
              {reiniciandoMotor ? "Reiniciando..." : t.btn_restart_engine}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={abrirPastaLogs}
            >
              <FolderOpenIcon size={13} />
              <span>{t.menu_open_logs}</span>
            </button>
            {sidecarMortoInfo?.mensagem && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `CytoCount Sidecar Crash Report\nCódigo: ${sidecarMortoInfo.codigo}\nMsg: ${sidecarMortoInfo.mensagem}\nData: ${new Date().toISOString()}`
                  );
                  setDetalhesErroCopiado(true);
                  setTimeout(() => setDetalhesErroCopiado(false), 2000);
                }}
              >
                {detalhesErroCopiado ? "Copiado!" : t.btn_copy_details}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="workspace">
        <aside className="sidebar">
          <section className="panel-block">
            <h2 className="panel-title">{t.sec_samples}</h2>
            <Uploader
              onArquivosSelecionados={setArquivos}
              onCarregarExemplo={handleCarregarAmostraDemo}
              onAbrirMergeCanais={() => setMostrarMergeCanais(true)}
              onErroToast={(m) => notificar(m, "erro")}
              desabilitado={processando}
              arquivosSelecionados={arquivos}
              nomesProcessados={nomesProcessados}
              idioma={idioma}
            />
          </section>

          <PainelCalibracao
            parametros={parametros}
            onChange={setParametros}
            ajusteFino={ajusteFino}
            onAjusteFinoChange={setAjusteFino}
            mostrarMascaras={mostrarMascaras}
            onMostrarMascarasChange={setMostrarMascaras}
            desabilitado={processando}
            temPreviewAtivo={resultadosValidos.length > 0}
            reprocessandoPreview={reprocessandoPreview}
            idioma={idioma}
          />

          <div className="sidebar-process-dock">
            <button
              id="processBtn"
              className="btn-primary"
              onClick={processarLote}
              disabled={!podeProcessar}
            >
              <span>{processando ? t.btn_processing : t.btn_process}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </aside>

        <main className="content">
          {backendOnline === false && (
            <div className="error-banner" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Não foi possível conectar ao motor de processamento local.
              </div>
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.9,
                  marginBottom: 10,
                  lineHeight: 1.5,
                }}
              >
                O antivírus pode ter bloqueado a inicialização ou houve falha no
                processo Python.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={iniciarConexaoBackend}
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    const d = await obterDiagnosticoBackend();
                    setDiagnostico(d);
                    const texto = [
                      `CytoCount v${APP_VERSION} - Diagnóstico`,
                      `Arquivo de log: ${d.logPath}`,
                      ...(d.logs.length ? d.logs : ["(Sem linhas de log)"]),
                    ].join("\n");
                    await navigator.clipboard.writeText(texto);
                    setCopiadoLog(true);
                    setTimeout(() => setCopiadoLog(false), 2500);
                  }}
                >
                  {copiadoLog ? "Copiado!" : "Copiar Diagnóstico"}
                </button>
              </div>
            </div>
          )}

          {!processando && resultados.length === 0 && (
            <div className="empty-state">
              <svg
                viewBox="0 0 120 120"
                className="empty-illustration"
                aria-hidden="true"
              >
                <circle cx="60" cy="60" r="52" className="e-dish" />
                <circle cx="60" cy="60" r="52" className="e-dish-inner" />
                <circle cx="42" cy="46" r="7" className="e-blue" />
                <circle cx="70" cy="40" r="6" className="e-green" />
                <circle cx="78" cy="70" r="6.5" className="e-yellow" />
                <circle cx="50" cy="76" r="5" className="e-green" />
                <circle cx="34" cy="66" r="4.5" className="e-blue" />
              </svg>
              <h3>{t.empty_title}</h3>
              <p>{t.empty_desc}</p>
              <button
                type="button"
                className="sample-discrete-link"
                style={{ marginTop: 12 }}
                onClick={handleCarregarAmostraDemo}
              >
                {t.link_load_sample}
              </button>
            </div>
          )}

          {processando && (
            <BarraProgresso
              processadas={resultados.length}
              total={arquivos.length}
              onCancelar={handleCancelarProcessamento}
              idioma={idioma}
            />
          )}

          {!processando && resultadosValidos.length > 0 && (
            <div className="results">
              {/* 4 Cards Principais (Detectados, Vivas, Mortas, Indeterminadas) + Card Viabilidade IC 95% */}
              {totais && (
                <>
                  <div className="summary-strip summary-strip-5">
                    <div className="stat-card stat-blue">
                      <span className="stat-value">
                        {formatarInteiro(totais.detectados, idioma)}
                      </span>
                      <span className="stat-label">
                        {t.card_detected} (100%)
                      </span>
                    </div>

                    <div className="stat-card stat-green">
                      <span className="stat-value">
                        {formatarInteiro(totais.vivas, idioma)}{" "}
                        <small className="stat-pct">
                          ({formatarPercentual(totais.pctVivas, idioma, 1)})
                        </small>
                      </span>
                      <span className="stat-label">{t.card_live}</span>
                    </div>

                    <div className="stat-card stat-yellow">
                      <span className="stat-value">
                        {formatarInteiro(totais.mortas, idioma)}{" "}
                        <small className="stat-pct">
                          ({formatarPercentual(totais.pctMortas, idioma, 1)})
                        </small>
                      </span>
                      <span className="stat-label">{t.card_dead}</span>
                    </div>

                    <div
                      className={`stat-card ${
                        totais.alertaQualidade ? "stat-yellow" : "stat-muted"
                      }`}
                    >
                      <span className="stat-value">
                        {formatarInteiro(totais.indeterminadas, idioma)}{" "}
                        <small className="stat-pct">
                          ({formatarPercentual(totais.pctIndet, idioma, 1)})
                        </small>
                      </span>
                      <span className="stat-label">{t.card_undetermined}</span>
                    </div>

                    <div className="stat-card stat-viability">
                      <span className="stat-value stat-value-ic">
                        {totais.viabFormatada}
                      </span>
                      <span className="stat-label">{t.card_viability}</span>
                    </div>
                  </div>

                  {/* Aviso amarelo quando indeterminadas > 15% dos detectados */}
                  {totais.alertaQualidade && (
                    <div className="quality-warning-banner">
                      <AlertTriangleIcon size={18} />
                      <div>
                        <strong>{t.warn_undetermined_title}</strong>
                        <p>{t.warn_undetermined_desc}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              <NavegadorResultados
                resultados={resultadosValidos}
                mostrarMascaras={mostrarMascaras}
                selecionadoId={selecionadoId}
                onSelecionar={setSelecionadoId}
                onAplicarROI={handleAplicarROI}
                roiAtivo={parametros.roi}
                reprocessandoROI={reprocessandoPreview}
                onEditarCelulas={handleEditarCelulas}
                onNotificar={notificar}
                idioma={idioma}
              />

              <div className="report-card">
                <div className="report-header">
                  <div>
                    <h3>{t.report_consolidated}</h3>
                    <p className="report-sub">{t.report_sub}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCopiarTabelaConsolidada}
                      title="Copiar tabela em formato TSV para colar direto no Excel, Origin ou GraphPad Prism"
                    >
                      <CopyIcon size={15} />
                      <span>
                        {idioma === "en"
                          ? "Copy Table"
                          : idioma === "es"
                          ? "Copiar Tabla"
                          : "Copiar Tabela"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setMostrarExportarPub(true)}
                    >
                      <ImageIcon size={15} />
                      <span>{t.btn_pub_fig}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setModoRelatorio(true)}
                    >
                      <PrinterIcon size={15} />
                      <span>{t.btn_exec_report}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleExportarZipDialogo}
                    >
                      <DownloadIcon size={15} />
                      <span>{t.btn_download_zip}</span>
                    </button>
                  </div>
                </div>
                <TabelaRelatorio
                  relatorios={resultadosValidos.map((r) => r.relatorio)}
                  idPorLinha={resultadosValidos.map((r) => r.id)}
                  selecionadoId={selecionadoId}
                  onSelecionar={setSelecionadoId}
                  idioma={idioma}
                />
              </div>

              {erros.length > 0 && (
                <div className="error-banner">
                  {erros.map((r, i) => (
                    <div key={i}>
                      Erro ao processar "{r.arquivo ?? "arquivo"}": {r.erro}
                    </div>
                  ))}
                </div>
              )}

              <footer className="app-footer">
                <span>
                  CytoCount v{APP_VERSION} — Santos, G. C. M. (2026)
                </span>
                <span className="app-footer-dot">·</span>
                <span>{new Date().toLocaleString(obterLocale(idioma))}</span>
              </footer>
            </div>
          )}
        </main>
      </div>

      {/* Toasts visíveis de confirmação / erro */}
      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((item) => (
            <div key={item.id} className={`toast-item toast-${item.tipo}`}>
              {item.tipo === "erro" ? (
                <AlertTriangleIcon size={16} />
              ) : (
                <CheckIcon size={16} />
              )}
              <span>{item.texto}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() =>
                  setToasts((prev) => prev.filter((x) => x.id !== item.id))
                }
              >
                <XIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {mostrarBoasVindas && backendOnline !== null && (
        <ModalBoasVindas
          onFechar={() => setMostrarBoasVindas(false)}
          onAbrirTutorial={() => setMostrarTutorial(true)}
          onCarregarExemplo={handleCarregarAmostraDemo}
          naoMostrarInicial={naoMostrarBoasVindasCfg}
          idioma={idioma}
        />
      )}

      {mostrarMergeCanais && (
        <ModalMesclarCanais
          onFechar={() => setMostrarMergeCanais(false)}
          parametros={parametros}
          idioma={idioma}
          onResultadoMerge={(novoRes) => {
            setResultados((prev) => [...prev, novoRes]);
            setSelecionadoId(novoRes.id);
            notificar(
              `Merge concluído: ${novoRes.relatorio.Arquivo}`,
              "sucesso"
            );
          }}
          onErroToast={(m) => notificar(m, "erro")}
        />
      )}

      {mostrarExportarPub && amostraSelecionada && (
        <ModalExportarPublicacao
          amostra={amostraSelecionada}
          idiomaInicial={idioma}
          onFechar={() => setMostrarExportarPub(false)}
          onNotificar={notificar}
        />
      )}

      {mostrarAtalhos && (
        <ModalAtalhos
          onFechar={() => setMostrarAtalhos(false)}
          idioma={idioma}
        />
      )}

      {mostrarTutorial && (
        <ModalTutorial
          onFechar={() => setMostrarTutorial(false)}
          onCarregarExemplo={handleCarregarAmostraDemo}
          idioma={idioma}
        />
      )}

      {mostrarSobre && (
        <ModalSobre
          onFechar={() => setMostrarSobre(false)}
          onReabrirBoasVindas={() => setMostrarBoasVindas(true)}
          onNotificar={notificar}
          idioma={idioma}
        />
      )}

      {mostrarFeedback && (
        <ModalFeedback
          onFechar={() => setMostrarFeedback(false)}
          diagnostico={diagnostico}
          onNotificar={notificar}
        />
      )}
    </div>
  );
}
