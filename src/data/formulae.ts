// Famous Formulae: hand-named pairs (GDD §11.2).

export interface Formula {
  a: string;
  b: string;
  name: string;
}

export const FORMULAE: Formula[] = [
  { a: 'teal', b: 'coral', name: "Mermaid's Draught" },
  { a: 'navy', b: 'mustard', name: 'Midnight Courage' },
  { a: 'forest-green', b: 'cherry-red', name: 'Hollyberry Cordial' },
  { a: 'pumpkin', b: 'charcoal', name: "Hallow's Brew" },
  { a: 'lavender', b: 'mint', name: "Dreamer's Tonic" },
  { a: 'sky-blue', b: 'banana-yellow', name: 'Summer Noon' },
  { a: 'baby-pink', b: 'sky-blue', name: 'Cradle Song' },
  { a: 'olive', b: 'terracotta', name: 'Mediterranean Tincture' },
  { a: 'denim', b: 'tan', name: "Wanderer's Ration" },
  { a: 'royal-blue', b: 'sunflower-yellow', name: 'Starry Night' },
  { a: 'eggplant', b: 'lime-green', name: "Witch's Garden" },
  { a: 'chocolate', b: 'mint', name: 'After-Dinner Elixir' },
];

export function findFormula(x: string, y: string): Formula | undefined {
  return FORMULAE.find((f) => (f.a === x && f.b === y) || (f.a === y && f.b === x));
}
