# Navigation benchmark - sajilo.shunyatechofficial.workers.dev - 2026-10-16

Median of 1 run(s) per page, each from a fresh load of `/munshi`. Times in ms, sizes in KB.
Slowest first by cold "ready". Produced by `scripts/bench-navigation.ts`.
No throttling: full network speed and CPU.

- Start page prefetch requests with nobody touching it: **18** (should be 0).
- Server responses from a fresh isolate (cold start): **11 of 415**, median first byte **1713 ms** against **211 ms** warm.
- **cold**: click with no hover. **warm**: click after resting on the link for 300ms.
- **shown**: click to the new page or its skeleton. **ready**: click to no skeleton and no request in flight.
- **page prefetches**: RSC requests the opened page fired by itself (its links prefetching on sight). **last request**: what "ready" waited for.
- **RSC ttfb / end**: the page's server render, first byte and end of stream. **reads**: Server Action POSTs (client queries) after the click, and the slowest one's round trip.

| Page | cold shown | cold ready | RSC ttfb | RSC end | reads | slowest read | JS KB | hover requests | hover ms | hover KB | warm shown | warm ready | page prefetches | last request (cold) | cold renders | note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/today` | 305 | 1447 | 247 | 505 | 1 | 813 | 2 | 0 | 0 | 0 | 64 | 1171 | 3 | `/today 813ms` | 0 of 2 |  |
| `/loans/calculator` | 43 | 1222 | 243 | 544 | 0 | - | 14 | 0 | 0 | 0 | 59 | 1040 | 0 | `/_next/static/chunks/14w982c_swjdz.js 371ms` | 0 of 2 |  |
| `/cash` | 46 | 975 | 204 | 501 | 0 | - | 3 | 0 | 0 | 0 | 57 | 1007 | 0 | `/_next/static/chunks/3_lh297qct90n.js 196ms` | 0 of 2 |  |
| `/scan` | 46 | 853 | 204 | 361 | 0 | - | 22 | 0 | 0 | 0 | 55 | 827 | 0 | `/_next/static/chunks/0vdtx3q3ejorf.js 195ms` | 0 of 2 |  |
| `/more` | 44 | 849 | 229 | 353 | 0 | - | 21 | 0 | 0 | 0 | 57 | 1527 | 2 | `/_next/static/chunks/0ieyv4mj6w0sq.js 197ms` | 0 of 2 |  |
| `/settings` | 46 | 848 | 277 | 356 | 0 | - | 12 | 0 | 0 | 0 | 56 | 873 | 0 | `/_next/static/chunks/14w982c_swjdz.js 194ms` | 0 of 2 |  |
| `/manage` | 211 | 726 | 211 | 327 | 0 | - | 2 | 0 | 0 | 0 | 57 | 681 | 0 | `/_next/static/chunks/0vdtx3q3ejorf.js 208ms` | 0 of 2 |  |
| `/month` | 58 | 272 | - | - | 0 | - | 1 | 0 | 0 | 0 | 62 | 307 | 0 | `/_next/static/chunks/0vdtx3q3ejorf.js 205ms` | 0 of 2 |  |
| `/loans` | 57 | 255 | - | - | 0 | - | 0 | 0 | 0 | 0 | 46 | 266 | 0 | `/_next/static/chunks/0k37h54f3vac1.js 189ms` | 0 of 2 |  |
