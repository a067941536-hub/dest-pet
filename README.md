# 🐾 小糰 MascotAssistant

常駐桌面的 Q 彈寵物助理：解題、截圖、自動寫記事本、小畫家圖解、遊戲觀戰毒舌/讚賞、音樂辨識、以圖搜圖、番茄鐘。
AI 支援 **ChatGPT / Gemini / Claude** 三家，使用者貼自己的 API Key 後可隨時切換。

## 開始使用
```bash
npm install
npm start
```
第一次啟動會自動打開「設定」，貼上任一家的 API Key → 按「測試連線」→ 儲存即可。
結束程式：系統托盤（右下角）的小糰圖示 → 結束。

## 操作
| 動作 | 說明 |
|---|---|
| 輕點小糰 | 開 / 關選單 |
| 拖曳小糰 | 彈簧慣性、邊緣反彈 |
| `Ctrl+Shift+Space` | 直接框選題目範圍並解題 |
| 選單輸入框 | 直接打題目或指令（如「幫我寫一首歌」），Enter 送出；按截圖鈕時，輸入框文字會當作補充說明 |
| 解答視窗 | 還原原題、複製、WolframAlpha / GeoGebra / Desmos / 搜尋連結、以圖搜圖、追問、記事本寫入、小畫家圖解 |
| 自動化中途停止 | 隨時按 **Esc**；焦點離開記事本/小畫家也會自動停止 |

## 取得 API Key（設定頁內也有圖文步驟）
| 服務 | 取得連結 | 重點 |
|---|---|---|
| ChatGPT（OpenAI） | https://platform.openai.com/api-keys | Create new secret key → 立刻複製 → Billing 儲值。ChatGPT Plus 訂閱**不含** API 額度 |
| Gemini（Google） | https://aistudio.google.com/apikey | Create API key → 複製。有免費額度但有速率限制 |
| Claude（Anthropic） | https://platform.claude.com/settings/keys | Create key → 立刻複製（sk-ant-…）→ Billing 儲值。Claude Pro/Max 訂閱**不含** API 額度 |
| AudD（音樂辨識，選用） | https://dashboard.audd.io/ | 註冊後在 Dashboard 取得 Token |

模型名稱可在設定頁自行修改（官方改名時不用更新程式）。
「輕量模型」專給遊戲觀戰用，建議選便宜快速的（預設 gpt-5.6-luna / gemini-flash-latest / claude-haiku-5-5）。

## 架構
```
src/main.js            主進程：視窗、托盤、全域快捷鍵、IPC 路由
src/preload.js         contextBridge 白名單 API
src/services/
  settings.js          設定 + 金鑰加密（safeStorage）
  ai.js                OpenAI / Gemini / Claude 轉接器、解題、遊戲觀戰
  prompts.js           解題與遊戲觀戰 System Prompt
  capture.js           全螢幕 / 區域截圖
  automation.js        啟動 PowerShell 腳本（記事本、小畫家）
  music.js             AudD 音樂辨識
src/scripts/*.ps1      SendInput 打字、滑鼠繪圖（無原生模組）
src/renderer/          寵物、解答視窗、設定頁、區域選取
```

## 安全設計
- API Key 只在主進程使用，renderer 拿不到；以 OS 金鑰庫加密儲存。
- 寵物視窗設為「不被擷取」，不會出現在截圖與觀戰畫面中。
- AI 回傳只當資料：記事本/小畫家動作必須由你在解答視窗按鈕確認；Markdown 先跳脫再渲染；外部連結只開 https。
- 提示詞要求模型把截圖/文字內的指令視為資料，降低 prompt injection 風險。

## 已知限制
- 記事本 / 小畫家自動化只支援 Windows。小畫家畫布位置依版本不同，若畫歪，調整 `src/scripts/draw.ps1` 最上方三個數字。
- 系統聲音錄製（音樂辨識）使用 Windows loopback；macOS 請改用麥克風。
- 遊戲觀戰會定期上傳整個螢幕縮圖，會產生 API 費用；畫面幾乎沒變時會自動跳過。
- 全螢幕獨占模式的遊戲可能擷取不到，請改用「視窗化無邊框」。
- 打包：`npm run dist`（Windows NSIS）。
