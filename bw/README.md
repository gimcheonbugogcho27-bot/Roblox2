# 블록월드 2 - 게임 선택형 플랫폼

사용자가 제공한 `index.html` 내부의 Base64 게임 소스 4개를 추출해 각각 독립 HTML로 분리하고, 게임 선택 화면에서 실행하도록 구성했습니다.

## 추출된 게임
- `speed.html` — +1 스피드 키보드 탈출 3D
- `egg.html` — 계란 서리단
- `rivals.html` — RIVALS 3D
- `blockblast.html` — 블록 블라스트

## GitHub 업로드
압축을 해제한 뒤 프로젝트 최상위의 `package.json`, `index.html`, `server.js`, `src/`, `public/games/`를 GitHub 저장소에 업로드합니다.

## Render 설정
일반 업로드 방식:
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

ZIP 자체를 저장소에 올리는 방식(파일명 `blockworld2-platform-login.zip`):
- Build Command: `unzip -o blockworld2-platform-login.zip -d app && cd app && npm install && npm run build`
- Start Command: `cd app && npm start`

## Render 환경변수
- `VITE_SUPABASE_URL`: Supabase Project URL
- `VITE_SUPABASE_ANON_KEY`: Publishable key 또는 legacy anon public key

Supabase의 Realtime 기능을 활성화하세요. 이 버전은 Realtime Broadcast/Presence를 사용하므로 별도 SQL 테이블은 필요하지 않습니다. service_role 또는 secret 키는 절대 사용하지 마세요.

## 온라인 기능과 제한
Supabase로 같은 월드 코드에 접속한 사용자들의 온라인 상태와 채팅, 누가 어떤 게임을 실행했는지 알림을 공유합니다.
중요: 추출한 네 게임의 원본 코드는 각각 독립 게임입니다. 따라서 게임 내부의 캐릭터·점수·맵 진행 상태가 서로 동기화되는 실시간 협동/대전 멀티플레이는 아직 구현되지 않았습니다. 각 게임별 네트워크 동기화 코드를 별도로 추가해야 합니다.

## 실행
같은 사이트에 접속한 뒤 동일한 월드 코드를 입력합니다. 게임 목록에서 카드를 누르면 해당 게임이 실행되고, `게임 목록` 버튼으로 돌아옵니다.


## 멀티플레이 캐릭터 동기화
- 같은 월드 코드에 접속한 뒤 **같은 게임**을 실행하면 3D 게임 화면에서 서로의 캐릭터를 볼 수 있습니다.
- `speed`, `egg`, `rivals` 게임에서 위치와 방향을 Supabase Realtime Broadcast로 동기화합니다.
- `blockblast`는 퍼즐 게임이라 3D 캐릭터가 없습니다.
- 게임 내 점수, 아이템, 총알 판정, 맵 진행도까지 공유하는 완전한 협동/대전 동기화는 별도 구현이 필요합니다.
- 이 업데이트도 기존과 동일하게 Supabase URL 및 Publishable/anon public key 환경변수를 사용하며, 추가 SQL은 필요하지 않습니다.


## 계정 로그인·저장 및 스피드 게임 관리자 기능
1. Supabase SQL Editor에서 `supabase/setup.sql` 전체를 실행합니다.
2. 사이트에서 관리자 계정을 먼저 회원가입합니다. Supabase Authentication > Users에서 해당 계정의 UUID를 복사합니다.
3. SQL Editor에서 `insert into public.speed_game_admins(user_id) values ('여기에-관리자-UUID');`를 실행합니다. 관리자 등록은 한 번만 합니다.
4. 학생은 각자 이메일/비밀번호로 계정을 만들고 로그인한 뒤 월드에 입장합니다. 스피드 게임의 스피드·코인·승리·환생·아이템 등 저장 데이터는 계정에 연결되어 기기를 바꾸어도 불러옵니다.
5. 관리자 계정으로 로그인하고 스피드 게임의 Admin 패널을 열어 기존 비밀번호 잠금을 해제하면 전체 서버 어뷰즈와 접속 플레이어별 스탯 초기화 도구가 표시됩니다.

주의: Supabase Authentication에서 이메일 확인이 켜져 있으면 회원가입 후 메일 인증을 해야 로그인할 수 있습니다. 테스트용 학급 환경에서는 Authentication 설정의 이메일 확인 정책을 확인하세요. `service_role` 키는 Render 환경변수나 브라우저에 넣지 마세요.

## 플랫폼 공통 로그인 및 게임별 저장 확장
- 로그인은 개별 게임 내부가 아니라 BLOCKWORLD 2 플랫폼에서 한 번만 합니다. 로그인 세션은 Supabase Auth에 유지되며 게임을 바꾸어도 같은 계정이 사용됩니다.
- `speed` 저장은 `speed_game_saves`, `egg`와 `blockblast` 저장은 `platform_game_saves`에 계정별로 저장됩니다.
- `rivals`는 현재 라운드형 게임으로 영구 진행 데이터(레벨/인벤토리 등)가 없어 계정별 진행 저장 대상은 아닙니다.
- 기존 Supabase 사용자는 `supabase/setup.sql`의 추가된 `platform_game_saves` 부분도 SQL Editor에서 실행해야 합니다. 이미 앞부분을 실행했다면 파일의 마지막 플랫폼 저장 SQL 블록만 실행해도 됩니다.


## 학생 27명 사전 계정 생성
- 로그인 화면은 이메일 대신 아래 학생 ID를 입력하도록 변경되었습니다.
- 모든 계정의 초기 비밀번호는 `44class`입니다.
- 계정 이메일은 내부 로그인용으로 `bw2student01@blockworld2.invalid`부터 `bw2student27@blockworld2.invalid`까지 자동 매핑됩니다. 학생은 내부 이메일을 입력하지 않습니다.
- Render 환경변수에 `SUPABASE_SERVICE_ROLE_KEY`와 `CLASS_ACCOUNT_SETUP_SECRET`을 추가하세요. `SUPABASE_SERVICE_ROLE_KEY`는 Supabase의 service_role/secret 키이며 서버에서만 사용합니다. `VITE_` 접두사를 붙이지 마세요. `CLASS_ACCOUNT_SETUP_SECRET`에는 충분히 긴 임의 문자열을 지정하세요.
- Render 재배포 후 로그인 화면에서 `학생 계정 일괄 준비`를 누르고 `CLASS_ACCOUNT_SETUP_SECRET` 값을 입력하면 27개 계정이 생성됩니다. 이미 있는 계정은 비밀번호를 `44class`로 재설정하고 표시 이름을 갱신합니다.
- 학생 로그인은 학생 ID와 `44class`를 사용합니다. 회원가입 이메일 인증은 사용하지 않습니다.
- 일괄 생성이 끝나면 보안을 위해 Render에서 `CLASS_ACCOUNT_SETUP_SECRET` 값을 변경하거나 삭제하고 다시 배포하세요. `SUPABASE_SERVICE_ROLE_KEY`는 계속 서버 환경변수에만 보관하세요.
- 주의: 공통 비밀번호는 계정 간 구분이 약합니다. 학생들이 서로의 ID를 알고 있으면 다른 학생 계정에도 로그인할 수 있습니다. 실제 운영에서는 개인별 비밀번호로 변경하는 것을 권장합니다.

## 추가된 모바일 3D 게임
- `tower.html` — 아무도 못 깨는 타워: 10층 타워 점프맵 (일반/하드 모드, 층별 체크포인트, 다른 학생 위치 표시, 계정별 기록 저장)
- `forest99.html` — 사용자가 제공한 99밤 숲속 생존 3D 게임
- 다섯 게임 모두 왼쪽 가상 조이스틱 이동, 오른쪽 드래그 시점 회전, 행동/점프 버튼을 지원합니다.
- 기존 4개 게임은 그대로 유지했습니다. 새 게임들은 원작의 공식 에셋이 아닌 독립적인 간단한 3D 미니게임 구현입니다.

### 3D game polish update
- The five added games now use improved 3D rendering, higher-quality lighting, soft shadows, richer scene dressing and more detailed player presentation.
- DOORS: hotel corridor trim, ceiling details, wall lights and furniture.
- BedWars: floating-island cliffs, team structures, bed models and bridge details.
- Grow a Garden: farm fencing, orchard trees, greenhouse and decorative flower beds.
- Steal a Brainrot: neon collector plaza, vault, display plinths and luminous accents.
- 99 Nights in the Forest: improved tone mapping, shadowing and mobile rendering budget.
- These are original, simplified recreations inspired by the named game concepts; they do not reproduce proprietary original maps, models, sounds or complete online systems.

### 업그레이드 v3 (DOORS / Grow a Garden / Steal a Brainrot)
- 상점 강화·코인·레벨은 계정별로 저장됩니다 (`supabase/setup.sql` 마지막 블록 실행 필요).

## +1 스피드 키보드 탈출 — 맵 구조 / 장애물 다양성 / 밸런스 패치
`public/games/speed.html`의 스테이지 생성기(`build`)를 다시 만들었습니다. 저장 데이터 형식은 그대로라 기존 진행도·기록이 유지됩니다.

### 맵 구조
- 스테이지 = **구간(점프 / 회피 / 타이밍 테마)** 반복 + 구간 끝 **휴식 발판(📍체크포인트)**. 구간 시작·끝에 표지판, HUD에 `구간 n/N · ⏱현재/목표` 표시.
- **월드별 장애물 풀**: 캔디(기본기) → 초콜릿(컨베이어·통나무·프레스) → 해커(레이저·슬라이더·슬라롬) → 백룸(전부 + 복합 코스). 스테이지가 올라갈수록 새 장애물이 해금(예: 레이저·프레스는 스테이지 3부터, 복합 코스는 5부터).
- 같은 장애물 연속 금지, 고위험 장애물(레이저·프레스·통나무·바·복합) 3연속 금지, 고위험 뒤 확률적 숨 고르기 발판.
- 체크포인트 간격 상한(구간당 약 55칸 이후 마무리). 발판 가장자리에 라이트 추가.

### 새 장애물 (기존: 구멍·가시·회전 바·무버·레이저·부서지는 키·계단)
| 종류 | 설명 |
|---|---|
| 징검다리 / 지그재그 섬 | 연속 점프, 좌우로 엇갈린 섬 |
| 슬라이더 | 좌우로 움직이는 발판(위에 타면 함께 이동) |
| 외나무다리 | 폭 2.6의 좁은 길, 고난도는 중간이 끊김 |
| 허들 | 낮은 장벽 — 점프하거나 빈 쪽으로 회피 |
| 통나무 | 굴러오는 통나무(전폭/반폭) |
| 슬라롬 | 통과 불가 벽을 지그재그로 통과 |
| 프레스 | 바닥 경고 점멸 후 내려찍기(파도형/통짜 게이트) |
| 컨베이어 | 옆/뒤로 밀림(걸음 수는 증가하지 않음) |
| 얼음 | 미끄러운 바닥 + 가시 |
| 낮은 레이저 | 점프로 통과(높은 레이저는 꺼질 때 통과) |
| 복합 코스 | 허들·낮은 레이저·가시 조합 (후반) |
| 보스 패턴 | 월드별: 단발 → 3갈래 부채꼴 → 빈 틈 탄막 → 혼합, 접근할수록 발사 간격 감소 |

### 밸런스 변경
- **레이저 스윕 판정**: 고속(13m/s+)·대시 시 프레임 사이로 레이저를 뚫고 지나가던 버그 수정.
- 🛡️ **보호막**: 스테이지당 1회 → **체크포인트마다 충전**(스테이지가 길어지고 장애물이 늘어난 것 반영).
- **클리어 보너스**: 목표 시간 이내 +25%, 노데스 +25% 코인. 목표 시간은 스테이지 선택 화면에 표시.
- 난이도 곡선: 스테이지 번호(70%) + 스테이지 내 진행도(30%)로 점진 상승. 징검다리·가시·바·무버 개수/속도가 이에 따라 증가.

## 게임 정리 (2026-11)
- DOORS / BedWars / Grow a Garden / Steal a Brainrot 삭제, 공통 파일 `bwcore.js`도 함께 삭제.
- 신규 게임 `tower.html` (아무도 못 깨는 타워) 추가 — `supabase/setup.sql` 맨 아래 SQL을 실행해야 계정별 기록이 저장됩니다.

## TOP10 랭킹 보드
`supabase/setup.sql` 맨 아래의 `speed_leaderboard` 부분을 Supabase SQL Editor에서 한 번 실행해야 스피드 키보드 탈출의 🏅 TOP10 랭킹이 표시됩니다.


## 스피드 키보드 탈출 — Ultimate Edition 품질 업그레이드
- 기존 4개 월드(총 117개 맵)의 스테이지 구성, 진행도 저장 키, 보상 구조를 유지하면서 월드 전반의 시각 효과를 개선했습니다.
- 모든 맵에 월드 테마 색상의 별빛 파티클과 네온 비콘을 추가해 코스의 공간감과 방향 가독성을 높였습니다.
- 이동형 중력 소용돌이가 실제로 좌우 이동하며 플레이어를 끌어당기도록 물리 업데이트를 연결했습니다.
- 피격 시 짧은 카메라 충격 효과와 클리어 결과의 S/A/B 등급 피드백을 추가했습니다.
- 메뉴, HUD, 버튼, 모달을 글래스/네온 스타일로 다듬고 모바일 화면 배치를 보강했습니다.
- 스테이지를 다시 만들 때 스테이지 전용 GPU 리소스를 정리하도록 해 반복 플레이 중 메모리 누적 위험을 줄였습니다.
- 기존 `speed_keyboard_escape_v1` 저장 키를 유지하므로 기존 스피드·코인·승리·환생·클리어 기록은 그대로 이어집니다.


## Galaxy World 5 업데이트
- Galaxy World 5 신규 맵 35개 추가 (총 5개 월드, 152개 맵)
- 신규 장애물 3종: 좌우 왕복 레일, 타이밍 셔터, 근접 지뢰
- 5개 맵마다 보스전 배치, 월드 5 스피드 해금 요구량은 이전 월드 마지막 스테이지 기준 8.5%씩 상승하도록 완화
- 월드 5 길이 증가폭을 완만하게 조정하고, 신규 장애물의 경고/회피 시간을 제공


## 스피드 키보드 탈출 — 안티치트 v2 · 관리자 기능 · 월드 전용 장애물
### 안티치트 강화
- 관리자 권한·전체 어뷰즈·150x 러닝머신·월드 잠금 상태는 **플랫폼(부모 창)이 보낸 진짜 메시지**로만 바뀝니다. 콘솔이나 가짜 postMessage로는 관리자 권한을 얻을 수 없습니다.
- 감지 항목: 순간이동(프레임 사이 위치 변조), 속도 핵(커스텀 속도·대시 상한 초과), 슈퍼 점프, 공중 부양, Fly/Noclip/러닝머신 등 관리자 도구 무단 사용, 이벤트·버프·포션·무적·보호막 변조, 스탯(스피드·코인·승리·환생·아이템·클리어 기록) 급증 → 직전 값으로 되돌림, 가짜 클리어(결승선에 도달하지 않은 클리어), 잠긴 스테이지 강제 입장.
- `hurt`, `update`, `mult` 등 핵심 함수는 덮어쓸 수 없게 잠겼습니다.
- 감지되면 로비로 이동하고, 같은 월드에 접속한 **관리자에게 "⚠️ 부정행위 감지: 이름 (사유)" 알림**이 갑니다. 비정상 저장값(NaN·음수 등)은 서버에 저장되지 않습니다.
- 버그 수정: 투사체/폭탄에 맞는 순간 게임이 멈출 수 있던 오류.

### Admin 패널 추가
- 맨 위 상태판: **🚨 관리자 어뷰즈 남은 시간(분·초)**, 업데이트 예고 남은 시간, 잠긴 월드 목록. 어뷰즈 버튼에도 남은 시간이 표시되고, 늦게 들어온 학생도 실제 남은 시간으로 맞춰집니다.
- **⏳ 업데이트 예고**: 몇 분 뒤인지 입력(1~1440분) + 안내 문구 → 모든 플레이어 화면 위쪽에 "🛠️ 업데이트까지 12분 03초" 카운트다운(1분 이하 빨간색). 취소 버튼으로 끌 수 있습니다.
- **🔒 월드 잠금**: W1~W15 버튼으로 고른 뒤 "잠금 적용" → 전체 서버에서 해당 월드 입장 불가(로비 1-1은 항상 열림). 잠긴 월드에 있던 학생은 로비로 이동합니다. 관리자는 잠긴 월드도 입장할 수 있습니다.
- ⚠️ `supabase/setup.sql` 맨 아래 SQL을 실행해야 업데이트 예고·월드 잠금이 저장되어 새로 들어온 학생에게도 적용됩니다. (실행 전에도 접속 중인 학생에게는 실시간으로 적용)

### 월드마다 완전히 다른 장애물
15개 월드가 장애물을 하나도 공유하지 않습니다. 새 장애물 32종은 모양뿐 아니라 움직임·피하는 방법이 모두 다릅니다. 보스 모양도 월드마다 다릅니다.
| 월드 | 전용 장애물 |
|---|---|
| 1 | 기본 장애물 (징검다리·가시·허들·계단·회전 바·레이저·프레스·통나무 등) |
| 2 | 운석 · 공전 위성 · 블랙홀 · 충격파 |
| 3 | 🫧거품 리프트(올라가다 터지는 발판) · 🪼해파리(위아래로 떠다님) · 🌀소용돌이 해류(빙글 밀림) · ⛲간헐천 발사대(위에서 기다리면 발사) |
| 4 | 프리즘 장벽 · 중력 소용돌이 · 위상 발판 · 극성 자기장 |
| 5 | 왕복 레일 · 타이밍 셔터 · 근접 지뢰 · ⬛체커 전류판 |
| 6 | 화염 분출구 · 풍차 칼날 · 진자 도끼 · 용암 범람 |
| 7 | 테슬라 아크 · 측면 피스톤 · 승강 발판 · 레일 톱날 |
| 8 | 추적 유령 · 투명 다리 · 폭격 드론 · 공허 구체 |
| 9 | 얼음 바닥 · 🧊고드름 낙하 · ⛄벽에 튕기는 눈덩이 · 🧊앞뒤로 떠다니는 유빙 |
| 10 | 🍄포자 폭발(8방향 탄) · 🪱땅굴 웜(포물선) · 🟢점액 늪(느려짐) · 🧫세포 분열 발판 |
| 11 | 🔴🔵교대 발판 · 🔆집광 렌즈(따라오는 빛) · 💿회전 원판 · 💎수정 파동 |
| 12 | ⚡전기 뱀장어 · 🐚거대 조개(닫힘) · 🌊고수압(점프 약화) · 🦑먹물 오징어(곡사 + 시야 가림) |
| 13 | ☢️방사능 게이지 웅덩이 · 🐸돌연변이 점프꾼 · 🛢️연쇄 폭발 드럼 · 🌉뒤에서 무너지는 다리 |
| 14 | ⏳유사 늪(가라앉음) · ⏪시간 역행(되감기) · 🌪️모래 폭풍(옆바람) · ⚙️톱니바퀴 다리 |
| 15 | 🌀차원 포탈(벽 통과) · 👾글리치 블록(순간이동) · 🎵리듬 장벽 · 👤잔상 추적자 |
기존 저장 데이터(`speed_keyboard_escape_v1`)는 그대로 유지됩니다.

### 🛡️ 더블점프 구간 건너뛰기 방지 (안티 스킵)
- **공중 추가 점프(더블·트리플·쿼드) 후 수평 속도 제한**: 착지할 때까지 최대 9m/s → 점프를 연타해 구간을 날아 넘을 수 없습니다. (높이 보정·낙사 회복용으로는 그대로 쓸 수 있음)
- **보이지 않는 천장**: 마지막 착지 높이 기준 '1단 점프 + 추가 1번' 높이까지만 올라갑니다. 점프를 쌓아 장애물 위로 높이 떠서 지나가는 꼼수 차단.
- **체크포인트 건너뛰기 금지**: 공중 점프를 쓴 채 10칸 넘게 날아 체크포인트를 지나가면 인정하지 않고, 착지하는 순간 그 체크포인트로 되돌아갑니다. 체크포인트 발판 위에 착지하면 정상 인정.
- **탈출구 검증**: 모든 체크포인트를 밟지 않으면 탈출(클리어)이 되지 않습니다.
- **대시 제한**: 공중에서는 대시 1번, 공중 점프 뒤에는 대시 불가.
- **높이 4 이상의 벽(슬라롬 벽·포탈 벽)**은 점프로 넘을 수 없습니다.
- 90초 안에 건너뛰기 4번 → 로비로 이동 + 관리자에게 알림. 관리자 계정·Fly는 제외.
- 버그 수정: 스테이지를 바꿔도 이전 스테이지의 더블점프 감시가 남아 정상 플레이가 '부정행위'로 걸리던 문제.


## 🛡️ 서버 측 안티치트 API (speed-v3 통합)
1. Supabase SQL Editor에서 `supabase/setup.sql`의 맨 아래 `서버 측 안티치트` 블록을 실행합니다.
2. Render 환경변수에 `SUPABASE_SERVICE_ROLE_KEY`를 추가합니다. 이 키는 `VITE_` 접두사 없이 서버에만 저장하고 브라우저 코드에 넣지 마세요.
3. `SUPABASE_ANON_KEY`를 설정하지 않았다면 기존 `VITE_SUPABASE_ANON_KEY` 값을 서버 환경변수 `SUPABASE_ANON_KEY`에도 추가합니다.
4. 재배포 후 게임 시작 때 서버가 계정 제재 상태를 확인하고, 게임 내 안티치트 탐지 기록은 서버 DB에 저장합니다.

관리자 제재 API는 인증된 관리자만 호출할 수 있습니다: `POST /api/anticheat/admin/ban` 또는 `/unban` (Bearer access token, JSON `{"userId":"대상 UUID","reason":"사유"}`). 현재 클라이언트 탐지 보고는 증거 로그로만 저장되며, 자동 영구 밴은 오탐 및 악용을 막기 위해 수행하지 않습니다. 또한 게임 물리 계산 자체를 서버가 소유하는 완전한 서버 권한형 구조는 별도 멀티플레이어 서버 전환이 필요합니다.


## Supabase Realtime → Cloudflare Durable Objects 이전 (speed-v3)

이 버전은 플랫폼 실시간 채널(Presence/Broadcast)을 Supabase Realtime 대신 Cloudflare Durable Objects WebSocket으로 연결합니다.
Supabase Auth, 저장 테이블, 랭킹, 관리자 명령 기록, 안티치트 API는 계속 Supabase/기존 Render 서버를 사용합니다.
전환된 기능: 월드 접속자 목록, 채팅, 게임 시작 알림, 플레이어 위치, 안티치트 관리자 알림, 전역 관리자 이벤트/서버 공지, 방 단위 관리자 명령 알림.
전역 상태 복구를 위한 `speed_game_commands` 조회는 Supabase REST 요청으로 남아 있으며 Realtime 구독은 사용하지 않습니다.

### 1. Cloudflare Worker 배포
1. Cloudflare 계정에서 Workers & Pages를 엽니다.
2. 로컬 프로젝트의 `cloudflare-worker` 폴더에서 Wrangler로 배포합니다.
   - `cd cloudflare-worker`
   - `npx wrangler deploy`
3. Cloudflare Worker 설정에서 다음 Secrets를 추가합니다.
   - `SUPABASE_URL` : Supabase Project URL
   - `SUPABASE_ANON_KEY` : Supabase Publishable/anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` : Supabase service_role/secret key (Worker Secret에만 저장, 브라우저/Render의 VITE_ 변수로 넣지 않음)
4. Worker의 `wrangler.toml`에 Durable Object 바인딩과 `RoomHub` migration이 포함되어 있습니다. 최초 배포 때 migration이 적용되는지 확인하세요.
5. 배포 후 `https://<worker-name>.<account-subdomain>.workers.dev/health`가 `{"ok":true,...}`를 반환하는지 확인합니다.

### 2. Render 환경변수
기존 Supabase 환경변수는 유지하고 다음 값을 추가합니다.
- `VITE_REALTIME_URL` : Cloudflare Worker 주소 (예: `https://blockworld-realtime.<계정>.workers.dev/ws`)

Vite가 빌드할 때 이 값을 사용하므로 Render에 환경변수를 저장한 뒤 새로 배포해야 합니다.
Worker의 Supabase service role 키는 절대 `VITE_` 접두사를 붙이지 말고, Worker Secret에만 저장합니다.

### 3. 확인할 항목
- 같은 월드 코드로 브라우저 두 개에서 접속했을 때 온라인 인원 수가 바뀌는지
- 채팅이 양쪽에 전달되는지
- 같은 게임에서 플레이어 위치가 전달되는지
- 관리자 계정의 서버 공지/어뷰즈 이벤트가 다른 접속자에게 전달되는지
- 비관리자 계정은 관리자 이벤트를 발행할 수 없는지

주의: Cloudflare Worker를 배포하고 Render의 `VITE_REALTIME_URL`을 설정하기 전에는 새 버전의 월드 접속이 되지 않습니다. 기존 Supabase Realtime 프로젝트/테이블은 삭제하지 마세요. 이 변경은 실제 Cloudflare 계정에 배포하거나 동작 검증한 상태가 아닙니다.
