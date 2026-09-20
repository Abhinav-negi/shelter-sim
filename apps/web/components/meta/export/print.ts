// apps/web/components/meta/export/print.ts
//
// T-52(c) PDF export: "a print stylesheet plus window.print() -- no PDF
// library" (CONTRACTS.md §7.13, a frozen approved-dependency list). The
// print stylesheet itself lives in apps/web/app/globals.css's @media print
// section (this task's only permitted edit there); this file is just the
// one-line trigger, kept separate from the DOM so it is callable/testable
// without a real browser.

export function triggerPrint(): void {
  if (typeof window === 'undefined' || typeof window.print !== 'function') {
    throw new Error('triggerPrint needs a browser window.print(); none is available here.');
  }
  window.print();
}
