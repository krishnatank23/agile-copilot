"""
Teams message capture — HTML stripping, EOD validation, metadata extraction.
"""

import re
from bs4 import BeautifulSoup


def strip_html(raw: str) -> str:
    """
    Strip HTML tags from a Teams rich-text message and return clean plain text.
    Teams sends messages as HTML (e.g. <p>, <br>, <div>, <ul>/<li>).
    """
    if not raw:
        return ""

    soup = BeautifulSoup(raw, "html.parser")

    # Replace <br> with newlines
    for br in soup.find_all("br"):
        br.replace_with("\n")

    # Handle <li> items: Teams sometimes wraps multi-line content in a single <li>
    # with <br> line breaks inside. In that case, the inner lines already have
    # their own bullet prefixes from the user's original text — don't add another.
    for li in soup.find_all("li"):
        li_text = li.get_text()
        # If the <li> contains multiple lines (from <br>), don't add bullet prefix —
        # the content already has its own structure
        if "\n" in li_text:
            li.insert_before("\n")
        else:
            li.insert_before("\n- ")
        li.unwrap()

    # Replace block-level tags with newlines
    for tag in soup.find_all(["p", "div"]):
        tag.insert_before("\n")
        tag.unwrap()

    text = soup.get_text()

    # Clean non-breaking spaces and normalize whitespace
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def validate_eod(text: str) -> bool:
    """
    Check if the text looks like a valid EOD message.

    Accepts:
      1. Bullet / numbered list with at least 1 item.
      2. Message that *explicitly* starts with an EOD marker (e.g. "eod:",
         "EOD", "end of day") AND has at least 1 non-empty content line.
         This covers the common Teams format:
             eod: agile-copilot tested - wip
         or
             eod:
             - Completed task1
             - Completed task2
      3. Plain multi-line messages with at least 2 non-header content lines.
    """
    if not text or len(text.strip()) < 5:
        return False

    stripped = text.strip()
    lower = stripped.lower()

    # ── 1. Explicit EOD marker at the START of the message ─────────────────
    eod_start_patterns = [
        r"^eod[\s:.-]",      # "eod:", "eod -", "eod." etc.
        r"^eod$",            # bare "EOD"
        r"^end[\s-]of[\s-]day",
        r"^daily[\s-](update|report)",
        r"^today[\s']*s?[\s-](update|report)",
        r"^day[\s']*s?[\s-]update",
    ]
    has_eod_marker = any(re.match(p, lower) for p in eod_start_patterns)

    if has_eod_marker:
        # Accept as long as there is at least 1 meaningful content word
        # (strip the marker line itself and check what's left)
        first_line, _, rest = stripped.partition("\n")
        # Inline format: "eod: task1 - status1" → content is on the same line
        inline_content = re.sub(r"^eod[\s:.-]*", "", first_line, flags=re.IGNORECASE).strip()
        multi_content = [l.strip() for l in rest.split("\n") if l.strip()]
        all_content = ([inline_content] if inline_content else []) + multi_content
        # Need at least 1 content word that's not just punctuation
        if any(len(re.sub(r"[^a-zA-Z0-9]", "", c)) >= 2 for c in all_content):
            return True

    # ── 2. Bullet or numbered list (≥ 1 item) ──────────────────────────────
    bullet_pattern = re.compile(r"^\s*[-•*]\s*(.+)", re.MULTILINE)
    numbered_pattern = re.compile(r"^\s*\d+[.)]\s*(.+)", re.MULTILINE)
    bullets = bullet_pattern.findall(text)
    numbered = numbered_pattern.findall(text)
    if len(bullets) + len(numbered) >= 1:
        return True

    # ── 3. Plain multi-line: ≥ 2 non-header content lines ──────────────────
    lines = [l.strip() for l in stripped.split("\n") if l.strip()]
    content_lines = [
        l for l in lines
        if not re.match(r"^(mon|tue|wed|thu|fri|sat|sun)", l, re.IGNORECASE)
        and "eod" not in l.lower()
    ]
    return len(content_lines) >= 2



def extract_metadata(payload: dict) -> dict:
    """
    Extract structured metadata from a Teams webhook / Graph API payload.

    Expected payload shape (from Graph API subscription notification):
    {
        "from": {"user": {"displayName": "Aarav Sharma"}},
        "body": {"content": "<p>Wednesday EOD</p><ul><li>task 1</li></ul>"},
        "createdDateTime": "2025-01-15T18:30:00Z"
    }

    Returns:
    {
        "sender": "Aarav Sharma",
        "raw_message": "<p>...</p>",
        "clean_message": "Wednesday EOD\n- task 1",
        "timestamp": "2025-01-15T18:30:00Z"
    }
    """
    # Extract sender name
    sender = "Unknown"
    if "from" in payload:
        from_obj = payload["from"]
        if isinstance(from_obj, dict):
            user = from_obj.get("user", {})
            sender = user.get("displayName", "Unknown") if isinstance(user, dict) else "Unknown"
        elif isinstance(from_obj, str):
            sender = from_obj

    # Legacy flat field (from Power Automate payloads)
    if sender == "Unknown":
        sender = payload.get("sender", "Unknown")

    # Extract message body
    raw_message = ""
    if "body" in payload:
        body = payload["body"]
        if isinstance(body, dict):
            raw_message = body.get("content", "")
        elif isinstance(body, str):
            raw_message = body
    elif "message" in payload:
        raw_message = payload["message"]

    # Extract timestamp
    timestamp = payload.get("createdDateTime", payload.get("timestamp", ""))

    clean_message = strip_html(raw_message)

    return {
        "sender": sender,
        "raw_message": raw_message,
        "clean_message": clean_message,
        "timestamp": timestamp,
    }


def is_eod_message(text: str) -> bool:
    """
    Check if a message is an EOD update.
    Triggers on:
      - 'eod' keyword (case-insensitive)
      - 'end of day' / 'end-of-day'
      - 'today's update' / 'daily update' / 'daily report' / 'day update'
      - Any message with 2+ bullet/numbered task lines (plain task list)
    """
    if not text:
        return False
    lower = text.lower()

    # Explicit EOD markers
    eod_phrases = [
        "eod", "end of day", "end-of-day", "today's update",
        "today update", "daily update", "daily report", "day update",
        "day's update",
    ]
    if any(phrase in lower for phrase in eod_phrases):
        return True

    # Plain task list: 2+ bullet or numbered lines → treat as EOD
    bullet_pattern = re.compile(r"^\s*[-•*]\s*\S", re.MULTILINE)
    numbered_pattern = re.compile(r"^\s*\d+[.)]\s*\S", re.MULTILINE)
    bullet_count = len(bullet_pattern.findall(text))
    numbered_count = len(numbered_pattern.findall(text))
    if bullet_count + numbered_count >= 2:
        return True

    return False


def is_backlog_message(text: str) -> bool:
    """
    Check if a message is a backlog addition.
    Triggers on:
      - '/backlog' command
      - 'backlog:' keyword
    """
    if not text:
        return False
    lower = text.lower()
    return "/backlog" in lower or "backlog:" in lower
