# 图床 Image Shelf

一个不依赖第三方 npm 包的本地图床。浏览器会把选择的图片统一转成 PNG，服务端保存到 `uploads`，然后返回直链。

## 启动

需要 Node.js 18 或更高版本：

```powershell
cd "C:\Users\Administrator\Documents\ChatGPT\生图\image-host"
node server.js
```

然后打开 <http://localhost:8787>。完整的公网部署步骤见 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

## 让同一局域网的电脑访问

服务默认监听所有网卡。把 `localhost` 换成运行图床电脑的局域网 IP，例如：

```text
http://192.168.1.20:8787
```

如果 Windows 防火墙拦截端口，需要允许 Node.js 通过专用网络。上传后的图片链接会自动使用当前访问地址生成。

## 让任何电脑访问

需要把这个目录部署到有公网 IP 或域名的服务器，并通过 HTTPS 反向代理到 `node server.js`。部署时可以设置：

```powershell
$env:PUBLIC_BASE_URL = "https://你的域名"
node server.js
```

`uploads` 目录就是图片存储位置，请定期备份。公开部署时请在平台环境变量中设置随机的 `ADMIN_TOKEN`；未设置时删除功能会自动关闭。上传接口仍建议配合反向代理认证、限流和磁盘监控使用。
