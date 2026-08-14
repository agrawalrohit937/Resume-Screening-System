/**
 * detectionWorker.js — Off-main-thread ML Proctoring Worker
 *
 * Loads lightweight face-api.js models (tinyFaceDetector + faceLandmark68 + faceExpression)
 * inside a Web Worker. Performs frame-by-frame inference off the main UI thread.
 */

const FACEAPI_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js'
const MODEL_URL   = 'https://cdn.jsdelivr.net/gh/vladmandic/face-api/model'

let isInitialized = false
let isInitializing = false
let lookDownStart = null
let lookDownResetTimer = null
let lookAwayStart = null
let lastEmittedEvents = {}

// Dynamic script loader for Web Worker
function loadWorkerScripts() {
  if (typeof self.faceapi !== 'undefined') return
  importScripts(FACEAPI_CDN)
}

async function initModels() {
  if (isInitialized) return true
  if (isInitializing) return false
  isInitializing = true

  try {
    postMessage({ type: 'STATUS', status: 'loading_scripts' })
    loadWorkerScripts()

    if (!self.faceapi) {
      throw new Error('faceapi script failed to load inside worker')
    }

    postMessage({ type: 'STATUS', status: 'loading_models' })
    const fa = self.faceapi

    // Load strictly lightweight models from CDN (No 18MB mobilenet!)
    await Promise.all([
      fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      fa.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ])

    isInitialized = true
    isInitializing = false
    postMessage({ type: 'STATUS', status: 'ready' })
    return true
  } catch (err) {
    isInitializing = false
    postMessage({ type: 'ERROR', error: err.message || 'Worker model initialization failed' })
    return false
  }
}

// ── Landmark geometry helpers ────────────────────────────────────────────────
function computeEyeGazeAndPose(landmarks) {
  try {
    const pts = landmarks.positions
    if (!pts || pts.length < 68) return { gazeDir: 'center', gazeOffsetY: 0, pitch: 0, yaw: 0, eyeOpenness: 1.0 }

    // Left eye corners: 36 (outer), 39 (inner). Top: 37, 38. Bottom: 40, 41
    const lCornerL = pts[36], lCornerR = pts[39]
    const lTop = (pts[37].y + pts[38].y) / 2
    const lBot = (pts[40].y + pts[41].y) / 2
    const lHeight = Math.abs(lBot - lTop)
    const lWidth = Math.abs(lCornerR.x - lCornerL.x) || 1

    // Right eye corners: 42 (inner), 45 (outer). Top: 43, 44. Bottom: 46, 47
    const rCornerL = pts[42], rCornerR = pts[45]
    const rTop = (pts[43].y + pts[44].y) / 2
    const rBot = (pts[46].y + pts[47].y) / 2
    const rHeight = Math.abs(rBot - rTop)
    const rWidth = Math.abs(rCornerR.x - rCornerL.x) || 1

    const avgEyeHeight = (lHeight + rHeight) / 2
    const avgEyeWidth = (lWidth + rWidth) / 2
    const eyeOpenness = Math.min(1, Math.max(0, (avgEyeHeight / avgEyeWidth) * 2.5))

    // Eye corner Y baseline vs Eyelid center Y
    const eyeCornersY = (lCornerL.y + lCornerR.y + rCornerL.y + rCornerR.y) / 4
    const eyeLidsY = (lTop + lBot + rTop + rBot) / 4
    const eyeGazeDrop = (eyeLidsY - eyeCornersY) / (avgEyeHeight || 1)

    // Head Pose (Yaw / Pitch)
    const noseTip = pts[30]
    const noseBridge = pts[27]
    const chin = pts[8]
    const leftCheek = pts[0]
    const rightCheek = pts[16]

    const faceWidth = Math.abs(rightCheek.x - leftCheek.x) || 1
    const faceMidX = (leftCheek.x + rightCheek.x) / 2
    const yaw = ((noseTip.x - faceMidX) / (faceWidth * 0.5)) * 45

    const faceHeight = Math.abs(chin.y - noseBridge.y) || 1
    const faceMidY = (chin.y + noseBridge.y) / 2
    const pitch = (((noseTip.y - faceMidY) / (faceHeight * 0.5)) - 0.05) * 40

    let gazeDir = 'center'
    const gazeOffsetY = eyeGazeDrop * 1.5
    if (gazeOffsetY > 0.18 || pitch > 12) {
      gazeDir = 'down'
    } else if (gazeOffsetY < -0.25 || pitch < -18) {
      gazeDir = 'up'
    } else if (Math.abs(yaw) > 25) {
      gazeDir = yaw > 0 ? 'right' : 'left'
    }

    return { gazeDir, gazeOffsetY, pitch, yaw, eyeOpenness }
  } catch (e) {
    return { gazeDir: 'center', gazeOffsetY: 0, pitch: 0, yaw: 0, eyeOpenness: 1.0 }
  }
}

// ── Process video frame bitmap transferred from main thread ──────────────────
async function processFrame(imageBitmap) {
  if (!isInitialized) return

  try {
    const fa = self.faceapi
    const detections = await fa
      .detectAllFaces(imageBitmap, new fa.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.45 }))
      .withFaceLandmarks(true)
      .withFaceExpressions()

    const faceCount = detections.length
    const now = Date.now()
    const events = []

    if (faceCount === 0) {
      // Face missing
      if (shouldEmit('face_missing', 3000)) {
        events.push({ event_type: 'face_missing', severity: 'medium', details: 'No face detected in camera frame' })
      }
      trackLookingDown(false, now, events)
      trackLookAway(true, now, events)

      postMessage({
        type: 'DETECTION_RESULT',
        result: {
          faceCount: 0,
          gazeDir: 'unknown',
          pitch: 0, yaw: 0,
          eyeOpenness: 0,
          emotion: null,
          confidence: 0,
          lookDownMs: 0,
          lookAwayMs: 0,
          events,
        }
      })
      return
    }

    if (faceCount > 1) {
      if (shouldEmit('multiple_faces', 3000)) {
        events.push({ event_type: 'multiple_faces', severity: 'high', details: `${faceCount} faces detected in camera frame` })
      }
    }

    // Analyze primary face
    const primary = detections[0]
    const { gazeDir, gazeOffsetY, pitch, yaw, eyeOpenness } = computeEyeGazeAndPose(primary.landmarks)

    // Expressions
    let dominantEmotion = null
    if (primary.expressions) {
      const sorted = Object.entries(primary.expressions).sort((a, b) => b[1] - a[1])
      if (sorted.length > 0) dominantEmotion = sorted[0][0]
    }

    // Continuous 3-second Looking Down detection
    const isDown = gazeDir === 'down' || gazeOffsetY > 0.18 || pitch > 12
    const lookDownMs = trackLookingDown(isDown, now, events)

    // Looking Away detection
    const isAway = gazeDir !== 'center' || Math.abs(yaw) > 28 || Math.abs(pitch) > 28
    const lookAwayMs = trackLookAway(isAway, now, events)

    // Eyes closed
    if (eyeOpenness < 0.15 && shouldEmit('eyes_closed', 5000)) {
      events.push({ event_type: 'eyes_closed', severity: 'low', details: 'Eyes appear closed or obstructed' })
    }

    postMessage({
      type: 'DETECTION_RESULT',
      result: {
        faceCount,
        gazeDir,
        gazeOffsetY,
        pitch, yaw,
        eyeOpenness,
        emotion: dominantEmotion,
        confidence: faceCount === 1 ? 0.95 : 0.60,
        lookDownMs,
        lookAwayMs,
        events,
      }
    })
  } catch (err) {
    postMessage({ type: 'ERROR', error: err.message })
  } finally {
    // Close transferred ImageBitmap to free memory immediately
    if (imageBitmap && typeof imageBitmap.close === 'function') {
      imageBitmap.close()
    }
  }
}

// ── Continuous looking down tracker (3.0s threshold) ────────────────────────
function trackLookingDown(isDown, now, events) {
  if (isDown) {
    if (lookDownResetTimer) {
      clearTimeout(lookDownResetTimer)
      lookDownResetTimer = null
    }
    if (!lookDownStart) lookDownStart = now
    const ms = now - lookDownStart
    if (ms >= 3000) {
      if (shouldEmit('looking_down', 3000)) {
        events.push({
          event_type: 'looking_down',
          severity: 'high',
          details: `Sustained look down below screen detected (${(ms / 1000).toFixed(1)}s)`
        })
      }
      lookDownStart = now // reset for next 3s window
    }
    return ms
  } else {
    if (lookDownStart && !lookDownResetTimer) {
      lookDownResetTimer = setTimeout(() => {
        lookDownStart = null
        lookDownResetTimer = null
      }, 800) // 800ms grace period for landmark jitter
    }
    return 0
  }
}

// ── Continuous look away tracker ─────────────────────────────────────────────
function trackLookAway(isAway, now, events) {
  if (isAway) {
    if (!lookAwayStart) lookAwayStart = now
    const ms = now - lookAwayStart
    if (ms >= 3500) {
      if (shouldEmit('looking_away', 4000)) {
        events.push({
          event_type: 'looking_away',
          severity: 'medium',
          details: `Looking away from screen for ${(ms / 1000).toFixed(1)}s`
        })
      }
      lookAwayStart = now
    }
    return ms
  } else {
    lookAwayStart = null
    return 0
  }
}

// Event throttle check helper
function shouldEmit(eventType, throttleMs) {
  const now = Date.now()
  if (lastEmittedEvents[eventType] && now - lastEmittedEvents[eventType] < throttleMs) {
    return false
  }
  lastEmittedEvents[eventType] = now
  return true
}

// ── Message Listener ─────────────────────────────────────────────────────────
self.onmessage = async (e) => {
  const { type, imageBitmap } = e.data || {}

  if (type === 'INIT') {
    await initModels()
  } else if (type === 'PROCESS_FRAME') {
    if (imageBitmap) {
      await processFrame(imageBitmap)
    }
  }
}
