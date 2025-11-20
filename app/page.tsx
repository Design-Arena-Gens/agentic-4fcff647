"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const LANES = [-2.5, 0, 2.5];
const OBSTACLE_POOL = 12;
const SPAWN_INTERVAL = 1100;
const BASE_SPEED = 9;
const SPEED_INCREMENT = 0.0025;

export default function HomePage() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<number>();
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050a15, 10, 80);
    scene.background = new THREE.Color(0x040914);

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 5, 12);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x3de1ff, 0.7);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 15);
    scene.add(dirLight);

    const roadGeometry = new THREE.PlaneGeometry(12, 200, 1, 20);
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b1f30,
      side: THREE.DoubleSide,
      metalness: 0.3,
      roughness: 0.8
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.z = -80;
    scene.add(road);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x1e8fff, linewidth: 2 });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-6, 0.01, 0),
      new THREE.Vector3(-6, 0.01, -160)
    ]);
    const borderLeft = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(borderLeft);

    const borderRight = borderLeft.clone();
    borderRight.position.x = 6;
    scene.add(borderRight);

    const gridHelper = new THREE.GridHelper(12, 8, 0x1e8fff, 0x0e2c49);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -80;
    scene.add(gridHelper);

    const playerGeometry = new THREE.ConeGeometry(0.6, 2, 24);
    const playerMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5f9e,
      emissive: 0x1d0416,
      emissiveIntensity: 0.8
    });
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.rotation.x = Math.PI;
    player.position.set(0, 1, 5);
    scene.add(player);

    const exhaustGeometry = new THREE.ConeGeometry(0.4, 1.4, 12);
    const exhaustMaterial = new THREE.MeshBasicMaterial({ color: 0x3de1ff });
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust.position.set(0, -1.2, 0.2);
    player.add(exhaust);

    const obstacles: THREE.Mesh[] = [];
    const obstacleGeometry = new THREE.DodecahedronGeometry(0.8);
    const obstacleMaterial = new THREE.MeshStandardMaterial({
      color: 0x3de1ff,
      metalness: 0.4,
      roughness: 0.3
    });

    for (let i = 0; i < OBSTACLE_POOL; i += 1) {
      const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial.clone());
      obstacle.visible = false;
      obstacle.position.set(0, 0.8, -80);
      (obstacle.material as THREE.MeshStandardMaterial).color.offsetHSL(Math.random() * 0.2, 0.1, Math.random() * 0.1);
      scene.add(obstacle);
      obstacles.push(obstacle);
    }

    let moveDirection = 0;
    let targetLaneIndex = 1;
    let spawnTimer = 0;
    let lastTime = performance.now();
    let currentSpeed = BASE_SPEED;
    let localScore = 0;
    let isGameOver = false;
    const obstacleQueue: THREE.Mesh[] = [...obstacles];

    const collider = new THREE.Box3();
    const obstacleCollider = new THREE.Box3();

    const resetGame = () => {
      localScore = 0;
      currentSpeed = BASE_SPEED;
      spawnTimer = 0;
      isGameOver = false;
      moveDirection = 0;
      targetLaneIndex = 1;
      player.position.x = LANES[targetLaneIndex];
      obstacles.forEach((obstacle) => {
        obstacle.visible = false;
        obstacle.position.z = -80;
      });
      setGameOver(false);
      setScore(0);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        targetLaneIndex = Math.max(0, targetLaneIndex - 1);
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        targetLaneIndex = Math.min(LANES.length - 1, targetLaneIndex + 1);
      } else if (event.code === "Space" && isGameOver) {
        resetGame();
      }
    };

    const handleTouch = (event: TouchEvent) => {
      if (isGameOver) {
        resetGame();
        return;
      }
      const touchX = event.changedTouches[0].clientX;
      if (touchX < window.innerWidth / 2) {
        targetLaneIndex = Math.max(0, targetLaneIndex - 1);
      } else {
        targetLaneIndex = Math.min(LANES.length - 1, targetLaneIndex + 1);
      }
    };

    const handleResize = () => {
      const { clientWidth, clientHeight } = mount;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
    };

    const activateObstacle = () => {
      if (obstacleQueue.length === 0) return;
      const obstacle = obstacleQueue.shift()!;
      obstacle.visible = true;
      obstacle.position.set(LANES[Math.floor(Math.random() * LANES.length)], 0.8, -120);
      obstacle.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      obstacle.userData.speed = currentSpeed + Math.random() * 2;
    };

    const animate = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      if (!isGameOver) {
        spawnTimer += delta;
        if (spawnTimer > SPAWN_INTERVAL) {
          spawnTimer = 0;
          activateObstacle();
        }

        currentSpeed += SPEED_INCREMENT * delta;

        const targetX = LANES[targetLaneIndex];
        const direction = targetX - player.position.x;
        moveDirection = direction === 0 ? 0 : Math.sign(direction);
        player.position.x += moveDirection * Math.min(Math.abs(direction), 0.05 * (currentSpeed / BASE_SPEED) * (delta / 16.6));
        player.rotation.z = -moveDirection * 0.25;

        exhaust.scale.y = 1 + Math.sin(now * 0.015) * 0.3;

        obstacles.forEach((obstacle) => {
          if (!obstacle.visible) return;
          obstacle.position.z += (currentSpeed * (delta / 1000)) * 12;
          obstacle.rotation.x += 0.01 * (delta / 16.6);
          obstacle.rotation.y += 0.02 * (delta / 16.6);

          if (obstacle.position.z > 10) {
            obstacle.visible = false;
            obstacle.position.z = -120;
            obstacleQueue.push(obstacle);
          }
        });

        collider.setFromObject(player);
        obstacles.forEach((obstacle) => {
          if (!obstacle.visible) return;
          obstacleCollider.setFromObject(obstacle);
          if (collider.intersectsBox(obstacleCollider)) {
            isGameOver = true;
            setGameOver(true);
            setBestScore((prev) => Math.max(prev, localScore));
          }
        });

        localScore += delta * 0.05;
        setScore(Math.floor(localScore));
      }

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    const startGame = () => {
      if (isGameOver) resetGame();
      lastTime = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    };

    resetGame();
    startGame();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("touchstart", handleTouch);
    window.addEventListener("resize", handleResize);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchstart", handleTouch);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          const material = mesh.material;
          if (Array.isArray(material)) {
            material.forEach((mat) => mat.dispose());
          } else if (material) {
            material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, []);

  return (
    <main className="canvas-wrapper">
      <div className="ui-layer">
        <div className="panel">
          <h1>دوندهٔ نئونی</h1>
          <p>
            با کلیدهای جهت چپ و راست یا لمس صفحه حرکت کنید. از برخورد با موانع اجتناب کنید و بالاترین امتیاز را ثبت کنید.
          </p>
          {gameOver ? <p>برای شروع دوباره Space را بزنید یا صفحه را لمس کنید.</p> : null}
        </div>
        <div className="panel" style={{ textAlign: "right" }}>
          <p className="score">{score}</p>
          <p>رکورد: {bestScore}</p>
        </div>
      </div>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </main>
  );
}
