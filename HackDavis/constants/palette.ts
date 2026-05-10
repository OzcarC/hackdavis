export const palette = {
  coral: '#D08089',
  peach: '#E8A87C',
  mauve: '#94768F',
  navy: '#283956',

  bg: '#FAF6EE',
  card: '#FFFFFF',
  border: '#EFE8DC',
  textPrimary: '#283956',
  textMuted: '#7C7488',
  textSubtle: '#A89FB1',
};

export const tagPalette = [palette.coral, palette.peach, palette.mauve, palette.navy];

export const colorForTag = (tag: string): string => {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return tagPalette[hash % tagPalette.length];
};
