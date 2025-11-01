export const input = {
    forward: 0,
    right: 0,
    up: 0,
    flyToggle: false
};

export function setupInput() {
    window.addEventListener("keydown", (e) => {
        if (e.key === "w") input.forward = -1;
        if (e.key === "s") input.forward = 1;
        if (e.key === "a") input.right = 1;
        if (e.key === "d") input.right = -1;
        if (e.key === " ") input.up = 1;
        if (e.key === "Shift") input.up = -1;
        if (e.key === "f") input.flyToggle = true;
    });

    window.addEventListener("keyup", (e) => {
        if (e.key === "w" || e.key === "s") input.forward = 0;
        if (e.key === "a" || e.key === "d") input.right = 0;
        if (e.key === " " || e.key === "Shift") input.up = 0;
        if (e.key === "f") input.flyToggle = false;
    });
}
