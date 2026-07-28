export type MockProduct = {
  title: string;
  slug: string;
  category: string;
  categorySlug: string;
  description: string;
  pricePerDay: number;
  deposit: number;
  city: string;
  ownerName: string;
  rating: number;
  imageSeed: string;
};

export const mockProducts: MockProduct[] = [
  {
    title: "PlayStation 5 Digital Edition",
    slug: "playstation-5-digital-edition",
    category: "Gaming & Console",
    categorySlug: "gaming-console",
    description:
      "Consola PS5 Digital Edition, controller DualSense inclus, potrivita pentru seri de gaming sau testarea jocurilor noi.",
    pricePerDay: 85,
    deposit: 500,
    city: "Bucuresti",
    ownerName: "Alex M.",
    rating: 4.9,
    imageSeed: "lend-ps5-console",
  },
  {
    title: "Canon EOS R50 Creator Kit",
    slug: "canon-eos-r50-creator-kit",
    category: "Foto & Video",
    categorySlug: "foto-video",
    description:
      "Camera mirrorless compacta cu obiectiv kit, microfon si trepied mic pentru continut video si fotografie.",
    pricePerDay: 120,
    deposit: 900,
    city: "Cluj-Napoca",
    ownerName: "Mara P.",
    rating: 4.8,
    imageSeed: "lend-canon-camera-kit",
  },
  {
    title: "DJI Mini 4 Pro Fly More",
    slug: "dji-mini-4-pro-fly-more",
    category: "Drone",
    categorySlug: "drone",
    description:
      "Drona usoara cu acumulatori extra, geanta de transport si controller RC pentru filmari aeriene.",
    pricePerDay: 150,
    deposit: 1200,
    city: "Brasov",
    ownerName: "Andrei C.",
    rating: 4.9,
    imageSeed: "lend-dji-mini-drone",
  },
  {
    title: "MacBook Pro 14 M3",
    slug: "macbook-pro-14-m3",
    category: "Electronice",
    categorySlug: "electronice",
    description:
      "Laptop performant pentru editare, development si prezentari, cu incarcator USB-C inclus.",
    pricePerDay: 180,
    deposit: 1800,
    city: "Timisoara",
    ownerName: "Ioana D.",
    rating: 4.7,
    imageSeed: "lend-macbook-pro-laptop",
  },
  {
    title: "Bosch Professional Tool Set",
    slug: "bosch-professional-tool-set",
    category: "Unelte",
    categorySlug: "unelte",
    description:
      "Set de bormasina, insurubelnita electrica, acumulatori si accesorii pentru lucrari rapide acasa.",
    pricePerDay: 65,
    deposit: 350,
    city: "Iasi",
    ownerName: "Radu S.",
    rating: 4.6,
    imageSeed: "lend-bosch-tool-set",
  },
  {
    title: "GoPro HERO12 Black Bundle",
    slug: "gopro-hero12-black-bundle",
    category: "Sport & Outdoor",
    categorySlug: "sport-outdoor",
    description:
      "Camera de actiune cu accesorii de prindere, baterii extra si carcasa pentru activitati outdoor.",
    pricePerDay: 70,
    deposit: 450,
    city: "Constanta",
    ownerName: "Diana V.",
    rating: 4.8,
    imageSeed: "lend-gopro-action-camera",
  },
];
