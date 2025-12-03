import '../css/DrawerMenu.css'

interface DrawerMenuProps {
  isOpen: boolean
  onToggle: () => void
  onNavigate: (page: 'home' | 'backpack' | 'gacha' | 'marketplace' | 'pokedex' | 'battle' | 'leaderboard' | 'team') => void
  currentPage: string
}

const menuItems = [
  { id: 'home', icon: '🏠', label: '主页' },
  { id: 'team', icon: '👥', label: '组队' },
  { id: 'backpack', icon: '🎒', label: '背包' },
  { id: 'gacha', icon: '🎴', label: '抽卡' },
  { id: 'marketplace', icon: '🏪', label: '市场' },
  { id: 'pokedex', icon: '📖', label: '图鉴' },
  { id: 'battle', icon: '⚔️', label: '对战' },
  { id: 'leaderboard', icon: '🏆', label: '排行榜' },
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
