import { useState, useEffect, useCallback, useRef } from 'react'
import '../css/Battle.css'
import {
  getPlayerDecks,
  type PlayerProfile,
  type PlayerDeck,
  type CardTemplate,
  type CardInstance,
  getPlayerCardsWithTemplates,
  Rarity,
  RarityNames,
  TraitTypeNames,
} from '../services/contract'
import {
  battleSocket,
  type BattleMessage,
  type MatchFoundPayload,
  type RoundStartPayload,
  type BattleStartPayload,
  type BattleUnitData,
} from '../services/battleSocket'

interface BattleProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
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
  star: number // 1-3星
  position: number | null // 0-5 战场位置，null 表示在备战区
}

// 游戏阶段
type GamePhase = 'lobby' | 'matching' | 'preparation' | 'battle' | 'settlement' | 'gameover'

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



function Battle({ onBack, playerProfile }: BattleProps) {
  // 基础状态
  const [savedDecks, setSavedDecks] = useState<PlayerDeck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<PlayerDeck | null>(null)
  const [playerCards, setPlayerCards] = useState<{ instance: CardInstance; template: CardTemplate | null }[]>([])
  
  // 游戏状态
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby')
  const [round, setRound] = useState(1)
  const [timer, setTimer] = useState(30)
  
  // 玩家状态
  const [playerHP, setPlayerHP] = useState(100)
  const [playerGold, setPlayerGold] = useState(10)
  const [playerWinStreak, setPlayerWinStreak] = useState(0)
  const [playerUnits, setPlayerUnits] = useState<BattleUnit[]>([]) // 战场 + 备战区
  const [playerBench, setPlayerBench] = useState<BattleUnit[]>([]) // 备战区
  
  // 对手状态
  const [opponentHP, setOpponentHP] = useState(100)
  const [opponentUnits, setOpponentUnits] = useState<BattleUnit[]>([])
  const [opponentName, setOpponentName] = useState('等待对手...')
  
  // 商店状态
  const [shopCards, setShopCards] = useState<CardTemplate[]>([])
  const [deckCards, setDeckCards] = useState<CardTemplate[]>([]) // 玩家的10张卡组
  const [freeRefresh, setFreeRefresh] = useState(true)
  
  // UI 状态
  const [showShop, setShowShop] = useState(true)
  const [selectedUnit, setSelectedUnit] = useState<BattleUnit | null>(null)
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [roundResult, setRoundResult] = useState<RoundResult>(null)
  
  // WebSocket 状态
  const [wsConnected, setWsConnected] = useState(false)
  const [useOnlineMode, setUseOnlineMode] = useState(true) // true = 线上匹配, false = AI对战
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // 加载卡组
  useEffect(() => {
    if (playerProfile) {
      loadSavedDecks()
      loadPlayerCards()
    }
  }, [playerProfile])

  const loadSavedDecks = async () => {
    if (!playerProfile) return
    try {
      const decks = await getPlayerDecks(playerProfile.wallet)
      setSavedDecks(decks)
      if (decks.length > 0 && !selectedDeck) {
        setSelectedDeck(decks[0])
      }
    } catch (error) {
      console.error('Failed to load saved decks:', error)
    }
  }

  const loadPlayerCards = async () => {
    if (!playerProfile) return
    try {
      const cards = await getPlayerCardsWithTemplates(playerProfile.wallet)
      setPlayerCards(cards)
    } catch (error) {
      console.error('Failed to load player cards:', error)
    }
  }

  // 处理 WebSocket 消息
  const handleWSMessage = useCallback((message: BattleMessage) => {
    console.log('📨 WS Message:', message.type, message.payload)
    
    switch (message.type) {
      case 'matching_started':
        console.log('🔍 Matching started...')
        break
        
      case 'match_found': {
        const payload = message.payload as MatchFoundPayload
        setOpponentName(payload.opponent.name)
        setGamePhase('preparation')
        initializeGame()
        break
      }
      
      case 'matching_cancelled':
        setGamePhase('lobby')
        break
        
      case 'round_start': {
        const payload = message.payload as RoundStartPayload
        setRound(payload.round)
        setTimer(payload.timer)
        break
      }
      
      case 'timer_update': {
        const payload = message.payload as { timer: number }
        setTimer(payload.timer)
        break
      }
      
      case 'battle_start': {
        const payload = message.payload as BattleStartPayload
        // 设置对手单位
        const oppUnits: BattleUnit[] = payload.opponentUnits.map(u => ({
          ...u,
          maxHealth: u.maxHealth || u.health,
          rarity: Rarity.Common,
          traitType: 0,
          imageUri: '',
        }))
        setOpponentUnits(oppUnits)
        setGamePhase('battle')
        setTimeout(() => executeBattle(), 500)
        break
      }
      
      case 'opponent_disconnected':
        alert('对手已断开连接')
        returnToLobby()
        break
        
      case 'opponent_sync': {
        // 完全同步对手的单位
        const payload = message.payload as { units: BattleUnitData[], bench: BattleUnitData[], gold: number }
        const oppUnits: BattleUnit[] = payload.units.map(u => ({
          ...u,
          maxHealth: u.maxHealth || u.health,
          rarity: Rarity.Common,
          traitType: 0,
          imageUri: '',
        }))
        setOpponentUnits(oppUnits)
        console.log('🔄 Opponent synced:', oppUnits.length, 'units')
        break
      }
        
      case 'opponent_update': {
        // 对手状态更新（可选显示）
        break
      }
    }
  }, [])

  // WebSocket 连接
  const connectWebSocket = useCallback(async () => {
    if (useOnlineMode) {
      try {
        await battleSocket.connect()
        setWsConnected(true)
        
        // 设置玩家信息
        battleSocket.setProfile(
          playerProfile?.username || '玩家',
          playerProfile?.trophies || 1000
        )
        
        // 订阅消息
        unsubscribeRef.current = battleSocket.onMessage(handleWSMessage)
        
        // 开始匹配
        if (selectedDeck) {
          battleSocket.startMatching({
            deckId: selectedDeck.deckIndex.toString(),
            cardMints: selectedDeck.cardMints.map(m => m.toBase58()),
          })
        }
      } catch (error) {
        console.error('WebSocket connection failed:', error)
        // 降级到 AI 模式
        setUseOnlineMode(false)
        startAIMatch()
      }
    } else {
      startAIMatch()
    }
  }, [useOnlineMode, playerProfile, selectedDeck, handleWSMessage])

  // AI 对战模式
  const startAIMatch = useCallback(() => {
    console.log('🤖 Starting AI match...')
    setTimeout(() => {
      if (gamePhase === 'matching') {
        setOpponentName('AI对手')
        setGamePhase('preparation')
        initializeGame()
      }
    }, 1500)
  }, [gamePhase])

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
    
    console.log('🎴 Initializing game...')
    
    if (!selectedDeck || !playerProfile) {
      console.warn('⚠️ No deck or profile!')
      return
    }
    
    // 重新加载玩家卡牌确保数据最新
    let cards = playerCards
    if (cards.length === 0) {
      console.log('🔄 Reloading player cards...')
      cards = await getPlayerCardsWithTemplates(playerProfile.wallet)
      setPlayerCards(cards)
    }
    
    console.log('📦 Selected deck:', selectedDeck.deckName, 'with', selectedDeck.cardMints.length, 'cards')
    console.log('🃏 Player cards loaded:', cards.length)
    
    // 从选中的卡组加载卡牌模板
    const deckTemplates: CardTemplate[] = []
    
    for (const mint of selectedDeck.cardMints) {
      const mintStr = mint.toBase58()
      const card = cards.find(c => c.instance.mint.toBase58() === mintStr)
      console.log('  - Looking for mint:', mintStr.slice(0, 8), '... found:', !!card?.template)
      if (card?.template) {
        deckTemplates.push(card.template)
      }
    }
    
    console.log('✅ Deck templates loaded:', deckTemplates.length)
    
    if (deckTemplates.length === 0) {
      console.warn('⚠️ No cards loaded! Check deck and player cards.')
    }
    
    setDeckCards(deckTemplates)
    // 初始抽卡
    refreshShop(deckTemplates)
  }, [selectedDeck, playerCards, playerProfile])

  // 刷新商店（从10张卡组中随机抽3张）
  const refreshShop = (deck?: CardTemplate[]) => {
    const cards = deck || deckCards
    if (cards.length === 0) return
    
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
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
  const buyCard = (card: CardTemplate) => {
    const price = CARD_PRICES[card.rarity as Rarity]
    if (playerGold < price) return
    
    const newGold = playerGold - price
    setPlayerGold(newGold)
    
    // 创建战斗单位
    const newUnit: BattleUnit = {
      id: `unit_${Date.now()}_${Math.random()}`,
      cardTypeId: card.cardTypeId,
      name: card.name,
      attack: Math.floor((card.minAttack + card.maxAttack) / 2),
      health: Math.floor((card.minHealth + card.maxHealth) / 2),
      maxHealth: Math.floor((card.minHealth + card.maxHealth) / 2),
      rarity: card.rarity,
      traitType: card.traitType,
      imageUri: card.imageUri,
      star: 1,
      position: null,
    }
    
    // 检查是否可以合成
    tryMergeUnit(newUnit, newGold)
  }

  // 尝试合成单位
  const tryMergeUnit = (newUnit: BattleUnit, currentGold?: number) => {
    const allUnits = [...playerUnits, ...playerBench]
    const sameUnits = allUnits.filter(u => u.cardTypeId === newUnit.cardTypeId && u.star === newUnit.star)
    
    if (sameUnits.length >= 2) {
      // 可以合成！移除2个同类单位，升级新单位
      const toRemove = sameUnits.slice(0, 2)
      
      setPlayerUnits(prev => prev.filter(u => !toRemove.includes(u)))
      setPlayerBench(prev => prev.filter(u => !toRemove.includes(u)))
      
      // 升级单位
      const upgradedUnit: BattleUnit = {
        ...newUnit,
        star: newUnit.star + 1,
        attack: Math.floor(newUnit.attack * 1.8),
        health: Math.floor(newUnit.health * 1.8),
        maxHealth: Math.floor(newUnit.maxHealth * 1.8),
      }
      
      // 如果还能继续合成
      if (upgradedUnit.star < 3) {
        tryMergeUnit(upgradedUnit, currentGold)
      } else {
        setPlayerBench(prev => {
          const newBench = [...prev, upgradedUnit]
          // 同步到服务器
          if (wsConnected && currentGold !== undefined) {
            battleSocket.buyCard(currentGold, newBench.map(toUnitData))
          }
          return newBench
        })
      }
    } else {
      // 无法合成，加入备战区
      setPlayerBench(prev => {
        const newBench = [...prev, newUnit]
        // 同步到服务器
        if (wsConnected && currentGold !== undefined) {
          battleSocket.buyCard(currentGold, newBench.map(toUnitData))
        }
        return newBench
      })
    }
  }

  // 刷新商店
  const handleRefreshShop = () => {
    if (freeRefresh) {
      setFreeRefresh(false)
      refreshShop()
    } else if (playerGold >= 2) {
      const newGold = playerGold - 2
      setPlayerGold(newGold)
      refreshShop()
      
      // 同步到服务器
      if (wsConnected) {
        battleSocket.refreshShop(newGold)
      }
    }
  }

  // 放置单位到战场
  const placeUnit = (unit: BattleUnit, position: number) => {
    // 检查位置是否已被占用
    const occupied = playerUnits.find(u => u.position === position)
    if (occupied) return
    
    // 从备战区移除
    const newBench = playerBench.filter(u => u.id !== unit.id)
    setPlayerBench(newBench)
    
    // 添加到战场
    const placedUnit = { ...unit, position }
    const newUnits = [...playerUnits.filter(u => u.id !== unit.id), placedUnit]
    setPlayerUnits(newUnits)
    
    // 同步到服务器
    if (wsConnected) {
      battleSocket.placeUnit(newUnits.map(toUnitData), newBench.map(toUnitData))
    }
  }

  // 移回备战区
  const removeFromField = (unit: BattleUnit) => {
    const newUnits = playerUnits.filter(u => u.id !== unit.id)
    const newBench = [...playerBench, { ...unit, position: null }]
    
    setPlayerUnits(newUnits)
    setPlayerBench(newBench)
    
    // 同步到服务器
    if (wsConnected) {
      battleSocket.removeUnit(newUnits.map(toUnitData), newBench.map(toUnitData))
    }
  }

  // 倒计时（只在 AI 模式下本地计时）
  useEffect(() => {
    if (gamePhase !== 'preparation') return
    if (useOnlineMode && wsConnected) return // 线上模式由服务器控制
    
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
  }, [gamePhase, useOnlineMode, wsConnected])

  // 开始战斗
  const startBattle = () => {
    setGamePhase('battle')
    setBattleLog([])
    
    // 只在 AI 模式下生成对手单位
    if (!useOnlineMode) {
      generateOpponentUnits()
    }
    
    // 执行自动战斗
    setTimeout(() => executeBattle(), 500)
  }

  // 生成对手单位（AI模拟）
  const generateOpponentUnits = () => {
    const units: BattleUnit[] = []
    const count = Math.min(round + 1, 6)
    
    for (let i = 0; i < count; i++) {
      units.push({
        id: `opponent_${i}`,
        cardTypeId: i + 1,
        name: `敌方单位${i + 1}`,
        attack: 10 + round * 5 + Math.floor(Math.random() * 10),
        health: 20 + round * 8 + Math.floor(Math.random() * 15),
        maxHealth: 20 + round * 8 + Math.floor(Math.random() * 15),
        rarity: Rarity.Common,
        traitType: 0,
        imageUri: '',
        star: 1,
        position: i,
      })
    }
    
    setOpponentUnits(units)
  }

  // 执行战斗
  const executeBattle = async () => {
    const myUnits = [...playerUnits].filter(u => u.position !== null)
    const enemyUnits = [...opponentUnits]
    const logs: string[] = []
    
    logs.push(`⚔️ 第 ${round} 回合战斗开始！`)
    
    // 简单的回合制战斗
    let turnCount = 0
    while (myUnits.some(u => u.health > 0) && enemyUnits.some(u => u.health > 0) && turnCount < 50) {
      turnCount++
      
      // 我方攻击
      for (const unit of myUnits) {
        if (unit.health <= 0) continue
        const target = enemyUnits.find(e => e.health > 0)
        if (!target) break
        
        target.health -= unit.attack
        logs.push(`${unit.name}⭐${unit.star} 攻击 ${target.name}，造成 ${unit.attack} 伤害`)
        
        if (target.health <= 0) {
          logs.push(`💀 ${target.name} 被击败！`)
        }
      }
      
      // 敌方攻击
      for (const enemy of enemyUnits) {
        if (enemy.health <= 0) continue
        const target = myUnits.find(u => u.health > 0)
        if (!target) break
        
        target.health -= enemy.attack
        logs.push(`${enemy.name} 攻击 ${target.name}⭐${target.star}，造成 ${enemy.attack} 伤害`)
        
        if (target.health <= 0) {
          logs.push(`💀 ${target.name}⭐${target.star} 被击败！`)
        }
      }
      
      // 更新状态
      setPlayerUnits([...myUnits])
      setOpponentUnits([...enemyUnits])
      setBattleLog([...logs])
      
      await new Promise(r => setTimeout(r, 300))
    }
    
    // 判定结果
    const myAlive = myUnits.filter(u => u.health > 0).length
    const enemyAlive = enemyUnits.filter(u => u.health > 0).length
    
    let result: RoundResult
    if (myAlive > 0 && enemyAlive === 0) {
      result = 'win'
      logs.push('🎉 胜利！')
    } else if (myAlive === 0 && enemyAlive > 0) {
      result = 'lose'
      logs.push('💔 失败...')
    } else {
      result = 'draw'
      logs.push('🤝 平局')
    }
    
    setBattleLog([...logs])
    setRoundResult(result)
    
    setTimeout(() => settleRound(result), 1500)
  }

  // 结算回合
  const settleRound = (result: RoundResult) => {
    setGamePhase('settlement')
    
    let goldGain = 5 + round // 基础收入
    let hpLoss = 0
    
    if (result === 'win') {
      const newStreak = playerWinStreak + 1
      setPlayerWinStreak(newStreak)
      goldGain += WIN_STREAK_BONUS[Math.min(newStreak, 5)]
    } else if (result === 'lose') {
      setPlayerWinStreak(0)
      hpLoss = round * round // 回合数的平方
      goldGain += 4 // 失败补偿
    } else {
      // 平局
      hpLoss = Math.floor(round * round / 2)
    }
    
    setPlayerGold(prev => prev + goldGain)
    
    if (hpLoss > 0) {
      const newHP = Math.max(0, playerHP - hpLoss)
      setPlayerHP(newHP)
      
      if (newHP <= 0) {
        setGamePhase('gameover')
        return
      }
    }
    
    // 模拟对手扣血
    if (result === 'win') {
      const oppHpLoss = round * round
      setOpponentHP(prev => Math.max(0, prev - oppHpLoss))
    }
    
    // 2秒后进入下一回合
    setTimeout(() => {
      setRound(prev => prev + 1)
      setTimer(30)
      setFreeRefresh(true)
      setRoundResult(null)
      refreshShop()
      
      // 恢复单位血量
      setPlayerUnits(prev => prev.map(u => ({ ...u, health: u.maxHealth })))
      
      setGamePhase('preparation')
    }, 2000)
  }

  // 开始匹配
  const startMatching = () => {
    if (!selectedDeck) {
      alert('请先选择一个卡组！')
      return
    }
    setGamePhase('matching')
    connectWebSocket()
  }

  // 返回大厅
  const returnToLobby = () => {
    setGamePhase('lobby')
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    battleSocket.disconnect()
    setWsConnected(false)
  }

  // 渲染大厅
  const renderLobby = () => (
    <div className="battle-lobby">
      <div className="lobby-header">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <h2>⚔️ 排位赛</h2>
      </div>
      
      {/* 模式选择 */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${useOnlineMode ? 'active' : ''}`}
          onClick={() => setUseOnlineMode(true)}
        >
          🌐 线上匹配
        </button>
        <button
          className={`mode-btn ${!useOnlineMode ? 'active' : ''}`}
          onClick={() => setUseOnlineMode(false)}
        >
          🤖 AI对战
        </button>
      </div>
      
      <div className="deck-selection">
        <h3>选择出战卡组</h3>
        {savedDecks.length === 0 ? (
          <div className="no-deck">请先在「组队」页面创建卡组</div>
        ) : (
          <div className="deck-list">
            {savedDecks.map(deck => (
              <div
                key={deck.deckIndex}
                className={`deck-item ${selectedDeck?.deckIndex === deck.deckIndex ? 'selected' : ''}`}
                onClick={() => setSelectedDeck(deck)}
              >
                <span className="deck-name">{deck.deckName}</span>
                <span className="deck-count">{deck.cardMints.length}张</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <button
        className="start-match-btn"
        disabled={!selectedDeck}
        onClick={startMatching}
      >
        {useOnlineMode ? '🎯 开始匹配' : '🤖 开始AI对战'}
      </button>
      
      <div className="battle-rules">
        <h4>游戏规则</h4>
        <ul>
          <li>从10张卡组中抽卡组建战斗阵容</li>
          <li>3个相同单位可合成更高星级</li>
          <li>每回合30秒备战时间</li>
          <li>失败扣血 = 回合数²</li>
        </ul>
      </div>
    </div>
  )

  // 渲染匹配中
  const renderMatching = () => (
    <div className="matching-screen">
      <div className="matching-spinner"></div>
      <h2>正在匹配对手...</h2>
      <button className="cancel-btn" onClick={returnToLobby}>取消</button>
    </div>
  )

  // 渲染战场格子
  const renderBattleGrid = (units: BattleUnit[], isPlayer: boolean) => (
    <div className={`battle-grid ${isPlayer ? 'player' : 'opponent'}`}>
      {[0, 1, 2, 3, 4, 5].map(pos => {
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
                <div className="unit-stars">{'⭐'.repeat(unit.star)}</div>
                <div className="unit-name">{unit.name}</div>
                <div className="unit-stats">
                  <span className="atk">⚔️{unit.attack}</span>
                  <span className="hp">❤️{unit.health}/{unit.maxHealth}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // 渲染游戏界面
  const renderGame = () => (
    <div className="battle-arena">
      {/* 顶部信息栏 */}
      <div className="battle-header">
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
                {roundResult === 'win' && '🎉 胜利！'}
                {roundResult === 'lose' && '💔 失败'}
                {roundResult === 'draw' && '🤝 平局'}
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
      <div className="battle-main">
        {/* 左侧 - 玩家战场 */}
        <div className="battlefield player-side">
          <div className="side-label">我方阵容</div>
          {renderBattleGrid(playerUnits, true)}
        </div>
        
        {/* 中间 - 战斗日志 */}
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
        
        {/* 右侧 - 对手战场 */}
        <div className="battlefield opponent-side">
          <div className="side-label">敌方阵容</div>
          {renderBattleGrid(opponentUnits, false)}
        </div>
      </div>
      
      {/* 底部控制区 */}
      <div className="battle-bottom">
        {/* 备战区 */}
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
                    {shopCards.map((card, i) => (
                      <div
                        key={i}
                        className={`shop-card rarity-${card.rarity}`}
                        onClick={() => buyCard(card)}
                      >
                        <div className="card-rarity">{RarityNames[card.rarity as Rarity]}</div>
                        <div className="card-name">{card.name}</div>
                        <div className="card-type">{TraitTypeNames[card.traitType]}</div>
                        <div className="card-stats">
                          <span>⚔️{Math.floor((card.minAttack + card.maxAttack) / 2)}</span>
                          <span>❤️{Math.floor((card.minHealth + card.maxHealth) / 2)}</span>
                        </div>
                        <div className="card-price">💰 {CARD_PRICES[card.rarity as Rarity]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* 右下角金币显示 */}
        <div className="gold-display">
          <span className="gold-icon">💰</span>
          <span className="gold-amount">{playerGold}</span>
          {playerWinStreak > 0 && (
            <span className="streak">🔥{playerWinStreak}连胜</span>
          )}
        </div>
      </div>
      
      {/* 退出按钮 */}
      <button className="exit-btn" onClick={returnToLobby}>退出</button>
    </div>
  )

  // 渲染游戏结束
  const renderGameOver = () => (
    <div className="gameover-screen">
      <h2>{playerHP <= 0 ? '💔 游戏结束' : '🎉 胜利！'}</h2>
      <div className="final-stats">
        <div>坚持了 {round} 回合</div>
        <div>最高连胜: {playerWinStreak}</div>
      </div>
      <button className="return-btn" onClick={returnToLobby}>返回大厅</button>
    </div>
  )

  return (
    <div className="battle-container">
      {gamePhase === 'lobby' && renderLobby()}
      {gamePhase === 'matching' && renderMatching()}
      {(gamePhase === 'preparation' || gamePhase === 'battle' || gamePhase === 'settlement') && renderGame()}
      {gamePhase === 'gameover' && renderGameOver()}
    </div>
  )
}

export default Battle
