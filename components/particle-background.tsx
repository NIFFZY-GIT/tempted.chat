"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function ParticleBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    const isMobileViewport = window.innerWidth < 768;
    const lowCoreDevice = (navigator.hardwareConcurrency || 8) <= 4;
    const isLowPowerDevice = prefersReducedMotion || isMobileViewport || lowCoreDevice;
    const particleCount = isLowPowerDevice ? 240 : 760;
    const maxLines = isLowPowerDevice ? 40 : 140;
    const lineSampleCount = isLowPowerDevice ? 56 : 120;
    const lineUpdateInterval = isLowPowerDevice ? 4 : 2;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowPowerDevice ? 1 : 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ── Particles ──
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);

    const palette = [
      new THREE.Color(0xec4899), // pink
      new THREE.Color(0xa78bfa), // violet
      new THREE.Color(0x3b82f6), // blue
      new THREE.Color(0x34d399), // emerald
      new THREE.Color(0xfbbf24), // amber
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = Math.random() * 2.5 + 0.4;
      speeds[i] = Math.random() * 0.3 + 0.1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const vertexShader = [
      "attribute float size;",
      "attribute vec3 color;",
      "varying vec3 vColor;",
      "varying float vAlpha;",
      "uniform float uTime;",
      "uniform float uPixelRatio;",
      "",
      "void main() {",
      "  vColor = color;",
      "  vec3 pos = position;",
      "  pos.y += sin(uTime * 0.3 + position.x * 2.0) * 0.15;",
      "  pos.x += cos(uTime * 0.2 + position.y * 1.5) * 0.1;",
      "",
      "  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);",
      "  float dist = -mvPosition.z;",
      "  vAlpha = smoothstep(8.0, 2.0, dist) * 0.6;",
      "",
      "  gl_PointSize = size * uPixelRatio * (3.0 / dist);",
      "  gl_Position = projectionMatrix * mvPosition;",
      "}",
    ].join("\n");

    const fragmentShader = [
      "varying vec3 vColor;",
      "varying float vAlpha;",
      "",
      "void main() {",
      "  float d = length(gl_PointCoord - vec2(0.5));",
      "  if (d > 0.5) discard;",
      "  float alpha = smoothstep(0.5, 0.1, d) * vAlpha;",
      "  gl_FragColor = vec4(vColor, alpha);",
      "}",
    ].join("\n");

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // ── Connection lines between nearby particles ──
    const linePositions = new Float32Array(maxLines * 6);
    const lineColors = new Float32Array(maxLines * 6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3)
    );
    lineGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(lineColors, 3)
    );
    lineGeometry.setDrawRange(0, 0);

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    // ── Mouse interaction ──
    const mouse = { x: 0, y: 0 };
    const supportsFinePointer =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(pointer: fine)").matches
        : true;
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    if (supportsFinePointer) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    // ── Resize ──
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      material.uniforms.uPixelRatio.value = Math.min(
        window.devicePixelRatio,
        2
      );
    };
    window.addEventListener("resize", handleResize);

    // ── Animate ──
    let animationId: number;
    let frameCount = 0;
    const startTime = performance.now();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) / 1000;
      material.uniforms.uTime.value = elapsed;
      frameCount += 1;

      // Slow rotation following mouse
      particles.rotation.y += (mouse.x * 0.1 - particles.rotation.y) * 0.02;
      particles.rotation.x += (mouse.y * 0.05 - particles.rotation.x) * 0.02;

      // Move particles slowly upward and loop
      const posArray = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArray[i * 3 + 1] += speeds[i] * 0.003;
        if (posArray[i * 3 + 1] > 5) posArray[i * 3 + 1] = -5;
      }
      geometry.attributes.position.needsUpdate = true;

      // Update connection lines less frequently to reduce CPU cost.
      if (frameCount % lineUpdateInterval === 0) {
        let lineIdx = 0;
        const CONNECTION_DIST = 1.2;
        for (
          let i = 0;
          i < Math.min(particleCount, lineSampleCount) && lineIdx < maxLines;
          i++
        ) {
          for (
            let j = i + 1;
            j < Math.min(particleCount, lineSampleCount) && lineIdx < maxLines;
            j++
          ) {
            const dx = posArray[i * 3] - posArray[j * 3];
            const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1];
            const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < CONNECTION_DIST) {
              const lp = lineGeometry.attributes.position.array as Float32Array;
              const lc = lineGeometry.attributes.color.array as Float32Array;
              const base = lineIdx * 6;
              lp[base] = posArray[i * 3];
              lp[base + 1] = posArray[i * 3 + 1];
              lp[base + 2] = posArray[i * 3 + 2];
              lp[base + 3] = posArray[j * 3];
              lp[base + 4] = posArray[j * 3 + 1];
              lp[base + 5] = posArray[j * 3 + 2];
              const alpha = 1 - dist / CONNECTION_DIST;
              lc[base] = colors[i * 3] * alpha;
              lc[base + 1] = colors[i * 3 + 1] * alpha;
              lc[base + 2] = colors[i * 3 + 2] * alpha;
              lc[base + 3] = colors[j * 3] * alpha;
              lc[base + 4] = colors[j * 3 + 1] * alpha;
              lc[base + 5] = colors[j * 3 + 2] * alpha;
              lineIdx++;
            }
          }
        }
        lineGeometry.setDrawRange(0, lineIdx * 2);
        lineGeometry.attributes.position.needsUpdate = true;
        lineGeometry.attributes.color.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      if (supportsFinePointer) {
        window.removeEventListener("mousemove", handleMouseMove);
      }
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
      style={{ background: "transparent" }}
    />
  );
}
