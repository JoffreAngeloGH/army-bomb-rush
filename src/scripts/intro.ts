import { replayIcons } from '../data/icons';

const screen = document.getElementById('intro-screen')!;
const textEl = document.getElementById('intro-text')!;
const btn = document.getElementById('intro-btn') as HTMLButtonElement;
const burst = document.getElementById('intro-burst')!;
const start = document.getElementById('start-screen')!;

const HOT = new Set(['erudita', 'teoría,', 'reflejos.']);

// reveal the sentence word by word
const words = (textEl.dataset.text ?? '').split(' ');
words.forEach((word, i) => {
  const span = document.createElement('span');
  span.className = HOT.has(word) ? 'w hot' : 'w';
  span.textContent = word;
  span.style.animationDelay = `${0.35 + i * 0.16}s`;
  textEl.appendChild(span);
});
setTimeout(() => screen.classList.add('ready'), 350 + words.length * 160 + 300);

// click: sparkle burst + zoom out, then reveal the start screen
const colors = ['#c084fc', '#e879f9', '#f5d0fe', '#fde68a', '#7dd3fc', '#ffffff'];
btn.addEventListener('click', () => {
  btn.disabled = true;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + Math.random() * 0.3;
    const d = 120 + Math.random() * 220;
    const dot = document.createElement('i');
    dot.style.setProperty('--x', `${Math.cos(a) * d}px`);
    dot.style.setProperty('--y', `${Math.sin(a) * d}px`);
    dot.style.setProperty('--s', `${4 + Math.random() * 8}px`);
    dot.style.setProperty('--c', colors[i % colors.length]);
    burst.appendChild(dot);
  }
  screen.classList.add('leaving');
  start.classList.remove('hide');
  replayIcons(start);
  setTimeout(() => screen.classList.add('hide'), 700);
});
