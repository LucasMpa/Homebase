import { cn } from "@/lib/utils";

/** O ícone do app, igual a src/app/icon.svg (favicon). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#1B2333" />
      <rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="#2A344B" strokeWidth="4" />
      <path
        d="M110 238 L256 110 L402 238"
        fill="none"
        stroke="#7ED497"
        strokeWidth="44"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="144" y="268" width="58" height="154" rx="16" fill="#E6E9EF" />
      <rect x="310" y="268" width="58" height="154" rx="16" fill="#E6E9EF" />
      <rect x="190" y="322" width="132" height="46" rx="10" fill="#E6E9EF" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
      <LogoMark />
      Homebase
    </span>
  );
}
