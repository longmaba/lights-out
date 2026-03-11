const MIN = 1;
const MAX = 4;

export const MAIN_LEVEL_COUNT = 30;
export const TUTORIAL_SEEN_KEY = 'lightsOutSeenTutorialV1';

const THREE_BY_THREE_MASKS = [
  [
    [1, 1, 0],
    [1, 1, 0],
    [1, 0, 0]
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0]
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 1, 0]
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 1, 0]
  ]
];

const FOUR_BY_FOUR_MASKS = [
  [
    [1, 1, 1, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 0]
  ],
  [
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 0]
  ],
  [
    [1, 1, 1, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  [
    [0, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0]
  ]
];

const minMovesCache = new Map();

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function cloneMask(mask) {
  return mask ? mask.map((row) => row.slice()) : null;
}

export function getBoardSize(board) {
  return { rows: board.length, cols: board[0].length };
}

export function isActiveCell(mask, row, col) {
  return !mask || Boolean(mask[row][col]);
}

export function countActiveCells(mask, rows, cols) {
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isActiveCell(mask, r, c)) {
        count += 1;
      }
    }
  }
  return count;
}

function serializeMask(mask, rows, cols) {
  if (!mask) {
    return `full:${rows}x${cols}`;
  }
  return mask.map((row) => row.map((cell) => (cell ? '1' : '0')).join('')).join('|');
}

export function isAllEqual(board, mask = null) {
  let target = null;
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (!isActiveCell(mask, r, c)) {
        continue;
      }
      if (target === null) {
        target = board[r][c];
      } else if (board[r][c] !== target) {
        return false;
      }
    }
  }
  return target !== null;
}

export function getNeighbors(row, col, rows, cols, mask = null) {
  const candidates = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1]
  ];

  return candidates.filter(([r, c]) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      return false;
    }
    return isActiveCell(mask, r, c);
  });
}

function canApplyReverse(board, row, col, mask = null) {
  if (!isActiveCell(mask, row, col)) {
    return false;
  }
  if (board[row][col] >= MAX) {
    return false;
  }

  const { rows, cols } = getBoardSize(board);
  const neighbors = getNeighbors(row, col, rows, cols, mask);
  return neighbors.every(([r, c]) => board[r][c] > MIN);
}

function boardToKey(board, mask = null) {
  const { rows, cols } = getBoardSize(board);
  const parts = [];

  for (let r = 0; r < rows; r++) {
    const rowParts = [];
    for (let c = 0; c < cols; c++) {
      rowParts.push(isActiveCell(mask, r, c) ? String(board[r][c]) : 'x');
    }
    parts.push(rowParts.join(','));
  }

  return parts.join(';');
}

function keyToBoard(key) {
  return key.split(';').map((row) => row.split(',').map((value) => (value === 'x' ? null : Number(value))));
}

export function canApplyForwardMoveOnBoard(board, row, col, mask = null) {
  if (!isActiveCell(mask, row, col)) {
    return false;
  }
  if (board[row][col] <= MIN) {
    return false;
  }

  const { rows, cols } = getBoardSize(board);
  return getNeighbors(row, col, rows, cols, mask).every(([r, c]) => board[r][c] < MAX);
}

export function applyForwardMoveOnBoard(board, row, col, mask = null) {
  if (!canApplyForwardMoveOnBoard(board, row, col, mask)) {
    return null;
  }

  const { rows, cols } = getBoardSize(board);
  const next = cloneBoard(board);
  next[row][col] -= 1;
  getNeighbors(row, col, rows, cols, mask).forEach(([r, c]) => {
    next[r][c] += 1;
  });
  return next;
}

export function findMinMovesToSolve(startBoard, mask = null) {
  const { rows, cols } = getBoardSize(startBoard);
  const maskKey = serializeMask(mask, rows, cols);
  const startKey = boardToKey(startBoard, mask);
  const cacheKey = `${maskKey}::${startKey}`;

  if (minMovesCache.has(cacheKey)) {
    return minMovesCache.get(cacheKey);
  }

  if (isAllEqual(startBoard, mask)) {
    minMovesCache.set(cacheKey, 0);
    return 0;
  }

  const queue = [startKey];
  const dist = new Map([[startKey, 0]]);

  for (let head = 0; head < queue.length; head++) {
    const key = queue[head];
    const board = keyToBoard(key);
    const depth = dist.get(key);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isActiveCell(mask, r, c)) {
          continue;
        }

        const nextBoard = applyForwardMoveOnBoard(board, r, c, mask);
        if (!nextBoard) {
          continue;
        }

        const nextKey = boardToKey(nextBoard, mask);
        if (dist.has(nextKey)) {
          continue;
        }

        const nextDepth = depth + 1;
        if (isAllEqual(nextBoard, mask)) {
          minMovesCache.set(cacheKey, nextDepth);
          return nextDepth;
        }

        dist.set(nextKey, nextDepth);
        queue.push(nextKey);
      }
    }
  }

  minMovesCache.set(cacheKey, null);
  return null;
}

function applyReverse(board, row, col, mask = null) {
  const { rows, cols } = getBoardSize(board);
  board[row][col] += 1;
  getNeighbors(row, col, rows, cols, mask).forEach(([r, c]) => {
    board[r][c] -= 1;
  });
}

function createSolvedBoard(value, rows, cols, mask = null) {
  const board = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(isActiveCell(mask, r, c) ? value : null);
    }
    board.push(row);
  }
  return board;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getMoveCapForMainLevel(levelNumber) {
  if (levelNumber <= 9) {
    return 3;
  }
  if (levelNumber === 10) {
    return 4;
  }
  if (levelNumber <= 14) {
    return 5;
  }

  const cyclePos = (levelNumber - 15) % 4;
  return 5 + cyclePos;
}

function getShapeProfileForMainLevel(levelNumber) {
  if (levelNumber <= 5) {
    return {
      rows: 3,
      cols: 3,
      mask: null,
      difficulty: 'easy',
      intro: 'Main stage: classic 3x3 board.'
    };
  }

  if (levelNumber >= 6 && levelNumber <= 9) {
    const mask = THREE_BY_THREE_MASKS[(levelNumber - 6) % THREE_BY_THREE_MASKS.length];
    return {
      rows: 3,
      cols: 3,
      mask,
      difficulty: 'medium',
      intro: 'Change of pace: 3x3 tetris-style shape.'
    };
  }

  if (levelNumber <= 12) {
    return {
      rows: 3,
      cols: 3,
      mask: null,
      difficulty: 'easy',
      intro: 'Main stage: back to normal 3x3 grids.'
    };
  }

  if (levelNumber <= 14) {
    return {
      rows: 4,
      cols: 4,
      mask: null,
      difficulty: 'medium',
      intro: 'Main stage: normal 4x4 grid starts here.'
    };
  }

  const cyclePos = (levelNumber - 15) % 4;
  const hardRound = Math.floor((levelNumber - 15) / 4) + 1;

  if (cyclePos < 3) {
    if (cyclePos === 2) {
      return {
        rows: 4,
        cols: 4,
        mask: null,
        difficulty: 'easy',
        intro: 'Easy rhythm: normal 4x4 practice board.'
      };
    }

    return {
      rows: 3,
      cols: 3,
      mask: null,
      difficulty: 'easy',
      intro: 'Easy rhythm: normal 3x3 board.'
    };
  }

  const useTetrisHard = hardRound % 3 === 0;
  if (useTetrisHard) {
    const mask = FOUR_BY_FOUR_MASKS[hardRound % FOUR_BY_FOUR_MASKS.length];
    return {
      rows: 4,
      cols: 4,
      mask,
      difficulty: 'hard',
      intro: 'Hard round: 4x4 tetris-style challenge.'
    };
  }

  return {
    rows: 4,
    cols: 4,
    mask: null,
    difficulty: 'hard',
    intro: 'Hard round: bigger 4x4 grid and deeper sequence.'
  };
}

function generateWinnableLevel(reverseSteps, rows, cols, moveCap, mask = null) {
  for (let attempt = 0; attempt < 220; attempt++) {
    const solvedValue = randomInt(2, 3);
    const board = createSolvedBoard(solvedValue, rows, cols, mask);

    for (let i = 0; i < reverseSteps; i++) {
      const legalMoves = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (canApplyReverse(board, r, c, mask)) {
            legalMoves.push([r, c]);
          }
        }
      }

      if (legalMoves.length === 0) {
        break;
      }

      const [row, col] = legalMoves[randomInt(0, legalMoves.length - 1)];
      applyReverse(board, row, col, mask);
    }

    if (!isAllEqual(board, mask)) {
      const minMoves = findMinMovesToSolve(board, mask);
      if (minMoves !== null && minMoves > 0 && minMoves <= moveCap) {
        return board;
      }
    }
  }

  const fallbackSolvedValue = Math.random() < 0.5 ? 2 : 3;
  const fallback = createSolvedBoard(fallbackSolvedValue, rows, cols, mask);
  const legalMoves = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (canApplyReverse(fallback, r, c, mask)) {
        legalMoves.push([r, c]);
      }
    }
  }

  if (legalMoves.length > 0) {
    const [row, col] = legalMoves[randomInt(0, legalMoves.length - 1)];
    applyReverse(fallback, row, col, mask);
  }

  return fallback;
}

export function createTutorialPack() {
  return [
    {
      board: [[1, 3, 1]],
      mask: null,
      maxMoves: 3,
      intro: 'Tutorial 1/4: click the only 3 to make all tiles equal.'
    },
    {
      board: [
        [2, 1, 2],
        [1, 3, 1],
        [2, 1, 2]
      ],
      mask: null,
      maxMoves: 3,
      intro: 'Tutorial 2/4: click the center 3 once to win.'
    },
    {
      board: [
        [3, 1, 2],
        [1, 2, 2],
        [2, 2, 2]
      ],
      mask: null,
      maxMoves: 3,
      intro: 'Tutorial 3/4: this one is still a 1-click win.'
    },
    {
      board: [
        [1, 2, 1],
        [1, 2, 1],
        [2, 1, 2]
      ],
      mask: null,
      maxMoves: 3,
      intro: 'Tutorial 4/4: finish with 2 clicks to complete tutorial.'
    }
  ];
}

export function generateMainLevel(levelNumber) {
  const cap = getMoveCapForMainLevel(levelNumber);
  const profile = getShapeProfileForMainLevel(levelNumber);

  const sizeWeight = profile.rows === 4 ? 2 : 0;
  const maskWeight = profile.mask ? 1 : 0;
  const hardWeight = profile.difficulty === 'hard' ? 2 : 0;
  const progressionWeight = Math.floor((levelNumber - 1) / 6);
  const reverseSteps = Math.min(14, cap + sizeWeight + maskWeight + hardWeight + progressionWeight);

  const board = generateWinnableLevel(reverseSteps, profile.rows, profile.cols, cap, profile.mask);

  return {
    board,
    mask: cloneMask(profile.mask),
    maxMoves: cap,
    intro: profile.intro
  };
}
