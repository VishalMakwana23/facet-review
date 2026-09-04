// Shared, dependency-free browser runtime. Artifact data never becomes executable code.
export const productBehavior = String.raw`
(() => {
  const runtime = window.__FACET_SESSION__;
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const comment = $('#comment'), panel = $('#review-panel'), palette = $('#command-palette');
  const mobile = matchMedia('(max-width:760px)');
  const writable = !!runtime.apiBase && runtime.state === 'open';
  let mode = writable ? 'review' : 'explore', nodeId = null, anchor = null;
  let pending = false, opener = null, panelOpener = null, updated = false, saveFailure = false;
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
    all('[data-node-id] input,[data-node-id] select,[data-node-id] button').forEach(el => {
      const decision = !!el.closest('[data-decision-id]');
      el.disabled = decision ? !writable || mode !== 'decide' || pending : mode !== 'explore';
    });
    comment.disabled = !writable || mode !== 'review';
    $('#save-comment').disabled = !writable || mode !== 'review' || pending;
    all('[data-resolve-comment]').forEach(b => b.disabled = !writable || mode !== 'review' || pending);
    all('[data-node-id]').forEach(n => n.tabIndex = mode === 'review' ? 0 : -1);
    if (notify) announce(mode[0].toUpperCase() + mode.slice(1) + ' mode. ' + (mode === 'review' ? 'Select text or a section to comment.' : mode === 'decide' ? 'Review an option before confirming.' : 'Artifact controls are available; feedback is read-only.'));
  }
  function selectNode(node, selected = {kind:'node'}) {
    nodeId = node.dataset.nodeId; anchor = selected;
    all('[data-node-id]').forEach(n => n.classList.toggle('selected', n === node));
    $('#selected-anchor').textContent = nodeId + (selected.kind === 'code' ? ' · lines ' + selected.lineStart + '–' + selected.lineEnd : selected.kind === 'text' ? ' · “' + selected.quote.slice(0,72) + '”' : ' · revision ' + runtime.revision);
    persistDraft();
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
    const open = panel.classList.contains('open');
    panel.inert = mobile.matches && !open;
    panel.setAttribute('aria-hidden', String(panel.inert));
    if (mobile.matches && open) { panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); }
    else { panel.setAttribute('role','complementary'); panel.removeAttribute('aria-modal'); }
    $('#artifact').inert = mobile.matches && open;
    $('header').inert = mobile.matches && open;
    all('[data-toggle-review]').forEach(b => b.setAttribute('aria-expanded',String(open)));
  }
  function togglePanel(force, focus = true) {
    const open = force ?? !panel.classList.contains('open');
    if (open) panelOpener = document.activeElement;
    panel.classList.toggle('open',open); syncPanel();
    if (focus) { if (open) (comment.disabled ? panel.querySelector('.close-review') : comment).focus(); else panelOpener?.focus?.(); }
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
    const button = event.target.closest('button');
    if (button) {
      if (button.disabled) return;
      if (button.hasAttribute('data-open-commands')) { openPalette(button); return; }
      if (button.hasAttribute('data-toggle-review')) { togglePanel(); return; }
      if (button.dataset.mode) { setMode(button.dataset.mode); return; }
      if (button.dataset.command) {
        event.preventDefault(); const command = button.dataset.command; palette.close();
        if (command === 'review' || command === 'decide') setMode(command);
        if (command === 'comment') { setMode('review'); togglePanel(true); }
        if (command === 'feedback') togglePanel(); return;
      }
      if (button.dataset.action === 'comment') {
        if (mode !== 'review' || !nodeId || !comment.value.trim()) { announce('Select a section and write a comment first.'); return; }
        try { await post('/comments',{nodeId,anchor,body:comment.value,anchorRevision:runtime.revision}); comment.value = ''; reloadAfterSave(); } catch {} return;
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
        try { await post('/decisions',{nodeId:field.dataset.decisionId,selection:choice.value,revision:runtime.revision}); reloadAfterSave(); } catch {} return;
      }
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
    if (event.key === 'Escape' && !palette.open && panel.classList.contains('open')) { togglePanel(false); return; }
    if (mobile.matches && panel.classList.contains('open') && !palette.open && event.key === 'Tab') {
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
  window.addEventListener('beforeunload',event => { if (comment.value.trim()) { event.preventDefault(); event.returnValue = ''; } });
  mobile.addEventListener('change',syncPanel);
  setMode(mode,false); syncPanel();
  connection(runtime.apiBase ? runtime.state === 'resolved' ? 'Resolved review — read-only' : 'Changes saved locally' : 'Read-only export — no changes are saved');
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
  if (runtime.apiBase) setTimeout(poll,2000);
})();
`;
