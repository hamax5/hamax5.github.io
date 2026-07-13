        // PDF.js の設定
        const pdfjsLib = window['pdfjsLib'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.13.216/pdf.worker.min.js';

        // コンポーネントクラスのレジストリ
        const componentRegistry = {};

        // コンポーネントクラスを登録する関数
        function registerComponent(type, classRef) {
            componentRegistry[type] = classRef;
        }

        // ユニークなID番号を生成する関数（UUID風）
        function generateUniqueId(customId = null) {
            if (customId) {
                return customId;
            }
            return 'component-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        }

        // クラス名の追加を処理する関数
        function addClassNames(element, classes) {
            classes.forEach(cls => {
                if (cls) {
                    element.classList.add(cls);
                }
            });
        }

        // 現在のモード（true: 編集モード, false: ユーザーモード）
        let isEditMode = true;
        
        // クリック取り込みモード（null: 無効, PaletteCompoundインスタンス: 有効）
        let clickImportModeCompound = null;
        
        // 登録されたコンパウンドを保存するグローバル変数
        let registeredCompounds = {};
        
        // プルダウンメニューを更新する関数（グローバルスコープ）
        function updateCompoundMenuDropdown() {
            const select = $('#compoundMenuSelect');
            if (select.length === 0) {
                console.warn('compoundMenuSelect要素が見つかりません');
                return;
            }
            select.empty();
            select.append('<option value="">登録されたコンパウンドを選択</option>');
            
            Object.keys(registeredCompounds).forEach(name => {
                select.append(`<option value="${name}">${name}</option>`);
            });
        }
        
        // タイトルバーのクリックイベントを監視（クリック取り込みモード用）
        $(document).on('click', '.palette-top', function(e) {
            // ボタンがクリックされた場合は無視
            if ($(e.target).closest('.buttons').length > 0) {
                return;
            }
            
            // クリック取り込みモードが有効でない場合は無視
            if (!clickImportModeCompound) {
                return;
            }
            
            // クリックされたコンポーネントを取得
            const container = $(this).closest('.palette-container')[0];
            if (!container) {
                return;
            }
            
            const componentId = container.id;
            const instance = $(container).data('instance');
            const instanceId = instance && instance.id ? instance.id : componentId;
            
            // 取り込み可能かチェック
            if (!clickImportModeCompound.isComponentImportable(componentId, instanceId)) {
                alert('このコンポーネントはすでにコンパウンドのコンポーネントになっています');
                clickImportModeCompound.deactivateClickImportMode();
                return;
            }
            
            // コンポーネントを取り込む
            clickImportModeCompound.addComponent(componentId);
            clickImportModeCompound.deactivateClickImportMode();
            
            e.stopPropagation();
        });

        // ペイントキャンバス保護用の共通関数
        let resizeRestoreInterval = null;
        
        function protectCanvasOnResizeStart(container) {
            if (typeof lightPaint !== 'undefined' && lightPaint.obj[0] && lightPaint.obj[0].mainCanvas) {
                const canvas = lightPaint.obj[0].mainCanvas;
                const imageData = canvas.toDataURL('image/png');
                $(container).data('saved-canvas-data', imageData);
                // リサイズ中はキャンバスのpointer-eventsを無効化
                $('#paintbody').css('pointer-events', 'none');
                
                // 既存のインターバルをクリア
                if (resizeRestoreInterval !== null) {
                    clearInterval(resizeRestoreInterval);
                }
                
                // リサイズ中にキャンバスを定期的に復元（ちらつき防止）
                const savedData = imageData;
                const paintCanvas = canvas;
                const paintCtx = paintCanvas.getContext('2d');
                const restoreImg = new Image();
                restoreImg.src = savedData;
                
                restoreImg.onload = function() {
                    // 16msごとに復元（約60fps）
                    resizeRestoreInterval = setInterval(function() {
                        if ($(container).data('saved-canvas-data')) {
                            paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
                            paintCtx.drawImage(restoreImg, 0, 0);
                        } else {
                            clearInterval(resizeRestoreInterval);
                            resizeRestoreInterval = null;
                        }
                    }, 16);
                };
            }
        }

        function restoreCanvasOnResize(container) {
            // この関数は不要になったが、互換性のために残す
            // 実際の復元はprotectCanvasOnResizeStartで開始したインターバルで行われる
        }

        function restoreCanvasOnResizeStop(container) {
            // インターバルを停止
            if (resizeRestoreInterval !== null) {
                clearInterval(resizeRestoreInterval);
                resizeRestoreInterval = null;
            }
            
            if (typeof lightPaint !== 'undefined' && lightPaint.obj[0] && lightPaint.obj[0].mainCanvas) {
                const savedData = $(container).data('saved-canvas-data');
                if (savedData) {
                    const canvas = lightPaint.obj[0].mainCanvas;
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = function() {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        // リサイズ終了後、PAINT ONがチェックされている場合はpointer-eventsを有効化
                        const paintOnChecked = $('#paintOnCheckbox').prop('checked') || $('#paintmenu .painton').prop('checked');
                        if (paintOnChecked) {
                            $('#paintbody').css('pointer-events', 'auto');
                        }
                    };
                    img.src = savedData;
                    $(container).removeData('saved-canvas-data');
                    $(container).removeData('last-restore-time');
                } else {
                    // 保存データがない場合でも、pointer-eventsを復元
                    const paintOnChecked = $('#paintOnCheckbox').prop('checked') || $('#paintmenu .painton').prop('checked');
                    if (paintOnChecked) {
                        $('#paintbody').css('pointer-events', 'auto');
                    }
                }
            }
        }

        // Google Gemini API キーはPHPプロキシー（llm_proxy.php）内で管理
        // APIキーはJavaScriptから削除され、サーバー側で管理される

        // LM Studio API 設定（OpenAI互換エンドポイント）
        const LM_STUDIO_API_URL = 'http://localhost:1234/v1/chat/completions';
        const LM_STUDIO_DEFAULT_MODEL = 'lmstudio';
        // IDの重複をチェックする関数
        function isIdDuplicate(id) {
            return document.getElementById(id) !== null;
        }

        // 基底クラス
        class PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                if (new.target === PaletteComponent) {
                    throw new TypeError("Cannot construct PaletteComponent instances directly");
                }
                this.isChild = isChild;
                this.customId = customId;
                this.customClasses = customClasses;
                this.id = container ? container.id : generateUniqueId(customId);
                this.container = container || this.createContainer();
                this.linkedChildId = null;

                $(this.container).data('instance', this);
            }

            createContainer() {
                const container = document.createElement('div');
                container.className = 'palette-container';
                container.id = generateUniqueId(this.customId);
                container.style.left = '200px';
                container.style.top = `${100 + Math.random() * 200}px`;
                container.setAttribute('data-component-type', this.getComponentType());
                addClassNames(container, this.customClasses);
                return container;
            }

            createTitleBar() {
                const top = document.createElement('div');
                top.className = 'palette-top';

                const title = document.createElement('span');
                title.className = 'title';
                title.textContent = this.getComponentName() + this.getTitleInfo();
                top.appendChild(title);

                if (!this.isChild) {
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'buttons';

                    // E/Uトグルボタン（ユーザーモード表示制御）
                    const userModeToggleButton = document.createElement('button');
                    // 初期状態は'U'（両方のモードで表示）
                    const initialUserModeState = this.container.getAttribute('data-user-mode-visible') || 'U';
                    userModeToggleButton.textContent = initialUserModeState;
                    userModeToggleButton.title = initialUserModeState === 'U' ? "ユーザーモードと編集モードの両方で表示" : "編集モードのみ表示";
                    userModeToggleButton.className = 'user-mode-toggle-button';
                    userModeToggleButton.onclick = (e) => {
                        e.stopPropagation();
                        const currentState = userModeToggleButton.textContent;
                        const newState = currentState === 'U' ? 'E' : 'U';
                        userModeToggleButton.textContent = newState;
                        userModeToggleButton.title = newState === 'U' ? "ユーザーモードと編集モードの両方で表示" : "編集モードのみ表示";
                        this.container.setAttribute('data-user-mode-visible', newState);
                        // 現在ユーザーモードの場合は、即座に表示/非表示を反映
                        if (!isEditMode) {
                            this.updateUserModeVisibility();
                        }
                    };

                    const toggleButton = document.createElement('button');
                    toggleButton.textContent = '+';
                    toggleButton.title = "子要素の表示/非表示";
                    toggleButton.className = 'toggle-button';
                    toggleButton.onclick = (e) => {
                        e.stopPropagation();
                        this.toggleChild(toggleButton);
                    };

                    const executeButton = document.createElement('button');
                    executeButton.textContent = '▶';
                    executeButton.title = "子要素のコードを実行";
                    executeButton.className = 'execute-button';
                    executeButton.onclick = (e) => {
                        e.stopPropagation();
                        this.executeChildCode();
                    };

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = '×';
                    deleteButton.title = "コンポーネントを削除";
                    deleteButton.className = 'delete-button';
                    deleteButton.onclick = (e) => {
                        e.stopPropagation();
                        // 子コンポーネントも一緒に削除
                        if (this.linkedChildId) {
                            const childElement = document.getElementById(this.linkedChildId);
                            if (childElement) {
                                childElement.remove();
                                console.log(`Child component ID: ${this.linkedChildId} has been removed with parent.`);
                            }
                        }
                        // 表示エリア（displayComponent）も一緒に削除
                        if (this.displayComponent && this.displayComponent.container) {
                            this.displayComponent.container.remove();
                            console.log(`Display component ID: ${this.displayComponent.id} has been removed with parent.`);
                        }
                        this.container.remove();
                        console.log(`Component ID: ${this.id} has been removed.`);
                    };

                    // アイコン化ボタン（全コンポーネント共通、ユーザーモードトグルの右隣あたり）
                    const iconifyButton = document.createElement('button');
                    iconifyButton.textContent = '□';
                    iconifyButton.title = "コンポーネントをアイコン化";
                    iconifyButton.className = 'iconify-button';
                    iconifyButton.onclick = (e) => {
                        e.stopPropagation();
                        this.toggleIconify();
                    };

                    // iframeコンポーネント用のリフレッシュボタンとズームスライダー（Uアイコンの左側に配置）
                    if (this.getComponentType && this.getComponentType() === 'iframe') {
                        // リフレッシュボタン（ズームスライダーの左側）
                        const refreshButton = document.createElement('button');
                        refreshButton.textContent = '⟳';
                        refreshButton.title = 'iframeを再読込';
                        refreshButton.onclick = (e) => {
                            e.stopPropagation();
                            if (typeof this.refreshIframe === 'function') {
                                this.refreshIframe();
                            }
                        };
                        buttonContainer.appendChild(refreshButton);

                        // ズームスライダー
                        const zoomSlider = document.createElement('input');
                        zoomSlider.type = 'range';
                        zoomSlider.min = '50';
                        zoomSlider.max = '200';
                        const initialZoom = this.container.getAttribute('data-iframe-zoom') || '100';
                        zoomSlider.value = initialZoom;
                        zoomSlider.className = 'iframe-zoom-slider';
                        zoomSlider.title = '拡大・縮小';
                        // スライダー操作中はドラッグ開始やクリック取り込みを抑制
                        zoomSlider.onmousedown = (e) => {
                            e.stopPropagation();
                        };
                        zoomSlider.onclick = (e) => {
                            e.stopPropagation();
                        };
                        zoomSlider.oninput = (e) => {
                            e.stopPropagation();
                            const value = parseInt(zoomSlider.value, 10);
                            const zoomValue = isNaN(value) ? 100 : value;
                            this.container.setAttribute('data-iframe-zoom', zoomValue.toString());
                            if (typeof this.applyIframeZoom === 'function') {
                                this.applyIframeZoom(zoomValue);
                            }
                        };
                        buttonContainer.appendChild(zoomSlider);
                    }

                    // ボタン類をタイトルバー右側に追加（iframeズームスライダーがあればその右隣にUボタンが来る）
                    buttonContainer.appendChild(userModeToggleButton);
                    buttonContainer.appendChild(iconifyButton);
                    buttonContainer.appendChild(toggleButton);
                    buttonContainer.appendChild(executeButton);
                    buttonContainer.appendChild(deleteButton);
                    top.appendChild(buttonContainer);
                }
                return top;
            }

            getComponentName() {
                throw new Error('getComponentName() must be implemented by subclasses');
            }

            getComponentType() {
                throw new Error('getComponentType() must be implemented by subclasses');
            }

            getTitleInfo() {
                let info = '';
                if (this.customId) {
                    info += ` (ID: ${this.customId})`;
                }
                if (this.customClasses.length > 0) {
                    info += ` (Class: ${this.customClasses.join(', ')})`;
                }
                return info;
            }

            static getMainText(idname) {
                // idnameで指定されたIDを持つコンポーネントを探す
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`Component with ID "${idname}" not found`);
                    return '';
                }

                // コンポーネントコンテナかどうかを確認
                if (!element.classList.contains('palette-container')) {
                    console.warn(`Element with ID "${idname}" is not a palette component`);
                    return '';
                }

                // コンポーネントタイプを取得
                const componentType = element.getAttribute('data-component-type');
                if (!componentType) {
                    console.warn(`Component with ID "${idname}" has no component type`);
                    return '';
                }

                // コンポーネントインスタンスを取得
                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`Component instance not found for ID "${idname}"`);
                    return '';
                }

                // コンポーネントタイプに応じてテキストを取得
                switch (componentType) {
                    case 'textarea':
                    case 'algebrite':
                    case 'nerdamer':
                    case 'tex':
                    case 'markdown':
                    case 'llm': {
                        // テキストエリア、Algebrite端末、Nerdamer端末、TeX、Markdown、LLMの場合
                        let textarea = null;
                        if (instance.getTextarea && typeof instance.getTextarea === 'function') {
                            textarea = instance.getTextarea();
                        } else if (instance.getInputElement && typeof instance.getInputElement === 'function') {
                            const inputElement = instance.getInputElement();
                            if (inputElement) {
                                textarea = inputElement.querySelector('textarea') || inputElement;
                            }
                        }
                        return textarea ? textarea.value : '';
                    }
                    case 'textbox': {
                        // テキストボックスの場合
                        const inputElement = instance.getInputElement ? instance.getInputElement() : null;
                        if (inputElement && inputElement.tagName === 'INPUT' && inputElement.type === 'text') {
                            return inputElement.value || '';
                        }
                        return '';
                    }
                    case 'dropdown': {
                        // プルダウンの場合
                        const selectElement = instance.getInputElement ? instance.getInputElement() : null;
                        if (selectElement && selectElement.tagName === 'SELECT') {
                            const selectedOption = selectElement.options[selectElement.selectedIndex];
                            return selectedOption ? selectedOption.textContent : '';
                        }
                        return '';
                    }
                    default:
                        console.warn(`Component type "${componentType}" is not supported by getMainText`);
                        return '';
                }
            }

            static putMainText(idname, text) {
                // idnameで指定されたIDを持つコンポーネントを探す
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`Component with ID "${idname}" not found`);
                    alert(`ID "${idname}" のコンポーネントが見つかりません`);
                    return;
                }

                // コンポーネントコンテナかどうかを確認
                if (!element.classList.contains('palette-container')) {
                    console.warn(`Element with ID "${idname}" is not a palette component`);
                    alert(`ID "${idname}" はパレットコンポーネントではありません`);
                    return;
                }

                // コンポーネントタイプを取得
                const componentType = element.getAttribute('data-component-type');
                if (!componentType) {
                    console.warn(`Component with ID "${idname}" has no component type`);
                    alert(`ID "${idname}" のコンポーネントタイプが不明です`);
                    return;
                }

                // コンポーネントインスタンスを取得
                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`Component instance not found for ID "${idname}"`);
                    alert(`ID "${idname}" のコンポーネントインスタンスが見つかりません`);
                    return;
                }

                // textが未定義またはnullの場合は空文字列に変換
                const textValue = text !== undefined && text !== null ? String(text) : '';

                // コンポーネントタイプに応じてテキストを設定
                switch (componentType) {
                    case 'textarea':
                    case 'algebrite':
                    case 'nerdamer':
                    case 'tex':
                    case 'markdown':
                    case 'llm': {
                        // テキストエリア、Algebrite端末、Nerdamer端末、TeX、Markdown、LLMの場合
                        let textarea = null;
                        if (instance.getTextarea && typeof instance.getTextarea === 'function') {
                            textarea = instance.getTextarea();
                        } else if (instance.getInputElement && typeof instance.getInputElement === 'function') {
                            const inputElement = instance.getInputElement();
                            if (inputElement) {
                                textarea = inputElement.querySelector('textarea') || inputElement;
                            }
                        }
                        if (textarea) {
                            textarea.value = textValue;
                        } else {
                            console.warn(`Textarea not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のテキストエリアが見つかりません`);
                        }
                        break;
                    }
                    case 'textbox': {
                        // テキストボックスの場合
                        const inputElement = instance.getInputElement ? instance.getInputElement() : null;
                        if (inputElement && inputElement.tagName === 'INPUT' && inputElement.type === 'text') {
                            inputElement.value = textValue;
                        } else {
                            console.warn(`Textbox input not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のテキストボックスが見つかりません`);
                        }
                        break;
                    }
                    case 'dropdown': {
                        // プルダウンの場合
                        const selectElement = instance.getInputElement ? instance.getInputElement() : null;
                        if (selectElement && selectElement.tagName === 'SELECT') {
                            // オプションを検索して、textValueと一致するものを探す
                            let found = false;
                            for (let i = 0; i < selectElement.options.length; i++) {
                                if (selectElement.options[i].textContent === textValue) {
                                    selectElement.selectedIndex = i;
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                alert(`ID "${idname}" のプルダウンメニューに "${textValue}" という選択肢が見つかりません`);
                            }
                        } else {
                            console.warn(`Dropdown select not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のプルダウンメニューが見つかりません`);
                        }
                        break;
                    }
                    default:
                        console.warn(`Component type "${componentType}" is not supported by putMainText`);
                        alert(`コンポーネントタイプ "${componentType}" は putMainText でサポートされていません`);
                }
            }

            static exeMainText(idname) {
                // idnameで指定されたIDを持つコンポーネントを探す
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`Component with ID "${idname}" not found`);
                    alert(`ID "${idname}" のコンポーネントが見つかりません`);
                    return;
                }

                // コンポーネントコンテナかどうかを確認
                if (!element.classList.contains('palette-container')) {
                    console.warn(`Element with ID "${idname}" is not a palette component`);
                    alert(`ID "${idname}" の要素はパレットコンポーネントではありません`);
                    return;
                }

                // コンポーネントタイプを取得
                const componentType = element.getAttribute('data-component-type');
                if (!componentType) {
                    console.warn(`Component with ID "${idname}" has no component type`);
                    alert(`ID "${idname}" のコンポーネントタイプが不明です`);
                    return;
                }

                // コンポーネントインスタンスを取得
                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`Component instance not found for ID "${idname}"`);
                    alert(`ID "${idname}" のコンポーネントインスタンスが見つかりません`);
                    return;
                }

                // コンポーネントタイプに応じて実行
                switch (componentType) {
                    case 'algebrite': {
                        // Algebrite端末の場合：「実行」ボタンをクリックしたときと同じ動作
                        if (instance.executeAlgebrite && typeof instance.executeAlgebrite === 'function') {
                            instance.executeAlgebrite();
                        } else {
                            console.warn(`executeAlgebrite method not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のAlgebrite端末で実行メソッドが見つかりません`);
                        }
                        break;
                    }
                    case 'nerdamer': {
                        // Nerdamer端末の場合：「実行」ボタンをクリックしたときと同じ動作
                        if (instance.executeNerdamer && typeof instance.executeNerdamer === 'function') {
                            instance.executeNerdamer();
                        } else {
                            console.warn(`executeNerdamer method not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のNerdamer端末で実行メソッドが見つかりません`);
                        }
                        break;
                    }
                    case 'tex': {
                        // TeXの場合：「表示」ボタンをクリックしたときと同じ動作
                        if (instance.renderTeX && typeof instance.renderTeX === 'function') {
                            instance.renderTeX();
                        } else {
                            console.warn(`renderTeX method not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のTeXコンポーネントで表示メソッドが見つかりません`);
                        }
                        break;
                    }
                    case 'markdown': {
                        // Markdownの場合：「表示」ボタンをクリックしたときと同じ動作
                        if (instance.renderMarkdown && typeof instance.renderMarkdown === 'function') {
                            instance.renderMarkdown();
                        } else {
                            console.warn(`renderMarkdown method not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のMarkdownコンポーネントで表示メソッドが見つかりません`);
                        }
                        break;
                    }
                    case 'button': {
                        // ボタンの場合：ボタンをクリックしたときと同じ動作
                        if (instance.executeChildCode && typeof instance.executeChildCode === 'function') {
                            instance.executeChildCode();
                        } else {
                            console.warn(`executeChildCode method not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のボタンコンポーネントで実行メソッドが見つかりません`);
                        }
                        break;
                    }
                    case 'llm': {
                        // LLMの場合：「問い合わせ」ボタンをクリックしたときと同じ動作
                        if (instance.queryGemini && typeof instance.queryGemini === 'function') {
                            instance.queryGemini();
                        } else {
                            console.warn(`queryGemini method not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のLLMコンポーネントで問い合わせメソッドが見つかりません`);
                        }
                        break;
                    }
                    case 'echart': {
                        // EChartの場合：タイトルバーの▶アイコンをクリックしたときと同じ動作（子要素のコードを実行）
                        if (instance.executeChildCode && typeof instance.executeChildCode === 'function') {
                            instance.executeChildCode();
                        } else {
                            console.warn(`executeChildCode method not found for component ID "${idname}"`);
                            alert(`ID "${idname}" のEChartコンポーネントで実行メソッドが見つかりません`);
                        }
                        break;
                    }
                    default:
                        console.warn(`Component type "${componentType}" is not supported by exeMainText`);
                        alert(`コンポーネントタイプ "${componentType}" は exeMainText でサポートされていません`);
                }
            }

            static hideDisplayArea(idname) {
                // idnameで指定されたIDを持つコンポーネントを探す
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`Component with ID "${idname}" not found`);
                    alert(`ID "${idname}" のコンポーネントが見つかりません`);
                    return;
                }

                // コンポーネントコンテナかどうかを確認
                if (!element.classList.contains('palette-container')) {
                    console.warn(`Element with ID "${idname}" is not a palette component`);
                    alert(`ID "${idname}" の要素はパレットコンポーネントではありません`);
                    return;
                }

                // コンポーネントタイプを取得
                const componentType = element.getAttribute('data-component-type');
                if (!componentType) {
                    console.warn(`Component with ID "${idname}" has no component type`);
                    alert(`ID "${idname}" のコンポーネントタイプが不明です`);
                    return;
                }

                // コンポーネントインスタンスを取得
                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`Component instance not found for ID "${idname}"`);
                    alert(`ID "${idname}" のコンポーネントインスタンスが見つかりません`);
                    return;
                }

                // コンポーネントタイプに応じて表示エリアを非表示にする
                switch (componentType) {
                    case 'tex':
                    case 'markdown':
                    case 'llm': {
                        // TeX、Markdown、LLMの場合：表示エリアを非表示にする
                        if (instance.displayComponent && instance.displayComponent.container) {
                            instance.displayComponent.container.style.display = 'none';
                            console.log(`Display area hidden for component ID: ${idname}`);
                        } else {
                            console.warn(`Display component not found for component ID "${idname}"`);
                            alert(`ID "${idname}" の表示エリアが見つかりません`);
                        }
                        break;
                    }
                    default:
                        console.warn(`Component type "${componentType}" is not supported by hideDisplayArea`);
                        alert(`コンポーネントタイプ "${componentType}" は hideDisplayArea でサポートされていません`);
                }
            }

            static showDisplayArea(idname) {
                // idnameで指定されたIDを持つコンポーネントを探す
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`Component with ID "${idname}" not found`);
                    alert(`ID "${idname}" のコンポーネントが見つかりません`);
                    return;
                }

                // コンポーネントコンテナかどうかを確認
                if (!element.classList.contains('palette-container')) {
                    console.warn(`Element with ID "${idname}" is not a palette component`);
                    alert(`ID "${idname}" の要素はパレットコンポーネントではありません`);
                    return;
                }

                // コンポーネントタイプを取得
                const componentType = element.getAttribute('data-component-type');
                if (!componentType) {
                    console.warn(`Component with ID "${idname}" has no component type`);
                    alert(`ID "${idname}" のコンポーネントタイプが不明です`);
                    return;
                }

                // コンポーネントインスタンスを取得
                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`Component instance not found for ID "${idname}"`);
                    alert(`ID "${idname}" のコンポーネントインスタンスが見つかりません`);
                    return;
                }

                // コンポーネントタイプに応じて表示エリアを表示する
                switch (componentType) {
                    case 'tex':
                    case 'markdown':
                    case 'llm': {
                        // TeX、Markdown、LLMの場合：表示エリアを表示する
                        if (instance.displayComponent && instance.displayComponent.container) {
                            instance.displayComponent.container.style.display = '';
                            console.log(`Display area shown for component ID: ${idname}`);
                        } else {
                            console.warn(`Display component not found for component ID "${idname}"`);
                            alert(`ID "${idname}" の表示エリアが見つかりません`);
                        }
                        break;
                    }
                    default:
                        console.warn(`Component type "${componentType}" is not supported by showDisplayArea`);
                        alert(`コンポーネントタイプ "${componentType}" は showDisplayArea でサポートされていません`);
                }
            }

            static getSubText(idname) {
                // idnameで指定されたIDを持つコンポーネントを探す
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`Component with ID "${idname}" not found`);
                    return '';
                }

                // コンポーネントコンテナかどうかを確認
                if (!element.classList.contains('palette-container')) {
                    console.warn(`Element with ID "${idname}" is not a palette component`);
                    return '';
                }

                // コンポーネントインスタンスを取得
                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`Component instance not found for ID "${idname}"`);
                    return '';
                }

                // 子要素のIDを取得
                const linkedChildId = instance.linkedChildId || element.getAttribute('data-linked-child');
                if (!linkedChildId) {
                    console.warn(`Component with ID "${idname}" has no child component`);
                    return '';
                }

                // 子要素を取得
                const childElement = document.getElementById(linkedChildId);
                if (!childElement) {
                    console.warn(`Child component with ID "${linkedChildId}" not found`);
                    return '';
                }

                // 子要素のインスタンスを取得
                const childInstance = $(childElement).data('instance');
                if (!childInstance) {
                    console.warn(`Child component instance not found for ID "${linkedChildId}"`);
                    return '';
                }

                // 子要素のテキストエリアを取得
                let textarea = null;
                if (childInstance.getInputElement && typeof childInstance.getInputElement === 'function') {
                    const inputElement = childInstance.getInputElement();
                    if (inputElement) {
                        // textarea要素を探す
                        if (inputElement.tagName === 'TEXTAREA') {
                            textarea = inputElement;
                        } else {
                            textarea = inputElement.querySelector('textarea');
                        }
                    }
                }

                // テキストエリアの値を返す
                return textarea ? textarea.value : '';
            }

            static putSubText(idname, text) {
                // idnameで指定されたIDを持つコンポーネントを探す
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`Component with ID "${idname}" not found`);
                    alert(`ID "${idname}" のコンポーネントが見つかりません`);
                    return;
                }

                // コンポーネントコンテナかどうかを確認
                if (!element.classList.contains('palette-container')) {
                    console.warn(`Element with ID "${idname}" is not a palette component`);
                    alert(`ID "${idname}" の要素はパレットコンポーネントではありません`);
                    return;
                }

                // コンポーネントインスタンスを取得
                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`Component instance not found for ID "${idname}"`);
                    alert(`ID "${idname}" のコンポーネントインスタンスが見つかりません`);
                    return;
                }

                // 子要素のIDを取得
                let linkedChildId = instance.linkedChildId || element.getAttribute('data-linked-child');
                let childElement = null;
                let childInstance = null;

                // 子要素がない場合は自動的に作成
                if (!linkedChildId) {
                    // 子要素を作成
                    if (instance.createChildComponent && typeof instance.createChildComponent === 'function') {
                        const childComponent = instance.createChildComponent();
                        if (childComponent && childComponent.container) {
                            const parentRect = instance.container.getBoundingClientRect();
                            childComponent.container.style.left = `${parentRect.left + 220}px`;
                            childComponent.container.style.top = `${parentRect.top}px`;
                            linkedChildId = childComponent.container.id;
                            instance.linkedChildId = linkedChildId;
                            instance.container.setAttribute('data-linked-child', linkedChildId);
                            childComponent.initializeResizable();
                            // 自動的に作成した子要素は非表示にする
                            childComponent.container.style.display = 'none';
                            // 子要素の表示状態を保存
                            instance.container.setAttribute('data-child-visible', 'false');
                            childElement = childComponent.container;
                            childInstance = childComponent;
                            console.log(`Created child component with ID: ${linkedChildId} for parent ID: ${idname} (hidden)`);
                        } else {
                            console.warn(`Failed to create child component for ID "${idname}"`);
                            alert(`ID "${idname}" の子要素を作成できませんでした`);
                            return;
                        }
                    } else {
                        console.warn(`Component with ID "${idname}" does not support createChildComponent`);
                        alert(`ID "${idname}" のコンポーネントは子要素を作成できません`);
                        return;
                    }
                } else {
                    // 既存の子要素を取得
                    childElement = document.getElementById(linkedChildId);
                    if (!childElement) {
                        console.warn(`Child component with ID "${linkedChildId}" not found`);
                        // 子要素が見つからない場合は再作成
                        if (instance.createChildComponent && typeof instance.createChildComponent === 'function') {
                            const childComponent = instance.createChildComponent();
                            if (childComponent && childComponent.container) {
                                const parentRect = instance.container.getBoundingClientRect();
                                childComponent.container.style.left = `${parentRect.left + 220}px`;
                                childComponent.container.style.top = `${parentRect.top}px`;
                                linkedChildId = childComponent.container.id;
                                instance.linkedChildId = linkedChildId;
                                instance.container.setAttribute('data-linked-child', linkedChildId);
                                childComponent.initializeResizable();
                                // 自動的に作成した子要素は非表示にする
                                childComponent.container.style.display = 'none';
                                // 子要素の表示状態を保存
                                instance.container.setAttribute('data-child-visible', 'false');
                                childElement = childComponent.container;
                                childInstance = childComponent;
                                console.log(`Recreated child component with ID: ${linkedChildId} for parent ID: ${idname} (hidden)`);
                            } else {
                                console.warn(`Failed to recreate child component for ID "${idname}"`);
                                alert(`ID "${idname}" の子要素を再作成できませんでした`);
                                return;
                            }
                        } else {
                            alert(`ID "${idname}" の子要素（ID: "${linkedChildId}"）が見つかりません`);
                            return;
                        }
                    } else {
                        // 子要素のインスタンスを取得
                        childInstance = $(childElement).data('instance');
                        if (!childInstance) {
                            console.warn(`Child component instance not found for ID "${linkedChildId}"`);
                            alert(`ID "${idname}" の子要素のインスタンスが見つかりません`);
                            return;
                        }
                    }
                }

                // 子要素のテキストエリアを取得
                let textarea = null;
                if (childInstance.getInputElement && typeof childInstance.getInputElement === 'function') {
                    const inputElement = childInstance.getInputElement();
                    if (inputElement) {
                        // textarea要素を探す
                        if (inputElement.tagName === 'TEXTAREA') {
                            textarea = inputElement;
                        } else {
                            textarea = inputElement.querySelector('textarea');
                        }
                    }
                }

                // テキストエリアの値を設定
                if (textarea) {
                    const textValue = text !== undefined && text !== null ? String(text) : '';
                    textarea.value = textValue;
                } else {
                    console.warn(`Textarea not found for child component ID "${linkedChildId}"`);
                    alert(`ID "${idname}" の子要素にテキストエリアが見つかりません`);
                }
            }

            toggleChild(toggleButton) {
                if (this.linkedChildId) {
                    const childElement = document.getElementById(this.linkedChildId);
                    if (childElement) {
                        const isHidden = childElement.style.display === 'none';
                        childElement.style.display = isHidden ? 'block' : 'none';
                        toggleButton.textContent = isHidden ? '-' : '+';
                        // 子要素の表示状態を保存
                        this.container.setAttribute('data-child-visible', isHidden ? 'true' : 'false');
                        console.log(`Toggled child visibility for parent ID: ${this.id} to ${isHidden ? 'visible' : 'hidden'}.`);
                    }
                } else {
                    const childComponent = this.createChildComponent();
                    const parentRect = this.container.getBoundingClientRect();
                    childComponent.container.style.left = `${parentRect.left + 220}px`;
                    childComponent.container.style.top = `${parentRect.top}px`;
                    this.linkedChildId = childComponent.container.id;
                    this.container.setAttribute('data-linked-child', this.linkedChildId);
                    // 新しく作成した子要素は表示されているので、状態を保存
                    this.container.setAttribute('data-child-visible', 'true');
                    console.log(`Linked child ID: ${this.linkedChildId} to parent ID: ${this.id}.`);
                    toggleButton.textContent = '-';
                    childComponent.initializeResizable();
                }
            }

            executeChildCode() {
                console.log(`Executing child code for component ID: ${this.id}`);
                if (this.linkedChildId) {
                    const childElement = document.getElementById(this.linkedChildId);
                    if (childElement) {
                        const childType = $(childElement).data('component-type');
                        const childComponentClass = componentRegistry[childType];
                        if (childComponentClass) {
                            const childComponent = new childComponentClass(childElement, true);
                            const childInput = childComponent.getInputElement();
                            if (childInput) {
                                let codeToExecute = '';
                                if (childType === 'textarea') {
                                    codeToExecute = childInput.value.trim();
                                } else if (childType === 'pdf') {
                                    const pdfContainer = childInput;
                                    const canvas = pdfContainer.querySelector('canvas');
                                    if (canvas.style.display === 'none') {
                                        canvas.style.display = 'block';
                                        console.log(`PDF canvas ID: ${childComponent.id} is now visible.`);
                                    } else {
                                        canvas.style.display = 'none';
                                        console.log(`PDF canvas ID: ${childComponent.id} is now hidden.`);
                                    }
                                    return;
                                }
                                if (codeToExecute) {
                                    try {
                                        console.log(`Executing code from child ${childComponent.getComponentName()}: ${codeToExecute}`);
                                        // 親コンポーネントのインスタンスを変数に保存して、eval内で使用できるようにする
                                        const parentComponent = this;
                                        // グローバルスコープでも使用できるようにする（PaletteCinderella.evalcs()などで使用するため）
                                        window.currentParentComponent = this;
                                        eval(codeToExecute);
                                        // 実行後はクリア
                                        delete window.currentParentComponent;
                                    } catch (error) {
                                        console.error('Execution error:', error);
                                        // エラーが発生した場合もクリア
                                        delete window.currentParentComponent;
                                    }
                                } else {
                                    console.warn('Child input is empty. No code to execute.');
                                }
                            } else {
                                console.warn('No child input found to execute code.');
                            }
                        }
                    } else {
                        console.warn(`子要素のIDが見つかりません: ${this.linkedChildId}`);
                    }
                } else {
                    console.warn('No linked child found to execute code.');
                }
            }

            init() {
                const existingBody = this.container.querySelector('.palette-body');
                if (existingBody) {
                    this.rebindButtons();
                } else {
                    const titleBar = this.createTitleBar();
                    const body = document.createElement('div');
                    body.className = 'palette-body';

                    const inputElement = this.createInputElement();
                    body.appendChild(inputElement);

                    if (titleBar) {
                        this.container.appendChild(titleBar);
                    }
                    this.container.appendChild(body);
                    document.body.appendChild(this.container);
                    console.log(`Created new component: ${this.getComponentName()} with ID: ${this.id}`);
                }
                // 保存されたHTMLからlinkedChildIdを復元
                if (!this.linkedChildId) {
                    const savedLinkedChildId = this.container.getAttribute('data-linked-child');
                    if (savedLinkedChildId) {
                        this.linkedChildId = savedLinkedChildId;
                    }
                }
                const handleSelector = '.palette-top';
                $(this.container).draggable({ handle: handleSelector });
                this.initializeResizable();
                // 子要素の表示状態を復元
                this.restoreChildVisibility();
                // アイコン化状態の復元
                this.restoreIconifyState();
            }

            rebindButtons() {
                if (this.isChild) return;
                const userModeToggleButton = this.container.querySelector('.user-mode-toggle-button');
                const toggleButton = this.container.querySelector('.toggle-button');
                const executeButton = this.container.querySelector('.execute-button');
                const deleteButton = this.container.querySelector('.delete-button');
                const iconifyButton = this.container.querySelector('.iconify-button');
                const iframeZoomSlider = this.container.querySelector('.iframe-zoom-slider');

                if (userModeToggleButton) {
                    userModeToggleButton.onclick = (e) => {
                        e.stopPropagation();
                        const currentState = userModeToggleButton.textContent;
                        const newState = currentState === 'U' ? 'E' : 'U';
                        userModeToggleButton.textContent = newState;
                        userModeToggleButton.title = newState === 'U' ? "ユーザーモードと編集モードの両方で表示" : "編集モードのみ表示";
                        this.container.setAttribute('data-user-mode-visible', newState);
                        // 現在ユーザーモードの場合は、即座に表示/非表示を反映
                        if (!isEditMode) {
                            this.updateUserModeVisibility();
                        }
                    };
                }
                if (toggleButton) {
                    toggleButton.onclick = (e) => {
                        e.stopPropagation();
                        this.toggleChild(toggleButton);
                    };
                }
                if (executeButton) {
                    executeButton.onclick = (e) => {
                        e.stopPropagation();
                        this.executeChildCode();
                    };
                }
                if (deleteButton) {
                    deleteButton.onclick = (e) => {
                        e.stopPropagation();
                        // 子コンポーネントも一緒に削除
                        if (this.linkedChildId) {
                            const childElement = document.getElementById(this.linkedChildId);
                            if (childElement) {
                                childElement.remove();
                                console.log(`Child component ID: ${this.linkedChildId} has been removed with parent.`);
                            }
                        }
                        // 表示エリア（displayComponent）も一緒に削除
                        if (this.displayComponent && this.displayComponent.container) {
                            this.displayComponent.container.remove();
                            console.log(`Display component ID: ${this.displayComponent.id} has been removed with parent.`);
                        }
                        this.container.remove();
                        console.log(`Component ID: ${this.id} has been removed.`);
                    };
                }
                if (iconifyButton) {
                    iconifyButton.onclick = (e) => {
                        e.stopPropagation();
                        this.toggleIconify();
                    };
                }
                // iframeズームスライダーの再バインド（iframeコンポーネントのみ）
                if (iframeZoomSlider && this.getComponentType && this.getComponentType() === 'iframe') {
                    iframeZoomSlider.onmousedown = (e) => {
                        e.stopPropagation();
                    };
                    iframeZoomSlider.onclick = (e) => {
                        e.stopPropagation();
                    };
                    iframeZoomSlider.oninput = (e) => {
                        e.stopPropagation();
                        const value = parseInt(iframeZoomSlider.value, 10);
                        const zoomValue = isNaN(value) ? 100 : value;
                        this.container.setAttribute('data-iframe-zoom', zoomValue.toString());
                        if (typeof this.applyIframeZoom === 'function') {
                            this.applyIframeZoom(zoomValue);
                        }
                    };
                }
                console.log(`Rebound buttons for component ID: ${this.id}`);
                // 子要素の表示状態を復元
                this.restoreChildVisibility();
            }

            toggleIconify() {
                const isIconified = this.container.getAttribute('data-iconified') === 'true';
                if (isIconified) {
                    this.restoreFromIconify();
                } else {
                    this.applyIconify();
                }
            }

            applyIconify() {
                if (this.container.getAttribute('data-iconified') === 'true') return;
                const body = this.container.querySelector('.palette-body');
                const title = this.container.querySelector('.title');

                // 元のサイズと位置を保存
                this.container.setAttribute('data-original-width', this.container.style.width || '');
                this.container.setAttribute('data-original-height', this.container.style.height || '');

                // アイコン化用のクラスとサイズ
                this.container.classList.add('palette-iconified');
                if (body) body.style.display = 'none';
                this.container.style.width = '80px';
                this.container.style.height = '30px';

                // タイトルテキストを短く（先頭だけ）する
                if (title && !title.getAttribute('data-original-text')) {
                    title.setAttribute('data-original-text', title.textContent || '');
                    const shortText = (title.textContent || '').split(' ')[0];
                    title.textContent = shortText;
                }

                this.container.setAttribute('data-iconified', 'true');

                // 右クリックメニュー用イベント
                this.container.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showIconContextMenu(e.clientX, e.clientY);
                };
            }

            restoreFromIconify() {
                const body = this.container.querySelector('.palette-body');
                const title = this.container.querySelector('.title');

                const originalWidth = this.container.getAttribute('data-original-width');
                const originalHeight = this.container.getAttribute('data-original-height');

                if (originalWidth !== null) this.container.style.width = originalWidth;
                if (originalHeight !== null) this.container.style.height = originalHeight;

                this.container.classList.remove('palette-iconified');
                if (body) body.style.display = '';

                if (title && title.getAttribute('data-original-text')) {
                    title.textContent = title.getAttribute('data-original-text');
                }

                this.container.removeAttribute('data-iconified');
                this.container.removeAttribute('data-original-width');
                this.container.removeAttribute('data-original-height');

                // 右クリックメニューイベント解除
                this.container.oncontextmenu = null;

                // 既に出ているメニューがあれば閉じる
                const existingMenu = document.getElementById('palette-iconify-menu');
                if (existingMenu) {
                    existingMenu.remove();
                }
            }

            restoreIconifyState() {
                const isIconified = this.container.getAttribute('data-iconified') === 'true';
                if (isIconified) {
                    this.applyIconify();
                }
            }

            showIconContextMenu(x, y) {
                // 既存のメニューを削除
                const oldMenu = document.getElementById('palette-iconify-menu');
                if (oldMenu) oldMenu.remove();

                const menu = document.createElement('div');
                menu.id = 'palette-iconify-menu';
                menu.style.position = 'fixed';
                menu.style.left = `${x}px`;
                menu.style.top = `${y}px`;
                menu.style.background = '#fff';
                menu.style.border = '1px solid #ccc';
                menu.style.borderRadius = '4px';
                menu.style.boxShadow = '2px 2px 6px rgba(0,0,0,0.2)';
                menu.style.zIndex = '5000';
                menu.style.fontSize = '12px';
                menu.style.cursor = 'default';

                const item = document.createElement('div');
                item.textContent = '復元';
                item.style.padding = '4px 12px';
                item.onclick = (e) => {
                    e.stopPropagation();
                    this.restoreFromIconify();
                    menu.remove();
                };
                item.onmouseenter = () => {
                    item.style.background = '#e8e8e8';
                };
                item.onmouseleave = () => {
                    item.style.background = 'transparent';
                };

                menu.appendChild(item);
                document.body.appendChild(menu);

                // どこかをクリックしたら閉じる
                const closeMenu = (ev) => {
                    if (ev.target !== menu && !menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu, true);
                    }
                };
                setTimeout(() => {
                    document.addEventListener('click', closeMenu, true);
                }, 0);
            }

            updateUserModeVisibility() {
                const userModeState = this.container.getAttribute('data-user-mode-visible') || 'U';
                if (!isEditMode) {
                    // ユーザーモードの場合
                    if (userModeState === 'E') {
                        // 'E'の場合は非表示
                        this.container.style.display = 'none';
                    } else {
                        // 'U'の場合は表示
                        this.container.style.display = '';
                    }
                } else {
                    // 編集モードの場合は常に表示
                    this.container.style.display = '';
                }
                // 子要素の表示状態を復元
                this.restoreChildVisibility();
            }

            restoreChildVisibility() {
                if (this.linkedChildId) {
                    const childElement = document.getElementById(this.linkedChildId);
                    if (childElement) {
                        // UserSystemAreaの場合は常に閉じた状態にする
                        if (this.id === 'UserSystemArea') {
                            childElement.style.display = 'none';
                            const toggleButton = this.container.querySelector('.toggle-button');
                            if (toggleButton) {
                                toggleButton.textContent = '+';
                            }
                            this.container.setAttribute('data-child-visible', 'false');
                            console.log(`UserSystemArea child forced to hidden for parent ID: ${this.id}`);
                            return;
                        }
                        
                        const childVisible = this.container.getAttribute('data-child-visible');
                        const toggleButton = this.container.querySelector('.toggle-button');
                        const currentDisplay = childElement.style.display || '';
                        console.log(`Restoring child visibility for parent ID: ${this.id}, child ID: ${this.linkedChildId}, saved state: ${childVisible}, current display: ${currentDisplay}`);
                        
                        if (childVisible !== null) {
                            // 保存された表示状態を復元
                            if (childVisible === 'true') {
                                childElement.style.display = 'block';
                                if (toggleButton) {
                                    toggleButton.textContent = '-';
                                }
                                console.log(`Restored child to visible for parent ID: ${this.id}`);
                            } else if (childVisible === 'false') {
                                childElement.style.display = 'none';
                                if (toggleButton) {
                                    toggleButton.textContent = '+';
                                }
                                console.log(`Restored child to hidden for parent ID: ${this.id}`);
                            }
                        } else {
                            // 属性が存在しない場合は、現在の表示状態を確認して保存
                            // displayが'none'でない場合は表示されているとみなす
                            const isVisible = currentDisplay !== 'none';
                            this.container.setAttribute('data-child-visible', isVisible ? 'true' : 'false');
                            if (toggleButton) {
                                toggleButton.textContent = isVisible ? '-' : '+';
                            }
                            // 現在の状態を維持
                            if (!isVisible) {
                                childElement.style.display = 'none';
                            } else if (currentDisplay === '') {
                                childElement.style.display = 'block';
                            }
                            console.log(`No saved state found, using current state for parent ID: ${this.id}, visible: ${isVisible}`);
                        }
                    } else {
                        console.warn(`Child element not found for parent ID: ${this.id}, child ID: ${this.linkedChildId}`);
                    }
                }
            }

            restoreUserModeToggleButton() {
                // E/Uトグルボタンの状態を復元
                const userModeToggleButton = this.container.querySelector('.user-mode-toggle-button');
                if (userModeToggleButton) {
                    const userModeState = this.container.getAttribute('data-user-mode-visible') || 'U';
                    userModeToggleButton.textContent = userModeState;
                    userModeToggleButton.title = userModeState === 'U' ? "ユーザーモードと編集モードの両方で表示" : "編集モードのみ表示";
                }
            }

            createChildComponent() {
                throw new Error('createChildComponent() must be implemented by subclasses');
            }

            getInputElement() {
                throw new Error('getInputElement() must be implemented by subclasses');
            }

            initializeResizable() {
                throw new Error('initializeResizable() must be implemented by subclasses');
            }

            serializeState() {
                throw new Error('serializeState() must be implemented by subclasses');
            }

            restoreState(state) {
                throw new Error('restoreState() must be implemented by subclasses');
            }

            static getConfigSelectors() {
                throw new Error('getConfigSelectors() must be implemented by subclasses');
            }

            static validateConfigInput(configInput, additionalInputs) {
                throw new Error('validateConfigInput() must be implemented by subclasses');
            }

            static createComponent(configInput, errorMessage, additionalInputs, pdfDataUrl = null) {
                throw new Error('createComponent() must be implemented by subclasses');
            }

            static createFromInput(configInput = null, errorMessage = null, pdfDataUrl = null) {
                const selectors = this.getConfigSelectors();
                let configInputVal = '';
                let errorMessageElement = null;
                let additionalInputs = {};

                if (selectors.configInput && selectors.errorMessage) {
                    const configElement = $(selectors.configInput);
                    const errorElement = $(selectors.errorMessage);
                    if (configElement.length && errorElement.length) {
                        configInputVal = configElement.val().trim();
                        errorMessageElement = errorElement;
                    }
                }

                if (selectors.additionalInputs) {
                    selectors.additionalInputs.forEach(input => {
                        const inputElement = $(input.selector);
                        if (inputElement.length) {
                            additionalInputs[input.id] = inputElement.val().trim();
                        }
                    });
                }

                if (configInputVal || pdfDataUrl) {
                    if (!this.validateConfigInput(configInputVal, additionalInputs)) {
                        if (errorMessageElement) errorMessageElement.show();
                        return;
                    } else {
                        if (errorMessageElement) errorMessageElement.hide();
                    }
                } else {
                    if (errorMessageElement) errorMessageElement.hide();
                }

                this.createComponent(configInputVal, errorMessageElement, additionalInputs, pdfDataUrl);

                if (selectors.clearFields) {
                    selectors.clearFields.forEach(field => {
                        $(field).val('');
                    });
                }
            }
        }

        // テキストエリアクラス
        class PaletteTextarea extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.init();
            }
            getComponentName() { return 'Textarea'; }
            getComponentType() { return 'textarea'; }
            createChildComponent() { return new PaletteTextarea(null, true); }
            createInputElement() {
                const textarea = document.createElement('textarea');
                return textarea;
            }
            getInputElement() {
                return this.container.querySelector('textarea');
            }
            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        const inputElement = this.getInputElement();
                        this.container.style.width = '200px';
                        this.container.style.height = '100px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 100,
                            minHeight: 50,
                            maxWidth: 800,
                            maxHeight: 500,
                            aspectRatio: false,
                            alsoResize: inputElement,
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            resize: (event, ui) => {
                                // リサイズ中にもキャンバスを復元（ちらつき防止）
                                restoreCanvasOnResize(this.container);
                            },
                            stop: () => {
                                console.log(`Resized textarea container ID: ${this.id}`);
                                restoreCanvasOnResizeStop(this.container);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }
            serializeState() {
                const textarea = this.getInputElement();
                const rect = this.container.getBoundingClientRect();
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    content: textarea.value
                };
            }
            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const textarea = this.getInputElement();
                if (textarea && state.hasOwnProperty('content')) {
                    textarea.value = state.content ?? '';
                }
            }
            static getConfigSelectors() {
                return {
                    configInput: '#textareaConfig',
                    errorMessage: '#textareaError',
                    clearFields: ['#textareaConfig']
                };
            }
            static validateConfigInput(configInput) {
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }
            static createComponent(configInput, errorMessage, additionalInputs) {
                // 追加情報が渡されていない場合は空オブジェクトにしておく
                if (!additionalInputs) {
                    additionalInputs = {};
                }
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteTextarea(null, false, customId, customClasses);
                console.log(`Created textarea with ID: ${customId || 'generated-id'}`);
            }
            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // 音声文字変換クラス
        class PaletteSpeechToText extends PaletteTextarea {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.recognition = null;
                this.micStream = null;
                this.isRecording = false;
                this.finalTranscript = '';
                this.networkErrorCount = 0;
            }
            getComponentName() { return 'SpeechToText'; }
            getComponentType() { return 'speech'; }
            createChildComponent() { return new PaletteTextarea(null, true); }

            createRecognition() {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) return null;

                const rec = new SpeechRecognition();
                rec.lang = 'ja-JP';
                rec.continuous = true;
                rec.interimResults = true;

                rec.onresult = (event) => {
                    const textarea = this.getInputElement();
                    if (!textarea) return;
                    let interimTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            this.finalTranscript += transcript;
                        } else {
                            interimTranscript += transcript;
                        }
                    }
                    textarea.value = this.finalTranscript + interimTranscript;
                    textarea.scrollTop = textarea.scrollHeight;
                    this.networkErrorCount = 0;
                };

                rec.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    if (event.error === 'not-allowed') {
                        alert('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
                        this.stopRecording();
                    } else if (event.error === 'network') {
                        this.networkErrorCount++;
                        console.warn('network error count:', this.networkErrorCount);
                        if (this.networkErrorCount >= 3) {
                            alert(
                                '音声認識サービスに接続できません。\n\n' +
                                '考えられる原因:\n' +
                                '  1. インターネット接続がない\n' +
                                '  2. Google の音声認識サーバーへの接続がブロックされている\n' +
                                '  3. file:// プロトコルで開いている\n\n' +
                                '対処法:\n' +
                                '  - インターネット接続を確認してください\n' +
                                '  - http://localhost 経由でページを開いてください\n' +
                                '  - ファイアウォールやプロキシの設定を確認してください'
                            );
                            this.stopRecording();
                        }
                    } else if (event.error === 'aborted') {
                        // ユーザーが停止した場合は何もしない
                    } else {
                        alert('音声認識エラー: ' + event.error);
                        this.stopRecording();
                    }
                };

                rec.onend = () => {
                    if (this.isRecording) {
                        setTimeout(() => {
                            if (this.isRecording) {
                                try {
                                    this.recognition = this.createRecognition();
                                    if (this.recognition) this.recognition.start();
                                } catch(e) { console.error('restart failed:', e); }
                            }
                        }, 300);
                    }
                };

                return rec;
            }

            async startRecording() {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    alert('このブラウザは音声認識に対応していません。Chrome または Edge をお使いください。');
                    return;
                }

                try {
                    if (this.micStream) {
                        this.micStream.getTracks().forEach(t => t.stop());
                    }
                    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    console.log('Microphone access granted, stream active:', this.micStream.active);
                } catch(err) {
                    console.error('getUserMedia failed:', err);
                    alert('マイクへのアクセスに失敗しました: ' + err.message);
                    return;
                }

                const textarea = this.getInputElement();
                if (textarea) {
                    this.finalTranscript = textarea.value;
                }
                this.isRecording = true;
                this.networkErrorCount = 0;

                if (this.recognition) {
                    try { this.recognition.stop(); } catch(e) {}
                }
                this.recognition = this.createRecognition();
                if (this.recognition) {
                    try {
                        this.recognition.start();
                        console.log('Speech recognition started');
                    } catch(e) {
                        console.error('recognition.start() failed:', e);
                    }
                }

                const recBtn = this.container.querySelector('.speech-record-btn');
                if (recBtn) recBtn.classList.add('recording');
            }

            stopRecording() {
                this.isRecording = false;
                if (this.recognition) {
                    try { this.recognition.stop(); } catch(e) {}
                    this.recognition = null;
                }
                if (this.micStream) {
                    this.micStream.getTracks().forEach(t => t.stop());
                    this.micStream = null;
                }
                const recBtn = this.container.querySelector('.speech-record-btn');
                if (recBtn) recBtn.classList.remove('recording');
            }

            createTitleBar() {
                const titleBar = super.createTitleBar();
                const buttonContainer = titleBar.querySelector('.buttons');
                if (!buttonContainer) return titleBar;

                const uButton = buttonContainer.querySelector('.user-mode-toggle-button');

                const recordBtn = document.createElement('button');
                recordBtn.textContent = '\u{1F3A4}';
                recordBtn.title = '録音';
                recordBtn.className = 'speech-record-btn';
                recordBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.startRecording();
                };

                const stopBtn = document.createElement('button');
                stopBtn.textContent = '\u25A0';
                stopBtn.title = '停止';
                stopBtn.className = 'speech-stop-btn';
                stopBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.stopRecording();
                };

                const copyBtn = document.createElement('button');
                copyBtn.textContent = '\u{1F4CB}';
                copyBtn.title = 'コピー';
                copyBtn.className = 'speech-copy-btn';
                copyBtn.onclick = (e) => {
                    e.stopPropagation();
                    const textarea = this.getInputElement();
                    if (textarea && textarea.value) {
                        navigator.clipboard.writeText(textarea.value).then(() => {
                            copyBtn.textContent = '\u2714';
                            setTimeout(() => { copyBtn.textContent = '\u{1F4CB}'; }, 1000);
                        }).catch(() => {
                            textarea.select();
                            document.execCommand('copy');
                        });
                    }
                };

                const clearBtn = document.createElement('button');
                clearBtn.textContent = '\u{1F5D1}';
                clearBtn.title = 'クリア';
                clearBtn.className = 'speech-clear-btn';
                clearBtn.onclick = (e) => {
                    e.stopPropagation();
                    const textarea = this.getInputElement();
                    if (textarea) {
                        textarea.value = '';
                        this.finalTranscript = '';
                    }
                };

                [recordBtn, stopBtn, copyBtn, clearBtn].forEach(btn => {
                    buttonContainer.insertBefore(btn, uButton);
                });

                return titleBar;
            }

            rebindButtons() {
                super.rebindButtons();
                const recBtn = this.container.querySelector('.speech-record-btn');
                if (recBtn) {
                    recBtn.onclick = (e) => { e.stopPropagation(); this.startRecording(); };
                }
                const stopBtn = this.container.querySelector('.speech-stop-btn');
                if (stopBtn) {
                    stopBtn.onclick = (e) => { e.stopPropagation(); this.stopRecording(); };
                }
                const copyBtn = this.container.querySelector('.speech-copy-btn');
                if (copyBtn) {
                    copyBtn.onclick = (e) => {
                        e.stopPropagation();
                        const textarea = this.getInputElement();
                        if (textarea && textarea.value) {
                            navigator.clipboard.writeText(textarea.value).then(() => {
                                copyBtn.textContent = '\u2714';
                                setTimeout(() => { copyBtn.textContent = '\u{1F4CB}'; }, 1000);
                            }).catch(() => {
                                textarea.select();
                                document.execCommand('copy');
                            });
                        }
                    };
                }
                const clearBtn = this.container.querySelector('.speech-clear-btn');
                if (clearBtn) {
                    clearBtn.onclick = (e) => {
                        e.stopPropagation();
                        const textarea = this.getInputElement();
                        if (textarea) { textarea.value = ''; this.finalTranscript = ''; }
                    };
                }
            }

            static getConfigSelectors() {
                return {
                    configInput: '#speechConfig',
                    errorMessage: '#speechError',
                    clearFields: ['#speechConfig']
                };
            }
            static validateConfigInput(configInput) {
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }
            static createComponent(configInput, errorMessage, additionalInputs) {
                if (!additionalInputs) { additionalInputs = {}; }
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteSpeechToText(null, false, customId, customClasses);
                console.log(`Created SpeechToText with ID: ${customId || 'generated-id'}`);
            }
            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // テキストボックスクラス
        class PaletteTextbox extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.init();
            }
            getComponentName() { return 'Textbox'; }
            getComponentType() { return 'textbox'; }
            createChildComponent() {
                return new PaletteTextarea(null, true);
            }
            createInputElement() {
                const textbox = document.createElement('input');
                textbox.type = 'text';
                return textbox;
            }
            getInputElement() {
                return this.container.querySelector('input[type="text"]');
            }
            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        const inputElement = this.getInputElement();
                        this.container.style.width = '200px';
                        this.container.style.height = '70px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 100,
                            minHeight: 50,
                            maxWidth: 600,
                            maxHeight: 150,
                            aspectRatio: false,
                            alsoResize: inputElement,
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            resize: (event, ui) => {
                                // リサイズ中にもキャンバスを復元（ちらつき防止）
                                restoreCanvasOnResize(this.container);
                            },
                            stop: () => {
                                console.log(`Resized textbox container ID: ${this.id}`);
                                restoreCanvasOnResizeStop(this.container);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }
            serializeState() {
                const textbox = this.getInputElement();
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    value: textbox.value
                };
            }
            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const textbox = this.getInputElement();
                if (state.value) {
                    textbox.value = state.value;
                }
            }
            static getConfigSelectors() {
                return {
                    configInput: '#textboxConfig',
                    errorMessage: '#textboxError',
                    clearFields: ['#textboxConfig']
                };
            }
            static validateConfigInput(configInput) {
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }
            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteTextbox(null, false, customId, customClasses);
                console.log(`Created textbox with ID: ${customId || 'generated-id'}`);
            }
            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // ボタンクラス
        class PaletteButton extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], buttonLabel = 'Button') {
                super(container, isChild, customId, customClasses);
                this.buttonLabel = buttonLabel || 'Button';
                this.init();
            }
            getComponentName() { return 'Button'; }
            getComponentType() { return 'button'; }
            createChildComponent() {
                return new PaletteTextarea(null, true);
            }
            createInputElement() {
                const button = document.createElement('input');
                button.type = 'button';
                button.value = this.buttonLabel;
                return button;
            }
            getInputElement() {
                return this.container.querySelector('input[type="button"]');
            }
            init() {
                super.init();
                // ボタンにクリックイベントを設定（子要素のコードを実行）
                this.setupButtonClick();
            }
            setupButtonClick() {
                // ボタンにクリックイベントを設定（子要素のコードを実行）
                if (!this.isChild) {
                    const button = this.getInputElement();
                    if (button) {
                        button.onclick = (e) => {
                            e.stopPropagation();
                            this.executeChildCode();
                        };
                    }
                }
            }
            rebindButtons() {
                super.rebindButtons();
                // ボタンのクリックイベントも再設定
                this.setupButtonClick();
            }
            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        const inputElement = this.getInputElement();
                        this.container.style.width = '150px';
                        this.container.style.height = '60px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 80,
                            minHeight: 40,
                            maxWidth: 400,
                            maxHeight: 100,
                            aspectRatio: false,
                            alsoResize: inputElement,
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            resize: (event, ui) => {
                                // リサイズ中にもキャンバスを復元（ちらつき防止）
                                restoreCanvasOnResize(this.container);
                            },
                            stop: () => {
                                console.log(`Resized button container ID: ${this.id}`);
                                restoreCanvasOnResizeStop(this.container);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }
            serializeState() {
                const button = this.getInputElement();
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    label: button.value
                };
            }
            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const button = this.getInputElement();
                if (state.label) {
                    button.value = state.label;
                }
            }
            static getConfigSelectors() {
                return {
                    configInput: '#buttonConfig',
                    errorMessage: '#buttonError',
                    additionalInputs: [
                        { id: 'buttonLabelConfig', selector: '#buttonLabelConfig' }
                    ],
                    clearFields: ['#buttonConfig', '#buttonLabelConfig']
                };
            }
            static validateConfigInput(configInput, additionalInputs) {
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }
            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                let buttonLabel = 'Button';
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (additionalInputs.buttonLabelConfig) {
                    buttonLabel = additionalInputs.buttonLabelConfig || 'Button';
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteButton(null, false, customId, customClasses, buttonLabel);
                console.log(`Created button with label "${buttonLabel}" and ID: ${customId || 'generated-id'}`);
            }
            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput, additionalInputs);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }

            /**
             * idname で指定した Button コンポーネントのラベルを設定するクラスメソッド。
             * @param {string} idname - Buttonコンポーネントのコンテナ要素のID
             * @param {string} label - 設定するラベル文字列
             */
            static setLabel(idname, label) {
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`PaletteButton.setLabel: Component with ID "${idname}" not found`);
                    return;
                }
                if (!element.classList.contains('palette-container')) {
                    console.warn(`PaletteButton.setLabel: Element with ID "${idname}" is not a palette component`);
                    return;
                }
                if (element.getAttribute('data-component-type') !== 'button') {
                    console.warn(`PaletteButton.setLabel: Component with ID "${idname}" is not a Button component`);
                    return;
                }

                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`PaletteButton.setLabel: Component instance not found for ID "${idname}"`);
                    return;
                }

                const button = instance.getInputElement ? instance.getInputElement() : element.querySelector('input[type="button"]');
                if (!button) {
                    console.warn(`PaletteButton.setLabel: Button element not found for ID "${idname}"`);
                    return;
                }

                const newLabel = (label !== null && label !== undefined) ? String(label) : '';
                button.value = newLabel;

                // serializeState / restoreState で使うため、インスタンス側のプロパティも更新しておく
                instance.buttonLabel = newLabel;

                console.log(`PaletteButton.setLabel: Set label for Button ID "${idname}" to "${newLabel}"`);
            }
        }

        // PDFコンポーネントクラス
        class PalettePDF extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], pdfDataUrl = null) {
                super(container, isChild, customId, customClasses);
                this.pdfDataUrl = pdfDataUrl;
                this.aspectRatio = null;
                this.scale = 2.0;
                this.pdf = null; // PDF.jsのPDFオブジェクト
                this.currentPage = 1; // 現在のページ番号
                this.totalPages = 0; // 総ページ数
                if (!container) {
                    this.container.style.width = '400px';
                    this.container.style.height = '500px';
                }
                this.init();
                if (pdfDataUrl) {
                    this.savePdfData(pdfDataUrl);
                }
            }
            savePdfData(pdfDataUrl) {
                let dataElement = this.container.querySelector('.pdf-data');
                if (!dataElement) {
                    dataElement = document.createElement('div');
                    dataElement.className = 'pdf-data';
                    dataElement.style.display = 'none';
                    this.container.appendChild(dataElement);
                }
                dataElement.textContent = pdfDataUrl;
                console.log('PDF data saved to element');
            }
            getPdfData() {
                const dataElement = this.container.querySelector('.pdf-data');
                return dataElement ? dataElement.textContent : null;
            }
            createInputElement() {
                const pdfContainer = document.createElement('div');
                pdfContainer.className = 'palette-pdf';
                
                // ページ送りコントロール
                const controls = document.createElement('div');
                controls.className = 'pdf-controls';
                controls.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 10px; padding: 5px; background-color: #f0f0f0; border-bottom: 1px solid #ccc;';
                
                // 前のページボタン
                const prevButton = document.createElement('button');
                prevButton.textContent = '◀ 前';
                prevButton.className = 'pdf-prev-button';
                prevButton.style.cssText = 'padding: 5px 10px; cursor: pointer; border: 1px solid #ccc; background-color: #fff; border-radius: 3px;';
                prevButton.onclick = (e) => {
                    e.stopPropagation();
                    this.goToPreviousPage();
                };
                controls.appendChild(prevButton);
                
                // ページ番号表示と入力
                const pageInfoContainer = document.createElement('div');
                pageInfoContainer.style.cssText = 'display: flex; align-items: center; gap: 5px;';
                
                const pageInfo = document.createElement('span');
                pageInfo.className = 'pdf-page-info';
                pageInfo.textContent = '1 / 1';
                pageInfo.style.cssText = 'font-size: 12px;';
                pageInfoContainer.appendChild(pageInfo);
                
                // ページ番号入力フィールド
                const pageInput = document.createElement('input');
                pageInput.type = 'number';
                pageInput.className = 'pdf-page-input';
                pageInput.min = '1';
                pageInput.value = '1';
                pageInput.style.cssText = 'width: 50px; padding: 2px 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; text-align: center;';
                pageInput.onchange = (e) => {
                    e.stopPropagation();
                    const pageNum = parseInt(pageInput.value);
                    if (pageNum >= 1 && pageNum <= this.totalPages) {
                        this.goToPage(pageNum);
                    } else {
                        pageInput.value = this.currentPage;
                    }
                };
                pageInput.onkeypress = (e) => {
                    if (e.key === 'Enter') {
                        e.stopPropagation();
                        const pageNum = parseInt(pageInput.value);
                        if (pageNum >= 1 && pageNum <= this.totalPages) {
                            this.goToPage(pageNum);
                        } else {
                            pageInput.value = this.currentPage;
                        }
                    }
                };
                pageInfoContainer.appendChild(pageInput);
                
                controls.appendChild(pageInfoContainer);
                
                // 次のページボタン
                const nextButton = document.createElement('button');
                nextButton.textContent = '次 ▶';
                nextButton.className = 'pdf-next-button';
                nextButton.style.cssText = 'padding: 5px 10px; cursor: pointer; border: 1px solid #ccc; background-color: #fff; border-radius: 3px;';
                nextButton.onclick = (e) => {
                    e.stopPropagation();
                    this.goToNextPage();
                };
                controls.appendChild(nextButton);
                
                pdfContainer.appendChild(controls);
                
                // キャンバスコンテナ
                const canvasContainer = document.createElement('div');
                canvasContainer.className = 'pdf-canvas-container';
                canvasContainer.style.cssText = 'flex: 1; overflow: auto;';
                const canvas = document.createElement('canvas');
                canvasContainer.appendChild(canvas);
                pdfContainer.appendChild(canvasContainer);
                
                return pdfContainer;
            }
            
            getPageInfoElement() {
                return this.getInputElement().querySelector('.pdf-page-info');
            }
            
            getPageInputElement() {
                return this.getInputElement().querySelector('.pdf-page-input');
            }
            
            getPrevButton() {
                return this.getInputElement().querySelector('.pdf-prev-button');
            }
            
            getNextButton() {
                return this.getInputElement().querySelector('.pdf-next-button');
            }
            
            updatePageControls() {
                const pageInfo = this.getPageInfoElement();
                const pageInput = this.getPageInputElement();
                const prevButton = this.getPrevButton();
                const nextButton = this.getNextButton();
                
                if (pageInfo) {
                    pageInfo.textContent = `${this.currentPage} / ${this.totalPages}`;
                }
                
                if (pageInput) {
                    pageInput.value = this.currentPage;
                    pageInput.max = this.totalPages;
                }
                
                if (prevButton) {
                    prevButton.disabled = this.currentPage <= 1;
                    prevButton.style.opacity = this.currentPage <= 1 ? '0.5' : '1';
                    prevButton.style.cursor = this.currentPage <= 1 ? 'not-allowed' : 'pointer';
                }
                
                if (nextButton) {
                    nextButton.disabled = this.currentPage >= this.totalPages;
                    nextButton.style.opacity = this.currentPage >= this.totalPages ? '0.5' : '1';
                    nextButton.style.cursor = this.currentPage >= this.totalPages ? 'not-allowed' : 'pointer';
                }
            }
            
            async goToPage(pageNumber) {
                if (!this.pdf || pageNumber < 1 || pageNumber > this.totalPages) {
                    return;
                }
                
                try {
                    const page = await this.pdf.getPage(pageNumber);
                    const pdfContainer = this.getInputElement();
                    const canvas = pdfContainer.querySelector('canvas');
                    const context = canvas.getContext('2d');
                    const viewport = page.getViewport({ scale: this.scale });
                    this.aspectRatio = viewport.width / viewport.height;
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };
                    await page.render(renderContext);
                    this.currentPage = pageNumber;
                    this.updatePageControls();
                    console.log(`Rendered PDF page ${pageNumber} of ${this.totalPages}`);
                } catch (error) {
                    console.error('Error rendering PDF page:', error);
                }
            }
            
            async goToNextPage() {
                if (this.currentPage < this.totalPages) {
                    await this.goToPage(this.currentPage + 1);
                }
            }
            
            async goToPreviousPage() {
                if (this.currentPage > 1) {
                    await this.goToPage(this.currentPage - 1);
                }
            }
            serializeState() {
                console.log(`Serializing PDF state for component ID: ${this.id}`);
                const pdfData = this.getPdfData();
                const state = {
                    type: 'pdf',
                    id: this.id,
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    aspectRatio: this.aspectRatio,
                    pdfDataUrl: pdfData
                };
                console.log('PDF Data exists:', !!state.pdfDataUrl);
                return state;
            }
            async restoreState(state) {
                console.log(`Restoring PDF state for component ID: ${this.id}`);
                this.container.style.left = state.left;
                this.container.style.top = state.top;
                this.container.style.width = state.width;
                this.container.style.height = state.height;
                this.aspectRatio = state.aspectRatio;
                console.log('Container structure:', this.container.innerHTML);
                const existingPdfData = this.getPdfData();
                if (existingPdfData) {
                    console.log('Found existing PDF data in DOM');
                    try {
                        await this.loadPDF(existingPdfData);
                        // 保存されたページ番号を復元
                        if (state.currentPage && state.currentPage > 0) {
                            await this.goToPage(state.currentPage);
                        }
                        console.log('PDF restored from existing data');
                        return;
                    } catch (error) {
                        console.error('Error loading existing PDF:', error);
                    }
                }
                if (state.pdfDataUrl) {
                    console.log('Found PDF Data in state, attempting to restore...');
                    this.pdfDataUrl = state.pdfDataUrl;
                    this.savePdfData(state.pdfDataUrl);
                    try {
                        await this.loadPDF(state.pdfDataUrl);
                        // 保存されたページ番号を復元
                        if (state.currentPage && state.currentPage > 0) {
                            await this.goToPage(state.currentPage);
                        }
                        console.log('PDF restored successfully from state');
                    } catch (error) {
                        console.error('Error restoring PDF:', error);
                    }
                } else {
                    console.warn('No PDF Data URL found in restored state');
                }
            }
            async loadPDF(pdfDataUrl) {
                console.log('Starting PDF load...');
                try {
                    const loadingTask = pdfjsLib.getDocument(pdfDataUrl);
                    this.pdf = await loadingTask.promise;
                    this.totalPages = this.pdf.numPages;
                    this.currentPage = 1;
                    console.log(`PDF document loaded, total pages: ${this.totalPages}`);
                    
                    // 最初のページを表示（aspectRatioが計算される）
                    await this.goToPage(1);
                    
                    // コンテナのサイズが初期値（400px x 500px）の場合、PDFの縦横比に合わせて調整
                    const currentWidth = parseInt(this.container.style.width) || parseInt(window.getComputedStyle(this.container).width);
                    const currentHeight = parseInt(this.container.style.height) || parseInt(window.getComputedStyle(this.container).height);
                    const isInitialSize = (currentWidth === 400 && currentHeight === 500) || 
                                         (!this.container.style.width && !this.container.style.height);
                    
                    if (isInitialSize && this.aspectRatio) {
                        // PDFの縦横比に合わせてコンテナのサイズを調整
                        // 幅を基準にして高さを計算（タイトルバーとコントロールバーの高さを考慮）
                        const baseWidth = 600; // 基準となる幅
                        const titleBarHeight = 30; // タイトルバーの高さ（概算）
                        const pdfContainer = this.getInputElement();
                        const controls = pdfContainer ? pdfContainer.querySelector('.pdf-controls') : null;
                        const controlBarHeight = controls ? parseInt(window.getComputedStyle(controls).height) || 40 : 40;
                        // PDFキャンバス部分の高さを計算
                        const canvasHeight = baseWidth / this.aspectRatio;
                        // 全体の高さ = タイトルバー + コントロールバー + キャンバス部分
                        const calculatedHeight = titleBarHeight + controlBarHeight + canvasHeight;
                        this.container.style.width = baseWidth + 'px';
                        this.container.style.height = calculatedHeight + 'px';
                        console.log(`Adjusted container size to match PDF aspect ratio: ${baseWidth}x${calculatedHeight} (aspectRatio: ${this.aspectRatio})`);
                    }
                    
                    const pdfContainer = this.getInputElement();
                    const canvas = pdfContainer.querySelector('canvas');
                    canvas.style.width = '100%';
                    canvas.style.height = '100%';
                    this.initializeResizable();
                } catch (error) {
                    console.error('Error in loadPDF:', error);
                    throw error;
                }
            }
            static createComponent(configInput, errorMessage, additionalInputs, pdfDataUrl) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) customId = match[1];
                        if (match[2]) customClasses.push(match[2]);
                        if (match[3]) customClasses.push(match[3]);
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                const component = new PalettePDF(null, false, customId, customClasses, pdfDataUrl);
                if (pdfDataUrl) {
                    component.loadPDF(pdfDataUrl).catch(error => {
                        console.error('Error loading PDF in createComponent:', error);
                    });
                }
                console.log(`Created PDF viewer with ID: ${customId || 'generated-id'}`);
                return component;
            }
            getComponentName() { return 'PDF'; }
            getComponentType() { return 'pdf'; }
            
            createChildComponent() {
                // もともと return null; だったところを、テキストエリアを返すよう修正
                return new PaletteTextarea(null, true);
            }
//            createChildComponent() { return null; }

            getInputElement() {
                return this.container.querySelector('.palette-pdf');
            }
            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 200,
                            minHeight: 200 / (this.aspectRatio || 1),
                            // maxWidthとmaxHeightを削除して拡大制限を外す
                            aspectRatio: true,
                            resize: (event, ui) => {
                                ui.size.height = ui.size.width / (this.aspectRatio || 1);
                                const canvas = this.getInputElement().querySelector('canvas');
                                if (canvas) {
                                    canvas.style.width = '100%';
                                    canvas.style.height = '100%';
                                }
                                // リサイズ中にもペイントキャンバスを復元（ちらつき防止）
                                restoreCanvasOnResize(this.container);
                            },
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            stop: () => {
                                console.log(`Resized PDF container ID: ${this.id}`);
                                restoreCanvasOnResizeStop(this.container);
                            }
                        });
                    } else {
                        $(this.container).resizable('enable');
                        $(this.container).resizable('option', {
                            aspectRatio: true,
                            minHeight: 200 / (this.aspectRatio || 1)
                            // maxHeightを削除
                        });
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                    }
                }
            }
            static getConfigSelectors() {
                return {
                    configInput: '#pdfConfig',
                    errorMessage: '#pdfError',
                    clearFields: ['#pdfConfig']
                };
            }
            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                const match = configInput.match(regex);
                if (!match) return false;
                if (match[1] && isIdDuplicate(match[1])) {
                    return 'duplicate';
                }
                return true;
            }
            static createFromInput(configInput, errorMessage, additionalInputs, pdfDataUrl) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs, pdfDataUrl);
            }
        }

        // Figureコンポーネント（画像読み込み）
        class PaletteFigure extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], imageDataUrl = null) {
                super(container, isChild, customId, customClasses);
                this.imageDataUrl = imageDataUrl;
                this.aspectRatio = null;
                if (!container) {
                    this.container.style.width = '400px';
                    this.container.style.height = '300px';
                }
                this.init();
                if (imageDataUrl) {
                    this.saveImageData(imageDataUrl);
                    setTimeout(() => {
                        this.loadImage(imageDataUrl).catch(error => {
                            console.error('Error loading image:', error);
                        });
                    }, 0);
                }
            }
            
            createChildComponent() {
                return new PaletteTextarea(null, true);
            }
            
            saveImageData(imageDataUrl) {
                let dataElement = this.container.querySelector('.figure-data');
                if (!dataElement) {
                    dataElement = document.createElement('div');
                    dataElement.className = 'figure-data';
                    dataElement.style.display = 'none';
                    this.container.appendChild(dataElement);
                }
                dataElement.textContent = imageDataUrl;
                console.log('Image data saved to element');
            }
            getImageData() {
                const dataElement = this.container.querySelector('.figure-data');
                return dataElement ? dataElement.textContent : null;
            }
            createInputElement() {
                const figureContainer = document.createElement('div');
                figureContainer.className = 'palette-figure';
                const img = document.createElement('img');
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                figureContainer.appendChild(img);
                return figureContainer;
            }
            getComponentName() { return 'Figure'; }
            getComponentType() { return 'figure'; }
            serializeState() {
                console.log(`Serializing Figure state for component ID: ${this.id}`);
                const imageData = this.getImageData();
                const state = {
                    type: 'figure',
                    id: this.id,
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    aspectRatio: this.aspectRatio,
                    imageDataUrl: imageData
                };
                console.log('Image Data exists:', !!state.imageDataUrl);
                return state;
            }
            async restoreState(state) {
                console.log(`Restoring Figure state for component ID: ${this.id}`);
                this.container.style.left = state.left;
                this.container.style.top = state.top;
                this.container.style.width = state.width;
                this.container.style.height = state.height;
                this.aspectRatio = state.aspectRatio;
                const existingImageData = this.getImageData();
                if (existingImageData) {
                    console.log('Found existing image data in DOM');
                    try {
                        await this.loadImage(existingImageData);
                        setTimeout(() => {
                            this.initializeResizable();
                            console.log('Resizable reinitialized after image load');
                        }, 100);
                        console.log('Image restored from existing data');
                        return;
                    } catch (error) {
                        console.error('Error loading existing image:', error);
                    }
                }
                if (state.imageDataUrl) {
                    console.log('Found Image Data in state, attempting to restore...');
                    this.imageDataUrl = state.imageDataUrl;
                    this.saveImageData(state.imageDataUrl);
                    try {
                        await this.loadImage(state.imageDataUrl);
                        setTimeout(() => {
                            this.initializeResizable();
                            console.log('Resizable reinitialized after image load');
                        }, 100);
                        console.log('Image restored successfully from state');
                    } catch (error) {
                        console.error('Error restoring image:', error);
                    }
                } else {
                    console.warn('No Image Data URL found in restored state');
                }
            }
            async loadImage(imageDataUrl) {
                console.log('Loading image...');
                return new Promise((resolve, reject) => {
                    const container = this.container.querySelector('.palette-body .palette-figure');
                    if (!container) {
                        console.error('Figure container not found');
                        reject(new Error('Figure container not found'));
                        return;
                    }
                    const img = container.querySelector('img');
                    if (!img) {
                        console.error('Image element not found');
                        reject(new Error('Image element not found'));
                        return;
                    }
                    img.onload = () => {
                        console.log('Image loaded successfully');
                        this.aspectRatio = img.naturalWidth / img.naturalHeight;
                        resolve();
                    };
                    img.onerror = (error) => {
                        console.error('Error loading image:', error);
                        reject(error);
                    };
                    console.log('Setting image source...');
                    img.src = imageDataUrl;
                });
            }
            initializeResizable() {
                console.log('Initializing resizable for figure component...');
                if (this.isChild) return;
                try {
                    if ($(this.container).data('ui-resizable')) {
                        console.log('Destroying existing resizable...');
                        $(this.container).resizable('destroy');
                    }
                    console.log('Setting up new resizable...');
                    $(this.container).resizable({
                        aspectRatio: this.aspectRatio || true,
                        minWidth: 100,
                        minHeight: 100,
                        maxWidth: 800,
                        maxHeight: 800,
                        handles: 'se',
                        start: (event, ui) => {
                            console.log('Resize started');
                            protectCanvasOnResizeStart(this.container);
                        },
                        resize: (event, ui) => {
                            console.log('Resizing...', ui.size);
                            // リサイズ中にもキャンバスを復元（ちらつき防止）
                            restoreCanvasOnResize(this.container);
                        },
                        stop: (event, ui) => {
                            console.log('Resize completed', ui.size);
                            restoreCanvasOnResizeStop(this.container);
                        }
                    });
                    console.log('Resizable initialized with aspect ratio:', this.aspectRatio);
                } catch (error) {
                    console.error('Error initializing resizable:', error);
                }
            }
            static getConfigSelectors() {
                return {
                    configInput: '#figureConfig',
                    errorMessage: '#figureError'
                };
            }
            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }
            static createComponent(configInput, errorMessage, additionalInputs, imageDataUrl) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) customId = match[1];
                        if (match[2]) customClasses.push(match[2]);
                        if (match[3]) customClasses.push(match[3]);
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                const component = new PaletteFigure(null, false, customId, customClasses, imageDataUrl);
                console.log(`Created Figure viewer with ID: ${customId || 'generated-id'}`);
                return component;
            }
        }

        // iframeクラスの定義
        class PaletteIframe extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], url = '', refreshSeconds = '') {
                super(container, isChild, customId, customClasses);
                this.url = url;
                this.refreshSeconds = this.normalizeRefreshSeconds(refreshSeconds);
                this.refreshTimer = null;
                this.init();
                // ズーム状態を復元
                const savedZoom = this.container.getAttribute('data-iframe-zoom');
                if (savedZoom) {
                    const zoomValue = parseInt(savedZoom, 10);
                    if (!isNaN(zoomValue)) {
                        this.applyIframeZoom(zoomValue);
                    }
                }
                if (url) {
                    this.setUrl(url);
                }
                this.updateAutoRefresh();
            }

            getComponentName() { return 'Iframe'; }
            getComponentType() { return 'iframe'; }
            
            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            /**
             * タイトルバーのスライダーから呼ばれるズーム適用処理
             * @param {number} zoomPercent - 50〜200程度の拡大率（%）
             */
            applyIframeZoom(zoomPercent) {
                const iframe = this.getInputElement();
                if (!iframe) return;
                const percent = parseInt(zoomPercent, 10);
                const safePercent = (!isNaN(percent) && percent > 0) ? percent : 100;
                const scale = safePercent / 100;

                if (scale === 1) {
                    iframe.style.transform = '';
                    iframe.style.transformOrigin = '';
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                } else {
                    iframe.style.transform = `scale(${scale})`;
                    iframe.style.transformOrigin = 'top left';
                    iframe.style.width = (100 / scale) + '%';
                    iframe.style.height = (100 / scale) + '%';
                }
            }

            createInputElement() {
                const iframe = document.createElement('iframe');
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.border = 'none';
                return iframe;
            }

            getInputElement() {
                return this.container.querySelector('iframe');
            }

            setUrl(url) {
                const iframe = this.getInputElement();
                if (iframe) {
                    iframe.src = url;
                }
                // 元のURLを保持（file://に変換されないように）
                this.url = url;
                this.updateAutoRefresh();
            }

            setRefreshSeconds(refreshSeconds) {
                this.refreshSeconds = this.normalizeRefreshSeconds(refreshSeconds);
                this.updateAutoRefresh();
            }

            normalizeRefreshSeconds(refreshSeconds) {
                if (refreshSeconds === '' || refreshSeconds == null) return '';
                const seconds = Number(refreshSeconds);
                if (!Number.isInteger(seconds) || seconds <= 0) return '';
                return String(seconds);
            }

            getRefreshIntervalMs() {
                const seconds = Number(this.refreshSeconds);
                if (!Number.isInteger(seconds) || seconds <= 0) return null;
                return seconds * 1000;
            }

            refreshIframe() {
                const iframe = this.getInputElement();
                if (!iframe || !this.url) return;
                iframe.src = this.url;
            }

            updateAutoRefresh() {
                if (this.refreshTimer) {
                    clearInterval(this.refreshTimer);
                    this.refreshTimer = null;
                }
                const intervalMs = this.getRefreshIntervalMs();
                if (!intervalMs || !this.url) return;
                this.refreshTimer = setInterval(() => {
                    this.refreshIframe();
                }, intervalMs);
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '400px';
                        this.container.style.height = '400px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 200,
                            minHeight: 200,
                            aspectRatio: false,
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            resize: (event, ui) => {
                                restoreCanvasOnResize(this.container);
                            },
                            stop: () => {
                                console.log(`Resized iframe container ID: ${this.id}`);
                                restoreCanvasOnResizeStop(this.container);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                // 元のURL（this.url）を優先的に使用
                // これにより、ファイル名のみ（test.html）の場合はそのまま保持される
                // file://に変換されることを防ぐ
                const urlToSave = this.url || (this.getInputElement() ? this.getInputElement().src : '');
                
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    url: urlToSave,
                    refreshSeconds: this.refreshSeconds
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                this.refreshSeconds = this.normalizeRefreshSeconds(state.refreshSeconds);
                if (state.url) {
                    this.setUrl(state.url);
                }
            }

            static getConfigSelectors() {
                return {
                    configInput: '#iframeConfig',
                    errorMessage: '#iframeError',
                    additionalInputs: [
                        { id: 'iframeUrlConfig', selector: '#iframeUrlConfig' },
                        { id: 'iframeRefreshSecondsConfig', selector: '#iframeRefreshSecondsConfig' }
                    ],
                    clearFields: ['#iframeConfig', '#iframeUrlConfig', '#iframeRefreshSecondsConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;  // 空欄の場合もOKとする
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                let url = '';
                let refreshSeconds = '';

                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }

                if (additionalInputs.iframeUrlConfig) {
                    url = additionalInputs.iframeUrlConfig;
                }
                if (additionalInputs.iframeRefreshSecondsConfig) {
                    refreshSeconds = additionalInputs.iframeRefreshSecondsConfig;
                }

                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }

                new PaletteIframe(null, false, customId, customClasses, url, refreshSeconds);
                console.log(`Created iframe with URL "${url}" and ID: ${customId || 'generated-id'}`);
            }

            /**
             * 指定したidのiframeコンポーネントのサイズをブラウザ画面の指定パーセンテージに設定するクラスメソッド
             * @param {string} idname - iframeコンポーネントのID
             * @param {number} wratio - ブラウザ画面全体の横幅に対する割合（整数、パーセンテージ）
             * @param {number} hratio - ブラウザ画面全体の縦幅に対する割合（整数、パーセンテージ）
             */
            static setRatio(idname, wratio, hratio) {
                const container = document.getElementById(idname);
                if (!container) {
                    console.warn(`PaletteIframe.setRatio: ID "${idname}" のコンポーネントが見つかりません。`);
                    return;
                }

                // コンポーネントタイプがiframeか確認
                const componentType = container.getAttribute('data-component-type');
                if (componentType !== 'iframe') {
                    console.warn(`PaletteIframe.setRatio: ID "${idname}" はiframeコンポーネントではありません。`);
                    return;
                }

                // wratioとhratioが有効な数値か確認
                const wratioValue = parseInt(wratio);
                const hratioValue = parseInt(hratio);
                if (isNaN(wratioValue) || isNaN(hratioValue) || wratioValue <= 0 || hratioValue <= 0) {
                    console.warn(`PaletteIframe.setRatio: 無効な値が指定されました。wratio=${wratio}, hratio=${hratio}`);
                    return;
                }

                // 既にsetRatioが適用されていない場合、元の状態を保存
                if (container.getAttribute('data-ratio-applied') !== 'true') {
                    const originalLeft = container.style.left || '';
                    const originalTop = container.style.top || '';
                    const originalWidth = container.style.width || '';
                    const originalHeight = container.style.height || '';
                    const originalPosition = container.style.position || '';
                    const originalZIndex = container.style.zIndex || '';
                    // pointer-eventsは変更しないので保存不要

                    container.setAttribute('data-original-left', originalLeft);
                    container.setAttribute('data-original-top', originalTop);
                    container.setAttribute('data-original-width', originalWidth);
                    container.setAttribute('data-original-height', originalHeight);
                    container.setAttribute('data-original-position', originalPosition);
                    container.setAttribute('data-original-z-index', originalZIndex);
                }

                // iframe要素を取得
                const iframe = container.querySelector('iframe');
                if (!iframe) {
                    console.warn(`PaletteIframe.setRatio: ID "${idname}" のiframe要素が見つかりません。`);
                    return;
                }

                // iframe要素の元のpointer-eventsを保存
                if (container.getAttribute('data-ratio-applied') !== 'true') {
                    const originalIframePointerEvents = iframe.style.pointerEvents || '';
                    container.setAttribute('data-original-iframe-pointer-events', originalIframePointerEvents);
                }

                // ブラウザのサイズを取得
                const browserWidth = window.innerWidth;
                const browserHeight = window.innerHeight;

                // コンテナのサイズを設定
                container.style.width = (browserWidth * wratioValue / 100) + 'px';
                container.style.height = (browserHeight * hratioValue / 100) + 'px';
                container.style.position = 'fixed';

                // 位置を設定
                // wratioが100でない場合、左詰め（右側に余白）
                if (wratioValue === 100) {
                    container.style.left = '0';
                } else {
                    container.style.left = '0';
                }

                // hratioが100でない場合、下詰め（上側に余白）
                if (hratioValue === 100) {
                    container.style.bottom = '0';
                    container.style.top = '';
                } else {
                    container.style.bottom = '0';
                    container.style.top = '';
                }

                // z-indexは設定しない（元の値を保持）
                // これにより、新しく生成したコンポーネントが上に来るようになる
                // 元のz-indexが空の場合は、デフォルトのz-index（通常はauto）が適用される
                
                // コンテナはpointer-eventsを変更しない（デフォルトのautoのまま）
                // これにより、コンテナの上に別のコンポーネントを置いたときに、そのコンポーネントがクリック可能になる
                
                // タイトルバー（.palette-top）はデフォルトでクリック可能（pointer-events: auto）
                
                // iframe要素自体にはpointer-events: autoを設定して、iframeのコンテンツはクリック可能にする
                iframe.style.pointerEvents = 'auto';
                
                container.setAttribute('data-ratio-applied', 'true');
                container.setAttribute('data-ratio-w', wratioValue.toString());
                container.setAttribute('data-ratio-h', hratioValue.toString());

                console.log(`PaletteIframe.setRatio: ID "${idname}" のサイズを設定しました。wratio=${wratioValue}%, hratio=${hratioValue}%`);
            }

            /**
             * 指定したidのiframeコンポーネントのsetRatio設定を解除して元のサイズに戻すクラスメソッド
             * @param {string} idname - iframeコンポーネントのID
             */
            static unsetRatio(idname) {
                const container = document.getElementById(idname);
                if (!container) {
                    console.warn(`PaletteIframe.unsetRatio: ID "${idname}" のコンポーネントが見つかりません。`);
                    return;
                }

                // コンポーネントタイプがiframeか確認
                const componentType = container.getAttribute('data-component-type');
                if (componentType !== 'iframe') {
                    console.warn(`PaletteIframe.unsetRatio: ID "${idname}" はiframeコンポーネントではありません。`);
                    return;
                }

                // setRatioが適用されていない場合は何もしない
                if (container.getAttribute('data-ratio-applied') !== 'true') {
                    console.log(`PaletteIframe.unsetRatio: ID "${idname}" はsetRatioが適用されていません。`);
                    return;
                }

                // iframe要素を取得
                const iframe = container.querySelector('iframe');
                const titleBar = container.querySelector('.palette-top');

                // 保存された元のサイズと位置を復元
                const originalLeft = container.getAttribute('data-original-left');
                const originalTop = container.getAttribute('data-original-top');
                const originalWidth = container.getAttribute('data-original-width');
                const originalHeight = container.getAttribute('data-original-height');
                const originalPosition = container.getAttribute('data-original-position');
                const originalZIndex = container.getAttribute('data-original-z-index');
                const originalIframePointerEvents = container.getAttribute('data-original-iframe-pointer-events');

                if (originalLeft !== null) container.style.left = originalLeft;
                if (originalTop !== null) container.style.top = originalTop;
                if (originalWidth !== null) container.style.width = originalWidth;
                if (originalHeight !== null) container.style.height = originalHeight;
                if (originalPosition !== null) container.style.position = originalPosition;
                if (originalZIndex !== null) container.style.zIndex = originalZIndex;
                // pointer-eventsは変更していないので復元不要
                if (iframe && originalIframePointerEvents !== null) iframe.style.pointerEvents = originalIframePointerEvents;

                // フラグと属性を削除
                container.removeAttribute('data-ratio-applied');
                container.removeAttribute('data-ratio-w');
                container.removeAttribute('data-ratio-h');
                container.removeAttribute('data-original-left');
                container.removeAttribute('data-original-top');
                container.removeAttribute('data-original-width');
                container.removeAttribute('data-original-height');
                container.removeAttribute('data-original-position');
                container.removeAttribute('data-original-z-index');
                container.removeAttribute('data-original-iframe-pointer-events');

                console.log(`PaletteIframe.unsetRatio: ID "${idname}" のsetRatio設定を解除しました。`);
            }

            /**
             * 指定したidのiframeコンポーネントを指定された横幅に合わせてZoomするクラスメソッド
             * @param {string} idname - iframeコンポーネントのID
             * @param {number} wzoom - iframeタグの横幅（整数、ピクセル）
             */
            static setZoomWidth(idname, wzoom) {
                const container = document.getElementById(idname);
                if (!container) {
                    console.warn(`PaletteIframe.setZoomWidth: ID "${idname}" のコンポーネントが見つかりません。`);
                    return;
                }

                // コンポーネントタイプがiframeか確認
                const componentType = container.getAttribute('data-component-type');
                if (componentType !== 'iframe') {
                    console.warn(`PaletteIframe.setZoomWidth: ID "${idname}" はiframeコンポーネントではありません。`);
                    return;
                }

                // wzoomが有効な数値か確認
                const wzoomValue = parseInt(wzoom);
                if (isNaN(wzoomValue) || wzoomValue <= 0) {
                    console.warn(`PaletteIframe.setZoomWidth: 無効なwzoom値 "${wzoom}" が指定されました。`);
                    return;
                }

                // iframe要素を取得
                const iframe = container.querySelector('iframe');
                if (!iframe) {
                    console.warn(`PaletteIframe.setZoomWidth: ID "${idname}" のiframe要素が見つかりません。`);
                    return;
                }

                // 既にsetZoomWidthが適用されていない場合、元の状態を保存
                if (container.getAttribute('data-zoom-applied') !== 'true') {
                    const originalIframeTransform = iframe.style.transform || '';
                    const originalIframeTransformOrigin = iframe.style.transformOrigin || '';
                    const originalIframeWidth = iframe.style.width || '';
                    const originalIframeHeight = iframe.style.height || '';

                    container.setAttribute('data-original-iframe-transform', originalIframeTransform);
                    container.setAttribute('data-original-iframe-transform-origin', originalIframeTransformOrigin);
                    container.setAttribute('data-original-iframe-width', originalIframeWidth);
                    container.setAttribute('data-original-iframe-height', originalIframeHeight);
                }

                // 1. コンテナ（divタグ）のwidthをw1とする
                const w1 = container.offsetWidth || parseInt(container.style.width) || window.innerWidth;

                // 2. iframeタグのwidthをw2とする（wzoomValueを設定）
                const w2 = wzoomValue;
                iframe.style.width = w2 + 'px';

                // 3. transform: scale(w1/w2) を設定
                const scale = w1 / w2;
                iframe.style.transform = `scale(${scale})`;
                iframe.style.transformOrigin = 'top left';

                // 高さもscaleに応じて補正（視覚的にコンテナいっぱいに表示されるようにする）
                iframe.style.height = (100 / scale) + '%';

                container.setAttribute('data-zoom-applied', 'true');
                container.setAttribute('data-zoom-width', w2.toString());

                console.log(`PaletteIframe.setZoomWidth: ID "${idname}" をZoomしました。w1=${w1}, w2=${w2}, scale=${scale.toFixed(4)}`);
            }

            /**
             * 指定したidのiframeコンポーネント内のiframe要素のheightを割合（%）で設定するクラスメソッド
             * @param {string} idname - iframeコンポーネントのID
             * @param {number} ratio - iframeタグのheightに設定する割合（パーセンテージ）
             */
            static setHeightRatio(idname, ratio) {
                const container = document.getElementById(idname);
                if (!container) {
                    console.warn(`PaletteIframe.setHeightRatio: ID "${idname}" のコンポーネントが見つかりません。`);
                    return;
                }

                // コンポーネントタイプがiframeか確認
                const componentType = container.getAttribute('data-component-type');
                if (componentType !== 'iframe') {
                    console.warn(`PaletteIframe.setHeightRatio: ID "${idname}" はiframeコンポーネントではありません。`);
                    return;
                }

                // ratioが有効な数値か確認
                const ratioValue = parseInt(ratio);
                if (isNaN(ratioValue) || ratioValue <= 0) {
                    console.warn(`PaletteIframe.setHeightRatio: 無効なratio値 "${ratio}" が指定されました。`);
                    return;
                }

                // iframe要素を取得
                const iframe = container.querySelector('iframe');
                if (!iframe) {
                    console.warn(`PaletteIframe.setHeightRatio: ID "${idname}" のiframe要素が見つかりません。`);
                    return;
                }

                // iframeのheightをratio%で設定
                iframe.style.height = ratioValue + '%';

                console.log(`PaletteIframe.setHeightRatio: ID "${idname}" のiframe高さを ratio=${ratioValue}% に設定しました。`);
            }
        }

        // 表計算コンポーネントクラス（jspreadsheet CE使用）
        class PaletteSpreadsheet extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.spreadsheet = null; // jspreadsheetインスタンス
                this.spreadsheetId = `spreadsheet-${this.id}`;
                this.init();
            }

            getComponentName() { return '表計算'; }
            getComponentType() { return 'spreadsheet'; }

            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const spreadsheetContainer = document.createElement('div');
                spreadsheetContainer.className = 'palette-spreadsheet';
                
                // コントロールボタンエリア
                const controlsArea = document.createElement('div');
                controlsArea.className = 'spreadsheet-controls';
                
                // xlsxファイル読み込みボタン
                const loadBtn = document.createElement('button');
                loadBtn.textContent = 'xlsx読み込み';
                loadBtn.className = 'spreadsheet-btn';
                loadBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.loadXlsx();
                };
                controlsArea.appendChild(loadBtn);
                
                // xlsxファイル書き出しボタン
                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'xlsx書き出し';
                saveBtn.className = 'spreadsheet-btn';
                saveBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.saveXlsx();
                };
                controlsArea.appendChild(saveBtn);
                
                spreadsheetContainer.appendChild(controlsArea);
                
                // スプレッドシート表示エリア
                const spreadsheetArea = document.createElement('div');
                spreadsheetArea.id = this.spreadsheetId;
                spreadsheetArea.className = 'spreadsheet-area';
                spreadsheetContainer.appendChild(spreadsheetArea);
                
                // 隠しファイル入力フィールド
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.xlsx,.xls';
                fileInput.style.display = 'none';
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.handleFileLoad(file);
                    }
                    e.target.value = '';
                };
                spreadsheetContainer.appendChild(fileInput);
                this.fileInput = fileInput;
                
                return spreadsheetContainer;
            }

            getInputElement() {
                return this.container.querySelector('.palette-spreadsheet');
            }

            getSpreadsheetArea() {
                return document.getElementById(this.spreadsheetId);
            }

            initializeSpreadsheet() {
                const area = this.getSpreadsheetArea();
                if (!area) {
                    console.warn('Spreadsheet area not found');
                    return;
                }

                // jspreadsheetが既に初期化されている場合は再初期化
                if (this.spreadsheet) {
                    try {
                        this.spreadsheet.destroy();
                    } catch (e) {
                        console.warn('Error destroying existing spreadsheet:', e);
                    }
                }

                // jspreadsheet CEを初期化
                try {
                    // jspreadsheetまたはjexcelの存在確認
                    const jspreadsheetLib = window.jspreadsheet || window.jexcel;
                    if (typeof jspreadsheetLib === 'undefined') {
                        console.error('jspreadsheet library is not loaded');
                        area.innerHTML = '<div style="padding: 10px; color: red;">エラー: jspreadsheetライブラリが読み込まれていません</div>';
                        return;
                    }

                    this.spreadsheet = jspreadsheetLib(area, {
                        data: [['', '', ''], ['', '', ''], ['', '', '']], // 初期データ（3行3列）
                        columns: [
                            { type: 'text', width: 100 },
                            { type: 'text', width: 100 },
                            { type: 'text', width: 100 }
                        ],
                        minDimensions: [3, 3],
                        tableOverflow: true,
                        tableWidth: '100%',
                        tableHeight: '100%'
                    });
                    
                    console.log('Spreadsheet initialized:', this.spreadsheet);
                } catch (error) {
                    console.error('Error initializing spreadsheet:', error);
                    area.innerHTML = `<div style="padding: 10px; color: red;">エラー: ${error.message || error.toString()}</div>`;
                }
            }

            addRow() {
                if (!this.spreadsheet) {
                    console.warn('Spreadsheet not initialized');
                    return;
                }
                try {
                    const rowCount = this.spreadsheet.options.data.length;
                    const colCount = this.spreadsheet.options.data[0] ? this.spreadsheet.options.data[0].length : 3;
                    const newRow = Array(colCount).fill('');
                    this.spreadsheet.insertRow(rowCount, newRow);
                } catch (error) {
                    console.error('Error adding row:', error);
                    alert('行の追加に失敗しました: ' + (error.message || error.toString()));
                }
            }

            addColumn() {
                if (!this.spreadsheet) {
                    console.warn('Spreadsheet not initialized');
                    return;
                }
                try {
                    const colCount = this.spreadsheet.options.data[0] ? this.spreadsheet.options.data[0].length : 3;
                    this.spreadsheet.insertColumn(colCount, { type: 'text', width: 100 });
                } catch (error) {
                    console.error('Error adding column:', error);
                    alert('列の追加に失敗しました: ' + (error.message || error.toString()));
                }
            }

            deleteRow() {
                if (!this.spreadsheet) {
                    console.warn('Spreadsheet not initialized');
                    return;
                }
                try {
                    const rowCount = this.spreadsheet.options.data.length;
                    if (rowCount <= 1) {
                        alert('最後の1行は削除できません');
                        return;
                    }
                    this.spreadsheet.deleteRow(rowCount - 1);
                } catch (error) {
                    console.error('Error deleting row:', error);
                    alert('行の削除に失敗しました: ' + (error.message || error.toString()));
                }
            }

            deleteColumn() {
                if (!this.spreadsheet) {
                    console.warn('Spreadsheet not initialized');
                    return;
                }
                try {
                    const colCount = this.spreadsheet.options.data[0] ? this.spreadsheet.options.data[0].length : 3;
                    if (colCount <= 1) {
                        alert('最後の1列は削除できません');
                        return;
                    }
                    this.spreadsheet.deleteColumn(colCount - 1);
                } catch (error) {
                    console.error('Error deleting column:', error);
                    alert('列の削除に失敗しました: ' + (error.message || error.toString()));
                }
            }

            loadXlsx() {
                if (this.fileInput) {
                    this.fileInput.click();
                }
            }

            async handleFileLoad(file) {
                if (!file) return;

                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                    
                    // 最初のシートを取得
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // シートをJSON形式に変換
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                    
                    // 空の行を削除（末尾の空行のみ）
                    while (jsonData.length > 0 && jsonData[jsonData.length - 1].every(cell => cell === '')) {
                        jsonData.pop();
                    }
                    
                    // データが空の場合はデフォルトデータを設定
                    if (jsonData.length === 0) {
                        jsonData.push(['', '', ''], ['', '', ''], ['', '', '']);
                    }
                    
                    // 列の最大数を取得
                    const maxCols = Math.max(...jsonData.map(row => row.length), 3);
                    
                    // 各行の列数を統一
                    jsonData.forEach(row => {
                        while (row.length < maxCols) {
                            row.push('');
                        }
                    });
                    
                    // スプレッドシートを再初期化
                    if (this.spreadsheet) {
                        this.spreadsheet.destroy();
                    }
                    
                    const area = this.getSpreadsheetArea();
                    const columns = Array(maxCols).fill(null).map(() => ({ type: 'text', width: 100 }));
                    const jspreadsheetLib = window.jspreadsheet || window.jexcel;
                    
                    this.spreadsheet = jspreadsheetLib(area, {
                        data: jsonData,
                        columns: columns,
                        minDimensions: [maxCols, jsonData.length],
                        tableOverflow: true,
                        tableWidth: '100%',
                        tableHeight: '100%'
                    });
                    
                    console.log('Spreadsheet loaded from xlsx file');
                } catch (error) {
                    console.error('Error loading xlsx file:', error);
                    alert('xlsxファイルの読み込みに失敗しました: ' + (error.message || error.toString()));
                }
            }

            saveXlsx() {
                if (!this.spreadsheet) {
                    console.warn('Spreadsheet not initialized');
                    alert('スプレッドシートが初期化されていません');
                    return;
                }

                try {
                    // スプレッドシートのデータを取得
                    const data = this.spreadsheet.getData();
                    
                    // 空の行を削除（末尾の空行のみ）
                    let cleanData = [...data];
                    while (cleanData.length > 0 && cleanData[cleanData.length - 1].every(cell => cell === '' || cell === null)) {
                        cleanData.pop();
                    }
                    
                    // データが空の場合はデフォルトデータを設定
                    if (cleanData.length === 0) {
                        cleanData = [['', '', ''], ['', '', ''], ['', '', '']];
                    }
                    
                    // ワークブックを作成
                    const worksheet = XLSX.utils.aoa_to_sheet(cleanData);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
                    
                    // ファイル名を生成
                    const fileName = `spreadsheet_${Date.now()}.xlsx`;
                    
                    // ファイルをダウンロード
                    XLSX.writeFile(workbook, fileName);
                    
                    console.log('Spreadsheet saved to xlsx file:', fileName);
                } catch (error) {
                    console.error('Error saving xlsx file:', error);
                    alert('xlsxファイルの書き出しに失敗しました: ' + (error.message || error.toString()));
                }
            }

            rebindButtons() {
                super.rebindButtons();
                // ボタンのイベントハンドラーを再設定
                const container = this.getInputElement();
                if (container) {
                    const buttons = container.querySelectorAll('.spreadsheet-btn');
                    buttons.forEach(btn => {
                        const text = btn.textContent;
                        if (text === 'xlsx読み込み') {
                            btn.onclick = (e) => { e.stopPropagation(); this.loadXlsx(); };
                        } else if (text === 'xlsx書き出し') {
                            btn.onclick = (e) => { e.stopPropagation(); this.saveXlsx(); };
                        }
                    });
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '600px';
                        this.container.style.height = '400px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 400,
                            minHeight: 300,
                            maxWidth: 1200,
                            maxHeight: 800,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized Spreadsheet container ID: ${this.id}`);
                                // リサイズ後にスプレッドシートを更新
                                if (this.spreadsheet) {
                                    setTimeout(() => {
                                        try {
                                            this.spreadsheet.refresh();
                                        } catch (e) {
                                            console.warn('Error refreshing spreadsheet:', e);
                                        }
                                    }, 100);
                                }
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const data = this.spreadsheet ? this.spreadsheet.getData() : [];
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    data: data
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                
                // データの復元
                if (state.data && Array.isArray(state.data) && state.data.length > 0) {
                    setTimeout(() => {
                        if (this.spreadsheet) {
                            this.spreadsheet.destroy();
                        }
                        this.initializeSpreadsheet();
                        setTimeout(() => {
                            if (this.spreadsheet && state.data) {
                                try {
                                    // データを設定
                                    const area = this.getSpreadsheetArea();
                                    const maxCols = Math.max(...state.data.map(row => row ? row.length : 0), 3);
                                    const columns = Array(maxCols).fill(null).map(() => ({ type: 'text', width: 100 }));
                                    
                                    // データの列数を統一
                                    const normalizedData = state.data.map(row => {
                                        const normalizedRow = row ? [...row] : [];
                                        while (normalizedRow.length < maxCols) {
                                            normalizedRow.push('');
                                        }
                                        return normalizedRow;
                                    });
                                    
                                    const jspreadsheetLib = window.jspreadsheet || window.jexcel;
                                    this.spreadsheet.destroy();
                                    this.spreadsheet = jspreadsheetLib(area, {
                                        data: normalizedData,
                                        columns: columns,
                                        minDimensions: [maxCols, normalizedData.length],
                                        tableOverflow: true,
                                        tableWidth: '100%',
                                        tableHeight: '100%'
                                    });
                                } catch (error) {
                                    console.error('Error restoring spreadsheet data:', error);
                                }
                            }
                        }, 100);
                    }, 100);
                }
                
                // ボタンのイベントハンドラーを再設定
                this.rebindButtons();
            }

            init() {
                super.init();
                // スプレッドシートの初期化を少し遅らせる（DOMが完全に構築された後）
                setTimeout(() => {
                    this.initializeSpreadsheet();
                }, 100);
            }

            static getConfigSelectors() {
                return {
                    configInput: '#spreadsheetConfig',
                    errorMessage: '#spreadsheetError',
                    clearFields: ['#spreadsheetConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteSpreadsheet(null, false, customId, customClasses);
                console.log(`Created Spreadsheet with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // Cinderellaコンポーネントクラス
        class PaletteCinderella extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], cindyConfig = null, csScripts = {}) {
                super(container, isChild, customId, customClasses);
                this.cindyConfig = cindyConfig || null;
                this.csScripts = csScripts || {}; // cs*タグの内容を保存（元のIDをキーとして保存）
                this.csScriptIdMap = {}; // 元のID -> ユニークIDのマッピング
                this.cindyInstance = null;
                if (!container) {
                    // Cinderellaのportsからサイズを取得
                    if (cindyConfig && cindyConfig.ports && cindyConfig.ports.length > 0) {
                        const port = cindyConfig.ports[0];
                        // タイトルバーの高さを考慮（通常20px）
                        const titleBarHeight = 20;
                        
                        if (port.width) {
                            this.container.style.width = port.width + 'px';
                        } else {
                            this.container.style.width = '600px';
                        }
                        if (port.height) {
                            // タイトルバーの高さを追加
                            this.container.style.height = (port.height + titleBarHeight) + 'px';
                        } else {
                            this.container.style.height = (400 + titleBarHeight) + 'px';
                        }
                        console.log('Set Cinderella component size from ports:', port.width, 'x', port.height, '(with title bar:', (port.height + titleBarHeight) + 'px)');
                    } else {
                        this.container.style.width = '600px';
                        this.container.style.height = '420px'; // 400px + 20px (title bar)
                    }
                }
                this.init();
                
                // 既存のコンテナから設定を読み込む（復元時）
                if (container) {
                    const existingConfig = this.getCindyConfig();
                    const existingScripts = this.getCindyScripts();
                    const existingIdMap = this.getCsScriptIdMap();
                    if (existingConfig) {
                        this.cindyConfig = existingConfig;
                        this.csScripts = existingScripts;
                        if (existingIdMap && Object.keys(existingIdMap).length > 0) {
                            this.csScriptIdMap = existingIdMap;
                        } else {
                            // idMapが存在しない場合は、scriptsから再構築
                            this.csScriptIdMap = {};
                            Object.keys(existingScripts).forEach(originalId => {
                                const suffix = originalId.substring(2);
                                // cs<suffix> -> cs-<this.id>-<suffix>
                                this.csScriptIdMap[originalId] = `cs-${this.id}-${suffix}`;
                            });
                        }
                        console.log('Loaded Cinderella config from existing container:', this.id, 'config:', !!existingConfig, 'scripts:', Object.keys(existingScripts).length, 'idMap:', Object.keys(this.csScriptIdMap).length);
                    }
                }
                
                if (cindyConfig) {
                    this.saveCindyConfig(cindyConfig, csScripts);
                    setTimeout(() => {
                        this.initializeCindyJS();
                    }, 100);
                } else if (this.cindyConfig) {
                    // 既存のコンテナから読み込んだ設定を使用
                    // init()が完了してから初期化する
                    setTimeout(() => {
                        this.initializeCindyJS();
                    }, 200);
                }
            }

            saveCindyConfig(cindyConfig, csScripts) {
                // CindyJS設定を保存
                let configElement = this.container.querySelector('.cindy-config');
                if (!configElement) {
                    configElement = document.createElement('div');
                    configElement.className = 'cindy-config';
                    configElement.style.display = 'none';
                    this.container.appendChild(configElement);
                }
                configElement.textContent = JSON.stringify(cindyConfig);
                
                // cs*タグの内容を保存
                let scriptsElement = this.container.querySelector('.cindy-scripts');
                if (!scriptsElement) {
                    scriptsElement = document.createElement('div');
                    scriptsElement.className = 'cindy-scripts';
                    scriptsElement.style.display = 'none';
                    this.container.appendChild(scriptsElement);
                }
                scriptsElement.textContent = JSON.stringify(csScripts);
                
                // csScriptIdMapを保存
                let idMapElement = this.container.querySelector('.cindy-script-id-map');
                if (!idMapElement) {
                    idMapElement = document.createElement('div');
                    idMapElement.className = 'cindy-script-id-map';
                    idMapElement.style.display = 'none';
                    this.container.appendChild(idMapElement);
                }
                idMapElement.textContent = JSON.stringify(this.csScriptIdMap);
            }

            getCindyConfig() {
                const configElement = this.container.querySelector('.cindy-config');
                if (configElement && configElement.textContent) {
                    try {
                        return JSON.parse(configElement.textContent);
                    } catch (e) {
                        console.error('Error parsing CindyJS config:', e);
                        return null;
                    }
                }
                return null;
            }

            getCindyScripts() {
                const scriptsElement = this.container.querySelector('.cindy-scripts');
                let csScripts = {};
                
                // まず、コンテナ内に保存されたスクリプトを取得
                if (scriptsElement && scriptsElement.textContent) {
                    try {
                        csScripts = JSON.parse(scriptsElement.textContent);
                    } catch (e) {
                        console.error('Error parsing CindyJS scripts from container:', e);
                    }
                }
                
                // 次に、head内のcs*タグからも読み込む（保存されたHTMLファイルの場合）
                // ただし、このコンポーネントのユニークID（cs-<id>-*）で始まるもののみ
                const allScripts = document.querySelectorAll('script[type="text/x-cindyscript"]');
                allScripts.forEach(script => {
                    const scriptId = script.id;
                    if (scriptId && scriptId.startsWith(`cs-${this.id}-`)) {
                        // ユニークIDから元のIDを逆引き
                        const suffix = scriptId.substring(`cs-${this.id}-`.length);
                        const originalId = `cs${suffix}`;
                        csScripts[originalId] = script.textContent || '';
                    }
                });
                
                return csScripts;
            }

            getCsScriptIdMap() {
                const idMapElement = this.container.querySelector('.cindy-script-id-map');
                if (idMapElement && idMapElement.textContent) {
                    try {
                        return JSON.parse(idMapElement.textContent);
                    } catch (e) {
                        console.error('Error parsing csScriptIdMap:', e);
                        return {};
                    }
                }
                return {};
            }

            createInputElement() {
                const cindyContainer = document.createElement('div');
                cindyContainer.className = 'palette-cinderella';
                // CindyJS用のキャンバスコンテナ
                const canvasContainer = document.createElement('div');
                canvasContainer.id = `CSCanvas-${this.id}`;
                cindyContainer.appendChild(canvasContainer);
                return cindyContainer;
            }

            getInputElement() {
                let inputElement = this.container.querySelector('.palette-cinderella');
                // 復元時に要素が存在しない場合は作成
                if (!inputElement) {
                    const body = this.container.querySelector('.palette-body');
                    if (body) {
                        inputElement = this.createInputElement();
                        body.appendChild(inputElement);
                        console.log('Created input element for restored Cinderella component:', this.id);
                    } else {
                        console.warn('Palette body not found for Cinderella component:', this.id);
                    }
                }
                // キャンバスコンテナの作成はinitializeCindyJS()で行うため、ここでは作成しない
                return inputElement;
            }

            initializeCindyJS() {
                const config = this.getCindyConfig();
                const csScripts = this.getCindyScripts();
                
                if (!config) {
                    console.warn('CindyJS config not found for component:', this.id);
                    return;
                }

                // CindyJSライブラリが読み込まれるまで待つ
                const checkCindyJS = () => {
                    if (typeof CindyJS === 'undefined') {
                        console.log('Waiting for CindyJS to load...');
                        setTimeout(checkCindyJS, 100);
                        return;
                    }

                    // 既存のCindyJSインスタンスを削除
                    if (this.cindyInstance) {
                        try {
                            // erase()メソッドが存在する場合のみ呼び出す
                            if (typeof this.cindyInstance.erase === 'function') {
                                this.cindyInstance.erase();
                            } else {
                                // erase()メソッドが存在しない場合は、インスタンスをnullに設定
                                console.log('CindyJS instance does not have erase() method, clearing reference');
                            }
                        } catch (e) {
                            console.warn('Error erasing previous CindyJS instance:', e);
                        } finally {
                            // エラーが発生してもインスタンス参照をクリア
                            this.cindyInstance = null;
                        }
                    }

                    const inputElement = this.getInputElement();
                    if (!inputElement) {
                        console.error('Input element not found for component:', this.id);
                        return;
                    }
                    
                    // 既存のキャンバスコンテナをすべて削除（重複を防ぐため）
                    const allCanvasContainers = inputElement.querySelectorAll(`[id^="CSCanvas-"]`);
                    if (allCanvasContainers.length > 0) {
                        console.log(`Removing ${allCanvasContainers.length} existing canvas containers for component ${this.id}`);
                        allCanvasContainers.forEach(container => {
                            container.remove();
                        });
                    }
                    
                    // 新しいキャンバスコンテナを作成
                    const canvasContainer = document.createElement('div');
                    canvasContainer.id = `CSCanvas-${this.id}`;
                    inputElement.appendChild(canvasContainer);
                    console.log('Created new canvas container for component:', this.id);

                    // cs*タグを埋め込む（ユニークIDを使用）
                    Object.keys(csScripts).forEach(originalId => {
                        // 元のIDからユニークIDを取得
                        const uniqueId = this.csScriptIdMap[originalId] || originalId;
                        
                        // 既存のスクリプトを削除（同じユニークIDのもの）
                        const existingScript = document.getElementById(uniqueId);
                        if (existingScript) {
                            existingScript.remove();
                        }
                        
                        // 新しいスクリプトを作成
                        const script = document.createElement('script');
                        script.id = uniqueId;
                        script.type = 'text/x-cindyscript';
                        script.textContent = csScripts[originalId];
                        document.head.appendChild(script);
                        console.log(`Created cs script with unique ID: ${uniqueId} (original: ${originalId})`);
                    });

                    // CindyJS設定を調整（ポートのIDを変更、scriptsを設定）
                    const adjustedConfig = JSON.parse(JSON.stringify(config));
                    if (adjustedConfig.ports && adjustedConfig.ports.length > 0) {
                        adjustedConfig.ports[0].id = `CSCanvas-${this.id}`;
                    }
                    // scripts は常にこのコンポーネント用のワイルドカードに設定する
                    // 例: id が cs-コンポーネントID-*- のスクリプトをすべて対象にする
                    adjustedConfig.scripts = `cs-${this.id}-*`;
                    console.log(`Set scripts from wildcard: ${adjustedConfig.scripts}`);

                    // CindyJSを初期化
                    try {
                        this.cindyInstance = CindyJS(adjustedConfig);
                        console.log('CindyJS initialized successfully for component:', this.id);
                    } catch (error) {
                        console.error('Error initializing CindyJS for component:', this.id, error);
                    }
                };

                checkCindyJS();
            }

            getComponentName() { return 'Cinderella'; }
            getComponentType() { return 'cinderella'; }

            execs(cinderellaCode) {
                if (!this.cindyInstance) {
                    console.warn('CindyJS instance not initialized for component:', this.id);
                    return;
                }
                if (typeof this.cindyInstance.evokeCS !== 'function') {
                    console.warn('evokeCS method not available on CindyJS instance for component:', this.id);
                    return;
                }
                try {
                    this.cindyInstance.evokeCS(cinderellaCode);
                } catch (error) {
                    console.error('Error executing Cinderella code for component:', this.id, error);
                }
            }

            static execs(cinderellaCode, componentId = null) {
                let instance = null;
                
                // コンポーネントIDが指定されている場合
                if (componentId) {
                    // # が含まれている場合は除去
                    const cleanId = componentId.startsWith('#') ? componentId.substring(1) : componentId;
                    const element = document.getElementById(cleanId);
                    if (element) {
                        instance = $(element).data('instance');
                    }
                    if (!instance) {
                        console.warn(`Cinderella component with ID "${cleanId}" not found`);
                        return;
                    }
                } else {
                    // コンポーネントIDが指定されていない場合、現在実行中の親コンポーネントを優先的に使用
                    if (window.currentParentComponent && 
                        window.currentParentComponent instanceof PaletteCinderella &&
                        window.currentParentComponent.cindyInstance) {
                        instance = window.currentParentComponent;
                        console.log(`Using current parent component for execs: ${instance.id}`);
                    } else {
                        // 親コンポーネントが存在しない、またはCinderellaコンポーネントでない場合、
                        // すべてのCinderellaコンポーネントを検索して最初に見つかった初期化済みのインスタンスを使用
                        const allContainers = document.querySelectorAll('.palette-container[data-component-type="cinderella"]');
                        for (const container of allContainers) {
                            const candidateInstance = $(container).data('instance');
                            if (candidateInstance && candidateInstance.cindyInstance) {
                                instance = candidateInstance;
                                break;
                            }
                        }
                        if (!instance) {
                            console.warn('No initialized Cinderella component found');
                            return;
                        }
                    }
                }
                
                // インスタンスメソッドを呼び出す
                instance.execs(cinderellaCode);
            }

            evalcs(variableName) {
                if (!this.cindyInstance) {
                    console.warn('CindyJS instance not initialized for component:', this.id);
                    return null;
                }
                if (typeof this.cindyInstance.evalcs !== 'function') {
                    console.warn('evalcs method not available on CindyJS instance for component:', this.id);
                    return null;
                }
                try {
                    const result = this.cindyInstance.evalcs(variableName);
                    if (result && result.value && typeof result.value.real !== 'undefined') {
                        return result.value.real;
                    }
                    console.warn('evalcs result does not have expected structure for variable:', variableName);
                    return null;
                } catch (error) {
                    console.error('Error evaluating Cinderella variable for component:', this.id, error);
                    return null;
                }
            }

            static evalcs(variableName, componentId = null) {
                let instance = null;
                
                // コンポーネントIDが指定されている場合
                if (componentId) {
                    // # が含まれている場合は除去
                    const cleanId = componentId.startsWith('#') ? componentId.substring(1) : componentId;
                    const element = document.getElementById(cleanId);
                    if (element) {
                        instance = $(element).data('instance');
                    }
                    if (!instance) {
                        console.warn(`Cinderella component with ID "${cleanId}" not found`);
                        return null;
                    }
                } else {
                    // コンポーネントIDが指定されていない場合、現在実行中の親コンポーネントを優先的に使用
                    if (window.currentParentComponent && 
                        window.currentParentComponent instanceof PaletteCinderella &&
                        window.currentParentComponent.cindyInstance) {
                        instance = window.currentParentComponent;
                        console.log(`Using current parent component for evalcs: ${instance.id}`);
                    } else {
                        // 親コンポーネントが存在しない、またはCinderellaコンポーネントでない場合、
                        // すべてのCinderellaコンポーネントを検索して最初に見つかった初期化済みのインスタンスを使用
                        const allContainers = document.querySelectorAll('.palette-container[data-component-type="cinderella"]');
                        for (const container of allContainers) {
                            const candidateInstance = $(container).data('instance');
                            if (candidateInstance && candidateInstance.cindyInstance) {
                                instance = candidateInstance;
                                break;
                            }
                        }
                        if (!instance) {
                            console.warn('No initialized Cinderella component found');
                            return null;
                        }
                    }
                }
                
                // インスタンスメソッドを呼び出す
                return instance.evalcs(variableName);
            }

            actcs(action, newContent) {
                if (!action) {
                    console.warn('Action is required for actcs()');
                    return;
                }
                
                // 元のIDを構築（例: "draw" -> "csdraw"）
                const originalId = `cs${action}`;
                
                // ユニークIDを取得（例: "cs-<component.id>-draw"）
                const uniqueId = this.csScriptIdMap[originalId] || `cs-${this.id}-${action}`;
                
                // スクリプトタグを取得
                const scriptElement = document.getElementById(uniqueId);
                
                if (!scriptElement) {
                    // スクリプトタグが存在しない場合は新規作成
                    const newScript = document.createElement('script');
                    newScript.id = uniqueId;
                    newScript.type = 'text/x-cindyscript';
                    newScript.textContent = newContent || '';
                    document.head.appendChild(newScript);
                    
                    // csScripts と csScriptIdMap を更新
                    if (!this.csScripts) {
                        this.csScripts = {};
                    }
                    this.csScripts[originalId] = newContent || '';
                    if (!this.csScriptIdMap[originalId]) {
                        this.csScriptIdMap[originalId] = uniqueId;
                    }
                    
                    // 設定を保存
                    const config = this.getCindyConfig();
                    if (config) {
                        this.saveCindyConfig(config, this.csScripts);
                    }
                    
                    console.log(`Created new cs script with ID: ${uniqueId} for action: ${action}`);
                } else {
                    // 既存のスクリプトタグの内容を更新
                    scriptElement.textContent = newContent || '';
                    
                    // csScripts を更新
                    if (!this.csScripts) {
                        this.csScripts = {};
                    }
                    this.csScripts[originalId] = newContent || '';
                    
                    // 設定を保存
                    const config = this.getCindyConfig();
                    if (config) {
                        this.saveCindyConfig(config, this.csScripts);
                    }
                    
                    console.log(`Updated cs script with ID: ${uniqueId} for action: ${action}`);
                }
                
                // CindyJSを再初期化してCinderellaを再起動
                setTimeout(() => {
                    this.initializeCindyJS();
                }, 100);
            }

            static actcs(action, newContent, componentId = null) {
                if (!action) {
                    console.warn('Action is required for actcs()');
                    return;
                }
                
                let instance = null;
                
                // コンポーネントIDが指定されている場合
                if (componentId) {
                    // # が含まれている場合は除去
                    const cleanId = componentId.startsWith('#') ? componentId.substring(1) : componentId;
                    const element = document.getElementById(cleanId);
                    if (element) {
                        instance = $(element).data('instance');
                    }
                    if (!instance) {
                        console.warn(`Cinderella component with ID "${cleanId}" not found`);
                        return;
                    }
                } else {
                    // コンポーネントIDが指定されていない場合、現在実行中の親コンポーネントを優先的に使用
                    if (window.currentParentComponent && 
                        window.currentParentComponent instanceof PaletteCinderella &&
                        window.currentParentComponent.cindyInstance) {
                        instance = window.currentParentComponent;
                        console.log(`Using current parent component for actcs: ${instance.id}`);
                    } else {
                        // 親コンポーネントが存在しない、またはCinderellaコンポーネントでない場合、
                        // すべてのCinderellaコンポーネントを検索して最初に見つかった初期化済みのインスタンスを使用
                        const allContainers = document.querySelectorAll('.palette-container[data-component-type="cinderella"]');
                        for (const container of allContainers) {
                            const candidateInstance = $(container).data('instance');
                            if (candidateInstance && candidateInstance.cindyInstance) {
                                instance = candidateInstance;
                                break;
                            }
                        }
                        if (!instance) {
                            console.warn('No initialized Cinderella component found');
                            return;
                        }
                    }
                }
                
                // インスタンスメソッドを呼び出す
                instance.actcs(action, newContent);
            }

            static csinit(newContent, componentId = null) {
                this.actcs("init", newContent, componentId);
            }

            static csdraw(newContent, componentId = null) {
                this.actcs("draw", newContent, componentId);
            }

            static csmove(newContent, componentId = null) {
                this.actcs("move", newContent, componentId);
            }

            static exeSubText(componentId) {
                if (!componentId) {
                    console.warn('Component ID is required for exeSubText()');
                    return;
                }
                
                // # が含まれている場合は除去
                const cleanId = componentId.startsWith('#') ? componentId.substring(1) : componentId;
                const element = document.getElementById(cleanId);
                
                if (!element) {
                    console.warn(`Cinderella component with ID "${cleanId}" not found`);
                    return;
                }
                
                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`Cinderella component instance not found for ID "${cleanId}"`);
                    return;
                }
                
                // インスタンスメソッド executeChildCode() を呼び出す
                if (typeof instance.executeChildCode === 'function') {
                    instance.executeChildCode();
                } else {
                    console.warn(`executeChildCode method not found for component ID "${cleanId}"`);
                }
            }

            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        // 現在のサイズを保持（style属性を優先）
                        let currentWidth = this.container.style.width;
                        let currentHeight = this.container.style.height;
                        
                        // style属性が空の場合は計算された値を取得
                        if (!currentWidth || currentWidth === '') {
                            const computed = window.getComputedStyle(this.container);
                            currentWidth = computed.width;
                        }
                        if (!currentHeight || currentHeight === '') {
                            const computed = window.getComputedStyle(this.container);
                            currentHeight = computed.height;
                        }
                        
                        console.log('Initializing resizable for Cinderella component:', this.id, 'width:', currentWidth, 'height:', currentHeight);
                        
                        // サイズを明示的に設定（既存のサイズを保持）
                        // ただし、既にstyle属性に値がある場合は変更しない（復元時のサイズを保持）
                        if (currentWidth && currentWidth !== 'auto' && !this.container.style.width) {
                            this.container.style.width = currentWidth;
                        }
                        if (currentHeight && currentHeight !== 'auto' && !this.container.style.height) {
                            this.container.style.height = currentHeight;
                        }
                        
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 300,
                            minHeight: 200,
                            maxWidth: 1200,
                            maxHeight: 900,
                            aspectRatio: false,
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            resize: (event, ui) => {
                                restoreCanvasOnResize(this.container);
                            },
                            stop: (event, ui) => {
                                console.log(`Resized Cinderella container ID: ${this.id}`);
                                restoreCanvasOnResizeStop(this.container);
                                
                                // リサイズ後のサイズを取得
                                const newWidth = parseInt(ui.size.width, 10);
                                const newHeight = parseInt(ui.size.height, 10);
                                
                                // タイトルバーの高さを考慮（通常20px）
                                const titleBarHeight = 20;
                                const cindyWidth = newWidth;
                                const cindyHeight = newHeight - titleBarHeight;
                                
                                console.log(`Resized to: ${newWidth}x${newHeight}, Cinderella size: ${cindyWidth}x${cindyHeight}`);
                                
                                // CindyJSの設定を更新
                                const config = this.getCindyConfig();
                                if (config && config.ports && config.ports.length > 0) {
                                    config.ports[0].width = cindyWidth;
                                    config.ports[0].height = cindyHeight;
                                    this.saveCindyConfig(config, this.getCindyScripts());
                                    
                                    // リサイズ後にCindyJSを再初期化
                                    setTimeout(() => {
                                        this.initializeCindyJS();
                                    }, 100);
                                } else {
                                    console.warn('CindyJS config not found for resizing component:', this.id);
                                }
                            }
                        });
                    } else {
                        $(this.container).resizable('enable');
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                    }
                }
            }

            serializeState() {
                const config = this.getCindyConfig();
                const csScripts = this.getCindyScripts();
                // 現在のサイズを取得（計算された値も含む）
                const computedStyle = window.getComputedStyle(this.container);
                const state = {
                    type: 'cinderella',
                    id: this.id,
                    left: this.container.style.left || computedStyle.left,
                    top: this.container.style.top || computedStyle.top,
                    width: this.container.style.width || computedStyle.width,
                    height: this.container.style.height || computedStyle.height
                };
                
                // configとcsScriptsが存在する場合のみ保存
                if (config) {
                    state.cindyConfig = JSON.stringify(config);
                }
                if (csScripts && Object.keys(csScripts).length > 0) {
                    state.csScripts = JSON.stringify(csScripts);
                }
                if (this.csScriptIdMap && Object.keys(this.csScriptIdMap).length > 0) {
                    state.csScriptIdMap = JSON.stringify(this.csScriptIdMap);
                }
                
                console.log('Serializing Cinderella state for component:', this.id, 'width:', state.width, 'height:', state.height, 'config:', !!config, 'scripts:', Object.keys(csScripts).length, 'idMap:', Object.keys(this.csScriptIdMap).length);
                return state;
            }

            async restoreState(state) {
                console.log('Restoring Cinderella state for component:', this.id, 'state keys:', Object.keys(state), 'width:', state.width, 'height:', state.height);
                // サイズを最初に復元（init()の後に呼ばれるため、確実に適用される）
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) {
                    // 保存されたサイズをそのまま使用（タイトルバーを含む全体のサイズ）
                    this.container.style.width = state.width;
                    console.log('Restored width:', state.width);
                }
                if (state.height) {
                    // 保存されたサイズをそのまま使用（タイトルバーを含む全体のサイズ）
                    this.container.style.height = state.height;
                    console.log('Restored height:', state.height);
                }
                
                // サイズを復元した後、resizableを再初期化してサイズを確実に適用
                if (state.width || state.height) {
                    // 既存のresizableインスタンスを破棄
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('destroy');
                    }
                    // 少し待ってから再初期化（サイズが確実に適用されるように）
                    setTimeout(() => {
                        // サイズを再度設定してからresizableを初期化
                        if (state.width) this.container.style.width = state.width;
                        if (state.height) this.container.style.height = state.height;
                        this.initializeResizable();
                    }, 50);
                }
                
                // stateからcindyConfigを取得、なければコンテナ内の要素から取得
                let cindyConfig = null;
                let csScripts = {};
                
                if (state.cindyConfig && state.cindyConfig !== 'null' && state.cindyConfig !== '') {
                    try {
                        cindyConfig = typeof state.cindyConfig === 'string' ? JSON.parse(state.cindyConfig) : state.cindyConfig;
                    } catch (e) {
                        console.error('Error parsing cindyConfig from state:', e);
                    }
                }
                
                // コンテナ内の要素からも取得を試みる
                if (!cindyConfig) {
                    cindyConfig = this.getCindyConfig();
                }
                
                if (state.csScripts && state.csScripts !== 'null' && state.csScripts !== '') {
                    try {
                        csScripts = typeof state.csScripts === 'string' ? JSON.parse(state.csScripts) : (state.csScripts || {});
                    } catch (e) {
                        console.error('Error parsing csScripts from state:', e);
                    }
                }
                
                // コンテナ内の要素やhead内のタグからも取得を試みる
                const containerScripts = this.getCindyScripts();
                if (Object.keys(containerScripts).length > 0) {
                    csScripts = { ...csScripts, ...containerScripts };
                }
                
                // csScriptIdMapは、常に現在のコンポーネントIDに合わせて再構築する
                // （保存前のIDに依存しないようにする）
                this.csScriptIdMap = {};
                Object.keys(csScripts).forEach(originalId => {
                    const suffix = originalId.substring(2);
                    // cs<suffix> -> cs-<this.id>-<suffix>
                    this.csScriptIdMap[originalId] = `cs-${this.id}-${suffix}`;
                });
                
                if (cindyConfig) {
                    console.log('Found Cinderella config, initializing...', 'config:', !!cindyConfig, 'scripts count:', Object.keys(csScripts).length, 'idMap:', Object.keys(this.csScriptIdMap).length);
                    this.saveCindyConfig(cindyConfig, csScripts);
                    // DOMが完全に読み込まれてから初期化
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', () => {
                            setTimeout(() => {
                                this.initializeCindyJS();
                            }, 500);
                        });
                    } else {
                        setTimeout(() => {
                            this.initializeCindyJS();
                        }, 500);
                    }
                } else {
                    console.warn('No cindyConfig found in state or container for component:', this.id, 'state:', state);
                }
            }

            static getConfigSelectors() {
                return {
                    configInput: '#cinderellaConfig',
                    errorMessage: '#cinderellaError',
                    clearFields: ['#cinderellaConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static parseCinderellaHTML(htmlContent) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');
                
                // CindyJS設定を抽出
                const scripts = doc.querySelectorAll('script');
                let cindyConfig = null;
                let csScripts = {};
                
                scripts.forEach(script => {
                    // CindyJS初期化コードを探す
                    if (script.textContent && script.textContent.includes('CindyJS')) {
                        try {
                            // CindyJS({...})の部分を抽出（複数行対応）
                            // より正確にマッチングするため、括弧のバランスを考慮
                            let match = null;
                            const text = script.textContent;
                            const startIndex = text.indexOf('CindyJS(');
                            if (startIndex !== -1) {
                                let braceCount = 0;
                                let startBrace = -1;
                                for (let i = startIndex + 8; i < text.length; i++) {
                                    if (text[i] === '{') {
                                        if (braceCount === 0) startBrace = i;
                                        braceCount++;
                                    } else if (text[i] === '}') {
                                        braceCount--;
                                        if (braceCount === 0) {
                                            const configStr = text.substring(startBrace, i + 1);
                                            try {
                                                cindyConfig = JSON.parse(configStr);
                                                break;
                                            } catch (e) {
                                                // JSONとしてパースできない場合は、evalを使用（安全な範囲で）
                                                try {
                                                    const func = new Function('return ' + configStr);
                                                    cindyConfig = func();
                                                    break;
                                                } catch (e2) {
                                                    console.error('Error parsing CindyJS config:', e2);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing CindyJS config:', e);
                        }
                    }
                });

                // cs*タグは、元のHTML文字列から正規表現で全文を抽出する
                // （DOMParserやtextContentによるサイズ制限・変換の影響を避ける）
                csScripts = {};
                const csScriptRegex = /<script[^>]*id="(cs[^"]+)"[^>]*type="text\/x-cindyscript"[^>]*>([\s\S]*?)<\/script>/gi;
                let match;
                while ((match = csScriptRegex.exec(htmlContent)) !== null) {
                    const scriptId = match[1];
                    const scriptContent = match[2] || '';
                    csScripts[scriptId] = scriptContent;
                }

                return { cindyConfig, csScripts };
            }

            static createComponent(configInput, errorMessage, additionalInputs, htmlContent) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) customId = match[1];
                        if (match[2]) customClasses.push(match[2]);
                        if (match[3]) customClasses.push(match[3]);
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }

                if (!htmlContent) {
                    if (errorMessage) {
                        errorMessage.text('HTMLファイルを選択してください').show();
                    }
                    return;
                }

                const { cindyConfig, csScripts } = this.parseCinderellaHTML(htmlContent);
                if (!cindyConfig) {
                    if (errorMessage) {
                        errorMessage.text('CindyJS設定が見つかりませんでした').show();
                    }
                    return;
                }

                // 一時的なコンポーネントIDを生成（実際のIDはコンストラクタで生成される）
                const tempId = generateUniqueId();
                
                // cs*タグのIDをユニーク化（元のIDをキーとして保持）
                const uniqueCsScripts = {};
                const csScriptIdMap = {};
                Object.keys(csScripts).forEach(originalId => {
                    // csdraw -> cs-<tempId>-draw のように変換
                    const suffix = originalId.substring(2); // "cs"を除いた部分
                    const uniqueId = `cs-${tempId}-${suffix}`;
                    uniqueCsScripts[originalId] = csScripts[originalId]; // 元のIDをキーとして保持
                    csScriptIdMap[originalId] = uniqueId;
                });
                
                // CindyJSの設定をコピー
                const adjustedConfig = JSON.parse(JSON.stringify(cindyConfig));

                const component = new PaletteCinderella(null, false, customId, customClasses, adjustedConfig, uniqueCsScripts);
                // コンポーネントIDが確定した後、csScriptIdMapを更新
                component.csScriptIdMap = {};
                Object.keys(csScriptIdMap).forEach(originalId => {
                    const suffix = originalId.substring(2);
                    component.csScriptIdMap[originalId] = `cs-${component.id}-${suffix}`;
                });
                
                // scripts には、このコンポーネント用のワイルドカードを設定
                // 例: cs-component-123-*- にマッチさせるため "cs-<component.id>-*" を指定
                if (component.cindyConfig) {
                    component.cindyConfig.scripts = `cs-${component.id}-*`;
                }
                
                console.log(`Created Cinderella component with ID: ${component.id}, csScriptIdMap:`, component.csScriptIdMap);
                return component;
            }

            static createFromInput(configInput, errorMessage, additionalInputs, htmlContent) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs, htmlContent);
            }
        }

        // EChartsクラス
        class PaletteEChart extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.echartInstance = null;
                this.echartContainerId = `echart-container-${this.id}`;
                this.init();
            }

            getComponentName() { return 'EChart'; }
            getComponentType() { return 'echart'; }

            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const echartContainer = document.createElement('div');
                echartContainer.className = 'palette-echart';
                
                // ECharts表示用のコンテナ
                const chartDiv = document.createElement('div');
                chartDiv.id = this.echartContainerId;
                chartDiv.className = 'echart-container';
                echartContainer.appendChild(chartDiv);
                
                return echartContainer;
            }

            getInputElement() {
                return this.container.querySelector('.palette-echart');
            }

            getContainer() {
                // thisとclass名を使ってコンテナを取得する関数
                // この関数は子コンポーネントのコードから呼び出される
                const echartContainer = this.container.querySelector('.palette-echart');
                if (echartContainer) {
                    return echartContainer.querySelector('.echart-container');
                }
                return null;
            }

            /**
             * 右下■リサイズに合わせてECharts図を拡大縮小する。
             * this.echartInstance または getInstanceByDom でインスタンスを取得して resize() を呼ぶ。
             */
            resizeEChartInstance() {
                let instance = this.echartInstance;
                if (!instance && typeof echarts !== 'undefined') {
                    const chartDom = this.getContainer();
                    if (chartDom) {
                        instance = echarts.getInstanceByDom(chartDom);
                    }
                }
                if (instance && typeof instance.resize === 'function') {
                    requestAnimationFrame(() => {
                        instance.resize();
                    });
                }
            }

            toggleChild(toggleButton) {
                // 親クラスのtoggleChildを呼び出して子要素の表示/非表示を切り替え（+クリック時はサブテキストを自動実行しない）
                super.toggleChild(toggleButton);
            }

            restoreChildVisibility() {
                // 親クラスのrestoreChildVisibilityを呼び出して子要素の表示状態を復元（復元時もサブテキストを自動実行しない）
                super.restoreChildVisibility();
            }

            autoExecuteCodeIfChildVisible() {
                // 子要素が表示されている場合、自動的にコードを実行
                if (this.linkedChildId) {
                    const childElement = document.getElementById(this.linkedChildId);
                    if (childElement && childElement.style.display !== 'none') {
                        // 子要素が表示されている場合、コードを自動実行
                        // 少し遅延を入れて、DOMの更新を待つ
                        const echartComponent = this;
                        setTimeout(() => {
                            // EChartsライブラリが読み込まれているか確認
                            if (typeof echarts !== 'undefined') {
                                echartComponent.executeChildCode();
                            } else {
                                // EChartsライブラリがまだ読み込まれていない場合、さらに待つ
                                const checkInterval = setInterval(() => {
                                    if (typeof echarts !== 'undefined') {
                                        clearInterval(checkInterval);
                                        echartComponent.executeChildCode();
                                    }
                                }, 100);
                                // 最大5秒待つ
                                setTimeout(() => clearInterval(checkInterval), 5000);
                            }
                        }, 100);
                    }
                }
            }

            executeChildCode() {
                console.log(`Executing EChart code for component ID: ${this.id}`);
                if (this.linkedChildId) {
                    const childElement = document.getElementById(this.linkedChildId);
                    if (childElement) {
                        const childType = $(childElement).data('component-type');
                        const childComponentClass = componentRegistry[childType];
                        if (childComponentClass) {
                            const childComponent = new childComponentClass(childElement, true);
                            const childInput = childComponent.getInputElement();
                            if (childInput) {
                                let codeToExecute = '';
                                if (childType === 'textarea') {
                                    codeToExecute = childInput.value.trim();
                                }
                                if (codeToExecute) {
                                    try {
                                        // コンテナを取得
                                        const container = this.getContainer();
                                        if (!container) {
                                            console.error('EChart container not found');
                                            return;
                                        }
                                        
                                        // 既存のEChartsインスタンスを破棄
                                        if (this.echartInstance) {
                                            this.echartInstance.dispose();
                                            this.echartInstance = null;
                                        }
                                        
                                        // EChartsライブラリが利用可能か確認
                                        if (typeof echarts === 'undefined') {
                                            console.error('ECharts library is not loaded');
                                            alert('EChartsライブラリが読み込まれていません');
                                            return;
                                        }
                                        
                                        // コード実行時に利用可能な変数と関数を定義
                                        // コード内で this.getContainer() を呼び出せるようにする
                                        const echartComponent = this;
                                        
                                        // コードを実行する関数を定義
                                        // コード内で this は PaletteEChartインスタンスを指す
                                        // this.getContainer() でコンテナを取得できる
                                        const executeCode = function() {
                                            // コードを実行（thisはPaletteEChartインスタンスを指す）
                                            // コード内で this.getContainer() を使用可能
                                            eval(codeToExecute);
                                        };
                                        
                                        // コードを実行（thisをバインド）
                                        executeCode.call(echartComponent);
                                        
                                        // コード実行後にEChartsインスタンスを保存
                                        // コード内で作成されたインスタンスを取得するため、
                                        // コンテナからEChartsインスタンスを取得を試みる
                                        // ただし、これは完全には保証されないため、
                                        // コード内でthis.echartInstanceに保存することを推奨
                                        console.log('EChart code executed successfully');
                                    } catch (error) {
                                        console.error('EChart execution error:', error);
                                        alert('EChartコードの実行中にエラーが発生しました: ' + error.message);
                                    }
                                } else {
                                    console.warn('Child input is empty. No code to execute.');
                                }
                            } else {
                                console.warn('No child input found to execute code.');
                            }
                        }
                    } else {
                        console.warn(`子要素のIDが見つかりません: ${this.linkedChildId}`);
                    }
                } else {
                    console.warn('No linked child found to execute code.');
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        const inputElement = this.getInputElement();
                        this.container.style.width = '400px';
                        this.container.style.height = '300px';
                        const echartComponent = this;
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 200,
                            minHeight: 150,
                            maxWidth: 1200,
                            maxHeight: 800,
                            aspectRatio: false,
                            alsoResize: inputElement,
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            resize: (event, ui) => {
                                restoreCanvasOnResize(this.container);
                                // リサイズ中：■を動かすたびにECharts図を拡大縮小
                                echartComponent.resizeEChartInstance();
                            },
                            stop: () => {
                                console.log(`Resized EChart container ID: ${this.id}`);
                                restoreCanvasOnResizeStop(this.container);
                                // リサイズ終了時にもECharts図を拡大縮小
                                echartComponent.resizeEChartInstance();
                            }
                        });
                        console.log(`Resizable initialized for EChart container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for EChart container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for EChart container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const rect = this.container.getBoundingClientRect();
                const childElement = this.linkedChildId ? document.getElementById(this.linkedChildId) : null;
                const childTextarea = childElement ? childElement.querySelector('textarea') : null;
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    childContent: childTextarea ? childTextarea.value : ''
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                
                // 子コンポーネントの内容を復元（空文字で保存された場合も反映する）
                if (this.linkedChildId && state.hasOwnProperty('childContent')) {
                    const childElement = document.getElementById(this.linkedChildId);
                    if (childElement) {
                        const childTextarea = childElement.querySelector('textarea');
                        if (childTextarea) {
                            childTextarea.value = state.childContent ?? '';
                        }
                    }
                }
                
                // EChartsのコードを再実行（子コンポーネントの内容が復元された場合）
                // 子要素の表示状態に関係なく、コードを実行する
                // EChartsライブラリの読み込みを待つため、少し遅延を入れる
                if (this.linkedChildId && state.childContent && state.childContent.trim()) {
                    const echartComponent = this;
                    // より長い遅延を入れて、DOMの更新とEChartsライブラリの読み込みを確実に待つ
                    setTimeout(() => {
                        // EChartsライブラリが読み込まれているか確認
                        if (typeof echarts !== 'undefined') {
                            echartComponent.executeChildCode();
                        } else {
                            // EChartsライブラリがまだ読み込まれていない場合、さらに待つ
                            const checkInterval = setInterval(() => {
                                if (typeof echarts !== 'undefined') {
                                    clearInterval(checkInterval);
                                    echartComponent.executeChildCode();
                                }
                            }, 100);
                            // 最大5秒待つ
                            setTimeout(() => clearInterval(checkInterval), 5000);
                        }
                    }, 300); // 遅延を100msから300msに増やして、より確実に実行されるようにする
                }
            }

            static getConfigSelectors() {
                return {
                    configInput: '#echartConfig',
                    errorMessage: '#echartError',
                    clearFields: ['#echartConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput || configInput.trim() === '') {
                    return true;
                }
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                const match = configInput.match(regex);
                if (!match) {
                    return false;
                }
                const id = match[1];
                if (id && isIdDuplicate(id)) {
                    return 'duplicate';
                }
                return true;
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteEChart(null, false, customId, customClasses);
                console.log(`Created EChart with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // プルダウンメニュークラス
        class PaletteDropdown extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], options = []) {
                super(container, isChild, customId, customClasses);
                this.options = options || [];
                this.init();
                if (this.options.length > 0) {
                    this.setOptions(this.options);
                }
            }

            getComponentName() { return 'Dropdown'; }
            getComponentType() { return 'dropdown'; }
            
            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const dropdownContainer = document.createElement('div');
                dropdownContainer.className = 'palette-dropdown';
                const select = document.createElement('select');
                dropdownContainer.appendChild(select);
                return dropdownContainer;
            }

            getInputElement() {
                return this.container.querySelector('select');
            }

            setOptions(options) {
                // data-*属性から復元されるとoptionsが文字列（例: "0,1,2,3,4,5"）になる場合があるため配列に正規化
                if (typeof options === 'string') {
                    options = options.split(',').map(s => s.trim()).filter(s => s !== '');
                }
                if (!Array.isArray(options)) {
                    options = [];
                }
                const select = this.getInputElement();
                if (select) {
                    select.innerHTML = '';
                    options.forEach((option, index) => {
                        const optionElement = document.createElement('option');
                        optionElement.value = index;
                        optionElement.textContent = option;
                        select.appendChild(optionElement);
                    });
                }
            }

            getOptions() {
                const select = this.getInputElement();
                if (select) {
                    return Array.from(select.options).map(option => option.textContent);
                }
                return [];
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        const inputElement = this.getInputElement();
                        this.container.style.width = '200px';
                        this.container.style.height = '70px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 100,
                            minHeight: 50,
                            maxWidth: 600,
                            maxHeight: 150,
                            aspectRatio: false,
                            alsoResize: inputElement,
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            resize: (event, ui) => {
                                // リサイズ中にもキャンバスを復元（ちらつき防止）
                                restoreCanvasOnResize(this.container);
                            },
                            stop: () => {
                                console.log(`Resized dropdown container ID: ${this.id}`);
                                restoreCanvasOnResizeStop(this.container);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const select = this.getInputElement();
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    options: this.getOptions(),
                    selectedValue: select ? select.value : '0'
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                if (state.options !== undefined) {
                    // data-*属性から復元時はoptionsが文字列になっているためsetOptions内で配列に正規化される
                    const opts = state.options;
                    if ((Array.isArray(opts) && opts.length > 0) || (typeof opts === 'string' && opts.length > 0)) {
                        this.setOptions(state.options);
                    }
                }
                const select = this.getInputElement();
                if (state.selectedValue && select) {
                    select.value = state.selectedValue;
                }
            }

            static getConfigSelectors() {
                return {
                    configInput: '#dropdownConfig',
                    errorMessage: '#dropdownError',
                    additionalInputs: [
                        { id: 'dropdownOptionsConfig', selector: '#dropdownOptionsConfig' }
                    ],
                    clearFields: ['#dropdownConfig', '#dropdownOptionsConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                let options = [];

                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }

                if (additionalInputs.dropdownOptionsConfig) {
                    const optionsText = additionalInputs.dropdownOptionsConfig.trim();
                    if (optionsText) {
                        options = optionsText.split('\n').filter(option => option.trim() !== '');
                    }
                }

                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }

                new PaletteDropdown(null, false, customId, customClasses, options);
                console.log(`Created dropdown with ${options.length} options and ID: ${customId || 'generated-id'}`);
            }
        }

        // Algebrite端末クラス
        class PaletteAlgebrite extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.init();
            }

            getComponentName() { return 'Algebrite'; }
            getComponentType() { return 'algebrite'; }

            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const algebriteContainer = document.createElement('div');
                algebriteContainer.className = 'palette-algebrite';
                
                const textarea = document.createElement('textarea');
                textarea.placeholder = 'Algebriteの命令を入力してください（例: x + x）';
                algebriteContainer.appendChild(textarea);
                
                const button = document.createElement('button');
                button.textContent = '実行';
                button.onclick = (e) => {
                    e.stopPropagation();
                    this.executeAlgebrite();
                };
                algebriteContainer.appendChild(button);
                
                return algebriteContainer;
            }

            getInputElement() {
                return this.container.querySelector('.palette-algebrite');
            }

            getTextarea() {
                const container = this.getInputElement();
                return container ? container.querySelector('textarea') : null;
            }

            executeAlgebrite() {
                const textarea = this.getTextarea();
                if (!textarea) {
                    console.warn('Textarea not found');
                    return;
                }

                const command = textarea.value.trim();
                if (!command) {
                    console.warn('No command to execute');
                    return;
                }

                try {
                    // Algebriteライブラリの存在確認（複数の可能性をチェック）
                    let AlgebriteLib = null;
                    
                    // 様々な可能性をチェック
                    if (typeof window.Algebrite !== 'undefined') {
                        AlgebriteLib = window.Algebrite;
                        console.log('Found Algebrite at window.Algebrite');
                    } else if (typeof Algebrite !== 'undefined') {
                        AlgebriteLib = Algebrite;
                        console.log('Found Algebrite at global Algebrite');
                    } else if (typeof window.algebrite !== 'undefined') {
                        AlgebriteLib = window.algebrite;
                        console.log('Found Algebrite at window.algebrite');
                    } else {
                        // デバッグ情報を出力
                        console.error('Algebrite library is not loaded');
                        console.log('Checking window object for Algebrite-related properties...');
                        const algeKeys = Object.keys(window).filter(k => 
                            k.toLowerCase().includes('alge') || 
                            k.toLowerCase().includes('algebra')
                        );
                        console.log('Found keys:', algeKeys);
                        if (algeKeys.length > 0) {
                            algeKeys.forEach(key => {
                                console.log(`  ${key}:`, typeof window[key], window[key]);
                            });
                        }
                        textarea.value = 'エラー: Algebriteライブラリが読み込まれていません。\nページを再読み込みするか、ブラウザのコンソールを確認してください。';
                        return;
                    }

                    // runメソッドの確認
                    if (!AlgebriteLib || typeof AlgebriteLib.run !== 'function') {
                        console.error('Algebrite.run is not available');
                        console.log('AlgebriteLib:', AlgebriteLib);
                        console.log('Available methods:', Object.keys(AlgebriteLib || {}));
                        textarea.value = 'エラー: Algebrite.run メソッドが利用できません';
                        return;
                    }

                    // Algebriteで計算を実行
                    const result = AlgebriteLib.run(command);
                    
                    // 結果を文字列に変換
                    let resultString;
                    if (result && typeof result.toString === 'function') {
                        resultString = result.toString();
                    } else if (result && typeof result === 'string') {
                        resultString = result;
                    } else if (result && result.text && typeof result.text === 'string') {
                        resultString = result.text;
                    } else {
                        resultString = String(result);
                    }
                    
                    // テキストエリアの内容を結果で置き換え
                    textarea.value = resultString;
                    console.log(`Algebrite executed: ${command} = ${resultString}`);
                } catch (error) {
                    console.error('Algebrite execution error:', error);
                    console.error('Error stack:', error.stack);
                    textarea.value = `エラー: ${error.message || error.toString()}`;
                }
            }

            rebindButtons() {
                super.rebindButtons();
                // 「実行」ボタンのイベントハンドラーを再設定
                const container = this.getInputElement();
                if (container) {
                    const button = container.querySelector('button');
                    if (button) {
                        button.onclick = (e) => {
                            e.stopPropagation();
                            this.executeAlgebrite();
                        };
                    }
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '300px';
                        this.container.style.height = '150px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 200,
                            minHeight: 100,
                            maxWidth: 800,
                            maxHeight: 500,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized Algebrite container ID: ${this.id}`);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const textarea = this.getTextarea();
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    content: textarea ? textarea.value : ''
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const textarea = this.getTextarea();
                if (textarea && state.hasOwnProperty('content')) {
                    textarea.value = state.content ?? '';
                }
                // ボタンのイベントハンドラーを再設定
                this.rebindButtons();
            }

            static getConfigSelectors() {
                return {
                    configInput: '#algebriteConfig',
                    errorMessage: '#algebriteError',
                    clearFields: ['#algebriteConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteAlgebrite(null, false, customId, customClasses);
                console.log(`Created Algebrite terminal with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // Nerdamer端末クラス
        class PaletteNerdamer extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.init();
            }

            getComponentName() { return 'Nerdamer'; }
            getComponentType() { return 'nerdamer'; }

            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const nerdamerContainer = document.createElement('div');
                nerdamerContainer.className = 'palette-nerdamer';
                
                const textarea = document.createElement('textarea');
                textarea.placeholder = 'Nerdamerの命令を入力してください（例: x + x）';
                nerdamerContainer.appendChild(textarea);
                
                const button = document.createElement('button');
                button.textContent = '実行';
                button.onclick = (e) => {
                    e.stopPropagation();
                    this.executeNerdamer();
                };
                nerdamerContainer.appendChild(button);
                
                return nerdamerContainer;
            }

            getInputElement() {
                return this.container.querySelector('.palette-nerdamer');
            }

            getTextarea() {
                const container = this.getInputElement();
                return container ? container.querySelector('textarea') : null;
            }

            executeNerdamer() {
                const textarea = this.getTextarea();
                if (!textarea) {
                    console.warn('Textarea not found');
                    return;
                }

                const command = textarea.value.trim();
                if (!command) {
                    console.warn('No command to execute');
                    return;
                }

                try {
                    // Nerdamerライブラリの存在確認
                    if (typeof nerdamer === 'undefined' && typeof window.nerdamer === 'undefined') {
                        console.error('Nerdamer library is not loaded');
                        textarea.value = 'エラー: Nerdamerライブラリが読み込まれていません。\nページを再読み込みするか、ブラウザのコンソールを確認してください。';
                        return;
                    }

                    // Nerdamerオブジェクトの取得
                    const NerdamerLib = window.nerdamer || nerdamer;
                    
                    if (!NerdamerLib) {
                        console.error('Nerdamer is not available');
                        textarea.value = 'エラー: Nerdamerが利用できません';
                        return;
                    }

                    // Nerdamerで計算を実行
                    const result = NerdamerLib(command);
                    
                    // 結果を文字列に変換
                    let resultString;
                    if (result && typeof result.toString === 'function') {
                        resultString = result.toString();
                    } else if (result && typeof result === 'string') {
                        resultString = result;
                    } else if (result && result.text && typeof result.text === 'string') {
                        resultString = result.text;
                    } else {
                        resultString = String(result);
                    }
                    
                    // テキストエリアの内容を結果で置き換え
                    textarea.value = resultString;
                    console.log(`Nerdamer executed: ${command} = ${resultString}`);
                } catch (error) {
                    console.error('Nerdamer execution error:', error);
                    console.error('Error stack:', error.stack);
                    textarea.value = `エラー: ${error.message || error.toString()}`;
                }
            }

            rebindButtons() {
                super.rebindButtons();
                // 「実行」ボタンのイベントハンドラーを再設定
                const container = this.getInputElement();
                if (container) {
                    const button = container.querySelector('button');
                    if (button) {
                        button.onclick = (e) => {
                            e.stopPropagation();
                            this.executeNerdamer();
                        };
                    }
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '300px';
                        this.container.style.height = '150px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 200,
                            minHeight: 100,
                            maxWidth: 800,
                            maxHeight: 500,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized Nerdamer container ID: ${this.id}`);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const textarea = this.getTextarea();
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    content: textarea ? textarea.value : ''
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const textarea = this.getTextarea();
                if (textarea && state.hasOwnProperty('content')) {
                    textarea.value = state.content ?? '';
                }
                // ボタンのイベントハンドラーを再設定
                this.rebindButtons();
            }

            static getConfigSelectors() {
                return {
                    configInput: '#nerdamerConfig',
                    errorMessage: '#nerdamerError',
                    clearFields: ['#nerdamerConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteNerdamer(null, false, customId, customClasses);
                console.log(`Created Nerdamer terminal with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // Python端末クラス（PyScript使用）
        class PalettePython extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.outputHistory = []; // 出力履歴を保持
                this.pyodide = null; // Pyodideインスタンス
                this.init();
            }

            getComponentName() { return 'Python'; }
            getComponentType() { return 'python'; }

            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const pythonContainer = document.createElement('div');
                pythonContainer.className = 'palette-python';
                
                // 出力エリア（スクロール可能）
                const outputArea = document.createElement('div');
                outputArea.className = 'python-output-area';
                pythonContainer.appendChild(outputArea);
                
                // 入力エリア
                const inputArea = document.createElement('div');
                inputArea.className = 'python-input-area';
                
                const textarea = document.createElement('textarea');
                textarea.placeholder = 'Pythonの命令を入力してください（例: 2 + 2、from sympy import *）';
                textarea.className = 'python-input';
                inputArea.appendChild(textarea);
                
                const button = document.createElement('button');
                button.textContent = '実行';
                button.className = 'python-execute-button';
                button.onclick = (e) => {
                    e.stopPropagation();
                    this.executePython();
                };
                inputArea.appendChild(button);
                
                pythonContainer.appendChild(inputArea);
                
                return pythonContainer;
            }

            getInputElement() {
                return this.container.querySelector('.palette-python');
            }

            getTextarea() {
                const container = this.getInputElement();
                return container ? container.querySelector('.python-input') : null;
            }

            getOutputArea() {
                const container = this.getInputElement();
                return container ? container.querySelector('.python-output-area') : null;
            }

            async initializePyodide() {
                // Pyodideが既に初期化されている場合はそれを返す
                if (this.pyodide) {
                    return this.pyodide;
                }

                // グローバルなPyodideインスタンスを確認
                if (window.pyodide) {
                    this.pyodide = window.pyodide;
                    // 標準出力のキャプチャ設定がまだの場合は設定
                    if (!this.pyodide._stdout_capture_initialized) {
                        this.pyodide.runPython(`
import sys
from io import StringIO
_stdout_capture = StringIO()
sys.stdout = _stdout_capture
`);
                        this.pyodide._stdout_capture_initialized = true;
                    }
                    // Sympyがインストールされているか確認し、なければインストール
                    if (!this.pyodide._sympy_installed) {
                        try {
                            await this.pyodide.loadPackage('sympy');
                            this.pyodide._sympy_installed = true;
                            console.log('Sympy installed successfully');
                        } catch (error) {
                            console.error('Failed to install Sympy:', error);
                        }
                    }
                    return this.pyodide;
                }

                // Pyodideがまだ読み込まれていない場合は初期化を試みる
                try {
                    if (typeof loadPyodide === 'function') {
                        this.pyodide = await loadPyodide({
                            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
                        });
                        window.pyodide = this.pyodide; // グローバルに保存
                        
                        // 標準出力のキャプチャ設定
                        this.pyodide.runPython(`
import sys
from io import StringIO
_stdout_capture = StringIO()
sys.stdout = _stdout_capture
`);
                        this.pyodide._stdout_capture_initialized = true;
                        
                        // Sympyをインストール
                        try {
                            await this.pyodide.loadPackage('sympy');
                            this.pyodide._sympy_installed = true;
                            console.log('Sympy installed successfully');
                        } catch (error) {
                            console.error('Failed to install Sympy:', error);
                            // Sympyのインストールに失敗しても続行
                        }
                        
                        return this.pyodide;
                    } else {
                        console.error('loadPyodide function is not available');
                        return null;
                    }
                } catch (error) {
                    console.error('Pyodide initialization error:', error);
                    return null;
                }
            }

            async executePython() {
                const textarea = this.getTextarea();
                const outputArea = this.getOutputArea();
                
                if (!textarea || !outputArea) {
                    console.warn('Textarea or output area not found');
                    return;
                }

                const command = textarea.value.trim();
                if (!command) {
                    console.warn('No command to execute');
                    return;
                }

                // 入力コマンドを出力エリアに追加
                const inputDiv = document.createElement('div');
                inputDiv.className = 'python-output-line python-input-line';
                inputDiv.textContent = `>>> ${command}`;
                outputArea.appendChild(inputDiv);

                // Pyodideを初期化
                const pyodide = await this.initializePyodide();
                if (!pyodide) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'python-output-line python-error-line';
                    errorDiv.textContent = 'エラー: Pyodideが読み込まれていません。PyScriptライブラリを確認してください。';
                    outputArea.appendChild(errorDiv);
                    outputArea.scrollTop = outputArea.scrollHeight;
                    return;
                }

                try {
                    // 標準出力をクリア（前回の出力をリセット）
                    pyodide.runPython('_stdout_capture.seek(0); _stdout_capture.truncate(0)');
                    
                    // Pythonコードを実行
                    const result = pyodide.runPython(command);
                    
                    // 標準出力を取得
                    const stdout = pyodide.runPython('_stdout_capture.getvalue()');
                    
                    // 標準出力がある場合は表示
                    if (stdout && stdout.trim()) {
                        const stdoutDiv = document.createElement('div');
                        stdoutDiv.className = 'python-output-line python-result-line';
                        stdoutDiv.textContent = stdout.trim();
                        outputArea.appendChild(stdoutDiv);
                    }
                    
                    // 結果がある場合は表示（式の評価結果）
                    if (result !== undefined && result !== null) {
                        const resultDiv = document.createElement('div');
                        resultDiv.className = 'python-output-line python-result-line';
                        
                        // 結果を文字列に変換
                        let resultText = '';
                        if (typeof result === 'object' && result.toString) {
                            resultText = result.toString();
                        } else {
                            resultText = String(result);
                        }
                        resultDiv.textContent = resultText;
                        outputArea.appendChild(resultDiv);
                    }
                    
                    // 履歴に追加
                    const outputText = (stdout ? stdout.trim() + '\n' : '') + 
                                      (result !== undefined && result !== null ? String(result) : '');
                    this.outputHistory.push({
                        input: command,
                        output: outputText.trim() || '',
                        timestamp: new Date()
                    });
                    
                    // 実行結果を入力テキストエリアに書き込む
                    // 優先順位: 式の評価結果 > 標準出力
                    let resultToDisplay = '';
                    if (result !== undefined && result !== null) {
                        // 式の評価結果がある場合
                        if (typeof result === 'object' && result.toString) {
                            resultToDisplay = result.toString();
                        } else {
                            resultToDisplay = String(result);
                        }
                    } else if (stdout && stdout.trim()) {
                        // 標準出力がある場合
                        resultToDisplay = stdout.trim();
                    }
                    
                    // 結果がある場合は入力テキストエリアに書き込む、ない場合はクリア
                    if (resultToDisplay) {
                        textarea.value = resultToDisplay;
                    } else {
                        textarea.value = '';
                    }
                    
                    // スクロールを最下部に
                    outputArea.scrollTop = outputArea.scrollHeight;
                    
                    console.log(`Python executed: ${command}`);
                } catch (error) {
                    console.error('Python execution error:', error);
                    
                    // エラー発生時も標準出力があれば表示
                    try {
                        const stdout = pyodide.runPython('_stdout_capture.getvalue()');
                        if (stdout && stdout.trim()) {
                            const stdoutDiv = document.createElement('div');
                            stdoutDiv.className = 'python-output-line python-result-line';
                            stdoutDiv.textContent = stdout.trim();
                            outputArea.appendChild(stdoutDiv);
                        }
                    } catch (e) {
                        // 標準出力の取得に失敗した場合は無視
                    }
                    
                    // エラーを出力エリアに追加
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'python-output-line python-error-line';
                    errorDiv.textContent = `エラー: ${error.message || error.toString()}`;
                    outputArea.appendChild(errorDiv);
                    
                    // 履歴に追加
                    this.outputHistory.push({
                        input: command,
                        output: `エラー: ${error.message || error.toString()}`,
                        timestamp: new Date(),
                        isError: true
                    });
                    
                    // スクロールを最下部に
                    outputArea.scrollTop = outputArea.scrollHeight;
                }
            }

            rebindButtons() {
                super.rebindButtons();
                // 「実行」ボタンのイベントハンドラーを再設定
                const container = this.getInputElement();
                if (container) {
                    const button = container.querySelector('.python-execute-button');
                    if (button) {
                        button.onclick = (e) => {
                            e.stopPropagation();
                            this.executePython();
                        };
                    }
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '400px';
                        this.container.style.height = '300px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 300,
                            minHeight: 200,
                            maxWidth: 1000,
                            maxHeight: 800,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized Python container ID: ${this.id}`);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const textarea = this.getTextarea();
                const outputArea = this.getOutputArea();
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    inputContent: textarea ? textarea.value : '',
                    outputHistory: this.outputHistory
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                
                const textarea = this.getTextarea();
                if (state.inputContent && textarea) {
                    textarea.value = state.inputContent;
                }
                
                // 出力履歴を復元
                if (state.outputHistory && Array.isArray(state.outputHistory)) {
                    this.outputHistory = state.outputHistory;
                    const outputArea = this.getOutputArea();
                    if (outputArea) {
                        outputArea.innerHTML = '';
                        state.outputHistory.forEach(item => {
                            const inputDiv = document.createElement('div');
                            inputDiv.className = 'python-output-line python-input-line';
                            inputDiv.textContent = `>>> ${item.input}`;
                            outputArea.appendChild(inputDiv);
                            
                            if (item.output) {
                                const resultDiv = document.createElement('div');
                                resultDiv.className = item.isError 
                                    ? 'python-output-line python-error-line' 
                                    : 'python-output-line python-result-line';
                                resultDiv.textContent = item.output;
                                outputArea.appendChild(resultDiv);
                            }
                        });
                        outputArea.scrollTop = outputArea.scrollHeight;
                    }
                }
                
                // ボタンのイベントハンドラーを再設定
                this.rebindButtons();
            }

            static getConfigSelectors() {
                return {
                    configInput: '#pythonConfig',
                    errorMessage: '#pythonError',
                    clearFields: ['#pythonConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PalettePython(null, false, customId, customClasses);
                console.log(`Created Python terminal with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // Xterm.js Terminalコンポーネントクラス
        class PaletteTerminal extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], connectionInfo = null) {
                super(container, isChild, customId, customClasses);
                this.connectionInfo = connectionInfo || {
                    host: '',
                    protocol: 'telnet',
                    sshVersion: 'ssh2',
                    port: '',
                    username: '',
                    password: '',
                    proxyUrl: 'ws://localhost:8022'
                };
                this.term = null;
                this.fitAddon = null;
                this.ws = null;
                this._outputCallback = null;
                this._outputBuffer = '';
                this._outputTimer = null;
                this._outputQuietMs = 500;
                this._consoleTargets = new Set();
                this.init();
                this.initializeTerminal();
            }

            getComponentName() { return 'Terminal'; }
            getComponentType() { return 'terminal'; }

            getTitleInfo() {
                let info = '';
                if (this.connectionInfo && this.connectionInfo.host) {
                    const proto = (this.connectionInfo.protocol || 'telnet').toUpperCase();
                    info += ` ${proto}://${this.connectionInfo.host}`;
                    if (this.connectionInfo.port) {
                        info += `:${this.connectionInfo.port}`;
                    }
                }
                const parentInfo = super.getTitleInfo();
                return info + parentInfo;
            }

            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const terminalContainer = document.createElement('div');
                terminalContainer.className = 'palette-terminal';

                const xtermDiv = document.createElement('div');
                xtermDiv.className = 'xterm-container';
                terminalContainer.appendChild(xtermDiv);

                return terminalContainer;
            }

            getInputElement() {
                return this.container.querySelector('.palette-terminal');
            }

            getTerminalElement() {
                const container = this.getInputElement();
                return container ? container.querySelector('.xterm-container') : null;
            }

            initializeTerminal() {
                const TerminalClass = window.Terminal || (window.xterm && window.xterm.Terminal);
                const FitAddonClass = window.FitAddon && window.FitAddon.FitAddon;
                const target = this.getTerminalElement();

                if (!TerminalClass || !target) {
                    console.warn('Xterm.js がロードされていないか、ターゲット要素が見つかりません。');
                    return;
                }

                this.term = new TerminalClass({
                    cursorBlink: true,
                    fontSize: 13,
                    theme: {
                        background: '#1e1e1e',
                        foreground: '#d4d4d4',
                    }
                });

                if (FitAddonClass) {
                    this.fitAddon = new FitAddonClass();
                    this.term.loadAddon(this.fitAddon);
                }

                this.term.open(target);

                if (this.fitAddon) {
                    try { this.fitAddon.fit(); } catch (e) {}
                }

                const info = this.connectionInfo || {};
                const protocolLabel = (info.protocol || 'telnet').toUpperCase();
                const hostLabel = info.host || '(未指定)';
                const portLabel = info.port || (info.protocol === 'ssh' ? '22' : '23');

                this.term.writeln(`接続先: ${protocolLabel}://${hostLabel}:${portLabel}`);
                this.term.writeln('接続中...');
                this.term.writeln('');

                this.connectToProxy();
            }

            connectToProxy() {
                const info = this.connectionInfo || {};
                const proxyUrl = info.proxyUrl || 'ws://localhost:8022';

                try {
                    this.ws = new WebSocket(proxyUrl);
                } catch (e) {
                    this.term.writeln(`\r\n*** WebSocket作成エラー: ${e.message} ***`);
                    this.term.writeln('*** terminal_proxy.js が起動しているか確認してください ***');
                    return;
                }

                this.ws.onopen = () => {
                    const connectMsg = {
                        protocol: info.protocol || 'telnet',
                        host: info.host || '',
                        port: info.port || (info.protocol === 'ssh' ? '22' : '23'),
                        username: info.username || '',
                        password: info.password || '',
                        sshVersion: info.sshVersion || 'ssh2',
                    };
                    this.ws.send(JSON.stringify(connectMsg));
                };

                this.ws.onmessage = (event) => {
                    if (this.term) {
                        this.term.write(event.data);
                    }
                    if (this._consoleTargets && this._consoleTargets.size > 0) {
                        const cleanText = event.data
                            .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
                            .replace(/\x1b\][^\x07]*\x07/g, '')
                            .replace(/\x1b\([A-B0-2]/g, '')
                            .replace(/\x1b[>=<]/g, '')
                            .replace(/[\x00-\x08\x0e-\x1f\x7f]/g, '');
                        this._consoleTargets.forEach(targetId => {
                            const targetEl = document.getElementById(targetId);
                            if (targetEl) {
                                const inst = $(targetEl).data('instance');
                                const ta = inst && inst.getInputElement ? inst.getInputElement() : null;
                                const textarea = (ta && ta.tagName === 'TEXTAREA') ? ta : targetEl.querySelector('textarea');
                                if (textarea) {
                                    textarea.value += cleanText;
                                    textarea.scrollTop = textarea.scrollHeight;
                                }
                            }
                        });
                    }
                    if (this._outputCallback) {
                        this._outputBuffer += event.data;
                        clearTimeout(this._outputTimer);
                        this._outputTimer = setTimeout(() => {
                            const cb = this._outputCallback;
                            const buf = this._outputBuffer;
                            this._outputCallback = null;
                            this._outputBuffer = '';
                            this._outputTimer = null;
                            cb(buf);
                        }, this._outputQuietMs || 500);
                    }
                };

                this.ws.onclose = () => {
                    if (this.term) {
                        this.term.writeln('\r\n*** 接続が切断されました ***');
                    }
                    this.ws = null;
                };

                this.ws.onerror = (err) => {
                    if (this.term) {
                        this.term.writeln('\r\n*** プロキシサーバーに接続できません ***');
                        this.term.writeln('*** 以下のコマンドでプロキシを起動してください: ***');
                        this.term.writeln('***   node terminal_proxy.js                    ***');
                    }
                    console.error('WebSocket error:', err);
                };

                this.term.onData((data) => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(data);
                    }
                });
            }

            disconnectProxy() {
                if (this.ws) {
                    try { this.ws.close(); } catch (e) {}
                    this.ws = null;
                }
            }

            fitTerminal() {
                if (this.fitAddon) {
                    try { this.fitAddon.fit(); } catch (e) {}
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '600px';
                        this.container.style.height = '400px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 300,
                            minHeight: 200,
                            maxWidth: 1200,
                            maxHeight: 800,
                            stop: () => {
                                console.log(`Resized Terminal container ID: ${this.id}`);
                                this.fitTerminal();
                            }
                        });
                        console.log(`Resizable initialized for Terminal container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                    }
                }
            }

            serializeState() {
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    host: this.connectionInfo.host,
                    protocol: this.connectionInfo.protocol,
                    sshVersion: this.connectionInfo.sshVersion,
                    port: this.connectionInfo.port,
                    proxyUrl: this.connectionInfo.proxyUrl
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                this.connectionInfo = {
                    host: state.host || '',
                    protocol: state.protocol || 'telnet',
                    sshVersion: state.sshVersion || 'ssh2',
                    port: state.port || '',
                    username: '',
                    password: '',
                    proxyUrl: state.proxyUrl || 'ws://localhost:8022'
                };
            }

            static getConfigSelectors() {
                return {
                    configInput: '#terminalConfig',
                    errorMessage: '#terminalError',
                    additionalInputs: [
                        { id: 'terminalHost', selector: '#terminalHost' },
                        { id: 'terminalProtocol', selector: '#terminalProtocol' },
                        { id: 'terminalSshVersion', selector: '#terminalSshVersion' },
                        { id: 'terminalPort', selector: '#terminalPort' },
                        { id: 'terminalUsername', selector: '#terminalUsername' },
                        { id: 'terminalPassword', selector: '#terminalPassword' },
                        { id: 'terminalProxyUrl', selector: '#terminalProxyUrl' }
                    ],
                    clearFields: ['#terminalConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                const ai = additionalInputs || {};
                let customId = null;
                let customClasses = [];

                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }

                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }

                const connectionInfo = {
                    host:       (ai.terminalHost       || $('#terminalHost').val()       || '').trim(),
                    protocol:   (ai.terminalProtocol   || $('#terminalProtocol').val()   || 'telnet').toLowerCase(),
                    sshVersion: (ai.terminalSshVersion || $('#terminalSshVersion').val() || 'ssh2').toLowerCase(),
                    port:       (ai.terminalPort       || $('#terminalPort').val()       || '').trim(),
                    username:   (ai.terminalUsername   || $('#terminalUsername').val()   || '').trim(),
                    password:   (ai.terminalPassword   || $('#terminalPassword').val()   || ''),
                    proxyUrl:   (ai.terminalProxyUrl   || $('#terminalProxyUrl').val()   || 'ws://localhost:8022').trim()
                };

                const instance = new PaletteTerminal(null, false, customId, customClasses, connectionInfo);
                console.log('Created Terminal component with connection info:', connectionInfo, 'ID:', instance.id);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }

            /**
             * 指定IDのTerminalコンポーネントにキーボード入力として文字列を送信する
             * @param {string} idname - TerminalコンポーネントのID
             * @param {string} string - 送信する文字列
             */
            static KeyboardInput(idname, string) {
                const container = document.getElementById(idname);
                if (!container) {
                    console.warn(`PaletteTerminal.KeyboardInput: ID "${idname}" のコンポーネントが見つかりません。`);
                    return;
                }
                const instance = $(container).data('instance');
                if (!instance || instance.getComponentType() !== 'terminal') {
                    console.warn(`PaletteTerminal.KeyboardInput: ID "${idname}" はTerminalコンポーネントではありません。`);
                    return;
                }
                if (instance.ws && instance.ws.readyState === WebSocket.OPEN) {
                    instance.ws.send(string);
                } else {
                    console.warn(`PaletteTerminal.KeyboardInput: ID "${idname}" のWebSocket接続が開いていません。`);
                }
            }

            /**
             * Terminal端末の出力を Textarea コンポーネントにも転送する
             * @param {string} idname1 - TerminalコンポーネントのID
             * @param {string} idname2 - 出力先のTextareaコンポーネントのID
             */
            static SetConsole(idname1, idname2) {
                const container = document.getElementById(idname1);
                if (!container) {
                    console.warn(`PaletteTerminal.SetConsole: ID "${idname1}" のコンポーネントが見つかりません。`);
                    return;
                }
                const instance = $(container).data('instance');
                if (!instance || instance.getComponentType() !== 'terminal') {
                    console.warn(`PaletteTerminal.SetConsole: ID "${idname1}" はTerminalコンポーネントではありません。`);
                    return;
                }
                const target = document.getElementById(idname2);
                if (!target) {
                    console.warn(`PaletteTerminal.SetConsole: ID "${idname2}" のコンポーネントが見つかりません。`);
                    return;
                }
                instance._consoleTargets.add(idname2);
                console.log(`PaletteTerminal.SetConsole: "${idname1}" の出力を "${idname2}" にも転送します。`);
            }

            /**
             * Textarea コンポーネントへの出力転送を停止する
             * @param {string} idname1 - TerminalコンポーネントのID
             * @param {string} idname2 - 転送を停止するTextareaコンポーネントのID
             */
            static UnsetConsole(idname1, idname2) {
                const container = document.getElementById(idname1);
                if (!container) {
                    console.warn(`PaletteTerminal.UnsetConsole: ID "${idname1}" のコンポーネントが見つかりません。`);
                    return;
                }
                const instance = $(container).data('instance');
                if (!instance || instance.getComponentType() !== 'terminal') {
                    console.warn(`PaletteTerminal.UnsetConsole: ID "${idname1}" はTerminalコンポーネントではありません。`);
                    return;
                }
                instance._consoleTargets.delete(idname2);
                console.log(`PaletteTerminal.UnsetConsole: "${idname1}" から "${idname2}" への出力転送を停止しました。`);
            }

            /**
             * コマンドを送信し、端末からの出力を Promise で返す。
             * 出力が quietMs ミリ秒途切れたら「完了」と見なして resolve する。
             *
             * @param {string} idname   - TerminalコンポーネントのID
             * @param {string} command  - 送信するコマンド（末尾に \n を付けると Enter 扱い）
             * @param {number} [quietMs=500] - 出力が途切れてから完了と見なすまでの待ち時間(ms)
             * @returns {Promise<string>} 端末からの出力文字列
             *
             * 使用例:
             *   const output = await PaletteTerminal.SendCommand('myTerm', 'ls -la\n');
             *   console.log(output);
             */
            static SendCommand(idname, command, quietMs = 500) {
                return new Promise((resolve, reject) => {
                    const container = document.getElementById(idname);
                    if (!container) {
                        reject(new Error(`ID "${idname}" のコンポーネントが見つかりません。`));
                        return;
                    }
                    const instance = $(container).data('instance');
                    if (!instance || instance.getComponentType() !== 'terminal') {
                        reject(new Error(`ID "${idname}" はTerminalコンポーネントではありません。`));
                        return;
                    }
                    if (!instance.ws || instance.ws.readyState !== WebSocket.OPEN) {
                        reject(new Error(`ID "${idname}" のWebSocket接続が開いていません。`));
                        return;
                    }

                    instance._outputBuffer = '';
                    instance._outputQuietMs = quietMs;
                    instance._outputCallback = (output) => {
                        const cleaned = output
                            .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
                            .replace(/\x1b\][^\x07]*\x07/g, '')
                            .replace(/\x1b\([A-B0-2]/g, '')
                            .replace(/\x1b[>=<]/g, '')
                            .replace(/[\x00-\x08\x0e-\x1f\x7f]/g, '');
                        resolve(cleaned);
                    };

                    instance.ws.send(command);
                });
            }
        }

        // ファイル転送コンポーネントクラス
        class PaletteFileTransfer extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], connectionInfo = null) {
                super(container, isChild, customId, customClasses);
                this.connectionInfo = connectionInfo || {
                    host: '', folder: '.', username: '', password: '', proxyUrl: 'ws://localhost:8022'
                };
                this.ws = null;
                this.currentPath = this.connectionInfo.folder || '.';
                this.entries = [];
                this._uploadQueue = [];
                this._uploadIndex = 0;
                this._uploadTotal = 0;
                this._uploadCompleted = 0;
                this._dirsToCreate = [];
                this._mkdirIndex = 0;
                this._mkdirTotal = 0;
                this._mkdirCompleted = 0;
                this.init();
                this.connectSFTP();
            }

            getComponentName() { return 'FileTransfer'; }
            getComponentType() { return 'filetransfer'; }

            getTitleInfo() {
                const host = this.connectionInfo?.host;
                return (host ? ` SFTP://${host}` : '') + super.getTitleInfo();
            }

            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            _createButton(text, title, onClick) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = text;
                if (title) btn.title = title;
                btn.addEventListener('click', onClick);
                return btn;
            }

            _createHiddenFileInput(attrs, onChange) {
                const input = document.createElement('input');
                input.type = 'file';
                input.style.display = 'none';
                for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);
                input.addEventListener('change', () => {
                    if (input.files.length > 0) {
                        const files = Array.from(input.files);
                        input.value = '';
                        onChange(files);
                    }
                });
                return input;
            }

            createInputElement() {
                const wrapper = document.createElement('div');
                wrapper.className = 'palette-filetransfer';

                const toolbar = document.createElement('div');
                toolbar.className = 'ft-toolbar';
                toolbar.appendChild(this._createButton('↑ 上へ', null, () => this.navigateUp()));
                toolbar.appendChild(this._createButton('🔄', '再読み込み', () => this.listDirectory(this.currentPath)));

                const fileInput = this._createHiddenFileInput({ multiple: '' }, files => this.uploadFiles(files, false));
                const folderInput = this._createHiddenFileInput({ webkitdirectory: '', directory: '' }, files => this.uploadFiles(files, true));
                wrapper.append(fileInput, folderInput);

                toolbar.appendChild(this._createButton('📎 ファイル', 'ファイルをアップロード', () => fileInput.click()));
                toolbar.appendChild(this._createButton('📂 フォルダ', 'フォルダをアップロード', () => folderInput.click()));

                const pathBar = document.createElement('div');
                pathBar.className = 'ft-path-bar';
                toolbar.appendChild(pathBar);
                wrapper.appendChild(toolbar);

                const header = document.createElement('div');
                header.className = 'ft-header';
                header.innerHTML = '<span class="ft-header-name">名前</span><span class="ft-header-size">サイズ</span><span class="ft-header-date">更新日時</span>';
                wrapper.appendChild(header);

                const fileList = document.createElement('div');
                fileList.className = 'ft-file-list';
                wrapper.appendChild(fileList);

                const status = document.createElement('div');
                status.className = 'ft-status';
                status.textContent = '接続中...';
                wrapper.appendChild(status);

                return wrapper;
            }

            getInputElement() {
                return this.container.querySelector('.palette-filetransfer');
            }

            _isConnected() {
                return this.ws && this.ws.readyState === WebSocket.OPEN;
            }

            _send(obj) {
                if (this._isConnected()) this.ws.send(JSON.stringify(obj));
            }

            connectSFTP() {
                const info = this.connectionInfo;
                try {
                    this.ws = new WebSocket(info.proxyUrl || 'ws://localhost:8022');
                } catch (e) {
                    this.setStatus('WebSocket作成エラー: ' + e.message);
                    return;
                }

                this.ws.onopen = () => {
                    this._send({
                        protocol: 'sftp', host: info.host || '', port: '22',
                        username: info.username || '', password: info.password || '', folder: info.folder || '.'
                    });
                };
                this.ws.onmessage = (event) => {
                    try { this.handleMessage(JSON.parse(event.data)); } catch (e) {}
                };
                this.ws.onclose = () => { this.setStatus('切断されました'); this.ws = null; };
                this.ws.onerror = () => { this.setStatus('プロキシに接続できません。node terminal_proxy.js を起動してください。'); };
            }

            handleMessage(msg) {
                switch (msg.type) {
                    case 'connected':
                        this.setStatus('接続しました');
                        this.listDirectory(msg.path || this.currentPath);
                        break;
                    case 'list':
                        this.currentPath = msg.path;
                        this.entries = msg.entries || [];
                        this.renderFileList();
                        this.renderPathBar();
                        this.setStatus(this.entries.length + ' 個のアイテム');
                        break;
                    case 'download':
                        this._triggerBrowserDownload(msg.filename, msg.data);
                        break;
                    case 'delete-done':
                        this.setStatus('削除完了');
                        this.listDirectory(this.currentPath);
                        break;
                    case 'upload-done':
                    case 'mkdir-done':
                        this._handleUploadProgress(msg.type);
                        break;
                    case 'error':
                        this._handleError(msg);
                        break;
                    case 'disconnected':
                        this.setStatus('接続が切断されました');
                        break;
                }
            }

            _handleUploadProgress(type) {
                if (type === 'mkdir-done') {
                    this._mkdirCompleted++;
                    if (this._mkdirCompleted < this._mkdirTotal) {
                        this._sendNextMkdir();
                    } else {
                        this._startSequentialUpload();
                    }
                    return;
                }
                this._uploadCompleted++;
                this.setStatus('アップロード中: ' + this._uploadCompleted + '/' + this._uploadTotal);
                this._advanceUploadOrFinish();
            }

            _handleError(msg) {
                if (msg.action === 'upload') {
                    this._uploadCompleted++;
                    this._advanceUploadOrFinish(true);
                } else if (msg.action === 'mkdir') {
                    this._mkdirCompleted++;
                    if (this._mkdirCompleted < this._mkdirTotal) {
                        this._sendNextMkdir();
                    } else {
                        this._startSequentialUpload();
                    }
                } else {
                    this.setStatus('エラー: ' + msg.message);
                }
            }

            _advanceUploadOrFinish(hadError = false) {
                if (this._uploadCompleted >= this._uploadTotal) {
                    this.setStatus('アップロード完了' + (hadError ? ' (一部エラーあり)' : ' (' + this._uploadCompleted + ' ファイル)'));
                    this._resetUploadState();
                    this.listDirectory(this.currentPath);
                } else {
                    this._uploadIndex++;
                    this._uploadNextFile();
                }
            }

            _resetUploadState() {
                this._uploadQueue = [];
                this._uploadIndex = 0;
                this._uploadTotal = 0;
                this._uploadCompleted = 0;
            }

            listDirectory(dirPath) {
                if (!this._isConnected()) { this.setStatus('未接続です'); return; }
                this.setStatus('読み込み中...');
                const listEl = this.container.querySelector('.ft-file-list');
                if (listEl) listEl.innerHTML = '<div class="ft-loading">読み込み中...</div>';
                this._send({ action: 'list', path: dirPath });
            }

            renderFileList() {
                const listEl = this.container.querySelector('.ft-file-list');
                if (!listEl) return;
                listEl.innerHTML = '';

                for (const entry of this.entries) {
                    const row = document.createElement('div');
                    row.className = 'ft-item';

                    row.innerHTML =
                        `<span class="ft-item-icon">${entry.isDir ? '📁' : '📄'}</span>` +
                        `<span class="ft-item-name${entry.isDir ? ' ft-is-dir' : ''}">${this._escapeHtml(entry.name)}</span>` +
                        `<span class="ft-item-size">${entry.isDir ? '' : this.formatSize(entry.size)}</span>` +
                        `<span class="ft-item-date">${entry.mtime ? this.formatDate(entry.mtime) : ''}</span>`;

                    if (entry.isDir) {
                        row.addEventListener('click', () => this.listDirectory(this.joinPath(this.currentPath, entry.name)));
                    }
                    row.addEventListener('contextmenu', (e) => { e.preventDefault(); this.showContextMenu(e.clientX, e.clientY, entry); });
                    listEl.appendChild(row);
                }
            }

            _escapeHtml(str) {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            }

            renderPathBar() {
                const pathBar = this.container.querySelector('.ft-path-bar');
                if (!pathBar) return;
                pathBar.innerHTML = '';

                const parts = this.currentPath.split('/').filter(Boolean);
                const isAbsolute = this.currentPath.startsWith('/');

                const addClickableSpan = (text, targetPath, className) => {
                    if (className) {
                        const span = document.createElement('span');
                        span.className = className;
                        span.textContent = text;
                        pathBar.appendChild(span);
                    } else {
                        const span = document.createElement('span');
                        span.textContent = text;
                        span.addEventListener('click', () => this.listDirectory(targetPath));
                        pathBar.appendChild(span);
                    }
                };

                addClickableSpan(isAbsolute ? '/' : '~', isAbsolute ? '/' : '.');
                parts.forEach((part, idx) => {
                    addClickableSpan('/', null, 'ft-path-sep');
                    const target = isAbsolute ? '/' + parts.slice(0, idx + 1).join('/') : parts.slice(0, idx + 1).join('/');
                    addClickableSpan(part, target);
                });
            }

            showContextMenu(x, y, entry) {
                this.removeContextMenu();
                const menu = document.createElement('div');
                menu.className = 'ft-context-menu';
                menu.style.left = x + 'px';
                menu.style.top = y + 'px';

                const addItem = (text, handler) => {
                    const item = document.createElement('div');
                    item.className = 'ft-ctx-item';
                    item.textContent = text;
                    item.addEventListener('click', () => { handler(); this.removeContextMenu(); });
                    menu.appendChild(item);
                };

                const entryPath = this.joinPath(this.currentPath, entry.name);

                if (entry.isDir) {
                    addItem('開く', () => this.listDirectory(entryPath));
                    addItem('ダウンロード (tar.gz)', () => { this.setStatus('フォルダをダウンロード中...'); this._send({ action: 'download-dir', path: entryPath }); });
                    addItem('削除', () => { if (confirm(entry.name + ' フォルダとその中身を全て削除しますか？')) { this.setStatus('フォルダを削除中...'); this._send({ action: 'delete-dir', path: entryPath }); } });
                } else {
                    addItem('ダウンロード', () => { this.setStatus('ダウンロード中: ' + entry.name); this._send({ action: 'download', path: entryPath }); });
                    addItem('削除', () => { if (confirm(entry.name + ' を削除しますか？')) { this.setStatus('削除中...'); this._send({ action: 'delete', path: entryPath }); } });
                }

                document.body.appendChild(menu);
                setTimeout(() => {
                    const closeHandler = (e) => {
                        if (!menu.contains(e.target)) { this.removeContextMenu(); document.removeEventListener('click', closeHandler); }
                    };
                    document.addEventListener('click', closeHandler);
                }, 0);
            }

            removeContextMenu() {
                document.querySelectorAll('.ft-context-menu').forEach(m => m.remove());
            }

            _triggerBrowserDownload(filename, base64Data) {
                const binary = atob(base64Data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = Object.assign(document.createElement('a'), { href: url, download: filename });
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.setStatus('ダウンロード完了: ' + filename);
            }

            uploadFiles(files, isFolder) {
                if (!this._isConnected()) { this.setStatus('未接続です'); return; }
                if (files.length === 0) return;

                this._uploadQueue = [];
                this._uploadTotal = files.length;
                this._uploadCompleted = 0;

                const dirsToCreate = new Set();

                for (const file of files) {
                    const relativePath = (isFolder && file.webkitRelativePath) ? file.webkitRelativePath : file.name;
                    const remotePath = this.joinPath(this.currentPath, relativePath);

                    const dirParts = relativePath.split('/');
                    dirParts.pop();
                    if (dirParts.length > 0) {
                        let accumulated = this.currentPath;
                        for (const part of dirParts) {
                            accumulated = this.joinPath(accumulated, part);
                            dirsToCreate.add(accumulated);
                        }
                    }
                    this._uploadQueue.push({ file, remotePath });
                }

                this._dirsToCreate = [...dirsToCreate].sort((a, b) => a.length - b.length);
                this._mkdirTotal = this._dirsToCreate.length;
                this._mkdirCompleted = 0;
                this._mkdirIndex = 0;

                this.setStatus('アップロード準備中...');
                this._dirsToCreate.length > 0 ? this._sendNextMkdir() : this._startSequentialUpload();
            }

            _sendNextMkdir() {
                if (this._mkdirIndex < this._dirsToCreate.length) {
                    this._send({ action: 'mkdir', path: this._dirsToCreate[this._mkdirIndex++] });
                }
            }

            _startSequentialUpload() {
                if (this._uploadQueue.length === 0) return;
                this._uploadIndex = 0;
                this.setStatus('アップロード中: 0/' + this._uploadTotal);
                this._uploadNextFile();
            }

            _uploadNextFile() {
                if (this._uploadIndex >= this._uploadQueue.length) return;
                const { file, remotePath } = this._uploadQueue[this._uploadIndex];

                const reader = new FileReader();
                reader.onload = () => {
                    const bytes = new Uint8Array(reader.result);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i += 8192) {
                        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
                    }
                    try {
                        this._send({ action: 'upload', path: remotePath, data: btoa(binary) });
                    } catch (e) {
                        console.error('Upload send error:', e);
                        this.setStatus('送信エラー: ' + e.message);
                    }
                };
                reader.onerror = () => {
                    this._uploadCompleted++;
                    this._advanceUploadOrFinish(true);
                };
                reader.readAsArrayBuffer(file);
            }

            navigateUp() {
                if (this.currentPath === '/' || this.currentPath === '.') return;
                const parts = this.currentPath.split('/').filter(Boolean);
                parts.pop();
                this.listDirectory(this.currentPath.startsWith('/') ? '/' + parts.join('/') : (parts.join('/') || '.'));
            }

            joinPath(base, child) {
                if (!base || base === '.') return child;
                return base.endsWith('/') ? base + child : base + '/' + child;
            }

            setStatus(text) {
                const el = this.container.querySelector('.ft-status');
                if (el) el.textContent = text;
            }

            formatSize(bytes) {
                if (bytes == null) return '';
                const units = ['B', 'KB', 'MB', 'GB'];
                let i = 0;
                while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
                return (i === 0 ? bytes : bytes.toFixed(1)) + ' ' + units[i];
            }

            formatDate(timestamp) {
                const d = new Date(timestamp);
                const p = n => String(n).padStart(2, '0');
                return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
            }

            disconnectProxy() {
                if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '500px';
                        this.container.style.height = '400px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 300,
                            minHeight: 200,
                            maxWidth: 1200,
                            maxHeight: 800,
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            resize: (event, ui) => {
                                restoreCanvasOnResize(this.container);
                            },
                            stop: () => {
                                restoreCanvasOnResizeStop(this.container);
                            }
                        });
                    } else {
                        $(this.container).resizable('enable');
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                    }
                }
            }

            serializeState() {
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    host: this.connectionInfo.host,
                    folder: this.connectionInfo.folder,
                    proxyUrl: this.connectionInfo.proxyUrl
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                this.connectionInfo = {
                    host: state.host || '',
                    folder: state.folder || '.',
                    username: '',
                    password: '',
                    proxyUrl: state.proxyUrl || 'ws://localhost:8022'
                };
            }

            static getConfigSelectors() {
                return {
                    configInput: '#filetransferConfig',
                    errorMessage: '#filetransferError',
                    additionalInputs: [
                        { id: 'ftHost', selector: '#ftHost' },
                        { id: 'ftFolder', selector: '#ftFolder' },
                        { id: 'ftUsername', selector: '#ftUsername' },
                        { id: 'ftPassword', selector: '#ftPassword' },
                        { id: 'ftProxyUrl', selector: '#ftProxyUrl' }
                    ],
                    clearFields: ['#filetransferConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                const ai = additionalInputs || {};
                let customId = null;
                let customClasses = [];

                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }

                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }

                const connectionInfo = {
                    host:     (ai.ftHost     || $('#ftHost').val()     || '').trim(),
                    folder:   (ai.ftFolder   || $('#ftFolder').val()   || '.').trim(),
                    username: (ai.ftUsername  || $('#ftUsername').val()  || '').trim(),
                    password: (ai.ftPassword || $('#ftPassword').val() || ''),
                    proxyUrl: (ai.ftProxyUrl || $('#ftProxyUrl').val() || 'ws://localhost:8022').trim()
                };

                const instance = new PaletteFileTransfer(null, false, customId, customClasses, connectionInfo);
                console.log('Created FileTransfer component:', {host: connectionInfo.host, folder: connectionInfo.folder, username: connectionInfo.username}, 'ID:', instance.id);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // TeX数式表示コンポーネントクラス
        class PaletteTeXDisplay extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], parentTexNumber = null) {
                super(container, isChild, customId, customClasses);
                this.texSource = '';
                this.parentTexNumber = parentTexNumber; // 親のTeX番号を保持
                this.init();
            }

            getComponentName() { return 'TeX表示'; }
            getComponentType() { return 'tex-display'; }

            getTitleInfo() {
                let info = '';
                if (this.parentTexNumber !== null) {
                    info += ` #${this.parentTexNumber}`;
                }
                // 親クラスのgetTitleInfo()の結果も追加
                const parentInfo = super.getTitleInfo();
                return info + parentInfo;
            }

            updateTitleBar() {
                const titleElement = this.container.querySelector('.palette-top .title');
                if (titleElement) {
                    titleElement.textContent = this.getComponentName() + this.getTitleInfo();
                }
            }

            createChildComponent() {
                return null; // 子コンポーネントなし
            }

            createInputElement() {
                const container = document.createElement('div');
                container.className = 'palette-tex-display';
                const displayArea = document.createElement('div');
                displayArea.className = 'tex-display-area';
                container.appendChild(displayArea);
                return container;
            }

            getInputElement() {
                return this.container.querySelector('.tex-display-area');
            }

            renderTeX(texSource) {
                const displayArea = this.getInputElement();
                
                if (!displayArea) {
                    console.warn('Display area not found');
                    return;
                }

                if (!texSource || texSource.trim() === '') {
                    displayArea.innerHTML = '';
                    return;
                }

                try {
                    // KaTeXライブラリの存在確認
                    if (typeof katex === 'undefined' && typeof window.katex === 'undefined') {
                        console.error('KaTeX library is not loaded');
                        displayArea.innerHTML = '<span style="color: red;">エラー: KaTeXライブラリが読み込まれていません</span>';
                        return;
                    }

                    // KaTeXオブジェクトの取得
                    const KaTeXLib = window.katex || katex;
                    
                    if (!KaTeXLib || typeof KaTeXLib.render !== 'function') {
                        console.error('KaTeX.render is not available');
                        displayArea.innerHTML = '<span style="color: red;">エラー: KaTeXが利用できません</span>';
                        return;
                    }

                    // KaTeXで数式をレンダリング
                    KaTeXLib.render(texSource.trim(), displayArea, {
                        throwOnError: false,
                        errorColor: '#cc0000'
                    });
                    
                    this.texSource = texSource.trim();
                    console.log(`TeX rendered: ${texSource}`);
                } catch (error) {
                    console.error('KaTeX rendering error:', error);
                    displayArea.innerHTML = `<span style="color: red;">エラー: ${error.message || error.toString()}</span>`;
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        // 既にサイズが設定されている場合はデフォルトサイズを設定しない
                        if (!this.container.style.width || this.container.style.width === '') {
                            this.container.style.width = '300px';
                        }
                        if (!this.container.style.height || this.container.style.height === '') {
                            this.container.style.height = '150px';
                        }
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 200,
                            minHeight: 100,
                            maxWidth: 1000,
                            maxHeight: 800,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized TeX display container ID: ${this.id}`);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const displayArea = this.getInputElement();
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    texSource: this.texSource,
                    displayHtml: displayArea ? displayArea.innerHTML : ''
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const displayArea = this.getInputElement();
                if (state.displayHtml && displayArea) {
                    displayArea.innerHTML = state.displayHtml;
                } else if (state.texSource && displayArea) {
                    // 保存されたTeXソースから再レンダリング
                    setTimeout(() => {
                        this.renderTeX(state.texSource);
                    }, 100);
                }
            }

            static getConfigSelectors() {
                return {
                    configInput: '#texDisplayConfig',
                    errorMessage: '#texDisplayError',
                    clearFields: ['#texDisplayConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteTeXDisplay(null, false, customId, customClasses);
                console.log(`Created TeX display component with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
                // コンフィグ入力フィールドをクリア
                const selectors = this.getConfigSelectors();
                if (selectors && selectors.clearFields) {
                    selectors.clearFields.forEach(field => {
                        $(field).val('');
                    });
                }
            }
        }

        // TeXコンポーネントクラス（テキストエリアとボタン）
        class PaletteTeX extends PaletteComponent {
            static texCounter = 0; // 静的カウンター

            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.texSource = '';
                this.displayComponent = null;
                // 子コンポーネントでない場合のみ番号を割り当て
                if (!isChild) {
                    PaletteTeX.texCounter++;
                    this.texNumber = PaletteTeX.texCounter;
                } else {
                    this.texNumber = null;
                }
                this.init();
            }

            getComponentName() { return 'TeX'; }
            getComponentType() { return 'tex'; }

            getTitleInfo() {
                let info = '';
                if (this.texNumber !== null) {
                    info += ` #${this.texNumber}`;
                }
                // 親クラスのgetTitleInfo()の結果も追加
                const parentInfo = super.getTitleInfo();
                return info + parentInfo;
            }

            createChildComponent() {
                // 他のコンポーネントと同じようにテキストエリアを子要素として作成
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const texContainer = document.createElement('div');
                texContainer.className = 'palette-tex';
                
                // 入力エリア（テキストエリアとボタン）
                const inputArea = document.createElement('div');
                inputArea.className = 'tex-input-area';
                
                const textarea = document.createElement('textarea');
                textarea.placeholder = 'TeXのソースを入力してください（例: \\frac{a}{b} または \\int_0^1 x^2 dx）';
                inputArea.appendChild(textarea);
                
                const button = document.createElement('button');
                button.textContent = '表示';
                button.onclick = (e) => {
                    e.stopPropagation();
                    this.renderTeX();
                };
                inputArea.appendChild(button);
                
                texContainer.appendChild(inputArea);
                
                return texContainer;
            }

            getInputElement() {
                return this.container.querySelector('.palette-tex');
            }

            getTextarea() {
                const container = this.getInputElement();
                return container ? container.querySelector('textarea') : null;
            }

            renderTeX() {
                const textarea = this.getTextarea();
                
                if (!textarea) {
                    console.warn('Textarea not found');
                    return;
                }

                const texSource = textarea.value.trim();
                this.texSource = texSource;

                // 数式表示コンポーネントにレンダリングを依頼
                if (this.displayComponent) {
                    this.displayComponent.renderTeX(texSource);
                }
            }

            executeChildCode() {
                // 子要素のテキストエリアの内容を数式表示エリアにレンダリング
                if (this.linkedChildId) {
                    const childElement = document.getElementById(this.linkedChildId);
                    if (childElement) {
                        const childInstance = $(childElement).data('instance');
                        if (childInstance) {
                            const childInput = childInstance.getInputElement();
                            if (childInput && childInput.tagName === 'TEXTAREA') {
                                const texSource = childInput.value.trim();
                                if (this.displayComponent) {
                                    this.displayComponent.renderTeX(texSource);
                                }
                            }
                        }
                    }
                }
            }

            init() {
                super.init();
                // タイトルバーを更新（番号を表示）
                this.updateTitleBar();
                // 数式表示コンポーネントを自動的に作成・表示（+/-ボタンとは別に管理）
                if (!this.isChild && !this.displayComponent) {
                    // 保存されたHTMLから復元される場合、data-display-component-id属性を確認
                    const savedDisplayComponentId = this.container.getAttribute('data-display-component-id');
                    let existingDisplayContainer = null;
                    
                    if (savedDisplayComponentId) {
                        // 保存されたIDで既存のコンテナを探す
                        existingDisplayContainer = document.getElementById(savedDisplayComponentId);
                        if (existingDisplayContainer) {
                            const displayInstance = $(existingDisplayContainer).data('instance');
                            // 既にインスタンスが設定されている場合は、それを再利用
                            if (displayInstance) {
                                this.displayComponent = displayInstance;
                                console.log(`Reused existing display component ID: ${savedDisplayComponentId} for parent ID: ${this.id}`);
                                return;
                            }
                        }
                    }
                    
                    // 保存されたIDがない、または見つからない場合、未使用の表示エリアコンテナを探す
                    if (!existingDisplayContainer) {
                        const allContainers = document.querySelectorAll('.palette-container[data-component-type="tex-display"]');
                        for (const container of allContainers) {
                            const displayInstance = $(container).data('instance');
                            // 既にインスタンスが設定されている場合はスキップ（他の親コンポーネントが既に使用している）
                            if (displayInstance) {
                                continue;
                            }
                            // 未使用の表示エリアコンテナを見つけた場合、それを再利用
                            // 保存されたHTMLから復元される場合、表示エリアは既にHTMLに存在しているが、
                            // まだインスタンス化されていない可能性がある
                            existingDisplayContainer = container;
                            console.log(`Found unused display container ID: ${container.id} for parent ID: ${this.id}`);
                            break;
                        }
                    }
                    
                    if (existingDisplayContainer) {
                        // 既存のコンテナから復元
                        const displayComponent = new PaletteTeXDisplay(existingDisplayContainer, false, null, [], this.texNumber);
                        this.displayComponent = displayComponent;
                        // initializeResizableを先に呼ぶ（既にサイズが設定されている場合はデフォルトサイズを設定しない）
                        displayComponent.initializeResizable();
                        // 保存されたサイズを復元（initializeResizableの後に呼ぶ）
                        setTimeout(() => {
                            this.restoreDisplayComponentSize();
                        }, 100);
                        // タイトルバーを更新
                        setTimeout(() => {
                            if (displayComponent.updateTitleBar) {
                                displayComponent.updateTitleBar();
                            }
                        }, 0);
                    } else {
                        // 新規作成（表示エリアコンテナが存在しない場合のみ）
                        const displayComponent = new PaletteTeXDisplay(null, false, null, [], this.texNumber);
                        this.displayComponent = displayComponent;
                        // 表示エリアの位置を親コンポーネントの右側に配置
                        const parentRect = this.container.getBoundingClientRect();
                        displayComponent.container.style.left = `${parentRect.left + 220}px`;
                        displayComponent.container.style.top = `${parentRect.top}px`;
                        // initializeResizableを先に呼ぶ（既にサイズが設定されている場合はデフォルトサイズを設定しない）
                        displayComponent.initializeResizable();
                        // 保存されたサイズを復元（initializeResizableの後に呼ぶ）
                        setTimeout(() => {
                            this.restoreDisplayComponentSize();
                        }, 100);
                        // タイトルバーを更新
                        setTimeout(() => {
                            if (displayComponent.updateTitleBar) {
                                displayComponent.updateTitleBar();
                            }
                        }, 0);
                    }
                }
            }

            restoreDisplayComponentSize(state = null) {
                // 保存されたサイズ情報を取得（stateオブジェクトが存在する場合はそれを使用、存在しない場合はdata-属性から取得）
                let displayComponentLeft = state ? state.displayComponentLeft : this.container.getAttribute('data-display-component-left');
                let displayComponentTop = state ? state.displayComponentTop : this.container.getAttribute('data-display-component-top');
                let displayComponentWidth = state ? state.displayComponentWidth : this.container.getAttribute('data-display-component-width');
                let displayComponentHeight = state ? state.displayComponentHeight : this.container.getAttribute('data-display-component-height');
                
                // data-属性から取得した値が空文字列の場合はnullに変換
                if (displayComponentLeft === '') displayComponentLeft = null;
                if (displayComponentTop === '') displayComponentTop = null;
                if (displayComponentWidth === '') displayComponentWidth = null;
                if (displayComponentHeight === '') displayComponentHeight = null;
                
                if (this.displayComponent && this.displayComponent.container) {
                    if (displayComponentLeft) {
                        this.displayComponent.container.style.left = displayComponentLeft;
                        console.log(`Restored display component left for TeX ID: ${this.id}, value: ${displayComponentLeft}`);
                    }
                    if (displayComponentTop) {
                        this.displayComponent.container.style.top = displayComponentTop;
                        console.log(`Restored display component top for TeX ID: ${this.id}, value: ${displayComponentTop}`);
                    }
                    if (displayComponentWidth) {
                        this.displayComponent.container.style.width = displayComponentWidth;
                        console.log(`Restored display component width for TeX ID: ${this.id}, value: ${displayComponentWidth}`);
                    }
                    if (displayComponentHeight) {
                        this.displayComponent.container.style.height = displayComponentHeight;
                        console.log(`Restored display component height for TeX ID: ${this.id}, value: ${displayComponentHeight}`);
                    }
                    console.log(`Restored display component size for TeX ID: ${this.id}, left: ${displayComponentLeft}, top: ${displayComponentTop}, width: ${displayComponentWidth}, height: ${displayComponentHeight}`);
                } else {
                    console.warn(`Display component not found for TeX ID: ${this.id}`);
                }
            }

            updateTitleBar() {
                const titleElement = this.container.querySelector('.palette-top .title');
                if (titleElement) {
                    titleElement.textContent = this.getComponentName() + this.getTitleInfo();
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '400px';
                        this.container.style.height = '120px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 300,
                            minHeight: 100,
                            maxWidth: 1000,
                            maxHeight: 300,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized TeX container ID: ${this.id}`);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const textarea = this.getTextarea();
                const state = {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    texSource: textarea ? textarea.value : ''
                };
                // 表示エリアのIDとサイズを保存
                if (this.displayComponent && this.displayComponent.container) {
                    state.displayComponentId = this.displayComponent.container.id;
                    state.displayComponentLeft = this.displayComponent.container.style.left;
                    state.displayComponentTop = this.displayComponent.container.style.top;
                    state.displayComponentWidth = this.displayComponent.container.style.width;
                    state.displayComponentHeight = this.displayComponent.container.style.height;
                }
                return state;
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const textarea = this.getTextarea();
                if (state.texSource && textarea) {
                    textarea.value = state.texSource;
                    // 数式表示コンポーネントにレンダリングを依頼
                    if (this.displayComponent) {
                        setTimeout(() => {
                            this.displayComponent.renderTeX(state.texSource);
                        }, 100);
                    }
                }
                // 表示エリアのサイズを復元（restoreDisplayComponentSizeを呼び出す）
                // init内で既にrestoreDisplayComponentSizeが呼ばれているが、restoreStateで再度呼び出すことで確実に復元
                // 少し待ってから復元（init内のrestoreDisplayComponentSizeの後に実行されるように）
                setTimeout(() => {
                    this.restoreDisplayComponentSize(state);
                }, 300);
                // タイトルバーを更新
                this.updateTitleBar();
            }

            static getConfigSelectors() {
                return {
                    configInput: '#texConfig',
                    errorMessage: '#texError',
                    clearFields: ['#texConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteTeX(null, false, customId, customClasses);
                console.log(`Created TeX component with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
            }
        }

        // Markdownコンポーネントクラス
        class PaletteMarkdown extends PaletteComponent {
            static markdownCounter = 0; // 静的カウンター

            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.markdownSource = '';
                this.displayComponent = null;
                // 子コンポーネントでない場合のみ番号を割り当て
                if (!isChild) {
                    PaletteMarkdown.markdownCounter++;
                    this.markdownNumber = PaletteMarkdown.markdownCounter;
                } else {
                    this.markdownNumber = null;
                }
                this.init();
            }

            getComponentName() { return 'Markdown'; }
            getComponentType() { return 'markdown'; }

            getTitleInfo() {
                let info = '';
                if (this.markdownNumber !== null) {
                    info += ` #${this.markdownNumber}`;
                }
                // 親クラスのgetTitleInfo()の結果も追加
                const parentInfo = super.getTitleInfo();
                return info + parentInfo;
            }

            createChildComponent() {
                // 他のコンポーネントと同じようにテキストエリアを子要素として作成
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const markdownContainer = document.createElement('div');
                markdownContainer.className = 'palette-markdown';
                
                // 入力エリア（テキストエリアとボタン）
                const inputArea = document.createElement('div');
                inputArea.className = 'markdown-input-area';
                
                const textarea = document.createElement('textarea');
                textarea.placeholder = 'Markdown形式でソースを入力してください（例: # 見出し1 または $\\frac{a}{b}$ で数式）';
                inputArea.appendChild(textarea);
                
                const button = document.createElement('button');
                button.textContent = '表示';
                button.onclick = (e) => {
                    e.stopPropagation();
                    this.renderMarkdown();
                };
                inputArea.appendChild(button);
                
                markdownContainer.appendChild(inputArea);
                
                return markdownContainer;
            }

            getInputElement() {
                return this.container.querySelector('.palette-markdown');
            }

            getTextarea() {
                const container = this.getInputElement();
                return container ? container.querySelector('textarea') : null;
            }

            renderMarkdown() {
                const textarea = this.getTextarea();
                
                if (!textarea) {
                    console.warn('Textarea not found');
                    return;
                }

                const markdownSource = textarea.value.trim();
                this.markdownSource = markdownSource;

                // ドキュメント表示コンポーネントにレンダリングを依頼
                if (this.displayComponent) {
                    this.displayComponent.renderMarkdown(markdownSource);
                }
            }

            executeChildCode() {
                // 子要素のテキストエリアの内容をドキュメント表示エリアにレンダリング
                if (this.linkedChildId) {
                    const childElement = document.getElementById(this.linkedChildId);
                    if (childElement) {
                        const childInstance = $(childElement).data('instance');
                        if (childInstance) {
                            const childInput = childInstance.getInputElement();
                            if (childInput && childInput.tagName === 'TEXTAREA') {
                                const markdownSource = childInput.value.trim();
                                if (this.displayComponent) {
                                    this.displayComponent.renderMarkdown(markdownSource);
                                }
                            }
                        }
                    }
                }
            }

            init() {
                super.init();
                // タイトルバーを更新（番号を表示）
                this.updateTitleBar();
                // ドキュメント表示コンポーネントを自動的に作成・表示（+/-ボタンとは別に管理）
                if (!this.isChild && !this.displayComponent) {
                    // 保存されたHTMLから復元される場合、data-display-component-id属性を確認
                    const savedDisplayComponentId = this.container.getAttribute('data-display-component-id');
                    let existingDisplayContainer = null;
                    
                    if (savedDisplayComponentId) {
                        // 保存されたIDで既存のコンテナを探す
                        existingDisplayContainer = document.getElementById(savedDisplayComponentId);
                        if (existingDisplayContainer) {
                            const displayInstance = $(existingDisplayContainer).data('instance');
                            // 既にインスタンスが設定されている場合は、それを再利用
                            if (displayInstance) {
                                this.displayComponent = displayInstance;
                                console.log(`Reused existing display component ID: ${savedDisplayComponentId} for parent ID: ${this.id}`);
                                return;
                            }
                        }
                    }
                    
                    // 保存されたIDがない、または見つからない場合、未使用の表示エリアコンテナを探す
                    if (!existingDisplayContainer) {
                        const allContainers = document.querySelectorAll('.palette-container[data-component-type="markdown-display"]');
                        for (const container of allContainers) {
                            const displayInstance = $(container).data('instance');
                            // 既にインスタンスが設定されている場合はスキップ（他の親コンポーネントが既に使用している）
                            if (displayInstance) {
                                continue;
                            }
                            // 未使用の表示エリアコンテナを見つけた場合、それを再利用
                            // 保存されたHTMLから復元される場合、表示エリアは既にHTMLに存在しているが、
                            // まだインスタンス化されていない可能性がある
                            existingDisplayContainer = container;
                            console.log(`Found unused display container ID: ${container.id} for parent ID: ${this.id}`);
                            break;
                        }
                    }
                    
                    if (existingDisplayContainer) {
                        // 既存のコンテナから復元
                        const displayComponent = new PaletteMarkdownDisplay(existingDisplayContainer, false, null, [], this.markdownNumber);
                        this.displayComponent = displayComponent;
                        // initializeResizableを先に呼ぶ（既にサイズが設定されている場合はデフォルトサイズを設定しない）
                        displayComponent.initializeResizable();
                        // 保存されたサイズを復元（initializeResizableの後に呼ぶ）
                        setTimeout(() => {
                            this.restoreDisplayComponentSize();
                        }, 100);
                        // タイトルバーを更新
                        setTimeout(() => {
                            if (displayComponent.updateTitleBar) {
                                displayComponent.updateTitleBar();
                            }
                        }, 0);
                    } else {
                        // 新規作成
                        const displayComponent = new PaletteMarkdownDisplay(null, false, null, [], this.markdownNumber);
                        this.displayComponent = displayComponent;
                        // 表示エリアの位置を親コンポーネントの右側に配置
                        const parentRect = this.container.getBoundingClientRect();
                        displayComponent.container.style.left = `${parentRect.left + 220}px`;
                        displayComponent.container.style.top = `${parentRect.top}px`;
                        // initializeResizableを先に呼ぶ（既にサイズが設定されている場合はデフォルトサイズを設定しない）
                        displayComponent.initializeResizable();
                        // 保存されたサイズを復元（initializeResizableの後に呼ぶ）
                        setTimeout(() => {
                            this.restoreDisplayComponentSize();
                        }, 100);
                        // タイトルバーを更新
                        setTimeout(() => {
                            if (displayComponent.updateTitleBar) {
                                displayComponent.updateTitleBar();
                            }
                        }, 0);
                    }
                }
            }

            restoreDisplayComponentSize(state = null) {
                // 保存されたサイズ情報を取得（stateオブジェクトが存在する場合はそれを使用、存在しない場合はdata-属性から取得）
                let displayComponentLeft = state ? state.displayComponentLeft : this.container.getAttribute('data-display-component-left');
                let displayComponentTop = state ? state.displayComponentTop : this.container.getAttribute('data-display-component-top');
                let displayComponentWidth = state ? state.displayComponentWidth : this.container.getAttribute('data-display-component-width');
                let displayComponentHeight = state ? state.displayComponentHeight : this.container.getAttribute('data-display-component-height');
                
                // data-属性から取得した値が空文字列の場合はnullに変換
                if (displayComponentLeft === '') displayComponentLeft = null;
                if (displayComponentTop === '') displayComponentTop = null;
                if (displayComponentWidth === '') displayComponentWidth = null;
                if (displayComponentHeight === '') displayComponentHeight = null;
                
                if (this.displayComponent && this.displayComponent.container) {
                    if (displayComponentLeft) {
                        this.displayComponent.container.style.left = displayComponentLeft;
                        console.log(`Restored display component left for Markdown ID: ${this.id}, value: ${displayComponentLeft}`);
                    }
                    if (displayComponentTop) {
                        this.displayComponent.container.style.top = displayComponentTop;
                        console.log(`Restored display component top for Markdown ID: ${this.id}, value: ${displayComponentTop}`);
                    }
                    if (displayComponentWidth) {
                        this.displayComponent.container.style.width = displayComponentWidth;
                        console.log(`Restored display component width for Markdown ID: ${this.id}, value: ${displayComponentWidth}`);
                    }
                    if (displayComponentHeight) {
                        this.displayComponent.container.style.height = displayComponentHeight;
                        console.log(`Restored display component height for Markdown ID: ${this.id}, value: ${displayComponentHeight}`);
                    }
                    console.log(`Restored display component size for Markdown ID: ${this.id}, left: ${displayComponentLeft}, top: ${displayComponentTop}, width: ${displayComponentWidth}, height: ${displayComponentHeight}`);
                } else {
                    console.warn(`Display component not found for Markdown ID: ${this.id}`);
                }
            }

            updateTitleBar() {
                const titleElement = this.container.querySelector('.palette-top .title');
                if (titleElement) {
                    titleElement.textContent = this.getComponentName() + this.getTitleInfo();
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '500px';
                        this.container.style.height = '200px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 400,
                            minHeight: 150,
                            maxWidth: 1200,
                            maxHeight: 800,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized Markdown container ID: ${this.id}`);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const textarea = this.getTextarea();
                const state = {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    markdownSource: textarea ? textarea.value : ''
                };
                // 表示エリアのIDとサイズを保存
                if (this.displayComponent && this.displayComponent.container) {
                    state.displayComponentId = this.displayComponent.container.id;
                    state.displayComponentLeft = this.displayComponent.container.style.left;
                    state.displayComponentTop = this.displayComponent.container.style.top;
                    state.displayComponentWidth = this.displayComponent.container.style.width;
                    state.displayComponentHeight = this.displayComponent.container.style.height;
                }
                return state;
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const textarea = this.getTextarea();
                if (state.markdownSource && textarea) {
                    textarea.value = state.markdownSource;
                    // ドキュメント表示コンポーネントにレンダリングを依頼
                    if (this.displayComponent) {
                        setTimeout(() => {
                            this.displayComponent.renderMarkdown(state.markdownSource);
                        }, 100);
                    }
                }
                // 表示エリアのサイズを復元（restoreDisplayComponentSizeを呼び出す）
                // init内で既にrestoreDisplayComponentSizeが呼ばれているが、restoreStateで再度呼び出すことで確実に復元
                // 少し待ってから復元（init内のrestoreDisplayComponentSizeの後に実行されるように）
                setTimeout(() => {
                    this.restoreDisplayComponentSize(state);
                }, 300);
                // タイトルバーを更新
                this.updateTitleBar();
            }

            static getConfigSelectors() {
                return {
                    configInput: '#markdownConfig',
                    errorMessage: '#markdownError',
                    clearFields: ['#markdownConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteMarkdown(null, false, customId, customClasses);
                console.log(`Created Markdown component with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
                // コンフィグ入力フィールドをクリア
                const selectors = this.getConfigSelectors();
                if (selectors && selectors.clearFields) {
                    selectors.clearFields.forEach(field => {
                        $(field).val('');
                    });
                }
            }
        }

        // LLMコンポーネントクラス
        class PaletteLLM extends PaletteComponent {
            static llmCounter = 0; // 静的カウンター
            /** idname -> メインテキスト出力完了時のコールバック */
            static _mainTextCallbacks = new Map();

            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.promptText = '';
                this.displayComponent = null;
                // 子コンポーネントでない場合のみ番号を割り当て
                if (!isChild) {
                    PaletteLLM.llmCounter++;
                    this.llmNumber = PaletteLLM.llmCounter;
                } else {
                    this.llmNumber = null;
                }
                this.init();
            }

            getComponentName() { return 'LLM'; }
            getComponentType() { return 'llm'; }

            getTitleInfo() {
                let info = '';
                if (this.llmNumber !== null) {
                    info += ` #${this.llmNumber}`;
                }
                // 親クラスのgetTitleInfo()の結果も追加
                const parentInfo = super.getTitleInfo();
                return info + parentInfo;
            }

            createChildComponent() {
                // 他のコンポーネントと同じようにテキストエリアを子要素として作成
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const llmContainer = document.createElement('div');
                llmContainer.className = 'palette-llm';
                
                // 入力エリア（テキストエリアとボタン）
                const inputArea = document.createElement('div');
                inputArea.className = 'llm-input-area';
                
                const textarea = document.createElement('textarea');
                textarea.placeholder = 'LLMに対するプロンプトを入力してください';
                inputArea.appendChild(textarea);
                
                const queryButton = document.createElement('button');
                queryButton.textContent = '問い合わせ';
                queryButton.className = 'llm-query-button';
                queryButton.onclick = (e) => {
                    e.stopPropagation();
                    this.queryGemini();
                };
                inputArea.appendChild(queryButton);
                
                const clearButton = document.createElement('button');
                clearButton.textContent = 'クリアー';
                clearButton.className = 'llm-clear-button';
                clearButton.onclick = (e) => {
                    e.stopPropagation();
                    this.clearDisplay();
                };
                inputArea.appendChild(clearButton);
                
                llmContainer.appendChild(inputArea);
                
                return llmContainer;
            }

            getInputElement() {
                return this.container.querySelector('.palette-llm');
            }

            getTextarea() {
                const container = this.getInputElement();
                return container ? container.querySelector('textarea') : null;
            }

            clearDisplay() {
                // 表示コンポーネントを取得
                if (!this.displayComponent) {
                    console.warn('Display component not found');
                    return;
                }

                const displayArea = this.displayComponent.getInputElement();
                if (!displayArea) {
                    console.warn('Display area not found');
                    return;
                }

                // 表示エリアをクリア
                displayArea.innerHTML = '';
                console.log('LLM display area cleared');
            }

            /**
             * 保存ファイルから復元したときなどに、ボタンのイベントハンドラを再設定する。
             */
            rebindButtons() {
                // タイトルバーのボタンなどは基底クラス側で再設定
                super.rebindButtons();

                const container = this.getInputElement();
                if (!container) return;

                // まずクラス名でボタンを取得（新しいHTML）
                let queryButton = container.querySelector('.llm-query-button');
                let clearButton = container.querySelector('.llm-clear-button');

                // 古いHTMLではクラスがない可能性があるので、テキストでフォールバック検索
                if (!queryButton || !clearButton) {
                    const buttons = container.querySelectorAll('button');
                    buttons.forEach(btn => {
                        const text = (btn.textContent || '').trim();
                        if (!queryButton && text === '問い合わせ') {
                            queryButton = btn;
                            btn.classList.add('llm-query-button');
                        } else if (!clearButton && text === 'クリアー') {
                            clearButton = btn;
                            btn.classList.add('llm-clear-button');
                        }
                    });
                }

                if (queryButton) {
                    queryButton.onclick = (e) => {
                        e.stopPropagation();
                        this.queryGemini();
                    };
                }
                if (clearButton) {
                    clearButton.onclick = (e) => {
                        e.stopPropagation();
                        this.clearDisplay();
                    };
                }
            }

            async queryGemini() {
                const textarea = this.getTextarea();
                
                if (!textarea) {
                    console.warn('Textarea not found');
                    return;
                }

                const prompt = textarea.value.trim();
                if (!prompt) {
                    alert('プロンプトを入力してください');
                    return;
                }

                this.promptText = prompt;

                // 表示コンポーネントを取得
                if (!this.displayComponent) {
                    console.warn('Display component not found');
                    alert('表示エリアが作成されていません');
                    return;
                }

                const displayArea = this.displayComponent.getInputElement();
                if (!displayArea) {
                    console.warn('Display area not found');
                    return;
                }

                // ローディング表示
                displayArea.innerHTML = '<p>問い合わせ中...</p>';

                try {
                    // PHPプロキシー経由でGoogle Gemini API を呼び出し
                    const response = await fetch(
                        'https://ktky.sakura.ne.jp/palette/llm_proxy.php',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [{
                                        text: prompt
                                    }]
                                }]
                            })
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                    }

                    const data = await response.json();
                    
                    // レスポンスからテキストを取得
                    let responseText = '';
                    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                        responseText = data.candidates[0].content.parts.map(part => part.text).join('');
                    } else {
                        responseText = '回答を取得できませんでした';
                    }

                    // Markdown表示コンポーネントにレンダリングを依頼
                    if (this.displayComponent && this.displayComponent.renderMarkdown) {
                        this.displayComponent.renderMarkdown(responseText);
                    }
                    // メインテキスト出力完了コールバックを呼ぶ
                    const mainTextCb = PaletteLLM._mainTextCallbacks.get(this.id);
                    if (typeof mainTextCb === 'function') {
                        try { mainTextCb(); } catch (e) { console.warn('PaletteLLM callbackMainText error:', e); }
                    }
                } catch (error) {
                    console.error('Gemini API error:', error);
                    if (displayArea) {
                        displayArea.innerHTML = `<span style="color: red;">エラー: ${error.message || error.toString()}</span>`;
                        // エラー表示後もコールバックを呼ぶ（出力完了扱い）
                        const mainTextCb = PaletteLLM._mainTextCallbacks.get(this.id);
                        if (typeof mainTextCb === 'function') {
                            try { mainTextCb(); } catch (e) { console.warn('PaletteLLM callbackMainText error:', e); }
                        }
                    }
                }
            }

            init() {
                super.init();
                // タイトルバーを更新（番号を表示）
                this.updateTitleBar();
                // Markdown表示コンポーネントを自動的に作成・表示（+/-ボタンとは別に管理）
                if (!this.isChild && !this.displayComponent) {
                    // 保存されたHTMLから復元される場合、data-display-component-id属性を確認
                    const savedDisplayComponentId = this.container.getAttribute('data-display-component-id');
                    let existingDisplayContainer = null;
                    
                    if (savedDisplayComponentId) {
                        // 保存されたIDで既存のコンテナを探す
                        existingDisplayContainer = document.getElementById(savedDisplayComponentId);
                        if (existingDisplayContainer) {
                            const displayInstance = $(existingDisplayContainer).data('instance');
                            // 既にインスタンスが設定されている場合は、それを再利用
                            if (displayInstance) {
                                this.displayComponent = displayInstance;
                                console.log(`Reused existing display component ID: ${savedDisplayComponentId} for parent ID: ${this.id}`);
                                return;
                            }
                        }
                    }
                    
                    // 保存されたIDがない、または見つからない場合、未使用の表示エリアコンテナを探す
                    if (!existingDisplayContainer) {
                        const allContainers = document.querySelectorAll('.palette-container[data-component-type="markdown-display"]');
                        for (const container of allContainers) {
                            const displayInstance = $(container).data('instance');
                            // 既にインスタンスが設定されている場合はスキップ（他の親コンポーネントが既に使用している）
                            if (displayInstance) {
                                continue;
                            }
                            // 未使用の表示エリアコンテナを見つけた場合、それを再利用
                            // 保存されたHTMLから復元される場合、表示エリアは既にHTMLに存在しているが、
                            // まだインスタンス化されていない可能性がある
                            existingDisplayContainer = container;
                            console.log(`Found unused display container ID: ${container.id} for parent ID: ${this.id}`);
                            break;
                        }
                    }
                    
                    if (existingDisplayContainer) {
                        // 既存のコンテナから復元（LLMのIDに合わせて表示コンポーネントのIDを「LLMのID-display」に設定）
                        existingDisplayContainer.id = this.id + '-display';
                        const displayComponent = new PaletteMarkdownDisplay(existingDisplayContainer, false, null, [], this.llmNumber);
                        this.displayComponent = displayComponent;
                        // initializeResizableを先に呼ぶ（既にサイズが設定されている場合はデフォルトサイズを設定しない）
                        displayComponent.initializeResizable();
                        // 保存されたサイズを復元（initializeResizableの後に呼ぶ）
                        setTimeout(() => {
                            this.restoreDisplayComponentSize();
                        }, 100);
                        // タイトルバーを更新
                        setTimeout(() => {
                            if (displayComponent.updateTitleBar) {
                                displayComponent.updateTitleBar();
                            }
                        }, 0);
                    } else {
                        // 新規作成（LLMのIDに合わせて表示コンポーネントのIDを「LLMのID-display」に設定）
                        const displayComponent = new PaletteMarkdownDisplay(null, false, this.id + '-display', [], this.llmNumber);
                        this.displayComponent = displayComponent;
                        // 表示エリアの位置を親コンポーネントの右側に配置
                        const parentRect = this.container.getBoundingClientRect();
                        displayComponent.container.style.left = `${parentRect.left + 220}px`;
                        displayComponent.container.style.top = `${parentRect.top}px`;
                        // initializeResizableを先に呼ぶ（既にサイズが設定されている場合はデフォルトサイズを設定しない）
                        displayComponent.initializeResizable();
                        // 保存されたサイズを復元（initializeResizableの後に呼ぶ）
                        setTimeout(() => {
                            this.restoreDisplayComponentSize();
                        }, 100);
                        // タイトルバーを更新
                        setTimeout(() => {
                            if (displayComponent.updateTitleBar) {
                                displayComponent.updateTitleBar();
                            }
                        }, 0);
                    }
                }
            }

            restoreDisplayComponentSize(state = null) {
                // 保存されたサイズ情報を取得（stateオブジェクトが存在する場合はそれを使用、存在しない場合はdata-属性から取得）
                let displayComponentLeft = state ? state.displayComponentLeft : this.container.getAttribute('data-display-component-left');
                let displayComponentTop = state ? state.displayComponentTop : this.container.getAttribute('data-display-component-top');
                let displayComponentWidth = state ? state.displayComponentWidth : this.container.getAttribute('data-display-component-width');
                let displayComponentHeight = state ? state.displayComponentHeight : this.container.getAttribute('data-display-component-height');
                
                // data-属性から取得した値が空文字列の場合はnullに変換
                if (displayComponentLeft === '') displayComponentLeft = null;
                if (displayComponentTop === '') displayComponentTop = null;
                if (displayComponentWidth === '') displayComponentWidth = null;
                if (displayComponentHeight === '') displayComponentHeight = null;
                
                if (this.displayComponent && this.displayComponent.container) {
                    if (displayComponentLeft) {
                        this.displayComponent.container.style.left = displayComponentLeft;
                        console.log(`Restored display component left for LLM ID: ${this.id}, value: ${displayComponentLeft}`);
                    }
                    if (displayComponentTop) {
                        this.displayComponent.container.style.top = displayComponentTop;
                        console.log(`Restored display component top for LLM ID: ${this.id}, value: ${displayComponentTop}`);
                    }
                    if (displayComponentWidth) {
                        this.displayComponent.container.style.width = displayComponentWidth;
                        console.log(`Restored display component width for LLM ID: ${this.id}, value: ${displayComponentWidth}`);
                    }
                    if (displayComponentHeight) {
                        this.displayComponent.container.style.height = displayComponentHeight;
                        console.log(`Restored display component height for LLM ID: ${this.id}, value: ${displayComponentHeight}`);
                    }
                    console.log(`Restored display component size for LLM ID: ${this.id}, left: ${displayComponentLeft}, top: ${displayComponentTop}, width: ${displayComponentWidth}, height: ${displayComponentHeight}`);
                } else {
                    console.warn(`Display component not found for LLM ID: ${this.id}`);
                }
            }

            updateTitleBar() {
                const titleElement = this.container.querySelector('.palette-top .title');
                if (titleElement) {
                    titleElement.textContent = this.getComponentName() + this.getTitleInfo();
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '500px';
                        this.container.style.height = '200px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 400,
                            minHeight: 150,
                            maxWidth: 1200,
                            maxHeight: 800,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized LLM container ID: ${this.id}`);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const textarea = this.getTextarea();
                const state = {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    promptText: textarea ? textarea.value : ''
                };
                // 表示エリアのIDとサイズを保存
                if (this.displayComponent && this.displayComponent.container) {
                    state.displayComponentId = this.displayComponent.container.id;
                    state.displayComponentLeft = this.displayComponent.container.style.left;
                    state.displayComponentTop = this.displayComponent.container.style.top;
                    state.displayComponentWidth = this.displayComponent.container.style.width;
                    state.displayComponentHeight = this.displayComponent.container.style.height;
                }
                return state;
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const textarea = this.getTextarea();
                if (state.promptText && textarea) {
                    textarea.value = state.promptText;
                }
                // 表示エリアのサイズを復元（restoreDisplayComponentSizeを呼び出す）
                // init内で既にrestoreDisplayComponentSizeが呼ばれているが、restoreStateで再度呼び出すことで確実に復元
                // 少し待ってから復元（init内のrestoreDisplayComponentSizeの後に実行されるように）
                setTimeout(() => {
                    this.restoreDisplayComponentSize(state);
                }, 300);
                // タイトルバーを更新
                this.updateTitleBar();
            }

            static getConfigSelectors() {
                return {
                    configInput: '#llmConfig',
                    errorMessage: '#llmError',
                    clearFields: ['#llmConfig']
                };
            }

            /**
             * idname で指定した LLM コンポーネントに紐づく Markdown表示コンポーネントのサイズを設定する。
             * @param {string} idname - LLMコンポーネントのコンテナ要素のID
             * @param {number|string} width - 表示コンポーネントの幅（ピクセル数またはCSS値）
             * @param {number|string} height - 表示コンポーネントの高さ（ピクセル数またはCSS値）
             */
            static setDislaySize(idname, width, height) {
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`PaletteLLM.setDislaySize: Component with ID "${idname}" not found`);
                    return;
                }
                if (!element.classList.contains('palette-container')) {
                    console.warn(`PaletteLLM.setDislaySize: Element with ID "${idname}" is not a palette component`);
                    return;
                }
                if (element.getAttribute('data-component-type') !== 'llm') {
                    console.warn(`PaletteLLM.setDislaySize: Component with ID "${idname}" is not an LLM component`);
                    return;
                }

                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`PaletteLLM.setDislaySize: Component instance not found for ID "${idname}"`);
                    return;
                }
                if (!instance.displayComponent || !instance.displayComponent.container) {
                    console.warn(`PaletteLLM.setDislaySize: Display component not found for ID "${idname}"`);
                    return;
                }

                const displayContainer = instance.displayComponent.container;
                const widthValue = parseInt(width, 10);
                const heightValue = parseInt(height, 10);

                if (isNaN(widthValue) || isNaN(heightValue) || widthValue <= 0 || heightValue <= 0) {
                    console.warn(`PaletteLLM.setDislaySize: Invalid width/height. width=${width}, height=${height}`);
                    return;
                }

                const widthPx = `${widthValue}px`;
                const heightPx = `${heightValue}px`;

                displayContainer.style.width = widthPx;
                displayContainer.style.height = heightPx;

                // 保存用に親コンポーネントのdata-属性にも設定
                element.setAttribute('data-display-component-width', widthPx);
                element.setAttribute('data-display-component-height', heightPx);

                console.log(`PaletteLLM.setDislaySize: Set display size for LLM ID "${idname}" to width=${widthPx}, height=${heightPx}`);
            }

            /**
             * idname で指定した LLM コンポーネントに紐づく Markdown表示コンポーネントの位置を設定する。
             * @param {string} idname - LLMコンポーネントのコンテナ要素のID
             * @param {number|string} leftpos - 表示コンポーネントの left に設定する値（pxなどのCSS値）
             * @param {number|string} toppos - 表示コンポーネントの top に設定する値（pxなどのCSS値）
             */
            static setDislayPos(idname, leftpos, toppos) {
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`PaletteLLM.setDislayPos: Component with ID "${idname}" not found`);
                    return;
                }
                if (!element.classList.contains('palette-container')) {
                    console.warn(`PaletteLLM.setDislayPos: Element with ID "${idname}" is not a palette component`);
                    return;
                }
                if (element.getAttribute('data-component-type') !== 'llm') {
                    console.warn(`PaletteLLM.setDislayPos: Component with ID "${idname}" is not an LLM component`);
                    return;
                }

                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`PaletteLLM.setDislayPos: Component instance not found for ID "${idname}"`);
                    return;
                }
                if (!instance.displayComponent || !instance.displayComponent.container) {
                    console.warn(`PaletteLLM.setDislayPos: Display component not found for ID "${idname}"`);
                    return;
                }

                const displayContainer = instance.displayComponent.container;
                if (leftpos === null || leftpos === undefined || toppos === null || toppos === undefined) {
                    console.warn(`PaletteLLM.setDislayPos: leftpos/toppos must not be null or undefined. leftpos=${leftpos}, toppos=${toppos}`);
                    return;
                }

                // leftpos / toppos が数値の場合は px 単位として扱う。
                // 文字列の場合は、純粋な数字のみなら px を付与し、それ以外は CSS 値としてそのまま使う。
                const normalizePos = (value) => {
                    if (typeof value === 'number') {
                        return `${value}px`;
                    }
                    if (typeof value === 'string') {
                        const trimmed = value.trim();
                        if (!trimmed) return null;
                        // 数字だけの場合はpxを付ける
                        if (/^[0-9]+$/.test(trimmed)) {
                            return `${parseInt(trimmed, 10)}px`;
                        }
                        return trimmed;
                    }
                    return null;
                };

                const leftValue = normalizePos(leftpos);
                const topValue = normalizePos(toppos);

                if (!leftValue || !topValue) {
                    console.warn(`PaletteLLM.setDislayPos: Invalid leftpos/toppos. leftpos=${leftpos}, toppos=${toppos}`);
                    return;
                }

                displayContainer.style.left = leftValue;
                displayContainer.style.top = topValue;

                // 保存用に親コンポーネントのdata-属性にも設定
                element.setAttribute('data-display-component-left', leftValue);
                element.setAttribute('data-display-component-top', topValue);

                console.log(`PaletteLLM.setDislayPos: Set display position for LLM ID "${idname}" to left=${leftValue}, top=${topValue}`);
            }

            /**
             * idname で指定した LLM コンポーネントの、Markdown表示用メインテキストエリアの内容を取得する。
             * @param {string} idname - LLMコンポーネントのコンテナ要素のID
             * @returns {string} 表示エリアの内容（HTML）。コンポーネント未作成・未取得時は空文字
             */
            static getDisplayMainText(idname) {
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`PaletteLLM.getDisplayMainText: Component with ID "${idname}" not found`);
                    return '';
                }
                if (!element.classList.contains('palette-container')) {
                    console.warn(`PaletteLLM.getDisplayMainText: Element with ID "${idname}" is not a palette component`);
                    return '';
                }
                if (element.getAttribute('data-component-type') !== 'llm') {
                    console.warn(`PaletteLLM.getDisplayMainText: Component with ID "${idname}" is not an LLM component`);
                    return '';
                }
                const instance = $(element).data('instance');
                if (!instance || !instance.displayComponent) {
                    return '';
                }
                const displayArea = instance.displayComponent.getInputElement();
                return displayArea ? displayArea.innerHTML : '';
            }

            /**
             * idname で指定した LLM コンポーネントで、PaletteComponent.exeMainText(idname) と同様に
             * メインテキストエリアの内容を LLM に問い合わせる。応答が返り Markdown 表示エリアに表示した後に callback を呼ぶ。
             * @param {string} idname - LLMコンポーネントのコンテナ要素のID
             * @param {function} callback - 出力終了時に呼び出す関数（引数なし）
             */
            static callbackMainText(idname, callback) {
                const element = document.getElementById(idname);
                if (!element) {
                    console.warn(`PaletteLLM.callbackMainText: Component with ID "${idname}" not found`);
                    return;
                }
                if (!element.classList.contains('palette-container')) {
                    console.warn(`PaletteLLM.callbackMainText: Element with ID "${idname}" is not a palette component`);
                    return;
                }
                if (element.getAttribute('data-component-type') !== 'llm') {
                    console.warn(`PaletteLLM.callbackMainText: Component with ID "${idname}" is not an LLM component`);
                    return;
                }
                if (typeof callback !== 'function') {
                    console.warn('PaletteLLM.callbackMainText: callback is not a function');
                    return;
                }
                const instance = $(element).data('instance');
                if (!instance) {
                    console.warn(`PaletteLLM.callbackMainText: Component instance not found for ID "${idname}"`);
                    return;
                }
                // 出力完了時に callback を呼ぶよう登録
                PaletteLLM._mainTextCallbacks.set(idname, callback);
                // exeMainText(idname) と同様にメインテキストの内容を LLM に問い合わせる
                if (instance.queryGemini && typeof instance.queryGemini === 'function') {
                    instance.queryGemini();
                } else {
                    console.warn(`PaletteLLM.callbackMainText: queryGemini not found for ID "${idname}"`);
                }
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteLLM(null, false, customId, customClasses);
                console.log(`Created LLM component with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
                // コンフィグ入力フィールドをクリア
                const selectors = this.getConfigSelectors();
                if (selectors && selectors.clearFields) {
                    selectors.clearFields.forEach(field => {
                        $(field).val('');
                    });
                }
            }
        }

        // LM Studio LLMコンポーネントクラス
        class PaletteLMStudio extends PaletteComponent {
            static lmStudioCounter = 0;

            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.promptText = '';
                this.displayComponent = null;
                if (!isChild) {
                    PaletteLMStudio.lmStudioCounter++;
                    this.lmStudioNumber = PaletteLMStudio.lmStudioCounter;
                } else {
                    this.lmStudioNumber = null;
                }
                this.init();
            }

            getComponentName() { return 'LM Studio'; }
            getComponentType() { return 'lmstudio'; }

            getTitleInfo() {
                let info = '';
                if (this.lmStudioNumber !== null) {
                    info += ` #${this.lmStudioNumber}`;
                }
                const parentInfo = super.getTitleInfo();
                return info + parentInfo;
            }

            createChildComponent() {
                return new PaletteTextarea(null, true);
            }

            createInputElement() {
                const container = document.createElement('div');
                container.className = 'palette-llm';

                const inputArea = document.createElement('div');
                inputArea.className = 'llm-input-area';

                const textarea = document.createElement('textarea');
                textarea.placeholder = 'LM Studio に送るプロンプトを入力してください';
                inputArea.appendChild(textarea);

                const queryButton = document.createElement('button');
                queryButton.textContent = '問い合わせ';
                queryButton.onclick = (e) => {
                    e.stopPropagation();
                    this.queryLMStudio();
                };
                inputArea.appendChild(queryButton);

                const clearButton = document.createElement('button');
                clearButton.textContent = 'クリアー';
                clearButton.onclick = (e) => {
                    e.stopPropagation();
                    this.clearDisplay();
                };
                inputArea.appendChild(clearButton);

                container.appendChild(inputArea);
                return container;
            }

            getInputElement() {
                return this.container.querySelector('.palette-llm');
            }

            getTextarea() {
                const container = this.getInputElement();
                return container ? container.querySelector('textarea') : null;
            }

            clearDisplay() {
                if (!this.displayComponent) {
                    console.warn('Display component not found');
                    return;
                }
                const displayArea = this.displayComponent.getInputElement();
                if (!displayArea) {
                    console.warn('Display area not found');
                    return;
                }
                displayArea.innerHTML = '';
                console.log('LM Studio display area cleared');
            }

            async queryLMStudio() {
                const textarea = this.getTextarea();
                if (!textarea) {
                    console.warn('Textarea not found');
                    return;
                }
                const prompt = textarea.value.trim();
                if (!prompt) {
                    alert('プロンプトを入力してください');
                    return;
                }
                this.promptText = prompt;

                if (!this.displayComponent) {
                    console.warn('Display component not found');
                    alert('表示エリアが作成されていません');
                    return;
                }
                const displayArea = this.displayComponent.getInputElement();
                if (!displayArea) {
                    console.warn('Display area not found');
                    return;
                }
                displayArea.innerHTML = '<p>問い合わせ中...</p>';

                try {
                    const response = await fetch(LM_STUDIO_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: LM_STUDIO_DEFAULT_MODEL,
                            messages: [{ role: 'user', content: prompt }],
                            stream: false
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                    }

                    const data = await response.json();
                    let responseText = '回答を取得できませんでした';
                    if (data.choices && data.choices[0]) {
                        const choice = data.choices[0];
                        if (choice.message && choice.message.content) {
                            responseText = choice.message.content;
                        } else if (choice.delta && choice.delta.content) {
                            responseText = Array.isArray(choice.delta.content) ? choice.delta.content.join('') : choice.delta.content;
                        }
                    }

                    if (this.displayComponent && this.displayComponent.renderMarkdown) {
                        this.displayComponent.renderMarkdown(responseText);
                    }
                } catch (error) {
                    console.error('LM Studio API error:', error);
                    if (displayArea) {
                        displayArea.innerHTML = `<span style="color: red;">エラー: ${error.message || error.toString()}</span>`;
                    }
                }
            }

            init() {
                super.init();
                this.updateTitleBar();
                if (!this.isChild && !this.displayComponent) {
                    const savedDisplayComponentId = this.container.getAttribute('data-display-component-id');
                    let existingDisplayContainer = null;

                    if (savedDisplayComponentId) {
                        existingDisplayContainer = document.getElementById(savedDisplayComponentId);
                        if (existingDisplayContainer) {
                            const displayInstance = $(existingDisplayContainer).data('instance');
                            if (displayInstance) {
                                this.displayComponent = displayInstance;
                                console.log(`Reused existing display component ID: ${savedDisplayComponentId} for parent ID: ${this.id}`);
                                return;
                            }
                        }
                    }

                    if (!existingDisplayContainer) {
                        const allContainers = document.querySelectorAll('.palette-container[data-component-type="markdown-display"]');
                        for (const container of allContainers) {
                            const displayInstance = $(container).data('instance');
                            if (displayInstance) {
                                continue;
                            }
                            existingDisplayContainer = container;
                            console.log(`Found unused display container ID: ${container.id} for parent ID: ${this.id}`);
                            break;
                        }
                    }

                    if (existingDisplayContainer) {
                        const displayComponent = new PaletteMarkdownDisplay(existingDisplayContainer, false, null, [], this.lmStudioNumber);
                        this.displayComponent = displayComponent;
                        displayComponent.initializeResizable();
                        setTimeout(() => {
                            this.restoreDisplayComponentSize();
                        }, 100);
                        setTimeout(() => {
                            if (displayComponent.updateTitleBar) {
                                displayComponent.updateTitleBar();
                            }
                        }, 0);
                    } else {
                        const displayComponent = new PaletteMarkdownDisplay(null, false, null, [], this.lmStudioNumber);
                        this.displayComponent = displayComponent;
                        const parentRect = this.container.getBoundingClientRect();
                        displayComponent.container.style.left = `${parentRect.left + 220}px`;
                        displayComponent.container.style.top = `${parentRect.top}px`;
                        displayComponent.initializeResizable();
                        setTimeout(() => {
                            this.restoreDisplayComponentSize();
                        }, 100);
                        setTimeout(() => {
                            if (displayComponent.updateTitleBar) {
                                displayComponent.updateTitleBar();
                            }
                        }, 0);
                    }
                }
            }

            restoreDisplayComponentSize(state = null) {
                let displayComponentLeft = state ? state.displayComponentLeft : this.container.getAttribute('data-display-component-left');
                let displayComponentTop = state ? state.displayComponentTop : this.container.getAttribute('data-display-component-top');
                let displayComponentWidth = state ? state.displayComponentWidth : this.container.getAttribute('data-display-component-width');
                let displayComponentHeight = state ? state.displayComponentHeight : this.container.getAttribute('data-display-component-height');

                if (displayComponentLeft === '') displayComponentLeft = null;
                if (displayComponentTop === '') displayComponentTop = null;
                if (displayComponentWidth === '') displayComponentWidth = null;
                if (displayComponentHeight === '') displayComponentHeight = null;

                if (this.displayComponent && this.displayComponent.container) {
                    if (displayComponentLeft) {
                        this.displayComponent.container.style.left = displayComponentLeft;
                        console.log(`Restored display component left for LM Studio ID: ${this.id}, value: ${displayComponentLeft}`);
                    }
                    if (displayComponentTop) {
                        this.displayComponent.container.style.top = displayComponentTop;
                        console.log(`Restored display component top for LM Studio ID: ${this.id}, value: ${displayComponentTop}`);
                    }
                    if (displayComponentWidth) {
                        this.displayComponent.container.style.width = displayComponentWidth;
                        console.log(`Restored display component width for LM Studio ID: ${this.id}, value: ${displayComponentWidth}`);
                    }
                    if (displayComponentHeight) {
                        this.displayComponent.container.style.height = displayComponentHeight;
                        console.log(`Restored display component height for LM Studio ID: ${this.id}, value: ${displayComponentHeight}`);
                    }
                    console.log(`Restored display component size for LM Studio ID: ${this.id}, left: ${displayComponentLeft}, top: ${displayComponentTop}, width: ${displayComponentWidth}, height: ${displayComponentHeight}`);
                } else {
                    console.warn(`Display component not found for LM Studio ID: ${this.id}`);
                }
            }

            updateTitleBar() {
                const titleElement = this.container.querySelector('.palette-top .title');
                if (titleElement) {
                    titleElement.textContent = this.getComponentName() + this.getTitleInfo();
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '500px';
                        this.container.style.height = '200px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 400,
                            minHeight: 150,
                            maxWidth: 1200,
                            maxHeight: 800,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized LM Studio container ID: ${this.id}`);
                            }
                        });
                        console.log(`Resizable initialized for LM Studio container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for LM Studio container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for LM Studio container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const textarea = this.getTextarea();
                const state = {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    promptText: textarea ? textarea.value : ''
                };
                if (this.displayComponent && this.displayComponent.container) {
                    state.displayComponentId = this.displayComponent.container.id;
                    state.displayComponentLeft = this.displayComponent.container.style.left;
                    state.displayComponentTop = this.displayComponent.container.style.top;
                    state.displayComponentWidth = this.displayComponent.container.style.width;
                    state.displayComponentHeight = this.displayComponent.container.style.height;
                }
                return state;
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const textarea = this.getTextarea();
                if (state.promptText && textarea) {
                    textarea.value = state.promptText;
                }
                setTimeout(() => {
                    this.restoreDisplayComponentSize(state);
                }, 300);
                this.updateTitleBar();
            }

            static getConfigSelectors() {
                return {
                    configInput: '#lmstudioConfig',
                    errorMessage: '#lmstudioError',
                    clearFields: ['#lmstudioConfig']
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput) return true;
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                return regex.test(configInput);
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput) {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) { customId = match[1]; }
                        if (match[2]) { customClasses.push(match[2]); }
                        if (match[3]) { customClasses.push(match[3]); }
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                new PaletteLMStudio(null, false, customId, customClasses);
                console.log(`Created LM Studio component with ID: ${customId || 'generated-id'}`);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                this.createComponent(configInput, errorMessage, additionalInputs);
                const selectors = this.getConfigSelectors();
                if (selectors && selectors.clearFields) {
                    selectors.clearFields.forEach(field => {
                        $(field).val('');
                    });
                }
            }
        }

        // Markdownドキュメント表示コンポーネントクラス
        class PaletteMarkdownDisplay extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = [], parentMarkdownNumber = null) {
                super(container, isChild, customId, customClasses);
                this.markdownSource = '';
                this.parentMarkdownNumber = parentMarkdownNumber; // 親のMarkdown番号を保持
                this.init();
            }

            getComponentName() { return 'Markdown表示'; }
            getComponentType() { return 'markdown-display'; }

            getTitleInfo() {
                let info = '';
                if (this.parentMarkdownNumber !== null) {
                    info += ` #${this.parentMarkdownNumber}`;
                }
                // 親クラスのgetTitleInfo()の結果も追加
                const parentInfo = super.getTitleInfo();
                return info + parentInfo;
            }

            updateTitleBar() {
                const titleElement = this.container.querySelector('.palette-top .title');
                if (titleElement) {
                    titleElement.textContent = this.getComponentName() + this.getTitleInfo();
                }
            }

            createChildComponent() {
                return null; // 子コンポーネントなし
            }

            createInputElement() {
                const container = document.createElement('div');
                container.className = 'palette-markdown-display';
                const displayArea = document.createElement('div');
                displayArea.className = 'markdown-display-area';
                container.appendChild(displayArea);
                return container;
            }

            getInputElement() {
                return this.container.querySelector('.markdown-display-area');
            }

            renderMarkdown(markdownSource) {
                const displayArea = this.getInputElement();
                
                if (!displayArea) {
                    console.warn('Display area not found');
                    return;
                }

                if (!markdownSource || markdownSource.trim() === '') {
                    displayArea.innerHTML = '';
                    return;
                }

                try {
                    // marked.jsライブラリの存在確認
                    if (typeof marked === 'undefined' && typeof window.marked === 'undefined') {
                        console.error('marked.js library is not loaded');
                        displayArea.innerHTML = '<span style="color: red;">エラー: marked.jsライブラリが読み込まれていません</span>';
                        return;
                    }

                    // marked.jsオブジェクトの取得
                    const markedLib = window.marked || marked;
                    
                    if (!markedLib || typeof markedLib.parse !== 'function') {
                        console.error('marked.parse is not available');
                        displayArea.innerHTML = '<span style="color: red;">エラー: marked.jsが利用できません</span>';
                        return;
                    }

                    // KaTeXライブラリの存在確認
                    if (typeof katex === 'undefined' && typeof window.katex === 'undefined') {
                        displayArea.innerHTML = '<span style="color: red;">エラー: KaTeXライブラリが読み込まれていません</span>';
                        return;
                    }

                    const KaTeXLib = window.katex || katex;
                    
                    if (!KaTeXLib || typeof KaTeXLib.renderToString !== 'function') {
                        displayArea.innerHTML = '<span style="color: red;">エラー: KaTeXが利用できません</span>';
                        return;
                    }

                    // $で囲まれたTeX数式を処理
                    // まず、TeX数式を検出して配列に保存
                    const texExpressions = [];
                    let processedMarkdown = markdownSource.replace(/\$([^$]+)\$/g, (match, texContent) => {
                        const index = texExpressions.length;
                        texExpressions.push(texContent.trim());
                        // 一意のプレースホルダーを使用（HTMLタグとして解釈されないように）
                        return `<span data-katex-placeholder="${index}"></span>`;
                    });

                    // MarkdownをHTMLに変換
                    let html = markedLib.parse(processedMarkdown);
                    
                    // プレースホルダーをKaTeXでレンダリングされたHTMLに置き換え
                    for (let i = 0; i < texExpressions.length; i++) {
                        const placeholderRegex = new RegExp(`<span data-katex-placeholder="${i}"></span>`, 'g');
                        if (html.match(placeholderRegex)) {
                            try {
                                // KaTeXで数式をレンダリング
                                const rendered = KaTeXLib.renderToString(texExpressions[i], {
                                    throwOnError: false,
                                    errorColor: '#cc0000'
                                });
                                html = html.replace(placeholderRegex, rendered);
                            } catch (error) {
                                console.error('KaTeX rendering error:', error);
                                html = html.replace(placeholderRegex, `<span style="color: red;">エラー: ${error.message || error.toString()}</span>`);
                            }
                        }
                    }

                    displayArea.innerHTML = html;
                    this.markdownSource = markdownSource.trim();
                    console.log(`Markdown rendered: ${markdownSource.substring(0, 50)}...`);
                } catch (error) {
                    console.error('Markdown rendering error:', error);
                    displayArea.innerHTML = `<span style="color: red;">エラー: ${error.message || error.toString()}</span>`;
                }
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        // 既にサイズが設定されている場合はデフォルトサイズを設定しない
                        if (!this.container.style.width || this.container.style.width === '') {
                            this.container.style.width = '500px';
                        }
                        if (!this.container.style.height || this.container.style.height === '') {
                            this.container.style.height = '300px';
                        }
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 400,
                            minHeight: 200,
                            maxWidth: 1200,
                            maxHeight: 1000,
                            aspectRatio: false,
                            stop: () => {
                                console.log(`Resized Markdown display container ID: ${this.id}`);
                            }
                        });
                        console.log(`Resizable initialized for container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                const displayArea = this.getInputElement();
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    markdownSource: this.markdownSource,
                    displayHtml: displayArea ? displayArea.innerHTML : ''
                };
            }

            restoreState(state) {
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                const displayArea = this.getInputElement();
                if (state.displayHtml && displayArea) {
                    displayArea.innerHTML = state.displayHtml;
                } else if (state.markdownSource && displayArea) {
                    // 保存されたMarkdownソースから再レンダリング
                    setTimeout(() => {
                        this.renderMarkdown(state.markdownSource);
                    }, 100);
                }
            }

            static getConfigSelectors() {
                return null; // 直接作成されるため不要
            }

            static validateConfigInput(configInput) {
                return true;
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                // 直接作成されるため、このメソッドは使用されない
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                // 直接作成されるため、このメソッドは使用されない
            }
        }

        // コンパウンドコンポーネントクラス
        class PaletteCompound extends PaletteComponent {
            constructor(container = null, isChild = false, customId = null, customClasses = []) {
                super(container, isChild, customId, customClasses);
                this.containedComponents = []; // 取り込まれたコンポーネントのIDリスト
                this.componentOffsets = {}; // 各コンポーネントの相対位置を保存 {componentId: {left: x, top: y}}
                this.componentContainers = {}; // 各コンポーネントのcontainerへの参照を保存 {componentId: container}
                this.init();
            }

            getComponentName() { return 'コンパウンド'; }
            getComponentType() { return 'compound'; }

            createChildComponent() {
                return null; // コンパウンドは子コンポーネントを持たない
            }

            createTitleBar() {
                // 基底クラスのcreateTitleBar()を呼び出し
                const titleBar = super.createTitleBar();
                
                // 削除ボタンの処理を拡張して、含まれるコンポーネントも削除
                const deleteButton = titleBar.querySelector('.delete-button');
                if (deleteButton) {
                    // 元のonclickイベントを保存
                    const originalOnclick = deleteButton.onclick;
                    
                    // 新しいonclickイベントを設定
                    deleteButton.onclick = (e) => {
                        e.stopPropagation();
                        
                        // 再帰的にすべてのコンポーネント（直接・間接的に含まれるコンポーネント）を取得
                        const getAllContainedComponents = (compoundInstance) => {
                            const allComponents = [];
                            if (compoundInstance.containedComponents && Array.isArray(compoundInstance.containedComponents)) {
                                compoundInstance.containedComponents.forEach(compId => {
                                    allComponents.push(compId);
                                    // コンポーネントがコンパウンドコンポーネントの場合、その中に含まれるコンポーネントも取得
                                    let comp = compoundInstance.componentContainers[compId];
                                    if (!comp) {
                                        comp = document.getElementById(compId);
                                    }
                                    if (comp) {
                                        const compInstance = $(comp).data('instance');
                                        if (compInstance && compInstance.getComponentType && compInstance.getComponentType() === 'compound') {
                                            // 再帰的に取得
                                            const nestedComponents = getAllContainedComponents(compInstance);
                                            allComponents.push(...nestedComponents);
                                        }
                                    }
                                });
                            }
                            return allComponents;
                        };
                        
                        // すべてのコンポーネント（直接・間接的に含まれるコンポーネント）を取得
                        const allComponentsToDelete = getAllContainedComponents(this);
                        console.log(`Deleting compound ${this.id} with all contained components:`, allComponentsToDelete);
                        
                        // 含まれるコンポーネントを全て削除（再帰的に）
                        const self = this;
                        allComponentsToDelete.forEach(componentId => {
                            // componentContainersから取得を試みる
                            let component = self.componentContainers[componentId];
                            
                            // 見つからない場合は、getElementByIdで取得
                            if (!component) {
                                component = document.getElementById(componentId);
                            }
                            
                            // 他のコンパウンドコンポーネントのcomponentContainersからも取得を試みる
                            if (!component) {
                                document.querySelectorAll('.palette-container').forEach(container => {
                                    const instance = $(container).data('instance');
                                    if (instance && instance.componentContainers && instance.componentContainers[componentId]) {
                                        component = instance.componentContainers[componentId];
                                    }
                                });
                            }
                            
                            if (component) {
                                component.remove();
                                console.log(`Contained component ID: ${componentId} has been removed with compound.`);
                            } else {
                                console.warn(`Component ${componentId} not found for deletion`);
                            }
                        });
                        
                        // 基底クラスの削除処理を実行
                        if (originalOnclick) {
                            originalOnclick.call(this, e);
                        } else {
                            // 基底クラスの削除処理が存在しない場合は、直接削除
                            this.container.remove();
                            console.log(`Compound component ID: ${this.id} has been removed.`);
                        }
                    };
                }
                
                // プルダウンメニューをタイトルバーに追加（☓印のすぐ右）
                const buttonContainer = titleBar.querySelector('.buttons');
                if (buttonContainer) {
                    // プルダウンメニューのコンテナ
                    const dropdownContainer = document.createElement('div');
                    dropdownContainer.className = 'compound-dropdown-container';
                    dropdownContainer.style.position = 'relative';
                    dropdownContainer.style.display = 'inline-block';
                    dropdownContainer.style.marginLeft = '2px';
                    
                    // メインボタン
                    const mainButton = document.createElement('button');
                    mainButton.textContent = '操作 ▼';
                    mainButton.className = 'compound-main-button';
                    mainButton.style.padding = '0';
                    mainButton.style.cursor = 'pointer';
                    mainButton.style.backgroundColor = '#6699ff';
                    mainButton.style.color = '#fff';
                    mainButton.style.border = 'none';
                    mainButton.style.borderRadius = '2px';
                    mainButton.style.width = '40px';
                    mainButton.style.height = '20px';
                    mainButton.style.fontSize = '10px';
                    mainButton.style.lineHeight = '20px';
                    
                    // ドラッグ処理を設定（プルダウンメニューコンテナのみを移動）
                    let isDragging = false;
                    let dragStartX = 0;
                    let dragStartY = 0;
                    let initialLeft = 0;
                    let initialTop = 0;
                    
                    const handleDrag = (e) => {
                        if (!isDragging) return;
                        e.preventDefault();
                        
                        const deltaX = e.clientX - dragStartX;
                        const deltaY = e.clientY - dragStartY;
                        
                        // タイトルバーの現在の位置を取得
                        const titleBarRect = titleBar.getBoundingClientRect();
                        
                        // 新しい位置を計算（タイトルバー内での相対位置）
                        const newLeft = initialLeft + deltaX;
                        const newTop = initialTop + deltaY;
                        
                        // タイトルバーの範囲内に制限
                        const maxLeft = titleBarRect.width - dropdownContainer.offsetWidth;
                        const maxTop = titleBarRect.height - dropdownContainer.offsetHeight;
                        
                        const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
                        const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
                        
                        dropdownContainer.style.position = 'absolute';
                        dropdownContainer.style.left = `${constrainedLeft}px`;
                        dropdownContainer.style.top = `${constrainedTop}px`;
                        dropdownContainer.style.marginLeft = '0';
                    };
                    
                    const handleDragEnd = () => {
                        isDragging = false;
                        document.removeEventListener('mousemove', handleDrag);
                        document.removeEventListener('mouseup', handleDragEnd);
                    };
                    
                    // ドロップダウンメニュー
                    const dropdownMenu = document.createElement('div');
                    dropdownMenu.className = 'compound-dropdown-menu';
                    dropdownMenu.style.display = 'none';
                    dropdownMenu.style.position = 'absolute';
                    dropdownMenu.style.top = '100%';
                    dropdownMenu.style.left = '0';
                    dropdownMenu.style.width = '120px';
                    dropdownMenu.style.backgroundColor = '#fff';
                    dropdownMenu.style.border = '1px solid #ccc';
                    dropdownMenu.style.borderRadius = '4px';
                    dropdownMenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                    dropdownMenu.style.zIndex = '1000';
                    dropdownMenu.style.marginTop = '2px';
                    dropdownMenu.style.overflow = 'hidden';
                    
                    // メニュー項目：取り込み
                    const importMenuItem = document.createElement('div');
                    importMenuItem.textContent = '取込';
                    importMenuItem.className = 'compound-menu-item compound-import-button';
                    importMenuItem.style.padding = '6px';
                    importMenuItem.style.cursor = 'pointer';
                    importMenuItem.style.backgroundColor = '#f5f5f5';
                    importMenuItem.style.borderBottom = '1px solid #ddd';
                    importMenuItem.style.fontSize = '12px';
                    importMenuItem.onmouseenter = () => {
                        importMenuItem.style.backgroundColor = '#e0e0e0';
                    };
                    importMenuItem.onmouseleave = () => {
                        importMenuItem.style.backgroundColor = '#f5f5f5';
                    };
                    importMenuItem.onclick = (e) => {
                        e.stopPropagation();
                        this.showComponentSelectionDialog();
                        dropdownMenu.style.display = 'none';
                    };
                    
                    // メニュー項目：コピー作成
                    const copyMenuItem = document.createElement('div');
                    copyMenuItem.textContent = 'copy';
                    copyMenuItem.className = 'compound-menu-item compound-copy-button';
                    copyMenuItem.style.padding = '6px';
                    copyMenuItem.style.cursor = 'pointer';
                    copyMenuItem.style.backgroundColor = '#f5f5f5';
                    copyMenuItem.style.borderBottom = '1px solid #ddd';
                    copyMenuItem.style.fontSize = '12px';
                    copyMenuItem.onmouseenter = () => {
                        copyMenuItem.style.backgroundColor = '#e0e0e0';
                    };
                    copyMenuItem.onmouseleave = () => {
                        copyMenuItem.style.backgroundColor = '#f5f5f5';
                    };
                    copyMenuItem.onclick = (e) => {
                        e.stopPropagation();
                        this.createCopy();
                        dropdownMenu.style.display = 'none';
                    };
                    
                    // メニュー項目：クリック取り込み
                    const clickImportMenuItem = document.createElement('div');
                    clickImportMenuItem.textContent = 'click';
                    clickImportMenuItem.className = 'compound-menu-item compound-click-import-button';
                    clickImportMenuItem.style.padding = '6px';
                    clickImportMenuItem.style.cursor = 'pointer';
                    clickImportMenuItem.style.backgroundColor = '#f5f5f5';
                    clickImportMenuItem.style.fontSize = '12px';
                    clickImportMenuItem.onmouseenter = () => {
                        clickImportMenuItem.style.backgroundColor = '#e0e0e0';
                    };
                    clickImportMenuItem.onmouseleave = () => {
                        clickImportMenuItem.style.backgroundColor = '#f5f5f5';
                    };
                    clickImportMenuItem.onclick = (e) => {
                        e.stopPropagation();
                        this.activateClickImportMode();
                        dropdownMenu.style.display = 'none';
                    };
                    
                    // メニュー項目：リスト表示
                    const listMenuItem = document.createElement('div');
                    listMenuItem.textContent = 'list';
                    listMenuItem.className = 'compound-menu-item compound-list-button';
                    listMenuItem.style.padding = '6px';
                    listMenuItem.style.cursor = 'pointer';
                    listMenuItem.style.backgroundColor = '#f5f5f5';
                    listMenuItem.style.borderBottom = '1px solid #ddd';
                    listMenuItem.style.fontSize = '12px';
                    listMenuItem.onmouseenter = () => {
                        listMenuItem.style.backgroundColor = '#e0e0e0';
                    };
                    listMenuItem.onmouseleave = () => {
                        listMenuItem.style.backgroundColor = '#f5f5f5';
                    };
                    listMenuItem.onclick = (e) => {
                        e.stopPropagation();
                        this.showComponentList();
                        dropdownMenu.style.display = 'none';
                    };
                    
                    // メニュー項目：登録
                    const registerMenuItem = document.createElement('div');
                    registerMenuItem.textContent = '登録';
                    registerMenuItem.className = 'compound-menu-item compound-register-button';
                    registerMenuItem.style.padding = '6px';
                    registerMenuItem.style.cursor = 'pointer';
                    registerMenuItem.style.backgroundColor = '#f5f5f5';
                    registerMenuItem.style.borderBottom = '1px solid #ddd';
                    registerMenuItem.style.fontSize = '12px';
                    registerMenuItem.onmouseenter = () => {
                        registerMenuItem.style.backgroundColor = '#e0e0e0';
                    };
                    registerMenuItem.onmouseleave = () => {
                        registerMenuItem.style.backgroundColor = '#f5f5f5';
                    };
                    registerMenuItem.onclick = (e) => {
                        e.stopPropagation();
                        this.registerCompound();
                        dropdownMenu.style.display = 'none';
                    };
                    
                    // メニュー項目をドロップダウンメニューに追加
                    dropdownMenu.appendChild(importMenuItem);
                    dropdownMenu.appendChild(copyMenuItem);
                    dropdownMenu.appendChild(clickImportMenuItem);
                    dropdownMenu.appendChild(listMenuItem);
                    dropdownMenu.appendChild(registerMenuItem);
                    
                    // メインボタンのクリックでメニューを表示/非表示
                    mainButton.onclick = (e) => {
                        e.stopPropagation();
                        if (dropdownMenu.style.display === 'none' || dropdownMenu.style.display === '') {
                            dropdownMenu.style.display = 'block';
                        } else {
                            dropdownMenu.style.display = 'none';
                        }
                    };
                    
                    // メインボタンをドラッグした場合はプルダウンメニューを移動
                    let isDraggingFromButton = false;
                    let buttonDragStartX = 0;
                    let buttonDragStartY = 0;
                    let buttonInitialLeft = 0;
                    let buttonInitialTop = 0;
                    
                    mainButton.onmousedown = (e) => {
                        // 左クリックのみでドラッグ可能（右クリックはメニュー表示用）
                        if (e.button === 0) {
                            e.stopPropagation();
                            isDraggingFromButton = true;
                            buttonDragStartX = e.clientX;
                            buttonDragStartY = e.clientY;
                            
                            const rect = dropdownContainer.getBoundingClientRect();
                            const containerRect = this.container.getBoundingClientRect();
                            buttonInitialLeft = rect.left - containerRect.left;
                            buttonInitialTop = rect.top - containerRect.top;
                            
                            document.addEventListener('mousemove', handleButtonDrag);
                            document.addEventListener('mouseup', handleButtonDragEnd);
                        }
                    };
                    
                    const handleButtonDrag = (e) => {
                        if (!isDraggingFromButton) return;
                        e.preventDefault();
                        
                        const deltaX = e.clientX - buttonDragStartX;
                        const deltaY = e.clientY - buttonDragStartY;
                        
                        // 新しい位置を計算（コンテナ内での絶対位置）
                        const newLeft = buttonInitialLeft + deltaX;
                        const newTop = buttonInitialTop + deltaY;
                        
                        // 制限を設けずに自由に移動可能にする
                        dropdownContainer.style.position = 'absolute';
                        dropdownContainer.style.left = `${newLeft}px`;
                        dropdownContainer.style.top = `${newTop}px`;
                        dropdownContainer.style.marginLeft = '0';
                        
                        // ドラッグハンドルの位置も更新（プルダウンメニューの右側に配置）
                        const containerRect = this.container.getBoundingClientRect();
                        const dropdownRect = dropdownContainer.getBoundingClientRect();
                        dragHandle.style.left = `${dropdownRect.right - containerRect.left + 2}px`;
                        dragHandle.style.top = `${dropdownRect.top - containerRect.top}px`;
                    };
                    
                    const handleButtonDragEnd = () => {
                        isDraggingFromButton = false;
                        document.removeEventListener('mousemove', handleButtonDrag);
                        document.removeEventListener('mouseup', handleButtonDragEnd);
                    };
                    
                    // メニュー外をクリックしたら閉じる
                    document.addEventListener('click', (e) => {
                        if (!dropdownContainer.contains(e.target)) {
                            dropdownMenu.style.display = 'none';
                        }
                    });
                    
                    // コンテナに追加（メインボタンとドロップダウンメニュー）
                    dropdownContainer.appendChild(mainButton);
                    dropdownContainer.appendChild(dropdownMenu);
                    
                    // ユーザーモードでは非表示
                    if (!isEditMode) {
                        dropdownContainer.style.display = 'none';
                    }
                    
                    // 削除ボタンの後に追加
                    buttonContainer.appendChild(dropdownContainer);
                }
                
                // ドラッグ用の枠をタイトルバーの外（右側）に配置
                const dragHandle = document.createElement('div');
                dragHandle.className = 'compound-dropdown-drag-handle';
                dragHandle.style.position = 'absolute';
                dragHandle.style.width = '24px';
                dragHandle.style.height = '20px';
                dragHandle.style.backgroundColor = '#999';
                dragHandle.style.cursor = 'move';
                dragHandle.style.borderRadius = '2px';
                dragHandle.style.opacity = '0.6';
                dragHandle.style.boxSizing = 'border-box';
                dragHandle.style.zIndex = '1001';
                
                // プルダウンメニューの位置に基づいてドラッグハンドルの位置を更新
                const updateDragHandlePosition = () => {
                    const dropdownContainer = titleBar.querySelector('.compound-dropdown-container');
                    if (dropdownContainer) {
                        const containerRect = this.container.getBoundingClientRect();
                        const dropdownRect = dropdownContainer.getBoundingClientRect();
                        // プルダウンメニューの右側に配置
                        dragHandle.style.left = `${dropdownRect.right - containerRect.left + 2}px`;
                        dragHandle.style.top = `${dropdownRect.top - containerRect.top}px`;
                    } else {
                        // フォールバック：タイトルバーの右側に配置
                        const titleBarRect = titleBar.getBoundingClientRect();
                        const containerRect = this.container.getBoundingClientRect();
                        dragHandle.style.left = `${titleBarRect.right - containerRect.left + 2}px`;
                        dragHandle.style.top = `${titleBarRect.top - containerRect.top}px`;
                    }
                };
                
                // 初期位置を設定
                setTimeout(updateDragHandlePosition, 0);
                
                // ドラッグハンドルをクリックしたときはプルダウンメニューをドラッグ
                dragHandle.onmousedown = (e) => {
                    e.stopPropagation();
                    isDragging = true;
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    
                    // プルダウンメニューコンテナを取得
                    const dropdownContainer = titleBar.querySelector('.compound-dropdown-container');
                    if (dropdownContainer) {
                        // 現在の位置を取得（コンテナ内での絶対位置）
                        const rect = dropdownContainer.getBoundingClientRect();
                        const containerRect = this.container.getBoundingClientRect();
                        initialLeft = rect.left - containerRect.left;
                        initialTop = rect.top - containerRect.top;
                    }
                    
                    document.addEventListener('mousemove', handleDrag);
                    document.addEventListener('mouseup', handleDragEnd);
                };
                
                // プルダウンメニューをドラッグするための別のハンドラー（メインボタンから）
                const mainButton = titleBar.querySelector('.compound-main-button');
                if (mainButton) {
                    mainButton.onmousedown = (e) => {
                        // メインボタンをドラッグした場合はプルダウンメニューを移動
                        if (e.button === 0) { // 左クリックのみ
                            e.stopPropagation();
                            isDragging = true;
                            dragStartX = e.clientX;
                            dragStartY = e.clientY;
                            
                            const dropdownContainer = titleBar.querySelector('.compound-dropdown-container');
                            if (dropdownContainer) {
                                const rect = dropdownContainer.getBoundingClientRect();
                                const containerRect = this.container.getBoundingClientRect();
                                initialLeft = rect.left - containerRect.left;
                                initialTop = rect.top - containerRect.top;
                            }
                            
                            document.addEventListener('mousemove', handleDrag);
                            document.addEventListener('mouseup', handleDragEnd);
                        }
                    };
                }
                
                dragHandle.onmouseenter = () => {
                    dragHandle.style.opacity = '1';
                    dragHandle.style.backgroundColor = '#666';
                };
                dragHandle.onmouseleave = () => {
                    dragHandle.style.opacity = '0.6';
                    dragHandle.style.backgroundColor = '#999';
                };
                
                // ドラッグ処理を設定（プルダウンメニューコンテナのみを移動）
                let isDragging = false;
                let dragStartX = 0;
                let dragStartY = 0;
                let initialLeft = 0;
                let initialTop = 0;
                
                const handleDrag = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    
                    const dropdownContainer = titleBar.querySelector('.compound-dropdown-container');
                    if (!dropdownContainer) return;
                    
                    const deltaX = e.clientX - dragStartX;
                    const deltaY = e.clientY - dragStartY;
                    
                    // コンテナの現在の位置を取得
                    const containerRect = this.container.getBoundingClientRect();
                    
                    // 新しい位置を計算（コンテナ内での絶対位置）
                    const newLeft = initialLeft + deltaX;
                    const newTop = initialTop + deltaY;
                    
                    // 制限を設けずに自由に移動可能にする（負の値も許可）
                    dropdownContainer.style.position = 'absolute';
                    dropdownContainer.style.left = `${newLeft}px`;
                    dropdownContainer.style.top = `${newTop}px`;
                    dropdownContainer.style.marginLeft = '0';
                    
                    // ドラッグハンドルの位置も更新（プルダウンメニューの右側に配置）
                    const dropdownRect = dropdownContainer.getBoundingClientRect();
                    dragHandle.style.left = `${dropdownRect.right - containerRect.left + 2}px`;
                    dragHandle.style.top = `${dropdownRect.top - containerRect.top}px`;
                };
                
                const handleDragEnd = () => {
                    isDragging = false;
                    document.removeEventListener('mousemove', handleDrag);
                    document.removeEventListener('mouseup', handleDragEnd);
                };
                
                // コンテナに追加（タイトルバーの外）
                this.container.appendChild(dragHandle);
                
                // ユーザーモードでは非表示
                if (!isEditMode) {
                    dragHandle.style.display = 'none';
                }
                
                return titleBar;
            }

            createInputElement() {
                // コンパウンドコンポーネントは入力要素を持たない（プルダウンメニューはタイトルバーに配置）
                const body = document.createElement('div');
                body.style.padding = '10px';
                return body;
            }

            getInputElement() {
                return this.container.querySelector('.palette-body > div');
            }

            init() {
                super.init();
                // コンパウンドのタイトルバーをドラッグしたときの処理をカスタマイズ
                // super.init()で既にdraggableが設定されているので、それを上書き
                this.setupCompoundDrag();
                // 取り込まれたコンポーネントのドラッグ処理を設定
                this.setupContainedComponentDrag();
                
                // ユーザーモードではプルダウンメニューを非表示
                const titleBar = this.container.querySelector('.palette-top');
                if (titleBar) {
                    const dropdownContainer = titleBar.querySelector('.compound-dropdown-container');
                    if (dropdownContainer) {
                        if (!isEditMode) {
                            dropdownContainer.style.display = 'none';
                        } else {
                            dropdownContainer.style.display = 'inline-block';
                        }
                    }
                    
                    // ドラッグハンドルも同様に表示/非表示
                    const dragHandle = this.container.querySelector('.compound-dropdown-drag-handle');
                    if (dragHandle) {
                        if (!isEditMode) {
                            dragHandle.style.display = 'none';
                        } else {
                            dragHandle.style.display = 'block';
                            // 位置を更新
                            const titleBarRect = titleBar.getBoundingClientRect();
                            const containerRect = this.container.getBoundingClientRect();
                            dragHandle.style.left = `${titleBarRect.right - containerRect.left + 2}px`;
                            dragHandle.style.top = `${titleBarRect.top - containerRect.top}px`;
                        }
                    }
                }
            }

            showComponentList() {
                // コンパウンドコンポーネントに含まれるコンポーネントの情報を収集
                const componentData = [];
                const componentIdMap = {}; // 行番号（0ベース）からコンポーネントIDへのマッピング
                let componentNumber = 1;
                
                this.containedComponents.forEach(componentId => {
                    // コンポーネントを取得
                    let component = this.componentContainers[componentId];
                    if (!component) {
                        component = document.getElementById(componentId);
                    }
                    
                    if (component) {
                        const instance = $(component).data('instance');
                        if (instance) {
                            // class名を取得（システムが使っているクラス名を除外）
                            const classNames = component.className || '';
                            const classList = classNames.split(' ').filter(cls => {
                                return cls && 
                                       cls !== 'palette-container' && 
                                       cls !== 'ui-draggable' && 
                                       cls !== 'ui-resizable' &&
                                       cls !== 'ui-draggable-handle' &&
                                       cls !== 'ui-resizable-handle';
                            }).join(', ') || '';
                            
                            // コンポーネントの種類を取得
                            const componentType = instance.getComponentName ? instance.getComponentName() : 'Unknown';
                            
                            // コンパウンド内相対位置を取得
                            const offset = this.componentOffsets[componentId] || { left: 0, top: 0 };
                            const relativeLeft = offset.left !== undefined ? offset.left.toFixed(2) : '0.00';
                            const relativeTop = offset.top !== undefined ? offset.top.toFixed(2) : '0.00';
                            
                            const rowIndex = componentData.length; // 0ベースの行番号
                            componentIdMap[rowIndex] = componentId;
                            
                            componentData.push([
                                componentNumber.toString(),
                                classList,
                                componentType,
                                relativeLeft,
                                relativeTop,
                                '', // モード切替列は空文字列（後でボタンを挿入）
                                '', // 上に列は空文字列（後でボタンを挿入）
                                ''  // 下に列は空文字列（後でボタンを挿入）
                            ]);
                            
                            componentNumber++;
                        }
                    }
                });
                
                // 表計算コンポーネントを作成
                const spreadsheetComponent = new PaletteSpreadsheet(null, false, null, []);
                
                // 表計算コンポーネントが初期化されるまで待つ
                const initializeListSpreadsheet = () => {
                    const spreadsheetArea = spreadsheetComponent.getSpreadsheetArea();
                    if (!spreadsheetArea) {
                        console.warn('Spreadsheet area not found, retrying...');
                        setTimeout(initializeListSpreadsheet, 100);
                        return;
                    }
                    
                    // 既存のスプレッドシートを破棄
                    if (spreadsheetComponent.spreadsheet) {
                        try {
                            spreadsheetComponent.spreadsheet.destroy();
                        } catch (e) {
                            console.warn('Error destroying existing spreadsheet:', e);
                        }
                    }
                    
                    // 新しいスプレッドシートを初期化
                    const jspreadsheetLib = window.jspreadsheet || window.jexcel;
                    if (typeof jspreadsheetLib === 'undefined') {
                        console.error('jspreadsheet library is not loaded');
                        alert('エラー: jspreadsheetライブラリが読み込まれていません');
                        return;
                    }
                    
                    // データが空の場合は空行を追加
                    const allData = componentData.length === 0 ? [['', '', '', '', '', '', '', '']] : componentData;
                    
                    // コンポーネントのタイトルバーとサイズ調整ハンドルの表示/非表示を制御する関数
                    const updateCompoundModeVisibility = (component, mode) => {
                        if (!component) return;
                        
                        const titleBar = component.querySelector('.palette-top');
                        const instance = $(component).data('instance');
                        
                        if (mode === 'user') {
                            // ユーザーモード：タイトルバーとサイズ調整ハンドルを非表示
                            // switchToUserModeと同じ方法：visibility: hiddenとheight: 20pxを使用（レイアウトに影響しない）
                            if (titleBar) {
                                titleBar.style.visibility = 'hidden';
                                titleBar.style.height = '20px';
                            }
                            
                            // サイズ調整ハンドルを無効化
                            if (instance && $(component).resizable("instance")) {
                                $(component).resizable('disable');
                            }
                            
                            // リサイズハンドルを非表示
                            const resizeHandles = component.querySelectorAll('.ui-resizable-handle');
                            resizeHandles.forEach(handle => {
                                handle.style.display = 'none';
                            });
                        } else {
                            // 編集モード：タイトルバーとサイズ調整ハンドルを表示（編集モードの場合のみ）
                            if (isEditMode) {
                                if (titleBar) {
                                    titleBar.style.visibility = '';
                                    titleBar.style.height = '';
                                }
                                
                                // サイズ調整ハンドルを有効化
                                if (instance && $(component).resizable("instance")) {
                                    $(component).resizable('enable');
                                }
                                
                                // リサイズハンドルを表示
                                const resizeHandles = component.querySelectorAll('.ui-resizable-handle');
                                resizeHandles.forEach(handle => {
                                    handle.style.display = '';
                                });
                            }
                        }
                    };
                    
                    // z-indexを調整する関数
                    const adjustZIndex = (componentId, direction) => {
                        let component = self.componentContainers[componentId];
                        if (!component) {
                            component = document.getElementById(componentId);
                        }
                        
                        if (!component) return;
                        
                        // コンパウンド内のすべてのコンポーネントのz-indexを取得
                        const zIndexes = [];
                        self.containedComponents.forEach(id => {
                            let comp = self.componentContainers[id];
                            if (!comp) {
                                comp = document.getElementById(id);
                            }
                            if (comp) {
                                const computedStyle = window.getComputedStyle(comp);
                                const zIndex = parseInt(computedStyle.zIndex) || 0;
                                zIndexes.push({ id: id, zIndex: zIndex, element: comp });
                            }
                        });
                        
                        if (zIndexes.length === 0) return;
                        
                        if (direction === 'up') {
                            // 最大のz-indexを取得
                            const maxZIndex = Math.max(...zIndexes.map(item => item.zIndex));
                            // 対象コンポーネントのz-indexを最大値+1に設定
                            component.style.zIndex = (maxZIndex + 1).toString();
                        } else if (direction === 'down') {
                            // 最小のz-indexを取得
                            const minZIndex = Math.min(...zIndexes.map(item => item.zIndex));
                            // 対象コンポーネントのz-indexを最小値-1に設定
                            component.style.zIndex = (minZIndex - 1).toString();
                        }
                    };
                    
                    // 「上に」ボタンを作成する関数
                    const createUpButton = (rowIndex, componentId) => {
                        const button = document.createElement('button');
                        button.textContent = '↑';
                        button.style.cssText = 'width: 100%; height: 100%; padding: 2px; cursor: pointer; border: 1px solid #ccc; background-color: #6699ff; color: white; border-radius: 3px; font-size: 14px;';
                        button.title = '一番上に表示';
                        
                        button.onclick = function(e) {
                            e.stopPropagation();
                            adjustZIndex(componentId, 'up');
                        };
                        
                        return button;
                    };
                    
                    // 「下に」ボタンを作成する関数
                    const createDownButton = (rowIndex, componentId) => {
                        const button = document.createElement('button');
                        button.textContent = '↓';
                        button.style.cssText = 'width: 100%; height: 100%; padding: 2px; cursor: pointer; border: 1px solid #ccc; background-color: #6699ff; color: white; border-radius: 3px; font-size: 14px;';
                        button.title = '一番下に表示';
                        
                        button.onclick = function(e) {
                            e.stopPropagation();
                            adjustZIndex(componentId, 'down');
                        };
                        
                        return button;
                    };
                    
                    // モード切替ボタンを作成する関数
                    const createModeToggleButton = (rowIndex, componentId) => {
                        const button = document.createElement('button');
                        button.style.cssText = 'width: 100%; height: 100%; padding: 4px; cursor: pointer; border: 1px solid #ccc; background-color: #6699ff; color: white; border-radius: 3px; font-size: 12px;';
                        
                        // 現在の状態を取得してボタンのテキストを設定
                        let component = self.componentContainers[componentId];
                        if (!component) {
                            component = document.getElementById(componentId);
                        }
                        
                        if (component) {
                            // コンパウンドモードの状態を取得（デフォルトは'edit'）
                            const currentMode = component.getAttribute('data-compound-user-mode') || 'edit';
                            button.textContent = currentMode === 'user' ? 'ユーザー' : '編集';
                            button.title = currentMode === 'user' ? 'ユーザーモード：タイトルバーとサイズ調整ハンドルを非表示' : '編集モード：通常通り表示';
                            
                            button.onclick = function(e) {
                                e.stopPropagation();
                                
                                // 現在の状態を取得
                                let currentComponent = self.componentContainers[componentId];
                                if (!currentComponent) {
                                    currentComponent = document.getElementById(componentId);
                                }
                                
                                if (currentComponent) {
                                    const instance = $(currentComponent).data('instance');
                                    
                                    // switchToUserModeと同じ処理：子要素の表示状態を保存（タイトルバーを非表示にする前）
                                    if (instance && instance.linkedChildId) {
                                        const childElement = document.getElementById(instance.linkedChildId);
                                        if (childElement) {
                                            // 現在の表示状態を保存（displayが'none'でない場合は表示されているとみなす）
                                            const currentDisplay = childElement.style.display || '';
                                            const isVisible = currentDisplay !== 'none';
                                            currentComponent.setAttribute('data-child-visible', isVisible ? 'true' : 'false');
                                        }
                                    }
                                    
                                    const currentMode = currentComponent.getAttribute('data-compound-user-mode') || 'edit';
                                    const newMode = currentMode === 'user' ? 'edit' : 'user';
                                    
                                    // 状態を更新
                                    currentComponent.setAttribute('data-compound-user-mode', newMode);
                                    
                                    // ボタンのテキストとツールチップを更新
                                    button.textContent = newMode === 'user' ? 'ユーザー' : '編集';
                                    button.title = newMode === 'user' ? 'ユーザーモード：タイトルバーとサイズ調整ハンドルを非表示' : '編集モード：通常通り表示';
                                    
                                    // switchToUserModeと同じ処理：initializeResizableを呼び出す
                                    if (instance && typeof instance.initializeResizable === 'function') {
                                        instance.initializeResizable();
                                    }
                                    
                                    // タイトルバーとサイズ調整ハンドルの表示/非表示を更新
                                    updateCompoundModeVisibility(currentComponent, newMode);
                                    
                                    // switchToUserModeと同じ処理：子要素の表示状態を復元（タイトルバーを非表示にした後）
                                    if (instance && typeof instance.restoreChildVisibility === 'function') {
                                        instance.restoreChildVisibility();
                                    }
                                }
                            };
                        }
                        
                        return button;
                    };
                    
                    // 現在選択されているコンポーネントIDを保持
                    let selectedComponentId = null;
                    const self = this;
                    
                    // 全てのコンポーネントの背景色を元に戻す関数
                    const clearAllComponentBackgrounds = () => {
                        self.containedComponents.forEach(componentId => {
                            let component = self.componentContainers[componentId];
                            if (!component) {
                                component = document.getElementById(componentId);
                            }
                            if (component) {
                                component.style.backgroundColor = '';
                            }
                        });
                        selectedComponentId = null;
                    };
                    
                    // 行選択時の処理関数
                    const handleRowSelection = (rowIndex) => {
                        // rowIndexは0ベースで、データ行のインデックス（ヘッダー行は含まない）
                        // データが入っていない行（componentData.length以上）の場合は、全ての背景色を元に戻す
                        if (rowIndex >= componentData.length) {
                            clearAllComponentBackgrounds();
                            return;
                        }
                        
                        const componentId = componentIdMap[rowIndex];
                        
                        if (componentId) {
                            // 以前に選択されていたコンポーネントの背景色を元に戻す
                            if (selectedComponentId && selectedComponentId !== componentId) {
                                let prevComponent = self.componentContainers[selectedComponentId];
                                if (!prevComponent) {
                                    prevComponent = document.getElementById(selectedComponentId);
                                }
                                if (prevComponent) {
                                    prevComponent.style.backgroundColor = '';
                                }
                            }
                            
                            // 新しいコンポーネントの背景色を変更
                            let component = self.componentContainers[componentId];
                            if (!component) {
                                component = document.getElementById(componentId);
                            }
                            if (component) {
                                component.style.backgroundColor = '#e3f2fd'; // 薄い青色
                                selectedComponentId = componentId;
                            }
                        } else {
                            // componentIdMapに該当する行がない場合（空行など）は、全ての背景色を元に戻す
                            clearAllComponentBackgrounds();
                        }
                    };
                    
                    spreadsheetComponent.spreadsheet = jspreadsheetLib(spreadsheetArea, {
                        data: allData,
                        columns: [
                            { type: 'text', width: 60, title: '番号' },
                            { type: 'text', width: 100, title: 'class名' },
                            { type: 'text', width: 100, title: '種類' },
                            { type: 'text', width: 100, title: '水平方向' },
                            { type: 'text', width: 100, title: '垂直方向' },
                            { type: 'text', width: 50, title: 'モード' },
                            { type: 'text', width: 50, title: '上に' },
                            { type: 'text', width: 50, title: '下に' }
                        ],
                        minDimensions: [Math.max(componentData.length, 1), 8],
                        tableOverflow: true,
                        tableWidth: '100%',
                        tableHeight: '100%',
                        onselection: function(instance, cell, x, y, origin, end) {
                            // モード切替列（6列目、インデックス5）のボタンクリックは、ボタンのonclickで処理されるため、
                            // ここでは行選択の処理のみを行う
                            
                            // 行が選択されたときの処理
                            // yは0ベースの行インデックス（データ行のみ、ヘッダー行は含まない）
                            if (y !== undefined && y !== null) {
                                handleRowSelection(y);
                            }
                        }
                    });
                    
                    // モード切替列にボタンを挿入
                    setTimeout(() => {
                        const table = spreadsheetArea.querySelector('table');
                        if (table) {
                            let modeToggleColumnIndex = -1;
                            
                            // ヘッダー行から「モード切替」列のインデックスを取得
                            // jspreadsheetでは、ヘッダー行はthead内のth要素または最初のtrのth要素
                            const thead = table.querySelector('thead');
                            if (thead) {
                                const headerRow = thead.querySelector('tr');
                                if (headerRow) {
                                    const headerCells = headerRow.querySelectorAll('th');
                                    headerCells.forEach((cell, index) => {
                                        const cellText = cell.textContent.trim();
                                        if (cellText === 'モード') {
                                            modeToggleColumnIndex = index;
                                            console.log('Found モード column at index:', index);
                                        }
                                    });
                                }
                            }
                            
                            // theadが見つからない場合は、最初のtrをヘッダー行として扱う
                            if (modeToggleColumnIndex === -1) {
                                const firstRow = table.querySelector('tr');
                                if (firstRow) {
                                    const headerCells = firstRow.querySelectorAll('th, td');
                                    headerCells.forEach((cell, index) => {
                                        const cellText = cell.textContent.trim();
                                        if (cellText === 'モード') {
                                            modeToggleColumnIndex = index;
                                            console.log('Found モード column at index (first row):', index);
                                        }
                                    });
                                }
                            }
                            
                            // ヘッダーから見つからない場合は、エラーをログに出力
                            if (modeToggleColumnIndex === -1) {
                                console.error('モード column not found in header');
                                return;
                            }
                            
                            console.log('Mode toggle column index:', modeToggleColumnIndex);
                            
                            // 「上に」と「下に」列のインデックスを取得
                            let upColumnIndex = -1;
                            let downColumnIndex = -1;
                            
                            const theadForButtons = table.querySelector('thead');
                            if (theadForButtons) {
                                const headerRowForButtons = theadForButtons.querySelector('tr');
                                if (headerRowForButtons) {
                                    const headerCellsForButtons = headerRowForButtons.querySelectorAll('th');
                                    headerCellsForButtons.forEach((cell, index) => {
                                        const cellText = cell.textContent.trim();
                                        if (cellText === '上に') {
                                            upColumnIndex = index;
                                            console.log('Found 上に column at index:', index);
                                        } else if (cellText === '下に') {
                                            downColumnIndex = index;
                                            console.log('Found 下に column at index:', index);
                                        }
                                    });
                                }
                            }
                            
                            // theadが見つからない場合は、最初のtrをヘッダー行として扱う
                            if (upColumnIndex === -1 || downColumnIndex === -1) {
                                const firstRow = table.querySelector('tr');
                                if (firstRow) {
                                    const headerCells = firstRow.querySelectorAll('th, td');
                                    headerCells.forEach((cell, index) => {
                                        const cellText = cell.textContent.trim();
                                        if (cellText === '上に' && upColumnIndex === -1) {
                                            upColumnIndex = index;
                                            console.log('Found 上に column at index (first row):', index);
                                        } else if (cellText === '下に' && downColumnIndex === -1) {
                                            downColumnIndex = index;
                                            console.log('Found 下に column at index (first row):', index);
                                        }
                                    });
                                }
                            }
                            
                            // ヘッダーから見つからない場合は、データ配列の順序から推測（最後から2番目と最後の列）
                            if (upColumnIndex === -1 || downColumnIndex === -1) {
                                // データ配列は [番号, class名, 種類, 水平方向, 垂直方向, モード, 上に, 下に]
                                // なので、インデックス6が「上に」、インデックス7が「下に」
                                if (upColumnIndex === -1) {
                                    upColumnIndex = 6;
                                    console.log('Using default index 6 for 上に column');
                                }
                                if (downColumnIndex === -1) {
                                    downColumnIndex = 7;
                                    console.log('Using default index 7 for 下に column');
                                }
                            }
                            
                            console.log('Up column index:', upColumnIndex, 'Down column index:', downColumnIndex);
                            
                            const tbody = table.querySelector('tbody');
                            if (tbody) {
                                const rows = tbody.querySelectorAll('tr');
                                rows.forEach((row, rowIndex) => {
                                    if (rowIndex < componentData.length) {
                                        const cells = row.querySelectorAll('td');
                                        const componentId = componentIdMap[rowIndex];
                                        
                                        // モード切替列にボタンを挿入
                                        if (cells.length > modeToggleColumnIndex) {
                                            const modeToggleCell = cells[modeToggleColumnIndex];
                                            
                                            if (componentId && modeToggleCell) {
                                                // 既存の内容をクリア
                                                modeToggleCell.innerHTML = '';
                                                modeToggleCell.style.padding = '0';
                                                modeToggleCell.style.textAlign = 'center';
                                                
                                                // ボタンを挿入
                                                const button = createModeToggleButton(rowIndex, componentId);
                                                modeToggleCell.appendChild(button);
                                                
                                                // 初期状態を適用
                                                let component = self.componentContainers[componentId];
                                                if (!component) {
                                                    component = document.getElementById(componentId);
                                                }
                                                if (component) {
                                                    const compoundMode = component.getAttribute('data-compound-user-mode') || 'edit';
                                                    updateCompoundModeVisibility(component, compoundMode);
                                                }
                                            }
                                        }
                                        
                                        // 「上に」列にボタンを挿入
                                        if (upColumnIndex !== -1 && cells.length > upColumnIndex) {
                                            const upCell = cells[upColumnIndex];
                                            if (componentId && upCell) {
                                                upCell.innerHTML = '';
                                                upCell.style.padding = '0';
                                                upCell.style.textAlign = 'center';
                                                const upButton = createUpButton(rowIndex, componentId);
                                                upCell.appendChild(upButton);
                                            }
                                        }
                                        
                                        // 「下に」列にボタンを挿入
                                        if (downColumnIndex !== -1 && cells.length > downColumnIndex) {
                                            const downCell = cells[downColumnIndex];
                                            if (componentId && downCell) {
                                                downCell.innerHTML = '';
                                                downCell.style.padding = '0';
                                                downCell.style.textAlign = 'center';
                                                const downButton = createDownButton(rowIndex, componentId);
                                                downCell.appendChild(downButton);
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    }, 100);
                    
                    // 表計算エリア内の行クリックイベントも監視（onselectionが動作しない場合のフォールバック）
                    setTimeout(() => {
                        const table = spreadsheetArea.querySelector('table');
                        if (table) {
                            table.addEventListener('click', function(e) {
                                // ボタンがクリックされた場合は、ボタンのonclickで処理されるため、ここでは処理しない
                                if (e.target.tagName === 'BUTTON') {
                                    return;
                                }
                                
                                const cell = e.target.closest('td');
                                if (cell) {
                                    const row = cell.parentElement;
                                    const tbody = row.parentElement;
                                    const rowIndex = Array.from(tbody.children).indexOf(row);
                                    
                                    // rowIndexは0ベースで、データ行のインデックス（ヘッダー行は含まない）
                                    // データが入っていない行も処理する（背景色を元に戻すため）
                                    if (rowIndex >= 0) {
                                        handleRowSelection(rowIndex);
                                    }
                                }
                            });
                        }
                    }, 300);
                    
                    console.log('Component list spreadsheet initialized with', componentData.length, 'components');
                    
                    // 「相対位置同期」ボタンを追加
                    setTimeout(() => {
                        const controlsArea = spreadsheetComponent.container.querySelector('.spreadsheet-controls');
                        if (controlsArea) {
                            const syncButton = document.createElement('button');
                            syncButton.textContent = '相対位置同期';
                            syncButton.className = 'spreadsheet-btn';
                            syncButton.onclick = (e) => {
                                e.stopPropagation();
                                
                                // スプレッドシートから各データ行の「水平方向」と「垂直方向」の値を取得
                                if (!spreadsheetComponent.spreadsheet) {
                                    alert('スプレッドシートが初期化されていません');
                                    return;
                                }
                                
                                const spreadsheetData = spreadsheetComponent.spreadsheet.getData();
                                const self = this;
                                
                                // データ配列の順序に基づいて列インデックスを取得
                                // データ配列は [番号, class名, 種類, 水平方向, 垂直方向, モード, 上に, 下に]
                                // なので、インデックス3が「水平方向」、インデックス4が「垂直方向」
                                // jspreadsheetのgetData()は列の定義順序に従うため、データ配列の順序を使用
                                const horizontalColumnIndex = 3;
                                const verticalColumnIndex = 4;
                                
                                console.log('Using data array order - Horizontal column index:', horizontalColumnIndex, 'Vertical column index:', verticalColumnIndex);
                                
                                // 各データ行を処理
                                spreadsheetData.forEach((row, rowIndex) => {
                                    if (rowIndex < componentData.length) {
                                        const componentId = componentIdMap[rowIndex];
                                        if (componentId) {
                                            // 水平方向と垂直方向の値を取得
                                            const horizontalValue = row[horizontalColumnIndex];
                                            const verticalValue = row[verticalColumnIndex];
                                            
                                            console.log(`Row ${rowIndex}: componentId=${componentId}, horizontalValue="${horizontalValue}", verticalValue="${verticalValue}"`);
                                            
                                            // 数値に変換
                                            const horizontalNum = parseFloat(horizontalValue);
                                            const verticalNum = parseFloat(verticalValue);
                                            
                                            console.log(`Row ${rowIndex}: horizontalNum=${horizontalNum}, verticalNum=${verticalNum}, isNaN=${isNaN(horizontalNum) || isNaN(verticalNum)}`);
                                            
                                            if (!isNaN(horizontalNum) && !isNaN(verticalNum)) {
                                                // componentOffsetsを更新
                                                self.componentOffsets[componentId] = {
                                                    left: horizontalNum,
                                                    top: verticalNum
                                                };
                                                
                                                // コンポーネントの実際の位置を更新
                                                let component = self.componentContainers[componentId];
                                                if (!component) {
                                                    component = document.getElementById(componentId);
                                                }
                                                
                                                if (component) {
                                                    // コンパウンドのstyle.leftとstyle.topを取得
                                                    const compoundLeft = parseFloat(self.container.style.left) || 0;
                                                    const compoundTop = parseFloat(self.container.style.top) || 0;
                                                    
                                                    // 現在のコンポーネントの位置を取得
                                                    const currentLeft = parseFloat(component.style.left) || 0;
                                                    const currentTop = parseFloat(component.style.top) || 0;
                                                    
                                                    // コンポーネントの新しい位置を計算（コンパウンドのstyle.left/top + 相対位置）
                                                    const newLeft = compoundLeft + horizontalNum;
                                                    const newTop = compoundTop + verticalNum;
                                                    
                                                    console.log(`Row ${rowIndex}: componentId=${componentId}, current(${currentLeft}, ${currentTop}), compound(${compoundLeft}, ${compoundTop}), relative(${horizontalNum}, ${verticalNum}), new(${newLeft}, ${newTop})`);
                                                    
                                                    // jQuery UIのdraggableを一時的に無効化して位置を更新
                                                    const $component = $(component);
                                                    const isDraggable = $component.data('ui-draggable');
                                                    if (isDraggable) {
                                                        $component.draggable('disable');
                                                    }
                                                    
                                                    // コンポーネントの位置を更新
                                                    component.style.left = newLeft + 'px';
                                                    component.style.top = newTop + 'px';
                                                    
                                                    // 位置更新後にdraggableを再有効化
                                                    if (isDraggable) {
                                                        setTimeout(() => {
                                                            $component.draggable('enable');
                                                        }, 10);
                                                    }
                                                    
                                                    console.log(`Updated position for ${componentId}: compound(${compoundLeft}, ${compoundTop}) + relative(${horizontalNum}, ${verticalNum}) = new(${newLeft}, ${newTop})`);
                                                } else {
                                                    console.error(`Component ${componentId} not found`);
                                                }
                                            } else {
                                                console.warn(`Row ${rowIndex}: Invalid numeric values - horizontal: ${horizontalValue}, vertical: ${verticalValue}`);
                                            }
                                        }
                                    }
                                });
                            };
                            controlsArea.appendChild(syncButton);
                            
                            // 「class名同期」ボタンを追加
                            const classSyncButton = document.createElement('button');
                            classSyncButton.textContent = 'class名同期';
                            classSyncButton.className = 'spreadsheet-btn';
                            classSyncButton.onclick = (e) => {
                                e.stopPropagation();
                                
                                // スプレッドシートから各データ行の「class名」の値を取得
                                if (!spreadsheetComponent.spreadsheet) {
                                    alert('スプレッドシートが初期化されていません');
                                    return;
                                }
                                
                                const spreadsheetData = spreadsheetComponent.spreadsheet.getData();
                                const self = this;
                                
                                // 「class名」列のインデックス（データ配列の順序に基づく）
                                // データ配列は [番号, class名, 種類, 水平方向, 垂直方向, モード, 上に, 下に]
                                const classNameColumnIndex = 1;
                                
                                // システムで使っているクラス名のリスト
                                const systemClassNames = ['palette-container', 'ui-draggable', 'ui-resizable', 'ui-draggable-handle', 'ui-resizable-handle'];
                                
                                // 各データ行を処理
                                spreadsheetData.forEach((row, rowIndex) => {
                                    if (rowIndex < componentData.length) {
                                        const componentId = componentIdMap[rowIndex];
                                        if (componentId) {
                                            // 「class名」列の値を取得
                                            const classNameValue = row[classNameColumnIndex] || '';
                                            const newClassNames = classNameValue.split(',').map(cls => cls.trim()).filter(cls => cls);
                                            
                                            // コンポーネントを取得
                                            let component = self.componentContainers[componentId];
                                            if (!component) {
                                                component = document.getElementById(componentId);
                                            }
                                            
                                            if (component) {
                                                // 現在のクラス名からシステムクラス名を抽出
                                                const currentClassNames = (component.className || '').split(' ').filter(cls => cls);
                                                const systemClasses = currentClassNames.filter(cls => systemClassNames.includes(cls));
                                                
                                                // 新しいクラス名を構築（システムクラス名 + リストのclass名）
                                                const finalClassNames = [...systemClasses, ...newClassNames];
                                                
                                                // コンポーネントのクラス名を更新
                                                component.className = finalClassNames.join(' ');
                                                
                                                console.log(`Updated class names for ${componentId}: system(${systemClasses.join(', ')}), new(${newClassNames.join(', ')}), final(${finalClassNames.join(', ')})`);
                                            }
                                        }
                                    }
                                });
                            };
                            controlsArea.appendChild(classSyncButton);
                        }
                    }, 300);
                    
                    // 表計算コンポーネントの削除ボタンに、背景色をクリアする処理を追加
                    setTimeout(() => {
                        const deleteButton = spreadsheetComponent.container.querySelector('.delete-button');
                        if (deleteButton) {
                            const originalOnclick = deleteButton.onclick;
                            deleteButton.onclick = function(e) {
                                // 全てのコンポーネントの背景色を元に戻す
                                clearAllComponentBackgrounds();
                                // 元の削除処理を実行
                                if (originalOnclick) {
                                    originalOnclick.call(this, e);
                                } else {
                                    spreadsheetComponent.container.remove();
                                }
                            };
                        }
                    }, 400);
                };
                
                // 初期化を試みる（DOMの準備を待つ）
                setTimeout(initializeListSpreadsheet, 200);
            }

            activateClickImportMode() {
                // クリック取り込みモードを有効にする
                clickImportModeCompound = this;
                alert('クリック取り込みモードが有効になりました。取り込みたいコンポーネントのタイトルバーをクリックしてください。');
                
                // ボタンの見た目を変更して、モードが有効であることを示す
                const inputElement = this.getInputElement();
                const titleBar = this.container.querySelector('.palette-top');
                if (titleBar) {
                    const clickImportMenuItem = titleBar.querySelector('.compound-click-import-button');
                    if (clickImportMenuItem) {
                        clickImportMenuItem.style.backgroundColor = '#ff6600';
                        clickImportMenuItem.textContent = 'click (実行中...)';
                    }
                }
            }

            deactivateClickImportMode() {
                // クリック取り込みモードを無効にする
                if (clickImportModeCompound === this) {
                    clickImportModeCompound = null;
                    
                    // ボタンの見た目を元に戻す
                    const titleBar = this.container.querySelector('.palette-top');
                    if (titleBar) {
                        const clickImportMenuItem = titleBar.querySelector('.compound-click-import-button');
                        if (clickImportMenuItem) {
                            clickImportMenuItem.style.backgroundColor = '#f5f5f5';
                            clickImportMenuItem.textContent = 'click';
                        }
                    }
                }
            }

            isComponentImportable(componentId, instanceId) {
                // コンポーネントが取り込み可能かどうかをチェック
                const self = this;
                
                // 自分自身は除外
                if (componentId === self.id || instanceId === self.id) {
                    return false;
                }
                
                // すべてのコンパウンドコンポーネントのcontainedComponentsを収集
                const allComponents = document.querySelectorAll('.palette-container');
                const allContainedComponents = new Set();
                
                allComponents.forEach(component => {
                    const instance = $(component).data('instance');
                    if (instance && instance.getComponentType && instance.getComponentType() === 'compound') {
                        if (instance.containedComponents && Array.isArray(instance.containedComponents)) {
                            instance.containedComponents.forEach(compId => {
                                allContainedComponents.add(compId);
                            });
                        }
                        if (instance.componentContainers && typeof instance.componentContainers === 'object') {
                            Object.keys(instance.componentContainers).forEach(compId => {
                                allContainedComponents.add(compId);
                            });
                        }
                    }
                });
                
                // 既に他のコンパウンドに含まれているかチェック
                const isContained = allContainedComponents.has(componentId) || allContainedComponents.has(instanceId);
                
                return !isContained;
            }

            setupCompoundDrag() {
                // コンパウンドのタイトルバーをドラッグしたとき、取り込まれたコンポーネントも一緒に移動
                const self = this;
                
                console.log(`Setting up compound drag for ${this.id}, containedComponents:`, this.containedComponents);
                console.log(`containedComponents.length:`, this.containedComponents.length);
                
                // 既存のdraggableを破棄して再設定
                if ($(this.container).draggable("instance")) {
                    $(this.container).draggable("destroy");
                }
                
                $(this.container).draggable({
                    handle: '.palette-top',
                    start: function(event, ui) {
                        // ドラッグ開始時の位置を記録
                        const startLeft = parseFloat(self.container.style.left) || 0;
                        const startTop = parseFloat(self.container.style.top) || 0;
                        self.dragStartPos = {
                            left: startLeft,
                            top: startTop
                        };
                        
                        console.log(`Compound drag start for ${self.id}`);
                        console.log(`containedComponents at drag start:`, self.containedComponents);
                        console.log(`containedComponents.length at drag start:`, self.containedComponents.length);
                        
                        // 取り込まれたコンポーネントの開始位置も記録
                        if (!self.componentStartPos) {
                            self.componentStartPos = {};
                        }
                        
                        // 再帰的にすべてのコンポーネント（直接・間接的に含まれるコンポーネント）を取得
                        const getAllContainedComponents = (compoundInstance) => {
                            const allComponents = [];
                            if (compoundInstance.containedComponents && Array.isArray(compoundInstance.containedComponents)) {
                                compoundInstance.containedComponents.forEach(compId => {
                                    allComponents.push(compId);
                                    // コンポーネントがコンパウンドコンポーネントの場合、その中に含まれるコンポーネントも取得
                                    let comp = compoundInstance.componentContainers[compId];
                                    if (!comp) {
                                        comp = document.getElementById(compId);
                                    }
                                    if (comp) {
                                        const compInstance = $(comp).data('instance');
                                        if (compInstance && compInstance.getComponentType && compInstance.getComponentType() === 'compound') {
                                            // 再帰的に取得
                                            const nestedComponents = getAllContainedComponents(compInstance);
                                            allComponents.push(...nestedComponents);
                                        }
                                    }
                                });
                            }
                            return allComponents;
                        };
                        
                        // 削除されたコンポーネントをcontainedComponentsから削除
                        self.containedComponents = self.containedComponents.filter(compId => {
                            let comp = self.componentContainers[compId];
                            if (!comp) {
                                comp = document.getElementById(compId);
                            }
                            if (!comp || !document.body.contains(comp)) {
                                // コンポーネントが存在しない、またはDOMから削除されている場合はcontainedComponentsからも削除
                                delete self.componentOffsets[compId];
                                delete self.componentContainers[compId];
                                console.log(`Removed deleted component ${compId} from compound ${self.id} during drag start`);
                                return false;
                            }
                            return true;
                        });
                        
                        // すべてのコンポーネント（直接・間接的に含まれるコンポーネント）を取得
                        const allComponentsToMove = getAllContainedComponents(self);
                        console.log(`Components to move (including nested):`, allComponentsToMove);
                        
                        allComponentsToMove.forEach(componentId => {
                            // まずcomponentContainersから取得を試みる
                            let component = self.componentContainers[componentId];
                            // 見つからない場合はgetElementByIdで取得
                            if (!component) {
                                component = document.getElementById(componentId);
                                // 見つかった場合はcomponentContainersに保存
                                if (component) {
                                    self.componentContainers[componentId] = component;
                                }
                            }
                            
                            // 他のコンパウンドコンポーネントのcomponentContainersからも取得を試みる
                            if (!component) {
                                document.querySelectorAll('.palette-container').forEach(container => {
                                    const instance = $(container).data('instance');
                                    if (instance && instance.componentContainers && instance.componentContainers[componentId]) {
                                        component = instance.componentContainers[componentId];
                                    }
                                });
                            }
                            
                            if (component && document.body.contains(component)) {
                                const compLeft = parseFloat(component.style.left) || 0;
                                const compTop = parseFloat(component.style.top) || 0;
                                self.componentStartPos[componentId] = {
                                    left: compLeft,
                                    top: compTop
                                };
                                console.log(`Recorded start position for component ${componentId}:`, self.componentStartPos[componentId]);
                            } else {
                                if (!component) {
                                    console.warn(`Component ${componentId} not found during drag start`);
                                } else {
                                    console.warn(`Component ${componentId} is not in DOM during drag start`);
                                }
                            }
                        });
                    },
                    drag: function(event, ui) {
                        // ドラッグ中に取り込まれたコンポーネントも一緒に移動
                        const deltaX = ui.position.left - self.dragStartPos.left;
                        const deltaY = ui.position.top - self.dragStartPos.top;
                        
                        // 再帰的にすべてのコンポーネント（直接・間接的に含まれるコンポーネント）を取得
                        const getAllContainedComponents = (compoundInstance) => {
                            const allComponents = [];
                            if (compoundInstance.containedComponents && Array.isArray(compoundInstance.containedComponents)) {
                                compoundInstance.containedComponents.forEach(compId => {
                                    allComponents.push(compId);
                                    // コンポーネントがコンパウンドコンポーネントの場合、その中に含まれるコンポーネントも取得
                                    let comp = compoundInstance.componentContainers[compId];
                                    if (!comp) {
                                        comp = document.getElementById(compId);
                                    }
                                    if (comp) {
                                        const compInstance = $(comp).data('instance');
                                        if (compInstance && compInstance.getComponentType && compInstance.getComponentType() === 'compound') {
                                            // 再帰的に取得
                                            const nestedComponents = getAllContainedComponents(compInstance);
                                            allComponents.push(...nestedComponents);
                                        }
                                    }
                                });
                            }
                            return allComponents;
                        };
                        
                        // すべてのコンポーネント（直接・間接的に含まれるコンポーネント）を取得
                        const allComponentsToMove = getAllContainedComponents(self);
                        
                        allComponentsToMove.forEach(componentId => {
                            // まずcomponentContainersから取得を試みる
                            let component = self.componentContainers[componentId];
                            // 見つからない場合はgetElementByIdで取得
                            if (!component) {
                                component = document.getElementById(componentId);
                                // 見つかった場合はcomponentContainersに保存
                                if (component) {
                                    self.componentContainers[componentId] = component;
                                }
                            }
                            
                            // 他のコンパウンドコンポーネントのcomponentContainersからも取得を試みる
                            if (!component) {
                                document.querySelectorAll('.palette-container').forEach(container => {
                                    const instance = $(container).data('instance');
                                    if (instance && instance.componentContainers && instance.componentContainers[componentId]) {
                                        component = instance.componentContainers[componentId];
                                    }
                                });
                            }
                            
                            if (component && document.body.contains(component) && self.componentStartPos && self.componentStartPos[componentId]) {
                                const startPos = self.componentStartPos[componentId];
                                component.style.left = (startPos.left + deltaX) + 'px';
                                component.style.top = (startPos.top + deltaY) + 'px';
                            } else {
                                if (!component || !document.body.contains(component)) {
                                    console.warn(`Component ${componentId} not found or removed during drag`);
                                } else if (!self.componentStartPos || !self.componentStartPos[componentId]) {
                                    console.warn(`Start position not found for component ${componentId}`);
                                }
                            }
                        });
                    },
                    stop: function(event, ui) {
                        // ドラッグ終了時に相対位置を更新
                        const compoundRect = self.container.getBoundingClientRect();
                        
                        // 削除されたコンポーネントをcontainedComponentsから削除
                        self.containedComponents = self.containedComponents.filter(compId => {
                            let comp = self.componentContainers[compId];
                            if (!comp) {
                                comp = document.getElementById(compId);
                            }
                            if (!comp || !document.body.contains(comp)) {
                                // コンポーネントが存在しない、またはDOMから削除されている場合はcontainedComponentsからも削除
                                delete self.componentOffsets[compId];
                                delete self.componentContainers[compId];
                                console.log(`Removed deleted component ${compId} from compound ${self.id} during drag stop`);
                                return false;
                            }
                            return true;
                        });
                        
                        // containedComponentsのコピーを作成して使用（クロージャの問題を回避）
                        const componentsToUpdate = Array.from(self.containedComponents);
                        
                        componentsToUpdate.forEach(componentId => {
                            // まずcomponentContainersから取得を試みる
                            let component = self.componentContainers[componentId];
                            // 見つからない場合はgetElementByIdで取得
                            if (!component) {
                                component = document.getElementById(componentId);
                                // 見つかった場合はcomponentContainersに保存
                                if (component) {
                                    self.componentContainers[componentId] = component;
                                }
                            }
                            
                            if (component && document.body.contains(component)) {
                                const componentRect = component.getBoundingClientRect();
                                const relativeLeft = componentRect.left - compoundRect.left;
                                const relativeTop = componentRect.top - compoundRect.top;
                                
                                self.componentOffsets[componentId] = {
                                    left: relativeLeft,
                                    top: relativeTop
                                };
                            }
                        });
                        // 開始位置をクリア
                        self.componentStartPos = null;
                    }
                });
            }

            setupContainedComponentDrag() {
                // 取り込まれたコンポーネントのタイトルバーをドラッグしたときの処理
                const self = this;
                
                // 既存のコンポーネントと新しく取り込まれたコンポーネントの両方に適用
                this.updateContainedComponentDragHandlers();
            }

            updateContainedComponentDragHandlers() {
                const self = this;
                
                this.containedComponents.forEach(componentId => {
                    // まずcomponentContainersから取得を試みる
                    let component = this.componentContainers[componentId];
                    // 見つからない場合はgetElementByIdで取得
                    if (!component) {
                        component = document.getElementById(componentId);
                        // 見つかった場合はcomponentContainersに保存
                        if (component) {
                            this.componentContainers[componentId] = component;
                        }
                    }
                    
                    if (component) {
                        // 既存のdraggableがある場合は、stopイベントに相対位置更新処理を追加
                        if ($(component).draggable("instance")) {
                            // 既存のdraggableのstopイベントに相対位置更新処理を追加
                            $(component).on('dragstop', function(event, ui) {
                                // ドラッグ終了時に相対位置を更新
                                const compoundRect = self.container.getBoundingClientRect();
                                const componentRect = component.getBoundingClientRect();
                                
                                const relativeLeft = componentRect.left - compoundRect.left;
                                const relativeTop = componentRect.top - compoundRect.top;
                                
                                self.componentOffsets[componentId] = {
                                    left: relativeLeft,
                                    top: relativeTop
                                };
                                
                                console.log(`Updated offset for component ${componentId}:`, self.componentOffsets[componentId]);
                            });
                        } else {
                            // draggableが存在しない場合は、新しく設定
                            $(component).draggable({
                                handle: '.palette-top',
                                stop: function(event, ui) {
                                    // ドラッグ終了時に相対位置を更新
                                    const compoundRect = self.container.getBoundingClientRect();
                                    const componentRect = component.getBoundingClientRect();
                                    
                                    const relativeLeft = componentRect.left - compoundRect.left;
                                    const relativeTop = componentRect.top - compoundRect.top;
                                    
                                    self.componentOffsets[componentId] = {
                                        left: relativeLeft,
                                        top: relativeTop
                                    };
                                    
                                    console.log(`Updated offset for component ${componentId}:`, self.componentOffsets[componentId]);
                                }
                            });
                        }
                    }
                });
            }

            addComponent(componentId) {
                if (this.containedComponents.indexOf(componentId) === -1) {
                    this.containedComponents.push(componentId);
                    
                    // 相対位置を計算して保存
                    const component = document.getElementById(componentId);
                    if (component) {
                        // componentContainersに保存
                        this.componentContainers[componentId] = component;
                        
                        const compoundRect = this.container.getBoundingClientRect();
                        const componentRect = component.getBoundingClientRect();
                        
                        const relativeLeft = componentRect.left - compoundRect.left;
                        const relativeTop = componentRect.top - compoundRect.top;
                        
                        this.componentOffsets[componentId] = {
                            left: relativeLeft,
                            top: relativeTop
                        };
                        
                        // ドラッグ処理を設定
                        this.updateContainedComponentDragHandlers();
                        
                        // 削除ボタンの処理をオーバーライドして、コンパウンドからも削除するようにする
                        this.setupComponentDeleteHandler(componentId, component);
                        
                        console.log(`Added component ${componentId} to compound ${this.id}`);
                        
                        // TeXコンポーネントの場合、関連するdisplayComponentも自動的に追加
                        const instance = $(component).data('instance');
                        if (instance && instance.getComponentType && instance.getComponentType() === 'tex') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                if (this.containedComponents.indexOf(displayComponentId) === -1) {
                                    console.log(`Auto-adding TeX display component ${displayComponentId} for TeX component ${componentId}`);
                                    // 再帰的にaddComponentを呼び出さず、直接追加処理を行う（無限ループを防ぐため）
                                    this.containedComponents.push(displayComponentId);
                                    this.componentContainers[displayComponentId] = instance.displayComponent.container;
                                    
                                    const displayComponentRect = instance.displayComponent.container.getBoundingClientRect();
                                    const displayRelativeLeft = displayComponentRect.left - compoundRect.left;
                                    const displayRelativeTop = displayComponentRect.top - compoundRect.top;
                                    
                                    this.componentOffsets[displayComponentId] = {
                                        left: displayRelativeLeft,
                                        top: displayRelativeTop
                                    };
                                    
                                    this.setupComponentDeleteHandler(displayComponentId, instance.displayComponent.container);
                                    console.log(`Auto-added TeX display component ${displayComponentId} to compound ${this.id}`);
                                }
                            }
                        }
                        
                        // TeXDisplayコンポーネントの場合、関連する親のTeXコンポーネントも自動的に追加
                        if (instance && instance.getComponentType && instance.getComponentType() === 'tex-display') {
                            // data-display-component-id属性を持つ親のTeXコンポーネントを探す
                            const allComponents = document.querySelectorAll('.palette-container[data-component-type="tex"]');
                            for (const texContainer of allComponents) {
                                const texInstance = $(texContainer).data('instance');
                                if (texInstance && texInstance.displayComponent && 
                                    texInstance.displayComponent.container && 
                                    texInstance.displayComponent.container.id === componentId) {
                                    const texComponentId = texContainer.id;
                                    if (this.containedComponents.indexOf(texComponentId) === -1) {
                                        console.log(`Auto-adding parent TeX component ${texComponentId} for TeX display component ${componentId}`);
                                        // 再帰的にaddComponentを呼び出さず、直接追加処理を行う（無限ループを防ぐため）
                                        this.containedComponents.push(texComponentId);
                                        this.componentContainers[texComponentId] = texContainer;
                                        
                                        const texComponentRect = texContainer.getBoundingClientRect();
                                        const texRelativeLeft = texComponentRect.left - compoundRect.left;
                                        const texRelativeTop = texContainerRect.top - compoundRect.top;
                                        
                                        this.componentOffsets[texComponentId] = {
                                            left: texRelativeLeft,
                                            top: texRelativeTop
                                        };
                                        
                                        this.setupComponentDeleteHandler(texComponentId, texContainer);
                                        console.log(`Auto-added parent TeX component ${texComponentId} to compound ${this.id}`);
                                    }
                                    break;
                                }
                            }
                        }
                        
                        // Markdownコンポーネントの場合、関連するdisplayComponentも自動的に追加
                        if (instance && instance.getComponentType && instance.getComponentType() === 'markdown') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                if (this.containedComponents.indexOf(displayComponentId) === -1) {
                                    console.log(`Auto-adding Markdown display component ${displayComponentId} for Markdown component ${componentId}`);
                                    // 再帰的にaddComponentを呼び出さず、直接追加処理を行う（無限ループを防ぐため）
                                    this.containedComponents.push(displayComponentId);
                                    this.componentContainers[displayComponentId] = instance.displayComponent.container;
                                    
                                    const displayComponentRect = instance.displayComponent.container.getBoundingClientRect();
                                    const displayRelativeLeft = displayComponentRect.left - compoundRect.left;
                                    const displayRelativeTop = displayComponentRect.top - compoundRect.top;
                                    
                                    this.componentOffsets[displayComponentId] = {
                                        left: displayRelativeLeft,
                                        top: displayRelativeTop
                                    };
                                    
                                    this.setupComponentDeleteHandler(displayComponentId, instance.displayComponent.container);
                                    console.log(`Auto-added Markdown display component ${displayComponentId} to compound ${this.id}`);
                                }
                            }
                        }
                        
                        // MarkdownDisplayコンポーネントの場合、関連する親のMarkdownコンポーネントも自動的に追加
                        if (instance && instance.getComponentType && instance.getComponentType() === 'markdown-display') {
                            // data-display-component-id属性を持つ親のMarkdownコンポーネントを探す
                            const allComponents = document.querySelectorAll('.palette-container[data-component-type="markdown"]');
                            for (const markdownContainer of allComponents) {
                                const markdownInstance = $(markdownContainer).data('instance');
                                if (markdownInstance && markdownInstance.displayComponent && 
                                    markdownInstance.displayComponent.container && 
                                    markdownInstance.displayComponent.container.id === componentId) {
                                    const markdownComponentId = markdownContainer.id;
                                    if (this.containedComponents.indexOf(markdownComponentId) === -1) {
                                        console.log(`Auto-adding parent Markdown component ${markdownComponentId} for Markdown display component ${componentId}`);
                                        // 再帰的にaddComponentを呼び出さず、直接追加処理を行う（無限ループを防ぐため）
                                        this.containedComponents.push(markdownComponentId);
                                        this.componentContainers[markdownComponentId] = markdownContainer;
                                        
                                        const markdownComponentRect = markdownContainer.getBoundingClientRect();
                                        const markdownRelativeLeft = markdownComponentRect.left - compoundRect.left;
                                        const markdownRelativeTop = markdownComponentRect.top - compoundRect.top;
                                        
                                        this.componentOffsets[markdownComponentId] = {
                                            left: markdownRelativeLeft,
                                            top: markdownRelativeTop
                                        };
                                        
                                        this.setupComponentDeleteHandler(markdownComponentId, markdownContainer);
                                        console.log(`Auto-added parent Markdown component ${markdownComponentId} to compound ${this.id}`);
                                    }
                                    break;
                                }
                            }
                        }
                        
                        // LLMコンポーネントの場合、関連するdisplayComponentも自動的に追加
                        if (instance && instance.getComponentType && instance.getComponentType() === 'llm') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                if (this.containedComponents.indexOf(displayComponentId) === -1) {
                                    console.log(`Auto-adding LLM display component ${displayComponentId} for LLM component ${componentId}`);
                                    // 再帰的にaddComponentを呼び出さず、直接追加処理を行う（無限ループを防ぐため）
                                    this.containedComponents.push(displayComponentId);
                                    this.componentContainers[displayComponentId] = instance.displayComponent.container;
                                    
                                    const displayComponentRect = instance.displayComponent.container.getBoundingClientRect();
                                    const displayRelativeLeft = displayComponentRect.left - compoundRect.left;
                                    const displayRelativeTop = displayComponentRect.top - compoundRect.top;
                                    
                                    this.componentOffsets[displayComponentId] = {
                                        left: displayRelativeLeft,
                                        top: displayRelativeTop
                                    };
                                    
                                    this.setupComponentDeleteHandler(displayComponentId, instance.displayComponent.container);
                                    console.log(`Auto-added LLM display component ${displayComponentId} to compound ${this.id}`);
                                }
                            }
                        }
                        
                        // LMStudioコンポーネントの場合、関連するdisplayComponentも自動的に追加
                        if (instance && instance.getComponentType && instance.getComponentType() === 'lmstudio') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                if (this.containedComponents.indexOf(displayComponentId) === -1) {
                                    console.log(`Auto-adding LMStudio display component ${displayComponentId} for LMStudio component ${componentId}`);
                                    // 再帰的にaddComponentを呼び出さず、直接追加処理を行う（無限ループを防ぐため）
                                    this.containedComponents.push(displayComponentId);
                                    this.componentContainers[displayComponentId] = instance.displayComponent.container;
                                    
                                    const displayComponentRect = instance.displayComponent.container.getBoundingClientRect();
                                    const displayRelativeLeft = displayComponentRect.left - compoundRect.left;
                                    const displayRelativeTop = displayComponentRect.top - compoundRect.top;
                                    
                                    this.componentOffsets[displayComponentId] = {
                                        left: displayRelativeLeft,
                                        top: displayRelativeTop
                                    };
                                    
                                    this.setupComponentDeleteHandler(displayComponentId, instance.displayComponent.container);
                                    console.log(`Auto-added LMStudio display component ${displayComponentId} to compound ${this.id}`);
                                }
                            }
                        }
                        
                        // MarkdownDisplayコンポーネントの場合、関連する親のLLMコンポーネントまたはLMStudioコンポーネントも自動的に追加
                        if (instance && instance.getComponentType && instance.getComponentType() === 'markdown-display') {
                            // 親のLLMコンポーネントを探す
                            const allLLMComponents = document.querySelectorAll('.palette-container[data-component-type="llm"]');
                            for (const llmContainer of allLLMComponents) {
                                const llmInstance = $(llmContainer).data('instance');
                                if (llmInstance && llmInstance.displayComponent && 
                                    llmInstance.displayComponent.container && 
                                    llmInstance.displayComponent.container.id === componentId) {
                                    const llmComponentId = llmContainer.id;
                                    if (this.containedComponents.indexOf(llmComponentId) === -1) {
                                        console.log(`Auto-adding parent LLM component ${llmComponentId} for Markdown display component ${componentId}`);
                                        // 再帰的にaddComponentを呼び出さず、直接追加処理を行う（無限ループを防ぐため）
                                        this.containedComponents.push(llmComponentId);
                                        this.componentContainers[llmComponentId] = llmContainer;
                                        
                                        const llmComponentRect = llmContainer.getBoundingClientRect();
                                        const llmRelativeLeft = llmComponentRect.left - compoundRect.left;
                                        const llmRelativeTop = llmComponentRect.top - compoundRect.top;
                                        
                                        this.componentOffsets[llmComponentId] = {
                                            left: llmRelativeLeft,
                                            top: llmRelativeTop
                                        };
                                        
                                        this.setupComponentDeleteHandler(llmComponentId, llmContainer);
                                        console.log(`Auto-added parent LLM component ${llmComponentId} to compound ${this.id}`);
                                    }
                                    break;
                                }
                            }
                            
                            // 親のLMStudioコンポーネントを探す
                            const allLMStudioComponents = document.querySelectorAll('.palette-container[data-component-type="lmstudio"]');
                            for (const lmStudioContainer of allLMStudioComponents) {
                                const lmStudioInstance = $(lmStudioContainer).data('instance');
                                if (lmStudioInstance && lmStudioInstance.displayComponent && 
                                    lmStudioInstance.displayComponent.container && 
                                    lmStudioInstance.displayComponent.container.id === componentId) {
                                    const lmStudioComponentId = lmStudioContainer.id;
                                    if (this.containedComponents.indexOf(lmStudioComponentId) === -1) {
                                        console.log(`Auto-adding parent LMStudio component ${lmStudioComponentId} for Markdown display component ${componentId}`);
                                        // 再帰的にaddComponentを呼び出さず、直接追加処理を行う（無限ループを防ぐため）
                                        this.containedComponents.push(lmStudioComponentId);
                                        this.componentContainers[lmStudioComponentId] = lmStudioContainer;
                                        
                                        const lmStudioComponentRect = lmStudioContainer.getBoundingClientRect();
                                        const lmStudioRelativeLeft = lmStudioComponentRect.left - compoundRect.left;
                                        const lmStudioRelativeTop = lmStudioComponentRect.top - compoundRect.top;
                                        
                                        this.componentOffsets[lmStudioComponentId] = {
                                            left: lmStudioRelativeLeft,
                                            top: lmStudioRelativeTop
                                        };
                                        
                                        this.setupComponentDeleteHandler(lmStudioComponentId, lmStudioContainer);
                                        console.log(`Auto-added parent LMStudio component ${lmStudioComponentId} to compound ${this.id}`);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            setupComponentDeleteHandler(componentId, component) {
                // コンポーネントの削除ボタンの処理をオーバーライド
                const deleteButton = component.querySelector('.delete-button');
                if (deleteButton) {
                    const self = this;
                    const originalOnclick = deleteButton.onclick;
                    
                    deleteButton.onclick = function(e) {
                        e.stopPropagation();
                        
                        // すべてのコンパウンドコンポーネントからこのコンポーネントを削除
                        const allComponents = document.querySelectorAll('.palette-container');
                        allComponents.forEach(container => {
                            const instance = $(container).data('instance');
                            if (instance && instance.getComponentType && instance.getComponentType() === 'compound') {
                                // 再帰的にすべてのコンポーネントを取得して、このコンポーネントが含まれているかチェック
                                const getAllContainedComponents = (compoundInstance) => {
                                    const allComponents = [];
                                    if (compoundInstance.containedComponents && Array.isArray(compoundInstance.containedComponents)) {
                                        compoundInstance.containedComponents.forEach(compId => {
                                            allComponents.push(compId);
                                            let comp = compoundInstance.componentContainers[compId];
                                            if (!comp) {
                                                comp = document.getElementById(compId);
                                            }
                                            if (comp) {
                                                const compInstance = $(comp).data('instance');
                                                if (compInstance && compInstance.getComponentType && compInstance.getComponentType() === 'compound') {
                                                    const nestedComponents = getAllContainedComponents(compInstance);
                                                    allComponents.push(...nestedComponents);
                                                }
                                            }
                                        });
                                    }
                                    return allComponents;
                                };
                                
                                const allContained = getAllContainedComponents(instance);
                                if (allContained.includes(componentId)) {
                                    instance.removeComponent(componentId);
                                    console.log(`Removed component ${componentId} from compound ${instance.id} before deletion`);
                                }
                            }
                        });
                        
                        // TeXコンポーネントの場合、関連するdisplayComponentも削除
                        const instance = $(component).data('instance');
                        if (instance && instance.getComponentType && instance.getComponentType() === 'tex') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                const displayComponent = instance.displayComponent.container;
                                if (displayComponent) {
                                    displayComponent.remove();
                                    console.log(`Auto-removed TeX display component ${displayComponentId} with TeX component ${componentId}`);
                                }
                            }
                        }
                        
                        // TeXDisplayコンポーネントの場合、関連する親のTeXコンポーネントも削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'tex-display') {
                            // data-display-component-id属性を持つ親のTeXコンポーネントを探す
                            const allTexComponents = document.querySelectorAll('.palette-container[data-component-type="tex"]');
                            for (const texContainer of allTexComponents) {
                                const texInstance = $(texContainer).data('instance');
                                if (texInstance && texInstance.displayComponent && 
                                    texInstance.displayComponent.container && 
                                    texInstance.displayComponent.container.id === componentId) {
                                    texContainer.remove();
                                    console.log(`Auto-removed parent TeX component ${texContainer.id} with TeX display component ${componentId}`);
                                    break;
                                }
                            }
                        }
                        
                        // Markdownコンポーネントの場合、関連するdisplayComponentも削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'markdown') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                const displayComponent = instance.displayComponent.container;
                                if (displayComponent) {
                                    displayComponent.remove();
                                    console.log(`Auto-removed Markdown display component ${displayComponentId} with Markdown component ${componentId}`);
                                }
                            }
                        }
                        
                        // MarkdownDisplayコンポーネントの場合、関連する親のMarkdownコンポーネントも削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'markdown-display') {
                            // 親のMarkdownコンポーネントを探す
                            const allMarkdownComponents = document.querySelectorAll('.palette-container[data-component-type="markdown"]');
                            for (const markdownContainer of allMarkdownComponents) {
                                const markdownInstance = $(markdownContainer).data('instance');
                                if (markdownInstance && markdownInstance.displayComponent && 
                                    markdownInstance.displayComponent.container && 
                                    markdownInstance.displayComponent.container.id === componentId) {
                                    markdownContainer.remove();
                                    console.log(`Auto-removed parent Markdown component ${markdownContainer.id} with Markdown display component ${componentId}`);
                                    break;
                                }
                            }
                            
                            // 親のLLMコンポーネントを探す
                            const allLLMComponents = document.querySelectorAll('.palette-container[data-component-type="llm"]');
                            for (const llmContainer of allLLMComponents) {
                                const llmInstance = $(llmContainer).data('instance');
                                if (llmInstance && llmInstance.displayComponent && 
                                    llmInstance.displayComponent.container && 
                                    llmInstance.displayComponent.container.id === componentId) {
                                    llmContainer.remove();
                                    console.log(`Auto-removed parent LLM component ${llmContainer.id} with Markdown display component ${componentId}`);
                                    break;
                                }
                            }
                            
                            // 親のLMStudioコンポーネントを探す
                            const allLMStudioComponents = document.querySelectorAll('.palette-container[data-component-type="lmstudio"]');
                            for (const lmStudioContainer of allLMStudioComponents) {
                                const lmStudioInstance = $(lmStudioContainer).data('instance');
                                if (lmStudioInstance && lmStudioInstance.displayComponent && 
                                    lmStudioInstance.displayComponent.container && 
                                    lmStudioInstance.displayComponent.container.id === componentId) {
                                    lmStudioContainer.remove();
                                    console.log(`Auto-removed parent LMStudio component ${lmStudioContainer.id} with Markdown display component ${componentId}`);
                                    break;
                                }
                            }
                        }
                        
                        // LLMコンポーネントの場合、関連するdisplayComponentも削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'llm') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                const displayComponent = instance.displayComponent.container;
                                if (displayComponent) {
                                    displayComponent.remove();
                                    console.log(`Auto-removed LLM display component ${displayComponentId} with LLM component ${componentId}`);
                                }
                            }
                        }
                        
                        // LMStudioコンポーネントの場合、関連するdisplayComponentも削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'lmstudio') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                const displayComponent = instance.displayComponent.container;
                                if (displayComponent) {
                                    displayComponent.remove();
                                    console.log(`Auto-removed LMStudio display component ${displayComponentId} with LMStudio component ${componentId}`);
                                }
                            }
                        }
                        
                        // 元の削除処理を実行
                        if (originalOnclick) {
                            originalOnclick.call(this, e);
                        } else {
                            // 元の処理が存在しない場合は、直接削除
                            component.remove();
                            console.log(`Component ID: ${componentId} has been removed.`);
                        }
                    };
                }
            }

            removeComponent(componentId) {
                const index = this.containedComponents.indexOf(componentId);
                if (index !== -1) {
                    this.containedComponents.splice(index, 1);
                    delete this.componentOffsets[componentId];
                    delete this.componentContainers[componentId];
                    console.log(`Removed component ${componentId} from compound ${this.id}`);
                    
                    // TeXコンポーネントの場合、関連するdisplayComponentも自動的に削除
                    const component = document.getElementById(componentId);
                    if (component) {
                        const instance = $(component).data('instance');
                        if (instance && instance.getComponentType && instance.getComponentType() === 'tex') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                const displayIndex = this.containedComponents.indexOf(displayComponentId);
                                if (displayIndex !== -1) {
                                    this.containedComponents.splice(displayIndex, 1);
                                    delete this.componentOffsets[displayComponentId];
                                    delete this.componentContainers[displayComponentId];
                                    console.log(`Auto-removed TeX display component ${displayComponentId} from compound ${this.id}`);
                                }
                            }
                        }
                        
                        // TeXDisplayコンポーネントの場合、関連する親のTeXコンポーネントも自動的に削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'tex-display') {
                            // data-display-component-id属性を持つ親のTeXコンポーネントを探す
                            const allTexComponents = document.querySelectorAll('.palette-container[data-component-type="tex"]');
                            for (const texContainer of allTexComponents) {
                                const texInstance = $(texContainer).data('instance');
                                if (texInstance && texInstance.displayComponent && 
                                    texInstance.displayComponent.container && 
                                    texInstance.displayComponent.container.id === componentId) {
                                    const texComponentId = texContainer.id;
                                    const texIndex = this.containedComponents.indexOf(texComponentId);
                                    if (texIndex !== -1) {
                                        this.containedComponents.splice(texIndex, 1);
                                        delete this.componentOffsets[texComponentId];
                                        delete this.componentContainers[texComponentId];
                                        console.log(`Auto-removed parent TeX component ${texComponentId} from compound ${this.id}`);
                                    }
                                    break;
                                }
                            }
                        }
                        
                        // Markdownコンポーネントの場合、関連するdisplayComponentも自動的に削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'markdown') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                const displayIndex = this.containedComponents.indexOf(displayComponentId);
                                if (displayIndex !== -1) {
                                    this.containedComponents.splice(displayIndex, 1);
                                    delete this.componentOffsets[displayComponentId];
                                    delete this.componentContainers[displayComponentId];
                                    console.log(`Auto-removed Markdown display component ${displayComponentId} from compound ${this.id}`);
                                }
                            }
                        }
                        
                        // MarkdownDisplayコンポーネントの場合、関連する親のMarkdownコンポーネントも自動的に削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'markdown-display') {
                            // 親のMarkdownコンポーネントを探す
                            const allMarkdownComponents = document.querySelectorAll('.palette-container[data-component-type="markdown"]');
                            for (const markdownContainer of allMarkdownComponents) {
                                const markdownInstance = $(markdownContainer).data('instance');
                                if (markdownInstance && markdownInstance.displayComponent && 
                                    markdownInstance.displayComponent.container && 
                                    markdownInstance.displayComponent.container.id === componentId) {
                                    const markdownComponentId = markdownContainer.id;
                                    const markdownIndex = this.containedComponents.indexOf(markdownComponentId);
                                    if (markdownIndex !== -1) {
                                        this.containedComponents.splice(markdownIndex, 1);
                                        delete this.componentOffsets[markdownComponentId];
                                        delete this.componentContainers[markdownComponentId];
                                        console.log(`Auto-removed parent Markdown component ${markdownComponentId} from compound ${this.id}`);
                                    }
                                    break;
                                }
                            }
                            
                            // 親のLLMコンポーネントを探す
                            const allLLMComponents = document.querySelectorAll('.palette-container[data-component-type="llm"]');
                            for (const llmContainer of allLLMComponents) {
                                const llmInstance = $(llmContainer).data('instance');
                                if (llmInstance && llmInstance.displayComponent && 
                                    llmInstance.displayComponent.container && 
                                    llmInstance.displayComponent.container.id === componentId) {
                                    const llmComponentId = llmContainer.id;
                                    const llmIndex = this.containedComponents.indexOf(llmComponentId);
                                    if (llmIndex !== -1) {
                                        this.containedComponents.splice(llmIndex, 1);
                                        delete this.componentOffsets[llmComponentId];
                                        delete this.componentContainers[llmComponentId];
                                        console.log(`Auto-removed parent LLM component ${llmComponentId} from compound ${this.id}`);
                                    }
                                    break;
                                }
                            }
                            
                            // 親のLMStudioコンポーネントを探す
                            const allLMStudioComponents = document.querySelectorAll('.palette-container[data-component-type="lmstudio"]');
                            for (const lmStudioContainer of allLMStudioComponents) {
                                const lmStudioInstance = $(lmStudioContainer).data('instance');
                                if (lmStudioInstance && lmStudioInstance.displayComponent && 
                                    lmStudioInstance.displayComponent.container && 
                                    lmStudioInstance.displayComponent.container.id === componentId) {
                                    const lmStudioComponentId = lmStudioContainer.id;
                                    const lmStudioIndex = this.containedComponents.indexOf(lmStudioComponentId);
                                    if (lmStudioIndex !== -1) {
                                        this.containedComponents.splice(lmStudioIndex, 1);
                                        delete this.componentOffsets[lmStudioComponentId];
                                        delete this.componentContainers[lmStudioComponentId];
                                        console.log(`Auto-removed parent LMStudio component ${lmStudioComponentId} from compound ${this.id}`);
                                    }
                                    break;
                                }
                            }
                        }
                        
                        // LLMコンポーネントの場合、関連するdisplayComponentも自動的に削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'llm') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                const displayIndex = this.containedComponents.indexOf(displayComponentId);
                                if (displayIndex !== -1) {
                                    this.containedComponents.splice(displayIndex, 1);
                                    delete this.componentOffsets[displayComponentId];
                                    delete this.componentContainers[displayComponentId];
                                    console.log(`Auto-removed LLM display component ${displayComponentId} from compound ${this.id}`);
                                }
                            }
                        }
                        
                        // LMStudioコンポーネントの場合、関連するdisplayComponentも自動的に削除
                        if (instance && instance.getComponentType && instance.getComponentType() === 'lmstudio') {
                            if (instance.displayComponent && instance.displayComponent.container) {
                                const displayComponentId = instance.displayComponent.container.id;
                                const displayIndex = this.containedComponents.indexOf(displayComponentId);
                                if (displayIndex !== -1) {
                                    this.containedComponents.splice(displayIndex, 1);
                                    delete this.componentOffsets[displayComponentId];
                                    delete this.componentContainers[displayComponentId];
                                    console.log(`Auto-removed LMStudio display component ${displayComponentId} from compound ${this.id}`);
                                }
                            }
                        }
                    }
                }
            }

            showComponentSelectionDialog() {
                // 画面上のすべてのコンポーネントを取得
                const allComponents = document.querySelectorAll('.palette-container');
                const componentList = [];
                const self = this;
                
                // すべてのコンパウンドコンポーネントのcontainedComponentsを収集
                const allContainedComponents = new Set();
                allComponents.forEach(component => {
                    const instance = $(component).data('instance');
                    // コンパウンドコンポーネントの場合、containedComponentsを収集
                    if (instance && instance.getComponentType && instance.getComponentType() === 'compound') {
                        const compoundId = component.id;
                        // containedComponentsから収集
                        if (instance.containedComponents && Array.isArray(instance.containedComponents)) {
                            console.log(`Compound ${compoundId} has containedComponents:`, instance.containedComponents);
                            instance.containedComponents.forEach(compId => {
                                allContainedComponents.add(compId);
                                console.log(`Added ${compId} to allContainedComponents from compound ${compoundId}`);
                            });
                        }
                        // componentContainersのキーからも収集（念のため）
                        if (instance.componentContainers && typeof instance.componentContainers === 'object') {
                            const containerKeys = Object.keys(instance.componentContainers);
                            console.log(`Compound ${compoundId} has componentContainers keys:`, containerKeys);
                            containerKeys.forEach(compId => {
                                allContainedComponents.add(compId);
                                console.log(`Added ${compId} to allContainedComponents from componentContainers of compound ${compoundId}`);
                            });
                        }
                    }
                });
                
                console.log(`All contained components:`, Array.from(allContainedComponents));
                console.log(`Self ID: ${self.id}`);
                console.log(`Self containedComponents:`, self.containedComponents);
                
                allComponents.forEach(component => {
                    const componentId = component.id;
                    const instance = $(component).data('instance');
                    
                    // インスタンスのIDも確認（component.idと異なる場合がある）
                    const instanceId = instance && instance.id ? instance.id : componentId;
                    
                    // 自分自身のコンパウンドコンポーネントは除外（containerの直接比較も行う）
                    if (componentId === self.id || instanceId === self.id || component === self.container) {
                        console.log(`Excluding self: ${componentId} (instanceId: ${instanceId}, self.id: ${self.id})`);
                        return;
                    }
                    
                    // どれかのコンパウンドコンポーネントに含まれているコンポーネントは除外
                    // componentIdとinstanceIdの両方をチェック
                    const isContainedById = allContainedComponents.has(componentId);
                    const isContainedByInstanceId = allContainedComponents.has(instanceId);
                    const isContained = isContainedById || isContainedByInstanceId;
                    
                    console.log(`Checking component ${componentId} (instanceId: ${instanceId}): isContained=${isContained} (by id: ${isContainedById}, by instanceId: ${isContainedByInstanceId})`);
                    
                    if (isContained) {
                        console.log(`Excluding contained component: ${componentId} (instanceId: ${instanceId})`);
                        return;
                    }
                    
                    if (instance) {
                        // デバッグログ：リストに追加されるコンポーネントを確認
                        console.log(`Adding to list: ${componentId} (instanceId: ${instanceId}, ${instance.getComponentName ? instance.getComponentName() : 'Unknown'})`);
                        componentList.push({
                            id: componentId,
                            name: instance.getComponentName ? instance.getComponentName() : 'Unknown',
                            type: instance.getComponentType ? instance.getComponentType() : 'unknown'
                        });
                    }
                });

                if (componentList.length === 0) {
                    alert('取り込めるコンポーネントがありません。');
                    return;
                }

                // ダイアログを作成
                const dialog = document.createElement('div');
                dialog.id = 'compound-selection-dialog';
                dialog.style.position = 'fixed';
                dialog.style.top = '50%';
                dialog.style.left = '50%';
                dialog.style.transform = 'translate(-50%, -50%)';
                dialog.style.backgroundColor = '#fff';
                dialog.style.border = '2px solid #6699ff';
                dialog.style.borderRadius = '8px';
                dialog.style.padding = '20px';
                dialog.style.zIndex = '10000';
                dialog.style.maxWidth = '500px';
                dialog.style.maxHeight = '600px';
                dialog.style.overflow = 'auto';
                dialog.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';

                const title = document.createElement('h3');
                title.textContent = 'コンポーネントを選択';
                title.style.marginTop = '0';
                dialog.appendChild(title);

                const list = document.createElement('div');
                list.style.display = 'flex';
                list.style.flexDirection = 'column';
                list.style.gap = '8px';

                componentList.forEach(comp => {
                    const item = document.createElement('div');
                    item.style.padding = '10px';
                    item.style.border = '1px solid #ccc';
                    item.style.borderRadius = '4px';
                    item.style.cursor = 'pointer';
                    item.style.backgroundColor = '#f5f5f5';
                    item.textContent = `${comp.name} (ID: ${comp.id})`;
                    
                    item.onmouseenter = () => {
                        item.style.backgroundColor = '#e0e0e0';
                    };
                    item.onmouseleave = () => {
                        item.style.backgroundColor = '#f5f5f5';
                    };
                    
                    item.onclick = () => {
                        this.addComponent(comp.id);
                        document.body.removeChild(dialog);
                    };
                    
                    list.appendChild(item);
                });

                dialog.appendChild(list);

                const closeButton = document.createElement('button');
                closeButton.textContent = '閉じる';
                closeButton.style.marginTop = '10px';
                closeButton.style.padding = '8px 16px';
                closeButton.style.cursor = 'pointer';
                closeButton.style.backgroundColor = '#ff6666';
                closeButton.style.color = '#fff';
                closeButton.style.border = 'none';
                closeButton.style.borderRadius = '4px';
                closeButton.onclick = () => {
                    document.body.removeChild(dialog);
                };
                dialog.appendChild(closeButton);

                document.body.appendChild(dialog);
            }

            createCopy() {
                // コンパウンドのコピーを作成
                const newCompound = new PaletteCompound(null, false, null, []);
                
                // 位置を少しずらす
                // getBoundingClientRect()からstyle.leftとstyle.topへの変換
                const rect = this.container.getBoundingClientRect();
                const bodyRect = document.body.getBoundingClientRect();
                const scrollX = window.scrollX || window.pageXOffset || 0;
                const scrollY = window.scrollY || window.pageYOffset || 0;
                
                // 元のコンパウンドのstyle.leftとstyle.topを取得
                const originalLeft = parseFloat(this.container.style.left) || 0;
                const originalTop = parseFloat(this.container.style.top) || 0;
                
                // 新しいコンパウンドの位置を設定（元の位置から50pxずらす）
                newCompound.container.style.left = (originalLeft + 50) + 'px';
                newCompound.container.style.top = (originalTop + 50) + 'px';
                
                // 新しいコンパウンドの位置を確定させるため、少し待つ
                setTimeout(() => {
                    // 新しいコンパウンドの位置を再取得（確実に取得するため）
                    const newCompoundLeft = parseFloat(newCompound.container.style.left) || 0;
                    const newCompoundTop = parseFloat(newCompound.container.style.top) || 0;
                    
                    console.log(`New compound position in setTimeout: (${newCompoundLeft}, ${newCompoundTop})`);
                    
                    // 取り込まれたコンポーネントもコピー
                    console.log(`Creating copy of compound ${this.id}, containedComponents:`, this.containedComponents);
                    console.log(`containedComponents length:`, this.containedComponents.length);
                    console.log(`componentContainers:`, Object.keys(this.componentContainers));
                    
                    const copiedComponents = [];
                    
                    for (const componentId of this.containedComponents) {
                        // まずcomponentContainersから取得を試みる
                        let originalComponent = this.componentContainers[componentId];
                        
                        // 見つからない場合は、getElementByIdで取得
                        if (!originalComponent) {
                            originalComponent = document.getElementById(componentId);
                            if (originalComponent) {
                                this.componentContainers[componentId] = originalComponent;
                            }
                        }
                        
                        if (originalComponent) {
                            const instance = $(originalComponent).data('instance');
                            if (instance) {
                                // コンポーネントのタイプを取得
                                const componentType = instance.getComponentType();
                                const ComponentClass = componentRegistry[componentType];
                                
                                if (ComponentClass) {
                                    // 新しいコンポーネントを作成
                                    const newComponent = new ComponentClass(null, false, null, []);
                                    
                                    // init()が呼ばれてDOMに追加されているはずだが、念のため確認
                                    if (!newComponent.container) {
                                        console.error(`New component ${newComponent.id} has no container!`);
                                        continue;
                                    }
                                    
                                    // DOMに追加されているか確認し、追加されていない場合は追加
                                    if (!document.body.contains(newComponent.container)) {
                                        console.log(`New component ${newComponent.id} container not in DOM, adding...`);
                                        document.body.appendChild(newComponent.container);
                                    }
                                    
                                    // 確実にDOMに追加されていることを確認
                                    if (!document.body.contains(newComponent.container)) {
                                        console.error(`Failed to add component ${newComponent.id} to DOM!`);
                                        continue;
                                    }
                                    
                                    console.log(`Created new component ${newComponent.id} of type ${componentType}`);
                                    
                                    // 新しいコンポーネントの現在の位置を確認
                                    const currentNewComponentLeft = parseFloat(newComponent.container.style.left) || 0;
                                    const currentNewComponentTop = parseFloat(newComponent.container.style.top) || 0;
                                    console.log(`New component initial position: (${currentNewComponentLeft}, ${currentNewComponentTop})`);
                                    
                                    // 元のコンポーネントのstyle.leftとstyle.topから相対位置を計算
                                    // originalComponentは既にループの最初で取得済み
                                    if (originalComponent) {
                                        // 元のコンパウンドと元のコンポーネントのstyle.leftとstyle.topから相対位置を計算
                                        // これがドラッグ時に使用される方法と一致する
                                        const originalCompoundLeft = parseFloat(this.container.style.left) || 0;
                                        const originalCompoundTop = parseFloat(this.container.style.top) || 0;
                                        const originalComponentLeft = parseFloat(originalComponent.style.left) || 0;
                                        const originalComponentTop = parseFloat(originalComponent.style.top) || 0;
                                        
                                        // style.leftとstyle.topから相対位置を計算
                                        const styleRelativeLeft = originalComponentLeft - originalCompoundLeft;
                                        const styleRelativeTop = originalComponentTop - originalCompoundTop;
                                        
                                        // 新しいコンポーネントの位置を設定（新しいコンパウンドの位置 + 相対位置）
                                        // これにより、新しいコンポーネントの位置は元のコンポーネントの位置から50pxずれた位置になる
                                        // newCompoundLeftとnewCompoundTopは、setTimeoutの最初で取得した値を使用
                                        const newComponentLeft = newCompoundLeft + styleRelativeLeft;
                                        const newComponentTop = newCompoundTop + styleRelativeTop;
                                        
                                        console.log(`Calculating position: newCompound(${newCompoundLeft}, ${newCompoundTop}) + relative(${styleRelativeLeft}, ${styleRelativeTop}) = newComponent(${newComponentLeft}, ${newComponentTop})`);
                                        
                                        // jQuery UIのdraggableを一時的に無効化してから位置を設定
                                        const draggableInstance = $(newComponent.container).draggable("instance");
                                        if (draggableInstance) {
                                            $(newComponent.container).draggable("disable");
                                        }
                                        
                                        // 位置を設定（確実に設定されるように、直接styleを設定）
                                        newComponent.container.style.left = newComponentLeft + 'px';
                                        newComponent.container.style.top = newComponentTop + 'px';
                                        
                                        // 設定された位置を確認（少し待ってから確認）
                                        setTimeout(() => {
                                            const actualLeft = parseFloat(newComponent.container.style.left) || 0;
                                            const actualTop = parseFloat(newComponent.container.style.top) || 0;
                                            
                                            console.log(`After setting: Expected (${newComponentLeft}, ${newComponentTop}), Actual (${actualLeft}, ${actualTop})`);
                                            
                                            // 位置が正しく設定されているか確認
                                            if (Math.abs(actualLeft - newComponentLeft) > 0.1 || Math.abs(actualTop - newComponentTop) > 0.1) {
                                                console.warn(`Position mismatch! Re-setting position...`);
                                                // 再度設定を試みる
                                                newComponent.container.style.left = newComponentLeft + 'px';
                                                newComponent.container.style.top = newComponentTop + 'px';
                                                
                                                // 再度確認
                                                const recheckLeft = parseFloat(newComponent.container.style.left) || 0;
                                                const recheckTop = parseFloat(newComponent.container.style.top) || 0;
                                                console.log(`After re-setting: (${recheckLeft}, ${recheckTop})`);
                                            }
                                            
                                            // draggableを再度有効化
                                            if (draggableInstance) {
                                                $(newComponent.container).draggable("enable");
                                            }
                                        }, 10);
                                        
                                        // 新しいコンパウンドに追加
                                        newCompound.containedComponents.push(newComponent.id);
                                        
                                        // containerへの参照も保存
                                        newCompound.componentContainers[newComponent.id] = newComponent.container;
                                        
                                        copiedComponents.push(newComponent.id);
                                        
                                        // デバッグログ
                                        console.log(`Added component ${newComponent.id} to compound ${newCompound.id}`);
                                        console.log(`Original compound style: (${originalCompoundLeft}, ${originalCompoundTop})`);
                                        console.log(`Original component style: (${originalComponentLeft}, ${originalComponentTop})`);
                                        console.log(`Style relative: (${styleRelativeLeft}, ${styleRelativeTop})`);
                                        console.log(`New compound style: (${newCompoundLeft}, ${newCompoundTop})`);
                                        console.log(`New component should be at: (${newComponentLeft}, ${newComponentTop})`);
                                        console.log(`Offset from original component: (${newComponentLeft - originalComponentLeft}, ${newComponentTop - originalComponentTop})`);
                                    } else {
                                        // 元のコンポーネントが見つからない場合は、保存されたoffsetを使用
                                        const offset = this.componentOffsets[componentId];
                                        if (offset) {
                                            const newCompoundRect = newCompound.container.getBoundingClientRect();
                                            const bodyRect = document.body.getBoundingClientRect();
                                            const scrollX = window.scrollX || window.pageXOffset || 0;
                                            const scrollY = window.scrollY || window.pageYOffset || 0;
                                            
                                            const newComponentRectLeft = newCompoundRect.left + offset.left;
                                            const newComponentRectTop = newCompoundRect.top + offset.top;
                                            
                                            newComponent.container.style.left = (newComponentRectLeft - bodyRect.left + scrollX) + 'px';
                                            newComponent.container.style.top = (newComponentRectTop - bodyRect.top + scrollY) + 'px';
                                            
                                            newCompound.containedComponents.push(newComponent.id);
                                            newCompound.componentOffsets[newComponent.id] = {
                                                left: offset.left,
                                                top: offset.top
                                            };
                                            newCompound.componentContainers[newComponent.id] = newComponent.container;
                                            
                                            copiedComponents.push(newComponent.id);
                                            console.log(`Added component ${newComponent.id} to compound ${newCompound.id} (fallback method)`);
                                        } else {
                                            // 相対位置がない場合は、addComponent()を使用
                                            newCompound.addComponent(newComponent.id);
                                            copiedComponents.push(newComponent.id);
                                            console.log(`Added component ${newComponent.id} to compound ${newCompound.id} via addComponent()`);
                                        }
                                    }
                                    
                                    // 状態をコピー（可能な場合）
                                    if (instance.serializeState && newComponent.restoreState) {
                                        try {
                                            const state = instance.serializeState();
                                            
                                            // コンパウンドコンポーネントの場合は、containedComponentsも再帰的にコピー
                                            if (componentType === 'compound' && state.containedComponents) {
                                                // containedComponentsをパース
                                                let containedComponents = [];
                                                try {
                                                    containedComponents = JSON.parse(state.containedComponents);
                                                } catch (e) {
                                                    if (Array.isArray(state.containedComponents)) {
                                                        containedComponents = state.containedComponents;
                                                    }
                                                }
                                                
                                                // componentOffsetsをパース
                                                let componentOffsets = {};
                                                if (state.componentOffsets) {
                                                    try {
                                                        componentOffsets = JSON.parse(state.componentOffsets);
                                                    } catch (e) {
                                                        if (typeof state.componentOffsets === 'object') {
                                                            componentOffsets = state.componentOffsets;
                                                        }
                                                    }
                                                }
                                                
                                                // stateからcontainedComponentsとcomponentOffsetsを削除（再帰的にコピーするため）
                                                delete state.containedComponents;
                                                delete state.componentOffsets;
                                                
                                                // 残りの状態を先に復元（位置など）
                                                newComponent.restoreState(state);
                                                
                                                // 各コンポーネントを再帰的にコピー
                                                const newContainedComponents = [];
                                                const newComponentOffsets = {};
                                                
                                                // 新しいコンパウンドコンポーネントの位置を取得（restoreState後）
                                                const newCompoundRect = newComponent.container.getBoundingClientRect();
                                                
                                                for (const containedId of containedComponents) {
                                                    // 元のコンポーネントを取得
                                                    let originalContained = instance.componentContainers[containedId];
                                                    if (!originalContained) {
                                                        originalContained = document.getElementById(containedId);
                                                    }
                                                    
                                                    if (originalContained) {
                                                        const containedInstance = $(originalContained).data('instance');
                                                        if (containedInstance) {
                                                            const containedType = containedInstance.getComponentType();
                                                            const ContainedComponentClass = componentRegistry[containedType];
                                                            
                                                            if (ContainedComponentClass) {
                                                                // 新しいコンポーネントを作成
                                                                const newContainedComponent = new ContainedComponentClass(null, false, null, []);
                                                                
                                                                if (newContainedComponent.container && !document.body.contains(newContainedComponent.container)) {
                                                                    document.body.appendChild(newContainedComponent.container);
                                                                }
                                                                
                                                                // 元のコンポーネントの相対位置を取得（componentOffsetsから、または計算）
                                                                let relativeLeft, relativeTop;
                                                                if (componentOffsets[containedId]) {
                                                                    relativeLeft = componentOffsets[containedId].left;
                                                                    relativeTop = componentOffsets[containedId].top;
                                                                } else {
                                                                    // componentOffsetsがない場合は、getBoundingClientRect()で計算
                                                                    const originalCompoundRect = originalComponent.getBoundingClientRect();
                                                                    const originalContainedRect = originalContained.getBoundingClientRect();
                                                                    relativeLeft = originalContainedRect.left - originalCompoundRect.left;
                                                                    relativeTop = originalContainedRect.top - originalCompoundRect.top;
                                                                }
                                                                
                                                                // 新しいコンポーネントの位置を設定（style.left/topを使用）
                                                                const newComponentLeft = parseFloat(newComponent.container.style.left) || 0;
                                                                const newComponentTop = parseFloat(newComponent.container.style.top) || 0;
                                                                
                                                                newContainedComponent.container.style.left = (newComponentLeft + relativeLeft) + 'px';
                                                                newContainedComponent.container.style.top = (newComponentTop + relativeTop) + 'px';
                                                                
                                                                // 状態をコピー
                                                                if (containedInstance.serializeState && newContainedComponent.restoreState) {
                                                                    try {
                                                                        const containedState = containedInstance.serializeState();
                                                                        newContainedComponent.restoreState(containedState);
                                                                    } catch (e) {
                                                                        console.warn('Failed to copy contained component state:', e);
                                                                    }
                                                                }
                                                                
                                                                // 新しいコンパウンドコンポーネントに追加
                                                                newContainedComponents.push(newContainedComponent.id);
                                                                newComponentOffsets[newContainedComponent.id] = {
                                                                    left: relativeLeft,
                                                                    top: relativeTop
                                                                };
                                                                newComponent.componentContainers[newContainedComponent.id] = newContainedComponent.container;
                                                                
                                                                console.log(`Recursively copied contained component ${containedId} as ${newContainedComponent.id} in compound ${newComponent.id}`);
                                                            }
                                                        }
                                                    }
                                                }
                                                
                                                // 新しいcontainedComponentsとcomponentOffsetsを設定
                                                newComponent.containedComponents = newContainedComponents;
                                                newComponent.componentOffsets = newComponentOffsets;
                                                
                                                // ドラッグ処理を設定
                                                setTimeout(() => {
                                                    newComponent.setupContainedComponentDrag();
                                                    newComponent.setupCompoundDrag();
                                                }, 100);
                                            } else {
                                                // コンパウンドコンポーネントでない場合は、通常通り状態を復元
                                                newComponent.restoreState(state);
                                            }
                                        } catch (e) {
                                            console.warn('Failed to copy component state:', e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    // すべてのコンポーネントを追加した後、一度だけドラッグ処理を設定
                    if (copiedComponents.length > 0) {
                        console.log(`Before setup: newCompound.containedComponents =`, newCompound.containedComponents);
                        console.log(`Before setup: newCompound.componentOffsets =`, newCompound.componentOffsets);
                        
                        // 確認のため、コンポーネントが実際に存在するかチェック
                        // containedComponentsに追加した時点でcontainerが存在することを確認済み
                        // ただし、getElementByIdで見つからない場合があるので、componentContainersから取得を試みる
                        const validComponents = [];
                        const newCompoundRect = newCompound.container.getBoundingClientRect();
                        
                        newCompound.containedComponents.forEach(compId => {
                            // まずcomponentContainersから取得を試みる
                            let comp = newCompound.componentContainers[compId];
                            
                            // 見つからない場合は、getElementByIdで確認
                            if (!comp) {
                                comp = document.getElementById(compId);
                                if (comp) {
                                    newCompound.componentContainers[compId] = comp;
                                }
                            }
                            
                            // それでも見つからない場合は、querySelectorAllで確認
                            if (!comp) {
                                const allContainers = document.querySelectorAll('.palette-container');
                                for (const container of allContainers) {
                                    if (container.id === compId) {
                                        comp = container;
                                        newCompound.componentContainers[compId] = comp;
                                        break;
                                    }
                                }
                            }
                            
                            // コンポーネントが見つかった場合
                            if (comp && document.body.contains(comp)) {
                                validComponents.push(compId);
                                
                                // componentOffsetsを更新（getBoundingClientRect()で計算）
                                const compRect = comp.getBoundingClientRect();
                                const rectRelativeLeft = compRect.left - newCompoundRect.left;
                                const rectRelativeTop = compRect.top - newCompoundRect.top;
                                
                                newCompound.componentOffsets[compId] = {
                                    left: rectRelativeLeft,
                                    top: rectRelativeTop
                                };
                                
                                console.log(`Component ${compId} exists in DOM, offset: (${rectRelativeLeft}, ${rectRelativeTop})`);
                            } else {
                                // getElementByIdで見つからない場合でも、containerが存在する可能性がある
                                // 実際には、containedComponentsに追加した時点でcontainerが存在することを確認済み
                                // なので、getElementByIdで見つからなくても、有効なコンポーネントとして扱う
                                console.warn(`Component ${compId} not found by getElementById, but was added to containedComponents`);
                                console.warn(`This may be a timing issue. Keeping component in containedComponents.`);
                                validComponents.push(compId);
                            }
                        });
                        
                        // 存在しないコンポーネントをcontainedComponentsから削除
                        newCompound.containedComponents = validComponents;
                        
                        if (validComponents.length > 0) {
                            // 取り込まれたコンポーネントのドラッグ処理を設定
                            newCompound.updateContainedComponentDragHandlers();
                            // コンパウンドのドラッグ処理を再設定（コンポーネント追加後）
                            newCompound.setupCompoundDrag();
                            
                            console.log(`Created copy of compound ${this.id} as ${newCompound.id} with ${newCompound.containedComponents.length} components`);
                            console.log(`Copied components:`, newCompound.containedComponents);
                            console.log(`Component offsets:`, newCompound.componentOffsets);
                        } else {
                            console.error(`No valid components found for compound ${newCompound.id}!`);
                        }
                    } else {
                        console.warn(`No components were copied for compound ${newCompound.id}`);
                    }
                }, 200); // タイミングを少し長くする
            }

            registerCompound() {
                // 登録名を聞くダイアログを表示
                const registerName = prompt('コンパウンドの登録名を入力してください:');
                if (!registerName || registerName.trim() === '') {
                    return;
                }
                
                // コンパウンドの状態を取得
                const state = this.serializeState();
                
                // 各コンポーネントの状態を取得して保存
                const componentStates = {};
                if (this.containedComponents && this.containedComponents.length > 0) {
                    this.containedComponents.forEach(componentId => {
                        const component = this.componentContainers[componentId] || document.getElementById(componentId);
                        if (component) {
                            const instance = $(component).data('instance');
                            if (instance && typeof instance.serializeState === 'function') {
                                try {
                                    const componentState = instance.serializeState();
                                    // コンポーネントのタイプも保存
                                    const componentType = instance.getComponentType ? instance.getComponentType() : null;
                                    componentStates[componentId] = {
                                        type: componentType,
                                        state: componentState
                                    };
                                } catch (e) {
                                    console.warn(`Failed to serialize state for component ${componentId}:`, e);
                                }
                            }
                        }
                    });
                }
                
                // 登録されたコンパウンドを保存
                registeredCompounds[registerName.trim()] = {
                    name: registerName.trim(),
                    state: state,
                    containedComponents: this.containedComponents || [],
                    componentOffsets: this.componentOffsets || {},
                    componentStates: componentStates  // 各コンポーネントの状態を保存
                };
                
                // プルダウンメニューを更新
                updateCompoundMenuDropdown();
                
                alert(`コンパウンド「${registerName.trim()}」を登録しました。`);
            }

            initializeResizable() {
                if (isEditMode) {
                    if (!$(this.container).resizable("instance")) {
                        this.container.style.width = '300px';
                        this.container.style.height = '200px';
                        $(this.container).resizable({
                            handles: 'se',
                            minWidth: 200,
                            minHeight: 150,
                            maxWidth: 800,
                            maxHeight: 600,
                            aspectRatio: false,
                            start: (event, ui) => {
                                protectCanvasOnResizeStart(this.container);
                            },
                            resize: (event, ui) => {
                                restoreCanvasOnResize(this.container);
                            },
                            stop: () => {
                                console.log(`Resized compound container ID: ${this.id}`);
                                restoreCanvasOnResizeStop(this.container);
                            }
                        });
                        console.log(`Resizable initialized for compound container ID: ${this.id}`);
                    } else {
                        $(this.container).resizable('enable');
                        console.log(`Resizable enabled for compound container ID: ${this.id}`);
                    }
                } else {
                    if ($(this.container).resizable("instance")) {
                        $(this.container).resizable('disable');
                        console.log(`Resizable disabled for compound container ID: ${this.id}`);
                    }
                }
            }

            serializeState() {
                return {
                    left: this.container.style.left,
                    top: this.container.style.top,
                    width: this.container.style.width,
                    height: this.container.style.height,
                    containedComponents: JSON.stringify(this.containedComponents || []),
                    componentOffsets: JSON.stringify(this.componentOffsets || {})
                };
            }

            restoreState(state) {
                console.log(`[COMPOUND] Restoring state for compound ${this.id}, state keys:`, Object.keys(state));
                console.log(`[COMPOUND] state.containedComponents:`, state.containedComponents);
                console.log(`[COMPOUND] state.componentOffsets:`, state.componentOffsets);
                console.log(`[COMPOUND] state object:`, state);
                
                if (state.left) this.container.style.left = state.left;
                if (state.top) this.container.style.top = state.top;
                if (state.width) this.container.style.width = state.width;
                if (state.height) this.container.style.height = state.height;
                
                // containedComponentsを復元（JSON文字列からパース）
                if (state.containedComponents) {
                    try {
                        this.containedComponents = JSON.parse(state.containedComponents);
                        console.log(`Restored containedComponents for ${this.id}:`, this.containedComponents);
                    } catch (e) {
                        // JSON文字列でない場合（後方互換性のため）
                        if (Array.isArray(state.containedComponents)) {
                            this.containedComponents = state.containedComponents;
                        } else {
                            this.containedComponents = [];
                        }
                        console.warn(`Failed to parse containedComponents for ${this.id}:`, e);
                    }
                } else {
                    this.containedComponents = [];
                }
                
                // componentOffsetsを復元（JSON文字列からパース）
                if (state.componentOffsets) {
                    try {
                        this.componentOffsets = JSON.parse(state.componentOffsets);
                        console.log(`Restored componentOffsets for ${this.id}:`, this.componentOffsets);
                    } catch (e) {
                        // JSON文字列でない場合（後方互換性のため）
                        if (typeof state.componentOffsets === 'object') {
                            this.componentOffsets = state.componentOffsets;
                        } else {
                            this.componentOffsets = {};
                        }
                        console.warn(`Failed to parse componentOffsets for ${this.id}:`, e);
                    }
                } else {
                    this.componentOffsets = {};
                }
                
                // componentContainersを再構築（少し待ってから実行、DOMの更新を待つ）
                setTimeout(() => {
                    if (this.containedComponents && Array.isArray(this.containedComponents)) {
                        this.componentContainers = {};
                        const updatedContainedComponents = [];
                        const updatedComponentOffsets = {};
                        
                        this.containedComponents.forEach((savedComponentId, index) => {
                            let component = document.getElementById(savedComponentId);
                            if (!component) {
                                // getElementByIdで見つからない場合、querySelectorAllで検索
                                const allContainers = document.querySelectorAll('.palette-container');
                                for (const container of allContainers) {
                                    if (container.id === savedComponentId) {
                                        component = container;
                                        break;
                                    }
                                }
                            }
                            
                            // まだ見つからない場合、保存されたoffsetを使って位置でマッチング
                            if (!component && this.componentOffsets && this.componentOffsets[savedComponentId]) {
                                const savedOffset = this.componentOffsets[savedComponentId];
                                const compoundRect = this.container.getBoundingClientRect();
                                const expectedLeft = compoundRect.left + savedOffset.left;
                                const expectedTop = compoundRect.top + savedOffset.top;
                                
                                const allContainers = document.querySelectorAll('.palette-container');
                                for (const container of allContainers) {
                                    // 自分自身と他のコンパウンドコンポーネントは除外
                                    if (container === this.container) continue;
                                    const instance = $(container).data('instance');
                                    if (instance && instance.getComponentType && instance.getComponentType() === 'compound') continue;
                                    
                                    const containerRect = container.getBoundingClientRect();
                                    const distance = Math.sqrt(
                                        Math.pow(containerRect.left - expectedLeft, 2) + 
                                        Math.pow(containerRect.top - expectedTop, 2)
                                    );
                                    
                                    // 10px以内の距離にあるコンポーネントをマッチング
                                    if (distance < 10) {
                                        component = container;
                                        console.log(`Matched component by position: ${savedComponentId} -> ${container.id} (distance: ${distance})`);
                                        break;
                                    }
                                }
                            }
                            
                            if (component) {
                                const actualComponentId = component.id;
                                // 保存されたIDと実際のIDが異なる場合、更新
                                if (actualComponentId !== savedComponentId) {
                                    console.log(`Updating containedComponent ID: ${savedComponentId} -> ${actualComponentId}`);
                                    // componentOffsetsも更新
                                    if (this.componentOffsets && this.componentOffsets[savedComponentId]) {
                                        updatedComponentOffsets[actualComponentId] = this.componentOffsets[savedComponentId];
                                    }
                                } else {
                                    if (this.componentOffsets && this.componentOffsets[savedComponentId]) {
                                        updatedComponentOffsets[actualComponentId] = this.componentOffsets[savedComponentId];
                                    }
                                }
                                
                                updatedContainedComponents.push(actualComponentId);
                                this.componentContainers[actualComponentId] = component;
                                console.log(`Restored componentContainer for ${actualComponentId} in compound ${this.id} (was ${savedComponentId})`);
                            } else {
                                console.warn(`Component ${savedComponentId} not found when restoring compound ${this.id}`);
                            }
                        });
                        
                        // containedComponentsとcomponentOffsetsを更新
                        this.containedComponents = updatedContainedComponents;
                        this.componentOffsets = updatedComponentOffsets;
                        console.log(`Updated containedComponents for compound ${this.id}:`, this.containedComponents);
                        console.log(`Updated componentOffsets for compound ${this.id}:`, this.componentOffsets);
                    }
                    
                    // componentOffsetsが空の場合、再計算する
                    if (this.containedComponents && Array.isArray(this.containedComponents) && 
                        (!this.componentOffsets || Object.keys(this.componentOffsets).length === 0)) {
                        console.log(`Recalculating componentOffsets for compound ${this.id}`);
                        const compoundRect = this.container.getBoundingClientRect();
                        this.containedComponents.forEach(componentId => {
                            const component = this.componentContainers[componentId] || document.getElementById(componentId);
                            if (component) {
                                const componentRect = component.getBoundingClientRect();
                                const relativeLeft = componentRect.left - compoundRect.left;
                                const relativeTop = componentRect.top - compoundRect.top;
                                this.componentOffsets[componentId] = {
                                    left: relativeLeft,
                                    top: relativeTop
                                };
                                console.log(`Recalculated offset for ${componentId}: (${relativeLeft}, ${relativeTop})`);
                            }
                        });
                    }
                    
                    // ドラッグ処理を再設定
                    console.log(`Setting up drag handlers for compound ${this.id} with ${this.containedComponents.length} components`);
                    this.setupContainedComponentDrag();
                    this.setupCompoundDrag();
                }, 200);
            }

            static getConfigSelectors() {
                return {
                    configInput: '#compoundConfig',
                    errorMessage: '#compoundError'
                };
            }

            static validateConfigInput(configInput) {
                if (!configInput || configInput.trim() === '') {
                    return true; // 空欄の場合は有効
                }
                // #id .class 形式をチェック
                const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                if (!regex.test(configInput)) {
                    return false;
                }
                // IDの重複チェック
                const match = configInput.match(/^#([A-Za-z0-9\-_]+)/);
                if (match && match[1] && isIdDuplicate(match[1])) {
                    return 'duplicate';
                }
                return true;
            }

            static createComponent(configInput, errorMessage, additionalInputs) {
                let customId = null;
                let customClasses = [];
                if (configInput && configInput.trim() !== '') {
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) customId = match[1];
                        if (match[2]) customClasses.push(match[2]);
                        if (match[3]) customClasses.push(match[3]);
                    }
                }
                if (customId && isIdDuplicate(customId)) {
                    if (errorMessage) {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                    }
                    return;
                }
                return new PaletteCompound(null, false, customId, customClasses);
            }

            static createFromInput(configInput, errorMessage, additionalInputs) {
                if (configInput) {
                    const validationResult = this.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                }
                const component = this.createComponent(configInput, errorMessage, additionalInputs);
                return component;
            }
        }

        // コンポーネントクラスの登録
        registerComponent('pdf', PalettePDF);
        registerComponent('textarea', PaletteTextarea);
        registerComponent('textbox', PaletteTextbox);
        registerComponent('button', PaletteButton);
        registerComponent('figure', PaletteFigure);
        registerComponent('iframe', PaletteIframe);
        registerComponent('dropdown', PaletteDropdown);
        registerComponent('algebrite', PaletteAlgebrite);
        registerComponent('nerdamer', PaletteNerdamer);
        registerComponent('python', PalettePython);
        registerComponent('terminal', PaletteTerminal);
        registerComponent('filetransfer', PaletteFileTransfer);
        registerComponent('tex', PaletteTeX);
        registerComponent('tex-display', PaletteTeXDisplay);
        registerComponent('markdown', PaletteMarkdown);
        registerComponent('markdown-display', PaletteMarkdownDisplay);
        registerComponent('llm', PaletteLLM);
        registerComponent('lmstudio', PaletteLMStudio);
        registerComponent('cinderella', PaletteCinderella);
        registerComponent('spreadsheet', PaletteSpreadsheet);
        registerComponent('echart', PaletteEChart);
        registerComponent('compound', PaletteCompound);
        registerComponent('speech', PaletteSpeechToText);
        
        // 新しいコンポーネントを生成
        function genComponent(type, pdfDataUrl = null) {
            const ComponentClass = componentRegistry[type];
            if (ComponentClass) {
                ComponentClass.createFromInput(null, null, pdfDataUrl);
            } else {
                console.warn(`未登録のコンポーネントタイプ: ${type}`);
            }
        }

        // 現在の状態を保存
        function saveCurrentState() {
            console.log('Saving current state...');
            $('.palette-container').each(function() {
                const instance = $(this).data('instance');
                if (!instance || typeof instance.serializeState !== 'function') {
                    console.warn(`インスタンスが存在しないか、serializeState が実装されていません: ID=${this.id}`);
                    return;
                }
                
                // Cinderellaコンポーネントの場合、重複したキャンバスコンテナを削除
                if (instance.getComponentType && instance.getComponentType() === 'cinderella') {
                    const inputElement = instance.getInputElement();
                    if (inputElement) {
                        const allCanvasContainers = inputElement.querySelectorAll('[id^="CSCanvas-"]');
                        if (allCanvasContainers.length > 1) {
                            console.log(`Removing ${allCanvasContainers.length - 1} duplicate canvas containers before saving for component ${instance.id}`);
                            // 最初の1つ以外を削除
                            for (let i = 1; i < allCanvasContainers.length; i++) {
                                allCanvasContainers[i].remove();
                            }
                        }
                    }
                }
                
                const state = instance.serializeState();
                for (const key in state) {
                    if (state.hasOwnProperty(key)) {
                        const value = state[key];
                        // nullやundefinedの場合は保存しない（空文字''は保存する＝サブテキスト等を消した状態を反映するため）
                        if (value !== null && value !== undefined) {
                            // コンパウンドコンポーネントの場合、containedComponentsとcomponentOffsetsを特別に処理
                            if (instance.getComponentType && instance.getComponentType() === 'compound' && 
                                (key === 'containedComponents' || key === 'componentOffsets')) {
                                console.log(`Saving ${key} for compound ${instance.id}:`, value);
                            }
                            // キャメルケースをハイフン区切りに変換（例：containedComponents -> contained-components）
                            const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                            $(this).attr(`data-${attrName}`, value);
                        }
                    }
                }
            });
            
            // ペイントデータを取得して保存
            let htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
            
            // カラーピッカー関連のタグを削除（保存前に）
            const removeColorPicker = () => {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    const colorPickers = doc.querySelectorAll('.sp-container');
                    colorPickers.forEach(picker => {
                        if (picker.parentNode) {
                            picker.parentNode.removeChild(picker);
                        }
                    });
                    // DOCTYPEを保持してHTMLを再構築
                    htmlContent = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
                } catch (e) {
                    console.warn('カラーピッカーの削除に失敗しました:', e);
                }
            };
            removeColorPicker();
            
            // ペイントキャンバスのデータを取得
            if (typeof lightPaint !== 'undefined' && lightPaint.obj[0] && lightPaint.obj[0].mainCanvas) {
                const paintImageData = lightPaint.obj[0].mainCanvas.toDataURL('image/png');
                const CANVAS_DATA_ID = 'paint-canvas-data';
                const SCRIPT_ID = 'load-canvas-image-script';
                
                // データ保存用のtextareaが存在するか確認
                let dataTextArea = document.getElementById(CANVAS_DATA_ID);
                if (!dataTextArea) {
                    // textareaが存在しない場合は新規作成
                    const textareaHtml = `<textarea id="${CANVAS_DATA_ID}" style="display:none;"></textarea>`;
                    htmlContent = htmlContent.replace('</body>', textareaHtml + '</body>');
                }
                
                // スクリプトが存在するか確認
                const scriptPattern = new RegExp(`<script id="${SCRIPT_ID}">[\\s\\S]*?</script>`, 'g');
                if (!scriptPattern.test(htmlContent)) {
                    // スクリプトが存在しない場合は追加
                    const scriptContent = `
        <script id="${SCRIPT_ID}">
            (function() {
                // 画像読み込み関数を一度だけ定義
                if (window.loadCanvasImage) return;
                window.loadCanvasImage = function() {
                    const dataArea = document.getElementById('${CANVAS_DATA_ID}');
                    if (!dataArea || !dataArea.value) return;
                    
                    const canvas = document.querySelector('#paintbody .mainCanvas');
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
                    `<textarea id="${CANVAS_DATA_ID}" style="display:none;">[^<]*</textarea>`,
                    'g'
                );
                if (textareaPattern.test(htmlContent)) {
                    htmlContent = htmlContent.replace(
                        textareaPattern,
                        `<textarea id="${CANVAS_DATA_ID}" style="display:none;">${paintImageData}</textarea>`
                    );
                } else {
                    // textareaが存在しない場合は追加
                    const textareaHtml = `<textarea id="${CANVAS_DATA_ID}" style="display:none;">${paintImageData}</textarea>`;
                    htmlContent = htmlContent.replace('</body>', textareaHtml + '</body>');
                }
            }
            
            // Cinderellaコンポーネントのcs*タグをHTMLに埋め込む
            $('.palette-container[data-component-type="cinderella"]').each(function() {
                const instance = $(this).data('instance');
                if (instance && typeof instance.getCindyScripts === 'function') {
                    const csScripts = instance.getCindyScripts();
                    const csScriptIdMap = instance.csScriptIdMap || {};
                    Object.keys(csScripts).forEach(originalId => {
                        // ユニークIDを取得
                        const uniqueId = csScriptIdMap[originalId] || originalId;
                        
                        // 既存のcs*タグを削除（ユニークIDで検索）
                        const existingScriptPattern = new RegExp(`<script[^>]*id="${uniqueId}"[^>]*>[\\s\\S]*?</script>`, 'gi');
                        htmlContent = htmlContent.replace(existingScriptPattern, '');
                        
                        // スクリプト内容内の </script をエスケープして途中で切れないようにする
                        const originalScriptContent = csScripts[originalId] || '';
                        const safeScriptContent = originalScriptContent.replace(/<\/script/gi, '<\\/script');
                        
                        // 新しいcs*タグを追加（ユニークIDを使用）
                        const scriptTag = `<script id="${uniqueId}" type="text/x-cindyscript">${safeScriptContent}</script>`;
                        // headタグの最後に追加
                        htmlContent = htmlContent.replace('</head>', scriptTag + '\n    </head>');
                    });
                }
            });
            
            // 登録されたコンパウンドの情報をHTMLに埋め込む
            const REGISTERED_COMPOUNDS_ID = 'registered-compounds-data';
            const registeredCompoundsData = JSON.stringify(registeredCompounds);
            const registeredCompoundsScript = `
        <script id="${REGISTERED_COMPOUNDS_ID}" type="application/json">
            ${registeredCompoundsData}
        </script>
            `;
            
            // 既存の登録されたコンパウンドのスクリプトを削除
            const existingRegisteredCompoundsPattern = new RegExp(`<script[^>]*id="${REGISTERED_COMPOUNDS_ID}"[^>]*>[\\s\\S]*?</script>`, 'gi');
            htmlContent = htmlContent.replace(existingRegisteredCompoundsPattern, '');
            
            // 新しいスクリプトを追加
            htmlContent = htmlContent.replace('</head>', registeredCompoundsScript + '\n    </head>');
            
            // DOCTYPE宣言が確実に含まれているか確認（quirks modeを防ぐため）
            if (!htmlContent.trim().startsWith('<!DOCTYPE')) {
                htmlContent = '<!DOCTYPE html>\n' + htmlContent;
            }
            
            // DOCTYPE宣言を含む完全なHTMLを生成
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dynamic_components_with_pdfjs.html';
            a.click();
            URL.revokeObjectURL(url);
            console.log('Save complete.');
        }

        // モード切り替え
        function toggleMode() {
            if (isEditMode) {
                switchToUserMode();
            } else {
                promptPasswordAndSwitchToEditMode();
            }
        }
        function switchToUserMode() {
            // ユーザーモードに切り替える前に、すべてのコンポーネントの子要素を閉じた状態にして保存
            $('.palette-container').each(function() {
                const instance = $(this).data('instance');
                if (instance && instance.linkedChildId) {
                    const childElement = document.getElementById(instance.linkedChildId);
                    if (childElement) {
                        // 子要素を閉じた状態にする
                        childElement.style.display = 'none';
                        const toggleButton = instance.container.querySelector('.toggle-button');
                        if (toggleButton) {
                            toggleButton.textContent = '+';
                        }
                        // 閉じた状態を保存
                        instance.container.setAttribute('data-child-visible', 'false');
                        console.log(`Closed and saved child visibility for parent ID: ${instance.id}, child ID: ${instance.linkedChildId}, visible: false`);
                    }
                }
            });
            
            isEditMode = false;
            $('#rightMenu').addClass('hidden');
            console.log('右側のメニューを非表示にしました。');
            $('body').addClass('user-mode');
            $('#modeButton').text('モード: ユーザー');
            console.log('モードをユーザーモードに切り替えました。');
            
            // まず、すべてのコンポーネントの親要素の表示/非表示を制御
            $('.palette-container').each(function() {
                const instance = $(this).data('instance');
                if (instance && typeof instance.initializeResizable === 'function') {
                    instance.initializeResizable();
                }
                // ユーザーモードでの表示/非表示を制御（子要素の復元は後で行う）
                if (instance) {
                    const userModeState = instance.container.getAttribute('data-user-mode-visible') || 'U';
                    if (userModeState === 'E') {
                        instance.container.style.display = 'none';
                    } else {
                        instance.container.style.display = '';
                    }
                }
            });
            
            // 最後に、すべてのコンポーネントの子要素の表示状態を復元
            $('.palette-container').each(function() {
                const instance = $(this).data('instance');
                if (instance && typeof instance.restoreChildVisibility === 'function') {
                    instance.restoreChildVisibility();
                }
            });
            
            // コンパウンドコンポーネントのプルダウンメニューを非表示
            $('.compound-dropdown-container').css('display', 'none');
            
            // コンパウンドコンポーネントのドラッグハンドルを非表示
            $('.compound-dropdown-drag-handle').css('display', 'none');
            
            // クリック取り込みモードを無効化
            clickImportModeCompound = null;
            $('.compound-click-import-button').each(function() {
                $(this).css('backgroundColor', '#f5f5f5').text('click');
            });
        }
        function switchToEditMode() {
            // 編集モードに切り替える前に、すべてのコンポーネントの子要素の現在の表示状態を保存
            // UserSystemAreaの子要素は常に閉じた状態で保存
            $('.palette-container').each(function() {
                const instance = $(this).data('instance');
                if (instance && instance.linkedChildId) {
                    const childElement = document.getElementById(instance.linkedChildId);
                    if (childElement) {
                        // UserSystemAreaの場合は常に閉じた状態で保存
                        if (instance.id === 'UserSystemArea') {
                            childElement.style.display = 'none';
                            const toggleButton = instance.container.querySelector('.toggle-button');
                            if (toggleButton) {
                                toggleButton.textContent = '+';
                            }
                            instance.container.setAttribute('data-child-visible', 'false');
                            console.log(`Closed and saved child visibility for UserSystemArea, visible: false`);
                        } else {
                            // 現在の表示状態を保存（displayが'none'でない場合は表示されているとみなす）
                            const currentDisplay = childElement.style.display || '';
                            const isVisible = currentDisplay !== 'none';
                            instance.container.setAttribute('data-child-visible', isVisible ? 'true' : 'false');
                            console.log(`Saved child visibility for parent ID: ${instance.id}, child ID: ${instance.linkedChildId}, visible: ${isVisible}`);
                        }
                    }
                }
            });
            
            isEditMode = true;
            $('#rightMenu').removeClass('hidden');
            console.log('右側のメニューを表示にしました。');
            $('body').removeClass('user-mode');
            $('#modeButton').text('モード: 編集');
            console.log('モードを編集モードに切り替えました。');
            
            // まず、すべてのコンポーネントの親要素の表示/非表示を制御
            $('.palette-container').each(function() {
                const instance = $(this).data('instance');
                if (instance && typeof instance.initializeResizable === 'function') {
                    instance.initializeResizable();
                }
                // 編集モードではすべてのコンポーネントを表示（子要素の復元は後で行う）
                if (instance) {
                    instance.container.style.display = '';
                }
            });
            
            // 最後に、すべてのコンポーネントの子要素の表示状態を復元
            $('.palette-container').each(function() {
                const instance = $(this).data('instance');
                if (instance && typeof instance.restoreChildVisibility === 'function') {
                    // UserSystemAreaの場合は、restoreChildVisibility()を呼び出す前に子要素を閉じた状態にする
                    if (instance.id === 'UserSystemArea') {
                        if (instance.linkedChildId) {
                            const childElement = document.getElementById(instance.linkedChildId);
                            if (childElement) {
                                childElement.style.display = 'none';
                                instance.container.setAttribute('data-child-visible', 'false');
                            }
                        }
                        // .palette-body内のすべての子要素（.palette-container）を閉じる
                        const paletteBody = instance.container.querySelector('.palette-body');
                        if (paletteBody) {
                            const childContainers = paletteBody.querySelectorAll('.palette-container');
                            childContainers.forEach(childContainer => {
                                childContainer.style.display = 'none';
                            });
                            instance.container.setAttribute('data-child-visible', 'false');
                        }
                    }
                    instance.restoreChildVisibility();
                }
            });
            
            // UserSystemAreaの子要素を確実に閉じた状態にする（念のため再度実行）
            setTimeout(() => {
                const userSystemAreaContainer = document.getElementById('UserSystemArea');
                if (userSystemAreaContainer) {
                    const userSystemAreaInstance = $(userSystemAreaContainer).data('instance');
                    if (userSystemAreaInstance) {
                        // linkedChildIdが存在する場合
                        if (userSystemAreaInstance.linkedChildId) {
                            const childElement = document.getElementById(userSystemAreaInstance.linkedChildId);
                            if (childElement) {
                                childElement.style.display = 'none';
                                const toggleButton = userSystemAreaContainer.querySelector('.toggle-button');
                                if (toggleButton) {
                                    toggleButton.textContent = '+';
                                }
                                userSystemAreaContainer.setAttribute('data-child-visible', 'false');
                                console.log(`Force closed UserSystemArea child after restoreChildVisibility`);
                            }
                        }
                        
                        // .palette-body内のすべての子要素（.palette-container）を閉じる
                        const paletteBody = userSystemAreaContainer.querySelector('.palette-body');
                        if (paletteBody) {
                            const childContainers = paletteBody.querySelectorAll('.palette-container');
                            childContainers.forEach(childContainer => {
                                childContainer.style.display = 'none';
                                console.log(`Force closed UserSystemArea child container: ${childContainer.id || 'no-id'}`);
                            });
                            const toggleButton = userSystemAreaContainer.querySelector('.toggle-button');
                            if (toggleButton) {
                                toggleButton.textContent = '+';
                            }
                            userSystemAreaContainer.setAttribute('data-child-visible', 'false');
                            console.log(`Force closed all UserSystemArea child containers in palette-body`);
                        }
                    }
                }
            }, 100);
            
            // コンパウンドコンポーネントのプルダウンメニューを表示
            $('.compound-dropdown-container').css('display', '');
            
            // コンパウンドコンポーネントのドラッグハンドルを表示
            $('.compound-dropdown-drag-handle').css('display', '');
            
            // コンパウンドモードの状態に応じてタイトルバーとサイズ調整ハンドルの表示を制御
            $('.palette-container').each(function() {
                const component = this;
                const compoundMode = component.getAttribute('data-compound-user-mode');
                if (compoundMode === 'user') {
                    // ユーザーモード：タイトルバーとサイズ調整ハンドルを非表示
                    const titleBar = component.querySelector('.palette-top');
                    if (titleBar) {
                        titleBar.style.display = 'none';
                    }
                    
                    // サイズ調整ハンドルを無効化
                    const instance = $(component).data('instance');
                    if (instance && $(component).resizable("instance")) {
                        $(component).resizable('disable');
                    }
                    
                    // リサイズハンドルを非表示
                    const resizeHandles = component.querySelectorAll('.ui-resizable-handle');
                    resizeHandles.forEach(handle => {
                        handle.style.display = 'none';
                    });
                }
            });
            
            // UserSystemAreaのコンテナを非表示にする（編集モードでも最初は非表示）
            // 「初期化設定」の「開く」ボタンをクリックしたときにのみ表示する
            setTimeout(() => {
                const userSystemAreaContainer = document.getElementById('UserSystemArea');
                if (userSystemAreaContainer) {
                    userSystemAreaContainer.style.display = 'none';
                    // 「初期化設定」ボタンの状態を「開く」に設定
                    $('#toggleUserSystemArea').text('開く');
                    console.log('UserSystemArea hidden on edit mode switch');
                }
            }, 150);
        }
        function promptPasswordAndSwitchToEditMode() {
            $("#passwordModal").dialog("open");
        }

        // PDFファイルを読み込んで表示する関数（PDF用）
        function loadAndDisplayPDF(pdfFile) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const pdfDataUrl = e.target.result;
                console.log(`PDF Data URL: ${pdfDataUrl}`);
                genComponent('pdf', pdfDataUrl);
            };
            reader.onerror = function(e) {
                console.error('FileReader error:', e);
                alert('PDFファイルの読み込み中にエラーが発生しました。');
            };
            reader.readAsDataURL(pdfFile);
        }

        $(document).ready(function() {
            // 登録されたコンパウンドの情報を復元
            const REGISTERED_COMPOUNDS_ID = 'registered-compounds-data';
            const registeredCompoundsScript = document.getElementById(REGISTERED_COMPOUNDS_ID);
            if (registeredCompoundsScript) {
                try {
                    const data = JSON.parse(registeredCompoundsScript.textContent);
                    registeredCompounds = data;
                    console.log('登録されたコンパウンドを復元しました:', Object.keys(registeredCompounds));
                    // プルダウンメニューを更新
                    updateCompoundMenuDropdown();
                } catch (e) {
                    console.warn('登録されたコンパウンドの復元に失敗しました:', e);
                }
            }
            // Algebriteライブラリの読み込み確認（少し待ってからチェック）
            setTimeout(function() {
                console.log('Checking Algebrite library...');
                console.log('window.Algebrite:', typeof window.Algebrite);
                console.log('Algebrite:', typeof Algebrite);
                console.log('window.algebrite:', typeof window.algebrite);
                
                // より詳細なチェック
                const algeKeys = Object.keys(window).filter(k => 
                    k.toLowerCase().includes('alge') || 
                    k.toLowerCase().includes('algebra')
                );
                if (algeKeys.length > 0) {
                    console.log('Found Algebrite-related keys:', algeKeys);
                    algeKeys.forEach(key => {
                        console.log(`  ${key}:`, typeof window[key]);
                    });
                }
                
                if (typeof window.Algebrite !== 'undefined' || typeof Algebrite !== 'undefined' || typeof window.algebrite !== 'undefined') {
                    console.log('Algebrite library is loaded');
                } else {
                    console.warn('Algebrite library is not loaded. Please check the CDN URL.');
                    console.warn('You may need to wait a moment for the library to load, or refresh the page.');
                }
            }, 500); // 500ms待ってからチェック

            // メニュー項目クリック時の処理
            $('#addTextarea').on('click', () => {
                const configInput = $('#textareaConfig').val().trim();
                PaletteTextarea.createFromInput(configInput, $('#textareaError'));
            });
            $('#addTextbox').on('click', () => {
                const configInput = $('#textboxConfig').val().trim();
                PaletteTextbox.createFromInput(configInput, $('#textboxError'));
            });
            $('#addButton').on('click', () => {
                const configInput = $('#buttonConfig').val().trim();
                const labelInput = $('#buttonLabelConfig').val().trim();
                PaletteButton.createFromInput(configInput, $('#buttonError'), { buttonLabelConfig: labelInput });
            });
            $('#addPDF').on('click', function() {
                $('#pdfFileInput').click();
            });
            
        // 「絵を読み込む」ボタン
            $('#addFigure').on('click', function() {
                $('#figureFileInput').click();
            });

            // 「Cinderellaファイルを読み込む」ボタン
            $('#addCinderella').on('click', function() {
                $('#cinderellaFileInput').click();
            });

            // 表計算の追加ボタンクリック時の処理
            $('#addSpreadsheet').on('click', function() {
                const configInput = $('#spreadsheetConfig').val().trim();
                const errorMessage = $('#spreadsheetError');
                PaletteSpreadsheet.createFromInput(configInput, errorMessage);
            });

            $('#addEChart').on('click', function() {
                const configInput = $('#echartConfig').val().trim();
                const errorMessage = $('#echartError');
                PaletteEChart.createFromInput(configInput, errorMessage);
            });

            // コンパウンドの追加ボタンクリック時の処理
            $('#addCompound').on('click', function() {
                const configInput = $('#compoundConfig').val().trim();
                const errorMessage = $('#compoundError');
                PaletteCompound.createFromInput(configInput, errorMessage);
            });

            // 音声文字変換の追加ボタンクリック時の処理
            $('#addSpeech').on('click', function() {
                const configInput = $('#speechConfig').val().trim();
                const errorMessage = $('#speechError');
                PaletteSpeechToText.createFromInput(configInput, errorMessage);
            });
            
            // 登録されたコンパウンドからコンパウンドを作成する関数
            function createCompoundFromRegistered(name) {
                if (!registeredCompounds[name]) {
                    alert(`登録されたコンパウンド「${name}」が見つかりません。`);
                    return;
                }
                
                const registered = registeredCompounds[name];
                const state = registered.state;
                
                // configInputからid/class名を取得
                const configInput = $('#registeredCompoundConfig').val().trim();
                const errorMessage = $('#registeredCompoundError');
                let customId = null;
                let customClasses = [];
                
                if (configInput) {
                    const validationResult = PaletteCompound.validateConfigInput(configInput);
                    if (validationResult === 'duplicate') {
                        errorMessage.text('指定されたIDは既に使用されています').show();
                        return;
                    } else if (validationResult === false) {
                        errorMessage.text('無効な形式です').show();
                        return;
                    }
                    errorMessage.hide();
                    
                    // configInputをパース
                    const regex = /^#([A-Za-z0-9\-_]+)?(?:\s*\.\s*([A-Za-z0-9\-_]+))?$|^\.\s*([A-Za-z0-9\-_]+)$/;
                    const match = configInput.match(regex);
                    if (match) {
                        if (match[1]) customId = match[1];
                        if (match[2]) customClasses.push(match[2]);
                        if (match[3]) customClasses.push(match[3]);
                    }
                } else {
                    errorMessage.hide();
                }
                
                // 新しいコンパウンドを作成
                const newCompound = new PaletteCompound(null, false, customId, customClasses);
                
                // 位置を少しずらす
                const originalLeft = parseFloat(state.left) || 0;
                const originalTop = parseFloat(state.top) || 0;
                newCompound.container.style.left = (originalLeft + 50) + 'px';
                newCompound.container.style.top = (originalTop + 50) + 'px';
                
                // 登録されたコンパウンドのcontainedComponentsとcomponentOffsetsを使用してコンポーネントをコピー
                if (registered.containedComponents && registered.containedComponents.length > 0) {
                    const copiedComponents = [];
                    
                    registered.containedComponents.forEach(componentId => {
                        // 保存されたコンポーネント状態を使用（優先）
                        let componentType = null;
                        let componentState = null;
                        
                        if (registered.componentStates && registered.componentStates[componentId]) {
                            // 保存された状態から取得
                            componentType = registered.componentStates[componentId].type;
                            componentState = registered.componentStates[componentId].state;
                        } else {
                            // フォールバック: 現在の画面にあるコンポーネントから状態を取得
                            const originalComponent = document.getElementById(componentId);
                            if (originalComponent) {
                                const instance = $(originalComponent).data('instance');
                                if (instance) {
                                    componentType = instance.getComponentType();
                                    if (instance.serializeState) {
                                        try {
                                            componentState = instance.serializeState();
                                        } catch (e) {
                                            console.warn(`Failed to serialize state for component ${componentId}:`, e);
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (!componentType) {
                            console.warn(`Component type not found for ${componentId}, skipping...`);
                            return;
                        }
                        
                        const ComponentClass = componentRegistry[componentType];
                        if (!ComponentClass) {
                            console.warn(`Component class not found for type ${componentType}, skipping...`);
                            return;
                        }
                        
                        // 新しいコンポーネントを作成
                        const newComponent = new ComponentClass(null, false, null, []);
                        
                        if (!newComponent.container || !document.body.contains(newComponent.container)) {
                            document.body.appendChild(newComponent.container);
                        }
                        
                        // 保存された状態を復元
                        if (componentState && newComponent.restoreState) {
                            try {
                                newComponent.restoreState(componentState);
                            } catch (e) {
                                console.warn('Failed to restore component state:', e);
                            }
                        }
                        
                        // 相対位置を計算して設定
                        const newCompoundLeft = parseFloat(newCompound.container.style.left) || 0;
                        const newCompoundTop = parseFloat(newCompound.container.style.top) || 0;
                        const offset = registered.componentOffsets[componentId] || { left: 0, top: 0 };
                        
                        newComponent.container.style.left = (newCompoundLeft + offset.left) + 'px';
                        newComponent.container.style.top = (newCompoundTop + offset.top) + 'px';
                        
                        // 新しいコンパウンドに追加
                        newCompound.containedComponents.push(newComponent.id);
                        newCompound.componentContainers[newComponent.id] = newComponent.container;
                        if (registered.componentOffsets[componentId]) {
                            newCompound.componentOffsets[newComponent.id] = registered.componentOffsets[componentId];
                        }
                        
                        copiedComponents.push(newComponent.id);
                    });
                    
                    // ドラッグ処理を設定
                    if (copiedComponents.length > 0) {
                        setTimeout(() => {
                            newCompound.updateContainedComponentDragHandlers();
                            newCompound.setupCompoundDrag();
                        }, 200);
                    }
                }
            }
            
            // コンパウンド作成ボタンのクリックイベント
            $('#createRegisteredCompound').on('click', function() {
                const selectedName = $('#compoundMenuSelect').val();
                if (!selectedName) {
                    alert('登録されたコンパウンドを選択してください。');
                    return;
                }
                createCompoundFromRegistered(selectedName);
                // 入力フィールドをクリア
                $('#registeredCompoundConfig').val('');
            });
            
            // メニュー削除ボタンのクリックイベント
            $('#deleteRegisteredCompound').on('click', function() {
                const selectedName = $('#compoundMenuSelect').val();
                if (!selectedName) {
                    alert('削除するコンパウンドを選択してください。');
                    return;
                }
                
                // 確認メッセージを表示
                const confirmMessage = `「${selectedName}」をコンパウンドメニューから削除します。よろしいですか？`;
                if (confirm(confirmMessage)) {
                    // 登録されたコンパウンドから削除
                    if (registeredCompounds[selectedName]) {
                        delete registeredCompounds[selectedName];
                        console.log(`コンパウンド「${selectedName}」を削除しました。`);
                        
                        // プルダウンメニューを更新
                        updateCompoundMenuDropdown();
                        
                        alert(`コンパウンド「${selectedName}」を削除しました。`);
                    } else {
                        alert(`コンパウンド「${selectedName}」が見つかりません。`);
                    }
                }
            });
            
            // Exportボタンのクリックイベント
            $('#exportRegisteredCompound').on('click', function() {
                const selectedName = $('#compoundMenuSelect').val();
                if (!selectedName) {
                    alert('エクスポートするコンパウンドを選択してください。');
                    return;
                }
                
                if (!registeredCompounds[selectedName]) {
                    alert(`コンパウンド「${selectedName}」が見つかりません。`);
                    return;
                }
                
                // コンパウンドデータをJSON形式に変換
                const compoundData = registeredCompounds[selectedName];
                const jsonData = JSON.stringify(compoundData, null, 2);
                
                // Blobを作成してダウンロード
                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selectedName}.cpd`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`コンパウンド「${selectedName}」をエクスポートしました。`);
            });
            
            // Importボタンのクリックイベント
            $('#importRegisteredCompound').on('click', function() {
                $('#compoundImportFileInput').click();
            });
            
            // ファイル選択時の処理
            $('#compoundImportFileInput').on('change', function(e) {
                const file = e.target.files[0];
                if (!file) {
                    return;
                }
                
                // .cpdファイルかチェック
                if (!file.name.endsWith('.cpd')) {
                    alert('拡張子が.cpdのファイルを選択してください。');
                    this.value = '';
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        // JSONデータをパース
                        const compoundData = JSON.parse(e.target.result);
                        
                        // ファイル名から拡張子を除いたものを登録名とする
                        const registerName = file.name.replace(/\.cpd$/, '');
                        
                        if (!registerName || registerName.trim() === '') {
                            alert('ファイル名が無効です。');
                            return;
                        }
                        
                        // 既に同じ名前が登録されているかチェック
                        if (registeredCompounds[registerName]) {
                            const confirmMessage = `「${registerName}」という名前のコンパウンドが既に登録されています。上書きしますか？`;
                            if (!confirm(confirmMessage)) {
                                return;
                            }
                        }
                        
                        // コンパウンドを登録
                        registeredCompounds[registerName] = compoundData;
                        
                        // プルダウンメニューを更新
                        updateCompoundMenuDropdown();
                        
                        alert(`コンパウンド「${registerName}」をインポートしました。`);
                        console.log(`コンパウンド「${registerName}」をインポートしました。`);
                    } catch (error) {
                        console.error('ファイルの読み込みに失敗しました:', error);
                        alert('ファイルの読み込みに失敗しました。正しい形式の.cpdファイルを選択してください。');
                    }
                };
                
                reader.onerror = function() {
                    alert('ファイルの読み込みに失敗しました。');
                };
                
                reader.readAsText(file);
                
                // ファイル選択をリセット（同じファイルを再度選択できるように）
                this.value = '';
            });
        
            $('#saveButton').on('click', () => saveCurrentState());

            // PDFファイル選択時
            $('#pdfFileInput').on('change', function(e) {
                const file = e.target.files[0];
                if (file && file.type === 'application/pdf') {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const configInput = $('#pdfConfig').val() || '';
                        PalettePDF.createFromInput(configInput, $('#pdfError'), {}, e.target.result);
                    };
                    reader.readAsDataURL(file);
                    $('#pdfError').hide();
                } else {
                    $('#pdfError').text('PDFファイルを選択してください。').show();
                }
                this.value = '';
            });

            // Cinderellaファイル選択時
            $('#cinderellaFileInput').on('change', function(e) {
                const file = e.target.files[0];
                if (file && (file.type === 'text/html' || file.name.endsWith('.html'))) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const configInput = $('#cinderellaConfig').val() || '';
                        PaletteCinderella.createFromInput(configInput, $('#cinderellaError'), {}, e.target.result);
                    };
                    reader.readAsText(file);
                    $('#cinderellaError').hide();
                } else {
                    $('#cinderellaError').text('HTMLファイルを選択してください。').show();
                }
                this.value = '';
            });

            // モード切り替えボタン
            $('#modeButton').on('click', () => toggleMode());

            // パスワード入力ダイアログ
            $("#passwordModal").dialog({
                autoOpen: false,
                modal: true,
                draggable: false,
                resizable: false,
                width: 400,
                zIndex: 3000,
                buttons: {
                    "OK": function() {
                        const password = $('#passwordInput').val();
                        if (password === "Yamaguchi") {
                            switchToEditMode();
                            $(this).dialog("close");
                            $('#passwordInput').val('');
                            console.log('パスワード認証に成功しました。編集モードに切り替えました。');
                        } else {
                            alert("パスワードが正しくありません。");
                            console.warn("ユーザーが間違ったパスワードを入力しました。");
                            $('#passwordInput').val('');
                        }
                    },
                    "キャンセル": function() {
                        $(this).dialog("close");
                        $('#passwordInput').val('');
                        console.log('パスワード入力をキャンセルしました。');
                    }
                },
                close: function() {
                    $('#passwordInput').val('');
                }
            });
            $('#passwordInput').on('keypress', function(e) {
                if (e.which === 13) {
                    e.preventDefault();
                    $("#passwordModal").dialog("option", "buttons")["OK"].apply($("#passwordModal"));
                }
            });

            // 保存されたHTMLを開いたときの既存コンポーネント復元
            // まず、親コンポーネント（tex, markdown, llm）を復元
            const parentComponentTypes = ['tex', 'markdown', 'llm'];
            $('.palette-container').each(function() {
                const type = $(this).data('component-type');
                if (parentComponentTypes.includes(type)) {
                    const ComponentClass = componentRegistry[type];
                    if (ComponentClass) {
                        const componentInstance = new ComponentClass($(this)[0], false);
                        console.log(`Restored parent component of type: ${type} with ID: ${componentInstance.id}`);
                        const linkedChildId = $(this).attr('data-linked-child');
                        if (linkedChildId) {
                            const childElement = document.getElementById(linkedChildId);
                            if (childElement) {
                                const childType = $(childElement).data('component-type');
                                const childComponentClass = componentRegistry[childType];
                                if (childComponentClass) {
                                    const childComponent = new childComponentClass(childElement, true);
                                    componentInstance.linkedChildId = childComponent.container.id;
                                    childComponent.initializeResizable();
                                    console.log(`Restored child component ID: ${childComponent.container.id} for parent ID: ${componentInstance.id}`);
                                } else {
                                    console.warn(`未登録の子コンポーネントタイプ: ${childType}`);
                                }
                            } else {
                                console.warn(`子要素のIDが見つかりません: ${linkedChildId}`);
                            }
                        }
                        const state = {};
                        $.each(this.attributes, function() {
                            if (this.name.startsWith('data-')) {
                                const key = this.name.substring(5);
                                state[key] = this.value;
                            }
                        });
                        componentInstance.restoreState(state);
                        // E/Uトグルボタンの状態を復元
                        if (componentInstance && typeof componentInstance.restoreUserModeToggleButton === 'function') {
                            componentInstance.restoreUserModeToggleButton();
                        }
                        console.log(`Restored state for component ID: ${componentInstance.id}`);
                        
                        // UserSystemAreaの場合は、restoreState()の後に子要素を閉じた状態にする
                        // setTimeoutで少し遅延させて、linkedChildIdが設定されるのを待つ
                        if (componentInstance.id === 'UserSystemArea') {
                            // まず、data-child-visibleをfalseに設定
                            componentInstance.container.setAttribute('data-child-visible', 'false');
                            
                            setTimeout(() => {
                                if (componentInstance.linkedChildId) {
                                    const childElement = document.getElementById(componentInstance.linkedChildId);
                                    if (childElement) {
                                        childElement.style.display = 'none';
                                        const toggleButton = componentInstance.container.querySelector('.toggle-button');
                                        if (toggleButton) {
                                            toggleButton.textContent = '+';
                                        }
                                        componentInstance.container.setAttribute('data-child-visible', 'false');
                                        console.log(`Force closed UserSystemArea child after restoreState (delayed)`);
                                    }
                                }
                                // .palette-body内のすべての子要素（.palette-container）を閉じる
                                const paletteBody = componentInstance.container.querySelector('.palette-body');
                                if (paletteBody) {
                                    const childContainers = paletteBody.querySelectorAll('.palette-container');
                                    childContainers.forEach(childContainer => {
                                        childContainer.style.display = 'none';
                                        console.log(`Force closed UserSystemArea child container: ${childContainer.id || 'no-id'}`);
                                    });
                                    const toggleButton = componentInstance.container.querySelector('.toggle-button');
                                    if (toggleButton) {
                                        toggleButton.textContent = '+';
                                    }
                                    componentInstance.container.setAttribute('data-child-visible', 'false');
                                    console.log(`Force closed all UserSystemArea child containers in palette-body (after restoreState)`);
                                }
                            }, 100);
                        }
                    } else {
                        console.warn(`未登録のコンポーネントタイプ: ${type}`);
                    }
                }
            });
            
            // すべてのコンポーネントの子要素の表示状態を復元
            // UserSystemAreaの場合は、restoreChildVisibility()の後に子要素を閉じた状態にする
            $('.palette-container').each(function() {
                const instance = $(this).data('instance');
                if (instance && typeof instance.restoreChildVisibility === 'function') {
                    instance.restoreChildVisibility();
                    // UserSystemAreaの場合は、restoreChildVisibility()の後に子要素を閉じた状態にする
                    if (instance.id === 'UserSystemArea') {
                        setTimeout(() => {
                            if (instance.linkedChildId) {
                                const childElement = document.getElementById(instance.linkedChildId);
                                if (childElement) {
                                    childElement.style.display = 'none';
                                    const toggleButton = instance.container.querySelector('.toggle-button');
                                    if (toggleButton) {
                                        toggleButton.textContent = '+';
                                    }
                                    instance.container.setAttribute('data-child-visible', 'false');
                                    console.log(`Force closed UserSystemArea child after restoreChildVisibility in restore process`);
                                }
                            }
                            // .palette-body内のすべての子要素（.palette-container）を閉じる
                            const paletteBody = instance.container.querySelector('.palette-body');
                            if (paletteBody) {
                                const childContainers = paletteBody.querySelectorAll('.palette-container');
                                childContainers.forEach(childContainer => {
                                    childContainer.style.display = 'none';
                                });
                                const toggleButton = instance.container.querySelector('.toggle-button');
                                if (toggleButton) {
                                    toggleButton.textContent = '+';
                                }
                                instance.container.setAttribute('data-child-visible', 'false');
                                console.log(`Force closed all UserSystemArea child containers after restoreChildVisibility in restore process`);
                            }
                        }, 50);
                    }
                }
            });
            
            // 次に、表示エリアコンポーネント（tex-display, markdown-display）を復元
            const displayComponentTypes = ['tex-display', 'markdown-display'];
            $('.palette-container').each(function() {
                const type = $(this).data('component-type');
                if (displayComponentTypes.includes(type)) {
                    const ComponentClass = componentRegistry[type];
                    if (ComponentClass) {
                        // 既にインスタンスが設定されている場合はスキップ（親コンポーネントのinit()で既に設定されている）
                        const existingInstance = $(this).data('instance');
                        if (!existingInstance) {
                            const componentInstance = new ComponentClass($(this)[0], false);
                            console.log(`Restored display component of type: ${type} with ID: ${componentInstance.id}`);
                            const state = {};
                            $.each(this.attributes, function() {
                                if (this.name.startsWith('data-')) {
                                    const key = this.name.substring(5);
                                    state[key] = this.value;
                                }
                            });
                            componentInstance.restoreState(state);
                            // E/Uトグルボタンの状態を復元
                            if (componentInstance && typeof componentInstance.restoreUserModeToggleButton === 'function') {
                                componentInstance.restoreUserModeToggleButton();
                            }
                            console.log(`Restored state for display component ID: ${componentInstance.id}`);
                        } else {
                            console.log(`Display component already restored by parent: ${this.id}`);
                        }
                    } else {
                        console.warn(`未登録のコンポーネントタイプ: ${type}`);
                    }
                }
            });
            
            // 最後に、その他のコンポーネントを復元
            $('.palette-container').each(function() {
                const type = $(this).data('component-type');
                if (!parentComponentTypes.includes(type) && !displayComponentTypes.includes(type)) {
                    const ComponentClass = componentRegistry[type];
                    if (ComponentClass) {
                        const componentInstance = new ComponentClass($(this)[0], false);
                        console.log(`Restored component of type: ${type} with ID: ${componentInstance.id}`);
                        const linkedChildId = $(this).attr('data-linked-child');
                        if (linkedChildId) {
                            const childElement = document.getElementById(linkedChildId);
                            if (childElement) {
                                const childType = $(childElement).data('component-type');
                                const childComponentClass = componentRegistry[childType];
                                if (childComponentClass) {
                                    const childComponent = new childComponentClass(childElement, true);
                                    componentInstance.linkedChildId = childComponent.container.id;
                                    childComponent.initializeResizable();
                                    console.log(`Restored child component ID: ${childComponent.container.id} for parent ID: ${componentInstance.id}`);
                                } else {
                                    console.warn(`未登録の子コンポーネントタイプ: ${childType}`);
                                }
                            } else {
                                console.warn(`子要素のIDが見つかりません: ${linkedChildId}`);
                            }
                        }
                        const state = {};
                        $.each(this.attributes, function() {
                            if (this.name.startsWith('data-')) {
                                let key = this.name.substring(5);
                                // ハイフンをキャメルケースに変換（例：contained-components -> containedComponents）
                                key = key.replace(/-([a-z])/g, function(g) { return g[1].toUpperCase(); });
                                state[key] = this.value;
                                // コンパウンドコンポーネントの場合、特別にログを出力
                                if (type === 'compound' && (key === 'containedComponents' || key === 'componentOffsets')) {
                                    console.log(`Found ${key} for compound ${componentInstance.id}:`, this.value);
                                }
                            }
                        });
                        console.log(`State for ${componentInstance.id} (type: ${type}):`, Object.keys(state));
                        if (type === 'compound') {
                            console.log(`State.containedComponents:`, state.containedComponents);
                            console.log(`State.componentOffsets:`, state.componentOffsets);
                        }
                        componentInstance.restoreState(state);
                        console.log(`Restored state for component ID: ${componentInstance.id}`);
                    } else {
                        console.warn(`未登録のコンポーネントタイプ: ${type}`);
                    }
                }
            });
            
            // すべてのEChartsコンポーネントのコードを自動実行
            // 保存されたHTMLを開いたときに、EChartsの図を自動的に表示するため
            setTimeout(() => {
                $('.palette-container[data-component-type="echart"]').each(function() {
                    const instance = $(this).data('instance');
                    if (instance && instance.linkedChildId) {
                        const childElement = document.getElementById(instance.linkedChildId);
                        if (childElement) {
                            const childTextarea = childElement.querySelector('textarea');
                            if (childTextarea && childTextarea.value.trim()) {
                                // EChartsライブラリが読み込まれているか確認
                                if (typeof echarts !== 'undefined') {
                                    instance.executeChildCode();
                                } else {
                                    // EChartsライブラリがまだ読み込まれていない場合、さらに待つ
                                    const checkInterval = setInterval(() => {
                                        if (typeof echarts !== 'undefined') {
                                            clearInterval(checkInterval);
                                            instance.executeChildCode();
                                        }
                                    }, 100);
                                    // 最大5秒待つ
                                    setTimeout(() => clearInterval(checkInterval), 5000);
                                }
                            }
                        }
                    }
                });
            }, 500); // DOMの更新とEChartsライブラリの読み込みを待つ

            // 保存されたHTMLを開いたときはユーザーモード、新規のときは編集モード
            const hasExistingComponents = $('.palette-container').length > 0;
            if (hasExistingComponents) {
                switchToUserMode();
                console.log('保存されたHTMLを検出しました。初期モードをユーザーモードに設定しました。');
            } else {
                switchToEditMode();
                console.log('初期モードを編集モードに設定しました。');
            }

            // UserSystemAreaが存在する場合、ボタンの状態を初期化
            setTimeout(() => {
                const userSystemAreaContainer = document.getElementById('UserSystemArea');
                const toggleButton = $('#toggleUserSystemArea');
                if (userSystemAreaContainer) {
                    // UserSystemAreaが存在する場合
                    // 編集モードで表示されている場合は「閉じる」、非表示の場合は「開く」
                    const computedStyle = window.getComputedStyle(userSystemAreaContainer);
                    const isVisible = userSystemAreaContainer.style.display !== 'none' && 
                                     computedStyle.display !== 'none';
                    if (isVisible && isEditMode) {
                        toggleButton.text('閉じる');
                    } else {
                        toggleButton.text('開く');
                    }
                } else {
                    // UserSystemAreaが存在しない場合は「開く」
                    toggleButton.text('開く');
                }
            }, 100); // コンポーネントの復元が完了するまで少し待つ

            // メニュータイトルバーをドラッグ可能に設定
            $('#rightMenu').draggable({
                handle: '.menu_title'
            });
            console.log('メニュータイトルバーをドラッグ可能に設定しました。');

            // iframeの追加ボタンクリック時の処理
            $('#addIframe').on('click', function() {
                const configInput = $('#iframeConfig').val();
                const urlInput = $('#iframeUrlConfig').val();
                const refreshSecondsInput = $('#iframeRefreshSecondsConfig').val();
                const errorMessage = $('#iframeError');

                PaletteIframe.createFromInput(configInput, errorMessage, {
                    iframeUrlConfig: urlInput,
                    iframeRefreshSecondsConfig: refreshSecondsInput
                });
            });

            // プルダウンメニューの追加ボタンクリック時の処理
            $('#addDropdown').on('click', function() {
                const configInput = $('#dropdownConfig').val();
                const optionsInput = $('#dropdownOptionsConfig').val();
                const errorMessage = $('#dropdownError');

                PaletteDropdown.createFromInput(configInput, errorMessage, {
                    dropdownOptionsConfig: optionsInput
                });
            });

            // Algebrite端末の追加ボタンクリック時の処理
            $('#addAlgebrite').on('click', function() {
                const configInput = $('#algebriteConfig').val().trim();
                const errorMessage = $('#algebriteError');
                PaletteAlgebrite.createFromInput(configInput, errorMessage);
            });

            // Nerdamer端末の追加ボタンクリック時の処理
            $('#addNerdamer').on('click', function() {
                const configInput = $('#nerdamerConfig').val().trim();
                const errorMessage = $('#nerdamerError');
                PaletteNerdamer.createFromInput(configInput, errorMessage);
            });

            // Python端末の追加ボタンクリック時の処理
            $('#addPython').on('click', function() {
                const configInput = $('#pythonConfig').val().trim();
                const errorMessage = $('#pythonError');
                PalettePython.createFromInput(configInput, errorMessage);
            });

            // Terminalの追加ボタンクリック時の処理
            $('#addTerminal').on('click', function() {
                const configInput = $('#terminalConfig').val().trim();
                const errorMessage = $('#terminalError');
                PaletteTerminal.createFromInput(configInput, errorMessage);
            });

            // ファイル転送の追加ボタンクリック時の処理
            $('#addFileTransfer').on('click', function() {
                const configInput = $('#filetransferConfig').val().trim();
                const errorMessage = $('#filetransferError');
                PaletteFileTransfer.createFromInput(configInput, errorMessage);
            });

            // TeXの追加ボタンクリック時の処理
            $('#addTeX').on('click', function() {
                const configInput = $('#texConfig').val().trim();
                const errorMessage = $('#texError');
                PaletteTeX.createFromInput(configInput, errorMessage);
            });

            // TeX表示の追加ボタンクリック時の処理
            $('#addTeXDisplay').on('click', function() {
                const configInput = $('#texDisplayConfig').val().trim();
                const errorMessage = $('#texDisplayError');
                PaletteTeXDisplay.createFromInput(configInput, errorMessage);
            });

            // Markdownの追加ボタンクリック時の処理
            $('#addMarkdown').on('click', function() {
                const configInput = $('#markdownConfig').val().trim();
                const errorMessage = $('#markdownError');
                PaletteMarkdown.createFromInput(configInput, errorMessage);
            });

            // 「LLMを追加」ボタンのクリックイベント
            $('#addLLM').on('click', function() {
                const configInput = $('#llmConfig').val().trim();
                const errorMessage = $('#llmError');
                PaletteLLM.createFromInput(configInput, errorMessage);
            });

            // 「LM Studioを追加」ボタンのクリックイベント
            $('#addLMStudio').on('click', function() {
                const configInput = $('#lmstudioConfig').val().trim();
                const errorMessage = $('#lmstudioError');
                PaletteLMStudio.createFromInput(configInput, errorMessage);
            });

            // 「絵」ファイル選択時の処理
            $('#figureFileInput').on('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const imageDataUrl = e.target.result;
                        const configInput = $('#figureConfig').val();
                        const errorMessage = $('#figureError');

                        // コンフィグ入力の検証
                        if (!PaletteFigure.validateConfigInput(configInput)) {
                            errorMessage.show();
                            // 同じファイルを再度選択できるように value をリセット
                            $('#figureFileInput').val('');
                            return;
                        }
                        errorMessage.hide();
                        
                        const component = PaletteFigure.createComponent(
                            configInput,
                            errorMessage,
                            null,
                            imageDataUrl
                        );
                        if (component) {
                            console.log('Figure component created successfully');
                        }
                        $('#figureConfig').val('');
                    };
                    reader.readAsDataURL(file);
                }
                // 同じ画像ファイルを連続で選択できるように、ここで常にリセット
                $(this).val('');
            });

            // UserSystemAreaを作成または取得する関数
            function getOrCreateUserSystemArea() {
                let userSystemAreaContainer = document.getElementById('UserSystemArea');
                let instance = null;
                
                if (userSystemAreaContainer) {
                    // 既存のコンポーネントを取得
                    instance = $(userSystemAreaContainer).data('instance');
                } else {
                    // 新しくUserSystemAreaコンポーネントを作成
                    const newComponent = new PaletteTextarea(null, false, 'UserSystemArea', []);
                    // Eモードに設定（編集モードのみ表示）
                    newComponent.container.setAttribute('data-user-mode-visible', 'E');
                    // タイトルバーのE/Uボタンを更新
                    const userModeToggleButton = newComponent.container.querySelector('.user-mode-toggle-button');
                    if (userModeToggleButton) {
                        userModeToggleButton.textContent = 'E';
                        userModeToggleButton.title = "編集モードのみ表示";
                    }
                    // ユーザーモードの場合は非表示にする
                    if (!isEditMode) {
                        newComponent.container.style.display = 'none';
                    }
                    instance = newComponent;
                    console.log('UserSystemAreaコンポーネントを新規作成しました。');
                }
                
                return instance;
            }

            // 初期化設定ボタンのクリックイベント
            $('#toggleUserSystemArea').on('click', function() {
                const button = $(this);
                const buttonText = button.text();
                
                if (buttonText === '開く') {
                    // UserSystemAreaを取得または作成
                    const instance = getOrCreateUserSystemArea();
                    
                    // コンポーネントを表示（編集モードの場合のみ）
                    if (instance && instance.container) {
                        if (isEditMode) {
                            instance.container.style.display = '';
                            button.text('閉じる');
                            console.log('UserSystemAreaを表示しました。');
                        } else {
                            // ユーザーモードの場合は編集モードに切り替える必要があることを通知
                            alert('UserSystemAreaを表示するには編集モードに切り替えてください。');
                        }
                    }
                } else {
                    // UserSystemAreaを非表示にする（削除はしない）
                    const userSystemAreaContainer = document.getElementById('UserSystemArea');
                    if (userSystemAreaContainer) {
                        userSystemAreaContainer.style.display = 'none';
                        button.text('開く');
                        console.log('UserSystemAreaを非表示にしました。');
                    }
                }
            });

            // メニューセクションの折りたたみ機能
            $('.menu_section_header').on('click', function() {
                const header = $(this);
                const section = header.data('section');
                const content = $(`.menu_section_content[data-content="${section}"]`);
                
                // 折りたたみ状態を切り替え
                if (content.hasClass('collapsed')) {
                    // 展開
                    content.removeClass('collapsed');
                    header.removeClass('collapsed');
                    // 一時的にmax-heightを解除して実際の高さを取得
                    const tempHeight = content.css('max-height', 'none')[0].scrollHeight;
                    content.css('max-height', '0px');
                    // リフローを強制
                    content[0].offsetHeight;
                    // アニメーション開始
                    content.css('max-height', tempHeight + 'px');
                    setTimeout(() => {
                        content.css('max-height', '');
                    }, 300);
                } else {
                    // 折りたたみ
                    const currentHeight = content[0].scrollHeight;
                    content.css('max-height', currentHeight + 'px');
                    // リフローを強制
                    content[0].offsetHeight;
                    // アニメーション開始
                    setTimeout(() => {
                        content.addClass('collapsed');
                        header.addClass('collapsed');
                    }, 10);
                }
            });

            // UserSystemAreaのテキストエリアに書かれているJavaScriptコードを実行
            // システムの初期化作業が全部終わった後（最後）に実行
            setTimeout(() => {
                const userSystemAreaContainer = document.getElementById('UserSystemArea');
                if (userSystemAreaContainer) {
                    // コンポーネントインスタンスを取得
                    const instance = $(userSystemAreaContainer).data('instance');
                    let textarea = null;
                    
                    if (instance && typeof instance.getInputElement === 'function') {
                        // コンポーネントインスタンスからテキストエリアを取得
                        textarea = instance.getInputElement();
                    } else {
                        // フォールバック: コンテナ内のテキストエリアを直接探す
                        textarea = userSystemAreaContainer.querySelector('textarea');
                    }
                    
                    if (textarea) {
                        const code = textarea.value.trim();
                        if (code) {
                            try {
                                console.log('UserSystemAreaのJavaScriptコードを実行します...');
                                // window.evalを使用してグローバルスコープでコードを実行
                                // これにより、定義した変数や関数がグローバルに利用可能になる
                                window.eval(code);
                                console.log('UserSystemAreaのJavaScriptコードの実行が完了しました。');
                            } catch (error) {
                                console.error('UserSystemAreaのJavaScriptコードの実行中にエラーが発生しました:', error);
                            }
                        }
                    } else {
                        console.log('UserSystemAreaのテキストエリアが見つかりませんでした。');
                    }
                }
            }, 1000); // 他の初期化処理が完了するまで少し待つ
        });
        
