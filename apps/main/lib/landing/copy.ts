import type { Lang } from "@/lib/dict"

/*
 * Words for the public pages (/ and /about), in the three app languages. Kept apart from lib/dict.ts because they are
 * long-form story copy, not UI labels; the shape is typed so a language can never miss a line.
 * Maithili is in Devanagari here (the app screens keep lib/dict-mai.ts in English letters).
 */

type Chapter = { id: "walk" | "counter" | "night" | "says" | "closes"; title: string; line: string; heading: string; muted: string }
type Feature = { title: string; line: string; chip: string }
type DayStep = { title: string; moment: string; text: string; say: string; reply: string }
type Who = { title: string; say: string; soon?: boolean }
type AboutChapter = { title: string; paras: string[] }

export interface LandingCopy {
    nav: { story: string; features: string; day: string; who: string; about: string; signIn: string; menu: string; home: string }
    hero: { kicker: string; title: string; accent: string; lead: string; watch: string; signIn: string }
    story: { kicker: string; title: string; chapters: Chapter[] }
    features: { kicker: string; title: string; muted: string; items: Feature[] }
    day: { kicker: string; title: string; muted: string; hint: string; steps: DayStep[] }
    who: { kicker: string; title: string; muted: string; soon: string; items: Who[] }
    cta: { title: string; muted: string; signIn: string; about: string }
    footer: { tagline: string; made: string; contact: string }
    about: {
        kicker: string
        title: string
        lead: string
        chapters: AboutChapter[]
        contactKicker: string
        contactTitle: string
        contactMuted: string
        email: string
    }
}

const en: LandingCopy = {
    nav: { story: "Story", features: "What it does", day: "A day with Sajilo", who: "Who it's for", about: "About", signIn: "Sign in", menu: "Menu", home: "Home" },
    hero: {
        kicker: "A bookkeeper you talk to",
        title: "He says it.",
        accent: "Sajilo writes it.",
        lead: "My father collects daily savings from shop to shop in Nepal. Sajilo lets him say each entry out loud, in his own language, and keeps the book for him - even with no signal.",
        watch: "Watch the story",
        signIn: "Sign in",
    },
    story: {
        kicker: "The story",
        title: "One evening, one ledger, one bag of cash.",
        chapters: [
            {
                id: "walk",
                title: "Four in the evening",
                line: "The round starts",
                heading: "Four in the evening.",
                muted: "My father sets out with a cloth bag, a red ledger and a pen. Shop after shop until dark, a small deposit at each.",
            },
            {
                id: "counter",
                title: "Every counter",
                line: "Written twice, standing up",
                heading: "Fifty, a hundred, five hundred.",
                muted: "He writes each one twice - in his ledger and in the customer's passbook - standing at the counter with cash in his other hand.",
            },
            {
                id: "night",
                title: "The night",
                line: "When the bag doesn't match",
                heading: "The night the bag doesn't match.",
                muted: "At home he counts the bag against the book. When it is short, he reads his own handwriting until late. One missed line is an upset customer, or money from his own pocket.",
            },
            {
                id: "says",
                title: "Now he says it",
                line: "Name, amount, haan",
                heading: "Now he just says it.",
                muted: "\"Ram Bahadur, 500.\" Sajilo finds the name, says it back, and saves only when he says haan - in Nepali, Maithili or Hindi.",
            },
            {
                id: "closes",
                title: "The day closes",
                line: "The total is already there",
                heading: "The day closes itself.",
                muted: "The total is ready before he gets home. He counts the bag once and tells Sajilo; if it is off, he knows by how much right away.",
            },
        ],
    },
    features: {
        kicker: "What it does",
        title: "Made for a counter, not a desk.",
        muted: "Everything he does in a day, by voice, with a tap when he wants one.",
        items: [
            { title: "Speaks his languages", line: "Nepali, Maithili, Hindi or a mix. Names and amounts the way he says them.", chip: "नेपाली · Maithili · हिन्दी" },
            { title: "Works with no signal", line: "The phone hears him and saves on the phone. It syncs when the network is back.", chip: "Offline · 3 waiting" },
            { title: "Nothing saves without haan", line: "It reads every entry back. Look-alike names, repeats and odd amounts get a question first.", chip: "Ram Bahadur 500 · haan?" },
            { title: "Galti? Take it back", line: "Ten seconds to undo, or just say \"galti\" and the last entry is gone.", chip: "Undo · 10s" },
            { title: "Recharge and udharo too", line: "NTC and Ncell load and cards, and who still owes him what.", chip: "NTC · Ncell · udharo" },
            { title: "Answers out loud", line: "Who hasn't paid this week? How much cash should I have? It says it back.", chip: "Cash to have: Rs 4,850" },
        ],
    },
    day: {
        kicker: "A day with Sajilo",
        title: "From the first shop to the last count.",
        muted: "What he says, and what Sajilo says back.",
        hint: "Tap a moment",
        steps: [
            { title: "Before he leaves", moment: "3:30", text: "Before the round he asks who is behind. Sajilo reads out the names.", say: "Kasle tireko chhaina?", reply: "Mohan, Gita Store, Laxmi Devi." },
            { title: "At the counter", moment: "5:00", text: "Two shops in one breath. Two cards, one haan saves both.", say: "Sita Devi 200, Mohan 100", reply: "Sita Devi 200, Mohan 100. Thik?" },
            { title: "Udharo", moment: "6:15", text: "Recharge on credit. Sajilo asks which network before it saves.", say: "Ramesh, 200 load udharo", reply: "NTC ki Ncell?" },
            { title: "No signal", moment: "7:00", text: "In the gully there is no network. The phone still hears him and keeps it.", say: "Hari Prasad, 300", reply: "Saved on the phone. Sends when online." },
            { title: "Back home", moment: "8:30", text: "Back home, he closes the day by voice and tells it what he counted.", say: "Aajako hisab band gara", reply: "Rs 4,850 today. How much is in the bag?" },
        ],
    },
    who: {
        kicker: "Who it's for",
        title: "Anyone who keeps money on foot.",
        muted: "Built for my father first. The same say-it, hear-it, haan works for them too.",
        soon: "Next",
        items: [
            { title: "Daily savings collectors", say: "Ram Bahadur, paanch saya." },
            { title: "Recharge shops", say: "Ramesh, NTC 100 udharo." },
            { title: "Milk collection", say: "Gopal, 5 litre.", soon: true },
            { title: "Small lenders", say: "Hari le 2000 tiryo." },
        ],
    },
    cta: {
        title: "Built for one man first.",
        muted: "If it works for my father at a busy counter, it can work for anyone who writes money down standing up.",
        signIn: "Sign in",
        about: "Why I built it",
    },
    footer: { tagline: "A bookkeeper you talk to.", made: "Made in Nepal, for my father.", contact: "Contact" },
    about: {
        kicker: "About",
        title: "Why I'm building Sajilo.",
        lead: "This is the story behind the app: who I am, what my father faces every day, and where Sajilo goes next.",
        chapters: [
            {
                title: "Who I am",
                paras: [
                    "I'm Niraj Jha, a software engineer from Nepal. I did my B.Tech at Lovely Professional University and work as a full stack engineer at Creatr.",
                    "I build products for this part of the world: Gurukul for schools, Vidhica for legal research, SyncHQ for teams and RakamHQ for merchants' payments. Sajilo is the most personal one.",
                ],
            },
            {
                title: "My father's day",
                paras: [
                    "My father is a daily savings collector. Every evening he walks from shop to shop, takes small deposits and writes each one in his ledger and in the customer's passbook. He also sells NTC and Ncell recharge, often on credit.",
                    "Every night the cash in his bag has to match the book. When it doesn't, he goes back through pages of his own handwriting, late into the night.",
                ],
            },
            {
                title: "Why voice",
                paras: [
                    "Apps already exist. They want typing, small buttons, English and a steady network. He has none of that at a counter with cash in one hand and a passbook in the other.",
                    "But he already says the amount out loud to the customer. So Sajilo listens, says it back, and waits for his haan.",
                ],
            },
            {
                title: "What it solves",
                paras: [
                    "No writing everything twice. A day total that is ready before he gets home. Nothing saved without his yes, and every mistake one word away from undone. Recharge and udharo in the same book. And it keeps working where the signal drops.",
                ],
            },
            {
                title: "What comes next",
                paras: [
                    "First, every day with my father, until he stops carrying the notebook. Then with other collectors in his town, then recharge shops, milk collection and small lenders.",
                    "The goal is simple: anyone in Nepal or India who records money on foot should be able to just say it.",
                ],
            },
        ],
        contactKicker: "Contact",
        contactTitle: "Say hello.",
        contactMuted: "Questions, ideas, or you know a collector who should try it.",
        email: "Email",
    },
}

const ne: LandingCopy = {
    nav: { story: "कथा", features: "के गर्छ", day: "सजिलोसँग एक दिन", who: "कसका लागि", about: "हाम्रो बारेमा", signIn: "लग इन", menu: "मेनु", home: "गृहपृष्ठ" },
    hero: {
        kicker: "बोलेर हिसाब राख्ने मुन्सी",
        title: "उहाँ बोल्नुहुन्छ।",
        accent: "सजिलो लेख्छ।",
        lead: "मेरो बुबा नेपालमा पसल-पसल गएर दैनिक बचत उठाउनुहुन्छ। सजिलोमा उहाँ हरेक हिसाब आफ्नै भाषामा बोल्नुहुन्छ, र सजिलोले खाता राख्छ - नेटवर्क नहुँदा पनि।",
        watch: "कथा हेर्नुहोस्",
        signIn: "लग इन",
    },
    story: {
        kicker: "कथा",
        title: "एक साँझ, एउटा खाता, एउटा पैसाको झोला।",
        chapters: [
            {
                id: "walk",
                title: "बेलुका ४ बजे",
                line: "घर-घर, पसल-पसल",
                heading: "बेलुका ४ बजे।",
                muted: "बुबा कपडाको झोला, रातो खाता र कलम लिएर निस्कनुहुन्छ। अँध्यारो नहुँदासम्म एकपछि अर्को पसल, हरेकमा थोरै-थोरै बचत।",
            },
            {
                id: "counter",
                title: "हरेक पसलमा",
                line: "उभिएरै, दुई ठाउँमा लेख्ने",
                heading: "पचास, सय, पाँच सय।",
                muted: "हरेक रकम दुई ठाउँमा लेख्नुहुन्छ - आफ्नो खातामा र ग्राहकको पासबुकमा। उभिएरै, अर्को हातमा पैसा समातेर।",
            },
            {
                id: "night",
                title: "राति",
                line: "झोला र खाता नमिल्दा",
                heading: "झोला र खाता नमिलेको रात।",
                muted: "घर आएर झोलाको पैसा खातासँग मिलाउनुहुन्छ। पैसा कम भए राति अबेरसम्म आफ्नै लेखाइ पढिरहनुहुन्छ। एउटा लाइन छुट्यो भने ग्राहक रिसाउँछ, नत्र आफ्नै खल्तीबाट तिर्नुपर्छ।",
            },
            {
                id: "says",
                title: "अब बोल्नुहुन्छ",
                line: "नाम, रकम, हो",
                heading: "अब बोले मात्र पुग्छ।",
                muted: "\"राम बहादुर, ५००।\" सजिलोले नाम खोज्छ, फेरि सुनाउँछ, र उहाँले \"हो\" भनेपछि मात्र सेभ गर्छ - नेपाली, मैथिली वा हिन्दीमा।",
            },
            {
                id: "closes",
                title: "हिसाब बन्द",
                line: "जम्मा पहिल्यै तयार",
                heading: "दिनको हिसाब आफैँ बन्द हुन्छ।",
                muted: "घर पुग्नुअघि नै जम्मा तयार हुन्छ। झोला एकपटक गनेर सजिलोलाई भन्नुहुन्छ; नमिले कति फरक छ भन्ने तुरुन्तै थाहा हुन्छ।",
            },
        ],
    },
    features: {
        kicker: "के गर्छ",
        title: "टेबलमा होइन, पसलको काउन्टरमा चल्ने गरी बनेको।",
        muted: "दिनभरको काम बोलेरै, चाहे एक ट्यापमा।",
        items: [
            { title: "उहाँकै भाषा बुझ्छ", line: "नेपाली, मैथिली, हिन्दी वा मिसाएर। नाम र रकम जसरी भन्नुहुन्छ, त्यसरी नै।", chip: "नेपाली · मैथिली · हिन्दी" },
            { title: "नेटवर्क नभए पनि चल्छ", line: "फोनले नै सुनेर फोनमै सेभ गर्छ। नेटवर्क आएपछि आफैँ पठाउँछ।", chip: "अफलाइन · ३ बाँकी" },
            { title: "\"हो\" नभनी केही सेभ हुँदैन", line: "हरेक हिसाब फेरि सुनाउँछ। उस्तै नाम, दोहोरिएको वा अनौठो रकम भए पहिले सोध्छ।", chip: "राम बहादुर ५०० · हो?" },
            { title: "गल्ती भयो? फिर्ता लिनुहोस्", line: "दस सेकेन्डभित्र अन्डू, वा \"गल्ती\" भन्नुहोस् - पछिल्लो हिसाब हट्छ।", chip: "अन्डू · १० सेकेन्ड" },
            { title: "रिचार्ज र उधारो पनि", line: "NTC र Ncell लोड र कार्ड, र कसको कति बाँकी छ।", chip: "NTC · Ncell · उधारो" },
            { title: "बोलेरै जवाफ दिन्छ", line: "यो हप्ता कसले तिरेन? मसँग कति पैसा हुनुपर्ने? बोलेरै भन्छ।", chip: "हातमा हुनुपर्ने: रु ४,८५०" },
        ],
    },
    day: {
        kicker: "सजिलोसँग एक दिन",
        title: "पहिलो पसलदेखि अन्तिम गन्तीसम्म।",
        muted: "उहाँ के भन्नुहुन्छ, सजिलो के जवाफ दिन्छ।",
        hint: "एउटा समय छान्नुहोस्",
        steps: [
            { title: "निस्कनुअघि", moment: "३:३०", text: "निस्कनुअघि कसको बाँकी छ भनेर सोध्नुहुन्छ। सजिलोले नाम पढेर सुनाउँछ।", say: "कसले तिरेको छैन?", reply: "मोहन, गीता स्टोर, लक्ष्मी देवी।" },
            { title: "काउन्टरमा", moment: "५:००", text: "एकै सासमा दुई पसल। दुई कार्ड, एउटै \"हो\" ले दुवै सेभ।", say: "सीता देवी २००, मोहन १००", reply: "सीता देवी २००, मोहन १००। ठीक छ?" },
            { title: "उधारो", moment: "६:१५", text: "उधारोमा रिचार्ज। सेभ गर्नुअघि कुन नेटवर्क हो भनेर सोध्छ।", say: "रमेश, २०० लोड उधारो", reply: "NTC कि Ncell?" },
            { title: "नेटवर्क छैन", moment: "७:००", text: "गल्लीमा नेटवर्क छैन। फोनले तैपनि सुन्छ र राख्छ।", say: "हरि प्रसाद, ३००", reply: "फोनमा सेभ भयो। नेट आएपछि पठाउँछ।" },
            { title: "घर फर्केपछि", moment: "८:३०", text: "बोलेरै दिनको हिसाब बन्द गर्नुहुन्छ र झोलामा कति छ भन्नुहुन्छ।", say: "आजको हिसाब बन्द गर", reply: "आज रु ४,८५०। झोलामा कति छ?" },
        ],
    },
    who: {
        kicker: "कसका लागि",
        title: "हिँडेर पैसाको हिसाब राख्ने सबैका लागि।",
        muted: "पहिले मेरो बुबाका लागि बनाएको। बोल्ने, सुन्ने र \"हो\" भन्ने यही तरिका अरूलाई पनि काम लाग्छ।",
        soon: "छिट्टै",
        items: [
            { title: "दैनिक बचत संकलक", say: "राम बहादुर, पाँच सय।" },
            { title: "रिचार्ज पसल", say: "रमेश, NTC १०० उधारो।" },
            { title: "दूध संकलन", say: "गोपाल, ५ लिटर।", soon: true },
            { title: "साना ऋण दिनेहरू", say: "हरिले २००० तिर्‍यो।" },
        ],
    },
    cta: {
        title: "पहिले एक जनाका लागि बनाएको।",
        muted: "भीड भएको काउन्टरमा मेरो बुबालाई काम लाग्यो भने, उभिएर पैसाको हिसाब लेख्ने जो कोहीलाई काम लाग्छ।",
        signIn: "लग इन",
        about: "किन बनाएँ",
    },
    footer: { tagline: "बोलेर हिसाब राख्ने मुन्सी।", made: "नेपालमा बनेको, मेरो बुबाका लागि।", contact: "सम्पर्क" },
    about: {
        kicker: "हाम्रो बारेमा",
        title: "म सजिलो किन बनाउँदैछु।",
        lead: "यो एपको कथा: म को हुँ, मेरो बुबाको दिन कस्तो हुन्छ, र सजिलो अब कता जाँदैछ।",
        chapters: [
            {
                title: "म को हुँ",
                paras: [
                    "म Niraj Jha, नेपालको सफ्टवेयर इन्जिनियर। लभली प्रोफेसनल युनिभर्सिटीबाट बी.टेक गरेँ र अहिले Creatr मा फुल स्ट्याक इन्जिनियरको काम गर्छु।",
                    "म यहीँका मानिसका लागि एप बनाउँछु: विद्यालयका लागि Gurukul, कानुनी जानकारीका लागि Vidhica, टिमका लागि SyncHQ र व्यापारीको भुक्तानीका लागि RakamHQ। तीमध्ये सजिलो मेरो मनको सबैभन्दा नजिक छ।",
                ],
            },
            {
                title: "मेरो बुबाको दिन",
                paras: [
                    "मेरो बुबा दैनिक बचत संकलक हुनुहुन्छ। हरेक बेलुका पसल-पसल हिँडेर थोरै-थोरै बचत उठाउनुहुन्छ, र हरेक रकम आफ्नो खातामा र ग्राहकको पासबुकमा लेख्नुहुन्छ। उहाँ NTC र Ncell रिचार्ज पनि बेच्नुहुन्छ, धेरैजसो उधारोमा।",
                    "हरेक राति झोलाको पैसा खातासँग मिल्नुपर्छ। नमिले अबेरसम्म आफ्नै लेखाइका पाना पल्टाइरहनुहुन्छ।",
                ],
            },
            {
                title: "किन बोलेर",
                paras: [
                    "एपहरू त धेरै छन्। तर तिनमा टाइप गर्नुपर्छ, साना बटन थिच्नुपर्छ, अंग्रेजी चाहिन्छ, नेटवर्क चाहिन्छ। एक हातमा पैसा र अर्को हातमा पासबुक लिएर काउन्टरमा उभिँदा यो सबै सम्भव हुँदैन।",
                    "तर उहाँ ग्राहकलाई रकम बोलेरै भन्नुहुन्छ। त्यसैले सजिलो सुन्छ, फेरि सुनाउँछ, र उहाँको \"हो\" पर्खन्छ।",
                ],
            },
            {
                title: "के समाधान हुन्छ",
                paras: [
                    "सबै कुरा दुई ठाउँ लेख्नु पर्दैन। घर पुग्नुअघि नै दिनको जम्मा तयार हुन्छ। \"हो\" नभनी केही सेभ हुँदैन, र गल्ती एक शब्दमै सच्चिन्छ। रिचार्ज र उधारो एउटै खातामा। नेटवर्क नभए पनि चलिरहन्छ।",
                ],
            },
            {
                title: "अब के",
                paras: [
                    "पहिले हरेक दिन बुबासँगै, जबसम्म उहाँ कापी बोक्न छोड्नुहुन्न। त्यसपछि उहाँकै सहरका अरू संकलक, रिचार्ज पसल, दूध संकलन र साना ऋण दिनेहरू।",
                    "लक्ष्य एउटै छ: नेपाल वा भारतमा हिँडेर पैसाको हिसाब राख्ने जो कोहीले बोले मात्र पुगोस्।",
                ],
            },
        ],
        contactKicker: "सम्पर्क",
        contactTitle: "नमस्ते भन्नुहोस्।",
        contactMuted: "प्रश्न, सुझाव, वा यो चलाउनुपर्ने कुनै संकलक चिन्नुहुन्छ भने लेख्नुहोस्।",
        email: "इमेल",
    },
}

const mai: LandingCopy = {
    nav: { story: "कथा", features: "की करैत अछि", day: "सजिलो संग एक दिन", who: "ककरा लेल", about: "हमरा बारे में", signIn: "लग इन", menu: "मेनु", home: "होम" },
    hero: {
        kicker: "बाजि क' हिसाब राखै वला मुंशी",
        title: "ओ बाजैत छथि।",
        accent: "सजिलो लिखैत अछि।",
        lead: "हमर बाबूजी नेपाल में दोकान-दोकान जा क' रोजक बचत उठबैत छथि। सजिलो में ओ हर हिसाब अपन भाषा में बाजैत छथि, आ सजिलो खाता राखैत अछि - नेटवर्क नहियो रहला पर।",
        watch: "कथा देखू",
        signIn: "लग इन",
    },
    story: {
        kicker: "कथा",
        title: "एकटा साँझ, एकटा खाता, एकटा पैसाक झोरा।",
        chapters: [
            {
                id: "walk",
                title: "साँझ ४ बजे",
                line: "दोकान-दोकान",
                heading: "साँझ ४ बजे।",
                muted: "बाबूजी कपड़ाक झोरा, लाल खाता आ कलम ल' क' निकलैत छथि। अन्हार होइ धरि एक पर एक दोकान, सब ठाम थोड़-थोड़ बचत।",
            },
            {
                id: "counter",
                title: "हर दोकान पर",
                line: "ठाढ़ भ' क', दू ठाम लिखब",
                heading: "पचास, सौ, पाँच सौ।",
                muted: "हर रकम दू ठाम लिखैत छथि - अपन खाता में आ ग्राहकक पासबुक में। ठाढ़े-ठाढ़, दोसर हाथ में पैसा ल' क'।",
            },
            {
                id: "night",
                title: "राति",
                line: "झोरा आ खाता नहि मिलल",
                heading: "जाहि राति झोरा नहि मिलल।",
                muted: "घर आबि क' झोराक पैसा खाता सँ मिलबैत छथि। कम भेल त' देर राति धरि अपने लिखल पढ़ैत रहैत छथि। एकटा लाइन छुटल माने ग्राहक नाराज, नहि त' अपन जेबी सँ भरब।",
            },
            {
                id: "says",
                title: "आब बाजैत छथि",
                line: "नाम, रकम, हँ",
                heading: "आब बस बाजब काफी अछि।",
                muted: "\"राम बहादुर, ५००।\" सजिलो नाम खोजैत अछि, फेर सुनबैत अछि, आ ओ \"हँ\" कहलाक बादे सेव करैत अछि - नेपाली, मैथिली वा हिन्दी में।",
            },
            {
                id: "closes",
                title: "हिसाब बन्द",
                line: "जोड़ पहिने सँ तैयार",
                heading: "दिनक हिसाब अपने बन्द भ' जाइत अछि।",
                muted: "घर पहुँचबा सँ पहिने जोड़ तैयार रहैत अछि। एक बेर झोरा गनि क' सजिलो के कहैत छथि; नहि मिलल त' कतेक फरक अछि से तुरन्त पता चलैत अछि।",
            },
        ],
    },
    features: {
        kicker: "की करैत अछि",
        title: "टेबुल लेल नहि, दोकानक काउन्टर लेल बनल।",
        muted: "दिन भरिक सब काज बाजि क', चाही त' एक टैप में।",
        items: [
            { title: "हुनकर भाषा बुझैत अछि", line: "नेपाली, मैथिली, हिन्दी वा मिला क'। नाम आ रकम जेना बाजैत छथि, तहिना।", chip: "नेपाली · मैथिली · हिन्दी" },
            { title: "नेटवर्क बिना चलैत अछि", line: "फोन सुनि क' फोने में सेव करैत अछि। नेटवर्क अएला पर अपने पठा दैत अछि।", chip: "अफलाइन · ३ बाँकी" },
            { title: "\"हँ\" बिना किछु सेव नहि", line: "हर हिसाब फेर सुनबैत अछि। मिलैत-जुलैत नाम, दोहराएल वा अजीब रकम पर पहिने पुछैत अछि।", chip: "राम बहादुर ५०० · हँ?" },
            { title: "गलती भेल? घुरा लिअ", line: "दस सेकेन्ड में अन्डू, वा \"गलती\" कहू - अन्तिम हिसाब हटि जाइत अछि।", chip: "अन्डू · १० सेकेन्ड" },
            { title: "रिचार्ज आ उधारो सेहो", line: "NTC आ Ncell लोड आ कार्ड, आ ककरा पर कतेक बाँकी अछि।", chip: "NTC · Ncell · उधारो" },
            { title: "बाजि क' जवाब दैत अछि", line: "एहि हप्ता के नहि देलक? हमरा लग कतेक पैसा हेबाक चाही? बाजि क' कहैत अछि।", chip: "हाथ में हेबाक चाही: रु ४,८५०" },
        ],
    },
    day: {
        kicker: "सजिलो संग एक दिन",
        title: "पहिल दोकान सँ अन्तिम गिनती धरि।",
        muted: "ओ की कहैत छथि, आ सजिलो की जवाब दैत अछि।",
        hint: "एकटा समय चुनू",
        steps: [
            { title: "निकलबा सँ पहिने", moment: "३:३०", text: "निकलबा सँ पहिने पुछैत छथि जे ककर बाँकी अछि। सजिलो नाम पढ़ि क' सुनबैत अछि।", say: "के नहि देलक?", reply: "मोहन, गीता स्टोर, लक्ष्मी देवी।" },
            { title: "काउन्टर पर", moment: "५:००", text: "एके साँस में दू दोकान। दू कार्ड, एके \"हँ\" सँ दुनू सेव।", say: "सीता देवी २००, मोहन १००", reply: "सीता देवी २००, मोहन १००। ठीक?" },
            { title: "उधारो", moment: "६:१५", text: "उधारो पर रिचार्ज। सेव सँ पहिने पुछैत अछि जे कोन नेटवर्क।", say: "रमेश, २०० लोड उधारो", reply: "NTC कि Ncell?" },
            { title: "नेटवर्क नहि", moment: "७:००", text: "गली में नेटवर्क नहि। तैयो फोन सुनैत अछि आ राखि लैत अछि।", say: "हरि प्रसाद, ३००", reply: "फोन में सेव भेल। नेट अएला पर पठाएत।" },
            { title: "घर घुरला पर", moment: "८:३०", text: "बाजि क' दिनक हिसाब बन्द करैत छथि आ झोरा में कतेक अछि से कहैत छथि।", say: "आजुक हिसाब बन्द करू", reply: "आइ रु ४,८५०। झोरा में कतेक अछि?" },
        ],
    },
    who: {
        kicker: "ककरा लेल",
        title: "पैदल पैसाक हिसाब राखै वला सब लेल।",
        muted: "पहिने हमर बाबूजी लेल बनल। बाजब, सुनब आ \"हँ\" कहब - यैह तरीका दोसरो लेल काज करत।",
        soon: "जल्दी",
        items: [
            { title: "रोजक बचत संकलक", say: "राम बहादुर, पाँच सौ।" },
            { title: "रिचार्ज दोकान", say: "रमेश, NTC १०० उधारो।" },
            { title: "दूध संकलन", say: "गोपाल, ५ लीटर।", soon: true },
            { title: "छोट कर्ज दै वला", say: "हरि २००० देलक।" },
        ],
    },
    cta: {
        title: "पहिने एकटा आदमी लेल बनल।",
        muted: "भीड़ वला काउन्टर पर हमर बाबूजीक काज आएल त', ठाढ़ भ' क' पैसाक हिसाब लिखै वला सबहक काज आएत।",
        signIn: "लग इन",
        about: "किया बनेलहुँ",
    },
    footer: { tagline: "बाजि क' हिसाब राखै वला मुंशी।", made: "नेपाल में बनल, हमर बाबूजी लेल।", contact: "सम्पर्क" },
    about: {
        kicker: "हमरा बारे में",
        title: "हम सजिलो किया बना रहल छी।",
        lead: "एहि एपक कथा: हम के छी, हमर बाबूजीक दिन केहन होइत छनि, आ सजिलो आब कतए जा रहल अछि।",
        chapters: [
            {
                title: "हम के छी",
                paras: [
                    "हम Niraj Jha, नेपालक सफ्टवेयर इन्जिनियर। लभली प्रोफेसनल युनिभर्सिटी सँ बी.टेक केलहुँ आ एखन Creatr में फुल स्ट्याक इन्जिनियर छी।",
                    "हम एतुका लोक लेल एप बनबैत छी: स्कूल लेल Gurukul, कानूनी जानकारी लेल Vidhica, टीम लेल SyncHQ आ व्यापारीक भुक्तानी लेल RakamHQ। ओहि में सजिलो हमर मोनक सबसँ लग अछि।",
                ],
            },
            {
                title: "हमर बाबूजीक दिन",
                paras: [
                    "हमर बाबूजी रोजक बचत संकलक छथि। हर साँझ दोकान-दोकान पैदल जा क' थोड़-थोड़ बचत उठबैत छथि, आ हर रकम अपन खाता आ ग्राहकक पासबुक में लिखैत छथि। ओ NTC आ Ncell रिचार्ज सेहो बेचैत छथि, बेसी उधारो पर।",
                    "हर राति झोराक पैसा खाता सँ मिलबाक चाही। नहि मिलल त' देर राति धरि अपने लिखल पन्ना उनटबैत रहैत छथि।",
                ],
            },
            {
                title: "बाजि क' किया",
                paras: [
                    "एप त' बहुत अछि। मुदा ओहि में टाइप करए पड़ैत अछि, छोट बटन दबाबए पड़ैत अछि, अंग्रेजी चाही, नेटवर्क चाही। एक हाथ में पैसा आ दोसर में पासबुक ल' क' काउन्टर पर ठाढ़ रहला पर ई सब नहि भ' पबैत अछि।",
                    "मुदा ओ ग्राहक के रकम बाजिए क' कहैत छथि। तें सजिलो सुनैत अछि, फेर सुनबैत अछि, आ हुनकर \"हँ\" क बाट तकैत अछि।",
                ],
            },
            {
                title: "की समाधान होइत अछि",
                paras: [
                    "सब किछु दू ठाम लिखबाक जरूरत नहि। घर पहुँचबा सँ पहिने दिनक जोड़ तैयार। \"हँ\" बिना किछु सेव नहि, आ गलती एके शब्द में सुधरि जाइत अछि। रिचार्ज आ उधारो एके खाता में। नेटवर्क नहियो रहला पर चलैत रहैत अछि।",
                ],
            },
            {
                title: "आब की",
                paras: [
                    "पहिने रोज बाबूजी संग, जा धरि ओ कापी राखब नहि छोड़ि दैत छथि। तकर बाद हुनके शहरक आन संकलक, रिचार्ज दोकान, दूध संकलन आ छोट कर्ज दै वला।",
                    "लक्ष्य एके अछि: नेपाल वा भारत में पैदल पैसाक हिसाब राखै वला केओ बस बाजय, आ काज भ' जाय।",
                ],
            },
        ],
        contactKicker: "सम्पर्क",
        contactTitle: "प्रणाम कहू।",
        contactMuted: "प्रश्न, सुझाव, वा कोनो संकलक चिन्हैत छी जे एकरा चलाबथि त' लिखू।",
        email: "इमेल",
    },
}

export const LANDING: Record<Lang, LandingCopy> = { en, ne, mai }

export const CONTACT = {
    email: "jhaniraj45@gmail.com",
    linkedin: "https://linkedin.com/in/nirajjha31",
    github: "https://github.com/jha-niraj",
} as const
