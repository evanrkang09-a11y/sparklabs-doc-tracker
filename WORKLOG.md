# 작업 기록 — 서류 취합 트래커 (미니과제)

**Work log — Document Collection Tracker (mini-project)**

작성자 / Author: Evan Kang
날짜 / Date: 2026-08-11
배포 링크 / Live app: https://sparklabs-doc-tracker.vercel.app

> 다음 기수 인턴을 위한 참고 자료입니다. 프롬프트 원문과 막혔던 지점을 그대로 남겼습니다.
> Written for the next intern. The prompts and the dead ends are recorded as they actually happened.

---

## 1. 무엇을 만들었나 / What this is

기업이 제출해야 할 서류 목록을 보여주고, 구글 드라이브 폴더를 감시해서 무엇이 제출됐고 무엇이 미비한지 화면에 표시하는 웹 앱입니다.

A web page that shows the documents a company owes us, watches a Google Drive folder, and reports which ones have arrived and which are still missing.

현재 상태 / Current state: **9건 중 1건 미비** (재무제표) — 멘토님의 실제 샘플 드라이브 폴더 기준.

### 기술 스택 / Stack

| | |
|---|---|
| Framework | Next.js 16.3 (App Router) + React 19.2 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Drive 연동 | `googleapis`, service account, read-only scope |
| 배포 | Vercel |

### 파일 구조 / Where the code lives

| 파일 | 역할 |
|---|---|
| `lib/documents.ts` | 필수 서류 목록 + 파일명 매칭 로직. **여기만 고치면 서류 목록이 바뀝니다.** |
| `lib/drive.ts` | 구글 드라이브 폴더의 파일명 목록을 가져옴 |
| `app/api/documents/route.ts` | 파일명을 서류에 매칭하고 미비 건수를 계산 |
| `app/page.tsx` | 화면. 5초마다 자동 새로고침 |
| `scripts/list-drive.mjs` | 개발용 도구 — 드라이브 폴더 내용을 ID와 함께 출력 |
| `sample-drive/` | 드라이브 연결이 안 될 때 쓰는 더미 파일 폴더 |

---

## 2. 어떻게 만들었나 / How it was built

전부 Claude Code(터미널에서 실행되는 AI 코딩 도구)와 대화하면서 만들었습니다. 저는 코딩 경험이 없는 상태로 시작했습니다.

Built entirely by talking to Claude Code in a terminal. I started with no programming experience.

**가장 중요한 교훈: 한 번에 완성되는 큰 프롬프트는 없었습니다.** 짧은 요청을 계속 주고받는 방식이 훨씬 효과적이었습니다.

**The biggest lesson: there was no single magic prompt.** Short back-and-forth beat long detailed requests every time.

### 실제로 사용한 프롬프트 / The prompts I actually used

환경 설정 / Setup:

```
install python and git
install node right now
```

과제 파악 / Understanding the assignment:

```
can you find the original korean file for me and just translate it
```

→ 멘토님이 주신 엑셀 과업지시서를 읽고 영어로 정리해줬습니다. 영어 버전 파일도 있었지만
   불완전해서 한글 원본을 직접 읽게 하는 편이 정확했습니다.

빌드 / Building:

```
lets deploy now
```

→ 앱 자체는 "구글 드라이브 폴더를 보고 어떤 서류가 빠졌는지 보여주는 화면을 만들어줘"에
   해당하는 대화에서 나왔습니다. 요구사항 3가지를 그대로 읽어주는 것으로 충분했습니다.

디버깅 / Debugging:

```
(에러 메시지를 그대로 복사해서 붙여넣기)
im kinda lost, what did you just do. explain it to me like im 5
so what exactly did we make just now
```

→ **모르겠으면 모르겠다고 말하는 게 가장 빠릅니다.** 설명을 다시 요청하는 것이
   이해 못 한 채로 진행하는 것보다 훨씬 시간을 아꼈습니다.

---

## 3. 막혔던 지점과 해결 / What went wrong, and how it got fixed

평가 기준이 "결과보다 과정"이라고 되어 있어서, 실제로 막혔던 부분을 전부 남깁니다.

### ① 서류 이름이 두 가지였음 — 가장 중요한 버그

드라이브 폴더의 파일은 `등기사항전부증명서`인데, 용어집에는 `법인 등기부등본`으로 적혀 있었습니다. 같은 서류의 다른 이름입니다.

처음 만든 매칭 로직은 `등기부등본`만 찾고 있어서, **파일이 바로 거기 있는데도 "미비"로 표시**됐을 상황이었습니다.

**해결:** 서류 하나에 여러 개의 이름(별칭)을 등록할 수 있게 만들었습니다.

```ts
keywords: ["등기사항전부증명서", "등기사항증명서", "등기부등본", "등기부", ...]
```

**교훈:** 실제 파일을 먼저 확인하지 않고 용어집만 보고 만들었으면 데모에서 틀렸을 겁니다. 코드를 짜기 전에 진짜 데이터를 먼저 보세요.

### ② 용어집에 없는 서류가 폴더에 있었음

폴더에는 `사업소개서`와 `통장사본`이 있었는데 용어집에는 없었습니다. 둘 다 체크리스트에 추가했습니다.

또한 폴더의 파일 번호가 1,2,3,4,5,7,8,10 — **6번과 9번이 비어 있습니다.** 의도적인 미제출 상황으로 보이지만, 그 두 개가 무슨 서류인지는 멘토님께 확인이 필요합니다. (추정: 6번 재무제표, 9번 벤처기업확인증 계열)

### ③ 배포 전에 TypeScript 에러

`npm run build`를 로컬에서 먼저 돌렸더니 타입 에러가 나왔습니다. 이걸 안 하고 바로 배포했으면 Vercel에서 빌드 실패했을 겁니다.

**교훈: 배포 전에 항상 로컬에서 `npm run build`를 돌려보세요.**

### ④ 환경변수가 저장되지 않았음

Vercel 대시보드에서 환경변수를 입력했는데 저장이 안 됐습니다. 화면상으로는 알 수 없었고, 배포된 앱이 계속 샘플 데이터를 보여줬습니다.

확인 방법:

```
npx vercel env ls
```

**교훈:** 환경변수는 **저장한 이후에 만든 배포부터** 적용됩니다. 저장했으면 반드시 다시 배포해야 합니다.

### ⑤ 윈도우 PowerShell에서 npx 실행 불가

```
npx : File ...\npx.ps1 cannot be loaded because running scripts is disabled
```

**해결:** `npx` 대신 `npx.cmd`를 쓰거나, 아래 명령으로 한 번만 설정하면 됩니다.

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### ⑥ 서비스 계정 권한

앱이 드라이브를 읽으려면 **앱 전용 구글 계정(service account)** 을 만들고, 그 계정의 이메일을 드라이브 폴더에 공유해야 합니다. 내 계정에 권한이 있는 것과 앱에 권한이 있는 것은 별개입니다.

---

## 4. 설계에서 신경 쓴 점 / Design decisions worth keeping

**드라이브가 죽어도 앱은 안 죽습니다.** 드라이브 연결이 실패하면 로컬 `sample-drive/` 폴더로 자동 전환되고, 화면에 빨간 배너로 이유를 표시합니다. 데모 중에 인증 문제가 생겨도 흰 화면이 뜨지 않습니다.

**서류 목록은 한 파일에만 있습니다.** `lib/documents.ts`만 고치면 됩니다. 2주차 본과제에서 국내/해외 리스트를 나눌 때 여기서 확장하면 됩니다.

**드라이브를 읽기 전용으로만 접근합니다.** `drive.readonly` scope만 요청해서, 앱이 실수로 멘토님 파일을 지우거나 수정할 수 없습니다.

**선택 서류는 미비 건수에 포함하지 않습니다.** 벤처기업확인증, Cap Table은 '해당 시 제출'이라 필수 카운트에서 제외했습니다.

---

## 5. 보안 / Security notes

- `service-account.json`과 `.env.local`은 `.gitignore`에 등록되어 있습니다. **절대 커밋하면 안 됩니다.**
- 서비스 계정 키가 유출되면 구글 클라우드 콘솔에서 키를 삭제하고 새로 발급하면 됩니다.
- 실제 기업 서류는 민감정보이므로 익명화된 샘플만 사용했습니다.
- 이 문서에는 드라이브 폴더 ID를 적지 않았습니다.

---

## 6. 다음 단계 / What's next

- [ ] 멘토님께 6번, 9번 서류가 무엇인지 확인 → 체크리스트 완성
- [ ] 2주차: 서류 실사 체크리스트 UI (체크박스 + 메모)
- [ ] 2주차: 데이터 모델 설계 (딜/서류항목/제출상태)
- [ ] 3주차: AI 크로스체크 — 서류 내용을 읽어 숫자 불일치 탐지
- [ ] 3주차: 계약서 초안 자동 생성

---

## 7. 다음 기수 인턴에게 / For the next intern

1. **에러 메시지는 그대로 복사해서 붙여넣으세요.** 요약하지 마세요. 못생긴 빨간 글자 안에 답이 있습니다.
2. **이해 안 되면 바로 말하세요.** "쉽게 설명해줘"라고 하면 됩니다. 모르는 채로 넘어가면 나중에 발표에서 막힙니다.
3. **진짜 데이터를 먼저 보세요.** 문서만 보고 만들면 ①번 같은 버그가 납니다.
4. **작게 만들고 바로 돌려보세요.** 화면 하나가 동작하는 걸 확인하고 다음으로 넘어가는 게 빠릅니다.
5. **AI가 자신 있게 틀립니다.** "진짜 테스트해봤어?"라고 물어보세요. 실제로 돌려서 확인하기 전까지는 완성이 아닙니다.
