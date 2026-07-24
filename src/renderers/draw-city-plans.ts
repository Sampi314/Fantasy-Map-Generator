import { rn } from "../utils";

declare global {
  var cityPlans: any;
  var drawCityPlans: () => void;
  var aleaPRNG: (seed: string) => () => number;
  var populationRate: number;
  var urbanization: number;
  var distanceScale: number;
  var seed: string;
}

// Draw procedural city plans directly on the map at true geographic scale:
// population -> built-up area (km2) -> radius in map pixels via distanceScale.
// Plans are sub-pixel at continental zoom and reveal detail when zoomed in.
const DENSITY = 10000; // inhabitants per km2 of built-up area (preindustrial)
const MIN_POPULATION = 5000; // minimal real population to get a plan

const cityPlansRenderer = (): void => {
  TIME && console.time("drawCityPlans");
  const { burgs, cells } = pack;

  const popRate = Number(populationRate) || 1;
  const urbanRate = Number(urbanization) || 1;
  const kmPerPx = Number(distanceScale) || 3;
  // 1 = true geographic scale (sub-pixel at continental map scales); the default
  // exaggerates footprints like classic map symbols do, staying proportional
  const sizeMultiplier = Number(cityPlans.attr("data-size")) || 8;
  const mapSeed = String(seed || "");

  const html: string[] = [];

  for (const burg of burgs as any[]) {
    if (!burg.i || burg.removed) continue;
    const population = (burg.population || 0) * popRate * urbanRate;
    if (population < MIN_POPULATION && !burg.capital) continue;

    const areaKm2 = Math.max(population, 1000) / DENSITY;
    const rKm = Math.sqrt(areaKm2 / Math.PI);
    const r = Math.max((rKm / kmPerPx) * sizeMultiplier, 0.2);
    const sw = r / 30; // hairline weight scaled to the city size

    const random = aleaPRNG(`${mapSeed}-city-${burg.i}`);
    const rand = (min: number, max: number) => min + random() * (max - min);
    const p = (v: number) => rn(v, 2);

    const { x, y } = burg;
    let parts = "";

    // town wall
    if (burg.walls) {
      const vertices = 12 + Math.floor(random() * 5);
      const points: string[] = [];
      for (let v = 0; v < vertices; v++) {
        const a = (v / vertices) * Math.PI * 2;
        const wr = r * rand(0.92, 1.06);
        points.push(`${p(x + Math.cos(a) * wr)},${p(y + Math.sin(a) * wr)}`);
      }
      parts += `<polygon points="${points.join(" ")}" fill="none" stroke="#5a5145" stroke-width="${p(sw * 2)}"/>`;
    }

    // streets: radial spokes and a ring road
    const spokes = 4 + Math.floor(random() * 4);
    const offset = random() * Math.PI * 2;
    let streets = "";
    for (let s = 0; s < spokes; s++) {
      const a = offset + (s / spokes) * Math.PI * 2 + rand(-0.15, 0.15);
      streets += `M${p(x)},${p(y)} L${p(x + Math.cos(a) * r)},${p(y + Math.sin(a) * r)}`;
    }
    parts += `<path d="${streets}" fill="none" stroke="#8a8072" stroke-width="${p(sw)}"/>`;
    parts += `<circle cx="${p(x)}" cy="${p(y)}" r="${p(r * 0.55)}" fill="none" stroke="#8a8072" stroke-width="${p(sw)}"/>`;

    // building blocks, thinning towards the edge; plaza keeps the center clear
    const blocks = Math.min(20 + Math.floor(population / 1200), 90);
    let blockShapes = "";
    for (let b = 0; b < blocks; b++) {
      const a = random() * Math.PI * 2;
      const dist = Math.sqrt(random()) * r * 0.88;
      if (burg.plaza && dist < r * 0.16) continue;
      const bs = r * rand(0.05, 0.09);
      const bx = x + Math.cos(a) * dist;
      const by = y + Math.sin(a) * dist;
      const rot = rn((a * 180) / Math.PI + rand(-20, 20));
      blockShapes += `<rect x="${p(bx - bs / 2)}" y="${p(by - bs / 2)}" width="${p(bs)}" height="${p(bs * rand(0.6, 1))}" transform="rotate(${rot} ${p(bx)} ${p(by)})"/>`;
    }
    parts += `<g fill="#a99e8a" stroke="#6d6355" stroke-width="${p(sw / 2)}">${blockShapes}</g>`;

    // shanty sprawl outside the walls
    if (burg.shanty) {
      let shanty = "";
      const n = 8 + Math.floor(random() * 10);
      for (let s = 0; s < n; s++) {
        const a = random() * Math.PI * 2;
        const dist = r * rand(1.08, 1.4);
        const bs = r * rand(0.03, 0.06);
        shanty += `<rect x="${p(x + Math.cos(a) * dist - bs / 2)}" y="${p(y + Math.sin(a) * dist - bs / 2)}" width="${p(bs)}" height="${p(bs)}"/>`;
      }
      parts += `<g fill="#b3a992" opacity="0.8">${shanty}</g>`;
    }

    // citadel keep
    if (burg.citadel) {
      const a = random() * Math.PI * 2;
      const cx = x + Math.cos(a) * r * 0.45;
      const cy = y + Math.sin(a) * r * 0.45;
      parts += `<circle cx="${p(cx)}" cy="${p(cy)}" r="${p(r * 0.13)}" fill="#7d7263" stroke="#4a4238" stroke-width="${p(sw * 1.5)}"/>`;
    }

    // temple
    if (burg.temple) {
      const a = random() * Math.PI * 2;
      const tx = x + Math.cos(a) * r * 0.3;
      const ty = y + Math.sin(a) * r * 0.3;
      parts += `<circle cx="${p(tx)}" cy="${p(ty)}" r="${p(r * 0.07)}" fill="#8a5a48"/>`;
    }

    // docks reaching towards the harbor water
    if (burg.port && burg.cell !== undefined) {
      const haven = cells.haven[burg.cell];
      if (haven) {
        const [hx, hy] = cells.p[haven];
        const a = Math.atan2(hy - y, hx - x);
        let docks = "";
        for (let d = -1; d <= 1; d++) {
          const da = a + d * 0.18;
          docks += `M${p(x + Math.cos(da) * r * 0.95)},${p(y + Math.sin(da) * r * 0.95)} L${p(x + Math.cos(da) * r * 1.25)},${p(y + Math.sin(da) * r * 1.25)}`;
        }
        parts += `<path d="${docks}" fill="none" stroke="#4a3f33" stroke-width="${p(sw * 1.5)}"/>`;
      }
    }

    html.push(
      `<g data-id="${burg.i}" data-population="${rn(population)}">${parts}</g>`,
    );
  }

  cityPlans.html(html.join(""));
  TIME && console.timeEnd("drawCityPlans");
};

window.drawCityPlans = cityPlansRenderer;
