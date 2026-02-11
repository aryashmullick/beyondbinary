"""
Sentence Analyzer - NLP-powered sentence parsing and POS tagging.
Uses NLTK for contextual sentence-level analysis rather than simple word lookups.
"""

import re
from dataclasses import dataclass, field

import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.tag import pos_tag

# ─── NLTK data bootstrap ───────────────────────────────────────────────────────
_NLTK_READY = False


def ensure_nltk_data() -> None:
    """Download required NLTK data packages (idempotent)."""
    global _NLTK_READY
    if _NLTK_READY:
        return
    for pkg in ("punkt_tab", "averaged_perceptron_tagger_eng", "universal_tagset"):
        try:
            nltk.data.find(f"taggers/{pkg}" if "tagger" in pkg else f"tokenizers/{pkg}" if "punkt" in pkg else f"taggers/{pkg}")
        except LookupError:
            nltk.download(pkg, quiet=True)
    _NLTK_READY = True


# Map Penn Treebank POS tags to our simplified categories
POS_CATEGORY_MAP = {
    # Nouns
    "NN": "noun", "NNS": "noun",
    "NNP": "proper_noun", "NNPS": "proper_noun",
    # Verbs
    "VB": "verb", "VBD": "verb", "VBG": "verb",
    "VBN": "verb", "VBP": "verb", "VBZ": "verb",
    # Adjectives
    "JJ": "adjective", "JJR": "adjective", "JJS": "adjective",
    # Adverbs
    "RB": "adverb", "RBR": "adverb", "RBS": "adverb",
    # Function words
    "IN": "preposition",       # preposition / subordinating conjunction
    "CC": "conjunction",       # coordinating conjunction
    "DT": "determiner", "PDT": "determiner", "WDT": "determiner",
    "PRP": "pronoun", "PRP$": "pronoun",
    "WP": "pronoun", "WP$": "pronoun",
    # Auxiliaries (tagged as verbs by NLTK but we detect separately)
    "MD": "auxiliary",
    # Other
    "CD": "number",
    "RP": "particle",
    "UH": "interjection",
    "TO": "particle",
    "EX": "pronoun",           # existential 'there'
    "FW": "other",
    "SYM": "symbol",
    ",": "punctuation", ".": "punctuation", ":": "punctuation",
    "``": "punctuation", "''": "punctuation",
    "-LRB-": "punctuation", "-RRB-": "punctuation",
    "#": "symbol", "$": "symbol",
    "LS": "other", "POS": "punctuation",
}

# Auxiliary verbs – if a VB* token is one of these, override to "auxiliary"
_AUXILIARY_VERBS = {
    "be", "is", "am", "are", "was", "were", "been", "being",
    "have", "has", "had", "having",
    "do", "does", "did",
    "will", "would", "shall", "should", "may", "might",
    "can", "could", "must", "need", "dare", "ought",
}


@dataclass
class TokenInfo:
    """Analyzed token with contextual information."""
    text: str
    pos: str               # Simplified POS category
    fine_pos: str           # Fine-grained POS tag (Penn Treebank)
    lemma: str              # Base form (simple stemming)
    is_stop: bool           # Is a stop/function word
    dep: str                # Approximate dependency relation
    head_text: str          # Approximate head word
    is_entity: bool         # Part of named entity (proper noun heuristic)
    entity_type: str        # Entity type if applicable
    syllable_count: int     # Estimated syllable count
    word_frequency: str     # high/medium/low frequency tier
    sentence_role: str      # subject/object/predicate/modifier/other
    idx: int                # Character offset in original text
    whitespace: str         # Trailing whitespace

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "pos": self.pos,
            "fine_pos": self.fine_pos,
            "lemma": self.lemma,
            "is_stop": self.is_stop,
            "dep": self.dep,
            "head_text": self.head_text,
            "is_entity": self.is_entity,
            "entity_type": self.entity_type,
            "syllable_count": self.syllable_count,
            "word_frequency": self.word_frequency,
            "sentence_role": self.sentence_role,
            "idx": self.idx,
            "whitespace": self.whitespace,
        }


@dataclass
class SentenceInfo:
    """Analyzed sentence with all token information."""
    text: str
    tokens: list[TokenInfo] = field(default_factory=list)
    complexity: str = "simple"  # simple/compound/complex

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "tokens": [t.to_dict() for t in self.tokens],
            "complexity": self.complexity,
        }


def _estimate_syllables(word: str) -> int:
    """Estimate syllable count using vowel-group heuristic."""
    word = word.lower().strip()
    if not word:
        return 0
    if len(word) <= 2:
        return 1

    vowels = "aeiouy"
    count = 0
    prev_vowel = False

    for char in word:
        is_vowel = char in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel

    # Adjust for silent e
    if word.endswith("e") and count > 1:
        count -= 1
    # Adjust for -le ending
    if word.endswith("le") and len(word) > 2 and word[-3] not in vowels:
        count += 1

    return max(1, count)


# Common high-frequency words (function words + very common content words)
HIGH_FREQ_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must", "dare",
    "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "into", "through", "during", "before", "after", "above", "below",
    "between", "under", "over", "about", "against", "out", "up", "down",
    "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more", "most",
    "other", "some", "such", "no", "only", "own", "same", "than",
    "too", "very", "just", "also", "now", "then", "here", "there",
    "when", "where", "why", "how", "what", "which", "who", "whom",
    "this", "that", "these", "those", "i", "me", "my", "we", "us",
    "you", "your", "he", "him", "his", "she", "her", "it", "its",
    "they", "them", "their", "get", "got", "go", "went", "gone",
    "come", "came", "make", "made", "take", "took", "know", "knew",
    "think", "thought", "see", "saw", "say", "said", "tell", "told",
    "give", "gave", "find", "found", "want", "like", "look", "use",
    "work", "call", "try", "ask", "put", "keep", "let", "begin",
    "seem", "help", "show", "hear", "play", "run", "move", "live",
    "believe", "bring", "happen", "write", "provide", "sit", "stand",
    "lose", "pay", "meet", "include", "continue", "set", "learn",
    "change", "lead", "understand", "watch", "follow", "stop", "create",
    "speak", "read", "allow", "add", "spend", "grow", "open", "walk",
    "win", "offer", "remember", "love", "consider", "appear", "buy",
    "wait", "serve", "die", "send", "expect", "build", "stay", "fall",
    "cut", "reach", "kill", "remain", "people", "time", "way", "day",
    "man", "woman", "child", "world", "life", "hand", "part", "place",
    "case", "week", "company", "system", "program", "question", "work",
    "number", "night", "point", "home", "water", "room", "mother",
    "area", "money", "story", "fact", "month", "lot", "right", "study",
    "book", "eye", "job", "word", "business", "issue", "side", "kind",
    "head", "house", "service", "friend", "father", "power", "hour",
    "game", "line", "end", "member", "law", "car", "city", "community",
    "name", "thing", "good", "new", "first", "last", "long", "great",
    "little", "own", "old", "big", "high", "small", "large", "next",
    "early", "young", "important", "public", "bad", "real",
}

# Stop / function words — used for is_stop field
_STOP_WORDS = (
    HIGH_FREQ_WORDS
    | {"ourselves", "hers", "yourself", "himself", "herself", "itself", "themselves",
       "myself", "yours", "theirs", "ours", "am", "been", "doing", "because", "until",
       "while", "if", "once", "again", "further", "then", "than", "other", "own",
       "same", "so", "too", "very", "just", "don", "didn", "doesn", "hadn", "hasn",
       "haven", "isn", "wasn", "weren", "won", "wouldn", "couldn", "shouldn", "mustn",
       "needn", "ain", "aren", "isn", "t", "s", "d", "ll", "re", "ve", "m"}
)


def _get_word_frequency(word: str) -> str:
    """Classify word frequency tier."""
    if word.lower() in HIGH_FREQ_WORDS:
        return "high"
    if len(word) <= 4:
        return "medium"
    return "low"


def _simple_lemma(word: str, tag: str) -> str:
    """Very lightweight lemmatiser (no extra model needed)."""
    w = word.lower()
    # Already a known base form?
    if w in HIGH_FREQ_WORDS:
        return w
    # Verb forms
    if tag.startswith("VB"):
        if w.endswith("ies"):
            return w[:-3] + "y"
        if w.endswith("ied"):
            return w[:-3] + "y"
        for suffix in ("ing", "ed", "es", "s"):
            if w.endswith(suffix) and len(w) > len(suffix) + 2:
                return w[: -len(suffix)]
        return w
    # Noun plural
    if tag in ("NNS", "NNPS"):
        if w.endswith("ies"):
            return w[:-3] + "y"
        if w.endswith("ses") or w.endswith("xes") or w.endswith("zes"):
            return w[:-2]
        if w.endswith("s") and not w.endswith("ss"):
            return w[:-1]
    return w


# ─── Sentence-role heuristics (no dependency parser) ────────────────────────

def _assign_sentence_roles(tagged_tokens: list[tuple[str, str]]) -> list[str]:
    """
    Approximate sentence roles using POS-pattern heuristics.
    Returns a role string per token: subject / predicate / object / modifier / other
    """
    n = len(tagged_tokens)
    roles: list[str] = ["other"] * n

    # Find the main verb index
    main_verb_idx: int | None = None
    for i, (_, tag) in enumerate(tagged_tokens):
        if tag.startswith("VB") or tag == "MD":
            main_verb_idx = i
            break

    if main_verb_idx is None:
        # No verb found — label nouns as subjects, adjectives as modifiers
        for i, (_, tag) in enumerate(tagged_tokens):
            if tag.startswith("NN"):
                roles[i] = "subject"
            elif tag.startswith("JJ") or tag.startswith("RB"):
                roles[i] = "modifier"
        return roles

    # --- Pre-verb tokens ---
    for i in range(main_verb_idx):
        _, tag = tagged_tokens[i]
        if tag.startswith("NN") or tag.startswith("PRP") or tag in ("WP", "WP$", "EX"):
            roles[i] = "subject"
        elif tag.startswith("JJ") or tag.startswith("RB") or tag == "PDT":
            roles[i] = "modifier"
        elif tag in ("DT", "PRP$", "WDT"):
            roles[i] = "modifier"  # determiners modify the subject noun

    # --- Verb cluster ---
    roles[main_verb_idx] = "predicate"
    for i in range(main_verb_idx + 1, n):
        _, tag = tagged_tokens[i]
        if tag.startswith("VB") or tag == "MD" or tag == "RB":
            roles[i] = "predicate"
        else:
            break  # stop at first non-verb/adverb after the main verb
    verb_end = i if i < n else main_verb_idx + 1

    # --- Post-verb tokens ---
    for i in range(verb_end, n):
        _, tag = tagged_tokens[i]
        if tag.startswith("NN") or tag.startswith("PRP") or tag in ("WP", "CD"):
            roles[i] = "object"
        elif tag.startswith("JJ") or tag.startswith("RB"):
            roles[i] = "modifier"
        elif tag == "IN":
            roles[i] = "modifier"  # prepositions are modifiers

    return roles


def _get_sentence_complexity(tagged_tokens: list[tuple[str, str]]) -> str:
    """Analyse sentence complexity based on verb/conjunction counts."""
    verb_count = sum(1 for _, t in tagged_tokens if t.startswith("VB"))
    conj_count = sum(1 for _, t in tagged_tokens if t in ("CC", "IN"))

    if verb_count <= 1:
        return "simple"
    if conj_count > 0 and verb_count <= 3:
        return "compound"
    return "complex"


def _token_offset(sentence_text: str, tokens: list[str]) -> list[int]:
    """Return the character offset of each token inside *sentence_text*."""
    offsets: list[int] = []
    search_from = 0
    for tok in tokens:
        idx = sentence_text.find(tok, search_from)
        if idx == -1:
            # fallback: use current search position
            idx = search_from
        offsets.append(idx)
        search_from = idx + len(tok)
    return offsets


# ─── Public API ─────────────────────────────────────────────────────────────

def analyze_text(text: str) -> list[SentenceInfo]:
    """
    Analyze text at the sentence level using NLTK.
    Returns structured information about each sentence and its tokens.
    """
    ensure_nltk_data()

    raw_sentences = sent_tokenize(text)
    sentences: list[SentenceInfo] = []

    for sent_text in raw_sentences:
        tokens = word_tokenize(sent_text)
        tagged = pos_tag(tokens)
        roles = _assign_sentence_roles(tagged)
        offsets = _token_offset(sent_text, tokens)

        sentence_info = SentenceInfo(
            text=sent_text,
            complexity=_get_sentence_complexity(tagged),
        )

        for i, (word, tag) in enumerate(tagged):
            # Detect auxiliaries even when NLTK tags them as VB*
            pos_cat = POS_CATEGORY_MAP.get(tag, "other")
            if pos_cat == "verb" and word.lower() in _AUXILIARY_VERBS:
                pos_cat = "auxiliary"

            # Whitespace: if not the last token, grab the gap between this and next
            if i < len(tokens) - 1:
                end_of_current = offsets[i] + len(word)
                ws = sent_text[end_of_current: offsets[i + 1]]
                if not ws:
                    ws = " "
            else:
                ws = ""

            token_info = TokenInfo(
                text=word,
                pos=pos_cat,
                fine_pos=tag,
                lemma=_simple_lemma(word, tag),
                is_stop=word.lower() in _STOP_WORDS,
                dep=roles[i],                       # approximate role as dep
                head_text="",                        # no dependency tree available
                is_entity=tag in ("NNP", "NNPS"),   # proper noun = likely entity
                entity_type="PERSON" if tag in ("NNP", "NNPS") else "",
                syllable_count=_estimate_syllables(word),
                word_frequency=_get_word_frequency(word),
                sentence_role=roles[i],
                idx=offsets[i],
                whitespace=ws,
            )
            sentence_info.tokens.append(token_info)

        sentences.append(sentence_info)

    return sentences


def analyze_batch(texts: list[str]) -> list[list[SentenceInfo]]:
    """Batch analyze multiple text blocks."""
    ensure_nltk_data()
    return [analyze_text(t) for t in texts]
