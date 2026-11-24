/*

`lightPaint` クラスによって実装された、お絵描き機能の本体です。

1. **クラス変数の概要**  
   ```js
   static rgba = 'rgba(0,0,0,1)'; // 描画色(初期は黒)
   static psize = 2;             // 筆の太さ(初期は2)
   static ptransparent = 1;      // 透明度(初期は不透明=1)
   static mode = 1;              // モード (1:描く,2:消しゴム)
   static inputType = 1;         // 描き込みタイプ (1:ペン,2:直線,3:四角,4:円)
   ```
   などの設定値をクラス変数として保持しています。

2. **インスタンス生成（constructor）**  
   - `new lightPaint(bodyname, menuname, width, height)`  
     - `bodyname`: 描画領域を挿入する先の要素のID  
     - `menuname`: メニューを挿入する先の要素のID  
     - `width`, `height`: canvas の横幅・縦幅

   コンストラクタ内では、`this.html_src_body` と `this.html_src_menu` が組み合わされ、指定した要素内に描画用HTMLやメニューHTMLが動的に挿入されます。

3. **描画の流れ**  
   - `pointerdown` でドラッグ開始を検出。`startX`, `startY` に開始座標を記録。  
   - `pointermove` でドラッグ中のマウス座標を取得し、ペンや直線などの種類に応じて描画処理を実行。  
   - `pointerup` でドラッグ終了処理を行い、最終的に描画結果を `mainCanvas` に反映し、localStorage に履歴として保存する。

4. **モードによる描画動作**  
   - **mode=1 (描く)**  
     - `inputType=1 (ペン)` … ドラッグで自由に線を引く。  
     - `inputType=2 (直線)` … 指定した2点を結ぶ直線を描く。ドラッグ中は `tempCanvas` にプレビュー表示、pointerup 時に `mainCanvas` へ反映。  
     - `inputType=3 (短径=四角形)` … ドラッグした2点を対角にした矩形を描く。同じくプレビュー→確定の流れ。  
     - `inputType=4 (円)` … ドラッグした2点を中心と半径の計算に使い、円を描く。プレビュー→確定。  
   - **mode=2 (消しゴム)**  
     - 白色 + `globalCompositeOperation = destination-out` を用い、描いた線を透明化して消す。筆の太さは psize による。

5. **履歴管理 (localStorage)**  
   - 描画が確定するたび (`pointerup`) に、`mainCanvas.toDataURL()` を取得して localStorage に保存。  
   - **「戻る」** で最新の描画を一旦リストから退避し、キャンバスを前の状態に復元。  
   - **「進む」** で退避した描画を再び適用して、最新状態を再現。  
   - **「クリア」** でキャンバスを完全にクリア。履歴にクリア後の状態が追加される。

6. **カラーピッカー (spectrum.js)**  
   - `$(".colorpicker").spectrum(...)` の設定によって、あらかじめ用意されたパレットから色を選択できます。  
   - 選択された色は `lightPaint.rgba` に反映され、透過度も合算した色 (rgba) として描画時に使用されます。
   
*/


// paint_5a.js
// -----------
// - lightPaint クラスを定義し、canvas上のお絵描き機能を提供する
// - 主な機能：ペンや直線、四角、円の描画、消しゴム、Undo/Redo、色・太さ・透明度選択など
// - 追加: できるだけ詳しいコメントと、console.log() などのログ出力を増やしています。

class lightPaint {

  // --- クラス変数 (静的変数) ---
  static rgba = 'rgba(0,0,0,1)';   // 描画色 (初期値: 黒, 不透明)
  static psize = 2;               // 描画・消しゴムの太さ(ピクセル) (初期値: 2)
  static ptransparent = 1;        // 透明度(初期値: 1 => 不透明)
  static mode = 1;                // モード (1:描く, 2:消しゴム, 3:選択)
  static inputType = 1;           // 描き込みタイプ (1:ペン, 2:直線, 3:四角, 4:円)

  static instance_num = 0;        // 全インスタンスのカウント
  static myStorage = localStorage;// localStorage への参照
  static canvasname = "mainCanvas";      // メイン描画キャンバスのクラス名
  static tempcanvasname = "tempCanvas";  // 一時描画用キャンバスのクラス名

  static obj = [];                // lightPaint インスタンスを外部からアクセスするための配列
  static controller;              // 将来の拡張(AbortControllerなど)に使える予約

  // 絵のデータを保存するtextareaのID
  CANVAS_DATA_ID = 'paint-canvas-data';
  SCRIPT_ID = 'load-canvas-image-script';

  /**
   * コンストラクタ
   * @param {string} bodyname  - 描画領域を挿入する要素ID
   * @param {string} menuname - メニュー領域を挿入する要素ID
   * @param {number} width    - キャンバス幅
   * @param {number} hight    - キャンバス高さ
   */
  constructor(bodyname, menuname, width, hight) {
    console.log("lightPaint constructor called with:", bodyname, menuname, width, hight);

    // 初期設定を保持
    this.bodyname = bodyname;
    this.menuname = menuname;

    // HTMLソース: お絵描き用領域 (canvas2枚)
    // すでに dash_drill_test_2f.html 上にあるが、あらためて上書きすることも可能
    this.html_src_body = `
    <div class="container" style="position: relative;">
        <canvas class="mainCanvas"  style="touch-action: none; border: none; position: absolute; top: 0px; left: 0px;"></canvas>
        <canvas class="tempCanvas"  style="touch-action: none; border: none; position: absolute; top: 0px; left: 0px;"></canvas>
    </div>
`;

    // HTMLソース: メニュー部分 (チェックボックス, モード選択, 太さ, 透過度, カラーピッカー, Undo/Redo/クリア)
    this.html_src_menu = `
<div class="paint-menu-container" style="position: fixed; top: 20px; left: 20px;">
  <div class="paint-menu-titlebar" style="background: #4a90e2; color: white; padding: 4px 8px; cursor: move;">
    ペイントメニュー
  </div>
  <div style="padding: 4px;">
    <input type="checkbox" class="painton">PAINT ON<br>
    <input type="checkbox" class="paintkeep">KEEP
  </div>

  <div class="paintmenubody" style="display: none;">
    <!-- モード選択 -->
    <div class="card-body border rounded" style="padding: 4px; margin: 4px;">
      <h5 class="card-title" style="margin: 2px 0; font-size: 0.9em;">モード</h5>
      <div class="form-check" style="margin: 2px 0;">
        <label class="form-check-label">
          <input class="form-check-input" type="radio" name="mode" value="1" checked>描く
        </label>
      </div>
      <div class="form-check" style="margin: 2px 0;">
        <label class="form-check-label">
          <input class="form-check-input" type="radio" name="mode" value="2">消しゴム
        </label>
      </div>
      <div class="form-check" style="margin: 2px 0;">
        <label class="form-check-label">
          <input class="form-check-input" type="radio" name="mode" value="3">選択
        </label>
      </div>
    </div>

    <!-- 描き込みタイプ -->
    <div class="card-body border rounded" id="input-type-area" style="padding: 4px; margin: 4px;">
      <h5 class="card-title" style="margin: 2px 0; font-size: 0.9em;">描き込みタイプ</h5>
      <div class="form-check" style="margin: 2px 0;">
        <label class="form-check-label">
          <input class="form-check-input" type="radio" name="input-type" value="1" checked>ペン
        </label>
      </div>
      <div class="form-check" style="margin: 2px 0;">
        <label class="form-check-label">
          <input class="form-check-input" type="radio" name="input-type" value="2">直線
        </label>
      </div>
      <div class="form-check" style="margin: 2px 0;">
        <label class="form-check-label">
          <input class="form-check-input" type="radio" name="input-type" value="3">短径
        </label>
      </div>
      <div class="form-check" style="margin: 2px 0;">
        <label class="form-check-label">
          <input class="form-check-input" type="radio" name="input-type" value="4">円
        </label>
      </div>
    </div>

    <!-- 太さ, 透過度 -->
    <div class="card-body border rounded" id="range-area" style="padding: 4px; margin: 4px;">
      <div class="col" id="size-area">
        <h5 class="card-title" style="margin: 2px 0; font-size: 0.9em;">太さ</h5>
        <div style="margin: 2px 0;">
          <input type="radio" name="paint-thickness" value="1" checked onChange="lightPaint.sizeChange(this.value)">&nbsp;1 &emsp;
          <input type="radio" name="paint-thickness" value="2" onChange="lightPaint.sizeChange(this.value)">&nbsp;2 &emsp;
          <input type="radio" name="paint-thickness" value="4" onChange="lightPaint.sizeChange(this.value)">&nbsp;4 &emsp;
          <input type="radio" name="paint-thickness" value="8" onChange="lightPaint.sizeChange(this.value)">&nbsp;8
        </div>
        <div style="margin: 2px 0;">
          <input type="radio" name="paint-thickness" value="15" onChange="lightPaint.sizeChange(this.value)">15 &emsp;
          <input type="radio" name="paint-thickness" value="30" onChange="lightPaint.sizeChange(this.value)">30 &emsp;
          <input type="radio" name="paint-thickness" value="50" onChange="lightPaint.sizeChange(this.value)">50 &emsp;
          <input type="radio" name="paint-thickness" value="100" onChange="lightPaint.sizeChange(this.value)">100
        </div>
      </div>
      <div class="col" id="transparent-area">
        <h5 class="card-title" style="margin: 2px 0; font-size: 0.9em;">透過度</h5>
        <div style="margin: 2px 0;">
          <input type="radio" name="paint-alpha" value="1" checked onChange="lightPaint.alphaChange(this.value)">&nbsp;1 &emsp;
          <input type="radio" name="paint-alpha" value="0.8" onChange="lightPaint.alphaChange(this.value)">0.8 &emsp;
          <input type="radio" name="paint-alpha" value="0.5" onChange="lightPaint.alphaChange(this.value)">0.5 &emsp;
          <input type="radio" name="paint-alpha" value="0.3" onChange="lightPaint.alphaChange(this.value)">0.3
        </div>
        <div style="margin: 2px 0;">
          <input type="radio" name="paint-alpha" value="0.2" onChange="lightPaint.alphaChange(this.value)">0.2 &emsp;
          <input type="radio" name="paint-alpha" value="0.1" onChange="lightPaint.alphaChange(this.value)">0.1 &emsp;
          <input type="radio" name="paint-alpha" value="0.05" onChange="lightPaint.alphaChange(this.value)">0.05 &emsp;
          <input type="radio" name="paint-alpha" value="0.01" onChange="lightPaint.alphaChange(this.value)">0.01
        </div>
      </div>
    </div>

    <!-- カラーピッカー -->
    <div class="card-body border rounded" id="color-picker-area" style="padding: 4px; margin: 4px;">
      <h5 class="card-title" style="margin: 2px 0; font-size: 0.9em;">色</h5>
      <div class="rounded" style="background-color: whitesmoke;">
        <input class="colorpicker" type="text">
      </div>
    </div>

    <!-- 操作ボタン -->
    <div class="card-body border rounded" id="undo-area" style="padding: 4px; margin: 4px;">
        <div class="rounded" style="background-color: whitesmoke;">
            <input type="button" value="戻る" onClick="lightPaint.obj[0].prevCanvas()">
            <input type="button" value="進む" onClick="lightPaint.obj[0].nextCanvas()">
            <input type="button" value="クリア" onClick="lightPaint.obj[0].resetCanvas(); lightPaint.obj[0].setLocalStoreage();">
            <input type="button" value="保存" onClick="lightPaint.obj[0].saveAsHTML()">
        </div>
    </div>
  </div>
</div>
`;

    // 指定IDの要素を取り出して、HTMLを差し込む
    let bodyelt = document.getElementById(bodyname);
    let menuelt = document.getElementById(menuname);
    
    // キャンバスが存在しない場合は作成する
    this.mainCanvas = $("#"+bodyname+" ."+lightPaint.canvasname)[0];
    this.tempCanvas = $("#"+bodyname+" ."+lightPaint.tempcanvasname)[0];
    
    if (!this.mainCanvas || !this.tempCanvas) {
      // キャンバスが存在しない場合は動的に作成
      bodyelt.innerHTML = this.html_src_body;
    }
    
    menuelt.innerHTML = this.html_src_menu;

    // bodyelt のCSSを設定
    bodyelt.style.top = "0px";
    bodyelt.style.margin = "auto";
    bodyelt.style.position = "absolute";
    bodyelt.style.pointerEvents = "none";  // ここでは初期状態ではnone(お絵描きOFFに備える)

    menuelt.style.pointerEvents = "auto";  // メニューは常に操作可能

    // canvas要素の取得 (mainCanvas / tempCanvas)
    // キャンバスが既に存在する場合は取得、存在しない場合は上で作成したものを取得
    this.mainCanvas = $("#"+bodyname+" ."+lightPaint.canvasname)[0];
    this.tempCanvas = $("#"+bodyname+" ."+lightPaint.tempcanvasname)[0];

    console.log("mainCanvas DOM element:", this.mainCanvas);
    console.log("tempCanvas DOM element:", this.tempCanvas);

    // メインキャンバス、テンポラリキャンバスのサイズをセット
    this.mainCanvas.width = width;
    this.mainCanvas.height = hight;
    this.tempCanvas.width = width;
    this.tempCanvas.height = hight;
    
    // 2Dコンテキスト取得
    this.context = this.mainCanvas.getContext('2d');
    this.tempcontext = this.tempCanvas.getContext('2d');

    // 各種イベントリスナを設定 (pointerdown, pointermove, pointerup)
    this.tempCanvas.addEventListener('pointerdown', (e) => {
        console.log("[pointerdown] e=", e);
        this.pDown(e);
        e.preventDefault();
    });

    this.tempCanvas.addEventListener('pointermove', (e) => {
        if (lightPaint.mode === 3) { // 選択モード
            if (this.isSelecting) {
                this.selectionEnd = { x: e.offsetX, y: e.offsetY };
                this.drawSelectionBox();
            } else if (this.isMovingSelection && this.selectedImage && this.currentDrawPos) {
                const newX = e.offsetX - this.moveOffset.x;
                const newY = e.offsetY - this.moveOffset.y;
                this.moveSelection(newX, newY);
            }
        } else if (lightPaint.mode === 1) {
            // 既存の描画モードの処理
            if (this.holdClick) {
                if (lightPaint.inputType === 1) {
                    this.drawPen(e);
                } else if (lightPaint.inputType === 2) {
                    this.drawLine(e);
                } else if (lightPaint.inputType === 3) {
                    this.drawRect(e);
                } else if (lightPaint.inputType === 4) {
                    this.drawArc(e);
                }
            }
        } else if (lightPaint.mode === 2) {
            if (this.holdClick) {
                this.drawErase(e);
            }
        }
        e.preventDefault();
    });

    this.tempCanvas.addEventListener('pointerup', (e) => {
        console.log("[pointerup] e=", e);
        this.pUp(e);
        e.preventDefault();
    });

    // ラジオボタン「モード(描く/消しゴム)」変更時
    $('[name="mode"]').on('change', function (e) {
        let mode = Number($('input[name="mode"]:checked').val());
        lightPaint.mode = mode;
        console.log("モード変更 => lightPaint.mode=", lightPaint.mode);

        // モードに応じてUIの表示を切り替える例
        if (mode == 1) {
            // 描く
            $("#input-type-area").show();
            $("#size-area").show();
            $("#transparent-area").show();
            $("#range-area").show();
            $("#color-picker-area").show();
        } else if (mode == 2) {
            // 消しゴム
            $("#input-type-area").hide();
            $("#size-area").show();
            $("#transparent-area").hide();
            $("#range-area").show();
            $("#color-picker-area").hide();
        } 
    });

    // ラジオボタン「描き込みタイプ(ペン,直線,四角,円)」変更時
    $('[name="input-type"]').on('change', function (e) {
        let inputType = $('input[name="input-type"]:checked').val();
        lightPaint.inputType = Number(inputType);
        console.log("描き込みタイプ変更 => lightPaint.inputType=", lightPaint.inputType);
    });

    // spectrum.js カラーピッカー設定
    $(".colorpicker").spectrum({
      showPaletteOnly: true,
      showPalette:true,
      chooseText:'選択',
      color: 'black', // 初期色
      palette: [
          ['black', 'red', 'rgb(255,128,0)', 'yellow', 'rgb(0,255,0)'],
          ['green', 'blue', 'rgb(75,0,130)', 'rgb(148,0,211)', 'white']
      ],
      move: function(color) {
        // カラー選択時の動作
        let iro = color.toHexString(); // #rrggbb 形式
        lightPaint.rgba = "rgba(" +
          parseInt(iro.substring(1, 3), 16) + ", " +
          parseInt(iro.substring(3, 5), 16) + ", " +
          parseInt(iro.substring(5, 7), 16) + ", " +
          lightPaint.ptransparent + ")";
        console.log("色変更 => ", lightPaint.rgba);
      }
    });
  
    // 「PAINT ON」のチェックボックス
    $('.painton').on('click', (e) => {
      if ( $("#"+menuname+" .painton").prop('checked') ){
         // チェックON => お絵描き可能に
         console.log("PAINT ON チェックされました");
         $('#'+this.bodyname).css('pointer-events','auto');
         $("#"+this.menuname+' .paintmenubody').show();
      } else {
         // チェックOFF => お絵描き無効
         console.log("PAINT ON チェック外れました");
         $('#'+this.bodyname).css('pointer-events','none');
         $("#"+this.menuname+' .paintmenubody').hide();
      }
      // KEEPの状態も更新
      this.updateKeepState();
    });
    
    // 「KEEP」のチェックボックス
    $('.paintkeep').on('click', (e) => {
      this.updateKeepState();
    });
    
    // KEEP状態を更新する関数
    this.updateKeepState = function() {
      const keepChecked = $("#"+menuname+" .paintkeep").prop('checked');
      if (keepChecked) {
        console.log("KEEP チェックされました");
        $('body').addClass('paint-keep');
      } else {
        console.log("KEEP チェック外れました");
        $('body').removeClass('paint-keep');
      }
    };

    // Undo/Redo 用の配列
    this.temp = [];
    this.idx = lightPaint.instance_num;
    lightPaint.instance_num += 1;
    // localStorageに使うキー(複数インスタンスがある場合に区別)
    this.local_storage_key  = '__log_'+this.idx;
  
    // localStorage 初期化
    this.initLocalStorage();

    // メニューのドラッグ機能を初期化
    this.initDraggableMenu();

    // 選択範囲用の変数
    this.selectionStart = { x: 0, y: 0 };
    this.selectionEnd = { x: 0, y: 0 };
    this.isSelecting = false;
    this.selectedImage = null;
    this.currentDrawPos = null;
    this.originalPos = null;
    
    // 選択範囲の移動用の変数
    this.isMovingSelection = false;
    this.moveOffset = { x: 0, y: 0 };

  } // constructor終了

  /**
   * マウス等のpointerダウン時(クリック開始)の処理
   */
  pDown(e) {
    if (lightPaint.mode === 3) { // 選択モード
      if (!this.selectedImage) {
        // 新しい選択範囲の作成開始
        this.isSelecting = true;
        this.selectionStart = { x: e.offsetX, y: e.offsetY };
        this.selectionEnd = { x: e.offsetX, y: e.offsetY };
      } else if (this.currentDrawPos) {
        // 選択範囲内でのクリックかチェック
        const relX = e.offsetX - this.currentDrawPos.x;
        const relY = e.offsetY - this.currentDrawPos.y;
        if (relX >= 0 && relX <= this.selectedImage.width &&
            relY >= 0 && relY <= this.selectedImage.height) {
            // 選択範囲内のクリックなら移動開始
            this.isMovingSelection = true;
            this.moveOffset = {
                x: relX,
                y: relY
            };
        } else {
            // 選択範囲外のクリックなら選択解除
            this.cancelSelection();
            // 新しい選択範囲の作成開始
            this.isSelecting = true;
            this.selectionStart = { x: e.offsetX, y: e.offsetY };
            this.selectionEnd = { x: e.offsetX, y: e.offsetY };
        }
      }
    } else {
      // 既存の処理
      this.holdClick = true;
      this.startX = e.offsetX;
      this.startY = e.offsetY;
    }
  }
  
  /**
   * pointerアップ時(クリック終了)の処理
   */
  pUp(e) {
    if (lightPaint.mode === 3) { // 選択モード
      if (this.isSelecting) {
        // 選択範囲の確定
        if (Math.abs(this.selectionEnd.x - this.selectionStart.x) > 5 &&
            Math.abs(this.selectionEnd.y - this.selectionStart.y) > 5) {
          this.saveSelection();
        }
        this.isSelecting = false;
      } else if (this.isMovingSelection && this.selectedImage) {
        // 選択範囲の移動を確定
        this.context.putImageData(
            this.selectedImage,
            this.currentDrawPos.x,
            this.currentDrawPos.y
        );
        
        // 選択状態をクリア
        this.selectedImage = null;
        this.currentDrawPos = null;
        this.originalPos = null;
        this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        
        // 履歴に保存（移動後の状態を保存）
        this.setLocalStoreage();
        this.isMovingSelection = false;
      }
    } else {
      // 既存の処理
      this.holdClick = false;
      if (lightPaint.inputType !== 1) {
        this.context.drawImage(this.tempCanvas, 0, 0);
        this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        this.setLocalStoreage();
      }
    }
    e.preventDefault();
  }

  /**
   * ペン(自由線)を描く
   */
  drawPen(e) {
    // ドラッグ中の場合、 pressure>0.0 or e.buttons!=0
    if (e.buttons !== 0 || e.pressure > 0.0) {
      // ペン描画設定
      this.context.lineWidth = lightPaint.psize;
      this.context.strokeStyle = lightPaint.rgba;
      this.context.lineJoin = "round";
      this.context.lineCap = "round";
      this.context.globalCompositeOperation = 'source-over';

      // 線を描く
      this.context.beginPath();
      this.context.moveTo(this.startX, this.startY); // 前の座標
      this.context.lineTo(e.offsetX, e.offsetY);     // 現在の座標
      this.context.stroke();
      this.context.closePath();
      
      // 次に備え、現在座標を「開始座標」に更新
      this.startX = e.offsetX;
      this.startY = e.offsetY;
    }
  }

  /**
   * 直線を描く(ドラッグ中は tempCanvasにプレビュー, pointerup時に本キャンバスへ反映)
   */
  drawLine(e) {
    // tempCanvasをクリアして再描画(プレビュー)
    this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

    // クリック中(houseClick=true)はプレビュー先をtempcontext、そうでなければ本体(context)
    let targetctx = (this.holdClick) ? this.tempcontext : this.context;

    targetctx.lineWidth = lightPaint.psize;
    targetctx.strokeStyle = lightPaint.rgba;
    targetctx.lineCap = "round";
    targetctx.globalCompositeOperation = 'source-over';

    targetctx.beginPath();
    targetctx.moveTo(this.startX, this.startY);
    targetctx.lineTo(e.offsetX, e.offsetY);
    targetctx.stroke();
    targetctx.closePath();
  }

  /**
   * 矩形(短径)を描く
   */
  drawRect(e) {
    // 一時的描画をクリア
    this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

    let targetctx = (this.holdClick) ? this.tempcontext : this.context;

    targetctx.fillStyle = lightPaint.rgba;
    targetctx.globalCompositeOperation = 'source-over';

    targetctx.beginPath();
    // ドラッグ開始座標～現在座標で矩形を描く
    let rectWidth = e.offsetX - this.startX;
    let rectHeight = e.offsetY - this.startY;
    targetctx.fillRect(this.startX, this.startY, rectWidth, rectHeight);
    targetctx.closePath();
  }

  /**
   * 円(ドラッグ開始から終点の中点を中心に、半径はstartX~endXの距離)
   */
  drawArc(e) {
    this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

    let targetctx = (this.holdClick) ? this.tempcontext : this.context;

    targetctx.fillStyle = lightPaint.rgba;
    targetctx.globalCompositeOperation = 'source-over';

    // X,Yの中間点を中心にする
    let centerX = Math.max(this.startX, e.offsetX) - Math.abs(this.startX - e.offsetX) / 2;
    let centerY = Math.max(this.startY, e.offsetY) - Math.abs(this.startY - e.offsetY) / 2;
    let distance = Math.sqrt(Math.pow(this.startX - e.offsetX, 2) + Math.pow(this.startY - e.offsetY, 2));

    targetctx.beginPath();
    targetctx.arc(centerX, centerY, distance / 2, 0, Math.PI * 2, true);
    targetctx.fill();
    targetctx.closePath();
  }

  /**
   * 消しゴム(白色+ destination-out で描画した部分を透明化)
   */
  drawErase(e) {
    if (e.buttons !== 0 || e.pressure > 0.0) {
      this.context.lineWidth = lightPaint.psize;
      this.context.lineCap = "round";
      // 透明化させるためにdestination-out
      this.context.strokeStyle = "rgba(255, 255, 255, 1)";
      this.context.globalCompositeOperation = 'destination-out';
      this.context.beginPath();
      this.context.moveTo(this.startX, this.startY);
      this.context.lineTo(e.offsetX, e.offsetY);
      this.context.stroke();
      this.context.closePath();
      
      this.startX = e.offsetX;
      this.startY = e.offsetY;
    }
  }

  // ---- 静的メソッド (サイズや透明度変更) ----

  /**
   * サイズ(筆の太さ)変更
   * @param {string} value  ラジオボタンから取得したvalue
   */
  static sizeChange(value) {
    lightPaint.psize = Number(value);
    console.log("sizeChange => lightPaint.psize=", lightPaint.psize);
  }

  /**
   * 透明度(アルファ値)変更
   * @param {string} value  選択されたvalue (0.01 ~ 1.0)
   */
  static alphaChange(value) {
    lightPaint.ptransparent = Number(value);
    // rgba() の最後の要素だけ上書き(色相を維持しつつαを変更)
    let temp = lightPaint.rgba.replace("rgba(", "").replace(")", "").split(",");
    // R,G,Bは変えず、アルファだけ新しい値に
    lightPaint.rgba = "rgba(" + temp[0] + ", " + temp[1] + ", " + temp[2] + ", " + value + ")";
    console.log("alphaChange => lightPaint.rgba=", lightPaint.rgba);
  }

  // ---- 履歴管理 (localStorage) ----

  /**
   * localStorage初期化 (描画ログを空リストにする)
   */
  initLocalStorage(){
    console.log("initLocalStorage() for key=", this.local_storage_key);
    lightPaint.myStorage.setItem(this.local_storage_key, JSON.stringify([]));
  }

  /**
   * 描画状態をlocalStorageに保存 (Undo/Redo用)
   */
  setLocalStoreage(){
    let png = this.mainCanvas.toDataURL(); // キャンバス全体をbase64エンコード
    let logs = JSON.parse(lightPaint.myStorage.getItem(this.local_storage_key)) || [];

    // 最新状態を先頭に追加
    logs.unshift({ png: png });
    // localStorage更新
    lightPaint.myStorage.setItem(this.local_storage_key, JSON.stringify(logs));
    
    // 一度戻った履歴をリセット (一貫性維持)
    this.temp = [];
    console.log("setLocalStoreage => logs.length=", logs.length);
  }

  /**
   * 描画をクリア (canvas全体を消去)
   */
  resetCanvas() {
    console.log("resetCanvas called => 全面クリア");
    this.context.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
  }

  /**
   * Undo(戻る) - 履歴を1つ前に戻す
   */
  prevCanvas() {
    console.log("prevCanvas called => 戻る(Undo)処理");
    let logs = JSON.parse(lightPaint.myStorage.getItem(this.local_storage_key)) || [];
    
    if(logs.length > 0) {
        // 先頭要素を取り除き、temp配列に避難
        this.temp.unshift(logs.shift());

        // localStorageを更新
        lightPaint.myStorage.setItem(this.local_storage_key, JSON.stringify(logs));
        // 実際のcanvasをクリア→logs[0]を描画 (logs[0]が1つ前の状態)
        this.resetCanvas();
        if (logs.length>0) {
          this.draw(logs[0].png);
        }
        console.log("prevCanvas => logs.length=", logs.length);
    }
    else {
        console.log("prevCanvas => 履歴が空です。戻る操作はできません。");
    }
  }
  
  /**
   * Redo(進む) - 一度「戻る」した状態を再適用
   */
  nextCanvas() {
    console.log("nextCanvas called => 進む(Redo)処理");
    let logs = JSON.parse(lightPaint.myStorage.getItem(this.local_storage_key)) || [];

    if(this.temp.length > 0) {
        // temp配列から先頭要素を取り出し、logsの先頭に戻す
        logs.unshift(this.temp.shift());

        // localStorageを更新
        lightPaint.myStorage.setItem(this.local_storage_key, JSON.stringify(logs));
        // canvasをクリア→logs[0]を描画
        this.resetCanvas();
        this.draw(logs[0].png);
        console.log("nextCanvas => logs.length=", logs.length);
    }
    else {
        console.log("nextCanvas => 進めるものがありません。(tempが空)");
    }
  }

  /**
   * 与えられたbase64画像をcanvasに描画する
   * @param {string} src 
   */
  draw(src) {
    console.log("draw => canvasにイメージを描画 (src base64 length=", src.length, ")");
    let img = new Image();
    img.src = src;

    img.onload = () => {
        this.context.globalCompositeOperation = 'source-over';
        this.context.drawImage(img, 0, 0);
        console.log("draw => 画像をキャンバスに描画完了");
    }
  }

  // ---- (将来)モード切り替えショートカットなど ----
  static switch_mode() {
    console.log("switch_mode called => 参考用のメソッド");
    // ここでは使用していないが、拡張的にkey操作でモード切り替え等に使える
  }

  initDraggableMenu() {
    let menuContainer = document.querySelector('.paint-menu-container');
    let titleBar = document.querySelector('.paint-menu-titlebar');
    
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;

    titleBar.addEventListener('pointerdown', startDragging);
    document.addEventListener('pointermove', drag);
    document.addEventListener('pointerup', stopDragging);

    function startDragging(e) {
        initialX = e.clientX - currentX;
        initialY = e.clientY - currentY;
        isDragging = true;
    }

    function drag(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        menuContainer.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }

    function stopDragging() {
        isDragging = false;
    }
  }

  // 選択範囲を描画する関数
  drawSelectionBox() {
    this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    
    // 選択範囲を点線で表示
    this.tempcontext.setLineDash([5, 5]);
    this.tempcontext.strokeStyle = '#000';
    this.tempcontext.lineWidth = 1;
    this.tempcontext.beginPath();
    
    const width = this.selectionEnd.x - this.selectionStart.x;
    const height = this.selectionEnd.y - this.selectionStart.y;
    
    this.tempcontext.strokeRect(
      this.selectionStart.x,
      this.selectionStart.y,
      width,
      height
    );
    
    this.tempcontext.setLineDash([]);
  }

  // 選択範囲の内容を保存
  saveSelection() {
    const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
    const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
    
    const startX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const startY = Math.min(this.selectionStart.y, this.selectionEnd.y);
    
    // 選択範囲の画像を保存
    this.selectedImage = this.context.getImageData(startX, startY, width, height);
    this.currentDrawPos = { x: startX, y: startY };
    this.originalPos = { x: startX, y: startY, width: width, height: height };
    
    // メインキャンバスの選択範囲を消去
    this.context.clearRect(startX, startY, width, height);
    
    // 選択範囲をtempCanvasに表示
    this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    this.tempcontext.putImageData(this.selectedImage, startX, startY);
    
    // 選択範囲を点線で表示
    this.tempcontext.setLineDash([5, 5]);
    this.tempcontext.strokeStyle = '#000';
    this.tempcontext.lineWidth = 1;
    this.tempcontext.strokeRect(
        startX,
        startY,
        width,
        height
    );
    this.tempcontext.setLineDash([]);
    
    // 履歴に保存（選択範囲を消去した状態を保存）
    this.setLocalStoreage();
  }

  // 選択範囲を移動
  moveSelection(x, y) {
    if (!this.selectedImage || !this.currentDrawPos) return;
    
    this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    
    // 選択範囲の画像を描画
    this.tempcontext.putImageData(this.selectedImage, x, y);
    
    // 選択範囲を点線で表示
    this.tempcontext.setLineDash([5, 5]);
    this.tempcontext.strokeStyle = '#000';
    this.tempcontext.lineWidth = 1;
    this.tempcontext.strokeRect(
        x,
        y,
        this.selectedImage.width,
        this.selectedImage.height
    );
    this.tempcontext.setLineDash([]);

    // 現在の描画位置を保存
    this.currentDrawPos = { x: x, y: y };
  }

  // 選択範囲を確定
  confirmSelection(x, y) {
    if (!this.selectedImage) return;
    
    this.context.putImageData(this.selectedImage, x, y);
    this.selectedImage = null;
    this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    
    // 履歴に保存
    this.setLocalStoreage();
  }

  // 選択を解除する関数を追加
  cancelSelection() {
    if (this.selectedImage && this.currentDrawPos) {
        // 選択範囲の画像を元の位置に戻す
        this.context.putImageData(
            this.selectedImage,
            this.originalPos.x,
            this.originalPos.y
        );
        
        // 選択状態をクリア
        this.selectedImage = null;
        this.currentDrawPos = null;
        this.originalPos = null;
        this.tempcontext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        
        // 履歴に保存
        this.setLocalStoreage();
    }
  }

  // モード変更時の処理を追加
  static modeChange(mode) {
    lightPaint.mode = mode;
    // モード変更時に選択を解除
    if (lightPaint.obj[0] && lightPaint.obj[0].selectedImage) {
        lightPaint.obj[0].cancelSelection();
    }
  }

  // HTMLファイルとして保存する関数を修正
  saveAsHTML() {
    // 現在のキャンバスの内容をデータURLとして取得
    const imageData = this.mainCanvas.toDataURL('image/png');
    
    // 現在のHTMLを取得
    let htmlContent = document.documentElement.outerHTML;
    
    // カラーピッカー関連のタグをすべて削除
    const removeColorPicker = () => {
        // DOMパーサーを使用してHTMLを解析
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        // カラーピッカーの要素を検索して削除
        const colorPickers = doc.querySelectorAll('.sp-container');
        colorPickers.forEach(picker => {
            picker.parentNode.removeChild(picker);
        });
        
        // 更新されたHTMLを取得
        htmlContent = doc.documentElement.outerHTML;
    };
    
    // カラーピッカーを削除
    removeColorPicker();
    
    // データ保存用のtextareaがすでに存在するか確認
    let dataTextArea = document.getElementById(this.CANVAS_DATA_ID);
    if (!dataTextArea) {
        // textareaが存在しない場合は新規作成
        const textareaHtml = `<textarea id="${this.CANVAS_DATA_ID}" style="display:none;"></textarea>`;
        htmlContent = htmlContent.replace('</body>', textareaHtml + '</body>');
    }
    
    // スクリプトがすでに存在するか確認
    const scriptPattern = new RegExp(`<script id="${this.SCRIPT_ID}">[\\s\\S]*?</script>`, 'g');
    if (!scriptPattern.test(htmlContent)) {
        // スクリプトが存在しない場合は追加
        const scriptContent = `
        <script id="${this.SCRIPT_ID}">
            (function() {
                // 画像読み込み関数を一度だけ定義
                if (window.loadCanvasImage) return;
                window.loadCanvasImage = function() {
                    const dataArea = document.getElementById('${this.CANVAS_DATA_ID}');
                    if (!dataArea || !dataArea.value) return;
                    
                    const canvas = document.querySelector('.mainCanvas');
                    if (!canvas) return;
                    
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = function() {
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = dataArea.value;
                };
                
                // DOMContentLoaded時に一度だけ実行
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', loadCanvasImage);
                } else {
                    loadCanvasImage();
                }
            })();
        </script>
        `;
        htmlContent = htmlContent.replace('</body>', scriptContent + '</body>');
    }
    
    // textareaの内容を更新
    const textareaPattern = new RegExp(
        `<textarea id="${this.CANVAS_DATA_ID}" style="display:none;">[^<]*</textarea>`,
        'g'
    );
    const updatedHtml = htmlContent.replace(
        textareaPattern,
        `<textarea id="${this.CANVAS_DATA_ID}" style="display:none;">${imageData}</textarea>`
    );
    
    // ダウンロード用のリンクを作成
    const blob = new Blob([updatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paint_canvas.html';
    
    // リンクをクリックしてダウンロード
    document.body.appendChild(a);
    a.click();
    
    // 後処理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * ペイントメニューを非表示にするクラスメソッド
   * 画面上のすべてのペイントメニュー（タイトルバーが水色のもの）を非表示にします
   */
  static menuOff() {
    const menuContainers = document.querySelectorAll('.paint-menu-container');
    menuContainers.forEach(container => {
      container.style.display = 'none';
    });
    console.log('ペイントメニューを非表示にしました。');
  }

  /**
   * ペイントメニューを表示にするクラスメソッド
   * 画面上のすべてのペイントメニュー（タイトルバーが水色のもの）を表示します
   */
  static menuOn() {
    const menuContainers = document.querySelectorAll('.paint-menu-container');
    menuContainers.forEach(container => {
      container.style.display = '';
    });
    console.log('ペイントメニューを表示しました。');
  }

} // End of class
