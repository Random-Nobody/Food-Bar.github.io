//////////////////////////- Settings -////////////////////////////
const background = 'rgba(0,0,0,0.3)';

const playerSize = 30;
const playerColor = 'white';
const playerHealthAsDmg = 0.2;
const playerProjectilePerDmgTaken = 1;

const projectileColor = 'white';
const projectileSpeed = 5;

const particleSize = 1;
const particleMaxSpeed = 8;
const particlePerSize = 2;
const particleAlphaDecay = 0.01;
const projectileDmgPerRadius = 2;

const difficultyInit = 1500;
const difficultyScaling = 0.97;
//////////////////////////////////////////////////////////////////
const scoreDisplay = document.getElementById('score');
const centerMenu = document.getElementById('center-menu');

const canvas = document.getElementById('play area');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

const context = canvas.getContext('2d');

class CircleThing {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
    };

    draw() {
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, true);
        context.fillStyle = this.color;
        context.fill();
    };

}

class MovingCircle extends CircleThing {
    constructor(x, y, radius, color, velocity, angle) {
        super(x, y, radius, color);
        this.originalRadius = radius;
        this.velocity = {
            x: velocity * Math.cos(angle),
            y: velocity * Math.sin(angle)
        };
    };
    update() {
        this.draw();
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    };
};

class Particle extends MovingCircle {
    constructor(x, y, radius, color, velocity, angle) {
        super(x, y, radius, color, velocity, angle);
        this.alpha = 1;
    };
    update() {
        context.globalAlpha = this.alpha;
        super.update();
        this.alpha -= particleAlphaDecay;
    };
};

let player = new CircleThing(canvas.width / 2, canvas.height / 2, playerSize, playerColor);
let projectiles = [];
let enemies;
let particles;
let score;
function init() {
    player = new CircleThing(canvas.width / 2, canvas.height / 2, playerSize, playerColor);
    projectiles = [];
    enemies = [];
    particles = [];
    score = 0;
    scoreDisplay.innerHTML = score;
    delay = difficultyInit;
}

let pauseSpawn = false;
function spawnEnemies() {
    if (pauseSpawn) return;
    const radius = 10 + Math.random() * 20;
    const color = `hsl(${Math.random() * 360}, 50%, 50%)`;
    const velocity = 2;

    let x;
    let y;
    if (Math.random() > 0.5) {
        x = Math.random() > 0.5 ? 0 : canvas.width;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() > 0.5 ? 0 : canvas.height;
    }
    const angle = Math.atan2(player.y - y, player.x - x);

    enemies.push(new MovingCircle(x, y, radius, color, velocity, angle));
    delay *= difficultyScaling;

    setTimeout(spawnEnemies, delay);
}

canvas.addEventListener('click', (event) => {
    const angle = Math.atan2(event.clientY - player.y, event.clientX - player.x);
    projectiles.push(new MovingCircle(player.x, player.y, player.radius * playerHealthAsDmg, projectileColor, projectileSpeed, angle));
});

let animateId;
function animate() {
    animateId = requestAnimationFrame(animate);
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    player.draw();

    projectiles.forEach((projectile, i) => {
        projectile.update();
        if (projectile.x < 0 || projectile.x > canvas.width ||
            projectile.y < 0 || projectile.y > canvas.height) {
            setTimeout(() => { projectiles.splice(i, 1) }); //if offscreen, remove
        }
    });

    particles.forEach((particle, i) => {
        context.save();
        particle.update();
        context.restore();
        if (particle.alpha < 0)
            particles.splice(i, 1);
    })

    enemyLoop();

}

function enemyLoop() {
    enemies.forEach((enemy, i) => {
        enemy.update();

        //particle collision
        particles.forEach((particle, j) => {
            const distance = Math.hypot(particle.x - enemy.x, particle.y - enemy.y);
            if (distance < enemy.radius + particle.radius) {
                setTimeout(() => {
                    particles.splice(j, 1);
                    enemy.radius -= projectileDmgPerRadius * particle.radius;
                    if (enemy.radius < 5) enemy.radius = 5;//particle doesn't kill
                });
            }
        });

        //projectile collision
        projectiles.forEach((projectile, j) => {
            const distance = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            if (distance < enemy.radius + projectile.radius) {
                projectiles.splice(j, 1);
                if (enemy.radius > 5 + projectileDmgPerRadius * projectile.radius) { //if large, shrink & remove projectile
                    gsap.to(enemy, { radius: enemy.radius - 2 * projectile.radius, duration: 0.25 });
                    for (let i = 0; i < projectile.radius * particlePerSize; i++) {//explode
                        particles.push(new Particle(projectile.x, projectile.y, particleSize, enemy.color,
                            Math.random() * particleMaxSpeed, Math.random() * 2 * Math.PI));
                    }
                    score += 50;
                } else { //if small, die
                    enemy.radius = 0;
                    for (let i = 0; i < enemy.originalRadius * particlePerSize; i++) {//explode
                        particles.push(new Particle(projectile.x, projectile.y, particleSize, enemy.color,
                            Math.random() * particleMaxSpeed, Math.random() * 2 * Math.PI));
                    }
                    player.radius += 1;
                    score += 100;
                }
                scoreDisplay.innerHTML = score;
            }
        });

        //player collision
        const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distance < player.radius + enemy.radius) {
            //deal dmg equal to remaining radius. if no more radius, game over
            if (player.radius < enemy.radius) {
                pauseSpawn = true;
                document.getElementById('final-score').innerHTML = score;
                centerMenu.style.display = '';
                cancelAnimationFrame(animateId);
            } else {
                player.radius -= enemy.radius;
                for (let i = 0; i < playerProjectilePerDmgTaken * enemy.radius; i++) {
                    projectiles.push(new MovingCircle(player.x, player.y, player.radius * playerHealthAsDmg, player.color, projectileSpeed, Math.random() * 2 * Math.PI));
                }
                enemy.radius = 0;
            }
        }
        if (enemy.radius < 1) setTimeout(() => { enemies.splice(i, 1); });
    });
}

function resetGame() {
    //game start | restart
    centerMenu.style.display = 'none';
    init();
    pauseSpawn = false;
    spawnEnemies();
    animate();
}