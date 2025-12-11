import '../css/DrawerMenu.css'

interface DrawerMenuProps {
  isOpen: boolean
  onToggle: () => void
  onNavigate: (page: 'home' | 'backpack' | 'gacha' | 'marketplace' | 'pokedex' | 'battle' | 'leaderboard' | 'team') => void
  currentPage: string
}

const menuItems = [
  { id: 'home', icon: 'HOME', label: '主页' },
  { id: 'team', icon: 'TEAM', label: '组队' },
  { id: 'backpack', icon: 'BAG', label: '背包' },
  { id: 'gacha', icon: 'GACHA', label: '抽卡' },
  { id: 'marketplace', icon: 'MARKET', label: '市场' },
  { id: 'pokedex', icon: 'DEX', label: '图鉴' },
  { id: 'battle', icon: 'BATTLE', label: '对战' },
  { id: 'leaderboard', icon: 'RANK', label: '排行榜' },
] as const

function DrawerMenu({ isOpen, onToggle, onNavigate, currentPage }: DrawerMenuProps) {
  return (
    <div className="drawer-container">
      {isOpen && (
        <div className="drawer-menu">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`menu-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <button 
        className={`drawer-toggle ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
      >
        {isOpen ? '✕' : '☰'}
      </button>
    </div>
  )
}

export default DrawerMenu
