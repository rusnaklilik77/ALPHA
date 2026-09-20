import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import TourTab from "./TourTab";
import SosTab from "./SosTab";
import ProfileTab from "./ProfileTab";

// «Доп. сведения» (шестерёнка в шапке). Три вкладки:
//   Тур     — начать/завершить тур, маршрут на карте, история туров;
//   SOS     — выбор получателей красной кнопки SOS;
//   Профиль — «Мои настройки»: имя, ID, email, телефон.
// Вкладка «Тур» скрыта у сортировщиков (у них нет маршрутов — работа на складе).
export default function ExtraInfoModal({ user, profile, role, sos, canTour, initialTab, onClose }) {
  const { t } = useLanguage();
  const firstTab = initialTab || (canTour ? "tour" : "profile");
  const [tab, setTab] = useState(firstTab);

  const tabs = [
    ...(canTour ? [{ key: "tour", label: `📍 ${t.more.tabTour}` }] : []),
    { key: "sos", label: `🆘 ${t.more.tabSos}` },
    { key: "profile", label: `👤 ${t.more.tabProfile}` },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-50">
      <div className="bg-panel border border-border rounded-xl2 shadow-card p-5 sm:p-6 w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-white font-bold text-lg">⚙️ {t.more.title}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-white shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-panel2 transition"
            aria-label={t.more.close}
          >
            ✕
          </button>
        </div>

        <div className="flex bg-panel2 rounded-lg p-1 mb-4 shrink-0">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setTab(x.key)}
              className={`flex-1 py-2 rounded-md text-xs sm:text-sm font-semibold transition ${
                tab === x.key
                  ? x.key === "sos"
                    ? "bg-danger text-white"
                    : "bg-accent text-bg"
                  : "text-muted hover:text-white"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto -mx-1 px-1 flex-1">
          {tab === "tour" && canTour && <TourTab uid={user.uid} />}
          {tab === "sos" && <SosTab uid={user.uid} sosAll={sos.all} sosContacts={sos.contacts} />}
          {tab === "profile" && <ProfileTab uid={user.uid} email={user.email} role={role} profile={profile} />}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-panel2 hover:bg-border border border-border text-white transition shrink-0"
        >
          {t.more.close}
        </button>
      </div>
    </div>
  );
}
