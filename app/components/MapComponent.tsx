"use client";

import { useEffect, useRef, useState } from "react";
import { mappls } from "mappls-web-maps";

const mapplsClassObject = new mappls();

export default function MapComponent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
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
            center: [28.633, 77.2194], // Delhi coords, swap for user location later
            zoom: 12,
          },
        });

        newMap.on("load", () => {
          setIsMapLoaded(true);
        });

        mapRef.current = newMap;
      }
    );

    // Cleanup: destroy the map when the component unmounts
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  return (
    <div
      id="map"
      ref={mapRef}
      style={{ width: "100%", height: "100vh" }}
    >
      {!isMapLoaded && <p>Loading map...</p>}
    </div>
  );
}