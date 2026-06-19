const { createCanvas } = require('canvas');

const chars = 'ABCDEFGH#*%'.toLowerCase();

const waveCaptcha = () => {
	const w = 200;
	const h = 80;
	const canvas = createCanvas(w, h);
	const ctx = canvas.getContext('2d');

	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, w, h);

	
	let text = '';
	for (let i = 0; i < 6; i++) text += chars[Math.floor(Math.random() * chars.length)];

	ctx.font = '40px sans-serif';
	ctx.fillStyle = '#fff';
	ctx.fillText(text, 20, 55);

	const img = ctx.getImageData(0, 0, w, h);
	const data = img.data;

	const amp = 2 + Math.random() * 5;
    const freq = 0.08 + Math.random() * 0.1;

	const canvas2 = createCanvas(w, h);
	const ctx2 = canvas2.getContext('2d');
	const img2 = ctx2.createImageData(w, h);

	for (let y = 0; y < h; y++) {
		const shift = Math.sin(y * freq) * amp;
		for (let x = 0; x < w; x++) {
			const srcX = Math.round(x + shift);
			if (srcX >= 0 && srcX < w) {
				const p1 = (y * w + x) * 4;
				const p2 = (y * w + srcX) * 4;
				img2.data[p1] = data[p2];
				img2.data[p1 + 1] = data[p2 + 1];
				img2.data[p1 + 2] = data[p2 + 2];
				img2.data[p1 + 3] = data[p2 + 3];
			}
		}
	}

	ctx2.putImageData(img2, 0, 0);
	return { buffer: canvas2.toBuffer(), text };
}

module.exports = waveCaptcha