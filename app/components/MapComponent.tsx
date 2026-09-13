"use client";
// "use client" must be the first line. It tells Next.js this component runs
// in the browser only. Without it, useEffect and Mappls (which needs `window`)
// will crash during server-side rendering.

import { useEffect, useRef, useState } from "react";
import { mappls, mappls_plugin } from "mappls-web-maps";

// We create the Mappls class instance OUTSIDE the component.
// Why? If it were inside, a new instance would be created on every render,
// which is wasteful and can cause the SDK to re-initialize unexpectedly.
const mapplsClassObject = new mappls();

// Separate instance for plugin methods like `.nearby()`.
// The `mappls` class only handles core map stuff. Plugins live on this object.
const mapplsPluginObject = new mappls_plugin();

// Shape of a single restaurant returned by Mappls nearby search.
type Restaurant = {
  placeName?: string;
  placeAddress?: string;
  distance?: number;
  latitude?: number;
  longitude?: number;
  eLoc?: string;
  keywords?: string[];
  [key: string]: any;
};

// Format a distance in meters into a friendlier string.
// Under 1 km → "350 m". Over 1 km → "1.2 km".
function formatDistance(meters?: number): string {
  if (typeof meters !== "number") return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function MapComponent() {
  // useRef stores the map INSTANCE across renders without causing re-renders.
  const mapInstanceRef = useRef<any>(null);

  // useRef for the actual DOM element that Mappls will render into.
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // useState to show/hide the "Loading..." text.
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // useState for the user's coordinates.
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // useState for the restaurant list returned by the nearby search.
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  // ---- STEP 1: Get the user's location ----
  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported. Falling back to Delhi.");
      setUserLocation([28.633, 77.2194]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
      },
      (error) => {
        console.error("Location error:", error.message);
        setUserLocation([28.633, 77.2194]);
      }
    );
  }, []);

  // ---- STEP 2: Initialize the map once we have a location ----
  useEffect(() => {
    if (!userLocation) return;
    if (mapInstanceRef.current) return;

    const loadObject = {
      map: true,
      version: "3.0",
      libraries: [""],
      plugins: [""],
    };

    mapplsClassObject.initialize(
      process.env.NEXT_PUBLIC_MAPPLS_TOKEN!,
      loadObject,
      () => {
        const newMap = mapplsClassObject.Map({
          id: "map",
          properties: {
            center: userLocation,
            zoom: 14,
          },
        });

        newMap.on("load", () => {
          setIsMapLoaded(true);

          // ---- STEP 3: Load the Nearby plugin script ----
          const pluginScript = document.createElement("script");
          pluginScript.src = `https://sdk.mappls.com/map/sdk/plugins?access_token=${process.env.NEXT_PUBLIC_MAPPLS_TOKEN}&v=3.0&libraries=nearby`;
          pluginScript.async = true;

          pluginScript.onload = () => {
            // ---- STEP 4: Search for nearby restaurants ----
            (mapplsPluginObject as any).nearby(
              {
                map: newMap,
                keywords: "restaurant",
                refLocation: userLocation,
                fitbounds: true,
                geolocation: false,
                popup: true,
              },
              (response: any) => {
                // The response is an object, not an array.
                // The restaurant list lives at response.data.
                const list: Restaurant[] = response?.data ?? [];
                console.log("🍽️ Restaurant count:", list.length);
                console.log("First restaurant:", list[0]);
                setRestaurants(list);
              }
            );
          };

          pluginScript.onerror = () => {
            console.error("Failed to load the Mappls Nearby plugin.");
          };

          document.head.appendChild(pluginScript);
        });

        mapInstanceRef.current = newMap;
      }
    );

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userLocation]);

  return (
    <div className="relative w-full h-screen">
      {/* Map container */}
      <div id="map" ref={mapContainerRef} className="w-full h-full">
        {!isMapLoaded && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading map...</p>
          </div>
        )}
      </div>

      {/* Card panel — bottom sheet style */}
      {restaurants.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 max-h-[45%] overflow-y-auto bg-white rounded-t-2xl shadow-[0_-4px_12px_rgba(0,0,0,0.1)] z-10">
          {/* Drag handle visual */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">
              {restaurants.length} places nearby
            </h3>
          </div>

          {/* Card list */}
          <ul className="divide-y divide-gray-100">
            {restaurants.map((r, i) => (
              <li
                key={r.eLoc ?? i}
                className="px-4 py-3 active:bg-gray-50 cursor-pointer"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                      {r.placeName ?? "Unnamed place"}
                    </h4>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                      {r.placeAddress ?? "No address"}
                    </p>
                  </div>
                  {r.distance !== undefined && (
                    <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5">
                      {formatDistance(r.distance)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}