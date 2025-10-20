import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';

// --- Constants ---
const GRID_SIZE = 8;
const BLOCK_COLORS = [
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f1c40f', // Yellow
    '#e74c3c', // Red
    '#9b59b6', // Purple
    '#e67e22', // Orange
    '#1abc9c', // Teal
];

const BLOCK_SHAPES: { [key: string]: { shape: number[][]; colorIndex: number } } = {
    '1x1': { shape: [[1]], colorIndex: 0 },
    '1x2': { shape: [[1, 1]], colorIndex: 1 },
    '2x1': { shape: [[1], [1]], colorIndex: 1 },
    '1x3': { shape: [[1, 1, 1]], colorIndex: 2 },
    '3x1': { shape: [[1], [1], [1]], colorIndex: 2 },
    '2x2': { shape: [[1, 1], [1, 1]], colorIndex: 3 },
    'L_small': { shape: [[1, 0], [1, 1]], colorIndex: 4 },
    'L_small_90': { shape: [[1, 1], [1, 0]], colorIndex: 4 },
    'L_small_180': { shape: [[1, 1], [0, 1]], colorIndex: 4 },
    'L_small_270': { shape: [[0, 1], [1, 1]], colorIndex: 4 },
    'T_small': { shape: [[1, 1, 1], [0, 1, 0]], colorIndex: 5 },
    '3x3': { shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], colorIndex: 6 },
};

const SHAPE_KEYS = Object.keys(BLOCK_SHAPES);

type BlockData = {
    shape: number[][];
    colorIndex: number;
    id: number;
};

type CellCoordinate = { r: number; c: number };


// --- Helper Functions ---
const createEmptyGrid = () => Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

const getRandomBlock = (): BlockData => {
    const key = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
    return { ...BLOCK_SHAPES[key], id: Date.now() + Math.random() };
};

const generateBlocks = (): BlockData[] => {
    return [getRandomBlock(), getRandomBlock(), getRandomBlock()];
};

// --- Sound Effects ---
class SoundPlayer {
    private audioCtx: AudioContext | null = null;

    private init() {
        if (this.audioCtx || typeof window === 'undefined') return;
        try {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch(e) {
            console.error("Web Audio API is not supported in this browser");
        }
    }

    private play(type: OscillatorType, frequency: number, duration: number) {
        this.init();
        if (!this.audioCtx) return;
        
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.7, this.audioCtx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

        oscillator.start(this.audioCtx.currentTime);
        oscillator.stop(this.audioCtx.currentTime + duration);
    }
    
    public playPlaceSound() {
        this.play('square', 150, 0.1);
    }

    public playClearSound() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx) return;
        this.play('triangle', 440, 0.1);
        setTimeout(() => this.play('triangle', 550, 0.1), 60);
        setTimeout(() => this.play('triangle', 660, 0.15), 120);
    }

    public playHammerActivateSound() {
        this.play('sawtooth', 900, 0.08);
    }

    public playHammerUseSound() {
        this.play('square', 100, 0.15);
    }

    public playGameOverSound() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx) return;
        this.play('sawtooth', 300, 0.2);
        setTimeout(() => this.play('sawtooth', 200, 0.2), 150);
        setTimeout(() => this.play('sawtooth', 100, 0.4), 300);
    }

    public playStartGameSound() {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx) return;
        this.play('sine', 330, 0.1);
        setTimeout(() => this.play('sine', 440, 0.1), 100);
        setTimeout(() => this.play('sine', 550, 0.2), 200);
    }
}


// --- React Components ---

const Block: React.FC<{
    block: BlockData,
    onDragStart: (e: React.DragEvent, block: BlockData) => void,
    onDragEnd: (e: React.DragEvent) => void
}> = ({ block, onDragStart, onDragEnd }) => {
    if (!block) return null;
    const style = {
        gridTemplateRows: `repeat(${block.shape.length}, 1fr)`,
        gridTemplateColumns: `repeat(${block.shape[0].length}, 1fr)`,
    };
    return (
        <div
            className="block-container"
            style={style}
            draggable
            onDragStart={(e) => onDragStart(e, block)}
            onDragEnd={onDragEnd}
        >
            {block.shape.flat().map((cell, i) => (
                <div
                    key={i}
                    className="block-cell"
                    style={{
                        backgroundColor: cell ? BLOCK_COLORS[block.colorIndex] : 'transparent',
                    }}
                ></div>
            ))}
        </div>
    );
};

const App = () => {
    const [grid, setGrid] = useState<number[][]>(createEmptyGrid);
    const [blocks, setBlocks] = useState<BlockData[]>([]);
    const [score, setScore] = useState(0);
    const [isGameOver, setGameOver] = useState(false);
    const [draggedBlock, setDraggedBlock] = useState<BlockData | null>(null);
    const [previewGrid, setPreviewGrid] = useState<number[][]>(createEmptyGrid);
    const [hammers, setHammers] = useState(1);
    const [isHammerModeActive, setHammerModeActive] = useState(false);
    const [isGameStarting, setGameStarting] = useState(true);
    const [justPlacedCells, setJustPlacedCells] = useState<CellCoordinate[]>([]);
    const [clearingCells, setClearingCells] = useState<CellCoordinate[]>([]);
    const soundPlayer = useRef(new SoundPlayer());
    const dragImageRef = useRef<HTMLElement | null>(null);

    const resetGame = useCallback(() => {
        setGameStarting(true);
        setGrid(createEmptyGrid());
        setBlocks(generateBlocks());
        setScore(0);
        setGameOver(false);
        setHammers(1);
        setHammerModeActive(false);
        setJustPlacedCells([]);
        setClearingCells([]);
        setTimeout(() => setGameStarting(false), 1000);
    }, []);
    
    useEffect(() => {
        resetGame();
    }, [resetGame]);

    const canPlaceBlock = useCallback((block: BlockData, row: number, col: number, currentGrid: number[][]) => {
        if (!block) return false;
        for (let r = 0; r < block.shape.length; r++) {
            for (let c = 0; c < block.shape[0].length; c++) {
                if (block.shape[r][c]) {
                    const newRow = row + r;
                    const newCol = col + c;
                    if (
                        newRow >= GRID_SIZE ||
                        newCol >= GRID_SIZE ||
                        currentGrid[newRow][newCol]
                    ) {
                        return false;
                    }
                }
            }
        }
        return true;
    }, []);

    const checkGameOver = useCallback((currentGrid: number[][], currentBlocks: BlockData[]) => {
        if(currentBlocks.length === 0) return false;

        for(const block of currentBlocks){
            if (!block) continue;
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    if (canPlaceBlock(block, r, c, currentGrid)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }, [canPlaceBlock]);
    
    const handleDragStart = (e: React.DragEvent, block: BlockData) => {
        setDraggedBlock(block);
    
        const gridCellNode = document.querySelector('.grid-cell');
        const cellSize = gridCellNode ? Math.round(gridCellNode.getBoundingClientRect().width) : 40;
        const gap = 3;
    
        const dragImage = document.createElement('div');
        dragImageRef.current = dragImage;
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-9999px';
        dragImage.style.left = '-9999px';
        dragImage.style.display = 'grid';
        dragImage.style.gridTemplateRows = `repeat(${block.shape.length}, ${cellSize}px)`;
        dragImage.style.gridTemplateColumns = `repeat(${block.shape[0].length}, ${cellSize}px)`;
        dragImage.style.gap = `${gap}px`;
        dragImage.style.pointerEvents = 'none';
    
        let firstBlockCellCoords = { x: -1, y: -1 };
    
        block.shape.forEach((row, r_idx) => {
            row.forEach((cell, c_idx) => {
                if (cell) { // Only create and place divs for visible cells
                    if (firstBlockCellCoords.x === -1) {
                        firstBlockCellCoords = { x: c_idx, y: r_idx };
                    }
                    const cellDiv = document.createElement('div');
                    cellDiv.style.backgroundColor = BLOCK_COLORS[block.colorIndex];
                    cellDiv.style.borderRadius = '3px';
                    cellDiv.style.boxShadow = 'inset 0 0 5px rgba(255, 255, 255, 0.3)';
                    
                    // Explicitly place the cell in the grid, letting it fill the track
                    cellDiv.style.gridRow = `${r_idx + 1}`;
                    cellDiv.style.gridColumn = `${c_idx + 1}`;
                    
                    dragImage.appendChild(cellDiv);
                }
            });
        });
    
        document.body.appendChild(dragImage);
    
        const offsetX = (firstBlockCellCoords.x * (cellSize + gap)) + Math.round(cellSize / 2);
        const offsetY = (firstBlockCellCoords.y * (cellSize + gap)) + Math.round(cellSize / 2);
    
        e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
    };
    
    const handleDragEnd = (e: React.DragEvent) => {
        if (dragImageRef.current && document.body.contains(dragImageRef.current)) {
            document.body.removeChild(dragImageRef.current);
            dragImageRef.current = null;
        }
    
        setDraggedBlock(null);
        setPreviewGrid(createEmptyGrid());
    };

    const handleDragOver = (e: React.DragEvent, row: number, col: number) => {
        e.preventDefault();
        if (!draggedBlock || isHammerModeActive) return;
        
        const newPreviewGrid = createEmptyGrid();
        if (canPlaceBlock(draggedBlock, row, col, grid)) {
            for (let r = 0; r < draggedBlock.shape.length; r++) {
                for (let c = 0; c < draggedBlock.shape[0].length; c++) {
                    if (draggedBlock.shape[r][c]) {
                        newPreviewGrid[row + r][col + c] = draggedBlock.colorIndex + 1;
                    }
                }
            }
        }
        setPreviewGrid(newPreviewGrid);
    };

    const handleDragLeave = () => {
        setPreviewGrid(createEmptyGrid());
    };

    const handleDrop = (row: number, col: number) => {
        setPreviewGrid(createEmptyGrid());
        if (!draggedBlock || !canPlaceBlock(draggedBlock, row, col, grid) || isHammerModeActive || clearingCells.length > 0) {
            return;
        }
    
        const updateScoreAndHammers = (pointsToAdd: number) => {
            setScore(prev => {
                const newScore = prev + pointsToAdd;
                const oldThreshold = Math.floor(prev / 500);
                const newThreshold = Math.floor(newScore / 500);
                if (newThreshold > oldThreshold) {
                    setHammers(h => h + (newThreshold - oldThreshold));
                }
                return newScore;
            });
        };
    
        // 1. Place block and update grid
        let placementPoints = 0;
        const placedCoords: CellCoordinate[] = [];
        const newGrid = grid.map(r => [...r]);
        for (let r = 0; r < draggedBlock.shape.length; r++) {
            for (let c = 0; c < draggedBlock.shape[0].length; c++) {
                if (draggedBlock.shape[r][c]) {
                    const newRow = row + r;
                    const newCol = col + c;
                    newGrid[newRow][newCol] = draggedBlock.colorIndex + 1;
                    placedCoords.push({ r: newRow, c: newCol });
                    placementPoints++;
                }
            }
        }
        setGrid(newGrid);
        updateScoreAndHammers(placementPoints);
    
        // 2. Animate placement
        setJustPlacedCells(placedCoords);
        setTimeout(() => setJustPlacedCells([]), 300);
    
        // 3. Prepare next set of blocks
        let nextBlocks = blocks.filter(b => b.id !== draggedBlock.id);
        const shouldGenerateNewBlocks = nextBlocks.length === 0;
    
        // 4. Check for line clears
        const rowsToClear: number[] = [];
        const colsToClear: number[] = [];
        for (let i = 0; i < GRID_SIZE; i++) {
            if (newGrid[i].every(cell => cell > 0)) rowsToClear.push(i);
            if (newGrid.every(row => row[i] > 0)) colsToClear.push(i);
        }
    
        if (rowsToClear.length > 0 || colsToClear.length > 0) {
            // 5a. Animate and handle line clear
            soundPlayer.current.playClearSound();
            const cellsToAnimate: CellCoordinate[] = [];
            rowsToClear.forEach(r => { for (let c = 0; c < GRID_SIZE; c++) cellsToAnimate.push({ r, c }); });
            colsToClear.forEach(c => { for (let r = 0; r < GRID_SIZE; r++) { if (!cellsToAnimate.some(cell => cell.r === r && cell.c === c)) cellsToAnimate.push({ r, c }); } });
            setClearingCells(cellsToAnimate);
    
            setTimeout(() => {
                let gridAfterClears = newGrid.map(r => [...r]);
                rowsToClear.forEach(r => { gridAfterClears[r] = Array(GRID_SIZE).fill(0); });
                colsToClear.forEach(c => { gridAfterClears.forEach(row => row[c] = 0); });
                
                setGrid(gridAfterClears);
                setClearingCells([]);
                
                const linesCleared = rowsToClear.length + colsToClear.length;
                updateScoreAndHammers(linesCleared * 10 * linesCleared);
    
                if (shouldGenerateNewBlocks) nextBlocks = generateBlocks();
                setBlocks(nextBlocks);
                
                if (checkGameOver(gridAfterClears, nextBlocks)) {
                    soundPlayer.current.playGameOverSound();
                    setGameOver(true);
                }
            }, 300);
    
        } else {
            // 5b. No lines cleared, continue
            soundPlayer.current.playPlaceSound();
            if (shouldGenerateNewBlocks) nextBlocks = generateBlocks();
            setBlocks(nextBlocks);
    
            if (checkGameOver(newGrid, nextBlocks)) {
                soundPlayer.current.playGameOverSound();
                setGameOver(true);
            }
        }
    };
    
    const handleHammerClick = () => {
        if (hammers > 0) {
            if (!isHammerModeActive) {
                soundPlayer.current.playHammerActivateSound();
            }
            setHammerModeActive(prev => !prev);
        }
    };

    const handleGridCellClick = (row: number, col: number) => {
        if (isHammerModeActive && grid[row][col] > 0) {
            soundPlayer.current.playHammerUseSound();
            const newGrid = grid.map(r => [...r]);
            newGrid[row][col] = 0; // Destroy the block
            setGrid(newGrid);
            setHammers(prev => prev - 1);
            setHammerModeActive(false);
        } else if (isHammerModeActive) {
            setHammerModeActive(false);
        }
    };

    const handleRestartClick = () => {
        soundPlayer.current.playStartGameSound();
        resetGame();
    };

    return (
        <div className="app">
            <header>
                <h1>Ставь Блок</h1>
                <div className="game-info">
                    <div className="scoreboard">
                        Очки: <span>{score}</span>
                    </div>
                     <div className="hammer-container">
                        <button 
                            className={`hammer-button ${isHammerModeActive ? 'active' : ''}`}
                            onClick={handleHammerClick}
                            disabled={hammers === 0}
                            aria-label={`Активировать молот, доступно ${hammers}`}
                        >
                            🔨 <span className="hammer-count">{hammers}</span>
                        </button>
                    </div>
                </div>
            </header>
            <main className="game-area">
                <div 
                    className={`grid-container ${isHammerModeActive ? 'hammer-mode' : ''} ${isGameStarting ? 'starting' : ''}`}
                    onDragLeave={handleDragLeave}
                >
                    {grid.map((rowArr, r_idx) => 
                        rowArr.map((cell, c_idx) => {
                            const isPlaced = justPlacedCells.some(c => c.r === r_idx && c.c === c_idx);
                            const isClearing = clearingCells.some(c => c.r === r_idx && c.c === c_idx);
                            const isPreview = previewGrid[r_idx][c_idx] > 0 && !cell;
                            const cellClasses = `grid-cell ${isPlaced ? 'placed' : ''} ${isClearing ? 'clearing' : ''} ${isPreview ? 'preview' : ''}`;
                            const previewColor = isPreview ? BLOCK_COLORS[previewGrid[r_idx][c_idx] - 1] : undefined;

                            return (
                                <div 
                                    key={`${r_idx}-${c_idx}`} 
                                    className={cellClasses}
                                    onClick={() => handleGridCellClick(r_idx, c_idx)}
                                    onDragOver={(e) => handleDragOver(e, r_idx, c_idx)}
                                    onDrop={() => handleDrop(r_idx, c_idx)}
                                    style={{ 
                                        backgroundColor: cell ? BLOCK_COLORS[cell - 1] : undefined,
                                        '--preview-color': previewColor,
                                        animationDelay: isGameStarting ? `${(r_idx * GRID_SIZE + c_idx) * 15}ms` : undefined
                                    }}
                                ></div>
                            );
                        })
                    )}
                </div>
            </main>
            <footer>
                <div className="blocks-holder">
                    {blocks.map((block, i) => (
                        block ? <Block key={block.id || i} block={block} onDragStart={handleDragStart} onDragEnd={handleDragEnd} /> : null
                    ))}
                </div>
            </footer>

            {isGameOver && (
                <div className="game-over-overlay">
                    <div className="game-over-modal">
                        <h2>Игра окончена</h2>
                        <p>Итоговый счет: {score}</p>
                        <button onClick={handleRestartClick}>Начать заново</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);