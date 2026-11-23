'use strict';
'require view';
'require tools.terryclash_r8 as tc';

/* Primary: group/current selection; secondary: nodes and delay; tertiary: protocol.
 * Compact disclosure rows follow Verge; existing tc tokens, 8/12/16px spacing,
 * 3/2/1-column node grid, native details for keyboard and mobile use. */
return view.extend({
 handleSave: null, handleSaveApply: null, handleReset: null,
 render: function() {
  const mode = tc.select(['rule', 'global', 'direct'], 'rule');
  const groups = E('div', { class: 'tc-proxy-groups' });
  const progress = E('span', { class: 'tc-test-progress', role: 'status', 'aria-live': 'polite' });
  let proxies = {}, order = [], busy = false;
  const measured = new Map(), expanded = new Set(), sorts = new Map();
  try { JSON.parse(localStorage.getItem('terryclash.expanded') || '[]').forEach(n => expanded.add(n)); } catch (_) {}
  function remember() { try { localStorage.setItem('terryclash.expanded', JSON.stringify([...expanded])); } catch (_) {} }
  function latency(name, seen) {
   if (measured.has(name)) return measured.get(name);
   seen = seen || new Set(); if (seen.has(name)) return null; seen.add(name);
   const p = proxies[name] || {}, h = p.history || [];
   if (h.length) return h[h.length - 1].delay > 0 ? h[h.length - 1].delay : null;
   return p.now ? latency(p.now, seen) : undefined;
  }
  function delayLabel(value) { return value === null ? '超时' : value === undefined ? '未测试' : value + ' ms'; }
  function delayClass(value) { return value === null ? ' timeout' : value === undefined ? '' : value < 200 ? ' fast' : value < 500 ? ' medium' : ' slow'; }
  function action(label, fn, title) {
   const b = tc.button(label, fn); b.disabled = busy; if (title) b.title = title; return b;
  }
  function icon(group) {
   const fallback = E('span', { class: 'tc-group-icon tc-icon-fallback', 'aria-hidden': 'true' }, '★');
   if (!/^https?:\/\//i.test(group.icon || '')) return fallback;
   const holder = E('span', { class: 'tc-group-icon tc-icon-holder' }, [fallback]);
   const img = E('img', { class: 'tc-group-icon', src: group.icon, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
   img.style.visibility = 'hidden';
   img.addEventListener('load', () => { fallback.style.visibility = 'hidden'; img.style.visibility = 'visible'; }, { once: true });
   img.addEventListener('error', () => img.remove(), { once: true }); holder.append(img); return holder;
  }
  function draw() {
   const entries = Object.entries(proxies).filter(([, p]) => Array.isArray(p.all));
   entries.sort((a, b) => {
    const ai = order.indexOf(a[0]), bi = order.indexOf(b[0]);
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
   });
   groups.replaceChildren(...entries.map(([name, group]) => {
    const value = latency(group.now || name);
    const sorting = sorts.get(name) || 0;
    function headerAction(label, fn, title) {
     const b = action(label, fn, title);
     b.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); }); return b;
    }
    const summary = E('summary', { class: 'tc-group-summary' }, [icon(group),
     E('span', { class: 'tc-group-copy' }, [E('strong', { class: 'tc-group-name' }, name),
      E('span', { class: 'tc-group-meta' }, [E('span', { class: 'tc-protocol' }, group.type), E('span', { class: 'tc-group-current', title: group.now || '' }, group.now || '自动选择')])]),
     E('span', { class: 'tc-group-actions' }, [
      headerAction('测速', async () => test(group.all), '测试本组所有节点的延迟'),
      headerAction(sorting === 1 ? '延迟 ↑' : sorting === -1 ? '延迟 ↓' : '延迟排序', async () => { sorts.set(name, sorting === 0 ? 1 : sorting === 1 ? -1 : 0); draw(); }, '点击切换升序、降序、原始顺序')]),
     E('span', { class: 'tc-delay' + delayClass(value) }, delayLabel(value)),
     E('span', { class: 'tc-disclosure' }, [E('span', { class: 'tc-expand-label' }, '展开 ▾'), E('span', { class: 'tc-collapse-label' }, '收起 ▴')])]);
    const nodes = group.all.map((n, i) => ({ name: n, index: i, delay: latency(n) }));
    if (sorting) nodes.sort((a, b) => {
     const av = typeof a.delay === 'number', bv = typeof b.delay === 'number';
     if (av !== bv) return av ? -1 : 1;
     return (av ? (a.delay - b.delay) * sorting : 0) || a.index - b.index;
    });
    const grid = E('div', { class: 'tc-node-grid' }, nodes.map(item => {
     const node = proxies[item.name] || {}, selected = group.now === item.name;
     const choose = action('', async () => { await tc.call('select', name, item.name); await refresh(); }, '选择 ' + item.name);
     choose.className = 'tc-node-select'; choose.setAttribute('aria-pressed', String(selected));
     choose.append(E('span', { class: 'tc-node-name' }, [selected ? E('span', { class: 'tc-selected-mark', 'aria-label': '已选择' }, '✓ ') : '', item.name]),
      E('span', { class: 'tc-node-tags' }, [E('span', { class: 'tc-protocol' }, node.type || '策略组'), node.xudp ? E('span', { class: 'tc-protocol' }, 'XUDP') : '']));
     const delay = E('span', { class: 'tc-node-delay tc-delay' + delayClass(item.delay) }, delayLabel(item.delay));
     return E('div', { class: 'tc-node' + (selected ? ' selected' : ''), 'data-node': item.name }, [choose, delay]);
    }));
    const details = E('details', { class: 'tc-proxy-group', 'data-group': name }, [summary,
     E('div', { class: 'tc-group-body' }, [grid])]);
    details.open = expanded.has(name);
    details.addEventListener('toggle', () => { if (!details.isConnected) return; if (details.open) expanded.add(name); else expanded.delete(name); remember(); });
    return details;
   }));
   if (!entries.length) groups.appendChild(E('section', { class: 'tc-panel tc-empty' }, '当前配置没有代理策略组。'));
  }
  async function refresh() {
   const status = await tc.call('status'); mode.value = status.mode;
   if (!status.running) { groups.replaceChildren(E('section', { class: 'tc-panel tc-empty' }, 'Mihomo 未运行。请先在订阅页面启用配置。')); return; }
   const data = await tc.call('proxies'); proxies = data.proxies || {};
   try { order = (await tc.call('rules')).groups || []; } catch (_) { order = []; }
   draw();
  }
  async function test(names) {
   if (busy) return;
   const pending = [...new Set(names)].filter(n => !['REJECT', 'REJECT-DROP'].includes(n));
   busy = true; let done = 0, cursor = 0;
   const report = () => { progress.textContent = '测速中 ' + done + '/' + pending.length; draw(); };
   report();
   async function worker() {
    while (cursor < pending.length) {
     const name = pending[cursor++];
     try { const d = await tc.call('delay', name); measured.set(name, d.delay > 0 ? d.delay : null); }
     catch (_) { measured.set(name, null); }
     done++; report();
    }
   }
   try { await Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker)); }
   finally { busy = false; progress.textContent = '已完成 ' + done + ' 个延迟测试'; draw(); }
  }
  const content = E('div', { class: 'tc-proxies-page' }, [
   E('section', { class: 'tc-panel tc-proxy-controls' }, [E('div', { class: 'tc-row between' }, [E('h2', '代理组'),
    E('div', { class: 'tc-row' }, [mode, tc.button('应用模式', async () => { await tc.call('mode', mode.value); await refresh(); }),
     tc.button('测试所有节点', async () => test(Object.keys(proxies).filter(n => !proxies[n].all && !['DIRECT', 'REJECT'].includes(n))))])]), progress]), groups]);
  refresh().catch(tc.notice);
  const app = tc.layout('代理', '展开策略组，选择节点或测试并排序延迟。', content);
  app.classList.add('tc-proxy-app');
  app.append(E('link', { rel: 'stylesheet', href: L.resource('terryclash/style.css') + '?v=0.1.0-r8' })); return app;
 }
});
