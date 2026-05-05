import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { RoomPlayerPositionPayload } from '../../services/virtual-meeting-chat.service';

/**
 * Salon 3D (Three.js) — même télémétrie que l’exemple classique web :
 * filet au sol, avatars = boîtes colorées, positions x/z en % (0–100) ↔ monde −10..10.
 * Les positions sont synchronisées par le parent via STOMP (VEM), pas ici.
 */
@Component({
  selector: 'app-virtual-room-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      #host
      class="virtual-room-3d-host w-full rounded-xl border border-indigo-200/50 dark:border-indigo-500/30 overflow-hidden
             focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-slate-900/40"
      [style.minHeight.px]="minHeight"
      tabindex="0"
      (pointerdown)="onHostPointer($event)">
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
      Clic sur le sol pour se téléporter, ou
      <kbd class="px-0.5 rounded bg-gray-200 dark:bg-gray-700">W</kbd><kbd class="px-0.5 rounded bg-gray-200 dark:bg-gray-700">A</kbd><kbd class="px-0.5 rounded bg-gray-200 dark:bg-gray-700">S</kbd><kbd class="px-0.5 rounded bg-gray-200 dark:bg-gray-700">D</kbd>
      / flèches — même canal STOMP <code class="text-[10px]">/app/position</code>
    </p>
  `,
  styles: [`
    :host { display: block; }
    .virtual-room-3d-host { position: relative; touch-action: none; }
  `],
})
export class VirtualRoom3dComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;
  @Input() players: RoomPlayerPositionPayload[] = [];
  @Input() localPlayerId = '';
  @Input() minHeight = 300;
  @Output() positionChange = new EventEmitter<{ x: number; z: number; rotY: number }>();

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private raf = 0;
  private floor: THREE.Mesh | null = null;
  private readonly meshById = new Map<string, THREE.Mesh>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.initScene();
  }

  ngOnChanges(_ch: SimpleChanges): void {
    if (this.scene) {
      this.syncMeshes();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.raf);
    this.meshById.forEach((m) => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.meshById.clear();
    this.floor?.geometry.dispose();
    (this.floor?.material as THREE.Material)?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentNode) {
      this.renderer.domElement.remove();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.floor = null;
  }

  onHostPointer(ev: PointerEvent): void {
    if (ev.target !== this.hostRef?.nativeElement) {
      return;
    }
  }

  onKey(ev: KeyboardEvent): void {
    if (!this.localPlayerId) {
      return;
    }
    const me = this.players.find((p) => p.id === this.localPlayerId);
    if (!me) {
      return;
    }
    let dx = 0;
    let dz = 0;
    const step = 1.2;
    switch (ev.key) {
      case 'ArrowLeft':
        dx = -step;
        break;
      case 'ArrowRight':
        dx = step;
        break;
      case 'ArrowUp':
        dz = -step;
        break;
      case 'ArrowDown':
        dz = step;
        break;
      case 'a':
      case 'A':
        dx = -step;
        break;
      case 'd':
      case 'D':
        dx = step;
        break;
      case 'w':
      case 'W':
        dz = -step;
        break;
      case 's':
      case 'S':
        dz = step;
        break;
      default:
        return;
    }
    ev.preventDefault();
    const nx = this.clamp((me.x ?? 50) + dx);
    const nz = this.clamp((me.z ?? 50) + dz);
    const rotY = (Math.atan2(dx, -dz) * 180) / Math.PI;
    this.positionChange.emit({ x: nx, z: nz, rotY: Number.isFinite(rotY) ? rotY : (me.rotY ?? 0) });
  }

  private initScene(): void {
    const el = this.hostRef.nativeElement;
    const w = el.clientWidth || 640;
    const h = el.clientHeight || this.minHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    this.camera.position.set(0, 14, 16);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(this.renderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(4, 12, 6);
    this.scene.add(amb, dir);

    const grid = new THREE.GridHelper(24, 24, 0x6366f1, 0x1e293b);
    (grid.material as THREE.Material).opacity = 0.25;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);

    const floorG = new THREE.PlaneGeometry(24, 24);
    const floorM = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.1,
      roughness: 0.85,
    });
    this.floor = new THREE.Mesh(floorG, floorM);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0.001;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(el);

    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onFloorPointer(e));
    el.addEventListener('keydown', (e) => this.onKey(e as KeyboardEvent));

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();

    this.syncMeshes();
  }

  private onResize(): void {
    const el = this.hostRef?.nativeElement;
    if (!this.camera || !this.renderer || !el) {
      return;
    }
    const w = el.clientWidth;
    const h = el.clientHeight || this.minHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private onFloorPointer(ev: PointerEvent): void {
    if (!this.floor || !this.camera || !this.renderer) {
      return;
    }
    const el = this.renderer.domElement;
    const rect = el.getBoundingClientRect();
    this.ndc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.floor);
    if (hit[0]) {
      const p = hit[0].point;
      const x = this.worldToPercentX(p.x);
      const z = this.worldToPercentZ(p.z);
      const me = this.players.find((q) => q.id === this.localPlayerId);
      this.positionChange.emit({
        x: this.clamp(x),
        z: this.clamp(z),
        rotY: me?.rotY ?? 0,
      });
    }
  }

  private worldToPercentX(wx: number): number {
    return ((wx + 10) / 20) * 100;
  }

  private worldToPercentZ(wz: number): number {
    return ((wz + 10) / 20) * 100;
  }

  private percentToWorldX(px: number): number {
    return (px / 100) * 20 - 10;
  }

  private percentToWorldZ(pz: number): number {
    return (pz / 100) * 20 - 10;
  }

  private clamp(n: number): number {
    return Math.min(100, Math.max(0, n));
  }

  private syncMeshes(): void {
    if (!this.scene) {
      return;
    }
    const seen = new Set<string>();
    for (const p of this.players) {
      if (!p.id) {
        continue;
      }
      seen.add(p.id);
      const x = p.x ?? 50;
      const z = p.z ?? 50;
      const yOff = 0.75;
      const wx = this.percentToWorldX(x);
      const wz = this.percentToWorldZ(z);
      const rotY = ((p.rotY ?? 0) * Math.PI) / 180;

      let m = this.meshById.get(p.id);
      if (!m) {
        const w = p.id === this.localPlayerId ? 0.7 : 0.55;
        const h = p.id === this.localPlayerId ? 1.35 : 1.1;
        const d = w;
        const geo = new THREE.BoxGeometry(w, h, d);
        const col = p.color && /^#([0-9a-fA-F]{6})$/.test(p.color) ? p.color : '#6366f1';
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setStyle(col) });
        m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        this.scene.add(m);
        this.meshById.set(p.id, m);
      }
      m.position.set(wx, yOff, wz);
      m.rotation.set(0, rotY, 0);
    }
    for (const [id, mesh] of this.meshById) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.meshById.delete(id);
      }
    }
  }
}
