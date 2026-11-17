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
  if (n <= 0) return [0, 0];
  const p = vivas / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const termo = (p * (1 - p)) / n + (z * z) / (4 * n * n);
  const m = z * Math.sqrt(Math.max(0, termo));
  const low = Math.max(0, ((c - m) / d) * 100);
  const high = Math.min(100, ((c + m) / d) * 100);
  return [Number(low.toFixed(1)), Number(high.toFixed(1))];
}

export function formatarViabilidadeIC(
  viabilidade: number,
  icBaixo: number,
  icAlto: number,
  idioma: Idioma
): string {
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
  const viabilidade =
    baseCalculo > 0 ? Number(Math.min(100, (vivas / baseCalculo) * 100).toFixed(1)) : 0;
  const [icBaixo, icAlto] = wilson(vivas, baseCalculo);
  return {
    viabilidade,
    icBaixo,
    icAlto,
    formatado: formatarViabilidadeIC(viabilidade, icBaixo, icAlto, idioma),
  };
}
