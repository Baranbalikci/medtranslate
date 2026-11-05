// Lets feature modules navigate without importing the app entry point.
export const bridge = { navigate: (to) => { location.href = to; } };
