// Foods offered in the food log: the ones commonly eaten on Aajonus Vonderplanitz's
// raw primal diet. No calories or nutrients on purpose — the log only records what and when.
// Each food appears in one group only.

export const FOOD_GROUPS = [
  {
    name: 'Meat',
    foods: ['Beef', 'Ground beef', 'Steak', 'Bison', 'Lamb', 'Chicken', 'Turkey', 'Duck', 'Pork', 'Venison', 'Goat'],
  },
  {
    name: 'Organs & glands',
    foods: ['Liver', 'Heart', 'Kidney', 'Bone marrow', 'Tongue', 'Sweetbreads', 'Brain', 'Spleen', 'High meat'],
  },
  {
    name: 'Fish & shellfish',
    foods: ['Salmon', 'Tuna', 'Halibut', 'Sea bass', 'Mackerel', 'Sardines', 'Swordfish', 'Oysters', 'Scallops', 'Shrimp', 'Clams', 'Fish roe'],
  },
  {
    name: 'Eggs',
    foods: ['Raw eggs', 'Egg yolks', 'Duck eggs', 'Quail eggs'],
  },
  {
    name: 'Dairy',
    foods: ['Raw milk', 'Raw cream', 'Raw butter', 'Raw cheese', 'Raw kefir', 'Raw goat milk', 'Raw yogurt', 'Cultured cream', 'Whey', 'Colostrum'],
  },
  {
    name: 'Fats',
    foods: ['Coconut cream', 'Avocado', 'Olive oil', 'Coconut oil', 'Fresh coconut', 'Flax oil', 'Suet'],
  },
  {
    name: 'Honey & bee foods',
    foods: ['Unheated honey', 'Honeycomb', 'Bee pollen', 'Royal jelly'],
  },
  {
    name: 'Juices & drinks',
    foods: ['Green vegetable juice', 'Celery juice', 'Carrot juice', 'Cucumber juice', 'Parsley juice', 'Zucchini juice', 'Tomato juice', 'Coconut water', 'Sparkling mineral water', 'Lemon juice', 'Lime juice', 'Raw apple cider vinegar'],
  },
  {
    name: 'Formulas & mixes',
    foods: ['Milkshake', 'Lubrication formula', 'Moisturizing formula', 'Meat with sauce', 'Nut formula', 'Cheese with honey', 'Butter with honey', 'Eggs with honey', 'Raw ice cream', 'Raw custard'],
  },
  {
    name: 'Fruit',
    foods: ['Pineapple', 'Papaya', 'Mango', 'Banana', 'Berries', 'Blueberries', 'Strawberries', 'Orange', 'Apple', 'Watermelon', 'Melon', 'Grapes', 'Cherries', 'Peach', 'Figs', 'Dates', 'Tomato', 'Cucumber'],
  },
  {
    name: 'Vegetables & herbs',
    foods: ['Onion', 'Garlic', 'Ginger', 'Hot pepper', 'Bell pepper', 'Cilantro', 'Parsley', 'Basil', 'Corn', 'Sun-dried olives'],
  },
  {
    name: 'Other',
    foods: ['Raw nuts', 'Edible clay'],
  },
];
