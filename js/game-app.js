import {
  TUTORIAL_SEEN_KEY,
  cloneBoard,
  cloneMask,
  getBoardSize,
  isActiveCell,
  countActiveCells,
  isAllEqual,
  getNeighbors,
  canApplyForwardMoveOnBoard,
  applyForwardMoveOnBoard,
  findMinMovesToSolve,
  createTutorialPack,
  MAIN_LEVEL_COUNT,
  generateMainLevel
} from './game-core.js';

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const levelLabelEl = document.getElementById('levelLabel');
const moveLabelEl = document.getElementById('moveLabel');
const hintLabelEl = document.getElementById('hintLabel');
const restartBtn = document.getElementById('restartBtn');
const nextBtn = document.getElementById('nextBtn');
const newPackBtn = document.getElementById('newPackBtn');
const tutorialBtn = document.getElementById('tutorialBtn');
const themeBtn = document.getElementById('themeBtn');
const celebrationLayerEl = document.getElementById('celebrationLayer');

const tileClickAudio = new Audio('click.mp3');
tileClickAudio.preload = 'auto';

let levels = [];
let currentLevel = 0;
let currentPackType = 'main';
let state = [];
let initialState = [];
let currentMask = null;
let moves = 0;
let levelHintMoves = null;
let lastAddedKeys = new Set();
const generatingLevels = new Set();
const WIN_EMOJIS = ['\u{1F389}', '\u2728', '\u{1F973}', '\u{1F525}', '\u{1F48E}', '\u{1F31F}', '\u26A1'];

let celebrationTimerId = null;
let celebrationSpawnIntervalId = null;
let wasWonLastRender = false;

function getStateSize() {
  return getBoardSize(state);
}

function isWin() {
  return isAllEqual(state, currentMask);
}

function isStuck() {
  const { rows, cols } = getStateSize();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isActiveCell(currentMask, r, c)) {
        continue;
      }
      if (canApplyForwardMoveOnBoard(state, r, c, currentMask)) {
        return false;
      }
    }
  }
  return true;
}

function canApplyForwardMove(row, col) {
  return canApplyForwardMoveOnBoard(state, row, col, currentMask);
}

function applyForwardMove(row, col) {
  const nextState = applyForwardMoveOnBoard(state, row, col, currentMask);
  if (!nextState) {
    return false;
  }

  state = nextState;
  return true;
}

function tileKey(row, col) {
  return `${row},${col}`;
}

function addParticles(tileEl) {
  const particleCount = 22;
  const now = performance.now();
  const lifeMs = 400;

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('span');
    p.className = 'particle';

    const side = Math.floor(Math.random() * 4);
    let sx = 50;
    let sy = 50;

    if (side === 0) {
      sx = -6;
      sy = Math.random() * 100;
    } else if (side === 1) {
      sx = 106;
      sy = Math.random() * 100;
    } else if (side === 2) {
      sx = Math.random() * 100;
      sy = -6;
    } else {
      sx = Math.random() * 100;
      sy = 106;
    }

    const speed = 0.08 + Math.random() * 0.03;
    let vx = 0;
    let vy = 0;

    if (side === 0) {
      vx = -speed;
      vy = (Math.random() - 0.5) * speed * 0.2;
    } else if (side === 1) {
      vx = speed;
      vy = (Math.random() - 0.5) * speed * 0.2;
    } else if (side === 2) {
      vx = (Math.random() - 0.5) * speed * 0.2;
      vy = -speed;
    } else {
      vx = (Math.random() - 0.5) * speed * 0.2;
      vy = speed;
    }

    const spin = (Math.random() > 0.5 ? 1 : -1) * (80 + Math.random() * 160);

    p.style.setProperty('--sx', `${sx}%`);
    p.style.setProperty('--sy', `${sy}%`);
    p.style.opacity = '0';
    p.style.transform = 'translate(-50%, -50%)';
    tileEl.appendChild(p);

    const startAt = now;

    function step(ts) {
      if (!p.isConnected) {
        return;
      }

      const t = ts - startAt;
      const progress = Math.min(1, t / lifeMs);

      const x = vx * t;
      const y = vy * t;
      const rot = spin * progress;
      const scale = 1 - 0.55 * progress;
      const alpha = progress < 0.08 ? progress / 0.08 : Math.max(0, 1 - progress);

      p.style.opacity = alpha.toFixed(3);
      p.style.transform = `translate(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px)) rotate(${rot.toFixed(1)}deg) scale(${scale.toFixed(3)})`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        p.remove();
      }
    }

    requestAnimationFrame(step);
  }
}


function clearCelebration() {
  if (celebrationTimerId) {
    clearTimeout(celebrationTimerId);
    celebrationTimerId = null;
  }

  if (celebrationSpawnIntervalId) {
    clearInterval(celebrationSpawnIntervalId);
    celebrationSpawnIntervalId = null;
  }

  if (!celebrationLayerEl) {
    return;
  }

  celebrationLayerEl.classList.remove('active');
  celebrationLayerEl.innerHTML = '';
}

function spawnCelebrationBatch(count) {
  if (!celebrationLayerEl) {
    return;
  }

  for (let i = 0; i < count; i++) {
    const emoji = document.createElement('span');
    emoji.className = 'emoji-drop';
    emoji.textContent = WIN_EMOJIS[Math.floor(Math.random() * WIN_EMOJIS.length)];
    emoji.style.setProperty('--x', `${Math.random() * 100}%`);
    emoji.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 220)}px`);
    emoji.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 480)}deg`);
    emoji.style.setProperty('--dur', `${(2.2 + Math.random() * 1.8).toFixed(2)}s`);
    emoji.style.setProperty('--delay', `${(Math.random() * 0.8).toFixed(2)}s`);
    celebrationLayerEl.appendChild(emoji);
  }

  while (celebrationLayerEl.childElementCount > 240) {
    celebrationLayerEl.firstElementChild?.remove();
  }
}

function triggerCelebration() {
  if (!celebrationLayerEl) {
    return;
  }

  clearCelebration();
  celebrationLayerEl.classList.add('active');
  spawnCelebrationBatch(60);

  celebrationSpawnIntervalId = setInterval(() => {
    spawnCelebrationBatch(16);
  }, 420);
}

function playTileClickSound() {
  tileClickAudio.currentTime = 0;
  tileClickAudio.play().catch(() => {
    // Ignore playback errors (for example, browser autoplay restrictions).
  });
}

function onTileClick(row, col) {
  if (isWin() || !isActiveCell(currentMask, row, col)) {
    return;
  }

  const moved = applyForwardMove(row, col);
  if (!moved) {
    statusEl.classList.remove('win');
    if (state[row][col] <= 1) {
      statusEl.textContent = 'That tile is already 1. Choose a tile greater than 1.';
    } else {
      statusEl.textContent = 'Move blocked: a neighboring tile is already 4.';
    }
    render();
    return;
  }

  playTileClickSound();
  const { rows, cols } = getStateSize();
  lastAddedKeys = new Set(getNeighbors(row, col, rows, cols, currentMask).map(([r, c]) => tileKey(r, c)));
  moves += 1;
  render();
}

function ensureMainLevelGenerated(index) {
  if (index < 0 || index >= MAIN_LEVEL_COUNT) {
    return null;
  }

  if (!levels[index]) {
    levels[index] = generateMainLevel(index + 1);
  }

  return levels[index];
}

function prewarmMainLevel(index) {
  if (currentPackType !== 'main') {
    return;
  }
  if (index < 0 || index >= MAIN_LEVEL_COUNT) {
    return;
  }
  if (levels[index] || generatingLevels.has(index)) {
    return;
  }

  generatingLevels.add(index);
  const run = () => {
    try {
      if (!levels[index]) {
        levels[index] = generateMainLevel(index + 1);
      }
    } finally {
      generatingLevels.delete(index);
    }
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 120 });
  } else {
    setTimeout(run, 0);
  }
}

function loadLevel(index) {
  currentLevel = index;

  const level = currentPackType === 'main'
    ? ensureMainLevelGenerated(currentLevel)
    : levels[currentLevel];

  currentMask = cloneMask(level.mask);
  initialState = cloneBoard(level.board);
  state = cloneBoard(initialState);
  moves = 0;
  lastAddedKeys.clear();
  levelHintMoves = findMinMovesToSolve(initialState, currentMask);
  render();

  if (currentPackType === 'main') {
    prewarmMainLevel(currentLevel + 1);
  }
}

function startTutorial(manual = false) {
  currentPackType = 'tutorial';
  levels = createTutorialPack();
  loadLevel(0);
  if (manual) {
    statusEl.textContent = 'Tutorial started. Clear all 4 levels to warm up.';
  }
}

function startMainPack() {
  currentPackType = 'main';
  levels = Array.from({ length: MAIN_LEVEL_COUNT }, () => null);
  generatingLevels.clear();
  loadLevel(0);
}

function formatPackLabel() {
  return currentPackType === 'tutorial' ? 'Tutorial' : 'Level';
}

function render() {
  const won = isWin();
  const stuck = !won && isStuck();
  const { rows, cols } = getStateSize();
  const activeTiles = countActiveCells(currentMask, rows, cols);

  boardEl.classList.toggle('win-state', won);
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  boardEl.setAttribute('aria-label', `${rows} by ${cols} game board`);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isActiveCell(currentMask, r, c)) {
        const hole = document.createElement('div');
        hole.className = 'hole';
        hole.setAttribute('aria-hidden', 'true');
        boardEl.appendChild(hole);
        continue;
      }

      const value = state[r][c];
      const btn = document.createElement('button');
      btn.className = `tile value-${value}`;
      btn.type = 'button';

      const valueEl = document.createElement('span');
      valueEl.className = 'tile-value';
      valueEl.textContent = String(value);
      btn.appendChild(valueEl);

      const addedThisTurn = lastAddedKeys.has(tileKey(r, c));
      if (addedThisTurn) {
        btn.classList.add('tile-added');
        addParticles(btn);
      }

      btn.disabled = won || stuck || !canApplyForwardMove(r, c);
      btn.addEventListener('click', () => onTileClick(r, c));
      boardEl.appendChild(btn);
    }
  }

  const levelName = formatPackLabel();
  levelLabelEl.textContent = `${levelName} ${currentLevel + 1}/${levels.length}`;
  moveLabelEl.textContent = `Moves: ${moves}`;
  hintLabelEl.textContent = levelHintMoves === null ? 'Hint: no known solution' : `Hint: ${levelHintMoves} moves`;

  if (won) {
    statusEl.classList.remove('stuck');
    statusEl.classList.add('win');

    if (currentPackType === 'tutorial' && currentLevel === levels.length - 1) {
      statusEl.textContent = 'Tutorial complete! Press Next Level to start the main levels.';
    } else {
      const hintText = levelHintMoves === null ? '' : ` (hint was ${levelHintMoves})`;
      statusEl.textContent = `Level clear in ${moves} moves${hintText}! Press Next Level to continue.`;
    }
  } else if (stuck) {
    statusEl.classList.remove('win');
    statusEl.classList.add('stuck');
    statusEl.textContent = 'No more legal moves! Restart to try again.';
  } else {
    statusEl.classList.remove('win', 'stuck');
    statusEl.textContent = levels[currentLevel].intro || `Make all ${activeTiles} active tiles equal.`;
  }

  if (!won) {
    nextBtn.disabled = true;
  } else if (currentPackType === 'tutorial' && currentLevel === levels.length - 1) {
    nextBtn.disabled = false;
  } else {
    nextBtn.disabled = currentLevel === levels.length - 1;
  }

  nextBtn.classList.toggle('cta-ready', won && !nextBtn.disabled);

  if (won && !wasWonLastRender) {
    triggerCelebration();
    if (!nextBtn.disabled) {
      nextBtn.focus({ preventScroll: true });
    }
  } else if (!won && wasWonLastRender) {
    clearCelebration();
  }

  wasWonLastRender = won;
  lastAddedKeys.clear();
}

restartBtn.addEventListener('click', () => {
  state = cloneBoard(initialState);
  moves = 0;
  lastAddedKeys.clear();
  render();
});

nextBtn.addEventListener('click', () => {
  clearCelebration();

  if (currentPackType === 'tutorial' && currentLevel === levels.length - 1) {
    startMainPack();
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    return;
  }

  if (currentLevel < levels.length - 1) {
    loadLevel(currentLevel + 1);
  }
});

newPackBtn.addEventListener('click', () => {
  startMainPack();
  localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
});

tutorialBtn.addEventListener('click', () => {
  startTutorial(true);
});

themeBtn.addEventListener('click', () => {
  const isPixel = document.body.classList.contains('theme-pixel');
  document.body.className = isPixel ? 'theme-neon' : 'theme-pixel';
  themeBtn.textContent = isPixel ? 'Pixel Theme' : 'Neon Theme';
});

const hasSeenTutorial = localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
if (hasSeenTutorial) {
  startMainPack();
} else {
  startTutorial();
  localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
}
