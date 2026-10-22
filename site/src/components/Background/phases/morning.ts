import type { Phase } from "../daylight";

export default {
    brightness: 1.02,
    saturate: 1.04,
    tint: [255, 226, 188],
    tintOpacity: 0.22,
    stars: 0,
    haze: [253, 240, 220],
    hazeOpacity: 1,
    ridge: [246, 204, 158],
    ridgeMix: 0.1,
    sky: [
        [181, 194, 214],
        [233, 206, 178],
        [247, 219, 170],
    ],
    vars: {
        "--surface": [255, 251, 244],
        "--paper": [255, 251, 243],
        "--case-1": [255, 252, 246],
        "--case-2": [245, 240, 232],
        "--case-3": [232, 224, 211],
        "--case-edge": [212, 201, 185],
        "--ink": [52, 46, 44],
        "--ink-soft": [124, 106, 92],
        "--ink-faint": [160, 143, 125],
        "--accent": [168, 120, 76],
        "--sky": [240, 211, 176],
    },
} satisfies Phase;
