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
  const [selectedCard, setSelectedCard] = useState<PlayerCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<number | null>(null)

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
      if (playerCards.length > 0 && !selectedCard) {
        setSelectedCard(playerCards[0])
      }
    } catch (error) {
      console.error('Failed to load cards:', error)
    }
    setIsLoading(false)
  }

  const filteredCards = filter === null 
    ? cards 
    : cards.filter(c => c.template?.rarity === filter)

  const getRarityName = (rarity: number) => {
    switch (rarity) {
      case Rarity.Legendary: return 'LEGENDARY'
      case Rarity.Rare: return 'RARE'
      default: return 'COMMON'
    }
  }

  const getStars = (rarity: number) => {
    switch (rarity) {
      case Rarity.Legendary: return 5
      case Rarity.Rare: return 4
      default: return 3
    }
  }

  const getTraitName = (traitType: number) => {
    switch (traitType) {
      case 0: return 'warrior'
      case 1: return 'archer'
      case 2: return 'assassin'
      default: return 'unknown'
    }
  }

  return (
    <div className="backpack-container">
      {/* 页面标题 */}
      <div className="bag-title">BAG_NODE // INVENTORY</div>

      <div className="bag-content">
        {/* 左侧卡片网格 */}
        <div className="bag-cards-section">
          <div className="section-header">YOUR CARDS</div>
          
          {isLoading ? (
            <div className="loading-state-cyber">LOADING...</div>
          ) : filteredCards.length === 0 ? (
            <div className="empty-state-cyber">NO_CARDS_FOUND</div>
          ) : (
            <div className="bag-cards-grid">
              {filteredCards.map((card) => (
                <div 
                  key={card.instance.mint.toBase58()} 
                  className={`bag-card-cyber ${selectedCard?.instance.mint.toBase58() === card.instance.mint.toBase58() ? 'selected' : ''} rarity-${card.template?.rarity ?? 0}`}
                  onClick={() => setSelectedCard(card)}
                >
                  <div className="bag-card-stars">
                    {'★'.repeat(getStars(card.template?.rarity ?? 0))}
                  </div>
                  <div className="bag-card-image">
                    {card.template?.imageUri ? (
                      <img src={card.template.imageUri} alt={card.template.name} />
                    ) : '🃏'}
                  </div>
                  <div className="bag-card-label">
                    ERR: {card.instance.cardTypeId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧信息面板 */}
        {selectedCard && (
          <div className="bag-info-panel">
            <div className="info-header-cyber">ITEM_INFO</div>
            <div className="info-name-cyber">
              {selectedCard.template?.name ?? `MK-${selectedCard.instance.cardTypeId}_UNKNOWN`}
            </div>
            
            <div className="info-row-cyber">
              <span className="info-label-cyber">RARITY:</span>
              <span className="info-value-cyber rare">
                {getRarityName(selectedCard.template?.rarity ?? 0)}
              </span>
            </div>
            <div className="info-row-cyber">
              <span className="info-label-cyber">TYPE:</span>
              <span className="info-value-cyber">
                {getTraitName(selectedCard.template?.traitType ?? 0)}
              </span>
            </div>
            <div className="info-row-cyber">
              <span className="info-label-cyber">ATK_CODE:</span>
              <span className="info-value-cyber">{selectedCard.instance.attack}</span>
            </div>
            <div className="info-row-cyber">
              <span className="info-label-cyber">HP:</span>
              <span className="info-value-cyber">{selectedCard.instance.health}</span>
            </div>

            <div className="info-log-cyber">
              <div className="log-title-cyber">DATA_LOG:</div>
              <div className="log-text-cyber">
                'Card instance found.<br/>
                Mint: {selectedCard.instance.mint.toBase58().slice(0, 8)}...<br/>
                Status: ACTIVE'
              </div>
            </div>

            <button className="use-btn-cyber">USE IN BATTLE</button>
            <button className="inspect-btn-cyber">INSPECT</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Backpack
