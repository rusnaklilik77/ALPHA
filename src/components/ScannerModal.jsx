import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useLanguage } from "../context/LanguageContext";
import { ensureScanToken, regenerateScanToken } from "../lib/data";

// Строит ссылку вида "<текущий сайт>?scan=<uid>&t=<token>" — она же
// зашивается в QR-код. Открыв её на телефоне (или устройстве со сканером
// штрихкодов), сотрудник попадает на страницу ScanPage без необходимости
// вводить email/пароль — доступ даёт сам секретный токен.
function buildScanUrl(uid, token) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("scan", uid);
  url.searchParams.set("t", token);
  return url.toString();
}

export default function ScannerModal({ uid, scanToken, onClose }) {
  const { t } = useLanguage();
  const [token, setToken] = useState(scanToken || "");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const t2 = await ensureScanToken(uid, scanToken);
      if (!cancelled) setToken(t2);
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (!token) return;
    const url = buildScanUrl(uid, token);
    QRCode.toDataURL(url, {
      width: 260,
      margin: 1,
      color: { dark: "#0b0f14", light: "#ffffff" },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(""));
  }, [uid, token]);

  async function handleRegenerate() {
    setBusy(true);
    try {
      const fresh = await regenerateScanToken(uid);
      setToken(fresh);
      setCopied(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    const url = buildScanUrl(uid, token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — clipboard may be unavailable
    }
  }

  const url = token ? buildScanUrl(uid, token) : "";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-panel border border-border rounded-xl2 shadow-card p-6 w-full max-w-sm">
        <h3 className="text-white font-bold text-lg mb-1">{t.scannerModal.title}</h3>
        <p className="text-muted text-sm mb-5">{t.scannerModal.description}</p>

        <div className="flex items-center justify-center bg-white rounded-xl2 p-3 mb-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR" className="w-full max-w-[220px] aspect-square" />
          ) : (
            <div className="w-full max-w-[220px] aspect-square flex items-center justify-center text-bg/60 text-xs">
              ...
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="text-xs font-medium text-muted mb-1.5">{t.scannerModal.urlLabel}</div>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              className="flex-1 min-w-0 bg-panel2 border border-border rounded-lg px-3 py-2 text-white text-xs outline-none truncate"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 text-xs font-semibold bg-accent/15 hover:bg-accent/25 border border-accent/40 rounded-lg px-3 py-2 text-accent transition"
            >
              {copied ? t.scannerModal.copied : t.scannerModal.copy}
            </button>
          </div>
        </div>

        <p className="text-muted/70 text-[11px] mb-5">{t.scannerModal.regenerateNote}</p>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:text-white border border-border transition disabled:opacity-60"
          >
            {t.scannerModal.regenerate}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-bold bg-accent hover:bg-accent/90 text-bg transition"
          >
            {t.scannerModal.close}
          </button>
        </div>
      </div>
    </div>
  );
}
