# 迷你地城（`pg-microdungeon`）— 遊戲規劃文檔

> **用途：** 本 repo 的遊戲權威規格——coding agent 改動前必讀：這個遊戲是什麼、規則、設計限制、優化方向。
> **整理方式：** 從本 repo 實作反向整理（2026-08-23）。**改玩法先改此檔再改碼**；本檔與程式碼衝突時，以「規則（§3）」描述的設計意圖為準回報差異。
> **上游契約：** [PG-GAME-AGENT-GUIDE.md](https://github.com/sampot/playgrounds/blob/main/docs/PG-GAME-AGENT-GUIDE.md)（唯一必讀；本檔不重複其全文）· 型錄條目 `playgrounds/catalog/entries/pg-microdungeon.yaml`

## 1. 一句話

種子可重現的三層隨機迷宮 Roguelite：每層先找發光符石解鎖樓梯／出口，撞擊即戰鬥、追擊怪物、開寶箱成長，第三層出口帶著步數與古幣結算。

## 2. 定案速覽（待上架驗收）

| 項 | 值 |
| --- | --- |
| catalog id / kind / series | `pg-microdungeon` / `game` / `街機`；型錄 `status: unlisted`（**待上架驗收**） |
| 模式 | 單機單人回合制；一局 **3 層** 21×15 迷宮；seed 隨機 0–10⁶、同 seed 可重現 |
| 初始角色 | hp 14／atk 2／藥水 2／gold 0；符石未入手前樓梯與出口鎖定 |
| 視角/畫布 | 圖塊 32px、視野 15×11 格；相機跟隨＋迷霧（探索半徑 6） |
| 戰鬥 | 碰撞制：走向敵人＝攻擊；敵存活立即反擊；每 3 殺 atk+1、maxHp+1 |
| 敵人 | 七種（鼠/蝠/苔/骷髏/幽靈/守衛/魔像），hp 2–8、atk 1–3，逐層換池 |
| 素材 | Kenney 1-bit Pack atlas ＋ CC0 音效/BGM；詳 §6 |
| 交付形 | 純 HTML＋CSS＋ESM JS；無 build；`npx vitest run`（14 例） |

## 3. 完整規則（現行實作）

### 3.1 迷宮生成（`generateDungeon(seed, level)`）

- RNG：mulberry 風格 `rng(seed + level×7919)`，同 seed 同層完全決定論。
- 迷宮：自 (1,1) 起的遞迴回溯雕刻（步距 2），再從候選牆中隨機打通 **8 條環路**避免死路折返。
- 目標點：BFS 最遠且距離 ≥6 的地板為樓梯（第 1–2 層）或出口（第 3 層）；**符石放在起點到目標最短路上 45–65% 處**（夾在 [2, len−2]）——順路即拿，不必繞遠。
- 寶箱至多 2 個（第 1 個紅藥水 +1、第 2 個古幣 `5+層×3`），放曼哈頓距離 >5 的地板；敵人 `3+層` 隻，同樣避開出生點近域。

### 3.2 敵人配置（`ENEMY_STATS`）

| 層 | 池 | 備註 |
| --- | --- | --- |
| 1 | slime(3/1)、bat(2/1)、rat(2/1) | hp/atk |
| 2 | skeleton(4/2)、ghost(3/2)、slime、bat | — |
| 3 | guard(5/2)、ghost、skeleton、demon(8/3) | 第 3 層首隻必為 demon |

- 實際 hp = 基礎值 + max(0, 層−1)。

### 3.3 回合與戰鬥

- 玩家一步（成功移動/攻擊/喝藥）= 一回合，`turns` 累計。撞牆/出界不耗回合。
- **碰撞戰鬥**：走向敵人格 → 敵 hp −玩家 atk；敵存活 → **立即反擊**扣敵 atk（玩家原地）；敵死 → 玩家走進該格、kills+1、gold+`2+層`。每累積 3 殺：atk+1、maxHp+1、hp+3（封頂）。
- **敵人回合**：相鄰（曼哈頓距離 1）者圍攻，但**每回合全場最多一隻出手**（attacked 旗標）；距離 ≤5 者 BFS 尋路逼近（queue 上限 90 節點）；更遠待機。敵彼此不可重疊、不可穿牆。

### 3.4 符石、下樓與勝敗

- 踩樓梯/出口而未持符石 → locked 提示不耗回合；踩符石 → hasRelic=true、該格轉地板、「出口的火焰亮起了」。
- 下樓（descendLevel）：新層生成後 hp+2（封頂 maxHp）、攜帶 atk/gold/potions/kills/turns、hasRelic 重置。
- 第 3 層持符石抵達 EXIT → `won`，結算顯示 步數／擊破數／古幣；hp≤0 → `dead`（含「擊殺後被旁邊敵人補刀」的路徑）。兩者皆停輪並聚焦「再來一局」鈕。

### 3.5 藥水與視野

- 喝藥 +6 hp（封頂）、耗一回合且**敵人照常行動**；滿血或無藥時拒絕並記 log。
- 視野：以玩家為中心的曼哈頓半徑 6（牆格外加 1）；explored 永久保留、非可見已探索區疊暗罩——迷霧會洩漏牆後輪廓但不顯示敵人。

## 4. 操作與畫面

| 輸入 | 動作 |
| --- | --- |
| WASD／方向鍵 | 移動／撞擊攻擊（單步，無長按連發） |
| H／P 或「喝藥水」鈕 | 喝藥（滿血/無藥時 disabled） |
| 觸控 swipe（>18px） | 朝主軸方向一步 |
| 點按畫面象限 | 朝點擊方向一步 |
| ◀▲▼▶ 鈕長按 | 320ms 後以 125ms 間隔連發 |
| 再來一局／重新開始 | 新 seed 重開（非破壞免確認） |

- HUD：樓層、HP 條（>50% 綠／>25% 黃／其餘紅）、atk/gold/kills/potions、任務徽章（◇尋找符石→◆樓梯已甦醒／出口已開啟）、最近 3 條事件 log、狀態行提示。
- 結束覆蓋層：勝利「符石征服者！」或死亡「倒在迷宮裡」（含抵達層數）。禁原生對話框；`window.__dung` 為 devtools 掛勾。

## 5. 持久化（KV 權威）

- **本 repo 完全沒有持久化**：不觸及 `/api/kv/*` 與 localStorage（已全碼 grep 確認）。最佳成績、最高層數跨重載即失。
- `functions.js` 為空 stub，註明 reserved for future server-side state（如 score persistence）——若兌現，key 一律 `pg-microdungeon-*` 前綴走 `/api/kv/{key}`（宿主 KV 無 per-SAM 命名空間）。

## 6. 美術／音效／署名

- `assets/tiles/atlas.png`：Kenney [1-bit Pack](https://kenney.nl/assets/1-bit-pack) colored_packed tilesheet（49×22 格、16px/格、間距 0），玩家與七種敵人以 `(row,col)` 取格、缺圖有 fallback 方塊；授權文本在 `assets/tiles/License.txt`。CC0，仍逐一署名（`ATTRIBUTION.md`）。
- `assets/sfx/bgm.ogg`：HydroGene《Perilous Dungeon》（itch.io 高品質 8-bit 音樂集），CC0。
- 其餘 `sword/draw_sword/spell/click/step/door/slime1/slime2/coin2/pickup.ogg`：OpenGameArt RPG Sound Pack 各作者，CC0。
- 地板/牆/寶箱/符石/樓梯為程式繪製（磚縫、脈動水晶、金光門）。新增素材照例：拷進 `assets/`、更新 ATTRIBUTION.md、同步 `sam-manifest.json`（現列 20 檔）。

## 7. 測試（`npx vitest run`）

現有覆蓋（`game.test.js`，14 例）：rng 決定論；生成結構（21×15、hp14/potions2、L1 恰 1 符石+1 樓梯 0 出口、L3 反之）；四組 seed 的符石/目標/寶箱/敵人全部 BFS 可達；符石落在起點→目標最短路上；同 seed 完全重現；tryPlayerMove——撞牆不耗回合、擊殺走入該格、guard 存活反擊 −2、擊殺後遭鄰敵圍攻致死、locked→取符石→descend 鏈、L3 出口 won；喝藥封頂不溢出；descendLevel 攜帶統計並清符石；視野 visible/explored 標記。

缺口（改動時補）：每 3 殺成長曲線、寶箱內容分配、敵人尋路上限行為、金幣擊殺獎勵公式。

## 8. 硬約束（不可違反）

1. 僅 HTML＋CSS＋JS（ESM）；**無 build**、不入庫 `node_modules`、不安套件；工具一律 `npx <pkg>` 臨時執行。
2. 禁瀏覽器原生 `alert`／`confirm`／`prompt`；確認一律頁內 UI（結算用 overlay）。
3. Mobile-first：swipe＋D-pad 主操作不可 hover-only。
4. 分數/進度以 `fetch('/api/kv/pg-microdungeon-*')` 為權威；禁止裸 localStorage 當權威（現行無存檔，新增即適用）。
5. 不自行載入 `sdk.js`；宿主注入 `window.PG`。本作未用 `PG.libs`。
6. 改動可執行邏輯前先寫失敗測試（TDD）；`game.js` 維持零 DOM 純函式（seed 決定論是測試地基，不得引入 Math.random 於核心）。
7. 檔案清單變動須同步 `sam-manifest.json`。
8. 素材限 CC0 或同等授權並照 §6 署名；atlas 取格座標改動須同步 render 與測試。

## 9. 優化建議（可玩性與樂趣）

依優先級；實作前先在此登記並補測試。原則：強化 run 與 run 之間的誘因，不改變「三層短局碰撞戰鬥 roguelite」的核心認同。

**高優先**

1. **最佳紀錄持久化**：以 `/api/kv/pg-microdungeon-best` 存 最少步通關／最高 gold／最深層數 三項，結算面板與標題列顯示個人最佳——functions.js 已預留此用途，是現況最直接的樂趣增量。
2. **Seed 分享**：結算與標題顯示本局 seed、標題加「輸入 seed 開局」小欄；同一迷宮挑戰朋友成績，零生成成本就把單機變社交。
3. **敵人差異化行為**：七種怪目前只有數值差。最低成本版——ghost 隔回合才能被攻擊（閃相位）、demon 距離 2 即噴射一次遠攻、bat 隨機遊走而非直線追擊；各補一條測試即可上路。

**中優先**

4. **成長第二軸**：只有每 3 殺的被動成長。讓寶箱偶爾出「護符」（如：反擊傷害 −1、視野 +1），把 3.4 的固定兩箱變 build 抉擇。
5. **層間事件**：下樓回血 +2 太薄。加入隨機小事件（泉水回滿／商人以 gold 換藥水），讓 §9.4 的 gold 有花處。
6. **失敗保底**：死亡即整局歸零對手機碎片時間偏懲罰。保留roguelite 張力的前提下，給「每日一次原地復活（hp 回一半、alarm 式代價：gold 減半）」，KV 記當日已用。

**低優先**

7. 攻擊命中已有斜線 impact 特效；補受擊畫面紅暈與低 hp 心跳音，強化瀕死張力。
8. 戰績戰績頁：歷史 run 列表（seed/結果/步數）存 KV 單一 JSON key，作為 §9.1 的延伸。
