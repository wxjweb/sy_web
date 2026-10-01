# sy_web — 世远 SY 前端

Vue 3 + Element Plus，鲜艳舒适的渐变界面。

## 开发

> **请在 Windows PowerShell / CMD 中启动**，不要用 WSL bash。  
> WSL 会通过 PATH 调到 Windows 的 `npm`（`/mnt/d/Program Files/nodejs/npm`），从而报  
> `WSL 1 is not supported` / `Could not determine Node.js install directory`。  
> 本项目的 `node_modules` 也是 Windows 原生依赖（如 `@esbuild/win32-x64`）。

```powershell
cd E:\pycode\sy_web
npm install
npm run dev
```

浏览器访问 http://localhost:5173 ，API 通过 Vite 代理到后端 `http://localhost:8000`（Django sy_server）。

## 构建

```powershell
npm run build
```
