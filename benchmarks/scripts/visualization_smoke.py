import json
import subprocess
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
AXE = (ROOT / "node_modules" / "axe-core" / "axe.min.js").read_text(encoding="utf-8")

with tempfile.TemporaryDirectory(prefix="facet-visual-") as data_directory:
    process = subprocess.Popen(["node", str(ROOT / "packages/cli/dist/index.js"), "open", str(ROOT / "examples/world-class-decision.fi1.json"), "--no-browser", "--data-dir", data_directory], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        startup = json.loads(process.stdout.readline())
        result = {"viewports": [], "violations": [], "consoleErrors": []}
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=str(CHROME))
            for width, height in [(375, 812), (768, 1024), (1440, 900)]:
                page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce")
                page.on("console", lambda message: result["consoleErrors"].append(message.text) if message.type == "error" else None)
                page.goto(startup["url"]); page.wait_for_load_state("networkidle")
                header_geometry = page.locator(".app-bar").evaluate("header => { const h=header.getBoundingClientRect(); return {header:{left:h.left,right:h.right,top:h.top,bottom:h.bottom},children:[...header.children].filter(el => getComputedStyle(el).display !== 'none').map(el => { const a=el.getBoundingClientRect(); return {name:el.className,left:a.left,right:a.right,top:a.top,bottom:a.bottom}; })}; }")
                header_fits = all(item["left"] >= header_geometry["header"]["left"]-1 and item["right"] <= header_geometry["header"]["right"]+1 and item["top"] >= header_geometry["header"]["top"]-1 and item["bottom"] <= header_geometry["header"]["bottom"]+1 for item in header_geometry["children"])
                assert header_fits, {"viewport": f"{width}x{height}", "geometry": header_geometry}
                assert page.locator(".scorecard").count() == 1
                assert page.locator(".risk-matrix").count() == 1
                assert page.locator(".matrix-reading-guide").count() == 1
                assert page.locator(".matrix-zone").count() == 3
                assert page.locator(".matrix-priorities li").count() >= 1
                assert page.locator(".matrix-x-ticks span").count() == 5
                assert page.locator(".matrix-y-ticks span").count() == 5
                assert page.locator(".dependency-map").count() == 1
                assert page.locator(".visual-table").count() == 2
                page.locator(".visual-table summary").first.focus(); page.keyboard.press("Enter")
                assert page.locator(".visual-table").first.evaluate("el => el.open")
                assert page.locator(".visual-table table").first.is_visible()
                hrefs = page.locator("#section-navigator nav a").evaluate_all("links => links.map(link => link.getAttribute('href'))")
                for href in hrefs:
                    if page.locator("body").evaluate("body => body.classList.contains('section-collapsed')"):
                        page.locator("header [data-toggle-sections]").click()
                    page.locator(f'#section-navigator nav a[href="{href}"]').click()
                    page.wait_for_function("hash => location.hash === hash", arg=href)
                    page.wait_for_function("selector => document.activeElement?.matches(selector)", arg=href)
                    assert page.locator(f'#section-navigator nav a[href="{href}"]').get_attribute("aria-current") == "location"
                    assert page.locator(href).evaluate("node => node === document.activeElement")
                    target_box = page.locator(href).bounding_box()
                    assert target_box and target_box["y"] >= page.locator(".app-bar").bounding_box()["height"]
                if not page.locator("#review-panel").is_visible():
                    page.locator(".feedback-toggle").click()
                panel_box = page.locator("#review-panel").bounding_box()
                assert panel_box and panel_box["width"] <= width
                page.locator("#review-panel .close-review").click()
                overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
                assert not overflow
                page.evaluate(AXE)
                axe = page.evaluate("axe.run(document)")
                result["violations"].extend([{"id": item["id"], "impact": item.get("impact"), "nodes": [node.get("target") for node in item.get("nodes", [])]} for item in axe["violations"]])
                result["viewports"].append({"viewport": f"{width}x{height}", "horizontalOverflow": overflow})
                page.close()
            browser.close()
        assert not result["violations"], result["violations"]
        assert not result["consoleErrors"], result["consoleErrors"]
        result["passed"] = True
        print(json.dumps(result, indent=2))
    finally:
        process.terminate(); process.wait(timeout=5)
