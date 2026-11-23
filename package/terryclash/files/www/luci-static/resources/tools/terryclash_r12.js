'use strict';
'require baseclass';
'require rpc';
'require ui';

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
 return E('div', { class: 'tc-app' }, [
  E('link', { rel: 'stylesheet', href: L.resource('terryclash/style.css') + '?v=0.1.0-r12' }),
  E('div', { class: 'tc-hero' }, [
   E('div', [E('div', { class: 'tc-eyebrow' }, 'TERRYCLASH / IMMORTALWRT'), E('h1', title), E('p', subtitle)])
  ]),
  content
 ]);
}

return baseclass.extend({ call, write, notice, action, button, field, input, select, layout });
