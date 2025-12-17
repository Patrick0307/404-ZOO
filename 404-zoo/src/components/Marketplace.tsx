import { useState, useEffect } from 'react'
import '../css/Marketplace.css'
import {
  getListingsWithCards,
  buyCard,
  buyBugTokens,
  buyGachaTickets,
  getPlayerBugBalance,
  getGameConfig,
  getPlayerProfile as fetchPlayerProfile,
  type ListingWithCard,
  type PlayerProfile,
  Rarity,
} from '../services/contract'

interface MarketplaceProps {
  playerProfile: PlayerProfile | null
}

type TabType = 'market' | 'topup' | 'tickets'

function Marketplace({ playerProfile }: MarketplaceProps) {
  const [listings, setListings] = useState<ListingWithCard[]>([])
  const [selectedListing, setSelectedListing] = useState<ListingWithCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBuying, setIsBuying] = useState(false)
  const [buyStatus, setBuyStatus] = useState<string | null>(null)
  const [rarityFilter, setRarityFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<number | null>(null)
  
  // Tab 和充值相关状态
  const [activeTab, setActiveTab] = useState<TabType>('market')
  const [bugBalance, setBugBalance] = useState<number>(0)
  const [gachaTickets, setGachaTickets] = useState<number>(0)
  const [ticketPrice, setTicketPrice] = useState<number>(100) // 默认价格
  const [isTopingUp, setIsTopingUp] = useState(false)
  const [topupStatus, setTopupStatus] = useState<string | null>(null)
  const [isBuyingTickets, setIsBuyingTickets] = useState(false)
  const [ticketStatus, setTicketStatus] = useState<string | null>(null)

  useEffect(() => {
    loadListings()
    loadGameConfig()
    if (playerProfile) {
      loadBugBalance()
      loadPlayerData()
    }
  }, [playerProfile])

  const loadGameConfig = async () => {
    try {
      const config = await getGameConfig()
      if (config) {
        setTicketPrice(config.ticketPrice)
      }
    } catch (error) {
      console.error('Failed to load game config:', error)
    }
  }

  const loadPlayerData = async () => {
    if (!playerProfile) return
    try {
      const profile = await fetchPlayerProfile(playerProfile.wallet)
      if (profile) {
        setGachaTickets(profile.gachaTickets)
      }
    } catch (error) {
      console.error('Failed to load player data:', error)
    }
  }

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

  // Ticket 购买档位
  const TICKET_OPTIONS = [
    { tickets: 1, label: '1 TICKET' },
    { tickets: 5, label: '5 TICKETS' },
    { tickets: 10, label: '10 TICKETS' },
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

  const handleBuyTickets = async (ticketCount: number) => {
    if (!playerProfile) return
    
    const totalCost = ticketPrice * ticketCount
    if (bugBalance < totalCost) {
      setTicketStatus(`Insufficient BUG! Need ${totalCost}, have ${bugBalance}`)
      return
    }
    
    setIsBuyingTickets(true)
    setTicketStatus('Processing...')
    
    try {
      await buyGachaTickets(playerProfile.wallet, ticketCount)
      setTicketStatus(`Successfully bought ${ticketCount} ticket(s)!`)
      await loadBugBalance()
      await loadPlayerData()
      setTimeout(() => setTicketStatus(null), 2000)
    } catch (error) {
      console.error('Failed to buy tickets:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      if (errorMsg.includes('InsufficientBalance')) {
        setTicketStatus('Insufficient BUG balance!')
      } else {
        setTicketStatus('Purchase failed. Please try again.')
      }
    }
    
    setIsBuyingTickets(false)
  }

  const filteredListings = listings.filter(item => {
    if (rarityFilter !== null && item.cardTemplate?.rarity !== rarityFilter) return false
    if (typeFilter !== null && item.cardTemplate?.traitType !== typeFilter) return false
    return true
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
        <button 
          className={`market-tab ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveTab('tickets')}
        >
          BUY_TICKETS
        </button>
        <button className="market-tab">MONSTER_CARDS</button>
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

      {/* Tickets Tab Content */}
      {activeTab === 'tickets' && (
        <div className="topup-content">
          <div className="topup-header">
            <div className="topup-title">GACHA_TICKET_SHOP</div>
            <div className="topup-subtitle">// BUY TICKETS WITH BUG TOKENS</div>
          </div>

          <div className="ticket-balance-row">
            <div className="topup-balance">
              <span className="balance-label">BUG_BALANCE:</span>
              <span className="balance-value">{bugBalance.toLocaleString()} BUG</span>
            </div>
            <div className="topup-balance ticket-balance">
              <span className="balance-label">TICKETS:</span>
              <span className="balance-value ticket-value">{gachaTickets}</span>
            </div>
          </div>

          <div className="ticket-price-info">
            <span className="price-label">PRICE_PER_TICKET:</span>
            <span className="price-value">{ticketPrice} BUG</span>
          </div>

          <div className="topup-options">
            {TICKET_OPTIONS.map((option) => (
              <div key={option.tickets} className="topup-card ticket-card">
                <div className="topup-card-header">
                  <span className="sol-amount ticket-amount">{option.label}</span>
                </div>
                <div className="topup-card-body">
                  <div className="bug-amount ticket-cost">{(ticketPrice * option.tickets).toLocaleString()}</div>
                  <div className="bug-label">BUG COST</div>
                </div>
                <button
                  className="topup-btn ticket-btn"
                  onClick={() => handleBuyTickets(option.tickets)}
                  disabled={isBuyingTickets || !playerProfile || bugBalance < ticketPrice * option.tickets}
                >
                  {isBuyingTickets ? 'PROCESSING...' : 'BUY'}
                </button>
              </div>
            ))}
          </div>

          {ticketStatus && (
            <div className={`topup-status ${ticketStatus.includes('Successfully') ? 'success' : ticketStatus.includes('Insufficient') || ticketStatus.includes('failed') ? 'error' : ''}`}>
              {ticketStatus}
            </div>
          )}

          <div className="topup-info">
            <div className="info-title">TICKET_INFO:</div>
            <div className="info-text">
              • Use tickets to draw cards in Gacha<br/>
              • 1 ticket = 1 card draw<br/>
              • New players get 10 free tickets!
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
              <label className="filter-checkbox">
                <input 
                  type="checkbox" 
                  checked={rarityFilter === null || rarityFilter === Rarity.Common}
                  onChange={() => setRarityFilter(rarityFilter === Rarity.Common ? null : Rarity.Common)}
                />
                <span className="checkbox-icon">☑</span>
                <span>COMMON</span>
              </label>
              <label className="filter-checkbox">
                <input 
                  type="checkbox" 
                  checked={rarityFilter === null || rarityFilter === Rarity.Rare}
                  onChange={() => setRarityFilter(rarityFilter === Rarity.Rare ? null : Rarity.Rare)}
                />
                <span className="checkbox-icon">☑</span>
                <span>RARE</span>
              </label>
              <label className="filter-checkbox">
                <input 
                  type="checkbox" 
                  checked={rarityFilter === null || rarityFilter === Rarity.Legendary}
                  onChange={() => setRarityFilter(rarityFilter === Rarity.Legendary ? null : Rarity.Legendary)}
                />
                <span className="checkbox-icon">☑</span>
                <span>LEGENDARY</span>
              </label>
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
              <button className="inspect-btn">INSPECT</button>
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
    </div>
  )
}

export default Marketplace
