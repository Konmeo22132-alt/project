const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const blurCanvas = document.getElementById('blurCanvas');
const statusEl = document.getElementById('status');
const fpsEl = document.getElementById('fps');
const toggleBlurBtn = document.getElementById('toggleBlur');
const toggleDetectBtn = document.getElementById('toggleDetect');

let detectionInterval = null;
let detectEnabled = true;
let blurEnabled = false;

const detectionOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });

function setStatus(txt) {
  statusEl.textContent = txt;
}

async function loadModels() {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models/ssd_mobilenetv1');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68');
    await faceapi.nets.ageGenderNet.loadFromUri('/models/age_gender_model');
    setStatus(' Models loaded');
  } catch (e) {
    console.error(' bug:', e);
    setStatus('bug gi do');
  }
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    setStatus(' user da bat camera');
  } catch (e) {
    console.error(' k bat dc camera', e);
    setStatus(' Không thể bật camera');
  }
}

function resizeCanvases() {
  const w = video.videoWidth;
  const h = video.videoHeight;
  [overlay, blurCanvas].forEach(c => {
    c.width = w;
    c.height = h;
    c.style.width = '100%';
    c.style.height = '100%';
  });
}

function drawBlurredFaces(detections) {
  const bctx = blurCanvas.getContext('2d');
  bctx.clearRect(0, 0, blurCanvas.width, blurCanvas.height);
  if (!blurEnabled) return;
  const w = blurCanvas.width;
  const h = blurCanvas.height;
  bctx.save();
  bctx.scale(-1, 1);
  bctx.drawImage(video, -w, 0, w, h);
  bctx.restore();
  for (const det of detections) {
    const box = det.detection.box;
    const x = box.x;
    const y = box.y;
    const fw = box.width;
    const fh = box.height;
    const mirroredX = w - (x + fw);
    const faceRegion = bctx.getImageData(mirroredX, y, fw, fh);
    const tmp = document.createElement('canvas');
    tmp.width = fw;
    tmp.height = fh;
    const tctx = tmp.getContext('2d');
    tctx.putImageData(faceRegion, 0, 0);
    bctx.save();
    bctx.filter = 'blur(10px)';
    bctx.drawImage(tmp, mirroredX, y, fw, fh);
    bctx.restore();
  }
}

function drawDetections(detections) {
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;
  ctx.font = '14px Arial';
  ctx.fillStyle = 'lime';
  for (const det of detections) {
    const box = det.detection.box;
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.stroke();
    const age = Math.round(det.age);
    const gender = det.gender;
    const gp = (det.genderProbability * 100).toFixed(1);
    const coords = `(${Math.round(box.x)}, ${Math.round(box.y)})`;
    const label = `Age: ${age} | Gender: ${gender} (${gp}%) | Coord: ${coords}`;
    const textW = ctx.measureText(label).width;
    const tx = box.x;
    const ty = Math.max(14, box.y - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(tx - 2, ty - 14, textW + 6, 18);
    ctx.fillStyle = 'lime';
    ctx.fillText(label, tx, ty);
  }
}

async function runDetectionLoop() {
  if (!detectEnabled) return;
  let frames = 0;
  let lastTime = performance.now();
  detectionInterval = setInterval(async () => {
    if (video.readyState < 2) return;
    if (overlay.width !== video.videoWidth) resizeCanvases();
    const detections = await faceapi
      .detectAllFaces(video, detectionOptions)
      .withFaceLandmarks()
      .withAgeAndGender();
    frames++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      fpsEl.textContent = `FPS: ${frames}`;
      frames = 0;
      lastTime = now;
    }
    drawBlurredFaces(detections);
    drawDetections(detections);
  }, 150);
}

toggleBlurBtn.addEventListener('click', () => {
  blurEnabled = !blurEnabled;
  toggleBlurBtn.textContent = `Làm mờ người: ${blurEnabled ? 'ON' : 'OFF'}`;
  if (!blurEnabled) blurCanvas.getContext('2d').clearRect(0, 0, blurCanvas.width, blurCanvas.height);
});

toggleDetectBtn.addEventListener('click', () => {
  detectEnabled = !detectEnabled;
  toggleDetectBtn.textContent = detectEnabled ? 'Dừng nhận diện' : 'Bật nhận diện';
  if (detectEnabled) {
    runDetectionLoop();
    setStatus('dang nhan dien...');
  } else {
    clearInterval(detectionInterval);
    overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
    blurCanvas.getContext('2d').clearRect(0, 0, blurCanvas.width, blurCanvas.height);
    setStatus('dung nhan dien');
  }
});

(async function init() {
  await loadModels();
  await startCamera();
  resizeCanvases();
  runDetectionLoop();
})();
