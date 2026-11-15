// Rewrites ounce and pound amounts in recipe text as metric.
//
//   "5 to 8 oz chicken"  → "140 to 225 g chicken"      amounts of food become grams
//   "1 1/2 lb beef"      → "680 g beef"
//   "an 8-oz jar"        → "a 240 ml jar"              jar and glass sizes become millilitres,
//                                                      because a container is sized by volume
// Grams are rounded to the nearest 5 (nearest 10 above a kilo), millilitres to the nearest 10.

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
const millilitres = oz => String(Math.round((oz * 29.57) / 10) * 10);

// "an 8-oz jar" must not turn into "an 240 ml jar".
const fixArticle = text => text.replace(/\b(an?) (\d+)(?=(?: (?:or|to) \d+)? (?:ml|g)\b)/gi, (all, article, n) => {
  const vowelSound = /^(8|11|18)/.test(n) && !/^1[18]\d\d/.test(n);
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
      const size = b ? `${millilitres(value(a))} ${join} ${millilitres(value(b))}` : millilitres(value(a));
      return `${size} ml${aside || ''} ${what}`; // keeps an aside such as "(quart)"
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
  amount(OZ, 28.35);
  amount(LB, 453.6);

  return fixArticle(out);
}

/** Converts one recipe in place. Returns true if anything changed. */
export function recipeToMetric(recipe) {
  let changed = false;
  const fix = t => {
    const m = toMetric(t);
    if (m !== t) changed = true;
    return m;
  };
  if (recipe.yield) recipe.yield = fix(recipe.yield);
  if (recipe.notes) recipe.notes = fix(recipe.notes);
  if (recipe.ingredients) recipe.ingredients = recipe.ingredients.map(fix);
  if (recipe.method) recipe.method = recipe.method.map(fix);
  return changed;
}
