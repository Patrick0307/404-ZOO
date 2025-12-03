# 404 ZOO Smart Contract

A Solana smart contract for the 404 ZOO card-based merge tactics game. Built with Anchor framework.

## Overview

This contract manages:
- **Card Templates**: Permanent definitions of card types with stats and metadata
- **Player Profiles**: On-chain player data (username, trophies, win/loss records)
- **NFT Cards**: Player-owned card instances (simplified - full Metaplex integration needed)
- **Pack System**: Starter packs and purchasable card packs with rarity-based drops
- **Match Results**: Trophy updates and BUG token rewards

## Features

- ✅ Initialize game configuration
- ✅ Multi-creator card template system
- ✅ Player registration with usernames
- ✅ Free starter pack (10 cards) for new players
- ✅ Pack purchases with BUG tokens
- ✅ Rarity-based card distribution (Common 60%, Rare 25%, Epic 12%, Legendary 3%)
- ✅ Match result recording with trophy and reward distribution
- ✅ Query functions for card templates

## Structure

```
404-contract/
├── Cargo.toml          # Dependencies
├── src/
│   └── lib.rs          # All contract code (Solana Playground compatible)
├── DEPLOYMENT.md       # Deployment guide
└── README.md           # This file
```

## Instructions

### Admin Instructions

1. **initialize** - Set up game configuration
2. **add_card_creator** - Authorize team members to create cards
3. **create_card_template** - Define new card types
4. **update_rarity_pool** - Add cards to rarity pools
5. **record_match_result** - Update player trophies and distribute rewards

### Player Instructions

1. **register_player** - Create player profile
2. **claim_starter_pack** - Get 10 free cards (one-time)
3. **purchase_pack** - Buy card packs with BUG tokens

## Data Structures

### GameConfig
- Authority and authorized card creators
- BUG token mint address
- Pack pricing configuration

### CardTemplate
- Card type ID, name, trait (Warrior/Archer/Assassin)
- Rarity (Common/Rare/Epic/Legendary)
- Base attack and health stats
- Description and image URI

### PlayerProfile
- Wallet address and username
- Trophy count (ranking score)
- Starter pack claim status
- Win/loss statistics

### RarityPool
- Maps rarity to available card type IDs
- Used for random card selection

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Start:**
1. Get devnet SOL
2. Deploy to Solana Playground
3. Create BUG test token
4. Initialize contract
5. Create card templates
6. Update rarity pools
7. Test!

## Testing

The contract includes comprehensive test placeholders for:
- Property-based tests (29 properties)
- Unit tests for each instruction
- Integration tests for complete flows

Tests are structured but not fully implemented - ready for Anchor test framework.

## Development Notes

### Current Limitations

1. **NFT Minting**: Currently logs minting operations but doesn't execute full Metaplex CPI
   - For production: Integrate `mpl-token-metadata` CPI calls
   - Create mint accounts, metadata accounts, and token accounts
   
2. **Randomness**: Uses pseudo-random approach (slot hash + clock + player key)
   - Consider Switchboard VRF or Chainlink VRF for production
   
3. **Gas Fees**: Players need SOL for transactions
   - Consider implementing fee payer/sponsor accounts for better UX

### Future Enhancements

- Full Metaplex NFT integration
- Multiple pack types (premium, mega packs)
- Card trading marketplace
- Tournament system
- Seasonal rankings
- Card burning/crafting

## Tech Stack

- **Language**: Rust
- **Framework**: Anchor 0.29.0
- **Token Standard**: SPL Token (BUG tokens)
- **NFT Standard**: Metaplex Token Metadata (planned)
- **Network**: Solana Devnet → Mainnet

## License

Built for the hackathon. All rights reserved.

## Support

For questions or issues during deployment, refer to:
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Playground](https://beta.solpg.io)
