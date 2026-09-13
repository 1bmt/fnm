"use client";
// "use client" must be the first line. It tells Next.js this component runs
// in the browser only. Without it, useEffect and Mappls (which needs `window`)
// will crash during server-side rendering.

import { useEffect, useRef, useState } from "react";
import { mappls, mappls_plugin } from "mappls-web-maps";
import RestaurantCard from "./RestaurantCard";

// We create the Mappls class instance OUTSIDE the component.
const mapplsClassObject = new mappls();

// Separate instance for plugin methods like `.nearby()`, `.pinMarker()`,
// and `.getPinDetails()`.
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

// Recursively search an object for latitude/longitude fields.
// Handles any nesting depth, since Mappls buries coordinates differently
// across SDK versions and endpoints.
function findCoords(obj: any): { lat: number; lng: number } | null {
  if (!obj || typeof obj !== "object") return null;

  const lat = obj.latitude ?? obj.lat;
  const lng = obj.longitude ?? obj.lng ?? obj.lon;
  if (typeof lat === "number" && typeof lng === "number") {
    return { lat, lng };
  }

  for (const key of Object.keys(obj)) {
    const found = findCoords(obj[key]);
    if (found) return found;
  }

  return null;
}

export default function MapComponent() {
  const mapInstanceRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Stores the object returned by the pinMarker callback so we can call
  // .remove() on it later to clear pins from the map.
  const pinMarkerRef = useRef<any>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  // null = carousel view. Set = focus mode on that restaurant.
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

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

          // Load Nearby, pinMarker, and getPinDetails plugins together.
          const pluginScript = document.createElement("script");
          pluginScript.src = `https://sdk.mappls.com/map/sdk/plugins?access_token=${process.env.NEXT_PUBLIC_MAPPLS_TOKEN}&v=3.0&libraries=nearby,pinMarker,getPinDetails`;
          pluginScript.async = true;

          pluginScript.onload = () => {
            (mapplsPluginObject as any).nearby(
              {
                map: newMap,
                // String keywords with ';' OR operator for broader coverage.
                keywords: "FODCOF;cafe;bakery;fast food",
                refLocation: userLocation,
                fitbounds: true,
                geolocation: false,
                popup: true,
              },
              (response: any) => {
                const list: Restaurant[] = response?.data ?? [];
                console.log("🍽️ Restaurant count:", list.length);

                // Clear the default markers the nearby plugin auto-drops.
                if (response?.markers && typeof response.markers.clear === "function") {
                  response.markers.clear();
                } else if (
                  response?.markers &&
                  typeof response.markers._rmv === "function"
                ) {
                  response.markers._rmv();
                }

                // Draw our custom dish pins for all restaurants.
                const withELoc = list.filter((r) => r.eLoc);
                if (withELoc.length > 0) {
                  (mapplsPluginObject as any).pinMarker(
                    {
                      map: newMap,
                      pin: withELoc.map((r) => r.eLoc as string),
                      popupHtml: withELoc.map(
                        (r) =>
                          `<div style="font-weight:600">${r.placeName ?? "Restaurant"}</div>`
                      ),
                      icon: {
                        url: "/dish.png",
                        width: 36,
                        height: 36,
                        offset: [18, 36],
                      },
                    },
                    (data: any) => {
                      console.log("📍 pinMarker result:", data);
                      // Store so we can call .remove() on it later.
                      pinMarkerRef.current = data;
                    }
                  );
                }

                setRestaurants(list);
              }
            );
          };

          pluginScript.onerror = () => {
            console.error("Failed to load the Mappls plugins.");
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

  // ---- Handler: enter focus mode on a restaurant ----
  // Removes all existing pins via pinMarkerRef.current.remove(),
  // then drops one larger pin at the selected restaurant.
  const handleCardClick = async (r: Restaurant) => {
    if (!mapInstanceRef.current) return;
    const newMap = mapInstanceRef.current;

    // Resolve coordinates. Fast path if already cached.
    let coords: { lat: number; lng: number } | null = null;

    if (typeof r.latitude === "number" && typeof r.longitude === "number") {
      coords = { lat: r.latitude, lng: r.longitude };
    } else if (r.eLoc) {
      coords = await new Promise((resolve) => {
        (mapplsPluginObject as any).getPinDetails(
          { pin: r.eLoc, map: newMap },
          (details: any) => {
            // Remove the default brown pin that getPinDetails drops.
            if (details && typeof details.remove === "function") {
              details.remove();
            } else if (details?.marker && typeof details.marker.remove === "function") {
              details.marker.remove();
            }

            const found = findCoords(details);
            if (found) {
              setRestaurants((prev) =>
                prev.map((item) =>
                  item.eLoc === r.eLoc
                    ? { ...item, latitude: found.lat, longitude: found.lng }
                    : item
                )
              );
            }
            resolve(found);
          }
        );
      });
    }

    if (!coords) {
      console.warn("No coordinates for", r.placeName);
      return;
    }

    // Remove every existing pin. The pinMarker callback returns an object
    // with a .remove() method that clears all markers it created.
    if (pinMarkerRef.current && typeof pinMarkerRef.current.remove === "function") {
      pinMarkerRef.current.remove();
      pinMarkerRef.current = null;
    }

    // Draw just the selected restaurant's pin, larger for emphasis.
    if (r.eLoc) {
      (mapplsPluginObject as any).pinMarker(
        {
          map: newMap,
          pin: [r.eLoc],
          popupHtml: [
            `<div style="font-weight:600">${r.placeName ?? "Restaurant"}</div>`,
          ],
          icon: {
            url: "/dish.png",
            width: 52,
            height: 52,
            offset: [26, 52],
          },
        },
        (data: any) => {
          console.log("🎯 Focus pin result:", data);
          pinMarkerRef.current = data;
        }
      );
    }

    // Pan and zoom in on the selected restaurant.
    newMap.panTo(coords);
    newMap.setZoom(17);

    setSelectedRestaurant(r);
  };

  // ---- Handler: exit focus mode ----
  // Removes the single focus pin, then redraws all restaurant pins.
  const handleBack = () => {
    setSelectedRestaurant(null);

    const newMap = mapInstanceRef.current;
    if (!newMap) return;

    // Restore the default zoom level.
    newMap.setZoom(14);

    // Remove the single focus pin.
    if (pinMarkerRef.current && typeof pinMarkerRef.current.remove === "function") {
      pinMarkerRef.current.remove();
      pinMarkerRef.current = null;
    }

    // Redraw all restaurant pins.
    const withELoc = restaurants.filter((r) => r.eLoc);
    if (withELoc.length > 0) {
      (mapplsPluginObject as any).pinMarker(
        {
          map: newMap,
          pin: withELoc.map((r) => r.eLoc as string),
          popupHtml: withELoc.map(
            (r) =>
              `<div style="font-weight:600">${r.placeName ?? "Restaurant"}</div>`
          ),
          icon: {
            url: "/dish.png",
            width: 36,
            height: 36,
            offset: [18, 36],
          },
        },
        (data: any) => {
          console.log("📍 Restored pins:", data);
          pinMarkerRef.current = data;
        }
      );
    }
  };

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

      {/* Bottom UI: focus-mode card OR carousel, depending on selection */}
      {selectedRestaurant ? (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-white rounded-2xl shadow-lg p-4">
          <button
            onClick={handleBack}
            className="text-sm text-gray-500 mb-2 flex items-center gap-1 hover:text-gray-800"
          >
            ← Back to all places
          </button>
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedRestaurant.placeName ?? "Unnamed place"}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {selectedRestaurant.placeAddress ?? "No address"}
          </p>
          {typeof selectedRestaurant.distance === "number" && (
            <p className="text-xs text-gray-400 mt-2">
              {selectedRestaurant.distance < 1000
                ? `${Math.round(selectedRestaurant.distance)} m away`
                : `${(selectedRestaurant.distance / 1000).toFixed(1)} km away`}
            </p>
          )}
        </div>
      ) : (
        restaurants.length > 0 && (
          <div className="absolute bottom-4 left-0 right-0 z-10">
            <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide">
              {restaurants.map((r, i) => (
                <div key={r.eLoc ?? i} className="snap-start">
                  <RestaurantCard
                    restaurant={r}
                    onClick={() => handleCardClick(r)}
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