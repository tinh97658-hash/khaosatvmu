import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Chỉ cho phép hostname của Microsoft Dev Tunnels khi chia sẻ bản demo từ Ports view.
    allowedHosts: ['.devtunnels.ms'],
    proxy: {
      '/api': {
        target: 'http://localhost:5115',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/node_modules/')) {
            if (normalized.includes('zrender')) return 'vendor-zrender';
            if (normalized.includes('echarts/lib/chart') || normalized.includes('echarts/charts') || normalized.includes('echarts/esm/chart')) return 'vendor-echarts-charts';
            if (normalized.includes('echarts/lib/component') || normalized.includes('echarts/components') || normalized.includes('echarts/esm/component')) return 'vendor-echarts-components';
            if (normalized.includes('echarts')) return 'vendor-echarts-core';
            if (normalized.includes('/recharts/')) return 'vendor-recharts';
            if (normalized.includes('/jspdf/') || normalized.includes('/jspdf-autotable/')) return 'vendor-jspdf';
            if (normalized.includes('/docx/')) return 'vendor-docx';
            if (normalized.includes('/read-excel-file/') || normalized.includes('/write-excel-file/')) return 'vendor-excel';
            if (normalized.includes('/lucide-react/')) return 'vendor-icons';
            if (normalized.includes('/react/') || normalized.includes('/react-dom/')) return 'vendor-react';
          }
        },
      },
    },
  },
})
