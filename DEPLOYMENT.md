# 公网部署

## Render（推荐）

这个项目已经包含 `Dockerfile` 和 `render.yaml`。Render 的持久磁盘需要付费 Web Service 方案，适合需要长期保存图片的图床。

1. 将 `image-host` 目录推送到 GitHub 仓库。
2. 在 Render 选择 **New > Blueprint**，连接该仓库并选择 `render.yaml`。
3. 创建服务时设置 `PUBLIC_BASE_URL` 为 Render 分配的 `https://你的服务.onrender.com` 地址。
4. 部署完成后，打开该 HTTPS 地址上传图片。

不要把 `PUBLIC_BASE_URL` 设置为 `localhost`。图片链接会按这个变量生成。

## 任意 Docker 云服务器

服务器安装 Docker 后，在 `image-host` 目录执行：

```bash
docker build -t image-shelf .
docker run -d --name image-shelf \
  -p 8787:8787 \
  -e PUBLIC_BASE_URL=https://你的域名 \
  -v image-shelf-uploads:/app/uploads \
  --restart unless-stopped \
  image-shelf
```

再用 Caddy、Nginx 或云负载均衡把域名的 HTTPS 流量转发到 `127.0.0.1:8787`。

## 重要提醒

当前版本没有登录鉴权，公开部署后任何拿到管理地址的人都可以上传和删除图片。正式公开使用前，至少要在反向代理层添加访问认证、上传限流和磁盘监控。
