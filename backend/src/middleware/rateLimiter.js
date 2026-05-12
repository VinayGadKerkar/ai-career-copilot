const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

// General rate limiter factory
const createRateLimiter = ({ windowSeconds, maxRequests, keyPrefix }) => {
  return async (req, res, next) => {
    try {
      const identifier = req.userId || req.ip;
      const key = `ratelimit:${keyPrefix}:${identifier}`;

      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (current > maxRequests) {
        const ttl = await redis.ttl(key);
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
      console.error('Rate limiter error:', error);
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
  redis,
  aiRateLimiter, 
  uploadRateLimiter, 
  authRateLimiter 
};