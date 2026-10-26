// The Color Codex: 55 named everyday colors (GDD §10).
// Names come from the xkcd color survey (CC0). `target` is the photo-tamed
// value the game scores against; `anchor` is xkcd's monitor value.
// TODO(calibration): photograph 3–5 real objects per color and adjust targets.

import { hexToOklab, type Lab } from '../color/oklab';
import { TUNING } from './tuning';

export type Tier = 'lead' | 'silver' | 'gold';
export type Element = 'Fire' | 'Earth' | 'Sun' | 'Verdance' | 'Tide' | 'Sky' | 'Bloom' | 'Aether';

export const ELEMENTS: Element[] = ['Fire', 'Earth', 'Sun', 'Verdance', 'Tide', 'Sky', 'Bloom', 'Aether'];

// Plain geometric glyphs that render in every system font (no emoji presentation).
export const ELEMENT_GLYPH: Record<Element, string> = {
  Fire: '△',
  Earth: '▽',
  Sun: '☉︎',
  Verdance: '❦',
  Tide: '≈',
  Sky: '☽︎',
  Bloom: '✿︎',
  Aether: '✦︎',
};

export interface ColorDef {
  id: string;
  name: string;
  element: Element;
  tier: Tier;
  anchor: string;
  target: string;
  virtue: string;
  tol: number;
  /** Weight multiplier when dealing (Violet is untested on cameras). */
  dealWeight: number;
  lab: Lab;
  dark: boolean;
}

type Row = [name: string, element: Element, tier: Tier, anchor: string, target: string, virtue: string, tol?: number, dealWeight?: number];

const ROWS: Row[] = [
  ['Cherry Red', 'Fire', 'lead', '#f7022a', '#e44142', 'Ardor'],
  ['Brick Red', 'Fire', 'silver', '#8f1402', '#8f1402', 'Hearth'],
  ['Maroon', 'Fire', 'silver', '#650021', '#650021', 'Vintage'],
  ['Raspberry', 'Fire', 'gold', '#b00149', '#b00149', 'Bramble'],
  ['Coral', 'Fire', 'silver', '#fc5a50', '#fc5a50', 'Reef'],
  ['Salmon', 'Fire', 'silver', '#ff796c', '#ff796c', 'Upstream'],
  ['Tangerine', 'Fire', 'lead', '#ff9408', '#ff9408', 'Zest'],
  ['Pumpkin', 'Fire', 'lead', '#e17701', '#e17701', 'Harvest'],
  ['Burnt Orange', 'Fire', 'silver', '#c04e01', '#c04e01', 'Ember'],
  ['Peach', 'Fire', 'silver', '#ffb07c', '#ffb07c', 'Orchard'],
  ['Terracotta', 'Earth', 'silver', '#ca6641', '#ca6641', 'Clay'],
  ['Caramel', 'Earth', 'silver', '#af6f09', '#af6f09', 'Toffee'],
  ['Chocolate', 'Earth', 'lead', '#3d1c02', '#3d1c02', 'Comfort', 1.15],
  ['Tan', 'Earth', 'lead', '#d1b26f', '#d1b26f', 'Dune'],
  ['Beige', 'Earth', 'lead', '#e6daa6', '#e6daa6', 'Linen'],
  ['Khaki', 'Earth', 'silver', '#aaa662', '#aaa662', 'Expedition'],
  ['Charcoal', 'Earth', 'lead', '#343837', '#343837', 'Soot'],
  ['Banana Yellow', 'Sun', 'lead', '#fafe4b', '#ebef35', 'Mirth'],
  ['Sunflower Yellow', 'Sun', 'lead', '#ffda03', '#ffda03', 'Noon'],
  ['Mustard', 'Sun', 'silver', '#ceb301', '#ceb301', 'Courage'],
  ['Ochre', 'Sun', 'gold', '#bf9005', '#bf9005', 'Ancients'],
  ['Lime Green', 'Verdance', 'silver', '#89fe05', '#9ff865', 'Fizz'],
  ['Grass Green', 'Verdance', 'lead', '#3f9b0b', '#3f9b0b', 'Meadow'],
  ['Forest Green', 'Verdance', 'silver', '#06470c', '#06470c', 'Deepwood'],
  ['Emerald', 'Verdance', 'silver', '#01a049', '#01a049', 'Envy'],
  ['Mint', 'Verdance', 'silver', '#9ffeb0', '#9ffeb0', 'Breeze'],
  ['Sage', 'Verdance', 'gold', '#87ae73', '#87ae73', 'Wisdom'],
  ['Olive', 'Verdance', 'silver', '#6e750e', '#6e750e', 'Peace'],
  ['Avocado', 'Verdance', 'silver', '#90b134', '#90b134', 'Brunch'],
  ['Jade', 'Tide', 'gold', '#1fa774', '#1fa774', 'Serenity'],
  ['Teal', 'Tide', 'silver', '#029386', '#029386', 'Tide'],
  ['Turquoise', 'Tide', 'silver', '#06c2ac', '#06c2ac', 'Lagoon'],
  ['Aqua', 'Tide', 'gold', '#13eac9', '#13eac9', 'Shallows'],
  ['Petrol', 'Tide', 'gold', '#005f6a', '#005f6a', 'Depths'],
  ['Sky Blue', 'Sky', 'lead', '#75bbfd', '#75bbfd', 'Daydream'],
  ['Baby Blue', 'Sky', 'lead', '#a2cffe', '#a2cffe', 'Lullaby'],
  ['Cerulean', 'Sky', 'silver', '#0485d1', '#0485d1', 'Horizon'],
  ['Denim', 'Sky', 'lead', '#3b638c', '#3b638c', 'Grit'],
  ['Cobalt', 'Sky', 'silver', '#1e488f', '#1e488f', 'Resolve'],
  ['Royal Blue', 'Sky', 'silver', '#0504aa', '#051c9c', 'Crown'],
  ['Navy', 'Sky', 'lead', '#01153e', '#051c46', 'Midnight', 1.15],
  ['Steel Blue', 'Sky', 'gold', '#5a7d9a', '#5a7d9a', 'Mettle'],
  ['Hot Pink', 'Bloom', 'silver', '#ff028d', '#e84b8d', 'Neon'],
  ['Bubblegum Pink', 'Bloom', 'silver', '#fe83cc', '#fe83cc', 'Mischief'],
  ['Baby Pink', 'Bloom', 'lead', '#ffb7ce', '#ffb7ce', 'Blush'],
  ['Magenta', 'Bloom', 'silver', '#c20078', '#bb2177', 'Fervor'],
  ['Mauve', 'Bloom', 'gold', '#ae7181', '#ae7181', 'Nostalgia'],
  ['Orchid', 'Bloom', 'gold', '#c875c4', '#c875c4', 'Allure'],
  ['Periwinkle', 'Aether', 'gold', '#8e82fe', '#8e82fe', 'Whimsy', 1.2],
  ['Lavender', 'Aether', 'silver', '#c79fef', '#c79fef', 'Calm'],
  ['Violet', 'Aether', 'gold', '#9a0eea', '#8e45ca', 'Twilight', 1.3, 0.3],
  ['Indigo', 'Aether', 'gold', '#380282', '#380282', 'Intuition', 1.2],
  ['Plum', 'Aether', 'gold', '#580f41', '#580f41', 'Dusk'],
  ['Eggplant', 'Aether', 'gold', '#380835', '#380835', 'Gloom', 1.15],
  ['Grape', 'Aether', 'gold', '#6c3461', '#6c3461', 'Revelry'],
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, '-');
}

export const COLORS: ColorDef[] = ROWS.map(([name, element, tier, anchor, target, virtue, tol = 1, dealWeight = 1]) => {
  const lab = hexToOklab(target);
  return { id: slug(name), name, element, tier, anchor, target, virtue, tol, dealWeight, lab, dark: lab.L < TUNING.darkL };
});

export const COLOR_BY_ID: Record<string, ColorDef> = Object.fromEntries(COLORS.map((c) => [c.id, c]));

export function color(id: string): ColorDef {
  const c = COLOR_BY_ID[id];
  if (!c) throw new Error(`Unknown color ${id}`);
  return c;
}

export const TIER_LABEL: Record<Tier, string> = { lead: 'Lead', silver: 'Silver', gold: 'Gold' };
