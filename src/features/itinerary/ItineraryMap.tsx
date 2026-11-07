import { useEffect, useRef, useState } from "react";

const defaultTileSource = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  attributionUrl: "https://www.openstreetmap.org/copyright",
};

export interface ItineraryMapLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
}

type MapStatus = "loading" | "ready" | "failed" | "offline" | "empty";

function initialStatus(online: boolean, locations: readonly ItineraryMapLocation[]): MapStatus {
  if (!online) return "offline";
  return locations.length ? "loading" : "empty";
}

function statusMessage(status: MapStatus): string | null {
  if (status === "loading") return "正在載入街道地圖⋯";
  if (status === "failed") return "街道地圖暫時無法載入，行程地點與外部導航仍可使用。";
  if (status === "offline") return "離線時不載入街道圖磚，行程地點與外部導航仍可使用。";
  if (status === "empty") return "這一天尚無可顯示的地點座標。";
  return null;
}

export function ItineraryMap({ city, locations, online }: {
  city: string;
  locations: readonly ItineraryMapLocation[];
  online: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>(() => initialStatus(online, locations));
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL?.trim() || defaultTileSource.url;
  const attribution = import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() || defaultTileSource.attribution;
  const attributionUrl = import.meta.env.VITE_MAP_TILE_ATTRIBUTION_URL?.trim() || defaultTileSource.attributionUrl;

  useEffect(() => {
    const container = containerRef.current;
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    let resizeFrame = 0;
    let resizeObserver: ResizeObserver | undefined;

    if (!online || !locations.length || !container) {
      setStatus(initialStatus(online, locations));
      return;
    }

    setStatus("loading");
    void import("leaflet").then((module) => {
      if (disposed) return;
      const L = module.default;
      let tileFailed = false;
      map = L.map(container, {
        attributionControl: false,
        dragging: true,
        keyboard: true,
        scrollWheelZoom: true,
        touchZoom: true,
        zoomControl: false,
      });
      L.control.zoom({ position: "topright" }).addTo(map);

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        updateWhenIdle: true,
      });
      tileLayer.on("tileerror", () => {
        tileFailed = true;
        if (!disposed) setStatus("failed");
      });
      tileLayer.on("load", () => {
        if (!disposed && !tileFailed) setStatus("ready");
      });
      tileLayer.addTo(map);

      const coordinates = locations.map((location) => L.latLng(location.latitude, location.longitude));
      locations.forEach((location, index) => {
        const icon = L.divIcon({
          className: "itinerary-map-marker",
          html: `<span>${location.order}</span>`,
          iconAnchor: [18, 18],
          iconSize: [36, 36],
        });
        L.marker(coordinates[index], {
          alt: `${location.order}．${location.name}`,
          icon,
          keyboard: true,
          title: location.name,
        }).addTo(map!);
      });

      if (coordinates.length > 1) {
        L.polyline(coordinates, {
          color: "#d87867",
          dashArray: "8 10",
          lineCap: "round",
          opacity: 0.9,
          weight: 4,
        }).addTo(map);
      }

      const fitLocations = () => {
        if (coordinates.length > 1) {
          map?.fitBounds(L.latLngBounds(coordinates), { maxZoom: 15, padding: [72, 72] });
        } else {
          map?.setView(coordinates[0], 15);
        }
      };
      fitLocations();

      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            map?.invalidateSize({ pan: false });
            fitLocations();
          });
        });
        resizeObserver.observe(container);
      }
    }).catch(() => {
      if (!disposed) setStatus("failed");
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      map?.remove();
    };
  }, [locations, online, tileUrl]);

  const message = statusMessage(status);
  return <div
    className={`itinerary-map itinerary-map-${status}`}
    data-map-points={locations.map((location) => location.name).join("|")}
    data-map-orders={locations.map((location) => location.order).join("|")}
    data-map-status={status}
  >
    <div
      ref={containerRef}
      className="itinerary-map-canvas"
      role="region"
      aria-label={`${city} OpenStreetMap 街道地圖，${locations.length} 個有座標地點`}
    />
    {message && <p className="itinerary-map-status" role={status === "failed" ? "alert" : "status"}>{message}</p>}
    <a className="itinerary-map-attribution" href={attributionUrl} target="_blank" rel="noreferrer">{attribution}</a>
  </div>;
}
