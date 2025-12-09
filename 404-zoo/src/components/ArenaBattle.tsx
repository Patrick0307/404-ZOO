import { useState, useEffect, useCallback, useRef } from 'react'
import '../css/ArenaBattle.css'
import {
  type PlayerProfile,
  type PlayerDeck,
  getPlayerCardsWithTemplates,
  Rarity,
  RarityNames,
} from '../services/contract'
import { getCachedPlayerCards, hasPlayerDataCache, type PlayerCardData } from '../services/playerDataCache'
import { getCachedCards, getImageUrl } from '../services/cardCache'
import {
  battleSocket,
  type BattleMessage,
  type MatchFoundPayload,
  type RoundStartPayload,
  type BattleStartPayload,
  type BattleUnitData,
} from '../services/battleSocket'

interface ArenaBattleProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
  selectedDeck: PlayerDeck
}

// 战斗单位（带星级）
interface BattleUnit {
  id: string
  cardTypeId: number
  name: string
  attack: number
  health: number
  maxHealth: number
  rarity: Rarity
  traitType: number
  imageUri: string
  star: number
  position: number | null
}

// 游戏阶段
type GamePhase = 'matching' | 'preparation' | 'battle' | 'settlement' | 'gameover'

// 回合结果
type RoundResult = 'win' | 'lose' | 'draw' | null

// 卡牌购买价格
const CARD_PRICES: Record<Rarity, number> = {
  [Rarity.Common]: 2,
  [Rarity.Rare]: 4,
  [Rarity.Legendary]: 5,
}

// 连胜奖励
const WIN_STREAK_BONUS = [0, 2, 4, 6, 8, 10]

function ArenaBattle({ onBack, playerProfile, selectedDeck }: ArenaBattleProps) {
  // 游戏状态
  const [gamePhase, setGamePhase] = useState<GamePhase>('matching')
  const [round, setRound] = useState(1)
  const [timer, setTimer] = useState(30)
  
  // 玩家状态
  const [playerHP, setPlayerHP] = useState(100)
  const [playerGold, setPlayerGold] = useState(10)
  const [playerWinStreak, setPlayerWinStreak] = useState(0)
  const [playerUnits, setPlayerUnits] = useState<BattleUnit[]>([])
  const [playerBench, setPlayerBench] = useState<BattleUnit[]>([])
  
  // 对手状态
  const [opponentHP, setOpponentHP] = useState(100)
  const [opponentUnits, setOpponentUnits] = useState<BattleUnit[]>([])
  const [opponentName, setOpponentName] = useState('等待对手...')
  
  // 商店状态
  const [shopCards, setShopCards] = useState<PlayerCardData[]>([])
  const [deckCards, setDeckCards] = useState<PlayerCardData[]>([])
  const [freeRefresh, setFreeRefresh] = useState(true)
  
  // UI 状态
  const [showShop, setShowShop] = useState(true)
  const [selectedUnit, setSelectedUnit] = useState<BattleUnit | null>(null)
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [roundResult, setRoundResult] = useState<RoundResult>(null)
  
  // WebSocket 状态
  const [wsConnected, setWsConnected] = useState(false)
  const wsConnectedRef = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  
  // Refs
  const selectedDeckRef = useRef(selectedDeck)
  const playerProfileRef = useRef(playerProfile)
  const playerUnitsRef = useRef<BattleUnit[]>([])
  const opponentUnitsRef = useRef<BattleUnit[]>([])
  const roundRef = useRef(round)
  const isBattlingRef = useRef(false)
  const preBattleUnitsRef = useRef<BattleUnit[]>([])
  const playerHPRef = useRef(playerHP)
  const playerWinStreakRef = useRef(playerWinStreak)
  
  useEffect(() => { selectedDeckRef.current = selectedDeck }, [selectedDeck])
  useEffect(() => { playerWinStreakRef.current = playerWinStreak }, [playerWinStreak])
  useEffect(() => { wsConnectedRef.current = wsConnected }, [wsConnected])
  useEffect(() => { playerHPRef.current = playerHP }, [playerHP])
  useEffect(() => { playerProfileRef.current = playerProfile }, [playerProfile])
  useEffect(() => { playerUnitsRef.current = playerUnits }, [playerUnits])
  useEffect(() => { opponentUnitsRef.current = opponentUnits }, [opponentUnits])
  useEffect(() => { roundRef.current = round }, [round])


  // 处理 WebSocket 消息
  const handleWSMessage = useCallback((message: BattleMessage) => {
    console.log('📨 WS Message:', message.type, message.payload)
    
    switch (message.type) {
      case 'matching_started':
        console.log('🔍 Matching started...')
        break
        
      case 'match_found': {
        const payload = message.payload as MatchFoundPayload
        console.log('🎯 Match found! Opponent:', payload.opponent.name)
        setOpponentName(payload.opponent.name)
        setGamePhase('preparation')
        initializeGame()
        break
      }
      
      case 'matching_cancelled':
        onBack()
        break
        
      case 'round_start': {
        const payload = message.payload as RoundStartPayload
        console.log(`🔔 Round ${payload.round} starting, timer: ${payload.timer}`)
        // 重置战斗状态
        isBattlingRef.current = false
        setRound(payload.round)
        setTimer(payload.timer)
        setFreeRefresh(true)
        setRoundResult(null)
        setGamePhase('preparation')
        // refreshShop 会在 preparation 阶段由 useEffect 或用户操作触发
        break
      }
      
      case 'timer_update': {
        const payload = message.payload as { timer: number }
        setTimer(payload.timer)
        break
      }
      
      case 'battle_start': {
        // 防止重复执行战斗
        if (isBattlingRef.current) {
          console.log('⚠️ Already battling, ignoring battle_start')
          break
        }
        isBattlingRef.current = true
        
        const payload = message.payload as BattleStartPayload
        ;(async () => {
          const allTemplates = await getCachedCards()
          const oppUnits: BattleUnit[] = payload.opponentUnits.map(u => {
            const template = allTemplates.find(t => t.cardTypeId === u.cardTypeId)
            return {
              ...u,
              maxHealth: u.maxHealth || u.health,
              rarity: template?.rarity ?? Rarity.Common,
              traitType: template?.traitType ?? 0,
              imageUri: template ? getImageUrl(template.imageUri) : '',
            }
          })
          // 更新 ref 以确保战斗使用最新的对手单位
          opponentUnitsRef.current = oppUnits
          setOpponentUnits(oppUnits)
          setBattleLog([])
          setGamePhase('battle')
          setTimeout(() => executeBattle(), 500)
        })()
        break
      }
      
      case 'opponent_disconnected':
        alert('对手已断开连接')
        returnToLobby()
        break
        
      case 'opponent_sync': {
        const payload = message.payload as { units: BattleUnitData[], bench: BattleUnitData[], gold: number }
        ;(async () => {
          const allTemplates = await getCachedCards()
          const oppUnits: BattleUnit[] = payload.units.map(u => {
            const template = allTemplates.find(t => t.cardTypeId === u.cardTypeId)
            return {
              ...u,
              maxHealth: u.maxHealth || u.health,
              rarity: template?.rarity ?? Rarity.Common,
              traitType: template?.traitType ?? 0,
              imageUri: template ? getImageUrl(template.imageUri) : '',
            }
          })
          setOpponentUnits(oppUnits)
        })()
        break
      }
      
      case 'round_end': {
        // 服务器通知回合结束，同步双方 HP
        const payload = message.payload as { round: number, p1HP: number, p2HP: number, myHP: number, opponentHP: number }
        console.log('📊 Round ended, syncing HP:', payload)
        
        // 同步双方血量（服务器会发送 myHP 和 opponentHP）
        if (payload.myHP !== undefined) {
          setPlayerHP(payload.myHP)
        }
        if (payload.opponentHP !== undefined) {
          setOpponentHP(payload.opponentHP)
        }
        
        setGamePhase('settlement')
        break
      }
      
      case 'game_over': {
        const payload = message.payload as { winner: string, p1HP: number, p2HP: number }
        console.log('🏆 Game over! Winner:', payload.winner)
        setGamePhase('gameover')
        break
      }
    }
  }, [])

  // WebSocket 连接
  const connectWebSocket = useCallback(async () => {
    try {
      await battleSocket.connect()
      setWsConnected(true)
      
      battleSocket.setProfile(
        playerProfile?.username || '玩家',
        playerProfile?.trophies || 1000
      )
      
      unsubscribeRef.current = battleSocket.onMessage(handleWSMessage)
      
      battleSocket.startMatching({
        deckId: selectedDeck.deckIndex.toString(),
        cardMints: selectedDeck.cardMints.map(m => m.toBase58()),
      })
      console.log('🔍 Waiting for opponent...')
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      alert('无法连接到服务器，请检查网络')
      onBack()
    }
  }, [playerProfile, selectedDeck, handleWSMessage, onBack])

  // 生成对手单位（用于本地测试或服务器未提供时）
  const generateOpponentUnits = useCallback(async (currentRound: number) => {
    const units: BattleUnit[] = []
    const count = Math.min(currentRound + 1, 6)
    const allTemplates = await getCachedCards()
    
    for (let i = 0; i < count; i++) {
      const template = allTemplates.length > 0 
        ? allTemplates[Math.floor(Math.random() * allTemplates.length)]
        : null
      
      if (template) {
        const baseAttack = 10 + currentRound * 5 + Math.floor(Math.random() * 10)
        const baseHealth = 20 + currentRound * 8 + Math.floor(Math.random() * 15)
        
        units.push({
          id: `opponent_${i}`,
          cardTypeId: template.cardTypeId,
          name: template.name,
          attack: baseAttack,
          health: baseHealth,
          maxHealth: baseHealth,
          rarity: template.rarity,
          traitType: template.traitType,
          imageUri: getImageUrl(template.imageUri),
          star: Math.min(Math.floor(Math.random() * currentRound) + 1, 3),
          position: i,
        })
      } else {
        units.push({
          id: `opponent_${i}`,
          cardTypeId: i + 1,
          name: `敌方单位${i + 1}`,
          attack: 10 + currentRound * 5,
          health: 20 + currentRound * 8,
          maxHealth: 20 + currentRound * 8,
          rarity: Rarity.Common,
          traitType: 0,
          imageUri: '',
          star: 1,
          position: i,
        })
      }
    }
    
    setOpponentUnits(units)
  }, [])

  // 初始化游戏
  const initializeGame = useCallback(async () => {
    setRound(1)
    setPlayerHP(100)
    setOpponentHP(100)
    setPlayerGold(10)
    setPlayerWinStreak(0)
    setPlayerUnits([])
    setPlayerBench([])
    setOpponentUnits([])
    setFreeRefresh(true)
    setBattleLog([])
    setTimer(30)
    
    const deck = selectedDeckRef.current
    const profile = playerProfileRef.current
    
    if (!deck || !profile) return
    
    let cards: PlayerCardData[]
    if (hasPlayerDataCache()) {
      cards = getCachedPlayerCards()
    } else {
      cards = await getPlayerCardsWithTemplates(profile.wallet)
    }
    
    const deckCardData: PlayerCardData[] = []
    for (const mint of deck.cardMints) {
      const mintStr = mint.toBase58()
      const card = cards.find(c => c.instance.mint.toBase58() === mintStr)
      if (card?.template) {
        deckCardData.push(card)
      }
    }
    
    setDeckCards(deckCardData)
    if (deckCardData.length > 0) {
      const shuffled = [...deckCardData].sort(() => Math.random() - 0.5)
      setShopCards(shuffled.slice(0, 3))
    }
    
    // 预生成对手（服务器会覆盖）
    await generateOpponentUnits(1)
  }, [generateOpponentUnits])

  // 组件挂载时连接 WebSocket
  useEffect(() => {
    let isMounted = true
    
    const init = async () => {
      await new Promise(r => setTimeout(r, 50))
      if (!isMounted) return
      connectWebSocket()
    }
    
    init()
    
    return () => {
      isMounted = false
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      battleSocket.cancelMatching()
      battleSocket.disconnect()
    }
  }, [connectWebSocket])

  // 刷新商店
  const refreshShop = () => {
    if (deckCards.length === 0) return
    const shuffled = [...deckCards].sort(() => Math.random() - 0.5)
    setShopCards(shuffled.slice(0, 3))
  }

  // 转换为网络数据格式
  const toUnitData = (unit: BattleUnit): BattleUnitData => ({
    id: unit.id,
    cardTypeId: unit.cardTypeId,
    name: unit.name,
    attack: unit.attack,
    health: unit.health,
    maxHealth: unit.maxHealth,
    star: unit.star,
    position: unit.position,
  })

  // 购买卡牌
  const buyCard = (cardData: PlayerCardData) => {
    const { instance, template } = cardData
    if (!template) return
    
    const price = CARD_PRICES[template.rarity as Rarity]
    if (playerGold < price) return
    
    const newGold = playerGold - price
    setPlayerGold(newGold)
    
    const newUnit: BattleUnit = {
      id: `unit_${Date.now()}_${Math.random()}`,
      cardTypeId: template.cardTypeId,
      name: template.name,
      attack: instance.attack,
      health: instance.health,
      maxHealth: instance.health,
      rarity: template.rarity,
      traitType: template.traitType,
      imageUri: template.imageUri,
      star: 1,
      position: null,
    }
    
    tryMergeUnit(newUnit, newGold)
    refreshShop()
  }


  // 尝试合成单位
  const tryMergeUnit = (newUnit: BattleUnit, currentGold?: number) => {
    const updatedBench = [...playerBench, newUnit]
    const allUnits = [...playerUnits, ...updatedBench]
    const sameUnits = allUnits.filter(u => u.cardTypeId === newUnit.cardTypeId && u.star === newUnit.star)
    
    if (sameUnits.length >= 3 && newUnit.star < 3) {
      const toRemove = sameUnits.slice(0, 3)
      const toRemoveIds = new Set(toRemove.map(u => u.id))
      
      const baseAttack = newUnit.star === 1 ? newUnit.attack : Math.floor(newUnit.attack / newUnit.star)
      const baseHealth = newUnit.star === 1 ? newUnit.health : Math.floor(newUnit.health / newUnit.star)
      const newStar = newUnit.star + 1
      
      const upgradedUnit: BattleUnit = {
        ...newUnit,
        id: `unit_${Date.now()}_${Math.random()}`,
        star: newStar,
        attack: baseAttack * newStar,
        health: baseHealth * newStar,
        maxHealth: baseHealth * newStar,
        position: null,
      }
      
      const newFieldUnits = playerUnits.filter(u => !toRemoveIds.has(u.id))
      const newBenchUnits = updatedBench.filter(u => !toRemoveIds.has(u.id))
      
      setPlayerUnits(newFieldUnits)
      setPlayerBench(newBenchUnits)
      
      setTimeout(() => tryMergeUnit(upgradedUnit, currentGold), 100)
    } else {
      setPlayerBench(updatedBench)
      
      if (wsConnected && currentGold !== undefined) {
        battleSocket.buyCard(currentGold, updatedBench.map(toUnitData))
      }
    }
  }

  // 刷新商店按钮
  const handleRefreshShop = () => {
    if (freeRefresh) {
      setFreeRefresh(false)
      refreshShop()
    } else if (playerGold >= 2) {
      const newGold = playerGold - 2
      setPlayerGold(newGold)
      refreshShop()
      
      if (wsConnected) {
        battleSocket.refreshShop(newGold)
      }
    }
  }

  // 放置单位到战场
  const placeUnit = (unit: BattleUnit, position: number) => {
    if (playerUnits.find(u => u.position === position)) return
    
    const newBench = playerBench.filter(u => u.id !== unit.id)
    setPlayerBench(newBench)
    
    const placedUnit = { ...unit, position }
    const newUnits = [...playerUnits.filter(u => u.id !== unit.id), placedUnit]
    setPlayerUnits(newUnits)
    playerUnitsRef.current = newUnits
    
    if (wsConnected) {
      const unitsData = newUnits.map(toUnitData)
      console.log('📤 Sending placeUnit:', unitsData.length, 'units')
      battleSocket.placeUnit(unitsData, newBench.map(toUnitData))
    }
  }

  // 移回备战区
  const removeFromField = (unit: BattleUnit) => {
    const newUnits = playerUnits.filter(u => u.id !== unit.id)
    const newBench = [...playerBench, { ...unit, position: null }]
    
    setPlayerUnits(newUnits)
    setPlayerBench(newBench)
    
    if (wsConnected) {
      battleSocket.removeUnit(newUnits.map(toUnitData), newBench.map(toUnitData))
    }
  }

  // 根据职业选择攻击目标
  const selectAttackTarget = (attacker: BattleUnit, enemies: BattleUnit[]): BattleUnit | null => {
    const aliveEnemies = enemies.filter(e => e.health > 0)
    if (aliveEnemies.length === 0) return null
    
    const attackerPos = attacker.position ?? 0
    const traitType = attacker.traitType
    
    // Warrior(0): 对位优先，对位死亡则按编号从小到大
    if (traitType === 0) {
      const opposite = aliveEnemies.find(e => e.position === attackerPos)
      if (opposite) return opposite
      return [...aliveEnemies].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]
    }
    
    // Archer(1): 优先后排(3-5)，按距离排序
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
      return highest[Math.floor(Math.random() * highest.length)]
    }
    
    // 默认：对位优先
    const opposite = aliveEnemies.find(e => e.position === attackerPos)
    if (opposite) return opposite
    return [...aliveEnemies].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]
  }

  // 获取职业名称
  const getTraitName = (traitType: number): string => {
    const names: Record<number, string> = { 0: '战士', 1: '射手', 2: '刺客' }
    return names[traitType] || '单位'
  }

  // 获取目标描述
  const getTargetDesc = (attacker: BattleUnit, target: BattleUnit): string => {
    const traitType = attacker.traitType
    const targetPos = target.position ?? 0
    if (traitType === 0) return targetPos === (attacker.position ?? 0) ? '对位' : '顺位'
    if (traitType === 1) return targetPos >= 3 ? '后排' : '前排'
    if (traitType === 2) return '高攻'
    return '对位'
  }

  // 开始战斗
  const startBattle = () => {
    if (isBattlingRef.current) return
    isBattlingRef.current = true
    
    setGamePhase('battle')
    setBattleLog([])
    
    setTimeout(() => executeBattle(), 500)
  }


  // 执行战斗 - 按位置 0→5 循环，每秒攻击一次
  const executeBattle = async () => {
    const currentPlayerUnits = playerUnitsRef.current
    const currentOpponentUnits = opponentUnitsRef.current
    
    // 保存战斗前状态
    preBattleUnitsRef.current = currentPlayerUnits.map(u => ({ ...u }))
    
    const myUnits = currentPlayerUnits.filter(u => u.position !== null).map(u => ({ ...u }))
    const enemyUnits = currentOpponentUnits.map(u => ({ ...u }))
    const logs: string[] = []
    
    const currentRound = roundRef.current
    logs.push(`⚔️ 第 ${currentRound} 回合战斗开始！`)
    logs.push(`我方 ${myUnits.length} 单位 vs 敌方 ${enemyUnits.length} 单位`)
    
    setBattleLog([...logs])
    await new Promise(r => setTimeout(r, 1000))
    
    let turnCount = 0
    const maxTurns = 100
    
    // 战斗循环
    while (turnCount < maxTurns) {
      turnCount++
      
      const myAlive = myUnits.filter(u => u.health > 0).length
      const enemyAlive = enemyUnits.filter(u => u.health > 0).length
      
      if (enemyAlive === 0) {
        logs.push('🎉 敌方全军覆没！')
        setBattleLog([...logs])
        break
      }
      if (myAlive === 0) {
        logs.push('💔 我方全军覆没...')
        setBattleLog([...logs])
        break
      }
      
      logs.push(`--- 第 ${turnCount} 轮 ---`)
      setBattleLog([...logs])
      
      // 按位置 0→5 循环攻击
      for (let pos = 0; pos < 6; pos++) {
        // 我方攻击
        const myUnit = myUnits.find(u => u.position === pos && u.health > 0)
        if (myUnit) {
          const target = selectAttackTarget(myUnit, enemyUnits)
          if (target) {
            target.health -= myUnit.attack
            const traitName = getTraitName(myUnit.traitType)
            const targetDesc = getTargetDesc(myUnit, target)
            logs.push(`[${traitName}] ${myUnit.name}⭐${myUnit.star} → ${target.name}(${targetDesc}) -${myUnit.attack} HP (剩余: ${Math.max(0, target.health)})`)
            
            if (target.health <= 0) {
              logs.push(`💀 敌方 ${target.name} 阵亡！`)
            }
            
            setPlayerUnits(myUnits.map(u => ({ ...u })))
            setOpponentUnits(enemyUnits.map(u => ({ ...u })))
            setBattleLog([...logs])
            await new Promise(r => setTimeout(r, 1000)) // 1秒间隔
            
            if (!enemyUnits.some(u => u.health > 0)) break
          }
        }
        
        // 敌方攻击
        const enemyUnit = enemyUnits.find(u => u.position === pos && u.health > 0)
        if (enemyUnit) {
          const target = selectAttackTarget(enemyUnit, myUnits)
          if (target) {
            target.health -= enemyUnit.attack
            const traitName = getTraitName(enemyUnit.traitType)
            const targetDesc = getTargetDesc(enemyUnit, target)
            logs.push(`[${traitName}] ${enemyUnit.name} → ${target.name}⭐${target.star}(${targetDesc}) -${enemyUnit.attack} HP (剩余: ${Math.max(0, target.health)})`)
            
            if (target.health <= 0) {
              logs.push(`💀 我方 ${target.name}⭐${target.star} 阵亡！`)
            }
            
            setPlayerUnits(myUnits.map(u => ({ ...u })))
            setOpponentUnits(enemyUnits.map(u => ({ ...u })))
            setBattleLog([...logs])
            await new Promise(r => setTimeout(r, 1000)) // 1秒间隔
            
            if (!myUnits.some(u => u.health > 0)) break
          }
        }
        
        if (!enemyUnits.some(u => u.health > 0) || !myUnits.some(u => u.health > 0)) break
      }
    }
    
    // 结算
    const myAlive = myUnits.filter(u => u.health > 0).length
    const enemyAlive = enemyUnits.filter(u => u.health > 0).length
    
    let result: RoundResult
    if (enemyAlive === 0 && myAlive > 0) {
      result = 'win'
      logs.push(`🎉 胜利！我方剩余 ${myAlive} 单位`)
    } else if (myAlive === 0 && enemyAlive > 0) {
      result = 'lose'
      logs.push(`💔 失败... 敌方剩余 ${enemyAlive} 单位`)
    } else if (myAlive === 0 && enemyAlive === 0) {
      result = 'draw'
      logs.push('🤝 同归于尽，平局')
    } else {
      result = myAlive > enemyAlive ? 'win' : myAlive < enemyAlive ? 'lose' : 'draw'
      logs.push(`⏰ 回合数耗尽`)
    }
    
    setBattleLog([...logs])
    setRoundResult(result)
    
    setTimeout(() => settleRound(result), 2000)
  }

  // 结算回合 - 发送给服务器，等待服务器同步下一回合
  const settleRound = (result: RoundResult) => {
    setGamePhase('settlement')
    setRoundResult(result)
    
    const currentRound = roundRef.current
    let goldGain = 5 + currentRound
    let hpLoss = 0
    
    if (result === 'win') {
      const newStreak = playerWinStreakRef.current + 1
      setPlayerWinStreak(newStreak)
      playerWinStreakRef.current = newStreak
      goldGain += WIN_STREAK_BONUS[Math.min(newStreak, 5)]
    } else if (result === 'lose') {
      setPlayerWinStreak(0)
      playerWinStreakRef.current = 0
      hpLoss = currentRound * currentRound // 输了扣血 = round²
      goldGain += 4
    } else {
      hpLoss = Math.floor(currentRound * currentRound / 2)
    }
    
    setPlayerGold(prev => prev + goldGain)
    
    const currentHP = playerHPRef.current
    const newHP = Math.max(0, currentHP - hpLoss)
    if (hpLoss > 0) setPlayerHP(newHP)
    
    // 使用 ref 检查连接状态，避免闭包问题
    const isConnected = wsConnectedRef.current
    console.log('🔍 settleRound called, wsConnected:', isConnected, 'result:', result, 'newHP:', newHP)
    
    // 发送战斗结束给服务器，等待服务器同步
    if (isConnected) {
      battleSocket.sendBattleEnd(result, newHP)
      console.log('📤 Sent battle_end to server, waiting for sync...')
      
      // 恢复单位（本地先恢复，等服务器同步下一回合）
      const savedUnits = preBattleUnitsRef.current
      if (savedUnits.length > 0) {
        const restoredUnits = savedUnits.map(u => ({ ...u, health: u.maxHealth }))
        setPlayerUnits(restoredUnits)
        playerUnitsRef.current = restoredUnits
      }
      
      isBattlingRef.current = false
      // 保持 roundResult 显示，等服务器的 round_start 来重置
      // 不要自己开始下一回合，等服务器的 round_start
    } else {
      // 离线模式：本地处理
      console.log('⚠️ Offline mode, handling locally')
      // 玩家生命归 0
      if (newHP <= 0) {
        setTimeout(() => {
          isBattlingRef.current = false
          setGamePhase('gameover')
        }, 1500)
        return
      }
      
      // 继续下一回合（离线模式）
      setTimeout(() => {
        const nextRound = currentRound + 1
        
        // 恢复单位
        const savedUnits = preBattleUnitsRef.current
        if (savedUnits.length > 0) {
          const restoredUnits = savedUnits.map(u => ({ ...u, health: u.maxHealth }))
          setPlayerUnits(restoredUnits)
          playerUnitsRef.current = restoredUnits
        }
        
        // 生成新对手
        generateOpponentUnits(nextRound)
        
        // 重置状态
        isBattlingRef.current = false
        setRound(nextRound)
        setFreeRefresh(true)
        setRoundResult(null)
        refreshShop()
        setTimer(30)
        setGamePhase('preparation')
      }, 2000)
    }
  }

  // 返回大厅
  const returnToLobby = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    battleSocket.cancelMatching()
    battleSocket.disconnect()
    setWsConnected(false)
    onBack()
  }

  // 回合变化时刷新商店
  useEffect(() => {
    if (gamePhase === 'preparation' && deckCards.length > 0) {
      refreshShop()
    }
  }, [round, gamePhase, deckCards.length])

  // 倒计时 - 只在离线模式下本地倒计时，在线模式完全依赖服务器
  useEffect(() => {
    if (gamePhase !== 'preparation') return
    // 在线模式：不使用本地倒计时，完全依赖服务器的 timer_update 和 battle_start
    if (wsConnected) return
    
    // 离线模式：本地倒计时
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          startBattle()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(interval)
  }, [gamePhase, wsConnected])


  // 渲染匹配中
  const renderMatching = () => (
    <div className="arena-matching-screen">
      <div className="matching-spinner"></div>
      <h2>正在匹配对手...</h2>
      <button className="cancel-btn" onClick={returnToLobby}>取消</button>
    </div>
  )

  // 渲染战场格子
  // 渲染单个格子
  const renderGridCell = (pos: number, units: BattleUnit[], isPlayer: boolean) => {
    const unit = units.find(u => u.position === pos)
    return (
      <div
        key={pos}
        className={`grid-cell ${unit ? 'occupied' : 'empty'}`}
        onClick={() => {
          if (isPlayer && selectedUnit && gamePhase === 'preparation') {
            placeUnit(selectedUnit, pos)
            setSelectedUnit(null)
          }
        }}
      >
        <span className="grid-pos-label">{pos + 1}</span>
        {unit && (
          <div
            className={`unit-card star-${unit.star} rarity-${unit.rarity}`}
            onClick={(e) => {
              e.stopPropagation()
              if (isPlayer && gamePhase === 'preparation') {
                removeFromField(unit)
              }
            }}
          >
            <div className="unit-stars-vertical">
              {Array.from({ length: unit.star }).map((_, i) => (
                <span key={i} className="star">⭐</span>
              ))}
            </div>
            {unit.imageUri && (
              <div className="unit-image">
                <img src={unit.imageUri} alt={unit.name} />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // 渲染战场格子 - 两列三行布局
  // 玩家: [6][1] / [5][2] / [4][3]
  // 对手(镜像): [1][6] / [2][5] / [3][4]
  const renderBattleGrid = (units: BattleUnit[], isPlayer: boolean) => {
    const rows = isPlayer
      ? [[5, 0], [4, 1], [3, 2]]  // 玩家: 左6右1, 左5右2, 左4右3
      : [[0, 5], [1, 4], [2, 3]] // 对手镜像: 左1右6, 左2右5, 左3右4
    return (
      <div className={`arena-battle-grid ${isPlayer ? 'player' : 'opponent'}`}>
        {rows.map((row, i) => (
          <div key={i} className="grid-row">
            {row.map(pos => renderGridCell(pos, units, isPlayer))}
          </div>
        ))}
      </div>
    )
  }

  // 渲染游戏界面
  const renderGame = () => (
    <div className="arena-battle-arena">
      {/* 顶部信息栏 */}
      <div className="arena-battle-header">
        <div className="player-info left">
          <span className="player-name">{playerProfile?.username || '玩家'}</span>
          <div className="hp-bar">
            <div className="hp-fill" style={{ width: `${playerHP}%` }}></div>
            <span className="hp-text">{playerHP}/100</span>
          </div>
        </div>
        
        <div className="round-info">
          <div className="round-number">回合 {round}</div>
          <div className="phase-indicator">
            {gamePhase === 'preparation' && `备战阶段 ${timer}s`}
            {gamePhase === 'battle' && '战斗中...'}
            {gamePhase === 'settlement' && (
              <span className={`result ${roundResult}`}>
                {roundResult === 'win' && '🎉 胜利！等待对手...'}
                {roundResult === 'lose' && '💔 失败 等待对手...'}
                {roundResult === 'draw' && '🤝 平局 等待对手...'}
                {!roundResult && '等待对手...'}
              </span>
            )}
          </div>
        </div>
        
        <div className="player-info right">
          <span className="player-name">{opponentName}</span>
          <div className="hp-bar">
            <div className="hp-fill opponent" style={{ width: `${opponentHP}%` }}></div>
            <span className="hp-text">{opponentHP}/100</span>
          </div>
        </div>
      </div>
      
      {/* 主战场区域 */}
      <div className="arena-battle-main">
        <div className="battlefield player-side">
          <div className="side-label">我方阵容</div>
          {renderBattleGrid(playerUnits, true)}
        </div>
        
        <div className="battle-center">
          {gamePhase === 'battle' || gamePhase === 'settlement' ? (
            <div className="battle-log">
              {battleLog.slice(-8).map((log, i) => (
                <div key={i} className="log-entry">{log}</div>
              ))}
            </div>
          ) : (
            <div className="vs-display">VS</div>
          )}
        </div>
        
        <div className="battlefield opponent-side">
          <div className="side-label">敌方阵容</div>
          {renderBattleGrid(gamePhase === 'preparation' ? [] : opponentUnits, false)}
        </div>
      </div>
      
      {/* 底部控制区 */}
      <div className="arena-battle-bottom">
        <div className={`bench-area ${showShop ? 'expanded' : 'collapsed'}`}>
          <div className="bench-header" onClick={() => setShowShop(!showShop)}>
            <span>备战区 ({playerBench.length}/9)</span>
            <span className="toggle-icon">{showShop ? '▼' : '▲'}</span>
          </div>
          
          {showShop && (
            <>
              <div className="bench-units">
                {playerBench.map(unit => (
                  <div
                    key={unit.id}
                    className={`bench-unit star-${unit.star} rarity-${unit.rarity} ${selectedUnit?.id === unit.id ? 'selected' : ''}`}
                    onClick={() => setSelectedUnit(selectedUnit?.id === unit.id ? null : unit)}
                  >
                    {unit.imageUri && (
                      <div className="unit-image">
                        <img src={unit.imageUri} alt={unit.name} />
                      </div>
                    )}
                    <div className="unit-stars">{'⭐'.repeat(unit.star)}</div>
                    <div className="unit-name">{unit.name}</div>
                    <div className="unit-stats">
                      <span>⚔️{unit.attack}</span>
                      <span>❤️{unit.health}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 商店 */}
              {gamePhase === 'preparation' && (
                <div className="shop-area">
                  <div className="shop-header">
                    <span>🛒 商店</span>
                    <button
                      className="refresh-btn"
                      onClick={handleRefreshShop}
                      disabled={!freeRefresh && playerGold < 2}
                    >
                      🔄 {freeRefresh ? '免费' : '2金币'}
                    </button>
                  </div>
                  <div className="shop-cards">
                    {shopCards.map((cardData, i) => {
                      const { instance, template } = cardData
                      if (!template) return null
                      return (
                        <div
                          key={i}
                          className={`shop-card rarity-${template.rarity}`}
                          onClick={() => buyCard(cardData)}
                        >
                          {template.imageUri && (
                            <div className="card-image">
                              <img src={template.imageUri} alt={template.name} />
                            </div>
                          )}
                          <div className="card-rarity">{RarityNames[template.rarity as Rarity]}</div>
                          <div className="card-name">{template.name}</div>
                          <div className="card-stats">
                            <span>⚔️{instance.attack}</span>
                            <span>❤️{instance.health}</span>
                          </div>
                          <div className="card-price">💰 {CARD_PRICES[template.rarity as Rarity]}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="gold-display">
          <span className="gold-icon">💰</span>
          <span className="gold-amount">{playerGold}</span>
          {playerWinStreak > 0 && (
            <span className="streak">🔥{playerWinStreak}连胜</span>
          )}
        </div>
      </div>
      
      <button className="exit-btn" onClick={returnToLobby}>退出</button>
    </div>
  )

  // 渲染游戏结束
  const renderGameOver = () => (
    <div className="arena-gameover-screen">
      <h2>{playerHP <= 0 ? '💔 游戏结束' : '🎉 胜利！'}</h2>
      <div className="final-stats">
        <div>坚持了 {round} 回合</div>
        <div>最高连胜: {playerWinStreak}</div>
      </div>
      <button className="return-btn" onClick={returnToLobby}>返回大厅</button>
    </div>
  )

  return (
    <div className="arena-battle-container">
      {gamePhase === 'matching' && renderMatching()}
      {(gamePhase === 'preparation' || gamePhase === 'battle' || gamePhase === 'settlement') && renderGame()}
      {gamePhase === 'gameover' && renderGameOver()}
    </div>
  )
}

export default ArenaBattle
