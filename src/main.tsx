import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";

// Tratamento global de erros para evitar quebras silenciosas e permitir copiar detalhes
window.addEventListener("error", (event) => {
  const detalhes = `${event.message} em ${event.filename}:${event.lineno}:${event.colno}\n${event.error?.stack || ""}`;
  window.dispatchEvent(
    new CustomEvent("cytocount-global-error", {
      detail: {
        tipo: "JavaScript Error",
        mensagem: event.message || "Erro inesperado na interface",
        detalhes: detalhes.trim(),
      },
    })
  );
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const msg = reason?.message || String(reason) || "Promessa rejeitada sem tratamento";
  const detalhes = reason?.stack || String(reason);
  window.dispatchEvent(
    new CustomEvent("cytocount-global-error", {
      detail: {
        tipo: "Unhandled Promise Rejection",
        mensagem: msg,
        detalhes: detalhes.trim(),
      },
    })
  );
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
