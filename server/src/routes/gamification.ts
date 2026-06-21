import { Router, Request, Response } from 'express';
import db from '../db';
import { ensureLearner } from '../middleware';
import { GamificationService } from '../services/GamificationService';

const router = Router();

// 1. Get Summary (XP, Coins, Rank)
router.get('/summary', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  try {
    const summary = await GamificationService.getSummary(userId);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch gamification summary' });
  }
});

// 2. Get Badges
router.get('/badges', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const [userBadges] = await db.query('SELECT badge_key, earned_at FROM user_badges WHERE user_id = ?', [userId]);
  const [allBadges] = await db.query('SELECT * FROM badge_definitions WHERE is_active = TRUE');
  
  res.json({
    allBadges,
    earnedBadges: userBadges
  });
});

// 3. Get Shop Items
router.get('/shop', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const [shopItems] = await db.query('SELECT * FROM cosmetic_shop_items WHERE is_active = TRUE');
  const [unlocked] = await db.query('SELECT cosmetic_key FROM user_cosmetics WHERE user_id = ?', [userId]);
  
  res.json({
    shopItems,
    unlockedItems: unlocked
  });
});

// 4. Unlock Shop Item
router.post('/shop/:itemKey/unlock', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const itemKey = req.params.itemKey;
  
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query('SELECT coin_cost FROM cosmetic_shop_items WHERE cosmetic_key = ? AND is_active = TRUE', [itemKey]);
    if ((items as any[]).length === 0) return res.status(404).json({ error: 'Item not found' });
    
    const cost = (items as any)[0].coin_cost;
    const [wallets] = await conn.query('SELECT current_coins FROM user_xp_wallet WHERE user_id = ? FOR UPDATE', [userId]);
    const coins = (wallets as any[])[0]?.current_coins || 0;
    
    if (coins < cost) {
      await conn.rollback();
      return res.status(400).json({ error: 'Not enough coins' });
    }
    
    // Check if already unlocked
    const [unlocked] = await conn.query('SELECT id FROM user_cosmetics WHERE user_id = ? AND cosmetic_key = ?', [userId, itemKey]);
    if ((unlocked as any[]).length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Item already unlocked' });
    }
    
    // Deduct and unlock
    await conn.query('UPDATE user_xp_wallet SET current_coins = current_coins - ? WHERE user_id = ?', [cost, userId]);
    await conn.query('INSERT INTO user_cosmetics (user_id, cosmetic_key) VALUES (?, ?)', [userId, itemKey]);
    
    await conn.commit();
    res.json({ success: true, newCoinBalance: coins - cost });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Failed to unlock item' });
  } finally {
    conn.release();
  }
});

export default router;
