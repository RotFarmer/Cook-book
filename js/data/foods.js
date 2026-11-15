// Foods offered in the food log: what is commonly eaten on Aajonus Vonderplanitz's raw primal
// diet, plus every ingredient used in the recipe collection (variants such as "unsalted raw
// butter" and "soft raw butter" are folded into one entry). No calories or nutrients on
// purpose — the log only records what and when. Each food appears in one group only.

export const FOOD_GROUPS = [
  {
    name: 'Meat',
    foods: ['Beef', 'Ground beef', 'Steak', 'Sirloin steak', 'New York steak', 'Filet mignon', 'Beef tenderloin', 'London broil',
      'Bison', 'Ground bison', 'Lamb', 'Lamb shanks', 'Chicken', 'Turkey', 'Duck', 'Pork', 'Venison', 'Goat', 'Meat fat trimmings'],
  },
  {
    name: 'Organs & glands',
    foods: ['Liver', 'Chicken liver', 'Bison liver', 'Heart', 'Bison heart', 'Kidney', 'Bone marrow', 'Tongue', 'Sweetbreads', 'Brain',
      'Spleen', 'Lung', 'Thyroid gland', 'Adrenal gland', 'Testis', 'Ovary', 'High meat'],
  },
  {
    name: 'Fish & shellfish',
    foods: ['Salmon', 'Tuna', 'Yellowfin tuna', 'Halibut', 'Cod', 'Sole', 'Flounder', 'Escolar', 'Swordfish', 'Sea bass', 'Mackerel',
      'Sardines', 'Oysters', 'Scallops', 'Shrimp', 'Crab', 'Lobster', 'Clams', 'Fish roe'],
  },
  {
    name: 'Eggs',
    foods: ['Raw eggs', 'Egg yolks', 'Fertile eggs', 'Duck eggs', 'Quail eggs'],
  },
  {
    name: 'Dairy',
    foods: ['Raw milk', 'Raw goat milk', 'Raw cream', 'Raw butter', 'Raw cheese', 'Raw cheddar', 'Raw Monterey Jack', 'Muenster cheese',
      'Farmers cheese', 'Cottage cheese', 'Raw kefir', 'Raw yogurt', 'Sour cream', 'Whey', 'Colostrum'],
  },
  {
    name: 'Fats & oils',
    foods: ['Coconut cream', 'Avocado', 'Olive oil', 'Coconut oil', 'Fresh coconut', 'Coconut shreds', 'Flax oil', 'Suet'],
  },
  {
    name: 'Honey & sweet things',
    foods: ['Unheated honey', 'Honeycomb', 'Bee pollen', 'Royal jelly', 'Maple syrup', 'Dates', 'Raisins', 'Raw cacao powder', 'Carob powder'],
  },
  {
    name: 'Juices & drinks',
    foods: ['Green vegetable juice', 'Celery juice', 'Carrot juice', 'Cucumber juice', 'Parsley juice', 'Zucchini juice', 'Tomato juice',
      'Ginger juice', 'Turmeric juice', 'Orange juice', 'Grapefruit juice', 'Pomegranate juice', 'Lemon juice', 'Lime juice',
      'Coconut water', 'Sparkling mineral water', 'Raw apple cider vinegar', 'Pickle juice', 'Bone broth', 'Herbal tea', 'Cold-pressed coffee'],
  },
  {
    name: 'Formulas & mixes',
    foods: ['Milkshake', 'Smoothie', 'Power drink', 'Lubrication formula', 'Moisturizing formula', 'Meat with sauce', 'Nut formula',
      'Cheese with honey', 'Butter with honey', 'Eggs with honey', 'Raw ice cream', 'Raw custard', 'Pasta substitute'],
  },
  {
    name: 'Fruit',
    foods: ['Pineapple', 'Papaya', 'Mango', 'Banana', 'Berries', 'Blueberries', 'Strawberries', 'Raspberries', 'Blackberries', 'Orange',
      'Blood orange', 'Tangerine', 'Grapefruit', 'Lemon', 'Lime', 'Apple', 'Watermelon', 'Cantaloupe', 'Melon', 'Grapes', 'Cherries',
      'Peach', 'Persimmon', 'Kiwi', 'Figs', 'Tomato', 'Cherry tomatoes', 'Sun-dried tomatoes', 'Cucumber'],
  },
  {
    name: 'Vegetables',
    foods: ['Celery', 'Carrot', 'Zucchini', 'Summer squash', 'Cauliflower', 'Asparagus', 'Turnip', 'Leeks', 'Lettuce', 'Red leaf lettuce',
      'Arugula', 'Watercress', 'Mushrooms', 'Bell pepper', 'Hot pepper', 'Jalapeño', 'Habanero', 'Onion', 'Red onion', 'Green onion',
      'Shallot', 'Garlic', 'Ginger', 'Horseradish', 'Corn', 'Sprouted lentils', 'Sprouted peas'],
  },
  {
    name: 'Pickled & fermented',
    foods: ['Pickles', 'Pickled ginger', 'Pickled peppers', 'Fermented vegetables', 'Capers', 'Sun-dried olives'],
  },
  {
    name: 'Herbs & spices',
    foods: ['Basil', 'Thai basil', 'Cilantro', 'Parsley', 'Dill', 'Mint', 'Chives', 'Oregano', 'Rosemary', 'Sage', 'Tarragon', 'Thyme',
      'Bay leaves', 'Allspice', 'Black pepper', 'White pepper', 'Cayenne', 'Paprika', 'Cardamom', 'Caraway seeds', 'Cinnamon', 'Clove',
      'Coriander seeds', 'Cumin', 'Curry powder', 'Fennel seeds', 'Fenugreek seeds', 'Mustard seeds', 'Nutmeg', 'Saffron', 'Turmeric',
      'Ginger powder', 'Vanilla', 'Peppermint extract', 'Lemon zest', 'Lime zest', 'Himalayan salt'],
  },
  {
    name: 'Nuts & seeds',
    foods: ['Walnuts', 'Pecans', 'Almonds', 'Hazelnuts', 'Pine nuts', 'Peanuts', 'Pumpkin seeds', 'Sunflower seeds', 'Nut butter',
      'Almond butter', 'Peanut butter'],
  },
  {
    name: 'Sauces & condiments',
    foods: ['Mustard', 'Mayonnaise', 'Ketchup', 'Horseradish sauce', 'Hollandaise sauce', 'Béchamel sauce', 'Spice paste', 'Wasabe'],
  },
  {
    name: 'Other',
    foods: ['Maca powder', 'Spirulina', 'Sprouted sourdough bread', 'Sherry', 'Edible clay'],
  },
];
