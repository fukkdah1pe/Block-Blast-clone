import React, { useState, useEffect, useCallback } from 'react';
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


// --- Helper Functions ---
const createEmptyGrid = () => Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

const getRandomBlock = (): BlockData => {
    const key = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
    return { ...BLOCK_SHAPES[key], id: Date.now() + Math.random() };
};

const generateBlocks = (): BlockData[] => {
    return [getRandomBlock(), getRandomBlock(), getRandomBlock()];
};

// --- React Components ---

const Block: React.FC<{ block: BlockData, onDragStart: (e: React.DragEvent, block: BlockData) => void }> = ({ block, onDragStart }) => {
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

    const resetGame = useCallback(() => {
        setGrid(createEmptyGrid());
        setBlocks(generateBlocks());
        setScore(0);
        setGameOver(false);
        setHammers(1);
        setHammerModeActive(false);
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
        const blockElement = e.currentTarget as HTMLElement;
        e.dataTransfer.setDragImage(blockElement, blockElement.offsetWidth / 2, blockElement.offsetHeight / 2);
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
        if (!draggedBlock || !canPlaceBlock(draggedBlock, row, col, grid) || isHammerModeActive) {
            return;
        }

        let points = 0;
        const newGrid = grid.map(r => [...r]);
        for (let r = 0; r < draggedBlock.shape.length; r++) {
            for (let c = 0; c < draggedBlock.shape[0].length; c++) {
                if (draggedBlock.shape[r][c]) {
                    newGrid[row + r][col + c] = draggedBlock.colorIndex + 1;
                    points++;
                }
            }
        }
        
        const rowsToClear: number[] = [];
        const colsToClear: number[] = [];
        for(let i=0; i<GRID_SIZE; i++){
            if(newGrid[i].every(cell => cell > 0)) rowsToClear.push(i);
            if(newGrid.every(row => row[i] > 0)) colsToClear.push(i);
        }
        
        let gridAfterClears = newGrid.map(r => [...r]);
        let linesCleared = rowsToClear.length + colsToClear.length;
        if(linesCleared > 0){
            points += linesCleared * 10 * linesCleared; 
            
            rowsToClear.forEach(r => {
                gridAfterClears[r] = Array(GRID_SIZE).fill(0);
            });
            colsToClear.forEach(c => {
                gridAfterClears.forEach(row => row[c] = 0);
            });
        }

        let newBlocks = blocks.filter(b => b.id !== draggedBlock.id);
        if(newBlocks.length === 0){
            newBlocks = generateBlocks();
        }

        setGrid(gridAfterClears);
        setScore(prev => {
            const newScore = prev + points;
            const oldThreshold = Math.floor(prev / 500);
            const newThreshold = Math.floor(newScore / 500);
            if (newThreshold > oldThreshold) {
                setHammers(h => h + (newThreshold - oldThreshold));
            }
            return newScore;
        });
        setBlocks(newBlocks);
        setDraggedBlock(null);

        if(checkGameOver(gridAfterClears, newBlocks)){
            setGameOver(true);
        }
    };
    
    const handleHammerClick = () => {
        if (hammers > 0) {
            setHammerModeActive(prev => !prev);
        }
    };

    const handleGridCellClick = (row: number, col: number) => {
        if (isHammerModeActive && grid[row][col] > 0) {
            const newGrid = grid.map(r => [...r]);
            newGrid[row][col] = 0; // Destroy the block
            setGrid(newGrid);
            setHammers(prev => prev - 1);
            setHammerModeActive(false);
        } else if (isHammerModeActive) {
            setHammerModeActive(false);
        }
    };

    return (
        <div className="app">
            <header>
                <h1>ZoV</h1>
                <div className="game-info">
                    <div className="scoreboard">
                        Score: <span>{score}</span>
                    </div>
                     <div className="hammer-container">
                        <button 
                            className={`hammer-button ${isHammerModeActive ? 'active' : ''}`}
                            onClick={handleHammerClick}
                            disabled={hammers === 0}
                            aria-label={`Activate Hammer, ${hammers} available`}
                        >
                            🔨 <span className="hammer-count">{hammers}</span>
                        </button>
                    </div>
                </div>
            </header>
            <main className="game-area">
                <div 
                    className={`grid-container ${isHammerModeActive ? 'hammer-mode' : ''}`}
                    onDragLeave={handleDragLeave}
                >
                    {grid.map((rowArr, r_idx) => 
                        rowArr.map((cell, c_idx) => (
                            <div 
                                key={`${r_idx}-${c_idx}`} 
                                className="grid-cell"
                                onClick={() => handleGridCellClick(r_idx, c_idx)}
                                onDragOver={(e) => handleDragOver(e, r_idx, c_idx)}
                                onDrop={() => handleDrop(r_idx, c_idx)}
                                style={{ 
                                    backgroundColor: cell ? BLOCK_COLORS[cell-1] : (previewGrid[r_idx][c_idx] ? `${BLOCK_COLORS[previewGrid[r_idx][c_idx]-1]}80` : undefined)
                                }}
                            ></div>
                        ))
                    )}
                </div>
            </main>
            <footer>
                <div className="blocks-holder">
                    {blocks.map((block, i) => (
                        block ? <Block key={block.id || i} block={block} onDragStart={handleDragStart} /> : null
                    ))}
                </div>
            </footer>

            {isGameOver && (
                <div className="game-over-overlay">
                    <div className="game-over-modal">
                        <h2>Game Over</h2>
                        <p>Final Score: {score}</p>
                        <button onClick={resetGame}>Restart</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);