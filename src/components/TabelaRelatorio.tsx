import { RelatorioAmostra } from "../lib/api";
import { Idioma, TEXTOS } from "../lib/i18n";
import {
  formatarInteiro,
  formatarPercentual,
  formatarViabilidadeIC,
} from "../lib/format";
import { AlertTriangleIcon } from "./Icons";

export default function TabelaRelatorio({
  relatorios,
  idPorLinha,
  selecionadoId,
  onSelecionar,
  idioma,
}: {
  relatorios: RelatorioAmostra[];
  idPorLinha: string[];
  selecionadoId?: string;
  onSelecionar: (id: string) => void;
  idioma: Idioma;
}) {
  if (relatorios.length === 0) return null;
  const t = TEXTOS[idioma];

  return (
    <div className="table-wrap">
      <table className="report-table">
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
          {relatorios.map((r, i) => {
            const id = idPorLinha[i];
            const det = r.Detectados ?? r["Total (Azul)"] ?? 0;
            const viv = r["Viáveis (Verde)"] ?? 0;
            const mor = r["Mortas (Amarelo)"] ?? 0;
            const ind = r.Indeterminadas ?? Math.max(0, det - viv - mor);
            const pctViv =
              r["Pct Viáveis (%)"] ?? (det > 0 ? (viv / det) * 100 : 0);
            const pctMor =
              r["Pct Mortas (%)"] ?? (det > 0 ? (mor / det) * 100 : 0);
            const pctInd =
              r["Pct Indeterminadas (%)"] ?? (det > 0 ? (ind / det) * 100 : 0);
            const viab = r["Viabilidade (%)"] ?? 0;
            const icLo = r["IC 95% Baixo"] ?? 0;
            const icHi = r["IC 95% Alto"] ?? 0;
            const alerta = pctInd > 15;

            return (
              <tr
                key={id}
                className={id === selecionadoId ? "row-selected" : ""}
                onClick={() => onSelecionar(id)}
              >
                <td>{r.Arquivo}</td>
                <td className="num">{formatarInteiro(det, idioma)}</td>
                <td className="num text-green">
                  {formatarInteiro(viv, idioma)}{" "}
                  <small className="table-pct">
                    ({formatarPercentual(pctViv, idioma, 1)})
                  </small>
                </td>
                <td className="num text-yellow">
                  {formatarInteiro(mor, idioma)}{" "}
                  <small className="table-pct">
                    ({formatarPercentual(pctMor, idioma, 1)})
                  </small>
                </td>
                <td className={`num ${alerta ? "text-yellow" : ""}`}>
                  {formatarInteiro(ind, idioma)}{" "}
                  <small className="table-pct">
                    ({formatarPercentual(pctInd, idioma, 1)})
                  </small>
                  {alerta && (
                    <span title={t.warn_undetermined_title} style={{ marginLeft: 4 }}>
                      <AlertTriangleIcon size={12} />
                    </span>
                  )}
                </td>
                <td className="num">
                  <span className="pill-viability">
                    {formatarViabilidadeIC(viab, icLo, icHi, idioma)}
                  </span>
                </td>
                <td className="num">{r.ROI ?? "Imagem Completa"}</td>
                <td className="num">{formatarInteiro(r["Edições Manuais"] ?? 0, idioma)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
