// Flower petals animation
const petalContainer = document.querySelector(".petals-container");

const petalImages = [
    './petal1.png',
     './petal2.png', './petal3.png', './petal4.png', './petal5.png', './petal6.png'
];

function createPetal() {
    const petal = document.createElement('div');
    petal.className = 'petal';

    const size = Math.random() * 20 + 15;
    petal.style.setProperty('--size', `${size}px`);
    petal.style.setProperty('--img', `url(${petalImages[Math.floor(Math.random() * petalImages.length)]})`);
    petal.style.setProperty('--duration', `${Math.random() * 10 + 8}s`);
    petal.style.setProperty('--opacity', Math.random() * 0.5 + 0.5);

    // ✅ START FROM TOP
    petal.style.left = Math.random() * 100 + 'vw';
    petal.style.top = '-50px';

    petalContainer.appendChild(petal);

    setTimeout(() => petal.remove(), 15000);
}

setInterval(createPetal, 300);


// Music play
function playMusic() {
    const music = document.getElementById("bgMusic");
    music.play();
    document.querySelector(".music-btn").style.display = "none";
}

// RSVP
function showRSVP() {
    alert("Please RSVP by calling: +91 98765 43210");
}

