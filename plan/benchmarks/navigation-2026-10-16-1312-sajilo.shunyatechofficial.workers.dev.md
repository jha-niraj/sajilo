# Navigation benchmark - sajilo.shunyatechofficial.workers.dev - 2026-10-16

Median of 3 run(s) per page, each from a fresh load of `/munshi`. Times in ms, sizes in KB.
Slowest first by cold "ready". Produced by `scripts/bench-navigation.ts`.
No throttling: full network speed and CPU.

- Start page prefetch requests with nobody touching it: **9** (should be 0).
- No isolate headers in the responses: the deployed build predates the isolate headers (x-isolate-requests in apps/main/middleware.ts).
- **cold**: click with no hover. **warm**: click after resting on the link for 300ms.
- **shown**: click to the new page or its skeleton. **ready**: click to no skeleton and no request in flight.
- **page prefetches**: RSC requests the opened page fired by itself (its links prefetching on sight). **last request**: what "ready" waited for.
- **RSC ttfb / end**: the page's server render, first byte and end of stream. **reads**: Server Action POSTs (client queries) after the click, and the slowest one's round trip.

| Page | cold shown | cold ready | RSC ttfb | RSC end | reads | slowest read | JS KB | hover requests | hover ms | hover KB | warm shown | warm ready | page prefetches | last request (cold) | cold renders | note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/more` | 60 | 729 | 131 | 137 | 0 | - | 0 | 0 | 0 | 0 | 60 | 720 | 9 | - | 0 of 5 |  |
| `/month` | 58 | 325 | 79 | 79 | 0 | - | 0 | 0 | 0 | 0 | 60 | 441 | 5 | `/customers/9f0c9453-adf0-4e9b-920e-3f4b7ba5b178 (rsc) 66ms` | 0 of 6 |  |
| `/today` | 63 | 318 | 101 | 101 | 1 | 183 | 0 | 0 | 0 | 0 | 58 | 271 | 1 | `/today/finish (rsc) 71ms` | 0 of 6 |  |
| `/loans` | 49 | 295 | 64 | 65 | 0 | - | 0 | 0 | 0 | 0 | 48 | 305 | 8 | `/scan (rsc) 72ms` | 0 of 6 |  |
