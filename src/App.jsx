import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { isFirebaseConfigured } from "./firebase";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ScanPage from "./pages/ScanPage";

// Страница сканера открывается по ссылке из QR-кода ("?scan=<uid>&t=<token>")
// и не требует входа по email/паролю — проверяем параметры адресной строки
// до того, как решаем, что рендерить (Auth/Dashboard или ScanPage).
function getScanParams() {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("scan");
  const token = params.get("t");
  if (!uid || !token) return null;
  return { uid, token };
}

const REQUIRED_ENV_VARS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

function FirebaseConfigNeeded() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-lg bg-panel border border-border rounded-xl2 shadow-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center shrink-0">
            <span className="text-danger font-black">!</span>
          </div>
          <h1 className="text-white font-bold text-lg">{t.config.title}</h1>
        </div>
        <p className="text-muted text-sm mb-4">{t.config.description}</p>
        <div className="bg-panel2 border border-border rounded-lg p-4 mb-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-2">{t.config.varsTitle}</div>
          <ul className="space-y-1">
            {REQUIRED_ENV_VARS.map((v) => (
              <li key={v} className="text-accent font-mono text-xs sm:text-sm">
                {v}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-muted text-xs">{t.config.note}</p>
      </div>
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-muted text-sm">{t.app.loading}</div>
      </div>
    );
  }

  return user ? <Dashboard /> : <Auth />;
}

export default function App() {
  const scanParams = getScanParams();

  return (
    <LanguageProvider>
      {scanParams ? (
        <ScanPage uid={scanParams.uid} token={scanParams.token} />
      ) : isFirebaseConfigured ? (
        <AuthProvider>
          <Gate />
        </AuthProvider>
      ) : (
        <FirebaseConfigNeeded />
      )}
    </LanguageProvider>
  );
}
