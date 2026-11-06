export type ReplyLanguage = "ne" | "ne-roman" | "en"

// Common Nepali words as typed in English letters. Grammar words (lai, le, ko, cha) carry most of it;
// the rest are the bookkeeping verbs and nouns he uses with Munshi.
const NEPALI_ROMAN = new Set(
    (
        "cha chha chaina chhaina ho haina hoina thiyo thyo bhayo bhaena bhako bhaeko garnu garnus garnuhos gara garde gardinu " +
        "gareko garyo diyo dinu dinus deu dey diye diyeko liyo linu linus lyau tiryo tirnu tireko tirena tiryena tirne " +
        "paisa rupaiya rupiya kati kasle kasko kaslai kun kunai ke kina kaha kahile kasari kasto aaja aja ajako hijo bholi parsi " +
        "lai le ko ka ki ma maa bata dekhi samma pani ni ra ani tara ya hai hajur dai bhai didi baini sahuji sathi mero hamro tapai timi " +
        "thapa thapnu thapdinu thapne naya nayaa purano baki baaki bakee rin rinn sapati byaj byaaj sawa saba sabai sab dherai thorai " +
        "aru arko pasal bandh banda chhuttyau hisab hisaab mahina mahinako din dinko patak jamma jamma kul ghatau ghataunu " +
        "hataunu hatau metau metaunu sachyau milau sodh bhana bhannu herna hera dekhau dekhaunu chahiyo chahincha parchha parcha " +
        "aayo aaeko gayo gaeko basyo rakh rakha rakhnu rakhdinu hunchha huncha hos hola holaa"
    ).split(/\s+/),
)

/** Which language and script to answer in, decided in code: models drift toward one language otherwise. */
export function replyLanguage(text: string): ReplyLanguage {
    if (/[ऀ-ॿ]/.test(text)) return "ne"
    const words = text.toLowerCase().match(/[a-z]+/g) ?? []
    const hits = words.filter((w) => NEPALI_ROMAN.has(w)).length
    // One hit in a short message ("mohan lai thapa") is enough; longer English sentences need more.
    return hits >= 2 || (hits === 1 && words.length <= 4) ? "ne-roman" : "en"
}

export function replyLanguageRule(lang: ReplyLanguage, voice: boolean): string {
    if (lang === "en") return "\n\nREPLY LANGUAGE FOR THIS MESSAGE: English. Do not reply in Nepali."
    // Spoken replies go through a voice that reads Devanagari only.
    if (lang === "ne" || voice) return "\n\nREPLY LANGUAGE FOR THIS MESSAGE: Nepali (Devanagari)."
    return (
        "\n\nREPLY LANGUAGE FOR THIS MESSAGE: Nepali written in English letters (Roman Nepali), the way he typed it, " +
        'e.g. "Ram Kirana ko aaja Rs 200 tireko mark garne tayari gare. Save garum?" ' +
        "No Devanagari and no English sentences. Names and amounts stay as they are."
    )
}
