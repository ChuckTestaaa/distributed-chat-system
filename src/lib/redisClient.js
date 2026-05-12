let client = null;

export function setRedisClient(redisClient) {
    client = redisClient;
}

export function getRedisClient() {
    return client;
}
