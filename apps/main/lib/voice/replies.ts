/**
 * Everything Munshi says back in the voice loop, in the language he spoke. Devanagari for Hindi,
 * Nepali and Maithili (Bulbul and the phone's Hindi voice both read it), plain English otherwise.
 */
import type { EntryKind, VoiceLang } from "./parse"

const n = (x: number) => x.toLocaleString("en-IN")
const list = (names: string[]) => names.join(", ")

type Lines = {
    kind: Record<EntryKind, string>
    confirmOne: (name: string, amount: number | null, kind: string, when: string | null) => string
    confirmMany: (count: number, total: number) => string
    yesterday: string
    which: (names: string[]) => string
    notInList: (heard: string) => string
    whichKind: (name: string) => string
    whichNetwork: string
    duplicate: (name: string, amount: number) => string
    unusual: (name: string, amount: number) => string
    stockLow: (left: number) => string
    howMuch: string
    saved: (count: number) => string
    nothingPending: string
    undone: (what: string) => string
    nothingToUndo: string
    cancelled: string
    missed: (names: string[], count: number) => string
    noneMissed: string
    cash: (total: number, collection: number, recharge: number) => string
    owed: (name: string, amount: number) => string
    owesNothing: (name: string) => string
    closeAsk: (expected: number) => string
    closeDiff: (counted: number, diff: number) => string
    closed: string
    dayLocked: string
    didntHear: string
    later: string
    needsFirst: string
}

const hi: Lines = {
    kind: { deposit: "जमा", credit: "उधार", payback: "उधार वापस", shop_closed: "दुकान बंद", no_money: "आज पैसा नहीं" },
    confirmOne: (name, a, k, when) => `${name}, ${a !== null ? `${n(a)} ` : ""}${k}${when ? `, ${when}` : ""}। ठीक?`,
    confirmMany: (c, t) => `${c} एंट्री, कुल ${n(t)}। ठीक?`,
    yesterday: "कल का",
    which: (names) => `${names.join(" या ")}?`,
    notInList: (h) => `${h} लिस्ट में नहीं है। कौन?`,
    whichKind: (name) => `${name}, जमा या उधार वापस?`,
    whichNetwork: "NTC या Ncell? लोड या कार्ड?",
    duplicate: (name, a) => `${name} का ${n(a)} आज पहले ही सेव है। फिर से?`,
    unusual: (name, a) => `${name}, ${n(a)} रुपये। पक्का?`,
    stockLow: (l) => `स्टॉक सिर्फ ${n(l)} है।`,
    howMuch: "कितना?",
    saved: (c) => (c > 1 ? `${c} एंट्री सेव हो गई।` : "सेव हो गया।"),
    nothingPending: "अभी कुछ सेव करने को नहीं है।",
    undone: (w) => `हटा दिया: ${w}।`,
    nothingToUndo: "हटाने को कुछ नहीं है।",
    cancelled: "ठीक है, छोड़ दिया।",
    missed: (names, c) => `आज ${c} लोगों ने नहीं दिया: ${list(names)}${c > names.length ? " और बाकी स्क्रीन पर" : ""}।`,
    noneMissed: "आज सबने दे दिया।",
    cash: (t, c, r) => `आज ${n(t)} रुपये होने चाहिए: जमा ${n(c)}${r ? `, रिचार्ज ${n(r)}` : ""}।`,
    owed: (name, a) => `${name} का ${n(a)} उधार बाकी है।`,
    owesNothing: (name) => `${name} का कुछ बाकी नहीं है।`,
    closeAsk: (e) => `आज ${n(e)} होने चाहिए। कितना गिना?`,
    closeDiff: (c, d) => `${n(c)} गिना। ${d === 0 ? "बराबर है" : d > 0 ? `${n(d)} कम है` : `${n(-d)} ज़्यादा है`}। दिन बंद करूँ?`,
    closed: "आज का दिन बंद हो गया।",
    dayLocked: "यह दिन पहले ही बंद है।",
    didntHear: "सुनाई नहीं दिया, फिर बोलिए।",
    later: "ये ऑनलाइन होने पर सुनेंगे।",
    needsFirst: "पहले कार्ड पूरा करें।",
}

const ne: Lines = {
    kind: { deposit: "जम्मा", credit: "उधारो", payback: "उधारो फिर्ता", shop_closed: "पसल बन्द", no_money: "आज पैसा छैन" },
    confirmOne: (name, a, k, when) => `${name}, ${a !== null ? `${n(a)} ` : ""}${k}${when ? `, ${when}` : ""}। ठिक छ?`,
    confirmMany: (c, t) => `${c} वटा, जम्मा ${n(t)}। ठिक छ?`,
    yesterday: "हिजोको",
    which: (names) => `${names.join(" कि ")}?`,
    notInList: (h) => `${h} सूचीमा छैन। को हो?`,
    whichKind: (name) => `${name}, जम्मा कि उधारो फिर्ता?`,
    whichNetwork: "NTC कि Ncell? लोड कि कार्ड?",
    duplicate: (name, a) => `${name} को ${n(a)} आज पहिल्यै सेभ छ। फेरि?`,
    unusual: (name, a) => `${name}, ${n(a)} रुपैयाँ। पक्का?`,
    stockLow: (l) => `स्टक ${n(l)} मात्र छ।`,
    howMuch: "कति?",
    saved: (c) => (c > 1 ? `${c} वटा सेभ भयो।` : "सेभ भयो।"),
    nothingPending: "अहिले सेभ गर्ने केही छैन।",
    undone: (w) => `हटाएँ: ${w}।`,
    nothingToUndo: "हटाउने केही छैन।",
    cancelled: "ठिक छ, छोडिदिएँ।",
    missed: (names, c) => `आज ${c} जनाले दिएनन्: ${list(names)}${c > names.length ? " र बाँकी स्क्रिनमा" : ""}।`,
    noneMissed: "आज सबैले दिए।",
    cash: (t, c, r) => `आज ${n(t)} रुपैयाँ हुनुपर्छ: जम्मा ${n(c)}${r ? `, रिचार्ज ${n(r)}` : ""}।`,
    owed: (name, a) => `${name} को ${n(a)} उधारो बाँकी छ।`,
    owesNothing: (name) => `${name} को केही बाँकी छैन।`,
    closeAsk: (e) => `आज ${n(e)} हुनुपर्छ। कति गन्नुभयो?`,
    closeDiff: (c, d) => `${n(c)} गन्नुभयो। ${d === 0 ? "बराबर छ" : d > 0 ? `${n(d)} कम छ` : `${n(-d)} बढी छ`}। दिन बन्द गरूँ?`,
    closed: "आजको दिन बन्द भयो।",
    dayLocked: "यो दिन पहिल्यै बन्द छ।",
    didntHear: "सुनिएन, फेरि भन्नुस्।",
    later: "यो अनलाइन भएपछि सुन्छु।",
    needsFirst: "पहिले कार्ड पूरा गर्नुस्।",
}

const mai: Lines = {
    kind: { deposit: "जमा", credit: "उधार", payback: "उधार वापस", shop_closed: "दोकान बन्द", no_money: "आइ पाइ नै" },
    confirmOne: (name, a, k, when) => `${name}, ${a !== null ? `${n(a)} ` : ""}${k}${when ? `, ${when}` : ""}। ठीक छै?`,
    confirmMany: (c, t) => `${c} टा, कुल ${n(t)}। ठीक छै?`,
    yesterday: "काल्हिक",
    which: (names) => `${names.join(" की ")}?`,
    notInList: (h) => `${h} लिस्ट मे नै छथि। के?`,
    whichKind: (name) => `${name}, जमा की उधार वापस?`,
    whichNetwork: "NTC की Ncell? लोड की कार्ड?",
    duplicate: (name, a) => `${name} के ${n(a)} आइ पहिने सेव छै। फेर सँ?`,
    unusual: (name, a) => `${name}, ${n(a)} टाका। पक्का?`,
    stockLow: (l) => `स्टक मात्र ${n(l)} छै।`,
    howMuch: "कतेक?",
    saved: (c) => (c > 1 ? `${c} टा सेव भ गेल।` : "सेव भ गेल।"),
    nothingPending: "एखन सेव करबाक लेल किछु नै छै।",
    undone: (w) => `हटा देलहुँ: ${w}।`,
    nothingToUndo: "हटेबाक लेल किछु नै छै।",
    cancelled: "ठीक छै, छोड़ि देलहुँ।",
    missed: (names, c) => `आइ ${c} गोटे नै देलक: ${list(names)}${c > names.length ? " आ बाँकी स्क्रीन पर" : ""}।`,
    noneMissed: "आइ सब दऽ देलक।",
    cash: (t, c, r) => `आइ ${n(t)} टाका होबाक चाही: जमा ${n(c)}${r ? `, रिचार्ज ${n(r)}` : ""}।`,
    owed: (name, a) => `${name} के ${n(a)} उधार बाँकी छै।`,
    owesNothing: (name) => `${name} के किछु बाँकी नै छै।`,
    closeAsk: (e) => `आइ ${n(e)} होबाक चाही। कतेक गनलहुँ?`,
    closeDiff: (c, d) => `${n(c)} गनलहुँ। ${d === 0 ? "बराबर छै" : d > 0 ? `${n(d)} कम छै` : `${n(-d)} बेसी छै`}। दिन बन्द करू?`,
    closed: "आइक दिन बन्द भ गेल।",
    dayLocked: "ई दिन पहिने सँ बन्द छै।",
    didntHear: "नै सुनलहुँ, फेर सँ बाजू।",
    later: "ई ऑनलाइन भेला पर सुनब।",
    needsFirst: "पहिने कार्ड पूरा करू।",
}

const en: Lines = {
    kind: { deposit: "deposit", credit: "udharo", payback: "udharo paid back", shop_closed: "shop closed", no_money: "no money today" },
    confirmOne: (name, a, k, when) => `${name}, ${a !== null ? `${n(a)} ` : ""}${k}${when ? `, ${when}` : ""}. Okay?`,
    confirmMany: (c, t) => `${c} entries, total ${n(t)}. Okay?`,
    yesterday: "for yesterday",
    which: (names) => `${names.join(" or ")}?`,
    notInList: (h) => `${h} is not in your list. Who is it?`,
    whichKind: (name) => `${name}: deposit, or udharo paid back?`,
    whichNetwork: "NTC or Ncell? Load or card?",
    duplicate: (name, a) => `${name}'s ${n(a)} is already saved today. Again?`,
    unusual: (name, a) => `${name}, ${n(a)} rupees. Sure?`,
    stockLow: (l) => `Only ${n(l)} in stock.`,
    howMuch: "How much?",
    saved: (c) => (c > 1 ? `${c} entries saved.` : "Saved."),
    nothingPending: "There is nothing to save right now.",
    undone: (w) => `Removed: ${w}.`,
    nothingToUndo: "Nothing to undo.",
    cancelled: "Okay, left it.",
    missed: (names, c) => `${c} have not paid today: ${list(names)}${c > names.length ? ", and the rest on screen" : ""}.`,
    noneMissed: "Everyone has paid today.",
    cash: (t, c, r) => `You should have ${n(t)} today: ${n(c)} collection${r ? `, ${n(r)} recharge` : ""}.`,
    owed: (name, a) => `${name} owes ${n(a)} udharo.`,
    owesNothing: (name) => `${name} owes nothing.`,
    closeAsk: (e) => `You should have ${n(e)} today. How much did you count?`,
    closeDiff: (c, d) => `You counted ${n(c)}. ${d === 0 ? "That matches" : d > 0 ? `${n(d)} short` : `${n(-d)} extra`}. Close the day?`,
    closed: "Today is closed.",
    dayLocked: "That day is already closed.",
    didntHear: "I didn't hear that, please say it again.",
    later: "I'll listen to this once you're online.",
    needsFirst: "Finish the card first.",
}

export const REPLIES: Record<VoiceLang, Lines> = { hi, ne, mai, en }
