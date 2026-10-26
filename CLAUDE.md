# 검색 조건 사진 고르기 도구 · 인수인계

`search_system.html`은 실험의 검색 조건에서 참여자가 방 사진을 검색하고, 마음에 드는 사진을 모아, 최종 1장을 고르는 단일 HTML 도구다. 이 문서는 Claude Code가 이 파일을 이어서 작업하기 위한 정리다. 사용자와의 대화와 화면 문구는 모두 **한국어**로 한다.

## 파일

- `search_system.html` 하나. 빌드 없음.
- 맨 위에 반드시 `<!doctype html>`, `<html lang="ko">`, `<meta charset="utf-8">`가 있어야 한다(없으면 로컬에서 열 때 한글이 깨진다).
- 외부 의존성은 JSZip(cdnjs, ZIP 내보내기·불러오기)과 Google Fonts(IBM Plex Sans KR / Mono)뿐이다. 둘 다 없어도 핵심 기능은 동작한다.

## 화면 구성

1. **연구자 화면** (기본)
   - 오른쪽 위 `새 참여자 시작` → 참여자 ID 입력 모달(비우면 진행 안 됨) → 검색 화면. 진행 중인 참여자가 있으면 `P03 이어서 진행` 버튼도 나온다.
   - 탭 `사진 풀 관리`: 사진 추가(드래그/파일/폴더, `pool.csv`를 함께 넣으면 태그 자동 적용), 태그 편집(Ctrl/⌘·Shift 다중 선택), 선택·전체 삭제(두 번 눌러야 삭제, Delete 키 지원), 풀 내보내기·불러오기(ZIP: `pool.csv` + `photos/*.jpg`). `pool.csv` 열은 `file, tags, contains`이고 tags는 `;`로 구분한다.
   - 탭 `참여자 기록`: 참여자별 카드(ID 수정 가능, 완료/미완료, 검색어 목록, 담은 사진과 각각을 담은 검색, 최종 사진), `CSV 내보내기`, `기록 + 최종 사진 (ZIP)`.
2. **참여자 검색 화면** (구글 이미지 검색처럼 검색창만 있음)
   - 결과 사진의 하트 = "마음에 든 사진"에 담기/빼기. 크게 보기 모달에서도 담을 수 있다.
   - `마음에 든 사진 N` 버튼 → 모아 보기 → 한 장 선택 → `이 사진으로 결정` → 확인 모달 → 완료 화면.
   - 완료 화면의 "연구자에게 알려 주세요." 문구를 누르면 연구자 화면으로 돌아간다. 다른 화면에서는 Ctrl+Shift+R 또는 오른쪽 아래 작은 점(연구자 패널)으로 나간다.
   - 참여자 화면에는 다운로드 버튼이 없고 담기 개수 제한도 없다(둘 다 의도된 것).

## 상태와 저장소

| 저장소 | 키 | 내용 |
| --- | --- | --- |
| IndexedDB | DB `room-search-pool`, store `photos` | 사진 레코드 `{id, name, tags[], contains[], blob, thumb, addedAt}`. blob은 긴 변 1600px JPEG, thumb은 420px |
| localStorage | `rs_pick` | 진행 중 참여자 `P`: `{pid, liked[], final, view, active, _sel, startedAt, finishedAt, queries[], likeLog[], archivedId}` |
| localStorage | `rs_archive` | 참여자 기록 배열 `ARCH` |
| localStorage | `rs_settings`, `rs_sessions` | 예전 버전의 흔적. 지금 화면에서는 쓰지 않는다 |

`contains`는 사진에 보이는 타깃 요소(식물·러그·스탠드 조명·벽 그림·따뜻한 조명)를 **보이면 다** 적은 표시로, 나중에 요소 포함 비율을 맞추는 데 쓴다. 타깃 요소는 태그(`식물·러그·액자·스탠드·따뜻한조명`)로도 달려 검색되고, room-pool 스킬의 `build_pool.py`가 이 태그에서 `contains`를 자동으로 채운다. 검색에서 빼지는 않는다(`isExcluded = () => false`).

참여자 기록 한 건 (`ARCH[i]`):

```json
{
  "id": "a…", "no": 1, "label": "P01", "status": "완료 | 미완료",
  "startedAt": "ISO (첫 검색 또는 첫 담기)", "finishedAt": "ISO",
  "queries": [{"q": "아늑한 침실", "at": "ISO"}],
  "liked": [{"id": "…", "name": "J11_의현.jpg", "qn": 1, "q": "아늑한 침실", "likedAt": "ISO"}],
  "final": {"id": "…", "name": "J01_연수.jpg"},
  "likeLog": [{"action": "담기 | 빼기", "id": "…", "name": "…", "at": "ISO", "qn": 2, "q": "야경", "where": "검색 결과 | 크게 보기 | 모아 보기"}]
}
```

- 최종 결정 순간 `archiveCurrent('완료')`로 자동 저장된다.
- 최종 전에 새 참여자를 시작하면 `resetSession()`이 `archiveCurrent('미완료')`를 부른다.
- `queries`는 검색 버튼/Enter를 누를 때마다 쌓이고, 최종 결정 뒤에는 쌓이지 않는다.
- `liked[].qn/q`는 그 사진을 **마지막으로 담은** 검색이다.

CSV 열: `no, participant_id, status, started_at, finished_at, query_count, queries, liked_count, liked_with_query, unliked_count, final_query, liked_files, final_file, final_in_liked_order`. 한 칸 안의 여러 값은 ` | `로 잇고, `liked_with_query`는 `사진@검색번호:검색어` 형식이다.

## 검색 동작

- `runSearch(q, seed)`: 검색어를 토큰으로 나누고(조사 떼기, `-단어`·"○○ 없는/빼고"는 제외어), 사진 태그와 영어 동의어 사전 `SYN`에 맞는 개수로 점수를 매긴다. 동점은 시드 해시로 섞는다. 일치가 12장 미만이면 나머지 사진으로 24장까지 채운다. 태그가 검색어를 품으면 1점, 검색어가 태그를 품기만 하면 0.5점(턴테이블 → 테이블)이다. 한 글자 검색어(책·꽃·옷 등)는 태그·동의어와 똑같을 때만 걸린다. `ROOM_WORDS`(방·침실·원룸·자취방·침대·벽·천장·공간·인테리어·사진 등)는 점수에서 빼고, `N평`은 10평 이하면 `좁은`으로 읽고, 끝의 `톤·색·처럼·랑·만·하게` 등은 떼어 읽는다(베이지톤 → 베이지, 소파랑 → 소파).
- 태그 어휘는 `TAG_GROUPS`(분위기, 스타일, 색, 빛·시간대, 소재·질감, 패턴, 가구, 침대, 조명, 소품·장식, 생활감, 공간·전망, 반려동물 — 94개)에 있고, `.claude/skills/room-pool/vocab.json`과 같게 유지한다. 방 종류(침실·원룸 등)는 일부러 태그로 달지 않는다: 그런 검색어로 결과가 걸러지지 않게 하려는 것이다.

## 주요 함수

- 연구자: `render`, `renderPool`, `drawGrid`, `drawEditor`, `addFiles`, `exportPool`, `importPool`, `confirmDelete`, `askParticipantId`, `renderArchive`, `archiveCSV`, `exportArchiveZip`
- 참여자: `renderSearchUI`, `drawResults`, `toggleLike`(likeLog 기록), `renderSavedUI`, `confirmFinal`, `renderDoneUI`, `openPreview`
- 공통: `archiveCurrent`, `resetSession`, `savePick`, `saveArch`, `urlFor`(blob URL 캐시)

## 작업 방식

- 바꾸기 전에 사용자와 구현 방향을 짧게 합의한다. 사용자는 단계별로 요구를 다듬어 가는 편이다.
- 고친 뒤에는 Playwright(헤드리스 Chromium)로 실제 흐름을 돌려 확인한다: 사진 넣기 → 새 참여자 시작(ID) → 검색 여러 번 → 담기/빼기 → 새로고침 → 모아 보기 → 최종 결정 → 연구자 화면 → 참여자 기록·CSV. `node --check`로 스크립트 문법도 확인한다.
- 화면 문구는 짧고 평이한 한국어로 쓰고, 참여자 화면에는 연구 의도가 드러나는 말을 쓰지 않는다.
- 삭제처럼 되돌릴 수 없는 동작은 "한 번 더 누르기" 확인을 둔다(`confirm()`은 쓰지 않는다).

## 남은 일

- [ ] **사진별 CSV** (제안만 함, 사용자 답 대기): 담은 사진 한 장 = 한 줄. 열 `participant_id, photo, query_no, query, liked_at, where, is_final`. 참여자 기록 탭에 내보내기 버튼으로 추가.
- [ ] 기록은 브라우저 localStorage에만 있으므로 세션마다 CSV/ZIP으로 백업하도록 안내되어 있다. 필요하면 기록 불러오기(JSON 가져오기) 기능을 검토.
