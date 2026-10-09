export interface Member {
  id: string;
  name: string;
  img: string;
  /** vertical crop focus, 0 = top of the photo, 1 = bottom */
  fy: number;
}

export const members: Member[] = [
  { id: 'jin', name: 'Jin', img: '/img/jin.png', fy: 0.05 },
  { id: 'jungkook', name: 'Jung Kook', img: '/img/jungkook.png', fy: 0.05 },
  { id: 'rm', name: 'RM', img: '/img/rm.jpg', fy: 0.08 },
  { id: 'suga', name: 'SUGA', img: '/img/suga.jpg', fy: 0.08 },
  { id: 'jhope', name: 'J-Hope', img: '/img/jhope.png', fy: 0.05 },
  { id: 'jimin', name: 'Jimin', img: '/img/jimin.jpg', fy: 0.1 },
  { id: 'v', name: 'V', img: '/img/v.jpg', fy: 0.05 },
];

export const groupImg = '/img/group.jpg';

export interface LevelMsg {
  title: string;
  /** Quote from the member shown above the polaroid. */
  quote: string;
  who: string;
  /** Personal message shown below the polaroid. */
  message: string;
  /** Short handwritten caption on the polaroid. */
  caption: string;
  img: string;
  /** Wide (landscape) polaroid, used for the group photo. */
  wide?: boolean;
  credit?: string;
}

/**
 * Polaroid shown when reaching each level (key = new level).
 * To swap a photo, replace the file at `img` (or change the path).
 */
export const levelMsgs: Record<number, LevelMsg> = {
  2: {
    title: '¡Nivel 2!', who: 'Jin', caption: 'Para Nixie', img: '/img/jin-2.jpg',
    quote: '“Gane o pierda, no me importa, porque al final del día sigo teniendo esta cara.”',
    message: 'Es un asalto lo que cobran ahí adentro por cualquier cosa. Haces bien en no comprar nada, mejor usa mi hermoso rostro como motivación para aguantar ese sol, Nixie.',
  },
  3: {
    title: '¡Nivel 3!', who: 'Jungkook', caption: 'Para Nixie', img: '/img/jk-2.png',
    quote: '“Mi nombre es Jungkook. Escala: playboy internacional.”',
    message: 'Ya estás en tu lugar y falta muy poco para que empiece la magia; ve calentando esa voz para gritar y cantar con nosotros, Nixie.',
  },
  4: {
    title: '¡Nivel 4!', who: 'Jin', caption: 'Para Nixie', img: '/img/jin-4.png',
    quote: '“Si la comida es deliciosa, entonces tiene cero calorías. Es ciencia.”',
    message: 'Te apoyo totalmente en no dejarte estafar con esos precios de locura en el estadio. ¡Guarda tu dinero para algo mejor y resiste como toda una guerrera, Nixie!',
  },
  5: {
    title: '¡Nivel 5!', who: 'Jungkook', caption: 'Para Nixie', img: '/img/jk-3.png',
    quote: 'Entrevistador: ¿Cuál es tu actriz de Hollywood favorita?\nJungkook: Conozco su cara... pero no sé su nombre.',
    message: 'Entre el cansancio de la fila y este calor seguro ya ni sabes en qué día vives, pero te prometo que la espera valdrá cada segundo, Nixie.',
  },
  6: {
    title: '¡Nivel 6!', who: 'Jin', caption: 'Para Nixie', img: '/img/jin-3.jpg',
    quote: '“¿Por qué siempre me pegas? ¡Tengo cinco años más que tú y me usas de saco de boxeo!”',
    message: 'Sabemos que el sol te está usando de saco de boxeo ahora mismo, pero demuéstrale que puedes aguantar eso y mucho más sin rendirte, Nixie.',
  },
  7: {
    title: '¡Nivel 7!', who: 'Jungkook', caption: 'Para Nixie', img: '/img/jungkook.png',
    quote: '“¡Oh man, holy sh*t!”',
    message: 'Cuando por fin baje el sol, se apaguen las luces del estadio y escuches la primera nota del concierto, esa será tu reacción exacta, Nixie.',
  },
  8: {
    title: '¡GANASTE!', who: 'Jin', caption: 'Borahae, Nixie', img: '/img/group.jpg', wide: true,
    quote: '“El secreto de nuestro trabajo en equipo es que, si uno de nosotros se porta mal, los otros seis le damos una paliza.”',
    message: 'Venciste a la fila interminable, al calor extremo y a la estafa de los precios. ¡Te has ganado tu lugar con nosotros, prepárate para la mejor noche de tu vida, Nixie!',
  },
};

export const levelThresholds = [260, 620, 1100, 1700, 2450, 3400, 4600];
export const MAX_LEVEL = levelThresholds.length + 1;
