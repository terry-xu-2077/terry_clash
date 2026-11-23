'use strict';
'require baseclass';
'require rpc';
'require ui';
'require poll';

const run = rpc.declare({ object: 'file', method: 'exec', params: ['command', 'params'] });
const write = rpc.declare({ object: 'file', method: 'write', params: ['path', 'data'] });

function call(command, ...args) {
	return run('/usr/libexec/terryclash', [command].concat(args.map(String))).then(function(result) {
		let data;
		try { data = JSON.parse(result.stdout || '{}'); }
		catch (e) { throw new Error(result.stderr || result.stdout || '后端未返回有效 JSON'); }
		if (result.code !== 0 || data.ok === false)
			throw new Error(data.error || result.stderr || '操作失败');
		return data;
	});
}

function notice(error) {
	ui.addNotification(null, E('p', String(error.message || error)), 'error');
}

function action(fn) {
	return async function(ev) {
		const button = ev.currentTarget;
		button.disabled = true;
		try { await fn(); }
		catch (e) { notice(e); }
		finally { button.disabled = false; }
	};
}

function button(label, fn, primary) {
	return E('button', { class: 'tc-button' + (primary ? ' tc-primary' : ''), type: 'button', click: action(fn) }, label);
}

function field(label, input) {
	return E('label', { class: 'tc-field' }, [E('span', label), input]);
}

function input(placeholder, type) {
	return E('input', { class: 'tc-input', type: type || 'text', placeholder: placeholder || '' });
}

function select(options, value) {
	return E('select', { class: 'tc-input' }, options.map(o => E('option', { value: o, selected: o === value ? 'selected' : null }, o)));
}

function layout(title, subtitle, content) {
	const status = E('div', { class: 'tc-status' }, '连接中…');
	const root = E('div', { class: 'tc-app' }, [
		E('link', { rel: 'stylesheet', href: L.resource('terryclash/style.css') }),
		E('div', { class: 'tc-hero' }, [
			E('div', [E('div', { class: 'tc-eyebrow' }, 'TERRYCLASH / IMMORTALWRT'), E('h1', title), E('p', subtitle)]), status
		]),
		content
	]);
	let last = null;
	async function refreshStatus() {
		const s = await call('status');
		let speed = '↓ 0 B/s · ↑ 0 B/s';
		let current = '—';
		if (s.running) {
			try {
				const proxyData = (await call('proxies')).proxies || {};
				const selected = Object.entries(proxyData).find(([name, group]) => name !== 'GLOBAL' && group.type === 'Selector' && group.now);
				if (selected) current = selected[0] + ' → ' + selected[1].now;
			} catch (e) { /* API may still be starting. */ }
			try {
				const c = await call('connections');
				const now = Date.now();
				if (last) {
					const sec = Math.max((now - last.time) / 1000, 1);
					speed = '↓ ' + formatRate((c.downloadTotal - last.down) / sec) + ' · ↑ ' + formatRate((c.uploadTotal - last.up) / sec);
				}
				last = { time: now, down: c.downloadTotal, up: c.uploadTotal };
			} catch (e) { /* status remains available while API starts */ }
		}
		status.replaceChildren(E('span', { class: 'tc-dot ' + (s.running ? 'on' : '') }),
			E('strong', s.running ? '运行中' : '已停止'), E('span', '模式 ' + s.mode.toUpperCase()), E('span', '节点 ' + current), E('span', speed),
			button(s.running ? '停止' : '启动', async () => { await call(s.running ? 'stop' : 'start'); await refreshStatus(); }));
	}
	refreshStatus().catch(notice);
	poll.add(refreshStatus, 3);
	return root;
}

function formatRate(bytes) {
	if (!isFinite(bytes) || bytes <= 0) return '0 B/s';
	const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s'];
	let i = 0;
	while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
	return bytes.toFixed(i ? 1 : 0) + ' ' + units[i];
}

return baseclass.extend({ call, write, notice, action, button, field, input, select, layout });
