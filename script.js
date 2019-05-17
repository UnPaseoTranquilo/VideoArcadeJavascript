
function animateAll(objectsArr, worldProcessor, mainFrame) {
    let t0 = null;
    let currT = 0;
    let dt;
    let obs = objectsArr;
    let frameWidth, frameHeight;

    window.requestAnimationFrame(innerAnimateAll);

    function innerAnimateAll(t) {
        frameHeight = mainFrame.clientHeight;
        frameWidth = mainFrame.clientWidth;
        if (t0 === null) t0 = t;
        dt = t - t0;
        currT += dt;
        obs = worldProcessor(obs, dt, currT, frameHeight, frameWidth, mainFrame);
        t0 = t;
        if (objectsArr.length > 0) window.requestAnimationFrame(innerAnimateAll);
    }
}


function worldProcessor(objectsArr, dt, currT, frameHeight, frameWidth, mainFrame) {
    function gradCalc(n) { return (0.7 * (n / (n + 500000))); }
    let obs = objectsArr;
    let newObs = [];
    let fighterWasAlive = fighterIsAlive;
    for (let ob of obs) ob.checkColision(obs);
    obs = obs.filter(ob => ob.alive);
    if (fighterWasAlive && !fighterIsAlive) momentOfFighterDeath = currT;
    for (let ob of obs) newObs.push(...ob.process(dt, currT, frameHeight, frameWidth));
    obs = obs.filter(ob => ob.alive);
    obs.push(...newObs);
    if (Math.random() > (1 - gradCalc(currT - momentOfFighterDeath))) obs.push(new Enemy(mainFrame, Math.random() * frameWidth * 0.8 + frameWidth * 0.1));
    if (!fighterIsAlive && currT >= momentOfFighterDeath + 3000) {
        let tmp = new Fighter(mainFrame);
        tmp.show(currT);
        obs.push(tmp);
        fighterIsAlive = true;
    }
    return obs;
}


class WorldElement {
    constructor(pos, v, bounded = false, deadIfOut = true) {
        this.alive = true;
        this.pos = pos;
        this.v = v;
        this.bounded = bounded;
        this.deadIfOut = deadIfOut;
    }

    static move(pos, vel, dt) {
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
    }

    isOutOfBoundaries(frameHeight, frameWidth) {
        let res = { out: false, deltaX: 0, deltaY: 0 };
        if (this.pos.x < 0) {
            res.out = true;
            res.deltaX = this.pos.x;
        }
        else if (this.pos.x > frameWidth) {
            res.out = true;
            res.deltaX = this.pos.x - frameWidth;
        }
        if (this.pos.y < 0) {
            res.out = true;
            res.deltaY = this.pos.y;
        }
        else if (this.pos.y > frameHeight) {
            res.out = true;
            res.deltaY = this.pos.y - frameHeight;
        }
        return res;
    }

    process(dt, currT, frameHeight, frameWidth) {
        WorldElement.move(this.pos, this.v, dt);
        let status = this.isOutOfBoundaries(frameHeight, frameWidth);
        if (status.out) {
            if (this.deadIfOut) this.alive = false;
            else {
                if (this.bounded) {
                    if (status.deltaX) {
                        this.pos.x -= status.deltaX;
                        // this.v.x *= -1;
                    }
                    if (status.deltaY) {
                        this.pos.y -= status.deltaY;
                        // this.v.y *= -1;
                    }
                }
            }
        }
        else this.draw();
        return [];
    }

    draw() {}

    checkColision() { return false; }

    static checkOverlap(myRect, otherRect) {
        function inBoundary(v, leftSide, rightSide) { return v >= leftSide && v <= rightSide; }
        if (inBoundary(myRect.top, otherRect.top, otherRect.bottom) || inBoundary(myRect.bottom, otherRect.top, otherRect.bottom)) {
            if (inBoundary(myRect.left, otherRect.left, otherRect.right) || inBoundary(myRect.right, otherRect.left, otherRect.right)) {
                return true;
            }
        }
        return false;
    }

}


class Fighter extends WorldElement {
    constructor(parentElem) {
        super({ x: parentElem.clientWidth / 2, y: parentElem.clientHeight * 0.85 }, { x: 0, y: 0 }, true, false);
        this.parentElem = parentElem;
        this.elem = document.createElement('div');
        this.elem.className = 'fighter';
        this.elem.style.visibility = 'hidden';
        this.elem = parentElem.appendChild(this.elem);
        this.lastLaunchTime = -1;
        this.mustLaunch = false;
        this.mustLaunchDeltaT = 80;
        this.obType = 'fighter';
        this.birthTime = 0;
        this.canDie = false;
    }

    show(birthTime) {
        let myself = this;
        this.elem.style.visibility = 'visible';
        this.elem.classList.add('new-fighter');
        this.canDie = false;
        this.birthTime = birthTime;
        this.draw();

        document.addEventListener('keydown', keyDownListener);
        document.addEventListener('keyup', keyUpListener);

        function keyUpListener(e) {
            switch (e.keyCode) {
            case 65:
            case 37:
                if (myself.v.x < 0) myself.v.x = 0;
                break;
            case 68:
            case 39:
                if (myself.v.x > 0) myself.v.x = 0;
                break;
            case 32:
                myself.mustLaunch = false;
                break;
            }
        }
        function keyDownListener(e) {
            switch (e.keyCode) {
            case 65: // 'A'
            case 37: // 'left'
                myself.v.x = -1;
                break;
            case 68: // 'D'
            case 39: // 'right
                myself.v.x = 1;
                break;
            case 32: // space
                myself.mustLaunch = true;
                break;
            }
            if (myself.pos.x < 0 || myself.pos.x > myself.parentElem.clientWidth) myself.v.x = 0;
        }
    }

    checkColision(obs) {
        if (!this.canDie) return false;
        let myRect = this.elem.getBoundingClientRect();
        for (let ob of obs) {
            if (ob.obType == 'bullet' || ob.obType == 'fighter') continue;
            if (ob.alive && WorldElement.checkOverlap(myRect, ob.elem.getBoundingClientRect())) {
                this.parentElem.removeChild(this.elem);
                this.alive = false;
                fighterIsAlive = false;
                fightersKilled++;
                FIGHTERS_DEATHS_COUNTER.innerHTML = fightersKilled * FIGHTER_PRICE;
                refreshRatio();
                return true;
            }
        }
        return false;
    }

    process(dt, currT, frameHeight, frameWidth) {
        this.currT = currT;
        if (currT - this.birthTime > GRACE_PERIOD) {
            this.elem.classList.remove('new-fighter');
            this.canDie = true;
        }
        super.process(dt, currT, frameHeight, frameWidth);
        if (this.mustLaunch && (currT - this.lastLaunchTime) >= this.mustLaunchDeltaT) {
            this.lastLaunchTime = currT;
            return [new Bullet(this.parentElem, { x: this.pos.x, y: this.pos.y })];
        }
        else return [];
    }

    draw() {
        this.elem.style.left = this.pos.x + 'px';
        this.elem.style.top = this.pos.y + 'px';
    }

}


class Bullet extends WorldElement {
    constructor(parentElem, pos) {
        super(pos, { x: 0, y: -1 }, false, true);
        this.parentElem = parentElem;
        this.elem = document.createElement('div');
        this.elem.className = 'bullet';
        this.elem = parentElem.appendChild(this.elem);
        this.obType = 'bullet';
    }

    draw() {
        this.elem.style.left = this.pos.x + 'px';
        this.elem.style.top = this.pos.y + 'px';
    }

    process(dt, currT, frameHeight, frameWidth) {
        super.process(dt, currT, frameHeight, frameWidth);
        if (!this.alive) {
            // console.log("dead!");
            this.parentElem.removeChild(this.elem);
        }
        return [];
    }

}


class Enemy extends WorldElement {
    constructor(parentElem, x) {
        super({ x: x, y: 0 }, { x: 0, y: Math.random() + 0.2 }, false, false);
        this.parentElem = parentElem;
        this.elem = document.createElement('div');
        this.elem.className = 'enemy';
        this.elem.style.visibility = 'hidden';
        this.firstTime = true;
        this.elem = parentElem.appendChild(this.elem);
        this.cycleTime = 200;
        this.k = Math.random() * this.cycleTime; // para dar variedad al movimiento
        this.obType = 'enemy';
    }

    draw() {
        if (this.firstTime) {
            this.firstTime = false;
            this.elem.style.visibility = 'visible';
        }
        this.elem.style.left = this.pos.x + 'px';
        this.elem.style.top = this.pos.y + 'px';
    }

    process(dt, currT, frameHeight, frameWidth) {
        this.v.x = Math.cos((currT / this.cycleTime) + this.k) * 1.5;
        if (this.v.x < 0 && this.pos.x <= 0) this.pos.x = frameWidth;
        else if (this.v.x > 0 && this.pos.x >= frameWidth) this.pos.x = 0;
        super.process(dt, currT, frameHeight, frameWidth);
        if (this.pos.y > frameHeight) {
            this.alive = false;
            this.parentElem.removeChild(this.elem);
        }
        return [];
    }

    checkColision(obs) {
        let myRect = this.elem.getBoundingClientRect();
        for (let ob of obs) {
            if (ob.alive && ob.obType == 'bullet' && WorldElement.checkOverlap(ob.elem.getBoundingClientRect(), myRect)) {
                this.alive = false;
                this.parentElem.removeChild(this.elem);
                enemiesKilled++;
                SCORE_COUNTER.innerHTML = enemiesKilled * ENEMY_PRICE;
                refreshRatio();
                return true;
            }
        }
        return false;
    }

}



const FRAME = document.getElementById('main');
const SCORE_COUNTER = document.getElementById('points');
const FIGHTERS_DEATHS_COUNTER = document.getElementById('lives');
const RATIO_COUNTER = document.getElementById('ratio');
const GRACE_PERIOD = 3000;
const FIGHTER_PRICE = 100;
const ENEMY_PRICE = 10;
const RATIO = ENEMY_PRICE / FIGHTER_PRICE * 100;

function refreshRatio() {
    if (!fightersKilled) {
        RATIO_COUNTER.innerHTML = 'YES!';
        return;
    }
    if (!enemiesKilled) {
        RATIO_COUNTER.innerHTML = 'ARE YOU KIDDING?';
        return;
    }
    RATIO_COUNTER.innerHTML = (enemiesKilled / fightersKilled * RATIO).toFixed(0) + '%';
}

let fighterIsAlive = true;
let momentOfFighterDeath = 0;

let worldObjects = [(new Fighter(FRAME))];
worldObjects[0].show(0);

let fightersKilled = 0;
let enemiesKilled = 0;


animateAll(worldObjects, worldProcessor, FRAME);
