import * as std from 'std';
try {
  const source = std.loadFile(scriptArgs[1]);
  const invoke = new Function('config', 'profileName', source + '\n; if (typeof main !== "function") throw new Error("需要 main(config) 函数"); return main(config, profileName);');
  if (scriptArgs.length > 2) {
    const result = invoke(JSON.parse(std.loadFile(scriptArgs[2])), 'TerryClash');
    if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.then === 'function') throw new Error('main 必须同步返回配置对象');
    const out = std.open(scriptArgs[3], 'w');
    if (!out) throw new Error('无法写入输出配置');
    out.puts(JSON.stringify(result)); out.close();
  }
} catch (e) { std.err.puts(String(e.stack || e) + '\n'); std.exit(1); }
