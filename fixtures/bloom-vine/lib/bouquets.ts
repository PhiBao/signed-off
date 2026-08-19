export interface Bouquet {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /** Price in pence, to keep money in integers. */
  readonly pricePence: number;
  readonly inStock: boolean;
  /** Two-tone posy rendered in CSS, so the fixture needs no image assets. */
  readonly palette: readonly [string, string];
}

export const BOUQUETS: readonly Bouquet[] = [
  {
    slug: 'garden-blush',
    name: 'Garden Blush',
    description: 'Soft pink garden roses, astilbe and eucalyptus.',
    pricePence: 4200,
    inStock: true,
    palette: ['#f2b8c6', '#8fae86'],
  },
  {
    slug: 'wild-meadow',
    name: 'Wild Meadow',
    description: 'Cornflower, scabiosa and grasses, loosely tied.',
    pricePence: 3500,
    inStock: true,
    palette: ['#9db4d8', '#a9c48b'],
  },
  {
    slug: 'sunlit-market',
    name: 'Sunlit Market',
    description: 'Ranunculus and craspedia with soft foliage.',
    pricePence: 3800,
    inStock: true,
    palette: ['#f5c66b', '#87a578'],
  },
  {
    slug: 'winter-white',
    name: 'Winter White',
    description: 'Anemone, ranunculus and silver eucalyptus.',
    pricePence: 4800,
    inStock: false,
    palette: ['#e8e6df', '#7f9a86'],
  },
  {
    slug: 'evening-plum',
    name: 'Evening Plum',
    description: 'Deep dahlias, plum carnation and trailing ivy.',
    pricePence: 4500,
    inStock: true,
    palette: ['#8d6a9f', '#6f8a6a'],
  },
  {
    slug: 'letterbox-posy',
    name: 'Letterbox Posy',
    description: 'A small hand-tied posy that fits through the door.',
    pricePence: 2600,
    inStock: true,
    palette: ['#f0a9a0', '#9bb98d'],
  },
];

export function findBouquet(slug: string): Bouquet | undefined {
  return BOUQUETS.find((b) => b.slug === slug);
}

export function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
