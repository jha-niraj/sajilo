import type { Lang } from "@/lib/dict"

/*
 * Words for the public pages (/ and /about), in the three app languages. Kept apart from lib/dict.ts because they are
 * long-form story copy, not UI labels; the shape is typed so a language can never miss a line.
 * Maithili is written in English letters, like lib/dict-mai.ts.
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
        muted: string
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
        title: "One day, one ledger, one bag of cash.",
        chapters: [
            {
                id: "walk",
                title: "Six in the morning",
                line: "The round starts",
                heading: "Six in the morning.",
                muted: "My father leaves with a cloth bag, a red ledger and a pen. Dozens of shops before dark, a small deposit at each.",
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
            { title: "Morning", moment: "7:00", text: "Before the round he asks who is behind. Sajilo reads out the names.", say: "Kasle tireko chhaina?", reply: "Mohan, Gita Store, Laxmi Devi." },
            { title: "At the counter", moment: "10:30", text: "Two shops in one breath. Two cards, one haan saves both.", say: "Sita Devi 200, Mohan 100", reply: "Sita Devi 200, Mohan 100. Thik?" },
            { title: "Udharo", moment: "1:15", text: "Recharge on credit. Sajilo asks which network before it saves.", say: "Ramesh, 200 load udharo", reply: "NTC ki Ncell?" },
            { title: "No signal", moment: "3:40", text: "In the gully there is no network. The phone still hears him and keeps it.", say: "Hari Prasad, 300", reply: "Saved on the phone. Sends when online." },
            { title: "Evening", moment: "7:30", text: "He closes the day by voice and tells it what he counted.", say: "Aajako hisab band gara", reply: "Rs 4,850 today. How much is in the bag?" },
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
        muted: "A son, a ledger and a phone.",
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
                    "My father is a daily savings collector. Every day he walks from shop to shop, takes small deposits and writes each one in his ledger and in the customer's passbook. He also sells NTC and Ncell recharge, often on credit.",
                    "Every evening the cash in his bag has to match the book. When it doesn't, he goes back through pages of his own handwriting, late into the night.",
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
    nav: { story: "कथा", features: "के गर्छ", day: "सजिलोसँग एक दिन", who: "कसका लागि", about: "हाम्रो बारे", signIn: "लग इन", menu: "मेनु", home: "गृहपृष्ठ" },
    hero: {
        kicker: "बोलेर चलाउने मुन्सी",
        title: "उहाँ भन्नुहुन्छ।",
        accent: "सजिलो लेख्छ।",
        lead: "मेरो बुबा नेपालमा पसल-पसल गएर दैनिक बचत उठाउनुहुन्छ। सजिलोमा उहाँ हरेक हिसाब आफ्नै भाषामा बोलेर भन्नुहुन्छ, र सजिलोले खाता राखिदिन्छ - सिग्नल नहुँदा पनि।",
        watch: "कथा हेर्नुहोस्",
        signIn: "लग इन",
    },
    story: {
        kicker: "कथा",
        title: "एक दिन, एउटा खाता, एउटा पैसाको झोला।",
        chapters: [
            {
                id: "walk",
                title: "बिहान ६ बजे",
                line: "दिनको सुरु",
                heading: "बिहान ६ बजे।",
                muted: "मेरो बुबा कपडाको झोला, रातो खाता र कलम लिएर निस्कनुहुन्छ। साँझसम्म दर्जनौँ पसल, हरेकमा थोरै बचत।",
            },
            {
                id: "counter",
                title: "हरेक काउन्टर",
                line: "उभिएरै, दुई ठाउँमा लेख्ने",
                heading: "पचास, सय, पाँच सय।",
                muted: "हरेक रकम दुई ठाउँमा लेख्नुहुन्छ - आफ्नो खातामा र ग्राहकको पासबुकमा - काउन्टरमा उभिएर, अर्को हातमा पैसा समातेर।",
            },
            {
                id: "night",
                title: "राति",
                line: "झोला र खाता नमिल्दा",
                heading: "झोला र खाता नमिलेको रात।",
                muted: "घर पुगेर झोलाको पैसा खातासँग मिलाउनुहुन्छ। कम भयो भने राति अबेरसम्म आफ्नै हस्ताक्षर पढ्नुहुन्छ। एउटा छुटेको लाइन भनेको रिसाएको ग्राहक, वा आफ्नै खल्तीको पैसा।",
            },
            {
                id: "says",
                title: "अब बोल्नुहुन्छ",
                line: "नाम, रकम, हजुर",
                heading: "अब उहाँ बोल्नु मात्र हुन्छ।",
                muted: "\"राम बहादुर, ५००।\" सजिलोले नाम खोज्छ, दोहोर्‍याएर भन्छ, र उहाँले \"हो\" भनेपछि मात्र सेभ गर्छ - नेपाली, मैथिली वा हिन्दीमा।",
            },
            {
                id: "closes",
                title: "दिन बन्द",
                line: "जम्मा पहिल्यै तयार",
                heading: "दिन आफैँ बन्द हुन्छ।",
                muted: "घर पुग्नुअघि नै जम्मा तयार हुन्छ। झोला एकपटक गनेर सजिलोलाई भन्नुहुन्छ; नमिले कति फरक छ भन्ने तुरुन्तै थाहा हुन्छ।",
            },
        ],
    },
    features: {
        kicker: "के गर्छ",
        title: "टेबलका लागि होइन, काउन्टरका लागि बनेको।",
        muted: "दिनभरिको सबै काम बोलेर, चाहेमा एक ट्यापमा।",
        items: [
            { title: "उहाँकै भाषा बुझ्छ", line: "नेपाली, मैथिली, हिन्दी वा मिसाएर। नाम र रकम जसरी भन्नुहुन्छ त्यसरी नै।", chip: "नेपाली · मैथिली · हिन्दी" },
            { title: "सिग्नल नहुँदा पनि चल्छ", line: "फोनले नै सुनेर फोनमै सेभ गर्छ। नेटवर्क आएपछि सिंक हुन्छ।", chip: "अफलाइन · ३ बाँकी" },
            { title: "\"हो\" नभनी केही सेभ हुँदैन", line: "हरेक हिसाब दोहोर्‍याएर सुनाउँछ। मिल्दोजुल्दो नाम, दोहोरिएको र अनौठो रकममा पहिले सोध्छ।", chip: "राम बहादुर ५०० · हो?" },
            { title: "गल्ती? फिर्ता लिनुहोस्", line: "दस सेकेन्डमा अन्डू, वा \"गल्ती\" भने पछिल्लो हिसाब हट्छ।", chip: "अन्डू · १० सेकेन्ड" },
            { title: "रिचार्ज र उधारो पनि", line: "NTC र Ncell लोड र कार्ड, र कसले कति तिर्न बाँकी।", chip: "NTC · Ncell · उधारो" },
            { title: "बोलेर जवाफ दिन्छ", line: "यो हप्ता कसले तिरेन? मसँग कति पैसा हुनुपर्छ? बोलेरै भन्छ।", chip: "हातमा हुनुपर्ने: रु ४,८५०" },
        ],
    },
    day: {
        kicker: "सजिलोसँग एक दिन",
        title: "पहिलो पसलदेखि अन्तिम गन्तीसम्म।",
        muted: "उहाँ के भन्नुहुन्छ, सजिलो के जवाफ दिन्छ।",
        hint: "एउटा समय छान्नुहोस्",
        steps: [
            { title: "बिहान", moment: "७:००", text: "हिँड्नुअघि कसको बाँकी छ भनेर सोध्नुहुन्छ। सजिलोले नाम पढेर सुनाउँछ।", say: "कसले तिरेको छैन?", reply: "मोहन, गीता स्टोर, लक्ष्मी देवी।" },
            { title: "काउन्टरमा", moment: "१०:३०", text: "एकै सासमा दुई पसल। दुई कार्ड, एउटै \"हो\" ले दुवै सेभ।", say: "सीता देवी २००, मोहन १००", reply: "सीता देवी २००, मोहन १००। ठीक?" },
            { title: "उधारो", moment: "१:१५", text: "उधारोमा रिचार्ज। सेभ गर्नुअघि कुन नेटवर्क भनेर सोध्छ।", say: "रमेश, २०० लोड उधारो", reply: "NTC कि Ncell?" },
            { title: "सिग्नल छैन", moment: "३:४०", text: "गल्लीमा नेटवर्क छैन। फोनले अझै सुन्छ र राख्छ।", say: "हरि प्रसाद, ३००", reply: "फोनमा सेभ भयो। अनलाइन भएपछि पठाउँछ।" },
            { title: "साँझ", moment: "७:३०", text: "बोलेरै दिन बन्द गर्नुहुन्छ र गनेको रकम भन्नुहुन्छ।", say: "आजको हिसाब बन्द गर", reply: "आज रु ४,८५०। झोलामा कति छ?" },
        ],
    },
    who: {
        kicker: "कसका लागि",
        title: "हिँडेरै पैसाको हिसाब राख्ने सबैका लागि।",
        muted: "पहिले मेरो बुबाका लागि बनेको। बोल्ने, सुन्ने, \"हो\" भन्ने तरिका उहाँहरूलाई पनि मिल्छ।",
        soon: "आउँदै",
        items: [
            { title: "दैनिक बचत संकलक", say: "राम बहादुर, पाँच सय।" },
            { title: "रिचार्ज पसल", say: "रमेश, NTC १०० उधारो।" },
            { title: "दूध संकलन", say: "गोपाल, ५ लिटर।", soon: true },
            { title: "साना ऋणदाता", say: "हरिले २००० तिर्‍यो।" },
        ],
    },
    cta: {
        title: "पहिले एक जनाका लागि बनेको।",
        muted: "भीडको काउन्टरमा मेरो बुबालाई काम लाग्यो भने, उभिएर पैसा लेख्ने जोसुकैलाई काम लाग्छ।",
        signIn: "लग इन",
        about: "किन बनाएँ",
    },
    footer: { tagline: "बोलेर चलाउने मुन्सी।", made: "नेपालमा बनेको, मेरो बुबाका लागि।", contact: "सम्पर्क" },
    about: {
        kicker: "हाम्रो बारे",
        title: "म सजिलो किन बनाउँदैछु।",
        muted: "एउटा छोरा, एउटा खाता र एउटा फोन।",
        lead: "यो एपपछाडिको कथा हो: म को हुँ, मेरो बुबाले हरेक दिन के भोग्नुहुन्छ, र सजिलो अब कता जान्छ।",
        chapters: [
            {
                title: "म को हुँ",
                paras: [
                    "म Niraj Jha, नेपालको सफ्टवेयर इन्जिनियर। लभली प्रोफेसनल युनिभर्सिटीमा बी.टेक पढें र Creatr मा फुल स्ट्याक इन्जिनियरको रूपमा काम गर्छु।",
                    "म यस क्षेत्रका लागि प्रोडक्ट बनाउँछु: विद्यालयका लागि Gurukul, कानुनी खोजका लागि Vidhica, टिमका लागि SyncHQ र व्यापारीको भुक्तानीका लागि RakamHQ। तीमध्ये सजिलो सबैभन्दा आफ्नो हो।",
                ],
            },
            {
                title: "मेरो बुबाको दिन",
                paras: [
                    "मेरो बुबा दैनिक बचत संकलक हुनुहुन्छ। हरेक दिन पसल-पसल हिँडेर थोरै-थोरै बचत उठाउनुहुन्छ र हरेक रकम आफ्नो खातामा र ग्राहकको पासबुकमा लेख्नुहुन्छ। उहाँ NTC र Ncell रिचार्ज पनि बेच्नुहुन्छ, धेरैजसो उधारोमा।",
                    "हरेक साँझ झोलाको पैसा खातासँग मिल्नुपर्छ। नमिले राति अबेरसम्म आफ्नै हस्ताक्षरका पानाहरू पल्टाउनुहुन्छ।",
                ],
            },
            {
                title: "किन आवाज",
                paras: [
                    "एपहरू पहिल्यै छन्। तिनलाई टाइप, साना बटन, अंग्रेजी र राम्रो नेटवर्क चाहिन्छ। एक हातमा पैसा र अर्कोमा पासबुक बोकेर काउन्टरमा उभिँदा उहाँसँग त्यो केही हुँदैन।",
                    "तर उहाँ ग्राहकलाई रकम बोलेरै भन्नुहुन्छ। त्यसैले सजिलो सुन्छ, दोहोर्‍याउँछ, र उहाँको \"हो\" पर्खन्छ।",
                ],
            },
            {
                title: "के समाधान हुन्छ",
                paras: [
                    "सबै कुरा दुई ठाउँ लेख्नु पर्दैन। घर पुग्नुअघि नै दिनको जम्मा तयार। \"हो\" नभनी केही सेभ हुँदैन, र हरेक गल्ती एक शब्दमै फिर्ता। रिचार्ज र उधारो एउटै खातामा। र सिग्नल नहुँदा पनि चलिरहन्छ।",
                ],
            },
            {
                title: "अब के",
                paras: [
                    "पहिले हरेक दिन बुबासँगै, जबसम्म उहाँ कापी बोक्न छोड्नुहुन्न। त्यसपछि उहाँकै सहरका अरू संकलक, रिचार्ज पसल, दूध संकलन र साना ऋणदाता।",
                    "लक्ष्य सजिलो छ: नेपाल वा भारतमा हिँडेर पैसाको हिसाब राख्ने जो कोहीले बोल्दा मात्र पुगोस्।",
                ],
            },
        ],
        contactKicker: "सम्पर्क",
        contactTitle: "नमस्ते भन्नुहोस्।",
        contactMuted: "प्रश्न, सुझाव, वा प्रयोग गर्नुपर्ने कुनै संकलक चिन्नुहुन्छ भने।",
        email: "इमेल",
    },
}

const mai: LandingCopy = {
    nav: { story: "Katha", features: "Ki karait achhi", day: "Sajilo sang ek din", who: "Kakra lel", about: "Hamra baare", signIn: "Log in", menu: "Menu", home: "Ghar" },
    hero: {
        kicker: "Bajait jau, munshi likhat",
        title: "Ohi bajait chhathi.",
        accent: "Sajilo likhait achhi.",
        lead: "Hamar babuji Nepal me dokan-dokan ja ke rojka bachat uthabait chhathi. Sajilo me ohi har hisab apan bhasha me bajait chhathi, aa Sajilo khata rakhait achhi - signal nai rahlo par.",
        watch: "Katha dekhu",
        signIn: "Log in",
    },
    story: {
        kicker: "Katha",
        title: "Ek din, ek khata, ek jhola paisa.",
        chapters: [
            {
                id: "walk",
                title: "Bhor 6 baje",
                line: "Din shuru",
                heading: "Bhor 6 baje.",
                muted: "Hamar babuji kapda ke jhola, laal khata aa kalam la ke niklait chhathi. Saanjh dhari darjano dokan, sab me thor-thor bachat.",
            },
            {
                id: "counter",
                title: "Har counter",
                line: "Thadh bha ke, du thaam likhab",
                heading: "Pachas, sau, paanch sau.",
                muted: "Har rakam du thaam likhait chhathi - apan khata me aa grahak ke passbook me - counter par thadh bha ke, dosar haath me paisa rakhne.",
            },
            {
                id: "night",
                title: "Raati",
                line: "Jhola aa khata nai milal",
                heading: "Je raati jhola nai milal.",
                muted: "Ghar aabi ke jhola ke paisa khata sang milabait chhathi. Kam bhel ta raati der dhari apan likhal padhait chhathi. Ek chhutal line maane naraj grahak, ba apan jeb ke paisa.",
            },
            {
                id: "says",
                title: "Aab bajait chhathi",
                line: "Naam, rakam, haan",
                heading: "Aab ohi bas bajait chhathi.",
                muted: "\"Ram Bahadur, 500.\" Sajilo naam khojait achhi, fer sa sunabait achhi, aa ohi \"haan\" kahlak baad tahi save karait achhi - Nepali, Maithili ba Hindi me.",
            },
            {
                id: "closes",
                title: "Din band",
                line: "Jod pahine sa taiyar",
                heading: "Din apne band bha jaait achhi.",
                muted: "Ghar pahunchai sa pahine jod taiyar rahait achhi. Ek ber jhola gani ke Sajilo ke kahait chhathi; nai milal ta katek farak achhi se turante pata chalait achhi.",
            },
        ],
    },
    features: {
        kicker: "Ki karait achhi",
        title: "Table lel nai, counter lel banal.",
        muted: "Dinbhar ke sab kaaj bajait, chahi ta ek tap me.",
        items: [
            { title: "Hunak bhasha bujhait achhi", line: "Nepali, Maithili, Hindi ba milaa ke. Naam aa rakam jena bajait chhathi tahina.", chip: "Nepali · Maithili · Hindi" },
            { title: "Signal bina chalait achhi", line: "Phone sun ke phone me save karait achhi. Network aabai par sync hoait achhi.", chip: "Offline · 3 baaki" },
            { title: "Haan bina kichhu save nai", line: "Har hisab fer sa sunabait achhi. Milait-julait naam, dohraayal aa ajeeb rakam par pahine puchhait achhi.", chip: "Ram Bahadur 500 · haan?" },
            { title: "Galti? Ghuraa lu", line: "Das second me undo, ba \"galti\" kahu ta antim hisab hatait achhi.", chip: "Undo · 10 second" },
            { title: "Recharge aa udharo seho", line: "NTC aa Ncell load aa card, aa ke kakra katek baaki.", chip: "NTC · Ncell · udharo" },
            { title: "Bajait ke jawab dait achhi", line: "E hafta ke nai deliak? Hamra lag katek paisa hebak chahi? Bajait ke kahait achhi.", chip: "Haath me hebak chahi: Rs 4,850" },
        ],
    },
    day: {
        kicker: "Sajilo sang ek din",
        title: "Pahil dokan sa antim gintii dhari.",
        muted: "Ohi ki kahait chhathi, aa Sajilo ki jawab dait achhi.",
        hint: "Ek samay chunu",
        steps: [
            { title: "Bhor", moment: "7:00", text: "Nikalai sa pahine puchhait chhathi ke baaki achhi. Sajilo naam padhi ke sunabait achhi.", say: "Ke nai deliak?", reply: "Mohan, Gita Store, Laxmi Devi." },
            { title: "Counter par", moment: "10:30", text: "Ekhi saans me du dokan. Du card, ek haan sa dunu save.", say: "Sita Devi 200, Mohan 100", reply: "Sita Devi 200, Mohan 100. Thik?" },
            { title: "Udharo", moment: "1:15", text: "Udharo me recharge. Save sa pahine kon network puchhait achhi.", say: "Ramesh, 200 load udharo", reply: "NTC ki Ncell?" },
            { title: "Signal nai", moment: "3:40", text: "Galli me network nai. Phone tai-o sunait achhi aa rakhait achhi.", say: "Hari Prasad, 300", reply: "Phone me save bhel. Online bhela par pathaayat." },
            { title: "Saanjh", moment: "7:30", text: "Bajait ke din band karait chhathi aa ginal rakam kahait chhathi.", say: "Aaju ke hisab band karu", reply: "Aaju Rs 4,850. Jhola me katek achhi?" },
        ],
    },
    who: {
        kicker: "Kakra lel",
        title: "Paidal paisa ke hisab rakhai waala sab lel.",
        muted: "Pahine hamar babuji lel banal. Bajab, sunab, haan kahab - hunko sab lel kaaj karat.",
        soon: "Aabi rahal",
        items: [
            { title: "Rojka bachat sangrahak", say: "Ram Bahadur, paanch sau." },
            { title: "Recharge dokan", say: "Ramesh, NTC 100 udharo." },
            { title: "Doodh sangrah", say: "Gopal, 5 litre.", soon: true },
            { title: "Chhota karj dai waala", say: "Hari 2000 deliak." },
        ],
    },
    cta: {
        title: "Pahine ek aadmi lel banal.",
        muted: "Bheed waala counter par hamar babuji ke kaaj aail ta, thadh bha ke paisa likhai waala sab ke kaaj aayat.",
        signIn: "Log in",
        about: "Kiyak banelau",
    },
    footer: { tagline: "Bajait jau, munshi likhat.", made: "Nepal me banal, hamar babuji lel.", contact: "Samparka" },
    about: {
        kicker: "Hamra baare",
        title: "Hum Sajilo kiyak bana rahal chhi.",
        muted: "Ek beta, ek khata aa ek phone.",
        lead: "E app ke paachhan ke katha: hum ke chhi, hamar babuji ke roj ki jhelai padait chhanhi, aa Sajilo aab kathi jaayat.",
        chapters: [
            {
                title: "Hum ke chhi",
                paras: [
                    "Hum Niraj Jha, Nepal ke software engineer. Lovely Professional University me B.Tech padhlau aa Creatr me full stack engineer chhi.",
                    "Hum e ilaaka lel product banabait chhi: school lel Gurukul, kanooni khoj lel Vidhica, team lel SyncHQ aa vyapari ke bhugtan lel RakamHQ. Sajilo sab sa apan achhi.",
                ],
            },
            {
                title: "Hamar babuji ke din",
                paras: [
                    "Hamar babuji rojka bachat sangrahak chhathi. Roj dokan-dokan paidal ja ke thor-thor bachat lait chhathi aa har rakam apan khata aa grahak ke passbook me likhait chhathi. Ohi NTC aa Ncell recharge seho bechait chhathi, besi udharo me.",
                    "Har saanjh jhola ke paisa khata sang milbaak chahi. Nai milal ta raati der dhari apan likhal panna ulatait chhathi.",
                ],
            },
            {
                title: "Aawaaj kiyak",
                paras: [
                    "App pahine sa achhi. Okra type, chhota button, English aa nik network chahi. Ek haath me paisa aa dosar me passbook la ke counter par thadh rahla par hunka lag e sab nai rahait chhanhi.",
                    "Muda ohi grahak ke rakam bajait ke kahait chhathi. Taahi lel Sajilo sunait achhi, fer sa kahait achhi, aa hunak \"haan\" ke baat takait achhi.",
                ],
            },
            {
                title: "Ki samadhan hoait achhi",
                paras: [
                    "Sab kichhu du thaam likhab nai. Ghar pahunchai sa pahine din ke jod taiyar. Haan bina kichhu save nai, aa har galti ek shabd me ghuraa. Recharge aa udharo ekhi khata me. Aa signal nai rahlo par chalait rahait achhi.",
                ],
            },
            {
                title: "Aab ki",
                paras: [
                    "Pahine roj babuji sang, jabdhari ohi copy laaib chhodi nai dait chhathi. Okar baad hunke shahar ke aan sangrahak, recharge dokan, doodh sangrah aa chhota karj dai waala.",
                    "Lakshya sojh achhi: Nepal ba Bharat me paidal paisa ke hisab rakhai waala keo bas bajait aa kaaj bha jaai.",
                ],
            },
        ],
        contactKicker: "Samparka",
        contactTitle: "Pranaam kahu.",
        contactMuted: "Prashn, vichar, ba koi sangrahak chinhait chhi je e prayog karathi.",
        email: "Email",
    },
}

export const LANDING: Record<Lang, LandingCopy> = { en, ne, mai }

export const CONTACT = {
    email: "jhaniraj45@gmail.com",
    linkedin: "https://linkedin.com/in/nirajjha31",
    github: "https://github.com/jha-niraj",
} as const
