'use strict';
'require view';
'require tools.terryclash_r8 as tc';

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
	render: function() {
		const type = tc.select(['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'IP-CIDR', 'GEOSITE', 'GEOIP', 'RULE-SET'], 'DOMAIN');
		const value = tc.input('example.com');
		const target = tc.select(['DIRECT', 'REJECT'], 'DIRECT');
		const rows = E('tbody');
		const content = E('div', [
			E('section', { class: 'tc-panel' }, [E('h2', '添加自定义规则'), E('p', '自定义规则按顺序放在订阅规则前，更新订阅后仍保留。'),
				E('div', { class: 'tc-row tc-form-row' }, [tc.field('类型', type), tc.field('匹配内容', value), tc.field('目标', target),
					tc.button('添加并应用', async () => { await tc.call('rule-add', type.value, value.value.trim(), target.value); value.value = ''; await refresh(); }, true)])]),
			E('section', { class: 'tc-panel' }, [E('h2', '当前规则'), E('p', '按从上到下的顺序匹配。订阅规则只读，自定义规则可调整。'),
				E('table', { class: 'tc-table' }, [E('thead', [E('tr', ['#', '类型', '匹配内容', '目标', '操作'].map(v => E('th', v)))]), rows])])
		]);
		async function refresh() {
			const [data, custom] = await Promise.all([tc.call('rules'), tc.call('custom-rules')]);
			const groups = ['DIRECT', 'REJECT'].concat(data.groups || []);
			target.replaceChildren(...groups.map(g => E('option', { value: g }, g)));
			rows.replaceChildren(...(data.rules || []).map((rule, index) => {
				const parts = String(rule).split(',');
				const match = parts.length > 2 ? parts[1] : '';
				const ruleTarget = parts.length > 2 ? parts[2] : parts[1];
				const own = (custom.rules || [])[index];
				const choice = own ? tc.select(groups, own.target) : null;
				return E('tr', [E('td', String(index + 1)), E('td', parts[0] || ''), E('td', match),
					E('td', [own ? choice : (ruleTarget || '')]), E('td', [own ? E('div', { class: 'tc-row' }, [
						tc.button('保存', async () => { await tc.call('rule-target', own.id, choice.value); await refresh(); }),
						tc.button('↑', async () => { await tc.call('rule-move', own.id, 'up'); await refresh(); }),
						tc.button('↓', async () => { await tc.call('rule-move', own.id, 'down'); await refresh(); }),
						tc.button('删除', async () => { await tc.call('rule-delete', own.id); await refresh(); })
					]) : E('span', { class: 'tc-meta' }, '订阅')])]);
			}));
		}
		refresh().catch(tc.notice);
		return tc.layout('规则', '按优先级管理自定义分流与订阅规则。', content);
	}
});
