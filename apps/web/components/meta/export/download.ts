// apps/web/components/meta/export/download.ts
//
// Browser-only file-download glue (Blob + a throwaway <a download>, native
// Web platform APIs -- ponytail rung 4, no download/file-saver library).
// Same environment constraint components/house/export.ts documents: this
// worktree has no jsdom/canvas, so this cannot be exercised headlessly here.
// It is exercised through its PURE half (csv.ts/json.ts's string builders,
// which contain 100% of the actual export logic) in export.test.ts instead.

export function downloadTextFile(filename: string, contents: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(
      'downloadTextFile needs a browser (Blob + <a download>); none is available here.',
    );
  }
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
