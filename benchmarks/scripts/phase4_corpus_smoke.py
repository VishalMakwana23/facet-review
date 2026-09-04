"""All frozen artifacts: browser a11y, offline requests and next-frame mode latency.

Uses generated benchmark HTML, so this tests the actual shared renderer without
starting twenty local stores. Live persistence is tested in phase4_mvp_smoke.py.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
latest = json.loads((ROOT / 'benchmarks/results/latest.json').read_text())
source = ROOT / 'benchmarks/results' / latest['runId'] / 'artifacts'
run_id = 'phase4-corpus-' + datetime.now(timezone.utc).isoformat().replace(':','-')
output = ROOT / 'benchmarks/results' / run_id
output.mkdir()
axe = (ROOT / 'node_modules/axe-core/axe.min.js').read_text(encoding='utf-8')
rows = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    for path in sorted(source.glob('*/baseline.html')):
        page = browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
        errors, requests = [], []
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.on('request',lambda req: requests.append(req.url) if req.url.startswith('http') else None)
        page.goto(path.as_uri())
        page.wait_for_load_state('networkidle')
        timings = page.evaluate('''async () => {
          const values=[], buttons=[...document.querySelectorAll('button[data-mode]')];
          for(let i=0;i<30;i++) { await new Promise(requestAnimationFrame);const start=performance.now();buttons[i%3].click();await new Promise(requestAnimationFrame);values.push(performance.now()-start); }
          return values;
        }''')
        page.evaluate(axe)
        desktop = page.evaluate("axe.run(document,{resultTypes:['violations']})")['violations']
        page.set_viewport_size({'width':375,'height':812})
        assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth')
        page.locator('[data-toggle-review]').first.click()
        mobile = page.evaluate("axe.run(document,{resultTypes:['violations']})")['violations']
        violations=[{'id':v['id'],'impact':v.get('impact'),'targets':[n['target'] for n in v['nodes']]} for v in desktop+mobile]
        row={'artifact':path.parent.name,'nodeCount':page.locator('[data-node-id]').count(),'p95NextFrameMs':round(sorted(timings)[int(len(timings)*0.95)-1],2),'violations':violations,'errors':errors,'externalRequests':requests}
        rows.append(row)
        page.close()
    browser.close()
passed=len(rows)==20 and all(not r['violations'] and not r['errors'] and not r['externalRequests'] and r['p95NextFrameMs']<100 for r in rows)
result={'runId':run_id,'sourceRun':latest['runId'],'scope':'20 synthetic frozen artifacts; Chromium desktop and mobile; no CPU throttling','passed':passed,'rows':rows}
(output/'result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
assert passed, 'See saved per-artifact evidence for failures'
