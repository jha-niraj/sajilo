# Navigation benchmark - sajilo.shunyatechofficial.workers.dev - 2026-10-16

Median of 3 run(s) per page, each from a fresh load of `/munshi`. Times in ms, sizes in KB.
Slowest first by cold "ready". Produced by `scripts/bench-navigation.ts`.
No throttling: full network speed and CPU.

- Start page prefetch requests with nobody touching it: **19** (should be 0).
- Server responses from a fresh isolate (cold start): **100 of 1236**, median first byte **1787 ms** against **375 ms** warm.
- **cold**: click with no hover. **warm**: click after resting on the link for 300ms.
- **shown**: click to the new page or its skeleton. **ready**: click to no skeleton and no request in flight.
- **page prefetches**: RSC requests the opened page fired by itself (its links prefetching on sight). **last request**: what "ready" waited for.
- **RSC ttfb / end**: the page's server render, first byte and end of stream. **reads**: Server Action POSTs (client queries) after the click, and the slowest one's round trip.

| Page | cold shown | cold ready | RSC ttfb | RSC end | reads | slowest read | JS KB | hover requests | hover ms | hover KB | warm shown | warm ready | page prefetches | last request (cold) | cold renders | note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/cash` | 62 | 4058 | 395 | 535 | 0 | - | 0 | 0 | 0 | 0 | 53 | 797 | 1 | `/_next/static/chunks/3_lh297qct90n.js 1ms` | 1 of 6 | a skeleton never cleared |
| `/loans` | 57 | 2547 | 357 | 410 | 0 | - | 0 | 0 | 0 | 0 | 55 | 874 | 2 | `/loans/calculator (rsc) 360ms` | 0 of 6 | a skeleton never cleared |
| `/loans/calculator` | 55 | 898 | 503 | 561 | 0 | - | 0 | 0 | 0 | 0 | 62 | 1091 | 1 | `/munshi (rsc) 480ms` | 0 of 6 | a skeleton never cleared |
| `/scan` | 55 | 893 | 347 | 413 | 0 | - | 0 | 0 | 0 | 0 | 55 | 814 | 1 | `/munshi (rsc) 452ms` | 0 of 6 | a skeleton never cleared |
| `/more` | 57 | 852 | 382 | 392 | 0 | - | 0 | 0 | 0 | 0 | 65 | 855 | 1 | `/_next/static/chunks/0ylrcrizojz-u.js 15ms` | 0 of 6 | a skeleton never cleared |
| `/manage` | 53 | 803 | - | - | 0 | - | 0 | 0 | 0 | 0 | 55 | 794 | 1 | `/munshi (rsc) 352ms` | 1 of 6 | a skeleton never cleared |
| `/settings` | 52 | 790 | 371 | 488 | 0 | - | 0 | 0 | 0 | 0 | 55 | 811 | 1 | `/munshi (rsc) 363ms` | 0 of 6 |  |
| `/month` | 61 | 787 | 370 | 440 | 0 | - | 0 | 0 | 0 | 0 | 54 | 785 | 1 | `/munshi (rsc) 361ms` | 0 of 6 |  |
| `/today` | 57 | 612 | 362 | 362 | 1 | 525 | 0 | 0 | 0 | 0 | 55 | 692 | 0 | `/today 414ms` | 1 of 6 |  |
