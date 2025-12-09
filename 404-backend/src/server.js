import { WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'

const PORT = process.env.PORT || 8080

// 存储
const players = new Map() // odId -> { odId, ws, name, rating, deck, status, roomId }
const matchQueue = [] // 等待匹配的玩家
const rooms = new Map() // roomId -> { id, players: [p1, p2], state }

const wss = new WebSocketServer({ port: PORT })

console.log(`🎮 Battle Server running on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  const odId = uuidv4()
  console.log(`✅ Player connected: ${odId}`)

  players.set(odId, {
    odId,
    ws,
    name: 'Unknown',
    rating: 1000,
    deck: null,
    status: 'idle',
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

  send(ws, 'connected', { odId })
})

function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }))
  }
}

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

    case 'battle_end':
      handleBattleEnd(odId, payload)
      break
  }
}

function startMatching(odId, payload) {
  const player = players.get(odId)
  if (!player || player.status !== 'idle') return

  player.deck = payload.deck
  player.status = 'matching'
  matchQueue.push(odId)

  send(player.ws, 'matching_started', { position: matchQueue.length })
  console.log(`🔍 Player ${odId.slice(0, 8)} started matching. Queue: ${matchQueue.length}`)

  tryMatch()
}

function tryMatch() {
  while (matchQueue.length >= 2) {
    const p1Id = matchQueue.shift()
    const p2Id = matchQueue.shift()

    const p1 = players.get(p1Id)
    const p2 = players.get(p2Id)

    if (!p1 || p1.status !== 'matching') {
      if (p2 && p2.status === 'matching') matchQueue.unshift(p2Id)
      continue
    }
    if (!p2 || p2.status !== 'matching') {
      if (p1 && p1.status === 'matching') matchQueue.unshift(p1Id)
      continue
    }

    createRoom(p1Id, p2Id)
  }
}

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
        [p1Id]: { hp: 100, gold: 10, units: [], bench: [], ready: false, battleDone: false },
        [p2Id]: { hp: 100, gold: 10, units: [], bench: [], ready: false, battleDone: false },
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

  send(p1.ws, 'match_found', {
    roomId,
    opponent: { name: p2.name, rating: p2.rating },
  })
  send(p2.ws, 'match_found', {
    roomId,
    opponent: { name: p1.name, rating: p1.rating },
  })

  startPreparationTimer(roomId)
}

function startPreparationTimer(roomId) {
  const room = rooms.get(roomId)
  if (!room) {
    console.log(`⚠️ Room ${roomId?.slice(0, 8)} not found for preparation timer`)
    return
  }

  // 清除之前的定时器
  if (room.timerInterval) {
    clearInterval(room.timerInterval)
    room.timerInterval = null
  }

  room.state.timer = 30
  room.state.phase = 'preparation'
  
  // 重置战斗完成标记
  for (const odId of room.players) {
    if (room.state.playerStates[odId]) {
      room.state.playerStates[odId].battleDone = false
      room.state.playerStates[odId].ready = false
    }
  }

  console.log(`🔔 Starting round ${room.state.round} preparation in room ${roomId.slice(0, 8)}`)

  broadcastToRoom(roomId, 'round_start', {
    round: room.state.round,
    phase: 'preparation',
    timer: 30,
  })

  room.timerInterval = setInterval(() => {
    room.state.timer--

    // 每秒同步倒计时
    broadcastToRoom(roomId, 'timer_update', { timer: room.state.timer })

    if (room.state.timer <= 0) {
      clearInterval(room.timerInterval)
      room.timerInterval = null
      startBattle(roomId)
    }
  }, 1000)
}

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
      playerState.gold = data.gold
      playerState.bench = data.bench
      console.log(`   [${player.name}] buy_card: bench=${data.bench?.length || 0}`)
      break

    case 'place_unit':
      playerState.units = data.units
      playerState.bench = data.bench
      console.log(`   [${player.name}] place_unit: units=${data.units?.length || 0}, bench=${data.bench?.length || 0}`)
      break

    case 'remove_unit':
      playerState.units = data.units
      playerState.bench = data.bench
      console.log(`   [${player.name}] remove_unit: units=${data.units?.length || 0}, bench=${data.bench?.length || 0}`)
      break

    case 'refresh_shop':
      playerState.gold = data.gold
      break
  }

  // 同步给对手
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

function handleReady(odId) {
  const player = players.get(odId)
  if (!player || !player.roomId) return

  const room = rooms.get(player.roomId)
  if (!room) return

  const playerState = room.state.playerStates[odId]
  if (playerState) {
    playerState.ready = true
  }

  const allReady = room.players.every(id => room.state.playerStates[id]?.ready)
  if (allReady && room.state.phase === 'preparation') {
    clearInterval(room.timerInterval)
    startBattle(room.id)
  }
}

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

// 开始战斗 - 同步双方单位
function startBattle(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  // 防止重复开始战斗
  if (room.state.phase === 'battle') {
    console.log(`⚠️ Battle already started in room ${roomId.slice(0, 8)}`)
    return
  }

  room.state.phase = 'battle'

  const [p1Id, p2Id] = room.players
  const p1State = room.state.playerStates[p1Id]
  const p2State = room.state.playerStates[p2Id]

  const p1 = players.get(p1Id)
  const p2 = players.get(p2Id)

  console.log(`⚔️ Battle started in room ${roomId.slice(0, 8)}, round ${room.state.round}`)
  console.log(`   P1 (${p1?.name}) units: ${p1State.units.length}`, p1State.units.map(u => u.name))
  console.log(`   P2 (${p2?.name}) units: ${p2State.units.length}`, p2State.units.map(u => u.name))

  // 发送战斗开始，包含双方的真实单位信息
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
}

// 处理战斗结束 - 等待双方都完成
function handleBattleEnd(odId, payload) {
  const player = players.get(odId)
  if (!player || !player.roomId) {
    console.log(`⚠️ Player ${odId?.slice(0, 8)} not found or no roomId`)
    return
  }

  const roomId = player.roomId
  const room = rooms.get(roomId)
  if (!room) {
    console.log(`⚠️ Room ${roomId?.slice(0, 8)} not found`)
    return
  }
  
  // 允许在 battle 或 settlement 阶段接收 battle_end（防止网络延迟导致的问题）
  if (room.state.phase !== 'battle' && room.state.phase !== 'settlement') {
    console.log(`⚠️ Room ${roomId.slice(0, 8)} phase is ${room.state.phase}, ignoring battle_end`)
    return
  }

  const playerState = room.state.playerStates[odId]
  if (!playerState) {
    console.log(`⚠️ Player state not found for ${odId.slice(0, 8)}`)
    return
  }

  // 如果已经标记完成，忽略重复消息
  if (playerState.battleDone) {
    console.log(`⚠️ Player ${odId.slice(0, 8)} already marked as done`)
    return
  }

  // 标记该玩家战斗完成
  playerState.battleDone = true
  playerState.battleResult = payload.result
  playerState.hp = payload.hp

  console.log(`🏁 Player ${player.name} (${odId.slice(0, 8)}) battle done: ${payload.result}, HP: ${payload.hp}`)

  // 检查是否双方都完成
  const allDone = room.players.every(id => room.state.playerStates[id]?.battleDone)
  
  if (allDone) {
    console.log(`✅ Both players done, starting next round`)
    
    // 检查游戏是否结束
    const [p1Id, p2Id] = room.players
    const p1State = room.state.playerStates[p1Id]
    const p2State = room.state.playerStates[p2Id]

    if (p1State.hp <= 0 || p2State.hp <= 0) {
      // 游戏结束
      const winner = p1State.hp > 0 ? p1Id : p2Id
      broadcastToRoom(roomId, 'game_over', {
        winner: players.get(winner)?.name,
        p1HP: p1State.hp,
        p2HP: p2State.hp,
      })
      
      // 清理房间
      cleanupRoom(roomId)
    } else {
      // 进入下一回合
      room.state.round++
      room.state.phase = 'settlement'
      
      // 通知双方进入结算，发送各自视角的 HP（myHP 和 opponentHP）
      const p1 = players.get(p1Id)
      const p2 = players.get(p2Id)
      
      if (p1?.ws) {
        send(p1.ws, 'round_end', {
          round: room.state.round - 1,
          myHP: p1State.hp,
          opponentHP: p2State.hp,
        })
      }
      if (p2?.ws) {
        send(p2.ws, 'round_end', {
          round: room.state.round - 1,
          myHP: p2State.hp,
          opponentHP: p1State.hp,
        })
      }

      // 2秒后开始下一回合
      setTimeout(() => {
        startPreparationTimer(roomId)
      }, 2000)
    }
  }
}

function cleanupRoom(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  clearInterval(room.timerInterval)

  for (const odId of room.players) {
    const player = players.get(odId)
    if (player) {
      player.status = 'idle'
      player.roomId = null
    }
  }

  rooms.delete(roomId)
  console.log(`🧹 Room ${roomId.slice(0, 8)} cleaned up`)
}

function handleDisconnect(odId) {
  const player = players.get(odId)
  if (!player) return

  const queueIndex = matchQueue.indexOf(odId)
  if (queueIndex > -1) {
    matchQueue.splice(queueIndex, 1)
  }

  if (player.roomId) {
    const room = rooms.get(player.roomId)
    if (room) {
      clearInterval(room.timerInterval)

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

setInterval(() => {
  for (const [odId, player] of players) {
    if (player.ws.readyState !== 1) {
      handleDisconnect(odId)
    }
  }
}, 30000)
