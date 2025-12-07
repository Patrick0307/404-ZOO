import { useState, useEffect } from 'react'
import '../css/Backpack.css'
import {
  getPlayerCardsWithTemplates,
  type PlayerCard,
  type PlayerProfile,
  Rarity,
  RarityNames,
} from '../services/contract'

interface BackpackProps {
  onBack: () => void
  playerProfile: PlayerProfile | null
}

function Backpack({ onBack, playerProfile }: BackpackProps) {
  const [cards, setCards] = useState<PlayerCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<number | null>(null) // null = 全部

  useEffect(() => {
    if (playerProfile) {
      loadCards()
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

  const filteredCards = filter === null 
    ? cards 
    : cards.filter(c => c.template?.rarity === filter)

  const getRarityClass = (rarity: number) => {
    switch (rarity) {
      case Rarity.Legendary: return 'legendary'
      case Rarity.Rare: return 'rare'
      default: return 'common'
    }
  }

  const getTraitEmoji = (traitType: number) => {
    switch (traitType) {
      case 0: return '⚔️' // Warrior
      case 1: return '🏹' // Archer
      case 2: return '🗡️' // Assassin
      default: return '❓'
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">🎒</span>
        <h2>背包</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>
      
      <div className="backpack-stats">
        <span>共 {cards.length} 张卡牌</span>
        <button className="refresh-btn" onClick={loadCards} disabled={isLoading}>
          {isLoading ? '加载中...' : '🔄 刷新'}
        </button>
      </div>

      <div className="backpack-filters">
        <button 
          className={`filter-btn ${filter === null ? 'active' : ''}`}
          onClick={() => setFilter(null)}
        >
          全部
        </button>
        <button 
          className={`filter-btn ${filter === Rarity.Legendary ? 'active' : ''}`}
          onClick={() => setFilter(Rarity.Legendary)}
        >
          传说
        </button>
        <button 
          className={`filter-btn ${filter === Rarity.Rare ? 'active' : ''}`}
          onClick={() => setFilter(Rarity.Rare)}
        >
          稀有
        </button>
        <button 
          className={`filter-btn ${filter === Rarity.Common ? 'active' : ''}`}
          onClick={() => setFilter(Rarity.Common)}
        >
          普通
        </button>
      </div>

      {isLoading ? (
        <div className="loading-state">加载卡牌中...</div>
      ) : filteredCards.length === 0 ? (
        <div className="empty-state">
          {cards.length === 0 ? '还没有卡牌，去抽卡吧！' : '没有符合条件的卡牌'}
        </div>
      ) : (
        <div className="backpack-grid">
          {filteredCards.map((card) => (
            <div 
              key={card.instance.mint.toBase58()} 
              className={`creature-card ${getRarityClass(card.template?.rarity ?? 0)}`}
            >
              <div className="card-rarity">
                {card.template ? RarityNames[card.template.rarity as Rarity] : '???'}
              </div>
              <div className="card-element">
                {card.template ? getTraitEmoji(card.template.traitType) : '❓'}
              </div>
              <div className="card-avatar">
                {card.template?.imageUri ? (
                  <img src={card.template.imageUri} alt={card.template.name} />
                ) : (
                  <span className="creature-emoji">🃏</span>
                )}
              </div>
              <div className="card-info">
                <span className="card-name">{card.template?.name ?? `Card #${card.instance.cardTypeId}`}</span>
                <div className="card-stats">
                  <span className="stat attack">⚔️ {card.instance.attack}</span>
                  <span className="stat health">❤️ {card.instance.health}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Backpack
