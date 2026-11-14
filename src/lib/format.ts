import { Idioma } from "./i18n";

export function obterLocale(idioma: Idioma): string {
  if (idioma === "en") return "en-US";
  if (idioma === "es") return "es-ES";
  return "pt-BR";
}

export function formatarInteiro(valor: number | undefined | null, idioma: Idioma): string {
  const n = Number.isFinite(Number(valor)) ? Math.round(Number(valor)) : 0;
  return new Intl.NumberFormat(obterLocale(idioma), {
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatarDecimal(
  valor: number | undefined | null,
  idioma: Idioma,
  casas = 1
): string {
  const n = Number.isFinite(Number(valor)) ? Number(valor) : 0;
  return new Intl.NumberFormat(obterLocale(idioma), {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(n);
}

export function formatarPercentual(
  valor: number | undefined | null,
  idioma: Idioma,
  casas = 1
): string {
  return `${formatarDecimal(valor, idioma, casas)}%`;
}

export function wilson(vivas: number, n: number, z = 1.96): [number, number] {
  const v = Math.round(Number(vivas) || 0);
  const total = Math.round(Number(n) || 0);
  if (total <= 0) return [0, 0];
  const p = v / total;
  const d = 1 + (z * z) / total;
  const c = p + (z * z) / (2 * total);
  const termo = (p * (1 - p)) / total + (z * z) / (4 * total * total);
  const m = z * Math.sqrt(Math.max(0, termo));
  const low = Math.max(0, ((c - m) / d) * 100);
  const high = Math.min(100, ((c + m) / d) * 100);
  return [Number(low.toFixed(1)), Number(high.toFixed(1))];
}

export function formatarViabilidadeIC(
  viabilidade: number,
  icBaixo: number,
  icAlto: number,
  idioma: Idioma,
  baseCalculo = 1
): string {
  if (baseCalculo <= 0) return "\u2014";
  const vStr = formatarDecimal(viabilidade, idioma, 1);
  const loStr = formatarDecimal(icBaixo, idioma, 1);
  const hiStr = formatarDecimal(icAlto, idioma, 1);
  const labelIC = idioma === "en" ? "95% CI" : "IC 95%";
  return `${vStr}% (${labelIC}: ${loStr}\u2013${hiStr})`;
}

export function formatarViabilidadeDeContagem(
  vivas: number,
  baseCalculo: number,
  idioma: Idioma
): {
  viabilidade: number;
  icBaixo: number;
  icAlto: number;
  formatado: string;
} {
  const total = Math.round(Number(baseCalculo) || 0);
  if (total <= 0) {
    return {
      viabilidade: 0,
      icBaixo: 0,
      icAlto: 0,
      formatado: "\u2014",
    };
  }
  const v = Math.round(Number(vivas) || 0);
  const viabilidade = Number(Math.min(100, (v / total) * 100).toFixed(1));
  const [icBaixo, icAlto] = wilson(v, total);
  return {
    viabilidade,
    icBaixo,
    icAlto,
    formatado: formatarViabilidadeIC(viabilidade, icBaixo, icAlto, idioma, total),
  };
}
