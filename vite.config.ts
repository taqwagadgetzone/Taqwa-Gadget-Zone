import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('firebase/firestore')) return 'firebase-firestore';
          if (id.includes('firebase/auth') || id.includes('firebase/app')) return 'firebase-core';
          if (id.includes('react-dom') || id.includes('react-router-dom')) return 'react-vendor';
          if (id.includes('node_modules/react/')) return 'react-core';
        },
      },
    },
    // Chunk size warning threshold বাড়াই
    chunkSizeWarningLimit: 600,
  },
})
