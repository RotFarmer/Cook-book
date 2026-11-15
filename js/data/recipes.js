// Built-in recipes, shown in the Recipes tab next to the ones you add yourself.
//
// Each recipe:
//   {
//     id: 'unique-slug',
//     title: 'Name of the recipe',
//     category: 'Group it is listed under',
//     source: 'Book or PDF it came from',   (optional)
//     page: 123,                             (optional)
//     yield: 'Makes 1 serving',              (optional)
//     ingredients: ['1 cup …', '2 tbsp …'],
//     method: ['First step or paragraph.', 'Second step.'],
//     notes: 'Anything else worth knowing.', (optional)
//   }
//
// This list is for recipes that ship with the app in the open. The collection taken from books
// is not stored here: it ships locked in recipes.pack.js, and once opened it lives with the
// rest of your private entries (the "library-N" documents in js/store.js).

export const RECIPES = [];
