/**
 * Helpers for showing whatever the print service returns.
 *
 * Two things bite here:
 *  - `window.open()` after an `await` is treated as a popup and blocked, so the
 *    tab must be opened synchronously inside the click handler and filled in
 *    afterwards.
 *  - With `responseType: "blob"` an error response also arrives as a Blob, so a
 *    JSON error body would otherwise be shown as a broken "PDF".
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

export interface PrintWindow {
  win: Window | null;
  /** Point the tab at a URL, or close it if it never opened. */
  show: (url: string) => void;
  writeHtml: (html: string) => void;
  close: () => void;
}

/** Call this synchronously in the click handler, before any await. */
export function openPrintWindow(): PrintWindow {
  const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
  if (win) {
    win.document.write(
      `<!doctype html><title>Preparing…</title>
       <body style="font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#616161">
       Preparing document…</body>`
    );
  }
  return {
    win,
    show: (url: string) => {
      if (win) win.location.href = url;
    },
    writeHtml: (html: string) => {
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    },
    close: () => {
      try {
        win?.close();
      } catch {
        // already gone
      }
    },
  };
}

const JSON_TYPES = ["application/json", "text/plain", "text/html"];

/**
 * A Blob that is really a JSON error body. Returns the server's message so it
 * can be surfaced instead of opening a broken document.
 */
export async function blobErrorMessage(blob: Blob): Promise<string | null> {
  if (blob.size === 0) return "The print service returned an empty document.";
  if (!JSON_TYPES.some((t) => blob.type.includes(t))) return null;
  try {
    const text = await blob.text();
    if (text.trimStart().startsWith("<")) return null; // real HTML document
    const data = JSON.parse(text) as Json;
    if (data?.success === false || data?.error || data?.message) {
      return (data.message ?? data.error ?? "The print service returned an error.") as string;
    }
    return null;
  } catch {
    return null;
  }
}

/** Show a PDF/blob in the pre-opened tab. Throws with the server message on an error body. */
export async function showBlob(blob: Blob, target: PrintWindow): Promise<void> {
  const error = await blobErrorMessage(blob);
  if (error) {
    target.close();
    throw new Error(error);
  }
  const url = URL.createObjectURL(blob);
  if (target.win) {
    target.show(url);
  } else {
    // Popup blocked — fall back to a download so the file isn't lost.
    const a = document.createElement("a");
    a.href = url;
    a.download = `print-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Pull the HTML document out of a JSON print response. */
export function pickHtml(result: unknown): string | null {
  if (typeof result === "string") return result;
  const r = (result ?? {}) as Json;
  const p: Json = r.payload ?? r.data ?? r;
  const html = p?.html ?? p?.content ?? p?.receipt ?? p?.document;
  return typeof html === "string" ? html : null;
}

/** Some responses hand back a hosted file instead of inline HTML. */
export function pickFileUrl(result: unknown): string | null {
  const r = (result ?? {}) as Json;
  const p: Json = r.payload ?? r.data ?? r;
  const url = p?.url ?? p?.file_url ?? p?.pdf_url ?? p?.path;
  return typeof url === "string" ? url : null;
}

/** True when the popup never opened — used to tell the user why nothing appeared. */
export const popupBlocked = (target: PrintWindow) => !target.win;
