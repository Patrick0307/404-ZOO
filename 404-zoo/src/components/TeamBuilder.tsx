import { useState, useEffect } from 'react'
import '../css/TeamBuilder.css'
import {
  getPlayerCardsWithTemplates,
  getPlayerDecks,
  saveDeck,
  deleteDeck,
  type PlayerCard,
  type PlayerProfile,
  type PlayerDeck,
  Rarity,
} from '../services/contract'

interface TeamBuilderProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
}

const MAX_TEAM_SIZE = 10
const MAX_DECKS = 5

function TeamBuilder({ onBack, playerProfile }: TeamBuilderProps) {
  const [cards, setCards] = useState<PlayerCard[]>([])
  const [team, setTeam] = useState<PlayerCard[]>([])
  const [savedDecks, setSavedDecks] = useState<PlayerDeck[]>([])
  const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null)
  const [deckName, setDeckName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  useEffect(() => {
    if (playerProfile) {
      loadCards()
      loadSavedDecks()
    }
  }, [playerProfile])

  const loadCards = async () => {
    if (!playerProfile) return
    setIsLoading(true)
    try {
      const playerCards = await getPlayerCardsWithTemplates(playerProfile.wallet)
      setCards(playerCards)
    } catch (error) {
      console.error('Failed to load cards:', error)
    }
    setIsLoading(false)
  }

  const loadSavedDecks = async () => {
    if (!playerProfile) return
    try {
      const decks = await getPlayerDecks(playerProfile.wallet)
      setSavedDecks(decks)
    } catch (error) {
      console.error('Failed to load saved decks:', error)
    }
  }

  const isCardInTeam = (card: PlayerCard) => {
    return team.some(t => t.instance.mint.toBase58() === card.instance.mint.toBase58())
  }

  const addToTeam = (card: PlayerCard) => {
    if (team.length >= MAX_TEAM_SIZE) return
    if (isCardInTeam(card)) return
    setTeam([...team, card])
  }

  const removeFromTeam = (card: PlayerCard) => {
    setTeam(team.filter(t => t.instance.mint.toBase58() !== card.instance.mint.toBase58()))
  }

  const handleSaveDeck = async () => {
    if (!playerProfile || team.length === 0) return
    if (!deckName.trim()) {
      alert('请输入卡组名称')
      return
    }

    setIsSaving(true)
    try {
      // 找到下一个可用的卡组索引
      const usedIndices = savedDecks.map(d => d.deckIndex)
      let newIndex = selectedDeckIndex

      if (newIndex === null) {
        for (let i = 0; i < MAX_DECKS; i++) {
          if (!usedIndices.includes(i)) {
            newIndex = i
            break
          }
        }
      }

      if (newIndex === null || newIndex >= MAX_DECKS) {
        alert('卡组数量已达上限 (最多5个)')
        setIsSaving(false)
        return
      }

      const cardMints = team.map(c => c.instance.mint)
      await saveDeck(playerProfile.wallet, newIndex, deckName, cardMints)

      alert('卡组保存成功！')
      await loadSavedDecks()
      
      // 重置编辑状态
      setSelectedDeckIndex(null)
      setDeckName('')
    } catch (error) {
      console.error('Failed to save deck:', error)
      alert('保存失败: ' + (error as Error).message)
    }
    setIsSaving(false)
  }

  const handleDeleteDeck = async (deckIndex: number) => {
    if (!playerProfile) return
    if (!confirm('确定要删除这个卡组吗？')) return

    setIsDeleting(deckIndex)
    try {
      await deleteDeck(playerProfile.wallet, deckIndex)
      alert('卡组已删除')
      await loadSavedDecks()
      
      // 如果删除的是当前编辑的卡组，清空编辑状态
      if (selectedDeckIndex === deckIndex) {
        setSelectedDeckIndex(null)
        setDeckName('')
        setTeam([])
      }
    } catch (error) {
      console.error('Failed to delete deck:', error)
      alert('删除失败: ' + (error as Error).message)
    }
    setIsDeleting(null)
  }

  const handleLoadDeck = (deck: PlayerDeck) => {
    setSelectedDeckIndex(deck.deckIndex)
    setDeckName(deck.deckName)
    
    // 匹配已保存的卡牌
    const deckCards: PlayerCard[] = []
    for (const mint of deck.cardMints) {
      const found = cards.find(c => c.instance.mint.toBase58() === mint.toBase58())
      if (found) deckCards.push(found)
    }
    setTeam(deckCards)
  }

  const handleNewDeck = () => {
    setSelectedDeckIndex(null)
    setDeckName('')
    setTeam([])
  }

  const getRarityClass = (rarity: number) => {
    switch (rarity) {
      case Rarity.Legendary: return 'legendary'
      case Rarity.Rare: return 'rare'
      default: return 'common'
    }
  }

  const getTraitEmoji = (traitType: number) => {
    switch (traitType) {
      case 0: return '⚔️'
      case 1: return '🏹'
      case 2: return '🗡️'
      default: return '❓'
    }
  }

  const getTeamStats = () => {
    const totalAttack = team.reduce((sum, c) => sum + c.instance.attack, 0)
    const totalHealth = team.reduce((sum, c) => sum + c.instance.health, 0)
    return { totalAttack, totalHealth }
  }

  const stats = getTeamStats()

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">👥</span>
        <h2>组队</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>

      <div className="team-builder-content">
        {/* 已保存的卡组列表 */}
        <div className="saved-decks-section">
          <div className="saved-decks-header">
            <h3>💾 我的卡组 ({savedDecks.length}/{MAX_DECKS})</h3>
            <button 
              className="new-deck-btn" 
              onClick={handleNewDeck}
              disabled={savedDecks.length >= MAX_DECKS && selectedDeckIndex === null}
            >
              + 新建卡组
            </button>
          </div>
          
          {savedDecks.length === 0 ? (
            <div className="no-decks-hint">还没有保存的卡组</div>
          ) : (
            <div className="saved-decks-list">
              {savedDecks.map((deck) => (
                <div 
                  key={deck.deckIndex} 
                  className={`saved-deck-item ${selectedDeckIndex === deck.deckIndex ? 'active' : ''}`}
                >
                  <div className="deck-info" onClick={() => handleLoadDeck(deck)}>
                    <span className="deck-name">{deck.deckName}</span>
                    <span className="deck-card-count">{deck.cardMints.length}张</span>
                  </div>
                  <div className="deck-actions">
                    <button 
                      className="deck-edit-btn"
                      onClick={() => handleLoadDeck(deck)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="deck-delete-btn"
                      onClick={() => handleDeleteDeck(deck.deckIndex)}
                      disabled={isDeleting === deck.deckIndex}
                    >
                      {isDeleting === deck.deckIndex ? '...' : '🗑️'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 卡组编辑区域 */}
        <div className="team-section">
          <div className="team-header">
            <div className="team-name-input">
              <input
                type="text"
                placeholder="输入卡组名称..."
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                maxLength={32}
              />
            </div>
            <div className="team-stats-mini">
              <span>⚔️ {stats.totalAttack}</span>
              <span>❤️ {stats.totalHealth}</span>
            </div>
          </div>

          <div className="team-slots-header">
            <span>阵容 ({team.length}/{MAX_TEAM_SIZE})</span>
          </div>
          
          <div className="team-slots">
            {Array.from({ length: MAX_TEAM_SIZE }).map((_, i) => {
              const card = team[i]
              return (
                <div 
                  key={i} 
                  className={`team-slot ${card ? getRarityClass(card.template?.rarity ?? 0) : 'empty'}`}
                  onClick={() => card && removeFromTeam(card)}
                >
                  {card ? (
                    <>
                      <div className="slot-avatar">
                        {card.template?.imageUri ? (
                          <img src={card.template.imageUri} alt={card.template.name} />
                        ) : '🃏'}
                      </div>
                      <div className="slot-info">
                        <span className="slot-name">{card.template?.name ?? '???'}</span>
                        <span className="slot-stats">⚔️{card.instance.attack} ❤️{card.instance.health}</span>
                      </div>
                      <div className="slot-remove">✕</div>
                    </>
                  ) : (
                    <>
                      <div className="slot-number">{i + 1}</div>
                      <span className="empty-slot-text">空位</span>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div className="team-actions">
            <button 
              className="save-deck-btn" 
              onClick={handleSaveDeck}
              disabled={isSaving || team.length === 0 || !deckName.trim()}
            >
              {isSaving ? '保存中...' : selectedDeckIndex !== null ? '💾 更新卡组' : '💾 保存到链上'}
            </button>
            {team.length > 0 && (
              <button className="clear-team-btn" onClick={() => setTeam([])}>
                清空阵容
              </button>
            )}
          </div>
        </div>

        {/* 可用卡牌区域 */}
        <div className="available-section">
          <div className="available-header">
            <h3>可用卡牌 ({cards.length}张)</h3>
            <button className="refresh-btn" onClick={loadCards} disabled={isLoading}>
              {isLoading ? '加载中...' : '🔄 刷新'}
            </button>
          </div>
          
          {isLoading ? (
            <div className="loading-state">加载卡牌中...</div>
          ) : cards.length === 0 ? (
            <div className="empty-state">还没有卡牌，去抽卡吧！</div>
          ) : (
            <div className="available-grid">
              {cards.map((card) => {
                const inTeam = isCardInTeam(card)
                return (
                  <div 
                    key={card.instance.mint.toBase58()} 
                    className={`card-item ${getRarityClass(card.template?.rarity ?? 0)} ${inTeam ? 'in-team' : ''}`}
                    onClick={() => !inTeam && addToTeam(card)}
                  >
                    <div className="card-trait">
                      {card.template ? getTraitEmoji(card.template.traitType) : '❓'}
                    </div>
                    <div className="card-avatar">
                      {card.template?.imageUri ? (
                        <img src={card.template.imageUri} alt={card.template.name} />
                      ) : '🃏'}
                    </div>
                    <div className="card-name">{card.template?.name ?? '???'}</div>
                    <div className="card-stats">
                      <span>⚔️{card.instance.attack}</span>
                      <span>❤️{card.instance.health}</span>
                    </div>
                    {inTeam && <div className="selected-badge">已选</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TeamBuilder
