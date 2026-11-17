import { useState } from "react";
import { ResultadoProcessamento } from "../lib/api";
import { CheckIcon } from "./Icons";

export default function GaleriaAoVivo({ resultados }: { resultados: ResultadoProcessamento[] }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const alternar = (id: string) => {
    setAbertos((prev) => {
      const novo = new Set(prev);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  };

  return (
    <div className="space-y-2">
      {resultados.map((r) => {
        if (r.erro) {
          return (
            <div key={r.arquivo} className="rounded border border-morta/40 bg-morta/10 px-3 py-2 text-sm">
              Erro ao processar "{r.arquivo}": {r.erro}
            </div>
          );
        }
        const aberto = abertos.has(r.id);
        return (
          <div key={r.id} className="rounded border border-lab-line bg-lab-panel overflow-hidden">
            <button
              onClick={() => alternar(r.id)}
              className="w-full text-left px-3 py-2 flex justify-between items-center hover:bg-lab-panel2"
            >
              <span>
                <CheckIcon size={14} /> {r.relatorio.Arquivo} — Viabilidade:{" "}
                <span className="text-viavel font-mono">{r.relatorio["Viabilidade (%)"]}%</span>
              </span>
              <span className="text-lab-dim text-xs">{aberto ? "▲" : "▼"}</span>
            </button>
            {aberto && (
              <div className="grid grid-cols-3 gap-4 px-3 py-3 border-t border-lab-line">
                <div className="text-sm space-y-1">
                  <p><span className="text-lab-dim">Total de células:</span> {r.relatorio["Total (Azul)"]}</p>
                  <p><span className="text-lab-dim">Vivas:</span> {r.relatorio["Viáveis (Verde)"]}</p>
                  <p><span className="text-lab-dim">Mortas:</span> {r.relatorio["Mortas (Amarelo)"]}</p>
                </div>
                <div className="col-span-2">
                  <img
                    src={`data:image/png;base64,${r.processada_png_b64}`}
                    alt={r.relatorio.Arquivo}
                    className="w-full rounded"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
