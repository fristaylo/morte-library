import type { Phase } from "../daylight";

export default {
    brightness: 0.34,
    saturate: 0.6,
    tint: [38, 50, 112],
    tintOpacity: 0.78,
    stars: 1,
    haze: [158, 178, 224],
    hazeOpacity: 1.4,
    ridge: [92, 112, 166],
    ridgeMix: 0.34,
    sky: [
        [168, 184, 230],
        [196, 208, 238],
        [226, 228, 246],
    ],
    vars: {
        "--surface": [223, 227, 240],
        "--paper": [226, 229, 240],
        "--case-1": [224, 228, 240],
        "--case-2": [210, 215, 231],
        "--case-3": [193, 199, 218],
        "--case-edge": [172, 180, 200],
        "--ink": [28, 34, 51],
        "--ink-soft": [95, 105, 131],
        "--ink-faint": [152, 161, 190],
        "--accent": [61, 79, 117],
        "--sky": [22, 27, 45],
    },
} satisfies Phase;
