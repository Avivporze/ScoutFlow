"""
Test script: verify that a browser-copied cf_clearance cookie bypasses FBref's 403.

Usage:
    python test_request.py

When the cookie expires you'll get a 403 again — that's expected.
"""
from curl_cffi import requests

# ---------------------------------------------------------------------------
# Paste the full cookie string from "Copy as cURL" here.
# The critical values are cf_clearance and __cf_bm.
# ---------------------------------------------------------------------------
COOKIE_STRING = (
    # Paste your cookie string from "Copy as cURL" here.
    # NEVER commit real cookie values to git.
    ""
)

# Exact headers from "Copy as cURL" — order and values matter for Cloudflare.
# User-Agent is Safari, so we impersonate safari to match the TLS fingerprint
# that was used when cf_clearance was originally issued.
HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/26.3 Safari/605.1.15"
    ),
    "Cookie": COOKIE_STRING,
}

TEST_URL = "https://fbref.com/en/"

def main():
    print(f"Sending request to {TEST_URL}")
    print(f"Impersonating: safari17_0 (to match cf_clearance TLS fingerprint)")
    print("-" * 60)

    response = requests.get(
        TEST_URL,
        headers=HEADERS,
        impersonate="safari17_0",  # must match the browser that earned cf_clearance
    )

    print(f"Status code: {response.status_code}")
    print(f"Response size: {len(response.text)} chars")

    if response.status_code == 200:
        print("\nSUCCESS — Cloudflare bypassed with copied cookies.")
        # Quick sanity check: FBref homepage should contain this string
        if "Sports Reference" in response.text or "fbref" in response.text.lower():
            print("Content check PASSED — FBref page content confirmed.")
        else:
            print("Content check WARNING — got 200 but page content looks unexpected.")
            print("First 500 chars:", response.text[:500])
    elif response.status_code == 403:
        print("\nFAILED — Still getting 403.")
        print("Possible causes:")
        print("  1. cf_clearance or __cf_bm cookie has expired (most likely)")
        print("  2. TLS impersonation mismatch — try impersonate='safari15_5' or 'chrome124'")
        print("  3. Cloudflare has re-fingerprinted the session")
    else:
        print(f"\nUnexpected status: {response.status_code}")
        print("First 500 chars:", response.text[:500])

if __name__ == "__main__":
    main()
