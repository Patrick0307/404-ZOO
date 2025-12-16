import { useState, useEffect } from 'react'
import '../css/Marketplace.css'
import {
  getListingsWithCards,
  buyCard,
  buyBugTokens,
  getPlayerBugBalance,
  type ListingWithCard,
  type PlayerProfile,
  Rarity,
} from '../services/contract'

interface MarketplaceProps {
  playerProfile: PlayerProfile | null
}

type TabType = 'market' | 'topup'

function Marketplace({ playerProfile }: MarketplaceProps) {
  const [listings, setListings] = useState<ListingWithCard[]>([])
  const [selectedListing, setSelectedListing] = useState<ListingWithCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBuying, setIsBuying] = useState(false)
  const [buyStatus, setBuyStatus] = useState<string | null>(null)
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set([0, 1, 2]))
  const [typeFilter, setTypeFilter] = useState<number | null>(null)
  
  // Tab 和充值相关状态
  const [activeTab, setActiveTab] = useState<TabType>('market')
  const [bugBalance, setBugBalance] = useState<number>(0)
  const [isTopingUp, setIsTopingUp] = useState(false)
  const [topupStatus, setTopupStatus] = useState<string | null>(null)
  
  // 模态框相关状态
  const [showModal, setShowModal] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    loadListings()
    if (playerProfile) {
      loadBugBalance()
    }
  }, [playerProfile])

  const loadListings = async () => {
    setIsLoading(true)
    try {
      const data = await getListingsWithCards()
      setListings(data)
      if (data.length > 0) {
        setSelectedListing(data[0])
      }
    } catch (error) {
      console.error('Failed to load listings:', error)
    }
    setIsLoading(false)
  }

  const loadBugBalance = async () => {
    if (!playerProfile) return
    try {
      const balance = await getPlayerBugBalance(playerProfile.wallet)
      setBugBalance(balance)
    } catch (error) {
      console.error('Failed to load BUG balance:', error)
    }
  }

  // SOL 充值档位 (lamports)
  const TOPUP_OPTIONS = [
    { sol: 0.5, lamports: 500_000_000, bugAmount: 5000 },
    { sol: 1, lamports: 1_000_000_000, bugAmount: 10000 },
    { sol: 2, lamports: 2_000_000_000, bugAmount: 20000 },
  ]

  const handleTopup = async (lamports: number) => {
    if (!playerProfile) return
    
    setIsTopingUp(true)
    setTopupStatus('Processing...')
    
    try {
      await buyBugTokens(playerProfile.wallet, lamports)
      setTopupStatus('Top-up successful!')
      await loadBugBalance()
      setTimeout(() => setTopupStatus(null), 2000)
    } catch (error) {
      console.error('Failed to top up:', error)
      setTopupStatus('Top-up failed. Please try again.')
    }
    
    setIsTopingUp(false)
  }

  const filteredListings = listings.filter(item => {
    const cardRarity = item.cardTemplate?.rarity ?? 0
    const passesRarityFilter = rarityFilter.has(cardRarity)
    const passesTypeFilter = typeFilter === null || item.cardTemplate?.traitType === typeFilter
    
    // Debug logging
    console.log('Filtering card:', {
      cardRarity,
      rarityFilter: Array.from(rarityFilter),
      passesRarityFilter,
      passesTypeFilter
    })
    
    return passesRarityFilter && passesTypeFilter
  })

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

  const getTraitEmoji = (traitType: number): string => {
    switch (traitType) {
      case 0: return '⚔️'
      case 1: return '🏹'
      case 2: return '🗡️'
      default: return '❓'
    }
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

  const toggleRarityFilter = (rarity: number) => {
    const newFilter = new Set(rarityFilter)
    if (newFilter.has(rarity)) {
      newFilter.delete(rarity)
    } else {
      newFilter.add(rarity)
    }
    console.log('Toggling rarity filter:', {
      rarity,
      oldFilter: Array.from(rarityFilter),
      newFilter: Array.from(newFilter)
    })
    setRarityFilter(newFilter)
  }

  const handleBuy = async () => {
    if (!selectedListing || !playerProfile) {
      setBuyStatus('Please register first before buying!')
      return
    }
    
    if (selectedListing.listing.seller.toBase58() === playerProfile.wallet.toBase58()) {
      setBuyStatus('Cannot buy your own card!')
      return
    }

    // 检查买家 BUG 余额是否足够
    if (bugBalance < selectedListing.listing.price) {
      setBuyStatus(`Insufficient BUG balance! Need ${selectedListing.listing.price}, have ${bugBalance}`)
      return
    }

    setIsBuying(true)
    setBuyStatus('Processing purchase...')

    try {
      await buyCard(
        playerProfile.wallet,
        selectedListing.listing.cardMint,
        selectedListing.listing.seller
      )
      
      setBuyStatus('Purchase successful!')
      setTimeout(() => {
        loadListings()
        loadBugBalance()
        setBuyStatus(null)
      }, 2000)
    } catch (error) {
      console.error('Failed to buy card:', error)
      // 提供更详细的错误信息
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      if (errorMsg.includes('Buyer profile not found')) {
        setBuyStatus('Your profile not found. Please register first!')
      } else if (errorMsg.includes('Seller profile not found')) {
        setBuyStatus('Seller profile not found. Cannot complete purchase.')
      } else if (errorMsg.includes('AccountOwnedByWrongProgram')) {
        setBuyStatus('Account error. Please refresh and try again.')
      } else if (errorMsg.includes('InsufficientBalance')) {
        setBuyStatus('Insufficient BUG balance!')
      } else {
        setBuyStatus(`Purchase failed: ${errorMsg.slice(0, 50)}...`)
      }
    }
    
    setIsBuying(false)
  }


  return (
    <div className="marketplace-container">
      {/* Top Tab Bar */}
      <div className="market-tabs">
        <button 
          className={`market-tab ${activeTab === 'market' ? 'active' : ''}`}
          onClick={() => setActiveTab('market')}
        >
          MARKET_MODE
        </button>
        <button 
          className={`market-tab ${activeTab === 'topup' ? 'active' : ''}`}
          onClick={() => setActiveTab('topup')}
        >
          BUG_TOPUP
        </button>
        <button className="market-tab">MONSTER_CARDS</button>
        <button className="market-tab">EVOLUTION_CORE</button>
        <button className="market-tab">PACKS</button>
      </div>

      {/* Top-up Tab Content */}
      {activeTab === 'topup' && (
        <div className="topup-content">
          <div className="topup-header">
            <div className="topup-title">BUG_TOKEN_EXCHANGE</div>
            <div className="topup-subtitle">// CONVERT SOL TO BUG TOKENS</div>
          </div>

          <div className="topup-balance">
            <span className="balance-label">CURRENT_BALANCE:</span>
            <span className="balance-value">{bugBalance.toLocaleString()} BUG</span>
          </div>

          <div className="topup-options">
            {TOPUP_OPTIONS.map((option) => (
              <div key={option.sol} className="topup-card">
                <div className="topup-card-header">
                  <span className="sol-amount">{option.sol} SOL</span>
                </div>
                <div className="topup-card-body">
                  <div className="bug-amount">{option.bugAmount.toLocaleString()}</div>
                  <div className="bug-label">BUG TOKENS</div>
                </div>
                <button
                  className="topup-btn"
                  onClick={() => handleTopup(option.lamports)}
                  disabled={isTopingUp || !playerProfile}
                >
                  {isTopingUp ? 'PROCESSING...' : 'EXCHANGE'}
                </button>
              </div>
            ))}
          </div>

          {topupStatus && (
            <div className={`topup-status ${topupStatus.includes('successful') ? 'success' : topupStatus.includes('failed') ? 'error' : ''}`}>
              {topupStatus}
            </div>
          )}

          <div className="topup-info">
            <div className="info-title">EXCHANGE_INFO:</div>
            <div className="info-text">
              • Rate: 1 SOL = 10,000 BUG<br/>
              • BUG tokens are used to purchase cards<br/>
              • Transactions are processed on Solana Devnet
            </div>
          </div>
        </div>
      )}

      {/* Market Tab Content */}
      {activeTab === 'market' && (
        <div className="market-content">
          {/* Left Side Filter */}
          <div className="market-sidebar">
            <div className="filter-section">
              <div className="filter-header">FILTER_MODE</div>
              <div className="filter-status">// ACTIVE</div>
            </div>

            <div className="filter-section">
              <div className="filter-title">RARITY</div>
              <div 
                className={`filter-option ${rarityFilter.has(Rarity.Common) ? 'selected' : ''}`}
                onClick={() => toggleRarityFilter(Rarity.Common)}
              >
                <div className="filter-checkbox-box">
                  {rarityFilter.has(Rarity.Common) && <span className="checkmark">✓</span>}
                </div>
                <span className="filter-label">COMMON</span>
              </div>
              <div 
                className={`filter-option ${rarityFilter.has(Rarity.Rare) ? 'selected' : ''}`}
                onClick={() => toggleRarityFilter(Rarity.Rare)}
              >
                <div className="filter-checkbox-box">
                  {rarityFilter.has(Rarity.Rare) && <span className="checkmark">✓</span>}
                </div>
                <span className="filter-label">RARE</span>
              </div>
              <div 
                className={`filter-option ${rarityFilter.has(Rarity.Legendary) ? 'selected' : ''}`}
                onClick={() => toggleRarityFilter(Rarity.Legendary)}
              >
                <div className="filter-checkbox-box">
                  {rarityFilter.has(Rarity.Legendary) && <span className="checkmark">✓</span>}
                </div>
                <span className="filter-label">LEGENDARY</span>
              </div>
            </div>

            <div className="filter-section">
              <div className="filter-title">TYPE</div>
              <button 
                className={`type-btn ${typeFilter === 0 ? 'active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === 0 ? null : 0)}
              >
                warrior
              </button>
              <button 
                className={`type-btn ${typeFilter === 1 ? 'active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === 1 ? null : 1)}
              >
                archer
              </button>
              <button 
                className={`type-btn ${typeFilter === 2 ? 'active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === 2 ? null : 2)}
              >
                assassin
              </button>
            </div>

            <div className="market-footer-stats">
              <div>LISTINGS: {listings.length}</div>
              <button className="refresh-btn" onClick={loadListings}>⟳ REFRESH</button>
            </div>
          </div>

          {/* Center Card Grid */}
          <div className="market-grid">
            {isLoading ? (
              <div className="loading-state-market">LOADING_LISTINGS...</div>
            ) : filteredListings.length === 0 ? (
              <div className="empty-state-market">NO_LISTINGS_FOUND</div>
            ) : (
              filteredListings.map(item => (
                <div 
                  key={item.listing.cardMint.toBase58()} 
                  className={`market-card-cyber ${selectedListing?.listing.cardMint.toBase58() === item.listing.cardMint.toBase58() ? 'selected' : ''} rarity-${item.cardTemplate?.rarity ?? 0}`}
                  onClick={() => setSelectedListing(item)}
                >
                  <div className="card-image-cyber">
                    {item.cardTemplate?.imageUri ? (
                      <img src={item.cardTemplate.imageUri} alt={item.cardTemplate.name} />
                    ) : (
                      <span className="card-placeholder">🃏</span>
                    )}
                  </div>
                  <div className="card-stars">
                    {'★'.repeat(getStars(item.cardTemplate?.rarity ?? 0))}
                  </div>
                  <div className="card-rarity-cyber">{getRarityName(item.cardTemplate?.rarity ?? 0)}</div>
                  <div className="card-price-cyber">PRICE: {item.listing.price}</div>
                </div>
              ))
            )}
          </div>


          {/* Right Info Panel */}
          {selectedListing && (
            <div className="market-info-panel">
              <div className="info-header">ITEM_INFO</div>
              <div className="info-name">
                {selectedListing.cardTemplate?.name ?? `MK-${selectedListing.cardInstance?.cardTypeId ?? '???'}_UNKNOWN`}
              </div>
              
              <div className="info-row">
                <span className="info-label">RARITY:</span>
                <span className="info-value rare">{getRarityName(selectedListing.cardTemplate?.rarity ?? 0)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">TYPE:</span>
                <span className="info-value">{getTraitName(selectedListing.cardTemplate?.traitType ?? 0)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">ATK:</span>
                <span className="info-value">{selectedListing.cardInstance?.attack ?? '???'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">HP:</span>
                <span className="info-value">{selectedListing.cardInstance?.health ?? '???'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">PRICE:</span>
                <span className="info-value price">{selectedListing.listing.price} BUG</span>
              </div>

              <div className="info-log">
                <div className="log-title">SELLER_INFO:</div>
                <div className="log-text">
                  {selectedListing.listing.seller.toBase58().slice(0, 8)}...
                  <br/>
                  Listed: {new Date(selectedListing.listing.createdAt * 1000).toLocaleDateString()}
                </div>
              </div>

              {buyStatus && (
                <div className={`buy-status ${buyStatus.includes('successful') ? 'success' : buyStatus.includes('failed') || buyStatus.includes('Cannot') ? 'error' : ''}`}>
                  {buyStatus}
                </div>
              )}

              <button 
                className="acquire-btn" 
                onClick={handleBuy}
                disabled={isBuying || !playerProfile}
              >
                {isBuying ? 'PROCESSING...' : 'ACQUIRE'}
              </button>
              <button className="inspect-btn" onClick={handleInspect}>INSPECT</button>
            </div>
          )}
        </div>
      )}

      {/* 底部 BUG 余额显示 */}
      <div className="market-balance-bar">
        <div className="balance-display">
          <span className="balance-icon">◈</span>
          <span className="balance-text">BUG: {bugBalance.toLocaleString()}</span>
        </div>
      </div>

      {/* Card Detail Modal */}
      {showModal && selectedListing && (
        <div className={`card-modal-overlay-mtg ${isClosing ? 'closing' : ''}`} onClick={handleCloseModal}>
          <div className={`mtg-card ${isClosing ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="mtg-card-inner">
              {/* Card Border with Glow */}
              <div className={`mtg-border rarity-${selectedListing.cardTemplate?.rarity ?? 0}`}>
                {/* Top Section - Name Only */}
                <div className="mtg-header">
                  <div className="mtg-name-box">
                    <h2 className="mtg-card-name">{selectedListing.cardTemplate?.name ?? `MK-${selectedListing.cardInstance?.cardTypeId ?? '???'}_UNKNOWN`}</h2>
                  </div>
                </div>

                {/* Image Section */}
                <div className="mtg-image-frame">
                  <div className="mtg-image-container">
                    {selectedListing.cardTemplate?.imageUri ? (
                      <img
                        src={selectedListing.cardTemplate.imageUri}
                        alt={selectedListing.cardTemplate.name}
                        className="mtg-card-image"
                      />
                    ) : (
                      <div className="mtg-fallback-image">
                        <span className="fallback-icon-large">{getTraitEmoji(selectedListing.cardTemplate?.traitType ?? 0)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Type Line with Stats */}
                <div className="mtg-type-section">
                  <div className="mtg-type-line">
                    <div className="mtg-type-text">
                      {getRarityName(selectedListing.cardTemplate?.rarity ?? 0)} Creature — {getTraitName(selectedListing.cardTemplate?.traitType ?? 0)}
                    </div>
                  </div>
                  <div className="mtg-stats-box">
                    <div className="stat-label">Attack:</div>
                    <div className="stat-value">{selectedListing.cardInstance?.attack ?? '???'}</div>
                    <div className="stat-separator">/</div>
                    <div className="stat-label">Health:</div>
                    <div className="stat-value">{selectedListing.cardInstance?.health ?? '???'}</div>
                  </div>
                </div>

                {/* Text Box */}
                <div className="mtg-text-box">
                  <p className="mtg-description">{selectedListing.cardTemplate?.description ?? 'A mysterious creature from the 404 Zoo.'}</p>
                  <div className="mtg-flavor-text">
                    <em>"In the depths of the 404 Zoo, legends are born from chaos."</em>
                  </div>
                  <div className="mtg-instance-info">
                    <strong>Price:</strong> {selectedListing.listing.price} BUG<br/>
                    <strong>Seller:</strong> {selectedListing.listing.seller.toBase58().slice(0, 8)}...<br/>
                    <strong>Listed:</strong> {new Date(selectedListing.listing.createdAt * 1000).toLocaleDateString()}
                  </div>
                </div>

                {/* Bottom Info */}
                <div className="mtg-bottom-info">
                  <span className="mtg-set-info">404 ZOO</span>
                  <span className="mtg-rarity-symbol">
                    {'★'.repeat(getStars(selectedListing.cardTemplate?.rarity ?? 0))}
                  </span>
                  <span className="mtg-card-number">#{selectedListing.cardInstance?.cardTypeId ?? '???'}</span>
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

export default Marketplace
