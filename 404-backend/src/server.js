import { WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'

const PORT = process.env.PORT || 8080

// 存储
const players = new Map() // odId -> { odId, odket, name, rating, deck, status }
const matchQueue = [] // 等待匹配的玩家
const rooms = new Map() // roomId -> { id, players: [p1, p2], state }

const wss = new WebSocketServer({ port: PORT })

console.log(`🎮 Battle Server running on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  const odId = uuidv4()
  console.log(`✅ Player connected: ${odId}`)

  // 初始化玩家
  players.set(odId, {
    odId,
    ws,
    name: 'Unknown',
    rating: 1000,
    deck: null,
    status: 'idle', // idle, matching, in_game
    roomId: null,
  })

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      handleMessage(odId, message)
    } catch (e) {
      console.error('Invalid message:', e)
    }
  })

  ws.on('close', () => {
    console.log(`❌ Player disconnected: ${odId}`)
    handleDisconnect(odId)
  })

  // 发送连接成功
  send(ws, 'connected', { odId })
})

// 发送消息
function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }))
  }
}

// 广播给房间内所有玩家
function broadcastToRoom(roomId, type, payload) {
  const room = rooms.get(roomId)
  if (!room) return
  
  for (const odId of room.players) {
    const player = players.get(odId)
    if (player?.ws) {
      send(player.ws, type, payload)
    }
  }
}

// 处理消息
function handleMessage(odId, message) {
  const player = players.get(odId)
  if (!player) return

  const { type, payload } = message
  console.log(`📨 [${odId.slice(0, 8)}] ${type}`)

  switch (type) {
    case 'set_profile':
      player.name = payload.name || 'Unknown'
      player.rating = payload.rating || 1000
      break

    case 'start_match':
      startMatching(odId, payload)
      break

    case 'cancel_match':
      cancelMatching(odId)
      break

    case 'player_action':
      handlePlayerAction(odId, payload)
      break

    case 'ready':
      handleReady(odId)
      break

    case 'sync_state':
      handleSyncState(odId, payload)
      break
  }
}

// 开始匹配
function startMatching(odId, payload) {
  const player = players.get(odId)
  if (!player || player.status !== 'idle') return

  player.deck = payload.deck
  player.status = 'matching'
  matchQueue.push(odId)

  send(player.ws, 'matching_started', { position: matchQueue.length })
  console.log(`🔍 Player ${odId.slice(0, 8)} started matching. Queue: ${matchQueue.length}`)

  // 尝试匹配
  tryMatch()
}

// 尝试匹配
function tryMatch() {
  while (matchQueue.length >= 2) {
    const p1Id = matchQueue.shift()
    const p2Id = matchQueue.shift()

    const p1 = players.get(p1Id)
    const p2 = players.get(p2Id)

    // 检查玩家是否还在线
    if (!p1 || p1.status !== 'matching') {
      if (p2 && p2.status === 'matching') matchQueue.unshift(p2Id)
      continue
    }
    if (!p2 || p2.status !== 'matching') {
      if (p1 && p1.status === 'matching') matchQueue.unshift(p1Id)
      continue
    }

    // 创建房间
    createRoom(p1Id, p2Id)
  }
}

// 创建房间
function createRoom(p1Id, p2Id) {
  const roomId = uuidv4()
  const p1 = players.get(p1Id)
  const p2 = players.get(p2Id)

  const room = {
    id: roomId,
    players: [p1Id, p2Id],
    state: {
      round: 1,
      phase: 'preparation',
      timer: 30,
      playerStates: {
        [p1Id]: { hp: 100, gold: 10, units: [], bench: [], ready: false },
        [p2Id]: { hp: 100, gold: 10, units: [], bench: [], ready: false },
      },
    },
    timerInterval: null,
  }

  rooms.set(roomId, room)

  p1.status = 'in_game'
  p1.roomId = roomId
  p2.status = 'in_game'
  p2.roomId = roomId

  console.log(`🎯 Match found! Room: ${roomId.slice(0, 8)}`)
  console.log(`   ${p1.name} vs ${p2.name}`)

  // 通知双方
  send(p1.ws, 'match_found', {
    roomId,
    opponent: { name: p2.name, rating: p2.rating },
  })
  send(p2.ws, 'match_found', {
    roomId,
    opponent: { name: p1.name, rating: p1.rating },
  })

  // 开始备战阶段计时
  startPreparationTimer(roomId)
}

// 备战阶段计时器
function startPreparationTimer(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  room.state.timer = 30
  room.state.phase = 'preparation'

  // 通知开始
  broadcastToRoom(roomId, 'round_start', {
    round: room.state.round,
    phase: 'preparation',
    timer: 30,
  })

  room.timerInterval = setInterval(() => {
    room.state.timer--

    if (room.state.timer <= 0) {
      clearInterval(room.timerInterval)
      startBattle(roomId)
    } else if (room.state.timer % 5 === 0) {
      // 每5秒同步一次
      broadcastToRoom(roomId, 'timer_update', { timer: room.state.timer })
    }
  }, 1000)
}

// 取消匹配
function cancelMatching(odId) {
  const player = players.get(odId)
  if (!player || player.status !== 'matching') return

  const index = matchQueue.indexOf(odId)
  if (index > -1) {
    matchQueue.splice(index, 1)
  }

  player.status = 'idle'
  send(player.ws, 'matching_cancelled', {})
  console.log(`🚫 Player ${odId.slice(0, 8)} cancelled matching`)
}

// 处理玩家操作
function handlePlayerAction(odId, payload) {
  const player = players.get(odId)
  if (!player || !player.roomId) return

  const room = rooms.get(player.roomId)
  if (!room || room.state.phase !== 'preparation') return

  const playerState = room.state.playerStates[odId]
  if (!playerState) return

  const { action, data } = payload

  switch (action) {
    case 'buy_card':
      // 客户端处理购买逻辑，这里只同步状态
      playerState.gold = data.gold
      playerState.bench = data.bench
      break

    case 'place_unit':
      playerState.units = data.units
      playerState.bench = data.bench
      break

    case 'remove_unit':
      playerState.units = data.units
      playerState.bench = data.bench
      break

    case 'refresh_shop':
      playerState.gold = data.gold
      break
  }

  // 完全同步给对手 - 发送完整的单位信息
  const opponentId = room.players.find(id => id !== odId)
  const opponent = players.get(opponentId)
  if (opponent?.ws) {
    send(opponent.ws, 'opponent_sync', {
      units: playerState.units,
      bench: playerState.bench,
      gold: playerState.gold,
    })
  }
}

// 处理准备完成
function handleReady(odId) {
  const player = players.get(odId)
  if (!player || !player.roomId) return

  const room = rooms.get(player.roomId)
  if (!room) return

  const playerState = room.state.playerStates[odId]
  if (playerState) {
    playerState.ready = true
  }

  // 检查是否双方都准备好了
  const allReady = room.players.every(id => room.state.playerStates[id]?.ready)
  if (allReady && room.state.phase === 'preparation') {
    clearInterval(room.timerInterval)
    startBattle(room.id)
  }
}

// 同步状态
function handleSyncState(odId, payload) {
  const player = players.get(odId)
  if (!player || !player.roomId) return

  const room = rooms.get(player.roomId)
  if (!room) return

  const playerState = room.state.playerStates[odId]
  if (playerState) {
    Object.assign(playerState, payload)
  }
}

// 开始战斗
function startBattle(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  room.state.phase = 'battle'

  // 收集双方单位信息
  const [p1Id, p2Id] = room.players
  const p1State = room.state.playerStates[p1Id]
  const p2State = room.state.playerStates[p2Id]

  // 发送战斗开始，包含对手的单位信息
  const p1 = players.get(p1Id)
  const p2 = players.get(p2Id)

  if (p1?.ws) {
    send(p1.ws, 'battle_start', {
      round: room.state.round,
      myUnits: p1State.units,
      opponentUnits: p2State.units,
    })
  }

  if (p2?.ws) {
    send(p2.ws, 'battle_start', {
      round: room.state.round,
      myUnits: p2State.units,
      opponentUnits: p1State.units,
    })
  }

  console.log(`⚔️ Battle started in room ${roomId.slice(0, 8)}`)

  // 战斗由客户端模拟，等待结果
}

// 处理断开连接
function handleDisconnect(odId) {
  const player = players.get(odId)
  if (!player) return

  // 从匹配队列移除
  const queueIndex = matchQueue.indexOf(odId)
  if (queueIndex > -1) {
    matchQueue.splice(queueIndex, 1)
  }

  // 处理正在进行的游戏
  if (player.roomId) {
    const room = rooms.get(player.roomId)
    if (room) {
      clearInterval(room.timerInterval)

      // 通知对手
      const opponentId = room.players.find(id => id !== odId)
      const opponent = players.get(opponentId)
      if (opponent?.ws) {
        send(opponent.ws, 'opponent_disconnected', {})
        opponent.status = 'idle'
        opponent.roomId = null
      }

      rooms.delete(player.roomId)
    }
  }

  players.delete(odId)
}

// 定期清理
setInterval(() => {
  // 清理断开的玩家
  for (const [odId, player] of players) {
    if (player.ws.readyState !== 1) {
      handleDisconnect(odId)
    }
  }
}, 30000)
