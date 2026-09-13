// A single restaurant card used inside the horizontal carousel.
// Light theme: white card, subtle shadow, orange accent.

type Restaurant = {
  placeName?: string;
  placeAddress?: string;
  distance?: number;
  eLoc?: string;
  [key: string]: unknown;
};

function formatDistance(meters?: number): string {
  if (typeof meters !== "number") return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function RestaurantCard({
  restaurant,
  onClick,
}: {
  restaurant: Restaurant;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="
        flex-shrink-0 w-[75vw] sm:w-72 text-left
        bg-white border border-gray-200 rounded-2xl
        p-4 shadow-sm transition-all
        hover:shadow-md hover:border-gray-300
        active:scale-[0.98]
        focus:outline-none focus:ring-2 focus:ring-orange-500/40
      "
    >
      {/* Restaurant name */}
      <h4 className="font-semibold text-gray-900 text-base leading-tight truncate">
        {restaurant.placeName ?? "Unnamed place"}
      </h4>

      {/* Address — two line clamp */}
      <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-snug">
        {restaurant.placeAddress ?? "No address"}
      </p>

      {/* Bottom row: distance badge + chevron */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
          {formatDistance(restaurant.distance) || "Nearby"}
        </span>
        <span className="text-xs text-gray-400">View →</span>
      </div>
    </button>
  );
}
