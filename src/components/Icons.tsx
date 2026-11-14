import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

const BaseSvg = ({
  size = 16,
  className = "",
  children,
}: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide-icon ${className}`}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const SaveIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </BaseSvg>
);

export const FolderOpenIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
  </BaseSvg>
);

export const BookOpenIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </BaseSvg>
);

export const KeyboardIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
  </BaseSvg>
);

export const InfoIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </BaseSvg>
);

export const MessageSquareIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </BaseSvg>
);

export const ScissorsIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <circle cx="6" cy="6" r="3" />
    <path d="M8.12 8.12 12 12" />
    <path d="M20 4 8.12 15.88" />
    <circle cx="6" cy="18" r="3" />
    <path d="M14.8 14.8 20 20" />
  </BaseSvg>
);

export const CropIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
  </BaseSvg>
);

export const DownloadIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </BaseSvg>
);

export const MicroscopeIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M6 18h8" />
    <path d="M3 22h18" />
    <path d="M14 22a7 7 0 1 0 0-14h-1" />
    <path d="M9 14h2" />
    <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
    <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
  </BaseSvg>
);

export const PrinterIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect width="12" height="8" x="6" y="14" />
  </BaseSvg>
);

export const SlidersIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <line x1="4" x2="4" y1="21" y2="14" />
    <line x1="4" x2="4" y1="10" y2="3" />
    <line x1="12" x2="12" y1="21" y2="12" />
    <line x1="12" x2="12" y1="8" y2="3" />
    <line x1="20" x2="20" y1="21" y2="16" />
    <line x1="20" x2="20" y1="12" y2="3" />
    <line x1="2" x2="6" y1="14" y2="14" />
    <line x1="10" x2="14" y1="8" y2="8" />
    <line x1="18" x2="22" y1="16" y2="16" />
  </BaseSvg>
);

export const CheckIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <polyline points="20 6 9 17 4 12" />
  </BaseSvg>
);

export const XIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </BaseSvg>
);

export const AlertTriangleIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </BaseSvg>
);

export const UndoIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </BaseSvg>
);

export const RedoIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
  </BaseSvg>
);

export const PlusCircleIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </BaseSvg>
);

export const TrashIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </BaseSvg>
);

export const MousePointerIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    <path d="m13 13 6 6" />
  </BaseSvg>
);

export const EditIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </BaseSvg>
);

export const RefreshCwIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </BaseSvg>
);

export const LayersIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </BaseSvg>
);

export const FileSpreadsheetIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M8 13h2" />
    <path d="M14 13h2" />
    <path d="M8 17h2" />
    <path d="M14 17h2" />
  </BaseSvg>
);

export const FileCodeIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="m10 13-2 2 2 2" />
    <path d="m14 17 2-2-2-2" />
  </BaseSvg>
);

export const ImageIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </BaseSvg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="m6 9 6 6 6-6" />
  </BaseSvg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="m9 18 6-6-6-6" />
  </BaseSvg>
);

export const MailIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </BaseSvg>
);

export const CopyIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </BaseSvg>
);

export const ZoomInIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
    <line x1="11" x2="11" y1="8" y2="14" />
    <line x1="8" x2="14" y1="11" y2="11" />
  </BaseSvg>
);

export const ZoomOutIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
    <line x1="8" x2="14" y1="11" y2="11" />
  </BaseSvg>
);

export const MaximizeIcon = (props: IconProps) => (
  <BaseSvg {...props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </BaseSvg>
);
