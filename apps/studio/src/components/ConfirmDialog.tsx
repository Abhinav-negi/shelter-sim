// Shared confirm popup (A2.md condition 1) wrapping a native <dialog>, used
// by Studio's "Run on ANSYS" and cancel-run confirms, and Dashboard's
// cancel-run confirm. `m-auto` is load-bearing: Tailwind v4 preflight sets
// `margin:0` on every element, which cancels native <dialog> `margin:auto`
// centering (the A1 top-left bug) -- see A2.md's Goal.
import { useEffect, useRef } from 'react';
import { Button } from './ui';

export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  busy,
}: {
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-sm border border-hairline bg-paper p-5 text-ink backdrop:bg-ink/40"
    >
      <p className="text-sm">{message}</p>
      <div className="mt-4 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
