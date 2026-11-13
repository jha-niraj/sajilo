# Phase 5 - Voice-first Munshi (Wispr x Scaler hackathon build)

Goal: he talks, Sajilo writes the ledger, online and offline. Built inside Munshi Talk mode (one voice place). The hackathon prompt (Round 1, Activity 2) is the spec; this file is the build plan and the living task list. Tick tasks as they land; add decisions at the bottom instead of re-planning.

## Decisions (asked 2026-11-13)

| Topic | Decision |
|---|---|
| Where | Upgrade Munshi Talk. Chat keeps working as now. |
| Understanding | Local parser first (online and offline). Only what it cannot read goes to Claude Haiku. Revisit after testing. |
| His phone | Android, Chrome. |
| Offline speech-to-text | Chrome on-device recognition (`SpeechRecognition` with `processLocally: true`, lang `hi-IN`). Parser reads Hindi, Nepali and Maithili words in both scripts. |
| Offline reply | Card on screen + the phone's own voice (`speechSynthesis`). |
| Online reply | Always Sarvam Bulbul. |
| Scope | Everything in the prompt: multi-entry with one confirm, undo + "galti", duplicate and unusual-amount checks, name buttons + learned aliases, questions answered locally, close day by voice, offline clips. |
| Recharge udharo without a network named | Always ask: "NTC ki Ncell?" (and e-load or card) as big buttons. |
| "X ne 100 diya" | Payback words (wapas, chukaya, tiryo, फिर्ता, तिर्यो) = payback. A collection customer = deposit. Someone who only owes udharo = payback. Both and no word = ask "Jama ki udhaar wapas?". |
| Close day by voice | "Aaj 4,350 hona chahiye. Kitna gine?" He says the counted amount; a difference is read out; "haan" closes (`closeDay` op with countedCash). |
| Demo data | Seed the Super Admin account (+977 9503517330): 12 customers incl. look-alikes, a few days of entries, recharge stock and udharo. |

## How it works

```
mic -> utterance audio
  online : POST /api/munshi/hear (Saaras, names as keyterms) -> transcript
  offline: SpeechRecognition(hi-IN, processLocally) -> transcript
           (if unavailable or nothing usable: keep the clip in IndexedDB as pending)
transcript -> lib/voice/parse.ts (pure, tested, same code both ways)
  entries   -> cards (deposit | credit | payback | shop_closed | no_money), checks, reply text
  yes/no    -> confirm or reopen the open cards
  undo      -> reverse the last save
  question  -> answered from the phone's data (missed today, cash today, udharo owed)
  close day -> close-day dialogue
  unknown   -> online: Munshi agent (Claude Haiku, existing tools); offline: "online hone par"
reply text -> online: POST /api/munshi/say (Bulbul) ; offline: speechSynthesis
confirm    -> queueOp (existing outbox: mark / rechargeSale / rechargePayback / closeDay), so it works offline
```

Saves from parser cards go through the existing offline queue on the phone, not through server tools, so a confirmed card is saved the same way a tap on Today is. Agent cards (Haiku path) keep the current server commit.

## Modules and tasks

### M1 - Parser core (`apps/main/lib/voice/`, pure, vitest)
- [x] `numbers.ts`: digits (Latin + Devanagari), number words in Hindi / Nepali / Maithili / English, Roman and Devanagari (ek..nau, das..sau, pachas, saya/sau/say, hazar/hajar, lakh, dedh, dhai, sawa, saadhe, paune), compound ("paanch saya pachas" = 550, "dedh hazar" = 1500, "2 hazar 500").
- [x] `names.ts`: Devanagari -> Latin transliteration, phonetic key (vowel length, b/v, sh/s/ś, aa/a, ph/f, w/v, double letters, trailing a), score names + aliases, return hit / candidates. Unique strong match = hit; two close = ambiguous.
- [x] intents (in `parse.ts`): yes / no / undo ("galti", "hatau", "undo") / questions (missed, cash, udharo) / close day / correction ("nahi, chhe saya") / entries. Split several entries in one sentence.
- [x] Kind rules: deposit vs payback ("diya" rule above), credit words (udhaar, udharo, baaki), shop closed (pasal band, dukan band), no money (paisa chhaina, paisa nahi). Recharge words + network (ntc, ncell, namaste) + stock (card, load).
- [x] Dates: aaj, kal (yesterday when said with a past verb), weekday names -> most recent past day.
- [x] `detectLang` (in `parse.ts`): which language he spoke (hi / ne / mai / en) from marker words, for the reply.
- [ ] (moved to M3) `replies.ts`: every spoken and shown line in hi / ne / mai / en (Devanagari for TTS).
- [x] Tests: at least 60 utterances across the three languages, both scripts, look-alike names.

### M2 - Data: aliases and demo seed
- [x] `customer.aliases text[] default '{}'`, `db:push` (additive). Offline op `customerAlias` + `addCustomerAlias` action; snapshot carries aliases. (Recharge people: later, if needed.)
- [ ] (M3) Learn an alias when he corrects a name (what was heard -> chosen customer); carried in the day snapshot so it works offline.
- [x] `pnpm --filter @repo/db db:seed-demo` (packages/db/src/seed-demo.ts) for the Super Admin demo: 12 customers (Ram Bahadur, Ram Babu, Ramesh, Sita Devi, Sita Kumari, Mohan, Mohan Lal...), 5 days of entries with a few misses, recharge stock and two udharo people. Re-runnable, only touches that account.

### M3 - Talk mode: the card loop
- [ ] `POST /api/munshi/hear` (audio -> transcript, keyterms incl. aliases) and `POST /api/munshi/say` (text -> Bulbul mp3).
- [ ] Client engine (state machine) in Talk mode: listen -> transcript -> parse -> cards -> speak -> listen.
- [ ] Several cards, one "haan" saves all; tap a card to edit name, amount, kind.
- [ ] Name buttons for two candidates (say or tap); "naya banau?" for no match (add customer card).
- [ ] Checks: duplicate (same customer + amount within 10 min, or already marked today), unusual amount (> 5x daily, or not a multiple of 10) needs an explicit "haan".
- [ ] Undo for 10 s after each save; "galti" undoes the last save.
- [ ] Two failed hearings -> customer list + number pad.
- [ ] Unknown sentences -> existing agent (Haiku) with the transcript; its cards keep working.

### M4 - Answers and close day, from the phone's data
- [ ] "Aaj kisne nahi diya?" -> first five names spoken, full list shown.
- [ ] "Kitna paisa hona chahiye?" -> collection received today + recharge cash (from the recharge ledger), split read out.
- [ ] "Ramesh ka kitna baaki?" -> udharo / dues for one person.
- [ ] "Din band karo" -> expected, "kitna gine?", difference, "haan" -> closeDay.

### M5 - Offline voice
- [ ] `useLocalRecognizer`: feature-detect, `available({langs:["hi-IN"], processLocally:true})`, `install()` from a tap in Settings ("Download offline voice"), status shown there.
- [ ] Offline Talk uses it; `speechSynthesis` (hi-IN voice) for replies.
- [ ] Clip fallback: recording saved in IndexedDB as a pending voice entry; on reconnect -> hear -> parse -> cards marked "from earlier" for him to confirm.
- [ ] Pill: "Online" / "Offline - 3 pending".

### M6 - Polish and docs
- [ ] All UI strings in dict (en, ne) and dict-mai.
- [ ] CLAUDE.md section, this plan updated, short demo script for judges.
- [ ] Manual pass on a real Android phone (offline pack, airplane mode).

## Done when
- Online voice deposit saved in at most two turns, reply starting within about 3 s.
- Nothing is saved without a spoken or tapped confirmation.
- Flows work on the seed data in Hindi, Nepali, Maithili and mixed.
- Airplane mode: a deposit still saves; a pending clip is processed and confirmed after reconnecting.

## Notes
- Web Speech facts (MDN, Nov 2026): `SpeechRecognition.available({langs, processLocally})` -> "available" | "downloadable" | "downloading" | "unavailable"; `install()` needs a user gesture when it downloads; packs read "downloadable" until the page has called install() once. Without processLocally, Chrome recognition is server-based and does not work offline. Chrome Android support for on-device must be checked on his phone (M5 first task).
- Bulbul has no Nepali voice; Devanagari is read with hi-IN (as today).
