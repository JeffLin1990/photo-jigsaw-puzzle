// --- 常量定义：修改 GRID_SIZE 和 TILE_COUNT ---
const GRID_SIZE = 4; // 4x4
const TILE_COUNT = GRID_SIZE * GRID_SIZE; // 16 块
const FINAL_IMAGE_DIM = 1080; // 目标图片尺寸 1080x1080 (不变)
const TILE_DIM = FINAL_IMAGE_DIM / GRID_SIZE; // 单块尺寸 1080 / 4 = 270 像素 (NEW)

// --- DOM 元素引用 (保持不变) ---
const imageUpload = document.getElementById('imageUpload');
const startButton = document.getElementById('startButton');
const puzzleBoard = document.getElementById('puzzleBoard');
const cropCanvas = document.getElementById('cropCanvas');
const statusMessage = document.getElementById('statusMessage');
const moveCountDisplay = document.getElementById('moveCount');
const timerDisplay = document.getElementById('timer');

// --- 游戏状态变量 (保持不变) ---
let finalBase64Image = ''; 
let piecesData = []; // piecesData[currentPosition] = originalId
let selectedTile = null; 
let moveCount = 0;
let timerInterval = null;
let seconds = 0;
let isGameActive = false;

// --- A. 相片上传与裁剪 (功能 A) ---
// 此部分逻辑与 8x8 版本完全相同，因为它只负责生成 1080x1080 的底图。
imageUpload.addEventListener('change', function(event) {
    if (event.target.files.length > 0) {
        const file = event.target.files[0];
        const reader = new FileReader();

        statusMessage.textContent = '正在处理图片...';
        startButton.disabled = true;

        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                try {
                    // 1.2 裁剪逻辑 (中心裁剪)
                    const context = cropCanvas.getContext('2d');
                    const { width: originalWidth, height: originalHeight } = img;

                    const min_dim = Math.min(originalWidth, originalHeight);
                    const sourceX = (originalWidth - min_dim) / 2;
                    const sourceY = (originalHeight - min_dim) / 2;
                    
                    context.clearRect(0, 0, FINAL_IMAGE_DIM, FINAL_IMAGE_DIM);

                    context.drawImage(
                        img,
                        sourceX, sourceY, min_dim, min_dim, // 源矩形 (裁剪区域)
                        0, 0, FINAL_IMAGE_DIM, FINAL_IMAGE_DIM // 目标矩形 (缩放至 1080x1080)
                    );

                    finalBase64Image = cropCanvas.toDataURL('image/jpeg', 0.9);
                    
                    statusMessage.textContent = '图片处理完成。点击 "开始游戏" 按钮。';
                    startButton.disabled = false;
                    puzzleBoard.style.backgroundImage = 'none'; 

                } catch (error) {
                    statusMessage.textContent = '图片处理失败: ' + error.message;
                    console.error('图片处理失败:', error);
                    startButton.disabled = true;
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// --- B. 图像分割与打乱 (功能 B) ---

startButton.addEventListener('click', startGame);

function startGame() {
    if (!finalBase64Image) {
        statusMessage.textContent = '请先上传并处理图片!';
        return;
    }

    // 1. 初始化数据结构 (piecesData)
    const initialPositions = Array.from({ length: TILE_COUNT }, (_, i) => i);
    
    // 2. 打乱算法: Fisher-Yates Shuffle 算法
    for (let i = initialPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [initialPositions[i], initialPositions[j]] = [initialPositions[j], initialPositions[i]];
    }
    
    // piecesData[currentPosition] = originalId
    piecesData = initialPositions; 

    // 3. 渲染拼图板
    renderBoard();
    
    // 4. 游戏状态和计时器
    resetGameInfo();
    isGameActive = true;
    startTimer();
    statusMessage.textContent = '游戏开始! 交换两个方块的位置。';
    puzzleBoard.classList.remove('game-won');
    
    // 隐藏初始提示
    const initialPrompt = document.getElementById('initialPrompt');
    if (initialPrompt) initialPrompt.remove();
}

/**
 * 渲染 $4 \times 4$ 拼图板
 */
function renderBoard() {
    puzzleBoard.innerHTML = ''; // 清空旧板

    for (let i = 0; i < TILE_COUNT; i++) {
        const tile = document.createElement('div');
        tile.classList.add('puzzle-tile');
        // i 是当前位置 (0-15)
        // piecesData[i] 是该位置上放置的原始拼图块 ID (0-15)
        tile.dataset.currentPosition = i; 
        tile.dataset.originalId = piecesData[i]; 
        
        // 计算原始 ID 对应的原始网格坐标 (row, col)
        const originalId = piecesData[i];
        const originalCol = originalId % GRID_SIZE;
        const originalRow = Math.floor(originalId / GRID_SIZE);

        // 2.1 图像切片：使用 CSS background-position 实现
        // OriginalX, OriginalY 都是 1080x1080 坐标系下的值
        const bgX = originalCol * TILE_DIM;
        const bgY = originalRow * TILE_DIM;

        tile.style.backgroundImage = `url(${finalBase64Image})`;
        
        // background-position: 是负值，以定位到正确的 270x270 区域
        // background-size: 540px 540px (页面的 board-size)
        // 缩放比 1080 / 540 = 2
        // 所以背景位置也需要缩小 2 倍： -(bgX / 2) -(bgY / 2)
        tile.style.backgroundPosition = `-${bgX / 2}px -${bgY / 2}px`; 
        tile.style.backgroundSize = `${FINAL_IMAGE_DIM / 2}px ${FINAL_IMAGE_DIM / 2}px`; // 540px 540px

        // C. 方块交互与移动
        tile.addEventListener('click', handleTileClick);
        
        puzzleBoard.appendChild(tile);
    }
}


// --- C. 方块交互与移动 (功能 C) ---
// 逻辑与 8x8 版本完全相同，通过交换 DOM 元素和数据来实现。

function handleTileClick() {
    if (!isGameActive) return;

    if (selectedTile === null) {
        // 第一次点击：选中
        selectedTile = this;
        selectedTile.classList.add('selected');
        statusMessage.textContent = '已选中第一块，请选择第二块进行交换。';

    } else if (selectedTile === this) {
        // 第二次点击：取消选中
        selectedTile.classList.remove('selected');
        selectedTile = null;
        statusMessage.textContent = '取消选中。请选择第一块方块。';

    } else {
        // 第二次点击：交换
        const tile2 = this;
        const parent = puzzleBoard;
        const tile1 = selectedTile;

        // 获取当前位置索引
        const pos1 = parseInt(tile1.dataset.currentPosition);
        const pos2 = parseInt(tile2.dataset.currentPosition);
        
        // 交换 DOM 元素
        if (pos1 < pos2) {
            parent.insertBefore(tile2, tile1);
            parent.insertBefore(tile1, parent.children[pos2]);
        } else {
            parent.insertBefore(tile1, tile2);
            parent.insertBefore(tile2, parent.children[pos1]);
        }

        // 交换 currentPosition 数据属性
        tile1.dataset.currentPosition = pos2;
        tile2.dataset.currentPosition = pos1;
        
        // 交换 piecesData 数组中的原始ID（以便胜利判定）
        [piecesData[pos1], piecesData[pos2]] = [piecesData[pos2], piecesData[pos1]];
        
        // 清除选中状态
        tile1.classList.remove('selected');
        selectedTile = null;
        
        // 更新步数
        updateMoveCount();

        // 胜利判定
        checkWinCondition();
    }
}


// --- D. 胜利判定 (功能 D) ---
// 逻辑与 8x8 版本相同，但遍历数量为 16 块 (TILE_COUNT)。

function checkWinCondition() {
    let isWon = true;

    // 遍历所有 16 个位置
    for (let i = 0; i < TILE_COUNT; i++) {
        // piecesData[i] 存储的是当前位置 i 上的原始 ID
        // 判定条件: current_position (i) == original_id (piecesData[i])
        if (piecesData[i] != i) {
            isWon = false;
            break;
        }
    }
    
    if (isWon) {
        handleWin();
    } else {
        statusMessage.textContent = '方块已交换。继续！';
    }
}

function handleWin() {
    isGameActive = false;
    clearInterval(timerInterval);
    timerInterval = null;

    statusMessage.textContent = '🎉 恭喜，您完成了 4x4 拼图！';
    puzzleBoard.classList.add('game-won');
    
    // 胜利反馈：移除所有方块边界线
    document.querySelectorAll('.puzzle-tile').forEach(tile => {
        tile.style.border = 'none';
    });
}


// --- 可选增强功能 (IV) ---
// 计时器和步数记录逻辑保持不变。

function updateMoveCount() {
    moveCount++;
    moveCountDisplay.textContent = moveCount;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    seconds = 0;
    timerInterval = setInterval(() => {
        seconds++;
        const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
        const remainingSeconds = String(seconds % 60).padStart(2, '0');
        timerDisplay.textContent = `${minutes}:${remainingSeconds}`;
    }, 1000);
}

function resetGameInfo() {
    moveCount = 0;
    moveCountDisplay.textContent = '0';
    seconds = 0;
    timerDisplay.textContent = '00:00';
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}