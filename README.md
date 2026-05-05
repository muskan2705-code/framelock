# FRAMELOCK — Gesture Puzzle Battle

A premium, two-player webcam puzzle battle game built with **Vite**, **TypeScript**, and **MediaPipe Hands**.

## 🎮 How to Play

1. **Enter the Arena**: Click the "Enter the Arena" button to start your camera.
2. **Form your Frame**: Use your thumb and index fingertips of both hands to form a square frame around your face.
3. **Capture**: Hold the frame still for 1.5 seconds. The game will capture a "perfect" square image of your face.
4. **Solve the Puzzle**: 
   - **Pinch** (thumb + index together) to grab a tile.
   - **Drag** it to the correct spot.
   - **Release** to drop and swap.
5. **Win**: Be the first to solve your 3x3 puzzle!

## 🚀 Technical Highlights

- **Hand Tracking**: Real-time fingertip detection using MediaPipe.
- **Dynamic Overlay**: Puzzles are rendered directly on the camera canvas using HTML5 Canvas API.
- **Custom Gestures**: Custom logic for pinch detection and stability-based capturing.
- **Modern UI**: Dark-themed, high-performance interface with Orbitron typography and neon accents.

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🌐 Deployment

This project is configured for easy deployment to **GitHub Pages**. Simply run `npm run build` and push the `dist` folder to your `gh-pages` branch.

---
Built with ❤️ by Antigravity
