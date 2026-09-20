import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Карта маршрута на Leaflet + OpenStreetMap (бесплатно, без ключей API).
//
// points — массив [lat, lng, t]. На карте рисуется линия маршрута, зелёный
// маркер «Старт» и красный «Финиш» (если тур ещё идёт — вместо финиша
// пульсирующая бирюзовая точка «Сейчас»). Маркеры сделаны через divIcon,
// поэтому никаких картинок-иконок Leaflet не требуется (они ломаются при
// сборке через Vite).
function pinIcon(kind, text) {
  return L.divIcon({
    className: "",
    html: `<div class="alpha-pin alpha-pin--${kind}">${text}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function RouteMap({ points, live = false, labels, className = "" }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);

  // создаём карту один раз
  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    map.setView([47, 28], 5);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Карта часто создаётся внутри всплывающего окна — пересчитываем размер
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // перерисовываем маршрут при изменении точек
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!points || points.length === 0) return;

    const latlngs = points.map((p) => [p[0], p[1]]);
    if (latlngs.length > 1) {
      L.polyline(latlngs, { color: "#0b3d3a", weight: 9, opacity: 0.55, lineJoin: "round" }).addTo(layer);
      L.polyline(latlngs, { color: "#0fb8ab", weight: 5, opacity: 0.95, lineJoin: "round" }).addTo(layer);
    }

    const start = latlngs[0];
    const end = latlngs[latlngs.length - 1];
    L.marker(start, { icon: pinIcon("start", "▶"), zIndexOffset: 500 })
      .bindTooltip(labels?.start || "Start", { permanent: true, direction: "top", offset: [0, -14], className: "alpha-tip" })
      .addTo(layer);
    if (latlngs.length > 1 || live) {
      L.marker(end, {
        icon: live ? pinIcon("now", "●") : pinIcon("finish", "⚑"),
        zIndexOffset: 600,
      })
        .bindTooltip(live ? labels?.now || "Now" : labels?.finish || "Finish", {
          permanent: true,
          direction: "top",
          offset: [0, -14],
          className: "alpha-tip",
        })
        .addTo(layer);
    }

    // При «живом» маршруте подгоняем масштаб только один раз, чтобы карта не
    // «прыгала» из-под пальца, пока человек её двигает.
    if (!fittedRef.current || !live) {
      if (latlngs.length > 1) {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 18 });
      } else {
        map.setView(start, 17);
      }
      fittedRef.current = true;
    }
  }, [points, live, labels]);

  return <div ref={elRef} className={`isolate w-full rounded-xl border border-border overflow-hidden ${className}`} />;
}
