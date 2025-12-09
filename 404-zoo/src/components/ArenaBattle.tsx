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
  type BattleUnitData,
  type BattleAttackPayload,
  type BattleUnitsUpdatePayload,
  type BattleResultPayload,
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
  [Rarity.Common]: 3,
  [Rarity.Rare]: 5,
  [Rarity.Legendary]: 7,
}

// 卡牌出售价格（购买价格的一半，向下取整）
const CARD_SELL_PRICES: Record<Rarity, number> = {
  [Rarity.Common]: 1,
  [Rarity.Rare]: 2,
  [Rarity.Legendary]: 3,
}

// 备战区最大容量
const MAX_BENCH_SIZE = 9

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
  
  // 我是 P1 还是 P2
  const [myPlayerId, setMyPlayerId] = useState<'p1' | 'p2'>('p1')
  
  // Refs
  const selectedDeckRef = useRef(selectedDeck)
  const playerProfileRef = useRef(playerProfile)
  const playerUnitsRef = useRef<BattleUnit[]>([])
  const opponentUnitsRef = useRef<BattleUnit[]>([])
  const roundRef = useRef(round)
  const preBattleUnitsRef = useRef<BattleUnit[]>([])
  const playerHPRef = useRef(playerHP)
  const playerWinStreakRef = useRef(playerWinStreak)
  const handleWSMessageRef = useRef<(message: BattleMessage) => void>(() => {})
  
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
        const payload = message.payload as MatchFoundPayload & { playerId?: 'p1' | 'p2' }
        console.log('🎯 Match found! Opponent:', payload.opponent.name)
        setOpponentName(payload.opponent.name)
        // 服务器会告诉我们是 p1 还是 p2
        if (payload.playerId) {
          setMyPlayerId(payload.playerId)
        }
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
        setRound(payload.round)
        setTimer(payload.timer)
        setFreeRefresh(true)
        setRoundResult(null)
        setGamePhase('preparation')
        
        // 恢复单位血量
        const savedUnits = preBattleUnitsRef.current
        if (savedUnits.length > 0) {
          const restoredUnits = savedUnits.map(u => ({ ...u, health: u.maxHealth }))
          setPlayerUnits(restoredUnits)
          playerUnitsRef.current = restoredUnits
        }
        break
      }
      
      case 'timer_update': {
        const payload = message.payload as { timer: number }
        setTimer(payload.timer)
        break
      }
      
      case 'battle_start': {
        console.log('⚔️ Battle starting from server')
        
        // 保存战斗前状态
        preBattleUnitsRef.current = playerUnitsRef.current.map(u => ({ ...u }))
        
        setBattleLog([])
        setGamePhase('battle')
        break
      }
      
      case 'battle_log': {
        // 服务器发来的战斗日志
        const payload = message.payload as { log: string }
        setBattleLog(prev => [...prev, payload.log])
        break
      }
      
      case 'battle_attack': {
        // 服务器发来的攻击事件
        const payload = message.payload as BattleAttackPayload
        setBattleLog(prev => [...prev, payload.log])
        break
      }
      
      case 'battle_units_update': {
        // 服务器同步单位状态
        const payload = message.payload as BattleUnitsUpdatePayload
        ;(async () => {
          const allTemplates = await getCachedCards()
          
          // 根据我是 p1 还是 p2 来决定哪边是我方
          const myUnitsData = myPlayerId === 'p1' ? payload.p1Units : payload.p2Units
          const oppUnitsData = myPlayerId === 'p1' ? payload.p2Units : payload.p1Units
          
          const myUnits: BattleUnit[] = myUnitsData.map(u => {
            const template = allTemplates.find(t => t.cardTypeId === u.cardTypeId)
            return {
              ...u,
              maxHealth: u.maxHealth || u.health,
              rarity: template?.rarity ?? Rarity.Common,
              traitType: template?.traitType ?? 0,
              imageUri: template ? getImageUrl(template.imageUri) : '',
            }
          })
          
          const oppUnits: BattleUnit[] = oppUnitsData.map(u => {
            const template = allTemplates.find(t => t.cardTypeId === u.cardTypeId)
            return {
              ...u,
              maxHealth: u.maxHealth || u.health,
              rarity: template?.rarity ?? Rarity.Common,
              traitType: template?.traitType ?? 0,
              imageUri: template ? getImageUrl(template.imageUri) : '',
            }
          })
          
          setPlayerUnits(myUnits)
          setOpponentUnits(oppUnits)
        })()
        break
      }
      
      case 'battle_result': {
        // 服务器发来的战斗结果
        const payload = message.payload as BattleResultPayload
        console.log('📊 Battle result:', payload)
        
        setPlayerHP(payload.myHP)
        setOpponentHP(payload.opponentHP)
        setRoundResult(payload.result)
        
        // 更新连胜
        if (payload.result === 'win') {
          setPlayerWinStreak(prev => prev + 1)
        } else {
          setPlayerWinStreak(0)
        }
        
        // 更新金币
        const goldGain = 5 + payload.round + (payload.result === 'win' ? WIN_STREAK_BONUS[Math.min(playerWinStreak + 1, 5)] : 4)
        setPlayerGold(prev => prev + goldGain)
        
        setGamePhase('settlement')
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
      
      case 'game_over': {
        const payload = message.payload as { winner: string, p1HP: number, p2HP: number }
        console.log('🏆 Game over! Winner:', payload.winner)
        setGamePhase('gameover')
        break
      }
    }
  }, [myPlayerId, playerWinStreak])

  // 更新 ref 以便在 useEffect 中使用最新的 handler
  useEffect(() => {
    handleWSMessageRef.current = handleWSMessage
  }, [handleWSMessage])



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

  // 组件挂载时连接 WebSocket（只执行一次）
  useEffect(() => {
    let isMounted = true
    
    const init = async () => {
      await new Promise(r => setTimeout(r, 50))
      if (!isMounted) return
      
      try {
        await battleSocket.connect()
        if (!isMounted) return
        
        setWsConnected(true)
        
        battleSocket.setProfile(
          playerProfileRef.current?.username || '玩家',
          playerProfileRef.current?.trophies || 1000
        )
        
        unsubscribeRef.current = battleSocket.onMessage((message) => {
          // 使用 ref 获取最新值，避免闭包问题
          handleWSMessageRef.current(message)
        })
        
        battleSocket.startMatching({
          deckId: selectedDeckRef.current.deckIndex.toString(),
          cardMints: selectedDeckRef.current.cardMints.map(m => m.toBase58()),
        })
        console.log('🔍 Waiting for opponent...')
      } catch (error) {
        console.error('WebSocket connection failed:', error)
        alert('无法连接到服务器，请检查网络')
        onBack()
      }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 只在挂载时执行一次

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

  // 检查购买某张卡后是否能触发合成
  const canMergeAfterBuy = (cardTypeId: number): boolean => {
    const allUnits = [...playerUnits, ...playerBench]
    const sameUnits = allUnits.filter(u => u.cardTypeId === cardTypeId && u.star === 1)
    // 如果已有2张相同的1星卡，买第3张可以合成
    return sameUnits.length >= 2
  }

  // 检查是否可以购买某张卡
  const canBuyCard = (cardData: PlayerCardData): boolean => {
    const { template } = cardData
    if (!template) return false
    
    const price = CARD_PRICES[template.rarity as Rarity]
    if (playerGold < price) return false
    
    // 如果备战区未满，可以买
    if (playerBench.length < MAX_BENCH_SIZE) return true
    
    // 备战区满了，只有能触发合成才能买
    return canMergeAfterBuy(template.cardTypeId)
  }

  // 购买卡牌
  const buyCard = (cardData: PlayerCardData) => {
    const { instance, template } = cardData
    if (!template) return
    if (!canBuyCard(cardData)) return
    
    const price = CARD_PRICES[template.rarity as Rarity]
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

  // 卖出单位
  const sellUnit = (unit: BattleUnit) => {
    // 计算卖出价格（星级越高价格越高）
    const basePrice = CARD_SELL_PRICES[unit.rarity as Rarity]
    const sellPrice = basePrice * unit.star
    
    // 从备战区移除
    const newBench = playerBench.filter(u => u.id !== unit.id)
    setPlayerBench(newBench)
    
    // 增加金币
    setPlayerGold(prev => prev + sellPrice)
    
    // 同步给服务器
    if (wsConnected) {
      battleSocket.sendAction('sell_unit', { 
        bench: newBench.map(toUnitData),
        gold: playerGold + sellPrice 
      })
    }
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

  // 检查是否可以移回备战区
  const canRemoveFromField = (): boolean => {
    return playerBench.length < MAX_BENCH_SIZE
  }

  // 移回备战区
  const removeFromField = (unit: BattleUnit) => {
    // 备战区满了不能移回
    if (!canRemoveFromField()) return
    
    const newUnits = playerUnits.filter(u => u.id !== unit.id)
    const newBench = [...playerBench, { ...unit, position: null }]
    
    setPlayerUnits(newUnits)
    setPlayerBench(newBench)
    
    if (wsConnected) {
      battleSocket.removeUnit(newUnits.map(toUnitData), newBench.map(toUnitData))
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

  // 倒计时 - 完全依赖服务器的 timer_update 和 battle_start
  // 不再有离线模式，必须连接服务器才能战斗


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
                    {gamePhase === 'preparation' && (
                      <button
                        className="sell-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          sellUnit(unit)
                        }}
                      >
                        卖出 💰{CARD_SELL_PRICES[unit.rarity as Rarity] * unit.star}
                      </button>
                    )}
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
                      const canBuy = canBuyCard(cardData)
                      return (
                        <div
                          key={i}
                          className={`shop-card rarity-${template.rarity} ${!canBuy ? 'disabled' : ''}`}
                          onClick={() => canBuy && buyCard(cardData)}
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
                          {!canBuy && playerBench.length >= MAX_BENCH_SIZE && (
                            <div className="card-disabled-reason">备战区已满</div>
                          )}
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
