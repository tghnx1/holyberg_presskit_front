"""Build the downloadable HOLYBERG press kit from the current website content."""

from __future__ import annotations

from pathlib import Path
import tempfile

from bs4 import BeautifulSoup
from PIL import Image
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from fontTools.ttLib import TTFont as FontToolsFont


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "dist"
ASSETS = SITE / "assets"
OUTPUT = ASSETS / "HOLYBERG-press-kit.pdf"
QR_URL = "https://holyberg.net"
PAGE_W, PAGE_H = A4
MARGIN = 42
CONTENT_W = PAGE_W - MARGIN * 2

CANVAS = HexColor("#050304")
GREEN = HexColor("#5aba3f")
PAPER = HexColor("#edebe6")
MUTED = HexColor("#a5a49e")
RULE = HexColor("#343432")
PANEL = HexColor("#111610")


def text(node) -> str:
    return " ".join(node.stripped_strings) if node else ""


def wrap_lines(value: str, font: str, size: float, width: float) -> list[str]:
    return simpleSplit(value, font, size, width)


def draw_wrapped(c: canvas.Canvas, value: str, x: float, y: float, width: float,
                 font: str, size: float, leading: float, color= PAPER) -> float:
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap_lines(value, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def load_site_content() -> dict:
    soup = BeautifulSoup((SITE / "index.html").read_text(encoding="utf-8"), "html.parser")
    metrics = [(text(node.select_one("dt")), text(node.select_one("dd")))
               for node in soup.select(".press-metrics > div")]
    if any("experience" in label.lower() for label, _ in metrics):
        raise ValueError("The combined music experience metric must be removed from the site before PDF generation")
    if not metrics:
        raise ValueError("The website's current press metrics are required to build the press kit")

    events = []
    for article in soup.select(".events-entry"):
        events.append({
            "label": text(article.select_one(".events-label")),
            "title": text(article.select_one("h3")),
            "fact": text(article.select_one(".event-fact")),
            "description": text(article.select_one("p:not(.events-label):not(.event-fact)")),
            "links": [(text(link), link.get("href", "")) for link in article.select(".events-links a")],
        })
    holyworld = next((event for event in events if event["title"].upper() == "HOLYWORLD"), None)
    if not holyworld:
        raise ValueError("The HOLYWORLD event is required to build the press kit")

    sound = soup.select_one(".sonic-intro p")
    sound_groups = [(text(group.select_one("h4")), [text(tag) for tag in group.select(".sonic-tags li")])
                    for group in soup.select(".sonic-group")]
    residents = [(text(card.select_one("h4")), text(card.select_one("p")))
                 for card in soup.select("#collective-details .roster-grid:first-of-type .roster-card")]
    crew_list = soup.select_one("#collective-details .roster-grid.roster-crew")
    crew = [(text(card.select_one("h4")), text(card.select_one("p")))
            for card in crew_list.select(".roster-card")] if crew_list else []
    guests = [text(item) for item in soup.select("#guest-artists-title + .guest-list li")]
    # The guest list is a sibling after its heading inside the panel.
    if not guests:
        guest_heading = soup.select_one("#guest-artists-title")
        guests = [text(item) for item in guest_heading.find_next("ul").select("li")] if guest_heading else []

    about = [text(p) for p in soup.select(".manifesto-copy > p")]
    audience = text(soup.select_one(".events-intro > p"))
    outside = [text(p) for p in soup.select("#outside-projects-title ~ p")]
    formation = text(soup.select_one("#people .story-copy p"))
    community = text(soup.select_one(".community-grid .story-copy p"))
    berlin_story = text(soup.select_one(".berlin-grid .story-copy p"))
    visual_work = text(soup.select_one(".visual-intro p"))
    socials = [(text(link), link.get("href", "")) for link in soup.select("#contact .contact-socials a")]
    booking = soup.select_one("#contact .contact-link")
    booking_email = booking.get("href", "").removeprefix("mailto:").split("?", 1)[0] if booking else ""

    return {
        "metrics": metrics,
        "events": events,
        "sound": text(sound),
        "sound_groups": sound_groups,
        "residents": residents,
        "crew": crew,
        "guests": guests,
        "about": about,
        "audience": audience,
        "outside": outside,
        "formation": formation,
        "community": community,
        "berlin_story": berlin_story,
        "visual_work": visual_work,
        "socials": socials,
        "booking_email": booking_email,
    }


def setup_fonts() -> tuple[str, str]:
    display_source = ASSETS / "holyberg-press.woff2"
    converted = Path(tempfile.gettempdir()) / "holyberg-press.ttf"
    font = FontToolsFont(display_source)
    font.flavor = None
    font.save(converted)
    pdfmetrics.registerFont(TTFont("HolybergPress", str(converted)))
    return "HolybergPress", "Helvetica"


def draw_background(c: canvas.Canvas) -> None:
    c.setFillColor(CANVAS)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def draw_header(c: canvas.Canvas, display: str, page_label: str) -> None:
    c.setFillColor(GREEN)
    c.setFont(display, 44)
    c.drawString(MARGIN, PAGE_H - 66, "HOLYBERG")
    c.setFillColor(MUTED)
    c.setFont("Courier", 8)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 47, page_label)
    c.setFillColor(PAPER)
    c.drawString(MARGIN, PAGE_H - 83, "ART. MUSIC. PEOPLE.   /   KYIV — BERLIN")
    c.setStrokeColor(RULE)
    c.setLineWidth(.7)
    c.line(MARGIN, PAGE_H - 96, PAGE_W - MARGIN, PAGE_H - 96)


def draw_stat_block(c: canvas.Canvas, metrics: list[tuple[str, str]], y: float, display: str) -> float:
    gap = 1
    cell_w = (CONTENT_W - gap * (len(metrics) - 1)) / len(metrics)
    height = 78
    for index, (label, value) in enumerate(metrics):
        x = MARGIN + index * (cell_w + gap)
        c.setFillColor(PANEL)
        c.rect(x, y - height, cell_w, height, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont("Helvetica-Bold", 42)
        c.drawString(x + 12, y - 36, value)
        c.setFillColor(MUTED)
        c.setFont("Courier", 7)
        for i, line in enumerate(wrap_lines(label.upper(), "Courier", 7, cell_w - 24)[:2]):
            c.drawString(x + 12, y - 55 - i * 9, line)
    return y - height


def draw_label(c: canvas.Canvas, value: str, x: float, y: float) -> None:
    c.setFillColor(GREEN)
    c.setFont("Courier-Bold", 8)
    c.drawString(x, y, value.upper())


def draw_person_rows(c: canvas.Canvas, people: list[tuple[str, str]], x: float, y: float,
                     width: float, body: str) -> float:
    for name, role in people:
        c.setFillColor(PAPER)
        c.setFont(body, 9)
        c.drawString(x, y, name)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        lines = wrap_lines(role, "Helvetica", 8, width - 110)
        c.drawString(x + 112, y, lines[0] if lines else "")
        y -= 14
    return y


def draw_event(c: canvas.Canvas, event: dict, x: float, top: float, width: float,
               display: str, body: str) -> float:
    c.setStrokeColor(RULE)
    c.setLineWidth(.7)
    c.line(x, top, x + width, top)
    y = top - 13
    c.setFillColor(MUTED)
    c.setFont("Courier", 7)
    c.drawString(x, y, event["label"])
    y -= 19
    c.setFillColor(GREEN)
    title_font = display if all(char.isalpha() or char.isspace() or char in ".-" for char in event["title"].upper()) else "Helvetica-Bold"
    c.setFont(title_font, 14)
    title_lines = wrap_lines(event["title"].upper(), title_font, 14, width)
    for line in title_lines:
        c.drawString(x, y, line)
        y -= 17
    if event["fact"]:
        y = draw_wrapped(c, event["fact"], x, y - 1, width, "Helvetica-Bold", 8.5, 11, PAPER) - 2
    if event["description"]:
        y = draw_wrapped(c, event["description"], x, y, width, body, 8, 10.5, MUTED)
    link_x = x
    for label, url in event["links"]:
        if not url:
            continue
        link_text = label.replace("↗", "").strip()
        c.setFillColor(GREEN)
        c.setFont("Courier", 7)
        c.drawString(link_x, y - 2, link_text)
        c.linkURL(url, (link_x, y - 5, link_x + pdfmetrics.stringWidth(link_text, "Courier", 7), y + 7), relative=0)
        link_x += pdfmetrics.stringWidth(link_text, "Courier", 7) + 12
    return y - 5


def build_pdf() -> None:
    content = load_site_content()
    display, body = setup_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("HOLYBERG — Press Kit")
    c.setAuthor("HOLYBERG")
    c.setSubject("HOLYBERG art and music collective, Berlin")

    # Page 1: identity, current figures, musical spectrum and team.
    draw_background(c)
    draw_header(c, display, "PRESS KIT  /  BERLIN")
    draw_label(c, "Independent art & music collective", MARGIN, PAGE_H - 119)

    photo_path = ASSETS / "dj-booth.webp"
    with Image.open(photo_path) as image:
        photo = ImageReader(image.convert("RGB"))
        c.drawImage(photo, PAGE_W - MARGIN - 196, PAGE_H - 314, 196, 146,
                    preserveAspectRatio=True, anchor="c", mask="auto")

    copy_width = CONTENT_W - 216
    y = PAGE_H - 145
    for paragraph in content["about"]:
        y = draw_wrapped(c, paragraph, MARGIN, y, copy_width, body, 9, 13, PAPER) - 8
    y = draw_wrapped(c, content["audience"], MARGIN, y, copy_width, body, 8, 11, MUTED)

    c.setFillColor(PAPER)
    c.setFont("Courier-Bold", 8)
    c.drawString(MARGIN, PAGE_H - 339, "HOLYBERG IN NUMBERS")
    stats = [(label, value) for label, value in content["metrics"]]
    y_after_stats = draw_stat_block(c, stats, PAGE_H - 352, display)

    section_y = y_after_stats - 24
    draw_label(c, "Musical spectrum", MARGIN, section_y)
    c.setFillColor(PAPER)
    c.setFont(display, 17)
    c.drawString(MARGIN, section_y - 24, "DEEP BASS. HYPNOTIC GROOVES.")
    draw_wrapped(c, content["sound"], MARGIN, section_y - 42, CONTENT_W, body, 8.5, 11, MUTED)
    c.setFillColor(GREEN)
    c.setFont("Courier-Bold", 8)
    genre_y = section_y - 70
    for group_name, genres in content["sound_groups"]:
        c.setFillColor(MUTED)
        c.drawString(MARGIN, genre_y, group_name.upper())
        c.setFillColor(GREEN)
        c.drawString(MARGIN + 110, genre_y, "   ·   ".join(genre.upper() for genre in genres))
        genre_y -= 13

    people_y = section_y - 114
    c.setStrokeColor(RULE)
    c.line(MARGIN, people_y + 10, PAGE_W - MARGIN, people_y + 10)
    draw_label(c, "Residents", MARGIN, people_y - 5)
    left_people = content["residents"]
    draw_person_rows(c, left_people, MARGIN, people_y - 24, CONTENT_W / 2 - 16, body)
    draw_label(c, "Creative team", PAGE_W / 2 + 8, people_y - 5)
    draw_person_rows(c, content["crew"], PAGE_W / 2 + 8, people_y - 24, CONTENT_W / 2 - 8, body)

    team_bottom = people_y - 24 - max(len(left_people), len(content["crew"])) * 14 - 5
    draw_label(c, "Guest artists", MARGIN, team_bottom)
    c.setFillColor(PAPER)
    c.setFont(body, 8.5)
    c.drawString(MARGIN, team_bottom - 16, "  ·  ".join(content["guests"]))
    project_y = team_bottom - 38
    draw_label(c, "Individual DJ projects & shared lineups", MARGIN, project_y)
    for paragraph in content["outside"]:
        project_y = draw_wrapped(c, paragraph, MARGIN, project_y - 15, CONTENT_W, body, 8, 10.5, MUTED) - 4
    c.setFillColor(MUTED)
    c.setFont("Courier", 7)
    c.drawRightString(PAGE_W - MARGIN, 28, "1 / 3   ·   HOLYBERG.NET")
    c.linkURL(QR_URL, (PAGE_W - MARGIN - 68, 20, PAGE_W - MARGIN, 35), relative=0)
    c.showPage()

    # Page 2: recent events and a high-correction, print-ready QR code.
    draw_background(c)
    draw_header(c, display, "SELECTED EVENTS  /  2025—2026")
    draw_label(c, "Berlin events", MARGIN, PAGE_H - 119)
    c.setFillColor(PAPER)
    c.setFont(body, 9)
    c.drawString(MARGIN, PAGE_H - 137, "Our own club nights, guest lineups and creative collaborations.")

    gap = 26
    col_w = (CONTENT_W - gap) / 2
    row_top = PAGE_H - 162
    row_step = 101
    event_bottoms = []
    for index, event in enumerate(content["events"]):
        col = index % 2
        row = index // 2
        event_bottoms.append(draw_event(
            c, event, MARGIN + col * (col_w + gap), row_top - row * row_step,
            col_w, display, body,
        ))

    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=12, border=5)
    qr.add_data(QR_URL)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_reader = ImageReader(qr_image)
    qr_size = 246
    qr_x = (PAGE_W - qr_size) / 2
    qr_y = 178
    c.setFillColor(PAPER)
    c.rect(qr_x - 10, qr_y - 10, qr_size + 20, qr_size + 20, fill=1, stroke=0)
    c.drawImage(qr_reader, qr_x, qr_y, qr_size, qr_size, preserveAspectRatio=True, mask="auto")
    c.linkURL(QR_URL, (qr_x, qr_y, qr_x + qr_size, qr_y + qr_size), relative=0)
    c.setFillColor(GREEN)
    c.setFont("Courier-Bold", 8)
    qr_caption_y = qr_y + qr_size + 19
    c.drawCentredString(PAGE_W / 2, qr_caption_y, "SCAN TO VISIT HOLYBERG.NET")
    if event_bottoms and min(event_bottoms) <= qr_caption_y + 18:
        raise ValueError("Event text exceeds the current page layout and would overlap the QR section")

    c.setStrokeColor(RULE)
    c.line(MARGIN, 140, PAGE_W - MARGIN, 140)
    c.setFillColor(PAPER)
    c.setFont(body, 9)
    c.drawString(MARGIN, 122, f"BOOKING  ·  {content['booking_email']}")
    if content["booking_email"]:
        c.linkURL(f"mailto:{content['booking_email']}", (MARGIN, 116, MARGIN + 210, 133), relative=0)
    social_x = MARGIN
    social_y = 101
    c.setFont("Courier", 7)
    for label, url in content["socials"]:
        label_text = label.replace("↗", "").strip().upper()
        c.setFillColor(GREEN)
        c.drawString(social_x, social_y, label_text)
        label_w = pdfmetrics.stringWidth(label_text, "Courier", 7)
        c.linkURL(url, (social_x, social_y - 3, social_x + label_w, social_y + 9), relative=0)
        social_x += label_w + 18
    c.setFillColor(MUTED)
    c.setFont("Courier", 7)
    c.drawRightString(PAGE_W - MARGIN, 28, "2 / 3")
    c.showPage()

    # Page 3: the collective's formation and the visual work behind the project.
    draw_background(c)
    draw_header(c, display, "FORMATION & VISUALS")
    c.setFillColor(GREEN)
    c.setFont(display, 28)
    c.drawString(MARGIN, PAGE_H - 145, "WE FOUND OUR FAMILY.")
    y = draw_wrapped(c, content["formation"], MARGIN, PAGE_H - 174, CONTENT_W,
                     body, 9.5, 13, PAPER) - 8
    y = draw_wrapped(c, content["community"], MARGIN, y, CONTENT_W,
                     body, 9, 12, MUTED) - 8
    y = draw_wrapped(c, content["berlin_story"], MARGIN, y, CONTENT_W,
                     body, 9, 12, MUTED) - 2
    c.setFillColor(GREEN)
    c.setFont(display, 19)
    c.drawString(MARGIN, y - 15, "TO KEEP GOING.")

    visual_y = y - 34
    c.setStrokeColor(RULE)
    c.line(MARGIN, visual_y + 11, PAGE_W - MARGIN, visual_y + 11)
    draw_label(c, "Visual identity · built by us", MARGIN, visual_y - 5)
    c.setFillColor(PAPER)
    c.setFont(display, 20)
    c.drawString(MARGIN, visual_y - 31, "USING WHATEVER WE HAD.")
    visual_y = draw_wrapped(c, content["visual_work"], MARGIN, visual_y - 49,
                            CONTENT_W, body, 9, 12, MUTED) - 12

    visual_path = ASSETS / "triangle-laser.webp"
    visual_width = 365
    visual_height = 245
    with Image.open(visual_path) as image:
        visual_image = ImageReader(image.convert("RGB"))
        c.drawImage(visual_image, (PAGE_W - visual_width) / 2,
                    visual_y - visual_height, visual_width, visual_height,
                    preserveAspectRatio=True, anchor="c", mask="auto")
    c.setFillColor(MUTED)
    c.setFont("Courier", 7)
    c.drawRightString(PAGE_W - MARGIN, 28, "3 / 3   ·   HOLYBERG.NET")
    c.linkURL(QR_URL, (PAGE_W - MARGIN - 92, 20, PAGE_W - MARGIN, 35), relative=0)
    c.showPage()
    c.save()
    print(f"Generated {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
