use anchor_lang::prelude::*;
use anchor_lang::solana_program;

declare_id!("5F5gHfVH2p3YYgSuR42Bt2QBY7a6VmBV1CLXQwDmFBrF"); // Replace with your program ID after build

#[program]
pub mod shop {
    use super::*;

    // Initialize the shop with an admin
    pub fn initialize_shop(ctx: Context<InitializeShop>) -> Result<()> {
        let shop = &mut ctx.accounts.shop;
        shop.admin = ctx.accounts.admin.key();
        shop.item_count = 0;
        Ok(())
    }

    // Add a new item to the shop (admin only)
    pub fn add_item(ctx: Context<AddItem>, id: u64, price: u64, metadata_uri: String) -> Result<()> {
        let shop = &mut ctx.accounts.shop;
        require!(ctx.accounts.admin.key() == shop.admin, ShopError::Unauthorized);

        let item = &mut ctx.accounts.item;
        item.id = id;
        item.price = price;
        item.metadata_uri = metadata_uri;

        shop.item_count += 1;
        Ok(())
    }

    // First purchase - initializes history account
    pub fn first_purchase(ctx: Context<FirstPurchase>) -> Result<()> {
        let item = &ctx.accounts.item;
        let buyer = &ctx.accounts.buyer;
        let admin = &ctx.accounts.admin;
        let system_program = &ctx.accounts.system_program;

        // Transfer SOL from buyer to admin
        let transfer_instruction = solana_program::system_instruction::transfer(
            buyer.key,
            admin.key,
            item.price,
        );
        solana_program::program::invoke(
            &transfer_instruction,
            &[
                buyer.to_account_info(),
                admin.to_account_info(),
                system_program.to_account_info(),
            ],
        )?;

        // Initialize history and record the purchase
        let history = &mut ctx.accounts.history;
        history.user = buyer.key();
        
        history.purchases.push(PurchaseRecord {
            item_id: item.id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // Subsequent purchase - uses existing history account
    pub fn subsequent_purchase(ctx: Context<SubsequentPurchase>) -> Result<()> {
        let item = &ctx.accounts.item;
        let buyer = &ctx.accounts.buyer;
        let admin = &ctx.accounts.admin;
        let system_program = &ctx.accounts.system_program;

        // Transfer SOL from buyer to admin
        let transfer_instruction = solana_program::system_instruction::transfer(
            buyer.key,
            admin.key,
            item.price,
        );
        solana_program::program::invoke(
            &transfer_instruction,
            &[
                buyer.to_account_info(),
                admin.to_account_info(),
                system_program.to_account_info(),
            ],
        )?;

        // Record the purchase in buyer's history
        let history = &mut ctx.accounts.history;
        
        // Verify the history belongs to the buyer
        require!(history.user == buyer.key(), ShopError::InvalidHistoryOwner);
        
        history.purchases.push(PurchaseRecord {
            item_id: item.id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeShop<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 8, // discriminator + pubkey + u64
        seeds = [b"shop"],
        bump
    )]
    pub shop: Account<'info, Shop>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct AddItem<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(mut, seeds = [b"shop"], bump)]
    pub shop: Account<'info, Shop>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 8 + 8 + 4 + 200, // discriminator + id + price + string len + string data
        seeds = [b"item", id.to_le_bytes().as_ref()],
        bump
    )]
    pub item: Account<'info, Item>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FirstPurchase<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(seeds = [b"shop"], bump)]
    pub shop: Account<'info, Shop>,
    
    #[account(seeds = [b"item", item.id.to_le_bytes().as_ref()], bump)]
    pub item: Account<'info, Item>,
    
    /// CHECK: Admin receives the SOL payment
    #[account(mut, constraint = admin.key() == shop.admin)]
    pub admin: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = buyer,
        space = 8 + 32 + 4 + (32 * 10), // discriminator + pubkey + vec len + (estimated 10 purchases)
        seeds = [b"history", buyer.key().as_ref()],
        bump
    )]
    pub history: Account<'info, PurchaseHistory>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubsequentPurchase<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(seeds = [b"shop"], bump)]
    pub shop: Account<'info, Shop>,
    
    #[account(seeds = [b"item", item.id.to_le_bytes().as_ref()], bump)]
    pub item: Account<'info, Item>,
    
    /// CHECK: Admin receives the SOL payment
    #[account(mut, constraint = admin.key() == shop.admin)]
    pub admin: UncheckedAccount<'info>,
    
    #[account(
        mut,
        seeds = [b"history", buyer.key().as_ref()],
        bump
    )]
    pub history: Account<'info, PurchaseHistory>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Shop {
    pub admin: Pubkey,
    pub item_count: u64, // Auto-incrementing item ID
}

#[account]
pub struct Item {
    pub id: u64,
    pub price: u64,  // Price in lamports
    pub metadata_uri: String, // IPFS CID from NFT.Storage
}

#[account]
pub struct PurchaseHistory {
    pub user: Pubkey,
    pub purchases: Vec<PurchaseRecord>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PurchaseRecord {
    pub item_id: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum ShopError {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    #[msg("History account does not belong to the buyer")]
    InvalidHistoryOwner,
} 