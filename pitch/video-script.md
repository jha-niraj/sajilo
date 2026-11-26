# Sajilo - demo video script (under 3 minutes)

Record on the live app (with the Sarvam key) or `docker compose up` with `SARVAM_API_KEY` set. Phone-sized Chrome window or a real Android phone, signed in as the demo book (9503517330 / 3110). Speak to camera only in parts 1 and 4; the middle is screen + your voice to Sajilo.

## 1. The problem (0:00 - 0:25)
Screen: the landing page hero, then scroll slowly through the Story section.

> "This is my father. Every evening from four to eight he walks shop to shop collecting small daily savings, Rs 50 here, Rs 500 there, and writes every rupee twice in a red notebook. At night the bag of cash has to match the book. In India the same work is done by pigmy agents, bank mitras and every kirana with an udhaar book. They all write. None of them want to type."

## 2. The solution in one line (0:25 - 0:40)
Screen: sign in with the PIN, land on Munshi, switch to Talk.

> "Sajilo is a ledger you talk to. Say the name and the amount, hear it back, say haan. It is saved, even with no network."

## 3. Demo (0:40 - 2:30)
Say each line to the phone. Let each reply play; cut silences in editing.

1. **Two entries, one haan, a look-alike name (0:40)**
   You: "Ram Bahadur paanch sau, Sita do sau"
   Sajilo shows two cards and asks "Sita Devi ya Sita Kumari?"
   You: "Sita Kumari" ... "haan"
   Point at the Undo bar: both saved.
2. **It catches a repeat (1:05)**
   You: "Ram Bahadur paanch sau"
   Sajilo: already saved today, again? You: "nahi". The card goes.
3. **Udharo on recharge (1:20)**
   You: "Bikash ko do sau recharge udhaar"
   Sajilo: "NTC ya Ncell? Load ya card?" You: "NTC load" ... "haan"
4. **Questions instead of turning pages (1:40)**
   You: "aaj kisne nahi diya?" (list on screen)
   You: "kitna paisa hona chahiye?" (the total, split into collection and recharge)
5. **A mistake is one word (1:55)**
   You: "galti". The last save is undone.
6. **No network (2:05)**
   Turn on airplane mode. You: "Hari Prasad teen sau" ... "haan". Saved on the phone, the pill shows 1 waiting. Turn it off: it syncs.
7. **Close the day (2:20)**
   You: "aaj ka hisaab band karo". Say the amount you counted. "haan".

## 4. Why it matters and what's next (2:30 - 2:55)
Screen: Today list and the printed month register, then back to you.

> "Nothing saves without his haan, look-alike names are always asked, odd amounts are flagged, and anything can be undone. Next month my father runs his whole book on it, then ten collectors from his branch, then a pigmy-agent pilot here in Bengaluru with Kannada. Sajilo: he says it, Sajilo writes it."

## Checklist before recording
- Run `pnpm --filter @repo/db db:seed-demo` (or `docker compose down -v && up`) so the book is fresh.
- App language English; Talk mode allowed to use the microphone.
- For step 6, tap "Get offline voice" on Munshi once while online, so Chrome has its on-device pack before airplane mode.
- Upload to YouTube as Unlisted; keep it under 3:00.
