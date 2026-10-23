import { writeFileSync } from 'node:fs';

// Each pizza fills the same product-photo frame; dimensions live in the card copy.
const CENTER_X = 240;
const CENTER_Y = 180;
const RADIUS = 145;
const pizzaSizes = [
  { name: 'Small', diameter: 12, slices: 6, seed: 1 },
  { name: 'Medium', diameter: 14, slices: 8, seed: 2 },
  { name: 'Large', diameter: 18, slices: 10, seed: 3 },
];

function number(value) {
  return Number(value.toFixed(2));
}

function pizzaGraphic({ name, diameter, slices, seed }) {
  const marks = [];
  for (let index = 0; index < 95; index++) {
    const angle = index * 2.39996 + seed;
    const distance = Math.sqrt((index + 0.5) / 95) * 119;
    const x = number(CENTER_X + Math.cos(angle) * distance);
    const y = number(CENTER_Y + Math.sin(angle) * distance);
    marks.push(
      `<ellipse cx="${x}" cy="${y}" rx="${3 + (index % 5)}" ry="${2 + (index % 3)}" transform="rotate(${index * 31} ${x} ${y})" fill="${index % 4 ? '#d88b30' : '#945020'}" opacity="${index % 4 ? '0.36' : '0.52'}" />`,
    );
    if (index % 3 === 0) {
      marks.push(
        `<ellipse cx="${x - 3}" cy="${y - 3}" rx="5" ry="2" fill="#fff4c8" opacity="0.65" />`,
      );
    }
  }
  const crust = [];
  for (let index = 0; index < 65; index++) {
    const angle = index * 2.39996 + seed;
    const radius = 133 + (index % 4) * 2;
    const x = number(CENTER_X + Math.cos(angle) * radius);
    const y = number(CENTER_Y + Math.sin(angle) * radius);
    crust.push(
      `<ellipse cx="${x}" cy="${y}" rx="${2 + (index % 3)}" ry="1.5" fill="#75401d" opacity="0.42" transform="rotate(${index * 37} ${x} ${y})" />`,
    );
  }
  const cuts = [];
  for (let index = 0; index < slices; index++) {
    const angle = (index / slices) * Math.PI * 2 + 0.15;
    cuts.push(
      `<path d="M${CENTER_X} ${CENTER_Y}L${number(CENTER_X + Math.cos(angle) * 125)} ${number(CENTER_Y + Math.sin(angle) * 125)}" />`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360" role="img" aria-labelledby="title description">
  <title id="title">${name} ${diameter}-inch cheese pizza</title>
  <desc id="description">Centered overhead illustration of a whole golden cheese pizza with a toasted crust, cut into ${slices} slices. Product images are individually framed, not drawn to a shared scale.</desc>
  <defs>
    <radialGradient id="background"><stop stop-color="#fffdf8"/><stop offset="1" stop-color="#eee4d5"/></radialGradient>
    <radialGradient id="crust" cx="35%" cy="25%"><stop stop-color="#f8d391"/><stop offset="0.75" stop-color="#d99a4b"/><stop offset="0.94" stop-color="#b76d2e"/><stop offset="1" stop-color="#8b4a22"/></radialGradient>
    <radialGradient id="cheese" cx="38%" cy="30%"><stop stop-color="#ffe9a3"/><stop offset="0.75" stop-color="#f5cb66"/><stop offset="1" stop-color="#e6a342"/></radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#5c3824" flood-opacity="0.24"/></filter>
  </defs>
  <rect width="480" height="360" fill="url(#background)"/>
  <circle cx="240" cy="182" r="157" fill="#fffdfa" stroke="#e1d5c3" stroke-width="2"/>
  <g filter="url(#shadow)">
    <circle cx="240" cy="180" r="${RADIUS}" fill="url(#crust)"/>
    <circle cx="240" cy="180" r="130" fill="#ae3f25"/>
    <path d="M240 54C307 53 365 111 366 180S310 305 240 306 114 249 114 180 173 54 240 54Z" fill="url(#cheese)"/>
    ${marks.join('\n    ')}
    ${crust.join('\n    ')}
    <g fill="none" stroke="#a9652d" stroke-width="1.8" opacity="0.5">${cuts.join('')}</g>
    <path d="M151 91A126 126 0 0 1 278 60" fill="none" stroke="#fff0c3" stroke-width="3" opacity="0.5" stroke-linecap="round"/>
  </g>
</svg>
`;
}

for (const pizzaSize of pizzaSizes) {
  const filename = `../Frontend/assets/pizza-${pizzaSize.name.toLowerCase()}.svg`;
  writeFileSync(new URL(filename, import.meta.url), pizzaGraphic(pizzaSize));
  console.log(
    `${pizzaSize.name}: ${pizzaSize.diameter}-inch pizza, centered 480 × 360 frame`,
  );
}
