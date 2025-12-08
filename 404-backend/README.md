# 404 Zoo Battle Server

WebSocket 服务器，用于实时对战匹配和同步。

## 启动服务器

```bash
cd 404-backend
npm install
npm start
```

服务器默认运行在 `ws://localhost:8080`

## 开发模式（自动重启）

```bash
npm run dev
```

## 环境变量

- `PORT` - 服务器端口（默认 8080）

## 前端配置

在 `404-zoo` 目录创建 `.env` 文件：

```
VITE_WS_SERVER=ws://localhost:8080
```

## WebSocket 消息协议

### 客户端 → 服务器

| 类型 | 说明 | Payload |
|------|------|---------|
| `set_profile` | 设置玩家信息 | `{ name, rating }` |
| `start_match` | 开始匹配 | `{ deck }` |
| `cancel_match` | 取消匹配 | - |
| `player_action` | 玩家操作 | `{ action, data }` |
| `ready` | 准备完成 | - |
| `sync_state` | 同步状态 | `{ hp, gold, units, bench }` |

### 服务器 → 客户端

| 类型 | 说明 | Payload |
|------|------|---------|
| `connected` | 连接成功 | `{ odId }` |
| `matching_started` | 开始匹配 | `{ position }` |
| `match_found` | 匹配成功 | `{ roomId, opponent }` |
| `matching_cancelled` | 取消匹配 | - |
| `round_start` | 回合开始 | `{ round, phase, timer }` |
| `timer_update` | 计时器更新 | `{ timer }` |
| `battle_start` | 战斗开始 | `{ round, myUnits, opponentUnits }` |
| `opponent_disconnected` | 对手断开 | - |
| `opponent_update` | 对手状态更新 | `{ unitCount, benchCount }` |
