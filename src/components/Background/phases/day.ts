import type { Phase } from "../daylight";

export default {
    brightness: 1.06,
    saturate: 1,
    tint: [230, 240, 250],
    tintOpacity: 0.12,
    stars: 0,
    haze: [241, 247, 252],
    hazeOpacity: 0.9,
    ridge: [204, 223, 238],
    ridgeMix: 0.1,
    sky: [
        [143, 178, 218],
        [182, 207, 232],
        [229, 237, 238],
    ],
    vars: {
        "--surface": [255, 255, 255],
        "--paper": [253, 253, 251],
        "--case-1": [255, 255, 255],
        "--case-2": [238, 241, 246],
        "--case-3": [221, 227, 236],
        "--case-edge": [201, 210, 222],
        "--ink": [34, 43, 54],
        "--ink-soft": [95, 113, 134],
        "--ink-faint": [144, 160, 178],
        "--accent": [86, 120, 156],
        "--sky": [181, 206, 231],
    },
} satisfies Phase;
