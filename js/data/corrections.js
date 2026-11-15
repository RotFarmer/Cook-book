// Corrections to the book recipe collection, found by re-checking every card against the books.
// They are applied once to collections already stored on a device or in an account (see
// store.js), so nobody has to unlock the collection again. A correction is skipped if its
// `find` text is no longer there, which leaves recipes you have edited yourself alone, and
// applying them again changes nothing.
//
//   {id, field, find, replace}   replace text in a field (in each line of a list field);
//                                a line or yield left empty is removed
//   {id, field, after, add}      add a line to a list field after the line containing `after`

export const CORRECTIONS_REV = 1;

const CHEESECAKE_NOTE = 'With the cream topping the flavour is better after 20 hours in the fridge.';

export const CORRECTIONS = [
  // A list of jar sizes was only partly converted to grams.
  { id: 'rlwd-blenderizing-the-easy-way', field: 'method', find: 'in 4, 8, 12 and 455 g sizes', replace: 'in 115, 225, 340 and 455 g sizes' },
  // Not an instruction the book gives.
  { id: 'rlwd-blenderizing-the-easy-way', field: 'notes', find: 'Check jars for cracks before use. ', replace: '' },
  { id: 'rlwd-making-coconut-cream', field: 'notes', find: 'extends this to about 3 weeks', replace: 'extends this to up to 3 weeks' },
  // The book only says the pollen goes in before blending.
  {
    id: 'rlwd-pain-formula', field: 'method',
    find: 'Add the bee pollen to the ingredients of the Moisturizing/Lubrication Formula Drink before blending, then warm and blend as for that drink.',
    replace: 'Prepare the Moisturizing/Lubrication Formula Drink up to the point of blending, add the bee pollen, then blend.',
  },
  // A warning the book gives that the card had dropped.
  {
    id: 'rlwd-constipation-remedies-temporary-emergency-drink', field: 'notes',
    find: 'breathe deeply and slowly.', replace: 'breathe deeply and slowly. Do not use an electric heating pad or microwave packs.',
  },
  // Readings of lines the book leaves unclear, now marked as such.
  { id: 'rlwd-cheesecake', field: 'notes', find: CHEESECAKE_NOTE, replace: CHEESECAKE_NOTE + ' How much butter to keep back for the crust is this card’s reading; the book is not explicit.' },
  { id: 'rlwd-cheesecake-miniature', field: 'notes', find: CHEESECAKE_NOTE, replace: CHEESECAKE_NOTE + ' How much butter to keep back for the crust is this card’s reading; the book is not explicit.' },
  {
    id: 'rlwd-green-vegetable-juice-2-arteries-intestines', field: 'notes',
    find: 'Green vegetable juice. The honey helps',
    replace: 'Green vegetable juice. The book does not say what to do with the blended pineapple; stirring it into the juice is this card’s reading. The honey helps',
  },
  // The book gives no reason and names no temperature.
  { id: 'rpp-raw-butter-cinnamon-and-raw-honey-tartine', field: 'notes', find: 'An occasional treat, since the bread is not raw.', replace: 'The author has it occasionally, as a treat.' },
  { id: 'rpp-warm-butter-drink', field: 'method', find: 'Warm the water on the stove to tea-drinking temperature.', replace: 'Warm the water on the stove, as you would for tea.' },
  // The book gives no servings for these.
  { id: 'rpp-warm-butter-drink', field: 'yield', find: '1 serving', replace: '' },
  { id: 'rpp-antibacterial-butter-recipe', field: 'yield', find: '1 serving', replace: '' },
  { id: 'rpp-egg-cocktail', field: 'yield', find: '1 serving', replace: '' },
  { id: 'rpp-country-chicken-ceviche', field: 'method', find: 'Drain the chicken and keep the marinade.', replace: 'Drain the chicken, squeezing it, and keep the marinade.' },
  // The book's method blends lime zest into the sauce without listing it.
  { id: 'rpp-spicy-garlic-shrimp-ceviche', field: 'ingredients', after: '1 tbsp apple cider vinegar (for the sauce)', add: 'Lime zest (for the sauce; the book gives no amount)' },
  { id: 'rpp-spicy-garlic-shrimp-ceviche', field: 'method', find: 'olive oil, honey and vinegar in a blender.', replace: 'olive oil, honey, lime zest and vinegar in a blender.' },
  // In this recipe the book puts the keep-blending advice after the cream goes in.
  { id: 'rpp-strawberry-marrow-mousse', field: 'method', find: 'blend until smooth; if it turns chunky or gritty, keep blending.', replace: 'blend until smooth.' },
  { id: 'rpp-strawberry-marrow-mousse', field: 'method', find: 'over-blending turns the cream to butter.', replace: 'over-blending turns the cream to butter. If it turns chunky or gritty, keep blending.' },
  // The book names two alternatives to the vinegar, not three, and puts chicken feet in the
  // chapter introduction rather than in this recipe.
  { id: 'rpp-chicken-broth-plain', field: 'ingredients', find: '2 tbsp raw apple cider vinegar, or sherry, white wine or lemon', replace: '2 tbsp raw apple cider vinegar, or 2 tbsp sherry white wine or lemon' },
  { id: 'rpp-chicken-broth-plain', field: 'ingredients', find: 'Chicken feet (optional, for a more gelatinous broth)', replace: '' },
  { id: 'rpp-chicken-broth-plain', field: 'notes', find: 'by stacking a second burner grate.', replace: 'by stacking a second burner grate. The chapter introduction says that adding chicken feet gives the most gelatin-rich broth.' },
  { id: 'rpp-beef-broth-plain', field: 'ingredients', find: '2 tbsp raw apple cider vinegar, or sherry, white wine or lemon juice', replace: '2 tbsp raw apple cider vinegar, or 2 tbsp sherry white wine or lemon juice' },
];

/** Applies the corrections to a list of recipes in place. Returns how many took effect. */
export function applyCorrections(recipes) {
  const byId = new Map(recipes.map(r => [r.id, r]));
  let applied = 0;
  for (const c of CORRECTIONS) {
    const r = byId.get(c.id);
    if (!r) continue;
    const value = r[c.field];
    if (c.add) {
      if (!Array.isArray(value) || value.includes(c.add)) continue;
      const at = value.findIndex(line => line.includes(c.after));
      if (at < 0) continue;
      value.splice(at + 1, 0, c.add);
      applied++;
    } else if (Array.isArray(value)) {
      // Already corrected (some corrections add to text that stays in place): leave it.
      if (c.replace && value.some(line => line.includes(c.replace))) continue;
      if (!value.some(line => line.includes(c.find))) continue;
      r[c.field] = value.map(line => line.replace(c.find, c.replace).trim()).filter(Boolean);
      applied++;
    } else if (typeof value === 'string' && value.includes(c.find)) {
      if (c.replace && value.includes(c.replace)) continue;
      const next = value.replace(c.find, c.replace).trim();
      if (next) r[c.field] = next;
      else delete r[c.field];
      applied++;
    }
  }
  return applied;
}
