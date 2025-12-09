import http from 'http'
import { WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'

const PORT = process.env.PORT || 8080

// 存储
const players = new Map() // odId -> { odId, ws, name, rating, deck, status, roomId }
const matchQueue = [] // 等待匹配的玩家
const rooms = new Map() // roomId -> { id, players: [p1, p2], state }

// 创建 HTTP 服务器（Render 健康检查需要）
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('OK')
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('404-Zoo Battle Server')
  } else {
    res.writeHead(404)
    res.end()
  }
})

// WebSocket 挂载到 HTTP 服务器
const wss = new WebSocketServer({ server })

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
  console.log(`   ${p1.name} (P1) vs ${p2.name} (P2)`)

  send(p1.ws, 'match_found', {
    roomId,
    playerId: 'p1',
    opponent: { name: p2.name, rating: p2.rating },
  })
  send(p2.ws, 'match_found', {
    roomId,
    playerId: 'p2',
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
  
  // 重置战斗完成标记和单位状态
  for (const odId of room.players) {
    if (room.state.playerStates[odId]) {
      room.state.playerStates[odId].battleDone = false
      room.state.playerStates[odId].ready = false
      // 清空场上单位（玩家需要重新布阵）
      room.state.playerStates[odId].units = []
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

// 根据职业选择攻击目标
function selectAttackTarget(attacker, enemies) {
  const aliveEnemies = enemies.filter(e => e.health > 0)
  if (aliveEnemies.length === 0) return null

  const attackerPos = attacker.position ?? 0
  const traitType = attacker.traitType ?? 0

  // Warrior(0): 对位优先
  if (traitType === 0) {
    const opposite = aliveEnemies.find(e => e.position === attackerPos)
    if (opposite) return opposite
    return [...aliveEnemies].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]
  }

  // Archer(1): 优先后排(3-5)
  if (traitType === 1) {
    const backRow = aliveEnemies.filter(e => (e.position ?? 0) >= 3)
    if (backRow.length > 0) {
      return [...backRow].sort((a, b) =>
        Math.abs((a.position ?? 0) - attackerPos) - Math.abs((b.position ?? 0) - attackerPos)
      )[0]
    }
    const frontRow = aliveEnemies.filter(e => (e.position ?? 0) < 3)
    if (frontRow.length > 0) {
      return [...frontRow].sort((a, b) =>
        Math.abs((a.position ?? 0) - attackerPos) - Math.abs((b.position ?? 0) - attackerPos)
      )[0]
    }
    return aliveEnemies[0]
  }

  // Assassin(2): 攻击攻击力最高的
  if (traitType === 2) {
    const maxAttack = Math.max(...aliveEnemies.map(e => e.attack))
    const highest = aliveEnemies.filter(e => e.attack === maxAttack)
    return highest[0] // 不用随机，保证双方一致
  }

  // 默认：对位优先
  const opposite = aliveEnemies.find(e => e.position === attackerPos)
  if (opposite) return opposite
  return [...aliveEnemies].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]
}

// 获取职业名称
function getTraitName(traitType) {
  const names = { 0: '战士', 1: '射手', 2: '刺客' }
  return names[traitType] || '单位'
}

// 获取目标描述
function getTargetDesc(attacker, target) {
  const traitType = attacker.traitType ?? 0
  const targetPos = target.position ?? 0
  if (traitType === 0) return targetPos === (attacker.position ?? 0) ? '对位' : '顺位'
  if (traitType === 1) return targetPos >= 3 ? '后排' : '前排'
  if (traitType === 2) return '高攻'
  return '对位'
}

// 开始战斗 - 服务器计算并同步
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
  console.log(`   P1 (${p1?.name}) units: ${p1State.units.length}`)
  console.log(`   P2 (${p2?.name}) units: ${p2State.units.length}`)

  // 发送战斗开始
  broadcastToRoom(roomId, 'battle_start', {
    round: room.state.round,
    p1Units: p1State.units,
    p2Units: p2State.units,
  })

  // 服务器执行战斗
  executeBattleOnServer(roomId)
}

// 服务器执行战斗逻辑
async function executeBattleOnServer(roomId) {
  const room = rooms.get(roomId)
  if (!room) return

  const [p1Id, p2Id] = room.players
  const p1State = room.state.playerStates[p1Id]
  const p2State = room.state.playerStates[p2Id]

  // 深拷贝单位用于战斗（确保 units 是数组）
  const p1Units = (p1State.units || []).filter(u => u.position !== null).map(u => ({ ...u }))
  const p2Units = (p2State.units || []).filter(u => u.position !== null).map(u => ({ ...u }))

  const currentRound = room.state.round

  // 发送战斗开始日志
  broadcastToRoom(roomId, 'battle_log', {
    log: `⚔️ 第 ${currentRound} 回合战斗开始！`,
  })
  await sleep(500)
  broadcastToRoom(roomId, 'battle_log', {
    log: `P1 ${p1Units.length} 单位 vs P2 ${p2Units.length} 单位`,
  })
  await sleep(1000)

  // 处理一方或双方没有单位的情况
  if (p1Units.length === 0 && p2Units.length === 0) {
    // 双方都没有单位，平局
    broadcastToRoom(roomId, 'battle_log', { log: '🤝 双方都没有出战单位，平局！' })
    await finishBattle(roomId, p1Units, p2Units, 'draw', 'draw', currentRound)
    return
  } else if (p1Units.length === 0) {
    // P1 没有单位，P2 获胜
    broadcastToRoom(roomId, 'battle_log', { log: '💔 P1 没有出战单位，P2 获胜！' })
    await finishBattle(roomId, p1Units, p2Units, 'lose', 'win', currentRound)
    return
  } else if (p2Units.length === 0) {
    // P2 没有单位，P1 获胜
    broadcastToRoom(roomId, 'battle_log', { log: '🎉 P2 没有出战单位，P1 获胜！' })
    await finishBattle(roomId, p1Units, p2Units, 'win', 'lose', currentRound)
    return
  }

  let turnCount = 0
  const maxTurns = 100

  // 战斗循环
  while (turnCount < maxTurns) {
    turnCount++

    const p1Alive = p1Units.filter(u => u.health > 0).length
    const p2Alive = p2Units.filter(u => u.health > 0).length

    if (p2Alive === 0) {
      broadcastToRoom(roomId, 'battle_log', { log: '🎉 P1 获胜！P2 全军覆没！' })
      break
    }
    if (p1Alive === 0) {
      broadcastToRoom(roomId, 'battle_log', { log: '🎉 P2 获胜！P1 全军覆没！' })
      break
    }

    broadcastToRoom(roomId, 'battle_log', { log: `--- 第 ${turnCount} 轮 ---` })

    // 按位置 0→5 循环攻击
    for (let pos = 0; pos < 6; pos++) {
      // P1 攻击
      const p1Unit = p1Units.find(u => u.position === pos && u.health > 0)
      if (p1Unit) {
        const target = selectAttackTarget(p1Unit, p2Units)
        if (target) {
          target.health -= p1Unit.attack
          const traitName = getTraitName(p1Unit.traitType)
          const targetDesc = getTargetDesc(p1Unit, target)
          
          broadcastToRoom(roomId, 'battle_attack', {
            attacker: { ...p1Unit, side: 'p1' },
            target: { ...target, side: 'p2' },
            damage: p1Unit.attack,
            log: `[${traitName}] ${p1Unit.name}⭐${p1Unit.star} → ${target.name}(${targetDesc}) -${p1Unit.attack} HP (剩余: ${Math.max(0, target.health)})`,
          })

          if (target.health <= 0) {
            broadcastToRoom(roomId, 'battle_log', { log: `💀 P2 ${target.name} 阵亡！` })
          }

          // 同步单位状态
          broadcastToRoom(roomId, 'battle_units_update', {
            p1Units: p1Units.map(u => ({ ...u })),
            p2Units: p2Units.map(u => ({ ...u })),
          })

          await sleep(1000)

          if (!p2Units.some(u => u.health > 0)) break
        }
      }

      // P2 攻击
      const p2Unit = p2Units.find(u => u.position === pos && u.health > 0)
      if (p2Unit) {
        const target = selectAttackTarget(p2Unit, p1Units)
        if (target) {
          target.health -= p2Unit.attack
          const traitName = getTraitName(p2Unit.traitType)
          const targetDesc = getTargetDesc(p2Unit, target)

          broadcastToRoom(roomId, 'battle_attack', {
            attacker: { ...p2Unit, side: 'p2' },
            target: { ...target, side: 'p1' },
            damage: p2Unit.attack,
            log: `[${traitName}] ${p2Unit.name}⭐${p2Unit.star} → ${target.name}(${targetDesc}) -${p2Unit.attack} HP (剩余: ${Math.max(0, target.health)})`,
          })

          if (target.health <= 0) {
            broadcastToRoom(roomId, 'battle_log', { log: `💀 P1 ${target.name} 阵亡！` })
          }

          // 同步单位状态
          broadcastToRoom(roomId, 'battle_units_update', {
            p1Units: p1Units.map(u => ({ ...u })),
            p2Units: p2Units.map(u => ({ ...u })),
          })

          await sleep(1000)

          if (!p1Units.some(u => u.health > 0)) break
        }
      }

      if (!p1Units.some(u => u.health > 0) || !p2Units.some(u => u.health > 0)) break
    }
  }

  // 结算
  const p1Alive = p1Units.filter(u => u.health > 0).length
  const p2Alive = p2Units.filter(u => u.health > 0).length

  let p1Result, p2Result
  if (p2Alive === 0 && p1Alive > 0) {
    p1Result = 'win'
    p2Result = 'lose'
  } else if (p1Alive === 0 && p2Alive > 0) {
    p1Result = 'lose'
    p2Result = 'win'
  } else if (p1Alive === 0 && p2Alive === 0) {
    p1Result = 'draw'
    p2Result = 'draw'
  } else {
    // 回合耗尽，比较存活数
    if (p1Alive > p2Alive) {
      p1Result = 'win'
      p2Result = 'lose'
    } else if (p1Alive < p2Alive) {
      p1Result = 'lose'
      p2Result = 'win'
    } else {
      p1Result = 'draw'
      p2Result = 'draw'
    }
  }

  // 计算 HP 变化
  const hpLoss = currentRound * currentRound
  if (p1Result === 'lose') {
    p1State.hp = Math.max(0, p1State.hp - hpLoss)
  }
  if (p2Result === 'lose') {
    p2State.hp = Math.max(0, p2State.hp - hpLoss)
  }
  if (p1Result === 'draw') {
    p1State.hp = Math.max(0, p1State.hp - Math.floor(hpLoss / 2))
    p2State.hp = Math.max(0, p2State.hp - Math.floor(hpLoss / 2))
  }

  await sleep(1000)

  // 发送战斗结束
  const p1 = players.get(p1Id)
  const p2 = players.get(p2Id)

  if (p1?.ws) {
    send(p1.ws, 'battle_result', {
      result: p1Result,
      myHP: p1State.hp,
      opponentHP: p2State.hp,
      round: currentRound,
    })
  }
  if (p2?.ws) {
    send(p2.ws, 'battle_result', {
      result: p2Result,
      myHP: p2State.hp,
      opponentHP: p1State.hp,
      round: currentRound,
    })
  }

  // 检查游戏是否结束
  if (p1State.hp <= 0 || p2State.hp <= 0) {
    const winner = p1State.hp > 0 ? p1Id : p2Id
    broadcastToRoom(roomId, 'game_over', {
      winner: players.get(winner)?.name,
      p1HP: p1State.hp,
      p2HP: p2State.hp,
    })
    cleanupRoom(roomId)
  } else {
    // 2秒后开始下一回合
    setTimeout(() => {
      room.state.round++
      startPreparationTimer(roomId)
    }, 2000)
  }
}

// 辅助函数：延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 快速结束战斗（用于一方没有单位的情况）
async function finishBattle(roomId, p1Units, p2Units, p1Result, p2Result, currentRound) {
  const room = rooms.get(roomId)
  if (!room) return

  const [p1Id, p2Id] = room.players
  const p1State = room.state.playerStates[p1Id]
  const p2State = room.state.playerStates[p2Id]

  // 计算 HP 变化
  const hpLoss = currentRound * currentRound
  if (p1Result === 'lose') {
    p1State.hp = Math.max(0, p1State.hp - hpLoss)
  }
  if (p2Result === 'lose') {
    p2State.hp = Math.max(0, p2State.hp - hpLoss)
  }
  if (p1Result === 'draw') {
    p1State.hp = Math.max(0, p1State.hp - Math.floor(hpLoss / 2))
    p2State.hp = Math.max(0, p2State.hp - Math.floor(hpLoss / 2))
  }

  await sleep(1000)

  // 发送战斗结束
  const p1 = players.get(p1Id)
  const p2 = players.get(p2Id)

  if (p1?.ws) {
    send(p1.ws, 'battle_result', {
      result: p1Result,
      myHP: p1State.hp,
      opponentHP: p2State.hp,
      round: currentRound,
    })
  }
  if (p2?.ws) {
    send(p2.ws, 'battle_result', {
      result: p2Result,
      myHP: p2State.hp,
      opponentHP: p1State.hp,
      round: currentRound,
    })
  }

  // 检查游戏是否结束
  if (p1State.hp <= 0 || p2State.hp <= 0) {
    const winner = p1State.hp > 0 ? p1Id : p2Id
    broadcastToRoom(roomId, 'game_over', {
      winner: players.get(winner)?.name,
      p1HP: p1State.hp,
      p2HP: p2State.hp,
    })
    cleanupRoom(roomId)
  } else {
    // 2秒后开始下一回合
    setTimeout(() => {
      room.state.round++
      startPreparationTimer(roomId)
    }, 2000)
  }
}

// 处理战斗结束 - 现在由服务器控制，这个函数保留用于兼容
function handleBattleEnd(odId, payload) {
  // 服务器已经控制战斗流程，客户端的 battle_end 消息可以忽略
  console.log(`📨 Received battle_end from ${odId?.slice(0, 8)}, but server controls battle now`)
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

// 启动服务器
server.listen(PORT, () => {
  console.log(`🎮 Battle Server running on port ${PORT}`)
})
