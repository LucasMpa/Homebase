"use client";

// Versão sem CSS injetado: o estilo base vem de globals.css, seguido dos ajustes com a identidade do Homebase.
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Slide, ToastContainer, toast, type CloseButtonProps, type IconProps, type ToastOptions } from "react-toastify/unstyled";

export { toast };

/** Ícones do lucide, como no resto do app; as cores ficam em globals.css (.hb-toast-icon--*). */
function ToastIcon({ type, isLoading }: IconProps) {
  if (isLoading) return <Loader2Icon className="hb-toast-icon animate-spin" aria-hidden />;
  switch (type) {
    case "success":
      return <CircleCheckIcon className="hb-toast-icon hb-toast-icon--success" aria-hidden />;
    case "error":
      return <OctagonXIcon className="hb-toast-icon hb-toast-icon--error" aria-hidden />;
    case "warning":
      return <TriangleAlertIcon className="hb-toast-icon hb-toast-icon--warning" aria-hidden />;
    case "info":
      return <InfoIcon className="hb-toast-icon hb-toast-icon--info" aria-hidden />;
    default:
      return null;
  }
}

function CloseButton({ closeToast, ariaLabel }: CloseButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? "Fechar"}
      onClick={closeToast}
      className="-my-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <XIcon className="size-4" aria-hidden />
    </button>
  );
}

/** Container dos toasts (react-toastify). */
export function Toaster() {
  return (
    <ToastContainer
      position="top-center"
      theme="dark"
      autoClose={4000}
      hideProgressBar
      closeOnClick={false}
      newestOnTop
      limit={3}
      transition={Slide}
      icon={ToastIcon}
      closeButton={CloseButton}
    />
  );
}

/**
 * Toast com um botão de ação (ex.: "Desfazer"), que o react-toastify não tem
 * pronto. Clicar no botão fecha o toast antes de rodar a ação.
 */
export function toastWithAction(
  message: string,
  action: { label: string; onClick: () => void },
  options?: ToastOptions,
) {
  return toast(
    ({ closeToast }) => (
      <div className="flex w-full items-center justify-between gap-3">
        <span>{message}</span>
        <button
          type="button"
          className="h-8 shrink-0 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground ring-1 ring-border transition-colors outline-none hover:bg-primary hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => {
            closeToast();
            action.onClick();
          }}
        >
          {action.label}
        </button>
      </div>
    ),
    options,
  );
}
