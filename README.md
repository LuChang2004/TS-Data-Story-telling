## TS Data Story Telling

Taylor Swift 音乐生涯（12 张录音室专辑）数据故事与可视化网页项目（Vite + TypeScript）。

### 开发

```bash
npm install
npm run dev
```

### 构建

```bash
npm run build
npm run preview
```

### 目录结构（约定）

- **`src/`**：应用源码（入口 `src/main.ts`）
- **`src/data/`**：构建期内联的 CSV 数据（`?raw` 导入）
- **`public/`**：运行时静态资源（封面、音频、叙事 JSON、图标、journey 图片等）
- **`assets-src/`**：素材源文件（不直接被站点引用；通过脚本同步到 `public/`）
- **`scripts/`**：数据/素材处理脚本（见 `package.json` scripts）

更完整的项目说明见 `PROJECT.md`。

