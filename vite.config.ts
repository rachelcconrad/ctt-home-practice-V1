import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Only needed for the GitHub Pages build, which is served from a subpath
  // (username.github.io/repo-name/) rather than the domain root.
  base: command === 'build' ? '/ctt-home-practice-V1/' : '/',
  plugins: [react()],
}))
