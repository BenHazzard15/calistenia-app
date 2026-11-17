// Datos de la rutina: ejercicios, días y calentamiento.
// Fotos: free-exercise-db (dominio público, Unlicense).

const EXERCISES = {
  pullups: {
    name: "Dominadas pronas", muscles: "Dorsal ancho, bíceps, espalda media",
    img: "pullups", type: "reps", range: [6, 10], load: true,
    p1: "Colgado completo, brazos estirados", p2: "Pecho hacia la barra, codos abajo",
    tips: "Parte desde colgado completo. Lleva los codos hacia los bolsillos traseros y el pecho a la barra. Sin balanceo.",
    easier: "Banda en la barra bajo las rodillas o pies, o solo bajadas lentas de 5 s.",
    harder: "Mochila con peso, pausa de 2 s arriba o bajada de 4 s."
  },
  pullups_heavy: {
    name: "Dominadas pronas con mochila", muscles: "Dorsal ancho, bíceps, espalda media",
    img: "pullups", type: "reps", range: [5, 8], load: true,
    p1: "Colgado completo con la mochila", p2: "Pecho a la barra, sin balanceo",
    tips: "Día pesado. Si aún no haces 10 dominadas limpias sin peso, hazlas sin mochila.",
    safety: "No llegues al fallo total con peso: deja 1 repetición en reserva.",
    easier: "Sin mochila o con menos peso.", harder: "Sube 2–3 kg en la mochila."
  },
  chinup: {
    name: "Chin-ups (dominadas supinas)", muscles: "Bíceps, dorsal ancho",
    img: "chinup", type: "reps", range: [6, 10], load: true,
    p1: "Palmas hacia ti, colgado completo", p2: "Barbilla sobre la barra",
    tips: "Bajada controlada en 3 segundos. Rango completo: estira los brazos abajo.",
    easier: "Banda elástica en la barra.", harder: "Mochila con peso o pausa arriba."
  },
  dips: {
    name: "Fondos en paralelas", muscles: "Pecho inferior, tríceps, hombro anterior",
    img: "dips", type: "reps", range: [8, 12], load: true,
    p1: "Brazos bloqueados arriba", p2: "Baja hasta que el hombro quede bajo el codo",
    tips: "Hombros lejos de las orejas. Baja controlado en 2 s.",
    safety: "No los lleves al fallo total: la técnica rota aquí carga el hombro.",
    easier: "Banda entre las paralelas bajo las rodillas o rango más corto.", harder: "Mochila con peso o pausa abajo."
  },
  dips_chest: {
    name: "Fondos con torso inclinado", muscles: "Pecho, tríceps",
    img: "dips_chest", type: "reps", range: [8, 12], load: true,
    p1: "Arriba, torso inclinado adelante", p2: "Abajo, codos un poco abiertos",
    tips: "Inclina el torso ~30° adelante para cargar más el pecho.",
    safety: "No los lleves al fallo total.",
    easier: "Banda de asistencia.", harder: "Mochila con peso."
  },
  bulgarian: {
    name: "Sentadilla búlgara con mochila", muscles: "Cuádriceps, glúteos",
    img: "bulgarian", type: "reps", range: [8, 12], perLeg: true, load: true,
    p1: "Pie trasero en silla o banco", p2: "Baja hasta casi tocar el suelo con la rodilla",
    tips: "Torso firme, rodilla de adelante sigue la línea del pie. Empuja con el talón de adelante.",
    easier: "Sin peso, apoyándote con una mano.", harder: "Más peso, bajada de 3 s o 1,5 reps."
  },
  decline_pushup: {
    name: "Flexiones con pies en silla", muscles: "Hombro anterior, pecho superior, tríceps",
    img: "decline_pushup", type: "reps", range: [8, 15], load: true,
    p1: "Pies en una silla, cuerpo recto", p2: "Pecho cerca del suelo",
    tips: "Cuerpo en tabla, no dejes caer la cadera. Mientras más alta la silla, más trabajan los hombros.",
    easier: "Pies en el suelo.", harder: "Silla más alta o mochila."
  },
  nordic: {
    name: "Curl nórdico asistido", muscles: "Isquiotibiales",
    img: "nordic", type: "reps", range: [3, 6], load: false,
    p1: "De rodillas, talones trabados bajo un mueble", p2: "Baja lento, frena con las manos al final",
    tips: "Baja en 3–5 s con la cadera estirada. Empújate con las manos para volver arriba.",
    safety: "Nunca al fallo: es muy exigente para el isquio.",
    easier: "Banda en la barra enganchada al pecho para frenar, o rango corto.", harder: "Menos ayuda de las manos, bajada más lenta."
  },
  hanging_raise: {
    name: "Elevaciones de piernas colgado", muscles: "Abdomen, flexores de cadera",
    img: "hanging_raise", type: "reps", range: [8, 12], load: false,
    p1: "Colgado, sin balanceo", p2: "Rodillas o piernas arriba, pelvis hacia atrás",
    tips: "Sin impulso. Pausa 1 s arriba y baja lento.",
    easier: "Rodillas al pecho.", harder: "Piernas rectas o piernas a la barra."
  },
  inverted_row: {
    name: "Remo australiano prono", muscles: "Espalda media, romboides, deltoide posterior",
    img: "inverted_row", type: "reps", range: [8, 12], load: true,
    p1: "Cuerpo recto bajo la barra baja o las paralelas", p2: "Pecho a la barra, escápulas juntas",
    tips: "Pausa de 1 s con el pecho en la barra. Cuerpo como tabla.",
    easier: "Cuerpo más vertical.", harder: "Cuerpo más horizontal, pies en silla o mochila en el pecho."
  },
  inverted_row_sup: {
    name: "Remo australiano supino", muscles: "Bíceps, espalda media",
    img: "inverted_row", type: "reps", range: [3, 7], load: false,
    p1: "Agarre con palmas hacia ti", p2: "Pecho a la barra",
    tips: "Elige una inclinación con la que harías ~12–15 reps seguidas.",
    easier: "Más vertical.", harder: "Más horizontal."
  },
  pushup: {
    name: "Flexiones con mochila o en déficit", muscles: "Pecho, tríceps, hombro",
    img: "pushup", type: "reps", range: [8, 15], load: true,
    p1: "Brazos estirados, cuerpo recto", p2: "Pecho abajo, codos a ~45°",
    tips: "Manos sobre dos libros o en las paralelas bajas para bajar más el pecho.",
    easier: "Manos en altura (paralelas o silla).", harder: "Mochila, más déficit o pies en altura."
  },
  stepup: {
    name: "Step-up alto con mochila", muscles: "Cuádriceps, glúteos",
    img: "stepup", type: "reps", range: [8, 12], perLeg: true, load: true,
    p1: "Pie completo en cajón o silla de 40–50 cm", p2: "Arriba, cadera estirada",
    tips: "Empuja solo con la pierna de arriba; no rebotes con la de atrás. Baja en 3 s.",
    easier: "Cajón más bajo.", harder: "Más peso en la mochila o cajón más alto."
  },
  sl_rdl: {
    name: "Peso muerto rumano a una pierna", muscles: "Isquiotibiales, glúteos",
    img: "sl_rdl", type: "reps", range: [8, 12], perLeg: true, load: true,
    p1: "De pie en una pierna, mochila en la mano", p2: "Cadera atrás, espalda neutra",
    tips: "Siente el estiramiento atrás del muslo. Cadera cuadrada, sin girarla.",
    easier: "Mano libre apoyada en la pared.", harder: "Más peso o pausa de 2 s abajo."
  },
  deadbug: {
    name: "Dead bug", muscles: "Core profundo, abdomen",
    img: "deadbug", type: "reps", range: [8, 12], perLeg: true, load: false,
    p1: "Boca arriba, brazos y rodillas arriba", p2: "Estira brazo y pierna contrarios",
    tips: "Zona lumbar pegada al suelo todo el tiempo. Exhala al estirar. Reps por lado.",
    easier: "Mueve solo las piernas.", harder: "Banda entre las manos o pausa de 3 s estirado."
  },
  diamond: {
    name: "Flexiones diamante", muscles: "Tríceps, pecho",
    img: "diamond", type: "reps", range: [3, 7], load: false,
    p1: "Manos juntas bajo el pecho", p2: "Codos pegados al cuerpo",
    tips: "Si 25 reps en total es mucho, hazlas con las manos en altura.",
    easier: "Manos en altura.", harder: "Pies en altura."
  },
  box_pistol: {
    name: "Sentadilla a una pierna a banco", muscles: "Cuádriceps, glúteos",
    img: "box_pistol", type: "reps", range: [6, 10], perLeg: true, load: true,
    p1: "De pie frente a un banco o silla, en una pierna", p2: "Siéntate controlado y sube con una pierna",
    tips: "Bajada de 2–3 s. No te dejes caer en el banco: tócalo apenas.",
    easier: "Banco más alto o agarrado a la paralela.", harder: "Banco más bajo, mochila al frente o pistol completo."
  },
  facepull: {
    name: "Face pull con banda", muscles: "Deltoide posterior, manguito rotador",
    img: "facepull", type: "reps", range: [12, 15], load: false,
    p1: "Banda anclada a la barra o paralela, brazos estirados", p2: "Tira hacia la frente, codos altos",
    tips: "Al final rota los brazos hacia afuera, como mostrando los bíceps.",
    easier: "Banda más suave.", harder: "Banda más dura o pausa de 2 s."
  },
  hip_thrust: {
    name: "Hip thrust a una pierna con mochila", muscles: "Glúteos, isquiotibiales",
    img: "hip_thrust", type: "reps", range: [10, 15], perLeg: true, load: true,
    p1: "Espalda alta en el sofá o banco", p2: "Cadera arriba, pausa de 2 s",
    tips: "La foto muestra la versión con barra: tú hazla a una pierna con la mochila sobre la cadera.",
    easier: "Con las dos piernas.", harder: "Más peso o pausa de 3 s."
  },
  tuck_lsit: {
    name: "Tuck L-sit en paralelas", muscles: "Core, flexores de cadera, tríceps",
    img: "tuck_lsit", type: "time", range: [15, 25], load: false,
    p1: "Brazos rectos en las paralelas", p2: "Rodillas arriba y sostén",
    tips: "Empuja las paralelas hacia abajo, lejos de las orejas. Pasa a L-sit completo al sostener 25 s.",
    easier: "Una pierna estirada a la vez.", harder: "L-sit completo."
  },
  band_curl: {
    name: "Curl de bíceps con banda", muscles: "Bíceps",
    img: "band_curl", type: "reps", range: [3, 7], load: false,
    p1: "Pisa la banda, brazos estirados", p2: "Sube sin mover los codos",
    tips: "Elige una banda con la que harías ~12–15 reps seguidas.",
    easier: "Banda más suave.", harder: "Banda más dura o pisarla más corta."
  }
};

// type: "ss" superserie, "37" bloque final 3/7
const DAYS = {
  A: {
    title: "Día A", focus: "Tirón vertical, fondos, búlgara y nórdico",
    blocks: [
      { type: "ss", label: "Superserie 1", rounds: 4, rest: 70, items: ["pullups", "dips"] },
      { type: "ss", label: "Superserie 2", rounds: 3, rest: 60, items: ["bulgarian", "decline_pushup"] },
      { type: "ss", label: "Superserie 3", rounds: 3, rest: 45, items: ["nordic", "hanging_raise"] },
      { type: "37", label: "Final 3/7", item: "inverted_row_sup" }
    ]
  },
  B: {
    title: "Día B", focus: "Chin-ups, flexiones, step-up alto y peso muerto a una pierna",
    blocks: [
      { type: "ss", label: "Superserie 1", rounds: 4, rest: 70, items: ["chinup", "pushup"] },
      { type: "ss", label: "Superserie 2", rounds: 3, rest: 60, items: ["stepup", "inverted_row"] },
      { type: "ss", label: "Superserie 3", rounds: 3, rest: 45, items: ["sl_rdl", "deadbug"] },
      { type: "37", label: "Final 3/7", item: "diamond" }
    ]
  },
  C: {
    title: "Día C", focus: "Dominadas pesadas, fondos inclinados, sentadilla a una pierna y hip thrust",
    blocks: [
      { type: "ss", label: "Superserie 1", rounds: 4, rest: 70, items: ["pullups_heavy", "dips_chest"] },
      { type: "ss", label: "Superserie 2", rounds: 3, rest: 60, items: ["box_pistol", "facepull"] },
      { type: "ss", label: "Superserie 3", rounds: 3, rest: 45, items: ["hip_thrust", "tuck_lsit"] },
      { type: "37", label: "Final 3/7", item: "band_curl" }
    ]
  }
};

const ROTATION = ["A", "B", "C"];

const WARMUP = [
  { name: "Jumping jacks o trote en el lugar", dur: 60, img: null },
  { name: "Sentadillas al aire lentas", dur: 60, img: "air_squat" },
  { name: "Círculos de brazos (10 adelante, 10 atrás)", dur: 30, img: "arm_circles" },
  { name: "Dislocaciones de hombro con banda × 10", dur: 30, img: null },
  { name: "Band pull-aparts × 10", dur: 30, img: "pull_apart" },
  { name: "Colgado relajado 30 s + 8 retracciones escapulares", dur: 30, img: "scap_pull" },
  { name: "Muñecas: círculos y apoyos suaves en cuatro patas", dur: 30, img: null },
  { name: "Balanceos de pierna adelante-atrás y laterales × 10 por lado", dur: 60, img: null },
  { name: "World's greatest stretch × 5 por lado", dur: 30, img: "hip_flexor" },
  { name: "Puentes de glúteo con pausa × 10", dur: 30, img: "glute_bridge" },
  { name: "Gato-camello × 8", dur: 30, img: "cat" }
];

const COOLDOWN = [
  { name: "Flexor de cadera en zancada, 30 s por lado", img: "hip_flexor" },
  { name: "Pecho en marco de puerta, 30 s", img: null },
  { name: "Dorsal colgado de la barra, 30 s", img: "scap_pull" }
];
