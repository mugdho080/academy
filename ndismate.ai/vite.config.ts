import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/matey/', // This matches your public_html/matey path
  define: {
    'process.env.API_KEY': JSON.stringify('AIzaSyBh-jDANoAg3ta-ulDQLkmahoh29ua7g4s')
  }
});