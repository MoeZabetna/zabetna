import {
  UtensilsCrossed,
  Martini,
  Shirt,
  Dumbbell,
  Car,
  PawPrint,
  Tv,
  Trophy,
  ShoppingBag,
  Coffee,
  Scissors,
  Sparkles,
  Stethoscope,
  Plane,
  Gamepad2,
  Baby,
  Home as HomeIcon,
  Wrench,
  BookOpen,
  Music,
  Camera,
  Gift,
  Flower2,
  Bike,
  Palette,
  Popcorn,
  IceCreamCone,
  Hotel,
  Waves,
  Store,
  type LucideIcon,
} from "lucide-react";

// The set an admin picks from when creating/editing a category. Kept
// curated (not "all of lucide-react") so the picker stays a fast visual
// scan instead of a searchable icon library — add to this list as new
// category types show up.
export const CATEGORY_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: "UtensilsCrossed", icon: UtensilsCrossed },
  { name: "Martini", icon: Martini },
  { name: "Shirt", icon: Shirt },
  { name: "Dumbbell", icon: Dumbbell },
  { name: "Car", icon: Car },
  { name: "PawPrint", icon: PawPrint },
  { name: "Tv", icon: Tv },
  { name: "Trophy", icon: Trophy },
  { name: "ShoppingBag", icon: ShoppingBag },
  { name: "Coffee", icon: Coffee },
  { name: "Scissors", icon: Scissors },
  { name: "Sparkles", icon: Sparkles },
  { name: "Stethoscope", icon: Stethoscope },
  { name: "Plane", icon: Plane },
  { name: "Gamepad2", icon: Gamepad2 },
  { name: "Baby", icon: Baby },
  { name: "Home", icon: HomeIcon },
  { name: "Wrench", icon: Wrench },
  { name: "BookOpen", icon: BookOpen },
  { name: "Music", icon: Music },
  { name: "Camera", icon: Camera },
  { name: "Gift", icon: Gift },
  { name: "Flower2", icon: Flower2 },
  { name: "Bike", icon: Bike },
  { name: "Palette", icon: Palette },
  { name: "Popcorn", icon: Popcorn },
  { name: "IceCreamCone", icon: IceCreamCone },
  { name: "Hotel", icon: Hotel },
  { name: "Waves", icon: Waves },
  { name: "Store", icon: Store },
];

const ICON_MAP = new Map(CATEGORY_ICONS.map((entry) => [entry.name, entry.icon]));

/** Falls back to Store so a category with an unset/unrecognized icon never renders blank. */
export function getCategoryIcon(name: string | null): LucideIcon {
  return (name && ICON_MAP.get(name)) || Store;
}
