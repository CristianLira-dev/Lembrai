import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@supabase') || id.includes('node_modules/@supabase')) return 'supabase';
          if (id.includes('react-router') || id.includes('node_modules/react')) return 'react';
          return undefined;
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['localhost', '.localhost', '.manus.computer']
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['localhost', '.localhost', '.manus.computer']
  }
});
