# Navigation benchmark - sajilo.shunyatechofficial.workers.dev - 2026-10-16

Median of 1 run(s) per page, each from a fresh load of `/munshi`. Times in ms, sizes in KB.
Slowest first by cold "ready". Produced by `scripts/bench-navigation.ts`.
Throttled: 3g (2000ms latency, 400/400 kbit/s down/up), CPU 1x.

- Start page prefetch requests with nobody touching it: **5** (should be 0).
- Server responses from a fresh isolate (cold start): **1 of 391**, median first byte **2009 ms** against **2009 ms** warm.
- **cold**: click with no hover. **warm**: click after resting on the link for 300ms.
- **shown**: click to the new page or its skeleton. **ready**: click to no skeleton and no request in flight.
- **page prefetches**: RSC requests the opened page fired by itself (its links prefetching on sight). **last request**: what "ready" waited for.
- **RSC ttfb / end**: the page's server render, first byte and end of stream. **reads**: Server Action POSTs (client queries) after the click, and the slowest one's round trip.

| Page | cold shown | cold ready | RSC ttfb | RSC end | reads | slowest read | JS KB | hover requests | hover ms | hover KB | warm shown | warm ready | page prefetches | last request (cold) | cold renders | note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/today` | 2105 | 12924 | 2007 | 2050 | 1 | 2108 | 85 | 2 | 0 | 0 | 2103 | 11666 | 13 | `/_next/static/chunks/26zkdea4eqfmc.js 2191ms` | 0 of 2 |  |
| `/settings` | 2109 | 12320 | 2018 | 2060 | 0 | - | 16 | 2 | 0 | 0 | 2138 | 10560 | 12 | `/_next/static/chunks/0kxfncg8ggahh.js 2035ms` | 0 of 2 |  |
| `/manage` | 4316 | 12314 | 2028 | 2075 | 0 | - | 6 | 2 | 0 | 0 | 4262 | 11681 | 12 | `/_next/static/chunks/0kxfncg8ggahh.js 2038ms` | 0 of 2 |  |
| `/loans/calculator` | 2117 | 11244 | 2017 | 3284 | 0 | - | 18 | 2 | 0 | 0 | 2116 | 10478 | 12 | `/_next/static/chunks/0kxfncg8ggahh.js 2040ms` | 0 of 2 |  |
| `/cash` | 2083 | 11168 | 2003 | 2037 | 0 | - | 7 | 2 | 0 | 0 | 2104 | 10431 | 12 | `/_next/static/chunks/0kxfncg8ggahh.js 2009ms` | 0 of 2 |  |
| `/scan` | 2102 | 10911 | 2021 | 2059 | 0 | - | 26 | 2 | 0 | 0 | 2112 | 10382 | 11 | `/_next/static/chunks/0kxfncg8ggahh.js 2006ms` | 0 of 2 |  |
| `/loans` | 2117 | 10865 | 2033 | 2069 | 0 | - | 4 | 2 | 0 | 0 | 2107 | 10769 | 12 | `/_next/static/chunks/0kxfncg8ggahh.js 2005ms` | 0 of 2 |  |
| `/more` | 2112 | 6668 | 2035 | 2068 | 0 | - | 21 | 2 | 0 | 0 | 2121 | 13214 | 13 | `/_next/static/chunks/0qbecpidhsx-q.js 2062ms` | 0 of 2 |  |
| `/month` | 2122 | 6255 | 2034 | 2069 | 0 | - | 2 | 2 | 0 | 0 | 2100 | 10759 | 13 | `/_next/static/chunks/0vdtx3q3ejorf.js 2047ms` | 0 of 2 |  |
