// vite.config.js
import { defineConfig } from "file:///E:/FLASK_Clg/Resume-Screening-System/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///E:/FLASK_Clg/Resume-Screening-System/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/scheduler/")) {
              return "vendor-react-core";
            }
            if (id.includes("react-router") || id.includes("react-router-dom")) {
              return "vendor-router";
            }
            if (id.includes("@react-oauth")) {
              return "vendor-oauth";
            }
            if (id.includes("framer-motion")) {
              return "vendor-framer";
            }
            if (id.includes("recharts")) {
              return "vendor-charts";
            }
            if (id.includes("lucide-react") || id.includes("react-icons")) {
              return "vendor-icons";
            }
            if (id.includes("pdfjs-dist") || id.includes("jspdf") || id.includes("html2canvas") || id.includes("mammoth")) {
              return "vendor-pdf";
            }
            if (id.includes("axios") || id.includes("date-fns") || id.includes("react-hot-toast") || id.includes("clsx")) {
              return "vendor-utils";
            }
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none"
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxGTEFTS19DbGdcXFxcUmVzdW1lLVNjcmVlbmluZy1TeXN0ZW1cXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXEZMQVNLX0NsZ1xcXFxSZXN1bWUtU2NyZWVuaW5nLVN5c3RlbVxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRTovRkxBU0tfQ2xnL1Jlc3VtZS1TY3JlZW5pbmctU3lzdGVtL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzMjAyMCcsXHJcbiAgICBjc3NDb2RlU3BsaXQ6IHRydWUsXHJcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEyMDAsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9yZWFjdC8nKSB8fCBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0LWRvbS8nKSB8fCBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3NjaGVkdWxlci8nKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXJlYWN0LWNvcmUnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVhY3Qtcm91dGVyJykgfHwgaWQuaW5jbHVkZXMoJ3JlYWN0LXJvdXRlci1kb20nKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXJvdXRlcic7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAcmVhY3Qtb2F1dGgnKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLW9hdXRoJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2ZyYW1lci1tb3Rpb24nKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLWZyYW1lcic7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdyZWNoYXJ0cycpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItY2hhcnRzJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2x1Y2lkZS1yZWFjdCcpIHx8IGlkLmluY2x1ZGVzKCdyZWFjdC1pY29ucycpKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItaWNvbnMnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncGRmanMtZGlzdCcpIHx8IGlkLmluY2x1ZGVzKCdqc3BkZicpIHx8IGlkLmluY2x1ZGVzKCdodG1sMmNhbnZhcycpIHx8IGlkLmluY2x1ZGVzKCdtYW1tb3RoJykpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gJ3ZlbmRvci1wZGYnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnYXhpb3MnKSB8fCBpZC5pbmNsdWRlcygnZGF0ZS1mbnMnKSB8fCBpZC5pbmNsdWRlcygncmVhY3QtaG90LXRvYXN0JykgfHwgaWQuaW5jbHVkZXMoJ2Nsc3gnKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLXV0aWxzJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiA1MTczLFxyXG4gICAgaGVhZGVyczoge1xyXG4gICAgICBcIkNyb3NzLU9yaWdpbi1PcGVuZXItUG9saWN5XCI6IFwidW5zYWZlLW5vbmVcIixcclxuICAgICAgXCJDcm9zcy1PcmlnaW4tRW1iZWRkZXItUG9saWN5XCI6IFwidW5zYWZlLW5vbmVcIiwgXHJcbiAgICB9LFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWVcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpVSxTQUFTLG9CQUFvQjtBQUM5VixPQUFPLFdBQVc7QUFFbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGNBQWM7QUFBQSxJQUNkLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGFBQWEsSUFBSTtBQUNmLGNBQUksR0FBRyxTQUFTLGNBQWMsR0FBRztBQUMvQixnQkFBSSxHQUFHLFNBQVMscUJBQXFCLEtBQUssR0FBRyxTQUFTLHlCQUF5QixLQUFLLEdBQUcsU0FBUyx5QkFBeUIsR0FBRztBQUMxSCxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsY0FBYyxLQUFLLEdBQUcsU0FBUyxrQkFBa0IsR0FBRztBQUNsRSxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUyxlQUFlLEdBQUc7QUFDaEMscUJBQU87QUFBQSxZQUNUO0FBQ0EsZ0JBQUksR0FBRyxTQUFTLFVBQVUsR0FBRztBQUMzQixxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsY0FBYyxLQUFLLEdBQUcsU0FBUyxhQUFhLEdBQUc7QUFDN0QscUJBQU87QUFBQSxZQUNUO0FBQ0EsZ0JBQUksR0FBRyxTQUFTLFlBQVksS0FBSyxHQUFHLFNBQVMsT0FBTyxLQUFLLEdBQUcsU0FBUyxhQUFhLEtBQUssR0FBRyxTQUFTLFNBQVMsR0FBRztBQUM3RyxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsT0FBTyxLQUFLLEdBQUcsU0FBUyxVQUFVLEtBQUssR0FBRyxTQUFTLGlCQUFpQixLQUFLLEdBQUcsU0FBUyxNQUFNLEdBQUc7QUFDNUcscUJBQU87QUFBQSxZQUNUO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFNBQVM7QUFBQSxNQUNQLDhCQUE4QjtBQUFBLE1BQzlCLGdDQUFnQztBQUFBLElBQ2xDO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsTUFDaEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
