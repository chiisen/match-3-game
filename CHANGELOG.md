# Changelog

本文件依照 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 格式撰寫。

## [Unreleased]

## [0.1.0] - 2026-02-20

### 新增

- **PRD 文件** (`PRD.md`)：完整產品需求文件，涵蓋核心玩法、計分系統、技術規格與里程碑規劃。
- **主頁面** (`index.html`)：HTML5 Canvas 遊戲頁面，包含棋盤、計分板、模式選擇與控制按鈕。
- **深色主題樣式** (`css/style.css`)：霓虹色系深色主題，含 Google Fonts (Inter)、發光動畫、響應式設計。
- **遊戲核心邏輯** (`js/game.js`)：
  - `Board` 類別：8×8 棋盤、隨機生成（確保初始無三消）、匹配檢測、消除、重力掉落、填充、提示
  - `Game` 類別：遊戲狀態機、經典/計時模式、動畫流程控制、連鎖反應
- **Canvas 渲染引擎** (`js/renderer.js`)：6 種幾何寶石形狀（圓、菱、方、三角、星、六邊形）搭配漸層色彩、外發光、粒子消除特效、交換/掉落緩動動畫、提示高亮
- **輸入處理** (`js/input.js`)：滑鼠點擊與觸控事件統一處理，座標轉換為棋盤格座標
- **計分管理** (`js/score.js`)：3消=30分、4消=60分、5消=100分，連鎖×1.5加成，localStorage 最高分記錄
- **主程式入口** (`js/main.js`)：初始化遊戲、綁定 UI 事件、啟動 requestAnimationFrame 主循環
