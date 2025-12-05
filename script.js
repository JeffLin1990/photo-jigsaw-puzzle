// --- 常量定义：4x4 网格 ---
const GRID_SIZE = 4; // 4x4
const TILE_COUNT = GRID_SIZE * GRID_SIZE; // 16 块
const FINAL_IMAGE_DIM = 1080; // 目标图片尺寸 1080x1080
const TILE_DIM = FINAL_IMAGE_DIM / GRID_SIZE; // 单块尺寸 1080 / 4 = 270 像素

// --- DOM 元素引用 ---
const imageUpload = document.getElementById('imageUpload');
const startButton = document.getElementById('startButton');
const puzzleBoard = document.getElementById('puzzleBoard');
const cropCanvas = document.getElementById('cropCanvas');
const statusMessage = document.getElementById('statusMessage');
const moveCountDisplay = document.getElementById('moveCount');
const timerDisplay = document.getElementById('timer');

// --- 游戏状态变量 ---
let finalBase64Image = ''; 
let piecesData = []; // piecesData[currentPosition] = originalId
let selectedTile = null; 
let moveCount = 0;
let timerInterval = null;
let seconds = 0;
let isGameActive = false;

// --- A. 相片上传与裁剪 ---
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
                    const context = cropCanvas.getContext('2d');
                    const { width: originalWidth, height: originalHeight } = img;

                    const min_dim = Math.min(originalWidth, originalHeight);
                    const sourceX = (originalWidth - min_dim) / 2;
                    const sourceY = (originalHeight - min_dim) / 2;
                    
                    context.clearRect(0, 0, FINAL_IMAGE_DIM, FINAL_IMAGE_DIM);

                    context.drawImage(
                        img,
                        sourceX, sourceY, min_dim, min_dim, 
                        0, 0, FINAL_IMAGE_DIM, FINAL_IMAGE_DIM 
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

// --- B. 图像分割与打乱 ---
startButton.addEventListener('click', startGame);

function startGame() {
    if (!finalBase64Image) {
        statusMessage.textContent = '请先上传并处理图片!';
        return;
    }

    const initialPositions = Array.from({ length: TILE_COUNT }, (_, i) => i);
    
    // Fisher-Yates Shuffle
    for (let i = initialPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [initialPositions[i], initialPositions[j]] = [initialPositions[j], initialPositions[i]];
    }
    
    piecesData = initialPositions; 

    renderBoard();
    
    resetGameInfo();
    isGameActive = true;
    startTimer();
    statusMessage.textContent = '游戏开始! 交换两个方块的位置。';
    puzzleBoard.classList.remove('game-won');
    
    const initialPrompt = document.getElementById('initialPrompt');
    if (initialPrompt) initialPrompt.remove();
}

/**
 * 渲染 4x4 拼图板
 */
function renderBoard() {
    puzzleBoard.innerHTML = ''; 

    for (let i = 0; i < TILE_COUNT; i++) {
        const tile = document.createElement('div');
        tile.classList.add('puzzle-tile');
        
        tile.dataset.currentPosition = i; 
        tile.dataset.originalId = piecesData[i]; 
        
        const originalId = piecesData[i];
        const originalCol = originalId % GRID_SIZE;
        const originalRow = Math.floor(originalId / GRID_SIZE);

        // 图像切片：使用 CSS background-position 
        const bgX = originalCol * TILE_DIM;
        const bgY = originalRow * TILE_DIM;

        tile.style.backgroundImage = `url(${finalBase64Image})`;
        
        // 540px 是页面上的显示尺寸，它是 1080px 的一半
        tile.style.backgroundPosition = `-${bgX / 2}px -${bgY / 2}px`; 
        tile.style.backgroundSize = `${FINAL_IMAGE_DIM / 2}px ${FINAL_IMAGE_DIM / 2}px`; // 540px 540px

        // C. 方块交互与移动
        tile.addEventListener('click', handleTileClick);
        
        puzzleBoard.appendChild(tile);
    }
}


// --- C. 方块交互与移动 (已修复的逻辑) ---

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
        // 第二次点击：执行交换 (仅交换背景和数据，不操作 DOM 节点)
        const tile1 = selectedTile;
        const tile2 = this;

        const pos1 = parseInt(tile1.dataset.currentPosition);
        const pos2 = parseInt(tile2.dataset.currentPosition);
        
        // 1. 数据交换 (piecesData[pos] 存储的是该位置上的原始 ID)
        [piecesData[pos1], piecesData[pos2]] = [piecesData[pos2], piecesData[pos1]];
        
        // 2. 视图交换：根据交换后的原始 ID 重新设置背景图位置
        
        // 2.a. 更新 tile1 (位置 pos1) 的视图
        const originalId_2 = piecesData[pos1]; 
        const originalCol_2 = originalId_2 % GRID_SIZE;
        const originalRow_2 = Math.floor(originalId_2 / GRID_SIZE);
        const bgX_2 = originalCol_2 * TILE_DIM;
        const bgY_2 = originalRow_2 * TILE_DIM;

        tile1.dataset.originalId = originalId_2; 
        tile1.style.backgroundPosition = `-${bgX_2 / 2}px -${bgY_2 / 2}px`;
        
        // 2.b. 更新 tile2 (位置 pos2) 的视图
        const originalId_1 = piecesData[pos2]; 
        const originalCol_1 = originalId_1 % GRID_SIZE;
        const originalRow_1 = Math.floor(originalId_1 / GRID_SIZE);
        const bgX_1 = originalCol_1 * TILE_DIM;
        const bgY_1 = originalRow_1 * TILE_DIM;

        tile2.dataset.originalId = originalId_1; 
        tile2.style.backgroundPosition = `-${bgX_1 / 2}px -${bgY_1 / 2}px`;

        // 清理与检查
        tile1.classList.remove('selected');
        selectedTile = null;
        
        updateMoveCount();
        checkWinCondition();
    }
}


// --- D. 胜利判定 ---

function checkWinCondition() {
    let isWon = true;

    for (let i = 0; i < TILE_COUNT; i++) {
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
    
    document.querySelectorAll('.puzzle-tile').forEach(tile => {
        tile.style.border = 'none';
    });
}


// --- 计时器和步数 ---

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