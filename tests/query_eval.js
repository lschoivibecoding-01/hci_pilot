// 검색어 평가: tests/query_eval.csv의 검색어를 search_system.html의 실제 검색 코드(runSearch·tokenize·SYN)로 돌려 본다.
// 사용법: node tests/query_eval.js              → 지금 파일만
//         node tests/query_eval.js <예전.html>  → 예전 파일과 나란히 (예: git show <커밋>:search_system.html > /tmp/old.html)
// expected_tags: ";"로 이은 기대 태그. "*" = 방 낱말·뜻 없는 말·빼기뿐이라 모든 사진이 맞아야 하는 검색.
//   "@" = 태그에는 없지만 사진 설명문·물건 목록(pool.csv의 caption·objects)에 있어 1건 이상 나와야 하는 검색 (2026-10-27.7).
//   빈칸 = 풀에 없는 것(0건이 맞음)
// 묶음: note가 "나중 추가"로 시작 = 사전을 고친 뒤 따로 만든 확인용(손대지 않는 묶음), "설명 추가"로 시작 = 설명문 검색 확인용 물건 검색어, 나머지 = 기본.
// 예전 파일을 주면: 시작 단어(STARTER_CHIPS) 8개 결과 목록이 똑같은지, 흔한 검색어 30개의 상위 24장 타깃 요소 D 평균(0~5)이 0.3보다 많이 움직였는지,
// 설명에만 맞은 사진의 D 평균이 풀 평균과 비슷한지도 본다.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const D_NAMES = ['식물', '러그', '스탠드 조명', '벽 그림', '겹친 침구·담요'];
function parseCSV(text){
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++){ const c = text[i];
    if (q){ if (c === '"'){ if (text[i+1] === '"'){ cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ','){ row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r'){ if (c === '\r' && text[i+1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c; }
  if (cur !== '' || row.length){ row.push(cur); rows.push(row); }
  const clean = rows.filter(r => r.some(x => x.trim() !== '')), head = clean[0].map(h => h.trim().replace(/^﻿/, ''));
  return clean.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const list = v => (v || '').split(';').map(x => x.trim()).filter(Boolean);
const POOL = parseCSV(fs.readFileSync(path.join(ROOT, 'pool/pool.csv'), 'utf8'));
function load(html){
  const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('코드를 못 찾음: ' + a); return html.slice(i, j); };
  const code = [grab('const TARGETS = [', '// 방 종류'), grab('const TAG_GROUPS = [', 'const MAX_EDGE'), grab('const norm =', '\n'), grab('function hash(str)', '\n'), grab('const STARTER_CHIPS =', '\n'),
    grab('function searchIndex(p)', '/* ================= 렌더'), 'this.out = {TAG_GROUPS, SYN, tokenize, runSearch, STARTER: STARTER_CHIPS};'].join('\n');
  const photos = POOL.map(r => ({id: 'pool_' + r.file, name: r.file, tags: list(r.tags), contains: list(r.contains), caption: r.caption || '', objects: list(r.objects)}));
  const ctx = {S: {photos, settings: {targets: []}}}; vm.createContext(ctx); vm.runInContext(code, ctx);
  const o = ctx.out; o.photos = photos; o.run = q => o.runSearch(q, 'pilot'); return o;
}
const dOf = p => p.contains.filter(c => D_NAMES.includes(c)).length;
const rows = parseCSV(fs.readFileSync(path.join(__dirname, 'query_eval.csv'), 'utf8')).map(r => ({
  q: r.query, exp: r.expected_tags === '*' ? '*' : r.expected_tags === '@' ? '@' : list(r.expected_tags), note: r.note,
  group: /^설명 추가/.test(r.note) ? 'cap' : /^나중 추가/.test(r.note) ? 'later' : 'base'}));
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
const GROUP_NAME = {base: '기본', later: '나중 추가 (손대지 않는 확인용)', cap: '설명 추가 (물건 검색어)'};
function report(h, name){
  console.log(`\n===== [${name}] =====`);
  ['base', 'later', 'cap'].forEach(g => {
    const all = rows.filter(r => r.group === g); if (!all.length) return;
    const live = all.filter(r => r.exp === '*' || r.exp === '@' || r.exp.length), absent = all.filter(r => Array.isArray(r.exp) && !r.exp.length);
    let any = 0, ok = 0, sum = 0, cap = 0; const zero = [], miss = [];
    live.forEach(r => { const s = h.run(r.q), tm = tagsHit(h, s.pos); sum += s.hits; cap += s.capHits || 0; if (s.hits) any++; else zero.push(r.q);
      const good = r.exp === '*' ? (!s.pos.length && s.hits > 0) : r.exp === '@' ? s.hits > 0 : r.exp.every(e => tm.has(e)); if (good) ok++; else miss.push(r.q); });
    const absHits = absent.map(r => [r.q, h.run(r.q).hits]), absOk = absHits.filter(x => !x[1]).length;
    const pct = (n, d) => d ? (n / d * 100).toFixed(1) + '%' : '-';
    console.log(`\n[${GROUP_NAME[g]}] 있어야 할 검색어 ${live.length}개 · 1건 이상 ${pct(any, live.length)} · 기대 맞음 ${pct(ok, live.length)} · 평균 맞은 사진 ${(sum / Math.max(1, live.length)).toFixed(1)}장 (설명에만 맞은 사진 평균 ${(cap / Math.max(1, live.length)).toFixed(1)}장)`);
    console.log(`  풀에 없어야 할 검색어 ${absent.length}개 · 0건으로 맞음 ${pct(absOk, absent.length)} · 전체 기대 맞음 ${pct(ok + absOk, all.length)}`);
    console.log('  0건:', zero.join(', ') || '없음');
    console.log('  기대 못 맞춤:', miss.join(', ') || '없음');
    console.log('  풀에 없는 것 (0이 맞음):', absHits.map(x => `${x[0]}:${x[1]}`).join(', ') || '없음');
  });
}
// 흔한 검색어 30개 (평가 묶음 안의 말, D 치우침 확인용)
const COMMON30 = ['아늑한', '미니멀', '화이트', '모던', '따뜻한', '베이지', '우드', '햇살', '고급스러운', '그레이', '넓은', '북유럽', '내추럴', '빈티지', '호텔 같은 방',
  '깔끔한 방', '원룸 인테리어', '아늑한 침실', '화이트 인테리어', '그레이 침구', '차분한', '밝은 방', '좁은 방', '책상', '식물', '러그', '창가', '저녁', '원목', '조명'];
const top24D = (h, q) => { const l = h.run(q).list.slice(0, 24); return l.length ? l.reduce((a, p) => a + dOf(p), 0) / l.length : null; };
const NOW = load(fs.readFileSync(path.join(ROOT, 'search_system.html'), 'utf8'));
const OLD = process.argv[2] ? load(fs.readFileSync(process.argv[2], 'utf8')) : null;
if (OLD) report(OLD, '예전');
report(NOW, '지금');
const poolD = NOW.photos.reduce((a, p) => a + dOf(p), 0) / NOW.photos.length;
if (OLD){
  console.log('\n시작 단어 결과 목록 (예전 → 지금):');
  NOW.STARTER.forEach(c => { const a = OLD.run(c), b = NOW.run(c); console.log(`  ${c}: ${a.hits} → ${b.hits} (설명에만 ${b.capHits || 0}) ${a.list.map(p => p.id).join() === b.list.map(p => p.id).join() ? '같음' : '다름!'}`); });
  console.log('\n흔한 검색어 30개 · 상위 24장 D 평균 (0~5, 예전 → 지금):');
  let sa = 0, sb = 0, n = 0;
  COMMON30.forEach(q => { const a = top24D(OLD, q), b = top24D(NOW, q); if (a == null || b == null){ console.log(`  ${q}: 결과 없음 (${a} → ${b})`); return; } sa += a; sb += b; n++;
    const d = b - a; console.log(`  ${q}: ${a.toFixed(2)} → ${b.toFixed(2)}${Math.abs(d) > .3 ? '  ⚠ 0.3 넘게 움직임' : ''}`); });
  console.log(`  평균: ${(sa / n).toFixed(3)} → ${(sb / n).toFixed(3)} (풀 평균 ${poolD.toFixed(2)})`);
  const moved = [], opened = [];
  rows.forEach(r => { const a = top24D(OLD, r.q), b = top24D(NOW, r.q);
    if (a != null && b != null && Math.abs(b - a) > .3) moved.push(`${r.q} ${a.toFixed(2)}→${b.toFixed(2)}`);
    else if (a == null && b != null){ const s = NOW.run(r.q), c = s.list.slice(s.hits - (s.capHits || 0), s.hits); opened.push(`${r.q} ${s.hits}장(D ${(c.reduce((x, p) => x + dOf(p), 0) / Math.max(1, c.length)).toFixed(2)})`); }
    else if (a != null && b == null) moved.push(`${r.q} ${a.toFixed(2)}→0건`); });
  console.log(`\n평가 묶음 전체에서 상위 24장 D 평균이 0.3 넘게 움직인 검색어 ${moved.length}개:`, moved.join(', ') || '없음');
  console.log(`0건 → 설명문으로 찾게 된 검색어 ${opened.length}개 (맞은 사진 수, 설명에만 맞은 사진의 D 평균):`, [...new Set(opened)].join(', ') || '없음');
}
// 설명에만 맞은 사진들의 D 평균 (평가 묶음 전체, 검색어마다 센 것과 서로 다른 사진만 센 것)
const capPh = [], capSet = new Map();
rows.forEach(r => { const s = NOW.run(r.q); s.list.slice(s.hits - (s.capHits || 0), s.hits).forEach(p => { capPh.push(p); capSet.set(p.id, p); }); });
const mean = a => a.length ? (a.reduce((x, p) => x + dOf(p), 0) / a.length).toFixed(2) : '-';
console.log(`\n설명에만 맞은 사진 D 평균: 검색어별 ${capPh.length}건 ${mean(capPh)} · 서로 다른 사진 ${capSet.size}장 ${mean([...capSet.values()])} · 풀 평균 ${poolD.toFixed(2)}`);
