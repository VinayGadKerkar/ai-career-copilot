const Redis = require('ioredis');

// Use lazyConnect so a missing/unreachable Redis doesn't crash the process at startup.
// Rate limiting will fail open (pass requests through) when Redis is unavailable.
let redis = null;

const getRedis = () => {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('⚠️  REDIS_URL not set — rate limiting disabled');
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redis.on('connect', () => console.log('✅ Redis connected'));
    redis.on('error', (err) => console.error('Redis error:', err.message));
    redis.connect().catch(() => {}); // non-blocking connect attempt
  } catch (err) {
    console.warn('⚠️  Redis init failed:', err.message);
    redis = null;
  }

  return redis;
};

// General rate limiter factory
const createRateLimiter = ({ windowSeconds, maxRequests, keyPrefix }) => {
  return async (req, res, next) => {
    const client = getRedis();

    // If Redis is unavailable, fail open — don't block the request
    if (!client) return next();

    try {
      const identifier = req.userId || req.ip;
      const key = `ratelimit:${keyPrefix}:${identifier}`;

      const current = await client.incr(key);

      if (current === 1) {
        await client.expire(key, windowSeconds);
      }

      if (current > maxRequests) {
        const ttl = await client.ttl(key);
        return res.status(429).json({
          success: false,
          message: `Too many requests. Try again in ${ttl} seconds.`
        });
      }

      // Add headers so frontend knows limits
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

      next();
    } catch (error) {
      // If Redis fails, don't block the request
      console.error('Rate limiter error:', error.message);
      next();
    }
  };
};

// Preset limiters
const aiRateLimiter = createRateLimiter({
  windowSeconds: 3600,  // 1 hour
  maxRequests: 10,      // 10 AI requests per hour
  keyPrefix: 'ai'
});

const uploadRateLimiter = createRateLimiter({
  windowSeconds: 86400, // 24 hours
  maxRequests: 20,      // 20 uploads per day
  keyPrefix: 'upload'
});

const authRateLimiter = createRateLimiter({
  windowSeconds: 900,   // 15 minutes
  maxRequests: 10,      // 10 login attempts
  keyPrefix: 'auth'
});

module.exports = { 
  getRedis,
  aiRateLimiter, 
  uploadRateLimiter, 
  authRateLimiter 
};