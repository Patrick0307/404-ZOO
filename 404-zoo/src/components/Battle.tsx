import { useState, useEffect } from 'react'
import '../css/Battle.css'
import {
  getPlayerDecks,
  type PlayerProfile,
  type PlayerDeck,
} from '../services/contract'
import { getCachedPlayerDecks, hasPlayerDataCache } from '../services/playerDataCache'
import ArenaBattle from './ArenaBattle'

interface BattleProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
}

// 战斗模式类型
type BattleMode = 'lobby' | 'arena' // 可以扩展其他模式

function Battle({ onBack, playerProfile }: BattleProps) {
  // 基础状态
  const [savedDecks, setSavedDecks] = useState<PlayerDeck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<PlayerDeck | null>(null)

  
  // 当前模式
  const [currentMode, setCurrentMode] = useState<BattleMode>('lobby')

  // 加载卡组 - 优先使用缓存
  useEffect(() => {
    if (playerProfile) {
      loadSavedDecks()
    }
  }, [playerProfile])

  const loadSavedDecks = async () => {
    if (!playerProfile) return
    
    // 优先使用缓存
    if (hasPlayerDataCache()) {
      const cachedDecks = getCachedPlayerDecks()
      if (cachedDecks.length > 0) {
        console.log('📦 Using cached decks:', cachedDecks.length)
        setSavedDecks(cachedDecks)
        if (!selectedDeck) {
          setSelectedDeck(cachedDecks[0])
        }
        return
      }
    }
    
    // 没有缓存，从链上加载
    try {
      console.log('🔄 Loading decks from chain...')
      const decks = await getPlayerDecks(playerProfile.wallet)
      setSavedDecks(decks)
      if (decks.length > 0 && !selectedDeck) {
        setSelectedDeck(decks[0])
      }
    } catch (error) {
      console.error('Failed to load saved decks:', error)
    }
  }

  // 开始 Arena 战斗
  const startArenaBattle = () => {
    if (!selectedDeck) {
      alert('请先选择一个卡组！')
      return
    }
    setCurrentMode('arena')
  }

  // 返回大厅
  const returnToLobby = () => {
    setCurrentMode('lobby')
  }


  // 渲染大厅
  const renderLobby = () => (
    <div className="battle-lobby">
      <div className="lobby-header">
        <button className="back-btn" onClick={onBack}>← 返回</button>
        <h2>⚔️ 战斗模式</h2>
      </div>
      
      {/* 卡组选择 */}
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

      {/* 模式选择区域 */}
      <div className="battle-mode-selection">
        <h3>选择战斗模式</h3>
        
        {/* Arena 模式 */}
        <div className="mode-card arena-mode" onClick={startArenaBattle}>
          <div className="mode-icon">🏟️</div>
          <div className="mode-info">
            <h4>Arena 排位赛</h4>
            <p>自走棋玩法，从卡组抽卡组建阵容</p>
          </div>
        </div>

        {/* 其他模式占位 - 可以后续扩展 */}
        <div className="mode-card other-mode disabled">
          <div className="mode-icon">🎯</div>
          <div className="mode-info">
            <h4>快速对战</h4>
            <p>即将推出...</p>
          </div>
          <div className="coming-soon">敬请期待</div>
        </div>

        <div className="mode-card other-mode disabled">
          <div className="mode-icon">🏆</div>
          <div className="mode-info">
            <h4>锦标赛</h4>
            <p>即将推出...</p>
          </div>
          <div className="coming-soon">敬请期待</div>
        </div>
      </div>

      {/* 游戏规则 */}
      <div className="battle-rules">
        <h4>Arena 规则</h4>
        <ul>
          <li>从10张卡组中抽卡组建战斗阵容</li>
          <li>3个相同单位可合成更高星级</li>
          <li>每回合30秒备战时间</li>
          <li>失败扣血 = 回合数²</li>
        </ul>
      </div>
    </div>
  )

  // 根据当前模式渲染
  if (currentMode === 'arena' && selectedDeck) {
    return (
      <ArenaBattle
        onBack={returnToLobby}
        playerProfile={playerProfile}
        selectedDeck={selectedDeck}
      />
    )
  }

  return (
    <div className="battle-container">
      {renderLobby()}
    </div>
  )
}

export default Battle
