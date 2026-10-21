import { writeFileSync } from 'node:fs';

// Shared canvas and pixels per inch keep the three diameters directly comparable.
const PIXELS_PER_INCH = 250 / 18;
const CENTER_X = 200;
const CENTER_Y = 142;
const REFERENCE_RADIUS = 125;
const pizzaSizes = [
  { name: 'Small', diameter: 12, pepperoniCount: 10 },
  { name: 'Medium', diameter: 14, pepperoniCount: 14 },
  { name: 'Large', diameter: 18, pepperoniCount: 20 },
];

function number(value) {
  return Number(value.toFixed(2));
}

function pizzaGraphic({ name, diameter, pepperoniCount }) {
  const radius = (diameter * PIXELS_PER_INCH) / 2;
  const cheeseRadius = radius - 12;
  const left = number(CENTER_X - radius);
  const right = number(CENTER_X + radius);
  const marks = [];

  // A deterministic spiral places toppings without making repeating rings.
  for (let index = 0; index < pepperoniCount; index++) {
    const angle = index * 2.39996;
    const distance =
      Math.sqrt((index + 0.5) / pepperoniCount) * (cheeseRadius - 12);
    const x = number(CENTER_X + Math.cos(angle) * distance);
    const y = number(CENTER_Y + Math.sin(angle) * distance);
    marks.push(`<g transform="translate(${x} ${y}) rotate(${index * 29})">
      <circle r="9" fill="url(#pepperoni)" stroke="#922b20" stroke-width="0.8" />
      <circle cx="-3" cy="-3" r="1.3" fill="#ed9b66" /><circle cx="3" cy="2" r="1" fill="#eea16a" />
      <path d="M-4 4q3 2 6 0" fill="none" stroke="#8d291d" stroke-width="1" />
    </g>`);
  }

  for (let index = 0; index < 50; index++) {
    const angle = index * 2.39996 + 0.7;
    const distance = Math.sqrt((index + 0.5) / 50) * (cheeseRadius - 3);
    const x = number(CENTER_X + Math.cos(angle) * distance);
    const y = number(CENTER_Y + Math.sin(angle) * distance);
    marks.unshift(
      `<ellipse cx="${x}" cy="${y}" rx="${2 + (index % 4)}" ry="${1 + (index % 3)}" fill="${index % 3 ? '#dc8d36' : '#a95425'}" opacity="0.48" transform="rotate(${index * 37} ${x} ${y})" />`,
    );
    if (index % 5 === 0) {
      marks.push(
        `<path d="M${x} ${y}q-5-7-7-1q3 4 7 1m0 0q4-8 7-3q-1 4-7 3" fill="#3d6536" />`,
      );
    }
  }

  const crustMarks = [];
  for (let index = 0; index < 26; index++) {
    const angle = (index / 26) * Math.PI * 2;
    const x = number(CENTER_X + Math.cos(angle) * (radius - 4.5));
    const y = number(CENTER_Y + Math.sin(angle) * (radius - 4.5));
    crustMarks.push(
      `<ellipse cx="${x}" cy="${y}" rx="${2 + (index % 3)}" ry="1.8" fill="#8d4720" opacity="0.4" transform="rotate(${number((angle * 180) / Math.PI + 90)} ${x} ${y})" />`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320" role="img" aria-labelledby="title description">
  <title id="title">${name} pizza — ${diameter}-inch diameter</title>
  <desc id="description">Top-view pizza illustration drawn at the same scale as the other sizes. The dashed circle marks an 18-inch pizza. Toppings are illustrative.</desc>
  <defs>
    <radialGradient id="paper"><stop stop-color="#fffcf6" /><stop offset="1" stop-color="#f4eadc" /></radialGradient>
    <radialGradient id="crust" cx="38%" cy="30%"><stop stop-color="#f7d69b" /><stop offset="0.78" stop-color="#d89442" /><stop offset="0.95" stop-color="#b86c29" /><stop offset="1" stop-color="#955225" /></radialGradient>
    <radialGradient id="cheese" cx="40%" cy="30%"><stop stop-color="#ffe9a1" /><stop offset="0.7" stop-color="#f7ce70" /><stop offset="1" stop-color="#eeb254" /></radialGradient>
    <radialGradient id="pepperoni" cx="36%" cy="28%"><stop stop-color="#de7050" /><stop offset="0.7" stop-color="#bf412d" /><stop offset="1" stop-color="#9b2d22" /></radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#4a2e1b" flood-opacity="0.22" /></filter>
  </defs>
  <rect width="400" height="320" fill="url(#paper)" />
  <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${REFERENCE_RADIUS}" fill="none" stroke="#ae9e8a" stroke-width="1.5" stroke-dasharray="3 5" />
  <g filter="url(#shadow)">
    <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${number(radius)}" fill="url(#crust)" />
    <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${number(radius - 9)}" fill="#b9482e" />
    <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="${number(cheeseRadius)}" fill="url(#cheese)" />
    ${crustMarks.join('\n    ')}
    ${marks.join('\n    ')}
  </g>
  <g fill="none" stroke="#68523d" stroke-width="1.5">
    <path d="M${left} 280v13m${right - left} -13v13" />
    <path d="M${left} 287H${CENTER_X - 40}m80 0H${right}" />
    <path d="M${left + 5} 284l-5 3 5 3M${right - 5} 284l5 3-5 3" />
  </g>
  <text x="200" y="295" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#493a2e">${diameter}<tspan font-size="14" dx="3">IN</tspan></text>
</svg>
`;
}

for (const pizzaSize of pizzaSizes) {
  const filename = `../Frontend/assets/pizza-${pizzaSize.name.toLowerCase()}.svg`;
  writeFileSync(new URL(filename, import.meta.url), pizzaGraphic(pizzaSize));
  console.log(
    `${pizzaSize.name}: ${pizzaSize.diameter} inches, ${number(pizzaSize.diameter * PIXELS_PER_INCH)} SVG units across`,
  );
}
