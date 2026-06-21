import { Hono } from 'hono';
import { query, withTransaction } from '../db.js';
import { requireAuth } from '../middleware.js';
import type { JwtPayload } from '../middleware.js';
import { GamificationService } from '../services/GamificationService.js';

const gamification = new Hono();
gamification.use('*', requireAuth);

function userId(c: { get(k: string): unknown }): number {
  return Number((c.get('user') as JwtPayload).sub);
}

gamification.get('/summary', async (c) => {
  const uid = userId(c);
  try {
    const summary = await GamificationService.getSummary(uid);
    return c.json(summary);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch gamification summary' }, 500);
  }
});

gamification.get('/badges', async (c) => {
  const uid = userId(c);
  const userBadges = await query('SELECT badge_key, earned_at FROM user_badges WHERE user_id = $1', [uid]);
  const allBadges = await query('SELECT * FROM badge_definitions WHERE is_active = TRUE');
  
  return c.json({
    allBadges,
    earnedBadges: userBadges
  });
});

gamification.get('/shop', async (c) => {
  const uid = userId(c);
  const shopItems = await query('SELECT * FROM cosmetic_shop_items WHERE is_active = TRUE');
  const unlocked = await query('SELECT cosmetic_key FROM user_cosmetics WHERE user_id = $1', [uid]);
  
  return c.json({
    shopItems,
    unlockedItems: unlocked
  });
});

gamification.post('/shop/:itemKey/unlock', async (c) => {
  const uid = userId(c);
  const itemKey = c.req.param('itemKey');
  
  try {
    const result = await withTransaction(async (client) => {
      const items = await client.query('SELECT coin_cost FROM cosmetic_shop_items WHERE cosmetic_key = $1 AND is_active = TRUE', [itemKey]);
      if (items.rows.length === 0) return { error: 'Item not found', status: 404 };
      
      const cost = items.rows[0].coin_cost;
      const wallets = await client.query('SELECT current_coins FROM user_xp_wallet WHERE user_id = $1 FOR UPDATE', [uid]);
      const coins = wallets.rows[0]?.current_coins || 0;
      
      if (coins < cost) {
        return { error: 'Not enough coins', status: 400 };
      }
      
      const unlocked = await client.query('SELECT id FROM user_cosmetics WHERE user_id = $1 AND cosmetic_key = $2', [uid, itemKey]);
      if (unlocked.rows.length > 0) {
        return { error: 'Item already unlocked', status: 400 };
      }
      
      await client.query('UPDATE user_xp_wallet SET current_coins = current_coins - $1 WHERE user_id = $2', [cost, uid]);
      await client.query('INSERT INTO user_cosmetics (user_id, cosmetic_key) VALUES ($1, $2)', [uid, itemKey]);
      
      return { success: true, newCoinBalance: coins - cost };
    });
    
    if (result.error) {
       return c.json({ error: result.error }, result.status as any);
    }
    return c.json(result);
  } catch (e) {
    console.error(e);
    return c.json({ error: 'Failed to unlock item' }, 500);
  }
});

export default gamification;
