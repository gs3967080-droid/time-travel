import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind 的 content 以进程 cwd 解析，这里用绝对路径固定，避免从不同目录启动时漏扫 UI 组件
  content: [
    path.join(here, 'index.html'),
    path.join(here, 'src/**/*.{js,jsx}'),
    path.join(here, '../ui/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        void: '#050505',
        neon: '#00FFFF',
        violet: '#8A2BE2',
        gold: '#D4AF37',
        cinnabar: '#FF3B3B',
      },
      fontFamily: {
        system: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
        ancient: ['"Noto Serif SC"', '"Songti SC"', '"STSong"', '"SimSun"', 'serif'],
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '42%': { opacity: '1' },
          '44%': { opacity: '0.35' },
          '46%': { opacity: '1' },
          '78%': { opacity: '1' },
          '80%': { opacity: '0.6' },
          '82%': { opacity: '1' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0, 0)', filter: 'none' },
          '20%': { transform: 'translate(-3px, 1px)', filter: 'hue-rotate(90deg)' },
          '40%': { transform: 'translate(3px, -2px)', filter: 'hue-rotate(-70deg)' },
          '60%': { transform: 'translate(-2px, 0)', filter: 'contrast(1.6)' },
          '80%': { transform: 'translate(2px, 2px)', filter: 'none' },
        },
        flashRed: {
          '0%': { opacity: '0' },
          '12%': { opacity: '0.72' },
          '35%': { opacity: '0.12' },
          '55%': { opacity: '0.55' },
          '100%': { opacity: '0' },
        },
        flashGreen: {
          '0%': { opacity: '0' },
          '12%': { opacity: '0.6' },
          '35%': { opacity: '0.1' },
          '55%': { opacity: '0.45' },
          '100%': { opacity: '0' },
        },
        sweep: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(320%)' },
        },
      },
      animation: {
        scanline: 'scanline 7s linear infinite',
        float: 'float 6s ease-in-out infinite',
        flicker: 'flicker 5s linear infinite',
        glitch: 'glitch 0.45s steps(2, end) 1',
        'flash-red': 'flashRed 0.85s ease-out 1',
        'flash-green': 'flashGreen 0.85s ease-out 1',
        sweep: 'sweep 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
