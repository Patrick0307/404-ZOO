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
  type CoinFlipPayload,
} from '../services/battleSocket'

interface ArenaBattleProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
  selectedDeck: PlayerDeck
}

// Battle unit (with star level)
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

// Game phase
type GamePhase = 'matching' | 'preparation' | 'battle' | 'settlement' | 'gameover'

// Round result
type RoundResult = 'win' | 'lose' | 'draw' | null

// Card purchase prices
const CARD_PRICES: Record<Rarity, number> = {
  [Rarity.Common]: 3,
  [Rarity.Rare]: 5,
  [Rarity.Legendary]: 7,
}

// Card sell prices (half of purchase price, rounded down)
const CARD_SELL_PRICES: Record<Rarity, number> = {
  [Rarity.Common]: 1,
  [Rarity.Rare]: 2,
  [Rarity.Legendary]: 3,
}

// Maximum bench capacity
const MAX_BENCH_SIZE = 9

// Win streak bonus
const WIN_STREAK_BONUS = [0, 2, 4, 6, 8, 10]

function ArenaBattle({ onBack, playerProfile, selectedDeck }: ArenaBattleProps) {
  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('matching')
  const [round, setRound] = useState(1)
  const [timer, setTimer] = useState(30)
  
  // Player state
  const [playerHP, setPlayerHP] = useState(100)
  const [playerGold, setPlayerGold] = useState(10)
  const [playerWinStreak, setPlayerWinStreak] = useState(0)
  const [maxWinStreak, setMaxWinStreak] = useState(0)
  const [playerUnits, setPlayerUnits] = useState<BattleUnit[]>([])
  const [playerBench, setPlayerBench] = useState<BattleUnit[]>([])
  
  // Opponent state
  const [opponentHP, setOpponentHP] = useState(100)
  const [opponentUnits, setOpponentUnits] = useState<BattleUnit[]>([])
  const [opponentName, setOpponentName] = useState('Waiting for opponent...')
  
  // Shop state
  const [shopCards, setShopCards] = useState<PlayerCardData[]>([])
  const [deckCards, setDeckCards] = useState<PlayerCardData[]>([])
  const [freeRefresh, setFreeRefresh] = useState(true)
  
  // UI state
  const [showShop, setShowShop] = useState(true)
  const [selectedUnit, setSelectedUnit] = useState<BattleUnit | null>(null)
  const [battleLog, setBattleLog] = useState<string[]>([])
  const [roundResult, setRoundResult] = useState<RoundResult>(null)
  
  // Battle animation state
  const [showCoinFlip, setShowCoinFlip] = useState(false)
  const [coinResult, setCoinResult] = useState<'heads' | 'tails' | null>(null)
  const [firstPlayerName, setFirstPlayerName] = useState<string>('')
  const [attackingUnit, setAttackingUnit] = useState<{ id: string; side: 'p1' | 'p2' } | null>(null)
  const [targetUnit, setTargetUnit] = useState<{ id: string; side: 'p1' | 'p2' } | null>(null)
  const [currentDamage, setCurrentDamage] = useState<number>(0)
  
  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false)
  const wsConnectedRef = useRef(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  
  // Am I P1 or P2
  const [myPlayerId, setMyPlayerId] = useState<'p1' | 'p2'>('p1')
  
  // Refs
  const selectedDeckRef = useRef(selectedDeck)
  const playerProfileRef = useRef(playerProfile)
  const playerUnitsRef = useRef<BattleUnit[]>([])
  const playerBenchRef = useRef<BattleUnit[]>([])
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
  useEffect(() => { playerBenchRef.current = playerBench }, [playerBench])
  useEffect(() => { opponentUnitsRef.current = opponentUnits }, [opponentUnits])
  useEffect(() => { roundRef.current = round }, [round])


  // Handle WebSocket messages
  const handleWSMessage = useCallback((message: BattleMessage) => {
    console.log('WS Message:', message.type, message.payload)
    
    switch (message.type) {
      case 'matching_started':
        console.log('Matching started...')
        break
        
      case 'match_found': {
        const payload = message.payload as MatchFoundPayload & { playerId?: 'p1' | 'p2' }
        console.log('Match found! Opponent:', payload.opponent.name)
        setOpponentName(payload.opponent.name)
        // Server will tell us if we're p1 or p2
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
        console.log(`Round ${payload.round} starting, timer: ${payload.timer}`)
        setRound(payload.round)
        setTimer(payload.timer)
        setFreeRefresh(true)
        setRoundResult(null)
        setGamePhase('preparation')
        
        // Restore unit health - use current playerUnitsRef (server now preserves units)
        const currentUnits = playerUnitsRef.current
        if (currentUnits.length > 0) {
          const restoredUnits = currentUnits.map(u => ({ ...u, health: u.maxHealth }))
          setPlayerUnits(restoredUnits)
          playerUnitsRef.current = restoredUnits
          
          // Sync restored units to server (inline conversion to avoid closure issues)
          if (wsConnectedRef.current) {
            const unitToData = (u: BattleUnit): BattleUnitData => ({
              id: u.id,
              cardTypeId: u.cardTypeId,
              name: u.name,
              attack: u.attack,
              health: u.health,
              maxHealth: u.maxHealth,
              star: u.star,
              position: u.position,
            })
            battleSocket.placeUnit(
              restoredUnits.map(unitToData),
              playerBenchRef.current.map(unitToData)
            )
          }
        }
        break
      }
      
      case 'timer_update': {
        const payload = message.payload as { timer: number }
        setTimer(payload.timer)
        break
      }
      
      case 'coin_flip': {
        const payload = message.payload as CoinFlipPayload
        console.log('Coin flip:', payload)
        setCoinResult(payload.result)
        setFirstPlayerName(payload.firstName)
        setShowCoinFlip(true)
        // 硬币动画会在2秒后自动隐藏
        setTimeout(() => setShowCoinFlip(false), 2500)
        break
      }
      
      case 'battle_start': {
        const payload = message.payload as { round: number; p1Units: BattleUnitData[]; p2Units: BattleUnitData[] }
        console.log('Battle starting from server', payload)
        
        // Save pre-battle state
        preBattleUnitsRef.current = playerUnitsRef.current.map(u => ({ ...u }))
        
        // Set opponent units from server data
        ;(async () => {
          const allTemplates = await getCachedCards()
          const oppUnitsData = myPlayerId === 'p1' ? payload.p2Units : payload.p1Units
          
          const oppUnits: BattleUnit[] = (oppUnitsData || []).map(u => {
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
        
        setBattleLog([])
        setGamePhase('battle')
        break
      }
      
      case 'battle_log': {
        // Battle log from server
        const payload = message.payload as { log: string }
        setBattleLog(prev => [...prev, payload.log])
        break
      }
      
      case 'battle_attack': {
        // Attack event from server
        const payload = message.payload as BattleAttackPayload
        setBattleLog(prev => [...prev, payload.log])
        
        // 设置攻击动画状态
        const attackerSide = payload.attacker.side as 'p1' | 'p2'
        const targetSide = payload.target.side as 'p1' | 'p2'
        
        setAttackingUnit({ id: payload.attacker.id, side: attackerSide })
        setTargetUnit({ id: payload.target.id, side: targetSide })
        setCurrentDamage(payload.damage)
        
        // 1.2秒后清除动画状态
        setTimeout(() => {
          setAttackingUnit(null)
          setTargetUnit(null)
          setCurrentDamage(0)
        }, 1200)
        break
      }
      
      case 'battle_units_update': {
        // Server syncs unit status
        const payload = message.payload as BattleUnitsUpdatePayload
        ;(async () => {
          const allTemplates = await getCachedCards()
          
          // Determine which side is mine based on whether I'm p1 or p2
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
        // Battle result from server
        const payload = message.payload as BattleResultPayload
        console.log('Battle result:', payload)
        
        setPlayerHP(payload.myHP)
        setOpponentHP(payload.opponentHP)
        setRoundResult(payload.result)
        
        // Update win streak
        if (payload.result === 'win') {
          setPlayerWinStreak(prev => {
            const newStreak = prev + 1
            setMaxWinStreak(max => Math.max(max, newStreak))
            return newStreak
          })
        } else {
          setPlayerWinStreak(0)
        }
        
        // Update gold
        const goldGain = 5 + payload.round + (payload.result === 'win' ? WIN_STREAK_BONUS[Math.min(playerWinStreak + 1, 5)] : 4)
        setPlayerGold(prev => prev + goldGain)
        
        setGamePhase('settlement')
        break
      }
      
      case 'opponent_disconnected':
        alert('Opponent has disconnected')
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
        console.log('Game over! Winner:', payload.winner)
        setGamePhase('gameover')
        break
      }
      
      case 'trophy_updated': {
        const payload = message.payload as { type: 'win' | 'lose', txId?: string }
        console.log(`🏆 Trophy updated on blockchain: ${payload.type}, tx: ${payload.txId}`)
        // Trophy update is handled by the contract, player profile will be refreshed when returning to lobby
        break
      }
    }
  }, [myPlayerId, playerWinStreak])

  // Update ref to use latest handler in useEffect
  useEffect(() => {
    handleWSMessageRef.current = handleWSMessage
  }, [handleWSMessage])



  // Generate opponent units (for local testing or when server doesn't provide)
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
          name: `Enemy Unit ${i + 1}`,
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

  // Initialize game
  const initializeGame = useCallback(async () => {
    setRound(1)
    setPlayerHP(100)
    setOpponentHP(100)
    setPlayerGold(10)
    setPlayerWinStreak(0)
    setMaxWinStreak(0)
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
    
    // Pre-generate opponent (server will override)
    await generateOpponentUnits(1)
  }, [generateOpponentUnits])

  // Connect WebSocket when component mounts (execute only once)
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
          playerProfileRef.current?.username || 'Player',
          playerProfileRef.current?.trophies || 1000,
          playerProfileRef.current?.wallet?.toBase58()
        )
        
        unsubscribeRef.current = battleSocket.onMessage((message) => {
          // Use ref to get latest values, avoid closure issues
          handleWSMessageRef.current(message)
        })
        
        battleSocket.startMatching({
          deckId: selectedDeckRef.current.deckIndex.toString(),
          cardMints: selectedDeckRef.current.cardMints.map(m => m.toBase58()),
        })
        console.log('Waiting for opponent...')
      } catch (error) {
        console.error('WebSocket connection failed:', error)
        alert('Unable to connect to server, please check network')
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
  }, []) // Execute only once on mount

  // Refresh shop
  const refreshShop = () => {
    if (deckCards.length === 0) return
    const shuffled = [...deckCards].sort(() => Math.random() - 0.5)
    setShopCards(shuffled.slice(0, 3))
  }

  // Convert to network data format
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

  // Check if buying a card can trigger synthesis
  const canMergeAfterBuy = (cardTypeId: number): boolean => {
    const allUnits = [...playerUnits, ...playerBench]
    const sameUnits = allUnits.filter(u => u.cardTypeId === cardTypeId && u.star === 1)
    // If already have 2 identical 1-star cards, buying the 3rd can synthesize
    return sameUnits.length >= 2
  }

  // Check if a card can be purchased
  const canBuyCard = (cardData: PlayerCardData): boolean => {
    const { template } = cardData
    if (!template) return false
    
    const price = CARD_PRICES[template.rarity as Rarity]
    if (playerGold < price) return false
    
    // If bench is not full, can buy
    if (playerBench.length < MAX_BENCH_SIZE) return true
    
    // If bench is full, can only buy if it triggers synthesis
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

  // Sell unit
  const sellUnit = (unit: BattleUnit) => {
    // Calculate sell price (higher star level = higher price)
    const basePrice = CARD_SELL_PRICES[unit.rarity as Rarity]
    const sellPrice = basePrice * unit.star
    
    // Remove from bench
    const newBench = playerBench.filter(u => u.id !== unit.id)
    setPlayerBench(newBench)
    
    // Add gold
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
  const tryMergeUnit = (newUnit: BattleUnit, currentGold?: number, currentFieldUnits?: BattleUnit[], currentBenchUnits?: BattleUnit[]) => {
    // Use passed values or current state
    const fieldUnits = currentFieldUnits ?? playerUnits
    const benchUnits = currentBenchUnits ?? playerBench
    
    // First check if can synthesize (no extra space needed)
    const allUnits = [...fieldUnits, ...benchUnits]
    const sameUnits = allUnits.filter(u => u.cardTypeId === newUnit.cardTypeId && u.star === newUnit.star)
    
    // 如果能合成（已有2个相同的），则可以继续
    const canMerge = sameUnits.length >= 2 && newUnit.star < 3
    
    // If can't synthesize and bench is full, don't add
    if (!canMerge && benchUnits.length >= MAX_BENCH_SIZE) {
      console.warn('Bench is full, cannot add unit')
      return
    }
    
    const updatedBench = [...benchUnits, newUnit]
    const allUnitsWithNew = [...fieldUnits, ...updatedBench]
    const sameUnitsWithNew = allUnitsWithNew.filter(u => u.cardTypeId === newUnit.cardTypeId && u.star === newUnit.star)
    
    if (sameUnitsWithNew.length >= 3 && newUnit.star < 3) {
      const toRemove = sameUnitsWithNew.slice(0, 3)
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
      
      const newFieldUnits = fieldUnits.filter(u => !toRemoveIds.has(u.id))
      const newBenchUnits = updatedBench.filter(u => !toRemoveIds.has(u.id))
      
      setPlayerUnits(newFieldUnits)
      playerUnitsRef.current = newFieldUnits
      setPlayerBench(newBenchUnits)
      playerBenchRef.current = newBenchUnits
      
      setTimeout(() => tryMergeUnit(upgradedUnit, currentGold, newFieldUnits, newBenchUnits), 100)
    } else {
      // Check again to ensure not exceeding limit
      if (updatedBench.length <= MAX_BENCH_SIZE) {
        setPlayerBench(updatedBench)
        playerBenchRef.current = updatedBench
        
        // Sync both units and bench to server after merge completes
        if (wsConnected && currentGold !== undefined) {
          battleSocket.sendAction('buy_card', {
            gold: currentGold,
            units: fieldUnits.map(toUnitData),
            bench: updatedBench.map(toUnitData)
          })
        }
      }
    }
  }

  // Refresh shop button
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
      console.log('Sending placeUnit:', unitsData.length, 'units')
      battleSocket.placeUnit(unitsData, newBench.map(toUnitData))
    }
  }

  // Check if can move back to bench
  const canRemoveFromField = (): boolean => {
    return playerBench.length < MAX_BENCH_SIZE
  }

  // Move back to bench
  const removeFromField = (unit: BattleUnit) => {
    // Can't move back if bench is full
    if (!canRemoveFromField()) return
    
    const newUnits = playerUnits.filter(u => u.id !== unit.id)
    const newBench = [...playerBench, { ...unit, position: null }]
    
    setPlayerUnits(newUnits)
    setPlayerBench(newBench)
    
    if (wsConnected) {
      battleSocket.removeUnit(newUnits.map(toUnitData), newBench.map(toUnitData))
    }
  }



  // Return to lobby
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

  // Refresh shop when round changes
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
      <h2>Matching</h2>
      <h2>opponents</h2>
      <h2>...</h2>
      <button className="cancel-btn" onClick={returnToLobby}>Cancel</button>
    </div>
  )

  // 渲染战场格子
  // 渲染单个格子
  const renderGridCell = (pos: number, units: BattleUnit[], isPlayer: boolean) => {
    const unit = units.find(u => u.position === pos)
    const healthPercent = unit ? Math.max(0, (unit.health / unit.maxHealth) * 100) : 0
    const isDead = unit && unit.health <= 0
    
    // 判断当前单位是否正在攻击或被攻击
    const unitSide = isPlayer ? myPlayerId : (myPlayerId === 'p1' ? 'p2' : 'p1')
    const isAttacking = unit && attackingUnit?.id === unit.id && attackingUnit?.side === unitSide
    const isBeingAttacked = unit && targetUnit?.id === unit.id && targetUnit?.side === unitSide
    
    return (
      <div
        key={pos}
        className={`grid-cell ${unit ? 'occupied' : 'empty'} ${isDead ? 'dead' : ''}`}
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
            className={`unit-card star-${unit.star} rarity-${unit.rarity} ${isDead ? 'dead' : ''} ${isAttacking ? 'attacking' : ''} ${isBeingAttacked ? 'being-attacked' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (isPlayer && gamePhase === 'preparation') {
                removeFromField(unit)
              }
            }}
          >
            <div className="unit-stars-vertical">
              {Array.from({ length: unit.star }).map((_, i) => (
                <span key={i} className="star">★</span>
              ))}
            </div>
            {unit.imageUri && (
              <div className="unit-image">
                <img src={unit.imageUri} alt={unit.name} />
              </div>
            )}
            {/* 血条 */}
            <div className="unit-health-bar">
              <div 
                className="unit-health-fill" 
                style={{ width: `${healthPercent}%` }}
              />
              <span className="unit-health-text">{Math.max(0, unit.health)}/{unit.maxHealth}</span>
            </div>
            {/* 攻击力显示 */}
            <div className="unit-attack">⚔{unit.attack}</div>
            {/* 伤害数字显示 */}
            {isBeingAttacked && currentDamage > 0 && (
              <div className="damage-number">-{currentDamage}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  // 渲染战场格子 - 两列三行布局 (3x2)
  // 玩家: [4][1] / [5][2] / [6][3] (后排在左，前排在右)
  // 对手(镜像): [1][4] / [2][5] / [3][6] (前排在左，后排在右)
  const renderBattleGrid = (units: BattleUnit[], isPlayer: boolean) => {
    const rows = isPlayer
      ? [[3, 0], [4, 1], [5, 2]]  // 玩家: 后排(3,4,5)在左，前排(0,1,2)在右
      : [[0, 3], [1, 4], [2, 5]] // 对手镜像: 前排在左，后排在右
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
          <div className="round-number">Round {round}</div>
          <div className="phase-indicator">
            {gamePhase === 'preparation' && `Preparation ${timer}s`}
            {gamePhase === 'battle' && 'Battle in progress...'}
            {gamePhase === 'settlement' && (
              <span className={`result ${roundResult}`}>
                {roundResult === 'win' && 'Victory! Waiting for opponent...'}
                {roundResult === 'lose' && 'Defeat Waiting for opponent...'}
                {roundResult === 'draw' && 'Draw Waiting for opponent...'}
                {!roundResult && 'Waiting for opponent...'}
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
          <div className="side-label">Our Lineup</div>
          {renderBattleGrid(playerUnits, true)}
        </div>
        
        <div className="battle-center">
          {showCoinFlip ? (
            <div className="coin-flip-container">
              <div className={`coin ${coinResult}`}>
                <div className="coin-face heads">P1</div>
                <div className="coin-face tails">P2</div>
              </div>
              <div className="coin-result-text">
                {coinResult === 'heads' ? '正面' : '反面'}！
                <br />
                {firstPlayerName} 先手
              </div>
            </div>
          ) : (
            <div className="vs-display">VS</div>
          )}
        </div>
        
        <div className="battlefield opponent-side">
          <div className="side-label">Opponent's Lineup</div>
          {renderBattleGrid(gamePhase === 'preparation' ? [] : opponentUnits, false)}
        </div>
      </div>
      
      {/* 底部控制区 */}
      <div className="arena-battle-bottom">
        <div className={`bench-area ${showShop ? 'expanded' : 'collapsed'}`}>
          <div className="bench-header" onClick={() => setShowShop(!showShop)}>
            <span>Bench ({playerBench.length}/9)</span>
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
                    <div className="unit-stars">{'★'.repeat(unit.star)}</div>
                    <div className="unit-name">{unit.name}</div>
                    <div className="unit-stats">
                      <span>ATK:{unit.attack}</span>
                      <span>HP:{unit.health}</span>
                    </div>
                    {gamePhase === 'preparation' && (
                      <button
                        className="sell-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          sellUnit(unit)
                        }}
                      >
                        Sell ${CARD_SELL_PRICES[unit.rarity as Rarity] * unit.star}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Shop */}
              {gamePhase === 'preparation' && (
                <div className="shop-area">
                  <div className="shop-header">
                    <span>SHOP</span>
                    <button
                      className="refresh-btn"
                      onClick={handleRefreshShop}
                      disabled={!freeRefresh && playerGold < 2}
                    >
                      REFRESH {freeRefresh ? 'Free' : '2 Gold'}
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
                            <span>ATK:{instance.attack}</span>
                            <span>HP:{instance.health}</span>
                          </div>
                          <div className="card-price">${CARD_PRICES[template.rarity as Rarity]}</div>
                          {!canBuy && playerBench.length >= MAX_BENCH_SIZE && (
                            <div className="card-disabled-reason">Bench Full</div>
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
          <span className="gold-icon">$</span>
          <span className="gold-amount">{playerGold}</span>
          {playerWinStreak > 0 && (
            <span className="streak">{playerWinStreak} Win Streak</span>
          )}
        </div>
      </div>
      
      <button className="exit-btn" onClick={returnToLobby}>Exit</button>
    </div>
  )

  // 渲染游戏结束
  const renderGameOver = () => {
    const isWinner = playerHP > 0
    // Trophy is calculated on-chain based on player's blockchain winStreak
    // Winner: +30 + (blockchain winStreak + 1) because contract increments first
    // Loser: -30 (fixed)
    const currentWinStreak = playerProfile?.winStreak ?? 0
    const trophyChange = isWinner ? 30 + (currentWinStreak + 1) : -30
    
    return (
      <div className="arena-gameover-screen">
        <h2>{isWinner ? 'Victory！' : 'Defeat'}</h2>
        <div className="final-stats">
          <div>Lasted {round} Rounds</div>
          <div>Win Streak: {isWinner ? currentWinStreak + 1 : 0}</div>
          <div className={`trophy-change ${isWinner ? 'win' : 'lose'}`}>
            🏆 {trophyChange > 0 ? '+' : ''}{trophyChange} Trophy
          </div>
          {isWinner && <div className="bug-reward">🪲 +100 BUG</div>}
        </div>
        <button className="return-btn" onClick={returnToLobby}>Return to Lobby</button>
      </div>
    )
  }

  return (
    <div className="arena-battle-container">
      <div className="arena-battle-container-bg">
        <img src="/market-bg.png" alt="" className="background-image" />
      </div>
      {gamePhase === 'matching' && renderMatching()}
      {(gamePhase === 'preparation' || gamePhase === 'battle' || gamePhase === 'settlement') && renderGame()}
      {gamePhase === 'gameover' && renderGameOver()}
    </div>
  )
}

export default ArenaBattle
