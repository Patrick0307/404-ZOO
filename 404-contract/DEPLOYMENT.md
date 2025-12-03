# 404 ZOO Smart Contract Deployment Guide

## Prerequisites

- Phantom Wallet installed and configured
- Solana Devnet SOL for deployment fees
- Access to Solana Playground (https://beta.solpg.io)

## Deployer Wallet

**Address**: `AGdK1v5mK2MtjrnTHiMUYMLEET2PVmcvf7MwN34se1Gj`

## Step 1: Get Devnet SOL

You need SOL to pay for deployment and account creation fees.

### Option A: Solana CLI
```bash
solana airdrop 2 AGdK1v5mK2MtjrnTHiMUYMLEET2PVmcvf7MwN34se1Gj --url devnet
```

### Option B: Web Faucet
Visit https://faucet.solana.com/ and request an airdrop to your wallet address.

## Step 2: Deploy to Solana Playground

1. Go to https://beta.solpg.io
2. Create a new project or import existing
3. Copy the contents of `Cargo.toml` into the Playground's Cargo.toml
4. Copy the contents of `src/lib.rs` into the Playground's lib.rs
5. Set cluster to **Devnet** (top right)
6. Click **Build** - wait for compilation to complete
7. Click **Deploy** - confirm the transaction in Phantom wallet
8. **Save the Program ID** that appears after deployment

## Step 3: Create BUG Token (Test Token)

You need to create a test SPL token to use as the BUG token.

```bash
# Create token mint
spl-token create-token --decimals 9 --url devnet

# Save the token mint address - you'll need this for initialization
```

## Step 4: Initialize the Contract

Call the `initialize` instruction with:

**Accounts:**
- `game_config`: PDA derived from `["game_config"]`
- `authority`: Your wallet (AGdK1v5mK2MtjrnTHiMUYMLEET2PVmcvf7MwN34se1Gj)
- `system_program`: System Program

**Arguments:**
- `bug_token_mint`: The token mint address from Step 3
- `normal_pack_price`: Price in lamports (e.g., 1000000000 for 1 BUG token)

## Step 5: Set Up Card Templates

### 5.1 Add Card Creators (Optional)

If you want team members to create cards, call `add_card_creator`:

**Accounts:**
- `game_config`: PDA from `["game_config"]`
- `authority`: Your wallet

**Arguments:**
- `new_creator`: Team member's wallet address

### 5.2 Create Card Templates

Call `create_card_template` for each card:

**Accounts:**
- `card_template`: PDA from `["card_template", card_type_id]`
- `game_config`: PDA from `["game_config"]`
- `creator`: Your wallet or authorized creator
- `system_program`: System Program

**Arguments:**
- `card_type_id`: Unique number (e.g., 1, 2, 3...)
- `name`: Card name (max 32 chars)
- `trait_type`: 0=Warrior, 1=Archer, 2=Assassin
- `rarity`: 0=Common, 1=Rare, 2=Epic, 3=Legendary
- `base_attack`: Attack stat (e.g., 100)
- `base_health`: Health stat (e.g., 150)
- `description`: Card description (max 200 chars)
- `image_uri`: IPFS or image URL (max 200 chars)

**Example Cards:**
```
Card 1: "Error Zebra", Warrior, Common, ATK 80, HP 120
Card 2: "Bug Bear", Warrior, Rare, ATK 120, HP 180
Card 3: "Null Pointer", Assassin, Epic, ATK 200, HP 100
Card 4: "Stack Overflow", Archer, Legendary, ATK 250, HP 150
```

### 5.3 Update Rarity Pools

Call `update_rarity_pool` for each rarity:

**Accounts:**
- `rarity_pool`: PDA from `["rarity_pool", rarity_discriminant]`
- `game_config`: PDA from `["game_config"]`
- `authority`: Your wallet
- `system_program`: System Program

**Arguments:**
- `rarity`: 0=Common, 1=Rare, 2=Epic, 3=Legendary
- `card_type_ids`: Array of card IDs for this rarity (e.g., [1, 2, 3])

**Example:**
```
Common pool: [1, 5, 9, 13, 17]
Rare pool: [2, 6, 10, 14, 18]
Epic pool: [3, 7, 11, 15]
Legendary pool: [4, 8, 12, 16]
```

## Step 6: Test the Contract

### Test Player Registration

Call `register_player`:

**Accounts:**
- `player_profile`: PDA from `["player_profile", player_wallet]`
- `player`: Test wallet
- `system_program`: System Program

**Arguments:**
- `username`: Player name (e.g., "TestPlayer")

### Test Starter Pack Claim

Call `claim_starter_pack`:

**Accounts:**
- `player_profile`: Player's profile PDA
- `rarity_pool_common`: Common rarity pool PDA
- `rarity_pool_rare`: Rare rarity pool PDA
- `rarity_pool_epic`: Epic rarity pool PDA
- `rarity_pool_legendary`: Legendary rarity pool PDA
- `player`: Test wallet
- `system_program`: System Program

**Expected Result:** 10 random cards minted (logged in transaction)

## Step 7: Set Up Treasury

Create a token account to hold BUG tokens for rewards:

```bash
spl-token create-account <BUG_TOKEN_MINT> --url devnet
# Save this address as your treasury_bug_token_account
```

Fund it with BUG tokens for match rewards:

```bash
spl-token mint <BUG_TOKEN_MINT> 1000000 <TREASURY_ADDRESS> --url devnet
```

## Important PDAs

All PDAs use the program ID as the base. Here are the seeds:

- **GameConfig**: `["game_config"]`
- **CardTemplate**: `["card_template", card_type_id.to_le_bytes()]`
- **PlayerProfile**: `["player_profile", player_wallet]`
- **RarityPool**: `["rarity_pool", rarity_discriminant]`
  - Common: `["rarity_pool", [0]]`
  - Rare: `["rarity_pool", [1]]`
  - Epic: `["rarity_pool", [2]]`
  - Legendary: `["rarity_pool", [3]]`

## Troubleshooting

### "Account already exists"
- You're trying to initialize something twice
- Check if the account was already created

### "Insufficient funds"
- Get more devnet SOL from the faucet
- Check your wallet balance

### "Invalid instruction data"
- Check that enum values are correct (0-indexed)
- Verify all required accounts are provided

### "Constraint violation"
- Check that PDAs are derived correctly
- Verify authority is correct for admin operations

## Next Steps

After successful deployment and testing on Devnet:

1. Test all instructions thoroughly
2. Have team members test with their wallets
3. Verify randomness distribution over many pack openings
4. Test match result recording
5. When ready, deploy to Mainnet using the same process

## Notes

- The current implementation logs NFT minting but doesn't actually mint via Metaplex
- For production, integrate full Metaplex Token Metadata CPI calls
- Consider implementing fee payer/sponsor accounts for better UX
- Monitor transaction costs and optimize if needed
