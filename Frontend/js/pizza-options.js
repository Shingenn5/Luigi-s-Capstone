export const SAUCE_OPTIONS = ['Regular', 'Light', 'Extra', 'None'];
export const CHEESE_OPTIONS = ['Regular', 'Light', 'None'];

export function pizzaPreferences(item, isPizza) {
  if (!isPizza) {
    if (item.sauce !== undefined || item.cheese !== undefined) {
      throw new Error(
        'Sauce and cheese options are only available for pizzas.',
      );
    }
    return {};
  }
  const sauce = item.sauce ?? 'Regular';
  const cheese = item.cheese ?? 'Regular';
  if (!SAUCE_OPTIONS.includes(sauce) || !CHEESE_OPTIONS.includes(cheese)) {
    throw new Error('Choose an available sauce and cheese option.');
  }
  return { sauce, cheese };
}

export function toppingLabel(toppingName, quantity) {
  if (quantity === 1) return toppingName;
  if (quantity === 2) return `Double ${toppingName}`;
  // Existing orders may predate the regular/double choices.
  return `${quantity} portions of ${toppingName}`;
}

export function preferenceLabel(sauce = 'Regular', cheese = 'Regular') {
  const sauceLabel = sauce === 'None' ? 'No sauce' : `${sauce} sauce`;
  const cheeseLabel = cheese === 'None' ? 'No cheese' : `${cheese} cheese`;
  return `${sauceLabel}, ${cheeseLabel}`;
}
