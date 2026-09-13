# FNM — Food Near Me

> A simple and effective way to find food near you.

FNM is a mobile-first web app that opens straight to a map of your surroundings and shows nearby restaurants, cafes, bakeries, and fast food joints as custom pins. Tap a pin or a card to focus on a place, see its details, and get there.

No signup. No clutter. Just food near you.

---

## ✨ Features

- 📍 **Auto-locates you** on load — no search bar, no address entry
- 🍽️ **Broad food coverage** — restaurants, cafes, bakeries, and fast food in one view
- 📌 **Custom map pins** instead of generic markers
- 🎴 **Horizontal card carousel** for browsing nearby places at a glance
- 🎯 **Focus mode** — tap a card to isolate that restaurant on the map, with a back button to return
- 🗺️ **Smooth pan and zoom** to the selected place
- 📱 **Phone-first design** that also works on desktop

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Map & Places | [Mappls (MapmyIndia)](https://about.mappls.com/api/) Web SDK |
| Plugins | `nearby`, `pinMarker`, `getPinDetails` |
| Location | Browser Geolocation API |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A free [Mappls developer account](https://auth.mappls.com/console/) with a project created

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/fnm.git
cd fnm