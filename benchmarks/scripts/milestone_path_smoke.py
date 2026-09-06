import json
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
AXE = (ROOT / "node_modules" / "axe-core" / "axe.min.js").read_text(encoding="utf-8")

with tempfile.TemporaryDirectory(prefix="facet-milestone-") as data_directory:
    process = subprocess.Popen(
        ["node", str(ROOT / "packages/cli/dist/index.js"), "open", str(ROOT / "examples/nextjs-ping-pong-plan.fi1.json"), "--no-browser", "--data-dir", data_directory],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        startup = json.loads(process.stdout.readline())
        result = {"viewports": [], "violations": [], "consoleErrors": []}
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=str(CHROME))
            for width, height in [(375, 812), (768, 1024), (1024, 900), (1440, 900)]:
                page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce")
                page.on("console", lambda message: result["consoleErrors"].append(message.text) if message.type == "error" else None)
                page.goto(startup["url"])
                page.wait_for_load_state("networkidle")

                assert page.locator('body[data-recipe="milestone-path"]').count() == 1
                assert page.locator(".artifact-overview").count() == 1
                assert page.locator(".artifact-overview dd").all_text_contents() == ["6 phases", "3", "1 required"]
                assert page.locator(".architecture-map > ol > li").count() == 4
                assert page.locator(".semantic-timeline > li").count() == 6
                assert page.locator(".risk-grid > .node-risk").count() == 3
                assert page.locator(".matrix-priorities > li").count() == 3
                assert page.locator(".checklist-list > li").count() == 10
                assert page.locator(".overview-action").is_visible()

                assert page.locator("body").evaluate("body => body.classList.contains('section-collapsed')")
                page.locator(".nav-toggle").click()
                assert page.locator("#section-navigator").get_attribute("aria-hidden") == "false"
                target = page.locator('#section-navigator a[href="#node-phased-implementation"]')
                target.click()
                page.wait_for_function("() => location.hash === '#node-phased-implementation'")
                assert page.locator("#node-phased-implementation").evaluate("node => node === document.activeElement")
                assert page.locator("body").evaluate("body => body.classList.contains('section-collapsed')")

                overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
                assert not overflow
                page.evaluate(AXE)
                axe = page.evaluate("axe.run(document)")
                result["violations"].extend(
                    {"viewport": f"{width}x{height}", "id": item["id"], "impact": item.get("impact")}
                    for item in axe["violations"]
                )
                result["viewports"].append({"viewport": f"{width}x{height}", "horizontalOverflow": overflow})
                page.close()
            browser.close()

        assert not result["violations"], result["violations"]
        assert not result["consoleErrors"], result["consoleErrors"]
        result["passed"] = True
        print(json.dumps(result, indent=2))
    finally:
        process.terminate()
        process.wait(timeout=5)
