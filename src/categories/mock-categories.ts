export type MockCategory = {
  name: string;
  slug: string;
  description: string;
  iconName: string;
  sortOrder: number;
};

export const mockCategories: MockCategory[] = [
  {
    name: "Electronice",
    slug: "electronice",
    description:
      "Laptopuri, tablete, monitoare, accesorii tech si device-uri folosite ocazional.",
    iconName: "devices",
    sortOrder: 10,
  },
  {
    name: "Gaming & Console",
    slug: "gaming-console",
    description:
      "Console, controllere, VR, jocuri si setup-uri pentru seri sau evenimente de gaming.",
    iconName: "sports_esports",
    sortOrder: 20,
  },
  {
    name: "Foto & Video",
    slug: "foto-video",
    description:
      "Camere, obiective, lumini, microfoane si kituri pentru creatori de continut.",
    iconName: "photo_camera",
    sortOrder: 30,
  },
  {
    name: "Drone",
    slug: "drone",
    description:
      "Drone, stabilizatoare si accesorii pentru filmari aeriene sau inspectii rapide.",
    iconName: "flight",
    sortOrder: 40,
  },
  {
    name: "Unelte",
    slug: "unelte",
    description:
      "Scule electrice, truse, echipamente de bricolaj si unelte pentru renovari scurte.",
    iconName: "construction",
    sortOrder: 50,
  },
  {
    name: "Casa & Gradina",
    slug: "casa-gradina",
    description:
      "Aparate pentru curatenie, gradinarit, intretinere si proiecte de weekend acasa.",
    iconName: "home_repair_service",
    sortOrder: 60,
  },
  {
    name: "Sport & Outdoor",
    slug: "sport-outdoor",
    description:
      "Echipament de camping, sport, drumetii, actiune si activitati sezoniere.",
    iconName: "hiking",
    sortOrder: 70,
  },
  {
    name: "Evenimente",
    slug: "evenimente",
    description:
      "Boxe, lumini, proiectoare, corturi, mobilier si recuzita pentru evenimente.",
    iconName: "celebration",
    sortOrder: 80,
  },
  {
    name: "Mobilitate",
    slug: "mobilitate",
    description:
      "Biciclete, trotinete, suporturi auto si accesorii de transport urban.",
    iconName: "electric_scooter",
    sortOrder: 90,
  },
  {
    name: "Fashion & Accesorii",
    slug: "fashion-accesorii",
    description:
      "Tinute speciale, genti, accesorii premium si articole purtate rar.",
    iconName: "checkroom",
    sortOrder: 100,
  },
  {
    name: "Copii & Familie",
    slug: "copii-familie",
    description:
      "Carucioare, scaune auto, jucarii mari si echipamente folosite temporar.",
    iconName: "child_friendly",
    sortOrder: 110,
  },
  {
    name: "Muzica & Audio",
    slug: "muzica-audio",
    description:
      "Instrumente, microfoane, mixere, boxe si echipamente pentru repetitii sau live.",
    iconName: "music_note",
    sortOrder: 120,
  },
];
