"""
Color Engine - Assigns colors to tokens based on contextual NLP analysis.
Uses sentence-level understanding to create meaningful, dyslexia-friendly color coding.

Color assignment strategy:
1. POS-based primary color families (nouns=blue, verbs=green, etc.)
2. Sentence role modulates shade/intensity
3. Word frequency affects opacity
4. Syllable complexity adds subtle markers
5. High contrast, colorblind-safe palette
"""

from dataclasses import dataclass
from typing import Optional
from .sentence_analyzer import TokenInfo, SentenceInfo, analyze_text, analyze_batch


@dataclass
class ColorProfile:
    """A named color profile with HSL values and metadata."""
    name: str
    hue: int        # 0-360
    saturation: int # 0-100
    lightness: int  # 0-100
    category: str   # POS category this belongs to

    @property
    def hsl(self) -> str:
        return f"hsl({self.hue}, {self.saturation}%, {self.lightness}%)"

    @property
    def hex(self) -> str:
        """Convert HSL to hex for extension use."""
        import colorsys
        h = self.hue / 360
        s = self.saturation / 100
        l = self.lightness / 100
        r, g, b = colorsys.hls_to_rgb(h, l, s)
        return f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "hsl": self.hsl,
            "hex": self.hex,
            "category": self.category,
        }


# ─── Dyslexia-Friendly Color Palette ───────────────────────────────────────────
# Designed for high contrast, colorblind safety, and visual distinction.
# Colors avoid pure red/green combinations. Uses blue-orange-purple-teal families.

COLOR_SCHEMES = {
    "default": {
        # Content words - vivid, distinct colors
        "noun":        ColorProfile("Sapphire",    220, 72, 52, "noun"),
        "proper_noun": ColorProfile("Royal Blue",  230, 65, 45, "proper_noun"),
        "verb":        ColorProfile("Emerald",     155, 65, 42, "verb"),
        "auxiliary":   ColorProfile("Sage",        150, 40, 55, "auxiliary"),
        "adjective":   ColorProfile("Amber",        35, 80, 50, "adjective"),
        "adverb":      ColorProfile("Coral",        16, 75, 55, "adverb"),
        "preposition": ColorProfile("Lavender",    270, 35, 60, "preposition"),
        "conjunction": ColorProfile("Mauve",       290, 30, 55, "conjunction"),
        "pronoun":     ColorProfile("Steel",       210, 25, 55, "pronoun"),
        "determiner":  ColorProfile("Slate",       200, 18, 50, "determiner"),
        "number":      ColorProfile("Teal",        180, 55, 42, "number"),
        "interjection":ColorProfile("Tangerine",    25, 85, 55, "interjection"),
        "particle":    ColorProfile("Mist",        200, 15, 58, "particle"),
        "punctuation": ColorProfile("Gray",          0,  0, 45, "punctuation"),
        "space":       ColorProfile("Transparent",   0,  0,  0, "space"),
        "symbol":      ColorProfile("Charcoal",      0,  5, 40, "symbol"),
        "other":       ColorProfile("DimGray",       0, 10, 50, "other"),
    },
    "high_contrast": {
        "noun":        ColorProfile("Deep Blue",   220, 85, 40, "noun"),
        "proper_noun": ColorProfile("Navy",        230, 80, 35, "proper_noun"),
        "verb":        ColorProfile("Forest",      145, 80, 35, "verb"),
        "auxiliary":   ColorProfile("Green",       140, 55, 45, "auxiliary"),
        "adjective":   ColorProfile("Orange",       30, 90, 45, "adjective"),
        "adverb":      ColorProfile("Red-Orange",   15, 85, 48, "adverb"),
        "preposition": ColorProfile("Purple",      270, 50, 48, "preposition"),
        "conjunction": ColorProfile("Violet",      290, 45, 45, "conjunction"),
        "pronoun":     ColorProfile("Blue-Gray",   210, 35, 45, "pronoun"),
        "determiner":  ColorProfile("Cool Gray",   200, 25, 42, "determiner"),
        "number":      ColorProfile("Dark Teal",   180, 70, 35, "number"),
        "interjection":ColorProfile("Bright Orange", 25, 95, 48, "interjection"),
        "particle":    ColorProfile("Medium Gray", 200, 20, 50, "particle"),
        "punctuation": ColorProfile("Dark Gray",     0,  0, 35, "punctuation"),
        "space":       ColorProfile("Transparent",   0,  0,  0, "space"),
        "symbol":      ColorProfile("Black",         0,  0, 25, "symbol"),
        "other":       ColorProfile("Gray",          0, 15, 42, "other"),
    },
    "pastel": {
        "noun":        ColorProfile("Sky Blue",    210, 60, 68, "noun"),
        "proper_noun": ColorProfile("Periwinkle",  225, 55, 65, "proper_noun"),
        "verb":        ColorProfile("Mint",        155, 50, 62, "verb"),
        "auxiliary":   ColorProfile("Light Green", 150, 35, 68, "auxiliary"),
        "adjective":   ColorProfile("Peach",        30, 70, 70, "adjective"),
        "adverb":      ColorProfile("Salmon",       15, 65, 68, "adverb"),
        "preposition": ColorProfile("Lilac",       270, 40, 72, "preposition"),
        "conjunction": ColorProfile("Orchid",      290, 35, 68, "conjunction"),
        "pronoun":     ColorProfile("Light Steel", 210, 30, 70, "pronoun"),
        "determiner":  ColorProfile("Silver",      200, 20, 68, "determiner"),
        "number":      ColorProfile("Aqua",        180, 45, 62, "number"),
        "interjection":ColorProfile("Apricot",      25, 75, 72, "interjection"),
        "particle":    ColorProfile("Fog",         200, 18, 72, "particle"),
        "punctuation": ColorProfile("Light Gray",    0,  0, 65, "punctuation"),
        "space":       ColorProfile("Transparent",   0,  0,  0, "space"),
        "symbol":      ColorProfile("Medium Gray",   0,  8, 58, "symbol"),
        "other":       ColorProfile("Ash",           0, 12, 65, "other"),
    },
}


@dataclass
class ColoredToken:
    """A token with its assigned color information."""
    text: str
    color: str          # Hex color
    background: str     # Optional background highlight hex
    font_weight: str    # normal/bold/semibold
    opacity: float      # 0.0-1.0
    underline: bool     # Underline for emphasis
    pos: str            # POS category
    sentence_role: str  # Role in sentence
    whitespace: str     # Trailing whitespace

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "color": self.color,
            "background": self.background,
            "fontWeight": self.font_weight,
            "opacity": self.opacity,
            "underline": self.underline,
            "pos": self.pos,
            "sentenceRole": self.sentence_role,
            "whitespace": self.whitespace,
        }


@dataclass
class ColoredSentence:
    """A sentence with all tokens colored."""
    text: str
    tokens: list[ColoredToken]
    complexity: str

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "tokens": [t.to_dict() for t in self.tokens],
            "complexity": self.complexity,
        }


def _modulate_color(
    profile: ColorProfile,
    token: TokenInfo,
    emphasis_level: str = "normal",
) -> tuple[str, str, str, float, bool]:
    """
    Modulate a base color profile based on token context.
    Returns (text_color_hex, bg_hex, font_weight, opacity, underline).
    """
    import colorsys

    h = profile.hue / 360
    s = profile.saturation / 100
    l = profile.lightness / 100

    # ── Sentence role modulation ──
    if token.sentence_role == "subject":
        s = min(1.0, s * 1.15)      # More saturated for subjects
        l = max(0.25, l - 0.05)     # Slightly darker
    elif token.sentence_role == "predicate":
        s = min(1.0, s * 1.1)
    elif token.sentence_role == "object":
        l = min(0.75, l + 0.03)

    # ── Frequency modulation ──
    opacity = 1.0
    if token.word_frequency == "high" and token.is_stop:
        opacity = 0.75  # Dim very common function words slightly
        s = max(0.0, s - 0.1)

    # ── Emphasis settings ──
    font_weight = "normal"
    underline = False

    if emphasis_level == "high":
        if token.sentence_role in ("subject", "predicate"):
            font_weight = "bold"
        if token.is_entity:
            underline = True
    elif emphasis_level == "medium":
        if token.sentence_role == "subject":
            font_weight = "600"

    # ── Syllable complexity marker ──
    # Multi-syllable words get slightly adjusted for visual distinction
    if token.syllable_count >= 3 and not token.is_stop:
        l = max(0.2, l - 0.04)  # Slightly darker for complex words

    # Convert back to hex
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    text_color = f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"

    # Background: very subtle tint of the same color family
    bg_r, bg_g, bg_b = colorsys.hls_to_rgb(h, 0.97, s * 0.15)
    bg_color = f"#{int(bg_r*255):02x}{int(bg_g*255):02x}{int(bg_b*255):02x}"

    return text_color, bg_color, font_weight, opacity, underline


def colorize_tokens(
    sentences: list[SentenceInfo],
    scheme: str = "default",
    emphasis: str = "normal",
    show_function_words: bool = True,
) -> list[ColoredSentence]:
    """
    Assign colors to analyzed tokens based on their contextual roles.

    Args:
        sentences: Pre-analyzed sentence data from sentence_analyzer
        scheme: Color scheme name (default/high_contrast/pastel)
        emphasis: Emphasis level (normal/medium/high)
        show_function_words: Whether to color function words or keep them neutral
    """
    palette = COLOR_SCHEMES.get(scheme, COLOR_SCHEMES["default"])
    result = []

    for sent_info in sentences:
        colored_tokens = []

        for token in sent_info.tokens:
            # Skip spaces
            if token.pos == "space":
                continue

            # Get base color profile
            pos_key = token.pos
            if not show_function_words and token.is_stop:
                pos_key = "other"  # Neutral color for function words

            color_profile = palette.get(pos_key, palette["other"])

            # Modulate based on context
            text_color, bg_color, font_weight, opacity, underline = _modulate_color(
                color_profile, token, emphasis
            )

            colored_tokens.append(ColoredToken(
                text=token.text,
                color=text_color,
                background=bg_color,
                font_weight=font_weight,
                opacity=opacity,
                underline=underline,
                pos=token.pos,
                sentence_role=token.sentence_role,
                whitespace=token.whitespace,
            ))

        result.append(ColoredSentence(
            text=sent_info.text,
            tokens=colored_tokens,
            complexity=sent_info.complexity,
        ))

    return result


def colorize_text(
    text: str,
    scheme: str = "default",
    emphasis: str = "normal",
    show_function_words: bool = True,
) -> list[dict]:
    """
    Full pipeline: analyze text and return colored tokens.
    This is the main entry point for the color coding feature.
    """
    sentences = analyze_text(text)
    colored = colorize_tokens(sentences, scheme, emphasis, show_function_words)
    return [s.to_dict() for s in colored]


def colorize_batch(
    texts: list[str],
    scheme: str = "default",
    emphasis: str = "normal",
    show_function_words: bool = True,
) -> list[list[dict]]:
    """Batch colorize multiple text blocks."""
    all_sentences = analyze_batch(texts)
    results = []
    for sentences in all_sentences:
        colored = colorize_tokens(sentences, scheme, emphasis, show_function_words)
        results.append([s.to_dict() for s in colored])
    return results


def get_available_schemes() -> dict:
    """Return all available color schemes with their palettes."""
    schemes = {}
    for name, palette in COLOR_SCHEMES.items():
        schemes[name] = {
            pos: profile.to_dict() for pos, profile in palette.items()
        }
    return schemes


def get_legend(scheme: str = "default") -> list[dict]:
    """Return a legend mapping POS categories to colors for the UI."""
    palette = COLOR_SCHEMES.get(scheme, COLOR_SCHEMES["default"])
    legend = []
    # Only show content-relevant categories
    display_categories = [
        ("noun", "Nouns"),
        ("proper_noun", "Proper Nouns"),
        ("verb", "Verbs"),
        ("auxiliary", "Auxiliary Verbs"),
        ("adjective", "Adjectives"),
        ("adverb", "Adverbs"),
        ("preposition", "Prepositions"),
        ("conjunction", "Conjunctions"),
        ("pronoun", "Pronouns"),
        ("determiner", "Determiners"),
        ("number", "Numbers"),
    ]
    for key, label in display_categories:
        profile = palette.get(key)
        if profile:
            legend.append({
                "category": key,
                "label": label,
                "color": profile.hex,
                "hsl": profile.hsl,
            })
    return legend
