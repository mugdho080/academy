import { query, withTransaction } from '../db.js';

export interface GamificationEventResult {
  xpAwarded: number;
  coinsAwarded: number;
  newTotalXp: number;
  newRank?: string;
  unlockedBadges: string[];
}

export class GamificationService {
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
    
    return await withTransaction(async (client) => {
      const existing = await client.query('SELECT id FROM xp_events WHERE idempotency_key = $1', [idempotencyKey]);
      if (existing.rows.length > 0) {
        return null; // Already awarded
      }

      await client.query(
        'INSERT INTO xp_events (user_id, event_type, xp_amount, coin_amount, source_type, source_id, idempotency_key, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [userId, eventType, xpAmount, coinAmount, sourceType, sourceId, idempotencyKey, JSON.stringify(metadata)]
      );

      const walletRows = await client.query('SELECT total_xp, current_coins, lifetime_coins, current_rank_key FROM user_xp_wallet WHERE user_id = $1', [userId]);
      let currentTotalXp = 0;
      let currentRankKey = 'seed_learner';
      
      if (walletRows.rows.length === 0) {
        await client.query('INSERT INTO user_xp_wallet (user_id, total_xp, current_coins, lifetime_coins) VALUES ($1, $2, $3, $4)', [userId, xpAmount, coinAmount, coinAmount]);
        currentTotalXp = xpAmount;
      } else {
        const wallet = walletRows.rows[0];
        currentTotalXp = wallet.total_xp + xpAmount;
        currentRankKey = wallet.current_rank_key;
        
        await client.query(
          'UPDATE user_xp_wallet SET total_xp = $1, current_coins = current_coins + $2, lifetime_coins = lifetime_coins + $3 WHERE user_id = $4',
          [currentTotalXp, coinAmount, coinAmount, userId]
        );
      }

      const ranks = await client.query('SELECT rank_key FROM rank_definitions WHERE min_xp <= $1 ORDER BY min_xp DESC LIMIT 1', [currentTotalXp]);
      let newRank: string | undefined = undefined;
      if (ranks.rows.length > 0) {
        const matchingRank = ranks.rows[0].rank_key;
        if (matchingRank !== currentRankKey) {
          await client.query('UPDATE user_xp_wallet SET current_rank_key = $1 WHERE user_id = $2', [matchingRank, userId]);
          newRank = matchingRank;
        }
      }

      const badgeByEvent: Record<string, string> = {
        lesson_completed: 'first_step',
        quiz_completed: 'quiz_star',
        resume_saved: 'resume_ready',
        routine_saved: 'routine_hero',
      };

      const unlockedBadges: string[] = [];
      const badgeKey = badgeByEvent[eventType];
      if (badgeKey) {
        const badge = await client.query('SELECT * FROM user_badges WHERE user_id = $1 AND badge_key = $2', [userId, badgeKey]);
        if (badge.rows.length === 0) {
          await client.query('INSERT INTO user_badges (user_id, badge_key, metadata) VALUES ($1, $2, $3)', [userId, badgeKey, JSON.stringify(metadata)]);
          unlockedBadges.push(badgeKey);
        }
      }

      return {
        xpAwarded: xpAmount,
        coinsAwarded: coinAmount,
        newTotalXp: currentTotalXp,
        newRank,
        unlockedBadges
      };
    });
  }

  static async getSummary(userId: number) {
    const rows = await query(`
      SELECT w.*, r.name as rank_name, r.icon as rank_icon, r.theme_color,
             (SELECT min_xp FROM rank_definitions WHERE sort_order = (SELECT sort_order FROM rank_definitions WHERE rank_key = w.current_rank_key) + 1 LIMIT 1) as next_rank_xp
      FROM user_xp_wallet w
      LEFT JOIN rank_definitions r ON w.current_rank_key = r.rank_key
      WHERE w.user_id = $1
    `, [userId]);
    
    if (rows.length === 0) {
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
    
    return rows[0];
  }
}
