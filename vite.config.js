/**
  * @Author 怪咖
  * @Date 2023-09-06
 */
import {
  defineConfig,loadEnv
} from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode, command, ssrBuild }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [vue()],
    base: '/dv/',//这里更改打包相对绝对路径
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import './src/assets/style/base.scss';`
        },
      }
    },
    build:{
      outDir: 'dist',   // 指定打包路径 dist 目录
      minify: "terser", // 必须开启：使用terserOptions才有效果
      terserOptions: {
        compress: {
          keep_infinity: true,  // 防止 Infinity 被压缩成 1/0，这可能会导致 Chrome 上的性能问题
          drop_console: true,   // 生产环境去除 console
          drop_debugger: true   // 生产环境去除 debugger
        },
      },
      chunkSizeWarningLimit: 1500   // chunk 大小警告的限制（以 kbs 为单位）
    },
    // 反向代理
    server: {
      port: 130,
      open: false,//服务启动时自动在浏览器中打开应用
      hmr: true,//开启热部署
      proxy: {
        [env.VITE_APP_BASE_API]: {
          target: env.VITE_HOST_URL,
          changeOrigin: true,
          rewrite: path => path.replace(RegExp(`^${env.VITE_APP_BASE_API}`), '')
        }
      }
    }

  }

})