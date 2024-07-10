const gridsContainer = document.getElementById('gridsContainer');
const raceBtn = document.getElementById('raceBtn');
const resetBtn = document.getElementById('resetBtn');
const startPointBtn = document.getElementById('startPointBtn');
const endPointBtn = document.getElementById('endPointBtn');
const wallBtn = document.getElementById('wallBtn');
const resultsDiv = document.getElementById('results');

const ROWS = 20;
const COLS = 30;
const MAX_ITERATIONS = 10000;
const TIMEOUT_MS = 10000; // 10 seconds

let start = null;
let end = null;
let walls = new Set();
let gridArrays = {};
let isSettingStart = false;
let isSettingEnd = false;
let isSettingWalls = false;
let isGridLocked = false;

const algorithms = ['astar', 'dijkstra', 'bfs'];

function initializeGrids() {
    algorithms.forEach(algo => {
        const grid = document.getElementById(`${algo}Grid`);
        grid.style.gridTemplateColumns = `repeat(${COLS}, 15px)`;
        gridArrays[algo] = [];

        for (let row = 0; row < ROWS; row++) {
            gridArrays[algo][row] = [];
            for (let col = 0; col < COLS; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.addEventListener('click', (e) => cellClickHandler(e, algo));
                cell.addEventListener('mouseover', (e) => cellMouseOverHandler(e, algo));
                grid.appendChild(cell);
                gridArrays[algo][row][col] = cell;
            }
        }
    });
    updateButtonStates();
}

function cellClickHandler(e, algo) {
    if (isGridLocked) return;

    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);

    if (isSettingStart) {
        setStartPoint(row, col);
    } else if (isSettingEnd) {
        setEndPoint(row, col);
    } else if (isSettingWalls) {
        toggleWall(row, col);
    }
}

function cellMouseOverHandler(e, algo) {
    if (isGridLocked) return;

    if (e.buttons === 1 && isSettingWalls) {
        const row = parseInt(e.target.dataset.row);
        const col = parseInt(e.target.dataset.col);
        toggleWall(row, col);
    }
}

function setStartPoint(row, col) {
    if (start) {
        algorithms.forEach(algo => {
            gridArrays[algo][start.row][start.col].classList.remove('start');
        });
    }
    start = { row, col };
    algorithms.forEach(algo => {
        gridArrays[algo][row][col].classList.add('start');
    });
    isSettingStart = false;
    startPointBtn.style.backgroundColor = '';
}

function setEndPoint(row, col) {
    if (end) {
        algorithms.forEach(algo => {
            gridArrays[algo][end.row][end.col].classList.remove('end');
        });
    }
    end = { row, col };
    algorithms.forEach(algo => {
        gridArrays[algo][row][col].classList.add('end');
    });
    isSettingEnd = false;
    endPointBtn.style.backgroundColor = '';
}

function toggleWall(row, col) {
    const key = `${row},${col}`;
    algorithms.forEach(algo => {
        const cell = gridArrays[algo][row][col];
        if (cell !== gridArrays[algo][start.row][start.col] && cell !== gridArrays[algo][end.row][end.col]) {
            cell.classList.toggle('wall');
            if (walls.has(key)) {
                walls.delete(key);
            } else {
                walls.add(key);
            }
        }
    });
}

function resetGrids() {
    isGridLocked = false;
    start = null;
    end = null;
    walls.clear();
    algorithms.forEach(algo => {
        const grid = document.getElementById(`${algo}Grid`);
        grid.innerHTML = '';
    });
    initializeGrids();
    resultsDiv.textContent = '';
    isSettingStart = false;
    isSettingEnd = false;
    isSettingWalls = false;
    startPointBtn.style.backgroundColor = '';
    endPointBtn.style.backgroundColor = '';
    wallBtn.style.backgroundColor = '';
    updateButtonStates();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runRace() {
    if (isGridLocked) {
        alert('The grid is locked. Please reset the grid to start a new race.');
        return;
    }

    if (!start || !end) {
        alert('Please set both start and end points');
        return;
    }

    if (start.row === end.row && start.col === end.col) {
        alert('Start and end points cannot be the same');
        return;
    }

    if (walls.has(`${start.row},${start.col}`) || walls.has(`${end.row},${end.col}`)) {
        alert('Start and end points cannot be walls');
        return;
    }

    isGridLocked = true;
    updateButtonStates();

    try {
        const racePromise = Promise.all(algorithms.map(algo => visualize(algo)));
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Race timed out')), TIMEOUT_MS)
        );

        const results = await Promise.race([racePromise, timeoutPromise]);

        const validResults = results.filter(result => result.pathLength !== Infinity);

        if (validResults.length === 0) {
            resultsDiv.innerHTML = '<h2>No valid path found</h2>';
            return;
        }

        const winner = validResults.reduce((fastest, current) => 
            current.steps < fastest.steps ? current : fastest
        );

        resultsDiv.innerHTML = `
            <h2>Race Results</h2>
            <p><strong>Winner:</strong> ${winner.algorithm.toUpperCase()}</p>
            <p><strong>Steps:</strong> ${winner.steps}</p>
            <p><strong>Path Length:</strong> ${winner.pathLength}</p>
        `;

        algorithms.forEach(algo => {
            const result = results.find(r => r.algorithm === algo);
            document.querySelector(`#${algo}Grid`).parentNode.querySelector('h2').textContent = 
                `${algo.toUpperCase()} - Steps: ${result.steps}, Path: ${result.pathLength === Infinity ? 'Not Found' : result.pathLength}`;
        });
    } catch (error) {
        console.error('Race error:', error);
        resultsDiv.innerHTML = `<h2>Error: ${error.message}</h2>`;
    } finally {
        updateButtonStates();
    }
}

async function visualize(algorithm) {
    const visited = new Set();
    const queue = [{ ...start, path: [] }];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let steps = 0;

    while (queue.length > 0 && steps < MAX_ITERATIONS) {
        let current;
        if (algorithm === 'astar') {
            current = queue.reduce((a, b) => a.f < b.f ? a : b);
            queue.splice(queue.indexOf(current), 1);
        } else {
            current = queue.shift();
        }

        if (current.row === end.row && current.col === end.col) {
            await visualizePath(algorithm, current.path);
            return { algorithm, steps, pathLength: current.path.length };
        }

        const key = `${current.row},${current.col}`;
        if (visited.has(key)) continue;
        visited.add(key);
        steps++;

        if (gridArrays[algorithm][current.row][current.col] !== gridArrays[algorithm][start.row][start.col]) {
            gridArrays[algorithm][current.row][current.col].classList.add('visited');
            await sleep(5);
        }

        for (const [dx, dy] of directions) {
            const newRow = current.row + dx;
            const newCol = current.col + dy;
            const newKey = `${newRow},${newCol}`;

            if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS || walls.has(newKey) || visited.has(newKey)) {
                continue;
            }

            const newPath = [...current.path, { row: current.row, col: current.col }];
            const newNode = { row: newRow, col: newCol, path: newPath };

            if (algorithm === 'astar') {
                const g = newPath.length;
                const h = Math.abs(newRow - end.row) + Math.abs(newCol - end.col);
                newNode.f = g + h;
            }

            queue.push(newNode);
        }
    }

    return { algorithm, steps, pathLength: Infinity };
}

async function visualizePath(algorithm, path) {
    for (const { row, col } of path) {
        if (gridArrays[algorithm][row][col] !== gridArrays[algorithm][start.row][start.col] && 
            gridArrays[algorithm][row][col] !== gridArrays[algorithm][end.row][end.col]) {
            gridArrays[algorithm][row][col].classList.add('path');
            await sleep(25);
        }
    }
}

function updateButtonStates() {
    startPointBtn.disabled = isGridLocked;
    endPointBtn.disabled = isGridLocked;
    wallBtn.disabled = isGridLocked;
    raceBtn.disabled = isGridLocked;
    
    // Reset button should always be enabled
    resetBtn.disabled = false;

    [startPointBtn, endPointBtn, wallBtn, raceBtn].forEach(btn => {
        btn.style.opacity = btn.disabled ? '0.5' : '1';
        btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
    });
}

function testEdgeCases() {
    console.log('Testing edge cases...');

    // Test 1: No valid path
    // resetGrids();
    // setStartPoint(0, 0);
    // setEndPoint(ROWS - 1, COLS - 1);
    // for (let i = 0; i < ROWS; i++) {
    //     toggleWall(i, Math.floor(COLS / 2));
    // }
    // console.log('Test 1: No valid path');
    // runRace();

    // Test 2: Start and end at corners
    // resetGrids();
    // setStartPoint(0, 0);
    // setEndPoint(ROWS - 1, COLS - 1);
    // console.log('Test 2: Start and end at corners');
    // runRace();

    // Test 3: Walled-off end point
    resetGrids();
    setStartPoint(0, 0);
    setEndPoint(ROWS - 1, COLS - 1);
    toggleWall(ROWS - 2, COLS - 1);
    toggleWall(ROWS - 1, COLS - 2);
    console.log('Test 3: Walled-off end point');
    runRace();

    console.log('Edge case testing complete');
}

raceBtn.addEventListener('click', runRace);
resetBtn.addEventListener('click', resetGrids);

startPointBtn.addEventListener('click', () => {
    if (isGridLocked) return;
    isSettingStart = true;
    isSettingEnd = false;
    isSettingWalls = false;
    startPointBtn.style.backgroundColor = '#45a049';
    endPointBtn.style.backgroundColor = '';
    wallBtn.style.backgroundColor = '';
});

endPointBtn.addEventListener('click', () => {
    if (isGridLocked) return;
    isSettingStart = false;
    isSettingEnd = true;
    isSettingWalls = false;
    startPointBtn.style.backgroundColor = '';
    endPointBtn.style.backgroundColor = '#45a049';
    wallBtn.style.backgroundColor = '';
});

wallBtn.addEventListener('click', () => {
    if (isGridLocked) return;
    isSettingStart = false;
    isSettingEnd = false;
    isSettingWalls = !isSettingWalls;
    startPointBtn.style.backgroundColor = '';
    endPointBtn.style.backgroundColor = '';
    wallBtn.style.backgroundColor = isSettingWalls ? '#45a049' : '';
});

// Add a button for running edge case tests
const testBtn = document.createElement('button');
testBtn.textContent = 'Run Edge Case Tests';
testBtn.addEventListener('click', testEdgeCases);
document.getElementById('controls').appendChild(testBtn);

initializeGrids();