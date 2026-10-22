import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type Book, type Category, spineImageUrl } from "../../api";
import { createClock, type DialColors, FACE_K } from "./clock3d";
import { createInkwell, legacyLighting } from "./inkwell3d";

const SHELF_MAX = 936;
const SHELF_MIN = 200;
const FIT_MARGIN = 124;
const FIT_MAX = SHELF_MAX + FIT_MARGIN;
const MIN_SCALE = 0.82;
const DEPTH = 320;
const BOARD = 15;
const SIDE = 15;
const FRONT_Z = -8;
const DIST = 2160;
const PITCH = (6 * Math.PI) / 180;
const TILT = (8.5 * Math.PI) / 180;
const SUN_DIR = new THREE.Vector3(
    Math.sin((-18 * Math.PI) / 180) * Math.cos((16 * Math.PI) / 180),
    Math.sin((22 * Math.PI) / 180),
    Math.cos((-18 * Math.PI) / 180) * Math.cos((16 * Math.PI) / 180),
);
const CASE_COLORS = ["#f6f8fb", "#e8ecf3", "#e6ebf2"];
const LID_H = 32;
const LID_OVER = 30;
const LID_FRONT = 12;
const PLINTH_H = 34;
const INK_Z = -70;
const INK_RIGHT = 90;
const CLOCK_SHIFT = 25;
const LID_Y = -BOARD;
const LID_TOP = LID_Y + LID_H;
const FOCUS_Z = -90;
const CLOCK_DIST = 420;
const CLOCK_FACE = 0.66;
const PANEL_H = 64;
const PANEL_PAD = 24;
const FLY_MS = 900;
const MIN_ROW = 290;
const PLATE_H = 22;
const SPREAD = 3.2;
const PACK_PAD = SPREAD + 3;
const PLATE_LEFT = 14;
const PLATE_PAD = 10;
const PLATE_PX = 4;
const PLATE_SIZE = 12.6;
const PLATE_INSET = 1.2;
const PLATE_T = 3;
const HINGE_DROP = 3.3;
const HINGE_Z = 4;
const VIEW_CORNERS = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
];
const FOLD = Math.PI / 2;
const FOLD_K = 280;
const FOLD_C = 2 * Math.sqrt(FOLD_K) * 0.55;
const FOLD_PAUSE = 100;
const PLINTH_R = 26;
const CASE_SLACK = 8;
const ROUGH = [0.92, 0.42, 0.22];
const DAY_1 = [1, 1, 1];
const DAY_2 = [238 / 255, 241 / 255, 246 / 255];
const PAGE_TONES = [
    ["#f6f0e0", "#e2d6ba"],
    ["#f3ecda", "#dccdac"],
    ["#f9f4e9", "#e7ddc6"],
    ["#efe5cf", "#d3c4a0"],
    ["#f5efdd", "#ddd0b2"],
    ["#f1ead4", "#d6c7a4"],
];
const FULL = [-1, 0, 1, 0];
const TK = 2.2;
const EDGE = 2.5;
const SHELL_PARTS: Part[] = [
    {
        r: [[-1, 0, -1, TK], FULL, [-1, 0, 1, -TK]],
        sel: 0,
        c: 0.7,
        nobul: true,
    },
    { r: [[1, -TK, 1, 0], FULL, [-1, 0, 1, -TK]], sel: 0, c: 0.7, nobul: true },
    { r: [FULL, FULL, [1, -TK, 1, 0]], sel: 1, c: 0.7, seg: [8, 1, 1] },
    ...[0.8, 0.7, -0.7, -0.8].map(
        (f): Part => ({
            r: [FULL, [f, -1.5, f, 1.5], [1, -0.8, 1, 1.6]],
            sel: 4,
            band: true,
            seg: [8, 1, 1],
        }),
    ),
];
const PAGES_PARTS: Part[] = [
    {
        r: [
            [-1, TK, 1, -TK],
            [-1, EDGE, 1, -EDGE],
            [-1, EDGE, 1, -TK],
        ],
        sel: 2,
        seg: [8, 1, 1],
    },
];

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export type Hit =
    | { kind: "book"; slug: string }
    | { kind: "plate"; categoryId: number };

interface RowInfo {
    categoryId: number | null;
    slugs: string[];
}

export interface SceneInfo {
    height: number;
    rows: RowInfo[];
}

interface Projection {
    books: Map<string, Box>;
    plates: (Box | null)[];
    add: Box | null;
    ink: Box;
    clock: Box;
}

export interface ClockFace {
    x: number;
    y: number;
    r: number;
}

interface Pose {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    fov: number;
    offsetY: number;
}

interface Flight {
    t0: number;
    from: Pose;
    target: () => Pose;
    done: () => void;
}

export interface Slot {
    categoryId: number;
    slugs: string[];
    index: number;
}

export interface ShelfScene {
    setLibrary(
        books: Book[],
        categories: Category[],
        withAddRow: boolean,
    ): SceneInfo;
    setCaseColors(case1: string, case2: string): void;
    resize(width: number, height: number, caseWidth: number): SceneInfo;
    setTop(px: number): void;
    scrollFor(slug: string): number | null;
    setHover(slug: string | null): void;
    setInkHover(on: boolean): void;
    setClockHover(on: boolean): void;
    setClockHour(hour: number): void;
    setClockColors(colors: DialColors): void;
    openClock(onDone: () => void): void;
    closeClock(onDone: () => void): void;
    clockFace(): ClockFace;
    clockRadius(): number;
    homography(): string;
    onPose(cb: (() => void) | null): void;
    setPicked(slug: string | null): void;
    pick(clientX: number, clientY: number): Hit | null;
    worldPerPx(width: number): number;
    onFrame(cb: (() => void) | null): void;
    project(): Projection;
    bookRect(slug: string): DOMRect | null;
    beginDrag(slug: string, clientX: number, clientY: number): void;
    dragTo(clientX: number, clientY: number): void;
    endDrag(): void;
    slotAt(clientX: number, clientY: number, slug: string): Slot | null;
    dispose(): void;
}

interface Spring {
    x: number;
    v: number;
    t: number;
}

interface BookM {
    i: number;
    slug: string;
    book: Book;
    w: number;
    h: number;
    L: number;
    gap: number;
    tone: number;
    r: number;
    type: number;
    bands: number;
    ornament: number;
    col: THREE.Color;
    rect: number[];
    row: number;
    slot: number;
    xl: number;
    cx: number;
    by: number;
    theta: number;
    a: Spring;
    n: Spring;
    p: Spring;
    x: Spring;
    y: Spring;
    hand: Spring;
    gx: Spring;
    gy: Spring;
    dragged: boolean;
    placed: boolean;
    grabX: number;
    grabY: number;
    inv: THREE.Matrix4;
}

interface RowM {
    categoryId: number | null;
    name: string;
    k: number;
    multi: boolean;
    books: BookM[];
    used: number;
    maxH: number;
    lastGap: number;
    ceil: number;
    floor: number;
    plateW: number;
    plate: PlateM | null;
}

interface Part {
    r: number[][];
    sel: number;
    c?: number;
    nobul?: boolean;
    band?: boolean;
    seg?: number[];
}

interface GeoData {
    fr: number[];
    of: number[];
    nm: number[];
    fl: number[];
    bd: number[];
    ix: number[];
}

interface InstAttrs {
    size: THREE.InstancedBufferAttribute;
    atlas: THREE.InstancedBufferAttribute;
    color: THREE.InstancedBufferAttribute;
    aux: THREE.InstancedBufferAttribute;
}

interface Atlas {
    tex: THREE.CanvasTexture;
    ctx: CanvasRenderingContext2D;
    pos: { x: number; y: number; tw: number; th: number }[];
    P: number;
}

interface CasePart {
    mesh: THREE.InstancedMesh;
    capacity: number;
    attrs: InstAttrs;
    kind: number[];
}

interface PlateM {
    text: string;
    width: number;
    root: THREE.Group;
    pivot: THREE.Group;
    tex: THREE.CanvasTexture;
    face: THREE.Material;
    geos: THREE.BufferGeometry[];
    x: number;
    v: number;
    tgt: number;
    want: number;
    at: number;
    running: boolean;
}

interface PlateMats {
    body: THREE.Material;
    hinge: THREE.Material;
    aniso: number;
}

interface Statics {
    pageLines: THREE.Texture;
    pageNormal: THREE.Texture;
    grain: THREE.Texture;
    stripe: THREE.Texture;
    white: THREE.Texture;
}

type Uniforms = Record<string, THREE.IUniform>;

export function spineSize(book: Book): { w: number; h: number } {
    return spineBox(book.pages ?? 300, book.spineRatio ?? 7);
}

export function createShelfScene(canvas: HTMLCanvasElement): ShelfScene | null {
    let renderer: THREE.WebGLRenderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
        });
    } catch {
        return null;
    }
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const envRT = makeEnvironment(renderer);
    scene.environment = envRT.texture;
    const camera = new THREE.PerspectiveCamera(20, 1, 300, 7000);
    const hemi = new THREE.HemisphereLight(0xffffff, 0xe3e3e3, 0.91);
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    scene.add(hemi, sun, sun.target);
    scene.environmentIntensity = 0.25;
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 3;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 1.1;
    sun.shadow.intensity = 0.61;
    const eye = new THREE.Vector3();

    const U: Uniforms = {
        uBulge: { value: 0.15 },
        uSkip: { value: -1 },
    };
    const T = makeStaticTextures(renderer);
    const tones = PAGE_TONES.flat().map((h) => {
        const c = new THREE.Color(h);
        return new THREE.Vector3(c.r, c.g, c.b);
    });
    const shellMat = makeBookMaterial(0, 24, T.grain, U, T, tones);
    const pagesMat = makeBookMaterial(0, 6, T.pageNormal, U, T, tones);
    const caseMat = makeBookMaterial(1, 24, null, U, T, tones);
    pagesMat.normalScale.setScalar(1.5);
    shellMat.normalScale.setScalar(0.45);
    const plateMats: PlateMats = {
        body: legacy(
            new THREE.MeshPhysicalMaterial({
                color: 0x1c3270,
                roughness: 0.25,
                metalness: 0.2,
            }),
        ),
        hinge: legacy(
            new THREE.MeshStandardMaterial({
                color: 0xb5934a,
                metalness: 0.9,
                roughness: 0.32,
                envMap: envRT.texture,
                envMapIntensity: 1.5,
            }),
        ),
        aniso: Math.min(4, renderer.capabilities.getMaxAnisotropy()),
    };
    const depthMat = patchDepth(U, false);
    const bookDepthMat = patchDepth(U, true);
    const ghostShellMat = makeBookMaterial(0, 24, T.grain, U, T, tones);
    const ghostPagesMat = makeBookMaterial(0, 6, T.pageNormal, U, T, tones);
    ghostShellMat.normalScale.setScalar(0.45);
    ghostPagesMat.normalScale.setScalar(1.5);
    for (const m of [ghostShellMat, ghostPagesMat]) {
        m.transparent = true;
        m.opacity = 0.35;
        m.depthWrite = false;
    }
    const litMats = [shellMat, pagesMat, caseMat, ghostShellMat, ghostPagesMat];

    const inkBase = new THREE.Vector3(inkX(SHELF_MAX), LID_TOP, INK_Z);
    const ink = createInkwell(inkBase, reduceMotion, envRT.texture);
    scene.add(ink.group);
    ink.group.updateMatrixWorld();
    const clockBase = new THREE.Vector3(
        CLOCK_SHIFT - inkX(SHELF_MAX),
        LID_TOP,
        INK_Z,
    );
    const clock = createClock(clockBase, reduceMotion, envRT.texture);
    scene.add(clock.group);
    clock.group.updateMatrixWorld();

    const focus = new THREE.Vector3(0, 0, FOCUS_Z);
    const active = new Set<BookM>();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const wall = new THREE.Plane(new THREE.Vector3(0, 0, 1), -FRONT_Z);
    const wallHit = new THREE.Vector3();
    const rayO = new THREE.Vector3();
    const rayD = new THREE.Vector3();
    const plateHit = new THREE.Vector3();
    const plateBox = new THREE.Box3();
    const shadowV = new THREE.Vector3();
    const proj = new THREE.Vector3();
    const corners = VIEW_CORNERS.map(() => new THREE.Vector3());
    const tint = new THREE.Color();
    const scratch = new Float32Array(16);
    let factors = [DAY_1, DAY_2];
    let cw = 1;
    let ch = 1;
    let caseW = 1024;
    let shelfW = SHELF_MAX;
    let fitW = FIT_MAX;
    let dist = DIST;
    let plateX = PLATE_LEFT - SHELF_MAX / 2;
    let input: {
        list: Book[];
        categories: Category[];
        withAddRow: boolean;
    } | null = null;
    let info: SceneInfo = { height: 0, rows: [] };
    let spanY = 1000;
    let top = 0;
    let shown = false;
    let height = LID_TOP + PLINTH_H;
    let raf = 0;
    let lastT = 0;
    let disposed = false;
    let fontsOk = false;
    let bookA: InstAttrs | null = null;
    let models: BookM[] = [];
    let bySlug = new Map<string, BookM>();
    let rows: RowM[] = [];
    let rowsKey = "";
    let hovered: BookM | null = null;
    let pickedSlug: string | null = null;
    let dragging: BookM | null = null;
    let shell: THREE.InstancedMesh | null = null;
    let pages: THREE.InstancedMesh | null = null;
    let atlas: Atlas | null = null;
    const plates: PlateM[] = [];
    let caseH = 0;
    let caseParts: CasePart[] = [];
    let caseBuiltW = 0;
    let imageGen = 0;
    let dirty = true;
    let ghostShell: THREE.InstancedMesh | null = null;
    let ghostPages: THREE.InstancedMesh | null = null;
    let ghostA: InstAttrs | null = null;
    let ghostFor: BookM | null = null;
    let inkHovered = false;
    let frameCb: (() => void) | null = null;
    let poseCb: (() => void) | null = null;
    let clockMode: "closed" | "opening" | "open" | "closing" = "closed";
    let flight: Flight | null = null;
    const normal = newPose();
    const mid = newPose();

    canvas.style.visibility = "hidden";
    const onMotion = () => {
        if (reduceMotion.matches) ink.reset();
        request();
    };
    reduceMotion.addEventListener("change", onMotion);

    loadFonts().then(() => {
        fontsOk = true;
        if (disposed) return;
        if (plates.length) {
            for (const p of plates) p.text = "";
            buildCase(caseH);
            sizePlates();
            placeBooks(false, false);
        }
        if (atlas) drawAtlas();
        request();
    });

    function worldPerPx(width: number): number {
        const fit = shelfWidth(width) + FIT_MARGIN;
        const dz = Math.cos(PITCH) * ((DIST * fit) / FIT_MAX);
        return ((fit / width) * (dz + FOCUS_Z - FRONT_Z)) / dz;
    }

    function setShelf(w: number) {
        shelfW = w;
        fitW = w + FIT_MARGIN;
        dist = (DIST * fitW) / FIT_MAX;
        plateX = PLATE_LEFT - w / 2;
        inkBase.x = inkX(w);
        ink.group.position.copy(inkBase);
        ink.group.updateMatrixWorld();
        clockBase.x = CLOCK_SHIFT - inkX(w);
        clock.group.position.copy(clockBase);
        clock.group.updateMatrixWorld();
    }

    function request() {
        if (!raf && !disposed && shown) raf = requestAnimationFrame(frame);
    }

    function show(on: boolean) {
        if (on === shown) return;
        shown = on;
        canvas.style.visibility = on ? "" : "hidden";
        if (on) request();
        else {
            cancelAnimationFrame(raf);
            raf = 0;
        }
    }

    function frame(t: number) {
        raf = 0;
        const dt = Math.min((t - lastT) / 1000, 1 / 30) || 1 / 60;
        lastT = t;
        stepFlight(performance.now());
        if (active.size) stepAnim(dt);
        const platesBusy = stepPlates(performance.now(), dt);
        const inkBusy = ink.step(performance.now());
        const clockBusy = clock.step(performance.now());
        if (inkBusy) dirty = true;
        if (dirty) renderer.shadowMap.needsUpdate = true;
        dirty = false;
        renderer.render(scene, camera);
        frameCb?.();
        if (
            active.size ||
            inkBusy ||
            platesBusy ||
            clockBusy ||
            flight !== null
        ) {
            request();
        }
    }

    function readPose(into: Pose): Pose {
        into.position.copy(camera.position);
        into.quaternion.copy(camera.quaternion);
        into.fov = camera.fov;
        into.offsetY = camera.view?.enabled ? camera.view.offsetY : 0;
        return into;
    }

    function applyPose(p: Pose) {
        camera.position.copy(p.position);
        camera.quaternion.copy(p.quaternion);
        camera.fov = p.fov;
        if (p.offsetY) camera.setViewOffset(cw, ch, 0, p.offsetY, cw, ch);
        else camera.clearViewOffset();
        camera.updateMatrixWorld();
        poseCb?.();
    }

    function clockPose(): Pose {
        const center = clock.dialCenter(new THREE.Vector3());
        const radius = clock.dialEdge(new THREE.Vector3()).distanceTo(center);
        const yaw = clock.group.rotation.y;
        const pose = newPose();
        pose.position
            .set(Math.sin(yaw), 0, Math.cos(yaw))
            .multiplyScalar(CLOCK_DIST)
            .add(center);
        pose.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().lookAt(pose.position, center, camera.up),
        );
        pose.fov =
            (2 *
                Math.atan(
                    (radius * ch * FACE_K) / (2 * clockRadius() * CLOCK_DIST),
                ) *
                180) /
            Math.PI;
        return pose;
    }

    function fly(target: () => Pose, done: () => void) {
        if (reduceMotion.matches) {
            applyPose(target());
            done();
        } else {
            flight = {
                t0: performance.now(),
                from: readPose(newPose()),
                target,
                done,
            };
        }
        request();
    }

    function stepFlight(now: number) {
        const f = flight;
        if (!f) return;
        const k = Math.min(1, (now - f.t0) / FLY_MS);
        const e = easeInOutCubic(k);
        const to = f.target();
        mid.position.lerpVectors(f.from.position, to.position, e);
        mid.quaternion.slerpQuaternions(f.from.quaternion, to.quaternion, e);
        mid.fov = f.from.fov + (to.fov - f.from.fov) * e;
        mid.offsetY = f.from.offsetY + (to.offsetY - f.from.offsetY) * e;
        applyPose(mid);
        if (k < 1) return;
        flight = null;
        f.done();
    }

    function openClock(onDone: () => void) {
        if (clockMode !== "closed") return;
        clockMode = "opening";
        clock.setOpen(true);
        show(true);
        fly(clockPose, () => {
            clockMode = "open";
            onDone();
        });
    }

    function closeClock(onDone: () => void) {
        if (clockMode !== "open") return;
        clockMode = "closing";
        clock.setOpen(false);
        fly(
            () => normal,
            () => {
                clockMode = "closed";
                updateCamera();
                onDone();
            },
        );
    }

    function clockRadius(): number {
        const room = ch - 2 * (PANEL_H + PANEL_PAD);
        return Math.min(CLOCK_FACE * Math.min(cw, ch), room) / 2;
    }

    function clockFace(): ClockFace {
        const { x, y } = toPx(clock.dialCenter(proj));
        const e = toPx(clock.dialEdge(proj));
        return { x, y, r: Math.hypot(e.x - x, e.y - y) * FACE_K };
    }

    function anchorPlane() {
        VIEW_CORNERS.forEach(([x, y], i) => {
            raycaster.setFromCamera(ndc.set(x, y), camera);
            raycaster.ray.intersectPlane(wall, corners[i]);
        });
    }

    function homography(): string {
        const quad = corners.map((c) => {
            const v = toPx(proj.copy(c));
            return [v.x, v.y];
        });
        return matrix3d(quad, cw, ch);
    }

    function stepAnim(dt: number) {
        if (!shell) return;
        const snap = reduceMotion.matches;
        const arr = shell.instanceMatrix.array as Float32Array;
        let lit = false;
        for (const b of active) {
            if (!b.dragged) lit = true;
            let done = settle(b.a, 170, 20, dt, snap);
            done = settle(b.n, 120, 16, dt, snap) && done;
            done = settle(b.p, 170, 20, dt, snap) && done;
            done = settle(b.hand, 170, 20, dt, snap) && done;
            if (b.dragged) {
                done = false;
            } else {
                done = settle(b.x, 170, 20, dt, snap) && done;
                done = settle(b.y, 170, 20, dt, snap) && done;
            }
            if (b === ghostFor) {
                const gx = settle(b.gx, 170, 20, dt, snap);
                const gy = settle(b.gy, 170, 20, dt, snap);
                if (!gx || !gy) lit = true;
                done = gx && gy && done;
                writeGhost(b);
            }
            writeMatrix(arr, b.i, b, false);
            if (done) {
                active.delete(b);
                if (b === ghostFor) hideGhost();
            }
        }
        shell.instanceMatrix.needsUpdate = true;
        if (lit) dirty = true;
    }

    function writeMatrix(
        arr: Float32Array,
        i: number,
        b: BookM,
        rest: boolean,
    ) {
        if (rest) writePose(arr, i, b, b.cx, b.by, 0, 0, 0, 0);
        else writePose(arr, i, b, b.x.x, b.y.x, b.a.x, b.n.x, b.p.x, b.hand.x);
    }

    function writePose(
        arr: Float32Array,
        i: number,
        b: BookM,
        x: number,
        y: number,
        a: number,
        n: number,
        p: number,
        hand: number,
    ) {
        const zf = FRONT_Z + hand * (b.L + 24);
        const u = (zf - eye.z) / (FRONT_Z - eye.z);
        const px = eye.x + (x - eye.x) * u;
        const py = eye.y + (y - eye.y) * u;
        const al = -b.theta + TILT * p;
        const c = Math.cos(al);
        const s = Math.sin(al);
        const oy = b.h / 2;
        const oz = -b.L / 2;
        const e = i * 16;
        arr[e] = 1;
        arr[e + 1] = 0;
        arr[e + 2] = 0;
        arr[e + 3] = 0;
        arr[e + 4] = 0;
        arr[e + 5] = c;
        arr[e + 6] = s;
        arr[e + 7] = 0;
        arr[e + 8] = 0;
        arr[e + 9] = -s;
        arr[e + 10] = c;
        arr[e + 11] = 0;
        arr[e + 12] = px + spread(px, SPREAD * n, shelfW / 2 - b.w / 2);
        arr[e + 13] = py + 1.2 * a + 8 * hand + c * oy - s * oz;
        arr[e + 14] = zf + 32 * a + s * oy + c * oz;
        arr[e + 15] = 1;
    }

    function writeGhost(b: BookM) {
        if (!ghostShell) return;
        writePose(
            ghostShell.instanceMatrix.array as Float32Array,
            0,
            b,
            b.gx.x,
            b.gy.x,
            0,
            0,
            0,
            0,
        );
        ghostShell.instanceMatrix.needsUpdate = true;
    }

    function showGhost(b: BookM) {
        if (!ghostA || !ghostShell || !ghostPages) return;
        writeAttrs(ghostA, 0, b);
        for (const attr of Object.values(ghostA)) attr.needsUpdate = true;
        ghostFor = b;
        U.uSkip.value = b.i;
        ghostShell.visible = ghostPages.visible = true;
        writeGhost(b);
        refreshFold();
    }

    function hideGhost() {
        ghostFor = null;
        U.uSkip.value = -1;
        if (ghostShell) ghostShell.visible = false;
        if (ghostPages) ghostPages.visible = false;
        refreshFold();
    }

    function updateCamera() {
        const halfH = (fitW * ch) / (2 * caseW);
        camera.aspect = cw / ch;
        const dz = Math.cos(PITCH) * dist;
        camera.fov = (2 * Math.atan(halfH / dz) * 180) / Math.PI;
        spanY = 2 * halfH;
        const rise = Math.sin(PITCH) * dist;
        const depth = (dz + FOCUS_Z - FRONT_Z) / dz;
        const ndc = 1 - (2 * top) / ch;
        focus.set(0, LID_TOP - rise - depth * (ndc * halfH - rise), FOCUS_Z);
        camera.position.set(0, focus.y + rise, focus.z + dz);
        camera.quaternion.identity();
        camera.setViewOffset(cw, ch, 0, ((ch / 2) * rise) / halfH, cw, ch);
        camera.updateMatrixWorld();
        eye.copy(camera.position);
        readPose(normal);
        anchorPlane();
        if (clockMode === "open") applyPose(clockPose());
        fitShadow();
        dirty = true;
        const wpp = worldPerPx(caseW);
        const inkTop = (ink.box.max.y + inkBase.y - LID_TOP) / wpp;
        show(
            clockMode !== "closed" ||
                (top + height / wpp > 0 && top - inkTop < ch),
        );
    }

    function fitShadow() {
        sun.position.copy(focus).addScaledVector(SUN_DIR, 3500);
        sun.target.position.copy(focus);
        sun.updateMatrixWorld();
        sun.target.updateMatrixWorld();
        const sh = sun.shadow;
        sh.updateMatrices(sun);
        const inv = sh.camera.matrixWorldInverse;
        const y0 = focus.y - spanY * 0.62 - 150;
        const y1 = focus.y + spanY * 0.62 + 150;
        const v = shadowV;
        let l = Infinity;
        let r = -Infinity;
        let b = Infinity;
        let t = -Infinity;
        let f = -Infinity;
        for (const x of [-fitW / 2, fitW / 2]) {
            for (const y of [y0, y1]) {
                for (const z of [-DEPTH - 20, 50]) {
                    v.set(x, y, z).applyMatrix4(inv);
                    l = Math.min(l, v.x);
                    r = Math.max(r, v.x);
                    b = Math.min(b, v.y);
                    t = Math.max(t, v.y);
                    f = Math.max(f, -v.z);
                }
            }
        }
        Object.assign(sh.camera, {
            left: l - 10,
            right: r + 10,
            bottom: b - 10,
            top: t + 10,
            near: 10,
            far: f + 400,
        });
        sh.camera.updateProjectionMatrix();
    }

    function setLibrary(
        books: Book[],
        categories: Category[],
        withAddRow: boolean,
    ): SceneInfo {
        const list = categories.length ? books : [];
        const next = new Map<string, BookM>();
        const redraw: BookM[] = [];
        const reimage: BookM[] = [];
        let relayout = !shell || list.length !== models.length;
        for (const b of list) {
            const old = bySlug.get(b.slug);
            if (!old) {
                relayout = true;
                next.set(b.slug, makeModel(b));
            } else if (old.book === b || bookSig(old.book) === bookSig(b)) {
                if (old.book.updatedAt !== b.updatedAt && b.hasSpineImage) {
                    reimage.push(old);
                }
                old.book = b;
                next.set(b.slug, old);
            } else {
                const m = makeModel(b);
                carryState(m, old);
                if (m.w !== old.w || m.h !== old.h) {
                    relayout = true;
                } else {
                    m.i = old.i;
                    m.rect = old.rect;
                    redraw.push(m);
                }
                next.set(b.slug, m);
            }
        }
        bySlug = next;
        models = relayout
            ? list.map((b) => next.get(b.slug) as BookM)
            : models.map((m) => next.get(m.slug) as BookM);
        for (const b of active) {
            if (bySlug.get(b.slug) === b) continue;
            active.delete(b);
            const m = bySlug.get(b.slug);
            if (m) active.add(m);
        }
        const gf = ghostFor;
        const remap = (b: BookM | null) => (b && bySlug.get(b.slug)) || null;
        hovered = remap(hovered);
        dragging = remap(dragging);
        ghostFor = remap(gf);
        if (gf && !ghostFor) hideGhost();
        input = { list, categories, withAddRow };
        rows = packRows(list, categories, withAddRow, bySlug, shelfW);
        const totalH = stackHeight();
        if (relayout) buildBooks();
        else if (bookA && atlas) {
            for (const m of redraw) {
                writeAttrs(bookA, m.i, m);
                if (fontsOk) drawBook(m, true);
            }
            for (const m of reimage) if (fontsOk) drawBook(m, false);
            if (redraw.length) {
                for (const attr of Object.values(bookA))
                    attr.needsUpdate = true;
                atlas.tex.needsUpdate = true;
            }
        }
        if (ghostFor && (relayout || redraw.length)) showGhost(ghostFor);
        const key = rowsSig();
        if (relayout || key !== rowsKey) {
            rowsKey = key;
            buildCase(totalH);
        }
        sizePlates();
        placeBooks(relayout, false);
        refreshFold();
        updateCamera();
        request();
        info = sceneInfo();
        return info;
    }

    function reflow() {
        if (!input) return;
        rows = packRows(
            input.list,
            input.categories,
            input.withAddRow,
            bySlug,
            shelfW,
        );
        rowsKey = rowsSig();
        buildCase(stackHeight());
        sizePlates();
        placeBooks(false, true);
        refreshFold();
        info = sceneInfo();
    }

    function stackHeight(): number {
        const totalH = rows.length
            ? -(rows[rows.length - 1].floor - BOARD)
            : BOARD;
        height = LID_TOP + totalH + PLINTH_H;
        return totalH;
    }

    function rowsSig(): string {
        return rows
            .map((r) => `${r.floor}:${r.categoryId ?? "+"}:${plateText(r)}`)
            .join("\n");
    }

    function sceneInfo(): SceneInfo {
        const prev = info.rows;
        const next = rows.map((r, i) => {
            const slugs = r.books.map((b) => b.slug);
            const old = prev[i];
            return old &&
                old.categoryId === r.categoryId &&
                old.slugs.length === slugs.length &&
                old.slugs.every((s, k) => s === slugs[k])
                ? old
                : { categoryId: r.categoryId, slugs };
        });
        return height === info.height &&
            next.length === prev.length &&
            next.every((r, i) => r === prev[i])
            ? info
            : { height, rows: next };
    }

    function sizePlates() {
        let i = 0;
        for (const r of rows) {
            if (r.categoryId === null) continue;
            r.plate = plates[i++] ?? null;
            r.plateW = r.plate?.width ?? 0;
        }
    }

    function syncPlates(plateRows: RowM[]) {
        plateRows.forEach((r, i) => {
            const text = plateText(r);
            let p = plates[i];
            if (!p || p.text !== text) {
                const next = makePlate(text, plateMats);
                if (p) {
                    next.x = p.x;
                    next.v = p.v;
                    next.tgt = p.tgt;
                    next.want = p.want;
                    next.at = p.at;
                    next.running = p.running;
                    removePlate(p);
                }
                next.pivot.rotation.x = next.x * FOLD;
                scene.add(next.root);
                plates[i] = next;
                p = next;
            }
            p.root.position.set(plateX, r.floor - HINGE_DROP, HINGE_Z);
        });
        for (const p of plates.splice(plateRows.length)) removePlate(p);
    }

    function removePlate(p: PlateM) {
        scene.remove(p.root);
        for (const g of p.geos) g.dispose();
        p.tex.dispose();
        p.face.dispose();
    }

    function refreshFold() {
        const rel = [
            hovered,
            pickedSlug ? bySlug.get(pickedSlug) : undefined,
            ghostFor,
        ];
        const now = performance.now();
        rows.forEach((r, i) => {
            const p = r.plate;
            if (!p) return;
            const want = rel.some(
                (b) =>
                    b &&
                    b.row === i &&
                    b.cx + b.w / 2 + SPREAD > plateX &&
                    b.cx - b.w / 2 - SPREAD < plateX + p.width,
            )
                ? 1
                : 0;
            if (want === p.want) return;
            p.want = want;
            if (want || reduceMotion.matches) {
                p.tgt = want;
                p.at = 0;
            } else {
                p.at = now + FOLD_PAUSE;
            }
            p.running = true;
            request();
        });
    }

    function stepPlates(now: number, dt: number): boolean {
        let busy = false;
        for (const p of plates) {
            if (!p.running) continue;
            const prev = p.x;
            stepPlate(p, now, dt, reduceMotion.matches);
            if (p.x !== prev) {
                p.pivot.rotation.x = p.x * FOLD;
                dirty = true;
            }
            if (p.running) busy = true;
        }
        return busy;
    }

    function placeBooks(rebuilt: boolean, snap: boolean) {
        if (!shell) return;
        const arr = shell.instanceMatrix.array as Float32Array;
        const m = new THREE.Matrix4();
        for (const b of models) {
            b.theta = (b.r - 0.5) * 0.014;
            writeMatrix(scratch, 0, b, true);
            b.inv.copy(m.fromArray(scratch)).invert();
            const fresh = !b.placed;
            const jump = fresh || snap;
            if (jump) {
                b.placed = true;
                b.x.x = b.cx;
                b.y.x = b.by;
                b.x.v = b.y.v = 0;
            }
            if (jump || rebuilt) writeMatrix(arr, b.i, b, false);
            if (!b.dragged && (b.x.t !== b.cx || b.y.t !== b.by || jump)) {
                b.x.t = b.cx;
                b.y.t = b.by;
                if (!jump) active.add(b);
            }
            if (fresh && b.slug === pickedSlug) {
                b.p.t = 1;
                active.add(b);
            }
        }
        if (ghostFor) {
            ghostFor.gx.t = ghostFor.cx;
            ghostFor.gy.t = ghostFor.by;
            active.add(ghostFor);
        }
        shell.instanceMatrix.needsUpdate = true;
    }

    function buildBooks() {
        disposeBooks();
        const n = models.length;
        const cap = Math.max(n, 1);
        const A: InstAttrs = {
            size: instAttr(cap, 3),
            atlas: instAttr(cap, 4),
            color: instAttr(cap, 3),
            aux: instAttr(cap, 4),
        };
        bookA = A;
        atlas = packAtlas(models, renderer);
        models.forEach((b, i) => {
            b.i = i;
            writeAttrs(A, i, b);
        });
        const sg = makeGeo(SHELL_PARTS);
        const pg = makeGeo(PAGES_PARTS);
        attach(sg, A);
        attach(pg, A);
        shell = new THREE.InstancedMesh(sg, shellMat, cap);
        pages = new THREE.InstancedMesh(pg, pagesMat, cap);
        pages.instanceMatrix = shell.instanceMatrix;
        shell.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        shell.count = pages.count = n;
        for (const m of [shell, pages]) {
            m.frustumCulled = false;
            m.receiveShadow = true;
            m.castShadow = true;
            m.customDepthMaterial = bookDepthMat;
            scene.add(m);
        }
        ghostA = {
            size: instAttr(1, 3),
            atlas: instAttr(1, 4),
            color: instAttr(1, 3),
            aux: instAttr(1, 4),
        };
        const gsg = makeGeo(SHELL_PARTS);
        const gpg = makeGeo(PAGES_PARTS);
        attach(gsg, ghostA);
        attach(gpg, ghostA);
        ghostShell = new THREE.InstancedMesh(gsg, ghostShellMat, 1);
        ghostPages = new THREE.InstancedMesh(gpg, ghostPagesMat, 1);
        ghostPages.instanceMatrix = ghostShell.instanceMatrix;
        for (const m of [ghostShell, ghostPages]) {
            m.frustumCulled = false;
            m.visible = false;
            m.castShadow = true;
            m.customDepthMaterial = depthMat;
            m.renderOrder = 2;
            scene.add(m);
        }
        setAtlas(shellMat, atlas.tex);
        setAtlas(pagesMat, atlas.tex);
        setAtlas(ghostShellMat, atlas.tex);
        setAtlas(ghostPagesMat, atlas.tex);
        if (fontsOk) drawAtlas();
    }

    function drawAtlas() {
        if (!atlas) return;
        imageGen++;
        for (const b of models) drawBook(b, true);
        atlas.tex.needsUpdate = true;
    }

    function drawBook(b: BookM, plain: boolean) {
        if (!atlas) return;
        const a = atlas;
        const gen = imageGen;
        const p = a.pos[b.i];
        if (plain) drawSpine(a.ctx, b, p, a.P, null);
        if (!b.book.hasSpineImage) return;
        const img = new Image();
        img.onload = () => {
            if (gen !== imageGen || disposed) return;
            drawSpine(a.ctx, b, p, a.P, img);
            a.tex.needsUpdate = true;
            request();
        };
        img.src = spineImageUrl(b.book);
    }

    function disposeBooks() {
        imageGen++;
        active.clear();
        for (const m of [shell, pages, ghostShell, ghostPages]) {
            if (!m) continue;
            scene.remove(m);
            m.geometry.dispose();
            m.dispose();
        }
        shell = pages = ghostShell = ghostPages = null;
        bookA = null;
        atlas?.tex.dispose();
        atlas = null;
    }

    function buildCase(totalH: number) {
        caseH = totalH;
        syncPlates(rows.filter((r) => r.categoryId !== null));
        const need = [rows.length + 2, 1, rows.length, 1];
        if (
            shelfW !== caseBuiltW ||
            need.some((n, i) => n > (caseParts[i]?.capacity ?? 0))
        ) {
            disposeCase();
            caseBuiltW = shelfW;
            const plinthW = shelfW + 2 * SIDE + 12;
            caseParts = [
                newCasePart(boxGeo(0), caseMat, need[0]),
                newCasePart(boxGeo(0), caseMat, need[1]),
                newCasePart(boxGeo(0), caseMat, need[2]),
                newCasePart(
                    plinthGeo(plinthW, PLINTH_H, DEPTH - 6, PLINTH_R),
                    caseMat,
                    need[3],
                ),
            ];
            caseParts.forEach((part, i) => {
                const m = part.mesh;
                attach(m.geometry, part.attrs);
                m.frustumCulled = false;
                m.receiveShadow = true;
                m.castShadow = i < 2;
                m.customDepthMaterial = depthMat;
                scene.add(m);
            });
        }
        const [body, lid, walls, plinth] = caseParts;
        caseParts.forEach((part, i) => {
            part.mesh.count = need[i];
        });
        const mt = new THREE.Matrix4();
        const put = (
            part: CasePart,
            i: number,
            pos: number[],
            size: number[],
            kind: number,
            style: number,
        ) => {
            mt.makeTranslation(pos[0], pos[1], pos[2]);
            part.mesh.setMatrixAt(i, mt);
            part.attrs.size.setXYZ(i, size[0], size[1], size[2]);
            part.attrs.aux.setXYZW(i, 0.5, 1, 0.85, style);
            part.kind[i] = kind;
        };
        for (let k = 0; k < rows.length; k++) {
            put(
                body,
                k,
                [0, rows[k].floor - BOARD / 2, -DEPTH / 2],
                [shelfW, BOARD, DEPTH],
                0,
                0,
            );
        }
        let k = rows.length;
        for (const sgn of [-1, 1]) {
            put(
                body,
                k++,
                [sgn * (shelfW / 2 + SIDE / 2), -totalH / 2, -DEPTH / 2],
                [SIDE, totalH, DEPTH],
                1,
                1,
            );
        }
        put(
            lid,
            0,
            [0, LID_Y + LID_H / 2, (LID_FRONT - DEPTH) / 2],
            [shelfW + 2 * SIDE + 2 * LID_OVER, LID_H, DEPTH + LID_FRONT],
            0,
            4,
        );
        const plinthW = shelfW + 2 * SIDE + 12;
        put(
            plinth,
            0,
            [0, -totalH - PLINTH_H / 2, -DEPTH / 2 - 3],
            [plinthW, PLINTH_H, DEPTH - 6],
            0,
            5,
        );
        rows.forEach((r, i) => {
            put(
                walls,
                i,
                [0, (r.ceil + r.floor) / 2, -DEPTH - 3],
                [shelfW + 2, r.ceil - r.floor + 2, 6],
                2,
                2,
            );
        });
        for (const part of caseParts) {
            part.mesh.instanceMatrix.needsUpdate = true;
            part.attrs.size.needsUpdate = true;
            part.attrs.aux.needsUpdate = true;
            part.attrs.atlas.needsUpdate = true;
        }
        paintCase();
        dirty = true;
    }

    function paintCase() {
        const time = [factors[0], factors[1], factors[1]];
        const rgb = { r: 0, g: 0, b: 0 };
        const shades = CASE_COLORS.map((hex, kind) => {
            const f = time[kind];
            tint.set(hex).getRGB(rgb, THREE.SRGBColorSpace);
            tint.setRGB(
                Math.min(1, rgb.r * f[0]),
                Math.min(1, rgb.g * f[1]),
                Math.min(1, rgb.b * f[2]),
                THREE.SRGBColorSpace,
            );
            return [tint.r, tint.g, tint.b];
        });
        for (const part of caseParts) {
            part.kind.forEach((kind, i) => {
                const [r, g, b] = shades[kind];
                part.attrs.color.setXYZ(i, r, g, b);
            });
            part.attrs.color.needsUpdate = true;
        }
    }

    function disposeCase() {
        for (const part of caseParts) {
            scene.remove(part.mesh);
            part.mesh.geometry.dispose();
            part.mesh.dispose();
        }
        caseParts = [];
    }

    function setCaseColors(case1: string, case2: string) {
        factors = [rgbFactor(case1, DAY_1), rgbFactor(case2, DAY_2)];
        paintCase();
        request();
    }

    function resize(
        width: number,
        heightPx: number,
        caseWidth: number,
    ): SceneInfo {
        cw = Math.max(1, Math.floor(width));
        ch = Math.max(1, Math.floor(heightPx));
        caseW = Math.max(1, caseWidth);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(cw, ch, false);
        const next = shelfWidth(caseW);
        if (next !== shelfW) {
            setShelf(next);
            reflow();
        }
        updateCamera();
        request();
        return info;
    }

    function setTop(px: number) {
        if (px === top) return;
        top = px;
        updateCamera();
        request();
    }

    function toPx(v: THREE.Vector3): THREE.Vector3 {
        v.project(camera);
        return v.set(((v.x + 1) / 2) * cw, ((1 - v.y) / 2) * ch, v.z);
    }

    function boxOf(pts: number[][]): Box {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const p of pts) {
            const v = toPx(proj.set(p[0], p[1], p[2]));
            x0 = Math.min(x0, v.x);
            x1 = Math.max(x1, v.x);
            y0 = Math.min(y0, v.y);
            y1 = Math.max(y1, v.y);
        }
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }

    function face(x0: number, x1: number, y0: number, y1: number, z: number) {
        const a = toPx(proj.set(x0, y0, z));
        const ax = a.x;
        const ay = a.y;
        const c = toPx(proj.set(x1, y1, z));
        return {
            x: Math.min(ax, c.x),
            y: Math.min(ay, c.y),
            w: Math.abs(c.x - ax),
            h: Math.abs(c.y - ay),
        };
    }

    function bookBox(b: BookM): Box {
        return face(b.cx - b.w / 2, b.cx + b.w / 2, b.by, b.by + b.h, FRONT_Z);
    }

    function project(): Projection {
        const books = new Map<string, Box>();
        for (const b of models) books.set(b.slug, bookBox(b));
        const plates = rows.map((r) =>
            r.categoryId === null
                ? null
                : face(
                      plateX,
                      plateX + r.plateW,
                      r.floor - HINGE_DROP,
                      r.floor - HINGE_DROP + PLATE_H,
                      HINGE_Z,
                  ),
        );
        const last = rows[rows.length - 1];
        const add =
            last && last.categoryId === null
                ? face(
                      -30,
                      30,
                      (last.ceil + last.floor) / 2 - 30,
                      (last.ceil + last.floor) / 2 + 30,
                      FRONT_Z,
                  )
                : null;
        return {
            books,
            plates,
            add,
            ink: boxOf(worldCorners(ink.box, ink.group)),
            clock: boxOf(worldCorners(clock.box, clock.group)),
        };
    }

    function bookRect(slug: string): DOMRect | null {
        const b = bySlug.get(slug);
        if (!b) return null;
        const r = canvas.getBoundingClientRect();
        const box = bookBox(b);
        return new DOMRect(r.left + box.x, r.top + box.y, box.w, box.h);
    }

    function scrollFor(slug: string): number | null {
        const b = bySlug.get(slug);
        if (!b) return null;
        const box = bookBox(b);
        if (box.y >= 8 && box.y + box.h <= ch - 8) return null;
        return box.y + box.h / 2 - ch / 2;
    }

    function aim(clientX: number, clientY: number) {
        const r = canvas.getBoundingClientRect();
        raycaster.setFromCamera(
            ndc.set(
                ((clientX - r.left) / r.width) * 2 - 1,
                -((clientY - r.top) / r.height) * 2 + 1,
            ),
            camera,
        );
    }

    function pick(clientX: number, clientY: number): Hit | null {
        aim(clientX, clientY);
        const ray = raycaster.ray;
        const o = rayO;
        const d = rayD;
        const win = spanY * 0.75;
        let best: Hit | null = null;
        let bt = Infinity;
        for (const b of models) {
            if (Math.abs(b.by + b.h / 2 - focus.y) > win) continue;
            o.copy(ray.origin).applyMatrix4(b.inv);
            d.copy(ray.origin).add(ray.direction).applyMatrix4(b.inv).sub(o);
            const t = slab(o, d, b.w / 2 + 0.5, b.h / 2, b.L / 2);
            if (t < bt) {
                bt = t;
                best = { kind: "book", slug: b.slug };
            }
        }
        const hit = plateHit;
        const box = plateBox;
        for (const r of rows) {
            if (r.categoryId === null || (r.plate?.x ?? 0) > 0.5) continue;
            const y0 = r.floor - HINGE_DROP;
            if (Math.abs(y0 + PLATE_H / 2 - focus.y) > win) continue;
            box.min.set(plateX, y0, 0);
            box.max.set(plateX + r.plateW, y0 + PLATE_H, HINGE_Z + 1);
            if (!ray.intersectBox(box, hit)) continue;
            const t = ray.origin.distanceTo(hit);
            if (t < bt) {
                bt = t;
                best = { kind: "plate", categoryId: r.categoryId };
            }
        }
        return best;
    }

    function pointerWorld(clientX: number, clientY: number) {
        aim(clientX, clientY);
        return raycaster.ray.intersectPlane(wall, wallHit);
    }

    function beginDrag(slug: string, clientX: number, clientY: number) {
        const b = bySlug.get(slug);
        const w = pointerWorld(clientX, clientY);
        if (!b || !w || !ghostA || !ghostShell || !ghostPages) return;
        setHover(null);
        dragging = b;
        b.dragged = true;
        b.grabX = b.x.x - w.x;
        b.grabY = b.y.x - w.y;
        b.hand.t = 1;
        b.gx.x = b.gx.t = b.cx;
        b.gy.x = b.gy.t = b.by;
        b.gx.v = b.gy.v = 0;
        showGhost(b);
        dirty = true;
        active.add(b);
        request();
    }

    function dragTo(clientX: number, clientY: number) {
        const b = dragging;
        const w = pointerWorld(clientX, clientY);
        if (!b || !w || !rows.length) return;
        const hw = shelfW / 2 - b.w / 2;
        const top = rows[0].ceil - b.h;
        const bottom = rows[rows.length - 1].floor;
        b.x.x = b.x.t = Math.max(-hw, Math.min(hw, w.x + b.grabX));
        b.y.x = b.y.t = Math.max(bottom, Math.min(top, w.y + b.grabY));
        b.x.v = b.y.v = 0;
        active.add(b);
        request();
    }

    function endDrag() {
        const b = dragging;
        dragging = null;
        if (!b) return;
        b.dragged = false;
        b.hand.t = 0;
        b.x.t = b.cx;
        b.y.t = b.by;
        active.add(b);
        request();
    }

    function slotAt(
        clientX: number,
        clientY: number,
        slug: string,
    ): Slot | null {
        const w = pointerWorld(clientX, clientY);
        if (!w) return null;
        let best: RowM | null = null;
        let bd = Infinity;
        for (const r of rows) {
            if (r.categoryId === null) continue;
            const dist =
                w.y > r.ceil ? w.y - r.ceil : Math.max(0, r.floor - w.y);
            if (dist < bd) {
                bd = dist;
                best = r;
            }
        }
        if (!best || best.categoryId === null) return null;
        const ghost = best.books.findIndex((b) => b.slug === slug);
        const shift =
            ghost < 0 ? 0 : (best.books[ghost].w + best.books[ghost].gap) / 2;
        const others = best.books.filter((b) => b.slug !== slug);
        let index = 0;
        best.books.forEach((b, i) => {
            if (b.slug === slug) return;
            const center = b.cx + (i < ghost ? shift : -shift);
            if (center < w.x) index++;
        });
        return {
            categoryId: best.categoryId,
            slugs: others.map((b) => b.slug),
            index,
        };
    }

    function retarget(b: BookM, target: number) {
        b.a.t = target;
        active.add(b);
        const row = rows[b.row];
        for (const k of [1, 2]) {
            for (const sg of [-1, 1]) {
                const nb = row?.books[b.slot + sg * k];
                if (!nb) continue;
                nb.n.t = target * sg * (k === 1 ? 1 : 0.45);
                active.add(nb);
            }
        }
    }

    function setHover(slug: string | null) {
        const next = (slug && bySlug.get(slug)) || null;
        if (next === hovered) return;
        if (hovered) retarget(hovered, 0);
        hovered = next;
        if (next) retarget(next, 1);
        refreshFold();
        request();
    }

    function setPicked(slug: string | null) {
        const prev = pickedSlug ? bySlug.get(pickedSlug) : undefined;
        pickedSlug = slug;
        const cur = slug ? bySlug.get(slug) : undefined;
        for (const [b, t] of [
            [prev, 0],
            [cur, 1],
        ] as const) {
            if (!b) continue;
            b.p.t = t;
            active.add(b);
        }
        refreshFold();
        request();
    }

    function setInkHover(on: boolean) {
        if (on === inkHovered) return;
        inkHovered = on;
        ink.setHover(on);
        request();
    }

    function setClockHover(on: boolean) {
        clock.setHover(on);
        request();
    }

    function setClockHour(hour: number) {
        clock.setHour(hour);
        request();
    }

    function setClockColors(colors: DialColors) {
        clock.setColors(colors).then(request);
    }

    function onFrame(cb: (() => void) | null) {
        frameCb = cb;
    }

    function onPose(cb: (() => void) | null) {
        poseCb = cb;
    }

    function dispose() {
        disposed = true;
        cancelAnimationFrame(raf);
        reduceMotion.removeEventListener("change", onMotion);
        disposeBooks();
        disposeCase();
        for (const p of plates) removePlate(p);
        plateMats.body.dispose();
        plateMats.hinge.dispose();
        flight = null;
        scene.remove(ink.group);
        ink.dispose();
        scene.remove(clock.group);
        clock.dispose();
        envRT.dispose();
        for (const t of Object.values(T)) t.dispose();
        for (const m of [...litMats, depthMat, bookDepthMat]) m.dispose();
        sun.shadow.dispose();
        renderer.dispose();
    }

    return {
        setLibrary,
        setCaseColors,
        resize,
        setTop,
        scrollFor,
        setHover,
        setInkHover,
        setClockHover,
        setClockHour,
        setClockColors,
        openClock,
        closeClock,
        clockFace,
        clockRadius,
        homography,
        onPose,
        setPicked,
        pick,
        worldPerPx,
        onFrame,
        project,
        bookRect,
        beginDrag,
        dragTo,
        endDrag,
        slotAt,
        dispose,
    };
}

function makeEnvironment(
    renderer: THREE.WebGLRenderer,
): THREE.WebGLRenderTarget {
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(room, 0.04);
    pmrem.dispose();
    room.dispose();
    return rt;
}

function settle(
    s: Spring,
    k: number,
    c: number,
    dt: number,
    snap: boolean,
): boolean {
    if (snap) {
        s.x = s.t;
        s.v = 0;
        return true;
    }
    s.v += (k * (s.t - s.x) - c * s.v) * dt;
    s.x += s.v * dt;
    if (Math.abs(s.x - s.t) < 0.0008 && Math.abs(s.v) < 0.01) {
        s.x = s.t;
        s.v = 0;
        return true;
    }
    return false;
}

function writeAttrs(A: InstAttrs, i: number, b: BookM) {
    A.size.setXYZ(i, b.w, b.h, b.L);
    A.atlas.setXYZW(i, b.rect[0], b.rect[1], b.rect[2], b.rect[3]);
    A.color.setXYZ(i, b.col.r, b.col.g, b.col.b);
    A.aux.setXYZW(i, b.r, b.bands, ROUGH[b.type], b.tone);
}

function carryState(to: BookM, from: BookM) {
    Object.assign(to, {
        a: from.a,
        n: from.n,
        p: from.p,
        x: from.x,
        y: from.y,
        hand: from.hand,
        gx: from.gx,
        gy: from.gy,
        dragged: from.dragged,
        placed: from.placed,
        grabX: from.grabX,
        grabY: from.grabY,
    });
}

function bookSig(b: Book): string {
    return [
        b.slug,
        b.title,
        b.author,
        b.pages,
        b.spineRatio,
        b.widthPx,
        b.spineColor,
        b.spineTextColor,
        b.hasSpineImage,
    ].join("|");
}

function makeModel(book: Book): BookM {
    const { w, h } = spineSize(book);
    const hash = fnv(book.slug);
    const rnd = mulberry32(hash);
    const type = rnd() < 0.45 ? 0 : rnd() < 0.6 ? 1 : 2;
    const ornament =
        !book.hasSpineImage && rnd() < 0.2 ? 1 + Math.floor(rnd() * 4) : 0;
    const bands = type < 2 && rnd() < 0.6 ? 1 : 0;
    const sp = (): Spring => ({ x: 0, v: 0, t: 0 });
    return {
        i: 0,
        slug: book.slug,
        book,
        w,
        h,
        L: book.widthPx
            ? Math.round(Math.min(260, Math.max(190, book.widthPx * 1.05)))
            : 190 + (hash % 71),
        gap: 4 + ((hash >>> 3) % 7),
        tone: hash % 6,
        r: rnd(),
        type,
        bands,
        ornament,
        col: new THREE.Color(book.spineColor),
        rect: [0, 0, 1, 1],
        row: 0,
        slot: 0,
        xl: 0,
        cx: 0,
        by: 0,
        theta: 0,
        a: sp(),
        n: sp(),
        p: sp(),
        x: sp(),
        y: sp(),
        hand: sp(),
        gx: sp(),
        gy: sp(),
        dragged: false,
        placed: false,
        grabX: 0,
        grabY: 0,
        inv: new THREE.Matrix4(),
    };
}

function packRows(
    list: Book[],
    categories: Category[],
    withAddRow: boolean,
    bySlug: Map<string, BookM>,
    shelfW: number,
): RowM[] {
    const groups = new Map<number, BookM[]>(categories.map((c) => [c.id, []]));
    for (const book of list) {
        const m = bySlug.get(book.slug);
        const group =
            groups.get(book.categoryId) ?? groups.get(categories[0].id);
        if (m && group) group.push(m);
    }
    const rows: RowM[] = [];
    const newRow = (
        categoryId: number | null,
        name: string,
        k: number,
    ): RowM => ({
        categoryId,
        name,
        k,
        multi: false,
        books: [],
        used: 0,
        maxH: 0,
        lastGap: 0,
        ceil: 0,
        floor: 0,
        plateW: 0,
        plate: null,
    });
    for (const c of categories) {
        const start = rows.length;
        let row: RowM | null = null;
        for (const b of groups.get(c.id) ?? []) {
            if (
                !row ||
                (row.used + 7 + b.w > shelfW - 2 * PACK_PAD && row.books.length)
            ) {
                row = newRow(c.id, c.name, rows.length - start + 1);
                rows.push(row);
            }
            b.xl = row.used;
            b.slot = row.books.length;
            row.used += b.w + b.gap;
            row.lastGap = b.gap;
            row.maxH = Math.max(row.maxH, b.h);
            row.books.push(b);
        }
        if (!row) rows.push(newRow(c.id, c.name, 1));
        for (const r of rows.slice(start)) r.multi = rows.length - start > 1;
    }
    if (withAddRow) rows.push(newRow(null, "", 1));
    let ceil = -BOARD;
    rows.forEach((r, i) => {
        r.ceil = ceil;
        r.floor = ceil - Math.max(MIN_ROW, r.maxH + 55);
        ceil = r.floor - BOARD;
        const off = (shelfW - (r.used - r.lastGap)) / 2;
        for (const b of r.books) {
            b.row = i;
            b.cx = -shelfW / 2 + off + b.xl + b.w / 2;
            b.by = r.floor;
        }
    });
    return rows;
}

function spread(x: number, d: number, lim: number): number {
    return d > 0
        ? Math.min(d, Math.max(0, lim - x))
        : Math.max(d, Math.min(0, -lim - x));
}

function shelfWidth(caseWidth: number): number {
    return Math.min(
        SHELF_MAX,
        Math.max(SHELF_MIN, caseWidth / MIN_SCALE - FIT_MARGIN),
    );
}

function inkX(shelfW: number): number {
    return shelfW / 2 + SIDE + LID_OVER - INK_RIGHT;
}

function matrix3d(quad: number[][], w: number, h: number): string {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
    const sx = x0 - x1 + x2 - x3;
    const sy = y0 - y1 + y2 - y3;
    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const det = dx1 * dy2 - dx2 * dy1;
    const g = (sx * dy2 - dx2 * sy) / det;
    const k = (dx1 * sy - sx * dy1) / det;
    const a = x1 - x0 + g * x1;
    const b = x3 - x0 + k * x3;
    const d = y1 - y0 + g * y1;
    const e = y3 - y0 + k * y3;
    return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1].join(",")})`;
}

function plateText(r: RowM): string {
    return `${r.name.toUpperCase()}${r.multi ? ` · ${r.k}` : ""}`;
}

function newPose(): Pose {
    return {
        position: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        fov: 0,
        offsetY: 0,
    };
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function worldCorners(
    { min, max }: THREE.Box3,
    group: THREE.Object3D,
): number[][] {
    return [min.x, max.x].flatMap((x) =>
        [min.y, max.y].flatMap((y) =>
            [min.z, max.z].map((z) => {
                const v = new THREE.Vector3(x, y, z).applyMatrix4(
                    group.matrixWorld,
                );
                return [v.x, v.y, v.z];
            }),
        ),
    );
}

function rgbFactor(css: string, day: number[]): number[] {
    let rgb: number[] = day;
    if (css.startsWith("#")) {
        const c = { r: 0, g: 0, b: 0 };
        new THREE.Color(css).getRGB(c, THREE.SRGBColorSpace);
        rgb = [c.r, c.g, c.b];
    } else {
        const m = css.match(/[\d.]+/g);
        if (m && m.length >= 3) rgb = m.slice(0, 3).map((v) => Number(v) / 255);
    }
    return rgb.map((v, i) => v / day[i]);
}

function setAtlas(mat: THREE.Material, tex: THREE.Texture) {
    (mat.userData.mu as Uniforms).uAtlas.value = tex;
}

async function loadFonts() {
    try {
        await Promise.race([
            Promise.all([
                document.fonts.load("600 24px Cormorant", "Абвгд"),
                document.fonts.load("500 12px Manrope", "Абвгд"),
                document.fonts.load("600 12px Manrope", "Абвгд"),
            ]).then(() => document.fonts.ready),
            new Promise((r) => setTimeout(r, 3000)),
        ]);
    } catch {
        return;
    }
}

function packAtlas(books: BookM[], renderer: THREE.WebGLRenderer): Atlas {
    const P = 4;
    const maxT = Math.min(4096, renderer.capabilities.maxTextureSize);
    let s = 2;
    let lay = packTiles(books, s, P, maxT);
    while (!lay && s > 0.3) {
        s *= 0.9;
        lay = packTiles(books, s, P, maxT);
    }
    if (!lay) lay = { pos: [], H: 4 };
    const cv = document.createElement("canvas");
    cv.width = maxT;
    cv.height = lay.H;
    const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
    books.forEach((b, i) => {
        const p = lay.pos[i];
        ctx.fillStyle = b.book.spineColor;
        ctx.fillRect(p.x, p.y, p.tw + 2 * P, p.th + 2 * P);
        b.rect = [
            (p.x + P) / maxT,
            1 - (p.y + P + p.th) / lay.H,
            p.tw / maxT,
            p.th / lay.H,
        ];
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return { tex, ctx, pos: lay.pos, P };
}

function packTiles(books: BookM[], s: number, P: number, maxT: number) {
    const order = books
        .map((_, i) => i)
        .sort((a, b) => books[b].h - books[a].h);
    const pos = new Array<{ x: number; y: number; tw: number; th: number }>(
        books.length,
    );
    let x = 0;
    let y = 0;
    let rowH = 0;
    for (const i of order) {
        const tw = Math.round(books[i].w * s);
        const th = Math.round(books[i].h * s);
        const ow = tw + 2 * P;
        const oh = th + 2 * P;
        if (x + ow > maxT) {
            x = 0;
            y += rowH;
            rowH = 0;
        }
        pos[i] = { x, y, tw, th };
        x += ow;
        rowH = Math.max(rowH, oh);
    }
    const H = y + rowH;
    return H <= maxT ? { pos, H: Math.max(4, Math.ceil(H / 4) * 4) } : null;
}

function drawSpine(
    ctx: CanvasRenderingContext2D,
    b: BookM,
    p: { x: number; y: number; tw: number; th: number },
    P: number,
    image: HTMLImageElement | null,
) {
    const { tw, th } = p;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = b.book.spineColor;
    ctx.fillRect(0, 0, tw + 2 * P, th + 2 * P);
    ctx.translate(P, P);
    if (image) {
        const k = Math.max(tw / image.naturalWidth, th / image.naturalHeight);
        const sw = tw / k;
        const sh = th / k;
        ctx.drawImage(
            image,
            (image.naturalWidth - sw) / 2,
            (image.naturalHeight - sh) / 2,
            sw,
            sh,
            0,
            0,
            tw,
            th,
        );
        ctx.restore();
        return;
    }
    const k = tw / b.w;
    const gilt = "#d8bd7a";
    ctx.strokeStyle = gilt;
    ctx.fillStyle = gilt;
    ctx.lineWidth = Math.max(1, 1.2 * k);
    if (b.ornament === 1) {
        for (const f of [0.035, 0.05, 0.95, 0.965]) {
            ctx.fillRect(tw * 0.1, th * f, tw * 0.8, Math.max(1.5, th * 0.005));
        }
    } else if (b.ornament === 2) {
        ctx.strokeRect(tw * 0.12, tw * 0.12, tw * 0.76, th - tw * 0.24);
        ctx.globalAlpha = 0.6;
        ctx.strokeRect(tw * 0.22, tw * 0.22, tw * 0.56, th - tw * 0.44);
        ctx.globalAlpha = 1;
    } else if (b.ornament === 3) {
        const step = tw * 0.8;
        for (let yy = step * 0.7; yy < th; yy += step) {
            if (yy > th * 0.12 && yy < th * 0.82) continue;
            ctx.beginPath();
            ctx.moveTo(tw / 2, yy - step * 0.3);
            ctx.lineTo(tw / 2 + tw * 0.25, yy);
            ctx.lineTo(tw / 2, yy + step * 0.3);
            ctx.lineTo(tw / 2 - tw * 0.25, yy);
            ctx.closePath();
            ctx.fill();
        }
    } else if (b.ornament === 4) {
        const g = ctx.createLinearGradient(0, 0, 0, th);
        g.addColorStop(0, "rgba(255,255,255,0.22)");
        g.addColorStop(1, "rgba(0,0,0,0.3)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, tw, th);
        ctx.beginPath();
        ctx.arc(tw / 2, th * 0.9, tw * 0.28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tw / 2, th * 0.9, tw * 0.12, 0, Math.PI * 2);
        ctx.stroke();
    }
    const fs = Math.max(10, Math.min(b.w * 0.5, 26)) * k;
    const afs = Math.max(7.5 * k, fs * 0.46);
    const showAuthor = b.w >= 26;
    const tLen = th * (showAuthor ? 0.62 : 0.84) - 2 * P;
    if (b.ornament) {
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.fillRect(tw * 0.18, th * 0.06, tw * 0.64, tLen + th * 0.04);
    }
    ctx.fillStyle = b.book.spineTextColor;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = `600 ${fs}px Cormorant, "Cormorant Garamond", Georgia, serif`;
    const cx = showAuthor ? tw * 0.42 : tw * 0.5;
    vtext(ctx, fitText(ctx, b.book.title, tLen), cx, th * 0.07);
    if (showAuthor) {
        ctx.globalAlpha = 0.85;
        ctx.font = `500 ${afs}px Manrope, system-ui, sans-serif`;
        vtext(ctx, fitText(ctx, b.book.author, th * 0.24), tw * 0.8, th * 0.72);
        ctx.globalAlpha = 1;
    }
    ctx.restore();
}

function vtext(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(text, 0, 0);
    ctx.restore();
}

function fitText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxW: number,
): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let lo = 1;
    let hi = text.length;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxW) lo = mid;
        else hi = mid - 1;
    }
    return `${text.slice(0, lo).trimEnd()}…`;
}

function legacy<M extends THREE.Material>(m: M): M {
    m.customProgramCacheKey = () => "plate";
    m.onBeforeCompile = legacyLighting;
    return m;
}

function stepPlate(p: PlateM, now: number, dt: number, snap: boolean) {
    if (p.at && now >= p.at) {
        p.tgt = 0;
        p.at = 0;
    }
    if (snap) {
        p.x = p.tgt;
        p.v = 0;
    } else {
        p.v += (FOLD_K * (p.tgt - p.x) - FOLD_C * p.v) * dt;
        p.x += p.v * dt;
        if (p.x < 0) {
            p.x = 0;
            p.v = 0;
        }
        if (Math.abs(p.x - p.tgt) < 5e-4 && Math.abs(p.v) < 0.01) {
            p.x = p.tgt;
            p.v = 0;
        }
    }
    p.running = !!p.at || p.x !== p.tgt || p.v !== 0;
}

function makePlate(text: string, mats: PlateMats): PlateM {
    const S = PLATE_PX;
    const font = (size: number) => `600 ${size}px Cormorant, Georgia, serif`;
    const probe = document
        .createElement("canvas")
        .getContext("2d") as CanvasRenderingContext2D;
    const spacedW = (size: number) => {
        probe.font = font(size);
        let w = 0;
        for (const ch of text) w += probe.measureText(ch).width + 0.16 * size;
        return w;
    };
    let size = PLATE_SIZE * S;
    while (size > 20 && spacedW(size) / S + 2 * PLATE_PAD > 300) size--;
    const w = Math.ceil(spacedW(size)) / S + 2 * PLATE_PAD;
    const fw = w - PLATE_INSET;
    const fh = PLATE_H - PLATE_INSET;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(fw * S);
    cv.height = Math.ceil(fh * S);
    drawEnamel(cv, text, font(size), size, S, PLATE_PAD - PLATE_INSET / 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = mats.aniso;
    const face = legacy(
        new THREE.MeshPhysicalMaterial({
            map: tex,
            roughness: 0.16,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
        }),
    );
    face.color.setScalar(1.35);
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    root.add(pivot);
    const geos: THREE.BufferGeometry[] = [];
    const add = (
        parent: THREE.Object3D,
        geo: THREE.BufferGeometry,
        mat: THREE.Material,
        pos: number[],
        cast: boolean,
    ) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(pos[0], pos[1], pos[2]);
        m.castShadow = cast;
        m.receiveShadow = true;
        parent.add(m);
        geos.push(geo);
    };
    add(
        pivot,
        new RoundedBoxGeometry(w, PLATE_H, PLATE_T, 2, 0.6),
        mats.body,
        [w / 2, PLATE_H / 2, -PLATE_T / 2],
        true,
    );
    add(
        pivot,
        new THREE.PlaneGeometry(fw, fh),
        face,
        [w / 2, PLATE_H / 2, 0.05],
        false,
    );
    add(
        pivot,
        new THREE.BoxGeometry(w, 3.2, 0.4),
        mats.hinge,
        [w / 2, 1.6, 0.25],
        true,
    );
    add(
        root,
        new THREE.CylinderGeometry(1, 1, w, 14).rotateZ(Math.PI / 2),
        mats.hinge,
        [w / 2, 0, 0],
        true,
    );
    add(
        root,
        new THREE.BoxGeometry(w, 0.5, HINGE_Z),
        mats.hinge,
        [w / 2, -0.35, -HINGE_Z / 2],
        true,
    );
    return {
        text,
        width: w,
        root,
        pivot,
        tex,
        face,
        geos,
        x: 0,
        v: 0,
        tgt: 0,
        want: 0,
        at: 0,
        running: false,
    };
}

function drawEnamel(
    cv: HTMLCanvasElement,
    text: string,
    font: string,
    size: number,
    px: number,
    pad: number,
) {
    const g = cv.getContext("2d") as CanvasRenderingContext2D;
    const { width: W, height: H } = cv;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#fbfaf5");
    gr.addColorStop(1, "#eceae0");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#14306a";
    g.lineWidth = 1.1 * px;
    g.strokeRect(1.2 * px, 1.2 * px, W - 2.4 * px, H - 2.4 * px);
    g.lineWidth = 0.35 * px;
    g.strokeRect(2.6 * px, 2.6 * px, W - 5.2 * px, H - 5.2 * px);
    g.fillStyle = "#14306a";
    g.font = font;
    g.textBaseline = "middle";
    let x = pad * px;
    for (const ch of text) {
        g.fillText(ch, x, H / 2 + size * 0.04);
        x += g.measureText(ch).width + 0.16 * size;
    }
}

function plinthGeo(
    w: number,
    h: number,
    d: number,
    r: number,
): THREE.BufferGeometry {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, h / 2);
    s.lineTo(w / 2, h / 2);
    s.lineTo(w / 2, r - h / 2);
    s.absarc(w / 2 - r, r - h / 2, r, 0, -Math.PI / 2, true);
    s.lineTo(r - w / 2, -h / 2);
    s.absarc(r - w / 2, r - h / 2, r, -Math.PI / 2, -Math.PI, true);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: d,
        bevelEnabled: false,
        curveSegments: 10,
    });
    g.translate(0, 0, -d / 2);
    const pos = g.getAttribute("position");
    const n = pos.count;
    g.deleteAttribute("uv");
    g.setAttribute("aOff", pos.clone());
    g.setAttribute(
        "aFrac",
        new THREE.BufferAttribute(new Float32Array(n * 3), 3),
    );
    g.setAttribute(
        "aFlag",
        new THREE.BufferAttribute(new Float32Array(n * 2), 2),
    );
    g.setAttribute("aBand", new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
}

function boxGeo(sel: number): THREE.BufferGeometry {
    return makeGeo([{ r: [FULL, FULL, FULL], sel, nobul: true }]);
}

function makeGeo(parts: Part[]): THREE.BufferGeometry {
    const g: GeoData = { fr: [], of: [], nm: [], fl: [], bd: [], ix: [] };
    for (const part of parts) addBox(g, part);
    const geo = new THREE.BufferGeometry();
    const put = (name: string, arr: number[], k: number) =>
        geo.setAttribute(
            name,
            new THREE.BufferAttribute(new Float32Array(arr), k),
        );
    put(
        "position",
        g.fr.map((v) => v * 0.5),
        3,
    );
    put("normal", g.nm, 3);
    put("aFrac", g.fr, 3);
    put("aOff", g.of, 3);
    put("aFlag", g.fl, 2);
    put("aBand", g.bd, 1);
    geo.setIndex(
        new THREE.BufferAttribute(
            g.fr.length / 3 > 65535
                ? new Uint32Array(g.ix)
                : new Uint16Array(g.ix),
            1,
        ),
    );
    return geo;
}

interface SpPoint {
    f: number[];
    o: number[];
}

function addBox(g: GeoData, P: Part) {
    const c = P.c || 0;
    const R = P.r;
    const seg = P.seg || [1, 1, 1];
    const loP = (a: number) => [R[a][0], R[a][1]];
    const hiP = (a: number) => [R[a][2], R[a][3]];
    const loI = (a: number) => [R[a][0], R[a][1] + c];
    const hiI = (a: number) => [R[a][2], R[a][3] - c];
    const inner = (a: number, t: number) => {
        const l = loI(a);
        const h = hiI(a);
        return [l[0] + (h[0] - l[0]) * t, l[1] + (h[1] - l[1]) * t];
    };
    const edge = (a: number, s: number) => (s < 0 ? loI(a) : hiI(a));
    const plane = (a: number, s: number) => (s < 0 ? loP(a) : hiP(a));
    const mk = (sp: number[][]): SpPoint => ({
        f: [sp[0][0], sp[1][0], sp[2][0]],
        o: [sp[0][1], sp[1][1], sp[2][1]],
    });
    for (let a = 0; a < 3; a++) {
        for (const s of [-1, 1]) {
            const b = (a + 1) % 3;
            const d = (a + 2) % 3;
            const n = [0, 0, 0];
            n[a] = s;
            emitGrid(
                g,
                seg[b],
                seg[d],
                (u, v) => {
                    const sp: number[][] = [];
                    sp[a] = plane(a, s);
                    sp[b] = inner(b, u);
                    sp[d] = inner(d, v);
                    return mk(sp);
                },
                n,
                P,
            );
        }
    }
    if (!c) return;
    for (let a = 0; a < 3; a++) {
        for (let b = a + 1; b < 3; b++) {
            const d = 3 - a - b;
            for (const sa of [-1, 1]) {
                for (const sb of [-1, 1]) {
                    const n = [0, 0, 0];
                    n[a] = sa;
                    n[b] = sb;
                    emitGrid(
                        g,
                        1,
                        seg[d],
                        (u, v) => {
                            const sp: number[][] = [];
                            sp[a] = u ? edge(a, sa) : plane(a, sa);
                            sp[b] = u ? plane(b, sb) : edge(b, sb);
                            sp[d] = inner(d, v);
                            return mk(sp);
                        },
                        n,
                        P,
                    );
                }
            }
        }
    }
    for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
            for (const sz of [-1, 1]) {
                const s = [sx, sy, sz];
                const V = (k: number) =>
                    mk(
                        [0, 1, 2].map((a) =>
                            a === k ? plane(a, s[a]) : edge(a, s[a]),
                        ),
                    );
                emitTri(g, V(0), V(1), V(2), s, P);
            }
        }
    }
}

function refPos(p: SpPoint): number[] {
    return [p.f[0] * 20 + p.o[0], p.f[1] * 125 + p.o[1], p.f[2] * 110 + p.o[2]];
}

function needsFlip(
    p0: SpPoint,
    p1: SpPoint,
    p2: SpPoint,
    n: number[],
): boolean {
    const a = refPos(p0);
    const b = refPos(p1);
    const c = refPos(p2);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    ];
    return cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
}

function pushV(g: GeoData, p: SpPoint, n: number[], P: Part) {
    const l = Math.hypot(n[0], n[1], n[2]);
    g.fr.push(p.f[0], p.f[1], p.f[2]);
    g.of.push(p.o[0], p.o[1], p.o[2]);
    g.nm.push(n[0] / l, n[1] / l, n[2] / l);
    g.fl.push(P.sel, !P.nobul && p.f[2] === 1 ? 1 : 0);
    g.bd.push(P.band ? 1 : 0);
}

function emitGrid(
    g: GeoData,
    nu: number,
    nv: number,
    at: (u: number, v: number) => SpPoint,
    n: number[],
    P: Part,
) {
    const base = g.fr.length / 3;
    const pts: SpPoint[] = [];
    for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
            const p = at(i / nu, j / nv);
            pts.push(p);
            pushV(g, p, n, P);
        }
    }
    const flip = needsFlip(pts[0], pts[1], pts[nu + 1], n);
    for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
            const a = base + j * (nu + 1) + i;
            const b = a + 1;
            const c = a + nu + 1;
            const d = c + 1;
            if (flip) g.ix.push(a, d, b, a, c, d);
            else g.ix.push(a, b, d, a, d, c);
        }
    }
}

function emitTri(
    g: GeoData,
    p0: SpPoint,
    p1: SpPoint,
    p2: SpPoint,
    n: number[],
    P: Part,
) {
    const base = g.fr.length / 3;
    for (const p of [p0, p1, p2]) pushV(g, p, n, P);
    if (needsFlip(p0, p1, p2, n)) g.ix.push(base, base + 2, base + 1);
    else g.ix.push(base, base + 1, base + 2);
}

function instAttr(n: number, k: number): THREE.InstancedBufferAttribute {
    return new THREE.InstancedBufferAttribute(new Float32Array(n * k), k);
}

function newCasePart(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    n: number,
): CasePart {
    const cap = n + CASE_SLACK;
    return {
        mesh: new THREE.InstancedMesh(geo, mat, cap),
        capacity: cap,
        attrs: {
            size: instAttr(cap, 3),
            atlas: instAttr(cap, 4),
            color: instAttr(cap, 3),
            aux: instAttr(cap, 4),
        },
        kind: [],
    };
}

function attach(geo: THREE.BufferGeometry, A: InstAttrs) {
    geo.setAttribute("iSize", A.size);
    geo.setAttribute("iAtlas", A.atlas);
    geo.setAttribute("iColor", A.color);
    geo.setAttribute("iAux", A.aux);
}

const VPRE = `
#include <common>
attribute vec3 aFrac;
attribute vec3 aOff;
attribute vec2 aFlag;
attribute float aBand;
attribute vec3 iSize;
attribute vec4 iAux;
attribute vec3 iColor;
attribute vec4 iAtlas;
uniform float uBulge;
vec3 bookRaw() { return aFrac * iSize * 0.5 + aOff; }
vec3 bookPos() {
  vec3 p = bookRaw();
  float u = p.x * 2.0 / iSize.x;
  float q = 1.0 - u * u;
  p.z += aFlag.y * uBulge * iSize.x * q;
  p.z -= aBand * (1.0 - iAux.y) * 3.5;
  return p;
}
vec3 bookNormal() {
  vec3 p = bookRaw();
  float u = p.x * 2.0 / iSize.x;
  vec3 n = normal;
  n.x += (aFlag.y * uBulge * 4.0 * u) * n.z;
  return normalize(n);
}
`;

const VARY = `
varying float vSel;
varying vec3 vObjN;
varying vec3 vOP;
varying vec3 vSz;
varying vec3 vCol;
varying vec4 vAux;
varying vec2 vAtlasUv;
varying vec2 vLuv;
`;

const VSETUP = `
vSel = aFlag.x;
vObjN = objectNormal;
vOP = transformed;
vSz = iSize;
vCol = iColor;
vAux = iAux;
vAtlasUv = iAtlas.xy + (transformed.xy / iSize.xy + 0.5) * iAtlas.zw;
vec3 an = abs(objectNormal);
bool axX = an.x > an.y && an.x > an.z;
bool axY = !axX && an.y > an.z;
vec2 uvp = axX ? transformed.zy : (axY ? transformed.xz : transformed.xy);
vLuv = uvp / 6.0 + vec2(iAux.x * 7.0, 0.0);
#ifdef USE_NORMALMAP
vNormalMapUv = uvp / uUvScale + vec2(iAux.x * 7.0, iAux.x * 3.0);
#endif
`;

const FPRE = `
#include <common>
${VARY}
uniform sampler2D uAtlas;
uniform sampler2D uPageTex;
uniform sampler2D uGrain;
uniform vec3 uTones[12];
uniform float uKind;

vec3 sc(float r, float g, float b) {
  return vec3(r, g, b) / 255.0;
}
vec3 stops(float t, vec3 a, vec3 b, float tb, vec3 c, float tc, vec3 d) {
  return t < tb ? mix(a, b, t / tb) : (t < tc ? mix(b, c, (t - tb) / (tc - tb)) : mix(c, d, (t - tc) / (1.0 - tc)));
}
vec3 caseShade() {
  vec3 q = vOP / vSz + 0.5;
  vec3 n = vObjN;
  float st = vAux.w;
  bool sx = abs(n.x) > 0.5;
  bool sy = abs(n.y) > 0.5;
  vec2 gs = texture2D(uGrain, vec2(sx ? vOP.z : vOP.x, sy ? vOP.z : vOP.y) / 3.0).rg;
  vec3 c1 = vec3(1.0);
  vec3 c2 = sc(238.0, 241.0, 246.0);
  vec3 c3 = sc(221.0, 227.0, 236.0);
  vec3 ce = sc(201.0, 210.0, 222.0);
  vec3 ink = sc(30.0, 46.0, 68.0);
  vec3 shade = sc(40.0, 58.0, 82.0);
  vec3 c = c2;
  vec3 ref = c1;
  float lift = 1.0;
  if (st > 1.5 && st < 2.5) {
    lift = 1.08;
    ref = c2;
    float t = 1.0 - q.y;
    c = mix(sc(213.0, 220.0, 230.0), c2, t);
    c *= 1.0 - 0.05 * gs.x;
    float e = min(q.x, 1.0 - q.x);
    float a = e < 0.09 ? mix(0.18, 0.05, e / 0.09) : mix(0.05, 0.0, clamp((e - 0.09) / 0.17, 0.0, 1.0));
    float b = t < 0.22 ? mix(0.2, 0.05, t / 0.22) : (t < 0.5 ? mix(0.05, 0.0, (t - 0.22) / 0.28) : mix(0.0, 0.12, (t - 0.5) / 0.5));
    c = mix(c, ink, a * 0.1);
    c = mix(c, shade, b * 0.1);
    c = mix(c, ink, 0.6 * 0.1 * (1.0 - smoothstep(4.0, 40.0, t * vSz.y)));
  } else if (st > 0.5 && st < 1.5) {
    if (sx) {
      lift = 1.3;
      float tf = 1.0 - q.z;
      c = tf < 0.45 ? mix(c1, c2, tf / 0.45) : mix(c2, c3, (tf - 0.45) / 0.55);
      c *= 1.0 - 0.05 * gs.x;
      c = mix(c, shade, 0.55 * 0.1 * (1.0 - smoothstep(0.0, 30.0, q.z * vSz.z)));
    }
  } else if (st > 4.5) {
    if (n.z > 0.5) {
      float t = 1.0 - q.y;
      vec3 groove = c2 * 0.9;
      c = t < 0.22 ? mix(c1, c2, t / 0.22) : (t < 0.34 ? mix(c2, groove, (t - 0.22) / 0.12) : (t < 0.38 ? mix(groove, c2, (t - 0.34) / 0.04) : mix(c2, ce, (t - 0.38) / 0.62)));
      c *= 1.0 - 0.05 * gs.x;
      c = mix(c, c1, 0.7 * (1.0 - smoothstep(0.0, 5.0, t * vSz.y)));
    }
  } else {
    bool lid = st > 3.5;
    if (n.y > 0.5) {
      lift = 1.2;
      ref = lid ? sc(251.0, 252.0, 254.0) : sc(248.0, 250.0, 253.0);
      c = lid
        ? stops(q.z, sc(230.0, 236.0, 244.0), sc(242.0, 245.0, 250.0), 0.4, ref, 0.999, ref)
        : stops(q.z, sc(195.0, 206.0, 221.0), sc(219.0, 227.0, 238.0), 0.12, sc(238.0, 242.0, 248.0), 0.45, ref);
      c *= 1.0 - 0.04 * gs.y;
      if (!lid) c = mix(c, shade, 0.55 * 0.1 * (1.0 - smoothstep(0.0, 24.0, q.z * vSz.z)));
      c = mix(c, c1, 0.85 * (1.0 - smoothstep(0.0, 3.5, (1.0 - q.z) * vSz.z)));
    } else {
      float t = clamp(1.0 - q.y, 0.0, 1.0);
      c = t < 0.55 ? mix(c1, c2, t / 0.55) : mix(c2, ce, (t - 0.55) / 0.45);
      c *= 1.0 - 0.06 * gs.y;
    }
  }
  return lift * pow(c, vec3(2.2)) / pow(ref, vec3(2.2));
}
`;

const FMAP = `
float texLines = texture2D(uPageTex, vLuv).r;
vec3 texSpine = texture2D(uAtlas, vAtlasUv).rgb;
float spW = 0.0;
float pgW = 0.0;
vec3 bc = vCol;
if (uKind > 0.5) {
  bc = vCol * caseShade();
} else {
  float sel = vSel;
  if ((sel > 0.5 && sel < 1.5) || (sel > 2.5 && sel < 3.5)) spW = smoothstep(0.45, 0.75, vObjN.z);
  if (sel > 1.5 && sel < 2.5) pgW = 1.0;
  else if (sel > 2.5 && sel < 3.5) pgW = (1.0 - spW) * smoothstep(0.45, 0.75, max(abs(vObjN.y), -vObjN.z));
  if (sel > 3.5) bc = mix(vCol, vec3(0.68, 0.52, 0.2), 0.55);
  int ti = int(vAux.w + 0.5) * 2;
  vec3 pc = mix(uTones[ti + 1], uTones[ti], texLines);
  float topF = step(0.5, abs(vObjN.y));
  float gut = smoothstep(0.0, 60.0, vSz.z * 0.5 - vOP.z);
  pc *= mix(1.0, mix(0.6, 1.0, gut), topF);
  bc = mix(bc, pc, pgW);
  bc = mix(bc, texSpine, spW);
}
diffuseColor.rgb *= bc;
`;

function makeBookMaterial(
    kind: number,
    uvScale: number,
    normalMap: THREE.Texture | null,
    U: Uniforms,
    T: Statics,
    tones: THREE.Vector3[],
): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
        roughness: 0.7,
        metalness: 0,
        normalMap: normalMap || null,
    });
    const mu: Uniforms = {
        uAtlas: { value: T.white },
        uPageTex: { value: T.pageLines },
        uGrain: { value: T.stripe },
        uKind: { value: kind },
        uUvScale: { value: uvScale },
        uTones: { value: tones },
    };
    m.userData.mu = mu;
    m.customProgramCacheKey = () => "book";
    m.onBeforeCompile = (sh) => {
        legacyLighting(sh);
        Object.assign(sh.uniforms, U, mu);
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                `${VPRE}${VARY}uniform float uUvScale;\n`,
            )
            .replace(
                "#include <beginnormal_vertex>",
                "vec3 objectNormal = bookNormal();",
            )
            .replace(
                "#include <begin_vertex>",
                `vec3 transformed = bookPos();\n${VSETUP}`,
            );
        sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", FPRE)
            .replace("#include <map_fragment>", FMAP)
            .replace(
                "#include <roughnessmap_fragment>",
                "#include <roughnessmap_fragment>\nroughnessFactor = (uKind > 0.5 && uKind < 1.5) ? 0.53 : mix(vAux.z, 0.85, pgW);",
            );
    };
    return m;
}

function patchDepth(U: Uniforms, skip: boolean): THREE.MeshDepthMaterial {
    const mat = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
    });
    mat.customProgramCacheKey = () => (skip ? "geo-depth-skip" : "geo-depth");
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uBulge = U.uBulge;
        sh.uniforms.uSkip = U.uSkip;
        sh.vertexShader = sh.vertexShader
            .replace("#include <common>", `${VPRE}uniform float uSkip;\n`)
            .replace(
                "#include <project_vertex>",
                skip
                    ? "#include <project_vertex>\nif (float(gl_InstanceID) == uSkip) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);"
                    : "#include <project_vertex>",
            )
            .replace(
                "#include <beginnormal_vertex>",
                "vec3 objectNormal = bookNormal();",
            )
            .replace(
                "#include <begin_vertex>",
                "vec3 transformed = bookPos();",
            );
    };
    return mat;
}

function makeStaticTextures(renderer: THREE.WebGLRenderer): Statics {
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const rnd = mulberry32(7);
    const amp = Array.from({ length: 6 }, () => 0.65 + 0.35 * rnd());
    const leaf = (x: number) =>
        amp[Math.floor(x / 16)] *
        (0.5 - 0.5 * Math.cos((2 * Math.PI * (x % 16)) / 16));
    const canvasTex = (
        w: number,
        h: number,
        draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
        srgb: boolean,
    ) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        draw(c.getContext("2d") as CanvasRenderingContext2D, w, h);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = aniso;
        return t;
    };
    const fillData = (
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        fn: (x: number, y: number) => number[],
    ) => {
        const id = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const px = fn(x, y);
                const i = (y * w + x) * 4;
                id.data[i] = px[0];
                id.data[i + 1] = px[1];
                id.data[i + 2] = px[2];
                id.data[i + 3] = px[3];
            }
        }
        ctx.putImageData(id, 0, 0);
    };
    const normalTex = (
        w: number,
        h: number,
        hf: (x: number, y: number) => number,
        strength: number,
    ) => {
        const hv = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) hv[y * w + x] = hf(x, y);
        }
        return canvasTex(
            w,
            h,
            (ctx) =>
                fillData(ctx, w, h, (x, y) => {
                    const dx =
                        hv[y * w + ((x + 1) % w)] -
                        hv[y * w + ((x + w - 1) % w)];
                    const dy =
                        hv[((y + 1) % h) * w + x] -
                        hv[((y + h - 1) % h) * w + x];
                    const nx = -dx * strength;
                    const ny = dy * strength;
                    const l = Math.hypot(nx, ny, 1);
                    return [
                        ((nx / l) * 0.5 + 0.5) * 255,
                        ((ny / l) * 0.5 + 0.5) * 255,
                        ((1 / l) * 0.5 + 0.5) * 255,
                        255,
                    ];
                }),
            false,
        );
    };
    const pageLines = canvasTex(
        96,
        4,
        (ctx, w, h) =>
            fillData(ctx, w, h, (x) => {
                const v = (0.45 + 0.55 * leaf(x)) * 255;
                return [v, v, v, 255];
            }),
        false,
    );
    const pageNormal = normalTex(96, 4, (x) => leaf(x), 2.2);
    const noise = new Float32Array(128 * 128).map(() => rnd());
    const smooth = (x: number, y: number) => {
        let s = 0;
        for (let j = -1; j <= 1; j++) {
            for (let i = -1; i <= 1; i++) {
                s += noise[((y + j + 128) % 128) * 128 + ((x + i + 128) % 128)];
            }
        }
        return s / 9;
    };
    const grain = normalTex(
        128,
        128,
        (x, y) =>
            0.3 * Math.cos((2 * Math.PI * x) / 16) +
            0.3 * Math.cos((2 * Math.PI * y) / 16) +
            0.8 * smooth(x, y),
        1.4,
    );
    const stripe = canvasTex(
        3,
        3,
        (ctx, w, h) =>
            fillData(ctx, w, h, (x, y) => [
                x === 0 ? 255 : 0,
                y === 0 ? 255 : 0,
                0,
                255,
            ]),
        false,
    );
    const white = canvasTex(
        4,
        4,
        (ctx) => {
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, 4, 4);
        },
        false,
    );
    return { pageLines, pageNormal, grain, stripe, white };
}

function spineBox(pages: number, ratio: number): { w: number; h: number } {
    let w = 22 + pages / 16;
    let h = w * ratio;
    const grow = Math.max(22 / w, 200 / h);
    if (grow > 1) {
        w *= grow;
        h *= grow;
    }
    const shrink = Math.min(60 / w, 350 / h);
    if (shrink < 1) {
        w *= shrink;
        h *= shrink;
    }
    return {
        w: Math.round(Math.min(60, Math.max(22, w))),
        h: Math.round(Math.min(350, Math.max(200, h))),
    };
}

function mulberry32(a: number): () => number {
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function fnv(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function slab(
    o: THREE.Vector3,
    d: THREE.Vector3,
    hx: number,
    hy: number,
    hz: number,
): number {
    let t0 = -Infinity;
    let t1 = Infinity;
    const h = [hx, hy, hz];
    const oo = [o.x, o.y, o.z];
    const dd = [d.x, d.y, d.z];
    for (let a = 0; a < 3; a++) {
        if (Math.abs(dd[a]) < 1e-9) {
            if (Math.abs(oo[a]) > h[a]) return Infinity;
            continue;
        }
        const ta = (-h[a] - oo[a]) / dd[a];
        const tb = (h[a] - oo[a]) / dd[a];
        t0 = Math.max(t0, Math.min(ta, tb));
        t1 = Math.min(t1, Math.max(ta, tb));
    }
    return t1 >= Math.max(t0, 0) ? Math.max(t0, 0) : Infinity;
}
