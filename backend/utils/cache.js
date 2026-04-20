/**
 * Simple in-memory cache with TTL (Time To Live)
 * Useful for caching API responses that don't change frequently
 */
class SimpleCache {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Set a value in cache with TTL
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
     */
    set(key, value, ttl = 5 * 60 * 1000) {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, { value, expiresAt });
    }

    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @returns {any|null} - Cached value or null if expired/not found
     */
    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            return null;
        }

        // Check if expired
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Delete a specific key from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get cache size
     * @returns {number} - Number of items in cache
     */
    size() {
        return this.cache.size;
    }

    /**
     * Middleware to cache GET requests
     * @param {number} ttl - Time to live in milliseconds
     * @returns {Function} - Express middleware
     */
    middleware(ttl = 5 * 60 * 1000) {
        return (req, res, next) => {
            // Only cache GET requests
            if (req.method !== 'GET') {
                return next();
            }

            const key = `${req.userId || 'public'}_${req.originalUrl || req.url}`;
            const cachedResponse = this.get(key);

            if (cachedResponse) {
                return res.json(cachedResponse);
            }

            // Store original res.json
            const originalJson = res.json.bind(res);

            // Override res.json to cache the response
            res.json = (body) => {
                this.set(key, body, ttl);
                return originalJson(body);
            };

            next();
        };
    }
}

// Create singleton instance
const cache = new SimpleCache();

module.exports = cache;
