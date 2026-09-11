/**
 * Photographic placeholders. Pass `src` on <Photo> to replace any of these
 * without changing page layout.
 */
export const PHOTO_LIBRARY = {
  landscape: "/images/forest-background.jpg",
  hero: "/images/family-packing-car.jpg",
  grab: "/images/go-bag.jpg",
  ready: "/images/packing-kit.jpg",
  vehicle: "/images/family-packing-car.jpg",
  home: "/images/pantry-home.jpg",
  packing: "/images/family-checklist.jpg",
  devices: "/images/app-phone-desktop.jpg",
  forestfloor: "/images/forest-background.jpg",
  offgrid: "/images/power-outage.jpg",
  water: "/images/water-filter.jpg",
  power: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80",
  cooling: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80",
  food: "/images/pantry-food.jpg",
  video: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80",
} as const;

export const HERO_SLIDES = [
  {
    src: "/images/family-packing-car.jpg",
    alt: "A family packing the car with evacuation bags and supplies",
  },
  {
    src: "/images/packing-suitcase.jpg",
    alt: "Packing a suitcase with clothes and emergency essentials",
  },
  {
    src: "/images/pantry-food.jpg",
    alt: "A home pantry stocked with food, water, and preparedness supplies",
  },
] as const;

export type PhotoSubject = keyof typeof PHOTO_LIBRARY;

export const SYSTEM_PHOTOS: Record<string, PhotoSubject> = {
  "grab-go": "grab",
  "ready-bag": "ready",
  "vehicle-suitcase": "vehicle",
  "home-resilience": "home",
  "off-grid": "offgrid",
  "water-purification": "water",
  "battery-solar": "power",
  "cooling-heat": "cooling",
  "long-term-food": "food",
};
