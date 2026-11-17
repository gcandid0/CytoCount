import { MotorSegmentacao, Parametros } from "../lib/api";
import { Idioma, TEXTOS } from "../lib/i18n";
import { formatarDecimal } from "../lib/format";
import { ChevronDownIcon, RefreshCwIcon, SlidersIcon } from "./Icons";

interface Props {
  parametros: Parametros;
  onChange: (p: Parametros) => void;
  ajusteFino: boolean;
  onAjusteFinoChange: (v: boolean) => void;
  mostrarMascaras: boolean;
  onMostrarMascarasChange: (v: boolean) => void;
  desabilitado: boolean;
  temPreviewAtivo?: boolean;
  reprocessandoPreview?: boolean;
  idioma: Idioma;
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  corClasse: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  help?: string;
  decimais?: number;
  idioma: Idioma;
}) {
  const display =
    props.decimais !== undefined
      ? formatarDecimal(props.value, props.idioma, props.decimais)
      : props.value > 0
      ? `+${props.value}`
      : String(props.value);
  return (
    <label className="field">
      <span className="field-label">
        {props.label} <b>{display}</b>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className={`slider ${props.corClasse}`}
      />
      {props.help && <span className="field-help">{props.help}</span>}
    </label>
  );
}

export default function PainelCalibracao({
  parametros,
  onChange,
  ajusteFino,
  onAjusteFinoChange,
  mostrarMascaras,
  onMostrarMascarasChange,
  desabilitado,
  temPreviewAtivo,
  reprocessandoPreview,
  idioma,
}: Props) {
  const set = (patch: Partial<Parametros>) => onChange({ ...parametros, ...patch });
  const t = TEXTOS[idioma];

  return (
    <>
      <section className="panel-block">
        <h2 className="panel-title">{t.sec_calc}</h2>

        <label className="field">
          <span className="field-label">
            {idioma === "en"
              ? "Segmentation Engine"
              : idioma === "es"
              ? "Motor de segmentación"
              : "Motor de segmentação"}
          </span>
          <select
            className="select"
            value={parametros.motor_segmentacao ?? "watershed"}
            disabled={desabilitado}
            onChange={(e) =>
              set({ motor_segmentacao: e.target.value as MotorSegmentacao })
            }
          >
            <option value="watershed">
              {idioma === "en"
                ? "Classical Watershed (Fast · Default)"
                : idioma === "es"
                ? "Watershed Clásico (Rápido · Estándar)"
                : "Watershed Clássico (Rápido · Padrão)"}
            </option>
            <option value="stardist">
              {idioma === "en"
                ? "StarDist 2D (Star-Convex Polygons · NMS)"
                : idioma === "es"
                ? "StarDist 2D (Polígonos Estrellados · NMS)"
                : "StarDist 2D (Polígonos Estrelados · NMS)"}
            </option>
            <option value="cellpose">
              {idioma === "en"
                ? "Cellpose 2D (Gradient Vector Flow · CLAHE)"
                : idioma === "es"
                ? "Cellpose 2D (Flujo Vectorial · CLAHE)"
                : "Cellpose 2D (Fluxo Vetorial · CLAHE)"}
            </option>
          </select>
          <span className="field-help">
            {(parametros.motor_segmentacao ?? "watershed") === "stardist"
              ? idioma === "en"
                ? "StarDist 2D: 32-ray star-convex polygon projection + Non-Maximum Suppression (NMS) for round/touching nuclei."
                : idioma === "es"
                ? "StarDist 2D: polígonos estrellados de 32 rayos + supresión no-máxima (NMS) para núcleos densos."
                : "StarDist 2D: projeção de polígonos estrelados de 32 raios + supressão não-máxima (NMS) para núcleos redondos/densos."
              : (parametros.motor_segmentacao ?? "watershed") === "cellpose"
              ? idioma === "en"
                ? "Cellpose 2D: adaptive CLAHE + spatial gradient flow tracking (Euler integration) for confluent or dim cells."
                : idioma === "es"
                ? "Cellpose 2D: ecualización CLAHE + flujo de gradiente espacial (Euler) para células confluentes o tenues."
                : "Cellpose 2D: equalização CLAHE + rastreamento de fluxo vetorial de gradiente (Euler) para células confluentes ou de sinal tênue."
              : idioma === "en"
              ? "Classical Euclidean distance transform and watershed basin separation."
              : idioma === "es"
              ? "Transformada de distancia euclidiana clásica y separación por cuencas hidrográficas."
              : "Transformada de distância euclidiana clássica e separação por bacias hidrográficas."}
          </span>
        </label>

        <label className="field">
          <span className="field-label">{t.calc_formula}</span>
          <select
            className="select select-formula"
            value={parametros.formula_viabilidade}
            disabled={desabilitado}
            title={
              parametros.formula_viabilidade.includes("Rigoroso")
                ? t.formula_strict
                : t.formula_bio
            }
            onChange={(e) => set({ formula_viabilidade: e.target.value })}
          >
            <option value="Padrão Biológico (Vivas / (Vivas + Mortas))">{t.formula_bio}</option>
            <option value="Rigoroso (Vivas / Total Azul)">{t.formula_strict}</option>
          </select>
          <span className="field-help">{t.calc_help}</span>
        </label>

        <label className="field field-row">
          <span className="field-label">
            {idioma === "en"
              ? "Cytoplasm segmentation (Voronoi ring)"
              : idioma === "es"
              ? "Segmentar citoplasma (anillo Voronoi)"
              : "Segmentar citoplasma (anel Voronoi)"}
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={parametros.segmentar_citoplasma ?? true}
              disabled={desabilitado}
              onChange={(e) => set({ segmentar_citoplasma: e.target.checked })}
            />
            <span className="switch-track"></span>
          </span>
        </label>

        {(parametros.segmentar_citoplasma ?? true) && (
          <Slider
            label={
              idioma === "en"
                ? "Cytoplasm expansion (px)"
                : idioma === "es"
                ? "Expansión del citoplasma (px)"
                : "Expansão do citoplasma (px)"
            }
            value={parametros.raio_citoplasma ?? 8}
            min={2}
            max={25}
            step={1}
            corClasse="slider-green"
            disabled={desabilitado}
            onChange={(v) => set({ raio_citoplasma: v })}
            help={
              idioma === "en"
                ? "Expands cytoplasmic boundary from each nucleus without overlapping neighbors."
                : idioma === "es"
                ? "Expande el borde citoplasmático desde cada núcleo sin superponerse a células vecinas."
                : "Expande a borda citoplasmática a partir de cada núcleo (azul) sem invadir células vizinhas."
            }
            idioma={idioma}
          />
        )}

        <label className="field field-row">
          <span className="field-label">{t.bilateral_label}</span>
          <span className="switch">
            <input
              type="checkbox"
              checked={parametros.aplicar_bilateral}
              disabled={desabilitado}
              onChange={(e) => set({ aplicar_bilateral: e.target.checked })}
            />
            <span className="switch-track"></span>
          </span>
        </label>
      </section>

      <section className="panel-block">
        <button
          className="link-btn"
          type="button"
          aria-expanded={ajusteFino}
          onClick={() => onAjusteFinoChange(!ajusteFino)}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <SlidersIcon size={13} />
            {t.sec_fine_tune}
          </span>
          <ChevronDownIcon size={14} className="chev" />
        </button>

        {ajusteFino && (
          <div className="collapsible">
            {temPreviewAtivo && (
              <div className="live-preview-badge">
                <span className={`live-dot${reprocessandoPreview ? " pulsing" : ""}`} />
                <span>{reprocessandoPreview ? t.btn_processing : t.preview_active}</span>
              </div>
            )}
            <Slider
              label={t.slider_blue}
              value={parametros.bias_azul}
              min={-30}
              max={30}
              step={1}
              corClasse="slider-blue"
              disabled={desabilitado}
              onChange={(v) => set({ bias_azul: v })}
              help={t.slider_blue_help}
              idioma={idioma}
            />
            <Slider
              label={t.slider_green}
              value={parametros.bias_verde}
              min={-30}
              max={30}
              step={1}
              corClasse="slider-green"
              disabled={desabilitado}
              onChange={(v) => set({ bias_verde: v })}
              idioma={idioma}
            />
            <Slider
              label={t.slider_yellow}
              value={parametros.bias_amarelo}
              min={-30}
              max={30}
              step={1}
              corClasse="slider-yellow"
              disabled={desabilitado}
              onChange={(v) => set({ bias_amarelo: v })}
              idioma={idioma}
            />
            <Slider
              label={t.slider_circ}
              value={parametros.min_circularidade}
              min={0}
              max={0.8}
              step={0.05}
              decimais={2}
              corClasse="slider-neutral"
              disabled={desabilitado}
              onChange={(v) => set({ min_circularidade: v })}
              help={t.slider_circ_help}
              idioma={idioma}
            />

            <label className="field">
              <span className="field-label">{t.max_area_label}</span>
              <input
                type="number"
                className="input"
                placeholder={t.max_area_placeholder}
                min={0}
                step={50}
                disabled={desabilitado}
                value={parametros.area_maxima ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  set({ area_maxima: v === "" ? null : Number(v) });
                }}
              />
            </label>

            <label className="field field-row">
              <span className="field-label">{t.masks_label}</span>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={mostrarMascaras}
                  disabled={desabilitado}
                  onChange={(e) => onMostrarMascarasChange(e.target.checked)}
                />
                <span className="switch-track"></span>
              </span>
            </label>

            <button
              type="button"
              className="btn btn-secondary btn-sm btn-restore-defaults"
              disabled={desabilitado}
              onClick={() =>
                onChange({
                  ...parametros,
                  bias_azul: 0,
                  bias_verde: 0,
                  bias_amarelo: 0,
                  aplicar_bilateral: true,
                  min_circularidade: 0.15,
                  area_maxima: null,
                  motor_segmentacao: "watershed",
                  segmentar_citoplasma: true,
                  raio_citoplasma: 8,
                })
              }
            >
              <RefreshCwIcon size={13} />
              <span>{t.btn_restore}</span>
            </button>
          </div>
        )}
      </section>
    </>
  );
}
