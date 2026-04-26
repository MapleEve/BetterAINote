<sub>🌐 <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <b>한국어</b></sub>

<div align="center">

# BetterAINote 🎙️

> *"여러 플랫폼에 흩어진 녹음을 내가 관리하는 안전한 작업 공간으로 모읍니다."*

<a href="https://github.com/MapleEve/BetterAINote/actions/workflows/ci.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/MapleEve/BetterAINote/ci.yml?branch=main&style=flat-square" alt="CI" />
</a>
<a href="https://github.com/MapleEve/BetterAINote/releases">
  <img src="https://img.shields.io/badge/Release-0.6.0--preview-lightgrey?style=flat-square" alt="Release status" />
</a>
<a href="./docs/DEPLOYMENT.md">
  <img src="https://img.shields.io/badge/Self--hosting-first-blue?style=flat-square" alt="Self-hosting first" />
</a>
<a href="./LICENSE">
  <img src="https://img.shields.io/badge/License-Free%20Personal%20%C2%B7%20Commercial%20Ask-orange?style=flat-square" alt="License" />
</a>

<br>

DingTalk / A1, TicNote, Plaud, Feishu Minutes, iFLYTEK iFlyrec 같은 녹음 소스를 하나의 로컬 작업 공간으로 가져옵니다.<br>
녹음, 전사, 화자 검토, AI 제목, 소스 리포트, 검색용 메타데이터는 우선 사용자가 제어하는 배포 환경에 남습니다.<br>
현재 버전은 `0.6.0-preview`입니다. 셀프 호스팅 우선이며 npm 패키지나 공개 Docker 이미지는 배포하지 않습니다.

<br>

[Quickstart](#시작하기) · [Data sources](./docs/DATA_SOURCES.md) · [API](./docs/API.md) · [Deployment](./docs/DEPLOYMENT.md) · [Privacy](./docs/PRIVACY.md) · [Security](./SECURITY.md)

</div>

---

## 이런 문제가 있었나요?

> 회의 녹음이 여러 벤더 콘솔에 흩어져 있고, 제목과 다운로드 방식도 제각각입니다. 회의 하나를 찾으려면 여러 웹사이트를 오가야 합니다.

> 전사, 이름 변경, 화자 정리에 각각 다른 도구를 쓰지만 인증 정보, 오디오, 데이터베이스, 로그가 어디에 남는지 분명하지 않습니다.

BetterAINote는 이 문제를 해결합니다. **여러 소스의 녹음을 프라이빗 작업 공간으로 가져와 동기화, 보관, 비공개 전사, 화자 검토, AI 이름 변경, 검색 준비를 로컬 데이터 중심으로 처리합니다.**

---

## 누구에게 필요한가

- DingTalk / A1, TicNote, Plaud, Feishu Minutes, iFLYTEK iFlyrec 같은 녹음 플랫폼을 사용하는 사람.
- 녹음 라이브러리, SQLite 데이터베이스, 서비스 인증 정보, 오디오 아카이브를 본인의 장비나 서버에 두고 싶은 사용자.
- 모든 녹음을 외부 클라우드 파이프라인으로 보내지 않고 VoScript 같은 비공개 전사 서비스를 쓰려는 팀.
- 먼저 셀프 호스팅 baseline을 만든 뒤 워크플로우나 자동화 기능을 연결하려는 개발자.

BetterAINote는 독립 프로젝트입니다. Plaud는 지원되는 소스 중 하나일 뿐 제품의 중심이 아닙니다.

---

## 현재 상태

| 항목 | 상태 |
| --- | --- |
| 단계 | `preview`, 셀프 호스팅 사용자와 초기 피드백용 |
| 릴리스 | `0.6.0-preview`가 preview baseline입니다. 안정 버전, npm 패키지, 공개 Docker 이미지는 아직 배포하지 않습니다 |
| 패키지 | `package.json`은 `private: true`를 유지합니다 |
| 배포 | 직접 제어하는 로컬 머신, 홈 서버, 사설 서버, 컨테이너 환경 |
| 호환성 | 첫 안정 버전 전까지 API, provider 기능, 설정 항목이 바뀔 수 있습니다 |

---

## 시작하기

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

`http://localhost:3001`을 열고 첫 관리자 계정을 만든 뒤 설정하세요.

- `Data Sources`: 녹음 소스를 연결합니다.
- `VoScript`: 비공개 전사 서비스 URL과 API key를 설정합니다.
- `Transcription`: 공통 전사 동작을 설정합니다.
- `AI Rename`: 제목 생성과 소스 쓰기 동작을 설정합니다.
- `Sync` / `Playback` / `Display`: 동기화, 재생, UI 선호도를 조정합니다.

`.env.local`, 데이터베이스, 오디오 아카이브, 로그인 상태 스크린샷, 실제 인증 정보는 커밋하지 마세요.

---

## 주요 기능

- 여러 소스의 녹음을 하나의 로컬 라이브러리로 모읍니다.
- VoScript 같은 비공개 전사 서비스와 연결합니다.
- 전사 상태, 로컬 전사 결과, 화자 라벨, 재사용 가능한 화자 프로필을 검토합니다.
- core / library / transcripts / voiceprints / words / search로 나뉜 SQLite baseline을 사용합니다.
- 녹음, 전사, 화자, 태그를 대상으로 하는 재구축 가능한 검색 sidecar를 제공합니다.
- UI와 문제 해결에 적합한 sanitized source report만 노출합니다.

---

## 지원 소스

| 소스 | 현재 사용자 관점의 상태 |
| --- | --- |
| DingTalk / A1 | 설정된 인증 정보로 접근 가능한 녹음을 동기화합니다. 상세 정보, 오디오, 요약은 계정 권한에 따라 달라집니다. |
| TicNote | 중국 / 국제 리전을 지원합니다. 녹음 동기화, 가능한 오디오 보관, 활성화 시 제목 쓰기를 시도합니다. |
| Plaud | 녹음 소스로 지원합니다. 녹음 동기화, 가능한 오디오 보관, 활성화 시 제목 쓰기를 시도합니다. |
| Feishu Minutes | 권한이 있으면 소스 메타데이터, 전사, 요약을 확인하거나 동기화할 수 있습니다. |
| iFLYTEK iFlyrec | 전사 기록 가져오기와 검토가 중심입니다. 오디오와 쓰기 기능은 소스가 제공하는 범위에 따릅니다. |

자세한 내용은 [Data Sources](./docs/DATA_SOURCES.md)를 참고하세요.

---

## 개인정보와 보안

BetterAINote에는 녹음 제목, 소스 기록, 전사 텍스트, 화자 이름, 오디오 파일, 인증 정보, 서비스 키가 들어갈 수 있습니다. 프라이빗 인프라로 다루세요.

- 로컬 SQLite 파일과 `LOCAL_STORAGE_PATH`에는 민감한 녹음 및 전사 데이터가 포함될 수 있습니다.
- Provider 인증 정보, VoScript 인증 정보, AI 제목 서비스 키, 세션 상태는 사설 배포 안에만 두세요.
- 공개 Issue, PR, 스크린샷, 로그는 반드시 민감 정보를 제거한 뒤 공유하세요.
- cookie, bearer token, 조직 / 사용자 / 녹음 ID, 회의 내용, 캡처 파일, 전체 환경 파일, 로컬 사설 경로를 공개하지 마세요.

---

## 문서

| 주제 | English | 简体中文 | 日本語 | 한국어 |
| --- | --- | --- | --- | --- |
| 개요 | [README.md](./README.md) | [README.zh-CN.md](./README.zh-CN.md) | [README.ja.md](./README.ja.md) | [README.ko.md](./README.ko.md) |
| API | [docs/API.md](./docs/API.md) | [docs/API.md](./docs/API.md) | [docs/API.md](./docs/API.md) | [docs/API.md](./docs/API.md) |
| 데이터 소스 | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) |
| 배포 | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |

---

## License

개인 사용은 무료입니다. 상업적 사용은 사전 서면 허가가 필요합니다.

BetterAINote는 **Apache License 2.0 위에 BetterAINote Additional Terms를 더한 라이선스**로 제공됩니다. 수정 없는 표준 Apache-2.0 SPDX 라이선스가 아닙니다. 자세한 내용은 [LICENSE](./LICENSE)를 확인하세요.
