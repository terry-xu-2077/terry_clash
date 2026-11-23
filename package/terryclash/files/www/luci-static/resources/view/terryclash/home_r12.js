'use strict';
'require view';
'require poll';
'require tools.terryclash_r12 as tc';

/* 首页 brief: primary = service state and one start/stop action; secondary =
 * default route, delay, throughput and actual capture; tertiary = site probes.
 * Existing graphite tokens, 8/12/16/24px rhythm, one lavender primary action.
 * A quiet operations console: readable when stopped, informative when running. */
return view.extend({
 handleSave: null, handleSaveApply: null, handleReset: null,
 render: function() {
  let running = false, lastTraffic = null, lastProbeAt = 0, checking = false;
  let sites = [], siteResults = {};
  const name = tc.input('站点名称');
  const url = tc.input('https://example.com/', 'url');
  const stateText = E('strong', { class: 'tc-home-state-text' }, '正在读取');
  const stateHint = E('span', { class: 'tc-home-state-hint' }, '请稍候…');
  const stateDot = E('span', { class: 'tc-home-state-dot', 'aria-hidden': 'true' });
  const route = E('strong', { class: 'tc-home-metric-value' }, '—');
  const delay = E('strong', { class: 'tc-home-metric-value' }, '—');
  const speed = E('strong', { class: 'tc-home-metric-value' }, '↓ 0 B/s  ↑ 0 B/s');
  const siteGrid = E('div', { class: 'tc-home-site-grid' });
  const probeTime = E('span', { class: 'tc-home-fine' }, '尚未检测');
  const routeStates = {};
  const routeItems = [
   { key: 'capture_ipv4', name: 'IPv4 透明代理', detail: 'LAN TCP / UDP' },
   { key: 'capture_ipv6', name: 'IPv6 透明代理', detail: 'LAN TCP / UDP' },
   { key: 'dns_forwarding', name: 'DNS 上游', detail: 'dnsmasq → Mihomo' }
  ];
  const captureGrid = E('div', { class: 'tc-route-grid' }, routeItems.map(item => {
   const value = E('strong', { class: 'tc-route-state off' }, '已关闭');
   routeStates[item.key] = value;
   return E('div', { class: 'tc-route-item' }, [
    E('div', { class: 'tc-route-item-top' }, [E('span', { class: 'tc-route-name' }, item.name), value]),
    E('span', { class: 'tc-route-detail' }, item.detail)
   ]);
  }));
  const serviceButton = tc.button('启动服务', async () => {
   await tc.call(running ? 'stop' : 'start');
   await refreshOverview();
   await checkSites();
  }, true);
  serviceButton.classList.add('tc-home-power');

  function formatRate(value) {
   if (!Number.isFinite(value) || value <= 0) return '0 B/s';
   const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s'];
   let index = 0;
   while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
   return value.toFixed(index ? 1 : 0) + ' ' + units[index];
  }
  function chain(proxies, first) {
   const seen = new Set(), parts = [];
   let current = first;
   while (current && !seen.has(current) && parts.length < 8) {
    parts.push(current); seen.add(current);
    current = proxies[current] && proxies[current].now;
   }
   return parts;
  }
  function drawSites() {
   siteGrid.replaceChildren(...sites.map(site => {
    const result = siteResults[site.id];
    const state = !running ? 'idle' : !result ? 'waiting' : result.reachable ? 'ok' : 'error';
    const label = !running ? '未检测' : !result ? '检测中…' : result.reachable ? '有响应' : '连接失败';
    const latency = result && result.reachable ? Math.round(Number(result.elapsed_seconds) * 1000) + ' ms' : '—';
    const detail = result && result.reachable ? 'HTTP ' + result.http_status : site.url;
    return E('article', { class: 'tc-home-site-card ' + state }, [
     E('div', { class: 'tc-home-site-top' }, [
      E('strong', { class: 'tc-home-site-name' }, site.name),
      E('span', { class: 'tc-home-site-state' }, label)
     ]),
     E('div', { class: 'tc-home-site-latency' }, latency),
     E('div', { class: 'tc-home-site-foot' }, [
      E('span', { class: 'tc-home-site-detail', title: detail }, detail),
      tc.button('移除', async () => { await tc.call('probe-delete', site.id); delete siteResults[site.id]; await refreshSites(); })
     ])
    ]);
   }));
   if (!sites.length) siteGrid.append(E('div', { class: 'tc-home-empty' }, '暂无检测站点。使用下方表单添加。'));
  }
  async function refreshSites() {
   sites = (await tc.call('probe-list')).probes || [];
   drawSites();
  }
  async function checkSites() {
   if (checking) return;
   lastProbeAt = Date.now();
   siteResults = {};
   if (!running || !sites.length) { probeTime.textContent = running ? '暂无站点' : '服务未运行'; drawSites(); return; }
   checking = true; probeTime.textContent = '检测中…'; drawSites();
   try {
    await Promise.all(sites.map(async site => {
     try { siteResults[site.id] = await tc.call('probe-check', site.id); }
     catch (e) { siteResults[site.id] = { reachable: false }; }
     drawSites();
    }));
    probeTime.textContent = '刚刚检测';
   } finally { checking = false; }
  }
  async function refreshOverview() {
   const status = await tc.call('status');
   const wasRunning = running;
   running = !!status.running;
   stateDot.classList.toggle('on', running);
   stateText.textContent = running ? '运行中' : '已停止';
   stateHint.textContent = running ? '模式 ' + status.mode.toUpperCase() + ' · 代理已启动' : '路由接管已关闭';
   serviceButton.textContent = running ? '停止服务' : '启动服务';
   serviceButton.classList.toggle('tc-primary', !running);
   serviceButton.classList.toggle('tc-home-stop', running);
   for (const item of routeItems) {
    const active = running && !!status[item.key];
    routeStates[item.key].className = 'tc-route-state ' + (active ? 'on' : 'off');
    routeStates[item.key].textContent = active ? (item.key === 'dns_forwarding' ? '已转发' : '已接管') : running ? '未接管' : '已关闭';
   }
   if (!running) {
    route.textContent = '—'; delay.textContent = '—'; speed.textContent = '↓ 0 B/s  ↑ 0 B/s';
    lastTraffic = null;
    if (wasRunning) { siteResults = {}; probeTime.textContent = '服务未运行'; drawSites(); }
    return;
   }
   try {
    const proxies = (await tc.call('proxies')).proxies || {};
    const names = chain(proxies, status.mode === 'global' ? 'GLOBAL' : 'Proxy');
    const finalNode = names[names.length - 1];
    route.textContent = status.mode === 'direct' ? 'DIRECT' : names.length ? names.join(' → ') : '—';
    const history = finalNode && proxies[finalNode] && proxies[finalNode].history || [];
    const recent = history.length && history[history.length - 1].delay;
    delay.textContent = recent > 0 ? recent + ' ms' : '未测速';
   } catch (e) { route.textContent = '读取中…'; delay.textContent = '—'; }
   try {
    const traffic = await tc.call('connections');
    const now = Date.now();
    if (lastTraffic) {
     const seconds = Math.max((now - lastTraffic.time) / 1000, 1);
     speed.textContent = '↓ ' + formatRate((traffic.downloadTotal - lastTraffic.down) / seconds) + '  ↑ ' + formatRate((traffic.uploadTotal - lastTraffic.up) / seconds);
    }
    lastTraffic = { time: now, down: traffic.downloadTotal, up: traffic.uploadTotal };
   } catch (e) { /* Core may still be starting. */ }
   if (!wasRunning) checkSites().catch(tc.notice);
  }

  const content = E('div', { class: 'tc-home' }, [
   E('section', { class: 'tc-panel tc-home-overview', 'aria-label': '服务状态' }, [
    E('div', { class: 'tc-home-overview-top' }, [
     E('div', { class: 'tc-home-state', role: 'status', 'aria-live': 'polite' }, [stateDot, E('span', [stateText, stateHint])]),
     serviceButton
    ]),
    E('div', { class: 'tc-home-metrics' }, [
     E('div', { class: 'tc-home-metric' }, [E('span', '当前路线'), route, E('small', '规则模式下显示默认策略')]),
     E('div', { class: 'tc-home-metric' }, [E('span', '节点延迟'), delay, E('small', '最近一次 Mihomo 测速')]),
     E('div', { class: 'tc-home-metric' }, [E('span', '实时速率'), speed, E('small', '当前上传与下载')])
    ])
   ]),
   E('section', { class: 'tc-panel tc-route-panel', 'aria-label': '路由接管状态' }, [
    E('div', { class: 'tc-route-heading' }, [E('h2', '路由接管'), E('p', '随服务自动启停')]), captureGrid
   ]),
   E('section', { class: 'tc-panel tc-home-sites', 'aria-label': '站点连通性' }, [
    E('div', { class: 'tc-home-section-head' }, [
     E('div', [E('h2', '站点连通性'), E('p', '经 TerryClash 代理检测 HTTP 响应')]),
     E('div', { class: 'tc-home-section-actions' }, [probeTime, tc.button('重新检测', async () => { await refreshOverview(); await checkSites(); })])
    ]),
    siteGrid,
    E('details', { class: 'tc-home-add' }, [
     E('summary', '＋ 添加检测站点'),
     E('div', { class: 'tc-row tc-form-row' }, [tc.field('名称', name), tc.field('HTTP(S) 地址', url), tc.button('添加', async () => {
      await tc.call('probe-add', name.value.trim(), url.value.trim());
      name.value = ''; url.value = '';
      await refreshSites(); await checkSites();
     }, true)])
    ])
   ])
  ]);
  const app = tc.layout('网络总览', '服务、路由和常用站点，一眼看清。', content);
  app.classList.add('tc-home-app');
  refreshSites().then(() => refreshOverview()).catch(tc.notice);
  poll.add(async () => {
   await refreshOverview();
   if (running && Date.now() - lastProbeAt > 60000) await checkSites();
  }, 5);
  return app;
 }
});
