// Express "trust proxy" dəyəri. X-Forwarded-For yalnız etibarlı proxy-dən gələndə nəzərə alınır,
// yoxsa hər kəs başlığı saxtalaşdırıb rate limiter-dən yayına bilər.
//   TRUST_PROXY boş  -> production: 1 (bir reverse proxy, məs. Render/Railway), qalan mühitlər: false
//   TRUST_PROXY=2    -> proxy zəncirində neçə hop etibarlıdır
//   TRUST_PROXY=false
//   TRUST_PROXY=loopback,10.0.0.0/8  -> etibarlı proxy ünvanları/alt şəbəkələri
// "true" qəbul edilmir: istənilən müştərinin X-Forwarded-For başlığına inanmaq deməkdir.
export const resolveTrustProxy = (value = process.env.TRUST_PROXY, env = process.env.NODE_ENV) => {
    const raw = typeof value === 'string' ? value.trim() : '';

    if (raw === '') return env === 'production' ? 1 : false;

    const lower = raw.toLowerCase();
    if (lower === 'false') return false;
    if (lower === 'true') {
        throw new Error('TRUST_PROXY=true is not allowed: set the number of proxy hops or the proxy addresses instead.');
    }
    if (/^\d+$/.test(raw)) {
        const hops = Number(raw);
        return hops === 0 ? false : hops;
    }

    return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};
