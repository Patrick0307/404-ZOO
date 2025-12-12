import { useState, useEffect } from 'react'
import '../css/Backpack.css'
import {
  getPlayerCardsWithTemplates,
  listCard,
  getCardListing,
  type PlayerCard,
  type PlayerProfile,
  type Listing,
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
  
  // 上架相关状态
  const [showListModal, setShowListModal] = useState(false)
  const [listPrice, setListPrice] = useState('')
  const [isListing, setIsListing] = useState(false)
  const [listingStatus, setListingStatus] = useState<string | null>(null)
  const [cardListings, setCardListings] = useState<Map<string, Listing>>(new Map())

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
      
      // 检查每张卡是否已上架
      const listings = new Map<string, Listing>()
      for (const card of playerCards) {
        const listing = await getCardListing(card.instance.mint)
        if (listing) {
          listings.set(card.instance.mint.toBase58(), listing)
        }
      }
      setCardListings(listings)
    } catch (error) {
      console.error('Failed to load cards:', error)
    }
    setIsLoading(false)
  }

  // 过滤掉已上架的卡，并按稀有度筛选
  const filteredCards = cards
    .filter(c => !cardListings.has(c.instance.mint.toBase58())) // 排除已上架的卡
    .filter(c => filter === null || c.template?.rarity === filter)

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

  // 打开上架弹窗
  const handleOpenListModal = () => {
    if (!selectedCard) return
    const mintKey = selectedCard.instance.mint.toBase58()
    if (cardListings.has(mintKey)) {
      setListingStatus('This card is already listed!')
      return
    }
    setListPrice('')
    setListingStatus(null)
    setShowListModal(true)
  }

  // 关闭上架弹窗
  const handleCloseListModal = () => {
    setShowListModal(false)
    setListPrice('')
    setListingStatus(null)
  }

  // 确认上架
  const handleConfirmList = async () => {
    if (!selectedCard || !playerProfile || !listPrice) return
    
    const price = parseInt(listPrice)
    if (isNaN(price) || price <= 0) {
      setListingStatus('Please enter a valid price!')
      return
    }

    setIsListing(true)
    setListingStatus('Listing card...')
    
    try {
      await listCard(playerProfile.wallet, selectedCard.instance.mint, price)
      setListingStatus('Card listed successfully!')
      
      // 更新本地状态
      const newListings = new Map(cardListings)
      newListings.set(selectedCard.instance.mint.toBase58(), {
        seller: playerProfile.wallet,
        cardMint: selectedCard.instance.mint,
        price,
        isActive: true,
        createdAt: Date.now() / 1000,
      })
      setCardListings(newListings)
      
      // 清除选中的卡（因为它已经上架了）
      setSelectedCard(null)
      
      setTimeout(() => {
        handleCloseListModal()
        // 重新加载卡片列表
        loadCards()
      }, 1500)
    } catch (error) {
      console.error('Failed to list card:', error)
      setListingStatus('Failed to list card. Please try again.')
    }
    
    setIsListing(false)
  }

  // 检查选中的卡是否已上架
  const isSelectedCardListed = selectedCard 
    ? cardListings.has(selectedCard.instance.mint.toBase58()) 
    : false

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
            <button 
              className={`list-btn-cyber ${isSelectedCardListed ? 'disabled' : ''}`} 
              onClick={handleOpenListModal}
              disabled={isSelectedCardListed}
            >
              {isSelectedCardListed ? 'LISTED' : 'LIST TO MARKET'}
            </button>
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

      {/* List Card Modal */}
      {showListModal && selectedCard && (
        <div className="list-modal-overlay" onClick={handleCloseListModal}>
          <div className="list-modal-cyber" onClick={e => e.stopPropagation()}>
            <div className="list-modal-header">LIST_CARD_TO_MARKET</div>
            
            <div className="list-modal-card-info">
              <div className="list-card-name">
                {selectedCard.template?.name ?? `MK-${selectedCard.instance.cardTypeId}_UNKNOWN`}
              </div>
              <div className="list-card-stats">
                ATK: {selectedCard.instance.attack} | HP: {selectedCard.instance.health}
              </div>
            </div>

            <div className="list-price-section">
              <label className="list-price-label">PRICE (BUG TOKENS):</label>
              <input
                type="number"
                className="list-price-input"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="Enter price..."
                min="1"
                disabled={isListing}
              />
            </div>

            {listingStatus && (
              <div className={`list-status ${listingStatus.includes('success') ? 'success' : listingStatus.includes('Failed') ? 'error' : ''}`}>
                {listingStatus}
              </div>
            )}

            <div className="list-modal-actions">
              <button 
                className="list-confirm-btn" 
                onClick={handleConfirmList}
                disabled={isListing || !listPrice}
              >
                {isListing ? 'LISTING...' : 'CONFIRM LIST'}
              </button>
              <button 
                className="list-cancel-btn" 
                onClick={handleCloseListModal}
                disabled={isListing}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Backpack
