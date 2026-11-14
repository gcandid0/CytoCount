import { useRef, useState } from "react";
import {
  APP_VERSION,
  Parametros,
  ResultadoProcessamento,
  salvarArquivoComDialogo,
} from "../lib/api";
import { CITACAO_OFICIAL, Idioma, TEXTOS } from "../lib/i18n";
import {
  formatarDecimal,
  formatarInteiro,
  formatarPercentual,
  formatarViabilidadeDeContagem,
  formatarViabilidadeIC,
  obterLocale,
} from "../lib/format";
import {
  AlertTriangleIcon,
  DownloadIcon,
  PrinterIcon,
  XIcon,
} from "./Icons";

export default function RelatorioImpressao({
  resultados,
  parametros,
  idioma,
  onFechar,
  onNotificar,
}: {
  resultados: ResultadoProcessamento[];
  parametros: Parametros;
  idioma: Idioma;
  onFechar: () => void;
  onNotificar?: (msg: string, tipo?: "sucesso" | "erro" | "info") => void;
}) {
  const [temaImpressao, setTemaImpressao] = useState<"escuro" | "claro">("escuro");
  const containerRef = useRef<HTMLDivElement>(null);
  const t = TEXTOS[idioma];

  const validos = resultados.filter((r) => !r.erro);
  if (validos.length === 0) return null;

  const totalDetectados = validos.reduce(
    (s, r) => s + (r.relatorio.Detectados ?? r.relatorio["Total (Azul)"] ?? 0),
    0
  );
  const totalVivas = validos.reduce(
    (s, r) => s + (r.relatorio["Viáveis (Verde)"] ?? 0),
    0
  );
  const totalMortas = validos.reduce(
    (s, r) => s + (r.relatorio["Mortas (Amarelo)"] ?? 0),
    0
  );
  const totalIndet = Math.max(0, totalDetectados - totalVivas - totalMortas);

  const pctVivasGlobal =
    totalDetectados > 0 ? (totalVivas / totalDetectados) * 100 : 0;
  const pctMortasGlobal =
    totalDetectados > 0 ? (totalMortas / totalDetectados) * 100 : 0;
  const pctIndetGlobal =
    totalDetectados > 0 ? (totalIndet / totalDetectados) * 100 : 0;

  const ehRigoroso = parametros.formula_viabilidade.includes("Rigoroso");
  const baseGlobal = ehRigoroso ? totalDetectados : totalVivas + totalMortas;
  const statsViabGlobal = formatarViabilidadeDeContagem(
    totalVivas,
    baseGlobal,
    idioma
  );
  const alertaQualidadeGlobal = pctIndetGlobal > 15;

  const todasEdicoesManuais = validos.flatMap((r) =>
    (r.manual_edits ?? []).map((ed) => ({
      arquivo: r.relatorio.Arquivo,
      ...ed,
    }))
  );

  const handleSalvarHTML = async () => {
    try {
      if (!containerRef.current) return;
      const htmlInterno = containerRef.current.innerHTML;
      const bg = temaImpressao === "escuro" ? "#0b1215" : "#ffffff";
      const fg = temaImpressao === "escuro" ? "#e6edf3" : "#0f172a";
      const docCompleto = `<!DOCTYPE html>
<html lang="${idioma}">
<head>
<meta charset="UTF-8" />
<title>CytoCount v${APP_VERSION} - Relatório Executivo</title>
<style>
  body { background: ${bg}; color: ${fg}; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 32px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th, td { border: 1px solid ${temaImpressao === "escuro" ? "#1e2d34" : "#cbd5e1"}; padding: 8px 10px; text-align: left; }
  .num { text-align: right; font-family: monospace; }
  .print-summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 18px 0; }
  .print-stat-box { border: 1px solid ${temaImpressao === "escuro" ? "#1e2d34" : "#cbd5e1"}; border-radius: 8px; padding: 12px; }
  .print-images-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .print-sample-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  img { max-width: 100%; border-radius: 6px; }
</style>
</head>
<body>
${htmlInterno}
</body>
</html>`;
      const dataStr = new Date().toISOString().slice(0, 10);
      const salvo = await salvarArquivoComDialogo(
        `CytoCount_Relatorio_${dataStr}.html`,
        docCompleto,
        false,
        "Relatório HTML (*.html)",
        "html"
      );
      if (salvo) {
        onNotificar?.(`${t.toast_saved_at} ${salvo}`, "sucesso");
      }
    } catch (e) {
      onNotificar?.(`Erro ao salvar HTML: ${e}`, "erro");
    }
  };

  return (
    <div className={`print-overlay theme-${temaImpressao}`}>
      <div className="print-actions no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onFechar}>
            <XIcon size={15} />
            <span>Voltar ao Programa</span>
          </button>

          <div className="report-theme-switch">
            <button
              type="button"
              className={`theme-pill ${temaImpressao === "escuro" ? "active" : ""}`}
              onClick={() => setTemaImpressao("escuro")}
            >
              Tema Escuro (#0b1215)
            </button>
            <button
              type="button"
              className={`theme-pill ${temaImpressao === "claro" ? "active" : ""}`}
              onClick={() => setTemaImpressao("claro")}
            >
              Variante Clara (Impressão em Papel)
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSalvarHTML}
          >
            <DownloadIcon size={15} />
            <span>Salvar HTML</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ width: "auto", padding: "0 20px" }}
            onClick={() => window.print()}
          >
            <PrinterIcon size={15} />
            <span>Imprimir / Exportar PDF</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`print-sheet print-sheet-${temaImpressao}`}
      >
        <header className="print-header">
          <div>
            <h1>CytoCount — Relatório Executivo de Viabilidade Celular</h1>
            <p>
              Motor de Segmentação:{" "}
              {parametros.motor_segmentacao === "stardist"
                ? "StarDist 2D (Polígonos Estrelados & NMS)"
                : parametros.motor_segmentacao === "cellpose"
                ? "Cellpose 2D (Fluxo Vetorial & CLAHE)"
                : "Watershed Clássico & Limiarização Adaptativa de Otsu"}{" "}
              · <span className="mono-tag">Versão {APP_VERSION}</span>
            </p>
          </div>
          <div className="print-meta">
            <div>
              <strong>Data:</strong>{" "}
              {new Date().toLocaleDateString(obterLocale(idioma))}
            </div>
            <div>
              <strong>Hora:</strong>{" "}
              {new Date().toLocaleTimeString(obterLocale(idioma))}
            </div>
            <div>
              <strong>{t.card_samples}:</strong>{" "}
              {formatarInteiro(validos.length, idioma)}
            </div>
          </div>
        </header>

        {/* Resumo Executivo: 4 Contagens + Viabilidade com IC 95% */}
        <section className="print-section">
          <h2>1. Resumo Executivo Consolidado</h2>
          <div className="print-summary-grid">
            <div className="print-stat-box stat-blue">
              <span className="print-stat-val">
                {formatarInteiro(totalDetectados, idioma)}
              </span>
              <span className="print-stat-lbl">{t.card_detected} (100%)</span>
            </div>
            <div className="print-stat-box stat-green">
              <span className="print-stat-val">
                {formatarInteiro(totalVivas, idioma)}{" "}
                <small>({formatarPercentual(pctVivasGlobal, idioma, 1)})</small>
              </span>
              <span className="print-stat-lbl">{t.card_live}</span>
            </div>
            <div className="print-stat-box stat-yellow">
              <span className="print-stat-val">
                {formatarInteiro(totalMortas, idioma)}{" "}
                <small>({formatarPercentual(pctMortasGlobal, idioma, 1)})</small>
              </span>
              <span className="print-stat-lbl">{t.card_dead}</span>
            </div>
            <div className="print-stat-box stat-muted">
              <span className="print-stat-val">
                {formatarInteiro(totalIndet, idioma)}{" "}
                <small>({formatarPercentual(pctIndetGlobal, idioma, 1)})</small>
              </span>
              <span className="print-stat-lbl">{t.card_undetermined}</span>
            </div>
            <div className="print-stat-box stat-highlight">
              <span className="print-stat-val print-stat-ic">
                {statsViabGlobal.formatado}
              </span>
              <span className="print-stat-lbl">{t.card_viability}</span>
            </div>
          </div>

          {alertaQualidadeGlobal && (
            <div className="quality-warning-banner" style={{ marginTop: 12 }}>
              <AlertTriangleIcon size={18} />
              <div>
                <strong>{t.warn_undetermined_title}</strong>
                <p>{t.warn_undetermined_desc}</p>
              </div>
            </div>
          )}
        </section>

        {/* Gráfico de Barras de Viabilidade por Amostra com Barras de Erro (IC 95% de Wilson) */}
        <section className="print-section">
          <h2>2. Gráfico de Viabilidade por Amostra (com Barras de Erro IC 95% de Wilson)</h2>
          <div className="print-chart-box">
            <svg
              viewBox={`0 0 760 ${Math.max(150, validos.length * 42 + 50)}`}
              className="report-bar-chart-svg"
            >
              {/* Linhas de grade verticais (0%, 25%, 50%, 75%, 100%) */}
              {[0, 25, 50, 75, 100].map((tick) => {
                const x = 190 + (tick / 100) * 440;
                return (
                  <g key={tick}>
                    <line
                      x1={x}
                      y1={20}
                      x2={x}
                      y2={validos.length * 42 + 25}
                      stroke={temaImpressao === "escuro" ? "#1e2d34" : "#e2e8f0"}
                      strokeDasharray="3,3"
                    />
                    <text
                      x={x}
                      y={validos.length * 42 + 42}
                      textAnchor="middle"
                      fill={temaImpressao === "escuro" ? "#8b9bb4" : "#475569"}
                      fontSize="11"
                      fontFamily="monospace"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}

              {validos.map((r, idx) => {
                const y = 28 + idx * 42;
                const v = r.relatorio["Viabilidade (%)"] ?? 0;
                const lo = r.relatorio["IC 95% Baixo"] ?? v;
                const hi = r.relatorio["IC 95% Alto"] ?? v;
                const barW = Math.max(2, (v / 100) * 440);
                const xLo = 190 + (lo / 100) * 440;
                const xHi = 190 + (hi / 100) * 440;
                const nomeCurto =
                  r.relatorio.Arquivo.length > 24
                    ? r.relatorio.Arquivo.slice(0, 21) + "..."
                    : r.relatorio.Arquivo;

                return (
                  <g key={r.id}>
                    <text
                      x={180}
                      y={y + 15}
                      textAnchor="end"
                      fill={temaImpressao === "escuro" ? "#e6edf3" : "#0f172a"}
                      fontSize="11.5"
                      fontFamily="monospace"
                    >
                      {nomeCurto}
                    </text>
                    <rect
                      x={190}
                      y={y}
                      width={barW}
                      height={22}
                      rx={4}
                      fill="#10b981"
                      fillOpacity={0.82}
                    />
                    {/* Barra de erro horizontal IC 95% de Wilson */}
                    <line
                      x1={xLo}
                      y1={y + 11}
                      x2={xHi}
                      y2={y + 11}
                      stroke={temaImpressao === "escuro" ? "#f8fafc" : "#0f172a"}
                      strokeWidth="1.8"
                    />
                    <line
                      x1={xLo}
                      y1={y + 5}
                      x2={xLo}
                      y2={y + 17}
                      stroke={temaImpressao === "escuro" ? "#f8fafc" : "#0f172a"}
                      strokeWidth="1.8"
                    />
                    <line
                      x1={xHi}
                      y1={y + 5}
                      x2={xHi}
                      y2={y + 17}
                      stroke={temaImpressao === "escuro" ? "#f8fafc" : "#0f172a"}
                      strokeWidth="1.8"
                    />
                    <text
                      x={640}
                      y={y + 15}
                      fill={temaImpressao === "escuro" ? "#34d399" : "#047857"}
                      fontSize="11"
                      fontFamily="monospace"
                    >
                      {formatarDecimal(v, idioma, 1)}% [{formatarDecimal(lo, idioma, 1)}–
                      {formatarDecimal(hi, idioma, 1)}]
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        {/* Tabela Detalhada por Amostra */}
        <section className="print-section">
          <h2>3. Tabela Analítica por Amostra</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>{t.col_file}</th>
                <th className="num">{t.col_detected}</th>
                <th className="num">{t.col_live}</th>
                <th className="num">{t.col_dead}</th>
                <th className="num">{t.col_undetermined}</th>
                <th className="num">{t.col_viability}</th>
                <th className="num">{t.col_roi}</th>
                <th className="num">{t.col_edits}</th>
              </tr>
            </thead>
            <tbody>
              {validos.map((r) => {
                const det = r.relatorio.Detectados ?? r.relatorio["Total (Azul)"] ?? 0;
                const viv = r.relatorio["Viáveis (Verde)"] ?? 0;
                const mor = r.relatorio["Mortas (Amarelo)"] ?? 0;
                const ind =
                  r.relatorio.Indeterminadas ?? Math.max(0, det - viv - mor);
                const viab = r.relatorio["Viabilidade (%)"] ?? 0;
                const lo = r.relatorio["IC 95% Baixo"] ?? 0;
                const hi = r.relatorio["IC 95% Alto"] ?? 0;
                return (
                  <tr key={r.id}>
                    <td>{r.relatorio.Arquivo}</td>
                    <td className="num">{formatarInteiro(det, idioma)}</td>
                    <td className="num">
                      {formatarInteiro(viv, idioma)} (
                      {formatarPercentual(
                        det > 0 ? (viv / det) * 100 : 0,
                        idioma,
                        1
                      )}
                      )
                    </td>
                    <td className="num">
                      {formatarInteiro(mor, idioma)} (
                      {formatarPercentual(
                        det > 0 ? (mor / det) * 100 : 0,
                        idioma,
                        1
                      )}
                      )
                    </td>
                    <td className="num">
                      {formatarInteiro(ind, idioma)} (
                      {formatarPercentual(
                        det > 0 ? (ind / det) * 100 : 0,
                        idioma,
                        1
                      )}
                      )
                    </td>
                    <td className="num">
                      <strong>{formatarViabilidadeIC(viab, lo, hi, idioma)}</strong>
                    </td>
                    <td className="num">{r.relatorio.ROI ?? "Imagem Completa"}</td>
                    <td className="num">
                      {formatarInteiro(r.manual_edits?.length ?? 0, idioma)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Parâmetros Usados & Registro de Correções Manuais */}
        <section className="print-section">
          <h2>4. Parâmetros de Calibração e Auditoria de Edições Manuais</h2>
          <div className="print-params-box">
            <div>
              <strong>Motor de Segmentação:</strong>{" "}
              {parametros.motor_segmentacao === "stardist"
                ? "StarDist 2D (Schmidt et al., 2018)"
                : parametros.motor_segmentacao === "cellpose"
                ? "Cellpose 2D (Stringer et al., 2021)"
                : "Watershed Clássico"}
            </div>
            <div>
              <strong>Fórmula de Viabilidade:</strong> {parametros.formula_viabilidade}
            </div>
            <div>
              <strong>Filtro Bilateral:</strong>{" "}
              {parametros.aplicar_bilateral ? "Ativado (d=5, sigma=50)" : "Desativado"}
            </div>
            <div>
              <strong>Bias Otsu (Azul / Verde / Amarelo):</strong> {parametros.bias_azul} /{" "}
              {parametros.bias_verde} / {parametros.bias_amarelo}
            </div>
            <div>
              <strong>Circularidade Mínima:</strong>{" "}
              {formatarDecimal(parametros.min_circularidade, idioma, 2)}
            </div>
            <div>
              <strong>Área Máxima do Núcleo:</strong>{" "}
              {parametros.area_maxima ? `${parametros.area_maxima} px²` : "Automático"}
            </div>
            <div>
              <strong>Região de Interesse (ROI):</strong>{" "}
              {parametros.roi
                ? `${parametros.roi.w}x${parametros.roi.h} px em (${parametros.roi.x}, ${parametros.roi.y})`
                : "Imagem Completa"}
            </div>
          </div>

          {todasEdicoesManuais.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ fontSize: 13, margin: "8px 0" }}>
                Registro de Correções Manuais ({todasEdicoesManuais.length})
              </h4>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Amostra</th>
                    <th>Ação</th>
                    <th className="num">Célula ID</th>
                    <th className="num">Coordenada (X, Y)</th>
                    <th>Alteração</th>
                  </tr>
                </thead>
                <tbody>
                  {todasEdicoesManuais.slice(0, 50).map((ed, idx) => (
                    <tr key={idx}>
                      <td>{ed.arquivo}</td>
                      <td>{ed.tipo}</td>
                      <td className="num">#{ed.celula_id}</td>
                      <td className="num">
                        ({ed.centro_x}, {ed.centro_y})
                      </td>
                      <td>
                        {ed.classe_anterior
                          ? `${ed.classe_anterior} -> ${ed.classe_nova ?? "removida"}`
                          : ed.classe_nova ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="field-help" style={{ marginTop: 8 }}>
              Nenhuma correção manual aplicada (resultado 100% automático).
            </p>
          )}
        </section>

        {/* Imagens Original e Processada Lado a Lado */}
        <section className="print-section">
          <h2>5. Painel Comparativo Lado a Lado (Original | Processada)</h2>
          <div className="print-samples-pair-list">
            {validos.slice(0, 8).map((r) => (
              <div key={r.id} className="print-sample-comparison-card">
                <div className="print-sample-card-header">
                  <strong>{r.relatorio.Arquivo}</strong>
                  <span className="mono-tag">
                    {formatarViabilidadeIC(
                      r.relatorio["Viabilidade (%)"],
                      r.relatorio["IC 95% Baixo"],
                      r.relatorio["IC 95% Alto"],
                      idioma
                    )}
                  </span>
                </div>
                <div className="print-sample-pair">
                  <figure>
                    <img
                      src={`data:image/png;base64,${r.original_png_b64}`}
                      alt={`Original ${r.relatorio.Arquivo}`}
                    />
                    <figcaption>A · Original</figcaption>
                  </figure>
                  <figure>
                    <img
                      src={`data:image/png;base64,${r.processada_png_b64}`}
                      alt={`Processada ${r.relatorio.Arquivo}`}
                    />
                    <figcaption>
                      B · Segmentada (Detectados:{" "}
                      {formatarInteiro(
                        r.relatorio.Detectados ?? r.relatorio["Total (Azul)"],
                        idioma
                      )}{" "}
                      | Vivas: {formatarInteiro(r.relatorio["Viáveis (Verde)"], idioma)} |
                      Mortas: {formatarInteiro(r.relatorio["Mortas (Amarelo)"], idioma)})
                    </figcaption>
                  </figure>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Como Citar */}
        <footer className="print-footer">
          <div className="print-citation-block">
            <strong>Como citar:</strong>
            <p>{CITACAO_OFICIAL}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
