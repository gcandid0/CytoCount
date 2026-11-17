import { invoke } from "@tauri-apps/api/core";
import { Idioma } from "./i18n";

let resolvedApiBase = "http://127.0.0.1:8756";
let urlResolvida = false;

export const APP_VERSION = "1.3.1";

export async function obterApiBase(): Promise<string> {
  if (urlResolvida) return resolvedApiBase;
  try {
    const url = await invoke<string>("get_backend_url");
    if (url && url.startsWith("http")) {
      resolvedApiBase = url;
      urlResolvida = true;
    }
  } catch {
    // Modo navegador puro (npm run dev sem Tauri)
  }
  return resolvedApiBase;
}

export async function obterBackendPort(): Promise<number> {
  try {
    return await invoke<number>("get_backend_port");
  } catch {
    return 8756;
  }
}

export async function reiniciarBackendMotor(): Promise<string> {
  urlResolvida = false;
  try {
    const novaUrl = await invoke<string>("reiniciar_backend");
    if (novaUrl && novaUrl.startsWith("http")) {
      resolvedApiBase = novaUrl;
      urlResolvida = true;
    }
    return resolvedApiBase;
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function abrirPastaLogs(): Promise<void> {
  try {
    await invoke("abrir_pasta_logs");
  } catch (err) {
    console.error("Falha ao abrir pasta de logs:", err);
  }
}

export interface DiagnosticoBackend {
  logs: string[];
  logPath: string;
}

export async function obterDiagnosticoBackend(): Promise<DiagnosticoBackend> {
  try {
    const [logs, logPath] = await Promise.all([
      invoke<string[]>("get_backend_logs"),
      invoke<string>("get_log_path"),
    ]);
    return { logs, logPath };
  } catch {
    return { logs: [], logPath: "" };
  }
}

export async function registrarLogApp(
  nivel: "info" | "warn" | "error",
  mensagem: string
): Promise<void> {
  try {
    await invoke("registrar_log_frontend", { nivel, mensagem });
  } catch {
    // Fallback console em modo web
    if (nivel === "error") console.error(mensagem);
    else console.log(`[${nivel}] ${mensagem}`);
  }
}

export interface UserConfig {
  hideWelcomeModal?: boolean;
  idioma?: Idioma;
  umPorPixelPadrao?: number;
}

const LOCAL_STORAGE_CONFIG_KEY = "cytocount_user_config_v1";

export async function lerConfigUsuario(): Promise<UserConfig> {
  let localCfg: UserConfig = {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (raw) localCfg = JSON.parse(raw);
  } catch {
    // Ignora
  }

  try {
    const jsonStr = await invoke<string>("get_user_config");
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      return { ...localCfg, ...parsed };
    }
  } catch {
    // Fallback para localStorage
  }
  return localCfg;
}

export async function salvarConfigUsuario(patch: Partial<UserConfig>): Promise<UserConfig> {
  const atual = await lerConfigUsuario();
  const novo: UserConfig = { ...atual, ...patch };
  try {
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(novo));
  } catch {
    // Ignora
  }
  try {
    await invoke<string>("save_user_config", {
      configJson: JSON.stringify(novo, null, 2),
    });
  } catch {
    // Fallback salvo em localStorage
  }
  return novo;
}

export async function salvarArquivoComDialogo(
  nomePadrao: string,
  conteudo: string,
  ehBase64: boolean,
  filtroNome: string,
  extensao: string
): Promise<string | null> {
  try {
    const caminhoSalvo = await invoke<string | null>("salvar_arquivo_dialogo", {
      nomePadrao,
      conteudo,
      ehBase64,
      filtroNome,
      extensao,
    });
    return caminhoSalvo;
  } catch (err) {
    // Fallback web caso não esteja dentro do Tauri
    try {
      let blob: Blob;
      if (ehBase64) {
        const bin = atob(conteudo);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes]);
      } else {
        blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomePadrao;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return nomePadrao;
    } catch (e2) {
      await registrarLogApp("error", `Falha ao salvar arquivo ${nomePadrao}: ${err} / ${e2}`);
      throw new Error(String(err));
    }
  }
}

export interface ROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MotorSegmentacao = "watershed" | "stardist" | "cellpose";
export type TipoAnalise = "viabilidade" | "citoplasma";

export interface Parametros {
  bias_azul: number;
  bias_verde: number;
  bias_amarelo: number;
  aplicar_bilateral: boolean;
  min_circularidade: number;
  area_maxima: number | null;
  formula_viabilidade: string;
  motor_segmentacao?: MotorSegmentacao;
  segmentar_citoplasma?: boolean;
  raio_citoplasma?: number;
  roi?: ROI | null;
  tipo_analise?: TipoAnalise;
}

export type ClasseCelula = "viavel" | "morta" | "indeterminada" | "com_citoplasma" | "sem_citoplasma";

export interface CelulaIndividual {
  celula_id: number;
  area_px: number;
  area_citoplasma_px?: number;
  area_total_px?: number;
  area_regiao_px?: number;
  centro_x: number;
  centro_y: number;
  raio_eq?: number;
  mean_intensity?: number;
  intensidade_verde?: number;
  intensidade_azul?: number;
  razao_nc?: number | null;
  cobertura_verde_pct: number;
  cobertura_amarela_pct: number;
  classificacao: ClasseCelula;
  contorno_pts?: number[][];
  contorno_citoplasma_pts?: number[][];
  manual?: boolean;
}

export interface ManualEdit {
  timestamp: string;
  tipo: "alterar_classe" | "excluir_celula" | "adicionar_celula";
  celula_id: number;
  centro_x: number;
  centro_y: number;
  classe_anterior?: ClasseCelula;
  classe_nova?: ClasseCelula;
}

export interface RelatorioAmostra {
  Arquivo: string;
  "Tipo de Análise"?: TipoAnalise;
  "Total (Azul)": number;
  Detectados: number;
  "Viáveis (Verde)": number;
  "Mortas (Amarelo)": number;
  Indeterminadas: number;
  "Pct Viáveis (%)": number;
  "Pct Mortas (%)": number;
  "Pct Indeterminadas (%)": number;
  "Base de Cálculo": number;
  "Viabilidade (%)": number;
  "IC 95% Baixo": number;
  "IC 95% Alto": number;
  "Viabilidade Formatada PT"?: string;
  "Viabilidade Formatada EN"?: string;
  "Viabilidade Formatada ES"?: string;
  "Alerta Indeterminadas": boolean;
  ROI?: string;
  "ROI Dict"?: ROI | null;
  "Edições Manuais"?: number;
  "Motor de Segmentação"?: string;
  "Formato com perda (JPEG)": "Sim" | "Não";
  // Métricas de Citoplasma
  "Com Citoplasma"?: number;
  "Sem Citoplasma"?: number;
  "Pct Com Citoplasma (%)"?: number;
  "Área Média Núcleo (px²)"?: number;
  "Área Média Citoplasma (px²)"?: number;
  "Área Média Total (px²)"?: number;
  "Razão N:C Média"?: number;
}

export interface ResultadoProcessamento {
  id: string;
  relatorio: RelatorioAmostra;
  processada_png_b64: string;
  original_png_b64: string;
  mascaras_b64: {
    azul: string;
    verde: string;
    amarelo: string;
  };
  tabela_celulas?: CelulaIndividual[];
  manual_edits?: ManualEdit[];
  erro?: string;
  arquivo?: string;
}

export async function aguardarBackend(
  tentativas = 120,
  intervaloMs = 500,
  onTentativa?: (atual: number, total: number) => void
): Promise<boolean> {
  const base = await obterApiBase();
  for (let i = 0; i < tentativas; i++) {
    onTentativa?.(i + 1, tentativas);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1200);
      const r = await fetch(`${base}/api/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) {
        const data = await r.json().catch(() => null);
        if (data && data.status === "ok") return true;
      }
    } catch {
      // Ainda subindo
    }
    await new Promise((res) => setTimeout(res, intervaloMs));
  }
  return false;
}

export async function processarImagem(
  arquivo: File,
  p: Parametros,
  idioma: Idioma = "pt",
  signal?: AbortSignal
): Promise<ResultadoProcessamento> {
  const base = await obterApiBase();
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  fd.append("bias_azul", String(p.bias_azul));
  fd.append("bias_verde", String(p.bias_verde));
  fd.append("bias_amarelo", String(p.bias_amarelo));
  fd.append("aplicar_bilateral", String(p.aplicar_bilateral));
  fd.append("min_circularidade", String(p.min_circularidade));
  if (p.area_maxima !== null && p.area_maxima > 0) {
    fd.append("area_maxima", String(p.area_maxima));
  }
  fd.append("formula_viabilidade", p.formula_viabilidade);
  fd.append("motor_segmentacao", p.motor_segmentacao ?? "watershed");
  fd.append("segmentar_citoplasma", String(p.segmentar_citoplasma ?? true));
  fd.append("raio_citoplasma", String(p.raio_citoplasma ?? 8));
  fd.append("tipo_analise", p.tipo_analise ?? "viabilidade");
  if (p.roi) {
    fd.append("roi_json", JSON.stringify(p.roi));
  }
  fd.append("idioma", idioma);

  const resp = await fetch(`${base}/api/process`, {
    method: "POST",
    body: fd,
    signal,
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => null);
    const msg = errBody?.erro || `HTTP ${resp.status} ao processar ${arquivo.name}`;
    await registrarLogApp("error", msg);
    throw new Error(msg);
  }
  return resp.json();
}

export async function reprocessarAmostra(
  jobId: string,
  p: Parametros,
  idioma: Idioma = "pt",
  signal?: AbortSignal
): Promise<ResultadoProcessamento> {
  const base = await obterApiBase();
  const fd = new FormData();
  fd.append("bias_azul", String(p.bias_azul));
  fd.append("bias_verde", String(p.bias_verde));
  fd.append("bias_amarelo", String(p.bias_amarelo));
  fd.append("aplicar_bilateral", String(p.aplicar_bilateral));
  fd.append("min_circularidade", String(p.min_circularidade));
  if (p.area_maxima !== null && p.area_maxima > 0) {
    fd.append("area_maxima", String(p.area_maxima));
  }
  fd.append("formula_viabilidade", p.formula_viabilidade);
  fd.append("motor_segmentacao", p.motor_segmentacao ?? "watershed");
  fd.append("segmentar_citoplasma", String(p.segmentar_citoplasma ?? true));
  fd.append("raio_citoplasma", String(p.raio_citoplasma ?? 8));
  fd.append("tipo_analise", p.tipo_analise ?? "viabilidade");
  if (p.roi) {
    fd.append("roi_json", JSON.stringify(p.roi));
  }
  fd.append("idioma", idioma);

  const resp = await fetch(`${base}/api/reprocess/${jobId}`, {
    method: "POST",
    body: fd,
    signal,
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => null);
    const msg = errBody?.erro || `HTTP ${resp.status} ao reprocessar amostra`;
    await registrarLogApp("error", msg);
    throw new Error(msg);
  }
  return resp.json();
}

export async function atualizarCelulasManual(
  jobId: string,
  tabelaCelulas: CelulaIndividual[],
  manualEdits: ManualEdit[],
  formulaViabilidade: string,
  idioma: Idioma = "pt"
): Promise<Partial<ResultadoProcessamento>> {
  const base = await obterApiBase();
  const resp = await fetch(`${base}/api/update-cells/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tabela_celulas: tabelaCelulas,
      manual_edits: manualEdits,
      formula_viabilidade: formulaViabilidade,
      idioma,
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => null);
    const msg = errBody?.erro || `HTTP ${resp.status} ao atualizar células manualmente`;
    await registrarLogApp("error", msg);
    throw new Error(msg);
  }
  return resp.json();
}

export async function carregarAmostraDemo(
  idioma: Idioma = "pt",
  motorSegmentacao: MotorSegmentacao = "watershed",
  tipoAnalise: TipoAnalise = "viabilidade"
): Promise<ResultadoProcessamento> {
  const base = await obterApiBase();
  const fd = new FormData();
  fd.append("idioma", idioma);
  fd.append("motor_segmentacao", motorSegmentacao);
  fd.append("tipo_analise", tipoAnalise);
  const resp = await fetch(`${base}/api/sample-demo`, { method: "POST", body: fd });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => null);
    const msg = errBody?.erro || `HTTP ${resp.status} ao carregar imagem de exemplo`;
    await registrarLogApp("error", msg);
    throw new Error(msg);
  }
  return resp.json();
}

export async function mesclarCanaisAPI(opcoes: {
  arquivoAzul?: File | null;
  arquivoVerde?: File | null;
  arquivoAmarelo?: File | null;
  arquivoMulticanal?: File | null;
  apenasPreview: boolean;
  nomeAmostra: string;
  parametros: Parametros;
  idioma: Idioma;
}): Promise<any> {
  const base = await obterApiBase();
  const fd = new FormData();
  if (opcoes.arquivoAzul) fd.append("arquivo_azul", opcoes.arquivoAzul);
  if (opcoes.arquivoVerde) fd.append("arquivo_verde", opcoes.arquivoVerde);
  if (opcoes.arquivoAmarelo) fd.append("arquivo_amarelo", opcoes.arquivoAmarelo);
  if (opcoes.arquivoMulticanal) fd.append("arquivo_multicanal", opcoes.arquivoMulticanal);
  fd.append("apenas_preview", String(opcoes.apenasPreview));
  fd.append("nome_amostra", opcoes.nomeAmostra);
  fd.append("bias_azul", String(opcoes.parametros.bias_azul));
  fd.append("bias_verde", String(opcoes.parametros.bias_verde));
  fd.append("bias_amarelo", String(opcoes.parametros.bias_amarelo));
  fd.append("aplicar_bilateral", String(opcoes.parametros.aplicar_bilateral));
  fd.append("min_circularidade", String(opcoes.parametros.min_circularidade));
  if (opcoes.parametros.area_maxima) {
    fd.append("area_maxima", String(opcoes.parametros.area_maxima));
  }
  fd.append("formula_viabilidade", opcoes.parametros.formula_viabilidade);
  fd.append("motor_segmentacao", opcoes.parametros.motor_segmentacao ?? "watershed");
  fd.append("segmentar_citoplasma", String(opcoes.parametros.segmentar_citoplasma ?? true));
  fd.append("raio_citoplasma", String(opcoes.parametros.raio_citoplasma ?? 8));
  fd.append("tipo_analise", opcoes.parametros.tipo_analise ?? "viabilidade");
  fd.append("idioma", opcoes.idioma);

  const resp = await fetch(`${base}/api/merge-channels`, { method: "POST", body: fd });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => null);
    const msg = errBody?.erro || `HTTP ${resp.status} ao mesclar canais`;
    await registrarLogApp("error", msg);
    throw new Error(msg);
  }
  return resp.json();
}

export interface OpcoesPublicacao {
  formato: "png" | "tiff" | "pdf" | "svg";
  dpi: 300 | 600;
  idioma: Idioma;
  mostrar_contornos: boolean;
  mostrar_legenda?: boolean;
  tema_fundo: "escuro" | "claro" | "invertido";
  paleta_daltonismo: boolean;
  lado_a_lado: boolean;
  um_por_pixel: number | null;
  tamanho_barra_um: number;
}

export async function exportarFiguraPublicacaoAPI(
  jobId: string,
  opcoes: OpcoesPublicacao
): Promise<{
  conteudo_b64?: string;
  nome_sugerido?: string;
  extensao?: string;
  mime?: string;
  erro?: string;
}> {
  const base = await obterApiBase();
  const resp = await fetch(`${base}/api/export-publication/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opcoes),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => null);
    const msg = errBody?.erro || `HTTP ${resp.status} ao exportar figura para publicação`;
    await registrarLogApp("error", msg);
    throw new Error(msg);
  }
  return resp.json();
}

export async function exportarZipBase64(
  ids: string[]
): Promise<{ conteudo_b64?: string; nome_sugerido?: string; erro?: string }> {
  const base = await obterApiBase();
  const q = encodeURIComponent(ids.join(","));
  const resp = await fetch(`${base}/api/export-zip-b64?ids=${q}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function limparSessaoBackend(): Promise<void> {
  try {
    const base = await obterApiBase();
    await fetch(`${base}/api/session`, { method: "DELETE" });
  } catch {
    // Ignora
  }
}

export function urlExportZip(ids: string[]): string {
  const q = encodeURIComponent(ids.join(","));
  return `${resolvedApiBase}/api/export-zip?ids=${q}`;
}

export async function selecionarPastaEListarImagens(): Promise<File[] | null> {
  try {
    const pasta = await invoke<string | null>("selecionar_pasta");
    if (!pasta) return null;

    const lista = await invoke<
      Array<{ nome: string; caminho: string; tamanho: number }>
    >("listar_imagens_pasta", { caminhoPasta: pasta });

    const arquivos: File[] = [];
    for (const item of lista) {
      const bytes = await invoke<number[]>("ler_arquivo_bytes", {
        caminho: item.caminho,
      });
      const uint8 = new Uint8Array(bytes);
      const ext = item.nome.split(".").pop()?.toLowerCase() ?? "png";
      const mime =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "bmp"
          ? "image/bmp"
          : ext === "tif" || ext === "tiff"
          ? "image/tiff"
          : "image/png";
      arquivos.push(new File([uint8], item.nome, { type: mime }));
    }
    return arquivos;
  } catch (err) {
    await registrarLogApp("error", `Erro ao selecionar pasta: ${err}`);
    return null;
  }
}
