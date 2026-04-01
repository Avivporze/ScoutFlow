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
    "_ga_80FRT7VJ60=GS2.1.s1775000069$o4$g0$t1775000130$j60$l0$h0; "
    "_ga_T897NZ0GWZ=GS2.1.s1775000069$o4$g0$t1775000130$j60$l0$h0; "
    "__hssc=218152582.1.1775000070271; "
    "__hstc=218152582.ba3b3f98dba94a9ce5c59ea5d53f73a6.1774920923972.1774981249296.1775000070271.3; "
    "hubspotutk=ba3b3f98dba94a9ce5c59ea5d53f73a6; "
    "_ga=GA1.1.82536294.1774920923; "
    "cf_clearance=NN61J4JxWZMM6b3IxsSEnUG4YKKBLvXHmVe6g3WN5eE-1775000067-1.2.1.1-x4u825pgmtuRiZkdwTeiIA9uhw.sql7WEheuFt2qcYzNLT_A8wIJQGkUf87dqHvrS7iGlLa14xNqyuLXXlNclCN.4SDkV.a0PmfI_jPQp1z2IGjBBvwe8xxwQlkCfiWKAh1JXQEl7Xf.NXF43dzKlFga7qyxjgZ_qzR6eh5E0wTsYOfkTnlsk__Sg8MuaG31KpPsNzQnQEB8RpjMZmxsijS9oeU9GLZnU0qNS6EhhI0; "
    "__cf_bm=Oh4cn6mhxk0ql18.TX7t6_9Vgu8UZ8u.m6IN9QnLCuU-1775000067.5712624-1.0.1.1-HVocZwHYL_k8uLu6.YVi.vunzZe5rDpGFIuLmitPkQt0M6VuZCfEyHewEj.ce0Rvs3VmCf2YZzUIzvbZfh6S7.P_u42p6O9rjrbfNmfdQXmLk_8zGqSj8OY2PLN17CJT"
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
