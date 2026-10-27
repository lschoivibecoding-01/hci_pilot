# 검색 조건 사진 고르기 도구 · 인수인계

`search_system.html`은 실험의 검색 조건에서 참여자가 방 사진을 검색하고, 마음에 드는 사진을 모아, 최종 1장을 고르는 단일 HTML 도구다. 이 문서는 Claude Code가 이 파일을 이어서 작업하기 위한 정리다. 사용자와의 대화와 화면 문구는 모두 **한국어**로 한다.

## 파일

- `search_system.html` 하나. 빌드 없음.
- `pool/pool.csv` + `pool/photos/*.jpg`: 기본 사진 풀(200장). http(s)로 열면(GitHub Pages 등) 페이지가 시작할 때 `syncDefaultPool()`로 이 브라우저의 IndexedDB에 맞춰 넣는다. 파일로 열면(file://) 브라우저가 막아서 건너뛰고, 그때는 `풀 불러오기`(ZIP)로 넣는다. 로컬 확인은 `python -m http.server`로 띄워서 한다.
- 맨 위에 반드시 `<!doctype html>`, `<html lang="ko">`, `<meta charset="utf-8">`가 있어야 한다(없으면 로컬에서 열 때 한글이 깨진다).
- 외부 의존성은 JSZip(cdnjs, ZIP 내보내기·불러오기)과 글꼴 Pretendard(jsDelivr, `pretendardvariable-dynamic-subset`)뿐이다. 둘 다 없어도 핵심 기능은 동작한다(글꼴은 Apple SD Gothic Neo / Malgun Gothic으로 대체). 숫자는 고정폭 글꼴 대신 본문 글꼴의 `tabular-nums`(`--f-mono`가 본문 글꼴을 가리킴).

## 디자인 (2026-10-27.3, 2026-10-27.5 다듬음)

- 사진 검색 서비스 느낌의 차분한 화면. 특정 서비스의 로고·이름·빨간색은 쓰지 않는다(참여자가 실제 서비스로 착각하지 않게).
- 토큰은 `:root` CSS 변수: 바탕 `--bg #fff`, 회색 면 `--card #f6f6f3`, 버튼 면 `--sec #e5e5e0`(누름 `--sec-press`), 선 `--line #dadad3`, 흐린 글자 `--muted #62625b`, 본문 `--body #33332e`, 강조 `--accent #262622`(먹색, 누름 `--accent-press` 더 짙게). **밝은 화면만 쓴다**(2026-10-27.5부터 다크 모드 없음, `color-scheme: light` + `<meta name="color-scheme" content="light">`): 참여자 PC 설정에 따라 사진 바탕이 달라지지 않게. 다시 넣지 않는다.
- 모서리는 16px(`--r`) / 32px(`--r-lg`, 모달·시작 카드) / 알약형(`--pill`)만. 그림자는 없다(모달 뒤 어두운 막 `--scrim`만).
- 연구자 화면은 같은 토큰을 쓰고 호박색 띠(`--research`)로 참여자 화면과 구분한다.
- 참여자 화면 낱말: 동작은 **담기**, 모은 사진은 **담은 사진**으로 통일한다("마음에 든 사진"이라는 말은 쓰지 않는다. 과제 문장의 "마음에 드는"은 그대로). 아이콘은 하트.

## 화면 구성

여는 주소에 따라 세 가지로 쓴다. 같은 PC·같은 브라우저면 두 창이 localStorage·IndexedDB를 함께 쓰고 `storage` 이벤트로 서로의 변경을 바로 받는다(기록, 진행 상태, 사진 풀). 기기가 다르면 공유되지 않는다(서버 없음).

- `index.html`: 두 화면으로 가는 링크만 있는 첫 페이지.
- `search_system.html?view=search` (검색 화면 전용, `SEARCH_PAGE`): 시작 화면(`renderStartUI`)에서 진행자·참여자 ID를 넣고 시작 → 검색 → 완료 화면(버튼 없음) → 연구자 창의 `다음 참여자 받기`로 다시 시작 화면(아래). 연구자 패널(점 버튼, Ctrl+Shift+R)은 없다. 사진 풀을 맞추는 동안(`S.poolReady` 전)에는 시작 화면의 입력칸·버튼이 막혀 있고 "사진을 불러오는 중이에요…"가 보인다(불러오기가 끝나 다시 그릴 때 친 글자가 지워지던 문제). 다시 그릴 때도 친 글자는 옮겨 둔다.
- `search_system.html?view=researcher` (연구자 화면 전용, `RESEARCH_PAGE`): 사진 풀 관리·참여자 기록만. `검색 화면 열기 ↗` 링크, 진행 중인 참여자 표시(`renderTopRight`/`updateLive`: "진행 중 P03" + 숫자 칸 다섯 `LIVE_CELLS` = 경과(첫 검색 뒤, 그 전에는 시작 뒤를 흐리게; 칸에 마우스를 올리면 둘 다), 검색, 담은 사진, 노출, 크게 보기를 1초마다 갱신, 첫 검색 후 15분(`OVER_MIN`)이 지나면 호박색 "15분 지남 · 진행자 확인")와 `미완료로 끝내기`(두 번 눌러야 함). 참여자가 결정을 마치면 "결정 마침 P03" + 멈춘 숫자 칸 + **`다음 참여자 받기`**(한 번 누르면 됨): localStorage `rs_next_up`에 `{at, pid, final}`을 적고, 검색 창이 `storage` 이벤트로 받아 같은 참여자·같은 최종 사진이면 `nextParticipant()`(= `resetSession()` + 시작 화면)를 부른다. 1.5초 뒤에도 그대로면(검색 창이 닫혀 있음) 연구자 창이 직접 `resetSession()`한다. 기록은 결정 순간 이미 남아 있으므로(`archivedId`) 새 기록이 생기지 않는다. 진행 상태가 바뀌면 오른쪽 위만 다시 그린다(노출 기록이 자주 저장되므로 화면 전체를 다시 그리지 않음). 이 창은 진행 상태 `P`를 쓰지 않는다(검색 창의 최신 상태를 덮어쓰지 않게. 예외는 `미완료로 끝내기`와, 검색 창이 닫혀 있을 때의 `다음 참여자 받기`).
- 주소에 `view`가 없으면 아래처럼 한 창에서 둘 다 쓰는 예전 방식.

1. **연구자 화면** (기본)
   - 오른쪽 위 `새 참여자 시작` → 참여자 ID 입력 모달(비우면 진행 안 됨) → 검색 화면. 진행 중인 참여자가 있으면 `P03 이어서 진행` 버튼도 나온다.
   - 탭 `사진 풀 관리`: `기본 풀 다시 맞추기`(http(s)일 때만 보임, 직접 고친 태그를 덮어씀), 사진 추가(드래그/파일/폴더, `pool.csv`를 함께 넣으면 태그 자동 적용), 태그 편집(Ctrl/⌘·Shift 다중 선택), 선택·전체 삭제(두 번 눌러야 삭제, Delete 키 지원), 풀 내보내기·불러오기(ZIP: `pool.csv` + `photos/*.jpg`). `pool.csv` 열은 `file, tags, contains`이고 tags는 `;`로 구분한다.
   - 탭 `참여자 기록`: 참여자별 카드(ID 수정 가능, 완료/미완료, 검색어 목록(맞은 사진 수·채움 여부), 노출 요약, 앱·풀 버전, 담은 사진과 각각을 담은 검색, 최종 사진, 다른 PC에서 불러온 기록은 "불러온 기록" 표시), 진행자가 둘 이상이면 진행자별 보기(`S.archWho`), `기록 불러오기 (ZIP)`(`importArchive`: ZIP 안 `participants.json`을 읽어 `id`+`researcher`가 같은 기록은 건너뛰고 `imported: true`로 합침), `기록 + 최종 사진 (ZIP)`(화면에 보이는 기록만: `participants.csv` + `participants.json` + `impressions.csv` + `진행자_순번_ID/` 사진 폴더). CSV 단독 내보내기 버튼은 없앴다(ZIP 안에 있음).
2. **참여자 검색 화면** (구글 이미지 검색처럼 검색창만 있음)
   - 과제 안내 한 줄 `TASK_LINE` = "다음에 혼자 지낼 방으로 가장 마음에 드는 사진을 한 장 골라 주세요. 마음에 드는 사진은 하트를 눌러 담아 두세요."(2026-10-27.5). 홈에서는 검색창 위(17px), 결과 화면에서는 위 검색창 아래(14px, 좁은 화면 13.5px, 머리 전체 폭) 흐린 글자(`--muted`, 대비 4.5:1 이상)로 늘 보인다. 두 문장을 `<span>`으로 나눠(`taskHTML`) 한 줄에 안 들어가면 문장 단위로 줄을 바꾼다. placeholder는 넣지 않는다.
   - **시작 단어 `STARTER_CHIPS`** (2026-10-27.5): 홈 검색창 아래에만 알약 8개 `모던, 따뜻한, 베이지, 우드, 햇살, 고급스러운, 그레이, 넓은`(모든 참여자에게 같은 순서, **목록을 바꾸지 않는다**). 고른 기준: 그 말의 상위 24장 결과에 든 타깃 요소 D(5개 중 몇 개) 평균이 풀 평균 2.98/5와 비슷한 말. D 단어(식물·러그·액자·스탠드·담요…)와 D 쪽으로 기운 말(아늑한·화이트·미니멀 등)은 일부러 뺐다(시작 단어가 노출을 특정 요소 쪽으로 기울이지 않게). 누르면 검색창에 친 것과 똑같이 검색하고(`submitQuery(q, 'chip')`), `queries[].via = 'chip'`(직접 입력은 `'typed'`)으로 남는다. 결과 화면에는 시작 단어를 두지 않는다(화면을 깔끔하게). 알약은 `--card` 면, 높이 40px, 좁은 화면에서 줄바꿈.
   - 결과 화면 위에는 고정 머리(`.g-top`, sticky): 가운데 검색창(48px 알약, 왼쪽 돋보기 = 검색 버튼, Enter도 됨) + 오른쪽 `담은 사진 N`(좁은 화면은 하트+숫자만) + 그 아래 과제 안내 한 줄.
   - 결과는 사진 원래 비율 그대로의 열 쌓기(masonry, `layoutMasonry`/`masonry`). 열 수는 창 너비로 정한다: 1440px 이상 5열, 1024 이상 4열, 768 이상 3열, 그 아래 2열(휴대폰도 2열). 간격 8px(768 미만 6px), 칸 모서리 16px. 순위 순서대로 **가장 짧은 열(같으면 왼쪽)** 에 놓으므로 순위 ≈ 읽는 순서이고, 같은 창 크기면 배치가 늘 같다. 칸 높이는 `열 너비 / ar`로 사진을 받기 전에 정한다(받는 동안 칸이 움직이지 않음). `ar`이 아직 없는 사진은 3:2로 잡았다가 로드되면 실제 비율로 다시 배치한다. 창 크기가 바뀌면(120ms 모아서) 다시 배치하고 칸 크기를 다시 잰다. 자르지 않는다(세로 사진의 바닥 러그·위쪽 벽 그림이 잘려 타깃 요소 노출이 달라지므로).
   - 맞는 사진이 12장보다 적어 나머지로 채운 검색(`resultMeta.padded`)은 `#results`(감싸는 칸, `.g-results`) 안에 masonry 두 묶음: 맞는 사진 `.g-grid` → 전체 폭 구분 줄 `.g-divider` "다른 사진" → 채운 사진 `.g-grid`. 맞는 사진이 0장이면 구분 줄 대신 "맞는 사진이 없어 다른 사진을 보여 드려요"(`.g-note`) 뒤에 채운 사진 묶음. 순위(`data-rank`)는 두 묶음에 걸쳐 이어지고 노출 기록은 한 묶음(show)으로 남는다(`rank <= hits`면 맞은 사진 = 첫 묶음). `measureTiles`·`observeTiles`는 `#results` 전체(두 묶음)를 본다. 다시 그리는 동안 `#results`에 `min-height`를 잠깐 걸어 결과 더 보기에서 스크롤이 튀지 않게 한다.
   - 사진마다 오른쪽 위에 늘 보이는 **하트만 있는 동그란 담기 버튼**(2026-10-27.5, 보이는 크기 36px, 흰 반투명 바탕 + 먹색 하트 테두리, 누르는 영역은 `::before`로 44px). 담으면 먹색 바탕 + 흰 채운 하트. `aria-label` "담기"/"담김", `aria-pressed`. 크게 보기 안의 버튼은 글자가 있는 `♡ 담기`/`♥ 담김` 그대로.
   - `담기` = "담은 사진"에 담기/빼기. 크게 보기 모달에서도 담을 수 있다. 크게 보기(`openPreview`): 넓은 화면(768px 이상)은 32px 모서리 카드에 사진 왼쪽 + 오른쪽 버튼 열(닫기, 담기, 그 바로 아래 이전/다음 — 2026-10-27.5부터 아래로 밀지 않음), 좁은 화면은 버튼 줄(이전·다음·담기·닫기)이 사진 **위**. 사진 크기는 `sizePreview`가 비율로 계산해 원본 전체가 화면 안에 들어오게 한다(세로 사진도 버튼이 밀려나지 않음, 창 크기가 바뀌면 다시 맞춤). 결정 확인(`confirmFinal`)도 제목·버튼이 사진 위에 있고 사진 크기를 비율로 맞춰 카드가 사진 폭으로 줄어든다.
   - 담은 사진이 1장 이상이면 화면 아래에 고정 줄 "담은 사진 N장 · 한 장 고르러 가기 →"(`syncFinishBar`)가 뜨고 모아 보기로 간다. 장수 제한·시간 표시는 없다(끝내는 시점은 참여자가 정함).
   - `담은 사진 N` 버튼이나 아래 고정 줄 → 모아 보기(제목 `담은 사진 N`, 같은 masonry, 간격 16px/12px) → 사진을 누르면 고름(먹색 테두리 + 왼쪽 위 체크, 아래 고정 줄 `이 사진으로 결정`) → 확인 모달 → 완료 화면.
   - 모아 보기 사진에는 하트가 없다(2026-10-27.5). 오른쪽 위 작은 `×`(보이는 32px, 누르는 영역 44px, `removeSaved`)로 빼고, 오른쪽 아래 돋보기로 크게 본다. 빼면 바로 빠지고 약 5초 동안 "사진을 뺐어요 · 되돌리기" 알림(`undoToast`)이 뜬다. `되돌리기`를 누르면 같은 자리에 돌아온다(골라 두었던 사진이면 고른 상태도). likeLog: 빼기 = `{action:'빼기', where:'모아 보기'}`, 되돌리기 = `{action:'담기', where:'되돌리기'}`. `likedRef`는 `where: '되돌리기'`를 건너뛰어 `liked[].qn/q`가 처음 담은 검색을 그대로 가리킨다.
   - 완료 화면(`renderDoneUI`): 최종 사진(최대 60vh) + 큰 글씨 "진행자를 불러 주세요."만 있다(버튼 없음, 2026-10-27.5). 다음 참여자로는 연구자 창의 `다음 참여자 받기`로 넘긴다. 연구자 창이 없을 때를 위한 숨은 길: 완료 화면에서 **Ctrl+Shift+N**(창 안 Chrome이 이 키를 시크릿 창으로 가로채는 Windows를 위해 **Alt+Shift+N**도 같은 동작, `e.code === 'KeyN'`). 완료 화면이 아니면 아무 일도 하지 않는다. `view` 없는 예전 방식에서는 같은 키로 연구자 화면으로 돌아가고, Ctrl+Shift+R 또는 오른쪽 아래 작은 점(연구자 패널)도 있다.
   - 새로고침하면 마지막 검색 결과를 그대로 다시 보여 준다(`P.lastQ`, `P.resultLimit`, `restoreResults`; 같은 검색어·시드면 결과가 같다).
   - 참여자 화면에는 다운로드 버튼, 담기 개수 제한, 시간 표시가 없다(모두 의도된 것).

## 상태와 저장소

| 저장소 | 키 | 내용 |
| --- | --- | --- |
| IndexedDB | DB `room-search-pool`, store `photos` | 사진 레코드 `{id, name, tags[], contains[], blob, thumb, addedAt, fromPool?, ar?}`. blob은 긴 변 1600px JPEG, thumb은 420px. `ar`(가로/세로 비율, 소수 4자리)은 `ensureAspect()`가 시작할 때·사진 추가 뒤 blob에서 재서 없는 사진에만 채운다. 기본 풀 사진은 `fromPool: true`, id는 `pool_` + 파일 이름 해시라 다시 맞춰도 기록의 사진 참조가 유지된다 |
| localStorage | `rs_pool_ver` | 마지막으로 맞춘 `pool/pool.csv`의 해시. 바뀌면 다음 시작 때 태그를 갱신하고 새 사진을 받고, 빠진 기본 풀 사진은 지운다(연구자가 직접 넣은 사진은 그대로) |
| localStorage | `rs_pick` | 진행 중 참여자 `P`: `{pid, liked[], final, view, active, _sel, sessionAt, startedAt, finishedAt, queries[], likeLog[], shows[], previews[], lastQ, resultLimit, archivedId}`. `sessionAt`은 시작 버튼을 누른 때. `shows`·`previews`는 아래 노출 기록 |
| localStorage | `rs_archive` | 참여자 기록 배열 `ARCH`. 고치기 전에 `reloadArch()`로 다른 창의 최신 기록부터 읽는다 |
| localStorage | `rs_researcher` | 이 PC의 진행자 이름. 새 기록의 `researcher`, CSV 열, 내보내기 파일 이름에 붙는다 |
| localStorage | `rs_pool_ping` | IndexedDB를 고칠 때마다 바꾸는 신호. 다른 창이 받아 사진 풀을 다시 읽는다 |
| localStorage | `rs_next_up` | 연구자 창의 "다음 참여자 받기" 신호 `{at, pid, final, by}` (2026-10-27.5부터). 검색 창이 받아 시작 화면으로 간다 |
| localStorage | `rs_sheet` | 구글 시트 연결 `{url, token}` (2026-10-27.4부터, 선택). 이 브라우저에만 저장하고 **코드·저장소에는 절대 넣지 않는다**(공개 저장소). 없으면 시트 기능은 아무것도 하지 않는다 |
| localStorage | `rs_settings`, `rs_sessions` | 예전 버전의 흔적. 지금 화면에서는 쓰지 않는다 |

`contains`는 사진에 보이는 타깃 요소(식물·러그·스탠드 조명·벽 그림·겹친 침구·담요)를 **보이면 다** 적은 표시로, 나중에 요소 포함 비율을 맞추는 데 쓴다. 타깃 요소는 태그(`식물·러그·액자·스탠드·담요`)로도 달려 검색되고, room-pool 스킬의 `build_pool.py`가 이 태그에서 `contains`를 자동으로 채운다. 검색에서 빼지는 않는다(`isExcluded = () => false`). 2026-10-27에 다섯째 요소를 `따뜻한 조명`에서 `겹친 침구·담요`로 바꿨다: `따뜻한조명` 태그는 일반 조명 태그로 남아 있고, `담요`는 침대 이불 위에 담요·스로우·베드러너(호텔식 보조 이불)를 한 겹 더 얹거나 접어 둔 사진에만 단다(소파에 걸친 담요, 쿠션만 있는 것은 제외). `TARGETS`의 `warm` 항목은 예전 contains가 남은 사진 때문에 지우지 않았다.

앱 버전 `APP_VERSION`(날짜 + 순번, 지금 `2026-10-27.5` = 시작 단어·담기 낱말·구분 줄·모아 보기 빼기/되돌리기·다음 참여자 받기. `.4` = 구글 시트 연결)을 기록마다 붙인다. 화면이나 기록 방식을 바꾸면 올린다.

### 노출 기록 (2026-10-27.2부터)

검색 결과에 **실제로 그린** 사진을 묶음(show)으로 남긴다(`logShow`, `drawResults`).

- `shows[]`: `{n, qn, q, via, at, source, from, ids[], padded, hits, total, vis{}, sz{}, vw, vh}` — `via`(2026-10-27.5부터)는 이 결과를 낸 검색의 `queries[qn-1].via`(`typed`|`chip`)
  - `source`: `search`(검색) · `more`(결과 더 보기, 새로 붙은 사진만) · `return`(모아 보기에서 돌아옴) · `reload`(새로고침 뒤 복원) · `rerender`(그 밖에 다시 그림)
  - `from`: 묶음 첫 사진의 순위(1부터). 사진의 순위 = `from + ids 안 위치`. `rank <= hits`면 검색어에 맞은 사진, 아니면 나머지로 채운 사진(`padded`)
  - `vis[id]`: 칸이 처음 50% 이상 화면에 들어온 때까지의 ms(`at` 기준, IntersectionObserver). 없으면 그려졌지만 화면에 안 들어옴
  - `sz[id]`: 그린 칸의 실제 크기 `[너비, 높이]` px(`measureTiles`, masonry 배치 직후 잼. 칸 높이가 비율로 미리 정해지므로 사진 로드를 기다리지 않음). `vw`, `vh`는 그때 창 크기. 면적 가중 노출 계산용. 결과 더 보기로 다시 그리거나 창 크기가 바뀌어 다시 배치되면 크기가 최신 배치로 바뀌고, 그때 `vw`·`vh`도 그 창 크기로 맞춘다(2026-10-27.3부터)
- `previews[]`: `{id, qn, q, openedAt, dwellMs, via, from, rank, w, h, vw, vh}` — 크게 보기 한 번. `via` = `click` · `key`(←/→) · `button`(이전/다음), `from` = `search` · `saved`, `w/h`는 그린 사진 크기. 닫거나 다른 사진으로 넘기면 `dwellMs`가 채워진다(창을 닫을 때는 `pagehide`에서). 새로고침 중에 열려 있던 것은 `dwellMs: null`
- 모아 보기 화면과 결정 확인·완료 화면에 나온 사진은 따로 남기지 않는다(이미 담은 사진).

참여자 기록 한 건 (`ARCH[i]`):

```json
{
  "id": "a…", "no": 1, "label": "P01", "researcher": "의현", "status": "완료 | 미완료",
  "startedAt": "ISO (첫 검색 또는 첫 담기)", "finishedAt": "ISO",
  "queries": [{"q": "아늑한 침실", "at": "ISO", "hits": 30, "padded": false, "via": "typed | chip"}],
  "liked": [{"id": "…", "name": "J11_의현.jpg", "qn": 1, "q": "아늑한 침실", "likedAt": "ISO"}],
  "final": {"id": "…", "name": "J01_연수.jpg"},
  "likeLog": [{"action": "담기 | 빼기", "id": "…", "name": "…", "at": "ISO", "qn": 2, "q": "야경", "where": "검색 결과 | 크게 보기 | 모아 보기 | 되돌리기"}],
  "appVersion": "2026-10-27.2", "poolVer": "rs_pool_ver 값", "poolSize": 200, "sessionAt": "ISO (시작 버튼)",
  "shows": [ … ], "previews": [ … ],
  "photoMeta": {"pool_…": {"name": "…jpg", "contains": ["plant", "rug"], "ar": 0.6659}}
}
```

- `queries[]`에는 2026-10-27.2부터 `hits`(맞은 사진 수), `padded`(나머지로 채웠는지)도 붙는다. 2026-10-27.5부터 `via`: `typed`(검색창) | `chip`(시작 단어). 예전 기록은 없음.
- `appVersion`부터 아래 필드는 새 기록에만 있다. 예전 기록(필드 없음)도 그대로 불러오고 화면·CSV에서는 빈칸/"이전 버전 기록"으로 나온다. 고칠 때 이 호환을 깨지 않는다.
- `sheet`(2026-10-27.4부터, 선택): 시트 보내기 상태 `{state: 'pending'|'sending'|'sent'|'failed', at, error, code, tries, next, by, until, rows}`. 기록을 만들 때 시트 주소가 있을 때만 붙는다. 없는 기록(예전 기록, 주소 없이 만든 기록)은 자동으로 보내지 않고 손으로 보낼 때만 간다.
- `photoMeta`는 기록에 나온 모든 사진(노출·크게 보기·담기·최종)의 이름·타깃 요소·비율을 기록 순간 그대로 적어 둔 것(`photoMetaFor`). 풀이 나중에 바뀌어도 노출 분석이 된다.

- 최종 결정 순간 `archiveCurrent('완료')`로 자동 저장된다.
- 최종 전에 새 참여자를 시작하거나 `미완료로 끝내기`를 하면 `resetSession()`이 `archiveCurrent('미완료')`를 부른다. 담은 사진이 없어도 검색을 한 번이라도 했으면 남긴다(노출 기록을 잃지 않게).
- `queries`는 검색 버튼/Enter를 누를 때마다 쌓이고, 최종 결정 뒤에는 쌓이지 않는다.
- `liked[].qn/q`는 그 사진을 **마지막으로 담은** 검색이다.

`participants.csv` 열(`archiveCSV`): `no, researcher, participant_id, status, started_at, finished_at, query_count, queries, liked_count, liked_with_query, unliked_count, final_query, liked_files, final_file, final_in_liked_order`, 그 뒤에 2026-10-27.2부터 `app_version, pool_ver, impressions_total, impressions_in_viewport, unique_photos_seen, unique_photos_in_viewport, previews_count, preview_dwell_ms_total, padded_queries`(예전 기록은 빈칸, `impStats`). 한 칸 안의 여러 값은 ` | `로 잇고, `liked_with_query`는 `사진@검색번호:검색어` 형식이다. 앞 열 순서는 바꾸지 않는다(뒤에만 붙인다).

- `impressions_total`: 모든 묶음에 그린 사진 칸 수(같은 사진을 다시 그리면 다시 셈). `impressions_in_viewport`: 그중 화면에 50% 이상 들어온 칸 수
- `unique_photos_seen`: 그리거나 크게 본 서로 다른 사진 수. `unique_photos_in_viewport`: 화면에 들어온 서로 다른 사진 수
- `padded_queries`: 맞은 사진이 12장보다 적어 나머지로 채운 검색 수

`impressions.csv`(`impressionsCSV`, 기록 ZIP 안): 노출 한 건 = 한 줄. 검색 결과에 그린 사진 한 장(`source` = search·more·return·reload·rerender, `context` = search) 또는 크게 보기 한 번(`source` = preview, `context` = search·saved). 열: `researcher, participant_id, record_no, status, app_version, pool_ver, event_no, query_no, query, source, context, shown_at, photo_id, photo, rank, is_match, padded, hits, in_viewport, first_visible_at, tile_w, tile_h, viewport_w, viewport_h, preview_via, dwell_ms, contains, has_plant, has_rug, has_lamp, has_art, has_bedding, aspect_ratio, liked_at_end, is_final, query_via`. 맨 끝 `query_via`는 2026-10-27.5부터(그 줄의 검색이 `typed`인지 `chip`인지. 노출 줄은 `shows[].via`, 없으면 `queries[qn-1].via`; 크게 보기 줄은 `queries[qn-1].via`; 예전 기록은 빈칸). 앞 열은 그대로이고 뒤에만 붙였다. `contains`는 타깃 요소 이름을 `;`로 이은 것(`photoMeta` 우선, 없으면 지금 풀). 예전 기록은 줄이 없다.

## 구글 시트 연결 (2026-10-27.4, 선택)

기록을 브라우저 + ZIP에 더해 구글 시트(운영 시트 사본의 `검색 기록`·`검색 노출`·`검색 담기` 탭)에도 한 벌 보낸다. Apps Script 코드와 설치 안내는 저장소 **밖** `1027_prep/sheet_connector/`(`search_to_sheet.gs`, `설치_안내.md`)에 있다(웹 앱 주소·토큰이 공개 저장소에 들어가지 않게).

- 설정: 연구자 화면 `참여자 기록` 탭의 `시트 연결`(`sheetBoxHTML`/`bindSheetBox`) — 웹 앱 주소, 토큰, `연결 확인`(`sheetCheck`: GET으로 `{ok, app:'search-to-sheet'}` 확인 → POST `{action:'ping', token}`으로 토큰 확인). `rs_sheet`에 저장.
- 줄은 **도구가 만든다**(`sheetRows`): `{기록|노출|담기: {columns, values}}`. 노출은 `impressionRows`(= `impressions.csv`와 같은 함수, `IMP_HEAD` 순서), 기록 요약은 `impStats`·`finalQueryOf`(= `participants.csv`와 같은 계산), 담기는 `likeLog` 한 건 = 한 줄. 시트는 1행 머리글을 **열 이름으로** 찾아 넣고 `received_at`·`record_id`는 시트가 채운다. 열을 더하면 `sheetRows`와 시트 머리글 둘 다에 같은 이름으로 넣는다(시트에 없는 이름은 건너뛰고 응답의 `unknown_columns`에 나온다). 2026-10-27.5에 `IMP_HEAD` 끝에 `query_via`를 붙였으므로 시트 `검색 노출` 탭 1행 `AL1`에 머리글 `query_via`를 사람이 넣어야 그 열이 채워진다(넣기 전에도 보내기는 되고 그 열만 빠진다).
- 보내기(`sendRecord`): 본문은 문자열(text/plain), 머리글 없음 → CORS 사전 확인 없음. Apps Script의 302 이동을 fetch가 따라가 JSON을 읽는다. 30초 시간 제한.
- 누가 보내나: 기록을 만든 창이 `archiveCurrent` 끝에서 `sheetKick`으로 바로 한 번 보낸다(검색 창이든 연구자 창이든). `?view=search`가 아닌 창은 `sheetPump`로 시작 1.5초 뒤·5초마다 `sheetDue`인 기록(대기, 기다림이 끝난 실패, 주인이 사라진 `sending`)을 다시 보낸다. 실패 뒤 기다림 `SHEET_BACKOFF` 15·30·60·120·300초. 불러온 기록(`imported`)은 자동으로 보내지 않는다.
- 겹쳐 보내기 막기: 보내기 전에 기록에 `{state:'sending', by: TAB_ID, until: +45초}`를 적고 200ms 뒤 다시 읽어 내 표시가 남아 있을 때만 보낸다(사진 풀 잠금과 같은 방식). 보내는 사이 기록이 고쳐지면(참여자 ID 수정 → `pending`) `sent`로 덮지 않고 다시 보낸다. 시트도 같은 `record_id` 줄을 세 탭에서 지우고 다시 붙이므로(LockService) 혹시 두 번 가도 한 벌만 남는다.
- 참여자 ID를 고치면 이미 보낸 기록은 4초 뒤 다시 보낸다. 주소·토큰을 바꾸면 실패한 기록의 기다림을 없앤다.
- 화면: 카드 배지 `시트 저장됨`/`시트 대기`/`시트 보내는 중`/`시트 실패 · 이유`/`시트 안 보냄`(주소가 있을 때만), 카드별 `시트로 (다시) 보내기`, 위의 `시트로 다시 보내기 (모두 N)`(보이는 기록 중 불러온 것 빼고 아직 안 간 것). 참여자 화면에는 아무것도 없다. 실패해도 참여자 진행에 영향이 없다.
- 시트 쪽 글자 보존: 글자가 있는 열은 붙이기 전에 `@`(일반 텍스트) 형식으로 바꾸고, `=`로 시작하는 글자는 앞에 `'`를 붙인다(`-러그`, `0123` 같은 검색어가 수식·숫자가 되지 않게). 숫자는 숫자로 들어간다.
- 시험: Apps Script는 여기서 배포할 수 없으므로 `.gs`를 가짜 SpreadsheetApp 위에서 Node로 단위 시험하고, 같은 가짜를 쓰는 흉내 웹 앱(302 → JSON, `Access-Control-Allow-Origin: *`)에 실제 도구를 Playwright로 붙여 확인했다.

## 검색 동작

- `runSearch(q, seed)`: 검색어를 토큰으로 나누고(조사 떼기, `-단어`·"○○ 없는/빼고"는 제외어), 사진 태그와 영어 동의어 사전 `SYN`에 맞는 개수로 점수를 매긴다. 동점은 시드 해시로 섞는다. 일치가 12장 미만이면 나머지 사진으로 24장까지 채운다. 태그가 검색어를 품으면 1점, 검색어가 태그를 품기만 하면 0.5점(턴테이블 → 테이블)이다. 한 글자 검색어(책·꽃·옷 등)는 태그·동의어와 똑같을 때만 걸린다. `ROOM_WORDS`(방·침실·원룸·자취방·침대·벽·천장·공간·인테리어·사진 등)는 점수에서 빼고, `N평`은 10평 이하면 `좁은`으로 읽고, 끝의 `톤·색·처럼·랑·만·하게` 등은 떼어 읽는다(베이지톤 → 베이지, 소파랑 → 소파).
- 태그 어휘는 `TAG_GROUPS`(분위기, 스타일, 색, 빛·시간대, 소재·질감, 패턴, 가구, 침대, 조명, 소품·장식, 생활감, 공간·전망, 반려동물 — 95개)에 있고, `.claude/skills/room-pool/vocab.json`과 같게 유지한다. 방 종류(침실·원룸 등)는 일부러 태그로 달지 않는다: 그런 검색어로 결과가 걸러지지 않게 하려는 것이다.

## 주요 함수

- 연구자: `render`, `renderPool`, `drawGrid`, `drawEditor`, `addFiles`, `exportPool`, `importPool`, `confirmDelete`, `askParticipantId`, `renderArchive`, `archiveCSV`, `exportArchiveZip`
- 연구자(진행 표시): `renderTopRight`(다음 참여자 받기 포함), `updateLive`(1초마다 숫자 칸), 기록 요약 `impStats`, 노출 CSV `impressionsCSV`
- 참여자: `renderSearchUI`, `submitQuery(q, via)`, `doSearch`, `drawResults(source, before)`, `layoutMasonry`/`masonry`(칸 배치, `arOf`·`masonryCols`), `sizePreview`, `toggleLike`(likeLog 기록), `syncLikes`/`syncFinishBar`(아래 고정 줄), `renderSavedUI`, `removeSaved`/`undoToast`, `confirmFinal`, `renderDoneUI`, `nextParticipant`, `renderStartUI`, `openPreview(id, list, fromSaved, via)`, `restoreResults`
- 노출 기록: `logShow`, `observeTiles`(IntersectionObserver), `measureTiles`, `pvOpen`/`pvClose`
- 시트: `sheetCfg`, `sheetRows`, `sendRecord`, `sheetKick`, `sheetPump`, `sheetCheck`, `sheetBadge`, `sheetBoxHTML`/`bindSheetBox`, 노출 줄 `impressionRows`
- 공통: `archiveCurrent`, `photoMetaFor`, `resetSession`, `savePick`/`savePickSoon`(400ms 모아 저장), `saveArch`, `urlFor`(blob URL 캐시), `ensureAspect`

## 작업 방식

- 바꾸기 전에 사용자와 구현 방향을 짧게 합의한다. 사용자는 단계별로 요구를 다듬어 가는 편이다.
- 고친 뒤에는 Playwright(헤드리스 Chromium)로 실제 흐름을 돌려 확인한다(1440×900, 390×844, 다크 모드 흉내에서도 밝은지): 사진 넣기 → 새 참여자 시작(ID) → 검색 여러 번 → 담기/빼기 → 새로고침 → 모아 보기 → 최종 결정 → 연구자 화면 → 참여자 기록·CSV. `node --check`로 스크립트 문법도 확인한다.
- 화면 문구는 짧고 평이한 한국어로 쓰고, 참여자 화면에는 연구 의도가 드러나는 말을 쓰지 않는다.
- 삭제처럼 되돌릴 수 없는 동작은 "한 번 더 누르기" 확인을 둔다(`confirm()`은 쓰지 않는다).

## 남은 일

- [ ] **사진별 CSV** (제안만 함, 사용자 답 대기): 담은 사진 한 장 = 한 줄. 열 `participant_id, photo, query_no, query, liked_at, where, is_final`. 참여자 기록 탭에 내보내기 버튼으로 추가. (노출 한 건 = 한 줄인 `impressions.csv`는 기록 ZIP 안에 생겼다. 담기 기록은 아직 `participants.json`의 `likeLog`에만 있다)
- [x] 결과 배치를 원래 비율을 유지하는 masonry로 바꿈(2026-10-27.3). `drawResults`의 `logShow`·`observeTiles`·`measureTiles` 호출은 그대로이고, 배치가 바뀔 때마다 `measureTiles`를 다시 부른다.
- [ ] 진행 대본(1026)은 "최소 4장", "연구자에게 알려 주세요."를 누른다고 되어 있다. 도구는 장수 제한이 없고, 참여자 화면에는 다음으로 넘기는 버튼이 없으며(연구자 창 `다음 참여자 받기`), 과제 문장이 "…사진을 한 장 골라 주세요"로 바뀌었으니 대본을 맞춰야 한다.
- [ ] 시트 `검색 노출` 탭 `AL1`에 머리글 `query_via` 넣기 (사용자가 직접).
- 시트 연결을 켜도 기록 원본은 브라우저 localStorage이고, 시트는 추가 사본이다. 그래서 여전히 세션마다 기록 ZIP으로 백업하도록 안내되어 있다. 연구자 3명이 각자 PC에서 진행하고(참여자 P01~P12를 미리 나눠 배정), 나중에 의현이 각자의 ZIP을 `기록 불러오기`로 한 화면에 합친다. 새 기록 번호(`no`)는 같은 진행자의 자기 기록만 보고 매긴다(불러온 기록 제외).
