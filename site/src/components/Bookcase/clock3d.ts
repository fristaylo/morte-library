import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { glassMaterial, legacyLighting } from "./inkwell3d";

const DIAL_Y = 161;
const DIAL_Z = 43.4;
const DIAL_R = 49.5;
export const FACE_K = 120 / 113.25;
const FACE_Q = DIAL_R * FACE_K;
const SCALE = 0.765;
const YAW = (12 * Math.PI) / 180;
const ARCH_R = 74;
const COL_X = 67;
const TILE = 90;
const TEX = 1024;
const TAU = Math.PI * 2;
const SPIN_PERIOD = 6;
const SPIN_RAMP = 120;
const FONT = "Cormorant, Georgia, serif";
const WOOD = ["#6b4226", "#3a2112", "#8a5a36"];

export interface DialColors {
    edge: string;
    line: string;
    faint: string;
    gold: string;
    soft: string;
}

export interface Clock3D {
    group: THREE.Group;
    box: THREE.Box3;
    setHover(on: boolean): void;
    setOpen(on: boolean): void;
    setHour(hour: number): void;
    setColors(colors: DialColors): Promise<void>;
    dialCenter(target: THREE.Vector3): THREE.Vector3;
    dialEdge(target: THREE.Vector3): THREE.Vector3;
    step(now: number): boolean;
    dispose(): void;
}

interface Mats {
    wood: THREE.MeshStandardMaterial;
    brass: THREE.MeshStandardMaterial;
    gold: THREE.MeshStandardMaterial;
    crystal: THREE.MeshStandardMaterial;
    dark: THREE.MeshStandardMaterial;
    felt: THREE.MeshStandardMaterial;
    ink: THREE.MeshStandardMaterial;
    white: THREE.MeshStandardMaterial;
    face: THREE.MeshStandardMaterial;
    glass: THREE.MeshStandardMaterial;
}

export function createClock(
    position: THREE.Vector3,
    reduceMotion: MediaQueryList,
    env: THREE.Texture,
): Clock3D {
    const mats = makeMaterials(env);
    const group = new THREE.Group();
    group.position.copy(position);
    group.scale.setScalar(SCALE);
    group.rotation.y = YAW;
    group.updateMatrixWorld();

    buildBody(group, mats);
    buildArch(group, mats);
    buildColumns(group, mats);
    buildGlass(group, mats);
    const carousel = buildCarousel(group, mats);
    const hand = buildHand(group, mats);
    for (const part of [group, carousel, hand]) mergeMeshes(part);
    const face = put(
        group,
        new THREE.CircleGeometry(FACE_Q, 96).translate(0, DIAL_Y, DIAL_Z),
        mats.face,
        false,
    );
    face.visible = false;

    const box = new THREE.Box3(
        new THREE.Vector3(-90, 0, -55),
        new THREE.Vector3(90, 250, 55),
    );

    let hover = false;
    let open = false;
    let disposed = false;
    let phase = 0;
    let speed = 0;
    let last = 0;
    let latest: DialColors | null = null;
    let painting = false;

    function setHover(on: boolean) {
        hover = on;
    }

    function setOpen(on: boolean) {
        open = on;
    }

    function setHour(hour: number) {
        hand.rotation.z = -((hour * 15 + 180) * Math.PI) / 180;
    }

    async function setColors(colors: DialColors) {
        latest = colors;
        if (painting) return;
        painting = true;
        try {
            while (latest && !disposed) {
                const next = latest;
                latest = null;
                const tex = await paintFace(next).catch(() => null);
                if (disposed) {
                    tex?.dispose();
                    break;
                }
                if (tex) {
                    mats.face.map?.dispose();
                    mats.face.map = tex;
                    mats.face.color.set(0xffffff);
                    mats.face.needsUpdate = true;
                }
                face.visible = true;
            }
        } finally {
            painting = false;
        }
    }

    function dialAt(target: THREE.Vector3, x: number): THREE.Vector3 {
        return target.set(x, DIAL_Y, DIAL_Z).applyMatrix4(group.matrixWorld);
    }

    function step(now: number): boolean {
        const dt = Math.min(now - last, 50);
        last = now;
        const goal = (hover || open) && !reduceMotion.matches ? 1 : 0;
        speed += (goal - speed) * Math.min(1, dt / SPIN_RAMP);
        if (Math.abs(goal - speed) < 0.003) speed = goal;
        if (speed === 0) return false;
        phase += (dt / 1000) * speed;
        carousel.rotation.y = (TAU * phase) / SPIN_PERIOD;
        return true;
    }

    function dispose() {
        disposed = true;
        group.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        for (const m of Object.values(mats)) {
            m.map?.dispose();
            m.dispose();
        }
    }

    return {
        group,
        box,
        setHover,
        setOpen,
        setHour,
        setColors,
        dialCenter: (target) => dialAt(target, 0),
        dialEdge: (target) => dialAt(target, DIAL_R),
        step,
        dispose,
    };
}

function makeMaterials(env: THREE.Texture): Mats {
    const lit = (m: THREE.MeshStandardMaterial, intensity = 0) => {
        if (intensity) {
            m.envMap = env;
            m.envMapIntensity = intensity;
        }
        m.onBeforeCompile = legacyLighting;
        return m;
    };
    return {
        wood: lit(
            new THREE.MeshStandardMaterial({
                roughness: 0.5,
                map: woodTexture(),
            }),
        ),
        brass: lit(
            new THREE.MeshStandardMaterial({
                color: 0xb5934a,
                metalness: 0.9,
                roughness: 0.32,
            }),
            1.5,
        ),
        gold: lit(
            new THREE.MeshStandardMaterial({
                color: 0xf2b705,
                metalness: 0.85,
                roughness: 0.28,
            }),
            1.5,
        ),
        crystal: lit(
            new THREE.MeshStandardMaterial({
                color: 0xe8b830,
                metalness: 0.9,
                roughness: 0.18,
                flatShading: true,
            }),
            1.6,
        ),
        dark: lit(
            new THREE.MeshStandardMaterial({
                color: 0x1b1310,
                roughness: 0.95,
            }),
        ),
        felt: lit(
            new THREE.MeshStandardMaterial({
                color: 0x3a1c1a,
                roughness: 0.95,
            }),
        ),
        ink: lit(
            new THREE.MeshStandardMaterial({ color: 0x222b36, roughness: 0.5 }),
        ),
        white: lit(
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
        ),
        face: lit(
            new THREE.MeshStandardMaterial({
                color: 0xf6f0e0,
                roughness: 0.6,
                alphaTest: 0.5,
                map: new THREE.Texture(),
            }),
        ),
        glass: glassMaterial(env),
    };
}

function buildBody(g: THREE.Group, m: Mats) {
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            rb(g, m.wood, 14, 8, 14, sx * 70, 4, sz * 36, 1.5);
        }
    }
    rb(g, m.wood, 170, 10, 100, 0, 13, 0, 1.5);
    rb(g, m.wood, 162, 6, 92, 0, 21, 0, 1.2);
    rb(g, m.wood, 152, 4, 86, 0, 26, 0, 1);

    rb(g, m.wood, 32, 70, 84, -58, 63, 0, 0.8);
    rb(g, m.wood, 32, 70, 84, 58, 63, 0, 0.8);
    rb(g, m.wood, 32, 76, 4, -58, 66, 44, 0.8);
    rb(g, m.wood, 32, 76, 4, 58, 66, 44, 0.8);
    rb(g, m.wood, 84, 12, 4, 0, 34, 44, 0.8);
    rb(g, m.wood, 84, 12, 4, 0, 98, 44, 0.8);
    inlay(g, m.gold, -45, 45, 37, 95, 46.2);

    put(
        g,
        new THREE.TorusGeometry(DIAL_R + 2.8, 3, 14, 72).translate(
            0,
            DIAL_Y,
            44.4,
        ),
        m.brass,
    );
}

function buildArch(g: THREE.Group, m: Mats) {
    const body = new THREE.Shape();
    body.moveTo(-ARCH_R, 99.5);
    body.lineTo(ARCH_R, 99.5);
    body.lineTo(ARCH_R, DIAL_Y);
    body.absarc(0, DIAL_Y, ARCH_R, 0, Math.PI, false);
    body.closePath();
    woodExtrude(g, m.wood, body, 81, 1.5, 48);

    const ring = new THREE.Shape();
    ring.moveTo(-ARCH_R - 9.5, DIAL_Y);
    ring.lineTo(-ARCH_R - 2.5, DIAL_Y);
    ring.absarc(0, DIAL_Y, ARCH_R + 2.5, Math.PI, 0, true);
    ring.lineTo(ARCH_R + 9.5, DIAL_Y);
    ring.absarc(0, DIAL_Y, ARCH_R + 9.5, 0, Math.PI, false);
    woodExtrude(g, m.wood, ring, 90, 1.2, 48);
    rb(g, m.wood, 10, 6, 92, -ARCH_R - 6, DIAL_Y - 3, 0, 1.2);
    rb(g, m.wood, 10, 6, 92, ARCH_R + 6, DIAL_Y - 3, 0, 1.2);
}

function buildColumns(g: THREE.Group, m: Mats) {
    const h = DIAL_Y - 30;
    const pts = [
        [0, 0],
        [8, 0],
        [8, 1.8],
        [6.6, 3],
        [7.4, 4.2],
        [7.4, 6],
        [5.8, 7.4],
        [5.6, 10],
        [6.4, 12.5],
        [5.6, 14.5],
        [5.4, h * 0.3],
        [5.1, h * 0.5 - 4],
        [6.1, h * 0.5 - 1.5],
        [6.1, h * 0.5 + 1.5],
        [5.1, h * 0.5 + 4],
        [4.9, h - 30],
        [4.5, h - 18],
        [5.6, h - 14],
        [5.2, h - 12],
        [7.6, h - 9],
        [8, h - 6.5],
        [8, h - 2.5],
        [0, h - 2.5],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    for (const sx of [-1, 1]) {
        const geo = new THREE.LatheGeometry(pts, 28);
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, uv.getX(i) * 0.42, (uv.getY(i) * h) / TILE);
        }
        put(g, geo.translate(sx * COL_X, 30, 43), m.wood);
    }
}

function buildGlass(g: THREE.Group, m: Mats) {
    put(
        g,
        new THREE.PlaneGeometry(84, 52).translate(0, 66, 44.6),
        m.glass,
        false,
    ).renderOrder = 2;
    const h = 2.5;
    const r = DIAL_R + 1;
    const big = (r * r + h * h) / (2 * h);
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(big, 40, 6, 0, TAU, 0, Math.asin(r / big))
            .rotateX(Math.PI / 2)
            .translate(0, 0, 46.2 - (big - h)),
        m.glass,
    );
    dome.position.y = DIAL_Y;
    dome.renderOrder = 2;
    g.add(dome);
}

function buildCarousel(g: THREE.Group, m: Mats): THREE.Group {
    put(
        g,
        new THREE.BoxGeometry(84, 70, 4).translate(0, 63, -40),
        m.dark,
        false,
    );
    put(
        g,
        new THREE.BoxGeometry(84, 1.5, 80).translate(0, 28.75, 0),
        m.felt,
        false,
    );
    const c = new THREE.Group();
    put(
        c,
        new THREE.CylinderGeometry(0.9, 0.9, 52, 10).translate(0, 70, 0),
        m.gold,
    );
    put(c, new THREE.SphereGeometry(2.4, 14, 10).translate(0, 95, 0), m.gold);
    put(
        c,
        new THREE.CylinderGeometry(7, 7, 1.6, 28).translate(0, 88, 0),
        m.gold,
    );
    put(c, new THREE.SphereGeometry(3.2, 16, 12).translate(0, 46, 0), m.gold);
    for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        const arm = put(
            c,
            new THREE.CylinderGeometry(0.5, 0.5, 15, 8)
                .rotateZ(Math.PI / 2)
                .translate(7.5, 0, 0),
            m.gold,
        );
        arm.position.y = 66;
        arm.rotation.y = -a;
        const petal = put(c, new THREE.OctahedronGeometry(1), m.crystal);
        petal.scale.set(2, 11, 6);
        petal.position.set(16 * Math.cos(a), 62, 16 * Math.sin(a));
        petal.rotation.y = -a;
    }
    c.traverse((o) => {
        o.castShadow = false;
    });
    g.add(c);
    return c;
}

function buildHand(g: THREE.Group, m: Mats): THREE.Group {
    const hand = new THREE.Group();
    const s = FACE_Q / 120;
    hand.position.set(0, DIAL_Y, DIAL_Z + 0.5);
    put(
        hand,
        new THREE.BoxGeometry(4 * s, 72 * s, 0.8).translate(0, 20 * s, 0.4),
        m.ink,
        false,
    );
    put(
        hand,
        new THREE.CylinderGeometry(3.5 * s, 3.5 * s, 0.6, 24)
            .rotateX(Math.PI / 2)
            .translate(0, 56 * s, 1),
        m.gold,
        false,
    );
    put(
        hand,
        new THREE.CylinderGeometry(7.2 * s, 7.2 * s, 0.5, 32)
            .rotateX(Math.PI / 2)
            .translate(0, 0, 1.3),
        m.white,
        false,
    );
    put(
        hand,
        new THREE.CylinderGeometry(6 * s, 6 * s, 0.7, 32)
            .rotateX(Math.PI / 2)
            .translate(0, 0, 1.6),
        m.gold,
        false,
    );
    g.add(hand);
    return hand;
}

function put(
    g: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    shadow = true,
): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = shadow;
    g.add(mesh);
    return mesh;
}

function rb(
    g: THREE.Object3D,
    mat: THREE.Material,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    r: number,
) {
    const geo = new RoundedBoxGeometry(
        w,
        h,
        d,
        2,
        Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01),
    );
    const n = geo.attributes.normal;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
        const ax = Math.abs(n.getX(i));
        const ay = Math.abs(n.getY(i));
        const az = Math.abs(n.getZ(i));
        const [a, b] =
            ax >= ay && ax >= az ? [d, h] : ay >= az ? [w, d] : [w, h];
        uv.setXY(i, (uv.getX(i) * a) / TILE, (uv.getY(i) * b) / TILE);
    }
    put(g, geo.translate(x, y, z), mat);
}

function woodExtrude(
    g: THREE.Object3D,
    mat: THREE.Material,
    shape: THREE.Shape,
    depth: number,
    bevel: number,
    segments: number,
) {
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 2,
        curveSegments: segments,
    });
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) / TILE, uv.getY(i) / TILE);
    }
    put(g, geo.translate(0, 0, -(depth / 2)), mat);
}

function inlay(
    g: THREE.Object3D,
    mat: THREE.Material,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z: number,
) {
    const t = 1.2;
    for (const [a, b, c, d] of [
        [x0, x1, y0, y0],
        [x0, x1, y1, y1],
        [x0, x0, y0, y1],
        [x1, x1, y0, y1],
    ]) {
        put(
            g,
            new THREE.BoxGeometry(b - a + t, d - c + t, 0.6).translate(
                (a + b) / 2,
                (c + d) / 2,
                z,
            ),
            mat,
            false,
        );
    }
}

function mergeMeshes(parent: THREE.Object3D) {
    const batches = new Map<string, THREE.Mesh[]>();
    for (const o of parent.children) {
        if (!(o instanceof THREE.Mesh)) continue;
        const key = [
            (o.material as THREE.Material).uuid,
            o.castShadow,
            o.receiveShadow,
            o.renderOrder,
        ].join();
        batches.set(key, [...(batches.get(key) ?? []), o]);
    }
    for (const meshes of batches.values()) {
        const geos = meshes.map((o) => {
            o.updateMatrix();
            const geo = o.geometry.clone().applyMatrix4(o.matrix);
            return geo.index ? geo.toNonIndexed() : geo;
        });
        const [first] = meshes;
        const merged = new THREE.Mesh(mergeGeometries(geos), first.material);
        merged.castShadow = first.castShadow;
        merged.receiveShadow = first.receiveShadow;
        merged.renderOrder = first.renderOrder;
        for (const o of meshes) {
            o.geometry.dispose();
            o.removeFromParent();
        }
        for (const geo of geos) geo.dispose();
        parent.add(merged);
    }
}

function woodTexture(): THREE.CanvasTexture {
    const [base, deep, light] = WOOD;
    const n = 512;
    const cv = document.createElement("canvas");
    cv.width = cv.height = n;
    const x = cv.getContext("2d") as CanvasRenderingContext2D;
    x.fillStyle = base;
    x.fillRect(0, 0, n, n);
    let seed = 7;
    const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    for (let i = 0; i < 220; i++) {
        const px = rnd() * n;
        const vein = rnd() < 0.15;
        const wob = 2 + rnd() * 7;
        const ph = rnd() * TAU;
        const fr = (TAU * (1 + Math.floor(rnd() * 4))) / n;
        x.strokeStyle = vein || rnd() < 0.55 ? deep : light;
        x.globalAlpha = vein ? 0.4 : 0.05 + rnd() * 0.2;
        x.lineWidth = vein ? 1 + rnd() : 1 + rnd() * 5;
        for (const off of [-n, 0, n]) {
            x.beginPath();
            for (let y = 0; y <= n; y += 8) {
                const xx = px + off + Math.sin(y * fr + ph) * wob;
                if (y) x.lineTo(xx, y);
                else x.moveTo(xx, y);
            }
            x.stroke();
        }
    }
    x.globalAlpha = 1;
    const img = x.getImageData(0, 0, n, n);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const j = (rnd() - 0.5) * 14;
        d[i] += j;
        d[i + 1] += j;
        d[i + 2] += j;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

async function paintFace(c: DialColors): Promise<THREE.CanvasTexture> {
    await document.fonts.load(`600 15px ${FONT}`).catch(() => null);
    const img = await loadImage(faceSvg(c));
    const cv = document.createElement("canvas");
    cv.width = cv.height = TEX;
    const x = cv.getContext("2d") as CanvasRenderingContext2D;
    x.drawImage(img, 0, 0, TEX, TEX);
    const k = TEX / 240;
    x.font = `600 ${15 * k}px ${FONT}`;
    x.fillStyle = c.faint;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("6", 44 * k, 120 * k);
    x.fillText("18", 196 * k, 120 * k);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

function loadImage(svg: string): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    return new Promise<HTMLImageElement>((ok, fail) => {
        img.onload = () => ok(img);
        img.onerror = () => fail(new Error("clock face"));
        img.src = url;
    }).finally(() => URL.revokeObjectURL(url));
}

function faceSvg(c: DialColors): string {
    const ticks = Array.from(
        { length: 24 },
        (_, k) =>
            `<line x1="120" y1="${k % 6 === 0 ? 13 : 16}" x2="120" y2="23" stroke="${c.faint}" stroke-width="${k % 6 === 0 ? 2.4 : 1.2}" stroke-linecap="round" transform="rotate(${k * 15} 120 120)"/>`,
    ).join("");
    const rays = Array.from(
        { length: 8 },
        (_, k) =>
            `<line x1="120" y1="32" x2="120" y2="36" transform="rotate(${k * 45} 120 46)"/>`,
    ).join("");
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${TEX}" height="${TEX}" viewBox="0 0 240 240"><defs><radialGradient id="f" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#f0e8d6"/></radialGradient></defs>` +
        `<circle cx="120" cy="120" r="112" fill="url(#f)" stroke="${c.edge}" stroke-width="2.5"/>` +
        `<circle cx="120" cy="120" r="99" fill="none" stroke="${c.line}"/>` +
        ticks +
        `<g stroke="${c.gold}" stroke-width="2" stroke-linecap="round">${rays}</g>` +
        `<circle cx="120" cy="46" r="6.5" fill="${c.gold}"/>` +
        `<path d="M123 204.5a8.5 8.5 0 1 1 0-17c-3.4 1.7-5.6 4.8-5.6 8.5s2.2 6.8 5.6 8.5z" fill="${c.soft}"/>` +
        `</svg>`
    );
}
