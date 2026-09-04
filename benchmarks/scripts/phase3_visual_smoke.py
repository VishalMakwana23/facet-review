import json
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
RUN_ID = "phase3-" + datetime.now(timezone.utc).isoformat().replace(":", "-")
OUTPUT = ROOT / "benchmarks" / "results" / RUN_ID
OUTPUT.mkdir(parents=True)
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")

with tempfile.TemporaryDirectory(prefix="facet-phase3-ui-") as data_directory:
    process = subprocess.Popen(
        [
            "node",
            str(ROOT / "packages" / "cli" / "dist" / "index.js"),
            "open",
            str(ROOT / "examples" / "phase3-demo.facet.json"),
            "--no-browser",
            "--data-dir",
            data_directory,
        ],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        startup = json.loads(process.stdout.readline())
        errors = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=str(CHROME))
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(startup["url"])
            page.wait_for_load_state("networkidle")

            first_node = page.locator('[data-node-id="summary"]')
            first_node.focus()
            page.keyboard.press("Enter")
            assert "selected" in (first_node.get_attribute("class") or "")
            page.locator("#comment").fill("Keep the success threshold visible in the final release.")
            page.locator("#save-comment").click()
            saved_comment = page.get_by_text("Keep the success threshold visible in the final release.", exact=True)
            saved_comment.wait_for(state="visible")
            assert saved_comment.count() == 1

            page.get_by_role("button", name="Decide").click()
            page.locator('[data-decision-id="approval"] input[value="Revise"]').check()
            page.once("dialog", lambda dialog: dialog.accept())
            page.locator('[data-decision-id="approval"] button').click()
            page.wait_for_timeout(300)
            page.reload()
            page.wait_for_load_state("networkidle")
            assert page.locator(".decision-inbox").get_by_text("Revise", exact=True).count() == 1

            page.locator("[data-resolve-comment]").click()
            page.locator(".comment.resolved").wait_for(state="visible")
            assert page.locator(".comment.resolved").count() == 1
            assert not errors
            page.evaluate("scrollTo(0, 0)")
            page.screenshot(path=str(OUTPUT / "desktop-review.png"), full_page=True)

            mobile = browser.new_page(viewport={"width": 375, "height": 812})
            mobile.goto(startup["url"])
            mobile.wait_for_load_state("networkidle")
            dimensions = mobile.evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
            assert dimensions["scroll"] <= dimensions["client"]
            mobile.screenshot(path=str(OUTPUT / "mobile-review.png"), full_page=True)
            mobile.close()
            page.close()
            browser.close()

        result = {
            "runId": RUN_ID,
            "sessionId": startup["sessionId"],
            "keyboardSelection": True,
            "commentLifecycle": "created and resolved",
            "typedDecision": "Revise",
            "desktopViewport": "1440x900",
            "mobileViewport": "375x812",
            "mobileHorizontalOverflow": False,
            "consoleErrors": errors,
            "passed": True,
        }
        (OUTPUT / "result.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, indent=2))
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
