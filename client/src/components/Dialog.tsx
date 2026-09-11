import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogA11y } from "../hooks/useDialogA11y";

type Props = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  testId?: string;
  className?: string;
  /** Overrides the overlay's layout classes (default: centered modal). Used e.g. by the mobile nav drawer to pin content to the left edge instead of centering it. */
  overlayClassName?: string;
  /** Overrides the overlay's data-testid (default: `${testId}-overlay`). */
  overlayTestId?: string;
};

/**
 * Accessible modal dialog rendered via a React portal to document.body.
 * Provides role="dialog", aria-modal, focus trapping, Escape-to-close,
 * focus restoration and a scroll lock while open.
 */
export function Dialog({
  open,
  onClose,
  titleId,
  children,
  initialFocusRef,
  testId,
  className,
  overlayClassName,
  overlayTestId
}: Props) {
  const containerRef = useDialogA11y<HTMLDivElement>({ open, onClose, initialFocusRef });

  if (!open) return null;

  // The overlay below is a mouse-only affordance for closing the dialog; the
  // dialog itself already provides an Escape key and a close button as
  // fully keyboard-accessible equivalents.
  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={overlayClassName ?? "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"}
      data-testid={overlayTestId ?? (testId ? `${testId}-overlay` : undefined)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
        className={className ?? "bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto outline-none"}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
