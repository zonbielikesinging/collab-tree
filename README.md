# 🌲 CollabTree

**实时协作树状图编辑器** — Vue 3 + D3.js + Yjs，支持多人同时在线编辑同一棵树，零成本部署。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端框架 | Vue 3 + Vite | 响应式 UI |
| 树图渲染 | D3.js (`d3.tree()`) | 自定义布局、缩放、动画 |
| 实时协作 | Yjs + y-websocket | CRDT 算法，冲突自动解决 |
| 浏览器持久化 | y-indexeddb | 离线可用，刷新不丢数据 |
| 服务端中转 | Node.js + ws | WebSocket 广播增量更新 |
| 服务端持久化 | JSON 文件定期落盘 | 重启后数据恢复 |
| 前端托管 | Cloudflare Pages | 免费无限带宽，全球 CDN |
| 后端托管 | Render Web Service | 免费 750h/月 |

## 项目结构

```
collab-tree/
├── client/                  # Vue 3 前端
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.development     # 本地开发 WebSocket 地址
│   ├── .env.production      # 生产环境 WebSocket 地址
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── style.css
│       ├── components/
│       │   ├── TreeCanvas.vue    # D3 树图渲染
│       │   └── NodeEditor.vue    # 节点编辑面板
│       └── composables/
│           └── useYjsTree.js     # Yjs 集成 + CRUD 操作
├── server/                  # WebSocket 同步服务
│   ├── package.json
│   ├── server.cjs
│   └── data/                # 持久化数据目录
│       └── .gitkeep
├── .gitignore
└── README.md
```

## 本地开发

```bash
# 1. 启动 WebSocket 同步服务
cd server
npm install
npm start
# → 🌲 CollabTree WebSocket server running on ws://localhost:1234

# 2. 启动前端开发服务器（新终端）
cd client
npm install
npm run dev
# → http://localhost:3000
```

打开两个浏览器窗口访问 `http://localhost:3000`，在任一窗口编辑节点，另一窗口实时更新。

## 部署

### 1. 部署 WebSocket 服务到 Render

1. 将项目推送到 GitHub 仓库
2. 登录 [Render.com](https://render.com) → New → Web Service
3. 连接 GitHub 仓库，配置：
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. 部署后获得 URL，例如 `https://collab-tree-server.onrender.com`

### 2. 部署前端到 Cloudflare Pages

1. 修改 `client/.env.production` 中的 `VITE_WS_URL` 为 Render 服务地址
2. 构建前端：
   ```bash
   cd client
   npm install
   npm run build
   ```
3. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create → Upload assets
4. 上传 `client/dist/` 目录
5. 获得 URL，例如 `https://collab-tree.pages.dev`

### 冷启动说明

- **Render 免费实例**：15 分钟无活动后休眠，下次请求需 30-50 秒冷启动
- **缓解方案**：使用 Cloudflare Workers 免费层（每天 10 万次请求）设置每 14 分钟 ping 一次 WebSocket 服务
- **替代方案**：可换用 [Fly.io](https://fly.io) 免费层（3 个共享 VM，不休眠，但需信用卡验证）

## 使用说明

- **选中节点**：点击任意节点，右侧面板显示编辑区
- **编辑节点**：修改名称、颜色、备注，实时同步到所有协作者
- **添加子节点**：选中节点后点击"＋ 添加子节点"或在工具栏点"＋ 添加分支"
- **删除节点**：选中节点后点击"删除节点"（根节点不可删除）
- **缩放/平移**：鼠标滚轮缩放，拖拽平移
- **邀请协作者**：分享 URL 即可，所有打开同一页面的人自动进入同一房间协作

## 数据存储

- **服务端**：`server/data/` 目录下的 JSON 文件，每 30 秒自动保存，服务重启后自动恢复
- **浏览器端**：IndexedDB（`y-indexeddb`），离线编辑后重连自动同步
- **同步协议**：Yjs CRDT，自动解决并发冲突，无需手动合并