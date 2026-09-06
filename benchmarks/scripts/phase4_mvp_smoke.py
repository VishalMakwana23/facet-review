import json
import statistics
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
RUN_ID = "phase4-" + datetime.now(timezone.utc).isoformat().replace(":", "-")
OUTPUT = ROOT / "benchmarks" / "results" / RUN_ID
OUTPUT.mkdir(parents=True)
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
AXE = (ROOT / "node_modules" / "axe-core" / "axe.min.js").read_text(encoding="utf-8")

with tempfile.TemporaryDirectory(prefix="facet-phase4-") as data_directory:
    process = subprocess.Popen(
        ["node", str(ROOT / "packages" / "cli" / "dist" / "index.js"), "open", str(ROOT / "examples" / "phase3-demo.facet.json"), "--no-browser", "--data-dir", data_directory],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        startup = json.loads(process.stdout.readline())
        origin = startup["url"].split("/s/")[0]
        console_errors = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=str(CHROME))
            context = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
            page = context.new_page()
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("pageerror", lambda error: console_errors.append(str(error)))
            page.goto(startup["url"])
            page.wait_for_load_state("networkidle")

            assert page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
            assert not page.locator('body').evaluate("body => body.classList.contains('section-collapsed')")
            page.locator('header [data-toggle-sections]').click()
            assert page.locator('body').evaluate("body => body.classList.contains('section-collapsed')")
            page.locator('header [data-toggle-sections]').click()
            page.locator('[data-review-width]').fill('420')
            assert page.locator('html').evaluate("html => getComputedStyle(html).getPropertyValue('--review-width').trim()") == '420px'
            for density in ['compact','presentation','comfortable']:
                page.locator(f'[data-density="{density}"]').click()
                assert page.locator('body').get_attribute('data-density') == density
            command_button = page.locator("[data-open-commands]")
            command_button.click()
            assert page.locator("#command-palette").evaluate("dialog => dialog.open")
            page.locator("#command-search").fill("decide")
            assert page.locator('[data-command="decide"]:visible').count() == 1
            page.keyboard.press("Escape")
            assert command_button.evaluate("button => button === document.activeElement")

            # Modes actually constrain mutations, including keyboard activation.
            assert page.locator('[data-decision-id] input').first.is_disabled()
            page.locator('[data-mode="explore"]').click()
            assert page.locator('#save-comment').is_disabled()
            page.locator('[data-code-action="wrap"]').click()
            assert page.locator('pre.wrap-code').count() == 1
            page.locator('[data-mode="decide"]').click()
            assert page.locator('#comment').is_disabled()
            page.locator('[data-decision-id] input').first.check()
            page.locator('.decision-context-fields > summary').click()
            page.locator('[data-decision-rationale]').fill('The evidence supports a reversible first step.')
            page.locator('[data-decision-confidence]').select_option('4')
            page.locator('[data-decision-owner]').fill('Review team')
            page.locator('[data-decision-due]').fill('2026-09-12')
            page.once('dialog', lambda dialog: dialog.dismiss())
            page.locator('[data-action="decision"]').click()
            assert page.locator('.decision-inbox .comment').count() == 0
            page.once('dialog', lambda dialog: dialog.accept())
            page.locator('[data-action="decision"]').click()
            page.locator('.decision-inbox .comment').wait_for()
            assert '4/5' in page.locator('.decision-inbox').inner_text()
            assert 'Review team' in page.locator('.decision-inbox').inner_text()
            page.locator('[data-mode="review"]').click()

            page.evaluate("""() => {
              const text = document.querySelector('[data-node-id="summary"] p').firstChild;
              const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, 20);
              const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
              text.parentElement.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
            }""")
            text_anchor_label = page.locator("#selected-anchor").inner_text()
            assert "Facet keeps" in text_anchor_label, text_anchor_label
            page.locator("#comment").fill("Keep this promise measurable and visible.")
            page.locator("#save-comment").click()
            page.get_by_text("Keep this promise measurable and visible.", exact=True).wait_for()
            assert page.locator("#feedback-inbox blockquote").count() == 1

            page.evaluate("""() => {
              const text = document.querySelector('[data-node-id="example-code"] code').firstChild;
              const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, 35);
              const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
              text.parentElement.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
            }""")
            assert "lines" in page.locator("#selected-anchor").inner_text()
            page.locator("#comment").fill("Confirm the error path for this call.")
            page.locator("#save-comment").click()
            page.get_by_text("Confirm the error path for this call.", exact=True).wait_for()

            patch = ["fp1", "phase3-demo", 0, 1, [["t", "summary", "Updated promise: the review loop stays local with a measurable success threshold."]]]
            status = page.evaluate("""async ({url,patch}) => (await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(patch)})).status""", {"url": f"{origin}/api/s/{startup['sessionId']}/patch", "patch": patch})
            assert status == 200
            page.reload()
            page.wait_for_load_state("networkidle")
            assert page.locator(".change-summary").count() == 1
            page.locator(".change-summary > summary").click()
            change_text = page.locator(".change-summary").inner_text()
            assert "Revision 1" in change_text, change_text
            assert "before / after" in change_text
            assert "Stale" in page.locator("#feedback-inbox").inner_text()
            assert page.locator("#feedback-inbox blockquote").count() == 2
            for lens in ['summary','evidence','risk','change','decision','story','board','focus','all']:
                page.locator(f'[data-lens="{lens}"]').click()
                assert page.locator('body').get_attribute('data-lens') == lens

            # Session-scoped drafts survive reload without silently rebinding old text.
            page.locator('#comment').fill('Recover this draft')
            page.once('dialog', lambda dialog: dialog.accept())
            page.reload()
            assert page.locator('#comment').input_value() == 'Recover this draft'
            page.locator('#comment').fill('')

            # Portable CLI exports contain feedback, cannot save, and make no network requests.
            bundle = Path(data_directory) / 'export'
            subprocess.run(['node',str(ROOT/'packages/cli/dist/index.js'),'export',startup['sessionId'],str(bundle),'--data-dir',data_directory],cwd=ROOT,check=True,capture_output=True,text=True)
            export_page = context.new_page()
            export_requests = []
            export_page.on('request',lambda request: export_requests.append(request.url) if request.url.startswith('http') else None)
            export_page.goto((bundle/'review.html').as_uri())
            export_page.wait_for_load_state('networkidle')
            assert export_page.locator('#save-comment').is_disabled()
            assert export_page.locator('[data-action="decision"]').is_disabled()
            assert export_page.locator('#feedback-inbox .comment').count() == 2
            assert 'Read-only export' in export_page.locator('#connection-status').inner_text()
            assert not export_requests
            export_page.close()

            failure_page = context.new_page()
            failure_page.goto(startup['url'])
            failure_page.wait_for_load_state('networkidle')
            failure_page.locator('[data-node-id="summary"]').click()
            failure_page.locator('#comment').fill('Preserve my unsaved feedback')
            failure_page.route('**/comments', lambda route: route.fulfill(status=503,content_type='application/json',body='{"error":"Test service unavailable"}'))
            failure_page.locator('#save-comment').click()
            failure_page.get_by_text('Save not confirmed — draft retained',exact=True).wait_for()
            assert failure_page.locator('#comment').input_value() == 'Preserve my unsaved feedback'
            assert failure_page.locator('#save-comment').is_enabled()
            assert 'Check the inbox' in failure_page.locator('#status').inner_text()
            failure_page.locator('#comment').fill('')
            failure_page.close()

            timings = page.evaluate("""async () => { const values=[]; const buttons=[...document.querySelectorAll('[data-mode]')]; for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);const start=performance.now();buttons[i%3].click();await new Promise(requestAnimationFrame);values.push(performance.now()-start)} return values }""")
            sorted_timings = sorted(timings)
            p95_interaction = sorted_timings[int((len(sorted_timings) - 1) * 0.95)]
            interactive_ms = page.evaluate("performance.getEntriesByType('navigation')[0].domInteractive")

            page.evaluate(AXE)
            accessibility = page.evaluate("axe.run(document, {resultTypes:['violations']})")
            critical = [item for item in accessibility["violations"] if item.get("impact") == "critical"]
            assert not critical, json.dumps(critical)
            assert not accessibility["violations"], json.dumps(accessibility["violations"])
            assert p95_interaction < 100
            assert not console_errors, console_errors
            page.evaluate("scrollTo(0,0)")
            page.screenshot(path=str(OUTPUT / "desktop-mvp.png"), full_page=True)

            responsive = []
            for width, height in [(375, 812), (812, 375), (768, 1024), (1024, 768), (1440, 900)]:
                viewport = browser.new_page(viewport={"width": width, "height": height})
                viewport.goto(startup["url"])
                viewport.wait_for_load_state("networkidle")
                dimensions = viewport.evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
                assert dimensions["scroll"] <= dimensions["client"]
                if width <= 760:
                    assert viewport.locator("#review-panel").evaluate("panel => panel.inert")
                    viewport.locator("[data-toggle-review]").first.click()
                    assert "open" in (viewport.locator("#review-panel").get_attribute("class") or "")
                    assert viewport.locator("#artifact").evaluate("el => el.inert")
                    viewport.keyboard.press("Escape")
                    assert viewport.locator("[data-toggle-review]").first.evaluate("el => el === document.activeElement")
                    viewport.locator("[data-toggle-review]").first.click()
                responsive.append({"viewport": f"{width}x{height}", "horizontalOverflow": False})
                if width == 375:
                    viewport.screenshot(path=str(OUTPUT / "mobile-mvp.png"), full_page=True)
                viewport.close()

            zoom = browser.new_page(viewport={"width": 720, "height": 450})
            zoom.goto(startup["url"])
            zoom.wait_for_load_state("networkidle")
            zoom_dimensions = zoom.evaluate("({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})")
            assert zoom_dimensions["scroll"] <= zoom_dimensions["client"]
            zoom.close()
            context.close()
            browser.close()

        result = {
            "runId": RUN_ID,
            "commandPalette": "keyboard-operable with focus restoration",
            "anchors": ["text", "code"],
            "semanticDiff": True,
            "modeIsolationAndDecisionConfirmation": True,
            "draftRecovery": True,
            "readOnlyExport": True,
            "failedSaveRetainsDraft": True,
            "responsive": responsive,
            "reducedMotion": True,
            "effective200PercentZoomViewport": "720x450",
            "interactiveReadyMs": round(interactive_ms, 2),
            "p95ModeInteractionMs": round(p95_interaction, 3),
            "accessibilityViolations": [{"id": item["id"], "impact": item.get("impact"), "nodes": [{"target": node["target"], "summary": node["failureSummary"]} for node in item["nodes"]]} for item in accessibility["violations"]],
            "criticalAccessibilityViolations": len(critical),
            "consoleErrors": console_errors,
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
