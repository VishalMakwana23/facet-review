// Shared, dependency-free browser runtime. Artifact data never becomes executable code.
export const productBehavior = String.raw`
(() => {
  const runtime = window.__FACET_SESSION__;
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const comment = $('#comment'), panel = $('#review-panel'), palette = $('#command-palette'), agentStatus = $('#agent-status');
  const mobile = matchMedia('(max-width:760px)');
  // Navigation is always on demand so the artifact keeps the full reading width.
  const overlayNav = matchMedia('(min-width:0px)');
  const overlayReview = matchMedia('(min-width:761px) and (max-width:1180px)');
  const narrow = matchMedia('(max-width:1320px)');
  const writable = !!runtime.apiBase && runtime.state === 'open';
  let mode = writable ? 'review' : 'explore', nodeId = null, anchor = null, replyParentId = null;
  let pending = false, opener = null, panelOpener = null, sectionOpener = null, updated = false, saveFailure = false, agentListening = null;
  let pinnedNavId = null, pinGraceUntil = 0, spyFrame = 0;
  const draftKey = 'facet-draft:' + runtime.apiBase;
  const announce = text => { $('#status').textContent = text; $('#status').style.display = 'block'; };
  const connection = (text, error = false) => { $('#connection-status').textContent = text; $('#connection-status').classList.toggle('offline', error); };
  function persistDraft() {
    if (!writable) return;
    try { sessionStorage.setItem(draftKey, JSON.stringify({body:comment.value, nodeId, anchor, revision:runtime.revision})); } catch { /* Storage may be disabled. Keep the in-memory draft. */ }
  }
  function setMode(next, notify = true) {
    mode = next;
    document.body.dataset.interactionMode = mode;
    all('[data-mode]').forEach(b => { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
    all('[data-node-id] input,[data-node-id] select,[data-node-id] button,[data-node-id] textarea').forEach(el => {
      const decision = !!el.closest('[data-decision-id]');
      el.disabled = decision ? !writable || mode !== 'decide' || pending : mode !== 'explore';
    });
    comment.disabled = !writable || mode !== 'review';
    $('#save-comment').disabled = !writable || mode !== 'review' || pending;
    $('#send-feedback').disabled = !writable || mode !== 'review' || pending;
    all('[data-resolve-comment]').forEach(b => b.disabled = !writable || mode !== 'review' || pending);
    all('[data-reply-comment]').forEach(b => b.disabled = !writable || mode !== 'review' || pending);
    all('[data-node-id]').forEach(n => n.tabIndex = mode === 'review' ? 0 : -1);
    if (notify) announce(mode[0].toUpperCase() + mode.slice(1) + ' mode. ' + (mode === 'review' ? 'Select text or a section to comment.' : mode === 'decide' ? 'Review an option before confirming.' : 'Artifact controls are available; feedback is read-only.'));
  }
  function selectNode(node, selected = {kind:'node'}) {
    nodeId = node.dataset.nodeId; anchor = selected;
    all('[data-node-id]').forEach(n => n.classList.toggle('selected', n === node));
    $('#selected-anchor').textContent = nodeId + (selected.kind === 'code' ? ' · lines ' + selected.lineStart + '–' + selected.lineEnd : selected.kind === 'text' ? ' · “' + selected.quote.slice(0,72) + '”' : ' · revision ' + runtime.revision);
    persistDraft();
  }
  function selectCurrentSection() {
    if (nodeId || mode !== 'review' || !writable) return;
    const fromHash = location.hash.startsWith('#node-') ? $(location.hash) : null;
    const currentLink = $('#section-navigator a[aria-current="location"]');
    const fromNav = currentLink ? $(currentLink.getAttribute('href')) : null;
    const visible = all('[data-node-id]').find(node => { const rect = node.getBoundingClientRect(); return rect.bottom > parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-height')) && rect.top < innerHeight; });
    selectNode(fromHash || fromNav || visible || all('[data-node-id]')[0]);
  }
  function captureSelection() {
    if (mode !== 'review' || !writable) return false;
    const selection = getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    const parent = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const field = parent.closest('[data-anchor-text],code');
    if (!field || !field.contains(range.endContainer)) return false;
    const node = field.closest('[data-node-id]');
    const before = range.cloneRange(); before.selectNodeContents(field); before.setEnd(range.startContainer,range.startOffset);
    const start = before.toString().length, end = start + range.toString().length;
    let selected;
    if (field.tagName === 'CODE') {
      const text = field.textContent, lines = text.split('\n');
      const lineStart = text.slice(0,start).split('\n').length;
      const lineEnd = text.slice(0,Math.max(start,end-1)).split('\n').length;
      selected = {kind:'code',lineStart,lineEnd,quote:lines.slice(lineStart-1,lineEnd).join('\n')};
    } else selected = {kind:'text',start,end,quote:range.toString()};
    if (!selected.quote.trim() || selected.quote.length > 2000) { announce('Select between 1 and 2000 characters, or select the whole section.'); return true; }
    selectNode(node,selected); return true;
  }
  function syncPanel() {
    const open = mobile.matches ? panel.classList.contains('open') : !document.body.classList.contains('review-collapsed');
    const modal = mobile.matches || overlayReview.matches;
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(panel.inert));
    if (modal && open) { panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); }
    else { panel.setAttribute('role','complementary'); panel.removeAttribute('aria-modal'); }
    $('#artifact').inert = modal && open;
    $('header').inert = modal && open;
    all('[data-toggle-review]').forEach(b => b.setAttribute('aria-expanded',String(open)));
  }
  function togglePanel(force, focus = true) {
    const current = mobile.matches ? panel.classList.contains('open') : !document.body.classList.contains('review-collapsed');
    const open = force ?? !current;
    if (open) panelOpener = document.activeElement;
    if (open && overlayReview.matches) toggleSections(false,false);
    if (mobile.matches) panel.classList.toggle('open',open);
    else document.body.classList.toggle('review-collapsed',!open);
    syncPanel();
    if (focus) { if (open) (comment.disabled ? panel.querySelector('.close-review') : comment).focus(); else panelOpener?.focus?.(); }
  }
  function toggleSections(force, persist = true) {
    const open = force ?? document.body.classList.contains('section-collapsed');
    if (open && overlayReview.matches) document.body.classList.add('review-collapsed');
    document.body.classList.toggle('section-collapsed',!open);
    all('[data-toggle-sections]').forEach(button => button.setAttribute('aria-expanded',String(open)));
    if (overlayNav.matches) {
      $('#section-navigator').inert = !open;
      $('#section-navigator').setAttribute('aria-hidden',String(!open));
      if (open) $('#section-navigator nav a')?.focus();
    }
    if (persist) try { localStorage.setItem('facet-section-collapsed',String(!open)); } catch {}
  }
  function markCurrentNav(id) {
    all('#section-navigator a').forEach(link => {
      const current = link.getAttribute('href') === '#' + id;
      link.classList.toggle('active',current);
      if (current) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
    });
  }
  function scheduleScrollSpy() {
    if (spyFrame) return;
    spyFrame = requestAnimationFrame(() => {
      spyFrame = 0;
      const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-height')) + 18;
      if (pinnedNavId) {
        const pinned = document.getElementById(pinnedNavId), rect = pinned?.getBoundingClientRect();
        if (performance.now() < pinGraceUntil || (rect && rect.bottom > offset && rect.top < innerHeight - 24)) { markCurrentNav(pinnedNavId); return; }
        pinnedNavId = null;
      }
      const candidates = all('[data-node-id]').filter(node => {
        const rect = node.getBoundingClientRect();
        return node.getClientRects().length && rect.bottom > offset && rect.top < innerHeight;
      }).map(node => ({node,rect:node.getBoundingClientRect()})).sort((a,b) => Math.abs(a.rect.top-offset)-Math.abs(b.rect.top-offset) || a.rect.left-b.rect.left);
      if (candidates[0]) markCurrentNav(candidates[0].node.id);
    });
  }
  function setDensity(density, notify = true) {
    document.body.dataset.density = density;
    all('button[data-density]').forEach(button => { button.classList.toggle('active',button.dataset.density === density); button.setAttribute('aria-pressed',String(button.dataset.density === density)); });
    try { localStorage.setItem('facet-density',density); } catch {}
    if (notify) announce(density[0].toUpperCase() + density.slice(1) + ' density.');
  }
  async function post(path,payload) {
    if (!writable || pending) throw new Error('This review is read-only or already saving');
    pending = true; setMode(mode,false); connection('Saving locally…');
    try {
      const response = await fetch(runtime.apiBase + path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed');
      saveFailure = false; connection('Changes saved locally'); return result;
    } catch (error) { saveFailure = true; connection('Save not confirmed — draft retained',true); announce(error.message + '. Check the inbox before retrying.'); throw error; }
    finally { pending = false; setMode(mode,false); }
  }
  function reloadAfterSave() {
    persistDraft(); location.reload();
  }
  function openPalette(button) {
    if (palette.open) return;
    opener = button; palette.showModal(); $('#command-search').value = '';
    all('[data-command]').forEach(b => b.hidden = false); $('#command-search').focus();
  }
  document.addEventListener('click', async event => {
    const artifactMenu = $('.artifact-menu');
    if (artifactMenu?.open && !event.target.closest('.artifact-menu')) artifactMenu.open = false;
    const exportLink = event.target.closest('.artifact-menu a[href$="/export/html"]');
    if (exportLink) { announce('Preparing standalone HTML export…'); artifactMenu.open = false; }
    if (overlayReview.matches && !document.body.classList.contains('review-collapsed') && !event.target.closest('#review-panel,[data-toggle-review]')) { togglePanel(false); return; }
    if (overlayNav.matches && !document.body.classList.contains('section-collapsed') && !event.target.closest('#section-navigator,[data-toggle-sections]')) { toggleSections(false); return; }
    const button = event.target.closest('button');
    if (button) {
      if (button.disabled) return;
      if (button.hasAttribute('data-open-commands')) { openPalette(button); return; }
      if (button.hasAttribute('data-toggle-review')) { togglePanel(); return; }
      if (button.hasAttribute('data-toggle-sections')) { sectionOpener = button; toggleSections(); return; }
      if (button.dataset.mode) { setMode(button.dataset.mode); return; }
      if (button.dataset.command) {
        event.preventDefault(); const command = button.dataset.command; palette.close();
        if (command === 'review' || command === 'decide') setMode(command);
        if (command === 'comment') { setMode('review'); togglePanel(true); }
        if (command === 'feedback') togglePanel(); return;
      }
      if (button.dataset.action === 'comment') {
        if (mode !== 'review' || !nodeId || !comment.value.trim()) { announce('Select a section and write a comment first.'); return; }
        try { await post('/comments',{nodeId,anchor,body:comment.value,anchorRevision:runtime.revision,...(replyParentId ? {parentId:replyParentId} : {})}); comment.value = ''; replyParentId = null; reloadAfterSave(); } catch {} return;
      }
      if (button.dataset.action === 'send') {
        if (mode !== 'review') { announce('Enter Review mode before sending feedback.'); return; }
        const body = comment.value.trim();
        if (body && !nodeId) { announce('Select a section or text before sending this feedback.'); return; }
        if (!body && !runtime.pendingFeedback) { announce('Write feedback or save at least one comment before sending.'); return; }
        try {
          if (body) await post('/comments',{nodeId,anchor,body,anchorRevision:runtime.revision,...(replyParentId ? {parentId:replyParentId} : {})});
          await post('/submit',{end:false});
          comment.value = ''; replyParentId = null;
          try { sessionStorage.removeItem(draftKey); sessionStorage.setItem(draftKey + ':flash','Feedback sent to agent'); } catch {}
          reloadAfterSave();
        } catch {} return;
      }
      if (button.dataset.replyComment) {
        const node = all('[data-node-id]').find(item => item.dataset.nodeId === button.dataset.replyNode);
        if (!node) return;
        setMode('review',false); selectNode(node); replyParentId = button.dataset.replyComment;
        $('#selected-anchor').textContent = 'Replying in ' + button.dataset.replyNode;
        comment.placeholder = 'Write a reply…'; comment.focus(); announce('Reply target selected.'); return;
      }
      if (button.dataset.resolveComment) {
        if (mode !== 'review') return;
        try { await post('/comments/' + button.dataset.resolveComment + '/resolve',{}); reloadAfterSave(); } catch {} return;
      }
      if (button.dataset.action === 'decision') {
        if (mode !== 'decide') return;
        const field = button.closest('[data-decision-id]'), choice = field.querySelector('input:checked');
        if (!choice) { announce('Choose an option first.'); return; }
        // Native confirmation gives keyboard users the same explicit review step.
        if (!confirm('Record “' + choice.value + '” for ' + field.dataset.decisionId + ' at revision ' + runtime.revision + '?')) return;
        const confidenceValue = field.querySelector('[data-decision-confidence]')?.value;
        const payload = {nodeId:field.dataset.decisionId,selection:choice.value,revision:runtime.revision,rationale:field.querySelector('[data-decision-rationale]')?.value || '',owner:field.querySelector('[data-decision-owner]')?.value || '',dueDate:field.querySelector('[data-decision-due]')?.value || '',...(confidenceValue ? {confidence:Number(confidenceValue)} : {})};
        try { await post('/decisions',payload); reloadAfterSave(); } catch {} return;
      }
      if (button.dataset.feedbackFilter) {
        const filter = button.dataset.feedbackFilter;
        all('[data-feedback-filter]').forEach(item => item.classList.toggle('active',item === button));
        all('#feedback-inbox > .comment').forEach(item => item.hidden = filter !== 'all' && item.dataset.commentStatus !== filter);
        announce('Showing ' + filter + ' comments.'); return;
      }
      if (button.dataset.lens) {
        const lens = button.dataset.lens;
        if (lens === 'focus' && !nodeId) selectNode(all('[data-node-id]')[0]);
        document.body.dataset.lens = lens;
        all('button[data-lens]').forEach(item => { item.classList.toggle('active',item === button); item.setAttribute('aria-pressed',String(item === button)); });
        announce(lens[0].toUpperCase() + lens.slice(1) + ' lens. No artifact regeneration used.'); return;
      }
      if (button.dataset.density) { setDensity(button.dataset.density); return; }
      if (button.dataset.codeAction) {
        const pre = button.parentElement.nextElementSibling;
        if (button.dataset.codeAction === 'wrap') { pre.classList.toggle('wrap-code'); button.setAttribute('aria-pressed',String(pre.classList.contains('wrap-code'))); }
        else try { await navigator.clipboard.writeText(pre.textContent); announce('Code copied.'); } catch { announce('Clipboard unavailable. Select the code and use your copy shortcut.'); }
        return;
      }
    }
    const node = event.target.closest('[data-node-id]');
    if (node && mode === 'review' && !captureSelection()) selectNode(node);
  });
  document.addEventListener('mouseup',captureSelection);
  document.addEventListener('keyup',event => { if (event.shiftKey) captureSelection(); });
  document.addEventListener('keydown',event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(document.activeElement); return; }
    if (event.key === 'Escape' && $('.artifact-menu')?.open) { $('.artifact-menu').open = false; $('.artifact-menu summary')?.focus(); return; }
    if (event.key === 'Escape' && !palette.open && ((mobile.matches && panel.classList.contains('open')) || (overlayReview.matches && !document.body.classList.contains('review-collapsed')))) { togglePanel(false); return; }
    if (event.key === 'Escape' && overlayNav.matches && !document.body.classList.contains('section-collapsed')) { toggleSections(false); sectionOpener?.focus?.(); return; }
    if ((mobile.matches || overlayReview.matches) && !panel.inert && !palette.open && event.key === 'Tab') {
      const items = [...panel.querySelectorAll('button:not(:disabled),textarea:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (mode === 'review' && event.target.matches('[data-node-id]') && ['Enter',' '].includes(event.key)) { event.preventDefault(); selectNode(event.target); }
  });
  $('#command-search').addEventListener('input',event => all('[data-command]').forEach(b => b.hidden = !b.textContent.toLowerCase().includes(event.target.value.toLowerCase())));
  palette.addEventListener('close',() => { if (!panel.classList.contains('open')) opener?.focus?.(); });
  comment.addEventListener('input',persistDraft);
  comment.addEventListener('focus',selectCurrentSection);
  $('#section-navigator').addEventListener('click',event => {
    const link = event.target.closest('a[href^="#node-"]');
    if (!link) return;
    const target = $(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    if (!target.getClientRects().length) {
      document.body.dataset.lens = 'all';
      all('button[data-lens]').forEach(button => { const active = button.dataset.lens === 'all'; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); });
    }
    pinnedNavId = target.id; pinGraceUntil = performance.now() + 900; markCurrentNav(target.id);
    history.pushState(null,'','#' + target.id);
    if (overlayNav.matches) toggleSections(false,false);
    requestAnimationFrame(() => { target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth',block:'start'}); target.focus({preventScroll:true}); });
    announce('Opened ' + (target.querySelector('h2')?.textContent || target.dataset.nodeId) + '.');
  });
  $('[data-review-width]').addEventListener('input',event => { const width = Math.max(300,Math.min(480,Number(event.target.value))); document.documentElement.style.setProperty('--review-width',width + 'px'); try { localStorage.setItem('facet-review-width',String(width)); } catch {} });
  window.addEventListener('beforeunload',event => { if (comment.value.trim()) { event.preventDefault(); event.returnValue = ''; } });
  mobile.addEventListener('change',() => { if (mobile.matches) panel.classList.remove('open'); syncPanel(); });
  overlayNav.addEventListener('change',() => {
    if (overlayNav.matches) toggleSections(false,false);
    else {
      let saved = null; try { saved = localStorage.getItem('facet-section-collapsed'); } catch {}
      document.body.classList.toggle('section-collapsed',saved === null ? narrow.matches : saved === 'true');
      $('#section-navigator').inert = false; $('#section-navigator').removeAttribute('aria-hidden');
      all('[data-toggle-sections]').forEach(button => button.setAttribute('aria-expanded',String(!document.body.classList.contains('section-collapsed'))));
    }
  });
  overlayReview.addEventListener('change',() => { document.body.classList.toggle('review-collapsed',overlayReview.matches); syncPanel(); });
  window.addEventListener('scroll',scheduleScrollSpy,{passive:true});
  window.addEventListener('resize',scheduleScrollSpy,{passive:true});
  let savedDensity = 'comfortable', savedWidth = '352', savedSections = null;
  try { savedDensity = localStorage.getItem('facet-density') || savedDensity; savedWidth = localStorage.getItem('facet-review-width') || savedWidth; savedSections = localStorage.getItem('facet-section-collapsed'); } catch {}
  if (!['comfortable','compact','presentation'].includes(savedDensity)) savedDensity = 'comfortable';
  setDensity(savedDensity,false); $('[data-review-width]').value = savedWidth; document.documentElement.style.setProperty('--review-width',Math.max(300,Math.min(480,Number(savedWidth) || 352)) + 'px');
  document.body.classList.toggle('section-collapsed',overlayNav.matches ? true : savedSections === null ? narrow.matches : savedSections === 'true');
  if (overlayReview.matches) document.body.classList.add('review-collapsed');
  if (overlayNav.matches) { $('#section-navigator').inert = document.body.classList.contains('section-collapsed'); $('#section-navigator').setAttribute('aria-hidden',String(document.body.classList.contains('section-collapsed'))); }
  all('[data-toggle-sections]').forEach(button => button.setAttribute('aria-expanded',String(!document.body.classList.contains('section-collapsed'))));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(scheduleScrollSpy,{rootMargin:'-12% 0px -70% 0px'});
    all('[data-node-id]').forEach(node => observer.observe(node));
  }
  if (location.hash.startsWith('#node-') && $(location.hash)) { pinnedNavId = location.hash.slice(1); pinGraceUntil = performance.now() + 600; }
  scheduleScrollSpy();
  setMode(mode,false); syncPanel();
  connection(runtime.apiBase ? runtime.state === 'resolved' ? 'Resolved review — read-only' : 'Changes saved locally' : 'Read-only export — no changes are saved');
  try { const flash = sessionStorage.getItem(draftKey + ':flash'); if (flash) { sessionStorage.removeItem(draftKey + ':flash'); announce(flash); } } catch {}
  if (writable) try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
    if (draft?.body) {
      comment.value = draft.body;
      if (draft.revision === runtime.revision) { const node = all('[data-node-id]').find(n => n.dataset.nodeId === draft.nodeId); if (node) selectNode(node,draft.anchor || {kind:'node'}); }
      else announce('Draft restored. Artifact changed: select a fresh anchor before saving.');
    }
  } catch {}
  // Schedule after completion: never overlap polling reads on a slow local store.
  async function poll() {
    try {
      const response = await fetch(runtime.apiBase);
      if (!response.ok) throw new Error('Local service unavailable');
      const current = await response.json();
      updated = current.sequence !== runtime.sequence || current.artifact.revision !== runtime.revision;
      if (!pending && !saveFailure) connection(updated ? 'Update available — reload after saving or copying your draft' : runtime.state === 'resolved' ? 'Resolved review — read-only' : 'Changes saved locally');
    } catch { if (!pending) connection('Local service unavailable — draft retained',true); }
    setTimeout(poll,2000);
  }
  async function pollAgentPresence() {
    try {
      const response = await fetch(runtime.apiBase + '/presence');
      if (!response.ok) throw new Error('Presence unavailable');
      const listening = !!(await response.json()).listening;
      if (agentListening !== listening) {
        agentListening = listening;
        agentStatus.classList.toggle('connected',listening);
        agentStatus.querySelector('strong').textContent = listening ? 'Agent is listening' : 'Agent is not listening';
        agentStatus.querySelector('small').textContent = listening ? 'Send feedback directly—no chat prompt needed.' : 'You can queue feedback; start facet poll to deliver it.';
      }
    } catch {
      agentStatus.classList.remove('connected');
      agentStatus.querySelector('strong').textContent = 'Agent connection unavailable';
      agentStatus.querySelector('small').textContent = 'Your draft remains stored locally.';
    }
    setTimeout(pollAgentPresence,2000);
  }
  if (runtime.apiBase) { setTimeout(poll,2000); pollAgentPresence(); }
  else agentStatus.hidden = true;
})();
`;
