import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 前端工程根目录是 frontend/（vite 命令以 `vite frontend` 启动，root 即此目录）
// 构建产物统一输出到仓库根目录 dist/，由 backend 直接托管。
export default defineConfig({
  // base 用相对路径：构建产物既可以直接挂静态服务器，也能放进任意子目录演示
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    // 每次构建清空 dist/，避免历史 hash 产物堆积
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
