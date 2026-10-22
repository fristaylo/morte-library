import type { Phase } from "../daylight";

export default {
    brightness: 0.93,
    saturate: 1.04,
    tint: [228, 176, 188],
    tintOpacity: 0.26,
    stars: 0,
    haze: [246, 198, 184],
    hazeOpacity: 1.15,
    ridge: [224, 148, 130],
    ridgeMix: 0.18,
    sky: [
        [126, 116, 156],
        [197, 138, 152],
        [236, 168, 142],
    ],
    vars: {
        "--surface": [252, 244, 243],
        "--paper": [251, 243, 241],
        "--case-1": [252, 245, 245],
        "--case-2": [241, 231, 234],
        "--case-3": [227, 214, 220],
        "--case-edge": [206, 190, 198],
        "--ink": [48, 39, 52],
        "--ink-soft": [116, 97, 117],
        "--ink-faint": [158, 138, 155],
        "--accent": [140, 92, 122],
        "--sky": [190, 136, 150],
    },
} satisfies Phase;
