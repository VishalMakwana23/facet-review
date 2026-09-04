import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
LATEST = json.loads((ROOT / "benchmarks" / "results" / "latest.json").read_text(encoding="utf-8"))
RUN_DIR = ROOT / "benchmarks" / "results" / LATEST["runId"]
SCREENSHOTS = RUN_DIR / "screenshots"
SCREENSHOTS.mkdir(exist_ok=True)
REPRESENTATIVE = [
    "product-plan",
    "system-architecture",
    "vendor-comparison",
    "code-review",
    "analytics-dashboard",
]
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")

results = {"runId": LATEST["runId"], "browser": "system Chrome via Playwright", "artifacts": [], "passed": True}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=str(CHROME))
    for artifact_id in REPRESENTATIVE:
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        console_errors = []
        page_errors = []
        page.on("console", lambda message, bucket=console_errors: bucket.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error, bucket=page_errors: bucket.append(str(error)))
        page.goto((RUN_DIR / "artifacts" / artifact_id / "baseline.html").as_uri())
        page.wait_for_load_state("networkidle")

        title = page.locator("h1").inner_text()
        node_count = page.locator("[data-node-id]").count()
        capability_count = page.locator("[data-capability]").count()
        page.get_by_role("button", name="Decide").click()
        decide_active = "active" in (page.get_by_role("button", name="Decide").get_attribute("class") or "")
        page.get_by_role("button", name="Review").click()
        page.locator("[data-node-id]").first.click()
        selected = page.locator("[data-node-id].selected").count() == 1
        first_capability = page.locator("[data-capability]").first
        first_capability.click()
        capability_feedback = first_capability.get_attribute("data-capability") in page.locator("#status").inner_text()
        dimensions = page.evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
        no_horizontal_overflow = dimensions["scroll"] <= dimensions["client"]
        page.screenshot(path=str(SCREENSHOTS / f"{artifact_id}-desktop.png"), full_page=True)
        passed = all([title, node_count > 0, capability_count > 0, decide_active, selected, capability_feedback, no_horizontal_overflow, not console_errors, not page_errors])
        results["artifacts"].append({
            "id": artifact_id,
            "title": title,
            "nodeCount": node_count,
            "capabilityCount": capability_count,
            "decideMode": decide_active,
            "reviewSelection": selected,
            "capabilityFeedback": capability_feedback,
            "noHorizontalOverflow": no_horizontal_overflow,
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "passed": passed,
        })
        results["passed"] = results["passed"] and passed
        page.close()

    mobile = browser.new_page(viewport={"width": 375, "height": 812}, device_scale_factor=1)
    mobile.goto((RUN_DIR / "artifacts" / "product-plan" / "baseline.html").as_uri())
    mobile.wait_for_load_state("networkidle")
    mobile_dimensions = mobile.evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
    results["mobile"] = {
        "viewport": "375x812",
        "noHorizontalOverflow": mobile_dimensions["scroll"] <= mobile_dimensions["client"],
        "reviewPanelFollowsArtifact": mobile.locator("main > article + aside").count() == 1,
    }
    results["mobile"]["passed"] = all(results["mobile"].values())
    results["passed"] = results["passed"] and results["mobile"]["passed"]
    mobile.screenshot(path=str(SCREENSHOTS / "product-plan-mobile.png"), full_page=True)
    mobile.close()
    browser.close()

(RUN_DIR / "visual-smoke.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
print(json.dumps(results, indent=2))
raise SystemExit(0 if results["passed"] else 1)
