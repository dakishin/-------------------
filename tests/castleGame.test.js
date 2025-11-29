const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert').strict;

function loadGameContext() {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) {
    throw new Error('Unable to locate <script> block in index.html');
  }

  const createTextStub = () => ({
    textContent: '',
    style: {},
    addEventListener() {},
    appendChild() {},
    remove() {}
  });

  const ctxStub = {
    clearRect() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    strokeRect() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {}
  };

  const canvasStub = {
    width: 640,
    height: 360,
    getContext: () => ctxStub
  };

  const domNodes = {
    game: canvasStub,
    score: createTextStub(),
    lives: createTextStub(),
    'game-over': createTextStub(),
    'start-btn': {
      textContent: '',
      addEventListener() {}
    }
  };

  const documentStub = {
    getElementById(id) {
      if (!domNodes[id]) {
        domNodes[id] = createTextStub();
      }
      return domNodes[id];
    },
    addEventListener() {}
  };

  const context = {
    console,
    document: documentStub,
    Math,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => Date.now() },
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: (id) => clearTimeout(id)
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(match[1], context, { filename: 'castle-arrows.js' });

  if (!context.__castleGameDebug) {
    throw new Error('Debug API (__castleGameDebug) was not exposed.');
  }

  return context.__castleGameDebug;
}

function testSpaceDoesNotWipeEnemies() {
  const api = loadGameContext();
  api.resetGame();
  api.setPlaying(true);
  api.clearArrows();
  api.addEnemy({ x: 50, y: 50, speed: 0 });
  api.addEnemy({ x: 580, y: 320, speed: 0 });
  const before = api.getState().enemies.length;

  api.shootArrow(true);
  api.handleCollisions();

  const after = api.getState().enemies.length;
  assert.equal(after, before, 'Pressing space without aiming should not remove enemies.');
}

function testArrowRemovesOnlySingleEnemy() {
  const api = loadGameContext();
  api.resetGame();
  api.setPlaying(true);
  api.clearArrows();
  const playerState = api.getState().player;
  api.addEnemy({ x: playerState.x + 8, y: playerState.y, speed: 0 });
  api.addEnemy({ x: playerState.x + 200, y: playerState.y, speed: 0 });

  api.shootArrow(true);
  api.handleCollisions();

  const enemiesLeft = api.getState().enemies.length;
  assert.equal(enemiesLeft, 1, 'Arrow should destroy only the enemy it hits.');
}

function run() {
  const tests = [
    ['no mass wipe on space', testSpaceDoesNotWipeEnemies],
    ['single enemy removed on hit', testArrowRemovesOnlySingleEnemy]
  ];

  tests.forEach(([name, fn]) => {
    try {
      fn();
      console.log(`✅ ${name}`);
    } catch (err) {
      console.error(`❌ ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  });

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

if (require.main === module) {
  run();
}

