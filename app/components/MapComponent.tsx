"use client";

import { useEffect, useRef, useState } from "react";
import { mappls, mappls_plugin } from "mappls-web-maps";
import RestaurantCard from "./RestaurantCard";

const mapplsClassObject = new mappls();
const mapplsPluginObject = new mappls_plugin();

type Coordinates = [number, number];

type Location = {
  lat: number;
  lng: number;
};

type Restaurant = {
  placeName?: string;
  placeAddress?: string;
  distance?: number;
  latitude?: number;
  longitude?: number;
  eLoc?: string;
  [key: string]: unknown;
};

type MapplsMap = {
  on: (event: "load", callback: () => void) => void;
  panTo: (coordinates: Coordinates) => void;
  remove: () => void;
  setZoom: (zoom: number) => void;
};

type MarkerSet = {
  remove: () => void;
};

type MarkerIcon = {
  url: string;
  width: number;
  height: number;
  offset: [number, number];
};

type MapplsPluginClient = {
  getPinDetails: (
    options: { pin: string },
    callback: (details: unknown) => void
  ) => unknown;
  nearby: (
    options: {
      map: MapplsMap;
      keywords: string;
      refLocation: Coordinates;
      fitbounds: boolean;
      geolocation: boolean;
      popup: boolean;
      icon: MarkerIcon;
    },
    callback: (response: unknown) => void
  ) => unknown;
  pinMarker: (
    options: {
      map: MapplsMap;
      pin: string[];
      popupHtml: string[];
      icon: MarkerIcon;
    },
    callback: (response: unknown) => void
  ) => unknown;
};

const mapplsPlugin = mapplsPluginObject as unknown as MapplsPluginClient;

const FALLBACK_LOCATION: Coordinates = [28.633, 77.2194];
const RESTAURANT_MARKER_ICON: MarkerIcon = {
  url: "/dish.png",
  width: 36,
  height: 36,
  offset: [18, 36],
};
const FOCUSED_RESTAURANT_MARKER_ICON: MarkerIcon = {
  url: "/dish.png",
  width: 52,
  height: 52,
  offset: [26, 52],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRestaurant(value: unknown): value is Restaurant {
  return isRecord(value);
}

function isMarkerSet(value: unknown): value is MarkerSet {
  return isRecord(value) && typeof value.remove === "function";
}

function getMarkerSet(value: unknown): MarkerSet | null {
  if (isMarkerSet(value)) return value;
  if (!isRecord(value) || typeof value.markers !== "function") return null;

  const markerSet = value.markers();
  return isMarkerSet(markerSet) ? markerSet : null;
}

function getRestaurants(value: unknown): Restaurant[] {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data.filter(isRestaurant);
}

function findCoords(
  value: unknown,
  visited = new WeakSet<object>()
): Location | null {
  if (!isRecord(value) || visited.has(value)) return null;
  visited.add(value);

  const latitude = typeof value.latitude === "number" ? value.latitude : value.lat;
  const longitude =
    typeof value.longitude === "number"
      ? value.longitude
      : typeof value.lng === "number"
        ? value.lng
        : value.lon;

  if (typeof latitude === "number" && typeof longitude === "number") {
    return { lat: latitude, lng: longitude };
  }

  for (const nestedValue of Object.values(value)) {
    const coordinates = findCoords(nestedValue, visited);
    if (coordinates) return coordinates;
  }

  return null;
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export default function MapComponent() {
  const mapInstanceRef = useRef<MapplsMap | null>(null);
  const nearbyMarkersRef = useRef<MarkerSet | null>(null);
  const pinMarkersRef = useRef<MarkerSet | null>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(
    null
  );

  const accessToken = process.env.NEXT_PUBLIC_MAPPLS_TOKEN;

  const removeRestaurantMarkers = () => {
    nearbyMarkersRef.current?.remove();
    nearbyMarkersRef.current = null;
    pinMarkersRef.current?.remove();
    pinMarkersRef.current = null;
  };

  const renderPinMarkers = (places: Restaurant[], icon: MarkerIcon) => {
    const map = mapInstanceRef.current;
    const pins = places.flatMap((place) => (place.eLoc ? [place.eLoc] : []));
    if (!map || pins.length === 0) return;

    const popupHtml = places
      .filter((place) => place.eLoc)
      .map(
        (place) =>
          `<div style="font-weight:600">${escapeHtml(
            place.placeName ?? "Restaurant"
          )}</div>`
      );

    const result = mapplsPlugin.pinMarker(
      { map, pin: pins, popupHtml, icon },
      (response) => {
        const markerSet = getMarkerSet(response);
        if (markerSet) pinMarkersRef.current = markerSet;
      }
    );
    const markerSet = getMarkerSet(result);
    if (markerSet) pinMarkersRef.current = markerSet;
  };

  // Ask for location once. The fallback keeps the app usable when permission is
  // denied or the browser does not offer geolocation.
  useEffect(() => {
    if (!navigator.geolocation) {
      const fallbackTimer = window.setTimeout(
        () => setUserLocation(FALLBACK_LOCATION),
        0
      );
      return () => window.clearTimeout(fallbackTimer);
    }

    let isActive = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (isActive) setUserLocation([coords.latitude, coords.longitude]);
      },
      (error) => {
        console.error("Location error:", error.message);
        if (isActive) setUserLocation(FALLBACK_LOCATION);
      }
    );

    return () => {
      isActive = false;
    };
  }, []);

  // Mappls loads the requested plugins together with the map SDK. Loading them
  // this way avoids injecting a second plugin script and its duplicate markers.
  useEffect(() => {
    if (!userLocation || !accessToken || mapInstanceRef.current) return;

    let isDisposed = false;
    const loadObject = {
      map: true,
      version: "3.0",
      libraries: [],
      plugins: ["nearby", "pinMarker", "getPinDetails"],
    };

    mapplsClassObject.initialize(accessToken, loadObject, () => {
      if (isDisposed) return;

      const map = mapplsClassObject.Map({
        id: "map",
        properties: {
          center: userLocation,
          zoom: 14,
        },
      }) as MapplsMap;
      mapInstanceRef.current = map;

      map.on("load", () => {
        if (isDisposed) return;
        setIsMapLoaded(true);

        // Nearby would otherwise add its own brown pins. Supplying the icon here
        // styles the plugin's first render, so no default pins flash underneath.
        const result = mapplsPlugin.nearby(
          {
            map,
            keywords: "FODCOF;cafe;bakery;fast food",
            refLocation: userLocation,
            fitbounds: true,
            geolocation: false,
            popup: false,
            icon: RESTAURANT_MARKER_ICON,
          },
          (response) => {
            if (isDisposed) return;

            const markerSet = getMarkerSet(response);
            if (markerSet) nearbyMarkersRef.current = markerSet;
            setRestaurants(getRestaurants(response));
          }
        );

        const markerSet = getMarkerSet(result);
        if (markerSet) nearbyMarkersRef.current = markerSet;
      });
    });

    return () => {
      isDisposed = true;
      removeRestaurantMarkers();
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, [accessToken, userLocation]);

  const getRestaurantCoordinates = (restaurant: Restaurant) => {
    if (
      typeof restaurant.latitude === "number" &&
      typeof restaurant.longitude === "number"
    ) {
      return Promise.resolve<Location>({
        lat: restaurant.latitude,
        lng: restaurant.longitude,
      });
    }

    if (!restaurant.eLoc) return Promise.resolve<Location | null>(null);

    return new Promise<Location | null>((resolve) => {
      mapplsPlugin.getPinDetails({ pin: restaurant.eLoc as string }, (details) => {
        const coordinates = findCoords(details);

        if (coordinates) {
          setRestaurants((currentRestaurants) =>
            currentRestaurants.map((currentRestaurant) =>
              currentRestaurant.eLoc === restaurant.eLoc
                ? {
                    ...currentRestaurant,
                    latitude: coordinates.lat,
                    longitude: coordinates.lng,
                  }
                : currentRestaurant
            )
          );
        }

        resolve(coordinates);
      });
    });
  };

  const handleCardClick = async (restaurant: Restaurant) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const coordinates = await getRestaurantCoordinates(restaurant);
    if (!coordinates) {
      console.warn("No coordinates found for", restaurant.placeName);
      return;
    }

    removeRestaurantMarkers();
    renderPinMarkers([restaurant], FOCUSED_RESTAURANT_MARKER_ICON);
    map.panTo([coordinates.lat, coordinates.lng]);
    map.setZoom(17);
    setSelectedRestaurant(restaurant);
  };

  const handleBack = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    removeRestaurantMarkers();
    renderPinMarkers(restaurants, RESTAURANT_MARKER_ICON);
    if (userLocation) map.panTo(userLocation);
    map.setZoom(14);
    setSelectedRestaurant(null);
  };

  return (
    <div className="relative h-screen w-full bg-gray-50">
      <div id="map" className="h-full w-full">
        {!isMapLoaded && (
          <div className="flex h-full items-center justify-center bg-gray-50">
            <p className="text-gray-500">
              {accessToken ? "Loading map..." : "Map token is missing."}
            </p>
          </div>
        )}
      </div>

      {selectedRestaurant ? (
        <div className="absolute right-0 bottom-0 left-0 z-10 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-md rounded-t-2xl border border-gray-200 bg-white p-5 shadow-lg sm:mb-4 sm:rounded-2xl">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200 active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
              Back
            </button>

            <h3 className="mt-3 text-xl font-semibold text-gray-900">
              {selectedRestaurant.placeName ?? "Unnamed place"}
            </h3>
            <p className="mt-2 text-sm leading-snug text-gray-500">
              {selectedRestaurant.placeAddress ?? "No address"}
            </p>
            {typeof selectedRestaurant.distance === "number" && (
              <span className="mt-3 inline-block rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600">
                {selectedRestaurant.distance < 1000
                  ? `${Math.round(selectedRestaurant.distance)} m away`
                  : `${(selectedRestaurant.distance / 1000).toFixed(1)} km away`}
              </span>
            )}
          </div>
        </div>
      ) : (
        restaurants.length > 0 && (
          <div className="absolute right-0 bottom-0 left-0 z-10 pb-[env(safe-area-inset-bottom)]">
            <div className="px-4 pb-2">
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-gray-600 backdrop-blur-sm">
                {restaurants.length} places nearby
              </span>
            </div>

            <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4">
              {restaurants.map((restaurant, index) => (
                <div key={restaurant.eLoc ?? index} className="snap-start">
                  <RestaurantCard
                    restaurant={restaurant}
                    onClick={() => handleCardClick(restaurant)}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
