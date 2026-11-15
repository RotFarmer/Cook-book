// Rewrites ounce and pound amounts in recipe text as grams. Weight only, never volume.
//
//   "5 to 8 oz chicken"  → "140 to 225 g chicken"
//   "1 1/2 lb beef"      → "680 g beef"
//   "an 8-oz jar"        → "a 225 g jar"       jar and glass sizes are given in grams too
//
// Grams are rounded to the nearest 5 (nearest 10 above a kilo).

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const NUM = '(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?\\s?[½¼¾⅓⅔]|[½¼¾⅓⅔]|\\d+(?:\\.\\d+)?)';
const OZ = '(?:oz|ounces?)';
const LB = '(?:lbs?|pounds?)';
const CONTAINER = '(?:jars?|glass(?:es)?|bottles?|containers?)';

function value(text) {
  let total = 0;
  for (const part of text.trim().split(/\s+/)) {
    const m = part.match(/^(\d+(?:\.\d+)?)?([½¼¾⅓⅔])?$/);
    if (part.includes('/')) {
      const [a, b] = part.split('/').map(Number);
      total += a / b;
    } else if (m) {
      total += Number(m[1] || 0) + (m[2] ? FRACTIONS[m[2]] : 0);
    }
  }
  return total;
}

const grams = g => String(g >= 1000 ? Math.round(g / 10) * 10 : Math.max(5, Math.round(g / 5) * 5));
const OZ_GRAMS = 28.35;

// "an 8-oz jar" must not turn into "an 240 ml jar".
const fixArticle = text => text.replace(/\b(an?) (\d+)(?=(?: (?:or|to) \d+)? (?:ml|g)\b)/gi, (all, article, n) => {
  const vowelSound = n[0] === '8' || n === '11' || n === '18'; // "an 85 g", but "a 115 g"
  const fixed = vowelSound ? 'an' : 'a';
  return (article[0] === 'A' ? fixed[0].toUpperCase() + fixed.slice(1) : fixed) + ' ' + n;
});

export function toMetric(text) {
  if (!text || !/\b(?:oz|ounces?|lbs?|pounds?)\b/i.test(text)) return text;
  let out = text;

  // Container sizes, including "4- or 8-oz jar".
  out = out.replace(
    new RegExp(`(${NUM})(?:-?\\s*(or|to)\\s*(${NUM}))?[-\\s]*${OZ}\\b\\.?(\\s*\\([^)]*\\))?[-\\s]+(${CONTAINER})\\b`, 'gi'),
    (all, a, join, b, aside, what) => {
      const size = b ? `${grams(value(a) * OZ_GRAMS)} ${join} ${grams(value(b) * OZ_GRAMS)}` : grams(value(a) * OZ_GRAMS);
      return `${size} g${aside || ''} ${what}`; // keeps an aside such as "(quart)"
    });

  // Amounts, including ranges such as "5 to 8 oz" and "1/2 to 1 lb".
  const amount = (unit, perUnit) => {
    out = out.replace(
      new RegExp(`(${NUM})(?:\\s*(to|or|-|–)\\s*(${NUM}))?[-\\s]*${unit}\\b\\.?`, 'gi'),
      (all, a, join, b) => {
        const first = grams(value(a) * perUnit);
        if (!b) return `${first} g`;
        const second = grams(value(b) * perUnit);
        return `${first} ${join === '-' || join === '–' ? 'to' : join} ${second} g`;
      });
  };
  amount(OZ, OZ_GRAMS);
  amount(LB, 453.6);

  return fixArticle(out);
}

/**
 * An earlier version wrote jar and glass sizes in millilitres ("a 240 ml jar"). This turns
 * those into grams by way of the ounce size they came from, so 240 ml becomes 225 g like
 * every other "8 oz".
 */
export function millilitresToGrams(text) {
  if (!text || !/\bml\b/.test(text)) return text;
  const g = ml => grams(Math.round(Number(ml) / 29.57) * OZ_GRAMS);
  return fixArticle(text.replace(/(\d+)(?: (or|to) (\d+))? ml\b/g,
    (all, a, join, b) => (b ? `${g(a)} ${join} ${g(b)} g` : `${g(a)} g`)));
}

/**
 * Converts one recipe in place. Pass fromMillilitres for a recipe that the earlier version
 * already converted. Returns true if anything changed.
 */
export function recipeToMetric(recipe, fromMillilitres = false) {
  let changed = false;
  const fix = t => {
    const m = fromMillilitres ? millilitresToGrams(t) : toMetric(t);
    if (m !== t) changed = true;
    return m;
  };
  if (recipe.yield) recipe.yield = fix(recipe.yield);
  if (recipe.notes) recipe.notes = fix(recipe.notes);
  if (recipe.ingredients) recipe.ingredients = recipe.ingredients.map(fix);
  if (recipe.method) recipe.method = recipe.method.map(fix);
  return changed;
}
