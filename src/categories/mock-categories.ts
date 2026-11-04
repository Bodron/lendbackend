export type MockCategory = {
  name: string;
  nameEn: string;
  slug: string;
  description: string;
  descriptionEn: string;
  iconName: string;
  sortOrder: number;
};

export const mockCategories: MockCategory[] = [
  {
    name: "Electronice",
    nameEn: "Electronics",
    slug: "electronice",
    description:
      "Laptopuri, tablete, monitoare, accesorii tech si device-uri folosite ocazional.",
    descriptionEn: "Laptops, tablets, monitors, tech accessories, and devices for occasional use.",
    iconName: "devices",
    sortOrder: 10,
  },
  {
    name: "Gaming & Console",
    nameEn: "Gaming & Consoles",
    slug: "gaming-console",
    description:
      "Console, controllere, VR, jocuri si setup-uri pentru seri sau evenimente de gaming.",
    descriptionEn: "Consoles, controllers, VR, games, and setups for gaming nights or events.",
    iconName: "sports_esports",
    sortOrder: 20,
  },
  {
    name: "Foto & Video",
    nameEn: "Photo & Video",
    slug: "foto-video",
    description:
      "Camere, obiective, lumini, microfoane si kituri pentru creatori de continut.",
    descriptionEn: "Cameras, lenses, lights, microphones, and kits for content creators.",
    iconName: "photo_camera",
    sortOrder: 30,
  },
  {
    name: "Drone",
    nameEn: "Drones",
    slug: "drone",
    description:
      "Drone, stabilizatoare si accesorii pentru filmari aeriene sau inspectii rapide.",
    descriptionEn: "Drones, stabilizers, and accessories for aerial filming or quick inspections.",
    iconName: "flight",
    sortOrder: 40,
  },
  {
    name: "Unelte",
    nameEn: "Tools",
    slug: "unelte",
    description:
      "Scule electrice, truse, echipamente de bricolaj si unelte pentru renovari scurte.",
    descriptionEn: "Power tools, toolkits, DIY equipment, and tools for short renovations.",
    iconName: "construction",
    sortOrder: 50,
  },
  {
    name: "Casa & Gradina",
    nameEn: "Home & Garden",
    slug: "casa-gradina",
    description:
      "Aparate pentru curatenie, gradinarit, intretinere si proiecte de weekend acasa.",
    descriptionEn: "Cleaning, gardening, maintenance, and weekend home project equipment.",
    iconName: "home_repair_service",
    sortOrder: 60,
  },
  {
    name: "Sport & Outdoor",
    nameEn: "Sports & Outdoors",
    slug: "sport-outdoor",
    description:
      "Echipament de camping, sport, drumetii, actiune si activitati sezoniere.",
    descriptionEn: "Camping, sports, hiking, adventure, and seasonal activity equipment.",
    iconName: "hiking",
    sortOrder: 70,
  },
  {
    name: "Masini",
    nameEn: "Cars",
    slug: "masini",
    description:
      "Autoturisme si vehicule disponibile pentru inchiriere locala sau nationala.",
    descriptionEn: "Cars and vehicles available for local or nationwide rental.",
    iconName: "directions_car",
    sortOrder: 75,
  },
  {
    name: "Imobiliare",
    nameEn: "Real Estate",
    slug: "imobiliare",
    description:
      "Apartamente, case si spatii care pot fi descoperite din orice oras.",
    descriptionEn: "Apartments, houses, and spaces available to explore from any city.",
    iconName: "apartment",
    sortOrder: 76,
  },
  {
    name: "Evenimente",
    nameEn: "Events",
    slug: "evenimente",
    description:
      "Boxe, lumini, proiectoare, corturi, mobilier si recuzita pentru evenimente.",
    descriptionEn: "Speakers, lighting, projectors, tents, furniture, and event props.",
    iconName: "celebration",
    sortOrder: 80,
  },
  {
    name: "Mobilitate",
    nameEn: "Mobility",
    slug: "mobilitate",
    description:
      "Biciclete, trotinete, suporturi auto si accesorii de transport urban.",
    descriptionEn: "Bikes, scooters, car racks, and urban transport accessories.",
    iconName: "electric_scooter",
    sortOrder: 90,
  },
  {
    name: "Fashion & Accesorii",
    nameEn: "Fashion & Accessories",
    slug: "fashion-accesorii",
    description:
      "Tinute speciale, genti, accesorii premium si articole purtate rar.",
    descriptionEn: "Special outfits, bags, premium accessories, and rarely worn items.",
    iconName: "checkroom",
    sortOrder: 100,
  },
  {
    name: "Copii & Familie",
    nameEn: "Kids & Family",
    slug: "copii-familie",
    description:
      "Carucioare, scaune auto, jucarii mari si echipamente folosite temporar.",
    descriptionEn: "Strollers, car seats, large toys, and equipment needed temporarily.",
    iconName: "child_friendly",
    sortOrder: 110,
  },
  {
    name: "Muzica & Audio",
    nameEn: "Music & Audio",
    slug: "muzica-audio",
    description:
      "Instrumente, microfoane, mixere, boxe si echipamente pentru repetitii sau live.",
    descriptionEn: "Instruments, microphones, mixers, speakers, and equipment for rehearsals or live events.",
    iconName: "music_note",
    sortOrder: 120,
  },
];
