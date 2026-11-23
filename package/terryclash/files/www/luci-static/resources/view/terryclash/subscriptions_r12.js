'use strict';
'require view';
'require tools.terryclash_r12 as tc';

// Existing LuCI + CSS tokens; compact graphite disclosure, blue-violet accents.
// Primary: subscriptions. Script editing is secondary and collapsed by default.
return view.extend({
 load: function() {
  const asset = name => L.resource('terryclash/vendor/' + name);
  const load = name => new Promise((resolve, reject) => {
   const tag = document.createElement('script'); tag.src = asset(name); tag.onload = resolve; tag.onerror = reject; document.head.append(tag);
  });
  document.head.append(E('link', { rel: 'stylesheet', href: asset('codemirror.css') }));
  return (window.CodeMirror ? Promise.resolve() : load('codemirror.js')).then(() => load('javascript.js')).then(() => true).catch(() => false);
 },
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
	render: function() {
		const name = tc.input('例如：我的订阅');
		const url = tc.input('https://…', 'url');
		const file = E('input', { class: 'tc-input', type: 'file', accept: '.yaml,.yml,text/yaml' });
		const fileName = tc.input('本地配置名称');
		const interval = tc.input('24', 'number');
		interval.min = 1; interval.max = 168;
		const list = E('div');
		const bypassFile = E('input', { class: 'tc-input', type: 'file', accept: '.yaml,.yml,text/yaml' });
		const bypassAddresses = E('textarea', { class: 'tc-input', rows: 5, spellcheck: 'false', placeholder: '每行一个 IPv4 或 IPv6 地址', 'aria-label': '额外直连节点 IP' });
		async function refreshBypass() {
			const data = await tc.call('bypass-list');
			bypassAddresses.value = (data.addresses || '').trim();
		}
		refreshBypass().catch(tc.notice);
		const script = E('textarea', { class: 'tc-input tc-script-source', rows: 16, spellcheck: 'false', 'aria-label': '全局扩展 JavaScript 脚本' });
  let editor = null;
  const scriptStatus = E('span', { class: 'tc-script-state' }, '正在读取…');
  const getScript = () => editor ? editor.getValue() : script.value;
  const setScript = text => { script.value = text; if (editor) editor.setValue(text); };
  function openEditor() {
   if (!editor && window.CodeMirror) {
    editor = window.CodeMirror.fromTextArea(script, {
     mode: 'javascript', theme: 'terry', lineNumbers: true, lineWrapping: false,
     indentUnit: 2, tabSize: 2, indentWithTabs: false, viewportMargin: 10,
     extraKeys: { Tab: cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection('  ', 'end'), 'Shift-Tab': cm => cm.indentSelection('subtract') }
    });
    editor.getWrapperElement().setAttribute('aria-label', 'JavaScript 代码编辑器');
    editor.setSize('100%', 420);
   }
   if (editor) editor.refresh();
  }
		const scriptEnabled = E('input', { type: 'checkbox' });
		const scriptFile = E('input', { type: 'file', accept: '.js', class: 'tc-input' });
		scriptFile.addEventListener('change', async () => {
   if (!scriptFile.files.length) return;
   if (scriptFile.files[0].size > 262144) { tc.notice(new Error('脚本不能超过 256 KiB')); return; }
   setScript(await scriptFile.files[0].text());
  });
		tc.call('script-get').then(data => { setScript(data.script || 'function main(config) {\n  return config;\n}'); scriptEnabled.checked = data.enabled; scriptStatus.textContent = 'JavaScript · ' + (data.enabled ? '已启用' : '未启用'); }).catch(tc.notice);
		const content = E('div', [
			E('details', { class: 'tc-panel tc-script-panel', id: 'tc-global-script' }, [
    E('summary', { class: 'tc-script-summary' }, [E('span', { class: 'tc-script-symbol', 'aria-hidden': 'true' }, 'JS'),
     E('span', { class: 'tc-script-summary-copy' }, [E('strong', '全局扩展脚本'), scriptStatus]),
     E('span', { class: 'tc-script-disclosure' }, [E('span', { class: 'tc-expand-label' }, '展开编辑 ▾'), E('span', { class: 'tc-collapse-label' }, '收起 ▴')])]),
    E('div', { class: 'tc-script-body' }, [
     E('p', '支持 main(config)，校验成功后应用。'),
     E('label', { class: 'tc-script-enable' }, [scriptEnabled, ' 启用全局脚本']), script,
     E('div', { class: 'tc-row tc-form-row' }, [tc.field('导入 JavaScript 文件', scriptFile), tc.button('保存并应用', async () => {
      const text = getScript();
      if (new TextEncoder().encode(text).length > 262144) throw new Error('脚本不能超过 256 KiB');
      await tc.write('/tmp/terryclash-script.js', text);
      await tc.call('script-save', scriptEnabled.checked ? '1' : '0');
      scriptStatus.textContent = 'JavaScript · ' + (scriptEnabled.checked ? '已启用' : '未启用');
     }, true)])])]),
			E('section', { class: 'tc-panel' }, [E('h2', '导入订阅'), E('p', '添加标准 Clash / Mihomo YAML 地址，校验通过后再启用。'),
				E('div', { class: 'tc-row tc-form-row' }, [tc.field('名称', name), tc.field('订阅 URL', url), tc.button('添加并更新', async () => {
					const added = await tc.call('add', name.value.trim(), url.value.trim());
					await tc.call('update', added.id);
					name.value = ''; url.value = ''; await refresh();
				}, true)])]),
			E('section', { class: 'tc-panel' }, [E('h2', '本地配置'), E('div', { class: 'tc-row tc-form-row' }, [
				tc.field('名称', fileName), tc.field('YAML 文件', file), tc.button('导入', async () => {
					if (!file.files.length) throw new Error('请选择 YAML 文件');
					if (file.files[0].size > 4194304) throw new Error('配置文件不能超过 4 MiB');
					await tc.write('/tmp/terryclash-import.yaml', await file.files[0].text());
					const added = await tc.call('import', fileName.value.trim() || file.files[0].name);
					await tc.call('activate', added.id);
					file.value = ''; fileName.value = ''; await refresh();
				}, true)])]),
			E('section', { class: 'tc-panel' }, [
				E('h2', '本机 Clash 节点直连'),
				E('p', '导入本机 Clash 的 YAML 配置，仅保存其中的节点 IP；本机订阅更新后需重新导入。也可在下方逐行编辑地址。'),
				E('div', { class: 'tc-row tc-form-row' }, [tc.field('本机 Clash YAML', bypassFile), tc.button('导入并替换', async () => {
					if (!bypassFile.files.length) throw new Error('请选择本机 Clash YAML 文件');
					if (bypassFile.files[0].size > 4194304) throw new Error('配置文件不能超过 4 MiB');
					await tc.write('/tmp/terryclash-bypass-import.yaml', await bypassFile.files[0].text());
					await tc.call('bypass-import');
					bypassFile.value = '';
					await refreshBypass();
				}, true)]),
				tc.field('额外直连 IP（每行一个）', bypassAddresses),
				E('div', { class: 'tc-row tc-form-row' }, [tc.button('保存地址', async () => {
					await tc.write('/tmp/terryclash-bypass-list.txt', bypassAddresses.value);
					await tc.call('bypass-save');
					await refreshBypass();
				})])
			]),
			E('section', { class: 'tc-panel' }, [E('div', { class: 'tc-row between' }, [E('div', [E('h2', '已保存订阅'), E('p', '更新失败时保留当前运行配置。')]),
				E('div', { class: 'tc-row tc-form-row' }, [tc.field('自动更新间隔（小时）', interval), tc.button('保存', async () => { await tc.call('set-interval', interval.value); await refresh(); })])]), list])
		]);
		async function refresh() {
			const data = await tc.call('list');
			interval.value = data.update_interval;
			list.replaceChildren(...(data.subscriptions.length ? data.subscriptions.map(s => E('div', { class: 'tc-item tc-row between' }, [
				E('div', [E('strong', s.name), s.id === data.active ? E('span', { class: 'tc-badge', style: 'margin-left:10px' }, '当前配置') : '',
					E('span', { class: 'tc-meta' }, (s.url || '本地文件') + ' · 最近更新 ' + (s.updated || '未更新'))]),
				E('div', { class: 'tc-row' }, [
					s.url ? tc.button('更新', async () => { await tc.call('update', s.id); await refresh(); }) : '',
					tc.button('使用', async () => { await tc.call('activate', s.id); await refresh(); }),
					s.id !== data.active ? tc.button('删除', async () => { await tc.call('delete', s.id); await refresh(); }) : ''
				])
			])) : [E('div', { class: 'tc-empty' }, '还没有订阅。添加 URL 或导入本地 YAML 开始使用。')]));
		}
		refresh().catch(tc.notice);
		const panel = content.querySelector('#tc-global-script');
  panel.addEventListener('toggle', () => { if (panel.open) requestAnimationFrame(openEditor); });
  const app = tc.layout('订阅', '管理配置来源、更新与当前使用的订阅。', content);
  app.classList.add('tc-subscriptions-app');
  app.append(E('link', { rel: 'stylesheet', href: L.resource('terryclash/style.css') + '?v=0.1.0-r12' }));
  return app;
	}
});
