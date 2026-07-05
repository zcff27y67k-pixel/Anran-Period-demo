# 安然期 Demo

面向 45-60 岁围绝经期及绝经后女性的移动端 H5 Demo，用于记录经期变化、潮热盗汗、睡眠受影响、身体感受、整体心情，并生成就医摘要。

## 本地运行

```bash
npm install
npm run dev
```

本地地址通常为：

```text
http://127.0.0.1:5174/
```

## 构建

```bash
npm run build
```

构建产物目录：

```text
dist
```

## Vercel 部署配置

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

项目已包含 `vercel.json`，Vercel 通常会自动读取配置。

## 页面入口

- Demo: `/`
- 原型图: `/anranqi-prototype.html`

## 数据说明

当前版本为前端 Demo，数据保存在用户本机浏览器的 `localStorage` 中，不包含后端、账号和云同步。

