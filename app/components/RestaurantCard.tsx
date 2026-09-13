// A single restaurant card used inside the horizontal carousel.
// Kept as a separate component so it can be reused (e.g., in a list view later).

type Restaurant = {
  placeName?: string;
  placeAddress?: string;
  distance?: number;
  eLoc?: string;
  [key: string]: any;
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
    <div
      onClick={onClick}
      className="flex-shrink-0 w-64 bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
    >
      {/* Image placeholder. Mappls doesn't return photos, so we use a
          gradient block with the first letter of the name. Swap this for
          a real <img> once you have a photo source. */}
      <div className="h-32 bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
        <span className="text-white text-4xl font-bold">
          {restaurant.placeName?.[0]?.toUpperCase() ?? "?"}
        </span>
      </div>

      {/* Card body */}
      <div className="p-3">
        <h4 className="font-semibold text-gray-900 truncate">
          {restaurant.placeName ?? "Unnamed place"}
        </h4>

        <p className="text-xs text-gray-500 line-clamp-2 mt-1 h-8">
          {restaurant.placeAddress ?? "No address"}
        </p>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
            {formatDistance(restaurant.distance) || "Nearby"}
          </span>
          <span className="text-xs text-gray-400">View →</span>
        </div>
      </div>
    </div>
  );
}