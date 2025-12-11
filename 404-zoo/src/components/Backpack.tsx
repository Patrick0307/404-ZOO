import { useState, useEffect } from 'react'
import '../css/Backpack.css'
import {
  getPlayerCardsWithTemplates,
  type PlayerCard,
  type PlayerProfile,
  Rarity,
} from '../services/contract'

interface BackpackProps {
  onBack: () => void
  onNavigateToTeam: () => void
  playerProfile: PlayerProfile | null
}

function Backpack({ playerProfile, onNavigateToTeam }: BackpackProps) {
  const [cards, setCards] = useState<PlayerCard[]>([])
  const [selectedCard, setSelectedCard] = useState<PlayerCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

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

  const getTraitIcon = (traitType: number): string => {
    switch (traitType) {
      case 0: return 'ATK'
      case 1: return 'RNG'
      case 2: return 'MEL'
      default: return 'UNK'
    }
  }

  const handleUseInBattle = () => {
    onNavigateToTeam()
  }

  const handleInspect = () => {
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setIsClosing(true)
    setTimeout(() => {
      setShowModal(false)
      setIsClosing(false)
    }, 500)
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

            <button className="use-btn-cyber" onClick={handleUseInBattle}>USE IN BATTLE</button>
            <button className="inspect-btn-cyber" onClick={handleInspect}>INSPECT</button>
          </div>
        )}
      </div>

      {/* Card Detail Modal */}
      {showModal && selectedCard && (
        <div className={`card-modal-overlay-mtg ${isClosing ? 'closing' : ''}`} onClick={handleCloseModal}>
          <div className={`mtg-card ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mtg-card-inner">
              {/* Card Border with Glow */}
              <div className={`mtg-border rarity-${selectedCard.template?.rarity ?? 0}`}>
                {/* Top Section - Name Only */}
                <div className="mtg-header">
                  <div className="mtg-name-box">
                    <h2 className="mtg-card-name">{selectedCard.template?.name ?? `MK-${selectedCard.instance.cardTypeId}_UNKNOWN`}</h2>
                  </div>
                </div>

                {/* Image Section */}
                <div className="mtg-image-frame">
                  <div className="mtg-image-container">
                    {selectedCard.template?.imageUri ? (
                      <img
                        src={selectedCard.template.imageUri}
                        alt={selectedCard.template.name}
                        className="mtg-card-image"
                      />
                    ) : (
                      <div className="mtg-fallback-image">
                        <span className="fallback-icon-large">{getTraitIcon(selectedCard.template?.traitType ?? 0)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Type Line with Stats */}
                <div className="mtg-type-section">
                  <div className="mtg-type-line">
                    <div className="mtg-type-text">
                      {getRarityName(selectedCard.template?.rarity ?? 0)} Creature — {getTraitName(selectedCard.template?.traitType ?? 0)}
                    </div>
                  </div>
                  <div className="mtg-stats-box">
                    <div className="stat-label">Attack:</div>
                    <div className="stat-value">{selectedCard.instance.attack}</div>
                    <div className="stat-separator">/</div>
                    <div className="stat-label">Health:</div>
                    <div className="stat-value">{selectedCard.instance.health}</div>
                  </div>
                </div>

                {/* Text Box */}
                <div className="mtg-text-box">
                  <p className="mtg-description">{selectedCard.template?.description ?? 'A mysterious creature from the 404 Zoo.'}</p>
                  <div className="mtg-flavor-text">
                    <em>"In the depths of the 404 Zoo, legends are born from chaos."</em>
                  </div>
                  <div className="mtg-instance-info">
                    <strong>Instance ID:</strong> {selectedCard.instance.mint.toBase58().slice(0, 8)}...
                  </div>
                </div>

                {/* Bottom Info */}
                <div className="mtg-bottom-info">
                  <span className="mtg-set-info">404 ZOO</span>
                  <span className="mtg-rarity-symbol">
                    {'★'.repeat(getStars(selectedCard.template?.rarity ?? 0))}
                  </span>
                  <span className="mtg-card-number">#{selectedCard.instance.cardTypeId}</span>
                </div>
              </div>
            </div>
            
            <button className="mtg-close-btn" onClick={handleCloseModal}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Backpack
