// 검색어 평가: tests/query_eval.csv의 검색어를 search_system.html의 실제 검색 코드(runSearch·tokenize·SYN)로 돌려 본다.
// 사용법: node tests/query_eval.js              → 지금 파일만
//         node tests/query_eval.js <예전.html>  → 예전 파일과 나란히 (예: git show <커밋>:search_system.html > /tmp/old.html)
// expected_tags: ";"로 이은 기대 태그. "*" = 방 낱말·뜻 없는 말·빼기뿐이라 모든 사진이 맞아야 하는 검색. 빈칸 = 풀에 없는 것(0건이 맞음)
// 시작 단어(STARTER_CHIPS) 8개는 결과 목록이 예전 파일과 똑같은지도 본다.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
function load(html){
  const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('코드를 못 찾음: ' + a); return html.slice(i, j); };
  const code = [grab('const TARGETS = [', '// 방 종류'), grab('const TAG_GROUPS = [', 'const MAX_EDGE'), grab('const norm =', '\n'), grab('function hash(str)', '\n'), grab('const STARTER_CHIPS =', '\n'),
    grab('function searchIndex(p)', '/* ================= 렌더'), 'this.out = {TAG_GROUPS, SYN, tokenize, runSearch, STARTER: STARTER_CHIPS};'].join('\n');
  const csv = fs.readFileSync(path.join(ROOT, 'pool/pool.csv'), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1);
  const photos = csv.map(l => { const [file, tags, contains] = l.split(','); return {id: 'pool_' + file, name: file, tags: tags.split(';').filter(Boolean), contains: (contains || '').split(';').filter(Boolean)}; });
  const ctx = {S: {photos, settings: {targets: []}}}; vm.createContext(ctx); vm.runInContext(code, ctx);
  const o = ctx.out; o.photos = photos; o.run = q => o.runSearch(q, 'pilot'); return o;
}
const rows = fs.readFileSync(path.join(__dirname, 'query_eval.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map(l => {
  const m = l.match(/^([^,]*),([^,]*),(.*)$/); return {q: m[1], exp: m[2] === '*' ? '*' : (m[2] ? m[2].split(';') : []), note: m[3].replace(/^"|"$/g, '')};
});
// 검색어 토큰이 걸리는 태그 (runSearch와 같은 규칙을 태그 하나의 색인 [태그, ...동의어]에만 적용)
function tagsHit(h, pos){
  const out = new Set();
  h.TAG_GROUPS.flatMap(g => g.tags).forEach(E => {
    const idx = [E, ...(h.SYN[E] || [])].map(s => s.toLowerCase());
    const part = t => t.length >= 2 && idx.some(g => g.length >= 2 && t.includes(g));
    if (pos.some(t => t.length < 2 ? idx.includes(t) : (idx.some(g => g.includes(t)) || part(t)))) out.add(E);
  });
  return out;
}
function report(h, name){
  const live = rows.filter(r => r.exp === '*' || r.exp.length);
  let any = 0, ok = 0, sum = 0; const zero = [], miss = [];
  live.forEach(r => { const s = h.run(r.q), tm = tagsHit(h, s.pos); sum += s.hits; if (s.hits) any++; else zero.push(r.q);
    const good = r.exp === '*' ? (!s.pos.length && s.hits > 0) : r.exp.every(e => tm.has(e)); if (good) ok++; else miss.push(r.q); });
  const absent = rows.filter(r => Array.isArray(r.exp) && !r.exp.length).map(r => `${r.q}:${h.run(r.q).hits}`);
  const pct = n => (n / live.length * 100).toFixed(1) + '%';
  console.log(`\n[${name}] 검색어 ${live.length}개 · 1건 이상 ${pct(any)} · 기대 태그 맞음 ${pct(ok)} · 평균 맞은 사진 ${(sum / live.length).toFixed(1)}장`);
  console.log('  0건:', zero.join(', ') || '없음');
  console.log('  기대 태그 못 맞춤:', miss.join(', ') || '없음');
  console.log('  풀에 없는 것 (0이 맞음):', absent.join(', '));
}
const NOW = load(fs.readFileSync(path.join(ROOT, 'search_system.html'), 'utf8'));
const OLD = process.argv[2] ? load(fs.readFileSync(process.argv[2], 'utf8')) : null;
if (OLD) report(OLD, '예전');
report(NOW, '지금');
if (OLD){
  console.log('\n시작 단어 결과 목록 (예전 → 지금):');
  NOW.STARTER.forEach(c => { const a = OLD.run(c), b = NOW.run(c); console.log(`  ${c}: ${a.hits} → ${b.hits} ${a.list.map(p => p.id).join() === b.list.map(p => p.id).join() ? '같음' : '다름!'}`); });
}
