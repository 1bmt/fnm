"use client";
// "use client" must be the first line. It tells Next.js this component runs
// in the browser only. Without it, useEffect and Mappls (which needs `window`)
// will crash during server-side rendering.

import { useEffect, useRef, useState } from "react";
import { mappls, mappls_plugin } from "mappls-web-maps";
import RestaurantCard from "./RestaurantCard";

// We create the Mappls class instance OUTSIDE the component.
// Why? If it were inside, a new instance would be created on every render,
// which is wasteful and can cause the SDK to re-initialize unexpectedly.
const mapplsClassObject = new mappls();

// Separate instance for plugin methods like `.nearby()`.
const mapplsPluginObject = new mappls_plugin();

type Restaurant = {
  placeName?: string;
  placeAddress?: string;
  distance?: number;
  latitude?: number;
  longitude?: number;
  eLoc?: string;
  [key: string]: any;
};

export default function MapComponent() {
  const mapInstanceRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
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

          // Load the Nearby plugin script
          const pluginScript = document.createElement("script");
          pluginScript.src = `https://sdk.mappls.com/map/sdk/plugins?access_token=${process.env.NEXT_PUBLIC_MAPPLS_TOKEN}&v=3.0&libraries=nearby`;
          pluginScript.async = true;

          pluginScript.onload = () => {
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
      {/* Map fills the screen */}
      <div id="map" ref={mapContainerRef} className="w-full h-full">
        {!isMapLoaded && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading map...</p>
          </div>
        )}
      </div>

      {/* Horizontal scrolling card carousel */}
      {restaurants.length > 0 && (
        <div className="absolute bottom-4 left-0 right-0 z-10">
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide">
            {restaurants.map((r, i) => (
              <div key={r.eLoc ?? i} className="snap-start">
                <RestaurantCard
                  restaurant={r}
                  onClick={() => {
                    console.log("Tapped:", r.placeName, r.eLoc);
                    // Later: pan the map to this restaurant's coordinates.
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}