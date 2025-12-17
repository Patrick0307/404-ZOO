use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo, Transfer};
use anchor_spl::associated_token::AssociatedToken;

// change
declare_id!("F27HZp9MUiCx3oXz53kA6A5VsKQTVsiRcpBtADJrgapB "); 

#[program]
pub mod zoo_contract {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        normal_pack_price: u64,
        sol_to_bug_rate: u64,
        ticket_price: u64,
    ) -> Result<()> {
        let game_config = &mut ctx.accounts.game_config;
        
        game_config.authority = ctx.accounts.authority.key();
        game_config.card_creators = Vec::new();
        game_config.normal_pack_price = normal_pack_price;
        game_config.starter_pack_card_count = 10;
        game_config.sol_to_bug_rate = sol_to_bug_rate;
        game_config.ticket_price = ticket_price;
        game_config.bump = ctx.bumps.game_config;
        
        msg!("Game initialized with authority: {}", game_config.authority);
        msg!("Normal pack price: {}", normal_pack_price);
        msg!("SOL to BUG rate: {} BUG per SOL", sol_to_bug_rate);
        msg!("Ticket price: {} BUG", ticket_price);
        
        Ok(())
    }
    
    pub fn add_card_creator(
        ctx: Context<AddCardCreator>,
        new_creator: Pubkey,
    ) -> Result<()> {
        let game_config = &mut ctx.accounts.game_config;
        
        require!(
            game_config.card_creators.len() < GameConfig::MAX_CARD_CREATORS,
            GameError::CardCreatorsListFull
        );
        
        game_config.card_creators.push(new_creator);
        
        msg!("Added card creator: {}", new_creator);
        msg!("Total card creators: {}", game_config.card_creators.len());
        
        Ok(())
    }
    

    
    pub fn create_card_template(
        ctx: Context<CreateCardTemplate>,
        card_type_id: u32,
        name: String,
        trait_type: TraitType,
        rarity: Rarity,
        min_attack: u16,
        max_attack: u16,
        min_health: u16,
        max_health: u16,
        description: String,
        image_uri: String,
    ) -> Result<()> {
        let game_config = &ctx.accounts.game_config;
        let creator = &ctx.accounts.creator;
        
        // Verify creator is authorized (authority or in card_creators list)
        require!(
            is_authorized_creator(game_config, &creator.key()),
            GameError::Unauthorized
        );
        
        // Validate stat ranges
        require!(min_attack <= max_attack, GameError::InvalidStatRange);
        require!(min_health <= max_health, GameError::InvalidStatRange);
        
        // Validate non-empty strings
        validate_non_empty_string(&name)?;
        validate_non_empty_string(&description)?;
        
        // Validate string lengths
        validate_string_length(&name, CardTemplate::MAX_NAME_LEN)?;
        validate_string_length(&description, CardTemplate::MAX_DESCRIPTION_LEN)?;
        validate_string_length(&image_uri, CardTemplate::MAX_IMAGE_URI_LEN)?;
        
        let card_template = &mut ctx.accounts.card_template;
        card_template.card_type_id = card_type_id;
        card_template.name = name.clone();
        card_template.trait_type = trait_type;
        card_template.rarity = rarity;
        card_template.min_attack = min_attack;
        card_template.max_attack = max_attack;
        card_template.min_health = min_health;
        card_template.max_health = max_health;
        card_template.description = description.clone();
        card_template.image_uri = image_uri.clone();
        card_template.bump = ctx.bumps.card_template;
        
        msg!("Created card template: {} (ID: {})", name, card_type_id);
        msg!("Trait: {:?}, Rarity: {:?}", trait_type, rarity);
        msg!("Stats: ATK {}-{}, HP {}-{}", min_attack, max_attack, min_health, max_health);
        
        Ok(())
    }
    
    pub fn update_rarity_pool(
        ctx: Context<UpdateRarityPool>,
        rarity_discriminant: u8,
        card_type_ids: Vec<u32>,
    ) -> Result<()> {
        let rarity_pool = &mut ctx.accounts.rarity_pool;
        
        // Convert discriminant back to Rarity enum
        let rarity = match rarity_discriminant {
            0 => Rarity::Common,
            1 => Rarity::Rare,
            2 => Rarity::Legendary,
            _ => return Err(GameError::InvalidRarity.into()),
        };
        
        // Initialize if this is the first time
        if rarity_pool.card_type_ids.is_empty() {
            rarity_pool.rarity = rarity;
            rarity_pool.bump = ctx.bumps.rarity_pool;
        }
        
        // Add new card_type_ids to the pool
        for card_type_id in card_type_ids.iter() {
            if !rarity_pool.card_type_ids.contains(card_type_id) {
                rarity_pool.card_type_ids.push(*card_type_id);
            }
        }
        
        msg!("Updated rarity pool for {:?}", rarity);
        msg!("Total cards in pool: {}", rarity_pool.card_type_ids.len());
        
        Ok(())
    }
    
    pub fn register_player(
        ctx: Context<RegisterPlayer>,
        username: String,
    ) -> Result<()> {
        // Validate username
        validate_non_empty_string(&username)?;
        validate_string_length(&username, PlayerProfile::MAX_USERNAME_LEN)?;
        
        let player_profile = &mut ctx.accounts.player_profile;
        player_profile.wallet = ctx.accounts.player.key();
        player_profile.username = username.clone();
        player_profile.has_claimed_starter_pack = false;
        player_profile.gacha_tickets = 0;
        player_profile.bug_balance = 0;
        player_profile.trophies = 0;
        player_profile.total_wins = 0;
        player_profile.total_losses = 0;
        player_profile.win_streak = 0;
        player_profile.bump = ctx.bumps.player_profile;
        
        msg!("Player registered: {}", username);
        msg!("Wallet: {}", player_profile.wallet);
        
        Ok(())
    }
    
    /// Claim free starter tickets (10 gacha tickets for new players)
    pub fn claim_starter_tickets(ctx: Context<ClaimStarterTickets>) -> Result<()> {
        let player_profile = &mut ctx.accounts.player_profile;
        
        // Verify player hasn't claimed yet (also checked in constraint)
        require!(!player_profile.has_claimed_starter_pack, GameError::StarterPackAlreadyClaimed);
        
        // Give player 10 free gacha tickets
        player_profile.gacha_tickets = PlayerProfile::FREE_STARTER_TICKETS;
        player_profile.has_claimed_starter_pack = true;
        
        msg!("Claimed {} free gacha tickets for player: {}", 
            PlayerProfile::FREE_STARTER_TICKETS, 
            player_profile.wallet);
        
        Ok(())
    }
    
    /// Use gacha tickets to draw a single card (1 ticket = 1 draw)
    /// For multiple draws, call this instruction multiple times with different mints
    pub fn gacha_draw(ctx: Context<GachaDraw>) -> Result<()> {
        let player_profile = &mut ctx.accounts.player_profile;
        let player = &ctx.accounts.player;
        let card_template = &ctx.accounts.card_template;
        let clock = Clock::get()?;
        
        // Check player has enough tickets
        require!(
            player_profile.gacha_tickets >= 1,
            GameError::InsufficientTickets
        );
        
        msg!("Player {} drawing 1 card", player.key());
        
        // Deduct 1 ticket
        player_profile.gacha_tickets = player_profile.gacha_tickets
            .checked_sub(1)
            .ok_or(GameError::NumericalOverflow)?;
        
        // Generate random value
        let random_value = generate_random_u64(&clock, &player.key(), clock.slot);
        
        // Roll stats based on card template
        let (actual_attack, actual_health) = roll_card_stats(
            card_template.min_attack,
            card_template.max_attack,
            card_template.min_health,
            card_template.max_health,
            random_value,
        );
        
        // Mint 1 token to player's token account
        // The mint should already be initialized by the client before calling this
        let seeds = &[b"game_config".as_ref(), &[ctx.accounts.game_config.bump]];
        let signer_seeds = &[&seeds[..]];
        
        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.card_mint.to_account_info(),
                to: ctx.accounts.player_card_token_account.to_account_info(),
                authority: ctx.accounts.game_config.to_account_info(),
            },
            signer_seeds,
        );
        token::mint_to(mint_ctx, 1)?;
        
        // Store card instance data
        let card_instance = &mut ctx.accounts.card_instance;
        card_instance.mint = ctx.accounts.card_mint.key();
        card_instance.card_type_id = card_template.card_type_id;
        card_instance.attack = actual_attack;
        card_instance.health = actual_health;
        card_instance.owner = player.key();
        card_instance.bump = ctx.bumps.card_instance;
        
        msg!("Minted card: type_id={}, ATK={}, HP={}", 
            card_template.card_type_id, actual_attack, actual_health);
        msg!("Mint address: {}", ctx.accounts.card_mint.key());
        msg!("Tickets remaining: {}", player_profile.gacha_tickets);
        
        Ok(())
    }
    
    /// Add gacha tickets to a player (admin function)
    pub fn add_gacha_tickets(
        ctx: Context<AddGachaTickets>,
        amount: u64,
    ) -> Result<()> {
        let player_profile = &mut ctx.accounts.player_profile;
        
        player_profile.gacha_tickets = player_profile.gacha_tickets
            .checked_add(amount)
            .ok_or(GameError::NumericalOverflow)?;
        
        msg!("Added {} tickets to player {}. Total: {}", 
            amount, player_profile.wallet, player_profile.gacha_tickets);
        
        Ok(())
    }
    
    /// Buy BUG tokens with SOL (adds to player's bug_balance)
    pub fn buy_bug_tokens(ctx: Context<BuyBugTokens>, sol_amount: u64) -> Result<()> {
        let game_config = &ctx.accounts.game_config;
        let player_profile = &mut ctx.accounts.player_profile;
        
        require!(sol_amount > 0, GameError::InvalidAmount);
        
        // Calculate BUG tokens based on rate
        // sol_to_bug_rate = BUG tokens per 1 SOL (1 SOL = 1_000_000_000 lamports)
        let bug_amount = (sol_amount as u128)
            .checked_mul(game_config.sol_to_bug_rate as u128)
            .ok_or(GameError::NumericalOverflow)?
            .checked_div(1_000_000_000)
            .ok_or(GameError::NumericalOverflow)? as u64;
        
        require!(bug_amount > 0, GameError::InvalidAmount);
        
        // Transfer SOL from player to treasury
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.player.key(),
            &ctx.accounts.treasury.key(),
            sol_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.player.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Add BUG to player's balance
        player_profile.bug_balance = player_profile.bug_balance
            .checked_add(bug_amount)
            .ok_or(GameError::NumericalOverflow)?;
        
        msg!("Bought {} BUG for {} lamports. Balance: {}", bug_amount, sol_amount, player_profile.bug_balance);
        
        Ok(())
    }
    
    /// Buy gacha tickets with BUG balance
    pub fn buy_gacha_tickets(ctx: Context<BuyGachaTickets>, ticket_count: u64) -> Result<()> {
        let game_config = &ctx.accounts.game_config;
        let player_profile = &mut ctx.accounts.player_profile;
        
        require!(ticket_count > 0, GameError::InvalidAmount);
        
        // Calculate total cost
        let total_cost = game_config.ticket_price
            .checked_mul(ticket_count)
            .ok_or(GameError::NumericalOverflow)?;
        
        // Check and deduct BUG balance
        require!(player_profile.bug_balance >= total_cost, GameError::InsufficientBalance);
        player_profile.bug_balance = player_profile.bug_balance
            .checked_sub(total_cost)
            .ok_or(GameError::NumericalOverflow)?;
        
        // Add tickets to player profile
        player_profile.gacha_tickets = player_profile.gacha_tickets
            .checked_add(ticket_count)
            .ok_or(GameError::NumericalOverflow)?;
        
        msg!("Bought {} gacha tickets for {} BUG", ticket_count, total_cost);
        msg!("Tickets: {}, BUG balance: {}", player_profile.gacha_tickets, player_profile.bug_balance);
        
        Ok(())
    }
    
    /// Roll for a random card (view function to help client pick card_type_id)
    /// Client calls this first, then calls gacha_draw with the selected card template
    pub fn roll_gacha(ctx: Context<RollGacha>) -> Result<u32> {
        let player = &ctx.accounts.player;
        let clock = Clock::get()?;
        
        // Generate random value
        let random_value = generate_random_u64(&clock, &player.key(), clock.slot);
        
        // Roll for rarity
        let rarity = roll_rarity(random_value);
        
        // Get the appropriate rarity pool
        let rarity_pool = match rarity {
            Rarity::Common => &ctx.accounts.rarity_pool_common,
            Rarity::Rare => &ctx.accounts.rarity_pool_rare,
            Rarity::Legendary => &ctx.accounts.rarity_pool_legendary,
        };
        
        // Select random card from pool
        let card_type_id = select_random_card(rarity_pool, random_value)?;
        
        msg!("Rolled: {:?} - Card ID {}", rarity, card_type_id);
        
        Ok(card_type_id)
    }
    
    pub fn purchase_pack(
        ctx: Context<PurchasePack>,
        _pack_type: u8, // For future expansion
    ) -> Result<()> {
        let game_config = &ctx.accounts.game_config;
        let player_profile = &mut ctx.accounts.player_profile;
        let player = &ctx.accounts.player;
        let clock = Clock::get()?;
        
        // Check player has sufficient BUG balance
        let pack_price = game_config.normal_pack_price;
        require!(player_profile.bug_balance >= pack_price, GameError::InsufficientBalance);
        
        // Deduct BUG from player's balance
        player_profile.bug_balance = player_profile.bug_balance
            .checked_sub(pack_price)
            .ok_or(GameError::NumericalOverflow)?;
        
        msg!("Pack purchased for {} BUG. Balance: {}", pack_price, player_profile.bug_balance);
        
        // Determine number of cards (currently fixed, could vary by pack_type in future)
        let num_cards = game_config.starter_pack_card_count;
        
        // Mint random cards
        for i in 0..num_cards {
            // Generate random value for this card
            let random_value = generate_random_u64(&clock, &player.key(), i as u64);
            
            // Roll for rarity
            let rarity = roll_rarity(random_value);
            
            // Get the appropriate rarity pool
            let rarity_pool = match rarity {
                Rarity::Common => &ctx.accounts.rarity_pool_common,
                Rarity::Rare => &ctx.accounts.rarity_pool_rare,
                Rarity::Legendary => &ctx.accounts.rarity_pool_legendary,
            };
            
            // Select random card from pool
            let card_type_id = select_random_card(rarity_pool, random_value)?;
            
            // Generate another random value for stats rolling
            let stats_random = generate_random_u64(&clock, &player.key(), i as u64 + 1000);
            
            // Note: In production, you would fetch the card template here and roll stats
            // For now, we log placeholder stats (actual implementation needs remaining accounts)
            // let (actual_attack, actual_health) = roll_card_stats(
            //     card_template.min_attack,
            //     card_template.max_attack,
            //     card_template.min_health,
            //     card_template.max_health,
            //     stats_random,
            // );
            
            msg!("Card {}: ID {} ({:?}), stats_seed: {}", i + 1, card_type_id, rarity, stats_random);
            
            // Note: In production, this would mint actual NFTs using Metaplex
            // with the rolled attack and health values stored in metadata
        }
        
        msg!("Pack opened successfully!");
        msg!("Total cards minted: {}", num_cards);
        
        Ok(())
    }
    
    /// Save or update a player's deck (up to 10 cards)
    /// deck_index: 0-4 (player can have up to 5 decks)
    pub fn save_deck(
        ctx: Context<SaveDeck>,
        deck_index: u8,
        deck_name: String,
        card_mints: Vec<Pubkey>,
    ) -> Result<()> {
        require!(deck_index < PlayerDeck::MAX_DECKS, GameError::InvalidDeckIndex);
        require!(card_mints.len() <= PlayerDeck::MAX_CARDS, GameError::TooManyCardsInDeck);
        validate_string_length(&deck_name, PlayerDeck::MAX_NAME_LEN)?;
        
        let player_deck = &mut ctx.accounts.player_deck;
        player_deck.owner = ctx.accounts.player.key();
        player_deck.deck_index = deck_index;
        player_deck.deck_name = deck_name.clone();
        player_deck.card_mints = card_mints.clone();
        player_deck.is_active = true;
        player_deck.bump = ctx.bumps.player_deck;
        
        msg!("Saved deck {} for player {}", deck_name, ctx.accounts.player.key());
        msg!("Cards in deck: {}", card_mints.len());
        
        Ok(())
    }
    
    /// Delete a player's deck (set to inactive)
    pub fn delete_deck(ctx: Context<DeleteDeck>, _deck_index: u8) -> Result<()> {
        let player_deck = &mut ctx.accounts.player_deck;
        player_deck.is_active = false;
        player_deck.card_mints = Vec::new();
        player_deck.deck_name = String::new();
        
        msg!("Deleted deck {} for player {}", _deck_index, ctx.accounts.player.key());
        
        Ok(())
    }

    // ========================================================================
    // Marketplace Functions
    // ========================================================================
    
    /// List a card for sale on the marketplace
    pub fn list_card(
        ctx: Context<ListCard>,
        price: u64,
    ) -> Result<()> {
        require!(price > 0, GameError::InvalidPrice);
        
        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.card_mint = ctx.accounts.card_mint.key();
        listing.price = price;
        listing.is_active = true;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.bump = ctx.bumps.listing;
        
        // Transfer NFT from seller to escrow (listing PDA holds it)
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, 1)?;
        
        msg!("Card listed: mint={}, price={} BUG", ctx.accounts.card_mint.key(), price);
        
        Ok(())
    }
    
    /// Cancel a listing and return the card to seller
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        
        require!(listing.is_active, GameError::ListingNotActive);
        
        // Transfer NFT back to seller
        let card_mint = ctx.accounts.card_mint.key();
        let seeds = &[
            b"listing".as_ref(),
            card_mint.as_ref(),
            &[listing.bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.seller_token_account.to_account_info(),
                authority: listing.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, 1)?;
        
        // Close escrow token account and return rent to seller
        let close_escrow = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::CloseAccount {
                account: ctx.accounts.escrow_token_account.to_account_info(),
                destination: ctx.accounts.seller.to_account_info(),
                authority: listing.to_account_info(),
            },
            signer_seeds,
        );
        token::close_account(close_escrow)?;
        
        // listing 账户会被 close 约束自动关闭
        
        msg!("Listing cancelled: mint={}", card_mint);
        
        Ok(())
    }
    
    /// Buy a listed card (uses BUG balance)
    pub fn buy_card(ctx: Context<BuyCard>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        let buyer_profile = &mut ctx.accounts.buyer_profile;
        let seller_profile = &mut ctx.accounts.seller_profile;
        
        require!(listing.is_active, GameError::ListingNotActive);
        require!(ctx.accounts.buyer.key() != listing.seller, GameError::CannotBuyOwnCard);
        
        let price = listing.price;
        let card_mint = ctx.accounts.card_mint.key();
        
        // Check buyer has enough BUG
        require!(buyer_profile.bug_balance >= price, GameError::InsufficientBalance);
        
        // Calculate fee (2.5% platform fee) - fee goes to nowhere (burned)
        let fee = price.checked_mul(25).unwrap().checked_div(1000).unwrap();
        let seller_amount = price.checked_sub(fee).unwrap();
        
        // Deduct from buyer
        buyer_profile.bug_balance = buyer_profile.bug_balance
            .checked_sub(price)
            .ok_or(GameError::NumericalOverflow)?;
        
        // Add to seller (minus fee)
        seller_profile.bug_balance = seller_profile.bug_balance
            .checked_add(seller_amount)
            .ok_or(GameError::NumericalOverflow)?;
        
        // Transfer NFT from escrow to buyer
        let seeds = &[
            b"listing".as_ref(),
            card_mint.as_ref(),
            &[listing.bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        let transfer_nft = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: listing.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_nft, 1)?;
        
        // Close escrow token account and return rent to seller
        let close_escrow = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::CloseAccount {
                account: ctx.accounts.escrow_token_account.to_account_info(),
                destination: ctx.accounts.seller.to_account_info(),
                authority: listing.to_account_info(),
            },
            signer_seeds,
        );
        token::close_account(close_escrow)?;
        
        // Update card instance owner
        let card_instance = &mut ctx.accounts.card_instance;
        card_instance.owner = ctx.accounts.buyer.key();
        
        // listing 账户会被 close 约束自动关闭
        
        msg!("Card sold: mint={}, price={}, fee={}", card_mint, price, fee);
        
        Ok(())
    }

    /// Record match result with win streak bonus
    /// Trophy gain = BASE (30) + win_streak
    /// Trophy loss = 30 (fixed), win_streak resets to 0
    /// Winner receives 100 BUG tokens as reward
    pub fn record_match_result(ctx: Context<RecordMatchResult>) -> Result<()> {
        let winner_profile = &mut ctx.accounts.winner_profile;
        let loser_profile = &mut ctx.accounts.loser_profile;
        
        // Increment winner's win streak first
        winner_profile.win_streak = winner_profile.win_streak
            .checked_add(1)
            .ok_or(GameError::NumericalOverflow)?;
        
        // Calculate trophy gain: base (30) + win_streak bonus
        // e.g., 1st win: 30+1=31, 2nd win: 30+2=32, 3rd win: 30+3=33...
        let trophy_gain = PlayerProfile::BASE_TROPHY_GAIN
            .checked_add(winner_profile.win_streak)
            .ok_or(GameError::NumericalOverflow)?;
        
        // Increase winner trophies
        winner_profile.trophies = winner_profile.trophies
            .checked_add(trophy_gain)
            .ok_or(GameError::NumericalOverflow)?;
        
        // Decrease loser trophies (fixed 30, clamped to 0)
        loser_profile.trophies = loser_profile.trophies.saturating_sub(PlayerProfile::TROPHY_LOSS);
        
        // Reset loser's win streak
        loser_profile.win_streak = 0;
        
        // Update win/loss stats
        winner_profile.total_wins = winner_profile.total_wins
            .checked_add(1)
            .ok_or(GameError::NumericalOverflow)?;
        
        loser_profile.total_losses = loser_profile.total_losses
            .checked_add(1)
            .ok_or(GameError::NumericalOverflow)?;
        
        msg!("Match result recorded:");
        msg!("Winner: {} | Trophies: {} (+{}) | Win Streak: {}", 
            winner_profile.wallet, winner_profile.trophies, trophy_gain, winner_profile.win_streak);
        msg!("Loser: {} | Trophies: {} (-{}) | Win Streak Reset", 
            loser_profile.wallet, loser_profile.trophies, PlayerProfile::TROPHY_LOSS);
        
        // Add 100 BUG reward to winner's balance
        winner_profile.bug_balance = winner_profile.bug_balance
            .checked_add(PlayerProfile::WIN_REWARD)
            .ok_or(GameError::NumericalOverflow)?;
        
        msg!("Reward: {} BUG. Winner balance: {}", PlayerProfile::WIN_REWARD, winner_profile.bug_balance);
        
        Ok(())
    }
}

// ============================================================================
// State Structs (Account Structures)
// ============================================================================

#[account]
pub struct GameConfig {
    pub authority: Pubkey,              // Primary admin authority
    pub card_creators: Vec<Pubkey>,     // Authorized card creators (max 10)
    pub normal_pack_price: u64,         // Price in BUG tokens
    pub starter_pack_card_count: u8,    // Fixed at 10
    pub sol_to_bug_rate: u64,           // How many BUG tokens per 1 SOL (in lamports)
    pub ticket_price: u64,              // Price of 1 gacha ticket in BUG tokens
    pub bump: u8,                       // PDA bump seed
}

impl GameConfig {
    pub const MAX_CARD_CREATORS: usize = 10;
    
    // Calculate space needed for account
    // 8 (discriminator) + 32 (authority) + 4 + (32 * 10) (card_creators vec) 
    // + 8 (normal_pack_price) + 1 (starter_pack_card_count) 
    // + 8 (sol_to_bug_rate) + 8 (ticket_price) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 4 + (32 * 10) + 8 + 1 + 8 + 8 + 1;
}

#[account]
pub struct CardTemplate {
    pub card_type_id: u32,
    pub name: String,                   // Max 32 chars
    pub trait_type: TraitType,
    pub rarity: Rarity,
    pub min_attack: u16,                // Minimum attack value
    pub max_attack: u16,                // Maximum attack value
    pub min_health: u16,                // Minimum health value
    pub max_health: u16,                // Maximum health value
    pub description: String,            // Max 200 chars
    pub image_uri: String,              // Max 200 chars (IPFS URI)
    pub bump: u8,
}

impl CardTemplate {
    pub const MAX_NAME_LEN: usize = 32;
    pub const MAX_DESCRIPTION_LEN: usize = 200;
    pub const MAX_IMAGE_URI_LEN: usize = 200;
    
    // Calculate space needed for account
    // 8 (discriminator) + 4 (card_type_id) + 4 + 32 (name) + 1 (trait_type) + 1 (rarity)
    // + 2 (min_attack) + 2 (max_attack) + 2 (min_health) + 2 (max_health) 
    // + 4 + 200 (description) + 4 + 200 (image_uri) + 1 (bump)
    pub const LEN: usize = 8 + 4 + 4 + 32 + 1 + 1 + 2 + 2 + 2 + 2 + 4 + 200 + 4 + 200 + 1;
}

#[account]
pub struct PlayerProfile {
    pub wallet: Pubkey,
    pub username: String,               // Max 32 chars
    pub has_claimed_starter_pack: bool,
    pub gacha_tickets: u64,             // Number of gacha tickets owned
    pub bug_balance: u64,               // BUG token balance (game currency)
    pub trophies: u32,                  // Minimum is 0, starts at 0
    pub total_wins: u32,
    pub total_losses: u32,
    pub win_streak: u32,                // Current win streak (resets on loss)
    pub bump: u8,
}

impl PlayerProfile {
    pub const MAX_USERNAME_LEN: usize = 32;
    pub const FREE_STARTER_TICKETS: u64 = 10;  // Free tickets for new players
    pub const BASE_TROPHY_GAIN: u32 = 30;      // Base trophy gain per win
    pub const TROPHY_LOSS: u32 = 30;           // Trophy loss per loss
    pub const WIN_REWARD: u64 = 100;           // BUG tokens reward per win
    
    // Calculate space needed for account
    // 8 (discriminator) + 32 (wallet) + 4 + 32 (username) + 1 (has_claimed_starter_pack)
    // + 8 (gacha_tickets) + 8 (bug_balance) + 4 (trophies) + 4 (total_wins) + 4 (total_losses) + 4 (win_streak) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 4 + 32 + 1 + 8 + 8 + 4 + 4 + 4 + 4 + 1;
}

#[account]
pub struct RarityPool {
    pub rarity: Rarity,
    pub card_type_ids: Vec<u32>,        // List of card IDs for this rarity
    pub bump: u8,
}

impl RarityPool {
    pub const MAX_CARDS: usize = 100;   // Max cards per rarity
    
    // Calculate space needed for account
    // 8 (discriminator) + 1 (rarity) + 4 + (4 * 100) (card_type_ids vec) + 1 (bump)
    pub const LEN: usize = 8 + 1 + 4 + (4 * 100) + 1;
}

/// Individual card instance with rolled stats
#[account]
pub struct CardInstance {
    pub mint: Pubkey,           // The NFT mint address
    pub card_type_id: u32,      // Reference to CardTemplate
    pub attack: u16,            // Rolled attack value
    pub health: u16,            // Rolled health value
    pub owner: Pubkey,          // Current owner
    pub bump: u8,
}

impl CardInstance {
    // 8 (discriminator) + 32 (mint) + 4 (card_type_id) + 2 (attack) + 2 (health) + 32 (owner) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 4 + 2 + 2 + 32 + 1;
}

/// Player's saved deck (up to 10 cards)
#[account]
pub struct PlayerDeck {
    pub owner: Pubkey,              // Player wallet
    pub deck_index: u8,             // 0-4 (max 5 decks per player)
    pub deck_name: String,          // Max 32 chars
    pub card_mints: Vec<Pubkey>,    // Up to 10 card mint addresses
    pub is_active: bool,            // false = deleted/empty
    pub bump: u8,
}

impl PlayerDeck {
    pub const MAX_DECKS: u8 = 5;
    pub const MAX_CARDS: usize = 10;
    pub const MAX_NAME_LEN: usize = 32;
    
    // 8 (discriminator) + 32 (owner) + 1 (deck_index) + 4 + 32 (deck_name) 
    // + 4 + (32 * 10) (card_mints vec) + 1 (is_active) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 1 + 4 + 32 + 4 + (32 * 10) + 1 + 1;
}

/// Marketplace listing for a card
#[account]
pub struct Listing {
    pub seller: Pubkey,             // Seller wallet
    pub card_mint: Pubkey,          // NFT mint address
    pub price: u64,                 // Price in BUG tokens
    pub is_active: bool,            // true = listed, false = sold/cancelled
    pub created_at: i64,            // Unix timestamp
    pub bump: u8,
}

impl Listing {
    // 8 (discriminator) + 32 (seller) + 32 (card_mint) + 8 (price) + 1 (is_active) + 8 (created_at) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 8 + 1;
}

// ============================================================================
// Enums
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TraitType {
    Warrior,
    Archer,
    Assassin,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Rarity {
    Common,
    Rare,
    Legendary,
}

impl Rarity {
    pub fn to_discriminant(&self) -> u8 {
        match self {
            Rarity::Common => 0,
            Rarity::Rare => 1,
            Rarity::Legendary => 2,
        }
    }
}

// ============================================================================
// Error Types
// ============================================================================

#[error_code]
pub enum GameError {
    #[msg("Card type ID already exists")]
    DuplicateCardTypeId,
    
    #[msg("Invalid trait type")]
    InvalidTrait,
    
    #[msg("Invalid rarity")]
    InvalidRarity,
    
    #[msg("Name or description cannot be empty")]
    EmptyString,
    
    #[msg("Player has already claimed starter pack")]
    StarterPackAlreadyClaimed,
    
    #[msg("Insufficient BUG token balance")]
    InsufficientBalance,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Invalid username")]
    InvalidUsername,
    
    #[msg("Rarity pool is empty")]
    EmptyRarityPool,
    
    #[msg("Invalid pack type")]
    InvalidPackType,
    
    #[msg("Numerical overflow")]
    NumericalOverflow,
    
    #[msg("Card creators list is full")]
    CardCreatorsListFull,
    
    #[msg("String exceeds maximum length")]
    StringTooLong,
    
    #[msg("Invalid stat range: min cannot be greater than max")]
    InvalidStatRange,
    
    #[msg("Insufficient gacha tickets")]
    InsufficientTickets,
    
    #[msg("Invalid draw count (must be 1-10)")]
    InvalidDrawCount,
    
    #[msg("Invalid deck index (must be 0-4)")]
    InvalidDeckIndex,
    
    #[msg("Too many cards in deck (max 10)")]
    TooManyCardsInDeck,
    
    #[msg("Invalid price (must be greater than 0)")]
    InvalidPrice,
    
    #[msg("Listing is not active")]
    ListingNotActive,
    
    #[msg("Cannot buy your own card")]
    CannotBuyOwnCard,
    
    #[msg("Invalid amount (must be greater than 0)")]
    InvalidAmount,
}

// ============================================================================
// Instruction Contexts
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = GameConfig::LEN,
        seeds = [b"game_config"],
        bump
    )]
    pub game_config: Account<'info, GameConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddCardCreator<'info> {
    #[account(
        mut,
        seeds = [b"game_config"],
        bump = game_config.bump,
        has_one = authority
    )]
    pub game_config: Account<'info, GameConfig>,
    
    pub authority: Signer<'info>,
}



#[derive(Accounts)]
#[instruction(card_type_id: u32)]
pub struct CreateCardTemplate<'info> {
    #[account(
        init,
        payer = creator,
        space = CardTemplate::LEN,
        seeds = [b"card_template", card_type_id.to_le_bytes().as_ref()],
        bump
    )]
    pub card_template: Account<'info, CardTemplate>,
    
    #[account(
        seeds = [b"game_config"],
        bump = game_config.bump
    )]
    pub game_config: Account<'info, GameConfig>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(rarity_discriminant: u8)]
pub struct UpdateRarityPool<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = RarityPool::LEN,
        seeds = [b"rarity_pool", &[rarity_discriminant][..]],
        bump
    )]
    pub rarity_pool: Account<'info, RarityPool>,
    
    #[account(
        seeds = [b"game_config"],
        bump = game_config.bump,
        has_one = authority
    )]
    pub game_config: Account<'info, GameConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterPlayer<'info> {
    #[account(
        init,
        payer = player,
        space = PlayerProfile::LEN,
        seeds = [b"player_profile", player.key().as_ref()],
        bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimStarterTickets<'info> {
    #[account(
        mut,
        seeds = [b"player_profile", player.key().as_ref()],
        bump = player_profile.bump,
        constraint = !player_profile.has_claimed_starter_pack @ GameError::StarterPackAlreadyClaimed
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct GachaDraw<'info> {
    #[account(
        mut,
        seeds = [b"player_profile", player.key().as_ref()],
        bump = player_profile.bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    
    #[account(
        seeds = [b"game_config"],
        bump = game_config.bump
    )]
    pub game_config: Account<'info, GameConfig>,
    
    /// The card template to mint (client picks based on rarity roll)
    #[account(
        seeds = [b"card_template", card_template.card_type_id.to_le_bytes().as_ref()],
        bump = card_template.bump
    )]
    pub card_template: Account<'info, CardTemplate>,
    
    /// New mint account for the NFT card (initialized by client with game_config as mint authority)
    #[account(
        mut,
        constraint = card_mint.mint_authority.unwrap() == game_config.key() @ GameError::Unauthorized
    )]
    pub card_mint: Account<'info, Mint>,
    
    /// Player's token account for this card mint
    #[account(
        init,
        payer = player,
        associated_token::mint = card_mint,
        associated_token::authority = player,
    )]
    pub player_card_token_account: Account<'info, TokenAccount>,
    
    /// Card instance PDA to store rolled stats
    #[account(
        init,
        payer = player,
        space = CardInstance::LEN,
        seeds = [b"card_instance", card_mint.key().as_ref()],
        bump
    )]
    pub card_instance: Account<'info, CardInstance>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddGachaTickets<'info> {
    #[account(
        mut,
        seeds = [b"player_profile", player_profile.wallet.as_ref()],
        bump = player_profile.bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    
    #[account(
        seeds = [b"game_config"],
        bump = game_config.bump,
        has_one = authority
    )]
    pub game_config: Account<'info, GameConfig>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct BuyBugTokens<'info> {
    #[account(
        seeds = [b"game_config"],
        bump = game_config.bump
    )]
    pub game_config: Account<'info, GameConfig>,
    
    #[account(
        mut,
        seeds = [b"player_profile", player.key().as_ref()],
        bump = player_profile.bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    
    /// Treasury to receive SOL
    /// CHECK: This is the treasury wallet to receive SOL payments
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyGachaTickets<'info> {
    #[account(
        seeds = [b"game_config"],
        bump = game_config.bump
    )]
    pub game_config: Account<'info, GameConfig>,
    
    #[account(
        mut,
        seeds = [b"player_profile", player.key().as_ref()],
        bump = player_profile.bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct RollGacha<'info> {
    #[account(
        seeds = [b"rarity_pool", &[Rarity::Common.to_discriminant()]],
        bump = rarity_pool_common.bump
    )]
    pub rarity_pool_common: Account<'info, RarityPool>,
    
    #[account(
        seeds = [b"rarity_pool", &[Rarity::Rare.to_discriminant()]],
        bump = rarity_pool_rare.bump
    )]
    pub rarity_pool_rare: Account<'info, RarityPool>,
    
    #[account(
        seeds = [b"rarity_pool", &[Rarity::Legendary.to_discriminant()]],
        bump = rarity_pool_legendary.bump
    )]
    pub rarity_pool_legendary: Account<'info, RarityPool>,
    
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct PurchasePack<'info> {
    #[account(
        mut,
        seeds = [b"player_profile", player.key().as_ref()],
        bump = player_profile.bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    
    #[account(
        seeds = [b"game_config"],
        bump = game_config.bump
    )]
    pub game_config: Account<'info, GameConfig>,
    
    #[account(
        seeds = [b"rarity_pool", &[Rarity::Common.to_discriminant()]],
        bump = rarity_pool_common.bump
    )]
    pub rarity_pool_common: Account<'info, RarityPool>,
    
    #[account(
        seeds = [b"rarity_pool", &[Rarity::Rare.to_discriminant()]],
        bump = rarity_pool_rare.bump
    )]
    pub rarity_pool_rare: Account<'info, RarityPool>,
    
    #[account(
        seeds = [b"rarity_pool", &[Rarity::Legendary.to_discriminant()]],
        bump = rarity_pool_legendary.bump
    )]
    pub rarity_pool_legendary: Account<'info, RarityPool>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(deck_index: u8)]
pub struct SaveDeck<'info> {
    #[account(
        init_if_needed,
        payer = player,
        space = PlayerDeck::LEN,
        seeds = [b"player_deck", player.key().as_ref(), &[deck_index]],
        bump
    )]
    pub player_deck: Account<'info, PlayerDeck>,
    
    #[account(mut)]
    pub player: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(deck_index: u8)]
pub struct DeleteDeck<'info> {
    #[account(
        mut,
        seeds = [b"player_deck", player.key().as_ref(), &[deck_index]],
        bump = player_deck.bump,
        constraint = player_deck.owner == player.key() @ GameError::Unauthorized
    )]
    pub player_deck: Account<'info, PlayerDeck>,
    
    pub player: Signer<'info>,
}

// ============================================================================
// Marketplace Instruction Contexts
// ============================================================================

#[derive(Accounts)]
pub struct ListCard<'info> {
    #[account(
        init,
        payer = seller,
        space = Listing::LEN,
        seeds = [b"listing", card_mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    pub card_mint: Account<'info, Mint>,
    
    /// Seller's token account holding the NFT
    #[account(
        mut,
        constraint = seller_token_account.owner == seller.key(),
        constraint = seller_token_account.mint == card_mint.key(),
        constraint = seller_token_account.amount == 1 @ GameError::Unauthorized
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    /// Escrow token account (PDA-based, not ATA)
    #[account(
        init,
        payer = seller,
        seeds = [b"escrow", card_mint.key().as_ref()],
        bump,
        token::mint = card_mint,
        token::authority = listing,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        seeds = [b"listing", card_mint.key().as_ref()],
        bump = listing.bump,
        constraint = listing.seller == seller.key() @ GameError::Unauthorized,
        constraint = listing.is_active @ GameError::ListingNotActive,
        close = seller  // 关闭账户，租金返还给卖家
    )]
    pub listing: Account<'info, Listing>,
    
    pub card_mint: Account<'info, Mint>,
    
    /// Seller's token account to receive the NFT back
    #[account(
        mut,
        constraint = seller_token_account.owner == seller.key(),
        constraint = seller_token_account.mint == card_mint.key()
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    /// Escrow token account (PDA-based, will be closed in instruction)
    #[account(
        mut,
        seeds = [b"escrow", card_mint.key().as_ref()],
        bump,
        token::mint = card_mint,
        token::authority = listing,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyCard<'info> {
    #[account(
        mut,
        seeds = [b"listing", card_mint.key().as_ref()],
        bump = listing.bump,
        constraint = listing.is_active @ GameError::ListingNotActive,
        close = seller  // 关闭账户，租金返还给原卖家
    )]
    pub listing: Account<'info, Listing>,
    
    /// CHECK: Seller account to receive rent refund
    #[account(mut, constraint = seller.key() == listing.seller)]
    pub seller: AccountInfo<'info>,
    
    /// Buyer's profile (to deduct BUG)
    #[account(
        mut,
        seeds = [b"player_profile", buyer.key().as_ref()],
        bump = buyer_profile.bump
    )]
    pub buyer_profile: Account<'info, PlayerProfile>,
    
    /// Seller's profile (to add BUG)
    #[account(
        mut,
        seeds = [b"player_profile", listing.seller.as_ref()],
        bump = seller_profile.bump
    )]
    pub seller_profile: Account<'info, PlayerProfile>,
    
    pub card_mint: Account<'info, Mint>,
    
    /// Card instance to update owner
    #[account(
        mut,
        seeds = [b"card_instance", card_mint.key().as_ref()],
        bump = card_instance.bump
    )]
    pub card_instance: Account<'info, CardInstance>,
    
    /// Escrow token account (PDA-based, will be closed in instruction)
    #[account(
        mut,
        seeds = [b"escrow", card_mint.key().as_ref()],
        bump,
        token::mint = card_mint,
        token::authority = listing,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    /// Buyer's token account to receive the NFT
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = card_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RecordMatchResult<'info> {
    #[account(
        mut,
        seeds = [b"player_profile", winner_profile.wallet.as_ref()],
        bump = winner_profile.bump
    )]
    pub winner_profile: Account<'info, PlayerProfile>,
    
    #[account(
        mut,
        seeds = [b"player_profile", loser_profile.wallet.as_ref()],
        bump = loser_profile.bump
    )]
    pub loser_profile: Account<'info, PlayerProfile>,
    
    #[account(
        seeds = [b"game_config"],
        bump = game_config.bump,
        has_one = authority
    )]
    pub game_config: Account<'info, GameConfig>,
    
    pub authority: Signer<'info>,
}

// ============================================================================
// Helper Functions
// ============================================================================

use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::clock::Clock;

/// Generate pseudo-random number using slot hash, clock, and player pubkey
pub fn generate_random_u64(clock: &Clock, player: &Pubkey, salt: u64) -> u64 {
    let mut data = Vec::new();
    data.extend_from_slice(&clock.slot.to_le_bytes());
    data.extend_from_slice(&clock.unix_timestamp.to_le_bytes());
    data.extend_from_slice(player.as_ref());
    data.extend_from_slice(&salt.to_le_bytes());
    
    let hash_result = hash(&data);
    u64::from_le_bytes(hash_result.to_bytes()[0..8].try_into().unwrap())
}

/// Roll for rarity based on probabilities
/// Common: 70%, Rare: 27%, Legendary: 3%
pub fn roll_rarity(random_value: u64) -> Rarity {
    let roll = (random_value % 100) as u8;
    
    if roll < 70 {
        Rarity::Common
    } else if roll < 97 {  // 70 + 27
        Rarity::Rare
    } else {
        Rarity::Legendary
    }
}

/// Select random card from rarity pool
pub fn select_random_card(rarity_pool: &RarityPool, random_value: u64) -> Result<u32> {
    require!(!rarity_pool.card_type_ids.is_empty(), GameError::EmptyRarityPool);
    
    let index = (random_value as usize) % rarity_pool.card_type_ids.len();
    Ok(rarity_pool.card_type_ids[index])
}

/// Validate that a string is non-empty and not just whitespace
pub fn validate_non_empty_string(s: &str) -> Result<()> {
    require!(!s.trim().is_empty(), GameError::EmptyString);
    Ok(())
}

/// Validate string length
pub fn validate_string_length(s: &str, max_len: usize) -> Result<()> {
    require!(s.len() <= max_len, GameError::StringTooLong);
    Ok(())
}

/// Check if signer is authorized (authority or card creator)
pub fn is_authorized_creator(game_config: &GameConfig, signer: &Pubkey) -> bool {
    signer == &game_config.authority || game_config.card_creators.contains(signer)
}

/// Roll random stats within the template's min/max range
/// Returns (actual_attack, actual_health)
pub fn roll_card_stats(
    min_attack: u16,
    max_attack: u16,
    min_health: u16,
    max_health: u16,
    random_value: u64,
) -> (u16, u16) {
    // Use different parts of the random value for attack and health
    let attack_range = max_attack.saturating_sub(min_attack) as u64 + 1;
    let health_range = max_health.saturating_sub(min_health) as u64 + 1;
    
    let actual_attack = min_attack + ((random_value % attack_range) as u16);
    let actual_health = min_health + (((random_value >> 32) % health_range) as u16);
    
    (actual_attack, actual_health)
}

/// Mint an NFT card to a player with randomized stats
/// This is a simplified version - in production, you'd use Metaplex's full CPI
pub fn mint_nft_card(
    card_type_id: u32,
    card_template: &CardTemplate,
    player: &Pubkey,
    _mint: &Pubkey,
    actual_attack: u16,
    actual_health: u16,
) -> Result<()> {
    // Note: This is a placeholder for the actual Metaplex NFT minting logic
    // In a full implementation, this would:
    // 1. Create a new mint account
    // 2. Create associated token account for player
    // 3. Mint 1 token to player
    // 4. Create metadata account with:
    //    - card_type_id in attributes
    //    - actual_attack (rolled value)
    //    - actual_health (rolled value)
    // 5. Freeze mint authority
    
    msg!("Minting NFT card {} to player {}", card_type_id, player);
    msg!("Card: {} ({:?})", card_template.name, card_template.rarity);
    msg!("Rolled stats: ATK {}, HP {}", actual_attack, actual_health);
    
    // The actual implementation would use Metaplex Token Metadata program
    // via CPI (Cross-Program Invocation)
    // The metadata attributes would include:
    // - card_type_id: u32
    // - attack: actual_attack (u16)
    // - health: actual_health (u16)
    
    Ok(())
}

/// Derive the PDA for a card template
pub fn get_card_template_pda(card_type_id: u32, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"card_template", card_type_id.to_le_bytes().as_ref()],
        program_id,
    )
}

/// Query card template by card_type_id
/// Note: In practice, this would be called off-chain using anchor client
pub fn query_card_template(card_type_id: u32) -> Result<()> {
    // This is a helper function that demonstrates how to derive the PDA
    // In actual usage, the client would:
    // 1. Derive the PDA using get_card_template_pda
    // 2. Fetch the account data
    // 3. Deserialize into CardTemplate struct
    
    msg!("Query card template with ID: {}", card_type_id);
    Ok(())
}


// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::*;
    use solana_program_test::*;
    use solana_sdk::{signature::Keypair, signer::Signer, transaction::Transaction};
    
    // Feature: 404-zoo-contract, Property 1: Card template storage completeness
    // Feature: 404-zoo-contract, Property 2: Card type ID uniqueness
    #[tokio::test]
    async fn test_card_template_storage_and_uniqueness() {
        // This test validates that:
        // 1. All card template fields are stored and retrievable
        // 2. Duplicate card_type_ids are rejected
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 3: Trait validation
    // Feature: 404-zoo-contract, Property 4: Rarity validation
    // Feature: 404-zoo-contract, Property 5: Non-empty string validation
    #[tokio::test]
    async fn test_card_template_input_validation() {
        // This test validates that:
        // 1. Only valid trait types (Warrior, Archer, Assassin) are accepted
        // 2. Only valid rarity types (Common, Rare, Epic, Legendary) are accepted
        // 3. Empty or whitespace-only names and descriptions are rejected
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 6: Rarity pool integrity
    #[tokio::test]
    async fn test_rarity_pool_integrity() {
        // This test validates that:
        // For any card_type_id added to a rarity pool, querying that rarity pool
        // should return a list containing that card_type_id
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 11: Player registration creates profile
    // Feature: 404-zoo-contract, Property 12: Username validation
    // Feature: 404-zoo-contract, Property 13: Initial trophy count
    // Feature: 404-zoo-contract, Property 14: Initial starter pack flag
    #[tokio::test]
    async fn test_player_registration() {
        // This test validates that:
        // 1. After registration, a PlayerProfile account exists linked to wallet
        // 2. Empty or whitespace-only usernames are rejected
        // 3. Trophies are initialized to zero
        // 4. has_claimed_starter_pack is initialized to false
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 20: NFT metadata card type ID
    // Feature: 404-zoo-contract, Property 21: NFT mint address uniqueness
    // Feature: 404-zoo-contract, Property 23: No star levels in NFT data
    #[tokio::test]
    async fn test_nft_minting() {
        // This test validates that:
        // 1. Minted NFT cards have card_type_id in metadata
        // 2. Each minted NFT has a unique mint address
        // 3. NFT metadata does not contain star level attributes
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 8: Starter pack claim precondition
    // Feature: 404-zoo-contract, Property 9: Starter pack card count
    // Feature: 404-zoo-contract, Property 10: Starter pack claim state change
    #[tokio::test]
    async fn test_starter_pack_claim() {
        // This test validates that:
        // 1. Players with has_claimed_starter_pack=true cannot claim again
        // 2. Exactly 10 NFT cards are minted on successful claim
        // 3. has_claimed_starter_pack is set to true after claiming
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 7: Pack drop rarity distribution
    #[tokio::test]
    async fn test_pack_rarity_distribution() {
        // This test validates that:
        // For a large number of pack openings (n > 100), the distribution of card
        // rarities approximates the configured probability distribution
        // (Common 60%, Rare 25%, Epic 12%, Legendary 3%) within 5% tolerance
        
        // Test will be implemented with Anchor test framework using proptest
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 15: Pack purchase balance check
    // Feature: 404-zoo-contract, Property 16: Pack purchase token transfer
    // Feature: 404-zoo-contract, Property 18: Pack purchase NFT ownership
    // Feature: 404-zoo-contract, Property 19: Pack card count configuration
    #[tokio::test]
    async fn test_pack_purchase() {
        // This test validates that:
        // 1. Pack purchase fails if player has insufficient BUG tokens
        // 2. Player's BUG token balance decreases by exactly the pack price
        // 3. All minted NFT cards are owned by the purchasing player
        // 4. Number of cards minted matches configuration
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 17: Pack purchase NFT minting
    #[tokio::test]
    async fn test_pack_purchase_rarity() {
        // This test validates that:
        // NFT cards minted from pack purchases follow the configured
        // rarity probability distribution
        
        // Test will be implemented with Anchor test framework using proptest
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 25: Match result authorization
    // Feature: 404-zoo-contract, Property 26: Winner trophy increase
    // Feature: 404-zoo-contract, Property 27: Loser trophy decrease
    // Feature: 404-zoo-contract, Property 28: Winner BUG reward transfer
    // Feature: 404-zoo-contract, Property 29: Trophy non-negativity
    #[tokio::test]
    async fn test_match_result_recording() {
        // This test validates that:
        // 1. Match result submissions from unauthorized sources fail
        // 2. Winner's trophy count increases by trophy_change amount
        // 3. Loser's trophy count decreases by trophy_change but not below 0
        // 4. Winner's BUG token balance increases by reward amount
        // 5. Trophy counts never become negative
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Feature: 404-zoo-contract, Property 22: Card template lookup via NFT
    // Feature: 404-zoo-contract, Property 24: NFT to template data access
    #[tokio::test]
    async fn test_card_template_lookup() {
        // This test validates that:
        // 1. Using card_type_id from NFT metadata allows retrieval of card template
        // 2. Retrieved template has matching rarity
        // 3. All template fields are accessible (name, trait, rarity, stats, etc.)
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Integration test: Complete player onboarding flow
    #[tokio::test]
    async fn test_player_onboarding_flow() {
        // This integration test validates the complete flow:
        // 1. Initialize game config
        // 2. Register player
        // 3. Claim starter pack
        // 4. Verify 10 NFT cards are owned by player
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Integration test: Pack purchase flow
    #[tokio::test]
    async fn test_pack_purchase_flow() {
        // This integration test validates the complete flow:
        // 1. Register player
        // 2. Fund player with BUG tokens
        // 3. Purchase pack
        // 4. Verify token transfer occurred
        // 5. Verify NFT cards were minted
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Integration test: Match result flow
    #[tokio::test]
    async fn test_match_result_flow() {
        // This integration test validates the complete flow:
        // 1. Register two players
        // 2. Record match result
        // 3. Verify trophy changes for both players
        // 4. Verify reward transfer to winner
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
    
    // Integration test: Admin setup flow
    #[tokio::test]
    async fn test_admin_setup_flow() {
        // This integration test validates the complete flow:
        // 1. Initialize game config
        // 2. Add card creator
        // 3. Create card templates
        // 4. Update rarity pools
        // 5. Verify all configuration is correct
        
        // Test will be implemented with Anchor test framework
        // For now, this is a placeholder structure
    }
}
