import { useState, useEffect } from 'react'
import '../css/Pokedex.css'
import type { CardTemplate } from '../services/contract'
import {
  TraitTypeNames,
  RarityNames,
  RarityColors,
  RarityToName,
  Rarity,
} from '../services/contract'
import { getCachedCards, getImageUrl } from '../services/cardCache'

interface PokedexProps {
  onBack: () => void
}

function Pokedex() {
  const [cards, setCards] = useState<CardTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<CardTemplate | null>(null)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadCards()
  }, [])

  const loadCards = async () => {
    setLoading(true)
    try {
      // 使用缓存的卡片数据（已经按稀有度排序）
      const templates = await getCachedCards()
      setCards(templates)
      console.log('Loaded cards from cache:', templates.length)
    } catch (error) {
      console.error('Failed to load cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRarityStars = (rarity: Rarity): string => {
    switch (rarity) {
      case Rarity.Common: return '★★★'
      case Rarity.Rare: return '★★★★'
      case Rarity.Legendary: return '★★★★★'
      default: return '★★★'
    }
  }

  const getTraitEmoji = (traitType: number): string => {
    switch (traitType) {
      case 0: return '⚔️'
      case 1: return '🏹'
      case 2: return '🗡️'
      default: return '❓'
    }
  }

  const handleImageError = (cardId: number) => {
    setFailedImages(prev => new Set(prev).add(cardId))
  }

  const shouldShowImage = (card: CardTemplate): boolean => {
    return !!card.imageUri && card.imageUri.trim() !== '' && !failedImages.has(card.cardTypeId)
  }

  return (
    <div className="pokedex-container">
      <div className="pokedex-title">COLLECTION_DB // CARD_ARCHIVE</div>

      <div className="pokedex-stats-cyber">
        <div className="stat-box-cyber">
          <span className="value">{cards.length}</span>
          <span className="label">CARDS_FOUND</span>
        </div>
        <div className="stat-box-cyber">
          <span className="value">
            {cards.filter(c => c.rarity === Rarity.Legendary).length}
          </span>
          <span className="label">LEGENDARY</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-container-cyber">
          <div className="loading-spinner-cyber"></div>
          <p>LOADING_CARDS...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="empty-state-cyber">
          <p>NO_CARDS_FOUND</p>
        </div>
      ) : (
        <div className="pokedex-grid-cyber">
          {cards.map(card => (
            <div
              key={card.cardTypeId}
              className={`pokedex-card-cyber rarity-${RarityToName[card.rarity]}`}
              onClick={() => setSelectedCard(card)}
            >
              <div className="card-stars" style={{ color: RarityColors[card.rarity] }}>
                {getRarityStars(card.rarity)}
              </div>
              <div className="pokedex-avatar-cyber">
                {shouldShowImage(card) ? (
                  <img
                    src={getImageUrl(card.imageUri)}
                    alt={card.name}
                    onError={() => handleImageError(card.cardTypeId)}
                  />
                ) : (
                  <span className="fallback-icon">{getTraitEmoji(card.traitType)}</span>
                )}
              </div>
              <span className="pokedex-name-cyber">{card.name}</span>
              <span className="pokedex-error-code">ERR: {card.cardTypeId}</span>
            </div>
          ))}
        </div>
      )}

      {/* MTG-Style Card Detail Modal */}
      {selectedCard && (
        <div className="card-modal-overlay-mtg" onClick={() => setSelectedCard(null)}>
          <div className="mtg-card" onClick={e => e.stopPropagation()}>
            <div className="mtg-card-inner">
              {/* Card Border with Glow */}
              <div className={`mtg-border rarity-${RarityToName[selectedCard.rarity]}`}>
                {/* Top Section - Name Only */}
                <div className="mtg-header">
                  <div className="mtg-name-box">
                    <h2 className="mtg-card-name">{selectedCard.name}</h2>
                  </div>
                </div>

                {/* Image Section */}
                <div className="mtg-image-frame">
                  <div className="mtg-image-container">
                    {shouldShowImage(selectedCard) ? (
                      <img
                        src={getImageUrl(selectedCard.imageUri)}
                        alt={selectedCard.name}
                        className="mtg-card-image"
                        onError={() => handleImageError(selectedCard.cardTypeId)}
                      />
                    ) : (
                      <div className="mtg-fallback-image">
                        <span className="fallback-icon-large">{getTraitEmoji(selectedCard.traitType)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Type Line with Stats */}
                <div className="mtg-type-section">
                  <div className="mtg-type-line">
                    <div className="mtg-type-text">
                      {RarityNames[selectedCard.rarity]} Creature — {TraitTypeNames[selectedCard.traitType]}
                    </div>
                  </div>
                  <div className="mtg-stats-box">
                    <div className="stat-label">Attack:</div>
                    <div className="stat-value">{selectedCard.minAttack}-{selectedCard.maxAttack}</div>
                    <div className="stat-separator">/</div>
                    <div className="stat-label">Health:</div>
                    <div className="stat-value">{selectedCard.minHealth}-{selectedCard.maxHealth}</div>
                  </div>
                </div>

                {/* Text Box */}
                <div className="mtg-text-box">
                  <p className="mtg-description">{selectedCard.description}</p>
                  <div className="mtg-flavor-text">
                    <em>"In the depths of the 404 Zoo, legends are born from chaos."</em>
                  </div>
                </div>

                {/* Bottom Info */}
                <div className="mtg-bottom-info">
                  <span className="mtg-set-info">404 ZOO</span>
                  <span className="mtg-rarity-symbol" style={{ color: RarityColors[selectedCard.rarity] }}>
                    {getRarityStars(selectedCard.rarity)}
                  </span>
                  <span className="mtg-card-number">#{selectedCard.cardTypeId}</span>
                </div>
              </div>
            </div>
            
            <button className="mtg-close-btn" onClick={() => setSelectedCard(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Pokedex
