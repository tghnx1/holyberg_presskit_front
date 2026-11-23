"""Build the one-page downloadable HOLYBERG press kit from the website content."""

from __future__ import annotations

from pathlib import Path
import tempfile

from bs4 import BeautifulSoup
from PIL import Image
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from reportlab.lib.colors import HexColor
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
QR_URL = "https://bio.holyberg.net/"
PAGE_W, PAGE_H = A4
MARGIN = 34
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


def fit_lines(value: str, font: str, size: float, width: float, limit: int) -> list[str]:
    lines = wrap_lines(value, font, size, width)
    if len(lines) <= limit:
        return lines
    lines = lines[:limit]
    last = lines[-1].rstrip()
    while last and pdfmetrics.stringWidth(last + "...", font, size) > width:
        last = last[:-1].rstrip()
    lines[-1] = last + "..."
    return lines


def draw_wrapped(c: canvas.Canvas, value: str, x: float, y: float, width: float,
                 font: str, size: float, leading: float, color=PAPER, limit: int = 4) -> float:
    c.setFont(font, size)
    c.setFillColor(color)
    for line in fit_lines(value, font, size, width, limit):
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
    guest_heading = soup.select_one("#guest-artists-title")
    guests = [text(item) for item in guest_heading.find_next("ul").select("li")] if guest_heading else []

    about = [text(p) for p in soup.select(".manifesto-copy > p")]
    audience = text(soup.select_one(".events-intro > p"))
    outside = [text(p) for p in soup.select("#outside-projects-title ~ p")]
    formation = text(soup.select_one("#people .story-copy p"))
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


def display_safe(value: str) -> bool:
    return all(char.isalpha() or char.isspace() or char in ".-" for char in value)


def draw_background(c: canvas.Canvas) -> None:
    c.setFillColor(CANVAS)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def draw_label(c: canvas.Canvas, value: str, x: float, y: float) -> None:
    c.setFillColor(GREEN)
    c.setFont("Courier-Bold", 7.5)
    c.drawString(x, y, value.upper())


def draw_header(c: canvas.Canvas, display: str) -> None:
    c.setFillColor(GREEN)
    c.setFont(display, 34)
    c.drawString(MARGIN, PAGE_H - 50, "HOLYBERG")
    c.setFillColor(MUTED)
    c.setFont("Courier", 7.5)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 37, "PRESS KIT  /  2026  /  BERLIN")
    c.setFillColor(PAPER)
    c.setFont("Courier", 7)
    c.drawString(MARGIN, PAGE_H - 65, "ART. MUSIC. PEOPLE.   /   KYIV — BERLIN")
    c.setFillColor(GREEN)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 65, "BIO.HOLYBERG.NET")
    c.setStrokeColor(RULE)
    c.setLineWidth(.7)
    c.line(MARGIN, PAGE_H - 73, PAGE_W - MARGIN, PAGE_H - 73)


def draw_qr(c: canvas.Canvas, x: float, y: float, size: float) -> None:
    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(QR_URL)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    c.setFillColor(PAPER)
    c.rect(x - 4, y - 4, size + 8, size + 8, fill=1, stroke=0)
    c.drawImage(ImageReader(qr_image), x, y, size, size, preserveAspectRatio=True, mask="auto")
    c.linkURL(QR_URL, (x, y, x + size, y + size), relative=0)


def draw_intro(c: canvas.Canvas, content: dict, body: str) -> float:
    top = PAGE_H - 88
    draw_label(c, "Independent art & music collective", MARGIN, top)

    slot_x = PAGE_W - MARGIN - 168
    slot_w = 168
    qr_size = 100
    qr_x = slot_x + (slot_w - qr_size) / 2
    qr_y = PAGE_H - 196
    draw_qr(c, qr_x, qr_y, qr_size)
    link_text = "BIO.HOLYBERG.NET"
    c.setFillColor(GREEN)
    c.setFont("Courier-Bold", 6.5)
    link_w = pdfmetrics.stringWidth(link_text, "Courier-Bold", 6.5)
    c.drawCentredString(qr_x + qr_size / 2, qr_y - 10, link_text)
    c.linkURL(QR_URL, (qr_x + qr_size / 2 - link_w / 2, qr_y - 13,
                       qr_x + qr_size / 2 + link_w / 2, qr_y - 3), relative=0)

    copy_w = CONTENT_W - 190
    y = top - 16
    for index, paragraph in enumerate(content["about"]):
        y = draw_wrapped(c, paragraph, MARGIN, y, copy_w, body, 7.9, 9.6, PAPER, limit=3 if index == 0 else 6)
        y -= 3
    draw_wrapped(c, content["audience"], MARGIN, y - 1, copy_w, body, 7.4, 9.2, MUTED, limit=2)
    return PAGE_H - 212


def draw_metrics(c: canvas.Canvas, metrics: list[tuple[str, str]], top: float, display: str) -> float:
    gap = 1
    cell_w = (CONTENT_W - gap * (len(metrics) - 1)) / len(metrics)
    height = 58
    for index, (label, value) in enumerate(metrics):
        x = MARGIN + index * (cell_w + gap)
        c.setFillColor(PANEL)
        c.rect(x, top - height, cell_w, height, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont("Helvetica-Bold", 27)
        c.drawString(x + 11, top - 32, value)
        c.setFillColor(MUTED)
        c.setFont("Courier", 6.4)
        for line_index, line in enumerate(fit_lines(label.upper(), "Courier", 6.4, cell_w - 22, 2)):
            c.drawString(x + 11, top - 43 - line_index * 8, line)
    return top - height


def draw_spectrum(c: canvas.Canvas, content: dict, x: float, top: float,
                  width: float, display: str, body: str) -> float:
    draw_label(c, "Musical spectrum", x, top)
    c.setFillColor(PAPER)
    c.setFont(display, 14)
    c.drawString(x, top - 19, "DEEP BASS.")
    c.drawString(x, top - 33, "HYPNOTIC GROOVES.")
    y = draw_wrapped(c, content["sound"], x, top - 48, width, body, 7.4, 9.2, MUTED, limit=3)

    genre_y = y - 9
    for group_name, genres in content["sound_groups"]:
        c.setFillColor(MUTED)
        c.setFont("Courier-Bold", 6.4)
        c.drawString(x, genre_y, group_name.upper())
        c.setFillColor(GREEN)
        c.setFont("Courier", 6.4)
        c.drawString(x + 96, genre_y, "   ·   ".join(genre.upper() for genre in genres[:4]))
        genre_y -= 10.5

    c.setStrokeColor(RULE)
    c.setLineWidth(.7)
    c.line(x, genre_y - 5, x + width, genre_y - 5)
    draw_label(c, "Individual DJ projects", x, genre_y - 19)
    project_y = genre_y - 33
    for paragraph in content["outside"]:
        project_y = draw_wrapped(c, paragraph, x, project_y, width, body, 6.8, 8.4, MUTED, limit=3) - 3
    return project_y


def draw_people(c: canvas.Canvas, content: dict, x: float, top: float,
                width: float, body: str) -> float:
    draw_label(c, "Residents", x, top)
    residents = content["residents"]
    sub_w = width / 2
    rows = max(1, (len(residents) + 1) // 2)
    row_step = 20.5
    for index, (name, role) in enumerate(residents):
        col = index // rows
        row = index % rows
        px = x + col * sub_w
        py = top - 16 - row * row_step
        c.setFillColor(PAPER)
        c.setFont(body, 8.4)
        c.drawString(px, py, name)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.6)
        c.drawString(px, py - 8, fit_lines(role, "Helvetica", 6.6, sub_w - 8, 1)[0] if role else "")
    y = top - 16 - rows * row_step - 5

    draw_label(c, "Creative team", x, y)
    for index, (name, role) in enumerate(content["crew"]):
        py = y - 16 - index * 14
        c.setFillColor(PAPER)
        c.setFont(body, 8.2)
        c.drawString(x, py, name)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.6)
        c.drawString(x + 96, py, fit_lines(role, "Helvetica", 6.6, width - 96, 1)[0] if role else "")
    y = y - 16 - len(content["crew"]) * 14

    draw_label(c, "Guest artists", x, y - 3)
    y = draw_wrapped(c, "  ·  ".join(content["guests"]), x, y - 16,
                     width, body, 7.2, 9, PAPER, limit=2)

    draw_label(c, "Formation", x, y - 5)
    y = draw_wrapped(c, content["formation"], x, y - 19, width, body, 6.7, 8.3, MUTED, limit=3)
    return y


def draw_event(c: canvas.Canvas, event: dict, x: float, top: float, width: float,
               display: str, body: str) -> None:
    c.setStrokeColor(RULE)
    c.setLineWidth(.7)
    c.line(x, top, x + width, top)
    c.setFillColor(MUTED)
    c.setFont("Courier", 5.9)
    c.drawString(x, top - 10, fit_lines(event["label"], "Courier", 5.9, width, 1)[0])

    title = event["title"].upper()
    title_font = display if display_safe(title) else "Helvetica-Bold"
    c.setFillColor(GREEN)
    c.setFont(title_font, 10)
    title_lines = fit_lines(title, title_font, 10, width, 2)
    y = top - 23
    for line in title_lines:
        c.drawString(x, y, line)
        y -= 11.5

    if event["fact"]:
        c.setFillColor(PAPER)
        c.setFont("Helvetica-Bold", 7.2)
        c.drawString(x, y, fit_lines(event["fact"], "Helvetica-Bold", 7.2, width, 1)[0])
        y -= 9.5

    if event["description"]:
        y = draw_wrapped(c, event["description"], x, y, width, body, 6.6, 8.1, MUTED, limit=1)

    link_x = x
    c.setFont("Courier", 6)
    for label, url in event["links"]:
        if not url:
            continue
        link_text = label.replace("↗", "").strip().upper()
        if link_x + pdfmetrics.stringWidth(link_text, "Courier", 6) > x + width:
            break
        c.setFillColor(GREEN)
        c.drawString(link_x, y - 1, link_text)
        c.linkURL(url, (link_x, y - 4, link_x + pdfmetrics.stringWidth(link_text, "Courier", 6), y + 6), relative=0)
        link_x += pdfmetrics.stringWidth(link_text, "Courier", 6) + 10


def draw_footer(c: canvas.Canvas, content: dict, body: str) -> None:
    c.setStrokeColor(RULE)
    c.setLineWidth(.7)
    c.line(MARGIN, 110, PAGE_W - MARGIN, 110)

    draw_label(c, "Booking", MARGIN, 96)
    c.setFillColor(PAPER)
    c.setFont(body, 9)
    email = content["booking_email"]
    c.drawString(MARGIN, 82, email)
    if email:
        c.linkURL(f"mailto:{email}", (MARGIN, 78, MARGIN + pdfmetrics.stringWidth(email, body, 9), 90), relative=0)

    social_x = MARGIN
    c.setFont("Courier-Bold", 6.6)
    for label, url in content["socials"]:
        label_text = label.replace("↗", "").strip().upper()
        c.setFillColor(GREEN)
        c.drawString(social_x, 61, label_text)
        label_w = pdfmetrics.stringWidth(label_text, "Courier-Bold", 6.6)
        c.linkURL(url, (social_x, 58, social_x + label_w, 68), relative=0)
        social_x += label_w + 14


def build_pdf() -> None:
    content = load_site_content()
    display, body = setup_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("HOLYBERG — Press Kit")
    c.setAuthor("HOLYBERG")
    c.setSubject("HOLYBERG art and music collective, Berlin")

    draw_background(c)
    draw_header(c, display)
    intro_bottom = draw_intro(c, content, body)
    stats_bottom = draw_metrics(c, content["metrics"], intro_bottom - 6, display)

    band_top = stats_bottom - 18
    left_w = 244
    right_x = MARGIN + left_w + 26
    right_w = CONTENT_W - left_w - 26
    draw_spectrum(c, content, MARGIN, band_top, left_w, display, body)
    draw_people(c, content, right_x, band_top, right_w, body)

    event_top = band_top - 198
    draw_label(c, "Selected events  /  2025—2026", MARGIN, event_top)
    gap = 24
    col_w = (CONTENT_W - gap) / 2
    row_top = event_top - 14
    row_step = 84
    for index, event in enumerate(content["events"][:4]):
        col = index % 2
        row = index // 2
        draw_event(c, event, MARGIN + col * (col_w + gap), row_top - row * row_step,
                   col_w, display, body)

    draw_footer(c, content, body)
    c.showPage()
    c.save()
    print(f"Generated one-page {OUTPUT}")


if __name__ == "__main__":
    build_pdf()
