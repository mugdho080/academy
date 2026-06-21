import db from '../db.js';

export interface GamificationEventResult {
  xpAwarded: number;
  coinsAwarded: number;
  newTotalXp: number;
  newRank?: string;
  unlockedBadges: string[];
}

export class GamificationService {
  /**
   * Award XP and Coins to a user if the event hasn't been processed yet.
   */
  static async awardXpAndCoins(
    userId: number,
    eventType: string,
    sourceType: string,
    sourceId: string,
    xpAmount: number,
    coinAmount: number,
    metadata: any = {}
  ): Promise<GamificationEventResult | null> {
    const idempotencyKey = `${eventType}:${userId}:${sourceType}_${sourceId}`;
    const conn = await db.getConnection();
    
    try {
      await conn.beginTransaction();

      // Check for idempotency
      const [existing] = await conn.query('SELECT id FROM xp_events WHERE idempotency_key = ?', [idempotencyKey]);
      if ((existing as any[]).length > 0) {
        await conn.rollback();
        return null; // Already awarded
      }

      // Record event
      await conn.query(
        'INSERT INTO xp_events (user_id, event_type, xp_amount, coin_amount, source_type, source_id, idempotency_key, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, eventType, xpAmount, coinAmount, sourceType, sourceId, idempotencyKey, JSON.stringify(metadata)]
      );

      // Ensure wallet exists
      const [walletRows] = await conn.query('SELECT total_xp, current_coins, lifetime_coins, current_rank_key FROM user_xp_wallet WHERE user_id = ?', [userId]);
      let currentTotalXp = 0;
      let currentRankKey = 'seed_learner';
      
      if ((walletRows as any[]).length === 0) {
        await conn.query('INSERT INTO user_xp_wallet (user_id, total_xp, current_coins, lifetime_coins) VALUES (?, ?, ?, ?)', [userId, xpAmount, coinAmount, coinAmount]);
        currentTotalXp = xpAmount;
      } else {
        const wallet = (walletRows as any)[0];
        currentTotalXp = wallet.total_xp + xpAmount;
        currentRankKey = wallet.current_rank_key;
        
        await conn.query(
          'UPDATE user_xp_wallet SET total_xp = ?, current_coins = current_coins + ?, lifetime_coins = lifetime_coins + ? WHERE user_id = ?',
          [currentTotalXp, coinAmount, coinAmount, userId]
        );
      }

      // Check Rank
      const [ranks] = await conn.query('SELECT rank_key FROM rank_definitions WHERE min_xp <= ? ORDER BY min_xp DESC LIMIT 1', [currentTotalXp]);
      let newRank: string | undefined = undefined;
      if ((ranks as any[]).length > 0) {
        const matchingRank = (ranks as any)[0].rank_key;
        if (matchingRank !== currentRankKey) {
          await conn.query('UPDATE user_xp_wallet SET current_rank_key = ? WHERE user_id = ?', [matchingRank, userId]);
          newRank = matchingRank;
        }
      }

      // Check Badges (naive implementation for demo)
      const unlockedBadges: string[] = [];
      if (eventType === 'lesson_completed') {
        const [badge] = await conn.query('SELECT * FROM user_badges WHERE user_id = ? AND badge_key = "first_step"', [userId]);
        if ((badge as any[]).length === 0) {
          await conn.query('INSERT INTO user_badges (user_id, badge_key) VALUES (?, "first_step")', [userId]);
          unlockedBadges.push('first_step');
        }
      } else if (eventType === 'quiz_completed') {
         const [badge] = await conn.query('SELECT * FROM user_badges WHERE user_id = ? AND badge_key = "quiz_star"', [userId]);
         if ((badge as any[]).length === 0) {
           await conn.query('INSERT INTO user_badges (user_id, badge_key) VALUES (?, "quiz_star")', [userId]);
           unlockedBadges.push('quiz_star');
         }
      }

      await conn.commit();
      return {
        xpAwarded: xpAmount,
        coinsAwarded: coinAmount,
        newTotalXp: currentTotalXp,
        newRank,
        unlockedBadges
      };

    } catch (error) {
      await conn.rollback();
      console.error('Error awarding XP/Coins:', error);
      throw error;
    } finally {
      conn.release();
    }
  }

  static async getSummary(userId: number) {
    const [rows] = await db.query(`
      SELECT w.*, r.name as rank_name, r.icon as rank_icon, r.theme_color,
             (SELECT min_xp FROM rank_definitions WHERE sort_order = (SELECT sort_order FROM rank_definitions WHERE rank_key = w.current_rank_key) + 1 LIMIT 1) as next_rank_xp
      FROM user_xp_wallet w
      LEFT JOIN rank_definitions r ON w.current_rank_key = r.rank_key
      WHERE w.user_id = ?
    `, [userId]);
    
    if ((rows as any[]).length === 0) {
      // Return defaults if no wallet yet
      return {
        total_xp: 0,
        current_coins: 0,
        current_streak: 0,
        rank_name: 'Seed Learner 🌱',
        rank_icon: '🌱',
        current_rank_key: 'seed_learner',
        next_rank_xp: 100
      };
    }
    
    return (rows as any)[0];
  }
}
