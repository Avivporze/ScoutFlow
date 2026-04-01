import os
import time
from bs4 import BeautifulSoup, Comment
from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError
from playwright_stealth import Stealth
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# FBref's published bot policy: max 10 requests/minute.
# 6.5s gives ~9.2 req/min — safely under the limit with buffer for network jitter.
RATE_LIMIT_SECONDS = 6.5


def fetch_players() -> list[dict]:
    """Fetch players with an fbref_url from Supabase."""
    print("Fetching players with an FBref URL...")
    try:
        response = supabase.table("players").select("id, fbref_url").execute()
        return [p for p in response.data if p.get("fbref_url")]
    except Exception as e:
        print(f"Error fetching players: {e}")
        return []


def update_player_stats(player_id: str, stats: dict):
    """Write scraped stats back to Supabase. Service role key bypasses RLS."""
    try:
        supabase.table("players").update({
            **stats,
            "stats_updated_at": "now()",
        }).eq("id", player_id).execute()
        print(f"  Updated: {stats}")
    except Exception as e:
        print(f"  Error updating player {player_id}: {e}")


def fetch_html(page: Page, url: str) -> str | None:
    """
    Navigate to an FBref URL and return the full HTML.

    If Cloudflare Turnstile is detected, the script pauses and waits for the
    user to manually solve the challenge and confirm via terminal input.
    Subsequent calls reuse the same authenticated session with no intervention.
    """
    print(f"  Fetching: {url}")
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)

        if "turnstile" in page.content().lower():
            print()
            print("  " + "=" * 56)
            print("  MANUAL ACTION REQUIRED")
            print("  Cloudflare challenge detected in the browser window.")
            print("  1. Solve the Turnstile in the browser.")
            print("  2. Wait for the player page to fully load.")
            print("  3. Press Enter here to continue.")
            print("  " + "=" * 56)
            input("\n--- PRESS ENTER once the player page is fully loaded ---\n")

        return page.content()

    except PlaywrightTimeoutError:
        print(f'  ERROR: {{"error": "timeout", "url": "{url}"}}')
        return None
    except Exception as e:
        print(f'  ERROR: {{"error": "navigation_failed", "url": "{url}", "detail": "{e}"}}')
        return None


def extract_player_stats(html: str) -> dict | None:
    """
    Parse FBref HTML with BeautifulSoup and extract standard stats.
    Searches through HTML comments if the table is hidden (FBref pattern).
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1. Direct table lookup
    target_table = soup.find("table", {"id": "stats_standard_dom_lg"})

    # 2. FBref often wraps tables in HTML comments — search inside them
    if not target_table:
        comments = soup.find_all(string=lambda text: isinstance(text, Comment))
        for c in comments:
            if 'id="stats_standard_dom_lg"' in c:
                comment_soup = BeautifulSoup(c, "html.parser")
                target_table = comment_soup.find("table", {"id": "stats_standard_dom_lg"})
                if target_table:
                    break

    if not target_table:
        print("  WARNING: Standard stats table not found.")
        return None

    tbody = target_table.find("tbody")
    if not tbody:
        print("  WARNING: No tbody found in stats table.")
        return None

    rows = tbody.find_all("tr")
    if not rows:
        return None

    # FBRef rows are chronological; the last row is the most recent season
    last_row = rows[-1]

    def safe_get_stat(row, stat_name: str) -> int:
        cell = row.find("td", {"data-stat": stat_name})
        if cell and cell.text.strip():
            try:
                return int(cell.text.strip().replace(",", ""))
            except ValueError:
                return 0
        return 0

    return {
        "stats_matches": safe_get_stat(last_row, "games"),
        "stats_minutes": safe_get_stat(last_row, "minutes"),
        "stats_goals": safe_get_stat(last_row, "goals"),
        "stats_assists": safe_get_stat(last_row, "assists"),
    }


def main():
    players = fetch_players()
    if not players:
        print("No players with an FBref URL found. Exiting.")
        return

    print(f"Found {len(players)} player(s) to scrape.\n")
    updated, failed = 0, 0

    # Resolve absolute path for the persistent profile directory.
    # A persistent user data dir gives Chrome a "lived-in" profile, which
    # Cloudflare treats as more human-like than a fresh ephemeral context.
    user_data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scraper_user_data")

    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir,
            headless=False,
            channel="chrome",
            # Strip the flag that explicitly announces Chrome is under automation
            ignore_default_args=["--enable-automation"],
            args=["--disable-blink-features=AutomationControlled"],
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()
        # Apply stealth patches before any navigation
        Stealth(chrome_runtime=True).apply_stealth_sync(page)
        print("Browser window opened (Chrome, persistent context, automation flags disabled).\n")

        try:
            for i, player in enumerate(players, start=1):
                player_id = player["id"]
                fbref_url = player["fbref_url"]
                print(f"[{i}/{len(players)}] Player {player_id}")

                html = fetch_html(page, fbref_url)
                if html:
                    stats = extract_player_stats(html)
                    if stats:
                        update_player_stats(player_id, stats)
                        updated += 1
                    else:
                        failed += 1
                        # Print a raw snippet so we can see if Cloudflare is
                        # still blocking or if it's a parsing issue.
                        print(f"  DEBUG HTML snippet:\n{html[:800]}\n")
                else:
                    failed += 1

                if i < len(players):
                    print(f"  Sleeping {RATE_LIMIT_SECONDS}s (rate limit)...")
                    time.sleep(RATE_LIMIT_SECONDS)

        finally:
            # launch_persistent_context returns a context directly — close it, not a browser
            context.close()
            print("\nBrowser closed.")

    print(f"\nScraping complete. Updated: {updated} | Failed/Skipped: {failed}")


if __name__ == "__main__":
    main()
