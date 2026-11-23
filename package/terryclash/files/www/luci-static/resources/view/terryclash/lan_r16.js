'use strict';
'require view';
'require tools.terryclash_r12 as tc';

/* 局域网页 brief: primary = source IP routing policy; secondary = local Clash
 * endpoint bypass. Existing graphite surfaces, 8/12/16/24px spacing, one save
 * action per section. Direct list wins; empty proxy list preserves all-LAN mode. */
return view.extend({
 handleSave: null, handleSaveApply: null, handleReset: null,
 render: function() {
  const proxyAddresses = E('textarea', { class: 'tc-input tc-lan-addresses', rows: 7, spellcheck: 'false', placeholder: '例如 192.168.100.173\n或 192.168.100.0/24', 'aria-label': '走代理的局域网 IP' });
  const directAddresses = E('textarea', { class: 'tc-input tc-lan-addresses', rows: 7, spellcheck: 'false', placeholder: '例如 192.168.100.204\n或 192.168.100.0/24', 'aria-label': '走直连的局域网 IP' });
  const mode = E('span', { class: 'tc-lan-mode', role: 'status', 'aria-live': 'polite' }, '读取中…');
  const bypassFile = E('input', { class: 'tc-input', type: 'file', accept: '.yaml,.yml,text/yaml' });
  const bypassAddresses = E('textarea', { class: 'tc-input tc-lan-addresses', rows: 7, spellcheck: 'false', placeholder: '每行一个节点 IPv4 或 IPv6 地址', 'aria-label': '额外直连节点 IP' });
  async function refreshPolicy() {
   const data = await tc.call('lan-list');
   proxyAddresses.value = (data.proxy || '').trim();
   directAddresses.value = (data.direct || '').trim();
   mode.textContent = proxyAddresses.value ? '仅名单内代理' : '默认代理全部设备';
  }
  async function refreshBypass() {
   const data = await tc.call('bypass-list');
   bypassAddresses.value = (data.addresses || '').trim();
  }
  const content = E('div', { class: 'tc-lan-page' }, [
   E('section', { class: 'tc-panel tc-lan-policy' }, [
    E('div', { class: 'tc-lan-heading' }, [
     E('div', [E('h2', '局域网设备分流'), E('p', '按客户端源 IP 或网段配置。直连名单优先；代理名单为空时，其他设备仍按现有规则代理。')]), mode
    ]),
    E('div', { class: 'tc-lan-grid' }, [
     E('div', { class: 'tc-lan-column' }, [
      E('div', { class: 'tc-lan-column-head' }, [E('span', { class: 'tc-lan-symbol proxy' }, '↗'), E('strong', '走代理')]),
      E('p', '填写后，仅名单内设备进入 TerryClash。留空表示所有未列入直连名单的设备都走代理。'),
      tc.field('客户端 IP / CIDR，每行一个', proxyAddresses)
     ]),
     E('div', { class: 'tc-lan-column' }, [
      E('div', { class: 'tc-lan-column-head' }, [E('span', { class: 'tc-lan-symbol direct' }, '→'), E('strong', '走直连')]),
      E('p', '这些设备不进入 TerryClash；与代理名单重叠时，以直连为准。'),
      tc.field('客户端 IP / CIDR，每行一个', directAddresses)
     ])
    ]),
    E('div', { class: 'tc-lan-footer' }, [
     E('span', '支持 IPv4、IPv6 及网段。启用分流时 DNS 自动使用真实 IP 模式。'),
     tc.button('保存分流规则', async () => {
      await tc.write('/tmp/terryclash-lan-proxy.txt', proxyAddresses.value);
      await tc.write('/tmp/terryclash-lan-direct.txt', directAddresses.value);
      await tc.call('lan-save');
      await refreshPolicy();
     }, true)
    ])
   ]),
   E('section', { class: 'tc-panel tc-lan-bypass' }, [
    E('h2', '下游 Clash 节点直连'),
    E('p', '导入下游设备 Clash 的 YAML 配置，仅保存其中的节点 IP；下游订阅更新后需重新导入。也可在下方逐行编辑地址。'),
    E('div', { class: 'tc-row tc-form-row' }, [tc.field('下游 Clash YAML', bypassFile), tc.button('导入并替换', async () => {
     if (!bypassFile.files.length) throw new Error('请选择下游 Clash YAML 文件');
     if (bypassFile.files[0].size > 4194304) throw new Error('配置文件不能超过 4 MiB');
     await tc.write('/tmp/terryclash-bypass-import.yaml', await bypassFile.files[0].text());
     await tc.call('bypass-import');
     bypassFile.value = '';
     await refreshBypass();
    })]),
    tc.field('额外直连节点 IP（每行一个）', bypassAddresses),
    E('div', { class: 'tc-lan-footer' }, [E('span', '这里填写的是代理节点的目标 IP，不是局域网设备的源 IP。'), tc.button('保存地址', async () => {
     await tc.write('/tmp/terryclash-bypass-list.txt', bypassAddresses.value);
     await tc.call('bypass-save');
     await refreshBypass();
    })])
   ])
  ]);
  const app = tc.layout('分流', '按局域网设备分流，并管理下游 Clash 节点直连。', content);
  app.classList.add('tc-lan-app');
  app.append(E('link', { rel: 'stylesheet', href: L.resource('terryclash/style.css') + '?v=0.1.0-r16' }));
  refreshPolicy().catch(tc.notice);
  refreshBypass().catch(tc.notice);
  return app;
 }
});
