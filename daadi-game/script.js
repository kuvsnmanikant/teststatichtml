const positions = [
  { x: 12, y: 12 },
  { x: 50, y: 12 },
  { x: 88, y: 12 },
  { x: 12, y: 50 },
  { x: 88, y: 50 },
  { x: 12, y: 88 },
  { x: 50, y: 88 },
  { x: 88, y: 88 },
  { x: 25, y: 25 },
  { x: 50, y: 25 },
  { x: 75, y: 25 },
  { x: 25, y: 50 },
  { x: 75, y: 50 },
  { x: 25, y: 75 },
  { x: 50, y: 75 },
  { x: 75, y: 75 },
  { x: 38, y: 38 },
  { x: 50, y: 38 },
  { x: 62, y: 38 },
  { x: 38, y: 50 },
  { x: 62, y: 50 },
  { x: 38, y: 62 },
  { x: 50, y: 62 },
  { x: 62, y: 62 },
];

const lineSegments = [
  [0, 1],
  [1, 2],
  [2, 4],
  [4, 7],
  [7, 6],
  [6, 5],
  [5, 3],
  [3, 0],
  [8, 9],
  [9, 10],
  [10, 12],
  [12, 15],
  [15, 14],
  [14, 13],
  [13, 11],
  [11, 8],
  [16, 17],
  [17, 18],
  [18, 20],
  [20, 23],
  [23, 22],
  [22, 21],
  [21, 19],
  [19, 16],
  [1, 9],
  [3, 11],
  [4, 12],
  [6, 14],
  [9, 17],
  [11, 19],
  [12, 20],
  [14, 22],
];

const mills = [
  [0, 1, 2],
  [0, 3, 5],
  [2, 4, 7],
  [5, 6, 7],
  [8, 9, 10],
  [8, 11, 13],
  [10, 12, 15],
  [13, 14, 15],
  [16, 17, 18],
  [16, 19, 21],
  [18, 20, 23],
  [21, 22, 23],
  [1, 9, 17],
  [3, 11, 19],
  [4, 12, 20],
  [6, 14, 22],
];

function createGameState() {
  return {
    board: Array(24).fill(null),
    currentPlayer: 1,
    phase: "place",
    selectedIndex: null,
    pendingRemoval: false,
    winner: null,
    placedCount: 0,
    piecesOnBoard: { 1: 0, 2: 0 },
    history: [],
  };
}

const state = createGameState();

function getOpponent(player) {
  return player === 1 ? 2 : 1;
}

function copyState(snapshot = state) {
  return {
    board: snapshot.board.slice(),
    currentPlayer: snapshot.currentPlayer,
    phase: snapshot.phase,
    selectedIndex: snapshot.selectedIndex,
    pendingRemoval: snapshot.pendingRemoval,
    winner: snapshot.winner,
    placedCount: snapshot.placedCount,
    piecesOnBoard: { ...snapshot.piecesOnBoard },
  };
}

function pushHistory() {
  state.history.push(copyState());
  if (state.history.length > 200) {
    state.history.shift();
  }
}

function undoPreviousStep() {
  if (!state.history.length) return;
  const previous = state.history.pop();
  Object.assign(state, previous);
  render();
}

function switchTurn() {
  state.currentPlayer = getOpponent(state.currentPlayer);
  state.selectedIndex = null;
}

function countMills(player, board = state.board) {
  return mills.filter((mill) => mill.every((idx) => board[idx] === player)).length;
}

function isMill(index, player, board = state.board) {
  return mills.some((mill) => mill.includes(index) && mill.every((idx) => board[idx] === player));
}

function getRemovableOpponentIndices(player) {
  const opponent = getOpponent(player);
  return state.board
    .map((stone, idx) => ({ stone, idx }))
    .filter(({ stone }) => stone === opponent)
    .map(({ idx }) => idx);
}

function canRemove(index) {
  const opponent = getOpponent(state.currentPlayer);
  const removableIndices = getRemovableOpponentIndices(state.currentPlayer);
  const clickedInMill = isMill(index, opponent);
  const hasNonMill = removableIndices.some((idx) => !isMill(idx, opponent));

  if (!clickedInMill) {
    return true;
  }

  return !hasNonMill;
}

function getNeighbors(index) {
  return lineSegments
    .filter(([a, b]) => a === index || b === index)
    .flatMap(([a, b]) => [a, b])
    .filter((neighbor) => neighbor !== index);
}

function checkWinner(player = state.currentPlayer, allowPieceCountWin = false) {
  const opponent = getOpponent(player);
  const opponentCount = state.piecesOnBoard[opponent];

  if (opponentCount > 0 && opponentCount <= 2) {
    if (state.phase === "move") {
      return true;
    }
    if (allowPieceCountWin && state.placedCount === 18) {
      return true;
    }
  }

  if (state.phase !== "move") {
    return false;
  }

  if (opponentCount > 0) {
    const hasAnyMove = state.board.some((stone, idx) => {
      if (stone !== opponent) return false;
      if (state.piecesOnBoard[opponent] <= 3) {
        return state.board.some((cell) => cell === null);
      }
      return getNeighbors(idx).some((neighbor) => state.board[neighbor] === null);
    });

    return !hasAnyMove;
  }

  return false;
}

function isValidMove(fromIndex, toIndex) {
  if (state.board[toIndex] !== null) return false;
  if (state.piecesOnBoard[state.currentPlayer] <= 3) return true;
  return getNeighbors(fromIndex).includes(toIndex);
}

function resetGame() {
  Object.assign(state, createGameState());
  render();
}

function finalizeTurn() {
  if (state.pendingRemoval) return;

  if (checkWinner()) {
    state.winner = state.currentPlayer;
    render();
    return;
  }

  switchTurn();
  render();
}

function placeStone(index) {
  if (state.board[index] !== null || state.phase !== "place") return;

  pushHistory();
  const beforeMills = countMills(state.currentPlayer);
  state.board[index] = state.currentPlayer;
  state.placedCount += 1;
  state.piecesOnBoard[state.currentPlayer] += 1;

  const afterMills = countMills(state.currentPlayer);
  const formedMill = afterMills > beforeMills;

  if (formedMill) {
    state.pendingRemoval = true;
    state.selectedIndex = null;
    state.phase = "place";
    render();
    return;
  }

  if (state.placedCount === 18) {
    state.phase = "move";
    switchTurn();
    render();
    return;
  }

  finalizeTurn();
}

function moveStone(fromIndex, toIndex) {
  if (state.phase !== "move") return;
  if (state.board[fromIndex] !== state.currentPlayer) return;
  if (!isValidMove(fromIndex, toIndex)) return;

  pushHistory();
  // Determine which mills existed before the move, then which exist after.
  const beforeMillIndices = mills
    .map((mill, idx) => ({ mill, idx }))
    .filter(({ mill }) => mill.every((i) => state.board[i] === state.currentPlayer))
    .map(({ idx }) => idx);

  state.board[fromIndex] = null;
  state.board[toIndex] = state.currentPlayer;

  const afterMillIndices = mills
    .map((mill, idx) => ({ mill, idx }))
    .filter(({ mill }) => mill.every((i) => state.board[i] === state.currentPlayer))
    .map(({ idx }) => idx);

  // A mill is "formed" if any mill index exists after the move that did not
  // exist before the move (covers moves that shift a mill position).
  const formedMill = afterMillIndices.some((idx) => !beforeMillIndices.includes(idx));

  if (formedMill) {
    state.pendingRemoval = true;
    state.selectedIndex = null;
    render();
    return;
  }

  finalizeTurn();
}

function removeStone(index) {
  if (!state.pendingRemoval) return;
  const opponent = getOpponent(state.currentPlayer);
  if (state.board[index] !== opponent) return;
  if (!canRemove(index)) return;

  pushHistory();
  state.board[index] = null;
  state.piecesOnBoard[opponent] -= 1;
  state.pendingRemoval = false;

  if (state.placedCount === 18) {
    state.phase = "move";
  }

  if (checkWinner(state.currentPlayer, true)) {
    state.winner = state.currentPlayer;
    render();
    return;
  }

  switchTurn();
  render();
}

function handleCellClick(index) {
  if (state.winner) return;

  if (state.pendingRemoval) {
    removeStone(index);
    return;
  }

  if (state.phase === "place") {
    placeStone(index);
    return;
  }

  const occupant = state.board[index];

  if (occupant === state.currentPlayer) {
    state.selectedIndex = state.selectedIndex === index ? null : index;
    render();
    return;
  }

  if (state.selectedIndex !== null) {
    moveStone(state.selectedIndex, index);
  }
}

function renderBoard() {
  if (typeof document === "undefined") return;

  const boardEl = document.getElementById("board");
  boardEl.innerHTML = "";
  boardEl.classList.toggle("winner", Boolean(state.winner));

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");

  lineSegments.forEach(([a, b]) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", positions[a].x);
    line.setAttribute("y1", positions[a].y);
    line.setAttribute("x2", positions[b].x);
    line.setAttribute("y2", positions[b].y);
    line.setAttribute("stroke", "rgba(73, 37, 16, 0.95)");
    line.setAttribute("stroke-width", "1.8");
    svg.appendChild(line);
  });

  boardEl.appendChild(svg);

  if (state.winner) {
    const overlay = document.createElement("div");
    const winnerClass = state.winner === 1 ? "red" : "blue";
    overlay.className = `board-overlay ${winnerClass}`;
    overlay.textContent = `Player ${state.winner} wins!`;
    boardEl.appendChild(overlay);
  }

  positions.forEach((pos, index) => {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.setAttribute("type", "button");
    cell.style.left = `${pos.x}%`;
    cell.style.top = `${pos.y}%`;

    const stone = state.board[index];
    if (stone === 1) {
      cell.classList.add("red");
    } else if (stone === 2) {
      cell.classList.add("blue");
    }

    if (state.phase === "place" && stone === null) {
      cell.classList.add("placement-ready");
    }

    if (state.phase === "move" && stone === state.currentPlayer) {
      cell.classList.add("current-player", state.currentPlayer === 1 ? "red" : "blue");
    }

    if (state.selectedIndex === index) {
      cell.classList.add("selected");
    }

    if (state.phase === "move" && state.selectedIndex !== null && state.selectedIndex !== index) {
      const isValid = isValidMove(state.selectedIndex, index);
      if (state.board[index] === null && isValid) {
        cell.classList.add("valid");
      }
    }

    if (state.pendingRemoval && stone === getOpponent(state.currentPlayer)) {
      cell.classList.add("pending-removal");
    }

    cell.addEventListener("click", () => handleCellClick(index));
    boardEl.appendChild(cell);
  });
}

function renderStatus() {
  if (typeof document === "undefined") return;

  const statusEl = document.getElementById("status");
  const p1CountEl = document.getElementById("p1-count");
  const p2CountEl = document.getElementById("p2-count");

  statusEl.classList.remove("winner", "pending-removal", "active", "red", "blue");

  if (state.winner) {
    statusEl.textContent = `Player ${state.winner} wins!`;
    statusEl.classList.add("winner", state.winner === 1 ? "red" : "blue");
  } else if (state.pendingRemoval) {
    statusEl.textContent = `Player ${state.currentPlayer}, remove one opponent piece.`;
    statusEl.classList.add("pending-removal");
  } else if (state.phase === "place") {
    statusEl.textContent = `Player ${state.currentPlayer} to place a stone.`;
    statusEl.classList.add("active", state.currentPlayer === 1 ? "red" : "blue");
  } else {
    const flyText = state.piecesOnBoard[state.currentPlayer] <= 3 ? " You can fly to any empty point." : "";
    statusEl.textContent = `Player ${state.currentPlayer} to move${flyText}`;
    statusEl.classList.add("active", state.currentPlayer === 1 ? "red" : "blue");
  }

  p1CountEl.textContent = `${9 - state.piecesOnBoard[1]}`;
  p2CountEl.textContent = `${9 - state.piecesOnBoard[2]}`;
}

function render() {
  renderBoard();
  renderStatus();

  // Safety: detect any mill that may have been formed but somehow didn't set
  // `pendingRemoval`. We compare the most recent history snapshot (which is
  // the state before the last action) to the current board to see if the
  // player who acted has any new mills. If so, mark pendingRemoval so the UI
  // prompts for removal.
  try {
    const hist = state.history;
    if (!state.pendingRemoval && hist && hist.length) {
      const prev = hist[hist.length - 1];
      const actor = prev.currentPlayer;
      const beforeBoard = prev.board;
      const afterBoard = state.board;
      const beforeMillIndices = mills
        .map((mill, idx) => ({ mill, idx }))
        .filter(({ mill }) => mill.every((i) => beforeBoard[i] === actor))
        .map(({ idx }) => idx);
      const afterMillIndices = mills
        .map((mill, idx) => ({ mill, idx }))
        .filter(({ mill }) => mill.every((i) => afterBoard[i] === actor))
        .map(({ idx }) => idx);
      const formed = afterMillIndices.some((idx) => !beforeMillIndices.includes(idx));
      if (formed) {
        state.pendingRemoval = true;
        state.currentPlayer = actor;
        state.selectedIndex = null;
        // re-render to show pending removal highlights
        renderBoard();
        renderStatus();
      }
    }
  } catch (e) {
    // non-fatal; leave state as-is
  }

  if (typeof document !== "undefined") {
    const undoBtn = document.getElementById("undoBtn");
    if (undoBtn) {
      undoBtn.disabled = state.history.length === 0;
    }
  }
}

if (typeof document !== "undefined") {
  const undoBtn = document.getElementById("undoBtn");
  const newGameBtn = document.getElementById("newGameBtn");
  undoBtn.addEventListener("click", undoPreviousStep);
  newGameBtn.addEventListener("click", resetGame);
  render();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createGameState,
    checkWinner,
    state,
    placeStone,
    moveStone,
    removeStone,
    resetGame,
  };
}
