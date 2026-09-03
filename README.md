# GitHub 图床 Image Shelf

一个单文件 GitHub Pages 图床。网页通过 GitHub Contents API 把图片或音频直接写入本仓库，文件可以使用 GitHub Pages 地址或 jsDelivr 地址访问。

公网地址：<https://diaz4444.github.io/image-host/>

仓库：<https://github.com/diaz4444/image-host>

## GitHub Pages 使用

1. 打开公网地址。
2. 在页面顶部填入 GitHub Personal Access Token，并点击“保存 Token”。Token 只保存在当前浏览器的 `localStorage`，不会写入仓库代码。
3. Token 需要对本仓库有 `Contents: Read and write` 权限。不要把 Token 发给任何人。
4. 选择或拖入图片/音频。上传后可复制 GitHub 原始文件直链，这个地址不依赖 Pages 部署完成，手机打开更稳定。

图片直链格式：

```text
https://raw.githubusercontent.com/diaz4444/image-host/main/文件名
```

图床页面地址仍然是：<https://diaz4444.github.io/image-host/>。新上传文件需要等 Pages 发布后才能使用 Pages 文件地址，因此页面生成的文件链接使用上面的原始文件地址。

也可以使用 jsDelivr CDN：

```text
https://cdn.jsdelivr.net/gh/diaz4444/image-host@main/文件名
```

## 启动

需要 Node.js 18 或更高版本：

```powershell
cd "C:\Users\Administrator\Documents\ChatGPT\生图\image-host"
node server.js
```

然后打开 <http://localhost:8787>。这是旧版 Node 服务，用于本地测试；GitHub Pages 公网版本不需要启动 Node。

## 让同一局域网的电脑访问

服务默认监听所有网卡。把 `localhost` 换成运行图床电脑的局域网 IP，例如：

```text
http://192.168.1.20:8787
```

如果 Windows 防火墙拦截端口，需要允许 Node.js 通过专用网络。上传后的图片链接会自动使用当前访问地址生成。

## GitHub Pages 配置

仓库必须公开，Pages 从 `main` 分支的 `/ (root)` 发布。配置路径：`Settings > Pages > Build and deployment > Deploy from a branch > main > / (root)`。

如果刚开启 Pages，GitHub 需要几分钟生成站点。若页面暂时打不开，稍等后点击页面里的“刷新图库”。

## 旧版 Node 服务

`server.js`、`Dockerfile` 和 `render.yaml` 保留用于本地或自有服务器部署。它们不参与 GitHub Pages 的静态页面运行。

GitHub Contents API 会把每次上传作为一次 Git 提交，仓库历史会保留文件版本。不要上传隐私图片或大文件；GitHub 单文件 API 上传上限约为 100 MB，浏览器和仓库配额仍应控制在合理范围内。
